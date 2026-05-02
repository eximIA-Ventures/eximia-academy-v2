# Story 22.2: Steps 1-2 — Proposito & Audiencia

**Epic:** [Epic 22 — WS2: UI: Wizard, Viewer & Blueprint Editor](../../epics/epic-22-ws2-ui-wizard-viewer-blueprint-editor.md)
**Version:** 1.0
**Created:** 2026-02-16
**Updated:** 2026-02-16
**Author:** River (SM)
**Status:** Ready
**Story Points:** 5
**Priority:** P0 (core)
**Blocked By:** Story 22.1
**Blocks:** Story 22.4
**Assigned To:** @dev

---

## User Story

**As a** manager,
**I want** preencher o proposito do curso (business goal, behavior change) e definir a audiencia (role, experience level),
**so that** o pipeline tenha contexto para design instrucional personalizado.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws2-course-creator-architecture.md`, Secoes 6.1-6.2 |
| **PRD Ref** | `Benchmarks/07_Course_Designer/PRD-Course-Designer-v1.0.md` — WS2: Course Creator |
| **Stack** | Next.js 15, React, `@eximia/ui`, Tailwind CSS v4 |
| **Package** | `apps/web` |
| **Existing Pattern** | `apps/web/src/app/(platform)/courses/new/design/_components/` (wizard from Story 22.1) |
| **Risk** | LOW — formularios com campos definidos |

---

## Acceptance Criteria

- [ ] **AC1:** `PurposeStep` component em `_components/purpose-step.tsx` (Step 1)
  - Campos: `course_title` (Input, obrigatorio), `business_goal` (Textarea, obrigatorio), `behavior_change` (Textarea, obrigatorio)
  - Campos opcionais: `success_metrics` (lista dinamica de strings), `problem_statement` (Textarea)
  - Helper text explicando cada campo (ex: "O que muda na organizacao?")
  - Validacao: title >= 5 chars, business_goal >= 10 chars, behavior_change >= 10 chars
- [ ] **AC2:** `AudienceStep` component em `_components/audience-step.tsx` (Step 2)
  - Campos obrigatorios: `role` (Input), `experience_level` (Select: iniciante, intermediario, avancado, especialista)
  - Campos opcionais: `prior_knowledge` (tag input), `group_size` (NumberInput), `motivation_context` (Textarea), `learning_environment` (Select), `autonomy_level` (Select)
- [ ] **AC3:** "Preencher com IA" nos dois steps
  - Chama `POST /api/course-designer/ai-fill` (Epic 21.4 AC9) com step atual e campos preenchidos
  - Preview dos valores sugeridos antes de aceitar (confidence score por campo)
  - Instrutor pode aceitar todos, editar individualmente, ou descartar
- [ ] **AC4:** Validacao inline: erros exibidos abaixo de cada campo
- [ ] **AC5:** Usa `@eximia/ui`: Input, Textarea, Select, Button, Card, Badge
- [ ] **AC6:** Tokens: `bg-bg-card`, `text-text-primary`, `rounded-md` — zero hex/rgba

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1) Implementar PurposeStep component
  - [ ] Criar `_components/purpose-step.tsx`
  - [ ] Implementar campo `course_title` (Input, obrigatorio, min 5 chars)
  - [ ] Implementar campo `business_goal` (Textarea, obrigatorio, min 10 chars)
  - [ ] Implementar campo `behavior_change` (Textarea, obrigatorio, min 10 chars)
  - [ ] Implementar campo opcional `success_metrics` (lista dinamica de strings)
  - [ ] Implementar campo opcional `problem_statement` (Textarea)
  - [ ] Adicionar helper text explicativo em cada campo

- [ ] **Task 2** (AC: 2) Implementar AudienceStep component
  - [ ] Criar `_components/audience-step.tsx`
  - [ ] Implementar campo `role` (Input, obrigatorio)
  - [ ] Implementar campo `experience_level` (Select: iniciante, intermediario, avancado, especialista)
  - [ ] Implementar campos opcionais: `prior_knowledge` (tag input), `group_size` (NumberInput), `motivation_context` (Textarea), `learning_environment` (Select), `autonomy_level` (Select)

- [ ] **Task 3** (AC: 3) Implementar "Preencher com IA"
  - [ ] Implementar chamada `POST /api/course-designer/ai-fill` com step atual e campos preenchidos
  - [ ] Implementar preview dos valores sugeridos com confidence score por campo
  - [ ] Implementar opcoes: aceitar todos, editar individualmente, descartar

- [ ] **Task 4** (AC: 4) Implementar validacao inline
  - [ ] Erros exibidos abaixo de cada campo em tempo real
  - [ ] Integrar com React Hook Form + Zod resolver

- [ ] **Task 5** (AC: 5, 6) Integrar design system e tokens
  - [ ] Usar `@eximia/ui`: Input, Textarea, Select, Button, Card, Badge
  - [ ] Usar tokens: `bg-bg-card`, `text-text-primary`, `rounded-md`
  - [ ] Verificar zero hex/rgba hardcoded

- [ ] **Task 6** (AC: 1-6) Validacao final
  - [ ] Rodar `pnpm typecheck` — deve passar sem erros
  - [ ] Verificar validacao inline funciona em ambos os steps

---

## Dev Notes

### Technical Notes

React Hook Form com Zod resolver. "Preencher com IA" faz POST para API que usa `generateObject` para sugerir valores.

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar formularios |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Validacao inline funciona | Yes |

### File Locations

```
apps/web/src/app/(platform)/courses/new/design/_components/
├── purpose-step.tsx                 # NOVO
├── audience-step.tsx                # NOVO
```

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-16 | 1.0 | Story creation | River (SM) |
| 2026-02-16 | 1.1 | PO validation: GO — Status Draft → Ready | Pax (PO) |

---

## Dev Agent Record

### Agent Model Used
_To be filled by @dev_

### Debug Log References
_To be filled by @dev_

### Completion Notes List
_To be filled by @dev_

### File List
_To be filled by @dev_

---

## QA Results
_To be filled by @qa_
