import { useEffect, useMemo, useRef, useState } from "react";
import type { MatchView } from "../lib/contracts";
import { addComment, subscribeComments, type CommentRow } from "../lib/bolaoApi";
import { useAuth } from "../lib/auth";

function fmt(dt: Date) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(dt);
  } catch {
    return "";
  }
}

export default function CommentsModal({
  match,
  onClose,
}: {
  match: MatchView;
  onClose: () => void;
}) {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<CommentRow[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => {
    return !!user?.uid && text.trim().length > 0 && !sending;
  }, [user?.uid, text, sending]);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsub = subscribeComments(
      match.id,
      (rows) => {
        setList(rows);
        setLoading(false);
        // autoscroll
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      },
      (err: any) => {
        console.error(err);
        setError(err?.message || "Falha ao carregar comentários.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [match.id]);

  async function handleSend() {
    if (!user?.uid) return;
    const msg = text.trim();
    if (!msg) return;

    setSending(true);
    setError(null);

    try {
      await addComment({
        matchId: match.id,
        userId: user.uid,
        userName: user.name || user.username || "Usuário",
        text: msg,
      });
      setText("");
    } catch (e: any) {
      setError(e?.message || "Falha ao enviar comentário.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950/95 p-5 shadow-2xl">
        <div className="text-xl font-black tracking-wide text-zinc-100">💬 Resenha</div>
        <div className="text-zinc-400 text-sm mt-1">
          #{match.matchNumber ?? "?"} • {match.teamA} x {match.teamB}
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 max-h-[420px] overflow-auto">
          {loading && <div className="text-zinc-300 text-sm">Carregando…</div>}

          {error && (
            <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-3 text-red-100 text-sm">
              {error}
            </div>
          )}

          {!loading && !error && list.length === 0 && (
            <div className="text-zinc-400 text-sm py-6 text-center">
              Ainda não tem comentários.
            </div>
          )}

          <div className="grid gap-2">
            {list.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-white/10 bg-black/15 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-zinc-100 font-black text-sm truncate">
                    {c.userName}
                  </div>
                  <div className="text-zinc-500 text-xs font-bold">{fmt(c.createdAt)}</div>
                </div>
                <div className="text-zinc-200 text-sm mt-2 whitespace-pre-wrap">
                  {c.text}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="flex-1 rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-zinc-100 outline-none"
            placeholder="Escreva um comentário..."
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
          />
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="px-5 rounded-2xl bg-white text-zinc-900 font-black hover:bg-zinc-100 transition disabled:opacity-50"
          >
            {sending ? "..." : "ENVIAR"}
          </button>
        </div>

        <button
          onClick={onClose}
          className="mt-3 w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-zinc-200 font-black hover:bg-white/10 transition"
        >
          FECHAR
        </button>
      </div>
    </div>
  );
}
