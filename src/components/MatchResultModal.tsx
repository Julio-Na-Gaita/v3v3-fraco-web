import { useMemo, useState } from "react";
import type { MatchView } from "../lib/contracts";
import { clearMatchResult, setMatchResult } from "../lib/adminMatchesApi";

function norm(s: unknown) {
  return String(s ?? "").trim();
}

export default function MatchResultModal({
  match,
  onClose,
  onDone,
}: {
  match: MatchView;
  onClose: () => void;
  onDone: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [goalsA, setGoalsA] = useState<number>(typeof match.goalsA === "number" ? match.goalsA : 0);
  const [goalsB, setGoalsB] = useState<number>(typeof match.goalsB === "number" ? match.goalsB : 0);

  const computedWinner = useMemo(() => {
    if (goalsA > goalsB) return match.teamA;
    if (goalsB > goalsA) return match.teamB;
    return "EMPATE";
  }, [goalsA, goalsB, match.teamA, match.teamB]);

  const [winner, setWinner] = useState<string>(norm(match.winner) || computedWinner);
  const [qualifier, setQualifier] = useState<string | null>(match.qualifier ?? null);

  const showQualifier = !!match.askQualifier;

  async function onSave() {
    setToast(null);

    if (!Number.isFinite(goalsA) || goalsA < 0) return setToast("Gols A inválido.");
    if (!Number.isFinite(goalsB) || goalsB < 0) return setToast("Gols B inválido.");
    if (!winner) return setToast("Winner inválido.");

    setSaving(true);
    try {
      await setMatchResult(match.id, {
        goalsA,
        goalsB,
        winner,
        qualifier: showQualifier ? qualifier : null,
      });
      onDone();
    } catch (e: any) {
      console.error(e);
      setToast(e?.message ?? "Erro ao salvar resultado.");
    } finally {
      setSaving(false);
    }
  }

  async function onClear() {
    setToast(null);
    setSaving(true);
    try {
      await clearMatchResult(match.id);
      onDone();
    } catch (e: any) {
      console.error(e);
      setToast(e?.message ?? "Erro ao limpar resultado.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-zinc-950/95 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xl font-black tracking-wide text-zinc-100">✅ Resultado</div>
            <div className="text-zinc-400 text-sm mt-1 font-bold">
              #{match.matchNumber ?? "?"} • {match.teamA} x {match.teamB}
            </div>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-2xl bg-white/5 border border-white/10 text-zinc-200 font-black hover:bg-white/10 transition"
          >
            FECHAR
          </button>
        </div>

        {toast && (
          <div className="mt-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-black text-rose-200">
            {toast}
          </div>
        )}

        <div className="mt-4 grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-black text-zinc-300 mb-1">Gols {match.teamA}</div>
              <input
                type="number"
                min={0}
                value={goalsA}
                onChange={(e) => setGoalsA(Number(e.target.value))}
                className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-zinc-100 font-black outline-none"
              />
            </div>

            <div>
              <div className="text-xs font-black text-zinc-300 mb-1">Gols {match.teamB}</div>
              <input
                type="number"
                min={0}
                value={goalsB}
                onChange={(e) => setGoalsB(Number(e.target.value))}
                className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-zinc-100 font-black outline-none"
              />
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
            <div className="text-xs font-black text-zinc-300 mb-2">Winner</div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setWinner(match.teamA)}
                className={[
                  "px-4 py-2 rounded-full font-black text-sm transition border",
                  winner === match.teamA ? "bg-emerald-600 text-white border-transparent" : "bg-white/10 text-zinc-100 border-white/10",
                ].join(" ")}
              >
                {match.teamA}
              </button>

              <button
                type="button"
                onClick={() => setWinner("EMPATE")}
                className={[
                  "px-4 py-2 rounded-full font-black text-sm transition border",
                  winner === "EMPATE" ? "bg-zinc-300 text-zinc-900 border-transparent" : "bg-white/10 text-zinc-100 border-white/10",
                ].join(" ")}
              >
                EMPATE
              </button>

              <button
                type="button"
                onClick={() => setWinner(match.teamB)}
                className={[
                  "px-4 py-2 rounded-full font-black text-sm transition border",
                  winner === match.teamB ? "bg-red-600 text-white border-transparent" : "bg-white/10 text-zinc-100 border-white/10",
                ].join(" ")}
              >
                {match.teamB}
              </button>

              <button
                type="button"
                onClick={() => setWinner(computedWinner)}
                className="ml-auto px-4 py-2 rounded-full font-black text-sm transition border bg-white/5 text-zinc-200 border-white/10 hover:bg-white/10"
                title="Recalcular pelo placar"
              >
                AUTO ({computedWinner})
              </button>
            </div>
          </div>

          {showQualifier && (
            <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
              <div className="text-xs font-black text-zinc-300 mb-2">Quem classifica?</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setQualifier(match.teamA)}
                  className={[
                    "px-4 py-2 rounded-full font-black text-sm transition border",
                    qualifier === match.teamA ? "bg-emerald-600 text-white border-transparent" : "bg-white/10 text-zinc-100 border-white/10",
                  ].join(" ")}
                >
                  {match.teamA}
                </button>

                <button
                  type="button"
                  onClick={() => setQualifier(match.teamB)}
                  className={[
                    "px-4 py-2 rounded-full font-black text-sm transition border",
                    qualifier === match.teamB ? "bg-red-600 text-white border-transparent" : "bg-white/10 text-zinc-100 border-white/10",
                  ].join(" ")}
                >
                  {match.teamB}
                </button>

                <button
                  type="button"
                  onClick={() => setQualifier(null)}
                  className="ml-auto px-4 py-2 rounded-full font-black text-sm transition border bg-white/5 text-zinc-200 border-white/10 hover:bg-white/10"
                >
                  LIMPAR
                </button>
              </div>
            </div>
          )}

          <div className="mt-2 flex gap-2 justify-end">
            <button
              disabled={saving}
              onClick={onClear}
              className="px-4 py-3 rounded-2xl bg-rose-600/80 hover:bg-rose-600 text-white font-black border border-rose-500/30 transition"
              title="Remove winner/gols/qualifier"
            >
              LIMPAR RESULTADO
            </button>

            <button
              disabled={saving}
              onClick={onSave}
              className="px-4 py-3 rounded-2xl bg-emerald-600/90 hover:bg-emerald-600 text-white font-black border border-emerald-500/30 transition"
            >
              {saving ? "Salvando..." : "SALVAR"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}