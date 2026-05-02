# Story 16.6: Migracao das API Routes para Pipeline v2

**Epic:** [Epic 16 — Core Agents & Pipeline Socratico](../../epics/epic-16-ws1-core-agents-pipeline-socratico.md)
**Version:** 1.0
**Created:** 2026-02-15
**Updated:** 2026-02-15
**Author:** River (SM)
**Status:** Ready
**Story Points:** 5
**Priority:** P0
**Blocked By:** Story 16.4 (Orquestrador v2), Story 16.5 (Tenant Plan)
**Blocks:** Story 16.7
**Assigned To:** @dev

---

## User Story

**As a** developer,
**I want** migrar as API routes de sessao socratica para usar o Orquestrador v2,
**so that** os alunos passem a usar o novo pipeline.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws1-motor-socratico-architecture.md`, Secao 15 |
| **PRD Ref** | `docs/prd/evolucao-eximia-academy-workstreams.md` — WS1: Motor Socratico |
| **Stack** | Next.js 15 App Router, Supabase, AI SDK, Vercel AI Data Stream |
| **API Route** | `apps/web/src/app/api/sessions/[sessionId]/messages/route.ts` |
| **Risk** | HIGH — troca do pipeline em producao |

---

## Acceptance Criteria

- [ ] **AC1:** API route `POST /api/sessions/[sessionId]/messages` usa `orchestrateSocraticDialogueV2()`
  - Passa contexto completo: mensagem, historico, capitulo, perfil, config
  - Passa plano do tenant para Model Router
- [ ] **AC2:** Resposta ao aluno usa `result.response` (texto polido pelo Polidor)
- [ ] **AC3:** Dados do Mestre (depth_layer, question_type) salvos na mensagem/sessao
- [ ] **AC4:** Dados do Guardiao (score, verdict) salvos para metricas
- [ ] **AC5:** Streaming mantido (se existente) ou adaptado
- [ ] **AC6:** Env vars `OPENAI_API_KEY` e `DEEPSEEK_API_KEY` configuradas
- [ ] **AC7:** Funcionalidade existente preservada: login → curso → capitulo → sessao → chat funciona

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1) Migrar chamada do orquestrador
  - [ ] Abrir `apps/web/src/app/api/sessions/[sessionId]/messages/route.ts`
  - [ ] Substituir `orchestrateSocraticDialogue()` por `orchestrateSocraticDialogueV2()`
  - [ ] Construir input completo:
    - `studentMessage`: mensagem sanitizada do aluno
    - `chapterContent`: conteudo do capitulo (ja carregado)
    - `conversationHistory`: historico da sessao (ja carregado)
    - `turnNumber`: numero do turno
    - `interactionsRemaining`: interacoes restantes
    - `tenantPlan`: buscar `plan` do tenant (via session → chapter → course → tenant)
    - `interactionType`: tipo de interacao (default: `socratic_dialogue`)
    - `studentProfile`: perfil do aluno (se existente — preparar para Epic 17)

- [ ] **Task 2** (AC: 2, 5) Adaptar response handling
  - [ ] Usar `result.response` (string polida pelo Polidor) como texto da resposta
  - [ ] Manter streaming via Vercel AI Data Stream protocol
  - [ ] Adaptar metadata enviada via stream (incluir depth_layer, question_type)

- [ ] **Task 3** (AC: 3, 4) Salvar dados enriquecidos
  - [ ] Salvar `depth_layer` e `question_type` na mensagem do assistant (campo metadata JSONB ou colunas)
  - [ ] Salvar `verdict` e `score` do Guardiao (campo metadata ou tabela separada)
  - [ ] Salvar `retryCount` e `modelUsed` para observabilidade

- [ ] **Task 4** (AC: 1) Buscar tenant plan
  - [ ] Carregar `plan` do tenant via query existente (session → chapter → course → tenant)
  - [ ] Usar Drizzle join ou Supabase select com nested relation
  - [ ] Passar como `tenantPlan` no `RoutingContext`

- [ ] **Task 5** (AC: 6) Configurar env vars
  - [ ] Adicionar `OPENAI_API_KEY` no `.env.local` (se nao existente)
  - [ ] Adicionar `DEEPSEEK_API_KEY` no `.env.local`
  - [ ] Verificar que ambas existem no runtime (log warning se ausente)

- [ ] **Task 6** (AC: 7) Testes manuais de regressao
  - [ ] Login como student → navegar curso → capitulo → sessao → enviar mensagem
  - [ ] Verificar que resposta aparece no chat
  - [ ] Verificar console/logs para erros

- [ ] **Task 7** Validar
  - [ ] `pnpm typecheck` passa
  - [ ] `pnpm build` passa

---

## Dev Notes

### API Route Existente

O arquivo `apps/web/src/app/api/sessions/[sessionId]/messages/route.ts` atualmente:

1. Valida input com Zod
2. Autentica usuario via Supabase
3. Claim atomico do turno (`claim_session_turn` RPC)
4. Carrega contexto (session, chapter, question, historico)
5. Sanitiza mensagem do aluno
6. Persiste mensagem do student
7. Roda analyst em paralelo (non-blocking)
8. Roda `orchestrateSocraticDialogue()` ← **SUBSTITUIR POR v2**
9. Persiste mensagem assistant + analysis + qa_report
10. Stream response via Vercel AI Data Stream

**Mudancas minimais**: Substituir passo 8 por `orchestrateSocraticDialogueV2()` e adaptar passos 9 e 10 para os novos campos.

[Source: apps/web/src/app/api/sessions/[sessionId]/messages/route.ts]

### Tenant Plan Query

O tenant plan pode ser obtido expandindo o select existente:

```typescript
const { data: session } = await supabase
  .from("sessions")
  .select("*, chapter:chapters(*, course:courses(*, tenant:tenants(plan)))")
  .eq("id", sessionId)
  .single()

const tenantPlan = session.chapter.course.tenant.plan // "essencial" | "standard" | "premium"
```

### Streaming Pattern

O streaming usa Vercel AI Data Stream v1:
```typescript
// Metadata prefix (type 2)
controller.enqueue(encoder.encode(`2:${JSON.stringify([metadata])}\n`))
// Text chunks (type 0)
controller.enqueue(encoder.encode(`0:${JSON.stringify(word)}\n`))
```

Adaptar metadata para incluir `depth_layer` e `question_type` do Mestre.

[Source: apps/web/src/app/api/sessions/[sessionId]/messages/route.ts]

### Analyst vs Shadow Pipeline

O analyst roda em paralelo no pipeline v1. No v2, o analyst e substituido pelo Detector + Perfilador (Epic 17). Nesta story, MANTER o analyst rodando em paralelo ate Epic 17 substituir. Nao remover codigo do analyst.

### File Locations

```
apps/web/src/app/api/sessions/[sessionId]/messages/
└── route.ts    # ATUALIZAR (substituir orchestrator call)

.env.local
└── Adicionar: OPENAI_API_KEY, DEEPSEEK_API_KEY
```

### Testing

- Teste manual: fluxo completo student → chat
- E2E automatizado sera criado no Epic 19 (Story 19.3)

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-15 | 1.0 | Story creation | River (SM) |

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
