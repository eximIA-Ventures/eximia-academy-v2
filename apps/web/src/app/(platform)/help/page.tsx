"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
} from "@eximia/ui"
import {
  BookOpen,
  Brain,
  ClipboardList,
  Mail,
  Search,
} from "lucide-react"
import Link from "next/link"
import { PageHeader } from "@/components/layout/page-header"

interface FaqItem {
  value: string
  question: string
  answer: string
}

const faqItems: FaqItem[] = [
  {
    value: "metodo-socratico",
    question: "Como funciona o metodo socratico?",
    answer:
      "O metodo socratico da exímIA Academy utiliza inteligencia artificial para conduzir sessoes de aprendizado guiado. Em vez de fornecer respostas diretas, a IA faz perguntas progressivas que estimulam o pensamento critico e ajudam voce a construir conhecimento de forma autonoma. Cada sessao se adapta ao seu nivel de compreensao e estilo de aprendizagem.",
  },
  {
    value: "acessar-cursos",
    question: "Como acessar meus cursos?",
    answer:
      'Para acessar seus cursos, navegue ate a secao "Trilhas" no menu lateral. La voce encontrara todos os cursos disponiveis para seu perfil, organizados por trilhas de aprendizagem. Clique em qualquer curso para iniciar ou continuar seus estudos.',
  },
  {
    value: "avaliacoes-disc-bigfive",
    question: "Como funcionam as avaliacoes DISC e Big Five?",
    answer:
      "As avaliacoes DISC e Big Five fazem parte do seu Perfil de Aprendizagem. O DISC identifica seu estilo comportamental dominante (Dominancia, Influencia, Estabilidade, Conformidade), enquanto o Big Five mapeia cinco dimensoes de personalidade. Juntas, essas avaliacoes permitem que a plataforma personalize sua experiencia de aprendizado. Acesse-as na secao Perfil > Avaliacoes.",
  },
  {
    value: "acesso-mobile",
    question: "Posso acessar pelo celular?",
    answer:
      "Sim! A exímIA Academy e totalmente responsiva e funciona em qualquer dispositivo — computador, tablet ou smartphone. Basta acessar a plataforma pelo navegador do seu dispositivo movel. Recomendamos Chrome ou Safari para melhor experiencia.",
  },
  {
    value: "suporte",
    question: "Como entrar em contato com suporte?",
    answer:
      "Para suporte tecnico ou duvidas sobre a plataforma, envie um e-mail para suporte@eximia.co. Nossa equipe responde em ate 24 horas uteis. Para questoes urgentes, entre em contato com o gestor da sua empresa que utiliza a exímIA Academy.",
  },
]

interface QuickLink {
  icon: typeof BookOpen
  title: string
  description: string
  href: string
  accent: string
}

const quickLinks: QuickLink[] = [
  {
    icon: BookOpen,
    title: "Trilhas de Aprendizagem",
    description: "Explore os cursos disponiveis e continue seus estudos.",
    href: "/courses",
    accent: "bg-accent-blue-mid/15 text-accent-blue-light",
  },
  {
    icon: ClipboardList,
    title: "Avaliacoes",
    description: "Acesse suas avaliacoes DISC, Big Five e outras.",
    href: "/assessments",
    accent: "bg-accent-teal/15 text-accent-teal-light",
  },
  {
    icon: Brain,
    title: "Biblioteca",
    description: "Consulte o acervo de livros e materiais complementares.",
    href: "/biblioteca",
    accent: "bg-accent-gold/15 text-accent-gold",
  },
]

export default function HelpPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        section="Central de Ajuda"
        title="Como podemos ajudar?"
        description="Encontre respostas para as duvidas mais comuns sobre a plataforma exímIA Academy."
        backgroundImage="https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1200&q=80"
      />

      {/* Search Bar */}
      <div className="mx-auto max-w-xl">
        <Input
          placeholder="Buscar na central de ajuda..."
          leadingIcon={<Search className="h-4 w-4" />}
        />
      </div>

      {/* FAQ Section */}
      <Card className="border-border-subtle">
        <CardHeader>
          <CardTitle className="text-lg">Perguntas Frequentes</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single">
            {faqItems.map((item) => (
              <AccordionItem key={item.value} value={item.value}>
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent>
                  <p className="leading-relaxed">{item.answer}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div>
        <h2 className="mb-4 text-lg font-bold text-text-primary">
          Acesso Rapido
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {quickLinks.map((link) => {
            const Icon = link.icon
            return (
              <Link key={link.href} href={link.href}>
                <Card className="h-full border-border-subtle transition-colors hover:border-accent-blue-mid/40 hover:bg-bg-elevated/50">
                  <CardContent className="flex flex-col gap-3 p-5">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg ${link.accent}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold text-text-primary">
                      {link.title}
                    </h3>
                    <p className="text-sm text-text-secondary">
                      {link.description}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Contact Section */}
      <Card className="border-border-subtle">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-blue-mid/15">
            <Mail className="h-5 w-5 text-accent-blue-light" />
          </div>
          <h2 className="text-lg font-bold text-text-primary">
            Ainda precisa de ajuda?
          </h2>
          <p className="max-w-md text-sm text-text-secondary">
            Entre em contato com nossa equipe de suporte. Estamos prontos para
            ajudar voce.
          </p>
          <a
            href="mailto:suporte@eximia.co"
            className="mt-1 text-sm font-medium text-accent-blue-light transition-colors hover:text-accent-blue-mid"
          >
            suporte@eximia.co
          </a>
        </CardContent>
      </Card>
    </div>
  )
}
