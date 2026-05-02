# Story 11.5: Feature Gate Whitelabel + Tab no Admin

**Epic:** [Epic 11 — Super Admin, Gestao de Empresas & Whitelabel Pago](../../epics/epic-11-super-admin-whitelabel.md)
**Version:** 1.0
**Created:** 2026-02-08
**Author:** Morgan (PM Agent)
**Status:** Pending
**Story Points:** 5
**Priority:** P1 (Depends on Stories 11.1, 11.3)
**Blocked By:** Stories 11.1, 11.3
**Blocks:** Story 11.6
**Assigned To:** @dev (Dex)

---

## User Story

**As a** tenant admin,
**I want** to see a "Whitelabel" tab in my settings only when the feature is enabled by the platform owner,
**so that** I can customize my platform's branding when I have access to the premium feature.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | architecture.md v1.3, Section 6.1 |
| **PRD Ref** | prd.md — FR1 |
| **Screens Ref** | Tela 11 (Admin Settings — expandida) |
| **Stack** | Next.js 15, Supabase, @eximia/ui (Tabs, Badge, FormField, Input, Button) |
| **DB Tables** | `tenants` (read whitelabel_enabled, write whitelabel_config) |
| **Feature Gate** | `tenant.whitelabel_enabled` — controlled by super admin |
| **API** | `PATCH /api/admin/tenants` — extended with whitelabel_config validation |

---

## Acceptance Criteria

- [ ] **AC1:** Tab "Whitelabel" com Badge "PRO" aparece em `/admin/settings` SOMENTE se `tenant.whitelabel_enabled === true`
- [ ] **AC2:** Se `whitelabel_enabled === false`, tab nao aparece no TabsList e acesso direto via URL ao tab value redireciona para settings default
- [ ] **AC3:** API `PATCH /api/admin/tenants` valida server-side: rejeita campos de `whitelabel_config` se `whitelabel_enabled === false` (status 403)
- [ ] **AC4:** Tab Whitelabel contem formulario com campos:
  - Nome do app (`custom_texts.app_name`) — Input, max 100 chars
  - Tagline (`custom_texts.tagline`) — Input, max 200 chars
  - Titulo da tela de login (`custom_texts.login_title`) — Input, max 50 chars
  - Subtitulo da tela de login (`custom_texts.login_subtitle`) — Textarea, max 200 chars
  - Upload de favicon — file input (accept: .ico, .png, .svg, max 100KB)
  - Texto do footer (`footer_text`) — Input, max 200 chars
  - Email de suporte (`support_email`) — Input, email validation
- [ ] **AC5:** Preview em tempo real na lateral direita mostrando como ficara: login page mockup + footer
- [ ] **AC6:** Salvamento via Server Action com validacao Zod completa
- [ ] **AC7:** Toast de sucesso apos salvar, toast de erro se falhar
- [ ] **AC8:** Valores existentes carregados no formulario ao abrir a tab (edit mode)
- [ ] **AC9:** Botao "Resetar para Padrao" limpa todos os campos whitelabel_config
- [ ] **AC10:** TenantProvider atualizado para incluir `whitelabel_enabled` e `whitelabel_config` no contexto

---

## CodeRabbit Integration

> CodeRabbit will review: feature gate enforcement (frontend + backend), form validation, file upload security, preview accuracy.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1, 2) Add conditional Whitelabel tab to settings
  - [ ] Update `/admin/settings/page.tsx` to check `tenant.whitelabel_enabled`
  - [ ] Add TabsTrigger with Badge "PRO" conditionally rendered
  - [ ] Add TabsContent wrapping WhitelabelSettingsForm
  - [ ] Handle direct URL access when feature is disabled (redirect to general tab)

- [ ] **Task 2** (AC: 4, 5, 8, 9) Create WhitelabelSettingsForm component
  - [ ] Create `apps/web/src/components/admin/whitelabel-settings-form.tsx`
  - [ ] Form fields: app_name, tagline, login_title, login_subtitle, favicon, footer_text, support_email
  - [ ] Load existing whitelabel_config values as defaults
  - [ ] Live preview panel on the right side
  - [ ] "Resetar para Padrao" button (clears all fields, sets config to {})
  - [ ] Use @eximia/ui components: FormField, Input, Textarea, Button, Card

- [ ] **Task 3** (AC: 4) Create FaviconUploader component
  - [ ] Create `apps/web/src/components/admin/favicon-uploader.tsx`
  - [ ] Accept .ico, .png, .svg files (max 100KB)
  - [ ] Upload to Supabase Storage: `{tenantId}/favicon.{ext}`
  - [ ] Show current favicon preview
  - [ ] Delete existing favicon option

- [ ] **Task 4** (AC: 5) Create WhitelabelPreview component
  - [ ] Create `apps/web/src/components/admin/whitelabel-preview.tsx`
  - [ ] Mini login page mockup showing: app_name, tagline, login_title, login_subtitle
  - [ ] Footer preview showing: footer_text
  - [ ] Updates in real-time as user types (controlled form state)

- [ ] **Task 5** (AC: 3, 6, 7) Backend validation and save
  - [ ] Update `PATCH /api/admin/tenants` route to validate whitelabel gate
  - [ ] Zod schema for WhitelabelConfig with all field constraints
  - [ ] Server Action for saving whitelabel config
  - [ ] Return 403 if whitelabel not enabled and whitelabel_config is in payload
  - [ ] Toast notifications (success/error)

- [ ] **Task 6** (AC: 10) Update TenantProvider
  - [ ] Add `whitelabel_enabled` and `whitelabel_config` to tenant context
  - [ ] Update `getAuthProfile()` or tenant query to include new fields
  - [ ] Ensure all consuming components handle new fields gracefully

- [ ] **Task 7** (AC: all) Testing
  - [ ] Test: tab visible when whitelabel_enabled = true
  - [ ] Test: tab hidden when whitelabel_enabled = false
  - [ ] Test: API rejects whitelabel updates when feature disabled
  - [ ] Test: form saves and loads correctly
  - [ ] Test: preview updates in real time
  - [ ] Test: favicon upload works
  - [ ] Test: reset to defaults clears config
  - [ ] Test: existing admin settings (Geral, Marca, AI, Features) unaffected

---

## Dev Notes

### Conditional Tab Rendering

```tsx
// apps/web/src/app/(platform)/admin/settings/page.tsx — Update
// [Source: Epic 11 architecture]

<Tabs defaultValue="general">
  <TabsList>
    <TabsTrigger value="general">Geral</TabsTrigger>
    <TabsTrigger value="branding">Marca</TabsTrigger>
    <TabsTrigger value="ai">Inteligencia Artificial</TabsTrigger>
    <TabsTrigger value="features">Funcionalidades</TabsTrigger>
    {tenant.whitelabel_enabled && (
      <TabsTrigger value="whitelabel">
        Whitelabel <Badge variant="outline" className="ml-1.5 text-xs">PRO</Badge>
      </TabsTrigger>
    )}
  </TabsList>
  {/* ... existing TabsContent ... */}
  {tenant.whitelabel_enabled && (
    <TabsContent value="whitelabel">
      <WhitelabelSettingsForm tenant={tenant} />
    </TabsContent>
  )}
</Tabs>
```

### Backend Gate Validation

```typescript
// apps/web/src/app/api/admin/tenants/route.ts — Update PATCH
// [Source: Epic 11 architecture]

if (body.whitelabel_config) {
  const { data: tenant } = await supabase
    .from('tenants')
    .select('whitelabel_enabled')
    .eq('id', tenantId)
    .single()

  if (!tenant?.whitelabel_enabled) {
    return NextResponse.json(
      { error: 'Whitelabel is not enabled for this tenant' },
      { status: 403 }
    )
  }
}
```

### Zod Schema

```typescript
// packages/shared/src/validators/whitelabel.ts — NEW
import { z } from 'zod'

export const whitelabelConfigSchema = z.object({
  custom_texts: z.object({
    app_name: z.string().max(100).optional(),
    tagline: z.string().max(200).optional(),
    login_title: z.string().max(50).optional(),
    login_subtitle: z.string().max(200).optional(),
  }).optional(),
  favicon_url: z.string().url().nullable().optional(),
  footer_text: z.string().max(200).optional(),
  support_email: z.string().email().optional(),
  custom_css: z.string().max(5000).optional(),
})
```

### File Locations

```
apps/web/src/app/(platform)/admin/settings/
└── page.tsx                              # UPDATED: conditional whitelabel tab

apps/web/src/components/admin/
├── whitelabel-settings-form.tsx          # NEW
├── whitelabel-preview.tsx                # NEW
└── favicon-uploader.tsx                  # NEW

apps/web/src/app/api/admin/tenants/
└── route.ts                              # UPDATED: whitelabel gate validation

apps/web/src/components/providers/
└── tenant-provider.tsx                   # UPDATED: include whitelabel fields

packages/shared/src/validators/
└── whitelabel.ts                         # NEW: Zod schema
```

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass. Tab renders when enabled. Tab hidden when disabled. | Yes |
| Pre-PR | Feature gate works frontend + backend. Form saves correctly. Preview updates live. API rejects when disabled. Favicon uploads. Reset works. Existing settings tabs unaffected. | Yes |

---

## Definition of Done

- [ ] Whitelabel tab visible only when feature enabled
- [ ] Form with all 7 fields works correctly
- [ ] Backend validation rejects updates when feature disabled
- [ ] Favicon upload works via Supabase Storage
- [ ] Live preview updates as user types
- [ ] Reset to defaults clears all config
- [ ] TenantProvider includes whitelabel fields
- [ ] Existing admin settings tabs unaffected
- [ ] `pnpm lint && pnpm typecheck` pass

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Form, preview, API gate, favicon upload, TenantProvider update |
| **@ux-design-expert** | Preview layout, form UX, responsive design |
| **@qa (Quinn)** | Feature gate enforcement, form validation, preview accuracy |

---

## Risk Assessment

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Frontend-only gate bypass | HIGH | Backend validation in PATCH route. Gate checked server-side before accepting whitelabel_config |
| Large favicon upload crashes Storage | LOW | 100KB max file size enforced client + server side |
| Preview does not match actual rendering | MEDIUM | Preview uses same CSS variables and structure as actual layout |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-08 | 1.0 | Story created from Epic 11 architecture | Morgan (PM) |

---

*Story criada por Morgan (PM Agent) — eximIA Academy*
