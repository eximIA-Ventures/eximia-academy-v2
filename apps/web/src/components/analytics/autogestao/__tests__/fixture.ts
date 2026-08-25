// ---------------------------------------------------------------------------
// Fábricas de fixture para os testes de COMPONENTE de "Visão Geral" (autogestão).
// ---------------------------------------------------------------------------
// Mesma divisão de `_mapa/__tests__/fixture.ts` (irmã desta run): diferente de
// `lib/analytics/autogestao/__tests__/fixture.ts` (que fabrica `FonteAutogestao`,
// a leitura crua, já coberta pelos testes de `montarVisaoGeralAutogestao`), esta
// fábrica monta DIRETO o formato de SAÍDA (`VisaoGeralAutogestaoDados`), porque
// o que este arquivo testa é a RENDERIZAÇÃO — como o componente reage a cada
// estado do contrato — não a lógica de transformação, que já tem cobertura
// própria.
// ---------------------------------------------------------------------------

import { semLastro } from "@/lib/analytics/autogestao"
import type {
  BlocoAtencaoAutogestao,
  BlocoComoEstou,
  BlocoMudancasAutogestao,
  BlocoRespostaAosAjustes,
  BlocoSinaisDoMomento,
  ConteudoComoEstou,
  ProximoMovimento,
  VisaoGeralAutogestaoDados,
} from "@/lib/analytics/autogestao"

const OK = { estado: "ok" as const, erro: null, textoVazio: null, motivoVazio: null }

/**
 * 1.3 é SEM LASTRO SEMPRE (não existe meta de frequência semanal em
 * `study_plans`, com ou sem plano) — por isso o default já nasce assim, e não
 * como override de um caso especial.
 */
export function conteudoComoEstou(overrides: Partial<ConteudoComoEstou> = {}): ConteudoComoEstou {
  return {
    ritmo: { estado: "no-ritmo", rotulo: "No ritmo" },
    regularidade: {
      vezesPorSemana: 1.8,
      rotulo: "1,8x por semana",
      meta: semLastro("não existe meta de frequência semanal definida no seu plano"),
    },
    progresso: {
      percentual: 50,
      rotulo: "50%",
      metaHoje: { percentual: 48, rotulo: "48%" },
      deltaPp: 2,
      deltaRotulo: "+2 p.p. em relação ao planejado",
    },
    ultimaAtividade: {
      dias: 3,
      rotulo: "3 dias atrás",
      proximaSessaoRecomendadaISO: null,
      proximaSessaoRotulo: null,
    },
    ...overrides,
  }
}

export function blocoComoEstou(overrides: Partial<ConteudoComoEstou> = {}): BlocoComoEstou {
  return { ...OK, conteudo: conteudoComoEstou(overrides) }
}

/**
 * A régua SEM PLANO (`MOTIVO_PLANO_AUSENTE`) — DIFERENTE de plano com duração
 * zerada (`MOTIVO_PLANO_SEM_DURACAO`, que também é SEM LASTRO mas tem plano).
 * Só esta variante deve acionar o CTA "Criar meu plano".
 */
export function blocoComoEstouSemPlano(): BlocoComoEstou {
  return {
    ...OK,
    conteudo: conteudoComoEstou({
      progresso: {
        percentual: 25,
        rotulo: "25%",
        metaHoje: semLastro("você ainda não tem um plano individual"),
        deltaPp: null,
        deltaRotulo: null,
      },
    }),
  }
}

export function blocoMudancas(): BlocoMudancasAutogestao {
  return {
    ...OK,
    itens: [
      {
        id: "sessoes",
        texto: "+1 sessão em relação ao período anterior.",
        tom: "positivo",
        ordem: 1,
      },
      {
        id: "regularidade",
        texto: "Frequência caiu 15% em relação ao período anterior.",
        tom: "negativo",
        ordem: 2,
      },
    ],
  }
}

export function blocoAtencao(): BlocoAtencaoAutogestao {
  return {
    ...OK,
    itens: [
      {
        id: "sessao-aberta",
        titulo: "Sessão em aberto",
        texto: 'Você iniciou "Análise de Causa" há 3 dias e ainda não concluiu.',
        acaoRotulo: "Retomar sessão",
      },
    ],
  }
}

export function proximoMovimentoSessaoParada(): ProximoMovimento {
  return {
    tipo: "sessao-parada",
    titulo: 'Retome "Análise de Causa"',
    texto: "Conclua a sessão para voltar ao ritmo do seu plano.",
    ctaPrincipal: "Retomar sessão",
    ctaSecundario: null,
  }
}

export function blocoRespostaAosAjustes(): BlocoRespostaAosAjustes {
  return {
    ...OK,
    conteudo: {
      ultimoAjusteDias: 21,
      ultimoAjusteRotulo: "há 21 dias",
      decisaoTexto: "Você ajustou seu plano.",
      frequenciaAntes: 1.1,
      frequenciaDepois: 1.9,
      progressoDeltaPp: 12,
      semanasDentroDoPlano: semLastro(
        "não existe meta de frequência semanal definida no seu plano",
      ),
      disclaimer: "Resultado observado após seu ajuste. Não representa relação causal comprovada.",
    },
  }
}

export function blocoRespostaSemAjuste(): BlocoRespostaAosAjustes {
  return {
    estado: "vazio",
    erro: null,
    textoVazio: "Você ainda não fez nenhum ajuste no seu plano.",
    motivoVazio: "sem-ajuste",
    conteudo: null,
  }
}

export function blocoSinaisDoMomento(): BlocoSinaisDoMomento {
  return {
    ...OK,
    itens: [
      { id: "melhor-horario", texto: "Seu melhor horário: 19h–22h." },
      { id: "dias-da-semana", texto: "Terça e quinta são seus dias." },
    ],
  }
}

export function visaoGeralCompleta(
  overrides: Partial<VisaoGeralAutogestaoDados> = {},
): VisaoGeralAutogestaoDados {
  return {
    estado: "ok",
    erro: null,
    comoEstou: blocoComoEstou(),
    sintese: {
      texto: "Você está acompanhando seu plano. Continue mantendo a consistência.",
      tom: "green",
    },
    mudancas: blocoMudancas(),
    atencao: blocoAtencao(),
    proximoMovimento: proximoMovimentoSessaoParada(),
    respostaAosAjustes: blocoRespostaAosAjustes(),
    sinaisDoMomento: blocoSinaisDoMomento(),
    ...overrides,
  }
}
