import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Wallet, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — GDACaixa 2027" },
      { name: "description", content: "Entre com sua conta Google para acessar o caixa do clube Guerreiros do Alto." },
      { property: "og:title", content: "Entrar — GDACaixa 2027" },
      { property: "og:description", content: "Acesse o caixa do clube Guerreiros do Alto." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // 1. Escuta alterações de estado de autenticação (ex: quando o callback do Google processa o token)
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setBusy(true);
        navigate({ to: "/", replace: true });
      } else {
        setChecking(false);
      }
    });

    // 2. Checa se já existe sessão ativa
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user) {
        navigate({ to: "/", replace: true });
      } else {
        setChecking(false);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  async function signIn() {
    setBusy(true);
    try {
      const SUPABASE_KEY =
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        process.env.SUPABASE_PUBLISHABLE_KEY;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/`,
          queryParams: SUPABASE_KEY ? { apikey: SUPABASE_KEY } : undefined,
        },
      });

      if (error) {
        console.error("Erro no login Supabase:", error);
        toast.error(`Falha ao entrar com Google: ${error.message}`);
        setBusy(false);
      }
    } catch (err) {
      console.error("Exceção no login:", err);
      toast.error("Ocorreu um erro ao iniciar login. Tente novamente.");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-surface px-6 text-center">
      <span className="flex size-20 items-center justify-center rounded-3xl bg-primary-container text-on-primary-container shadow-sm">
        <Wallet className="size-10" />
      </span>

      <div>
        <p className="label-medium text-muted-foreground uppercase tracking-wider font-semibold">Guerreiros do Alto</p>
        <h1 className="text-3xl font-black tracking-tight text-foreground mt-1">GDA Caixa 2027</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-xs mx-auto">
          Controle financeiro do clube na palma da mão com Material You e PWA.
        </p>
      </div>

      <div className="w-full max-w-xs space-y-3">
        {checking ? (
          <div className="flex h-14 w-full items-center justify-center gap-2 text-sm font-semibold text-muted-foreground">
            <Loader2 className="size-5 animate-spin text-primary" />
            <span>Verificando autenticação…</span>
          </div>
        ) : (
          <button
            onClick={signIn}
            disabled={busy}
            className="flex h-14 w-full items-center justify-center gap-3 rounded-full bg-primary text-primary-foreground font-bold text-sm shadow-sm hover:shadow-md transition-all active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 className="size-5 animate-spin" />
                <span>Autenticando…</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden>
                  <path
                    fill="currentColor"
                    d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.57-2.47C16.68 3.7 14.55 2.75 12 2.75 6.9 2.75 2.75 6.9 2.75 12s4.15 9.25 9.25 9.25c5.34 0 8.88-3.75 8.88-9.04 0-.6-.07-1.06-.15-1.51Z"
                  />
                </svg>
                <span>Entrar com Google</span>
              </>
            )}
          </button>
        )}

        <p className="text-[11px] text-muted-foreground">
          Acesso seguro via Google OAuth integrado ao Supabase.
        </p>
      </div>
    </div>
  );
}
