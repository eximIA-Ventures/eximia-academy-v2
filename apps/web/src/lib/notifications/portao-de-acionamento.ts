// ---------------------------------------------------------------------------
// O PORTÃO DO ACIONAMENTO, do lado do SERVIDOR.
// ---------------------------------------------------------------------------
// DEFEITO QUE ESTE ARQUIVO FECHA (auditoria independente, 2026-08-19, tenant
// Cory Alimentos em PRODUÇÃO): o acionamento estava desligado no BOTÃO, não no
// servidor. As duas travas viviam no navegador:
//
//   • o interruptor era `acoesEstaoAtivas()`, que lê `NEXT_PUBLIC_*`. Uma
//     variável `NEXT_PUBLIC_*` é PÚBLICA por definição — ela chega ao bundle do
//     cliente para INFORMAR a interface. Ela nunca autorizou nada, e não tem
//     como autorizar: quem faz um POST com `curl` nem baixou o bundle;
//   • o filtro de quem CONCLUIU rodava dentro de um callback React
//     (`ProvedorAcoes.pedir`). `grep "process.env"` na rota voltava VAZIO, e
//     `dispatchTeamNudge` não olha conclusão.
//
// Consequência medida: quem concluiu o curso podia ser cobrado — pela Central
// de Engajamento (`send-center-tab.tsx`, que posta na MESMA rota sem passar por
// nenhum dos dois guardas) ou por um POST direto.
//
// A DECISÃO PASSA A SER DAQUI. O guard do cliente continua existindo como
// conveniência de interface (ele mostra ao gestor o que SERIA enviado antes de
// enviar), mas o veredito é do servidor.
//
// NÃO reimplementa o critério: a classificação de cobrança e a regra de
// conclusão vêm de `analytics/visao-geral/acionamento-alvo.ts`, o mesmo módulo
// puro que a tela usa. Duas implementações do mesmo critério divergem, e a
// divergência é literalmente o defeito que estamos fechando.
// ---------------------------------------------------------------------------

import {
  type LinhaDeMatricula,
  resumirMatriculas,
  triarPorConclusao,
} from "@/lib/analytics/visao-geral/acionamento-alvo"
import { createServiceClient } from "@/lib/supabase/service"
import type { NudgeType } from "@/types/notifications"

/** O único valor que ABRE o portão. Qualquer outro fecha. */
const VALOR_QUE_ABRE = "true"

/**
 * O acionamento está liberado NESTA instalação?
 *
 * Lê `ACIONAMENTO_ATIVO`, uma variável de SERVIDOR — deliberadamente NÃO
 * `NEXT_PUBLIC_ACIONAMENTO_ATIVO`, que é pública e continua governando apenas o
 * que a interface mostra.
 *
 * DUAS ESCOLHAS DE DESENHO, e as duas foram feitas de olhos abertos:
 *
 *   1. AUSENTE ⇒ LIBERADO. Nenhum `.env` deste repositório define a variável
 *      hoje, e a Central de Engajamento ESTÁ em produção postando nesta rota. Um
 *      interruptor que nascesse fechado tiraria a Central do ar no mesmo commit
 *      que fecha o buraco — o remédio viraria o próximo incidente. Fecha-se por
 *      DECISÃO explícita (`ACIONAMENTO_ATIVO=false`), nunca por omissão.
 *
 *   2. QUALQUER valor diferente de "true" ⇒ FECHADO. Allowlist de um valor só,
 *      e não uma denylist de "false". O erro de digitação que este desenho
 *      precisa sobreviver é o de quem QUIS desligar e escreveu `off`, `no`, `0`:
 *      nesse caso o portão fecha. O caminho perigoso é o inverso — alguém pensar
 *      que desligou e o envio continuar saindo para aluno real.
 */
export function acionamentoLiberadoNoServidor(): boolean {
  const bruto = process.env.ACIONAMENTO_ATIVO
  // Indefinida e vazia são o mesmo caso na prática: em boa parte dos ambientes
  // uma variável declarada sem valor é indistinguível de uma não declarada.
  if (bruto === undefined) return true
  const valor = bruto.trim().toLowerCase()
  if (valor === "") return true
  return valor === VALOR_QUE_ABRE
}

export interface TriagemDoServidor {
  /** Ids liberados, na ORDEM em que chegaram (nada de `sort`: I-8). */
  permitidos: readonly string[]
  /** Quem foi barrado por já ter concluído — contado, nunca sumido em silêncio. */
  bloqueadosPorConclusao: readonly string[]
}

/**
 * Erro de LEITURA. Não é "ninguém concluiu" — é "não sei quem concluiu", e não
 * saber não autoriza cobrar (I-4). Quem chama devolve 503 e não escreve nada.
 */
export interface FalhaDeLeitura {
  erro: string
}

export function ehFalhaDeLeitura(r: TriagemDoServidor | FalhaDeLeitura): r is FalhaDeLeitura {
  return "erro" in r
}

/**
 * A MESMA falha de leitura, quando ela precisa atravessar uma função que só sabe
 * lançar.
 *
 * As três primeiras rotas chamam `triarDestinatariosNoServidor` diretamente e
 * respondem 503 lendo o valor de retorno. A quarta (`approveSuggestion`) tem os
 * dados de que a triagem precisa DENTRO do motor, e o motor sinaliza erro
 * lançando — o chamador só vê `Error`. Sem um tipo distinguível, uma falha de
 * BANCO viraria 400 ("seu pedido está errado"), quando a verdade é 503 ("não
 * consegui verificar agora"). O tipo existe para não perder essa diferença, não
 * para reimplementar a decisão: a decisão continua sendo a de `ehFalhaDeLeitura`.
 */
export class FalhaAoVerificarConclusao extends Error {
  constructor(mensagem: string) {
    super(mensagem)
    this.name = "FalhaAoVerificarConclusao"
  }
}

/**
 * Decide, NO SERVIDOR, quem de fato pode receber este acionamento.
 *
 * Lê as matrículas dos destinatários (já re-escopados pela rota) e aplica o
 * MESMO `triarPorConclusao` que a tela aplica. O cliente é o de serviço
 * (RLS-imune) com `.eq("tenant_id")` explícito — a razão é fail-closed: sob RLS
 * uma matrícula invisível ao chamador viraria "aluno sem matrícula", que o
 * critério lê como "não concluiu", que libera a cobrança. A trava de escopo já
 * rodou antes daqui, então só chegam ids que o chamador pode alcançar.
 *
 * NÃO ESCREVE NADA. É leitura pura seguida de uma partição de lista.
 */
export async function triarDestinatariosNoServidor(params: {
  tenantId: string
  studentIds: readonly string[]
  nudgeType: NudgeType
}): Promise<TriagemDoServidor | FalhaDeLeitura> {
  const { tenantId, studentIds, nudgeType } = params
  if (studentIds.length === 0) return { permitidos: [], bloqueadosPorConclusao: [] }

  const db = createServiceClient()
  // `deleted_at` vem na projeção e é cortado em memória por `resumirMatriculas`,
  // em vez de um `.is("deleted_at", null)` no banco. A diferença é de forma, não
  // de resultado, e mantém a cadeia `select → eq → in` — a mesma que o resto das
  // leituras escopadas desta pasta usa.
  const { data, error } = await db
    .from("enrollments")
    .select("student_id, status, deleted_at")
    .eq("tenant_id", tenantId)
    .in("student_id", [...studentIds])

  // I-4: desestruturar `error` e TRATAR. Ler só `data` faria uma falha de banco
  // virar lista vazia, lista vazia virar "ninguém concluiu", e o portão abrir
  // exatamente quando o banco está pior.
  if (error) {
    return { erro: `Não foi possível verificar quem concluiu: ${error.message}` }
  }

  const { concluidos } = resumirMatriculas((data ?? []) as LinhaDeMatricula[])
  const nucleo = triarPorConclusao(studentIds, nudgeType, concluidos)
  return {
    permitidos: nucleo.permitidos,
    bloqueadosPorConclusao: nucleo.bloqueadosPorConclusao,
  }
}
