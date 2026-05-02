# Story 22.4: Steps 5-6 — Preferencias & Pre-validation + Generate

**Epic:** [Epic 22 — WS2: UI: Wizard, Viewer & Blueprint Editor](../../epics/epic-22-ws2-ui-wizard-viewer-blueprint-editor.md)
**Version:** 1.0
**Created:** 2026-02-16
**Updated:** 2026-02-16
**Author:** River (SM)
**Status:** Ready
**Story Points:** 5
**Priority:** P0 (core — onde a geracao acontece)
**Blocked By:** Story 22.2, Story 22.3
**Blocks:** Story 22.6
**Assigned To:** @dev

---

## User Story

**As a** manager,
**I want** selecionar o framework e estrategia de interacao, ver o Brief Score, e iniciar a geracao do blueprint com progress visual,
**so that** eu saiba se meu input e suficiente e acompanhe a geracao em tempo real.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws2-course-creator-architecture.md`, Secoes 6.5-6.6, 10.1 |
| **PRD Ref** | `Benchmarks/07_Course_Designer/PRD-Course-Designer-v1.0.md` — WS2: Course Creator |
| **Stack** | Next.js 15, React, `@eximia/ui`, Tailwind CSS v4 |
| **Package** | `apps/web` |
| **Existing Pattern** | `apps/web/src/app/(platform)/courses/new/design/_components/` (wizard from Story 22.1) |
| **Risk** | MEDIUM — SSE consumption no frontend, Brief Score UX |

---

## Acceptance Criteria

- [ ] **AC1:** `PreferencesStep` component em `_components/preferences-step.tsx` (Step 5)
  - `FrameworkSelector` visual: grid com 3 cards (ELC+, Kolb, PBL) + card "Auto"
    - Cada card mostra: nome, stages count, descricao curta, icone
    - Card "Auto" com badge "Recomendado" quando framework=auto
    - Card selecionado com border accent
  - `interaction_strategy` (Select: bloom_mapped, dominant, custom)
  - `dominant_interaction_type` (Select, visivel apenas se strategy=dominant)
  - `language` (Select: pt-br, en)
  - Data dos frameworks vem da API `GET /api/course-designer/frameworks`
- [ ] **AC2:** `PrevalidationStep` component em `_components/prevalidation-step.tsx` (Step 6)
  - `BriefScoreIndicator`: score 0-100 visual (gauge ou circular progress)
    - Faixas: 90-100 Excelente (verde), 70-89 Bom (azul), 50-69 Suficiente (amarelo), <50 Minimo (vermelho)
  - Lista de checks obrigatorios: pass/fail com icone
  - Lista de warnings: amarelo com sugestao de melhoria
  - Botao "Gerar Blueprint" habilitado somente se todos os checks obrigatorios passam
- [ ] **AC3:** `DesignProgress` component em `_components/design-progress.tsx`
  - Exibido apos clicar "Gerar Blueprint"
  - Stepper vertical com 5 fases: Analyzer, Architect, Calculator, Validator, Generator
  - Cada fase mostra: status (pending, running, completed, failed), tempo decorrido
  - Conecta via SSE ao `POST /api/course-designer/generate`
  - Reconexao automatica se SSE desconectar (usa job polling como fallback)
- [ ] **AC4:** Ao completar, redireciona para Blueprint Viewer (`/courses/[courseId]/blueprint`)
- [ ] **AC5:** Handling de erros: se pipeline falha, mostra mensagem com opcao de retry
- [ ] **AC6:** `FrameworkSelector` como componente reutilizavel em `_components/framework-selector.tsx`

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1, 6) Implementar PreferencesStep e FrameworkSelector
  - [ ] Criar `_components/framework-selector.tsx` como componente reutilizavel
  - [ ] Implementar grid visual com 3 cards (ELC+, Kolb, PBL) + card "Auto"
  - [ ] Cada card mostra: nome, stages count, descricao curta, icone
  - [ ] Card "Auto" com badge "Recomendado" quando framework=auto
  - [ ] Card selecionado com border accent
  - [ ] Criar `_components/preferences-step.tsx`
  - [ ] Implementar `interaction_strategy` (Select: bloom_mapped, dominant, custom)
  - [ ] Implementar `dominant_interaction_type` (Select, visivel apenas se strategy=dominant)
  - [ ] Implementar `language` (Select: pt-br, en)
  - [ ] Fetch data dos frameworks via `GET /api/course-designer/frameworks`

- [ ] **Task 2** (AC: 2) Implementar PrevalidationStep
  - [ ] Criar `_components/prevalidation-step.tsx`
  - [ ] Implementar `BriefScoreIndicator`: score 0-100 visual (gauge ou circular progress)
  - [ ] Implementar faixas de cor: 90-100 Excelente (verde), 70-89 Bom (azul), 50-69 Suficiente (amarelo), <50 Minimo (vermelho)
  - [ ] Implementar lista de checks obrigatorios: pass/fail com icone
  - [ ] Implementar lista de warnings: amarelo com sugestao de melhoria
  - [ ] Botao "Gerar Blueprint" habilitado somente se todos os checks obrigatorios passam

- [ ] **Task 3** (AC: 3) Implementar DesignProgress com SSE
  - [ ] Criar `_components/design-progress.tsx`
  - [ ] Implementar stepper vertical com 5 fases: Analyzer, Architect, Calculator, Validator, Generator
  - [ ] Cada fase mostra: status (pending, running, completed, failed), tempo decorrido
  - [ ] Implementar conexao SSE ao `POST /api/course-designer/generate`
  - [ ] Implementar reconexao automatica se SSE desconectar (job polling como fallback)

- [ ] **Task 4** (AC: 4) Implementar redirect ao completar
  - [ ] Ao completar geracao, redirecionar para Blueprint Viewer (`/courses/[courseId]/blueprint`)

- [ ] **Task 5** (AC: 5) Implementar error handling
  - [ ] Se pipeline falha, mostrar mensagem com opcao de retry
  - [ ] Tratar erros de rede e timeout

- [ ] **Task 6** (AC: 1-6) Validacao final
  - [ ] Rodar `pnpm typecheck` — deve passar sem erros
  - [ ] Verificar Framework Selector visual funciona
  - [ ] Verificar Brief Score calcula corretamente
  - [ ] Verificar Design Progress recebe SSE events

---

## Dev Notes

### Technical Notes

SSE consumption via `EventSource` API ou fetch + ReadableStream. Heartbeat handling para manter conexao. Brief Score usa `calculateBriefScore()` do schema (Epic 20.3) — pode rodar client-side.

```typescript
// SSE consumption
const eventSource = new EventSource(`/api/course-designer/generate?jobId=${jobId}`)
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data)
  setPhases(prev => prev.map(p =>
    p.phase === data.phase ? { ...p, status: data.status } : p
  ))
}
```

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar Steps 5-6 + SSE client |
| **@ux-design-expert** | Validar UX do Brief Score e Design Progress |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Framework Selector visual funciona | Yes |
| Pre-PR | Brief Score calcula corretamente | Yes |
| Pre-PR | Design Progress recebe SSE events | Yes |

### File Locations

```
apps/web/src/app/(platform)/courses/new/design/_components/
├── preferences-step.tsx             # NOVO
├── prevalidation-step.tsx           # NOVO
├── framework-selector.tsx           # NOVO
├── design-progress.tsx              # NOVO
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
