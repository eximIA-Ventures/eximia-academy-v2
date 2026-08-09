import type { ReactNode } from "react"

/**
 * RODADA 11 (R1) — A PROP `accent` FOI REMOVIDA, NÃO "LIGADA". Ela existia com
 * os valores "blue" | "teal" | "gold" | "purple", era passada por 20 telas, e
 * NÃO pintava nada: o eyebrow saía `text-cerrado-*` chumbado nas três variantes.
 * Ligá-la seria reintroduzir o defeito com outro nome — `/admin/audit` pedia
 * `accent="blue"` DENTRO do mundo teal, e `/trails` pedia `accent="teal"` dentro
 * do mundo laranja. A cor do eyebrow não é escolha da tela: é a identidade do
 * mundo em que a tela está. Quem decide é o `data-world` do shell, e a tradução
 * mundo -> cor mora num lugar só (`styles/theme.css`, blocos WORLD ACCENT).
 *
 * DOIS tokens porque são DUAS superfícies (o porquê completo está no theme.css):
 *   `--world-accent`          -> fundo `bg-app`, que muda com o tema (token
 *                                tema-dependente: parada escura no claro, clara
 *                                no escuro).
 *   `--world-accent-on-dark`  -> herói com `backgroundImage`, cujo fundo é
 *                                #1a1a1a FIXO nos dois temas (token constante).
 * Trocar um pelo outro reprova contraste: no tema claro, `--world-accent` sobre
 * o herói escuro mede 1.63:1 (azul), 1.87:1 (violeta) e 2.13:1 (teal).
 *
 * Medição tela a tela, nos 2 temas: `/tmp/rodada11-contrast.mjs` (66 pares, 0
 * reprovações). Ela também matou uma reprovação PRÉ-EXISTENTE: o `cerrado-500`
 * chumbado das variantes sem imagem media 2.42:1 sobre `bg-app` claro.
 */
interface PageHeaderProps {
  section?: string
  title: string
  description?: string
  variant?: "hero" | "simple"
  backgroundImage?: string
  children?: ReactNode
}

const EYEBROW_BASE = "text-[10px] font-semibold uppercase tracking-[0.2em]"

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
        {section && <p className={`${EYEBROW_BASE} text-[var(--world-accent)] mb-1`}>{section}</p>}
        <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
        {description && <p className="mt-1 text-sm text-text-secondary">{description}</p>}
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
            background:
              "linear-gradient(90deg, #1a1a1a 0%, rgba(26,26,26,0.85) 35%, rgba(26,26,26,0.2) 70%, transparent 100%)",
          }}
        />

        <div className="relative z-10 w-full px-8 pb-7">
          {section && (
            <p className={`${EYEBROW_BASE} text-[var(--world-accent-on-dark)]`}>{section}</p>
          )}
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white md:text-4xl">{title}</h1>
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
      {section && <p className={`${EYEBROW_BASE} text-[var(--world-accent)] mb-1`}>{section}</p>}
      <h1 className="text-3xl font-bold tracking-tight text-text-primary md:text-4xl">{title}</h1>
      {description && (
        <p className="mt-3 text-sm text-text-secondary leading-relaxed max-w-lg md:text-base">
          {description}
        </p>
      )}
      {children}
    </section>
  )
}
