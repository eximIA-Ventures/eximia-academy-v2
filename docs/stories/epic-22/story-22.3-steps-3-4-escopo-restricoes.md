# Story 22.3: Steps 3-4 — Escopo & Restricoes

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
**I want** definir o escopo do curso (competencias, topicos, uploads) e restricoes (duracao, delivery mode),
**so that** o pipeline saiba o que cobrir e dentro de quais limites.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws2-course-creator-architecture.md`, Secoes 6.3-6.4 |
| **PRD Ref** | `Benchmarks/07_Course_Designer/PRD-Course-Designer-v1.0.md` — WS2: Course Creator |
| **Stack** | Next.js 15, React, `@eximia/ui`, Tailwind CSS v4 |
| **Package** | `apps/web` |
| **Existing Pattern** | `apps/web/src/app/(platform)/courses/new/design/_components/` (wizard from Story 22.1) |
| **Risk** | MEDIUM — upload de arquivos + course selector para Path B |

---

## Acceptance Criteria

- [ ] **AC1:** `ScopeStep` component em `_components/scope-step.tsx` (Step 3)
  - `core_competencies` (tag input — lista de competencias)
  - `topics_outline` (tag input ou lista dinamica)
  - `content_density` (Select: lean, moderada, densa)
  - `assessment_preference` (Select: formativa, somativa, mista)
  - `context_files` (file upload — PDF, PPTX, DOCX, TXT — max 10MB)
  - `existing_materials_summary` (Textarea)
  - `source_course_id` (Course Selector — para Caminho B, Epic 23)
  - Nota: "Ao menos 1 fonte: competencias, topicos, arquivos ou curso existente"
- [ ] **AC2:** File upload com preview (nome, tipo, tamanho)
  - Se Content Analyzer disponivel (Epic 21.5): upload chama API, mostra loading, resultado pre-preenche `topics_outline` e sugere `core_competencies`
  - Instrutor revisa antes de aceitar
  - **Graceful degradation**: se 21.5 nao disponivel, upload salva arquivo e exibe mensagem "Analise automatica em breve" (campo fica editavel manualmente)
- [ ] **AC3:** `ConstraintsStep` component em `_components/constraints-step.tsx` (Step 4)
  - `total_duration_hours` (NumberInput, obrigatorio, min 1, max 200)
  - `weeks` (NumberInput, opcional)
  - `hours_per_week` (NumberInput, opcional)
  - Auto-calculo: se weeks x hours_per_week preenchidos, calcula total_duration_hours
  - `delivery_mode` (Select: presencial, online_sync, online_async, hibrido)
  - `cohort_based` (Checkbox)
  - `session_length_preference` (NumberInput, min 15, max 240, em minutos)
- [ ] **AC4:** Warning visual se duracao < 4h: "Cursos abaixo de 4h geram blueprints limitados"
- [ ] **AC5:** Usa `@eximia/ui` para todos os componentes de formulario
- [ ] **AC6:** Zero hex/rgba — apenas theme tokens

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1) Implementar ScopeStep component
  - [ ] Criar `_components/scope-step.tsx`
  - [ ] Implementar `core_competencies` (tag input — lista de competencias)
  - [ ] Implementar `topics_outline` (tag input ou lista dinamica)
  - [ ] Implementar `content_density` (Select: lean, moderada, densa)
  - [ ] Implementar `assessment_preference` (Select: formativa, somativa, mista)
  - [ ] Implementar `context_files` (file upload — PDF, PPTX, DOCX, TXT — max 10MB)
  - [ ] Implementar `existing_materials_summary` (Textarea)
  - [ ] Implementar `source_course_id` (Course Selector slot — disabled com label "Em breve" para Epic 23)
  - [ ] Adicionar nota: "Ao menos 1 fonte: competencias, topicos, arquivos ou curso existente"

- [ ] **Task 2** (AC: 2) Implementar file upload com preview e Content Analyzer
  - [ ] Implementar preview de arquivo (nome, tipo, tamanho)
  - [ ] Implementar integracao com Content Analyzer (Epic 21.5): upload chama API, mostra loading
  - [ ] Resultado pre-preenche `topics_outline` e sugere `core_competencies`
  - [ ] Instrutor revisa antes de aceitar
  - [ ] Implementar graceful degradation: se 21.5 nao disponivel, exibir "Analise automatica em breve" (campo editavel manualmente)

- [ ] **Task 3** (AC: 3) Implementar ConstraintsStep component
  - [ ] Criar `_components/constraints-step.tsx`
  - [ ] Implementar `total_duration_hours` (NumberInput, obrigatorio, min 1, max 200)
  - [ ] Implementar `weeks` (NumberInput, opcional)
  - [ ] Implementar `hours_per_week` (NumberInput, opcional)
  - [ ] Implementar auto-calculo: weeks x hours_per_week = total_duration_hours
  - [ ] Implementar `delivery_mode` (Select: presencial, online_sync, online_async, hibrido)
  - [ ] Implementar `cohort_based` (Checkbox)
  - [ ] Implementar `session_length_preference` (NumberInput, min 15, max 240, em minutos)

- [ ] **Task 4** (AC: 4) Implementar warning de duracao
  - [ ] Warning visual se duracao < 4h: "Cursos abaixo de 4h geram blueprints limitados"

- [ ] **Task 5** (AC: 5, 6) Integrar design system e tokens
  - [ ] Usar `@eximia/ui` para todos os componentes de formulario
  - [ ] Verificar zero hex/rgba — apenas theme tokens

- [ ] **Task 6** (AC: 1-6) Validacao final
  - [ ] Rodar `pnpm typecheck` — deve passar sem erros
  - [ ] Verificar upload de PDF funciona e mostra resultados da analise
  - [ ] Verificar auto-calculo weeks x hours funciona

---

## Dev Notes

### Technical Notes

File upload via `FormData`. Content Analyzer e assincrono — mostrar skeleton loading durante processamento. Course Selector para Path B sera implementado no Epic 23, mas o slot no form ja deve existir (disabled com label "Em breve").

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar formularios + file upload |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Upload de PDF funciona e mostra resultados da analise | Yes |
| Pre-PR | Auto-calculo weeks x hours funciona | Yes |

### File Locations

```
apps/web/src/app/(platform)/courses/new/design/_components/
├── scope-step.tsx                   # NOVO
├── constraints-step.tsx             # NOVO
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
