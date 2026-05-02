# Story 18.2a: Dashboard Agregado — Layout, Filtros e Summary Cards (`/analytics`)

**Epic:** [Epic 18 — Analytics & Output Analitico Avancado](../../epics/epic-18-ws1-analytics-output-analitico.md)
**Version:** 1.0
**Created:** 2026-02-15
**Updated:** 2026-02-15
**Author:** River (SM)
**Status:** Ready
**Story Points:** 5
**Priority:** P0 (core)
**Blocked By:** Story 18.1 (API endpoints)
**Blocks:** Story 18.2b
**Assigned To:** @dev

---

## User Story

**As a** manager,
**I want** uma pagina de analytics com filtros e cards de resumo,
**so that** eu tenha visao rapida dos KPIs socratico da turma.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws1-motor-socratico-architecture.md`, Secao 16 (UC3, D3) |
| **PRD Ref** | `docs/prd/evolucao-eximia-academy-workstreams.md` — WS1: Motor Socratico |
| **Stack** | Next.js 15 (RSC + Client), Tailwind CSS 4, @eximia/ui |
| **Design Tokens** | `apps/web/src/styles/theme.css` |
| **Risk** | LOW — reutiliza StatCard existente, layout padrao |

---

## Acceptance Criteria

- [ ] **AC1:** Pagina `/analytics` com layout responsivo
  - RSC para dados iniciais + Client components para filtros interativos
  - Layout grid responsivo (2 colunas desktop, 1 mobile)
- [ ] **AC2:** Filtros: periodo (7d, 30d, 90d), curso, area
  - Reutilizar `PeriodFilter` existente ou estender
  - Filtros alteram query params (URL-driven state)
  - Fetch dados via API endpoint `GET /api/analytics/aggregate`
- [ ] **AC3:** Summary Cards (4 cards):
  - Sessoes ativas (count + delta vs periodo anterior)
  - Profundidade media (X/7 com delta)
  - Breakthroughs/sessao (com delta)
  - AI Detection rate (% com delta)
  - Usar `StatCard` do `@eximia/ui`
- [ ] **AC4:** Sidebar navigation atualizado: "Analytics" → `/analytics` (nao redireciona mais para /dashboard)
- [ ] **AC5:** Todos os componentes usam tokens do design system (`docs/design-system-guide.md`)
  - Consultar design-system-guide.md antes de criar componentes
  - Usar `bg-bg-card`, `text-text-primary`, etc.
- [ ] **AC6:** Auth guard: apenas manager/admin do tenant
- [ ] **AC7:** `pnpm typecheck` passa

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1) Criar pagina e layout
  - [ ] Criar `apps/web/src/app/[tenant]/analytics/page.tsx` (RSC)
  - [ ] Criar `apps/web/src/app/[tenant]/analytics/layout.tsx`
  - [ ] Layout grid responsivo

- [ ] **Task 2** (AC: 2) Implementar filtros
  - [ ] Criar `apps/web/src/components/analytics/AnalyticsFilters.tsx` (Client component)
  - [ ] Periodo: 7d, 30d, 90d (reutilizar PeriodFilter ou criar similar)
  - [ ] Curso: dropdown com cursos do tenant
  - [ ] Area: dropdown com areas do tenant
  - [ ] URL-driven state (searchParams)
  - [ ] Fetch dados via `GET /api/analytics/aggregate` com filtros

- [ ] **Task 3** (AC: 3) Implementar Summary Cards
  - [ ] Criar `apps/web/src/components/analytics/SummaryCardsRow.tsx`
  - [ ] 4 StatCards: sessoes ativas, profundidade media, breakthroughs, AI detection
  - [ ] Cada card com valor + delta (positivo/negativo badge)
  - [ ] Usar `StatCard` do `@eximia/ui`

- [ ] **Task 4** (AC: 4) Atualizar sidebar navigation
  - [ ] Encontrar componente de sidebar (provavelmente `apps/web/src/components/layout/`)
  - [ ] "Analytics" → `/[tenant]/analytics` (nao redirecionar mais para /dashboard)

- [ ] **Task 5** (AC: 6) Auth guard
  - [ ] Verificar role manager/admin no RSC (redirect se student)
  - [ ] Reutilizar middleware existente de role-based access

- [ ] **Task 6** (AC: 5, 7) Design system compliance e validacao
  - [ ] Consultar `docs/design-system-guide.md` antes de criar componentes
  - [ ] Usar tokens Tailwind: `bg-bg-card`, `text-text-primary`, `rounded-md`, etc.
  - [ ] `pnpm typecheck` passa

---

## Dev Notes

### Existing Components to Reuse

| Componente | Localizacao | Uso |
|---|---|---|
| `StatCard` | `@eximia/ui` | Summary cards |
| `PeriodFilter` | `apps/web/src/components/dashboard/` | Filtro de periodo |
| Sidebar | `apps/web/src/components/layout/` | Navegacao |

### Layout Pattern

```
┌─── Filtros ───────────────────────────────┐
│ [Periodo: 30d] [Curso: Todos] [Area: Todas] │
└───────────────────────────────────────────┘

┌─── Summary Cards ─────────────────────────┐
│ Sessoes   │ Prof.Media │ Breakthru │ AI Det │
│ 847       │ 4.3/7      │ 2.1/sess  │ 3.2%   │
└───────────────────────────────────────────┘

(Graficos serao adicionados na Story 18.2b)
```

### File Locations

```
apps/web/src/app/[tenant]/analytics/
├── page.tsx              # NOVO (RSC)
└── layout.tsx            # NOVO

apps/web/src/components/analytics/
├── AnalyticsFilters.tsx   # NOVO (Client)
└── SummaryCardsRow.tsx    # NOVO

apps/web/src/components/layout/
└── sidebar.tsx (ou similar) # ATUALIZAR (link Analytics)
```

### Testing

- Testes E2E no Epic 19 (Story 19.3 — manager-analytics.spec.ts)
- Validar: filtros mudam dados nos cards, auth guard funciona

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-15 | 1.0 | Story creation | River (SM) |
| 2026-02-15 | 1.1 | PO validation: GO (10/10). Status Draft → Ready | Pax (PO) |

---

## Dev Agent Record

### Agent Model Used
_To be filled by @dev_

### Debug Log References
_To be filled by @dev_

### Completion Notes List
_To be filled by @dev_

### File List
_To be filled by @dev_

---

## QA Results
_To be filled by @qa_
