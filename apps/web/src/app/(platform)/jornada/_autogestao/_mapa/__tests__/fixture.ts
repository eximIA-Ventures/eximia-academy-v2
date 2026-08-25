// ---------------------------------------------------------------------------
// Fábricas de fixture para os testes de COMPONENTE de "Meu Mapa da Jornada".
// ---------------------------------------------------------------------------
// Diferente de `lib/analytics/autogestao/__tests__/fixture.ts` (que fabrica
// `FonteAutogestao`, a leitura crua, já coberta por 86 testes de
// `montarMapaAutogestao`): esta fábrica monta DIRETO o formato de SAÍDA
// (`MapaJornadaAutogestaoDados`), porque o que este arquivo testa é a
// RENDERIZAÇÃO — como o componente reage a cada estado do contrato — não a
// lógica de transformação, que já tem cobertura própria.
// ---------------------------------------------------------------------------

import { semLastro } from "@/lib/analytics/autogestao"
import type {
  BlocoHistorico,
  BlocoModuloAtual,
  BlocoPerdaDeRitmo,
  BlocoProximoMarco,
  BlocoTrilha,
  HistoricoModulo,
  MapaJornadaAutogestaoDados,
  ModuloTrilha,
} from "@/lib/analytics/autogestao"

const OK = { estado: "ok" as const, erro: null, textoVazio: null, motivoVazio: null }

export function moduloTrilha(overrides: Partial<ModuloTrilha> & { ordem: number }): ModuloTrilha {
  return {
    id: `capitulo-${overrides.ordem}`,
    titulo: `Módulo ${overrides.ordem}`,
    status: "nao-iniciado",
    ...overrides,
  }
}

/** 7 módulos: 3 concluídos, 1 em andamento, 3 não iniciados — a foto da referência. */
export function trilhaPadrao(): readonly ModuloTrilha[] {
  return [
    moduloTrilha({ ordem: 1, titulo: "Introdução", status: "concluido" }),
    moduloTrilha({ ordem: 2, titulo: "Definir o Problema", status: "concluido" }),
    moduloTrilha({ ordem: 3, titulo: "Identificar o Problema", status: "concluido" }),
    moduloTrilha({ ordem: 4, titulo: "Análise de Causa", status: "em-andamento" }),
    moduloTrilha({ ordem: 5, titulo: "Ações Corretivas", status: "nao-iniciado" }),
    moduloTrilha({ ordem: 6, titulo: "Executar Ações", status: "nao-iniciado" }),
    moduloTrilha({ ordem: 7, titulo: "Monitorar Resultados", status: "nao-iniciado" }),
  ]
}

export function blocoTrilha(modulos: readonly ModuloTrilha[] = trilhaPadrao()): BlocoTrilha {
  return { ...OK, modulos }
}

export function blocoModuloAtual(
  overrides: Partial<NonNullable<BlocoModuloAtual["conteudo"]>> = {},
): BlocoModuloAtual {
  return {
    ...OK,
    conteudo: {
      id: "capitulo-4",
      titulo: "Análise de Causa",
      progressoPercent: 60,
      iniciadoEmISO: "2026-08-02T12:00:00.000Z",
      iniciadoEmRotulo: "02/08/2026",
      sessoesConcluidas: 2,
      sessoesTotal: 4,
      ultimaAtividadeLabel: "3 dias atrás",
      estimativaRestanteMinutos: 80,
      estimativaRotulo: "~1h 20min",
      ...overrides,
    },
  }
}

/** O marco COM lastro — plano com duração real definida. */
export function blocoProximoMarcoComData(): BlocoProximoMarco {
  return {
    ...OK,
    conteudo: {
      moduloTitulo: "Análise de Causa",
      prazo: { dataISO: "2026-08-21T00:00:00.000Z", rotulo: "21/08/2026" },
      texto: "Este marco mantém você dentro do ritmo previsto no seu plano.",
    },
  }
}

/** O marco SEM lastro — plano com `days: 0` no módulo atual (achado do dono, 4 de 5 planos). */
export function blocoProximoMarcoSemLastro(): BlocoProximoMarco {
  return {
    ...OK,
    conteudo: {
      moduloTitulo: "Análise de Causa",
      prazo: semLastro("os módulos do seu plano ainda não têm duração definida"),
      texto:
        "Ainda não é possível calcular um prazo: seu plano não define uma duração para este módulo.",
    },
  }
}

export function blocoPerdaDeRitmoComDado(): BlocoPerdaDeRitmo {
  return {
    ...OK,
    conteudo: {
      texto: "Nas suas últimas interrupções, você perdeu ritmo ao iniciar módulos novos.",
      mediaDiasPausa: 9,
    },
  }
}

export function blocoPerdaDeRitmoSuprimido(): BlocoPerdaDeRitmo {
  return {
    estado: "vazio",
    erro: null,
    textoVazio: "Nenhuma interrupção relevante foi identificada neste período.",
    motivoVazio: "sem-interrupcao",
    conteudo: null,
  }
}

export function itemHistorico(
  overrides: Partial<HistoricoModulo> & { id: string },
): HistoricoModulo {
  return {
    titulo: `Módulo ${overrides.id}`,
    estadoLabel: "Concluído",
    progressoPercent: 100,
    ultimaAtividadeLabel: "—",
    ...overrides,
  }
}

/** 5 módulos iniciados na fonte; o histórico só deve expor os 3 mais recentes. */
export function blocoHistoricoComCinco(): BlocoHistorico {
  return {
    ...OK,
    itens: [
      itemHistorico({
        id: "capitulo-5",
        titulo: "Ações Corretivas",
        estadoLabel: "Em andamento",
        progressoPercent: 40,
        ultimaAtividadeLabel: "hoje",
      }),
      itemHistorico({
        id: "capitulo-4",
        titulo: "Análise de Causa",
        estadoLabel: "Concluído",
        progressoPercent: 100,
        ultimaAtividadeLabel: "—",
      }),
      itemHistorico({
        id: "capitulo-3",
        titulo: "Identificar o Problema",
        estadoLabel: "Concluído",
        progressoPercent: 100,
        ultimaAtividadeLabel: "—",
      }),
    ],
  }
}

export function mapaCompleto(
  overrides: Partial<MapaJornadaAutogestaoDados> = {},
): MapaJornadaAutogestaoDados {
  return {
    estado: "ok",
    erro: null,
    trilha: blocoTrilha(),
    moduloAtual: blocoModuloAtual(),
    proximoMarco: blocoProximoMarcoComData(),
    perdaDeRitmo: blocoPerdaDeRitmoComDado(),
    historico: blocoHistoricoComCinco(),
    ...overrides,
  }
}
