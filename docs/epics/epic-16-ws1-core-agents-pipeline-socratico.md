# Epic 16: WS1 — Core Agents & Pipeline Socrático (Reconstrução Total)

**Version:** 1.0
**Created:** 2026-02-15
**Updated:** 2026-02-15
**Author:** Morgan (PM) com arquitetura de Aria (Architect)
**Status:** Draft
**PRD Reference:** `docs/prd/evolucao-eximia-academy-workstreams.md` — WS1: Motor Socrático
**Architecture Reference:** `docs/architecture/ws1-motor-socratico-architecture.md` — Seções 1-9, 13-15
**Workstream:** WS1 (independente de WS2 e WS3)

---

## Epic Goal

Reconstruir completamente o pipeline socrático com 3 novos agentes de superfície (Mestre, Polidor, Guardião), novo Orquestrador v2 com retry loop, e Model Router multi-provider (OpenAI + DeepSeek) com 3 planos de tenant — substituindo integralmente os agentes legado (Socrates, Editor, Tester, Analyst).

## Epic Context

| Item | Detalhe |
|------|---------|
| **Stack** | Next.js 15, AI SDK 6.0, OpenAI gpt-4.1/gpt-4.1-mini, DeepSeek V3, Drizzle ORM |
| **DB Tables** | `sessions` (existente, atualizar), `tenants` (existente, add plan field) |
| **AI Agents** | Mestre (NOVO), Polidor (NOVO), Guardião (NOVO), Orquestrador v2 (REESCREVER) |
| **Providers** | OpenAI (gpt-4.1, gpt-4.1-mini), DeepSeek V3 (OpenAI-compatible) |
| **Design Tokens** | `apps/web/src/styles/theme.css` |
| **Roles Impactados** | student (diálogo), manager (config plano) |
| **Package** | `@eximia/agents` |

---

## Existing System Context

### Infrastructure Already in Place

| Component | Status | Reference |
|-----------|--------|-----------|
| Orchestrator (v1) | Implementado (substituir) | `packages/agents/src/orchestrator.ts` |
| Socrates Agent | Implementado (deletar) | `packages/agents/src/socrates.ts` |
| Editor Agent | Implementado (deletar) | `packages/agents/src/editor.ts` |
| Tester Agent | Implementado (deletar) | `packages/agents/src/tester.ts` |
| Analyst Agent | Implementado (deletar) | `packages/agents/src/analyst.ts` |
| Profiler Agent | Implementado (deletar) | `packages/agents/src/profiler.ts` |
| Creator Agent | Implementado (manter — WS2) | `packages/agents/src/creator.ts` |
| Schemas Zod existentes | Implementado (substituir) | `packages/agents/src/schemas/` |
| Prompts existentes | Implementado (substituir) | `packages/agents/src/prompts/` |
| Types | Implementado (atualizar) | `packages/agents/src/types.ts` |
| AI SDK generateObject | Implementado (reutilizar) | Via `ai` SDK |
| Sentry spans | Implementado (reutilizar) | Observability existente |
| MSW E2E mocking | Implementado (estender) | `apps/web/src/mocks/handlers.ts` |
| Chat UI | Implementado (manter) | `apps/web/src/app/[tenant]/courses/[courseId]/chapters/[chapterId]/session/` |
| API Route sessão | Implementado (migrar) | `apps/web/src/app/api/sessions/` |

### Current Pipeline Flow

```
Student message
    → Orchestrator v1
    → Socrates (Claude Sonnet) → Editor → Tester
    → Se REJECTED: retry com feedback
    → Analyst (pós-sessão) → Profiler (pós-sessão)
    → Resposta ao aluno
```

### What This Epic Changes

```
Student message
    → Orquestrador v2
    → SUPERFÍCIE (síncrona):
        → Mestre (gpt-4.1 ou mini) → Polidor (DeepSeek V3) → Guardião (sempre gpt-4.1)
        → Se REJECTED: retry loop (max 2x), mantém best response
    → Resposta ao aluno

    (Shadow pipeline — Epic 17)

Providers:
    → Model Router seleciona modelo por agente + plano do tenant
    → 3 planos: Essencial ($0.11) / Standard ($0.29) / Premium ($0.34)
    → Fallback chain automático se provider indisponível
```

---

## Enhancement Details

### Core Pipeline: Mestre → Polidor → Guardião

```
┌──────────────────────────────────────────────────────────┐
│  RETRY LOOP (max 2x)                                     │
│                                                          │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐ │
│  │   MESTRE     │──▶│   POLIDOR    │──▶│  GUARDIÃO    │ │
│  │              │   │              │   │              │ │
│  │ • 7 camadas  │   │ • 2 parágrafos│   │ • 7 critérios│ │
│  │ • 6 tipos Q  │   │ • Sem labels │   │ • Score 0-1  │ │
│  │ • 5 técnicas │   │ • 80-200 words│   │ • Verdict    │ │
│  │ • Resistência│   │ • Naturalidade│   │              │ │
│  │ • Fechamento │   │              │   │              │ │
│  └──────────────┘   └──────────────┘   └──────┬───────┘ │
│                                               │          │
│                              REJECTED ◄───────┤          │
│                              (feedback loop)  │          │
│                                          APPROVED        │
└──────────────────────────────────────────┬───────────────┘
                                           │
                                     BEST RESPONSE
```

### Model Router: Seleção por Agente + Plano

```
┌─────────────────────────────────────────────────┐
│                 MODEL ROUTER                     │
│                                                  │
│  Inputs:                                         │
│  ├─ agent_id (mestre, polidor, guardiao)         │
│  ├─ interaction_type (socratic, quiz...)         │
│  ├─ tenant_plan (essencial, standard, premium)   │
│  └─ fallback_config                              │
│                                                  │
│  Output: LanguageModelV1 (AI SDK provider)       │
└──────────┬──────────────┬──────────────┬────────┘
           │              │              │
         OpenAI         OpenAI       DeepSeek
     gpt-4.1 / mini    (Guardião)    DeepSeek V3
```

| Plano | Mestre | Polidor | Guardião | Custo/Sessão |
|---|---|---|---|---|
| **Essencial** | gpt-4.1-mini | DeepSeek V3 | gpt-4.1 | ~$0.11 |
| **Standard** | gpt-4.1 | DeepSeek V3 | gpt-4.1 | ~$0.29 |
| **Premium** | gpt-4.1 | gpt-4.1-mini | gpt-4.1 | ~$0.34 |

### Fallback Chain

```
Primário gpt-4.1       → Fallback: DeepSeek V3     → Fallback: Gemini 2.5 Pro
Primário gpt-4.1-mini  → Fallback: DeepSeek V3     → Fallback: Gemini 2.5 Flash
Primário DeepSeek V3   → Fallback: gpt-4.1-nano    → Fallback: Gemini 2.0 Flash
```

### Success Criteria

- [ ] Pipeline novo (Mestre → Polidor → Guardião) responde ao aluno com qualidade socrática
- [ ] Retry loop funciona: Guardião REJECTED → feedback ao Mestre → nova tentativa
- [ ] Best response mantida entre retries
- [ ] Model Router seleciona modelo correto por agente + plano
- [ ] 3 planos funcionam (Essencial, Standard, Premium)
- [ ] Fallback chain ativo quando provider indisponível
- [ ] Agentes legado completamente removidos
- [ ] API routes migradas para novo pipeline
- [ ] Zero regressão na experiência do aluno

---

## Stories

---

### Story 16.1: Schemas Zod e Types para Novos Agentes

**As a** developer,
**I want** Zod schemas para Mestre, Polidor e Guardião com output types,
**so that** os agentes produzam structured output validável e tipado.

**Architecture Reference:** ws1-motor-socratico-architecture.md, Seções 6.1-6.3

**Story Points:** 3
**Priority:** P0 (fundação)
**Risk:** LOW — schemas puros, sem side effects

#### Acceptance Criteria

- [ ] **AC1:** Schema `MestreOutput` em `packages/agents/src/schemas/mestre.ts`
  - `response.content` (string, 50-1500 chars)
  - `response.question_type` (enum: clarificacao, pressupostos, perspectiva, evidencia, consequencias, metacognicao)
  - `response.question_technique` (optional enum: paradoxal, temporal, inversao, essencia, permissao)
  - `response.depth_layer` (1-7)
  - `response.is_closing` (boolean)
  - `response.resistance_detected` (optional enum: intelectualizacao, deflexao, minimizacao, agressao, desistencia)
  - `response.emotional_calibration` (optional enum: confuso, defensivo, frustrado, insight)
  - `quality_checks` (7 booleans: no_direct_answer, no_labels, ends_with_question, single_question, connected_to_chapter, references_student_input, within_length_limit)
- [ ] **AC2:** Schema `PolidorOutput` em `packages/agents/src/schemas/polidor.ts`
  - `edited_response.content` (string, 80-1500 chars)
  - `edited_response.paragraph_count` (literal 2)
  - `edited_response.word_count` (optional number, 80-200)
  - `edited_response.ends_with_question` (literal true)
  - `changes_made` (optional: labels_removed, formatting_removed, paragraphs_restructured, content_condensed)
  - `quality_checks` (optional: no_labels, two_paragraphs, ends_with_question, within_word_limit, meaning_preserved)
- [ ] **AC3:** Schema `GuardiaoOutput` em `packages/agents/src/schemas/guardiao.ts`
  - `verdict` (enum: APPROVED, REJECTED)
  - `score` (number, 0.0-1.0)
  - `criteria_results` (7 critérios, cada um com pass, score, note)
  - `recommendation` (optional string)
- [ ] **AC4:** Types atualizados em `packages/agents/src/types.ts`
  - `AgentId` type inclui: mestre, polidor, guardiao
  - `TenantPlan` type: essencial, standard, premium
  - `InteractionType` type: socratic_dialogue, quiz, scenario, assignment
  - `ModelSpec` interface: provider, model, api_key_env, max_retries, timeout_ms
- [ ] **AC5:** Todos os schemas exportados via barrel file
- [ ] **AC6:** `pnpm typecheck` passa sem erros

#### Technical Notes

Seguir pattern existente em `packages/agents/src/schemas/creator.ts`. Usar Zod com `z.object()` e `z.enum()`.

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar schemas e types |
| **@qa (QA)** | Validar schemas com fixtures |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |

---

### Story 16.2: Prompts dos Agentes de Superfície (Mestre, Polidor, Guardião)

**As a** developer,
**I want** system prompts completos para Mestre, Polidor e Guardião,
**so that** cada agente tenha comportamento socrático preciso conforme a arquitetura.

**Architecture Reference:** ws1-motor-socratico-architecture.md, Seções 6.1-6.3, 12

**Story Points:** 8
**Priority:** P0 (fundação)
**Risk:** MEDIUM — qualidade do prompt impacta diretamente a experiência do aluno

#### Acceptance Criteria

- [ ] **AC1:** Prompt do Mestre em `packages/agents/src/prompts/mestre.ts`
  - Identidade: `Eximia_Mestre` (MSW identifier)
  - 7 camadas de profundidade (Fatos → Síntese)
  - 6 tipos de perguntas socráticas
  - 5 técnicas avançadas de pergunta
  - Calibração emocional (4 estados)
  - 5 tipos de resistência com tratamento
  - Fechamento socrático (quando `interactions_remaining <= 1`)
  - 10 regras invioláveis
  - Recebe: conteúdo do capítulo, histórico, perfil do aluno, feedback do Guardião (se retry)
  - Context injection: Big Five, Enneagram, DISC, Inteligências Múltiplas, perfil IA do Perfilador
- [ ] **AC2:** Prompt do Polidor em `packages/agents/src/prompts/polidor.ts`
  - Identidade: `Eximia_Polidor`
  - Processo de edição (5 passos)
  - Regras: 2 parágrafos, 80-200 palavras, sem labels, naturalidade, termina com ?
- [ ] **AC3:** Prompt do Guardião em `packages/agents/src/prompts/guardiao.ts`
  - Identidade: `Eximia_Guardiao`
  - 7 critérios de validação
  - Score 0-1 por critério + score geral
  - Verdict APPROVED/REJECTED
  - Feedback específico para retry (se REJECTED)
- [ ] **AC4:** Prompts em português (Brasil)
- [ ] **AC5:** Cada prompt inclui identifier `Eximia_*` no início do system prompt
- [ ] **AC6:** Função `buildMestrePrompt(context)` que injeta conteúdo do capítulo + perfil + histórico

#### Technical Notes

Prompts são funções TypeScript que retornam string (template literals). Seguir pattern existente em `packages/agents/src/prompts/`. O Mestre é o prompt mais complexo (~2000+ tokens de system prompt).

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar prompts |
| **@qa (QA)** | Validar identifiers e injeção de contexto |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | Identifier `Eximia_*` presente em cada prompt | Yes |
| Pre-Commit | `pnpm typecheck` passa | Yes |

---

### Story 16.3: Model Router Multi-Provider

**As a** developer,
**I want** um Model Router que seleciona o LLM correto por agente, tipo de interação e plano do tenant,
**so that** o sistema otimize custo sem sacrificar qualidade.

**Architecture Reference:** ws1-motor-socratico-architecture.md, Seção 9

**Story Points:** 5
**Priority:** P0 (fundação)
**Risk:** MEDIUM — multi-provider requer API keys e fallback

#### Acceptance Criteria

- [ ] **AC1:** `ModelRouter` em `packages/agents/src/model-router.ts`
  - `getModel(agentId, context)` retorna `LanguageModelV1`
  - Tabela de decisão: 15 combinações (5 agentes × 3 planos)
  - Guardião **sempre** usa `gpt-4.1` independente do plano
- [ ] **AC2:** Provider DeepSeek configurado via `@ai-sdk/openai-compatible`
  - Base URL: `https://api.deepseek.com/v1`
  - API key via `DEEPSEEK_API_KEY` env var
- [ ] **AC3:** Override por tipo de interação
  - Standard + quiz → Mestre usa `gpt-4.1-mini` (economia)
  - Premium → sem override (sempre gpt-4.1 para Mestre)
- [ ] **AC4:** Fallback chain implementado
  - gpt-4.1 → DeepSeek V3 → Gemini 2.5 Pro
  - gpt-4.1-mini → DeepSeek V3 → Gemini 2.5 Flash
  - DeepSeek V3 → gpt-4.1-nano → Gemini 2.0 Flash
  - Max 2 retries antes de escalar
- [ ] **AC5:** Config centralizada em `MODEL_ROUTER_CONFIG` exportável
- [ ] **AC6:** `getModelSpec()` (sem instanciar provider) para unit tests
- [ ] **AC7:** Env vars documentadas: `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`

#### Technical Notes

```typescript
import { openai } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

const deepseek = createOpenAICompatible({
  name: 'deepseek',
  baseURL: 'https://api.deepseek.com/v1',
  apiKey: process.env.DEEPSEEK_API_KEY,
})

function getModel(agentId: AgentId, context: RoutingContext): LanguageModelV1 {
  const planConfig = MODEL_ROUTER_CONFIG.plans[context.tenantPlan]
  let modelSpec = planConfig[agentId]

  if (agentId === 'mestre' && context.tenantPlan === 'standard' && context.interactionType === 'quiz') {
    modelSpec = { provider: 'openai', model: 'gpt-4.1-mini', api_key_env: 'OPENAI_API_KEY' }
  }

  return createModel(modelSpec)
}
```

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar Model Router |
| **@architect (Aria)** | Validar tabela de decisão e fallback |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-Commit | Guardião invariant: sempre gpt-4.1 | Yes |

---

### Story 16.4: Orquestrador v2 — Pipeline de Superfície

**As a** developer,
**I want** um Orquestrador v2 que executa o pipeline Mestre → Polidor → Guardião com retry loop,
**so that** o aluno receba respostas socráticas validadas com qualidade garantida.

**Architecture Reference:** ws1-motor-socratico-architecture.md, Seções 3, 5

**Story Points:** 8
**Priority:** P0 (core)
**Risk:** HIGH — substitui pipeline inteiro, ponto central do sistema

#### Acceptance Criteria

- [ ] **AC1:** `orchestrateSocraticDialogueV2()` em `packages/agents/src/orchestrator.ts`
  - Recebe: mensagem do aluno, histórico, contexto do capítulo, perfil do aluno, config de interação
  - Executa pipeline: Mestre → Polidor → Guardião
  - Usa Model Router para selecionar modelo por agente
- [ ] **AC2:** Retry loop funcional
  - Se Guardião REJECTED: feedback vai ao Mestre com `recommendation`
  - Máximo 2 retries (configurável)
  - Mantém best response (maior score) entre tentativas
  - Warning se max retries excedido (nunca falha silenciosamente)
- [ ] **AC3:** Output final contém:
  - `response` (string — texto polido e aprovado)
  - `mestreOutput` (output completo do Mestre — depth_layer, question_type, etc.)
  - `guardiaoOutput` (verdict, score, criteria)
  - `retryCount` (quantas tentativas foram necessárias)
  - `modelUsed` (provider + model para cada agente)
- [ ] **AC4:** Integração com AI SDK `generateObject` para cada agente
- [ ] **AC5:** Sentry spans por agente (reutilizar pattern existente)
- [ ] **AC6:** Hook para pipeline shadow (preparar para Epic 17)
  - Emitir dados necessários para Detector e Perfilador
  - Não bloquear resposta de superfície
- [ ] **AC7:** Fallback: se todos os retries falharem, retorna best response com warning

#### Technical Notes

O Orquestrador v2 substitui `orchestrateSocraticDialogue()` existente. Manter assinatura compatível com API routes existentes para facilitar migração (Story 16.6).

```typescript
interface OrchestratorV2Result {
  response: string                    // texto final (polido e aprovado)
  mestreOutput: MestreOutput          // dados completos do Mestre
  guardiaoOutput: GuardiaoOutput      // verdict + score
  retryCount: number                  // 0-2
  modelUsed: Record<AgentId, ModelSpec>
  shadowData?: {                      // para Epic 17
    studentMessage: string
    mestreResponse: string
    sessionHistory: Message[]
    chapterContent: string
  }
}
```

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar Orquestrador v2 |
| **@architect (Aria)** | Review da arquitetura do pipeline |
| **@qa (QA)** | Testar cenários de retry e fallback |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Pipeline happy path funciona (Mestre → Polidor → Guardião → APPROVED) | Yes |
| Pre-PR | Retry loop funciona (REJECTED → feedback → APPROVED) | Yes |

---

### Story 16.5: Tenant Plan & Configuração de Planos

**As a** platform admin,
**I want** configurar o plano de cada tenant (Essencial, Standard, Premium),
**so that** o Model Router use os modelos corretos por tenant.

**Architecture Reference:** ws1-motor-socratico-architecture.md, Seção 9

**Story Points:** 3
**Priority:** P1
**Risk:** LOW — campo adicional em tabela existente

#### Acceptance Criteria

- [ ] **AC1:** Campo `plan` adicionado na tabela `tenants`
  - Tipo: `TEXT CHECK (plan IN ('essencial', 'standard', 'premium'))`
  - Default: `'standard'`
  - Migration SQL sem downtime
- [ ] **AC2:** Drizzle schema atualizado em `packages/database/src/schema/tenants.ts`
- [ ] **AC3:** Orquestrador v2 busca plano do tenant do contexto da sessão
- [ ] **AC4:** RLS: apenas super_admin pode alterar plano
- [ ] **AC5:** Tenants existentes recebem `plan = 'standard'` na migration

#### Technical Notes

```sql
ALTER TABLE tenants ADD COLUMN plan TEXT NOT NULL DEFAULT 'standard'
  CHECK (plan IN ('essencial', 'standard', 'premium'));

-- RLS para update do plan
CREATE POLICY "tenants_plan_update" ON tenants FOR UPDATE
  USING (auth_user_role() = 'super_admin')
  WITH CHECK (auth_user_role() = 'super_admin');
```

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Migration, schema Drizzle |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Migration aplica, tenants existentes recebem 'standard' | Yes |

---

### Story 16.6: Migração das API Routes para Pipeline v2

**As a** developer,
**I want** migrar as API routes de sessão socrática para usar o Orquestrador v2,
**so that** os alunos passem a usar o novo pipeline.

**Architecture Reference:** ws1-motor-socratico-architecture.md, Seção 15

**Story Points:** 5
**Priority:** P0
**Risk:** HIGH — troca do pipeline em produção

#### Acceptance Criteria

- [ ] **AC1:** API route `POST /api/sessions/[sessionId]/messages` usa `orchestrateSocraticDialogueV2()`
  - Passa contexto completo: mensagem, histórico, capítulo, perfil, config
  - Passa plano do tenant para Model Router
- [ ] **AC2:** Resposta ao aluno usa `result.response` (texto polido pelo Polidor)
- [ ] **AC3:** Dados do Mestre (depth_layer, question_type) salvos na mensagem/sessão
- [ ] **AC4:** Dados do Guardião (score, verdict) salvos para métricas
- [ ] **AC5:** Streaming mantido (se existente) ou adaptado
- [ ] **AC6:** Env vars `OPENAI_API_KEY` e `DEEPSEEK_API_KEY` configuradas
- [ ] **AC7:** Funcionalidade existente preservada: login → curso → capítulo → sessão → chat funciona

#### Technical Notes

Migração gradual: primeiro manter ambos os pipelines (flag), depois remover v1 na Story 16.7.

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Migrar API routes |
| **@qa (QA)** | Validar fluxo completo E2E |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Fluxo completo funciona: login → curso → capítulo → sessão → chat | Yes |
| Pre-PR | Zero regressão na experiência do aluno | Yes |

---

### Story 16.7: Remoção dos Agentes Legado

**As a** developer,
**I want** deletar completamente os agentes legado (Socrates, Editor, Tester, Analyst, Profiler antigo),
**so that** o codebase fique limpo e sem código morto.

**Architecture Reference:** ws1-motor-socratico-architecture.md, Seções 1, 14-15

**Story Points:** 3
**Priority:** P1 (após migração confirmada)
**Risk:** LOW — apenas deleção de código já substituído

#### Acceptance Criteria

- [ ] **AC1:** Arquivos deletados:
  - `packages/agents/src/socrates.ts`
  - `packages/agents/src/editor.ts`
  - `packages/agents/src/tester.ts`
  - `packages/agents/src/analyst.ts`
  - `packages/agents/src/profiler.ts` (profiler antigo — novo Perfilador é Epic 17)
  - `packages/agents/src/schemas/socrates.ts`
  - `packages/agents/src/schemas/editor.ts`
  - `packages/agents/src/schemas/tester.ts`
  - `packages/agents/src/schemas/analyst.ts`
  - `packages/agents/src/schemas/profiler.ts`
  - `packages/agents/src/prompts/socrates.ts`
  - `packages/agents/src/prompts/editor.ts`
  - `packages/agents/src/prompts/tester.ts`
  - `packages/agents/src/prompts/analyst.ts`
  - `packages/agents/src/prompts/profiler.ts`
- [ ] **AC2:** Referências removidas de barrel files (index.ts)
- [ ] **AC3:** `pnpm typecheck` passa sem erros
- [ ] **AC4:** `pnpm build` passa sem erros
- [ ] **AC5:** Manter `creator.ts` e seus schemas/prompts (pertence ao WS2)
- [ ] **AC6:** Manter fixtures legado MSW (`Harven_*`) temporariamente se testes E2E ainda os referenciam — remover quando E2E migrados

#### Technical Notes

Executar após Story 16.6 confirmada em produção. Verificar que nenhuma importação referencia os arquivos antes de deletar.

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Deleção e cleanup |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` e `pnpm build` passam | Yes |

---

## Dependency Graph

```
Story 16.1 (Schemas)
    ↓
Story 16.2 (Prompts)      Story 16.3 (Model Router)
    ↓                           ↓
    └──────── Story 16.4 ───────┘  (Orquestrador v2)
                  ↓
              Story 16.5 (Tenant Plan)
                  ↓
              Story 16.6 (Migração API Routes)
                  ↓
              Story 16.7 (Remoção Legado)
```

**Ordem de execução sugerida:** 16.1 → (16.2 + 16.3 em paralelo) → 16.4 → 16.5 → 16.6 → 16.7

---

## Compatibility Requirements

- [ ] Chat UI existente continua funcionando sem alterações
- [ ] Creator Agent (WS2) não é afetado
- [ ] Sessions existentes no DB não são corrompidas
- [ ] Streaming (se existente) mantido ou adaptado
- [ ] API route contract mantém compatibilidade com frontend

---

## Risk Mitigation

| Risco | Impacto | Mitigação | Rollback |
|---|---|---|---|
| Pipeline v2 com qualidade inferior | Alto | Testes extensivos antes de deletar v1 | Reverter para branch com código antigo |
| DeepSeek API indisponível | Médio | Fallback chain automático | Model Router cai para OpenAI |
| Multi-provider = múltiplas API keys | Baixo | Centralizar em env vars | Funciona com 1 provider (degradado) |
| Migração API route quebra frontend | Alto | Manter ambos pipelines com flag | Feature flag para voltar ao v1 |
| Prompt do Mestre não atinge qualidade | Alto | Iterar com Golden Dataset (Epic 19) | Ajustar prompt iterativamente |

---

## New File Locations

```
packages/agents/src/
├── orchestrator.ts              # REESCREVER
├── model-router.ts              # NOVO
├── types.ts                     # ATUALIZAR
├── prompts/
│   ├── mestre.ts                # NOVO
│   ├── polidor.ts               # NOVO
│   └── guardiao.ts              # NOVO
├── schemas/
│   ├── mestre.ts                # NOVO
│   ├── polidor.ts               # NOVO
│   └── guardiao.ts              # NOVO
└── [DELETAR na 16.7: socrates.ts, editor.ts, tester.ts, analyst.ts, profiler.ts + schemas + prompts]

packages/database/src/schema/
└── tenants.ts                   # ATUALIZAR (add plan field)

supabase/migrations/
└── YYYYMMDD_add_tenant_plan.sql # NOVO
```

---

## Definition of Done

- [ ] Pipeline v2 (Mestre → Polidor → Guardião) funcional end-to-end
- [ ] Model Router seleciona modelos corretos por plano
- [ ] Retry loop funciona com feedback do Guardião
- [ ] Fallback chain ativo
- [ ] API routes migradas
- [ ] Agentes legado removidos
- [ ] `pnpm typecheck` e `pnpm build` passam
- [ ] Zero regressão na experiência do aluno

---

## Total Story Points

| Story | Título | SP | Dependência |
|-------|--------|---:|-------------|
| 16.1 | Schemas Zod e Types | 3 | — |
| 16.2 | Prompts (Mestre, Polidor, Guardião) | 8 | 16.1 |
| 16.3 | Model Router | 5 | 16.1 |
| 16.4 | Orquestrador v2 | 8 | 16.2, 16.3 |
| 16.5 | Tenant Plan | 3 | 16.4 |
| 16.6 | Migração API Routes | 5 | 16.4, 16.5 |
| 16.7 | Remoção Legado | 3 | 16.6 |
| **Total** | | **35** | |

---

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-02-15 | 1.0 | Criação do épico | Morgan (PM) |
