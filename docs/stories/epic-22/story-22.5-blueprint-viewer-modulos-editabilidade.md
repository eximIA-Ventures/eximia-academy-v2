# Story 22.5: Blueprint Viewer — Modulos + Editabilidade (D11)

**Epic:** [Epic 22 — WS2: UI: Wizard, Viewer & Blueprint Editor](../../epics/epic-22-ws2-ui-wizard-viewer-blueprint-editor.md)
**Version:** 1.0
**Created:** 2026-02-16
**Updated:** 2026-02-16
**Author:** River (SM)
**Status:** Ready
**Story Points:** 8
**Priority:** P0 (core)
**Blocked By:** Story 22.6, Epic 21 (API routes)
**Blocks:** None (within Epic 22)
**Assigned To:** @dev

---

## User Story

**As a** manager,
**I want** visualizar o blueprint gerado com todos os modulos e poder editar textos, ordem e interaction types,
**so that** eu customize o design instrucional antes de aplicar ao curso.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws2-course-creator-architecture.md`, Secoes 12, 17 |
| **PRD Ref** | `Benchmarks/07_Course_Designer/PRD-Course-Designer-v1.0.md` — WS2: Course Creator |
| **Stack** | Next.js 15, React, `@eximia/ui`, `@dnd-kit/core`, Tailwind CSS v4 |
| **Package** | `apps/web` |
| **Existing Pattern** | `apps/web/src/app/(platform)/courses/` (platform layout existing) |
| **Risk** | MEDIUM — edicao com recalculo de score, drag-and-drop, integracao com API |

---

## Acceptance Criteria

- [ ] **AC1:** Page em `apps/web/src/app/(platform)/courses/[courseId]/blueprint/page.tsx`
  - Carrega blueprint completo via `GET /api/course-designer/blueprints/[id]`
  - Exibe metadata: titulo, framework, duracao, score, data de criacao
- [ ] **AC2:** `BlueprintViewer` component em `_components/blueprint-viewer.tsx`
  - Layout: metadata bar + scorecard + bloom progression + modules list
  - Modo view (default) e modo edit (toggle)
  - Botoes: "Editar", "Exportar JSON", "Aplicar ao Curso"
- [ ] **AC3:** `ModuleCard` component em `_components/module-card.tsx`
  - Exibe: order, title, description, duration_minutes, spiral_level, interaction_type
  - `FrameworkStageBar` integrado: barra horizontal com N segmentos coloridos (% do tempo)
  - Objetivos com Bloom level badge
  - Expandivel: mostra assessments, rubrics, chunks
- [ ] **AC4:** `ProblemaMotorCard` component em `_components/problema-motor-card.tsx`
  - Exibe: title, context, role, tension, mission, constraints, deliverable
  - Tension score visual (1-125)
- [ ] **AC5:** Modo edicao:
  - Editar textos (titulos, descricoes, objetivos) inline
  - Mudar interaction_type por modulo (dropdown)
  - Ajustar duracoes por modulo
  - Reordenar modulos (drag-and-drop ou up/down arrows)
  - Adicionar/remover modulos
  - Save chama `PUT /api/course-designer/blueprints/[id]` — recalcula Scorecard
  - Exibe delta de score: "Score: 83 -> 79 (-4)"
- [ ] **AC6:** `RubricViewer` component: tabela 3 colunas (criterion, level_0, level_1, level_2)
- [ ] **AC7:** Usa `@eximia/ui`: Card, Tabs, Button, Badge, Accordion, Alert
- [ ] **AC8:** Responsivo: modulos em lista vertical, scorecard collapsivel em mobile

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1) Criar page do Blueprint Viewer
  - [ ] Criar `apps/web/src/app/(platform)/courses/[courseId]/blueprint/page.tsx`
  - [ ] Implementar carregamento de blueprint via `GET /api/course-designer/blueprints/[id]`
  - [ ] Exibir metadata: titulo, framework, duracao, score, data de criacao

- [ ] **Task 2** (AC: 2) Implementar BlueprintViewer component
  - [ ] Criar `_components/blueprint-viewer.tsx`
  - [ ] Implementar layout: metadata bar + scorecard + bloom progression + modules list
  - [ ] Implementar modo view (default) e modo edit (toggle)
  - [ ] Implementar botoes: "Editar", "Exportar JSON", "Aplicar ao Curso"

- [ ] **Task 3** (AC: 3) Implementar ModuleCard component
  - [ ] Criar `_components/module-card.tsx`
  - [ ] Exibir: order, title, description, duration_minutes, spiral_level, interaction_type
  - [ ] Integrar `FrameworkStageBar`: barra horizontal com N segmentos coloridos (% do tempo)
  - [ ] Exibir objetivos com Bloom level badge
  - [ ] Implementar expandivel: mostra assessments, rubrics, chunks

- [ ] **Task 4** (AC: 4) Implementar ProblemaMotorCard component
  - [ ] Criar `_components/problema-motor-card.tsx`
  - [ ] Exibir: title, context, role, tension, mission, constraints, deliverable
  - [ ] Implementar tension score visual (1-125)

- [ ] **Task 5** (AC: 5) Implementar modo edicao
  - [ ] Editar textos (titulos, descricoes, objetivos) inline
  - [ ] Mudar interaction_type por modulo (dropdown)
  - [ ] Ajustar duracoes por modulo
  - [ ] Implementar drag-and-drop via `@dnd-kit/core` para reordenar modulos
  - [ ] Implementar fallback com up/down arrows para acessibilidade
  - [ ] Implementar adicionar/remover modulos
  - [ ] Save chama `PUT /api/course-designer/blueprints/[id]` — recalcula Scorecard
  - [ ] Exibir delta de score: "Score: 83 -> 79 (-4)"

- [ ] **Task 6** (AC: 6) Implementar RubricViewer component
  - [ ] Criar `_components/rubric-viewer.tsx`
  - [ ] Implementar tabela 3 colunas: criterion, level_0, level_1, level_2

- [ ] **Task 7** (AC: 7, 8) Integrar design system e responsividade
  - [ ] Usar `@eximia/ui`: Card, Tabs, Button, Badge, Accordion, Alert
  - [ ] Responsivo: modulos em lista vertical, scorecard collapsivel em mobile
  - [ ] Zero hex/rgba — apenas theme tokens

- [ ] **Task 8** (AC: 1-8) Validacao final
  - [ ] Rodar `pnpm typecheck` — deve passar sem erros
  - [ ] Verificar modulos exibem todos os dados do blueprint
  - [ ] Verificar edicao funciona e Scorecard recalcula
  - [ ] Verificar zero hex/rgba — apenas theme tokens

---

## Dev Notes

### Technical Notes

Drag-and-drop via `@dnd-kit/core` (adicionar ao `apps/web` como dependencia). Fallback com up/down arrows para acessibilidade. Edicao inline via contentEditable ou input fields que aparecem no modo edit.

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar Blueprint Viewer + edicao |
| **@ux-design-expert** | Validar layout e fluxo de edicao |
| **@qa (QA)** | Testar edicao e recalculo de score |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Modulos exibem todos os dados do blueprint | Yes |
| Pre-PR | Edicao funciona e Scorecard recalcula | Yes |
| Pre-PR | Zero hex/rgba — apenas theme tokens | Yes |

### File Locations

```
apps/web/src/app/(platform)/courses/[courseId]/blueprint/
├── page.tsx                             # NOVO
├── _components/
│   ├── blueprint-viewer.tsx             # NOVO
│   ├── module-card.tsx                  # NOVO
│   ├── problema-motor-card.tsx          # NOVO
│   └── rubric-viewer.tsx                # NOVO
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
