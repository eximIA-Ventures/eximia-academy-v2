# Story 2.5: Publicacao de Curso e Inscricao de Alunos

**Epic:** [Epic 2 — Course & Content Management](../epics/epic-2-course-content-management.md)
**Version:** 1.0
**Created:** 2026-02-08
**Author:** River (Scrum Master)
**Status:** Draft
**Story Points:** 5
**Priority:** P1 (High)
**Blocked By:** 2.1, 2.4
**Assigned To:** @dev (Dex)

---

## User Story

**As a** teacher,
**I want** publicar meu curso para que alunos possam se inscrever,
**so that** o conteudo fique disponivel para aprendizagem.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture.md` v1.2.2 — Sections 9 (Schema), 10 (RLS/API), ADR-001 |
| **Screens Ref** | `docs/screens.md` — Screen 5 (Student variant), Screen 6 (Student variant) |
| **Design Tokens** | `Benchmarks/Design/design-tokens.json` v1.2.1 |
| **Stack** | Next.js 15 + Supabase + Drizzle ORM + Tailwind CSS 4 + shadcn/ui |
| **DB Tables** | `courses`, `chapters`, `questions`, `enrollments` |
| **Dependencies** | Story 2.1 (course CRUD), Story 2.4 (questions reviewed/active) |
| **ADR** | [ADR-001: Student Self-Enrollment RLS Policy](../architecture/project-decisions/ADR-001-student-self-enroll-rls.md) |
| **QA Advisory** | M-6: add empty states for student-facing screens |

---

## Acceptance Criteria

- [ ] **AC1:** Botao "Publicar" no curso — valida que pelo menos 1 capitulo esta publicado com pelo menos 1 pergunta ativa
  - Server Action validates: published chapters >= 1, active questions >= 1 per published chapter
  - Updates `courses.status = 'published'`

- [ ] **AC2:** Mensagem de erro clara se validacao falhar ("Publique pelo menos 1 capitulo com perguntas ativas")
  - Toast with specific error message
  - Ideally: list which chapters are missing questions

- [ ] **AC3:** Curso publicado aparece na listagem de cursos disponiveis para alunos do tenant
  - RLS `courses_select` already scopes by tenant
  - Student query: `courses` where `status = 'published'`

- [ ] **AC4:** Aluno ve lista de cursos disponiveis em `/courses` (student variant — grid de cards)
  - Reuses `CourseCard` from Story 2.1
  - Shows published courses only
  - Empty state: "Nenhum curso disponivel no momento. Volte em breve!"

- [ ] **AC5:** Botao "Inscrever-se" cria enrollment (student_id, course_id, tenant_id) com status `active`
  - Server Action `enrollInCourse(courseId)`
  - Uses RLS policy `enrollments_student_self_enroll` (ADR-001)
  - No service role needed — student INSERT is allowed by RLS

- [ ] **AC6:** Cursos inscritos aparecem no dashboard do aluno (card com titulo + progress 0%)
  - Query `enrollments` joined with `courses` for current student
  - Dashboard card: course title, progress bar at 0%, "Continuar" link

- [ ] **AC7:** Progresso comeca em 0%
  - `enrollments.progress` default is 0
  - Progress calculation done in Epic 3 (session completion)

- [ ] **AC8:** Aluno nao pode se inscrever no mesmo curso 2x (unique constraint + UI feedback)
  - DB: `UNIQUE(student_id, course_id)` constraint
  - On duplicate: catch error, show toast "Voce ja esta inscrito neste curso"
  - UI: hide "Inscrever-se" button if already enrolled

- [ ] **AC9:** Botao muda para "Continuar" se aluno ja esta inscrito, e "Concluido" se enrollment completed
  - Check enrollment status per course for current student
  - `null` → "Inscrever-se" (primary button)
  - `active` → "Continuar" (secondary button, links to course overview)
  - `completed` → "Concluido" (disabled/muted button with check icon)

- [ ] **AC10:** Curso publicado exibe contagem de capitulos e modo badge na grid student
  - Chapter count: query `chapters` where `course_id = X AND status = 'published'`
  - Mode badge: university/corporate/both

---

## 🤖 CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.
> To enable, set `coderabbit_integration.enabled: true` in core-config.yaml

---

## Tasks / Subtasks

- [x] **Task 1** (AC: 1, 2) Implementar Server Action `publishCourse(courseId)`
  - [x] Auth + role guard (teacher/admin)
  - [x] Validate: at least 1 chapter with `status = 'published'`
  - [x] Validate: each published chapter has at least 1 question with `status = 'active'`
  - [x] If validation fails: return error with specific message listing failing chapters
  - [x] If passes: update `courses.status = 'published'` → revalidatePath
  - [x] Location: `apps/web/src/app/(platform)/courses/actions.ts` (extended from Story 2.1)

- [x] **Task 2** (AC: 2) Criar mensagens de erro especificas
  - [x] "Publique pelo menos 1 capitulo antes de publicar o curso"
  - [x] "Os seguintes capitulos nao tem perguntas ativas: {chapter_names}"
  - [x] Display via toast (custom useToast from @eximia/ui)

- [x] **Task 3** (AC: 5) Implementar Server Action `enrollInCourse(courseId)`
  - [x] Auth guard
  - [x] Insert into `enrollments`: student_id=auth.uid(), course_id
  - [x] RLS policy `enrollments_student_self_enroll` handles authorization (ADR-001)
  - [x] Catch unique constraint violation → friendly error
  - [x] revalidatePath('/courses') + revalidatePath('/dashboard')
  - [x] Location: `apps/web/src/app/(platform)/courses/actions.ts`

- [x] **Task 4** (AC: 3, 4, 9, 10) Atualizar pagina `/courses` — student variant
  - [x] Fetch published courses with chapter count (already in Story 2.1)
  - [x] Fetch student enrollments for current user (already in Story 2.1)
  - [x] For each course: determine enrollment status (null/active/completed)
  - [x] Render `CourseCard` with appropriate button variant
  - [x] Add search/filter functionality (client-side for MVP)
  - [x] Empty state for no courses (M-6)

- [x] **Task 5** (AC: 4, 9) Atualizar componente `CourseCard`
  - [x] `enrollmentStatus` prop already existed from Story 2.1
  - [x] Conditional button rendering:
    - `null` → "Inscrever-se" (primary, calls enrollInCourse)
    - `active` → "Continuar" (secondary, links to /courses/[courseId])
    - `completed` → "Concluido" (muted, disabled)
  - [x] Chapter count and mode badge already present

- [ ] **Task 6** Criar pagina `/courses/[courseId]` — student variant — DEFERRED to Epic 3
  - Per S2.5-M1: chapter completion status not trackable until Epic 3 session data
  - Student can already access /courses/[courseId] (page exists, shows course detail)
  - Full student variant (progress, locked/available/completed chapters) requires session data

- [x] **Task 7** (AC: 6, 7) Atualizar dashboard do aluno
  - [x] Replace placeholder with real data: query `enrollments` JOIN `courses`
  - [x] Card for each enrolled course: title, progress bar (0%), "Continuar" link
  - [x] Empty state: "Voce ainda nao esta inscrito em nenhum curso. [Explorar cursos]"

- [x] **Task 8** (AC: 8) Tratar unique constraint violation
  - [x] In `enrollInCourse()`: catch PostgreSQL error code 23505
  - [x] Return friendly message: "Voce ja esta inscrito neste curso"
  - [x] UI-side: enrollment status check hides "Inscrever-se" if already enrolled

- [x] **Task 9** Implementar "Publicar" button no teacher course view
  - [x] Add to CourseDetailClient
  - [x] Only visible when `course.status === 'draft'`
  - [x] Calls `publishCourse()` Server Action
  - [x] On success: toast + router.refresh() updates status badge
  - [x] On failure: toast with specific validation error

- [ ] **Task 10** Testes — DEFERRED (requires mocked Supabase)
  - [ ] Unit test: publishCourse validation logic
  - [ ] Unit test: enrollInCourse (success, duplicate)
  - [ ] Component test: CourseCard button variants
  - [ ] Integration test: publish → enroll → dashboard

---

## Dev Notes

### Database Schemas [Source: architecture.md Section 9]

**Courses (status update for publish):**
```sql
-- Status check constraint: ('draft', 'published', 'archived')
-- Update status to 'published' via Server Action
UPDATE courses SET status = 'published', updated_at = NOW() WHERE id = $1;
```

**Enrollments:**
```sql
CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id),
  course_id UUID NOT NULL REFERENCES courses(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'dropped')),
  progress NUMERIC(5,2) DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, course_id)
);
```

### RLS Policies [Source: architecture.md Section 10.3 + ADR-001]

**Enrollment SELECT:**
```sql
CREATE POLICY enrollments_select ON enrollments FOR SELECT
  USING (tenant_id = auth_tenant_id() AND (
    student_id = auth.uid()
    OR auth_user_role() IN ('teacher', 'admin', 'manager')
  ));
```

**Student Self-Enrollment (ADR-001):**
```sql
-- Student can only enroll THEMSELVES in PUBLISHED courses within own TENANT
CREATE POLICY enrollments_student_self_enroll ON enrollments FOR INSERT
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND student_id = auth.uid()
    AND auth_user_role() = 'student'
    AND course_id IN (
      SELECT id FROM courses
      WHERE tenant_id = auth_tenant_id()
      AND status = 'published'
    )
  );
```

**Key guards (4 total):**
1. `tenant_id = auth_tenant_id()` — multi-tenant isolation
2. `student_id = auth.uid()` — student can only enroll themselves
3. `auth_user_role() = 'student'` — role-scoped (teachers/admins use existing policy)
4. `course_id IN (published courses)` — defense-in-depth

**This means:** The Server Action `enrollInCourse()` can use the standard Supabase client (no service role needed). The RLS policy handles all authorization. If the student tries to enroll in an unpublished course, the INSERT will be rejected by RLS.

### API Routes [Source: architecture.md Section 10.1]

```
POST   /api/courses/[courseId]/publish   → publish course (teacher)
POST   /api/courses/[courseId]/enroll    → enroll student
GET    /api/enrollments                  → student's enrollments with progress
```

Use Server Actions for this story (simpler than API routes for these mutations).

### Screen Specifications [Source: screens.md Screens 5, 6]

**Screen 5 — Student Variant:**
| Zona | Componente | Detalhe |
|------|-----------|---------|
| Top | Heading + busca | "Cursos Disponiveis" + search bar |
| Main | Grid de cursos | Card: thumbnail, titulo, descricao (truncada), modo badge, no. capitulos |
| Card action | Botao | "Inscrever-se" / "Continuar" (se inscrito) / "Concluido" |

**Screen 6 — Student Variant:**
| Zona | Componente | Detalhe |
|------|-----------|---------|
| Header | Titulo + descricao | Curso info |
| Header | Progress bar | X% concluido, X/Y capitulos |
| Main | Lista de capitulos | Cards: titulo, objetivo, status |

### Publish Validation Logic

```typescript
async function publishCourse(courseId: string) {
  // 1. Get published chapters for this course
  const chapters = await supabase
    .from('chapters')
    .select('id, title, status')
    .eq('course_id', courseId)
    .eq('status', 'published')

  if (!chapters.data?.length) {
    return { error: 'Publique pelo menos 1 capitulo antes de publicar o curso' }
  }

  // 2. For each published chapter, check for active questions
  const chaptersWithoutQuestions: string[] = []
  for (const chapter of chapters.data) {
    const { count } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('chapter_id', chapter.id)
      .eq('status', 'active')

    if (!count || count === 0) {
      chaptersWithoutQuestions.push(chapter.title)
    }
  }

  if (chaptersWithoutQuestions.length > 0) {
    return {
      error: `Os seguintes capitulos nao tem perguntas ativas: ${chaptersWithoutQuestions.join(', ')}`
    }
  }

  // 3. Publish
  await supabase
    .from('courses')
    .update({ status: 'published', updated_at: new Date().toISOString() })
    .eq('id', courseId)

  revalidatePath('/courses')
}
```

### File Locations

```
apps/web/src/app/(platform)/courses/
├── actions.ts                       # Extended: publishCourse(), enrollInCourse()
├── _components/
│   └── course-card.tsx              # Updated: enrollment-aware button
└── [courseId]/
    └── page.tsx                     # Updated: student variant + publish button

apps/web/src/app/(platform)/dashboard/
└── page.tsx                         # Updated: real enrollment data (replaces placeholder)
```

### Dashboard Integration

Story 1.4 created a dashboard placeholder for students. This story connects real data:

```typescript
// Dashboard student section
const { data: enrollments } = await supabase
  .from('enrollments')
  .select('*, courses(*)')
  .eq('student_id', user.id)
  .eq('status', 'active')

// Render enrolled course cards with progress bar
```

### Empty States (M-6)

- **Student course grid (no courses):** "Nenhum curso disponivel no momento. Volte em breve!"
- **Student dashboard (no enrollments):** "Voce ainda nao esta inscrito em nenhum curso. [Explorar cursos]" (link to /courses)
- **Student course overview (no chapters):** "Este curso ainda nao tem capitulos disponiveis."

### Testing

- **Test location:** `apps/web/tests/`
- **Framework:** Vitest + Testing Library
- **Key tests:** Publish validation (valid/invalid), enrollment (success/duplicate), button variants (inscrito/nao inscrito/concluido), dashboard data

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|----------|---------|
| Pre-Commit | Lint + typecheck, RLS policy revisada | Yes |
| Pre-PR | Publish validation end-to-end, enrollment funcional, dashboard mostra cursos inscritos | Yes |
| Security | Student nao consegue se inscrever em curso de outro tenant, RLS audit | Yes |

---

## Definition of Done

- [ ] Todos os ACs passam
- [ ] Teacher pode publicar curso (com validacao de capitulos + perguntas)
- [ ] Aluno pode se inscrever em cursos publicados
- [ ] Dashboard do aluno mostra cursos inscritos com progress 0%
- [ ] Unique constraint impede inscricao duplicada
- [ ] Button variants corretos (Inscrever-se/Continuar/Concluido)
- [ ] Empty states implementados para telas student
- [ ] RLS revisada e aprovada (ADR-001 compliant)
- [ ] PR aprovada

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Implementacao de publicacao, enrollment, student views |
| **@architect (Aria)** | Review da RLS policy para student self-enroll |
| **@qa (Quinn)** | Validacao: publish validation, enrollment, unique constraint, progress tracking |

---

## Risk Assessment

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| RLS blocks student enrollment | HIGH | ADR-001 policy already in architecture.md v1.2.2 — use standard client |
| Cross-tenant enrollment attempt | HIGH | RLS 4-guard policy prevents this; integration test required |
| Duplicate enrollment UX | LOW | Catch unique violation, show friendly toast |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-08 | 1.0 | Story created from Epic 2 | River (SM) |

---

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References
- Supabase JOIN returns array type for `courses()` — fixed with `as unknown as` cast in dashboard
- CourseCard and CourseGrid already had enrollment-aware props from Story 2.1 (just needed wiring)
- Task 6 (student course variant) deferred per S2.5-M1 advisory — needs Epic 3 session data
- Used custom `useToast` from @eximia/ui (NOT Sonner, correcting Task 2 spec)

### Completion Notes List
- 8/10 tasks completed (Task 6 deferred to Epic 3, Task 10 deferred for testing)
- publishCourse validates: published chapters + active questions per chapter
- enrollInCourse uses RLS (ADR-001) — no service role needed
- Unique constraint violation caught with PostgreSQL error code 23505
- Dashboard now shows enrolled courses with ProgressBar for students
- Empty states implemented for both student grid and dashboard
- Typecheck clean, all 35 tests pass

### File List
- `apps/web/src/app/(platform)/courses/actions.ts` — MODIFIED (added publishCourse, enrollInCourse)
- `apps/web/src/app/(platform)/courses/_components/courses-page-client.tsx` — MODIFIED (wired enrollInCourse)
- `apps/web/src/app/(platform)/courses/[courseId]/_components/course-detail-client.tsx` — MODIFIED (working Publish button)
- `apps/web/src/app/(platform)/dashboard/page.tsx` — MODIFIED (student enrolled courses section)

---

## QA Results

### Review Date: 2026-02-08

### Review Type: Pre-Development Story Proposal Review

### Reviewed By: Quinn (Test Architect)

### Code Quality Assessment

**Overall:** Well-structured story with strong security design. ADR-001 compliance is excellent — the standard Supabase client approach (no service role) is the correct pattern. Publish validation logic is complete with code snippet. Dashboard integration and empty states are properly specified.

### Compliance Check

- Architecture Alignment: ✓ — Enrollments schema, RLS policies (including ADR-001), and API routes all verified
- ADR-001 Compliance: ✓ — All 4 security guards documented, service role explicitly NOT used
- Screens Alignment: CONCERNS — Task 6 references chapter completion status not available until Epic 3
- Epic Findings: ✓ — M-6 (empty states) fully addressed with 3 specific messages
- Story Structure: ✓ — All sections complete

### Findings

**MEDIUM:**

- **S2.5-M1: Task 6 references chapter status (locked/available/completed) not trackable in Epic 2.** Student course overview (`/courses/[courseId]`) shows chapter status including "completed" and progress bar. However, per AC7: "Progress calculation done in Epic 3 (session completion)." Without session data, there's no way to know which chapters a student has completed. **Recommendation:** For Epic 2, render all published chapters as "available" (not locked/completed). Show progress bar at 0% with text "Progresso sera atualizado conforme sessoes socraticas." Lock/completed status will be added in Epic 3.
  - **Suggested Owner:** @dev (Dex)
  - **Refs:** Task 6, AC7

- **S2.5-M2: Publish validation iterates N+1 queries.** The code snippet (lines 260-299) fetches published chapters, then loops through each to count active questions (N+1 pattern). For MVP with few chapters this is fine, but @dev could optimize with a single query using LEFT JOIN + GROUP BY if needed.
  - **Suggested Owner:** @dev (Dex) — advisory optimization
  - **Refs:** Dev Notes lines 260-299

**LOW:**

- **S2.5-L1: Dashboard integration (Task 7) replaces Story 1.4 placeholder.** Task description is adequate — @dev should check what Story 1.4 implemented and replace the static placeholder with real enrollment data.
- **S2.5-L2: Empty states (M-6) fully specified.** Three messages with appropriate context and CTAs. Good.
- **S2.5-L3: Button variant logic (AC9) is clear.** Three states (null/active/completed) with appropriate UI for each.

### Security Review

- ADR-001 compliance: ✓ — Student self-enrollment uses standard client, 4 RLS guards enforce security
- Tenant isolation: ✓ — `tenant_id = auth_tenant_id()` in enrollment policy
- Self-enrollment only: ✓ — `student_id = auth.uid()` prevents enrolling others
- Published course guard: ✓ — `course_id IN (published courses)` — defense-in-depth
- Unique constraint: ✓ — `UNIQUE(student_id, course_id)` prevents duplicates
- Cross-tenant: ✓ — RLS prevents enrollment in courses from other tenants

### Performance Considerations

- Publish validation N+1: ADVISORY — Optimize with JOIN if chapter count grows (see S2.5-M2)
- Dashboard query: ✓ — `enrollments` JOIN `courses` is standard and performant
- Student course grid: ✓ — Published courses scoped by tenant (RLS handles filtering)

### Gate Status

Gate: **PASS** → `docs/qa/gates/2.5-publicacao-inscricao.yml`
Quality Score: **85/100**

### Recommended Status

✓ Ready for Development — 2 MEDIUM findings are non-blocking (Epic 3 dependency awareness + performance advisory)

— Quinn, guardiao da qualidade 🛡️

---

*Story criada por River (Scrum Master) — eximIA Academy*
