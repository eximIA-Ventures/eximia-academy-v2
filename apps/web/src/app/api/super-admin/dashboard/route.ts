import { requireSuperAdmin } from "@/lib/super-admin-auth"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { format, subMonths } from "date-fns"
import { ptBR } from "date-fns/locale"
import { NextResponse } from "next/server"

/* ----------------------------------- GET ---------------------------------- */

export async function GET() {
  const supabase = await createClient()
  const { user, profile } = await requireSuperAdmin(supabase)

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!profile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Use service client for cross-tenant queries (super_admin has no tenant_id)
  const serviceClient = createServiceClient()

  try {
    // --- Tenant stats ---
    const { count: totalTenants } = await serviceClient
      .from("tenants")
      .select("id", { count: "exact", head: true })

    const { count: activeTenants } = await serviceClient
      .from("tenants")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")

    const { count: inactiveTenants } = await serviceClient
      .from("tenants")
      .select("id", { count: "exact", head: true })
      .eq("status", "inactive")

    const { count: whitelabelEnabled } = await serviceClient
      .from("tenants")
      .select("id", { count: "exact", head: true })
      .eq("whitelabel_enabled", true)

    // --- User stats (count per role) ---
    const roles = ["student", "admin", "manager", "super_admin"]
    const roleCountResults = await Promise.all(
      roles.map(async (role) => {
        const { count } = await serviceClient
          .from("users")
          .select("id", { count: "exact", head: true })
          .eq("role", role)
        return { role, count: count ?? 0 }
      }),
    )

    const roleCounts: Record<string, number> = {}
    let totalUsers = 0
    for (const { role, count } of roleCountResults) {
      if (count > 0) roleCounts[role] = count
      totalUsers += count
    }

    // --- Session stats (last 30 days) ---
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString()

    const { count: sessionsLast30Days } = await serviceClient
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", thirtyDaysAgoISO)

    const { count: completedSessions } = await serviceClient
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", thirtyDaysAgoISO)
      .eq("status", "completed")

    const { count: activeSessions } = await serviceClient
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", thirtyDaysAgoISO)
      .eq("status", "active")

    // --- Growth data: cumulative totals at end of each of last 6 months ---
    const now = new Date()
    const growthData: Array<{ month: string; users: number; tenants: number }> = []

    const growthPromises = []
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i)
      const label = format(monthDate, "MMM", { locale: ptBR })
      const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1)

      // End of this month (or now for current month)
      const endDate = i === 0
        ? now.toISOString()
        : `${format(subMonths(now, i - 1), "yyyy-MM")}-01T00:00:00.000Z`

      growthPromises.push(
        Promise.all([
          serviceClient
            .from("users")
            .select("id", { count: "exact", head: true })
            .lt("created_at", endDate),
          serviceClient
            .from("tenants")
            .select("id", { count: "exact", head: true })
            .lt("created_at", endDate),
        ]).then(([usersResult, tenantsResult]) => ({
          month: capitalizedLabel,
          users: usersResult.count ?? 0,
          tenants: tenantsResult.count ?? 0,
        })),
      )
    }

    const growthResults = await Promise.all(growthPromises)
    for (const result of growthResults) {
      growthData.push(result)
    }

    // --- Whitelabel percentage ---
    const total = totalTenants ?? 0
    const wlEnabled = whitelabelEnabled ?? 0
    const whitelabelPercentage = total > 0 ? Math.round((wlEnabled / total) * 100) : 0

    return NextResponse.json({
      tenants: {
        total: totalTenants ?? 0,
        active: activeTenants ?? 0,
        inactive: inactiveTenants ?? 0,
      },
      users: {
        total: totalUsers,
        byRole: roleCounts,
      },
      sessions: {
        last30Days: sessionsLast30Days ?? 0,
        completed: completedSessions ?? 0,
        active: activeSessions ?? 0,
      },
      whitelabel: {
        enabled: wlEnabled,
        percentage: whitelabelPercentage,
      },
      growth: growthData,
    })
  } catch (error) {
    console.error("Super admin dashboard error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
