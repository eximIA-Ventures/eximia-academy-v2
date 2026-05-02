"use client"

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FormField,
  Input,
} from "@eximia/ui"
import { useCallback, useState, useTransition } from "react"

interface SSOConfigFormProps {
  ssoConfigured: boolean
  tenantId: string
  sessionTimeoutHours?: number
}

export function SSOConfigForm({
  ssoConfigured: initialConfigured,
  tenantId,
  sessionTimeoutHours: initialTimeout = 8,
}: SSOConfigFormProps) {
  const [isPending, startTransition] = useTransition()
  const [configured, setConfigured] = useState(initialConfigured)
  const [feedback, setFeedback] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  // Form state
  const [mode, setMode] = useState<"metadata_url" | "metadata_xml">("metadata_url")
  const [metadataUrl, setMetadataUrl] = useState("")
  const [metadataXml, setMetadataXml] = useState("")
  const [emailAttribute, setEmailAttribute] = useState("email")
  const [ssoDomain, setSsoDomain] = useState("")
  const [sessionTimeout, setSessionTimeout] = useState(initialTimeout)

  const handleSubmit = useCallback(() => {
    setFeedback(null)

    const body =
      mode === "metadata_url"
        ? {
            mode,
            metadata_url: metadataUrl,
            email_attribute: emailAttribute,
            sso_domain: ssoDomain || undefined,
          }
        : {
            mode,
            metadata_xml: metadataXml,
            email_attribute: emailAttribute,
            sso_domain: ssoDomain || undefined,
          }

    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/sso", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const data = await res.json()

        if (!res.ok) {
          setFeedback({
            type: "error",
            message: data.error || "Erro ao configurar SSO",
          })
          return
        }

        setConfigured(true)
        setFeedback({
          type: "success",
          message: "SAML SSO configurado com sucesso!",
        })
      } catch {
        setFeedback({
          type: "error",
          message: "Erro de conexão. Tente novamente.",
        })
      }
    })
  }, [mode, metadataUrl, metadataXml, emailAttribute, ssoDomain])

  const handleRemove = useCallback(() => {
    if (!confirm("Tem certeza que deseja remover a configuração SSO?")) return

    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/sso", { method: "DELETE" })
        if (res.ok) {
          setConfigured(false)
          setFeedback({
            type: "success",
            message: "Configuração SSO removida.",
          })
          setMetadataUrl("")
          setMetadataXml("")
          setSsoDomain("")
        } else {
          const data = await res.json()
          setFeedback({
            type: "error",
            message: data.error || "Erro ao remover SSO",
          })
        }
      } catch {
        setFeedback({ type: "error", message: "Erro de conexão." })
      }
    })
  }, [])

  return (
    <div className="space-y-6">
      {/* Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>SAML SSO</CardTitle>
            <Badge variant={configured ? "success" : "default"} badgeSize="sm">
              {configured ? "SSO Configurado" : "SSO Nao Configurado"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {configured ? (
            <div className="space-y-4">
              <p className="text-sm text-text-secondary">
                SAML SSO está ativo para este tenant. Usuários podem fazer login
                via Identity Provider corporativo.
              </p>
              <Button
                variant="destructive"
                onClick={handleRemove}
                disabled={isPending}
              >
                {isPending ? "Removendo..." : "Remover Configuração SSO"}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <p className="text-sm text-text-secondary">
                Configure SAML SSO para permitir login via Identity Provider
                corporativo (Azure AD, Okta, Google Workspace).
              </p>

              {/* Mode selector */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-text-primary">
                  Metodo de Configuração
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setMode("metadata_url")}
                    className={`rounded-md px-4 py-2 text-sm transition-colors ${
                      mode === "metadata_url"
                        ? "bg-accent-blue-mid text-white"
                        : "bg-bg-surface text-text-secondary hover:bg-bg-card"
                    }`}
                  >
                    Metadata URL (recomendado)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("metadata_xml")}
                    className={`rounded-md px-4 py-2 text-sm transition-colors ${
                      mode === "metadata_xml"
                        ? "bg-accent-blue-mid text-white"
                        : "bg-bg-surface text-text-secondary hover:bg-bg-card"
                    }`}
                  >
                    Metadata XML
                  </button>
                </div>
              </div>

              {/* Metadata input */}
              {mode === "metadata_url" ? (
                <FormField
                  label="Metadata URL"
                  htmlFor="metadata-url"
                >
                  <Input
                    id="metadata-url"
                    type="url"
                    value={metadataUrl}
                    onChange={(e) => setMetadataUrl(e.target.value)}
                    placeholder="https://login.microsoftonline.com/.../federationmetadata.xml"
                    required
                  />
                </FormField>
              ) : (
                <FormField
                  label="Metadata XML"
                  htmlFor="metadata-xml"
                >
                  <textarea
                    id="metadata-xml"
                    value={metadataXml}
                    onChange={(e) => setMetadataXml(e.target.value)}
                    placeholder="<EntityDescriptor xmlns='urn:oasis:names:tc:SAML:2.0:metadata' ..."
                    rows={8}
                    className="w-full rounded-md border border-border-medium bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue-mid focus:outline-none focus:ring-1 focus:ring-accent-blue-mid"
                    required
                  />
                </FormField>
              )}

              {/* Email attribute */}
              <FormField
                label="Atributo de Email"
                htmlFor="email-attribute"
              >
                <Input
                  id="email-attribute"
                  value={emailAttribute}
                  onChange={(e) => setEmailAttribute(e.target.value)}
                  placeholder="email"
                />
              </FormField>

              {/* SSO Domain (optional) */}
              <FormField
                label="Dominio SSO (opcional)"
                htmlFor="sso-domain"
              >
                <Input
                  id="sso-domain"
                  value={ssoDomain}
                  onChange={(e) => setSsoDomain(e.target.value)}
                  placeholder="empresa.com"
                />
              </FormField>

              <Button onClick={handleSubmit} disabled={isPending}>
                {isPending ? "Configurando..." : "Configurar SAML SSO"}
              </Button>
            </div>
          )}

          {feedback && (
            <p
              className={`mt-4 text-sm ${
                feedback.type === "success"
                  ? "text-semantic-success"
                  : "text-semantic-error"
              }`}
            >
              {feedback.message}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Session Timeout */}
      <Card>
        <CardHeader>
          <CardTitle>Timeout de Sessão</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-text-secondary">
            Tempo máximo de sessão para usuários SSO (em horas). Após este
            período, o usuário será desconectado automaticamente.
          </p>
          <div className="flex items-center gap-4">
            <Input
              type="number"
              min={1}
              max={24}
              value={sessionTimeout}
              onChange={(e) =>
                setSessionTimeout(
                  Math.min(24, Math.max(1, Number(e.target.value))),
                )
              }
              className="w-24"
            />
            <span className="text-sm text-text-muted">horas (1-24)</span>
          </div>
          <p className="text-xs text-text-muted">
            Nota: SAML Single Logout (SLO) nao e suportado. O timeout e
            aplicado via verificacao client-side.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
