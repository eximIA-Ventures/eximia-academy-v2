"use server"

import { bigFiveResultSchema, discResultSchema } from "@/lib/assessments/schemas"
import { createClient } from "@/lib/supabase/server"

/**
 * Seniority hierarchy for adjacency matching.
 * Lower index = lower seniority. Used to find "next level" trails.
 */
const SENIORITY_ORDER = ["junior", "mid", "senior", "lead", "manager"] as const
type SeniorityLevel = (typeof SENIORITY_ORDER)[number]

/** Relevance tiers for sorting: lower number = higher priority. */
const RELEVANCE_ROLE_MATCH = 1
const RELEVANCE_ADJACENT = 2
const RELEVANCE_POPULAR = 3

const MAX_SUGGESTIONS = 5

/** Profile-based keyword matching (Story 29.6) */
const PROFILE_KEYWORDS: Record<string, string[]> = {
  // Big Five dimensions
  openness: ["inovacao", "criativ", "design", "estrateg", "pesquisa", "explorat"],
  conscientiousness: ["gestao", "processo", "qualidade", "compliance", "planejamento", "organiz"],
  extraversion: ["lideranca", "comunicacao", "vendas", "negociacao", "apresent", "equipe"],
  agreeableness: ["colabor", "atendimento", "suporte", "mentoria", "facilitac", "mediacao"],
  neuroticism_low: ["pressao", "crise", "resiliencia", "decisao", "autonomia"],
  // DISC types
  dominance: ["lideranca", "resultado", "estrateg", "gestao", "execut", "decisao"],
  influence: ["comunicacao", "marketing", "vendas", "relacionamento", "motivac", "engajamento"],
  steadiness: ["processo", "suporte", "operac", "consistencia", "atendimento", "rotina"],
  conscientiousness_disc: ["analise", "dados", "financ", "qualidade", "auditoria", "tecnic"],
}

const PROFILE_SCORE_WEIGHT = 0.3
const BASE_SCORE_WEIGHT = 0.7
const PROFILE_MATCH_THRESHOLD = 0.15

export interface TrailSuggestion {
  id: string
  title: string
  description: string | null
  estimated_hours: number | null
  target_job_role_id: string | null
  target_role_name: string | null
  target_seniority: string | null
  course_count: number
  enrollment_count: number
  relevance: typeof RELEVANCE_ROLE_MATCH | typeof RELEVANCE_ADJACENT | typeof RELEVANCE_POPULAR
  relevance_label: "role_match" | "adjacent" | "popular"
  profile_match: boolean
}

/**
 * Get the seniority indices that are "adjacent" to the given level.
 * Adjacent means the same level plus the next level up.
 * If user completed their level trail, we suggest the next level.
 */
function getAdjacentSeniorityLevels(level: SeniorityLevel): SeniorityLevel[] {
  const idx = SENIORITY_ORDER.indexOf(level)
  if (idx === -1) return []

  const adjacent: SeniorityLevel[] = []
  // Same seniority
  adjacent.push(SENIORITY_ORDER[idx])
  // One level up (next step in career)
  if (idx + 1 < SENIORITY_ORDER.length) {
    adjacent.push(SENIORITY_ORDER[idx + 1])
  }
  return adjacent
}

/**
 * Computes a profile match score (0-1) for a trail based on
 * keyword matching between the learner's personality profile and
 * the trail's title + description.
 *
 * Story 29.6: 30% profile weight in final scoring.
 */
function computeProfileScore(
  trailText: string,
  bigFive: {
    openness: number
    conscientiousness: number
    extraversion: number
    agreeableness: number
    neuroticism: number
  } | null,
  disc: { d: number; i: number; s: number; c: number } | null,
): number {
  if (!bigFive && !disc) return 0

  const text = trailText.toLowerCase()
  let totalWeight = 0
  let matchedWeight = 0

  // Big Five keyword matching
  if (bigFive) {
    const dimensions: Array<{ key: string; score: number }> = [
      { key: "openness", score: bigFive.openness },
      { key: "conscientiousness", score: bigFive.conscientiousness },
      { key: "extraversion", score: bigFive.extraversion },
      { key: "agreeableness", score: bigFive.agreeableness },
    ]

    // Neuroticism is inverted (low neuroticism = resilience)
    if (bigFive.neuroticism < 34) {
      dimensions.push({ key: "neuroticism_low", score: 100 - bigFive.neuroticism })
    }

    for (const dim of dimensions) {
      if (dim.score < 50) continue // Only match strong traits
      const keywords = PROFILE_KEYWORDS[dim.key] ?? []
      const weight = dim.score / 100
      totalWeight += weight

      const hasMatch = keywords.some((kw) => text.includes(kw))
      if (hasMatch) {
        matchedWeight += weight
      }
    }
  }

  // DISC keyword matching
  if (disc) {
    const total = disc.d + disc.i + disc.s + disc.c
    if (total > 0) {
      const discDimensions: Array<{ key: string; score: number }> = [
        { key: "dominance", score: disc.d / total },
        { key: "influence", score: disc.i / total },
        { key: "steadiness", score: disc.s / total },
        { key: "conscientiousness_disc", score: disc.c / total },
      ]

      for (const dim of discDimensions) {
        if (dim.score < 0.3) continue // Only match dominant traits (>30%)
        const keywords = PROFILE_KEYWORDS[dim.key] ?? []
        const weight = dim.score
        totalWeight += weight

        const hasMatch = keywords.some((kw) => text.includes(kw))
        if (hasMatch) {
          matchedWeight += weight
        }
      }
    }
  }

  return totalWeight > 0 ? matchedWeight / totalWeight : 0
}

/**
 * Suggests up to 5 relevant trails for a student, sorted by relevance.
 *
 * Rules:
 * 1. If user has a job role -> trails targeting that role (exclude already enrolled)
 * 2. If user has a job role -> trails targeting adjacent roles in same area
 *    (e.g., junior -> mid seniority)
 * 3. Popular trails from the tenant (most enrollments)
 * 4. If no job role -> rule 3 only
 * 5. Profile-based scoring (30% weight) when assessments available (Story 29.6)
 *
 * Sort: relevance tier ASC, then composite score DESC
 */
export async function suggestTrails(userId: string): Promise<{
  data: TrailSuggestion[]
  error?: string
}> {
  const supabase = await createClient()

  // Auth check: verify the caller is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: [], error: "Não autenticado" }

  // Authorization: only own profile or admin roles
  if (user.id !== userId) {
    const { data: callerProfile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()
    if (!callerProfile || !["admin", "super_admin"].includes(callerProfile.role)) {
      return { data: [], error: "Acesso negado" }
    }
  }

  // 1. Get user profile with job role info
  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id, job_role_id, role")
    .eq("id", userId)
    .single()

  if (!profile) return { data: [], error: "Perfil não encontrado" }
  if (profile.role !== "student") return { data: [], error: "Apenas alunos recebem sugestões" }

  const tenantId = profile.tenant_id

  // 2. Get all trail IDs the user is already enrolled in
  const { data: existingEnrollments } = await supabase
    .from("enrollments")
    .select("trail_id")
    .eq("student_id", userId)
    .not("trail_id", "is", null)

  const enrolledTrailIds = new Set(
    (existingEnrollments ?? []).map((e) => e.trail_id).filter(Boolean),
  )

  // 3. Get all active trails for the tenant with their target role info
  const { data: allTrails } = await supabase
    .from("learning_trails")
    .select("id, title, description, estimated_hours, target_job_role_id, status")
    .eq("status", "active")

  if (!allTrails || allTrails.length === 0) return { data: [] }

  // Filter out already-enrolled trails
  const candidateTrails = allTrails.filter((t) => !enrolledTrailIds.has(t.id))

  if (candidateTrails.length === 0) return { data: [] }

  // 4. Get course counts for candidate trails
  const candidateIds = candidateTrails.map((t) => t.id)
  const { data: trailCoursesData } = await supabase
    .from("trail_courses")
    .select("trail_id")
    .in("trail_id", candidateIds)

  const courseCountMap = new Map<string, number>()
  for (const tc of trailCoursesData ?? []) {
    courseCountMap.set(tc.trail_id, (courseCountMap.get(tc.trail_id) ?? 0) + 1)
  }

  // 5. Get enrollment counts for popularity ranking
  const { data: enrollmentCounts } = await supabase
    .from("enrollments")
    .select("trail_id")
    .in("trail_id", candidateIds)
    .not("trail_id", "is", null)

  const enrollmentCountMap = new Map<string, number>()
  for (const e of enrollmentCounts ?? []) {
    if (e.trail_id) {
      enrollmentCountMap.set(e.trail_id, (enrollmentCountMap.get(e.trail_id) ?? 0) + 1)
    }
  }

  // 6. Get job role info for all target roles
  const targetRoleIds = [
    ...new Set(
      candidateTrails
        .filter((t): t is typeof t & { target_job_role_id: string } => !!t.target_job_role_id)
        .map((t) => t.target_job_role_id),
    ),
  ]
  const { data: jobRoles } = targetRoleIds.length
    ? await supabase
        .from("job_roles")
        .select("id, name, seniority_level, area_id")
        .in("id", targetRoleIds)
    : { data: [] }

  const jobRoleMap = new Map((jobRoles ?? []).map((r) => [r.id, r]))

  // 7. Determine user's job role context
  let userJobRole: { id: string; area_id: string | null; seniority_level: string } | null = null
  if (profile.job_role_id) {
    const { data: role } = await supabase
      .from("job_roles")
      .select("id, area_id, seniority_level")
      .eq("id", profile.job_role_id)
      .single()
    userJobRole = role
  }

  // 8. Fetch user's assessment data for profile scoring (Story 29.6)
  let bigFiveScores: {
    openness: number
    conscientiousness: number
    extraversion: number
    agreeableness: number
    neuroticism: number
  } | null = null
  let discScores: { d: number; i: number; s: number; c: number } | null = null

  const { data: assessments } = await supabase
    .from("assessment_history")
    .select("assessment_type, result")
    .eq("user_id", userId)
    .in("assessment_type", ["big_five", "disc"])
    .order("completed_at", { ascending: false })

  for (const a of assessments ?? []) {
    if (a.assessment_type === "big_five" && !bigFiveScores) {
      const parsed = bigFiveResultSchema.safeParse(a.result)
      bigFiveScores = parsed.success ? parsed.data : null
    }
    if (a.assessment_type === "disc" && !discScores) {
      const parsed = discResultSchema.safeParse(a.result)
      discScores = parsed.success ? parsed.data : null
    }
  }

  const hasProfile = bigFiveScores !== null || discScores !== null

  // 9. Score and classify each candidate trail
  const scored: TrailSuggestion[] = []
  const profileScoreMap = new Map<string, number>()
  const adjacentLevels = userJobRole
    ? getAdjacentSeniorityLevels(userJobRole.seniority_level as SeniorityLevel)
    : []

  for (const trail of candidateTrails) {
    const targetRole = trail.target_job_role_id ? jobRoleMap.get(trail.target_job_role_id) : null
    let relevance: number = RELEVANCE_POPULAR
    let relevanceLabel: TrailSuggestion["relevance_label"] = "popular"

    if (userJobRole && targetRole) {
      // Rule 1: Exact role match (same job role)
      if (trail.target_job_role_id === userJobRole.id) {
        relevance = RELEVANCE_ROLE_MATCH
        relevanceLabel = "role_match"
      }
      // Rule 2: Adjacent role in same area
      else if (
        targetRole.area_id &&
        targetRole.area_id === userJobRole.area_id &&
        adjacentLevels.includes(targetRole.seniority_level as SeniorityLevel)
      ) {
        relevance = RELEVANCE_ADJACENT
        relevanceLabel = "adjacent"
      }
    }

    // Profile-based scoring (Story 29.6) — cache for sort
    const trailText = `${trail.title} ${trail.description ?? ""}`
    const profileScore = hasProfile ? computeProfileScore(trailText, bigFiveScores, discScores) : 0
    profileScoreMap.set(trail.id, profileScore)

    scored.push({
      id: trail.id,
      title: trail.title,
      description: trail.description,
      estimated_hours: trail.estimated_hours,
      target_job_role_id: trail.target_job_role_id,
      target_role_name: targetRole?.name ?? null,
      target_seniority: targetRole?.seniority_level ?? null,
      course_count: courseCountMap.get(trail.id) ?? 0,
      enrollment_count: enrollmentCountMap.get(trail.id) ?? 0,
      relevance: relevance as TrailSuggestion["relevance"],
      relevance_label: relevanceLabel,
      profile_match: profileScore >= PROFILE_MATCH_THRESHOLD,
    })
  }

  // 10. Sort: relevance tier ASC, then composite score DESC
  // Composite = base_weight * popularity + profile_weight * profile_match
  const maxEnrollments = Math.max(...scored.map((s) => s.enrollment_count), 1)

  scored.sort((a, b) => {
    if (a.relevance !== b.relevance) return a.relevance - b.relevance

    // Within same tier: composite score (using cached profile scores)
    const aProfile = profileScoreMap.get(a.id) ?? 0
    const bProfile = profileScoreMap.get(b.id) ?? 0
    const aBase = a.enrollment_count / maxEnrollments
    const bBase = b.enrollment_count / maxEnrollments
    const aComposite = BASE_SCORE_WEIGHT * aBase + PROFILE_SCORE_WEIGHT * aProfile
    const bComposite = BASE_SCORE_WEIGHT * bBase + PROFILE_SCORE_WEIGHT * bProfile

    return bComposite - aComposite
  })

  // 11. Return top N
  return { data: scored.slice(0, MAX_SUGGESTIONS) }
}

/**
 * Story 29.6 — Convenience wrapper that returns trail suggestions
 * with profile-based scoring. Same as suggestTrails but makes the
 * profile scoring intent explicit in the API surface.
 */
export async function suggestTrailsByProfile(userId: string): Promise<{
  data: TrailSuggestion[]
  error?: string
}> {
  return suggestTrails(userId)
}
