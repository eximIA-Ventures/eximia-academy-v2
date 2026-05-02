import { Avatar, Badge, Card, CardContent } from "@eximia/ui"

const ROLE_LABELS: Record<string, string> = {
  student: "Estudante",
  teacher: "Professor",
  manager: "Gestor",
  admin: "Administrador",
  super_admin: "Super Admin",
}

interface ProfileDataSectionProps {
  fullName: string
  email: string
  role: string
  avatarUrl: string | null
  onboardingCompleted: boolean
}

export function ProfileDataSection({ fullName, email, role, avatarUrl, onboardingCompleted }: ProfileDataSectionProps) {
  return (
    <Card className="mt-4">
      <CardContent className="p-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <Avatar
            src={avatarUrl ?? undefined}
            alt={fullName}
            fallback={fullName.substring(0, 2).toUpperCase()}
            size="lg"
            className="h-20 w-20 text-lg"
          />
          <div className="flex-1 space-y-3 text-center sm:text-left">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">{fullName}</h2>
              <p className="text-sm text-text-secondary">{email}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
              <Badge variant="default" badgeSize="sm">{ROLE_LABELS[role] || role}</Badge>
              <Badge variant={onboardingCompleted ? "success" : "warning"} badgeSize="sm">
                {onboardingCompleted ? "Onboarding completo" : "Onboarding pendente"}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
