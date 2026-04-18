import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * Wrapper que bloqueia o conteúdo até confirmar a sessão do usuário.
 * Não-logados são redirecionados para /auth.
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "authed" | "guest">("loading");

  useEffect(() => {
    // Listener PRIMEIRO (evita race com getSession)
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setStatus(session ? "authed" : "guest");
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setStatus(session ? "authed" : "guest");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (status === "guest") return <Navigate to="/auth" replace />;
  return <>{children}</>;
}
