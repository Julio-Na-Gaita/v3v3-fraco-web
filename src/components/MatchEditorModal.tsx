import { useEffect, useMemo, useState } from "react";
import { deleteField } from "firebase/firestore";
import type { LegType, MatchView } from "../lib/contracts";
import {
  createMatch,
  fetchSettingsNames,
  fetchTeamsCatalog,
  normTeamName,
  updateMatch,
} from "../lib/adminMatchesApi";

function isKnockoutRound(round: string) {
  const r = (round ?? "").trim().toLowerCase();
  const isLeague = r.includes("pontos corridos");
  const isGroups = r.includes("fase de grupos");
  return !(isLeague || isGroups);
}
function legAsksQualifier(legType: LegType) {
  return String(legType).toUpperCase() === "VOLTA" || String(legType).toUpperCase() === "UNICO";
}

function toDatetimeLocalValue(d: Date | null) {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function driveToDirect(url: string) {
  const u = String(url || "").trim();
  if (!u) return "";
  const m = u.match(/drive\.google\.com\/file\/d\/([^/]+)\//i);
  if (m?.[1]) return `https://drive.google.com/uc?export=download&id=${m[1]}`;
  return u;
}

export default function MatchEditorModal({
  mode,
  initial,
  onClose,
  onDone,
}: {
  mode: "create" | "edit";
  initial?: MatchView | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [teamA, setTeamA] = useState(initial?.teamA ?? "");
  const [teamB, setTeamB] = useState(initial?.teamB ?? "");
  const [teamAUrl, setTeamAUrl] = useState(initial?.teamALogo ?? "");
  const [teamBUrl, setTeamBUrl] = useState(initial?.teamBLogo ?? "");

  const [competition, setCompetition] = useState(initial?.competition ?? "");
  const [round, setRound] = useState(initial?.round ?? "");
  const [deadline, setDeadline] = useState<Date>(initial?.deadline ?? new Date());

  const [allowDraw, setAllowDraw] = useState<boolean>(initial?.allowDraw ?? true);
  const [legType, setLegType] = useState<LegType>((initial?.legType ?? "") as LegType);

  const askQualifier = useMemo(() => isKnockoutRound(round) && legAsksQualifier(legType), [round, legType]);

  const [compList, setCompList] = useState<string[]>([]);
  const [roundList, setRoundList] = useState<string[]>([]);
  const [teamsCatalog, setTeamsCatalog] = useState<Array<{ name: string; logo: string }>>([]);

  useEffect(() => {
    (async () => {
      try {
        const [c, r, t] = await Promise.all([
          fetchSettingsNames("competitions"),
          fetchSettingsNames("rounds"),
          fetchTeamsCatalog(500),
        ]);
        setCompList(c);
        setRoundList(r);
        setTeamsCatalog(t);
      } catch (e: any) {
        console.error(e);
      }
    })();
  }, []);

  const catalogMap = useMemo(() => {
    const m = new Map<string, string>();
    teamsCatalog.forEach((x) => m.set(x.name.toLowerCase(), x.logo));
    return m;
  }, [teamsCatalog]);

  function autoFillLogo(which: "A" | "B", name: string) {
    const key = normTeamName(name).toLowerCase();
    const found = catalogMap.get(key);
    if (!found) return;
    if (which === "A" && !teamAUrl) setTeamAUrl(found);
    if (which === "B" && !teamBUrl) setTeamBUrl(found);
  }

  async function onSave() {
    setToast(null);

    const a = normTeamName(teamA);
    const b = normTeamName(teamB);

    if (!a || !b) return setToast("Preencha os times A e B.");
    if (!competition.trim()) return setToast("Selecione/Preencha a competição.");
    if (!round.trim()) return setToast("Selecione/Preencha a rodada.");
    if (!(deadline instanceof Date) || isNaN(deadline.getTime())) return setToast("Prazo inválido.");

    const urlA = driveToDirect(teamAUrl);
    const urlB = driveToDirect(teamBUrl);

    setSaving(true);
    try {
      if (mode === "create") {
        await createMatch({
          teamA: a,
          teamB: b,
          teamAUrl: urlA,
          teamBUrl: urlB,
          competition: competition.trim(),
          round: round.trim(),
          deadline,
          allowDraw,
          legType,
          askQualifier,
        });
      } else {
        if (!initial?.id) throw new Error("ID do confronto ausente.");

        const patch: Record<string, any> = {
          teamA: a,
          teamB: b,
          teamAUrl: urlA,
          teamBUrl: urlB,
          teamALogo: urlA,
          teamBLogo: urlB,
          competition: competition.trim(),
          round: round.trim(),
          deadline,
          allowDraw,
          legType,
          askQualifier,
        };

        // igual Android: se não perguntar classificado, limpa o campo
        if (!askQualifier) patch.qualifier = deleteField();

        await updateMatch(initial.id, patch);
      }

      onDone();
    } catch (e: any) {
      console.error(e);
      setToast(e?.message ?? "Erro ao salvar (verifique rules/permissões).");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-zinc-950/95 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xl font-black tracking-wide text-zinc-100">
              {mode === "create" ? "➕ Novo Confronto" : "✏️ Editar Confronto"}
            </div>
            {mode === "edit" && (
              <div className="text-zinc-400 text-sm mt-1">
                #{initial?.matchNumber ?? "?"} • {initial?.teamA} x {initial?.teamB}
              </div>
            )}

            <div className="mt-2 text-xs font-black text-zinc-400">
              Classificado:{" "}
              <span className={askQualifier ? "text-emerald-400" : "text-zinc-400"}>
                {askQualifier ? "SIM" : "NÃO"}
              </span>
              {isKnockoutRound(round) && (
                <span className="ml-2 text-zinc-500">(mata-mata detectado)</span>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-2xl bg-white/5 border border-white/10 text-zinc-200 font-black hover:bg-white/10 transition"
          >
            FECHAR
          </button>
        </div>

        {toast && (
          <div className="mt-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-black text-rose-200">
            {toast}
          </div>
        )}

        <div className="mt-4 grid gap-3">
          {/* Comp / Round */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-black text-zinc-300 mb-1">Competição</div>
              <input
                list="compList"
                value={competition}
                onChange={(e) => setCompetition(e.target.value)}
                className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-zinc-100 font-black outline-none"
                placeholder="Ex: Champions League"
              />
              <datalist id="compList">
                {compList.map((x) => (
                  <option key={x} value={x} />
                ))}
              </datalist>
            </div>

            <div>
              <div className="text-xs font-black text-zinc-300 mb-1">Rodada</div>
              <input
                list="roundList"
                value={round}
                onChange={(e) => setRound(e.target.value)}
                className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-zinc-100 font-black outline-none"
                placeholder="Ex: Oitavas / Final / Pontos corridos"
              />
              <datalist id="roundList">
                {roundList.map((x) => (
                  <option key={x} value={x} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Times */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-black text-zinc-300 mb-1">Time A</div>
              <input
                list="teamsList"
                value={teamA}
                onChange={(e) => setTeamA(e.target.value)}
                onBlur={() => autoFillLogo("A", teamA)}
                className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-zinc-100 font-black outline-none"
                placeholder="Ex: Real Madrid"
              />
            </div>

            <div>
              <div className="text-xs font-black text-zinc-300 mb-1">Time B</div>
              <input
                list="teamsList"
                value={teamB}
                onChange={(e) => setTeamB(e.target.value)}
                onBlur={() => autoFillLogo("B", teamB)}
                className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-zinc-100 font-black outline-none"
                placeholder="Ex: Barcelona"
              />
            </div>

            <datalist id="teamsList">
              {teamsCatalog.map((t) => (
                <option key={t.name} value={t.name} />
              ))}
            </datalist>
          </div>

          {/* Logos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-black text-zinc-300 mb-1">Logo A (URL)</div>
              <input
                value={teamAUrl}
                onChange={(e) => setTeamAUrl(e.target.value)}
                className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-zinc-100 font-bold outline-none"
                placeholder="https://..."
              />
            </div>

            <div>
              <div className="text-xs font-black text-zinc-300 mb-1">Logo B (URL)</div>
              <input
                value={teamBUrl}
                onChange={(e) => setTeamBUrl(e.target.value)}
                className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-zinc-100 font-bold outline-none"
                placeholder="https://..."
              />
            </div>
          </div>

          {/* Prazo + flags */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-black text-zinc-300 mb-1">Prazo</div>
              <input
                type="datetime-local"
                value={toDatetimeLocalValue(deadline)}
                onChange={(e) => setDeadline(new Date(e.target.value))}
                className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-zinc-100 font-black outline-none"
              />
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
              <div>
                <div className="text-xs font-black text-zinc-300">Permitir empate</div>
                <div className="text-[11px] text-zinc-500 font-bold">igual regra do Android</div>
              </div>
              <input type="checkbox" checked={allowDraw} onChange={(e) => setAllowDraw(e.target.checked)} />
            </div>
          </div>

          {/* LegType */}
          <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
            <div className="text-xs font-black text-zinc-300 mb-2">Perna (mata-mata)</div>
            <select
              value={legType}
              onChange={(e) => setLegType(e.target.value as LegType)}
              className="w-full rounded-2xl bg-zinc-950 border border-white/10 px-4 py-3 text-zinc-100 font-black outline-none"
            >
              <option value="">(sem)</option>
              <option value="IDA">IDA</option>
              <option value="VOLTA">VOLTA</option>
              <option value="UNICO">JOGO ÚNICO</option>
            </select>

            <div className="mt-2 text-[11px] text-zinc-500 font-bold">
              * O campo “Perguntar classificado” é automático: mata-mata + (VOLTA/ÚNICO)
            </div>
          </div>

          {/* Actions */}
          <div className="mt-2 flex gap-2 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-zinc-200 font-black hover:bg-white/10 transition"
            >
              Cancelar
            </button>

            <button
              disabled={saving}
              onClick={onSave}
              className={[
                "px-4 py-3 rounded-2xl font-black transition border",
                "bg-emerald-600/90 hover:bg-emerald-600 text-white border-emerald-500/30",
                saving ? "opacity-70 cursor-not-allowed" : "",
              ].join(" ")}
            >
              {saving ? "Salvando..." : "SALVAR"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}