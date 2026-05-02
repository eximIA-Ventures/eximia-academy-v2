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
import { AlertTriangle, Lightbulb, TrendingUp, Users } from "lucide-react"
import { useMemo, useState } from "react"
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts"
import type {
  AreaOption,
  BigFiveAverages,
  DiscDistribution,
  JobRoleOption,
  TeamCompletion,
  TeamMember,
} from "./actions"

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface TeamProfilesClientProps {
  teamMembers: TeamMember[]
  discDistribution: DiscDistribution
  bigFiveAverages: BigFiveAverages
  areas: AreaOption[]
  jobRoles: JobRoleOption[]
  completion: TeamCompletion
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DISC_COLORS: Record<string, string> = {
  D: "var(--color-semantic-error)",
  I: "var(--color-accent-gold)",
  S: "var(--color-semantic-success)",
  C: "var(--color-accent-blue-mid)",
}

const DISC_LABELS: Record<string, string> = {
  D: "Dominância",
  I: "Influência",
  S: "Estabilidade",
  C: "Conformidade",
}

const DISC_BADGE_VARIANT: Record<string, "error" | "warning" | "success" | "info"> = {
  D: "error",
  I: "warning",
  S: "success",
  C: "info",
}

/* ------------------------------------------------------------------ */
/*  Insights engine                                                    */
/* ------------------------------------------------------------------ */

interface Insight {
  icon: "warning" | "tip" | "trend"
  text: string
}

function generateInsights(
  discDist: DiscDistribution,
  bigFiveAvg: BigFiveAverages,
  completion: TeamCompletion,
): Insight[] {
  const insights: Insight[] = []

  if (completion.total === 0) {
    return [
      { icon: "tip", text: "Nenhum membro na equipe ainda. Convide colaboradores para começar." },
    ]
  }

  // Big Five insights (values are 0-100 scale after normalisation)
  if (bigFiveAvg.openness > 0 && bigFiveAvg.openness < 40) {
    insights.push({
      icon: "warning",
      text: "Equipe com baixo Openness — considerar trilhas de inovação e criatividade.",
    })
  }

  if (bigFiveAvg.neuroticism > 60) {
    insights.push({
      icon: "warning",
      text: "Equipe com alto estresse (Neuroticismo elevado) — priorizar trilhas de bem-estar e inteligência emocional.",
    })
  }

  // DISC distribution insights
  const discTotal = discDist.D + discDist.I + discDist.S + discDist.C
  if (discTotal > 0) {
    const scRatio = (discDist.S + discDist.C) / discTotal
    if (scRatio > 0.8) {
      insights.push({
        icon: "tip",
        text: "Equipe conservadora (>80% S+C) — considerar diversificar abordagens com perfis mais assertivos.",
      })
    }

    if (discDist.D === 0) {
      insights.push({
        icon: "trend",
        text: "Sem perfis Dominantes (D) — considerar desenvolvimento de liderança assertiva.",
      })
    }

    if (discDist.I === 0) {
      insights.push({
        icon: "tip",
        text: "Sem perfis de Influência (I) — a equipe pode ter dificuldade com comunicação persuasiva.",
      })
    }
  }

  // Completion insights
  if (completion.discCompleted < completion.total * 0.5) {
    insights.push({
      icon: "tip",
      text: `Apenas ${completion.discCompleted} de ${completion.total} membros completaram o DISC — incentive a participação.`,
    })
  }

  if (completion.bigFiveCompleted < completion.total * 0.5) {
    insights.push({
      icon: "tip",
      text: `Apenas ${completion.bigFiveCompleted} de ${completion.total} membros completaram o Big Five — incentive a participação.`,
    })
  }

  // Big Five positive insights
  if (bigFiveAvg.conscientiousness > 70) {
    insights.push({
      icon: "trend",
      text: "Alta Conscienciosidade na equipe — boa capacidade de organização e disciplina.",
    })
  }

  if (bigFiveAvg.agreeableness > 70) {
    insights.push({
      icon: "trend",
      text: "Alta Amabilidade — equipe colaborativa e com boa empatia.",
    })
  }

  // Limit to 5 insights
  return insights.slice(0, 5)
}

function InsightIcon({ type }: { type: Insight["icon"] }) {
  if (type === "warning")
    return <AlertTriangle className="h-4 w-4 shrink-0 text-semantic-warning" />
  if (type === "trend") return <TrendingUp className="h-4 w-4 shrink-0 text-semantic-success" />
  return <Lightbulb className="h-4 w-4 shrink-0 text-semantic-info" />
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function TeamProfilesClient({
  teamMembers,
  discDistribution,
  bigFiveAverages,
  areas,
  jobRoles,
  completion,
}: TeamProfilesClientProps) {
  const [areaFilter, setAreaFilter] = useState("")
  const [jobRoleFilter, setJobRoleFilter] = useState("")

  // --- Client-side filtering ---
  const filteredMembers = useMemo(() => {
    let result = teamMembers
    if (areaFilter) {
      result = result.filter((m) => m.area_ids.includes(areaFilter))
    }
    if (jobRoleFilter) {
      result = result.filter((m) => m.job_role_id === jobRoleFilter)
    }
    return result
  }, [teamMembers, areaFilter, jobRoleFilter])

  // Recompute aggregations for filtered set
  const filteredAggregations = useMemo(() => {
    const disc: DiscDistribution = { D: 0, I: 0, S: 0, C: 0 }
    let discCount = 0

    for (const m of filteredMembers) {
      if (m.disc_dominant) {
        disc[m.disc_dominant as keyof DiscDistribution]++
        discCount++
      }
    }

    // We can't recompute Big Five from members alone (no individual scores for privacy).
    // Use global averages regardless of filter.
    const isFiltered = areaFilter || jobRoleFilter

    return {
      disc,
      bigFive: bigFiveAverages,
      completion: {
        total: filteredMembers.length,
        discCompleted: discCount,
        bigFiveCompleted: isFiltered ? filteredMembers.length : completion.bigFiveCompleted,
      },
    }
  }, [filteredMembers, areaFilter, jobRoleFilter, bigFiveAverages, completion])

  const insights = useMemo(
    () =>
      generateInsights(
        filteredAggregations.disc,
        filteredAggregations.bigFive,
        filteredAggregations.completion,
      ),
    [filteredAggregations],
  )

  // --- Chart data ---
  const discChartData = useMemo(
    () =>
      (["D", "I", "S", "C"] as const).map((key) => ({
        name: DISC_LABELS[key],
        value: filteredAggregations.disc[key],
        fill: DISC_COLORS[key],
      })),
    [filteredAggregations.disc],
  )

  const radarChartData = useMemo(
    () => [
      { subject: "Abertura", value: filteredAggregations.bigFive.openness },
      { subject: "Conscienciosidade", value: filteredAggregations.bigFive.conscientiousness },
      { subject: "Extroversão", value: filteredAggregations.bigFive.extraversion },
      { subject: "Amabilidade", value: filteredAggregations.bigFive.agreeableness },
      { subject: "Neuroticismo", value: filteredAggregations.bigFive.neuroticism },
    ],
    [filteredAggregations.bigFive],
  )

  const discTotal = discChartData.reduce((sum, d) => sum + d.value, 0)

  return (
    <div className="space-y-6">
      {/* Filters row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-text-secondary" />
          <span className="text-sm text-text-secondary">
            {filteredMembers.length} {filteredMembers.length === 1 ? "membro" : "membros"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            aria-label="Filtrar por área"
            selectSize="sm"
          >
            <option value="">Todas as areas</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <Select
            value={jobRoleFilter}
            onChange={(e) => setJobRoleFilter(e.target.value)}
            aria-label="Filtrar por cargo"
            selectSize="sm"
          >
            <option value="">Todos os cargos</option>
            {jobRoles.map((jr) => (
              <option key={jr.id} value={jr.id}>
                {jr.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Card 1: DISC Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição DISC da Equipe</CardTitle>
          </CardHeader>
          <CardContent>
            {discTotal > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={discChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {discChartData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--color-bg-card)",
                        borderColor: "var(--color-border-default)",
                        borderRadius: "0.5rem",
                        color: "var(--color-text-primary)",
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <p className="mt-2 text-center text-xs text-text-muted">
                  {filteredAggregations.completion.discCompleted} de{" "}
                  {filteredAggregations.completion.total} membros completaram o DISC
                </p>
              </>
            ) : (
              <div className="flex h-[280px] items-center justify-center">
                <p className="text-sm text-text-muted">
                  Nenhum membro completou o assessment DISC ainda.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Big Five Averages */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Médias Big Five da Equipe</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredAggregations.completion.bigFiveCompleted > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={radarChartData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" className="text-xs" />
                    <PolarRadiusAxis domain={[0, 100]} tickCount={5} />
                    <Radar
                      dataKey="value"
                      stroke="var(--color-accent-blue-mid)"
                      fill="var(--color-accent-blue-mid)"
                      fillOpacity={0.3}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--color-bg-card)",
                        borderColor: "var(--color-border-default)",
                        borderRadius: "0.5rem",
                        color: "var(--color-text-primary)",
                      }}
                      formatter={(value) => [`${value}%`, "Média"]}
                    />
                  </RadarChart>
                </ResponsiveContainer>
                <p className="mt-2 text-center text-xs text-text-muted">
                  {filteredAggregations.completion.bigFiveCompleted} de{" "}
                  {filteredAggregations.completion.total} membros completaram o Big Five
                </p>
              </>
            ) : (
              <div className="flex h-[280px] items-center justify-center">
                <p className="text-sm text-text-muted">
                  Nenhum membro completou o assessment Big Five ainda.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Card 3: Gaps e Oportunidades */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gaps e Oportunidades</CardTitle>
        </CardHeader>
        <CardContent>
          {insights.length > 0 ? (
            <ul className="space-y-3">
              {insights.map((insight) => (
                <li
                  key={insight.text}
                  className="flex items-start gap-3 rounded-lg bg-bg-surface p-3"
                >
                  <InsightIcon type={insight.icon} />
                  <span className="text-sm text-text-primary">{insight.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-center text-sm text-text-muted">
              Sem insights disponíveis. Aguarde mais membros completarem os assessments.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Card 4: Team Members Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Membros da Equipe</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredMembers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo DISC</TableHead>
                  <TableHead className="hidden md:table-cell">Estilo de Aprendizagem</TableHead>
                  <TableHead className="hidden sm:table-cell">Último Assessment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <span className="font-medium text-text-primary">{member.full_name}</span>
                    </TableCell>
                    <TableCell>
                      {member.disc_dominant ? (
                        <Badge
                          variant={DISC_BADGE_VARIANT[member.disc_dominant] ?? "info"}
                          badgeSize="sm"
                        >
                          {member.disc_dominant}
                        </Badge>
                      ) : (
                        <span className="text-xs text-text-muted">Pendente</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {member.learning_style ? (
                        <span className="text-sm text-text-secondary">
                          {member.learning_style.length > 60
                            ? `${member.learning_style.slice(0, 60)}...`
                            : member.learning_style}
                        </span>
                      ) : (
                        <span className="text-xs text-text-muted">-</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {member.last_assessment_at ? (
                        <span className="text-sm text-text-secondary">
                          {new Date(member.last_assessment_at).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      ) : (
                        <span className="text-xs text-text-muted">Nunca</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-4 text-center text-sm text-text-muted">
              Nenhum membro encontrado com os filtros selecionados.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
