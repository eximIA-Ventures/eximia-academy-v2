# Story 19.3: E2E Tests — Onda 1 (Launch)

**Epic:** [Epic 19 — Quality Framework & Testes](../../epics/epic-19-ws1-quality-framework-testes.md)
**Version:** 1.0
**Created:** 2026-02-15
**Updated:** 2026-02-15
**Author:** River (SM)
**Status:** Ready
**Story Points:** 8
**Priority:** P0 (launch readiness)
**Blocked By:** Story 19.1 (fixtures + MSW handlers)
**Blocks:** Story 19.4
**Assigned To:** @dev

---

## User Story

**As a** developer,
**I want** testes E2E que validem o fluxo completo do novo pipeline,
**so that** a sessao socratica v2 funcione end-to-end em ambiente mockado.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws1-motor-socratico-architecture.md`, Secao 17.7 |
| **PRD Ref** | `docs/prd/evolucao-eximia-academy-workstreams.md` — WS1: Motor Socratico |
| **Stack** | Playwright, MSW v2, Next.js 15 |
| **Existing Config** | `apps/web/playwright.config.ts` |
| **Existing E2E** | `tests/e2e/` (specs existentes) |
| **Risk** | MEDIUM — E2E complexos com multi-provider mocking |

---

## Acceptance Criteria

- [ ] **AC1:** `student-journey-v2.spec.ts`
  - Login aluno → navegar curso → capitulo → iniciar sessao → 3 mensagens
  - Pipeline v2 (5 agentes mockados via MSW)
  - Resposta visivel no chat (texto do Polidor)
  - Session status: active → completed
- [ ] **AC2:** `guardian-retry.spec.ts`
  - 1a resposta: Guardiao REJECTED (fixture `guardiao-rejected`)
  - 2a resposta: Guardiao APPROVED
  - Aluno recebe resposta refinada (nao a rejeitada)
  - Retry transparente (aluno nao ve)
- [ ] **AC3:** `manager-analytics.spec.ts`
  - Login manager → navegar `/analytics`
  - Summary cards renderizados com dados
  - Graficos recharts renderizados (verifica SVG no DOM)
  - Filtros mudam dados
- [ ] **AC4:** Seed data para analytics em `tests/e2e/helpers/seed.ts`:
  - Sessions com analytics JSONB populado
  - Learner profile com dados do Perfilador
  - Detector aggregates (top padroes)
- [ ] **AC5:** Todos os E2E passam com `pnpm e2e`
- [ ] **AC6:** Tempo total dos 3 specs < 120 segundos

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 4) Criar seed data analytics
  - [ ] Estender `tests/e2e/helpers/seed.ts` com dados de analytics
  - [ ] Sessions seed com analytics JSONB:
    ```typescript
    {
      depth_reached: 5,
      breakthrough_moments: 2,
      emotional_journey: ["confused", "curious", "insightful"],
      depth_progression: [1, 2, 3, 3, 4, 5, 4, 5, 5, 5, 6, 5, 5, 5, 5],
      kolb_session_vector: { grasping_axis: -0.3, transforming_axis: 0.4, indicators_count: 8 },
    }
    ```
  - [ ] Learner profile seed com dados completos
  - [ ] Inserir via Supabase service role antes dos testes

- [ ] **Task 2** (AC: 1) Implementar student-journey-v2.spec.ts
  - [ ] Login como student (seed user)
  - [ ] Navegar curso → capitulo → sessao
  - [ ] Enviar 3 mensagens
  - [ ] Verificar: resposta aparece no chat (texto do Polidor)
  - [ ] Verificar: session status muda para completed (ou active)
  - [ ] MSW intercepta OpenAI/DeepSeek (5 agentes mockados)

- [ ] **Task 3** (AC: 2) Implementar guardian-retry.spec.ts
  - [ ] Configurar MSW para retornar guardiao-rejected na 1a chamada, guardiao APPROVED na 2a
  - [ ] Enviar mensagem
  - [ ] Verificar: aluno recebe resposta (nao a rejeitada)
  - [ ] Verificar: retry transparente (sem indicacao visual)
  - [ ] Pattern: request counter no handler para alternar fixtures

- [ ] **Task 4** (AC: 3) Implementar manager-analytics.spec.ts
  - [ ] Login como manager (seed user)
  - [ ] Navegar para `/analytics`
  - [ ] Verificar: 4 summary cards renderizados com dados numericos
  - [ ] Verificar: graficos recharts renderizados (SVG elements no DOM)
  - [ ] Verificar: filtro de periodo muda dados
  - [ ] Seed data deve estar presente no DB

- [ ] **Task 5** (AC: 5, 6) Executar e validar
  - [ ] `pnpm e2e` passa (3 specs)
  - [ ] Tempo total < 120s (otimizar se necessario)
  - [ ] Configurar retries no playwright.config.ts se necessario

---

## Dev Notes

### MSW Multi-Provider — Retry Pattern

Para o guardian-retry test, o handler precisa de estado:

```typescript
// Em handlers.ts ou no setup do test
let guardiaoCallCount = 0

function detectAgent(system: string) {
  if (system.includes("Eximia_Guardiao")) {
    guardiaoCallCount++
    return guardiaoCallCount === 1 ? guardiaoRejectedFixture : guardiaoFixture
  }
  // ... outros agentes
}
```

### Seed Data Pattern

O projeto ja tem `tests/e2e/helpers/seed.ts`. Estender com:

```typescript
export const ANALYTICS_SEED = {
  sessions: [{
    id: "seed-session-1",
    studentId: TEST_USERS[0].id,
    analytics: {
      depth_reached: 5,
      breakthrough_moments: 2,
      emotional_journey: ["confused", "curious", "insightful"],
      depth_progression: [1, 2, 3, 4, 5],
      kolb_session_vector: { grasping_axis: -0.3, transforming_axis: 0.4, indicators_count: 8 },
    },
  }],
  learnerProfile: {
    studentId: TEST_USERS[0].id,
    engagement_style: "reflective",
    avg_depth_achieved: 4.8,
    kolb_grasping_axis: -0.2,
    kolb_transforming_axis: 0.3,
    confidence: 0.65,
  },
}
```

[Source: tests/e2e/helpers/seed.ts — pattern existente]

### Recharts Verification Pattern

```typescript
// Verificar que graficos recharts renderizaram
await expect(page.locator('.recharts-bar-rectangle')).toHaveCount({ minimum: 1 })
await expect(page.locator('svg.recharts-surface')).toBeVisible()
```

### File Locations

```
tests/e2e/specs/
├── student-journey-v2.spec.ts    # NOVO
├── guardian-retry.spec.ts        # NOVO
└── manager-analytics.spec.ts     # NOVO

tests/e2e/helpers/
└── seed.ts                       # ATUALIZAR (analytics seed)
```

### Testing

- 3 specs Onda 1 sao requisito para launch
- Tempo target: < 120s total (40s por spec)
- Retries: 1 (configurar no playwright.config.ts)

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
