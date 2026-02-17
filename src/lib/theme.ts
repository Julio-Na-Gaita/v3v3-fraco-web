export type ThemeId = "classic" | "arena" | "dark";

export type ThemeConfig = {
  id: ThemeId;
  name: string;

  // visual
  font: "Bebas" | "Orbitron" | "Pacifico" | "Pixel" | "Creepy";
  radius: number; // px (ex: 28)
  overlay: number; // 0..1 (escurecer o fundo)

  // cores (CSS vars)
  primary: string;
  secondary: string;
  surface: string;
  text: string;

  // experiência
  enableHaptic: boolean;
  soundPack: "pop" | "apito" | "mario" | "metal" | "uepa";
};

export const THEMES: Record<ThemeId, ThemeConfig> = {
  classic: {
    id: "classic",
    name: "Clássico",
    font: "Bebas",
    radius: 28,
    overlay: 0.35,
    primary: "#16a34a",   // verde
    secondary: "#f59e0b", // dourado/laranja
    surface: "rgba(255,255,255,0.78)",
    text: "#ffffff",
    enableHaptic: true,
    soundPack: "pop",
  },
  arena: {
    id: "arena",
    name: "Arena",
    font: "Orbitron",
    radius: 26,
    overlay: 0.30,
    primary: "#22c55e",
    secondary: "#60a5fa",
    surface: "rgba(255,255,255,0.74)",
    text: "#ffffff",
    enableHaptic: true,
    soundPack: "apito",
  },
  dark: {
    id: "dark",
    name: "Dark",
    font: "Pixel",
    radius: 22,
    overlay: 0.45,
    primary: "#34d399",
    secondary: "#a78bfa",
    surface: "rgba(24,24,27,0.78)",
    text: "#ffffff",
    enableHaptic: false,
    soundPack: "metal",
  },
};

const KEY = "v3_theme_v1";

export function loadTheme(): ThemeConfig {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return THEMES.classic;
    const parsed = JSON.parse(raw) as Partial<ThemeConfig>;
    const id = (parsed.id as ThemeId) || "classic";
    return { ...THEMES[id], ...parsed };
  } catch {
    return THEMES.classic;
  }
}

export function saveTheme(t: ThemeConfig) {
  localStorage.setItem(KEY, JSON.stringify(t));
}
