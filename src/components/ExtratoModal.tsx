import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  type Timestamp,
} from "firebase/firestore";

import { db } from "../lib/firebase";
import { sortMatchesGlobal, type MatchDoc, type MatchView } from "../lib/contracts";
import RegisteredGuessesModal from "./RegisteredGuessesModal";


// ✅ Fundo real do Android (existe no seu projeto)
import bgExtrato from "../assets/android/bg/bg_dialog_extrato.jpeg";

type Props = {
  userId: string;
  displayName: string; // fallback (nome que veio do ranking)
  onClose: () => void;
};

function tsToDateLoose(ts: any): Date | null {
  try {
    return ts?.toDate ? (ts as Timestamp).toDate() : null;
  } catch {
    return null;
  }
}

function ddmmyy(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function norm(s: string) {
  return (s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function pickToCode(pickRaw: string | null | undefined, m: MatchView) {
  const pick = (pickRaw || "").trim();
  if (!pick) return null;

  const up = pick.toUpperCase();
  if (up === "A" || up === "B" || up === "D" || up === "EMPATE") return up === "EMPATE" ? "D" : up;

  const p = norm(pick);
  const a = norm(m.teamA);
  const b = norm(m.teamB);

  if (p === a) return "A";
  if (p === b) return "B";

  return pick; // fallback (se vocês salvarem texto livre)
}

function codeToLabel(code: string | null, m: MatchView) {
  if (!code) return "";
  const up = code.toUpperCase();
  if (up === "A") return m.teamA;
  if (up === "B") return m.teamB;
  if (up === "D") return "EMPATE";
  return code;
}

function codeToLogo(code: string | null, m: MatchView) {
  if (!code) return null;
  const up = code.toUpperCase();
  if (up === "A") return (m.teamALogo as string | undefined) ?? null;
  if (up === "B") return (m.teamBLogo as string | undefined) ?? null;
  return null; // empate não tem logo
}

// -------- medalhas por jogo (prioridade)
const MEDAL_PRIORITY = ["👽", "🎯", "🔥", "🦓", "🔮", "🎓"] as const;
const medalRank = new Map<string, number>(MEDAL_PRIORITY.map((m, i) => [m, i]));

function betterMedal(cur: string | null, next: string) {
  if (!cur) return next;
  const rc = medalRank.get(cur) ?? 999;
  const rn = medalRank.get(next) ?? 999;
  return rn < rc ? next : cur;
}

type ExtratoRow = {
  key: string;
  match: MatchView; // ✅ para abrir palpites do jogo ao clicar
  dateStr: string;

  teamALogo?: string | null;
  teamBLogo?: string | null;

  goalsA: number | null;
  goalsB: number | null;

  // Voto
  voteLabel: string;     // usado só quando não tem logo (ex.: empate)
  voteLogo?: string | null;

  // status principal
  isNoVote: boolean;
  isHit: boolean;
  resultPts: number;

  // extras
  extraPts: number;

  // ⚽ (só aparece se acertou)
  showGoalsChip: boolean;
  goalsText: string; // +2,5 ou -2,5

  // 🏟️ AM (só aparece se acertou)
  showAmChip: boolean;
  amText: string;       // AM ✓ ou AM ✖
  amIsNoPick: boolean;  // true quando o voto foi "AM NÃO" (pra deixar X vermelho)

  // CL (aparece sempre se askQualifier)
  showClChip: boolean;
  clOk: boolean | null;
  clPickLogo: string | null;
  clResLogo: string | null;

  // medalha do jogo (lado direito da 3ª linha)
  medalIcon: string | null;

  totalPts: number;
};

export default function ExtratoModal({ userId, displayName, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState(displayName);
  const [rows, setRows] = useState<ExtratoRow[]>([]);
const [openMatch, setOpenMatch] = useState<MatchView | null>(null);

  const summary = useMemo(() => {
    let r = 0, x = 0, t = 0;
    for (const it of rows) {
      r += it.resultPts;
      x += it.extraPts;
      t += it.totalPts;
    }
    return { resultPts: r, extraPts: x, totalPts: t };
  }, [rows]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr(null);

      try {
        const [userSnap, matchesSnap, guessesSnap] = await Promise.all([
          getDoc(doc(db, "users", userId)),
          getDocs(collection(db, "matches")),
          getDocs(query(collection(db, "guesses"), where("userId", "==", userId))),
        ]);

        const userData = userSnap.exists() ? (userSnap.data() as any) : {};
        const createdAt = tsToDateLoose(userData?.createdAt) ?? new Date(0);
        const realName =
          (userData?.name as string) || (userData?.username as string) || displayName;

        // guesses por match
        const guessByMatch: Record<string, any> = {};
        guessesSnap.docs.forEach((d) => {
          const g = d.data() as any;
          const mid = String(g?.matchId || "");
          if (mid) guessByMatch[mid] = g;
        });

        // matches mapeados (inclui votos/totalUsers pra zebra)
        const mapped = matchesSnap.docs
          .map((d) => {
            const data = d.data() as MatchDoc;
            const deadline = tsToDateLoose((data as any).deadline);
            const createdAtM = tsToDateLoose((data as any).createdAt);

            return {
              id: d.id,
              teamA: data.teamA ?? "-",
              teamB: data.teamB ?? "-",
              competition: data.competition ?? "-",
              round: data.round ?? "-",
              allowDraw: data.allowDraw ?? false,
              winner: ((data as any).winner as string | null) ?? null,
              deadline,
              createdAt: createdAtM,
              deadlineLabel: "",

              teamALogo: (data as any).teamALogo ?? (data as any).teamAUrl ?? null,
              teamBLogo: (data as any).teamBLogo ?? (data as any).teamBUrl ?? null,

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
            } as unknown as MatchView;
          })
          .filter((m: any) => !!m.deadline);

        const ordered = (sortMatchesGlobal(mapped as any) as any[]) as MatchView[];

        // ✅ só mostra jogos “válidos” pro usuário (ele já existia antes do deadline)
        const eligible = ordered.filter((m: any) => {
          if (!m.deadline) return false;
          return createdAt.getTime() < (m.deadline as Date).getTime();
        });

        // --------- medalhas por match (streak/zebra/final/veterano)
        const finishedAsc = [...eligible]
          .filter((m: any) => !!m.winner)
          .sort((a: any, b: any) => (a.deadline as Date).getTime() - (b.deadline as Date).getTime());

        const medalByMatchId: Record<string, string> = {};

        function winnerVotes(m: any) {
          const w = String(pickToCode(m.winner, m) || "");
          if (w === "A") return Number(m.votesA ?? 0);
          if (w === "B") return Number(m.votesB ?? 0);
          if (w === "D") return Number(m.votesD ?? 0);
          return 0;
        }

        function participants(m: any) {
          const t = Number(m.totalUsers ?? 0);
          if (t > 0) return t;
          const s = Number(m.votesA ?? 0) + Number(m.votesB ?? 0) + Number(m.votesD ?? 0);
          return Math.max(1, s);
        }

        let streak = 0;
        let veteranHits = 0;

        for (const m of finishedAsc as any[]) {
          const g = guessByMatch[m.id];
          const pickMain = pickToCode(g?.teamSelected, m);
          const win = pickToCode(m.winner, m);

          const isHit = !!pickMain && !!win && String(pickMain) === String(win);

          if (isHit) {
            veteranHits++;
            streak++;

            // 🔮 final
            if (String(m.round || "").trim().toLowerCase() === "final") {
              medalByMatchId[m.id] = betterMedal(medalByMatchId[m.id] ?? null, "🔮");
            }

            // 🦓 zebra (<=20%)
            const wv = winnerVotes(m);
            const pt = participants(m);
            if (wv > 0 && wv / pt <= 0.2) {
              medalByMatchId[m.id] = betterMedal(medalByMatchId[m.id] ?? null, "🦓");
            }

            // streak medals
            if (streak === 3) medalByMatchId[m.id] = betterMedal(medalByMatchId[m.id] ?? null, "🔥");
            if (streak === 5) medalByMatchId[m.id] = betterMedal(medalByMatchId[m.id] ?? null, "🎯");
            if (streak === 10) medalByMatchId[m.id] = betterMedal(medalByMatchId[m.id] ?? null, "👽");

            // 🎓 veterano a cada 50 acertos
            if (veteranHits > 0 && veteranHits % 50 === 0) {
              medalByMatchId[m.id] = betterMedal(medalByMatchId[m.id] ?? null, "🎓");
            }
          } else {
            streak = 0;
          }
        }

        // --------- candidatos do extrato:
        // - finalizado (winner definido)
        // - ou “fantasma”: deadline passou, sem voto
        const nowMs = Date.now();
        const candidates = eligible.filter((m: any) => {
          if (!m.deadline) return false;

          const dl = (m.deadline as Date).getTime();
          const hasVote = !!guessByMatch[m.id];

          if (m.winner) return true;

          return dl < nowMs && !hasVote;
        });

        // mais recente -> mais antigo (igual seu print)
        candidates.sort(
          (a: any, b: any) => (b.deadline as Date).getTime() - (a.deadline as Date).getTime()
        );

        const out: ExtratoRow[] = candidates.map((m: any) => {
          const dl: Date = m.deadline as Date;
          const dateStr = ddmmyy(dl);

          const g = guessByMatch[m.id];
          const hasVote = !!g;

          const pickMain = pickToCode(g?.teamSelected, m);
          const winner = pickToCode(m.winner, m);

          // principal
          let isHit = false;
          let resultPts = 0;

          if (hasVote && pickMain && winner) {
            isHit = String(pickMain) === String(winner);
            if (isHit) {
              const isFinal = String(m.round || "").trim().toLowerCase() === "final";
              resultPts = isFinal ? 6 : 3;
            }
          }

          // extras (+1 cada)
          const ga = typeof m.goalsA === "number" ? m.goalsA : null;
          const gb = typeof m.goalsB === "number" ? m.goalsB : null;
          const hasScore = ga != null && gb != null;

          const overRes = hasScore ? ga + gb >= 3 : null;
          const bttsRes = hasScore ? ga > 0 && gb > 0 : null;

          const overPick = typeof g?.over25Pick === "boolean" ? g.over25Pick : null;
          const bttsPick = typeof g?.bttsPick === "boolean" ? g.bttsPick : null;

          const goalsOk = hasScore && overRes != null && overPick != null ? overPick === overRes : false;
          const amOk = hasScore && bttsRes != null && bttsPick != null ? bttsPick === bttsRes : false;

          let extraPts = 0;
          if (goalsOk) extraPts++;
          if (amOk) extraPts++;

          // CL (sempre aparece quando o jogo pede)
          const showClChip = Boolean(m.askQualifier);
          const clRes = showClChip ? (m.qualifier || m.winner || null) : null;
          const clPick = showClChip ? pickToCode(g?.qualifierPick, m) : null;

          const clOk =
            showClChip && clRes
              ? String(pickToCode(clPick, m) || "") === String(pickToCode(clRes, m) || "")
                ? true
                : clPick
                ? false
                : null
              : null;

          if (clOk === true) extraPts++;

          const totalPts = resultPts + extraPts;

          // ✅ texto do voto só se NÃO tiver logo (ex.: empate)
          const voteLabel = hasVote ? codeToLabel(String(pickMain || ""), m) : "NÃO VOTOU";
          const voteLogo = hasVote ? codeToLogo(String(pickMain || ""), m) : null;

          // ✅ chips só quando ACERTOU e de acordo com o que VOTOU
          const showGoalsChip = goalsOk === true;
          const goalsText = overPick === true ? "+2,5" : "-2,5";

          const showAmChip = amOk === true;
          const amIsNoPick = bttsPick === false;
          const amText = amIsNoPick ? "AM ✖" : "AM ✓";

          const clPickLogo = showClChip ? codeToLogo(String(clPick || ""), m) : null;
          const clResLogo = showClChip ? codeToLogo(String(pickToCode(clRes, m) || ""), m) : null;

          const medalIcon = medalByMatchId[m.id] ?? null;

          const isNoVote = !hasVote;

          return {
  key: `${dateStr}-${m.id}`,
  match: m, // ✅ salva referência do jogo
  dateStr,

            teamALogo: (m.teamALogo as string | undefined) ?? null,
            teamBLogo: (m.teamBLogo as string | undefined) ?? null,

            goalsA: ga,
            goalsB: gb,

            voteLabel,
            voteLogo,

            isNoVote,
            isHit,
            resultPts,

            extraPts,

            showGoalsChip,
            goalsText,

            showAmChip,
            amText,
            amIsNoPick,

            showClChip,
            clOk,
            clPickLogo,
            clResLogo,

            medalIcon,

            totalPts,
          };
        });

        if (!alive) return;
        setName(realName);
        setRows(out);
      } catch (e: any) {
        console.error(e);
        if (!alive) return;
        setErr(e?.message || "Falha ao carregar extrato.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId, displayName]);

  const ui = (
    <>
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div className="relative w-full max-w-[620px] rounded-2xl overflow-hidden border border-white/15 shadow-2xl">
        {/* ✅ Fundo do Android */}
        <img
          src={bgExtrato}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />

        <div className="relative">
          {/* Header */}
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="rounded-2xl bg-white/90 border border-yellow-300/70 px-4 py-2 font-black text-zinc-900">
                Extrato • {name}
              </div>

              <button
                onClick={onClose}
                className="rounded-xl bg-white/20 hover:bg-white/30 border border-white/15 p-2"
                title="Fechar"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Summary bar */}
            <div className="mt-3 rounded-2xl bg-white/90 border border-yellow-300/70 px-3 py-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-white/70 border border-black/5 px-3 py-2 text-center">
                  <div className="text-[11px] font-black text-zinc-600">RESULTADO</div>
                  <div className="text-2xl font-black text-emerald-700">
                    {summary.resultPts} <span className="text-xs text-zinc-500">pts</span>
                  </div>
                </div>

                <div className="rounded-xl bg-white/70 border border-black/5 px-3 py-2 text-center">
                  <div className="text-[11px] font-black text-zinc-600">EXTRAS</div>
                  <div className="text-2xl font-black text-emerald-700">
                    {summary.extraPts} <span className="text-xs text-zinc-500">pts</span>
                  </div>
                </div>

                <div className="rounded-xl bg-white/70 border border-black/5 px-3 py-2 text-center">
                  <div className="text-[11px] font-black text-zinc-600">TOTAL</div>
                  <div className="text-2xl font-black text-yellow-600">
                    {summary.totalPts} <span className="text-xs text-zinc-500">pts</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Lista */}
          <div className="px-4 pb-4">
            <div className="rounded-2xl bg-white/85 border border-white/30 p-3">
              {err && (
                <div className="mb-3 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm font-black text-red-700">
                  {err}
                </div>
              )}

              {loading ? (
                <div className="py-10 text-center font-black text-zinc-700">Carregando extrato...</div>
              ) : rows.length === 0 ? (
                <div className="py-10 text-center font-black text-zinc-700">Nenhum registro encontrado.</div>
              ) : (
                <div className="max-h-[55vh] overflow-auto pr-1 space-y-3">
                  {rows.map((r) => {
                    const hasScore = typeof r.goalsA === "number" && typeof r.goalsB === "number";
                    const scoreText = hasScore ? `${r.goalsA} x ${r.goalsB}` : "— x —";

                    const bg = r.isNoVote ? "bg-yellow-50/90" : r.isHit ? "bg-emerald-50/90" : "bg-rose-50/90";
                    const stripe = r.isNoVote ? "bg-yellow-500" : r.isHit ? "bg-emerald-700" : "bg-rose-700";

                    return (
                      <div
  key={r.key}
  role="button"
  tabIndex={0}
  onClick={() => setOpenMatch(r.match)}
  onKeyDown={(e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    setOpenMatch(r.match);
  }
}}

  className={[
    "relative rounded-2xl overflow-hidden border border-black/5 shadow-sm",
    "cursor-pointer hover:shadow-md transition",
    bg,
  ].join(" ")}
>

                        <div className={["absolute left-0 top-0 bottom-0 w-2", stripe].join(" ")} />

                        <div className="p-3 pl-4">
                          {/* Linha 1 */}
                          <div className="flex items-center gap-3">
                            <div className="w-14 text-[12px] font-black text-zinc-600">{r.dateStr}</div>

                            <div className="flex-1 flex items-center justify-center gap-2">
  {r.teamALogo ? (
    <img src={r.teamALogo} className="w-5 h-5 object-contain flex-none" alt="" />
  ) : null}

  <div className="text-[15px] font-black text-zinc-900 whitespace-nowrap tabular-nums">
    {scoreText}
  </div>

  {r.teamBLogo ? (
    <img src={r.teamBLogo} className="w-5 h-5 object-contain flex-none" alt="" />
  ) : null}
</div>

                            <div className="w-24 flex justify-end">
                              <div className="rounded-xl bg-white/60 border border-black/5 px-2 py-1 flex items-baseline gap-1">
                                <div className="text-[18px] font-black text-emerald-700">+{r.totalPts}</div>
                                <div className="text-[10px] font-black text-zinc-500">pts</div>
                              </div>
                            </div>
                          </div>

                          <div className="my-2 h-px bg-black/10" />

                          {/* Linha 2 */}
                          <div className="flex items-center gap-3">
                            <div className="w-14 flex items-center">
                              {r.isNoVote ? (
                                <MinusCircle className="w-5 h-5 text-zinc-500" />
                              ) : r.isHit ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                              ) : (
                                <XCircle className="w-5 h-5 text-rose-700" />
                              )}
                            </div>

                            <div className="flex-1 flex items-center gap-2">
                              <div className="text-[12px] font-black text-zinc-500">Voto:</div>

                              {r.isNoVote ? (
                                <div className="text-[12px] font-black text-zinc-700">NÃO VOTOU</div>
                              ) : (
                                <>
                                  {/* ✅ só logo; se não tiver logo (empate), mostra texto */}
                                  {r.voteLogo ? (
                                    <img src={r.voteLogo} alt="" className="w-5 h-5 object-contain" />
                                  ) : (
                                    <div className="text-[12px] font-black text-zinc-900">{r.voteLabel}</div>
                                  )}
                                </>
                              )}
                            </div>

                            {/* (vazio mesmo) */}
                            <div className="w-24" />
                          </div>

                          <div className="my-2 h-px bg-black/10" />

                          {/* Linha 3 (extras + medalha à direita) */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex flex-wrap gap-2">
                              {/* ⚽ goals: só quando acertou e conforme voto */}
                              {r.showGoalsChip ? (
                                <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black border bg-emerald-50/90 text-emerald-800 border-emerald-200">
                                  <span className="text-sm">⚽</span>
                                  <span>{r.goalsText}</span>
                                </div>
                              ) : null}

                              {/* 🏟️ AM: só quando acertou; ✓ se votou sim, ✖ vermelho se votou não */}
                              {r.showAmChip ? (
  <div
    className={[
      "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black border",
      "bg-emerald-50/90 text-emerald-800 border-emerald-200",
    ].join(" ")}
  >
    <span className="text-sm">🏟️</span>
    <span>
      AM{" "}
      <span className="text-emerald-700">
        {r.amIsNoPick ? "✖" : "✓"}
      </span>
    </span>
  </div>
) : null}


                              {/* 🏁 CL: aparece sempre quando o jogo pede */}
                              {r.showClChip ? (
                                <div
                                  className={[
                                    "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black border",
                                    r.clOk === true
                                      ? "bg-emerald-50/90 text-emerald-800 border-emerald-200"
                                      : "bg-zinc-100/80 text-zinc-700 border-zinc-200",
                                  ].join(" ")}
                                  title="Classificado"
                                >
                                  <span className="text-sm">🏁</span>
                                  <span>CL</span>

                                  <div className="flex items-center gap-1">
                                    <div className="w-5 h-5 rounded-full bg-white/80 border border-black/10 overflow-hidden flex items-center justify-center">
                                      {r.clPickLogo ? (
                                        <img src={r.clPickLogo} alt="" className="w-full h-full object-contain" />
                                      ) : (
                                        <span className="text-[10px] text-zinc-500">—</span>
                                      )}
                                    </div>

                                    <span className="text-[10px] text-zinc-500">→</span>

                                    <div className="w-5 h-5 rounded-full bg-white/80 border border-black/10 overflow-hidden flex items-center justify-center">
                                      {r.clResLogo ? (
                                        <img src={r.clResLogo} alt="" className="w-full h-full object-contain" />
                                      ) : (
                                        <span className="text-[10px] text-zinc-500">—</span>
                                      )}
                                    </div>
                                  </div>

                                  <span className="ml-1">{r.clOk === true ? "✓" : "—"}</span>
                                </div>
                              ) : null}

                              {/* fallback: se não acertou nenhum extra e não tem CL */}
                              {!r.showGoalsChip && !r.showAmChip && !r.showClChip ? (
                                <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black border bg-zinc-100/80 text-zinc-600 border-zinc-200">
                                  <span className="text-sm">—</span>
                                  <span>SEM EXTRAS</span>
                                </div>
                              ) : null}
                            </div>

                            {/* ✅ medalha do jogo (em branco se não tiver) */}
                            <div className="w-10 text-right text-[18px] font-black text-zinc-900">
                              {r.medalIcon ?? ""}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-3">
                <button
                  onClick={onClose}
                  className="w-full rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-black py-3"
                >
                  FECHAR
                </button>
              </div>
            </div>
          </div>

      </div>
      </div>
    </div>

    {/* === MODAL PALPITES REGISTRADOS (fica fora do div acima, mas dentro do fragment) === */}
    {openMatch && (
      <RegisteredGuessesModal
        match={openMatch}
        isExpired={true}
        onClose={() => setOpenMatch(null)}
        closeLabel="VOLTAR"
      />
    )}
  </>
);

return createPortal(ui, document.body);
  
}
