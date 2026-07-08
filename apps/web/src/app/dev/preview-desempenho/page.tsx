import { StudentComparisonView } from "@/components/analytics/student-comparison-view"
import type { ComparableMetricBlock } from "@/types/analytics"
import { ArrowRight, Sparkles } from "lucide-react"
import { notFound } from "next/navigation"

// ---------------------------------------------------------------------------
// /dev/preview-desempenho — DEV-ONLY visual harness for the "Meu desempenho"
// card. Renders the "Sua próxima sessão está pronta" banner + the PURE
// presentational StudentComparisonView with the EXACT mockup numbers, so the
// pixel can be screenshotted and compared to /tmp/meu-desempenho-mockup.png
// WITHOUT a live session. No auth, no fetch.
//
// GUARD: 404 in production. This route must never be reachable in a deploy.
// ---------------------------------------------------------------------------

// Never statically prerender or cache; it is a throwaway dev harness.
export const dynamic = "force-dynamic"

// Mockup targets (/tmp/meu-desempenho-mockup.png):
//   Conclusão   75% vs 63%  → +19%
//   Sessões     13.0 vs 5.9 → +120%
//   Atividade   100% vs 20% → +400%
//   Concluídas  6 vs 5      → +20%
//   Reflexões   8 vs 4      → +100%
//   unidade     "Ribeirão Preto"
//
// The unit side is normalized PER STUDENT for the raw counts (completed
// sessions, reflections) inside buildSignalRows, so we pick unit totals that
// divide cleanly: totalStudents=100 → completed 500/100=5, reflections
// 400/100=4, active 20/100=20%. avgSessionsPerStudent/completionPct are stored
// pre-averaged, so we set them directly (5.9 and 63).

const STUDENT: ComparableMetricBlock = {
  totalStudents: 1,
  activeStudents: 1, // 1/1 → 100% activity
  completedSessions: 6,
  totalSessions: 8,
  reflectionCount: 8,
  avgSessionsPerStudent: 13.0,
  completionPct: 75,
}

const UNIT: ComparableMetricBlock = {
  totalStudents: 100,
  activeStudents: 20, // 20/100 → 20% activity
  completedSessions: 500, // /100 → média 5
  totalSessions: 800,
  reflectionCount: 400, // /100 → média 4
  avgSessionsPerStudent: 5.9,
  completionPct: 63,
}

const CONTINUE_HREF = "/courses"

/** Standalone copy of the dashboard's "próxima sessão" banner (no fetch). */
function NextSessionBanner({ href }: { href: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-bg-card px-5 py-4 shadow-card dark:border dark:border-white/[0.06]">
      <div className="flex min-w-0 items-center gap-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cerrado-600/10">
          <Sparkles size={18} className="text-cerrado-600" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-text-primary sm:text-base">
            Sua próxima sessão está pronta
          </h3>
          <p className="text-xs text-text-muted sm:text-sm">Continue de onde parou.</p>
        </div>
      </div>
      <a
        href={href}
        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-cerrado-600 px-6 text-sm font-semibold text-white transition-all hover:bg-cerrado-500 active:scale-[0.98]"
      >
        Continuar
        <ArrowRight size={16} />
      </a>
    </div>
  )
}

export default function PreviewDesempenhoPage() {
  if (process.env.NODE_ENV === "production") notFound()

  return (
    <div className="min-h-screen bg-bg-app px-6 py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <NextSessionBanner href={CONTINUE_HREF} />
        <StudentComparisonView
          student={STUDENT}
          unit={UNIT}
          unitName="Ribeirão Preto"
          continueHref={CONTINUE_HREF}
        />
      </div>
    </div>
  )
}
