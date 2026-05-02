"use client"

import { Badge, Tabs, TabsContent, TabsList, TabsTrigger } from "@eximia/ui"
import { useState } from "react"
import { SSOConfigForm } from "./sso-config-form"
import { TenantSettingsForm } from "./tenant-settings-form"
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
}

export function SettingsTabsWrapper({
  whitelabelEnabled,
  tenantId,
  whitelabelConfig,
  tenant,
  ssoConfigured = false,
  sessionTimeoutHours = 8,
}: SettingsTabsWrapperProps) {
  const [tab, setTab] = useState("general")

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
        <TenantSettingsForm tenant={tenant} />
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
