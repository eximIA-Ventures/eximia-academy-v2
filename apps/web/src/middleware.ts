import {
  applyCorsHeaders,
  checkApiKeyRateLimit,
  extractApiKeyContext,
  handleCorsPreflightPublicApi,
  logApiUsage,
  requireScope,
} from "@/lib/api-auth"
import type { ApiKeyContext, ApiScope } from "@/lib/api-auth"
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
// Path-based multi-tenant routing
// ---------------------------------------------------------------------------

/** Paths that must NEVER be treated as tenant slugs */
const PASSTHROUGH_PREFIXES = [
  "/super-admin",
  "/api",
  "/_next",
  "/logos",
  "/brandbook",
  "/onboarding",
  "/favicon.ico",
  "/reset-password",
  "/accept-invite",
]

/** Static file extensions that should be passed through */
const STATIC_EXT_RE = /\.(ico|png|jpg|jpeg|gif|svg|webp|css|js|woff2?|ttf|eot|map)$/i

/** Regex for a valid tenant slug: lowercase alphanumeric, may contain hyphens, starts with alnum */
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/

/**
 * Extract tenant slug from the first path segment and compute the internal path.
 * Returns null when the path is a passthrough or the first segment is not a valid slug.
 */
function extractTenantFromPath(pathname: string): { slug: string; internalPath: string } | null {
  // Passthrough prefixes are never treated as slugs
  if (PASSTHROUGH_PREFIXES.some((p) => pathname.startsWith(p))) return null
  // Static files are never slugs
  if (STATIC_EXT_RE.test(pathname)) return null

  const segments = pathname.split("/").filter(Boolean)
  if (segments.length === 0) return null // root "/"

  const possibleSlug = segments[0]
  if (!SLUG_RE.test(possibleSlug)) return null

  // Known top-level pages that are NOT slugs (bare access without slug prefix)
  const KNOWN_TOP_LEVEL = ["login", "dashboard", "courses", "admin", "analytics", "instructor"]
  if (segments.length === 1 && KNOWN_TOP_LEVEL.includes(possibleSlug)) return null

  const rest = segments.slice(1)
  const internalPath = rest.length > 0 ? `/${rest.join("/")}` : "/"

  return { slug: possibleSlug, internalPath }
}

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
// Redirect helpers (tenant-aware)
// ---------------------------------------------------------------------------

/**
 * Build a redirect URL. If a tenant slug is known, prefix the path with it.
 * Passthrough paths (super-admin, api, etc.) are never prefixed.
 */
function tenantRedirectUrl(request: NextRequest, path: string, slug: string | null): URL {
  if (slug && !PASSTHROUGH_PREFIXES.some((p) => path.startsWith(p))) {
    const cleanPath = path === "/" ? "" : path
    return new URL(`/${slug}${cleanPath}`, request.url)
  }
  return new URL(path, request.url)
}

// ---------------------------------------------------------------------------
// Main middleware
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest) {
  const originalPathname = request.nextUrl.pathname

  // --- Public API v1 — API key auth (no Supabase session) ---
  if (originalPathname.startsWith("/api/v1/")) {
    return handlePublicApiRequest(request)
  }

  // --- Tenant extraction from path (BEFORE any other logic) ---
  const tenantInfo = extractTenantFromPath(originalPathname)
  const tenantSlug = tenantInfo?.slug ?? null
  // The path to use for all internal checks (auth, protected, redirects)
  const pathname = tenantInfo?.internalPath ?? originalPathname

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

  // --- Super admin role check (Epic 11) ---
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
        const expiresAt = now + 5 * 60 * 1000
        const cookieOpts = {
          path: "/",
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax" as const,
          maxAge: 300,
        }
        response.cookies.set("x-user-role", userRole, cookieOpts)
        response.cookies.set("x-user-role-exp", String(expiresAt), cookieOpts)
      }
    }
  }

  // Protect super-admin routes from non-super_admin
  if (
    (pathname.startsWith("/super-admin") || pathname.startsWith("/api/super-admin")) &&
    userRole !== "super_admin"
  ) {
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url))
    }
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    return NextResponse.redirect(tenantRedirectUrl(request, "/dashboard", tenantSlug))
  }

  // Protected routes — check against the internal path (without slug prefix)
  const protectedPaths = ["/dashboard", "/courses", "/admin", "/analytics", "/instructor", "/super-admin"]
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p))

  if (isProtected && !user) {
    return NextResponse.redirect(tenantRedirectUrl(request, "/login", tenantSlug))
  }

  // Instructor role restrictions
  if (userRole === "instructor") {
    const blockedForInstructor = ["/admin/users", "/admin/settings", "/admin/api-keys", "/admin/webhooks"]
    if (blockedForInstructor.some((p) => pathname.startsWith(p))) {
      return NextResponse.redirect(tenantRedirectUrl(request, "/instructor", tenantSlug))
    }
  }

  // Auth routes: redirect logged-in users based on role
  if ((pathname === "/login" || pathname === "/") && user) {
    if (userRole === "super_admin") {
      // Super admins go to the super-admin panel — never prefixed
      return NextResponse.redirect(new URL("/super-admin/tenants", request.url))
    }
    if (userRole === "instructor" && pathname === "/login") {
      return NextResponse.redirect(tenantRedirectUrl(request, "/instructor", tenantSlug))
    }
    if (pathname === "/login") {
      return NextResponse.redirect(tenantRedirectUrl(request, "/dashboard", tenantSlug))
    }
  }

  // Super admin accessing platform routes needs active tenant cookie (Story 11.4)
  if (
    userRole === "super_admin" &&
    !pathname.startsWith("/super-admin") &&
    !pathname.startsWith("/api/super-admin")
  ) {
    const activeTenantId = request.cookies.get("x-sa-active-tenant")?.value
    if (isProtected && !activeTenantId) {
      return NextResponse.redirect(new URL("/super-admin/tenants", request.url))
    }
    if (activeTenantId) {
      response.headers.set("x-tenant-id", activeTenantId)
    }
  }

  // ---------------------------------------------------------------------------
  // Final response: apply rewrite for tenant-prefixed paths, or pass through
  // ---------------------------------------------------------------------------

  if (tenantInfo) {
    // Rewrite: serve the internal path while the browser keeps the tenant-prefixed URL
    const url = request.nextUrl.clone()
    url.pathname = tenantInfo.internalPath

    // Set x-tenant-slug on REQUEST headers so server components can read it via headers()
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set("x-tenant-slug", tenantInfo.slug)

    const rewriteResponse = NextResponse.rewrite(url, {
      request: { headers: requestHeaders },
    })

    // Copy cookies that were set during auth refresh
    for (const cookie of response.cookies.getAll()) {
      rewriteResponse.cookies.set(cookie.name, cookie.value, {
        path: cookie.path,
        domain: cookie.domain,
        maxAge: cookie.maxAge,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite,
      })
    }
    // Copy any headers we set (e.g. x-tenant-id for super admin)
    response.headers.forEach((value, key) => {
      rewriteResponse.headers.set(key, value)
    })

    // Set tenant slug header for downstream server components
    rewriteResponse.headers.set("x-tenant-slug", tenantInfo.slug)

    // Persist tenant slug in cookie so bare-path navigation can redirect back
    rewriteResponse.cookies.set("x-tenant-slug", tenantInfo.slug, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
    })

    return rewriteResponse
  }

  // No tenant slug in path — redirect to tenant-prefixed URL if user has active tenant
  // This fixes client-side navigation that uses hardcoded paths like /courses/xxx
  if (!tenantSlug && user && isProtected) {
    // Resolve tenant slug from cookie or user profile
    let resolvedSlug: string | null = null

    if (userRole === "super_admin") {
      // Super admin: don't redirect platform routes (they use cookie-based tenant)
    } else {
      const tenantSlugCookie = request.cookies.get("x-tenant-slug")?.value
      if (tenantSlugCookie && SLUG_RE.test(tenantSlugCookie)) {
        resolvedSlug = tenantSlugCookie
      }
    }

    if (resolvedSlug) {
      const redirectUrl = new URL(`/${resolvedSlug}${pathname}${request.nextUrl.search}`, request.url)
      return NextResponse.redirect(redirectUrl)
    }
  }

  if (!tenantSlug) {
    const hostname = request.headers.get("host") || ""
    const subdomain = hostname.split(".")[0]
    const fallbackSlug =
      subdomain !== "localhost"
        ? subdomain
        : request.nextUrl.searchParams.get("tenant") || (process.env.NODE_ENV === "development" ? "demo" : "")
    response.headers.set("x-tenant-slug", fallbackSlug)
  }

  // Skip super_admin tenant resolution (no subdomain requirement)
  if (userRole === "super_admin") {
    return response
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
