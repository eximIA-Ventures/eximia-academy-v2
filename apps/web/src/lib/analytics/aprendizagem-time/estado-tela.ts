// ---------------------------------------------------------------------------
// O veredito da TELA — um só lugar, para as três telas.
// ---------------------------------------------------------------------------
// POR QUE ESTE ARQUIVO EXISTE. Até 2026-08-28 a decisão vivia em TRÊS cópias
// (`montagem.ts`, `montagem-mapa.ts`, `montagem-padroes.ts`), e as três estavam
// erradas do mesmo jeito:
//
//     const estado = falhas.capacidades ? "erro" : (blocos.every(vazio) ? "vazio" : "ok")
//
// Só `falhas.capacidades` era consultada. `falhas.avaliacoes`, `falhas.evidencias`,
// `falhas.alunos` e `falhas.conceitos` eram calculadas para o campo `erro` do
// retorno — que nenhuma das três telas lê: elas decidem o banner de página inteira
// por `data.estado === "erro"` e mais nada. Resultado: uma falha de leitura de
// `capability_assessments` ou `capability_evidence` chegava ao gestor como
// "amostra ainda insuficiente", indistinguível de "seu time não produziu evidência
// suficiente ainda". Duas frases opostas, a mesma tela.
//
// Três cópias do mesmo julgamento é COMO o defeito nasceu, e seria como ele
// sobreviveria a uma correção feita em duas delas. Por isso a decisão passa a ser
// esta função, e o conjunto de fontes que cada tela consome é declarado ao lado
// dela — visível, comparável, num só lugar.
//
// A REGRA, em uma frase: **se alguma fonte que esta tela consome falhou, a tela
// está em ERRO — mesmo que os blocos tenham conseguido montar alguma coisa.** Um
// número montado sobre leitura parcial é pior que nenhum número, porque o gestor
// decide em cima dele achando que é informação sobre o time.
// ---------------------------------------------------------------------------

import type { ChaveFonte, FalhasPorFonte } from "./fonte"
import { primeiraFalha } from "./fonte"
import type { FalhaLeitura } from "./tipos"

export type EstadoDeTela = "ok" | "vazio" | "erro"

export interface VereditoDaTela {
  estado: EstadoDeTela
  erro: FalhaLeitura | null
}

/** Tela 1 — Visão Geral (§9-§14): capacidades, avaliações e evidências. */
export const FONTES_DA_VISAO_GERAL: readonly ChaveFonte[] = [
  "capacidades",
  "avaliacoes",
  "evidencias",
]

/** Tela 2 — Padrões e Evolução (§21-§23): as três acima mais os conceitos (módulos). */
export const FONTES_DE_PADROES: readonly ChaveFonte[] = [
  "capacidades",
  "avaliacoes",
  "evidencias",
  "conceitos",
]

/** Tela 3 — Mapa de Capacidades (§33): as três primeiras mais o roster de alunos. */
export const FONTES_DO_MAPA: readonly ChaveFonte[] = [
  "capacidades",
  "avaliacoes",
  "evidencias",
  "alunos",
]

/**
 * O veredito de uma tela a partir das falhas de leitura e dos blocos montados.
 *
 * `blocos` vazio (nenhum bloco montado, caminho de saída antecipada) resolve para
 * `"vazio"` quando não há falha — que é o comportamento correto para "este curso
 * ainda não tem capacidades definidas".
 */
export function decidirEstadoDaTela(
  falhas: FalhasPorFonte,
  fontes: readonly ChaveFonte[],
  blocos: readonly { estado: EstadoDeTela }[],
): VereditoDaTela {
  const erro = primeiraFalha(falhas, fontes)
  if (erro) return { estado: "erro", erro }
  return { estado: blocos.every((b) => b.estado === "vazio") ? "vazio" : "ok", erro: null }
}
