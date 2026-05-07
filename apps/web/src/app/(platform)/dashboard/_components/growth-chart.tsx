"use client"

import { TrendingUp } from "lucide-react"
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

interface GrowthChartProps {
  data: Array<{
    month: string
    usuarios: number
    empresas: number
  }>
}

export function GrowthChart({ data }: GrowthChartProps) {
  const maxValue = Math.max(...data.flatMap((d) => [d.usuarios, d.empresas]), 10)
  const yMax = Math.ceil(maxValue / 5) * 5 + 5

  return (
    <div className="rounded-2xl bg-bg-card shadow-card p-6">
      <div className="mb-6 flex items-center gap-2">
        <TrendingUp size={18} className="text-text-secondary" />
        <h3 className="text-base font-semibold text-text-primary">
          Crescimento — Ultimos 6 Meses
        </h3>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="gradUsuarios" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gradEmpresas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle, #e5e7eb)" strokeOpacity={0.5} />
          <XAxis
            dataKey="month"
            tick={{ fill: "var(--color-text-muted, #9ca3af)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, yMax]}
            tick={{ fill: "var(--color-text-muted, #9ca3af)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-bg-elevated, #fff)",
              borderColor: "var(--color-border-subtle, #e5e7eb)",
              borderRadius: 12,
              fontSize: 13,
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
            labelStyle={{ fontWeight: 600, color: "var(--color-text-primary, #111)" }}
          />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            wrapperStyle={{ fontSize: 12, paddingTop: 16 }}
          />
          <Area
            type="monotone"
            dataKey="usuarios"
            name="Usuarios"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#gradUsuarios)"
            dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
          <Area
            type="monotone"
            dataKey="empresas"
            name="Empresas"
            stroke="#2dd4bf"
            strokeWidth={2}
            fill="url(#gradEmpresas)"
            dot={{ r: 3, fill: "#2dd4bf", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
