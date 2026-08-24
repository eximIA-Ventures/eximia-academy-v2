// ---------------------------------------------------------------------------
// Montagem da Tela 3 (Mapa de Capacidades) — função PURA, mesmo papel de
// `montagem.ts`/`montagem-padroes.ts`.
// ---------------------------------------------------------------------------

import { montarBase } from "./base"
import type { BaseCalculo } from "./base"
import { montarCapacidadeComMaiorGap } from "./capacidade-maior-gap"
import { montarCapacidadesDoTime } from "./capacidades-do-time"
import { blocoVazio } from "./estado-bloco"
import { montarEvidenciasDisponiveis } from "./evidencias-disponiveis"
import type { FonteAprendizagem, LinhaEvidencia } from "./fonte"
import { primeiraFalha } from "./fonte"
import { montarIntervencoes } from "./intervencoes"
import { montarMapaCapacidadeEquipe } from "./mapa-capacidade-equipe"
import type { ContextoDeTela } from "./montagem"
import { montarPessoasApoio } from "./pessoas-apoio"
import type { Cabecalho, ContextoGlobal, MapaCapacidadesDados } from "./tipos"

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

export function montarMapaCapacidades(
  fonte: FonteAprendizagem,
  contextoDeTela: ContextoDeTela,
): MapaCapacidadesDados {
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
      capacidadesDoTime: { ...bloco, linhas: [] },
      capacidadeComMaiorGap: { ...bloco, capacidade: null },
      mapaCapacidadeEquipe: { ...bloco, colunas: [], linhas: [] },
      evidenciasDisponiveis: {
        ...bloco,
        reflexoesAnalisadas: 0,
        casosPraticos: 0,
        validacoesGestor: 0,
      },
      pessoasApoio: { ...bloco, capacidadeGapTitulo: null, linhas: [] },
      recomendacoes: { ...bloco, itens: [] },
    }
  }

  const porCapacidade = new Map<string, LinhaEvidencia[]>()
  for (const e of fonte.evidencias) {
    if (!e.capabilityId) continue
    const lista = porCapacidade.get(e.capabilityId) ?? []
    lista.push(e)
    porCapacidade.set(e.capabilityId, lista)
  }

  const capacidadesDoTime = montarCapacidadesDoTime(base, falhas, fonte.alunos)
  const capacidadeComMaiorGap = montarCapacidadeComMaiorGap(
    falhas,
    capacidadesDoTime,
    (capacidadeId) => porCapacidade.get(capacidadeId) ?? [],
  )
  const mapaCapacidadeEquipe = montarMapaCapacidadeEquipe(base, falhas, fonte.alunos)
  const evidenciasDisponiveis = montarEvidenciasDisponiveis(falhas, fonte.evidencias)
  const pessoasApoio = montarPessoasApoio(base, falhas, fonte.alunos, capacidadeComMaiorGap)
  const recomendacoes = montarIntervencoes(falhas, capacidadeComMaiorGap)

  const blocos = [
    capacidadesDoTime,
    capacidadeComMaiorGap,
    mapaCapacidadeEquipe,
    evidenciasDisponiveis,
    pessoasApoio,
    recomendacoes,
  ]
  const falhaGeral = primeiraFalha(falhas, ["capacidades", "avaliacoes", "evidencias", "alunos"])
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
    capacidadesDoTime,
    capacidadeComMaiorGap,
    mapaCapacidadeEquipe,
    evidenciasDisponiveis,
    pessoasApoio,
    recomendacoes,
  }
}
