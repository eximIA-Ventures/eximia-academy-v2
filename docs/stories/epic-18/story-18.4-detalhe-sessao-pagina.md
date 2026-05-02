# Story 18.4: Detalhe de Sessao — Pagina `/analytics/sessions/[id]`

**Epic:** [Epic 18 — Analytics & Output Analitico Avancado](../../epics/epic-18-ws1-analytics-output-analitico.md)
**Version:** 1.0
**Created:** 2026-02-15
**Updated:** 2026-02-15
**Author:** River (SM)
**Status:** Ready
**Story Points:** 5
**Priority:** P1
**Blocked By:** Story 18.1 (API endpoints)
**Blocks:** None
**Assigned To:** @dev

---

## User Story

**As a** manager,
**I want** ver a analise detalhada de uma sessao socratica especifica,
**so that** eu entenda os padroes cognitivos e a jornada do aluno naquela sessao.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws1-motor-socratico-architecture.md`, Secao 16 (D4) |
| **PRD Ref** | `docs/prd/evolucao-eximia-academy-workstreams.md` — WS1: Motor Socratico |
| **Stack** | Next.js 15 (RSC + Client), recharts, @eximia/ui (Tabs) |
| **Design Tokens** | `apps/web/src/styles/theme.css` |
| **Risk** | LOW — dados ja disponiveis via Epic 17 |

---

## Acceptance Criteria

- [ ] **AC1:** `SessionHeader` — sessao #, aluno, curso/capitulo, data, interacoes, profundidade, AI detection, QA score
  - Card com metricas resumo
- [ ] **AC2:** Tab "Analise Cognitiva"
  - Padroes detectados (tipo, frequencia, evidencia)
  - Valores implicitos, readiness
  - Suggested question type
  - AI detection indicators (vocabulary diversity, response time, emotional markers)
- [ ] **AC3:** Tab "Jornada"
  - `SessionJourneyChart` — depth progression (LineChart por turno)
  - Arco emocional (confused → defensive → curious → insightful → integrating)
  - Breakthrough moments com trigger e marker (badges inline)
- [ ] **AC4:** Tab "Metricas"
  - Clareza (inicial → final, ganho), densidade emocional (trend)
  - Abstracao (trend), certeza vs exploracao
  - Resistencia (momentos + turnos + superacao)
  - Kolb desta sessao (grasping + transforming → tendencia)
- [ ] **AC5:** Tab "Conversa"
  - `AnnotatedTranscript` — transcript read-only com anotacoes inline do Detector
  - Badges entre mensagens: depth marker, padrao detectado, breakthrough
  - Mensagens do aluno e do Mestre visualmente distintas
- [ ] **AC6:** Auth: manager/admin do tenant
- [ ] **AC7:** `pnpm typecheck` passa

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1) Criar pagina e SessionHeader
  - [ ] Criar `apps/web/src/app/[tenant]/analytics/sessions/[sessionId]/page.tsx`
  - [ ] `SessionHeader` — Card com metricas resumo (sessao, aluno, curso, data, interacoes, profundidade, AI detection, QA score)

- [ ] **Task 2** (AC: 2) Implementar Tab "Analise Cognitiva"
  - [ ] `CognitiveAnalysisPanel` — lista de padroes detectados com evidencia
  - [ ] Valores implicitos, mecanismos de defesa, readiness
  - [ ] AI detection section com indicadores

- [ ] **Task 3** (AC: 3) Implementar Tab "Jornada"
  - [ ] `SessionJourneyChart` — recharts LineChart (X = turno, Y = profundidade)
  - [ ] Arco emocional (texto ou AreaChart simplificado)
  - [ ] Breakthrough moments com badges inline (trigger + marker)

- [ ] **Task 4** (AC: 4) Implementar Tab "Metricas"
  - [ ] `SessionMetricsPanel` — cards com metricas
  - [ ] Clareza: inicial → final (barra de progresso ou delta)
  - [ ] Densidade emocional, abstracao, certeza vs exploracao
  - [ ] Resistencia: momentos + turnos
  - [ ] Kolb sessao: grasping + transforming com estilo derivado

- [ ] **Task 5** (AC: 5) Implementar Tab "Conversa"
  - [ ] `AnnotatedTranscript` — lista de mensagens read-only
  - [ ] Mensagens do aluno (estilo diferente) vs Mestre
  - [ ] Badges entre mensagens: `[depth: 3→4]`, `[pattern: pensamento dicotomico]`, `[breakthrough]`
  - [ ] Dados das anotacoes vem do analytics JSONB da sessao

- [ ] **Task 6** (AC: 6) Auth guard
  - [ ] Verificar role manager/admin no RSC

- [ ] **Task 7** (AC: 7) Validar
  - [ ] `pnpm typecheck` passa
  - [ ] Consultar `docs/design-system-guide.md`

---

## Dev Notes

### Session Journey Chart — Por Turno

```
  7│                  ╱╲
  5│            ╱╲╱╲╱  ╲
  3│      ╱╲╱╲╱
  1│  ╱╲╱
   └──────────────────────
   T1 T3 T5 T7 T9 T11 T13 T15 T17
```

Cada ponto = profundidade do turno. Badges nos breakthroughs.

### Annotated Transcript — Pattern

```
Aluno: "Eu acho que lideranca e sobre controle..."
Mestre: "O que acontece quando o controle nao e possivel?"

[+ depth marker: camada 3 → 4]
[+ pattern: pensamento dicotomico]

Aluno: "Hmm, acho que depende do contexto..."
Mestre: "Que contextos voce imagina?"

[+ breakthrough: mudanca de perspectiva autoiniciada]
```

[Source: docs/architecture/ws1-motor-socratico-architecture.md, Secao 16, D4]

### File Locations

```
apps/web/src/app/[tenant]/analytics/sessions/[sessionId]/
└── page.tsx                        # NOVO

apps/web/src/components/analytics/
├── SessionHeader.tsx               # NOVO
├── CognitiveAnalysisPanel.tsx      # NOVO
├── SessionJourneyChart.tsx         # NOVO
├── SessionMetricsPanel.tsx         # NOVO
└── AnnotatedTranscript.tsx         # NOVO
```

### Testing

- Testes E2E no Epic 19 (Story 19.4 — session-detail-analytics.spec.ts)
- Validar: analise cognitiva + jornada renderizam, transcript com anotacoes

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
