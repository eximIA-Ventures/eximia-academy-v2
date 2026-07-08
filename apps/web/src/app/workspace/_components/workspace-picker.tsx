"use client"

import { switchWorkspace } from "@/app/(platform)/workspace/actions"
import { signOut } from "@/lib/actions/auth"
import { buttonVariants, cn } from "@eximia/ui"
import { ArrowRight, GraduationCap, Loader2, LogOut, PencilRuler } from "lucide-react"
import { useState, useTransition } from "react"

interface Props {
  firstName: string
  canStudio: boolean
  canStandard: boolean
}

export function WorkspacePicker({ firstName, canStudio, canStandard }: Props) {
  const [isPending, startTransition] = useTransition()
  const [target, setTarget] = useState<"studio" | "standard" | null>(null)

  function enter(ws: "studio" | "standard") {
    setTarget(ws)
    startTransition(async () => {
      // Server action redirects on success; the transition keeps the clicked
      // card in loading state until the navigation replaces the tree.
      await switchWorkspace(ws)
    })
  }

  return (
    <main className="relative flex min-h-screen flex-col bg-bg-app">
      {/* Wash de marca no topo — pincelada creme->transparente que dá profundidade
          à página sem competir com os cartões. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-cerrado-500/[0.06] via-studio-600/[0.03] to-transparent"
      />

      {/* ── Barra superior: lockup ARGOS Academy à esquerda, Sair à direita ── */}
      <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-8 sm:py-6">
        <div className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logos/argos-academy-color.png"
            alt="ARGOS Academy"
            className="h-8 w-auto shrink-0 select-none sm:h-9 dark:hidden"
            draggable={false}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logos/argos-academy-dark.png"
            alt="ARGOS Academy"
            className="hidden h-8 w-auto shrink-0 select-none sm:h-9 dark:block"
            draggable={false}
          />
        </div>

        <form action={signOut}>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cerrado-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app"
          >
            <LogOut size={16} />
            Sair
          </button>
        </form>
      </header>

      {/* ── Corpo centralizado ── */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-20">
        <div className="w-full max-w-3xl">
          <header className="mb-9 text-center sm:mb-11">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-text-muted">
              {firstName ? `Olá, ${firstName}` : "Bem-vindo"}
            </p>
            <h1 className="mt-2.5 font-display text-3xl font-bold leading-tight tracking-tight text-text-primary sm:text-4xl">
              Onde você quer trabalhar hoje?
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm text-text-secondary sm:text-base">
              Escolha o espaço para esta sessão. Você troca de workspace a qualquer momento.
            </p>
          </header>

          <div className="grid gap-5 sm:grid-cols-2">
            {canStandard && (
              <WorkspaceCard
                icon={<GraduationCap size={26} strokeWidth={2} />}
                accent="cerrado"
                eyebrow="Aprender"
                title="Plataforma de Aprendizagem"
                subtitle="Sua trilha de aprendizagem e a gestão do seu time."
                tags={["Aluno", "Gestor"]}
                loading={isPending && target === "standard"}
                disabled={isPending && target !== "standard"}
                onEnter={() => enter("standard")}
              />
            )}
            {canStudio && (
              <WorkspaceCard
                icon={<PencilRuler size={26} strokeWidth={2} />}
                accent="studio"
                eyebrow="Criar"
                title="Estúdio do Instrutor"
                subtitle="Crie cursos e acompanhe a aprendizagem dos seus alunos."
                tags={["Instrutor"]}
                loading={isPending && target === "studio"}
                disabled={isPending && target !== "studio"}
                onEnter={() => enter("studio")}
              />
            )}
          </div>

          <p className="mt-9 text-center text-xs text-text-muted">
            Você pode trocar de workspace a qualquer momento pelo botão ao lado da logo.
          </p>
        </div>
      </div>
    </main>
  )
}

interface CardProps {
  icon: React.ReactNode
  accent: "cerrado" | "studio"
  eyebrow: string
  title: string
  subtitle: string
  tags: string[]
  loading: boolean
  disabled: boolean
  onEnter: () => void
}

/** Per-world token set. Each world owns its identity (accent wash on top, icon
 *  container, chips, CTA surface) while sharing one card skeleton so the two
 *  read as a pair. Cerrado = laranja do produto; Studio = azul-marinho ARGOS. */
const WORLDS = {
  cerrado: {
    topWash: "from-cerrado-500/[0.14] to-cerrado-500/0",
    hairline: "bg-cerrado-500/40",
    hoverRing: "group-hover:ring-cerrado-500/40",
    iconContainer: "bg-cerrado-600/12 text-cerrado-600 dark:text-cerrado-400",
    eyebrow: "text-cerrado-700 dark:text-cerrado-400",
    chip: "text-cerrado-700 ring-cerrado-600/20 dark:text-cerrado-300 dark:ring-cerrado-400/20",
    button: "", // canonical default variant already renders the cerrado world
  },
  studio: {
    topWash: "from-studio-600/[0.16] to-studio-600/0",
    hairline: "bg-studio-600/45",
    hoverRing: "group-hover:ring-studio-600/40",
    iconContainer: "bg-studio-600/12 text-studio-600 dark:text-studio-400",
    eyebrow: "text-studio-700 dark:text-studio-400",
    chip: "text-studio-700 ring-studio-600/20 dark:text-studio-300 dark:ring-studio-400/25",
    button: "bg-studio-600 hover:bg-studio-700 focus-visible:ring-studio-500/50 hover:scale-[1.02]",
  },
} as const

function WorkspaceCard({
  icon,
  accent,
  eyebrow,
  title,
  subtitle,
  tags,
  loading,
  disabled,
  onEnter,
}: CardProps) {
  const w = WORLDS[accent]

  return (
    <button
      type="button"
      onClick={onEnter}
      disabled={loading || disabled}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl bg-bg-card text-left shadow-card ring-1 ring-border-subtle transition-all duration-200",
        "hover:-translate-y-1 hover:shadow-elevated",
        w.hoverRing,
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app",
        accent === "studio"
          ? "focus-visible:ring-studio-500/60"
          : "focus-visible:ring-cerrado-500/60",
        "disabled:pointer-events-none disabled:opacity-60",
      )}
    >
      {/* Wash da cor do mundo no topo + fio de cor na borda superior */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b",
          w.topWash,
        )}
      />
      <div aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-[3px]", w.hairline)} />

      <div className="relative flex flex-1 flex-col gap-5 p-6 sm:p-7">
        <div className="flex items-center justify-between">
          <div
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105",
              w.iconContainer,
            )}
          >
            {icon}
          </div>
          <span className={cn("text-[11px] font-bold uppercase tracking-[0.16em]", w.eyebrow)}>
            {eyebrow}
          </span>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-xl font-bold leading-snug text-text-primary">{title}</h2>
          <p className="text-sm leading-relaxed text-text-secondary">{subtitle}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className={cn(
                "inline-flex items-center rounded-lg bg-bg-elevated px-2.5 py-0.5 text-2xs font-semibold ring-1",
                w.chip,
              )}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Empurra o CTA para a base, alinhando os dois cartões mesmo com
            subtítulos de alturas diferentes. */}
        <div className="mt-auto pt-2">
          {/* The whole card is the <button>; the "Entrar" affordance is a <span>
              styled with the canonical buttonVariants (no nested <button>).
              Cerrado uses the default variant; studio overrides only the
              navy surface/hover/ring tokens. */}
          <span
            className={cn(buttonVariants(), "w-full", accent === "studio" && WORLDS.studio.button)}
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                Entrar
                <ArrowRight
                  size={16}
                  className="transition-transform duration-200 group-hover:translate-x-0.5"
                />
              </>
            )}
          </span>
        </div>
      </div>
    </button>
  )
}
