import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { MedalDetail } from "../lib/profileApi";

type Props = {
  icon: string;
  title: string;
  items: MedalDetail[];
  onClose: () => void;
};

export default function MedalHistoryModal({ icon, title, items, onClose }: Props) {
  const ui = (
    <div className="fixed inset-0 z-[1000000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-[520px] rounded-3xl overflow-hidden border border-white/15 shadow-2xl bg-zinc-200/90">
        <div className="p-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[42px] leading-none">{icon}</div>
            <div className="mt-1 font-black text-zinc-900">{title}</div>
            <div className="text-sm font-black text-zinc-700">Histórico de Conquistas</div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl bg-white/50 hover:bg-white/70 border border-black/10 p-2"
            title="Fechar"
          >
            <X className="w-5 h-5 text-zinc-800" />
          </button>
        </div>

        <div className="px-4 pb-4">
          <div className="rounded-2xl bg-white/80 border border-black/10 p-3 max-h-[55vh] overflow-auto space-y-3">
            {items.map((it, idx) => (
              <div key={`${it.icon}-${idx}-${it.ts}`} className="rounded-2xl bg-white border border-black/10 p-3">
                <div className="font-black text-zinc-900">{it.desc}</div>
                <div className="mt-2 text-sm font-black text-orange-700">
                  🗓️ Conquistado em: {it.date}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={onClose}
            className="mt-4 w-full rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-black py-3"
          >
            FECHAR
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(ui, document.body);
}
