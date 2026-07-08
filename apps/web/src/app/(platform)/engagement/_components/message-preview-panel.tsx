"use client"

// ---------------------------------------------------------------------------
// Shared message composer — origin selector + editable preview + channel.
// ---------------------------------------------------------------------------
// Materialized by E6 and REUSED by E5 (per the stories' coordination note: one
// owner, no triplication). It renders:
//   • the "Origem da mensagem" selector with the EXACT Section 8 UI text,
//   • the EDITABLE preview textarea (the final text is what gets dispatched via
//     the `message` override — E3 action route),
//   • the channel indicator (only offered if the template supports it).
//
// AC6 (E6) — non-destructive origin switch: changing the origin rewrites the
// SUGGESTED base body's salutation, but NEVER clobbers text the manager already
// edited by hand. We track whether the textarea still holds the untouched
// suggestion (`isPristine`); once the manager types, switching origin only
// updates the *base* it would offer, and we ask before overwriting a dirty
// edit. See `handleOriginChange`.
// ---------------------------------------------------------------------------

import type { SenderIdentity } from "@/types/notifications"
import { Label, RadioGroup, RadioItem, Textarea } from "@eximia/ui"
import { useCallback, useMemo, useState } from "react"
import type { SenderIdentityOptions } from "./types"

export type PreviewChannel = "inapp" | "email"

export interface MessagePreviewValue {
  identity: SenderIdentity
  /** The FINAL text (possibly hand-edited) that will be dispatched as `message`. */
  message: string
  channel: PreviewChannel
}

export interface MessagePreviewPanelProps {
  /** First name of the recipient, used to build the suggested greeting/body. */
  recipientFirstName: string
  /** The suggested body (template-derived), WITHOUT the origin greeting. */
  suggestedBody: string
  senderOptions: SenderIdentityOptions
  /** Which channels the resolved template supports (E6 Dev Notes). */
  channelInapp: boolean
  channelEmail: boolean
  /** Controlled value + change, so the parent (Sheet/Card) owns dispatch. */
  value: MessagePreviewValue
  onChange: (value: MessagePreviewValue) => void
  disabled?: boolean
}

/**
 * Builds the origin-aware suggested message, mirroring engine.renderWithOrigin
 * (server) so the client preview matches what will actually be sent:
 *   • manager  → "Olá, {first}. Aqui é {senderName}.\n\n{body}"
 *   • platform → "Olá, {first}. A exímIA Academy percebeu o seguinte:\n\n{body}"
 */
export function buildSuggestedMessage(
  identity: SenderIdentity,
  firstName: string,
  senderName: string | null,
  body: string,
): string {
  const first = firstName || "aluno"
  const trimmed = body.trim()
  if (identity === "manager") {
    const who = (senderName ?? "").trim()
    const greeting = who ? `Olá, ${first}. Aqui é ${who}.` : `Olá, ${first}.`
    return `${greeting}\n\n${trimmed}`
  }
  return `Olá, ${first}. A exímIA Academy percebeu o seguinte:\n\n${trimmed}`
}

export function MessagePreviewPanel({
  recipientFirstName,
  suggestedBody,
  senderOptions,
  channelInapp,
  channelEmail,
  value,
  onChange,
  disabled,
}: MessagePreviewPanelProps) {
  // The message the CURRENT origin would suggest (before any hand edits).
  const suggestedForIdentity = useCallback(
    (identity: SenderIdentity) =>
      buildSuggestedMessage(identity, recipientFirstName, senderOptions.managerName, suggestedBody),
    [recipientFirstName, senderOptions.managerName, suggestedBody],
  )

  // isPristine — the textarea still holds exactly what the current origin
  // suggested (the manager has not typed over it). AC6 keys off this.
  const isPristine = useMemo(
    () => value.message.trim() === suggestedForIdentity(value.identity).trim(),
    [value.message, value.identity, suggestedForIdentity],
  )

  const [confirmingOverwrite, setConfirmingOverwrite] = useState<SenderIdentity | null>(null)

  // The manager can only sign AS the manager when a manager name exists.
  const managerOptionAvailable = senderOptions.managerName != null

  function applyOrigin(nextIdentity: SenderIdentity) {
    onChange({ ...value, identity: nextIdentity, message: suggestedForIdentity(nextIdentity) })
    setConfirmingOverwrite(null)
  }

  function handleOriginChange(next: string) {
    const nextIdentity: SenderIdentity = next === "manager" ? "manager" : "platform"
    if (nextIdentity === value.identity) return
    if (isPristine) {
      // Untouched suggestion → rewrite the salutation freely (AC6).
      applyOrigin(nextIdentity)
    } else {
      // Manager already edited by hand → do NOT clobber. Ask first (AC6):
      // keep their edit, only switch the identity flag, and offer to re-apply
      // the suggested template for the new origin explicitly.
      onChange({ ...value, identity: nextIdentity })
      setConfirmingOverwrite(nextIdentity)
    }
  }

  const channelLabel = value.channel === "email" ? "E-mail" : "Notificação no app"
  const bothChannels = channelInapp && channelEmail

  return (
    <div className="space-y-4">
      {/* --- Origem da mensagem (Seção 8, texto EXATO) --- */}
      <fieldset className="space-y-2">
        <Label className="text-sm font-medium text-text-primary">Origem da mensagem</Label>
        <p className="text-xs text-text-muted">Escolha como o aluno verá esta comunicação.</p>
        <RadioGroup
          value={value.identity}
          onValueChange={handleOriginChange}
          disabled={disabled}
          className="mt-1 gap-2"
        >
          {managerOptionAvailable && (
            <RadioItem value="manager">{`${senderOptions.managerName}, gestor do time`}</RadioItem>
          )}
          <RadioItem value="platform">exímIA Academy</RadioItem>
        </RadioGroup>
      </fieldset>

      {confirmingOverwrite && (
        <div className="rounded-lg bg-semantic-warning/10 p-3 text-xs text-text-secondary ring-1 ring-semantic-warning/30">
          <p>Você já editou esta mensagem. A origem foi trocada, mas seu texto foi preservado.</p>
          <button
            type="button"
            className="mt-2 font-semibold text-cerrado-600 hover:underline"
            onClick={() => applyOrigin(confirmingOverwrite)}
          >
            Aplicar o texto sugerido para esta origem (descarta minhas edições)
          </button>
        </div>
      )}

      {/* --- Prévia da mensagem (editável) --- */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-text-primary">Prévia da mensagem</Label>
        <Textarea
          value={value.message}
          onChange={(e) => onChange({ ...value, message: e.target.value })}
          rows={7}
          disabled={disabled}
          aria-label="Prévia da mensagem"
          className="resize-y"
        />
        <p className="text-[11px] text-text-muted">
          O texto acima é exatamente o que o aluno receberá. Edite à vontade.
        </p>
      </div>

      {/* --- Canal --- */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-text-primary">Canal</Label>
        {bothChannels ? (
          <RadioGroup
            value={value.channel}
            onValueChange={(c) =>
              onChange({ ...value, channel: c === "email" ? "email" : "inapp" })
            }
            disabled={disabled}
            className="flex-row gap-4"
          >
            <RadioItem value="inapp">Notificação no app</RadioItem>
            <RadioItem value="email">E-mail</RadioItem>
          </RadioGroup>
        ) : (
          <p className="text-sm text-text-secondary">{channelLabel}</p>
        )}
      </div>
    </div>
  )
}
