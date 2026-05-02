# Epic 26: WS3 — Quiz & Assessment Engine

**Version:** 1.0
**Created:** 2026-02-26
**Updated:** 2026-02-26
**Author:** Atlas (Analyst) com arquitectura de WS3 v1.0
**Status:** Draft
**Architecture Reference:** `docs/architecture/ws3-platform-evolution-architecture.md` — Seções 4.2, 5.3
**Workstream:** WS3 (Platform Evolution — depende de Epic 25)

---

## Epic Goal

Construir um sistema completo de avaliação formal: instructor cria quizzes a partir do pool de questões existente, aluno responde com timer e feedback imediato, scoring automático para múltipla escolha, analytics por questão/capítulo/aluno, e retry inteligente com sugestão de conteúdo de reforço.

## Epic Context

| Item | Detalhe |
|------|---------|
| **Stack** | Next.js 15, Supabase, AI SDK (scoring dissertativa v2), @eximia/ui |
| **DB Tables** | `quiz_sessions` (NOVO), `quiz_attempts` (NOVO), `questions` (existente — reutilizar) |
| **Roles Impactados** | instructor (cria), student (responde), manager (analytics) |
| **Package** | `apps/web`, `packages/database`, `packages/shared` |
| **Story Points** | 34 SP |
| **Depende de** | Epic 25 (instructor role) |

---

## Existing System Context

### Infrastructure Already in Place

| Component | Status | Reference |
|-----------|--------|-----------|
| `questions` table com types (multiple_choice, open_ended, true_false) | Implementado | `packages/database/src/schema/questions.ts` |
| Question generation AI pipeline | Implementado | `apps/web/src/app/api/chapters/[chapterId]/generate-questions/` |
| `blueprint_assessments` table | Implementado | `packages/database/src/schema/blueprint-assessments.ts` |
| `assessment_history` table (5 types) | Implementado | Migration `20260210000001` |
| `interaction_type` em chapters | Implementado | `socratic_dialogue`, `quiz`, `scenario`, `assignment` |
| Analytics infrastructure | Implementado | `apps/web/src/app/api/analytics/` |

### What This Epic Changes

```
ANTES:
  Questions existem → usadas apenas no diálogo socrático
  Nenhum quiz formal
  Nenhum scoring

DEPOIS:
  Questions existem → usadas em diálogo socrático + quizzes formais
  Instructor monta quiz → aluno responde → scoring → feedback → retry
  Analytics por questão, capítulo e aluno
```

---

## Enhancement Details

### Quiz Types

| Tipo | Descrição | Quando usar |
|------|-----------|-------------|
| `practice` | Treino sem nota. Pode repetir. Respostas visíveis após cada questão | Durante estudo |
| `exam` | Avaliação formal. Nota registada. Tentativas limitadas | Final de curso/capítulo |
| `diagnostic` | Avaliação inicial. Sem nota. Identifica gaps de conhecimento | Início de trilha |

### Scoring Model

```
Múltipla escolha → Auto-scoring (correct/incorrect)
True/False       → Auto-scoring (correct/incorrect)
Open-ended       → v1: Manual review pelo instructor
                   v2: IA scoring via LLM (adiado)
```

---

## Stories

### Story 26.1: DB Migration — Quiz Tables

**SP:** 3 | **Priority:** P0

**Descrição:** Criar tabelas `quiz_sessions` e `quiz_attempts` com RLS policies.

**Tasks:**

- [ ] Criar migration SQL: `quiz_sessions` (id, tenant_id, course_id, chapter_id, title, quiz_type, time_limit_minutes, passing_score, max_attempts, shuffle_questions, show_answers_after, question_ids[], created_by, is_active)
- [ ] Criar migration SQL: `quiz_attempts` (id, quiz_session_id, student_id, tenant_id, started_at, completed_at, score, total_questions, correct_answers, status, answers JSONB, feedback JSONB)
- [ ] RLS: instructor/admin CRUD em quiz_sessions (own tenant)
- [ ] RLS: student read quiz_sessions se enrolled no curso
- [ ] RLS: student CRUD quiz_attempts (own records)
- [ ] RLS: instructor/manager/admin read quiz_attempts (own tenant)
- [ ] Criar Drizzle schemas
- [ ] Actualizar `packages/database/src/schema/index.ts`
- [ ] Criar índices: quiz_session_id + student_id, tenant_id + status

**Acceptance Criteria:**

- [ ] Migration aplica sem erros
- [ ] Student pode criar attempt mas não editar de outros
- [ ] Instructor vê attempts dos seus cursos

---

### Story 26.2: Quiz Creation UI

**SP:** 8 | **Priority:** P0

**Descrição:** Interface para instructor criar quiz a partir do pool de questões existente.

**Tasks:**

- [ ] Criar page `apps/web/src/app/(platform)/courses/[courseId]/quiz/new/page.tsx`
- [ ] Step 1: Título, tipo (practice/exam/diagnostic), capítulo (opcional)
- [ ] Step 2: Selecionar questões do pool — filtrar por capítulo, tipo, difficulty. Checkbox multi-select
- [ ] Step 3: Configurar regras — tempo limite, tentativas, nota mínima, shuffle, mostrar respostas
- [ ] Preview: visualizar quiz como o aluno vai ver
- [ ] Server action `createQuizSession()`
- [ ] Validador Zod: `createQuizSessionSchema`
- [ ] API route `GET /api/courses/[courseId]/quizzes` (listar quizzes)
- [ ] API route `POST /api/courses/[courseId]/quizzes` (criar)
- [ ] Listar quizzes na page do curso com badge de tipo

**Acceptance Criteria:**

- [ ] Instructor seleciona questões e cria quiz
- [ ] Pool filtra por capítulo e tipo de questão
- [ ] Preview mostra layout do quiz
- [ ] Quiz salvo aparece na lista do curso
- [ ] Apenas instructor/admin pode criar

---

### Story 26.3: Quiz Taking UI (Student)

**SP:** 8 | **Priority:** P0

**Descrição:** Interface para aluno responder quiz com timer, navegação entre questões e submit.

**Tasks:**

- [ ] Criar page `apps/web/src/app/(platform)/courses/[courseId]/quiz/[quizId]/page.tsx`
- [ ] Tela de início: título, regras (tempo, tentativas restantes), botão "Iniciar"
- [ ] Layout de quiz: questão actual, opções, navegação (anterior/próximo), indicador de progresso
- [ ] Timer countdown (se time_limit_minutes definido)
- [ ] Shuffle questões se configurado
- [ ] Server action `startQuizAttempt()` — cria record com status `in_progress`
- [ ] Server action `submitQuizAttempt()` — recebe respostas, calcula score
- [ ] Auto-submit quando timer expira (status `timed_out`)
- [ ] Tela de resultado: score, questões certas/erradas, feedback (se show_answers_after)
- [ ] Bloqueio se max_attempts atingido

**Acceptance Criteria:**

- [ ] Aluno inicia quiz e vê timer
- [ ] Pode navegar entre questões antes de submeter
- [ ] Auto-submit no timeout
- [ ] Resultado mostrado com score e feedback
- [ ] Segundo attempt bloqueado se max_attempts = 1

---

### Story 26.4: Auto-Scoring & Feedback

**SP:** 5 | **Priority:** P0

**Descrição:** Scoring automático para múltipla escolha e true/false. Feedback imediato por questão.

**Tasks:**

- [ ] Função `scoreQuizAttempt(attemptId)` — compara answers com correct_answer das questions
- [ ] Para multiple_choice: match exato com `correct_answer`
- [ ] Para true_false: match exato com `correct_answer`
- [ ] Para open_ended: marcar como `pending_review` (v1 — manual)
- [ ] Calcular score: `(correct / total) * 100`
- [ ] Determinar status: `passed` se score >= passing_score, `failed` se não
- [ ] Gerar feedback JSONB por questão: `{ questionId, correct, studentAnswer, correctAnswer, explanation }`
- [ ] Explanation: usar `explanation` field da question se existir
- [ ] Actualizar quiz_attempts com score, correct_answers, feedback, completed_at

**Acceptance Criteria:**

- [ ] Multiple choice e true/false corrigidos instantaneamente
- [ ] Open-ended marcado como pending (sem crash)
- [ ] Score calculado correctamente
- [ ] Feedback inclui explicação por questão

---

### Story 26.5: Quiz Analytics Dashboard

**SP:** 5 | **Priority:** P1

**Descrição:** Dashboard de analytics para quizzes: taxa de aprovação, questões mais erradas, distribuição de notas.

**Tasks:**

- [ ] Criar componente `QuizAnalytics` em `/courses/[courseId]/quiz/[quizId]/analytics`
- [ ] Card: Taxa de aprovação (%) com trend
- [ ] Card: Nota média com distribuição (histograma)
- [ ] Card: Tempo médio de conclusão
- [ ] Tabela: Questões mais erradas (top 5) com % de erro
- [ ] Tabela: Alunos — nome, nota, tempo, tentativas
- [ ] Server action `getQuizAnalytics(quizId)`
- [ ] Acessível por instructor, manager e admin

**Acceptance Criteria:**

- [ ] Dashboard mostra métricas reais
- [ ] Questões mais erradas ajudam instructor a melhorar conteúdo
- [ ] Filtro por período (7d, 30d, all)

---

### Story 26.6: Quiz Retry & Remediation

**SP:** 3 | **Priority:** P1

**Descrição:** Se aluno reprova, identificar capítulos fracos e sugerir revisão antes de nova tentativa.

**Tasks:**

- [ ] Após quiz com status `failed`: analisar quais questões errou
- [ ] Mapear questões erradas → capítulos (via question.chapter_id)
- [ ] Componente `RemediationSuggestion`: "Revise estes capítulos antes de tentar novamente"
- [ ] Lista de capítulos com link directo para estudo
- [ ] Botão "Tentar Novamente" só habilitado se attempts < max_attempts
- [ ] Track tentativas no quiz_attempts

**Acceptance Criteria:**

- [ ] Aluno reprovado vê capítulos sugeridos
- [ ] Links levam ao capítulo correcto
- [ ] Retry respeitado pelo max_attempts

---

### Story 26.7: Tests — Quiz Engine

**SP:** 2 | **Priority:** P1

**Descrição:** Testes unitários e E2E para o quiz engine completo.

**Tasks:**

- [ ] Unit test: `scoreQuizAttempt()` com vários cenários (all correct, all wrong, mixed, open_ended)
- [ ] Unit test: Timer timeout handling
- [ ] Unit test: Max attempts enforcement
- [ ] E2E: Instructor cria quiz → aluno responde → ver resultado → retry
- [ ] E2E: Timer expira → auto-submit
- [ ] Regression: Questions existentes não afectadas

**Acceptance Criteria:**

- [ ] Todos os testes passam
- [ ] Score calculation edge cases cobertos
- [ ] Flow completo E2E funciona

---

## Dependencies

| Dependency | Type | Status |
|-----------|------|--------|
| Epic 25 (Instructor role) | Interna | Pendente |
| `questions` table | Interna | Implementado |
| Question generation pipeline | Interna | Implementado |
| @eximia/ui components | Interna | Implementado |

## Risks

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Open-ended scoring manual é bottleneck | Médio | v2 adiciona IA scoring. v1 marca como pending_review |
| Timer de quiz não sincroniza server/client | Médio | Timer no server (started_at + time_limit). Client é cosmético |
| Pool de questões vazio | Baixo | Mostrar CTA "Gere questões primeiro" se pool vazio |

---

*Epic 26 — WS3 Quiz & Assessment Engine v1.0*
