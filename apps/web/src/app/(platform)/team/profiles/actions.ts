"use server"

import { createClient } from "@/lib/supabase/server"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface TeamMember {
  id: string
  full_name: string
  area_ids: string[]
  job_role_id: string | null
  disc_dominant: string | null
  learning_style: string | null
  last_assessment_at: string | null
}

export interface DiscDistribution {
  D: number
  I: number
  S: number
  C: number
}

export interface BigFiveAverages {
  openness: number
  conscientiousness: number
  extraversion: number
  agreeableness: number
  neuroticism: number
}

export interface AreaOption {
  id: string
  name: string
}

export interface JobRoleOption {
  id: string
  name: string
}

export interface TeamCompletion {
  total: number
  discCompleted: number
  bigFiveCompleted: number
}

export interface TeamProfilesData {
  members: TeamMember[]
  discDistribution: DiscDistribution
  bigFiveAverages: BigFiveAverages
  areas: AreaOption[]
  jobRoles: JobRoleOption[]
  completion: TeamCompletion
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

interface BigFiveResult {
  openness: number
  conscientiousness: number
  extraversion: number
  agreeableness: number
  neuroticism: number
}

interface DiscResult {
  d: number
  i: number
  s: number
  c: number
  dominantType?: string
}

/** Normalise Big Five score to 0-100 regardless of original scale. */
function normaliseBigFive(value: number): number {
  // If on 1-5 scale, convert to 0-100
  if (value >= 0 && value <= 5) {
    return Math.round((value / 5) * 100)
  }
  // Already 0-100
  return Math.round(Math.min(100, Math.max(0, value)))
}

/** Determine DISC dominant type from result JSONB. */
function getDiscDominant(result: DiscResult): string {
  if (result.dominantType) {
    return result.dominantType.charAt(0).toUpperCase()
  }
  const mapping: Array<{ key: keyof DiscResult; label: string }> = [
    { key: "d", label: "D" },
    { key: "i", label: "I" },
    { key: "s", label: "S" },
    { key: "c", label: "C" },
  ]
  let max = -1
  let dominant = "D"
  for (const { key, label } of mapping) {
    const val = typeof result[key] === "number" ? (result[key] as number) : 0
    if (val > max) {
      max = val
      dominant = label
    }
  }
  return dominant
}

/* ------------------------------------------------------------------ */
/*  Main action                                                        */
/* ------------------------------------------------------------------ */

export async function getTeamProfiles(): Promise<
  { data: TeamProfilesData; error?: never } | { error: string; data?: never }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Não autenticado" }

  // Fetch caller profile
  const { data: callerProfile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single()

  if (!callerProfile) return { error: "Perfil não encontrado" }
  if (!["manager", "admin"].includes(callerProfile.role)) {
    return { error: "Permissão negada" }
  }
  if (!callerProfile.tenant_id) return { error: "Tenant não encontrado" }

  const tenantId = callerProfile.tenant_id

  // --- Determine which students to fetch ---
  let studentIds: string[] | null = null // null means "all students in tenant"

  if (callerProfile.role === "manager") {
    // Manager: only students in manager's areas
    const { data: managerAreas } = await supabase
      .from("user_areas")
      .select("area_id")
      .eq("user_id", user.id)

    const areaIds = (managerAreas ?? []).map((ua) => ua.area_id)

    if (areaIds.length > 0) {
      // Get all student user_ids in those areas
      const { data: areaUsers } = await supabase
        .from("user_areas")
        .select("user_id")
        .in("area_id", areaIds)

      const areaUserIds = [...new Set((areaUsers ?? []).map((au) => au.user_id))]
      studentIds = areaUserIds
    } else {
      // Manager with no areas assigned — show empty
      studentIds = []
    }
  }

  // --- Fetch students ---
  let studentsQuery = supabase
    .from("users")
    .select("id, full_name, job_role_id, profile")
    .eq("tenant_id", tenantId)
    .eq("role", "student")

  if (studentIds !== null) {
    if (studentIds.length === 0) {
      return {
        data: {
          members: [],
          discDistribution: { D: 0, I: 0, S: 0, C: 0 },
          bigFiveAverages: {
            openness: 0,
            conscientiousness: 0,
            extraversion: 0,
            agreeableness: 0,
            neuroticism: 0,
          },
          areas: [],
          jobRoles: [],
          completion: { total: 0, discCompleted: 0, bigFiveCompleted: 0 },
        },
      }
    }
    studentsQuery = studentsQuery.in("id", studentIds)
  }

  const [{ data: students }, { data: assessments }, { data: areas }, { data: jobRoles }] =
    await Promise.all([
      studentsQuery,
      (() => {
        let q = supabase
          .from("assessment_history")
          .select("user_id, assessment_type, result, completed_at")
          .eq("tenant_id", tenantId)
          .in("assessment_type", ["big_five", "disc"])
          .order("completed_at", { ascending: false })
        if (studentIds !== null && studentIds.length > 0) {
          q = q.in("user_id", studentIds)
        }
        return q
      })(),
      supabase.from("areas").select("id, name").eq("tenant_id", tenantId).order("name"),
      supabase.from("job_roles").select("id, name").eq("tenant_id", tenantId).order("name"),
    ])

  // Build user_areas map — re-fetch for only our students
  const studentIdSet = new Set((students ?? []).map((s) => s.id))

  // Fetch user_areas for the relevant students
  let userAreasData: Array<{ user_id: string; area_id: string }> = []
  if (studentIdSet.size > 0) {
    const { data: uaData } = await supabase
      .from("user_areas")
      .select("user_id, area_id")
      .in("user_id", [...studentIdSet])
    userAreasData = uaData ?? []
  }

  const userAreasMap = new Map<string, string[]>()
  for (const ua of userAreasData) {
    const existing = userAreasMap.get(ua.user_id) ?? []
    existing.push(ua.area_id)
    userAreasMap.set(ua.user_id, existing)
  }

  // --- Build latest assessment per user ---
  // Keep only the most recent per user+type
  const latestAssessments = new Map<
    string,
    { type: string; result: Record<string, unknown>; completed_at: string }
  >()
  for (const a of assessments ?? []) {
    const key = `${a.user_id}__${a.assessment_type}`
    if (!latestAssessments.has(key)) {
      latestAssessments.set(key, {
        type: a.assessment_type,
        result: a.result as Record<string, unknown>,
        completed_at: a.completed_at,
      })
    }
  }

  // --- Compute aggregations ---
  const discDist: DiscDistribution = { D: 0, I: 0, S: 0, C: 0 }
  const bigFiveSums = {
    openness: 0,
    conscientiousness: 0,
    extraversion: 0,
    agreeableness: 0,
    neuroticism: 0,
  }
  let bigFiveCount = 0
  let discCompleted = 0
  let bigFiveCompleted = 0

  const members: TeamMember[] = (students ?? []).map((s) => {
    const discKey = `${s.id}__disc`
    const bigFiveKey = `${s.id}__big_five`
    const discAssessment = latestAssessments.get(discKey)
    const bigFiveAssessment = latestAssessments.get(bigFiveKey)

    // DISC dominant
    let discDominant: string | null = null
    if (discAssessment) {
      const discResult = discAssessment.result as unknown as DiscResult
      discDominant = getDiscDominant(discResult)
      discDist[discDominant as keyof DiscDistribution]++
      discCompleted++
    }

    // Big Five for averages
    if (bigFiveAssessment) {
      const bfResult = bigFiveAssessment.result as unknown as BigFiveResult
      bigFiveSums.openness += normaliseBigFive(bfResult.openness)
      bigFiveSums.conscientiousness += normaliseBigFive(bfResult.conscientiousness)
      bigFiveSums.extraversion += normaliseBigFive(bfResult.extraversion)
      bigFiveSums.agreeableness += normaliseBigFive(bfResult.agreeableness)
      bigFiveSums.neuroticism += normaliseBigFive(bfResult.neuroticism)
      bigFiveCount++
      bigFiveCompleted++
    }

    // Learning style from ai_profile in JSONB
    const profile = (s.profile as Record<string, unknown>) ?? {}
    const aiProfile = profile.ai_profile as { learning_style?: string } | undefined
    const learningStyle = aiProfile?.learning_style ?? null

    // Last assessment date (most recent of any type)
    const dates: string[] = []
    if (discAssessment) dates.push(discAssessment.completed_at)
    if (bigFiveAssessment) dates.push(bigFiveAssessment.completed_at)
    const lastAssessmentAt =
      dates.length > 0
        ? dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
        : null

    return {
      id: s.id,
      full_name: s.full_name,
      area_ids: userAreasMap.get(s.id) ?? [],
      job_role_id: s.job_role_id ?? null,
      disc_dominant: discDominant,
      learning_style: learningStyle,
      last_assessment_at: lastAssessmentAt,
    }
  })

  const bigFiveAverages: BigFiveAverages =
    bigFiveCount > 0
      ? {
          openness: Math.round(bigFiveSums.openness / bigFiveCount),
          conscientiousness: Math.round(bigFiveSums.conscientiousness / bigFiveCount),
          extraversion: Math.round(bigFiveSums.extraversion / bigFiveCount),
          agreeableness: Math.round(bigFiveSums.agreeableness / bigFiveCount),
          neuroticism: Math.round(bigFiveSums.neuroticism / bigFiveCount),
        }
      : { openness: 0, conscientiousness: 0, extraversion: 0, agreeableness: 0, neuroticism: 0 }

  return {
    data: {
      members,
      discDistribution: discDist,
      bigFiveAverages,
      areas: (areas ?? []).map((a) => ({ id: a.id, name: a.name })),
      jobRoles: (jobRoles ?? []).map((jr) => ({ id: jr.id, name: jr.name })),
      completion: {
        total: members.length,
        discCompleted,
        bigFiveCompleted,
      },
    },
  }
}
