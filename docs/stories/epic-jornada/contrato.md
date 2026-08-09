# CONTRATO COMPARTILHADO — EPIC-JORNADA

> A fonte única de verdade entre as 3 trilhas. **A** entrega estas interfaces e assinaturas; **B** e **C** codificam contra elas com mock até A materializar. Espelho fiel do `types.ts` real (`apps/web/src/lib/journey/types.ts`, dono A). Se algo divergir, o `types.ts` vence e este doc é atualizado.

## 0. Terminologia (SPEC round 16)

Na UI, SEMPRE "jornada", nunca "plano". Em código (nomes de classe/símbolo/coluna), "plan"/"study_plan" é aceito (invisível ao usuário) — reusa o design `study_plans` já desenhado por `@data-engineer`. O tipo de domínio se chama `JourneyPlan`.

## 1. Modelo de dados canônico — `JourneyPlan`

O modelo da DEMO (duração por módulo) é o canônico da Jornada. Espelha o estado persistido `jornada-demo-v1` menos os campos efêmeros da demo (`weeks`, `hintDone` — que na plataforma real viram tempo real e UI-state, não persistem).

```ts
export type JourneyStatus = "draft" | "active" | "completed" | "paused"
// draft   = construindo, ainda não confirmou (demo: "proposto")
// active  = jornada valendo (demo: "ativo")
// completed / paused = ciclo de vida futuro (soft, nunca DELETE)

export type JourneyUnit = "w" | "d" // unidade de ajuste: semanas | dias (SPEC round 12)

export interface JourneyPreferences {
  /** Auto-ajuste: cascata do drag liga/desliga (SPEC round 6). Default true. */
  cascade: boolean
  /** Unidade de ajuste do stepper/drag (SPEC round 12). Default "w". */
  unit: JourneyUnit
}

/** Uma jornada ativa por enrollment (1 curso = 1 jornada). */
export interface JourneyPlan {
  id: string
  enrollmentId: string
  studentId: string
  courseId: string
  tenantId: string
  status: JourneyStatus
  /** Dias por módulo, ordenados por chapter.order. Min 4 dias/módulo.
   *  Soma clampada ao teto duro (final deadline) por fitToDeadline. */
  moduleDurations: number[]
  /** Qual modelo do "Sugerir jornada" está aceso: 1.3 (Tranquilo) | 1 (Moderado)
   *  | 0.75 (Intenso) | null (neutro/personalizado). */
  preset: number | null
  preferences: JourneyPreferences
  /** T0 — âncora do relógio da jornada (ISO date, meia-noite local). */
  startDate: string
  /** "Disponível até" (teto duro, nível curso). Derivado de courses.deadline_days
   *  + startDate; snapshot nullable. null quando o curso não tem deadline. */
  finalDeadlineDate: string | null
  /** "Meta do gestor" (recomendação, nível curso). Derivado de
   *  courses.manager_deadline_days + startDate. null quando não definida. */
  managerDeadlineDate: string | null
  recalculatedAt: string | null
  createdAt: string
  updatedAt: string
}
```

## 2. Contexto de curso (read-only, para o construtor e o dashboard)

Módulos = chapters publicados, ordenados. Interações/reflexões esperadas reusam a convenção das SH-3.x (1 interação/capítulo; reflexões = slides-com-bloco-de-reflexão via `countReflectionBlocks`).

```ts
export interface JourneyModuleMeta {
  chapterId: string
  title: string
  order: number
  interactionsExpected: number // convenção: 1 por capítulo
  reflectionsExpected: number  // COUNT(chapter_slides com reflexão)
}

export interface JourneyCourseContext {
  courseId: string
  courseTitle: string
  /** ISO date do início (T0) — quando a jornada existe, = plan.startDate;
   *  quando não existe ainda, = hoje (ponto de partida do construtor). */
  startDate: string
  finalDeadlineDays: number          // courses.deadline_days (teto duro; demo: 126)
  managerDeadlineDays: number | null // courses.manager_deadline_days (meta; demo: 105)
  modules: JourneyModuleMeta[]
}
```

## 3. Distribuição NEUTRA (ponto de partida do construtor, SPEC §2.3)

Quando não há jornada persistida, o construtor abre no ponto de partida neutro: dias distribuídos por igual (não um preset da IA). A entrega o helper puro:

```ts
/** Distribuição uniforme dos N módulos até o teto, min 4/módulo, clampada. */
export function neutralDurations(moduleCount: number, finalDeadlineDays: number): number[]
```

## 4. Funções puras compartilhadas (`plan-math.ts`, dono A — B importa)

```ts
export const MIN_DAYS_PER_MODULE = 4

/** Comprime proporcionalmente o excedente acima do mínimo até a soma == teto,
 *  quando estoura (SPEC round 19, fitDays). Nunca ultrapassa o teto. */
export function fitToDeadline(durations: number[], finalDeadlineDays: number): number[]

/** Datas de fim (ISO) de cada módulo dado o startDate + durations acumuladas. */
export function moduleEndDates(startDate: string, durations: number[]): string[]

/** Conclusão planejada (ISO) = startDate + soma(durations). */
export function plannedCompletionDate(startDate: string, durations: number[]): string

/** Zona semântica da conclusão vs meta/final (SPEC round 16/19):
 *  "green" ≤ meta · "amber" entre meta e final · "red" > final (guarda defensiva). */
export function zoneOf(
  plannedCompletionDays: number,
  managerDeadlineDays: number | null,
  finalDeadlineDays: number,
): "green" | "amber" | "red"

/** Valida/normaliza um array de durações vindo do cliente (min 4, inteiros,
 *  comprimento == nº de módulos, clamp ao teto). Lança em input inválido. */
export function normalizeDurations(
  durations: number[],
  moduleCount: number,
  finalDeadlineDays: number,
): number[]
```

> `timeline-engine.ts` (dono B) fica com a MECÂNICA de interação (drag pixel→dia, cascata `capCascade`, snap semanal, presets `suggest(Tranquilo|Moderado|Intenso)`), e importa estas funções puras. B não redefine `fitToDeadline`/`MIN_DAYS_PER_MODULE`.

## 5. Server Actions (o que A entrega — `jornada/actions.ts`)

Padrão do repo: `"use server"`, `createClient()` → `.auth.getUser()` → perfil (`role`, `tenant_id`) da tabela `users`. RLS-safe (o INSERT/UPDATE passa pelas policies de `study_plans`).

```ts
export interface SaveJourneyInput {
  enrollmentId: string
  moduleDurations: number[]
  preset: number | null
  preferences: JourneyPreferences
}

export type JourneyActionResult =
  | { ok: true; plan: JourneyPlan }
  | { ok: false; error: string }

/** Cria (status "active") ou faz upsert da jornada ativa da enrollment.
 *  Substitui o setConfirmed(true) local-only do "Começar minha jornada". */
export function saveJourneyPlan(input: SaveJourneyInput): Promise<JourneyActionResult>

/** Lê a jornada ativa do aluno autenticado (opcionalmente por enrollment).
 *  null quando não há jornada persistida (→ construtor abre no neutro). */
export function loadJourneyPlan(enrollmentId?: string): Promise<JourneyPlan | null>

/** Atualiza moduleDurations/preset/preferences de uma jornada ativa
 *  (fluxo "Salvar alterações" da Revisar jornada). */
export function updateJourneyPlan(input: SaveJourneyInput): Promise<JourneyActionResult>
```

## 6. Camada de dados SSR (o que A entrega — `journey-plan-data.ts`)

```ts
/** Contexto do curso líder do aluno (deadlines + módulos), read-only. null
 *  quando nenhuma enrollment tem deadline computável (mesma degradação de
 *  fetchLeadingEnrollmentContext, que é REUSADO por baixo). */
export function fetchJourneyCourseContext(
  supabase, studentId,
): Promise<JourneyCourseContext | null>

/** Jornada ativa persistida + contexto, para o page.tsx roteador. Fallback
 *  gracioso: se a tabela study_plans ainda não existir (migration não aplicada),
 *  retorna { plan: null, context } sem quebrar — a UI atual continua. */
export function fetchJourneyState(
  supabase, studentId,
): Promise<{ plan: JourneyPlan | null; context: JourneyCourseContext | null }>
```

**Reuso obrigatório (não reescrever):** `fetchLeadingEnrollmentContext`, `fetchPlanDashboardData`, `computeModuleJourney`, `computeWeeklyComparison`, `computeCumulativeExpected` (de `plan-dashboard-data.ts` / `study-plan-dashboard.ts`). O dashboard (C) reancorra o "esperado" no `moduleDurations` persistido, mas a comparação semanal realizado × combinado sai dos motores existentes.

## 7. Decisão de ROTA (Decisão 1, recomendada)

- Rota nova: `apps/web/src/app/(platform)/jornada/page.tsx` (dono C).
- `/meu-plano` → redirect para `/jornada` (cutover), OU evoluir no lugar (alternativa). **Pende GO do Hugo.** Até o GO, B e C constroem em `/jornada`; `/meu-plano` fica intacto.

## 8. Mapa de componentes por trilha (paths canônicos)

```
apps/web/src/app/(platform)/jornada/
├── page.tsx                         (C) SSR roteador por status
├── actions.ts                       (A) server actions
└── _components/
    ├── builder/                     (B) construtor timeline + tabela + banner + sugerir + auto-ajuste + unidade
    ├── review/                      (B) revisar jornada (diff antes→depois)
    ├── hub/                         (C) "Minhas jornadas" (3 cards)
    └── dashboard/                   (C) hero, 3 stats, Sua semana, acompanhamento, Leitura da IA, Visão de Ritmo

apps/web/src/lib/journey/
├── types.ts            (A) contrato
├── plan-math.ts        (A) puras compartilhadas (B importa)
├── journey-plan-data.ts(A) camada de dados SSR
├── timeline-engine.ts  (B) mecânica de interação
└── __tests__/          (A: plan-math/data; B: timeline-engine)
```
