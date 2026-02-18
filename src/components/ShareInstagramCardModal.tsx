import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { toJpeg } from "html-to-image";

import InstagramCard from "./InstagramCard";
import { fetchRankingPayload, type RankingUserRow } from "../lib/rankingApi";

type Props = {
  targetUserId: string;
  onClose: () => void;
};

export default function ShareInstagramCardModal({ targetUserId, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [ranking, setRanking] = useState<RankingUserRow[]>([]);
  const [targetUser, setTargetUser] = useState<RankingUserRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const payload = await fetchRankingPayload();
        if (!alive) return;

        setRanking(payload.rankingList || []);
        setTargetUser(payload.rankingList.find((u) => u.userId === targetUserId) || null);
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setToast("Não consegui montar o card agora. Tente novamente.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [targetUserId]);

  const ui = (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div className="relative w-full max-w-[520px] rounded-2xl overflow-hidden border border-white/15 shadow-2xl bg-zinc-950">
        {/* header */}
        <div className="p-4 flex items-center justify-between">
          <div>
            <div className="text-white font-black tracking-[0.25em] text-[12px]">PRÉVIA DO CARD</div>
            {loading ? <div className="text-white/70 text-xs font-black mt-1">Gerando prévia…</div> : null}
          </div>

          <button
            onClick={onClose}
            className="rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 p-2"
            title="Fechar"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* corpo */}
        <div className="px-4 pb-4">
          <div className="flex justify-center">
            <div ref={cardRef}>
              {targetUser ? (
                <InstagramCard user={targetUser} rankingList={ranking} />
              ) : (
                <div className="w-[360px] h-[640px] rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center text-white font-black">
                  {loading ? "Carregando…" : "Usuário não encontrado no ranking."}
                </div>
              )}
            </div>
          </div>

          {/* botão compartilhar */}
          <button
            disabled={loading || !targetUser || sharing}
            onClick={async () => {
              if (!cardRef.current) return;

              setSharing(true);
              setToast(null);

              try {
                // ✅ captura com alta qualidade
                const dataUrl = await toJpeg(cardRef.current, {
                  quality: 0.95,
                  pixelRatio: 3,
                  cacheBust: true,
                  backgroundColor: "#000000",
                });

                const blob = await (await fetch(dataUrl)).blob();
                const file = new File([blob], `v3v3-card-${targetUserId}.jpg`, { type: "image/jpeg" });

                const navAny = navigator as any;

                // ✅ Share Sheet (Android/iOS) quando suportado
                if (navAny.share && (!navAny.canShare || navAny.canShare({ files: [file] }))) {
                  await navAny.share({
                    files: [file],
                    title: "V3v3 é Fraco FC",
                    text: "Meu card do V3v3 é Fraco FC 🔥",
                  });
                  return;
                }

                // ✅ fallback: baixa a imagem
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `v3v3-card-${targetUserId}.jpg`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setToast("Seu navegador não suportou compartilhar direto. Baixei o card pra você compartilhar manualmente.");
                setTimeout(() => URL.revokeObjectURL(url), 8000);
              } catch (e) {
                console.error(e);
                setToast("Falha ao gerar/compartilhar o card. Tente novamente.");
              } finally {
                setSharing(false);
              }
            }}
            className={`mt-4 w-full rounded-xl font-black py-4 shadow ${
              loading || !targetUser || sharing
                ? "bg-pink-600/50 text-white/70"
                : "bg-pink-600 hover:bg-pink-500 text-white"
            }`}
          >
            {sharing ? "GERANDO…" : "🔗 COMPARTILHAR"}
          </button>

          {toast ? (
            <div className="mt-3 rounded-xl bg-white/10 border border-white/10 p-3 text-white/85 font-black text-sm">
              {toast}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(ui, document.body);
}
