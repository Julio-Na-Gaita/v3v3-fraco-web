import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type { MatchDoc } from "./contracts";

export function normTeamName(s: string) {
  return (s ?? "").trim().replace(/\s+/g, " ");
}
export function teamDocId(name: string) {
  return normTeamName(name).toLowerCase();
}

export async function touchAppState(reason: string = "admin_change") {
  const payload = {
    lastAdminChangeAt: serverTimestamp(),
    changeCounter: increment(1),
    lastReason: reason,
  };
  await setDoc(doc(db, "settings", "app_state"), payload, { merge: true });
}

// settings/competitions e settings/rounds (compatível com o formato do Android)
export async function fetchSettingsNames(docId: "competitions" | "rounds"): Promise<string[]> {
  const snap = await getDoc(doc(db, "settings", docId));
  if (!snap.exists()) return [];

  const data = snap.data() as any;

  // formato A: { items: ["A", "B"] }
  if (Array.isArray(data?.items) && typeof data.items?.[0] === "string") {
    return (data.items as string[]).filter(Boolean);
  }

  // formato B (Android): { items: [{name, active}, ...] }
  if (Array.isArray(data?.items) && typeof data.items?.[0] === "object") {
    return (data.items as any[])
      .filter((x) => x && (x.active !== false))
      .map((x) => String(x.name ?? "").trim())
      .filter(Boolean);
  }

  return [];
}

// catálogo simples de times (teams/{id}: {name, logo})
export async function fetchTeamsCatalog(max: number = 400): Promise<Array<{ name: string; logo: string }>> {
  const q = query(collection(db, "teams"), limit(max));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => d.data() as any)
    .map((x) => ({ name: String(x?.name ?? "").trim(), logo: String(x?.logo ?? "").trim() }))
    .filter((x) => x.name.length > 0);
}

export async function createMatch(payload: {
  teamA: string;
  teamB: string;
  teamAUrl?: string;
  teamBUrl?: string;
  competition: string;
  round: string;
  deadline: Date;
  allowDraw: boolean;
  legType?: MatchDoc["legType"];
  askQualifier: boolean;
}) {
  const docToSave: MatchDoc = {
    teamA: normTeamName(payload.teamA),
    teamB: normTeamName(payload.teamB),

    // Android usa teamAUrl/teamBUrl
    teamAUrl: (payload.teamAUrl ?? "").trim(),
    teamBUrl: (payload.teamBUrl ?? "").trim(),

    // Web também lê teamALogo/teamBLogo em alguns pontos
    teamALogo: (payload.teamAUrl ?? "").trim(),
    teamBLogo: (payload.teamBUrl ?? "").trim(),

    competition: (payload.competition ?? "").trim(),
    round: (payload.round ?? "").trim(),

    allowDraw: !!payload.allowDraw,

    // bônus
    legType: (payload.legType ?? "") as any,
    askQualifier: !!payload.askQualifier,
    qualifier: null,

    deadline: payload.deadline,
    winner: null,
    createdAt: serverTimestamp() as any,
  };

  const ref = await addDoc(collection(db, "matches"), docToSave);

  // salva memória de time (igual Android)
  if (docToSave.teamAUrl) {
    await setDoc(
      doc(db, "teams", teamDocId(docToSave.teamA || "")),
      { name: docToSave.teamA, logo: docToSave.teamAUrl },
      { merge: true }
    );
  }
  if (docToSave.teamBUrl) {
    await setDoc(
      doc(db, "teams", teamDocId(docToSave.teamB || "")),
      { name: docToSave.teamB, logo: docToSave.teamBUrl },
      { merge: true }
    );
  }

  await touchAppState("match_created");
  return ref.id;
}

export async function updateMatch(matchId: string, patch: Record<string, any>) {
  await updateDoc(doc(db, "matches", matchId), patch);
  await touchAppState("match_updated");
}