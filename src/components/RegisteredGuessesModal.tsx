import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Clock3, X, XCircle } from "lucide-react";
import { normalizeVote, type MatchView } from "../lib/contracts";
import { fetchRegisteredGuessesForMatch, type GuessDetailsRow, type VoterRow } from "../lib/bolaoApi";

function toImgSrc(photoBase64?: string) {
  if (!photoBase64) return null;
  if (photoBase64.startsWith("http") || photoBase64.startsWith("data:image")) return photoBase64;
  // base64 puro
  return `data:image/jpeg;base64,${photoBase64}`;
}

function initials(name: string) {
  return (name || "?")
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}
function normName(s: string) {
  return (s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isOver25Correct(pick: boolean | null, goalsA?: number, goalsB?: number) {
  if (pick == null) return false; // não marcou => não pontua
  if (typeof goalsA !== "number" || typeof goalsB !== "number") return false;
  const over = goalsA + goalsB >= 3; // over 2.5
  return pick === over;
}

function isBttsCorrect(pick: boolean | null, goalsA?: number, goalsB?: number) {
  if (pick == null) return false; // não marcou => não pontua
  if (typeof goalsA !== "number" || typeof goalsB !== "number") return false;
  const btts = goalsA >= 1 && goalsB >= 1;
  return pick === btts;
}

function isQualifierCorrect(
  pick: string | null,
  askQualifier: boolean,
  qualifier?: string | null
) {
  if (!askQualifier) return false;
  if (!pick) return false; // não marcou => não pontua
  if (!qualifier) return false;
  return normName(pick) === normName(qualifier);
}

function displayMainVote(raw: any, match: MatchView) {
  const v = String(raw ?? "").trim();
  if (!v) return "—";
  if (v === "A") return match.teamA;
  if (v === "B") return match.teamB;
  if (v.toUpperCase() === "EMPATE") return "EMPATE";
  // alguns docs salvam o nome do time direto (teamSelected)
  if (v === match.teamA || v === match.teamB) return v;
  return v; // fallback
}

function deriveWinnerFromGoals(match: MatchView): "A" | "B" | "EMPATE" | null {
  const a = (match as any).goalsA;
  const b = (match as any).goalsB;
  if (typeof a !== "number" || typeof b !== "number") return null;

  if (a > b) return "A";
  if (b > a) return "B";
  return match.allowDraw ? "EMPATE" : null;
}

type PillTone = "neutral" | "good" | "bad";

function pill(tone: PillTone, text: string) {
  const cls =
    tone === "good"
      ? "bg-green-700 text-white border-transparent"
      : tone === "bad"
      ? "bg-red-600 text-white border-transparent"
      : "bg-white/75 text-zinc-800 border-white/50";

  return (
    <span className={["px-3 py-1 rounded-full font-black text-xs border", cls].join(" ")}>
      {text}
    </span>
  );
}


export default function RegisteredGuessesModal({
  match,
  isExpired: isExpiredProp,
  onClose,
  closeLabel,
}: {
  match: MatchView;
  isExpired: boolean;
  onClose: () => void;
  closeLabel?: string; // ✅ opcional
}) {

  const isExpired = isExpiredProp;
  const askQualifier = !!match.askQualifier;

  const [tab, setTab] = useState<"voted" | "missing">("voted");
  const [loading, setLoading] = useState(true);
  const [voted, setVoted] = useState<GuessDetailsRow[]>([]);
  const [missing, setMissing] = useState<VoterRow[]>([]);
  const [error, setError] = useState<string | null>(null);

    const goalsReady = typeof match.goalsA === "number" && typeof match.goalsB === "number";

  // ✅ “Finalizado” = quando já temos placar OU winner/qualifier preenchidos
  const isFinalized =
    goalsReady || !!match.winner || !!match.qualifier;

  // ✅ Regra: antes do prazo não revela extras
  const canRevealExtras = isExpired;

  function toneOver25(pick: boolean | null | undefined): PillTone {
    if (pick == null) return "neutral";

    // aguardando resultado: cor “por escolha” (igual estilo do Android)
    if (!isFinalized || !goalsReady) return pick === true ? "good" : "bad";

    // finalizado: cor por acerto/erro
    const total = (match.goalsA as number) + (match.goalsB as number);
    const correct = pick === true ? total >= 3 : total <= 2; // +2.5 => >=3 | -2.5 => <=2
    return correct ? "good" : "bad";
  }

  function toneBtts(pick: boolean | null | undefined): PillTone {
    if (pick == null) return "neutral";

    // aguardando: SIM vermelho, NÃO verde (padrão que você mostrou)
    if (!isFinalized || !goalsReady) return pick === true ? "bad" : "good";

    // finalizado: acerto/erro
    const both = (match.goalsA as number) > 0 && (match.goalsB as number) > 0;
    const correct = pick === true ? both : !both;
    return correct ? "good" : "bad";
  }

  function toneQualifier(pick: string | null | undefined): PillTone {
    if (!match.askQualifier) return "neutral";
    if (!pick) return "neutral";

    // aguardando: não avalia, só neutro
    if (!isFinalized) return "neutral";

    // finalizado: compara com match.qualifier (se existir)
    if (match.qualifier) {
  return isQualifierCorrect(pick, askQualifier, match.qualifier) ? "good" : "bad";
}
return "neutral";

  }

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    fetchRegisteredGuessesForMatch(match)
      .then((res) => {
        if (!alive) return;
        setVoted(res.voted);
        setMissing(res.missing);
        setLoading(false);
      })
      .catch((e: any) => {
        if (!alive) return;
        setError(e?.message || "Falha ao carregar palpites.");
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [match.id]);

  const votedCount = voted.length;
  const missingCount = missing.length;

  const headerSubtitle = useMemo(() => {
    return `#${match.matchNumber ?? "?"} • ${match.teamA} x ${match.teamB}`;
  }, [match.matchNumber, match.teamA, match.teamB]);

  if (typeof document === "undefined") return null;

  // ✅ “gabarito” do voto principal:
  // tenta `winner` salvo; se não tiver, deriva do placar.
  const winnerVote = normalizeVote(
    (match as any).winner ?? deriveWinnerFromGoals(match) ?? undefined,
    match
  );

  // ✅ só mostra acerto/erro e reordena quando o confronto está realmente “finalizado”
  // (placar ou winner/qualifier preenchidos) E o prazo já expirou
  const canScore = isExpired && isFinalized && !!winnerVote;


// ✅ ordena a lista “VOTARAM” igual Android (só quando finalizado)
const votedSorted = useMemo(() => {
  // antes do prazo: mantém do jeito atual
  if (!isExpired) return voted;

  // se ainda não tem resultado final do admin, não reordena por acerto
  if (!canScore) return [...voted].sort((a, b) => a.displayName.localeCompare(b.displayName));

  const gA = (match as any).goalsA as number | undefined;
  const gB = (match as any).goalsB as number | undefined;
  const qualRes = (match as any).qualifier as string | null | undefined;

  function scoreUser(u: any) {
    const uVote = normalizeVote(u.voteRaw, match);
    const mainOk = !!uVote && !!winnerVote && uVote === winnerVote;

    const overOk = isOver25Correct(u.over25Pick ?? null, gA, gB);
    const bttsOk = isBttsCorrect(u.bttsPick ?? null, gA, gB);
    const qualOk = isQualifierCorrect(u.qualifierPick ?? null, askQualifier, qualRes);

    const extrasOkCount = (overOk ? 1 : 0) + (bttsOk ? 1 : 0) + (askQualifier ? (qualOk ? 1 : 0) : 0);

    return { mainOk, extrasOkCount };
  }

  return [...voted].sort((a, b) => {
    const sa = scoreUser(a);
    const sb = scoreUser(b);

    // 1) quem acertou o vencedor vem primeiro
    if (sa.mainOk !== sb.mainOk) return sa.mainOk ? -1 : 1;

    // 2) dentro do grupo, mais extras certos vem antes
    if (sb.extrasOkCount !== sa.extrasOkCount) return sb.extrasOkCount - sa.extrasOkCount;

    // 3) desempate por nome
    return a.displayName.localeCompare(b.displayName);
  });
}, [voted, isExpired, canScore, match]);

return createPortal(
  <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

    <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950/95 p-5 shadow-2xl">
      {/* Cabeçalho (use headerSubtitle aqui pra sumir o warning) */}
      <div className="text-center">
        <div className="text-xl font-black tracking-wide text-zinc-100">PALPITES REGISTRADOS</div>
        <div className="text-zinc-400 text-xs font-bold mt-1">{headerSubtitle}</div>
      </div>

      {/* Tabs (wrapper que estava faltando no seu trecho) */}
      <div className="mt-4 rounded-2xl bg-white/10 border border-white/10 p-1 flex">
        <button
          type="button"
          onClick={() => setTab("voted")}
          className={[
            "flex-1 py-3 rounded-2xl font-black text-sm transition",
            tab === "voted" ? "bg-green-700 text-white" : "text-zinc-300",
          ].join(" ")}
        >
          VOTARAM ({votedCount})
        </button>

        <button
          type="button"
          onClick={() => setTab("missing")}
          className={[
            "flex-1 py-3 rounded-2xl font-black text-sm transition",
            tab === "missing" ? "bg-red-600 text-white" : "text-zinc-300",
          ].join(" ")}
        >
          NÃO VOTARAM ({missingCount})
        </button>
      </div>

      {/* 7C.2 — texto explicativo quando prazo aberto (no lugar certo) */}
      {!canRevealExtras && (
        <div className="mt-3 text-center text-zinc-400 text-xs font-bold">
          Extras ficam ocultos até encerrar o prazo.
        </div>
      )}

      {/* Conteúdo com scroll */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 max-h-[420px] overflow-auto">
        {loading && <div className="text-zinc-300 text-sm">Carregando…</div>}

        {error && (
          <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-3 text-red-100 text-sm">
            {error}
          </div>
        )}

                {!loading && !error && tab === "voted" && votedSorted.length === 0 && (
          <div className="text-zinc-400 text-sm py-6 text-center">Ninguém votou ainda.</div>
        )}


        {!loading && !error && tab === "missing" && missing.length === 0 && (
          <div className="text-zinc-400 text-sm py-6 text-center">Sem faltosos.</div>
        )}

        {/* ✅ Aqui dentro você mantém o seu bloco voted/missing COMPLETO (map etc.) */}
        {!loading && !error && tab === "voted" && (
          <div className="grid gap-2">
            {votedSorted.map((u) => {
              const img = toImgSrc(u.photoBase64);
              const golsTxt = u.over25Pick === true ? "+2.5" : u.over25Pick === false ? "-2.5" : "—";
              const amTxt = u.bttsPick === true ? "SIM" : u.bttsPick === false ? "NÃO" : "—";
              const clasTxt = askQualifier ? (u.qualifierPick || "—") : null;

const uVote = normalizeVote(u.voteRaw ?? undefined, match);

const mainOk = canScore && !!uVote && !!winnerVote ? uVote === winnerVote : null;

const votedLogo =
  uVote === "A" ? match.teamALogo :
  uVote === "B" ? match.teamBLogo :
  null; // empate não tem logo

              return (
                <div key={u.userId} className="rounded-2xl border border-white/10 bg-white/10 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                        {img ? (
                          <img src={img} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-white font-black text-sm">{initials(u.displayName)}</span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="text-zinc-100 font-black truncate">{u.displayName}</div>

                        {/* ✅ Antes do prazo: só “Votou ✅” */}
                        {!canRevealExtras ? (
                          <div className="mt-2 text-xs text-zinc-300 font-black">Votou ✅</div>
                        ) : (
                          <>
                            <div className="mt-2 flex flex-wrap gap-2 items-center">
                              {pill(toneOver25(u.over25Pick ?? null), `Gols: ${golsTxt}`)}
                              {pill(toneBtts(u.bttsPick ?? null), `AM: ${amTxt}`)}
                              {match.askQualifier && pill(toneQualifier(u.qualifierPick ?? null), `Clas: ${clasTxt}`)}
                            </div>

                            {/* ✅ Após o prazo: mostrar voto principal (igual Android) */}
                            <div className="mt-2 text-xs text-zinc-200 font-black">
                              Voto: {displayMainVote(u.voteRaw, match)}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
  {/* “o que o usuário votou” (logo ou EMPATE) */}
  {isExpired ? (
    uVote === "EMPATE" ? (
      <div className="px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-zinc-100 font-black text-xs">
        EMPATE
      </div>
    ) : (
      <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center overflow-hidden">
        {votedLogo ? (
          <img
            src={toImgSrc(votedLogo) || votedLogo}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="text-zinc-200 font-black text-xs">—</div>
        )}
      </div>
    )
  ) : null}

  {/* ícone de acerto/erro do VOTO PRINCIPAL (só quando tem resultado final) */}
  {isExpired && canScore && mainOk === true && (
    <CheckCircle2 className="text-green-500" />
  )}
  {isExpired && canScore && mainOk === false && (
    <XCircle className="text-red-400" />
  )}
</div>

                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && !error && tab === "missing" && (
          <div className="grid gap-2">
            {missing.map((u) => {
              const img = toImgSrc(u.photoBase64);
              return (
                <div key={u.userId} className="rounded-2xl border border-white/10 bg-white/10 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                        {img ? (
                          <img src={img} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-white font-black text-sm">{initials(u.displayName)}</span>
                        )}
                      </div>
                      <div className="text-zinc-100 font-black truncate">{u.displayName}</div>
                    </div>

                    <Clock3 className="text-red-400 shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button
  onClick={onClose}
  className="mt-4 w-full py-3 rounded-2xl bg-green-700 text-white font-black hover:bg-green-600 transition"
>
  {closeLabel ?? "FECHAR"}
</button>


      <button
        onClick={onClose}
        className="absolute top-3 right-3 w-9 h-9 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition"
        title="Fechar"
      >
        <X className="text-zinc-200" size={18} />
      </button>
    </div>
  </div>,
  document.body
);

}
