import { MessageSquareText, Eye } from "lucide-react";
import { useEffect, useState } from "react";
import { subscribeCommentsCount, subscribeMatchThermo, type MatchThermo } from "../lib/bolaoApi";
import { useAppConfig } from "../lib/appConfig";

import CommentsModal from "./CommentsModal";
import RegisteredGuessesModal from "./RegisteredGuessesModal";
import MatchDetailsModal from "./MatchDetailsModal";
import type { MatchView, Vote } from "../lib/contracts";

type Props = {
  match: MatchView;
  myVote: Vote | null;
  myExtras: {
    over25Pick?: boolean | null;
    bttsPick?: boolean | null;
    qualifierPick?: string | null;
  } | null;
  onVoteClick: (vote: Vote) => void;

  onSetOver25: (val: boolean | null) => void;
  onSetBtts: (val: boolean | null) => void;
  onSetQualifier: (team: string | null) => void;
};



function LogoBox({
  name,
  logo,
  selected,
  disabled,
  onClick,
}: {
  name: string;
  logo?: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const showImg = !!logo && (logo.startsWith("http") || logo.startsWith("data:image"));
  const initials =
    name && name !== "-"
      ? name
          .split(" ")
          .slice(0, 2)
          .map((s) => s[0]?.toUpperCase())
          .join("")
      : "?";

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={[
  "w-[140px] max-w-[40%] rounded-[var(--v3-radius)] p-3 transition",
  "backdrop-blur border shadow-sm",
  selected
    ? "bg-green-700 border-green-700 ring-2 ring-green-700/30"
    : "bg-white/85 border-white/50",
  disabled ? "opacity-65 cursor-not-allowed" : "hover:shadow-md active:scale-[0.99]",
].join(" ")}


    >
      <div className="w-full aspect-square rounded-[calc(var(--v3-radius)_-_10px)] bg-zinc-100 flex items-center justify-center overflow-hidden">

        {showImg ? (
          <img src={logo} alt={name} className="w-full h-full object-contain" />
        ) : (
          <div className="text-zinc-500 font-black text-2xl">{initials}</div>
        )}
      </div>
      <div
  className={[
    "mt-2 text-center font-black text-sm leading-4",
    selected ? "text-white" : "text-zinc-900",
  ].join(" ")}
>
  {name}
</div>

    </button>
  );
}

function CenterBox({
  allowDraw,
  selected,
  disabled,
  onClick,
}: {
  allowDraw: boolean;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  // quando NÃO permite empate, é só um “X” decorativo como no mata-mata
  if (!allowDraw) {
  return (
    <div className="w-[110px] max-w-[28%] rounded-[var(--v3-radius)] p-3 bg-white/75 border border-white/60 backdrop-blur flex flex-col items-center justify-center text-center">
      <div className="text-zinc-400 font-black text-4xl leading-none">X</div>
    </div>
  );
}

  return (
    <button
      disabled={disabled}
      onClick={onClick}
className={[
  "w-[110px] max-w-[28%] rounded-[var(--v3-radius)] p-3 transition",
  "backdrop-blur border shadow-sm flex flex-col items-center justify-center",
  selected
    ? "bg-green-700 border-green-700 ring-2 ring-green-700/30"
    : "bg-white/80 border-white/50",
  disabled ? "opacity-65 cursor-not-allowed" : "hover:shadow-md active:scale-[0.99]",
].join(" ")}


    >
<div className={[ "font-black text-5xl leading-none", selected ? "text-white" : "text-zinc-300" ].join(" ")}>
  X
</div>
<div className={[ "mt-1 font-black text-xs tracking-wide", selected ? "text-white" : "text-zinc-800" ].join(" ")}>
  EMPATE
</div>

    </button>
  );
}

function isKnockoutRound(round: string) {
  const r = (round ?? "").trim().toLowerCase();
  const isLeague = r.includes("pontos corridos");
  const isGroups = r.includes("fase de grupos");
  return !(isLeague || isGroups);
}

function LegTypeChip({ text }: { text: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-[2px] text-[10px] font-black whitespace-nowrap"
      style={{
        color: "var(--v3-primary)",
        borderColor: "color-mix(in srgb, var(--v3-primary) 28%, transparent)",
        background: "color-mix(in srgb, var(--v3-primary) 12%, transparent)",
      }}
    >
      {text}
    </span>
  );
}

export default function MatchCard({
  match,
  myVote,
  myExtras,
  onVoteClick,
  onSetOver25,
  onSetBtts,
  onSetQualifier,
}: Props) {

const [showComments, setShowComments] = useState(false);
const [showRegistered, setShowRegistered] = useState(false);
const [showDetails, setShowDetails] = useState(false);
const [serverCommentsCount, setServerCommentsCount] = useState(0);
const [lastReadCount, setLastReadCount] = useState(0);
const cfg = useAppConfig();
const enableChat = cfg.enableChat ?? true;

// ✅ termômetro REAL (lê /guesses)
const [thermo, setThermo] = useState<MatchThermo | null>(null);

useEffect(() => {
  const unsub = subscribeMatchThermo(
    match,
    (t) => setThermo(t),
    (err) => console.error(err)
  );
  
  return () => unsub();
}, [match.id]);

useEffect(() => {
  const key = `read_count_${match.id}`;
  const saved = Number(localStorage.getItem(key) ?? "0");
  setLastReadCount(Number.isFinite(saved) ? saved : 0);
}, [match.id]);

useEffect(() => {
  const unsub = subscribeCommentsCount(
    match.id,
    (n) => setServerCommentsCount(n),
    (err) => console.error(err)
  );
  return () => unsub();
}, [match.id]);

// ✅ Igual Android: se o modal estiver aberto e chegar comentário novo, marca como lido
useEffect(() => {
  if (!showComments) return;
  if (serverCommentsCount <= lastReadCount) return;

  const key = `read_count_${match.id}`;
  setLastReadCount(serverCommentsCount);
  localStorage.setItem(key, String(serverCommentsCount));
}, [showComments, serverCommentsCount, lastReadCount, match.id]);


const isClosed = !!match.winner || (match.deadline ? Date.now() > match.deadline.getTime() : false);
const isExpired = match.deadline ? Date.now() > match.deadline.getTime() : false;
const closedLabel = match.deadlineLabel.startsWith("Encerrado");

const hasScore = typeof match.goalsA === "number" && typeof match.goalsB === "number";
const isFinal = /final/i.test(match.round ?? "");

const computedWinner =
  match.winner ??
  (hasScore
    ? match.goalsA! > match.goalsB!
      ? match.teamA
      : match.goalsB! > match.goalsA!
        ? match.teamB
        : "EMPATE"
    : null);
    const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

const winnerSide: "A" | "B" | "D" | null = (() => {
  if (!computedWinner) return null;

  const cw = norm(computedWinner);
  if (cw === "empate") return "D";
  if (cw === norm(match.teamA)) return "A";
  if (cw === norm(match.teamB)) return "B";
  return null;
})();

// ✅ Android: texto “VOTO: ...” (somente nos disponíveis)
const myVoteLabel =
  myVote === "A" ? match.teamA :
  myVote === "B" ? match.teamB :
  myVote === "EMPATE" ? "EMPATE" :
  "";




const votesA = thermo?.votesA ?? (match.votesA ?? 0);
const votesD = thermo?.votesD ?? (match.votesD ?? 0);
const votesB = thermo?.votesB ?? (match.votesB ?? 0);
// ✅ extras (seleções do usuário)
const over25 = myExtras?.over25Pick ?? null; // true=+2.5, false=-2.5, null=sem
const btts = myExtras?.bttsPick ?? null; // true=SIM, false=NÃO, null=sem
const qualifierPick = myExtras?.qualifierPick ?? null;
const showQualifier = !!match.askQualifier;

// ✅ voted = quantos votaram no MAIN (igual Android)
const voted = thermo?.votedMain ?? (votesA + votesD + votesB);

const totalUsers =
  match.totalUsers ?? (voted > 0 ? voted : 0); // fallback simples

// ✅ Android (prazo aberto): só engajamento (votou x não votou)
const pctVoted = totalUsers > 0 ? Math.round((voted / totalUsers) * 100) : 0;
const wVoted = totalUsers > 0 ? (voted / totalUsers) * 100 : 0;
const wNotVoted = totalUsers > 0 ? Math.max(0, 100 - wVoted) : 100;


  // ✅ Android: percentuais por TOTAL de participantes (cinza = não votou)
  const pctA = totalUsers > 0 ? Math.round((votesA / totalUsers) * 100) : 0;
  const pctD = totalUsers > 0 ? Math.round((votesD / totalUsers) * 100) : 0;
  const pctB = totalUsers > 0 ? Math.round((votesB / totalUsers) * 100) : 0;

  const faltosos = totalUsers > 0 ? Math.max(0, totalUsers - voted) : 0;

  // ✅ barras do termômetro (verde / empate / cinza(não votou) / vermelho)
  const wA = totalUsers > 0 ? (votesA / totalUsers) * 100 : 0;
  const wD = totalUsers > 0 ? (votesD / totalUsers) * 100 : 0;
  const wB = totalUsers > 0 ? (votesB / totalUsers) * 100 : 0;
  const wN = totalUsers > 0 ? (faltosos / totalUsers) * 100 : 100;
const showA = votesA > 0;
const showD = match.allowDraw && votesD > 0;
const showN = faltosos > 0;
const showB = votesB > 0;
  // ✅ helper para extras (evita repetição e divide-by-zero)
  const pct = (n: number) => (totalUsers > 0 ? Math.round((n / totalUsers) * 100) : 0);


  return (
    <div className="rounded-[var(--v3-radius)] border border-white/15 shadow-xl overflow-hidden backdrop-blur-md bg-[color:var(--v3-surface)]">

      {/* “plano de fundo” premium */}
      <div
  className="p-4"
  style={{
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.32), rgba(255,255,255,0.10))",
  }}
>
        {/* Cabeçalho */}
        <div className="flex items-start justify-between">
          <div>
            <div className="text-zinc-950 font-black drop-shadow-sm">
  #{match.matchNumber ?? "?"} • {match.competition}
</div>


            {(() => {
  const legLabel =
    match.legType === "IDA"
      ? "IDA"
      : match.legType === "VOLTA"
        ? "VOLTA"
        : match.legType === "UNICO"
          ? "JOGO ÚNICO"
          : "";

  const showLeg = isKnockoutRound(match.round) && !!legLabel;

  return (
    <div className="flex items-center gap-2 text-zinc-500 font-bold text-xs mt-1">
      <span>{match.round}</span>
      {showLeg && <LegTypeChip text={legLabel} />}
    </div>
  );
})()}
            <div
  className={[
    "font-black text-sm mt-2",
    closedLabel ? "text-zinc-600" : "text-red-600",
  ].join(" ")}
>
  {match.deadlineLabel}
</div>

          </div>

          {/* ícones (por enquanto só visual) */}
          <div className="flex items-center gap-2">
            {enableChat && (
  <button
    type="button"
    title="Abrir resenha"
    onClick={() => {
    // ✅ Igual Android: ao abrir, marca como lido (lastReadCount = serverCommentsCount)
    const key = `read_count_${match.id}`;
    setLastReadCount(serverCommentsCount);
    localStorage.setItem(key, String(serverCommentsCount));

    setShowComments(true);
  }}
  className="relative w-10 h-10 rounded-2xl bg-white/70 border border-white/60 backdrop-blur flex items-center justify-center hover:bg-white/80 active:scale-[0.98] transition"
>
  <MessageSquareText size={18} className="text-zinc-700" />

  {/* ✅ Badge: só aparece se tem novos (server > lastRead) */}
  {serverCommentsCount > lastReadCount && (
    <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-[4px] rounded-full bg-red-600 text-white text-[9px] font-black flex items-center justify-center">
      {serverCommentsCount > 9 ? "+" : serverCommentsCount}
    </span>
  )}
</button>
)}

  <button
  type="button"
  title="Palpites registrados"
  onClick={() => setShowRegistered(true)}
  className="w-10 h-10 rounded-2xl bg-white/70 border border-white/60 backdrop-blur flex items-center justify-center hover:bg-white/80 active:scale-[0.98] transition"
>
  <Eye size={18} className="text-zinc-700" />
</button>



          </div>
        </div>

        {/* Corpo (tiles) */}
{isExpired && (hasScore || computedWinner) ? (
  <div className="mt-4 flex items-center justify-between gap-3">
    {/* Time A */}
    <div
  className={[
    "w-[140px] max-w-[40%] rounded-[var(--v3-radius)] p-3 bg-white/85 border border-white/50 shadow-sm backdrop-blur transition",
    winnerSide === "A" ? "ring-2 ring-emerald-500/40" : "",
    winnerSide === "B" ? "opacity-60" : "",
  ].join(" ")}
>
      <div className="w-full aspect-square rounded-[calc(var(--v3-radius)_-_10px)] bg-zinc-100 flex items-center justify-center overflow-hidden">
        {match.teamALogo ? (
          <img src={match.teamALogo} alt={match.teamA} className="w-full h-full object-contain" />
        ) : (
          <div className="text-zinc-500 font-black text-2xl">
            {(match.teamA || "?").split(" ").slice(0, 2).map(s => s[0]?.toUpperCase()).join("")}
          </div>
        )}
      </div>
      <div className="mt-2 text-center font-black text-[28px] leading-none text-zinc-900 tabular-nums">
        {typeof match.goalsA === "number" ? match.goalsA : "—"}
      </div>
    </div>

    {/* Centro (RESULTADO/CAMPEÃO) */}
    <div
  className={[
    "w-[110px] max-w-[28%] rounded-[var(--v3-radius)] p-3 border backdrop-blur flex flex-col items-center justify-center text-center transition",
    winnerSide === "A"
      ? "bg-emerald-600/10 border-emerald-600/25"
      : winnerSide === "B"
        ? "bg-red-600/10 border-red-600/25"
        : "bg-zinc-600/10 border-white/60",
  ].join(" ")}
>
      <div className="text-[10px] font-black text-zinc-700">
        {isFinal ? "CAMPEÃO" : "RESULTADO"}
      </div>

      <div
  className={[
    "mt-1 text-[18px] font-black leading-5",
    isFinal
      ? "text-yellow-700"
      : winnerSide === "B"
        ? "text-red-700"
        : winnerSide === "D"
          ? "text-zinc-700"
          : "text-emerald-700",
  ].join(" ")}
>
  {computedWinner ?? "—"}
</div>

      {hasScore && (
        <div className="mt-1 text-[11px] font-black text-zinc-500 whitespace-nowrap tabular-nums">
          {match.goalsA} x {match.goalsB}
        </div>
      )}
    </div>

    {/* Time B */}
    <div
  className={[
    "w-[140px] max-w-[40%] rounded-[var(--v3-radius)] p-3 bg-white/85 border border-white/50 shadow-sm backdrop-blur transition",
    winnerSide === "B" ? "ring-2 ring-red-500/40" : "",
    winnerSide === "A" ? "opacity-60" : "",
  ].join(" ")}
>
      <div className="w-full aspect-square rounded-[calc(var(--v3-radius)_-_10px)] bg-zinc-100 flex items-center justify-center overflow-hidden">
        {match.teamBLogo ? (
          <img src={match.teamBLogo} alt={match.teamB} className="w-full h-full object-contain" />
        ) : (
          <div className="text-zinc-500 font-black text-2xl">
            {(match.teamB || "?").split(" ").slice(0, 2).map(s => s[0]?.toUpperCase()).join("")}
          </div>
        )}
      </div>
      <div className="mt-2 text-center font-black text-[28px] leading-none text-zinc-900 tabular-nums">
        {typeof match.goalsB === "number" ? match.goalsB : "—"}
      </div>
    </div>
  </div>
) : (
  <>
    <div className="mt-4 flex items-center justify-between gap-3">
      <LogoBox
        name={match.teamA}
        logo={match.teamALogo}
        selected={myVote === "A"}
        disabled={isClosed}
        onClick={() => onVoteClick("A")}
      />

      <CenterBox
        allowDraw={match.allowDraw}
        selected={myVote === "EMPATE"}
        disabled={isClosed}
        onClick={() => onVoteClick("EMPATE")}
      />

      <LogoBox
        name={match.teamB}
        logo={match.teamBLogo}
        selected={myVote === "B"}
        disabled={isClosed}
        onClick={() => onVoteClick("B")}
      />
    </div>

    {/* ✅ Android: “VOTO: ...” só quando prazo está aberto */}
    {!isExpired && !!myVoteLabel && (
      <div className="mt-2 text-center text-xs font-black text-zinc-700">
        VOTO: <span className="text-green-700">{myVoteLabel}</span>
      </div>
    )}
  </>
)}

{/* ✅ EXTRAS (igual Android) */}
<div className="mt-4 grid gap-2">
  {/* Quem classifica */}
  {showQualifier && (
    <div className="rounded-[var(--v3-radius)] p-3 bg-white/60 border border-white/50 backdrop-blur">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm font-black text-zinc-700">Quem classifica?</div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isClosed}
            onClick={() =>
              onSetQualifier(qualifierPick === match.teamA ? null : match.teamA)
            }
            className={[
              "px-4 py-2 rounded-full font-black text-sm transition border",
              qualifierPick === match.teamA
  ? "bg-green-700 text-white border-transparent"
  : "bg-white/75 text-zinc-800 border-white/50"
,
              isClosed ? "opacity-65 cursor-not-allowed" : "hover:shadow-sm active:scale-[0.99]",
            ].join(" ")}
          >
            {match.teamA}
          </button>

          <button
            type="button"
            disabled={isClosed}
            onClick={() =>
              onSetQualifier(qualifierPick === match.teamB ? null : match.teamB)
            }
            className={[
              "px-4 py-2 rounded-full font-black text-sm transition border",
              qualifierPick === match.teamB
  ? "bg-green-700 text-white border-transparent"
  : "bg-white/75 text-zinc-800 border-white/50",
              isClosed ? "opacity-65 cursor-not-allowed" : "hover:shadow-sm active:scale-[0.99]",
            ].join(" ")}
          >
            {match.teamB}
          </button>
        </div>
      </div>
    </div>
  )}

  {/* Gols +2.5/-2.5 e AM SIM/NÃO */}
  <div className="rounded-[var(--v3-radius)] p-3 bg-white/60 border border-white/50 backdrop-blur">
    <div className="flex items-center justify-between gap-3 flex-wrap">
      {/* Gols */}
      <div className="flex items-center gap-2">
        <div className="text-sm font-black text-zinc-700">Gols</div>

        <button
          type="button"
          disabled={isClosed}
          onClick={() => onSetOver25(over25 === true ? null : true)}
          className={[
            "px-4 py-2 rounded-full font-black text-sm transition border",
            over25 === true
              ? "bg-green-700 text-white border-transparent"
  : "bg-white/75 text-zinc-800 border-white/50",
            isClosed ? "opacity-65 cursor-not-allowed" : "hover:shadow-sm active:scale-[0.99]",
          ].join(" ")}
        >
          +2.5
        </button>

        <button
          type="button"
          disabled={isClosed}
          onClick={() => onSetOver25(over25 === false ? null : false)}
          className={[
            "px-4 py-2 rounded-full font-black text-sm transition border",
            over25 === false
              ? "bg-green-700 text-white border-transparent"
  : "bg-white/75 text-zinc-800 border-white/50",
            isClosed ? "opacity-65 cursor-not-allowed" : "hover:shadow-sm active:scale-[0.99]",
          ].join(" ")}
        >
          -2.5
        </button>
      </div>

      {/* AM */}
      <div className="flex items-center gap-2">
        <div className="text-sm font-black text-zinc-700">AM</div>

        <button
          type="button"
          disabled={isClosed}
          onClick={() => onSetBtts(btts === true ? null : true)}
          className={[
            "px-4 py-2 rounded-full font-black text-sm transition border",
            btts === true
                ? "bg-green-700 text-white border-transparent"
  : "bg-white/75 text-zinc-800 border-white/50",
            isClosed ? "opacity-65 cursor-not-allowed" : "hover:shadow-sm active:scale-[0.99]",
          ].join(" ")}
        >
          SIM
        </button>

        <button
          type="button"
          disabled={isClosed}
          onClick={() => onSetBtts(btts === false ? null : false)}
          className={[
            "px-4 py-2 rounded-full font-black text-sm transition border",
            btts === false
             ? "bg-green-700 text-white border-transparent"
  : "bg-white/75 text-zinc-800 border-white/50",
            isClosed ? "opacity-65 cursor-not-allowed" : "hover:shadow-sm active:scale-[0.99]",
          ].join(" ")}
        >
          NÃO
        </button>
      </div>
    </div>
  </div>
</div>

{/* ✅ TERMÔMETRO (igual Android) */}
{isExpired ? (
  // ✅ Prazo encerrado: mostra TUDO (termômetro + extras com percentuais)
  <div className="mt-4">
    {/* Percentuais embaixo dos “cards” */}
    <div className="grid grid-cols-3 items-center text-xs font-black">
      <div className="text-green-700">{pctA}%</div>
      <div className="text-center text-zinc-500">X {pctD}%</div>
      <div className="text-right text-red-600">{pctB}%</div>
    </div>

    <div className="mt-1 text-[11px] text-center text-zinc-500 font-black tracking-wide">
      TERMÔMETRO (CINZA = NÃO VOTOU)
    </div>

    {/* Barra principal: Verde / (Empate) / Cinza / Vermelho */}
    <div className="mt-2 h-[10px] rounded-[5px] overflow-hidden bg-zinc-200">
  <div className="h-full flex w-full">
    {showA && <div style={{ width: `${wA}%` }} className="bg-green-700" />}
    {showA && (showD || showN || showB) && <div className="w-px bg-white/90" />}

    {showD && <div style={{ width: `${wD}%` }} className="bg-zinc-700" />}
    {showD && (showN || showB) && <div className="w-px bg-white/90" />}

    {showN && <div style={{ width: `${wN}%` }} className="bg-zinc-300" />}
    {showN && showB && <div className="w-px bg-white/90" />}

    {showB && <div style={{ width: `${wB}%` }} className="bg-red-600" />}
  </div>
</div>

    {/* Contagens (como no Android) */}
    <div className="mt-2 text-[11px] text-zinc-600 flex items-start justify-between">
  <span>{match.teamA}: {votesA}</span>

  <div className="text-center leading-tight">
    {match.allowDraw && <div>Empate: {votesD}</div>}
    {faltosos > 0 && <div className="font-black">Faltosos: {faltosos}</div>}
  </div>

  <span>{match.teamB}: {votesB}</span>
</div>

    {/* ✅ EXTRAS (layout Android) — SÓ após expirar */}
    <div className="mt-4 rounded-3xl bg-white/70 border border-white/60 p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-black text-zinc-700">✨ EXTRAS</div>
        <div className="text-xs font-black text-zinc-500">1 ponto cada</div>
      </div>

    <div className="mt-3 grid gap-3">
      {/* GOLS */}
      {(() => {
        const yes = thermo?.over25True ?? 0;   // +2.5
        const no  = thermo?.over25False ?? 0;  // -2.5

        const wYes = totalUsers > 0 ? (yes / totalUsers) * 100 : 0;
        const wNo  = totalUsers > 0 ? (no  / totalUsers) * 100 : 0;
        const wNone = totalUsers > 0 ? Math.max(0, 100 - (wYes + wNo)) : 100;

        return (
          <div className="rounded-2xl bg-white/80 border border-white/60 p-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-700/10 border border-green-700/20 flex items-center justify-center">
                <span className="text-green-800 font-black">⚽</span>
              </div>
              <div>
                <div className="text-sm font-black text-zinc-800">GOLS</div>
                <div className="text-xs text-zinc-500 font-bold">Total de gols na partida</div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs font-black">
              <span className="text-green-700">+2.5 {pct(yes)}%</span>
              <span className="text-red-600">-2.5 {pct(no)}%</span>
            </div>

            <div className="mt-2 h-3 rounded-full overflow-hidden bg-zinc-200 border border-white/60">
              <div className="h-full flex">
                <div style={{ width: `${wYes}%` }} className="bg-green-700" />
                <div style={{ width: `${wNone}%` }} className="bg-zinc-300" />
                <div style={{ width: `${wNo}%` }} className="bg-red-600" />
              </div>
            </div>
          </div>
        );
      })()}

      {/* AM */}
      {(() => {
        const yes = thermo?.bttsTrue ?? 0;   // SIM
        const no  = thermo?.bttsFalse ?? 0;  // NÃO

        const wYes = totalUsers > 0 ? (yes / totalUsers) * 100 : 0;
        const wNo  = totalUsers > 0 ? (no  / totalUsers) * 100 : 0;
        const wNone = totalUsers > 0 ? Math.max(0, 100 - (wYes + wNo)) : 100;

        return (
          <div className="rounded-2xl bg-white/80 border border-white/60 p-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-700/10 border border-green-700/20 flex items-center justify-center">
                <span className="text-green-800 font-black">✅</span>
              </div>
              <div>
                <div className="text-sm font-black text-zinc-800">AM</div>
                <div className="text-xs text-zinc-500 font-bold">Ambos marcam?</div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs font-black">
              <span className="text-green-700">SIM {pct(yes)}%</span>
              <span className="text-red-600">NÃO {pct(no)}%</span>
            </div>

            <div className="mt-2 h-3 rounded-full overflow-hidden bg-zinc-200 border border-white/60">
              <div className="h-full flex">
                <div style={{ width: `${wYes}%` }} className="bg-green-700" />
                <div style={{ width: `${wNone}%` }} className="bg-zinc-300" />
                <div style={{ width: `${wNo}%` }} className="bg-red-600" />
              </div>
            </div>
          </div>
        );
      })()}

      {/* CLASSIFICA (se existir) */}
      {match.askQualifier && (() => {
        const a = thermo?.qualifierA ?? 0;
        const b = thermo?.qualifierB ?? 0;

        const wAq = totalUsers > 0 ? (a / totalUsers) * 100 : 0;
        const wBq = totalUsers > 0 ? (b / totalUsers) * 100 : 0;
        const wNq = totalUsers > 0 ? Math.max(0, 100 - (wAq + wBq)) : 100;

        return (
          <div className="rounded-2xl bg-white/80 border border-white/60 p-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-700/10 border border-green-700/20 flex items-center justify-center">
                <span className="text-green-800 font-black">🏆</span>
              </div>
              <div>
                <div className="text-sm font-black text-zinc-800">CLASSIFICA</div>
                <div className="text-xs text-zinc-500 font-bold">Quem avança?</div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs font-black">
              <span className="text-green-700">{match.teamA} {pct(a)}%</span>
              <span className="text-red-600">{match.teamB} {pct(b)}%</span>
            </div>

            <div className="mt-2 h-3 rounded-full overflow-hidden bg-zinc-200 border border-white/60">
              <div className="h-full flex">
                <div style={{ width: `${wAq}%` }} className="bg-green-700" />
                <div style={{ width: `${wNq}%` }} className="bg-zinc-300" />
                <div style={{ width: `${wBq}%` }} className="bg-red-600" />
              </div>
            </div>
          </div>
        );
      })()}
    </div>
    </div>
  </div>
) : (
  // ✅ Prazo aberto: NÃO mostra % A/B/Empate nem extras — só Engajamento
  <div className="mt-4">
    <div className="flex items-center justify-between text-xs font-black text-zinc-600">
      <span>Engajamento da Galera</span>
      <span>{pctVoted}% votaram</span>
    </div>

    <div className="mt-2 h-3 rounded-full overflow-hidden bg-zinc-200 border border-white/60">
      <div className="h-full flex">
        <div style={{ width: `${wVoted}%` }} className="bg-green-700" />
        <div style={{ width: `${wNotVoted}%` }} className="bg-zinc-300" />
      </div>
    </div>

    <div className="mt-1 text-[11px] text-zinc-500 text-right">
      {totalUsers > 0 ? `${voted} de ${totalUsers} participantes` : "— participantes"}
    </div>
  </div>
)}


        
      </div>

{showComments && (
  <CommentsModal
    match={match}
    onClose={() => setShowComments(false)}
  />
)}

{showRegistered && (
  <RegisteredGuessesModal
    match={match}
    isExpired={isExpired}
    onClose={() => setShowRegistered(false)}
  />
)}

{showDetails && (
  <MatchDetailsModal
    match={match}
    myVote={myVote}
    myExtras={myExtras}
    isExpired={isExpired}
    onClose={() => setShowDetails(false)}
  />
)}

    </div>
  );
}
