import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import type { JSX } from "react";
import ForcePasswordChangeModal from "./ForcePasswordChangeModal";


export default function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const loc = useLocation();

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-zinc-200 font-bold">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  }

  return (
  <>
    {children}
    {user.forcePasswordChange && <ForcePasswordChangeModal />}
  </>
);

}
