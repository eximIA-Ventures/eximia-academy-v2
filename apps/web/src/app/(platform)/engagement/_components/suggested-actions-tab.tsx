"use client"

// ---------------------------------------------------------------------------
// E5 — Aba Ações Sugeridas (default tab of the Engagement Center).
// ---------------------------------------------------------------------------
// Renders one SuggestionCard per live cohort of the CURRENT recorte (the
// suggestions already arrive scoped from GET /api/engagement/overview, E3). Each
// card answers the 7 product questions (quem / por quê / qual ação / qual
// mensagem / quem assina / qual canal) and offers 4 actions:
//   • Ver alunos      — lists the cohort's students (name + last access)
//   • Revisar mensagem — opens the shared preview (individual, single-student)
//   • Enviar          — ALSO opens the preview first (AC6: never send unreviewed)
//   • Dispensar       — PATCH /api/admin/engagement/suggestions/[id] {dismiss}
//
// Individual send now NAVIGATES to the inline Central de Envios pre-filled
// (decisão Hugo 2026-07-09: the overlay Sheet was removed). A single-student
// action pushes `/engagement?student={id}&action=` (same page, the shell switches
// to the Central de Envios tab). A MULTI-student cohort is a COLLECTIVE action,
// which belongs to the Campanhas tab (E7) — for those, the card routes the
// manager to pick a single student (Ver alunos) first.
//
// AC3: a cohort with zero students never renders a card (defensive dupe of the
// engine guard). AC8: exact empty-state copy from report Section 15.
// ---------------------------------------------------------------------------

import { RitmoBadge, ritmoDisplayFrom } from "@/components/analytics/ritmo-badge"
import {
  Badge,
  Button,
  EmptyState,
  Modal,
  ModalClose,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  useToast,
} from "@eximia/ui"
import { Inbox, Users } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
import { deriveAttentionReason } from "./derive-attention-reason"
import { withFocus } from "./engagement-fetch"
import type { EngagementSuggestion, SuggestedActionsTabProps } from "./types"

// --- Local per-type copy (title + suggested action verb). The `key` is NEVER
// shown to the user (Dev Notes); these are the human labels. -----------------
const TYPE_META: Record<
  string,
  { title: string; suggestedAction: string; blurb: (n: number) => string }
> = {
  never_accessed: {
    title: "Nunca acessaram",
    suggestedAction: "Enviar lembrete de primeiro acesso.",
    blurb: (n) => `${n} aluno${n === 1 ? "" : "s"} do seu time ainda não acessaram a plataforma.`,
  },
  inactive: {
    title: "Inativos há mais de 14 dias",
    suggestedAction: "Enviar lembrete de retomada.",
    blurb: (n) =>
      `${n} aluno${n === 1 ? "" : "s"} do seu time estão sem acessar há mais de 14 dias.`,
  },
  behind_teaching_plan: {
    title: "Atrasados no Plano de Ensino",
    suggestedAction: "Acionar para retomar o ritmo do plano.",
    blurb: (n) =>
      `${n} aluno${n === 1 ? "" : "s"} do seu time estão abaixo do ritmo do Plano de Ensino.`,
  },
  no_reflection: {
    title: "Sessões sem reflexão",
    suggestedAction: "Reforçar o hábito de registrar reflexões.",
    blurb: (n) =>
      `${n} aluno${n === 1 ? "" : "s"} concluíram sessões mas não registraram reflexão.`,
  },
  top_performer: {
    title: "Destaques para reconhecer",
    suggestedAction: "Parabenizar pelo engajamento.",
    blurb: (n) => `${n} aluno${n === 1 ? "" : "s"} em destaque no recorte atual.`,
  },
}

// Local scoped-student shape (mirrors GET /api/engagement/students). Declared
// locally per the fronteira rule (types.ts is E4-owned, not edited here).
// Rodada 4 (E12): widened to the fields the modal now shows in the SAME visual as
// the main table — ritmo/triagem/enrollment counts (for the RitmoDisplay pill) and
// completedSessions/reflectionsCount (for the engagement block). All already
// returned by GET /api/engagement/students; no new client-side computation.
interface CohortStudent {
  id: string
  fullName: string | null
  daysSinceLastActivity: number | null
  progressPct: number
  completedSessions: number
  reflectionsCount: number
  ritmo?: "no_ritmo" | "atrasado" | "nao_iniciado"
  status?: "no_ritmo" | "atencao" | "sem_acesso"
  coursesEnrolled?: number
  coursesCompleted?: number
}

function lastAccessLabel(days: number | null): string {
  if (days === null) return "Nunca acessou"
  if (days === 0) return "Hoje"
  if (days === 1) return "Ontem"
  return `${days} dias atrás`
}

/** Engagement score, identical to the main table (completedSessions×2 + reflections). */
function engagementScore(s: CohortStudent): number {
  return s.completedSessions * 2 + s.reflectionsCount
}

export function SuggestedActionsTab({
  initialSuggestions,
  context,
  senderOptions,
  canAct,
  focus,
  initialType,
  allowedTypes,
}: SuggestedActionsTabProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [suggestions, setSuggestions] = useState<EngagementSuggestion[]>(initialSuggestions)
  const [dismissing, setDismissing] = useState<Set<string>>(new Set())

  // "Ver alunos" modal state.
  const [viewingCohort, setViewingCohort] = useState<EngagementSuggestion | null>(null)
  const [cohortStudents, setCohortStudents] = useState<CohortStudent[] | null>(null)
  const [loadingStudents, setLoadingStudents] = useState(false)

  // AC3 defensive filter: never render a cohort with no students. Cards
  // Mestre-Detalhe: `allowedTypes` (fatia 4/6), when present, restricts to
  // that CARD's cohort set (e.g. "Atenção" only shows never_accessed +
  // behind_teaching_plan + no_reflection); `initialType` (fatia 3/6), when
  // present, further restricts to a single cohort (e.g. "Destaques" only
  // shows `top_performer`). Neither is yet wired to a `?type=` deep-link
  // (fatia 6).
  const renderable = useMemo(
    () =>
      suggestions.filter(
        (s) =>
          s.targetStudentIds.length > 0 &&
          (!allowedTypes || allowedTypes.includes(s.type)) &&
          (!initialType || s.type === initialType),
      ),
    [suggestions, initialType, allowedTypes],
  )

  // "activate" for the harder cohorts (never accessed / behind plan), "remind"
  // for the softer ones — mirrors the tabela's Lembrar/Acionar tone split.
  const actionForType = useCallback(
    (type: string): "remind" | "activate" =>
      type === "never_accessed" || type === "behind_teaching_plan" || type === "inactive"
        ? "activate"
        : "remind",
    [],
  )

  const fetchCohortStudents = useCallback(
    async (s: EngagementSuggestion) => {
      setViewingCohort(s)
      setCohortStudents(null)
      setLoadingStudents(true)
      try {
        const ids = s.targetStudentIds.slice(0, 200).join(",")
        const res = await fetch(
          withFocus(
            `/api/engagement/students?ids=${encodeURIComponent(ids)}&action=activate`,
            focus,
          ),
        )
        if (res.ok) {
          const data = (await res.json()) as { students: CohortStudent[] }
          setCohortStudents(data.students)
        } else {
          setCohortStudents([])
        }
      } catch {
        setCohortStudents([])
      } finally {
        setLoadingStudents(false)
      }
    },
    [focus],
  )

  // Navigate to the inline Central de Envios pre-filled for this student. The
  // shell reads `?student&action` and auto-selects the Central de Envios tab.
  function openIndividual(studentId: string, type: string) {
    setViewingCohort(null)
    router.push(`/engagement?student=${studentId}&action=${actionForType(type)}`)
  }

  // Revisar/Enviar on a card: single-student → open the Central de Envios
  // pre-filled (AC5/AC6, always previews before dispatch). Multi-student →
  // collective, send the manager to pick one via "Ver alunos" (campaign in E7).
  function handleReviewOrSend(s: EngagementSuggestion) {
    if (s.targetStudentIds.length === 1) {
      openIndividual(s.targetStudentIds[0], s.type)
    } else {
      void fetchCohortStudents(s)
      toast({
        variant: "info",
        title: "Ação coletiva",
        description:
          "Este grupo tem vários alunos. Escolha um aluno para a ação individual, ou use a aba Campanhas para o envio coletivo.",
      })
    }
  }

  async function handleDismiss(s: EngagementSuggestion) {
    setDismissing((prev) => new Set(prev).add(s.id))
    try {
      const res = await fetch(`/api/admin/engagement/suggestions/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss" }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null
        toast({
          variant: "error",
          title: "Não foi possível dispensar",
          description: err?.error ?? "Tente novamente.",
        })
        return
      }
      // Optimistic removal — the card disappears without a page reload (AC7).
      setSuggestions((prev) => prev.filter((x) => x.id !== s.id))
      toast({
        variant: "success",
        title: "Sugestão dispensada",
        description: "Não aparecerá por 7 dias.",
      })
    } catch {
      toast({ variant: "error", title: "Erro de rede", description: "Verifique sua conexão." })
    } finally {
      setDismissing((prev) => {
        const next = new Set(prev)
        next.delete(s.id)
        return next
      })
    }
  }

  // AC8 — empty state (report Section 15, exact copy).
  if (renderable.length === 0) {
    return (
      <EmptyState
        className="rounded-2xl bg-bg-card shadow-card"
        icon={<Inbox size={28} />}
        title="Nenhuma ação pendente no momento"
        description={
          context.tenantWide
            ? "Nenhum aluno em risco no momento."
            : "Seu time não possui alunos em risco dentro do recorte atual."
        }
      />
    )
  }

  const originLabel =
    senderOptions.defaultIdentity === "manager" && senderOptions.managerName
      ? `${senderOptions.managerName}, gestor do time`
      : "exímIA Academy"

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {renderable.map((s) => {
          const meta = TYPE_META[s.type] ?? {
            title: "Sugestão",
            suggestedAction: "Revisar e enviar comunicação.",
            blurb: (n: number) => `${n} aluno${n === 1 ? "" : "s"} no recorte atual.`,
          }
          const count = s.targetStudentIds.length
          const isDismissing = dismissing.has(s.id)
          return (
            <article
              key={s.id}
              className="flex flex-col gap-3 rounded-2xl bg-bg-card p-5 shadow-card"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold text-text-primary">{meta.title}</h3>
                <Badge variant="default">
                  {count} aluno{count === 1 ? "" : "s"}
                </Badge>
              </div>

              <p className="text-sm text-text-secondary">{meta.blurb(count)}</p>

              <dl className="space-y-1.5 text-sm">
                <div>
                  <dt className="text-xs text-text-muted">Motivo</dt>
                  <dd className="text-text-secondary">
                    {s.rationale ?? "Alunos do recorte atual que se encaixam nesta regra."}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Ação sugerida</dt>
                  <dd className="text-text-secondary">{meta.suggestedAction}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Origem da mensagem</dt>
                  <dd className="text-text-secondary">{originLabel}</dd>
                </div>
              </dl>

              <div className="mt-auto flex flex-wrap gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => fetchCohortStudents(s)}>
                  Ver alunos
                </Button>
                {canAct && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => handleReviewOrSend(s)}>
                      Revisar mensagem
                    </Button>
                    <Button variant="default" size="sm" onClick={() => handleReviewOrSend(s)}>
                      Enviar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDismiss(s)}
                      disabled={isDismissing}
                    >
                      {isDismissing ? "Dispensando..." : "Dispensar"}
                    </Button>
                  </>
                )}
              </div>
            </article>
          )
        })}
      </div>

      {/* --- Ver alunos (Modal) ---
          Rodada 4 (E12): the modal now closes by X, by click-outside (ModalOverlay)
          and by Esc (built into <Modal>), matching every other modal in the product
          (e.g. admin/areas). The student rows mirror the main table's visual:
          RitmoBadge + progress bar + engagement block, from the SAME data source. */}
      <Modal open={viewingCohort !== null} onOpenChange={(o) => !o && setViewingCohort(null)}>
        <ModalOverlay />
        <ModalContent className="max-w-lg">
          <ModalHeader className="flex-row items-start justify-between">
            <ModalTitle>
              {viewingCohort ? (TYPE_META[viewingCohort.type]?.title ?? "Alunos") : "Alunos"}
            </ModalTitle>
            <ModalClose aria-label="Fechar" />
          </ModalHeader>
          <div className="mt-2 max-h-[60vh] overflow-y-auto">
            {loadingStudents && <p className="text-sm text-text-muted">Carregando alunos...</p>}
            {!loadingStudents && cohortStudents && cohortStudents.length === 0 && (
              <p className="text-sm text-text-muted">
                Nenhum aluno encontrado para este critério no recorte atual.
              </p>
            )}
            {!loadingStudents && cohortStudents && cohortStudents.length > 0 && (
              <ul className="divide-y divide-border-subtle">
                {cohortStudents.map((stu) => {
                  const pct = stu.progressPct
                  // Same barra semantics as the table: vermelha se atrasado, verde caso contrário.
                  const barColor = stu.ritmo === "atrasado" ? "#ef4444" : "#10b981"
                  const score = engagementScore(stu)
                  // Cards Mestre-Detalhe (fatia 4/6, doc 03 §4 decisão 2): the
                  // individual "porquê" only applies to the no_reflection
                  // cohort — every other cohort's title already IS the reason.
                  const attentionReason =
                    viewingCohort?.type === "no_reflection"
                      ? deriveAttentionReason({
                          triagem: stu.status,
                          completedSessions: stu.completedSessions,
                          reflectionsCount: stu.reflectionsCount,
                        })
                      : null
                  return (
                    <li key={stu.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-text-primary">
                            {stu.fullName ?? "Aluno"}
                          </p>
                          {/* SAME RitmoBadge as the main table (single source of truth). */}
                          <RitmoBadge
                            display={ritmoDisplayFrom({
                              ritmo: stu.ritmo,
                              triagem: stu.status,
                              coursesEnrolled: stu.coursesEnrolled,
                              coursesCompleted: stu.coursesCompleted,
                            })}
                          />
                        </div>
                        {/* Progresso — % + barra larga, mesma semântica da tabela. */}
                        <div className="flex items-center gap-2">
                          <span className="w-9 shrink-0 text-xs font-bold tabular-nums text-text-primary">
                            {pct}%
                          </span>
                          <div
                            style={{ backgroundColor: "var(--color-bg-hover)" }}
                            className="h-1.5 w-full min-w-[80px] max-w-[160px] overflow-hidden rounded-full"
                          >
                            {pct > 0 && (
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${pct}%`, backgroundColor: barColor }}
                              />
                            )}
                          </div>
                        </div>
                        {/* Engajamento — score + "N interações · M reflexões", igual à tabela. */}
                        <p className="text-[11px] text-text-muted tabular-nums">
                          {score === 0 ? (
                            "Sem atividade recente"
                          ) : (
                            <>
                              <span className="font-semibold text-text-secondary">
                                Engajamento {score}
                              </span>{" "}
                              · {stu.completedSessions} interaç
                              {stu.completedSessions === 1 ? "ão" : "ões"} · {stu.reflectionsCount}{" "}
                              reflex{stu.reflectionsCount === 1 ? "ão" : "ões"}
                            </>
                          )}{" "}
                          · Último acesso: {lastAccessLabel(stu.daysSinceLastActivity)}
                        </p>
                        {attentionReason && (
                          <p className="text-[11px] text-text-muted">{attentionReason}</p>
                        )}
                      </div>
                      {canAct && viewingCohort && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          onClick={() => openIndividual(stu.id, viewingCohort.type)}
                        >
                          <Users size={14} /> Ação individual
                        </Button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </ModalContent>
      </Modal>
    </>
  )
}
