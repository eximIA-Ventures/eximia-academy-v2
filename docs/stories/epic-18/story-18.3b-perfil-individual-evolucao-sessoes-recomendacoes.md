# Story 18.3b: Perfil Individual — Evolucao, Sessoes e Recomendacoes (`/analytics/students/[id]`)

**Epic:** [Epic 18 — Analytics & Output Analitico Avancado](../../epics/epic-18-ws1-analytics-output-analitico.md)
**Version:** 1.0
**Created:** 2026-02-15
**Updated:** 2026-02-15
**Author:** River (SM)
**Status:** Ready
**Story Points:** 5
**Priority:** P1
**Blocked By:** Story 18.3a (pagina e tabs devem existir)
**Blocks:** None
**Assigned To:** @dev

---

## User Story

**As a** manager,
**I want** ver a evolucao do aluno ao longo das sessoes, historico de sessoes e recomendacoes,
**so that** eu possa acompanhar o progresso e tomar acoes direcionadas.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws1-motor-socratico-architecture.md`, Secao 16 (UC2, D2) |
| **PRD Ref** | `docs/prd/evolucao-eximia-academy-workstreams.md` — WS1: Motor Socratico |
| **Stack** | Next.js 15 (Client components), recharts, @eximia/ui (DataTable) |
| **Design Tokens** | `apps/web/src/styles/theme.css` |
| **Risk** | LOW — graficos similares aos da UC3, reutiliza patterns |

---

## Acceptance Criteria

- [ ] **AC1:** Tab "Evolucao"
  - `DepthProgressionChart` — profundidade ao longo das sessoes (LineChart)
  - Kolb vector trail (ScatterChart com linha conectando pontos — evolucao ao longo do tempo)
  - Clareza: inicial → final (ganho)
  - Densidade emocional: trend
- [ ] **AC2:** Tab "Sessoes"
  - `SessionHistoryTable` — data, curso, profundidade, AI detection, QA score
  - Link para `/analytics/sessions/[sessionId]`
  - Reutilizar `DataTable` do `@eximia/ui`
  - Paginacao se muitas sessoes
- [ ] **AC3:** `GestorRecommendations` — hints baseados nos dados (Card + lista)
  - Exibido abaixo das tabs
  - Recomendacoes geradas server-side baseadas em dados do Perfilador + Detector
  - Exemplos: "Abordar divergencia Kolb", "Monitorar deteccao IA", "Forte em X, desafiar com Y"
- [ ] **AC4:** Todos os componentes usam tokens do design system
- [ ] **AC5:** `pnpm typecheck` passa

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1) Implementar Tab "Evolucao"
  - [ ] `DepthProgressionChart` — recharts LineChart (X = sessoes, Y = profundidade 1-7)
  - [ ] Kolb vector trail — recharts ScatterChart com linhas conectando pontos cronologicamente
  - [ ] Clareza: card com inicial → final (ganho percentual)
  - [ ] Densidade emocional: trend (crescente/decrescente/estavel)

- [ ] **Task 2** (AC: 2) Implementar Tab "Sessoes"
  - [ ] `SessionHistoryTable` — DataTable do @eximia/ui
  - [ ] Colunas: data, curso/capitulo, profundidade (X/7), AI detection (badge), QA score
  - [ ] Link "→" para `/analytics/sessions/[sessionId]`
  - [ ] Ordenacao por data (mais recente primeiro)

- [ ] **Task 3** (AC: 3) Implementar GestorRecommendations
  - [ ] Criar `apps/web/src/components/analytics/GestorRecommendations.tsx`
  - [ ] Card com lista de recomendacoes
  - [ ] Recomendacoes vem da API (campo `recommendations` do StudentAnalyticsResponse)
  - [ ] Posicionar abaixo das tabs

- [ ] **Task 4** (AC: 4, 5) Design system compliance e validacao
  - [ ] Usar tokens Tailwind
  - [ ] `pnpm typecheck` passa

---

## Dev Notes

### Depth Progression Chart

```
  7│            ╱╲
  5│      ╱╲╱╲╱  ╲╱╲
  3│  ╱╲╱
  1│╱
   └──────────────────────
   S1  S3  S5  S7  S9  S11
```

Cada ponto = profundidade maxima atingida naquela sessao.

### Kolb Vector Trail

ScatterChart com linha conectando pontos (evolucao ao longo do tempo):
- Cada ponto = vetor Kolb daquela sessao (grasping, transforming)
- Linha conecta em ordem cronologica
- Mostra se aluno esta "migrando" de estilo

### Session History Table

| Data | Curso | Prof. | AI Det. | Score | → |
|---|---|---|---|---|---|
| 12/02/2026 | Lideranca | 6/7 | Human | 0.91 | → |
| 10/02/2026 | SCRUM | 4/7 | Human | 0.85 | → |
| 08/02/2026 | Lideranca | 5/7 | AI | 0.72 | → |

### File Locations

```
apps/web/src/components/analytics/
├── DepthProgressionChart.tsx    # NOVO
├── SessionHistoryTable.tsx      # NOVO
└── GestorRecommendations.tsx    # NOVO
```

### Testing

- Testes E2E no Epic 19 (Story 19.4 — student-profile-analytics.spec.ts)
- Validar: 4 tabs renderizam, dados do seed visiveis

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-15 | 1.0 | Story creation | River (SM) |
| 2026-02-15 | 1.1 | PO validation: GO (10/10). Status Draft → Ready | Pax (PO) |

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
