import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar · GDACaixa" },
      { name: "description", content: "Entre com sua conta Google para acessar o caixa do clube Guerreiros do Alto." },
      { property: "og:title", content: "Entrar · GDACaixa" },
      { property: "og:description", content: "Acesse o caixa do clube Guerreiros do Alto." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  async function signIn() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      toast.error("Não foi possível entrar com o Google. Tente novamente.");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-surface px-6 text-center">
      <span className="flex size-20 items-center justify-center rounded-xl bg-primary-container text-on-primary-container">
        <Wallet className="size-10" />
      </span>
      <div>
        <p className="label-large text-muted-foreground">Guerreiros do Alto</p>
        <h1 className="display-small mt-1">GDACaixa</h1>
        <p className="mt-3 text-muted-foreground">Controle financeiro do clube na palma da mão.</p>
      </div>
      <button
        onClick={signIn}
        disabled={busy}
        className="label-large flex h-12 w-full max-w-xs items-center justify-center gap-3 rounded-full bg-primary text-primary-foreground disabled:opacity-60"
      >
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden><path fill="currentColor" d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.57-2.47C16.68 3.7 14.55 2.75 12 2.75 6.9 2.75 2.75 6.9 2.75 12s4.15 9.25 9.25 9.25c5.34 0 8.88-3.75 8.88-9.04 0-.6-.07-1.06-.15-1.51Z"/></svg>
        {busy ? "Entrando…" : "Entrar com Google"}
      </button>
    </div>
  );
}
