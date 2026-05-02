"use client"

import {
  type TenantSettingsPayload,
  saveTenantSettings,
} from "@/app/(platform)/admin/settings/actions"
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  Toggle,
} from "@eximia/ui"
import { Save } from "lucide-react"
import { useCallback, useState, useTransition } from "react"
import { BrandingPreview } from "./branding-preview"
import { ColorPicker } from "./color-picker"
import { LogoUpload } from "./logo-upload"

interface TenantForForm {
  id: string
  name: string
  branding: {
    logo_url?: string
    primary_color?: string
    secondary_color?: string
  }
  settings: {
    max_interactions_per_session?: number
    ai_model?: string
    features?: {
      ai_detection?: boolean
      learning_journal?: boolean
      certificates?: boolean
      analytics_dashboard?: boolean
    }
  }
}

interface TenantSettingsFormProps {
  tenant: TenantForForm
}

import { AI_MODEL_OPTIONS } from "@/lib/constants/models"

const AI_MODELS = AI_MODEL_OPTIONS

export function TenantSettingsForm({ tenant }: TenantSettingsFormProps) {
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  )

  // Form state
  const [name, setName] = useState(tenant.name)
  const [logoUrl, setLogoUrl] = useState(tenant.branding.logo_url || "")
  const [primaryColor, setPrimaryColor] = useState(tenant.branding.primary_color || "#2a6ab0")
  const [secondaryColor, setSecondaryColor] = useState(tenant.branding.secondary_color || "#1e1e1e")
  const [maxInteractions, setMaxInteractions] = useState(
    tenant.settings.max_interactions_per_session ?? 3,
  )
  const [aiModel, setAiModel] = useState(tenant.settings.ai_model || "claude-sonnet-4-5")
  const [enrollmentMode, setEnrollmentMode] = useState<"open" | "assigned">(
    (tenant.settings as Record<string, unknown>).enrollment_mode === "assigned" ? "assigned" : "open",
  )
  const [features, setFeatures] = useState({
    ai_detection: tenant.settings.features?.ai_detection ?? false,
    learning_journal: tenant.settings.features?.learning_journal ?? false,
    certificates: tenant.settings.features?.certificates ?? false,
    analytics_dashboard: tenant.settings.features?.analytics_dashboard ?? true,
  })

  const toggleFeature = useCallback((key: keyof typeof features) => {
    setFeatures((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const handleSubmit = useCallback(() => {
    setFeedback(null)
    const payload: TenantSettingsPayload = {
      name,
      branding: {
        logo_url: logoUrl || undefined,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
      },
      settings: {
        max_interactions_per_session: maxInteractions,
        ai_model: aiModel as "claude-sonnet-4-5" | "claude-haiku-4-5" | "claude-opus-4" | "gpt-4o" | "gpt-4o-mini",
        enrollment_mode: enrollmentMode,
        features,
      },
    }

    startTransition(async () => {
      const result = await saveTenantSettings(payload)
      if (result.error) {
        setFeedback({ type: "error", message: result.error })
      } else {
        setFeedback({ type: "success", message: "Configurações salvas com sucesso!" })
        setTimeout(() => setFeedback(null), 3000)
      }
    })
  }, [name, logoUrl, primaryColor, secondaryColor, maxInteractions, aiModel, enrollmentMode, features])

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      {/* Form */}
      <div className="space-y-6">
        {/* Section 1: Branding */}
        <Card>
          <CardHeader>
            <CardTitle>Branding</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="tenant-name">Nome da Instituição</Label>
              <Input
                id="tenant-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome da instituição"
              />
            </div>

            <LogoUpload
              tenantId={tenant.id}
              currentUrl={tenant.branding.logo_url}
              onUpload={setLogoUrl}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <ColorPicker label="Cor Primária" value={primaryColor} onChange={setPrimaryColor} />
              <ColorPicker
                label="Cor Secundária"
                value={secondaryColor}
                onChange={setSecondaryColor}
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 2: AI Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Configurações de IA</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Max interactions slider */}
            <div className="space-y-3">
              <Label>Interações por sessão: {maxInteractions}</Label>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={maxInteractions}
                onChange={(e) => setMaxInteractions(Number(e.target.value))}
                className="w-full accent-accent-blue-mid"
              />
              <div className="flex justify-between text-xs text-text-muted">
                <span>1</span>
                <span>2</span>
                <span>3</span>
                <span>4</span>
                <span>5</span>
              </div>
            </div>

            {/* AI Model */}
            <div className="space-y-2">
              <Label htmlFor="ai-model">Modelo de IA</Label>
              <Select id="ai-model" value={aiModel} onChange={(e) => setAiModel(e.target.value)}>
                {AI_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Enrollment Mode */}
        <Card>
          <CardHeader>
            <CardTitle>Modo de Inscrição</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-text-muted">
              Define como os alunos acessam os cursos neste tenant.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setEnrollmentMode("open")}
                className={`rounded-md border p-4 text-left transition-all ${
                  enrollmentMode === "open"
                    ? "border-accent-blue-mid bg-accent-blue-mid/5 ring-1 ring-accent-blue-mid/30"
                    : "border-border-primary hover:border-border-medium"
                }`}
              >
                <p className="text-sm font-medium text-text-primary">Aberto</p>
                <p className="mt-1 text-xs text-text-muted">
                  Alunos veem todos os cursos publicados e se inscrevem livremente.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setEnrollmentMode("assigned")}
                className={`rounded-md border p-4 text-left transition-all ${
                  enrollmentMode === "assigned"
                    ? "border-accent-blue-mid bg-accent-blue-mid/5 ring-1 ring-accent-blue-mid/30"
                    : "border-border-primary hover:border-border-medium"
                }`}
              >
                <p className="text-sm font-medium text-text-primary">Atribuído</p>
                <p className="mt-1 text-xs text-text-muted">
                  Alunos só veem cursos atribuídos a eles pelo gestor.
                </p>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Feature Flags */}
        <Card>
          <CardHeader>
            <CardTitle>Funcionalidades</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(
              [
                {
                  key: "ai_detection" as const,
                  label: "Detecção de IA",
                  desc: "Analisa respostas dos alunos para detectar uso de IA",
                },
                {
                  key: "learning_journal" as const,
                  label: "Diário de Aprendizagem",
                  desc: "Registro de reflexões dos alunos (em breve)",
                },
                {
                  key: "certificates" as const,
                  label: "Certificados",
                  desc: "Emissão de certificados automáticos (em breve)",
                },
                {
                  key: "analytics_dashboard" as const,
                  label: "Dashboard de Analytics",
                  desc: "Métricas avançadas para gestores",
                },
              ] as const
            ).map((feature) => (
              <div key={feature.key} className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-text-primary">{feature.label}</p>
                  <p className="text-xs text-text-muted">{feature.desc}</p>
                </div>
                <Toggle
                  checked={features[feature.key]}
                  onCheckedChange={() => toggleFeature(feature.key)}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex items-center gap-4">
          <Button onClick={handleSubmit} disabled={isPending}>
            <Save size={16} />
            {isPending ? "Salvando..." : "Salvar Configurações"}
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

      {/* Preview sidebar */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <BrandingPreview
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
          logoUrl={logoUrl || undefined}
          tenantName={name}
        />
      </div>
    </div>
  )
}
