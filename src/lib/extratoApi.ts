import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  type Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { sortMatchesGlobal, type GuessDoc, type MatchDoc } from "./contracts";

function tsToDateLoose(ts: any): Date | null {
  try {
    return ts?.toDate ? (ts as Timestamp).toDate() : null;
  } catch {
    return null;
  }
}

function ddmm(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

type MatchViewLike = {
  id: string;
  teamA: string;
  teamB: string;
  competition: string;
  round: string;
  deadline: Date | null;
  winner: string | null;
  goalsA: number | null;
  goalsB: number | null;
  askQualifier?: boolean;
  qualifier?: string | null;
};

function mapMatch(id: string, data: MatchDoc): MatchViewLike {
  return {
    id,
    teamA: data.teamA ?? "-",
    teamB: data.teamB ?? "-",
    competition: data.competition ?? "-",
    round: data.round ?? "-",
    deadline: tsToDateLoose((data as any).deadline),
    winner: ((data as any).winner as string | null) ?? null,
    goalsA: typeof (data as any).goalsA === "number" ? (data as any).goalsA : null,
    goalsB: typeof (data as any).goalsB === "number" ? (data as any).goalsB : null,
    askQualifier: (data as any).askQualifier ?? false,
    qualifier: (data as any).qualifier ?? null,
  };
}

export type ExtratoCard = {
  key: string;
  dateStr: string;
  matchTitle: string;

  resultType: string;
  resultDetail: string;
  resultPts: number;

  extraDetail: string | null;
  extraPts: number;

  totalPts: number;

  isResultHit: boolean;
  isNoVote: boolean;

  streakMedalIcon: string | null;

  // (no Android isso guarda o detalhe inteiro; no Web vamos “quebrar” em chips na UI)
  extraHitDetails: string[];
};

export type ExtratoPayload = {
  uid: string;
  displayName: string;
  photoBase64?: string;

  cards: ExtratoCard[];

  summary: {
    resultPts: number;
    extraPts: number;
    totalPts: number;
  };

  // útil p/ debug (se quiser)
  rawHistory: string[];
};

function mergeExtratoHistoryForCards(history: string[]): ExtratoCard[] {
  const ptsRegex = /([+-]?\d+)/;

  type Tmp = {
    key: string;
    dateStr: string;
    matchTitle: string;

    resultType?: string;
    resultDetail?: string;
    resultPts: number;

    extraDetail?: string | null;
    extraPts: number;

    totalPts: number;
    extraHitDetails: string[];
  };

  // Map mantém ordem de inserção (igual linkedMap do Android)
  const map = new Map<string, Tmp>();

  for (const raw of history) {
    const parts = raw.split("|");
    if (parts.length < 5) continue;

    const type = parts[0].trim();
    const dateStr = parts[1].replace("DATA:", "").trim();
    const matchTitle = parts[2].trim();
    const detail = parts[3].trim();
    const pts = parseInt(ptsRegex.exec(parts[4])?.[1] ?? "0", 10) || 0;

    const key = `${dateStr}|${matchTitle}`;
    const tmp =
      map.get(key) ??
      ({
        key,
        dateStr,
        matchTitle,
        resultPts: 0,
        extraPts: 0,
        totalPts: 0,
        extraDetail: null,
        extraHitDetails: [],
      } as Tmp);

    tmp.totalPts += pts;

    const isVoteLine =
      detail.toLowerCase().startsWith("voto:") || type.includes("🚫");

    const isExtraLine =
      !detail.toLowerCase().startsWith("voto:") &&
      (type.toLowerCase().includes("extra") ||
        /over|ambas|marcam|classific|qualific/i.test(detail));

    if (isVoteLine) {
      tmp.resultType = type;
      tmp.resultDetail = detail;
      tmp.resultPts = pts;
    } else if (isExtraLine) {
      // concatena sem duplicar (igual Android)
      if (!tmp.extraDetail) tmp.extraDetail = detail;
      else if (!tmp.extraDetail.toLowerCase().includes(detail.toLowerCase())) {
        tmp.extraDetail = `${tmp.extraDetail} + ${detail}`;
      }

      tmp.extraPts += pts;
      if (pts > 0) tmp.extraHitDetails.push(detail);
    } else {
      // ✅ fallback premium (pra não “sumir” bônus tipo 💎 Bônus Oitavas)
      const label = `${type} — ${detail}`.trim();

      if (!tmp.extraDetail) tmp.extraDetail = label;
      else if (!tmp.extraDetail.toLowerCase().includes(label.toLowerCase())) {
        tmp.extraDetail = `${tmp.extraDetail} + ${label}`;
      }

      tmp.extraPts += pts;
      if (pts > 0) tmp.extraHitDetails.push(label);
    }

    map.set(key, tmp);
  }

  const base: ExtratoCard[] = Array.from(map.values()).map((t) => {
    const rType = t.resultType ?? "";
    const isNoVote =
      rType.includes("🚫") || (t.resultDetail ?? "").toLowerCase() === "não votou";
    const isResultHit = rType.includes("✅") || rType.includes("🏆");

    return {
      key: t.key,
      dateStr: t.dateStr,
      matchTitle: t.matchTitle,

      resultType: rType,
      resultDetail: t.resultDetail ?? "",
      resultPts: t.resultPts ?? 0,

      extraDetail: t.extraDetail ?? null,
      extraPts: t.extraPts ?? 0,

      totalPts: t.totalPts ?? 0,

      isResultHit,
      isNoVote,

      streakMedalIcon: null,
      extraHitDetails: t.extraHitDetails ?? [],
    };
  });

  // ✅ medalhas por sequência (🔥 3 / 🎯 5 / 👽 10) — igual Android
  const medalByKey = new Map<string, string>();
  let streak = 0;

  // history está em “mais recente -> mais antigo”
  // para sequência, precisamos “antigo -> recente”
  [...base].reverse().forEach((item) => {
    if (item.isResultHit) {
      streak++;
      if (streak === 3) medalByKey.set(item.key, "🔥");
      if (streak === 5) medalByKey.set(item.key, "🎯");
      if (streak === 10) medalByKey.set(item.key, "👽");
    } else {
      streak = 0;
    }
  });

  return base.map((it) => ({
    ...it,
    streakMedalIcon: medalByKey.get(it.key) ?? null,
  }));
}

export async function fetchUserExtrato(uid: string): Promise<ExtratoPayload> {
  const [userSnap, matchesSnap, guessesSnap] = await Promise.all([
    getDoc(doc(db, "users", uid)),
    getDocs(collection(db, "matches")),
    getDocs(query(collection(db, "guesses"), where("userId", "==", uid))),
  ]);

  const userData = userSnap.exists() ? (userSnap.data() as any) : {};
  const createdAt = tsToDateLoose(userData?.createdAt) ?? new Date(0);
  const displayName =
    (userData?.name as string) ||
    (userData?.username as string) ||
    "Sem Nome";
  const photoBase64 = (userData?.photoBase64 as string) || "";

  const guessesByMatch: Record<string, GuessDoc> = {};
  guessesSnap.docs.forEach((d) => {
    const g = d.data() as GuessDoc;
    if (g?.matchId) guessesByMatch[g.matchId] = g;
  });

  const rawMatches = matchesSnap.docs
    .map((d) => mapMatch(d.id, d.data() as MatchDoc))
    .filter((m) => !!m.deadline);

  const allMatches = (sortMatchesGlobal(rawMatches as any) as any[]) as MatchViewLike[];

  const nowMs = Date.now();
  const finishedMatches = allMatches.filter((m) => !!m.deadline && !!m.winner);
  const pastDeadlineMatches = allMatches.filter(
    (m) => !!m.deadline && m.deadline!.getTime() < nowMs
  );

  // ✅ historyEvents (mesmo padrão do Android)
  const historyEvents: Array<{ date: Date; line: string }> = [];

  // 1) Jogos finalizados: acerto/erro/final + extras
  for (const match of finishedMatches) {
    const g = guessesByMatch[match.id];
    const teamSelected = g?.teamSelected ? String(g.teamSelected) : null;

    const dateObj = match.deadline ?? new Date(0);
    const dateStr = ddmm(dateObj);
    const title = `${match.teamA} x ${match.teamB}`;

    if (teamSelected && match.winner && teamSelected === match.winner) {
      const isFinal = String(match.round || "").trim().toLowerCase() === "final";
      const pts = isFinal ? 6 : 3;

      if (isFinal) {
        historyEvents.push({
          date: dateObj,
          line: `🏆 FINAL|DATA:${dateStr}|${title}|Voto: ${teamSelected}|+${pts} pts`,
        });
      } else {
        historyEvents.push({
          date: dateObj,
          line: `✅ ACERTO|DATA:${dateStr}|${title}|Voto: ${teamSelected}|+${pts} pts`,
        });
      }
    } else if (teamSelected) {
      historyEvents.push({
        date: dateObj,
        line: `❌ ERROU|DATA:${dateStr}|${title}|Voto: ${teamSelected}|+0 pts`,
      });
    }

    // ✅ extras (+1 cada) — só se tiver placar/qualifier
    let extras = 0;
    const labels: string[] = [];

    const ga = match.goalsA;
    const gb = match.goalsB;

    if (ga != null && gb != null) {
      const overRes = ga + gb >= 3;
      const bttsRes = ga > 0 && gb > 0;

      const overPick =
        typeof (g as any)?.over25Pick === "boolean" ? (g as any).over25Pick : null;
      const bttsPick =
        typeof (g as any)?.bttsPick === "boolean" ? (g as any).bttsPick : null;

      if (overPick != null && overPick === overRes) {
        extras++;
        labels.push("Over 2.5");
      }
      if (bttsPick != null && bttsPick === bttsRes) {
        extras++;
        labels.push("Ambas Marcam");
      }
    }

    if (match.askQualifier) {
      const qRes = String(match.qualifier || "").trim();
      const qPick = String((g as any)?.qualifierPick || "").trim();
      if (qRes && qPick && qRes === qPick) {
        extras++;
        labels.push("Classificado");
      }
    }

    if (extras > 0) {
      const extrasTxt = labels.join(" + ");
      historyEvents.push({
        date: dateObj,
        line: `✅ EXTRA|DATA:${dateStr}|${title}|${extrasTxt}|+${extras} pts`,
      });
    }
  }

  // 2) Bônus Oitavas (8/8) — igual Android
  const oitavas = finishedMatches.filter(
    (m) => String(m.round || "").trim().toLowerCase() === "oitavas de final"
  );
  const byComp: Record<string, MatchViewLike[]> = {};
  for (const m of oitavas) (byComp[m.competition] ||= []).push(m);

  for (const [compName, matches] of Object.entries(byComp)) {
    if (matches.length !== 8) continue;

    let hits = 0;
    let lastDate = new Date(0);

    for (const m of matches) {
      if (m.deadline && m.deadline.getTime() > lastDate.getTime()) lastDate = m.deadline;

      const g = guessesByMatch[m.id];
      const teamSelected = g?.teamSelected ? String(g.teamSelected) : null;

      if (teamSelected && m.winner && teamSelected === m.winner) hits++;
    }

    if (hits === 8) {
      historyEvents.push({
        date: lastDate,
        line: `💎 Bônus Oitavas|DATA:Extra|${compName}|Gabaritou (8/8)|+3 pts`,
      });
    }
  }

  // 3) FANTASMA — deadline passou e não votou (e usuário já existia)
  for (const match of pastDeadlineMatches) {
    const d = match.deadline!;
    if (createdAt.getTime() >= d.getTime()) continue; // não existia na época
    const hasVote = !!guessesByMatch[match.id];
    if (hasVote) continue;

    const dateStr = ddmm(d);
    const title = `${match.teamA} x ${match.teamB}`;
    historyEvents.push({
      date: d,
      line: `🚫 FANTASMA|DATA:${dateStr}|${title}|Não votou|+0 pts`,
    });
  }

  // history final: mais recente -> mais antigo
  const rawHistory = historyEvents
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map((x) => x.line);

  const cards = mergeExtratoHistoryForCards(rawHistory);

  const summary = cards.reduce(
    (acc, it) => {
      acc.resultPts += it.resultPts || 0;
      acc.extraPts += it.extraPts || 0;
      acc.totalPts += it.totalPts || 0;
      return acc;
    },
    { resultPts: 0, extraPts: 0, totalPts: 0 }
  );

  return {
    uid,
    displayName,
    photoBase64: photoBase64 || undefined,
    cards,
    summary,
    rawHistory,
  };
}
