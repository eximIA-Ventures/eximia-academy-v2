// ---------------------------------------------------------------------------
// GET /api/analytics/manager-groups — FASE 1b (item 8 / 8.1 / support 1.2)
// ---------------------------------------------------------------------------
// Aggregates indicators per ÁREA/GESTOR (manager-owned team of students) and
// returns a comparison payload covering the three views:
//   • units    → UNIDADE (`areas`)            — UnitStats[]
//   • areas    → ÁREA/GESTOR team             — AreaStats[]
//   • managers → gestor rollup                — ManagerStats[]
//
// TERMINOLOGY: "area"/areaId in the rest of the codebase = UNIDADE (a site).
// The ÁREA/GESTOR concept introduced here is a manager-owned TEAM
// (manager_groups), DISTINCT from the UNIDADE. See migration 20260530130000.
//
// Query params:
//   includeCorporate=false  → EXCLUDE corporativo groups (is_corporate=true).
//                             Default is true (include). (item 8 flag)
//   unitFilter=<areas.id>   → CORPORATE UNIT SELECTOR (item 8). Narrows the
//                             corporate fan-out to a single spanned UNIDADE.
//                             Absent / "all" = todas as unidades do grupo (default).
//   view=comparison|areas|managers|units|courses|student (default comparison)
//
// ROLE-BASED COMPARISON PERMISSIONS (1.2 — fixed rules, no config screen):
//   • view=student is a SELF-VIEW, permitted to ANY authenticated user (it always
//     reads only the caller's own data — student id = auth.uid()). A multi-hat
//     user (e.g. manager who is also enrolled) may read their OWN performance.
//   • student     → ONLY view=student; every gestor/tenant-wide view is forbidden.
//   • manager     → areas/managers (team vs unidades) + units as reference.
//   • admin/super_admin → everything tenant-wide (units, areas, courses).
// Enforced server-side via filterComparisonByRole / allowedComparisonModes —
// the response NEVER includes entities the caller's role may not compare.
//
// COURSES (spike 1.2-cursos): the comparison/courses views now return
// session-based, tenant-wide CourseStats (computeMetricBlock) so a course is
// directly comparable to a UNIDADE / ÁREA. This supersedes the enrollment-based,
// role-gated manager-courses route as the source for the "Cursos" comparison.
//
// NOTE: depends on migration 20260530130000_area_gestor.sql, NOT yet applied.
// The aggregation lib reads the manager_group* tables through a loosely-typed
// service client and degrades gracefully (empty areas/managers) if they are
// absent — so this route is safe to ship before the migration runs.

import {
  aggregateAreaStats,
  aggregateCourseStats,
  aggregateManagerStats,
  aggregateUnitStats,
  allowedComparisonModes,
  buildComparison,
  computeStudentComparison,
  filterComparisonByRole,
} from "@/lib/analytics/area-gestor"
import { analyticsAggregateLimiter } from "@/lib/rate-limit"
import { createClient } from "@/lib/supabase/server"
import type {
  AnalyticsRole,
  AreaStats,
  ComparisonResponse,
  CourseStats,
  ManagerStats,
  StudentComparison,
  UnitStats,
} from "@/types/analytics"
import { NextResponse } from "next/server"
import { canAccessView, VALID_VIEWS, type View } from "./gate"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Maps the DB `users.role` onto the four analytics roles (1.2). The DB has extra
 * operational roles (`leader`, `instructor`) not in AnalyticsRole; for the
 * comparison surface they behave like a `manager` (team-scoped). Anything else
 * (incl. unknown) defaults to `student` — the most restrictive bucket — so an
 * unexpected role never gains broad comparison access.
 */
function toAnalyticsRole(dbRole: string | null | undefined): AnalyticsRole {
  switch (dbRole) {
    case "super_admin":
      return "super_admin"
    case "admin":
      return "admin"
    case "manager":
    case "leader":
    case "instructor":
      return "manager"
    default:
      return "student"
  }
}

/** Maps the requested view to the comparison mode it exposes (for role gating). */
const VIEW_TO_MODE = {
  units: "units",
  areas: "areas",
  managers: "areas",
  courses: "courses",
  comparison: null, // multi-mode payload, filtered per role
  student: null, // student self-view, gated separately
} as const

export async function GET(request: Request) {
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

  // Any authenticated user with a known role may reach the route; the role is
  // mapped to one of the four analytics roles and gates WHAT they can see below.
  // A `student` is permitted ONLY for view=student (their own self-comparison);
  // view=student itself is a self-view open to every role (canAccessView).
  const role = toAnalyticsRole(profile?.role)

  // Rate limit (shared aggregate limiter).
  if (analyticsAggregateLimiter) {
    const { success } = await analyticsAggregateLimiter.limit(profile?.tenant_id ?? "global")
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 })
  }

  const { searchParams } = new URL(request.url)
  // Default: include corporate. Only the literal "false" excludes it.
  const includeCorporate = searchParams.get("includeCorporate") !== "false"
  // Item 8 CORPORATE UNIT SELECTOR. "all" / absent = all spanned unidades (default).
  // A specific value must be a UUID (areas.id) or we reject — never trust raw input.
  const unitFilterRaw = searchParams.get("unitFilter")
  let unitFilter: string | null = null
  if (unitFilterRaw && unitFilterRaw !== "all") {
    if (!UUID_RE.test(unitFilterRaw)) {
      return NextResponse.json({ error: "Invalid unitFilter" }, { status: 400 })
    }
    unitFilter = unitFilterRaw
  }
  const viewParam = (searchParams.get("view") ?? "comparison") as View
  if (!VALID_VIEWS.includes(viewParam)) {
    return NextResponse.json({ error: "Invalid view" }, { status: 400 })
  }

  // --- ROLE GATE (1.2, server-side, never trust client) ---
  // student → only the `student` self-view; every gestor/tenant-wide view is 403.
  // view=student → allowed for ANY role (self-view, always scoped to auth.uid()),
  // so a multi-hat user reads their OWN performance. See canAccessView.
  if (!canAccessView(role, viewParam)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  // For single-mode views, reject up front if the role can't compare that mode.
  const requestedMode = VIEW_TO_MODE[viewParam]
  if (requestedMode && !allowedComparisonModes(role).includes(requestedMode)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Resolve tenant for admin/super_admin with null tenant_id (same as aggregate).
  let tenantId = profile?.tenant_id ?? null
  if (!tenantId) {
    const { cookies: getCookies } = await import("next/headers")
    const cookieStore = await getCookies()
    tenantId = cookieStore.get("x-sa-active-tenant")?.value ?? null
  }
  if (!tenantId) {
    return NextResponse.json({ error: "Nenhum tenant ativo" }, { status: 400 })
  }

  // Service client — RLS blocks instructors from seeing all student data, and we
  // need cross-unidade reach for corporate groups.
  const { createServiceClient } = await import("@/lib/supabase/service")
  const db = createServiceClient()

  const opts = { includeCorporate, unitFilter }

  try {
    switch (viewParam) {
      case "student": {
        // 1.2 — student self-comparison. tenant resolved server-side; student id is
        // the AUTHENTICATED user (auth.uid()), NEVER a client param → no PII leak.
        const comparison: StudentComparison = await computeStudentComparison(db, tenantId, user.id)
        return NextResponse.json(comparison)
      }
      case "areas": {
        const areas: AreaStats[] = await aggregateAreaStats(db, tenantId, opts)
        // M1: o single-mode view também deve escopar ao time do próprio gestor —
        // sem isto um manager veria os grupos de todos os outros gestores. Mesma
        // regra do comparison view (filterComparisonByRole): admin/super_admin
        // tenant-wide, demais filtram por managerId === auth.uid() (fail-closed).
        const isTenantWide = role === "admin" || role === "super_admin"
        const scopedAreas = isTenantWide ? areas : areas.filter((a) => a.managerId === user.id)
        return NextResponse.json({ areas: scopedAreas })
      }
      case "managers": {
        const managers: ManagerStats[] = await aggregateManagerStats(db, tenantId, opts)
        // M1: idem — escopa ao próprio gestor (admin/super_admin veem todos).
        const isTenantWide = role === "admin" || role === "super_admin"
        const scopedManagers = isTenantWide
          ? managers
          : managers.filter((m) => m.managerId === user.id)
        return NextResponse.json({ managers: scopedManagers })
      }
      case "units": {
        const units: UnitStats[] = await aggregateUnitStats(db, tenantId, opts)
        return NextResponse.json({ units })
      }
      case "courses": {
        const courses: CourseStats[] = await aggregateCourseStats(db, tenantId, opts)
        return NextResponse.json({ courses })
      }
      default: {
        // comparison — build everything, then strip to the role's allowed modes so
        // a manager never receives the admin-only course×course slice, etc. The
        // authenticated user.id scopes a manager's areas/managers to their OWN
        // team(s) — without it a gestor would see every other gestor's team.
        const comparison: ComparisonResponse = await buildComparison(db, tenantId, opts)
        return NextResponse.json(filterComparisonByRole(comparison, role, user.id))
      }
    }
  } catch (error) {
    console.error("manager-groups analytics error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
