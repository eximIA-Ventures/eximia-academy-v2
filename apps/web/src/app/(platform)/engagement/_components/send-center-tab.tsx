"use client"

// ---------------------------------------------------------------------------
// Central de Envios — INLINE tab (replaces the individual-action overlay).
// ---------------------------------------------------------------------------
// Decisão de produto (Hugo, 2026-07-09, definitiva): o overlay morre. A ação
// individual (Lembrar/Acionar/Parabenizar) passa a ser composta e enviada NESTA
// aba da própria página, servindo DOIS fluxos:
//
//   (a) AUTOMÁTICO — os botões da tabela navegam para
//       `/engagement?student={id}&action={remind|activate|recognize}`; a shell
//       seleciona esta aba e a Central abre pré-preenchida (aluno + motivo +
//       template + preview).
//   (b) MANUAL — o gestor abre a Central direto (sem params); a Central JÁ CARREGA
//       a lista completa e rolável dos alunos do recorte atual (GET
//       /api/engagement/students sem `ids`), e a barra de busca FILTRA essa lista
//       por nome (mesmo endpoint com `?q=`). O gestor escolhe o aluno, o tipo de
//       mensagem (lembrete/acionamento/reconhecimento/manual) e compõe a mensagem.
//       (Ajuste Hugo 2026-07-09: antes exigia digitar 2 letras e não mostrava a
//       lista; o gestor real da Cory alcança ~39 alunos e precisava vê-los todos.)
//
// O conteúdo de composição (card do aluno, motivo, métricas, histórico recente,
// origem, preview editável, envio) é re-hospedado do antigo Sheet — mesma lógica,
// mesmos endpoints scoped, mesmo MessagePreviewPanel compartilhado. A troca para
// inline também elimina a superfície `fixed` do Sheet (bug de painel transparente).
//
// Endpoints (todos já escopados server-side, nunca confiando no client):
//   • GET /api/engagement/students?ids=&action=  → detail + AC10 nudgeType
//   • GET /api/engagement/students[?q=]          → picker (lista o recorte; q filtra)
//   • GET /api/engagement/history?student=        → comms recentes (Acionar)
//   • POST /api/engagement/action                 → dispatch (server re-scopes)
// ---------------------------------------------------------------------------

import {
  Badge,
  Button,
  Command,
  CommandEmpty,
  CommandItem,
  CommandList,
  Input,
  Skeleton,
  useToast,
} from "@eximia/ui"
import { CheckCircle2, Search, Send, UserSearch } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  MessagePreviewPanel,
  type MessagePreviewValue,
  buildSuggestedMessage,
} from "./message-preview-panel"
import type {
  EngagementActionKind,
  EngagementStudentDetail,
  EngagementStudentOption,
  SendCenterTabProps,
} from "./types"

// --- Comms-history row (Acionar only). Local shape, mirrors GET /history. -----
interface CommsHistoryRow {
  id: string
  title: string
  status: string
  created_at: string
  sent_at: string | null
  sender_identity: string
  channel: string
}

// --- Suggested base body per nudgeType (tone reference: report Section 11). ---
// The body the preview PRE-FILLS; the manager edits freely. The origin greeting
// is added by MessagePreviewPanel.buildSuggestedMessage — this is only the body.
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
// Manual mode has no derived nudgeType → an empty, free-form body.
const MANUAL_BODY = ""

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

// Map the URL action verb → the students-route `action` query value. `manual`
// has no derived nudgeType; we still fetch the detail (for the card) but pin an
// empty body. We fetch manual as "remind" so the route returns a real projection.
function studentsActionParam(action: EngagementActionKind): string {
  return action === "manual" ? "remind" : action
}

// The composer's message TYPE selector (manual flow). Order = report Section 6/8.
const ACTION_OPTIONS: { value: EngagementActionKind; label: string; hint: string }[] = [
  { value: "remind", label: "Lembrete", hint: "Tom leve, para retomar o ritmo." },
  { value: "activate", label: "Acionamento", hint: "Tom mais forte, com histórico recente." },
  { value: "recognize", label: "Reconhecimento", hint: "Parabenizar um aluno em dia." },
  { value: "manual", label: "Mensagem livre", hint: "Escrever do zero, sem template." },
]

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

export function SendCenterTab({
  initialStudentId,
  initialAction,
  senderOptions,
  context,
  canAct,
  onSent,
}: SendCenterTabProps) {
  const { toast } = useToast()

  // The active target: which student + which message type the composer is on.
  // Seeded from the deep-link; null studentId = manual mode (picker first).
  const [studentId, setStudentId] = useState<string | null>(initialStudentId)
  const [action, setAction] = useState<EngagementActionKind>(initialAction ?? "manual")
  const [pickedName, setPickedName] = useState<string | null>(null)

  // Loaded student detail + comms history + editable preview.
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<EngagementStudentDetail | null>(null)
  const [history, setHistory] = useState<CommsHistoryRow[] | null>(null)
  const [preview, setPreview] = useState<MessagePreviewValue | null>(null)
  const [sending, setSending] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Manual picker state.
  const [pickerQuery, setPickerQuery] = useState("")
  const [pickerResults, setPickerResults] = useState<EngagementStudentOption[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)
  // E12 item 3: the picker used to swallow both non-200 responses and fetch
  // exceptions silently (empty results, no signal) — the exact failure mode that
  // made "Escolha o aluno" look broken with no way to debug. We now capture a
  // visible error so a real failure (scope resolving empty, 500 from the search,
  // network error) is distinguishable from "genuinely no match".
  const [pickerError, setPickerError] = useState<string | null>(null)

  const isActivate = action === "activate"
  const isRecognize = action === "recognize"
  const isManual = action === "manual"

  // React to a NEW deep-link (shell re-seeds these props when the URL changes).
  useEffect(() => {
    setStudentId(initialStudentId)
    setAction(initialAction ?? "manual")
    if (initialStudentId) setPickedName(null)
  }, [initialStudentId, initialAction])

  // --- Load the selected student's detail + seed the preview. ----------------
  const loadStudent = useCallback(async () => {
    if (!studentId) {
      setDetail(null)
      setHistory(null)
      setPreview(null)
      setLoadError(null)
      return
    }
    setLoading(true)
    setLoadError(null)
    setDetail(null)
    setHistory(null)
    setPreview(null)
    try {
      const res = await fetch(
        `/api/engagement/students?ids=${encodeURIComponent(studentId)}&action=${studentsActionParam(action)}`,
      )
      if (!res.ok) {
        const detail = await res.text().catch(() => "")
        console.error(`[send-center] student detail load failed: HTTP ${res.status}`, detail)
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

      // Seed the editable preview. Manual = empty body; others = template body.
      const first = firstNameOf(found.fullName)
      const body = isManual
        ? MANUAL_BODY
        : (SUGGESTED_BODY[found.nudgeType] ?? SUGGESTED_BODY.inactive)
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
    } catch (err) {
      console.error("[send-center] student detail load errored:", err)
      setLoadError("Erro ao carregar os dados do aluno.")
    } finally {
      setLoading(false)
    }
  }, [studentId, action, isManual, senderOptions.defaultIdentity, senderOptions.managerName])

  useEffect(() => {
    void loadStudent()
  }, [loadStudent])

  // --- Manual picker: full recorte roster on open + debounced filter. --------
  // Decisão Hugo 2026-07-09: the picker no longer waits for 2 letters. On open
  // (studentId === null → manual mode) it loads the WHOLE recorte, ordered by
  // name, so the manager can scroll and pick. Typing FILTERS that list via the
  // same scoped route (q refines within the recorte; empty q reloads the full
  // list). The route caps the list, so a huge tenant stays bounded.
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    // Only run while in picker mode (no student selected yet).
    if (studentId) return
    const q = pickerQuery.trim()
    if (searchTimer.current) clearTimeout(searchTimer.current)
    setPickerLoading(true)
    setPickerError(null)
    // Empty query loads immediately (roster on open); a typed query debounces.
    const delay = q.length === 0 ? 0 : 250
    searchTimer.current = setTimeout(async () => {
      try {
        // No `q` → full recorte list; with `q` → filtered within the recorte.
        const url =
          q.length > 0
            ? `/api/engagement/students?q=${encodeURIComponent(q)}`
            : "/api/engagement/students"
        const res = await fetch(url)
        if (res.ok) {
          const data = (await res.json()) as { students: EngagementStudentOption[] }
          setPickerResults(data.students ?? [])
          setPickerError(null)
        } else {
          // Non-200 is a REAL failure, not "no match" — surface it instead of
          // silently rendering an empty list (E12 item 3). Log the status/body so
          // a future failure is debuggable from the console.
          const detail = await res.text().catch(() => "")
          console.error(`[send-center] student picker load failed: HTTP ${res.status}`, detail)
          setPickerResults([])
          setPickerError(
            res.status === 403
              ? "Você não tem permissão para listar alunos neste recorte."
              : "Não foi possível carregar os alunos. Tente novamente.",
          )
        }
      } catch (err) {
        // Network/parse error — never swallow it silently (E12 item 3).
        console.error("[send-center] student picker load errored:", err)
        setPickerResults([])
        setPickerError("Erro de conexão ao carregar alunos. Verifique sua rede.")
      } finally {
        setPickerLoading(false)
      }
    }, delay)
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [pickerQuery, studentId])

  function pickStudent(option: EngagementStudentOption) {
    setPickedName(option.fullName)
    setStudentId(option.id)
    setPickerQuery("")
    setPickerResults([])
    // Keep the current message-type selection (default manual); the composer
    // re-fetches the detail for the newly picked student via loadStudent.
  }

  function resetToPicker() {
    setStudentId(null)
    setPickedName(null)
    setDetail(null)
    setHistory(null)
    setPreview(null)
    setLoadError(null)
  }

  async function handleSend() {
    if (!detail || !preview) return
    setSending(true)
    try {
      const res = await fetch("/api/engagement/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: detail.id,
          // Manual = free-form message with no template; use `custom` nudgeType
          // (already in the POST /action enum). recognize/remind/activate keep
          // the server-derived nudgeType from the students route.
          nudgeType: isManual ? "custom" : detail.nudgeType,
          templateKey: isManual ? null : detail.templateKey,
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
      // Reset to a clean composer, ready for the next send, and let the shell
      // clear the querystring (automated flow → manual afterwards).
      resetToPicker()
      onSent?.()
    } catch {
      toast({ variant: "error", title: "Erro de rede", description: "Verifique sua conexão." })
    } finally {
      setSending(false)
    }
  }

  const statusMeta = detail ? STATUS_LABEL[detail.status] : null
  const scopeCopy = context.tenantWide
    ? "Todos os alunos. Use o filtro para encontrar alguém pelo nome."
    : "Alunos do seu recorte atual. Use o filtro para encontrar alguém pelo nome."

  const composerTitle = isRecognize
    ? "Parabenizar aluno"
    : isActivate
      ? "Acionar aluno"
      : isManual
        ? "Enviar mensagem"
        : "Lembrar aluno"

  return (
    <div className="space-y-6">
      {/* --- Tipo de mensagem (composer type selector) --- */}
      <section className="rounded-2xl bg-bg-card p-5 shadow-card">
        <h2 className="text-base font-semibold text-text-primary">Tipo de mensagem</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Escolha o tom da comunicação. A prévia é sempre editável antes de enviar.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {ACTION_OPTIONS.map((opt) => {
            const selected = action === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAction(opt.value)}
                aria-pressed={selected}
                className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors ${
                  selected
                    ? "border-cerrado-600 bg-cerrado-600/10 ring-1 ring-cerrado-600/30"
                    : "border-border-subtle bg-bg-surface hover:border-cerrado-600/40"
                }`}
              >
                <span className="text-sm font-semibold text-text-primary">{opt.label}</span>
                <span className="text-xs text-text-muted">{opt.hint}</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* --- Aluno: picker (manual) OU card do aluno (selecionado) --- */}
      {!studentId ? (
        <section className="rounded-2xl bg-bg-card p-5 shadow-card">
          <div className="flex items-center gap-2">
            <UserSearch size={18} className="text-text-muted" aria-hidden="true" />
            <h2 className="text-base font-semibold text-text-primary">Escolha o aluno</h2>
          </div>
          <p className="mt-1 text-sm text-text-secondary">{scopeCopy}</p>
          <div className="mt-4 space-y-3">
            {/* We drive the search query externally (to hit the scoped API), so we
                use a plain Input, not CommandInput (which owns its own state). The
                route already filters by name, so Command's client filter is off. */}
            <Input
              type="text"
              placeholder="Filtrar aluno por nome..."
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              leadingIcon={<Search size={16} aria-hidden="true" />}
              aria-label="Filtrar aluno por nome"
            />
            {/* A real search failure is shown explicitly (E12 item 3), so an empty
                list never gets mistaken for "no students" when something broke. */}
            {pickerError && (
              <div
                className="rounded-lg bg-semantic-error/10 px-3 py-2 text-xs text-text-secondary ring-1 ring-semantic-error/30"
                role="alert"
              >
                {pickerError}
              </div>
            )}
            <Command filter={() => true} className="shadow-none ring-1 ring-border-subtle">
              <CommandList className="max-h-72">
                {pickerLoading && (
                  <div className="space-y-2 p-2">
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                )}
                {/* Empty states: a filter that matches nothing vs. a recorte with
                    no students at all — the copy distinguishes them. */}
                {!pickerLoading && !pickerError && pickerResults.length === 0 && (
                  <CommandEmpty>
                    {pickerQuery.trim().length > 0
                      ? "Nenhum aluno corresponde ao filtro no recorte atual."
                      : "Nenhum aluno no seu recorte atual."}
                  </CommandEmpty>
                )}
                {!pickerLoading &&
                  pickerResults.map((s) => (
                    <CommandItem
                      key={s.id}
                      value={s.fullName ?? s.id}
                      onSelect={() => pickStudent(s)}
                    >
                      <span className="truncate font-medium text-text-primary">
                        {s.fullName ?? "Aluno"}
                      </span>
                    </CommandItem>
                  ))}
              </CommandList>
            </Command>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl bg-bg-card p-5 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-base font-semibold text-text-primary">{composerTitle}</h2>
            <Button variant="ghost" size="sm" onClick={resetToPicker} disabled={sending}>
              Trocar aluno
            </Button>
          </div>

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
            <div className="mt-4 space-y-6">
              {/* --- Aluno + motivo --- */}
              <div>
                <p className="text-base font-semibold text-text-primary">
                  {detail.fullName ?? pickedName ?? "Aluno"}
                </p>
                <p className="mt-0.5 text-sm text-text-secondary">
                  {isManual
                    ? "Mensagem livre — escreva a comunicação abaixo."
                    : (MOTIVO_BY_NUDGE[detail.nudgeType] ?? "Ação de engajamento.")}
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
                <div className="col-span-2">
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
                suggestedBody={
                  isManual
                    ? MANUAL_BODY
                    : (SUGGESTED_BODY[detail.nudgeType] ?? SUGGESTED_BODY.inactive)
                }
                senderOptions={senderOptions}
                channelInapp={true}
                channelEmail={false}
                value={preview}
                onChange={setPreview}
                disabled={sending}
              />

              {/* --- Enviar --- */}
              <div className="flex items-center justify-end gap-2 border-t border-border-subtle pt-4">
                {!canAct && (
                  <p className="mr-auto text-xs text-text-muted">
                    Você não tem permissão para enviar comunicações.
                  </p>
                )}
                <Button
                  onClick={handleSend}
                  disabled={!canAct || sending || preview.message.trim().length === 0}
                >
                  {sending ? (
                    "Enviando..."
                  ) : (
                    <>
                      <Send size={15} /> Enviar
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* --- Rodapé informativo (recorte + reforço da decisão inline) --- */}
      {!studentId && (
        <div className="flex items-center gap-2 rounded-2xl bg-bg-surface p-4 text-xs text-text-muted">
          <CheckCircle2 size={14} className="shrink-0 text-cerrado-600" aria-hidden="true" />
          <span>
            As mensagens são enviadas apenas para alunos do seu recorte. O envio é registrado no
            Histórico.
          </span>
        </div>
      )}
    </div>
  )
}
