import { useMemo, useState } from "react";
import type { MatchView, Vote } from "../lib/contracts";

export default function FastVoteModal({
  matches,
  onClose,
  onVote,
}: {
  matches: MatchView[];
  onClose: () => void;
  onVote: (m: MatchView, v: Vote) => Promise<void>;
}) {
  const [idx, setIdx] = useState(0);
  const [saving, setSaving] = useState(false);

  const list = useMemo(() => matches || [], [matches]);
  const total = list.length;

  const current = list[idx];

  async function vote(v: Vote) {
    if (!current) return;
    setSaving(true);
    try {
      await onVote(current, v);
      setIdx((p) => p + 1);
    } finally {
      setSaving(false);
    }
  }

  function skip() {
    setIdx((p) => p + 1);
  }

  if (total === 0) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950/95 p-5 shadow-2xl">
          <div className="text-xl font-black text-zinc-100">Tudo em dia! 🎉</div>
          <div className="text-zinc-400 text-sm mt-2">
            Você já votou em todos os confrontos disponíveis.
          </div>
          <button
            onClick={onClose}
            className="mt-4 w-full py-3 rounded-2xl bg-white text-zinc-900 font-black hover:bg-zinc-100 transition"
          >
            FECHAR
          </button>
        </div>
      </div>
    );
  }

  if (idx >= total) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950/95 p-5 shadow-2xl">
          <div className="text-xl font-black text-zinc-100">Missão cumprida! 🚀</div>
          <div className="text-zinc-400 text-sm mt-2">
            Você votou rapidamente em {total} confrontos.
          </div>
          <button
            onClick={onClose}
            className="mt-4 w-full py-3 rounded-2xl bg-white text-zinc-900 font-black hover:bg-zinc-100 transition"
          >
            FECHAR
          </button>
        </div>
      </div>
    );
  }

  const progress = Math.round(((idx + 1) / total) * 100);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950/95 p-5 shadow-2xl">
        <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-amber-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="text-zinc-400 text-[11px] font-bold mt-1">
          {idx + 1} de {total}
        </div>

        <div className="mt-4 text-center">
          <div className="text-[12px] font-black text-amber-400">
            {(current.competition || "").toUpperCase()}
          </div>
          <div className="text-[11px] text-zinc-400">{current.round}</div>
        </div>

        <div className="mt-4 grid grid-cols-3 items-center gap-3">
          <div className="text-center">
            {current.teamALogo ? (
              <img src={current.teamALogo} className="mx-auto w-16 h-16 object-contain" />
            ) : null}
            <div className="mt-2 text-zinc-100 font-black text-sm">{current.teamA}</div>
          </div>

          <div className="text-center text-zinc-500 font-black text-2xl">X</div>

          <div className="text-center">
            {current.teamBLogo ? (
              <img src={current.teamBLogo} className="mx-auto w-16 h-16 object-contain" />
            ) : null}
            <div className="mt-2 text-zinc-100 font-black text-sm">{current.teamB}</div>
          </div>
        </div>

        <div className="mt-4 text-center text-zinc-100 font-black">QUEM VENCE?</div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <button
            disabled={saving}
            onClick={() => vote("A")}
            className="h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-500 font-black text-white disabled:opacity-60"
          >
            {current.teamA}
          </button>

          {current.allowDraw ? (
            <button
              disabled={saving}
              onClick={() => vote("EMPATE")}
              className="h-12 rounded-2xl bg-zinc-200 hover:bg-zinc-100 font-black text-zinc-900 disabled:opacity-60"
            >
              EMPATE
            </button>
          ) : (
            <button
              disabled
              className="h-12 rounded-2xl bg-white/5 border border-white/10 font-black text-zinc-500"
              title="Empate não permitido"
            >
              —
            </button>
          )}

          <button
            disabled={saving}
            onClick={() => vote("B")}
            className="h-12 rounded-2xl bg-rose-600 hover:bg-rose-500 font-black text-white disabled:opacity-60"
          >
            {current.teamB}
          </button>
        </div>

        <button
          disabled={saving}
          onClick={skip}
          className="mt-3 w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-zinc-200 font-black hover:bg-white/10 disabled:opacity-60"
        >
          PULAR ESTE CONFRONTO
        </button>

        <button
          onClick={onClose}
          className="mt-2 w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-zinc-200 font-black hover:bg-white/10"
        >
          FECHAR
        </button>
      </div>
    </div>
  );
}
