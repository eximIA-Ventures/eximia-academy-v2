import { ArrowRight, Award, BookOpen, Compass, FileText, Play, Radio, Sparkles } from "lucide-react"
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
  }>
  certificates?: Array<{
    id: string
    enrollmentId: string
    courseTitle: string
    verificationCode: string
    issuedAt: string
  }>
  dudMessage?: string
}

interface StudentDashboardProps {
  fullName: string
  data: StudentAnalytics
}

export function StudentDashboard({ fullName, data }: StudentDashboardProps) {
  const dudMessage =
    data.dudMessage ?? "Sua proxima sessao esta pronta. Continuamos de onde paramos?"
  const firstName = fullName?.split(" ")[0] ?? ""

  return (
    <div className="space-y-6">
      <HeroSection firstName={firstName} summary={data.summary} />
      <DudBar message={dudMessage} />
      <ContentCardsGrid />
      {data.courses.length > 0 && <ActiveCourses courses={data.courses} />}
      {data.certificates && data.certificates.length > 0 && (
        <CertificatesList certificates={data.certificates} />
      )}
      {data.recentSessions.length > 0 && <RecentSessions sessions={data.recentSessions} />}
      <div className="h-6" />
    </div>
  )
}

/* === HERO === */
function HeroSection({
  firstName,
  summary,
}: {
  firstName: string
  summary: StudentAnalytics["summary"]
}) {
  return (
    <section
      className="relative flex min-h-[260px] items-end overflow-hidden rounded-2xl shadow-card"
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

      <div className="relative z-10 flex w-full items-end justify-between gap-8 px-8 pb-7">
        <div className="max-w-[500px]">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl md:text-5xl">
            {firstName ? `Ola, ${firstName}.` : "Bem-vindo."}
          </h1>
          <p className="mt-3 max-w-[400px] text-sm leading-relaxed text-white/50 md:text-base">
            Desenvolvimento executivo com IA atraves do metodo socratico. Reflexao estrategica
            aplicada.
          </p>
          <Link
            href="/courses"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cerrado-600 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-cerrado-500 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Play size={16} />
            Continuar Trilha
          </Link>
        </div>

        <div className="hidden gap-3 md:flex">
          <StatPill label="Cursos" value={summary.enrolledCourses} />
          <StatPill label="Sessoes" value={summary.completedSessions} />
          <StatPill label="Capitulos" value={summary.completedChapters} />
        </div>
      </div>
    </section>
  )
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl ring-1 ring-white/20 bg-black/30 px-5 py-3 backdrop-blur-md">
      <span className="text-2xl font-bold tabular-nums text-white">{value}</span>
      <span className="text-[10px] font-semibold tracking-wider uppercase text-white/50">
        {label}
      </span>
    </div>
  )
}

/* === D.U.D BAR === */
function DudBar({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 px-6 py-4">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cerrado-600/10">
        <Sparkles size={13} className="text-cerrado-600" />
      </div>
      <span className="text-sm text-text-secondary">{message}</span>
    </div>
  )
}

/* === CONTENT CARDS === */
function ContentCardsGrid() {
  const cards = [
    {
      href: "/courses",
      icon: Compass,
      title: "Trilhas",
      description: "Programas de desenvolvimento",
      gradient: "from-cerrado-100 to-cerrado-50 dark:from-cerrado-600/20 dark:to-cerrado-800/10",
      iconBg: "bg-cerrado-200 dark:bg-cerrado-600/15",
      iconColor: "text-cerrado-700 dark:text-cerrado-400",
    },
    {
      href: "/lives",
      icon: Radio,
      title: "Lives",
      description: "Sessoes ao vivo",
      gradient: "from-amber-50 to-amber-50/50 dark:from-accent-gold/15 dark:to-accent-gold/5",
      iconBg: "bg-amber-100 dark:bg-accent-gold/15",
      iconColor: "text-amber-700 dark:text-accent-gold",
    },
    {
      href: "/biblioteca",
      icon: BookOpen,
      title: "Biblioteca",
      description: "Curadoria de conteudo",
      gradient: "from-teal-50 to-teal-50/50 dark:from-teal-500/15 dark:to-teal-500/5",
      iconBg: "bg-teal-100 dark:bg-teal-500/15",
      iconColor: "text-teal-700 dark:text-teal-400",
      badge: "Novos",
    },
    {
      href: "/materiais",
      icon: FileText,
      title: "Materiais",
      description: "Templates e referencias",
      gradient: "from-purple-50 to-purple-50/50 dark:from-purple-500/15 dark:to-purple-500/5",
      iconBg: "bg-purple-100 dark:bg-purple-500/15",
      iconColor: "text-purple-700 dark:text-purple-400",
    },
  ]

  return (
    <div className="px-6 pt-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Link key={card.href} href={card.href} className="group">
              <div
                className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.gradient} p-5 shadow-card transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-elevated`}
              >
                {card.badge && (
                  <span className="absolute right-3 top-3 rounded-full bg-teal-100 dark:bg-teal-500/10 px-2 py-0.5 text-[9px] font-semibold text-teal-700 dark:text-teal-400">
                    {card.badge}
                  </span>
                )}
                <div
                  className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${card.iconBg}`}
                >
                  <Icon size={20} className={card.iconColor} />
                </div>
                <h3 className="text-base font-semibold text-text-primary">{card.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-text-muted">{card.description}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

/* === ACTIVE COURSES === */
function ActiveCourses({ courses }: { courses: StudentAnalytics["courses"] }) {
  return (
    <div className="px-6 pt-8">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-text-muted">
        Seus Cursos
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

/* === RECENT SESSIONS === */
function RecentSessions({ sessions }: { sessions: StudentAnalytics["recentSessions"] }) {
  return (
    <div className="px-6 pt-8">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-text-muted">
        Atividade Recente
      </h2>
      <div className="space-y-1">
        {sessions.map((session) => (
          <div
            key={session.sessionId}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-bg-hover"
          >
            <div
              className={`h-2 w-2 shrink-0 rounded-full ${
                session.status === "completed"
                  ? "bg-semantic-success"
                  : "bg-cerrado-600 shadow-[0_0_6px] shadow-cerrado-600/40"
              }`}
            />
            <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
              {session.chapterTitle}
            </span>
            <span
              className={`shrink-0 text-[10px] font-medium ${
                session.status === "completed" ? "text-semantic-success" : "text-cerrado-600"
              }`}
            >
              {session.status === "completed" ? "Concluida" : "Em andamento"}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
