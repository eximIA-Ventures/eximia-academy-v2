# ADR-002: Student Enrollment Progress Update via SECURITY DEFINER Function

**Date:** 2026-02-07
**Status:** Accepted
**Deciders:** Morgan (PM), Quinn (QA), Aria (Architect via Morgan)
**Context:** Epic 3, Story 3.5 — Conclusao de Sessao e Resumo

---

## Context

Story 3.5 requires updating `enrollments.progress` and `enrollments.status` after a student completes a socratic session. The `updateEnrollmentProgress()` Server Action runs in the student's authenticated context.

However, the `enrollments_update` RLS policy only allows `teacher` and `admin` roles:

```sql
CREATE POLICY enrollments_update ON enrollments FOR UPDATE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() IN ('teacher', 'admin'));
```

Students cannot directly UPDATE their own enrollment record.

## Decision

Create a `SECURITY DEFINER` function `update_enrollment_progress(p_student_id, p_course_id)` that:

1. Validates the student belongs to the same tenant as the enrollment
2. Counts total published chapters in the course
3. Counts chapters with at least one `completed` session for the student
4. Calculates progress as `(completed_chapters / total_chapters) * 100`
5. Updates enrollment `progress`, `status`, and `completed_at`
6. Returns the updated enrollment data

## Alternatives Considered

### Alternative A: Add student-scoped RLS policy
- **Rejected:** Allowing students to UPDATE enrollments opens risk of self-modification of `status` to `completed` without actually completing sessions. Would need column-level restrictions which PostgreSQL RLS doesn't support directly.

### Alternative B: Use service_role in Server Action
- **Rejected:** Bypasses ALL RLS including tenant isolation. Security antipattern — same reasoning as ADR-001.

### Alternative C: API route with RPC call (Chosen)
- **Accepted:** SECURITY DEFINER function validates ownership and calculates progress server-side. Student cannot manipulate progress directly. The function is the single source of truth for progress calculation.

## Consequences

### Positive
- Progress calculation is atomic and consistent
- Student cannot manipulate progress values
- Tenant isolation preserved (function checks tenant match)
- Same pattern as `claim_session_turn` — familiar to the team

### Negative
- Progress logic lives in SQL rather than application code (harder to test)
- Adding new completion criteria (e.g., minimum score) requires function update

### Testing Requirements
1. Student completes 1 of 3 chapters → progress = 33.33%
2. Student completes 3 of 3 chapters → progress = 100%, status = 'completed'
3. Student from tenant A cannot update enrollment from tenant B
4. Course with 0 published chapters returns no result
5. Multiple completed sessions for same chapter count as 1

## SQL

See `architecture.md` Section 10.3 — `update_enrollment_progress()` function.
