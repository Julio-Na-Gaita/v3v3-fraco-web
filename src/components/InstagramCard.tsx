import { type RankingUserRow } from "../lib/rankingApi";

function toImgSrc(photoBase64?: string) {
  if (!photoBase64) return "";
  if (photoBase64.startsWith("http") || photoBase64.startsWith("data:image")) return photoBase64;
  return `data:image/jpeg;base64,${photoBase64}`;
}

function distinctMedals(medals: string[]) {
  const out: string[] = [];
  for (const m of medals || []) {
    if (!m) continue;
    if (!out.includes(m)) out.push(m);
    if (out.length >= 4) break; // igual Android (mostra poucos ícones)
  }
  return out;
}

export default function InstagramCard({
  user,
  rankingList,
  seasonLabel = "TEMPORADA 2026",
  instagramHandle = "@bolao112fc",
}: {
  user: RankingUserRow;
  rankingList: RankingUserRow[];
  seasonLabel?: string;
  instagramHandle?: string;
}) {
  const photo = toImgSrc(user.photoBase64);
  const medals = distinctMedals(user.medals || []);

// --- Ranking geral (100% Android)
const totalParticipants = rankingList.length;
const maxRows = 7;

const myIndex = rankingList.findIndex((r) => r.userId === user.userId);

type RankLine =
  | { kind: "row"; row: RankingUserRow; isMe: boolean }
  | { kind: "sep" };

let rows: RankLine[] = [];

if (!totalParticipants) {
  rows = [];
} else if (totalParticipants <= maxRows) {
  // <=7: mostra todos
  rows = rankingList.map((r) => ({
    kind: "row",
    row: r,
    isMe: r.userId === user.userId,
  }));
} else if (myIndex >= 0 && myIndex < maxRows) {
  // se eu estiver dentro das 7 primeiras posições: mostra top 7 inteiro (SEM "...")
  rows = rankingList.slice(0, maxRows).map((r) => ({
    kind: "row",
    row: r,
    isMe: r.userId === user.userId,
  }));
} else if (myIndex >= 0) {
  // padrão: top 3 + "..." + (anterior + eu + próximo)
  const top3 = rankingList.slice(0, 3).map((r) => ({
    kind: "row" as const,
    row: r,
    isMe: r.userId === user.userId,
  }));

  const start = Math.max(3, myIndex - 1);
  const end = Math.min(totalParticipants, myIndex + 2); // slice end é exclusivo
  const neighborhood = rankingList.slice(start, end).map((r) => ({
    kind: "row" as const,
    row: r,
    isMe: r.userId === user.userId,
  }));

  rows = [...top3, { kind: "sep" as const }, ...neighborhood];
} else {
  // fallback: se não achou o usuário, mostra top 7
  rows = rankingList.slice(0, maxRows).map((r) => ({
    kind: "row",
    row: r,
    isMe: false,
  }));
}

// Android também mostra “... e mais X guerreiros...”
const shownCount = rows.filter((x) => x.kind === "row").length;
const remainingCount = Math.max(0, totalParticipants - shownCount);






  return (
    <div className="w-[360px] h-[640px] rounded-[28px] overflow-hidden shadow-2xl relative">
      {/* fundo */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(10,80,55,1) 0%, rgba(7,50,38,1) 45%, rgba(0,0,0,1) 100%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.14]"
        style={{ background: "radial-gradient(circle at 30% 20%, #ffffff 0%, transparent 55%)" }}
      />
      <div
        className="absolute inset-0 opacity-[0.10]"
        style={{ background: "radial-gradient(circle at 70% 55%, #ffffff 0%, transparent 60%)" }}
      />

      <div className="relative h-full p-4 flex flex-col">
        {/* topo */}
        <div className="text-center">
          <div className="text-[28px] font-black tracking-wide text-yellow-300 drop-shadow">
            V3v3 é Fraco FC
          </div>

          <div className="mt-2 inline-flex items-center justify-center rounded-xl bg-black/55 border border-yellow-300/25 px-4 py-2">
            <span className="text-yellow-200 font-black text-[13px]">{seasonLabel}</span>
          </div>
        </div>

        {/* perfil */}
        <div className="mt-4 flex flex-col items-center">
          <div className="w-[92px] h-[92px] rounded-full border-[4px] border-yellow-400 shadow-lg overflow-hidden bg-black/25">
            {photo ? (
              <img src={photo} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/80 font-black">?</div>
            )}
          </div>

          <div className="mt-2 text-white text-[22px] font-black tracking-wide">
            {(user.displayName || "").toUpperCase()}
          </div>

          <div className="mt-2 flex items-center gap-3">
            <div className="flex items-center gap-2 text-[18px]">
              {medals.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>

            <div className="flex items-center gap-2 text-yellow-300 font-black">
              <span className="text-[18px]">🎯</span>
              <span className="text-[18px]">{user.points} PONTOS</span>
            </div>
          </div>
        </div>

        {/* ranking */}
    <div className="mt-4 rounded-2xl bg-white/95 shadow-xl overflow-hidden">


          <div className="px-4 py-2 border-b border-zinc-200 flex items-center justify-between">
            <div className="text-zinc-900 font-black text-[14px]">
              RANKING GERAL ({rankingList.length})
            </div>
            <div className="text-zinc-500 font-black text-[12px]">PTS</div>
          </div>

          <div className="divide-y divide-zinc-200">
            {rows.map((it, i) => {
  if (it.kind === "sep") {
    return (
      <div key={`sep-${i}`} className="px-4 py-2 text-center text-zinc-500 font-black">
        ...
      </div>
    );
  }

  const r = it.row;
  const isMe = it.isMe;

  // ✅ Android calcula a posição real procurando no ranking original
  const realRank = rankingList.findIndex((x) => x.userId === r.userId) + 1;

  return (
    <div
      key={`${r.userId}-${realRank}`}
      className={`px-4 py-2 flex items-center justify-between ${
        isMe ? "bg-yellow-200/80" : "bg-transparent"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-8 text-right font-black ${realRank <= 3 ? "text-orange-600" : "text-zinc-900"}`}>
          {realRank}°
        </div>

        {/* ✅ nome */}
        <div className="font-black text-[13px] text-zinc-900 truncate">
          {r.displayName}
        </div>
      </div>

      {/* ✅ pontos */}
      <div className={`font-black ${isMe ? "text-emerald-700" : "text-zinc-900"}`}>
        {r.points}
        {remainingCount > 0 ? (
  <div className="px-4 py-2 text-center text-[11px] text-emerald-800 font-black">
    👇 ... e mais {remainingCount} guerreiros na disputa!
  </div>
) : null}

      </div>
    </div>
  );
})}


          </div>
        </div>

        {/* CTA */}
        <div className="mt-4 rounded-2xl bg-yellow-400 shadow-xl px-4 py-4 text-center">
          <div className="text-zinc-900 font-black text-[14px]">VEM PRO JOGO TAMBÉM!</div>
          <div className="mt-2 text-zinc-900 font-black text-[16px]">🌐 Siga {instagramHandle}</div>
          <div className="mt-1 text-zinc-900/70 font-black text-[11px]">✨ CONFIRA O LINK NA BIO</div>
        </div>
      </div>
    </div>
  );
}
