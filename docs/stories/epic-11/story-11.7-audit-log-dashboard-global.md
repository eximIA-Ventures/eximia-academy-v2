# Story 11.7: Audit Log + Dashboard Global

**Epic:** [Epic 11 — Super Admin, Gestao de Empresas & Whitelabel Pago](../../epics/epic-11-super-admin-whitelabel.md)
**Version:** 1.0
**Created:** 2026-02-08
**Author:** Morgan (PM Agent)
**Status:** Pending
**Story Points:** 3
**Priority:** P2 (Nice-to-have — can be deferred)
**Blocked By:** Stories 11.1, 11.2
**Blocks:** —
**Assigned To:** @dev (Dex)

---

## User Story

**As a** super admin,
**I want** an audit trail of all my actions and a global dashboard with platform metrics,
**so that** I have full visibility and accountability over platform operations.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | architecture.md v1.3 |
| **PRD Ref** | prd.md — FR19 |
| **Stack** | Next.js 15, Supabase, @eximia/ui (Table, Card, StatCard, Badge), TanStack Query, Recharts |
| **DB Tables** | `platform_audit_log` (read), `tenants` (read, aggregate), `users` (read, aggregate), `sessions` (read, aggregate) |
| **API Routes** | `/api/super-admin/audit` (NEW), `/api/super-admin/dashboard` (NEW) |
| **RLS** | `is_super_admin()` — cross-tenant read access for aggregates |

---

## Acceptance Criteria

- [ ] **AC1:** Pagina `/super-admin/audit` exibe lista de audit entries com colunas: Data (formatted), Acao (badge colorido), Tipo Alvo, Nome Alvo, Detalhes (expandable)
- [ ] **AC2:** Filtros funcionais: por acao (multi-select), por data range (date picker), por target_type (select)
- [ ] **AC3:** Paginacao cursor-based (50 items por pagina)
- [ ] **AC4:** Pagina `/super-admin/dashboard` exibe cards de metricas globais:
  - Total de empresas (ativas vs inativas)
  - Total de usuarios (breakdown por role)
  - Total de sessoes socraticas nos ultimos 30 dias (completadas vs ativas)
  - Empresas com whitelabel ativado (count + percentual)
- [ ] **AC5:** Dashboard exibe grafico de crescimento (Recharts LineChart): usuarios e tenants nos ultimos 6 meses
- [ ] **AC6:** Dashboard carrega dados via API com cache (TanStack Query, staleTime: 5min)
- [ ] **AC7:** Componentes usam @eximia/ui: Table, Card, StatCard, Badge, Select, Pagination
- [ ] **AC8:** Audit log entries mostram nome do actor (JOIN com users) e nome do target (JOIN com tenants/users)
- [ ] **AC9:** Loading states com Skeleton components enquanto dados carregam

---

## CodeRabbit Integration

> CodeRabbit will review: query performance (aggregates), pagination correctness, data accuracy, caching strategy.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1, 2, 3, 8) Create audit log page and API
  - [ ] Create `apps/web/src/app/(super-admin)/audit/page.tsx`
  - [ ] Create `AuditLogTable` component with expandable detail rows
  - [ ] Implement `GET /api/super-admin/audit` with:
    - Cursor-based pagination (50 per page)
    - Filter by action (array), date range (from/to), target_type
    - JOIN users for actor_name
    - JOIN tenants/users for target_name based on target_type
  - [ ] Action badges with colors: created=green, updated=blue, deactivated=red, toggled=yellow, switched=gray
  - [ ] Expandable details column showing JSONB content formatted

- [ ] **Task 2** (AC: 4, 5, 6, 9) Create global dashboard page and API
  - [ ] Create `apps/web/src/app/(super-admin)/dashboard/page.tsx`
  - [ ] Create `GlobalDashboard` component
  - [ ] Implement `GET /api/super-admin/dashboard` with aggregate queries:
    - COUNT tenants by status
    - COUNT users by role
    - COUNT sessions by status (last 30 days)
    - COUNT tenants where whitelabel_enabled = true
    - Monthly growth: GROUP BY date_trunc('month', created_at) for last 6 months
  - [ ] 4 StatCard components for top metrics
  - [ ] Recharts LineChart for growth trend
  - [ ] TanStack Query with staleTime: 5 * 60 * 1000 (5 min)
  - [ ] Skeleton loading states

- [ ] **Task 3** (AC: 7) Apply @eximia/ui components
  - [ ] Use Table for audit log
  - [ ] Use Card/StatCard for dashboard metrics
  - [ ] Use Badge for action types and status indicators
  - [ ] Use Select for filters
  - [ ] Use Pagination for cursor navigation
  - [ ] Use Skeleton for loading states

- [ ] **Task 4** (AC: all) Testing and validation
  - [ ] Verify audit log shows correct entries after performing actions in Stories 11.3, 11.4, 11.5
  - [ ] Verify dashboard metrics match actual database counts
  - [ ] Verify filters narrow results correctly
  - [ ] Verify pagination works with large datasets
  - [ ] Verify growth chart displays correct monthly data
  - [ ] Verify 403 for non-super_admin access

---

## Dev Notes

### API Contracts

```typescript
// GET /api/super-admin/audit
// [Source: Epic 11 architecture]
interface AuditLogResponse {
  data: Array<{
    id: string
    actor_id: string
    actor_name: string        // JOIN: users.full_name WHERE id = actor_id
    action: string            // tenant_created | tenant_updated | tenant_deactivated | whitelabel_toggled | manager_assigned | tenant_switched
    target_type: 'tenant' | 'user'
    target_id: string
    target_name: string       // JOIN: tenants.name or users.full_name based on target_type
    details: Record<string, unknown>
    created_at: string
  }>
  nextCursor: string | null
}

// GET /api/super-admin/dashboard
interface GlobalDashboardResponse {
  tenants: {
    total: number
    active: number
    inactive: number
    whitelabel_enabled: number
  }
  users: {
    total: number
    by_role: {
      student: number
      teacher: number
      admin: number
      manager: number
      super_admin: number
    }
  }
  sessions: {
    last_30_days: number
    completed: number
  }
  growth: Array<{
    month: string       // "2026-01", "2026-02", etc.
    users: number       // cumulative or new that month
    tenants: number     // cumulative or new that month
  }>
}
```

### Dashboard Aggregate Query

```sql
-- Tenant stats
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE status = 'active') AS active,
  COUNT(*) FILTER (WHERE status = 'inactive') AS inactive,
  COUNT(*) FILTER (WHERE whitelabel_enabled = true) AS whitelabel_enabled
FROM tenants;

-- User stats by role
SELECT role, COUNT(*) AS count
FROM users
WHERE status = 'active'
GROUP BY role;

-- Session stats (last 30 days)
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed
FROM sessions
WHERE created_at >= NOW() - INTERVAL '30 days';

-- Growth (last 6 months)
SELECT
  date_trunc('month', created_at)::date AS month,
  COUNT(*) AS new_users
FROM users
WHERE created_at >= NOW() - INTERVAL '6 months'
GROUP BY month
ORDER BY month;
```

### File Locations

```
apps/web/src/app/(super-admin)/
├── audit/
│   └── page.tsx                          # NEW: audit log page
├── dashboard/
│   └── page.tsx                          # NEW: global dashboard

apps/web/src/components/super-admin/
├── audit-log-table.tsx                   # NEW
├── audit-log-filters.tsx                 # NEW
├── global-dashboard.tsx                  # NEW
├── dashboard-stat-cards.tsx              # NEW
└── dashboard-growth-chart.tsx            # NEW

apps/web/src/app/api/super-admin/
├── audit/
│   └── route.ts                          # NEW: GET audit log
└── dashboard/
    └── route.ts                          # NEW: GET dashboard metrics
```

---

## Quality Gates

| Gate | Validacao | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm lint && pnpm typecheck` pass. Pages render. | Yes |
| Pre-PR | Audit log shows correct entries with actor/target names. Dashboard metrics match DB. Filters and pagination work. Growth chart renders. Loading states show. 403 for unauthorized. | No (P2 — non-blocking) |

---

## Definition of Done

- [ ] Audit log page lists all super admin actions
- [ ] Audit entries show actor name and target name (JOINed)
- [ ] Filters work: by action, date range, target type
- [ ] Dashboard shows accurate aggregate metrics
- [ ] Growth chart renders with Recharts
- [ ] TanStack Query caching works (staleTime: 5min)
- [ ] Loading states with Skeleton components
- [ ] 403 enforcement for non-super_admin
- [ ] Components use @eximia/ui
- [ ] `pnpm lint && pnpm typecheck` pass

---

## Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Full implementation (audit page, dashboard, APIs, charts) |
| **@qa (Quinn)** | Data accuracy, pagination, filter logic, chart correctness |

---

## Risk Assessment

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Slow aggregate queries with many tenants | MEDIUM | Indexed columns, TanStack Query cache (5min), consider materialized views if >1000 tenants |
| Audit log grows indefinitely | LOW | Cursor-based pagination handles large datasets. Future: add retention policy (archive after 1 year) |
| Growth chart empty for new installations | LOW | Handle empty data state gracefully (show "Sem dados" message) |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-08 | 1.0 | Story created from Epic 11 architecture | Morgan (PM) |

---

*Story criada por Morgan (PM Agent) — eximIA Academy*
