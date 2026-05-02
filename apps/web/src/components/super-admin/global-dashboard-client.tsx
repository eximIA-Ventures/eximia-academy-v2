"use client"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@eximia/ui"
import { useQuery } from "@tanstack/react-query"
import { Building2, MessageSquare, Palette, TrendingUp, Users } from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"

interface DashboardResponse {
  tenants: { total: number; active: number; inactive: number }
  users: { total: number; byRole: Record<string, number> }
  sessions: { last30Days: number; completed: number; active: number }
  whitelabel: { enabled: number; percentage: number }
  growth: Array<{ month: string; users: number; tenants: number }>
}

const ROLE_LABELS: Record<string, string> = {
  student: "Estudantes",
  instructor: "Instrutores",
  admin: "Admins",
  manager: "Gestores",
  super_admin: "Super Admins",
}

export function GlobalDashboardClient() {
  const { data, isLoading, isError, error } = useQuery<DashboardResponse>({
    queryKey: ["super-admin-dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/super-admin/dashboard")
      if (!res.ok) throw new Error(`Dashboard fetch failed: ${res.status}`)
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading || !data) return <DashboardSkeleton />

  if (isError) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-semantic-error">
            Erro ao carregar dashboard: {error?.message ?? "Erro desconhecido"}
          </p>
        </CardContent>
      </Card>
    )
  }

  const hasGrowthData = data.growth.some((d) => d.users > 0 || d.tenants > 0)

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Building2}
          iconBg="bg-accent-blue-mid/15"
          iconColor="text-accent-blue-light"
          label="Empresas"
          value={data.tenants.total}
          detail={`${data.tenants.active} ativas · ${data.tenants.inactive} inativas`}
        />
        <StatCard
          icon={Users}
          iconBg="bg-accent-teal/15"
          iconColor="text-accent-teal"
          label="Usuários"
          value={data.users.total}
          detail={
            <Tooltip>
              <TooltipTrigger>
                <span className="cursor-help underline decoration-dotted">Ver por papel</span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <div className="space-y-1">
                  {Object.entries(data.users.byRole).map(([role, count]) => (
                    <div key={role} className="flex justify-between gap-4 text-xs">
                      <span>{ROLE_LABELS[role] ?? role}</span>
                      <span className="font-semibold">{count}</span>
                    </div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          }
        />
        <StatCard
          icon={MessageSquare}
          iconBg="bg-purple-500/15"
          iconColor="text-purple-400"
          label="Sessões (30d)"
          value={data.sessions.last30Days}
          detail={`${data.sessions.completed} concluídas · ${data.sessions.active} ativas`}
        />
        <StatCard
          icon={Palette}
          iconBg="bg-amber-500/15"
          iconColor="text-amber-400"
          label="Whitelabel"
          value={data.whitelabel.enabled}
          detail={`${data.whitelabel.percentage}% das empresas`}
        />
      </div>

      {/* Growth Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-accent-blue-light" />
            <CardTitle className="text-base">Crescimento — Últimos 6 Meses</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {!hasGrowthData ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <TrendingUp size={32} className="text-text-muted/20 mb-3" />
              <p className="text-sm text-text-muted">Sem dados de crescimento ainda</p>
              <p className="text-xs text-text-muted/60 mt-1">Os dados aparecerão conforme novos usuários e empresas forem criados</p>
            </div>
          ) : (
            <div role="img" aria-label="Gráfico de crescimento">
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={data.growth}>
                  <defs>
                    <linearGradient id="gradUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5B8DEF" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#5B8DEF" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradTenants" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4ECDC4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#4ECDC4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="month" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#666" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "#1a1a1a",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "12px",
                      color: "#fff",
                      fontSize: "13px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px", color: "#888" }} />
                  <Area
                    type="monotone"
                    dataKey="users"
                    name="Usuários"
                    stroke="#5B8DEF"
                    strokeWidth={2}
                    fill="url(#gradUsers)"
                    dot={{ fill: "#5B8DEF", r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, stroke: "#5B8DEF", strokeWidth: 2, fill: "#1a1a1a" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="tenants"
                    name="Empresas"
                    stroke="#4ECDC4"
                    strokeWidth={2}
                    fill="url(#gradTenants)"
                    dot={{ fill: "#4ECDC4", r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, stroke: "#4ECDC4", strokeWidth: 2, fill: "#1a1a1a" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  detail,
}: {
  icon: typeof Building2
  iconBg: string
  iconColor: string
  label: string
  value: number
  detail: React.ReactNode
}) {
  return (
    <Card className="overflow-visible">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon size={22} className={iconColor} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">{label}</p>
          <p className="text-2xl font-bold text-text-primary">{value}</p>
          <div className="text-xs text-text-muted">{detail}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={`s-${i}`}>
            <CardContent className="flex items-center gap-4 p-5">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-7 w-12" />
                <Skeleton className="h-3 w-28" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><Skeleton className="h-5 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-[320px] w-full rounded-xl" /></CardContent>
      </Card>
    </div>
  )
}
