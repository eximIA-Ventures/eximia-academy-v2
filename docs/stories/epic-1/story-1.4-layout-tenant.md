# Story 1.4: Layout Base e Tenant Resolution

**Epic:** [Epic 1 — Foundation & Auth](../epics/epic-1-foundation-auth.md)
**Version:** 1.0
**Created:** 2026-02-07
**Author:** Morgan (PM Agent)
**Status:** Ready for Review
**Story Points:** 8
**Priority:** P1 (High)
**Blocked By:** 1.2, 1.3
**Assigned To:** @dev (Dex), @architect (Aria) review, @qa (Quinn) validation

---

## User Story

**As a** usuario autenticado,
**I want** ver a interface com branding do meu tenant,
**so that** a experiencia e personalizada para minha instituicao.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture.md` v1.2 — Section 9 (TenantProvider) |
| **Screens Ref** | `docs/screens.md` — Screen 2 (Dashboard) |
| **Design Tokens** | `Benchmarks/Design/design-tokens.json` v1.2.2 |
| **Stack** | Next.js 15 App Router + Tailwind CSS 4 + shadcn/ui |
| **Key Constraint** | Dark theme. Sidebar 200px. Inter font only. |

---

## Design Token Reference

Source of truth: `Benchmarks/Design/design-tokens.json` v1.2.2
> **Nota:** Tokens usam estrutura `{value, description}`. Paths abaixo sao canonicos do JSON.

### Backgrounds (`colors.backgrounds.*`)
| Token Path | Value | Usage |
|------------|-------|-------|
| `colors.backgrounds.app.value` | `#0f0f0f` | Page background |
| `colors.backgrounds.sidebar.value` | `#111111` | Sidebar background |
| `colors.backgrounds.surface.value` | `#1a1a1a` | Content surface |
| `colors.backgrounds.card.value` | `#1e1e1e` | Cards |
| `colors.backgrounds.elevated.value` | `#242424` | Modals, dropdowns |
| `colors.backgrounds.hover.value` | `#2a2a2a` | Hover states |

### Text (`colors.text.*`)
| Token Path | Value | Usage |
|------------|-------|-------|
| `colors.text.primary.value` | `#ffffff` | Main text |
| `colors.text.secondary.value` | `#a0a0a0` | Secondary text, user info |
| `colors.text.muted.value` | `#666666` | Placeholder only |
| `colors.text.inactive.value` | `#888888` | Inactive nav items |

### Accent (`colors.accent.*`)
| Token Path | Value | Usage |
|------------|-------|-------|
| `colors.accent.blue.mid.value` | `#2a6ab0` | Links, focus ring, active states |
| `colors.accent.blue.default.value` | `#1a4a8a` | Primary blue accent |
| `colors.accent.blue.light.value` | `#4a8ad0` | Highlights |

### Layout (from `components.*` and `layout.*`)
| Token Path | Value |
|------------|-------|
| `components.sidebar.width` | `200px` |
| `components.sidebar.backgroundColor` | `#111111` |
| `components.topbar.height` | `56px` |
| `components.topbar.backgroundColor` | `#0f0f0f` |
| `layout.topbar.height` | `56px` |

> **Implementation notes (not in tokens — define during dev):**
> - Sidebar collapsed width: `60px` (implementation decision)
> - Content area padding: `1.5rem` (implementation decision)

### Focus & Accessibility
| Token Path | Value |
|------------|-------|
| `focusRing.color` | `#2a6ab0` |
| `focusRing.width` | `2px` |
| `focusRing.offset` | `2px` |

### Borders & Radius
| Token Path | Value |
|------------|-------|
| `border.radius.sm.value` | `6px` |
| `border.radius.md.value` | `12px` |
| `border.radius.lg.value` | `18px` |
| `border.radius.xl.value` | `24px` |
| `border.color.subtle` | `rgba(255, 255, 255, 0.06)` |
| `border.color.default` | `rgba(255, 255, 255, 0.1)` |

### Typography
| Token Path | Value |
|------------|-------|
| `typography.fontFamily.primary` | `Inter` |
| `typography.fontSize.sm` | `0.875rem` |
| `typography.fontSize.base` | `1rem` |
| `typography.fontSize.lg` | `1.125rem` |

### Breakpoints
| Token Path | Value |
|------------|-------|
| `breakpoints.sm` | `640px` |
| `breakpoints.md` | `768px` |
| `breakpoints.lg` | `1024px` |
| `breakpoints.xl` | `1280px` |

### Z-Index
| Token Path | Value |
|------------|-------|
| `zIndex.sidebar` | `20` |
| `zIndex.dropdown` | `30` |
| `zIndex.modal` | `40` |

---

## Acceptance Criteria

- [ ] **AC1:** Layout principal com sidebar (200px fixed, collapsivel a 60px) + header (56px) + area de conteudo
  - Sidebar fixa a esquerda, content area ocupa resto
  - Header (topbar) fixo no topo com logo, user info, logout
  - Content area com padding `1.5rem`

- [ ] **AC2:** Sidebar exibe navegacao por role:

  | Role | Menu Items |
  |------|-----------|
  | **Student** | Dashboard, Cursos (browse) |
  | **Teacher** | Dashboard, Meus Cursos (manage) |
  | **Manager** | Dashboard, Analytics |
  | **Admin** | Dashboard, Configuracoes, Usuarios |

  - Active item: accent-blue-mid background
  - Icons para cada item (Lucide icons via shadcn)

- [ ] **AC3:** Header exibe logo do tenant, nome do usuario e botao de logout
  - Logo: max-height 32px (token `components.topbar.logo.maxHeight`)
  - User info: font 0.875rem, color #a0a0a0
  - Logout button: font 0.875rem, hover #ffffff
  - Border bottom: `1px solid rgba(255, 255, 255, 0.06)`

- [ ] **AC4:** Tenant resolution via subdomain (ex: `demo.eximia.academy`)
  - Middleware extrai subdomain e injeta `x-tenant-slug` header
  - TenantProvider disponibiliza dados do tenant via React Context
  - Fallback: query param `?tenant=demo` para desenvolvimento local

- [ ] **AC5:** Branding do tenant (logo, cor primaria) aplicado via CSS variables
  - `--tenant-primary`: cor primaria do tenant (default: `#2a6ab0`)
  - `--tenant-logo`: URL do logo do tenant
  - CSS variables injetadas no `<html>` ou provider

- [ ] **AC6:** Dashboard placeholder com mensagem de boas-vindas e role do usuario
  - "Bem-vindo, {full_name}!" heading
  - "Voce esta logado como {role}" subtitle
  - Card com informacoes do tenant (nome, modo)

- [ ] **AC7:** Responsivo: sidebar colapsa em mobile para hamburger menu
  - Breakpoint: `< 768px` (md) → sidebar hidden, hamburger button no header
  - Sidebar abre como overlay em mobile
  - Click outside ou no item → fecha sidebar

- [ ] **AC8:** Fallback para tema padrao se tenant nao tem branding customizado
  - Cores default: design tokens v1.2.2
  - Logo default: eximIA Academy logo
  - Branding JSONB vazio ou null → usa defaults

- [ ] **AC9:** Design tokens aplicados conforme `Benchmarks/Design/design-tokens.json` v1.2.2
  - Todas as cores, spacings, borders, radius, typography conforme tokens
  - Focus ring: 2px solid #2a6ab0 (WCAG 2.4.7)
  - Font: Inter only

---

## Technical Implementation Guide

### TenantProvider

```typescript
// apps/web/src/components/providers/tenant-provider.tsx
'use client'

import { createContext, useContext } from 'react'

interface TenantData {
  id: string
  name: string
  slug: string
  mode: 'university' | 'corporate'
  branding: {
    logo?: string
    primaryColor?: string
    accentColor?: string
  }
  settings: Record<string, unknown>
}

const TenantContext = createContext<TenantData | null>(null)

export function TenantProvider({
  tenant,
  children,
}: {
  tenant: TenantData
  children: React.ReactNode
}) {
  return (
    <TenantContext.Provider value={tenant}>
      <style>{`
        :root {
          --tenant-primary: ${tenant.branding?.primaryColor || '#2a6ab0'};
        }
      `}</style>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  const ctx = useContext(TenantContext)
  if (!ctx) throw new Error('useTenant must be used within TenantProvider')
  return ctx
}
```

### Middleware Tenant Resolution

```typescript
// In apps/web/src/middleware.ts (extending auth middleware from Story 1.3)

// Extract tenant from subdomain
const hostname = request.headers.get('host') || ''
const subdomain = hostname.split('.')[0]

// Fallback for local dev: use query param
const tenantSlug = subdomain !== 'localhost'
  ? subdomain
  : request.nextUrl.searchParams.get('tenant') || 'demo'

// Inject tenant slug as header for server components
response.headers.set('x-tenant-slug', tenantSlug)
```

### Platform Layout

```typescript
// apps/web/src/app/(platform)/layout.tsx
import { createClient } from '@/lib/supabase/server'
import { TenantProvider } from '@/components/providers/tenant-provider'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'

export default async function PlatformLayout({ children }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('*, tenants(*)')
    .eq('id', user.id)
    .single()

  return (
    <TenantProvider tenant={profile.tenants}>
      <div className="flex h-screen bg-[#0f0f0f]">
        <Sidebar role={profile.role} />
        <div className="flex-1 flex flex-col">
          <Header user={profile} tenant={profile.tenants} />
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </TenantProvider>
  )
}
```

### Sidebar Navigation Config

```typescript
// apps/web/src/lib/navigation.ts
import {
  LayoutDashboard, BookOpen, GraduationCap,
  BarChart3, Settings, Users
} from 'lucide-react'

export const navigationByRole = {
  student: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Cursos', href: '/courses', icon: BookOpen },
  ],
  teacher: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Meus Cursos', href: '/courses', icon: GraduationCap },
  ],
  manager: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  ],
  admin: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Configuracoes', href: '/admin/settings', icon: Settings },
    { label: 'Usuarios', href: '/admin/users', icon: Users },
  ],
}
```

### Tailwind Config with Design Tokens

> **Canonical source:** `Benchmarks/Design/design-tokens.json` v1.2.2. Se tokens mudarem, atualizar este config.

```typescript
// apps/web/tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // colors.backgrounds.*
        app: { bg: '#0f0f0f' },
        sidebar: { bg: '#111111' },
        surface: { bg: '#1a1a1a' },
        card: { bg: '#1e1e1e', elevated: '#242424', hover: '#2a2a2a' },
        // colors.accent.blue.*
        accent: { blue: '#2a6ab0', blueDefault: '#1a4a8a', blueLight: '#4a8ad0' },
        // colors.text.*
        text: { primary: '#ffffff', secondary: '#a0a0a0', muted: '#666666', inactive: '#888888' },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        sm: '6px',
        md: '12px',
        lg: '18px',
        xl: '24px',
      },
      spacing: {
        sidebar: '200px',
        'sidebar-collapsed': '60px',
        topbar: '56px',
      },
    },
  },
}

export default config
```

---

## Tasks

- [x] 1. Criar `TenantProvider` context com dados do tenant
- [x] 2. Implementar tenant resolution no middleware (subdomain → tenant_id)
- [x] 3. Criar layout `(platform)/layout.tsx` com sidebar + header + content area
- [x] 4. Criar componente `Sidebar` com navegacao por role (4 configs)
- [x] 5. Criar componente `Header` com logo, user info, logout
- [x] 6. Configurar Tailwind com design tokens (cores, spacing, radius, font)
- [x] 7. Aplicar design tokens via CSS variables
- [x] 8. Implementar branding dinamico (logo + cor primaria do tenant)
- [x] 9. Criar dashboard placeholder com welcome message + role info
- [x] 10. Implementar sidebar collapsivel (toggle button)
- [x] 11. Implementar responsividade mobile (hamburger menu < 768px)
- [x] 12. Fallback para tema padrao (branding vazio → defaults)
- [x] 13. Criar rota `/analytics` como redirect/alias para Manager Dashboard
- [ ] 14. Testar com seed tenant "Demo" (4 roles) — requires running Supabase
- [x] 15. Validar focus ring visivel (2px solid #2a6ab0), keyboard navigation

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Implementacao de layout, sidebar, header, tenant resolution |
| **@architect (Aria)** | Review da TenantProvider architecture |
| **@qa (Quinn)** | Validacao: branding aplicado, role-based nav, responsividade, accessibility |

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|----------|---------|
| Pre-Commit | Lint + typecheck, design tokens consistency | Yes |
| Pre-PR | Visual review: sidebar 200px, cores conforme tokens, responsivo testado | Yes |
| Accessibility | Focus ring visible (WCAG 2.4.7), keyboard navigation, WCAG AA contrast (4.5:1) | Yes |
| Design Review | Tokens match `design-tokens.json` v1.2.2 | Yes |

---

## Definition of Done

- [ ] Todos os ACs passam
- [ ] Layout com sidebar 200px funcional e collapsivel
- [ ] Header com logo, user info, logout
- [ ] Branding do tenant Demo aplicado (via seed)
- [ ] Sidebar items corretos por role (4 configs testadas)
- [ ] Responsivo em mobile (hamburger menu)
- [ ] Design tokens respeitados (cores, spacing, radius, font)
- [ ] Focus ring e keyboard navigation funcionais
- [ ] `/analytics` redirect operacional
- [ ] PR aprovada

---

## Risk Assessment

| Risco | Impacto | Mitigacao | Rollback |
|-------|---------|-----------|----------|
| Subdomain resolution no Vercel | MEDIUM | Testar wildcard domain early; fallback `?tenant=` | Usar query param |
| Tailwind CSS 4 dark mode issues | LOW | Usar CSS variables direto se necessario | Pin colors em classes |
| shadcn/ui cross-package import | MEDIUM | Path aliases no tsconfig conforme Story 1.1 notas | Import direto do package |

---

*Story criada por Morgan (PM Agent) — eximIA Academy*
