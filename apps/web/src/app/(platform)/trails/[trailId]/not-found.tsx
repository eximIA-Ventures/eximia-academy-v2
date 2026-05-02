import { buttonVariants } from "@eximia/ui"
import Link from "next/link"

export default function TrailNotFound() {
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
            d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z"
          />
        </svg>
      </div>
      <div>
        <h2 className="text-xl font-semibold text-text-primary">
          Trilha nao encontrada
        </h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-text-secondary">
          A trilha que voce procura nao existe ou foi removida.
        </p>
      </div>
      <Link href="/trails" className={buttonVariants({ variant: "outline" })}>
        Ver todas as trilhas
      </Link>
    </div>
  )
}
