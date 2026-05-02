# Story 3.1: Visualizacao de Capitulo e Inicio de Sessao

**Epic:** [Epic 3 — Socratic Learning Engine](../epics/epic-3-socratic-learning-engine.md)
**Version:** 1.0
**Created:** 2026-02-08
**Author:** River (Scrum Master)
**Status:** Done
**Story Points:** 5
**Priority:** P0 (Blocker)
**Blocked By:** Epic 2 (all stories)
**Blocks:** 3.4, 3.3
**Assigned To:** @dev (Dex)

---

## User Story

**As a** student inscrito num curso,
**I want** ler o conteudo do capitulo e iniciar uma sessao socratica,
**so that** eu possa aprender e aplicar o conhecimento.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture.md` v1.2.3 — Sections 10.3 (DB Schema + RLS), 11 (Project Structure) |
| **Screens Ref** | Student chapter view (extensao do course view — nao e screen separada) |
| **Design Tokens** | `Benchmarks/Design/design-tokens.json` v1.2.1 |
| **Stack** | Next.js 15 (App Router) + Supabase + Drizzle ORM + Tailwind CSS 4 + shadcn/ui |
| **DB Tables** | `sessions`, `chapters`, `questions`, `enrollments`, `tenants` (created in Epic 1, Story 1.2) |
| **Pre-requisite** | Epic 2 completo — cursos, capitulos, perguntas, enrollments |

---

## Acceptance Criteria

- [x] **AC1:** Pagina `/courses/[courseId]/chapters/[chapterId]` exibe conteudo renderizado do capitulo (markdown → HTML) para student inscrito

- [x] **AC2:** Header mostra titulo do capitulo, nome do curso, e breadcrumb de navegacao (`Curso > Capitulo`)

- [x] **AC3:** Botao "Iniciar Sessao Socratica" visivel ao final do conteudo do capitulo (sempre presente, sem gate de scroll/tempo — conforme PRD)

- [x] **AC4:** Ao clicar "Iniciar Sessao", cria registro em `sessions` (status: `active`, `interactions_remaining: N` onde N = `tenants.settings.max_interactions_per_session`, default 3) com pergunta aleatoria ativa do capitulo

- [x] **AC5:** Redirect para `/courses/[courseId]/chapters/[chapterId]/session` apos criacao

- [x] **AC6:** Se ja existe sessao ativa (`status = 'active'`) para esse aluno + capitulo, botao muda para "Continuar Sessao" e redireciona sem criar nova

- [x] **AC7:** Se sessao anterior completada (`status = 'completed'`), botao "Nova Sessao Socratica" permite iniciar nova sessao

- [x] **AC8:** Selecao de pergunta: seleciona aleatoriamente 1 pergunta com `status = 'active'` do capitulo via RPC `get_random_active_question(p_chapter_id)` (PostgREST nao suporta ORDER BY random())

- [x] **AC9:** Se capitulo nao tem perguntas ativas, botao desabilitado com tooltip "Aguardando perguntas do professor"

- [x] **AC10:** Pagina protegida: somente students inscritos no curso podem acessar (enrollment check via RSC data fetching)

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.
> To enable, set `coderabbit_integration.enabled: true` in core-config.yaml

---

## Tasks / Subtasks

- [x] **Task 1** (AC: 1, 2) Criar pagina `/courses/[courseId]/chapters/[chapterId]/page.tsx` — student variant
  - [x] RSC: fetch chapter data (content, title) + course title from Supabase
  - [x] Render markdown content via `react-markdown` + `@tailwindcss/typography` (prose class) — reutilizar do Epic 2 Story 2.2
  - [x] Header com titulo do capitulo, nome do curso, breadcrumb (`Curso > Capitulo`)

- [x] **Task 2** (AC: 10) Implementar enrollment check via RSC
  - [x] Query `enrollments` para verificar student inscrito no curso
  - [x] Se nao inscrito: retornar 403 ou redirect para `/courses`
  - [x] Usar `createClient()` server-side com user autenticado

- [x] **Task 3** (AC: 4, 8) Criar Server Action `createSession()` em `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/actions.ts`
  - [x] Verificar enrollment ativo para student + course
  - [x] Verificar capitulo publicado com perguntas ativas
  - [x] Verificar se nao existe sessao ativa (se existir, retornar sessao existente)
  - [x] Ler `tenants.settings.max_interactions_per_session` (default: 3) para `interactions_remaining`
  - [x] Selecionar pergunta aleatoria via RPC: `supabase.rpc('get_random_active_question', { p_chapter_id: chapterId })`
  - [x] Criar registro em `sessions` com `student_id`, `chapter_id`, `question_id`, `tenant_id`, `interactions_remaining`

- [x] **Task 4** (AC: 6, 7) Implementar deteccao de sessao existente
  - [x] Query `sessions` WHERE `student_id = user.id AND chapter_id AND status = 'active'`
  - [x] Se ativa: botao "Continuar Sessao" → redirect sem criar nova
  - [x] Se completed (mais recente): botao "Nova Sessao Socratica" → cria nova
  - [x] Se nenhuma: botao "Iniciar Sessao Socratica"

- [x] **Task 5** (AC: 5) Implementar redirect apos criacao de sessao
  - [x] `redirect('/courses/[courseId]/chapters/[chapterId]/session')` via Server Action

- [x] **Task 6** (AC: 2) Criar componente de breadcrumb (`Curso > Capitulo`)
  - [x] Usar shadcn `Breadcrumb` component
  - [x] Links: Curso → `/courses/[courseId]`, Capitulo (current)

- [x] **Task 7** Criar navegacao entre capitulos (prev/next)
  - [x] Query capitulos do curso com `order` field
  - [x] Botoes "Capitulo anterior" / "Proximo capitulo"

- [x] **Task 8** (AC: 9) Tratar edge case: capitulo sem perguntas ativas
  - [x] Query count de `questions` WHERE `chapter_id AND status = 'active'`
  - [x] Se 0: botao desabilitado + tooltip "Aguardando perguntas do professor"
  - [x] Usar shadcn `Tooltip` component

- [x] **Task 9** Testes
  - [x] Unit test: `createSession()` Server Action (mock Supabase)
  - [x] Test: session resume (sessao ativa retorna existente)
  - [x] Test: nova sessao apos completada
  - [x] Test: enrollment guard (student nao inscrito → 403)
  - [x] Test: capitulo sem perguntas → botao desabilitado
  - [x] Test: pergunta aleatoria selecionada corretamente

---

## Dev Notes

### Database Schema [Source: architecture.md Section 10.3]

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  student_id UUID NOT NULL REFERENCES users(id),
  chapter_id UUID NOT NULL REFERENCES chapters(id),
  question_id UUID NOT NULL REFERENCES questions(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  interactions_remaining INTEGER NOT NULL DEFAULT 3,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### RLS Policies [Source: architecture.md Section 10.3]

```sql
-- Students can see their own sessions
CREATE POLICY sessions_select ON sessions FOR SELECT
  USING (tenant_id = auth_tenant_id() AND (
    student_id = auth.uid() OR auth_user_role() IN ('teacher', 'admin')
  ));

-- Students can create their own sessions
CREATE POLICY sessions_insert ON sessions FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND student_id = auth.uid());
```

### Tenant Settings — Max Interactions (M-1 Resolution)

```typescript
// Get tenant_id from user profile (set during Epic 1 auth flow)
const { data: profile } = await supabase
  .from('users')
  .select('tenant_id')
  .eq('id', user.id)
  .single()
const tenantId = profile!.tenant_id

// Read max_interactions from tenant settings
const { data: tenant } = await supabase
  .from('tenants')
  .select('settings')
  .eq('id', tenantId)
  .single()

const maxInteractions = tenant?.settings?.max_interactions_per_session ?? 3
```

The `claim_session_turn()` RPC already reads this value dynamically. The session creation must also use this value for `interactions_remaining`.

### Server Action Pattern [Source: Story 1.3, Story 2.1]

```typescript
'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function createSession(chapterId: string, courseId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // 1. Check enrollment
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id')
    .eq('student_id', user.id)
    .eq('course_id', courseId)
    .eq('status', 'active')
    .single()
  if (!enrollment) throw new Error('Not enrolled')

  // 2. Check for existing active session
  const { data: activeSession } = await supabase
    .from('sessions')
    .select('id')
    .eq('student_id', user.id)
    .eq('chapter_id', chapterId)
    .eq('status', 'active')
    .single()
  if (activeSession) {
    redirect(`/courses/${courseId}/chapters/${chapterId}/session`)
  }

  // 3. Get random active question via RPC (PostgREST does not support ORDER BY random())
  const { data: question } = await supabase
    .rpc('get_random_active_question', { p_chapter_id: chapterId })
    .single()
  if (!question) throw new Error('No active questions')

  // 4. Read tenant max_interactions
  // (tenant_id comes from user's JWT via RLS auto-populate)

  // 5. Create session
  const { error } = await supabase
    .from('sessions')
    .insert({
      student_id: user.id,
      chapter_id: chapterId,
      question_id: question.id,
      // tenant_id auto-populated via trigger
      // interactions_remaining from tenant settings
    })
  if (error) throw new Error(error.message)

  redirect(`/courses/${courseId}/chapters/${chapterId}/session`)
}
```

### Content Rendering [Source: Epic 2, Story 2.2]

Reutilizar `react-markdown` + `@tailwindcss/typography` (prose class) ja configurados no Epic 2.

### File Locations [Source: architecture.md Section 11]

```
apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/
├── page.tsx                    # Chapter view (student variant)
├── actions.ts                  # Server Actions (createSession)
├── _components/
│   ├── chapter-content.tsx     # Markdown rendered content
│   ├── session-button.tsx      # Start/Continue/New Session button
│   └── chapter-navigation.tsx  # Prev/Next chapter
└── session/
    └── page.tsx                # Socratic Chat (Story 3.3)
```

### Testing

- **Test location:** `apps/web/tests/` and `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/__tests__/`
- **Framework:** Vitest + Testing Library
- **Pattern:** Unit tests for Server Actions (mock Supabase), component tests for UI

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` passam, enrollment check funciona | Yes |
| Pre-PR | Capitulo renderizado, sessao criada, resume funciona, pergunta selecionada | Yes |

---

## Definition of Done

- [x] Todos os ACs passam
- [x] Student pode ler capitulo e iniciar sessao socratica
- [x] Sessao ativa e retomada, nao duplicada
- [x] Pergunta aleatoria selecionada corretamente
- [x] Student nao inscrito recebe 403/redirect
- [x] PR aprovada

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Implementacao completa (pagina, server action, session creation) |
| **@qa (Quinn)** | Validacao: enrollment check, session resume, pergunta aleatoria, capitulo sem perguntas |

---

## Risk Assessment

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Supabase `ORDER BY random()` nao suportado via PostgREST | **RESOLVED** | Usar RPC `get_random_active_question()` (architecture.md v1.3.1) |
| Tenant settings read race condition (settings change mid-session) | LOW | Session usa valor no momento da criacao — imutavel depois |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-08 | 1.0 | Story created from Epic 3 | River (SM) |
| 2026-02-08 | 1.1 | QA fixes: S3.1-H1 (RPC for random question), S3.1-M1 (remove created_at), S3.1-M2 (tenantId resolution) | Quinn (QA) |

---

## Dev Agent Record

### Agent Model Used
Dex (@dev) — Claude Opus 4.6

### Debug Log References
Session: 2026-02-08

### Completion Notes List
All tasks completed. Chapter view page with markdown rendering, session creation with random question selection via RPC, enrollment check, session resume/new session logic, chapter navigation (prev/next), and edge case handling for chapters without active questions.

### File List
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/page.tsx`
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/actions.ts`
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/_components/chapter-content.tsx`
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/_components/chapter-navigation.tsx`
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/_components/session-button.tsx`

---

## QA Results

### Review Date: 2026-02-08

### Reviewed By: Quinn (Test Architect)

### Review Type: Pre-Development Story Proposal Review

### Code Quality Assessment

**Overall:** Well-structured story with comprehensive Dev Notes, Server Action patterns, and RLS policies. Session resume logic (AC6/AC7) is well-defined. ~~Random question selection mechanism had a blocking runtime issue~~ — **RESOLVED** in v1.1: using `get_random_active_question()` RPC (architecture.md v1.3.1).

### Findings

#### HIGH Severity

**~~S3.1-H1: `ORDER BY random()` not supported via Supabase PostgREST — AC8 will fail at runtime~~ RESOLVED**
- **Resolution:** AC8, Task 3, and Dev Notes code updated to use `supabase.rpc('get_random_active_question', { p_chapter_id: chapterId })`. RPC function added to architecture.md v1.3.1.
- **Fixed by:** Quinn (QA) — story patch + architecture.md patch

#### MEDIUM Severity

**~~S3.1-M1: Dev Notes session schema includes `created_at` — column does not exist in architecture~~ RESOLVED**
- **Resolution:** `created_at` removed from Dev Notes schema. `started_at` serves as session creation timestamp.
- **Fixed by:** Quinn (QA) — story patch

**~~S3.1-M2: `tenantId` variable used without showing how to obtain it~~ RESOLVED**
- **Resolution:** Dev Notes Tenant Settings code updated with tenant_id resolution via `users` table query.
- **Fixed by:** Quinn (QA) — story patch

#### LOW Severity

**S3.1-L1: Risk Assessment already flags `ORDER BY random()` but as MEDIUM instead of HIGH**
- Already captured as S3.1-H1. Risk severity should be upgraded to HIGH (blocking).

### Compliance Check

- Architecture Alignment: ✓ — All findings resolved (v1.1 patch)
- PRD Alignment: ✓ — All 7 PRD ACs covered (stories expand to 10 ACs with more detail)
- Epic Alignment: ✓ — ACs match epic inline story
- Story Structure: ✓ — All sections complete, follows template format

### Security Review

- RLS enforcement: ✓ — `sessions_insert` policy correctly documented
- Enrollment check: ✓ — AC10 requires enrollment verification via RSC
- Tenant isolation: ✓ — `tenant_id` auto-populated via trigger

### Gate Status

Gate: **PASS** → `docs/qa/gates/3.1-visualizacao-capitulo-inicio-sessao.yml`
Quality Score: **95/100** (all HIGH/MEDIUM resolved)

### Recommended Status

✓ Ready for Development — All findings resolved (S3.1-H1 via RPC, S3.1-M1 schema fix, S3.1-M2 tenant resolution).

— Quinn, guardiao da qualidade 🛡️

---

*Story criada por River (Scrum Master) — eximIA Academy*
