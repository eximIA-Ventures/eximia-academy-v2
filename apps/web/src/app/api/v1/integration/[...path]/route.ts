import { validateIntegrationKey, hasScope } from "@/lib/integration/auth"
import { CATALOG } from "@/lib/integration/catalog"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code }, { status })
}

async function logInbound(tenantId: string | null, method: string, endpoint: string, entity: string | null, statusCode: number, durationMs: number, remoteApp: string) {
  const supabase = createServiceClient()
  await supabase.from("integration_logs").insert({
    tenant_id: tenantId ?? undefined,
    direction: "inbound",
    method,
    endpoint,
    entity,
    status_code: statusCode,
    duration_ms: durationMs,
    remote_app: remoteApp,
  })
}

async function handleRequest(request: Request, params: { path: string[] }) {
  const start = Date.now()
  const method = request.method
  const pathParts = params.path

  // Validate API key
  const auth = await validateIntegrationKey(request)
  if (!auth.valid) {
    return errorResponse(auth.error, auth.code, auth.status)
  }

  const supabase = createServiceClient()
  const { tenantId, appName } = auth

  // Route: GET /catalog
  if (pathParts[0] === "catalog" && method === "GET") {
    await logInbound(tenantId, method, "/catalog", null, 200, Date.now() - start, appName)
    return NextResponse.json(CATALOG)
  }

  // Platform-level keys can only access catalog
  if (!tenantId) {
    return errorResponse("Platform keys can only access /catalog", "FORBIDDEN", 403)
  }

  // Entity routing
  const entityName = pathParts[0]
  const recordId = pathParts[1]

  const entityDef = (CATALOG.entities as Record<string, { operations: readonly string[] }>)[entityName]
  if (!entityDef) {
    const duration = Date.now() - start
    await logInbound(tenantId, method, `/${entityName}`, entityName, 404, duration, appName)
    return errorResponse(`Entity '${entityName}' not found`, "ENTITY_NOT_FOUND", 404)
  }

  // Map method to operation
  const opMap: Record<string, string> = { GET: recordId ? "get" : "list", POST: "create", PUT: "update" }
  const operation = opMap[method]
  if (!operation || !entityDef.operations.includes(operation)) {
    return errorResponse(`Operation '${operation}' not supported on '${entityName}'`, "ENTITY_NOT_FOUND", 404)
  }

  // Scope check
  const requiredScope = method === "GET" ? "read" : "write"
  if (!hasScope(auth.scopes, requiredScope)) {
    const duration = Date.now() - start
    await logInbound(tenantId, method, `/${entityName}`, entityName, 403, duration, appName)
    return errorResponse(`Key lacks '${requiredScope}' scope`, "FORBIDDEN", 403)
  }

  try {
    let result: unknown

    switch (entityName) {
      case "courses":
        result = await handleCourses(supabase, tenantId, operation, recordId, request)
        break
      case "chapters":
        result = await handleChapters(supabase, tenantId, operation, recordId, request)
        break
      case "enrollments":
        result = await handleEnrollments(supabase, tenantId, operation, recordId, request)
        break
      case "users":
        result = await handleUsers(supabase, tenantId, operation, recordId)
        break
      default:
        return errorResponse(`Entity '${entityName}' not implemented`, "ENTITY_NOT_FOUND", 404)
    }

    const duration = Date.now() - start
    await logInbound(tenantId, method, `/${entityName}${recordId ? `/${recordId}` : ""}`, entityName, 200, duration, appName)
    return NextResponse.json(result)
  } catch (err) {
    const duration = Date.now() - start
    const message = err instanceof Error ? err.message : "Internal error"
    await logInbound(tenantId, method, `/${entityName}`, entityName, 500, duration, appName)
    return errorResponse(message, "INTERNAL_ERROR", 500)
  }
}

// --- Entity handlers ---

async function handleCourses(supabase: ReturnType<typeof createServiceClient>, tenantId: string, op: string, id?: string, _req?: Request) {
  if (op === "get" && id) {
    const { data, error } = await supabase
      .from("courses")
      .select("id, title, description, type, status, cover_image_url, created_at, updated_at")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .single()
    if (error || !data) throw new Error("Record not found")
    return { data }
  }

  // list
  const url = _req ? new URL(_req.url) : null
  const page = Math.max(1, Number(url?.searchParams.get("page") ?? 1))
  const limit = Math.min(100, Math.max(1, Number(url?.searchParams.get("limit") ?? 20)))
  const offset = (page - 1) * limit

  const { data, count } = await supabase
    .from("courses")
    .select("id, title, description, type, status, cover_image_url, created_at, updated_at", { count: "exact" })
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  return { data: data ?? [], meta: { total: count ?? 0, page, limit, pages: Math.ceil((count ?? 0) / limit) } }
}

async function handleChapters(supabase: ReturnType<typeof createServiceClient>, tenantId: string, op: string, id?: string, _req?: Request) {
  if (op === "get" && id) {
    const { data } = await supabase
      .from("chapters")
      .select("id, course_id, title, order, status, interaction_type, bloom_target, created_at")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .single()
    if (!data) throw new Error("Record not found")
    return { data }
  }

  const url = _req ? new URL(_req.url) : null
  const page = Math.max(1, Number(url?.searchParams.get("page") ?? 1))
  const limit = Math.min(100, Math.max(1, Number(url?.searchParams.get("limit") ?? 20)))
  const courseId = url?.searchParams.get("course_id")

  let query = supabase
    .from("chapters")
    .select("id, course_id, title, order, status, interaction_type, bloom_target, created_at", { count: "exact" })
    .eq("tenant_id", tenantId)
    .order("order")

  if (courseId) query = query.eq("course_id", courseId)

  const offset = (page - 1) * limit
  const { data, count } = await query.range(offset, offset + limit - 1)
  return { data: data ?? [], meta: { total: count ?? 0, page, limit, pages: Math.ceil((count ?? 0) / limit) } }
}

async function handleEnrollments(supabase: ReturnType<typeof createServiceClient>, tenantId: string, op: string, id?: string, _req?: Request) {
  if (op === "create" && _req) {
    const body = await _req.json()
    if (!body.student_id || !body.course_id) throw new Error("student_id and course_id are required")
    const { data, error } = await supabase
      .from("enrollments")
      .insert({ student_id: body.student_id, course_id: body.course_id, tenant_id: tenantId, status: "active" })
      .select("id, student_id, course_id, status, created_at")
      .single()
    if (error) throw new Error(error.message)
    return { data }
  }

  if (op === "get" && id) {
    const { data } = await supabase
      .from("enrollments")
      .select("id, student_id, course_id, status, progress, created_at")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .single()
    if (!data) throw new Error("Record not found")
    return { data }
  }

  const url = _req ? new URL(_req.url) : null
  const page = Math.max(1, Number(url?.searchParams.get("page") ?? 1))
  const limit = Math.min(100, Math.max(1, Number(url?.searchParams.get("limit") ?? 20)))
  const offset = (page - 1) * limit

  const { data, count } = await supabase
    .from("enrollments")
    .select("id, student_id, course_id, status, progress, created_at", { count: "exact" })
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  return { data: data ?? [], meta: { total: count ?? 0, page, limit, pages: Math.ceil((count ?? 0) / limit) } }
}

async function handleUsers(supabase: ReturnType<typeof createServiceClient>, tenantId: string, op: string, id?: string) {
  if (op === "get" && id) {
    const { data } = await supabase
      .from("users")
      .select("id, full_name, email, role, status, created_at")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .single()
    if (!data) throw new Error("Record not found")
    return { data }
  }

  // list — no request available for pagination in this overload
  const { data, count } = await supabase
    .from("users")
    .select("id, full_name, email, role, status, created_at", { count: "exact" })
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(0, 19)

  return { data: data ?? [], meta: { total: count ?? 0, page: 1, limit: 20, pages: Math.ceil((count ?? 0) / 20) } }
}

// Next.js route handlers
export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  return handleRequest(request, { path })
}

export async function POST(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  return handleRequest(request, { path })
}

export async function PUT(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  return handleRequest(request, { path })
}
