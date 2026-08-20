// ---------------------------------------------------------------------------
// A trinca de abas do Analytics do gestor — UMA derivação, dois consumidores.
// ---------------------------------------------------------------------------
// Este arquivo existe porque a lista passou a ser lida em dois lugares que não
// se enxergam:
//   • `montagem.ts`, a camada PURA que monta a Visão geral (e por isso não pode
//     importar nada de rota, nem de `next/*`);
//   • a tela "em construção" das outras duas abas, em
//     `app/(platform)/analytics/_trinca/`, que precisa da MESMA barra para o
//     gestor não sentir que trocou de aplicativo ao clicar.
//
// Duplicar os três rótulos em dois arquivos é como um deles diverge em silêncio
// — e a caixa de sentença ("Visão geral", com g minúsculo) é critério medido,
// não preferência.
// ---------------------------------------------------------------------------

import type { Aba } from "./tipos"

export type AbaId = "visao-geral" | "padroes" | "mapa"

/**
 * Caixa de SENTENÇA obrigatória: "Visão Geral" com G maiúsculo é FAIL (C-03).
 *
 * A ordem é a da referência e não é livre: "Visão geral" é a aba de entrada, e
 * é ela que `/analytics` sem `?tab` serve.
 */
export const TRINCA: readonly { id: AbaId; rotulo: string }[] = [
  { id: "visao-geral", rotulo: "Visão geral" },
  { id: "padroes", rotulo: "Padrões e tendências" },
  { id: "mapa", rotulo: "Mapa da jornada" },
]

/**
 * O `href` é RELATIVO de propósito (`?tab=…`, sem caminho).
 *
 * Ele é o valor de fallback: quem renderiza a barra dentro da rota real passa
 * um destino completo (ver `NavAbas`/`hrefDaAba`), que preserva `?periodo=`,
 * `?curso=` e `?escopo=` na troca de aba — exigência da §3.4 da spec. O
 * relativo sobra para o harness de preview, que não tem rota nem filtros.
 */
export function abasComAtiva(ativa: AbaId): readonly Aba[] {
  return TRINCA.map((aba) => ({
    id: aba.id,
    rotulo: aba.rotulo,
    ativa: aba.id === ativa,
    href: `?tab=${aba.id}`,
  }))
}

/**
 * Lê o `?tab=` da URL. Valor ausente ou desconhecido cai na aba de ENTRADA,
 * nunca no painel anterior: um parâmetro digitado errado não pode mudar qual
 * produto o gestor está vendo.
 */
export function lerAba(bruto: string | undefined): AbaId | "legado" {
  if (bruto === "padroes" || bruto === "mapa") return bruto
  if (bruto === "legado") return "legado"
  return "visao-geral"
}
