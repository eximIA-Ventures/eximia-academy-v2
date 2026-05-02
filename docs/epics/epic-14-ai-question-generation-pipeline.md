# Epic 14: AI Question Generation Pipeline (Geracao Automatica de Perguntas Socraticas)

**Version:** 1.0
**Created:** 2026-02-10
**Updated:** 2026-02-10
**Author:** Morgan (PM) com arquitetura de Aria (Architect)
**Status:** Draft
**PRD Reference:** `docs/prd.md` — FR4 (Socratic Questions), FR5 (Question Review)
**Architecture Reference:** `docs/architecture.md` v1.4 — Sections 5.3, 6.2
**Screens Reference:** `docs/screens.md` — Tela Revisao de Perguntas do Curso

---

## Epic Goal

Transformar a geracao de perguntas socraticas de um processo manual (capitulo a capitulo) em um pipeline automatico que gera perguntas para o curso inteiro de uma vez, com tela de revisao em batch para o manager aprovar, rejeitar ou editar todas as perguntas em uma unica interface — incluindo auto-trigger apos publicacao de capitulos ou ingestion de conteudo.

## Epic Context

| Item | Detalhe |
|------|---------|
| **Stack** | Next.js 15, Vercel AI SDK 6.0, Claude Sonnet 4.5, Drizzle ORM |
| **DB Tables** | `question_generation_jobs` (NOVA), `questions` (existente, add job_id) |
| **AI Agent** | Creator Agent existente (`packages/agents/src/creator.ts`) |
| **Design Tokens** | `apps/web/src/styles/theme.css` |
| **Roles Impactados** | manager, admin (revisao de perguntas) |
| **Dependencia Pacote** | Nenhuma nova (reutiliza stack existente) |

---

## Existing System Context

### Infrastructure Already in Place

| Component | Status | Reference |
|-----------|--------|-----------|
| Creator Agent (generateQuestions) | Implementado | `packages/agents/src/creator.ts` |
| API de geracao por capitulo | Implementado | `apps/web/src/app/api/chapters/[chapterId]/generate-questions/route.ts` |
| Question Review UI (por capitulo) | Implementado | `apps/web/.../questions/_components/questions-review-client.tsx` |
| Question Review Card | Implementado | `apps/web/.../questions/_components/question-review-card.tsx` |
| Approve/Reject/Edit actions | Implementado | `apps/web/.../questions/actions.ts` |
| Creator Schema (Zod) | Implementado | `packages/agents/src/schemas/creator.ts` |
| Rate Limiting | Implementado | `apps/web/src/lib/rate-limit.ts` |
| Generate Questions Button | Implementado | `apps/web/.../_components/generate-questions-button.tsx` |

### Current Question Flow

```
Manager navega para capitulo
    → Clica "Gerar Perguntas"
    → API chama Creator Agent para 1 capitulo
    → 3 perguntas geradas com status='pending'
    → Manager revisa 1 a 1 (aprovar/rejeitar/editar)
    → Repete para CADA capitulo do curso
```

### What This Epic Changes

```
Trigger automatico (ingestion OU publicacao OU botao manual)
    → Job criado para curso inteiro
    → Creator Agent executa para CADA capitulo sequencialmente
    → Progress em tempo real (SSE)
    → Manager recebe notificacao
    → Tela de revisao em BATCH:
        - Ve todas perguntas do curso agrupadas por capitulo
        - Pode aprovar/rejeitar individualmente
        - Pode aprovar TODAS de uma vez
        - Pode selecionar e aprovar/rejeitar em batch
    → Dashboard com stats de perguntas
```

---

## Enhancement Details

### Core Concept: Batch Generation + Batch Review

```
┌──────────────┐   ┌───────────────────┐   ┌────────────────────────────┐
│   TRIGGER    │──▶│  BATCH GENERATE   │──▶│     BATCH REVIEW           │
│  Auto/Manual │   │  Sequencial por   │   │  Todas perguntas do curso  │
│              │   │  capitulo          │   │  Aprovar/Rejeitar em batch │
└──────────────┘   └───────────────────┘   └────────────────────────────┘
   - Ingestion       - Creator Agent        - Agrupado por capitulo
   - Publish          - Progress SSE        - Selecao multipla
   - Manual click     - Skip com perguntas  - Aprovar todas
                      - Retry on failure    - Stats dashboard
```

### Question Generation Job Lifecycle

```
pending → processing → review → completed
                   ↘ failed

Para cada capitulo:
  - Verifica se ja tem perguntas ativas → skip
  - Chama Creator Agent (3 perguntas)
  - Salva com job_id
  - Atualiza progress
  - Se falhar: registra, continua proximos
```

### Batch Review UI Layout

```
┌────────────────────────────────────────────────────────┐
│  Perguntas Socraticas — [Nome do Curso]                │
│                                                        │
│  ┌─ Stats ──────────────────────────────────────────┐  │
│  │ 12 geradas  │ 8 pendentes │ 4 aprovadas │ 0 rej  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  [Gerar para todos]  [Aprovar todas pendentes]         │
│                                                        │
│  ▼ Cap 1: Introducao (3 perguntas)           [Gerar]  │
│    ☐ [analise]  Pergunta 1...         [✓] [✎] [✗]     │
│    ☐ [sintese]  Pergunta 2...         [✓] [✎] [✗]     │
│    ☐ [aplicacao] Pergunta 3...        [✓] [✎] [✗]     │
│                                                        │
│  ▼ Cap 2: Fundamentos (3 perguntas)          [Gerar]  │
│    ☐ [reflexao] Pergunta 4...         [✓] [✎] [✗]     │
│    ☐ [analise]  Pergunta 5...         [✓] [✎] [✗]     │
│    ☐ [aplicacao] Pergunta 6...        [✓] [✎] [✗]     │
│                                                        │
│  ▶ Cap 3: Aplicacoes (sem perguntas)         [Gerar]  │
│                                                        │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  3 selecionadas  [Aprovar selecionadas] [Rejeitar]     │  ← sticky bar
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
└────────────────────────────────────────────────────────┘
```

### Success Criteria

- [ ] Manager gera perguntas para curso de 10 capitulos em < 3 minutos
- [ ] Tela de revisao mostra todas perguntas agrupadas por capitulo
- [ ] Batch approve funcional (aprovar todas pendentes em 1 click)
- [ ] Auto-trigger funciona apos ingestion (Epic 13) e apos publicacao
- [ ] Progress em tempo real via SSE
- [ ] Capitulos com perguntas ativas sao pulados na geracao

---

## Stories

---

### Story 14.1: Schema, Migration e RLS para Question Generation Jobs

**As a** developer,
**I want** a `question_generation_jobs` table and a `job_id` column on `questions`,
**so that** batch generation can be tracked and linked to individual questions.

**PRD Reference:** FR4
**Architecture Reference:** architecture.md v1.4, Section 3.2

**Story Points:** 3
**Priority:** P0 (foundation)
**Risk:** LOW — follows existing patterns, additive change only

#### Acceptance Criteria

- [ ] **AC1:** Tabela `question_generation_jobs` criada
  - id, tenant_id, course_id, triggered_by
  - scope ('course' | 'chapter'), chapter_ids (UUID[])
  - status ('pending' | 'processing' | 'review' | 'completed' | 'failed')
  - progress (JSONB: { total, completed, failed, current_chapter? })
  - questions_generated, questions_approved, questions_rejected (integers)
  - error_message, created_at, updated_at
- [ ] **AC2:** Coluna `job_id` adicionada na tabela `questions`
  - FK para question_generation_jobs(id), nullable, ON DELETE SET NULL
  - Nao quebra fluxo existente (questions sem job_id continuam funcionando)
- [ ] **AC3:** RLS policies para question_generation_jobs
  - SELECT/INSERT/UPDATE: managers/admins do mesmo tenant
  - DELETE: admins only
- [ ] **AC4:** Drizzle schema em `packages/database/src/schema/question-generation-jobs.ts`
- [ ] **AC5:** Atualizacao do schema `questions.ts` com campo job_id
- [ ] **AC6:** Migration SQL funcional

#### Technical Notes

```typescript
// packages/database/src/schema/question-generation-jobs.ts
export const questionGenerationJobs = pgTable("question_generation_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  courseId: uuid("course_id").notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  triggeredBy: uuid("triggered_by").notNull()
    .references(() => users.id),
  scope: text("scope", { enum: ["course", "chapter"] }).notNull().default("course"),
  chapterIds: text("chapter_ids").array(),
  status: text("status", {
    enum: ["pending", "processing", "review", "completed", "failed"]
  }).notNull().default("pending"),
  progress: jsonb("progress").default({}),
  questionsGenerated: integer("questions_generated").default(0),
  questionsApproved: integer("questions_approved").default(0),
  questionsRejected: integer("questions_rejected").default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})
```

```sql
-- Migration
CREATE TABLE question_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  triggered_by UUID NOT NULL REFERENCES auth.users(id),
  scope TEXT NOT NULL DEFAULT 'course'
    CHECK (scope IN ('course', 'chapter')),
  chapter_ids UUID[],
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','review','completed','failed')),
  progress JSONB DEFAULT '{}',
  questions_generated INTEGER DEFAULT 0,
  questions_approved INTEGER DEFAULT 0,
  questions_rejected INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE questions ADD COLUMN job_id UUID REFERENCES question_generation_jobs(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE question_generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qg_jobs_select" ON question_generation_jobs FOR SELECT
  USING (tenant_id = auth_tenant_id() AND auth_user_role() IN ('manager','admin'));

CREATE POLICY "qg_jobs_insert" ON question_generation_jobs FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_user_role() IN ('manager','admin'));

CREATE POLICY "qg_jobs_update" ON question_generation_jobs FOR UPDATE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() IN ('manager','admin'));

CREATE POLICY "qg_jobs_delete" ON question_generation_jobs FOR DELETE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'admin');
```

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dev)** | Schema Drizzle, migration, RLS |
| **@qa (QA)** | Validar migration, testar RLS isolation |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Migration aplica, questions existentes nao afetadas | Yes |

---

### Story 14.2: Batch Generation API (Course-Level Trigger)

**As a** manager,
**I want** to generate questions for all chapters of a course in a single action,
**so that** I don't need to manually trigger generation for each chapter.

**PRD Reference:** FR4
**Architecture Reference:** architecture.md v1.4, Section 5.3

**Story Points:** 5
**Priority:** P0 (core pipeline)
**Risk:** MEDIUM — processamento sequencial de multiplos capitulos

#### Acceptance Criteria

- [ ] **AC1:** API Route `POST /api/courses/[courseId]/generate-questions` implementada
  - Auth guard: managers/admins
  - Busca todos chapters publicados do curso
  - Filtra chapters que ja tem perguntas ativas (skip)
  - Cria job com status='pending'
  - Processa sequencialmente cada capitulo
  - Retorna jobId imediatamente (processamento continua async)
- [ ] **AC2:** Processamento por capitulo
  - Para cada chapter: chama `generateQuestions()` existente
  - Salva perguntas com status='pending' e job_id
  - Atualiza progress no job: `{ total: N, completed: M, failed: F, current_chapter: "titulo" }`
  - Se falhar em 1 capitulo: registra erro, continua proximos
- [ ] **AC3:** Finalizacao do job
  - Se todos processaram: status='review'
  - Se algum falhou: status='review' com warnings
  - Se todos falharam: status='failed'
  - Atualiza contadores: questions_generated
- [ ] **AC4:** Rate limiting: 1 job por curso a cada 5 minutos
- [ ] **AC5:** Nao duplica perguntas para chapters que ja tem ativas
- [ ] **AC6:** API Route `GET /api/courses/[courseId]/generation-jobs`
  - Lista jobs do curso com status e progresso
  - Ordenado por created_at DESC

#### Technical Notes

```typescript
// apps/web/src/app/api/courses/[courseId]/generate-questions/route.ts
export async function POST(request: Request, context: RouteContext) {
  const { courseId } = await context.params
  // ... auth guard ...

  // Fetch all published chapters
  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, title, content, learning_objective, status, tenant_id")
    .eq("course_id", courseId)
    .eq("status", "published")
    .order("order", { ascending: true })

  // Filter chapters that already have active questions
  const { data: existingQuestions } = await supabase
    .from("questions")
    .select("chapter_id")
    .eq("status", "active")
    .in("chapter_id", chapters.map(c => c.id))

  const chaptersWithActiveQ = new Set(existingQuestions?.map(q => q.chapter_id))
  const chaptersToProcess = chapters.filter(c => !chaptersWithActiveQ.has(c.id))

  if (chaptersToProcess.length === 0) {
    return NextResponse.json({
      message: "Todos os capitulos ja possuem perguntas ativas"
    }, { status: 200 })
  }

  // Create job
  const { data: job } = await supabase
    .from("question_generation_jobs")
    .insert({
      course_id: courseId,
      tenant_id: chapters[0].tenant_id,
      triggered_by: user.id,
      scope: "course",
      status: "processing",
      progress: { total: chaptersToProcess.length, completed: 0, failed: 0 },
    })
    .select()
    .single()

  // Process sequentially (non-blocking via waitUntil or inline)
  processChaptersSequentially(chaptersToProcess, job.id, supabase)

  return NextResponse.json({ jobId: job.id, chaptersToProcess: chaptersToProcess.length })
}
```

```
apps/web/src/app/api/
├── courses/[courseId]/
│   ├── generate-questions/route.ts     # NEW: batch generation
│   └── generation-jobs/route.ts        # NEW: list jobs
└── generation-jobs/[jobId]/
    └── status/route.ts                  # NEW: SSE progress
```

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dev)** | Implementar batch API, processamento sequencial |
| **@qa (QA)** | Testar com cursos de 1, 5, 10 capitulos |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | Lint, typecheck | Yes |
| Pre-PR | Gera perguntas para curso com 5+ capitulos sem erro | Yes |

---

### Story 14.3: Auto-Trigger (Post-Ingestion e Post-Publish)

**As a** manager,
**I want** questions to be automatically generated after content ingestion or chapter publishing,
**so that** I don't need to manually trigger generation.

**PRD Reference:** FR4
**Architecture Reference:** architecture.md v1.4, Section 5.3

**Story Points:** 3
**Priority:** P1 (automacao)
**Risk:** LOW — reutiliza API da Story 14.2

#### Acceptance Criteria

- [ ] **AC1:** Auto-trigger apos ingestion aprovada (Epic 13)
  - Quando `POST /api/ingestion/[id]/approve` cria o curso
  - Publica automaticamente os chapters criados
  - Chama `POST /api/courses/[courseId]/generate-questions`
  - Manager ve indicador na UI: "Gerando perguntas..."
- [ ] **AC2:** Auto-trigger apos publicacao de capitulo
  - Quando manager publica capitulo via `toggleChapterStatus()`
  - Se capitulo nao tem perguntas ativas
  - Chama geracao para aquele capitulo especifico
  - Nao bloqueia a acao de publicacao (fire-and-forget)
- [ ] **AC3:** Indicador visual no curso
  - Badge "Gerando perguntas..." no header do curso quando job em andamento
  - Badge "N perguntas pendentes de revisao" quando job completo
  - Link para tela de revisao
- [ ] **AC4:** Opt-out disponivel
  - Setting no course.settings: `{ auto_generate_questions: boolean }` (default: true)
  - Toggle na pagina de settings do curso
- [ ] **AC5:** Nao gera duplicatas (skip chapters com perguntas ativas)

#### Technical Notes

```typescript
// Dentro de toggleChapterStatus() em chapters/actions.ts
// Adicionar apos a publicacao:
if (newStatus === "published") {
  // Fire-and-forget: trigger question generation
  fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/chapters/${chapterId}/generate-questions`, {
    method: "POST",
    headers: { /* forward auth headers */ },
  }).catch(() => {/* log but don't block */})
}

// Dentro de POST /api/ingestion/[id]/approve (Story 13.6)
// Apos criar chapters:
await fetch(`${baseUrl}/api/courses/${course.id}/generate-questions`, {
  method: "POST",
  headers: { /* forward auth */ },
})
```

```
apps/web/src/app/(platform)/courses/[courseId]/
├── _components/
│   └── question-generation-badge.tsx   # NEW: status badge
apps/web/src/app/(platform)/courses/[courseId]/chapters/
└── actions.ts                          # UPDATED: auto-trigger on publish
```

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dev)** | Implementar triggers e badge |
| **@qa (QA)** | Testar auto-trigger em ambos cenarios |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | Lint, typecheck | Yes |
| Pre-PR | Auto-trigger funciona apos publicacao de capitulo | Yes |

---

### Story 14.4: Course Questions Overview UI (Batch Review)

**As a** manager,
**I want** a single page to review all questions for the entire course,
**so that** I can efficiently approve or reject questions in batch instead of chapter by chapter.

**PRD Reference:** FR5
**Architecture Reference:** architecture.md v1.4, Section 6.2

**Story Points:** 8
**Priority:** P0 (user-facing interface principal)
**Risk:** LOW — reutiliza QuestionReviewCard existente

#### Acceptance Criteria

- [ ] **AC1:** Nova pagina `/courses/[courseId]/questions` implementada
  - Server page que busca todas perguntas do curso
  - Agrupa por capitulo
  - Passa dados para client component
- [ ] **AC2:** Dashboard de stats no topo
  - Total de perguntas geradas
  - Contagem por status: pendentes, aprovadas, rejeitadas
  - Visual: 4 cards com numeros e icones (Badge component)
- [ ] **AC3:** Lista de perguntas agrupada por capitulo
  - Cada capitulo como Accordion colapsavel
  - Header do grupo: titulo do capitulo + contagem de perguntas + status summary
  - Botao "Gerar" individual por capitulo (para chapters sem perguntas)
  - Dentro: reutiliza QuestionReviewCard existente
- [ ] **AC4:** Selecao multipla com checkboxes
  - Checkbox em cada pergunta
  - "Selecionar todas" por capitulo
  - "Selecionar todas pendentes" global
- [ ] **AC5:** Sticky action bar no bottom
  - Aparece quando >= 1 pergunta selecionada
  - Mostra contagem: "N selecionadas"
  - Botoes: "Aprovar selecionadas", "Rejeitar selecionadas"
- [ ] **AC6:** Botao "Aprovar todas pendentes" no header
  - Aprova todas perguntas com status='pending' de uma vez
  - Confirmacao via Modal antes de executar
- [ ] **AC7:** Botao "Gerar para todos" no header
  - Triggers batch generation (chama API da Story 14.2)
  - Desabilitado se job ja em andamento
- [ ] **AC8:** Todos os componentes usam `@eximia/ui`
- [ ] **AC9:** Link de acesso na pagina do curso (sidebar ou header)

#### Technical Notes

```
apps/web/src/app/(platform)/courses/[courseId]/questions/
├── page.tsx                            # NEW: server page
└── _components/
    ├── course-questions-overview.tsx    # NEW: main client component
    ├── chapter-questions-group.tsx      # NEW: accordion group per chapter
    ├── batch-action-bar.tsx             # NEW: sticky bottom bar
    ├── questions-stats-bar.tsx          # NEW: stats dashboard
    └── question-filter-bar.tsx          # NEW: filter by status/skill
```

```typescript
// page.tsx (server)
export default async function CourseQuestionsPage({ params }) {
  const { courseId } = await params
  const supabase = await createClient()

  // Fetch course
  const { data: course } = await supabase
    .from("courses").select("*").eq("id", courseId).single()

  // Fetch all chapters with questions
  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, title, order, status")
    .eq("course_id", courseId)
    .order("order")

  // Fetch all questions for course
  const { data: questions } = await supabase
    .from("questions")
    .select("*")
    .in("chapter_id", chapters.map(c => c.id))
    .order("created_at")

  // Fetch active job
  const { data: activeJob } = await supabase
    .from("question_generation_jobs")
    .select("*")
    .eq("course_id", courseId)
    .in("status", ["pending", "processing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  return <CourseQuestionsOverview
    course={course}
    chapters={chapters}
    questions={questions}
    activeJob={activeJob}
  />
}
```

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dev)** | Implementar todos os componentes UI |
| **@ux-design-expert (Uma)** | Revisar UX da tela de batch review |
| **@qa (QA)** | Testar batch approve, selecao multipla, responsividade |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | Lint, typecheck, sem hardcoded colors | Yes |
| Pre-PR | Tela completa funcional com dados reais | Yes |

---

### Story 14.5: Batch Actions (Approve/Reject Selected)

**As a** manager,
**I want** to approve or reject multiple questions at once,
**so that** the review process is fast and efficient for courses with many questions.

**PRD Reference:** FR5
**Architecture Reference:** architecture.md v1.4, Section 4.1

**Story Points:** 5
**Priority:** P0 (core functionality da tela de review)
**Risk:** LOW — usa patterns existentes de approve/reject

#### Acceptance Criteria

- [ ] **AC1:** Server Action `batchApproveQuestions(questionIds[], courseId)`
  - Valida auth (manager/admin)
  - Atualiza status de todas perguntas para 'active'
  - Atualiza counters no job (se vinculadas)
  - revalidatePath para refresh
- [ ] **AC2:** Server Action `batchRejectQuestions(questionIds[], courseId)`
  - Valida auth
  - Atualiza status para 'rejected' (ou 'archived')
  - Atualiza counters no job
- [ ] **AC3:** Server Action `approveAllPending(courseId)`
  - Busca todas perguntas pendentes do curso
  - Atualiza todas para 'active' em uma operacao
  - Modal de confirmacao na UI: "Aprovar N perguntas pendentes?"
- [ ] **AC4:** Atualizacao de stats do job
  - Quando todas perguntas aprovadas/rejeitadas, job.status='completed'
  - questions_approved e questions_rejected atualizados
- [ ] **AC5:** Feedback visual
  - Toast: "N perguntas aprovadas" / "N perguntas rejeitadas"
  - Cards atualizam visualmente sem reload (optimistic update)
- [ ] **AC6:** Sticky bar desaparece quando nenhuma pergunta selecionada

#### Technical Notes

```typescript
// apps/web/src/app/(platform)/courses/[courseId]/questions/actions.ts
"use server"

export async function batchApproveQuestions(
  questionIds: string[],
  courseId: string
) {
  const supabase = await createClient()
  // ... auth guard ...

  const { error } = await supabase
    .from("questions")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .in("id", questionIds)

  if (error) return { error: `Erro ao aprovar: ${error.message}` }

  // Update job counters
  await updateJobCounters(questionIds, courseId, supabase)

  revalidatePath(`/courses/${courseId}/questions`)
  return { success: true, count: questionIds.length }
}

export async function batchRejectQuestions(
  questionIds: string[],
  courseId: string
) {
  // Similar pattern...
}

export async function approveAllPending(courseId: string) {
  const supabase = await createClient()
  // ... auth guard ...

  const { data: pending } = await supabase
    .from("questions")
    .select("id, chapter_id")
    .eq("status", "pending")
    .in("chapter_id",
      (await supabase.from("chapters").select("id").eq("course_id", courseId)).data?.map(c => c.id) ?? []
    )

  if (!pending?.length) return { error: "Nenhuma pergunta pendente" }

  const ids = pending.map(q => q.id)
  return batchApproveQuestions(ids, courseId)
}
```

```
apps/web/src/app/(platform)/courses/[courseId]/questions/
└── actions.ts                          # NEW: batch server actions
```

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dev)** | Implementar server actions e integracao UI |
| **@qa (QA)** | Testar batch com 10+ perguntas, edge cases |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | Lint, typecheck | Yes |
| Pre-PR | Batch approve 10+ perguntas funcional, counters corretos | Yes |

---

### Story 14.6: SSE Progress e Notificacoes

**As a** manager,
**I want** to see real-time progress of question generation and receive notifications,
**so that** I know when questions are ready for review.

**PRD Reference:** FR4, FR5
**Architecture Reference:** architecture.md v1.4, Section 6.2

**Story Points:** 5
**Priority:** P1 (polish e UX)
**Risk:** LOW — SSE pattern straightforward

#### Acceptance Criteria

- [ ] **AC1:** API Route `GET /api/generation-jobs/[jobId]/status` (SSE)
  - Server-Sent Events stream
  - Emite evento a cada capitulo processado
  - Payload: `{ status, progress: { total, completed, failed, current_chapter }, questionsGenerated }`
  - Stream fecha quando job finaliza
- [ ] **AC2:** Componente `GenerationProgress` na tela de questions
  - Exibido quando job em andamento
  - Progress bar com porcentagem
  - Texto: "Gerando perguntas: Cap 3 de 8..."
  - Auto-refresh da lista quando job termina
- [ ] **AC3:** Badge no curso indicando perguntas pendentes
  - Na pagina do curso (course detail page)
  - Badge amarelo: "N perguntas pendentes de revisao"
  - Link direto para `/courses/[courseId]/questions`
- [ ] **AC4:** Toast notification quando geracao completa
  - "Perguntas geradas! N perguntas prontas para revisao."
  - CTA: "Ver perguntas" (link para tela de review)
- [ ] **AC5:** Progress component mostra erros parciais
  - Se 2 de 8 capitulos falharam: "6 capitulos processados, 2 falharam"
  - Botao "Tentar novamente" para os capitulos que falharam

#### Technical Notes

```typescript
// apps/web/src/app/api/generation-jobs/[jobId]/status/route.ts
export async function GET(request: Request, context: RouteContext) {
  const { jobId } = await context.params
  // ... auth guard ...

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let lastStatus = ""

      const interval = setInterval(async () => {
        const { data: job } = await supabase
          .from("question_generation_jobs")
          .select("status, progress, questions_generated, error_message")
          .eq("id", jobId)
          .single()

        if (!job) {
          controller.close()
          clearInterval(interval)
          return
        }

        const event = `data: ${JSON.stringify(job)}\n\n`
        controller.enqueue(encoder.encode(event))

        if (["review", "completed", "failed"].includes(job.status)) {
          controller.close()
          clearInterval(interval)
        }
      }, 2000) // Poll every 2 seconds
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
```

```
apps/web/src/app/api/generation-jobs/[jobId]/
└── status/route.ts                     # NEW: SSE stream

apps/web/src/app/(platform)/courses/[courseId]/questions/_components/
└── generation-progress.tsx             # NEW: progress component

apps/web/src/app/(platform)/courses/[courseId]/
└── _components/
    └── question-generation-badge.tsx    # NEW (ou UPDATED se criado em 14.3)
```

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dev)** | Implementar SSE, progress component, badge |
| **@qa (QA)** | Testar SSE em tempo real, edge cases de falha |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | Lint, typecheck | Yes |
| Pre-PR | SSE funcional, progress atualiza em tempo real | Yes |

---

## Dependency Graph

```
Story 14.1 (Schema)
    ├──▶ Story 14.2 (Batch Generation API)
    │         │
    │         ├──▶ Story 14.3 (Auto-Trigger)
    │         │
    │         └──▶ Story 14.4 (Overview UI)
    │                   │
    │                   ├──▶ Story 14.5 (Batch Actions)
    │                   │
    │                   └──▶ Story 14.6 (SSE + Notifications)
    │
    └──▶ (Epic 13 dependency: auto-trigger post-ingestion)
```

**Execution Order:**
1. **Story 14.1** first (schema foundation)
2. **Story 14.2** (batch API — core logic)
3. **Stories 14.3 + 14.4** in parallel (auto-trigger + UI independent)
4. **Story 14.5** after 14.4 (needs UI to attach actions)
5. **Story 14.6** after 14.4 (needs UI for progress display)

---

## Compatibility Requirements

- [ ] Fluxo existente de geracao por capitulo permanece funcional
- [ ] Tela existente de revisao por capitulo (`/chapters/[id]/questions`) continua funcionando
- [ ] Questions existentes (sem job_id) nao sao afetadas
- [ ] GenerateQuestionsButton existente continua operacional
- [ ] Performance de queries existentes nao degradada

---

## Risk Mitigation

| Risco | Impacto | Mitigacao | Rollback |
|-------|---------|-----------|----------|
| Creator Agent falha em batch | Medium | Skip falhos, continua proximos, retry individual | Manager usa geracao individual |
| Timeout em cursos com muitos caps | Medium | maxDuration: 300, processamento sequencial | Limitar a 15 capitulos por batch |
| Muitas perguntas pendentes | Low | Batch approve, filtros | Review individual existente |
| SSE connection drop | Low | Auto-reconnect no client, polling fallback | Refresh manual |
| Conflito com geracao individual | Low | Lock por capitulo (job em andamento) | Skip com mensagem |

---

## API Contracts

### POST /api/courses/[courseId]/generate-questions

```typescript
// Response: 202
interface BatchGenerateResponse {
  jobId: string
  chaptersToProcess: number
  message: string
}
```

### GET /api/courses/[courseId]/generation-jobs

```typescript
// Response: 200
interface JobsListResponse {
  jobs: Array<{
    id: string
    status: string
    progress: { total: number; completed: number; failed: number }
    questionsGenerated: number
    createdAt: string
  }>
}
```

### GET /api/generation-jobs/[jobId]/status (SSE)

```typescript
// Event stream
interface JobStatusEvent {
  status: "processing" | "review" | "completed" | "failed"
  progress: {
    total: number
    completed: number
    failed: number
    current_chapter?: string
  }
  questionsGenerated: number
  errorMessage?: string
}
```

### POST (Server Actions) — Batch Operations

```typescript
// batchApproveQuestions
// Input: questionIds: string[], courseId: string
// Output: { success: true, count: number } | { error: string }

// approveAllPending
// Input: courseId: string
// Output: { success: true, count: number } | { error: string }
```

---

## Technical Notes

### No New Dependencies

Este epic reutiliza 100% da stack existente:
- Creator Agent (`@eximia/agents`)
- Vercel AI SDK (`generateObject`)
- Supabase (queries + RLS)
- Upstash (rate limiting)
- @eximia/ui (todos componentes)

### Performance Strategy

1. Processamento sequencial (nao paralelo) para evitar rate limits da API Claude
2. SSE polling a cada 2s (leve, sem WebSocket overhead)
3. Batch DB operations (update IN array) para approve/reject
4. Job tracking separado da tabela questions (nao polui queries existentes)

### File Locations

```
apps/web/src/
├── app/
│   ├── api/
│   │   ├── courses/[courseId]/
│   │   │   ├── generate-questions/route.ts   # NEW
│   │   │   └── generation-jobs/route.ts       # NEW
│   │   └── generation-jobs/[jobId]/
│   │       └── status/route.ts                # NEW
│   └── (platform)/courses/[courseId]/
│       ├── questions/
│       │   ├── page.tsx                        # NEW
│       │   ├── actions.ts                      # NEW
│       │   └── _components/
│       │       ├── course-questions-overview.tsx # NEW
│       │       ├── chapter-questions-group.tsx   # NEW
│       │       ├── batch-action-bar.tsx          # NEW
│       │       ├── questions-stats-bar.tsx       # NEW
│       │       ├── question-filter-bar.tsx       # NEW
│       │       └── generation-progress.tsx       # NEW
│       └── _components/
│           └── question-generation-badge.tsx     # NEW
├── app/(platform)/courses/[courseId]/chapters/
│   └── actions.ts                               # UPDATED (auto-trigger)
```

---

## Definition of Done

- [ ] Batch generation funcional para curso com 10+ capitulos
- [ ] Tela de revisao mostra todas perguntas agrupadas por capitulo
- [ ] Batch approve/reject funcional (selecao multipla + approve all)
- [ ] Auto-trigger apos publicacao de capitulo funcional
- [ ] Progress em tempo real via SSE
- [ ] Stats dashboard correto
- [ ] Fluxo existente (geracao individual) nao quebrado
- [ ] Multi-tenant isolation mantida
- [ ] `pnpm lint && pnpm typecheck` passam
- [ ] Questions existentes (sem job_id) continuam funcionando

---

## Total Story Points: 29

| Story | Points | Priority | Dependencies |
|-------|--------|----------|-------------|
| 14.1 Schema + Migration | 3 | P0 | Nenhuma |
| 14.2 Batch Generation API | 5 | P0 | 14.1 |
| 14.3 Auto-Trigger | 3 | P1 | 14.2, (Epic 13 opcional) |
| 14.4 Course Questions Overview UI | 8 | P0 | 14.2 |
| 14.5 Batch Actions | 5 | P0 | 14.4 |
| 14.6 SSE Progress + Notifications | 5 | P1 | 14.4 |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-10 | 1.0 | Epic criado com 6 stories completas | Morgan (PM) |

---

*Epic criado por Morgan (PM) com arquitetura de Aria (Architect) — eximIA Academy v1.0*

— Morgan, planejando o futuro 📊
