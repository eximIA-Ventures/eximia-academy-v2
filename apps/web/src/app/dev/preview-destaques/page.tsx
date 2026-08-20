"use client"

import { StudentHomeCard } from "@/components/analytics/student-home-card"
import { summaryHighlight } from "@/lib/analytics/ritmo-summary"
import type { ComparableMetricBlock, StudentHomeIndicators } from "@/types/analytics"
import { Moon, Sun } from "lucide-react"
import { notFound } from "next/navigation"
import { useEffect, useState } from "react"

/**
 * PREVIEW TEMPORARIO — as 4 variacoes do bloco de destaque.
 *
 * Hugo (2026-08-03): "pode colocar alguma coisa colorida lá. Agora pensa em
 * outras variações a partir desse modelo de destaque, outras variações para
 * outros tipos de informações".
 *
 * Cada caso abaixo e um aluno REAL possivel, montado para disparar uma variacao
 * diferente. A precedencia entre elas esta em `summaryHighlight`, e o preview
 * existe justamente para conferir se a escolha bate com o que faria sentido
 * dizer aquela pessoa.
 */

const BLOCO: ComparableMetricBlock = {
  totalStudents: 36,
  activeStudents: 36,
  completedSessions: 7,
  totalSessions: 7,
  reflectionCount: 5,
  avgSessionsPerStudent: 7,
  completionPct: 68,
}

const BASE: StudentHomeIndicators = {
  subject: {
    lastAccessDays: 3,
    ritmoDisplay: "no_ritmo",
    progressPct: 47,
    percorridoPct: 100,
    engagement: 35,
    interactions: 12,
    reflections: 15,
    interactionsMax: 12,
    reflectionsMax: 41,
    engagementRank: 4,
    engagementTotalStudents: 36,
  },
  reference: {
    lastAccessAvgDays: 64,
    ritmoEmDiaPct: 60,
    progressAvgPct: 68,
    percorridoAvgPct: 82,
    engagementAvg: 19,
    interactionsAvg: 7,
    reflectionsAvg: 5,
    interactionsMaxAvg: 12,
    reflectionsMaxAvg: 41,
    engagementMaxAvg: 65,
  },
}

function comSubject(patch: Partial<StudentHomeIndicators["subject"]>): StudentHomeIndicators {
  return { ...BASE, subject: { ...BASE.subject, ...patch } }
}

const CASOS: Array<{ nome: string; quem: string; porque: string; ind: StudentHomeIndicators }> = [
  {
    nome: "Ausência",
    quem: "Rinaldo, sumiu há 30 dias",
    porque:
      "Quem sumiu há duas semanas não tem problema de quantidade de reflexão, tem problema de não estar aqui. É o único vermelho da paleta, e é o único caso cujo próximo passo cabe hoje.",
    ind: comSubject({ lastAccessDays: 30, ritmoDisplay: "atrasado" }),
  },
  {
    nome: "Conquista",
    quem: "Caio, primeiro da turma",
    porque:
      "O único caso em que o número é boa notícia. Vence a lacuna porque alguém no topo já está fazendo o que se pediria a ele.",
    ind: comSubject({
      isTopEngagement: true,
      engagement: 85,
      reflections: 41,
      interactions: 12,
      engagementRank: 1,
    }),
  },
  {
    nome: "Lacuna",
    quem: "Cintia, percorreu tudo e registrou pouco",
    porque:
      "O caso que originou o destaque. Reflexão vem antes de interação porque é onde o aluno registra o próprio pensamento, e é a lacuna que o Percorrido existe para expor.",
    ind: comSubject({ reflections: 15, interactions: 12 }),
  },
  {
    nome: "Posição",
    quem: "Ana, sem lacuna nenhuma",
    porque:
      "O fallback informativo de quem já fez tudo o que dava e não é primeira. Cinza de propósito: é informação, não juízo.",
    ind: comSubject({ reflections: 41, interactions: 12, engagementRank: 4 }),
  },
]

// GUARD: 404 in production. This route must never be reachable in a deploy.
export default function PreviewDestaquesPage() {
  if (process.env.NODE_ENV === "production") notFound()

  const [dark, setDark] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
  }, [dark])

  return (
    <div className="min-h-screen space-y-8 bg-bg-app p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <h1 className="font-bold text-2xl text-text-primary">As quatro variações do destaque</h1>
          <p className="mt-1.5 text-sm text-text-muted">
            A cor vem da <strong>natureza</strong> da informação, não do humor geral do painel. Uma
            pessoa pode estar bem no conjunto e ter uma lacuna específica, e aí um bloco verde sobre
            a lacuna diria a coisa errada.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDark(!dark)}
          className="inline-flex items-center gap-2 rounded-full border border-border-medium bg-bg-card px-4 py-2 font-semibold text-sm text-text-primary"
        >
          {dark ? <Sun size={15} /> : <Moon size={15} />}
          {dark ? "Claro" : "Escuro"}
        </button>
      </header>

      {CASOS.map((c, i) => {
        const hl = summaryHighlight(c.ind)
        return (
          <section key={c.nome} className="space-y-2">
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 className="font-bold text-lg text-text-primary">
                {i + 1}. {c.nome}
              </h2>
              <span className="text-sm text-text-muted">{c.quem}</span>
              <code className="rounded bg-bg-elevated px-2 py-0.5 text-[11px] text-text-muted">
                kind: {hl?.kind ?? "null"}
              </code>
            </div>
            <p className="max-w-3xl text-sm text-text-muted">{c.porque}</p>
            <StudentHomeCard
              student={BLOCO}
              unit={BLOCO}
              indicators={c.ind}
              studentFirstName={c.quem.split(",")[0]}
              continueHref="/courses/next"
            />
          </section>
        )
      })}
    </div>
  )
}
