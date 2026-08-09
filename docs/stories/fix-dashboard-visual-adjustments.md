# Story: Ajustes visuais no dashboard do gestor (hero, destaques em grid, ordem da sidebar)

**Version:** 1.0
**Created:** 2026-07-02
**Author:** Dex (@dev)
**Status:** Done
**Priority:** P2 (visual/regressão)
**Branch:** `feat/engajamento-gestor-m1`
**Type:** Fix (brownfield, visual)

---

## User Story

**As a** gestor logado no dashboard,
**I want** ver a saudação "Olá, {nome}" sempre no topo, os destaques do plano de
ensino organizados em colunas, e a Biblioteca antes de Analytics na sidebar,
**so that** a navegação e a hierarquia visual da tela reflitam o desenho
pretendido, sem regressões de commits anteriores.

---

## Contexto

Três defeitos visuais reportados no dashboard do gestor, cada um com causa raiz
diferente e já diagnosticada antes da implementação. Nenhum deles envolvia
lógica de dados/RLS, apenas composição JSX, wrapper de layout e ordem de
iteração.

---

## FIX 1 — Card "Olá, {nome}" fora de posição

### Causa raiz

Em `manager-dashboard-page.tsx`, quando `paceHighlights.length > 0`, o
componente `<TeachingPlanHighlights>` era renderizado **antes** de
`<ManagerDashboard>` (que contém o hero "Olá, {nome}"), empurrando a saudação
para baixo da tela. Era um problema de **ordem de composição JSX**, não de
CSS/posicionamento.

### Correção

O hero de saudação passa a ser **sempre** o primeiro elemento visual da
página. `ManagerDashboard` ganhou uma nova prop `teachingPlanHighlights?:
React.ReactNode`, renderizada logo após o hero (dentro do mesmo
`<div className="space-y-8">`, antes dos Stats), preservando os espaçamentos
existentes. `ManagerDashboardPage` deixou de renderizar
`<TeachingPlanHighlights>` fora do componente e passa a passá-lo como slot.

`manager-team-dashboard-page.tsx` (visão "Meu Time") não tinha o padrão
duplicado — ele já delega inteiramente a `<ManagerDashboardPage>`, então o fix
propaga automaticamente sem mudança adicional ali.

---

## FIX 2 — Destaques do plano de ensino empilhados (regressão)

### Causa raiz

O commit `ed9e178` (2026-06-06) já havia envolvido as seções "No ritmo ou
adiantados" e "Atenção — atrasados" em
`<div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">` para
exibi-las lado a lado. O commit `f572414` (2026-06-23, port do EPIC-30 para
produção) **sobrescreveu o arquivo com uma versão anterior**, revertendo esse
fix sem intenção — as duas seções voltaram a empilhar verticalmente.

### Correção

Reaplicado o wrapper `grid grid-cols-1 lg:grid-cols-2 gap-4 items-start` ao
redor dos dois blocos condicionais em `teaching-plan-highlights.tsx`, idêntico
ao diff original de `ed9e178` (confirmado via `git show ed9e178 --
apps/web/src/components/dashboard/teaching-plan-highlights.tsx`).

---

## FIX 3 — Sidebar: Biblioteca deve vir antes de Analytics

### Causa raiz

`getEnabledModules()` em `packages/shared/src/modules/registry.ts` montava
`new Set([...coreModules, ...enabledIds])`. A ordem de inserção do `Set`
fazia os módulos `core` (`academy`, `analytics`, `admin`) sempre precederem os
não-core (`biblioteca`), independentemente da ordem declarada em `MODULE_IDS`
ou da config do tenant. `buildNavigation` itera sobre esse array na ordem
retornada, então a sidebar sempre mostrava Analytics antes de Biblioteca.

### Correção (opção cirúrgica)

1. `biblioteca` movido para antes de `analytics` em `MODULE_IDS`.
2. `getEnabledModules` passou a ordenar o resultado final pelo **índice de
   `MODULE_IDS`** (`MODULE_IDS.filter((id) => allEnabled.has(id))`), em vez de
   depender da ordem de inserção do `Set`.

### Verificação de call-sites (antes de mudar)

`getEnabledModules` é consumido por: `buildNavigation` (ordem importa — é o
alvo do fix), `isRouteAllowed`/`isApiRouteAllowed` (usam `.some(...)`, ordem
irrelevante) e `module-provider.tsx` (usa só para derivar `enabledIds`/`Set`
de lookup, ordem irrelevante). Nenhum teste (`grep` por
`registry|getEnabledModules|MODULE_IDS|buildNavigation` em `*.test.ts(x)`)
depende da ordem anterior. Mudança segura, sem efeito colateral em nenhum
consumidor.

Resultado verificado (script ad-hoc via `tsx`): para um gestor com
`biblioteca` habilitado, `buildNavigation` agora emite "Biblioteca" antes de
"Analytics" na sidebar.

---

## FIX 4, Destaques do plano de ensino sem escopo de Unidade (regressão)

### Causa raiz

O mesmo commit `f572414` (2026-06-23, port do EPIC-30 para produção) que
sobrescreveu `teaching-plan-highlights.tsx` (FIX 2) também sobrescreveu, com o
mesmo mecanismo de porte de versão anterior, os dois arquivos que montam os
Destaques do Plano de Ensino:

- `manager-dashboard-page.tsx`
- `instructor/page.tsx` (dashboard do instrutor)

Dois fixes de escopo de Unidade, aplicados originalmente em sequência, foram
perdidos silenciosamente:

1. `a3ed62f` (2026-06-10) filtrava os `deadlineCourses` por `courses.area_id`
   quando havia Unidade ativa.
2. `f6f80ab` (2026-06-10, correção do anterior) trocou o eixo: a Unidade é
   atributo do **aluno** (`user_areas`), não do curso. Resolvia o universo de
   alunos da unidade ativa via `getAreaStudentIds` e filtrava as matrículas
   (`enrollments`) por `student_id`, não os cursos por `area_id`.

Depois do porte, o import de `getAreaStudentIds` desapareceu dos dois
arquivos e a query de `activeEnrollments` voltou a rodar sem nenhum filtro de
Unidade, os Destaques passaram a mostrar alunos de todas as unidades,
independente da Unidade selecionada no seletor do header. Regressão
confirmada por auditoria, sem cobertura de teste que a detectasse.

### Correção

Reaplicado exatamente o comportamento de `f6f80ab` (não o de `a3ed62f`, que já
havia sido corrigido pelo próprio autor por errar o eixo) nos dois arquivos:

- Import de `getAreaStudentIds` restaurado a partir de `@/lib/area-context`.
- `const areaStudentIds = await getAreaStudentIds(db, tenantId, activeAreaId)`
  resolvido antes da query de `deadlineCourses`.
- Query de `activeEnrollments` convertida de `await` direto para
  `let ...Query = ...` seguido de `if (areaStudentIds) { ...Query =
  ...Query.in("student_id", areaStudentIds) }`, mesmo padrão condicional do
  commit original (`null` = "Todas" → sem escopo; `[]` = unidade sem alunos →
  sem destaques).

Em `manager-dashboard-page.tsx` havia uma composição adicional a resolver: o
arquivo hoje também aplica escopo de **Time** (`teamScope`/`teamViewMode`,
adicionado por outra story em andamento na mesma branch), que já filtrava
`activeEnrollments` por `student_id` via `.in("student_id", teamScope.length >
0 ? teamScope : ["__none__"])`. Unidade e Time são eixos ortogonais (um é
atributo do aluno via `user_areas`, o outro via hierarquia de gestor/
`manager_groups`) e devem compor por **interseção**, não por substituição um
do outro. A query final encadeia os dois filtros `.in("student_id", ...)`
(primeiro o de Time, depois, condicionalmente, o de Unidade), que o Supabase
resolve como `AND` lógico, exatamente a interseção pretendida.

Em `instructor/page.tsx` não havia escopo concorrente, reaplicação direta e
cirúrgica, idêntica ao diff de `f6f80ab`.

---

## FIX 5, Hero "Olá, {nome}" fora de posição também no contexto Meu Time

### Causa raiz

A nota original do FIX 1 presumia que `manager-team-dashboard-page.tsx` "não
tinha o padrão duplicado" porque "já delega inteiramente a
`<ManagerDashboardPage>`". Essa presunção estava incorreta: o componente
renderizava a seção "Recorte da equipe" (breadcrumb de drill-down + switch
Hierarquia/Visão Global + `SubtreeNodeList` + `TeamEngagementHeader`) dentro
de um `<div className="space-y-5">` **antes** de `<ManagerDashboardPage>`
(que é quem, por sua vez, renderiza `<ManagerDashboard>` e o hero "Olá,
{nome}"). No contexto "Meu Time", a saudação continuava aparecendo abaixo de
todo o bloco de recorte de equipe, mesmo depois do fix em
`manager-dashboard-page.tsx`.

### Correção

Mesma técnica do slot `teachingPlanHighlights` (FIX 1): `ManagerDashboard`
ganhou uma nova prop `teamRecortePanel?: React.ReactNode`, renderizada
dentro do `<div className="space-y-8">` logo após o hero e antes de
`teachingPlanHighlights`. `ManagerDashboardPage` ganhou a prop equivalente
`teamRecortePanel`, apenas repassando o valor recebido para
`<ManagerDashboard>` (não constrói nada, é puramente pass-through).
`manager-team-dashboard-page.tsx` deixou de renderizar a seção "Recorte da
equipe" como JSX-irmão de `<ManagerDashboardPage>`; agora monta a mesma
seção como uma constante JSX local (`teamRecortePanel`) e a passa como prop.
O `return` do componente passou a ser só `<ManagerDashboardPage ...
teamRecortePanel={teamRecortePanel} />`, sem wrapper `<div className="space-y-5">`
próprio (o espaçamento entre hero, painel de recorte e o resto do conteúdo
agora vem do `space-y-8` interno de `<ManagerDashboard>`, mesmo espaçamento
que já regia `teachingPlanHighlights`/Stats/Quick actions).

Nenhuma funcionalidade foi alterada: drill-down via `?focus=` (gated por
`resolveDrilldownNav`/`auth_subtree_user_ids()`), o switch `x-team-view`
(Hierarquia/Visão Global), a lista "Times abaixo" (`SubtreeNodeList`), os
buckets de engajamento (`TeamEngagementHeader`, calculados por
`getTeamEngagementBuckets`) e o disparo de nudge continuam byte-for-byte
equivalentes, apenas reposicionados na árvore de componentes.

### Arquivos

- `apps/web/src/components/dashboard/manager-dashboard.tsx` — nova prop
  `teamRecortePanel?: React.ReactNode`, renderizada logo após o hero.
- `apps/web/src/app/(platform)/dashboard/_components/manager-dashboard-page.tsx`
  — nova prop `teamRecortePanel`, repassada para `<ManagerDashboard>`.
- `apps/web/src/app/(platform)/dashboard/_components/manager-team-dashboard-page.tsx`
  — a seção "Recorte da equipe" passou de JSX-irmão (renderizado antes) para
  constante local passada como prop `teamRecortePanel` a
  `<ManagerDashboardPage>`.

---

## Nota de segurança — service_role key hardcoded em `supabase/seed-cory-users.py`

Durante a validação desta story, foi identificada (fora do escopo original
dos fixes visuais, tratada como correção pontual de segurança) uma
`service_role` key do Supabase de **produção** hardcoded em texto plano em
`supabase/seed-cory-users.py` (linha 17), commitada no repositório.

### Correção

A key passou a ser lida de `SUPABASE_SERVICE_ROLE_KEY` via `os.environ`, com
`sys.exit` e mensagem de erro clara (instrução de `export`) caso a variável
esteja ausente. Script agora falha cedo e explicitamente em vez de rodar com
uma key gravada no arquivo.

### Varredura de outros segredos

`grep -rn` por `eyJ` (JWT/anon/service_role keys), `service_role` e `sbp_`
(personal access tokens) em `supabase/` e `scripts/`:

- **`supabase/seed-cory-users.py`** — ÚNICO arquivo com segredo hardcoded em
  texto plano (a `service_role` key de produção acima). Corrigido.
- `supabase/seed-remote.ts`, `supabase/seed-asp-chapter.ts`,
  `scripts/copy-questions.mjs`, `scripts/fix-progress.mjs`,
  `scripts/generate-narrations.mjs`, `scripts/send-migration-email.mjs` — já
  leem `SUPABASE_SERVICE_ROLE_KEY` (e, quando aplicável,
  `ELEVENLABS_API_KEY`/`RESEND_API_KEY`) via `process.env`, sem hardcode. Nada
  a corrigir.
- `supabase/config.toml` — todas as chaves/segredos referenciados usam
  `env(...)` (substituição de variável de ambiente do Supabase CLI), padrão
  correto, nada a corrigir.
- Demais ocorrências de `service_role` (em `supabase/migrations/*.sql` e
  `supabase/_backups/*.sql`) são nome de **role** do Postgres em policies RLS
  (`FOR ALL TO service_role ...`), uso legítimo de SQL, não segredo.
- Nenhuma ocorrência de `sbp_` (Supabase personal access token) encontrada em
  `supabase/` ou `scripts/`.

**Ação pendente fora do escopo desta correção (não executada aqui):**
como a key ficou commitada no histórico do git em texto plano, o dono do
projeto deve **revogar/rotacionar** essa `service_role` key no painel do
Supabase (Project Settings → API), já que remover do arquivo atual não
apaga o valor do histórico de commits.

---

## Acceptance Criteria

1. **AC-1** — O hero "Olá, {nome}" é sempre o primeiro elemento visual do
   dashboard do gestor, com ou sem destaques do plano de ensino.
2. **AC-2** — Quando existem destaques "No ritmo ou adiantados" e "Atenção",
   ambos aparecem lado a lado em telas `lg+` (grid de 2 colunas) e empilhados
   em telas estreitas.
3. **AC-3** — Na sidebar, o item "Biblioteca" aparece antes de "Analytics"
   para todos os papéis que têm ambos os módulos habilitados.
4. **AC-4** — Nenhuma mudança de comportamento em RLS, escopo de dados ou
   agregados nos FIX 1 a FIX 3, puramente composição/ordem visual.
5. **AC-5**, os Destaques do Plano de Ensino (gestor e instrutor) respeitam a
   Unidade ativa selecionada no header: com Unidade selecionada, mostram
   apenas alunos daquela unidade (via `user_areas`); sem Unidade selecionada
   ("Todas"), mostram o universo completo permitido pelos demais escopos
   (Time, no caso do gestor).
6. **AC-6** — O hero "Olá, {nome}" também é o primeiro elemento visual no
   contexto "Meu Time" (`manager-team-dashboard-page.tsx`), com o "Recorte da
   equipe" (breadcrumb, switch, times abaixo, buckets) renderizado logo em
   seguida — mesma hierarquia visual e espaçamento (`space-y-8`) já aplicados
   aos demais slots pós-hero.

---

## Testing / Validation

- **Typecheck:** `pnpm --filter @eximia/web typecheck` → **PASS** (0 erros),
  antes e depois das mudanças.
- **Vitest (arquivo tocado com teste próprio):**
  `npx vitest run src/components/dashboard/__tests__/manager-dashboard.test.tsx`
  → 1 passa, 1 falha. A falha (`/Olá, Carlos!/` com exclamação, que o
  componente nunca renderizou) é **pré-existente**: reproduzida via
  `git stash` isolando o código original antes desta story, mesmo resultado
  exato. Não é regressão desta mudança; fora do escopo pedido (fora dos 3
  fixes).
- **Lint (biome) nos 4 arquivos tocados:** os poucos erros reportados por
  `biome check` estão todos em código pré-existente **não tocado** por esta
  story (bloco de agregação em `fetchManagerAnalytics`, `manager-dashboard-page.tsx`
  linhas 88/111/114) — confirmado por inspeção linha a linha. Nenhum erro novo
  nas linhas alteradas.
- **Ordem da sidebar:** verificado com script ad-hoc (`tsx`) chamando
  `getEnabledModules` e `buildNavigation` diretamente — "Biblioteca" precede
  "Analytics" na saída.
- **Call-sites de `getEnabledModules`:** `grep -rn "getEnabledModules"` →
  `buildNavigation`, `isRouteAllowed`, `isApiRouteAllowed` (registry.ts) e
  `module-provider.tsx`; nenhum depende da ordem anterior além de
  `buildNavigation`, que é justamente o alvo do fix.
- **FIX 4, typecheck:** `pnpm --filter @eximia/web typecheck` → **PASS** (0
  erros), antes e depois da reaplicação.
- **FIX 4, cobertura de teste:** não existe (nem existia antes) suite cobrindo
  `manager-dashboard-page.tsx` ou `instructor/page.tsx` como um todo (são
  Server Components com data fetching direto via Supabase/`cookies()`,
  exigiriam mock não-trivial de `createClient`/`createServiceClient`/
  `cookies()` para testar de forma útil). O próprio helper `getAreaStudentIds`
  já tem 14 testes passando em `apps/web/src/lib/__tests__/area-context.test.ts`
  (`npx vitest run src/lib/__tests__/area-context.test.ts` → 14/14 verde,
  intocado por esta reaplicação). Não foi adicionado teste novo, por ser
  desproporcional ao escopo cirúrgico do fix, registrado aqui como lacuna
  conhecida em vez de inventado às pressas.
- **FIX 4, suíte completa:** `npx vitest run` (via pnpm) reporta 31 falhas em
  `src/app/api/sessions/[sessionId]/messages/__tests__/route.test.ts`,
  confirmadas **pré-existentes** e não relacionadas: reproduzidas isolando o
  estado da branch com `git stash` antes desta reaplicação, mesmo resultado
  exato. Fora do escopo desta story.
- **FIX 5, typecheck:** `pnpm --filter @eximia/web typecheck` → **PASS** (0
  erros), após adicionar o slot `teamRecortePanel` em `manager-dashboard.tsx`
  e `manager-dashboard-page.tsx` e reestruturar
  `manager-team-dashboard-page.tsx`.
- **FIX 5, vitest:**
  `npx vitest run src/components/dashboard/__tests__/manager-dashboard.test.tsx`
  → mesmo resultado do FIX 1 (1 passa, 1 falha pré-existente por texto
  desatualizado `/Olá, Carlos!/` com exclamação e labels
  "Competencias Ativas"/"ROI de Treinamento" que o componente atual nunca
  renderizou). Confirmado que o teste já falhava antes desta mudança
  (`git log` mostra o arquivo de teste intocado desde o import inicial
  `d65f3a5`, enquanto `manager-dashboard.tsx` evoluiu bastante depois —
  desatualização pré-existente, não regressão). Não há teste dedicado a
  `manager-team-dashboard-page.tsx` (Server Component com data fetching
  direto via Supabase, mesma lacuna conhecida do FIX 4).
- **Nota de segurança (`seed-cory-users.py`):** sem suite de teste aplicável
  (script de seed standalone, não parte do bundle `@eximia/web`); validado
  por leitura direta do diff e por grep de varredura em `supabase/` e
  `scripts/` (ver seção acima).

---

## Notes

- FIX 1 a FIX 3: nenhuma migration, RLS ou lógica de escopo tocada, estritamente
  composição JSX/CSS e ordem de array.
- FIX 4: lógica de escopo de dados reaplicada (não nova, apenas restaurada do
  commit `f6f80ab`), sem tocar RLS, migrations ou o próprio helper
  `getAreaStudentIds` em `area-context.ts`, que permaneceu intacto o tempo
  todo.
- FIX 5: mesma técnica de slot do FIX 1 (`teachingPlanHighlights`), aplicada
  ao contexto "Meu Time". Nenhuma migration, RLS ou lógica de escopo tocada.
- Nota de segurança: script Python de seed, sem relação com RLS, migrations
  ou os fixes visuais desta story; tratada aqui por ser a correção mais
  próxima em tempo/branch, não por dependência técnica com os FIX 1-5.
- Sem commit/push (branch `feat/engajamento-gestor-m1`, mudanças permanecem no
  working tree conforme instrução).

---

## Dev Agent Record

**Agent:** Dex (@dev)
**Date:** 2026-07-02

### File List
- `apps/web/src/app/(platform)/dashboard/_components/manager-dashboard-page.tsx` (modified — FIX 1, FIX 4, FIX 5: nova prop `teamRecortePanel` repassada a `<ManagerDashboard>`)
- `apps/web/src/components/dashboard/manager-dashboard.tsx` (modified — FIX 1, nova prop `teachingPlanHighlights`; FIX 5, nova prop `teamRecortePanel`)
- `apps/web/src/components/dashboard/teaching-plan-highlights.tsx` (modified — FIX 2, reaplica grid de `ed9e178`)
- `packages/shared/src/modules/registry.ts` (modified — FIX 3, ordem de `MODULE_IDS` e `getEnabledModules`)
- `apps/web/src/app/(platform)/instructor/page.tsx` (modified, FIX 4, reaplica `f6f80ab`)
- `apps/web/src/app/(platform)/dashboard/_components/manager-team-dashboard-page.tsx` (modified — FIX 5: seção "Recorte da equipe" passou de JSX-irmão renderizado antes para constante local passada como prop `teamRecortePanel`)
- `supabase/seed-cory-users.py` (modified — nota de segurança: `service_role` key hardcoded substituída por leitura de `SUPABASE_SERVICE_ROLE_KEY` via `os.environ`, com `sys.exit` e mensagem de erro se ausente)
- `docs/stories/fix-dashboard-visual-adjustments.md` (this story, FIX 4 e FIX 5 adicionados, nota de segurança adicionada)
- `docs/stories/feat-team-view-hierarchy-switch.md` (modified — item 8 adicionado à seção Implementação, referenciando o FIX 5 desta story)
