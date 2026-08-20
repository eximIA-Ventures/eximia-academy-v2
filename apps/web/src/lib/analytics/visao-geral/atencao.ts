// ---------------------------------------------------------------------------
// §10 — "Quem precisa da minha atenção agora?": 4 segmentos + fila prioritária.
// ---------------------------------------------------------------------------
// I-8 é o invariante que governa este bloco, e ele é fácil de violar sem
// perceber: uma lista "ordenada por gravidade" é a definição operacional de um
// pódio invertido. Três defesas concretas, e nenhuma delas é comentário:
//
//   1. Sem numeração de posição e sem coluna de nota — a UI recebe `linhas`,
//      não `linhas com rank`.
//   2. A ordenação é por ESTADO (categoria), não por desempenho contínuo.
//      Duas pessoas no mesmo estado empatam; o desempate é tempo sem acesso,
//      que é urgência de apoio, não mérito.
//   3. Os 4 segmentos saem em ordem FIXA (D-19), nunca ordenados por valor —
//      senão o card maior migra para a esquerda e vira placar.
//
// OS 4 SEGMENTOS NÃO SÃO UMA PARTIÇÃO, e a tela passa a dizer isso em voz alta.
// A §4 define SEIS estados e a §10 pede QUATRO cards; "Concluído" e "Retomando"
// contam no denominador do placar e não aparecem em nenhuma pílula. Quem somasse
// os quatro números e comparasse com a base encontrava gente sumida — medido na
// tela do dono: base 6, segmentos somando 2, as 4 ausentes eram as 4 formadas.
// A superfície disso é `notaCobertura` (abaixo), não um quinto card: a fileira
// não tem largura para cinco pílulas sem estourar o conteúdo para fora.
//
// O RÓTULO DA AÇÃO vem da taxonomia canônica (`student-triage.ts`), não da
// projeção §4 usada no SINAL. Não é inconsistência: o botão dispara um nudge, e
// o `nudgeType` daquele nudge é decidido pela triagem canônica. Se o rótulo
// discordasse dela, o gestor leria "Apoiar" e o sistema enviaria o texto de
// reativação.
// ---------------------------------------------------------------------------

import { computeStudentAction } from "@/lib/student-triage"
import type { BaseCalculo } from "./base"
import { type FalhasPorFonte, primeiraFalha } from "./fonte"
import { LINHAS_PRIORITARIAS_MAX } from "./parametros"
import { ROTULO_ESTADO, VAZIO_GARGALOS, VAZIO_SEM_ESCOPO, rotuloUltimaAtividade } from "./textos"
import type { BlocoAtencao, ComEstado, EstadoJornada, LinhaPrioritaria, Tom } from "./tipos"

const FONTES_DA_ATENCAO = ["roster", "sessoes", "reflexoes", "matriculas", "cursos"] as const

/** Estados que entram na fila, em ordem de urgência de APOIO (não de mérito). */
const ORDEM_DE_URGENCIA: readonly EstadoJornada[] = ["nao-iniciou", "parado", "perdendo-ritmo"]

const TOM_DO_SINAL: Record<string, Tom> = {
  "nao-iniciou": "red",
  parado: "red",
  "perdendo-ritmo": "amber",
}

/** "1 pessoa" / "4 pessoas" — a nota nunca escreve o numeral sozinho (I-3). */
function contagem(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`
}

/**
 * Por que a soma dos 4 segmentos não fecha com a base do placar.
 *
 * A §10 pede quatro cards (Perdendo ritmo · Parados · Não iniciaram ·
 * Sustentando) e a §4 define SEIS estados. Os dois sem card — "Concluído" e
 * "Retomando" — existem no cálculo, contam no denominador do placar e não
 * aparecem em lugar nenhum desta fileira. Sem esta nota, o bloco afirma
 * implicitamente uma partição que não é partição, e o gestor que soma os quatro
 * números e compara com a base do placar encontra gente faltando.
 *
 * DUAS DECISÕES QUE MUDAM O TEXTO:
 *
 *   1. Um QUINTO card ("Concluíram") não cabe. A fileira tem 760px úteis para
 *      4 pílulas de 182,9, e o rótulo mais longo já ocupa 154,1 de conteúdo
 *      mínimo; com 5 colunas cada pílula fica com 144,4 e o conteúdo estoura
 *      para fora, em silêncio (as pílulas são `whitespace-nowrap`). A §29 e a
 *      §10 também não escrevem esse card — inventá-lo seria spec nova, não
 *      superfície de estado existente.
 *   2. `null` quando a soma FECHA. Nota que diz "0 pessoas fora" é ruído, e a
 *      tela só deve falar quando tem o que dizer.
 *
 * O RESÍDUO é declarado. `total − soma − concluídos − retomando` deveria ser
 * sempre 0 (todo id do roster recebe um estado em `montarBase`), mas se algum
 * dia deixar de ser, a nota diz "em outro estado" em vez de mentir a aritmética.
 */
export function notaDeCobertura(args: {
  total: number
  soma: number
  concluidos: number
  retomando: number
}): string | null {
  const fora = args.total - args.soma
  if (fora <= 0) return null

  const partes: string[] = []
  if (args.concluidos > 0) partes.push(contagem(args.concluidos, "concluiu", "concluíram"))
  if (args.retomando > 0) partes.push(contagem(args.retomando, "retomou", "retomaram"))
  const residuo = fora - args.concluidos - args.retomando
  if (residuo > 0) partes.push(`${residuo} em outro estado`)
  if (partes.length === 0) return null

  const pessoas = args.total === 1 ? "pessoa" : "pessoas"
  return `Os 4 segmentos somam ${args.soma} de ${args.total} ${pessoas}. Fora deles: ${partes.join(" e ")}.`
}

function subtextoDoSinal(
  estado: EstadoJornada,
  dias: number | null,
  progresso: number,
  esperado: number | undefined,
): string {
  if (estado === "nao-iniciou") return "Nunca acessou"
  if (dias !== null && estado === "parado") return `Sem acesso há ${dias} dias`
  // "Frequência caiu" seria um número inventado: a série semanal por pessoa não
  // existe em lugar nenhum do banco. O que EXISTE é a comparação com o ritmo
  // esperado, então é ela que o subtexto afirma.
  if (esperado !== undefined && progresso < esperado) return "Progresso abaixo do esperado"
  if (dias !== null) return `Sem acesso há ${dias} dias`
  return "Precisa de apoio"
}

export function montarAtencao(base: BaseCalculo, falhas: FalhasPorFonte): ComEstado<BlocoAtencao> {
  const moldura = {
    titulo: "Quem precisa da minha atenção agora?",
    linkRodape: "Ver todas as pessoas",
    cabecalhosTabela: ["Pessoa", "Sinal", "Última atividade", "Próxima ação"],
  }

  const falha = primeiraFalha(falhas, FONTES_DA_ATENCAO)
  if (falha) {
    return {
      ...moldura,
      segmentos: [],
      linhas: [],
      notaCobertura: null,
      estado: "erro",
      erro: falha,
      textoVazio: null,
      motivoVazio: "falha-de-leitura",
    }
  }
  if (base.roster.size === 0) {
    return {
      ...moldura,
      segmentos: [],
      linhas: [],
      notaCobertura: null,
      estado: "vazio",
      erro: null,
      textoVazio: VAZIO_SEM_ESCOPO,
      motivoVazio: "sem-escopo",
    }
  }

  const contar = (estado: EstadoJornada): number =>
    [...base.estadoPorAluno.values()].filter((e) => e === estado).length

  // Ordem FIXA (D-19). Nunca `sort` por `valor`.
  const segmentos = [
    {
      id: "perdendo-ritmo",
      rotulo: "Perdendo ritmo",
      valor: contar("perdendo-ritmo"),
      icone: "trending-down",
      iconeTom: "red" as Tom,
    },
    {
      id: "parados",
      rotulo: "Parados",
      valor: contar("parado"),
      icone: "pause-circle",
      iconeTom: "amber" as Tom,
    },
    {
      id: "nao-iniciaram",
      rotulo: "Não iniciaram",
      valor: contar("nao-iniciou"),
      icone: "circle-dashed",
      iconeTom: "amber" as Tom,
    },
    {
      id: "sustentando",
      rotulo: "Sustentando",
      valor: contar("sustentando"),
      icone: "check-circle",
      iconeTom: "green" as Tom,
    },
  ]

  // A nota é calculada sobre a MESMA fileira que sai daqui: soma o `valor` dos
  // segmentos realmente publicados, em vez de reafirmar os 4 estados por fora.
  // Se alguém acrescentar ou remover um card acima, a aritmética acompanha
  // sozinha — não há segunda lista de estados para esquecer de atualizar.
  const notaCobertura = notaDeCobertura({
    total: base.roster.size,
    soma: segmentos.reduce((acumulado, s) => acumulado + s.valor, 0),
    concluidos: contar("concluido"),
    retomando: contar("retomando"),
  })

  const candidatos = [...base.roster].filter((id) => {
    const estado = base.estadoPorAluno.get(id)
    return estado !== undefined && ORDEM_DE_URGENCIA.includes(estado)
  })

  if (candidatos.length === 0) {
    return {
      ...moldura,
      segmentos,
      linhas: [],
      notaCobertura,
      estado: "vazio",
      erro: null,
      textoVazio: VAZIO_GARGALOS,
      motivoVazio: "sem-gargalos",
    }
  }

  const ordenados = candidatos.sort((a, b) => {
    const ua = ORDEM_DE_URGENCIA.indexOf(base.estadoPorAluno.get(a) ?? "sustentando")
    const ub = ORDEM_DE_URGENCIA.indexOf(base.estadoPorAluno.get(b) ?? "sustentando")
    if (ua !== ub) return ua - ub
    const da = base.diasSemAtividadePorAluno.get(a) ?? Number.POSITIVE_INFINITY
    const db = base.diasSemAtividadePorAluno.get(b) ?? Number.POSITIVE_INFINITY
    if (da !== db) return db - da
    // Desempate final ESTÁVEL pelo id, para o render não oscilar entre cargas.
    return a.localeCompare(b)
  })

  const linhas: LinhaPrioritaria[] = ordenados.slice(0, LINHAS_PRIORITARIAS_MAX).map((id, i) => {
    const estado = base.estadoPorAluno.get(id) ?? "sustentando"
    const dias = base.diasSemAtividadePorAluno.get(id) ?? null
    const progresso = Math.round(base.progressoPorAluno.get(id) ?? 0)
    const esperado = base.esperadoPorAluno.get(id)
    const totalSessoes = base.sessoesPorAluno.get(id) ?? 0

    const acao = computeStudentAction(base.triagemPorAluno.get(id), totalSessoes)
    // `acionar` (atrasado ou nunca começou) → Reativar; `lembrar` (sumido mas
    // em dia no cronograma) → Apoiar. Os rótulos originais ("Acionar"/"Lembrar")
    // não passam no vocabulário da §10.2.
    const acaoRotulo: "Reativar" | "Apoiar" = acao?.kind === "acionar" ? "Reativar" : "Apoiar"

    return {
      id: `L${i + 1}`,
      alunoId: id,
      nome: base.nomePorAluno.get(id) ?? "Sem nome",
      iniciais: base.iniciaisPorAluno.get(id) ?? "?",
      avatarTone: base.tomAvatarPorAluno.get(id) ?? "neutral",
      sinalRotulo: ROTULO_ESTADO[estado] ?? "Precisa de apoio",
      sinalTom: TOM_DO_SINAL[estado] ?? "amber",
      sinalSubtexto: subtextoDoSinal(estado, dias, progresso, esperado),
      ultimaAtividadeLabel: rotuloUltimaAtividade(dias),
      acaoRotulo,
      acaoIcone: acaoRotulo === "Reativar" ? "user-plus" : "message-circle",
    }
  })

  return {
    ...moldura,
    segmentos,
    linhas,
    notaCobertura,
    estado: "ok",
    erro: null,
    textoVazio: null,
    motivoVazio: null,
  }
}
