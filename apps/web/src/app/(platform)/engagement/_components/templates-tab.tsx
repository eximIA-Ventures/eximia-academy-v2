"use client"

// ---------------------------------------------------------------------------
// E9 — Aba Templates.
// ---------------------------------------------------------------------------
// Tenant templates grouped by HUMAN intent (never the raw `key`, report Seção
// 14 / kill list Seção 16). Card: Nome, Intenção, Tom, Canais, Prévia,
// Variáveis, Status, Última edição, Editar. Edit is a Modal → PATCH
// /api/engagement/templates/{id} (admin/manager only; `key` immutable).
//
// Templates are TENANT-wide (not team-scoped): a manager edits templates for
// the WHOLE institution. This is intentional (E9 R1 / RLS nt_write allows
// manager) and surfaced to the user with a visible note.
//
// KNOWN GAPS in the E3 templates route (registered in the Dev Agent Record;
// not fixable here without editing an out-of-boundary route):
//   • GET filters is_active=true → only ACTIVE templates are returned (AC1 asks
//     for active+inactive). Status badge shows "Ativo"; inactive ones can't be
//     listed until the route stops filtering.
//   • GET omits `updated_at` and `is_active` → "Última edição" shows "—" and the
//     edit form cannot toggle is_active (PATCH also doesn't accept it).
// ---------------------------------------------------------------------------

import type { TemplateIntent } from "@/types/notifications"
import {
  Badge,
  Button,
  EmptyState,
  Input,
  Label,
  Modal,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  Select,
  Skeleton,
  Textarea,
  useToast,
} from "@eximia/ui"
import { FileText, Info, Pencil } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import type { TemplatesTabProps } from "./types"

// Human labels for each intent category (E9 AC1/AC2 — never show the raw enum).
const INTENT_LABELS: Record<TemplateIntent, string> = {
  primeiro_acesso: "Primeiro acesso",
  retomada: "Retomada de uso",
  atraso_plano: "Atraso no Plano de Ensino",
  reflexao_pendente: "Reflexão pendente",
  reconhecimento: "Reconhecimento de destaque",
  manual: "Mensagem manual",
}

const INTENT_OPTIONS: TemplateIntent[] = [
  "primeiro_acesso",
  "retomada",
  "atraso_plano",
  "reflexao_pendente",
  "reconhecimento",
  "manual",
]

// --- Template shape returned by GET /api/engagement/templates (E3) ----------

interface Template {
  id: string
  key: string
  name: string
  category: string | null
  channelInapp: boolean
  channelEmail: boolean
  title: string | null
  bodyInapp: string | null
  emailSubject: string | null
  emailHtml: string | null
  variables: string[] | null
  intent: TemplateIntent | null
  tone: string | null
}

// Extract the {{...}} variable tokens declared in the template body/variables.
function extractVariables(t: Template): string[] {
  if (Array.isArray(t.variables) && t.variables.length > 0) return t.variables
  const found = new Set<string>()
  for (const src of [t.bodyInapp, t.title, t.emailSubject]) {
    if (!src) continue
    for (const m of src.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)) found.add(m[1])
  }
  return [...found]
}

export function TemplatesTab({ canEditTemplates, intentOrder }: TemplatesTabProps) {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<Template[] | null>(null)
  const [error, setError] = useState(false)
  const [editing, setEditing] = useState<Template | null>(null)

  const load = useCallback(async () => {
    setError(false)
    try {
      const res = await fetch("/api/engagement/templates")
      if (!res.ok) throw new Error("templates failed")
      const data = (await res.json()) as { templates: Template[] }
      setTemplates(data.templates ?? [])
    } catch {
      setError(true)
      setTemplates([])
    }
  }, [])

  useEffect(() => {
    if (canEditTemplates) void load()
  }, [canEditTemplates, load])

  // Group templates by intent; keep the canonical heading order from the shell.
  const order = intentOrder.length > 0 ? intentOrder : INTENT_OPTIONS
  const byIntent = useMemo(() => {
    const map = new Map<string, Template[]>()
    for (const t of templates ?? []) {
      const key = t.intent ?? "manual"
      const arr = map.get(key) ?? []
      arr.push(t)
      map.set(key, arr)
    }
    return map
  }, [templates])

  // Apply an edit result locally so the list reflects the change without reload.
  const applyEdit = useCallback((updated: Partial<Template> & { id: string }) => {
    setTemplates((prev) =>
      (prev ?? []).map((t) => (t.id === updated.id ? { ...t, ...updated } : t)),
    )
  }, [])

  if (!canEditTemplates) {
    return (
      <EmptyState
        className="rounded-2xl bg-bg-card shadow-card"
        icon={<FileText size={28} />}
        title="Templates indisponíveis"
        description="Apenas gestores e administradores podem ver e editar templates."
      />
    )
  }

  if (error) {
    return (
      <EmptyState
        className="rounded-2xl bg-bg-card shadow-card"
        icon={<FileText size={28} />}
        title="Não foi possível carregar os templates"
        description="Tente novamente em instantes."
        actionLabel="Recarregar"
        onAction={() => void load()}
      />
    )
  }

  if (templates === null) {
    return (
      <div className="space-y-6">
        {order.slice(0, 3).map((intent) => (
          <section key={intent} className="space-y-3">
            <Skeleton className="h-4 w-40" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {[0, 1].map((c) => (
                <div key={c} className="space-y-3 rounded-2xl bg-bg-card p-5 shadow-card">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Decision surfaced to the user (E9 R1): edits are tenant-wide. E12 item 5 +
          Rodada 6 item 6: the banner communicates WHAT is shared, WHO is affected,
          WHEN it takes effect and that it is reversible — now with a clearer visual
          hierarchy (accent rail + card tokens da casa), without changing the
          permission model. */}
      <div className="flex items-start gap-3 rounded-2xl border-l-4 border-cerrado-600 bg-bg-card p-5 shadow-card">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cerrado-600/10 text-cerrado-600"
          aria-hidden="true"
        >
          <Info size={18} />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-text-primary">Templates são compartilhados</p>
          <p className="text-xs leading-relaxed text-text-secondary">
            Estes templates valem para <strong>todos os gestores da instituição</strong>. O que você
            editar aqui passa a ser o texto que qualquer gestor vê e envia, a partir das próximas
            mensagens (comunicações já enviadas não mudam). É reversível: basta editar o template de
            novo.
          </p>
        </div>
      </div>

      {order.map((intent) => {
        const items = byIntent.get(intent) ?? []
        return (
          <section key={intent} className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-text-primary">
                {INTENT_LABELS[intent] ?? intent}
              </h3>
              {items.length > 0 && (
                <span className="rounded-full bg-bg-elevated px-2 py-0.5 text-2xs font-medium text-text-muted">
                  {items.length}
                </span>
              )}
            </div>
            {items.length === 0 ? (
              // Empty state per intent (report Seção 15).
              <div className="rounded-2xl border border-dashed border-border-subtle bg-bg-card/50 px-5 py-4 text-xs text-text-muted">
                Nenhum template configurado para esta intenção.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {items.map((t) => (
                  <TemplateCard key={t.id} template={t} onEdit={() => setEditing(t)} />
                ))}
              </div>
            )}
          </section>
        )
      })}

      {editing && (
        <EditTemplateModal
          template={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            applyEdit(updated)
            setEditing(null)
            toast({ variant: "success", title: "Template atualizado" })
          }}
          onError={(msg) => toast({ variant: "error", title: msg })}
        />
      )}
    </div>
  )
}

// --- Template card (report Seção 14 — 8 campos + Editar) --------------------

function TemplateCard({ template, onEdit }: { template: Template; onEdit: () => void }) {
  const vars = extractVariables(template)
  const channels = [
    template.channelInapp ? "In-app" : null,
    template.channelEmail ? "Email" : null,
  ].filter(Boolean)
  return (
    <div className="flex flex-col gap-3.5 rounded-2xl bg-bg-card p-5 shadow-card ring-1 ring-border-subtle/60 transition-shadow hover:shadow-elevated">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {/* Nome humano em destaque; a key técnica é detalhe secundário (AC3). */}
          <h4 className="truncate text-sm font-semibold text-text-primary">{template.name}</h4>
          <p className="mt-0.5 text-xs text-text-muted">
            {INTENT_LABELS[(template.intent ?? "manual") as TemplateIntent]}
            {template.tone ? ` · ${template.tone}` : ""}
          </p>
        </div>
        <Badge variant="success" badgeSize="sm">
          Ativo
        </Badge>
      </div>

      {template.bodyInapp && (
        <p className="line-clamp-2 rounded-xl bg-bg-surface p-3 text-xs leading-relaxed text-text-secondary">
          {template.bodyInapp}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {channels.map((c) => (
          <Badge key={c as string} variant="info" badgeSize="sm">
            {c}
          </Badge>
        ))}
        {vars.map((v) => (
          <Badge key={v} variant="default" badgeSize="sm">{`{{${v}}}`}</Badge>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-border-subtle/70 pt-3">
        {/* Última edição: rota não retorna updated_at (lacuna documentada). */}
        <span className="text-2xs text-text-muted" title={`key: ${template.key}`}>
          Última edição: —
        </span>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil size={14} /> Editar
        </Button>
      </div>
    </div>
  )
}

// --- Edit modal (PATCH /api/engagement/templates/{id}) ----------------------

function EditTemplateModal({
  template,
  onClose,
  onSaved,
  onError,
}: {
  template: Template
  onClose: () => void
  onSaved: (updated: Partial<Template> & { id: string }) => void
  onError: (msg: string) => void
}) {
  const [name, setName] = useState(template.name)
  const [tone, setTone] = useState(template.tone ?? "")
  const [intent, setIntent] = useState<TemplateIntent>(
    (template.intent ?? "manual") as TemplateIntent,
  )
  const [bodyInapp, setBodyInapp] = useState(template.bodyInapp ?? "")
  const [emailSubject, setEmailSubject] = useState(template.emailSubject ?? "")
  const [emailHtml, setEmailHtml] = useState(template.emailHtml ?? "")
  const [saving, setSaving] = useState(false)

  const save = useCallback(async () => {
    if (!name.trim()) {
      onError("O nome do template é obrigatório")
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/engagement/templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // `key` is intentionally never sent — it is immutable (E9 AC4).
        body: JSON.stringify({
          name: name.trim(),
          tone: tone.trim() || null,
          intent,
          body_inapp: bodyInapp || null,
          email_subject: emailSubject || null,
          email_html: emailHtml || null,
        }),
      })
      const data = (await res.json()) as { template?: { id: string }; error?: string }
      if (!res.ok || !data.template) {
        onError(data.error ?? "Falha ao salvar o template")
        return
      }
      onSaved({
        id: template.id,
        name: name.trim(),
        tone: tone.trim() || null,
        intent,
        bodyInapp: bodyInapp || null,
        emailSubject: emailSubject || null,
        emailHtml: emailHtml || null,
      })
    } catch {
      onError("Falha ao salvar o template")
    } finally {
      setSaving(false)
    }
  }, [name, tone, intent, bodyInapp, emailSubject, emailHtml, template.id, onSaved, onError])

  return (
    <Modal open onOpenChange={(o) => !o && onClose()}>
      <ModalContent className="max-w-lg">
        <ModalHeader>
          <ModalTitle>Editar template</ModalTitle>
        </ModalHeader>

        {/* Point-of-action reminder (E12 item 5): the manager is about to change a
            text every gestor uses. Kept short and factual, not alarming. */}
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-cerrado-600/10 px-3 py-2 text-xs text-text-secondary ring-1 ring-cerrado-600/20">
          <Info size={14} className="mt-0.5 shrink-0 text-cerrado-600" aria-hidden="true" />
          <span>
            Esta edição vale para toda a instituição e passa a valer nas próximas mensagens. É
            reversível.
          </span>
        </p>

        <div className="mt-4 space-y-4">
          {/* key exibida somente-leitura, nunca editável (AC4). */}
          <div className="space-y-1.5">
            <Label htmlFor="tpl-key">Chave técnica (somente leitura)</Label>
            <Input id="tpl-key" value={template.key} readOnly disabled />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tpl-name">Nome</Label>
            <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-intent">Intenção</Label>
              <Select
                id="tpl-intent"
                value={intent}
                onChange={(e) => setIntent(e.target.value as TemplateIntent)}
              >
                {INTENT_OPTIONS.map((i) => (
                  <option key={i} value={i}>
                    {INTENT_LABELS[i]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-tone">Tom</Label>
              <Input
                id="tpl-tone"
                value={tone}
                placeholder="ex.: Leve e institucional"
                onChange={(e) => setTone(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tpl-body">Mensagem in-app</Label>
            <Textarea
              id="tpl-body"
              rows={3}
              value={bodyInapp}
              onChange={(e) => setBodyInapp(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tpl-subject">Assunto do email</Label>
            <Input
              id="tpl-subject"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tpl-email">Corpo do email (HTML)</Label>
            <Textarea
              id="tpl-email"
              rows={3}
              value={emailHtml}
              onChange={(e) => setEmailHtml(e.target.value)}
            />
          </div>
        </div>

        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button isLoading={saving} onClick={() => void save()}>
            Salvar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
