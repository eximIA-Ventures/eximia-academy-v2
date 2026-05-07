"use client"

import { useState } from "react"
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
} from "@eximia/ui"
import {
  Bell,
  ExternalLink,
  Globe,
  Lock,
  Moon,
  User,
} from "lucide-react"
import Link from "next/link"
import { PageHeader } from "@/components/layout/page-header"

interface NotificationPref {
  id: string
  label: string
  description: string
  defaultChecked: boolean
}

const notificationPrefs: NotificationPref[] = [
  {
    id: "new-course",
    label: "Novos cursos disponiveis",
    description: "Receba notificacao quando novos cursos forem publicados.",
    defaultChecked: true,
  },
  {
    id: "session-reminder",
    label: "Lembrete de sessoes",
    description: "Lembrete antes de lives e eventos agendados.",
    defaultChecked: true,
  },
  {
    id: "assessment-ready",
    label: "Avaliacoes disponiveis",
    description: "Aviso quando novas avaliacoes estiverem prontas.",
    defaultChecked: true,
  },
  {
    id: "community-updates",
    label: "Atualizacoes da comunidade",
    description: "Novidades e atividades da comunidade eximIA.",
    defaultChecked: false,
  },
]

interface AccountLink {
  icon: typeof User
  title: string
  description: string
  href: string
}

const accountLinks: AccountLink[] = [
  {
    icon: User,
    title: "Editar Perfil",
    description: "Altere suas informacoes pessoais, foto e dados de contato.",
    href: "/perfil",
  },
  {
    icon: ExternalLink,
    title: "Perfil de Aprendizagem",
    description:
      "Veja seus resultados de avaliacoes e estilo de aprendizagem.",
    href: "/profile/learning",
  },
]

export default function ConfiguracoesPage() {
  const [notifications, setNotifications] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(
        notificationPrefs.map((p) => [p.id, p.defaultChecked]),
      ),
  )

  function toggleNotification(id: string) {
    setNotifications((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        section="Configuracoes"
        title="Preferencias"
        description="Gerencie suas preferencias de conta, notificacoes e personalizacao da plataforma."
      />

      {/* Appearance Card */}
      <Card className="border-border-subtle">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Moon className="h-4 w-4 text-text-secondary" />
            Aparencia
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Theme */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">Tema</p>
              <p className="text-xs text-text-secondary">
                O tema escuro e o padrao da plataforma.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="draft">Modo Escuro</Badge>
              <Lock className="h-3.5 w-3.5 text-text-muted" />
            </div>
          </div>

          <div className="" />

          {/* Language */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-text-secondary" />
              <div>
                <p className="text-sm font-medium text-text-primary">Idioma</p>
                <p className="text-xs text-text-secondary">
                  Idioma da interface da plataforma.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="draft">Portugues (BR)</Badge>
              <Lock className="h-3.5 w-3.5 text-text-muted" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications Card */}
      <Card className="border-border-subtle">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-text-secondary" />
            Notificacoes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {notificationPrefs.map((pref, idx) => (
            <div key={pref.id}>
              {idx > 0 && (
                <div className="mb-4 " />
              )}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary">
                    {pref.label}
                  </p>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    {pref.description}
                  </p>
                </div>
                <Checkbox
                  checked={notifications[pref.id] ?? false}
                  onCheckedChange={() => toggleNotification(pref.id)}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Account Actions Card */}
      <Card className="border-border-subtle">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-text-secondary" />
            Conta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {accountLinks.map((link) => {
            const Icon = link.icon
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-4 rounded-lg p-3 transition-colors hover:bg-bg-elevated/50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cerrado-600/15">
                  <Icon className="h-5 w-5 text-cerrado-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary">
                    {link.title}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {link.description}
                  </p>
                </div>
                <ExternalLink className="h-4 w-4 shrink-0 text-text-muted" />
              </Link>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
