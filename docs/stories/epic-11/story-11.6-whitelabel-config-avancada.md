# Story 11.6: Whitelabel Config Avancada (Textos, Favicon, Footer)

**Epic:** [Epic 11 — Super Admin, Gestao de Empresas & Whitelabel Pago](../../epics/epic-11-super-admin-whitelabel.md)
**Version:** 1.0
**Created:** 2026-02-08
**Author:** Morgan (PM Agent)
**Status:** Pending
**Story Points:** 5
**Priority:** P1 (Depends on Story 11.5)
**Blocked By:** Story 11.5
**Blocks:** —
**Assigned To:** @dev (Dex)

---

## User Story

**As a** tenant admin with whitelabel enabled,
**I want** my platform customizations to be visible to all my users,
**so that** the platform feels like our own product.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | architecture.md v1.3, Section 6.1 |
| **PRD Ref** | prd.md — FR1 |
| **Screens Ref** | Tela 1 (Login — expandida com whitelabel), Layout |
| **Stack** | Next.js 15, Supabase, RSC, generateMetadata() |
| **DB Tables** | `tenants` (read whitelabel_config) |
| **Files Affected** | Login page, root layout (metadata), platform layout (footer), TenantProvider |
| **Security** | Custom CSS sanitization (XSS prevention) |

---

## Acceptance Criteria

- [ ] **AC1:** Login page exibe `custom_texts.app_name` como titulo principal (fallback: "eximIA Academy")
- [ ] **AC2:** Login page exibe `custom_texts.tagline` abaixo do titulo (fallback: nao exibir)
- [ ] **AC3:** Login page exibe `custom_texts.login_title` como titulo do formulario (fallback: "Entrar")
- [ ] **AC4:** Login page exibe `custom_texts.login_subtitle` abaixo do titulo do form (fallback: nao exibir)
- [ ] **AC5:** Favicon do tenant renderizado via `<link rel="icon">` no `<head>` usando `generateMetadata()` (fallback: `/favicon.ico`)
- [ ] **AC6:** Footer text exibido no bottom do layout `(platform)` (fallback: "© 2026 eximIA Academy")
- [ ] **AC7:** Email de suporte exibido em links de ajuda/contato quando configurado
- [ ] **AC8:** Custom CSS aplicado como `<style>` tag adicional no layout — SANITIZADO para prevenir XSS
- [ ] **AC9:** Todas as customizacoes sao tenant-scoped (tenant A nao ve customizacoes de tenant B)
- [ ] **AC10:** Performance: customizacoes aplicadas server-side (RSC), zero layout shift (CLS = 0)
- [ ] **AC11:** Tenants SEM whitelabel habilitado mostram valores padrao em todos os pontos

#### Technical Notes

---

## CodeRabbit Integration

> CodeRabbit will review: XSS prevention in custom CSS, server-side rendering correctness, fallback values, performance.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1, 2, 3, 4) Update login page with whitelabel texts
  - [ ] Update `apps/web/src/app/(auth)/login/page.tsx`
  - [ ] Fetch tenant by subdomain (before auth — login page is public)
  - [ ] Render custom texts with fallback values
  - [ ] Server Component rendering (no client-side hydration for texts)
  - [ ] Handle case: no tenant found (use defaults)
  - [ ] Handle case: tenant found but whitelabel disabled (use defaults)

- [ ] **Task 2** (AC: 5) Dynamic favicon via generateMetadata
  - [ ] Update `apps/web/src/app/layout.tsx` metadata generation
  - [ ] Resolve tenant from subdomain in `generateMetadata()`
  - [ ] Set `icons.icon` to tenant's favicon_url if whitelabel enabled
  - [ ] Fallback to `/favicon.ico`
  - [ ] Set page title to custom app_name if configured

- [ ] **Task 3** (AC: 6, 7) Add footer component to platform layout
  - [ ] Create `apps/web/src/components/layout/platform-footer.tsx`
  - [ ] Display `footer_text` from whitelabel_config (fallback: "© 2026 eximIA Academy")
  - [ ] Display `support_email` as mailto link when configured
  - [ ] Add footer to `(platform)/layout.tsx` at bottom of content area
  - [ ] Style: subtle, text-text-muted, small font, border-top

- [ ] **Task 4** (AC: 8) Custom CSS injection with sanitization
  - [ ] Create CSS sanitizer utility: `apps/web/src/lib/utils/sanitize-css.ts`
  - [ ] Allowlist approach: only safe CSS properties (colors, fonts, spacing, borders)
  - [ ] Block: `expression()`, `url()` with non-https, `javascript:`, `@import`, `behavior:`, `-moz-binding`
  - [ ] Block: any HTML tags, event handlers
  - [ ] Max length: 5000 characters
  - [ ] Inject sanitized CSS as `<style>` tag in platform layout (after tenant branding vars)

- [ ] **Task 5** (AC: 9, 11) Tenant isolation and defaults
  - [ ] Verify login page only shows current tenant's whitelabel (via subdomain)
  - [ ] Verify platform layout only shows current tenant's footer/CSS
  - [ ] Verify tenants without whitelabel show all default values
  - [ ] Verify newly created tenants (whitelabel_enabled=false) show defaults

- [ ] **Task 6** (AC: 10) Performance validation
  - [ ] Verify all whitelabel rendering is server-side (RSC)
  - [ ] No client-side fetching for whitelabel data on initial render
  - [ ] Measure CLS — must be 0 (no layout shift from whitelabel loading)
  - [ ] Measure LCP — must be < 2s with whitelabel active

---

## Dev Notes

### Login Page Update

```tsx
// apps/web/src/app/(auth)/login/page.tsx — Update
// [Source: Epic 11 architecture]

import { getTenantBySubdomain } from '@/lib/tenant'

export default async function LoginPage() {
  const tenant = await getTenantBySubdomain()

  // Only use whitelabel if feature is enabled
  const wl = tenant?.whitelabel_enabled ? tenant.whitelabel_config : null

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-app">
      <div className="w-full max-w-md space-y-6 p-8">
        <div className="text-center">
          {tenant?.branding?.logo_url && (
            <img src={tenant.branding.logo_url} alt="" className="mx-auto h-12" />
          )}
          <h1 className="text-2xl font-bold text-text-primary">
            {wl?.custom_texts?.app_name || 'eximIA Academy'}
          </h1>
          {wl?.custom_texts?.tagline && (
            <p className="mt-1 text-text-muted">{wl.custom_texts.tagline}</p>
          )}
        </div>

        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold">
              {wl?.custom_texts?.login_title || 'Entrar'}
            </h2>
            {wl?.custom_texts?.login_subtitle && (
              <p className="text-sm text-text-muted">{wl.custom_texts.login_subtitle}</p>
            )}
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

### Dynamic Metadata

```typescript
// apps/web/src/app/layout.tsx — Update generateMetadata()
import { getTenantBySubdomain } from '@/lib/tenant'

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenantBySubdomain()
  const wl = tenant?.whitelabel_enabled ? tenant.whitelabel_config : null

  return {
    title: wl?.custom_texts?.app_name || 'eximIA Academy',
    icons: {
      icon: wl?.favicon_url || '/favicon.ico',
    },
  }
}
```

### CSS Sanitization

```typescript
// apps/web/src/lib/utils/sanitize-css.ts — NEW
// CRITICAL: XSS prevention for custom CSS injection

const BLOCKED_PATTERNS = [
  /expression\s*\(/gi,
  /javascript\s*:/gi,
  /@import/gi,
  /behavior\s*:/gi,
  /-moz-binding/gi,
  /url\s*\(\s*['"]?\s*(?!https:)/gi,  // Block non-HTTPS URLs
  /<[^>]*>/g,  // Block HTML tags
]

const MAX_CSS_LENGTH = 5000

export function sanitizeCSS(css: string): string {
  if (!css || css.length > MAX_CSS_LENGTH) return ''

  let sanitized = css
  for (const pattern of BLOCKED_PATTERNS) {
    sanitized = sanitized.replace(pattern, '/* blocked */')
  }

  return sanitized
}
```

### File Locations

```
apps/web/src/app/
├── (auth)/
│   └── login/
│       └── page.tsx                      # UPDATED: whitelabel texts
├── (platform)/
│   └── layout.tsx                        # UPDATED: footer + custom CSS injection
└── layout.tsx                            # UPDATED: dynamic favicon/title metadata

apps/web/src/components/layout/
└── platform-footer.tsx                   # NEW: footer with whitelabel text

apps/web/src/lib/
├── tenant.ts                             # UPDATED or NEW: getTenantBySubdomain()
└── utils/
    └── sanitize-css.ts                   # NEW: CSS XSS sanitizer
```

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass. Login page renders with and without whitelabel. | Yes |
| Pre-PR | All custom texts appear on login page. Favicon loads correctly. Footer shows in layout. Custom CSS sanitized (XSS blocked). Fallback values for all fields. No layout shift. Tenant isolation. RSC-only rendering. | Yes |

---

## Definition of Done

- [ ] Login page shows whitelabel texts when enabled
- [ ] Login page shows defaults when whitelabel disabled
- [ ] Favicon dynamically set per tenant
- [ ] Footer text visible in platform layout
- [ ] Support email visible when configured
- [ ] Custom CSS sanitized and injected safely
- [ ] All XSS patterns blocked
- [ ] Zero CLS (layout shift) from whitelabel
- [ ] LCP < 2s with whitelabel active
- [ ] Tenant isolation maintained
- [ ] `pnpm lint && pnpm typecheck` pass

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Login page update, metadata, footer, CSS sanitizer |
| **@architect (Aria)** | Security review: CSS sanitization, XSS prevention strategy |
| **@qa (Quinn)** | All customizations render correctly, XSS blocked, fallback values, performance |

---

## Risk Assessment

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| XSS via custom CSS | CRITICAL | Allowlist + blocked patterns. No `url()`, no `expression()`, no `@import`. Max 5000 chars |
| Login page slow due to tenant query | MEDIUM | `getTenantBySubdomain()` uses React `cache()`. Single query, indexed by slug |
| Favicon caching issues | LOW | Supabase Storage has cacheControl. Use query param versioning if needed |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-08 | 1.0 | Story created from Epic 11 architecture | Morgan (PM) |

---

*Story criada por Morgan (PM Agent) — eximIA Academy*
