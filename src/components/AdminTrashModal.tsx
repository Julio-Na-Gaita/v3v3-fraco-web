import { useEffect, useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import type { MatchView } from "../lib/contracts";
import { subscribeBinMatches } from "../lib/bolaoApi";
import { deleteTrashedMatchPermanently, restoreMatchFromTrash } from "../lib/adminMatchesApi";

export default function AdminTrashModal({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<MatchView[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeBinMatches(
      (arr) => {
        setList(arr);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  async function onRestore(m: MatchView) {
    if (!confirm(`Restaurar "${m.teamA} x ${m.teamB}"?`)) return;
    try {
      await restoreMatchFromTrash(m.id);
      setToast("✅ Confronto restaurado!");
      setTimeout(() => setToast(null), 1400);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Erro ao restaurar.");
    }
  }

  async function onDelete(m: MatchView) {
    if (!confirm(`APAGAR PERMANENTEMENTE "${m.teamA} x ${m.teamB}"?`)) return;
    try {
      await deleteTrashedMatchPermanently(m.id);
      setToast("🗑️ Apagado permanentemente.");
      setTimeout(() => setToast(null), 1400);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Erro ao apagar.");
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-3xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden bg-white">
        {/* Header */}
        <div className="px-5 py-4 bg-zinc-800">
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
                <div className="text-white font-black text-lg">LIXEIRA (RESTAURAR)</div>
                <div className="text-white/70 text-xs font-bold">
                  Restaurar trará os palpites de volta.
                </div>
              </div>
            </div>

            <div className="text-white font-black text-sm">
              {loading ? "carregando..." : `${list.length} itens`}
            </div>
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div className="mx-5 mt-4 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800">
            {toast}
          </div>
        )}

        {/* Conteúdo */}
        <div className="p-5 max-h-[70vh] overflow-auto">
          {loading ? (
            <div className="text-center text-zinc-500 font-black py-10">Carregando...</div>
          ) : list.length === 0 ? (
            <div className="text-center text-zinc-500 font-black py-10">Lixeira Vazia</div>
          ) : (
            <div className="grid gap-3">
              {list.map((m) => (
                <div
                  key={m.id}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-black text-zinc-900 truncate">
                      {m.teamA} x {m.teamB}
                    </div>
                    <div className="text-xs font-bold text-zinc-500 truncate">
                      {m.competition} • {m.round}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-none">
                    <button
                      onClick={() => onDelete(m)}
                      className="px-3 py-2 rounded-2xl border border-red-200 bg-white text-red-600 font-black hover:bg-red-50 transition inline-flex items-center gap-2"
                      title="Apagar permanente"
                    >
                      <Trash2 size={16} /> APAGAR
                    </button>

                    <button
                      onClick={() => onRestore(m)}
                      className="px-3 py-2 rounded-2xl bg-emerald-700 text-white font-black hover:bg-emerald-800 transition"
                      title="Restaurar"
                    >
                      RESTAURAR
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-5 pt-0">
          <button
            onClick={onClose}
            className="w-full rounded-2xl py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-black transition"
          >
            FECHAR
          </button>
        </div>
      </div>
    </div>
  );
}