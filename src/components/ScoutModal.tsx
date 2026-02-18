import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Flame,
  Info,
  Snowflake,
  Target,
  Trophy,
  X,
} from "lucide-react";

import bgScout from "../assets/android/bg/bg_scout.png";
import { fetchScoutPayload, type ScoutPayload } from "../lib/scoutApi";

type Props = {
  userId: string;
  displayName: string;
  onClose: () => void;
};

function streakIcon(streak: number) {
  if (streak > 0) return <Flame className="w-5 h-5" />;
  if (streak < 0) return <Snowflake className="w-5 h-5" />;
  return <span className="text-[16px] font-black">➖</span>;
}

function resultPill(r: string) {
  if (r === "✅") return <span className="text-green-600 text-[22px]">✅</span>;
  if (r === "❌") return <span className="text-red-600 text-[22px]">❌</span>;
  if (r === "🚫") return <span className="text-zinc-400 text-[22px]">🚫</span>;
  return <span className="text-zinc-500 text-[22px]">•</span>;
}

function formatSigned(n: number) {
  if (n > 0) return `+${n}`;
  return String(n);
}

function buildNiceTicks(maxRank: number, maxLines = 6) {
  const lines = Math.min(maxLines, Math.max(2, maxRank));
  const ticks: number[] = [];

  for (let i = 0; i < lines; i++) {
    const v = 1 + (i * (maxRank - 1)) / (lines - 1);
    ticks.push(Math.round(v));
  }

  // remove duplicates while keeping order
  const uniq: number[] = [];
  for (const t of ticks) if (!uniq.includes(t)) uniq.push(t);
  return uniq;
}

function RankChart({ history, totalParticipants }: { history: number[]; totalParticipants: number }) {
  const total = history.length;
  const windowSize = 10; // igual ao “29–38” do print (janela final)
  const window = history.slice(Math.max(0, total - windowSize));
  const windowLen = window.length;
  const xStart = Math.max(1, total - windowLen + 1);

  if (!windowLen) {
    return (
      <div className="w-full rounded-2xl bg-white/95 border border-white/20 shadow-xl overflow-hidden">
        <div className="px-4 py-4 text-center text-zinc-600 font-black">Sem dados de ranking ainda.</div>
      </div>
    );
  }

  const maxRank = Math.max(totalParticipants || 1, ...window, 1);
  const ticks = buildNiceTicks(maxRank, 6);

  // svg geometry
  const W = 520;
  const H = 320;
  const padL = 52;
  const padR = 18;
  const padT = 18;
  const padB = 44;

  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const xs = (i: number) => {
    if (windowLen <= 1) return padL;
    return padL + (i * innerW) / (windowLen - 1);
  };

  const ys = (rank: number) => {
    // rank 1 = top
    const r = Math.min(maxRank, Math.max(1, rank));
    const t = (r - 1) / (maxRank - 1 || 1);
    return padT + t * innerH;
  };

  const points = window.map((r, i) => ({ x: xs(i), y: ys(r), r }));

  const lineD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");

  const areaD =
    windowLen >= 2
      ? `${lineD} L ${xs(windowLen - 1).toFixed(2)} ${(padT + innerH).toFixed(2)} L ${xs(0).toFixed(2)} ${(padT + innerH).toFixed(2)} Z`
      : "";

  const xLabels = (() => {
    const step = windowLen <= 12 ? 1 : 2;
    const out: Array<{ j: number; label: number }> = [];
    for (let j = 0; j < windowLen; j += step) out.push({ j, label: xStart + j });
    return out;
  })();

  return (
    <div className="w-full rounded-2xl bg-white/95 border border-white/20 shadow-xl overflow-hidden">
      <div className="px-4 pt-3 pb-2">
        <div className="text-[13px] font-black tracking-wide text-emerald-700">TRAJETÓRIA NO RANKING</div>
      </div>

      <div className="px-3 pb-3">
        <div className="rounded-2xl bg-white border border-zinc-200 shadow-sm overflow-hidden">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[260px]">
            {/* grid + y labels */}
            {ticks.map((t) => {
              const y = ys(t);
              return (
                <g key={t}>
                  <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#000" opacity={0.18} strokeDasharray="6 6" />
                  <text x={padL - 10} y={y + 4} textAnchor="end" fontSize="14" fill="#111" opacity={0.8}>
                    {t}°
                  </text>
                </g>
              );
            })}

            {/* y axis label */}
            <text
              x={16}
              y={padT + innerH / 2}
              fontSize="14"
              fill="#111"
              opacity={0.8}
              transform={`rotate(-90 16 ${padT + innerH / 2})`}
            >
              Posição
            </text>

            {/* area */}
            {areaD ? <path d={areaD} fill="#16a34a" opacity={0.22} /> : null}

            {/* line */}
            <path d={lineD} fill="none" stroke="#16a34a" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />

            {/* points */}
            {points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={7} fill="#16a34a" />
            ))}

            {/* x axis */}
            <line x1={padL} y1={padT + innerH} x2={W - padR} y2={padT + innerH} stroke="#111" opacity={0.35} />

            {/* x labels */}
            {xLabels.map((it) => {
              const x = xs(it.j);
              return (
                <text key={it.label} x={x} y={H - 16} textAnchor="middle" fontSize="14" fill="#111" opacity={0.8}>
                  {it.label}
                </text>
              );
            })}

            <text x={padL + innerW / 2} y={H - 2} textAnchor="middle" fontSize="14" fill="#111" opacity={0.8}>
              Confrontos
            </text>
          </svg>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/95 border border-white/20 shadow-xl px-4 py-3">
      <div className="flex items-center gap-2 text-zinc-700 font-black text-[12px]">
        <span className="opacity-90">{icon}</span>
        <span className="tracking-wide">{label}</span>
      </div>
      <div className="mt-2 text-[28px] font-black text-zinc-950 leading-none">{value}</div>
    </div>
  );
}

function TinyInfoToast({ title, desc, onClose }: { title: string; desc: string; onClose: () => void }) {
  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-6 z-[1000000]">
      <div className="rounded-2xl bg-zinc-950/90 border border-white/15 shadow-2xl px-4 py-3 w-[min(520px,90vw)]">
        <div className="text-white font-black">{title}</div>
        <div className="text-white/70 text-sm mt-1">{desc}</div>
        <button
          onClick={onClose}
          className="mt-3 w-full rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-black py-2"
        >
          OK
        </button>
      </div>
    </div>
  );
}

export default function ScoutModal({ userId, displayName, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<ScoutPayload | null>(null);
  const [toast, setToast] = useState<{ title: string; desc: string } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const p = await fetchScoutPayload(userId);
        if (!alive) return;
        setPayload(p);
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setToast({ title: "ERRO", desc: "Não consegui carregar o Scout agora. Tente novamente." });
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  const compRows = useMemo(() => (payload?.compTable || []).slice(0, 20), [payload]);

  const ui = (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div className="relative w-full max-w-[720px] rounded-2xl overflow-hidden border border-white/15 shadow-2xl">
        {/* Fundo Android */}
        <img src={bgScout} alt="" className="absolute inset-0 w-full h-full object-cover" />

        <div className="relative p-4 max-h-[90vh] overflow-y-auto overscroll-contain">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[12px] font-black tracking-[0.35em] text-emerald-700">SCOUT DO PALPITEIRO</div>
              <div className="mt-1 text-3xl font-black tracking-wide text-zinc-950 drop-shadow">{displayName}</div>
              {loading ? <div className="text-zinc-600 text-xs font-black mt-1">Carregando estatísticas…</div> : null}
            </div>

            <button
              onClick={onClose}
              className="rounded-xl bg-white/20 hover:bg-white/30 border border-white/15 p-2"
              title="Fechar"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Pills: Consistência / Risco */}
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-2xl bg-black/70 border border-white/15 shadow-xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BarChart3 className="w-5 h-5 text-white/85" />
                <div className="text-white font-black">
                  Consistência: <span className="text-emerald-300">{payload?.consistencyText ?? "-"}</span>
                </div>
              </div>
              <button
                onClick={() =>
                  setToast({
                    title: "CONSISTÊNCIA",
                    desc: "Mede o quanto sua posição no ranking oscila ao longo dos confrontos. Quanto menor a oscilação média, maior a consistência.",
                  })
                }
                className="rounded-full bg-white/10 hover:bg-white/15 border border-white/15 p-2"
                title="O que é isso?"
              >
                <Info className="w-4 h-4 text-white/90" />
              </button>
            </div>

            <div className="rounded-2xl bg-black/70 border border-white/15 shadow-xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Target className="w-5 h-5 text-white/85" />
                <div className="text-white font-black">
                  Risco: <span className="text-emerald-300">{payload?.riskText ?? "-"}</span>
                </div>
              </div>
              <button
                onClick={() =>
                  setToast({
                    title: "RISCO",
                    desc: "Mede o quanto você costuma votar contra a maioria. Quanto mais você escolhe opções pouco votadas, maior o risco.",
                  })
                }
                className="rounded-full bg-white/10 hover:bg-white/15 border border-white/15 p-2"
                title="O que é isso?"
              >
                <Info className="w-4 h-4 text-white/90" />
              </button>
            </div>
          </div>

          {/* KPIs */}
          <div className="mt-5 text-[13px] font-black tracking-wide text-emerald-700">RESUMO (KPIs)</div>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <KpiCard icon={<span className="text-[16px]">⚽</span>} label="VOTOS/CONF." value={payload?.stats.confrontos ?? "-"} />
            <KpiCard icon={<CheckCircle2 className="w-5 h-5" />} label="ACERTOS" value={payload?.stats.acertos ?? "-"} />
            <KpiCard icon={<Target className="w-5 h-5" />} label="PRECISÃO" value={payload?.stats.precisao ?? "-"} />
            <KpiCard
              icon={streakIcon(payload?.currentStreak ?? 0)}
              label="SEQ. ATUAL"
              value={payload ? formatSigned(payload.currentStreak) : "-"}
            />
          </div>

          {/* Últimos 5 */}
          <div className="mt-5 text-[13px] font-black tracking-wide text-emerald-700">ÚLTIMOS 5 RESULTADOS</div>
          <div className="mt-2 rounded-2xl bg-white/35 border border-white/15 shadow-xl px-4 py-4">
            <div className="flex items-center justify-between text-zinc-700 font-black text-[12px]">
              <span>Mais recente</span>
              <span>→</span>
              <span>Mais antigo</span>
            </div>
            <div className="mt-3 flex items-center justify-center gap-4">
              {(payload?.lastFive || ["•", "•", "•", "•", "•"]).map((r, i) => (
                <div
                  key={i}
                  className="w-12 h-12 rounded-full bg-white/95 border border-white/30 shadow flex items-center justify-center"
                >
                  {resultPill(r)}
                </div>
              ))}
            </div>
          </div>

          {/* Evolução */}
          <div className="mt-5 text-[13px] font-black tracking-wide text-emerald-700">EVOLUÇÃO NO RANKING</div>
          <div className="mt-2">
            {payload ? <RankChart history={payload.rankHistory} totalParticipants={payload.totalParticipants} /> : null}
          </div>

          {/* Competição */}
          <div className="mt-5 text-[13px] font-black tracking-wide text-emerald-700">DESEMPENHO POR COMPETIÇÃO</div>
          <div className="mt-2 rounded-2xl bg-white/95 border border-white/20 shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200">
              <div className="grid grid-cols-[1fr_70px_70px_70px] text-zinc-500 font-black text-[12px]">
                <div>COMPETIÇÃO</div>
                <div className="text-right">Jog</div>
                <div className="text-right">Ace</div>
                <div className="text-right">%</div>
              </div>
            </div>
            <div className="max-h-[260px] overflow-y-auto">
              {compRows.length ? (
                compRows.map((r) => (
                  <div
                    key={r.name}
                    className="px-4 py-3 border-b border-zinc-100 grid grid-cols-[1fr_70px_70px_70px] text-zinc-900 font-black"
                  >
                    <div className="truncate" title={r.name}>
                      {r.name}
                    </div>
                    <div className="text-right">{r.voted}</div>
                    <div className="text-right">{r.hits}</div>
                    <div className="text-right">{r.accuracy}%</div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-6 text-center text-zinc-600 font-black">—</div>
              )}
            </div>
          </div>

          {/* Recordes */}
          <div className="mt-5 text-[13px] font-black tracking-wide text-emerald-700">RECORDES & PERFIL</div>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/95 border border-white/20 shadow-xl px-4 py-3">
              <div className="flex items-center gap-2 text-zinc-700 font-black text-[12px]">
                <Flame className="w-5 h-5" />
                <span>Melhor Seq.</span>
              </div>
              <div className="mt-2 text-[28px] font-black text-zinc-950 leading-none">+{payload?.maxWinStreak ?? 0}</div>
              {(payload?.maxWinStreakCount ?? 0) > 0 ? (
                <div className="mt-2 inline-flex rounded-full bg-red-600 text-white font-black text-[12px] px-2 py-0.5 border border-white/70 shadow">
                  {payload?.maxWinStreakCount}x
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl bg-white/95 border border-white/20 shadow-xl px-4 py-3">
              <div className="flex items-center gap-2 text-zinc-700 font-black text-[12px]">
                <Snowflake className="w-5 h-5" />
                <span>Pior Seq.</span>
              </div>
              <div className="mt-2 text-[28px] font-black text-zinc-950 leading-none">-{payload?.maxLoseStreak ?? 0}</div>
              {(payload?.maxLoseStreakCount ?? 0) > 0 ? (
                <div className="mt-2 inline-flex rounded-full bg-red-600 text-white font-black text-[12px] px-2 py-0.5 border border-white/70 shadow">
                  {payload?.maxLoseStreakCount}x
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl bg-white/95 border border-white/20 shadow-xl px-4 py-3">
              <div className="flex items-center gap-2 text-zinc-700 font-black text-[12px]">
                <Trophy className="w-5 h-5" />
                <span>Melhor posição</span>
              </div>
              <div className="mt-2 text-[28px] font-black text-zinc-950 leading-none">#{payload?.bestRank ?? 0}</div>
              {(payload?.bestRankCount ?? 0) > 0 ? (
                <div className="mt-2 inline-flex rounded-full bg-red-600 text-white font-black text-[12px] px-2 py-0.5 border border-white/70 shadow">
                  {payload?.bestRankCount}x
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl bg-white/95 border border-white/20 shadow-xl px-4 py-3">
              <div className="flex items-center gap-2 text-zinc-700 font-black text-[12px]">
                <AlertTriangle className="w-5 h-5" />
                <span>Pior posição</span>
              </div>
              <div className="mt-2 text-[28px] font-black text-zinc-950 leading-none">#{payload?.worstRank ?? 0}</div>
              {(payload?.worstRankCount ?? 0) > 0 ? (
                <div className="mt-2 inline-flex rounded-full bg-red-600 text-white font-black text-[12px] px-2 py-0.5 border border-white/70 shadow">
                  {payload?.worstRankCount}x
                </div>
              ) : null}
            </div>
          </div>

          {/* Destaques */}
          <div className="mt-5 text-[13px] font-black tracking-wide text-emerald-700">DESTAQUES</div>
          <div className="mt-2 rounded-2xl bg-white/35 border border-white/15 shadow-xl px-4 py-4">
            <div className="flex items-start gap-3">
              <Trophy className="w-5 h-5 text-emerald-800" />
              <div>
                <div className="text-[12px] font-black text-emerald-800">Especialidade</div>
                <div className="text-zinc-950 font-black mt-1">{payload?.bestComp ?? "-"}</div>
              </div>
            </div>
            <div className="mt-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-700" />
              <div>
                <div className="text-[12px] font-black text-red-700">Ponto fraco</div>
                <div className="text-zinc-950 font-black mt-1">{payload?.worstComp ?? "-"}</div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-5">
            <button
              onClick={onClose}
              className="w-full rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-black py-4 shadow"
            >
              FECHAR
            </button>
          </div>
        </div>
      </div>

      {toast ? <TinyInfoToast title={toast.title} desc={toast.desc} onClose={() => setToast(null)} /> : null}
    </div>
  );

  return createPortal(ui, document.body);
}
