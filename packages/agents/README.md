# @eximia/agents

Pipeline de IA da plataforma. Concentra todos os prompts de sistema, schemas de saída, roteamento de modelo e orquestração de agentes usados pelo produto.

Nada aqui fala com o banco nem com o Next.js. O package expõe funções puras de "entra input, sai objeto validado por Zod"; persistência é injetada pelo chamador (ver [Shadow Pipeline](#shadow-pipeline)). Isso mantém o package testável fora do runtime do Next.

Para o **contrato de produto** do Motor Socrático (o que o tutor pode e não pode fazer pedagogicamente), ver `docs/features/motor-socratico.md`. Este README cobre **como o código funciona**.

---

## Stack

| Item | Escolha |
|---|---|
| SDK | Vercel AI SDK v6 (`ai`), via `generateObject` |
| Providers | `@ai-sdk/openai` e `@ai-sdk/google` |
| Validação | `zod` v3 — todo agente tem schema de saída |
| Telemetria | `@sentry/node`, com degradação para no-op |
| Testes | `vitest` (`pnpm --filter @eximia/agents test`) |

Todo agente usa `generateObject`, nunca `generateText`. A saída é sempre estruturada e validada pelo schema correspondente em `src/schemas/`.

## Entry points

```json
{
  ".": "./src/index.ts",
  "./course-designer": "./src/course-designer/index.ts",
  "./course-designer/content-analyzer": "./src/course-designer/content-analyzer.ts"
}
```

O package é consumido como TypeScript cru (`main` aponta para `src/index.ts`, não há build step). Por isso `apps/web/next.config.ts` o inclui em `transpilePackages`.

---

## Os prompts

Um arquivo por prompt em `src/prompts/`, cada um exportando uma constante `*_SYSTEM_PROMPT`. Os prompts são strings longas em português, com estrutura fixa: identidade, missão, "você NÃO faz", regras, formato de saída.

| Prompt | Papel |
|---|---|
| `socrates` | O tutor. Conduz o diálogo com o aluno, produz feedback + pergunta. É o único agente cuja saída chega ao aluno. |
| `editor` | Polidor. Remove rótulos artificiais (`[Feedback]`, `[Pergunta]`), força 2 parágrafos, preserva o significado. Não pode mudar o conteúdo. |
| `tester` | QA. Valida a resposta editada contra 6 critérios (C1..C6) e emite `APPROVED` ou `REJECTED` com score 0–1. |
| `analyst` | Analisa a mensagem do **aluno**: métricas da interação e probabilidade de texto gerado por IA. Nunca bloqueia nem penaliza. |
| `creator` | Gera até 3 perguntas socráticas a partir do conteúdo de um capítulo. |
| `organizer` | Transforma texto bruto (transcrição, PDF, documento) em curso estruturado com capítulos. Exporta também `ORGANIZER_CHUNK_SYSTEM_PROMPT` para conteúdo grande. |
| `enricher` | Três prompts (`QUERY`, `EVAL`, `INCORPORATE`) para gerar queries de busca, avaliar fontes encontradas e incorporá-las ao capítulo. |
| `profiler` | Analisa uma sessão socrática **concluída** e produz padrões observáveis de aprendizagem. |
| `detector` | Analista shadow. Lê cada turno em 3 camadas: padrões cognitivos, detecção de IA, análise linguística. Nunca interage com o aluno. |
| `perfilador` | Constrói e mantém o perfil de aprendizagem acumulado do aluno, incluindo detecção implícita de estilo Kolb. Roda sobre os dados do Detector. |

Há um 11º prompt fora dessa pasta: `src/course-designer/prompts/auditor.ts`, usado pelo auditor de curso do Course Designer.

---

## Orchestrator — o pipeline socrático

`src/orchestrator.ts`, função `orchestrateSocraticDialogue`. É o coração do produto.

**Não existe roteamento condicional entre prompts.** O orchestrator não "decide qual prompt usar": a cadeia é fixa e sempre a mesma —

```
Socrates → Editor → Tester
```

O que varia é o **retry**. Se o Tester devolve `REJECTED`, o loop reinicia do Socrates passando `tester.recommendation` como `testerFeedback`, e o Socrates tenta de novo com essa crítica no prompt. Até `maxRetries` (default 2, ou seja, até 3 tentativas).

```ts
for (let attempt = 0; attempt <= fullConfig.maxRetries; attempt++) {
  const socratesResult = await runSocrates(input, fullConfig, testerFeedback, input.tenantPlan)
  const editorResult   = await runEditor(responseContent, ctx, fullConfig, input.tenantPlan)
  const testerResult   = await runTester(editedContent, ctx, fullConfig, input.tenantPlan)

  if (tester.score > bestScore) {  // guarda a melhor tentativa até agora
    bestScore = tester.score
    bestResponse = editedContent
    bestQaReport = tester
  }

  if (tester.verdict === "APPROVED") return { /* ... */ warning: false }

  testerFeedback = tester.recommendation  // realimenta o Socrates
}

// esgotou as tentativas: devolve a melhor resposta com warning: true
return { response: bestResponse, /* ... */ warning: true }
```

Duas propriedades importantes:

- **O pipeline nunca falha em silêncio nem devolve vazio.** Esgotadas as tentativas, devolve a resposta de maior score com `warning: true`. Cabe ao chamador decidir o que fazer com essa flag.
- **`usage` é acumulado nas 3 etapas e em todas as tentativas** (`inputTokens`/`outputTokens` somados), o que permite ao chamador calcular custo com `MODEL_PRICING`.

Cada etapa roda dentro de um `startSpan` do Sentry (`op: "ai.pipeline"`) com atributos `agent.name`, `agent.step` e `agent.retry_count`, e sob `withTimeout` (default 30s, via `AbortSignal` repassado ao `generateObject`).

### Injeção de contexto no Socrates

`runSocrates` monta o prompt de usuário concatenando blocos condicionais — só entra o que existe:

- conteúdo do capítulo e pergunta inicial (sempre);
- `interactionType` e `bloomTarget`, este último traduzido para faixa de profundidade via `bloomDepthMap` (`analyzing` → `"4-5"`);
- histórico da conversa;
- `testerFeedback` da tentativa anterior;
- perfil do aluno, via `buildStudentProfileContext`.

`buildStudentProfileContext` converte dados psicométricos em instruções em linguagem natural: Big Five, Eneagrama, DISC, Inteligências Múltiplas e os `adaptation_hints` do perfil de IA viram linhas do tipo *"Baixa extroversão — dê tempo para reflexão, não pressione por respostas rápidas"*. Todo campo de texto livre passa por `sanitizeProfileText` (remove `#<>{}[]`, colapsa quebras de linha, corta em 200 chars) — é defesa contra prompt injection via campo de perfil preenchido pelo usuário.

---

## Model Router

`src/model-router.ts`. Resolve **qual modelo instanciar** a partir de dois eixos: o papel do agente e o plano do tenant.

```ts
export type AgentRole = "mestre" | "polidor" | "guardiao" | "detector" | "perfilador" | "analyst"
export type TenantPlan = "essencial" | "standard" | "premium"
```

Os papéis são a nomenclatura interna do router e não batem 1:1 com os nomes dos prompts: `mestre` = Socrates (e também Creator, Organizer e Enricher, que reusam o papel), `polidor` = Editor, `guardiao` = Tester.

A `ROUTING_TABLE` é um `Record<TenantPlan, Record<AgentRole, ModelSpec>>` — uma matriz explícita, sem heurística. Exemplo do que muda entre planos: no `essencial` o `mestre` é `gpt-4.1-mini`; no `standard` e `premium`, `gpt-4.1`. O `guardiao` é `gpt-4.1` em todos os planos (o QA não é onde se economiza).

Há uma exceção codificada em `getModelSpec`:

```ts
if (plan === "standard" && ctx.agentRole === "mestre" && ctx.interactionType === "quiz") {
  return spec("openai", "gpt-4.1-mini", OPENAI_KEY)
}
```

### Como OpenAI vs Google é escolhido

**Não é escolha por qualidade nem por tarefa — é fallback por disponibilidade de chave.** A tabela de roteamento aponta hoje 100% para OpenAI. O Google entra só quando a chave da OpenAI não está no ambiente:

```ts
const FALLBACK_CHAINS: Record<string, ModelSpec[]> = {
  "gpt-4.1":      [spec("openai", "gpt-4.1-mini", OPENAI_KEY), spec("google", "gemini-2.5-pro",   GOOGLE_KEY)],
  "gpt-4.1-mini": [spec("openai", "gpt-4.1-nano", OPENAI_KEY), spec("google", "gemini-2.5-flash", GOOGLE_KEY)],
}

export function getModelWithFallback(ctx: RoutingContext): LanguageModel {
  const primary = getModelSpec(ctx)
  const candidates = [primary, ...(FALLBACK_CHAINS[primary.model] ?? [])]
  for (const candidate of candidates) {
    if (hasApiKey(candidate.apiKeyEnv)) return createModelInstance(candidate)
  }
  throw new ModelRouterError(ctx.agentRole, ctx.tenantPlan ?? "standard", candidates.map(c => c.apiKeyEnv))
}
```

`hasApiKey` só checa `process.env[envVar]` — presença, não validade. Uma chave presente porém inválida não dispara fallback; falha no provider.

Os providers são carregados por `require` preguiçoso e memoizado (`getOpenAIProvider`/`getGoogleProvider`), para não importar o SDK do Google em runtime que nunca vai usá-lo.

`MODEL_PRICING` exporta custo por token (input/output) dos 5 modelos da tabela, para o cálculo de custo no chamador.

### Override explícito

Em `orchestrator.ts`, `selectModel` permite bypass total do router:

```ts
function selectModel(role: AgentRole, config: AgentPipelineConfig, tenantPlan?: TenantPlan): LanguageModel {
  if (config.model !== DEFAULT_PIPELINE_CONFIG.model) return openai(config.model)  // override → sempre OpenAI, sem fallback
  return getModelWithFallback({ agentRole: role, tenantPlan })
}
```

Ou seja: passar `model` explicitamente no input **desliga o roteamento por plano e o fallback**. É o que os testes e o health check usam. Em produção, deixe `model` indefinido.

---

## Shadow Pipeline

`src/shadow-pipeline.ts`. Apesar do nome, **não é um mecanismo de comparação nem de A/B testing de modelos.** É um pipeline de *observação* que roda em paralelo ao diálogo, em modo fire-and-forget, e nunca influencia a resposta enviada ao aluno. "Shadow" no sentido de invisível ao aluno, não no sentido de shadow-deploy.

Fluxo de `executeShadowPipeline`:

1. **Detector roda sempre**, a cada turno. Analisa a mensagem do aluno + resposta do tutor + histórico + capítulo (truncado em 3000 chars).
2. O resultado vira update nos analytics da sessão via `buildAnalyticsUpdate` — padrões cognitivos, arco emocional, progressão de profundidade, detecção de IA e um vetor Kolb da sessão derivado da análise linguística.
3. **Perfilador roda condicionalmente**, só quando `shouldRunPerfilador(turnNumber, interval)` — isto é, a cada 5 turnos (`turnNumber % 5 === 0`). Ele recebe o perfil existente + a saída do Detector e produz o perfil atualizado.
4. `mergeProfileData` faz merge **incremental**: médias móveis para `avg_depth_achieved`, `avg_qa_score` e os eixos Kolb; união deduplicada para `strengths`; e teto de confiança por número de sessões:

```ts
function calculateConfidence(sessions: number, newConfidence: number): number {
  if (sessions <= 1)  return Math.min(newConfidence, 0.15)
  if (sessions < 3)   return Math.min(newConfidence, 0.3)
  if (sessions <= 10) return Math.min(newConfidence, 0.7)
  return Math.min(newConfidence, 0.9)
}
```

O teto existe porque o Perfilador tende a se declarar confiante cedo demais; a confiança é limitada pela evidência acumulada, não pelo que o modelo acha. Nunca chega a 1.0.

**Persistência é injetada**, não importada. O package define a interface e o app implementa:

```ts
export interface ShadowPersistence {
  getExistingProfile:      (studentId: string, tenantId: string) => Promise<ExistingLearnerProfile | null>
  getSessionAnalytics:     (sessionId: string) => Promise<Record<string, unknown>>
  updateSessionAnalytics:  (sessionId: string, analytics: Record<string, unknown>) => Promise<void>
  upsertLearnerProfile:    (studentId: string, tenantId: string, data: Record<string, unknown>) => Promise<void>
}
```

Toda falha é capturada e reportada ao Sentry, devolvida em `detectorError`/`perfiladorError`, e **nunca propagada** — se o Detector cai, o aluno não percebe.

---

## Demais agentes

| Função | Arquivo | Nota de implementação |
|---|---|---|
| `runAnalyst` | `analyst.ts` | Tem **circuit breaker**: em qualquer erro que não seja timeout, devolve resultado neutro (`probability: 0.5`, `verdict: "uncertain"`) em vez de lançar. A análise nunca derruba o envio da mensagem. |
| `generateQuestions` | `creator.ts` | Timeout de 2 min via `AbortSignal.timeout`. Usa o papel `mestre`. |
| `organizeContent` | `organizer.ts` | Acima de 60k chars, quebra o texto em chunks respeitando limites de parágrafo (com 500 chars de overlap), processa **sequencialmente** com o prompt de chunk, e faz merge renumerando capítulos. Distribui `max_chapters` entre os chunks para evitar explosão. 2 tentativas com backoff exponencial por chunk. |
| `generateSearchQueries` / `evaluateSources` / `incorporateSources` | `enricher.ts` | Três chamadas independentes; o chamador é que executa a busca web entre a primeira e a segunda. |
| `runProfiler` | `profiler.ts` | Roda ao **fim** da sessão, sobre a conversa inteira + scores de QA. Distinto do Perfilador (que roda durante). |
| `evaluateClosing` | `closing.ts` | Lógica **determinística, sem LLM**. Decide `is_closing`/`suggest_closing` por limite duro, mínimo de 3 turnos, e os thresholds de smart closing (profundidade, insights, interações restantes). `buildClosingPromptSection` traduz as flags em texto injetado no prompt do Socrates. |
| `designCourse` | `course-designer/orchestrator.ts` | Pipeline de 5 fases (Analyzer → Architect → Calculator → Validator → Generator) delegando a `@eximia/course-designer`. Timeout total de 5 min, suporta `abortSignal` (para cancelamento de SSE) e `resumeFrom` (retry parcial a partir de fases já concluídas). Quality gate: veredito ruim dispara 1 retry silencioso das fases 2–4; persistindo, marca `requires_instructor_review`. |

### Utilitários

- `withTimeout(fn, ms, agentName)` — cria o `AbortController`, repassa o signal para o `generateObject` e lança `AgentTimeoutError`. Todo agente deve usar.
- `isRetryableError(err)` — erros de validação/schema/parse são **não** retryable; rate limit, rede e 5xx são. Default é retryable.
- `getBackoffDelay(attempt)` — exponencial com teto de 30s.
- `normalizeChapterMarkdown` — pós-processa a hierarquia de headings do conteúdo gerado pelo Organizer.
- `captureException` / `startSpan` (`telemetry.ts`) — wrapper fino sobre Sentry que degrada para no-op se `@sentry/node` não resolver, permitindo usar o package fora do Next.

---

## Adicionar um prompt novo

Convenção estabelecida, quatro arquivos. Exemplo hipotético de um agente `revisor`:

1. **Schema** — `src/schemas/revisor.ts`. Sempre Zod, sempre com o tipo inferido exportado:

   ```ts
   export const revisorOutputSchema = z.object({
     verdict: z.enum(["OK", "REVISAR"]),
     notes: z.array(z.string()),
   })
   export type RevisorOutput = z.infer<typeof revisorOutputSchema>
   ```

2. **Prompt** — `src/prompts/revisor.ts`, exportando `REVISOR_SYSTEM_PROMPT`. Siga a estrutura dos existentes: identidade, missão, "você NÃO faz", regras, formato de saída.

3. **Runner** — `src/revisor.ts`. Sempre `generateObject` + `getModelWithFallback` + `withTimeout`:

   ```ts
   export async function runRevisor(input: RevisorInput, config: { tenantPlan?: TenantPlan } = {}) {
     const result = await withTimeout(
       (signal) => generateObject({
         model: getModelWithFallback({ agentRole: "guardiao", tenantPlan: config.tenantPlan }),
         system: REVISOR_SYSTEM_PROMPT,
         prompt: buildRevisorPrompt(input),
         schema: revisorOutputSchema,
         abortSignal: signal,
       }),
       30_000,
       "Revisor",
     )
     return result.object
   }
   ```

4. **Export** — adicione o bloco em `src/index.ts` (função, prompt, schema e tipos), seguindo o padrão de comentário por epic já usado no arquivo.

Se o agente precisar de um papel novo no router (em vez de reusar `mestre`/`polidor`/`guardiao`), acrescente o valor ao union `AgentRole` — o TypeScript vai exigir que você preencha a entrada correspondente nos **três** planos da `ROUTING_TABLE`. Isso é proposital: não existe plano sem modelo definido.

Testes ficam em `tests/`. Schemas têm suíte própria em `tests/schemas.test.ts` cobrindo caso válido e caso inválido — o mínimo esperado para um agente novo.

---

## Quem consome

O único consumidor é `apps/web`. Exemplos reais:

**Diálogo socrático** — `apps/web/src/app/api/sessions/[sessionId]/messages/route.ts`. É a rota que usa mais do package de uma vez:

```ts
import { orchestrateSocraticDialogue, runAnalyst, executeShadowPipeline, type OrchestratorInput } from "@eximia/agents"

// bloqueante: a resposta do pipeline é o que vai para o aluno (streamed)
const result = await orchestrateSocraticDialogue({ sessionId, studentMessage, chapterContent, question, ... })

// fire-and-forget: não bloqueia o stream, erro só vai para o Sentry
executeShadowPipeline(
  { sessionId, studentId: user.id, tenantId: session.tenant_id, tutorResponse: result.response, ... },
  createShadowPersistence(serviceClient),
).catch((err) => Sentry.captureException(err, { tags: { pipeline: "shadow", session_id: sessionId } }))
```

Note o contraste de tratamento: o orchestrator é `await`ado, o shadow não. `runAnalyst` fica no meio — roda em paralelo via promise iniciada antes do pipeline.

**Geração de perguntas** — `apps/web/src/app/api/chapters/[chapterId]/generate-questions/route.ts`:

```ts
import { type CreatorOutput, creatorInputSchema, generateQuestions } from "@eximia/agents"
```

**Ingestão de conteúdo** — `apps/web/src/app/api/ingestion/[id]/process/route.ts` importa `organizeContent`.

**Course Designer** — `apps/web/src/app/api/course-designer/generate/route.ts` usa os dois entry points ao mesmo tempo:

```ts
import { getModelWithFallback } from "@eximia/agents"
import { designCourse, DesignOrchestratorTimeoutError, ... } from "@eximia/agents/course-designer"
```

**Outros:** `src/lib/course-enrichment.ts` (trio do Enricher), `src/lib/profiling.ts` (`runProfiler`), `src/lib/shadow-persistence.ts` (implementa `ShadowPersistence`).

**Health check** — `apps/web/src/app/api/health/pipeline/route.ts` exercita o package em camadas (import → model router → `generateObject` mínimo → pipeline socrático completo), retornando 503 na primeira que falhar. É o caminho mais rápido para diagnosticar problema de chave de API ou de provider em produção.

---

## Notas

- `buildLearnerProfileContext` e `sanitizeProfileForPrompt` (`src/profile-context.ts`) estão exportados no `index.ts` mas **não têm consumidor** hoje — nem dentro do package, nem em `apps/web`. O orchestrator usa sua própria `buildStudentProfileContext` interna, que lê o perfil vindo de `users.profile`, não o `ExistingLearnerProfile` produzido pelo Perfilador. Ou seja: o perfil que o shadow pipeline constrói ainda não realimenta o prompt do tutor por essa via.
- Os prompts mais antigos ainda se identificam como "plataforma Harven.AI" (`socrates`, `editor`, `tester`, `analyst`, `creator`, `organizer`, `profiler`); os do Epic 17 já dizem "eximIA Academy" (`detector`, `perfilador`). Herança do produto anterior, não intencional.
- Vários prompts contêm erros de acentuação e caracteres corrompidos (`ésta`, `cursó`, `apróximadamente`). Não corrija em massa sem medir: prompt é entrada de modelo, mudança de texto muda comportamento.
