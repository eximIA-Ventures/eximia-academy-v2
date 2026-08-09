# JRN-A.2 — Server Actions da Jornada + Contrato + Funções Puras

> **Epic:** EPIC-JORNADA · **Trilha:** A · **Status:** InProgress
> **Depende de:** JRN-A.1 · **Bloqueia:** integração de B/C

## Story

Como aluno, quando eu confirmo "Começar minha jornada" (ou salvo alterações na revisão), a jornada é persistida de verdade e recarregada ao voltar, com validação server-side (min 4 dias/módulo, clamp ao teto duro), para que o combinado não se perca entre sessões.

## Escopo (territórios de A)

- `apps/web/src/lib/journey/types.ts` — NOVO, o contrato (§1–2 do `contrato.md`).
- `apps/web/src/lib/journey/plan-math.ts` — NOVO, funções puras (§4 do contrato): `fitToDeadline`, `moduleEndDates`, `plannedCompletionDate`, `zoneOf`, `normalizeDurations`, `neutralDurations`, `MIN_DAYS_PER_MODULE`.
- `apps/web/src/app/(platform)/jornada/actions.ts` — NOVO: `saveJourneyPlan`, `loadJourneyPlan`, `updateJourneyPlan`.
- `apps/web/src/lib/journey/__tests__/plan-math.test.ts` — NOVO vitest.

## Detalhes

- Actions seguem o padrão do repo (`trails/actions.ts`): `"use server"`, `createClient()`, `.auth.getUser()`, perfil (`role`, `tenant_id`) de `users`. Retorno discriminado `{ ok: true, plan } | { ok: false, error }`.
- `saveJourneyPlan`: valida via `normalizeDurations` (min 4, comprimento == nº módulos, clamp ao `finalDeadlineDays`), resolve `student_id`/`tenant_id`/`course_id` da enrollment, upsert respeitando o índice único parcial (1 ativa/enrollment). `revalidatePath("/jornada")`.
- `loadJourneyPlan`: SELECT da jornada ativa do aluno autenticado; mapeia row → `JourneyPlan` (camelCase). null se inexistente.
- `updateJourneyPlan`: UPDATE de `module_durations`/`preset`/`preferences` da jornada ativa; `updated_at` via trigger.
- **Fallback gracioso:** se a tabela `study_plans` não existir (migration não aplicada), a action retorna `{ ok: false, error }` legível (não exceção não-tratada) e `loadJourneyPlan` retorna null — a UI atual não quebra.

## Critérios de Aceite

1. `types.ts` exporta exatamente as interfaces/tipos do `contrato.md` §1–2 e §5 (nomes idênticos).
2. `plan-math.ts` é 100% puro (sem I/O, sem `Date.now()` implícito escondido em regra de negócio testável — datas entram por parâmetro), com as 7 funções do contrato.
3. `fitToDeadline` nunca produz soma > teto e nunca reduz módulo abaixo de `MIN_DAYS_PER_MODULE` (asserção portada do `proof-teto.js` da demo).
4. `zoneOf` retorna green/amber/red conforme SPEC round 16/19.
5. As 3 actions existem com as assinaturas do contrato §5, retorno discriminado, e obtêm o usuário via `.auth.getUser()`.
6. `saveJourneyPlan`/`updateJourneyPlan` chamam `normalizeDurations` antes de escrever (nenhuma escrita sem validação).
7. Fallback: com a tabela ausente, nenhuma exceção não-tratada vaza para o SSR.

## Gates

- `pnpm --filter web typecheck` — verde.
- `pnpm --filter web test -- plan-math` (vitest do escopo) — verde.
- `pnpm --filter web lint` (biome ./src) — verde no escopo tocado.

## Critério de Saída

Contrato + puras + actions materializados, vitest das puras verde, typecheck do web verde. B e C conseguem importar `@/lib/journey/types` e mockar as actions.
