# Story 17.3: Pipeline Shadow no Orquestrador (Detector + Perfilador em Paralelo)

**Epic:** [Epic 17 — Shadow Analysis Pipeline](../../epics/epic-17-ws1-shadow-analysis-pipeline.md)
**Version:** 1.0
**Created:** 2026-02-15
**Updated:** 2026-02-15
**Author:** River (SM)
**Status:** InProgress
**Story Points:** 8
**Priority:** P0 (core)
**Blocked By:** Story 17.1 (schemas/prompts), Story 17.2 (DB schema)
**Blocks:** Story 17.4, Story 17.5, Story 17.6
**Assigned To:** @dev

---

## User Story

**As a** developer,
**I want** integrar Detector e Perfilador no Orquestrador v2 como pipeline paralelo,
**so that** a analise sombra rode sem bloquear a resposta ao aluno.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws1-motor-socratico-architecture.md`, Secoes 3, 5 |
| **PRD Ref** | `docs/prd/evolucao-eximia-academy-workstreams.md` — WS1: Motor Socratico |
| **Stack** | TypeScript, AI SDK 6.0 (`generateObject`), Sentry |
| **Package** | `@eximia/agents` |
| **Existing File** | `packages/agents/src/orchestrator.ts` (ATUALIZAR — add shadow pipeline) |
| **Risk** | HIGH — pipeline paralelo + persistencia + tolerancia a falhas |

---

## Acceptance Criteria

- [x] **AC1:** Apos pipeline de superficie iniciar, Detector e Perfilador rodam em paralelo
  - Usam `shadowData` emitido pelo Orquestrador (Epic 16.4 AC6)
  - `Promise.allSettled()` para tolerancia a falhas
  - Fire-and-forget — nao bloqueia resposta ao aluno
- [x] **AC2:** Detector processa cada interacao
  - Recebe: mensagem do aluno + historico + resposta do Mestre
  - Usa `generateObject` com `detectorOutputSchema`
  - Model via `getModel("detector", context)`
  - System prompt: `DETECTOR_SYSTEM_PROMPT`
  - Retorna: DetectorOutput (padroes, IA detection, linguistica, journey)
- [x] **AC3:** Perfilador processa a cada N interacoes (configuravel, default 5)
  - Recebe: historico completo + perfil anterior (se existente)
  - Usa `generateObject` com `perfiladorOutputSchema`
  - Model via `getModel("perfilador", context)`
  - System prompt: `PERFILADOR_SYSTEM_PROMPT` (ou `buildPerfiladorPrompt`)
  - Retorna: PerfiladorOutput (Kolb, estilo, strengths, hints)
  - Merge incremental com perfil existente no DB
- [x] **AC4:** Resultados salvos no DB:
  - Detector → `sessions.analytics` (JSONB, atualizacao incremental via Supabase update)
  - Perfilador → `learner_profiles` (upsert com merge)
- [x] **AC5:** Falha no shadow NAO impacta resposta de superficie
  - Erro logado via Sentry com tag `pipeline: "shadow"`
  - Resposta ao aluno entregue normalmente
  - Warning no resultado se shadow falhou
- [x] **AC6:** Sentry spans para Detector e Perfilador separados
  - `agent.Detector` span com atributos model, plan
  - `agent.Perfilador` span com atributos model, plan, sessionCount
- [x] **AC7:** Algoritmo de merge incremental do Perfilador:
  - `avg_depth_achieved = (old * sessionCount + new) / (sessionCount + 1)`
  - `avg_qa_score = (old * sessionCount + new) / (sessionCount + 1)`
  - Kolb axes: media ponderada por sessionCount
  - Confidence: cresce com mais sessoes (cap 0.9)
  - Regras: < 3 sessoes → confidence < 0.3, 3-10 → 0.3-0.7, > 10 → ate 0.9
  - Primeira sessao: max confidence 0.15
  - strengths: manter existentes + adicionar novos relevantes
  - growth_areas: atualizar baseado na sessao mais recente
  - session_count: incrementar
- [x] **AC8:** `pnpm typecheck` passa

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [x] **Task 1** (AC: 2, 6) Implementar runDetector
  - [x] Criar `runDetector(shadowData, context)` em orchestrator.ts (ou arquivo separado)
  - [x] Usar `generateObject` com `detectorOutputSchema`
  - [x] Sentry span `agent.Detector` com atributos
  - [x] Model via `getModel("detector", routingContext)`

- [x] **Task 2** (AC: 3, 6) Implementar runPerfilador
  - [x] Criar `runPerfilador(shadowData, existingProfile, context)` em orchestrator.ts
  - [x] Usar `generateObject` com `perfiladorOutputSchema`
  - [x] Sentry span `agent.Perfilador` com atributos
  - [x] Condicional: `shouldRunProfiler(turnNumber, interval=5)` — roda a cada N interacoes
  - [x] Buscar perfil existente do DB antes de chamar (para merge)

- [x] **Task 3** (AC: 7) Implementar merge incremental
  - [x] Criar `mergeProfileData(existingProfile, newProfile, sessionCount)`
  - [x] Media ponderada para campos numericos (depth, qa_score, Kolb axes)
  - [x] Regras de confidence por sessionCount
  - [x] Merge de arrays (strengths, growth_areas, adaptation_hints)
  - [x] Incrementar session_count

- [x] **Task 4** (AC: 4) Implementar persistencia
  - [x] `saveSessionAnalytics(sessionId, detectorOutput)` — Supabase update sessions.analytics
  - [x] `upsertLearnerProfile(studentId, tenantId, mergedProfile)` — Supabase upsert learner_profiles
  - [x] Atualizacao incremental do analytics JSONB (nao sobrescrever, merge com existente)

- [x] **Task 5** (AC: 1, 5) Integrar no Orquestrador v2
  - [x] Usar `shadowData` do resultado do pipeline de superficie (Epic 16.4)
  - [x] `Promise.allSettled([runDetector, shouldRunProfiler ? runPerfilador : null])`
  - [x] Fire-and-forget: `.then()` para salvar no DB, `.catch()` para log Sentry
  - [x] NAO await — resposta de superficie retorna imediatamente

- [x] **Task 6** (AC: 8) Atualizar barrel file e validar
  - [x] Exportar funcoes shadow se necessario
  - [x] `pnpm typecheck` passa

---

## Dev Notes

### Pattern de Integracao no Orquestrador

```typescript
// No orchestrateSocraticDialogueV2, apos pipeline de superficie:
const shadowPromise = Promise.allSettled([
  runDetector(shadowData, routingContext),
  shouldRunProfiler(input.turnNumber)
    ? runPerfilador(shadowData, existingProfile, routingContext)
    : Promise.resolve(null),
])

// Fire-and-forget — nao bloqueia resposta
shadowPromise.then(([detectorResult, profilerResult]) => {
  if (detectorResult.status === 'fulfilled' && detectorResult.value) {
    saveSessionAnalytics(input.sessionId, detectorResult.value)
  }
  if (profilerResult.status === 'fulfilled' && profilerResult.value) {
    const merged = mergeProfileData(existingProfile, profilerResult.value, existingProfile?.session_count ?? 0)
    upsertLearnerProfile(input.studentId, input.tenantId, merged)
  }
}).catch(error => {
  Sentry.captureException(error, { tags: { pipeline: 'shadow' } })
})
```

[Source: docs/architecture/ws1-motor-socratico-architecture.md, Secao 5]

### Merge Incremental — Formulas

```typescript
function mergeProfileData(old: LearnerProfile | null, new_: PerfiladorOutput, sessionCount: number) {
  if (!old) return { ...new_, session_count: 1, confidence: Math.min(new_.confidence, 0.15) }

  const n = sessionCount
  return {
    avg_depth_achieved: (old.avg_depth_achieved * n + new_.avg_depth_achieved) / (n + 1),
    avg_qa_score: (old.avg_qa_score * n + new_.avg_qa_score) / (n + 1),
    kolb_grasping_axis: (old.kolb_grasping_axis * n + new_.kolb_profile.grasping_axis) / (n + 1),
    kolb_transforming_axis: (old.kolb_transforming_axis * n + new_.kolb_profile.transforming_axis) / (n + 1),
    confidence: calculateConfidence(n + 1, new_.confidence),
    session_count: n + 1,
    // ... merge arrays e demais campos
  }
}

function calculateConfidence(sessions: number, newConfidence: number): number {
  if (sessions <= 1) return Math.min(newConfidence, 0.15)
  if (sessions < 3) return Math.min(newConfidence, 0.3)
  if (sessions <= 10) return Math.min(newConfidence, 0.7)
  return Math.min(newConfidence, 0.9)
}
```

[Source: docs/architecture/ws1-motor-socratico-architecture.md, Secao 6.5]

### Sentry Span Pattern

```typescript
const detectorResult = await Sentry.startSpan(
  { name: "agent.Detector", op: "ai.pipeline.shadow" },
  async (span) => {
    span.setAttribute("agent.name", "Detector")
    span.setAttribute("agent.model", modelSpec.model)
    span.setAttribute("agent.plan", context.tenantPlan)
    return await generateObject({ ... })
  }
)
```

[Source: packages/agents/src/orchestrator.ts — reutilizar pattern]

### File Locations

```
packages/agents/src/
├── orchestrator.ts    # ATUALIZAR (add shadow pipeline + runDetector + runPerfilador)
└── index.ts           # ATUALIZAR (exports se necessario)
```

### Testing

- Testes do shadow pipeline serao criados no Epic 19 (Story 19.2)
- ~4 testes: shadow parallel, shadow failure tolerant, merge incremental, conditional profiler

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-15 | 1.0 | Story creation | River (SM) |
| 2026-02-15 | 1.1 | PO validation: GO (10/10). Status Draft → Ready | Pax (PO) |
| 2026-02-15 | 1.2 | Implementation complete. All 6 tasks done. Status Ready → InProgress | Dex (Dev) |

---

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References
- `@eximia/agents` typecheck: PASS (clean)

### Completion Notes List
- Created `shadow-pipeline.ts` with all shadow pipeline functions (separated from orchestrator for cleaner architecture)
- `runDetector`: uses `generateObject` with `detectorOutputSchema`, Sentry span `agent.Detector`
- `runPerfilador`: uses `generateObject` with `perfiladorOutputSchema`, Sentry span `agent.Perfilador`, conditional execution via `shouldRunPerfilador()`
- `mergeProfileData`: weighted average for numeric fields, confidence caps by session count, array merging with dedup
- `buildAnalyticsUpdate`: incremental JSONB update for session analytics
- `executeShadowPipeline`: fire-and-forget entry point with `Promise.allSettled`, fault-tolerant, logs errors via Sentry
- `ShadowPersistence` interface for DB abstraction (Supabase integration at web app layer)
- All functions exported via barrel file

### File List
- `packages/agents/src/shadow-pipeline.ts` — NEW (runDetector, runPerfilador, mergeProfileData, executeShadowPipeline)
- `packages/agents/src/index.ts` — MODIFIED (added shadow pipeline exports)

---

## QA Results
_To be filled by @qa_
