# Story 22.6: Quality Scorecard + Bloom Progression + Componentes Visuais

**Epic:** [Epic 22 — WS2: UI: Wizard, Viewer & Blueprint Editor](../../epics/epic-22-ws2-ui-wizard-viewer-blueprint-editor.md)
**Version:** 1.0
**Created:** 2026-02-16
**Updated:** 2026-02-16
**Author:** River (SM)
**Status:** Ready
**Story Points:** 5
**Priority:** P1 (enhancement — Blueprint Viewer funciona sem estes, mas com menos valor)
**Blocked By:** Story 22.4
**Blocks:** Story 22.5
**Assigned To:** @dev

---

## User Story

**As a** manager,
**I want** visualizar o Quality Scorecard (Framework + Neuro scores), Bloom Progression e FrameworkStageBar,
**so that** eu entenda a qualidade pedagogica do meu blueprint de forma intuitiva.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws2-course-creator-architecture.md`, Secoes 5.1, 19 |
| **PRD Ref** | `Benchmarks/07_Course_Designer/PRD-Course-Designer-v1.0.md` — WS2: Course Creator |
| **Stack** | Next.js 15, React, `@eximia/ui`, Tailwind CSS v4 |
| **Package** | `apps/web` |
| **Existing Pattern** | `apps/web/src/app/(platform)/courses/[courseId]/blueprint/_components/` (cria pasta _components/ que Story 22.5 estenderá) |
| **Risk** | LOW — componentes visuais puros |

---

## Acceptance Criteria

- [ ] **AC1:** `QualityScorecard` component em `_components/quality-scorecard.tsx`
  - Dois gauges/radials: Framework Score (70%) e Neuroscience Score (30%)
  - Score Final composto com badge de verdict (excellent/good/needs_revision/poor)
  - Cores por verdict: excellent=verde, good=azul, needs_revision=amarelo, poor=vermelho
  - Expandivel: mostra breakdown de cada dimensao (5 framework + 7 neuro rules)
  - Flag `requires_instructor_review` com Alert se ativo
- [ ] **AC2:** `BloomProgression` component em `_components/bloom-progression.tsx`
  - Visualizacao horizontal dos 6 niveis Bloom
  - Cada modulo plotado no nivel correspondente
  - Cor gradient de Remember (claro) a Create (escuro)
  - Linha de progressao mostrando ascensao
  - Warning visual se drop > 1 nivel entre modulos adjacentes
- [ ] **AC3:** `FrameworkStageBar` component em `_components/framework-stage-bar.tsx`
  - Barra horizontal generica: N segmentos com % do tempo
  - Cada segmento: cor, label, percentual
  - Tooltip ao hover com detalhes do stage (name, duration_minutes, activities)
  - Generico: funciona para qualquer framework (3-6 stages)
- [ ] **AC4:** `BriefScoreIndicator` component (atom) reutilizado do Step 6
  - Circular progress com score numerico central
  - Cor por faixa (verde/azul/amarelo/vermelho)
- [ ] **AC5:** `AssessmentTimeline` component em `_components/assessment-timeline.tsx`
  - Timeline visual de assessments ao longo do curso
  - Tipos: formativa (icone check), somativa (icone star), diagnostica (icone search)
  - Kirkpatrick level badge (L1-L4)
- [ ] **AC6:** `KirkpatrickSummary` component: 4 levels com metodo + timing
- [ ] **AC7:** Todos usam theme tokens — zero hardcoded colors

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1) Implementar QualityScorecard component
  - [ ] Criar `_components/quality-scorecard.tsx`
  - [ ] Implementar dois gauges/radials: Framework Score (70%) e Neuroscience Score (30%)
  - [ ] Implementar Score Final composto com badge de verdict (excellent/good/needs_revision/poor)
  - [ ] Implementar cores por verdict: excellent=verde, good=azul, needs_revision=amarelo, poor=vermelho
  - [ ] Implementar expandivel: breakdown de cada dimensao (5 framework + 7 neuro rules)
  - [ ] Implementar flag `requires_instructor_review` com Alert se ativo

- [ ] **Task 2** (AC: 2) Implementar BloomProgression component
  - [ ] Criar `_components/bloom-progression.tsx`
  - [ ] Implementar visualizacao horizontal dos 6 niveis Bloom
  - [ ] Plotar cada modulo no nivel correspondente
  - [ ] Implementar cor gradient de Remember (claro) a Create (escuro)
  - [ ] Implementar linha de progressao mostrando ascensao
  - [ ] Implementar warning visual se drop > 1 nivel entre modulos adjacentes

- [ ] **Task 3** (AC: 3) Implementar FrameworkStageBar component
  - [ ] Criar `_components/framework-stage-bar.tsx`
  - [ ] Implementar barra horizontal generica com N segmentos e % do tempo
  - [ ] Cada segmento com cor, label, percentual
  - [ ] Implementar tooltip ao hover com detalhes do stage (name, duration_minutes, activities)
  - [ ] Garantir que funciona para qualquer framework (3-6 stages)

- [ ] **Task 4** (AC: 4) Implementar BriefScoreIndicator component
  - [ ] Criar `_components/brief-score-indicator.tsx`
  - [ ] Implementar circular progress com score numerico central
  - [ ] Implementar cor por faixa (verde/azul/amarelo/vermelho)
  - [ ] Garantir reutilizabilidade (atom component)

- [ ] **Task 5** (AC: 5) Implementar AssessmentTimeline component
  - [ ] Criar `_components/assessment-timeline.tsx`
  - [ ] Implementar timeline visual de assessments ao longo do curso
  - [ ] Implementar tipos: formativa (icone check), somativa (icone star), diagnostica (icone search)
  - [ ] Implementar Kirkpatrick level badge (L1-L4)

- [ ] **Task 6** (AC: 6) Implementar KirkpatrickSummary component
  - [ ] Criar `_components/kirkpatrick-summary.tsx`
  - [ ] Implementar 4 levels com metodo + timing

- [ ] **Task 7** (AC: 7) Validacao de tokens e design system
  - [ ] Verificar todos os componentes usam theme tokens
  - [ ] Zero hardcoded colors (hex/rgba)
  - [ ] Usar SVG custom ou CSS conic-gradient para gauges

- [ ] **Task 8** (AC: 1-7) Validacao final
  - [ ] Rodar `pnpm typecheck` — deve passar sem erros
  - [ ] Verificar todos os componentes renderizam com dados reais
  - [ ] Verificar responsivo em desktop e tablet

---

## Dev Notes

### Technical Notes

Para gauges/radials, considerar SVG custom ou CSS conic-gradient. Bloom Progression pode ser um chart simples com CSS Grid. Tudo deve ser performante para blueprints com 20+ modulos.

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar componentes visuais |
| **@ux-design-expert** | Validar design visual |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Todos os componentes renderizam com dados reais | Yes |
| Pre-PR | Responsivo em desktop e tablet | Yes |

### File Locations

```
apps/web/src/app/(platform)/courses/[courseId]/blueprint/_components/
├── quality-scorecard.tsx            # NOVO
├── bloom-progression.tsx            # NOVO
├── framework-stage-bar.tsx          # NOVO
├── assessment-timeline.tsx          # NOVO
├── kirkpatrick-summary.tsx          # NOVO
├── brief-score-indicator.tsx        # NOVO
```

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-16 | 1.0 | Story creation | River (SM) |
| 2026-02-16 | 1.1 | PO validation: GO — Corrigida referência "from Story 22.5"; Status Draft → Ready | Pax (PO) |

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
