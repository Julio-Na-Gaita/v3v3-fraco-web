import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { sortMatchesGlobal, type MatchDoc, type MatchView } from "./contracts";

type GuessTriple = { matchId: string; userId: string; vote: string };

export type CompRow = {
  name: string;
  voted: number;
  hits: number;
  accuracy: number; // inteiro truncado
};

export type ScoutPayload = {
  consistencyText: string; // "Alta" | "Média" | "Baixa" | "-"
  riskText: string;        // "Baixo" | "Médio" | "Alto" | "-"
  stats: {
    confrontos: string; // "38/38"
    acertos: string;    // "23"
    precisao: string;   // "60,5%"
  };
  currentStreak: number;  // ex: -1, +3
  lastFive: string[];     // ["✅","❌","✅","🚫","✅"]
  rankHistory: number[];  // posições ao longo do tempo
  totalParticipants: number;

  compTable: CompRow[];
  bestComp: string;  // "FA Cup (100%)" ou "-"
  worstComp: string; // "Serie A (40%)" ou "-"

  maxWinStreak: number;
  maxLoseStreak: number;
  maxWinStreakCount: number;
  maxLoseStreakCount: number;

  bestRank: number;
  worstRank: number;
  bestRankCount: number;
  worstRankCount: number;
};

// ---------- helpers (iguais ao Android)

function tsToDateLoose(ts: any): Date | null {
  try {
    return ts?.toDate ? ts.toDate() : null;
  } catch {
    return null;
  }
}

function computeConsistencyLabel(rankHistoryAsc: number[]): string {
  if (rankHistoryAsc.length < 3) return "-";
  const deltas: number[] = [];
  for (let i = 0; i < rankHistoryAsc.length - 1; i++) {
    deltas.push(Math.abs(rankHistoryAsc[i + 1] - rankHistoryAsc[i]));
  }
  const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;

  if (avgDelta <= 2.2) return "Alta";
  if (avgDelta <= 2.5) return "Média";
  return "Baixa";
}

function computeRiskLabel(
  finishedMatchesAsc: MatchView[],
  guessesByMatchId: Record<string, GuessTriple[]>,
  userId: string
): string {
  let considered = 0;
  let sumShare = 0;

  for (const m of finishedMatchesAsc) {
    const matchGuesses = guessesByMatchId[m.id] || [];
    const myVote = matchGuesses.find((g) => g.userId === userId)?.vote;
    if (!myVote) continue;

    const validVotes = matchGuesses.map((g) => g.vote).filter(Boolean);
    if (!validVotes.length) continue;

    const sameCount = validVotes.filter((v) => v === myVote).length;
    const share = sameCount / validVotes.length;

    sumShare += share;
    considered++;
  }

  if (considered < 5) return "-";

  const avgShare = sumShare / considered;
  const risk = 1 - avgShare;

  if (risk >= 0.5) return "Alto";
  if (risk >= 0.25) return "Médio";
  return "Baixo";
}

function filterHistoryOnlyMatches(history: string[]): string[] {
  return history.filter((raw) => {
    const parts = raw.split("|");
    const type = parts[0] || "";
    const detail = (parts[3] || "").trim();

    const isNoVote = type.includes("🚫");
    const isMatchVote = detail.toLowerCase().startsWith("voto:") || detail.toLowerCase().includes("voto:");
    return isNoVote || isMatchVote;
  });
}

function computeStreakFromHistory(history: string[]): number {
  let streak = 0;
  let streakType: number | null = null; // 1 win, -1 lose

  for (const raw of history) {
    const type = (raw.split("|")[0] || "").trim();

    const resultType =
      type.includes("✅") || type.includes("🏆") ? 1 :
      type.includes("❌") || type.includes("🔻") ? -1 :
      null;

    if (streakType == null) {
      if (resultType == null) continue;
      streakType = resultType;
      streak = resultType;
      continue;
    }

    if (resultType == null || resultType !== streakType) break;
    streak += resultType;
  }

  return streak;
}

function computeLastFive(history: string[]): string[] {
  return history.slice(0, 5).map((raw) => {
    const type = raw.split("|")[0] || "";
    if (type.includes("✅") || type.includes("🏆")) return "✅";
    if (type.includes("❌") || type.includes("🔻")) return "❌";
    if (type.includes("🚫")) return "🚫";
    return "•";
  });
}

function computeMaxStreaks(history: string[]): { maxWin: number; maxLose: number } {
  let currentType: number | null = null;
  let currentCount = 0;
  let maxWin = 0;
  let maxLose = 0;

  for (const raw of history) {
    const type = raw.split("|")[0] || "";
    const resultType =
      type.includes("✅") || type.includes("🏆") ? 1 :
      type.includes("❌") || type.includes("🔻") ? -1 :
      null;

    if (resultType == null) {
      currentType = null;
      currentCount = 0;
      continue;
    }

    if (currentType == null || currentType !== resultType) {
      currentType = resultType;
      currentCount = 1;
    } else {
      currentCount++;
    }

    if (resultType === 1) maxWin = Math.max(maxWin, currentCount);
    if (resultType === -1) maxLose = Math.max(maxLose, currentCount);
  }

  return { maxWin, maxLose };
}

function countMaxStreakOccurrences(history: string[], targetType: number, targetLen: number): number {
  if (targetLen <= 0) return 0;

  let currentType: number | null = null;
  let currentCount = 0;
  let occurrences = 0;

  for (const raw of history) {
    const type = raw.split("|")[0] || "";
    const resultType =
      type.includes("✅") || type.includes("🏆") ? 1 :
      type.includes("❌") || type.includes("🔻") ? -1 :
      null;

    if (resultType == null) {
      currentType = null;
      currentCount = 0;
      continue;
    }

    if (currentType == null || currentType !== resultType) {
      currentType = resultType;
      currentCount = 1;
    } else {
      currentCount++;
    }

    if (currentType === targetType && currentCount === targetLen) occurrences++;
  }

  return occurrences;
}

function truncPct(hits: number, voted: number) {
  if (voted <= 0) return 0;
  return Math.floor((hits * 100) / voted); // Kotlin int division
}

function fmtPct1(value: number) {
  // 60,5% (pt-BR)
  return `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)}%`;
}

// ---------- API principal (replica Android)

export async function fetchScoutPayload(userId: string): Promise<ScoutPayload> {
  const [usersSnap, guessesSnap, matchesSnap] = await Promise.all([
    getDocs(collection(db, "users")),
    getDocs(collection(db, "guesses")),
    getDocs(collection(db, "matches")),
  ]);

  // users base: debts + createdAt
  const userDebts: Record<string, number> = {};
  const userCreatedAt: Record<string, Date> = {};

  usersSnap.docs.forEach((d) => {
    const data = d.data() as any;
    userDebts[d.id] = Number(data?.debts ?? 0);
    userCreatedAt[d.id] = tsToDateLoose(data?.createdAt) ?? new Date(0);
  });

  const allUsersIds = Object.keys(userDebts);
  const totalParticipants = allUsersIds.length || 1;
  const targetCreatedAt = userCreatedAt[userId] ?? new Date(0);

  // matches (ordem Android)
  const rawMatches: MatchView[] = matchesSnap.docs
    .map((d) => {
      const data = d.data() as MatchDoc;
      const deadline = tsToDateLoose((data as any).deadline);
      const createdAt = tsToDateLoose((data as any).createdAt);

      return {
        id: d.id,
        teamA: data.teamA ?? "-",
        teamB: data.teamB ?? "-",
        competition: data.competition ?? "-",
        round: data.round ?? "-",
        allowDraw: data.allowDraw ?? false,
        winner: (data.winner as string | null) ?? null,
        deadline,
        createdAt,
        deadlineLabel: "",
      } as MatchView;
    })
    .filter((m) => !!m.deadline);

  const allMatches = sortMatchesGlobal(rawMatches);
  const finishedMatchesAsc = allMatches.filter((m) => !!m.winner && !!m.deadline);
  const finishedMatchesDesc = [...finishedMatchesAsc].reverse();

  // guesses index
  const guessesByMatchId: Record<string, GuessTriple[]> = {};
  const guessByUserMatch: Record<string, string> = {};

  guessesSnap.docs.forEach((d) => {
    const g = d.data() as any;
    const uid = String(g?.userId || "");
    const mid = String(g?.matchId || "");
    if (!uid || !mid) return;

    const raw = g?.guess ?? g?.teamSelected;
    if (!raw) return;

    const vote = String(raw);
    (guessesByMatchId[mid] ||= []).push({ matchId: mid, userId: uid, vote });
    guessByUserMatch[`${uid}__${mid}`] = vote;
  });

  // ---- A) rankHistory (simulação Android)
  const simPoints: Record<string, number> = {};
  allUsersIds.forEach((u) => (simPoints[u] = 0));

  const rankHistory: number[] = [];

  for (const m of finishedMatchesAsc) {
    const matchGuesses = guessesByMatchId[m.id] || [];
    const pts = String(m.round || "").toLowerCase() === "final" ? 6 : 3;

    // dá pontos para quem acertou
    for (const g of matchGuesses) {
      if (g.vote === m.winner) simPoints[g.userId] = (simPoints[g.userId] || 0) + pts;
    }

    const currentRankList = [...allUsersIds].sort((a, b) => {
      const netA = (simPoints[a] || 0) - (userDebts[a] || 0) * 3;
      const netB = (simPoints[b] || 0) - (userDebts[b] || 0) * 3;
      if (netA !== netB) return netB - netA; // desc
      const dA = userDebts[a] || 0;
      const dB = userDebts[b] || 0;
      if (dA !== dB) return dA - dB; // asc
      return String(a).localeCompare(String(b));
    });

    rankHistory.push(currentRankList.indexOf(userId) + 1);
  }

  const bestRank = rankHistory.length ? Math.min(...rankHistory) : 0;
  const worstRank = rankHistory.length ? Math.max(...rankHistory) : 0;
  const bestRankCount = bestRank ? rankHistory.filter((x) => x === bestRank).length : 0;
  const worstRankCount = worstRank ? rankHistory.filter((x) => x === worstRank).length : 0;

  const consistencyText = computeConsistencyLabel(rankHistory);
  const riskText = computeRiskLabel(finishedMatchesAsc, guessesByMatchId, userId);

  // ---- B) histórico (para streak e lastFive) — baseado nos jogos disponíveis para o usuário
  const history: string[] = [];

  for (const m of finishedMatchesDesc) {
    const matchDate = m.deadline || new Date();
    if (!(targetCreatedAt < matchDate)) continue;

    const myVote = guessByUserMatch[`${userId}__${m.id}`];
    if (!myVote) {
      history.push(`🚫|${m.id}|${m.competition}|NÃO VOTOU|`);
      continue;
    }

    const type = myVote === m.winner ? "✅" : "❌";
    history.push(`${type}|${m.id}|${m.competition}|Voto: ${myVote}|`);
  }

  const historyOnlyMatches = filterHistoryOnlyMatches(history);

  const currentStreak = computeStreakFromHistory(historyOnlyMatches);
  const lastFive = computeLastFive(historyOnlyMatches);

  const { maxWin, maxLose } = computeMaxStreaks(historyOnlyMatches);
  const maxWinStreakCount = countMaxStreakOccurrences(historyOnlyMatches, 1, maxWin);
  const maxLoseStreakCount = countMaxStreakOccurrences(historyOnlyMatches, -1, maxLose);

  // ---- C) estatísticas gerais (KPIs + compTable)
  let totalAvailable = 0;
  let totalVoted = 0;
  let totalHits = 0;

  const compStats: Record<string, { voted: number; hits: number }> = {};

  for (const m of finishedMatchesAsc) {
    const matchDate = m.deadline || new Date();
    if (!(targetCreatedAt < matchDate)) continue;

    totalAvailable++;

    const myVote = guessByUserMatch[`${userId}__${m.id}`];
    if (!myVote) continue;

    totalVoted++;
    const hit = myVote === m.winner;
    if (hit) totalHits++;

    const key = m.competition || "-";
    compStats[key] ||= { voted: 0, hits: 0 };
    compStats[key].voted += 1;
    compStats[key].hits += hit ? 1 : 0;
  }

  const accuracy = totalVoted > 0 ? (totalHits / totalVoted) * 100 : 0;

  const compTable: CompRow[] = Object.entries(compStats)
    .map(([name, v]) => ({
      name,
      voted: v.voted,
      hits: v.hits,
      accuracy: truncPct(v.hits, v.voted),
    }))
    .sort((a, b) => {
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      if (b.voted !== a.voted) return b.voted - a.voted;
      return a.name.localeCompare(b.name);
    });

  // destaques (somente >= 3 jogos)
  const valid = Object.entries(compStats).filter(([, v]) => v.voted >= 3);

  let bestComp = "-";
  let worstComp = "-";

  if (valid.length) {
    valid.sort((a, b) => (b[1].hits / b[1].voted) - (a[1].hits / a[1].voted));
    const best = valid[0];
    const worst = valid[valid.length - 1];

    bestComp = `${best[0]} (${truncPct(best[1].hits, best[1].voted)}%)`;
    worstComp = `${worst[0]} (${truncPct(worst[1].hits, worst[1].voted)}%)`;
  }

  return {
    consistencyText,
    riskText,
    stats: {
      confrontos: `${totalVoted}/${finishedMatchesAsc.length}`,
      acertos: String(totalHits),
      precisao: fmtPct1(accuracy),
    },
    currentStreak,
    lastFive,
    rankHistory,
    totalParticipants,

    compTable,
    bestComp,
    worstComp,

    maxWinStreak: maxWin,
    maxLoseStreak: maxLose,
    maxWinStreakCount,
    maxLoseStreakCount,

    bestRank,
    worstRank,
    bestRankCount,
    worstRankCount,
  };
}
