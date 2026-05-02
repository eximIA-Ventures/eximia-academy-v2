# QA Fix Request — Epics 7 & 8 Security P0

**Generated:** 2026-02-09
**Reviewer:** Quinn (QA Agent)
**Priority:** P0 — Fix before production
**Scope:** 3 CRITICAL + 7 HIGH issues from code review

---

## CRITICAL Fixes

### FIX-C1: Service Role Key Exposed in CI Logs
- **File:** `.github/workflows/e2e.yml`
- **Fix:** Add `::add-mask::` before echoing keys to `$GITHUB_OUTPUT`

### FIX-C2: SERVICE_ROLE_KEY No Guard in E2E Seed
- **File:** `tests/e2e/helpers/seed.ts`
- **Fix:** Throw if key is empty

### FIX-C3: SAML Tenant Matching Compares Truthy Not Values
- **File:** `apps/web/src/app/api/auth/callback/route.ts:107-114`
- **Fix:** Compare `sso_provider_id === user.app_metadata?.sso?.issuer`

---

## HIGH Fixes

### FIX-H1: Sentry Header Scrubbing Case-Sensitive
- **Files:** `sentry.client.config.ts`, `sentry.edge.config.ts`, `sentry.server.config.ts`
- **Fix:** Iterate keys with `.toLowerCase()` comparison

### FIX-H2: PostHog Used Before init() / No SSR Guard
- **Files:** `analytics.ts`, `feature-flags.ts`, `posthog-provider.tsx`
- **Fix:** Add `typeof window` + `posthog.__loaded` guards

### FIX-H3: Google OAuth New User Never Created in Users Table
- **File:** `apps/web/src/app/api/auth/callback/route.ts:61-69`
- **Fix:** Add INSERT after tenantId guard

### FIX-H4: SessionTimeoutProvider Uses getSession() Not getUser()
- **File:** `apps/web/src/components/providers/session-timeout-provider.tsx`
- **Fix:** Replace `getSession()` with `getUser()`

### FIX-H5: No CSRF Protection on SSO Admin API
- **File:** `apps/web/src/app/api/admin/sso/route.ts`
- **Fix:** Validate Origin header on mutating requests

---

## Validation Checklist

- [x] `pnpm test` — 204 tests pass
- [x] `pnpm typecheck` — zero errors
- [x] CI workflow masks secrets (`::add-mask::`)
- [x] E2E seed throws on missing key
- [x] SAML tenant matching compares actual provider ID values
- [x] Sentry scrubbing case-insensitive (3 config files)
- [x] PostHog SSR-safe (`typeof window` + `__loaded` guards)
- [x] Google OAuth creates user row (INSERT after tenantId guard)
- [x] SessionTimeout uses `getUser()` (server-validated)
- [x] SSO API validates Origin header (CSRF protection)

---

*— Quinn, guardiao da qualidade*
