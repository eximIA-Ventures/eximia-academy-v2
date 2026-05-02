/**
 * Blueprint Generation Types
 * Synced with microservice schemas
 */

export interface BlueprintGenerateRequest {
  course_id: string
  course_title: string
  business_goal?: string
  target_audience_role: string
  experience_level: 'novice' | 'junior_to_mid' | 'mid_level' | 'senior' | 'expert'
  prior_knowledge?: string[]
  total_duration_hours: number
  weeks?: number
  hours_per_week?: number
  delivery_mode?: 'online_async' | 'online_sync' | 'presential' | 'hybrid'
  cohort_based?: boolean
  learning_style?: string
  assessment_type?: string
  content_density?: 'lean' | 'comprehensive'
  tenant_id: string
  requested_by: string
}

export interface BlueprintGenerateResponse {
  job_id: string
  course_id: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  message: string
  estimated_time_seconds: number
}

export interface JobStatusResponse {
  job_id: string
  course_id: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress: {
    current_phase?: string
    percentage?: number
    objectives_generated?: number
    assessments_generated?: number
  }
  created_at: string
  updated_at: string
  blueprint_data?: Blueprint
  error?: string
}

export interface Blueprint {
  status: string
  course_title: string
  analysis: AnalysisOutput
  blueprint: BlueprintOutput
  summary: BlueprintSummary
}

export interface AnalysisOutput {
  input_summary: Record<string, any>
  framework_mix: FrameworkMix
  audience_profile: Record<string, any>
  constraints_analyzed: Record<string, any>
  processed_at: string
}

export interface FrameworkMix {
  primary_framework: string
  rationale: string
  supporting_frameworks: string[]
  methodology_mix: string
}

export interface BlueprintOutput {
  total_objectives: number
  objectives: LearningObjective[]
  assessments: Assessment[]
  bloom_progression: string[]
}

export interface LearningObjective {
  objective_id: string
  module_number: number
  bloom_level: string
  abcd: {
    audience: string
    behavior: string
    condition: string
    degree: string
  }
  objective_statement: string
}

export interface Assessment {
  objective_id: string
  assessment_type: string
  timing: 'formative' | 'summative'
  format: string
  rubric_required: boolean
  estimated_duration_min: number
}

export interface BlueprintSummary {
  total_modules: number
  total_objectives: number
  total_assessments: number
  framework: string
  bloom_progression: string[]
}

export interface CourseBlueprint {
  id: string
  course_id: string
  tenant_id: string
  blueprint_data: Blueprint
  framework: string
  total_objectives: number
  total_assessments: number
  bloom_progression: string[]
  status: 'draft' | 'approved' | 'applied' | 'archived'
  generated_at: string
  approved_by?: string
  approved_at?: string
  applied_to_course: boolean
  applied_at?: string
  created_at: string
  updated_at: string
}
