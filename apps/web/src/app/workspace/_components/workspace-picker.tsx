"use client"

import { switchWorkspace } from "@/app/(platform)/workspace/actions"
import { signOut } from "@/lib/actions/auth"
import { buttonVariants, cn } from "@eximia/ui"
import { GraduationCap, Loader2, LogOut, PencilRuler } from "lucide-react"
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

  const greeting = firstName
    ? `Olá, ${firstName}. Onde você quer trabalhar hoje?`
    : "Onde você quer trabalhar hoje?"

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-bg-app px-6 py-16">
      {/* Sair — canto superior direito, botão ghost sutil do design system */}
      <form action={signOut} className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
        >
          <LogOut size={16} />
          Sair
        </button>
      </form>

      <div className="w-full max-w-3xl">
        <header className="mb-10 text-center">
          <p className="text-lg font-medium text-text-primary">{greeting}</p>
        </header>

        <div className="grid gap-6 sm:grid-cols-2">
          {canStandard && (
            <WorkspaceCard
              icon={<GraduationCap size={28} className="text-cerrado-600 dark:text-cerrado-400" />}
              accent="cerrado"
              title="Plataforma de Aprendizagem"
              subtitle="Sua trilha de aprendizagem e a gestão do seu time"
              tags={["Aluno", "Gestor"]}
              loading={isPending && target === "standard"}
              disabled={isPending && target !== "standard"}
              onEnter={() => enter("standard")}
            />
          )}
          {canStudio && (
            <WorkspaceCard
              icon={<PencilRuler size={28} className="text-studio-600 dark:text-studio-400" />}
              accent="studio"
              title="Estúdio do Instrutor"
              subtitle="Crie cursos e acompanhe a aprendizagem dos seus alunos"
              tags={["Instrutor"]}
              loading={isPending && target === "studio"}
              disabled={isPending && target !== "studio"}
              onEnter={() => enter("studio")}
            />
          )}
        </div>

        <p className="mt-8 text-center text-xs text-text-muted">
          Você pode trocar de workspace a qualquer momento pelo menu da sua conta.
        </p>
      </div>
    </main>
  )
}

interface CardProps {
  icon: React.ReactNode
  accent: "cerrado" | "studio"
  title: string
  subtitle: string
  tags: string[]
  loading: boolean
  disabled: boolean
  onEnter: () => void
}

function WorkspaceCard({
  icon,
  accent,
  title,
  subtitle,
  tags,
  loading,
  disabled,
  onEnter,
}: CardProps) {
  const isStudio = accent === "studio"
  const ring = isStudio ? "hover:ring-studio-600/30" : "hover:ring-cerrado-600/30"
  const iconBg = isStudio ? "bg-studio-600/12" : "bg-cerrado-600/12"
  // Studio overrides only the emerald surface/hover/ring tokens on top of the
  // canonical buttonVariants default (which already renders the cerrado world),
  // so the two worlds share one button style instead of inventing a pill.
  const studioButton =
    "bg-studio-600 hover:bg-studio-700 focus-visible:ring-studio-500/50 hover:scale-[1.02]"

  return (
    <button
      type="button"
      onClick={onEnter}
      disabled={loading || disabled}
      className={`group flex flex-col items-start gap-4 rounded-2xl bg-bg-card p-6 text-left shadow-card ring-1 ring-transparent transition-all hover:-translate-y-0.5 hover:shadow-elevated ${ring} disabled:pointer-events-none disabled:opacity-60`}
    >
      <div className={`flex h-14 w-14 items-center justify-center rounded-xl ${iconBg}`}>
        {icon}
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-bold text-text-primary">{title}</h2>
        <p className="text-sm text-text-muted">{subtitle}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center rounded-lg bg-bg-elevated px-2.5 py-0.5 text-2xs font-semibold text-text-secondary ring-1 ring-border-subtle"
          >
            {tag}
          </span>
        ))}
      </div>
      {/* The whole card is the <button>; the "Entrar" affordance is a <span>
          styled with the canonical buttonVariants (no nested <button>, no custom
          pill). Cerrado uses the default variant; studio overrides only the
          emerald surface/hover/ring tokens. */}
      <span className={cn(buttonVariants(), "mt-2 w-full", isStudio && studioButton)}>
        {loading ? <Loader2 size={16} className="animate-spin" /> : "Entrar"}
      </span>
    </button>
  )
}
