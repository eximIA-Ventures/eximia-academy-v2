import type { ReactNode } from "react"

interface PageHeaderProps {
  section?: string
  title: string
  description?: string
  variant?: "hero" | "simple"
  accent?: "blue" | "teal" | "gold" | "purple"
  backgroundImage?: string
  children?: ReactNode
}

export function PageHeader({
  section,
  title,
  description,
  variant = "hero",
  backgroundImage,
  children,
}: PageHeaderProps) {
  if (variant === "simple") {
    return (
      <div className="pb-6">
        {section && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cerrado-500 mb-1">
            {section}
          </p>
        )}
        <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-text-secondary">{description}</p>
        )}
        {children}
      </div>
    )
  }

  if (backgroundImage) {
    return (
      <section
        className="relative flex min-h-[240px] items-end overflow-hidden rounded-2xl shadow-card mb-6"
        style={{ background: "#1a1a1a" }}
      >
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url('${backgroundImage}')` }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(90deg, #1a1a1a 0%, rgba(26,26,26,0.85) 35%, rgba(26,26,26,0.2) 70%, transparent 100%)",
          }}
        />

        <div className="relative z-10 w-full px-8 pb-7">
          {section && (
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cerrado-400">
              {section}
            </p>
          )}
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white md:text-4xl">
            {title}
          </h1>
          {description && (
            <p className="mt-2 text-sm text-white/60 leading-relaxed max-w-lg">{description}</p>
          )}
          {children}
        </div>
      </section>
    )
  }

  return (
    <section className="pb-6">
      {section && (
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cerrado-500 mb-1">
          {section}
        </p>
      )}
      <h1 className="text-3xl font-bold tracking-tight text-text-primary md:text-4xl">
        {title}
      </h1>
      {description && (
        <p className="mt-3 text-sm text-text-secondary leading-relaxed max-w-lg md:text-base">{description}</p>
      )}
      {children}
    </section>
  )
}
