import { buttonVariants } from "@eximia/ui"
import Link from "next/link"

export default function CourseNotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-bg-elevated">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="h-8 w-8 text-text-muted"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
          />
        </svg>
      </div>
      <div>
        <h2 className="text-xl font-semibold text-text-primary">
          Curso nao encontrado
        </h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-text-secondary">
          O curso que voce procura nao existe ou foi removido.
        </p>
      </div>
      <Link href="/courses" className={buttonVariants({ variant: "outline" })}>
        Ver todos os cursos
      </Link>
    </div>
  )
}
