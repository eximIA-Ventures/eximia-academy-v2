import { z } from "zod"

// --- Kolb Profile ---

const kolbIndicatorSchema = z.object({
  indicator: z.string(),
  weight: z.number().min(0).max(1),
  evidence: z.string(),
})

const kolbProfileSchema = z.object({
  grasping_axis: z.number().min(-1).max(1),
  transforming_axis: z.number().min(-1).max(1),
  dominant_style: z.enum([
    "divergente",
    "assimilador",
    "convergente",
    "acomodador",
  ]),
  style_confidence: z.number().min(0).max(1),
  indicators_observed: z.array(kolbIndicatorSchema),
})

// --- Output Schema ---

export const perfiladorOutputSchema = z.object({
  preferred_question_types: z
    .array(
      z.enum([
        "clarificacao",
        "pressupostos",
        "perspectiva",
        "evidencia",
        "consequencias",
        "metacognicao",
      ]),
    )
    .max(4),
  engagement_style: z.enum(["reflective", "impulsive", "balanced"]),
  detail_orientation: z.enum(["verbose", "concise", "balanced"]),
  reasoning_style: z.enum([
    "analytical",
    "creative",
    "systematic",
    "intuitive",
  ]),
  avg_depth_achieved: z.number().min(1).max(7),
  comprehension_trend: z.enum(["improving", "stable", "declining"]),
  avg_qa_score: z.number().min(0).max(1),
  strengths: z.array(z.string()).max(5),
  growth_areas: z.array(z.string()).max(3),
  adaptation_hints: z.array(z.string()).max(5),
  summary: z.string().max(500),
  confidence: z.number().min(0).max(1),
  kolb_profile: kolbProfileSchema,
})

export type PerfiladorOutput = z.infer<typeof perfiladorOutputSchema>
