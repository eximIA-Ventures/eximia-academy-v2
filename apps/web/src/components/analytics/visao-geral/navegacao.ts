// ---------------------------------------------------------------------------
// Para onde cada link desta tela aponta — um lugar só, e nenhum destino
// inventado.
// ---------------------------------------------------------------------------
// Regra que governa este arquivo: **só entra rota que existe hoje no app**. Um
// href que leva a lugar nenhum é pior que um rótulo inerte, porque o gestor
// clica, cai numa tela errada e conclui que o número estava errado.
//
// Verificado em disco (2026-08-18):
//   /engagement                      app/(platform)/engagement/page.tsx
//   /engagement?type=<nudgeType>     lido por `cardForType` no engagement-shell
//   /analytics                       a rota da trinca; `?tab=` escolhe a aba
//   /analytics?tab=padroes           app/(platform)/analytics/_padroes/painel.tsx
//   /analytics?tab=mapa              app/(platform)/analytics/_mapa/painel.tsx
//
// A PESSOA SAIU DAQUI. O nome do aluno apontava para `/analytics/students/{id}`,
// uma PÁGINA, e a §30 pede "drawer/modal lateral". A diferença não é estética: a
// tela do gestor é de triagem, e trocar de página desmonta a fila que ele estava
// lendo. Quem abre a pessoa agora é `components/analytics/gaveta/`, com os oito
// campos da §30 e sem os quatro que ela proíbe. A rota continua existindo no app
// para quem chega nela por outro caminho; o que saiu foi o link daqui.
// ---------------------------------------------------------------------------

import { hrefDaAba } from "./nav-abas"
import type { DestinoAbas } from "./nav-abas"

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
 * ═══ O LINK QUE RECARREGAVA A PRÓPRIA PÁGINA ════════════════════════════════
 * Este valor era a constante `"/analytics"`, e o comentário original dizia por
 * quê: "o destino natural seria a aba Padrões e tendências, que não existe".
 * Ela passou a existir em 2026-08-16, e a MESMA rota `/analytics` passou a
 * servir a Visão geral quando não há `?tab=`. Ou seja, desde aquele dia o CTA
 * "Ver detalhes" recarregava a tela em que o gestor já estava — e ainda perdia
 * `?periodo`, `?curso` e `?escopo` no caminho, porque o href não carregava
 * query nenhuma.
 *
 * Agora o destino é a aba que a §9 sempre quis ("cada item abre Ver detalhes",
 * e o detalhamento temporal é a §16), com os filtros preservados pela MESMA
 * função que a barra de abas usa (`hrefDaAba`) — não uma segunda montagem de
 * URL ao lado dela, que divergiria no dia em que um filtro novo aparecesse.
 *
 * `destino` ausente (rota de preview, sem roteador) ⇒ a rota ESTÁTICA da aba,
 * sem filtros — que é a única coisa honesta a fazer quando não se sabe quais
 * são eles. Era `undefined`, e `undefined` fazia o CTA virar um `<span>`:
 * desenhado como link, sem destino, invisível ao teclado. Um CTA que não vai a
 * lugar nenhum é pior que nenhum CTA (regra travada em
 * `__tests__/cta-rodape-fonte-unica.test.tsx`), e a alternativa — sumir com ele
 * no preview — deslocaria a foto do gauntlet. O destino é constante, então o
 * preview continua determinístico; e em produção `destinoAbas` está sempre
 * presente (`app/(platform)/analytics/page.tsx`), então nada muda lá.
 */
export const ROTA_TENDENCIAS = "/analytics?tab=padroes"

export function rotaDasTendencias(destino?: DestinoAbas): string {
  return destino ? hrefDaAba(destino, "padroes") : ROTA_TENDENCIAS
}

/**
 * "Ver pessoas" de uma recomendação, quando o destino é a Central.
 *
 * Continua exportada porque o `?type=` é o deep-link real do card de triagem;
 * o CTA da recomendação, porém, deixou de navegar: ele abre a gaveta com a
 * lista NOMINAL de quem a regra §29 escolheu, que é a informação que o gestor
 * precisa para decidir, e que `/engagement` sem filtro não dava (ele caía na
 * lista inteira do recorte, com `tipo` fixo em `null`).
 */
export function rotaDoGrupo(tipo?: string | null): string {
  return tipo ? `${ROTA_PESSOAS}?type=${encodeURIComponent(tipo)}` : ROTA_PESSOAS
}
