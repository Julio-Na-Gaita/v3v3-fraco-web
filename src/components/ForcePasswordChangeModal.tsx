import { useMemo, useState } from "react";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";

export default function ForcePasswordChangeModal() {
  const { firebaseUser, logout } = useAuth();

  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return (
      !!firebaseUser &&
      currentPass.trim().length > 0 &&
      newPass.length >= 6 &&
      newPass === confirmPass &&
      !loading
    );
  }, [firebaseUser, currentPass, newPass, confirmPass, loading]);

  async function handleSubmit() {
    if (!firebaseUser || !firebaseUser.email) return;

    setLoading(true);
    setError(null);

    try {
      const cred = EmailAuthProvider.credential(firebaseUser.email, currentPass);
      await reauthenticateWithCredential(firebaseUser, cred);
      await updatePassword(firebaseUser, newPass);

      // destrava no Firestore (igual Android)
      await setDoc(
        doc(db, "users", firebaseUser.uid),
        {
          forcePasswordChange: false,
          lastPasswordChangedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (e: any) {
      setError(e?.message || "Falha ao atualizar senha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />

      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950/95 p-5 shadow-2xl">
        <div className="text-xl font-black tracking-wide">🔒 Defina sua nova senha</div>
        <div className="text-zinc-400 text-sm mt-1">
          O admin resetou sua senha. Por segurança, você precisa criar uma nova senha agora.
        </div>

        <div className="mt-4 grid gap-3">
          <div>
            <div className="text-xs text-zinc-400 mb-1 font-bold">Senha atual</div>
            <div className="flex gap-2">
              <input
                value={currentPass}
                onChange={(e) => setCurrentPass(e.target.value)}
                type={showCurrent ? "text" : "password"}
                className="flex-1 rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-zinc-100 outline-none"
              />
              <button
                onClick={() => setShowCurrent((v) => !v)}
                className="px-4 rounded-2xl bg-white/5 border border-white/10 text-zinc-200 font-black"
              >
                {showCurrent ? "OCULTAR" : "VER"}
              </button>
            </div>
          </div>

          <div>
            <div className="text-xs text-zinc-400 mb-1 font-bold">Nova senha (mín. 6)</div>
            <div className="flex gap-2">
              <input
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                type={showNew ? "text" : "password"}
                className="flex-1 rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-zinc-100 outline-none"
              />
              <button
                onClick={() => setShowNew((v) => !v)}
                className="px-4 rounded-2xl bg-white/5 border border-white/10 text-zinc-200 font-black"
              >
                {showNew ? "OCULTAR" : "VER"}
              </button>
            </div>
          </div>

          <div>
            <div className="text-xs text-zinc-400 mb-1 font-bold">Confirmar nova senha</div>
            <div className="flex gap-2">
              <input
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                type={showConfirm ? "text" : "password"}
                className="flex-1 rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-zinc-100 outline-none"
              />
              <button
                onClick={() => setShowConfirm((v) => !v)}
                className="px-4 rounded-2xl bg-white/5 border border-white/10 text-zinc-200 font-black"
              >
                {showConfirm ? "OCULTAR" : "VER"}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-3 text-red-100 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-3 rounded-2xl bg-white text-zinc-900 font-black hover:bg-zinc-100 transition disabled:opacity-50"
          >
            {loading ? "Atualizando..." : "ATUALIZAR SENHA"}
          </button>

          <button
            onClick={logout}
            className="w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-zinc-200 font-black hover:bg-white/10 transition"
          >
            SAIR
          </button>
        </div>
      </div>
    </div>
  );
}
