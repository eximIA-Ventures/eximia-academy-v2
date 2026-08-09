# Story: Manager não lê conteúdo bruto de aluno + controles de curso restritos a instructor/admin

**Version:** 1.0
**Created:** 2026-07-03
**Author:** Dex (@dev)
**Status:** Ready for Review
**Priority:** P0 (LGPD + permissão)
**Branch:** `feat/engajamento-gestor-m1`
**Type:** Fix (brownfield) — duas correções de permissão/privacidade

---

## User Story

**As a** dono do produto (LGPD/segurança),
**I want** que o chapéu manager nunca leia o conteúdo bruto de um aluno nem
opere os controles de gestão de curso,
**so that** o acesso a dados sensíveis e a mudanças de currículo fiquem
restritos a quem tem o chapéu instructor ou admin, mesmo em usuários
multi-chapéu.

---

## Recon (inventário resumido)

Recon empírico em produção (Management API, tenant Cory
`a9d56b85-ee0e-4295-8db2-5fbcb3fd7a32`) antes de qualquer edição.

### Classe 1 — conteúdo bruto exposto a manager

| Superfície | Camada | Achado |
|---|---|---|
| `messages` (chat texto) | RLS | `messages_select` **não tinha gate de papel algum** — `qual` era só `tenant_id = auth_tenant_id()`. Qualquer usuário autenticado do tenant lia TODAS as mensagens. |
| `slide_reflections` (respostas de slide) | RLS | `sr_team_subtree_select` concedia SELECT bruto a `manager` na subárvore, ao lado de `sr_content_role_select` (que já era instructor/admin, mas via `auth_user_role()` singular — ver Mecanismo). |
| `assignment_submissions` | RLS | `as_content_role_select` incluía `'manager'` no array de papéis. |
| `scenario_attempts` | RLS | `sa_content_role_select` incluía `'manager'` no array de papéis. |
| `analytics/students/[studentId]/page.tsx` | App | `chapterSessions[].sessions[].messages` (texto bruto de chat) e `chapterReflections[].reflections[].response/aiResponse` (texto bruto de reflexão) eram enviados ao cliente para manager/leader. |
| `analytics/students/[studentId]/route.ts` (API) | App | Só retorna dados JÁ agregados (scores, patterns, evolution) — **sem** texto bruto. Nenhuma mudança necessária. |

### Classe 2 — controles de gestão de curso expostos a manager

| Superfície | Camada | Achado |
|---|---|---|
| `courses` INSERT/UPDATE | RLS | Incluíam `'manager'` no array de papéis. |
| `chapters` INSERT/UPDATE | RLS | Idem. |
| `questions` INSERT/UPDATE | RLS | Idem. |
| `courses/[courseId]/page.tsx` + `CourseDetailClient` | App | `effectiveRole === "manager"` habilitava toda a UI de gestão (Enriquecer, Interações, Editar, Exportar, badge de perguntas pendentes). |
| `courses/actions.ts`, `chapters/actions.ts`, `enrich/actions.ts`, `questions/actions.ts`, `slide-actions.ts` | App | `requireContentRole`/`guardManagerAccess` incluíam `"manager"` no array de papéis permitidos (checando `profile.role`, singular). |
| `chapters/new/page.tsx`, `chapters/new/ingest/page.tsx`, `chapters/[chapterId]/edit/page.tsx`, `questions/page.tsx` | App | Mesmo padrão — gate de página incluía manager (ou, no caso do editor de capítulo, **nenhum gate**). |
| `api/courses/[courseId]/enrich/route.ts`, `api/courses/[courseId]/export/route.ts` | App | Idem. |

### Mecanismo — por que `has_role()` e não `auth_user_role()`

Recon provou que a coluna singular legada `users.role` **diverge** do chapéu
real em usuários multi-chapéu: Rinaldo (instructor+manager via `user_roles`)
tem `users.role = 'manager'`. `auth_user_role()` (usado nas policies antigas)
lê a coluna singular. Apertar as policies para
`auth_user_role() = ANY('{instructor,admin}')` teria **trancado o Rinaldo
fora** apesar do chapéu instrutor real dele — provado em produção
(`sr_content_role_select` original devolvia 0 linhas para Rinaldo antes do
fix; ele só enxergava reflections via `sr_team_subtree_select`, a policy de
manager que estava sendo removida).

A correção usa `has_role(auth.uid(), 'instructor')` — helper
`SECURITY DEFINER` já estabelecido em E7 (`20260701030000_epic30_user_roles.sql`)
que lê `user_roles` (a união real de chapéus), já usado por
`ur_admin_manage`. Nenhum mecanismo novo foi introduzido.

### Regra de decisão por chapéu (documentada, aplicada em todas as camadas)

> Permitido se o usuário TEM chapéu `instructor` OU `admin` (OU `super_admin`).
> Negado se ele só alcança o dado pela lente de `manager`.
> Checado sobre a UNIÃO de chapéus — um manager+instructor mantém tudo que o
> instrutor tem; o chapéu manager nunca subtrai acesso.

### Fix plan

1. App: criar `lib/course-management-guard.ts` (`requireCourseManager`,
   `isCourseManagerRole`) — fonte única de verdade para o gate, usada em
   todas as pages/actions/routes de Classe 2.
2. App: `analytics/students/[studentId]/page.tsx` — computar
   `canSeeRawContent` sobre `roles` (união), nunca enviar texto bruto ao
   cliente quando `false`; substituir por `moduleInsights` (agregado por
   capítulo).
3. Banco (produção): migration que remove `manager` das policies de
   Classe 1 e Classe 2, reescrevendo os checks de papel de conteúdo com
   `has_role()`.
4. Testes novos + story.

---

## Acceptance Criteria

1. **AC-1** — Manager puro (sem chapéu instructor/admin) não lê texto bruto
   de mensagem/reflexão de nenhum aluno, nem via app nem via RLS direta.
2. **AC-2** — Manager puro vê, no lugar do texto bruto, indicadores
   agregados por módulo (sessões, reflexões, profundidade média, último
   acesso) — nunca um trecho de resposta do aluno.
3. **AC-3** — Instructor e admin mantêm acesso total ao conteúdo bruto e aos
   controles de curso, incluindo um usuário manager+instructor.
4. **AC-4** — Aluno mantém acesso total às próprias mensagens/reflexões
   (nada muda para a lente "eu vendo meus próprios dados").
5. **AC-5** — Manager puro é negado (server-side, não só UI) em: criar
   curso, editar curso, publicar curso, arquivar curso, excluir curso,
   Enriquecer com IA, aprovar/rejeitar Interações, criar/editar capítulo,
   Exportar. Instructor/admin mantêm tudo funcional.
6. **AC-6** — RLS de produção reforçada nas tabelas de Classe 1
   (`messages`, `slide_reflections`, `assignment_submissions`,
   `scenario_attempts`) e Classe 2 (`courses`, `chapters`, `questions`),
   aplicada via Management API e versionada como migration no repo.
7. **AC-7** — Typecheck limpo, testes novos verdes, build passa, nenhuma
   regressão nos 420 testes pré-existentes que já passavam.

---

## Code Changes (app)

### Novo — gate central de gestão de curso

- **`apps/web/src/lib/course-management-guard.ts`** (novo)
  - `requireCourseManager(supabase, userId)` — resolve os chapéus reais
    (`user_roles`, com fallback defensivo para `users.role` singular só
    quando `user_roles` está vazio, mesmo padrão de `getAuthProfile`),
    retorna `{ ok: true, ctx: { tenantId, hats } } | { ok: false, error }`.
    Discriminante `ok` (não `error`/`ctx` isolados) para o TypeScript
    narrowar a união com segurança.
  - `isCourseManagerRole(roles: string[])` — predicado puro, reusável em
    componentes client-side alimentados por `profile.roles`.

### Correção 2 — gestão de curso (instructor/admin only)

- **`courses/actions.ts`** — `requireContentRole` reescrito sobre
  `requireCourseManager`; `deleteCourse` decide o branch admin/instructor
  por chapéu (`roleCheck.hats.includes(...)`), não mais por
  `roleCheck.role === "manager"`.
- **`courses/[courseId]/chapters/actions.ts`** — idem.
- **`courses/[courseId]/enrich/actions.ts`** — `guardManagerAccess`
  reescrito sobre `requireCourseManager`.
- **`courses/[courseId]/questions/actions.ts`** — `batchApproveQuestions`/
  `batchRejectQuestions` usam `requireCourseManager`.
- **`courses/[courseId]/chapters/[chapterId]/edit/slide-actions.ts`** —
  `requireInstructor` usa `requireCourseManager`.
- **`courses/[courseId]/page.tsx`** — `effectiveRole` agora cai para
  `"student"` quando `!isCourseManagerRole(roles)` (união de chapéus),
  mesmo que `profile.role` singular ainda diga "manager". Um manager puro
  vê a página como aluno (browse-only, sem badge de perguntas pendentes,
  sem controles).
- **`courses/[courseId]/questions/page.tsx`**,
  **`chapters/new/page.tsx`**, **`chapters/new/ingest/page.tsx`**,
  **`chapters/[chapterId]/edit/page.tsx`** (este último não tinha NENHUM
  gate antes) — todos usam `requireCourseManager`.
- **`api/courses/[courseId]/enrich/route.ts`**,
  **`api/courses/[courseId]/export/route.ts`** — idem.

### Correção 1 — LGPD, sem conteúdo bruto para manager

- **`analytics/students/[studentId]/page.tsx`**
  - `canSeeRawContent = roles.includes("instructor") || roles.includes("admin") || roles.includes("super_admin")`.
  - `chapterSessions[].sessions[].messages` só é preenchido quando
    `canSeeRawContent` (senão array vazio).
  - `chapterReflections` só é construído quando `canSeeRawContent` (senão
    `[]`).
  - Novo `moduleInsights`: agregado por capítulo a partir de dados
    JÁ COLETADOS (sessões, `analytics.depth_reached`, contagem de
    reflections) — sessões totais/concluídas, contagem de reflexões,
    profundidade média, último acesso. Nenhum campo de texto.
  - `profileData` carrega `canSeeRawContent` + `moduleInsights` para o
    client component.
- **`analytics/students/[studentId]/_components/student-full-profile.tsx`**
  - Novo card "Desempenho por Módulo" (renderiza `moduleInsights`, linha
    por capítulo com badges numéricos) quando `!canSeeRawContent`.
  - Cards "Interações por Módulo" (mensagens expansíveis) e "Reflexões e
    Respostas por Módulo" (texto de resposta) só renderizam quando
    `canSeeRawContent`.

---

## Code Changes (banco de dados, produção)

**Migration:** `supabase/migrations/20260703003114_fix_manager_privacy_gates.sql`
(aplicada em produção via Management API + versionada no repo).

Padrão em todas as policies reescritas: `DROP POLICY IF EXISTS` seguido de
`CREATE POLICY` com `has_role(auth.uid(), 'instructor') OR has_role(auth.uid(), 'admin')`
no lugar de `auth_user_role() = ANY('{instructor,manager,admin}')`.

| Tabela | Policy removida | Policy nova/reescrita |
|---|---|---|
| `messages` | `messages_select` (sem gate de papel) | `messages_own_session_select` (aluno vê a própria sessão) + `messages_content_role_select` (`has_role` instructor/admin) |
| `slide_reflections` | `sr_team_subtree_select` (manager bruto) | `sr_content_role_select` reescrita com `has_role` (antes usava `auth_user_role()` singular, que travava Rinaldo) |
| `assignment_submissions` | `as_content_role_select` (incluía manager) | `as_content_role_select` reescrita com `has_role` |
| `scenario_attempts` | `sa_content_role_select` (incluía manager) | `sa_content_role_select` reescrita com `has_role` |
| `courses` | `courses_insert`, `courses_update` (incluíam manager) | Reescritas com `has_role`; `courses_update` preserva o fallback `created_by = auth.uid()` |
| `chapters` | `chapters_insert`, `chapters_update` (incluíam manager) | Reescritas com `has_role` |
| `questions` | `questions_insert`, `questions_update` (incluíam manager) | Reescritas com `has_role` |

**Fora de escopo, deliberadamente não tocado:** `sessions_group_select` /
`sessions_team_subtree_select` (expõem só `analytics` jsonb agregado, nunca
texto — são a base legítima dos dashboards de time do gestor);
`courses_delete` (já era admin-only); `courses_select`/`chapters_select`/
`questions_select` (leitura tenant-wide, sem conteúdo de aluno); dezenas de
outras policies com `manager` no array (grupos de gestor, notificações,
lives, blueprints) que são domínio operacional legítimo do gestor, não
conteúdo de aluno nem gestão de currículo — fora do enunciado da missão.

**Fora de escopo no app, deliberadamente não tocado:** `courses/page.tsx` /
`courses-page-client.tsx` (lista "Meus Cursos" + criar/importar) — não
nomeado explicitamente na missão ("cada ação: Enriquecer, Interações,
Editar, Exportar, Adicionar Capítulo" + "a página de gestão de curso" =
`/courses/[courseId]`); tocar a lista arriscaria quebrar a experiência de
"ver meus cursos" do gestor sem instrução explícita para tal.

---

## Provas em produção (transações com ROLLBACK)

Todas as queries abaixo rodaram como `SET LOCAL ROLE authenticated` +
`request.jwt.claims` do usuário-alvo, dentro de `BEGIN; ...; ROLLBACK;`
(nada persistido além da migration em si).

### Antes do fix (baseline do problema)

| Query | Resultado |
|---|---|
| Caio (manager puro) `SELECT count(*) FROM messages` | **960** (100% do tenant) |
| Caio `SELECT count(*) FROM slide_reflections` | **45** (subárvore, via `sr_team_subtree_select`) |
| `users.role` de Caio e Rinaldo | ambos `'manager'` (coluna singular) |
| Rinaldo via `sr_content_role_select` original (`auth_user_role()`) | **0** linhas (travado, apesar do chapéu instructor real) |

### Depois do fix

| Query | Resultado | Interpretação |
|---|---|---|
| Caio `SELECT count(*) FROM messages` | 132 | Só as PRÓPRIAS mensagens dele (chapéu student) |
| Caio `SELECT count(*) FROM messages WHERE student <> caio` | **0** | Zero mensagens de outros alunos (era 960) |
| Caio `SELECT count(*) FROM slide_reflections` | 41 | Só as PRÓPRIAS reflexões dele |
| Caio `SELECT count(*) FROM slide_reflections WHERE student <> caio` | **0** | Zero reflexões de outros alunos (era 45) |
| Caio `UPDATE courses SET updated_at=now() WHERE id=<curso não-dele>` | **0 linhas afetadas** | RLS bloqueia a escrita silenciosamente |
| Caio `UPDATE chapters SET updated_at=now() WHERE id=<capítulo>` | **0 linhas afetadas** | Idem |
| Rinaldo (instructor+manager) `SELECT count(*) FROM messages` | **960** | Mantém alcance total via chapéu instructor |
| Rinaldo `SELECT count(*) FROM slide_reflections` | **184** (tenant inteiro) | Mantém alcance total |
| Rinaldo `UPDATE courses ...` | **1 linha afetada** | Continua conseguindo gerenciar curso |
| Rinaldo `UPDATE chapters ...` | **1 linha afetada** | Idem |
| João Marcos (aluno puro) `SELECT count(*) FROM messages WHERE student=self` | 55 (bate com o total real, service role) | Vê 100% do próprio conteúdo |
| João Marcos `SELECT count(*) FROM messages WHERE student <> self` | **0** | Nunca viu dado de outro aluno (não regrediu) |
| Caio `SELECT count(*) FROM assignment_submissions WHERE student <> caio` | **0** | Mesma classe de conteúdo bruto, mesma proteção |

---

## Testing / Validation

- **Typecheck:** `pnpm --filter @eximia/web typecheck` → **PASS** (0 erros).
- **Testes novos:** `apps/web/src/lib/__tests__/course-management-guard.test.ts`
  (11), `apps/web/src/app/(platform)/courses/__tests__/role-permissions.test.ts`
  (26, reescrito — a versão anterior afirmava "manager grants access", que
  era o bug), `apps/web/src/app/(platform)/analytics/students/__tests__/raw-content-gate.test.ts`
  (12) — **49 testes novos/reescritos, todos verdes**.
- **Vitest nos arquivos tocados + vizinhos:** `role-helpers.test.ts`,
  `analytics-scope.test.ts` — verdes, sem regressão.
- **Suite completa:** `npx vitest run` → **420 passed, 31 failed** — os 31
  falhos estão nos **mesmos 9 arquivos alheios** já falhando antes desta
  story (route.test.ts de mensagens de sessão, login-form-google-oauth,
  analytics-redirect, manager-course-dashboard, manager-dashboard,
  student-dashboard, step-employee-status, context-context, rate-limit).
  Nenhum arquivo tocado por esta story está nessa lista.
- **Build:** `pnpm --filter @eximia/web build` → **PASS**, todas as rotas
  de `/courses` compiladas sem erro.
- **Produção:** migration aplicada via Management API (dry-run em
  transação com ROLLBACK primeiro, depois aplicação real); provas de
  simulação de papel documentadas acima.

---

## Notes

- O escopo desta story é deliberadamente cirúrgico: as tabelas/policies e
  páginas/actions tocadas são exatamente as nomeadas na missão (Classe 1 =
  conteúdo bruto de aluno; Classe 2 = controles de curso). Dezenas de
  outras policies com `manager` no array (grupos de gestor, engagement,
  lives, blueprints, notificações) são domínio operacional legítimo do
  gestor e não foram tocadas.
- `courses/page.tsx` (lista "Meus Cursos" do gestor, com criar/importar)
  não foi tocado — não está no enunciado explícito da missão e é uma
  superfície distinta (browsing/criação em lote) da página de gestão de
  um curso específico.
- `sessions_group_select`/`sessions_team_subtree_select` (RLS de
  `sessions`) não foram tocados: expõem só `analytics` jsonb agregado
  (profundidade, não texto), sustentando os dashboards de time do gestor
  já existentes.

---

## Dev Agent Record

**Agent:** Dex (@dev)
**Date:** 2026-07-03

### File List
- `apps/web/src/lib/course-management-guard.ts` (new)
- `apps/web/src/lib/__tests__/course-management-guard.test.ts` (new)
- `apps/web/src/app/(platform)/courses/actions.ts` (modified)
- `apps/web/src/app/(platform)/courses/[courseId]/page.tsx` (modified)
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/actions.ts` (modified)
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/new/page.tsx` (modified)
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/new/ingest/page.tsx` (modified)
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/edit/page.tsx` (modified)
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/edit/slide-actions.ts` (modified)
- `apps/web/src/app/(platform)/courses/[courseId]/enrich/actions.ts` (modified)
- `apps/web/src/app/(platform)/courses/[courseId]/questions/page.tsx` (modified)
- `apps/web/src/app/(platform)/courses/[courseId]/questions/actions.ts` (modified)
- `apps/web/src/app/api/courses/[courseId]/enrich/route.ts` (modified)
- `apps/web/src/app/api/courses/[courseId]/export/route.ts` (modified)
- `apps/web/src/app/(platform)/analytics/students/[studentId]/page.tsx` (modified)
- `apps/web/src/app/(platform)/analytics/students/[studentId]/_components/student-full-profile.tsx` (modified)
- `apps/web/src/app/(platform)/analytics/students/__tests__/raw-content-gate.test.ts` (new)
- `apps/web/src/app/(platform)/courses/__tests__/role-permissions.test.ts` (rewritten)
- `supabase/migrations/20260703003114_fix_manager_privacy_gates.sql` (new — applied to production)
- `docs/stories/fix-manager-privacy-gates.md` (new — this story)
