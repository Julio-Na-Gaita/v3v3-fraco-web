import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";

import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { normalizeUser } from "./userUtils";


type AppUser = {
  uid: string;
  name: string;
  username: string;
  isAdmin: boolean;
  forcePasswordChange: boolean;
};


type AuthCtx = {
  firebaseUser: User | null;
  user: AppUser | null;
  loading: boolean;
  loginWithUsername: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx | null>(null);

// ✅ Igual no Android:
function gerarEmail(usuario: string) {
  const u = normalizeUser(usuario);
  return `${u}@bolao112.com`;
}


export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubUserDoc: null | (() => void) = null;

const unsub = onAuthStateChanged(auth, async (fbUser) => {
  // se trocar de usuário, encerra listener anterior
  if (unsubUserDoc) {
    unsubUserDoc();
    unsubUserDoc = null;
  }

  setFirebaseUser(fbUser);

  if (!fbUser) {
    setUser(null);
    setLoading(false);
    return;
  }

  const ref = doc(db, "users", fbUser.uid);

  // Atualiza lastAccess/appVersion (merge, não quebra se doc não existir)
  try {
    await setDoc(
      ref,
      {
        appVersion: "Web 0.2",
        lastAccess: serverTimestamp(),
      },
      { merge: true }
    );
  } catch {
    // se rules bloquearem, seguimos mesmo assim
  }

  // ✅ mantém o user do Firestore “ao vivo” (inclui forcePasswordChange)
  unsubUserDoc = onSnapshot(
    ref,
    (snap) => {
      const data = snap.exists() ? (snap.data() as any) : {};

      const username =
        (data?.username as string | undefined) ??
        (fbUser.email ? fbUser.email.split("@")[0] : "usuario");

      const name = (data?.name as string | undefined) ?? username;
      const isAdmin = (data?.isAdmin as boolean | undefined) ?? false;
      const forcePasswordChange =
        (data?.forcePasswordChange as boolean | undefined) ?? false;

      setUser({
        uid: fbUser.uid,
        username,
        name,
        isAdmin,
        forcePasswordChange,
      });

      setLoading(false);
    },
    (err) => {
      console.error(err);
      setUser({
        uid: fbUser.uid,
        username: fbUser.email ? fbUser.email.split("@")[0] : "usuario",
        name: fbUser.email ? fbUser.email.split("@")[0] : "usuario",
        isAdmin: false,
        forcePasswordChange: false,
      });
      setLoading(false);
    }
  );
});

return () => {
  if (unsubUserDoc) unsubUserDoc();
  unsub();
};


    return () => unsub();
  }, []);

  const loginWithUsername = async (username: string, password: string) => {
    const email = gerarEmail(username);
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const value = useMemo<AuthCtx>(
    () => ({ firebaseUser, user, loading, loginWithUsername, logout }),
    [firebaseUser, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider />");
  return ctx;
}
