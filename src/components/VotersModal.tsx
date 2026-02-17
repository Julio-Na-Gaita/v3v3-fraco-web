import { useEffect, useMemo, useState } from "react";
import type { MatchView } from "../lib/contracts";
import { fetchVotersForMatch, type VoterRow } from "../lib/bolaoApi";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "?";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase();
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="w-9 h-9 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-zinc-100 font-black">
      {initials(name)}
    </div>
  );
}

export default function VotersModal({
  match,
  onClose,
}: {
  match: MatchView;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<0 | 1>(0);
  const [loading, setLoading] = useState(true);
  const [voters, setVoters] = useState<VoterRow[]>([]);
  const [missing, setMissing] = useState<VoterRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isExpired = useMemo(() => {
    const t = match.deadline?.getTime();
    return !!t && Date.now() > t;
  }, [match.deadline]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchVotersForMatch(match.id, match.deadline);
        if (!alive) return;
        setVoters(res.voters);
        setMissing(res.missing);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Falha ao carregar votantes.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [match.id, match.deadline]);

  const list = tab === 0 ? voters : missing;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950/95 p-5 shadow-2xl">
        <div className="text-xl font-black tracking-wide text-zinc-100">
          {isExpired ? "Palpites Registrados" : "Quem já votou?"}
        </div>

        {!isExpired && (
          <div className="text-zinc-400 text-sm mt-1">
            Os palpites são revelados após o prazo.
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setTab(0)}
            className={`flex-1 py-2 rounded-2xl border font-black text-sm transition ${
              tab === 0
                ? "bg-white text-zinc-900 border-white"
                : "bg-white/5 text-zinc-200 border-white/10 hover:bg-white/10"
            }`}
          >
            VOTARAM ({voters.length})
          </button>

          <button
            onClick={() => setTab(1)}
            className={`flex-1 py-2 rounded-2xl border font-black text-sm transition ${
              tab === 1
                ? "bg-yellow-500/25 text-yellow-100 border-yellow-500/30"
                : "bg-white/5 text-zinc-200 border-white/10 hover:bg-white/10"
            }`}
          >
            {isExpired ? `NÃO VOTARAM (${missing.length})` : `PENDENTES (${missing.length})`}
          </button>
        </div>

        <div className="mt-4">
          {loading && (
            <div className="text-zinc-300 text-sm">Carregando…</div>
          )}

          {error && (
            <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-3 text-red-100 text-sm">
              {error}
            </div>
          )}

          {!loading && !error && (
            <div className="max-h-[420px] overflow-auto pr-1">
              {list.length === 0 ? (
                <div className="text-zinc-400 text-sm py-6 text-center">
                  {tab === 0 ? "Ninguém votou ainda." : "Todos votaram! 🔥"}
                </div>
              ) : (
                <div className="grid gap-2">
                  {list.map((u) => (
                    <div
                      key={u.userId}
                      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"
                    >
                      <Avatar name={u.displayName} />

                      <div className="flex-1 min-w-0">
                        <div className="text-zinc-100 font-black truncate">
                          {u.displayName}
                        </div>

                        {/* Só revela voto quando expirado e na aba VOTARAM */}
                        {tab === 0 && isExpired && (
                          <div className="text-xs text-zinc-300 mt-1">
                            Voto:{" "}
                            <span className="font-black text-white">
                              {u.teamVoted || "—"}
                            </span>
                          </div>
                        )}
                      </div>

                      {tab === 0 && !!match.winner && isExpired && (
                        <div
                          className={`text-xs font-black px-2 py-1 rounded-xl border ${
                            (u.teamVoted || "").trim() === (match.winner || "").trim()
                              ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-100"
                              : "bg-red-500/10 border-red-500/20 text-red-100"
                          }`}
                        >
                          {(u.teamVoted || "").trim() === (match.winner || "").trim()
                            ? "ACERTOU"
                            : "ERROU"}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-zinc-200 font-black hover:bg-white/10 transition"
        >
          FECHAR
        </button>
      </div>
    </div>
  );
}
