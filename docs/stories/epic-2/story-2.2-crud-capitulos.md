# Story 2.2: CRUD de Capitulos

**Epic:** [Epic 2 — Course & Content Management](../epics/epic-2-course-content-management.md)
**Version:** 1.0
**Created:** 2026-02-08
**Author:** River (Scrum Master)
**Status:** Draft
**Story Points:** 8
**Priority:** P0 (Blocker)
**Blocked By:** 2.1
**Blocks:** 2.3
**Assigned To:** @dev (Dex)

---

## User Story

**As a** teacher,
**I want** criar capitulos dentro de um curso,
**so that** eu possa estruturar o conteudo de aprendizagem.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture.md` v1.2.2 — Sections 9 (Schema), 10 (RLS), 10.1 (API), 11 (Structure) |
| **Screens Ref** | `docs/screens.md` — Screen 6 (Course Overview/Editor), Screen 8 (Chapter Editor) |
| **Design Tokens** | `Benchmarks/Design/design-tokens.json` v1.2.1 |
| **Stack** | Next.js 15 + Supabase + Drizzle ORM + Tailwind CSS 4 + shadcn/ui |
| **DB Tables** | `chapters` (created in Epic 1, Story 1.2) |
| **Dependencies** | Story 2.1 completed (course CRUD, `/courses/[courseId]` page exists) |
| **QA Advisory** | M-5: validate `@dnd-kit/core` bundle size against NFR7 (150KB); M-7: no pagination for MVP |

---

## Acceptance Criteria

- [ ] **AC1:** Pagina de capitulos dentro de um curso (`/courses/[courseId]` — teacher variant) listando capitulos com drag-and-drop reorder
  - List sorted by `order` column
  - Each item shows: title, status badge (draft/published), action buttons

- [ ] **AC2:** Formulario de criacao: titulo, conteudo (rich text editor), objetivo de aprendizagem
  - Rich text: MVP approach — markdown textarea with preview toggle
  - Objective: single-line text input

- [ ] **AC3:** Reordenacao de capitulos via drag-and-drop (atualiza campo `order`)
  - Use `@dnd-kit/core` + `@dnd-kit/sortable`
  - On drop: batch update `order` column for all affected chapters
  - Optimistic UI update

- [ ] **AC4:** Edicao de capitulo via pagina dedicada (`/courses/[courseId]/chapters/[chapterId]/edit`)
  - Full-page editor (not inline) for best UX
  - Pre-populated form with existing chapter data

- [ ] **AC5:** Exclusao de capitulos (com confirmacao)
  - shadcn `AlertDialog` with confirmation
  - Server Action `deleteChapter()`
  - CASCADE delete on questions (DB constraint handles this)

- [ ] **AC6:** Status por capitulo (draft/published) — toggle independente do curso
  - shadcn `Switch` or button toggle
  - Server Action `toggleChapterStatus()`

- [ ] **AC7:** Validacao: titulo obrigatorio, conteudo minimo 100 caracteres (Zod)
  - Zod schema em `packages/shared/src/validators/chapters.ts`
  - Validation on both client and server

- [ ] **AC8:** Preview do conteudo renderizado (markdown → HTML)
  - Toggle between "Editar" and "Preview" modes
  - Render with `react-markdown` + `@tailwindcss/typography` (prose class)

- [ ] **AC9:** Botao "Adicionar Capitulo" na pagina do curso
  - Navigates to `/courses/[courseId]/chapters/new/edit` or opens dialog
  - Auto-assigns next `order` value

- [ ] **AC10:** Word/char counter no editor indicando minimo de 100 caracteres
  - Visual feedback: vermelho < 100, verde >= 100
  - Real-time counter below textarea

---

## 🤖 CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.
> To enable, set `coderabbit_integration.enabled: true` in core-config.yaml

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 7) Criar Zod schemas em `packages/shared/src/validators/chapters.ts`
  - [ ] `createChapterSchema`: title (required), content (minLength: 100), learning_objective (optional)
  - [ ] `updateChapterSchema`: partial of create + id (uuid)
  - [ ] `reorderChaptersSchema`: array of `{ id: uuid, order: number }`
  - [ ] Export types: `CreateChapterInput`, `UpdateChapterInput`, `ReorderChaptersInput`

- [ ] **Task 2** (AC: 7) Criar Server Actions em `apps/web/src/app/(platform)/courses/[courseId]/chapters/actions.ts`
  - [ ] `createChapter(courseId, formData)`: validate → get next order → insert → revalidatePath
  - [ ] `updateChapter(chapterId, formData)`: validate → update → revalidatePath
  - [ ] `deleteChapter(chapterId)`: delete (CASCADE deletes questions) → revalidatePath
  - [ ] `reorderChapters(chapters)`: batch update `order` for each chapter → revalidatePath
  - [ ] `toggleChapterStatus(chapterId)`: toggle draft/published → revalidatePath

- [ ] **Task 3** (AC: 3) Instalar e configurar `@dnd-kit/core` + `@dnd-kit/sortable`
  - [ ] `pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities -F web`
  - [ ] Verify bundle size impact (M-5 advisory: NFR7 < 150KB gzipped)

- [ ] **Task 4** (AC: 1, 3, 9) Atualizar pagina `/courses/[courseId]/page.tsx` — teacher variant
  - [ ] Fetch chapters ordered by `order` column
  - [ ] Render `ChapterList` with drag-and-drop via `@dnd-kit/sortable`
  - [ ] "Adicionar Capitulo" button at top
  - [ ] Each chapter shows: title, status badge, action buttons

- [ ] **Task 5** (AC: 1) Criar componente `ChapterListItem`
  - [ ] Drag handle (grip icon)
  - [ ] Title text
  - [ ] Status badge: draft (amarelo), published (verde)
  - [ ] Action buttons: Editar, Ver Perguntas (link, placeholder), Publicar/Despublicar, Excluir

- [ ] **Task 6** (AC: 3) Implementar drag-and-drop reorder
  - [ ] `DndContext` + `SortableContext` wrapper
  - [ ] `useSortable` hook on each `ChapterListItem`
  - [ ] `onDragEnd`: compute new order values → call `reorderChapters()` Server Action
  - [ ] Optimistic UI: reorder locally before server confirmation
  - [ ] Debounce: don't call server on every micro-drag

- [ ] **Task 7** (AC: 2, 4, 8, 10) Criar pagina `/courses/[courseId]/chapters/[chapterId]/edit/page.tsx`
  - [ ] Form fields: titulo (Input), objetivo (Input), conteudo (Textarea)
  - [ ] Markdown textarea with monospace font
  - [ ] Toggle: "Editar" / "Preview" mode
  - [ ] Preview: render markdown with `react-markdown` + prose classes
  - [ ] Char counter below textarea (red < 100, green >= 100)
  - [ ] "Salvar" button → calls `updateChapter()` Server Action
  - [ ] "Cancelar" → navigates back to course page

- [ ] **Task 8** (AC: 2, 9) Criar pagina/dialog para novo capitulo
  - [ ] Same form as edit, but empty
  - [ ] On save: `createChapter()` → redirect to course page
  - [ ] Auto-assign `order = max(existing) + 1`

- [ ] **Task 9** (AC: 8) Instalar `react-markdown` para preview
  - [ ] `pnpm add react-markdown -F web`
  - [ ] Configure with `@tailwindcss/typography` prose classes for styling

- [ ] **Task 10** (AC: 6) Implementar publish/unpublish toggle
  - [ ] Switch or button per chapter
  - [ ] Calls `toggleChapterStatus()` Server Action
  - [ ] Toast notification on success

- [ ] **Task 11** (AC: 5) Criar dialog de confirmacao de exclusao
  - [ ] shadcn `AlertDialog`
  - [ ] Warning: "Excluir capitulo tambem remove todas as perguntas associadas"
  - [ ] Calls `deleteChapter()` Server Action

- [ ] **Task 12** Testes
  - [ ] Unit test: Zod schemas (valid/invalid, char count boundary)
  - [ ] Unit test: Server Actions (mock Supabase)
  - [ ] Component test: ChapterListItem renders correctly
  - [ ] Component test: Editor char counter updates
  - [ ] Integration test: drag-and-drop reorder persists after refresh

---

## Dev Notes

### Database Schema [Source: architecture.md Section 9]

```sql
CREATE TABLE chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  learning_objective TEXT,
  "order" INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Note:** `tenant_id` is auto-populated via trigger `set_chapter_tenant_id()` — copies from parent course. Dev does NOT need to set it manually on insert.

### RLS Policies [Source: architecture.md Section 10.3]

```sql
CREATE POLICY chapters_select ON chapters FOR SELECT
  USING (tenant_id = auth_tenant_id());

CREATE POLICY chapters_insert ON chapters FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_user_role() IN ('teacher', 'admin'));

CREATE POLICY chapters_update ON chapters FOR UPDATE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() IN ('teacher', 'admin'));

CREATE POLICY chapters_delete ON chapters FOR DELETE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() IN ('admin'));
```

**Important:** `chapters_delete` is admin-only at RLS level. For teacher delete, follow same pattern as Story 2.1 M-1 resolution — Server Action with status verification + service role, or coordinate with @architect for a teacher delete policy.

### API Routes [Source: architecture.md Section 10.1]

```
POST   /api/courses/[courseId]/chapters     → create chapter
GET    /api/chapters/[chapterId]            → get chapter
PATCH  /api/chapters/[chapterId]            → update chapter
DELETE /api/chapters/[chapterId]            → delete chapter
```

Use Server Actions instead of API routes for this story (simpler for CRUD mutations).

### Screen Specifications [Source: screens.md Screens 6, 8]

**Screen 6 — Course Overview/Editor (Teacher variant):**
- Chapter list with drag-and-drop reorder
- "Adicionar Capitulo" button
- Each chapter: Editar, Gerar Perguntas, Ver Perguntas, Publicar, Excluir

**Screen 8 — Chapter Editor (`/courses/[courseId]/chapters/[chapterId]/edit`):**
| Zona | Componente | Detalhe |
|------|-----------|---------|
| Top | Titulo input | Text field |
| Top | Objetivo input | Text field |
| Main | Rich text editor | Markdown/WYSIWYG (TipTap ou similar) |
| Bottom | Actions | "Salvar rascunho", "Publicar", "Preview", "Cancelar" |
| Bottom | Word count | Minimo 100 caracteres indicator |

### File Locations [Source: architecture.md Section 11]

```
apps/web/src/app/(platform)/courses/[courseId]/
├── page.tsx                        # Course detail (updated in this story)
├── _components/
│   ├── chapter-list.tsx            # Sortable chapter list
│   └── chapter-list-item.tsx       # Individual draggable item
└── chapters/
    ├── [chapterId]/
    │   └── edit/
    │       └── page.tsx            # Chapter Editor
    └── new/
        └── edit/
            └── page.tsx            # New chapter (same form)

apps/web/src/app/(platform)/courses/[courseId]/chapters/
└── actions.ts                      # Server Actions

packages/shared/src/validators/
└── chapters.ts                     # Zod schemas
```

### Rich Text Editor Decision

**MVP approach:** Markdown `<textarea>` with preview toggle using `react-markdown`.

**NOT using TipTap for MVP** — it adds significant complexity and bundle size. Can be introduced post-MVP as enhancement. The markdown textarea approach satisfies all ACs (content input, preview, char counter).

### Drag-and-Drop Pattern

```typescript
// Reorder pattern with @dnd-kit
import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'

function onDragEnd(event: DragEndEvent) {
  const { active, over } = event
  if (active.id !== over?.id) {
    // Compute new order values
    // Call reorderChapters() Server Action
  }
}
```

### Pagination Decision (M-7)

MVP without pagination — expect < 30 chapters per course. Post-MVP: cursor-based "load more".

### Testing

- **Test location:** `apps/web/tests/` and `packages/shared/tests/`
- **Framework:** Vitest + Testing Library
- **Drag-and-drop tests:** Test that reorder persists after page reload (integration test)

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|----------|---------|
| Pre-Commit | Lint + typecheck, Zod schemas, editor renders sem erros | Yes |
| Pre-PR | CRUD completo, reorder persiste apos refresh, preview funciona, minimo 100 chars enforced | Yes |

---

## Definition of Done

- [ ] Todos os ACs passam
- [ ] Teacher pode criar, editar, reordenar e excluir capitulos
- [ ] Markdown editor funcional com preview
- [ ] Reorder persiste apos page reload
- [ ] Content validation (minimo 100 chars) funciona
- [ ] Char counter shows visual feedback
- [ ] PR aprovada

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Implementacao completa (editor, CRUD, drag-and-drop) |
| **@ux-design-expert** | Review da UX do editor de capitulos |
| **@qa (Quinn)** | Validacao: reorder persistence, content validation, status toggle |

---

## Risk Assessment

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| @dnd-kit/core bundle size vs NFR7 | MEDIUM | Verify gzipped size < 150KB; fallback: up/down buttons |
| Rich text editor complexity | LOW | MVP with markdown textarea; TipTap post-MVP |
| Drag-and-drop race condition on reorder | LOW | Debounce + optimistic UI |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-08 | 1.0 | Story created from Epic 2 | River (SM) |

---

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- Typecheck: clean pass (0 errors)
- Chapter Zod tests: 12/12 passing (total 23/23 across shared package)

### Completion Notes List
- Installed @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, react-markdown
- Used existing custom Tabs component (controlled-only, no defaultValue)
- Teacher delete uses service role (same pattern as Story 2.1 M-1)
- Markdown preview uses react-markdown with prose-invert styling
- Char counter with red/green visual feedback at 100 char boundary

### File List
- `packages/shared/src/validators/chapters.ts` — NEW: Zod schemas (create, update, reorder)
- `packages/shared/src/index.ts` — MODIFIED: Export chapters validators
- `packages/shared/tests/validators/chapters.test.ts` — NEW: 12 unit tests
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/actions.ts` — NEW: Server Actions (CRUD + reorder + toggle)
- `apps/web/src/app/(platform)/courses/[courseId]/_components/chapter-list.tsx` — NEW: Sortable chapter list (organism)
- `apps/web/src/app/(platform)/courses/[courseId]/_components/chapter-list-item.tsx` — NEW: Draggable item (molecule)
- `apps/web/src/app/(platform)/courses/[courseId]/_components/course-detail-client.tsx` — MODIFIED: Integrated ChapterList
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/edit/page.tsx` — NEW: Chapter editor page
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/edit/_components/chapter-editor-client.tsx` — NEW: Editor with markdown preview (organism)
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/new/edit/page.tsx` — NEW: New chapter page

---

## QA Results

### Review Date: 2026-02-08

### Review Type: Pre-Development Story Proposal Review

### Reviewed By: Quinn (Test Architect)

### Code Quality Assessment

**Overall:** Strong story with comprehensive technical detail. Drag-and-drop pattern well-documented with `@dnd-kit/core`. MVP markdown editor decision is pragmatic. Chapter editor and course overview pages clearly specified.

### Compliance Check

- Architecture Alignment: CONCERNS — `chapters_delete` admin-only RLS not explicitly resolved for teacher use case
- Screens Alignment: ✓ — Screen 6 (teacher chapter list) and Screen 8 (chapter editor) correctly mapped
- Epic Findings: ✓ — M-5 (bundle size) noted as advisory, M-7 (pagination) covered
- Story Structure: ✓ — All sections complete

### Findings

**MEDIUM:**

- **S2.2-M1: Teacher chapter delete vs `chapters_delete` admin-only RLS.** AC5 says teacher can delete chapters, but `chapters_delete` RLS only allows admin (line 203). Story says "follow same pattern as Story 2.1 M-1 resolution" but doesn't explicitly document the approach for chapters. Since this is the same pattern, @dev should apply whichever decision @architect makes for Story 2.1 (service role or new RLS policy). **Recommendation:** Add explicit note to Task 2 (`deleteChapter`) referencing the M-1 pattern.
  - **Suggested Owner:** @dev (Dex)
  - **Refs:** AC5, Dev Notes RLS section line 203

- **S2.2-M2: `@dnd-kit/core` bundle size validation (M-5) needs measurable gate.** Task 3 says "verify bundle size impact" but doesn't define a pass/fail threshold. NFR7 is `< 150KB gzipped` for the entire app. `@dnd-kit/core` + sortable is typically ~15-20KB gzipped — well within budget. **Recommendation:** Add to Task 3: "Verify `@dnd-kit/core` + `@dnd-kit/sortable` gzipped < 25KB. Fallback: up/down arrow buttons."
  - **Suggested Owner:** @dev (Dex)

**LOW:**

- **S2.2-L1: Screen 8 shows "Publicar" button in chapter editor, but Task 7 only implements "Salvar".** The publish toggle is handled in Task 10 separately, which is architecturally fine. However, the chapter editor page (Task 7) should include a reference to the publish action for UX completeness. @dev should ensure both buttons appear in the editor.
- **S2.2-L2: Markdown textarea decision is correct for MVP.** `react-markdown` + `@tailwindcss/typography` is lightweight and sufficient. TipTap can be introduced post-MVP.

### Security Review

- RLS enforcement: ✓ — Policies documented (with admin-only delete caveat noted above)
- Tenant isolation: ✓ — `tenant_id` auto-populated via trigger
- Auth guards: ✓ — Server Actions specify teacher/admin role check
- CASCADE delete: ✓ — Questions cascade on chapter delete (DB constraint)

### Performance Considerations

- Drag-and-drop debounce: ✓ — Documented in Risk Assessment (optimistic UI + debounce)
- No pagination for MVP: ✓ — < 30 chapters/course is reasonable
- Bundle size: PENDING — M-5 validation needed during implementation

### Gate Status

Gate: **PASS** → `docs/qa/gates/2.2-crud-capitulos.yml`
Quality Score: **85/100**

### Recommended Status

✓ Ready for Development — 2 MEDIUM findings are non-blocking (same pattern as Story 2.1 + measurable task criteria)

— Quinn, guardiao da qualidade 🛡️

---

*Story criada por River (Scrum Master) — eximIA Academy*
