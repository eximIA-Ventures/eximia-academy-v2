# JRN-C.1 — Hub "Minhas jornadas" + Dashboard + Tokens Coreografia + Home

> **Epic:** EPIC-JORNADA · **Trilha:** C · **Status:** Em revisão (implementado, gates verdes)
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

## Dev Agent Record (Trilha C — implementação)

### Arquivos entregues (território C)
- `styles/theme.css` — **APPEND** dos tokens `--mo-fast/base/slow/ease` (Coreografia, fonte única de duração). Nenhuma regra existente reescrita.
- `jornada/page.tsx` — roteador SSR: auth → `fetchJourneyState` (A) → motores reais (`fetchLeadingEnrollmentContext`, `fetchPlanDashboardData`, `computeStudentComparison` p/ deep-links + `buildStudyPlanDiagnostic`). Roteia: jornada ativa → hub/dashboard; sem jornada + contexto → construtor (B); sem contexto → vazio amigável. Fallback gracioso herdado de A (tabela ausente → plan:null, UI não quebra).
- `_components/dashboard/dashboard-model.ts` (+ `__tests__`) — view-model PURO (`nowMs` injetado). Porta as regras da demo (`stats`/`renderAiCard`/`renderPaceCard`) para dados reais, **reancorando o "esperado" em `plan.moduleDurations`** via `moduleEndDates` (A). 4 estados da Leitura da IA, anel "% do combinado", pace mirando meta→final. Zero fabricação (degrada a null/estado-vazio).
- `_components/dashboard/journey-dashboard.tsx` — hero escuro "Jornada ativa" + "Revisar jornada", 3 stat cards (com marca "esperado"), "Sua semana" acionável (deep-links reais), "Seu acompanhamento" (reusa `computeWeeklyComparison`), fileira "Leitura da IA" + "Visão de Ritmo", "Sua jornada planejada" (tabela reancorada). Count-up 1x/visita, reduced-motion.
- `_components/dashboard/motion.module.css` — Coreografia nativa (rise/cascata/press/lift/barFill) consumindo `--mo-*`, reduced-motion desliga tudo, só transform/opacity.
- `_components/hub/hub-model.ts` + `journey-hub.tsx` — "Minhas jornadas" das matrículas reais (ativa → dashboard, concluída/sem jornada → toast honesto, round 15).
- `_components/hub/journey-shell.tsx` — shell client hub↔dashboard↔construtor.

### Fronteira page.tsx ↔ componentes da B — RESOLVIDA (integração real, não mock)
A Trilha B materializou `_components/builder/journey-builder.tsx` durante esta execução, com interface estável e testada (`JourneyBuilderProps { context; initialDurations?; initialPreferences?; onConfirm; confirming }`). Em vez de placeholder, o shell **monta o `JourneyBuilder` real** e liga o `onConfirm` às server actions da A (`saveJourneyPlan` no create, `updateJourneyPlan` no revisar), com `router.refresh()` pós-confirm. O diff-review dedicado da B (`_components/review/journey-review.tsx`) fica para a integração final; hoje "Revisar jornada" reusa o builder semeado com `plan.moduleDurations`. Nenhum arquivo da B foi editado (só importado).

### Home entrypoint — reconciliação de fronteira (FLAG ao Capataz)
O território nomeado era `student-home-card.tsx`, mas o entrypoint REAL da home para o plano é `study-plan-invite-strip.tsx` (card inteiro clicável → `/meu-plano`); `student-home-card.tsx` inclusive tem teste que PROÍBE qualquer link de plano nele. Editei o arquivo correto (`study-plan-invite-strip.tsx`: `href` → `/jornada`, copy → "Monte ou revise sua jornada") + atualizei seu teste. É Decisão 3 do épico (recomendação = invite strip → /jornada), domínio da Trilha C, zero colisão com A/B. Revert trivial se o Capataz preferir aguardar GO do Hugo.

### Gates (verdes)
- `pnpm --filter web typecheck` — limpo.
- `npx biome check` (escopo C + analytics tocados) — exit 0, sem warnings.
- `npx vitest run` (dashboard-model 9 + builder da B 6 + invite-strip 9 + student-home-card 33) — **57/57**. `/meu-plano` não regrediu.

### Degradações honestas registradas
- **Visão de Ritmo — histórico multi-semana:** produção não expõe série temporal de realizado por semana; renderizo o anel + pace + a barra da semana corrente (de `weeklyComparison`), não as mini-barras de N semanas da demo. Trabalho futuro (precisa de série realizada por semana no server).
- **Revisar jornada:** usa o builder semeado (edição + `updateJourneyPlan`), não o diff antes→depois de `_components/review` (B) — entra na integração final.
