"use client"

import { Badge, Card, CardContent, CardHeader, CardTitle } from "@eximia/ui"
import type { LearnerProfileData } from "@/types/analytics"

interface LearnerProfileCardProps {
  profile: LearnerProfileData | null
}

function ProfileRow({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-sm font-medium text-text-primary">{value ?? "—"}</span>
    </div>
  )
}

export function LearnerProfileCard({ profile }: LearnerProfileCardProps) {
  if (!profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Perfil de Aprendizado</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-muted">
            Perfil ainda não gerado. Necessita mais sessões para análise.
          </p>
        </CardContent>
      </Card>
    )
  }

  const trendLabel =
    profile.comprehensionTrend === "improving"
      ? "Subindo"
      : profile.comprehensionTrend === "declining"
        ? "Caindo"
        : profile.comprehensionTrend === "stable"
          ? "Estável"
          : profile.comprehensionTrend ?? "—"

  const trendVariant =
    profile.comprehensionTrend === "improving"
      ? "success"
      : profile.comprehensionTrend === "declining"
        ? "error"
        : "default"

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Perfil de Aprendizado</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <ProfileRow label="Engajamento" value={profile.engagementStyle} />
        <ProfileRow label="Raciocínio" value={profile.reasoningStyle} />
        <ProfileRow label="Orientação ao detalhe" value={profile.detailOrientation} />
        <ProfileRow label="Profundidade media" value={profile.avgDepthAchieved != null ? `${profile.avgDepthAchieved}/7` : null} />
        <ProfileRow label="QA Score medio" value={profile.avgQaScore != null ? `${profile.avgQaScore}%` : null} />
        <ProfileRow label="Confiança" value={profile.confidence != null ? `${Math.round(profile.confidence * 100)}%` : null} />

        <div className="flex items-center justify-between py-1.5">
          <span className="text-sm text-text-secondary">Tendência</span>
          <Badge variant={trendVariant} badgeSize="sm">{trendLabel}</Badge>
        </div>

        <ProfileRow label="Sessões analisadas" value={profile.sessionCount} />

        {profile.strengths.length > 0 && (
          <div className="pt-2">
            <p className="text-xs font-semibold text-text-secondary">Pontos fortes</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {profile.strengths.map((s) => (
                <Badge key={s} variant="success" badgeSize="sm">{s}</Badge>
              ))}
            </div>
          </div>
        )}

        {profile.growthAreas.length > 0 && (
          <div className="pt-2">
            <p className="text-xs font-semibold text-text-secondary">Áreas de desenvolvimento</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {profile.growthAreas.map((g) => (
                <Badge key={g} variant="warning" badgeSize="sm">{g}</Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
