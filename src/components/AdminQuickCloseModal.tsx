import type { MatchView } from "../lib/contracts";
import { CheckCircle2, Pencil, ArrowLeft } from "lucide-react";
import { useMemo, useState } from "react";

export default function AdminQuickCloseModal({
  matches,
  onClose,
  onOpenResult,
  onOpenEdit,
}: {
  matches: MatchView[];
  onClose: () => void;
  onOpenResult: (m: MatchView) => void;
  onOpenEdit: (m: MatchView) => void;
}) {
  const [q, setQ] = useState("");

  function isExpired(m: MatchView) {
    return m.deadline ? Date.now() > m.deadline.getTime() : false;
  }
  function hasScore(m: MatchView) {
    return typeof m.goalsA === "number" && typeof m.goalsB === "number";
  }
  function isFinalized(m: MatchView) {
    return !!m.winner || hasScore(m);
  }

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();

    let base = matches
      // ✅ AGUARDANDO = expirado e NÃO finalizado
      .filter((m) => isExpired(m) && !isFinalized(m))
      // ✅ ordena por #ID menor -> maior (como Android/como você pediu antes)
      .sort((a, b) => (a.matchNumber ?? 0) - (b.matchNumber ?? 0));

    if (!s) return base;

    return base.filter((m) => {
      const blob = `${m.matchNumber ?? ""} ${m.competition} ${m.round} ${m.teamA} ${m.teamB}`.toLowerCase();
      return blob.includes(s);
    });
  }, [matches, q]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-4xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden bg-zinc-950/95">
        {/* Cabeçalho */}
        <div className="px-5 py-4 bg-emerald-700/80 border-b border-white/10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-2xl bg-white/15 border border-white/15 flex items-center justify-center hover:bg-white/20 transition"
                title="Voltar"
              >
                <ArrowLeft size={18} className="text-white" />
              </button>

              <div>
                <div className="text-white font-black text-xl">✅ BAIXA RÁPIDA</div>
                <div className="text-white/80 text-xs font-black tracking-wide">
                  Jogos expirados sem resultado • ordenado por #ID
                </div>
              </div>
            </div>

            <div className="text-white font-black text-sm whitespace-nowrap">
              {list.length} itens
            </div>
          </div>
        </div>

        {/* Busca */}
        <div className="p-5">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por time, competição, rodada, #ID..."
            className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-white font-black outline-none"
          />

          {/* Lista */}
          <div className="mt-4 grid gap-3 max-h-[65vh] overflow-auto pr-1">
            {list.map((m) => (
              <div
                key={m.id}
                className="rounded-2xl bg-white/8 border border-white/10 px-4 py-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-white font-black truncate text-base">
                    #{m.matchNumber ?? "?"} &nbsp; {m.teamA} x {m.teamB}
                  </div>

                  <div className="text-white/75 text-sm font-bold truncate">
                    {m.competition} - {m.round}
                  </div>

                  <div className="text-white/60 text-sm font-bold mt-1 truncate">
                    {m.deadlineLabel}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-none">
                  <button
                    onClick={() => onOpenResult(m)}
                    className="w-11 h-11 rounded-2xl bg-emerald-600/80 hover:bg-emerald-600 border border-emerald-500/30 text-white flex items-center justify-center transition"
                    title="Marcar resultado"
                  >
                    <CheckCircle2 size={18} />
                  </button>

                  <button
                    onClick={() => onOpenEdit(m)}
                    className="w-11 h-11 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-white flex items-center justify-center transition"
                    title="Editar confronto"
                  >
                    <Pencil size={18} />
                  </button>
                </div>
              </div>
            ))}

            {list.length === 0 && (
              <div className="rounded-2xl bg-white/6 border border-white/10 px-4 py-6 text-center text-white font-black">
                Nenhum jogo aguardando baixa 🎉
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}