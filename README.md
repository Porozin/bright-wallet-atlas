# 🦁 GDA Caixa 2027 — Gestão Financeira PWA

[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Material You M3](https://img.shields.io/badge/Material_Design-3.0-blue?logo=google&logoColor=white)](https://m3.material.io/)
[![PWA Ready](https://img.shields.io/badge/PWA-Standalone-success?logo=pwa&logoColor=white)](#pwa)

> **Versão Oficial GDA Caixa 2027:** Evolução completa da plataforma financeira original do Clube de Desbravadores Guerreiros do Alto (GDA), agora reimaginada com arquitetura **Mobile-First**, design system **Material Design 3 (Material You)** e funcionamento offline via **Progressive Web App (PWA)**.

---

## 🚀 O que há de novo na Versão 2027?

1. **Mobile-First & Material You (M3)**:
   - Navegação por **Bottom Navigation Bar** com pílulas táteis responsivas e suporte a Safe Area no iOS/Android.
   - Cards de métricas com elevações sutis e cantos arredondados (`rounded-3xl`).
   - Listas empilhadas para dispositivos móveis com visualização em tabela horizontal para tablets e desktops.
2. **PWA Completo**:
   - Modo de exibição *Standalone* (comportamento de aplicativo nativo sem barra de navegador).
   - *Service Worker* com cache inteligente de assets estáticos e suporte a visualização offline básica.
3. **Módulos do GDACaixa Integrados**:
   - **Clube**: Gestão de mensalidades, doações e caixa geral.
   - **Doceria**: Controle de vendas, custos operacionais e margem de lucro.
   - **Vendas Rápidas**: Ranking de metas, hierarquia e comissões.
   - **RBAC**: Níveis de acesso para `Admin`, `Diretor`, `Conselheiro` e `Desbravador`.

---

## 📂 Estrutura do Projeto

```text
src/
├── components/
│   └── m3/                        # Componentes Material Design 3
│       ├── AppShell.tsx           # Shell da aplicação (Mobile BottomNav + Desktop NavRail)
│       ├── BottomNav.tsx          # Barra de navegação inferior mobile (M3 Navigation Bar)
│       ├── MetricCard.tsx         # Cartões de métrica M3 (rounded-3xl, tonal surfaces)
│       ├── ResponsiveTransactionList.tsx # Listas mobile empilhadas & tabelas desktop
│       ├── MonthlyChart.tsx       # Gráficos financeiros mensais
│       └── parts.tsx              # Componentes de interface e Drawer de lançamentos
├── routes/
│   ├── _authenticated/            # Rotas protegidas (Clube, Doceria, Vendas, Perfil)
│   │   ├── index.tsx              # Dashboard financeiro consolidado
│   │   ├── clube.tsx              # Gestão de mensalidades e doações
│   │   ├── doceria.tsx            # Vendas e custos da doceria com cálculo de margem
│   │   ├── vendas.tsx             # Vendas rápidas e ranking comissionado
│   │   └── mais.tsx               # Perfil, controle RBAC e exportação CSV
│   └── auth.tsx                   # Autenticação e RBAC
├── pwaRegister.ts                 # Registro do Service Worker
public/
├── manifest.json                  # Manifesto PWA
├── manifest.webmanifest           # Manifesto alternativo PWA
└── service-worker.js              # Cache e suporte offline
```

---

## 🛠️ Como Executar Localmente

```bash
# 1. Instalar dependências
bun install # ou npm install

# 2. Iniciar servidor de desenvolvimento
bun dev # ou npm run dev

# 3. Build de produção e teste do Service Worker
bun run build
bun run preview
```

---

## 🎖️ Créditos & Histórico

O **GDA Caixa 2027** é o sucessor direto do [GDACaixa Original](https://github.com/Porozin/GDACaixa), mantendo intactas as regras de negócio, valores e estrutura comunitária desenvolvidas originalmente em Vanilla JS e Firebase, agora alavancadas pelas melhores práticas de engenharia web moderna.
