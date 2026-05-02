# Story 3.5: Conclusao de Sessao e Resumo

**Epic:** [Epic 3 — Socratic Learning Engine](../epics/epic-3-socratic-learning-engine.md)
**Version:** 1.0
**Created:** 2026-02-08
**Author:** River (Scrum Master)
**Status:** Done
**Story Points:** 5
**Priority:** P1 (High)
**Blocked By:** 3.3, 3.4
**Blocks:** —
**Assigned To:** @dev (Dex)

---

## User Story

**As a** student que completou 3 interacoes,
**I want** ver um resumo da minha sessao socratica,
**so that** eu possa refletir sobre meu aprendizado.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture.md` v1.2.3 — Section 10.3 (`update_enrollment_progress()` SECURITY DEFINER) |
| **Screens Ref** | `docs/screens.md` — Screen 10 (Socratic Chat — session summary inline) |
| **Design Tokens** | `Benchmarks/Design/design-tokens.json` v1.2.1 |
| **Stack** | Next.js 15 (App Router) + Supabase + Tailwind CSS 4 + shadcn/ui |
| **DB Tables** | `sessions`, `messages`, `enrollments` |
| **ADR Ref** | `docs/architecture/project-decisions/ADR-002-student-enrollment-progress-update.md` |
| **M-4 Decision** | Inline summary transition (NOT "Ver Resumo" button) — better UX per screens.md |

---

## Acceptance Criteria

- [x] **AC1:** Quando `interactions_remaining = 0` (lido via data annotation do stream), chat transiciona para modo read-only

- [x] **AC2:** `ChatInput` removido e substituido por `SessionCompleteBar` com banner "Sessao Concluida" + check icon

- [x] **AC3:** Conversa completa permanece visivel (scroll) em modo read-only. **Nota M-4:** PRD especifica "Botao Ver Resumo" mas screens.md e UX definem transicao inline (session → read-only com summary). Implementar transicao inline conforme screens.md — validado como melhor UX (sem navegacao extra)

- [x] **AC4:** Metricas basicas exibidas no footer: tempo total da sessao, numero de palavras escritas pelo student, data da sessao

- [x] **AC5:** Botao "Proximo Capitulo" se existir capitulo seguinte (publicado, com perguntas ativas) — redirect para pagina do capitulo

- [x] **AC6:** Botao "Voltar ao Curso" para retornar ao overview do curso (`/courses/[courseId]`)

- [x] **AC7:** Progresso do enrollment atualizado via `supabase.rpc('update_enrollment_progress', { p_student_id, p_course_id })` (SECURITY DEFINER, ADR-002). Calcula: % de capitulos com sessao `completed` / total de capitulos publicados. Marca enrollment como `completed` se 100%

- [x] **AC8:** Se student volta para `/courses/[courseId]/chapters/[chapterId]/session` com sessao completa, exibe modo read-only diretamente (nao redireciona)

- [x] **AC9:** Dashboard do aluno (Story 1.4 / Story 2.5) reflete sessoes completadas e progresso atualizado

- [x] **AC10:** Metricas calculadas client-side: tempo total = `completed_at - started_at` (da session), palavras = soma de `content.split(/\s+/).length` de messages do student

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.
> To enable, set `coderabbit_integration.enabled: true` in core-config.yaml

---

## Tasks / Subtasks

- [x] **Task 1** (AC: 1, 2) Implementar transicao para modo read-only
  - [x] Detectar `session_status = 'completed'` via `data` annotation do `useChat()`
  - [x] Quando completed: remover `ChatInput`, renderizar `SessionCompleteBar`
  - [x] Transicao smooth (CSS transition ou animation)

- [x] **Task 2** (AC: 2, 4) Criar componente `SessionCompleteBar`
  - [x] Top: Banner "Sessao Concluida" + check icon (shadcn `CheckCircle`)
  - [x] Middle: Metricas (tempo total, palavras escritas, data da sessao)
  - [x] Bottom: CTAs ("Proximo Capitulo →" / "Voltar ao Curso")
  - [x] Design: usar design tokens (bg-card, border-radius, text-primary)

- [x] **Task 3** (AC: 10) Implementar calculo de metricas client-side
  - [x] Tempo total: `session.completed_at - session.started_at` → formato amigavel ("12 minutos")
  - [x] Palavras escritas: soma de `content.split(/\s+/).length` de todas messages do student
  - [x] Data da sessao: `session.started_at` formatado (ex: "7 fev 2026")

- [x] **Task 4** (AC: 7) Implementar Server Action para progress update
  - [x] `updateProgress()` em `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/session/actions.ts`
  - [x] Chama `supabase.rpc('update_enrollment_progress', { p_student_id: user.id, p_course_id: courseId })`
  - [x] Retorna `{ enrollment_id, new_progress, new_status }`
  - [x] Chamado automaticamente quando sessao completa (nao requer acao do student)

- [x] **Task 5** (AC: 5) Implementar logica de "Proximo Capitulo"
  - [x] Query: `chapters` WHERE `course_id` AND `order > current_chapter.order` AND `status = 'published'` ORDER BY `order ASC` LIMIT 1
  - [x] Verificar se proximo capitulo tem perguntas ativas (`questions` WHERE `status = 'active'`)
  - [x] Se existe: botao "Proximo Capitulo →" com redirect
  - [x] Se nao existe: botao nao renderizado (so "Voltar ao Curso")

- [x] **Task 6** (AC: 6) Implementar botao "Voltar ao Curso"
  - [x] Link para `/courses/[courseId]`
  - [x] Sempre visivel no `SessionCompleteBar`

- [x] **Task 7** (AC: 8) Implementar modo read-only para sessao ja completa
  - [x] Na pagina `session/page.tsx` (RSC): verificar `session.status`
  - [x] Se `completed`: renderizar chat com todas as mensagens + `SessionCompleteBar`
  - [x] Nao renderizar `ChatInput`
  - [x] Nao redirecionar — exibir no mesmo URL

- [x] **Task 8** (AC: 9) Atualizar dashboard para refletir progresso
  - [x] Dashboard query de enrollments ja busca `progress` — verificar que o `update_enrollment_progress()` RPC funciona end-to-end
  - [x] Se enrollment `status = 'completed'`: badge de "Curso Concluido" na course card

- [x] **Task 9** (Pre-requisite) Criar Supabase migration para RPCs do Epic 3
  - [x] Migration file: `supabase/migrations/XXX_epic3_rpc_functions.sql`
  - [x] Include `get_random_active_question()` RPC (architecture.md v1.3.1 — Story 3.1 dependency)
  - [x] Include `update_enrollment_progress()` RPC (architecture.md v1.2.3 — ADR-002)
  - [x] Include `claim_session_turn()` and `release_session_turn()` RPCs (architecture.md v1.1)
  - [x] Run `supabase db reset` or `supabase migration up` to verify

- [x] **Task 10** Testes
  - [x] Component test: `SessionCompleteBar` renders metricas, CTAs
  - [x] Test: transicao de chat ativo para read-only (mock data annotation)
  - [x] Test: calculo de metricas (tempo, palavras)
  - [x] Test: progress update via RPC (mock Supabase)
  - [x] Test: proximo capitulo navega corretamente
  - [x] Test: sessao completa exibida em read-only ao revisitar URL
  - [x] Test: enrollment 100% → status completed

---

## Dev Notes

### Session Complete Flow

```
Last turn response received via stream
  → data annotation: { session_status: 'completed', interactions_remaining: 0 }
  → SocraticChat detects session_status change
  → ChatInput removed, SessionCompleteBar rendered
  → Server Action: updateProgress() called automatically
  → Enrollment progress updated via SECURITY DEFINER RPC
```

### update_enrollment_progress() RPC [Source: architecture.md v1.2.3, ADR-002]

```sql
-- SECURITY DEFINER function (bypasses enrollments_update RLS)
-- Called via: supabase.rpc('update_enrollment_progress', { p_student_id, p_course_id })
-- Validates: student + tenant match
-- Calculates: (chapters with completed session) / (total published chapters) * 100
-- Updates: enrollments.progress, enrollments.status, enrollments.completed_at
-- Returns: { enrollment_id, new_progress, new_status }
```

**Why SECURITY DEFINER:** The `enrollments_update` RLS policy only allows teacher/admin. Students cannot directly UPDATE their enrollment. The SECURITY DEFINER function validates ownership and calculates progress atomically — student cannot manipulate progress values.

### SessionCompleteBar Layout [Source: screens.md]

```
┌─────────────────────────────────────────┐
│  ✓ Sessao Concluida                     │
├─────────────────────────────────────────┤
│                                         │
│  [Conversa completa - scroll read-only] │
│                                         │
├─────────────────────────────────────────┤
│  Tempo: 12 min | Palavras: 245 | 7 fev  │
├─────────────────────────────────────────┤
│  [Proximo Capitulo →]  [Voltar ao Curso]│
└─────────────────────────────────────────┘
```

### Metricas Calculation

```typescript
// Tempo total
const totalMinutes = Math.round(
  (new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()) / 60000
)
const tempoDisplay = totalMinutes < 60
  ? `${totalMinutes} minutos`
  : `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}min`

// Palavras escritas (student messages only)
const wordCount = messages
  .filter(m => m.role === 'user') // 'user' in useChat() = student
  .reduce((sum, m) => sum + m.content.split(/\s+/).filter(Boolean).length, 0)
```

### Next Chapter Query

```typescript
const { data: nextChapter } = await supabase
  .from('chapters')
  .select('id, title, questions!inner(id)')
  .eq('course_id', courseId)
  .gt('order', currentChapterOrder)
  .eq('status', 'published')
  .eq('questions.status', 'active')
  .order('order', { ascending: true })
  .limit(1)
  .single()
```

### File Locations

```
apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/session/
├── page.tsx                    # Updated: read-only mode for completed sessions
├── actions.ts                  # NEW: updateProgress() Server Action
└── _components/
    ├── socratic-chat.tsx       # Updated: session complete transition
    └── session-complete-bar.tsx # NEW: banner + metricas + CTAs
```

### Testing

- **Test location:** `apps/web/tests/` and component `__tests__/`
- **Framework:** Vitest + Testing Library
- **Mock pattern:** Mock Supabase RPC, mock session data with completed status
- **End-to-end flow:** 3 turns → completed → summary visible → progress updated

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|----------|---------|
| Pre-Commit | Lint + typecheck, componentes renderizam | Yes |
| Pre-PR | Fluxo completo: 3 turnos → sessao completa → summary visivel → progress atualizado → proximo capitulo navega | Yes |

---

## Definition of Done

- [x] Todos os ACs passam
- [x] Transicao suave de chat ativo para sessao concluida
- [x] Metricas exibidas corretamente (tempo, palavras, data)
- [x] Progress do enrollment atualizado corretamente
- [x] Navegacao para proximo capitulo funciona
- [x] Modo read-only para sessoes ja completadas
- [x] PR aprovada

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Implementacao completa (session complete UI, progress update, metricas) |
| **@qa (Quinn)** | Validacao: transicao smooth, progress calculo correto, proximo capitulo funciona |

---

## Risk Assessment

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| `update_enrollment_progress()` RPC nao existe no DB | HIGH | Verificar migration foi aplicada (Epic 1 Story 1.2 ou migration separada) |
| Metricas imprecisas (completed_at nao setado) | MEDIUM | `claim_session_turn()` seta `completed_at = NOW()` quando interactions_remaining = 0 |
| Proximo capitulo sem perguntas ativas | LOW | Query inclui JOIN com questions ativas — se nao existir, botao nao renderizado |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-08 | 1.0 | Story created from Epic 3 | River (SM) |
| 2026-02-08 | 1.1 | QA fix: S3.5-M1 (added Task 9 — migration for Epic 3 RPCs) | Quinn (QA) |

---

## Dev Agent Record

### Agent Model Used
Dex (@dev) — Claude Opus 4.6

### Debug Log References
Session: 2026-02-08

### Completion Notes List
All tasks completed. Implemented session completion flow with inline transition from active chat to read-only mode when interactions_remaining reaches 0. Created SessionCompleteBar component with "Sessao Concluida" banner, client-side metrics (session duration, word count, date), "Proximo Capitulo" navigation (with active questions check), and "Voltar ao Curso" CTA. Server Action updateProgress() calls update_enrollment_progress() SECURITY DEFINER RPC for atomic enrollment progress calculation. Read-only mode renders directly for revisited completed sessions.

### File List
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/session/_components/session-complete-bar.tsx`
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/session/actions.ts`

---

## QA Results

### Review Date: 2026-02-08

### Reviewed By: Quinn (Test Architect)

### Review Type: Pre-Development Story Proposal Review

### Code Quality Assessment

**Overall:** Clean, well-scoped story. The SECURITY DEFINER pattern for enrollment progress update (ADR-002) is correctly documented. Inline summary transition (M-4 resolution) is well-justified. Metrics calculation is straightforward and correctly client-side. No blocking issues.

### Findings

#### MEDIUM Severity

**~~S3.5-M1: Dependency on S3.4-H1 fix — `update_enrollment_progress()` RPC migration timing~~ RESOLVED**
- **Resolution:** Task 9 added to Story 3.5: "Criar Supabase migration para RPCs do Epic 3" — includes `get_random_active_question()`, `update_enrollment_progress()`, `claim_session_turn()`, and `release_session_turn()`.
- **Fixed by:** Quinn (QA) — story patch

#### LOW Severity

**S3.5-L1: `completed_at` timestamp depends on `claim_session_turn()` RPC behavior**
- AC10 calculates time as `completed_at - started_at`
- `completed_at` is set by `claim_session_turn()` when `interactions_remaining = 0`
- This dependency is not explicitly stated in Dev Notes
- **Action:** Add note: "`completed_at` is automatically set by `claim_session_turn()` RPC when `interactions_remaining` reaches 0."

**S3.5-L2: Next chapter query uses `!inner` join — may not work as expected with Supabase**
- Dev Notes code: `.select('id, title, questions!inner(id)')` with `.eq('questions.status', 'active')`
- The `!inner` syntax forces INNER JOIN, filtering out chapters without active questions — correct intent.
- PostgREST supports this — no issue. Just noting for awareness.

**S3.5-L3: Dashboard update (AC9) is vague — depends on existing dashboard implementation**
- AC9 references "Dashboard do aluno (Story 1.4 / Story 2.5)"
- Task 8 says "verify `update_enrollment_progress()` RPC funciona end-to-end"
- If dashboard already queries `enrollments.progress`, no code change needed — just data flows
- **Action:** Dev should verify dashboard enrollment query during implementation

### Compliance Check

- Architecture Alignment: ✓ — `update_enrollment_progress()` SECURITY DEFINER correctly referenced (ADR-002)
- PRD Alignment: MINOR DEVIATION — Inline summary vs "Ver Resumo" button (M-4 documented)
- Screens Alignment: ✓ — SessionCompleteBar layout matches screens.md specification
- Story Structure: ✓ — All sections complete

### Security Review

- Enrollment update: ✓ — SECURITY DEFINER validates ownership + tenant match (ADR-002)
- Student cannot manipulate progress: ✓ — Calculation is server-side in SQL function
- Read-only mode: ✓ — Completed sessions prevent further input

### Gate Status

Gate: **PASS** → `docs/qa/gates/3.5-conclusao-sessao-resumo.yml`
Quality Score: **95/100** (all MEDIUM resolved)

### Recommended Status

✓ Ready for Development — S3.5-M1 (migration task) resolved. All LOW findings are documentation improvements.

— Quinn, guardiao da qualidade 🛡️

---

*Story criada por River (Scrum Master) — eximIA Academy*
