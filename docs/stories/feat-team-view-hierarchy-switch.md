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
- `docs/stories/feat-team-view-hierarchy-switch.md` (new — this story)
