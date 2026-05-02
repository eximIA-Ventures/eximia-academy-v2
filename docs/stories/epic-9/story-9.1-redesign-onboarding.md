# Story 9.1: Redesign do Onboarding (5 → 2 Steps)

**Epic:** [Epic 9 — Onboarding Inteligente & Personalização Adaptativa](../../epics/epic-9-onboarding-inteligente-personalizacao.md)
**Version:** 1.0
**Created:** 2026-02-08
**Author:** River (Scrum Master)
**Status:** Draft
**Story Points:** 5
**Priority:** P0 (Depende de Story 9.2 para auto-enrollment)
**Blocked By:** Story 9.2 (campo `type` em courses + trilha onboarding)
**Blocks:** —
**Assigned To:** @dev (Dex)

---

## User Story

**As a** new collaborator,
**I want** um onboarding rápido e relevante no contexto corporativo,
**so that** eu chegue ao conteúdo da plataforma em menos de 1 minuto.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/project-decisions/ADR-001-student-self-enroll-rls.md` (enrollment policy), `apps/web/src/lib/auth.ts` (getAuthProfile) |
| **Epic Ref** | `docs/epics/epic-9-onboarding-inteligente-personalizacao.md` v1.2 — Story 9.1 |
| **PRD Ref** | `docs/prd.md` — FR20 (revisão) |
| **Screens Ref** | `docs/screens.md` — Tela 3 (redesign: 5→2 steps) |
| **Design Tokens** | `Benchmarks/Design/design-tokens.json` v1.2.1 |
| **Stack** | Next.js 15 (App Router) + Supabase + Drizzle ORM + Tailwind CSS 4 + shadcn/ui |
| **DB Tables** | `users` (profile JSONB — novo schema), `courses` (campo `type` — Story 9.2), `enrollments` (auto-enroll) |
| **Mutation** | Server Action `saveOnboardingProfile()` — atualizar (NOT API route) |
| **CRITICAL** | Onboarding page FORA do grupo `(platform)` — manter padrão Story 5.3 |
| **CRITICAL** | Step 2 é **mode-aware** via `tenant.mode` (corporativo vs universidade) |
| **SECURITY** | Zod validation MUST restringir campos atualizáveis (prevenir role escalation) |
| **Previous Story** | Story 5.3 implementou wizard de 5 steps. Este story substitui por 2 steps. |

---

## Acceptance Criteria

- [ ] **AC1:** Wizard reduzido para 2 steps (era 5)

- [ ] **AC2:** Step 1: Boas-vindas + avatar upload (mantém funcionalidade existente do Story 5.3)

- [ ] **AC3:** Step 2 é **mode-aware** via `tenant.mode`:
  - **Corporativo:** "Você é novo na empresa?" com 3 opções:
    - "Sou novo, ainda não fiz o onboarding da empresa" → `employee_status = 'new_needs_onboarding'`
    - "Sou novo, mas já fiz o onboarding presencial" → `employee_status = 'new_already_onboarded'`
    - "Já trabalho aqui há algum tempo" → `employee_status = 'existing'`
  - **Universidade:** "Você é novo na instituição?" com 3 opções:
    - "Sou novo, ainda não fiz a semana de recepção" → `employee_status = 'new_needs_onboarding'`
    - "Sou novo, mas já fiz a recepção presencial" → `employee_status = 'new_already_onboarded'`
    - "Já estudo aqui há algum tempo" → `employee_status = 'existing'`

- [ ] **AC4:** Dados salvos em `users.profile` JSONB via Server Action (campo único: `employee_status`)

- [ ] **AC5:** `onboarding_completed` marcado como true após conclusão

- [ ] **AC6:** Se `employee_status = 'new_needs_onboarding'` E existe trilha tipo 'onboarding' publicada no tenant → auto-enroll e redirect para dashboard

- [ ] **AC7:** Se `employee_status != 'new_needs_onboarding'` → redirect direto para dashboard

- [ ] **AC8:** Se `employee_status = 'new_needs_onboarding'` mas NÃO existe trilha onboarding publicada → redirect ao dashboard com toast informativo: "Nenhuma trilha de boas-vindas configurada. Fale com seu gestor."

- [ ] **AC9:** Skip option mantido (pode pular e completar depois)

- [ ] **AC10:** Componentes antigos removidos: `step-learning-style.tsx`, `step-experience.tsx`, `step-goals.tsx`, `step-sector.tsx`

- [ ] **AC11:** Testes antigos removidos e novos testes criados para o novo fluxo (incluindo ambos os modos)

- [ ] **AC12:** Zod validation atualizada para novo schema de profile (security-critical)

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.
> To enable, set `coderabbit_integration.enabled: true` in core-config.yaml

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 12, 4, 5) Atualizar Server Action `saveOnboardingProfile()`
  - [ ] Abrir `apps/web/src/app/onboarding/actions.ts`
  - [ ] **SECURITY-CRITICAL:** Substituir Zod schema antigo pelo novo:
    ```typescript
    const onboardingSchema = z.object({
      profile: z.object({
        employee_status: z.enum(['new_needs_onboarding', 'new_already_onboarded', 'existing']),
        photo_url: z.string().optional(),
      }),
    })
    ```
  - [ ] Manter pattern: `supabase.from('users').update({ profile, onboarding_completed: true }).eq('id', user.id)`
  - [ ] **NOVO:** Após salvar profile, se `employee_status === 'new_needs_onboarding'`, chamar `handleAutoEnrollment()` (Task 2)
  - [ ] Retornar `{ success: true, autoEnrolled: boolean, noOnboardingTrail: boolean }` para UI saber qual toast mostrar
  - [ ] Manter `skipOnboarding()` existente (AC9)

- [ ] **Task 2** (AC: 6, 8) Implementar lógica de auto-enrollment
  - [ ] Criar função `handleAutoEnrollment(userId, tenantId)` em `apps/web/src/app/onboarding/actions.ts`
  - [ ] Query: buscar curso publicado tipo 'onboarding' no tenant (depende de Story 9.2)
    ```typescript
    const { data: onboardingCourse } = await supabase
      .from('courses').select('id')
      .eq('tenant_id', tenantId).eq('type', 'onboarding').eq('status', 'published').single()
    ```
  - [ ] Se encontrou: INSERT em `enrollments` (reutilizar padrão de `enrollInCourse()` — ver Dev Notes)
  - [ ] Se NÃO encontrou: retornar flag `noOnboardingTrail = true` para Server Action
  - [ ] Tratar erro 23505 (aluno já inscrito) gracefully — não é erro, apenas ignora

- [ ] **Task 3** (AC: 3) Criar componente `StepEmployeeStatus` (mode-aware)
  - [ ] Criar `apps/web/src/components/onboarding/step-employee-status.tsx` (`'use client'`)
  - [ ] Receber props: `tenantMode: TenantMode`, `value`, `onChange`
  - [ ] Usar `EMPLOYEE_STATUS_OPTIONS` constant com labels por modo (ver Dev Notes)
  - [ ] 3 cards selecionáveis com ícones (Sprout, CheckCircle, Building — lucide-react)
  - [ ] Título mode-aware: "Você é novo na empresa?" / "Você é novo na instituição?"
  - [ ] Pattern: mesmo estilo dos cards do antigo `step-learning-style.tsx` (grid selectable cards)

- [ ] **Task 4** (AC: 1, 2) Atualizar `OnboardingWizard`
  - [ ] Abrir `apps/web/src/components/onboarding/onboarding-wizard.tsx`
  - [ ] Reduzir steps de 5 para 2: `[StepWelcome, StepEmployeeStatus]`
  - [ ] Atualizar `OnboardingFormData` interface:
    ```typescript
    interface OnboardingFormData {
      photo_url?: string
      employee_status?: 'new_needs_onboarding' | 'new_already_onboarded' | 'existing'
    }
    ```
  - [ ] Atualizar stepper/progress bar para 2 steps
  - [ ] Manter `StepWelcome` sem alterações (AC2)
  - [ ] Remover imports dos steps antigos
  - [ ] No `handleComplete()`: chamar `saveOnboardingProfile()` atualizado, checar resposta para toast

- [ ] **Task 5** (AC: 6, 7, 8) Implementar redirect + toast após onboarding
  - [ ] Após `saveOnboardingProfile()` retornar:
    - Se `autoEnrolled = true` → `router.push('/dashboard')` (aluno foi inscrito na trilha)
    - Se `noOnboardingTrail = true` → `router.push('/dashboard')` + toast: "Nenhuma trilha de boas-vindas configurada. Fale com seu gestor."
    - Se `employee_status !== 'new_needs_onboarding'` → `router.push('/dashboard')` direto
  - [ ] Usar `useToast()` de `@eximia/ui` para o toast informativo

- [ ] **Task 6** (AC: 10) Remover componentes antigos
  - [ ] Deletar `apps/web/src/components/onboarding/step-learning-style.tsx`
  - [ ] Deletar `apps/web/src/components/onboarding/step-experience.tsx`
  - [ ] Deletar `apps/web/src/components/onboarding/step-goals.tsx`
  - [ ] Deletar `apps/web/src/components/onboarding/step-sector.tsx`
  - [ ] Deletar testes associados em `__tests__/`:
    - `step-learning-style.test.tsx`
    - `step-experience.test.tsx`
    - `step-goals.test.tsx`
    - `step-sector.test.tsx`
  - [ ] Verificar que nenhum outro arquivo importa esses componentes (grep)

- [ ] **Task 7** (AC: 11) Criar novos testes
  - [ ] Test: Wizard renderiza exatamente 2 steps
  - [ ] Test: Step 1 (Welcome) mantém funcionalidade de avatar upload
  - [ ] Test: Step 2 mostra opções corporativas quando `tenantMode = 'corporate'`
  - [ ] Test: Step 2 mostra opções universidade quando `tenantMode = 'university'`
  - [ ] Test: Selecionar 'new_needs_onboarding' → auto-enroll + redirect
  - [ ] Test: Selecionar 'existing' → redirect direto (sem enrollment)
  - [ ] Test: Auto-enroll quando trilha onboarding não existe → toast informativo
  - [ ] Test: Skip funciona (marca onboarding_completed = true)
  - [ ] Test: Server Action rejeita campos inválidos (Zod)
  - [ ] Test: Server Action rejeita campos fora de `profile` + `onboarding_completed` (segurança)
  - [ ] Test: Nenhuma referência aos steps removidos no codebase
  - [ ] Test: Navegação entre steps funciona (next/back)

---

## Dev Notes

### Previous Story Insights [Source: Story 5.3 Dev Agent Record]

- Route OUTSIDE `(platform)` group prevents redirect loop — manter este padrão
- Zod schema restricts to `profile` + `onboarding_completed` only — CRITICAL for security
- `skipOnboarding()` sets `onboarding_completed=true` with empty profile — manter
- `StepWelcome` usa `createClient()` (client-side) para upload de avatar — NÃO modificar
- Platform layout (`apps/web/src/app/(platform)/layout.tsx`) faz `if (!profile.onboarding_completed && profile.role === "student") redirect("/onboarding")` — NÃO modificar

### New Profile JSONB Schema [Source: epic-9 v1.2, Story 9.1 Technical Notes]

```typescript
interface UserProfile {
  // Onboarding data (Step 2) — single field, no redundancy
  employee_status?: 'new_needs_onboarding' | 'new_already_onboarded' | 'existing'
  // Derived: needsOnboarding = employee_status === 'new_needs_onboarding'

  // Avatar (Step 1 — mantido)
  photo_url?: string

  // Self-knowledge hub data (Story 9.3 — preenchido depois)
  big_five?: { openness: number; conscientiousness: number; extraversion: number; agreeableness: number; neuroticism: number }
  enneagram?: { type: number; wing?: number }

  // AI-inferred profile (Epic 10 — preenchido pela IA)
  ai_learning_profile?: Record<string, unknown>

  // Legacy fields (mantidos para backward compatibility, não coletados)
  learning_style?: string
  experience_level?: string
  goals?: string[]
  sector?: string
  course_period?: string
}
```

### New Zod Schema (SECURITY-CRITICAL) [Source: epic-9 v1.2, API Contracts]

```typescript
const onboardingSchema = z.object({
  profile: z.object({
    employee_status: z.enum(['new_needs_onboarding', 'new_already_onboarded', 'existing']),
    photo_url: z.string().optional(),
  }),
})
// This schema ONLY allows `profile` fields — prevents role escalation via users_update_self RLS
```

### Mode-Aware Employee Status Options [Source: epic-9 v1.2, Technical Notes]

```typescript
import { Sprout, CheckCircle, Building } from 'lucide-react'

const EMPLOYEE_STATUS_OPTIONS = {
  corporate: [
    {
      value: 'new_needs_onboarding',
      icon: Sprout,
      title: 'Sou novo, preciso do onboarding',
      description: 'Ainda não fiz o processo de boas-vindas da empresa',
    },
    {
      value: 'new_already_onboarded',
      icon: CheckCircle,
      title: 'Sou novo, mas já fiz o onboarding',
      description: 'Já passei pelo processo de boas-vindas presencial',
    },
    {
      value: 'existing',
      icon: Building,
      title: 'Já trabalho aqui há algum tempo',
      description: 'Estou conhecendo a plataforma de aprendizado',
    },
  ],
  university: [
    {
      value: 'new_needs_onboarding',
      icon: Sprout,
      title: 'Sou novo, preciso da recepção',
      description: 'Ainda não fiz a semana de recepção da instituição',
    },
    {
      value: 'new_already_onboarded',
      icon: CheckCircle,
      title: 'Sou novo, mas já fiz a recepção',
      description: 'Já passei pela recepção presencial',
    },
    {
      value: 'existing',
      icon: Building,
      title: 'Já estudo aqui há algum tempo',
      description: 'Estou conhecendo a plataforma de aprendizado',
    },
  ],
} as const
```

### Auto-Enrollment Logic [Source: epic-9 v1.2, Technical Notes]

```typescript
// apps/web/src/app/onboarding/actions.ts
async function handleAutoEnrollment(userId: string, tenantId: string): Promise<{ enrolled: boolean }> {
  const supabase = await createClient()

  // Find published onboarding course for this tenant
  const { data: onboardingCourse } = await supabase
    .from('courses')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('type', 'onboarding')
    .eq('status', 'published')
    .single()

  if (!onboardingCourse) {
    return { enrolled: false }
  }

  // Auto-enroll (handle duplicate gracefully)
  const { error } = await supabase.from('enrollments').insert({
    student_id: userId,
    course_id: onboardingCourse.id,
    tenant_id: tenantId,
    status: 'active',
    progress: {},
  })

  if (error && error.code !== '23505') {
    console.error('Auto-enrollment failed:', error)
    return { enrolled: false }
  }

  return { enrolled: true }
}
```

### Existing enrollInCourse Pattern [Source: apps/web/src/app/(platform)/courses/actions.ts]

```typescript
// Pattern reference: enrollInCourse(courseId) uses simple INSERT
// RLS policy enrollments_student_self_enroll allows:
// - tenant_id = auth_tenant_id()
// - student_id = auth.uid()
// - auth_user_role() = 'student'
// - course_id IN (published courses)
// Auto-enrollment in onboarding follows same pattern
```

### Route Structure [Source: Story 5.3 Dev Notes]

```
apps/web/src/app/
├── onboarding/                          # OUTSIDE (platform) group!
│   ├── page.tsx                         # RSC wrapper (auth check, load tenant)
│   ├── layout.tsx                       # Minimal layout (no sidebar)
│   └── actions.ts                       # Server Actions (UPDATED)
├── (platform)/
│   └── layout.tsx                       # Has onboarding_completed redirect check
└── ...
```

### Existing Onboarding Wizard Structure [Source: apps/web/src/components/onboarding/onboarding-wizard.tsx]

```typescript
interface OnboardingWizardProps {
  userId: string
  tenantId: string
  tenantName: string
  tenantMode: TenantMode  // Already receives tenant mode!
}

interface OnboardingFormData {
  photo_url?: string
  // OLD: learning_style, experience_level, goals, sector, course_period
  // NEW: employee_status only
}
```

### Import Patterns [Source: codebase analysis]

```typescript
// UI Components
import { Button, ProgressBar, useToast } from "@eximia/ui"

// Shared types
import type { TenantMode } from "@eximia/shared"

// Icons
import { Sprout, CheckCircle, Building } from "lucide-react"

// Server Actions
import { saveOnboardingProfile, skipOnboarding } from "@/app/onboarding/actions"

// Supabase
import { createClient } from "@/lib/supabase/server"  // Server-side
import { createClient } from "@/lib/supabase/client"   // Client-side (avatar upload)
```

### Toast Pattern [Source: @eximia/ui]

```typescript
const { toast } = useToast()

// Usage for AC8:
toast({
  title: "Informação",
  description: "Nenhuma trilha de boas-vindas configurada. Fale com seu gestor.",
  variant: "default",
})
```

### File Locations

```
apps/web/src/app/onboarding/
├── page.tsx                            # Mantido (RSC wrapper)
├── layout.tsx                          # Mantido (minimal layout)
└── actions.ts                          # UPDATED: novo schema + auto-enrollment

apps/web/src/components/onboarding/
├── onboarding-wizard.tsx               # UPDATED: 5→2 steps
├── step-welcome.tsx                    # MANTIDO: avatar upload
├── step-employee-status.tsx            # NEW: mode-aware employee status
├── step-learning-style.tsx             # DELETED
├── step-experience.tsx                 # DELETED
├── step-goals.tsx                      # DELETED
├── step-sector.tsx                     # DELETED
└── __tests__/
    ├── step-learning-style.test.tsx    # DELETED
    ├── step-experience.test.tsx        # DELETED
    ├── step-goals.test.tsx             # DELETED
    ├── step-sector.test.tsx            # DELETED
    ├── step-employee-status.test.tsx   # NEW
    └── onboarding-wizard.test.tsx      # NEW (or updated)
```

### Testing

- **Test location:** `apps/web/src/components/onboarding/__tests__/`
- **Framework:** Vitest + Testing Library
- **Mock pattern:** Mock Supabase client, mock Server Actions
- **Key concern:** Mode-aware rendering, auto-enrollment flow, toast display, Zod security

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` passam. Wizard renderiza 2 steps. Nenhuma referência aos steps removidos. | Yes |
| Pre-PR | Fluxo completo salva profile, auto-enroll funciona quando trilha existe, skip funciona, redirect correto. Zod rejeita campos inválidos. Legacy data não é corrompida. Toast informativo quando trilha não existe. Both modes (corporate/university) testados. | Yes |

---

## Definition of Done

- [ ] Wizard exibe exatamente 2 steps (Welcome + Employee Status)
- [ ] Step 2 adapta labels ao `tenant.mode` (corporate vs university)
- [ ] Employee status salvo em `users.profile.employee_status`
- [ ] `onboarding_completed` marcado true após conclusão
- [ ] Auto-enrollment funciona quando trilha onboarding existe
- [ ] Toast informativo quando trilha não existe
- [ ] Skip funciona (marca completed sem dados)
- [ ] Componentes antigos removidos do codebase
- [ ] Testes antigos removidos, novos testes criados
- [ ] Zod rejeita campos fora de `profile` + `onboarding_completed`
- [ ] Alunos existentes (`onboarding_completed = true`) NÃO são afetados
- [ ] Legacy JSONB data (learning_style, etc.) não é corrompida
- [ ] Sem redirect loop (page fora de (platform))
- [ ] `pnpm lint && pnpm typecheck` passam

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Implementação completa (redesign wizard, remoção steps antigos, novo Server Action, auto-enrollment) |
| **@qa (Quinn)** | Validação: fluxo 2 steps, auto-enrollment, skip, Zod, backward compat, dual-mode |

---

## Risk Assessment

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Redirect loop se page movida para (platform) | CRITICAL | Page FORA do grupo (platform) — manter padrão Story 5.3. Test de integração verifica. |
| Role escalation via users_update_self RLS | HIGH | Zod validation restringe a `profile` + `onboarding_completed`. Server Action não expõe Supabase client. |
| Legacy profile data corrompida | MEDIUM | Profile JSONB é schema-less — campos antigos coexistem com novos. `onboarding_completed` não é resetado. |
| Auto-enrollment falha silenciosamente | MEDIUM | Server Action retorna `noOnboardingTrail` flag. UI exibe toast informativo (AC8). |
| Step 2 labels erradas para university mode | LOW | Testes cobrem ambos os modos. EMPLOYEE_STATUS_OPTIONS tipado como const. |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-08 | 1.0 | Story created from Epic 9 v1.2 | River (SM) |

---

*Story criada por River (Scrum Master) — exímIA Academy*
