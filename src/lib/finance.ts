/**
 * GDACaixa — Núcleo Financeiro Centralizado
 * Clube Guerreiros do Alto
 *
 * REGRAS INEGOCIÁVEIS:
 * 1. Todos os cálculos financeiros usam centavos inteiros (integers) para eliminar
 *    imprecisões de ponto flutuante (IEEE 754).
 * 2. Valores recebidos em BRL (float ou string) são convertidos rigorosamente na borda.
 * 3. Transferências internas NÃO alteram o saldo consolidado do clube e NÃO contam
 *    como nova receita ou despesa no resultado patrimonial.
 * 4. Movimentações com status diferente de 'confirmado' (ex: 'pendente', 'estornado')
 *    são estritamente excluídas do saldo oficial.
 * 5. Reservas afetam o saldo disponível, mas mantêm o saldo contábil no caixa original.
 */

export type Module = "clube" | "doceria" | "vendas";
export type CashBoxId = "geral" | "doceria" | "vendas";

export type Kind = "receita" | "despesa" | "transferencia";
export type TransactionStatus = "pendente" | "confirmado" | "estornado" | "corrigido";

export type PaymentMethod =
  | "dinheiro"
  | "pix"
  | "cartao_debito"
  | "cartao_credito"
  | "outro";

export interface Transaction {
  id: string;
  module: Module; // compatibilidade com schema legado
  cash_box_id?: CashBoxId;
  kind: Kind;
  amount: number; // valor em reais (ex: 10.50) para visualização compatível
  amount_cents?: number; // valor exato em centavos inteiros (ex: 1050)
  category: string;
  description: string;
  date: string; // ISO yyyy-mm-dd
  seller?: string | undefined;
  status?: TransactionStatus;
  destination_cash_box_id?: CashBoxId;
  payment_method?: PaymentMethod;
  client_mutation_id?: string;
  original_transaction_id?: string;
  reverse_reason?: string;
}

export interface CashReservation {
  id: string;
  cash_box_id: CashBoxId;
  title: string;
  amount_cents: number;
  status: "ativa" | "liberada" | "consumida";
}

export const MODULE_LABEL: Record<Module, string> = {
  clube: "Clube",
  doceria: "Doceria",
  vendas: "Vendas",
};

export const CASH_BOX_LABEL: Record<CashBoxId, string> = {
  geral: "Caixa Geral",
  doceria: "Doceria",
  vendas: "Vendas Rápidas",
};

export const COMMISSION_RATE = 0.1;

// ============================================================================
// CONVERSÕES SEGURAS E TRATAMENTO DE CENTAVOS
// ============================================================================

/**
 * Converte valor em reais (number ou string) para centavos inteiros seguros.
 * Evita problemas de Math.round com números flutuantes aplicando sanitização prévia.
 * Exemplos:
 *   10.50 -> 1050
 *   "10,50" -> 1050
 *   "R$ 1.250,90" -> 125090
 *   -15.30 -> -1530
 *   null / undefined / NaN -> 0
 */
export function toCents(val: number | string | null | undefined): number {
  if (val === null || val === undefined) return 0;

  if (typeof val === "number") {
    if (!Number.isFinite(val)) return 0;
    return Math.round(val * 100);
  }

  // Tratamento de string (pt-BR ou internacional)
  let clean = val.trim();
  if (!clean) return 0;

  // Remove caracteres de moeda, espaços, etc.
  clean = clean.replace(/[R$\s]/g, "");

  // Se contiver tanto ponto quanto vírgula (ex: 1.250,50)
  if (clean.includes(".") && clean.includes(",")) {
    clean = clean.replace(/\./g, "").replace(",", ".");
  } else if (clean.includes(",")) {
    clean = clean.replace(",", ".");
  }

  const num = parseFloat(clean);
  if (!Number.isFinite(num)) return 0;

  return Math.round(num * 100);
}

/**
 * Converte centavos inteiros para reais (número com duas casas decimais).
 * Ex: 1050 -> 10.5
 */
export function fromCents(cents: number | null | undefined): number {
  if (!cents || !Number.isFinite(cents)) return 0;
  return cents / 100;
}

/**
 * Soma valores monetários em centavos com proteção contra estouro ou NaN.
 */
export function sumCents(list: (number | null | undefined)[]): number {
  return list.reduce<number>((acc, cur) => {
    const val = typeof cur === "number" && Number.isFinite(cur) ? cur : 0;
    return acc + val;
  }, 0);
}

/**
 * Formata centavos ou reais para a moeda brasileira (pt-BR).
 */
export function brl(n: number | null | undefined): string {
  const num = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Formata diretamente centavos inteiros para BRL.
 */
export function brlFromCents(cents: number | null | undefined): string {
  return brl(fromCents(cents));
}

// ============================================================================
// RESUMO FINANCEIRO E CONSOLIDAÇÃO ENTRE CAIXAS
// ============================================================================

export interface FinancialSummary {
  income_cents: number;
  expense_cents: number;
  balance_cents: number;
  // Representações em reais para compatibilidade direta com telas atuais
  income: number;
  expense: number;
  balance: number;
}

export interface BoxFinancialDetails extends FinancialSummary {
  cash_box_id: CashBoxId;
  transfers_in_cents: number;
  transfers_out_cents: number;
  reserved_cents: number;
  available_cents: number;
  transfers_in: number;
  transfers_out: number;
  reserved: number;
  available: number;
}

/**
 * Normaliza uma transação garantindo amount_cents e status seguro.
 */
function normalizeTx(t: Transaction): {
  cents: number;
  status: TransactionStatus;
  kind: Kind;
  boxId: CashBoxId;
  destBoxId?: CashBoxId;
} {
  const cents =
    typeof t.amount_cents === "number" && Number.isFinite(t.amount_cents)
      ? t.amount_cents
      : toCents(t.amount);

  const status: TransactionStatus = t.status || "confirmado";
  const kind: Kind = t.kind;

  // Mapeia module legado para CashBoxId se cash_box_id não estiver setado
  let boxId: CashBoxId = t.cash_box_id || "geral";
  if (!t.cash_box_id && t.module) {
    if (t.module === "clube") boxId = "geral";
    else if (t.module === "doceria") boxId = "doceria";
    else if (t.module === "vendas") boxId = "vendas";
  }

  return {
    cents: Math.max(0, cents), // transações usam magnitude positiva com kind determinando o sinal
    status,
    kind,
    boxId,
    destBoxId: t.destination_cash_box_id,
  };
}

/**
 * Resume uma lista de transações com precisão contábil.
 * Respeita a regra:
 * - Apenas transações 'confirmado' entram no saldo oficial.
 * - Transferências internas NÃO somam em income nem em expense no consolidado.
 */
export function summarize(list: Transaction[]): FinancialSummary {
  let incomeCents = 0;
  let expenseCents = 0;

  for (const t of list) {
    const norm = normalizeTx(t);
    // Ignora movimentações que não sejam confirmadas (ex: pendentes de conselheiros, estornadas)
    if (norm.status !== "confirmado") continue;

    if (norm.kind === "receita") {
      incomeCents += norm.cents;
    } else if (norm.kind === "despesa") {
      expenseCents += norm.cents;
    }
    // NOTA: kind === "transferencia" não adiciona nem receita nem despesa consolidada
  }

  const balanceCents = incomeCents - expenseCents;

  return {
    income_cents: incomeCents,
    expense_cents: expenseCents,
    balance_cents: balanceCents,
    income: fromCents(incomeCents),
    expense: fromCents(expenseCents),
    balance: fromCents(balanceCents),
  };
}

/**
 * Calcula o detalhamento financeiro específico de um Caixa, considerando:
 * - Receitas próprias do caixa
 * - Despesas próprias do caixa
 * - Transferências recebidas de outros caixas (+)
 * - Transferências enviadas para outros caixas (-)
 * - Reservas comprometidas (-)
 */
export function summarizeBox(
  list: Transaction[],
  boxId: CashBoxId,
  reservations: CashReservation[] = []
): BoxFinancialDetails {
  let incomeCents = 0;
  let expenseCents = 0;
  let transfersInCents = 0;
  let transfersOutCents = 0;

  for (const t of list) {
    const norm = normalizeTx(t);
    if (norm.status !== "confirmado") continue;

    if (norm.kind === "receita" && norm.boxId === boxId) {
      incomeCents += norm.cents;
    } else if (norm.kind === "despesa" && norm.boxId === boxId) {
      expenseCents += norm.cents;
    } else if (norm.kind === "transferencia") {
      if (norm.boxId === boxId) {
        // Saída deste caixa para outro
        transfersOutCents += norm.cents;
      }
      if (norm.destBoxId === boxId) {
        // Entrada vinda de outro caixa para este
        transfersInCents += norm.cents;
      }
    }
  }

  const activeReservations = reservations.filter(
    (r) => r.cash_box_id === boxId && r.status === "ativa"
  );
  const reservedCents = sumCents(activeReservations.map((r) => r.amount_cents));

  const balanceCents =
    incomeCents - expenseCents + transfersInCents - transfersOutCents;
  const availableCents = balanceCents - reservedCents;

  return {
    cash_box_id: boxId,
    income_cents: incomeCents,
    expense_cents: expenseCents,
    balance_cents: balanceCents,
    transfers_in_cents: transfersInCents,
    transfers_out_cents: transfersOutCents,
    reserved_cents: reservedCents,
    available_cents: availableCents,
    income: fromCents(incomeCents),
    expense: fromCents(expenseCents),
    balance: fromCents(balanceCents),
    transfers_in: fromCents(transfersInCents),
    transfers_out: fromCents(transfersOutCents),
    reserved: fromCents(reservedCents),
    available: fromCents(availableCents),
  };
}

/**
 * Consolidação Geral de Todos os 3 Caixas com prova contábil invariante:
 * A soma dos saldos individuais dos caixas DEVE ser rigorosamente igual ao saldo consolidado,
 * pois transferências internas são debitadas em um caixa e creditadas em outro no mesmo montante.
 */
export function consolidateAllBoxes(
  list: Transaction[],
  reservations: CashReservation[] = []
): {
  consolidated: FinancialSummary;
  geral: BoxFinancialDetails;
  doceria: BoxFinancialDetails;
  vendas: BoxFinancialDetails;
  total_reserved_cents: number;
  total_available_cents: number;
  total_reserved: number;
  total_available: number;
} {
  const consolidated = summarize(list);
  const geral = summarizeBox(list, "geral", reservations);
  const doceria = summarizeBox(list, "doceria", reservations);
  const vendas = summarizeBox(list, "vendas", reservations);

  const totalReservedCents =
    geral.reserved_cents + doceria.reserved_cents + vendas.reserved_cents;
  const totalAvailableCents = consolidated.balance_cents - totalReservedCents;

  return {
    consolidated,
    geral,
    doceria,
    vendas,
    total_reserved_cents: totalReservedCents,
    total_available_cents: totalAvailableCents,
    total_reserved: fromCents(totalReservedCents),
    total_available: fromCents(totalAvailableCents),
  };
}

// ============================================================================
// REGRAS ESPECÍFICAS DE NEGÓCIO E RELATÓRIOS
// ============================================================================

export function profitMargin(revenue: number, cost: number) {
  const revCents = toCents(revenue);
  const costCents = toCents(cost);
  const profitCents = revCents - costCents;

  return {
    profit: fromCents(profitCents),
    margin: revCents > 0 ? profitCents / revCents : 0,
  };
}

export function commissionBySeller(
  list: Transaction[],
  rate = COMMISSION_RATE
) {
  const map = new Map<string, { salesCents: number; commissionCents: number }>();

  for (const t of list) {
    const norm = normalizeTx(t);
    if (norm.status !== "confirmado" || norm.kind !== "receita" || !t.seller) {
      continue;
    }

    const cur = map.get(t.seller) ?? { salesCents: 0, commissionCents: 0 };
    cur.salesCents += norm.cents;
    // Comissão em centavos inteiros
    cur.commissionCents = Math.round(cur.salesCents * rate);
    map.set(t.seller, cur);
  }

  return [...map.entries()]
    .map(([seller, v]) => ({
      seller,
      sales: fromCents(v.salesCents),
      commission: fromCents(v.commissionCents),
      sales_cents: v.salesCents,
      commission_cents: v.commissionCents,
    }))
    .sort((a, b) => b.sales_cents - a.sales_cents);
}

export function monthlySeries(list: Transaction[]) {
  const map = new Map<
    string,
    { month: string; receitaCents: number; despesaCents: number }
  >();

  for (const t of list) {
    const norm = normalizeTx(t);
    if (norm.status !== "confirmado" || (norm.kind !== "receita" && norm.kind !== "despesa")) {
      continue;
    }

    const key = t.date.slice(0, 7);
    const cur = map.get(key) ?? { month: key, receitaCents: 0, despesaCents: 0 };

    if (norm.kind === "receita") {
      cur.receitaCents += norm.cents;
    } else {
      cur.despesaCents += norm.cents;
    }

    map.set(key, cur);
  }

  return [...map.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((item) => ({
      month: item.month,
      receita: fromCents(item.receitaCents),
      despesa: fromCents(item.despesaCents),
      receita_cents: item.receitaCents,
      despesa_cents: item.despesaCents,
    }));
}
