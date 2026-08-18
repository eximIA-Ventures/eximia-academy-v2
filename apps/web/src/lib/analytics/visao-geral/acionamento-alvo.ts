// ---------------------------------------------------------------------------
// QUEM PODE RECEBER UM ACIONAMENTO — o último portão antes da rede.
// ---------------------------------------------------------------------------
// DEFEITO QUE ESTE ARQUIVO TRANCA (dono do produto, 2026-08-17, tenant Cory
// Alimentos em PRODUÇÃO): a tela exibiu "Apoiar 4 pessoas paradas" e as 4 eram
// exatamente as 4 que tinham CONCLUÍDO o curso. Elas "pararam" porque
// terminaram. A correção daquele dia foi na camada de dados
// (`recomendacoes.ts`, coberta por `recomendacoes-concluido-nao-e-cobranca`).
//
// POR QUE EXISTE UM SEGUNDO PORTÃO, e ele não é redundância cara: a camada de
// dados decide quem entra na LISTA; este arquivo decide quem entra no ENVIO. São
// momentos diferentes e o segundo é o irreversível — `dispatchTeamNudge` grava
// em `notifications` de um cliente pagante e não tem desfazer. Enquanto o filtro
// vivia só na montagem da lista, qualquer CTA novo que reunisse destinatários
// por outro caminho (uma gaveta, um grupo, um bloco futuro) nascia fora da
// proteção. Aqui ele nasce dentro: o `ProvedorAcoes` é o único caminho de
// escrita da tela, e ele passa por esta função sempre.
//
// FAIL-CLOSED em duas direções, e as duas foram escolhidas:
//   • estado DESCONHECIDO (id fora do roster) é BLOQUEADO. Não saber o estado de
//     alguém não autoriza cobrá-lo;
//   • tipo de acionamento DESCONHECIDO é tratado como cobrança. Um `NudgeType`
//     novo que ninguém classificou não deve estrear alcançando quem concluiu.
//
// Função PURA e sem dependência de React: é o que permite testá-la sem montar
// tela e sem tocar em `process.env`.
// ---------------------------------------------------------------------------

import type { NudgeType } from "@/types/notifications"
import type { EstadoJornada } from "./tipos"

/**
 * Os acionamentos que NÃO são cobrança.
 *
 * Allowlist fechada, e é ela que dá o fail-closed: `top_performer` é
 * reconhecimento (a §29 regra D manda reconhecer justamente quem sustenta, e
 * quem concluiu sustentou até o fim) e `announcement` é comunicado, que não
 * pede nada de ninguém. Todo o resto — `inactive`, `never_accessed`,
 * `no_reflection`, `behind_teaching_plan`, `custom` — pede à pessoa que volte,
 * que estude, que reflita ou que se ponha em dia, e nenhum desses pedidos faz
 * sentido para quem terminou.
 */
const NAO_COBRANCA: ReadonlySet<NudgeType> = new Set<NudgeType>(["top_performer", "announcement"])

export function ehCobranca(tipo: NudgeType): boolean {
  return !NAO_COBRANCA.has(tipo)
}

export interface TriagemDeEnvio {
  /** Ids liberados, na ORDEM em que chegaram (nada de `sort`: I-8). */
  permitidos: readonly string[]
  /** Quem foi barrado por já ter concluído. A tela DIZ isso, não some com eles. */
  bloqueadosPorConclusao: readonly string[]
  /** Quem foi barrado por estado desconhecido — ausência não vira permissão. */
  bloqueadosPorEstadoDesconhecido: readonly string[]
}

/**
 * Separa os destinatários de um acionamento em liberados e barrados.
 *
 * Nunca lança e nunca esvazia em silêncio: quem chama recebe as três listas e é
 * obrigado a mostrá-las. Sumir com o bloqueado seria o mesmo defeito de I-3 num
 * lugar pior — o gestor confirmaria "4 pessoas" e 2 sairiam, sem nada na tela.
 */
export function triarDestinatarios(
  ids: readonly string[],
  tipo: NudgeType,
  estadoPorAluno: ReadonlyMap<string, EstadoJornada> | Readonly<Record<string, EstadoJornada>>,
): TriagemDeEnvio {
  // `instanceof Map` NÃO estreita `ReadonlyMap` na união (o tipo readonly não é
  // uma classe), então o ramo do objeto continuaria vendo os dois lados. A
  // normalização para `Map` na entrada resolve isso sem `as` e sem duplicar a
  // lógica de leitura em dois caminhos.
  const mapa: ReadonlyMap<string, EstadoJornada> =
    estadoPorAluno instanceof Map ? estadoPorAluno : new Map(Object.entries(estadoPorAluno))
  const ler = (id: string): EstadoJornada | undefined => mapa.get(id)

  if (!ehCobranca(tipo)) {
    // Reconhecimento e comunicado alcançam todo mundo do recorte, inclusive
    // quem concluiu — é literalmente para quem chegou ao fim que a §29 regra D
    // manda reconhecer. Estado desconhecido continua barrado: o gate de escopo
    // do servidor já descarta id fora do alcance, e mandar mensagem para alguém
    // que a tela não sabe quem é não tem leitura defensável.
    const permitidos: string[] = []
    const semEstado: string[] = []
    for (const id of ids) (ler(id) === undefined ? semEstado : permitidos).push(id)
    return {
      permitidos,
      bloqueadosPorConclusao: [],
      bloqueadosPorEstadoDesconhecido: semEstado,
    }
  }

  const permitidos: string[] = []
  const concluidos: string[] = []
  const semEstado: string[] = []
  for (const id of ids) {
    const estado = ler(id)
    if (estado === undefined) semEstado.push(id)
    else if (estado === "concluido") concluidos.push(id)
    else permitidos.push(id)
  }
  return {
    permitidos,
    bloqueadosPorConclusao: concluidos,
    bloqueadosPorEstadoDesconhecido: semEstado,
  }
}
