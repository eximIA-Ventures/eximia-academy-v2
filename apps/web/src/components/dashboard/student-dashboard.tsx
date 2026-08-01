import { StudentComparison } from "@/components/analytics/student-comparison"
import { StudyPlanInviteStrip } from "@/components/analytics/study-plan-invite-strip"
import { JourneyPositionCard } from "@/components/dashboard/journey-position-card"
import {
  CompactTrailCard,
  type StudentTrailData,
  TrailProgressCard,
} from "@/components/dashboard/trail-progress-card"
import type {
  JourneyPosition,
  NextStepInfo,
  WeekDayCell,
  WeeklyPlan,
} from "@/components/dashboard/types"
import { ArrowRight, Award, Play } from "lucide-react"
import Link from "next/link"

interface StudentAnalytics {
  summary: {
    enrolledCourses: number
    completedSessions: number
    completedChapters: number
  }
  courses: Array<{
    courseId: string
    title: string
    progress: number
    lastAccessedAt: string
    continueChapterId: string | null
  }>
  recentSessions: Array<{
    sessionId: string
    chapterTitle: string
    status: "active" | "completed"
    completedAt?: string
    whenLabel?: string
  }>
  certificates?: Array<{
    id: string
    enrollmentId: string
    courseTitle: string
    verificationCode: string
    issuedAt: string
  }>
  /**
   * Fases 1A/1B (Hugo 2026-07-15): as trilhas do aluno (enrollments com
   * trail_id), ORDENADAS por atividade recente (mais recente primeiro).
   * Vazio/ausente = aluno sem trilha → dashboard EXATAMENTE como antes.
   */
  trails?: StudentTrailData[]
  dudMessage?: string
  /* Minha Jornada v6.1 (Hugo 2026-07-16), blocos aprovados */
  nextStep?: NextStepInfo | null
  weeklyPlan?: WeeklyPlan | null
  weekDays?: WeekDayCell[]
  sessionsThisWeek?: number
  streakDays?: number
  journey?: JourneyPosition | null
}

interface StudentDashboardProps {
  fullName: string
  data: StudentAnalytics
}

/**
 * Derive the "continue where you left off" destination: the MOST RECENTLY
 * accessed course that has a next/active chapter →
 * /courses/{courseId}/chapters/{chapterId}. Falls back to /courses when no
 * such chapter is known (fresh student, all done).
 *
 * SH-3.3 (Hugo 2026-07-21) — sorts by `lastAccessedAt` DESC before picking the
 * first match (previously picked the first course in ENROLLMENT order, which
 * could diverge from the student's actual most-recent activity). This is the
 * SAME ordering `sortedCourses` already uses server-side
 * (student-dashboard-page.tsx) to pick the "primary course" — unified here so
 * every caller of `resolveContinueHref` agrees on "most recent" the same way.
 */
function resolveContinueHref(courses: StudentAnalytics["courses"]): string {
  const sorted = [...courses].sort(
    (a, b) => new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime(),
  )
  const next = sorted.find((c) => c.continueChapterId)
  return next?.continueChapterId
    ? `/courses/${next.courseId}/chapters/${next.continueChapterId}`
    : "/courses"
}

export function StudentDashboard({ fullName, data }: StudentDashboardProps) {
  const firstName = fullName?.split(" ")[0] ?? ""
  const streakDays = data.streakDays ?? 0

  // Fase 1B — separação trilha × avulso: cursos de trilha vivem nos cards de
  // trilha; a lista de cursos mostra SÓ os avulsos (sem duplicação). Sem trilha
  // nenhuma, tudo degrada para o comportamento antigo ("Seus Cursos" completo).
  const trails = data.trails ?? []
  const hasTrails = trails.length > 0
  const trailCourseIds = new Set(trails.flatMap((t) => t.courses.map((c) => c.courseId)))
  const standaloneCourses = data.courses.filter((c) => !trailCourseIds.has(c.courseId))

  // Princípio de RETOMADA (Seção C aprovada): o hero cita a ÚLTIMA coisa tocada
  // — a trilha mais recente OU um curso avulso mais recente — nunca uma lista.
  // `trails` já chega ordenado por atividade (mais recente primeiro).
  const latestTrail = trails[0] ?? null
  const latestStandaloneAt = standaloneCourses.reduce(
    (max, c) => (c.lastAccessedAt > max ? c.lastAccessedAt : max),
    "",
  )
  const resumeTrail =
    latestTrail && latestTrail.lastActivityAt >= latestStandaloneAt ? latestTrail : null

  // Sem trilha, o hero segue olhando todos os cursos (comportamento antigo).
  const heroCourses = hasTrails ? standaloneCourses : data.courses
  const heroContinueHref = resumeTrail ? resumeTrail.continueHref : resolveContinueHref(heroCourses)

  const courseListCourses = hasTrails ? standaloneCourses : data.courses
  const courseListTitle = hasTrails ? "Cursos avulsos" : "Seus Cursos"

  return (
    <div className="space-y-6">
      <HeroSection
        firstName={firstName}
        summary={data.summary}
        courses={heroCourses}
        continueHref={heroContinueHref}
        trail={resumeTrail}
      />
      {/* Fase 1A/1B — trilhas logo abaixo do hero: 1 trilha → card completo;
          2+ → grid de cards compactos, mais recente primeiro com leve destaque,
          "Ver todas" quando 3+. */}
      {trails.length === 1 && (
        <div className="px-6">
          <TrailProgressCard trail={trails[0]} />
        </div>
      )}
      {trails.length >= 2 && (
        <div className="space-y-3 px-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-text-muted">
              Minhas Trilhas
            </h2>
            {trails.length >= 3 && (
              // Unificação (Hugo 2026-07-15): a aba "Minhas Trilhas" morreu —
              // tudo vive em "Cursos e Trilhas" (/courses). /trails redireciona.
              <Link
                href="/courses"
                className="inline-flex items-center gap-1 text-xs font-semibold text-cerrado-600 transition-colors hover:text-cerrado-500"
              >
                Ver todas
                <ArrowRight size={12} />
              </Link>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {trails.map((trail, i) => (
              <CompactTrailCard key={trail.trailId} trail={trail} highlight={i === 0} />
            ))}
          </div>
        </div>
      )}
      {/* Minha Jornada v6.1 (a), REMOVIDO POR ORA (Hugo 2026-07-16): o card
          Próximo passo provocativo volta quando existir o módulo de aplicação.
          O componente segue em next-step-card.tsx e o dado nextStep segue no
          fetch; com o card fora, a NextStepBar do StudentHomeCard reassume o
          papel de CTA único (showNextStep default true). */}
      {/* 1.2 — Student self-comparison vs UNIDADE average (read-only, no PII).
          SH-3.3 (Hugo 2026-07-21) — passes the SAME `heroContinueHref` the Hero
          CTA above uses (resumeTrail-aware, ordered by recency), instead of a
          separately-computed, unordered `resolveContinueHref(data.courses)`.
          Two call sites computing "continue" differently could pick DIFFERENT
          courses for the same student; one source of truth now. */}
      <div className="space-y-4 px-6">
        {/* SH-3.3 R3 (Hugo 2026-07-21) — "Linha de Convite": faixa independente,
            full-width, ACIMA do card "Meu ritmo" inteiro (fora da moldura do
            <Card>, irmã de StudentHomeCard, não filha).

            PROMOVIDA PARA CÁ em 2026-08-01, e o motivo é medido, não estético:
            ela é o ÚNICO link para /jornada em todo o repositório, e vivia
            dentro de `StudentComparison`, DEPOIS de três early returns
            (NoScopeInvite / ErrorState / Skeleton). Como Skeleton é o primeiro
            paint de toda carga, a única porta da jornada sumia em 4 dos 5
            estados de render, inclusive em qualquer falha da API de analytics.
            Adoção medida em produção: 3 jornadas em 302 matrículas, 1%.

            Aqui ela é irmã incondicional: renderiza antes do fetch, durante o
            fetch e mesmo se ele falhar. O componente não recebe props e não
            depende de dado nenhum, então nunca houve razão para estar atrás de
            uma API. A posição visual é idêntica à anterior. */}
        <StudyPlanInviteStrip />
        {/* JRN-D (Hugo 2026-07-24) — cursos do aluno p/ o seletor do card "Meu
            ritmo" (só aparece com 2+; default "Todos os cursos" = agregado). */}
        <StudentComparison
          continueHref={heroContinueHref}
          studentFirstName={firstName}
          courseOptions={data.courses.map((c) => ({ courseId: c.courseId, courseTitle: c.title }))}
        />
      </div>
      {/* Minha Jornada v6.1 (b), REMOVIDO TEMPORARIAMENTE (Hugo 2026-07-20): o
          card "Meu plano da semana" saiu de vista a pedido do Hugo enquanto o
          produto é replanejado — o componente WeeklyPlanCard e os dados
          (weeklyPlan/weekDays/sessionsThisWeek) seguem intactos para quando
          for reativado. Para restaurar: reverter este commit, ou descomentar
          o bloco abaixo e o import de WeeklyPlanCard no topo do arquivo.
      <WeeklyPlanCard
        plan={data.weeklyPlan ?? null}
        weekDays={data.weekDays ?? []}
        sessionsThisWeek={data.sessionsThisWeek ?? 0}
        streakDays={streakDays}
      /> */}
      {courseListCourses.length > 0 && (
        <ActiveCourses courses={courseListCourses} title={courseListTitle} />
      )}
      {data.certificates && data.certificates.length > 0 && (
        <CertificatesList certificates={data.certificates} />
      )}
      {/* Minha Jornada v6.1 (c)+(d), posição na jornada + atividades recentes */}
      {(data.journey || data.recentSessions.length > 0) && (
        <div className="grid gap-4 px-6 pt-2 lg:grid-cols-2">
          {data.journey && <JourneyPositionCard journey={data.journey} streakDays={streakDays} />}
          {data.recentSessions.length > 0 && <RecentSessions sessions={data.recentSessions} />}
        </div>
      )}
      <div className="h-6" />
    </div>
  )
}

/* === HERO (short + useful) ===
 * Redesign (Hugo 2026-07-14, direção corrigida): the ORIGINAL dark section with
 * the space photo + gradient STAYS — the hero only gets visibly SHORTER
 * (~160px vs ~260px, typography one step down) and USEFUL: the fixed
 * institutional subtitle gives way to a DYNAMIC line (where the student
 * stopped: active course + progress; invitation to start as fallback). The
 * summary numbers become a discreet muted line instead of stat blocks (keeps
 * the height down). The hero ORIENTS; the action CTA of record stays in
 * StudentHomeCard ("Próximo passo") — "Continuar Trilha" here is navigation to
 * the same smart destination (resolveContinueHref), not a competing call.
 */
function pluralize(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`
}

function HeroSection({
  firstName,
  summary,
  courses,
  continueHref,
  trail,
}: {
  firstName: string
  summary: StudentAnalytics["summary"]
  courses: StudentAnalytics["courses"]
  continueHref: string
  /** Fase 1A: com trilha, a linha dinâmica cita a trilha e o CTA mira o
   *  capítulo de continuação do curso ATUAL da trilha. Sem trilha (null),
   *  comportamento anterior intacto. */
  trail: StudentTrailData | null
}) {
  // Same course resolveContinueHref targets; falls back to the most recent one.
  const current = courses.find((c) => c.continueChapterId) ?? courses[0] ?? null
  const hasContinue = Boolean(current?.continueChapterId)
  // A linha de trilha só entra quando há um curso ATUAL nela; trilha 100%
  // concluída cai na linha padrão (e o card de trilha segue mostrando o 100%).
  const trailLine = trail && trail.currentIndex !== null && trail.currentCourseTitle

  return (
    <section
      className="relative flex min-h-[160px] items-end overflow-hidden rounded-2xl shadow-card"
      style={{ background: "#1a1a1a" }}
    >
      <div
        className="absolute inset-y-0 right-0 w-[65%] bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&q=80')",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, #1a1a1a 0%, rgba(26,26,26,0.9) 30%, rgba(26,26,26,0.3) 65%, transparent 100%)",
        }}
      />

      <div className="relative z-10 flex w-full items-end justify-between gap-6 px-8 pb-5 pt-5">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl">
            {firstName ? `Olá, ${firstName}.` : "Bem-vindo."}
          </h1>
          <p className="mt-1.5 truncate text-sm text-white/60">
            {trailLine && trail ? (
              <>
                Você está na trilha <span className="font-medium text-white/90">{trail.title}</span>
                <span className="text-white/40"> · </span>curso {(trail.currentIndex ?? 0) + 1} de{" "}
                {trail.courses.length}
                <span className="text-white/40"> · </span>
                <span className="font-medium text-white/90">{trail.currentCourseTitle}</span>{" "}
                <span className="font-semibold tabular-nums text-cerrado-400">
                  {Math.round(trail.currentCoursePct)}%
                </span>
              </>
            ) : current ? (
              current.progress >= 100 ? (
                <>
                  Você concluiu <span className="font-medium text-white/90">{current.title}</span>.
                  Que tal uma nova trilha?
                </>
              ) : (
                <>
                  Você parou em <span className="font-medium text-white/90">{current.title}</span>
                  <span className="text-white/40"> · </span>
                  <span className="font-semibold tabular-nums text-cerrado-400">
                    {Math.round(current.progress)}%
                  </span>{" "}
                  concluído
                </>
              )
            ) : (
              "Sua jornada começa aqui. Escolha sua primeira trilha."
            )}
          </p>
          <p className="mt-2 hidden text-[11px] text-white/40 sm:block">
            {pluralize(summary.enrolledCourses, "curso", "cursos")}
            <span className="mx-1.5">·</span>
            {pluralize(summary.completedSessions, "sessão concluída", "sessões concluídas")}
            <span className="mx-1.5">·</span>
            {pluralize(summary.completedChapters, "capítulo", "capítulos")}
          </p>
        </div>

        <Link
          href={trail ? trail.continueHref : continueHref}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-cerrado-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-cerrado-500 hover:scale-[1.02] active:scale-[0.98]"
        >
          <Play size={14} />
          {trail || hasContinue ? "Continuar Trilha" : "Começar Trilha"}
        </Link>
      </div>
    </section>
  )
}

/* === ACTIVE COURSES ===
 * Fase 1B: com trilhas, o título vira "Cursos avulsos" e a lista recebe SÓ os
 * cursos fora de trilha; sem trilhas, "Seus Cursos" com tudo (como antes). */
function ActiveCourses({
  courses,
  title = "Seus Cursos",
}: {
  courses: StudentAnalytics["courses"]
  title?: string
}) {
  return (
    <div className="px-6 pt-8">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-text-muted">
        {title}
      </h2>
      <div className="space-y-2">
        {courses.slice(0, 4).map((course) => (
          <Link
            key={course.courseId}
            href={
              course.continueChapterId
                ? `/courses/${course.courseId}/chapters/${course.continueChapterId}`
                : `/courses/${course.courseId}`
            }
            className="group flex items-center gap-4 rounded-2xl bg-bg-card p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elevated"
          >
            {/* Progress ring */}
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center">
              <svg className="h-11 w-11 -rotate-90" viewBox="0 0 44 44">
                <circle
                  cx="22"
                  cy="22"
                  r="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="text-cerrado-100 dark:text-cerrado-900"
                />
                <circle
                  cx="22"
                  cy="22"
                  r="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeDasharray={`${(course.progress / 100) * 113.1} 113.1`}
                  strokeLinecap="round"
                  className="text-cerrado-600 transition-all duration-500"
                />
              </svg>
              <span className="absolute text-[10px] font-bold tabular-nums text-text-primary">
                {Math.round(course.progress)}%
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-semibold text-text-primary group-hover:text-cerrado-600 transition-colors">
                {course.title}
              </h3>
              <p className="mt-0.5 text-[10px] text-text-muted">
                {course.progress === 100
                  ? "Concluido"
                  : course.continueChapterId
                    ? "Continuar de onde parou"
                    : "Iniciar curso"}
              </p>
            </div>

            <ArrowRight
              size={14}
              className="shrink-0 text-text-muted/30 transition-all group-hover:text-cerrado-600 group-hover:translate-x-0.5"
            />
          </Link>
        ))}
      </div>
    </div>
  )
}

/* === CERTIFICATES === */
function CertificatesList({
  certificates,
}: {
  certificates: NonNullable<StudentAnalytics["certificates"]>
}) {
  return (
    <div className="px-6 pt-8">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-text-muted">
        Certificados
      </h2>
      <div className="space-y-2">
        {certificates.map((cert) => {
          const issuedDate = new Date(cert.issuedAt).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
          return (
            <Link
              key={cert.id}
              href={`/certificates/${cert.enrollmentId}`}
              className="group flex items-center gap-4 rounded-2xl bg-bg-card p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elevated"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-gold/10">
                <Award size={20} className="text-accent-gold" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold text-text-primary group-hover:text-accent-gold transition-colors">
                  {cert.courseTitle}
                </h3>
                <p className="mt-0.5 text-[10px] text-text-muted">Emitido em {issuedDate}</p>
              </div>
              <ArrowRight
                size={14}
                className="shrink-0 text-text-muted/30 transition-all group-hover:text-accent-gold group-hover:translate-x-0.5"
              />
            </Link>
          )
        })}
      </div>
    </div>
  )
}

/* === RECENT SESSIONS ===
 * Minha Jornada v6.1 (d): card padrão DS com dots por status e tempo relativo,
 * pareado com "Minha posição na jornada" no grid de 2 colunas. */
function RecentSessions({ sessions }: { sessions: StudentAnalytics["recentSessions"] }) {
  return (
    <section className="rounded-2xl border border-border-subtle bg-bg-card p-6 shadow-card">
      <h2 className="text-base font-semibold text-text-primary">Atividades recentes</h2>
      <div className="mt-2 divide-y divide-border-subtle">
        {sessions.map((session) => (
          <div key={session.sessionId} className="flex items-start gap-3 py-3">
            <div
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                session.status === "completed"
                  ? "bg-semantic-success"
                  : "bg-cerrado-600 shadow-[0_0_6px] shadow-cerrado-600/40"
              }`}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-text-primary">
                {session.status === "completed" ? "Concluiu" : "Em andamento em"} "
                {session.chapterTitle}"
              </p>
              {session.whenLabel && (
                <p className="text-[11px] text-text-muted">{session.whenLabel}</p>
              )}
            </div>
            <span
              className={`shrink-0 text-[10px] font-medium ${
                session.status === "completed" ? "text-semantic-success" : "text-cerrado-600"
              }`}
            >
              {session.status === "completed" ? "Concluída" : "Em andamento"}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
