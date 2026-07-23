# JRN-C.1 — Hub "Minhas jornadas" + Dashboard + Tokens Coreografia + Home

> **Epic:** EPIC-JORNADA · **Trilha:** C · **Status:** Draft (esqueleto — agente C expande)
> **Depende de:** contrato.md; `fetchJourneyState` (A) para o `page.tsx`. Constrói contra MOCK até A entregar.
> **Territórios (disjuntos de A e B):**
> - `apps/web/src/app/(platform)/jornada/page.tsx` (SSR roteador — dono C)
> - `apps/web/src/app/(platform)/jornada/_components/hub/*`
> - `apps/web/src/app/(platform)/jornada/_components/dashboard/*`
> - `apps/web/src/styles/theme.css` (EDITA — só APPEND dos tokens `--mo-*`; dono C)
> - `apps/web/src/components/analytics/student-home-card.tsx` (EDITA — entrypoint → /jornada; dono C)

## Story

Como aluno com jornada ativa, escolho qual jornada ver no hub "Minhas jornadas" e acompanho no dashboard rico (combinado × realizado, Leitura da IA, Visão de Ritmo), reusando os motores de dados existentes reancorados na jornada persistida — fiel à demo aprovada.

## Fonte da verdade

`JARVIS/apps/jornada-demo/SPEC.md` — Ato 3 §3 (dashboard, ACs 16/23–26/32–35), "Minhas jornadas" (round 15, AC34–35), dialeto Coreografia (round 18, AC40). `index.html`/`app.js` para composição e `stats()`.

## Escopo (resumo — C detalha)

1. **`page.tsx` (SSR roteador):** usa `fetchJourneyState` (A). `plan == null` → construtor (B) no ponto de partida neutro (`neutralDurations`); `status active` → hub → dashboard. `/meu-plano` → redirect (pende Decisão 1 do Hugo).
2. **Hub (`hub/`):** "Minhas jornadas" — 3 cards (ASP ativa com barra real, Liderança 15% sem plano, Onboarding 100% concluída). Deriva de `status` + stats reais.
3. **Dashboard (`dashboard/`):** hero + 3 stat cards + "Sua semana" (deep-links reais de `area-gestor.ts`: `nextPendingInteractionHref`/`nextPendingReflectionHref`) + acompanhamento (reusa `computeWeeklyComparison`) + "Sua jornada planejada" (reusa `computeModuleJourney`, reancorado em `moduleDurations`) + Leitura da IA (4 estados) + Visão de Ritmo (anel + pace + mini-barras). TODO número de motor existente, zero fabricação.
4. **Tokens Coreografia:** APPEND em `theme.css` de `--mo-fast:150ms`, `--mo-base:220ms`, `--mo-slow:400ms`, `--mo-ease` (SPEC round 18). Sem reescrever regras existentes.
5. **Home:** `student-home-card.tsx` aponta o entrypoint da jornada para `/jornada` (copy por status). Pende Decisão 3 do Hugo.

## Reuso obrigatório (não reescrever)

`fetchPlanDashboardData`, `computeModuleJourney`, `computeWeeklyComparison`, `computeCumulativeExpected`, deep-links de `area-gestor.ts`. C reancorra o "esperado" em `plan.moduleDurations`; a comparação semanal sai dos motores.

## Gates

- `pnpm --filter web typecheck` · `pnpm --filter web test` (não regredir suites de `/meu-plano`) · `pnpm --filter web lint` — verdes.
- Smoke em http://localhost:3002/jornada.
- **Não quebrar `/meu-plano`** enquanto o redirect não é decidido.

## Contrato com A/B

- Importa tipos de `@/lib/journey/types`; monta props para o construtor (B) e o dashboard.
- `page.tsx` consome `fetchJourneyState` (A) — mock até A entregar.
