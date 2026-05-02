# Story 18.5: Integracao com Dashboard Existente + KPIs Socratico

**Epic:** [Epic 18 — Analytics & Output Analitico Avancado](../../epics/epic-18-ws1-analytics-output-analitico.md)
**Version:** 1.0
**Created:** 2026-02-15
**Updated:** 2026-02-15
**Author:** River (SM)
**Status:** Ready
**Story Points:** 3
**Priority:** P2
**Blocked By:** Story 18.2b (dashboard agregado completo)
**Blocks:** None
**Assigned To:** @dev

---

## User Story

**As a** manager,
**I want** ver KPIs socratico resumidos no dashboard existente com link para analytics completo,
**so that** eu tenha visao rapida sem sair da tela principal.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws1-motor-socratico-architecture.md`, Secao 16 |
| **PRD Ref** | `docs/prd/evolucao-eximia-academy-workstreams.md` — WS1: Motor Socratico |
| **Stack** | Next.js 15, @eximia/ui (StatCard, DataTable) |
| **Existing Components** | Dashboard existente em `apps/web/src/app/[tenant]/dashboard/` |
| **Risk** | LOW — adicoes minimas a componentes existentes |

---

## Acceptance Criteria

- [ ] **AC1:** 2 novos StatCards no dashboard:
  - "Profundidade Media" (X/7 com delta vs periodo anterior)
  - "Breakthroughs" (total ou media/sessao com delta)
  - Usar `StatCard` do `@eximia/ui` (mesmo componente ja usado no dashboard)
- [ ] **AC2:** Colunas adicionais na Course Analytics Table:
  - Profundidade media (por curso)
  - Taxa de completude das sessoes (%)
- [ ] **AC3:** Link "Ver analise completa →" apontando para `/analytics`
  - Posicionar abaixo dos cards ou como link no header da secao
- [ ] **AC4:** Cards e colunas visiveis apenas para manager/admin
- [ ] **AC5:** Sem breaking changes nos componentes existentes
  - Dashboard continua funcionando para todos os roles
  - Componentes existentes nao sao alterados (apenas estendidos)
- [ ] **AC6:** `pnpm typecheck` passa
- [ ] **AC7:** `pnpm build` passa

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1) Adicionar StatCards socratico
  - [ ] Buscar dados de profundidade media e breakthroughs (query sessions com analytics nao-null)
  - [ ] Adicionar 2 StatCards na area de cards do dashboard
  - [ ] Delta calculado vs periodo anterior (7d default)
  - [ ] Condicionalmente renderizar apenas para manager/admin

- [ ] **Task 2** (AC: 2) Estender Course Analytics Table
  - [ ] Adicionar coluna "Prof. Media" (profundidade media por curso)
  - [ ] Adicionar coluna "Completude" (% sessoes completed)
  - [ ] Dados agregados a partir de sessions.analytics por curso

- [ ] **Task 3** (AC: 3) Adicionar link para analytics
  - [ ] Link "Ver analise completa →" apontando para `/[tenant]/analytics`
  - [ ] Estilizar como link discreto (text-accent-blue-mid ou similar)

- [ ] **Task 4** (AC: 4) Condicionar por role
  - [ ] Cards e colunas visiveis apenas para manager/admin
  - [ ] Verificar role do usuario no RSC

- [ ] **Task 5** (AC: 5, 6, 7) Validar sem breaking changes
  - [ ] Dashboard continua funcionando para student (sem cards socratico)
  - [ ] `pnpm typecheck` passa
  - [ ] `pnpm build` passa

---

## Dev Notes

### Existing Dashboard Structure

```
/dashboard (manager)
├── Summary Cards (sessoes, cursos, alunos ativos)  ← ESTENDER com +2
├── Engagement Chart (LineChart semanal)
├── Course Analytics Table                          ← ESTENDER com +2 colunas
└── [novo] Link "Ver analise completa →"
```

### Dados para StatCards

```typescript
// Query para profundidade media e breakthroughs
const { data: sessions } = await supabase
  .from('sessions')
  .select('analytics')
  .eq('tenant_id', tenantId)
  .not('analytics', 'is', null)
  .gte('created_at', periodStart)

const avgDepth = sessions.reduce((sum, s) => sum + (s.analytics?.depth_reached ?? 0), 0) / sessions.length
const totalBreakthroughs = sessions.reduce((sum, s) => sum + (s.analytics?.breakthrough_moments ?? 0), 0)
```

### File Locations

```
apps/web/src/app/[tenant]/dashboard/
└── page.tsx            # ATUALIZAR (adicionar cards + link)

apps/web/src/components/dashboard/
├── summary-cards.tsx (ou similar)   # ATUALIZAR (+2 cards)
└── course-analytics-table.tsx       # ATUALIZAR (+2 colunas)
```

### Testing

- Testes E2E no Epic 19 (validar dashboard nao quebra)
- Validar: cards renderizam para manager, nao aparecem para student
- Validar: link "Ver analise completa" navega para /analytics

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
