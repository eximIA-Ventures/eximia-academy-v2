// ---------------------------------------------------------------------------
// Montagem da Tela 1 — função PURA que transforma leitura crua em
// `VisaoGeralAprendizagemDados`. Nenhum `Date.now()`, nenhuma consulta.
// ---------------------------------------------------------------------------

import { montarAtencao } from "./atencao"
import type { BaseCalculo } from "./base"
import { montarBase } from "./base"
import { montarCapacidadesEvolucao } from "./capacidades-evolucao"
import { blocoVazio } from "./estado-bloco"
import { FONTES_DA_VISAO_GERAL, decidirEstadoDaTela } from "./estado-tela"
import type { FonteAprendizagem } from "./fonte"
import { primeiraFalha } from "./fonte"
import { montarGapsPrioritarios } from "./gaps-prioritarios"
import { montarMudancas } from "./mudancas"
import { montarPlacar } from "./placar"
import { montarRecomendacoes } from "./recomendacoes"
import type {
  BlocoAtencao,
  BlocoCapacidadesEvolucao,
  BlocoGapsPrioritarios,
  BlocoRecomendacoes,
  Cabecalho,
  ComEstado,
  ContextoGlobal,
  VisaoGeralAprendizagemDados,
} from "./tipos"

export interface ContextoDeTela {
  tenantNome: string
  gestorNome: string
  gestorPapel: string
  escopoEquipe: "diretos" | "hierarquia"
  cursoFiltroNome: string | null
}

/**
 * Blocos por-capacidade-nomeada exigem um curso específico quando "Todos os
 * cursos" está selecionado E o tenant tem capacidades em mais de um curso —
 * literal do §4.2: "não somar capacidades semanticamente diferentes em um
 * único indicador". Com um único curso semeado (estado atual do produto),
 * isto nunca dispara — mas o gate já existe para quando o segundo curso
 * ganhar capacidades curadas.
 */
function exigeSelecaoDeCurso(base: BaseCalculo, cursoId: string | null): boolean {
  if (cursoId) return false
  const cursos = new Set(base.capacidades.map((c) => c.courseId))
  return cursos.size > 1
}

export function montarVisaoGeralAprendizagem(
  fonte: FonteAprendizagem,
  contextoDeTela: ContextoDeTela,
): VisaoGeralAprendizagemDados {
  const base = montarBase(fonte)
  const { falhas } = fonte

  // A saída antecipada só vale quando NENHUMA fonte falhou: antes ela testava só
  // `!falhas.capacidades`, e uma falha em `evidencias`/`avaliacoes` saía por aqui
  // como "este curso ainda não tem capacidades definidas" — uma explicação de
  // PRODUTO para uma causa de INFRAESTRUTURA. Com falha, o fluxo segue adiante e
  // cada bloco reporta o próprio erro.
  if (base.capacidades.length === 0 && !primeiraFalha(falhas, FONTES_DA_VISAO_GERAL)) {
    const vazio = blocoVazio(
      {},
      "sem-capacidades-no-curso",
      "Este curso ainda não tem capacidades definidas.",
    )
    return montarComTudoVazio(fonte, contextoDeTela, base, vazio.textoVazio, vazio.motivoVazio)
  }

  const precisaCurso = exigeSelecaoDeCurso(base, fonte.cursoId)

  const placar = montarPlacar(base, falhas)
  const mudancas = montarMudancas(base, falhas)
  let atencao = montarAtencao(base, falhas)
  let capacidadesEvolucao = montarCapacidadesEvolucao(base, falhas)

  if (precisaCurso) {
    atencao = blocoVazio(
      { itens: [] },
      "selecione-um-curso",
      "Selecione um curso para ver esta análise.",
    )
    capacidadesEvolucao = blocoVazio(
      { linhas: [] },
      "selecione-um-curso",
      "Selecione um curso para ver esta análise.",
    )
  }

  const recomendacoes: ComEstado<BlocoRecomendacoes> = precisaCurso
    ? blocoVazio({ itens: [] }, "selecione-um-curso", "Selecione um curso para ver esta análise.")
    : montarRecomendacoes(base, falhas, atencao as ComEstado<BlocoAtencao>)

  const gapsPrioritarios: ComEstado<BlocoGapsPrioritarios> = precisaCurso
    ? blocoVazio({ linhas: [] }, "selecione-um-curso", "Selecione um curso para ver esta análise.")
    : montarGapsPrioritarios(base, falhas, atencao as ComEstado<BlocoAtencao>)

  const contexto: ContextoGlobal = {
    tenantNome: contextoDeTela.tenantNome,
    gestorNome: contextoDeTela.gestorNome,
    gestorPapel: contextoDeTela.gestorPapel,
    agoraISO: new Date(fonte.agoraMs).toISOString(),
    periodoDias: fonte.periodoDias,
    periodoInicioISO: new Date(base.janelas.atualInicio).toISOString(),
    periodoFimISO: new Date(base.janelas.atualFim).toISOString(),
    periodoAnteriorInicioISO: new Date(base.janelas.anteriorInicio).toISOString(),
    periodoAnteriorFimISO: new Date(base.janelas.anteriorFim).toISOString(),
    escopoEquipe: contextoDeTela.escopoEquipe,
    cursoFiltroNome: contextoDeTela.cursoFiltroNome,
    totalAprendizesElegiveis: base.alunosElegiveisPeriodoAtual.size,
  }

  const cabecalho: Cabecalho = {
    titulo: "Aprendizagem do Time",
    subtitulo:
      "Veja a qualidade da aprendizagem da sua equipe e onde apoiar o desenvolvimento de capacidades.",
  }

  const blocos = [placar, mudancas, atencao, recomendacoes, capacidadesEvolucao, gapsPrioritarios]
  const { estado, erro } = decidirEstadoDaTela(falhas, FONTES_DA_VISAO_GERAL, blocos)

  return {
    estado,
    erro,
    contexto,
    cabecalho,
    placar,
    mudancas,
    atencao: atencao as ComEstado<BlocoAtencao>,
    recomendacoes,
    capacidadesEvolucao,
    gapsPrioritarios,
  }
}

function montarComTudoVazio(
  fonte: FonteAprendizagem,
  contextoDeTela: ContextoDeTela,
  base: BaseCalculo,
  textoVazio: string | null,
  motivoVazio: VisaoGeralAprendizagemDados["placar"]["motivoVazio"],
): VisaoGeralAprendizagemDados {
  const vazioBloco = { estado: "vazio" as const, erro: null, textoVazio, motivoVazio }
  const contexto: ContextoGlobal = {
    tenantNome: contextoDeTela.tenantNome,
    gestorNome: contextoDeTela.gestorNome,
    gestorPapel: contextoDeTela.gestorPapel,
    agoraISO: new Date(fonte.agoraMs).toISOString(),
    periodoDias: fonte.periodoDias,
    periodoInicioISO: new Date(base.janelas.atualInicio).toISOString(),
    periodoFimISO: new Date(base.janelas.atualFim).toISOString(),
    periodoAnteriorInicioISO: new Date(base.janelas.anteriorInicio).toISOString(),
    periodoAnteriorFimISO: new Date(base.janelas.anteriorFim).toISOString(),
    escopoEquipe: contextoDeTela.escopoEquipe,
    cursoFiltroNome: contextoDeTela.cursoFiltroNome,
    totalAprendizesElegiveis: 0,
  }
  return {
    estado: "vazio",
    erro: null,
    contexto,
    cabecalho: {
      titulo: "Aprendizagem do Time",
      subtitulo:
        "Veja a qualidade da aprendizagem da sua equipe e onde apoiar o desenvolvimento de capacidades.",
    },
    placar: {
      ...vazioBloco,
      compreensao: { valorPercent: null, deltaPp: null },
      profundidade: { valorPercent: null, deltaPp: null },
      aplicacao: { valorPercent: null, deltaPp: null },
      evolucao: { valorPercent: null, deltaPp: null },
    },
    mudancas: { ...vazioBloco, sinais: [] },
    atencao: { ...vazioBloco, itens: [] },
    recomendacoes: { ...vazioBloco, itens: [] },
    capacidadesEvolucao: { ...vazioBloco, linhas: [] },
    gapsPrioritarios: { ...vazioBloco, linhas: [] },
  }
}
