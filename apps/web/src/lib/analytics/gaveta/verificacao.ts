// ---------------------------------------------------------------------------
// O PORTÃO QUE TORNA A IA ACEITÁVEL NESTA CASA.
// ---------------------------------------------------------------------------
// A garantia "o número que ela cita vem da camada de dados, nunca do modelo" não
// pode viver só no prompt. Prompt é pedido; um pedido não é um gate. Este
// arquivo é o gate: depois que o modelo escreve, TODO número que ele imprimiu é
// conferido contra o conjunto fechado de números que a camada de dados já havia
// calculado. Sobrou um número que não está na lista ⇒ o texto inteiro é
// descartado e a tela mostra a leitura determinística.
//
// POR QUE ISSO É O DEFEITO CARO, e não uma preocupação teórica: um parágrafo bem
// escrito com um número inventado é mais perigoso que uma célula errada, porque
// ele soa como conclusão e ninguém confere prosa. O modo de falha real do
// gpt-4o-mini aqui não é escrever bobagem — é fazer a aritmética que o prompt
// proibiu ("caiu de 31 para 24, uma queda de 23%") e acertar quase sempre. O
// "quase" é o problema, e ele é invisível na leitura.
//
// A FUNÇÃO É PURA. Sem rede, sem env, sem React. É o que permite testá-la contra
// texto de modelo sem chamar modelo nenhum.
//
// LIMITE HONESTO, declarado e não escondido: a checagem alcança DÍGITOS. Um
// modelo que escreva "caiu pela metade" ou "quase um terço" passa por aqui, e
// nenhuma varredura mecânica pegaria isso sem virar análise semântica. É por
// isso que a saída é rotulada como INTERPRETAÇÃO na tela e a frase da regra
// continua visível ao lado — a defesa contra o que o gate não alcança é o
// enquadramento, não a esperança de que o modelo se comporte.
// ---------------------------------------------------------------------------

import type { LeituraAssistida } from "./tipos"

/**
 * Todo grupo de dígitos do texto, normalizado para comparação.
 *
 * `1.234` e `1234` são o mesmo número, e `62%` carrega o 62. Separador de milhar
 * cai; a vírgula decimal do português vira ponto para que `4,5` e `4.5` colidam
 * como devem. Números colados a `p.p.`, `%` ou pontuação final saem limpos
 * porque a extração pega o miolo numérico, não a palavra inteira.
 */
export function numerosDoTexto(texto: string): string[] {
  const brutos = texto.match(/\d[\d.,]*/g) ?? []
  return brutos.map(normalizarNumero).filter((n) => n.length > 0)
}

function normalizarNumero(bruto: string): string {
  // Tira pontuação pendurada no fim ("24." no fim da frase, "31,").
  let s = bruto.replace(/[.,]+$/, "")
  if (s.includes(",")) {
    // Vírgula em português: decimal se sobra 1-2 dígitos depois dela, senão
    // milhar. "4,5" ⇒ decimal. "1,234" ⇒ milhar.
    const partes = s.split(",")
    const ultima = partes[partes.length - 1] ?? ""
    s = ultima.length <= 2 && partes.length === 2 ? partes.join(".") : partes.join("")
  }
  // Ponto como milhar ("1.234") vira nada; ponto decimal ("4.5") permanece.
  if (s.includes(".")) {
    const partes = s.split(".")
    const ultima = partes[partes.length - 1] ?? ""
    s = ultima.length === 3 && partes.length >= 2 ? partes.join("") : s
  }
  // Zeros à esquerda não mudam o valor e não podem virar divergência.
  const semZeros = s.replace(/^0+(?=\d)/, "")
  return semZeros
}

/**
 * O conjunto FECHADO de números que o modelo tem direito de citar.
 *
 * Sai de três lugares, todos já calculados pela camada de dados e todos já
 * impressos na tela: os `fatos`, a frase da regra (que o modelo recebe como
 * matéria-prima) e os dois números de contexto do recorte. Nada mais entra.
 */
export function numerosPermitidos(leitura: LeituraAssistida): ReadonlySet<string> {
  const permitidos = new Set<string>()
  const somar = (texto: string) => {
    for (const n of numerosDoTexto(texto)) permitidos.add(n)
  }
  for (const fato of leitura.fatos) {
    somar(fato.rotulo)
    somar(fato.valor)
  }
  somar(leitura.leituraDeterministica)
  somar(leitura.acaoDeterministica)
  somar(String(leitura.periodoDias))
  somar(String(leitura.totalRecorte))
  return permitidos
}

export interface VeredictoNumerico {
  ok: boolean
  /** Os números que o modelo imprimiu e a camada de dados nunca produziu. */
  inventados: readonly string[]
}

/**
 * O veredito. `ok: false` ⇒ quem chama DESCARTA o texto do modelo inteiro.
 *
 * Descartar tudo, e não só a frase ofensora, é deliberado: um parágrafo em que
 * um número é inventado não tem como ser parcialmente confiável, e editar a
 * saída do modelo para "consertar" seria a casa assinando embaixo de um texto
 * que ela não escreveu nem verificou.
 */
export function conferirNumeros(texto: string, leitura: LeituraAssistida): VeredictoNumerico {
  const permitidos = numerosPermitidos(leitura)
  const inventados = numerosDoTexto(texto).filter((n) => !permitidos.has(n))
  return { ok: inventados.length === 0, inventados }
}
