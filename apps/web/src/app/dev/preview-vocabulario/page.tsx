"use client"

import { StudentHomeCard } from "@/components/analytics/student-home-card"
import {
  type StudentInsightRow,
  StudentInsightsTable,
} from "@/components/analytics/student-insights-table"
import type { ComparableMetricBlock, StudentHomeIndicators } from "@/types/analytics"
import { Moon, Sun } from "lucide-react"
import { notFound } from "next/navigation"
import { Suspense, useEffect, useState } from "react"

/**
 * PREVIEW TEMPORARIO — as tres mudancas de vocabulario de 2026-08-01, juntas.
 *
 * Existe para o Hugo conferir lado a lado, porque as duas tabelas vivem em
 * telas diferentes (gestor em /engagement, aluno em /dashboard) e a mudanca so
 * faz sentido vista em conjunto: o ponto dela e justamente que os dois passem a
 * ler o MESMO numero.
 *
 * Os dados sao os da captura que o Hugo mandou (Cintia Santana e companhia),
 * para a comparacao com a tela real ser direta.
 */

// A MESMA pessoa nas duas tabelas, com os MESMOS numeros. Antes desta mudanca,
// o gestor via 47% de progressao e a aluna via 47% de conclusao: coincidencia
// que sumia no proximo aluno.
const CINTIA_PERCORRIDO = 100
const CINTIA_CONCLUSAO = 47

const ALUNOS: StudentInsightRow[] = [
  {
    id: "s1",
    full_name: "Artur Barcelos",
    email: "artur@cory.com",
    lastSessionDate: new Date(Date.now() - 62 * 864e5).toISOString(),
    totalSessions: 6,
    completedSessions: 6,
    coursesEnrolled: 1,
    coursesCompleted: 0,
    courseProgressPct: 10,
    viewProgressPct: 63,
    progressionPct: 10,
    reflectionsCount: 0,
    ritmo: "atrasado",
  },
  {
    id: "s2",
    full_name: "Caio Pinheiro",
    email: "caio@cory.com",
    lastSessionDate: new Date(Date.now() - 4 * 864e5).toISOString(),
    totalSessions: 22,
    completedSessions: 22,
    coursesEnrolled: 1,
    coursesCompleted: 1,
    courseProgressPct: 100,
    viewProgressPct: 100,
    progressionPct: 100,
    reflectionsCount: 41,
    ritmo: "no_ritmo",
  },
  {
    id: "s3",
    full_name: "Cintia Santana",
    email: "cintia@cory.com",
    lastSessionDate: new Date(Date.now() - 30 * 864e5).toISOString(),
    totalSessions: 10,
    completedSessions: 10,
    coursesEnrolled: 1,
    coursesCompleted: 0,
    courseProgressPct: CINTIA_CONCLUSAO,
    viewProgressPct: CINTIA_PERCORRIDO,
    progressionPct: 47,
    reflectionsCount: 15,
    ritmo: "no_ritmo",
  },
  {
    id: "s4",
    full_name: "Neusa Jorge",
    email: "neusa@cory.com",
    lastSessionDate: new Date(Date.now() - 60 * 864e5).toISOString(),
    totalSessions: 8,
    completedSessions: 8,
    coursesEnrolled: 1,
    coursesCompleted: 0,
    courseProgressPct: 16,
    viewProgressPct: 100,
    progressionPct: 16,
    reflectionsCount: 0,
    ritmo: "no_ritmo",
  },
  {
    id: "s5",
    full_name: "Venilton Amaral",
    email: "venilton@cory.com",
    lastSessionDate: null,
    totalSessions: 0,
    completedSessions: 0,
    coursesEnrolled: 1,
    coursesCompleted: 0,
    courseProgressPct: 0,
    viewProgressPct: null,
    progressionPct: null,
    reflectionsCount: 0,
    ritmo: "nao_iniciado",
  },
]

// A Cintia, vista por ela mesma. Os numeros de Percorrido e Conclusao sao
// literalmente os mesmos da linha dela na tabela do gestor, acima.
const INDICADORES: StudentHomeIndicators = {
  subject: {
    lastAccessDays: 30,
    ritmoDisplay: "atrasado",
    progressPct: CINTIA_CONCLUSAO,
    percorridoPct: CINTIA_PERCORRIDO,
    engagement: 35,
    interactions: 10,
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

const BLOCO: ComparableMetricBlock = {
  totalStudents: 1,
  activeStudents: 1,
  completedSessions: 10,
  totalSessions: 10,
  reflectionCount: 15,
  avgSessionsPerStudent: 10,
  completionPct: CINTIA_CONCLUSAO,
}

/**
 * O Suspense aqui NÃO é enfeite: sem ele o build QUEBRA (2026-08-03).
 *
 * `StudentInsightsTable` arrasta, na árvore dela, um `useSearchParams()`. Numa
 * página `"use client"` isso obriga o Next a "sair" da renderização estática, e
 * ele recusa fazer isso sem uma fronteira de Suspense declarada, abortando o
 * export inteiro. Note que `export const dynamic = "force-dynamic"` NÃO resolve:
 * essa configuração de rota só vale em página server, e `preview-desempenho`
 * (que a usa e funciona) é justamente uma dessas. Aqui a página é client, por
 * causa do `useState` do alternador claro/escuro, então o remédio é o Suspense.
 */
// GUARD: 404 in production. This route must never be reachable in a deploy.
export default function PreviewVocabularioPage() {
  if (process.env.NODE_ENV === "production") notFound()

  return (
    <Suspense fallback={null}>
      <PreviewVocabulario />
    </Suspense>
  )
}

function PreviewVocabulario() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
  }, [dark])

  return (
    <div className="min-h-screen space-y-10 bg-bg-app p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <h1 className="font-bold text-2xl text-text-primary">
            Vocabulário: as três mudanças de 01/08
          </h1>
          <p className="mt-1.5 text-sm text-text-muted">
            A Cintia Santana aparece nas duas tabelas, com os mesmos números. É esse o ponto: o
            gestor e ela passam a ler o mesmo 47%.
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

      <section className="space-y-3">
        <div>
          <h2 className="font-bold text-lg text-text-primary">1, tabela do gestor</h2>
          <p className="text-sm text-text-muted">
            A coluna <strong>PROGRESSO</strong> virou <strong>CONCLUSÃO</strong>, e o número mudou
            junto: agora é a conclusão declarada, não a progressão. Clique no <strong>(i)</strong>{" "}
            ao lado do título para ver o texto novo.
          </p>
        </div>
        <StudentInsightsTable students={ALUNOS} variant="manager" />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-bold text-lg text-text-primary">2 e 3, tela da aluna</h2>
          <p className="text-sm text-text-muted">
            O rótulo do toggle virou <strong>Meu progresso</strong>, e os textos de ajuda das linhas
            Percorrido e Conclusão foram simplificados. Repare que a Conclusão dela é{" "}
            <strong>47%</strong>, o mesmo número da tabela acima.
          </p>
        </div>
        <StudentHomeCard
          student={BLOCO}
          unit={BLOCO}
          indicators={INDICADORES}
          studentFirstName="Cintia"
          continueHref="/courses/next"
        />
      </section>
    </div>
  )
}
