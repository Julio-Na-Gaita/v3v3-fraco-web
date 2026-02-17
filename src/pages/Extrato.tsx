import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { useAuth } from "../lib/auth";
import { fetchUserExtrato, type ExtratoCard } from "../lib/extratoApi";

function toImgSrc(photoBase64?: string) {
  if (!photoBase64) return null;
  if (photoBase64.startsWith("http") || photoBase64.startsWith("data:image")) return photoBase64;
  return `data:image/jpeg;base64,${photoBase64}`;
}

function initials(name: string) {
  return (name || "?")
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

function splitExtrasChips(extraDetail: string | null) {
  if (!extraDetail) return [];
  return extraDetail
    .replace(/^Extras:\s*/i, "")
    .split(/[\+•]/g) // aceita " + " e "•"
    .map((s) => s.replace(/—/g, "").trim())
    .filter(Boolean);
}

function resultTone(item: ExtratoCard) {
  if (item.isNoVote) return "text-zinc-700";
  if (item.resultType.includes("🏆") || item.resultType.includes("✅")) return "text-emerald-700";
  if (item.resultType.includes("❌")) return "text-red-700";
  return "text-zinc-700";
}

export default function Extrato() {
  const { user } = useAuth();
  const [params] = useSearchParams();

  // opcional: /extrato?uid=XXXX (admin/scout)
  const targetUid = params.get("uid") || user?.uid || "";

  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [photoBase64, setPhotoBase64] = useState<string | undefined>(undefined);

  const [cards, setCards] = useState<ExtratoCard[]>([]);
  const [summary, setSummary] = useState({ resultPts: 0, extraPts: 0, totalPts: 0 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!targetUid) return;

    let alive = true;
    setLoading(true);
    setError(null);

    fetchUserExtrato(targetUid)
      .then((p) => {
        if (!alive) return;
        setDisplayName(p.displayName);
        setPhotoBase64(p.photoBase64);
        setCards(p.cards);
        setSummary(p.summary);
      })
      .catch((e: any) => {
        console.error(e);
        if (!alive) return;
        setError(e?.message || "Falha ao carregar extrato.");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [targetUid]);

  const avatarSrc = useMemo(() => toImgSrc(photoBase64), [photoBase64]);

  return (
    <AppLayout>
      <div className="rounded-[var(--v3-radius)] overflow-hidden border border-white/10 bg-white/5 backdrop-blur">
        {/* Header */}
        <div className="p-4" style={{ backgroundColor: "var(--v3-primary)" }}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-black tracking-[0.2em] text-white/90">EXTRATO</div>
              <div className="mt-1 text-xs font-black text-white/70 truncate">
                {displayName ? `Jogador: ${displayName}` : "Carregando jogador..."}
              </div>
            </div>

            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/15 overflow-hidden flex items-center justify-center">
              {avatarSrc ? (
                <img src={avatarSrc} className="w-full h-full object-cover" />
              ) : (
                <div className="text-white font-black">{initials(displayName || "U")}</div>
              )}
            </div>
          </div>

          {/* Summary bar */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-white/10 border border-white/15 px-3 py-2 text-center">
              <div className="text-[10px] font-black tracking-[0.2em] text-white/70">RESULTADO</div>
              <div className="text-white font-black text-lg">{summary.resultPts}</div>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/15 px-3 py-2 text-center">
              <div className="text-[10px] font-black tracking-[0.2em] text-white/70">EXTRAS</div>
              <div className="text-white font-black text-lg">{summary.extraPts}</div>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/15 px-3 py-2 text-center">
              <div className="text-[10px] font-black tracking-[0.2em] text-white/70">TOTAL</div>
              <div className="text-white font-black text-lg">{summary.totalPts}</div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-3">
          {error && (
            <div className="mb-3 rounded-2xl bg-red-500/10 border border-red-500/20 p-3 text-red-100 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-zinc-200 text-sm font-black">Carregando extrato…</div>
          ) : cards.length === 0 ? (
            <div className="text-zinc-200 text-sm font-black">Sem histórico ainda.</div>
          ) : (
            <div className="grid gap-2">
              {cards.map((it) => {
                const chips = splitExtrasChips(it.extraDetail);

                return (
                  <div
                    key={it.key}
                    className="rounded-3xl border border-white/15 bg-white/75 px-3 py-3 text-zinc-900"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-black text-zinc-700">
                        {it.dateStr}
                        {it.streakMedalIcon ? (
                          <span className="ml-2">{it.streakMedalIcon}</span>
                        ) : null}
                      </div>

                      <div className="px-3 py-1 rounded-full bg-black/10 border border-black/10 font-black">
                        {it.totalPts >= 0 ? `+${it.totalPts}` : it.totalPts} pts
                      </div>
                    </div>

                    <div className="mt-1 font-black text-[15px]">{it.matchTitle}</div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {/* Resultado */}
                      <div className="rounded-2xl bg-white/70 border border-black/10 p-3">
                        <div className="text-[10px] font-black tracking-[0.2em] text-zinc-600">
                          RESULTADO
                        </div>

                        <div className={`mt-2 font-black ${resultTone(it)}`}>
                          {it.resultType ? it.resultType : "—"}{" "}
                          <span className="text-zinc-800">
                            {it.resultDetail ? `(${it.resultDetail})` : ""}
                          </span>
                        </div>

                        <div className="mt-1 text-xs font-black text-zinc-700">
                          {it.resultPts >= 0 ? `+${it.resultPts}` : it.resultPts} pts
                        </div>
                      </div>

                      {/* Extras */}
                      <div className="rounded-2xl bg-white/70 border border-black/10 p-3">
                        <div className="text-[10px] font-black tracking-[0.2em] text-zinc-600">
                          EXTRAS
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          {chips.length ? (
                            chips.map((c, idx) => (
                              <span
                                key={`${it.key}-chip-${idx}`}
                                className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-700/20 text-emerald-900 text-xs font-black"
                              >
                                {c}
                              </span>
                            ))
                          ) : (
                            <span className="text-zinc-500 font-bold">—</span>
                          )}
                        </div>

                        <div className="mt-2 text-xs font-black text-zinc-700">
                          {it.extraPts >= 0 ? `+${it.extraPts}` : it.extraPts} pts
                        </div>
                      </div>
                    </div>

                    {/* Observação útil pra “voto errado aparecer” */}
                    {it.resultType.includes("❌") && it.resultDetail.toLowerCase().startsWith("voto:") ? (
                      <div className="mt-2 text-[12px] font-black text-red-800">
                        Voto errado registrado: {it.resultDetail.replace(/^Voto:\s*/i, "")}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
