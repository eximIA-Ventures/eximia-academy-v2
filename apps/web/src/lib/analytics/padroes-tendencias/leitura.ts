// ---------------------------------------------------------------------------
// A LEITURA DO PERÍODO — a regra primeiro, a IA depois (e só como redatora).
// ---------------------------------------------------------------------------
// Este arquivo produz duas coisas, nesta ordem de importância:
//
//   1. `leituraDeterministica` + `acaoDeterministica` — o que as regras da §29
//      dizem sozinhas, sem modelo nenhum. É o que a tela mostra por padrão e o
//      que ela continua mostrando se a IA falhar, se a chave não existir ou se o
//      gestor simplesmente não clicar. Nenhuma tela desta casa depende de modelo
//      para funcionar.
//
//   2. `fatos` — os números JÁ CALCULADOS, prontos como string, que o modelo
//      pode citar e nada além. É a trava contra o modo de falha caro: um
//      parágrafo bem escrito com um número inventado é mais perigoso que um
//      número errado numa célula, porque ele soa como conclusão.
//
// POR QUE A REGRA NÃO É SUBSTITUÍDA. A §29 permite regras determinísticas no
// MVP, e o caso de 2026-08-17 mostrou o valor delas: a tela mandou "Apoiar 4
// pessoas paradas" e as 4 tinham CONCLUÍDO. O defeito foi achado, nomeado e
// trancado por teste porque a regra estava escrita em algum lugar. Um modelo
// produziria a MESMA ação errada sobre pessoa real e não deixaria onde
// consertar. Regra é auditável; parágrafo não é.
//
// O QUE A IA ACRESCENTA, e é o único motivo de ela existir aqui: a tela mostra
// quatro variações isoladas (ativos, regularidade, módulos, retomadas) e o
// gestor tem que costurá-las na cabeça. Costurar é redação, não cálculo — é
// exatamente o que um modelo faz bem e uma regra faz mal.
//
// Função PURA. Não chama modelo, não lê `process.env`, não faz rede. Quem chama
// a API é o componente, por clique explícito do gestor.
// ---------------------------------------------------------------------------

import type { LeituraAssistida } from "@/lib/analytics/gaveta/tipos"
import type { BasePadroes } from "./base"
import { QUEDA_ACENTUADA_REL } from "./parametros"

function sinal(n: number, sufixo = ""): string {
  if (n > 0) return `+${n}${sufixo}`
  if (n < 0) return `−${Math.abs(n)}${sufixo}`
  return `0${sufixo}`
}

/**
 * A leitura que as REGRAS produzem.
 *
 * As duas primeiras frases seguem a §29 regra B (queda de ativos acima de 15%) e
 * o critério de regularidade da §16. A terceira nomeia o módulo de maior queda,
 * que é a regra A no eixo de módulo. Nenhuma delas depende de modelo.
 */
function frasesDaRegra(base: BasePadroes): { leitura: string; acao: string } {
  const atuais = base.visao.ativosNoPeriodo.size
  const anteriores = base.visao.ativosNoPeriodoAnterior.size
  const variacaoAtivos = anteriores > 0 ? (atuais - anteriores) / anteriores : null
  const pior = base.variacaoPorModulo[0]

  const partes: string[] = []

  if (variacaoAtivos === null) {
    partes.push(
      "Não há período anterior com atividade para comparar: os números abaixo descrevem o período atual, não uma tendência.",
    )
  } else if (variacaoAtivos <= QUEDA_ACENTUADA_REL) {
    partes.push(
      `A ativação caiu de ${anteriores} para ${atuais} pessoas, uma queda de ${Math.abs(Math.round(variacaoAtivos * 100))}%.`,
    )
  } else if (variacaoAtivos > 0) {
    partes.push(`A ativação subiu de ${anteriores} para ${atuais} pessoas.`)
  } else {
    partes.push(`A ativação ficou estável, em torno de ${atuais} pessoas ativas.`)
  }

  if (base.regularidade.deltaPp === null) {
    partes.push("A regularidade ainda não tem base anterior para comparação.")
  } else if (base.regularidade.deltaPp < 0) {
    partes.push(
      `A regularidade caiu ${Math.abs(base.regularidade.deltaPp)} p.p., para ${base.regularidade.taxaAtualPct}%.`,
    )
  } else {
    partes.push(`A regularidade está em ${base.regularidade.taxaAtualPct}%.`)
  }

  if (pior && pior.variacao < 0) {
    partes.push(
      `A maior queda por módulo está em "${pior.titulo}": ${pior.ativosAnterior} pessoas antes, ${pior.ativosAtual} agora.`,
    )
  }

  // A AÇÃO segue a mesma ordem de prioridade das regras §29: primeiro a queda de
  // ativação (regra B), depois a concentração por módulo (regra A), e o
  // reconhecimento (regra D) quando não há nada caindo.
  let acao: string
  if (variacaoAtivos !== null && variacaoAtivos <= QUEDA_ACENTUADA_REL) {
    acao =
      "A ativação caiu significativamente. Verifique quais grupos deixaram de acessar antes de agir por pessoa."
  } else if (pior && pior.variacao < 0) {
    acao = `Há concentração de queda em "${pior.titulo}". Considere uma sessão de apoio para esse módulo.`
  } else if (base.regularidade.deltaPp !== null && base.regularidade.deltaPp < 0) {
    acao = "A regularidade cedeu sem queda de ativação: o time entrou, mas voltou menos vezes."
  } else {
    acao =
      "Nenhum sinal de queda relevante no período. É momento de reconhecer quem sustentou o ritmo."
  }

  return { leitura: partes.join(" "), acao }
}

export function montarLeituraAssistida(base: BasePadroes): LeituraAssistida {
  const { leitura, acao } = frasesDaRegra(base)
  const atuais = base.visao.ativosNoPeriodo.size
  const anteriores = base.visao.ativosNoPeriodoAnterior.size
  const pior = base.variacaoPorModulo[0]

  return {
    // TODO número que a IA pode citar está nesta lista, e ela é fechada. O
    // prompt proíbe aritmética; esta lista é o que torna a proibição exequível.
    fatos: [
      { rotulo: "Pessoas ativas no período", valor: String(atuais) },
      { rotulo: "Pessoas ativas no período anterior", valor: String(anteriores) },
      { rotulo: "Variação de pessoas ativas", valor: sinal(atuais - anteriores) },
      { rotulo: "Regularidade atual", valor: `${base.regularidade.taxaAtualPct}%` },
      {
        rotulo: "Variação da regularidade",
        valor:
          base.regularidade.deltaPp === null
            ? "sem comparação"
            : sinal(base.regularidade.deltaPp, " p.p."),
      },
      { rotulo: "Sessões no período", valor: String(base.visao.sessoesNoPeriodo) },
      { rotulo: "Sessões no período anterior", valor: String(base.visao.sessoesNoPeriodoAnterior) },
      {
        rotulo: "Módulos em queda",
        valor: `${base.variacaoPorModulo.filter((m) => m.variacao < 0).length} de ${base.variacaoPorModulo.length} com base comparável`,
      },
      {
        rotulo: "Módulo de maior queda",
        valor: pior && pior.variacao < 0 ? pior.titulo : "nenhum",
      },
      { rotulo: "Pessoas que concluíram a jornada", valor: String(base.concluidos) },
      { rotulo: "Pessoas que nunca iniciaram", valor: String(base.naoIniciaram) },
    ],
    leituraDeterministica: leitura,
    acaoDeterministica: acao,
    periodoDias: Math.round(base.visao.janelas.duracaoMs / 86_400_000),
    totalRecorte: base.visao.roster.size,
  }
}
