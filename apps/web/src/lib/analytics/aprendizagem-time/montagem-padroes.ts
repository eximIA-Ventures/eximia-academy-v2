// ---------------------------------------------------------------------------
// Montagem da Tela 2 (Padrões e Evolução) — função PURA, mesmo papel de
// `montagem.ts` para a Tela 1. Reusa `ContextoDeTela` e `montarBase`: uma
// fonte, um recorte, seis blocos.
// ---------------------------------------------------------------------------

import { montarBase } from "./base"
import type { BaseCalculo } from "./base"
import { montarConceitosFrageis } from "./conceitos-frageis"
import { blocoVazio } from "./estado-bloco"
import type { FonteAprendizagem } from "./fonte"
import { primeiraFalha } from "./fonte"
import { montarModulosEvolucao } from "./modulos-evolucao"
import type { ContextoDeTela } from "./montagem"
import { montarOndeTrava } from "./onde-trava"
import { montarPadroesEmergentes } from "./padroes-emergentes"
import { montarPadroesRecomendacoes } from "./padroes-recomendacoes"
import { montarEvolucaoProfundidade } from "./serie-profundidade"
import type { Cabecalho, ContextoGlobal, PadroesEvolucaoDados } from "./tipos"

const CABECALHO: Cabecalho = {
  titulo: "Aprendizagem do Time",
  subtitulo:
    "Veja a qualidade da aprendizagem da sua equipe e onde apoiar o desenvolvimento de capacidades.",
}

function montarContexto(
  fonte: FonteAprendizagem,
  contextoDeTela: ContextoDeTela,
  base: BaseCalculo,
): ContextoGlobal {
  return {
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
}

export function montarPadroesEvolucao(
  fonte: FonteAprendizagem,
  contextoDeTela: ContextoDeTela,
): PadroesEvolucaoDados {
  const base = montarBase(fonte)
  const { falhas } = fonte
  const contexto = montarContexto(fonte, contextoDeTela, base)

  if (base.capacidades.length === 0 && !falhas.capacidades) {
    const vazio = blocoVazio(
      {},
      "sem-capacidades-no-curso",
      "Este curso ainda não tem capacidades definidas.",
    )
    const bloco = {
      estado: "vazio" as const,
      erro: null,
      textoVazio: vazio.textoVazio,
      motivoVazio: vazio.motivoVazio,
    }
    return {
      estado: "vazio",
      erro: null,
      contexto,
      cabecalho: CABECALHO,
      evolucaoProfundidade: { ...bloco, pontos: [], insight: null },
      padroesEmergentes: { ...bloco, sinais: [] },
      ondeTrava: { ...bloco, linhas: [] },
      conceitosFrageis: { ...bloco, linhas: [] },
      modulosEvolucao: { ...bloco, linhas: [] },
      recomendacoes: { ...bloco, itens: [] },
    }
  }

  const evolucaoProfundidade = montarEvolucaoProfundidade(base, falhas, fonte.agoraMs)
  const ondeTrava = montarOndeTrava(base, falhas, fonte.conceitos)
  const conceitosFrageis = montarConceitosFrageis(base, falhas, fonte.conceitos)
  const modulosEvolucao = montarModulosEvolucao(base, falhas, fonte.conceitos)
  const padroesEmergentes = montarPadroesEmergentes(
    falhas,
    conceitosFrageis,
    modulosEvolucao,
    evolucaoProfundidade,
  )
  const recomendacoes = montarPadroesRecomendacoes(falhas, ondeTrava, conceitosFrageis)

  const blocos = [
    evolucaoProfundidade,
    padroesEmergentes,
    ondeTrava,
    conceitosFrageis,
    modulosEvolucao,
    recomendacoes,
  ]
  const falhaGeral = primeiraFalha(falhas, ["capacidades", "avaliacoes", "evidencias", "conceitos"])
  const estado: "ok" | "vazio" | "erro" = falhas.capacidades
    ? "erro"
    : blocos.every((b) => b.estado === "vazio")
      ? "vazio"
      : "ok"

  return {
    estado,
    erro: falhaGeral,
    contexto,
    cabecalho: CABECALHO,
    evolucaoProfundidade,
    padroesEmergentes,
    ondeTrava,
    conceitosFrageis,
    modulosEvolucao,
    recomendacoes,
  }
}
