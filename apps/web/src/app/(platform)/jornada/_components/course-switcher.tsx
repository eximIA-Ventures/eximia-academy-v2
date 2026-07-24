"use client"

// ---------------------------------------------------------------------------
// EPIC-JORNADA (JRN-D, Hugo 2026-07-24) — Seletor de curso da Jornada.
// ---------------------------------------------------------------------------
// Dropdown discreto no topo do construtor E do dashboard: troca o curso ativo
// sem voltar ao hub. Navega para /jornada?curso=<courseId> (o roteador SSR
// reancorra todos os motores no curso escolhido). Krug: com 1 só curso o seletor
// NÃO aparece (nada a escolher) — o chamador só monta quando options.length > 1.
// `<select>` nativo por robustez/acessibilidade (teclado + leitor de tela de
// graça), estilizado com os tokens do tema, sem estado próprio.
// ---------------------------------------------------------------------------

import { ChevronsUpDown } from "lucide-react"
import { useRouter } from "next/navigation"

export interface CourseOption {
  courseId: string
  courseTitle: string
}

export function CourseSwitcher({
  options,
  selectedCourseId,
}: {
  options: CourseOption[]
  selectedCourseId: string | null
}) {
  const router = useRouter()
  if (options.length < 2) return null

  return (
    <label
      data-testid="journey-course-switcher"
      className="group inline-flex max-w-full items-center gap-2 rounded-xl border border-border-subtle bg-bg-card px-3 py-2 text-sm shadow-card transition-colors hover:border-cerrado-500/40"
    >
      <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-text-muted">
        Curso
      </span>
      <span className="relative inline-flex min-w-0 items-center">
        <select
          aria-label="Trocar de curso"
          value={selectedCourseId ?? ""}
          onChange={(e) => router.push(`/jornada?curso=${encodeURIComponent(e.target.value)}`)}
          className="min-w-0 max-w-[15rem] cursor-pointer appearance-none truncate bg-transparent pr-6 font-semibold text-text-primary focus:outline-none"
        >
          {selectedCourseId == null && (
            <option value="" disabled>
              Selecione um curso
            </option>
          )}
          {options.map((o) => (
            <option key={o.courseId} value={o.courseId}>
              {o.courseTitle}
            </option>
          ))}
        </select>
        <ChevronsUpDown
          size={14}
          aria-hidden="true"
          className="pointer-events-none absolute right-0 text-text-muted transition-colors group-hover:text-cerrado-500"
        />
      </span>
    </label>
  )
}
