"use client"

import { saveWhitelabelConfig } from "@/app/(platform)/admin/settings/whitelabel-actions"
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
} from "@eximia/ui"
import { RotateCcw, Save } from "lucide-react"
import { useEffect, useRef, useState, useTransition } from "react"
import { WhitelabelPreview } from "./whitelabel-preview"

interface WhitelabelSettingsFormProps {
  tenantId: string
  whitelabelConfig: Record<string, unknown>
}

export function WhitelabelSettingsForm({
  tenantId,
  whitelabelConfig,
}: WhitelabelSettingsFormProps) {
  const [isPending, startTransition] = useTransition()
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [feedback, setFeedback] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    }
  }, [])

  const customTexts =
    (whitelabelConfig.custom_texts as Record<string, string>) || {}

  const [appName, setAppName] = useState(customTexts.app_name || "")
  const [tagline, setTagline] = useState(customTexts.tagline || "")
  const [loginTitle, setLoginTitle] = useState(customTexts.login_title || "")
  const [loginSubtitle, setLoginSubtitle] = useState(
    customTexts.login_subtitle || "",
  )
  const [faviconUrl, setFaviconUrl] = useState(
    typeof whitelabelConfig.favicon_url === "string"
      ? whitelabelConfig.favicon_url
      : "",
  )
  const [footerText, setFooterText] = useState(
    typeof whitelabelConfig.footer_text === "string"
      ? whitelabelConfig.footer_text
      : "",
  )
  const [supportEmail, setSupportEmail] = useState(
    typeof whitelabelConfig.support_email === "string"
      ? whitelabelConfig.support_email
      : "",
  )

  function isValidHttpsUrl(url: string) {
    try {
      const parsed = new URL(url)
      return parsed.protocol === "https:"
    } catch {
      return false
    }
  }

  function handleSubmit() {
    setFeedback(null)
    startTransition(async () => {
      const result = await saveWhitelabelConfig({
        custom_texts: {
          app_name: appName || undefined,
          tagline: tagline || undefined,
          login_title: loginTitle || undefined,
          login_subtitle: loginSubtitle || undefined,
        },
        favicon_url: faviconUrl || null,
        footer_text: footerText || undefined,
        support_email: supportEmail || undefined,
      })
      if (result.error) {
        setFeedback({ type: "error", message: result.error })
      } else {
        setFeedback({
          type: "success",
          message: "Configurações whitelabel salvas!",
        })
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
        feedbackTimerRef.current = setTimeout(() => setFeedback(null), 3000)
      }
    })
  }

  function handleReset() {
    setAppName("")
    setTagline("")
    setLoginTitle("")
    setLoginSubtitle("")
    setFaviconUrl("")
    setFooterText("")
    setSupportEmail("")
    setFeedback(null)
    startTransition(async () => {
      const result = await saveWhitelabelConfig({})
      if (result.error) {
        setFeedback({ type: "error", message: result.error })
      } else {
        setFeedback({
          type: "success",
          message: "Configurações resetadas para o padrão!",
        })
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
        feedbackTimerRef.current = setTimeout(() => setFeedback(null), 3000)
      }
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        {/* Custom Texts */}
        <Card>
          <CardHeader>
            <CardTitle>Textos Personalizados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wl-app-name">Nome do App</Label>
              <Input
                id="wl-app-name"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder="exímIA Academy"
                maxLength={100}
              />
              <p className="text-xs text-text-muted">
                {appName.length}/100 caracteres
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wl-tagline">Tagline</Label>
              <Input
                id="wl-tagline"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Aprendizado potencializado por IA"
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wl-login-title">Titulo da Tela de Login</Label>
              <Input
                id="wl-login-title"
                value={loginTitle}
                onChange={(e) => setLoginTitle(e.target.value)}
                placeholder="Bem-vindo"
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wl-login-subtitle">
                Subtitulo da Tela de Login
              </Label>
              <Textarea
                id="wl-login-subtitle"
                value={loginSubtitle}
                onChange={(e) => setLoginSubtitle(e.target.value)}
                placeholder="Faca login para acessar a plataforma"
                maxLength={200}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Footer & Contact */}
        <Card>
          <CardHeader>
            <CardTitle>Rodape e Contato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wl-footer">Texto do Rodape</Label>
              <Input
                id="wl-footer"
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                placeholder="© 2026 Sua Empresa. Todos os direitos reservados."
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wl-support-email">Email de Suporte</Label>
              <Input
                id="wl-support-email"
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                placeholder="suporte@suaempresa.com"
              />
            </div>
          </CardContent>
        </Card>

        {/* Favicon */}
        <Card>
          <CardHeader>
            <CardTitle>Favicon</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wl-favicon">URL do Favicon</Label>
              <Input
                id="wl-favicon"
                type="url"
                value={faviconUrl}
                onChange={(e) => setFaviconUrl(e.target.value)}
                placeholder="https://example.com/favicon.ico"
              />
              <p className="text-xs text-text-muted">
                Formatos aceitos: .ico, .png, .svg
              </p>
            </div>
            {faviconUrl && isValidHttpsUrl(faviconUrl) && (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md shadow-card bg-bg-surface">
                  <img
                    src={faviconUrl}
                    alt="Favicon preview"
                    className="h-6 w-6"
                  />
                </div>
                <p className="text-xs text-text-secondary">
                  Preview do favicon
                </p>
              </div>
            )}
            {faviconUrl && !isValidHttpsUrl(faviconUrl) && (
              <p className="text-xs text-semantic-error">
                URL deve usar HTTPS
              </p>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <Button onClick={handleSubmit} disabled={isPending}>
            <Save size={16} />
            {isPending ? "Salvando..." : "Salvar Whitelabel"}
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={isPending}>
            <RotateCcw size={16} />
            Resetar para Padrao
          </Button>
          {feedback && (
            <p
              className={`text-sm ${feedback.type === "success" ? "text-semantic-success" : "text-semantic-error"}`}
            >
              {feedback.message}
            </p>
          )}
        </div>
      </div>

      {/* Preview */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <WhitelabelPreview
          appName={appName}
          tagline={tagline}
          loginTitle={loginTitle}
          loginSubtitle={loginSubtitle}
          footerText={footerText}
          faviconUrl={faviconUrl}
        />
      </div>
    </div>
  )
}
