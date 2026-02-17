import { useEffect, useMemo, useState } from "react";
import AppLayout from "../components/AppLayout";
import { Crown, Info, RefreshCw, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { fetchRankingPayload, type RankingUserRow, type MonthlyRankingRow } from "../lib/rankingApi";
import ExtratoModal from "../components/ExtratoModal";
import UserProfileModal from "../components/UserProfileModal";

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

function Modal({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950/95 p-5 shadow-2xl">
        <div className="text-xl font-black tracking-wide text-zinc-100">{title}</div>
        {subtitle && <div className="text-zinc-400 text-sm mt-1 whitespace-pre-line">{subtitle}</div>}

        <div className="mt-4">{children}</div>

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-black text-zinc-100 hover:bg-white/10 transition"
        >
          FECHAR
        </button>
      </div>
    </div>
  );
}

export default function Ranking() {
  const [loading, setLoading] = useState(true);
  const [ranking, setRanking] = useState<RankingUserRow[]>([]);
  const [monthly, setMonthly] = useState<MonthlyRankingRow[]>([]);
  const [lastUpdateInfo, setLastUpdateInfo] = useState("Carregando...");
  const [error, setError] = useState<string | null>(null);

  const [showInfo, setShowInfo] = useState(false);
  const [showKing, setShowKing] = useState(false);

  const [profileTarget, setProfileTarget] = useState<RankingUserRow | null>(null);

const [extratoTarget, setExtratoTarget] = useState<{
  userId: string;
  displayName: string;
} | null>(null);




  async function load() {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchRankingPayload();
      setRanking(payload.rankingList);
      setMonthly(payload.monthlyRankingList);
      setLastUpdateInfo(payload.lastUpdateInfo);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Falha ao carregar ranking.");
    } finally {
      setLoading(false);
    }
  }

  // ✅ Igual Android: refaz quando o admin mexe (settings/app_state)
  useEffect(() => {
    load();

    const ref = doc(db, "settings", "app_state");
    const unsub = onSnapshot(ref, () => load());

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const monthLabel = useMemo(() => {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
    return fmt.format(now);
  }, []);

  return (
    <AppLayout>
      <div className="rounded-[var(--v3-radius)] overflow-hidden border border-white/10 bg-white/5 backdrop-blur">
        {/* Header premium */}
        <div
          className="p-4"
          style={{
            backgroundColor: "var(--v3-primary)",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-black tracking-[0.2em] text-white/90">CLASSIFICAÇÃO</div>
              <div className="text-xs font-black text-white/70 mt-1">Temporada 2026 • Web pareada com Android</div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowKing(true)}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 flex items-center justify-center"
                title="Rei do mês"
              >
                <Crown className="w-5 h-5 text-[color:var(--v3-secondary)]" />
              </button>

              <button
                onClick={() => setShowInfo(true)}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 flex items-center justify-center"
                title="Info"
              >
                <Info className="w-5 h-5 text-white" />
              </button>

              <button
                onClick={load}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 flex items-center justify-center"
                title="Atualizar"
              >
                <RefreshCw className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] font-black text-white/80">
            <div className="text-center">POS</div>
            <div>PARTICIPANTE</div>
            <div className="text-center">PTS</div>
          </div>
        </div>

        {/* Body */}
        <div className="p-3">
          {error && (
            <div className="mb-3 rounded-2xl bg-red-500/10 border border-red-500/20 p-3 text-red-100 text-sm">
              {error}
            </div>
          )}

          {loading && ranking.length === 0 ? (
            <div className="text-zinc-200 text-sm font-black">Carregando ranking…</div>
          ) : (
            <div className="grid gap-1">
              {ranking.map((u, idx) => {
                const pos = idx + 1;
                const isPodium = idx < 3;
                const isPrize = idx === 3 || idx === 4;
                const isRelegation = ranking.length > 4 && idx >= ranking.length - 4;

                const bg =
                  idx === 0
                    ? "bg-yellow-100/80"
                    : idx === 1
                    ? "bg-zinc-200/80"
                    : idx === 2
                    ? "bg-orange-200/80"
                    : isPrize
                    ? "bg-emerald-100/80"
                    : isRelegation
                    ? "bg-red-100/80"
                    : "bg-white/70";

                const border =
                  isPodium || isPrize
                    ? "border-white/30"
                    : "border-white/15";

                const img = toImgSrc(u.photoBase64);

                // setinhas (igual Android: compara lastRank)
                const lastRank = Number(u.lastRank || 0);
                const arrow =
                  lastRank > 0 && lastRank !== pos
                    ? pos < lastRank
                      ? "up"
                      : "down"
                    : "same";

                const delta = lastRank > 0 ? Math.abs(pos - lastRank) : 0;

                return (
                  <div
                    key={u.userId}
                    className={[
                      "rounded-2xl border px-3 py-2 flex items-center gap-3",
                      bg,
                      border,
                    ].join(" ")}
                  >
                    {/* POS + arrow */}
                    <div className="w-12 flex flex-col items-center justify-center leading-none">
                      <div className="text-sm font-black text-zinc-900">
                        {isPodium ? (idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉") : `${pos}º`}
                      </div>

                      <div className="mt-1 text-[10px] font-black text-zinc-700 flex items-center gap-1">
                        {lastRank <= 0 ? (
                          <Minus className="w-3 h-3" />
                        ) : arrow === "up" ? (
                          <>
                            <ArrowUp className="w-3 h-3" /> {delta}
                          </>
                        ) : arrow === "down" ? (
                          <>
                            <ArrowDown className="w-3 h-3" /> {delta}
                          </>
                        ) : (
                          <Minus className="w-3 h-3" />
                        )}
                      </div>
                    </div>

                    {/* Avatar + Nome + medals */}
                    <div
  className="flex-1 min-w-0 flex items-center gap-3 cursor-pointer"
  role="button"
  tabIndex={0}
  onClick={() => setProfileTarget(u)}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") setProfileTarget(u);
  }}
  title="Ver perfil"
>
  <div className="w-10 h-10 rounded-2xl bg-black/20 border border-black/10 overflow-hidden flex items-center justify-center">
                        {img ? (
                          <img src={img} className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-zinc-900 font-black">{initials(u.displayName)}</div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="truncate font-black text-zinc-900">{u.displayName}</div>

                        {/* medals (compacto) — com contador em cima (igual Android) */}
<div className="mt-0.5 text-[12px] leading-none">
  {u.medals?.length ? (
    (() => {
      const order = ["👽", "💎", "👑", "🎯", "🦓", "🔥", "🔮", "🎓", "🥬", "👻", "⚓", "🏆"];
      const counts: Record<string, number> = {};
      for (const m of u.medals) counts[m] = (counts[m] || 0) + 1;

      const icons = Object.keys(counts).sort((a, b) => {
        const ia = order.indexOf(a);
        const ib = order.indexOf(b);
        const sa = ia === -1 ? 999 : ia;
        const sb = ib === -1 ? 999 : ib;
        if (sa !== sb) return sa - sb;
        return a.localeCompare(b);
      });

      const shown = icons.slice(0, 8);
      const more = icons.length - shown.length;

      return (
        <div className="flex flex-wrap items-center gap-1 text-zinc-800">
          {shown.map((icon) => (
            <span key={icon} className="relative inline-flex items-center justify-center leading-none">
              <span className="text-[14px]">{icon}</span>
              {counts[icon] > 1 ? (
                <span className="absolute -top-1 -right-1 text-[9px] font-black text-zinc-600">
                  {counts[icon]}
                </span>
              ) : null}
            </span>
          ))}
          {more > 0 ? <span className="text-[11px] font-black text-zinc-700">+{more}</span> : null}
        </div>
      );
    })()
  ) : (
    <span className="text-zinc-500 font-bold">—</span>
  )}
</div>

                      </div>
                    </div>

                    {/* PTS (clicável -> abre extrato, igual Android) */}
<div className="w-14 flex items-center justify-center">
  <button
    type="button"
    onClick={() =>
      setExtratoTarget({
        userId: u.userId,
        displayName: u.displayName,
      })
    }
    className="px-3 py-1 rounded-full bg-black/10 border border-black/10 text-zinc-900 font-black hover:bg-black/15 active:scale-[0.98] transition"
    title="Ver extrato"
  >
    {u.points}
  </button>
</div>

                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-3 text-xs text-white/70 whitespace-pre-line">
            Última atualização: <span className="font-black">{lastUpdateInfo}</span>
          </div>
        </div>
      </div>

      {/* Modais */}
      {showInfo && (
        <Modal
          title="ℹ️ Atualização do Ranking"
          subtitle={lastUpdateInfo}
          onClose={() => setShowInfo(false)}
        >
          <div className="text-sm text-zinc-200">
            Este ranking recalcula pontos e extras igual Android:
            <ul className="list-disc ml-5 mt-2 text-zinc-300">
              <li>✅ 3 pts por acerto (6 pts em Final)</li>
              <li>✅ Extras: Over 2.5 / Ambas marcam / Classificado (+1 cada)</li>
              <li>✅ Bônus Oitavas 8/8 (+3 e 💎)</li>
              <li>✅ Tie-break por medalhas (👽 💎 👑 🎯 🦓 🔥 🔮 🎓)</li>
              <li>✅ Setinhas por lastRank (subiu/desceu)</li>
            </ul>
          </div>
        </Modal>
      )}

      {showKing && (
        <Modal
          title="👑 Rei do mês"
          subtitle={`Ranking mensal • ${monthLabel}`}
          onClose={() => setShowKing(false)}
        >
          {monthly.length === 0 ? (
            <div className="text-zinc-300 text-sm">Sem dados ainda.</div>
          ) : (
            <div className="grid gap-2">
              {monthly.slice(0, 15).map((u, idx) => (
                <div
                  key={u.userId}
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 text-center font-black text-zinc-100">
                      {idx === 0 ? "👑" : `${idx + 1}º`}
                    </div>
                    <div className="truncate font-black text-zinc-100">{u.displayName}</div>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-white/10 border border-white/10 text-zinc-100 font-black">
                    {u.points}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
      {extratoTarget && (
  <ExtratoModal
    userId={extratoTarget.userId}
    displayName={extratoTarget.displayName}
    onClose={() => setExtratoTarget(null)}
  />
)}
{profileTarget ? (
  <UserProfileModal
    userId={profileTarget.userId}
    displayName={profileTarget.displayName}
    photoBase64={profileTarget.photoBase64}
    medals={profileTarget.medals}
    onClose={() => setProfileTarget(null)}
  />
) : null}

    </AppLayout>
  );
}
