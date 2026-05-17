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

export interface AggregateAnalyticsResponse {
  summary: AggregateSummary
  depthDistribution: DepthDistribution[]
  kolbTeam: KolbPoint[]
  cognitivePatterns: CognitivePatternCount[]
  emotionalJourney: EmotionalJourneyPoint[]
  alerts: AnalyticsAlert[]
  divergenceTable: DivergenceRow[]
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
