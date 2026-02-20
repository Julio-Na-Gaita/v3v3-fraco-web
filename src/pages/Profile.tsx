import AppLayout from "../components/AppLayout";
import { useTheme } from "../lib/ThemeProvider";
import { THEMES } from "../lib/theme";
import { useState } from "react";
import { Shield } from "lucide-react";
import { useAuth } from "../lib/auth";
import AdminPanelModal from "../components/AdminPanelModal";

function ThemePicker() {
  const { theme, setThemeId } = useTheme();

  return (
    <div className="mt-4 p-4 rounded-[var(--v3-radius)] bg-[color:var(--v3-surface)] border border-white/15 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-lg font-black">Tema</div>
          <div className="text-xs text-white/70">
            Troque cores / fonte / intensidade do fundo (igual Android)
          </div>
        </div>

        <div
          className="px-3 py-1 rounded-full text-xs font-black"
          style={{ backgroundColor: "var(--v3-primary)" }}
        >
          {theme.name}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
        {Object.values(THEMES).map((t) => {
          const active = t.id === theme.id;

          return (
            <button
              key={t.id}
              onClick={() => setThemeId(t.id)}
              className={[
                "text-left p-3 rounded-[var(--v3-radius)] border transition",
                active ? "border-white/40" : "border-white/15 hover:border-white/25",
              ].join(" ")}
              style={{
                background: active
                  ? "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.02))"
                  : "rgba(0,0,0,0.20)",
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-black">{t.name}</div>

                <div className="flex gap-1">
                  <span
                    className="w-4 h-4 rounded-full border border-white/20"
                    style={{ backgroundColor: t.primary }}
                  />
                  <span
                    className="w-4 h-4 rounded-full border border-white/20"
                    style={{ backgroundColor: t.secondary }}
                  />
                </div>
              </div>

              <div className="mt-1 text-xs text-white/70">
                Fonte: <span className="font-black">{t.font}</span> • Radius:{" "}
                <span className="font-black">{t.radius}px</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const [showAdmin, setShowAdmin] = useState(false);

  return (
    <AppLayout>
      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="text-4xl font-bebas tracking-wide">Perfil</h2>
          <p className="text-zinc-300 text-sm font-orbitron tracking-wide">
            Ajustes do app (tema, fonte e experiência)
          </p>
        </div>

        {user?.isAdmin && (
          <button
            onClick={() => setShowAdmin(true)}
            className="px-4 py-3 rounded-2xl bg-emerald-600/90 hover:bg-emerald-600 text-white font-black border border-emerald-500/30 transition inline-flex items-center gap-2"
            title="Painel Admin"
          >
            <Shield size={18} /> PAINEL ADMIN
          </button>
        )}
      </div>

      <ThemePicker />

      {showAdmin && <AdminPanelModal onClose={() => setShowAdmin(false)} />}
    </AppLayout>
  );
}