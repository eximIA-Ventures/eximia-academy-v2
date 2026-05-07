"use client"

import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@eximia/ui"
import { BarChart3, CheckCircle2, Route, ShieldAlert, ShieldCheck, Users } from "lucide-react"
import { useState } from "react"
import type { RoleCoverage, StudentProgress, TrailStat } from "./actions"

// ---- Props ----

interface TrailDashboardClientProps {
  trailStats: TrailStat[]
  roleCoverage: RoleCoverage[]
  studentProgress: StudentProgress[]
  trails: Array<{ id: string; title: string }>
  roles: Array<{ id: string; name: string }>
}

// ---- Status helpers ----

const STATUS_LABELS: Record<string, string> = {
  active: "Em andamento",
  completed: "Concluido",
  dropped: "Desistiu",
}

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "error"> = {
  active: "default",
  completed: "success",
  dropped: "error",
}

// ---- Component ----

export function TrailDashboardClient({
  trailStats,
  roleCoverage,
  studentProgress,
  trails,
  roles,
}: TrailDashboardClientProps) {
  const [filterTrailId, setFilterTrailId] = useState("")
  const [filterRoleName, setFilterRoleName] = useState("")

  // Filter student progress
  const filteredStudents = studentProgress.filter((sp) => {
    if (filterTrailId && sp.trailId !== filterTrailId) return false
    if (filterRoleName && sp.roleName !== filterRoleName) return false
    return true
  })

  // Global KPIs
  const totalStudents = new Set(studentProgress.map((sp) => sp.userId)).size
  const totalCompleted = studentProgress.filter((sp) => sp.status === "completed").length
  const globalAvgProgress =
    studentProgress.length > 0
      ? Math.round(
          studentProgress.reduce((sum, sp) => sum + sp.progressPct, 0) / studentProgress.length,
        )
      : 0

  const rolesWithTrails = roleCoverage.filter((r) => r.hasTrail).length
  const rolesWithoutTrails = roleCoverage.filter((r) => !r.hasTrail).length

  return (
    <div className="space-y-6">
      {/* ---- KPI Summary Cards ---- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-cerrado-600/15 text-cerrado-400">
              <Route size={20} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm text-text-secondary">Trilhas Criadas</p>
              <p className="text-2xl font-bold text-text-primary">{trailStats.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-cerrado-600/15 text-cerrado-400">
              <Users size={20} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm text-text-secondary">Alunos em Trilhas</p>
              <p className="text-2xl font-bold text-text-primary">{totalStudents}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-cerrado-600/15 text-cerrado-400">
              <BarChart3 size={20} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm text-text-secondary">Progresso Medio</p>
              <p className="text-2xl font-bold text-text-primary">{globalAvgProgress}%</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-cerrado-600/15 text-cerrado-400">
              <CheckCircle2 size={20} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm text-text-secondary">Trilhas Concluidas</p>
              <p className="text-2xl font-bold text-text-primary">{totalCompleted}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ---- Per-Trail Stats ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-text-primary">
            Visão por Trilha
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trailStats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Route className="h-10 w-10 text-text-secondary mb-3" />
              <p className="text-sm text-text-secondary">Nenhuma trilha criada</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trilha</TableHead>
                    <TableHead>Cargo Alvo</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Alunos</TableHead>
                    <TableHead className="text-right">Concluiram</TableHead>
                    <TableHead className="text-right">% Medio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trailStats.map((stat) => (
                    <TableRow key={stat.trailId}>
                      <TableCell className="font-medium text-text-primary">
                        {stat.trailTitle}
                      </TableCell>
                      <TableCell className="text-text-secondary">
                        {stat.targetRoleName ?? "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <TrailStatusBadge status={stat.status} />
                      </TableCell>
                      <TableCell className="text-right text-text-primary">
                        {stat.studentCount}
                      </TableCell>
                      <TableCell className="text-right text-text-primary">
                        {stat.completedCount}
                      </TableCell>
                      <TableCell className="text-right">
                        <ProgressPill pct={stat.avgCompletionPct} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- Per-Role Coverage ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-text-primary">
            Cobertura por Cargo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {roleCoverage.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Users className="h-10 w-10 text-text-secondary mb-3" />
              <p className="text-sm text-text-secondary">Nenhum cargo cadastrado</p>
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center gap-4 text-sm text-text-secondary">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-semantic-success" />
                  {rolesWithTrails} cargo{rolesWithTrails !== 1 ? "s" : ""} com trilha
                </span>
                <span className="flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 text-semantic-warning" />
                  {rolesWithoutTrails} cargo{rolesWithoutTrails !== 1 ? "s" : ""} sem trilha
                </span>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Senioridade</TableHead>
                      <TableHead className="text-center">Tem Trilha?</TableHead>
                      <TableHead className="text-right">Qtd. Trilhas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roleCoverage.map((role) => (
                      <TableRow key={role.roleId}>
                        <TableCell className="font-medium text-text-primary">
                          {role.roleName}
                        </TableCell>
                        <TableCell className="text-text-secondary capitalize">
                          {role.seniorityLevel}
                        </TableCell>
                        <TableCell className="text-center">
                          {role.hasTrail ? (
                            <ShieldCheck className="mx-auto h-5 w-5 text-semantic-success" />
                          ) : (
                            <ShieldAlert className="mx-auto h-5 w-5 text-semantic-warning" />
                          )}
                        </TableCell>
                        <TableCell className="text-right text-text-primary">
                          {role.trailCount}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ---- Student Progress Table ---- */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg font-semibold text-text-primary">
              Alunos por Trilha
            </CardTitle>
            <div className="flex flex-wrap items-center gap-3">
              <Select
                selectSize="sm"
                value={filterTrailId}
                onChange={(e) => setFilterTrailId(e.target.value)}
                aria-label="Filtrar por trilha"
                className="w-48"
              >
                <option value="">Todas as trilhas</option>
                {trails.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </Select>
              <Select
                selectSize="sm"
                value={filterRoleName}
                onChange={(e) => setFilterRoleName(e.target.value)}
                aria-label="Filtrar por cargo"
                className="w-48"
              >
                <option value="">Todos os cargos</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Users className="h-10 w-10 text-text-secondary mb-3" />
              <p className="text-sm text-text-secondary">
                {studentProgress.length === 0
                  ? "Nenhum aluno inscrito em trilhas"
                  : "Nenhum aluno encontrado com os filtros selecionados"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aluno</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Trilha</TableHead>
                    <TableHead className="text-right">Progresso</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((sp) => (
                    <TableRow key={`${sp.userId}-${sp.trailId}`}>
                      <TableCell className="font-medium text-text-primary">{sp.fullName}</TableCell>
                      <TableCell className="text-text-secondary">{sp.roleName ?? "-"}</TableCell>
                      <TableCell className="text-text-secondary">{sp.trailTitle}</TableCell>
                      <TableCell className="text-right">
                        <ProgressPill pct={sp.progressPct} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={STATUS_VARIANT[sp.status] ?? "default"}>
                          {STATUS_LABELS[sp.status] ?? sp.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mt-3 text-xs text-text-muted text-right">
                {filteredStudents.length} registro{filteredStudents.length !== 1 ? "s" : ""}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ---- Sub-components ----

function TrailStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: "draft" | "success" | "archived" }> = {
    draft: { label: "Rascunho", variant: "draft" },
    active: { label: "Ativa", variant: "success" },
    archived: { label: "Arquivada", variant: "archived" },
  }

  const c = config[status] ?? config.draft
  return <Badge variant={c.variant}>{c.label}</Badge>
}

function ProgressPill({ pct }: { pct: number }) {
  const colorClass =
    pct >= 80 ? "text-semantic-success" : pct >= 40 ? "text-accent-gold" : "text-text-secondary"

  return (
    <div className="flex items-center justify-end gap-2">
      <div className="w-16 h-2 rounded-full bg-bg-surface overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            pct >= 80 ? "bg-semantic-success" : pct >= 40 ? "bg-accent-gold" : "bg-cerrado-600"
          }`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className={`text-sm font-medium tabular-nums ${colorClass}`}>{pct}%</span>
    </div>
  )
}
