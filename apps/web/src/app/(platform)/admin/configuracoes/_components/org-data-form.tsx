"use client"

import { saveTenantSettings } from "@/app/(platform)/admin/settings/actions"
import { BrandingPreview } from "@/components/admin/branding-preview"
import { ColorPicker } from "@/components/admin/color-picker"
import { LogoUpload } from "@/components/admin/logo-upload"
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@eximia/ui"
import { RotateCcw, Save } from "lucide-react"
import { useEffect, useRef, useState, useTransition } from "react"

interface OrgDataFormProps {
  tenantId: string
  initialName: string
  initialLogoUrl?: string
  initialPrimaryColor: string
  initialSecondaryColor: string
}

/**
 * "Dados da organização" — o único item das 5 seções vivas que não tinha tela.
 *
 * Não é tela nova inventada: liga os 3 componentes que já existiam órfãos
 * (`LogoUpload`, `ColorPicker`, `BrandingPreview`, hoje referenciados só pelos
 * próprios testes) ao server action `saveTenantSettings`, que já existia,
 * validava e gravava audit log `settings.updated` — e não tinha um único caller
 * no repo. Nenhuma coluna nova, nenhuma migration.
 */
export function OrgDataForm({
  tenantId,
  initialName,
  initialLogoUrl,
  initialPrimaryColor,
  initialSecondaryColor,
}: OrgDataFormProps) {
  const [isPending, startTransition] = useTransition()
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  )

  const [name, setName] = useState(initialName)
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl ?? "")
  const [primaryColor, setPrimaryColor] = useState(initialPrimaryColor)
  const [secondaryColor, setSecondaryColor] = useState(initialSecondaryColor)

  /**
   * CFG-5.1 (AC1) — achado do teste de Descartar.
   *
   * `ColorPicker` e `LogoUpload` são meio-controlados: recebem `value`/
   * `currentUrl`, mas SEMEIAM estado local com eles uma única vez
   * (`useState(value)` / `useState(currentUrl || null)`) e nunca ressincronizam
   * quando o pai muda. Resultado observado: "Descartar" revertia o estado real
   * do form (e o preview), enquanto o campo hexadecimal e a miniatura do logo
   * continuavam mostrando o rascunho descartado. A tela passava a MENTIR — quem
   * clicasse Salvar em seguida gravaria a cor original vendo a cor rascunhada.
   *
   * Este token remonta os dois filhos no descarte, que é quando (e só quando) o
   * pai reescreve o estado por fora. É o menor conserto possível: nenhum dos
   * dois componentes compartilhados muda de contrato — e o `ColorPicker`
   * PRECISA do estado local para não ter o "#ff" intermediário da digitação
   * atropelado pelo pai, comportamento que os testes dele já guardam.
   */
  const [resetToken, setResetToken] = useState(0)

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    }
  }, [])

  function flash(type: "success" | "error", message: string) {
    setFeedback({ type, message })
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    feedbackTimerRef.current = setTimeout(() => setFeedback(null), 4000)
  }

  function handleDiscard() {
    setName(initialName)
    setLogoUrl(initialLogoUrl ?? "")
    setPrimaryColor(initialPrimaryColor)
    setSecondaryColor(initialSecondaryColor)
    setFeedback(null)
    setResetToken((token) => token + 1)
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveTenantSettings({
        name: name.trim(),
        branding: {
          logo_url: logoUrl,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
        },
      })

      if (result?.error) {
        flash("error", result.error)
        return
      }
      flash("success", "Dados da organização salvos.")
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Identificação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Nome da organização</Label>
            <Input
              id="org-name"
              value={name}
              maxLength={200}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Identidade visual</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <LogoUpload
              key={`logo-${resetToken}`}
              tenantId={tenantId}
              currentUrl={logoUrl}
              onUpload={setLogoUrl}
            />
            <ColorPicker
              key={`primaria-${resetToken}`}
              label="Cor primária"
              value={primaryColor}
              onChange={setPrimaryColor}
            />
            <ColorPicker
              key={`secundaria-${resetToken}`}
              label="Cor secundária"
              value={secondaryColor}
              onChange={setSecondaryColor}
            />
          </div>

          <BrandingPreview
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            logoUrl={logoUrl || undefined}
            tenantName={name}
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleSave} disabled={isPending || name.trim().length === 0}>
          <Save size={16} />
          {isPending ? "Salvando..." : "Salvar"}
        </Button>
        <Button variant="outline" onClick={handleDiscard} disabled={isPending}>
          <RotateCcw size={16} />
          Descartar
        </Button>

        {feedback && (
          <output
            className={`text-sm ${feedback.type === "success" ? "text-varzea" : "text-red-500"}`}
          >
            {feedback.message}
          </output>
        )}
      </div>
    </div>
  )
}
