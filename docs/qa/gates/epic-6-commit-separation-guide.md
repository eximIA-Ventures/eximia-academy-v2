# Epic 6 vs Epic 11 — Commit Separation Guide

## Epic 6 Files (Stories 6.1-6.4 + QA fixes)

### New files (untracked)
```
packages/shared/src/constants/labels.ts          # 6.1: PLATFORM_LABELS replacement
packages/shared/src/__tests__/labels.test.ts      # 6.1: Labels test
apps/web/src/lib/rate-limit.ts                    # 6.3: Rate limiting module
apps/web/src/lib/__tests__/rate-limit.test.ts     # R-2: Rate limit tests
apps/web/src/app/api/privacy/                     # 6.4: LGPD endpoints (export + delete)
supabase/migrations/20260208000001_remove_dual_mode.sql
supabase/migrations/20260208000002_add_user_soft_delete.sql
supabase/migrations/20260208000003_fix_session_null_safety.sql   # R-1
supabase/migrations/20260208000004_lgpd_soft_delete_procedure.sql # R-3
docs/epics/epic-6-simplificacao-seguranca.md
docs/stories/epic-6/
docs/stories/sprint-remove-dual-mode/
docs/qa/gates/epic-6-*.yml
```

### Modified files
```
# Story 6.1 + 6.2: Dual-mode removal
packages/shared/src/index.ts
packages/shared/src/types/models.ts
packages/database/src/schema/courses.ts
packages/database/src/schema/enrollments.ts       # + deleted_at (6.4)
packages/database/src/schema/sessions.ts          # + nullable studentId (C-1 fix)
apps/web/src/components/dashboard/*.tsx            # Remove mode references
apps/web/src/components/dashboard/__tests__/*.tsx  # Update labels
apps/web/src/components/onboarding/onboarding-wizard.tsx
apps/web/src/components/layout/header.tsx
apps/web/src/components/layout/sidebar.tsx
apps/web/src/components/providers/tenant-provider.tsx
apps/web/src/app/(platform)/courses/_components/*.tsx
apps/web/src/app/(platform)/courses/actions.ts
apps/web/src/app/(platform)/courses/page.tsx
apps/web/src/app/(platform)/admin/settings/*
apps/web/src/app/(platform)/admin/users/page.tsx
apps/web/src/app/(platform)/dashboard/page.tsx
apps/web/src/app/onboarding/*
docs/architecture.md

# Story 6.3: Rate limiting
apps/web/src/middleware.ts                        # + rate limiting + C-2 fix
apps/web/package.json                             # + @upstash/ratelimit, @upstash/redis

# Story 6.4: LGPD
apps/web/src/lib/auth.ts
apps/web/src/app/api/admin/users/[userId]/route.ts
apps/web/src/app/api/admin/users/route.ts

# QA fix: vitest alias
apps/web/vitest.config.ts
```

### Deleted files
```
packages/shared/src/__tests__/mode-config.test.ts
packages/shared/src/constants/mode-config.ts      # (if tracked)
apps/web/src/components/dashboard/dual-mode-labels.ts
apps/web/src/components/dashboard/__tests__/dual-mode-labels.test.ts
apps/web/src/components/onboarding/step-experience.tsx
apps/web/src/components/onboarding/step-goals.tsx
apps/web/src/components/onboarding/step-learning-style.tsx
apps/web/src/components/onboarding/step-sector.tsx
apps/web/src/components/onboarding/__tests__/step-experience.test.tsx
apps/web/src/components/onboarding/__tests__/step-goals.test.tsx
apps/web/src/components/onboarding/__tests__/step-learning-style.test.tsx
apps/web/src/components/onboarding/__tests__/step-sector.test.tsx
```

## Epic 11 Files (Super Admin / Whitelabel — separate branch recommended)

### New files
```
apps/web/src/components/super-admin/              # All super-admin UI components
apps/web/src/lib/audit.ts                         # Platform audit log utility
apps/web/src/lib/super-admin-context.ts           # Super admin context provider
apps/web/src/lib/tenant.ts                        # Tenant utility
apps/web/src/lib/utils/                           # Utility functions
packages/database/src/schema/platform-audit-log.ts
packages/shared/src/validators/whitelabel.ts
supabase/migrations/20260209000000_epic11_super_admin_whitelabel.sql
docs/epics/epic-11-super-admin-whitelabel.md
docs/stories/epic-11/
docs/qa/gates/epic-11-super-admin-whitelabel.yml
```

### Modified files (shared with Epic 6 — need careful staging)
```
packages/database/src/schema/tenants.ts           # mode removal (E6) + whitelabel/status (E11)
packages/database/src/schema/users.ts             # deletedAt (E6) + super_admin role + nullable tenantId (E11)
packages/database/src/schema/index.ts             # + platformAuditLog export (E11)
apps/web/src/middleware.ts                         # rate limiting (E6) + super_admin routing (E11)
apps/web/src/app/(auth)/login/page.tsx             # whitelabel login (E11)
apps/web/src/app/(auth)/layout.tsx                 # whitelabel layout (E11)
apps/web/src/app/(platform)/layout.tsx             # super-admin layout check (E11)
apps/web/src/app/layout.tsx                        # whitelabel meta (E11)
apps/web/src/components/admin/role-selector.tsx     # super_admin role option (E11)
apps/web/src/components/admin/user-list.tsx         # super_admin filter (E11)
apps/web/src/components/admin/tenant-settings-form.tsx # whitelabel form (E11)
apps/web/src/lib/navigation.ts                     # super-admin routes (E11)
```

## Other Epics (docs only, no code)
```
docs/epics/epic-7-observabilidade-qualidade.md
docs/epics/epic-8-autenticacao-enterprise.md
docs/epics/epic-9-onboarding-inteligente-personalizacao.md
docs/stories/epic-7/
docs/stories/epic-8/
docs/stories/epic-9/
docs/stories/roadmap-consolidacao.md
docs/qa/gates/epic-7-*.yml
docs/qa/gates/epic-8-*.yml
supabase/migrations/20260209000001_epic9_courses_type.sql
```

## Staging Strategy

Use `git add -p` on shared files (tenants.ts, users.ts, middleware.ts, etc.) to stage only Epic 6 hunks.
Or commit all as a single "Epic 5-6 + Epic 11 WIP" commit and separate later via interactive rebase.
