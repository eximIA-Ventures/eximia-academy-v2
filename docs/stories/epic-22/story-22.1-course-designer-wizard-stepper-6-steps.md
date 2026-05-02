# Story 22.1: Course Designer Wizard — Stepper 6 Steps

**Epic:** [Epic 22 — WS2: UI: Wizard, Viewer & Blueprint Editor](../../epics/epic-22-ws2-ui-wizard-viewer-blueprint-editor.md)
**Version:** 1.0
**Created:** 2026-02-16
**Updated:** 2026-02-16
**Author:** River (SM)
**Status:** Ready
**Story Points:** 5
**Priority:** P0 (fundacao da UI)
**Blocked By:** None
**Blocks:** Story 22.2, Story 22.3
**Assigned To:** @dev

---

## User Story

**As a** manager,
**I want** um wizard multi-step guiado para preencher o Course Design Brief,
**so that** eu consiga criar blueprints sem conhecimento tecnico de design instrucional.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws2-course-creator-architecture.md`, Secao 14 |
| **PRD Ref** | `Benchmarks/07_Course_Designer/PRD-Course-Designer-v1.0.md` — WS2: Course Creator |
| **Stack** | Next.js 15, React, `@eximia/ui`, Tailwind CSS v4 |
| **Package** | `apps/web` |
| **Existing Pattern** | `apps/web/src/app/(platform)/courses/` (platform layout existing) |
| **Risk** | MEDIUM — UX complexa com 6 steps, state management |

---

## Acceptance Criteria

- [ ] **AC1:** Page em `apps/web/src/app/(platform)/courses/new/design/page.tsx`
  - Acessivel via menu de cursos (botao "Criar Blueprint")
  - Requer role `manager` ou `admin`
- [ ] **AC2:** `CourseDesignerWizard` component em `_components/course-designer-wizard.tsx`
  - Stepper horizontal com 6 steps nomeados
  - Navegacao: Proximo / Voltar / Ir para step
  - Validacao por step: nao avanca se campos obrigatorios vazios
  - State persistido em URL params (refresh nao perde dados)
- [ ] **AC3:** Usa componentes `@eximia/ui`: Card, Button, Tabs, ProgressBar
- [ ] **AC4:** Stepper visual indica: step atual, steps concluidos, steps futuros
- [ ] **AC5:** Responsivo: stack vertical em mobile/tablet, horizontal em desktop
- [ ] **AC6:** Botao "Preencher com IA" como acao global (disponivel em todos os steps)

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1) Criar page do wizard
  - [ ] Criar `apps/web/src/app/(platform)/courses/new/design/page.tsx`
  - [ ] Configurar rota acessivel via menu de cursos (botao "Criar Blueprint")
  - [ ] Implementar guard de role: requer `manager` ou `admin`

- [ ] **Task 2** (AC: 2) Implementar CourseDesignerWizard component
  - [ ] Criar `_components/course-designer-wizard.tsx`
  - [ ] Implementar stepper horizontal com 6 steps nomeados (Proposito, Audiencia, Escopo, Restricoes, Preferencias, Pre-validation)
  - [ ] Implementar navegacao: Proximo / Voltar / Ir para step
  - [ ] Implementar validacao por step: nao avanca se campos obrigatorios vazios
  - [ ] Persistir state em URL params via `useSearchParams` (refresh nao perde dados)

- [ ] **Task 3** (AC: 3) Integrar componentes @eximia/ui
  - [ ] Usar Card, Button, Tabs, ProgressBar do design system
  - [ ] Zero HTML/CSS ad-hoc para elementos existentes

- [ ] **Task 4** (AC: 4) Implementar stepper visual
  - [ ] Step atual: destaque visual (cor accent)
  - [ ] Steps concluidos: indicador de check/completude
  - [ ] Steps futuros: estado desabilitado/neutro

- [ ] **Task 5** (AC: 5) Responsividade
  - [ ] Stack vertical em mobile/tablet (< 1024px)
  - [ ] Horizontal em desktop (>= 1024px)

- [ ] **Task 6** (AC: 6) Botao "Preencher com IA"
  - [ ] Implementar acao global disponivel em todos os steps
  - [ ] Posicionar de forma consistente no layout do wizard

- [ ] **Task 7** (AC: 2, 3, 6) Validacao final
  - [ ] Rodar `pnpm typecheck` — deve passar sem erros
  - [ ] Verificar navegacao entre 6 steps funciona
  - [ ] Verificar que usa componentes `@eximia/ui` (zero HTML/CSS ad-hoc)

---

## Dev Notes

### Technical Notes

State management via React Hook Form + Zod resolver (schema do Epic 20.3). URL params via `useSearchParams` para persistencia.

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar wizard + stepper |
| **@ux-design-expert** | Validar fluxo UX |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Navegacao entre 6 steps funciona | Yes |
| Pre-PR | Usa componentes `@eximia/ui` (zero HTML/CSS ad-hoc) | Yes |

### File Locations

```
apps/web/src/app/(platform)/courses/new/design/
├── page.tsx                             # NOVO
├── _components/
│   └── course-designer-wizard.tsx       # NOVO
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
