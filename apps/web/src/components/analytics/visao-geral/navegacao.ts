// ---------------------------------------------------------------------------
// Para onde cada link desta tela aponta — um lugar só, e nenhum destino
// inventado.
// ---------------------------------------------------------------------------
// Regra que governa este arquivo: **só entra rota que existe hoje no app**.
// Duas das três abas da spec (`Padrões e tendências`, `Mapa da jornada`) ainda
// não foram construídas, então nenhum link daqui aponta para elas — um href que
// leva a lugar nenhum é pior que um rótulo inerte, porque o gestor clica, cai
// numa tela errada e conclui que o número estava errado.
//
// Verificado em disco (2026-08-16):
//   /engagement                      app/(platform)/engagement/page.tsx
//   /engagement?type=<nudgeType>     lido por `cardForType` no engagement-shell
//   /engagement?student=&action=     deep-link do Central de Envios (E10)
//   /analytics/students/{id}         app/(platform)/analytics/students/[studentId]
//   /analytics                       o painel de tendências que existe hoje
// ---------------------------------------------------------------------------

/** A pessoa. É o único drill-down individual que a §30 permite nesta visão. */
export function rotaDaPessoa(alunoId: string): string {
  return `/analytics/students/${alunoId}`
}

/**
 * "Ver todas as pessoas" e "Ver todos os sinais".
 *
 * Os dois caem na Central de Engajamento, que é onde vive o roster COMPLETO do
 * mesmo recorte com a mesma triagem canônica (`student-triage.ts`) que alimenta
 * a fila desta tela. Não é um destino aproximado: é literalmente a lista longa
 * da qual esta tela mostra as 4 primeiras linhas.
 */
export const ROTA_PESSOAS = "/engagement"

/**
 * "Ver detalhes" do bloco "O que mudou".
 *
 * O destino natural seria a aba "Padrões e tendências", que não existe. O que
 * existe é o painel de Analytics atual, com as séries temporais de uso e
 * profundidade — é lá que o "o que mudou" tem detalhamento hoje.
 */
export const ROTA_TENDENCIAS = "/analytics"

/**
 * "Ver pessoas" de uma recomendação. Quando a recomendação nasce de um bucket
 * de triagem conhecido, o `?type=` já abre a Central com aquele card
 * selecionado; sem isso, abre a lista inteira do recorte.
 */
export function rotaDoGrupo(tipo?: string | null): string {
  return tipo ? `${ROTA_PESSOAS}?type=${encodeURIComponent(tipo)}` : ROTA_PESSOAS
}
