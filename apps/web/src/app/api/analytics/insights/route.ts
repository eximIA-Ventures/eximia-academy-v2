import { analyticsAggregateLimiter } from "@/lib/rate-limit"
import { createClient } from "@/lib/supabase/server"
import type { SessionAnalyticsJsonb } from "@/types/analytics"
import { NextResponse } from "next/server"
import { z } from "zod"

// Presentational hints are bounded so a caller cannot inject arbitrary/oversized
// content into the LLM prompt. Core numeric metrics are RECOMPUTED server-side below.
const unitSchema = z.object({
  name: z.string().max(120),
  activePct: z.number(),
  completionPct: z.number(),
})

const metricsSchema = z.object({
  totalStudents: z.number().int().nonnegative().max(1_000_000).optional(),
  neverAccessed: z.number().int().nonnegative().max(1_000_000).optional(),
  inactive: z.number().int().nonnegative().max(1_000_000).optional(),
  units: z.array(unitSchema).max(50).optional(),
  zeroReflModules: z.number().int().nonnegative().max(100_000).optional(),
  topModule: z.string().max(200).nullable().optional(),
  topModuleCount: z.number().int().nonnegative().max(1_000_000).optional(),
  avgWords: z.number().nonnegative().max(1_000_000).optional(),
})

const bodySchema = z.object({
  tab: z.enum(["uso", "aprendizagem"]),
  metrics: metricsSchema,
})

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

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

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

  // Resolve tenant for admin/super_admin with null tenant_id
  let tenantId = profile.tenant_id
  if (!tenantId) {
    const { cookies: getCookies } = await import("next/headers")
    const cookieStore = await getCookies()
    tenantId = cookieStore.get("x-sa-active-tenant")?.value ?? null
  }
  if (!tenantId) {
    return NextResponse.json({ error: "Nenhum tenant ativo" }, { status: 400 })
  }

  // Rate limit (per tenant) — reuse the analytics aggregate limiter
  if (analyticsAggregateLimiter) {
    const { success } = await analyticsAggregateLimiter.limit(tenantId)
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 })
  }

  const parsed = bodySchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  const { tab, metrics } = parsed.data

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 503 })

  const { searchParams } = new URL(request.url)
  const period = searchParams.get("period") ?? "30d"
  const periodStart = periodToDate(period)

  // --- Recompute server-verifiable core metrics from the DB (never trust the body) ---
  // RLS blocks instructors from seeing student data, so use the service client scoped to tenant.
  const { createServiceClient } = await import("@/lib/supabase/service")
  const db = createServiceClient()

  const { data: sessions } = await db
    .from("sessions")
    .select("analytics, created_at")
    .eq("tenant_id", tenantId)
    .gte("created_at", periodStart.toISOString())

  const totalSessions = sessions?.length ?? 0
  const analyticsData = (sessions ?? [])
    .map((s) => s.analytics as SessionAnalyticsJsonb | null)
    .filter(
      (a): a is SessionAnalyticsJsonb =>
        Boolean(a) && typeof a === "object" && Object.keys(a as object).length > 0,
    )
  const depths = analyticsData.map((a) => a.depth_reached ?? 0).filter((d) => d > 0)
  const avgDepth =
    depths.length > 0
      ? Math.round((depths.reduce((a, b) => a + b, 0) / depths.length) * 10) / 10
      : 0

  const periodMs = Date.now() - periodStart.getTime()
  const prevStart = new Date(periodStart.getTime() - periodMs)
  const { count: prevTotal } = await db
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("created_at", prevStart.toISOString())
    .lt("created_at", periodStart.toISOString())
  const deltaSessions =
    (prevTotal ?? 0) > 0
      ? Math.round(((totalSessions - (prevTotal ?? 0)) / (prevTotal ?? 1)) * 100)
      : null

  const { count: totalReflections } = await db
    .from("slide_reflections")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("created_at", periodStart.toISOString())

  const systemPrompt = `Você é um consultor educacional analisando dados de uma plataforma de treinamento corporativo (eximIA Academy).
Gere 3-5 insights curtos e acionáveis baseados nos dados fornecidos.
Cada insight deve ter: type (positive/warning/critical/info) e text (1 frase, max 120 chars).
Responda APENAS em JSON: { "insights": [{ "type": "...", "text": "..." }] }
Seja direto, específico, e focado em AÇÃO — o que o instrutor deve fazer.
Use português brasileiro.`

  const userPrompt =
    tab === "uso"
      ? `Dados de USO DA PLATAFORMA:
- Sessões no período: ${totalSessions}
- Variação vs anterior: ${deltaSessions ?? "N/A"}%
- Alunos que nunca acessaram: ${metrics.neverAccessed ?? 0} de ${metrics.totalStudents ?? 0}
- Alunos inativos (14+ dias): ${metrics.inactive ?? 0}
- Unidades: ${metrics.units?.map((u) => `${u.name}: ${u.activePct}% ativos, ${u.completionPct}% conclusão`).join("; ") ?? "N/A"}`
      : `Dados de APRENDIZAGEM:
- Profundidade média: ${avgDepth}/7
- Total de reflexões: ${totalReflections ?? 0}
- Total de alunos: ${metrics.totalStudents ?? 0}
- Módulos sem reflexão: ${metrics.zeroReflModules ?? 0}
- Módulo com mais reflexões: "${metrics.topModule ?? "N/A"}" (${metrics.topModuleCount ?? 0})
- Média de palavras por reflexão: ${metrics.avgWords ?? 0}`

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    })

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content ?? "{}"
    const parsedResult = JSON.parse(content.replace(/```json\n?/g, "").replace(/```/g, ""))
    return NextResponse.json(parsedResult)
  } catch (err) {
    console.error("[insights] AI error:", err)
    return NextResponse.json({ insights: [] })
  }
}
