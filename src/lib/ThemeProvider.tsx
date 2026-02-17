import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { type ThemeConfig, THEMES, type ThemeId, loadTheme, saveTheme } from "./theme";

type ThemeCtx = {
  theme: ThemeConfig;
  setThemeId: (id: ThemeId) => void;
  setTheme: (t: ThemeConfig) => void;
};

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeConfig>(() => loadTheme());

  // aplica vars CSS no <html>
  useEffect(() => {
    const r = document.documentElement;

    r.style.setProperty("--v3-primary", theme.primary);
    r.style.setProperty("--v3-secondary", theme.secondary);
    r.style.setProperty("--v3-surface", theme.surface);
    r.style.setProperty("--v3-radius", `${theme.radius}px`);
    r.style.setProperty("--v3-overlay", String(theme.overlay));
    r.style.setProperty("--v3-font", theme.font);

    saveTheme(theme);
  }, [theme]);

  const api = useMemo<ThemeCtx>(() => {
    return {
      theme,
      setTheme: (t) => setTheme(t),
      setThemeId: (id) => setTheme({ ...THEMES[id] }),
    };
  }, [theme]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme must be used inside ThemeProvider");
  return v;
}
