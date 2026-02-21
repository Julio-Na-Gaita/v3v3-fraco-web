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
const [showImageLinks, setShowImageLinks] = useState(false);

// (visual) botões "Whats" e "Push" (por enquanto só UI)
const [notifyWhats, setNotifyWhats] = useState(false);
const [notifyPush, setNotifyPush] = useState(false);
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

async function onSave(behavior: "close" | "plusOne") {
  setToast(null);

  const a = normTeamName(teamA);
  const b = normTeamName(teamB);

  if (!a || !b) return setToast("Preencha os times A e B.");
  if (!competition.trim()) return setToast("Selecione/Preencha a competição.");
  if (!round.trim()) return setToast("Selecione/Preencha a fase.");
  if (!(deadline instanceof Date) || isNaN(deadline.getTime())) return setToast("Data/Hora inválida.");

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

        // apenas UI por enquanto (mas já deixa pronto pro futuro)
        notifyWhats,
        notifyPush,
      } as any);

      if (behavior === "plusOne") {
        // ✅ Android-like: mantém competição/fase e o resto, limpa times
        setTeamA("");
        setTeamB("");
        setTeamAUrl("");
        setTeamBUrl("");
        setShowImageLinks(false);
        setToast("✅ Salvo! Pode cadastrar o próximo.");
        return;
      }

      onDone();
      return;
    }

    // edit
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

      notifyWhats,
      notifyPush,
    };

    // igual Android: se não perguntar classificado, limpa
    if (!askQualifier) patch.qualifier = deleteField();

    await updateMatch(initial.id, patch);
    onDone();
  } catch (e: any) {
    console.error(e);
    setToast(e?.message ?? "Erro ao salvar.");
  } finally {
    setSaving(false);
  }
}

  return (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

    {/* Card principal (branco, Android-like) */}
    <div className="relative w-full max-w-lg rounded-[28px] bg-white shadow-2xl overflow-hidden">
      {/* Topo roxo (fundo) + título verde */}
      <div className="px-5 pt-5 pb-3 bg-[color:var(--v3-primary)]/85">
        <div className="flex items-start justify-between gap-3">
          <div className="text-white">
            <div className="text-[20px] font-black tracking-wide">
              {mode === "create" ? "NOVO CONFRONTO ⚽" : "EDITAR CONFRONTO ⚽"}
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-white/20 border border-white/25 text-white font-black hover:bg-white/30 transition"
            title="Fechar"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Corpo scroll */}
      <div className="p-4 max-h-[78vh] overflow-auto">
        {toast && (
          <div className="mb-3 rounded-2xl border border-rose-500/20 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">
            {toast}
          </div>
        )}

        {/* Seção helper */}
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
          <div className="text-[16px] font-black text-emerald-700">Configurações</div>
          <div className="text-xs font-bold text-zinc-400 mt-1">Competição e fase do confronto</div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-zinc-200 bg-white p-3">
              <div className="text-[11px] font-black text-zinc-500">Competição</div>
              <input
                list="compList"
                value={competition}
                onChange={(e) => setCompetition(e.target.value)}
                className="mt-2 w-full outline-none font-black text-zinc-900"
                placeholder="Ex: Libertadores"
              />
              <datalist id="compList">
                {compList.map((x) => (
                  <option key={x} value={x} />
                ))}
              </datalist>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-3">
              <div className="text-[11px] font-black text-zinc-500">Fase</div>
              <input
                list="roundList"
                value={round}
                onChange={(e) => setRound(e.target.value)}
                className="mt-2 w-full outline-none font-black text-zinc-900"
                placeholder="Ex: Pontos Corridos"
              />
              <datalist id="roundList">
                {roundList.map((x) => (
                  <option key={x} value={x} />
                ))}
              </datalist>
            </div>
          </div>
        </div>

        {/* Mata-mata – Tipo do jogo */}
        {isKnockoutRound(round) && (
          <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="text-[16px] font-black text-emerald-700">MATA-MATA — Tipo do jogo</div>
            <div className="text-xs font-bold text-zinc-400 mt-1">
              Em Volta/Jogo Único aparece “Quem classifica?” (+1 extra)
            </div>

            <div className="mt-3 rounded-2xl bg-white border border-zinc-200 p-2 flex gap-2">
              {(["IDA", "VOLTA", "UNICO"] as LegType[]).map((x) => (
                <button
                  key={x}
                  type="button"
                  onClick={() => setLegType(x)}
                  className={[
                    "flex-1 py-3 rounded-2xl font-black text-sm transition",
                    legType === x ? "bg-emerald-700 text-white" : "bg-zinc-100 text-zinc-700",
                  ].join(" ")}
                >
                  {x === "UNICO" ? "JOGO ÚNICO" : x}
                </button>
              ))}
            </div>

            <div className="mt-3 text-sm font-black">
              {askQualifier ? (
                <span className="text-emerald-700">✅ Vai aparecer: “Quem classifica?” (+1 extra)</span>
              ) : (
                <span className="text-zinc-500">ℹ️ Ida: NÃO aparece “Quem classifica?”</span>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-4 py-3">
              <div>
                <div className="text-xs font-black text-zinc-700">Permitir empate</div>
                <div className="text-[11px] text-zinc-400 font-bold">igual regra do Android</div>
              </div>
              <input type="checkbox" checked={allowDraw} onChange={(e) => setAllowDraw(e.target.checked)} />
            </div>
          </div>
        )}

        {/* Times */}
        <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
          <div className="text-[16px] font-black text-emerald-700">Times</div>
          <div className="text-xs font-bold text-zinc-400 mt-1">Escolha os clubes e carregue as logos</div>

          <div className="mt-3 grid grid-cols-2 gap-3 items-start">
            {/* Time A */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-3">
              <div className="text-[11px] font-black text-zinc-500">Time A</div>
              <input
                list="teamsList"
                value={teamA}
                onChange={(e) => setTeamA(e.target.value)}
                className="mt-2 w-full outline-none font-black text-zinc-900"
                placeholder="Selecione..."
              />
              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => autoFillLogo("A", teamA)}
                  className="w-10 h-10 rounded-2xl border border-zinc-200 bg-zinc-50 font-black"
                  title="Buscar logo no catálogo"
                >
                  🔍
                </button>
                <button
                  type="button"
                  onClick={() => setShowImageLinks((v) => !v)}
                  className="w-10 h-10 rounded-2xl border border-zinc-200 bg-zinc-50 font-black"
                  title="Mostrar/ocultar links de imagem"
                >
                  ☁️
                </button>
              </div>
            </div>

            {/* Time B */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-3">
              <div className="text-[11px] font-black text-zinc-500">Time B</div>
              <input
                list="teamsList"
                value={teamB}
                onChange={(e) => setTeamB(e.target.value)}
                className="mt-2 w-full outline-none font-black text-zinc-900"
                placeholder="Selecione..."
              />
              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => autoFillLogo("B", teamB)}
                  className="w-10 h-10 rounded-2xl border border-zinc-200 bg-zinc-50 font-black"
                  title="Buscar logo no catálogo"
                >
                  🔍
                </button>
                <button
                  type="button"
                  onClick={() => setShowImageLinks((v) => !v)}
                  className="w-10 h-10 rounded-2xl border border-zinc-200 bg-zinc-50 font-black"
                  title="Mostrar/ocultar links de imagem"
                >
                  ☁️
                </button>
              </div>
            </div>

            <datalist id="teamsList">
              {teamsCatalog.map((t) => (
                <option key={t.name} value={t.name} />
              ))}
            </datalist>
          </div>
        </div>

        {/* Imagens (colapsável) */}
        <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
          <div className="text-[16px] font-black text-emerald-700">Imagens</div>
          <div className="text-xs font-bold text-zinc-400 mt-1">Opcional: colar link manual das logos</div>

          {!showImageLinks ? (
            <button
              type="button"
              onClick={() => setShowImageLinks(true)}
              className="mt-3 w-full rounded-2xl border border-zinc-200 bg-white py-4 font-black text-zinc-500"
            >
              Colocar Link de Imagem Manualmente
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setShowImageLinks(false)}
                className="mt-3 w-full rounded-2xl border border-zinc-200 bg-white py-3 font-black text-zinc-500"
              >
                Ocultar Links de Imagem
              </button>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <input
                  value={teamAUrl}
                  onChange={(e) => setTeamAUrl(e.target.value)}
                  className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 font-bold text-zinc-800 outline-none"
                  placeholder="Link Logo A"
                />
                <input
                  value={teamBUrl}
                  onChange={(e) => setTeamBUrl(e.target.value)}
                  className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 font-bold text-zinc-800 outline-none"
                  placeholder="Link Logo B"
                />
              </div>
            </>
          )}
        </div>

        {/* Data e avisos */}
        <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
          <div className="text-[16px] font-black text-emerald-700">Data e avisos</div>
          <div className="text-xs font-bold text-zinc-400 mt-1">Defina o prazo do voto e se quer notificar</div>

          <div className="mt-3 rounded-2xl border border-zinc-200 bg-white p-3">
            <div className="text-[11px] font-black text-zinc-500 mb-2">Data do Jogo</div>
            <input
              type="datetime-local"
              value={toDatetimeLocalValue(deadline)}
              onChange={(e) => setDeadline(new Date(e.target.value))}
              className="w-full outline-none font-black text-zinc-900"
            />
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setNotifyWhats((v) => !v)}
              className={[
                "flex-1 rounded-2xl border px-4 py-3 font-black transition",
                notifyWhats ? "bg-emerald-700 text-white border-emerald-700" : "bg-white text-zinc-700 border-zinc-200",
              ].join(" ")}
            >
              Whats
            </button>

            <button
              type="button"
              onClick={() => setNotifyPush((v) => !v)}
              className={[
                "flex-1 rounded-2xl border px-4 py-3 font-black transition",
                notifyPush ? "bg-emerald-700 text-white border-emerald-700" : "bg-white text-zinc-700 border-zinc-200",
              ].join(" ")}
            >
              Push
            </button>
          </div>
        </div>

        {/* Rodapé botões (Android-like) */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          {mode === "create" ? (
            <>
              <button
                disabled={saving}
                onClick={() => onSave("plusOne")}
                className="rounded-2xl py-4 font-black text-white bg-orange-500 hover:bg-orange-600 transition disabled:opacity-70"
              >
                {saving ? "Salvando..." : "Salvar +1"}
              </button>

              <button
                disabled={saving}
                onClick={() => onSave("close")}
                className="rounded-2xl py-4 font-black text-white bg-emerald-700 hover:bg-emerald-800 transition disabled:opacity-70"
              >
                {saving ? "Salvando..." : "Concluir"}
              </button>
            </>
          ) : (
            <>
              <button
                disabled={saving}
                onClick={onClose}
                className="rounded-2xl py-4 font-black text-zinc-700 bg-zinc-100 hover:bg-zinc-200 transition disabled:opacity-70"
              >
                Cancelar
              </button>

              <button
                disabled={saving}
                onClick={() => onSave("close")}
                className="rounded-2xl py-4 font-black text-white bg-emerald-700 hover:bg-emerald-800 transition disabled:opacity-70"
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  </div>
);;
}