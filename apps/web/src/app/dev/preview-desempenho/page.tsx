import { StudentHomeCard } from "@/components/analytics/student-home-card"
import type { ComparableMetricBlock, StudentHomeIndicators } from "@/types/analytics"
import { notFound } from "next/navigation"

// "Meu ritmo" indicators sample: Você mais recente (último acesso invertido → Você
// vence), Ritmo no_ritmo + 58% em dia (sem vencedor), Progresso Média maior (destaque
// na MÉDIA), Engajamento Você maior (destaque em Você).
const INDICATORS: StudentHomeIndicators = {
  subject: { lastAccessDays: 1, ritmoDisplay: "no_ritmo", progressPct: 50, engagement: 14 },
  reference: {
    lastAccessAvgDays: 4,
    ritmoEmDiaPct: 58,
    progressAvgPct: 55,
    engagementAvg: 9,
  },
}

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
  // SH-1.1 additive fields (feed the new StudentProgressHeadline hero/support).
  distinctActiveDays: 12,
  consciousCompletionPct: 68,
  avgDepth: 4.2,
}

const UNIT: ComparableMetricBlock = {
  totalStudents: 100,
  activeStudents: 20, // 20/100 → 20% activity
  completedSessions: 500, // /100 → média 5
  totalSessions: 800,
  reflectionCount: 400, // /100 → média 4
  avgSessionsPerStudent: 5.9,
  completionPct: 63,
  // SH-1.1 additive: per-student distribution the reference column can reanchor
  // to (SH-1.5 wires "mediana vs média"); present here for a faithful preview.
  distinctActiveDays: 7,
  // Média's Profundidade (4.8) beats Você (4.2) on purpose, so the preview
  // DEMONSTRATES the winner highlight landing on the MÉDIA cell for that column.
  avgDepth: 4.8,
  referenceStats: {
    completionPct: { median: 60, p25: 42, p75: 78 },
    avgDepth: { median: 3.6, p25: 2.4, p75: 4.8 },
  },
}

const CONTINUE_HREF = "/courses"

export default function PreviewDesempenhoPage() {
  if (process.env.NODE_ENV === "production") notFound()

  return (
    <div className="min-h-screen bg-bg-app px-6 py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        {/* SH-1.4 — the student home card. Comparison is the default+only view:
            2-row (Você / Média da organização) indicators-in-columns table, with
            the winner highlighted per indicator. Single "Próximo passo" CTA BELOW
            the card. The reference is the ORG average (M2), not a unidade. */}
        <StudentHomeCard
          student={STUDENT}
          unit={UNIT}
          indicators={INDICATORS}
          continueHref={CONTINUE_HREF}
        />
      </div>
    </div>
  )
}
