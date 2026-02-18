import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

export type CompareMatch = {
  id: string;
  teamA: string;
  teamB: string;
  teamAUrl?: string;
  teamBUrl?: string;
  competition?: string;
  round?: string;
  deadline: Date;
  winner?: string | null;
};

export type ComparisonItem = {
  match: CompareMatch;
  myVote: string;     // "-" quando não votou
  rivalVote: string;  // "-" quando não votou
  isExpired: boolean;
};

function tsToDateLoose(ts: any): Date | null {
  try {
    if (!ts) return null;
    if (ts?.toDate) return ts.toDate(); // Firestore Timestamp
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function pickFromGuessDoc(g: any): string | null {
  // Android usa teamSelected; aqui deixo fallback só por segurança
  const raw = g?.teamSelected ?? g?.guess ?? null;
  if (raw == null) return null;
  const s = String(raw).trim();
  return s ? s : null;
}

export async function fetchCompareItems(
  currentUserId: string,
  targetUserId: string
): Promise<ComparisonItem[]> {
  const [matchesSnap, mySnap, rivalSnap] = await Promise.all([
    getDocs(query(collection(db, "matches"), orderBy("deadline", "desc"))),
    getDocs(query(collection(db, "guesses"), where("userId", "==", currentUserId))),
    getDocs(query(collection(db, "guesses"), where("userId", "==", targetUserId))),
  ]);

  const matches: CompareMatch[] = matchesSnap.docs
    .map((d) => {
      const data = d.data() as any;
      const deadline = tsToDateLoose(data?.deadline);
      if (!deadline) return null;

      return {
        id: d.id,
        teamA: data?.teamA ?? "",
        teamB: data?.teamB ?? "",
        teamAUrl: data?.teamAUrl ?? "",
        teamBUrl: data?.teamBUrl ?? "",
        competition: data?.competition ?? "",
        round: data?.round ?? "",
        deadline,
        winner: data?.winner ?? null,
      } as CompareMatch;
    })
    .filter(Boolean) as CompareMatch[];

  const myByMatch: Record<string, string> = {};
  mySnap.docs.forEach((d) => {
    const g = d.data() as any;
    const mid = String(g?.matchId || "");
    const pick = pickFromGuessDoc(g);
    if (!mid || !pick) return;
    myByMatch[mid] = pick;
  });

  const rivalByMatch: Record<string, string> = {};
  rivalSnap.docs.forEach((d) => {
    const g = d.data() as any;
    const mid = String(g?.matchId || "");
    const pick = pickFromGuessDoc(g);
    if (!mid || !pick) return;
    rivalByMatch[mid] = pick;
  });

  const now = new Date();
  const out: ComparisonItem[] = [];

  for (const m of matches) {
    const isExpired = now > m.deadline;
    const myV = myByMatch[m.id];
    const rivalV = rivalByMatch[m.id];

    // igual Android: entra se alguém votou OU já expirou
    if (myV || rivalV || isExpired) {
      out.push({
        match: m,
        myVote: myV ?? "-",
        rivalVote: rivalV ?? "-",
        isExpired,
      });
    }
  }

  return out;
}
