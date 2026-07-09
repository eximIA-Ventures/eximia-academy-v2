"use client"

import { toggleViewAsStudent } from "@/app/(studio)/instructor/actions"
import { Eye } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"

/** Global "Ver como Aluno" preview bar (S4) — the PROMOTION of the scoped
 *  presentation-viewer toggle to a first-class Studio feature. Sticky amber bar
 *  rendered by StudioLayout whenever the x-view-as-student cookie is on. Preview
 *  only: nothing done here is recorded. */
export function StudioViewAsStudentBar() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleExit() {
    startTransition(async () => {
      await toggleViewAsStudent()
      router.refresh()
    })
  }

  return (
    <div className="sticky top-0 z-20 flex items-center gap-3 rounded-b-xl bg-amber-500/15 px-4 py-2.5 text-amber-700 ring-1 ring-amber-500/25 dark:text-amber-300">
      <Eye size={16} className="shrink-0" />
      <p className="min-w-0 flex-1 truncate text-sm font-medium">
        Você está visualizando como aluno. Nada do que fizer aqui será registrado.
      </p>
      <button
        type="button"
        onClick={handleExit}
        disabled={isPending}
        className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-60"
      >
        {isPending ? "..." : "Sair da visualização"}
      </button>
    </div>
  )
}
