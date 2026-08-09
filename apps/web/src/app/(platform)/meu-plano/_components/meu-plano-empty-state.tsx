import { Card, CardContent } from "@eximia/ui"
import { Compass } from "lucide-react"
import Link from "next/link"

/**
 * Rendered when `computeStudentComparison` has no diagnostic yet (no org
 * reference, brand-new student). No fake numbers — the screen is explicit
 * that there isn't enough real data to build a plan from yet.
 */
export function MeuPlanoEmptyState() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 px-6 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-elevated text-text-muted">
            <Compass size={22} aria-hidden="true" />
          </div>
          <h1 className="text-lg font-bold text-text-primary">
            Ainda não há diagnóstico suficiente
          </h1>
          <p className="max-w-md text-sm text-text-secondary">
            Assim que houver dados reais do seu ritmo de estudo, esta tela te ajuda a montar o plano
            da semana com base neles.
          </p>
          <Link
            href="/dashboard"
            className="mt-2 inline-flex h-10 items-center justify-center rounded-xl bg-cerrado-600 px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-cerrado-700"
          >
            Voltar para o Meu ritmo
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
