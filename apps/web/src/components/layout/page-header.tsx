import type { ReactNode } from "react"

interface PageHeaderProps {
  section?: string
  title: string
  description?: string
  variant?: "hero" | "simple"
  accent?: "blue" | "teal" | "gold" | "purple"
  /** Background image URL — renders full-bleed layout like dashboard */
  backgroundImage?: string
  children?: ReactNode
}

const ACCENT_STYLES = {
  blue: {
    section: "text-accent-blue-light",
  },
  teal: {
    section: "text-accent-teal",
  },
  gold: {
    section: "text-accent-gold",
  },
  purple: {
    section: "text-purple-400",
  },
}

export function PageHeader({
  section,
  title,
  description,
  variant = "hero",
  accent = "blue",
  backgroundImage,
  children,
}: PageHeaderProps) {
  const styles = ACCENT_STYLES[accent]

  if (variant === "simple") {
    return (
      <div>
        <h1 className="mt-3 text-xl font-bold text-text-primary">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-text-secondary">{description}</p>
        )}
        {children}
      </div>
    )
  }

  if (backgroundImage) {
    return (
      <section className="relative -mx-6 -mt-6 flex min-h-[280px] items-end overflow-hidden bg-bg-app px-6 pb-8 pt-16 sm:px-8 md:px-10">
        {/* Background image (right side) */}
        <div
          className="absolute inset-y-0 right-0 w-[70%] bg-cover bg-center"
          style={{ backgroundImage: `url('${backgroundImage}')` }}
        />
        {/* Gradient overlay — smooth blend to background */}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(90deg, rgba(15,15,15,0.97) 0%, rgba(15,15,15,0.85) 35%, rgba(15,15,15,0.3) 65%, transparent 100%)",
          }}
        />
        {/* Bottom fade */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-bg-app to-transparent" />

        {/* Content */}
        <div className="relative z-10 w-full">
          {section && (
            <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${styles.section}`}>
              {section}
            </p>
          )}
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-text-primary md:text-4xl">
            {title}
          </h1>
          {description && (
            <p className="mt-3 text-sm text-text-secondary leading-relaxed max-w-lg md:text-base">{description}</p>
          )}
          {children}
        </div>
      </section>
    )
  }

  // Gradient-only variant (no image)
  return (
    <section className="relative -mx-6 -mt-6 flex min-h-[200px] items-end overflow-hidden bg-bg-app px-6 pb-8 pt-16 sm:px-8 md:px-10">
      {/* Decorative blurs */}
      <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-accent-blue-mid/8 blur-3xl" />
      <div className="absolute -left-8 bottom-0 h-40 w-40 rounded-full bg-accent-teal/5 blur-2xl" />
      {/* Bottom fade */}
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-bg-app to-transparent" />

      <div className="relative z-10 w-full">
        {section && (
          <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${styles.section}`}>
            {section}
          </p>
        )}
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-text-primary md:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-3 text-sm text-text-secondary leading-relaxed max-w-lg md:text-base">{description}</p>
        )}
        {children}
      </div>
    </section>
  )
}
