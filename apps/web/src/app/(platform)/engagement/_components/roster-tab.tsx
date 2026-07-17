"use client"

// ---------------------------------------------------------------------------
// Cards Mestre-Detalhe — seção persistente entre os cards e as abas
// (fatia 12 → reformada fatia 16 → reposicionada fatia 16b).
// ---------------------------------------------------------------------------
// Fatia 16b (spec-roster-reforma-v2.md): Hugo aprovou a TABELA da fatia 16 mas
// rejeitou o posicionamento em aba ("não tem que ter uma aba chamada Lista,
// tem que estar em todas as abas"). Este componente agora é montado pelo shell
// como SEÇÃO PERSISTENTE (testid roster-section) entre os cards do semáforo e
// a barra de abas, SÓ quando há card ativo — por isso o estado "nenhum card"
// saiu daqui (studentIds não é mais nullable). O resto é a reforma da fatia 16
// (spec-roster-reforma.md), intacta:
//   • the cohort is the FULL bucket behind the active card's number
//     (`cardStudentIds[activeCard]`, derived from the SAME triagemByStudent Map
//     that produced the card's summary — list length == card number by
//     construction), NOT the `restrictToStudentIds` picker union fatia 12 used;
//   • rendering is the RosterInsightsTable ("Meu ritmo" visual grammar),
//     inline, read-only, no links out;
//   • a course <select> (same pattern as the manager dashboard's filter)
//     narrows rows CLIENT-SIDE by the student's courseIds — narrowing only,
//     never widening, and it never refetches nor moves cohortAvgEngagement.
// Fetch: GET /api/engagement/students?ids= (unchanged spine — the route
// re-scopes via resolveEngagementScope, so the client can never widen reach).
// The cohort may exceed the route's MAX_IDS=200 cap, so ids are CHUNKED into
// batches of 200, fetched in parallel and concatenated (spec §4.2); the final
// result is ordered by fullName asc (pt-BR) on the client.
// ---------------------------------------------------------------------------

import { EmptyState, Skeleton } from "@eximia/ui"
import { Users } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { withFocus } from "./engagement-fetch"
import { RosterInsightsTable, engagementScoreOf } from "./roster-insights-table"
import type { EngagementStudentDetail, EngagementStudentsDetailResponse } from "./types"

/** The route's detail-mode cap (route.ts MAX_IDS) — chunk size for big cohorts. */
const IDS_CHUNK = 200

interface RosterTabProps {
  /**
   * Cohort INTEIRO do card ativo (cardStudentIds[activeCard]). Nunca null: o
   * shell só monta a seção persistente com um card ativo (fatia 16b §5.1).
   */
  studentIds: string[]
  focus?: string | null
}

interface LoadedRoster {
  students: EngagementStudentDetail[]
  courses: Array<{ id: string; title: string }>
}

export function RosterTab({ studentIds, focus }: RosterTabProps) {
  const [roster, setRoster] = useState<LoadedRoster | null>(null)
  const [error, setError] = useState(false)
  // Course filter — "" = "Todos os cursos". Reset whenever the cohort changes
  // (card switch / drill-down), spec §6.3: derived from the active card, never
  // persistent across cards.
  const [courseFilter, setCourseFilter] = useState("")

  useEffect(() => {
    let cancelled = false
    setCourseFilter("")
    if (studentIds.length === 0) {
      // Empty cohort — no network round-trip needed, the route would return the
      // same empty result anyway.
      setRoster({ students: [], courses: [] })
      setError(false)
      return
    }
    setRoster(null)
    setError(false)
    ;(async () => {
      try {
        // Chunk the cohort into route-cap-sized batches, fetch in parallel,
        // concatenate (spec §4.2 — a card bucket can exceed MAX_IDS=200).
        const chunks: string[][] = []
        for (let i = 0; i < studentIds.length; i += IDS_CHUNK) {
          chunks.push(studentIds.slice(i, i + IDS_CHUNK))
        }
        const pages = await Promise.all(
          chunks.map(async (chunk) => {
            const res = await fetch(
              withFocus(
                `/api/engagement/students?ids=${encodeURIComponent(chunk.join(","))}`,
                focus,
              ),
            )
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            return (await res.json()) as EngagementStudentsDetailResponse
          }),
        )
        if (cancelled) return
        const students = pages
          .flatMap((p) => p.students)
          .sort((a, b) => (a.fullName ?? "").localeCompare(b.fullName ?? "", "pt-BR"))
        // Union of the per-chunk course blocks, deduped by id, title asc.
        const courseById = new Map<string, string>()
        for (const page of pages) {
          for (const c of page.courses ?? []) courseById.set(c.id, c.title)
        }
        const courses = [...courseById]
          .map(([id, title]) => ({ id, title }))
          .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"))
        setRoster({ students, courses })
      } catch (err) {
        console.error("[roster-tab] load failed:", err)
        if (!cancelled) setError(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [studentIds, focus])

  // Spec §5.3: the Leitura baseline is the average over the FULL card cohort
  // (every loaded row, BEFORE the course filter) — stable while filtering.
  const cohortAvgEngagement = useMemo(() => {
    const students = roster?.students ?? []
    if (students.length === 0) return 0
    return students.reduce((sum, s) => sum + engagementScoreOf(s), 0) / students.length
  }, [roster])

  if (error) {
    return (
      <EmptyState
        className="rounded-2xl bg-bg-card shadow-card"
        icon={<Users size={28} />}
        title="Não foi possível carregar a lista"
        description="Tente novamente em instantes."
      />
    )
  }

  if (roster === null) {
    return (
      <div className="space-y-3 rounded-2xl bg-bg-card p-5 shadow-card">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (roster.students.length === 0) {
    return (
      <EmptyState
        className="rounded-2xl bg-bg-card shadow-card"
        icon={<Users size={28} />}
        title="Nenhum aluno neste grupo no recorte atual"
        description="O card selecionado não tem alunos no recorte em foco."
      />
    )
  }

  // Client-side narrowing only (spec §6.3): the filter can only REMOVE rows
  // from the loaded cohort, never add — and never refetches.
  const filteredStudents = courseFilter
    ? roster.students.filter((s) => (s.courseIds ?? []).includes(courseFilter))
    : roster.students

  return (
    <div className="space-y-3">
      {/* Course filter — same pattern as the manager dashboard's select
          (manager-dashboard-client.tsx). "" = the full cohort. */}
      <div className="flex justify-end">
        <select
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          aria-label="Filtrar por curso"
          className="rounded-md shadow-card bg-bg-surface px-3 py-1.5 text-sm text-text-primary"
        >
          <option value="">Todos os cursos</option>
          {roster.courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>
      <RosterInsightsTable rows={filteredStudents} cohortAvgEngagement={cohortAvgEngagement} />
    </div>
  )
}
