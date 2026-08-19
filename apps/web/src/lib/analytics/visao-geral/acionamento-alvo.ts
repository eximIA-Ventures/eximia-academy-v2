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
// proteção.
//
// ONDE ESTE ARQUIVO ESTAVA (auditoria independente, 2026-08-19): do lado
// ERRADO da rede. Ele se descrevia como "o último portão antes da rede" e
// rodava no NAVEGADOR, dentro de `ProvedorAcoes.pedir()`. A tela era só UM dos
// chamadores de `POST /api/engagement/action`: a Central de Engajamento
// (`send-center-tab.tsx`) posta na MESMA rota sem passar por aqui, e um POST
// direto não passa por tela nenhuma. Desde então a regra roda TAMBÉM no
// servidor (`lib/notifications/portao-de-acionamento.ts` +
// `api/engagement/action/route.ts`), e é a MESMA função aqui, não uma segunda
// implementação — duas implementações do mesmo critério divergem, e foi assim
// que o buraco nasceu.
//
// FAIL-CLOSED em duas direções, e as duas foram escolhidas:
//   • estado DESCONHECIDO (id fora do roster) é BLOQUEADO. Não saber o estado de
//     alguém não autoriza cobrá-lo;
//   • tipo de acionamento DESCONHECIDO é tratado como cobrança. Um `NudgeType`
//     novo que ninguém classificou não deve estrear alcançando quem concluiu.
//
// Módulo PURO: sem React, sem `process.env`, sem cliente de banco. É o que
// permite ele ser o MESMO nos dois lados — a tela importa daqui, e a rota
// também.
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

// ---------------------------------------------------------------------------
// O FATO DE MATRÍCULA: quem CONCLUIU.
// ---------------------------------------------------------------------------
// Este critério nasceu dentro de `base.ts` (a montagem da Visão geral) e ficou
// preso lá. O servidor precisa da MESMA resposta para barrar a cobrança antes
// da escrita, e reescrevê-la na rota criaria a segunda implementação que este
// arquivo existe para evitar. Então ela mora aqui, pura, e `base.ts` consome.
// ---------------------------------------------------------------------------

/**
 * A projeção mínima de uma linha de `enrollments` que o critério consome.
 *
 * `deleted_at` é OPCIONAL porque as duas fontes o tratam em momentos
 * diferentes: `fonte-supabase.ts` já corta no banco (`.is("deleted_at", null)`)
 * e entrega linhas sem a coluna; a rota traz a coluna e corta aqui. Ausente ⇒
 * viva, que é exatamente o que "já foi cortada no banco" significa.
 */
export interface LinhaDeMatricula {
  student_id: string
  status: string | null
  deleted_at?: string | null
}

export interface ResumoDeMatriculas {
  /** Quantas matrículas VIVAS cada aluno tem. */
  matriculadasPorAluno: ReadonlyMap<string, number>
  /** Quantas dessas estão `completed`. */
  completadasPorAluno: ReadonlyMap<string, number>
  /** Quem concluiu: ao menos uma viva, e TODAS as vivas `completed`. */
  concluidos: ReadonlySet<string>
}

/**
 * Conta matrículas vivas por aluno e deriva quem CONCLUIU.
 *
 * O critério é `matriculadas > 0 && completadas === matriculadas`, e as duas
 * metades importam:
 *   • `> 0` — quem não tem matrícula nenhuma NÃO concluiu. Tratar ausência como
 *     conclusão barraria gente que a Central alcança legitimamente;
 *   • `=== ` — uma matrícula ainda em curso derruba a conclusão. "Terminou um
 *     curso" não é "terminou a jornada", e cobrar quem ainda tem trilha aberta é
 *     legítimo.
 */
export function resumirMatriculas(linhas: readonly LinhaDeMatricula[]): ResumoDeMatriculas {
  const matriculadasPorAluno = new Map<string, number>()
  const completadasPorAluno = new Map<string, number>()
  for (const linha of linhas) {
    // Matrícula apagada não conta para nenhum dos dois lados da fração: contá-la
    // só no denominador tiraria a conclusão de quem de fato terminou, e contá-la
    // só no numerador daria conclusão a quem não terminou.
    if (linha.deleted_at != null) continue
    const id = linha.student_id
    matriculadasPorAluno.set(id, (matriculadasPorAluno.get(id) ?? 0) + 1)
    if (linha.status === "completed") {
      completadasPorAluno.set(id, (completadasPorAluno.get(id) ?? 0) + 1)
    }
  }
  const concluidos = new Set<string>()
  for (const [id, matriculadas] of matriculadasPorAluno) {
    if (matriculadas > 0 && completadasPorAluno.get(id) === matriculadas) concluidos.add(id)
  }
  return { matriculadasPorAluno, completadasPorAluno, concluidos }
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
 * O NÚCLEO da regra: cobrança não alcança quem concluiu.
 *
 * Recebe o conjunto de concluídos já resolvido, e por isso NÃO tem eixo de
 * ignorância — quem chama daqui (o servidor) sabe de todo mundo, porque leu as
 * matrículas com sucesso; ausência do conjunto é o fato "não concluiu", não a
 * falta de informação. O eixo de ignorância é do CLIENTE, e vive em
 * `triarDestinatarios`, que delega para cá.
 */
export function triarPorConclusao(
  ids: readonly string[],
  tipo: NudgeType,
  concluidos: ReadonlySet<string>,
): { permitidos: readonly string[]; bloqueadosPorConclusao: readonly string[] } {
  if (!ehCobranca(tipo)) {
    // Reconhecimento e comunicado alcançam todo mundo do recorte, inclusive
    // quem concluiu — é literalmente para quem chegou ao fim que a §29 regra D
    // manda reconhecer.
    return { permitidos: ids, bloqueadosPorConclusao: [] }
  }
  const permitidos: string[] = []
  const bloqueadosPorConclusao: string[] = []
  for (const id of ids) (concluidos.has(id) ? bloqueadosPorConclusao : permitidos).push(id)
  return { permitidos, bloqueadosPorConclusao }
}

/**
 * Separa os destinatários de um acionamento em liberados e barrados.
 *
 * Nunca lança e nunca esvazia em silêncio: quem chama recebe as três listas e é
 * obrigado a mostrá-las. Sumir com o bloqueado seria o mesmo defeito de I-3 num
 * lugar pior — o gestor confirmaria "4 pessoas" e 2 sairiam, sem nada na tela.
 *
 * É o invólucro do CLIENTE sobre `triarPorConclusao`: a tela pode não saber o
 * estado de um id (preview sem roster, id fora do recorte), e não saber não
 * autoriza cobrar. Resolvida a ignorância, a decisão é a mesma função do
 * servidor.
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

  // Primeiro o eixo que só o cliente tem: quem a tela não sabe quem é. Estado
  // desconhecido é barrado mesmo em reconhecimento/comunicado — o gate de
  // escopo do servidor já descarta id fora do alcance, e mandar mensagem para
  // alguém que a tela não identifica não tem leitura defensável.
  const conhecidos: string[] = []
  const semEstado: string[] = []
  const concluidos = new Set<string>()
  for (const id of ids) {
    const estado = mapa.get(id)
    if (estado === undefined) {
      semEstado.push(id)
      continue
    }
    conhecidos.push(id)
    if (estado === "concluido") concluidos.add(id)
  }

  // Resolvida a ignorância, a decisão é a MESMA do servidor.
  const nucleo = triarPorConclusao(conhecidos, tipo, concluidos)
  return {
    permitidos: nucleo.permitidos,
    bloqueadosPorConclusao: nucleo.bloqueadosPorConclusao,
    bloqueadosPorEstadoDesconhecido: semEstado,
  }
}
