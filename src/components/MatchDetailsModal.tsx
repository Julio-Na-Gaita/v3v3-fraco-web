import type { MatchView, Vote } from "../lib/contracts";

function fmt(dt: Date | null | undefined) {
  if (!dt) return "-";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(dt);
  } catch {
    return "-";
  }
}

function pillClass(active: boolean) {
  return [
    "px-4 py-2 rounded-full font-black text-sm transition border",
    active ? "bg-white text-zinc-900 border-transparent" : "bg-white/10 text-zinc-200 border-white/10",
  ].join(" ");
}

export default function MatchDetailsModal({
  match,
  myVote,
  myExtras,
  isExpired,
  onClose,
}: {
  match: MatchView;
  myVote: Vote | null;
  myExtras: {
    over25Pick?: boolean | null;
    bttsPick?: boolean | null;
    qualifierPick?: string | null;
  } | null;
  isExpired: boolean;
  onClose: () => void;
}) {
  const over25 = myExtras?.over25Pick ?? null; // true=+2.5, false=-2.5
  const btts = myExtras?.bttsPick ?? null; // true=SIM, false=NÃO
  const qual = myExtras?.qualifierPick ?? null;

  const votesA = match.votesA ?? 0;
  const votesD = match.votesD ?? 0;
  const votesB = match.votesB ?? 0;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950/95 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xl font-black tracking-wide text-zinc-100">👁️ Detalhes</div>
            <div className="text-zinc-400 text-sm mt-1">
              #{match.matchNumber ?? "?"} • {match.teamA} x {match.teamB}
            </div>
            <div className="text-zinc-500 text-xs font-bold mt-1">{match.competition} • {match.round}</div>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-2xl bg-white/5 border border-white/10 text-zinc-200 font-black hover:bg-white/10 transition"
          >
            FECHAR
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          {/* Seu palpite */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="text-zinc-300 font-black text-sm">Seu palpite</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className={pillClass(myVote === "A")}>{match.teamA}</span>
              <span className={pillClass(myVote === "EMPATE")}>EMPATE</span>
              <span className={pillClass(myVote === "B")}>{match.teamB}</span>
              {!myVote && (
                <span className="px-4 py-2 rounded-full bg-white/10 border border-white/10 text-zinc-400 font-black text-sm">
                  —
                </span>
              )}
            </div>
          </div>

          {/* Extras */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="text-zinc-300 font-black text-sm">Extras</div>

            <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
              <div className="text-zinc-400 font-black text-sm">Gols</div>
              <div className="flex gap-2">
                <span className={pillClass(over25 === true)}>+2.5</span>
                <span className={pillClass(over25 === false)}>-2.5</span>
                {over25 == null && (
                  <span className="px-4 py-2 rounded-full bg-white/10 border border-white/10 text-zinc-400 font-black text-sm">
                    —
                  </span>
                )}
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
              <div className="text-zinc-400 font-black text-sm">AM</div>
              <div className="flex gap-2">
                <span className={pillClass(btts === true)}>SIM</span>
                <span className={pillClass(btts === false)}>NÃO</span>
                {btts == null && (
                  <span className="px-4 py-2 rounded-full bg-white/10 border border-white/10 text-zinc-400 font-black text-sm">
                    —
                  </span>
                )}
              </div>
            </div>

            {match.askQualifier && (
              <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                <div className="text-zinc-400 font-black text-sm">Quem classifica?</div>
                <div className="flex gap-2">
                  <span className={pillClass(qual === match.teamA)}>{match.teamA}</span>
                  <span className={pillClass(qual === match.teamB)}>{match.teamB}</span>
                  {!qual && (
                    <span className="px-4 py-2 rounded-full bg-white/10 border border-white/10 text-zinc-400 font-black text-sm">
                      —
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Resultado / distribuição (somente após prazo) */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="text-zinc-300 font-black text-sm">Situação</div>
            <div className="text-zinc-500 text-xs font-bold mt-1">{match.deadlineLabel} • {fmt(match.deadline)}</div>

            {isExpired ? (
              <>
                <div className="mt-3 text-zinc-200 font-black text-sm">
                  Placar: {match.goalsA ?? "—"} x {match.goalsB ?? "—"}
                </div>
                <div className="mt-2 text-zinc-400 text-sm font-bold">
                  Votos: {match.teamA} {votesA} • Empate {votesD} • {match.teamB} {votesB}
                </div>
              </>
            ) : (
              <div className="mt-2 text-zinc-500 text-sm font-bold">
                Distribuição só após o prazo.
              </div>
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full py-3 rounded-2xl bg-white text-zinc-900 font-black hover:bg-zinc-100 transition"
        >
          OK
        </button>
      </div>
    </div>
  );
}
