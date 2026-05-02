# Story 2.4: Revisao e Ativacao de Perguntas

**Epic:** [Epic 2 — Course & Content Management](../epics/epic-2-course-content-management.md)
**Version:** 1.1
**Created:** 2026-02-08
**Author:** River (Scrum Master)
**Status:** Draft
**Story Points:** 5
**Priority:** P0 (Blocker)
**Blocked By:** 2.3
**Blocks:** 2.5
**Assigned To:** @dev (Dex)

---

## User Story

**As a** teacher,
**I want** revisar as perguntas geradas antes de ativa-las,
**so that** eu tenha controle sobre a qualidade do conteudo socratico.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture.md` v1.2.2 — Sections 9 (Schema), 10 (RLS/API) |
| **Screens Ref** | `docs/screens.md` — Screen 9 (Question Review) |
| **Design Tokens** | `Benchmarks/Design/design-tokens.json` v1.2.1 |
| **Stack** | Next.js 15 + Supabase + Drizzle ORM + Tailwind CSS 4 + shadcn/ui |
| **DB Tables** | `questions` (status transitions: pending → active/rejected) |
| **Dependencies** | Story 2.3 completed (questions generated and saved in DB) |

---

## Acceptance Criteria

- [ ] **AC1:** Tela de revisao (`/courses/[courseId]/chapters/[chapterId]/questions`) listando perguntas geradas para o capitulo
  - RSC data fetching: query questions for chapter
  - Sorted by creation order

- [ ] **AC2:** Para cada pergunta exibir: texto, skill (badge colorido), intencao pedagogica (accordion), profundidade esperada (accordion)
  - Collapsible sections for intention and expected_depth
  - Skill badge with distinct color

- [ ] **AC3:** Teacher pode aprovar cada pergunta (status → `active`, `approved_by` → current user ID para audit trail)
  - Server Action `approveQuestion(questionId)`
  - Sets both `status = 'active'` AND `approved_by = auth.uid()`

- [ ] **AC4:** Teacher pode editar texto da pergunta inline (status permanece `pending` ate aprovar)
  - Click "Editar" → textarea appears with current text
  - "Salvar" updates text, status stays `pending`
  - "Cancelar" reverts changes

- [ ] **AC5:** Teacher pode rejeitar cada pergunta (status → `rejected`)
  - Server Action `rejectQuestion(questionId)`
  - Visual: card becomes muted/strikethrough

- [ ] **AC6:** Perguntas aprovadas ficam com status `active` e disponiveis para sessoes socraticas
  - Active questions shown with green badge
  - These will be used by Socratic Engine in Epic 3

- [ ] **AC7:** Perguntas rejeitadas ficam com status `rejected` e nao aparecem para alunos
  - Rejected questions shown with red badge, muted styling
  - Hidden from student-facing queries

- [ ] **AC8:** Botao "Gerar novas" regenera ate `max_questions` (3) perguntas: deleta perguntas com status `rejected` e `pending` e gera novas, preserva perguntas `active`. Se todas as 3 sao `active`, botao fica desabilitado com tooltip "Todas as perguntas ja estao ativas"
  - **Atomic operation via API route** (S2.4-H1 resolution): Call Story 2.3 API route `POST /api/chapters/[chapterId]/generate-questions` with `replace: true` query param. The API route handles deletion of old rejected/pending questions server-side (using service role for DELETE, since `questions_delete` RLS is admin-only) and then generates new questions — all in a single atomic request
  - Active questions are preserved (not touched by the API route)
  - Button disabled when all 3 questions are `active`
  - No client-side deletion needed — the API route owns the entire replace flow

- [ ] **AC9:** Resumo no footer: "X/3 perguntas ativas — minimo 1 para publicar capitulo"
  - Dynamic counter: count `active` questions
  - Visual: green when >= 1, yellow when 0

- [ ] **AC10:** Badge de skill colorido: analise (azul), sintese (roxo), aplicacao (verde), reflexao (laranja)
  - Consistent color mapping across the entire platform
  - Reusable `SkillBadge` component

---

## 🤖 CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.
> To enable, set `coderabbit_integration.enabled: true` in core-config.yaml

---

## Tasks / Subtasks

- [x] **Task 1** (AC: 1) Criar pagina `/courses/[courseId]/chapters/[chapterId]/questions/page.tsx`
  - [x] RSC: fetch questions for chapter ordered by created_at
  - [x] Fetch chapter info (title) for heading
  - [x] Breadcrumb: Course > Chapter > Perguntas
  - [x] Heading: "Perguntas Socraticas — {chapter_title}"
  - [x] "Gerar Perguntas" button (from Story 2.3 component)

- [x] **Task 2** (AC: 2, 10) Criar componente `QuestionReviewCard`
  - [x] Props: question data (text, skill, intention, expected_depth, status, etc.)
  - [x] Layout: question text at top, SkillBadge, status badge
  - [x] shadcn `Accordion` for "Intencao Pedagogica" and "Profundidade Esperada"
  - [x] Action buttons: Aprovar (check icon), Editar (pencil), Rejeitar (X)
  - [x] Status-dependent styling: pending (yellow border), active (green), rejected (muted/strikethrough)

- [x] **Task 3** (AC: 10) Criar componente `SkillBadge`
  - [x] Props: `skill: 'analise' | 'sintese' | 'aplicacao' | 'reflexao'`
  - [x] Color mapping:
    - `analise` → blue-500
    - `sintese` → purple-500
    - `aplicacao` → green-500
    - `reflexao` → orange-500
  - [x] Usar shadcn `Badge` with custom className
  - [x] Place in shared location for reuse: `apps/web/src/components/skill-badge.tsx`

- [x] **Task 4** (AC: 3, 5) Implementar Server Actions
  - [x] `approveQuestion(questionId)`: update status='active', approved_by=auth.uid() → revalidatePath
  - [x] `rejectQuestion(questionId)`: update status='rejected' → revalidatePath
  - [x] `updateQuestionText(questionId, newText)`: update text only → revalidatePath
  - [x] Location: `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/questions/actions.ts`
  - [x] Each action: auth check, role check (teacher/admin)

- [x] **Task 5** (AC: 4) Implementar inline edit do texto da pergunta
  - [x] "Editar" button toggles textarea
  - [x] Textarea pre-filled with current text
  - [x] "Salvar" calls `updateQuestionText()`, "Cancelar" reverts
  - [x] Status remains `pending` after text edit
  - [x] Optimistic UI update

- [x] **Task 6** (AC: 9) Implementar resumo footer
  - [x] Count active questions: `questions.filter(q => q.status === 'active').length`
  - [x] Display: "X/3 perguntas ativas — minimo 1 para publicar capitulo"
  - [x] Color: green if X >= 1, yellow if X === 0

- [x] **Task 7** (AC: 8) Conectar botao "Gerar novas" ao API route de geracao (atomic replace)
  - [x] Call Story 2.3 API route `POST /api/chapters/[chapterId]/generate-questions?replace=true`
  - [x] **No client-side deletion** — API route handles delete+generate atomically
  - [x] On success: `router.refresh()` to update question list
  - [x] On error: `toast.error()` with friendly message
  - [x] Disable button when all 3 are active
  - [x] **Cross-story dependency:** Story 2.3 API route already supports `replace` param

- [x] **Task 8** Adicionar link "Ver Perguntas" na pagina do curso
  - [x] In chapter list (Story 2.2 ChapterListItem): already has "Perguntas" action
  - [x] Links to `/courses/[courseId]/chapters/[chapterId]/questions`

- [ ] **Task 9** Testes — DEFERRED (component tests require mocked Supabase server actions)
  - [ ] Component test: QuestionReviewCard renders with all fields
  - [ ] Component test: SkillBadge renders correct colors
  - [ ] Unit test: Server Actions (approve, reject, edit)
  - [ ] Integration test: full flow
  - [ ] Test: counter updates correctly after status changes

---

## Dev Notes

### Database Schema [Source: architecture.md Section 9]

```sql
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  text TEXT NOT NULL,
  skill TEXT NOT NULL CHECK (skill IN ('analise', 'sintese', 'aplicacao', 'reflexao')),
  intention TEXT NOT NULL,
  expected_depth TEXT,
  common_shallow_answer TEXT,
  followup_prompts JSONB DEFAULT '[]',
  citations JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected')),
  approved_by UUID REFERENCES users(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Decision on question replacement (S2.4-H1 + M-4 resolution):** The DB schema only has `('pending', 'active', 'rejected')` — no `'replaced'` status. The "Gerar novas" flow DELETEs old rejected/pending questions server-side via the Story 2.3 API route using service role. This resolves two issues:

1. **S2.4-H1:** `questions_delete` RLS is admin-only — teacher cannot delete via standard client. By handling deletion inside the API route with service role, we bypass the RLS constraint in a controlled server context (same pattern as teacher draft course delete in Story 2.1).
2. **M-4:** No need for `'replaced'` status — questions are simply deleted. No DB migration required.

**Why service role is safe here:** The API route validates auth + role (teacher/admin) + tenant + chapter status BEFORE executing the delete. The service role is only used for the DELETE operation, scoped to `rejected`/`pending` questions of the specific chapter. Active questions are never touched.

### RLS Policies [Source: architecture.md Section 10.3]

```sql
-- Teacher/admin can update questions (approve, reject, edit text)
CREATE POLICY questions_update ON questions FOR UPDATE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() IN ('teacher', 'admin'));

-- IMPORTANT: questions_delete is admin-only
CREATE POLICY questions_delete ON questions FOR DELETE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() IN ('admin'));
```

**S2.4-H1 Resolution:** Since `questions_delete` is admin-only, the "Gerar novas" flow cannot use the standard Supabase client for deletion. Instead, the Story 2.3 API route handles deletion server-side using `createServiceRoleClient()` when `replace=true` is passed. The deletion is scoped:
```sql
-- Executed by API route with service role (NOT by client)
DELETE FROM questions
WHERE chapter_id = $chapterId
  AND tenant_id = $tenantId
  AND status IN ('rejected', 'pending');
-- Active questions are never deleted
```

### API Routes Used [Source: architecture.md Section 10.1]

```
GET    /api/chapters/[chapterId]/questions   → list questions for chapter
PATCH  /api/questions/[questionId]           → update (approve/reject/edit text)
```

For this story, use Server Actions for approve/reject/edit (simple mutations). RSC data fetching for the list.

### Screen Specification [Source: screens.md Screen 9]

| Zona | Componente | Detalhe |
|------|-----------|---------|
| Top | Heading | "Perguntas Socraticas — {capitulo}" |
| Top | Botao "Gerar Perguntas" | Chama Creator Agent (loading 5-15s) |
| Main | Lista de perguntas (1-3) | Para cada: |
| | → Texto da pergunta | Editavel inline |
| | → Badge skill | Colorido: analise, sintese, aplicacao, reflexao |
| | → Intencao pedagogica | Accordion colapsavel |
| | → Profundidade esperada | Accordion colapsavel |
| | → Status | pending (amarelo), active (verde), rejected (vermelho) |
| | → Actions | Aprovar, Editar, Rejeitar |
| Bottom | Summary | "X/3 perguntas ativas — minimo 1 para publicar capitulo" |
| Bottom | "Gerar novas" | Substituir perguntas rejeitadas |

### Skill Badge Color Mapping

```typescript
const SKILL_COLORS = {
  analise: 'bg-blue-500 text-white',
  sintese: 'bg-purple-500 text-white',
  aplicacao: 'bg-green-500 text-white',
  reflexao: 'bg-orange-500 text-white',
} as const
```

### File Locations

```
apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/questions/
├── page.tsx                     # Question review page
└── actions.ts                   # Server Actions (approve, reject, edit)

apps/web/src/components/
├── skill-badge.tsx              # Reusable SkillBadge component
└── question-review-card.tsx     # QuestionReviewCard component
```

### Status Transition Diagram

```
          ┌──── edit text ────┐
          │                   │
    ┌─────▼─────┐      ┌─────▼─────┐
    │  PENDING   │──────│  PENDING   │
    └─────┬─────┘      └───────────┘
          │
    ┌─────┼──────────┐
    │                │
    ▼                ▼
┌───────┐      ┌──────────┐
│ ACTIVE │      │ REJECTED │
└───────┘      └──────────┘
                     │
              "Gerar novas"
                     │
                     ▼
        [DELETE via API route]
        (service role, atomic)
              → generate new pending
```

### Testing

- **Test location:** `apps/web/tests/`
- **Framework:** Vitest + Testing Library
- **Key tests:** Status transitions (pending→active, pending→rejected), inline edit preserves pending status, counter accuracy

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|----------|---------|
| Pre-Commit | Lint + typecheck, skill badges usam cores corretas | Yes |
| Pre-PR | Fluxo completo: gerar → revisar → aprovar/rejeitar/editar → counter atualiza | Yes |

---

## Definition of Done

- [ ] Todos os ACs passam
- [ ] Teacher pode revisar, aprovar, rejeitar e editar perguntas
- [ ] Status transitions corretos (pending → active, pending → rejected)
- [ ] approved_by field populated on approval
- [ ] Counter mostra perguntas ativas vs total
- [ ] "Gerar novas" replaces only rejected/pending, preserves active
- [ ] SkillBadge component reusable across platform
- [ ] PR aprovada

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Implementacao completa (pagina, componentes, actions) |
| **@qa (Quinn)** | Validacao: status transitions, inline edit, skill badges corretos |

---

## Risk Assessment

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| `questions_delete` RLS admin-only blocks teacher "Gerar novas" | HIGH | **RESOLVED (S2.4-H1):** API route handles delete+generate atomically with service role. Scoped to rejected/pending only. |
| Status enum mismatch (replaced not in DB) | LOW | **RESOLVED:** Use DELETE instead of status change — no DB migration needed |
| Inline edit UX complexity | LOW | Simple textarea toggle, no rich text needed |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-08 | 1.0 | Story created from Epic 2 | River (SM) |
| 2026-02-08 | 1.1 | S2.4-H1 resolved: atomic delete+generate via API route (service role). S2.4-M1 resolved: DELETE instead of replaced status. | River (SM) |

---

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References
- ChapterListItem already had "Perguntas" dropdown action from Story 2.2 (Task 8 pre-complete)
- Story 2.3 API route already supports `?replace=true` param (Task 7 cross-dependency resolved)
- Button `size="icon"` confirmed available in @eximia/ui Button component
- Accordion component works with `type="multiple"` for independent sections

### Completion Notes List
- 8/9 tasks completed (Task 9 deferred: component tests require mocked server actions)
- SkillBadge is reusable across platform (placed in `apps/web/src/components/`)
- QuestionReviewCard uses Accordion for intention/depth + inline edit with Textarea
- Footer summary shows active count with color coding (green >= 1, yellow = 0)
- "Gerar novas" button uses `replace=true` via GenerateQuestionsButton component
- All status transitions implemented: pending → active (approve), pending → rejected (reject)
- approved_by field set on approval for audit trail
- Typecheck clean

### File List
- `apps/web/src/components/skill-badge.tsx` — NEW (reusable SkillBadge atom)
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/questions/page.tsx` — NEW (RSC page)
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/questions/actions.ts` — NEW (approve, reject, updateText server actions)
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/questions/_components/question-review-card.tsx` — NEW (QuestionReviewCard organism)
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/questions/_components/questions-review-client.tsx` — NEW (QuestionsReviewClient template)

---

## QA Results

### Review Date: 2026-02-08

### Review Type: Pre-Development Story Proposal Review

### Reviewed By: Quinn (Test Architect)

### Code Quality Assessment

**Overall:** Good story structure with clear status transition diagram and skill badge specifications. However, one **HIGH finding** identified: the "Gerar novas" flow requires deleting questions but `questions_delete` RLS is admin-only. This must be resolved before development.

### Compliance Check

- Architecture Alignment: **CONCERNS** — `questions_delete` RLS gap for teacher delete flow
- Screens Alignment: ✓ — Screen 9 (Question Review) fully mapped with all components
- Epic Findings: ✓ — M-2 (approved_by) resolved in AC3, M-4 (Gerar novas behavior) resolved in AC8
- Story Structure: ✓ — All sections complete

### Findings

**HIGH:**

- **S2.4-H1: `questions_delete` RLS blocks teacher "Gerar novas" flow.** AC8 specifies that "Gerar novas" should delete old `rejected`/`pending` questions before regenerating. Dev Notes recommend "Use DELETE for MVP simplicity." However, `questions_delete` RLS policy (architecture.md) only allows `admin`:
  ```sql
  CREATE POLICY questions_delete ON questions FOR DELETE
    USING (tenant_id = auth_tenant_id() AND auth_user_role() IN ('admin'));
  ```
  **A teacher clicking "Gerar novas" will hit an RLS rejection when trying to DELETE old questions.** This is a blocking issue.

  **Resolution options:**
  1. **API route handles delete + generate atomically** (preferred) — The Story 2.3 API route `POST /api/chapters/[chapterId]/generate-questions` could accept a `replace: true` flag and handle deletion server-side with service role, then insert new questions. This keeps the delete within a controlled server context.
  2. **New RLS policy `questions_delete_by_teacher`** — Allow teacher to delete pending/rejected questions within own tenant. Needs @architect approval.
  3. **Use UPDATE instead of DELETE** — Change status to `replaced` (requires DB migration to add status to CHECK constraint).

  **Suggested Owner:** @architect (Aria) — decision needed before Story 2.4 dev
  - **Refs:** AC8, Dev Notes lines 183-187, architecture.md `questions_delete` policy

**MEDIUM:**

- **S2.4-M1: `replaced` status contradicts DB CHECK constraint.** Epic AC8 says "status → `replaced`" but DB CHECK only allows `('pending', 'active', 'rejected')`. Story Dev Notes correctly recommend DELETE for MVP, but the epic text remains contradictory. **Recommendation:** If @architect chooses option 1 or 2 above (DELETE approach), ensure the epic AC8 text is updated by @pm to say "deletes" instead of "status → replaced" to avoid confusion.
  - **Suggested Owner:** @pm (Morgan) — epic text alignment
  - **Refs:** Dev Notes line 183, DB schema line 175

**LOW:**

- **S2.4-L1: SkillBadge location `apps/web/src/components/skill-badge.tsx` is appropriate for MVP.** Could move to `packages/ui/` later for cross-package reuse in Epic 3. No action needed now.
- **S2.4-L2: Inline edit (Task 5) with optimistic UI is well-specified.** Status remains `pending` after edit — correct per AC4.
- **S2.4-L3: Footer counter (Task 6) uses client-side filter — simple and effective for 1-3 questions.**

### Security Review

- RLS enforcement: **CONCERNS** — H1 above (questions_delete gap)
- Status transitions: ✓ — Only teacher/admin can approve/reject (questions_update policy)
- Audit trail: ✓ — `approved_by` set on approval (M-2 fix)
- Auth guards: ✓ — Server Actions specify auth + role check

### Performance Considerations

- Small data volume (1-3 questions per chapter): ✓ — No performance concerns
- Inline edit is optimistic: ✓ — Good UX

### Gate Status

Gate: **CONCERNS** → `docs/qa/gates/2.4-revisao-perguntas.yml`
Quality Score: **78/100**

### Recommended Status

✗ Changes Required — **S2.4-H1 must be resolved before development.** @architect needs to decide how teacher will delete old questions during "Gerar novas" flow (API route atomic operation, new RLS policy, or UPDATE-based approach). Once resolved, story is ready for development.

— Quinn, guardiao da qualidade 🛡️

---

*Story criada por River (Scrum Master) — eximIA Academy*
