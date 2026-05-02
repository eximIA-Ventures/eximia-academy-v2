"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@eximia/ui"
import { useState } from "react"
import { EvolutionDashboard } from "./evolution-dashboard"
import { ProfileDataSection } from "./profile-data-section"
import { SelfKnowledgeHub } from "./self-knowledge-hub"

interface ProfilePageClientProps {
  userId: string
  fullName: string
  email: string
  role: string
  avatarUrl: string | null
  onboardingCompleted: boolean
  profile: Record<string, unknown>
}

export function ProfilePageClient({
  userId, fullName, email, role, avatarUrl, onboardingCompleted, profile,
}: ProfilePageClientProps) {
  const [activeTab, setActiveTab] = useState("dados")

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-bg-card via-bg-surface to-accent-teal-dark/30 p-6 ring-1 ring-white/[0.06] md:p-8">
        <div className="relative z-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-accent-teal-light">
            Conta
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
            Meu Perfil
          </h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-text-secondary">
            Gerencie seus dados pessoais e explore seu autoconhecimento.
          </p>
        </div>
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent-teal/15 blur-3xl" />
        <div className="absolute -bottom-8 left-1/3 h-32 w-32 rounded-full bg-accent-teal-light/10 blur-3xl" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dados">Meus Dados</TabsTrigger>
          <TabsTrigger value="autoconhecimento">Autoconhecimento</TabsTrigger>
          <TabsTrigger value="evolucao">Evolucao</TabsTrigger>
        </TabsList>
        <TabsContent value="dados">
          <ProfileDataSection
            fullName={fullName} email={email} role={role}
            avatarUrl={avatarUrl} onboardingCompleted={onboardingCompleted}
          />
        </TabsContent>
        <TabsContent value="autoconhecimento">
          <SelfKnowledgeHub profile={profile} userId={userId} />
        </TabsContent>
        <TabsContent value="evolucao">
          <EvolutionDashboard userId={userId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
