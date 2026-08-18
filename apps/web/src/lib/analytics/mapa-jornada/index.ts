// ---------------------------------------------------------------------------
// Mapa da jornada (Analytics do gestor) — a porta de entrada da camada de dados.
// ---------------------------------------------------------------------------
// UMA função de alto nível. Ela lê (uma passada, todo erro tratado — F-32) e
// entrega o objeto completo da tela.
//
// O QUE ESTA CAMADA NÃO FAZ, e é decisão, não esquecimento:
//
//   • NÃO resolve escopo. Quem decide quais alunos o gestor alcança é
//     `resolveEngagementScope` e as RPCs ancoradas em `auth.uid()`. Esta camada
//     RECEBE o universo já resolvido e só o obedece. Inventar escopo aqui
//     abriria um caminho paralelo ao gate de segurança.
//
//   • NÃO ESCREVE NADA. O CTA da §28 (`Ver recomendações`) é navegação, e vem
//     com `ctaEscreve: false`. Qualquer CTA futuro que grave nasce
//     `ctaEscreve: true` e INERTE enquanto `acoesEstaoAtivasNoMapa()` for
//     `false`. O `.env.local` deste repo aponta para PRODUÇÃO.
// ---------------------------------------------------------------------------

import { lerFonteMapaJornada } from "./fonte-supabase"
import type { ClienteLeituraMapa } from "./fonte-supabase"
import { type ContextoDeTelaMapa, montarMapaJornada } from "./montagem"
import type { MapaJornadaDados } from "./tipos"

export interface ParametrosMapaJornada {
  db: ClienteLeituraMapa
  tenantId: string
  /**
   * Universo JÁ resolvido: `null` = tenant inteiro (admin fora do contexto de
   * time), `[]` = escopo sem ninguém (fail-closed), `[ids]` = o recorte.
   */
  escopoAlunoIds: readonly string[] | null
  /** Injetado, nunca `Date.now()` aqui dentro: os testes precisam do relógio. */
  agoraMs: number
  periodoDias: 7 | 30 | 90
  contexto: ContextoDeTelaMapa
}

/**
 * Gate de escrita do Mapa da jornada. Default DESLIGADO.
 *
 * Nenhuma ação desta tela grava em banco enquanto isto for `false`. A camada de
 * dados não dispara ação alguma de qualquer forma; a variável existe para quem
 * renderiza decidir o estado do botão.
 */
export function acoesEstaoAtivasNoMapa(): boolean {
  return process.env.NEXT_PUBLIC_MAPA_JORNADA_ACOES_ATIVAS === "true"
}

/** Lê o banco e monta a tela inteira. Somente leitura. */
export async function carregarMapaJornada(p: ParametrosMapaJornada): Promise<MapaJornadaDados> {
  const fonte = await lerFonteMapaJornada({
    db: p.db,
    tenantId: p.tenantId,
    escopoAlunoIds: p.escopoAlunoIds,
    agoraMs: p.agoraMs,
    periodoDias: p.periodoDias,
  })
  return montarMapaJornada(fonte, p.contexto)
}

/**
 * F-35 · a chave de dia UTC desta tela é a MESMA função da Visão geral, reexposta
 * aqui e não recopiada. `Parado há 93 dias` tem de sair igual no servidor e no
 * cliente; duas cópias da regra de dia divergem no dia em que uma for ajustada.
 */
export {
  chaveDiaUtc,
  diasUtcEntre,
  diasDistintosOrdenados,
  janelasComparaveis,
} from "@/lib/analytics/visao-geral/dia-utc"
export { montarBaseMapa, estaSemAtividade } from "./base"
export type { BaseMapa } from "./base"
export { computeMapaJornada, fonteDaEntradaMapa } from "./entrada"
export type {
  AlunoBrutoMapa,
  CapituloBrutoMapa,
  CursoBrutoMapa,
  EntradaMapaJornada,
  MatriculaBrutaMapa,
  PercorridoBrutoMapa,
  ReflexaoBrutaMapa,
  SessaoBrutaMapa,
  SlideBrutoMapa,
} from "./entrada"
export {
  capitulosComEvidenciaPorAluno,
  capitulosComSessaoPorAluno,
  indexarSlides,
  pisosDeSlidePorAluno,
  totalDeSlidesPorCapitulo,
} from "./evidencia"
export { lerFonteMapaJornada } from "./fonte-supabase"
export type { ClienteLeituraMapa, ParametrosLeituraMapa } from "./fonte-supabase"
export { SEM_FALHAS_MAPA, TODAS_AS_CHAVES, primeiraFalhaMapa } from "./fonte"
export type { ChaveFonteMapa, FalhasPorFonteMapa, FonteMapaJornada } from "./fonte"
export { montarMatriz } from "./matriz"
export { montarGargalos } from "./gargalos"
export { montarDistribuicao, particionarRoster } from "./distribuicao"
export type { ParticaoDistribuicao } from "./distribuicao"
export { montarTravados, paradoHaDias } from "./travados"
export { montarFunil } from "./funil"
export { montarInsights } from "./insights"
export { montarMapaJornada } from "./montagem"
export type { ContextoDeTelaMapa } from "./montagem"
export { percorridoPorCapitulo } from "./percorrido"
export * from "./parametros"
export * from "./textos"
export * from "./tipos"
