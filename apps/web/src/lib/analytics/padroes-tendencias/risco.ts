// ---------------------------------------------------------------------------
// §21 — "Risco de perda de ritmo". Quatro contagens, e a nota que as honra.
// ---------------------------------------------------------------------------
// `EstadoJornada` tem SEIS valores; a §21 desenha QUATRO cards. Concluídos e
// não iniciados sumiriam sem deixar rastro, e os quatro cards passariam a
// afirmar implicitamente uma partição que não é partição.
//
// Isto é literalmente o defeito medido na tela do dono em 2026-08-17 e já
// corrigido na Visão geral: placar com base 6, segmentos somando 2, e as 4
// pessoas ausentes eram exatamente as 4 formadas. A NOTA DE COBERTURA é a
// correção, e por isso `notaCobertura` é campo obrigatório do tipo — `null`
// apenas quando a soma FECHA, porque uma nota dizendo "0 pessoas fora" é ruído.
//
// I-8: os quatro rótulos são de APOIO, não de cobrança. O estado canônico
// chama-se `perdendo-ritmo` (§4) e a §21 o rotula `Desacelerando`: MESMO
// conjunto de pessoas, dois rótulos em duas abas. Registrado para não virar
// duas contagens. NENHUMA pessoa é nomeada aqui — a §21 é literal: "não mostrar
// ranking de pessoas".
// ---------------------------------------------------------------------------

import type { FalhasPorFonte } from "../visao-geral/fonte"
import type { EstadoJornada } from "../visao-geral/tipos"
import type { BasePadroes } from "./base"
import { FONTES_DO_RISCO, primeiraFalha } from "./fonte"
import {
  ACAO_RISCO,
  ROTULO_CATEGORIA_RISCO,
  SUBTITULO_RISCO,
  TITULO_RISCO,
  VAZIO_NINGUEM_INICIOU,
  VAZIO_SEM_ESCOPO,
} from "./textos"
import type { Acao, BlocoRisco, CategoriaRisco, ComEstado, IdCategoriaRisco, Tom } from "./tipos"

const ACAO: Acao = { id: "risco", rotulo: ACAO_RISCO, ctaEscreve: false }

/** As 4 categorias da §21, na ordem da spec, cada uma amarrada ao estado §4. */
const CATEGORIAS: readonly {
  id: IdCategoriaRisco
  estado: EstadoJornada
  tom: Tom
  icone: string
}[] = [
  { id: "sustentando", estado: "sustentando", tom: "green", icone: "trending-up" },
  { id: "desacelerando", estado: "perdendo-ritmo", tom: "amber", icone: "cloud-drizzle" },
  { id: "parados", estado: "parado", tom: "red", icone: "pause" },
  { id: "retomando", estado: "retomando", tom: "blue", icone: "arrow-up" },
]

/** A frase que impede os 4 cards de mentirem por omissão. `null` se fecha. */
export function notaDeCobertura(concluidos: number, naoIniciaram: number): string | null {
  const fora = concluidos + naoIniciaram
  if (fora <= 0) return null
  const pessoas = fora === 1 ? "pessoa do recorte não aparece" : "pessoas do recorte não aparecem"
  return `${fora} ${pessoas} nestas quatro categorias: ${concluidos} já ${concluidos === 1 ? "concluiu" : "concluíram"} e ${naoIniciaram} ainda não ${naoIniciaram === 1 ? "iniciou" : "iniciaram"}.`
}

export function montarRisco(base: BasePadroes, falhas: FalhasPorFonte): ComEstado<BlocoRisco> {
  const cabeca = { titulo: TITULO_RISCO, subtitulo: SUBTITULO_RISCO, acao: ACAO }

  const falha = primeiraFalha(falhas, FONTES_DO_RISCO)
  if (falha) {
    return {
      ...cabeca,
      categorias: [],
      notaCobertura: null,
      estado: "erro",
      erro: falha,
      textoVazio: null,
      motivoVazio: "falha-de-leitura",
    }
  }
  const total = base.visao.roster.size
  if (total === 0) {
    return {
      ...cabeca,
      categorias: [],
      notaCobertura: null,
      estado: "vazio",
      erro: null,
      textoVazio: VAZIO_SEM_ESCOPO,
      motivoVazio: "sem-escopo",
    }
  }
  // Quatro zeros comunicam "seu time não existe"; a mensagem certa é "ninguém
  // iniciou".
  if (base.naoIniciaram === total) {
    return {
      ...cabeca,
      categorias: [],
      notaCobertura: null,
      estado: "vazio",
      erro: null,
      textoVazio: VAZIO_NINGUEM_INICIOU,
      motivoVazio: "sem-base",
    }
  }

  const contagem = new Map<EstadoJornada, number>()
  for (const estado of base.visao.estadoPorAluno.values()) {
    contagem.set(estado, (contagem.get(estado) ?? 0) + 1)
  }

  const categorias: CategoriaRisco[] = CATEGORIAS.map((c) => {
    const pessoas = contagem.get(c.estado) ?? 0
    return {
      id: c.id,
      rotulo: ROTULO_CATEGORIA_RISCO[c.id],
      pessoas,
      percentual: Math.round((pessoas / total) * 100),
      tom: c.tom,
      icone: c.icone,
    }
  })

  return {
    ...cabeca,
    categorias,
    notaCobertura: notaDeCobertura(base.concluidos, base.naoIniciaram),
    estado: "ok",
    erro: null,
    textoVazio: null,
    motivoVazio: null,
  }
}
