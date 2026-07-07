"use client"

import { switchWorkspace } from "@/app/(platform)/workspace/actions"
import { signOut } from "@/lib/actions/auth"
import { GraduationCap, Loader2, PencilRuler } from "lucide-react"
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
      <div className="w-full max-w-3xl">
        <header className="mb-10 text-center">
          <p className="text-lg font-medium text-text-primary">{greeting}</p>
        </header>

        <div className="grid gap-6 sm:grid-cols-2">
          {canStandard && (
            <WorkspaceCard
              icon={<GraduationCap size={28} className="text-cerrado-600" />}
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
              icon={<PencilRuler size={28} className="text-accent-gold" />}
              accent="gold"
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

      <form action={signOut} className="absolute bottom-6 right-6">
        <button
          type="submit"
          className="text-xs font-medium text-text-muted transition-colors hover:text-text-primary"
        >
          Sair
        </button>
      </form>
    </main>
  )
}

interface CardProps {
  icon: React.ReactNode
  accent: "cerrado" | "gold"
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
  const ring = accent === "gold" ? "hover:ring-accent-gold/30" : "hover:ring-cerrado-600/30"
  const iconBg = accent === "gold" ? "bg-accent-gold/15" : "bg-cerrado-600/15"
  const button =
    accent === "gold"
      ? "bg-accent-gold text-white hover:bg-accent-gold-dark"
      : "bg-cerrado-600 text-white hover:bg-cerrado-700"

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
            className="rounded-full bg-bg-surface px-2.5 py-0.5 text-[11px] font-medium text-text-secondary"
          >
            {tag}
          </span>
        ))}
      </div>
      <span
        className={`mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all ${button}`}
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : "Entrar"}
      </span>
    </button>
  )
}
