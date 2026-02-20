import type { Timestamp } from "firebase/firestore";

/**
 * ✅ CONTRATO (Android ↔ Web)
 *
 * Objetivo: manter os mesmos nomes/formatos de campos que o Android usa no Firestore,
 * e concentrar aqui todas as conversões/normalizações.
 */

// --- Constantes ---
export const DRAW_VOTE = "EMPATE" as const;

// --- Tipos (Web) ---
export type Vote = "A" | "B" | typeof DRAW_VOTE;

export type LegType = "" | "IDA" | "VOLTA" | "UNICO";

// --- Firestore: /matches (espelha o Android) ---
export type MatchDoc = {
  id?: string; // raramente existe dentro do doc; o ID real vem do doc.id
  teamA?: string;
  teamB?: string;
  teamAUrl?: string;
  teamBUrl?: string;
  round?: string;
  competition?: string;
  deadline: Timestamp | Date;
  winner?: string | null;
  finishedAt?: Timestamp | null;
  allowDraw?: boolean;
  goalsA?: number | null;
  goalsB?: number | null;

  // ✅ BÔNUS (mata-mata)
  legType?: LegType;
  askQualifier?: boolean;
  qualifier?: string | null;

  createdAt?: Timestamp | null;

  // opcionais (no Web você já usa)
  teamALogo?: string;
  teamBLogo?: string;
  votesA?: number;
  votesB?: number;
  votesD?: number;
  totalUsers?: number;
  matchNumber?: number;
};

// --- Firestore: /guesses (espelha o Android) ---
export type GuessDoc = {
  matchId: string;
  userId: string;
  teamSelected?: string; // Android grava nome do time (ou "EMPATE")

  // ✅ extras
  over25Pick?: boolean | null;
  bttsPick?: boolean | null;
  qualifierPick?: string | null;

  timestamp?: Timestamp;

  // ✅ campo extra do Web (não quebra Android)
  guess?: Vote;
};

// --- Tipos já “convertidos” para UI ---
export type MatchView = {
  id: string;
  teamA: string;
  teamB: string;
  competition: string;
  round: string;
  allowDraw: boolean;
  winner: string | null;

  deadline: Date | null;
  createdAt: Date | null;
  deadlineLabel: string;

  // imagens
  teamALogo?: string;
  teamBLogo?: string;

  // contadores
  votesA?: number;
  votesB?: number;
  votesD?: number;
  totalUsers?: number;
  matchNumber?: number;

  // bônus
  legType?: LegType;
  askQualifier?: boolean;
  qualifier?: string | null;
  goalsA?: number | null;
  goalsB?: number | null;
};

// --- Helpers ---
export function tsToDate(ts?: Timestamp | null): Date | null {
  return ts ? ts.toDate() : null;
}

/**
 * Mesma normalização que já estava no Matches.tsx:
 * - aceita "A"/"B"/"EMPATE"
 * - aceita nomes dos times (Android)
 */
export function normalizeVote(
  raw: string | undefined,
  m: Pick<MatchView, "teamA" | "teamB">
): Vote | null {
  if (!raw) return null;

  const v = String(raw).trim();
  const upper = v.toUpperCase();

  if (v === "A" || v === "B" || upper === DRAW_VOTE)
    return upper === DRAW_VOTE ? DRAW_VOTE : (v as Vote);

  const norm = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const nv = norm(v);
  if (nv && nv === norm(m.teamA)) return "A";
  if (nv && nv === norm(m.teamB)) return "B";

  return null;
}

export function voteToTeamSelected(vote: Vote, m: Pick<MatchView, "teamA" | "teamB">) {
  return vote === "A" ? m.teamA : vote === "B" ? m.teamB : DRAW_VOTE;
}

/**
 * ✅ Ordenação oficial (igual Android: deadline → createdAt → id)
 * Isso garante que o #ID “bata” mesmo quando dois jogos têm o mesmo prazo.
 */
export function sortMatchesGlobal(list: MatchView[]) {
  return [...list].sort((a, b) => {
    const ad = a.deadline?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bd = b.deadline?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (ad !== bd) return ad - bd;

    const ac = a.createdAt?.getTime() ?? 0;
    const bc = b.createdAt?.getTime() ?? 0;
    if (ac !== bc) return ac - bc;

    return String(a.id).localeCompare(String(b.id));
  });
}
export type MatchStatus = "OPEN" | "WAITING" | "FINISHED";

export function getMatchStatus(m: Pick<MatchView, "winner" | "deadline">): MatchStatus {
  if (m.winner) return "FINISHED";
  const d = m.deadline?.getTime();
  if (d && Date.now() > d) return "WAITING";
  return "OPEN";
}

export function statusLabelPt(status: MatchStatus) {
  if (status === "OPEN") return "ABERTOS";
  if (status === "WAITING") return "AGUARDANDO RESULTADO";
  return "FINALIZADOS";
}
