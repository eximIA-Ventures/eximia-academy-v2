# Epic 21: WS2 — Orchestrator, API & Database

**Version:** 1.1
**Created:** 2026-02-16
**Updated:** 2026-02-16
**Author:** Morgan (PM) com arquitetura de Aria (Architect)
**Status:** Draft
**PRD Reference:** `Benchmarks/07_Course_Designer/PRD-Course-Designer-v1.0.md`
**Architecture Reference:** `docs/architecture/ws2-course-creator-architecture.md` — Seções 10, 13, 15, 16
**Workstream:** WS2 (Course Creator — depende do Epic 20 para agentes do pipeline)

---

## Epic Goal

Construir a camada de infraestrutura do Course Creator: Design Orchestrator que executa o pipeline de 5 fases com SSE real-time e fallback DB (D9), migrations para estender tabelas existentes e criar novas, API routes RESTful completas, e Content Analyzer LLM-only para PDFs/PPTX (D15).

## Epic Context

| Item | Detalhe |
|------|---------|
| **Stack** | Next.js 15 API Routes, Supabase, Drizzle ORM, SSE (Server-Sent Events) |
| **DB Tables** | `course_blueprints` (ESTENDER), `blueprint_modules` (NOVO), `blueprint_objectives` (ESTENDER), `blueprint_assessments` (ESTENDER), `blueprint_generation_jobs` (NOVO) |
| **AI Agents** | Design Orchestrator (NOVO), Content Analyzer (NOVO) |
| **Providers** | OpenAI (gpt-4.1) para Content Analyzer — via Model Router |
| **Design Tokens** | N/A (backend) |
| **Roles Impactados** | manager, admin |
| **Package** | `@eximia/agents`, `apps/web` (API routes) |

---

## Existing System Context

### Infrastructure Already in Place

| Component | Status | Reference |
|-----------|--------|-----------|
| `course_blueprints` table | Existente (estender) | `packages/database/src/schema/` |
| `blueprint_objectives` table | Existente (estender) | `packages/database/src/schema/` |
| `blueprint_assessments` table | Existente (estender) | `packages/database/src/schema/` |
| Blueprint proxy Python | Existente (DEPRECAR — D5) | `POST /api/blueprint/generate` |
| Supabase RLS pattern | Existente (seguir) | `auth_tenant_id()`, `auth_user_role()` |
| Drizzle ORM | Existente (seguir pattern) | `packages/database/` |
| API Routes Next.js 15 | Existente (seguir pattern) | `apps/web/src/app/api/` |

### Current Blueprint Flow

```
POST /api/blueprint/generate
    → Proxy para microservice Python
    → Retorna JSON simples
    → Salva em course_blueprints
```

### What This Epic Changes

```
POST /api/course-designer/generate
    │
    ├─ Cria blueprint_generation_job (status: "processing")
    ├─ Inicia SSE stream para progresso real-time
    │
    ▼
[Fase 1: Analyzer]  → SSE: {phase: 1, status: "running"}
[Fase 2: Architect]  → SSE: {phase: 2, status: "running"}
[Fase 3: Calculator] → SSE: {phase: 3, status: "running"}
[Fase 4: Validator]  → SSE: {phase: 4, status: "running"}
[Fase 5: Generator]  → SSE: {phase: 5, status: "running"}
    │
    ▼
SSE: {status: "completed", blueprint_id: "uuid"}

Se instrutor sair e voltar:
    → GET /api/course-designer/jobs/[jobId]
    → Retorna estado do DB (phase_results JSONB)
```

---

## Enhancement Details

### Design Orchestrator: Hybrid SSE + DB (D9)

```
┌─────────────────────────────────────────────────────────┐
│                  DESIGN ORCHESTRATOR                     │
│                                                          │
│  Input: CourseDesignerInput (6 camadas)                  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │           blueprint_generation_job                │   │
│  │  status: processing → completed/failed            │   │
│  │  phase_results: JSONB (retry parcial)             │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  Phase 1 ──▶ Phase 2 ──▶ Phase 3 ──▶ Phase 4 ──▶ Phase 5│
│    │           │           │           │           │     │
│    SSE         SSE         SSE         SSE         SSE   │
│                                                          │
│  Quality Gate (D14):                                     │
│  IF needs_revision → auto-retry 1x silencioso           │
│  IF still fails → flag requires_instructor_review       │
│                                                          │
│  Timeout: 5 min total                                    │
└─────────────────────────────────────────────────────────┘
```

### API Routes

```
POST   /api/course-designer/generate               # Inicia pipeline + SSE
GET    /api/course-designer/jobs/[jobId]            # Poll status (DB fallback)
GET    /api/course-designer/blueprints              # Lista blueprints do tenant
GET    /api/course-designer/blueprints/[id]         # Blueprint completo
PUT    /api/course-designer/blueprints/[id]         # Editar draft (recalcula score)
POST   /api/course-designer/blueprints/[id]/apply   # Blueprint → curso
DELETE /api/course-designer/blueprints/[id]         # Deletar draft
GET    /api/course-designer/blueprints/[id]/export  # JSON export
GET    /api/course-designer/frameworks              # Lista frameworks (v1: 3)
POST   /api/course-designer/analyze-content         # Content Analyzer (PDF)
POST   /api/course-designer/ai-fill                 # "Preencher com IA" (Wizard steps)
```

### Success Criteria

- [ ] Pipeline 5 fases executa sequencialmente com SSE progress
- [ ] Blueprint salvo no DB com quality_score e neuroscience_score
- [ ] DB fallback funciona: instrutor pode sair e voltar para ver resultado
- [ ] Quality Gate híbrido: auto-retry 1x → flag para instrutor se falhar
- [ ] Content Analyzer extrai tópicos de PDFs via LLM
- [ ] Timeout 5 min com fallback graceful
- [ ] Todas as API routes requerem role manager ou admin
- [ ] RLS tenant isolation em todas as tabelas novas

---

## Stories

---

### Story 21.1: Database Migration — Extend Blueprints + New Tables

**As a** developer,
**I want** migrations SQL para estender `course_blueprints` e criar `blueprint_modules` e `blueprint_generation_jobs`,
**so that** o Course Creator tenha persistência completa.

**Architecture Reference:** ws2-course-creator-architecture.md, Seção 15

**Story Points:** 5
**Priority:** P0 (fundação — todas as API routes dependem disto)
**Risk:** MEDIUM — altera tabelas existentes, requer backward compatibility

#### Acceptance Criteria

- [ ] **AC1:** Migration `YYYYMMDD_extend_blueprints_for_ws2.sql`
  - `course_blueprints` ADD COLUMN: `primary_framework`, `complementary_frameworks[]`, `quality_score`, `neuroscience_score`, `quality_verdict`, `audience_profile` (JSONB), `evaluation_plan` (JSONB), `interaction_strategy` (default `bloom_mapped`), `source_course_id`, `version` (default `3.0`)
  - Todos os novos campos são nullable (backward-compatible)
- [ ] **AC2:** `blueprint_modules` table criada
  - Columns: id, blueprint_id (FK), tenant_id (FK), order, title, description, duration_minutes, spiral_level, interaction_type (CHECK), framework_stages (JSONB), problema_motor (JSONB), cognitive_load (JSONB), chunks (JSONB), rubrics (JSONB), created_at
  - UNIQUE constraint: (blueprint_id, order)
  - RLS enabled: tenant isolation via `auth_tenant_id()` + manager/admin access
  - Index: `idx_blueprint_modules_blueprint` on blueprint_id
- [ ] **AC3:** `blueprint_generation_jobs` table criada
  - Columns: id, blueprint_id (FK), tenant_id (FK), status (CHECK: pending/processing/completed/failed), current_phase (1-5), phase_results (JSONB), error_message, started_at, completed_at, created_at
  - RLS enabled
- [ ] **AC4:** `blueprint_objectives` extended: ADD `module_id` (FK to blueprint_modules), `abcd` (JSONB)
- [ ] **AC5:** `blueprint_assessments` extended: ADD `module_id` (FK), `kirkpatrick_level`, `rubrics` (JSONB)
- [ ] **AC6:** Drizzle schema files atualizados em `packages/database/src/schema/`
- [ ] **AC7:** Migration aplica sem downtime — todos os ADD COLUMN são nullable
- [ ] **AC8:** `pnpm typecheck` passa

#### Technical Notes

```sql
-- Exemplo: RLS para blueprint_modules
ALTER TABLE blueprint_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON blueprint_modules
  FOR ALL USING (tenant_id = auth_tenant_id());
CREATE POLICY "Manager/Admin access" ON blueprint_modules
  FOR ALL USING (auth_user_role() IN ('manager', 'admin'));
```

IMPORTANTE: `courses.tenant_id` e `courses.created_by` são NOT NULL sem auto-trigger. Garantir que `blueprint_modules.tenant_id` é preenchido explicitamente.

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Escrever migration + Drizzle schemas |
| **@data-engineer (Dara)** | Validar RLS e indexes |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Migration aplica e reverte sem erros | Yes |
| Pre-PR | RLS testado: tenant A não vê dados do tenant B | Yes |

---

### Story 21.2: Design Orchestrator — Pipeline 5 Fases + Quality Gate

**As a** developer,
**I want** um Design Orchestrator que executa as 5 fases sequencialmente com quality gate híbrido (D14),
**so that** blueprints sejam gerados com retry automático e estado durável.

**Architecture Reference:** ws2-course-creator-architecture.md, Seção 10

**Story Points:** 8
**Priority:** P0 (core)
**Risk:** HIGH — orquestra todo o pipeline, quality gate define UX

#### Acceptance Criteria

- [ ] **AC1:** `designCourse(input)` em `packages/agents/src/course-designer/orchestrator.ts`
  - Executa sequencialmente: runAnalyzer → runArchitect → runCalculator → runValidator → runGenerator
  - Persiste cada phase_result no `blueprint_generation_jobs` (JSONB)
  - Retorna Blueprint completo
- [ ] **AC2:** Quality Gate Híbrido (D14)
  - Se verdict = `needs_revision` ou `poor`: auto-retry 1x silencioso
  - Retry: re-executa Architect → Calculator → Validator com `revision_feedback`
  - Se ainda falha após retry: `blueprint.metadata.requires_instructor_review = true`
  - Nunca falha silenciosamente — sempre retorna blueprint (com flag se necessário)
- [ ] **AC3:** Job tracking
  - Cria `blueprint_generation_job` com status `processing` ao iniciar
  - Atualiza `current_phase` (1-5) a cada fase
  - Salva `phase_results` JSONB a cada fase concluída
  - Atualiza status `completed` ou `failed` ao final
- [ ] **AC4:** Timeout total de 5 minutos
  - Se timeout: salva phase_results parciais, marca job como `failed` com error_message
- [ ] **AC5:** Sentry spans por fase (reutilizar pattern do Epic 16)
- [ ] **AC6:** Retry parcial: se fase N falha, pode reiniciar da fase N (usando phase_results salvos)
- [ ] **AC7:** Orchestrator aceita callback `onProgress(phase, status, progress_pct)` para integração com SSE (Story 21.3 consome este callback)
- [ ] **AC8:** `pnpm typecheck` passa

#### Technical Notes

```typescript
export async function designCourse(
  input: CourseDesignerInput,
  onProgress?: (phase: number, status: string, progress_pct: number) => void
): Promise<Blueprint> {
  const analysis = await runAnalyzer(input)
  let architecture = await runArchitect({ ...input, analysis })
  let calculations = await runCalculator({ architecture, total_duration_hours: input.total_duration_hours })
  let validation = await runValidator({ analysis, architecture, calculations })

  // Auto-retry 1x silencioso (D14)
  if (validation.scorecard.verdict === "needs_revision" || validation.scorecard.verdict === "poor") {
    architecture = await runArchitect({
      ...input, analysis,
      revision_feedback: validation.scorecard.recommendations,
    })
    calculations = await runCalculator({ architecture, total_duration_hours: input.total_duration_hours })
    validation = await runValidator({ analysis, architecture, calculations })
  }

  const blueprint = await runGenerator({ analysis, architecture, calculations, validation })

  if (validation.scorecard.verdict === "needs_revision" || validation.scorecard.verdict === "poor") {
    blueprint.metadata.requires_instructor_review = true
    blueprint.metadata.review_reason = validation.scorecard.recommendations
  }

  return blueprint
}
```

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar Orchestrator |
| **@architect (Aria)** | Review do fluxo de retry e timeout |
| **@qa (QA)** | Testar quality gate (retry + fallback) |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Pipeline happy path: 5 fases → blueprint | Yes |
| Pre-PR | Quality gate retry: needs_revision → auto-retry → resultado | Yes |
| Pre-PR | Timeout: job marcado como failed após 5min | Yes |

---

### Story 21.3: Blueprint Jobs & SSE Streaming

**As a** developer,
**I want** SSE streaming do progresso do pipeline com fallback DB para reconexão,
**so that** o instrutor veja progresso real-time e possa sair/voltar.

**Architecture Reference:** ws2-course-creator-architecture.md, Seção 10.1

**Story Points:** 5
**Priority:** P0 (core)
**Risk:** MEDIUM — SSE em Next.js requer tratamento de conexão

#### Acceptance Criteria

- [ ] **AC1:** `POST /api/course-designer/generate` em `apps/web/src/app/api/course-designer/generate/route.ts`
  - Inicia pipeline assíncronamente
  - Retorna SSE stream com progresso
  - Events: `{ phase: 1-5, status: "running"|"completed"|"failed", progress_pct: 0-100 }`
  - Event final: `{ status: "completed", blueprint_id: "uuid" }` ou `{ status: "failed", error: "..." }`
- [ ] **AC2:** `GET /api/course-designer/jobs/[jobId]` — DB fallback
  - Retorna status atual do job: current_phase, status, phase_results (se completed)
  - Se completed: inclui blueprint_id
  - Se failed: inclui error_message
- [ ] **AC3:** SSE connection handling
  - Heartbeat a cada 15s para manter conexão
  - Reconexão graceful: client pode reconectar e receber estado atual
  - Cleanup on disconnect: job continua processando (não cancela)
- [ ] **AC4:** Auth + RLS: apenas manager/admin do tenant correto
- [ ] **AC5:** Rate limiting: max 3 jobs concorrentes por tenant

#### Technical Notes

```typescript
// SSE pattern para Next.js 15 App Router
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      send({ phase: 1, status: 'running', progress_pct: 0 })
      const analysis = await runAnalyzer(input)
      send({ phase: 1, status: 'completed', progress_pct: 20 })
      // ... continua para cada fase
    }
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }
  })
}
```

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar SSE + job polling |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | SSE stream funciona no browser | Yes |
| Pre-PR | DB fallback retorna status correto | Yes |

---

### Story 21.4: API Routes — CRUD + Frameworks + Export

**As a** developer,
**I want** API routes RESTful completas para blueprints, frameworks e export,
**so that** o frontend (Epic 22) tenha todos os endpoints necessários.

**Architecture Reference:** ws2-course-creator-architecture.md, Seção 16

**Story Points:** 5
**Priority:** P0 (core)
**Risk:** LOW — CRUD padrão seguindo patterns existentes

#### Acceptance Criteria

- [ ] **AC1:** `GET /api/course-designer/blueprints` — lista blueprints do tenant
  - Filtros: status, primary_framework
  - Paginação: cursor-based
  - Include: metadata, quality_score, status, created_at
- [ ] **AC2:** `GET /api/course-designer/blueprints/[id]` — blueprint completo
  - Include: módulos, objetivos, assessments, quality_scorecard
  - JOIN com blueprint_modules
- [ ] **AC3:** `PUT /api/course-designer/blueprints/[id]` — editar blueprint draft
  - Permite editar: módulos (textos, ordem, interaction_type, durações)
  - Recalcula Quality Scorecard após edição (chama runValidator)
  - Retorna novo score e delta vs. anterior
  - Apenas blueprints com status `draft`
- [ ] **AC4:** `DELETE /api/course-designer/blueprints/[id]` — deletar blueprint
  - Soft delete ou cascade delete de módulos associados
  - Apenas status `draft`
- [ ] **AC5:** `GET /api/course-designer/blueprints/[id]/export` — JSON export
  - Retorna blueprint completo como JSON download
- [ ] **AC6:** `GET /api/course-designer/frameworks` — lista frameworks disponíveis
  - Retorna: id, name, description, stages_count, type para cada framework v1
  - Usa `listFrameworks()` do Registry (Epic 20)
- [ ] **AC7:** Todos os endpoints requerem `manager` ou `admin` role
- [ ] **AC8:** RLS via `auth_tenant_id()` em todas as queries
- [ ] **AC9:** `POST /api/course-designer/ai-fill` — "Preencher com IA"
  - Input: `{ step: 1-5, filled_fields: Record<string, any> }`
  - Usa LLM para sugerir valores para campos vazios com base nos já preenchidos
  - Output: `{ suggestions: Record<string, { value: any, confidence: number }> }`
  - Usado pelo Wizard (Epic 22) em cada step

#### Technical Notes

Seguir pattern existente das API routes em `apps/web/src/app/api/`. Usar Drizzle ORM para queries.

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar API routes |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | CRUD funciona para cada endpoint | Yes |
| Pre-PR | RLS: tenant A não acessa blueprints do tenant B | Yes |

---

### Story 21.5: Content Analyzer — LLM-only PDF/PPTX (D15)

**As a** manager,
**I want** fazer upload de PDFs e slides para que a IA extraia tópicos e competências automaticamente,
**so that** o preenchimento do wizard seja assistido com material existente.

**Architecture Reference:** ws2-course-creator-architecture.md, Seção 13

**Story Points:** 5
**Priority:** P1 (enhancement — wizard funciona sem Content Analyzer)
**Risk:** MEDIUM — qualidade da extração depende do LLM, PDFs variam muito

#### Acceptance Criteria

- [ ] **AC1:** `POST /api/course-designer/analyze-content` em `apps/web/src/app/api/course-designer/analyze-content/route.ts`
  - Aceita: PDF, PPTX, DOCX, TXT
  - Max file size: 10MB
  - Retorna: `ContentAnalysisResult`
- [ ] **AC2:** `analyzeContent(file)` em `packages/agents/src/course-designer/content-analyzer.ts`
  - Envia arquivo diretamente ao LLM (PDF support nativo)
  - Extrai: tópicos principais, conceitos-chave, nível Bloom estimado, estrutura (capítulos/seções)
  - Output Zod-validated
- [ ] **AC3:** Schema `ContentAnalysisResult`
  - `topics_extracted[]`: título, descrição, bloom_estimate
  - `competencies_suggested[]`: competência sugerida
  - `structure_detected`: capítulos/seções encontrados
  - `content_summary`: resumo de 200-500 palavras
  - `confidence`: 0-1
- [ ] **AC4:** Output pré-preenche campos do wizard: `topics_outline`, `core_competencies` sugeridas
  - Instrutor revisa, aceita, edita ou descarta cada sugestão
- [ ] **AC5:** Sem engine de extração adicional — LLM-only (D15)
- [ ] **AC6:** Rate limiting: max 5 análises por hora por tenant

#### Technical Notes

**⚠️ Resolução D15 (modelo para PDF):** A decisão D15 originalmente referenciava "PDF nativo do Claude", mas o projeto opera com Zero Claude em produção. **Validar antes de implementar**: se gpt-4.1 suporta PDF upload nativo com qualidade suficiente, usar gpt-4.1. Caso contrário, adicionar `pdf-parse` como pré-processamento (texto extraído → LLM analisa texto). A premissa "LLM-only" refere-se a não ter engine de análise própria — um parser de texto é aceitável.

Zero dependência em libraries de análise semântica (apenas extração de texto se necessário).

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar Content Analyzer + API route |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Extração funciona para PDF de teste | Yes |

---

## Dependency Graph

```
Story 21.1 (Database Migration)
    ↓
Story 21.2 (Design Orchestrator)    Story 21.4 (API Routes CRUD)    Story 21.5 (Content Analyzer)
    ↓                                    ↓                               ↓
Story 21.3 (SSE Streaming)              │                               │
    ↓                                    ↓                               ↓
    └──────────────── Todos prontos ─────┴───────────────────────────────┘
```

**Ordem de execução sugerida:** 21.1 → 21.2 + (21.4 + 21.5 em paralelo) → 21.3

**Dependência inter-epic:** Epic 20 (agentes do pipeline) deve estar concluído antes de 21.2.

**Nota:** 21.5 (Content Analyzer) depende apenas de 21.1 (schema DB para rate limiting) — não de 21.4. 21.3 (SSE) depende de 21.2 (Orchestrator com callback `onProgress`).

---

## Compatibility Requirements

- [ ] Tabelas existentes preservam dados (ADD COLUMN nullable)
- [ ] Endpoint legado `/api/blueprint/generate` continua funcionando (deprecado, não removido)
- [ ] Novos endpoints em `/api/course-designer/` — zero conflito
- [ ] RLS segue padrão existente: `auth_tenant_id()` + `auth_user_role()`
- [ ] Content Ingestion existente não é afetado
- [ ] Apply endpoint (`POST .../apply`) é stub neste epic — implementação completa no Epic 23

---

## Risk Mitigation

| Risco | Impacto | Mitigação | Rollback |
|---|---|---|---|
| Pipeline > 5 min (timeout) | Médio | SSE progress visual + phase_results para retry parcial | Aumentar timeout, considerar Inngest |
| SSE disconnect no meio do pipeline | Médio | DB fallback: job continua, client reconecta e polls | GET /jobs/[jobId] sempre disponível |
| Migration altera tabela em uso | Alto | ADD COLUMN nullable, zero breaking changes | Revert migration |
| Content Analyzer impreciso para PDFs complexos | Baixo | Instrutor revisa sugestões antes de aceitar | Usuário ignora sugestões |
| Rate limiting muito restritivo | Baixo | Config tunável por tenant | Relaxar limites |

---

## New File Locations

```
packages/agents/src/
├── course-designer/
│   ├── orchestrator.ts              # NOVO — Pipeline controller
│   └── content-analyzer.ts          # NOVO — LLM-only PDF/PPTX

apps/web/src/app/api/course-designer/
├── generate/route.ts                # NOVO — POST (pipeline + SSE)
├── jobs/[jobId]/route.ts            # NOVO — GET (status poll)
├── frameworks/route.ts              # NOVO — GET (list frameworks)
├── analyze-content/route.ts         # NOVO — POST (Content Analyzer)
├── blueprints/
│   ├── route.ts                     # NOVO — GET (list)
│   └── [blueprintId]/
│       ├── route.ts                 # NOVO — GET, PUT, DELETE
│       ├── apply/route.ts           # STUB neste epic — implementação completa no Epic 23
│       └── export/route.ts          # NOVO — GET (JSON export)
├── ai-fill/route.ts                 # NOVO — POST ("Preencher com IA" para Wizard)

supabase/migrations/
└── YYYYMMDD_extend_blueprints_for_ws2.sql  # NOVO

packages/database/src/schema/
├── blueprint-modules.ts             # NOVO
├── blueprint-generation-jobs.ts     # NOVO
├── course-blueprints.ts             # ATUALIZAR
├── blueprint-objectives.ts          # ATUALIZAR
└── blueprint-assessments.ts         # ATUALIZAR
```

---

## Definition of Done

- [ ] Migration aplica sem downtime
- [ ] Pipeline 5 fases executa com SSE progress
- [ ] DB fallback: job polling funciona
- [ ] Quality gate híbrido: auto-retry 1x + flag para instrutor
- [ ] CRUD completo para blueprints
- [ ] Frameworks endpoint retorna 3 frameworks
- [ ] Content Analyzer extrai tópicos de PDFs
- [ ] Todos os endpoints com auth + RLS
- [ ] `pnpm typecheck` e `pnpm build` passam

---

## Total Story Points

| Story | Título | SP | Dependência |
|-------|--------|---:|-------------|
| 21.1 | Database Migration | 5 | — |
| 21.2 | Design Orchestrator (Pipeline + Quality Gate) | 8 | 21.1, Epic 20 |
| 21.3 | Blueprint Jobs & SSE Streaming | 5 | 21.2 |
| 21.4 | API Routes CRUD + Frameworks + Export | 5 | 21.1 |
| 21.5 | Content Analyzer (LLM-only PDF) | 5 | 21.1 |
| **Total** | | **28** | |

---

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-02-16 | 1.0 | Criação do épico | Morgan (PM) |
| 2026-02-16 | 1.1 | Validação @po: fix D15 note, add onProgress callback (21.2 AC7), fix dep graph (21.5→21.1), add ai-fill endpoint (21.4 AC9), add apply stub note | Pax (PO) |
