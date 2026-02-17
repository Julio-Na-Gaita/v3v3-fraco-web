import { useMemo, useState } from "react";
import type { PollModel } from "../lib/appConfig";
import { voteOnPoll } from "../lib/bolaoApi";

function fmtDeadline(dt: Date | null) {
  if (!dt) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(dt);
  } catch {
    return "";
  }
}

export default function PollWidget({
  poll,
  userId,
}: {
  poll: PollModel;
  userId: string;
}) {
  const [sending, setSending] = useState(false);

  const now = Date.now();
  const isExpired = !!poll.deadline && now > poll.deadline.getTime();
  const isClosed = !poll.active || isExpired;

  const prevIndex = useMemo(() => {
    const raw: any = poll.userVotes?.[userId];
    const n = typeof raw === "number" ? raw : raw != null ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
  }, [poll.userVotes, userId]);

  const totalVotes = useMemo(() => {
    return Object.values(poll.votes || {}).reduce((a, b) => a + (Number(b) || 0), 0);
  }, [poll.votes]);

  const showResults = prevIndex !== null || isClosed;

  async function handleVote(index: number) {
    if (!userId) return;
    if (isClosed) return;
    if (prevIndex === index) return;

    setSending(true);
    try {
      await voteOnPoll(poll.id, userId, index);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mb-3 rounded-3xl border border-[#D4AF37]/60 bg-white/95 text-zinc-900 shadow-xl">
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[10px] font-black tracking-widest text-amber-700">
            📊 ENQUETE
          </div>

          {isExpired ? (
            <div className="text-[10px] font-black text-red-600">ENCERRADA</div>
          ) : poll.deadline ? (
            <div className="text-[11px] font-bold text-zinc-600">
              Até {fmtDeadline(poll.deadline)}
            </div>
          ) : null}
        </div>

        <div className="mt-2 text-[16px] font-black">{poll.question}</div>

        <div className="mt-3 grid gap-2">
          {(poll.options || []).map((opt, idx) => {
            const count =
              (poll.votes?.[String(idx)] ?? (poll.votes as any)?.[idx] ?? 0) as number;

            const pct = totalVotes > 0 ? count / totalVotes : 0;
            const selected = prevIndex === idx;

            return (
              <button
                key={idx}
                type="button"
                disabled={sending || !userId || isClosed}
                onClick={() => handleVote(idx)}
                className={[
                  "relative w-full overflow-hidden rounded-2xl border px-3 py-3 text-left",
                  "bg-zinc-50 border-zinc-200",
                  selected ? "border-amber-600" : "",
                  isClosed ? "opacity-90" : "hover:bg-zinc-100",
                ].join(" ")}
              >
                {totalVotes > 0 && showResults && (
                  <div
                    className={[
                      "absolute inset-y-0 left-0",
                      selected ? "bg-amber-600/80" : "bg-zinc-300/70",
                    ].join(" ")}
                    style={{ width: `${Math.round(pct * 100)}%` }}
                  />
                )}

                <div className="relative flex items-center justify-between gap-3">
                  <div
                    className={[
                      "font-bold text-[13px] truncate",
                      selected && totalVotes > 0 && showResults ? "text-white" : "text-zinc-900",
                    ].join(" ")}
                  >
                    {opt}
                  </div>

                  {totalVotes > 0 && showResults && (
                    <div
                      className={[
                        "text-[12px] font-black",
                        selected ? "text-white" : "text-zinc-800",
                      ].join(" ")}
                    >
                      {Math.round(pct * 100)}%
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-zinc-600">
          <div>{isClosed && prevIndex === null ? "Votação encerrada." : ""}</div>
          <div>{totalVotes > 0 ? `Total: ${totalVotes} votos` : ""}</div>
        </div>
      </div>
    </div>
  );
}
