import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { sortMatchesGlobal, type MatchDoc, type MatchView } from "./contracts";

type RankMatch = MatchView & {
  finishedAt: Date | null;
};

function tsToDateLoose(ts: any): Date | null {
  try {
    return ts?.toDate ? ts.toDate() : null;
  } catch {
    return null;
  }
}

function mapMatchDocRank(id: string, data: MatchDoc): RankMatch {
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
    winner: (data.winner as string | null) ?? null,

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
    askQualifier: (data as any).askQualifier,
    qualifier: (data as any).qualifier,
    goalsA: (data as any).goalsA ?? null,
    goalsB: (data as any).goalsB ?? null,

    finishedAt,
  };
}

export type RankingUserRow = {
  userId: string;
  displayName: string;
  photoBase64?: string;
  points: number;
  lastRank: number;
  medals: string[]; // usado pra tie-break (👽 💎 👑 🎯 🦓 🔥 🔮 🎓) e pra exibir na UI
};

export type MonthlyRankingRow = {
  userId: string;
  displayName: string;
  photoBase64?: string;
  points: number;
};

export type RankingPayload = {
  rankingList: RankingUserRow[];
  monthlyRankingList: MonthlyRankingRow[];
  lastUpdateInfo: string;
};

function countIcon(list: string[], icon: string) {
  let n = 0;
  for (const x of list) if (x === icon) n++;
  return n;
}

export async function fetchRankingPayload(): Promise<RankingPayload> {
  const [usersSnap, guessesSnap, matchesSnap] = await Promise.all([
    getDocs(collection(db, "users")),
    getDocs(collection(db, "guesses")),
    getDocs(collection(db, "matches")),
  ]);

  // --- Matches (ordem igual Android) ---
  const rawMatches = matchesSnap.docs
    .map((d) => mapMatchDocRank(d.id, d.data() as MatchDoc))
    .filter((m) => !!m.deadline);

  // ✅ sortMatchesGlobal retorna MatchView[], então “recuperamos” o tipo RankMatch
const allMatches = sortMatchesGlobal(rawMatches as any) as RankMatch[];

  const finishedAsc = allMatches.filter((m) => !!m.winner); // cronológico (antigo -> novo)
  const finishedDesc = [...finishedAsc].reverse(); // exibição / últimos jogos

  // matchNumber estável (se não existir no Firestore)
  const matchesWithNumber: RankMatch[] = allMatches.map((m, idx) => ({
  ...m,
  matchNumber: m.matchNumber ?? idx + 1,
}));


  const finishedAscNum = matchesWithNumber.filter((m) => !!m.winner);
  const finishedDescNum = [...finishedAscNum].reverse();

  // --- Users base (criadoEm + lastRank) ---
  const usersData: Record<string, { createdAt: Date; name: string; photo: string; lastRank: number }> =
    {};

  usersSnap.docs.forEach((d) => {
    const data = d.data() as any;
    const createdAt = tsToDateLoose(data?.createdAt) ?? new Date(0);
    const name = (data?.name as string) || (data?.username as string) || "Sem Nome";
    const photo = (data?.photoBase64 as string) || "";
    const lastRank = Number(data?.lastRank ?? 0);

    usersData[d.id] = { createdAt, name, photo, lastRank };
  });

  // --- Guesses index (rápido) ---
  const guessByUserMatch: Record<string, any> = {};
  const guessesByMatch: Record<string, any[]> = {};

  guessesSnap.docs.forEach((d) => {
    const g = d.data() as any;
    const uid = String(g?.userId || "");
    const mid = String(g?.matchId || "");
    if (!uid || !mid) return;

    guessByUserMatch[`${uid}__${mid}`] = g;
    (guessesByMatch[mid] ||= []).push(g);
  });

  // --- lastUpdateInfo (igual Android: data/hora + jogo) ---
  let lastUpdateInfo = "Sem jogos finalizados";
  const lastMatch = finishedDesc.find((m) => m.deadline);
  if (lastMatch?.deadline) {
    // pega o mais “recente” por finishedAt ou deadline
    let best = lastMatch;
    for (const m of finishedDesc) {
      const t = (m.finishedAt?.getTime() ?? 0) || (m.deadline?.getTime() ?? 0);
      const tb = (best.finishedAt?.getTime() ?? 0) || (best.deadline?.getTime() ?? 0);
      if (t > tb) best = m;
    }

    const dt = best.finishedAt ?? best.deadline!;
    const fmt = new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(dt);

    lastUpdateInfo = `${fmt}\n${best.teamA} x ${best.teamB}`;
  }

  // --- Zebras (<= 20% acertaram) ---
  const zebraMatchIds = new Set<string>();
  for (const m of finishedAscNum) {
    const list = guessesByMatch[m.id] || [];
    const winnerVotes = list.filter((x) => String(x?.teamSelected || "") === String(m.winner || "")).length;

    const matchDate = m.deadline ?? new Date(0);
    const validParticipants = Object.values(usersData).filter((u) => u.createdAt.getTime() < matchDate.getTime()).length;

    const safeTotal = validParticipants > 0 ? validParticipants : Math.max(1, list.length);
    if (winnerVotes / safeTotal <= 0.2) zebraMatchIds.add(m.id);
  }

  // --- Ranking mensal (por mês do ano atual) ---
  const now = new Date();
  const curMonth = now.getMonth();
  const curYear = now.getFullYear();
  const pointsByMonth: Record<number, Record<string, number>> = {};
  for (let i = 0; i < 12; i++) pointsByMonth[i] = {};

  const rankingRows: RankingUserRow[] = [];
  const monthlyRows: MonthlyRankingRow[] = [];

  // --- Loop users (igual Android) ---
  for (const [uid, u] of Object.entries(usersData)) {
    let points = 0;
    let monthlyPoints = 0;
    const medals: string[] = [];

    // pontos por jogo + extras
    for (const match of finishedDescNum) {
      const g = guessByUserMatch[`${uid}__${match.id}`];
      const teamSelected = g?.teamSelected ? String(g.teamSelected) : null;

      const dateObj = match.deadline ?? new Date(0);
      const mMonth = dateObj.getMonth();
      const mYear = dateObj.getFullYear();
      const isThisMonth = mMonth === curMonth && mYear === curYear;

      // principal
      if (teamSelected && match.winner && teamSelected === match.winner) {
        const isFinal = String(match.round || "").trim().toLowerCase() === "final";
        const pts = isFinal ? 6 : 3;
        points += pts;

        if (isThisMonth) monthlyPoints += pts;
        if (mYear === curYear) pointsByMonth[mMonth][uid] = (pointsByMonth[mMonth][uid] || 0) + pts;
      }

      // extras (+1 cada) — só pontua se existir placar/qualifier
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
        if (isThisMonth) monthlyPoints += extras;
        if (mYear === curYear) pointsByMonth[mMonth][uid] = (pointsByMonth[mMonth][uid] || 0) + extras;
      }
    }

    // bônus oitavas (8/8) => +3 e medalha 💎 (pra tie-break igual Android)
    const oitavas = finishedDescNum.filter((m) => String(m.round || "").trim().toLowerCase() === "oitavas de final");
    const byComp: Record<string, RankMatch[]> = {};
    for (const m of oitavas) (byComp[m.competition] ||= []).push(m);

for (const [, list] of Object.entries(byComp)) {
  if (list.length !== 8) continue;

      let hits = 0;
      for (const m of list) {
        const g = guessByUserMatch[`${uid}__${m.id}`];
        const teamSelected = g?.teamSelected ? String(g.teamSelected) : null;
        if (teamSelected && m.winner && teamSelected === m.winner) hits++;
      }

      if (hits === 8) {
        points += 3;
        medals.push("💎");

        const lastDate = list.map((x) => x.deadline ?? new Date(0)).reduce((a, b) => (a > b ? a : b), new Date(0));
        const lm = lastDate.getMonth();
        const ly = lastDate.getFullYear();

        if (lm === curMonth && ly === curYear) monthlyPoints += 3;
        if (ly === curYear) pointsByMonth[lm][uid] = (pointsByMonth[lm][uid] || 0) + 3;
      }
    }

    // medals de streak / zebra / mãe dinah / veterano (igual lógica do Android)
    let streak = 0;
    let veteranHits = 0;

    for (const m of finishedAscNum) {
      const g = guessByUserMatch[`${uid}__${m.id}`];
      const teamSelected = g?.teamSelected ? String(g.teamSelected) : null;
      const isHit = !!teamSelected && !!m.winner && teamSelected === m.winner;

      if (isHit) {
        veteranHits++;
        streak++;

        // mãe dinah (final acertada)
        if (String(m.round || "").trim().toLowerCase() === "final") medals.push("🔮");

        // zebra
        if (zebraMatchIds.has(m.id)) medals.push("🦓");

        // streak medals
        if (streak === 3) medals.push("🔥");
        if (streak === 5) medals.push("🎯");
        if (streak === 10) medals.push("👽");

        // veterano a cada 50 acertos
        if (veteranHits > 0 && veteranHits % 50 === 0) medals.push("🎓");
      } else {
        streak = 0;
      }
    }

    // negativos (últimos 3)
    const last3 = finishedDescNum.slice(0, 3);
    if (last3.length === 3) {
      let wrong = 0;
      let noVote = 0;

      for (const m of last3) {
        const g = guessByUserMatch[`${uid}__${m.id}`];
        if (!g) noVote++;
        else {
          const teamSelected = g?.teamSelected ? String(g.teamSelected) : null;
          if (!teamSelected || teamSelected !== m.winner) wrong++;
        }
      }

      if (wrong === 3) medals.push("🥬");
      if (noVote === 3) medals.push("👻");
    }

    rankingRows.push({
      userId: uid,
      displayName: u.name,
      photoBase64: u.photo,
      points,
      lastRank: u.lastRank,
      medals,
    });

    monthlyRows.push({
      userId: uid,
      displayName: u.name,
      photoBase64: u.photo,
      points: monthlyPoints,
    });
  }

  // coroas (rei do mês) — meses anteriores do ano atual
  for (let monthIdx = 0; monthIdx < curMonth; monthIdx++) {
    const monthScores = pointsByMonth[monthIdx];
    const values = Object.values(monthScores);
    const max = values.length ? Math.max(...values) : 0;
    if (max <= 0) continue;

    const leaders = Object.entries(monthScores).filter(([, v]) => v === max);
    if (leaders.length !== 1) continue;

    const winnerId = leaders[0][0];
    const row = rankingRows.find((r) => r.userId === winnerId);
    if (row) row.medals.push("👑");
  }

  // ordenação final (igual Android)
  const orderIcons = ["👽", "💎", "👑", "🎯", "🦓", "🔥", "🔮", "🎓"];

  rankingRows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;

    for (const icon of orderIcons) {
      const d = countIcon(b.medals, icon) - countIcon(a.medals, icon);
      if (d !== 0) return d;
    }

    return a.userId.localeCompare(b.userId);
  });

  monthlyRows.sort((a, b) => b.points - a.points || a.displayName.localeCompare(b.displayName));

  // Z-4 (âncora ⚓ nos últimos 4)
  if (rankingRows.length > 4) {
    for (let i = rankingRows.length - 4; i < rankingRows.length; i++) {
      if (!rankingRows[i].medals.includes("⚓")) rankingRows[i].medals.push("⚓");
    }
  }

  return {
    rankingList: rankingRows,
    monthlyRankingList: monthlyRows,
    lastUpdateInfo,
  };
}
