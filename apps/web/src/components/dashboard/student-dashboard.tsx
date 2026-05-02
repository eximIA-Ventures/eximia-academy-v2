import { ArrowRight, BookOpen, Compass, FileText, Play, Radio, Sparkles } from "lucide-react"
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
  dudMessage?: string
}

interface StudentDashboardProps {
  fullName: string
  data: StudentAnalytics
}

export function StudentDashboard({ fullName, data }: StudentDashboardProps) {
  const dudMessage =
    data.dudMessage ?? "Sua próxima sessão está pronta. Continuamos de onde paramos?"
  const firstName = fullName?.split(" ")[0] ?? ""

  return (
    <div className="-m-6">
      <HeroSection firstName={firstName} summary={data.summary} />
      <DudBar message={dudMessage} />
      <ContentCardsGrid />
      {data.courses.length > 0 && <ActiveCourses courses={data.courses} />}
      {data.recentSessions.length > 0 && <RecentSessions sessions={data.recentSessions} />}
      <div className="h-6" />
    </div>
  )
}

/* ═══ HERO ═══ */
function HeroSection({
  firstName,
  summary,
}: {
  firstName: string
  summary: StudentAnalytics["summary"]
}) {
  return (
    <section className="relative flex min-h-[340px] items-end overflow-hidden bg-bg-app px-6 pb-8 pt-16 sm:px-8 md:px-10">
      <div
        className="absolute inset-y-0 right-0 w-[70%] bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&q=80')",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(15,15,15,0.97) 0%, rgba(15,15,15,0.85) 35%, rgba(15,15,15,0.3) 70%, transparent 100%)",
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-bg-app to-transparent" />

      <div className="relative z-10 flex w-full items-end justify-between gap-8">
        <div className="max-w-[500px]">
          <p className="text-sm font-medium tracking-wide text-accent-teal">
            {firstName ? `Olá, ${firstName}` : "Bem-vindo"}
          </p>
          <h1 className="mt-2 text-4xl font-bold leading-tight tracking-tight text-text-primary sm:text-5xl md:text-6xl">
            Domine a era
            <br />
            da inteligência
          </h1>
          <p className="mt-4 max-w-[400px] text-sm leading-relaxed text-text-secondary md:text-base">
            Desenvolvimento executivo com IA através do
            método socrático. Reflexão estratégica aplicada.
          </p>
          <Link
            href="/courses"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent-blue-mid px-6 py-3 text-sm font-semibold text-white transition-all hover:brightness-110 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Play size={16} />
            Continuar Trilha
          </Link>
        </div>

        <div className="hidden gap-3 md:flex">
          <StatPill label="Cursos" value={summary.enrolledCourses} />
          <StatPill label="Sessões" value={summary.completedSessions} />
          <StatPill label="Capítulos" value={summary.completedChapters} />
        </div>
      </div>
    </section>
  )
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl ring-1 ring-white/[0.08] bg-bg-app/60 px-5 py-3 backdrop-blur-md">
      <span className="text-2xl font-bold tabular-nums text-text-primary">{value}</span>
      <span className="text-[10px] font-semibold tracking-wider uppercase text-text-muted">{label}</span>
    </div>
  )
}

/* ═══ D.U.D BAR ═══ */
function DudBar({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-white/[0.04] bg-bg-card/40 px-6 py-3.5 backdrop-blur-sm">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-teal/10">
        <Sparkles size={13} className="text-accent-teal" />
      </div>
      <span className="text-sm text-text-secondary">{message}</span>
    </div>
  )
}

/* ═══ CONTENT CARDS ═══ */
function ContentCardsGrid() {
  const cards = [
    {
      href: "/courses",
      icon: Compass,
      title: "Trilhas",
      description: "Programas de desenvolvimento",
      gradient: "from-accent-blue-mid/20 to-accent-blue-deep/10",
      iconBg: "bg-accent-blue-mid/15",
      iconColor: "text-accent-blue-mid",
      ring: "ring-accent-blue-mid/10 hover:ring-accent-blue-mid/25",
    },
    {
      href: "/lives",
      icon: Radio,
      title: "Lives",
      description: "Sessões ao vivo",
      gradient: "from-accent-gold/15 to-accent-gold/5",
      iconBg: "bg-accent-gold/15",
      iconColor: "text-accent-gold",
      ring: "ring-accent-gold/10 hover:ring-accent-gold/25",
    },
    {
      href: "/biblioteca",
      icon: BookOpen,
      title: "Biblioteca",
      description: "Curadoria de conteúdo",
      gradient: "from-accent-teal/15 to-accent-teal/5",
      iconBg: "bg-accent-teal/15",
      iconColor: "text-accent-teal",
      ring: "ring-accent-teal/10 hover:ring-accent-teal/25",
      badge: "Novos",
    },
    {
      href: "/materiais",
      icon: FileText,
      title: "Materiais",
      description: "Templates e referências",
      gradient: "from-purple-500/15 to-purple-500/5",
      iconBg: "bg-purple-500/15",
      iconColor: "text-purple-400",
      ring: "ring-purple-500/10 hover:ring-purple-500/25",
    },
  ]

  return (
    <div className="px-6 pt-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Link key={card.href} href={card.href} className="group">
              <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${card.gradient} ring-1 ${card.ring} p-5 transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-[0_8px_30px_rgba(0,0,0,0.2)]`}>
                {card.badge && (
                  <span className="absolute right-3 top-3 rounded-full bg-accent-teal/10 px-2 py-0.5 text-[9px] font-semibold text-accent-teal ring-1 ring-accent-teal/20">
                    {card.badge}
                  </span>
                )}
                <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${card.iconBg}`}>
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

/* ═══ ACTIVE COURSES ═══ */
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
            className="group flex items-center gap-4 rounded-xl ring-1 ring-border-subtle bg-bg-card p-4 transition-all hover:ring-accent-blue-mid/20 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.15)]"
          >
            {/* Progress ring */}
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center">
              <svg className="h-11 w-11 -rotate-90" viewBox="0 0 44 44">
                <circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white/[0.06]" />
                <circle
                  cx="22" cy="22" r="18" fill="none" stroke="currentColor" strokeWidth="2.5"
                  strokeDasharray={`${(course.progress / 100) * 113.1} 113.1`}
                  strokeLinecap="round"
                  className="text-accent-blue-mid transition-all duration-500"
                />
              </svg>
              <span className="absolute text-[10px] font-bold tabular-nums text-text-primary">
                {Math.round(course.progress)}%
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-semibold text-text-primary group-hover:text-accent-blue-light transition-colors">
                {course.title}
              </h3>
              <p className="mt-0.5 text-[10px] text-text-muted">
                {course.progress === 100
                  ? "Concluído"
                  : course.continueChapterId
                    ? "Continuar de onde parou"
                    : "Iniciar curso"}
              </p>
            </div>

            <ArrowRight size={14} className="shrink-0 text-text-muted/30 transition-all group-hover:text-accent-blue-light group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </div>
  )
}

/* ═══ RECENT SESSIONS ═══ */
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
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-white/[0.02]"
          >
            <div className={`h-2 w-2 shrink-0 rounded-full ${
              session.status === "completed" ? "bg-accent-teal" : "bg-accent-blue-mid shadow-[0_0_6px_rgba(42,106,176,0.4)]"
            }`} />
            <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
              {session.chapterTitle}
            </span>
            <span className={`shrink-0 text-[10px] font-medium ${
              session.status === "completed" ? "text-accent-teal" : "text-accent-blue-mid"
            }`}>
              {session.status === "completed" ? "Concluída" : "Em andamento"}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
