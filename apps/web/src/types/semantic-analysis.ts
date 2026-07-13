// ---------------------------------------------------------------------------
// Semantic Analysis Types — 6-Dimension Classification System
// ---------------------------------------------------------------------------

// --- Dimension Interfaces ---

export interface RodaDoAprendizado {
  stage: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
  stageName: string
  confidence: number
  evidence: string[]
}

export interface CMADistribution {
  corpo: number // percentage 0-100
  mente: number // percentage 0-100
  alma: number // percentage 0-100
  dominant: "corpo" | "mente" | "alma"
}

export interface MetanoiaLevel {
  level: 0 | 1 | 2 | 3 | 4
  levelName: string
  signals: string[]
}

export interface KolbSnapshot {
  style: string | null
  graspingAxis: number | null
  transformingAxis: number | null
}

export interface JungPsychicDepth {
  layer: "persona" | "ego" | "shadow" | "self"
  layerName: string
  confidence: number
  evidence: string[]
}

export interface EmotionalEngagement {
  level: 1 | 2 | 3 | 4
  levelName: string
  aiDetectionProbability: number
}

// --- Per-Student Classification Result ---

export interface SemanticAnalysisResult {
  studentId: string
  studentName: string
  courseId: string
  courseTitle: string

  roda: RodaDoAprendizado
  cma: CMADistribution
  metanoia: MetanoiaLevel
  kolb: KolbSnapshot
  jung: JungPsychicDepth
  engagement: EmotionalEngagement

  summary: string
  sessionsAnalyzed: number
  responsesAnalyzed: number
  analyzedAt: string
}

// --- Cohort/Course Aggregation ---

export interface SemanticCohortStats {
  totalStudents: number
  studentsAnalyzed: number

  // Roda distribution
  rodaDistribution: Array<{ stage: number; stageName: string; count: number }>
  avgRodaStage: number

  // CMA averages
  avgCmaCorpo: number
  avgCmaMente: number
  avgCmaAlma: number
  cmaDistribution: Array<{ dimension: string; count: number }>

  // Metanoia distribution
  metanoiaDistribution: Array<{ level: number; levelName: string; count: number }>
  avgMetanoiaLevel: number

  // Kolb distribution
  kolbDistribution: Array<{ style: string; count: number }>

  // Jung distribution
  jungDistribution: Array<{ layer: string; layerName: string; count: number }>

  // Engagement distribution
  engagementDistribution: Array<{ level: number; levelName: string; count: number }>
  avgEngagementLevel: number
}

// --- Dashboard Response ---

export interface SemanticDashboardResponse {
  cohort: SemanticCohortStats
  students: SemanticAnalysisResult[]
  lastAnalyzedAt: string | null
  pendingStudents: number
}

// --- Label Constants ---

export const RODA_STAGES: Record<number, string> = {
  1: "Despertar",
  2: "Questionar",
  3: "Pesquisar",
  4: "Experimentar",
  5: "Refletir",
  6: "Integrar",
  7: "Compartilhar",
  8: "Transformar",
}

export const METANOIA_LEVELS: Record<number, string> = {
  0: "Resistencia",
  1: "Abertura",
  2: "Compreensao",
  3: "Integracao",
  4: "Transformacao",
}

export const JUNG_LAYERS: Record<string, string> = {
  persona: "Persona",
  ego: "Ego",
  shadow: "Sombra",
  self: "Self",
}

export const ENGAGEMENT_LEVELS: Record<number, string> = {
  1: "Indiferente",
  2: "Participativo",
  3: "Envolvido",
  4: "Transformado",
}

export const CMA_LABELS: Record<string, string> = {
  corpo: "Corpo (Operacional)",
  mente: "Mente (Estrategico)",
  alma: "Alma (Proposito)",
}
