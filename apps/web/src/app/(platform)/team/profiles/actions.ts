"use server"

import {
  getDirectTeamStudentIds,
  getManagedTeamStudentIds,
  getSubtreeStudentIdsAtNode,
} from "@/lib/area-context"
import { getActiveContextCookie } from "@/lib/context-context"
import { createClient } from "@/lib/supabase/server"
import { getTeamViewMode } from "@/lib/team-view-context"

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

export async function getTeamProfiles(
  /**
   * E9 drill-down node (`?focus=`), gated against the manager's own subtree
   * BEFORE use. Only consulted when the active context is `team` (Meu Time) —
   * mirrors the team dashboard so the roster matches whichever node/mode the
   * manager is currently looking at there.
   */
  focusUserId?: string | null,
): Promise<{ data: TeamProfilesData; error?: never } | { error: string; data?: never }> {
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
    // TEAM scope (GESTOR) — E9 SUBTREE wiring (gap E9). The roster must list the
    // manager's WHOLE reachable subtree (reports_to ∪ descendant manager_group
    // members), not only the explicit members of the team(s) they OWN. That was
    // the fiação bug behind the empty roster for superior managers (Rafael/Sara/
    // Bia owned no group → 0), while the subtree truth (8/6/3) already lived in
    // `/api/analytics/manager?includeSubtree=true`. `includeSubtree:true`
    // resolves via the E3 function `auth_reachable_student_ids()`, hard-wired to
    // `auth.uid()`; `supabase` is the AUTHENTICATED client of this manager
    // (user.id), so the anchor is correct. This does NOT reopen permission — RLS
    // is the trava; this only makes the roster reflect what they may read.
    //
    // Security normalization (AC2): `null` ("no scope" / RPC error) collapses to
    // an EMPTY scope — NEVER tenant-wide. `[]` (subtree with no students) is
    // already empty. Both flow into the existing `studentIds.length === 0`
    // empty-result path below, so a manager with an empty subtree sees an empty
    // roster.
    //
    // TEAM CONTEXT (Hierarquia/Visão Global + drill-down): when the active
    // context is `team` (Meu Time), the roster now mirrors the team
    // dashboard's node (`focusUserId`, gated) + mode (`x-team-view`) instead of
    // always flattening the whole subtree. Outside the `team` context, the
    // manager branch is UNCHANGED (whole reachable subtree, as before).
    const activeContext = await getActiveContextCookie()
    if (activeContext?.type === "team") {
      const teamViewMode = await getTeamViewMode()
      let gatedFocus: string | null = null
      if (focusUserId) {
        const { data: subtreeUsersRaw } = await supabase.rpc("auth_subtree_user_ids")
        const allowed = new Set<string>((subtreeUsersRaw ?? []) as string[])
        if (allowed.has(focusUserId)) gatedFocus = focusUserId
      }
      const node = gatedFocus ?? user.id

      studentIds =
        teamViewMode === "hierarchy"
          ? gatedFocus
            ? await getSubtreeStudentIdsAtNode(supabase, tenantId, gatedFocus)
            : ((await getManagedTeamStudentIds(supabase, tenantId, user.id, {
                includeSubtree: true,
              })) ?? [])
          : await getDirectTeamStudentIds(supabase, tenantId, node)
    } else {
      studentIds =
        (await getManagedTeamStudentIds(supabase, tenantId, user.id, { includeSubtree: true })) ??
        []
    }
  }
  // admin: `studentIds` stays `null` (tenant-wide), unchanged.

  // --- Fetch students ---
  let studentsQuery = supabase
    .from("users")
    .select("id, full_name, report_name, job_role_id, profile")
    .eq("tenant_id", tenantId)

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
    // MULTI-CHAPÉU FIX (Iteração 2, 2026-07-02): `studentIds` here is ALREADY
    // the resolved student-hat universe (getDirectTeamStudentIds / subtree
    // helpers, both sourced from `user_roles`). Re-filtering by the SINGULAR
    // `users.role = 'student'` column would silently drop a multi-hat member
    // (e.g. gestor+aluno) who IS in `studentIds` but whose primary role is
    // something else — same bug class as engagement-helpers.ts / area-context.ts.
    // `.in("id", studentIds)` alone is the correct, sufficient filter.
    studentsQuery = studentsQuery.in("id", studentIds)
  } else {
    // admin path: `studentIds` stays `null` (tenant-wide roster, deliberately
    // NOT changed by this fix — this is a tenant-wide listing surface, not a
    // manager-scope resolution, so it keeps filtering by the PRIMARY role).
    studentsQuery = studentsQuery.eq("role", "student")
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
      full_name: s.report_name ?? s.full_name,
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
