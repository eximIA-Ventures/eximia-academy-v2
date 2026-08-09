/**
 * ContentCardsGrid — grid de 4 cards de navegação (Trilhas / Lives / Biblioteca / Materiais).
 *
 * Removido do dashboard do aluno em 2026-07-14 por decisão do Hugo: o bloco saiu
 * do conceito do dashboard. Preservado aqui, completo (dados + estilos), para virar
 * uma futura página de navegação de conteúdo. NÃO é renderizado em lugar nenhum
 * por enquanto.
 */
import { BookOpen, Compass, FileText, Radio } from "lucide-react"
import Link from "next/link"

export function ContentCardsGrid() {
  const cards = [
    {
      href: "/courses",
      icon: Compass,
      title: "Trilhas",
      description: "Programas de desenvolvimento",
      gradient: "from-cerrado-100 to-cerrado-50 dark:from-cerrado-600/20 dark:to-cerrado-800/10",
      iconBg: "bg-cerrado-200 dark:bg-cerrado-600/15",
      iconColor: "text-cerrado-700 dark:text-cerrado-400",
    },
    {
      href: "/lives",
      icon: Radio,
      title: "Lives",
      description: "Sessoes ao vivo",
      gradient: "from-amber-50 to-amber-50/50 dark:from-accent-gold/15 dark:to-accent-gold/5",
      iconBg: "bg-amber-100 dark:bg-accent-gold/15",
      iconColor: "text-amber-700 dark:text-accent-gold",
    },
    {
      href: "/biblioteca",
      icon: BookOpen,
      title: "Biblioteca",
      description: "Curadoria de conteudo",
      gradient: "from-teal-50 to-teal-50/50 dark:from-teal-500/15 dark:to-teal-500/5",
      iconBg: "bg-teal-100 dark:bg-teal-500/15",
      iconColor: "text-teal-700 dark:text-teal-400",
      badge: "Novos",
    },
    {
      href: "/materiais",
      icon: FileText,
      title: "Materiais",
      description: "Templates e referencias",
      gradient: "from-purple-50 to-purple-50/50 dark:from-purple-500/15 dark:to-purple-500/5",
      iconBg: "bg-purple-100 dark:bg-purple-500/15",
      iconColor: "text-purple-700 dark:text-purple-400",
    },
  ]

  return (
    <div className="px-6 pt-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Link key={card.href} href={card.href} className="group">
              <div
                className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.gradient} p-5 shadow-card transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-elevated`}
              >
                {card.badge && (
                  <span className="absolute right-3 top-3 rounded-full bg-teal-100 dark:bg-teal-500/10 px-2 py-0.5 text-[9px] font-semibold text-teal-700 dark:text-teal-400">
                    {card.badge}
                  </span>
                )}
                <div
                  className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${card.iconBg}`}
                >
                  <Icon size={20} className={card.iconColor} />
                </div>
                <h3 className="text-base font-semibold text-text-primary">{card.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-text-muted">{card.description}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
