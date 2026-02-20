import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import bgAdmin from "../assets/android/bg/bg_painel_admin.jpeg";
import { subscribeMatches } from "../lib/bolaoApi";
import type { MatchView } from "../lib/contracts";
import MatchEditorModal from "./MatchEditorModal";
import MatchResultModal from "./MatchResultModal";
export default function AdminMatchesModal({ onClose }: { onClose: () => void }) {
  const [matches, setMatches] = useState<MatchView[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<MatchView | null>(null);
const [showResult, setShowResult] = useState(false);
const [resultMatch, setResultMatch] = useState<MatchView | null>(null);
  useEffect(() => {
    const unsub = subscribeMatches(
      (list) => {
        setMatches(list);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return matches;

    return matches.filter((m) => {
      const blob = `${m.matchNumber ?? ""} ${m.competition} ${m.round} ${m.teamA} ${m.teamB}`.toLowerCase();
      return blob.includes(s);
    });
  }, [matches, q]);

  function openCreate() {
    setEditorMode("create");
    setEditing(null);
    setShowEditor(true);
  }

  function openEdit(m: MatchView) {
    setEditorMode("edit");
    setEditing(m);
    setShowEditor(true);
  }

function openResult(m: MatchView) {
  setResultMatch(m);
  setShowResult(true);
}
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative w-full max-w-4xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.65), rgba(0,0,0,0.90)), url(${bgAdmin})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-2xl font-black tracking-wide text-zinc-100">🛠️ Painel Admin</div>
              <div className="text-zinc-300 text-sm font-bold mt-1">Criar e editar confrontos (paridade Android)</div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={openCreate}
                className="px-4 py-2 rounded-2xl bg-emerald-600/90 hover:bg-emerald-600 text-white font-black border border-emerald-500/30 transition inline-flex items-center gap-2"
              >
                <Plus size={18} /> NOVO
              </button>

              <button
                onClick={onClose}
                className="px-4 py-2 rounded-2xl bg-white/5 border border-white/10 text-zinc-200 font-black hover:bg-white/10 transition"
              >
                FECHAR
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por time, competição, rodada, #ID..."
              className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-zinc-100 font-black outline-none"
            />
            <div className="text-xs font-black text-zinc-300 whitespace-nowrap">
              {loading ? "carregando..." : `${filtered.length} itens`}
            </div>
          </div>

          <div className="mt-4 grid gap-2 max-h-[65vh] overflow-auto pr-1">
            {filtered.map((m) => (
              <div
                key={m.id}
                className="rounded-2xl bg-white/6 border border-white/10 px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-zinc-100 font-black truncate">
                    #{m.matchNumber ?? "?"} • {m.teamA} x {m.teamB}
                  </div>
                  <div className="text-xs text-zinc-300 font-bold truncate">
                    {m.competition} • {m.round} • {m.deadlineLabel}
                  </div>
                </div>

                <div className="flex items-center gap-2">
  <button
    onClick={() => openResult(m)}
    className="flex-none px-3 py-2 rounded-2xl bg-emerald-600/70 hover:bg-emerald-600 border border-emerald-500/30 text-white font-black transition"
    title="Marcar resultado"
  >
    RESULTADO
  </button>

  <button
    onClick={() => openEdit(m)}
    className="flex-none px-3 py-2 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-zinc-100 font-black transition inline-flex items-center gap-2"
    title="Editar"
  >
    <Pencil size={16} /> EDITAR
  </button>
</div>
              </div>
            ))}

            {!loading && filtered.length === 0 && (
              <div className="rounded-2xl bg-white/6 border border-white/10 px-4 py-6 text-center text-zinc-200 font-black">
                Nenhum confronto encontrado.
              </div>
            )}
          </div>
        </div>
      </div>

      {showEditor && (
        <MatchEditorModal
          mode={editorMode}
          initial={editing}
          onClose={() => setShowEditor(false)}
          onDone={() => {
            setShowEditor(false);
          }}
        />
      )}
      {showResult && resultMatch && (
  <MatchResultModal
    match={resultMatch}
    onClose={() => setShowResult(false)}
    onDone={() => {
      setShowResult(false);
    }}
  />
)}
    </div>
  );
}