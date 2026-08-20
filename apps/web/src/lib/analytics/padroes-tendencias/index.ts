// ---------------------------------------------------------------------------
// "Padrões e tendências" (Analytics do gestor) — a porta da camada de dados.
// ---------------------------------------------------------------------------
// O QUE ESTA CAMADA NÃO FAZ, e é decisão, não esquecimento:
//
//   • NÃO resolve escopo. Quem decide quais alunos o gestor alcança é
//     `resolveEngagementScope` e as RPCs ancoradas em `auth.uid()`. Esta camada
//     RECEBE o universo já resolvido e o obedece. Inventar escopo aqui abriria
//     um caminho paralelo ao gate de segurança, que é como vazamento entre
//     times acontece.
//
//   • NÃO ESCREVE NADA, e nesta tela nem existe candidato a escrita: os 7
//     elementos acionáveis são navegação, todos com `ctaEscreve: false`. O gate
//     `acoesEstaoAtivas()` da Visão geral (default DESLIGADO) segue sendo a
//     única porta para qualquer escrita futura. O `.env.local` deste repo
//     aponta para PRODUÇÃO.
// ---------------------------------------------------------------------------

import { lerFontePadroes } from "./fonte-supabase"
import type { ClienteLeitura } from "./fonte-supabase"
import { montarPadroesTendencias } from "./montagem"
import type { PadroesTendenciasDados } from "./tipos"

export interface ParametrosPadroesTendencias {
  db: ClienteLeitura
  tenantId: string
  /** Dono da tela. A leitura reusada o usa para filtrar acionamentos (§12). */
  gestorId: string
  /**
   * Universo JÁ resolvido: `null` = tenant inteiro, `[]` = escopo sem ninguém
   * (fail-closed), `[ids]` = o recorte.
   */
  escopoAlunoIds: readonly string[] | null
  /** Injetado, nunca `Date.now()` aqui dentro: os testes precisam do relógio. */
  agoraMs: number
  periodoDias: 7 | 30 | 90
}

/** Lê o banco e monta a aba inteira. Somente leitura. */
export async function carregarPadroesTendencias(
  p: ParametrosPadroesTendencias,
): Promise<PadroesTendenciasDados> {
  const fonte = await lerFontePadroes({
    db: p.db,
    tenantId: p.tenantId,
    gestorId: p.gestorId,
    escopoAlunoIds: p.escopoAlunoIds,
    agoraMs: p.agoraMs,
    periodoDias: p.periodoDias,
  })
  return montarPadroesTendencias(fonte)
}

export { acoesEstaoAtivas } from "../visao-geral/index"
export { montarBasePadroes } from "./base"
export type { BasePadroes, Regularidade, SerieModulo, VariacaoModulo } from "./base"
export { computePadroesTendencias, fonteDaEntrada } from "./entrada"
/**
 * Os tipos do mundo BRUTO saem pela porta junto com a entrada pura: quem monta
 * um mundo sintético (o modo determinístico do preview) precisa deles, e a
 * alternativa seria importar de `./entrada` por caminho profundo, furando a
 * única porta da camada.
 */
export type {
  AlunoBruto,
  AtividadeBruta,
  CapituloBruto,
  CursoBruto,
  EntradaVisaoGeral,
  MatriculaBruta,
} from "./entrada"
export { lerFontePadroes } from "./fonte-supabase"
export { montarGargalos, fracaoDaBarra } from "./gargalos"
export { montarPadroesTendencias } from "./montagem"
export { montarMudancas, crescimentoConsistente, TIPOS_DE_MUDANCA } from "./mudancas"
export { montarParticipacao, fraseDaRegularidade, percentuaisMaiorResto } from "./participacao"
export { montarRisco, notaDeCobertura } from "./risco"
export {
  bucketizarSemanas,
  eixoY,
  indiceDoBalde,
  rotuloSemana,
  semanasDaSerie,
} from "./semanas"
export type { BucketSemana } from "./semanas"
export * from "./parametros"
export { montarSerie } from "./serie"
export { montarSinais, quedaRecorrente } from "./sinais"
export * from "./textos"
export * from "./tipos"
