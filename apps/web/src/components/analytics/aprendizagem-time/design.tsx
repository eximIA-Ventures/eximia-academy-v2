// ---------------------------------------------------------------------------
// Linguagem visual de "Aprendizagem do Time" — reusa os tokens medidos de
// Ativação (`components/analytics/visao-geral/design.tsx`) porque as duas
// telas são o mesmo produto sob o mesmo gestor (um seletor de domínio as
// liga). Só acrescenta o que a spec exige de novo: a paleta dos 4 estados
// de maturidade (§33 — "evitar vermelho").
// ---------------------------------------------------------------------------

export * from "@/components/analytics/visao-geral/design"

import { TEXTO, TOM_ICONE } from "@/components/analytics/visao-geral/design"
import type { EstadoMaturidade } from "@/lib/analytics/aprendizagem-time/tipos"
import type { Tom } from "@/lib/analytics/visao-geral/tipos"
import { Info } from "lucide-react"

/**
 * §33 da spec: "cinza = não evidenciada; azul = emergindo; laranja = em
 * desenvolvimento; verde = demonstrada. Evitar vermelho." Paleta própria,
 * nunca reaproveita `VARIACAO.negativo` (vermelho) nem `TOM_ICONE.red` para
 * este eixo — maturidade não é "erro", é estágio.
 */
export const TOM_MATURIDADE: Record<
  EstadoMaturidade,
  { fill: string; ink: string; rotulo: string }
> = {
  not_evidenced: { fill: "#ECE8E6", ink: "#676564", rotulo: "Não evidenciada" },
  emerging: { fill: "#D4E1FA", ink: "#3A7CF0", rotulo: "Emergindo" },
  developing: { fill: "#FCE6CC", ink: "#E07104", rotulo: "Em desenvolvimento" },
  demonstrated: { fill: "#D8EDE3", ink: "#1D9C6E", rotulo: "Demonstrada" },
}

/**
 * Título de card + ícone "i" de contexto (referência: `tela-1-visao-geral.png`,
 * blocos Placar / O que merece atenção / Capacidades com maior evolução /
 * Gaps prioritários). `dica` vira `title` nativo — sem componente de tooltip
 * novo, o glifo já comunica "há mais contexto aqui" por si só.
 */
export function CardTituloComInfo({
  children,
  dica,
}: {
  children: import("react").ReactNode
  dica: string
}) {
  return (
    <h2
      className="flex items-center gap-[6px] text-[14.5px] leading-[22px] font-bold text-balance"
      style={{ color: TEXTO.primario, letterSpacing: "-0.006em", wordSpacing: "1.5px" }}
    >
      {children}
      <span title={dica} className="inline-flex shrink-0">
        <Info size={13} strokeWidth={2.2} style={{ color: TEXTO.mudo }} aria-hidden="true" />
        <span className="sr-only">{dica}</span>
      </span>
    </h2>
  )
}

/**
 * Barra de percentual própria de Aprendizagem (§14/§31 da spec). Mesma
 * anatomia da `BarraProporcao` de Mapa da Jornada (trilha cinza + preenchimento
 * tonal), mas não importa cross-domínio — cada domínio é dono da própria régua
 * visual (mesmo princípio de `design.tsx` só reusar `visao-geral/design`).
 * `percent` já vem 0–100 (não 0–1) porque é o que os 6 blocos desta tela
 * carregam (`estadoColetivoPercent`).
 */
export function BarraPercent({ percent, tom = "green" }: { percent: number; tom?: Tom }) {
  const largura = Math.max(0, Math.min(100, percent))
  return (
    <span className="block h-[7px] w-full rounded-full" style={{ backgroundColor: "#EDE9E6" }}>
      <span
        className="block h-full rounded-full transition-[width] duration-300"
        style={{ width: `${largura}%`, backgroundColor: TOM_ICONE[tom].ink }}
      />
    </span>
  )
}
