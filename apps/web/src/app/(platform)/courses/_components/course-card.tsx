"use client"

import { ArrowRight, BookOpen, Check, Layers, RotateCcw, Users } from "lucide-react"
import Link from "next/link"

// ---------------------------------------------------------------------------
// CourseCard — redesign Apple-like da casa (Hugo 2026-07-15). Referências:
// cards de trilha ("Minhas Trilhas") e chips tonais do "Meu ritmo".
//
//   • Card limpo bg-bg-card + shadow-card, capa BAIXA (h-28) com fallback
//     NEUTRO (bg-bg-elevated + BookOpen muted) — sem gradientes saturados.
//   • Meta vira chips tonais DENTRO do corpo (nunca sobre a imagem):
//     capítulos (oculto quando 0), alunos (quando houver), Concluído verde.
//   • Barra de progresso fina cerrado quando active.
//   • CTA coerente na base: Continuar (sólido cerrado), Revisar (outline
//     neutro), Inscrever-se (outline cerrado), Acessar (outline neutro).
// A lógica de Link/onEnroll/estados permanece a mesma.
// ---------------------------------------------------------------------------

interface CourseCardProps {
  id: string
  title: string
  description?: string | null
  chapterCount: number
  coverImageUrl?: string | null
  enrollmentStatus?: "active" | "completed" | null
  progressPercentage?: number
  enrolledCount?: number
  onEnroll?: (courseId: string) => void
}

const CTA_BASE =
  "flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all"
const CTA_SOLID = `${CTA_BASE} bg-cerrado-600 text-white hover:bg-cerrado-500`
const CTA_OUTLINE_NEUTRAL = `${CTA_BASE} border border-black/10 text-text-secondary hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10`
const CTA_OUTLINE_CERRADO = `${CTA_BASE} border border-cerrado-600/30 text-cerrado-600 hover:bg-cerrado-600/10`

const CHIP_NEUTRAL =
  "inline-flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-semibold text-text-secondary dark:bg-white/10"
const CHIP_SUCCESS =
  "inline-flex items-center gap-1 rounded-full bg-semantic-success/10 px-2 py-0.5 text-[10px] font-semibold text-semantic-success"

export function CourseCard({
  id,
  title,
  description,
  chapterCount,
  coverImageUrl,
  enrollmentStatus,
  progressPercentage = 0,
  enrolledCount = 0,
  onEnroll,
}: CourseCardProps) {
  const isEnrolled = enrollmentStatus === "active" || enrollmentStatus === "completed"

  const cardContent = (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl bg-bg-card shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-elevated">
      {/* Capa baixa — imagem real ou fallback neutro discreto */}
      <div className="relative h-28 overflow-hidden bg-bg-elevated">
        {coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverImageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <BookOpen size={26} className="text-text-muted/30" />
          </div>
        )}
      </div>

      {/* Corpo */}
      <div className="flex flex-1 flex-col p-4">
        {/* Meta como chips tonais (nunca sobre a imagem) */}
        <div className="flex flex-wrap items-center gap-1.5">
          {chapterCount > 0 && (
            <span className={CHIP_NEUTRAL}>
              <Layers size={10} className="shrink-0" />
              {chapterCount} {chapterCount === 1 ? "capítulo" : "capítulos"}
            </span>
          )}
          {enrolledCount > 0 && (
            <span className={CHIP_NEUTRAL}>
              <Users size={10} className="shrink-0" />
              {enrolledCount} {enrolledCount === 1 ? "aluno" : "alunos"}
            </span>
          )}
          {enrollmentStatus === "completed" && (
            <span className={CHIP_SUCCESS}>
              <Check size={10} className="shrink-0" />
              Concluído
            </span>
          )}
        </div>

        <h3 className="mt-2 text-sm font-semibold leading-snug text-text-primary line-clamp-2 transition-colors group-hover:text-cerrado-600">
          {title}
        </h3>
        {description && (
          <p className="mt-1 text-xs leading-relaxed text-text-muted line-clamp-2">{description}</p>
        )}

        {/* Barra de progresso fina (curso em andamento) */}
        {enrollmentStatus === "active" && progressPercentage > 0 && (
          <div className="mt-2.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-hover">
              <div
                className="h-full rounded-full bg-cerrado-600 transition-all duration-500"
                style={{ width: `${Math.min(progressPercentage, 100)}%` }}
              />
            </div>
            <span className="text-[10px] font-semibold tabular-nums text-text-muted">
              {Math.round(progressPercentage)}%
            </span>
          </div>
        )}

        {/* CTA coerente na base */}
        <div className="mt-auto pt-3">
          {(enrollmentStatus === null || enrollmentStatus === undefined) && onEnroll ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                onEnroll(id)
              }}
              className={CTA_OUTLINE_CERRADO}
            >
              Inscrever-se
            </button>
          ) : enrollmentStatus === "active" ? (
            <span className={CTA_SOLID}>
              Continuar
              <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          ) : enrollmentStatus === "completed" ? (
            <span className={CTA_OUTLINE_NEUTRAL}>
              <RotateCcw size={12} />
              Revisar
            </span>
          ) : !onEnroll && !isEnrolled ? (
            <span className={CTA_OUTLINE_NEUTRAL}>
              Acessar
              <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )

  if (isEnrolled || !onEnroll) {
    return (
      <Link href={`/courses/${id}`} className="block">
        {cardContent}
      </Link>
    )
  }

  return cardContent
}
