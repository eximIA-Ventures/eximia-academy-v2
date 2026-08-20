// ---------------------------------------------------------------------------
// Entrada PURA de "Padrões e tendências" — a mesma tela, sem Supabase no meio.
// ---------------------------------------------------------------------------
// Duas portas, um cálculo só:
//
//   • `carregarPadroesTendencias(...)` — produção: lê o banco e monta.
//   • `computePadroesTendencias(entrada)` — dado bruto em mãos: só monta.
//
// A segunda existe para o cálculo ser exercitado com dado sintético sem mock de
// cliente Supabase, e é a MESMA porta que a rota de preview usa no modo motor.
// Isso NÃO é um caminho paralelo de implementação: o adaptador
// (`fonteDaEntrada`, reusado da Visão geral, nunca reescrito) só troca a FORMA
// da linha, e a partir daí é byte a byte o mesmo código que a produção executa.
// Se divergisse, o preview e os testes estariam medindo uma segunda
// implementação — que é exatamente o defeito que um verificador existe para
// pegar (e foi o defeito da tela anterior: correções existiam no código e não
// apareciam na tela de inspeção, porque a tela lia fixture).
// ---------------------------------------------------------------------------

import { fonteDaEntrada } from "../visao-geral/entrada"
import { montarPadroesTendencias } from "./montagem"
import type { PadroesTendenciasDados } from "./tipos"

export type {
  AlunoBruto,
  AtividadeBruta,
  CapituloBruto,
  CursoBruto,
  EntradaVisaoGeral,
  MatriculaBruta,
} from "../visao-geral/entrada"
export { fonteDaEntrada } from "../visao-geral/entrada"

/**
 * A entrada bruta desta tela é a MESMA da Visão geral, de propósito: as duas
 * abas leem o mesmo banco, e um segundo formato de entrada abriria a porta para
 * dois universos de teste que não se falam.
 */
import type { EntradaVisaoGeral } from "../visao-geral/entrada"

/** A tela inteira a partir de dado bruto em mãos. Pura e determinística. */
export function computePadroesTendencias(entrada: EntradaVisaoGeral): PadroesTendenciasDados {
  return montarPadroesTendencias(fonteDaEntrada(entrada))
}
