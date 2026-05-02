"use client"

import { Button, useToast } from "@eximia/ui"
import { Archive, ArrowRight, BookOpen, Briefcase, CheckCircle2, Clock, Lock, Play, Plus, Route, Sparkles } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { selfEnrollInTrail } from "./actions"

interface Trail {
  id: string
  title: string
  description: string | null
  status: string
  estimated_hours: number | null
  is_mandatory: boolean
  target_job_role_id: string | null
  target_role_name?: string | null
  course_count: number
  is_enrolled: boolean
  progress: { total: number; completed: number } | null
  created_at: string
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: "Rascunho", className: "bg-white/[0.04] text-text-muted ring-1 ring-white/[0.06]" },
  active: { label: "Ativa", className: "bg-semantic-success/10 text-semantic-success ring-1 ring-semantic-success/20" },
  archived: { label: "Arquivada", className: "bg-white/[0.03] text-text-muted/60 ring-1 ring-white/[0.04]" },
}

export function TrailsListClient({ trails, userRole }: { trails: Trail[]; userRole: string }) {
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const router = useRouter()
  const canCreate = ["instructor", "admin", "super_admin"].includes(userRole)
  const isStudent = userRole === "student"

  function handleSelfEnroll(trailId: string) {
    startTransition(async () => {
      const result = await selfEnrollInTrail(trailId)
      if ("error" in result && result.error) {
        toast({ variant: "error", title: "Erro", description: result.error })
        return
      }
      router.refresh()
    })
  }

  return (
    <>
      {canCreate && (
        <div className="flex justify-end">
          <Link href="/trails/new">
            <Button>
              <Plus size={16} className="mr-1.5" />
              Nova Trilha
            </Button>
          </Link>
        </div>
      )}

      {trails.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-bg-card ring-1 ring-white/[0.06] py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-teal/10">
            <Route size={28} className="text-accent-teal/50" />
          </div>
          <p className="mt-4 text-sm font-medium text-text-secondary">
            {isStudent ? "Nenhuma trilha disponível" : "Nenhuma trilha criada"}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {isStudent ? "Trilhas aparecerão aqui quando atribuídas." : "Crie sua primeira trilha de aprendizagem."}
          </p>
          {canCreate && (
            <Link href="/trails/new" className="mt-4">
              <Button variant="outline" size="sm">Criar primeira trilha</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {trails.map((trail) => {
            const config = STATUS_CONFIG[trail.status] ?? STATUS_CONFIG.draft
            const progressPct = trail.progress
              ? trail.progress.total > 0
                ? Math.round((trail.progress.completed / trail.progress.total) * 100)
                : 0
              : null

            return (
              <Link key={trail.id} href={`/trails/${trail.id}`}>
                <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-accent-teal/5 via-bg-card to-bg-card ring-1 ring-white/[0.06] p-6 transition-all duration-300 hover:-translate-y-0.5 hover:ring-accent-teal/25 hover:shadow-[0_8px_30px_rgba(0,0,0,0.2)]">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-teal/15">
                        <Route size={18} className="text-accent-teal" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-text-primary group-hover:text-accent-teal transition-colors line-clamp-1">
                          {trail.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[9px] font-semibold ${config.className}`}>
                            {config.label}
                          </span>
                          {trail.is_mandatory && (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold text-amber-500 ring-1 ring-amber-500/20">
                              <Lock size={8} />
                              Obrigatória
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ArrowRight size={14} className="shrink-0 text-text-muted/20 group-hover:text-accent-teal transition-colors mt-1" />
                  </div>

                  {/* Description */}
                  {trail.description && (
                    <p className="text-xs text-text-muted line-clamp-2 mb-3">{trail.description}</p>
                  )}

                  {/* Meta pills */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="inline-flex items-center gap-1 rounded-lg bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-text-muted ring-1 ring-white/[0.06]">
                      <BookOpen size={10} />
                      {trail.course_count} cursos
                    </span>
                    {trail.estimated_hours && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-text-muted ring-1 ring-white/[0.06]">
                        <Clock size={10} />
                        {trail.estimated_hours}h
                      </span>
                    )}
                    {trail.target_role_name && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-400 ring-1 ring-purple-500/20">
                        <Briefcase size={10} />
                        {trail.target_role_name}
                      </span>
                    )}
                  </div>

                  {/* Student progress bar */}
                  {isStudent && progressPct !== null && (
                    <div className="mb-3">
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-text-muted">Progresso</span>
                        <span className="font-semibold text-accent-teal">{progressPct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div className="h-full rounded-full bg-accent-teal transition-all duration-500" style={{ width: `${progressPct}%` }} />
                      </div>
                    </div>
                  )}

                  {isStudent && !trail.is_enrolled && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={isPending}
                      onClick={(e) => {
                        e.preventDefault()
                        handleSelfEnroll(trail.id)
                      }}
                    >
                      <Sparkles size={12} className="mr-1.5" />
                      Inscrever-me
                    </Button>
                  )}

                  {/* Decorative */}
                  <div className="absolute -right-8 -bottom-8 h-24 w-24 rounded-full bg-accent-teal/5 blur-2xl" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
