// ---------------------------------------------------------------------------
// Mapa da jornada — literais. §32 (estados vazios) e as três RÉGUAS da tela.
// ---------------------------------------------------------------------------
// Os literais da §32 são reusados por IMPORT de `visao-geral/textos.ts`, não
// recopiados: duas cópias da mesma string divergem no dia em que o Senhor
// aprovar uma redação nova, e aí duas telas passam a dizer coisas diferentes
// sobre o mesmo estado.
//
// AS TRÊS RÉGUAS QUE ESTA TELA PUBLICA (e por que elas existem):
//   • REGUA_CINZA (F-05) — cinza é "não iniciou" E "não temos dado", na mesma
//     cor, por desenho da §31.
//   • REGUA_CHEGARAM (F-22) — o produto não trava módulo (achado A-2), então
//     "Chegaram" é constante por curso. Sem a régua, a coluna parece quebrada.
//   • REGUA_PERIODO (F-33) — a tela é posição acumulada e não obedece ao filtro
//     de período. Legítimo, e indistinguível de bug enquanto não escrito.
// As três são RENDERIZADAS (I-2). Régua que só existe no hover é régua que
// ninguém encontra — foi o defeito medido na Visão geral.
// ---------------------------------------------------------------------------

import { TRAVESSAO } from "@/lib/analytics/visao-geral/textos"
import type { EstadoCelula } from "./tipos"

export {
  ERRO_LEITURA,
  TRAVESSAO,
  VAZIO_GARGALOS,
  VAZIO_NINGUEM_INICIOU,
  VAZIO_SEM_ESCOPO,
  rotuloUltimaAtividade,
  textoDoMotivo,
} from "@/lib/analytics/visao-geral/textos"

// --- Títulos e subtítulos (V-31 / V-32, literais do PNG) -------------------

export const TITULO_MAPA = "Mapa da jornada"
export const SUBTITULO_MAPA = "Veja onde cada pessoa está em cada módulo do curso."

export const TITULO_GARGALOS = "Gargalos por módulo"
export const SUBTITULO_GARGALOS = "Módulos com maior concentração de alunos parados ou atrasados."

export const TITULO_DISTRIBUICAO = "Distribuição por etapa"
export const SUBTITULO_DISTRIBUICAO = "Onde estão as pessoas na jornada agora."

export const TITULO_TRAVADOS = "Pessoas que travaram no mesmo ponto"
export const SUBTITULO_TRAVADOS = "Pessoas que estão paradas no mesmo módulo há mais tempo."

export const TITULO_FUNIL = "Funil de avanço por módulo"
export const SUBTITULO_FUNIL = "Compare quantas pessoas chegam, iniciam e concluem cada módulo."

export const TITULO_INSIGHTS = "Insights do mapa"

export const CABECALHOS_FUNIL = ["Módulo", "Chegaram", "Iniciaram", "Concluíram", "Conversão"]
export const CABECALHOS_TRAVADOS = ["Pessoa", "Parado há", "Última atividade"]

export const LINK_TODOS_MODULOS = "Ver todos os módulos"
export const LINK_FUNIL_COMPLETO = "Ver funil completo"
export const CTA_RECOMENDACOES = "Ver recomendações"
export const ROTULO_FILTRAR_ALUNOS = "Filtrar alunos"
export const ROTULO_MODULO = "Módulo:"
export const TITULO_ACAO = "Ação recomendada"

/** V-32, literal do PNG, com ponto final. */
export const FAIXA_RODAPE =
  "Este é o mapa coletivo da jornada. Use os filtros para focar em grupos, turmas ou pessoas específicas."

// --- Legenda (V-16) --------------------------------------------------------

export const ROTULO_CELULA: Record<EstadoCelula, string> = {
  concluido: "Concluído",
  "em-andamento": "Em andamento",
  "nao-iniciado": "Não iniciado",
}

// --- As três réguas --------------------------------------------------------

/** F-05 — renderizada no rodapé da matriz, nunca em tooltip (I-2). */
export const REGUA_CINZA =
  "Cinza significa que ainda não há registro de passagem por este módulo: pode ser que a pessoa não tenha iniciado, ou que a atividade dela não tenha sido registrada."

/** F-22 — renderizada no funil. */
export const REGUA_CHEGARAM =
  "Os módulos não são liberados em sequência: qualquer pessoa matriculada pode abrir qualquer módulo. Por isso “Chegaram” significa “tinha acesso ao módulo”, não “avançou até aqui”."

/** F-33 — renderizada na tela, incondicional. */
export const REGUA_PERIODO =
  "Este mapa mostra a posição acumulada da equipe até hoje, e por isso não muda com o filtro de período. O período afeta apenas quem aparece como retomando."

/** NÃO está na §32 — proposto. Aguarda aval do Senhor (escalação F-02). */
export const VAZIO_SEM_MODULOS = "Este curso ainda não tem módulos publicados."

/**
 * NÃO está na §32 — proposto (doutrina D-6, 2026-08-19). Aguarda aval do dono.
 *
 * O bloco de insights podia sair `ok` com ZERO itens depois que F-27 e F-28
 * deixaram de ecoar os tiles. Card que some sem dizer por que some é pior que
 * um vazio explicado: o gestor não distingue "olhei e não há concentração" de
 * "a tela quebrou". Este texto declara o que foi VERIFICADO, não o que faltou.
 */
export const VAZIO_INSIGHTS =
  "Verificamos a posição de cada pessoa por módulo e não há concentração num mesmo ponto da jornada."

// --- Rótulos de contagem ---------------------------------------------------

/** "40 alunos" / "1 aluno". O singular é contrato (F-06). */
export function rotuloAlunos(n: number): string {
  return n === 1 ? "1 aluno" : `${n} alunos`
}

/** "+ 32 alunos" / "+ 1 aluno" / `null` quando `resto === 0` (F-06). */
export function rotuloResto(resto: number): string | null {
  if (resto <= 0) return null
  return `+ ${rotuloAlunos(resto)}`
}

/** "93 dias" / "1 dia" / travessão quando não há evidência (F-19). */
export function rotuloParadoHa(dias: number | null): string {
  if (dias === null) return TRAVESSAO
  if (dias === 1) return "1 dia"
  return `${dias} dias`
}

/** "90%" / travessão quando o denominador não existe (F-25). */
export function rotuloConversao(pct: number | null): string {
  return pct === null ? TRAVESSAO : `${pct}%`
}
