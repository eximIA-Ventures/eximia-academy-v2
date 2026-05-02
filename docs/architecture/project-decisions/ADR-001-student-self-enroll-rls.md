# ADR-001: Student Self-Enrollment RLS Policy

**Status:** Accepted
**Date:** 2026-02-07
**Author:** Aria (Architect Agent)
**Triggered by:** Quinn QA review H-2 (Epic 2 gate: CONCERNS)
**Impacts:** `architecture.md` v1.2.1, Story 2.5

---

## Context

The current RLS policy `enrollments_insert` (architecture.md Section 10.3) only permits `teacher` and `admin` roles to insert enrollments:

```sql
CREATE POLICY enrollments_insert ON enrollments FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_user_role() IN ('teacher', 'admin'));
```

PRD Story 2.5 AC5 requires students to self-enroll via a "Inscrever-se" button. Without a policy change, the student's INSERT will be rejected by RLS.

## Decision

Add a dedicated RLS policy allowing students to self-enroll, with strict guards:

```sql
CREATE POLICY enrollments_student_self_enroll ON enrollments FOR INSERT
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND student_id = auth.uid()
    AND auth_user_role() = 'student'
    AND course_id IN (
      SELECT id FROM courses
      WHERE tenant_id = auth_tenant_id()
      AND status = 'published'
    )
  );
```

### Guards

| Guard | Purpose |
|-------|---------|
| `tenant_id = auth_tenant_id()` | Multi-tenant isolation |
| `student_id = auth.uid()` | Student can only enroll themselves (prevents enrolling others) |
| `auth_user_role() = 'student'` | Only students use this policy (teachers/admins use existing policy) |
| `course_id IN (SELECT ... WHERE status = 'published')` | Can only enroll in published courses within own tenant |

### What this does NOT allow

- Student enrolling another student (student_id must match auth.uid)
- Enrollment in draft or archived courses (status must be published)
- Cross-tenant enrollment (tenant_id check)
- Teacher/admin using this policy (role check)

## Alternatives Considered

### 1. API route with service role key
- **Rejected.** Using service role bypasses RLS entirely, creating a dangerous pattern. Any bug in the API route logic could expose data. RLS should be the security boundary, not application code.

### 2. RPC function (SECURITY DEFINER)
- **Considered but unnecessary.** An RPC function adds indirection without benefit here. The INSERT is simple and the policy guards are sufficient. Reserve RPC for complex operations like `claim_session_turn`.

### 3. Modify existing `enrollments_insert` to include student
- **Rejected.** Adding student to the existing policy would create ambiguity — the teacher/admin policy has different semantics (they enroll others). Separate policies with clear names are more maintainable and auditable.

## Consequences

- The existing `enrollments_insert` policy remains unchanged (teacher/admin enrollment workflow)
- A new policy `enrollments_student_self_enroll` is added alongside it
- The `UNIQUE(student_id, course_id)` constraint already prevents duplicate enrollments
- Story 2.5 can use a standard Supabase client INSERT (no service role needed)
- The `published` status check in the policy provides defense-in-depth (even if the UI only shows published courses, the DB enforces it)

## Implementation

### 1. Add to architecture.md (Section 10.3, after ENROLLMENTS block)

```sql
-- Student self-enrollment (ADR-001)
CREATE POLICY enrollments_student_self_enroll ON enrollments FOR INSERT
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND student_id = auth.uid()
    AND auth_user_role() = 'student'
    AND course_id IN (
      SELECT id FROM courses
      WHERE tenant_id = auth_tenant_id()
      AND status = 'published'
    )
  );
```

### 2. Add to Supabase migration (Story 2.5)

The migration file should include this policy alongside the enrollment feature implementation.

### 3. Testing requirements

- Student CAN enroll in a published course within own tenant
- Student CANNOT enroll in a draft course
- Student CANNOT enroll in a course from another tenant
- Student CANNOT enroll another student (student_id mismatch)
- Duplicate enrollment returns unique constraint error (not RLS error)
- Teacher/admin enrollment via existing policy still works

---

*ADR by Aria (Architect Agent) — eximIA Academy*
