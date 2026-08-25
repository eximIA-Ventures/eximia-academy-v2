// ---------------------------------------------------------------------------
// "Meus Padrões e Tendências" — Autogestão da minha Jornada, Tela 2.
// A COMPOSIÇÃO da tela, extraída como componente puro.
// ---------------------------------------------------------------------------
// APRESENTAÇÃO PURA: recebe os dois agregados já montados (`dados` de
// `montarPadroesAutogestao`, `mapaDeCalor` de `montarMapaDeCalorAtividade`) e
// desenha os 4 cartões + os 2 mapas de calor + o rodapé, na ordem de produção.
// NÃO resolve sessão, NÃO lê banco, NÃO calcula nada — a mesma régua que já
// vale para `./cartoes.tsx` e `./mapa-de-calor.tsx`.
//
// POR QUE ESTE ARQUIVO EXISTE (a razão é uma régua, não estética): até
// 2026-08-24, `painel.tsx` (produção) e a rota de harness
// `/gauntlet-preview/autogestao-padroes` MONTAVAM a mesma lista de cartões
// duas vezes, cada um com a própria cópia. Quando `painel.tsx` ganhou os dois
// cartões de mapa de calor, a cópia do harness ficou parada — o crítico media
// uma composição que já não existia mais em produção, e uma feature nova
// ficou invisível para a medição. Com a COMPOSIÇÃO (não só os cartões
// individuais) extraída para cá, produção e harness renderizam o mesmo
// componente: um bloco novo aqui aparece nos dois lugares por construção, não
// por disciplina de manter duas listas sincronizadas.
// ---------------------------------------------------------------------------

import type { PadroesAutogestaoDados, ResultadoMapaDeCalor } from "@/lib/analytics/autogestao/tipos"
import { CardContinuidade, CardFavorece, CardSerie, CardTendencia, RodapeMensagem } from "./cartoes"
import { CardCalendarioAtividade, CardGradeHorarios } from "./mapa-de-calor"

export function PadroesAutogestaoTab({
  dados,
  mapaDeCalor,
}: {
  dados: PadroesAutogestaoDados
  /** Mapa de calor: agregado à parte de `dados` — ver o cabeçalho de `./mapa-de-calor.tsx`. */
  mapaDeCalor: ResultadoMapaDeCalor
}) {
  return (
    <>
      <CardSerie serie={dados.serie} />
      <CardContinuidade continuidade={dados.continuidade} />
      <CardFavorece favorece={dados.favorece} />
      <CardTendencia tendencia={dados.tendencia} />
      <CardGradeHorarios resultado={mapaDeCalor} />
      <CardCalendarioAtividade resultado={mapaDeCalor} />
      <RodapeMensagem />
    </>
  )
}
