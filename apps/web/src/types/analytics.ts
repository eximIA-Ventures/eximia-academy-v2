// ---------------------------------------------------------------------------
// Analytics Response Types — Epic 18 (Story 18.1)
// ---------------------------------------------------------------------------

// --- Shared ---

export type AlertSeverity = "critico" | "atencao" | "positivo"
export type AlertType =
  | "inactivity"
  | "likely_ai"
  | "depth_declining"
  | "persistent_resistance"
  | "breakthrough_streak"

export interface AnalyticsAlert {
  severity: AlertSeverity
  type: AlertType
  studentId: string
  studentName: string
  message: string
}

export interface KolbPoint {
  studentId: string
  studentName: string
  graspingAxis: number
  transformingAxis: number
  dominantStyle: string | null
}

export interface DivergenceRow {
  studentId: string
  studentName: string
  kolbTestStyle: string | null
  kolbAiStyle: string | null
  kolbDivergence: number | null
}

// --- Session Analytics JSONB (from Epic 17 Detector) ---

export interface SessionAnalyticsJsonb {
  cognitive_patterns?: string[]
  defense_mechanisms?: string[]
  values_revealed?: string[]
  depth_progression?: number[]
  emotional_journey?: string[]
  breakthrough_moments?: number
  abstraction_level?: number
  depth_reached?: number
  emotional_density_progression?: number[]
  ai_detection?: {
    probability: number
    confidence: string
    verdict: string
    flag: string | null
  }
  kolb_session_vector?: {
    grasping_axis: number
    transforming_axis: number
    indicators_count: number
  }
  closing_reason?: string
}

// --- AC1: GET /api/analytics/aggregate ---

export interface AggregateSummary {
  totalSessions: number
  avgDepth: number
  avgBreakthroughsPerSession: number
  aiDetectionRate: number
  engagementRate?: number
  deltaSessions?: number | null
  deltaDepth: number | null
  deltaBreakthroughs: number | null
}

// ---------------------------------------------------------------------------
// FASE 1a — Potential-based indicators (items 2.2, 2.3, 6)
// ---------------------------------------------------------------------------
// "Potencial" (denominator) is DERIVED — no direct column exists (see FASE 0b):
//   • reflectionPotential  = blockquotes in chapter_slides.text_content that match
//     the runtime isReflectionBlock() heuristic (replicated server-side).
//   • socraticPotential    = COUNT(questions WHERE status='active') per chapter,
//     restricted to socratic chapters (interaction_type NULL | 'socratic_dialogue').
//   • sessionPotential     = number of chapters in scope (Model A: 1 expected
//     advance/session per chapter).
// All three are PER-CURRICULUM counts (independent of how many students). The
// realized counts are scoped to the chosen view (unit / área-gestor / individual).

/** The three derived per-curriculum potentials for a set of chapters. */
export interface CurriculumPotential {
  /** Σ reflection-prompt blockquotes across the in-scope chapters' slides. */
  reflectionPotential: number
  /** Σ active socratic questions across the in-scope socratic chapters. */
  socraticPotential: number
  /** Number of chapters in scope (Model A session potential). */
  sessionPotential: number
}

/** Per-module (chapter) realized-vs-potential indicator pair (items 2.2). */
export interface ModuleIndicator {
  chapterId: string
  chapterTitle: string
  chapterOrder: number
  /** "% índice de Reflexões Slides" inputs. */
  reflectionsWritten: number
  reflectionPotential: number
  reflectionIndexPct: number
  /** "% índice de Interações Socráticas" inputs. */
  socraticRealized: number
  socraticPotential: number
  socraticIndexPct: number
}

/** Course-level rollup of the per-module indicators (items 2.2). */
export interface IndicatorTotals {
  reflectionsWritten: number
  reflectionPotential: number
  reflectionIndexPct: number
  socraticRealized: number
  socraticPotential: number
  socraticIndexPct: number
}

/** Item 2.2 payload: per-module indicators + course total. */
export interface ReflectionSocraticIndicators {
  perModule: ModuleIndicator[]
  total: IndicatorTotals
}

/**
 * Item 6 — Interaction modes as realized-vs-potential (replaces the old
 * vertical share/distribuição). `pct` = realized ÷ potential (clamped 0–100).
 */
export interface InteractionModePotential {
  mode: string
  label: string
  realized: number
  potential: number
  pct: number
}

/**
 * Scope selector shared by every FASE 1a calculation so each indicator can be
 * computed in the three views. EXACTLY ONE of the discriminating ids is used:
 *   • kind 'unit'       → areaId  = a `areas` row (UNIDADE: Minas Gerais, etc.)
 *   • kind 'area'       → groupId = a `manager_groups` row (ÁREA/GESTOR team)
 *   • kind 'individual' → studentId = a single `users` (role=student)
 *   • kind 'tenant'     → whole tenant (default, no extra id)
 */
export interface AnalyticsScope {
  kind: "tenant" | "unit" | "area" | "individual"
  /** UNIDADE filter (areas.id). Only when kind === 'unit'. */
  areaId?: string | null
  /** ÁREA/GESTOR team filter (manager_groups.id). Only when kind === 'area'. */
  groupId?: string | null
  /** INDIVIDUAL filter (users.id, role=student). Only when kind === 'individual'. */
  studentId?: string | null
  /** Optional course narrowing, orthogonal to the view kind. */
  courseId?: string | null
}

export interface DepthDistribution {
  level: number
  count: number
  label: string
}

export interface CognitivePatternCount {
  pattern: string
  count: number
}

export interface EmotionalJourneyPoint {
  step: number
  avgDensity: number
}

/**
 * "O loop que você causou" (redesign Analytics Apple-like, aba Uso da
 * Plataforma) — quantos alunos em risco foram acionados por nudge no escopo
 * atual e quantos tiveram uma sessão de estudo depois. Correlação observada
 * (notifications.sent_at → returned_at), nunca apresentada como causa provada.
 */
export interface LoopStats {
  /** Nudges enviados (sent_at IS NOT NULL) no escopo, todos os tipos somados. */
  acionados: number
  /** Desses, quantos tiveram uma sessão de estudo depois (returned_at setado). */
  voltaram: number
  /** voltaram ÷ acionados, 0–100 (0 quando acionados === 0). */
  returnRatePct: number
}

/** Severidade do "Feed de exceções" — mesma taxonomia canônica de student-triage.ts. */
export type ExceptionSeverity = "atencao" | "sem_acesso"

/** Um aluno que saiu do "normal" (feed de exceções, aba Uso da Plataforma). */
export interface ExceptionFeedItem {
  studentId: string
  studentName: string
  severity: ExceptionSeverity
  /** Motivo legível derivado da triagem canônica (nunca um baseline inventado). */
  reason: string
}

export interface AggregateAnalyticsResponse {
  summary: AggregateSummary
  depthDistribution: DepthDistribution[]
  kolbTeam: KolbPoint[]
  cognitivePatterns: CognitivePatternCount[]
  emotionalJourney: EmotionalJourneyPoint[]
  alerts: AnalyticsAlert[]
  divergenceTable: DivergenceRow[]
  // --- FASE 1a additions (all optional so existing item-1 consumers don't break) ---
  /** Item 2.2 — % índice de Reflexões Slides & % índice de Interações Socráticas. */
  indicators?: ReflectionSocraticIndicators
  /** Item 6 — interaction modes as realized ÷ potential. */
  interactionModePotentials?: InteractionModePotential[]
  /** Redesign Uso da Plataforma — "O loop que você causou". Optional & additive. */
  loopStats?: LoopStats
  /** Redesign Uso da Plataforma — "Feed de exceções". Optional & additive. */
  exceptionsFeed?: ExceptionFeedItem[]
}

// --- AC2: GET /api/analytics/students/[studentId] ---

export interface StudentHeader {
  id: string
  fullName: string
  avatarUrl: string | null
  plan: string | null
  lastSessionAt: string | null
  totalSessions: number
  totalCompleted: number
}

export interface LearnerProfileData {
  engagementStyle: string | null
  detailOrientation: string | null
  reasoningStyle: string | null
  avgDepthAchieved: number | null
  avgQaScore: number | null
  confidence: number | null
  comprehensionTrend: string | null
  kolbGraspingAxis: number | null
  kolbTransformingAxis: number | null
  kolbDominantStyle: string | null
  kolbStyleConfidence: number | null
  strengths: string[]
  growthAreas: string[]
  adaptationHints: string[]
  preferredQuestionTypes: string[]
  summary: string | null
  sessionCount: number
}

export interface CognitivePatternAggregated {
  pattern: string
  count: number
  lastSeen: string
}

export interface EvolutionPoint {
  sessionId: string
  date: string
  depthReached: number
  kolbGrasping: number | null
  kolbTransforming: number | null
  avgEmotionalDensity: number | null
  aiDetectionVerdict: string | null
}

export interface SessionListItem {
  id: string
  date: string
  courseTitle: string
  chapterTitle: string
  depthReached: number
  aiDetectionVerdict: string | null
  qaScore: number | null
  turnCount: number
  status: string
}

export interface Recommendation {
  type: string
  message: string
  priority: "high" | "medium" | "low"
}

export interface StudentAnalyticsResponse {
  header: StudentHeader
  learnerProfile: LearnerProfileData | null
  cognitivePatterns: CognitivePatternAggregated[]
  evolution: EvolutionPoint[]
  sessions: SessionListItem[]
  recommendations: Recommendation[]
  divergence: DivergenceRow | null
}

// --- AC3: GET /api/analytics/sessions/[sessionId] ---

export interface SessionAnalyticsHeader {
  sessionId: string
  studentId: string
  studentName: string
  courseTitle: string
  chapterTitle: string
  date: string
  turnCount: number
  status: string
  depthReached: number
  aiDetectionVerdict: string | null
  qaScore: number | null
}

export interface CognitiveAnalysis {
  dominantPatterns: Array<{ pattern: string; evidence: string; frequency: string }>
  implicitValues: string[]
  cognitiveLoops: string[]
  readinessLevel: string | null
  suggestedQuestionType: string | null
  aiDetection: {
    probability: number
    confidence: string
    verdict: string
    flag: string | null
    indicators: Array<{ type: string; description: string; weight: number }>
  } | null
}

export interface SessionJourney {
  depthProgression: number[]
  emotionalArc: string[]
  breakthroughCandidates: Array<{ trigger: string; marker: string }>
}

export interface SessionMetrics {
  emotionalDensityProgression: number[]
  abstractionLevel: number | null
  certaintyVsExploration: number | null
  defenseActive: boolean | null
  kolbSessionVector: {
    graspingAxis: number
    transformingAxis: number
    indicatorsCount: number
  } | null
}

export interface TranscriptMessage {
  id: string
  role: "user" | "assistant"
  content: string
  turnNumber: number
  createdAt: string
  annotations?: {
    depthLevel?: number
    detectedPattern?: string
    isBreakthrough?: boolean
    emotionalState?: string
  }
}

export interface SessionAnalyticsResponse {
  header: SessionAnalyticsHeader
  cognitiveAnalysis: CognitiveAnalysis
  journey: SessionJourney
  metrics: SessionMetrics
  transcript: TranscriptMessage[]
}

// ---------------------------------------------------------------------------
// ÁREA / GESTOR analytics — FASE 0 (item 8), consumed by FASE 1 API + UI
// ---------------------------------------------------------------------------
// TERMINOLOGY (do NOT confuse — see migration 20260530130000_area_gestor.sql):
//   • UNIDADE = the existing `areas` table (Minas Gerais, Ribeirão Preto). In
//     code this is the `area_id` / areaName surface. Stats type: `UnitStats`.
//   • ÁREA / GESTOR = a manager-owned TEAM of students (`manager_groups`),
//     possibly CORPORATIVO (spanning more than one UNIDADE). Stats: `AreaStats`
//     and the gestor-level rollup `ManagerStats`.
//
// `UnitStats` is re-declared here (kept structurally identical to the one in
// `components/analytics/unit-comparison.tsx`) so the three views — UNIDADE,
// ÁREA, INDIVIDUAL — share a single typed contract. Importing this type does
// not change the existing component's local definition (additive, no break).

/**
 * SH-1.1 — distribution quartiles of a per-student metric across a UNIDADE.
 * Feeds a reference "ruler" (SH-1.5 reancoragem) that resists the outlier
 * distortion the simple arithmetic mean suffers in small units (1–2 champions
 * dragging the average up). `median` is the 50th percentile; `p25`/`p75` bound
 * the interquartile range. Values carry the same rounding as the metric they
 * describe (completionPct → integer, avgDepth → 1 decimal).
 */
export interface ReferenceQuartiles {
  /** 50th percentile (median) of the per-student values. */
  median: number
  /** 25th percentile of the per-student values. */
  p25: number
  /** 75th percentile of the per-student values. */
  p75: number
}

/**
 * SH-1.1 — per-student distribution stats of a UNIDADE, the outlier-resistant
 * reference the student-home redesign (SH-1.2 IndicatorComparisonTable / SH-1.5
 * reancoragem) reads INSTEAD of only the arithmetic mean. Computed by the sibling
 * aggregation `computeUnitReferenceStats` (lib/analytics/area-gestor.ts), NOT by
 * `computeMetricBlock` (whose mean logic is untouched). Optional & additive.
 */
export interface UnitReferenceStats {
  /** Per-student `completionPct` distribution across the UNIDADE. */
  completionPct: ReferenceQuartiles
  /** Per-student `avgDepth` distribution; null when no student had a depth signal. */
  avgDepth: ReferenceQuartiles | null
}

/** Metrics for ONE UNIDADE (a site/`areas` row). Mirrors unit-comparison.tsx. */
export interface UnitStats {
  /** UNIDADE display name (areas.name). Kept `areaName` for back-compat with UI. */
  areaName: string
  totalStudents: number
  activeStudents: number
  completedSessions: number
  totalSessions: number
  reflectionCount: number
  avgSessionsPerStudent: number
  completionPct: number
  /**
   * FASE 2 (8.2 causa provável — dimensão PROFUNDIDADE). Average depth reached
   * across the in-scope sessions (same number the aggregate route already
   * derives from session_analytics.depth_reached). Optional & additive: existing
   * consumers (UI grid, computeMetricBlock callers) keep working untouched; only
   * the new 5-dimension cause inference reads it. When absent, the depth
   * dimension is simply skipped (never throws, never asserted).
   */
  avgDepth?: number
  /**
   * FASE 2 (8.2 causa provável — dimensão CONCLUSÃO CONSCIENTE). % of students
   * who BOTH completed AND wrote a reflection (concluiu + refletiu), 0–100.
   * Optional & additive for the same reasons as avgDepth.
   */
  consciousCompletionPct?: number
  /**
   * SH-1.1 — mean per-student count of DISTINCT active days (UTC calendar days
   * with ≥1 session). Consistency signal for the student-home "Consistência"
   * indicator (SH-1.2). In an aggregated block it is the MEAN per student (parallel
   * to avgSessionsPerStudent), NOT the union of days. Optional & additive: derived
   * by computeMetricBlock from data already loaded (no new query). Flows to
   * ComparableMetricBlock via `Omit<UnitStats,"areaName">`.
   */
  distinctActiveDays?: number
  /**
   * SH-1.1 — per-student distribution (median/p25/p75) of the UNIDADE population,
   * the outlier-resistant reference the redesign prefers over the arithmetic mean.
   * Populated ONLY for the student self-comparison's `unit` block (by
   * computeStudentComparison via computeUnitReferenceStats); the flat aggregate
   * blocks (units/areas/managers/courses) leave it absent. Optional & additive.
   */
  referenceStats?: UnitReferenceStats
}

/**
 * Metrics for ONE ÁREA / GESTOR group (manager_groups row).
 * Structurally mirrors `UnitStats` (so the comparison UI is symmetric) plus the
 * fields unique to a manager-owned team.
 */
export interface AreaStats {
  /** manager_groups.id */
  groupId: string
  /** manager_groups.name (the team/ÁREA name). */
  groupName: string
  /** Owning gestor (users.id), null if unassigned. */
  managerId: string | null
  /** Owning gestor display name, null if unassigned. */
  managerName: string | null
  /** CORPORATIVO flag (manager_groups.is_corporate). */
  isCorporate: boolean
  /** UNIDADE(s) this team spans (manager_group_units). 2+ when corporate. */
  units: Array<{ id: string; name: string }>
  // --- shared metric shape (parity with UnitStats) ---
  totalStudents: number
  activeStudents: number
  completedSessions: number
  totalSessions: number
  reflectionCount: number
  avgSessionsPerStudent: number
  completionPct: number
  /** FASE 2 (8.2) — see UnitStats.avgDepth. Optional & additive. */
  avgDepth?: number
  /** FASE 2 (8.2) — see UnitStats.consciousCompletionPct. Optional & additive. */
  consciousCompletionPct?: number
  /** SH-1.1 — see UnitStats.distinctActiveDays (mean per student). Optional & additive. */
  distinctActiveDays?: number
}

/**
 * Gestor-level rollup (one row per manager), aggregating across ALL groups they
 * own. Used for manager dashboards and the "Áreas / Gestor" comparison mode.
 */
export interface ManagerStats {
  managerId: string
  managerName: string
  /** Groups (ÁREAs) this gestor owns. */
  groupCount: number
  /** true if ANY owned group is corporate. */
  hasCorporateGroup: boolean
  /** Distinct UNIDADE(s) the gestor reaches across all owned groups. */
  unitCount: number
  // --- shared metric shape (parity with UnitStats / AreaStats) ---
  totalStudents: number
  activeStudents: number
  completedSessions: number
  totalSessions: number
  reflectionCount: number
  avgSessionsPerStudent: number
  completionPct: number
  /** FASE 2 (8.2) — see UnitStats.avgDepth. Optional & additive. */
  avgDepth?: number
  /** FASE 2 (8.2) — see UnitStats.consciousCompletionPct. Optional & additive. */
  consciousCompletionPct?: number
  /** SH-1.1 — see UnitStats.distinctActiveDays (mean per student). Optional & additive. */
  distinctActiveDays?: number
}

/**
 * Metrics for ONE COURSE, for use in the "Cursos" comparison mode.
 * Structurally mirrors the shared metric block of UnitStats / AreaStats so the
 * comparison UI (unit-comparison.tsx) renders all three modes uniformly AND so
 * a course is numerically comparable to a UNIDADE / ÁREA (same session-based
 * math via computeMetricBlock — NOT the enrollment-based manager-courses route).
 *
 * SCOPE: a course is a slice of the CURRICULUM ("the what"), not a universe of
 * students ("the who"). The student universe of a course = the distinct students
 * who have a session in ANY chapter of that course (session-based, deduped),
 * computed tenant-wide (additive access decision — NOT role-gated).
 *
 * Source of truth: aggregateCourseStats / buildComparison in
 * lib/analytics/area-gestor.ts (ComparisonResponse.courses). The old mapping
 * from the role-gated, enrollment-based manager-courses route is DEPRECATED for
 * this purpose — it was not symmetric with the unit/área math.
 */
export interface CourseStats {
  /** courses.id */
  courseId: string
  /** courses.title */
  title: string
  /** Completion status of the course itself ("published", "draft", etc.). */
  status: string
  // --- shared metric shape (parity with UnitStats / AreaStats / ManagerStats) ---
  totalStudents: number
  activeStudents: number
  completedSessions: number
  totalSessions: number
  reflectionCount: number
  avgSessionsPerStudent: number
  /**
   * Session-based completion (completedSessions ÷ (students × course chapters)),
   * IDENTICAL formula to UnitStats/AreaStats — so courses sit on the same axis.
   */
  completionPct: number
  /** FASE 2 (8.2) — see UnitStats.avgDepth. Optional & additive. */
  avgDepth?: number
  /** FASE 2 (8.2) — see UnitStats.consciousCompletionPct. Optional & additive. */
  consciousCompletionPct?: number
  /** SH-1.1 — see UnitStats.distinctActiveDays (mean per student). Optional & additive. */
  distinctActiveDays?: number
}

/** Comparison payload feeding unit-comparison.tsx's three modes. */
export interface ComparisonResponse {
  units: UnitStats[]
  areas: AreaStats[]
  managers: ManagerStats[]
  /**
   * Per-course session-based stats, tenant-wide, symmetric with units/areas.
   * Optional so existing consumers reading only units/areas/managers don't break.
   */
  courses?: CourseStats[]
}

// ---------------------------------------------------------------------------
// FASE 2 FOUNDATION — shared metric block, student comparison, role-based
// comparison permissions, pedagogical actions (8 / 8.2 / 1.2 / 1.3).
// ---------------------------------------------------------------------------

/**
 * The field-for-field common shape shared by UnitStats / AreaStats /
 * ManagerStats / CourseStats — i.e. everything EXCEPT each entity's own
 * identity fields. This is the SAME shape as the runtime
 * `Omit<UnitStats,"areaName">` returned by `computeMetricBlock`
 * (lib/analytics/area-gestor.ts) and re-exported there as `ComparableMetrics`
 * (lib/analytics/cause-inference.ts). It is exposed here so server routes and
 * components can name the shared block without importing a lib.
 *
 * NOTE the additive optional fields (avgDepth, consciousCompletionPct) flow
 * through automatically — they live on UnitStats, so Omit keeps them here.
 * The cause-inference lib's `ComparableMetrics` alias stays valid: both resolve
 * to the identical structural type.
 */
export type ComparableMetricBlock = Omit<UnitStats, "areaName">

/**
 * 1.2 — STUDENT self-comparison payload. A student sees ONLY their OWN
 * performance next to the AVERAGE of their UNIDADE (one reference, read-only,
 * NO PII of other students). Both sides use the shared metric block so the
 * existing comparison rendering stays uniform.
 *
 * The `student` block is the metrics of the single logged-in student (their
 * own sessions/reflections). The `unit` block is the aggregate of the student's
 * UNIDADE (computed exactly like UnitStats via computeMetricBlock). `unitName`
 * is the UNIDADE display name for labeling. When the student has no UNIDADE,
 * `unit` is null and the UI shows only the student's own numbers.
 */
export interface StudentComparison {
  /** Logged-in student's own metric block (their sessions/reflections only). */
  student: ComparableMetricBlock
  /**
   * Aggregate metric block of the ORGANIZATION (the single reference, M2).
   * null when there is no reference to show (tenant has no students).
   */
  unit: ComparableMetricBlock | null
  /** M2: null — the reference is the whole organization, not a named unidade. */
  unitName: string | null
  /**
   * "Meu ritmo" operational indicators (Hugo 2026-07-12): Você vs the org average
   * for last-access / ritmo / progress / engagement. null mirrors `unit === null`.
   */
  indicators: StudentHomeIndicators | null
}

/** The ritmo display badge state (mirror of ritmo-badge.tsx RitmoDisplay). */
export type StudentRitmoDisplay =
  | "concluido"
  | "no_ritmo"
  | "atrasado"
  | "sem_acesso"
  | "nao_iniciado"

/** "Você" side of the 4 operational indicators. */
export interface StudentHomeSubject {
  /** Days since the student's last access; null = never accessed. Lower is better. */
  lastAccessDays: number | null
  /** The student's ritmo badge state; undefined when there is no ritmo signal. */
  ritmoDisplay?: StudentRitmoDisplay
  /**
   * "Onde você está" (Hugo 2026-07-14): the NAME of the LAST module/chapter the
   * student COMPLETED (e.g. "Módulo 3: Precificação"), for the student self-view.
   * Derived subject-scoped (student_id), never org-wide. null when the student
   * has completed nothing yet → the cell falls back to "Começando". Você-only;
   * the Média da turma never renders this.
   */
  lastCompletedLabel?: string | null
  /** Course/deadline-based progress % (matches the gestor "Progresso" column). */
  progressPct: number
  /** Engagement score = interactions*2 + reflections. Higher is better. */
  engagement: number
  /** Completed sessions ("interações") — the breakdown behind the score. */
  interactions: number
  /** Reflections — the other half of the engagement breakdown. */
  reflections: number
  /**
   * SH-F.5 — the ceiling of engagement on the STUDENT's own trail:
   * `trailChapters*2 + reflectionPossibleSlides`. OPTIONAL and additive: when
   * present the "Você" engagement number renders as the fraction "X de N"; when
   * absent it degrades to the plain absolute "X". Você-only (the Média stays
   * absolute). Derived FRESH per request (never cached).
   */
  engagementMax?: number
  /**
   * SH-1.5 — denominator of the "Interações realizadas" row fraction: the number
   * of chapters on the student's OWN trail (each chapter caps at 1 completable
   * interaction). Distinct from `engagementMax` (which is a weighted SUM ×2/×1 of
   * both interactions and reflections — never a per-row denominator). OPTIONAL and
   * additive: when present the "Você" interactions cell renders "X/Y"; when absent
   * (or 0) it degrades to the plain absolute "X". Você-only (the Média stays
   * absolute). Derived FRESH per request (never cached).
   */
  interactionsMax?: number
  /**
   * SH-1.5 — denominator of the "Reflexões realizadas" row fraction: the number
   * of trail slides that have at least one reflection prompt. Same shape/degradation
   * as `interactionsMax`. Você-only. Derived FRESH per request (never cached).
   */
  reflectionsMax?: number
  /**
   * SH-1.5 (AC7, REGRA DE NEGÓCIO CRÍTICA) — TRUE only when a REAL backend
   * computation confirms this student ranks #1 (strictly, no tie — AC12) in
   * engagement across ALL comparable org students. NEVER hardcoded/approximated:
   * it is the only signal that unlocks "1º da turma" copy and the "mais engajado
   * da turma" summary opening. LGPD: this is a boolean of the OWN student only —
   * the client never receives the ordered list, ranks, or scores of peers.
   * OPTIONAL/additive: absent → treated as NOT top (falls back to win/tie/behind).
   */
  isTopEngagement?: boolean
}

/** "Média da organização" side of the 4 operational indicators (org-wide, M2). */
export interface StudentHomeReference {
  /**
   * Mean recency in days across students who HAVE accessed (D1: never-accessed
   * students are excluded — that is missing data, not bad recency). null when no
   * org student has ever accessed.
   */
  lastAccessAvgDays: number | null
  /** "% em dia" = (no_ritmo + concluído) / total org students * 100 (D2). */
  ritmoEmDiaPct: number
  /** Mean course/deadline progress % across all org students (D3). */
  progressAvgPct: number
  /** Mean engagement score across all org students. */
  engagementAvg: number
  /** Mean completed sessions ("interações") across all org students. */
  interactionsAvg: number
  /** Mean reflections across all org students. */
  reflectionsAvg: number
}

export interface StudentHomeIndicators {
  subject: StudentHomeSubject
  reference: StudentHomeReference
}

/**
 * The comparison "modes" a user can perform. Mirrors the UI's ComparisonMode
 * plus the student self-view (`self`) and the per-area unit/individual scopes.
 *   • self        — 1.2 student view: own performance vs OWN unidade average.
 *   • units       — compare UNIDADEs (areas) against each other.
 *   • areas       — compare ÁREA/GESTOR teams (manager_groups) / gestor rollups.
 *   • courses     — compare courses against each other.
 */
export type ComparisonMode = "self" | "units" | "areas" | "courses"

/** The four application roles (mirrors users.role / profiles.role). */
export type AnalyticsRole = "student" | "manager" | "admin" | "super_admin"

/**
 * 1.2 — COMPARISON PERMISSIONS BY ROLE (fixed rules, NO config screen).
 * Single source of truth for which comparison modes a role may perform. The
 * server MUST enforce these (never trust the client) and the UI SHOULD use them
 * to decide which mode toggles to render.
 *
 * RULES (Hugo's binding decision):
 *   • student     → ONLY `self`: own performance beside the average of their OWN
 *                   unidade/área. One reference, read-only, no PII of others.
 *   • manager     → `areas` (their team vs unidades) — i.e. the gestor compares
 *                   their team against unidades. (Does NOT get tenant-wide
 *                   unit×unit / course×course comparison — that's admin scope.)
 *   • admin       → EVERYTHING tenant-wide: units, areas, courses.
 *   • super_admin → EVERYTHING (same as admin at the analytics surface).
 *
 * Note: a manager who needs the corporate UNIT SELECTOR (item 8 toggle) still
 * operates within `areas`; the selector narrows the team's spanned unidade(s),
 * it is NOT a separate comparison mode (see CorporateUnitSelection below).
 */
export const COMPARISON_MODES_BY_ROLE: Record<AnalyticsRole, readonly ComparisonMode[]> = {
  student: ["self"],
  manager: ["areas"],
  admin: ["units", "areas", "courses"],
  super_admin: ["units", "areas", "courses"],
} as const

/** Type-guard helper: is `mode` permitted for `role`? (server + UI share it). */
export function canCompare(role: AnalyticsRole, mode: ComparisonMode): boolean {
  return COMPARISON_MODES_BY_ROLE[role]?.includes(mode) ?? false
}

/**
 * 8 — CORPORATE UNIT SELECTOR state. When a logged-in gestor owns a CORPORATIVO
 * group (spanning >1 UNIDADE), the dashboard shows a selector:
 *   • "Todas as unidades do grupo" (default, fan-out across every spanned unit)
 *   • a SPECIFIC unidade (narrow the team's view to one site).
 * `selectedUnitId === null` means "all units of the group" (the default).
 */
export interface CorporateUnitSelection {
  /** null = all units of the group (default fan-out); else a single areas.id. */
  selectedUnitId: string | null
}

// ---------------------------------------------------------------------------
// 1.3 — PEDAGOGICAL ACTIONS (advanced). Higher-order pedagogical levers (NOT
// the operational email/notify nudges already in next-best-action.tsx). Three
// kinds per Hugo's decision; the union is open-ended (extra `kind`s may be
// added additively).
//   • reopen_reflection   — DETERMINISTIC: reopen the reflection of the module
//                           with the LOWEST reflection index. targetIds carries
//                           the chapter/module id(s) to reopen.
//   • concept_clinic      — AI (semantic over reflections/sessions): a practice
//                           clinic on the 3 MOST FRAGILE concepts. targetIds may
//                           carry the concept labels/ids the clinic addresses.
//   • reflection_to_case  — AI: turn a HIGH-DEPTH reflection into a learning
//                           case. targetIds carries the source reflection/session id.
// ---------------------------------------------------------------------------

/** Discriminator for {@link PedagogicalAction}. Open union — extend additively. */
export type PedagogicalActionKind =
  | "reopen_reflection"
  | "concept_clinic"
  | "reflection_to_case"
  | (string & {}) // allow future kinds without breaking exhaustiveness for known ones

/**
 * A single advanced pedagogical action (1.3). `kind` selects the lever; `title`
 * is the short UI label; `detail` is the human-facing explanation/justification;
 * `targetIds` are the entity ids the action operates on (module/chapter ids,
 * reflection/session ids, or concept ids depending on `kind`); `severity`
 * optionally ranks urgency for ordering in the UI.
 */
export interface PedagogicalAction {
  kind: PedagogicalActionKind
  /** Short pt-BR label for the action button/card. */
  title: string
  /** Human-facing explanation / why this action is suggested. */
  detail: string
  /**
   * Ids the action targets — semantics depend on `kind`:
   *   • reopen_reflection  → chapter/module id(s) whose reflection to reopen.
   *   • concept_clinic     → concept label(s)/id(s) of the fragile concepts.
   *   • reflection_to_case → source reflection/session id(s).
   */
  targetIds?: string[]
  /** Optional urgency ranking, reusing the analytics severity scale. */
  severity?: AlertSeverity
}
