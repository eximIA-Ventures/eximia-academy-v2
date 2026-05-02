# Epic 23: WS2 — Integration: Auditor, Apply & WS1

**Version:** 1.1
**Created:** 2026-02-16
**Updated:** 2026-02-16
**Author:** Morgan (PM) com arquitetura de Aria (Architect)
**Status:** Draft
**PRD Reference:** `Benchmarks/07_Course_Designer/PRD-Course-Designer-v1.0.md`
**Architecture Reference:** `docs/architecture/ws2-course-creator-architecture.md` — Seções 7, 11
**Workstream:** WS2 (Course Creator — depende dos Epics 20-22)

---

## Epic Goal

Integrar o Course Creator com o sistema existente: Auditor para análise de cursos existentes (Caminho B), Apply Blueprint para criar curso + capítulos + questions (D12), contrato WS2 → WS1 com 3 campos opcionais (D13), e Course Selector UI para o Caminho B.

## Epic Context

| Item | Detalhe |
|------|---------|
| **Stack** | Next.js 15, Supabase, Drizzle ORM, AI SDK |
| **DB Tables** | `courses` (existente), `chapters` (existente), `questions` (existente), `course_blueprints` (existente — Epic 21) |
| **AI Agents** | Auditor (NOVO) |
| **Providers** | OpenAI via Model Router |
| **Design Tokens** | `apps/web/src/styles/theme.css` |
| **Roles Impactados** | manager (aplica blueprints, seleciona cursos) |
| **Package** | `@eximia/agents`, `apps/web` |

---

## Existing System Context

### Infrastructure Already in Place

| Component | Status | Reference |
|-----------|--------|-----------|
| `courses` table | Existente | `packages/database/src/schema/` |
| `chapters` table | Existente | `packages/database/src/schema/` |
| `questions` table | Existente | `packages/database/src/schema/` |
| Course creation flow | Existente | `apps/web/src/app/(platform)/courses/` |
| WS1 Pipeline Socrático | Existente (Epic 16) | `packages/agents/src/orchestrator.ts` |
| `courses.settings` JSONB | Existente | Contém interactionConfig, tenantPlan |

### Current Flow

```
Manager cria curso manualmente
    → Adiciona capítulos 1 a 1
    → Questions criadas via Creator Agent
    → WS1 usa interactionConfig padrão
    → Sem framework, sem Bloom mapping
```

### What This Epic Changes

```
CAMINHO A: Manager gera blueprint (Epic 20-22)
    → Clica "Aplicar ao Curso"
    → Sistema cria: course + chapters (com conteúdo IA) + questions (variável por tipo)
    → settings recebe: blueprint_id, primary_framework, interaction types
    → WS1 usa interaction_type e bloom_target do blueprint

CAMINHO B: Manager seleciona curso existente
    → Course Selector mostra cursos do tenant
    → Auditor analisa curso (7 passos)
    → Pré-preenche wizard com dados extraídos
    → Pipeline gera blueprint melhorado
    → Instrutor ajusta e aplica
```

---

## Enhancement Details

### Caminho B: Recriar Curso Existente

```
┌──────────────────────────────────────────────────┐
│                  CAMINHO B                        │
│                                                   │
│  1. Course Selector                               │
│     Lista cursos do tenant (título, chapters, ?)  │
│           │                                       │
│           ▼                                       │
│  2. AUDITOR (7 passos)                           │
│     ├─ Extração Estrutural                       │
│     ├─ Análise de Conteúdo                       │
│     ├─ Auditoria de Qualidade (Score 0-100)      │
│     ├─ Gap Identification                        │
│     ├─ Preservation Map (MANTER/REORGANIZAR/...) │
│     ├─ Plano de Melhoria                         │
│     └─ Feed para Pipeline (enriched_input)       │
│           │                                       │
│           ▼                                       │
│  3. Pré-preenche Wizard (Steps 1-4)              │
│     Instrutor ajusta e completa                   │
│           │                                       │
│           ▼                                       │
│  4. Pipeline gera blueprint                       │
│     (com contexto enriquecido do Auditor)         │
└──────────────────────────────────────────────────┘
```

### Apply Blueprint → Curso (D12)

```
Blueprint aprovado
    │
    ├─ Cria course (title, description, settings com blueprint_id + framework)
    │
    ├─ Para cada módulo do blueprint:
    │   ├─ Cria chapter (title, content com IA + placeholders, learningObjective, order)
    │   └─ Cria questions (variável por interaction_type):
    │       ├─ socratic_dialogue: 3-5 perguntas
    │       ├─ quiz: 5-8 perguntas
    │       ├─ scenario: 2-3 cenários
    │       └─ assignment: 1-2 assignments
    │       Todas com status=pending
    │
    └─ Atualiza blueprint status: "approved" → "applied"
```

### Contrato WS2 → WS1 (D13)

```
courses.settings:
  + blueprint_id: "uuid"
  + primary_framework: "elc_plus"

chapters (from blueprint modules):
  + interaction_type: "socratic_dialogue" | "quiz" | "scenario" | "assignment"
  + bloom_target: "applying" | "analyzing" | ...
  + framework_stage: "immerse" | "reflect" | ... (ADIADO v2 — D16)

WS1 Pipeline:
  → Lê interaction_type → ajusta max_interactions e comportamento
  → Lê bloom_target → ajusta expectedDepth do Mestre
  → Backward-compatible: campos opcionais, WS1 funciona sem eles
```

### Success Criteria

- [ ] Auditor analisa curso existente e pré-preenche wizard
- [ ] Apply Blueprint cria course + chapters + questions corretamente
- [ ] Questions variam por interaction_type conforme D12
- [ ] Todas as questions criadas com status=pending
- [ ] WS1 lê interaction_type e bloom_target quando disponíveis
- [ ] WS1 funciona normalmente sem campos WS2 (backward-compatible)
- [ ] Course Selector lista cursos do tenant com metadata

---

## Stories

---

### Story 23.1: Auditor — Análise de Curso Existente (Caminho B)

**As a** manager,
**I want** que o sistema analise um curso existente e pré-preencha o wizard com dados extraídos,
**so that** eu possa recriar/melhorar meu curso usando design instrucional.

**Architecture Reference:** ws2-course-creator-architecture.md, Seção 7.4

**Story Points:** 5
**Priority:** P1 (enhancement — Caminho A funciona sem isto)
**Risk:** MEDIUM — qualidade da análise depende do LLM + estrutura do curso existente

#### Acceptance Criteria

- [ ] **AC1:** `auditCourse(courseId)` em `packages/agents/src/course-designer/auditor.ts`
  - Input: `courseId` (UUID) + tenant context
  - Carrega: course + chapters + questions do DB
  - Output: `AuditResult` (Zod-validated)
- [ ] **AC2:** 7 passos do Auditor:
  - Passo 1 (Extração Estrutural): chapters, questions, content normalizado
  - Passo 2 (Análise de Conteúdo): temas, conceitos, Bloom atual
  - Passo 3 (Auditoria de Qualidade): Score 0-100 nas 5 dimensões
  - Passo 4 (Gap Identification): estado atual vs. best practices
  - Passo 5 (Preservation Map): classifica cada elemento: MANTER, REORGANIZAR, MELHORAR, DESCARTAR
  - Passo 6 (Plano de Melhoria): recomendações priorizadas
  - Passo 7 (Feed para Pipeline): `enriched_input` empacotado para as 6 camadas do Brief
- [ ] **AC3:** Schema `AuditResult`
  - `existing_course_structure`: chapters count, questions count, total content length
  - `content_analysis`: topics[], concepts[], bloom_levels_detected[]
  - `quality_audit`: score 0-100, dimensions (5)
  - `gap_report`: gaps[], recommendations[]
  - `preservation_map`: elements[] com status (MANTER/REORGANIZAR/MELHORAR/DESCARTAR)
  - `enriched_input`: partial CourseDesignerInput (pré-preenchimento)
- [ ] **AC4:** `enriched_input` mapeia para camadas do Brief:
  - Camada 1: course title → course_title, description → behavior_change hint
  - Camada 2: inferred from content complexity → experience_level
  - Camada 3: chapters → topics_outline, questions → assessment_preference
  - Camada 4: total chapters × estimated time → total_duration_hours
- [ ] **AC5:** `POST /api/course-designer/audit-course` em `apps/web/src/app/api/course-designer/audit-course/route.ts`
  - Input: `{ courseId: string }`
  - Requer role `manager` ou `admin`, RLS tenant isolation
  - Retorna: `AuditResult` (JSON)
  - Rate limiting: max 3 auditorias por hora por tenant
- [ ] **AC6:** Prompt em `packages/agents/src/course-designer/prompts/auditor.ts`
- [ ] **AC7:** `pnpm typecheck` passa

#### Technical Notes

O Auditor é uma chamada LLM única com todo o conteúdo do curso como contexto. Para cursos grandes (20+ chapters), considerar chunking.

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar Auditor |
| **@qa (QA)** | Testar com cursos existentes de diferentes tamanhos |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Auditor funciona para curso com 5+ chapters | Yes |

---

### Story 23.2: Blueprint Apply — Criar Curso + Capítulos + Questions (D12)

**As a** manager,
**I want** aplicar um blueprint aprovado para criar automaticamente o curso com capítulos e perguntas,
**so that** eu não precise criar manualmente cada capítulo e pergunta.

**Architecture Reference:** ws2-course-creator-architecture.md, Seções 11.2-11.3

**Story Points:** 8
**Priority:** P0 (core — é o output final do pipeline inteiro)
**Risk:** HIGH — cria entidades reais no DB, geração IA de conteúdo, integração crítica

#### Acceptance Criteria

- [ ] **AC1:** `POST /api/course-designer/blueprints/[id]/apply` em `apps/web/src/app/api/course-designer/blueprints/[blueprintId]/apply/route.ts`
  - Requer blueprint com status `draft` ou `approved`
  - Requer role `manager` ou `admin`
  - Retorna: `courseId` do curso criado
- [ ] **AC2:** `applyBlueprint(blueprintId)` em `packages/agents/src/course-designer/apply-blueprint.ts`
  - Cria `course` com:
    - title: blueprint metadata.title
    - settings: `{ blueprint_id, primary_framework, interactionConfig }`
    - tenant_id e created_by preenchidos explicitamente (NOT NULL, sem auto-trigger)
  - Para cada módulo do blueprint:
    - Cria `chapter` com: title, content (**gerado por IA**), learningObjective (objectives[0].text), order
    - Content gerado via `generateObject`: IA produz markdown estruturado usando como input o módulo (description, objectives, framework_stages, bloom_level). Inclui seções por framework stage, conceitos-chave e placeholders para atividades práticas
- [ ] **AC3:** Questions variáveis por interaction_type (D12):
  - `socratic_dialogue`: 3-5 perguntas abertas, profundas, socráticas
  - `quiz`: 5-8 perguntas (múltipla escolha, V/F, resposta curta)
  - `scenario`: 2-3 cenários com dilema + trade-offs
  - `assignment`: 1-2 assignments com entregável definido
  - Todas com `status = 'pending'` — manager revisa antes de ativar
- [ ] **AC4:** Questions geradas por IA (usando generateObject) baseadas em:
  - Conteúdo do módulo (objectives, description)
  - Bloom level target
  - Framework context (stage, purpose)
- [ ] **AC5:** Blueprint status atualizado para `applied` após sucesso
- [ ] **AC6:** Transação atômica: se falhar no meio, rollback tudo
- [ ] **AC7:** Courses.settings inclui `interactionConfig` conforme §11.1:
  - `configured_by: "blueprint"`
  - `type_defaults` com turns por interaction_type
  - `smart_closing` config

#### Technical Notes

IMPORTANTE: `courses.tenant_id` e `courses.created_by` são NOT NULL sem auto-trigger. Preencher explicitamente no insert.

```typescript
// Questions por interaction_type
const QUESTIONS_PER_TYPE = {
  socratic_dialogue: { min: 3, max: 5 },
  quiz: { min: 5, max: 8 },
  scenario: { min: 2, max: 3 },
  assignment: { min: 1, max: 2 },
}
```

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar Apply Blueprint |
| **@data-engineer (Dara)** | Validar transação e integridade |
| **@qa (QA)** | Testar criação de curso completo |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Curso criado com chapters e questions corretos | Yes |
| Pre-PR | Questions variam por interaction_type | Yes |
| Pre-PR | Rollback funciona se falhar no meio | Yes |
| Pre-PR | tenant_id e created_by preenchidos corretamente | Yes |

---

### Story 23.3: Integração WS1 — 3 Campos Opcionais (D13)

**As a** developer,
**I want** que o pipeline socrático WS1 leia interaction_type e bloom_target dos chapters quando disponíveis,
**so that** o Mestre ajuste comportamento e profundidade baseado no design instrucional do WS2.

**Architecture Reference:** ws2-course-creator-architecture.md, Seção 11

**Story Points:** 5
**Priority:** P1 (enhancement — WS1 funciona sem isto)
**Risk:** LOW — campos opcionais, backward-compatible

#### Acceptance Criteria

- [ ] **AC1:** Chapters table: ADD COLUMN (migration)
  - `interaction_type` TEXT nullable (CHECK: socratic_dialogue, quiz, scenario, assignment)
  - `bloom_target` TEXT nullable (CHECK: remembering, understanding, applying, analyzing, evaluating, creating)
  - Nota: `framework_stage` adiado para v2 (D16)
- [ ] **AC2:** Drizzle schema atualizado para chapters
- [ ] **AC3:** Orquestrador v2 (WS1) lê `interaction_type` do chapter quando disponível:
  - Se `interaction_type` definido: usa config de turns/comportamento do tipo
  - Se null: comportamento padrão atual (socratic_dialogue)
- [ ] **AC4:** Mestre (WS1) lê `bloom_target` do chapter quando disponível:
  - Se definido: ajusta `expectedDepth` conforme mapeamento Bloom → Depth (§11.4)
  - Se null: usa depth default
- [ ] **AC5:** Bloom → expectedDepth mapping:
  - Remember → "1"-"2", Understand → "2"-"3", Apply → "3"-"4"
  - Analyze → "4"-"5", Evaluate → "5"-"6", Create → "6"-"7"
- [ ] **AC6:** WS1 continua funcionando normalmente para chapters sem campos WS2
- [ ] **AC7:** Testes E2E existentes do WS1 continuam passando

#### Technical Notes

Mudança mínima no WS1. O Orquestrador v2 já recebe contexto do capítulo — basta ler os novos campos quando presentes.

```typescript
// No Orquestrador v2 — leitura condicional
const interactionType = chapter.interaction_type ?? 'socratic_dialogue'
const maxInteractions = TYPE_DEFAULTS[interactionType].turns

const bloomTarget = chapter.bloom_target
const expectedDepth = bloomTarget ? BLOOM_DEPTH_MAP[bloomTarget] : undefined
```

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Migration + integração no Orquestrador |
| **@qa (QA)** | Testar backward compatibility |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | WS1 funciona com chapters sem campos WS2 | Yes |
| Pre-PR | WS1 ajusta comportamento quando campos WS2 presentes | Yes |
| Pre-PR | Testes E2E existentes passam | Yes |

---

### Story 23.4: Course Selector + Caminho B UX

**As a** manager,
**I want** selecionar um curso existente no Step 3 do wizard para que o Auditor pré-preencha os campos,
**so that** eu possa recriar/melhorar cursos existentes com design instrucional.

**Architecture Reference:** ws2-course-creator-architecture.md, Seção 7.3

**Story Points:** 5
**Priority:** P1 (enhancement — wizard funciona sem Caminho B)
**Risk:** LOW — componente de seleção + integração com Auditor

#### Acceptance Criteria

- [ ] **AC1:** Course Selector no `scope-step.tsx` (Step 3 do wizard)
  - Toggle: "Novo curso" / "Recriar curso existente"
  - Se "Recriar": mostra lista de cursos do tenant
  - Cada curso mostra: título, N chapters, N questions, status, created_at
  - Busca por título (filter)
  - Paginação ou scroll infinito
- [ ] **AC2:** Ao selecionar curso:
  - Loading state: "Analisando curso..."
  - Chama Auditor API (23.1)
  - Preenche `source_course_id` no form
  - Resultado do Auditor pré-preenche Steps 1-4:
    - Topics → `topics_outline`
    - Estimated duration → `total_duration_hours`
    - Quality audit score exibido como referência
  - Instrutor pode aceitar, editar ou descartar cada sugestão
- [ ] **AC3:** Preservation Map visual (opcional, se Auditor retorna)
  - Lista de elementos com badge: MANTER (verde), REORGANIZAR (azul), MELHORAR (amarelo), DESCARTAR (vermelho)
  - Informativo — instrutor pode consultar mas não precisa agir
- [ ] **AC4:** API endpoint para listar cursos do tenant:
  - Reutilizar endpoint existente ou criar `GET /api/courses?forDesigner=true`
  - Retorna: id, title, chapters_count, questions_count, status, created_at
- [ ] **AC5:** Usa `@eximia/ui`: Select, Card, Badge, Skeleton (loading)
- [ ] **AC6:** Se Auditor falha, mostra erro mas permite continuar sem pré-preenchimento

#### Technical Notes

O Course Selector é um componente dentro do ScopeStep. O Auditor roda assíncronamente — mostrar loading adequado. Para cursos grandes, o Auditor pode levar 30-60s.

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar Course Selector + integração |
| **@ux-design-expert** | Validar UX do Caminho B |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Lista de cursos carrega corretamente | Yes |
| Pre-PR | Auditor pré-preenche wizard | Yes |

---

## Dependency Graph

```
Story 23.2 (Apply Blueprint — P0)    Story 23.1 (Auditor — P1)
         ↓                                  ↓
Story 23.3 (WS1 Integration — P1)    Story 23.4 (Course Selector + Caminho B UX — P1)
```

**Ordem de execução sugerida:** 23.2 (core, P0) → 23.3 (WS1) → 23.1 (Auditor) → 23.4 (UI)

**Nota:** 23.2 e 23.1 são **independentes** entre si. 23.2 é P0 (core). 23.1, 23.3 e 23.4 são P1 (enhancement/Caminho B). 23.1 pode iniciar em paralelo com 23.2.

**Dependência inter-epic:** Epic 20 (agentes), Epic 21 (API/DB), Epic 22 (wizard UI).

---

## Compatibility Requirements

- [ ] WS1 pipeline socrático funciona sem campos WS2 (backward-compatible)
- [ ] Fluxo de criação manual de cursos continua funcionando
- [ ] Creator Agent existente não é afetado
- [ ] Questions criadas pelo Apply são compatíveis com WS1
- [ ] Tabelas existentes preservam dados (ADD COLUMN nullable)

---

## Risk Mitigation

| Risco | Impacto | Mitigação | Rollback |
|---|---|---|---|
| Apply cria curso incompleto | Alto | Transação atômica com rollback | Deletar curso criado |
| Questions geradas com baixa qualidade | Médio | Status=pending, manager revisa | Manager edita/recria |
| Auditor impreciso para cursos antigos | Baixo | Instrutor revisa pré-preenchimento | Ignorar sugestões |
| WS1 integration quebra pipeline existente | Alto | Campos opcionais, testes E2E | Reverter migration |
| Curso com 50+ chapters sobrecarrega Auditor | Médio | Chunking, timeout | Limitar análise a 30 chapters |

---

## New File Locations

```
packages/agents/src/
├── course-designer/
│   ├── auditor.ts                     # NOVO — 7-step course analysis
│   ├── apply-blueprint.ts             # NOVO — Blueprint → course + chapters + questions
│   └── prompts/
│       └── auditor.ts                 # NOVO

apps/web/src/app/api/course-designer/
├── audit-course/route.ts              # NOVO — POST (Auditor endpoint)
├── blueprints/
│   └── [blueprintId]/
│       └── apply/route.ts             # NOVO (já previsto no Epic 21)

apps/web/src/app/(platform)/courses/new/design/
├── _components/
│   └── scope-step.tsx                 # ATUALIZAR — adicionar Course Selector

supabase/migrations/
└── YYYYMMDD_add_ws2_fields_to_chapters.sql  # NOVO

packages/database/src/schema/
└── chapters.ts                        # ATUALIZAR (add interaction_type, bloom_target)

packages/agents/src/
└── orchestrator.ts                    # ATUALIZAR — ler campos WS2 opcionais
```

---

## Definition of Done

- [ ] Auditor analisa cursos existentes (7 passos)
- [ ] Apply Blueprint cria curso + chapters + questions atomicamente
- [ ] Questions variam por interaction_type
- [ ] WS1 lê interaction_type e bloom_target quando disponíveis
- [ ] WS1 funciona sem campos WS2 (backward-compatible)
- [ ] Course Selector lista cursos e integra com Auditor
- [ ] `pnpm typecheck` e `pnpm build` passam
- [ ] Testes E2E do WS1 continuam passando

---

## Total Story Points

| Story | Título | SP | Dependência |
|-------|--------|---:|-------------|
| 23.1 | Auditor (Caminho B — 7 passos) | 5 | Epic 20, 21 |
| 23.2 | Apply Blueprint (Curso + Capítulos + Questions) | 8 | Epic 21 |
| 23.3 | Integração WS1 (3 Campos Opcionais) | 5 | 23.2 |
| 23.4 | Course Selector + Caminho B UX | 5 | 23.1, Epic 22 |
| **Total** | | **23** | |

---

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-02-16 | 1.0 | Criação do épico | Morgan (PM) |
| 2026-02-16 | 1.1 | Validação @po: fix dep graph (23.2 e 23.1 paralelos), add Auditor API route (23.1 AC5), SP 23.2 5→8 (total 20→23), clarify chapter content como AI-generated | Pax (PO) |
