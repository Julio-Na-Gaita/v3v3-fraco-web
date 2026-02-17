import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  where,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./firebase";

type AdminPhrase = { text: string; color: string };

export type BannerModel = {
  id: string;
  name: string;
  type: string; // "full" | "split" | etc
  imageUrl: string;
  targetUrl: string;
  imageUrl2: string;
  targetUrl2: string;
  active: boolean;
};

export type PollModel = {
  id: string;
  question: string;
  options: string[];
  votes: Record<string, number>;
  userVotes: Record<string, number>;
  active: boolean;
  deadline: Date | null;
};

export type AppConfigState = {
  // flags (iguais Android)
  enableChat: boolean;
  enableScout: boolean;
  enableFastVote: boolean;

  // fundos dinâmicos (iguais Android)
  bgHome: string;
  bgRanking: string;
  bgPerfil: string;

  // layout e widgets
  layoutOrder: string[];
  adminPhrases: AdminPhrase[];
  banners: BannerModel[];
  poll: PollModel | null;

  // opcional (igual Android)
  minVersionCode: number;
  bannerActive: boolean;
  bannerData: DocumentData | null;

  // “gatilho” para forçar re-render/refresh quando admin mexe em app_state
  refreshKey: number;

  loading: boolean;
};

const DEFAULT_LAYOUT = [
  "ticker",
  "fast_vote",
  "matches_open",
  "matches_wait",
  "matches_done",
];

const Ctx = createContext<AppConfigState | null>(null);

function tsToDateLoose(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v?.toDate === "function") return v.toDate(); // Firestore Timestamp
  if (typeof v === "number") return new Date(v);
  return null;
}

function convertDriveLink(url: string) {
  const u = String(url || "").trim();
  if (!u) return "";
  // Drive share: https://drive.google.com/file/d/<ID>/view?...
  const m = u.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (m?.[1]) return `https://drive.google.com/uc?export=view&id=${m[1]}`;
  return u;
}

/**
 * Android geralmente salva cor como "AARRGGBB" (ex: "FFEF6C00")
 * CSS prefere rgba() ou #RRGGBB.
 */
function androidHexToCss(hexRaw: string) {
  const raw = String(hexRaw || "").replace("#", "").trim();
  if (!raw) return "rgba(239,108,0,1)"; // fallback laranja

  const hex = raw.toUpperCase();

  // AARRGGBB
  if (hex.length === 8) {
    const a = parseInt(hex.slice(0, 2), 16) / 255;
    const r = parseInt(hex.slice(2, 4), 16);
    const g = parseInt(hex.slice(4, 6), 16);
    const b = parseInt(hex.slice(6, 8), 16);
    return `rgba(${r},${g},${b},${Number.isFinite(a) ? a.toFixed(3) : 1})`;
  }

  // RRGGBB
  if (hex.length === 6) return `#${hex}`;

  return "rgba(239,108,0,1)";
}

export function AppConfigProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppConfigState>({
    enableChat: true,
    enableScout: true,
    enableFastVote: true,

    bgHome: "",
    bgRanking: "",
    bgPerfil: "",

    layoutOrder: DEFAULT_LAYOUT,
    adminPhrases: [],
    banners: [],
    poll: null,

    minVersionCode: 0,
    bannerActive: false,
    bannerData: null,

    refreshKey: 0,
    loading: true,
  });

  useEffect(() => {
    // 1) settings/config (flags + fundos)
    const unsubConfig = onSnapshot(doc(db, "settings", "config"), (snap) => {
      const d = snap.data() || {};
      setState((prev) => ({
        ...prev,
        minVersionCode: Number(d?.min_version_code ?? 0) || 0,
        bannerActive: d?.banner_active === true,
        bannerData: d?.banner_active === true ? d : null,

        enableChat: d?.enable_chat ?? true,
        enableScout: d?.enable_scout ?? true,
        enableFastVote: d?.enable_fast_vote ?? true,

        bgHome: convertDriveLink(d?.bg_home ?? ""),
        bgRanking: convertDriveLink(d?.bg_ranking ?? ""),
        bgPerfil: convertDriveLink(d?.bg_perfil ?? ""),

        loading: false,
      }));
    });

    // 2) settings/home_layout (ordem)
    const unsubLayout = onSnapshot(doc(db, "settings", "home_layout"), (snap) => {
      const d = snap.data() || {};
      const list = Array.isArray(d?.order) ? (d.order as any[]) : null;
      const order = list ? list.map((x) => String(x)) : DEFAULT_LAYOUT;
      setState((prev) => ({ ...prev, layoutOrder: order }));
    });

    // 3) settings/news (ticker/frases)
    const unsubNews = onSnapshot(doc(db, "settings", "news"), (snap) => {
      const d = snap.data() || {};
      const items = Array.isArray(d?.items) ? (d.items as any[]) : [];
      const phrases: AdminPhrase[] = [];

      for (const it of items) {
        if (typeof it === "string") {
          const t = it.trim();
          if (t) phrases.push({ text: `   ${t}   |`, color: "rgba(239,108,0,1)" });
          continue;
        }
        if (it && typeof it === "object") {
          const text = String((it as any)?.text ?? "").trim();
          const colorHex = String((it as any)?.color ?? "FFEF6C00");
          if (text) phrases.push({ text: `   ${text}   |`, color: androidHexToCss(colorHex) });
        }
      }

      setState((prev) => ({ ...prev, adminPhrases: phrases }));
    });

    // 4) banners ativos
    const qBanners = query(collection(db, "banners"), where("active", "==", true));
    const unsubBanners = onSnapshot(qBanners, (snap) => {
      const list: BannerModel[] = snap.docs.map((docu) => {
        const d = docu.data() || {};
        return {
  id: docu.id,
  name: String(d?.name ?? ""),
  type: String(d?.type ?? "full"),
  imageUrl: convertDriveLink(String(d?.imageUrl ?? "")),
  targetUrl: String(d?.targetUrl ?? ""),
  imageUrl2: convertDriveLink(String(d?.imageUrl2 ?? "")),
  targetUrl2: String(d?.targetUrl2 ?? ""),
  active: d?.active === true,
};

      });
      setState((prev) => ({ ...prev, banners: list }));
    });

    // 5) enquete ativa
    const qPoll = query(collection(db, "polls"), where("active", "==", true), limit(1));
    const unsubPoll = onSnapshot(qPoll, (snap) => {
      const docu = snap.docs[0];
      if (!docu) {
        setState((prev) => ({ ...prev, poll: null }));
        return;
      }
      const d = docu.data() || {};
      setState((prev) => ({
        ...prev,
        poll: {
          id: docu.id,
          question: String(d?.question ?? ""),
          options: Array.isArray(d?.options) ? d.options.map((x: any) => String(x)) : [],
          votes: (d?.votes && typeof d.votes === "object" ? d.votes : {}) as Record<string, number>,
          userVotes: (d?.userVotes && typeof d.userVotes === "object" ? d.userVotes : {}) as Record<
            string,
            number
          >,
          active: d?.active === true,
          deadline: tsToDateLoose(d?.deadline),
        },
      }));
    });

    // 6) settings/app_state (gatilho “ao vivo”)
    const unsubAppState = onSnapshot(doc(db, "settings", "app_state"), () => {
      setState((prev) => ({ ...prev, refreshKey: prev.refreshKey + 1 }));
    });

    return () => {
      unsubConfig();
      unsubLayout();
      unsubNews();
      unsubBanners();
      unsubPoll();
      unsubAppState();
    };
  }, []);

  const value = useMemo(() => state, [state]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppConfig() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppConfig deve ser usado dentro de <AppConfigProvider />");
  return ctx;
}
