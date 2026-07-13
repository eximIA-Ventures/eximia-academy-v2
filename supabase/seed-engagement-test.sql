-- =============================================================================
-- SEED: Manager Team Engagement Dashboard — 3 buckets, visible & idempotent
-- =============================================================================
-- PURPOSE
--   Populate the Manager Team Dashboard (getTeamEngagementBuckets, in
--   apps/web/src/lib/engagement-helpers.ts) so the manager `manager@a.com` sees
--   the three actionable buckets — ACESSARAM / DEVENDO / INATIVOS — filled with
--   real students, each landing in a bucket for a *documented* reason.
--
-- LOGIN (local dev)
--   Manager : manager@a.com  /  password: 123456
--   (all seeded users share the password 123456 — see supabase/seed.sql,
--    extensions.crypt('123456', extensions.gen_salt('bf'))).
--
-- ---------------------------------------------------------------------------
-- ⚠️  HARD PREREQUISITE — EPIC-30 subtree objects (see NOTE below)
-- ---------------------------------------------------------------------------
--   getTeamEngagementBuckets resolves the team through
--   getManagedTeamStudentIds(..., { includeSubtree: true }), which calls the RPC
--   auth_reachable_student_ids(). On the branch feat/manager-engagement-dashboard
--   the EPIC-30 migration that CREATES that RPC (and the users.reports_to column)
--   was NEVER committed — commit f572414 states "nenhuma migration ... a schema
--   já está aplicada em prod". So a fresh `supabase db reset` locally does NOT
--   have it, and the dashboard would return EMPTY buckets no matter what data we
--   seed. To make this seed self-sufficient for LOCAL testing, PART 0 below
--   creates a faithful, idempotent version of the three EPIC-30 RPCs
--   (auth_reachable_student_ids, auth_subtree_user_ids, subtree_student_ids) and
--   the users.reports_to column, matching the generated types
--   (packages/database/src/types/supabase.ts) and the D2 "UNION ALWAYS" contract
--   documented in area-context.ts. These are created with CREATE OR REPLACE /
--   ADD COLUMN IF NOT EXISTS, so they are harmless if prod ever backfills a real
--   migration.
--
-- ---------------------------------------------------------------------------
-- EXPECTED RESULT (what the manager should see after applying this seed)
-- ---------------------------------------------------------------------------
--   Team "Time de Teste" (owner = manager@a.com) has EXACTLY 4 students:
--
--   BUCKET      COUNT  STUDENTS                    WHY
--   ─────────── ─────  ──────────────────────────  ───────────────────────────
--   ACESSARAM     1    student@a.com  (Student U.)  session 2 days ago, owes
--                                                    nothing (days<=5, not behind)
--   DEVENDO       1    student2@a.com (Ana Silva)   TWO reasons, both labelled:
--                                                    (a) sem_atividade_recente —
--                                                        session 9 days ago
--                                                        (5<days<=14)
--                                                    (b) atras_cronograma —
--                                                        enrolled 20d ago in a
--                                                        deadline_days=30 course
--                                                        with progress=10%
--                                                        (expected ~67%)
--   INATIVOS      2    student3@a.com (Carlos S.)   session 20 days ago (>14)
--                      student4@a.com (Beatriz L.)  ZERO sessions ever
--
--   SUMMARY: accessedCount=1, devendoCount=1, inativosCount=2, teamTotal=4.
--   (Priority is inativos > devendo > accessed, so counts sum to teamTotal.)
--
-- NOTE ON THE DUAL LABEL: student2 (DEVENDO) is deliberately built to carry BOTH
--   devendoReasons — ["sem_atividade_recente","atras_cronograma"] — so the UI's
--   double-reason rendering is exercised. student@a.com is kept a CLEAN ACESSARAM
--   (recent + no behind enrollment) for contrast.
--
-- ---------------------------------------------------------------------------
-- IDEMPOTENCY
--   Safe to run repeatedly and after `supabase db reset`. Uses fixed UUIDs +
--   DELETE-then-INSERT for the mutable rows (sessions / test enrollments /
--   group membership) and ON CONFLICT for the group, so re-running always
--   converges to the same state. All timestamps are relative to now() so the
--   day-deltas stay correct however long after seeding you test.
--
-- APPLY (Docker/local Supabase, db port 54322 per supabase/config.toml):
--   psql "postgresql://postgres:postgres@localhost:54322/postgres" \
--     -f supabase/seed-engagement-test.sql
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Real IDs pinned from supabase/seed.sql (do NOT invent — these already exist):
--   tenant Demo   : 11111111-1111-1111-1111-111111111111
--   manager@a.com : bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb   (role=manager)
--   student@a.com : dddddddd-dddd-dddd-dddd-dddddddddddd   (role=student)
--   student2@a.com: dddddddd-dddd-dddd-dddd-dddddddddd02   (Ana Silva)
--   student3@a.com: dddddddd-dddd-dddd-dddd-dddddddddd03   (Carlos Santos)
--   student4@a.com: dddddddd-dddd-dddd-dddd-dddddddddd04   (Beatriz Lima)
--   Course 1 (IA) : eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee   (published)
--     ch1         : ffffffff-ffff-ffff-ffff-ffffffffffff
--     ch1 q1      : 11110001-0001-0001-0001-000000000001
--   Course 3 (onb): 33333333-3333-3333-3333-333333333333   (published)
--   Course 2 (Lid): 22222222-2222-2222-2222-222222222222   (published)
--     c2 ch1      : c2c10000-0000-0000-0000-000000000001
--     c2 ch1 q1   : 22220001-0001-0001-0001-000000000001
-- ---------------------------------------------------------------------------

-- =============================================================================
-- PART 0 — EPIC-30 subtree objects (LOCAL prerequisite; see header NOTE).
--   Faithful to production semantics: auth_reachable_student_ids() = the caller's
--   reports_to subtree students UNION the members of every manager_group the
--   caller (or a descendant) owns, minus the caller. For local test purposes the
--   dominant path is the manager_group membership, which is all this seed relies
--   on. SECURITY DEFINER + auth.uid() exactly like the shipped prod functions.
--   If prod backfills a real migration later, CREATE OR REPLACE just re-declares
--   the same signatures — no conflict.
-- =============================================================================

-- users.reports_to (organograma edge). Nullable self-FK; absent on this branch.
ALTER TABLE users ADD COLUMN IF NOT EXISTS reports_to UUID REFERENCES users(id) ON DELETE SET NULL;

-- (0a) auth_subtree_user_ids() — the user nodes the caller may focus on:
--      the caller + everyone in their reports_to subtree.
CREATE OR REPLACE FUNCTION auth_subtree_user_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH RECURSIVE sub AS (
    SELECT id FROM users WHERE id = auth.uid()
    UNION
    SELECT u.id FROM users u JOIN sub s ON u.reports_to = s.id
  )
  SELECT id FROM sub;
$$;

COMMENT ON FUNCTION auth_subtree_user_ids() IS
  'LOCAL SEED shim (EPIC-30): user nodes in the caller reports_to subtree (incl. self).';

-- (0b) subtree_student_ids(_node) — students under a given node (node's subtree),
--      role=student only. Used by the E9 drill-down (getSubtreeStudentIdsAtNode).
CREATE OR REPLACE FUNCTION subtree_student_ids(_node UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH RECURSIVE sub AS (
    SELECT id FROM users WHERE id = _node
    UNION
    SELECT u.id FROM users u JOIN sub s ON u.reports_to = s.id
  )
  SELECT u.id
  FROM users u
  WHERE u.role = 'student'
    AND (
      u.id IN (SELECT id FROM sub)
      OR u.id IN (
        SELECT mgm.student_id
        FROM manager_group_members mgm
        JOIN manager_groups mg ON mg.id = mgm.group_id
        WHERE mg.manager_id IN (SELECT id FROM sub)
      )
    );
$$;

COMMENT ON FUNCTION subtree_student_ids(UUID) IS
  'LOCAL SEED shim (EPIC-30): students in _node subtree UNION descendant manager_group members.';

-- (0c) auth_reachable_student_ids() — the D2 UNION ALWAYS set for the AUTH caller:
--      students in the caller reports_to subtree UNION the members of every
--      manager_group owned by the caller or any descendant, excluding the caller.
CREATE OR REPLACE FUNCTION auth_reachable_student_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH RECURSIVE sub AS (
    SELECT id FROM users WHERE id = auth.uid()
    UNION
    SELECT u.id FROM users u JOIN sub s ON u.reports_to = s.id
  )
  SELECT DISTINCT sid FROM (
    -- students inside the reports_to subtree
    SELECT u.id AS sid
    FROM users u
    WHERE u.role = 'student' AND u.id IN (SELECT id FROM sub)
    UNION
    -- members of every manager_group owned by the caller or a descendant
    SELECT mgm.student_id AS sid
    FROM manager_group_members mgm
    JOIN manager_groups mg ON mg.id = mgm.group_id
    WHERE mg.manager_id IN (SELECT id FROM sub)
  ) reachable
  WHERE sid <> auth.uid();
$$;

COMMENT ON FUNCTION auth_reachable_student_ids() IS
  'LOCAL SEED shim (EPIC-30): reports_to-subtree students UNION descendant manager_group members, minus the caller.';

-- =============================================================================
-- PART 1 — Course deadline (enables the 'atras_cronograma' pace criterion).
--   getTeamEngagementBuckets only flags "behind" for a course with a NON-NULL,
--   POSITIVE deadline_days. Course 2 (Liderança) is used as the deadline course
--   so student2's behind-schedule enrollment is measurable.
-- =============================================================================
UPDATE courses
SET deadline_days = 30
WHERE id = '22222222-2222-2222-2222-222222222222'   -- Course 2 (Liderança, published)
  AND tenant_id = '11111111-1111-1111-1111-111111111111';

-- =============================================================================
-- PART 2 — Manager team ("Time de Teste") + its 4 members.
--   The manager OWNS this group (manager_id = manager@a.com), which is what
--   auth_reachable_student_ids() fans out over. Fixed UUIDs → idempotent.
-- =============================================================================
INSERT INTO manager_groups (id, tenant_id, manager_id, name, slug, description, is_corporate, created_by)
VALUES (
  'a5a5a5a5-0000-0000-0000-00000000e001',
  '11111111-1111-1111-1111-111111111111',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'Time de Teste',
  'time-de-teste',
  'Time semeado para validar o dashboard de engajamento do gestor.',
  false,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
)
ON CONFLICT (id) DO UPDATE
  SET manager_id  = EXCLUDED.manager_id,
      name        = EXCLUDED.name,
      description = EXCLUDED.description,
      is_corporate = EXCLUDED.is_corporate,
      updated_at  = now();

-- Rebuild membership deterministically (idempotent): clear then add the 4.
DELETE FROM manager_group_members WHERE group_id = 'a5a5a5a5-0000-0000-0000-00000000e001';

INSERT INTO manager_group_members (id, group_id, student_id, tenant_id, added_by) VALUES
  ('a5a5a5a5-1111-0000-0000-00000000e001', 'a5a5a5a5-0000-0000-0000-00000000e001', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  ('a5a5a5a5-1111-0000-0000-00000000e002', 'a5a5a5a5-0000-0000-0000-00000000e001', 'dddddddd-dddd-dddd-dddd-dddddddddd02', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  ('a5a5a5a5-1111-0000-0000-00000000e003', 'a5a5a5a5-0000-0000-0000-00000000e001', 'dddddddd-dddd-dddd-dddd-dddddddddd03', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  ('a5a5a5a5-1111-0000-0000-00000000e004', 'a5a5a5a5-0000-0000-0000-00000000e001', 'dddddddd-dddd-dddd-dddd-dddddddddd04', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

-- =============================================================================
-- PART 3 — Sessions that materialize each bucket (recency = MAX(created_at)).
--   Rebuild deterministically: delete this seed's sessions (fixed ids) then
--   re-insert with created_at anchored to now() - INTERVAL, so day-deltas are
--   stable no matter WHEN the seed runs. student4 gets NO session on purpose.
--   question_id is nullable (20260317000000) but we use real question ids.
--   NOTE: `sessions` has a trigger-managed updated_at; we also stamp created_at.
-- =============================================================================
DELETE FROM sessions WHERE id IN (
  'e9e50001-0000-0000-0000-000000000001',  -- student  (ACESSARAM)
  'e9e50002-0000-0000-0000-000000000001',  -- student2 (DEVENDO)
  'e9e50003-0000-0000-0000-000000000001'   -- student3 (INATIVOS)
);

INSERT INTO sessions (id, student_id, chapter_id, question_id, tenant_id, status, interactions_remaining, turn_number, created_at, updated_at) VALUES
  -- student@a.com — 2 days ago → ACESSARAM (days<=5, no behind enrollment).
  ('e9e50001-0000-0000-0000-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddddd',
   'ffffffff-ffff-ffff-ffff-ffffffffffff', '11110001-0001-0001-0001-000000000001',
   '11111111-1111-1111-1111-111111111111', 'completed', 14, 6, now() - INTERVAL '2 days', now() - INTERVAL '2 days'),
  -- student2@a.com — 9 days ago → DEVENDO reason (a) sem_atividade_recente (5<days<=14).
  ('e9e50002-0000-0000-0000-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddd02',
   'c2c10000-0000-0000-0000-000000000001', '22220001-0001-0001-0001-000000000001',
   '11111111-1111-1111-1111-111111111111', 'completed', 14, 6, now() - INTERVAL '9 days', now() - INTERVAL '9 days'),
  -- student3@a.com — 20 days ago → INATIVOS (days>14).
  ('e9e50003-0000-0000-0000-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddd03',
   'ffffffff-ffff-ffff-ffff-ffffffffffff', '11110001-0001-0001-0001-000000000001',
   '11111111-1111-1111-1111-111111111111', 'completed', 14, 6, now() - INTERVAL '20 days', now() - INTERVAL '20 days');
  -- student4@a.com — INTENTIONALLY no session → INATIVOS (0 sessions ever).

-- =============================================================================
-- PART 4 — Behind-schedule enrollment → DEVENDO reason (b) atras_cronograma.
--   Pace math (manager-dashboard-page.tsx, copied by engagement-helpers.ts):
--     elapsed  = (now - enrollment.created_at) in days  ≈ 20
--     expected = min(100, round(elapsed / deadline_days * 100))
--              = round(20/30*100) = 67
--     behind   = progress.percentage (10) < expected (67)  → TRUE
--   So student2 is behind on Course 2 (deadline_days=30). Together with the
--   9-day-old session (reason a) student2 carries BOTH devendoReasons.
--
--   student@a.com already has an ACTIVE Course-2 enrollment from base seed
--   (e0e00001-...-01, progress '{}'). We DELETE the seed's own test enrollment id
--   then rebuild student2's Course-2 enrollment with the aged created_at +
--   progress. student2 had NO Course-2 enrollment in base seed, so we upsert on
--   the (student_id, course_id) UNIQUE constraint to stay idempotent.
--
--   IMPORTANT: we also normalize student@a.com's Course-2 enrollment so it is
--   NOT behind (recent created_at, healthy progress), keeping them a CLEAN
--   ACESSARAM (contrast case). Their Course-1/Course-3 enrollments are left as-is.
-- =============================================================================

-- student2 — behind-schedule enrollment on Course 2 (deadline course).
INSERT INTO enrollments (id, student_id, course_id, tenant_id, status, progress, created_at, updated_at)
VALUES (
  'e9e50002-0002-0000-0000-000000000002',
  'dddddddd-dddd-dddd-dddd-dddddddddd02',
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'active',
  '{"percentage": 10}'::jsonb,
  now() - INTERVAL '20 days',
  now()
)
ON CONFLICT (student_id, course_id) DO UPDATE
  SET status     = 'active',
      progress   = '{"percentage": 10}'::jsonb,
      created_at = now() - INTERVAL '20 days',
      updated_at = now();

-- student@a.com — keep Course-2 enrollment NOT behind (recent + healthy progress)
-- so they stay a clean ACESSARAM. (Base seed created it with progress '{}'.)
UPDATE enrollments
SET status     = 'active',
    progress   = '{"percentage": 90}'::jsonb,
    created_at = now() - INTERVAL '2 days',
    updated_at = now()
WHERE student_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
  AND course_id  = '22222222-2222-2222-2222-222222222222'
  AND tenant_id  = '11111111-1111-1111-1111-111111111111';

-- student3 & student4 stay in INATIVOS regardless of enrollments (priority
-- inativos > devendo > accessed), so no enrollment tweaks are needed for them.

COMMIT;

-- =============================================================================
-- QUICK VERIFY (optional — run as the postgres superuser; bypasses RLS/auth):
--   -- team membership:
--   SELECT u.email FROM manager_group_members m
--   JOIN users u ON u.id = m.student_id
--   WHERE m.group_id = 'a5a5a5a5-0000-0000-0000-00000000e001' ORDER BY u.email;
--   -- last activity per team student:
--   SELECT u.email,
--          (now() - max(s.created_at))::text AS since_last_session,
--          count(s.id) AS sessions
--   FROM users u
--   LEFT JOIN sessions s ON s.student_id = u.id
--   WHERE u.id IN ('dddddddd-dddd-dddd-dddd-dddddddddddd',
--                  'dddddddd-dddd-dddd-dddd-dddddddddd02',
--                  'dddddddd-dddd-dddd-dddd-dddddddddd03',
--                  'dddddddd-dddd-dddd-dddd-dddddddddd04')
--   GROUP BY u.email ORDER BY u.email;
-- Expected: ACESSARAM=1 (student), DEVENDO=1 (student2, dual reason),
--           INATIVOS=2 (student3 20d, student4 0 sessions).
-- =============================================================================
