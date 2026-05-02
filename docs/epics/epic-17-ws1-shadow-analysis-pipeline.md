# Epic 17: WS1 — Shadow Analysis Pipeline (Detector + Perfilador)

**Version:** 1.0
**Created:** 2026-02-15
**Updated:** 2026-02-15
**Author:** Morgan (PM) com arquitetura de Aria (Architect)
**Status:** Draft
**PRD Reference:** `docs/prd/evolucao-eximia-academy-workstreams.md` — WS1: Motor Socrático
**Architecture Reference:** `docs/architecture/ws1-motor-socratico-architecture.md` — Seções 3, 6.4-6.5, 7-8, 11-12
**Workstream:** WS1 (independente de WS2 e WS3)
**Dependency:** Epic 16 (Core Agents & Pipeline)

---

## Epic Goal

Implementar o pipeline de análise sombra (invisível ao aluno) com Detector de Padrões Cognitivos e Perfilador de Aprendizado, rodando em paralelo ao pipeline de superfície — incluindo gestão inteligente de interações, tipos de interação adaptativos, e schema de dados enriquecido para sessões e perfis.

## Epic Context

| Item | Detalhe |
|------|---------|
| **Stack** | Next.js 15, AI SDK 6.0, DeepSeek V3 / gpt-4.1-mini, Drizzle ORM |
| **DB Tables** | `session_analytics` (NOVA ou JSONB em sessions), `learner_profiles` (NOVA), `session_messages` (atualizar) |
| **AI Agents** | Detector (NOVO), Perfilador (NOVO) |
| **Providers** | Via Model Router (Epic 16) — DeepSeek V3 ou gpt-4.1-mini por plano |
| **Roles Impactados** | student (fechamento inteligente), manager (dados analíticos) |
| **Package** | `@eximia/agents` |
| **Depende de** | Epic 16 (Orquestrador v2, Model Router, schemas base) |

---

## Existing System Context

### Infrastructure Already in Place (via Epic 16)

| Component | Status | Reference |
|-----------|--------|-----------|
| Orquestrador v2 (hook shadow) | Epic 16.4 | `packages/agents/src/orchestrator.ts` |
| Model Router | Epic 16.3 | `packages/agents/src/model-router.ts` |
| Types (AgentId, TenantPlan) | Epic 16.1 | `packages/agents/src/types.ts` |
| Sessions table | Existente | `packages/database/src/schema/sessions.ts` |
| Profiler Agent (legado) | Deletado no Epic 16.7 | — |
| Analyst Agent (legado) | Deletado no Epic 16.7 | — |

### What This Epic Adds

```
Student message
    → Orquestrador v2 (Epic 16)
    → SUPERFÍCIE (síncrona): Mestre → Polidor → Guardião → Resposta

    → ANÁLISE SOMBRA (paralela, assíncrona):
        ├── Detector (padrões cognitivos + detecção IA + linguística)
        └── Perfilador (estilo aprendizado Kolb + merge incremental)
        → Dados salvos no DB (session_analytics + learner_profiles)
        → Disponíveis para dashboards (Epic 18)

    + Gestão de interações (limite + fechamento inteligente)
    + 4 tipos de interação (socratic_dialogue, quiz, scenario, assignment)
```

---

## Enhancement Details

### Arquitetura Dual: Superfície + Análise Sombra

```
                    ┌──────────────────────────────────┐
                    │         STUDENT MESSAGE           │
                    └──────────────┬───────────────────┘
                                   │
                    ┌──────────────▼───────────────────┐
                    │         ORQUESTRADOR v2           │
                    │    (Pipeline Controller)          │
                    └──┬───────────────────────────┬───┘
                       │                           │
            ┌──────────▼──────────┐    ┌───────────▼──────────┐
            │   SUPERFÍCIE        │    │   ANÁLISE SOMBRA     │
            │   (Epic 16)         │    │   (Este Epic)        │
            │   Mestre→Polidor    │    │   Detector            │
            │   →Guardião         │    │   Perfilador          │
            └─────────────────────┘    └──────────────────────┘
```

### Detector — 3 Camadas de Análise

```
Input: mensagem do aluno + histórico da sessão

Camada A — Padrões Cognitivos
├── Distorções cognitivas (5 tipos)
├── Loops de pensamento (4 tipos)
├── Mecanismos de defesa (4 tipos)
├── Valores implícitos (4 eixos)
└── Readiness level: defensive | exploring | integrating

Camada B — Detecção de IA
├── Indicadores de IA (5 sinais: fluência, ausência erros, tom, vocabulário, conectores)
├── Indicadores humanos (5 sinais: erros, informalidade, gírias, hesitações, emojis)
├── Probabilidade: 0.0 - 1.0
├── Verdict: likely_human | uncertain | likely_ai
└── Flag: alta_probabilidade_texto_IA (se > 0.70)

Camada C — Linguística Profunda
├── Comprimento das respostas
├── Palavras de poder vs submissão
├── Pronomes (eu/nós/eles)
├── Valência + intensidade emocional
├── Nível de abstração
└── Certeza vs exploração
```

### Perfilador — Estilo de Aprendizado Kolb

```
        SENTIR (CE)
           │
    ┌──────┼──────┐
    │      │      │
OBSERVAR ──┼── FAZER
  (RO)     │    (AE)
    │      │      │
    └──────┼──────┘
           │
       PENSAR (AC)

4 Estilos: Divergente, Assimilador, Convergente, Acomodador
Detecção implícita via diálogo (sem teste formal)
Vetor contínuo nos 2 eixos (não categórico)
Merge incremental com perfil existente
```

### Gestão de Interações

```
┌─────────────────────────────────────────────────────────┐
│  CADA INTERAÇÃO DO ALUNO                                │
│                                                         │
│  1. Verificar interactions_remaining > 0                │
│     └─ Se 0 → forçar Fechamento Socrático              │
│                                                         │
│  2. Pipeline normal (Epic 16)                           │
│                                                         │
│  3. Avaliar sinais de maturidade (Detector):            │
│     ├─ Camada 6-7 atingida?                             │
│     ├─ 2+ breakthroughs?                                │
│     ├─ Satisfação/conclusão?                            │
│     └─ Profundidade estagnada?                          │
│                                                         │
│  4. Se sinais + remaining <= threshold:                  │
│     └─ Mestre ativa Fechamento (sugere, não força)       │
│                                                         │
│  5. Aluno: aceitar (encerrar) ou continuar              │
└─────────────────────────────────────────────────────────┘
```

### Success Criteria

- [ ] Detector analisa padrões cognitivos, detecta IA e faz análise linguística a cada interação
- [ ] Perfilador detecta estilo Kolb implicitamente (vetor contínuo nos 2 eixos)
- [ ] Pipeline shadow roda em paralelo sem bloquear resposta de superfície
- [ ] Falha no shadow não impacta resposta ao aluno
- [ ] Dados salvos em `session_analytics` e `learner_profiles`
- [ ] Merge incremental do perfil funciona (multi-sessão)
- [ ] Fechamento inteligente sugere encerrar quando sessão madura
- [ ] 4 tipos de interação adaptam comportamento do Mestre

---

## Stories

---

### Story 17.1: Schemas Zod e Prompts do Detector e Perfilador

**As a** developer,
**I want** schemas Zod e system prompts para Detector e Perfilador,
**so that** os agentes shadow produzam output estruturado e validável.

**Architecture Reference:** ws1-motor-socratico-architecture.md, Seções 6.4-6.5

**Story Points:** 5
**Priority:** P0 (fundação)
**Risk:** LOW — schemas e prompts puros

#### Acceptance Criteria

- [ ] **AC1:** Schema `DetectorOutput` em `packages/agents/src/schemas/detector.ts`
  - `cognitive_patterns`: dominant_patterns (array: pattern, evidence, frequency), implicit_values, cognitive_loops, readiness_level, suggested_question_type
  - `ai_detection`: probability (0-1), confidence, verdict (likely_human/uncertain/likely_ai), indicators (array), flag
  - `linguistic_analysis`: emotional_density (0-1), abstraction_level (1-10), certainty_vs_exploration (-1 to +1), defense_active (boolean)
  - `session_journey`: emotional_arc (string[]), depth_progression (number[]), breakthrough_candidates (array: trigger + marker)
- [ ] **AC2:** Schema `PerfiladorOutput` em `packages/agents/src/schemas/perfilador.ts`
  - preferred_question_types (array, max 4)
  - engagement_style, detail_orientation, reasoning_style (enums)
  - avg_depth_achieved (1-7), comprehension_trend, avg_qa_score (0-1)
  - strengths (string[], max 5), growth_areas (string[], max 3), adaptation_hints (string[], max 5)
  - summary (string, max 500 chars), confidence (0-1)
  - `kolb_profile`: grasping_axis (-1 to +1), transforming_axis (-1 to +1), dominant_style (enum), style_confidence, indicators_observed (array)
- [ ] **AC3:** Prompt do Detector em `packages/agents/src/prompts/detector.ts`
  - Identidade: `Eximia_Detector`
  - 3 camadas: padrões cognitivos + detecção IA + linguística
  - Escala de probabilidade IA (0-1)
  - Regras: nunca bloqueia, nunca penaliza, dados são fatos
- [ ] **AC4:** Prompt do Perfilador em `packages/agents/src/prompts/perfilador.ts`
  - Identidade: `Eximia_Perfilador`
  - Detecção Kolb implícita (indicadores por estilo)
  - 8 regras invioláveis (nunca diagnóstico, sempre evidências, conservador com poucas sessões, etc.)
  - Merge incremental (recebe perfil anterior se existente)
  - Em português (Brasil)
- [ ] **AC5:** Types atualizados: `AgentId` inclui detector, perfilador
- [ ] **AC6:** `pnpm typecheck` passa

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Schemas, prompts, types |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-Commit | Identifiers `Eximia_Detector` e `Eximia_Perfilador` presentes | Yes |

---

### Story 17.2: Schema DB — Session Analytics e Learner Profiles

**As a** developer,
**I want** tabelas/campos para armazenar analytics de sessão e perfis de aprendizado,
**so that** os dados do Detector e Perfilador sejam persistidos para dashboards.

**Architecture Reference:** ws1-motor-socratico-architecture.md, Seção 11

**Story Points:** 5
**Priority:** P0 (fundação DB)
**Risk:** MEDIUM — novas tabelas com JSONB

#### Acceptance Criteria

- [ ] **AC1:** Campo `analytics` (JSONB) adicionado na tabela `sessions`
  - Contém: emotional_journey, depth_reached, breakthrough_moments, cognitive_patterns, defense_mechanisms, values_revealed, depth_progression, resistance_moments, insight_moments, question_relevance, depth_calibration, resistance_navigation, initial_confusion_level, final_clarity_level, clarity_gain, response_lengths, emotional_density_progression, kolb_session_vector
- [ ] **AC2:** Tabela `learner_profiles` criada
  - id, student_id (FK users), tenant_id (FK tenants)
  - engagement_style, detail_orientation, reasoning_style (TEXT enums)
  - avg_depth_achieved, avg_qa_score, confidence (NUMERIC)
  - kolb_grasping_axis, kolb_transforming_axis (NUMERIC -1 to +1)
  - kolb_dominant_style, kolb_style_confidence
  - strengths, growth_areas, adaptation_hints (TEXT[])
  - preferred_question_types (TEXT[])
  - comprehension_trend (TEXT)
  - summary (TEXT)
  - session_count (INTEGER)
  - created_at, updated_at
  - UNIQUE(student_id, tenant_id)
- [ ] **AC3:** RLS para `learner_profiles`
  - SELECT: managers/admins do mesmo tenant + próprio aluno (read-only)
  - INSERT/UPDATE: system-level (via service role, não RLS direto)
- [ ] **AC4:** Drizzle schemas em `packages/database/src/schema/`
- [ ] **AC5:** Migration SQL funcional
- [ ] **AC6:** Index em `learner_profiles(student_id, tenant_id)`

#### Technical Notes

```sql
-- Session analytics (campo JSONB na tabela existente)
ALTER TABLE sessions ADD COLUMN analytics JSONB DEFAULT '{}';

-- Learner profiles (nova tabela)
CREATE TABLE learner_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  engagement_style TEXT,
  detail_orientation TEXT,
  reasoning_style TEXT,
  avg_depth_achieved NUMERIC(3,1),
  avg_qa_score NUMERIC(3,2),
  confidence NUMERIC(3,2),
  kolb_grasping_axis NUMERIC(4,2),
  kolb_transforming_axis NUMERIC(4,2),
  kolb_dominant_style TEXT,
  kolb_style_confidence NUMERIC(3,2),
  strengths TEXT[] DEFAULT '{}',
  growth_areas TEXT[] DEFAULT '{}',
  adaptation_hints TEXT[] DEFAULT '{}',
  preferred_question_types TEXT[] DEFAULT '{}',
  comprehension_trend TEXT,
  summary TEXT,
  session_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, tenant_id)
);

CREATE INDEX idx_learner_profiles_student_tenant ON learner_profiles(student_id, tenant_id);

ALTER TABLE learner_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lp_select_manager" ON learner_profiles FOR SELECT
  USING (tenant_id = auth_tenant_id() AND auth_user_role() IN ('manager', 'admin'));

CREATE POLICY "lp_select_own" ON learner_profiles FOR SELECT
  USING (tenant_id = auth_tenant_id() AND student_id = auth.uid());
```

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Schema Drizzle, migration, RLS |
| **@qa (QA)** | Validar migration e RLS isolation |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Migration aplica, sessions existentes não afetadas | Yes |

---

### Story 17.3: Pipeline Shadow no Orquestrador (Detector + Perfilador em Paralelo)

**As a** developer,
**I want** integrar Detector e Perfilador no Orquestrador v2 como pipeline paralelo,
**so that** a análise sombra rode sem bloquear a resposta ao aluno.

**Architecture Reference:** ws1-motor-socratico-architecture.md, Seções 3, 5

**Story Points:** 8
**Priority:** P0 (core)
**Risk:** HIGH — pipeline paralelo + persistência + tolerância a falhas

#### Acceptance Criteria

- [ ] **AC1:** Após pipeline de superfície iniciar, Detector e Perfilador rodam em paralelo
  - Usam `shadowData` emitido pelo Orquestrador (Epic 16.4 AC6)
  - `Promise.allSettled()` para tolerância a falhas
- [ ] **AC2:** Detector processa cada interação
  - Recebe: mensagem do aluno + histórico + resposta do Mestre
  - Retorna: DetectorOutput (padrões, IA detection, linguística, journey)
- [ ] **AC3:** Perfilador processa a cada 5 interações (configurável)
  - Recebe: histórico completo + perfil anterior (se existente)
  - Retorna: PerfiladorOutput (Kolb, estilo, strengths, hints)
  - Merge incremental com perfil existente no DB
- [ ] **AC4:** Resultados salvos no DB:
  - Detector → `sessions.analytics` (JSONB, atualização incremental)
  - Perfilador → `learner_profiles` (upsert com merge)
- [ ] **AC5:** Falha no shadow NÃO impacta resposta de superfície
  - Erro logado via Sentry
  - Resposta ao aluno entregue normalmente
- [ ] **AC6:** Sentry spans para Detector e Perfilador separados
- [ ] **AC7:** Algoritmo de merge incremental do Perfilador:
  - `avg_depth_achieved = (old * sessionCount + new) / (sessionCount + 1)`
  - Kolb axes: média ponderada
  - Confidence: cresce com mais sessões (cap 0.9)
  - Regras de confiança por número de sessões

#### Technical Notes

```typescript
// No Orquestrador v2, após pipeline de superfície:
const shadowPromise = Promise.allSettled([
  runDetector(shadowData, context),
  shouldRunProfiler(sessionTurnNumber) ? runProfiler(shadowData, existingProfile) : Promise.resolve(null),
])

// Não await aqui — fire-and-forget (ou waitUntil em serverless)
shadowPromise.then(([detectorResult, profilerResult]) => {
  if (detectorResult.status === 'fulfilled') {
    saveSessionAnalytics(sessionId, detectorResult.value)
  }
  if (profilerResult.status === 'fulfilled' && profilerResult.value) {
    upsertLearnerProfile(studentId, tenantId, profilerResult.value)
  }
}).catch(error => {
  Sentry.captureException(error, { tags: { pipeline: 'shadow' } })
})
```

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Pipeline shadow, merge, persistência |
| **@architect (Aria)** | Review da arquitetura paralela |
| **@qa (QA)** | Testar tolerância a falhas e merge |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Shadow failure não impacta superfície | Yes |
| Pre-PR | Merge incremental correto (testado com perfil existente) | Yes |

---

### Story 17.4: Gestão de Interações — Limite + Fechamento Inteligente

**As a** student,
**I want** que a sessão socrática encerre naturalmente quando atingo maturidade,
**so that** a conversa não se arraste além do útil.

**Architecture Reference:** ws1-motor-socratico-architecture.md, Seção 8

**Story Points:** 5
**Priority:** P1
**Risk:** MEDIUM — lógica condicional no pipeline

#### Acceptance Criteria

- [ ] **AC1:** Contador `interactions_remaining` decrementado a cada troca
  - Limite máximo configurável (range: 5-30)
  - Default por tipo: socratic_dialogue=20, quiz=8, scenario=12, assignment=15
  - Instrutor pode definir (via WS2 — usar default até lá)
- [ ] **AC2:** Quando `interactions_remaining = 0`: forçar Fechamento Socrático
  - Mestre recebe flag `is_closing: true`
  - Perguntas de fechamento: integração, ação, apreciação
  - Regras: nunca resumir, nunca dar homework, honrar jornada
- [ ] **AC3:** Fechamento inteligente (smart_closing)
  - Ativo quando: `min_interactions_before >= 5` E `depth_threshold >= 6` E `insights_threshold >= 2` E `remaining <= threshold`
  - Usa dados do Detector (depth_progression, breakthrough_candidates)
  - Mestre SUGERE encerrar (não força)
  - Aluno pode aceitar (encerrar) ou continuar
- [ ] **AC4:** Config em `InteractionConfig` interface
  - `max_interactions`, `configured_by`, `type_defaults`, `smart_closing` (enabled, thresholds)
- [ ] **AC5:** Sessão salva com status adequado: `completed` (encerramento natural) ou `limit_reached` (forçado)
- [ ] **AC6:** Frontend exibe indicador de interações restantes (opcional, não-blocking)

#### Technical Notes

O Orquestrador consulta `interactions_remaining` e dados do Detector para decidir o modo do Mestre. O Mestre tem seção condicional no prompt para fechamento.

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Lógica de gestão, integração no Orquestrador |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Fechamento forçado em `remaining = 0` funciona | Yes |

---

### Story 17.5: Tipos de Interação — Comportamento Adaptativo do Mestre

**As a** student,
**I want** que o Mestre adapte seu comportamento conforme o tipo de interação (diálogo, quiz, cenário, tarefa),
**so that** cada tipo de pergunta receba tratamento pedagógico adequado.

**Architecture Reference:** ws1-motor-socratico-architecture.md, Seção 7

**Story Points:** 5
**Priority:** P1
**Risk:** LOW — seção condicional no prompt, sem mudanças estruturais

#### Acceptance Criteria

- [ ] **AC1:** `interaction_type` aceito como input do Orquestrador
  - Tipos: `socratic_dialogue` | `quiz` | `scenario` | `assignment`
  - Default: `socratic_dialogue` (até WS2 implementar)
- [ ] **AC2:** Input schema `InteractionInput` implementado
  - type, content, metadata (alternatives, rubric, context, expected_depth)
- [ ] **AC3:** Prompt do Mestre adapta comportamento por tipo:
  - `socratic_dialogue`: progressão completa 7 camadas, todas as técnicas, default 15-20 interações
  - `quiz`: foco na justificativa, não confirma certo/errado, camadas 1-4, 5-8 interações
  - `scenario`: foco em trade-offs e perspectivas, camadas 3-6, 8-12 interações
  - `assignment`: guiar construção passo a passo, camadas 3-7, 10-15 interações
- [ ] **AC4:** Model Router aplica override por tipo (Standard + quiz → Mestre gpt-4.1-mini)
- [ ] **AC5:** Defaults de `max_interactions` variam por tipo
- [ ] **AC6:** Backward compatible: sem `interaction_type` → assume `socratic_dialogue`

#### Technical Notes

Seção condicional no prompt do Mestre:
```
SE type = "socratic_dialogue" → progressão completa 7 camadas
SE type = "quiz"              → foco em justificativa, não confirmar certo/errado
SE type = "scenario"          → foco em trade-offs, perspectivas e consequências
SE type = "assignment"        → guiar construção passo a passo
```

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar seção condicional no prompt e input schema |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |

---

### Story 17.6: Contexto de Perfil do Aluno no Prompt do Mestre

**As a** student,
**I want** que o Mestre personalize as perguntas baseado no meu perfil comportamental,
**so that** a experiência socrática seja adaptada ao meu estilo de aprendizado.

**Architecture Reference:** ws1-motor-socratico-architecture.md, Seções 6.5 (adaptação Kolb), 12

**Story Points:** 3
**Priority:** P1
**Risk:** LOW — injeção de contexto no prompt

#### Acceptance Criteria

- [ ] **AC1:** Orquestrador busca perfil do aluno (se existente) antes de chamar Mestre
  - Dados de `learner_profiles` (WS1 — Perfilador)
  - Dados de `user_profiles` (existentes: Big Five, Enneagram, DISC, Inteligências Múltiplas)
- [ ] **AC2:** Contexto embedado no system prompt do Mestre:
  - Estilo Kolb detectado + adaptação (tipo de pergunta preferido)
  - Big Five (se disponível)
  - DISC perfil (se disponível)
  - Enneagram tipo + dicas personalizadas (se disponível)
  - Inteligências múltiplas top 2 (se disponível)
  - Adaptation hints do Perfilador
- [ ] **AC3:** Mestre adapta tipo de pergunta baseado no estilo Kolb:
  - Divergente → perspectiva, conexão pessoal
  - Assimilador → evidência, frameworks
  - Convergente → aplicação prática, problema
  - Acomodador → ação, experimentação
- [ ] **AC4:** Se perfil não existe (primeira sessão): Mestre usa comportamento neutro
- [ ] **AC5:** Sanitização do conteúdo de perfil (regex + length limits) antes de injetar no prompt

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Busca do perfil, injeção no prompt, sanitização |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |

---

## Dependency Graph

```
                    Epic 16 (Core Pipeline)
                           ↓
Story 17.1 (Schemas + Prompts)     Story 17.2 (Schema DB)
    ↓                                   ↓
    └────────── Story 17.3 ─────────────┘  (Pipeline Shadow)
                    ↓
    Story 17.4 (Gestão Interações)     Story 17.5 (Tipos de Interação)
                    ↓
              Story 17.6 (Contexto Perfil)
```

**Ordem de execução sugerida:** 17.1 + 17.2 em paralelo → 17.3 → (17.4 + 17.5 em paralelo) → 17.6

---

## Compatibility Requirements

- [ ] Pipeline de superfície (Epic 16) não é afetado por falhas no shadow
- [ ] Sessions existentes não são corrompidas (analytics é campo novo, nullable)
- [ ] learner_profiles é aditivo (nova tabela)
- [ ] Sem `interaction_type` → default `socratic_dialogue` (backward compatible)
- [ ] Perfil não existente → Mestre neutro (sem personalização)

---

## Risk Mitigation

| Risco | Impacto | Mitigação | Rollback |
|---|---|---|---|
| Shadow pipeline lento (aumenta latência) | Alto | Fire-and-forget / `waitUntil` — não bloqueia resposta | Desabilitar shadow temporariamente |
| Detector com false positives IA | Médio | Regra: nunca bloqueia, nunca penaliza (apenas dados) | Ajustar thresholds |
| Perfilador enviesado com poucas sessões | Médio | Confidence < 0.3 para < 3 sessões, cap 0.9 | Ignorar perfil com baixa confidence |
| Merge incremental corrompe perfil | Médio | Testes com múltiplas sessões sequenciais | Reset do perfil (delete + recalcular) |
| JSONB analytics cresce demais | Baixo | Limitar arrays (depth_progression max 30 entries) | Truncar arrays antigos |

---

## New File Locations

```
packages/agents/src/
├── orchestrator.ts              # ATUALIZAR (add shadow pipeline)
├── prompts/
│   ├── detector.ts              # NOVO
│   └── perfilador.ts            # NOVO
├── schemas/
│   ├── detector.ts              # NOVO
│   └── perfilador.ts            # NOVO

packages/database/src/schema/
├── sessions.ts                  # ATUALIZAR (add analytics JSONB)
└── learner-profiles.ts          # NOVO

supabase/migrations/
├── YYYYMMDD_add_session_analytics.sql    # NOVO
└── YYYYMMDD_create_learner_profiles.sql  # NOVO
```

---

## Definition of Done

- [ ] Detector analisa cada interação (3 camadas)
- [ ] Perfilador roda a cada 5 interações com merge incremental
- [ ] Shadow pipeline paralelo e tolerante a falhas
- [ ] Dados persistidos em DB (session_analytics + learner_profiles)
- [ ] Fechamento inteligente funcional
- [ ] 4 tipos de interação adaptativos
- [ ] Contexto de perfil injetado no Mestre
- [ ] `pnpm typecheck` e `pnpm build` passam
- [ ] Zero impacto na latência da resposta de superfície

---

## Total Story Points

| Story | Título | SP | Dependência |
|-------|--------|---:|-------------|
| 17.1 | Schemas + Prompts (Detector, Perfilador) | 5 | Epic 16 |
| 17.2 | Schema DB (session_analytics, learner_profiles) | 5 | — |
| 17.3 | Pipeline Shadow (paralelo + persistência) | 8 | 17.1, 17.2 |
| 17.4 | Gestão de Interações (limite + fechamento) | 5 | 17.3 |
| 17.5 | Tipos de Interação (4 tipos adaptativos) | 5 | 17.3 |
| 17.6 | Contexto de Perfil no Mestre | 3 | 17.3 |
| **Total** | | **31** | |

---

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-02-15 | 1.0 | Criação do épico | Morgan (PM) |
