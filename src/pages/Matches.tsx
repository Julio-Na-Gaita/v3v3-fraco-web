import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Hourglass, Ban, ChevronDown } from "lucide-react";
import AppLayout from "../components/AppLayout";
import MatchCard from "../components/MatchCard";
import NewsTicker from "../components/NewsTicker";
import BannerWidget from "../components/BannerWidget";
import PollWidget from "../components/PollWidget";
import FastVoteModal from "../components/FastVoteModal";

import { useAuth } from "../lib/auth";
import { useAppConfig } from "../lib/appConfig";


import {
  getParticipantsCount,
  setBtts,
  setOver25,
  setQualifierPick,
  subscribeMatches,
  subscribeMyGuesses,
  voteOnMatch,
  type MyGuessMap,
} from "../lib/bolaoApi";

import {
  getMatchStatus,
  normalizeVote,
  statusLabelPt,
  type MatchStatus,
  type MatchView,
  type Vote,
} from "../lib/contracts";

function Section({
  statusKey,
  title,
  items,
  open,
  onToggle,
  emptyText,
  onVote,
  onOver25,
  onBtts,
  onQualifier,
  myGuesses,
}: {
  statusKey: MatchStatus;
  title: string;
  items: MatchView[];
  open: boolean;
  onToggle: () => void;
  emptyText: string;
  onVote: (m: MatchView, v: Vote) => void;
  onOver25: (m: MatchView, v: boolean | null) => void;
  onBtts: (m: MatchView, v: boolean | null) => void;
  onQualifier: (m: MatchView, team: string | null) => void;
  myGuesses: MyGuessMap;
}) {
  const theme = useMemo(() => {
    if (statusKey === "OPEN") {
      return {
        bar: "bg-emerald-500/15 border-emerald-500/25",
        icon: <CheckCircle2 className="w-5 h-5 text-emerald-700" />,
        text: "text-emerald-900",
      };
    }
    if (statusKey === "WAITING") {
      return {
        bar: "bg-amber-400/18 border-amber-500/25",
        icon: <Hourglass className="w-5 h-5 text-amber-700" />,
        text: "text-amber-900",
      };
    }
    return {
      bar: "bg-rose-500/12 border-rose-500/25",
      icon: <Ban className="w-5 h-5 text-rose-700" />,
      text: "text-rose-900",
    };
  }, [statusKey]);

  return (
    <div className="mb-3">
      {/* Aba / Header */}
      <button
        type="button"
        onClick={onToggle}
        className={[
          "w-full rounded-2xl border px-4 py-3",
          "backdrop-blur bg-white/60",
          "flex items-center justify-between",
          theme.bar,
        ].join(" ")}
      >
        <div className="flex items-center gap-2 min-w-0">
          {theme.icon}

          {/* (N) entre o ícone e o texto, igual Android */}
          <div className={["font-black tracking-wide text-sm", theme.text].join(" ")}>
            ({items.length}) {title.toUpperCase()}
          </div>
        </div>

        <ChevronDown
          className={[
            "w-5 h-5 text-zinc-700 transition-transform",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>

      {/* Conteúdo */}
      {open && (
        <div className="mt-3">
          {items.length === 0 ? (
            <div className="text-zinc-500 text-sm font-bold text-center py-6">
              {emptyText}
            </div>
          ) : (
            <div className="grid gap-3">
              {items.map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  myVote={normalizeVote(myGuesses[m.id]?.rawVote, m)}
                  myExtras={myGuesses[m.id] ?? null}
                  onVoteClick={(vote) => onVote(m, vote)}
                  onSetOver25={(val) => onOver25(m, val)}
                  onSetBtts={(val) => onBtts(m, val)}
                  onSetQualifier={(team) => onQualifier(m, team)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Matches() {
  const { user } = useAuth();
  const cfg = useAppConfig();

  const [showFastVote, setShowFastVote] = useState(false);


  const [items, setItems] = useState<MatchView[]>([]);
  const [status, setStatus] = useState<string>("Carregando confrontos...");

  const [participants, setParticipants] = useState<number | null>(null);

  const [myGuesses, setMyGuesses] = useState<MyGuessMap>({});
const [openSec, setOpenSec] = useState<Record<MatchStatus, boolean>>({
  OPEN: true,
  WAITING: false,
  FINISHED: false,
});

  

  // participantes
  useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      const n = await getParticipantsCount();
      setParticipants(n);
    })();
  }, [user?.uid]);

  // matches
  useEffect(() => {
    const unsub = subscribeMatches(
      (list) => {
        setItems(list);
        setStatus(list.length ? "" : "Nenhum confronto encontrado em /matches.");
      },
      (err: any) => {
        console.error(err);
        setStatus(
          "Erro ao ler /matches. " + "Mensagem: " + (err?.message || String(err))
        );
      }
    );
    return () => unsub();
  }, []);

  // meus palpites + extras
  useEffect(() => {
    if (!user?.uid) return;

    const unsub = subscribeMyGuesses(
      user.uid,
      (map) => setMyGuesses(map),
      (err) => console.error(err)
    );

    return () => unsub();
  }, [user?.uid]);

  const itemsWithTotal = useMemo(() => {
    return items.map((m) => ({
      ...m,
      totalUsers:
        typeof m.totalUsers === "number" && m.totalUsers > 0
          ? m.totalUsers
          : participants ?? m.totalUsers,
    }));
  }, [items, participants]);

const pendingMatches = useMemo(() => {
    const now = Date.now();

    return itemsWithTotal
      .filter((m) => {
        const dlOk = !!m.deadline && now < m.deadline.getTime();
        const hasMainVote = !!myGuesses[m.id]?.rawVote;
        return dlOk && !hasMainVote;
      })
      .sort((a, b) => (a.deadline?.getTime() ?? 0) - (b.deadline?.getTime() ?? 0));
  }, [itemsWithTotal, myGuesses]);
  const grouped = useMemo(() => {
  const g: Record<MatchStatus, MatchView[]> = { OPEN: [], WAITING: [], FINISHED: [] };

  for (const m of itemsWithTotal) g[getMatchStatus(m)].push(m);

  const num = (m: MatchView) =>
    typeof m.matchNumber === "number" ? m.matchNumber : Number.MAX_SAFE_INTEGER;

  const asc = (a: MatchView, b: MatchView) => num(a) - num(b);
  const desc = (a: MatchView, b: MatchView) => num(b) - num(a);

  // ✅ OPEN e WAITING: menor → maior
  g.OPEN.sort(asc);
  g.WAITING.sort(asc);

  // ✅ FINISHED: maior → menor
  g.FINISHED.sort(desc);

  return g;
}, [itemsWithTotal]);


  async function handleVote(m: MatchView, vote: Vote) {
    if (!user?.uid) return;

    // UI instantânea
    setMyGuesses((prev) => ({
      ...prev,
      [m.id]: { ...(prev[m.id] ?? {}), rawVote: vote },
    }));

    await voteOnMatch(m, user.uid, vote);
  }

  async function handleOver25(m: MatchView, value: boolean | null) {
    if (!user?.uid) return;

    setMyGuesses((prev) => ({
      ...prev,
      [m.id]: { ...(prev[m.id] ?? {}), over25Pick: value },
    }));

    await setOver25(m.id, user.uid, value);
  }

  async function handleBtts(m: MatchView, value: boolean | null) {
    if (!user?.uid) return;

    setMyGuesses((prev) => ({
      ...prev,
      [m.id]: { ...(prev[m.id] ?? {}), bttsPick: value },
    }));

    await setBtts(m.id, user.uid, value);
  }

  async function handleQualifier(m: MatchView, team: string | null) {
    if (!user?.uid) return;

    setMyGuesses((prev) => ({
      ...prev,
      [m.id]: { ...(prev[m.id] ?? {}), qualifierPick: team },
    }));

    await setQualifierPick(m.id, user.uid, team);
  }

  return (
    <AppLayout>
      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="text-4xl font-bebas tracking-wide">Confrontos</h2>
          
        </div>
      </div>

      {status && (
        <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-200 mb-4">
          {status}
        </div>
      )}

            {cfg.layoutOrder.map((type, idx) => {
        // widgets
        if (type === "ticker") {
          return <NewsTicker key={`${type}_${idx}`} phrases={cfg.adminPhrases} />;
        }

        if (type === "poll") {
          return cfg.poll ? (
            <PollWidget key={`${type}_${idx}`} poll={cfg.poll} userId={user?.uid || ""} />
          ) : null;
        }

        if (type === "banner") {
          const b = cfg.banners?.[0];
          return b ? <BannerWidget key={`${type}_${idx}`} banner={b} /> : null;
        }

        if (type.startsWith("banner_")) {
          const id = type.replace("banner_", "");
          const b = (cfg.banners || []).find((x) => x.id === id);
          return b ? <BannerWidget key={`${type}_${idx}`} banner={b} /> : null;
        }

        if (type === "fast_vote") {
          if (!cfg.enableFastVote) return null;
          if (!user?.uid) return null;

          const count = pendingMatches.length;
          if (count <= 0) return null;

          return (
            <button
              key={`${type}_${idx}`}
              type="button"
              onClick={() => setShowFastVote(true)}
              className="mb-3 w-full h-12 rounded-full bg-amber-600 hover:bg-amber-500 text-white font-black tracking-wide"
            >
              ⚡ VOTAR RÁPIDO ({count})
            </button>
          );
        }

        // seções (matches)
        if (type === "matches_open") {
          return (
            <Section
              key={`${type}_${idx}`}
              statusKey="OPEN"
              title={statusLabelPt("OPEN")}
              items={grouped.OPEN}
              open={openSec.OPEN}
              onToggle={() => setOpenSec((p) => ({ ...p, OPEN: !p.OPEN }))}
              emptyText="Nenhum confronto disponível no momento."
              onVote={handleVote}
              onOver25={handleOver25}
              onBtts={handleBtts}
              onQualifier={handleQualifier}
              myGuesses={myGuesses}
            />
          );
        }

        if (type === "matches_wait") {
          return (
            <Section
              key={`${type}_${idx}`}
              statusKey="WAITING"
              title={statusLabelPt("WAITING")}
              items={grouped.WAITING}
              open={openSec.WAITING}
              onToggle={() => setOpenSec((p) => ({ ...p, WAITING: !p.WAITING }))}
              emptyText="Nenhum confronto aguardando resultado."
              onVote={handleVote}
              onOver25={handleOver25}
              onBtts={handleBtts}
              onQualifier={handleQualifier}
              myGuesses={myGuesses}
            />
          );
        }

        if (type === "matches_done") {
          return (
            <Section
              key={`${type}_${idx}`}
              statusKey="FINISHED"
              title={statusLabelPt("FINISHED")}
              items={grouped.FINISHED}
              open={openSec.FINISHED}
              onToggle={() => setOpenSec((p) => ({ ...p, FINISHED: !p.FINISHED }))}
              emptyText="Nenhum confronto finalizado ainda."
              onVote={handleVote}
              onOver25={handleOver25}
              onBtts={handleBtts}
              onQualifier={handleQualifier}
              myGuesses={myGuesses}
            />
          );
        }

        return null;
      })}

      {showFastVote && (
        <FastVoteModal
          matches={pendingMatches}
          onClose={() => setShowFastVote(false)}
          onVote={handleVote}
        />
      )}


    </AppLayout>
  );
}
