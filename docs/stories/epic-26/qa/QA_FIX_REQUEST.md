# QA Fix Request — Epic 26: Quiz & Assessment Engine

**Generated:** 2026-02-28
**Reviewer:** Quinn (QA Agent)
**Status:** OPEN
**Stories Affected:** 26.1, 26.2, 26.3, 26.4

---

## Summary

Epic 26 review encontrou **1 bug critico** que impede o scoring de funcionar em producao, mais 5 issues de severidade HIGH/MEDIUM. O bug critico e um mismatch entre o CHECK constraint do DB e os valores que o scoring tenta gravar — todas as escritas de score/feedback falham silenciosamente.

**Total Issues:** 3 P0 (MUST FIX) + 3 P1 (SHOULD FIX)

---

## P0 — MUST FIX (Bloqueiam release)

### FIX-26.1-001: CHECK constraint quiz_attempts.status demasiado restritivo

**Story:** 26.1 | **Severity:** CRITICAL | **Status:** [x] FIXED

**Problem:**
O `quiz_attempts.status` CHECK constraint permite apenas:
```sql
CHECK (status IN ('in_progress', 'completed', 'timed_out', 'abandoned'))
```

Mas `scoreAndUpdateAttempt()` em `scoring.ts` tenta gravar `'passed'`, `'failed'`, `'pending_review'`. Estes valores violam o constraint — o UPDATE falha silenciosamente e **score, feedback, correct_answers nunca sao gravados**.

**File:** `supabase/migrations/20260228200000_quiz_tables.sql:51`

**Fix:**
Criar nova migration que expande o CHECK constraint:
```sql
ALTER TABLE quiz_attempts DROP CONSTRAINT IF EXISTS quiz_attempts_status_check;
ALTER TABLE quiz_attempts ADD CONSTRAINT quiz_attempts_status_check
  CHECK (status IN ('in_progress', 'completed', 'timed_out', 'abandoned', 'passed', 'failed', 'pending_review'));
```

**Verification:** Apos fix, rodar `scoreAndUpdateAttempt()` num attempt real e verificar que score/feedback sao gravados no DB.

---

### FIX-26.4-001: scoreAndUpdateAttempt() nao verifica erro do Supabase update

**Story:** 26.4 | **Severity:** CRITICAL | **Status:** [x] FIXED

**Problem:**
Em `scoring.ts:127-142`, `scoreAndUpdateAttempt()` faz `supabase.update()` mas ignora o `{ error }` retornado. Mesmo apos FIX-26.1-001, qualquer falha no update passaria despercebida.

**File:** `apps/web/src/lib/quiz/scoring.ts:127-142`

**Fix:**
```typescript
export async function scoreAndUpdateAttempt(attemptId: string): Promise<ScoringResult> {
  const result = await scoreQuizAttempt(attemptId)
  const supabase = await createClient()

  const { error } = await supabase
    .from("quiz_attempts")
    .update({
      score: result.score,
      correct_answers: result.correctCount,
      feedback: result.feedback,
      status: result.status === "pending_review" ? "pending_review" : result.status,
    })
    .eq("id", attemptId)

  if (error) {
    console.error(`[scoring] Failed to update attempt ${attemptId}:`, error.message)
    throw new Error(`Scoring update failed: ${error.message}`)
  }

  return result
}
```

**Verification:** Erro de update deve propagar para submitQuizAttempt catch block.

---

### FIX-26.4-002: submitQuizAttempt() catch block silencia erros de scoring

**Story:** 26.4 | **Severity:** HIGH | **Status:** [x] FIXED

**Problem:**
Em `actions.ts:192-194`, o catch block engole o erro silenciosamente. Se scoring falha, o aluno ve "completed" sem score e sem feedback.

**File:** `apps/web/src/app/(platform)/courses/[courseId]/quiz/[quizId]/actions.ts:192-194`

**Fix:**
```typescript
} catch (scoringError) {
  console.error(`[quiz] Scoring failed for attempt ${attemptId}:`, scoringError)
  // Mark as needing manual review since scoring failed
  await supabase
    .from("quiz_attempts")
    .update({ status: "pending_review" })
    .eq("id", attemptId)
  return { data: { status: "pending_review" as const, attemptId } }
}
```

**Verification:** Simular falha de scoring e verificar que attempt fica com status `pending_review`.

---

## P1 — SHOULD FIX

### FIX-26.2-001: createQuizSession() nao verifica courseId pertence ao tenant

**Story:** 26.2 | **Severity:** MEDIUM | **Status:** [x] FIXED

**Problem:**
Em `quiz/actions.ts:39-56`, `createQuizSession()` insere com `course_id: courseId` sem verificar que o curso pertence ao mesmo tenant do utilizador. FK constraint permite cross-tenant course_id reference.

**File:** `apps/web/src/app/(platform)/courses/[courseId]/quiz/actions.ts:39`

**Fix:**
Adicionar verificacao antes do insert:
```typescript
const { data: course } = await supabase
  .from("courses")
  .select("id")
  .eq("id", courseId)
  .eq("tenant_id", roleCheck.tenantId)
  .single()
if (!course) return { error: "Curso nao encontrado" }
```

---

### FIX-26.2-002: Supabase error.message exposto ao client

**Story:** 26.2 | **Severity:** MEDIUM | **Status:** [x] FIXED

**Problem:**
Em `quiz/actions.ts:58,77,110,127`, `error.message` do Supabase retornado diretamente ao frontend. Pode expor detalhes internos do DB.

**File:** `apps/web/src/app/(platform)/courses/[courseId]/quiz/actions.ts`

**Fix:**
Substituir por mensagens genericas:
```typescript
if (error) return { error: "Erro ao criar quiz" }
// ou
if (error) return { error: "Erro ao carregar dados" }
```

---

### FIX-26.3-001: Task checkboxes nao atualizados na story 26.3

**Story:** 26.3 | **Severity:** MEDIUM | **Status:** [x] FIXED

**Problem:**
Todos os 6 task checkboxes estao `[ ]` mas o Dev Agent Record confirma que a implementacao esta completa. Inconsistencia documental.

**File:** `docs/stories/epic-26/story-26.3-quiz-taking-ui-student.md:60-108`

**Fix:**
Atualizar todos os 6 tasks e subtasks para `[x]`.

---

## Acceptance

Apos todos os P0 fixes aplicados:
1. `pnpm typecheck` deve passar (6/6)
2. `pnpm --filter @eximia/web test -- --run` deve passar (todos os 14 scoring tests)
3. Verificacao manual: criar quiz, responder, e confirmar que score/feedback aparecem no DB

— Quinn, guardiao da qualidade
