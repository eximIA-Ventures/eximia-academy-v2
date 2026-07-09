"use client"

// ---------------------------------------------------------------------------
// E6 — Fluxo de Ação Individual (Sheet lateral, NOT a tab).
// ---------------------------------------------------------------------------
// The shell mounts this once for the `?student&action=` deep-link (E10 bridge);
// E5 also mounts its OWN instance to open the flow for a student picked inside a
// suggestion card. In both cases the Sheet is fully controlled (open + student +
// action come from the parent) and reads everything else from the scoped
// endpoints (never trusting client-side scope):
//   • GET /api/engagement/students?ids=&action=  → student detail + AC10 nudgeType
//   • GET /api/engagement/history?student=        → recent comms (Acionar only)
//   • POST /api/engagement/action                 → dispatch (server re-scopes)
//
// remind (Lembrar) = lighter: no Status atual, no comms history (Seção 6).
// activate (Acionar) = stronger: + Status atual + Histórico recente (Seção 6).
// ---------------------------------------------------------------------------

import {
  Badge,
  Button,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetOverlay,
  SheetTitle,
  Skeleton,
  useToast,
} from "@eximia/ui"
import { useCallback, useEffect, useState } from "react"
import {
  MessagePreviewPanel,
  type MessagePreviewValue,
  buildSuggestedMessage,
} from "./message-preview-panel"
import type { IndividualActionSheetProps } from "./types"

// --- Local types (not in the E4-owned types.ts) ----------------------------
// The scoped student-detail shape returned by GET /api/engagement/students.
// Declared locally per the fronteira rule (do not edit types.ts). If the shell
// later needs this shape it should be lifted into types.ts by the orchestrator.
interface EngagementStudentDetail {
  id: string
  fullName: string | null
  totalSessions: number
  completedSessions: number
  reflectionsCount: number
  daysSinceLastActivity: number | null
  progressPct: number
  behindSchedule: boolean
  ritmo: "no_ritmo" | "atrasado" | "nao_iniciado"
  status: "no_ritmo" | "atencao" | "sem_acesso"
  nudgeType:
    | "never_accessed"
    | "inactive"
    | "no_reflection"
    | "top_performer"
    | "announcement"
    | "custom"
    | "behind_teaching_plan"
  templateKey: string | null
}

interface CommsHistoryRow {
  id: string
  title: string
  status: string
  created_at: string
  sent_at: string | null
  sender_identity: string
  channel: string
}

// --- Suggested base body per nudgeType (tone reference: report Section 11) ---
// The message the preview PRE-FILLS; the manager edits freely. The origin
// greeting is added by MessagePreviewPanel.buildSuggestedMessage — this is only
// the substantive body, matching the report's exemplars.
const SUGGESTED_BODY: Record<string, string> = {
  never_accessed:
    "Percebi que você ainda não acessou a plataforma. Quando puder, dê o primeiro passo e comece sua trilha na exímIA Academy.",
  inactive:
    "Notei que faz um tempo que você não acessa a plataforma. Que tal retomar de onde parou? Estou por aqui se precisar.",
  behind_teaching_plan:
    "Percebi que sua trilha está abaixo do ritmo esperado para o Plano de Ensino. Quando puder, acesse a plataforma e avance no próximo módulo.",
  no_reflection:
    "Você concluiu sessões recentes, mas ainda não registrou suas reflexões. Consolidar o aprendizado faz toda a diferença.",
  top_performer:
    "Seu engajamento tem sido excelente. Continue assim, o progresso está muito consistente.",
}

const STATUS_LABEL: Record<string, { label: string; variant: "error" | "warning" | "success" }> = {
  atencao: { label: "Em atenção", variant: "error" },
  sem_acesso: { label: "Sem acesso recente", variant: "warning" },
  no_ritmo: { label: "No ritmo", variant: "success" },
}

const MOTIVO_BY_NUDGE: Record<string, string> = {
  never_accessed: "Convite enviado, mas nenhuma atividade registrada.",
  inactive: "Sem acesso recente à plataforma.",
  behind_teaching_plan: "Progresso abaixo do esperado para o Plano de Ensino.",
  no_reflection: "Sessões concluídas sem reflexão registrada.",
  top_performer: "Aluno em dia, engajamento em destaque no recorte atual.",
}

function firstNameOf(fullName: string | null): string {
  if (!fullName) return "aluno"
  const t = fullName.trim()
  return t ? t.split(/\s+/)[0] : "aluno"
}

function lastAccessLabel(days: number | null): string {
  if (days === null) return "Nunca acessou"
  if (days === 0) return "Hoje"
  if (days === 1) return "Ontem"
  return `${days} dias atrás`
}

export function IndividualActionSheet({
  open,
  onOpenChange,
  studentId,
  action,
  senderOptions,
}: IndividualActionSheetProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<EngagementStudentDetail | null>(null)
  const [history, setHistory] = useState<CommsHistoryRow[] | null>(null)
  const [preview, setPreview] = useState<MessagePreviewValue | null>(null)
  const [sending, setSending] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const isActivate = action === "activate"
  // recognize (Parabenizar) = POSITIVE gesture: green/success, no cobrança tone,
  // no comms-history block (it is a standalone congratulation, not a follow-up).
  const isRecognize = action === "recognize"

  const loadStudent = useCallback(async () => {
    if (!studentId) return
    setLoading(true)
    setLoadError(null)
    setDetail(null)
    setHistory(null)
    setPreview(null)
    try {
      const res = await fetch(
        `/api/engagement/students?ids=${encodeURIComponent(studentId)}&action=${action ?? "remind"}`,
      )
      if (!res.ok) {
        setLoadError("Não foi possível carregar os dados do aluno.")
        return
      }
      const data = (await res.json()) as { students: EngagementStudentDetail[] }
      const found = data.students[0]
      if (!found) {
        // Empty means the student is outside the caller's recorte (scope guard).
        setLoadError("Este aluno não pertence ao seu recorte atual.")
        return
      }
      setDetail(found)

      // Seed the editable preview from the AC10-derived template body.
      const first = firstNameOf(found.fullName)
      const body = SUGGESTED_BODY[found.nudgeType] ?? SUGGESTED_BODY.inactive
      const identity = senderOptions.defaultIdentity
      setPreview({
        identity,
        message: buildSuggestedMessage(identity, first, senderOptions.managerName, body),
        channel: "inapp",
      })

      // Acionar → recent comms history (last 3), scoped by the same route (E8).
      if (action === "activate") {
        const hRes = await fetch(`/api/engagement/history?student=${encodeURIComponent(studentId)}`)
        if (hRes.ok) {
          const hData = (await hRes.json()) as { notifications: CommsHistoryRow[] }
          setHistory((hData.notifications ?? []).slice(0, 3))
        } else {
          setHistory([])
        }
      }
    } catch {
      setLoadError("Erro ao carregar os dados do aluno.")
    } finally {
      setLoading(false)
    }
  }, [studentId, action, senderOptions.defaultIdentity, senderOptions.managerName])

  useEffect(() => {
    if (open && studentId) {
      void loadStudent()
    }
    if (!open) {
      // Reset when closed so a re-open always refetches fresh.
      setDetail(null)
      setHistory(null)
      setPreview(null)
      setLoadError(null)
    }
  }, [open, studentId, loadStudent])

  async function handleSend() {
    if (!detail || !preview) return
    setSending(true)
    try {
      const res = await fetch("/api/engagement/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: detail.id,
          nudgeType: detail.nudgeType,
          templateKey: detail.templateKey,
          message: preview.message,
          senderIdentity: preview.identity,
        }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null
        toast({
          variant: "error",
          title: "Não foi possível enviar",
          description: err?.error ?? "Tente novamente em instantes.",
        })
        return
      }
      toast({
        variant: "success",
        title: "Mensagem enviada",
        description: `${detail.fullName ?? "O aluno"} receberá a comunicação.`,
      })
      onOpenChange(false)
    } catch {
      toast({ variant: "error", title: "Erro de rede", description: "Verifique sua conexão." })
    } finally {
      setSending(false)
    }
  }

  const title = isRecognize ? "Parabenizar aluno" : isActivate ? "Acionar aluno" : "Lembrar aluno"
  const statusMeta = detail ? STATUS_LABEL[detail.status] : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetOverlay />
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:w-[30rem]">
        <SheetHeader>
          <SheetTitle className={isRecognize ? "text-semantic-success" : undefined}>
            {title}
          </SheetTitle>
          {isRecognize && (
            <p className="mt-1 text-sm text-text-secondary">
              Um reconhecimento breve para um aluno em dia.
            </p>
          )}
        </SheetHeader>

        {loading && (
          <div className="mt-4 space-y-4">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {!loading && loadError && (
          <div className="mt-4 rounded-lg bg-semantic-error/10 p-4 text-sm text-text-secondary ring-1 ring-semantic-error/30">
            {loadError}
          </div>
        )}

        {!loading && detail && preview && (
          <div className="mt-4 space-y-5">
            {/* --- Aluno + motivo (subtítulo) --- */}
            <div>
              <p className="text-base font-semibold text-text-primary">
                {detail.fullName ?? "Aluno"}
              </p>
              <p className="mt-0.5 text-sm text-text-secondary">
                {MOTIVO_BY_NUDGE[detail.nudgeType] ?? "Ação de engajamento."}
              </p>
            </div>

            {/* --- Métricas (Status atual só no Acionar) --- */}
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {isActivate && statusMeta && (
                <div className="col-span-2">
                  <dt className="text-xs text-text-muted">Status atual</dt>
                  <dd className="mt-1">
                    <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-text-muted">Último acesso</dt>
                <dd className="mt-0.5 font-medium text-text-primary">
                  {lastAccessLabel(detail.daysSinceLastActivity)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Progresso</dt>
                <dd className="mt-0.5 font-medium text-text-primary">{detail.progressPct}%</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Engajamento</dt>
                <dd className="mt-0.5 font-medium text-text-primary">
                  {detail.completedSessions}/{detail.totalSessions} sessões ·{" "}
                  {detail.reflectionsCount} reflexões
                </dd>
              </div>
            </dl>

            {/* --- Histórico recente de comunicações (Acionar apenas) --- */}
            {isActivate && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-text-primary">
                  Histórico recente de comunicações
                </p>
                {history === null ? (
                  <Skeleton className="h-12 w-full" />
                ) : history.length === 0 ? (
                  <p className="text-xs text-text-muted">
                    Nenhuma comunicação enviada para este aluno ainda.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {history.map((h) => (
                      <li
                        key={h.id}
                        className="rounded-lg bg-bg-surface px-3 py-2 text-xs text-text-secondary"
                      >
                        <span className="font-medium text-text-primary">{h.title}</span>
                        <span className="text-text-muted">
                          {" · "}
                          {new Date(h.created_at).toLocaleDateString("pt-BR")}
                          {" · "}
                          {h.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* --- Origem + preview editável + canal (componente compartilhado) --- */}
            <MessagePreviewPanel
              recipientFirstName={firstNameOf(detail.fullName)}
              suggestedBody={SUGGESTED_BODY[detail.nudgeType] ?? SUGGESTED_BODY.inactive}
              senderOptions={senderOptions}
              channelInapp={true}
              channelEmail={false}
              value={preview}
              onChange={setPreview}
              disabled={sending}
            />

            {/* --- Enviar --- */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>
                Cancelar
              </Button>
              <Button
                onClick={handleSend}
                disabled={sending || preview.message.trim().length === 0}
              >
                {sending ? "Enviando..." : "Enviar"}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
