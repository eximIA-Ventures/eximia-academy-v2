import Link from "next/link"
import { BookOpen, ChevronRight } from "lucide-react"

interface CourseProgressCardProps {
  courseId: string
  title: string
  totalChapters: number
  completedChapters: number
  thumbnailUrl?: string | null
}

export function CourseProgressCard({
  courseId,
  title,
  totalChapters,
  completedChapters,
  thumbnailUrl,
}: CourseProgressCardProps) {
  const progress =
    totalChapters > 0
      ? Math.round((completedChapters / totalChapters) * 100)
      : 0

  return (
    <Link
      href={`/cursos/${courseId}`}
      className="group flex flex-col gap-4 rounded-lg border border-border bg-card p-5 transition-colors duration-150 hover:border-border-strong hover:bg-muted/40"
    >
      {/* Thumbnail ou placeholder */}
      <div className="relative h-32 w-full overflow-hidden rounded-md bg-muted">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt={title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <BookOpen className="h-8 w-8 text-muted-foreground/40" />
          </div>
        )}
        {/* Badge de progresso */}
        <div className="absolute bottom-2 right-2 rounded-full bg-card/90 px-2 py-0.5 text-xs font-semibold text-foreground backdrop-blur-sm">
          {progress}%
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 space-y-3">
        <h3 className="font-display text-sm font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors duration-150">
          {title}
        </h3>

        {/* Barra de progresso */}
        <div className="space-y-1.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {completedChapters} de {totalChapters}{" "}
            {totalChapters === 1 ? "aula" : "aulas"} concluídas
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-primary">
          {progress === 0 ? "Começar" : progress === 100 ? "Revisitar" : "Continuar"}
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors duration-150" />
      </div>
    </Link>
  )
}
