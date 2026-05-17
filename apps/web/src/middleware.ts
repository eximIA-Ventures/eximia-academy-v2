import {
  applyCorsHeaders,
  checkApiKeyRateLimit,
  extractApiKeyContext,
  handleCorsPreflightPublicApi,
  logApiUsage,
  requireScope,
} from "@/lib/api-auth"
import type { ApiScope } from "@/lib/api-auth"
import type { RateLimiter } from "@/lib/rate-limit"
import {
  authLimiter,
  catchAllLimiter,
  chatLimiter,
  courseCreateLimiter,
  privacyLimiter,
  questionGenLimiter,
} from "@/lib/rate-limit"
import { createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

// ---------------------------------------------------------------------------
// Rate limiting helper
// ---------------------------------------------------------------------------

async function checkLimit(
  limiter: RateLimiter,
  identifier: string,
  limiterName: string,
  pathname: string,
): Promise<NextResponse | null> {
  try {
    const { success, reset } = await limiter.limit(identifier)
    if (!success) {
      const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000))
      console.warn(`[rate-limit] ${limiterName} exceeded for ${identifier} on ${pathname}`)
      return NextResponse.json(
        { error: "Too Many Requests", retryAfter },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfter) },
        },
      )
    }
  } catch (err) {
    console.warn(`[rate-limit] Redis error for ${limiterName}, failing open:`, err)
  }
  return null
}

// ---------------------------------------------------------------------------
// Public API v1
// ---------------------------------------------------------------------------

const V1_SCOPE_MAP: Record<string, ApiScope> = {
  "/api/v1/courses": "courses:read",
  "/api/v1/blueprints": "blueprints:read",
  "/api/v1/enrollments": "enrollments:read",
  "/api/v1/analytics": "analytics:read",
}

function getRequiredScope(pathname: string): ApiScope | null {
  for (const [prefix, scope] of Object.entries(V1_SCOPE_MAP)) {
    if (pathname.startsWith(prefix)) return scope
  }
  if (pathname === "/api/v1/docs") return null
  return null
}

async function handlePublicApiRequest(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname
  const startTime = Date.now()

  const ctx = await extractApiKeyContext(request)
  const corsOrigins = ctx?.apiKey.corsOrigins ?? []
  const preflight = handleCorsPreflightPublicApi(request, corsOrigins)
  if (preflight) return preflight

  if (!ctx && pathname !== "/api/v1/docs") {
    return NextResponse.json(
      { error: "API key required. Use Authorization: Bearer exa_live_..." },
      { status: 401 },
    )
  }

  if (ctx) {
    const requiredScope = getRequiredScope(pathname)
    if (requiredScope && !requireScope(ctx.scopes, requiredScope)) {
      return NextResponse.json(
        { error: `Missing required scope: ${requiredScope}` },
        { status: 403 },
      )
    }

    const rateLimited = await checkApiKeyRateLimit(
      ctx.apiKey.id,
      ctx.apiKey.rateLimitRpm,
      ctx.apiKey.rateLimitRpd,
    )
    if (rateLimited) return rateLimited
  }

  const response = NextResponse.next({ request })

  if (ctx) {
    response.headers.set("x-api-key-id", ctx.apiKey.id)
    response.headers.set("x-api-tenant-id", ctx.tenantId)
    response.headers.set("x-api-scopes", ctx.scopes.join(","))
  }

  applyCorsHeaders(response, request, corsOrigins)

  if (ctx) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",").pop()?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown"
    logApiUsage({
      apiKeyId: ctx.apiKey.id,
      tenantId: ctx.tenantId,
      method: request.method,
      path: pathname,
      statusCode: 200,
      responseTimeMs: Date.now() - startTime,
      ipAddress: ip,
      userAgent: request.headers.get("user-agent") ?? "",
    })
  }

  return response
}

// ---------------------------------------------------------------------------
// Main middleware — auth + rate limiting + role-based redirects
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // --- Static public assets — skip all processing ---
  if (
    pathname.startsWith("/logos/") ||
    pathname.startsWith("/brand/") ||
    pathname === "/manifest.json" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  ) {
    return NextResponse.next()
  }

  // --- Public API v1 — API key auth (no Supabase session) ---
  if (pathname.startsWith("/api/v1/")) {
    return handlePublicApiRequest(request)
  }

  // --- Rate limiting for API routes (IP-based, before auth) ---
  if (pathname.startsWith("/api/")) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",").pop()?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown"

    if (pathname.startsWith("/api/auth")) {
      const blocked = await checkLimit(authLimiter, ip, "authLimiter", pathname)
      if (blocked) return blocked
    }

    if (!pathname.startsWith("/api/auth")) {
      const blocked = await checkLimit(catchAllLimiter, ip, "catchAllLimiter", pathname)
      if (blocked) return blocked
    }
  }

  // --- Supabase auth ---
  let response = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(
        cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>,
      ) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options as Record<string, string>)
        }
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // --- Rate limiting for API routes (user-based, after auth) ---
  if (pathname.startsWith("/api/") && user) {
    const userId = user.id

    if (/^\/api\/sessions\/[^/]+\/messages/.test(pathname)) {
      const blocked = await checkLimit(chatLimiter, userId, "chatLimiter", pathname)
      if (blocked) return blocked
    }

    if (/^\/api\/chapters\/[^/]+\/generate-questions/.test(pathname)) {
      const blocked = await checkLimit(questionGenLimiter, userId, "questionGenLimiter", pathname)
      if (blocked) return blocked
    }

    if (pathname === "/api/courses" && request.method === "POST") {
      const blocked = await checkLimit(courseCreateLimiter, userId, "courseCreateLimiter", pathname)
      if (blocked) return blocked
    }

    if (pathname.startsWith("/api/privacy")) {
      const blocked = await checkLimit(privacyLimiter, userId, "privacyLimiter", pathname)
      if (blocked) return blocked
    }
  }

  // --- Role check (cached in cookie for 5 min) ---
  let userRole: string | null = null
  if (user) {
    const roleCookie = request.cookies.get("x-user-role")
    const roleCookieExpiry = request.cookies.get("x-user-role-exp")
    const now = Date.now()

    if (roleCookie?.value && roleCookieExpiry?.value && Number(roleCookieExpiry.value) > now) {
      userRole = roleCookie.value
    } else {
      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single()
      userRole = profile?.role ?? null

      if (userRole) {
        const cookieOpts = {
          path: "/",
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax" as const,
          maxAge: 300,
        }
        response.cookies.set("x-user-role", userRole, cookieOpts)
        response.cookies.set("x-user-role-exp", String(now + 5 * 60 * 1000), cookieOpts)
      }
    }
  }

  // --- Protected routes ---
  const protectedPaths = ["/dashboard", "/courses", "/admin", "/analytics", "/instructor"]
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p))

  if (isProtected && !user) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // Instructor role restrictions
  if (userRole === "instructor") {
    const blockedForInstructor = ["/admin/users", "/admin/settings", "/admin/api-keys", "/admin/webhooks"]
    if (blockedForInstructor.some((p) => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL("/instructor", request.url))
    }
  }

  // Auth routes: redirect logged-in users
  if ((pathname === "/login" || pathname === "/") && user) {
    if (userRole === "instructor") {
      return NextResponse.redirect(new URL("/instructor", request.url))
    }
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
