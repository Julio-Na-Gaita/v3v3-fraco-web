import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { normalizeVote, sortMatchesGlobal, type MatchDoc, type MatchView } from "./contracts";

export type MedalDetail = {
  icon: string;     // "🔥", "🦓", etc
  name: string;     // "ON FIRE"
  desc: string;     // "Palpitou 3 acertos seguidos."
  date: string;     // "13/02/26" ou "Atual" ou "2025"
  ts: number;       // timestamp p/ ordenar (Atual = +inf)
};

export type UserProfilePayload = {
  userId: string;
  displayName: string;
  photoBase64?: string;
  activeMedals: string[];     // com repetição (pra contar 2x/3x)
  trophyRoom: MedalDetail[];  // lista completa com datas/descrições
};

function tsToDateLoose(ts: any): Date | null {
  try {
    return ts?.toDate ? ts.toDate() : null;
  } catch {
    return null;
  }
}

function ddmmyy(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

const MONTHS_PT = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO",
];

function countIcon(list: string[], icon: string) {
  let n = 0;
  for (const x of list) if (x === icon) n++;
  return n;
}

function mapMatchDocView(id: string, data: MatchDoc): MatchView & { finishedAt: Date | null } {
  const deadline = tsToDateLoose((data as any).deadline);
  const createdAt = tsToDateLoose((data as any).createdAt);
  const finishedAt = tsToDateLoose((data as any).finishedAt);

  return {
    id,
    teamA: data.teamA ?? "-",
    teamB: data.teamB ?? "-",
    competition: data.competition ?? "-",
    round: data.round ?? "-",
    allowDraw: data.allowDraw ?? false,
    winner: ((data as any).winner as string | null) ?? null,

    deadline,
    createdAt,
    deadlineLabel: "",

    teamALogo: (data as any).teamALogo ?? (data as any).teamAUrl,
    teamBLogo: (data as any).teamBLogo ?? (data as any).teamBUrl,

    votesA: Number((data as any).votesA ?? 0),
    votesB: Number((data as any).votesB ?? 0),
    votesD: Number((data as any).votesD ?? 0),
    totalUsers: (data as any).totalUsers,

    matchNumber: (data as any).matchNumber,
    legType: (data as any).legType,
    askQualifier: Boolean((data as any).askQualifier ?? false),
    qualifier: ((data as any).qualifier as string | null) ?? null,

    goalsA: typeof (data as any).goalsA === "number" ? (data as any).goalsA : null,
    goalsB: typeof (data as any).goalsB === "number" ? (data as any).goalsB : null,

    finishedAt,
  };
}

function winnerVotes(m: MatchView) {
  const w = m.winner ? normalizeVote(m.winner, { teamA: m.teamA, teamB: m.teamB }) : null;
  if (w === "A") return Number(m.votesA ?? 0);
  if (w === "B") return Number(m.votesB ?? 0);
  if (w === "EMPATE") return Number(m.votesD ?? 0);
  return 0;
}


function participants(m: MatchView) {
  const t = Number(m.totalUsers ?? 0);
  if (t > 0) return t;
  const s = Number(m.votesA ?? 0) + Number(m.votesB ?? 0) + Number(m.votesD ?? 0);
  return Math.max(1, s);
}

// ✅ Replica o "RankingViewModel" do Android, mas retorna só o payload do usuário
export async function fetchUserProfilePayload(userId: string): Promise<UserProfilePayload> {
  const [usersSnap, guessesSnap, matchesSnap] = await Promise.all([
    getDocs(collection(db, "users")),
    getDocs(collection(db, "guesses")),
    getDocs(collection(db, "matches")),
  ]);

  // users base
  const usersData: Record<
    string,
    { createdAt: Date; name: string; username: string; photo: string; lastRank: number }
  > = {};

  usersSnap.docs.forEach((d) => {
    const data = d.data() as any;
    const createdAt = tsToDateLoose(data?.createdAt) ?? new Date(0);
    const name = (data?.name as string) || (data?.username as string) || "Sem Nome";
    const username = (data?.username as string) || "";
    const photo = (data?.photoBase64 as string) || "";
    const lastRank = Number(data?.lastRank ?? 0);

    usersData[d.id] = { createdAt, name, username, photo, lastRank };
  });

  // guesses index
  const guessByUserMatch: Record<string, any> = {};
  guessesSnap.docs.forEach((d) => {
    const g = d.data() as any;
    const uid = String(g?.userId || "");
    const mid = String(g?.matchId || "");
    if (!uid || !mid) return;
    guessByUserMatch[`${uid}__${mid}`] = g;
  });

  // matches
  const rawMatches = matchesSnap.docs
    .map((d) => mapMatchDocView(d.id, d.data() as MatchDoc))
    .filter((m) => !!m.deadline);

  const allMatches = sortMatchesGlobal(rawMatches as any) as (MatchView & { finishedAt: Date | null })[];

  // matchNumber estável se não existir
  const matchesWithNumber = allMatches.map((m, idx) => ({
    ...m,
    matchNumber: m.matchNumber ?? idx + 1,
  }));

  const finishedAsc = matchesWithNumber
    .filter((m) => !!m.winner)
    .sort((a, b) => (a.deadline as Date).getTime() - (b.deadline as Date).getTime());

  const finishedDesc = [...finishedAsc].reverse();

  // zebras (<=20%)
  const zebraMatchIds = new Set<string>();
  for (const m of finishedAsc) {
    const wv = winnerVotes(m);
    const pt = participants(m);
    if (wv > 0 && wv / pt <= 0.2) zebraMatchIds.add(m.id);
  }

  // pontos por mês (pra coroas)
  const now = new Date();
  const curMonth = now.getMonth();
  const curYear = now.getFullYear();
  const pointsByMonth: Record<number, Record<string, number>> = {};
  for (let i = 0; i < 12; i++) pointsByMonth[i] = {};

  type UserComputed = {
    userId: string;
    displayName: string;
    photoBase64?: string;
    points: number;
    medals: string[];        // tie-break / ranking
    activeMedals: string[];  // igual Android (com repetição)
    trophyRoom: MedalDetail[];
  };

  const allUsersComputed: UserComputed[] = [];

  // loop users (igual ranking, mas com trophyRoom)
  for (const [uid, u] of Object.entries(usersData)) {
    let points = 0;
    const medals: string[] = [];
    const trophyRoom: MedalDetail[] = [];
    const activeMedals: string[] = [];

    // pontos por jogo + extras (igual seu rankingApi atual)
    for (const match of finishedDesc) {
      const g = guessByUserMatch[`${uid}__${match.id}`];
      const teamSelected = g?.teamSelected ? String(g.teamSelected) : null;

      const dateObj = match.deadline ?? new Date(0);
      const mMonth = dateObj.getMonth();
      const mYear = dateObj.getFullYear();

      // principal
      if (teamSelected && match.winner && normalizeVote(teamSelected, match) === normalizeVote(match.winner, match)) {
        const isFinal = String(match.round || "").trim().toLowerCase() === "final";
        const pts = isFinal ? 6 : 3;
        points += pts;

        if (mYear === curYear) pointsByMonth[mMonth][uid] = (pointsByMonth[mMonth][uid] || 0) + pts;
      }

      // extras
      let extras = 0;
      const ga = typeof match.goalsA === "number" ? match.goalsA : null;
      const gb = typeof match.goalsB === "number" ? match.goalsB : null;

      if (ga != null && gb != null) {
        const overRes = ga + gb >= 3;
        const bttsRes = ga > 0 && gb > 0;

        const overPick = typeof g?.over25Pick === "boolean" ? g.over25Pick : null;
        const bttsPick = typeof g?.bttsPick === "boolean" ? g.bttsPick : null;

        if (overPick != null && overPick === overRes) extras++;
        if (bttsPick != null && bttsPick === bttsRes) extras++;
      }

      if (match.askQualifier) {
        const qRes = String(match.qualifier || "").trim();
        const qPick = String(g?.qualifierPick || "").trim();
        if (qRes && qPick && qRes === qPick) extras++;
      }

      if (extras > 0) {
        points += extras;
        if (mYear === curYear) pointsByMonth[mMonth][uid] = (pointsByMonth[mMonth][uid] || 0) + extras;
      }
    }

    // ---- TROPHY ROOM (igual Android: cronológico)
    let streak = 0;
    let veteranHits = 0;

    for (const m of finishedAsc) {
      // ✅ elegível (usuário existia antes do deadline)
      if (!m.deadline) continue;
      if (u.createdAt.getTime() >= (m.deadline as Date).getTime()) continue;

      const g = guessByUserMatch[`${uid}__${m.id}`];
      const pick = g?.teamSelected ? String(g.teamSelected) : null;
      const win = m.winner ? String(m.winner) : null;

      const isHit = !!pick && !!win && normalizeVote(pick, m) === normalizeVote(win, m);

      if (isHit) {
        veteranHits++;
        streak++;

        const ds = ddmmyy(m.deadline as Date);
        const ts = (m.deadline as Date).getTime();

        // 🔮 Final
        if (String(m.round || "").trim().toLowerCase() === "final") {
          trophyRoom.push({
            icon: "🔮",
            name: "MÃE DINAH",
            desc: `Cravou o campeão em ${m.teamA} x ${m.teamB}.`,
            date: ds,
            ts,
          });
          medals.push("🔮");
        }

        // 🦓 Zebra
        if (zebraMatchIds.has(m.id)) {
          trophyRoom.push({
            icon: "🦓",
            name: "CAÇADOR DE ZEBRAS",
            desc: `Acertou a zebra em ${m.teamA} x ${m.teamB}.`,
            date: ds,
            ts,
          });
          medals.push("🦓");
        }

        // streak
        if (streak === 3) {
          trophyRoom.push({ icon: "🔥", name: "ON FIRE", desc: "Palpitou 3 acertos seguidos.", date: ds, ts });
          medals.push("🔥");
        }
        if (streak === 5) {
          trophyRoom.push({ icon: "🎯", name: "MITO", desc: "Palpitou 5 acertos seguidos.", date: ds, ts });
          medals.push("🎯");
        }
        if (streak === 10) {
          trophyRoom.push({ icon: "👽", name: "ALIEN", desc: "Palpitou 10 acertos seguidos.", date: ds, ts });
          medals.push("👽");
        }

        // veterano (50,100,150...)
        if (veteranHits > 0 && veteranHits % 50 === 0) {
          const level = veteranHits / 50;
          trophyRoom.push({
            icon: "🎓",
            name: `VETERANO Nvl ${level}`,
            desc: `Conquistou ${veteranHits} acertos.`,
            date: ds,
            ts,
          });
          medals.push("🎓");
        }
      } else {
        streak = 0;
      }
    }

    // negativos (últimos 3)
    const last3 = finishedDesc.slice(0, 3);
    if (last3.length === 3) {
      let wrong = 0;
      let noVote = 0;

      for (const m of last3) {
        const g = guessByUserMatch[`${uid}__${m.id}`];
        if (!g) noVote++;
        else {
          const pick = g?.teamSelected ? String(g.teamSelected) : null;
          if (!pick || !m.winner || normalizeVote(pick, m) !== normalizeVote(String(m.winner), m)) wrong++;
        }
      }

      if (wrong === 3) {
        trophyRoom.push({
          icon: "🥬",
          name: "MÃO DE ALFACE",
          desc: "Status Atual: Errou 3 palpites seguidos.",
          date: "Atual",
          ts: Number.MAX_SAFE_INTEGER,
        });
        medals.push("🥬");
      }

      if (noVote === 3) {
        trophyRoom.push({
          icon: "👻",
          name: "FANTASMA",
          desc: "Status Atual: Esqueceu de votar em 3 seguidos.",
          date: "Atual",
          ts: Number.MAX_SAFE_INTEGER,
        });
        medals.push("👻");
      }
    }

    // título 2025 (igual Android)
    if (u.username.trim().toLowerCase() === "amauri") {
      trophyRoom.unshift({
        icon: "🏆",
        name: "TÍTULO DE 2025",
        desc: "Campeão Supremo de 2025.",
        date: "2025",
        ts: new Date("2025-12-31T23:59:59Z").getTime(),
      });
      medals.push("🏆");
    }

    // activeMedals = repete por ocorrência (igual Android)
    for (const t of trophyRoom) {
      if (["👽", "🎯", "🔥", "🦓", "🔮", "🎓", "🥬", "👻", "🏆", "👑", "⚓"].includes(t.icon)) {
        activeMedals.push(t.icon);
      }
    }

    allUsersComputed.push({
      userId: uid,
      displayName: u.name,
      photoBase64: u.photo,
      points,
      medals,
      activeMedals,
      trophyRoom,
    });
  }

  // coroas por mês (meses anteriores)
  for (let monthIdx = 0; monthIdx < curMonth; monthIdx++) {
    const monthScores = pointsByMonth[monthIdx];
    const values = Object.values(monthScores);
    const max = values.length ? Math.max(...values) : 0;
    if (max <= 0) continue;

    const leaders = Object.entries(monthScores).filter(([, v]) => v === max);
    if (leaders.length !== 1) continue;

    const winnerId = leaders[0][0];
    const row = allUsersComputed.find((r) => r.userId === winnerId);
    if (row) {
      row.activeMedals.push("👑");
      row.trophyRoom.unshift({
        icon: "👑",
        name: `REI DE ${MONTHS_PT[monthIdx]}`,
        desc: `Campeão isolado do mês (${max} pts).`,
        date: String(curYear),
        ts: new Date(`${curYear}-${String(monthIdx + 1).padStart(2, "0")}-01T00:00:00Z`).getTime(),
      });
    }
  }

  // ordenação final (igual seu rankingApi)
  const orderIcons = ["👽", "💎", "👑", "🎯", "🦓", "🔥", "🔮", "🎓"];

  allUsersComputed.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;

    for (const icon of orderIcons) {
      const d = countIcon(b.activeMedals, icon) - countIcon(a.activeMedals, icon);
      if (d !== 0) return d;
    }
    return a.userId.localeCompare(b.userId);
  });

  // Z-4 (âncora)
  if (allUsersComputed.length > 4) {
    for (let i = allUsersComputed.length - 4; i < allUsersComputed.length; i++) {
      const row = allUsersComputed[i];
      row.activeMedals.push("⚓");
      row.trophyRoom.push({
        icon: "⚓",
        name: "ZONA DE REBAIXAMENTO",
        desc: "Z-4",
        date: "Atual",
        ts: Number.MAX_SAFE_INTEGER,
      });
    }
  }

  const target = allUsersComputed.find((x) => x.userId === userId);

  // fallback se usuário não estiver na lista (não deve acontecer)
  if (!target) {
    const u = usersData[userId];
    return {
      userId,
      displayName: u?.name || "Usuário",
      photoBase64: u?.photo || "",
      activeMedals: [],
      trophyRoom: [],
    };
  }

  return {
    userId: target.userId,
    displayName: target.displayName,
    photoBase64: target.photoBase64,
    activeMedals: target.activeMedals,
    trophyRoom: target.trophyRoom.sort((a, b) => b.ts - a.ts),
  };
}
