"use client"

import { Badge, Tabs, TabsContent, TabsList, TabsTrigger } from "@eximia/ui"
import { useState } from "react"
import { SSOConfigForm } from "./sso-config-form"
import { WhitelabelSettingsForm } from "./whitelabel-settings-form"

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

interface SettingsTabsWrapperProps {
  whitelabelEnabled: boolean
  tenantId: string
  whitelabelConfig: Record<string, unknown>
  tenant: TenantForForm
  ssoConfigured?: boolean
  sessionTimeoutHours?: number
  /**
   * Aba inicial vinda do querystring `?tab=` (lido no server, em `page.tsx`).
   * Ausente ou inválida => "general", exatamente o comportamento anterior.
   */
  initialTab?: string
}

/** Retrocompatível por construção: só `auth` e `whitelabel` (quando habilitado)
 * saem do default. Qualquer outro valor cai em "general".
 * Exportada para teste unitário (é a decisão pura desta tela). */
export function resolveInitialTab(
  initialTab: string | undefined,
  whitelabelEnabled: boolean,
): string {
  if (initialTab === "auth") return "auth"
  if (initialTab === "whitelabel" && whitelabelEnabled) return "whitelabel"
  return "general"
}

export function SettingsTabsWrapper({
  whitelabelEnabled,
  tenantId,
  whitelabelConfig,
  tenant,
  ssoConfigured = false,
  sessionTimeoutHours = 8,
  initialTab,
}: SettingsTabsWrapperProps) {
  // A aba pedida pela URL (`?tab=`), resolvida no server e recebida por prop.
  const requestedTab = resolveInitialTab(initialTab, whitelabelEnabled)
  const [tab, setTab] = useState(requestedTab)

  // BUG (aba no-op): `initialTab` só alimentava o INICIALIZADOR do useState, e
  // uma navegação que muda apenas o querystring (ex.: `/admin/settings` ->
  // `/admin/settings?tab=auth`, ou trocar de aba na sidebar) NÃO remonta este
  // client component — a prop mudava e a tela não. Padrão oficial do React de
  // "ajustar estado quando uma prop muda" (sem efeito, sem Suspense, sem
  // `useSearchParams`): comparar com o valor anterior durante o render.
  const [prevRequestedTab, setPrevRequestedTab] = useState(requestedTab)
  if (requestedTab !== prevRequestedTab) {
    setPrevRequestedTab(requestedTab)
    setTab(requestedTab)
  }

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="general">Configurações Gerais</TabsTrigger>
        <TabsTrigger value="auth">Autenticação</TabsTrigger>
        {whitelabelEnabled && (
          <TabsTrigger
            value="whitelabel"
            className="flex items-center gap-1.5"
          >
            Whitelabel
            <Badge
              variant="info"
              badgeSize="sm"
              className="ml-1"
            >
              PRO
            </Badge>
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="general">
        <p className="text-sm text-text-muted p-4">Configurações gerais do tenant são definidas no tenant.config.ts do deploy.</p>
      </TabsContent>

      <TabsContent value="auth">
        <SSOConfigForm
          ssoConfigured={ssoConfigured}
          tenantId={tenantId}
          sessionTimeoutHours={sessionTimeoutHours}
        />
      </TabsContent>

      {whitelabelEnabled && (
        <TabsContent value="whitelabel">
          <WhitelabelSettingsForm
            tenantId={tenantId}
            whitelabelConfig={whitelabelConfig}
          />
        </TabsContent>
      )}
    </Tabs>
  )
}
