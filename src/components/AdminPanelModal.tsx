import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  CheckCircle2,
  Users,
  Bell,
  MessageCircle,
  ClipboardList,
  Trophy,
  Settings,
  BarChart3,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import AdminTrashModal from "./AdminTrashModal";
import { softDeleteMatch } from "../lib/adminMatchesApi";
import { subscribeMatches } from "../lib/bolaoApi";
import type { MatchView } from "../lib/contracts";
import AdminQuickCloseModal from "./AdminQuickCloseModal";
import MatchEditorModal from "./MatchEditorModal";
import MatchResultModal from "./MatchResultModal";

// ✅ Se você já tiver um bg igual do Android, pode importar aqui.
// Se não tiver, pode remover o import e manter só o gradiente.
// import bgAdmin from "../assets/android/bg/bg_painel_admin.jpeg";

function AdminTile({
  icon: Icon,
  title,
  className,
  onClick,
  full = false,
}: {
  icon: any;
  title: string;
  className: string;
  onClick: () => void;
  full?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-2xl px-4 py-4 font-black text-white shadow-lg",
        "flex items-center justify-center gap-3",
        "active:scale-[0.99] transition",
        full ? "col-span-2" : "",
        className,
      ].join(" ")}
    >
      <Icon size={20} />
      <span className="text-sm">{title}</span>
    </button>
  );
}

type Tab = "ABERTOS" | "AGUARDANDO" | "FINALIZADOS";

export default function AdminPanelModal({ onClose }: { onClose: () => void }) {
  const [matches, setMatches] = useState<MatchView[]>([]);
  const [loading, setLoading] = useState(true);
const [showTrash, setShowTrash] = useState(false);
  const [tab, setTab] = useState<Tab>("ABERTOS");
  const [q, setQ] = useState("");
const [showQuickClose, setShowQuickClose] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<MatchView | null>(null);

  const [showResult, setShowResult] = useState(false);
  const [resultMatch, setResultMatch] = useState<MatchView | null>(null);

  const [toast, setToast] = useState<string | null>(null);

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

  function isExpired(m: MatchView) {
    return m.deadline ? Date.now() > m.deadline.getTime() : false;
  }
  function hasScore(m: MatchView) {
    return typeof m.goalsA === "number" && typeof m.goalsB === "number";
  }
  function isFinalized(m: MatchView) {
    return !!m.winner || hasScore(m);
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();

    // 1) filtra por aba
    let base = matches.filter((m) => {
      const exp = isExpired(m);
      const fin = isFinalized(m);

      if (tab === "ABERTOS") return !exp;
      if (tab === "AGUARDANDO") return exp && !fin;
      return exp && fin; // FINALIZADOS
    });

    // 2) ordena por #ID
// - Abertos/Aguardando: menor -> maior
// - Finalizados: maior -> menor (como você pediu)
base = base.sort((a, b) => {
  const an = a.matchNumber ?? 0;
  const bn = b.matchNumber ?? 0;
  return tab === "FINALIZADOS" ? bn - an : an - bn;
});

    // 3) busca
    if (!s) return base;
    return base.filter((m) => {
      const blob = `${m.matchNumber ?? ""} ${m.competition} ${m.round} ${m.teamA} ${m.teamB}`.toLowerCase();
      return blob.includes(s);
    });
  }, [matches, q, tab]);

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

  function soon(feature: string) {
    setToast(`⚠️ Em breve: ${feature}`);
    setTimeout(() => setToast(null), 1800);
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative w-full max-w-[980px] h-[92vh] rounded-3xl border border-white/10 shadow-2xl overflow-hidden"
        style={{
          // ✅ mantém premium mesmo sem imagem
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.30), rgba(0,0,0,0.92))",
          // Se você for usar imagem:
          // backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.30), rgba(0,0,0,0.92)), url(${bgAdmin})`,
          // backgroundSize: "cover",
          // backgroundPosition: "center",
        }}
      >
        {/* Cabeçalho roxo (como app) */}
        <div className="px-5 py-4 bg-[color:var(--v3-primary)]/90 border-b border-white/10">
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
                <div className="text-white font-black text-xl">PAINEL DO ADMIN</div>
                <div className="text-white/80 text-xs font-black tracking-wide">
                  Central de Comando 2026
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="px-4 py-2 rounded-2xl bg-white/15 border border-white/15 text-white font-black hover:bg-white/20 transition"
            >
              FECHAR
            </button>
          </div>
        </div>

        {/* Conteúdo scroll */}
        <div className="p-5 overflow-auto h-[calc(92vh-80px)]">
          {toast && (
            <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-black text-amber-100">
              {toast}
            </div>
          )}

          {/* GESTÃO DE CONFRONTOS */}
          <div className="text-white/70 font-black tracking-wide text-sm flex items-center gap-2 mb-2">
            <ClipboardList size={16} /> GESTÃO DE CONFRONTOS
          </div>

          <div className="grid grid-cols-2 gap-3">
            <AdminTile icon={Plus} title="Novo Confronto" className="bg-blue-600/90" onClick={openCreate} />
            <AdminTile icon={Trash2} title="Lixeira" className="bg-zinc-700/90" onClick={() => setShowTrash(true)} />

            <AdminTile
  icon={CheckCircle2}
  title="Baixa Rápida"
  className="bg-emerald-700/90"
  onClick={() => setShowQuickClose(true)}
/>
            <AdminTile icon={Trash2} title="Limpar Finalizados" className="bg-red-600/90" onClick={() => soon("Limpar finalizados")} />

            <AdminTile icon={ClipboardList} title="Rodadas" className="bg-amber-800/90" onClick={() => soon("Rodadas")} />
            <AdminTile icon={Trophy} title="Competições" className="bg-yellow-500/90 text-zinc-900" onClick={() => soon("Competições")} />
          </div>

          {/* USUÁRIOS */}
          <div className="mt-6 text-white/70 font-black tracking-wide text-sm flex items-center gap-2 mb-2">
            <Users size={16} /> USUÁRIOS
          </div>

          <div className="grid grid-cols-2 gap-3">
            <AdminTile icon={Users} title="Gerenciar Usuários" className="bg-blue-600/90" onClick={() => soon("Gerenciar usuários")} full />
          </div>

          {/* COMUNICAÇÃO & FERRAMENTAS */}
          <div className="mt-6 text-white/70 font-black tracking-wide text-sm flex items-center gap-2 mb-2">
            <Sparkles size={16} /> COMUNICAÇÃO & FERRAMENTAS
          </div>

          <div className="grid grid-cols-2 gap-3">
            <AdminTile icon={Bell} title="Enviar Push" className="bg-purple-700/90" onClick={() => soon("Enviar push")} />
            <AdminTile icon={MessageCircle} title="Avisar Whats" className="bg-emerald-500/90" onClick={() => soon("Avisar Whats")} />

            <AdminTile icon={Pencil} title="Editar Letreiro" className="bg-orange-600/90" onClick={() => soon("Editar letreiro")} />
            <AdminTile icon={Sparkles} title="Visual (Banners/Enq)" className="bg-teal-600/90" onClick={() => soon("Visual banners/enquetes")} />

            <AdminTile icon={Settings} title="Config Remota" className="bg-zinc-900/90" onClick={() => soon("Config remota")} />
            <AdminTile icon={BarChart3} title="Resumo Rodada" className="bg-pink-600/90" onClick={() => soon("Resumo rodada")} />

            <AdminTile icon={Trophy} title="CONSOLIDAR RANKING (Remover 'NOVO')" className="bg-emerald-800/90" onClick={() => soon("Consolidar ranking")} full />
          </div>

          {/* LISTA DE JOGOS CADASTRADOS */}
          <div className="mt-8 text-white/70 font-black tracking-wide text-sm flex items-center gap-2 mb-2">
            📋 LISTA DE JOGOS CADASTRADOS
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl p-2">
            {(["ABERTOS", "AGUARDANDO", "FINALIZADOS"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={[
                  "px-4 py-2 rounded-2xl font-black text-sm transition",
                  tab === t ? "bg-white text-zinc-900" : "bg-transparent text-white/70 hover:bg-white/10",
                ].join(" ")}
              >
                {t === "ABERTOS" ? "Abertos" : t === "AGUARDANDO" ? "Aguardando" : "Finalizados"}
              </button>
            ))}

            <div className="ml-auto text-xs font-black text-white/70 pr-2">
              {loading ? "carregando..." : `${filtered.length} itens`}
            </div>
          </div>

          {/* Busca */}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por time, competição, rodada, #ID..."
            className="mt-3 w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-white font-black outline-none"
          />

          {/* Lista */}
          <div className="mt-3 grid gap-3 pb-6">
            {filtered.map((m) => {
              const exp = isExpired(m);
              const fin = isFinalized(m);

              const status = !exp ? "Em aberto" : fin ? "Finalizado" : "Aguardando";
              const placar = hasScore(m) ? `${m.goalsA} x ${m.goalsB}` : "—";

              return (
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

                    <div className="text-white/65 text-sm font-bold mt-1">
                      {status} <span className="text-white/40">•</span> Placar: {placar}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-none">
                    {/* ✅ Resultado */}
                    <button
                      onClick={() => openResult(m)}
                      className="w-11 h-11 rounded-2xl bg-emerald-600/80 hover:bg-emerald-600 border border-emerald-500/30 text-white flex items-center justify-center transition"
                      title="Resultado"
                    >
                      <CheckCircle2 size={18} />
                    </button>

                    {/* ✏️ Editar */}
                    <button
                      onClick={() => openEdit(m)}
                      className="w-11 h-11 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-white flex items-center justify-center transition"
                      title="Editar"
                    >
                      <Pencil size={18} />
                    </button>

                    {/* 🗑️ Lixeira (em breve) */}
                    <button
                      onClick={async () => {
  if (!confirm(`Mover para lixeira "${m.teamA} x ${m.teamB}"?`)) return;
  try {
    await softDeleteMatch(m.id);
    setToast("🗑️ Movido para lixeira.");
    setTimeout(() => setToast(null), 1400);
  } catch (e: any) {
    console.error(e);
    alert(e?.message ?? "Erro ao mover para lixeira (rules/permissões).");
  }
}}
                      className="w-11 h-11 rounded-2xl bg-red-600/70 hover:bg-red-600 border border-red-500/30 text-white flex items-center justify-center transition"
                      title="Lixeira"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              );
            })}

            {!loading && filtered.length === 0 && (
              <div className="rounded-2xl bg-white/6 border border-white/10 px-4 py-6 text-center text-white font-black">
                Nenhum confronto encontrado.
              </div>
            )}
          </div>
        </div>

        {/* Modais já existentes */}
        {showEditor && (
          <MatchEditorModal
            mode={editorMode}
            initial={editing}
            onClose={() => setShowEditor(false)}
            onDone={() => setShowEditor(false)}
          />
        )}
{showQuickClose && (
  <AdminQuickCloseModal
    matches={matches}
    onClose={() => setShowQuickClose(false)}
    onOpenResult={(m) => {
      setResultMatch(m);
      setShowResult(true);
    }}
    onOpenEdit={(m) => {
      setEditorMode("edit");
      setEditing(m);
      setShowEditor(true);
    }}
  />
)}
{showTrash && <AdminTrashModal onClose={() => setShowTrash(false)} />}
        {showResult && resultMatch && (
          <MatchResultModal
            match={resultMatch}
            onClose={() => setShowResult(false)}
            onDone={() => setShowResult(false)}
          />
        )}
      </div>
    </div>
  );
}