# Epic 19: WS1 — Quality Framework & Testes

**Version:** 1.0
**Created:** 2026-02-15
**Updated:** 2026-02-15
**Author:** Morgan (PM) com arquitetura de Aria (Architect)
**Status:** Draft
**PRD Reference:** `docs/prd/evolucao-eximia-academy-workstreams.md` — WS1: Motor Socrático
**Architecture Reference:** `docs/architecture/ws1-motor-socratico-architecture.md` — Seções 10, 17
**Workstream:** WS1 (independente de WS2 e WS3)
**Dependency:** Epic 16 (Core Pipeline), Epic 17 (Shadow Pipeline), Epic 18 (Analytics)

---

## Epic Goal

Garantir a qualidade do novo Motor Socrático através de um framework completo de testes (unit, integração e E2E), fixtures MSW multi-provider, Golden Dataset para benchmark, e monitoramento contínuo de qualidade em produção — validando que a troca de modelos e pipeline não degrada a experiência do aluno.

## Epic Context

| Item | Detalhe |
|------|---------|
| **Stack** | Vitest, Playwright, MSW v2, Zod, recharts |
| **Providers Mockados** | OpenAI (api.openai.com), DeepSeek (api.deepseek.com), Anthropic legado |
| **Total Estimado** | ~82 testes (30 unit schemas, 25 model router, 10 orchestrator, 10 prompts, 7 E2E) |
| **Fixtures** | 7 novos fixtures (mestre, polidor, guardiao, guardiao-rejected, detector, perfilador, + seed data) |
| **Depende de** | Epic 16, 17, 18 (todos os componentes testáveis devem existir) |

---

## Existing System Context

### Infrastructure Already in Place

| Component | Status | Reference |
|-----------|--------|-----------|
| Vitest config | Implementado | `packages/agents/vitest.config.ts` |
| Playwright config | Implementado | `apps/web/playwright.config.ts` |
| MSW v2 setupServer | Implementado | `apps/web/src/mocks/handlers.ts` |
| instrumentation.ts (E2E_TESTING) | Implementado | `apps/web/src/instrumentation.ts` |
| Fixtures legado (Harven_*) | Implementado | `apps/web/src/mocks/fixtures/` |
| E2E seed helpers | Implementado | `tests/e2e/helpers/seed.ts` |
| Fake ANTHROPIC_API_KEY | Implementado | `playwright.config.ts` env |

### What This Epic Changes

```
Testes existentes (legado):
├── Fixtures Harven_* (Socrates, Editor, Tester, Analyst, Creator)
├── MSW handler: api.anthropic.com/v1/messages
├── E2E: student-journey.spec.ts (pipeline v1)
└── Unit: schemas existentes

Testes novos (WS1):
├── Fixtures Eximia_* (Mestre, Polidor, Guardião, Detector, Perfilador)
├── MSW handlers: api.openai.com + api.deepseek.com (multi-provider)
├── E2E Onda 1: student-journey-v2, guardian-retry, manager-analytics
├── E2E Onda 2: smart-closing, student-profile, session-detail, ai-detection
├── Unit: 5 schemas + model router (tabela + fallback + invariant) + orchestrator v2 + prompts
├── Golden Dataset: 50-100 conversas de benchmark
└── Quality Dashboard: monitoramento contínuo em produção
```

---

## Enhancement Details

### Estratégia de Testes — 3 Camadas

```
┌─────────────────────────────────────────────────────┐
│  CAMADA 3: E2E (Playwright + MSW multi-handler)     │
│  Fluxo completo: login → sessão → analytics          │
│  Mock: OpenAI + DeepSeek via MSW server-side         │
├─────────────────────────────────────────────────────┤
│  CAMADA 2: Integração (Vitest)                       │
│  Orchestrator v2, Model Router, pipeline completo    │
│  Mock: generateObject do AI SDK                      │
├─────────────────────────────────────────────────────┤
│  CAMADA 1: Unit (Vitest)                             │
│  Schemas Zod, prompts, fixtures, pure functions      │
│  Sem mocks externos                                  │
└─────────────────────────────────────────────────────┘
```

### Framework de Avaliação de Qualidade — 3 Fases

```
FASE 1: BENCHMARK          FASE 2: SHADOW A/B      FASE 3: PRODUÇÃO
(pré-lançamento)           (soft launch)           (contínuo)

Golden Dataset 50-100  →   10-20% dual pipeline →  Quality Dashboard
Human Blind Eval       →   Comparador automático → Model Degradation Alert
Quality Scorecard      →   200+ comparações      → Monthly Human Sample

GO/NO-GO decision      →   Confirma/Reverte      → Manutenção contínua
```

### Success Criteria

- [ ] ~82 testes passando (30 schemas + 25 router + 10 orchestrator + 10 prompts + 7 E2E)
- [ ] MSW intercepta OpenAI + DeepSeek (multi-provider)
- [ ] Fixtures tipadas com schemas Zod (CI falha se schema muda sem atualizar fixture)
- [ ] Golden Dataset com 50+ conversas cobrindo todas as dimensões
- [ ] Quality Dashboard com métricas de produção
- [ ] E2E cobre: sessão v2, retry Guardião, analytics dashboard, perfil aluno

---

## Stories

---

### Story 19.1: Fixtures MSW Multi-Provider para Novos Agentes

**As a** developer,
**I want** fixtures tipadas para os 5 novos agentes e MSW handlers multi-provider,
**so that** testes E2E interceptem chamadas a OpenAI e DeepSeek corretamente.

**Architecture Reference:** ws1-motor-socratico-architecture.md, Seções 17.2-17.3, 17.6

**Story Points:** 5
**Priority:** P0 (fundação testes)
**Risk:** LOW — fixtures e handlers

#### Acceptance Criteria

- [ ] **AC1:** Fixtures criadas em `apps/web/src/mocks/fixtures/`:
  - `mestre.ts` — MestreOutput conforme schema (depth_layer, question_type, quality_checks)
  - `polidor.ts` — PolidorOutput conforme schema (2 parágrafos, ends_with_question)
  - `guardiao.ts` — GuardiaoOutput APPROVED (score 0.88, todos critérios pass)
  - `guardiao-rejected.ts` — GuardiaoOutput REJECTED (score 0.45, feedback para retry)
  - `detector.ts` — DetectorOutput conforme schema (cognitive_patterns, ai_detection, linguistic)
  - `perfilador.ts` — PerfiladorOutput conforme schema (Kolb, engagement, strengths)
- [ ] **AC2:** Fixtures tipadas com schemas Zod (import schema, validate fixture)
- [ ] **AC3:** MSW handler `detectAgent()` atualizado:
  - `Eximia_Mestre` → mestreFixture
  - `Eximia_Polidor` → polidorFixture
  - `Eximia_Guardiao` → guardiaoFixture (ou rejected variant)
  - `Eximia_Detector` → detectorFixture
  - `Eximia_Perfilador` → perfiladorFixture
- [ ] **AC4:** MSW intercepta 2 endpoints adicionais:
  - `http.post("https://api.openai.com/v1/chat/completions", handler)`
  - `http.post("https://api.deepseek.com/v1/chat/completions", handler)`
- [ ] **AC5:** Handler Anthropic legado mantido durante transição
- [ ] **AC6:** Env vars adicionais no `playwright.config.ts`:
  - `OPENAI_API_KEY: "sk-e2e-mock-openai-not-real"`
  - `DEEPSEEK_API_KEY: "sk-e2e-mock-deepseek-not-real"`
- [ ] **AC7:** Coexistência `Harven_*` + `Eximia_*` no handler

#### Technical Notes

```typescript
// apps/web/src/mocks/handlers.ts
function detectAgent(system: string): Record<string, unknown> {
  // Novo pipeline (Eximia)
  if (system.includes("Eximia_Mestre")) return mestreFixture
  if (system.includes("Eximia_Polidor")) return polidorFixture
  if (system.includes("Eximia_Guardiao")) return guardiaoFixture
  if (system.includes("Eximia_Detector")) return detectorFixture
  if (system.includes("Eximia_Perfilador")) return perfiladorFixture

  // Pipeline legado (Harven) — remover após migração completa
  if (system.includes("Harven_Socrates")) return socratesFixture
  // ...
}

export const handlers = [
  http.post("https://api.openai.com/v1/chat/completions", openaiHandler),
  http.post("https://api.deepseek.com/v1/chat/completions", deepseekHandler),
  http.post("https://api.anthropic.com/v1/messages", legacyAnthropicHandler),
]
```

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Fixtures, handlers, config |
| **@qa (QA)** | Validar que fixtures seguem schemas |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | Fixtures validam contra schemas Zod | Yes |
| Pre-Commit | `pnpm typecheck` passa | Yes |

---

### Story 19.2: Unit Tests — Schemas, Model Router e Orchestrator

**As a** developer,
**I want** testes unitários para schemas Zod, Model Router e Orchestrator v2,
**so that** a lógica core do pipeline seja validada automaticamente.

**Architecture Reference:** ws1-motor-socratico-architecture.md, Seções 17.4-17.5

**Story Points:** 8
**Priority:** P0 (core quality)
**Risk:** LOW — testes puros

#### Acceptance Criteria

- [ ] **AC1:** Schema tests (~30 testes) em `packages/agents/tests/schemas/`:
  - `mestre.test.ts` — MestreOutput: valid + invalid (depth_layer fora de range, content vazio, question_type inválido)
  - `polidor.test.ts` — PolidorOutput: valid + paragraph_count ≠ 2 + ends_with_question false
  - `guardiao.test.ts` — GuardiaoOutput: APPROVED valid + REJECTED valid + score fora de range
  - `detector.test.ts` — DetectorOutput: valid + probability fora de range + verdict inválido
  - `perfilador.test.ts` — PerfiladorOutput: valid + kolb axes fora de range + confidence > 1
- [ ] **AC2:** Model Router tests (~25 testes) em `packages/agents/tests/model-router.test.ts`:
  - Tabela de decisão exaustiva: 15 combinações (5 agentes × 3 planos)
  - Override por interaction_type: Standard quiz → mini, Standard socratic → gpt-4.1, Premium quiz → gpt-4.1
  - Guardião invariant: sempre gpt-4.1 em todos os planos
  - Fallback chain: OpenAI down → DeepSeek, DeepSeek down → gpt-4.1-nano, all down → throws
- [ ] **AC3:** Orchestrator v2 tests (~10 testes) em `packages/agents/tests/orchestrator-v2.test.ts`:
  - Happy path: Mestre → Polidor → Guardião APPROVED
  - Retry 1x: Guardião REJECTED → feedback → APPROVED na 2ª tentativa
  - Max retries: 2x REJECTED → mantém best response + warning
  - Shadow parallel: Detector + Perfilador rodam em paralelo
  - Shadow failure tolerant: Detector falha → superfície continua
  - Fechamento inteligente: Mestre `is_closing: true` → resultado correto
- [ ] **AC4:** Prompt tests (~10 testes) em `packages/agents/tests/prompts/`:
  - Identifier `Eximia_Mestre` presente no prompt
  - Identifier `Eximia_Polidor` presente
  - Identifier `Eximia_Guardiao` presente
  - Identifier `Eximia_Detector` presente
  - Identifier `Eximia_Perfilador` presente
  - Context injection: conteúdo do capítulo injetado corretamente
  - Context injection: perfil do aluno injetado se existente
  - Context injection: feedback do Guardião injetado se retry
- [ ] **AC5:** Todos os testes passam com `pnpm test`
- [ ] **AC6:** Coverage mínimo: 80% nos arquivos testados

#### Technical Notes

```typescript
// Model Router — tabela de decisão
describe("Model Router - Routing Table", () => {
  const cases: Array<[TenantPlan, AgentId, string, string]> = [
    ["essencial", "mestre",     "openai",   "gpt-4.1-mini"],
    ["essencial", "polidor",    "deepseek", "deepseek-chat"],
    ["essencial", "guardiao",   "openai",   "gpt-4.1"],
    // ... 15 combinações
  ]

  it.each(cases)(
    "plan=%s agent=%s → provider=%s model=%s",
    (plan, agent, expectedProvider, expectedModel) => {
      const result = getModelSpec(agent, { tenantPlan: plan })
      expect(result.provider).toBe(expectedProvider)
      expect(result.model).toBe(expectedModel)
    }
  )
})
```

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar testes |
| **@qa (QA)** | Review cobertura |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm test` passa | Yes |
| Pre-PR | Coverage >= 80% | Yes |

---

### Story 19.3: E2E Tests — Onda 1 (Launch)

**As a** developer,
**I want** testes E2E que validem o fluxo completo do novo pipeline,
**so that** a sessão socrática v2 funcione end-to-end em ambiente mockado.

**Architecture Reference:** ws1-motor-socratico-architecture.md, Seção 17.7

**Story Points:** 8
**Priority:** P0 (launch readiness)
**Risk:** MEDIUM — E2E complexos com multi-provider mocking

#### Acceptance Criteria

- [ ] **AC1:** `student-journey-v2.spec.ts`
  - Login aluno → navegar curso → capítulo → iniciar sessão → 3 mensagens
  - Pipeline v2 (5 agentes mockados via MSW)
  - Resposta visível no chat (texto do Polidor)
  - Session status: active → completed
- [ ] **AC2:** `guardian-retry.spec.ts`
  - 1ª resposta: Guardião REJECTED (fixture `guardiao-rejected`)
  - 2ª resposta: Guardião APPROVED
  - Aluno recebe resposta refinada (não a rejeitada)
  - Retry transparente (aluno não vê)
- [ ] **AC3:** `manager-analytics.spec.ts`
  - Login manager → navegar `/analytics`
  - Summary cards renderizados com dados
  - Gráficos recharts renderizados (verifica SVG no DOM)
  - Filtros mudam dados
- [ ] **AC4:** Seed data para analytics em `tests/e2e/helpers/seed.ts`:
  - Sessions com analytics JSONB populado
  - Learner profile com dados do Perfilador
  - Detector aggregates (top padrões)
- [ ] **AC5:** Todos os E2E passam com `pnpm e2e`
- [ ] **AC6:** Tempo total dos 3 specs < 120 segundos

#### Technical Notes

Seed data deve ser inserido antes dos testes via helper functions. O MSW handler detecta agentes pelo identifier no system prompt.

```typescript
// tests/e2e/helpers/seed.ts — extensão
const ANALYTICS_SEED = {
  sessions: [{
    id: "...",
    studentId: TEST_USERS[0].id,
    analytics: {
      depth_reached: 5,
      breakthrough_moments: 2,
      emotional_journey: ["confused", "curious", "insightful"],
      depth_progression: [1, 2, 3, 3, 4, 5, 4, 5, 5, 5, 6, 5, 5, 5, 5],
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

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar specs + seed data |
| **@qa (QA)** | Validar cenários E2E |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-PR | 3 E2E specs passam | Yes |
| Pre-PR | Tempo total < 120s | No (warning) |

---

### Story 19.4: E2E Tests — Onda 2 (Fast Follow)

**As a** developer,
**I want** testes E2E adicionais para smart closing, perfil do aluno, detalhe de sessão e AI detection,
**so that** features avançadas do WS1 sejam validadas automaticamente.

**Architecture Reference:** ws1-motor-socratico-architecture.md, Seção 17.7

**Story Points:** 5
**Priority:** P1 (fast follow)
**Risk:** LOW — padrão E2E já estabelecido na Onda 1

#### Acceptance Criteria

- [ ] **AC1:** `smart-closing.spec.ts`
  - Mestre retorna `is_closing: true`
  - UI mostra resumo de encerramento
  - Session status: completed
- [ ] **AC2:** `student-profile-analytics.spec.ts`
  - Manager navega `/analytics/students/[id]`
  - 4 tabs renderizam (Perfil IA, Padrões, Evolução, Sessões)
  - Dados do seed visíveis
- [ ] **AC3:** `session-detail-analytics.spec.ts`
  - Manager navega `/analytics/sessions/[id]`
  - Análise cognitiva + jornada renderizam
  - Transcript com anotações visíveis
- [ ] **AC4:** `ai-detection-flag.spec.ts`
  - Sessão com `likely_ai` verdict
  - Badge visível no dashboard e perfil do aluno
- [ ] **AC5:** Todos os 4 specs passam com `pnpm e2e`

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar specs |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-PR | 4 E2E specs passam | Yes |

---

### Story 19.5: Golden Dataset & Quality Benchmark (Fase 1)

**As a** product manager,
**I want** um Golden Dataset e framework de benchmark para avaliar a qualidade do novo pipeline,
**so that** possamos validar a troca de modelos antes do launch.

**Architecture Reference:** ws1-motor-socratico-architecture.md, Seção 10 (Fase 1)

**Story Points:** 5
**Priority:** P1 (pré-launch)
**Risk:** MEDIUM — requer golden dataset curado manualmente

#### Acceptance Criteria

- [ ] **AC1:** Golden Dataset com 50+ conversas em `tests/benchmarks/golden-dataset/`
  - Cobertura: 4 tipos de interação (socratic_dialogue, quiz, scenario, assignment)
  - Cobertura: hard skill + soft skill
  - Cobertura: 4 perfis (reflexivo longo, impulsivo curto, resistente, usando IA)
  - Cobertura: profundidade superficial (1-2), média (3-5), avançada (6-7)
  - Cobertura: casos-limite ("não sei", ofensivo, resposta perfeita, off-topic)
- [ ] **AC2:** Script de benchmark em `tests/benchmarks/run-benchmark.ts`
  - Roda Golden Dataset em pipeline Standard + Premium (referência)
  - Gera output por combo
  - Calcula métricas automáticas: Guardião avg score, rejection rate, schema compliance, latência P95
- [ ] **AC3:** Quality Scorecard interface:
  - `human_eval_avg`, `guardian_avg_score`, `guardian_rejection_rate`, `guardian_false_positive_rate`, `guardian_false_negative_rate`, `schema_compliance_rate`, `p95_latency_ms`, `quality_delta_vs_premium`
- [ ] **AC4:** Critérios de aprovação documentados:
  - Score médio >= 4.0/5.0
  - Delta vs Premium <= -0.3
  - Schema compliance >= 98%
- [ ] **AC5:** Relatório gerado em `tests/benchmarks/reports/`

#### Technical Notes

O Golden Dataset é um conjunto de conversas curadas manualmente que cobrem as dimensões definidas na arquitetura. O benchmark é executado contra APIs reais (não mockado) para validar qualidade real.

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Script de benchmark |
| **@qa (QA)** | Curar Golden Dataset |
| **@pm (Morgan)** | Definir critérios de GO/NO-GO |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Launch | Score >= 4.0 e compliance >= 98% | Yes (GO/NO-GO) |

---

## Dependency Graph

```
    Epic 16 + 17 + 18 (componentes testáveis)
                    ↓
Story 19.1 (Fixtures + MSW multi-provider)
                    ↓
Story 19.2 (Unit Tests)     Story 19.3 (E2E Onda 1)
                                 ↓
                         Story 19.4 (E2E Onda 2)

Story 19.5 (Golden Dataset) — independente (pode ser paralelo)
```

**Ordem de execução sugerida:** 19.1 → (19.2 + 19.3 em paralelo) → 19.4 | 19.5 independente

---

## Compatibility Requirements

- [ ] Fixtures legado (Harven_*) mantidas durante transição
- [ ] MSW handler suporta ambos pipelines (Harven_ + Eximia_)
- [ ] Testes existentes não quebram
- [ ] E2E seed data é aditivo (não altera dados existentes)

---

## Risk Mitigation

| Risco | Impacto | Mitigação | Rollback |
|---|---|---|---|
| Fixtures desincronizam dos schemas | Médio | Fixtures tipadas com Zod, CI falha se schema muda | Atualizar fixtures no mesmo PR |
| E2E flaky por timing | Médio | waitForSelector, retries configurados | Aumentar timeouts |
| Golden Dataset enviesado | Médio | Revisão humana de 3-5 avaliadores | Expandir dataset iterativamente |
| Benchmark falha no GO/NO-GO | Alto | Iterar prompts antes do launch | Postergar launch até aprovação |

---

## New File Locations

```
apps/web/src/mocks/fixtures/
├── mestre.ts                    # NOVO
├── polidor.ts                   # NOVO
├── guardiao.ts                  # NOVO
├── guardiao-rejected.ts         # NOVO
├── detector.ts                  # NOVO
└── perfilador.ts                # NOVO

packages/agents/tests/
├── schemas/
│   ├── mestre.test.ts           # NOVO
│   ├── polidor.test.ts          # NOVO
│   ├── guardiao.test.ts         # NOVO
│   ├── detector.test.ts         # NOVO
│   └── perfilador.test.ts       # NOVO
├── model-router.test.ts         # NOVO
├── orchestrator-v2.test.ts      # NOVO
└── prompts/
    ├── mestre-prompt.test.ts    # NOVO
    ├── polidor-prompt.test.ts   # NOVO
    └── ...                      # NOVO

tests/e2e/specs/
├── student-journey-v2.spec.ts          # NOVO (Onda 1)
├── guardian-retry.spec.ts              # NOVO (Onda 1)
├── manager-analytics.spec.ts           # NOVO (Onda 1)
├── smart-closing.spec.ts              # NOVO (Onda 2)
├── student-profile-analytics.spec.ts   # NOVO (Onda 2)
├── session-detail-analytics.spec.ts    # NOVO (Onda 2)
└── ai-detection-flag.spec.ts           # NOVO (Onda 2)

tests/benchmarks/
├── golden-dataset/                     # NOVO
│   ├── socratic-dialogue/
│   ├── quiz/
│   ├── scenario/
│   └── assignment/
├── run-benchmark.ts                    # NOVO
└── reports/                            # NOVO (gitignored)
```

---

## Resumo de Cobertura

| Camada | Escopo | Qtd estimada | Framework |
|---|---|---|---|
| Unit — Schemas | 5 schemas (valid + invalid) | ~30 testes | Vitest |
| Unit — Model Router | Tabela 15 combos + override + invariant + fallback | ~25 testes | Vitest |
| Unit — Orchestrator v2 | 6 cenários pipeline | ~10 testes | Vitest |
| Unit — Prompts | Identifiers + context injection | ~10 testes | Vitest |
| E2E — Onda 1 | student-journey-v2 + guardian-retry + manager-analytics | 3 specs | Playwright + MSW |
| E2E — Onda 2 | smart-closing + student-profile + session-detail + ai-detection | 4 specs | Playwright + MSW |
| **Total** | | **~82 testes** | |

---

## Definition of Done

- [ ] ~82 testes passando
- [ ] MSW intercepta OpenAI + DeepSeek + Anthropic (legado)
- [ ] Fixtures tipadas com schemas Zod
- [ ] E2E Onda 1: 3 specs passando (launch readiness)
- [ ] E2E Onda 2: 4 specs passando (fast follow)
- [ ] Golden Dataset com 50+ conversas
- [ ] Benchmark executável com relatório automático
- [ ] `pnpm test` e `pnpm e2e` passam
- [ ] Coverage >= 80% nos arquivos core

---

## Total Story Points

| Story | Título | SP | Dependência |
|-------|--------|---:|-------------|
| 19.1 | Fixtures MSW Multi-Provider | 5 | Epic 16, 17 |
| 19.2 | Unit Tests (Schemas, Router, Orchestrator) | 8 | 19.1 |
| 19.3 | E2E Onda 1 (Launch) | 8 | 19.1 |
| 19.4 | E2E Onda 2 (Fast Follow) | 5 | 19.3 |
| 19.5 | Golden Dataset & Benchmark | 5 | — |
| **Total** | | **31** | |

---

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-02-15 | 1.0 | Criação do épico | Morgan (PM) |
