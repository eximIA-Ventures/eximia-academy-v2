# JRN-A.3 — Camada de dados SSR + Fallback gracioso

> **Epic:** EPIC-JORNADA · **Trilha:** A · **Status:** Draft
> **Depende de:** JRN-A.1, JRN-A.2 · **Bloqueia:** `page.tsx` roteador (C)

## Story

Como `page.tsx` roteador da Jornada, preciso de UMA função que me dê a jornada ativa persistida + o contexto do curso (deadlines + módulos) numa chamada, reusando os fetchers existentes, e que degrade graciosamente (fallback ao comportamento atual) quando não há jornada salva ou a migration ainda não foi aplicada — para eu decidir hub × dashboard × construtor sem inventar dado.

## Escopo (territórios de A)

- `apps/web/src/lib/journey/journey-plan-data.ts` — NOVO: `fetchJourneyCourseContext`, `fetchJourneyState`.
- `apps/web/src/lib/journey/__tests__/journey-plan-data.test.ts` — NOVO (testa mapeamento/fallback com supabase mockado).

## Detalhes / Reuso obrigatório

- `fetchJourneyCourseContext`: reusa `fetchLeadingEnrollmentContext` (de `plan-dashboard-data.ts`) para achar a enrollment líder + deadlines; monta `modules[]` a partir de `chapters` publicados + reflexões via `countReflectionBlocks` (mesma query de `fetchPlanDashboardData`). `managerDeadlineDays` vem de `courses.manager_deadline_days` (fallback: null → UI não mostra meta, ou deriva `deadline_days − 21` conforme Decisão 3 do Hugo).
- `fetchJourneyState`: chama `loadJourneyPlan` (via SELECT direto server-side ou reusa a action) + `fetchJourneyCourseContext`; retorna `{ plan, context }`. Se a tabela `study_plans` não existir → captura o erro, `plan: null`, contexto ainda retornado (UI atual segue).
- **Não reescrever** `computeModuleJourney`/`computeWeeklyComparison`/`computeCumulativeExpected` — o dashboard (C) os consome; A só entrega o `plan.moduleDurations` para reancorar o "esperado".

## Critérios de Aceite

1. `fetchJourneyCourseContext` retorna `JourneyCourseContext | null` (null na mesma condição que `fetchLeadingEnrollmentContext` retorna null).
2. `fetchJourneyState` nunca lança quando a tabela não existe (fallback → `{ plan: null, context }`).
3. `modules[]` ordenado por `order`, com `interactionsExpected: 1` e `reflectionsExpected` real (reuso de `countReflectionBlocks`).
4. Zero reescrita dos motores de dashboard existentes (só chamadas/composição).
5. Read-only: nenhuma mutação nesta camada.

## Gates

- `pnpm --filter web typecheck` — verde.
- `pnpm --filter web test -- journey-plan-data` — verde.
- `pnpm --filter web lint` — verde no escopo.

## Critério de Saída

Camada de dados entregue e testada; C consegue montar o roteador `page.tsx` sobre `fetchJourneyState` sem tocar em backend.
