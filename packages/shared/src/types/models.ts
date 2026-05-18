export interface AILearningProfile {
  preferred_question_types: Array<
    | "clarificacao"
    | "suposicoes"
    | "evidencias"
    | "perspectivas"
    | "consequencias"
    | "aplicacao"
    | "metacognicao"
  >
  engagement_style: "reflective" | "impulsive" | "balanced"
  detail_orientation: "verbose" | "concise" | "balanced"
  reasoning_style: "analytical" | "creative" | "systematic" | "intuitive"
  avg_depth_achieved: number
  comprehension_trend: "improving" | "stable" | "declining"
  avg_qa_score: number
  strengths: string[]
  growth_areas: string[]
  adaptation_hints: string[]
  summary: string
  sessions_analyzed: number
  last_updated: string
  confidence: number
  version: number
}

// --- Interaction Types (shared across WS1 agents + WS2 course-designer) ---

import { z } from "zod"

export const interactionTypeSchema = z.enum(["socratic_dialogue", "quiz", "scenario", "assignment"])
export type InteractionType = z.infer<typeof interactionTypeSchema>

export type TenantPlan = "essencial" | "standard" | "premium"
export type UserRole = "student" | "leader" | "manager" | "admin" | "super_admin" | "instructor"
export type CourseStatus = "draft" | "published" | "archived"
export type SessionStatus = "active" | "completed" | "abandoned"
export type ChapterStatus = "draft" | "published"
export type QuestionStatus = "draft" | "active" | "archived"
export type EnrollmentStatus = "active" | "completed" | "dropped"
export type LearningMode = "read" | "listen" | "watch" | "slide"
export type SeniorityLevel = "junior" | "mid" | "senior" | "lead" | "manager"
export type TrailStatus = "draft" | "active" | "archived"
export type FeatureKey =
  | "courses"
  | "course_designer"
  | "quizzes"
  | "trails"
  | "assessments"
  | "webhooks"
  | "api_access"

export interface Chapter {
  id: string
  course_id: string
  tenant_id: string
  title: string
  content: string | null
  content_blocks: Record<string, unknown>[] | null
  learning_objective: string | null
  order: number
  status: ChapterStatus
  video_url: string | null
  audio_url: string | null
  slide_audio_url: string | null
  created_at: string
  updated_at: string
}

export interface ChapterSlide {
  id: string
  chapter_id: string
  tenant_id: string
  order: number
  image_url: string | null
  image_storage_path: string | null
  text_content: string | null
  text_status: "pending" | "generating" | "review" | "approved"
  audio_start_ms: number | null
  audio_end_ms: number | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface WhitelabelConfig {
  custom_texts?: {
    app_name?: string
    tagline?: string
    login_title?: string
    login_subtitle?: string
  }
  favicon_url?: string | null
  footer_text?: string
  support_email?: string
  custom_css?: string
}

export interface TenantBranding {
  logo_url?: string
  primary_color?: string
  secondary_color?: string
}

export interface TenantSettings {
  max_interactions_per_session?: number
  ai_model?: string
  features?: {
    ai_detection?: boolean
    learning_journal?: boolean
    certificates?: boolean
    analytics_dashboard?: boolean
  }
}

export interface Tenant {
  id: string
  name: string
  slug: string
  plan: TenantPlan
  status: "active" | "inactive"
  branding: TenantBranding
  settings: TenantSettings
  whitelabel_enabled: boolean
  whitelabel_config: WhitelabelConfig
  created_at?: string
  updated_at?: string
}
