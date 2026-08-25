// ---------------------------------------------------------------------------
// Fixture sintética da Tela 1 de Aprendizagem do Time — para `?fonte=fixture`
// do preview (Fase 5 do gauntlet: comparação visual determinística, sem
// depender do banco). Cobre deliberadamente o caso "cheio" (todo bloco em
// `ok`, com conteúdo) — os 3 casos de vazio (amostra insuficiente, sem
// tendência, sem capacidades) são exercitados pelos testes de
// `lib/analytics/aprendizagem-time/__tests__`, não pelo screenshot.
// ---------------------------------------------------------------------------

import type {
  MapaCapacidadesDados,
  PadroesEvolucaoDados,
  VisaoGeralAprendizagemDados,
} from "@/lib/analytics/aprendizagem-time/tipos"

export const AGORA_FIXTURE = "2026-08-20T12:00:00.000Z"

export function entradaFixture(): VisaoGeralAprendizagemDados {
  return {
    estado: "ok",
    erro: null,
    contexto: {
      tenantNome: "ExímIA Academy",
      gestorNome: "Mariana Costa",
      gestorPapel: "Gestora",
      agoraISO: AGORA_FIXTURE,
      periodoDias: 30,
      periodoInicioISO: "2026-07-21T12:00:00.000Z",
      periodoFimISO: AGORA_FIXTURE,
      periodoAnteriorInicioISO: "2026-06-21T12:00:00.000Z",
      periodoAnteriorFimISO: "2026-07-21T12:00:00.000Z",
      escopoEquipe: "diretos",
      cursoFiltroNome: "Análise e Solução de Problemas",
      totalAprendizesElegiveis: 12,
    },
    cabecalho: {
      titulo: "Aprendizagem do Time",
      subtitulo:
        "Veja a qualidade da aprendizagem da sua equipe e onde apoiar o desenvolvimento de capacidades.",
    },
    placar: {
      estado: "ok",
      erro: null,
      textoVazio: null,
      motivoVazio: null,
      compreensao: { valorPercent: 78, deltaPp: 14 },
      profundidade: { valorPercent: 64, deltaPp: 6 },
      aplicacao: { valorPercent: 51, deltaPp: -3 },
      evolucao: { valorPercent: 64, deltaPp: 12 },
    },
    mudancas: {
      estado: "ok",
      erro: null,
      textoVazio: null,
      motivoVazio: null,
      sinais: [
        { id: "1", texto: "Compreensão de Análise de Causa aumentou 14 p.p.", tom: "positivo" },
        { id: "2", texto: "Aplicação ainda está abaixo da compreensão.", tom: "neutro" },
        { id: "3", texto: "Ações Corretivas perdeu profundidade (-8 p.p.).", tom: "negativo" },
      ],
    },
    atencao: {
      estado: "ok",
      erro: null,
      textoVazio: null,
      motivoVazio: null,
      itens: [
        {
          id: "1",
          capacidadeId: "cap-1",
          gap: "Uso de evidência",
          resumo: '8 de 12 pessoas ainda em "emergindo" ou "não evidenciada".',
          acaoSugerida: "Reforçar conceito",
        },
        {
          id: "2",
          capacidadeId: "cap-2",
          gap: "Construção de contramedida",
          resumo: '5 de 12 pessoas ainda em "emergindo" ou "não evidenciada".',
          acaoSugerida: "Propor desafio",
        },
      ],
    },
    recomendacoes: {
      estado: "ok",
      erro: null,
      textoVazio: null,
      motivoVazio: null,
      itens: [
        {
          id: "1",
          prioridade: 1,
          titulo: "Reforçar Uso de evidência",
          contexto: '8 de 12 pessoas ainda em "emergindo" ou "não evidenciada".',
          cta: "Reforçar conceito",
        },
        {
          id: "2",
          prioridade: 2,
          titulo: "Propor desafio em Construção de contramedida",
          contexto: '5 de 12 pessoas ainda em "emergindo" ou "não evidenciada".',
          cta: "Propor desafio",
        },
        {
          id: "3",
          prioridade: 3,
          titulo: "Reconhecer evolução",
          contexto: "4 pessoas apresentaram evolução de maturidade no período.",
          cta: "Reconhecer",
        },
      ],
    },
    capacidadesEvolucao: {
      estado: "ok",
      erro: null,
      textoVazio: null,
      motivoVazio: null,
      linhas: [
        {
          capacidadeId: "cap-a",
          titulo: "Clareza do fenômeno",
          estadoColetivoPercent: 82,
          deltaPp: 16,
        },
        {
          capacidadeId: "cap-b",
          titulo: "Pensamento causal",
          estadoColetivoPercent: 71,
          deltaPp: 10,
        },
        {
          capacidadeId: "cap-c",
          titulo: "Construção de contramedida",
          estadoColetivoPercent: 58,
          deltaPp: 6,
        },
        {
          capacidadeId: "cap-d",
          titulo: "Verificação de eficácia",
          estadoColetivoPercent: 39,
          deltaPp: 3,
        },
      ],
    },
    gapsPrioritarios: {
      estado: "ok",
      erro: null,
      textoVazio: null,
      motivoVazio: null,
      linhas: [
        {
          capacidadeId: "cap-1",
          titulo: "Uso de evidência",
          descricao: "Dificuldade em distinguir opinião de fato.",
          pessoasImpactadas: 8,
          percentImpactado: 67,
        },
        {
          capacidadeId: "cap-2",
          titulo: "Construção de contramedida",
          descricao: "Confusão sobre quando usar cada tipo de ação.",
          pessoasImpactadas: 5,
          percentImpactado: 42,
        },
      ],
    },
  }
}

/**
 * Fixture sintética da Tela 2 (Padrões e Evolução) — mesmos valores literais
 * dos exemplos da spec (§18-24), para o screenshot bater com o texto que o
 * dono do produto já aprovou.
 */
export function entradaFixturePadroes(): PadroesEvolucaoDados {
  const contexto = {
    tenantNome: "ExímIA Academy",
    gestorNome: "Mariana Costa",
    gestorPapel: "Gestora",
    agoraISO: AGORA_FIXTURE,
    periodoDias: 30 as const,
    periodoInicioISO: "2026-07-21T12:00:00.000Z",
    periodoFimISO: AGORA_FIXTURE,
    periodoAnteriorInicioISO: "2026-06-21T12:00:00.000Z",
    periodoAnteriorFimISO: "2026-07-21T12:00:00.000Z",
    escopoEquipe: "diretos" as const,
    cursoFiltroNome: "Análise e Solução de Problemas",
    totalAprendizesElegiveis: 12,
  }

  const profundidadeSemanal = [42, 48, 45, 52, 58, 55, 62, 66, 63, 70]
  const aplicacaoSemanal = [30, 32, 28, 35, 38, 36, 42, 45, 48, 52]
  const INICIO_SEMANA_1_MS = Date.UTC(2026, 3, 7) // 07/abr/2026, segunda-feira
  const pontos = profundidadeSemanal.map((profundidadePercent, i) => {
    const inicioMs = INICIO_SEMANA_1_MS + i * 7 * 86_400_000
    const d = new Date(inicioMs)
    return {
      rotulo: `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
      inicioSemanaISO: d.toISOString(),
      profundidadePercent,
      aplicacaoPercent: aplicacaoSemanal[i],
    }
  })

  return {
    estado: "ok",
    erro: null,
    contexto,
    cabecalho: {
      titulo: "Aprendizagem do Time",
      subtitulo:
        "Veja a qualidade da aprendizagem da sua equipe e onde apoiar o desenvolvimento de capacidades.",
    },
    evolucaoProfundidade: {
      estado: "ok",
      erro: null,
      textoVazio: null,
      motivoVazio: null,
      pontos,
      insight:
        "A profundidade vem crescendo há 3 semanas, mas a aplicação continua abaixo da compreensão.",
    },
    padroesEmergentes: {
      estado: "ok",
      erro: null,
      textoVazio: null,
      motivoVazio: null,
      sinais: [
        {
          id: "1",
          titulo: "Análise de Causa",
          texto: "Evoluiu em compreensão, mas ainda apresenta baixa utilização de evidências.",
          tom: "neutro",
        },
        {
          id: "2",
          titulo: "Ações Corretivas",
          texto: "Profundidade caiu nas últimas duas semanas.",
          tom: "negativo",
        },
        {
          id: "3",
          titulo: "Desafios práticos",
          texto: "Semanas com desafios apresentam maior incidência de aplicação.",
          tom: "positivo",
        },
      ],
    },
    ondeTrava: {
      estado: "ok",
      erro: null,
      textoVazio: null,
      motivoVazio: null,
      linhas: [
        {
          conceitoId: "1",
          modulo: "Definir Problema",
          compreensaoPercent: 82,
          aplicacaoPercent: 54,
          gapPrincipal: "Delimitação",
        },
        {
          conceitoId: "2",
          modulo: "Identificar Problema",
          compreensaoPercent: 78,
          aplicacaoPercent: 47,
          gapPrincipal: "Evidência",
        },
        {
          conceitoId: "3",
          modulo: "Análise de Causa",
          compreensaoPercent: 71,
          aplicacaoPercent: 38,
          gapPrincipal: "Evidência",
        },
        {
          conceitoId: "4",
          modulo: "Ações Corretivas",
          compreensaoPercent: 66,
          aplicacaoPercent: 34,
          gapPrincipal: "Relação causa-ação",
        },
        {
          conceitoId: "5",
          modulo: "Monitoramento",
          compreensaoPercent: 74,
          aplicacaoPercent: 46,
          gapPrincipal: "Indicador e meta",
        },
      ],
    },
    conceitosFrageis: {
      estado: "ok",
      erro: null,
      textoVazio: null,
      motivoVazio: null,
      linhas: [
        { conceitoId: "c1", titulo: "Sintoma x causa", pessoasAfetadas: 23, percentAfetado: 46 },
        {
          conceitoId: "c2",
          titulo: "Evidência x opinião",
          pessoasAfetadas: 21,
          percentAfetado: 42,
        },
        {
          conceitoId: "c3",
          titulo: "Contenção x contramedida",
          pessoasAfetadas: 18,
          percentAfetado: 36,
        },
        {
          conceitoId: "c4",
          titulo: "Correlação x causalidade",
          pessoasAfetadas: 16,
          percentAfetado: 32,
        },
      ],
    },
    modulosEvolucao: {
      estado: "ok",
      erro: null,
      textoVazio: null,
      motivoVazio: null,
      linhas: [
        { conceitoId: "3", titulo: "Análise de Causa", deltaPp: 14 },
        { conceitoId: "1", titulo: "Definir Problema", deltaPp: 11 },
        { conceitoId: "5", titulo: "Monitoramento", deltaPp: 9 },
        { conceitoId: "2", titulo: "Identificar Problema", deltaPp: 7 },
      ],
    },
    recomendacoes: {
      estado: "ok",
      erro: null,
      textoVazio: null,
      motivoVazio: null,
      itens: [
        {
          id: "1",
          prioridade: 1,
          titulo: "Reforçar evidência em Análise de Causa",
          contexto: "Gap principal: evidência.",
          cta: "Planejar reforço",
        },
        {
          id: "2",
          prioridade: 2,
          titulo: "Propor estudo de caso em Ações Corretivas",
          contexto: "Relação causa-ação ainda inconsistente.",
          cta: "Criar atividade",
        },
        {
          id: "3",
          prioridade: 3,
          titulo: "Reconhecer evolução de profundidade",
          contexto: "4 pessoas apresentaram evolução consistente no período.",
          cta: "Reconhecer",
        },
      ],
    },
  }
}

/**
 * Fixture sintética da Tela 3 (Mapa de Capacidades) — mesmos valores literais
 * dos exemplos da spec (§31-37).
 */
export function entradaFixtureMapa(): MapaCapacidadesDados {
  const contexto = {
    tenantNome: "ExímIA Academy",
    gestorNome: "Mariana Costa",
    gestorPapel: "Gestora",
    agoraISO: AGORA_FIXTURE,
    periodoDias: 30 as const,
    periodoInicioISO: "2026-07-21T12:00:00.000Z",
    periodoFimISO: AGORA_FIXTURE,
    periodoAnteriorInicioISO: "2026-06-21T12:00:00.000Z",
    periodoAnteriorFimISO: "2026-07-21T12:00:00.000Z",
    escopoEquipe: "diretos" as const,
    cursoFiltroNome: "Análise e Solução de Problemas",
    totalAprendizesElegiveis: 12,
  }

  const colunas = [
    { capacidadeId: "cf", titulo: "Clareza do fenômeno" },
    { capacidadeId: "pc", titulo: "Pensamento causal" },
    { capacidadeId: "ue", titulo: "Uso de evidência" },
    { capacidadeId: "cc", titulo: "Construção de contramedida" },
    { capacidadeId: "ve", titulo: "Verificação de eficácia" },
  ]

  return {
    estado: "ok",
    erro: null,
    contexto,
    cabecalho: {
      titulo: "Aprendizagem do Time",
      subtitulo:
        "Veja a qualidade da aprendizagem da sua equipe e onde apoiar o desenvolvimento de capacidades.",
    },
    capacidadesDoTime: {
      estado: "ok",
      erro: null,
      textoVazio: null,
      motivoVazio: null,
      linhas: [
        {
          capacidadeId: "cf",
          titulo: "Clareza do fenômeno",
          percentMaduro: 82,
          prioridade: "alta",
        },
        { capacidadeId: "pc", titulo: "Pensamento causal", percentMaduro: 71, prioridade: "alta" },
        { capacidadeId: "ue", titulo: "Uso de evidência", percentMaduro: 38, prioridade: "baixa" },
        {
          capacidadeId: "cc",
          titulo: "Construção de contramedida",
          percentMaduro: 58,
          prioridade: "media",
        },
        {
          capacidadeId: "ve",
          titulo: "Verificação de eficácia",
          percentMaduro: 27,
          prioridade: "baixa",
        },
      ],
    },
    capacidadeComMaiorGap: {
      estado: "ok",
      erro: null,
      textoVazio: null,
      motivoVazio: null,
      capacidade: {
        capacidadeId: "ue",
        titulo: "Uso de evidência",
        texto:
          "O time compreende o conceito, mas ainda sustenta poucas conclusões com fatos e dados.",
        sinais: [
          "Apenas 38% de maturidade média do time nesta capacidade.",
          "Muitas reflexões ainda baseadas em opinião ou percepção.",
          "Baixa utilização de dados na sustentação de hipóteses.",
        ],
      },
    },
    mapaCapacidadeEquipe: {
      estado: "ok",
      erro: null,
      textoVazio: null,
      motivoVazio: null,
      colunas,
      linhas: [
        {
          alunoId: "1",
          nome: "Caio Pinheiro",
          estados: {
            cf: "demonstrated",
            pc: "demonstrated",
            ue: "developing",
            cc: "demonstrated",
            ve: "developing",
          },
        },
        {
          alunoId: "2",
          nome: "Cintia Santana",
          estados: {
            cf: "demonstrated",
            pc: "developing",
            ue: "developing",
            cc: "developing",
            ve: "emerging",
          },
        },
        {
          alunoId: "3",
          nome: "Neusa Jorge",
          estados: {
            cf: "developing",
            pc: "demonstrated",
            ue: "emerging",
            cc: "developing",
            ve: "emerging",
          },
        },
        {
          alunoId: "4",
          nome: "Oziel Silva",
          estados: {
            cf: "emerging",
            pc: "developing",
            ue: "emerging",
            cc: "emerging",
            ve: "emerging",
          },
        },
        {
          alunoId: "5",
          nome: "Artur Barcelos",
          estados: {
            cf: "developing",
            pc: "developing",
            ue: "developing",
            cc: "emerging",
            ve: "emerging",
          },
        },
        {
          alunoId: "6",
          nome: "Venilton Amaral",
          estados: {
            cf: "demonstrated",
            pc: "developing",
            ue: "developing",
            cc: "developing",
            ve: "emerging",
          },
        },
      ],
    },
    evidenciasDisponiveis: {
      estado: "ok",
      erro: null,
      textoVazio: null,
      motivoVazio: null,
      reflexoesAnalisadas: 186,
      casosPraticos: 74,
      validacoesGestor: 62,
    },
    pessoasApoio: {
      estado: "ok",
      erro: null,
      textoVazio: null,
      motivoVazio: null,
      capacidadeGapTitulo: "Uso de evidência",
      linhas: [
        {
          alunoId: "4",
          nome: "Oziel Silva",
          estado: "emerging",
          necessidade: "sustentar conclusões com evidências",
        },
        {
          alunoId: "3",
          nome: "Neusa Jorge",
          estado: "emerging",
          necessidade: "usar dados para validar hipótese",
        },
        {
          alunoId: "5",
          nome: "Artur Barcelos",
          estado: "developing",
          necessidade: "conectar causa e evidência",
        },
      ],
    },
    recomendacoes: {
      estado: "ok",
      erro: null,
      textoVazio: null,
      motivoVazio: null,
      itens: [
        {
          id: "1",
          prioridade: 1,
          titulo: "Clínica rápida",
          contexto: "Realizar uma clínica de 20 minutos sobre evidência x opinião.",
          cta: "Aplicar ação",
        },
        {
          id: "2",
          prioridade: 2,
          titulo: "Caso real",
          contexto:
            "Utilizar um problema real da equipe para praticar construção de hipótese baseada em dados.",
          cta: "Aplicar ação",
        },
        {
          id: "3",
          prioridade: 3,
          titulo: "Ritual",
          contexto: "Pedir que cada pessoa traga um dado factual antes de validar uma hipótese.",
          cta: "Aplicar ação",
        },
      ],
    },
  }
}
