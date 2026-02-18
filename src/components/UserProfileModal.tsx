import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import ScoutModal from "./ScoutModal";
import CompareGuessesModal from "./CompareGuessesModal";
import { useAuth } from "../lib/auth";



import bgFoto from "../assets/android/bg/bg_dialog_foto.png";
import MedalHistoryModal from "./MedalHistoryModal";
import { fetchUserProfilePayload, type MedalDetail } from "../lib/profileApi";


function toImgSrc(photoBase64?: string) {
  if (!photoBase64) return null;
  if (photoBase64.startsWith("http") || photoBase64.startsWith("data:image")) return photoBase64;
  return `data:image/jpeg;base64,${photoBase64}`;
}

const MEDAL_ORDER = ["👽", "💎", "👑", "🎯", "🦓", "🔥", "🔮", "🎓", "🥬", "👻", "⚓", "🏆"];

const MEDAL_INFO: Record<string, { name: string; desc: string }> = {
  "👽": { name: "ALIEN", desc: "Palpitou 10 acertos seguidos!" },
  "💎": { name: "BÔNUS OITAVAS", desc: "Gabaritou (8/8) nas oitavas (+3 pts)." },
  "👑": { name: "REI DO MÊS", desc: "Campeão isolado do mês." },
  "🎯": { name: "MITO", desc: "Palpitou 5 acertos seguidos." },
  "🦓": { name: "CAÇADOR DE ZEBRAS", desc: "Acertou uma zebra (≤ 20% acertaram)." },
  "🔥": { name: "ON FIRE", desc: "Palpitou 3 acertos seguidos." },
  "🔮": { name: "MÃE DINAH", desc: "Cravou o campeão em uma final." },
  "🎓": { name: "VETERANO", desc: "Conquistou marcos de acertos (a cada 50)." },
  "🥬": { name: "MÃO DE ALFACE", desc: "Status atual: errou 3 palpites seguidos." },
  "👻": { name: "FANTASMA", desc: "Status atual: esqueceu de votar em 3 seguidos." },
  "⚓": { name: "ZONA DE REBAIXAMENTO", desc: "Z-4." },
  "🏆": { name: "TÍTULO", desc: "Campeão de temporada." },
};

function groupMedals(medals: string[]) {
  const counts: Record<string, number> = {};
  for (const m of medals || []) {
    if (!m) continue;
    counts[m] = (counts[m] || 0) + 1;
  }

  const icons = Object.keys(counts);

  icons.sort((a, b) => {
    const ia = MEDAL_ORDER.indexOf(a);
    const ib = MEDAL_ORDER.indexOf(b);
    const sa = ia === -1 ? 999 : ia;
    const sb = ib === -1 ? 999 : ib;
    if (sa !== sb) return sa - sb;
    return a.localeCompare(b);
  });

  return icons.map((icon) => ({ icon, count: counts[icon] }));
}

type Props = {
  userId: string;
  displayName: string;
  photoBase64?: string;
  medals: string[];
  onClose: () => void;
};

export default function UserProfileModal({ userId, displayName, photoBase64, medals, onClose }: Props) {
  const { user } = useAuth();

  const [toast, setToast] = useState<{ title: string; desc: string } | null>(null);
  const [showScout, setShowScout] = useState(false);
  const [showCompare, setShowCompare] = useState(false);


  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(displayName);
  const [photo, setPhoto] = useState(photoBase64);

  const [trophyRoom, setTrophyRoom] = useState<MedalDetail[]>([]);
  const [activeMedals, setActiveMedals] = useState<string[] | null>(null);

  const [selectedMedal, setSelectedMedal] = useState<{
    icon: string;
    title: string;
    desc: string;
    date: string;
  } | null>(null);

  const [historyModal, setHistoryModal] = useState<{
    icon: string;
    title: string;
    items: MedalDetail[];
  } | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const payload = await fetchUserProfilePayload(userId);
        if (!alive) return;

        setName(payload.displayName);
        setPhoto(payload.photoBase64 || photoBase64);

        setActiveMedals(payload.activeMedals);
        setTrophyRoom(payload.trophyRoom);

        setSelectedMedal(null);
        setHistoryModal(null);
      } catch (e) {
        console.error(e);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const medalsToShow = useMemo(() => {
    // prioridade: activeMedals (vem do profileApi com repetição)
    if (activeMedals) return activeMedals;
    return medals || [];
  }, [activeMedals, medals]);

  const img = toImgSrc(photo);
  const grouped = useMemo(() => groupMedals(medalsToShow), [medalsToShow]);


  const ui = (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div className="relative w-full max-w-[560px] rounded-2xl overflow-hidden border border-white/15 shadow-2xl">
        {/* Fundo Android */}
        <img src={bgFoto} alt="" className="absolute inset-0 w-full h-full object-cover" />

        <div className="relative p-4">
          {/* Header (nome + fechar) */}
          <div className="flex items-start justify-between gap-3">
            <div className="text-2xl font-black tracking-wide text-emerald-500 drop-shadow">
              {name}
{loading ? (
  <div className="text-white/60 text-xs font-black mt-1">Carregando conquistas…</div>
) : null}

            </div>

            <button
              onClick={onClose}
              className="rounded-xl bg-white/20 hover:bg-white/30 border border-white/15 p-2"
              title="Fechar"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Foto (moldura dourada) */}
          <div className="mt-3 flex justify-center">
            <div className="rounded-2xl border-[3px] border-yellow-400/90 bg-black/40 p-2 shadow-lg">
              <div className="w-[290px] h-[290px] rounded-2xl overflow-hidden bg-black/30">
                {img ? (
                  <img src={img} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/80 font-black">
                    Sem foto
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Botão Sala de Troféus */}
          <div className="mt-3 flex justify-center">
            <button
              onClick={() => setToast({ title: "SALA DE TROFÉUS", desc: "Clique nas medalhas para ver o que significa cada uma." })}
              className="w-full max-w-[360px] rounded-xl bg-yellow-400 hover:bg-yellow-300 text-zinc-900 font-black py-3 border border-yellow-200 shadow"
            >
              ✨ SALA DE TROFÉUS ✨
            </button>
          </div>

          {/* Medalhas + contadores */}
          <div className="mt-3 flex flex-col items-center">
            <div className="flex flex-wrap justify-center gap-6">
              {grouped.length === 0 ? (
                <div className="text-white/70 font-black">—</div>
              ) : (
                grouped.slice(0, 8).map((m) => (
                  <button
                    key={m.icon}
                    onClick={() => {
  const info = MEDAL_INFO[m.icon];

  const items = (trophyRoom || [])
    .filter((t) => t.icon === m.icon)
    .sort((a, b) => b.ts - a.ts);

  // 2+ -> abre histórico (igual Android)
  if (items.length >= 2) {
    setHistoryModal({
      icon: m.icon,
      title: info?.name || items[0]?.name || "MEDALHA",
      items,
    });
    setSelectedMedal(null);
    return;
  }

  // 1 -> cardzinho escuro (igual Android)
  const one = items[0];

  setSelectedMedal({
    icon: m.icon,
    title: info?.name || one?.name || "MEDALHA",
    desc: one?.desc || info?.desc || "—",
    date: one?.date || "—",
  });

  setHistoryModal(null);
}}

                    className="relative"
                    title={MEDAL_INFO[m.icon]?.name || "Medalha"}
                  >
                    <div className="text-[44px] leading-none drop-shadow">{m.icon}</div>

                    {m.count > 1 && (
                      <div className="absolute -top-2 -right-3 rounded-full bg-red-600 text-white font-black text-[12px] px-2 py-0.5 border border-white/70 shadow">
                        {m.count}x
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>

            <div className="mt-2 text-center text-white/70 text-sm font-black">
              (Toque na medalha para ver detalhes)
            </div>
            {selectedMedal ? (
  <div className="mt-3 flex justify-center">
    <div className="w-full max-w-[420px] rounded-2xl bg-black/55 border border-white/15 px-4 py-4 text-center">
      <div className="text-[42px] leading-none">{selectedMedal.icon}</div>

      <div className="mt-1 font-black text-yellow-300 tracking-wide">
        {selectedMedal.title}
      </div>

      <div className="mt-2 text-white/85 font-black">
        {selectedMedal.desc}
      </div>

      <div className="mt-2 text-white/60 text-sm font-black">
        Conquistado em: {selectedMedal.date}
      </div>
    </div>
  </div>
) : null}

          </div>

          {/* Botões (layout Android) */}
          <div className="mt-4 space-y-3">
            <button
  type="button"
  onClick={() => setShowScout(true)}
  className="w-full rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-black py-3"
>
  📊 VER ESTATÍSTICAS 📊
</button>

<button
  type="button"
  onClick={() => setShowCompare(true)}
  className="w-full rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-black py-3 shadow"
>
  🆚 COMPARAR PALPITES 🆚
</button>



            <button
              onClick={() => setToast({ title: "GERAR CARD INSTAGRAM", desc: "No próximo passo a gente implementa a geração do card." })}
              className="w-full rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-black py-3 border border-pink-200/30"
            >
              📸 GERAR CARD INSTAGRAM 📸
            </button>

            <button
              onClick={onClose}
              className="w-full rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-black py-3"
            >
              FECHAR
            </button>
          </div>

          {/* Toast simples */}
          {toast ? (
            <div className="fixed left-1/2 -translate-x-1/2 bottom-6 z-[1000000]">
              <div className="rounded-2xl bg-zinc-950/90 border border-white/15 shadow-2xl px-4 py-3 w-[min(520px,90vw)]">
                <div className="text-white font-black">{toast.title}</div>
                <div className="text-white/70 text-sm mt-1">{toast.desc}</div>
                <button
                  onClick={() => setToast(null)}
                  className="mt-3 w-full rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-black py-2"
                >
                  OK
                </button>
              </div>
            </div>
          ) : null}
          
          {showScout && (
  <ScoutModal
    userId={userId}
    displayName={displayName}
    onClose={() => setShowScout(false)}
  />
)}
{showCompare && (
  <CompareGuessesModal
    currentUserId={user?.uid || ""}
currentUserName={user?.name || "Você"}
    targetUserId={userId}
    targetUserName={displayName}
    onClose={() => setShowCompare(false)}
  />
)}



          {historyModal ? (
  <MedalHistoryModal
    icon={historyModal.icon}
    title={historyModal.title}
    items={historyModal.items}
    onClose={() => setHistoryModal(null)}
  />
) : null}

        </div>
      </div>
    </div>
  );

  return createPortal(ui, document.body);
}
