# Story 16.3: Model Router Multi-Provider

**Epic:** [Epic 16 — Core Agents & Pipeline Socratico](../../epics/epic-16-ws1-core-agents-pipeline-socratico.md)
**Version:** 1.0
**Created:** 2026-02-15
**Updated:** 2026-02-15
**Author:** River (SM)
**Status:** Ready
**Story Points:** 5
**Priority:** P0 (fundacao)
**Blocked By:** Story 16.1 (schemas/types)
**Blocks:** Story 16.4 (Orquestrador v2)
**Assigned To:** @dev

---

## User Story

**As a** developer,
**I want** um Model Router que seleciona o LLM correto por agente, tipo de interacao e plano do tenant,
**so that** o sistema otimize custo sem sacrificar qualidade.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws1-motor-socratico-architecture.md`, Secao 9 |
| **PRD Ref** | `docs/prd/evolucao-eximia-academy-workstreams.md` — WS1: Motor Socratico |
| **Stack** | TypeScript, AI SDK 6.0, `@ai-sdk/openai`, `@ai-sdk/openai-compatible` |
| **Package** | `@eximia/agents` |
| **Providers** | OpenAI (gpt-4.1, gpt-4.1-mini), DeepSeek V3 (OpenAI-compatible) |
| **Risk** | MEDIUM — multi-provider requer API keys e fallback |

---

## Acceptance Criteria

- [ ] **AC1:** `ModelRouter` em `packages/agents/src/model-router.ts`
  - `getModel(agentId, context)` retorna `LanguageModelV1`
  - Tabela de decisao: 15 combinacoes (5 agentes x 3 planos)
  - Guardiao **sempre** usa `gpt-4.1` independente do plano
- [ ] **AC2:** Provider DeepSeek configurado via `@ai-sdk/openai-compatible`
  - Base URL: `https://api.deepseek.com/v1`
  - API key via `DEEPSEEK_API_KEY` env var
- [ ] **AC3:** Override por tipo de interacao
  - Standard + quiz → Mestre usa `gpt-4.1-mini` (economia)
  - Premium → sem override (sempre gpt-4.1 para Mestre)
- [ ] **AC4:** Fallback chain implementado
  - gpt-4.1 → DeepSeek V3 → Gemini 2.5 Pro
  - gpt-4.1-mini → DeepSeek V3 → Gemini 2.5 Flash
  - DeepSeek V3 → gpt-4.1-nano → Gemini 2.0 Flash
  - Max 2 retries antes de escalar
- [ ] **AC4b:** Provider Google configurado via `@ai-sdk/google` para fallback Gemini
  - Instalar `@ai-sdk/google` (`pnpm add @ai-sdk/google -F @eximia/agents`)
  - API key via `GOOGLE_API_KEY` env var
  - Fallback Gemini e ultimo recurso — pode nao estar configurado em todos os ambientes
- [ ] **AC5:** Config centralizada em `MODEL_ROUTER_CONFIG` exportavel
- [ ] **AC6:** `getModelSpec()` (sem instanciar provider) para unit tests
- [ ] **AC7:** Env vars documentadas: `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, `GOOGLE_API_KEY` (opcional — fallback)

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 5) Definir config centralizada
  - [ ] Criar `packages/agents/src/model-router.ts`
  - [ ] Definir `MODEL_ROUTER_CONFIG` com:
    - `plans`: Record<TenantPlan, Record<AgentId, ModelSpec>> (15 combinacoes)
    - `interaction_overrides`: partial override por interaction_type
    - `fallback_chains`: Record<string, ModelSpec[]>

- [ ] **Task 2** (AC: 2, 4b) Configurar providers secundarios
  - [ ] Importar `createOpenAICompatible` de `@ai-sdk/openai-compatible`
  - [ ] Criar instancia `deepseek` com baseURL `https://api.deepseek.com/v1`
  - [ ] API key via `process.env.DEEPSEEK_API_KEY`
  - [ ] Instalar `@ai-sdk/openai-compatible` se nao presente (`pnpm add @ai-sdk/openai-compatible -F @eximia/agents`)
  - [ ] Importar `google` de `@ai-sdk/google` para fallback Gemini
  - [ ] Instalar `@ai-sdk/google` (`pnpm add @ai-sdk/google -F @eximia/agents`)
  - [ ] API key via `process.env.GOOGLE_API_KEY` (opcional — fallback graceful se ausente)

- [ ] **Task 3** (AC: 1, 3) Implementar getModel()
  - [ ] Implementar `getModel(agentId: AgentId, context: RoutingContext): LanguageModelV1`
  - [ ] Lookup na tabela `plans[context.tenantPlan][agentId]`
  - [ ] Override por interaction_type (Standard + quiz → Mestre gpt-4.1-mini)
  - [ ] Invariante: Guardiao sempre retorna gpt-4.1 independente de plano/override

- [ ] **Task 4** (AC: 6) Implementar getModelSpec()
  - [ ] Implementar `getModelSpec(agentId: AgentId, context: RoutingContext): ModelSpec`
  - [ ] Mesma logica do getModel() mas retorna spec sem instanciar provider
  - [ ] Usado para unit tests (nao precisa de API keys)

- [ ] **Task 5** (AC: 4) Implementar fallback chain
  - [ ] Implementar `getModelWithFallback(agentId, context): Promise<LanguageModelV1>`
  - [ ] Tenta modelo primario
  - [ ] Se falhar, tenta fallback 1, depois fallback 2
  - [ ] Max 2 tentativas antes de throw

- [ ] **Task 6** (AC: 7) Atualizar barrel file e documentar env vars
  - [ ] Exportar `getModel`, `getModelSpec`, `MODEL_ROUTER_CONFIG` em index.ts
  - [ ] Documentar em Dev Notes as env vars necessarias

- [ ] **Task 7** Validar
  - [ ] `pnpm typecheck` passa

---

## Dev Notes

### Routing Table Complete (15 combinacoes)

| Plano | Mestre | Polidor | Guardiao | Detector | Perfilador |
|---|---|---|---|---|---|
| **Essencial** | gpt-4.1-mini | DeepSeek V3 | gpt-4.1 | DeepSeek V3 | DeepSeek V3 |
| **Standard** | gpt-4.1 | DeepSeek V3 | gpt-4.1 | DeepSeek V3 | DeepSeek V3 |
| **Premium** | gpt-4.1 | gpt-4.1-mini | gpt-4.1 | gpt-4.1-mini | gpt-4.1-mini |

**Nota**: Detector e Perfilador sao do Epic 17, mas ja devem estar na tabela. Use `AgentId` que inclui todos os 5.

[Source: docs/architecture/ws1-motor-socratico-architecture.md, Secao 9]

### Interaction Override (Standard plan only)

| interaction_type | Mestre (Standard) | Mestre (Essencial) | Mestre (Premium) |
|---|---|---|---|
| `socratic_dialogue` | gpt-4.1 | gpt-4.1-mini | gpt-4.1 |
| `quiz` | **gpt-4.1-mini** | gpt-4.1-mini | gpt-4.1 |
| `scenario` | gpt-4.1 | gpt-4.1-mini | gpt-4.1 |
| `assignment` | gpt-4.1 | gpt-4.1-mini | gpt-4.1 |

[Source: docs/architecture/ws1-motor-socratico-architecture.md, Secao 9]

### Fallback Chain

```
Primario gpt-4.1       → DeepSeek V3     → Gemini 2.5 Pro
Primario gpt-4.1-mini  → DeepSeek V3     → Gemini 2.5 Flash
Primario DeepSeek V3   → gpt-4.1-nano    → Gemini 2.0 Flash
```

[Source: docs/architecture/ws1-motor-socratico-architecture.md, Secao 9]

### DeepSeek Provider Implementation

```typescript
import { openai } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

const deepseek = createOpenAICompatible({
  name: 'deepseek',
  baseURL: 'https://api.deepseek.com/v1',
  apiKey: process.env.DEEPSEEK_API_KEY,
})

// Usage: deepseek('deepseek-chat') para DeepSeek V3
```

[Source: docs/architecture/ws1-motor-socratico-architecture.md, Secao 9]

### Invariante Guardiao

**REGRA INVIOLAVEL**: Guardiao **nunca** usa modelo economico. Custo marginal (~3-5% da sessao) nao justifica risco de degradacao do quality gate.

[Source: docs/architecture/ws1-motor-socratico-architecture.md, Secao 9]

### Gemini Provider Implementation

```typescript
import { google } from '@ai-sdk/google'

// Usage: google('gemini-2.5-pro') para Gemini 2.5 Pro
// API key via GOOGLE_API_KEY env var
// NOTA: Gemini e ultimo fallback — se GOOGLE_API_KEY ausente, skip silenciosamente
```

### Env Vars Necessarias

```
OPENAI_API_KEY=sk-...       # OpenAI API key (gpt-4.1, gpt-4.1-mini)
DEEPSEEK_API_KEY=sk-...     # DeepSeek API key (deepseek-chat = DeepSeek V3)
```

### File Locations

```
packages/agents/src/
├── model-router.ts    # NOVO
├── types.ts           # JA ATUALIZADO na 16.1 (ModelSpec, RoutingContext)
└── index.ts           # ATUALIZAR (exportar model router)
```

### Testing

- Testes unitarios serao criados no Epic 19 (Story 19.2)
- ~25 testes: tabela exaustiva, override, invariante Guardiao, fallback

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-15 | 1.0 | Story creation | River (SM) |
| 2026-02-15 | 1.1 | QA fix: AC4b adicionado (Google/Gemini provider SDK), Task 2 expandido, GOOGLE_API_KEY em AC7 | Quinn (QA) + River (SM) |

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
