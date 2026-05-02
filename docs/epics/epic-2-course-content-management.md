# Epic 2: Course & Content Management

**Version:** 1.1
**Created:** 2026-02-07
**Updated:** 2026-02-08
**Author:** Morgan (PM Agent)
**Status:** Ready for Development (QA Gate: PASS)
**PRD Reference:** `docs/prd.md` — Epic 2
**Architecture Reference:** `docs/architecture.md` v1.2.2
**Screens Reference:** `docs/screens.md` — Telas 5, 6, 8, 9

---

## Epic Goal

Professores podem criar cursos completos com capitulos e conteudo, gerar perguntas socraticas via Creator Agent, revisar e publicar. Alunos podem visualizar cursos disponiveis e se inscrever. Ao final deste epic, o sistema tem conteudo educacional pronto para ser consumido pelo Socratic Learning Engine (Epic 3).

## Epic Context

| Item | Detalhe |
|------|---------|
| **Stack** | Next.js 15 (App Router) + Supabase + Vercel + Drizzle ORM + Tailwind CSS 4 + shadcn/ui |
| **DB Tables** | `courses`, `chapters`, `questions`, `enrollments` — ja criadas no Epic 1 (Story 1.2) |
| **Auth** | Supabase Auth invite-only, middleware protege `/(platform)/*` (Story 1.3) |
| **Layout** | Sidebar 200px + header + content area com tenant branding (Story 1.4) |
| **Agent** | Creator Agent — primeiro uso de LLM na plataforma (Anthropic Claude) |
| **Screens** | 4 telas: Course Browse/Manage (#5), Course Overview/Editor (#6), Chapter Editor (#8), Question Review (#9) |
| **Design Tokens** | `Benchmarks/Design/design-tokens.json` v1.2.1 |

## Dependency Graph

```
Story 2.1 (CRUD Cursos) ──────────────────────────┐
         │                                          │
         ▼                                          │
Story 2.2 (CRUD Capitulos)                         │
         │                                          │
         ▼                                          │
Story 2.3 (Geracao Perguntas via Creator Agent)    │
         │                                          │
         ▼                                          │
Story 2.4 (Revisao e Ativacao de Perguntas)        │
         │                                          │
         ▼                                          ▼
Story 2.5 (Publicacao de Curso e Inscricao de Alunos)
```

**Pre-requisite:** Epic 1 completo (Stories 1.1–1.5)

---

## Story Files (Detailed)

| Story | File | SP | Priority | Blocked By |
|-------|------|----|----------|------------|
| 2.1 CRUD de Cursos | [`story-2.1-crud-cursos.md`](../stories/story-2.1-crud-cursos.md) | 5 | P0 | Epic 1 |
| 2.2 CRUD de Capitulos | [`story-2.2-crud-capitulos.md`](../stories/story-2.2-crud-capitulos.md) | 8 | P0 | 2.1 |
| 2.3 Geracao de Perguntas | [`story-2.3-geracao-perguntas.md`](../stories/story-2.3-geracao-perguntas.md) | 13 | P0 | 2.2 |
| 2.4 Revisao de Perguntas | [`story-2.4-revisao-perguntas.md`](../stories/story-2.4-revisao-perguntas.md) | 5 | P0 | 2.3 |
| 2.5 Publicacao e Inscricao | [`story-2.5-publicacao-inscricao.md`](../stories/story-2.5-publicacao-inscricao.md) | 5 | P1 | 2.1, 2.4 |

**Total:** 36 story points

> Each story file contains: user story, acceptance criteria, detailed tasks with subtasks, technical implementation guide with code snippets and DB schemas, file locations, agent assignments, quality gates, risk assessment, and Definition of Done.

---

## Stories (Summary)

---

### Story 2.1: CRUD de Cursos

**As a** teacher,
**I want** criar e gerenciar cursos,
**so that** eu possa organizar meu conteudo educacional.

**Story Points:** 5
**Priority:** P0 (Blocker)
**Blocked By:** Epic 1 (all stories)
**Blocks:** 2.2, 2.5

#### Acceptance Criteria

- [ ] **AC1:** Pagina de listagem de cursos do professor (`/courses`) com status badge (draft/published/archived)
- [ ] **AC2:** Formulario de criacao: titulo, descricao, modo (universidade/corporativo/ambos)
- [ ] **AC3:** Edicao de curso existente (titulo, descricao, modo)
- [ ] **AC4:** Exclusao de curso em draft: teacher pode excluir via Server Action (verifica `status = 'draft'` antes do DELETE); admin pode excluir qualquer curso. Dialog de confirmacao obrigatorio
- [ ] **AC5:** Arquivamento de curso publicado (soft delete — status → archived)
- [ ] **AC6:** Validacao: titulo obrigatorio, minimo 10 caracteres (Zod schema)
- [ ] **AC7:** Server Actions para mutations (create, update, delete, archive)
- [ ] **AC8:** Toast notifications para feedback de acoes (sucesso, erro)
- [ ] **AC9:** Variante Student da pagina `/courses`: grid de cursos disponiveis com busca (placeholder — inscricao implementada em 2.5)
- [ ] **AC10:** Variante Teacher vs Student renderizada condicionalmente por role

#### Technical Notes

- **Telas:** Screen 5 (Course Browse/Manage) + Screen 6 (Course Overview/Editor — teacher variant)
- **Server Actions:** `createCourse()`, `updateCourse()`, `deleteCourse()`, `archiveCourse()` em `apps/web/src/app/(platform)/courses/actions.ts`
- **RLS:** `courses_insert` requer `teacher` ou `admin` role; `courses_select` retorna cursos do tenant; `courses_delete` requer `admin` role no RLS
- **Nota sobre delete (M-1 resolution):** Teacher pode excluir cursos em `draft` via Server Action que verifica `status = 'draft'` e usa service role para o DELETE (RLS `courses_delete` e admin-only). Admin pode excluir qualquer curso via RLS direto. Alternativa: adicionar RLS `courses_delete_draft` para teacher — decidir na implementacao com @architect
- **Validacao:** `packages/shared/src/validators/courses.ts` com `createCourseSchema`, `updateCourseSchema`
- **Status badges:** draft (amarelo), published (verde), archived (cinza) — usar shadcn Badge component
- **Layout Teacher:** Tabela com row actions (dropdown: Editar, Publicar, Arquivar, Excluir)
- **Layout Student:** Grid de cards com thumbnail placeholder, titulo, descricao truncada, modo badge
- **Paginacao (M-7 decision):** MVP sem paginacao — esperamos < 50 cursos por tenant na fase inicial. Se necessario, implementar "load more" (cursor-based) como enhancement pos-MVP. Chapters idem (< 30 por curso)

#### Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Implementacao completa (pages, server actions, components) |
| **@qa (Quinn)** | Validacao: role-based rendering, RLS enforcement, CRUD operations |

#### Quality Gates

| Gate | Validacao |
|------|----------|
| Pre-Commit | `pnpm lint && pnpm typecheck` passam, Zod schemas criados |
| Pre-PR | Teacher CRUD completo, student browse funcional, RLS testado |

#### Tasks

- [ ] Criar Zod schemas em `packages/shared/src/validators/courses.ts`
- [ ] Criar Server Actions em `apps/web/src/app/(platform)/courses/actions.ts`
- [ ] Criar pagina `/courses/page.tsx` com variante por role (teacher: tabela, student: grid)
- [ ] Criar componente `CourseCard` para student grid view
- [ ] Criar componente `CourseTable` para teacher list view com row actions
- [ ] Criar dialog de criacao de curso (modal ou sheet)
- [ ] Criar dialog de edicao de curso
- [ ] Criar dialog de confirmacao de exclusao
- [ ] Implementar archiving (status → archived)
- [ ] Criar pagina `/courses/[courseId]/page.tsx` — variante teacher (editor header)
- [ ] Adicionar toast notifications (shadcn Sonner)
- [ ] Testes: criar, editar, deletar, arquivar, listar por role

#### Definition of Done

- [ ] Todos os ACs passam
- [ ] Teacher pode criar, editar, arquivar e deletar (draft) cursos
- [ ] Student ve grid de cursos disponiveis
- [ ] RLS impede teacher de ver cursos de outro tenant
- [ ] PR aprovada

---

### Story 2.2: CRUD de Capitulos

**As a** teacher,
**I want** criar capitulos dentro de um curso,
**so that** eu possa estruturar o conteudo de aprendizagem.

**Story Points:** 8
**Priority:** P0 (Blocker)
**Blocked By:** 2.1
**Blocks:** 2.3

#### Acceptance Criteria

- [ ] **AC1:** Pagina de capitulos dentro de um curso (`/courses/[courseId]` — teacher variant) listando capitulos com drag-and-drop reorder
- [ ] **AC2:** Formulario de criacao: titulo, conteudo (rich text editor), objetivo de aprendizagem
- [ ] **AC3:** Reordenacao de capitulos via drag-and-drop (atualiza campo `order`)
- [ ] **AC4:** Edicao de capitulo via pagina dedicada (`/courses/[courseId]/chapters/[chapterId]/edit`)
- [ ] **AC5:** Exclusao de capitulos (com confirmacao)
- [ ] **AC6:** Status por capitulo (draft/published) — toggle independente do curso
- [ ] **AC7:** Validacao: titulo obrigatorio, conteudo minimo 100 caracteres (Zod)
- [ ] **AC8:** Preview do conteudo renderizado (markdown → HTML)
- [ ] **AC9:** Botao "Adicionar Capitulo" na pagina do curso
- [ ] **AC10:** Word/char counter no editor indicando minimo de 100 caracteres

#### Technical Notes

- **Telas:** Screen 6 (Course Overview/Editor — chapter list) + Screen 8 (Chapter Editor)
- **Rich Text Editor:** TipTap (headless, extensible) ou similar — suporte a markdown, imagens, codigo. Alternativa MVP: textarea com markdown preview.
- **Drag-and-drop:** `@dnd-kit/core` (lightweight) para reorder — atualiza `order` column via Server Action batch update
- **Server Actions:** `createChapter()`, `updateChapter()`, `deleteChapter()`, `reorderChapters()`, `publishChapter()` em `apps/web/src/app/(platform)/courses/[courseId]/chapters/actions.ts`
- **API routes (architecture.md):** `POST /api/courses/[courseId]/chapters` (create), `PATCH /api/chapters/[chapterId]` (update), `DELETE /api/chapters/[chapterId]`
- **RLS:** `chapters_insert` requer `teacher` ou `admin`; `tenant_id` auto-populated via trigger `set_chapter_tenant_id()`
- **Preview:** Usar `react-markdown` ou `@tailwindcss/typography` (prose class) para renderizacao de markdown
- **Nota:** Chapter Editor e uma pagina dedicada (`/edit`), nao inline — permite editor fullscreen com melhor UX

#### Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Implementacao completa (editor, CRUD, drag-and-drop) |
| **@ux-design-expert** | Review da UX do editor de capitulos |
| **@qa (Quinn)** | Validacao: reorder persistence, content validation, status toggle |

#### Quality Gates

| Gate | Validacao |
|------|----------|
| Pre-Commit | Lint + typecheck, Zod schemas, editor renders sem erros |
| Pre-PR | CRUD completo, reorder persiste apos refresh, preview funciona, minimo 100 chars enforced |

#### Tasks

- [ ] Criar Zod schemas em `packages/shared/src/validators/chapters.ts`
- [ ] Criar Server Actions para chapters CRUD + reorder + publish
- [ ] Instalar e configurar rich text editor (TipTap ou markdown textarea)
- [ ] Criar pagina `/courses/[courseId]/page.tsx` — teacher: lista de capitulos com drag-and-drop
- [ ] Criar componente `ChapterListItem` com status badge, actions (editar, perguntas, publicar, excluir)
- [ ] Implementar drag-and-drop reorder com `@dnd-kit/core`
- [ ] Criar pagina `/courses/[courseId]/chapters/[chapterId]/edit/page.tsx` — Chapter Editor
- [ ] Implementar char counter com feedback visual (vermelho < 100, verde >= 100)
- [ ] Implementar preview mode (markdown rendered)
- [ ] Implementar publish/unpublish toggle por capitulo
- [ ] Criar dialog de confirmacao de exclusao
- [ ] Testes: criar, editar, deletar, reorder, publish, content validation

#### Definition of Done

- [ ] Todos os ACs passam
- [ ] Teacher pode criar, editar, reordenar e excluir capitulos
- [ ] Rich text/markdown editor funcional com preview
- [ ] Reorder persiste apos page reload
- [ ] Content validation (minimo 100 chars) funciona
- [ ] PR aprovada

---

### Story 2.3: Geracao de Perguntas via Creator Agent

**As a** teacher,
**I want** gerar perguntas socraticas automaticamente a partir do conteudo do capitulo,
**so that** eu nao precise criar perguntas manualmente.

**Story Points:** 13
**Priority:** P0 (Blocker)
**Blocked By:** 2.2
**Blocks:** 2.4

#### Acceptance Criteria

- [ ] **AC1:** Botao "Gerar Perguntas" no capitulo publicado (na pagina do curso e na pagina de perguntas)
- [ ] **AC2:** API route `POST /api/chapters/[chapterId]/generate-questions` que chama o Creator Agent
- [ ] **AC3:** Creator Agent recebe: `chapter_title`, `chapter_content`, `learning_objective`, `max_questions: 3`
- [ ] **AC4:** System prompt do Creator Agent migrado de `Benchmarks/Agentes/Harven_Creator/03_prompt/prompt_operacional.md` (path do benchmark) para `packages/agents/src/prompts/creator.ts`
- [ ] **AC5:** Input/output schemas tipados com Zod em `packages/agents/src/schemas/creator.ts` conforme `Benchmarks/Agentes/Harven_Creator/03_prompt/schemas/` (path do benchmark)
- [ ] **AC6:** Response parseada e salva na tabela `questions` com todos os metadados (skill, intention, expected_depth, common_shallow_answer, citations, followup_prompts, metadata)
- [ ] **AC7:** Loading state durante geracao (5-15s) com feedback visual (spinner + "Gerando perguntas...")
- [ ] **AC8:** Tratamento de erro se LLM falhar (retry 1x automatico, mensagem de erro amigavel se falhar 2x)
- [ ] **AC9:** Limite: nao regerar se ja existem perguntas ativas para o capitulo (dialog de confirmacao para substituir)
- [ ] **AC10:** Integracao com Vercel AI SDK + Anthropic provider (`@ai-sdk/anthropic`)
- [ ] **AC11:** Rate limiting implementado no endpoint `/api/chapters/[chapterId]/generate-questions` conforme architecture.md Section 14.3 (5 req / 5 min por user). Requisicoes excedentes retornam HTTP 429 com mensagem amigavel ("Aguarde alguns minutos antes de gerar novas perguntas")

#### Technical Notes

- **PRIMEIRO USO DE LLM NA PLATAFORMA** — Esta story configura o `packages/agents` para uso real
- **Creator Agent I/O:** Conforme `Benchmarks/Agentes/Harven_Creator/03_prompt/schemas/` (path do benchmark)
  - **Input:** `chapter_content` (required), `chapter_title`, `learning_objective`, `max_questions`, `difficulty`
  - **Output:** `{ analysis, questions[], quality_checks, metadata, warnings }`
  - **Question fields:** `text`, `skill`, `intention`, `expected_depth`, `common_shallow_answer`, `followup_prompts`, `citations`, `has_practical_scenario`
- **System prompt:** Migrar de `Benchmarks/Agentes/Harven_Creator/03_prompt/prompt_operacional.md` (path do benchmark) — copiar literalmente, sem modificacao
- **API Route:** `apps/web/src/app/api/chapters/[chapterId]/generate-questions/route.ts`
  - Verifica auth + role (teacher/admin)
  - Verifica capitulo pertence ao tenant (RLS)
  - Verifica capitulo esta published
  - Chama Creator Agent
  - Parseia output com Zod
  - Salva questions na tabela com status `pending`
- **Retry:** Se LLM retornar output invalido (Zod parse fail) ou timeout, retry 1x
- **Custo:** ~1000-2000 tokens por chamada (monitorar)
- **Model:** `claude-sonnet-4-5-20250929` (balance custo/qualidade para geracao)

#### Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Implementacao do API route, migracao do prompt, Zod schemas, integracao AI SDK |
| **@architect (Aria)** | Review do setup do `packages/agents` — validar pattern para reuso em Epic 3 |
| **@qa (Quinn)** | Validacao: output schema compliance, retry logic, error handling |

#### Quality Gates

| Gate | Validacao |
|------|----------|
| Pre-Commit | Lint + typecheck, Zod schemas validam contra output schema do Creator Agent (benchmark) |
| Pre-PR | Geracao funcional end-to-end, perguntas salvas com todos os campos, retry testado |
| Security | API route verifica auth + role + tenant, input sanitizado, prompt injection mitigado, rate limiting 5 req/5 min enforced |

#### Tasks

- [ ] Migrar system prompt: `Benchmarks/Agentes/Harven_Creator/03_prompt/prompt_operacional.md` (path do benchmark) → `packages/agents/src/prompts/creator.ts`
- [ ] Criar Zod schemas: `packages/agents/src/schemas/creator.ts` (input + output conforme benchmark schemas)
- [ ] Instalar dependencias: `ai`, `@ai-sdk/anthropic` em `packages/agents`
- [ ] Criar funcao `generateQuestions()` em `packages/agents/src/creator.ts`
- [ ] Criar API route `POST /api/chapters/[chapterId]/generate-questions/route.ts`
- [ ] Implementar auth + role guard na API route
- [ ] Implementar retry logic (1x on failure)
- [ ] Implementar parse de output + save na tabela `questions`
- [ ] Criar Zod schema de validacao: `packages/shared/src/validators/questions.ts`
- [ ] Criar componente `GenerateQuestionsButton` com loading state
- [ ] Implementar dialog de confirmacao quando perguntas ativas ja existem
- [ ] Adicionar `.env.example` com `ANTHROPIC_API_KEY`
- [ ] Testes unitarios: Zod schema validation (mock LLM output)
- [ ] Implementar rate limiting no endpoint generate-questions (5 req / 5 min por user) usando `@upstash/ratelimit` + Redis ou Vercel KV, conforme architecture.md Section 14.3
- [ ] Teste de integracao: API route completa (com mock do Anthropic)

#### Definition of Done

- [ ] Todos os ACs passam
- [ ] Creator Agent gera perguntas a partir de conteudo de capitulo
- [ ] Perguntas salvas com todos os metadados na tabela `questions`
- [ ] Retry funciona quando LLM falha
- [ ] Zod valida output antes de salvar
- [ ] PR aprovada com architecture review

---

### Story 2.4: Revisao e Ativacao de Perguntas

**As a** teacher,
**I want** revisar as perguntas geradas antes de ativa-las,
**so that** eu tenha controle sobre a qualidade do conteudo socratico.

**Story Points:** 5
**Priority:** P0 (Blocker)
**Blocked By:** 2.3
**Blocks:** 2.5

#### Acceptance Criteria

- [ ] **AC1:** Tela de revisao (`/courses/[courseId]/chapters/[chapterId]/questions`) listando perguntas geradas para o capitulo
- [ ] **AC2:** Para cada pergunta exibir: texto, skill (badge colorido), intencao pedagogica (accordion), profundidade esperada (accordion)
- [ ] **AC3:** Teacher pode aprovar cada pergunta (status → `active`, `approved_by` → current user ID para audit trail)
- [ ] **AC4:** Teacher pode editar texto da pergunta inline (status permanece `pending` ate aprovar)
- [ ] **AC5:** Teacher pode rejeitar cada pergunta (status → `rejected`)
- [ ] **AC6:** Perguntas aprovadas ficam com status `active` e disponiveis para sessoes socraticas
- [ ] **AC7:** Perguntas rejeitadas ficam com status `rejected` e nao aparecem para alunos
- [ ] **AC8:** Botao "Gerar novas" regenera ate `max_questions` (3) perguntas: deleta perguntas com status `rejected` e `pending` via API route atomica (service role, S2.4-H1 resolution), preserva perguntas `active`. Se todas as 3 sao `active`, botao fica desabilitado com tooltip "Todas as perguntas ja estao ativas"
- [ ] **AC9:** Resumo no footer: "X/3 perguntas ativas — minimo 1 para publicar capitulo"
- [ ] **AC10:** Badge de skill colorido: analise (azul), sintese (roxo), aplicacao (verde), reflexao (laranja)

#### Technical Notes

- **Tela:** Screen 9 (Question Review)
- **API routes (architecture.md):**
  - `GET /api/chapters/[chapterId]/questions` — lista perguntas do capitulo
  - `PATCH /api/questions/[questionId]` — update (approve/reject/edit text)
- **Server Actions ou API routes:** Para approve/reject, Server Actions sao suficientes (simples mutations). Para listagem, RSC data fetching.
- **RLS:** `questions_update` requer `teacher` ou `admin`; `questions_select` retorna perguntas do tenant
- **Skill badges:** Usar cores consistentes em toda a plataforma:
  - `analise` → blue-500
  - `sintese` → purple-500
  - `aplicacao` → green-500
  - `reflexao` → orange-500
- **Accordion:** shadcn `Accordion` para expandir intencao pedagogica e profundidade esperada
- **Inline edit:** Textarea que aparece ao clicar "Editar" no texto da pergunta

#### Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Implementacao completa (pagina, componentes, actions) |
| **@qa (Quinn)** | Validacao: status transitions, inline edit, skill badges corretos |

#### Quality Gates

| Gate | Validacao |
|------|----------|
| Pre-Commit | Lint + typecheck, skill badges usam cores corretas |
| Pre-PR | Fluxo completo: gerar → revisar → aprovar/rejeitar/editar → counter atualiza |

#### Tasks

- [ ] Criar pagina `/courses/[courseId]/chapters/[chapterId]/questions/page.tsx`
- [ ] Criar componente `QuestionReviewCard` com texto, skill badge, accordions, actions
- [ ] Criar componente `SkillBadge` com cores por skill
- [ ] Implementar Server Actions: `approveQuestion()`, `rejectQuestion()`, `updateQuestionText()`
- [ ] Implementar inline edit do texto da pergunta
- [ ] Implementar resumo footer ("X/3 perguntas ativas")
- [ ] Conectar botao "Gerar novas" ao API route de geracao (Story 2.3)
- [ ] Adicionar link "Ver Perguntas" na pagina do curso (lista de capitulos)
- [ ] Testes: aprovar, rejeitar, editar, gerar novas, counter

#### Definition of Done

- [ ] Todos os ACs passam
- [ ] Teacher pode revisar, aprovar, rejeitar e editar perguntas
- [ ] Status transitions corretos (pending → active, pending → rejected)
- [ ] Counter mostra perguntas ativas vs total
- [ ] PR aprovada

---

### Story 2.5: Publicacao de Curso e Inscricao de Alunos

**As a** teacher,
**I want** publicar meu curso para que alunos possam se inscrever,
**so that** o conteudo fique disponivel para aprendizagem.

**Story Points:** 5
**Priority:** P1 (High)
**Blocked By:** 2.1, 2.4

#### Acceptance Criteria

- [ ] **AC1:** Botao "Publicar" no curso — valida que pelo menos 1 capitulo esta publicado com pelo menos 1 pergunta ativa
- [ ] **AC2:** Mensagem de erro clara se validacao falhar ("Publique pelo menos 1 capitulo com perguntas ativas")
- [ ] **AC3:** Curso publicado aparece na listagem de cursos disponiveis para alunos do tenant
- [ ] **AC4:** Aluno ve lista de cursos disponiveis em `/courses` (student variant — grid de cards)
- [ ] **AC5:** Botao "Inscrever-se" cria enrollment (student_id, course_id, tenant_id) com status `active`
- [ ] **AC6:** Cursos inscritos aparecem no dashboard do aluno (card com titulo + progress 0%)
- [ ] **AC7:** Progresso comeca em 0%
- [ ] **AC8:** Aluno nao pode se inscrever no mesmo curso 2x (unique constraint + UI feedback)
- [ ] **AC9:** Botao muda para "Continuar" se aluno ja esta inscrito, e "Concluido" se enrollment completed
- [ ] **AC10:** Curso publicado exibe contagem de capitulos e modo badge na grid student

#### Technical Notes

- **Telas:** Screen 5 (Student variant: course grid with enroll), Screen 6 (Student variant: course overview)
- **Publish validation:** Server Action verifica:
  1. `chapters` com `status = 'published'` para o curso (count >= 1)
  2. Para cada capitulo publicado, `questions` com `status = 'active'` (count >= 1)
  3. Se nao atende, retorna erro com mensagem especifica
- **Enrollment:** Server Action `enrollInCourse()` que cria registro em `enrollments`
  - RLS: `enrollments_insert` no architecture.md requer `teacher` ou `admin` — **NOTA:** precisa de ajuste para permitir student self-enroll OU usar API route com service role
  - **Decisao arquitetural:** Adicionar RLS policy `enrollments_student_self_enroll` para permitir student inserir enrollment com `student_id = auth.uid()`
- **Unique constraint:** `UNIQUE(student_id, course_id)` ja existe na tabela
- **Dashboard integration:** Story 1.4 criou dashboard placeholder. Esta story conecta dados reais (cursos inscritos com progress)
- **Student course overview:** `/courses/[courseId]` com lista de capitulos, progress bar, status por capitulo

#### Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Implementacao de publicacao, enrollment, student views |
| **@architect (Aria)** | Review da RLS policy para student self-enroll |
| **@qa (Quinn)** | Validacao: publish validation, enrollment, unique constraint, progress tracking |

#### Quality Gates

| Gate | Validacao |
|------|----------|
| Pre-Commit | Lint + typecheck, RLS policy revisada |
| Pre-PR | Publish validation end-to-end, enrollment funcional, dashboard mostra cursos inscritos |
| Security | Student nao consegue se inscrever em curso de outro tenant, RLS audit |

#### Tasks

- [ ] Implementar Server Action `publishCourse()` com validacao (capitulos publicados + perguntas ativas)
- [ ] Criar mensagens de erro especificas para falha de validacao
- [ ] Criar/ajustar RLS policy para student self-enroll (`enrollments_student_self_enroll`)
- [ ] Implementar Server Action `enrollInCourse()`
- [ ] Atualizar pagina `/courses` — student variant: grid de cursos publicados com botao Inscrever-se/Continuar/Concluido
- [ ] Criar pagina `/courses/[courseId]` — student variant: lista de capitulos com progress por capitulo
- [ ] Implementar student course overview com progress bar
- [ ] Atualizar dashboard do aluno (Story 1.4 placeholder) para mostrar cursos inscritos com progresso
- [ ] Tratar unique constraint violation (feedback amigavel se tentar inscrever 2x)
- [ ] Testes: publicar valido/invalido, inscrever, impedir duplicata, progress tracking

#### Definition of Done

- [ ] Todos os ACs passam
- [ ] Teacher pode publicar curso (com validacao)
- [ ] Aluno pode se inscrever em cursos publicados
- [ ] Dashboard do aluno mostra cursos inscritos com progress 0%
- [ ] Unique constraint impede inscricao duplicada
- [ ] RLS revisada e aprovada
- [ ] PR aprovada

---

## Risk Mitigation

| Risco | Impacto | Mitigacao | Rollback |
|-------|---------|-----------|----------|
| Creator Agent output invalido/inconsistente | HIGH | Zod validation estrita do output, retry 1x, fallback para mensagem de erro amigavel | Reprocessar manualmente |
| Rich text editor complexidade (TipTap) | MEDIUM | MVP com markdown textarea + preview; TipTap como enhancement futuro | Fallback para textarea simples |
| Latencia do Creator Agent (5-15s) | MEDIUM | Loading state claro, feedback progressivo, timeout de 30s | Retry com modelo mais rapido |
| RLS nao permite student self-enroll | HIGH | Criar RLS policy dedicada `enrollments_student_self_enroll` ou usar API route com service role | API route com service role como fallback |
| Drag-and-drop reorder race condition | LOW | Debounce + batch update, optimistic UI | Manual reorder (up/down buttons) |
| Prompt injection via conteudo de capitulo | HIGH | Sanitizacao do input antes de enviar ao LLM, delimitadores no system prompt, output validation | Rejeitar geracao, log incident |

## Quality Assurance Strategy

**CodeRabbit Validation:**

- **Story 2.1-2.2:** @dev valida CRUD operations, RLS enforcement
- **Story 2.3:** @architect valida pattern do `packages/agents` para reuso em Epic 3; @dev valida integracao AI SDK
- **Story 2.4:** @dev valida status transitions, UI consistency
- **Story 2.5:** @architect valida RLS policy change para student enrollment

**Quality Gates Aligned with Risk:**

- Stories 2.1, 2.2, 2.4, 2.5: MEDIUM RISK → Pre-Commit + Pre-PR validation
- Story 2.3: HIGH RISK (primeiro uso LLM) → Pre-Commit + Pre-PR + Security validation

## Epic Compatibility Requirements

- [x] Epic 1 completo (monorepo, DB schema, auth, layout, CI/CD)
- [x] Architecture v1.2 com API routes para courses, chapters, questions
- [x] PRD v1.0 com stories 2.1–2.5 definidas
- [x] Screens map v1.0 com telas 5, 6, 8, 9
- [x] Creator Agent benchmarks disponiveis em `Benchmarks/Agentes/Harven_Creator/` (path do benchmark)
- [x] RLS policy para student self-enroll (ADR-001, architecture.md v1.2.2)

## Definition of Done (Epic Level)

- [ ] Todas as 5 stories completadas com ACs atendidos
- [ ] Teacher pode criar curso → adicionar capitulos → gerar perguntas → revisar → publicar
- [ ] Aluno pode visualizar cursos disponiveis, se inscrever e ver no dashboard
- [ ] Creator Agent gera perguntas socraticas com qualidade validavel
- [ ] `packages/agents` setup pronto para reuso no Epic 3 (Socratic Pipeline)
- [ ] Nenhuma regressao nas funcionalidades do Epic 1
- [ ] Security review das novas RLS policies passou

---

## Story Manager Handoff

> **Para @sm (River):** As stories estao prontas para detalhamento. Consideracoes:
>
> - Epic 2 depende do Epic 1 completo — todas as tabelas ja existem
> - Story 2.3 e a mais critica: primeiro uso de LLM, setup do `packages/agents`, migracao do Creator prompt
> - Story 2.3 deve ser estimada com buffer — integracao LLM tem incertezas de output parsing
> - Story 2.5 requer ajuste de RLS (student self-enroll) — validar com @architect antes
> - Rich text editor (Story 2.2) pode ser simplificado para MVP (markdown textarea)
> - O pattern estabelecido em 2.3 para `packages/agents` sera reutilizado em Epic 3
> - Design tokens canonicos: `Benchmarks/Design/design-tokens.json` v1.2.1
> - Skill badge colors devem ser padronizadas e reutilizaveis (component dedicado)

---

*Epic criado por Morgan (PM Agent) — eximIA Academy v1.0*

— Morgan, planejando o futuro 📊

---

## QA Results

### Review Date: 2026-02-07

### Reviewed By: Quinn (Test Architect)

### Review Type: Epic Proposal Review (pre-development)

### Code Quality Assessment

**Overall:** Solid epic structure with clear stories, well-defined ACs, and appropriate agent assignments. The format aligns with Epic 1's quality standard. However, cross-referencing with `architecture.md` and the PRD reveals **3 HIGH** and **8 MEDIUM** findings that must be addressed before development begins.

### Findings

#### HIGH Severity

**H-1: `courses_update` RLS policy references non-existent column `teacher_id`**
- **Location:** `architecture.md` line ~1466, impacts Story 2.1 (AC3, AC5)
- **Issue:** The RLS policy `courses_update` uses `teacher_id = auth.uid()` but the `courses` table schema defines `created_by UUID NOT NULL REFERENCES users(id)` — there is no `teacher_id` column. The `sessions_select` policy (line ~1512) and `messages_select` (line ~1529) also reference `c.teacher_id`.
- **Impact:** Teacher will be unable to update their own courses via Supabase client (RLS will reject). Dev will hit runtime SQL error on first CRUD test.
- **Action Required:** Architecture doc must be patched: replace `teacher_id` with `created_by` in all RLS policies that reference courses ownership. Affects `courses_update`, `sessions_select`, `messages_select`. This is a **blocking** pre-requisite for Epic 2.
- **Suggested Owner:** @architect (Aria)

**H-2: Student self-enroll RLS gap is an architectural decision, not a story task**
- **Location:** Story 2.5, Technical Notes
- **Issue:** The `enrollments_insert` RLS policy (architecture.md line ~1498) only allows `teacher` or `admin` to INSERT enrollments. Story 2.5 proposes adding a new policy as a task within the story. However, this is an **architecture-level change** to the RLS security model that must be reviewed and approved by @architect BEFORE Story 2.5 development begins.
- **Impact:** If deferred to dev time, the developer may implement a workaround (service role key) that bypasses RLS — creating a security antipattern.
- **Action Required:** Create architecture decision record (ADR) for `enrollments_student_self_enroll` policy. Proposed SQL:
  ```sql
  CREATE POLICY enrollments_student_self_enroll ON enrollments FOR INSERT
    WITH CHECK (
      tenant_id = auth_tenant_id()
      AND student_id = auth.uid()
      AND auth_user_role() = 'student'
    );
  ```
  This must include a WITH CHECK that `student_id = auth.uid()` to prevent a student from enrolling someone else.
- **Suggested Owner:** @architect (Aria)

**H-3: Missing rate limiting for `/api/chapters/[chapterId]/generate-questions`**
- **Location:** Story 2.3
- **Issue:** Architecture doc Section 14.3 explicitly defines rate limiting: `/api/generate-questions` at 5 req per 5 min per user. Story 2.3 has 10 ACs and 14 tasks but **zero mention** of rate limiting. This is a paid LLM API — without rate limiting, a compromised or buggy client could burn through Anthropic credits.
- **Impact:** Financial risk (unbounded LLM API calls), DoS vector.
- **Action Required:** Add AC11 to Story 2.3: "Rate limiting implementado conforme architecture.md (5 req / 5 min por user)". Add corresponding task.
- **Suggested Owner:** @dev (Dex) — implementation; @pm (Morgan) — add AC

#### MEDIUM Severity

**M-1: Delete permission contradiction in Story 2.1**
- **Location:** Story 2.1, Technical Notes vs RLS
- **Issue:** Technical Notes say "Teacher pode deletar apenas cursos em draft via Server Action" but RLS `courses_delete` only allows `admin`. These are contradictory — the Server Action will fail at RLS level for teachers. Either: (a) teachers can only archive (not delete) — making AC4 admin-only, or (b) add a teacher delete policy for draft courses.
- **Action Required:** Clarify: should AC4 ("Exclusao de curso em draft") apply to teachers or only admins? If teacher, RLS needs adjustment. If admin-only, update AC4 text.
- **Suggested Owner:** @pm (Morgan)

**M-2: Missing `approved_by` field handling in Story 2.4**
- **Location:** Story 2.4, AC3
- **Issue:** DB schema defines `approved_by UUID REFERENCES users(id)` on `questions` table, but Story 2.4 AC3 only says "status → active". The `approved_by` field should be set to the approving teacher's ID for audit trail.
- **Action Required:** Update AC3 to: "Teacher pode aprovar cada pergunta (status → `active`, `approved_by` → current user ID)"
- **Suggested Owner:** @pm (Morgan)

**M-3: `createCourseSchema` mode enum mismatch**
- **Location:** Story 2.1, architecture.md Section 14.2
- **Issue:** Architecture doc's example Zod schema shows `z.enum(['university', 'corporate'])` but DB schema allows `'both'` and PRD/Story 2.1 AC2 says "modo (universidade/corporativo/ambos)". The Zod schema must include `'both'`.
- **Action Required:** Note in Story 2.1 that `createCourseSchema` must use `z.enum(['university', 'corporate', 'both'])`.
- **Suggested Owner:** @dev (Dex)

**M-4: "Gerar novas" behavior in Story 2.4 is ambiguous**
- **Location:** Story 2.4, AC8
- **Issue:** "Botao 'Gerar novas' para substituir perguntas rejeitadas" does not specify:
  - Does it regenerate ALL questions or only replace rejected ones?
  - Does it soft-delete rejected questions or keep them?
  - What happens to existing `active` questions during regeneration?
- **Action Required:** Clarify AC8 behavior: "Gerar novas" should regenerate up to `max_questions` (3), replace only `rejected` and `pending` questions (keep `active` ones), and soft-delete replaced questions (or change status to `replaced`).
- **Suggested Owner:** @pm (Morgan)

**M-5: `@dnd-kit/core` not in approved tech stack**
- **Location:** Story 2.2, Technical Notes
- **Issue:** New dependency not listed in architecture.md tech stack (Section 3). Should be validated for bundle size impact (NFR7: < 150KB gzipped).
- **Action Required:** Add tech stack validation task in Story 2.2 or document decision.
- **Suggested Owner:** @dev (Dex)

**M-6: No empty states defined for student-facing screens**
- **Location:** Story 2.1 (AC9), Story 2.5 (AC4)
- **Issue:** screens.md mentions empty state for student dashboard but no empty states defined for:
  - Student course grid when no courses published yet
  - Student course overview when no chapters published
  - Question review when no questions generated
- **Action Required:** Add empty state handling to relevant ACs or as shared task.
- **Suggested Owner:** @dev (Dex)

**M-7: Missing pagination for course and chapter lists**
- **Location:** Story 2.1, Story 2.2
- **Issue:** No pagination mentioned for teacher course list or chapter list. If a teacher creates 50+ courses, the UI will degrade.
- **Action Required:** Consider cursor-based pagination or "load more" pattern. At minimum, document that MVP can defer pagination if course count is expected to be low.
- **Suggested Owner:** @pm (Morgan) — scope decision

**M-8: Story 2.3 — No mention of content length limit for LLM input**
- **Location:** Story 2.3, AC3
- **Issue:** `chapter_content` is sent to the Creator Agent but no maximum content length is specified. Claude Sonnet has a 200K token context window but very large chapters could be expensive and slow. The Creator input schema specifies `minLength: 100` but no `maxLength`.
- **Action Required:** Add input validation: max content length (e.g., 50,000 chars) with user feedback if exceeded. Add to Zod schema.
- **Suggested Owner:** @dev (Dex)

### Compliance Check

- PRD Alignment: **CONCERNS** — H-1 (RLS column mismatch) and M-3 (mode enum) need architecture patch
- Architecture Alignment: **CONCERNS** — H-1, H-2, H-3 require architecture updates before dev
- Screens Alignment: ✓ — All 4 screens (5, 6, 8, 9) properly mapped to stories
- Epic 1 Consistency: ✓ — Format matches Epic 1 quality standard
- Story Structure: ✓ — All stories have user story format, ACs, tasks, agents, gates, DoD
- Dependency Graph: ✓ — Correctly identifies sequential chain + Epic 1 prerequisite

### Security Review

| Item | Status | Notes |
|------|--------|-------|
| RLS Enforcement | CONCERNS | H-1 (column mismatch), H-2 (enrollment gap) |
| Rate Limiting | FAIL | H-3: generate-questions endpoint unprotected |
| Input Validation | CONCERNS | M-8: no max content length for LLM input |
| Prompt Injection | ✓ | Risk Mitigation table addresses this correctly |
| Auth Guards | ✓ | All API routes specify auth + role checks |
| Tenant Isolation | ✓ | RLS + auto-populate triggers correctly referenced |

### Performance Considerations

- Story 2.3 correctly identifies 5-15s latency for Creator Agent — loading state addresses this
- Drag-and-drop reorder (Story 2.2) should debounce server calls — noted in Risk Mitigation
- Rich text editor bundle size impact should be measured against NFR7 (< 150KB)
- No caching strategy for course/chapter listings — acceptable for MVP

### Risk Assessment Matrix

| Risk | Probability | Impact | Score | Mitigation Status |
|------|-------------|--------|-------|-------------------|
| RLS column mismatch blocks dev | HIGH | HIGH | 9 | NOT MITIGATED — requires arch patch |
| Student enrollment RLS blocks | HIGH | HIGH | 9 | PARTIALLY — identified but not resolved |
| LLM cost overrun (no rate limit) | MEDIUM | HIGH | 6 | NOT MITIGATED |
| Creator output parsing failure | MEDIUM | MEDIUM | 4 | MITIGATED — retry + Zod validation |
| Rich text editor complexity | LOW | MEDIUM | 3 | MITIGATED — markdown fallback noted |
| Prompt injection | LOW | HIGH | 4 | MITIGATED — sanitization + output validation |

### Gate Status

Gate: **CONCERNS** → `docs/qa/gates/epic-2-course-content-management.yml`

### Recommended Status

**CONCERNS — 3 HIGH findings must be resolved before development starts:**

1. **H-1:** Patch `architecture.md` — replace `teacher_id` with `created_by` in RLS policies (blocks Story 2.1)
2. **H-2:** Create ADR for student self-enroll RLS policy (blocks Story 2.5)
3. **H-3:** Add rate limiting AC to Story 2.3 (security requirement)

Once these 3 items are resolved, the epic is **ready for development**.

The 8 MEDIUM findings are recommendations — teams can address during implementation or defer with documented rationale.

— Quinn, guardiao da qualidade 🛡️

---

### Re-Review Date: 2026-02-07

### Reviewed By: Quinn (Test Architect)

### Re-Review Type: Verification of H-1 and H-2 remediation by @architect (Aria)

### H-1 Verification: `teacher_id` → `created_by` — PASS

- Zero occurrences of `teacher_id` remaining in `architecture.md`
- `created_by = auth.uid()` correctly applied in 3 policies:
  - `courses_update` (line ~1468)
  - `sessions_select` (line ~1526)
  - `messages_select` (line ~1543)
- Changelog updated: v1.2.1
- **Status: RESOLVED**

### H-2 Verification: Student Self-Enroll RLS — PASS

- New policy `enrollments_student_self_enroll` added at architecture.md line ~1502
- 4 security guards validated:
  - `tenant_id = auth_tenant_id()` — tenant isolation
  - `student_id = auth.uid()` — prevents enrolling others
  - `auth_user_role() = 'student'` — role-scoped
  - `course_id IN (published courses)` — defense-in-depth
- ADR-001 created at `docs/architecture/project-decisions/ADR-001-student-self-enroll-rls.md`
  - Alternatives documented (service role, RPC, modify existing — all rejected with rationale)
  - Testing requirements defined (6 test cases)
  - Consequences documented
- Existing `enrollments_insert` policy preserved (teacher/admin flow unchanged)
- Changelog updated: v1.2.2
- **Status: RESOLVED**

### H-3 Status: Rate Limiting — STILL OPEN

- Story 2.3 still has 10 ACs with no mention of rate limiting
- Architecture doc Section 14.3 defines: `/api/generate-questions` → 5 req / 5 min per user
- **Action Required:** @pm (Morgan) must add AC11 and corresponding task to Story 2.3
- **Status: OPEN — pending @pm action**

### Updated Gate Decision

Previous: **CONCERNS** (3 HIGH findings)
Current: **CONCERNS** (1 HIGH finding remaining — H-3)

When H-3 is resolved, gate can be upgraded to **PASS** (MEDIUM findings are advisory).

— Quinn, guardiao da qualidade 🛡️

---

### PM Remediation Date: 2026-02-08

### Remediated By: Morgan (PM Agent)

### Findings Addressed

#### H-3: Rate Limiting — RESOLVED

- **AC11 added to Story 2.3:** Rate limiting 5 req / 5 min por user no endpoint `/api/chapters/[chapterId]/generate-questions`, HTTP 429 com mensagem amigavel
- **Task added:** Implementar rate limiting com `@upstash/ratelimit` + Redis/Vercel KV
- **Security gate updated:** Pre-PR gate agora inclui verificacao de rate limiting

#### M-1: Delete Permission — RESOLVED

- **AC4 (Story 2.1) clarified:** Teacher exclui draft via Server Action (verifica status); admin exclui qualquer. RLS `courses_delete` permanece admin-only — Server Action usa verificacao de status como guard
- **Technical Notes updated** com opcoes de implementacao (service role ou nova RLS policy — @architect decide)

#### M-2: approved_by Field — RESOLVED

- **AC3 (Story 2.4) updated:** Agora inclui `approved_by → current user ID` para audit trail

#### M-4: "Gerar novas" Behavior — RESOLVED

- **AC8 (Story 2.4) clarified:** Regenera ate `max_questions` (3), substitui `rejected` e `pending` (status → `replaced`), preserva `active`. Botao desabilitado quando todas as 3 estao ativas

#### M-7: Pagination Strategy — RESOLVED

- **Decision:** MVP sem paginacao (< 50 cursos/tenant, < 30 capitulos/curso). Cursor-based "load more" como enhancement pos-MVP
- **Documented** em Story 2.1 technical notes

#### Remaining Advisory (for @dev)

- **M-3:** Incluir `'both'` no enum `createCourseSchema`
- **M-5:** Validar bundle size de `@dnd-kit/core` contra NFR7 (150KB)
- **M-6:** Definir empty states para telas student
- **M-8:** Definir `maxLength` para `chapter_content` no Creator Agent input

### Updated Gate Status

**Gate: PASS** (quality score: 92)
- 3/3 HIGH: RESOLVED
- 4/8 MEDIUM: RESOLVED by @pm
- 4/8 MEDIUM: Advisory for @dev (can be addressed during implementation)

**Epic 2 is ready for development.**

— Morgan, planejando o futuro 📊

---

### QA Verification Date: 2026-02-08

### Verified By: Quinn (Test Architect)

### Verification Type: PM remediation verification (H-3, M-1, M-2, M-4, M-7)

#### H-3 Verification: Rate Limiting AC — PASS

- AC11 present in Story 2.3 (line 230): rate limiting 5 req / 5 min, HTTP 429 with user-friendly message
- Implementation task present (line 282): `@upstash/ratelimit` + Redis/Vercel KV
- Security quality gate updated (line 265): includes "rate limiting 5 req/5 min enforced"
- AC text aligns with architecture.md Section 14.3 specification
- **Status: RESOLVED**

#### M-1 Verification: Delete Permission Clarification — PASS

- AC4 (line 72) now explicitly states: teacher deletes draft via Server Action, admin deletes any, dialog required
- Technical notes (line 85) document the M-1 resolution with two implementation paths
- RLS note (line 84) correctly states `courses_delete` is admin-only at RLS level
- No contradiction remains — Server Action is the enforcement layer for teacher draft deletion
- **Status: RESOLVED**

#### M-2 Verification: approved_by Field — PASS

- AC3 (line 311) now includes `approved_by → current user ID para audit trail`
- Aligns with DB schema `approved_by UUID REFERENCES users(id)` on questions table
- **Status: RESOLVED**

#### M-4 Verification: "Gerar novas" Behavior — PASS

- AC8 (line 316) now specifies complete behavior:
  - Regenerates up to `max_questions` (3)
  - Replaces `rejected` + `pending` (status → `replaced`)
  - Preserves `active` questions
  - Button disabled when all 3 are active (with tooltip)
- Introduces new status `replaced` — @dev should add to question status enum if not present
- **Status: RESOLVED**

#### M-7 Verification: Pagination Strategy — PASS

- Technical notes (line 90) document MVP decision: no pagination for < 50 courses/tenant, < 30 chapters/course
- Post-MVP enhancement path defined (cursor-based "load more")
- Reasonable assumption for initial launch
- **Status: RESOLVED**

### Final Gate Decision

**Gate: CONCERNS → PASS**

All 3 HIGH findings are now resolved:
- H-1: `teacher_id` → `created_by` (by @architect, v1.2.1)
- H-2: Student self-enroll RLS + ADR-001 (by @architect, v1.2.2)
- H-3: Rate limiting AC11 + task (by @pm)

7 of 11 total findings resolved. 4 MEDIUM advisory items remain for @dev to address during implementation (M-3, M-5, M-6, M-8). These are non-blocking.

**Quality Score: 92/100**

**Epic 2 is cleared for development.**

— Quinn, guardiao da qualidade 🛡️
