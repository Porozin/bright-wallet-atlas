import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Module, Transaction } from "./finance";

export type Role = "admin" | "diretor" | "conselheiro" | "desbravador";
export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  diretor: "Diretor",
  conselheiro: "Conselheiro",
  desbravador: "Desbravador",
};

const TX_KEY = ["transactions"] as const;

async function fetchTransactions(): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("id,module,kind,amount,category,description,date,seller")
    .order("date", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    module: r.module as Module,
    kind: r.kind as Transaction["kind"],
    amount: Number(r.amount),
    category: r.category,
    description: r.description,
    date: r.date,
    seller: r.seller ?? undefined,
  }));
}

/** Transactions with live updates; RLS decides which rows each role sees. */
export function useTransactions(module?: Module) {
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: TX_KEY, queryFn: fetchTransactions });

  useEffect(() => {
    const channel = supabase
      .channel(`tx-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
        qc.invalidateQueries({ queryKey: TX_KEY });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return module ? data.filter((t) => t.module === module) : data;
}

export async function addTransaction(t: Omit<Transaction, "id">) {
  const { error } = await supabase.from("transactions").insert({
    module: t.module,
    kind: t.kind,
    amount: t.amount,
    category: t.category,
    description: t.description,
    date: t.date,
    seller: t.seller ?? null,
  });
  if (error) throw error;
}

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) return null;
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("display_name,avatar_url").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      return {
        id: user.id,
        email: user.email ?? "",
        name: profile?.display_name ?? user.email ?? "",
        avatar: profile?.avatar_url ?? null,
        roles: (roles ?? []).map((r) => r.role as Role),
      };
    },
  });
}

export function useCanRecord() {
  const { data } = useMe();
  return !!data?.roles.some((r) => r !== "desbravador");
}
