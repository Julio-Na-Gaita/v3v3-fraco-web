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

function getRowName(row: any) {
  // tenta campos comuns
  const candidates = [
    row?.displayName,
    row?.name,
    row?.username,
    row?.userName,
    row?.nome,
  ]
    .map((x) => (x == null ? "" : String(x).trim()))
    .filter(Boolean);

  // se o "nome" vier só número, ignora e tenta o próximo
  for (const c of candidates) {
    if (!/^\d+([.,]\d+)?$/.test(c)) return c;
  }

  return String(row?.userId || "—");
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
const SHOW_ALL_UP_TO = 7; // <=7: mostra todos
const TOP = 3;            // top 3 sempre

const idxMe = rankingList.findIndex((r) => r.userId === user.userId);

type RankLine =
  | { kind: "row"; row: RankingUserRow; pos: number; isMe: boolean }
  | { kind: "ellipsis" };

let rows: RankLine[] = [];

if (!rankingList.length) {
  rows = [];
} else if (rankingList.length <= SHOW_ALL_UP_TO) {
  // ✅ ranking pequeno: mostra TODOS (igual Android)
  rows = rankingList.map((r, i) => ({
    kind: "row",
    row: r,
    pos: i + 1,
    isMe: r.userId === user.userId,
  }));
} else if (idxMe >= 0) {
  // ✅ ranking grande: Top 3 + ... + (posição anterior) + (minha posição)
  // caso especial: se eu estiver em 4º, não faz sentido "..." + 3º + 4º (3º já está no Top 3)
  if (idxMe <= 3) {
    // mostra top 5 quando eu estou bem perto do topo
    rows = rankingList.slice(0, Math.min(5, rankingList.length)).map((r, i) => ({
      kind: "row",
      row: r,
      pos: i + 1,
      isMe: r.userId === user.userId,
    }));
  } else {
    const prev = idxMe - 1;

    rows = [
      ...rankingList.slice(0, TOP).map((r, i) => ({
        kind: "row" as const,
        row: r,
        pos: i + 1,
        isMe: r.userId === user.userId,
      })),
      { kind: "ellipsis" as const },
      {
        kind: "row" as const,
        row: rankingList[prev],
        pos: prev + 1,
        isMe: false,
      },
      {
        kind: "row" as const,
        row: rankingList[idxMe],
        pos: idxMe + 1,
        isMe: true,
      },
    ];
  }
} else {
  // fallback: não achou o usuário (mostra top 5)
  rows = rankingList.slice(0, Math.min(5, rankingList.length)).map((r, i) => ({
    kind: "row",
    row: r,
    pos: i + 1,
    isMe: false,
  }));
}





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
  if (it.kind === "ellipsis") {
    return (
      <div key={`ellipsis-${i}`} className="px-4 py-2 text-center text-zinc-500 font-black">
        …
      </div>
    );
  }

  const r = it.row;
  const isMe = it.isMe;
  const posNum = it.pos;

  return (
    <div
      key={`${r.userId}-${posNum}`}
className={`px-4 py-2 flex items-center justify-between ${
        isMe ? "bg-yellow-200/80" : "bg-transparent"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-8 text-right font-black ${posNum <= 3 ? "text-orange-600" : "text-zinc-900"}`}>
          {posNum}°
        </div>
       <div className="font-black text-[13px] text-zinc-900 truncate">
  {getRowName(r)}
</div>

      </div>

      <div className={`font-black ${isMe ? "text-emerald-700" : "text-zinc-900"}`}>
        {r.points}
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
