"use client"

import { useState } from "react"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
} from "@eximia/ui"
import {
  Calendar,
  Lightbulb,
  MessageCircle,
  Send,
  Users,
} from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"

interface CommunityFeature {
  icon: typeof MessageCircle
  title: string
  description: string
  accent: string
  accentBorder: string
}

const features: CommunityFeature[] = [
  {
    icon: MessageCircle,
    title: "Forum de Discussao",
    description:
      "Participe de discussoes sobre os temas dos cursos, troque experiencias com colegas e aprofunde seu aprendizado de forma colaborativa.",
    accent: "bg-accent-blue-mid/15 text-accent-blue-light",
    accentBorder: "bg-accent-blue-mid",
  },
  {
    icon: Users,
    title: "Grupos de Estudo",
    description:
      "Forme grupos de estudo com colegas que compartilham os mesmos objetivos. Aprenda junto, resolva desafios e crie conexoes profissionais.",
    accent: "bg-accent-teal/15 text-accent-teal-light",
    accentBorder: "bg-accent-teal",
  },
  {
    icon: Calendar,
    title: "Eventos e Workshops",
    description:
      "Acesse a agenda de eventos exclusivos, workshops praticos e encontros com especialistas do mercado.",
    accent: "bg-accent-gold/15 text-accent-gold",
    accentBorder: "bg-accent-gold",
  },
  {
    icon: Lightbulb,
    title: "Mentoria",
    description:
      "Conecte-se com mentores experientes que podem guiar sua jornada de desenvolvimento profissional e acelerar seus resultados.",
    accent: "bg-purple-500/15 text-purple-400",
    accentBorder: "bg-purple-500",
  },
]

export default function ComunidadePage() {
  const [email, setEmail] = useState("")

  return (
    <div className="space-y-6">
      <PageHeader
        section="Comunidade"
        title="Conecte-se com outros alunos"
        description="Um espaco colaborativo para troca de conhecimento, networking e crescimento profissional dentro do ecossistema exímIA Academy."
        backgroundImage="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1200&q=80"
      />

      {/* Features Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {features.map((feature) => {
          const Icon = feature.icon
          return (
            <Card
              key={feature.title}
              className="group relative overflow-hidden border-border-subtle transition-colors hover:border-border-medium"
            >
              {/* Accent strip */}
              <div
                className={`absolute left-0 top-0 h-1 w-full ${feature.accentBorder}`}
              />

              <CardHeader className="pb-2 pt-6">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${feature.accent}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">{feature.title}</CardTitle>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <p className="text-sm leading-relaxed text-text-secondary">
                  {feature.description}
                </p>
                <Badge variant="draft">Em breve</Badge>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Newsletter Section */}
      <Card className="border-border-subtle">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-blue-mid/15">
            <Send className="h-5 w-5 text-accent-blue-light" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-text-primary">
              Fique por dentro
            </h2>
            <p className="mt-1 max-w-md text-sm text-text-secondary">
              Cadastre seu e-mail para ser notificado quando a comunidade estiver
              disponivel e receber novidades em primeira mao.
            </p>
          </div>

          <div className="flex w-full max-w-md gap-2">
            <Input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
            />
            <Button disabled={!email.includes("@")}>
              Notificar-me
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
