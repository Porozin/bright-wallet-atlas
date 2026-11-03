# GDACaixa Mobile — Plano de Produção (PWA, Material Design 3)

Reconstrução do GDACaixa (dashboard financeiro do clube Guerreiros do Alto) como app web-first instalável, com visual Material You, navegação por barra inferior e cards. Cada etapa termina com uma **Análise pós-etapa** (critérios para seguir em frente).

Módulos de origem: **Clube** (mensalidades, doações), **Doceria** (vendas, custos, lucro), **Vendas/Eventos** (comissões). Papéis: Admin, Diretor, Conselheiro, Desbravador.

---

## Etapa 1 — Fundação visual Material 3
- Tokens M3 em `styles.css` (oklch): primary, on-primary, primary-container, secondary, tertiary, surface, surface-container (lowest→highest), outline, error; modo claro e escuro.
- Tipografia M3 (Display/Headline/Title/Body/Label) com fonte Roboto Flex; raios M3 (8/12/16/28px); elevações tonais.
- Componentes base: Card (elevated/filled/outlined), FAB, Bottom Navigation Bar (3–5 destinos, indicador em pílula), Top App Bar, Chips, Bottom Sheet, Snackbar.

**Análise:** contraste AA nos dois temas; alvos de toque >= 48px; nenhuma cor fixa nos componentes.

## Etapa 2 — Estrutura do app e navegação
- Layout mobile: Top App Bar + conteúdo + Bottom Navigation fixa (safe-area iOS).
- Destinos: **Início**, **Clube**, **Doceria**, **Vendas**, **Mais** (relatórios, usuários, ajustes).
- Em telas largas (>= 840px) a barra inferior vira Navigation Rail lateral (padrão M3 adaptativo).

**Análise:** testar 360px, 412px, tablet e desktop; transições sem salto de layout.

## Etapa 3 — Lovable Cloud: login e dados
- Login por e-mail/Google; tabela de papéis separada (admin, diretor, conselheiro, desbravador).
- Tabelas: transações (módulo, tipo receita/despesa, valor, categoria, data, autor), produtos da doceria (custo/preço), vendas de evento (vendedor, comissão), registro de atividades.
- Regras de acesso por papel no próprio banco (substitui o controle feito só no navegador do projeto original).

**Análise:** testar cada papel vendo/editando só o permitido; Desbravador sem acesso indevido.

## Etapa 4 — Dashboard (Início)
- Card de saldo total em destaque, cards de receita/despesa do mês, gráfico mensal comparativo, lista das últimas movimentações, filtro por período em chips.

**Análise:** valores conferem com os dados de teste; carrega rápido em 4G.

## Etapa 5 — Módulos Clube, Doceria e Vendas
- Lista de transações em cards com busca/filtro; FAB para nova entrada abrindo bottom sheet com formulário validado.
- Doceria: custo x preço x lucro projetado. Vendas: cálculo de comissão por vendedor.
- Atualização em tempo real.

**Análise:** testes automáticos para as regras de lucro e comissão; fluxo de cadastro em menos de 3 toques.

## Etapa 6 — Relatórios e exportação
- Exportar CSV/PDF por módulo e período; restrito a Admin/Diretor.

**Análise:** arquivo abre corretamente no celular e no Excel/Planilhas.

## Etapa 7 — PWA instalável
- Manifesto, ícones, cor do tema M3, tela cheia ao abrir pelo ícone. Modo offline só se você desejar (vem depois, opcional).

**Análise:** instala no Android e iPhone; ícone e splash corretos.

## Etapa 8 — Polimento e otimização
- Movimento M3 (transições suaves), estados vazios/carregando, feedback com snackbar, acessibilidade, carregamento sob demanda de gráficos.

**Análise:** Lighthouse mobile >= 90 em desempenho e acessibilidade; publicação.

---

## Detalhes técnicos
- Stack: TanStack Start + React 19 + Tailwind v4 + shadcn customizado para M3 (sem biblioteca MUI, mais leve) + Recharts + lucide/Material Symbols.
- Estrutura: `components/m3/*` (primitivos), `features/<modulo>/*` (UI + queries), `lib/finance.ts` (regras puras testáveis).
- Dados via TanStack Query; RLS + `has_role()` para papéis.
- Entrega: Etapa 1–2 primeiro (visual navegável com dados de exemplo), depois backend.
