import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import bgScout from "../assets/android/bg/bg_scout.png"; // reutiliza seu bg premium
import { fetchCompareItems, type ComparisonItem } from "../lib/compareApi";

type Props = {
  currentUserId: string;
  currentUserName: string;
  targetUserId: string;
  targetUserName: string;
  onClose: () => void;
};

function fmtDateTime(d: Date) {
  // 18/02/26 15:00 (igual vibe Android)
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yy} ${hh}:${mi}`;
}

function TeamLogo({ url, fallback }: { url?: string; fallback: string }) {
  if (!url) {
    return (
      <div className="w-9 h-9 rounded-full bg-white/70 border border-white/40 flex items-center justify-center text-[12px] font-black text-zinc-700">
        {fallback.slice(0, 1).toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={url}
      alt=""
      className="w-9 h-9 rounded-full bg-white/80 border border-white/40 object-contain"
      loading="lazy"
    />
  );
}

function isDifferentAfterExpired(item: ComparisonItem) {
  if (!item.isExpired) return false;
  if (item.myVote === "-" || item.rivalVote === "-") return false;
  return item.myVote !== item.rivalVote;
}

function VoteText({ text, muted }: { text: string; muted?: boolean }) {
  const t = text === "-" ? "—" : text;
  return (
    <div className={`text-[15px] font-black ${muted ? "text-zinc-400" : "text-zinc-950"}`}>
      {t}
    </div>
  );
}

export default function CompareGuessesModal({
  currentUserId,
  currentUserName,
  targetUserId,
  targetUserName,
  onClose,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ComparisonItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await fetchCompareItems(currentUserId, targetUserId);
        if (!alive) return;
        setItems(list);
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setError("Não consegui carregar o Tira-Teima agora.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [currentUserId, targetUserId]);

  const headerTitle = "TIRA-TEIMA";
  const headerSubtitle = `${currentUserName} x ${targetUserName}`;

  const ui = (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div className="relative w-full max-w-[720px] rounded-2xl overflow-hidden border border-white/15 shadow-2xl">
        {/* fundo */}
        <img src={bgScout} alt="" className="absolute inset-0 w-full h-full object-cover" />

        <div className="relative max-h-[90vh] overflow-y-auto overscroll-contain">
          {/* Header verde (igual print Android) */}
          <div className="relative bg-emerald-800 text-white px-4 py-4">
            <div className="text-center">
              <div className="text-[22px] font-black tracking-[0.25em]">{headerTitle}</div>
              <div className="mt-1 text-[18px] font-black">{headerSubtitle}</div>
            </div>

            <button
              onClick={onClose}
              className="absolute right-3 top-3 w-9 h-9 rounded-full bg-white/90 hover:bg-white border border-white/60 flex items-center justify-center"
              title="Fechar"
            >
              <X className="w-5 h-5 text-zinc-800" />
            </button>
          </div>

          {/* Conteúdo */}
          <div className="px-3 py-3">
            {loading ? (
              <div className="rounded-2xl bg-white/90 border border-white/20 shadow-xl px-4 py-6 text-center font-black text-zinc-700">
                Carregando…
              </div>
            ) : error ? (
              <div className="rounded-2xl bg-white/90 border border-white/20 shadow-xl px-4 py-6 text-center font-black text-red-700">
                {error}
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-2xl bg-white/90 border border-white/20 shadow-xl px-4 py-6 text-center font-black text-zinc-700">
                Nada para comparar ainda.
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((it) => {
                  const diff = isDifferentAfterExpired(it);

                  // rival em sigilo antes do prazo, se tiver voto
                  const rivalShown =
                    it.isExpired ? it.rivalVote : it.rivalVote === "-" ? "-" : "Sigilo";

                  return (
                    <div
                      key={it.match.id}
                      className={`rounded-2xl overflow-hidden border shadow-xl ${
                        diff
                          ? "bg-rose-50 border-rose-200"
                          : "bg-white/95 border-white/20"
                      }`}
                    >
                      {/* Top: data + confronto */}
                      <div className="px-4 pt-3 pb-2">
                        <div className="text-center text-[12px] font-black text-zinc-500">
                          {fmtDateTime(it.match.deadline)}
                        </div>

                        <div className="mt-2 flex items-center justify-center gap-3">
                          <TeamLogo url={it.match.teamAUrl} fallback={it.match.teamA} />
                          <div className="text-[16px] font-black text-zinc-900">
                            {it.match.teamA} <span className="text-zinc-400">x</span> {it.match.teamB}
                          </div>
                          <TeamLogo url={it.match.teamBUrl} fallback={it.match.teamB} />
                        </div>

                        {it.match.winner ? (
                          <div className="mt-1 text-center text-[13px] font-black text-emerald-700">
                            Vencedor: {it.match.winner}
                          </div>
                        ) : (
                          <div className="mt-1 text-center text-[13px] font-black text-zinc-400">
                            —
                          </div>
                        )}
                      </div>

                      <div className="h-px bg-zinc-200/80" />

                      {/* Bottom: votos lado a lado */}
                      <div className="px-4 py-3">
                        <div className="grid grid-cols-3 items-center">
                          <div className="text-center">
                            <div className="text-[12px] font-black text-zinc-400">Você</div>
                            <div className="mt-1">
                              <VoteText text={it.myVote} muted={it.myVote === "-"} />
                            </div>
                          </div>

                          <div className="flex items-center justify-center">
                            <div className="w-7 h-7 rounded bg-orange-500 text-white font-black text-[12px] flex items-center justify-center shadow">
                              VS
                            </div>
                          </div>

                          <div className="text-center">
                            <div className="text-[12px] font-black text-zinc-400">{targetUserName}</div>
                            <div className="mt-1">
                              <VoteText text={rivalShown} muted={rivalShown === "-" || rivalShown === "Sigilo"} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer verde com FECHAR */}
          <div className="px-3 pb-3">
            <button
              onClick={onClose}
              className="w-full rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-black py-4 shadow"
            >
              FECHAR
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(ui, document.body);
}
