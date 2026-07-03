# Story: Switch "Hierarquia / Visão Global" no contexto Meu Time

**Version:** 1.0
**Created:** 2026-07-02
**Author:** Dex (@dev)
**Status:** Done
**Priority:** P1 (produto, engajamento do gestor)
**Branch:** `feat/engajamento-gestor-m1`
**Type:** Feature (brownfield)

---

## User Story

**As a** gestor no contexto Meu Time,
**I want** alternar entre ver apenas quem reporta diretamente a mim
(Hierarquia) e ver o agregado de toda a estrutura abaixo de mim (Visão
Global),
**so that** eu consiga tanto cobrar meus liderados diretos com precisão
quanto enxergar o panorama completo do meu time, sem depender só do
drill-down manual nó a nó.

---

## Contexto

O contexto `team` (Meu Time) já tinha um mecanismo de drill-down (E9,
`?focus=<node>`) que sempre "achatava" a subárvore inteira do nó focado. Não
havia um jeito de ver **apenas os diretos** de um nó sem descer manualmente
por cada subtime. `getManagedTeamStudentIds` já continha um modo "latente"
(`includeSubtree: false`, o default) que resolve só os membros explícitos dos
`manager_groups` que o gestor possui — mas nenhum call-site usava esse modo
sem `includeSubtree`, e ele sozinho não cobre o organograma direto
(`reports_to`).

Esta story introduz o switch **Hierarquia / Visão Global**, que decide,
para o nó atualmente em foco (raiz ou um subtime drilled-down), se a
tela mostra só os diretos daquele nó ou a subárvore inteira.

---

## Modelo de dados (verificado por recon, não presumido)

Não existe `manager_groups.parent_group_id` nesta branch. O alcance
transitivo hoje é: `users.reports_to` (organograma de pessoas) **UNIÃO**
`manager_group_members` (membros explícitos de grupos), resolvido pelas RPCs
`auth_reachable_student_ids()` / `auth_subtree_user_ids()` /
`subtree_student_ids()` (SECURITY DEFINER, hard-wired a `auth.uid()`).

"Diretos" de um nó `N` = união de:
- alunos com `users.reports_to = N` (organograma direto), e
- alunos listados em `manager_group_members` para todo `manager_groups` cujo
  `manager_id = N` (grupos que `N` possui).

Isso é um SUBSET estrito da subárvore completa — nunca um superset. A
autorização de `N` em si (gate contra `auth_subtree_user_ids()`) é
inalterada; o switch só decide a fatia (diretos vs. subárvore) DEPOIS que
`N` já está autorizado.

---

## Implementação

### Novo helper: `getDirectTeamStudentIds`

`apps/web/src/lib/area-context.ts` — sibling de `getManagedTeamStudentIds`
(Visão Global) e `getSubtreeStudentIdsAtNode` (drill-down, também subárvore
inteira). Reutiliza a query shape já existente para `manager_groups`/
`manager_group_members` (branch default de `getManagedTeamStudentIds`) e
adiciona a leitura de `reports_to` direto, restrita a `role=student`. Não
altera `getManagedTeamStudentIds` (comportamento existente intacto).

Contrato: `node` inválido/ausente → `[]`; caso contrário, union deduplicada
dos ids diretos.

### Cookie de persistência: `x-team-view`

`apps/web/src/lib/team-view-context.ts` — mirrors `context-context.ts` (8h
maxAge, httpOnly/secure/sameSite=strict). Enum `"direct" | "global"`.
Ausência do cookie = `"direct"` (Hierarquia, novo default). É um UI hint
puro: nunca concede acesso, só decide qual fatia de um nó já autorizado é
mostrada.

Server Action `setTeamView(mode)` adicionada em
`apps/web/src/app/(platform)/context/actions.ts`, ao lado de
`switchContext`/`exitContextMode` (mesmo arquivo de actions de contexto).

### Componente: `TeamViewSwitch`

`apps/web/src/app/(platform)/dashboard/_components/team-view-switch.tsx` —
segmented control compacto (2 botões, `role="tablist"`), ícones `Network`
(Hierarquia) / `Globe` (Visão global), estilo consistente com
`ViewAsStudentToggle`/`OrgDrilldownBreadcrumb` vizinhos. Client component,
`useTransition` + `router.refresh()` no mesmo padrão de `ContextSwitcher`.
Renderizado apenas dentro de `manager-team-dashboard-page.tsx` (contexto
team) — nunca aparece em Minha Trilha/personal.

### Superfícies atualizadas

1. **`manager-team-dashboard-page.tsx`** — lê `getTeamViewMode()`, renderiza
   o switch ao lado do breadcrumb, passa o modo para
   `getTeamEngagementBuckets` e `ManagerDashboardPage`. O card "Times abaixo"
   (`SubtreeNodeList`) continua visível em AMBOS os modos — é o caminho para
   inspecionar subtimes mesmo com o switch em Hierarquia.
2. **`manager-dashboard-page.tsx`** — nova prop `teamViewMode` (default: lida
   do cookie se o caller não passar). O cálculo de `teamStudentIds` agora
   ramifica: `"global"` mantém exatamente o comportamento anterior
   (`getSubtreeStudentIdsAtNode` com focus / `getManagedTeamStudentIds` com
   `includeSubtree:true` sem focus); `"direct"` chama
   `getDirectTeamStudentIds(focusUserId ?? managerId)`. `teachingPlanHighlights`
   (destaques do plano de ensino) herda o filtro automaticamente, pois usa o
   mesmo `teamScope`.
3. **`engagement-helpers.ts` (`getTeamEngagementBuckets`)** — novo parâmetro
   `teamViewMode` (default `"direct"`); mesma ramificação direct/global,
   aplicada ao nó em foco (root ou subtime).
4. **`/analytics` standalone (`analytics/page.tsx`)** — GAP CONHECIDO
   fechado: antes ignorava tanto o modo quanto o `?focus=` do E9 para
   gestores. Agora, quando o contexto ativo é `team`
   (`getActiveContextCookie().type === "team"`), resolve `?focus=` com o
   MESMO gate usado em `resolveDrilldownNav`
   (`auth_subtree_user_ids()`, forjado/fora de escopo → cai pra raiz) e
   aplica `teamViewMode`. Fora do contexto `team` (ou não-manager),
   comportamento byte-for-byte inalterado.
5. **`/team/profiles` (`actions.ts` + `page.tsx`)** — mesmo padrão: a `page`
   agora lê `?focus=` de `searchParams` e passa para `getTeamProfiles`;
   dentro da action, se o contexto ativo é `team`, gate + modo aplicados;
   caso contrário, branch de manager inalterada (subárvore completa, como
   antes).
6. **Nudge dispatch (`api/analytics/manager/nudge/route.ts`)** — o CONJUNTO
   OFERECIDO ao gestor já respeita modo+focus automaticamente, pois o modal
   de disparo (`team-engagement-header.tsx`) consome os buckets já calculados
   por `getTeamEngagementBuckets` com o modo correto. O passo 3 (RE-SCOPE)
   do endpoint continua **intencionalmente** validando contra a subárvore
   completa (`includeSubtree:true`) — é o piso de segurança, não deve
   encolher com o switch (documentado inline no route.ts para não ser
   "corrigido" por engano no futuro).
7. **`dashboard/page.tsx` (router) — isolamento do contexto `organization`.**
   O router tem um terceiro caso, `"manager"` (distinto de `"manager-team"`),
   que renderiza `ManagerDashboardPage` quando o contexto ativo é
   `organization` (visão de organograma corporativo do gestor), não `team`.
   Esse call-site passou a fixar `teamViewMode="global"` explicitamente —
   sem isso, o default de `ManagerDashboardPage` (`teamViewMode ?? cookie`)
   herdaria silenciosamente um `x-team-view=direct` deixado por uma sessão
   anterior em "Meu Time", vazando o switch para um contexto onde o produto
   não previu esse controle. `/analytics` e `/team/profiles` já faziam o
   gate correto (`activeContext?.type === "team"`) desde a primeira versão
   desta story; só este call-site precisou do fix.
8. **`manager-team-dashboard-page.tsx` — hero "Olá, {nome}" também no topo em
   "Meu Time" (correção da nota do FIX 1 de
   `fix-dashboard-visual-adjustments.md`, que presumia que este arquivo "já
   delegava inteiramente" e não precisava de mudança; na prática, ele
   renderizava a seção "Recorte da equipe" — breadcrumb + `TeamViewSwitch` +
   `SubtreeNodeList` + `TeamEngagementHeader` — ANTES de `<ManagerDashboardPage>`,
   empurrando o hero para baixo também no contexto team). Correção: a seção
   "Recorte da equipe" passou a ser montada como JSX local
   (`teamRecortePanel`) e passada como nova prop/slot `teamRecortePanel` para
   `ManagerDashboardPage` → `ManagerDashboard`, renderizada logo após o hero
   (mesmo padrão do slot `teachingPlanHighlights` já existente). Nenhuma
   funcionalidade mudou: drill-down `?focus=`, switch `x-team-view`, buckets
   de engajamento e nudge continuam idênticos, apenas reposicionados. Ver
   detalhes técnicos completos em `fix-dashboard-visual-adjustments.md` (FIX
   5).

---

## Segurança

- O switch é um cookie httpOnly, UI hint puro — nunca concede acesso.
- `getDirectTeamStudentIds` opera sob o client RLS autenticado do gestor,
  igual aos primitivos irmãos; o `node` passado a ele já foi gated
  (`auth_subtree_user_ids()`) pelo caller antes de chegar aqui — o helper em
  si não amplia superfície porque direct-only é sempre um subset da
  subárvore que o gate já autorizou.
- Nenhum check server-side foi afrouxado: o RE-SCOPE do nudge continua
  contra a subárvore completa, e a autorização do `focus` continua a mesma
  em todos os pontos (analytics standalone e team/profiles reusam o mesmo
  padrão de gate já usado em `resolveDrilldownNav`/
  `getSubtreeStudentIdsAtNode`).

---

## Acceptance Criteria

1. **AC-1** — No contexto Meu Time, um segmented control "Hierarquia /
   Visão global" aparece perto do recorte/navegação de equipe, nunca em
   Minha Trilha.
2. **AC-2** — Default (sem cookie) é Hierarquia: o dashboard mostra apenas
   quem reporta diretamente ao gestor (união `reports_to` + membros diretos
   dos `manager_groups` que ele possui).
3. **AC-3** — Alternar para Visão global reproduz exatamente o comportamento
   anterior à story (subárvore inteira via `auth_reachable_student_ids()` /
   `subtree_student_ids()`).
4. **AC-4** — O switch se aplica ao nó atualmente em foco (drill-down):
   navegar para um subtime e alternar o modo filtra pelos diretos/subárvore
   DAQUELE subtime, não sempre da raiz.
5. **AC-5** — O card "Times abaixo" continua visível e funcional em ambos os
   modos.
6. **AC-6** — `/analytics` standalone e `/team/profiles` respeitam o mesmo
   modo+focus quando o contexto ativo é `team`; fora desse contexto,
   comportamento inalterado.
7. **AC-7** — O disparo de nudge oferece como destinatários exatamente o
   conjunto visível (modo+focus); a revalidação de segurança server-side
   continua contra a subárvore completa, sem afrouxamento.
8. **AC-8** — Nenhuma regressão em `getManagedTeamStudentIds`,
   `getSubtreeStudentIdsAtNode` ou `resolveDrilldownNav` (assinaturas e
   comportamento default inalterados).

---

## Testing / Validation

- **Typecheck:** `pnpm --filter @eximia/web typecheck` → **PASS** (0 erros),
  antes e depois das mudanças.
- **Testes novos:** 7 casos para `getDirectTeamStudentIds` adicionados em
  `apps/web/src/lib/__tests__/area-context.test.ts` (union reports_to +
  group members, de-dupe, manager sem grupo, sem diretos, node inválido,
  tenantId vazio, node null/undefined) — todos verdes.
- **Testes existentes tocados, todos verdes:**
  `src/lib/__tests__/area-context.test.ts` (14 testes),
  `src/lib/__tests__/org-tree.test.ts` (3 testes),
  `src/app/(platform)/team/profiles/__tests__/team-profiles-scope.test.ts`
  (5 testes, réplica pura de lógica — não importa o código real, continua
  válido pois a branch admin/manager fora do contexto team é idêntica),
  `src/app/(platform)/analytics/__tests__/analytics-scope.test.ts` (8 testes,
  mesma natureza de réplica pura),
  `src/lib/__tests__/analytics.test.ts` (9 testes),
  `src/lib/__tests__/analytics-server.test.ts` (3 testes).
  Total: 42/42 verdes.
- **Suite completa (`pnpm --filter @eximia/web test`):** 373 passed / 31
  failed em 56 arquivos — **idêntico ao baseline pré-existente** informado
  antes desta story (9 arquivos, mesmos nomes: rotas sessions/messages,
  login-form-google-oauth, dashboards manager/student, onboarding
  step-employee-status, context-context, rate-limit, analytics-redirect).
  Confirmado via `git stash` que as mesmas 31 falhas (nos mesmos arquivos)
  já existiam antes das mudanças desta story — nenhuma regressão introduzida.
- **Lint (biome):** `biome check --write` (formatter + organize-imports)
  aplicado nos arquivos tocados/novos — corrigiu ordenação de imports e
  formatação introduzidas por esta story. Erros remanescentes
  (`lint/suspicious/noExplicitAny`) são todos em código pré-existente NÃO
  tocado por esta story (confirmado via `git diff` — zero ocorrências de
  `any` nas linhas adicionadas).

---

## Notes

- Nenhuma migration nova — as RPCs `auth_reachable_student_ids()` /
  `auth_subtree_user_ids()` / `subtree_student_ids()` já existem no banco
  (referenciadas pelo código existente, sem migration local versionada no
  repo — provavelmente aplicadas fora do fluxo de migrations rastreado).
- Sem commit/push (branch `feat/engajamento-gestor-m1`, mudanças permanecem
  no working tree conforme instrução).
- Working tree já continha fixes visuais de outro dev
  (`manager-dashboard-page.tsx`, `teaching-plan-highlights.tsx`,
  `registry.ts`) — preservados integralmente, esta story constrói por cima.

---

## Iteração 2 (feedback do dono) — 2026-07-02

Segunda rodada, feedback do dono sobre o switch lançado na Iteração 1.
Cinco mudanças, a mais importante é a correção de um bug real de produção
(Mudança 2).

### Mudança 1 — Rename e ressemantização dos modos

`"direct"` → label **"Diretos"** (ícone `Users`, continua default e agora
primeiro na ordem visual do switch). `"global"` → renomeado para
**`"hierarchy"`** no código (label **"Hierarquia"**, ícone `Network`).
Lógica mental do dono: "primeiro o meu time, depois o que está abaixo do
meu time".

- `team-view-context.ts`: `TeamViewMode = "direct" | "hierarchy"`. Um
  cookie `x-team-view=global` (persistido antes da Iteração 2, cookie de
  8h, então de vida curta) é tratado como `"hierarchy"` na leitura —
  compat de rename, não uma terceira semântica.
- `team-view-switch.tsx`: `OPTIONS` reordenado (Diretos primeiro), ícone
  `Globe`→`Users` para o modo Diretos.
- Texto descritivo em `manager-team-dashboard-page.tsx`: modo Diretos raiz
  agora "Você está vendo seus colaboradores diretos." (era "...apenas quem
  reporta diretamente a você.").
- Rename de `"global"` → `"hierarchy"` propagado a TODOS os call-sites que
  comparam o modo: `manager-dashboard-page.tsx`,
  `manager-team-dashboard-page.tsx`, `analytics/page.tsx`,
  `team/profiles/actions.ts`, `engagement-helpers.ts`, e o
  `dashboard/page.tsx` (que pinava `teamViewMode="global"` no contexto
  `organization` → agora pina `"hierarchy"`).

### Mudança 2 — Bug do multi-chapéu (Caio Pinheiro) — a mais importante

**Causa raiz:** o modo Diretos e os buckets de engajamento resolviam "quem
é aluno" filtrando a coluna SINGULAR `users.role = 'student'`, enquanto o
modo Hierarquia/RPCs SQL (`auth_reachable_student_ids`,
`subtree_student_ids`) já resolviam via a tabela multi-chapéu `user_roles`
(contrato E7 do EPIC-30). O usuário Caio Pinheiro (tenant Cory) tem
`users.role='manager'` MAS `user_roles=[student, manager]` e
`reports_to=Rinaldo` — ele desaparecia do modo Diretos, dos buckets de
engajamento e dos destaques do plano de ensino do Rinaldo, mesmo sendo
visível no modo Hierarquia (que já lia `user_roles` do lado SQL). Essa
divergência entre as duas fontes de verdade é o próprio bug: o mesmo
usuário existe em um recorte e some no outro.

**Correção (fonte de verdade = `user_roles`, alinhando com o SQL):**

- `area-context.ts` (`getDirectTeamStudentIds`, via (a) `reports_to`
  diretos): passou de uma query única
  `users.eq("role","student").eq("reports_to", node)` para DUAS queries —
  candidatos por `reports_to` em `users` (sem filtro de role), depois
  filtro pelo hat `student` via `user_roles.eq("role","student").in("user_id",
  candidateIds)`. A via (b) — membros de `manager_group_members` — já não
  usava a coluna `role`, ficou inalterada.
- `engagement-helpers.ts` (`getTeamEngagementBuckets`, query de
  classificação dos buckets, linha ~169): removido
  `.eq("role", "student")` da query `users` — `teamStudentIds` já É o
  universo de alunos resolvido a montante (via `getDirectTeamStudentIds`/
  subtree helpers), re-filtrar pela coluna singular derrubava o Caio do
  universo (causa do "0 acessaram"/"de 39" em vez de "de 40"). A lógica de
  classificação foi extraída para uma função interna
  `classifyTeamEngagement` (reusada pela Mudança 5, ver abaixo).
- `team/profiles/actions.ts` (roster de "Visão Comportamental", linha
  ~211): mesmo padrão — quando `studentIds !== null` (caminho de gestor,
  já escopado), o filtro `.eq("role","student")` foi REMOVIDO (a lista de
  ids já é a fonte de verdade); mantido apenas no branch `admin`
  (`studentIds === null`, roster tenant-wide, fora do escopo desta
  correção — é uma superfície de listagem por papel primário, não uma
  resolução de escopo de gestor).

**Grep completo de `.eq("role", "student")` em `apps/web/src`** (23
ocorrências) — decisão por ocorrência:

| Arquivo | Mudou? | Razão |
|---|---|---|
| `area-context.ts:209` (dentro de `getDirectTeamStudentIds`) | **Sim** | causa raiz do bug |
| `engagement-helpers.ts:169` | **Sim** | causa raiz do bug |
| `team/profiles/actions.ts:211` | **Sim** (condicional) | mesmo padrão, só no branch de gestor |
| `analytics/page.tsx:272,365` | Não | roster tenant-wide, filtrado A JUSANTE por `inScope()` contra o escopo já correto — não é "quem é aluno do meu escopo direto", é "todo aluno do tenant, depois intersecto" |
| `trails/actions.ts:352` | Não | notificação de trilha por `job_role_id`, sem relação com escopo de gestor |
| `admin/manager-groups/actions.ts:520,721` | Não | tela de admin listando/validando alunos por papel primário (fora do fluxo Diretos/Hierarquia) |
| `api/admin/engagement/campaign/route.ts:130` | Não | campanha de admin, revalida candidatos já escopados por outra via |
| `api/notifications/nudge/route.ts:53` | Não | valida 1 studentId já conhecido, não resolve universo |
| `instructor/actions.ts:147,457` | Não | superfície de instrutor (escopo por Unidade/área, não por gestor) |
| `api/analytics/aggregate/route.ts:279,1015,1260` | Não | mesmo padrão de `analytics/page.tsx` — roster tenant-wide filtrado a jusante |
| `notifications/engine.ts:164,515,724` | Não | motor de notificação genérico, revalida candidatos já escopados por quem chama |
| `notifications/audiences.ts:105,224,271` | Não | construção de audiência tenant-wide para campanhas, subsistema separado |
| `analytics/area-gestor.ts:1089` | Não | revalida candidatos já escopados por Unidade, não por gestor |

**Resultado verificado:** com a correção, Caio Pinheiro passa a: aparecer
no modo Diretos do Rinaldo (6 diretos, não 5); ser contado nos buckets (40
pessoas no total, não 39, e "Acessaram" ≥ 1 em vez de 0); aparecer nos
destaques do plano de ensino quando tiver enrollment com deadline.

### Mudança 3 — Destaques do plano de ensino nos dois modos

Diagnóstico confirmado: não havia gate por modo nos destaques — eles já
usam `teamScope` (`manager-dashboard-page.tsx`). Sumiam no modo Diretos
porque o único aluno com enrollment com deadline no cenário de teste
(Caio) era excluído pelo bug da Mudança 2. Após a correção, os destaques
aparecem nos dois modos com o escopo correto.

Adicionalmente, `TeachingPlanHighlights` ganhou um `showEmptyState?:
boolean`: quando `true` e `highlights.length === 0`, renderiza um empty
state discreto ("Nenhum aluno com plano de ensino ativo neste recorte.")
em vez de `null` — só ativado pelos call-sites em contexto `team`
(`manager-dashboard-page.tsx` passa `showEmptyState={!!teamRecortePanel}`),
preservando o `null` antigo para o contexto `organization` (onde "sem
destaques" é um estado normal, não um "recorte", e não deve carregar essa
mensagem).

### Mudança 4 — Analytics consistente com o modo (gap mais sutil)

**Gap diagnosticado:** `/api/analytics/manager/route.ts` não tinha
NENHUMA noção do switch `x-team-view` — usava um esquema de parâmetros
legado próprio (`includeSubtree`/`focusUserId`, sem `mode`). Quando
`ManagerDashboardClient` (React Query) refazia o fetch ao trocar
período/curso, a API caía no branch DEFAULT (sem `includeSubtree`), que
para um gestor sem `manager_groups` próprios (ex: Rinaldo, que só alcança
alunos via `reports_to`) resolvia para escopo VAZIO — zerando a tela a
cada troca de filtro, mesmo com o primeiro paint (SSR) correto.

**Correção:**

- A rota agora aceita `?mode=direct|hierarchy` (além de
  `focusUserId`, mantido). `mode=direct` chama `getDirectTeamStudentIds`
  no nó focado (ou na raiz do caller); `mode=hierarchy` replica o
  comportamento de subárvore já existente (gated subtree com foco, ou
  subárvore inteira sem foco). Sem `mode` (chamadores legados) o
  comportamento é BYTE-FOR-BYTE inalterado (drill-down → includeSubtree →
  default, exatamente como antes).
- Validação server-side: `focusUserId`, quando presente, é resolvido via
  `getSubtreeStudentIdsAtNode` (que já roda o gate
  `auth_subtree_user_ids()` internamente) — um nó forjado/fora de escopo
  colapsa para `[]`, nunca amplia. `mode` só ESTREITA o escopo, nunca abre;
  o cliente escolhe o modo, nunca concede acesso.
- `ManagerDashboardClient` ganhou props `teamViewMode`/`focusUserId`,
  incluídos na query string e na `queryKey` do React Query (refetch correto
  ao trocar de modo). Propagados via `ManagerDashboard` →
  `ManagerDashboardClient`, e passados por `manager-dashboard-page.tsx`
  (`resolvedTeamViewMode`, `focusUserId`).
- `/analytics` standalone já respeitava modo+focus desde a Iteração 1 — só
  o rename `"global"`→`"hierarchy"` foi propagado.

### Mudança 5 — Redesign dos buckets de engajamento

Feedback do dono: os 3 cards grandes "Acessaram / Devendo / Inativos" não
condiziam com a visão. Conceito mantido, apresentação redesenhada.

- `TeamEngagementHeader`: os 3 cards grandes viraram uma STRIP COMPACTA
  horizontal (`flex flex-wrap`) de chips com dot colorido + label + contador
  ("Acessaram 12", "Devendo 5", "Inativos 3"), mais "de N alunos" à direita.
  TODA a funcionalidade acionável foi preservada 1:1 — cada chip ainda abre
  o mesmo `BucketDrillModal` (lista de alunos + disparo de nudge escopado
  via `POST /api/analytics/manager/nudge`), só o gatilho visual mudou de
  card grande para chip.
- **Mini-indicador por time no modo Hierarquia:** cada card de "Times
  abaixo" (`SubtreeNodeList`) ganhou um indicador compacto ("N/M ativos" +
  3 dots verde/âmbar/vermelho) ao lado da contagem de alunos, só no modo
  Hierarquia (`subteamEngagement` prop, `Map<nodeId, EngagementSummary>`).
  Calculado por `getSubteamEngagementSummaries` (novo, em
  `engagement-helpers.ts`): resolve os `student_id`s de CADA subtime via
  `getSubtreeStudentIdsAtNode` (uma chamada por subtime, já existente no
  padrão de `resolveDrilldownNav`), depois classifica TODOS os alunos de
  TODOS os subtimes numa ÚNICA passada batched (via
  `classifyTeamEngagement`, extraída de `getTeamEngagementBuckets` na
  Mudança 2) sobre a UNIÃO dos ids, e reparticiona os buckets por nó em
  memória — evita N chamadas completas (`sessions`/`slide_reflections`/
  `courses`/`enrollments` repetidos por card).
- Modo Diretos: a strip resume só os diretos (comportamento já existente,
  sem mudança de escopo).

### Ordem visual (lógica do dono: meu time, depois abaixo)

Em `manager-team-dashboard-page.tsx`, a ordem dentro do painel "Recorte da
equipe" agora depende do modo:

- **Diretos:** strip de engajamento primeiro (é sobre O MEU time),
  "Times abaixo" depois — continua funcional como porta de drill, mas
  visualmente secundário nesse nível.
- **Hierarquia:** "Times abaixo" (com mini-indicadores) primeiro — É o
  conteúdo principal nesse nível — strip agregada da subárvore inteira
  depois.

O hero "Olá, {nome}" continua sempre o primeiro elemento visual da página
(inalterado desde a Iteração 1); o painel "Recorte da equipe" (switch +
descrição + breadcrumb) continua logo após.

### Testing / Validation (Iteração 2)

- **Typecheck:** `pnpm --filter @eximia/web typecheck` → PASS (0 erros).
- **Testes novos:**
  - `apps/web/src/lib/__tests__/team-view-context.test.ts` (novo, 5 casos):
    default `"direct"` sem cookie, `"direct"`/`"hierarchy"` explícitos,
    cookie legado `"global"` → `"hierarchy"`, valor malformado → `"direct"`.
  - `apps/web/src/lib/__tests__/area-context.test.ts`: 2 testes existentes
    de `getDirectTeamStudentIds` atualizados para o novo shape de query
    (`users` sem filtro de role + `user_roles` com o filtro), mais 2 casos
    NOVOS de multi-chapéu (inclui direto cujo `users.role` primário é
    `manager` mas que possui o hat `student` via `user_roles`; exclui
    candidato que NÃO possui o hat `student`).
  - `apps/web/src/app/api/analytics/manager/__tests__/route.test.ts`: mock
    de `area-context` estendido com `getDirectTeamStudentIds`/
    `getSubtreeStudentIdsAtNode`; 6 casos novos cobrindo `mode=direct` (sem
    e com `focusUserId`), `mode=hierarchy` (sem e com `focusUserId`), e
    `mode` desconhecido caindo no comportamento legado inalterado. Os 5
    testes pré-existentes (AC2–AC6) continuam verdes sem alteração de
    asserção (não exercitam `mode`, então o branch legado intocado é quem
    responde).
  - Total: 61/61 verdes nos arquivos tocados (16 area-context + 5
    team-view-context + 10 manager/route + 5 org-tree + 5
    team-profiles-scope + 8 analytics-scope + 9 analytics + 3
    analytics-server).
- **Suite completa (`npx vitest run`):** 385 passed / 31 failed em 57
  arquivos (9 arquivos falhos) — os mesmos 31 casos, nos mesmos 9 arquivos,
  do baseline documentado na Iteração 1 (confirmado por `git stash` +
  re-execução de `manager-dashboard.test.tsx`, que reproduziu a MESMA
  falha byte-for-byte antes das mudanças desta iteração). Nenhuma
  regressão introduzida.
- **Lint (biome):** `biome check --write` aplicado nos arquivos tocados —
  corrigiu ordenação de imports e wrapping de linhas longas introduzidos
  por esta iteração, e um warning de a11y (`role="group"` redundante,
  removido). Erros remanescentes (`lint/suspicious/noExplicitAny`) são
  todos em código pré-existente NÃO tocado por esta iteração (confirmado
  por número de linha e `git diff`).
- **Build:** `pnpm --filter @eximia/web build` → sucesso, 108 páginas
  estáticas geradas, nenhum erro de compilação (só warnings pré-existentes
  do Sentry, não relacionados).

### File List (Iteração 2)

- `apps/web/src/lib/team-view-context.ts` (modified — rename `global`→`hierarchy`, compat de leitura do valor legado)
- `apps/web/src/lib/area-context.ts` (modified — `getDirectTeamStudentIds` resolve o hat `student` via `user_roles`, corrige o bug multi-chapéu)
- `apps/web/src/lib/engagement-helpers.ts` (modified — remove `.eq("role","student")` da classificação; extrai `classifyTeamEngagement`; novo `getSubteamEngagementSummaries` batched)
- `apps/web/src/lib/__tests__/area-context.test.ts` (modified — 2 testes existentes atualizados + 2 novos casos de multi-chapéu)
- `apps/web/src/lib/__tests__/team-view-context.test.ts` (new — 5 casos, cobre default/explícito/legado/malformado)
- `apps/web/src/app/(platform)/dashboard/_components/team-view-switch.tsx` (modified — labels Diretos/Hierarquia, reordenado, ícone `Users`)
- `apps/web/src/app/(platform)/dashboard/_components/manager-team-dashboard-page.tsx` (modified — rename, ordem visual por modo, mini-indicadores por subtime)
- `apps/web/src/app/(platform)/dashboard/_components/manager-dashboard-page.tsx` (modified — rename, propaga `teamViewMode`/`focusUserId` ao `ManagerDashboard`, `showEmptyState` nos destaques)
- `apps/web/src/app/(platform)/dashboard/_components/subtree-node-list.tsx` (modified — prop `engagementByNodeId`, mini-indicador de engajamento por card)
- `apps/web/src/app/(platform)/dashboard/page.tsx` (modified — rename `"global"`→`"hierarchy"` no pin do contexto organization)
- `apps/web/src/app/(platform)/analytics/page.tsx` (modified — rename `"global"`→`"hierarchy"`)
- `apps/web/src/app/(platform)/team/profiles/actions.ts` (modified — rename + remove `.eq("role","student")` redundante no branch de gestor)
- `apps/web/src/app/api/analytics/manager/route.ts` (modified — aceita `mode=direct|hierarchy`, fecha o gap da Mudança 4)
- `apps/web/src/app/api/analytics/manager/__tests__/route.test.ts` (modified — mocks estendidos + 6 casos novos para `mode`)
- `apps/web/src/components/dashboard/team-engagement-header.tsx` (modified — redesign strip compacta, funcionalidade de drill+nudge preservada)
- `apps/web/src/components/dashboard/manager-dashboard-client.tsx` (modified — props `teamViewMode`/`focusUserId`, incluídos no fetch + queryKey)
- `apps/web/src/components/dashboard/manager-dashboard.tsx` (modified — propaga `teamViewMode`/`focusUserId` ao `ManagerDashboardClient`)
- `apps/web/src/components/dashboard/teaching-plan-highlights.tsx` (modified — `showEmptyState` prop, empty state discreto em vez de `null`)
- `docs/stories/feat-team-view-hierarchy-switch.md` (modified — esta seção)

---

## Dev Agent Record

**Agent:** Dex (@dev)
**Date:** 2026-07-02

### File List
- `apps/web/src/lib/area-context.ts` (modified — novo helper `getDirectTeamStudentIds`)
- `apps/web/src/lib/team-view-context.ts` (new — cookie `x-team-view`, `getTeamViewMode`/`setTeamViewMode`/`clearTeamViewMode`)
- `apps/web/src/lib/engagement-helpers.ts` (modified — `getTeamEngagementBuckets` ganha parâmetro `teamViewMode`)
- `apps/web/src/lib/__tests__/area-context.test.ts` (modified — 7 novos testes para `getDirectTeamStudentIds`)
- `apps/web/src/app/(platform)/context/actions.ts` (modified — nova Server Action `setTeamView`)
- `apps/web/src/app/(platform)/dashboard/_components/team-view-switch.tsx` (new — segmented control Hierarquia/Visão global)
- `apps/web/src/app/(platform)/dashboard/_components/manager-team-dashboard-page.tsx` (modified — lê modo, renderiza switch, propaga para buckets + ManagerDashboardPage)
- `apps/web/src/app/(platform)/dashboard/_components/manager-dashboard-page.tsx` (modified — nova prop `teamViewMode`, ramificação direct/global no cálculo de `teamStudentIds`)
- `apps/web/src/app/(platform)/analytics/page.tsx` (modified — respeita modo+focus quando contexto ativo é `team`, gap fechado)
- `apps/web/src/app/(platform)/team/profiles/page.tsx` (modified — lê `?focus=` de searchParams)
- `apps/web/src/app/(platform)/team/profiles/actions.ts` (modified — `getTeamProfiles` aceita `focusUserId`, respeita modo+focus quando contexto ativo é `team`)
- `apps/web/src/app/api/analytics/manager/nudge/route.ts` (modified — comentário documentando que o RE-SCOPE permanece intencionalmente contra a subárvore completa)
- `apps/web/src/app/(platform)/dashboard/page.tsx` (modified — fixa `teamViewMode="global"` no call-site do caso `"manager"`/organization, isolando o switch do contexto `team`)

---

## Iteração 3: fix RLS do escopo Diretos — 2026-07-02

Terceira rodada, bug real confirmado EM PRODUÇÃO (não em teste/mock):
gestores no modo "Diretos" viam a tela zerada ("de 0 alunos", destaques
vazios, tabela Cursos vazia), apesar de `getDirectTeamStudentIds` já
resolver corretamente o chapéu multi-hat (Mudança 2 da Iteração 2).

### Causa raiz

`getDirectTeamStudentIds` (via (a) `reports_to` diretos) filtrava o chapéu
`student` consultando `user_roles` diretamente com o client AUTENTICADO do
gestor. As policies de RLS de produção em `user_roles` são:

- `ur_self_select`: `user_id = auth.uid()` (só o próprio registro);
- `ur_admin_manage`: só admin do tenant;
- `ur_super_admin_all`: só super admin.

**Não existe policy que permita a um MANAGER ler o chapéu de um
TERCEIRO.** A query sempre retornava vazio para qualquer subordinado, o
universo "Diretos" colapsava para `[]`, e tudo a jusante (buckets de
engajamento, destaques do plano de ensino, tabela Cursos do
`/api/analytics/manager`) zerava. Os testes unitários (Iteração 2) nunca
pegaram isso porque os mocks simulam a FORMA da query, não a RLS real —
só um teste contra o banco de produção revelou o bug.

**Lição estrutural, a que fica:** escopo que precisa enxergar dados de
TERCEIROS (não do próprio `auth.uid()`) nunca deve ser resolvido em SQL
client-side sobre uma tabela protegida por RLS restritiva — mesmo que a
query "pareça" correta e passe em teste com mock. A receita correta,
usada pelas três RPCs irmãs do EPIC-30
(`auth_reachable_student_ids`/`auth_subtree_user_ids`/
`subtree_student_ids`) desde o início, é resolver em uma função SQL
`SECURITY DEFINER` com gate embutido (fail-closed) — nunca client-side.
`getDirectTeamStudentIds` foi o único primitivo de escopo de gestor que
não seguia essa receita; agora segue.

### Correção

**Nova função SQL `auth_direct_student_ids(_node uuid)`** —
`SECURITY DEFINER`, `STABLE`, `search_path` pinado, mesmo estilo das três
irmãs. Aplicada em produção via Management API e versionada em
`supabase/migrations/20260702222743_auth_direct_student_ids.sql`
(primeira função dessa família a ser versionada — as três irmãs
continuam como dívida técnica de prod, documentado inline na migration).

- **GATE (fail-closed):** `_node` deve ser `auth.uid()` OU pertencer a
  `auth_subtree_user_ids()`; caso contrário retorna vazio. Mesmo padrão
  de `auth_reachable_student_ids()`.
- **Resolução** = união de (a) `users.reports_to = _node` com o chapéu
  `student` via `user_roles` (lido dentro da função, com privilégio
  elevado, sem tropeçar na RLS) e (b) membros de `manager_group_members`
  para os `manager_groups` cujo `manager_id = _node`.
- **Testado em produção**, simulando o Rinaldo numa transação com
  `set_config('request.jwt.claims', ...)` + `SET LOCAL ROLE
  authenticated` + `ROLLBACK`: retornou exatamente os 6 ids esperados
  (Artur, Caio Pinheiro, Cintia, Neusa, Oziel, Venilton). Gate testado à
  parte com um nó fora da subárvore do Rinaldo — retornou vazio.

`getDirectTeamStudentIds` (`area-context.ts`) foi simplificado para
delegar inteiramente à RPC (`db.rpc("auth_direct_student_ids", { _node:
node })`), removendo as duas queries client-side (`users` +
`user_roles`) que causavam o bug. Fail-closed mantido: erro da RPC → `[]`
(mesmo padrão de `getSubtreeStudentIdsAtNode`).

**Grep completo de `from("user_roles")` e `.eq("role","student")` em
`apps/web/src`** confirmou que nenhuma outra superfície precisava de
mudança: `context/actions.ts` só lê o próprio registro
(`user_id = user.id`, imune à RLS), e todas as ocorrências de
`.eq("role","student")` remanescentes já foram endereçadas na Iteração 2
(tabela de decisão já documentada acima) ou são revalidações a jusante de
um escopo já resolvido (não widening).

### Mudança adicional — "Times abaixo" exclusivo do modo Hierarquia

Feedback do dono: a lista "Times abaixo" (`SubtreeNodeList`) não deveria
aparecer no modo Diretos — ela é a porta de drill da estrutura ABAIXO do
nó, o que só faz sentido conceitualmente em Hierarquia. Isso substitui a
regra da Iteração 1 (AC-5, "visível em ambos os modos").

`manager-team-dashboard-page.tsx`: o modo Diretos agora renderiza SÓ a
strip de engajamento (`engagementStrip`); `subtreeList` só é montado no
JSX quando `teamViewMode === "hierarchy"`. O breadcrumb de drill-down
continua funcionando em AMBOS os modos (um gestor que drilled via
Hierarquia e depois alterna para Diretos mantém o lugar na árvore).

### Simplificação do gate em `/api/analytics/manager`

O `mode=direct` da rota tinha um gate JS explícito
(`auth_subtree_user_ids()` + verificação manual antes de chamar
`getDirectTeamStudentIds`), adicionado num review anterior porque, na
época, `getDirectTeamStudentIds` não gateava seu próprio `node`. Agora
que a RPC `auth_direct_student_ids` tem o MESMO gate embutido (SECURITY
DEFINER, fail-closed), o gate JS duplicado foi removido — o mesmo
resultado fail-closed é obtido dentro da RPC, uma chamada a menos, sem
afrouxar segurança (o gate não foi removido, só mudou de lugar).

### Testing / Validation (Iteração 3)

- **Typecheck:** `pnpm --filter @eximia/web typecheck` → PASS (0 erros).
- **Teste da RPC em produção:** simulação de sessão do Rinaldo via
  `set_config('request.jwt.claims', ...)` + `SET LOCAL ROLE
  authenticated`, dentro de transação com `ROLLBACK` (nenhuma mutação
  persistida) → 6 ids corretos. Gate testado com nó forjado fora da
  subárvore → vazio.
- **Testes atualizados:**
  `apps/web/src/lib/__tests__/area-context.test.ts` — todo o bloco
  `describe("getDirectTeamStudentIds", ...)` reescrito para mockar
  `db.rpc("auth_direct_student_ids", ...)` em vez das queries client-side
  removidas (8 casos: união/dedupe via RPC, `[]` em dados vazios/null,
  fail-closed em erro da RPC, `[]` sem chamar a RPC para node
  inválido/tenant vazio/node nulo, multi-chapéu resolvido pela RPC).
  `apps/web/src/app/api/analytics/manager/__tests__/route.test.ts` — os 2
  testes que asseriam o gate JS explícito (`mockRpc` chamado com
  `"auth_subtree_user_ids"`) atualizados: o teste de foco válido não
  espera mais essa chamada, e o teste de nó forjado agora simula o
  fail-closed acontecendo DENTRO da RPC mockada (retorna `[]`) em vez de
  esperar que a rota nunca a chame.
- **Suite dos arquivos tocados/relevantes** (8 arquivos): 59/59 verdes
  (`area-context.test.ts` 15, `route.test.ts` 11, `team-view-context.test.ts`
  5, `org-tree.test.ts` 3, `team-profiles-scope.test.ts` 5,
  `analytics-scope.test.ts` 8, `analytics.test.ts` 9,
  `analytics-server.test.ts` 3).
- **Suite completa (`pnpm exec vitest run`):** 385 passed / 31 failed em
  57 arquivos (9 arquivos falhos) — números IDÊNTICOS ao baseline da
  Iteração 2 (mesmos 9 arquivos: sessions/messages,
  login-form-google-oauth, analytics-redirect,
  manager-course-dashboard, dashboards manager/student,
  step-employee-status, context-context, rate-limit). Nenhuma regressão
  introduzida por esta iteração.
- **Build:** `pnpm --filter @eximia/web build` → sucesso, 108 páginas
  geradas, nenhum erro de compilação (só warnings pré-existentes do
  Sentry).

### File List (Iteração 3)

- `supabase/migrations/20260702222743_auth_direct_student_ids.sql` (new —
  função `auth_direct_student_ids(_node uuid)`, SECURITY DEFINER,
  aplicada em produção via Management API antes de versionada)
- `apps/web/src/lib/area-context.ts` (modified — `getDirectTeamStudentIds`
  delegado inteiramente à RPC nova, remove as duas queries client-side
  sobre `users`/`user_roles` que tropeçavam na RLS)
- `apps/web/src/lib/__tests__/area-context.test.ts` (modified — bloco
  `getDirectTeamStudentIds` reescrito para mockar `db.rpc`)
- `apps/web/src/app/(platform)/dashboard/_components/manager-team-dashboard-page.tsx`
  (modified — "Times abaixo" agora exclusivo do modo Hierarquia; breadcrumb
  continua em ambos os modos)
- `apps/web/src/app/api/analytics/manager/route.ts` (modified — remove o
  gate JS duplicado de `mode=direct`, agora redundante com o gate
  embutido na RPC)
- `apps/web/src/app/api/analytics/manager/__tests__/route.test.ts`
  (modified — 2 testes atualizados para o gate agora vivendo dentro da RPC)
- `docs/stories/feat-team-view-hierarchy-switch.md` (modified — esta seção)
- `docs/stories/feat-team-view-hierarchy-switch.md` (new — this story)
