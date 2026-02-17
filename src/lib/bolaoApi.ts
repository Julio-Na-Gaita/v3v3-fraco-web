import {
  collection,
  doc,
  getCountFromServer,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";



import { db } from "./firebase";
import {
  type MatchDoc,
  type MatchView,
  type Vote,
  normalizeVote,
  sortMatchesGlobal,
  tsToDate,
  voteToTeamSelected,
} from "./contracts";

function formatDeadline(dt: Date | null) {
  if (!dt) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dt);
}

export function mapMatchDoc(id: string, data: MatchDoc): MatchView {
  const deadline = tsToDate(data.deadline);
  const createdAt = tsToDate(data.createdAt);

  const endedByTime = deadline ? Date.now() > deadline.getTime() : false;

const label = endedByTime
  ? `Encerrado: ${formatDeadline(deadline)}`
  : `Prazo: ${formatDeadline(deadline)}`;


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
    deadlineLabel: label,

    teamALogo: data.teamALogo ?? data.teamAUrl,
    teamBLogo: data.teamBLogo ?? data.teamBUrl,

    votesA: Number(data.votesA ?? 0),
    votesB: Number(data.votesB ?? 0),
    votesD: Number(data.votesD ?? 0),
    totalUsers: data.totalUsers,
    matchNumber: data.matchNumber,

    // bônus
    legType: data.legType,
    askQualifier: data.askQualifier,
    qualifier: data.qualifier,
    goalsA: data.goalsA,
    goalsB: data.goalsB,
  };
}

/**
 * 🔥 Matches (confrontos)
 */
export function subscribeMatches(
  onMatches: (list: MatchView[]) => void,
  onError?: (err: unknown) => void
) {
  const q = query(collection(db, "matches"), orderBy("deadline", "asc"), limit(50));

  return onSnapshot(
    q,
    (snap) => {
      const raw = snap.docs.map((d) => mapMatchDoc(d.id, d.data() as MatchDoc));

      // ✅ numeração/ordem igual Android: deadline → createdAt → id
      const sorted = sortMatchesGlobal(raw);

      // ✅ se não existir matchNumber no Firestore, usamos o índice (pra ficar igual Android)
      const withNumber = sorted.map((m, idx) => ({
        ...m,
        matchNumber: m.matchNumber ?? idx + 1,
      }));

      onMatches(withNumber);
    },
    (err) => onError?.(err)
  );
}

/**
 * 🔥 Meus palpites (para marcar seleção na UI)
 */

export type MyGuessMap = Record<
  string,
  {
    rawVote?: string;
    over25Pick?: boolean | null;
    bttsPick?: boolean | null;
    qualifierPick?: string | null;
  }
>;

export function subscribeMyGuesses(
  userId: string,
  onMap: (map: MyGuessMap) => void,
  onError?: (err: unknown) => void
) {
  const q = query(collection(db, "guesses"), where("userId", "==", userId), limit(5000));

  return onSnapshot(
    q,
    (snap) => {
      const map: MyGuessMap = {};
      snap.docs.forEach((d) => {
        const data = d.data() as any;
        const matchId = String(data?.matchId || "");
        if (!matchId) return;

        const raw = data?.guess ?? data?.teamSelected;

        map[matchId] = {
          rawVote: raw ? String(raw) : undefined,
          over25Pick:
            typeof data?.over25Pick === "boolean" ? data.over25Pick : (data?.over25Pick ?? null),
          bttsPick:
            typeof data?.bttsPick === "boolean" ? data.bttsPick : (data?.bttsPick ?? null),
          qualifierPick: data?.qualifierPick ? String(data.qualifierPick) : null,
        };
      });
      onMap(map);
    },
    (err) => onError?.(err)
  );
}


/**
 * 🔥 Quantos participantes existem (para % no card)
 */
export async function getParticipantsCount(): Promise<number | null> {
  try {
    const snap = await getCountFromServer(collection(db, "users"));
    return snap.data().count;
  } catch {
    return null;
  }
}

export async function voteOnPoll(pollId: string, userId: string, index: number) {
  const ref = doc(db, "polls", pollId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;

    const d = snap.data() as any;

    const active = d?.active !== false;
    const dl = d?.deadline?.toDate ? d.deadline.toDate() : null;
    const expired = !!dl && Date.now() > dl.getTime();
    if (!active || expired) return;

    const userVotes = (d?.userVotes && typeof d.userVotes === "object") ? d.userVotes : {};
    const prev = userVotes?.[userId];

    const prevIndex =
      typeof prev === "number" ? prev : prev != null ? Number(prev) : NaN;

    // se clicar no mesmo, não faz nada
    if (Number.isFinite(prevIndex) && prevIndex === index) return;

    const update: Record<string, any> = {
      [`votes.${index}`]: increment(1),
      [`userVotes.${userId}`]: index,
    };

    if (Number.isFinite(prevIndex)) {
      update[`votes.${prevIndex}`] = increment(-1);
    }

    tx.update(ref, update);
  });
}


/**
 * 🔥 Votar em um confronto
 *
 * - grava o doc /guesses/{matchId}_{userId} com o mesmo formato do Android
 * - tenta atualizar contadores no /matches (se rules permitirem)
 * - se a transação falhar, faz fallback salvando pelo menos o palpite
 */
export async function voteOnMatch(match: MatchView, userId: string, vote: Vote) {
  const isClosed =
    !!match.winner || (match.deadline ? Date.now() > match.deadline.getTime() : false);
  if (isClosed) return;
  if (vote === "EMPATE" && !match.allowDraw) return;

  const guessId = `${match.id}_${userId}`; // ✅ igual Android
  const guessRef = doc(db, "guesses", guessId);
  const matchRef = doc(db, "matches", match.id);

  const teamSelected = voteToTeamSelected(vote, match);

  try {
    await runTransaction(db, async (tx) => {
      const guessSnap = await tx.get(guessRef);
      const matchSnap = await tx.get(matchRef);

      const prev = guessSnap.exists() ? (guessSnap.data() as any) : null;
      const prevRaw = prev?.guess ?? prev?.teamSelected;
      const prevVote = normalizeVote(prevRaw ? String(prevRaw) : undefined, match);

      const cur = matchSnap.exists() ? (matchSnap.data() as any) : {};
      let a = Number(cur?.votesA ?? 0);
      let b = Number(cur?.votesB ?? 0);
      let d = Number(cur?.votesD ?? 0);

      // ajusta contadores só se o voto mudou
      if (prevVote !== vote) {
        if (prevVote === "A") a = Math.max(0, a - 1);
        if (prevVote === "B") b = Math.max(0, b - 1);
        if (prevVote === "EMPATE") d = Math.max(0, d - 1);

        if (vote === "A") a += 1;
        if (vote === "B") b += 1;
        if (vote === "EMPATE") d += 1;
      }

      // grava palpite (Android + Web)
      tx.set(
        guessRef,
        {
          matchId: match.id,
          userId,
          teamSelected,
          timestamp: serverTimestamp(),
          guess: vote, // extra para Web (Android ignora)
        },
        { merge: true }
      );

      // tenta atualizar contadores no match (se rules permitirem)
      if (matchSnap.exists()) {
        tx.update(matchRef, { votesA: a, votesB: b, votesD: d });
      }
    });
  } catch (err: any) {
    console.warn("Transação falhou, fallback só /guesses:", err?.message || err);

    await setDoc(
      guessRef,
      {
        matchId: match.id,
        userId,
        teamSelected,
        timestamp: serverTimestamp(),
        guess: vote,
      },
      { merge: true }
    );
  }
}
export type VoterRow = {
  userId: string;
  displayName: string;
  photoBase64?: string;
  teamVoted?: string; // só revelamos na UI quando expirado
  joinDate?: Date | null;
};

function tsToDateLoose(ts: any): Date | null {
  try {
    return ts?.toDate ? ts.toDate() : null;
  } catch {
    return null;
  }
}

/**
 * ✅ Igual Android:
 * - busca todos users
 * - busca guesses do match
 * - monta lista "votaram" e "pendentes" (pendentes = entrou antes do deadline e não votou)
 */
export async function fetchVotersForMatch(matchId: string, deadline: Date | null) {
  // 1) users
  const usersSnap = await getDocs(query(collection(db, "users"), limit(5000)));
  const usersMap: Record<string, VoterRow> = {};

  usersSnap.docs.forEach((d) => {
    const data = d.data() as any;
    const name = (data?.name as string) || (data?.username as string) || "Sem Nome";
    usersMap[d.id] = {
      userId: d.id,
      displayName: name,
      photoBase64: (data?.photoBase64 as string) || "",
      joinDate: tsToDateLoose(data?.createdAt),
    };
  });

  // 2) guesses do match
  const guessesSnap = await getDocs(
    query(collection(db, "guesses"), where("matchId", "==", matchId), limit(5000))
  );

  const votedIds = new Set<string>();
  const voters: VoterRow[] = [];

  guessesSnap.docs.forEach((g) => {
    const data = g.data() as any;
    const uid = String(data?.userId || "").trim();
    if (!uid) return;

    votedIds.add(uid);

    const base = usersMap[uid];
    if (!base) return;

    voters.push({
      ...base,
      teamVoted: String(data?.teamSelected || ""),
    });
  });

  // 3) pendentes
  const dl = deadline;
  const missing = Object.values(usersMap)
    .filter((u) => {
      if (votedIds.has(u.userId)) return false;
      if (!dl) return true; // se não tem deadline, consideramos pendente
      const jd = u.joinDate ?? new Date(0);
      return jd.getTime() < dl.getTime();
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  // ordena votantes por nome (no Android fica por nome quando não revela ranking de acertos)
  voters.sort((a, b) => a.displayName.localeCompare(b.displayName));

  return { voters, missing };
}
export type GuessDetailsRow = {
  userId: string;
  displayName: string;
  photoBase64?: string;

  // voto principal (só vamos exibir se expirou, igual segurança do Android)
  voteRaw?: string | null;

  // extras
  over25Pick?: boolean | null;
  bttsPick?: boolean | null;
  qualifierPick?: string | null;

  // horário do palpite (Android usa timestamp)
  timestamp?: Date | null;
};

export async function fetchRegisteredGuessesForMatch(
  match: MatchView
): Promise<{ voted: GuessDetailsRow[]; missing: VoterRow[] }> {
  // 1) users
  const usersSnap = await getDocs(query(collection(db, "users"), limit(5000)));
  const usersMap: Record<string, VoterRow> = {};

  usersSnap.docs.forEach((d) => {
    const data = d.data() as any;
    const name = (data?.name as string) || (data?.username as string) || "Sem Nome";
    usersMap[d.id] = {
      userId: d.id,
      displayName: name,
      photoBase64: (data?.photoBase64 as string) || "",
      joinDate: tsToDateLoose(data?.createdAt),
    };
  });

  // 2) guesses do match (pega tudo que precisamos pra UI)
  const guessesSnap = await getDocs(
    query(collection(db, "guesses"), where("matchId", "==", match.id), limit(5000))
  );

  const votedIds = new Set<string>();
  const voted: GuessDetailsRow[] = [];

  guessesSnap.docs.forEach((g) => {
    const data = g.data() as any;
    const uid = String(data?.userId || "").trim();
    if (!uid) return;

    votedIds.add(uid);

    const base = usersMap[uid];
    if (!base) return;

    const voteRaw = (data?.guess ?? data?.teamSelected ?? null) as string | null;

    voted.push({
      userId: uid,
      displayName: base.displayName,
      photoBase64: base.photoBase64,

      voteRaw,

      over25Pick: typeof data?.over25Pick === "boolean" ? data.over25Pick : (data?.over25Pick ?? null),
      bttsPick: typeof data?.bttsPick === "boolean" ? data.bttsPick : (data?.bttsPick ?? null),
      qualifierPick: data?.qualifierPick ? String(data.qualifierPick) : null,

      timestamp: tsToDateLoose(data?.timestamp ?? data?.createdAt),
    });
  });

  // 3) faltosos (não votaram) — mesma regra do Android: entrou antes do deadline
  const dl = match.deadline ?? null;
  const missing = Object.values(usersMap)
    .filter((u) => {
      if (votedIds.has(u.userId)) return false;
      if (!dl) return true;
      const jd = u.joinDate ?? new Date(0);
      return jd.getTime() < dl.getTime();
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  // ordena votantes por nome
  voted.sort((a, b) => a.displayName.localeCompare(b.displayName));

  return { voted, missing };
}

export async function setOver25(matchId: string, userId: string, value: boolean | null) {
  const guessId = `${matchId}_${userId}`;
  const ref = doc(db, "guesses", guessId);

  await setDoc(
    ref,
    {
      matchId,
      userId,
      over25Pick: value,
      timestamp: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function setBtts(matchId: string, userId: string, value: boolean | null) {
  const guessId = `${matchId}_${userId}`;
  const ref = doc(db, "guesses", guessId);

  await setDoc(
    ref,
    {
      matchId,
      userId,
      bttsPick: value,
      timestamp: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function setQualifierPick(
  matchId: string,
  userId: string,
  teamName: string | null
) {
  const guessId = `${matchId}_${userId}`;
  const ref = doc(db, "guesses", guessId);

  await setDoc(
    ref,
    {
      matchId,
      userId,
      qualifierPick: teamName,
      timestamp: serverTimestamp(),
    },
    { merge: true }
  );
}
export type CommentRow = {
  id: string;
  matchId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: Date;
};

function safeStr(v: any) {
  return typeof v === "string" ? v : "";
}

export function subscribeComments(
  matchId: string,
  onList: (list: CommentRow[]) => void,
  onError?: (err: unknown) => void
) {
  const q = query(
    collection(db, "match_comments")
,
    where("matchId", "==", matchId),
    // ✅ removido orderBy para NÃO exigir índice composto
    limit(5000)
  );

  return onSnapshot(
    q,
    (snap) => {
      const list: CommentRow[] = snap.docs.map((d) => {
        const data = d.data() as any;
        const created = tsToDate(data?.timestamp ?? data?.createdAt) ?? new Date(0);
return {
  id: d.id,
  matchId,
  userId: safeStr(data?.userId),
  userName: safeStr(data?.userName) || "Usuário",
  text: safeStr(data?.text),
  createdAt: created,
};

      });

      // ✅ ordena no front (mesmo efeito do orderBy)
      list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      onList(list);
    },
    (err) => onError?.(err)
  );
}

export function subscribeCommentsCount(
  matchId: string,
  onCount: (count: number) => void,
  onError?: (err: unknown) => void
) {
const q = query(
  collection(db, "match_comments"),
  where("matchId", "==", matchId),
  limit(5000)
);


  return onSnapshot(
    q,
    (snap) => onCount(snap.size),
    (err) => onError?.(err)
  );
}

export async function addComment(params: {
  matchId: string;
  userId: string;
  userName: string;
  text: string;
}) {
  const text = params.text.trim();
  if (!text) return;

  // id único (sem depender de addDoc)
  const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const ref = doc(db, "match_comments", id);

  await setDoc(ref, {
  matchId: params.matchId,
  userId: params.userId,
  userName: params.userName,
  text,

  // ✅ Android usa timestamp
  timestamp: serverTimestamp(),

  // ✅ mantemos createdAt também (compatibilidade com o que já fizemos no Web)
  createdAt: serverTimestamp(),
});

}
export type MatchThermo = {
  votedMain: number;
  votesA: number;
  votesB: number;
  votesD: number;

  over25True: number;
  over25False: number;

  bttsTrue: number;
  bttsFalse: number;

  qualifierA: number;
  qualifierB: number;
};

function normName(s: string) {
  return (s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * ✅ Termômetro REAL (igual Android): conta a partir de /guesses
 * - main vote: A / B / EMPATE
 * - extras: over25Pick / bttsPick / qualifierPick
 */
export function subscribeMatchThermo(
  match: MatchView,
  onThermo: (t: MatchThermo) => void,
  onError?: (err: unknown) => void
) {
  const q = query(
    collection(db, "guesses"),
    where("matchId", "==", match.id),
    limit(5000)
  );

  return onSnapshot(
    q,
    (snap) => {
      let votesA = 0;
      let votesB = 0;
      let votesD = 0;
      let votedMain = 0;

      let over25True = 0;
      let over25False = 0;

      let bttsTrue = 0;
      let bttsFalse = 0;

      let qualifierA = 0;
      let qualifierB = 0;

      const nTeamA = normName(match.teamA);
      const nTeamB = normName(match.teamB);

      snap.docs.forEach((d) => {
        const data = d.data() as any;

        // -------- main vote (A/B/EMPATE) --------
        const rawVote = data?.guess ?? data?.teamSelected;
        const v = normalizeVote(rawVote ? String(rawVote) : undefined, match);

        if (v) {
          votedMain += 1;
          if (v === "A") votesA += 1;
          else if (v === "B") votesB += 1;
          else if (v === "EMPATE") votesD += 1;
        }

        // -------- extras --------
        if (data?.over25Pick === true) over25True += 1;
        else if (data?.over25Pick === false) over25False += 1;

        if (data?.bttsPick === true) bttsTrue += 1;
        else if (data?.bttsPick === false) bttsFalse += 1;

        const qp = typeof data?.qualifierPick === "string" ? data.qualifierPick : "";
        const nqp = normName(qp);
        if (nqp && nqp === nTeamA) qualifierA += 1;
        else if (nqp && nqp === nTeamB) qualifierB += 1;
      });

      onThermo({
        votedMain,
        votesA,
        votesB,
        votesD,
        over25True,
        over25False,
        bttsTrue,
        bttsFalse,
        qualifierA,
        qualifierB,
      });
    },
    (err) => onError?.(err)
  );
}
