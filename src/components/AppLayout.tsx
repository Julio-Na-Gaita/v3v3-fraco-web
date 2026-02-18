import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useAppConfig } from "../lib/appConfig";
import bgHome from "../assets/android/bg/bg_home.png";
import bgRanking from "../assets/android/bg/bg_ranking.png";
import bgPerfil from "../assets/android/bg/bg_perfil.png";


function NavItem({ to, label }: { to: string; label: string }) {
  const { pathname } = useLocation();
  const active = pathname === to;

  return (
    <Link
      to={to}
      className={[
        "px-4 py-2 rounded-xl text-sm font-black tracking-wide transition",
        active
          ? "bg-zinc-100 text-zinc-900 shadow"
          : "text-zinc-200 hover:bg-zinc-800 hover:text-zinc-50",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();


const cfg = useAppConfig();

// ✅ Fundo por tela (agora: Firestore -> fallback local)
const bg =
  pathname.startsWith("/ranking")
    ? (cfg.bgRanking || bgRanking)
    : 
    pathname.startsWith("/perfil")
      ? (cfg.bgPerfil || bgPerfil)
      : (cfg.bgHome || bgHome);


  return (
    <div
  className="min-h-screen text-white v3-font"
      style={{
        backgroundImage: `url(${bg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* ✅ overlay pra legibilidade (igual sensação do Android) */}
      <div
  className="min-h-screen"
  style={{ backgroundColor: `rgba(0,0,0,var(--v3-overlay))` }}
>

        <div className="min-h-full">
          {/* Top bar */}
          <div className="sticky top-0 z-10 backdrop-blur bg-zinc-950/80 border-b border-zinc-800">
            <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-zinc-100 text-zinc-900 flex items-center justify-center font-black">
                  V3
                </div>
                <div>
                  <div className="text-2xl leading-5 font-bebas tracking-wide">
  V3v3 é Fraco FC
</div>


                  <div className="text-xs text-zinc-300 font-orbitron tracking-wider">
  Versão Web
</div>

                </div>
              </div>

              <div className="hidden sm:flex items-center gap-2">
  <NavItem to="/confrontos" label="CONFRONTOS" />
<NavItem to="/ranking" label="RANKING" />
<NavItem to="/perfil" label="PERFIL" />


  {user && (
    <button
      onClick={logout}
      className="px-4 py-2 rounded-xl text-sm font-black tracking-wide transition
                 bg-white/10 hover:bg-white/15 text-zinc-100 border border-white/10"
      title="Sair"
    >
      SAIR
    </button>
  )}
</div>

            </div>

            {/* Mobile tabs */}
            <div className="sm:hidden max-w-5xl mx-auto px-4 pb-3 flex gap-2">
              <NavItem to="/confrontos" label="CONFRONTOS" />
<NavItem to="/ranking" label="RANKING" />
<NavItem to="/perfil" label="PERFIL" />

            </div>
          </div>

          {/* Content */}
          <div className="max-w-5xl mx-auto px-4 py-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

