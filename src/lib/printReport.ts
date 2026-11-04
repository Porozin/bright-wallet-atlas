import { brl, MODULE_LABEL, type Transaction } from "./finance";

export interface PrintReportOptions {
  module: "clube" | "doceria" | "vendas" | "consolidado";
  title?: string;
  month?: string; // yyyy-mm
  responsible?: string;
  transactions: Transaction[];
  additionalStats?: { label: string; value: string; isNegative?: boolean }[];
  signatures?: { role: string; name?: string }[];
}

export function generatePrintReport({
  module,
  title,
  month = new Date().toISOString().slice(0, 7),
  responsible = "Diretoria / Tesouraria",
  transactions,
  additionalStats = [],
  signatures = [
    { role: "Diretor(a) do Clube" },
    { role: "Tesoureiro(a)" },
    { role: "Secretário(a) da Igreja / Comissão" },
  ],
}: PrintReportOptions) {
  const [year, monthNum] = month.split("-");
  const monthName = new Date(Number(year), Number(monthNum) - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const txs = transactions
    .filter((t) => t.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date));

  const totalEntradas = txs
    .filter((t) => t.kind === "receita")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalSaidas = txs
    .filter((t) => t.kind === "despesa")
    .reduce((sum, t) => sum + t.amount, 0);

  const saldoPeriodo = totalEntradas - totalSaidas;

  const defaultTitles: Record<string, string> = {
    clube: "Livro Caixa — Clube",
    doceria: "Extrato Financeiro — Doceria",
    vendas: "Extrato de Vendas & Comissões",
    consolidado: "Balancete Consolidado Geral",
  };

  const headerTitle = title || defaultTitles[module] || "Relatório Financeiro";

  const rowsHtml = txs.length
    ? txs
        .map((t) => {
          const isIncome = t.kind === "receita";
          return `
          <tr>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; font-size: 11px;">
              ${new Date(t.date + "T12:00").toLocaleDateString("pt-BR")}
            </td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; font-size: 11px;">
              ${t.category}
            </td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; font-size: 11px;">
              ${t.description}${t.seller ? ` <span style="color:#6b7280">(${t.seller})</span>` : ""}
            </td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; font-size: 11px; text-align: right; font-weight: 600; color: ${
              isIncome ? "#15803d" : "#b91c1c"
            };">
              ${isIncome ? "+" : "-"}${brl(t.amount)}
            </td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="4" style="text-align: center; padding: 24px; color: #9ca3af; font-size: 12px;">Sem movimentações registradas neste período</td></tr>`;

  const statsHtml = additionalStats
    .map(
      (st) => `
      <tr style="font-weight: 600; font-size: 12px;">
        <td colspan="3" style="text-align: right; padding: 4px 8px;">${st.label}</td>
        <td style="text-align: right; padding: 4px 8px; color: ${
          st.isNegative ? "#b91c1c" : "#111827"
        };">${st.value}</td>
      </tr>`
    )
    .join("");

  const signaturesHtml = signatures
    .map(
      (sig) => `
      <div style="flex: 1; min-width: 140px; text-align: center;">
        <div style="border-top: 1px solid #111827; margin-bottom: 6px;"></div>
        <p style="font-size: 11px; font-weight: bold; margin: 0; color: #111827;">${sig.role}</p>
        ${sig.name ? `<p style="font-size: 10px; color: #4b5563; margin: 2px 0 0;">${sig.name}</p>` : ""}
      </div>`
    )
    .join("");

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Por favor, permita pop-ups para gerar a impressão do relatório oficial.");
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <title>${headerTitle} - ${month}</title>
      <style>
        @page { size: A4; margin: 15mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #111827; margin: 0; padding: 10px; }
        .header { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #111827; padding-bottom: 12px; margin-bottom: 14px; }
        .badge-icon { width: 44px; height: 44px; background: #eab308; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: bold; color: #fff; }
        .title { font-size: 20px; font-weight: 800; margin: 0; }
        .subtitle { font-size: 13px; color: #4b5563; font-weight: 600; margin-top: 2px; }
        .meta { display: flex; justify-content: space-between; font-size: 11px; color: #374151; background: #f3f4f6; padding: 8px 12px; border-radius: 6px; margin-bottom: 14px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; text-align: left; padding: 6px 8px; border-bottom: 1px solid #d1d5db; }
        .signatures { display: flex; gap: 24px; margin-top: 48px; padding-top: 12px; page-break-inside: avoid; }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="badge-icon">⚔️</div>
        <div>
          <h1 class="title">Guerreiros do Alto</h1>
          <div class="subtitle">${headerTitle}</div>
        </div>
      </div>

      <div class="meta">
        <div><strong>Período:</strong> ${monthName.toUpperCase()}</div>
        <div><strong>Gerado em:</strong> ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString(
    "pt-BR",
    { hour: "2-digit", minute: "2-digit" }
  )}</div>
        <div><strong>Responsável:</strong> ${responsible}</div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 80px;">Data</th>
            <th style="width: 130px;">Categoria</th>
            <th>Descrição</th>
            <th style="text-align: right; width: 110px;">Valor</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr style="font-weight: 700; font-size: 12px; border-top: 1px solid #d1d5db;">
            <td colspan="3" style="text-align: right; padding: 8px 8px;">Total Entradas</td>
            <td style="text-align: right; padding: 8px 8px; color: #15803d;">${brl(totalEntradas)}</td>
          </tr>
          <tr style="font-weight: 700; font-size: 12px;">
            <td colspan="3" style="text-align: right; padding: 4px 8px;">Total Saídas</td>
            <td style="text-align: right; padding: 4px 8px; color: #b91c1c;">-${brl(totalSaidas)}</td>
          </tr>
          ${statsHtml}
          <tr style="font-weight: 800; font-size: 13px; border-top: 2px solid #111827; border-bottom: 2px solid #111827;">
            <td colspan="3" style="text-align: right; padding: 8px 8px;">Saldo do Período</td>
            <td style="text-align: right; padding: 8px 8px; color: ${
              saldoPeriodo >= 0 ? "#15803d" : "#b91c1c"
            };">${brl(saldoPeriodo)}</td>
          </tr>
        </tfoot>
      </table>

      <div class="signatures">
        ${signaturesHtml}
      </div>

      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}
