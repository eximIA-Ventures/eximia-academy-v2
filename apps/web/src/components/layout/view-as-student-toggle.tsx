"use client"

import { toggleViewAsStudent } from "@/app/(platform)/instructor/actions"
import { Eye, EyeOff } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"

export function ViewAsStudentToggle({ active }: { active: boolean }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleClick() {
    startTransition(async () => {
      await toggleViewAsStudent()
      router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
        active
          ? "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/25"
          : "bg-white/[0.04] text-text-muted hover:text-text-secondary ring-1 ring-white/[0.06]"
      }`}
    >
      {active ? <EyeOff size={13} /> : <Eye size={13} />}
      {isPending ? "..." : active ? "Voltar ao Instrutor" : "Ver como Aluno"}
    </button>
  )
}
