// ---------------------------------------------------------------------------
// A trinca de vistas do domínio "Aprendizagem do Time" — union type PRÓPRIO,
// não abre o `AbaId` da Ativação (`lib/analytics/visao-geral/abas.ts`). Um
// union fechado por domínio evita que um `switch`/`Record` exaustivo em
// código da Ativação precise aprender sobre vistas que não são dela.
// ---------------------------------------------------------------------------

export type VistaId = "visao-geral" | "padroes" | "mapa"

export const VISTAS: readonly { id: VistaId; rotulo: string }[] = [
  { id: "visao-geral", rotulo: "Visão geral" },
  { id: "padroes", rotulo: "Padrões e evolução" },
  { id: "mapa", rotulo: "Mapa de capacidades" },
]

export function lerVista(bruto: string | undefined): VistaId {
  if (bruto === "padroes" || bruto === "mapa") return bruto
  return "visao-geral"
}

export function vistasComAtiva(
  ativa: VistaId,
): readonly { id: string; rotulo: string; ativa: boolean }[] {
  return VISTAS.map((v) => ({ ...v, ativa: v.id === ativa }))
}
