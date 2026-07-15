import {
  ArrowRight,
  Award,
  BookOpen,
  Briefcase,
  Check,
  Clock,
  Lock,
  Play,
  Route,
  Sparkles,
} from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

// ---------------------------------------------------------------------------
// /dev/preview-trilha — PROTÓTIPO NAVEGÁVEL da experiência "Minha Trilha"
// (Fase 1, Hugo 2026-07-15). MOCK DATA — nada de banco, nada de componentes de
// produção: tudo local a esta rota, no padrão de /dev/preview-desempenho.
//
//   SEÇÃO A — Dashboard com trilha integrada: o hero compacto atual do aluno
//     ganha a linha dinâmica de TRILHA + o novo TrailProgressCard (nome, barra
//     geral, mini-sequência de cursos, "Ver trilha completa").
//   SEÇÃO B — Página "Minha Trilha": a timeline de trails/[trailId] revisada no
//     estilo atual da casa (bg-bg-card, shadow-card, cerrado-*,
//     semantic-success, chips tonais do "Meu ritmo").
//   SEÇÃO C — CENÁRIO MULTI (2026-07-15): várias trilhas + cursos avulsos
//     (hero de retomada, grid de cards compactos, /trails com Disponíveis).
//
// GUARD: 404 in production. Throwaway dev harness — never reachable in deploy.
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic"

// ---------------------------------------------------------------------------
// MOCK — trilha "Formação Lean": 3 cursos, 12h, cargo Analista de Processos.
// Progresso geral da trilha: 1 curso concluído + o atual a 50% → 50% de 3.
// ---------------------------------------------------------------------------

type CourseState = "completed" | "active" | "locked"

interface MockCourse {
  title: string
  description: string
  state: CourseState
  progressPct: number
  estimatedHours: number
}

const TRAIL = {
  title: "Formação Lean",
  description: "Do diagnóstico ao kaizen: a base de melhoria contínua da operação.",
  isSequential: true,
  targetRole: "Analista de Processos",
  estimatedHours: 12,
  progressPct: 50, // (1 concluído + 0.5 do atual) / 3
  courses: [
    {
      title: "Fundamentos da Melhoria Contínua",
      description: "Os princípios Lean e o olhar para desperdício.",
      state: "completed",
      progressPct: 100,
      estimatedHours: 4,
    },
    {
      title: "Análise e Solução de Problemas",
      description: "A3, 5 porquês e PDCA aplicados a casos reais.",
      state: "active",
      progressPct: 50,
      estimatedHours: 5,
    },
    {
      title: "Padronização e Kaizen",
      description: "Trabalho padrão e ciclos de kaizen no dia a dia.",
      state: "locked",
      progressPct: 0,
      estimatedHours: 3,
    },
  ] satisfies MockCourse[],
}

const STUDENT_FIRST_NAME = "Rinaldo"
const SUMMARY = { enrolledCourses: 2, completedSessions: 7, completedChapters: 5 }
const CURRENT = TRAIL.courses.find((c) => c.state === "active") ?? TRAIL.courses[0]
const CURRENT_INDEX = TRAIL.courses.indexOf(CURRENT)

// ---------------------------------------------------------------------------
// SEÇÃO A — hero compacto do dashboard (mesma foto/gradiente/altura do
// student-dashboard.tsx pós-redesign), com a linha dinâmica citando a TRILHA.
// ---------------------------------------------------------------------------

function DashboardHeroWithTrail() {
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
            Olá, {STUDENT_FIRST_NAME}.
          </h1>
          <p className="mt-1.5 truncate text-sm text-white/60">
            Você está na trilha <span className="font-medium text-white/90">{TRAIL.title}</span>
            <span className="text-white/40"> · </span>curso {CURRENT_INDEX + 1} de{" "}
            {TRAIL.courses.length}
            <span className="text-white/40"> · </span>
            <span className="font-medium text-white/90">{CURRENT.title}</span>{" "}
            <span className="font-semibold tabular-nums text-cerrado-400">
              {CURRENT.progressPct}%
            </span>
          </p>
          <p className="mt-2 hidden text-[11px] text-white/40 sm:block">
            {SUMMARY.enrolledCourses} cursos<span className="mx-1.5">·</span>
            {SUMMARY.completedSessions} sessões concluídas<span className="mx-1.5">·</span>
            {SUMMARY.completedChapters} capítulos
          </p>
        </div>

        <Link
          href="#secao-b"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-cerrado-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-cerrado-500 hover:scale-[1.02] active:scale-[0.98]"
        >
          <Play size={14} />
          Continuar Trilha
        </Link>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// SEÇÃO A — TrailProgressCard: o card NOVO de trilha do dashboard. Nome, barra
// de progresso geral, mini-sequência horizontal dos cursos (check verde /
// anel cerrado com % / cadeado) e o link "Ver trilha completa".
// ---------------------------------------------------------------------------

function StepDot({ course }: { course: MockCourse }) {
  if (course.state === "completed") {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-semantic-success text-white shadow-sm">
        <Check size={16} strokeWidth={3} />
      </div>
    )
  }
  if (course.state === "active") {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-card ring-2 ring-cerrado-600 shadow-[0_0_10px_rgba(253,121,51,0.25)]">
        <span className="text-[10px] font-bold tabular-nums text-cerrado-600">
          {course.progressPct}%
        </span>
      </div>
    )
  }
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-hover text-text-muted/50">
      <Lock size={13} />
    </div>
  )
}

function TrailProgressCard() {
  return (
    <div className="rounded-2xl bg-bg-card p-5 shadow-card">
      <div className="flex flex-col gap-4">
        {/* Header: nome + progresso geral */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cerrado-600/10">
              <Route size={18} className="text-cerrado-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                Minha Trilha
              </p>
              <h3 className="truncate text-base font-bold text-text-primary">{TRAIL.title}</h3>
            </div>
          </div>
          <Link
            href="#secao-b"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-cerrado-600 transition-colors hover:text-cerrado-500"
          >
            Ver trilha completa
            <ArrowRight size={12} />
          </Link>
        </div>

        {/* Barra geral da trilha */}
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-hover">
            <div
              className="h-full rounded-full bg-cerrado-600 transition-all duration-700"
              style={{ width: `${TRAIL.progressPct}%` }}
            />
          </div>
          <span className="text-xs font-semibold tabular-nums text-text-primary">
            {TRAIL.progressPct}%
          </span>
        </div>

        {/* Mini-sequência horizontal dos cursos */}
        <div className="flex items-start">
          {TRAIL.courses.map((course, i) => (
            <div key={course.title} className="flex flex-1 items-start last:flex-none">
              <div className="flex w-24 flex-col items-center gap-1.5 sm:w-32">
                <StepDot course={course} />
                <span
                  className={`w-full truncate text-center text-[10px] leading-tight ${
                    course.state === "locked"
                      ? "text-text-muted/50"
                      : course.state === "active"
                        ? "font-semibold text-text-primary"
                        : "text-text-muted"
                  }`}
                >
                  {course.title}
                </span>
              </div>
              {i < TRAIL.courses.length - 1 && (
                <div
                  className={`mt-[17px] h-0.5 flex-1 rounded-full ${
                    course.state === "completed" ? "bg-semantic-success/50" : "bg-bg-hover"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SEÇÃO B — a página "Minha Trilha" do aluno, no estilo atual da casa.
// ---------------------------------------------------------------------------

function TrailHero() {
  return (
    <div className="rounded-2xl bg-bg-card p-6 shadow-card sm:p-7">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cerrado-600/10">
            <Route size={18} className="text-cerrado-600" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-cerrado-600">
            Minha Trilha
          </span>
        </div>

        <div>
          <h2 className="text-2xl font-bold tracking-tight text-text-primary">{TRAIL.title}</h2>
          <p className="mt-1 text-sm text-text-secondary">{TRAIL.description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-cerrado-600/10 px-2.5 py-1 text-[11px] font-semibold text-cerrado-600">
            <Lock size={12} className="shrink-0" />
            Sequencial
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-semibold text-text-secondary dark:bg-white/10">
            <Briefcase size={12} className="shrink-0" />
            {TRAIL.targetRole}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-semibold text-text-secondary dark:bg-white/10">
            <BookOpen size={12} className="shrink-0" />
            {TRAIL.courses.length} cursos
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-semibold text-text-secondary dark:bg-white/10">
            <Clock size={12} className="shrink-0" />
            {TRAIL.estimatedHours}h estimadas
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-hover">
            <div
              className="h-full rounded-full bg-cerrado-600 transition-all duration-700"
              style={{ width: `${TRAIL.progressPct}%` }}
            />
          </div>
          <span className="text-xs font-semibold tabular-nums text-text-primary">
            {TRAIL.progressPct}%
          </span>
        </div>
      </div>
    </div>
  )
}

function StateChip({ state }: { state: CourseState }) {
  if (state === "completed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-semantic-success/10 px-2.5 py-1 text-[11px] font-semibold text-semantic-success">
        <Check size={12} className="shrink-0" />
        Concluído
      </span>
    )
  }
  if (state === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-cerrado-600/10 px-2.5 py-1 text-[11px] font-semibold text-cerrado-600">
        <Sparkles size={12} className="shrink-0" />
        Em andamento
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-semibold text-text-muted dark:bg-white/10">
      <Lock size={12} className="shrink-0" />
      Bloqueado
    </span>
  )
}

function TimelineDot({ course, index }: { course: MockCourse; index: number }) {
  if (course.state === "completed") {
    return (
      <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-semantic-success text-white ring-4 ring-bg-app">
        <Check size={14} strokeWidth={3} />
      </div>
    )
  }
  if (course.state === "active") {
    return (
      <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-cerrado-600 text-white ring-4 ring-bg-app shadow-[0_0_12px_rgba(253,121,51,0.35)]">
        <span className="text-xs font-bold">{index + 1}</span>
      </div>
    )
  }
  return (
    <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-bg-card text-text-muted/40 ring-4 ring-bg-app shadow-card">
      <Lock size={12} />
    </div>
  )
}

function TrailTimeline() {
  const allCompleted = TRAIL.courses.every((c) => c.state === "completed")
  return (
    <div className="relative pl-10">
      {/* Linha vertical */}
      <div className="absolute bottom-24 left-[19px] top-1 w-0.5 bg-gradient-to-b from-semantic-success via-cerrado-600/40 to-transparent" />

      <div className="space-y-4">
        {TRAIL.courses.map((course, index) => {
          const isLocked = course.state === "locked"
          const isActive = course.state === "active"
          return (
            <div key={course.title} className="relative">
              <div className="absolute -left-10 top-5">
                <TimelineDot course={course} index={index} />
              </div>

              <div
                className={`rounded-2xl bg-bg-card p-5 shadow-card transition-all ${
                  isLocked ? "opacity-55" : "hover:-translate-y-0.5 hover:shadow-elevated"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StateChip state={course.state} />
                  <span className="inline-flex items-center gap-1 text-[11px] text-text-muted">
                    <Clock size={11} className="shrink-0" />
                    {course.estimatedHours}h
                  </span>
                </div>

                <h3
                  className={`mt-2 text-base font-semibold ${
                    isLocked ? "text-text-muted/60" : "text-text-primary"
                  }`}
                >
                  {course.title}
                </h3>
                <p
                  className={`mt-0.5 text-sm ${isLocked ? "text-text-muted/40" : "text-text-muted"}`}
                >
                  {isLocked ? "Complete o curso anterior para desbloquear" : course.description}
                </p>

                {isActive && (
                  <div className="mt-4 flex items-center justify-between gap-4">
                    <div className="flex flex-1 items-center gap-3">
                      <div className="h-1.5 max-w-56 flex-1 overflow-hidden rounded-full bg-bg-hover">
                        <div
                          className="h-full rounded-full bg-cerrado-600"
                          style={{ width: `${course.progressPct}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold tabular-nums text-cerrado-600">
                        {course.progressPct}%
                      </span>
                    </div>
                    <Link
                      href="#secao-b"
                      className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-cerrado-600 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-cerrado-500 hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Play size={12} />
                      Continuar
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* Linha de chegada */}
        <div className="relative">
          <div
            className={`absolute -left-10 top-5 flex h-[30px] w-[30px] items-center justify-center rounded-full ring-4 ring-bg-app ${
              allCompleted
                ? "bg-accent-gold text-white shadow-[0_0_14px_rgba(196,168,130,0.5)]"
                : "bg-bg-card text-text-muted/30 shadow-card"
            }`}
          >
            <Award size={14} />
          </div>

          <div
            className={`rounded-2xl p-6 text-center ${
              allCompleted
                ? "bg-accent-gold/10 ring-1 ring-accent-gold/25"
                : "bg-bg-card/40 shadow-card"
            }`}
          >
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-accent-gold/10">
              <Award
                size={22}
                className={allCompleted ? "text-accent-gold" : "text-accent-gold/40"}
              />
            </div>
            <h3 className="mt-2 text-sm font-semibold text-text-secondary">
              Certificado da trilha
            </h3>
            <p className="mt-0.5 text-xs text-text-muted">
              Complete os {TRAIL.courses.length} cursos para emitir o certificado de{" "}
              <span className="font-medium">{TRAIL.title}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SEÇÃO C — CENÁRIO MULTI (Hugo 2026-07-15): como o desenho escala com VÁRIAS
// trilhas e VÁRIOS cursos. Princípios aprovados:
//   (1) HERO de RETOMADA: cita sempre a ÚLTIMA coisa tocada, nunca uma lista;
//   (2) MINHAS TRILHAS: 2+ trilhas → grid de cards COMPACTOS (nome, barra,
//       mini-steps reduzidos, badge Obrigatória, CTA Continuar), ordenados por
//       atividade recente, o mais recente com leve destaque; "Ver todas" em 3+;
//   (3) CURSOS AVULSOS: só cursos FORA de trilha (cursos de trilha vivem no
//       card da trilha); some se vazia;
//   (4) /trails do aluno: "Minhas trilhas" (progresso) + "Disponíveis"
//       (Inscrever-se).
// ---------------------------------------------------------------------------

type MiniStep = { state: CourseState | "available"; pct?: number }

interface MockTrailSummary {
  id: string
  title: string
  description: string
  isMandatory: boolean
  completedCourses: number
  totalCourses: number
  progressPct: number
  /** Mini-steps reduzidos (sem rótulos) do card compacto. */
  steps: MiniStep[]
  /** Trilha com atividade mais recente → leve destaque visual. */
  recent?: boolean
}

const MULTI_TRAILS: MockTrailSummary[] = [
  {
    id: "lean",
    title: "Formação Lean",
    description: "Melhoria contínua da operação",
    isMandatory: false,
    completedCourses: 1,
    totalCourses: 3,
    progressPct: 33,
    steps: [{ state: "completed" }, { state: "active", pct: 50 }, { state: "locked" }],
    recent: true,
  },
  {
    id: "lideranca",
    title: "Liderança na Prática",
    description: "Gestão de pessoas no dia a dia",
    isMandatory: false,
    completedCourses: 4,
    totalCourses: 5,
    progressPct: 80,
    steps: [
      { state: "completed" },
      { state: "completed" },
      { state: "completed" },
      { state: "completed" },
      { state: "active", pct: 10 },
    ],
  },
  {
    id: "seguranca",
    title: "Segurança do Trabalho",
    description: "NRs essenciais da planta",
    isMandatory: true,
    completedCourses: 0,
    totalCourses: 4,
    progressPct: 0,
    steps: [
      { state: "active", pct: 0 },
      { state: "locked" },
      { state: "locked" },
      { state: "locked" },
    ],
  },
]

const STANDALONE_COURSES = [
  { id: "excel", title: "Excel para Gestão", progressPct: 70, hint: "Continuar de onde parou" },
  { id: "comunicacao", title: "Comunicação Assertiva", progressPct: 0, hint: "Iniciar curso" },
]

const AVAILABLE_TRAILS = [
  {
    id: "instrutores",
    title: "Formação de Instrutores Internos",
    description: "Prepare multiplicadores de conhecimento na sua área.",
    courses: 4,
    hours: 10,
  },
  {
    id: "indicadores",
    title: "Gestão de Indicadores",
    description: "Do dado ao painel: KPIs que sustentam decisão.",
    courses: 3,
    hours: 8,
  },
]

/** Mini-step REDUZIDO do card compacto (24px, sem rótulo). */
function MiniStepDot({ step }: { step: MiniStep }) {
  if (step.state === "completed") {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-semantic-success text-white">
        <Check size={11} strokeWidth={3} />
      </div>
    )
  }
  if (step.state === "active") {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-bg-card ring-2 ring-cerrado-600">
        <span className="text-[8px] font-bold tabular-nums text-cerrado-600">{step.pct ?? 0}%</span>
      </div>
    )
  }
  return (
    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-bg-hover text-text-muted/50">
      <Lock size={10} />
    </div>
  )
}

/** Card COMPACTO de trilha para o grid "Minhas Trilhas" (2+ trilhas). */
function CompactTrailCard({ trail }: { trail: MockTrailSummary }) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl bg-bg-card p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elevated ${
        trail.recent ? "ring-1 ring-cerrado-600/30" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h4 className="truncate text-sm font-bold text-text-primary">{trail.title}</h4>
            {trail.isMandatory && (
              <span className="inline-flex shrink-0 items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-500">
                Obrigatória
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[11px] text-text-muted">{trail.description}</p>
        </div>
        {trail.recent && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-cerrado-600/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-cerrado-600">
            <Sparkles size={9} className="shrink-0" />
            Recente
          </span>
        )}
      </div>

      {/* Barra geral + fração de cursos */}
      <div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-hover">
            <div
              className="h-full rounded-full bg-cerrado-600"
              style={{ width: `${trail.progressPct}%` }}
            />
          </div>
          <span className="text-[11px] font-semibold tabular-nums text-text-primary">
            {trail.progressPct}%
          </span>
        </div>
        <p className="mt-1 text-[10px] text-text-muted">
          {trail.completedCourses} de {trail.totalCourses} cursos concluídos
        </p>
      </div>

      {/* Mini-steps reduzidos + CTA */}
      <div className="mt-auto flex items-center justify-between gap-3">
        <div className="flex items-center">
          {trail.steps.map((step, i) => (
            <div key={`${trail.id}-step-${i + 1}`} className="flex items-center">
              <MiniStepDot step={step} />
              {i < trail.steps.length - 1 && (
                <div
                  className={`h-0.5 w-3 rounded-full ${
                    step.state === "completed" ? "bg-semantic-success/50" : "bg-bg-hover"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <Link
          href="#secao-b"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-cerrado-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-all hover:bg-cerrado-500"
        >
          <Play size={10} />
          Continuar
        </Link>
      </div>
    </div>
  )
}

/** Linha de curso avulso — o estilo dos cards de "Seus Cursos" atuais. */
function StandaloneCourseRow({
  course,
}: {
  course: (typeof STANDALONE_COURSES)[number]
}) {
  return (
    <Link
      href="#secao-c"
      className="group flex items-center gap-4 rounded-2xl bg-bg-card p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elevated"
    >
      {/* Progress ring (mesma gramática de ActiveCourses) */}
      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center">
        <svg className="h-11 w-11 -rotate-90" viewBox="0 0 44 44" aria-hidden="true">
          <title>Progresso do curso</title>
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
            strokeDasharray={`${(course.progressPct / 100) * 113.1} 113.1`}
            strokeLinecap="round"
            className="text-cerrado-600 transition-all duration-500"
          />
        </svg>
        <span className="absolute text-[10px] font-bold tabular-nums text-text-primary">
          {course.progressPct}%
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <h4 className="truncate text-sm font-semibold text-text-primary transition-colors group-hover:text-cerrado-600">
          {course.title}
        </h4>
        <p className="mt-0.5 text-[10px] text-text-muted">{course.hint}</p>
      </div>

      <ArrowRight
        size={14}
        className="shrink-0 text-text-muted/30 transition-all group-hover:translate-x-0.5 group-hover:text-cerrado-600"
      />
    </Link>
  )
}

function SubHeading({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-text-muted">{title}</h3>
      {action}
    </div>
  )
}

/** C.1 — Dashboard no cenário multi: hero de retomada + grid de trilhas + avulsos. */
function MultiDashboard() {
  return (
    <div className="flex flex-col gap-6">
      {/* Hero de RETOMADA: a última coisa tocada (a trilha Formação Lean),
          nunca uma lista — idêntico ao hero da Seção A por princípio. */}
      <DashboardHeroWithTrail />

      {/* Minhas Trilhas — 3 trilhas → grid compacto + "Ver todas" (3+). */}
      <div className="space-y-3">
        <SubHeading
          title="Minhas Trilhas"
          action={
            <Link
              href="#secao-c2"
              className="inline-flex items-center gap-1 text-xs font-semibold text-cerrado-600 transition-colors hover:text-cerrado-500"
            >
              Ver todas
              <ArrowRight size={12} />
            </Link>
          }
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MULTI_TRAILS.map((trail) => (
            <CompactTrailCard key={trail.id} trail={trail} />
          ))}
        </div>
      </div>

      {/* Cursos avulsos — SÓ cursos fora de trilha (some se vazia). */}
      <div className="space-y-3">
        <SubHeading title="Cursos avulsos" />
        <div className="space-y-2">
          {STANDALONE_COURSES.map((course) => (
            <StandaloneCourseRow key={course.id} course={course} />
          ))}
        </div>
      </div>
    </div>
  )
}

/** C.2 — a página /trails do aluno: Minhas trilhas + Disponíveis. */
function TrailsListPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-3">
        <SubHeading title="Minhas trilhas" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MULTI_TRAILS.map((trail) => (
            <CompactTrailCard key={`list-${trail.id}`} trail={trail} />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <SubHeading title="Disponíveis" />
        <div className="grid gap-3 sm:grid-cols-2">
          {AVAILABLE_TRAILS.map((trail) => (
            <div
              key={trail.id}
              className="flex flex-col gap-3 rounded-2xl bg-bg-card p-5 shadow-card"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cerrado-600/10">
                  <Route size={15} className="text-cerrado-600" />
                </div>
                <h4 className="min-w-0 truncate text-sm font-bold text-text-primary">
                  {trail.title}
                </h4>
              </div>
              <p className="text-xs leading-relaxed text-text-muted">{trail.description}</p>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-semibold text-text-secondary dark:bg-white/10">
                  <BookOpen size={12} className="shrink-0" />
                  {trail.courses} cursos
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-semibold text-text-secondary dark:bg-white/10">
                  <Clock size={12} className="shrink-0" />
                  {trail.hours}h
                </span>
              </div>
              <div className="mt-auto pt-1">
                <Link
                  href="#secao-c2"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-cerrado-600/30 px-4 py-2 text-xs font-semibold text-cerrado-600 transition-all hover:bg-cerrado-600/10"
                >
                  Inscrever-se
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page — nota de protótipo + SEÇÃO A + SEÇÃO B + SEÇÃO C (cenário multi).
// ---------------------------------------------------------------------------

function SectionDivider({ id, label, title }: { id: string; label: string; title: string }) {
  return (
    <div id={id} className="flex items-center gap-4 pt-4">
      <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
      <div className="text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cerrado-600">
          {label}
        </p>
        <p className="text-sm font-semibold text-text-primary">{title}</p>
      </div>
      <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
    </div>
  )
}

export default function PreviewTrilhaPage() {
  if (process.env.NODE_ENV === "production") notFound()

  return (
    <div className="min-h-screen bg-bg-app px-6 py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        {/* Nota de protótipo + navegação por cenário */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-bg-card px-5 py-4 shadow-card">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-text-primary">
              Experiência Minha Trilha
            </h1>
            <p className="mt-0.5 text-xs text-text-muted">
              Protótipo Fase 1 · mock data · nenhum dado real
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="#secao-a"
              className="inline-flex items-center rounded-lg bg-black/5 px-3 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10"
            >
              Cenário 1 trilha
            </Link>
            <Link
              href="#secao-c"
              className="inline-flex items-center rounded-lg bg-black/5 px-3 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10"
            >
              Cenário multi
            </Link>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-cerrado-600/10 px-2.5 py-1 text-[11px] font-semibold text-cerrado-600">
              <Sparkles size={12} className="shrink-0" />
              Preview
            </span>
          </div>
        </div>

        {/* SEÇÃO A */}
        <SectionDivider
          id="secao-a"
          label="Seção A"
          title="Dashboard do aluno com trilha integrada"
        />
        <DashboardHeroWithTrail />
        <TrailProgressCard />

        {/* SEÇÃO B */}
        <SectionDivider id="secao-b" label="Seção B" title="Página Minha Trilha do aluno" />
        <TrailHero />
        <TrailTimeline />

        {/* SEÇÃO C — cenário multi-trilha e multi-curso */}
        <SectionDivider
          id="secao-c"
          label="Seção C · Cenário multi"
          title="Dashboard com várias trilhas e cursos avulsos"
        />
        <MultiDashboard />

        <SectionDivider
          id="secao-c2"
          label="Seção C.2"
          title="Página /trails do aluno: Minhas trilhas + Disponíveis"
        />
        <TrailsListPage />

        <div className="h-8" />
      </div>
    </div>
  )
}
