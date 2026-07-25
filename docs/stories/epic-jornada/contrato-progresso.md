# CONTRATO DE PROGRESSO — JRN-E (montar/revisar jornada no meio do curso)

> Extensão do [contrato.md](contrato.md) para a story [JRN-E](JRN-E.story.md). Mesma disciplina:
> **a Trilha E1 entrega estas assinaturas; E2 e E3 codificam contra elas.** Se o código divergir
> deste doc, o `types.ts` real vence e este doc é corrigido — nunca o contrário.
>
> **Regra de ouro deste contrato:** nada aqui inventa um vocabulário novo para algo que o produto
> já modela. `ModuleStatus`, `ModuleJourneyItem`, `PlanDashboardData`, `StudyPlanDiagnostic`,
> `CumulativeExpected` são **importados**, não redesenhados (Constitution, Artigo IV — No Invention).

---

## 0. Por que este contrato existe

A Jornada de hoje assume aluno em dia 0. Três provas no código real:

| Prova | `arquivo:linha` | O que faz |
|:---|:---|:---|
| Partida neutra ignora progresso | `apps/web/src/app/(platform)/jornada/_components/builder/journey-builder.tsx:48-50` | `neutralDurations(modules.length, finalDeadlineDays)` distribui a janela **cheia** sobre **todos** os módulos, inclusive os já concluídos |
| Progresso existe e é descartado | `apps/web/src/app/(platform)/jornada/page.tsx:141-146` vs `:190` | `fetchPlanDashboardData` roda no MESMO request, mas só alimenta o dashboard; `builderContext={context}` vai sem progresso |
| Contexto do construtor não tem progresso | `apps/web/src/lib/journey/types.ts:62-72` | `JourneyCourseContext` carrega módulos e deadlines, zero estado de conclusão |

O motor de estado por módulo **já existe e é o certo**: `computeModuleJourney`
(`apps/web/src/lib/analytics/study-plan-dashboard.ts:60`) devolve `ModuleJourneyItem`
(`:41-50`) com `status: ModuleStatus` (`:31`). Este contrato o leva até o construtor.

---

## 1. Tipos existentes que são REUSADOS (nenhum sinônimo novo)

```ts
// apps/web/src/lib/analytics/study-plan-dashboard.ts:31
export type ModuleStatus = "done" | "doing" | "planned"

// apps/web/src/lib/analytics/study-plan-dashboard.ts:41-50
export interface ModuleJourneyItem {
  chapterId: string
  title: string
  order: number
  interactionsExpected: number
  reflectionsExpected: number
  status: ModuleStatus
  suggestedDeadline: string | null
}

// apps/web/src/lib/analytics/plan-dashboard-data.ts:33-51
export interface PlanDashboardData { /* moduleJourney, weeklyComparison, cumulativeExpected, ... */ }

// apps/web/src/lib/analytics/study-plan-projection.ts:45-73
export interface StudyPlanDiagnostic {
  progressNow: number          // :47   — % LIFETIME (desde a matrícula)
  progressTarget: number | null
  sessionsDoneCount: number    // :56-59 — contagem LIFETIME, doc explícito no código
  reflDoneCount: number
  /* ... */
}
```

**Consequência dura:** `progressNow` e `sessionsDoneCount` são **lifetime**, contados desde a
matrícula. É exatamente por isso que existe o `baseline` da §4: sem ele, o dashboard credita à
jornada trabalho feito antes dela existir.

---

## 2. `JourneyModuleProgress` — o estado por módulo que entra no contexto

**Dono: E1.** Arquivo: `apps/web/src/lib/journey/types.ts` (edição aditiva).

```ts
import type { ModuleStatus } from "@/lib/analytics/study-plan-dashboard"

/**
 * Progresso REAL de um módulo no instante de montar/revisar a jornada.
 * `status` é o MESMO ModuleStatus de computeModuleJourney (study-plan-dashboard.ts:31/60),
 * importado, nunca redefinido. Os contadores são leituras reais; nada é estimado.
 */
export interface JourneyModuleProgress {
  /** Reusa ModuleJourneyItem["status"] — "done" | "doing" | "planned". */
  status: ModuleStatus
  /** Sessões concluídas neste capítulo (mesmo predicado status='completed' de
   *  plan-dashboard-data.ts:228-230). */
  sessionsDone: number
  /** Reflexões respondidas neste capítulo (slide_reflections do aluno). */
  reflectionsDone: number
  /** Fração [0,1] do trabalho do módulo já feito:
   *  min(1, (sessionsDone + reflectionsDone) / (interactionsExpected + reflectionsExpected)).
   *  `status === "done"` força 1. Denominador 0 → 0. */
  completedRatio: number
  /** true ⟺ status === "done". Módulo frozen NÃO consome janela futura. */
  frozen: boolean
}
```

`JourneyModuleMeta` (`types.ts:52-60`) ganha o campo **obrigatório**:

```ts
export interface JourneyModuleMeta {
  chapterId: string
  title: string
  order: number
  interactionsExpected: number   // segue 1 (journey-plan-data.ts:112) — ver Q1 da story
  reflectionsExpected: number
  /** JRN-E — sempre populado por fetchJourneyCourseContext. Obrigatório de
   *  propósito: um consumidor que ignore progresso não deve compilar. */
  progress: JourneyModuleProgress
}
```

> **Obrigatório, não opcional.** Um `progress?:` deixaria E2/E3 compilarem ignorando o progresso —
> exatamente a falha que esta story existe para corrigir. O preço é que E1 entrega o contrato no
> Ato 1 e E2/E3 partem dele (mesma sequência do contrato original: A-fase-0 antes de B/C).

---

## 3. Janela restante — `JourneyCourseContext` estendido

**Dono: E1.** `types.ts` + `apps/web/src/lib/journey/journey-plan-data.ts:68` (`fetchJourneyCourseContext`).

```ts
export interface JourneyCourseContext {
  courseId: string
  courseTitle: string
  /** INALTERADO — T0 da matrícula. Hoje = enrollment.created_at, via
   *  fetchLeadingEnrollmentContext (plan-dashboard-data.ts:130). NÃO é a âncora
   *  de planejamento do que resta: para isso existe planningAnchorDate. */
  startDate: string
  finalDeadlineDays: number          // INALTERADO — courses.deadline_days (courses.ts:27)
  managerDeadlineDays: number | null // INALTERADO — courses.manager_deadline_days (courses.ts:31)
  modules: JourneyModuleMeta[]       // agora com .progress

  // --- JRN-E, aditivo -----------------------------------------------------
  /** Teto duro de COORTE em data absoluta: startDate + finalDeadlineDays.
   *  Imune ao momento do clique (decisão do Hugo, 2026-07-25). null sem deadline. */
  cohortDeadlineDate: string | null
  /** Meta do gestor em data absoluta: startDate + managerDeadlineDays.
   *  null quando managerDeadlineDays é null (o caso REAL nos dois tenants hoje). */
  cohortManagerDeadlineDate: string | null
  /** Âncora do planejamento do que RESTA (ISO). Sempre HOJE — montar ou revisar
   *  replaneja a partir de agora, nunca do passado. */
  planningAnchorDate: string
  /** Dias entre planningAnchorDate e cohortDeadlineDate, clampado em 0.
   *  0 ⟺ o teto de coorte já venceu (ver §7 Bordas). */
  remainingWindowDays: number
}
```

---

## 4. `JourneyBaseline` e a nova forma de `JourneyPlan`

**Dono: E1.** `types.ts` + `journey-plan-data.ts:128` (`mapRowToJourneyPlan`) +
`apps/web/src/app/(platform)/jornada/actions.ts:28` (`mapRow`) e `:142` (`buildWritePayload`).

```ts
/** Duração ancorada no capítulo — a VERDADE PERSISTIDA a partir do JRN-E.
 *  Substitui o array posicional puro de study-plans.ts:37, que desliza quando um
 *  capítulo é publicado/despublicado/reordenado. Janela de custo zero: study_plans
 *  tem 0 linhas em produção (apurado 2026-07-25). */
export interface JourneyModuleDuration {
  chapterId: string
  days: number
}

/** Fotografia do progresso no instante da montagem — o "ponto de partida".
 *  Base do delta "combinado × realizado" (decisão 3 do Hugo). */
export interface JourneyBaseline {
  /** ISO datetime da 1ª confirmação da jornada. */
  capturedAt: string
  /** diagnostic.progressNow na montagem (study-plan-projection.ts:47). */
  progressPct: number
  /** diagnostic.sessionsDoneCount na montagem (study-plan-projection.ts:56-59). */
  sessionsDone: number
  /** diagnostic.reflDoneCount na montagem. */
  reflectionsDone: number
  /** Capítulos concluídos na montagem — o conjunto congelado, para o dashboard
   *  distinguir "veio de antes" de "fiz na jornada" mesmo com progresso esparso. */
  completedChapterIds: string[]
}
```

`JourneyPlan` (`types.ts:24-48`) ganha três campos e **mantém `moduleDurations: number[]`**:

```ts
export interface JourneyPlan {
  /* ... campos atuais inalterados ... */

  /** PROJEÇÃO DERIVADA, realinhada contra os capítulos publicados HOJE, na ordem
   *  de `order`. Continua `number[]` DE PROPÓSITO: é o que dashboard-model.ts:136,
   *  page.tsx:180 e api/analytics/plan-dashboard/route.ts:96 já consomem. Esses
   *  três consumidores NÃO mudam por causa da ancoragem. */
  moduleDurations: number[]

  // --- JRN-E, aditivo -----------------------------------------------------
  /** VERDADE PERSISTIDA (coluna study_plans.module_durations, forma nova). */
  moduleDurationsByChapter: JourneyModuleDuration[]
  /** Âncora do replanejamento do que resta. Persistida na coluna JÁ EXISTENTE
   *  study_plans.recalculated_at (study-plans.ts:47) — zero coluna nova para isto. */
  planningAnchorDate: string
  /** null só em jornadas gravadas antes do JRN-E (nenhuma existe em produção). */
  baseline: JourneyBaseline | null
}
```

### Realinhamento (E1)

```ts
/**
 * Projeta a verdade persistida na ordem dos capítulos publicados de hoje.
 * - capítulo conhecido  → seus `days` persistidos
 * - capítulo NOVO       → MIN_DAYS_PER_MODULE (plan-math.ts:8), e o total é
 *                         re-clampado por fitRemainingToDeadline
 * - capítulo removido   → entrada ignorada, SEM deslizar os vizinhos
 * Determinística e pura.
 */
export function alignDurationsToChapters(
  persisted: JourneyModuleDuration[],
  chapterIdsInOrder: readonly string[],
): number[]
```

---

## 5. Funções puras da janela restante (`plan-math.ts`, dono E1)

Aditivas. **Nada existente é reescrito:** `MIN_DAYS_PER_MODULE` (`plan-math.ts:8`),
`neutralDurations` (`:27`), `fitToDeadline` (`:39`), `normalizeDurations` (`:75`),
`moduleEndDates` (`:96`), `plannedCompletionDate` (`:106`) e `zoneOf` (`:116`) continuam
válidos e são a base das funções abaixo.

```ts
export interface RemainingWindow {
  /** = context.planningAnchorDate (hoje). */
  anchorDate: string
  /** = context.remainingWindowDays (≥ 0). */
  remainingDays: number
  /** true quando o teto de coorte já venceu (remainingDays === 0 com teto no passado). */
  expired: boolean
  /** índices (na ordem de `modules`) dos módulos concluídos — duração fixa em 0. */
  frozenIndices: number[]
  /** índices dos módulos que ainda consomem janela — duração ≥ MIN_DAYS_PER_MODULE. */
  remainingIndices: number[]
}

/** Deriva a janela a partir do contexto. Pura; nada de Date.now() escondido. */
export function computeRemainingWindow(
  modules: ReadonlyArray<Pick<JourneyModuleMeta, "progress">>,
  planningAnchorDate: string,
  cohortDeadlineDate: string | null,
): RemainingWindow

/**
 * Partida do construtor CONSCIENTE DO PROGRESSO — substitui neutralDurations
 * (plan-math.ts:27) no fluxo de montagem em curso.
 * - frozen                 → 0 dias, exato
 * - parcial (0<ratio<1)    → fatia × (1 - completedRatio), piso MIN_DAYS_PER_MODULE
 * - intocado               → fatia cheia
 * Onde `fatia` = remainingDays distribuído entre os remainingIndices. O resultado
 * sempre passa por fitRemainingToDeadline. Comprimento === modules.length.
 */
export function progressAwareNeutralDurations(
  modules: ReadonlyArray<Pick<JourneyModuleMeta, "progress">>,
  window: RemainingWindow,
): number[]

/** fitToDeadline restrito aos remainingIndices; frozen permanecem em 0 exato. */
export function fitRemainingToDeadline(durations: number[], window: RemainingWindow): number[]

/** normalizeDurations consciente de frozen (a fronteira de escrita confia nisto):
 *  comprimento === window.frozenIndices.length + window.remainingIndices.length,
 *  frozen === 0 exato, vivos ≥ MIN_DAYS_PER_MODULE, soma dos vivos ≤ remainingDays.
 *  Lança em input inválido, igual a normalizeDurations (plan-math.ts:75). */
export function normalizeRemainingDurations(durations: number[], window: RemainingWindow): number[]

/** Datas de fim por módulo a partir da ÂNCORA (não do T0 da matrícula).
 *  frozen → null (concluído não tem prazo futuro). Sibling de moduleEndDates
 *  (plan-math.ts:96), que continua existindo e não muda de comportamento. */
export function moduleEndDatesAnchored(
  durations: number[],
  window: RemainingWindow,
): (string | null)[]
```

### Invariantes que E2 e E3 podem assumir sem re-checar

1. `durations.length === context.modules.length`, sempre.
2. `frozenIndices` e `remainingIndices` são disjuntos e cobrem todos os índices.
3. `durations[i] === 0` ⟺ `i ∈ frozenIndices` ⟺ `modules[i].progress.frozen`.
4. `soma(durations[i] para i ∈ remainingIndices) <= window.remainingDays`, exceto quando
   `remainingIndices.length * MIN_DAYS_PER_MODULE > remainingDays` (janela impossível — ver §7).
5. `moduleEndDatesAnchored` nunca devolve data anterior a `window.anchorDate`.

---

## 6. Motor de progresso por módulo (`module-progress.ts`, dono E1)

Arquivo **novo**: `apps/web/src/lib/journey/module-progress.ts`.

```ts
import type { ModuleJourneyItem } from "@/lib/analytics/study-plan-dashboard"

/**
 * Converte o resultado do motor EXISTENTE (computeModuleJourney,
 * study-plan-dashboard.ts:60) + contagens reais por capítulo no
 * JourneyModuleProgress do contrato. NÃO reimplementa a regra done/doing/planned:
 * ela chega pronta em `journey[i].status`. Pura, testável.
 */
export function buildModuleProgress(
  journey: readonly ModuleJourneyItem[],
  sessionsByChapter: ReadonlyMap<string, number>,
  reflectionsByChapter: ReadonlyMap<string, number>,
): Map<string, JourneyModuleProgress>
```

**Proibido nesta função:** derivar `status` por conta própria. O predicado
`completedChapterIds`/`continueChapterId` mora em `plan-dashboard-data.ts:228-234` e, se
precisar ser compartilhado, é **extraído** para um helper puro exportado em
`study-plan-dashboard.ts` e o chamador original passa a usá-lo — uma fórmula, dois chamadores,
nunca duas (mesma disciplina de `buildStudyPlanDiagnostic`, `plan-dashboard-data.ts:298`, cujo
JSDoc em `:291-297` documenta exatamente esse motivo: *"one formula, two callers, never two"*).

---

## 7. Bordas obrigatórias (as três trilhas tratam, o contrato define o valor)

| Borda | Valor no contrato | Quem renderiza |
|:---|:---|:---|
| Progresso esparso com buraco (módulo 3 intocado entre concluídos) | `frozenIndices` **não** é prefixo; é qualquer subconjunto | E2 (timeline com buraco), E3 (tabela) |
| Módulo "done" com 1 de 5 perguntas | `frozen: true`, `completedRatio: 1` — a regra `done` do motor existente manda | E2 (trava), E3 (mostra "concluído") |
| Módulo com reflexões feitas e 0 interações | `status: "planned"`, `frozen: false`, `completedRatio > 0` | E2 (duração proporcional ao que resta, editável) |
| Teto de coorte já vencido | `remainingDays: 0`, `expired: true`; `normalizeRemainingDurations` devolve todos os vivos em `MIN_DAYS_PER_MODULE` (invariante 4 quebra por impossibilidade, nunca por bug) | E2 (estado honesto "prazo vencido", zona `red` de `zoneOf`, `plan-math.ts:116`) |
| `managerDeadlineDays` nulo (caso REAL hoje) | `cohortManagerDeadlineDate: null`; `zoneOf` degrada para verde-até-o-final | E2 e E3 (sem chip de meta, sem `needLabel` de meta) |
| Capítulo publicado depois da montagem | entra com `MIN_DAYS_PER_MODULE` via `alignDurationsToChapters`, total re-clampado | E2 (aparece editável), E3 (aparece na tabela) |

---

## 8. Baseline no dashboard (o que E3 consome, sem query nova)

`buildDashboardModel` (`dashboard-model.ts:121-127`) **já recebe tudo**:

```ts
buildDashboardModel(input: {
  plan: JourneyPlan          // → plan.baseline, plan.planningAnchorDate, plan.moduleDurations
  context: JourneyCourseContext // → context.modules[i].progress
  planDashboardData: PlanDashboardData
  diagnostic: StudyPlanDiagnostic // → progressNow / sessionsDoneCount LIFETIME
  nowMs: number
}): DashboardModel
```

Fórmula do delta (decisão 3 do Hugo — combinado × realizado é **desde a montagem**):

```
deltaProgressPct   = max(0, diagnostic.progressNow      - (plan.baseline?.progressPct   ?? 0))
deltaSessionsDone  = max(0, diagnostic.sessionsDoneCount- (plan.baseline?.sessionsDone  ?? 0))
deltaReflections   = max(0, diagnostic.reflDoneCount    - (plan.baseline?.reflectionsDone ?? 0))
```

`DashboardModel` (`dashboard-model.ts:73-93`) ganha, **sem remover campo algum**:

```ts
export interface DashboardModel {
  /* ... campos atuais ... */
  /** JRN-E — ponto de partida exibido À PARTE, nunca somado ao mérito do plano. */
  startingPoint: {
    progressPct: number
    sessionsDone: number
    reflectionsDone: number
    modulesDone: number
    capturedAt: string
  } | null
  /** JRN-E — o que foi feito DEPOIS da montagem (base do "realizado"). */
  sinceJourney: { progressPct: number; sessionsDone: number; reflectionsDone: number }
}
```

**Regras duras para E3:**
- `isDayZero` (`dashboard-model.ts:157`) passa a olhar o **delta**, não o lifetime — hoje
  `sessionsDone <= 0 && progressPct <= 0` nunca é verdade para aluno em curso, e o dia-0 legítimo
  de uma jornada recém-montada no meio do curso nunca aparece.
- `donePerWeek` / `combinedPerWeek` (`dashboard-model.ts:389-391`) dividem o **delta** por semanas
  desde a âncora. Hoje dividem o total lifetime por semanas desde `plan.startDate` — para o aluno
  de 50% isso infla o ritmo em ~2x no primeiro dia da jornada.
- `startingPoint` **nunca** entra em `progressPct`, `ringPct` nem em nenhuma frase da Leitura da IA
  como conquista da jornada. É contexto, não mérito.

---

## 9. Fronteira de escrita (E1, sequenciada)

`SaveJourneyInput` (`types.ts:76-81`) **não muda de forma** — o construtor continua enviando
`moduleDurations: number[]`. A conversão para a forma ancorada acontece na fronteira do servidor:

```ts
// actions.ts:142 buildWritePayload — passa a:
//   1. resolver os chapterIds publicados na ordem de `order`
//   2. validar com normalizeRemainingDurations (não mais normalizeDurations)
//   3. gravar module_durations como JourneyModuleDuration[]
//   4. gravar recalculated_at = planningAnchorDate
//   5. na PRIMEIRA confirmação, gravar o baseline
```

> **Pré-requisito temporal.** `actions.ts` está sendo alterado agora por outra tarefa (âncora de
> COORTE em `final_deadline_date`). **JRN-E não inclui essa correção e não pode começar E1 pela
> `actions.ts` antes dela pousar.** Ordem: âncora de coorte → E1 Ato 2 (`actions.ts`). O Ato 1 de
> E1 (`types.ts` + `plan-math.ts` + `module-progress.ts`) não toca `actions.ts` e pode começar já.

---

## 10. Consumidores que NÃO mudam (prova de que a costura fecha)

| Arquivo | Linha | Por que sobrevive |
|:---|:---|:---|
| `apps/web/src/app/(platform)/jornada/page.tsx` | `:190` | `builderContext={context}` — o progresso viaja DENTRO do contexto |
| `apps/web/src/app/(platform)/jornada/page.tsx` | `:180` | `plan.moduleDurations` segue `number[]` (projeção derivada) |
| `apps/web/src/app/(platform)/jornada/_components/hub/journey-shell.tsx` | `:60`, `:162-169` | props do `JourneyBuilder` inalteradas |
| `apps/web/src/app/api/analytics/plan-dashboard/route.ts` | `:95-100` | `computeJourneyCumulativeExpected(plan.moduleDurations, ...)` segue válido |
| `apps/web/src/lib/analytics/study-plan-dashboard.ts` | `:204` | motor do comparativo da home intocado (ver Q2 da story) |

Se qualquer um desses precisar mudar durante a execução, é **sinal de que o contrato falhou** —
parar e renegociar aqui antes de editar, e não abrir território novo em silêncio.
