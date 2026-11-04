import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // 1. Tenta recuperar primeiro a sessão ativa rápida em cache
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session?.user) return;

    // 2. Se não encontrou, tenta buscar direto do servidor
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: () => <Outlet />,
});
