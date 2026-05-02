import { interactionTypeSchema } from "@eximia/shared"
import { z } from "zod"
import { frameworkIdSchema } from "./shared"

// --- Course Design Brief — 6-Layer Input Schema (Architecture §6.1-6.7) ---

const contextFileSchema = z.object({
  name: z.string(),
  type: z.enum(["pdf", "pptx", "docx", "txt"]),
  content_summary: z.string().optional(),
})

const baseInputSchema = z.object({
  // Camada 1: Propósito (§6.1)
  course_title: z.string().min(5).max(200),
  business_goal: z.string().min(10).max(1000),
  behavior_change: z.string().min(10).max(1000),
  success_metrics: z.array(z.string()).optional(),
  problem_statement: z.string().max(2000).optional(),

  // Camada 2: Audiência (§6.2)
  target_audience: z.object({
    role: z.string().min(3),
    experience_level: z.enum(["iniciante", "intermediario", "avancado", "especialista"]),
    prior_knowledge: z.array(z.string()).optional(),
    group_size: z.number().min(1).max(500).optional(),
    motivation_context: z.string().optional(),
    learning_environment: z.enum(["presencial", "remoto", "hibrido"]).optional(),
    autonomy_level: z.enum(["guiado", "semi_autonomo", "autonomo"]).optional(),
  }),

  // Camada 3: Escopo & Conteúdo (§6.3)
  core_competencies: z.array(z.string()).optional(),
  topics_outline: z.array(z.string()).optional(),
  content_density: z.enum(["lean", "moderada", "densa"]).optional(),
  assessment_preference: z.enum(["formativa", "somativa", "mista"]).optional(),
  context_files: z.array(contextFileSchema).optional(),
  existing_materials_summary: z.string().max(5000).optional(),
  source_course_id: z.string().uuid().optional(),

  // Camada 4: Restrições (§6.4)
  total_duration_hours: z.number().min(1).max(200),
  constraints: z
    .object({
      weeks: z.number().optional(),
      hours_per_week: z.number().optional(),
      delivery_mode: z.enum(["presencial", "online_sync", "online_async", "hibrido"]).optional(),
      cohort_based: z.boolean().optional(),
      session_length_preference: z.number().min(15).max(240).optional(),
    })
    .optional(),

  // Camada 5: Preferências de Design (§6.5)
  framework: z.enum(["elc_plus", "kolb_4", "pbl_hmelo", "auto"]).default("auto"),
  interaction_strategy: z.enum(["bloom_mapped", "dominant", "custom"]).default("bloom_mapped"),
  dominant_interaction_type: interactionTypeSchema.optional(),
  language: z.enum(["pt-br", "en"]).default("pt-br"),
})

// --- Cross-validation refinements (AC4) ---

export const courseDesignerInputSchema = baseInputSchema
  .refine(
    (data) => {
      // dominant_interaction_type required if interaction_strategy === "dominant"
      if (data.interaction_strategy === "dominant") {
        return data.dominant_interaction_type != null
      }
      return true
    },
    {
      message: "dominant_interaction_type é obrigatório quando interaction_strategy é 'dominant'",
      path: ["dominant_interaction_type"],
    },
  )
  .refine(
    (data) => {
      // At least 1 content source required
      const hasCompetencies = data.core_competencies && data.core_competencies.length > 0
      const hasTopics = data.topics_outline && data.topics_outline.length > 0
      const hasFiles = data.context_files && data.context_files.length > 0
      const hasSource = data.source_course_id != null
      return hasCompetencies || hasTopics || hasFiles || hasSource
    },
    {
      message:
        "Forneça pelo menos uma fonte de conteúdo: core_competencies, topics_outline, context_files, ou source_course_id",
    },
  )

export type CourseDesignerInput = z.infer<typeof courseDesignerInputSchema>

// Partial input type for pre-validation (called BEFORE Zod parsing, from wizard UI)
export interface PartialBriefInput {
  course_title?: string
  business_goal?: string
  behavior_change?: string
  success_metrics?: string[]
  problem_statement?: string
  target_audience?: {
    role?: string
    experience_level?: string
    prior_knowledge?: string[]
    group_size?: number
    motivation_context?: string
    learning_environment?: string
    autonomy_level?: string
  }
  core_competencies?: string[]
  topics_outline?: string[]
  content_density?: string
  assessment_preference?: string
  context_files?: Array<{ name: string; type: string; content_summary?: string }>
  existing_materials_summary?: string
  source_course_id?: string
  total_duration_hours?: number
  constraints?: {
    weeks?: number
    hours_per_week?: number
    delivery_mode?: string
    cohort_based?: boolean
    session_length_preference?: number
  }
  framework?: string
  interaction_strategy?: string
  dominant_interaction_type?: string
  language?: string
}

// --- Pre-validation Gate (AC2 — Architecture §6.6) ---

export interface BriefValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  briefScore: number
}

export function validateBrief(input: PartialBriefInput): BriefValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // --- Blocking checks ---

  // Propósito mínimo
  if (!input.business_goal && !input.behavior_change) {
    errors.push("Defina pelo menos o objetivo de negócio ou a mudança de comportamento")
  }

  // Audiência mínima
  if (!input.target_audience?.role || !input.target_audience?.experience_level) {
    errors.push("Defina o público-alvo e seu nível de experiência")
  }

  // Duração mínima
  if (!input.total_duration_hours || input.total_duration_hours < 1) {
    errors.push("Defina a duração do curso (mínimo 1 hora)")
  }

  // Fonte de conteúdo
  const hasCompetencies = input.core_competencies && input.core_competencies.length > 0
  const hasTopics = input.topics_outline && input.topics_outline.length > 0
  const hasFiles = input.context_files && input.context_files.length > 0
  const hasSource = input.source_course_id != null
  if (!hasCompetencies && !hasTopics && !hasFiles && !hasSource) {
    errors.push("Forneça pelo menos uma fonte de conteúdo")
  }

  // --- Quality checks (warnings) ---

  // Goal sem verbo de ação
  if (input.business_goal) {
    const actionVerbs =
      /^(reduzir|aumentar|melhorar|eliminar|acelerar|otimizar|criar|implementar|desenvolver|capacitar|transformar|fortalecer|garantir|estabelecer)/i
    if (!actionVerbs.test(input.business_goal.trim())) {
      warnings.push("Reformule o business_goal com verbo de ação (ex: 'Reduzir...', 'Aumentar...')")
    }
  }

  // Duração curta
  if (input.total_duration_hours && input.total_duration_hours < 4) {
    warnings.push("Cursos abaixo de 4h geram blueprints limitados (máx 2 módulos)")
  }

  // Sem contexto externo
  if (!hasFiles && !hasTopics) {
    warnings.push("Sem material de referência, resultado pode ser genérico")
  }

  // Grupo grande sem cohort
  if (
    input.target_audience?.group_size &&
    input.target_audience.group_size > 50 &&
    !input.constraints?.cohort_based
  ) {
    warnings.push("Considere ativar cohort para peer review (grupo > 50 alunos)")
  }

  // Sem métricas
  if (!input.success_metrics || input.success_metrics.length === 0) {
    warnings.push("Adicionar métricas melhora as avaliações (Kirkpatrick L3-L4)")
  }

  const briefScore = calculateBriefScore(input)

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    briefScore,
  }
}

// --- Brief Score (AC3 — Architecture §6.6) ---

export type BriefScoreRating = "Excelente" | "Bom" | "Suficiente" | "Mínimo"

export function calculateBriefScore(input: PartialBriefInput): number {
  let score = 0

  // Camada 1: Propósito (35 pts — title 5 + goal 10 + change 10 + metrics 5 + problem 5)
  if (input.course_title) score += 5
  if (input.business_goal) score += 10
  if (input.behavior_change) score += 10
  if (input.success_metrics && input.success_metrics.length > 0) score += 5
  if (input.problem_statement) score += 5

  // Camada 2: Audiência (25 pts — role 8 + experience 8 + prior 4 + group 2 + motivation 3)
  if (input.target_audience?.role) score += 8
  if (input.target_audience?.experience_level) score += 8
  if (input.target_audience?.prior_knowledge && input.target_audience.prior_knowledge.length > 0)
    score += 4
  if (input.target_audience?.group_size) score += 2
  if (input.target_audience?.motivation_context) score += 3

  // Camada 3: Escopo (20 pts — competencies 10 + topics 5 + files 5)
  if (input.core_competencies && input.core_competencies.length > 0) score += 10
  if (input.topics_outline && input.topics_outline.length > 0) score += 5
  if (input.context_files && input.context_files.length > 0) score += 5

  // Camada 4: Restrições (15 pts — duration 8 + delivery 4 + cohort 3)
  if (input.total_duration_hours) score += 8
  if (input.constraints?.delivery_mode) score += 4
  if (input.constraints?.cohort_based != null) score += 3

  // Camada 5: Preferências (5 pts — framework 3 + strategy 2)
  if (input.framework && input.framework !== "auto") score += 3
  if (input.interaction_strategy && input.interaction_strategy !== "bloom_mapped") score += 2

  return Math.min(score, 100)
}

export function getBriefScoreRating(score: number): BriefScoreRating {
  if (score >= 90) return "Excelente"
  if (score >= 70) return "Bom"
  if (score >= 50) return "Suficiente"
  return "Mínimo"
}
