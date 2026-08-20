// ---------------------------------------------------------------------------
// §12 — "Resposta aos seus acionamentos": pessoa, não notificação (I-1).
// ---------------------------------------------------------------------------
// ACHADO QUE MUDA A PREMISSA, e por isso este bloco NÃO lê `notifications.
// returned_at`: quem escreve essa coluna é o cron de eficácia
// (`lib/notifications/efficacy.ts:105,181`), e ele carimba `new Date()` — o
// instante em que o JOB rodou, não o instante da sessão do aluno. Logo
// `returned_at − sent_at` mede o atraso do agendador, e o teto de 7 dias da §12
// é impossível de derivar dele. Some-se que não há agendador versionado neste
// repo (sem `vercel.json`; o disparo é externo, EasyPanel) e que `returned_at`
// está NULL em toda a base medida: ler a coluna produziria "0% de retorno",
// que é a mensagem oposta à verdade ("ninguém nunca mediu").
//
// A correção não é escrever no carimbo (esta fase não escreve em produção): é
// RECOMPUTAR a janela na hora da leitura, contra os mesmos carimbos de
// atividade que o resto da tela usa. Efeito colateral: fica mais correto que o
// cron, que só olha `sessions.created_at` e ignora sessão reusada e reflexão.
//
// `aggregateLoopStats` é consumida VERBATIM, sem cópia: o dedupe por
// destinatário (I-1) já está lá, testado, e tem outro consumidor vivo. O que
// muda é só o que alimenta o campo `returned_at` do input — um ISO sintético da
// primeira atividade dentro da janela própria de cada acionamento, ou `null`.
// ---------------------------------------------------------------------------

import { aggregateLoopStats } from "@/lib/analytics/loop-stats"
import type { BaseCalculo } from "./base"
import { type FalhasPorFonte, primeiraFalha } from "./fonte"
import { JANELA_RETORNO_DIAS, MS_DIA } from "./parametros"
import { DISCLAIMER_CAUSALIDADE, VAZIO_ACIONAMENTOS } from "./textos"
import type { BlocoResposta, ComEstado } from "./tipos"

const FONTES_DA_RESPOSTA = ["acionamentos", "sessoes", "reflexoes", "roster"] as const

export interface AcionamentoLido {
  recipient_id: string
  sent_at: string
}

export interface ResultadoAcionamentos {
  bloco: ComEstado<BlocoResposta>
  /** Quantos acionamentos cada pessoa recebeu no período (para o roster). */
  acionamentosPorAluno: ReadonlyMap<string, number>
  /** Dias até a primeira atividade após o acionamento, quando houve. */
  retornoEmDiasPorAluno: ReadonlyMap<string, number>
}

export function montarAcionamentos(
  base: BaseCalculo,
  acionamentos: readonly AcionamentoLido[],
  falhas: FalhasPorFonte,
): ResultadoAcionamentos {
  const moldura = {
    titulo: "Resposta aos seus acionamentos",
    tituloAjuda: true,
    disclaimer: DISCLAIMER_CAUSALIDADE,
  }
  const vazioDeContagem = {
    estatisticas: [],
    notificacoesEnviadas: 0,
    pessoasAcionadas: 0,
    retomaramEmAte7Dias: 0,
  }

  const falha = primeiraFalha(falhas, FONTES_DA_RESPOSTA)
  if (falha) {
    return {
      bloco: {
        ...moldura,
        ...vazioDeContagem,
        estado: "erro",
        erro: falha,
        textoVazio: null,
        motivoVazio: "falha-de-leitura",
      },
      acionamentosPorAluno: new Map(),
      retornoEmDiasPorAluno: new Map(),
    }
  }

  const noEscopo = acionamentos.filter((a) => base.roster.has(a.recipient_id))
  const acionamentosPorAluno = new Map<string, number>()
  const retornoEmDiasPorAluno = new Map<string, number>()
  const janelaMs = JANELA_RETORNO_DIAS * MS_DIA

  // Uma linha por acionamento, com a janela de 7 dias PRÓPRIA de cada um. O
  // dedupe por pessoa é feito depois, por `aggregateLoopStats`.
  const linhas = noEscopo.map((a) => {
    acionamentosPorAluno.set(a.recipient_id, (acionamentosPorAluno.get(a.recipient_id) ?? 0) + 1)
    const enviadoMs = new Date(a.sent_at).getTime()
    if (Number.isNaN(enviadoMs)) return { recipient_id: a.recipient_id, returned_at: null }

    const primeiraVolta = (base.carimbosPorAluno.get(a.recipient_id) ?? [])
      .filter((t) => t > enviadoMs && t <= enviadoMs + janelaMs)
      .sort((x, y) => x - y)[0]

    if (primeiraVolta === undefined) return { recipient_id: a.recipient_id, returned_at: null }

    const dias = Math.max(0, Math.floor((primeiraVolta - enviadoMs) / MS_DIA))
    const registrado = retornoEmDiasPorAluno.get(a.recipient_id)
    if (registrado === undefined || dias < registrado) {
      retornoEmDiasPorAluno.set(a.recipient_id, dias)
    }
    return { recipient_id: a.recipient_id, returned_at: new Date(primeiraVolta).toISOString() }
  })

  // TRÊS situações que um `0` sozinho colapsaria numa só, e por isso o
  // discriminante vem daqui e não da UI (I-3):
  //   • não acionou ninguém          → estado "vazio", texto da §32
  //   • acionou 4 e nenhum voltou    → estado "ok" com 0%, que é DADO
  //   • a consulta falhou            → estado "erro", já tratado acima
  if (linhas.length === 0) {
    return {
      bloco: {
        ...moldura,
        ...vazioDeContagem,
        estado: "vazio",
        erro: null,
        textoVazio: VAZIO_ACIONAMENTOS,
        motivoVazio: "sem-acionamentos",
      },
      acionamentosPorAluno,
      retornoEmDiasPorAluno,
    }
  }

  const stats = aggregateLoopStats(linhas)

  return {
    bloco: {
      ...moldura,
      estatisticas: [
        {
          id: "acionadas",
          valor: String(stats.acionados),
          rotulo: stats.acionados === 1 ? "pessoa acionada" : "pessoas acionadas",
          icone: "send",
          iconeTom: "amber",
        },
        {
          id: "retomaram",
          valor: String(stats.voltaram),
          rotulo: `${stats.voltaram === 1 ? "retomou" : "retomaram"} em até ${JANELA_RETORNO_DIAS} dias`,
          icone: "undo-2",
          iconeTom: "green",
        },
        {
          id: "taxa",
          valor: `${stats.returnRatePct}%`,
          rotulo: "taxa observada de retorno",
          icone: "percent",
          iconeTom: "blue",
        },
      ],
      notificacoesEnviadas: linhas.length,
      pessoasAcionadas: stats.acionados,
      retomaramEmAte7Dias: stats.voltaram,
      estado: "ok",
      erro: null,
      textoVazio: null,
      motivoVazio: null,
    },
    acionamentosPorAluno,
    retornoEmDiasPorAluno,
  }
}
