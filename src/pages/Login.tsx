import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { normalizeUser } from "../lib/userUtils";
import ForgotPasswordModal from "../components/ForgotPasswordModal";


export default function Login() {
  const { loginWithUsername } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as any;

const [username, setUsername] = useState("");
const [password, setPassword] = useState("");
const [showForgot, setShowForgot] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  const from = loc?.state?.from || "/confrontos";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");

    const u = username.trim().replace("@", "");
    if (!u) return setErr("Digite seu @usuário.");
    if (password.length < 6) return setErr("Senha inválida (mínimo 6).");

    setLoading(true);
    try {
      await loginWithUsername(normalizeUser(username), password);
      nav(from, { replace: true });
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Falha no login.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md p-5 rounded-3xl bg-zinc-900 border border-zinc-800 shadow">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-zinc-100 text-zinc-900 flex items-center justify-center font-black">
            V3
          </div>
          <div>
            <div className="text-lg font-black leading-5">V3v3 é Fraco FC</div>
            <div className="text-xs text-zinc-400">Login</div>
          </div>
        </div>

        {err && (
          <div className="mb-3 p-3 rounded-2xl bg-red-950/50 border border-red-900 text-red-200 text-sm">
            {err}
          </div>
        )}

        <form onSubmit={onSubmit} className="grid gap-3">
          <div>
            <label className="text-xs text-zinc-400 font-bold">Usuário</label>
            <div className="mt-2">
  <div className="text-xs text-zinc-400 mb-1 font-bold">Usuário</div>
  <div className="relative">
    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-black">
      @
    </span>
    <input
      value={username}
      onChange={(e) => setUsername(normalizeUser(e.target.value))}
      placeholder="seuusuario"
      className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 pl-9 py-3 text-zinc-100 outline-none"
      disabled={loading}
      autoComplete="username"
    />
  </div>
</div>

          </div>

          <div>
            <label className="text-xs text-zinc-400 font-bold">Senha</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              type="password"
              className="mt-1 w-full px-4 py-3 rounded-2xl bg-zinc-950 border border-zinc-800 outline-none focus:border-zinc-600"
            />
          </div>

          <button
            disabled={loading}
            className="mt-2 w-full py-3 rounded-2xl bg-zinc-100 text-zinc-900 font-black hover:bg-white transition disabled:opacity-60"
          >
            {loading ? "Entrando..." : "ENTRAR"}
          </button>
<button
  type="button"
  onClick={() => setShowForgot(true)}
  className="mt-3 w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-zinc-200 font-black hover:bg-white/10 transition"
  disabled={loading}
>
  ESQUECI MINHA SENHA
</button>

          <div className="text-xs text-zinc-500">
            Use o mesmo @usuário e senha do app Android.
          </div>
        </form>
      </div>
      {showForgot && (
  <ForgotPasswordModal
    initialUsername={username}
    onClose={() => setShowForgot(false)}
  />
)}

    </div>
  );
}
