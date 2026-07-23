# JRN-B.1 — Construtor da timeline + Revisar jornada

> **Epic:** EPIC-JORNADA · **Trilha:** B · **Status:** Draft (esqueleto — agente B expande)
> **Depende de:** contrato.md (types + plan-math de A). Constrói contra MOCK até A entregar.
> **Territórios (disjuntos de A e C):**
> - `apps/web/src/lib/journey/timeline-engine.ts` (mecânica de interação; importa `plan-math.ts` de A)
> - `apps/web/src/app/(platform)/jornada/_components/builder/*`
> - `apps/web/src/app/(platform)/jornada/_components/review/*`
> - `apps/web/src/lib/journey/__tests__/timeline-engine.test.ts`

## Story

Como aluno recém-inscrito, construo minha jornada arrastando módulos numa timeline, com dois prazos visíveis (meta do gestor + prazo final como teto duro), auto-ajuste, modos semanas/dias, e "Sugerir jornada" (Tranquilo/Moderado/Intenso clampados), e reviso depois com diff antes→depois — fiel à demo aprovada.

## Fonte da verdade

`JARVIS/apps/jornada-demo/` — `SPEC.md` (Ato 2 §3, ACs 5/14/15/18–22/27–31/36–41), `index.html`, `app.js` (portar a mecânica de `S.days`, drag, `capCascade`, `fitDays`, snap semanal, presets, `zoneOf`, `endsOf`). Provas numéricas: `/tmp/jornada-proof/proof-teto.js`, `proof-coreografia.js`.

## Escopo (resumo — B detalha os ACs)

1. **`timeline-engine.ts` (puro):** drag pixel→dia, cascata (Auto-ajuste on) vs clamp entre vizinhos (off), snap semanal (unit "w") vs fino (unit "d"), presets via `fitDays`/`fitToDeadline` (reusa `plan-math.ts`), teto duro (round 19 — nenhuma interação passa do final). Testes portando `proof-teto.js`.
2. **Construtor React (`builder/`):** timeline arrastável (círculos ≥44px, segmentos com gradiente Coreografia), tabela "Seus módulos, em detalhe" sincronizada (fonte única = durations), banner de consequência (3 zonas + intervalo de conclusão), dropdown "✨ Sugerir jornada", switch "Auto-ajuste", segmentado "Semanas | Dias", hint pulsante, "Voltar ao ponto de partida". Ao confirmar → chama `saveJourneyPlan` (action de A) via prop/callback.
3. **Revisar (`review/`):** modo `active`, diff "antigo riscado → novo", "Salvar alterações" habilitado só com mudança real → `updateJourneyPlan`.

## Regras duras (SPEC round 18)

Motion NATIVO (sem GSAP/CDN), tokens `--mo-*` do dialeto Coreografia (definidos por C em `theme.css` — B só consome), drag por atribuição síncrona de `style`, `pointercancel`/`blur` idempotentes, `prefers-reduced-motion` desliga tudo, terminologia "jornada" nunca "plano".

## Gates

- `pnpm --filter web typecheck` · `pnpm --filter web test -- timeline-engine` · `pnpm --filter web lint` — verdes.
- Smoke em http://localhost:3002/jornada (após A+C plugados).

## Contrato com A/C

- Importa `JourneyPlan`, `JourneyCourseContext`, `JourneyPreferences` de `@/lib/journey/types`.
- Recebe `context` + `plan|null` como props (montados por C no `page.tsx`).
- Chama `saveJourneyPlan`/`updateJourneyPlan` (actions de A) — mock até A entregar.
