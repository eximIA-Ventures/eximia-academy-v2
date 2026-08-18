// ---------------------------------------------------------------------------
// §26 — Pessoas que travaram no mesmo ponto. F-17 a F-21.
// ---------------------------------------------------------------------------
// O MÓDULO ÂNCORA É DERIVADO DE F-10, não recalculado. Dois caminhos para "o
// módulo com mais gente parada" divergem em silêncio no dia em que um empate
// mudar — e aqui o empate decide o título de um bloco inteiro.
//
// "PARADO HÁ" É O NÚMERO MAIS FÁCIL DE ERRAR DESTA TELA. No PNG, Artur está
// "parado há 93 dias" e a "última atividade" dele foi "14 dias atrás". Os dois
// só são coerentes se medirem coisas diferentes: `Parado há` conta desde a
// última evidência NAQUELE MÓDULO; `Última atividade` conta desde a última
// atividade em QUALQUER lugar. Duas consultas, dois rótulos, dois números.
//
// ORDENAÇÃO E I-8: a lista sai por tempo parado decrescente. Isso é gravidade
// da SITUAÇÃO, não mérito da pessoa — fila de triagem, não pódio. Para a
// distinção sobreviver, F-34 impõe: sem numeral de posição, sem badge de
// classificação, sem vocabulário comparativo. `LinhaTravado` não tem campo de
// posição, e isso é verificado estruturalmente.
// ---------------------------------------------------------------------------

import { diasUtcEntre } from "@/lib/analytics/visao-geral/dia-utc"
import { CONCENTRACAO_MODULO_PCT } from "@/lib/analytics/visao-geral/parametros"
import type { BaseMapa } from "./base"
import type { ChaveFonteMapa, FalhasPorFonteMapa } from "./fonte"
import { primeiraFalhaMapa } from "./fonte"
import { TRAVADOS_LINHAS_MAX } from "./parametros"
import {
  CABECALHOS_TRAVADOS,
  ERRO_LEITURA,
  ROTULO_MODULO,
  SUBTITULO_TRAVADOS,
  TITULO_TRAVADOS,
  VAZIO_GARGALOS,
  VAZIO_SEM_ESCOPO,
  rotuloParadoHa,
  rotuloUltimaAtividade,
} from "./textos"
import type { BlocoTravados, LinhaGargalo, LinhaTravado } from "./tipos"

export const CHAVES_TRAVADOS: readonly ChaveFonteMapa[] = [
  "roster",
  "matriculas",
  "capitulos",
  "slides",
  "percorrido",
  "sessoes",
  "reflexoes",
]

export interface EntradaTravados {
  base: BaseMapa
  /** Lista COMPLETA de F-10 (antes do corte). O topo é o âncora (F-17). */
  ordenados: readonly LinhaGargalo[]
  pessoasPorModulo: ReadonlyMap<string, readonly string[]>
}

/** F-19 · dias desde a última evidência da pessoa NAQUELE módulo. */
export function paradoHaDias(base: BaseMapa, alunoId: string, moduloId: string): number | null {
  const carimbos = base.carimbosPorAlunoModulo.get(alunoId)?.get(moduloId)
  if (!carimbos || carimbos.length === 0) return null
  return diasUtcEntre(Math.max(...carimbos), base.agoraMs)
}

export function montarTravados(
  e: EntradaTravados,
  falhas: FalhasPorFonteMapa,
): { bloco: BlocoTravados; ancora: LinhaGargalo | null } {
  const { base, ordenados, pessoasPorModulo } = e
  const falha = primeiraFalhaMapa(falhas, CHAVES_TRAVADOS)

  const esqueleto = {
    titulo: TITULO_TRAVADOS,
    subtitulo: SUBTITULO_TRAVADOS,
    moduloRotulo: ROTULO_MODULO,
    cabecalhos: CABECALHOS_TRAVADOS,
    ctaRotulo: "Ver pessoas",
  } as const

  const ausente = (
    estado: "erro" | "vazio",
    texto: string,
    motivo: BlocoTravados["motivoVazio"],
  ): BlocoTravados => ({
    ...esqueleto,
    // O DISCRIMINANTE de F-21: `presente:false` + `vazio` é "não há
    // concentração"; `presente:false` + `erro` é falha de leitura. Os dois
    // NÃO podem colapsar num só estado.
    presente: false,
    estado,
    erro: estado === "erro" ? falha : null,
    textoVazio: texto,
    motivoVazio: motivo,
    moduloTitulo: "",
    linhas: [],
    ctaTotal: 0,
  })

  if (falha) return { bloco: ausente("erro", ERRO_LEITURA, null), ancora: null }

  const total = base.roster.length
  if (total === 0) {
    return { bloco: ausente("vazio", VAZIO_SEM_ESCOPO, "sem-escopo"), ancora: null }
  }

  const ancora = ordenados[0] ?? null
  // F-21 · "a existência deste bloco depende de haver concentração real":
  // o mesmo 20% da §29 regra A, já parametrizado — não um segundo limiar.
  const piso = CONCENTRACAO_MODULO_PCT * total
  if (ancora === null || ancora.pessoas < piso) {
    return { bloco: ausente("vazio", VAZIO_GARGALOS, "sem-gargalos"), ancora: null }
  }

  const populacao = pessoasPorModulo.get(ancora.moduloId) ?? []
  const linhas: LinhaTravado[] = [...populacao]
    .map((alunoId): LinhaTravado => {
      const dias = paradoHaDias(base, alunoId, ancora.moduloId)
      return {
        alunoId,
        nome: base.nomePorAluno.get(alunoId) ?? "Sem nome",
        iniciais: base.iniciaisPorAluno.get(alunoId) ?? "?",
        avatarTone: base.tomAvatarPorAluno.get(alunoId) ?? "neutral",
        paradoHaDias: dias,
        paradoHaLabel: rotuloParadoHa(dias),
        ultimaAtividadeLabel: rotuloUltimaAtividade(
          base.diasSemAtividadePorAluno.get(alunoId) ?? null,
        ),
      }
    })
    // Sem evidência no âncora vai para o fim: `null` não é "0 dias parado", e
    // colocá-lo no topo afirmaria a maior gravidade a partir de ausência.
    // Desempate por nome, para a saída ser determinística.
    .sort((a, b) => {
      const da = a.paradoHaDias ?? -1
      const db = b.paradoHaDias ?? -1
      if (da !== db) return db - da
      return a.nome.localeCompare(b.nome, "pt-BR")
    })

  return {
    bloco: {
      ...esqueleto,
      presente: true,
      estado: "ok",
      erro: null,
      textoVazio: null,
      motivoVazio: null,
      moduloTitulo: ancora.titulo,
      linhas: linhas.slice(0, TRAVADOS_LINHAS_MAX),
      // O CTA carrega o total COMPLETO, nunca o corte exibido (F-21).
      ctaTotal: populacao.length,
    },
    ancora,
  }
}
