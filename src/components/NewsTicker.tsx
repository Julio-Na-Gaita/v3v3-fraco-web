export default function NewsTicker({
  phrases,
}: {
  phrases: { text: string; color: string }[];
}) {
  if (!phrases || phrases.length === 0) return null;

  // repete pra ficar sempre “cheio”
  const stream = [...phrases, ...phrases, ...phrases];

  return (
    <div className="mb-3 rounded-t-xl border-2 border-[#D4AF37] bg-zinc-900/90 overflow-hidden">
      <div className="py-2 px-2 v3-marquee">
        <div className="v3-marquee__inner">
          {stream.map((p, idx) => (
            <span
              key={idx}
              className="font-black text-[12px]"
              style={{ color: p.color }}
            >
              {p.text}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
