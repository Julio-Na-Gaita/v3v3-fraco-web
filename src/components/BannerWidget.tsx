import type { BannerModel } from "../lib/appConfig";

function open(url: string) {
  const u = (url || "").trim();
  if (!u) return;
  try {
    window.open(u, "_blank", "noopener,noreferrer");
  } catch {
    // ignore
  }
}

export default function BannerWidget({ banner }: { banner: BannerModel }) {
  if (!banner?.active) return null;

  const type = (banner.type || "full").toLowerCase();

  if (type === "double") {
    return (
      <div className="mb-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => open(banner.targetUrl)}
          className="h-[120px] rounded-2xl overflow-hidden border border-white/10 bg-white/5"
          title={banner.name || "Banner"}
        >
          {banner.imageUrl ? (
            <img
              src={banner.imageUrl}
              alt={banner.name || "Banner"}
              className="w-full h-full object-cover"
            />
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => open(banner.targetUrl2)}
          className="h-[120px] rounded-2xl overflow-hidden border border-white/10 bg-white/5"
          title={banner.name || "Banner 2"}
        >
          {banner.imageUrl2 ? (
            <img
              src={banner.imageUrl2}
              alt={(banner.name || "Banner") + " 2"}
              className="w-full h-full object-cover"
            />
          ) : null}
        </button>
      </div>
    );
  }

  const h = type === "small" ? "h-[60px]" : "h-[140px]";
  return (
    <button
      type="button"
      onClick={() => open(banner.targetUrl)}
      className={[
        "mb-3 w-full rounded-2xl overflow-hidden",
        "border border-white/10 bg-white/5",
        h,
      ].join(" ")}
      title={banner.name || "Banner"}
    >
      {banner.imageUrl ? (
        <img
          src={banner.imageUrl}
          alt={banner.name || "Banner"}
          className="w-full h-full object-cover"
        />
      ) : null}
    </button>
  );
}
