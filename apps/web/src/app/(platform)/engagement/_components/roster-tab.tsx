"use client"

// ---------------------------------------------------------------------------
// Cards Mestre-Detalhe — seção persistente entre os cards e as abas
// (fatia 12 → 16a visual Meu ritmo → 16b seção persistente → 16c conteúdo
// Tabela simplificada).
// ---------------------------------------------------------------------------
// Fatia 16c (spec-roster-reforma-v3.md): o POSICIONAMENTO da 16b está
// APROVADO e congelado (seção persistente, testid roster-section no shell,
// visível em todas as abas, só com card ativo). O CONTEÚDO trocou por
// veredito datado e explícito do Hugo (2026-07-17, wizard: "Tabela
// simplificada completa", após ver 16a/16b renderizadas com o print do
// Analytics ao lado — nota de rastreabilidade §1.1 da spec: instrução
// explícita do dono vence a rejeição da rodada 1, que era sobre a tabela numa
// ABA isolada, contexto diferente). Sai o visual Meu ritmo; entra a
// `StudentInsightsTable variant="manager"` COMPLETA do Analytics (título,
// busca "Buscar aluno", Exportar CSV, sort, colunas Nome/Último acesso/Ritmo/
// Progresso/Engaj./Ação), consumida como está — NUNCA editada (compartilhada
// com o dashboard do Analytics).
// O que permanece da 16a/16b:
//   • cohort = bucket INTEIRO do card (`cardStudentIds[activeCard]`, lista ==
//     número do card por construção), nunca o `restrictToStudentIds`;
//   • fetch em chunks de 200 (MAX_IDS) com withFocus, ordenação pt-BR,
//     empty-states, skeleton;
//   • filtro por curso client-side narrowing-only, reset na troca de cohort;
//     compõe com a busca nativa do componente (curso estreita FORA, busca
//     estreita DENTRO do que sobrou; Exportar baixa as linhas visíveis).
// A coluna Ação exercita o circuito E10 existente: router.push para
// /engagement?student=&action= na MESMA página; o efeito de deep-link do
// shell seleciona a Central de Envios pré-preenchida e a seção continua
// visível (activeCard não muda).
// ---------------------------------------------------------------------------

import {
  type StudentInsightRow,
  StudentInsightsTable,
} from "@/components/analytics/student-insights-table"
import { EmptyState, Skeleton } from "@eximia/ui"
import { Users } from "lucide-react"
import { useEffect, useState } from "react"
import { withFocus } from "./engagement-fetch"
import type { EngagementStudentDetail, EngagementStudentsDetailResponse } from "./types"

/** The route's detail-mode cap (route.ts MAX_IDS) — chunk size for big cohorts. */
const IDS_CHUNK = 200

/**
 * Adapter fino EngagementStudentDetail → StudentInsightRow (fatia 16c §4.2,
 * ressuscitado da fatia 12, agora exportado para teste de unidade). Todos os
 * campos já vêm do GET /api/engagement/students?ids= — zero mudança de route.
 * `subteam` ausente de propósito (showSubteam={false}, sem coluna Time).
 */
export function toInsightRow(d: EngagementStudentDetail): StudentInsightRow {
  return {
    id: d.id,
    full_name: d.fullName ?? "",
    email: d.email ?? "",
    lastSessionDate: d.lastSessionDate,
    totalSessions: d.totalSessions,
    completedSessions: d.completedSessions,
    coursesEnrolled: d.coursesEnrolled ?? 0,
    coursesCompleted: d.coursesCompleted ?? 0,
    courseProgressPct: d.progressPct,
    reflectionsCount: d.reflectionsCount,
    ritmo: d.ritmo,
    triagem: d.status,
  }
}

interface RosterTabProps {
  /**
   * Cohort INTEIRO do card ativo (cardStudentIds[activeCard]). Nunca null: o
   * shell só monta a seção persistente com um card ativo (fatia 16b §5.1).
   */
  studentIds: string[]
  focus?: string | null
  /** Whether the caller may act on a row (mirrors `canAct` — enables the Ação column). */
  canNudge: boolean
}

interface LoadedRoster {
  students: EngagementStudentDetail[]
  courses: Array<{ id: string; title: string }>
}

export function RosterTab({ studentIds, focus, canNudge }: RosterTabProps) {
  const [roster, setRoster] = useState<LoadedRoster | null>(null)
  const [error, setError] = useState(false)
  // Course filter — "" = "Todos os cursos". Reset whenever the cohort changes
  // (card switch / drill-down): derived from the active card, never persistent
  // across cards.
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
        // concatenate (a card bucket can exceed MAX_IDS=200).
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

  // Client-side narrowing only: the course filter can only REMOVE rows from
  // the loaded cohort, never add — and never refetches. It composes with the
  // component's native "Buscar aluno" search: curso estreita FORA (here),
  // busca estreita DENTRO do que sobrou (inside the component).
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
      <StudentInsightsTable
        students={filteredStudents.map(toInsightRow)}
        variant="manager"
        canNudge={canNudge}
        showSubteam={false}
      />
    </div>
  )
}
