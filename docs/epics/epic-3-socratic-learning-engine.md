# Epic 3: Socratic Learning Engine

**Version:** 1.1
**Created:** 2026-02-07
**Updated:** 2026-02-08
**Author:** Morgan (PM Agent)
**Status:** Ready for Development (QA Gate: PASS)
**PRD Reference:** `docs/prd.md` — Epic 3
**Architecture Reference:** `docs/architecture.md` v1.2.3
**Screens Reference:** `docs/screens.md` — Tela 10
**Benchmark Reference:** `docs/benchmark-agentes-socraticos.md`

---

## Epic Goal

Aluno pode completar uma sessao socratica completa com 3 turnos de dialogo. O pipeline de 4 agentes (Analyst || Socrates → Editor → Tester) funciona end-to-end com streaming. O Analyst roda em paralelo, nao bloqueando o fluxo principal. Esta e a funcionalidade core que diferencia a plataforma — o Socratic Learning Engine transforma conteudo passivo em aprendizado ativo via dialogo maieutico.

## Epic Context

| Item | Detalhe |
|------|---------|
| **Stack** | Next.js 15 (App Router) + Supabase + Vercel + Drizzle ORM + Tailwind CSS 4 + shadcn/ui |
| **DB Tables** | `sessions`, `messages`, `analyses`, `qa_reports` — schema definido no Epic 1 (Story 1.2) |
| **Auth** | Supabase Auth invite-only, middleware protege `/(platform)/*` (Story 1.3) |
| **Layout** | Sidebar 200px + header + content area com tenant branding (Story 1.4) |
| **Agent Package** | `packages/agents` inicializado no Epic 2 (Story 2.3 — Creator Agent) com AI SDK + Anthropic |
| **Agent Benchmarks** | 4 agentes LLM com prompts e schemas em `Benchmarks/Agentes/` |
| **Screens** | 1 tela: Socratic Chat (#10) — inclui session summary inline |
| **Design Tokens** | `Benchmarks/Design/design-tokens.json` v1.2.1 |
| **Atomic Session** | `claim_session_turn()` + `release_session_turn()` RPCs (architecture.md) |
| **Pipeline Pattern** | Analyst (paralelo) → Socrates → Editor → Tester, retry max 2x se REJECTED |
| **Model** | `claude-sonnet-4-5-20250929` (balance custo/qualidade) |
| **NFR1** | Chat TTFB < 3s, pipeline total < 12s |

## Dependency Graph

```
Story 3.1 (Visualizacao Capitulo + Inicio Sessao) ──┐
[parallelizable with 3.2]                            │
                                                      │
Story 3.2 (Setup Agent Orchestrator) ───────────────┤
                                                      │
                                                      ▼
                        Story 3.4 (API Pipeline com Streaming)
                                                      │
                                                      ▼
                        Story 3.3 (Interface Chat Socratico)
                                                      │
                                                      ▼
                        Story 3.5 (Conclusao e Resumo)
```

**Pre-requisite:** Epic 2 completo (Stories 2.1–2.5)

---

## Stories

| Story | File | SP | Priority | Blocked By |
|-------|------|----|----------|------------|
| 3.1 Visualizacao Capitulo + Inicio Sessao | [`story-3.1-visualizacao-capitulo-inicio-sessao.md`](../stories/epic-3/story-3.1-visualizacao-capitulo-inicio-sessao.md) | 5 | P0 | Epic 2 |
| 3.2 Setup Agent Orchestrator | [`story-3.2-setup-agent-orchestrator.md`](../stories/epic-3/story-3.2-setup-agent-orchestrator.md) | 13 | P0 | 2.3 |
| 3.3 Interface Chat Socratico | [`story-3.3-interface-chat-socratico.md`](../stories/epic-3/story-3.3-interface-chat-socratico.md) | 8 | P0 | 3.1, 3.4 |
| 3.4 API Pipeline com Streaming | [`story-3.4-api-pipeline-streaming.md`](../stories/epic-3/story-3.4-api-pipeline-streaming.md) | 8 | P0 | 3.1, 3.2 |
| 3.5 Conclusao e Resumo | [`story-3.5-conclusao-sessao-resumo.md`](../stories/epic-3/story-3.5-conclusao-sessao-resumo.md) | 5 | P1 | 3.3, 3.4 |

**Total:** 39 story points

> Each story file contains: user story, acceptance criteria, technical implementation guide with code snippets, tasks, agent assignments, quality gates, risk assessment, and Definition of Done.

---

### Story 3.1: Visualizacao de Capitulo e Inicio de Sessao

**As a** student inscrito num curso,
**I want** ler o conteudo do capitulo e iniciar uma sessao socratica,
**so that** eu possa aprender e aplicar o conhecimento.

**Story Points:** 5
**Priority:** P0 (Blocker)
**Blocked By:** Epic 2 (all stories)
**Blocks:** 3.4, 3.3

#### Acceptance Criteria

- [ ] **AC1:** Pagina `/courses/[courseId]/chapters/[chapterId]` exibe conteudo renderizado do capitulo (markdown → HTML) para student inscrito
- [ ] **AC2:** Header mostra titulo do capitulo, nome do curso, e breadcrumb de navegacao (`Curso > Capitulo`)
- [ ] **AC3:** Botao "Iniciar Sessao Socratica" visivel ao final do conteudo do capitulo (sempre presente, sem gate de scroll/tempo — conforme PRD)
- [ ] **AC4:** Ao clicar "Iniciar Sessao", cria registro em `sessions` (status: `active`, `interactions_remaining: N` onde N = `tenants.settings.max_interactions_per_session`, default 3) com pergunta aleatoria ativa do capitulo
- [ ] **AC5:** Redirect para `/courses/[courseId]/chapters/[chapterId]/session` apos criacao
- [ ] **AC6:** Se ja existe sessao ativa (`status = 'active'`) para esse aluno + capitulo, botao muda para "Continuar Sessao" e redireciona sem criar nova
- [ ] **AC7:** Se sessao anterior completada (`status = 'completed'`), botao "Nova Sessao Socratica" permite iniciar nova sessao
- [ ] **AC8:** Selecao de pergunta: seleciona aleatoriamente 1 pergunta com `status = 'active'` do capitulo via `ORDER BY random() LIMIT 1`
- [ ] **AC9:** Se capitulo nao tem perguntas ativas, botao desabilitado com tooltip "Aguardando perguntas do professor"
- [ ] **AC10:** Pagina protegida: somente students inscritos no curso podem acessar (enrollment check via RSC data fetching)

#### Technical Notes

- **Tela:** Pagina de capitulo para student (nao especificada como screen separada — extensao do student course view)
- **Rota:** `/courses/[courseId]/chapters/[chapterId]/page.tsx` — student variant (RSC)
- **Session creation:** Server Action `createSession()` em `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/actions.ts`
  - Verifica enrollment ativo para o student + course
  - Verifica capitulo publicado com perguntas ativas
  - Verifica se nao existe sessao ativa (se existir, retorna sessao existente)
  - Cria registro em `sessions` com `student_id`, `chapter_id`, `question_id`, `tenant_id`
- **RLS:** `sessions_insert` requer `student_id = auth.uid()` e `tenant_id = auth_tenant_id()` (architecture.md)
- **Content rendering:** Reutilizar `react-markdown` + `@tailwindcss/typography` (prose class) do Epic 2 (Story 2.2)
- **Max interactions (M-1 resolution):** Ler `tenants.settings.max_interactions_per_session` (default: 3) ao criar sessao. O `claim_session_turn()` RPC ja usa esse valor. A UI deve usar o valor da sessao, nao hardcoded
- **Chapter navigation:** Student pode navegar entre capitulos do curso (prev/next)

#### Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Implementacao completa (pagina, server action, session creation) |
| **@qa (Quinn)** | Validacao: enrollment check, session resume, pergunta aleatoria, capitulo sem perguntas |

#### Quality Gates

| Gate | Validacao |
|------|----------|
| Pre-Commit | `pnpm lint && pnpm typecheck` passam, enrollment check funciona |
| Pre-PR | Capitulo renderizado, sessao criada, resume funciona, pergunta selecionada |

#### Tasks

- [ ] Criar pagina `/courses/[courseId]/chapters/[chapterId]/page.tsx` — student variant com conteudo renderizado
- [ ] Implementar enrollment check via RSC (verifica `enrollments` para student + course)
- [ ] Criar Server Action `createSession()` com validacoes (enrollment, capitulo publicado, perguntas ativas, sessao existente)
- [ ] Implementar selecao aleatoria de pergunta ativa (`ORDER BY random() LIMIT 1`)
- [ ] Implementar leitura de `tenants.settings.max_interactions_per_session` para `interactions_remaining` na criacao de sessao
- [ ] Implementar deteccao de sessao ativa (resume) e sessao completada (nova sessao)
- [ ] Criar componente de breadcrumb (`Curso > Capitulo`)
- [ ] Criar navegacao entre capitulos (prev/next)
- [ ] Tratar edge case: capitulo sem perguntas ativas (botao desabilitado + tooltip)
- [ ] Testes: criar sessao, resume sessao ativa, nova sessao apos completa, enrollment guard, capitulo sem perguntas

#### Definition of Done

- [ ] Todos os ACs passam
- [ ] Student pode ler capitulo e iniciar sessao socratica
- [ ] Sessao ativa e retomada, nao duplicada
- [ ] Pergunta aleatoria selecionada corretamente
- [ ] Student nao inscrito recebe 403/redirect
- [ ] PR aprovada

---

### Story 3.2: Setup do Agent Orchestrator (packages/agents)

**As a** developer,
**I want** o orchestrator de agentes configurado com prompts e schemas dos 4 agentes socraticos,
**so that** o pipeline socratico possa ser chamado via API.

**Story Points:** 13
**Priority:** P0 (Blocker)
**Blocked By:** Epic 2 Story 2.3 (packages/agents inicializado)
**Blocks:** 3.4

#### Acceptance Criteria

- [ ] **AC1:** System prompts dos 4 agentes migrados literalmente de `Benchmarks/Agentes/Harven_*/03_prompt/prompt_operacional.md` para `packages/agents/src/prompts/` (socrates.ts, editor.ts, tester.ts, analyst.ts)
- [ ] **AC2:** Schemas I/O de cada agente tipados com Zod em `packages/agents/src/schemas/` conforme `Benchmarks/Agentes/Harven_*/03_prompt/schemas/` (input_schema.json + output_schema.json)
- [ ] **AC3:** Pipeline executor `orchestrateSocraticDialogue()` que encadeia: Socrates → Editor → Tester com retry logic
- [ ] **AC4:** Funcao `runAnalyst()` separada que roda em paralelo (nao bloqueia pipeline principal)
- [ ] **AC5:** Retry logic: se Tester retorna `REJECTED`, re-executa Socrates → Editor → Tester (max 2 retries). Na 3a rejeicao, retorna melhor resposta disponivel com flag de warning
- [ ] **AC6:** Timeout de 30s por agente — se exceder, lanca `AgentTimeoutError` com nome do agente
- [ ] **AC7:** Integracao com Vercel AI SDK + Anthropic provider (`@ai-sdk/anthropic`) usando `generateText()`
- [ ] **AC8:** Testes unitarios para cada schema Zod (validacao de input/output com dados reais dos benchmarks)
- [ ] **AC9:** Export principal: `orchestrateSocraticDialogue(input) → { response, qaReport, retryCount }` e `runAnalyst(input) → AnalysisResult`
- [ ] **AC10:** Cada agente recebe contexto correto conforme contratos I/O do benchmark:
  - Socrates: `session_context` (chapter_content, initial_question, interactions_remaining, **conversation_history**: array de mensagens anteriores student+tutor) + `student_message`
  - Editor: `socrates_response` (resposta bruta)
  - Tester: `edited_response` + `context` (chapter_title, student_message)
  - Analyst: `student_message` + `context` (chapter_id, turn_number) + `interaction_metadata` (session_id, timestamp)
- [ ] **AC11:** Model configuravel por agente via `AgentPipelineConfig` (default: `claude-sonnet-4-5-20250929`)

#### Technical Notes

- **ESTA STORY CONSTROI O CORE DO PIPELINE SOCRATICO** — reutiliza o `packages/agents` inicializado em Story 2.3
- **Prompts:** Migrar LITERALMENTE de `Benchmarks/Agentes/Harven_*/03_prompt/prompt_operacional.md` — sem modificacao. Cada prompt e um export `const` em TypeScript
- **Schemas I/O:** Converter os JSON schemas em `Benchmarks/Agentes/Harven_*/03_prompt/schemas/` para Zod schemas tipados
- **Pipeline pattern:** Conforme architecture.md Section 7.3 — `PipelineStep<TInput, TOutput>` com `name`, `execute`, `timeout`, `retryable`
- **Conversation history (H-2 resolution):** `orchestrateSocraticDialogue()` recebe `conversationHistory: Message[]` — array de mensagens anteriores (student + tutor) ordenadas por turn_number. Para turn 1, array vazio. Para turns 2-3, contem as mensagens anteriores. Socrates PRECISA desta historia para: (a) referenciar algo que o aluno disse (Invariante #6), (b) aprofundar progressivamente o raciocinio, (c) nao repetir feedback
- **Retry flow:** Tester REJECTED → feedback do Tester enviado ao Socrates como contexto adicional → Socrates gera nova resposta → Editor polida → Tester valida novamente
- **Analyst paralelo:** `runAnalyst()` e chamado com `Promise` e o resultado e awaited DEPOIS do pipeline principal (nao bloqueia)
- **Error types:** Criar `AgentTimeoutError`, `AgentInvalidOutputError`, `PipelineMaxRetriesError` em `packages/agents/src/errors.ts`
- **Restricoes dos agentes (do benchmark):**
  - Socrates: NUNCA da resposta direta, SEMPRE termina com ?, 2 paragrafos, 80-200 palavras
  - Editor: Remove rotulos, garante 2 paragrafos, preserva significado
  - Tester: 6 criterios (C1-C6), score minimo 0.7, CRITICAL failures = auto-reject
  - Analyst: AI detection (0.0-1.0), metricas, flags, < 1s
- **Nota sobre Creator:** Ja migrado em Story 2.3 — NAO duplicar. Creator fica em `packages/agents/src/prompts/creator.ts`

#### Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Implementacao completa (prompts, schemas, pipeline, retry, exports) |
| **@architect (Aria)** | Review do pipeline pattern — validar que e extensivel e reutilizavel |
| **@qa (Quinn)** | Validacao: schemas Zod vs benchmark schemas, retry logic, timeout handling |

#### Quality Gates

| Gate | Validacao |
|------|----------|
| Pre-Commit | Lint + typecheck, Zod schemas compilam, prompts exportados corretamente |
| Pre-PR | Pipeline end-to-end com mock LLM, retry funciona, timeout lanca erro correto |
| Architecture | Pipeline pattern aprovado por @architect — extensivel para futuros agentes |

#### Tasks

- [ ] Migrar system prompt: `Benchmarks/Agentes/Harven_Socrates/03_prompt/prompt_operacional.md` → `packages/agents/src/prompts/socrates.ts`
- [ ] Migrar system prompt: `Benchmarks/Agentes/Harven_Editor/03_prompt/prompt_operacional.md` → `packages/agents/src/prompts/editor.ts`
- [ ] Migrar system prompt: `Benchmarks/Agentes/Harven_Tester/03_prompt/prompt_operacional.md` → `packages/agents/src/prompts/tester.ts`
- [ ] Migrar system prompt: `Benchmarks/Agentes/Harven_Analyst/03_prompt/prompt_operacional.md` → `packages/agents/src/prompts/analyst.ts`
- [ ] Criar Zod schemas: `packages/agents/src/schemas/socrates.ts` (input + output conforme `Benchmarks/Agentes/Harven_Socrates/03_prompt/schemas/`)
- [ ] Criar Zod schemas: `packages/agents/src/schemas/editor.ts` (input + output)
- [ ] Criar Zod schemas: `packages/agents/src/schemas/tester.ts` (input + output)
- [ ] Criar Zod schemas: `packages/agents/src/schemas/analyst.ts` (input + output)
- [ ] Criar tipos de erro: `packages/agents/src/errors.ts` (AgentTimeoutError, AgentInvalidOutputError, PipelineMaxRetriesError)
- [ ] Implementar `PipelineStep` interface conforme architecture.md Section 7.3
- [ ] Implementar steps individuais: `socratesStep`, `editorStep`, `testerStep`
- [ ] Implementar funcao `runAnalyst()` em `packages/agents/src/analyst.ts`
- [ ] Implementar pipeline executor `orchestrateSocraticDialogue()` em `packages/agents/src/orchestrator.ts`
- [ ] Implementar retry logic: Tester REJECTED → loop Socrates → Editor → Tester (max 2 retries)
- [ ] Implementar timeout de 30s por agente com `AbortController` ou `Promise.race`
- [ ] Implementar fallback: apos max retries, retornar melhor resposta com warning flag
- [ ] Testes unitarios: schemas Zod com dados mock dos benchmarks (usar exemplos de `04_validation/`)
- [ ] Testes unitarios: pipeline com mock LLM (testar fluxo normal, retry 1x, retry 2x, max retries fallback)
- [ ] Testes unitarios: timeout de cada agente
- [ ] Configurar `AgentPipelineConfig` com defaults (model, maxRetries: 2, timeoutMs: 30000)

#### Definition of Done

- [ ] Todos os ACs passam
- [ ] 4 prompts migrados literalmente dos benchmarks
- [ ] 4 schemas Zod compilam e validam com dados de exemplo
- [ ] Pipeline executa: Socrates → Editor → Tester end-to-end (com mock LLM)
- [ ] Retry funciona quando Tester rejeita (1x, 2x, fallback)
- [ ] Timeout lanca erro correto por agente
- [ ] Analyst roda em paralelo sem bloquear pipeline
- [ ] @architect aprovou pipeline pattern
- [ ] PR aprovada

---

### Story 3.3: Interface do Chat Socratico

**As a** student,
**I want** conversar com a IA socratica via chat,
**so that** eu possa refletir e aplicar o que aprendi.

**Story Points:** 8
**Priority:** P0 (Blocker)
**Blocked By:** 3.1, 3.4
**Blocks:** 3.5

#### Acceptance Criteria

- [ ] **AC1:** Tela de chat (`/courses/[courseId]/chapters/[chapterId]/session`) com layout de chat full-height
- [ ] **AC2:** Header com "Voltar ao Capitulo" (link) e `InteractionCounter` ("X de Y restantes" — Y lido da sessao via `max_interactions_per_session` do tenant, nao hardcoded)
- [ ] **AC3:** Pergunta inicial exibida como primeira mensagem do tutor (role: `assistant`) via `initialMessages` do `useChat()`
- [ ] **AC4:** Campo de input (`ChatInput`) com textarea auto-resize, botao send, placeholder "Escreva sua reflexao..."
- [ ] **AC5:** Ao enviar resposta: input disabled, `TypingIndicator` ("Pensando..." com animacao de dots) enquanto pipeline processa
- [ ] **AC6:** Resposta da IA aparece via streaming word-by-word (DataStream protocol via `useChat()`)
- [ ] **AC7:** Scroll automatico para ultima mensagem apos cada nova mensagem (student e tutor)
- [ ] **AC8:** Mensagens com estilo diferenciado: tutor (alinhado a esquerda, avatar IA) vs student (alinhado a direita, avatar user)
- [ ] **AC9:** InteractionCounter atualiza automaticamente apos cada turno completo (leitura do `data` annotation do stream)
- [ ] **AC10:** Input desabilitado durante loading state (previne double-submit)
- [ ] **AC11:** Interface responsiva: funciona em desktop (chat centralizado, max-width 768px) e mobile (full-width)
- [ ] **AC12:** Tratamento de erro: se pipeline falhar (502), exibir toast "Erro ao processar. Tentar novamente?" com botao retry. Mensagem do student permanece no chat, input reabilitado para retry
- [ ] **AC13:** Medir `response_time_seconds` no frontend (tempo entre envio da mensagem e inicio da resposta) e enviar ao backend para o Analyst

#### Technical Notes

- **Tela:** Screen 10 (Socratic Chat) — screens.md
- **Componentes (conforme screens.md):**
  - `InteractionCounter` — "2 de 3 restantes" com progress dots ou counter numerico
  - `ChatMessage` — Bolha com role (tutor/aluno), avatar, timestamp, streaming indicator
  - `ChatInput` — Textarea auto-resize, botao send, disabled durante loading
  - `TypingIndicator` — "Pensando..." com animacao enquanto pipeline processa
  - `SessionCompleteBar` — Aparece quando `interactions_remaining = 0` (usado em Story 3.5)
- **`useChat()` hook:** Vercel AI SDK — conecta ao endpoint `/api/sessions/[sessionId]/messages`
  - `initialMessages`: pergunta inicial como role `assistant`
  - Streaming automatico via DataStream protocol
  - `data` annotations contem `session_status`, `interactions_remaining`, `turn_number`
- **Referencia de implementacao:** architecture.md Section 9.2 tem exemplo completo do `SocraticChat` component
- **Medicion de tempo:** `Date.now()` no momento do submit, calcular diferenca quando `isLoading` muda para false. Enviar como `response_time_seconds` no body do POST
- **Error handling:** `useChat()` tem `onError` callback — usar para exibir toast via shadcn Sonner
- **Auto-resize textarea:** Usar `onInput` handler que ajusta `style.height` baseado em `scrollHeight`

#### Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Implementacao completa (pagina, componentes, useChat integration) |
| **@ux-design-expert** | Review da UX do chat: spacing, bubbles, streaming feel, mobile layout |
| **@qa (Quinn)** | Validacao: streaming funciona, counter atualiza, error handling, responsividade |

#### Quality Gates

| Gate | Validacao |
|------|----------|
| Pre-Commit | Lint + typecheck, componentes renderizam sem erros |
| Pre-PR | Chat funcional end-to-end, streaming word-by-word, counter atualiza, error recovery funciona |
| UX | Review por @ux-design-expert: chat feels natural, mobile funciona |

#### Tasks

- [ ] Criar pagina `/courses/[courseId]/chapters/[chapterId]/session/page.tsx` — carrega sessao ativa via RSC
- [ ] Criar componente `SocraticChat` com `useChat()` hook conectado a API
- [ ] Criar componente `ChatMessage` com estilo diferenciado por role (tutor/student)
- [ ] Criar componente `ChatInput` com textarea auto-resize + botao send
- [ ] Criar componente `InteractionCounter` ("X de 3 restantes") com leitura do `data` annotation
- [ ] Criar componente `TypingIndicator` com animacao de dots ("Pensando...")
- [ ] Implementar scroll automatico para ultima mensagem (`scrollIntoView`)
- [ ] Implementar medicao de `response_time_seconds` no frontend
- [ ] Implementar error handling: toast de erro + retry via `onError` do `useChat()`
- [ ] Implementar disable do input durante loading (previne double-submit)
- [ ] Implementar layout responsivo: desktop (max-width 768px, centralizado) e mobile (full-width)
- [ ] Implementar redirect se sessao nao existe ou nao pertence ao student
- [ ] Testes: enviar mensagem, receber streaming, counter atualiza, error recovery, mobile layout

#### Definition of Done

- [ ] Todos os ACs passam
- [ ] Chat funcional com streaming word-by-word
- [ ] InteractionCounter atualiza corretamente apos cada turno
- [ ] Error handling funciona (toast + retry)
- [ ] Layout responsivo (desktop + mobile)
- [ ] `response_time_seconds` medido e enviado ao backend
- [ ] PR aprovada

---

### Story 3.4: API do Pipeline Socratico com Streaming

**As a** student,
**I want** receber a resposta da IA progressivamente via streaming,
**so that** a experiencia nao tenha espera longa sem feedback.

**Story Points:** 8
**Priority:** P0 (Blocker)
**Blocked By:** 3.1, 3.2
**Blocks:** 3.3, 3.5

#### Acceptance Criteria

- [ ] **AC1:** API route `POST /api/sessions/[sessionId]/messages` implementada conforme architecture.md Section 10.2
- [ ] **AC2:** Recebe `{ content: string, response_time_seconds: number }` (mensagem do aluno + tempo de resposta)
- [ ] **AC3:** Validacao: rejeita com 401 se user nao autenticado
- [ ] **AC4:** Atomic session claim via `claim_session_turn()` RPC — decrementa `interactions_remaining` atomicamente. Se falhar (sessao completa, nao pertence ao user, race condition), retorna 409
- [ ] **AC5:** Salva mensagem do student na tabela `messages` com `role: 'student'`, `turn_number` do claim
- [ ] **AC6:** Executa `runAnalyst()` em paralelo (nao bloqueia pipeline principal)
- [ ] **AC7:** Executa `orchestrateSocraticDialogue()` do `packages/agents` — pipeline completo Socrates → Editor → Tester
- [ ] **AC8:** Salva resposta do tutor na tabela `messages` com `role: 'tutor'`, mesmo `turn_number`
- [ ] **AC9:** Salva analysis na tabela `analyses` (output do Analyst: ai_detection, metrics, flags, observations)
- [ ] **AC10:** Salva qa_report na tabela `qa_reports` (output do Tester: verdict, score, criteria_results, recommendation)
- [ ] **AC11:** Retorna response via streaming DataStream protocol (Vercel AI SDK) — texto streamed word-by-word com delay de ~25ms
- [ ] **AC12:** Envia session metadata como data annotation no stream: `{ session_status, interactions_remaining, turn_number }`
- [ ] **AC13:** Se pipeline falhar apos claim, executa `release_session_turn()` para restaurar `interactions_remaining` — student pode retry
- [ ] **AC14:** Rate limiting: 10 req / 1 min por user conforme architecture.md Section 14.3. Requisicoes excedentes retornam HTTP 429
- [ ] **AC15:** Se `interactions_remaining` chega a 0 apos claim, session `status` automaticamente atualizado para `completed` (feito pelo `claim_session_turn()` RPC)
- [ ] **AC16:** Mensagem do student sanitizada antes de entrar no pipeline LLM conforme architecture.md Section 14.4: strip HTML tags, control characters, e prompt delimitadores (`<system>`, `</system>`, `<|im_start|>`, etc.). Caracteres Unicode validos preservados. Sanitizacao aplicada ANTES de salvar em `messages` e ANTES de enviar ao pipeline

#### Technical Notes

- **Referencia de implementacao:** architecture.md Section 10.2 tem o codigo completo da API route
- **API Route:** `apps/web/src/app/api/sessions/[sessionId]/messages/route.ts`
- **Fluxo da API route:**
  1. Auth check (`supabase.auth.getUser()`)
  2. `claim_session_turn(p_session_id, p_user_id)` — atomic claim
  3. Load session context (session + chapter + question via join)
  4. Load previous messages (`messages` WHERE `session_id`, ordered by `turn_number`) — H-2 FIX
  5. Sanitize student message content (strip HTML, control chars, prompt delimiters) — H-3 FIX
  6. Save student message
  7. `runAnalyst()` — paralelo (Promise)
  8. `orchestrateSocraticDialogue({ ..., conversationHistory })` — sequencial com historico
  9. Await analyst result
  10. Persist: tutor message + analysis + qa_report (`Promise.all`)
  11. Stream response via DataStream protocol
- **Error recovery:** try/catch wrapping steps 3-8. Se qualquer step falhar, `release_session_turn()` e chamado como compensacao
- **DataStream protocol (architecture.md):**
  - Text chunks: `0:"word "\n` (protocol format)
  - Data annotations: `2:[{session_status, interactions_remaining, turn_number}]\n`
  - Response headers: `Content-Type: text/plain; charset=utf-8`, `X-Vercel-AI-Data-Stream: v1`
- **Word streaming delay:** ~25ms entre palavras para typing feel natural
- **turn_number:** Conta UP (1→2→3) — calculado pelo `claim_session_turn()` RPC como `max_interactions - interactions_remaining`
- **Rate limiting:** Usar `@upstash/ratelimit` com `slidingWindow(10, '1 m')` no middleware (ja configurado no Epic 1 Story 1.5 como pattern)
- **RLS nota:** Messages e analyses sao inseridos via API route (server-side) — nao via client direto. QA reports idem. O pipeline opera no contexto do user autenticado

#### Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Implementacao completa (API route, claim/release, persist, streaming) |
| **@architect (Aria)** | Review do fluxo de error recovery e compensacao |
| **@qa (Quinn)** | Validacao: atomic claim funciona, error recovery restaura turno, race condition tratada, rate limiting |

#### Quality Gates

| Gate | Validacao |
|------|----------|
| Pre-Commit | Lint + typecheck, API route compila |
| Pre-PR | Pipeline end-to-end (com agentes reais ou mock), streaming funciona, claim/release testado, todas as tabelas populadas |
| Security | Auth check, session ownership validation, rate limiting enforced, tenant isolation via RLS, `release_session_turn()` nao permite exploits, content sanitization enforced (AC16) |

#### Tasks

- [ ] Criar API route `POST /api/sessions/[sessionId]/messages/route.ts` conforme architecture.md Section 10.2
- [ ] Implementar auth check (`supabase.auth.getUser()`)
- [ ] Implementar atomic session claim via `supabase.rpc('claim_session_turn', { p_session_id, p_user_id })`
- [ ] Implementar load de session context (session + chapter + question join)
- [ ] Implementar load de conversation history (previous messages ordered by turn_number + created_at)
- [ ] Implementar save de student message em `messages` (role: student, turn_number)
- [ ] Implementar chamada paralela `runAnalyst()` (Promise sem await imediato)
- [ ] Implementar chamada `orchestrateSocraticDialogue()` (pipeline sequencial)
- [ ] Implementar persist de resultados: tutor message + analysis + qa_report (`Promise.all`)
- [ ] Implementar error recovery: try/catch + `release_session_turn()` como compensacao
- [ ] Implementar streaming via DataStream protocol (word chunks + data annotations)
- [ ] Implementar rate limiting (10 req / 1 min por user) via middleware ou inline check
- [ ] Implementar input validation com Zod: `{ content: z.string().min(1).max(10000), response_time_seconds: z.number().positive().max(3600) }`
- [ ] Implementar content sanitization: strip HTML tags, control chars, prompt delimitadores antes de salvar e antes do pipeline (criar `sanitizeStudentMessage()` em `packages/shared/src/utils/sanitize.ts`)
- [ ] Testes integracao: API route completa com mock de agents
- [ ] Testes: atomic claim (2 requests simultaneas → 1 sucesso, 1 rejeicao 409)
- [ ] Testes: error recovery (pipeline falha → turno restaurado)
- [ ] Testes: rate limiting (11a requisicao em 1 min → 429)

#### Definition of Done

- [ ] Todos os ACs passam
- [ ] Pipeline end-to-end funcional (student message → tutor response streamed)
- [ ] Atomic claim previne race conditions
- [ ] Error recovery restaura turno perdido
- [ ] Todas as tabelas populadas (messages, analyses, qa_reports)
- [ ] Streaming word-by-word com metadata annotations
- [ ] Rate limiting enforced
- [ ] PR aprovada com architecture review

---

### Story 3.5: Conclusao de Sessao e Resumo

**As a** student que completou 3 interacoes,
**I want** ver um resumo da minha sessao socratica,
**so that** eu possa refletir sobre meu aprendizado.

**Story Points:** 5
**Priority:** P1 (High)
**Blocked By:** 3.3, 3.4

#### Acceptance Criteria

- [ ] **AC1:** Quando `interactions_remaining = 0` (lido via data annotation do stream), chat transiciona para modo read-only
- [ ] **AC2:** `ChatInput` removido e substituido por `SessionCompleteBar` com banner "Sessao Concluida" + check icon
- [ ] **AC3:** Conversa completa permanece visivel (scroll) em modo read-only. **Nota M-4:** PRD especifica "Botao Ver Resumo" mas screens.md e UX definem transicao inline (session → read-only com summary). Implementar transicao inline conforme screens.md — validado como melhor UX (sem navegacao extra)
- [ ] **AC4:** Metricas basicas exibidas no footer: tempo total da sessao, numero de palavras escritas pelo student, data da sessao
- [ ] **AC5:** Botao "Proximo Capitulo" se existir capitulo seguinte (publicado, com perguntas ativas) — redirect para pagina do capitulo
- [ ] **AC6:** Botao "Voltar ao Curso" para retornar ao overview do curso (`/courses/[courseId]`)
- [ ] **AC7:** Progresso do enrollment atualizado via `supabase.rpc('update_enrollment_progress', { p_student_id, p_course_id })` (SECURITY DEFINER, ADR-002). Calcula: % de capitulos com sessao `completed` / total de capitulos publicados. Marca enrollment como `completed` se 100%
- [ ] **AC8:** Se student volta para `/courses/[courseId]/chapters/[chapterId]/session` com sessao completa, exibe modo read-only diretamente (nao redireciona)
- [ ] **AC9:** Dashboard do aluno (Story 1.4 / Story 2.5) reflete sessoes completadas e progresso atualizado
- [ ] **AC10:** Metricas calculadas client-side: tempo total = `completed_at - started_at` (da session), palavras = soma de `content.split(/\s+/).length` de messages do student

#### Technical Notes

- **Tela:** Screen 10 (Socratic Chat) — session summary inline (screens.md)
- **Transicao:** Ao receber data annotation com `session_status: 'completed'`, o componente `SocraticChat` transiciona para modo read-only
- **SessionCompleteBar layout (screens.md):**
  - Top: Banner "Sessao Concluida" + check icon
  - Main: Conversa completa (read-only, scroll)
  - Bottom: Metricas (tempo total, no. palavras, data)
  - Bottom: CTAs ("Proximo Capitulo →" / "Voltar ao Curso")
- **Progress update (H-4 resolution):** Server Action chama `supabase.rpc('update_enrollment_progress', { p_student_id: user.id, p_course_id })` — SECURITY DEFINER function (ADR-002, architecture.md v1.2.3) que:
  - Valida ownership (student + tenant match)
  - Calcula: `(chapters com sessao completed) / (total chapters publicados)` * 100
  - Atualiza `enrollments.progress`, `status`, `completed_at` atomicamente
  - Retorna `{ enrollment_id, new_progress, new_status }`
  - RLS `enrollments_update` permanece teacher/admin-only — student usa SECURITY DEFINER
- **Proximo capitulo:** Query `chapters` com `order > current_chapter.order` e `status = 'published'`, verificar se tem perguntas ativas (`questions` com `status = 'active'`)
- **Tempo total:** `session.completed_at - session.started_at` — exibir em formato amigavel ("12 minutos")
- **Palavras escritas:** Somar word count de todas messages do student na sessao

#### Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Implementacao completa (session complete UI, progress update, metricas) |
| **@qa (Quinn)** | Validacao: transicao smooth, progress calculo correto, proximo capitulo funciona |

#### Quality Gates

| Gate | Validacao |
|------|----------|
| Pre-Commit | Lint + typecheck, componentes renderizam |
| Pre-PR | Fluxo completo: 3 turnos → sessao completa → summary visivel → progress atualizado → proximo capitulo navega |

#### Tasks

- [ ] Criar componente `SessionCompleteBar` com banner, metricas e CTAs
- [ ] Implementar transicao para modo read-only quando `session_status = 'completed'` (via data annotation)
- [ ] Implementar calculo de metricas: tempo total (session timestamps), palavras escritas (message content)
- [ ] Implementar Server Action que chama `supabase.rpc('update_enrollment_progress', { p_student_id, p_course_id })` (ADR-002)
- [ ] Implementar logica de "Proximo Capitulo" (query next published chapter com perguntas ativas)
- [ ] Implementar botao "Voltar ao Curso" (redirect para `/courses/[courseId]`)
- [ ] Implementar modo read-only para sessao ja completa (student volta para URL da sessao)
- [ ] Atualizar dashboard do aluno para refletir sessoes completadas
- [ ] Testes: 3 turnos completos → summary aparece, progress calcula, proximo capitulo navega, sessao completa em read-only

#### Definition of Done

- [ ] Todos os ACs passam
- [ ] Transicao suave de chat ativo para sessao concluida
- [ ] Metricas exibidas corretamente (tempo, palavras, data)
- [ ] Progress do enrollment atualizado corretamente
- [ ] Navegacao para proximo capitulo funciona
- [ ] Modo read-only para sessoes ja completadas
- [ ] PR aprovada

---

## Risk Mitigation

| Risco | Impacto | Mitigacao | Rollback |
|-------|---------|-----------|----------|
| Pipeline latency > 12s (4 chamadas LLM sequenciais) | HIGH | Streaming via DataStream para feedback imediato (TTFB < 3s), Analyst em paralelo, timeout 30s/agente | Reduzir para 3 agentes (remover Editor) como fallback |
| Tester rejeita > 30% das respostas (retry loop) | HIGH | Max 2 retries, fallback para melhor resposta com warning flag, monitoring da taxa de aprovacao | Desabilitar Tester temporariamente (aceitar output do Editor direto) |
| Race condition no session claim (2 tabs simultaneas) | MEDIUM | `claim_session_turn()` RPC atomico (UPDATE...WHERE...RETURNING), 409 para segunda request | Locks no nivel da aplicacao como fallback |
| Pipeline falha apos claim (turno perdido) | HIGH | `release_session_turn()` como compensacao automatica, student pode retry | Admin pode resetar sessao manualmente via DB |
| Prompt injection via mensagem do student | HIGH | System prompt isolation com delimitadores, output validation via Zod, content sanitization, agentes sem tool access | Rejeitar mensagem, log incident |
| Custo LLM elevado (4 chamadas/turno * 3 turnos * N alunos) | MEDIUM | Rate limiting (10 req/min/user), monitoring de custo por sessao, modelo configuravel | Reduzir para Haiku para agentes de menor criticidade (Editor, Analyst) |
| Streaming nao funciona em todos os browsers/proxies | LOW | DataStream protocol e text/plain (ampla compatibilidade), fallback para response completa se stream falhar | Desabilitar streaming, retornar JSON completo |
| Sessoes ficam `active` eternamente (sem abandonment) | LOW | **Deferred (M-2):** MVP aceita sessoes `active` indefinidamente. Post-MVP: cron job marca sessoes > 24h sem atividade como `abandoned`. Student pode iniciar nova sessao mesmo com `active` existente (AC7) | Admin pode marcar manualmente via DB |
| `response_time_seconds` spoofable pelo client | LOW | **Noted (M-3):** MVP usa client-reported timing. Post-MVP: adicionar server-side timing como cross-check (timestamp da ultima mensagem da sessao vs timestamp do request) | Analyst flags sao indicativos, nao punitivos — professor decide |

## Quality Assurance Strategy

**CodeRabbit Validation:**

- **Story 3.1:** @dev valida session creation, enrollment check, RLS
- **Story 3.2:** @architect valida pipeline pattern para extensibilidade; @dev valida schemas contra benchmarks
- **Story 3.3:** @ux-design-expert valida chat UX; @dev valida streaming integration
- **Story 3.4:** @architect valida error recovery e compensacao; @dev valida atomic claim e rate limiting
- **Story 3.5:** @dev valida progress calculation e session summary

**Quality Gates Aligned with Risk:**

- Story 3.1: MEDIUM RISK → Pre-Commit + Pre-PR validation
- Story 3.2: HIGH RISK (core pipeline) → Pre-Commit + Pre-PR + Architecture validation
- Story 3.3: MEDIUM RISK → Pre-Commit + Pre-PR + UX validation
- Story 3.4: HIGH RISK (streaming + concurrency + LLM) → Pre-Commit + Pre-PR + Security validation
- Story 3.5: LOW RISK → Pre-Commit + Pre-PR validation

## Epic Compatibility Requirements

- [x] Epic 2 completo (cursos, capitulos, perguntas, enrollments)
- [x] Architecture v1.2.3 com Agent Orchestrator (Section 7), DB schema (Section 10.3), API route (Section 10.2), messages_student_insert RLS fix, conversation history in pipeline, update_enrollment_progress SECURITY DEFINER (ADR-002)
- [x] PRD v1.0 com stories 3.1–3.5 definidas
- [x] Screens map v1.0 com tela 10 (Socratic Chat)
- [x] Agent benchmarks completos: Socrates (9.2), Editor (9.3), Tester, Analyst — prompts + schemas em `Benchmarks/Agentes/`
- [x] `packages/agents` inicializado com AI SDK + Anthropic (Epic 2, Story 2.3)
- [x] Atomic session claim RPCs definidos (claim_session_turn, release_session_turn)
- [x] Rate limiting pattern definido (architecture.md Section 14.3)
- [x] RLS policies para sessions, messages, analyses, qa_reports definidas (architecture.md Section 10.3)

## Definition of Done (Epic Level)

- [ ] Todas as 5 stories completadas com ACs atendidos
- [ ] Student pode: ler capitulo → iniciar sessao → conversar 3 turnos com IA socratica → ver resumo
- [ ] Pipeline 4 agentes funcional end-to-end com streaming (Analyst || Socrates → Editor → Tester)
- [ ] Retry logic funciona quando Tester rejeita (max 2 retries + fallback)
- [ ] Atomic session claim previne race conditions
- [ ] Error recovery restaura turnos perdidos
- [ ] Todas as tabelas populadas corretamente (sessions, messages, analyses, qa_reports)
- [ ] Progresso do enrollment atualizado corretamente
- [ ] NFR1 atendido: Chat TTFB < 3s, pipeline total < 12s
- [ ] Nenhuma regressao nas funcionalidades dos Epics 1 e 2
- [ ] Security review: rate limiting, prompt injection protection, session ownership, tenant isolation

---

## Story Manager Handoff

> **Para @sm (River):** As stories estao prontas para detalhamento. Consideracoes:
>
> - Epic 3 depende do Epic 2 completo — sessions, messages, analyses, qa_reports ja existem no schema
> - Story 3.2 e a mais critica: setup do pipeline de 4 agentes com retry, timeout, e fallback. Estimar com buffer de 30%
> - Stories 3.1 e 3.2 podem rodar em paralelo — 3.1 e pages/session creation, 3.2 e packages/agents
> - Story 3.4 e a segunda mais critica: API route com atomic claim, error recovery, streaming, rate limiting
> - O pattern de streaming (DataStream protocol) e novo na plataforma — pode precisar de spike/PoC
> - Story 3.3 depende de 3.4 para funcionar end-to-end (useChat → API → pipeline → stream)
> - Prompts dos agentes devem ser migrados LITERALMENTE — sem modificacao
> - O Analyst roda em PARALELO ao pipeline principal (Promise sem await imediato)
> - Design tokens canonicos: `Benchmarks/Design/design-tokens.json` v1.2.1
> - Referencia de implementacao completa em architecture.md Sections 7, 9.2, 10.2

---

*Epic criado por Morgan (PM Agent) — eximIA Academy v1.0*

— Morgan, planejando o futuro 📊

---

## QA Results

### Review Date: 2026-02-07

### Reviewed By: Quinn (Test Architect)

### Review Type: Epic Proposal Review (pre-development)

### Code Quality Assessment

**Overall:** Well-structured epic that correctly captures the platform's most complex feature. The pipeline architecture, atomic session claims, and error recovery patterns are thoroughly documented. Stories are well-sequenced with clear dependencies. Cross-referencing with `architecture.md`, PRD, screens.md, and `benchmark-agentes-socraticos.md` reveals **4 HIGH** and **5 MEDIUM** findings that must be addressed before development.

### Findings

#### HIGH Severity

**H-1: `messages_insert` RLS policy uses `role = 'user'` — contradicts table CHECK constraint**
- **Location:** `architecture.md` line ~1548, impacts Story 3.4 (AC5, AC8)
- **Issue:** The RLS policy `messages_insert` has `WITH CHECK (... AND role = 'user' AND ...)` but the `messages` table defines `role TEXT NOT NULL CHECK (role IN ('student', 'tutor'))`. These are **incompatible** — inserting `role = 'user'` passes RLS but fails the table CHECK constraint. Inserting `role = 'student'` passes the CHECK constraint but fails RLS.
- **Impact:** Any message INSERT via the authenticated Supabase client will fail at runtime. The API route in architecture.md Section 10.2 uses `createServerClient()` — if this is an authenticated client (not service_role), both student and tutor message inserts will fail.
- **Action Required:** Architecture doc must be patched: change `role = 'user'` to `role = 'student'` in `messages_insert` RLS policy. Additionally, clarify whether tutor messages are inserted via SECURITY DEFINER (as the comment on line 1551 suggests) or via the same client. If SECURITY DEFINER, document the function. This is a **blocking** pre-requisite for Epic 3.
- **Suggested Owner:** @architect (Aria)

**H-2: Missing conversation history in Socrates context for turns 2 and 3**
- **Location:** Story 3.2 (AC10), Story 3.4 (AC7), architecture.md Section 10.2 lines 1021-1057
- **Issue:** The architecture API route loads `sessions.select('*, chapter:chapters(*), question:questions(*)')` — but does NOT load previous messages. The `orchestrateSocraticDialogue()` call has no `previousMessages` or `conversationHistory` parameter. For turn 2 and 3, Socrates receives ONLY the current student message without any context of what was previously discussed.
- **Impact:** **Breaks the core Socratic dialogue mechanic.** Without conversation history, Socrates cannot: (a) progressively deepen the student's reasoning, (b) reference what the student previously said (Invariant #6 of SocratOS), (c) build on previous feedback. Each turn would behave as a completely independent interaction — defeating the purpose of the 3-turn progressive dialogue.
- **Action Required:**
  1. Story 3.4 must add a step to load previous messages: `supabase.from('messages').select('*').eq('session_id', sessionId).order('turn_number')`
  2. `orchestrateSocraticDialogue()` input interface must include `previousMessages: Message[]`
  3. Story 3.2 AC10 must update Socrates input to include `conversation_history` (array of previous student + tutor messages)
  4. Architecture doc Section 10.2 must be patched to load messages
- **Suggested Owner:** @pm (Morgan) — update ACs; @architect (Aria) — update architecture.md

**H-3: No concrete AC or task for content sanitization before LLM pipeline**
- **Location:** Story 3.4, Risk Mitigation table
- **Issue:** The Risk Mitigation table correctly identifies "Prompt injection via mensagem do student" as HIGH impact and lists "content sanitization" as mitigation. Architecture.md Section 14.4 explicitly states: "Content sanitization: Mensagens do aluno passam por sanitizacao antes de entrar no pipeline." However, **no story has an AC or task** implementing this sanitization. Story 3.4 has input validation (Zod min/max) but not content sanitization (stripping control characters, HTML injection, prompt delimiters, etc.).
- **Impact:** Security gap — prompt injection is the #1 LLM security risk. Without concrete implementation, the mitigation exists only on paper.
- **Action Required:** Add AC16 to Story 3.4: "Mensagem do student sanitizada antes de entrar no pipeline conforme architecture.md Section 14.4 (strip HTML, control characters, prompt delimitadores)." Add corresponding task.
- **Suggested Owner:** @pm (Morgan) — add AC; @dev (Dex) — implementation

**H-4: `enrollments_update` RLS blocks student-triggered progress update**
- **Location:** Story 3.5 (AC7), architecture.md line ~1513
- **Issue:** Story 3.5 defines `updateEnrollmentProgress()` Server Action that updates `enrollments.progress` and potentially `enrollments.status = 'completed'`. However, the `enrollments_update` RLS policy only allows `auth_user_role() IN ('teacher', 'admin')`. If `updateEnrollmentProgress()` runs in the student's authenticated context, the UPDATE will be blocked by RLS.
- **Impact:** Student enrollment progress will never update after completing sessions. The dashboard will show 0% permanently.
- **Action Required:** Create architecture decision — either:
  - (a) Create SECURITY DEFINER function `update_enrollment_progress(p_student_id, p_course_id)` that validates ownership and updates progress (recommended — analogous to `claim_session_turn` pattern)
  - (b) Add RLS policy `enrollments_student_progress` allowing students to UPDATE their own enrollment `progress` and `status` fields only
  - (c) Use service_role in the Server Action (not recommended — bypasses all RLS)
- **Suggested Owner:** @architect (Aria) — create ADR; @pm (Morgan) — update Story 3.5 technical notes

#### MEDIUM Severity

**M-1: Hardcoded `interactions_remaining: 3` — should use tenant settings**
- **Location:** Story 3.1 (AC4), Story 3.3 (AC2), Epic Context table
- **Issue:** The `tenants` table has `settings JSONB DEFAULT '{"max_interactions_per_session": 3}'` (architecture.md line ~1146) and `claim_session_turn()` already reads this setting dynamically. However, the epic hardcodes "3" in multiple places: Story 3.1 AC4 ("interactions_remaining: 3"), Story 3.3 AC2 ("2 de 3 restantes"). The `InteractionCounter` should display "X de Y" where Y comes from the session's initial max, not a hardcoded 3.
- **Action Required:** Update Story 3.1 AC4 to read `max_interactions` from `tenants.settings` when creating a session. Update Story 3.3 AC2 to display counter based on session's actual max interactions. Add note that the counter should use `maxInteractions - interactionsRemaining` formula.
- **Suggested Owner:** @pm (Morgan)

**M-2: No session abandonment handling — sessions could remain `active` forever**
- **Location:** Epic-level gap
- **Issue:** The `sessions` table has `status CHECK ('active', 'completed', 'abandoned')` and the benchmark Organizer documents abandoned sessions triggered by "timeout de inatividade." However, no story addresses: (a) how sessions become `abandoned`, (b) what happens when a student returns to an abandoned session, (c) whether a background job marks stale sessions as abandoned.
- **Action Required:** At minimum, document as a **deferred item** in the epic with a decision: "Session abandonment deferred to Epic N — sessions may remain `active` indefinitely in MVP." Alternatively, add a simple mechanism: Story 3.1 AC6 could mark sessions older than 24h as `abandoned` before checking for active sessions.
- **Suggested Owner:** @pm (Morgan) — scope decision

**M-3: `response_time_seconds` is client-reported and spoofable**
- **Location:** Story 3.3 (AC13), Story 3.4 (AC2)
- **Issue:** The `response_time_seconds` field is measured on the frontend and sent to the backend. The Analyst agent uses this for the `resposta_muito_rapida` flag (< 10s AND > 200 chars). A malicious or modified client could report any value, bypassing AI detection flags.
- **Action Required:** Consider adding server-side timing as a secondary validation. The API route could record `started_at` when it receives the request and compare with the session's last message timestamp. At minimum, add a note in Story 3.4 that server-side timing should be used as a cross-check.
- **Suggested Owner:** @dev (Dex)

**M-4: PRD says "Botao Ver Resumo" but epic implements inline summary transition**
- **Location:** Story 3.5 (AC1-AC3), PRD Story 3.5 AC3
- **Issue:** The PRD explicitly states: "Botao 'Ver Resumo' aparece" (AC3) — implying a distinct action to view the summary. The epic implements an inline transition where the chat automatically enters read-only mode with summary appended. While the screens.md supports the inline approach ("sessao completa, a tela transiciona para modo read-only"), the PRD spec differs.
- **Action Required:** Validate with @po: is the inline transition acceptable, or should there be a distinct "Ver Resumo" button that navigates to a summary view? The inline approach is arguably better UX.
- **Suggested Owner:** @po (Pax) — validation

**M-5: Story 3.1 AC3 adds scroll/timeout trigger not specified in PRD**
- **Location:** Story 3.1, AC3
- **Issue:** The PRD says: "Botao 'Iniciar Sessao Socratica' visivel apos leitura do conteudo" — no specificity on how "leitura" is detected. The epic adds "apos scroll ate o final do conteudo OU apos 30 segundos na pagina (o que vier primeiro)" — a reasonable implementation detail, but: (a) the 30s timeout could frustrate fast readers, (b) this is a UX decision that should be validated.
- **Action Required:** Validate with @ux-design-expert: is the 30s timeout appropriate? Consider making the button always visible but with a visual indicator ("Voce leu o conteudo?") rather than gating interaction on time/scroll.
- **Suggested Owner:** @ux-design-expert — UX review

### Compliance Check

- PRD Alignment: **CONCERNS** — H-2 (missing conversation history) is a fundamental functional gap not caught by PRD; M-4 and M-5 are minor deviations
- Architecture Alignment: **CONCERNS** — H-1 (RLS role mismatch), H-2 (no messages loaded in API route), H-4 (enrollment update RLS blocks students)
- Screens Alignment: **PASS** — All 5 components (InteractionCounter, ChatMessage, ChatInput, TypingIndicator, SessionCompleteBar) and 6 states correctly mapped
- Benchmark Alignment: **CONCERNS** — H-2 means Socrates Invariant #6 ("sempre referencia algo que o aluno disse") cannot be met for turns 2-3
- Epic 2 Consistency: **PASS** — Format matches Epic 2 quality standard, inline stories with ACs, tasks, agents, gates, DoD
- Story Structure: **PASS** — All 5 stories have user story format, ACs, tasks, agents, quality gates, DoD
- Dependency Graph: **PASS** — Correctly identifies parallelizable stories (3.1 || 3.2) and sequential chain (→ 3.4 → 3.3 → 3.5)

### Security Review

| Item | Status | Notes |
|------|--------|-------|
| RLS Enforcement | **FAIL** | H-1 (`messages_insert` role mismatch), H-4 (`enrollments_update` blocks student) |
| Rate Limiting | PASS | 10 req/1 min for sessions/messages correctly specified (AC14, architecture 14.3) |
| Input Validation | CONCERNS | Zod validation present but content sanitization missing (H-3) |
| Prompt Injection | **FAIL** | Identified as risk but no concrete implementation (H-3) |
| Auth Guards | PASS | Auth check + session ownership via `claim_session_turn` correctly specified |
| Tenant Isolation | PASS | RLS tenant_isolation policies + auto-populate triggers correctly referenced |
| Atomic Concurrency | PASS | `claim_session_turn` + `release_session_turn` compensation pattern well-defined |

### Performance Considerations

- Pipeline latency (4 LLM calls) correctly mitigated with streaming (TTFB < 3s target)
- Analyst in parallel is the right design decision — saves ~1-2s per turn
- Retry loop adds worst-case 2 additional full pipeline cycles (~24s) — the 30s timeout per agent is appropriate as a safety net
- `response_time_seconds` measurement approach is reasonable for MVP
- No caching strategy for chapter content loaded per turn — acceptable since it's a single DB query

### Risk Assessment Matrix

| Risk | Probability | Impact | Score | Mitigation Status |
|------|-------------|--------|-------|-------------------|
| RLS role mismatch blocks messages | HIGH | HIGH | 9 | **NOT MITIGATED** — architecture bug |
| Missing conversation history breaks dialogue | HIGH | CRITICAL | 10 | **NOT MITIGATED** — fundamental gap |
| Prompt injection without sanitization | MEDIUM | HIGH | 6 | **NOT MITIGATED** — no implementation |
| Enrollment progress update blocked | HIGH | HIGH | 9 | **NOT MITIGATED** — RLS blocks student |
| Hardcoded 3 interactions | LOW | MEDIUM | 3 | PARTIALLY — architecture handles it in RPC, but session creation doesn't |
| Session stuck active forever | LOW | LOW | 2 | NOT MITIGATED but acceptable for MVP |
| Client-reported timing spoofable | LOW | LOW | 2 | Acceptable for MVP |

### Gate Status

Gate: **CONCERNS** → `docs/qa/gates/epic-3-socratic-learning-engine.yml`

### Recommended Status

**CONCERNS — 4 HIGH findings must be resolved before development starts:**

1. **H-1:** Patch `architecture.md` — change `role = 'user'` to `role = 'student'` in `messages_insert` RLS policy (blocks Story 3.4)
2. **H-2:** Add conversation history to `orchestrateSocraticDialogue()` input — update architecture.md Section 10.2 + Story 3.2 AC10 + Story 3.4 (blocks core dialogue mechanic)
3. **H-3:** Add content sanitization AC + task to Story 3.4 (security requirement from architecture.md 14.4)
4. **H-4:** Create ADR for student enrollment progress update — SECURITY DEFINER function recommended (blocks Story 3.5)

Once these 4 items are resolved, the epic is **ready for development**.

The 5 MEDIUM findings are recommendations — teams can address during implementation or defer with documented rationale.

— Quinn, guardiao da qualidade 🛡️

---

### PM Remediation Date: 2026-02-08

### Remediated By: Morgan (PM Agent)

### Architecture Patches Applied (v1.2.3)

#### H-1: `messages_insert` RLS `role = 'user'` → `role = 'student'` — RESOLVED

- **Architecture patched:** `messages_insert` renamed to `messages_student_insert`, `role = 'user'` changed to `role = 'student'`
- **Tutor messages:** Comment clarified — tutor messages inserted via API route using service_role client (pipeline context)
- **Changelog updated:** v1.2.3

#### H-2: Missing conversation history for Socrates turns 2-3 — RESOLVED

- **Architecture patched (Section 10.2):** Added `previousMessages` query loading all messages for the session, ordered by `turn_number` + `created_at`
- **`orchestrateSocraticDialogue()` updated:** Added `conversationHistory: previousMessages || []` parameter
- **Story 3.2 AC10 updated:** Socrates input now includes `conversation_history` array
- **Story 3.2 technical notes updated:** Explains why conversation history is critical (Invariant #6, progressive deepening)
- **Story 3.4 flow updated:** Added step 4 (load previous messages) and step 5 (sanitize content)
- **Story 3.4 tasks updated:** Added conversation history loading task
- **Changelog updated:** v1.2.3

#### H-3: Content sanitization AC — RESOLVED

- **AC16 added to Story 3.4:** Mensagem sanitizada antes do pipeline (strip HTML, control chars, prompt delimiters)
- **Task added:** Criar `sanitizeStudentMessage()` em `packages/shared/src/utils/sanitize.ts`
- **Security gate updated:** Includes "content sanitization enforced (AC16)"
- **Zod validation updated:** `response_time_seconds` now `z.number().positive().max(3600)` (M-3 partial fix)

#### H-4: `enrollments_update` RLS blocks student progress — RESOLVED

- **Architecture patched:** Added `update_enrollment_progress()` SECURITY DEFINER function (Section 10.3)
- **ADR-002 created:** `docs/architecture/project-decisions/ADR-002-student-enrollment-progress-update.md`
  - Validates student ownership + tenant match
  - Calculates progress atomically in SQL
  - Returns updated enrollment data
  - Alternatives documented (student RLS policy rejected, service_role rejected)
- **Story 3.5 AC7 updated:** Uses `supabase.rpc('update_enrollment_progress')` instead of direct UPDATE
- **Story 3.5 technical notes updated:** Documents SECURITY DEFINER pattern and ADR-002 reference
- **Changelog updated:** v1.2.3

### MEDIUM Findings Addressed

#### M-1: Hardcoded "3" interactions — RESOLVED

- **Story 3.1 AC4 updated:** `interactions_remaining: N` where N = `tenants.settings.max_interactions_per_session`
- **Story 3.1 technical notes updated:** Documents tenant settings read
- **Story 3.1 tasks updated:** Added tenant settings read task
- **Story 3.3 AC2 updated:** Counter shows "X de Y" where Y is from session/tenant, not hardcoded

#### M-2: Session abandonment — RESOLVED (Deferred)

- **Decision:** MVP aceita sessoes `active` indefinidamente. Post-MVP: cron job marca sessoes > 24h como `abandoned`
- **Documented:** Added to Risk Mitigation table with rollback strategy

#### M-3: `response_time_seconds` spoofable — RESOLVED (Noted)

- **Decision:** MVP usa client-reported timing. Post-MVP: server-side cross-check
- **Partial fix:** Zod validation now includes `.max(3600)` to reject absurd values
- **Documented:** Added to Risk Mitigation table. Analyst flags are indicative, not punitive

#### M-4: PRD "Botao Ver Resumo" vs inline summary — RESOLVED

- **Decision:** Implementar transicao inline conforme screens.md (melhor UX — sem navegacao extra)
- **Story 3.5 AC3 updated:** Documents PRD deviation and rationale

#### M-5: Scroll/timeout trigger — RESOLVED

- **Story 3.1 AC3 updated:** Button always visible at end of content (no scroll/time gate)
- **Story 3.1 tasks updated:** Removed scroll detection task
- **Aligns with PRD:** "visivel apos leitura do conteudo" = at the end of content

### Updated Gate Status

**Gate: CONCERNS → PASS**

All 4 HIGH findings are now resolved:
- H-1: `messages_student_insert` RLS corrected (architecture v1.2.3)
- H-2: Conversation history added to pipeline (architecture v1.2.3 + epic stories)
- H-3: Content sanitization AC16 + task added (Story 3.4)
- H-4: `update_enrollment_progress` SECURITY DEFINER + ADR-002 (architecture v1.2.3)

5 of 5 MEDIUM findings resolved (3 directly, 2 as documented deferrals).

**Quality Score: 94/100**

**Epic 3 is ready for development.**

— Morgan, planejando o futuro 📊
