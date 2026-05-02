import { getAuthProfile } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getTeamProfiles } from "./actions"
import { TeamProfilesClient } from "./team-profiles-client"

export default async function TeamProfilesPage() {
  const { user, profile } = await getAuthProfile()

  if (!user || !profile) return redirect("/login")
  if (!["manager", "admin"].includes(profile.role)) return redirect("/dashboard")

  const result = await getTeamProfiles()

  if ("error" in result) {
    return (
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-accent-blue-deep via-bg-card to-bg-surface p-8 md:p-12">
          <div className="relative z-10 max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-widest text-accent-blue-light">
              Perfis da Equipe
            </p>
            <h1 className="mt-2 text-3xl font-bold leading-tight text-text-primary md:text-5xl">
              Visão Comportamental
            </h1>
          </div>
        </div>
        <div className="rounded-md border border-semantic-error/30 bg-semantic-error/5 px-4 py-3 text-sm text-text-primary">
          {result.error}
        </div>
      </div>
    )
  }

  const { members, discDistribution, bigFiveAverages, areas, jobRoles, completion } = result.data

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-accent-blue-deep via-bg-card to-bg-surface p-8 md:p-12">
        <div className="relative z-10 max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-widest text-accent-blue-light">
            Perfis da Equipe
          </p>
          <h1 className="mt-2 text-3xl font-bold leading-tight text-text-primary md:text-5xl">
            Visão Comportamental
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-text-secondary md:text-base">
            Distribuição DISC, médias Big Five e insights comportamentais da sua equipe.
          </p>
        </div>
        <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-accent-blue-mid/20 blur-3xl" />
        <div className="absolute -bottom-8 right-32 h-48 w-48 rounded-full bg-accent-gold/10 blur-3xl" />
      </div>

      <TeamProfilesClient
        teamMembers={members}
        discDistribution={discDistribution}
        bigFiveAverages={bigFiveAverages}
        areas={areas}
        jobRoles={jobRoles}
        completion={completion}
      />
    </div>
  )
}
