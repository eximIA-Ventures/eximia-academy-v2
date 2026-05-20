import { semanticAnalysisLimiter } from "@/lib/rate-limit"
import { createClient } from "@/lib/supabase/server"
import {
  CMA_LABELS,
  ENGAGEMENT_LEVELS,
  JUNG_LAYERS,
  METANOIA_LEVELS,
  RODA_STAGES,
  type SemanticAnalysisResult,
  type SemanticCohortStats,
  type SemanticDashboardResponse,
} from "@/types/semantic-analysis"
import { NextResponse } from "next/server"
import { classifyStudent, rowToSemanticResult } from "./classify"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function periodToDate(period: string): Date {
  const now = new Date()
  switch (period) {
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case "90d":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }
}

export async function GET(request: Request) {
  // --- Auth ---
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single()

  if (
    !profile?.role ||
    !["leader", "manager", "admin", "instructor", "super_admin"].includes(profile.role)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // --- Tenant resolution ---
  let tenantId = profile.tenant_id
  if (!tenantId) {
    const { cookies: getCookies } = await import("next/headers")
    const cookieStore = await getCookies()
    tenantId = cookieStore.get("x-sa-active-tenant")?.value ?? null
  }
  if (!tenantId) {
    return NextResponse.json({ error: "Nenhum tenant ativo" }, { status: 400 })
  }

  // --- Rate limit ---
  if (semanticAnalysisLimiter) {
    const { success } = await semanticAnalysisLimiter.limit(tenantId)
    if (!success) {
      return NextResponse.json(
        {
          error:
            "Too many requests. Semantic analysis is rate-limited to 5 requests per 5 minutes.",
        },
        { status: 429 },
      )
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 })
  }

  // --- Parse query params ---
  const { searchParams } = new URL(request.url)
  const period = searchParams.get("period") ?? "30d"
  const courseId = searchParams.get("courseId")
  const areaId = searchParams.get("areaId")
  const forceRefresh = searchParams.get("forceRefresh") === "true"

  if (courseId && !UUID_RE.test(courseId)) {
    return NextResponse.json({ error: "Invalid course ID" }, { status: 400 })
  }
  if (areaId && !UUID_RE.test(areaId)) {
    return NextResponse.json({ error: "Invalid area ID" }, { status: 400 })
  }

  const periodStart = periodToDate(period)

  // --- Service client (bypass RLS for cross-role data access) ---
  const { createServiceClient } = await import("@/lib/supabase/service")
  const db = createServiceClient()

  try {
    // --- Step 1: Resolve course IDs in scope ---
    let courseIdsInScope: string[] = []

    if (courseId) {
      // Include archived duplicates with same title (same pattern as aggregate)
      const { data: selectedCourse } = await db
        .from("courses")
        .select("title")
        .eq("id", courseId)
        .single()
      courseIdsInScope = [courseId]
      if (selectedCourse?.title) {
        const { data: sameTitleCourses } = await db
          .from("courses")
          .select("id")
          .eq("title", selectedCourse.title)
          .eq("tenant_id", tenantId)
        if (sameTitleCourses) courseIdsInScope = sameTitleCourses.map((c) => c.id)
      }
    } else if (areaId) {
      const { data: courseAreaRows } = await db
        .from("course_areas")
        .select("course_id")
        .eq("area_id", areaId)
        .eq("tenant_id", tenantId)
      const areaCourseIds = (courseAreaRows ?? []).map((r) => r.course_id)
      const { data: legacyCourses } = await db
        .from("courses")
        .select("id")
        .eq("area_id", areaId)
        .eq("tenant_id", tenantId)
      courseIdsInScope = [...new Set([...areaCourseIds, ...(legacyCourses ?? []).map((c) => c.id)])]
    } else {
      // All courses in tenant
      const { data: allCourses } = await db.from("courses").select("id").eq("tenant_id", tenantId)
      courseIdsInScope = (allCourses ?? []).map((c) => c.id)
    }

    if (courseIdsInScope.length === 0) {
      return NextResponse.json(buildEmptyResponse())
    }

    // --- Step 2: Find students with sessions in period ---
    const { data: chapterRows } = await db
      .from("chapters")
      .select("id, course_id")
      .in("course_id", courseIdsInScope)
      .eq("tenant_id", tenantId)
    const chapterIds = (chapterRows ?? []).map((c) => c.id)
    const chapterToCourse = new Map((chapterRows ?? []).map((c) => [c.id, c.course_id]))

    if (chapterIds.length === 0) {
      return NextResponse.json(buildEmptyResponse())
    }

    const { data: sessionRows } = await db
      .from("sessions")
      .select("student_id, chapter_id, created_at")
      .in("chapter_id", chapterIds)
      .eq("tenant_id", tenantId)
      .gte("created_at", periodStart.toISOString())

    if (!sessionRows || sessionRows.length === 0) {
      return NextResponse.json(buildEmptyResponse())
    }

    // Build student -> course -> latest session mapping
    const studentCourseMap = new Map<string, Map<string, string>>()
    for (const s of sessionRows) {
      const cId = chapterToCourse.get(s.chapter_id)
      if (!cId) continue
      if (!studentCourseMap.has(s.student_id)) {
        studentCourseMap.set(s.student_id, new Map())
      }
      const courseMap = studentCourseMap.get(s.student_id) ?? new Map<string, string>()
      const existing = courseMap.get(cId)
      if (!existing || s.created_at > existing) {
        courseMap.set(cId, s.created_at)
      }
    }

    // --- Step 3: Fetch existing analyses + identify stale ones ---
    const studentIds = [...studentCourseMap.keys()]

    const { data: existingAnalyses } = await db
      .from("semantic_analyses")
      .select("*")
      .in("student_id", studentIds)
      .in("course_id", courseIdsInScope)
      .eq("tenant_id", tenantId)

    const analysisMap = new Map<string, Record<string, unknown>>()
    for (const a of existingAnalyses ?? []) {
      const key = `${a.student_id}::${a.course_id}`
      analysisMap.set(key, a)
    }

    // Identify students needing re-analysis
    const staleStudents: Array<{ studentId: string; courseId: string }> = []
    for (const [studentId, courseMap] of studentCourseMap) {
      for (const [cId, latestSession] of courseMap) {
        const key = `${studentId}::${cId}`
        const existing = analysisMap.get(key)
        if (
          forceRefresh ||
          !existing ||
          !existing.analyzed_at ||
          latestSession > (existing.analyzed_at as string)
        ) {
          staleStudents.push({ studentId, courseId: cId })
        }
      }
    }

    // --- Step 4: Batch classify stale students (max 5 per request) ---
    const toClassify = staleStudents.slice(0, 5)
    const pendingStudents = staleStudents.length - toClassify.length

    for (const { studentId, courseId: cId } of toClassify) {
      try {
        const classification = await classifyStudent(db, studentId, cId, tenantId)

        // Upsert into semantic_analyses
        const { error: upsertError } = await db.from("semantic_analyses").upsert(
          {
            student_id: studentId,
            course_id: cId,
            tenant_id: tenantId,
            roda_stage: classification.rodaStage,
            roda_confidence: classification.rodaConfidence,
            roda_evidence: classification.rodaEvidence,
            cma_corpo: classification.cmaCorpo,
            cma_mente: classification.cmaMente,
            cma_alma: classification.cmaAlma,
            cma_dominant: classification.cmaDominant,
            metanoia_level: classification.metanoiaLevel,
            metanoia_signals: classification.metanoiaSignals,
            kolb_style: classification.kolbStyle,
            kolb_grasping: classification.kolbGrasping,
            kolb_transforming: classification.kolbTransforming,
            jung_layer: classification.jungLayer,
            jung_confidence: classification.jungConfidence,
            jung_evidence: classification.jungEvidence,
            engagement_level: classification.engagementLevel,
            engagement_ai_probability: classification.engagementAiProbability,
            classification_model: classification.classificationModel,
            classification_tokens_used: classification.classificationTokensUsed,
            sessions_analyzed: classification.sessionsAnalyzed,
            responses_analyzed: classification.responsesAnalyzed,
            summary: classification.summary,
            analyzed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "student_id,course_id,tenant_id" },
        )

        if (upsertError) {
          console.error(`[semantic] Upsert failed for student ${studentId}:`, upsertError.message)
        } else {
          // Refresh the analysis map with the new data
          const key = `${studentId}::${cId}`
          const { data: refreshed } = await db
            .from("semantic_analyses")
            .select("*")
            .eq("student_id", studentId)
            .eq("course_id", cId)
            .eq("tenant_id", tenantId)
            .maybeSingle()
          if (refreshed) {
            analysisMap.set(key, refreshed)
          }
        }
      } catch (classifyError) {
        console.error(`[semantic] Classification failed for student ${studentId}:`, classifyError)
        // Continue with other students — don't fail the whole batch
      }
    }

    // --- Step 5: Build response from all analyses (fresh + cached) ---
    // Fetch student names
    const { data: studentUsers } = await db
      .from("users")
      .select("id, full_name")
      .in("id", studentIds)
    const nameMap = new Map((studentUsers ?? []).map((u) => [u.id, u.full_name ?? "Aluno"]))

    // Fetch course titles
    const { data: courseRows } = await db
      .from("courses")
      .select("id, title")
      .in("id", courseIdsInScope)
    const courseTitleMap = new Map((courseRows ?? []).map((c) => [c.id, c.title ?? "Curso"]))

    // Build student results from analysis map
    const students: SemanticAnalysisResult[] = []
    for (const [key, row] of analysisMap) {
      const sId = row.student_id as string
      const cId = row.course_id as string
      students.push(
        rowToSemanticResult(row, nameMap.get(sId) ?? "Aluno", courseTitleMap.get(cId) ?? "Curso"),
      )
    }

    // --- Step 6: Aggregate into cohort stats ---
    const totalStudentsInTenant = studentIds.length
    const cohort = aggregateCohortStats(students, totalStudentsInTenant)

    // Find latest analyzed_at across all analyses
    const analyzedDates = students
      .map((s) => s.analyzedAt)
      .filter(Boolean)
      .sort()
    const lastAnalyzedAt = analyzedDates.length > 0 ? analyzedDates[analyzedDates.length - 1] : null

    const response: SemanticDashboardResponse = {
      cohort,
      students,
      lastAnalyzedAt,
      pendingStudents,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[semantic] Route error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Aggregation helpers
// ---------------------------------------------------------------------------

function aggregateCohortStats(
  students: SemanticAnalysisResult[],
  totalStudents: number,
): SemanticCohortStats {
  const n = students.length

  if (n === 0) {
    return buildEmptyCohortStats(totalStudents)
  }

  // Roda distribution
  const rodaCounts = new Map<number, number>()
  for (let i = 1; i <= 8; i++) rodaCounts.set(i, 0)
  let rodaSum = 0
  for (const s of students) {
    rodaCounts.set(s.roda.stage, (rodaCounts.get(s.roda.stage) ?? 0) + 1)
    rodaSum += s.roda.stage
  }
  const rodaDistribution = Array.from(rodaCounts.entries()).map(([stage, count]) => ({
    stage,
    stageName: RODA_STAGES[stage] ?? "Desconhecido",
    count,
  }))

  // CMA averages and dominant distribution
  let cmaCorpoSum = 0
  let cmaMenteSum = 0
  let cmaAlmaSum = 0
  const cmaDomCounts = new Map<string, number>()
  for (const s of students) {
    cmaCorpoSum += s.cma.corpo
    cmaMenteSum += s.cma.mente
    cmaAlmaSum += s.cma.alma
    cmaDomCounts.set(s.cma.dominant, (cmaDomCounts.get(s.cma.dominant) ?? 0) + 1)
  }
  const cmaDistribution = ["corpo", "mente", "alma"].map((d) => ({
    dimension: CMA_LABELS[d] ?? d,
    count: cmaDomCounts.get(d) ?? 0,
  }))

  // Metanoia distribution
  const metanoiaCounts = new Map<number, number>()
  for (let i = 0; i <= 4; i++) metanoiaCounts.set(i, 0)
  let metanoiaSum = 0
  for (const s of students) {
    metanoiaCounts.set(s.metanoia.level, (metanoiaCounts.get(s.metanoia.level) ?? 0) + 1)
    metanoiaSum += s.metanoia.level
  }
  const metanoiaDistribution = Array.from(metanoiaCounts.entries()).map(([level, count]) => ({
    level,
    levelName: METANOIA_LEVELS[level] ?? "Desconhecido",
    count,
  }))

  // Kolb distribution
  const kolbCounts = new Map<string, number>()
  for (const s of students) {
    if (s.kolb.style) {
      kolbCounts.set(s.kolb.style, (kolbCounts.get(s.kolb.style) ?? 0) + 1)
    }
  }
  const kolbDistribution = Array.from(kolbCounts.entries()).map(([style, count]) => ({
    style,
    count,
  }))

  // Jung distribution
  const jungCounts = new Map<string, number>()
  for (const s of students) {
    jungCounts.set(s.jung.layer, (jungCounts.get(s.jung.layer) ?? 0) + 1)
  }
  const jungDistribution = Array.from(jungCounts.entries()).map(([layer, count]) => ({
    layer,
    layerName: JUNG_LAYERS[layer] ?? "Desconhecido",
    count,
  }))

  // Engagement distribution
  const engagementCounts = new Map<number, number>()
  for (let i = 1; i <= 4; i++) engagementCounts.set(i, 0)
  let engagementSum = 0
  for (const s of students) {
    engagementCounts.set(s.engagement.level, (engagementCounts.get(s.engagement.level) ?? 0) + 1)
    engagementSum += s.engagement.level
  }
  const engagementDistribution = Array.from(engagementCounts.entries()).map(([level, count]) => ({
    level,
    levelName: ENGAGEMENT_LEVELS[level] ?? "Desconhecido",
    count,
  }))

  return {
    totalStudents,
    studentsAnalyzed: n,
    rodaDistribution,
    avgRodaStage: Math.round((rodaSum / n) * 10) / 10,
    avgCmaCorpo: Math.round(cmaCorpoSum / n),
    avgCmaMente: Math.round(cmaMenteSum / n),
    avgCmaAlma: Math.round(cmaAlmaSum / n),
    cmaDistribution,
    metanoiaDistribution,
    avgMetanoiaLevel: Math.round((metanoiaSum / n) * 10) / 10,
    kolbDistribution,
    jungDistribution,
    engagementDistribution,
    avgEngagementLevel: Math.round((engagementSum / n) * 10) / 10,
  }
}

function buildEmptyCohortStats(totalStudents: number): SemanticCohortStats {
  return {
    totalStudents,
    studentsAnalyzed: 0,
    rodaDistribution: Array.from({ length: 8 }, (_, i) => ({
      stage: i + 1,
      stageName: RODA_STAGES[i + 1] ?? "",
      count: 0,
    })),
    avgRodaStage: 0,
    avgCmaCorpo: 0,
    avgCmaMente: 0,
    avgCmaAlma: 0,
    cmaDistribution: ["corpo", "mente", "alma"].map((d) => ({
      dimension: CMA_LABELS[d] ?? d,
      count: 0,
    })),
    metanoiaDistribution: Array.from({ length: 5 }, (_, i) => ({
      level: i,
      levelName: METANOIA_LEVELS[i] ?? "",
      count: 0,
    })),
    avgMetanoiaLevel: 0,
    kolbDistribution: [],
    jungDistribution: [],
    engagementDistribution: Array.from({ length: 4 }, (_, i) => ({
      level: i + 1,
      levelName: ENGAGEMENT_LEVELS[i + 1] ?? "",
      count: 0,
    })),
    avgEngagementLevel: 0,
  }
}

function buildEmptyResponse(): SemanticDashboardResponse {
  return {
    cohort: buildEmptyCohortStats(0),
    students: [],
    lastAnalyzedAt: null,
    pendingStudents: 0,
  }
}
