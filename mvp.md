# GDACaixa — Plano Mestre de Desenvolvimento do MVP

**Projeto:** Clube Guerreiros do Alto
**Repositório de desenvolvimento:** [https://github.com/Porozin/bright-wallet-atlas](https://github.com/Porozin/bright-wallet-atlas)
**Repositório legado de referência:** [https://github.com/Porozin/GDACaixa](https://github.com/Porozin/GDACaixa)
**Prazo de referência:** dezembro de 2026
**Ambiente:** Antigravity IDE

---

# 1. MISSÃO DO PROJETO

Transformar o Bright Wallet Atlas em uma plataforma financeira moderna, confiável e mobile-first para o Clube Guerreiros do Alto (GDA).

O GDACaixa original deve ser utilizado como referência de filosofia, propósito e identidade do projeto, e não como especificação funcional obrigatória.

O objetivo é construir uma solução nova, aproveitando a arquitetura moderna do Bright Wallet Atlas, preservando sua estrutura útil e aprimorando segurança, experiência, funcionalidades e manutenção.

O sistema deverá facilitar a administração financeira do clube, especialmente a tesouraria, as vendas e a transparência financeira.

**Não construir um ERP completo. Não implementar funcionalidades futuras sem necessidade. Não aumentar a complexidade do MVP desnecessariamente.**

# 2. REGRAS FUNDAMENTAIS

1. Antes de modificar qualquer arquivo, compreender integralmente o projeto existente.
2. Não substituir tecnologias sem justificativa técnica concreta.
3. Não reescrever módulos funcionais apenas por preferência estética.
4. Não excluir dados, tabelas ou funcionalidades sem autorização.
5. Não executar migrações destrutivas.
6. Não introduzir informações financeiras fictícias em produção.
7. Não declarar uma operação financeira como concluída antes da confirmação do servidor.
8. Não confiar exclusivamente no frontend para segurança.
9. Não duplicar receitas entre os módulos e os caixas.
10. Não avançar para outra fase sem validar a anterior.
11. Documentar mudanças relevantes durante o desenvolvimento.
12. Quando houver decisões técnicas não especificadas, apresentar a alternativa recomendada e justificar sua escolha.
13. Priorizar soluções simples, sustentáveis e compatíveis com o tamanho atual do projeto.

# 3. ESCOPO DO MVP

O MVP terá três caixas financeiros fixos:

- Caixa Geral do Clube.
- Caixa da Doceria.
- Caixa de Vendas Rápidas.

Cada caixa possui identidade, saldo, histórico e relatórios próprios.

Todos os caixas também aparecem em uma visão financeira consolidada.

Não implementar criação dinâmica de caixas neste momento.

## 3.1 Caixa Geral

Funcionalidades:

- Registro de receitas.
- Registro de despesas.
- Categorias e descrições.
- Origem e destinação.
- Responsável pelo lançamento.
- Data e valor.
- Forma de pagamento.
- Comprovante opcional.
- Histórico de movimentações.
- Fechamento mensal.
- Relatórios.
- Saldo disponível e reservado.

## 3.2 Caixa da Doceria

Funcionalidades:

- Cadastro de produtos.
- Nome, imagem, preço e descrição.
- Quantidade disponível.
- Custo de produção opcional.
- Disponibilidade do produto.
- Registro de vendas.
- Seleção de produtos em grade.
- Controle de quantidade.
- Cálculo automático do total.
- Identificação do vendedor.
- Forma de pagamento.
- Histórico de vendas.
- Baixa automática de estoque.
- Relatórios de vendas e resultados.

O estoque inicial será simples, controlando quantidades dos produtos finais.

Não implementar ainda controle avançado de ingredientes, fichas técnicas, desperdícios ou produção.

## 3.3 Caixa de Vendas Rápidas

Funcionalidades:

- Cadastro de produtos.
- Vendas individuais.
- Registro de vendas avulsas.
- Quantidade, valor e vendedor.
- Forma de pagamento.
- Campanha ou observação opcional, quando necessário.
- Histórico e relatórios.

## 3.4 Integração entre os caixas

Os três caixas precisam funcionar individualmente e possuir consolidação financeira automática.

Implementar:

**Transferência interna:** movimenta dinheiro de um caixa para outro, sem representar nova receita ou despesa no resultado consolidado do clube.

**Reserva ou destinação:** identifica um valor comprometido com uma finalidade sem transferir o dinheiro para outro caixa.

Exemplo:

Uma transferência de R$ 300 da Doceria para o Caixa Geral representa:

- Saída de R$ 300 na Doceria.
- Entrada de R$ 300 no Caixa Geral.
- Nenhuma alteração no patrimônio consolidado.

A arquitetura financeira deve evitar duplicidade de receitas, despesas e saldos.

# 4. REGRAS FINANCEIRAS

- Utilizar uma fonte única da verdade para os cálculos financeiros.
- Centralizar regras de saldo, receitas, despesas, transferências e reservas.
- Não duplicar cálculos em diferentes componentes.
- Utilizar valores monetários com precisão decimal adequada, preferencialmente armazenados em centavos inteiros ou tipos numéricos apropriados no PostgreSQL.
- Registrar valores, datas, responsáveis e origem.
- Utilizar transações atômicas no banco quando houver operações compostas.
- Implementar idempotência para evitar duplicidade em operações repetidas.
- Preservar histórico financeiro.

Movimentações oficiais não podem ser apagadas silenciosamente.

Correções devem utilizar estorno ou ajuste justificado, preservando o lançamento original e a trilha de auditoria.

Vendas registradas individualmente e fechamentos por período devem ser identificados por métodos diferentes, evitando contabilização duplicada.

# 5. EXPERIÊNCIA DE VENDA E PDV MOBILE

Criar uma experiência de ponto de venda adequada a celulares.

O PDV deverá apresentar:

- Produtos em cards ou grade de botões.
- Imagens ou ícones.
- Nome e preço.
- Controles de quantidade (+ e -).
- Total calculado automaticamente.
- Seleção do vendedor.
- Forma de pagamento.
- Botão destacado para concluir venda.

Após uma venda confirmada pelo servidor:

1. Retornar automaticamente à grade.
2. Exibir confirmação discreta.
3. Informar valor e forma de pagamento.
4. Permitir iniciar outra venda.
5. Disponibilizar opção segura de correção ou reversão, preservando o histórico.

Vendedores podem ser identificados por registros simples de participantes, sem exigir conta ou autenticação individual.

Não implementar administração completa de membros.

# 6. EXPERIÊNCIA VISUAL

Adotar Material Design 3 Expressive como referência.

Características:

- Mobile-first.
- Visual premium e limpo.
- Tema claro e escuro.
- Navegação inferior adaptativa.
- Botão central de ações rápidas.
- Animações suaves.
- Transições consistentes.
- Bottom Sheets com snap points.
- Atalhos numéricos rápidos: +R$ 5, +R$ 10, +R$ 20 e +R$ 50.
- Seleção de produtos por grade.
- Feedback visual e tátil.
- Sons opcionais e desativáveis.
- Acessibilidade.
- Responsividade para tablets e computadores.

Implementar vibração com fallback seguro, utilizando APIs disponíveis no dispositivo, sem depender delas para o funcionamento.

Não sacrificar desempenho em nome de animações.

# 7. DASHBOARD

O dashboard deverá apresentar:

- Saldo consolidado.
- Receitas do mês.
- Despesas do mês.
- Resultado líquido.
- Vendas da Doceria.
- Vendas Rápidas.
- Últimas movimentações.
- Gráfico de evolução financeira.

Permitir alternar entre:

- Visão consolidada.
- Caixa Geral.
- Caixa da Doceria.
- Caixa de Vendas Rápidas.

Permitir filtros temporais e categorias relevantes.

Todos os valores devem utilizar a camada compartilhada de cálculos financeiros.

# 8. HISTÓRICO E RELATÓRIOS

Implementar histórico cronológico com filtros por:

- Caixa.
- Período.
- Categoria.
- Responsável.
- Forma de pagamento.
- Estado da operação.

Estados relevantes:

- Pendente.
- Confirmado.
- Estornado.
- Corrigido.

Relatórios:

- Diário.
- Semanal.
- Mensal.
- Individual por caixa.
- Consolidado.
- Vendas por produto.
- Vendas por vendedor.

Permitir exportação PDF e CSV.

# 9. TRANSPARÊNCIA PÚBLICA

Criar painel público sem necessidade de login.

O painel deverá mostrar:

- Categoria.
- Valor.
- Data.
- Responsável pelo lançamento.
- Origem e destinação, quando aplicável.
- Movimentações financeiras autorizadas.
- Relatórios e evolução financeira.

Permitir filtros por mês, categoria e campanha, quando houver dados dessa natureza.

Permitir baixar relatórios em PDF e CSV.

Não expor:

- Nome de compradores.
- Identificação de doadores.
- Dados pessoais privados.
- Comprovantes privados.
- Informações de autenticação.
- Dados internos desnecessários.

A disponibilização pública deve ocorrer por meio de views seguras, RPCs ou endpoints específicos do Supabase.

Nunca expor tabelas financeiras completas diretamente ao público.

Contas individuais de membros ficam para uma etapa futura.

# 10. USUÁRIOS E PERMISSÕES

Preservar a estrutura de cargos previamente definida:

**Admin**

- Controle administrativo absoluto.
- Gerenciamento de usuários.
- Configurações e permissões.

**Diretor**

- Visão financeira integral.
- Operações financeiras.
- Correções e estornos.
- Administração de permissões autorizadas.

**Tesoureiro**

- Visão financeira integral.
- Operações financeiras.
- Fechamento e reabertura mensal.
- Correções e estornos.

**Conselheiros**

- Permissões configuráveis.
- Possibilidade de enviar solicitações preliminares de movimentação.
- Solicitações não se tornam lançamentos oficiais sem aprovação e registro por Diretor ou Tesoureiro.

Padrões de permissão por cargo, com exceções individuais configuráveis.

As permissões devem considerar ações como visualizar, registrar, editar, aprovar e administrar.

Google OAuth pelo Supabase como método inicial de autenticação.

RLS e validação server-side obrigatórias.

Não depender de botões ocultos ou verificações exclusivamente no frontend.

# 11. SEGURANÇA E CONFIABILIDADE

Implementar:

- Políticas RLS.
- Validação server-side.
- Auditoria de alterações.
- Registro de responsáveis.
- Proteção de sessões.
- Confirmação adicional para operações críticas.
- Testes de autorização.
- Backups automáticos.
- Cópia externa de segurança.
- Histórico de versões.
- Procedimentos de restauração.
- Testes periódicos de restauração.

Operações críticas incluem estornos, alterações de permissões e fechamento ou reabertura de períodos financeiros.

Não armazenar senhas em texto puro.

Não inserir credenciais administrativas no código.

Nunca colocar chaves privadas ou service role do Supabase no frontend.

# 12. PWA E FUNCIONAMENTO OFFLINE

Implementar PWA com experiência instalável.

Capturar `beforeinstallprompt` quando disponível e apresentar opção elegante de instalação.

Oferecer orientação de instalação para navegadores que não disponibilizam esse evento.

Implementar:

- Cache de recursos estáticos.
- Cache persistente de consultas com TanStack Query.
- Persistência adequada em IndexedDB.
- Indicador de conexão na AppBar.
- Fila segura de operações offline.
- Sincronização quando a conexão retornar.
- Identificadores únicos.
- Idempotência.
- Tratamento de conflitos.

Estados visuais:

- Online e sincronizado.
- Offline, modo de contingência.
- Sincronizando operações pendentes.

Operações realizadas offline devem permanecer identificadas como pendentes.

Nunca apresentá-las como lançamentos financeiros oficiais antes da confirmação do servidor.

O cache de consultas não deve ser confundido com autorização para registrar operações financeiras.

# 13. FUNCIONALIDADES FORA DO MVP

Não implementar agora:

- Mensalidades.
- Inadimplência.
- Contas individuais para desbravadores.
- Gestão administrativa completa do clube.
- Secretaria.
- Unidades administrativas.
- Gestão de eventos avançada.
- Patrimônio.
- Estoque de ingredientes.
- Fichas técnicas de produção.
- Contas a pagar e receber avançadas.
- Conciliação bancária avançada.
- Gamificação.
- Ranking e XP.
- Criação dinâmica de caixas.
- Sistema multi-clubes.

A arquitetura pode permitir expansão futura, mas não criar tabelas, telas ou serviços desnecessários para essas funcionalidades.

# 14. DOCUMENTAÇÃO OBRIGATÓRIA

Manter dois documentos README com finalidades diferentes.

## README.md — Público

Apresentar:

- Nome e propósito.
- Identidade do projeto.
- Funcionalidades.
- Tecnologias.
- Capturas de tela.
- Instalação.
- Execução local.
- Estrutura geral.
- Informações de contribuição e licença, quando definidas.

Não expor informações sensíveis.

## README.TECHNICAL.md — Técnico

Documentação aprofundada contendo:

- Arquitetura.
- Estrutura de diretórios.
- Tecnologias e dependências.
- Banco de dados.
- Relacionamentos.
- Migrations.
- Políticas RLS.
- Autenticação.
- Permissões.
- Regras financeiras.
- Fluxos de operações.
- PWA.
- Cache.
- Offline.
- Sincronização.
- Implantação.
- Variáveis de ambiente.
- Backups.
- Restauração.
- Testes.
- Manutenção.
- Diagnóstico e resolução de problemas.

Incluir procedimentos práticos para problemas previsíveis, explicando sintomas, causas prováveis, diagnóstico, correção e prevenção.

## CHANGELOG.md

Registrar mudanças relevantes por versão:

- Funcionalidades adicionadas.
- Funcionalidades alteradas.
- Correções.
- Remoções.
- Alterações no banco.
- Impactos para usuários.
- Problemas conhecidos.
- Procedimentos necessários após atualização.

Documentação deve acompanhar cada fase concluída.

Não inventar informações sobre funcionalidades não implementadas.

# 15. PLANO DE EXECUÇÃO

O desenvolvimento será dividido em fases independentes.

## FASE 0 — Auditoria

Obrigatoriamente somente leitura.

- Examinar estrutura do projeto.
- Identificar funcionalidades existentes.
- Examinar banco e migrations.
- Examinar RLS.
- Examinar autenticação.
- Examinar dependências.
- Examinar PWA.
- Examinar testes.
- Identificar vulnerabilidades.
- Identificar problemas de arquitetura.
- Identificar componentes reaproveitáveis.

Entregar relatório técnico com:

1. Estado atual.
2. O que funciona.
3. O que está incompleto.
4. O que precisa ser corrigido.
5. Riscos.
6. Dependências.
7. Recomendações.
8. Plano de implementação.

Não modificar arquivos nessa fase.

## FASE 1 — Fundação e segurança

- Corrigir problemas estruturais.
- Organizar arquitetura.
- Preparar banco.
- Configurar autenticação.
- Implementar permissões.
- Implementar RLS.
- Preparar auditoria.
- Criar camada compartilhada de cálculos financeiros.

## FASE 2 — Caixas e movimentações

- Caixa Geral.
- Caixa da Doceria.
- Caixa de Vendas Rápidas.
- Receitas.
- Despesas.
- Transferências.
- Reservas.
- Saldos.
- Fechamento mensal.

## FASE 3 — Doceria e PDV

- Produtos.
- Estoque simples.
- Vendas.
- Seleção de vendedor.
- Grade de produtos.
- Pagamento.
- Atualização de estoque.
- Histórico.

## FASE 4 — Vendas rápidas e dashboard

- Catálogo.
- Vendas individuais.
- Fechamentos por período.
- Dashboard.
- Consolidação financeira.

## FASE 5 — Histórico, relatórios e transparência

- Histórico.
- Filtros.
- Relatórios.
- PDF.
- CSV.
- Painel público seguro.

## FASE 6 — PWA, offline e acabamento

- Instalação.
- Cache persistente.
- Fila offline.
- Sincronização.
- Estados de conectividade.
- Microinterações.
- Responsividade.
- Acessibilidade.

## FASE 7 — Testes e implantação

- Testes unitários.
- Testes de integração.
- Testes de autorização.
- Testes financeiros.
- Testes de sincronização.
- Testes de segurança.
- Homologação.
- Documentação final.
- Configuração de produção.
- Backup e restauração.
- Publicação.

# 16. CRITÉRIOS DE CONCLUSÃO

O MVP somente poderá ser considerado pronto quando:

1. Os três caixas funcionarem individualmente.
2. A consolidação apresentar valores corretos.
3. Transferências não duplicarem receitas.
4. Reservas forem corretamente identificadas.
5. Doceria registrar vendas e atualizar estoque.
6. Vendas rápidas funcionarem.
7. O PDV for utilizável em celulares.
8. Histórico e relatórios estiverem consistentes.
9. Painel público não expuser informações privadas.
10. Permissões forem validadas no servidor.
11. Auditoria registrar operações relevantes.
12. PWA funcionar online e em contingência offline.
13. Operações pendentes não forem apresentadas como confirmadas.
14. Testes críticos forem aprovados.
15. Documentação estiver atualizada.
16. Backups e restauração tiverem sido testados.

---

# 17. INSTRUÇÕES DE EXECUÇÃO PARA O ANTIGRAVITY

Este documento é a especificação central do projeto.

Não execute todas as fases automaticamente.

Comece exclusivamente pela FASE 0.

Após a auditoria:

1. Apresente o diagnóstico.
2. Compare o estado atual com os requisitos.
3. Identifique o que pode ser reaproveitado.
4. Apresente o plano técnico detalhado.
5. Identifique riscos e dependências.
6. Divida a implementação em tarefas pequenas e verificáveis.
7. Aguarde autorização para iniciar a implementação.

Durante o desenvolvimento:

- Trabalhe uma fase por vez.
- Preserve funcionalidades úteis.
- Faça alterações pequenas e controladas.
- Execute testes após mudanças relevantes.
- Atualize a documentação.
- Registre mudanças no changelog.
- Informe arquivos modificados.
- Informe migrations criadas.
- Informe testes executados e resultados.
- Informe problemas ainda pendentes.

Nunca declare uma fase concluída sem evidências de validação.

Se encontrar uma decisão que possa causar perda de dados, vulnerabilidade, inconsistência financeira ou alteração destrutiva, interrompa a operação e solicite autorização.

**PRINCÍPIO FINAL: construir um sistema financeiro confiável, simples de operar, seguro de manter e preparado para crescer. Não construir funcionalidades apenas porque são tecnicamente possíveis.Feedback Háptico e Microinterações M3 (Bottom Sheet com Snap Points)**

**UX Feel: Em dispositivos móveis, ações financeiras rápidas (adicionar produto, registrar venda de 1 clique, pagar dívida) devem emitir vibração tátil leve (navigator.vibrate?.([15, 30])) e feedback sonoro opcional ou animações de transição elástica.**

**Componentes: O formulário de nova transação já usa Drawer, mas pode ser aprimorado com "atalhos numéricos rápidos" (+R$ 5, +R$ 10, +R$ 20, +R$ 50) e seleção de produtos por grade de botões (estilo PDV móvel/maquininha), dispensando digitação manual lenta no teclado do celular.**

**3. Banner de Instalação PWA Ativo + Status de Conexão em Tempo Real**

**UX Feel: Um chip de status dinâmico na AppBar com as cores de estado do Material 3:**

**🟢 Online & Sincronizado (verde tonal)**

**🟡 Offline — Modo de Contingência (âmbar container)**

**🔵 Sincronizando X itens... (com barra de progresso linear contínua M3)**

**Capturar o evento beforeinstallprompt do navegador para oferecer um botão elegante "Instalar GDACaixa no Início" com um clique, garantindo experiência 100% fullscreen sem a barra de endereços do Chrome/Safari.**

**4. Cache Persistente TanStack Query (persistQueryClient)**

**Problema atual: Se você abrir o app no celular sem internet, a tela fica em branco ou vazia porque o react-query guarda o cache apenas na memória RAM da aba.**

**Melhoria: Integrar @tanstack/react-query-persist-client com @tanstack/query-sync-storage-persister ou localforage (IndexedDB). Toda vez que o app for aberto no celular, ele renderiza instantaneamente com os últimos dados conhecidos do servidor (zero segundos de tela branca), e atualiza em segundo plano.**

**5. Visão de PDV Rápido (Ponto de Venda Mobile para Eventos)**

**Em vez de abrir um formulário com campos de texto de descrição/categoria, criar uma aba ou modal "Venda Rápida":**

**Cards grandes com foto/ícone do produto (ex: Tortinha R$ 6,00, Trufa R$ 4,00, Refrigerante R$ 5,00).**

**Contador + / - direto na tela com soma total automática.**

**Seleção rápida de quem está vendendo (desbravador) e botão grandioso "Concluir Venda (Pix / Dinheiro)".**
