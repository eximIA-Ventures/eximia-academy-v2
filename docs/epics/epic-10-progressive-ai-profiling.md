# Epic 10: Progressive AI Profiling

**Version:** 1.1
**Created:** 2026-02-10
**Updated:** 2026-02-10
**Author:** Morgan (PM Agent)
**Status:** DRAFT — QA Review Applied (Quinn v1.1, 82→TBD)
**PRD Reference:** `docs/prd.md` — Epic 9 Future Section (perfilamento progressivo)
**Architecture Reference:** `docs/architecture.md` v1.3
**Epic 9 Reference:** `docs/epics/epic-9-onboarding-inteligente-personalizacao.md` — Section "Future: Epic 10"
**Depends On:** Epic 3 (motor socratico), Epic 9 (profile JSONB + hub autoconhecimento)

---

## Epic Goal

Implementar um sistema de perfilamento progressivo via IA que analisa conversas socraticas para inferir preferencias de aprendizado do aluno, atualiza incrementalmente `users.profile.ai_learning_profile`, adapta o comportamento do tutor Socrates com base no perfil inferido, e visualiza a evolucao do perfil na secao "Como a IA me vê" do hub de autoconhecimento.

## Epic Context

| Item | Detalhe |
|------|---------|
| **Stack** | Next.js 15 (App Router) + Supabase + Vercel AI SDK + Anthropic SDK + `packages/agents/` |
| **DB Tables** | `users` (profile JSONB), `sessions`, `messages`, `qa_reports`, `analyses` |
| **Agent Pipeline** | Socrates → Editor → Tester (retry on REJECTED) — `packages/agents/src/orchestrator.ts` |
| **Profile JSONB** | `ai_learning_profile` reservado (vazio), `ai_profile` tipado em `OrchestratorInput` |
| **Merge Function** | `jsonb_profile_merge()` RPC pronta — `supabase/migrations/20260210000002_jsonb_profile_merge.sql` |
| **UI Placeholder** | "Como a IA me vê" — Epic 9.3 AC9 (placeholder aguardando dados) |
| **Trilha** | TRILHA C — independente, ZERO overlap com Epic 12 (multimodal content) |
| **Toca** | `packages/agents/`, `users.profile` JSONB |

---

## Existing System Context

### Infrastructure Already in Place

| Component | Status | Source |
|-----------|--------|--------|
| Agent orchestrator (Socrates → Editor → Tester) | Implemented | `packages/agents/src/orchestrator.ts` |
| `buildStudentProfileContext()` | Implemented | `packages/agents/src/orchestrator.ts:55-130` |
| `OrchestratorInput.studentProfile.ai_profile` | Typed | `packages/agents/src/types.ts:78` |
| `sanitizeProfileText()` | Implemented | `packages/agents/src/orchestrator.ts:47-53` |
| Sessions table (status, turn_number, interactions_remaining) | Implemented | Initial schema migration |
| Messages table (role, content, turn_number) | Implemented | Initial schema migration |
| QA Reports (verdict, score, criteria_results) | Implemented | Initial schema migration |
| Analyses (ai_detection, metrics, flags) | Implemented | Initial schema migration |
| `claim_session_turn()` / `release_session_turn()` RPCs | Implemented | `20260208000000_epic3_rpc_functions.sql` |
| `jsonb_profile_merge()` RPC | Implemented | `20260210000002_jsonb_profile_merge.sql` |
| `users.profile.ai_learning_profile` field | Reserved (empty) | Epic 9 schema |
| "Como a IA me vê" placeholder UI | Implemented | Epic 9.3 AC9 |
| Socrates output schema (question_type, depth_level, quality_checks) | Implemented | `packages/agents/src/schemas/socrates.ts` |

### Current Conversation Data Available for Profiling

**Persisted (available post-session via DB queries):**

| Signal | Source | Description |
|--------|--------|-------------|
| Response content | `messages.content` | Full text of student responses |
| Response length | `messages.content.length` | Verbose vs concise tendency |
| Turn count per session | `sessions.turn_number` | Engagement depth |
| Initial question context | `questions.text/skill/intention/expected_depth` | What the student was asked |
| QA score | `qa_reports.score` | Quality of the dialogue (0-1 range) |
| QA verdict | `qa_reports.verdict` | APPROVED vs REJECTED |
| QA criteria details | `qa_reports.criteria_results` | C1-C6 criterion pass/fail (JSONB) |
| Session completion | `sessions.status` | completed vs abandoned |
| AI detection | `analyses.ai_detection` | Whether student used AI to answer |

**NOT persisted (pipeline-internal, Profiler must INFER from text):**

| Signal | Pipeline Source | How Profiler Infers |
|--------|---------------|---------------------|
| Question types used | `socratesOutput.response.question_type` | Profiler analyzes assistant messages to classify question patterns |
| Depth level achieved | `socratesOutput.response.depth_level` | Profiler evaluates student response sophistication from text |

> **Note:** The Profiler agent receives conversation text + QA scores and performs its own semantic analysis to infer question effectiveness and cognitive depth. It does NOT receive structured pipeline metadata.

### Integration Points

- **Agent orchestrator** → novo Profiler agent roda apos sessao completar
- **POST /api/sessions/[sessionId]/messages** → trigger de profiling apos ultima interacao
- **`buildStudentProfileContext()`** → consome `ai_learning_profile` para adaptar Socrates
- **`/perfil` tab "Autoconhecimento"** → "Como a IA me vê" exibe dados inferidos
- **`jsonb_profile_merge()`** → merge incremental do perfil

---

## Enhancement Details

### What's Being Added/Changed

1. **Profiler Agent** — Novo agente em `packages/agents/` que analisa o historico de conversa de uma sessao completa e produz inferencias sobre o perfil de aprendizado do aluno. Usa modelo leve (Haiku) para otimizar custo (~$0.001-0.003 por analise).

2. **AI Learning Profile Schema** — Estrutura tipada para `users.profile.ai_learning_profile` com: preferencias de aprendizado inferidas, estilo de engajamento, estilo de raciocinio, metricas cognitivas, pontos fortes, areas de crescimento, e hints de adaptacao para o Socrates.

3. **Post-Session Inference Pipeline** — Apos sessao completar (status = 'completed', >= 2 turnos), o Profiler analisa a conversa e faz merge incremental no profile JSONB. Fire-and-forget (nao bloqueia UX). Suporta analise retroativa de sessoes existentes.

4. **Orchestrator Adaptation** — `buildStudentProfileContext()` expandido para consumir `ai_learning_profile` e gerar hints contextuais para o Socrates (ex: "aluno prefere exemplos praticos", "responde melhor a perguntas de aplicacao").

5. **"Como a IA me vê" Visualization** — Substitui placeholder do Epic 9.3 AC9 com visualizacao real do perfil inferido: insights principais, estilo de aprendizado, pontos fortes, evolucao ao longo do tempo.

### How It Integrates

- **Profiler Agent** reutiliza o padrao de agentes existente em `packages/agents/` (generateObject + schema Zod + timeout)
- **Pipeline trigger** integra no fluxo existente do `POST /messages` route — apos ultima interacao, dispara profiler em background
- **Profile merge** usa `jsonb_profile_merge()` RPC existente (ou query direta com JSONB merge)
- **Orchestrator** ja tem o wiring pronto — `buildStudentProfileContext()` so precisa consumir o novo campo
- **UI** substitui componente placeholder existente no hub de autoconhecimento (Epic 9.3)

### Success Criteria

- [ ] Apos sessao completar, perfil AI e atualizado automaticamente (sem acao do aluno)
- [ ] Socrates adapta comportamento com base no perfil inferido (hints contextuais no prompt)
- [ ] Aluno visualiza "Como a IA me vê" com dados reais no hub de autoconhecimento
- [ ] Perfil evolui incrementalmente a cada sessao (confianca aumenta com mais dados)
- [ ] Custo por analise < $0.005 (modelo leve)
- [ ] Profiling nao bloqueia UX (fire-and-forget, async)
- [ ] Funcionalidade existente (Epics 1-9) permanece operacional
- [ ] Nenhum vazamento cross-tenant (RLS integridade mantida)
- [ ] Sessoes com < 2 turnos sao ignoradas (dados insuficientes)

---

## AI Learning Profile Schema

```typescript
// packages/agents/src/schemas/profiler.ts

interface AILearningProfile {
  // Inferred learning preferences
  preferred_question_types: Array<
    'clarificacao' | 'suposicoes' | 'evidencias' |
    'perspectivas' | 'consequencias' | 'aplicacao' | 'metacognicao'
  >
  engagement_style: 'reflective' | 'impulsive' | 'balanced'
  detail_orientation: 'verbose' | 'concise' | 'balanced'
  reasoning_style: 'analytical' | 'creative' | 'systematic' | 'intuitive'

  // Cognitive metrics (averages across sessions)
  avg_depth_achieved: number           // 1-6 scale
  comprehension_trend: 'improving' | 'stable' | 'declining'
  avg_qa_score: number                 // 0-1 (matches tester.score range from testerOutputSchema)

  // Strengths & growth areas (human-readable PT-BR)
  strengths: string[]                  // e.g., ["Pensamento critico", "Conexoes interdisciplinares"]
  growth_areas: string[]               // e.g., ["Aprofundamento de argumentos", "Uso de evidencias"]

  // Adaptation hints for Socrates (injected into prompt)
  adaptation_hints: string[]           // e.g., ["Use exemplos praticos", "Evite pressao por tempo"]

  // Summary for UI display
  summary: string                      // 2-3 sentence PT-BR summary

  // Metadata
  sessions_analyzed: number
  last_updated: string                 // ISO 8601
  confidence: number                   // 0-1, increases with more sessions
  version: number                      // Schema version for future migrations
}
```

---

## Stories

---

### Story 10.1: Profiler Agent & AI Profile Schema

**As a** platform,
**I want** an AI agent that analyzes completed Socratic sessions to infer student learning profiles,
**so that** the system can progressively build understanding of each student's learning patterns.

**Story Points:** 5
**Priority:** P0 (Foundation — Stories 10.2 and 10.3 depend on this)
**Risk:** LOW — new agent, additive, no modification to existing agents

#### Acceptance Criteria

- [ ] **AC1:** Novo `ProfilerAgent` em `packages/agents/src/profiler.ts` seguindo padrao existente (generateObject + Zod schema + timeout)
- [ ] **AC2:** Input do Profiler: historico de mensagens da sessao, pergunta inicial (com skill/intention), scores do QA, perfil AI existente (para merge incremental)
- [ ] **AC3:** Output do Profiler: schema `ProfilerOutput` com campos tipados (preferred_question_types, engagement_style, detail_orientation, reasoning_style, strengths, growth_areas, adaptation_hints, summary, confidence)
- [ ] **AC4:** Profiler usa modelo leve (`claude-haiku-4-5-20251001`) para otimizar custo
- [ ] **AC5:** System prompt do Profiler instrui analise pedagogica (nao psicologica) — foco em padroes de aprendizado observaveis, nao diagnosticos
- [ ] **AC6:** Profiler recebe perfil existente (se houver) e faz merge inteligente — atualiza metricas incrementalmente em vez de substituir (ex: `avg_depth_achieved` e media ponderada, `sessions_analyzed` incrementa)
- [ ] **AC7:** Schema Zod para input e output com validacao estrita (`packages/agents/src/schemas/profiler.ts`)
- [ ] **AC8:** Prompt do Profiler em `packages/agents/src/prompts/profiler.ts` seguindo padrao dos demais agentes
- [ ] **AC9:** Export do Profiler no `packages/agents/src/index.ts`
- [ ] **AC10:** Tipo `AILearningProfile` exportado em `packages/shared/src/types/models.ts`
- [ ] **AC11:** Timeout de 15s (perfil nao e critico, pode falhar silenciosamente)
- [ ] **AC12:** Testes unitarios para o Profiler agent (input valido, output schema, merge incremental)

#### Technical Notes

- **Padrao de agente existente:**
  ```typescript
  // packages/agents/src/profiler.ts
  import { anthropic } from "@ai-sdk/anthropic"
  import { generateObject } from "ai"
  import { PROFILER_SYSTEM_PROMPT } from "./prompts/profiler"
  import { profilerOutputSchema, type ProfilerInput } from "./schemas/profiler"

  export async function runProfiler(
    input: ProfilerInput,
    config: { model?: string; timeoutMs?: number } = {},
  ): Promise<ProfilerOutput> {
    const result = await withTimeout(
      generateObject({
        model: anthropic(config.model ?? "claude-haiku-4-5-20251001"),
        system: PROFILER_SYSTEM_PROMPT,
        prompt: buildProfilerPrompt(input),
        schema: profilerOutputSchema,
      }),
      config.timeoutMs ?? 15000,
      "Profiler",
    )
    return result.object
  }
  ```

- **Merge incremental:** O Profiler recebe o perfil existente e o output deve ser "merged" — nao "replaced". Exemplo:
  ```typescript
  // Se existem 5 sessoes analisadas com avg_depth 3.2 e nova sessao tem depth 4.0:
  // new_avg = (3.2 * 5 + 4.0) / 6 = 3.33
  ```

- **Custo estimado:** Haiku input ~1500 tokens (conversa) + 500 tokens (profile existente) = ~2000 tokens input, ~500 tokens output. Custo: ~$0.002 por analise.

- **Disclaimer no prompt:** "Voce analisa padroes de aprendizado OBSERVAVEIS na conversa. Nao faz diagnosticos psicologicos. Foque em como o aluno APRENDE, nao em quem o aluno E."

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementacao do Profiler agent, schemas, prompts, testes |
| **@qa (Quinn)** | Validacao: output schema correto, merge incremental, custo por analise |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass. Profiler exportado corretamente. Schema Zod valida. | Yes |
| Pre-PR | Profiler gera output valido para conversa de teste. Merge incremental calcula medias corretamente. Custo < $0.005 por analise. Timeout funciona. | Yes |

---

### Story 10.2: Post-Session Inference Pipeline & Orchestrator Adaptation

**As a** student,
**I want** my learning profile to be automatically updated after each Socratic session,
**so that** the tutor progressively adapts to my learning style without any manual action.

**Depends On:** Story 10.1

**Story Points:** 5
**Priority:** P0 (Core pipeline — connects Profiler to data flow)
**Risk:** MEDIUM — modifica route handler existente (`POST /messages`) e `buildStudentProfileContext()`

#### Acceptance Criteria

- [ ] **AC1:** Apos ultima interacao de uma sessao (status = 'completed'), Profiler e disparado em background (fire-and-forget, nao bloqueia response stream)
- [ ] **AC2:** Profiling so executa se sessao tem >= 2 turnos (dados insuficientes abaixo disso)
- [ ] **AC3:** Input do Profiler e construido a partir dos dados da sessao: mensagens, pergunta inicial (com skill/intention/expected_depth), scores do QA report, perfil AI existente do aluno
- [ ] **AC4:** Output do Profiler e salvo em `users.profile.ai_learning_profile` via merge JSONB (nao substitui campos existentes de outros dominios como big_five, enneagram)
- [ ] **AC5:** `buildStudentProfileContext()` expandido para consumir `ai_learning_profile`:
  - `adaptation_hints` injetados diretamente como linhas no contexto do Socrates
  - `preferred_question_types` informam que tipos de pergunta funcionam melhor
  - `engagement_style` guia ritmo da interacao
- [ ] **AC6:** Se Profiler falhar (timeout, erro), falha e silenciosa — nao afeta sessao nem UX. Log de erro via Sentry.
- [ ] **AC7:** Server Action `triggerProfiling(sessionId)` que pode ser chamada manualmente (para analise retroativa de sessoes passadas)
- [ ] **AC8:** Profiling respeita tenant isolation — so acessa dados do tenant do aluno
- [ ] **AC9:** Testes de integracao: sessao completa → profiler dispara → profile JSONB atualizado → proxima sessao recebe hints
- [ ] **AC10:** `OrchestratorInput.studentProfile` populado com `ai_learning_profile` ao carregar sessao (query no `POST /messages` route ou no session page RSC)

#### Technical Notes

- **Trigger no route handler existente:**
  ```typescript
  // apps/web/src/app/api/sessions/[sessionId]/messages/route.ts
  // Apos persistir dados e ANTES de retornar response stream:

  // Fire-and-forget profiling (non-blocking)
  // turnData comes from claim_session_turn() RPC — returns interactions_remaining and turn_number
  if (turnData.interactions_remaining === 0 && turnData.turn_number >= 2) {
    triggerProfiling(sessionId, user.id, session.tenant_id).catch((err) => {
      Sentry.captureException(err, { tags: { agent: 'Profiler' } })
    })
  }
  ```

- **triggerProfiling implementation:**
  ```typescript
  // apps/web/src/app/api/sessions/[sessionId]/profiling.ts (ou actions.ts)
  async function triggerProfiling(sessionId: string, studentId: string, tenantId: string) {
    // 1. Load session messages
    const { data: messages } = await serviceClient
      .from('messages').select('*').eq('session_id', sessionId).order('turn_number')

    // 2. Load session context (question, chapter)
    const { data: session } = await serviceClient
      .from('sessions').select('*, questions(*), chapters(title)').eq('id', sessionId).single()

    // 3. Load QA reports for this session
    const { data: qaReports } = await serviceClient
      .from('qa_reports').select('score, verdict, criteria_results').eq('session_id', sessionId)

    // 4. Load existing AI profile
    const { data: user } = await serviceClient
      .from('users').select('profile').eq('id', studentId).single()
    const existingProfile = user?.profile?.ai_learning_profile ?? null

    // 5. Run Profiler
    const profilerOutput = await runProfiler({
      messages, session, qaReports, existingProfile
    })

    // 6. Merge into profile JSONB (atomic — avoids race condition with concurrent profile updates)
    // IMPORTANT: Use jsonb_set, NOT spread operator. Spread reads full profile then writes back,
    // which loses concurrent changes (e.g., student saving Big Five at the same time).
    const { error: mergeError } = await serviceClient.rpc('jsonb_profile_merge', {
      p_user_id: studentId,
      p_set_key: 'ai_learning_profile',
      p_set_value: JSON.stringify(profilerOutput),
    })
    if (mergeError) throw mergeError
  }
  ```

- **buildStudentProfileContext expansion:**
  ```typescript
  // packages/agents/src/orchestrator.ts — adicionar ao final de buildStudentProfileContext()
  if (profile.ai_profile) {
    // Existing wiring — already typed in OrchestratorInput
    if (profile.ai_profile.summary) lines.push(`Perfil IA: ${sanitizeProfileText(profile.ai_profile.summary)}`)
    if (profile.ai_profile.strengths?.length) {
      lines.push(`Pontos fortes: ${profile.ai_profile.strengths.map(s => sanitizeProfileText(s)).join(', ')}`)
    }
  }

  // NEW: ai_learning_profile adaptation hints
  if (profile.ai_learning_profile?.adaptation_hints?.length) {
    for (const hint of profile.ai_learning_profile.adaptation_hints.slice(0, 5)) {
      lines.push(sanitizeProfileText(hint))
    }
  }
  if (profile.ai_learning_profile?.preferred_question_types?.length) {
    lines.push(`Tipos de pergunta que funcionam melhor: ${profile.ai_learning_profile.preferred_question_types.join(', ')}`)
  }
  ```

- **Populando studentProfile na sessao:**
  ```typescript
  // No RSC da session page ou no route handler, ao carregar sessao:
  const { data: user } = await supabase.from('users').select('profile').eq('id', userId).single()
  const aiProfile = user?.profile?.ai_learning_profile
  // Mapear para OrchestratorInput.studentProfile.ai_profile
  ```

- **Service client** (bypasses RLS) usado para persistir — mesmo padrao de `analyses` e `qa_reports`

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Pipeline trigger, triggerProfiling(), buildStudentProfileContext expansion, session loading |
| **@qa (Quinn)** | Validacao: fire-and-forget nao bloqueia, merge correto, tenant isolation, fallback silencioso |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass. Nenhuma regressao no pipeline Socrates existente. triggerProfiling exportado. | Yes |
| Pre-PR | Sessao completa → Profiler dispara → `ai_learning_profile` salvo no JSONB. Proxima sessao carrega hints. Falha do Profiler nao afeta UX. Sessoes com < 2 turnos ignoradas. Tenant isolation verificado. | Yes |

---

### Story 10.3: "Como a IA me vê" — Visualization

**As a** student,
**I want** to see how the AI perceives my learning profile based on our conversations,
**so that** I gain self-awareness about my learning patterns and see how the system adapts to me.

**Depends On:** Story 10.1 (schema), Story 10.2 (data population)

**Story Points:** 5
**Priority:** P1 (UI — can be developed in parallel with mocked data, integrated after 10.2)
**Risk:** LOW — substitui placeholder existente, sem impacto em features existentes

#### Acceptance Criteria

- [ ] **AC1:** Substituir placeholder "Como a IA me vê" (Epic 9.3 AC9) com componente real que exibe dados de `users.profile.ai_learning_profile`
- [ ] **AC2:** Se `ai_learning_profile` estiver vazio/null, manter mensagem placeholder: "Conforme voce interage com o tutor, seu perfil de aprendizado sera construido automaticamente. Complete pelo menos 2 sessoes socraticas para comecar."
- [ ] **AC3:** Se `ai_learning_profile` existir, exibir:
  - **Summary** — texto de 2-3 frases descrevendo o perfil (campo `summary`)
  - **Estilo de Aprendizado** — cards visuais para engagement_style, detail_orientation, reasoning_style
  - **Pontos Fortes** — lista com icones (campo `strengths`)
  - **Areas de Crescimento** — lista com icones (campo `growth_areas`)
  - **Confianca do Perfil** — indicador visual de 0-100% (campo `confidence`)
  - **Sessoes Analisadas** — contador (campo `sessions_analyzed`)
- [ ] **AC4:** Indicador de confianca com labels: < 0.3 = "Conhecendo voce...", 0.3-0.6 = "Perfil em formacao", 0.6-0.8 = "Perfil consistente", > 0.8 = "Perfil consolidado"
- [ ] **AC5:** Data de ultima atualizacao exibida (campo `last_updated`)
- [ ] **AC6:** Componentes usam `@eximia/ui` (Card, Badge) + Tailwind theme tokens — zero hardcoded hex/rgba
- [ ] **AC7:** Responsivo (mobile-friendly) — cards empilham em telas menores
- [ ] **AC8:** Disclaimer visivel: "Este perfil e baseado em suas interacoes com o tutor e evolui continuamente. Ele nao define suas capacidades — e uma ferramenta de autoconhecimento."
- [ ] **AC9:** Dados carregados via Server Component (RSC) — query dedicada ao `users.profile` (mesmo padrao da Story 9.3 M-2 FIX)
- [ ] **AC10:** Testes: componente renderiza com dados mock, renderiza placeholder quando vazio, responsividade verificada

#### Technical Notes

- **Substituicao do placeholder:**
  ```
  ANTES (Epic 9.3):
  apps/web/src/components/profile/ai-profile-placeholder.tsx  →  mensagem estatica

  DEPOIS (Epic 10.3):
  apps/web/src/components/profile/ai-profile-section.tsx  →  componente real com dados
  ```

- **Componente principal:**
  ```typescript
  // apps/web/src/components/profile/ai-profile-section.tsx
  import { Card, CardContent, Badge } from "@eximia/ui"

  interface AIProfileSectionProps {
    profile: AILearningProfile | null
  }

  export function AIProfileSection({ profile }: AIProfileSectionProps) {
    if (!profile) return <AIProfilePlaceholder />
    return (
      <div className="space-y-6">
        <ProfileSummaryCard summary={profile.summary} confidence={profile.confidence} />
        <LearningStyleCards profile={profile} />
        <StrengthsAndGrowth strengths={profile.strengths} growthAreas={profile.growth_areas} />
        <ProfileMetadata
          sessionsAnalyzed={profile.sessions_analyzed}
          lastUpdated={profile.last_updated}
        />
        <ProfileDisclaimer />
      </div>
    )
  }
  ```

- **Confianca visual:**
  ```typescript
  function ConfidenceIndicator({ confidence }: { confidence: number }) {
    const percent = Math.round(confidence * 100)
    const label =
      confidence < 0.3 ? 'Conhecendo voce...' :
      confidence < 0.6 ? 'Perfil em formacao' :
      confidence < 0.8 ? 'Perfil consistente' :
      'Perfil consolidado'
    // Progress bar + label
  }
  ```

- **Nao usar recharts aqui** — dados sao categoricos (cards, badges, listas), nao numericos como Big Five radar. Manter UI simples e legivel.

- **Integracao com hub existente (Story 9.3):**
  ```typescript
  // apps/web/src/components/profile/self-knowledge-hub.tsx
  // Adicionar AIProfileSection apos os cards de testes (Big Five, Eneagrama)
  // e ANTES do disclaimer geral
  ```

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Componentes UI, integracao com hub, RSC data loading |
| **@ux-design-expert** | Layout dos cards, hierarquia visual, responsividade |
| **@qa (Quinn)** | Validacao: placeholder quando vazio, dados corretos quando preenchido, responsividade |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass. Componentes renderizam sem erro. Usa `@eximia/ui` components. | Yes |
| Pre-PR | Placeholder exibido quando sem dados. Dados reais exibidos corretamente. Responsivo. Disclaimer visivel. Theme tokens usados (zero hardcoded). | Yes |

---

## Dependency Graph

```
Story 10.1 (Profiler Agent & Schema)  ──┐
                                         ├──→ Story 10.2 (Pipeline & Orchestrator)
                                         │          [pipeline consome o Profiler agent]
                                         │
                                         └──→ Story 10.3 (UI "Como a IA me vê")
                                                    [pode usar dados mock ate 10.2 popular]

Story 10.2 (Pipeline) ──→ Story 10.3 (UI integration com dados reais)
```

**Execution Order:**
1. **Story 10.1** primeiro (P0 — cria Profiler agent e schema que 10.2 e 10.3 consomem)
2. **Story 10.2** segundo (P0 — pipeline conecta Profiler ao fluxo de dados)
3. **Story 10.3** em paralelo com 10.2 usando dados mock, integracao final apos 10.2 (P1)

---

## Compatibility Requirements

- [ ] Pipeline Socrates existente (Socrates → Editor → Tester) permanece inalterado
- [ ] `POST /api/sessions/[sessionId]/messages` continua funcionando identicamente (profiling e fire-and-forget)
- [ ] Campos existentes de `users.profile` (big_five, enneagram, employee_status) nao sao corrompidos pelo merge
- [ ] Performance do response stream nao e afetada (profiling e async/non-blocking)
- [ ] RLS policies existentes permanecem intactas
- [ ] UI do hub de autoconhecimento (Big Five, Eneagrama) nao e afetada
- [ ] Sessoes existentes continuam funcionando sem profiling retroativo obrigatorio
- [ ] Dashboards (Epic 4), Course CRUD (Epic 2), Onboarding (Epic 9) continuam operacionais
- [ ] `OrchestratorInput` interface mantem backward compatibility (campos opcionais)

---

## Risk Mitigation

### Primary Risk: Profiler Bloqueia Response Stream

- **Impact:** HIGH — se profiling for sincrono, aluno espera segundos extras
- **Mitigation:** Fire-and-forget com `.catch()` — profiling e completamente async e non-blocking. Se falhar, UX nao e afetada.
- **Rollback Plan:** Remover trigger no route handler (1 linha). Profile JSONB mantem dados validos.

### Secondary Risk: AI Profile Corrompe JSONB

- **Impact:** MEDIUM — merge incorreto pode sobrescrever big_five, enneagram, employee_status
- **Mitigation:** Merge JSONB e scoped — apenas `ai_learning_profile` key e atualizada. Usar spread operator com chave especifica. Zod valida output antes de persistir.
- **Rollback Plan:** `UPDATE users SET profile = profile - 'ai_learning_profile'` remove campo sem afetar o resto.

### Tertiary Risk: Custo de AI Escala com Numero de Sessoes

- **Impact:** LOW — Haiku e barato (~$0.002/analise), mas em escala pode somar
- **Mitigation:** So analisa sessoes com >= 2 turnos. Modelo Haiku (10x mais barato que Sonnet). Pode adicionar rate limiting futuro (1 analise/aluno/hora).
- **Rollback Plan:** Desabilitar trigger — profiling e opcional, nao afeta funcionalidade core.

### Quaternary Risk: Perfil Inferido Impreciso com Poucas Sessoes

- **Impact:** LOW — hints imprecisos podem confundir Socrates
- **Mitigation:** Campo `confidence` (0-1) aumenta com mais sessoes. Com confidence < 0.3, hints sao genericos. UI mostra "Conhecendo voce..." para baixa confianca. Profiler recebe instrucao de ser conservador com poucos dados.
- **Rollback Plan:** `buildStudentProfileContext()` pode ignorar `ai_learning_profile` se `confidence < threshold`.

---

## Quality Assurance Strategy

### CodeRabbit Validation

All stories include pre-commit reviews:
- **Story 10.1 (Profiler Agent):** @dev valida schema Zod, prompt pedagogico, custo de tokens
- **Story 10.2 (Pipeline):** @dev valida fire-and-forget, tenant isolation, merge JSONB scoped
- **Story 10.3 (UI):** @ux-design-expert valida layout, responsividade, hierarquia visual

### Specialized Expertise

| Domain | Agent | Focus |
|--------|-------|-------|
| Agent implementation | @dev | Profiler agent, schema, prompt, generateObject pattern |
| Pipeline integration | @dev | Route handler modification, fire-and-forget, Sentry logging |
| JSONB merge safety | @dev | Scoped merge, no corruption of existing fields |
| UI/UX | @ux-design-expert | Cards layout, confianca indicator, responsividade |
| Security | @dev | Tenant isolation, sanitization of profile text in prompts |
| Cost optimization | @dev | Haiku model, token budget, min turn threshold |

### Quality Gates Aligned with Risk

- **Story 10.1 (LOW risk):** Pre-Commit + Pre-PR validation
- **Story 10.2 (MEDIUM risk):** Pre-Commit + Pre-PR validation
- **Story 10.3 (LOW risk):** Pre-Commit + Pre-PR validation

### Regression Prevention

- Story 10.2 inclui verificacao de que response stream nao e afetado (latencia identica)
- Merge JSONB testado com profile contendo big_five + enneagram + ai_learning_profile simultaneamente
- Pipeline Socrates testado com e sem ai_learning_profile no studentProfile
- Performance: response time nao aumenta (profiling e async)

---

## API Contracts

### Profiler Agent Input/Output

```typescript
// packages/agents/src/schemas/profiler.ts

// Input
interface ProfilerInput {
  messages: Array<{ role: 'user' | 'assistant'; content: string; turn_number: number }>
  question: { text: string; skill?: string; intention?: string; expected_depth?: string }
  qaScores: Array<{ score: number; verdict: string }>
  existingProfile: AILearningProfile | null
  sessionCount: number  // total sessions completed by student
}

// Output
interface ProfilerOutput {
  preferred_question_types: string[]
  engagement_style: 'reflective' | 'impulsive' | 'balanced'
  detail_orientation: 'verbose' | 'concise' | 'balanced'
  reasoning_style: 'analytical' | 'creative' | 'systematic' | 'intuitive'
  avg_depth_achieved: number
  comprehension_trend: 'improving' | 'stable' | 'declining'
  avg_qa_score: number
  strengths: string[]         // max 5 items, PT-BR
  growth_areas: string[]      // max 3 items, PT-BR
  adaptation_hints: string[]  // max 5 items, PT-BR
  summary: string             // max 300 chars, PT-BR
  confidence: number          // 0-1
}
```

### JSONB Merge (Profile Update)

```typescript
// Merge scoped — only ai_learning_profile key
await serviceClient
  .from('users')
  .update({
    profile: sql`
      jsonb_set(
        COALESCE(profile, '{}'::jsonb),
        '{ai_learning_profile}',
        ${JSON.stringify(profilerOutput)}::jsonb
      )
    `,
    updated_at: new Date().toISOString(),
  })
  .eq('id', studentId)
```

### Orchestrator Enhancement

```typescript
// OrchestratorInput.studentProfile — extended (backward compatible)
studentProfile?: {
  // Existing fields (Epic 9)
  big_five?: { ... }
  enneagram?: { ... }
  disc?: { ... }
  multiple_intelligences?: Record<string, number>
  learning_style?: string
  ai_profile?: { summary: string; strengths: string[]; learning_style: string }

  // NEW (Epic 10)
  ai_learning_profile?: AILearningProfile
}
```

---

## File Locations

```
packages/agents/src/
├── profiler.ts                              # Story 10.1: Profiler agent (runProfiler)
├── orchestrator.ts                          # Story 10.2: buildStudentProfileContext expanded
├── types.ts                                 # Story 10.2: OrchestratorInput extended
├── prompts/
│   └── profiler.ts                          # Story 10.1: Profiler system prompt
├── schemas/
│   └── profiler.ts                          # Story 10.1: ProfilerInput/Output Zod schemas
└── index.ts                                 # Story 10.1: Export runProfiler

packages/shared/src/types/
└── models.ts                                # Story 10.1: AILearningProfile type

apps/web/src/app/api/sessions/[sessionId]/
├── messages/route.ts                        # Story 10.2: Fire-and-forget trigger
└── profiling.ts                             # Story 10.2: triggerProfiling() function

apps/web/src/components/profile/
├── ai-profile-section.tsx                   # Story 10.3: Main visualization (replaces placeholder)
├── ai-profile-placeholder.tsx               # Story 10.3: UPDATED (kept for empty state)
├── profile-summary-card.tsx                 # Story 10.3: Summary + confidence
├── learning-style-cards.tsx                 # Story 10.3: Style cards
├── strengths-and-growth.tsx                 # Story 10.3: Lists with icons
└── self-knowledge-hub.tsx                   # Story 10.3: UPDATED (integrates AIProfileSection)
```

---

## Definition of Done

- [ ] All 3 stories completed with acceptance criteria met
- [ ] Profiler agent funcional e exportado em `packages/agents/`
- [ ] Pipeline fire-and-forget dispara apos sessao completar (>= 2 turnos)
- [ ] `ai_learning_profile` salvo incrementalmente no JSONB sem corromper outros campos
- [ ] Socrates adapta comportamento via `buildStudentProfileContext()` com hints do AI profile
- [ ] "Como a IA me vê" exibe dados reais com indicador de confianca
- [ ] Placeholder mantido quando sem dados suficientes
- [ ] Custo por analise < $0.005 (Haiku)
- [ ] Profiling nao afeta latencia do response stream
- [ ] Funcionalidade existente (Epics 1-9) verificada via testes de regressao
- [ ] Tenant isolation mantida — no cross-tenant profile access
- [ ] Disclaimer visivel na UI
- [ ] Documentacao atualizada

---

## SM Handoff

"Please develop detailed user stories for this brownfield epic. Key considerations:

- This is an AI-powered feature extending the existing Socratic agent pipeline in `packages/agents/`
- Integration points: agent orchestrator (`orchestrator.ts`), POST /messages route handler, `users.profile` JSONB, hub de autoconhecimento UI (Epic 9.3)
- Existing patterns to follow: agent pattern (generateObject + Zod schema + timeout), fire-and-forget async processing (same as analyst agent), RSC data loading (Epic 4)
- Critical compatibility requirements: pipeline Socrates nao pode ser afetado. JSONB merge deve ser scoped apenas ao `ai_learning_profile` key. Response stream latencia identica.
- Each story must include verification that existing functionality remains intact
- Story 10.1 must be implemented first (P0) as Stories 10.2 and 10.3 depend on it
- Story 10.3 can start in parallel with 10.2 using mock data
- **Profiling MUST be fire-and-forget** — never block the response stream
- **Use Haiku model** for cost optimization (~$0.002 per analysis)
- **Minimum 2 turns** per session before profiling triggers
- **Incremental merge** — weighted averages for numeric fields, append for arrays
- **Pedagogical analysis only** — no psychological diagnostics in the profiler prompt

The epic should maintain system integrity while delivering progressive, AI-driven student profiling that improves tutor adaptation over time."

---

## Total Story Points: 15

| Story | Points | Priority | Dependencies |
|-------|--------|----------|-------------|
| 10.1 Profiler Agent & AI Profile Schema | 5 | P0 | Epic 3 (orchestrator), Epic 9 (profile JSONB) |
| 10.2 Post-Session Inference Pipeline & Orchestrator Adaptation | 5 | P0 | Story 10.1 |
| 10.3 "Como a IA me vê" Visualization | 5 | P1 | Story 10.1 (schema), Story 10.2 (data) |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-10 | 1.0 | Epic criado. 3 stories definidas: Profiler Agent, Pipeline/Orchestrator, UI Visualization. Baseado em escopo definido no Epic 9 "Future" section e analise do agent pipeline existente. | Morgan (PM) |
| 2026-02-10 | 1.1 | QA fixes: H-1 avg_qa_score range 0-100→0-1 (matches testerOutputSchema), H-2 JSONB merge spread→jsonb_set atomic (race condition fix) + use existing `jsonb_profile_merge()` RPC, H-3 "Available Signals" table split into persisted vs inferred — Profiler infers question_type/depth_level from text, not from pipeline metadata. Bonus M-1: trigger condition `claimResult.status`→`turnData.interactions_remaining === 0` (matches actual RPC return). | Quinn (QA) |

---

*Epic criado por Morgan (PM Agent) — exímIA Academy v1.0*
*Trilha C — ZERO overlap com Epic 12*

— Morgan, planejando o futuro 📊
