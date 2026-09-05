# Demo Tenant "Vértice Indústria" — Inventory + Rollback

> Created 2026-07-29 for Hugo's mastermind (Thiago Otto) demo, ~3h lead time.
> Authorization: explicit, from the spawning agent's mission brief — write scoped
> strictly to a NEW, isolated tenant inside the shared production Supabase project
> `vaguswivhqnlbgqvnjch` (same project that serves `argos.eximiaacademy.com.br`
> and the real Cory Alimentos tenant). No DDL was run. No RLS/policy/schema
> change was made. This is data seeding only, via `service_role` REST calls that
> bypass RLS by design (equivalent to what any first-party seed script does).

## Scripts

- `scripts/demo-tenant-vertice-seed.mjs` — Phases 0-4 (tenant, areas,
  departments, 128 fictitious identities, manager_groups/reports_to, Hugo demo
  account + login proof, course content copy). Ran to completion on the second
  attempt (first attempt failed on a real live-schema divergence — see
  "Findings" below — and was cleanly rolled back before retry; second attempt
  hit an email-collision bug in the name generator, also cleanly rolled back).
- `scripts/demo-tenant-vertice-phase5.mjs` — Phase 5 (movement/numbers:
  enrollments, sessions, slide_reflections, user_gamification, last_seen_at)
  + Phase 6 (verification). Written as a separate resume script because the
  first full run crashed on a temporal-dead-zone bug (`REFLECTION_TEXTS` used
  before its `const` declaration) AFTER Phases 0-4 had already committed
  successfully — re-running the full script would have DOUBLED the population,
  so this script re-queries the already-created tenant state instead of
  recreating it.

Both scripts are idempotent-safe to re-read (they query before writing where
it matters: tenant-by-slug, Hugo-by-email, enrollments-exist-yet), but are
**not** designed for a full third run from scratch without re-checking Phase 2
idempotency first (see "Known limitation" below).

## Findings recorded during Phase 0 reconnaissance

1. **`public.users.id` → `auth.users.id` FK confirmed** (`ON DELETE CASCADE`).
   Every fictitious identity required a real `auth.users` row via the GoTrue
   Admin API (`POST /auth/v1/admin/users`), not just a `public.users` insert.
2. **Live schema diverges from the migration files** in ways that matter for
   any future seed/migration work on this tenant (consistent with the
   documented divergence pattern already known for `user_roles` /
   `epic30_user_roles.sql`):
   - `tenants` has **no `mode` column** in production (migration file has one).
     Also `plan` accepts `'standard'` in practice even though the migration's
     CHECK constraint text says `('free','pro','enterprise')` — the constraint
     itself does not appear to be enforced live.
   - `courses` has **no `mode` column** either; it has `type` (default
     `'regular'`) instead, plus `cover_image_url`, `video_url`, `audio_url`,
     `content_blocks`, `key_concepts`, `estimated_reading_time_min` not present
     in the original migration.
   - `sessions.question_id` is **nullable** in production (migration says
     `NOT NULL`). This meant the legacy `questions` table never needed to be
     copied for this seed — sessions reference `chapter_id` only.
   - `chapters` carries several extra live columns not in the migration
     (`video_url`, `audio_url`, `content_blocks`, `created_by`, `key_concepts`,
     `estimated_reading_time_min`, `interaction_type`, `bloom_target`,
     `slide_audio_url`, `interaction_config`) — `interaction_type` in
     particular looks load-bearing for rendering (`'socratic_dialogue'` vs the
     slide-based chapters), so it was preserved on copy.
   - `manager_groups` has an extra `parent_group_id` column (group hierarchy)
     not in its migration file. Left `NULL` for the new groups — not required
     for this seed.
3. **Source course 2** (`e435ef0c-858e-44fb-9af9-6393ad0a7eb4`, "Trilha Demo:
   Fundamentos de Onboarding") has **10 chapter title shells with ZERO
   `chapter_slides` and ZERO `questions`** — there is no real renderable content
   to copy. It was copied structurally (titles, order, `estimated_reading_time_min`)
   and renamed to **"Onboarding Vértice: Integração e Cultura"**, and most
   users were enrolled in it with a plausible progress number, but there is
   nothing to click into. **Recommendation for the live demo: steer the
   walkthrough to Course 1** ("Análise e Solução de Problemas", 8 chapters,
   92 slides, fully renderable), and only mention Course 2 as "a segunda
   trilha, ainda em produção de conteúdo" if it comes up.

## Inventory (tenant `Vértice Indústria`)

| Field | Value |
|---|---|
| `tenants.id` | `ec814e94-0a84-48ec-ae2a-4f46c8ef21c4` |
| `tenants.slug` | `vertice-industria` |
| Areas (UNIDADEs) | Ribeirão Preto (53 pessoas), Uberlândia (37), Curitiba (28), Recife (11) |
| Departments | Produção, Qualidade, Manutenção, Logística, Administrativo — each linked to all 4 unidades via `department_areas` |
| Users | **129 total**: 120 `student`, 6 `manager`, 2 `instructor`, 1 `admin` (Hugo's demo account, additionally holds `manager`/`instructor`/`student` hats via `user_roles`) |
| `manager_groups` | 6 (4 unit-scoped teams + 2 corporate teams spanning 2 units each), with `reports_to` (organograma) and `manager_group_members` (team-based) both populated |
| Courses | 2: **"Análise e Solução de Problemas"** (`b1ea89e7-4947-4c80-8958-e8edfaa4a95e`, 8 chapters, 92 slides — full content) and **"Onboarding Vértice: Integração e Cultura"** (`eeba5e86-b45a-4c68-b58d-8218679c33d2`, 10 chapters, 0 slides — shell) |
| Enrollments | 248 (129 in course 1 = 100%; 119 in course 2 = 92%) |
| Sessions | 841 |
| `slide_reflections` | 316 (real Portuguese text, contextual to the course content — not lorem ipsum) |
| `user_gamification` | 129 rows, XP range 0–8,991 (top and bottom both populated for the ranking view) |
| `last_seen_at` buckets | 90 within 5 days ("no ritmo"), 1 between 5–14 days, 26 over 14 days ("sem acesso"), 12 never ("nunca acessou") — ~70% active within 14 days |
| Cory Alimentos (`a9d56b85-ee0e-4295-8db2-5fbcb3fd7a32`) | **51 users, unchanged** (verified before and after) |
| exímIA Academy (`8d45bcf4-ed2f-408d-a1af-0ee1fc6a3bea`) | source of course copy — read-only, 2 courses, unchanged |

All fictitious `public.users` rows (and Hugo's demo account) were written with
**`is_test = true`**, which is the existing schema signal for exactly this
kind of non-production identity — any future cleanup/reporting query can
filter on it directly instead of needing this doc.

## Hugo's demo account

- Email: `hugocapitelli+demo@gmail.com`
- Password: unchanged from what was specified in the mission brief (not
  reprinted here per the "never print credentials" constraint)
- `users.role = 'admin'`; `user_roles` holds `admin`, `manager`, `instructor`,
  `student`
- Enrolled in both courses
- Login proof: `POST /auth/v1/token?grant_type=password` → **HTTP 200**
  (re-verified in the Phase 5/6 run, not just the original Phase 3 check)

## Rollback (full removal of the demo tenant, dependency-safe order)

Nothing here touches Cory or exímIA Academy — every statement is scoped by
`tenant_id = 'ec814e94-0a84-48ec-ae2a-4f46c8ef21c4'` (or cascades from it).
`tenants` and `public.users` both have `ON DELETE CASCADE` from their parents,
so in practice **step 1 alone cascades almost everything** — the explicit
child deletes below are for auditability and for the one thing that does
*not* cascade automatically: the `auth.users` identities.

```sql
-- 1. Delete the tenant row. Cascades (ON DELETE CASCADE, tenant_id FK) to:
--    users, areas, departments, department_areas, manager_groups,
--    manager_group_units, manager_group_members, courses, chapters,
--    chapter_slides, enrollments, sessions, slide_reflections,
--    user_gamification, user_areas (via users cascade), user_departments
--    (via users cascade), user_roles (via users cascade).
DELETE FROM tenants WHERE id = 'ec814e94-0a84-48ec-ae2a-4f46c8ef21c4';
```

```js
// 2. Delete the orphaned auth.users identities (NOT covered by the cascade
// above — public.users -> auth.users is the OTHER direction of that FK).
// Run via the GoTrue Admin API, service_role key, one call per id:
//   DELETE {SUPABASE_URL}/auth/v1/admin/users/{id}
// Fetch the id list BEFORE step 1 (e.g. `select id from users where
// tenant_id = 'ec814e94-...'`), since after step 1 they're gone from
// public.users. This project's convention (proven earlier today during
// cleanup of a failed partial run) is a small throwaway script using the
// same rest()/authAdmin() helpers as scripts/demo-tenant-vertice-seed.mjs.
```

**Verification after rollback:**
```
GET tenants?id=eq.ec814e94-0a84-48ec-ae2a-4f46c8ef21c4  -> []
GET users?tenant_id=eq.a9d56b85-ee0e-4295-8db2-5fbcb3fd7a32&select=id  -> length 51 (Cory unaffected)
GET courses?tenant_id=eq.8d45bcf4-ed2f-408d-a1af-0ee1fc6a3bea&select=id -> length 2 (exímIA Academy unaffected)
```

## Known limitation (for whoever re-runs this later)

`demo-tenant-vertice-seed.mjs` Phase 2 (population) is **not** idempotent
against a tenant that already has users — running the full script twice
against the same tenant would create a second batch of 128 identities. If
this tenant needs to be regenerated, either (a) run the rollback above first,
then the full script fresh, or (b) add a Phase 2 guard (check
`users?tenant_id=eq...&select=id&limit=1` before creating) before re-running.
This was not retrofitted today given the 3-hour deadline — the two-script
resume path (seed.mjs + phase5.mjs) was the faster, equally safe path for a
one-time run.
