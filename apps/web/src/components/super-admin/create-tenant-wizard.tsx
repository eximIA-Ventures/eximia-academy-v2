"use client"

import { slugify } from "@/lib/utils/slugify"
import { createTenantSchema } from "@eximia/shared"
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FormField,
  Input,
  RadioGroup,
  RadioItem,
  Select,
  useToast,
} from "@eximia/ui"
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"

/* --------------------------------- Types --------------------------------- */

interface WizardState {
  // Step 1
  name: string
  slug: string
  plan: "essencial" | "standard" | "premium"
  // Step 2
  logo_url: string
  primary_color: string
  secondary_color: string
  ai_model: string
  max_interactions: number
  // Step 3
  manager_email: string
  manager_name: string
  manager_role: "admin" | "manager"
}

/* -------------------------------- Helpers -------------------------------- */

const AI_MODELS = [
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { value: "claude-haiku-4-20250514", label: "Claude Haiku 4" },
]

const STEPS = ["Dados da Empresa", "Configurações", "Gestor Inicial"]

/* -------------------------------- Component ------------------------------- */

export function CreateTenantWizard() {
  const router = useRouter()
  const { toast } = useToast()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [state, setState] = useState<WizardState>({
    name: "",
    slug: "",
    plan: "essencial",
    logo_url: "",
    primary_color: "#2a6ab0",
    secondary_color: "#1e1e1e",
    ai_model: "gpt-4o-mini",
    max_interactions: 3,
    manager_email: "",
    manager_name: "",
    manager_role: "admin",
  })

  const updateField = useCallback(
    <K extends keyof WizardState>(key: K, value: WizardState[K]) => {
      setState((prev) => {
        const next = { ...prev, [key]: value }
        // Auto-generate slug from name
        if (key === "name" && typeof value === "string") {
          next.slug = slugify(value)
        }
        return next
      })
      setErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    },
    [],
  )

  function validateStep(): boolean {
    const newErrors: Record<string, string> = {}

    if (step === 0) {
      if (!state.name.trim()) newErrors.name = "Nome obrigatório"
      if (!state.slug.trim()) newErrors.slug = "Slug obrigatório"
      else if (state.slug.length < 3) newErrors.slug = "Slug deve ter no mínimo 3 caracteres"
      else if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(state.slug) && state.slug.length > 2)
        newErrors.slug = "Slug deve conter apenas letras minúsculas, números e hífens"
    }

    if (step === 2) {
      if (state.manager_email && !state.manager_name.trim()) {
        newErrors.manager_name = "Nome do gestor obrigatório quando email informado"
      }
      if (state.manager_name && !state.manager_email.trim()) {
        newErrors.manager_email = "Email do gestor obrigatório quando nome informado"
      }
      if (state.manager_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.manager_email)) {
        newErrors.manager_email = "Email inválido"
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function handleNext() {
    if (!validateStep()) return
    setStep((prev) => Math.min(prev + 1, 2))
  }

  function handleBack() {
    setStep((prev) => Math.max(prev - 1, 0))
  }

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)

    if (!validateStep()) {
      setSubmitting(false)
      return
    }

    // Build payload
    const payload: Record<string, unknown> = {
      name: state.name,
      slug: state.slug,
      plan: state.plan,
      branding: {
        ...(state.logo_url ? { logo_url: state.logo_url } : {}),
        primary_color: state.primary_color,
        secondary_color: state.secondary_color,
      },
      settings: {
        ai_model: state.ai_model,
        max_interactions_per_session: state.max_interactions,
      },
    }

    if (state.manager_email && state.manager_name) {
      payload.initial_manager = {
        email: state.manager_email,
        full_name: state.manager_name,
        role: state.manager_role,
      }
    }

    // Validate with shared schema
    const parsed = createTenantSchema.safeParse(payload)
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}
      for (const err of parsed.error.errors) {
        const key = err.path.join(".")
        fieldErrors[key] = err.message
      }
      setErrors(fieldErrors)
      toast({ title: "Erro de validacao", description: "Verifique os campos.", variant: "error" })
      return
    }

    try {
      const res = await fetch("/api/super-admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      })

      const json = await res.json()

      if (!res.ok) {
        const message = typeof json.error === "string" ? json.error : "Erro ao criar empresa."
        toast({ title: "Erro", description: message, variant: "error" })
        return
      }

      if (json.warning) {
        toast({ title: "Aviso", description: json.warning, variant: "warning" })
      } else {
        toast({ title: "Sucesso", description: "Empresa criada com sucesso!", variant: "success" })
      }

      router.push(`/super-admin/tenants/${json.data.id}`)
    } catch {
      toast({ title: "Erro", description: "Falha na conexão.", variant: "error" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                i <= step
                  ? "bg-accent-blue-mid text-white"
                  : "bg-bg-surface text-text-muted"
              }`}
            >
              {i < step ? <Check size={14} /> : i + 1}
            </div>
            <span
              className={`text-xs ${
                i <= step ? "text-text-primary" : "text-text-muted"
              } hidden sm:inline`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div className="h-px w-8 bg-border-medium" />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <Card>
        <CardHeader>
          <CardTitle>{STEPS[step]}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 0 && (
            <>
              <FormField label="Nome da Empresa" error={errors.name}>
                <Input
                  placeholder="Ex: Acme Corp"
                  value={state.name}
                  onChange={(e) => updateField("name", e.target.value)}
                />
              </FormField>

              <FormField label="Slug (URL)" error={errors.slug}>
                <Input
                  placeholder="acme-corp"
                  value={state.slug}
                  onChange={(e) => updateField("slug", e.target.value)}
                />
                <p className="text-xs text-text-muted mt-1">
                  Sera usado na URL: academy.eximiaventures.com.br/<span className="text-text-secondary">{state.slug || "slug"}</span>
                </p>
              </FormField>

              <FormField label="Plano">
                <Select
                  value={state.plan}
                  onChange={(e) => updateField("plan", e.target.value as WizardState["plan"])}
                >
                  <option value="essencial">Essencial</option>
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                </Select>
              </FormField>
            </>
          )}

          {step === 1 && (
            <>
              <FormField label="URL do Logo (opcional)">
                <Input
                  placeholder="https://exemplo.com/logo.png"
                  value={state.logo_url}
                  onChange={(e) => updateField("logo_url", e.target.value)}
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Cor Primaria">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={state.primary_color}
                      onChange={(e) => updateField("primary_color", e.target.value)}
                      className="h-10 w-10 cursor-pointer rounded border border-border-medium bg-transparent"
                    />
                    <Input
                      value={state.primary_color}
                      onChange={(e) => updateField("primary_color", e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </FormField>

                <FormField label="Cor Secundaria">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={state.secondary_color}
                      onChange={(e) => updateField("secondary_color", e.target.value)}
                      className="h-10 w-10 cursor-pointer rounded border border-border-medium bg-transparent"
                    />
                    <Input
                      value={state.secondary_color}
                      onChange={(e) => updateField("secondary_color", e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </FormField>
              </div>

              <FormField label="Modelo de IA">
                <Select
                  value={state.ai_model}
                  onChange={(e) => updateField("ai_model", e.target.value)}
                >
                  {AI_MODELS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label={`Interacoes por Sessao: ${state.max_interactions}`}>
                <input
                  type="range"
                  min={1}
                  max={20}
                  step={1}
                  value={state.max_interactions}
                  onChange={(e) => updateField("max_interactions", Number(e.target.value))}
                  className="w-full accent-accent-blue-mid"
                />
                <div className="flex justify-between text-xs text-text-muted mt-1">
                  <span>1</span>
                  <span>5</span>
                  <span>10</span>
                  <span>15</span>
                  <span>20</span>
                </div>
              </FormField>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-sm text-text-secondary">
                Opcionalmente, convide um gestor inicial para a empresa. Ele recebera um email de convite.
              </p>

              <FormField label="Email do Gestor" error={errors.manager_email}>
                <Input
                  type="email"
                  placeholder="gestor@empresa.com"
                  value={state.manager_email}
                  onChange={(e) => updateField("manager_email", e.target.value)}
                />
              </FormField>

              <FormField label="Nome Completo" error={errors.manager_name}>
                <Input
                  placeholder="Nome do gestor"
                  value={state.manager_name}
                  onChange={(e) => updateField("manager_name", e.target.value)}
                />
              </FormField>

              <FormField label="Papel">
                <RadioGroup
                  value={state.manager_role}
                  onValueChange={(val) => updateField("manager_role", val as "admin" | "manager")}
                  className="flex-row gap-4"
                >
                  <RadioItem value="admin">Admin</RadioItem>
                  <RadioItem value="manager">Manager</RadioItem>
                </RadioGroup>
              </FormField>
            </>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={step === 0}
        >
          <ArrowLeft size={16} className="mr-2" />
          Voltar
        </Button>

        {step < 2 ? (
          <Button onClick={handleNext}>
            Proximo
            <ArrowRight size={16} className="ml-2" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <Check size={16} className="mr-2" />
                Criar Empresa
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
