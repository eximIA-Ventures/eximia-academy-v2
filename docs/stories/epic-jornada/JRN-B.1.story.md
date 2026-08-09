# JRN-B.1 — Construtor da timeline + Revisar jornada

> **Epic:** EPIC-JORNADA · **Trilha:** B · **Status:** InReview (entregue, aguardando revisão do Capataz)
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

---

## Acceptance Criteria (verificados)

- [x] **AC1 — Motor puro testado.** `timeline-engine.ts` sem I/O/DOM/Date, importa `plan-math.ts` de A (não redefine `fitToDeadline`/`MIN`). Cobre drag (cascata + clamp entre vizinhos), snap semanal, teto duro por módulo (`maxDaysAt`/`capCascade`), presets clampados, rótulos. Os **7 casos do `proof-teto.js`** portados como asserções puras + mecânica adicional → **28/28 vitest**.
- [x] **AC2 — Construtor renderizável com dado do contrato.** `JourneyBuilder` monta timeline arrastável + banner + tabela + controles a partir de `JourneyCourseContext`; CTA "Começar minha jornada" entrega `{moduleDurations, preset, preferences}` ao `onConfirm` (plugado por C). Provado por RTL.
- [x] **AC3 — Timeline fiel.** Círculos 50px (nº + data interna), pares ícone·número (interações/reflexões) embaixo com 1ª ocorrência por extenso, segmentos 2 tons terracota espessura proporcional, régua de meses, chips HOJE + Meta do gestor (âmbar) + Disponível até (vermelho, teto duro).
- [x] **AC4 — Drag Safari-safe.** Posição escrita **SÍNCRONA** por `style` em cada `pointermove` (`layoutInto`), `pointercancel`/`blur` idempotentes, snap Semanas|Dias, switch Auto-ajuste (cascata on / clamp off), rótulo de duração ao vivo.
- [x] **AC5 — Sugerir + Voltar + banner.** Dropdown Tranquilo/Moderado/Intenso (consequência real clampada), "Voltar ao ponto de partida", banner 3 zonas + intervalo "você terá N semanas (M dias) para concluir".
- [x] **AC6 — Tabela sincronizada.** `# | Módulo | Interações | Reflexões | Período | Duração` com stepper ±, fonte única = `durations` (drag↔tabela), linha-resumo do intervalo.
- [x] **AC7 — Revisar com diff.** `JourneyReview` (modo active): fim antigo riscado→novo na tabela e no banner ("Sua conclusão: X → Y"), "Salvar alterações" só habilita com mudança real vs snapshot, "Voltar" descarta via snapshot. Provado por RTL.
- [x] **AC8 — Motion via tokens.** CSS consome `var(--mo-*, fallback)` (Trilha C publica em `theme.css`), press scale, `prefers-reduced-motion` desliga tudo.
- [x] **AC9 — Terminologia + mobile.** UI sempre "jornada"; timeline vertical <720px via `matchMedia`.
- [x] **Gates:** `tsc --noEmit` limpo no território B · `biome check` exit 0 · `vitest` **34/34** (28 engine + 6 render).

## Pendências para a integração final (fora do território B)

- Trocar o `onConfirm`/`onSave` mock pelas actions reais `saveJourneyPlan`/`updateJourneyPlan` de A — **plugado no `page.tsx` (Trilha C)**, que também passa `context`/`plan`/`nowDayOffset`.
- Publicar os tokens `--mo-*` em `theme.css` (Trilha C) — até lá o fallback local vale.
- `nowDayOffset` da revisão (dias desde T0 até hoje) é calculado no SSR pela Trilha C e passado como prop (default 0).
- Polimento de motion opcional (onda de 45ms/marco no "Sugerir", `diff-flash` no banner) — a reorganização já ocorre pela transição base dos segmentos; stagger fica como follow-up.

## Change Log

| Data | Mudança | Autor |
|:---|:---|:---|
| 2026-07-23 | Motor puro `timeline-engine.ts` + 28 testes (proof-teto portado). Construtor (`builder/*`) e Revisar (`review/*`) React fiéis à demo, CSS Module portado, 6 testes RTL. Gates verdes. Status → InReview. | Trilha B (Coder Opus) |

## File List

**Novos (território B):**
- `apps/web/src/lib/journey/timeline-engine.ts`
- `apps/web/src/lib/journey/__tests__/timeline-engine.test.ts`
- `apps/web/src/app/(platform)/jornada/_components/builder/journey.module.css`
- `apps/web/src/app/(platform)/jornada/_components/builder/journey-format.ts`
- `apps/web/src/app/(platform)/jornada/_components/builder/icons.tsx`
- `apps/web/src/app/(platform)/jornada/_components/builder/timeline-canvas.tsx`
- `apps/web/src/app/(platform)/jornada/_components/builder/module-table.tsx`
- `apps/web/src/app/(platform)/jornada/_components/builder/consequence-banner.tsx`
- `apps/web/src/app/(platform)/jornada/_components/builder/builder-controls.tsx`
- `apps/web/src/app/(platform)/jornada/_components/builder/journey-builder.tsx`
- `apps/web/src/app/(platform)/jornada/_components/builder/__tests__/render.test.tsx`
- `apps/web/src/app/(platform)/jornada/_components/review/journey-review.tsx`
