# Story 18.1: API Endpoints de Analytics

**Epic:** [Epic 18 — Analytics & Output Analitico Avancado](../../epics/epic-18-ws1-analytics-output-analitico.md)
**Version:** 1.0
**Created:** 2026-02-15
**Updated:** 2026-02-15
**Author:** River (SM)
**Status:** Ready
**Story Points:** 8
**Priority:** P0 (fundacao)
**Blocked By:** Epic 17 (dados do Detector e Perfilador persistidos)
**Blocks:** Story 18.2a, Story 18.3a, Story 18.4
**Assigned To:** @dev

---

## User Story

**As a** developer,
**I want** 3 API endpoints para servir dados de analytics agregados, perfil individual e sessao,
**so that** as paginas de analytics tenham dados estruturados do backend.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws1-motor-socratico-architecture.md`, Secao 16 |
| **PRD Ref** | `docs/prd/evolucao-eximia-academy-workstreams.md` — WS1: Motor Socratico |
| **Stack** | Next.js 15 App Router, Supabase, Drizzle ORM |
| **DB Tables** | `sessions` (analytics JSONB), `learner_profiles`, `session_messages` |
| **Risk** | MEDIUM — queries agregadas complexas com JSONB |

---

## Acceptance Criteria

- [ ] **AC1:** `GET /api/analytics/aggregate` — Dashboard UC3
  - Query params: `period` (7d, 30d, 90d), `courseId?`, `areaId?`
  - Retorna: summary (sessoes ativas, profundidade media, breakthroughs, AI detection rate), depth_distribution (array 7 camadas), kolb_team (array de pontos 2D), cognitive_patterns_top5, emotional_journey_avg, alerts (array), divergence_table
  - Auth: manager/admin do tenant (via Supabase RLS + middleware)
- [ ] **AC2:** `GET /api/analytics/students/[studentId]` — Perfil UC2
  - Retorna: header (nome, avatar, plano, stats), learner_profile (Kolb, estilo, hints), cognitive_patterns_aggregated (top padroes ultimas 10 sessoes), evolution (depth progression, Kolb trail, clarity), sessions_list (com link), recommendations, divergence (teste vs IA)
  - Auth: manager/admin do tenant
- [ ] **AC3:** `GET /api/analytics/sessions/[sessionId]` — Detalhe sessao
  - Retorna: header (aluno, curso, cap, metricas), cognitive_analysis (Detector), journey (depth progression, emotional arc, breakthroughs), metrics (clareza, densidade, abstracao, Kolb), transcript (mensagens com anotacoes)
  - Auth: manager/admin do tenant
- [ ] **AC4:** Rate limiting nos 3 endpoints (reutilizar pattern existente se houver)
- [ ] **AC5:** Queries otimizadas com indexes adequados
- [ ] **AC6:** Response types definidos com TypeScript (interfaces exportadas)
- [ ] **AC7:** `pnpm typecheck` passa

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 6) Definir response types
  - [ ] Criar `apps/web/src/types/analytics.ts` com interfaces:
    - `AggregateAnalyticsResponse` (summary, depth_distribution, kolb_team, cognitive_patterns, emotional_journey, alerts, divergence)
    - `StudentAnalyticsResponse` (header, profile, patterns, evolution, sessions, recommendations, divergence)
    - `SessionAnalyticsResponse` (header, cognitive_analysis, journey, metrics, transcript)
    - `AnalyticsAlert` (severity: critico/atencao/positivo, type, studentId, studentName, message)

- [ ] **Task 2** (AC: 1) Implementar GET /api/analytics/aggregate
  - [ ] Criar `apps/web/src/app/api/analytics/aggregate/route.ts`
  - [ ] Auth guard: verificar role manager/admin
  - [ ] Parse query params: period, courseId, areaId
  - [ ] Query sessions com analytics JSONB nao-null, filtrado por periodo e tenant
  - [ ] Agregar: count sessoes, media profundidade, count breakthroughs, AI detection rate
  - [ ] Distribuicao profundidade (7 camadas)
  - [ ] Kolb team: buscar learner_profiles, retornar array de pontos 2D
  - [ ] Cognitive patterns: agregar dominant_patterns das sessoes, top 5 por frequencia
  - [ ] Emotional journey: media das emotional_density_progression
  - [ ] Alertas: inatividade > 14d, likely_ai consecutivo, profundidade caindo, resistencia persistente
  - [ ] Divergencia: JOIN learner_profiles com user_profiles, comparar Kolb

- [ ] **Task 3** (AC: 2) Implementar GET /api/analytics/students/[studentId]
  - [ ] Criar `apps/web/src/app/api/analytics/students/[studentId]/route.ts`
  - [ ] Auth guard: manager/admin do tenant
  - [ ] Buscar learner_profile do aluno
  - [ ] Buscar user_profile (Big Five, DISC, Enneagram) se existente
  - [ ] Agregar cognitive_patterns das ultimas 10 sessoes
  - [ ] Evolution: depth progression longitudinal, Kolb trail, clarity
  - [ ] Lista de sessoes com metricas resumo
  - [ ] Recomendacoes server-side baseadas nos dados

- [ ] **Task 4** (AC: 3) Implementar GET /api/analytics/sessions/[sessionId]
  - [ ] Criar `apps/web/src/app/api/analytics/sessions/[sessionId]/route.ts`
  - [ ] Auth guard: manager/admin do tenant
  - [ ] Buscar sessao com analytics JSONB
  - [ ] Buscar mensagens da sessao (transcript)
  - [ ] Montar cognitive_analysis a partir do analytics
  - [ ] Montar journey (depth_progression, emotional_arc, breakthroughs)
  - [ ] Montar metricas (clareza, densidade, abstracao, Kolb)
  - [ ] Transcript com anotacoes inline (depth markers, patterns)

- [ ] **Task 5** (AC: 4) Rate limiting
  - [ ] Aplicar rate limit nos 3 endpoints (reutilizar pattern existente ou criar)
  - [ ] Limitar: 60 req/min por tenant para aggregate, 120 req/min para individual

- [ ] **Task 6** (AC: 5) Otimizar queries
  - [ ] Verificar indexes existentes em sessions, learner_profiles
  - [ ] Adicionar indexes se necessario (sessions.tenant_id + created_at, etc.)

- [ ] **Task 7** (AC: 7) Validar
  - [ ] `pnpm typecheck` passa
  - [ ] `pnpm build` passa

---

## Dev Notes

### Aggregate Query — Pattern

```typescript
const { data: sessions } = await supabase
  .from('sessions')
  .select('id, analytics, created_at, student_id, chapter_id')
  .eq('tenant_id', tenantId)
  .gte('created_at', periodStart)
  .not('analytics', 'is', null)

// Agregar profundidade
const depthDistribution = Array(7).fill(0)
sessions.forEach(s => {
  const depth = s.analytics.depth_reached
  if (depth >= 1 && depth <= 7) depthDistribution[depth - 1]++
})
```

### Alertas — Logica Server-Side

| Tipo | Condicao | Severidade |
|---|---|---|
| Inatividade | 0 sessoes em 14d | critico |
| Deteccao IA | 2+ sessoes consecutivas likely_ai | critico |
| Profundidade caindo | 3 sessoes com trend decrescente | atencao |
| Resistencia | readiness = defensive em 3+ sessoes | atencao |
| Breakthrough streak | 2+ breakthroughs em 3 sessoes consecutivas | positivo |

### Recomendacoes — Pattern

Recomendacoes sao geradas server-side baseadas em regras:
- Divergencia Kolb teste vs IA > 0.5 → "Abordar divergencia em 1:1"
- likely_ai > 2x → "Monitorar deteccao IA"
- Profundidade media < 3 → "Considerar conteudo mais acessivel"
- Breakthrough streak → "Forte em X, desafiar com Y"

### File Locations

```
apps/web/src/app/api/analytics/
├── aggregate/route.ts              # NOVO
├── students/[studentId]/route.ts   # NOVO
└── sessions/[sessionId]/route.ts   # NOVO

apps/web/src/types/
└── analytics.ts                    # NOVO (response types)
```

### Testing

- Testes E2E serao criados no Epic 19 (Story 19.3 — manager-analytics.spec.ts)
- Validar auth guard, dados corretos, filtros funcionais

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
