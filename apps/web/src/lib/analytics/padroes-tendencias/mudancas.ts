// ---------------------------------------------------------------------------
// §16 — "Principais mudanças no período". Máximo 4, e só as que têm implicação.
// ---------------------------------------------------------------------------
// O CONJUNTO DE CANDIDATOS É FECHADO POR CONSTRUÇÃO: pessoas ativas,
// regularidade, módulos em queda e retomadas. Quatro tipos, e nada mais entra.
//
// Isso é a defesa mecânica possível para "não exibir mudanças sem implicação
// para a jornada" (§16), que é julgamento semântico e não fórmula. O conjunto
// fechado não prova relevância; ele impede que um tipo irrelevante entre sem
// que alguém edite este arquivo — e uma edição aqui é visível na revisão,
// enquanto um item novo emitido por acidente não seria.
//
// F-07, o caso que motivou a regra: o mockup exibe um item de origem de acesso
// ("+12%"). O schema NÃO tem telemetria de origem de acesso — a varredura das
// 99 migrations pelas colunas dessa natureza só encontra a auditoria de chave
// de API, que é sobre integração e não sobre aluno. A própria §16 já
// desqualifica o item ("só aparece se houver decisão relevante associada").
// Este bloco portanto NUNCA emite item dessa família, e a camada nunca lê
// coluna que não existe. Para o dono: esse número exige telemetria nova, fora
// do escopo desta tela.
//
// DUAS ESCOLHAS DE ORDENAÇÃO herdadas por citação de `visao-geral/mudancas.ts`
// (a lógica de lá é interna à função e não é exportável; a decisão é copiada, o
// código não):
//   • ordena por PESSOAS afetadas, não por magnitude percentual — ação se toma
//     sobre gente;
//   • há RESERVA DE SLOT para um item positivo, senão o bloco vira boletim de
//     más notícias toda semana, que é a leitura de vigilância proibida pela §2.
// ---------------------------------------------------------------------------

import type { FalhasPorFonte } from "../visao-geral/fonte"
import type { BasePadroes } from "./base"
import { FONTES_DAS_MUDANCAS, primeiraFalha } from "./fonte"
import {
  CONSISTENCIA_SEMANAS,
  MODULOS_EM_QUEDA_MIN,
  MS_DIA,
  MUDANCAS_MAX,
  QUEDA_ACENTUADA_REL,
  REGULARIDADE_DELTA_MIN_PESSOAS,
  REGULARIDADE_DELTA_MIN_PP,
  RELEVANCIA_ABS_PESSOAS,
  RELEVANCIA_ABS_RETOMADA,
} from "./parametros"
import {
  ACAO_MUDANCAS,
  TITULO_MUDANCAS,
  VAZIO_NINGUEM_INICIOU,
  VAZIO_SEM_ESCOPO,
  VAZIO_TENDENCIA,
  comSinal,
  percentualComSinal,
  pontosPercentuais,
  subtituloComparativo,
} from "./textos"
import type { Acao, BlocoMudancas, ComEstado, ItemMudanca, TipoMudanca } from "./tipos"

const ACAO: Acao = { id: "mudancas", rotulo: ACAO_MUDANCAS, ctaEscreve: false }

interface Candidato {
  item: Omit<ItemMudanca, "ordem">
  magnitudeRelativa: number
  ordemDoTipo: number
  positivo: boolean
}

/**
 * A série de ativos não decresceu nas últimas `n` semanas?
 *
 * Existe para a tela não AFIRMAR "crescimento consistente" sem ter verificado
 * consistência. Afirmar o que o dado não sustenta é o defeito mais caro desta
 * família de telas, e o mockup traz exatamente essa frase.
 */
export function crescimentoConsistente(serie: readonly number[], n: number): boolean {
  if (serie.length < n) return false
  const cauda = serie.slice(serie.length - n)
  for (let i = 1; i < cauda.length; i++) {
    if ((cauda[i] ?? 0) < (cauda[i - 1] ?? 0)) return false
  }
  // Uma série constante é "não decrescente" e NÃO é crescimento: exige que a
  // ponta seja estritamente maior que o começo da cauda.
  return (cauda[cauda.length - 1] ?? 0) > (cauda[0] ?? 0)
}

function moldura(base: BasePadroes) {
  return {
    titulo: TITULO_MUDANCAS,
    subtitulo: subtituloComparativo(Math.round(base.visao.janelas.duracaoMs / MS_DIA)),
    acao: ACAO,
  }
}

export function montarMudancas(
  base: BasePadroes,
  falhas: FalhasPorFonte,
): ComEstado<BlocoMudancas> {
  const cabeca = moldura(base)

  const falha = primeiraFalha(falhas, FONTES_DAS_MUDANCAS)
  if (falha) {
    return {
      ...cabeca,
      itens: [],
      estado: "erro",
      erro: falha,
      textoVazio: null,
      motivoVazio: "falha-de-leitura",
    }
  }
  if (base.visao.roster.size === 0) {
    return {
      ...cabeca,
      itens: [],
      estado: "vazio",
      erro: null,
      textoVazio: VAZIO_SEM_ESCOPO,
      motivoVazio: "sem-escopo",
    }
  }
  if (base.visao.iniciados.length === 0) {
    return {
      ...cabeca,
      itens: [],
      estado: "vazio",
      erro: null,
      textoVazio: VAZIO_NINGUEM_INICIOU,
      motivoVazio: "sem-base",
    }
  }

  const candidatos: Candidato[] = []

  // --- tipo 1: pessoas ativas (contagem, nunca percentual) -----------------
  // 3 pessoas em 8 seria "+38%", que alarma sem base. §16 pede contagem.
  const ativosAtual = base.visao.ativosNoPeriodo.size
  const ativosAnterior = base.visao.ativosNoPeriodoAnterior.size
  const deltaAtivos = ativosAtual - ativosAnterior
  if (Math.abs(deltaAtivos) >= RELEVANCIA_ABS_PESSOAS) {
    const subiu = deltaAtivos > 0
    const consistente = subiu && crescimentoConsistente(base.ativosPorSemana, CONSISTENCIA_SEMANAS)
    candidatos.push({
      item: {
        id: "ativos",
        titulo: subiu ? "Mais alunos ativos" : "Menos alunos ativos",
        subtexto: consistente
          ? `Crescimento consistente nas últimas ${CONSISTENCIA_SEMANAS} semanas`
          : "Comparado ao período anterior.",
        valorTexto: comSinal(deltaAtivos),
        tom: subiu ? "positivo" : "negativo",
        pessoas: Math.abs(deltaAtivos),
      },
      magnitudeRelativa: Math.abs(deltaAtivos) / Math.max(1, ativosAnterior),
      ordemDoTipo: 2,
      positivo: subiu,
    })
  }

  // --- tipo 2: regularidade ------------------------------------------------
  const { deltaPp, deltaPessoas } = base.regularidade
  if (
    deltaPp !== null &&
    deltaPessoas !== null &&
    Math.abs(deltaPp) >= REGULARIDADE_DELTA_MIN_PP &&
    Math.abs(deltaPessoas) >= REGULARIDADE_DELTA_MIN_PESSOAS
  ) {
    const caiu = deltaPp < 0
    candidatos.push({
      item: {
        id: "regularidade",
        titulo: caiu ? "Queda na regularidade" : "Aumento na regularidade",
        subtexto: caiu
          ? "Menos alunos estudando 2x ou mais por semana"
          : "Mais alunos estudando 2x ou mais por semana",
        valorTexto: pontosPercentuais(deltaPp),
        tom: caiu ? "negativo" : "positivo",
        pessoas: Math.abs(deltaPessoas),
      },
      magnitudeRelativa: Math.abs(deltaPp) / 100,
      ordemDoTipo: 1,
      positivo: !caiu,
    })
  }

  // --- tipo 3: módulos em queda acentuada ---------------------------------
  const emQueda = base.variacaoPorModulo.filter((m) => m.variacao <= QUEDA_ACENTUADA_REL)
  if (emQueda.length >= MODULOS_EM_QUEDA_MIN) {
    // O valor publicado é a MENOR queda do conjunto, lida como piso ("cada um
    // caiu ao menos X"). Publicar a maior seria exagero por seleção.
    const piso = Math.max(...emQueda.map((m) => m.variacao))
    const doisPiores = [...emQueda]
      .sort((a, b) => a.variacao - b.variacao)
      .slice(0, 2)
      .map((m) => m.titulo)
    const pessoas = emQueda.reduce((s, m) => s + (m.ativosAnterior - m.ativosAtual), 0)
    candidatos.push({
      item: {
        id: "modulos",
        titulo: `Queda acentuada em ${emQueda.length} módulos`,
        subtexto: doisPiores.join(" e "),
        valorTexto: percentualComSinal(Math.round(piso * 100)),
        tom: "negativo",
        // Soma das quedas por módulo. É um limite SUPERIOR do número de pessoas
        // (quem some de dois módulos conta duas vezes); serve para ordenar, e
        // por isso não é publicado como contagem de gente em lugar nenhum.
        pessoas: Math.max(0, pessoas),
      },
      magnitudeRelativa: Math.abs(piso),
      ordemDoTipo: 3,
      positivo: false,
    })
  }

  // --- tipo 4: retomadas ---------------------------------------------------
  // Limiar 2, não 3: assimetria deliberada — reconhecer custa menos que alarmar.
  let retomadas = 0
  for (const estado of base.visao.estadoPorAluno.values()) {
    if (estado === "retomando") retomadas++
  }
  if (retomadas >= RELEVANCIA_ABS_RETOMADA) {
    candidatos.push({
      item: {
        id: "retomadas",
        titulo: "Retomadas",
        // O denominador vai no texto DE PROPÓSITO: "4 retomadas" num período em
        // que só 4 estiveram ativas comunica vitalidade que não existe.
        subtexto: `${retomadas} de ${ativosAtual} ${ativosAtual === 1 ? "pessoa ativa retomou" : "pessoas ativas retomaram"} após uma pausa`,
        valorTexto: comSinal(retomadas),
        tom: "positivo",
        pessoas: retomadas,
      },
      magnitudeRelativa: ativosAtual > 0 ? retomadas / ativosAtual : 0,
      ordemDoTipo: 4,
      positivo: true,
    })
  }

  if (candidatos.length === 0) {
    return {
      ...cabeca,
      itens: [],
      estado: "vazio",
      erro: null,
      textoVazio: VAZIO_TENDENCIA,
      motivoVazio: "sem-periodo-anterior",
    }
  }

  const ordenados = [...candidatos].sort(
    (a, b) =>
      b.item.pessoas - a.item.pessoas ||
      b.magnitudeRelativa - a.magnitudeRelativa ||
      a.ordemDoTipo - b.ordemDoTipo,
  )

  const escolhidos = ordenados.slice(0, MUDANCAS_MAX)
  if (!escolhidos.some((c) => c.positivo)) {
    const positivo = ordenados.find((c) => c.positivo)
    if (positivo && escolhidos.length === MUDANCAS_MAX) escolhidos[MUDANCAS_MAX - 1] = positivo
    else if (positivo) escolhidos.push(positivo)
  }

  return {
    ...cabeca,
    itens: escolhidos.map((c, i): ItemMudanca => ({ ...c.item, ordem: i + 1 })),
    estado: "ok",
    erro: null,
    textoVazio: null,
    motivoVazio: null,
  }
}

/** Os quatro tipos que podem entrar. Fechado — F-07 depende disso. */
export const TIPOS_DE_MUDANCA: readonly TipoMudanca[] = [
  "ativos",
  "regularidade",
  "modulos",
  "retomadas",
]
