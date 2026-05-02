import { Badge } from "@eximia/ui"

const SKILL_CONFIG = {
  analise: { label: "Análise", className: "bg-accent-blue-mid/15 text-accent-blue-light" },
  sintese: { label: "Síntese", className: "bg-accent-teal/15 text-accent-teal-light" },
  aplicacao: { label: "Aplicação", className: "bg-semantic-success/15 text-semantic-success" },
  reflexao: { label: "Reflexão", className: "bg-semantic-warning/15 text-semantic-warning" },
} as const

type Skill = keyof typeof SKILL_CONFIG

interface SkillBadgeProps {
  skill: Skill
}

export function SkillBadge({ skill }: SkillBadgeProps) {
  const config = SKILL_CONFIG[skill]
  return (
    <Badge className={config.className} badgeSize="sm">
      {config.label}
    </Badge>
  )
}
