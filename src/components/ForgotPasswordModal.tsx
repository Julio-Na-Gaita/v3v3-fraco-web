import { useEffect, useMemo, useState } from "react";
import { doc, getDoc, collection, getDocs, limit, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

import { db, functions } from "../lib/firebase";
import { normalizeUser } from "../lib/userUtils";

const ADMIN_PHONE_E164 = "5585988837389";

export default function ForgotPasswordModal({
  initialUsername,
  onClose,
}: {
  initialUsername: string;
  onClose: () => void;
}) {
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setUsername(normalizeUser(initialUsername || ""));
  }, [initialUsername]);

  const clean = useMemo(() => normalizeUser(username), [username]);

  function openWhatsAppRequest(u: string) {
    const msg =
      "Olá! Preciso de RESET DE SENHA no V3v3 é Fraco FC.\n\n" +
      `Meu usuário: @${u}\n` +
      "Motivo: esqueci a senha / não consigo acessar.\n\n" +
      "Enviado pela versão Web.";
    const url = `https://wa.me/${ADMIN_PHONE_E164}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function loadHintFlow() {
    const u = clean;

    if (!u) {
      setStatus("Digite seu @usuário para continuar.");
      setHint(null);
      return;
    }

    setLoading(true);
    setStatus(null);
    setHint(null);

    try {
      // 1) whitelist primeiro
      const wl = await getDoc(doc(db, "whitelist", u));
      if (!wl.exists()) {
        setStatus(`Não encontrei @${u} na whitelist. Se você é membro, peça o reset ao admin.`);
        setHint(null);
        return;
      }

      setStatus("Usuário localizado na whitelist ✅ Buscando dica…");

      // 2) Cloud Function (igual Android)
      const fn = httpsCallable(functions, "getPasswordHintByUsername");
      const res = await fn({ username: u });

      const data = (res.data as any) || {};
      const whitelisted = Boolean(data?.whitelisted);
      const remoteHint = String(data?.hint || "");

      if (!whitelisted) {
        setStatus(`Não encontrei @${u} na whitelist. Peça o reset ao admin.`);
        setHint(null);
        return;
      }

      setStatus("Dica carregada ✅");
      setHint(remoteHint.trim() ? remoteHint : "Dica indisponível…");
    } catch (e: any) {
      // fallback: tenta ler pelo Firestore (se rules permitirem)
      try {
        const q = query(collection(db, "users"), where("username", "==", clean), limit(1));
        const snap = await getDocs(q);
        const docu = snap.docs[0]?.data() as any;
        const ph = String(docu?.passwordHint || "").trim();

        setStatus("Dica carregada ✅");
        setHint(ph ? ph : "Dica indisponível…");
      } catch {
        setStatus(
          "Não consegui buscar a dica automaticamente (função/regras). " +
            "Você pode pedir o reset ao admin pelo botão abaixo."
        );
        setHint(null);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950/90 p-5 shadow-2xl">
        <div className="text-xl font-black tracking-wide">🔐 Recuperar acesso</div>
        <div className="text-zinc-400 text-sm mt-1">
          Use as opções abaixo para ver a dica ou pedir reset ao admin.
        </div>

        <div className="mt-4">
          <div className="text-xs text-zinc-400 mb-1 font-bold">Seu usuário</div>

          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-black">
              @
            </span>
            <input
              value={username}
              onChange={(e) => setUsername(normalizeUser(e.target.value))}
              className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 pl-9 py-3 text-zinc-100 outline-none"
              placeholder="seuusuario"
              autoFocus
            />
          </div>

          {status && (
            <div className="mt-3 text-sm rounded-2xl bg-white/5 border border-white/10 p-3 text-zinc-200">
              {status}
            </div>
          )}

          {hint && (
            <div className="mt-3 text-sm rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-emerald-100">
              <div className="font-black mb-1">Dica de senha:</div>
              <div className="whitespace-pre-wrap">{hint}</div>
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-2">
          <button
            onClick={loadHintFlow}
            disabled={loading}
            className="w-full py-3 rounded-2xl bg-white text-zinc-900 font-black hover:bg-zinc-100 transition disabled:opacity-60"
          >
            {loading ? "Buscando..." : "VER DICA DE SENHA"}
          </button>

          <button
            onClick={() => openWhatsAppRequest(clean)}
            disabled={!clean}
            className="w-full py-3 rounded-2xl bg-green-500/20 border border-green-500/30 text-green-100 font-black hover:bg-green-500/25 transition disabled:opacity-40"
          >
            PEDIR RESET VIA WHATSAPP
          </button>

          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-zinc-200 font-black hover:bg-white/10 transition"
          >
            FECHAR
          </button>
        </div>
      </div>
    </div>
  );
}
