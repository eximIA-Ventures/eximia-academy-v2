# Story 18.2b: Dashboard Agregado — Graficos, Alertas e Divergencia (`/analytics`)

**Epic:** [Epic 18 — Analytics & Output Analitico Avancado](../../epics/epic-18-ws1-analytics-output-analitico.md)
**Version:** 1.0
**Created:** 2026-02-15
**Updated:** 2026-02-15
**Author:** River (SM)
**Status:** Ready
**Story Points:** 8
**Priority:** P0 (core)
**Blocked By:** Story 18.2a (layout e filtros devem existir)
**Blocks:** Story 18.5
**Assigned To:** @dev

---

## User Story

**As a** manager,
**I want** graficos de profundidade, Kolb, padroes cognitivos, jornada emocional, alertas e divergencia,
**so that** eu possa analisar a turma com visualizacoes avancadas.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws1-motor-socratico-architecture.md`, Secao 16 (UC3, D3) |
| **PRD Ref** | `docs/prd/evolucao-eximia-academy-workstreams.md` — WS1: Motor Socratico |
| **Stack** | Next.js 15 (Client components), recharts, @eximia/ui |
| **Design Tokens** | `apps/web/src/styles/theme.css` |
| **Risk** | MEDIUM — 6 componentes recharts novos |

---

## Acceptance Criteria

- [ ] **AC1:** Profundidade da Turma — `DepthDistributionChart`
  - recharts `BarChart` vertical (7 barras, camadas 1-7)
  - Cores por faixa de profundidade (usar tokens do design system)
- [ ] **AC2:** Mapa Kolb da Turma — `KolbTeamScatter`
  - recharts `ScatterChart` (eixos -1 a +1, cada ponto = 1 aluno)
  - Tooltip com nome do aluno
  - Labels nos eixos: CE (Sentir) <-> AC (Pensar), RO (Observar) <-> AE (Fazer)
  - Quadrantes com labels dos 4 estilos
- [ ] **AC3:** Padroes Cognitivos Top 5 — `CognitivePatternsChart`
  - recharts `BarChart` horizontal (layout="vertical")
  - Ordenado por frequencia, top 5
- [ ] **AC4:** Jornada Emocional Media — `EmotionalJourneyChart`
  - recharts `AreaChart` (X = etapa da sessao, Y = densidade emocional)
  - Area com gradiente de cor
- [ ] **AC5:** Alertas de Atencao — `AlertAttentionList`
  - Severidade: critico (vermelho), atencao (amarelo), positivo (verde) — badges coloridos
  - Tipos: inatividade > 14d, likely_ai consecutivo, profundidade caindo, resistencia persistente, breakthrough streak
  - Link para perfil do aluno (`/analytics/students/[id]`)
  - Paginacao ou "Ver todos" se > 5 alertas
- [ ] **AC6:** Divergencia Teste vs IA — `DivergenceComparisonTable`
  - DataTable: aluno, Kolb teste, Kolb IA, divergencia (badge: alta/alinhado/sem teste)
  - CSV export button (reutilizar `CsvExportButton` existente)
- [ ] **AC7:** Todos os graficos reagem aos filtros da Story 18.2a
- [ ] **AC8:** Todos os componentes usam tokens do design system
- [ ] **AC9:** `pnpm typecheck` passa

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1) Implementar DepthDistributionChart
  - [ ] Criar `apps/web/src/components/analytics/DepthDistributionChart.tsx`
  - [ ] recharts `BarChart` com 7 barras (camadas 1-7)
  - [ ] Props: `data: number[]` (distribuicao 7 camadas)
  - [ ] Cores por faixa usando tokens do design system

- [ ] **Task 2** (AC: 2) Implementar KolbTeamScatter
  - [ ] Criar `apps/web/src/components/analytics/KolbTeamScatter.tsx`
  - [ ] recharts `ScatterChart` com 2 eixos (-1 a +1)
  - [ ] Props: `data: Array<{ x: number, y: number, name: string }>`
  - [ ] Tooltip com nome do aluno
  - [ ] Labels nos eixos e quadrantes

- [ ] **Task 3** (AC: 3) Implementar CognitivePatternsChart
  - [ ] Criar `apps/web/src/components/analytics/CognitivePatternsChart.tsx`
  - [ ] recharts `BarChart` horizontal (layout="vertical")
  - [ ] Props: `data: Array<{ pattern: string, count: number }>`
  - [ ] Top 5 por frequencia

- [ ] **Task 4** (AC: 4) Implementar EmotionalJourneyChart
  - [ ] Criar `apps/web/src/components/analytics/EmotionalJourneyChart.tsx`
  - [ ] recharts `AreaChart` com gradiente
  - [ ] Props: `data: Array<{ step: number, density: number }>`

- [ ] **Task 5** (AC: 5) Implementar AlertAttentionList
  - [ ] Criar `apps/web/src/components/analytics/AlertAttentionList.tsx`
  - [ ] Props: `alerts: AnalyticsAlert[]`
  - [ ] Badges por severidade (critico/atencao/positivo)
  - [ ] Link para `/analytics/students/[id]`
  - [ ] "Ver todos" se > 5

- [ ] **Task 6** (AC: 6) Implementar DivergenceComparisonTable
  - [ ] Criar `apps/web/src/components/analytics/DivergenceComparisonTable.tsx`
  - [ ] Reutilizar `DataTable` do `@eximia/ui`
  - [ ] Colunas: aluno, Kolb teste, Kolb IA, divergencia badge
  - [ ] Reutilizar `CsvExportButton` existente

- [ ] **Task 7** (AC: 7) Integrar graficos com filtros
  - [ ] Todos os componentes recebem dados filtrados da API
  - [ ] Re-render quando filtros mudam

- [ ] **Task 8** (AC: 8, 9) Design system compliance e validacao
  - [ ] Consultar `docs/design-system-guide.md`
  - [ ] Usar tokens Tailwind
  - [ ] `pnpm typecheck` passa

---

## Dev Notes

### Recharts Components Mapping

| Dado | Componente recharts | Props principais |
|---|---|---|
| Profundidade distribuicao | `BarChart` vertical | 7 barras, cores por faixa |
| Mapa Kolb turma | `ScatterChart` | 2 eixos (-1 a +1), tooltip |
| Padroes cognitivos top 5 | `BarChart` horizontal | layout="vertical", top 5 |
| Jornada emocional | `AreaChart` | gradiente, eixo X = etapa |

[Source: docs/architecture/ws1-motor-socratico-architecture.md, Secao 16]

### Engagement Chart Reutilizacao

O `EngagementChart` (LineChart semanal) existente no dashboard sera reutilizado nesta pagina. NAO duplicar — importar do local existente (`apps/web/src/components/dashboard/`).

### Existing Components to Reuse

| Componente | Local | Uso |
|---|---|---|
| `DataTable` | `@eximia/ui` | DivergenceComparisonTable |
| `CsvExportButton` | `apps/web/src/components/dashboard/` | CSV export |
| `EngagementChart` | `apps/web/src/components/dashboard/` | Migrar/reutilizar |
| `Badge` | `@eximia/ui` | Severidade alertas, divergencia |

### File Locations

```
apps/web/src/components/analytics/
├── DepthDistributionChart.tsx       # NOVO
├── KolbTeamScatter.tsx              # NOVO
├── CognitivePatternsChart.tsx       # NOVO
├── EmotionalJourneyChart.tsx        # NOVO
├── AlertAttentionList.tsx           # NOVO
└── DivergenceComparisonTable.tsx    # NOVO
```

### Testing

- Testes E2E no Epic 19 (Story 19.3 — manager-analytics.spec.ts)
- Validar: graficos recharts renderizam (SVG no DOM), alertas exibem severidade

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
