# QA Fix Request — Epic 6 Security P0

**Generated:** 2026-02-09
**Reviewer:** Quinn (QA Agent)
**Gate Decision:** PASS WITH CONCERNS (72/100)
**Priority:** P0 — Fix before production
**Assigned To:** @dev (Dex)
**Scope:** 4 CRITICAL security issues found during code review

---

## Issues to Fix

### FIX-1: Open Redirect in Auth Callback
- **Severity:** CRITICAL
- **File:** `apps/web/src/app/api/auth/callback/route.ts`
- **Line:** Parameter `next` extraction + final redirect
- **Problem:** The `next` query parameter is used directly in redirect without validation. Attacker can craft `GET /api/auth/callback?next=https://evil.com` to redirect users to malicious sites after login.
- **Fix:** Validate that `next` is a relative path starting with `/` and does not start with `//`:
  ```typescript
  const next = searchParams.get("next") ?? "/dashboard"
  const safeNext = (next.startsWith("/") && !next.startsWith("//")) ? next : "/dashboard"
  ```
- **Test:** Add test case: `next=https://evil.com` should redirect to `/dashboard`

---

### FIX-2: IP Spoofing in Rate Limiting Middleware
- **Severity:** CRITICAL
- **File:** `apps/web/src/middleware.ts`
- **Line:** IP extraction logic
- **Problem:** Uses first value from `x-forwarded-for` header which is client-controlled. Attacker can bypass rate limits by spoofing: `curl -H "x-forwarded-for: random-ip"`.
- **Fix:** Use the **last** (rightmost) IP in the chain (set by your reverse proxy), not the first:
  ```typescript
  const forwardedFor = request.headers.get("x-forwarded-for")
  const ip = forwardedFor?.split(",").pop()?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown"
  ```
- **Test:** Verify rate limit applies consistently regardless of x-forwarded-for manipulation

---

### FIX-3: XML Injection in SSO Metadata
- **Severity:** CRITICAL
- **File:** `apps/web/src/app/api/admin/sso/route.ts`
- **Line:** Zod schema `metadata_xml` field
- **Problem:** Raw XML is accepted from admin input without XXE/DTD validation. Malicious XML could exploit Supabase's SAML parser.
- **Fix:** Reject XML containing dangerous patterns before forwarding to Supabase:
  ```typescript
  if (metadata_xml) {
    const forbidden = /<!DOCTYPE|<!ENTITY|<\?xml-stylesheet/i
    if (forbidden.test(metadata_xml)) {
      return NextResponse.json(
        { error: "XML metadata contains forbidden patterns (DOCTYPE/ENTITY not allowed)" },
        { status: 400 }
      )
    }
  }
  ```
- **Test:** Add test case: POST with `<!DOCTYPE ...>` should return 400

---

### FIX-4: Privacy Delete Returns 200 on Ban Failure
- **Severity:** CRITICAL
- **File:** `apps/web/src/app/api/privacy/delete/route.ts`
- **Line:** ~115-146
- **Problem:** If `auth.admin.updateUserById` (ban) fails, the endpoint returns 200 OK. This leaves user data soft-deleted but their auth session still active — they can continue logging in.
- **Fix:** Return 207 (Multi-Status) when ban fails, indicating partial failure:
  ```typescript
  if (banError) {
    console.error(JSON.stringify({
      event: "privacy.delete.ban_failed",
      user_id: deleteUserId,
      error: banError.message,
      timestamp: new Date().toISOString(),
    }))
    return NextResponse.json({
      message: "Dados excluidos mas falha ao desativar autenticacao. Contate o administrador.",
      deleted_user_id: deleteUserId,
      deleted_at: now,
      warning: "auth_ban_failed",
    }, { status: 207 })
  }
  ```
- **Test:** Update existing test "logs ban failure but still returns 200" to expect 207

---

## Validation Checklist (for @dev after fixes)

- [x] `pnpm test` — all tests pass (204 tests, including new test cases)
- [x] `pnpm typecheck` — zero errors
- [x] Auth callback: `next` param validated (no external redirects)
- [x] Middleware: IP uses `.pop()` not `[0]` on x-forwarded-for
- [x] SSO route: rejects DOCTYPE/ENTITY in XML metadata
- [x] Privacy delete: returns 207 on ban failure

---

*— Quinn, guardiao da qualidade*
