import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toCents, type Module, type Transaction, type Role as RoleFromFinance } from "./finance";

export type Role = "admin" | "diretor" | "tesoureiro" | "conselheiro" | "desbravador";
export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  diretor: "Diretor",
  tesoureiro: "Tesoureiro",
  conselheiro: "Conselheiro",
  desbravador: "Desbravador",
};

const TX_KEY = ["transactions"] as const;

// --- 1. Transações ---
async function fetchTransactions(): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .order("date", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []).map((r) => {
    const rawAmount = Number(r.amount);
    const amountCents = r.amount_cents ? Number(r.amount_cents) : toCents(rawAmount);

    return {
      id: r.id,
      module: (r.module || (r.cash_box_id === "geral" ? "clube" : r.cash_box_id) || "clube") as Module,
      cash_box_id: r.cash_box_id ?? undefined,
      kind: r.kind as Transaction["kind"],
      amount: rawAmount,
      amount_cents: amountCents,
      category: r.category || "Geral",
      description: r.description,
      date: r.date,
      seller: r.seller ?? undefined,
      status: r.status ?? "confirmado",
      destination_cash_box_id: r.destination_cash_box_id ?? undefined,
      payment_method: r.payment_method ?? undefined,
      client_mutation_id: r.client_mutation_id ?? undefined,
      original_transaction_id: r.original_transaction_id ?? undefined,
      reverse_reason: r.reverse_reason ?? undefined,
      requested_by: r.requested_by ?? undefined,
      approved_by: r.approved_by ?? undefined,
      approved_at: r.approved_at ?? undefined,
      rejection_reason: r.rejection_reason ?? undefined,
    };
  });
}

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
  const clientMutationId = t.client_mutation_id || crypto.randomUUID();
  const amountCents = t.amount_cents ?? toCents(t.amount);
  const cashBoxId = t.cash_box_id || (t.module === "clube" ? "geral" : t.module);

  // Tentativa primária: RPC oficial segura com idempotência (Fase 1B)
  const { data: rpcData, error: rpcError } = await supabase.rpc("sp_registrar_transacao_oficial", {
    p_client_mutation_id: clientMutationId,
    p_cash_box_id: cashBoxId,
    p_kind: t.kind,
    p_amount_cents: amountCents,
    p_category: t.category,
    p_description: t.description,
    p_payment_method: t.payment_method || "dinheiro",
    p_date: t.date,
    p_seller: t.seller ?? null,
  });

  if (!rpcError) {
    return rpcData;
  }

  // Fallback para schema legado caso a migration 0004 ainda não tenha sido aplicada
  const payload: Record<string, any> = {
    module: t.module,
    kind: t.kind,
    amount: t.amount,
    category: t.category,
    description: t.description,
    date: t.date,
    seller: t.seller ?? null,
  };

  if (t.cash_box_id) payload.cash_box_id = t.cash_box_id;
  if (t.status) payload.status = t.status;
  if (t.payment_method) payload.payment_method = t.payment_method;
  if (t.destination_cash_box_id) payload.destination_cash_box_id = t.destination_cash_box_id;

  const { error: insertError } = await supabase.from("transactions").insert(payload);
  if (insertError) throw insertError;
}

// Helpers para RPCs da Fase 1B
export async function recordTransfer(params: {
  originCashBoxId: CashBoxId;
  destinationCashBoxId: CashBoxId;
  amountCents: number;
  description: string;
  clientMutationId?: string;
}) {
  const mutationId = params.clientMutationId || crypto.randomUUID();
  const { data, error } = await supabase.rpc("sp_registrar_transferencia", {
    p_client_mutation_id: mutationId,
    p_origem_id: params.originCashBoxId,
    p_destino_id: params.destinationCashBoxId,
    p_amount_cents: params.amountCents,
    p_description: params.description,
  });
  if (error) throw error;
  return data;
}

export async function requestExpense(params: {
  cashBoxId: CashBoxId;
  amountCents: number;
  category: string;
  description: string;
  paymentMethod?: PaymentMethod;
  clientMutationId?: string;
}) {
  const mutationId = params.clientMutationId || crypto.randomUUID();
  const { data, error } = await supabase.rpc("sp_solicitar_despesa", {
    p_client_mutation_id: mutationId,
    p_cash_box_id: params.cashBoxId,
    p_amount_cents: params.amountCents,
    p_category: params.category,
    p_description: params.description,
    p_payment_method: params.paymentMethod || "dinheiro",
  });
  if (error) throw error;
  return data;
}

export async function approveExpenseRequest(transactionId: string) {
  const { data, error } = await supabase.rpc("sp_aprovar_solicitacao", {
    p_transaction_id: transactionId,
  });
  if (error) throw error;
  return data;
}

export async function rejectExpenseRequest(transactionId: string, reason: string) {
  const { data, error } = await supabase.rpc("sp_rejeitar_solicitacao", {
    p_transaction_id: transactionId,
    p_rejection_reason: reason,
  });
  if (error) throw error;
  return data;
}

export async function reverseTransaction(transactionId: string, reason: string) {
  const { data, error } = await supabase.rpc("sp_estornar_transacao", {
    p_transaction_id: transactionId,
    p_reason: reason,
  });
  if (error) throw error;
  return data;
}

// --- 2. Metas (Clube, Doceria, Vendas, Unidades) ---
export interface Meta {
  id: string;
  modulo: "clube" | "doceria" | "vendas" | "unidade";
  unidade_nome?: string;
  descricao: string;
  valor_alvo: number;
  status: "pendente" | "aprovada" | "concluida";
  sugerido_por?: string;
}

export function useMetas(modulo?: Meta["modulo"]) {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["metas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("metas").select("*").order("created_at", { ascending: false });
      if (error) return [];
      return (data ?? []).map((m) => ({
        id: m.id,
        modulo: m.modulo,
        unidade_nome: m.unidade_nome ?? undefined,
        descricao: m.descricao,
        valor_alvo: Number(m.valor_alvo),
        status: m.status,
        sugerido_por: m.sugerido_por ?? undefined,
      })) as Meta[];
    },
  });

  return modulo ? data.filter((m) => m.modulo === modulo) : data;
}

export async function addMeta(m: Omit<Meta, "id">) {
  const { error } = await supabase.from("metas").insert({
    modulo: m.modulo,
    unidade_nome: m.unidade_nome ?? null,
    descricao: m.descricao,
    valor_alvo: m.valor_alvo,
    status: m.status || "aprovada",
    sugerido_por: m.sugerido_por ?? null,
  });
  if (error) throw error;
}

// --- 3. Materiais & Estoque (Almoxarifado) ---
export interface MaterialItem {
  id: string;
  modulo: "clube" | "doceria";
  nome: string;
  quantidade: number;
  custo_total: number;
  unidade_medida?: string;
}

export function useMateriais(modulo?: "clube" | "doceria") {
  const { data = [] } = useQuery({
    queryKey: ["materiais"],
    queryFn: async () => {
      const { data, error } = await supabase.from("materiais").select("*").order("created_at", { ascending: false });
      if (error) return [];
      return (data ?? []).map((m) => ({
        id: m.id,
        modulo: m.modulo,
        nome: m.nome,
        quantidade: Number(m.quantidade),
        custo_total: Number(m.custo_total),
        unidade_medida: m.unidade_medida || "un",
      })) as MaterialItem[];
    },
  });
  return modulo ? data.filter((m) => m.modulo === modulo) : data;
}

export async function addMaterial(m: Omit<MaterialItem, "id">) {
  const { error } = await supabase.from("materiais").insert({
    modulo: m.modulo,
    nome: m.nome,
    quantidade: m.quantidade,
    custo_total: m.custo_total,
    unidade_medida: m.unidade_medida || "un",
  });
  if (error) throw error;
}

// --- 4. Produtos e Avarias (Vendas Rápidas) ---
export interface Produto {
  id: string;
  nome: string;
  preco_venda: number;
  custo: number;
  comissao: number;
}

export function useProdutos() {
  return useQuery({
    queryKey: ["produtos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("produtos").select("*").order("nome");
      if (error) return [];
      return (data ?? []).map((p) => ({
        id: p.id,
        nome: p.nome,
        preco_venda: Number(p.preco_venda),
        custo: Number(p.custo),
        comissao: Number(p.comissao),
      })) as Produto[];
    },
  });
}

export async function addProduto(p: Omit<Produto, "id">) {
  const { error } = await supabase.from("produtos").insert({
    nome: p.nome,
    preco_venda: p.preco_venda,
    custo: p.custo,
    comissao: p.comissao,
  });
  if (error) throw error;
}

export interface Avaria {
  id: string;
  produto_nome: string;
  quantidade: number;
  perda_estimada: number;
  motivo?: string;
  data: string;
}

export function useAvarias() {
  return useQuery({
    queryKey: ["avarias"],
    queryFn: async () => {
      const { data, error } = await supabase.from("avarias").select("*").order("data", { ascending: false });
      if (error) return [];
      return (data ?? []).map((a) => ({
        id: a.id,
        produto_nome: a.produto_nome,
        quantidade: Number(a.quantidade),
        perda_estimada: Number(a.perda_estimada),
        motivo: a.motivo ?? undefined,
        data: a.data,
      })) as Avaria[];
    },
  });
}

export async function addAvaria(a: Omit<Avaria, "id">) {
  const { error } = await supabase.from("avarias").insert({
    produto_nome: a.produto_nome,
    quantidade: a.quantidade,
    perda_estimada: a.perda_estimada,
    motivo: a.motivo ?? null,
    data: a.data,
  });
  if (error) throw error;
}

// --- 5. Controle Interno / Dívidas ---
export interface Divida {
  id: string;
  nome: string;
  valor: number;
  data: string;
  status: "pendente" | "pago";
  obs?: string;
}

export function useDividas() {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ["dividas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("dividas").select("*").order("data", { ascending: false });
      if (error) return [];
      return (data ?? []).map((d) => ({
        id: d.id,
        nome: d.nome,
        valor: Number(d.valor),
        data: d.data,
        status: d.status,
        obs: d.obs ?? undefined,
      })) as Divida[];
    },
  });
}

export async function addDivida(d: Omit<Divida, "id">) {
  const { error } = await supabase.from("dividas").insert({
    nome: d.nome,
    valor: d.valor,
    data: d.data,
    status: d.status || "pendente",
    obs: d.obs ?? null,
  });
  if (error) throw error;
}

export async function updateDividaStatus(id: string, status: "pendente" | "pago") {
  const { error } = await supabase.from("dividas").update({ status }).eq("id", id);
  if (error) throw error;
}

// --- Usuário Atual e Permissões ---
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
  return !!data?.roles.some((r) => r === "admin" || r === "diretor" || r === "tesoureiro");
}

export function useIsAdminOrDiretor() {
  const { data } = useMe();
  return !!data?.roles.some((r) => r === "admin" || r === "diretor" || r === "tesoureiro");
}

export function useIsFinancialManager() {
  const { data } = useMe();
  return !!data?.roles.some((r) => r === "admin" || r === "diretor" || r === "tesoureiro");
}
// --- 6. Gestão de Usuários (RBAC) ---
export interface ClubUser {
  id: string;
  name: string;
  avatar_url?: string | null;
  roles: Role[];
}

export function useAllUsers() {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ["all_users"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, display_name, avatar_url"),
        supabase.from("user_roles").select("user_id, role"),
      ]);

      if (!profiles) return [];

      const rolesByUser = new Map<string, Role[]>();
      (roles ?? []).forEach((r) => {
        const list = rolesByUser.get(r.user_id) || [];
        list.push(r.role as Role);
        rolesByUser.set(r.user_id, list);
      });

      return profiles.map((p) => ({
        id: p.id,
        name: p.display_name || "Membro",
        avatar_url: p.avatar_url,
        roles: rolesByUser.get(p.id) || ["desbravador"],
      })) as ClubUser[];
    },
  });
}

export async function updateUserRole(userId: string, newRole: Role) {
  // Remove papéis anteriores e adiciona o novo papel hierárquico
  await supabase.from("user_roles").delete().eq("user_id", userId);
  const { error } = await supabase.from("user_roles").insert({
    user_id: userId,
    role: newRole,
  });
  if (error) throw error;
}

export function useIsAdmin() {
  const { data } = useMe();
  return !!data?.roles.includes("admin");
}

export function useIsConselheiro() {
  const { data } = useMe();
  return !!data?.roles.includes("conselheiro");
}
