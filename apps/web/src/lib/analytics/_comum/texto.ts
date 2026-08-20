// ---------------------------------------------------------------------------
// Vocabulário compartilhado dos quatro geradores de texto do Analytics.
// ---------------------------------------------------------------------------
// Existe por causa de dois defeitos MEDIDOS no catálogo das 27 frases emissíveis
// (auditoria de 2026-08-19):
//
//   1. PLURAL FIXO. "Todas estavam em dia no cronograma quando pararam." saía
//      para UMA pessoa no tenant real. Três das quatro regras de §29 tinham a
//      concordância presa no literal, e nenhuma delas errava enquanto a fixture
//      rica (dezenas de pessoas) fosse a única exercitada. A base real é 6.
//
//   2. PERCENTUAL SEM BASE. "66% da equipe já concluiu" são 4 pessoas de 6, e o
//      gestor de 6 pessoas decide sobre NOMES, não sobre populações. Percentual
//      em base pequena não é resumo, é ampliação: uma pessoa vale 17 p.p.
//
// A defesa não é disciplina de quem escreve a frase, é não haver como escrever
// errado: quem precisa de "pessoas" chama `contagem(n, ...)`, e quem publica um
// percentual em base pequena chama `comBase(...)`. As duas primitivas cabem em
// dez linhas — o que elas compram é que a próxima regra §29 nasça concordando.
// ---------------------------------------------------------------------------

/** A PALAVRA que concorda com `n`. Nunca a contagem junto. */
export function pluralDe(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural
}

/** "1 pessoa" · "3 pessoas". A contagem nunca sai sem o substantivo (I-3). */
export function contagem(n: number, singular: string, plural: string): string {
  return `${n} ${pluralDe(n, singular, plural)}`
}

/**
 * "4 de 6" — os dois lados absolutos.
 *
 * É a forma canônica de publicar uma proporção nesta obra. O percentual, quando
 * acompanha, vem DEPOIS e entre parênteses: o número que o gestor age sobre é a
 * contagem, o percentual é contexto.
 */
export function comBase(n: number, total: number): string {
  return `${n} de ${total}`
}

/**
 * "4 de 6 (66%)". Sem base o percentual não sai — é a regra D-2.
 *
 * ═══ O LIMIAR DE "BASE PEQUENA" É DECLARADO, E ELE É ZERO ═══════════════════
 * A pergunta natural — "a partir de que N o percentual passa a poder viajar
 * sozinho?" — não tem resposta boa. Qualquer corte (6? 10? 30?) seria um número
 * mágico defendido depois com argumento inventado, e a tela não sabe se as 30
 * pessoas do recorte são 30 de 30 ou 30 de 4.000. Então a regra desta obra NÃO
 * é um limiar: é uma repartição de superfícies.
 *
 *   • TILE / campo de valor: publica o percentual NU. É a superfície desenhada
 *     para um número só, e D-1 a designa como a ÚNICA publicadora dele.
 *   • PROSA (texto, descricao, contexto, textoVazio, textoComplementar): nunca
 *     percentual sozinho. Ou os dois lados absolutos, ou os dois lados MAIS o
 *     percentual entre parênteses — que é o que esta função escreve.
 *
 * Consequência prática: hoje NENHUMA prosa dos quatro geradores publica
 * percentual, então esta função não tem chamador em produção. Ela não é resto
 * esquecido — é o caminho sancionado para o dia em que uma prosa precisar de um,
 * e existe pelo mesmo motivo que `contagem` existe: a alternativa é interpolar à
 * mão, e cópia interpolada à mão foi exatamente o defeito corrigido duas vezes
 * nesta camada (o texto de cobertura de `padroes-tendencias/sinais.ts` divergiu
 * na concordância por ter sido reescrito em vez de chamado).
 */
export function comBaseEPercentual(n: number, total: number): string {
  if (total <= 0) return comBase(n, total)
  return `${comBase(n, total)} (${Math.round((n / total) * 100)}%)`
}

/**
 * "12", "12 e 19", "12, 19 e 26" — e com teto: "12, 19, 26 e mais 2".
 *
 * O teto existe porque a lista vive num card de três linhas: 20 nomes não são
 * mais informação, são a mesma informação ilegível. `teto` conta os itens
 * VISÍVEIS; o resto é resumido, nunca cortado em silêncio.
 */
export function listaEmPortugues(
  itens: readonly string[],
  teto = Number.POSITIVE_INFINITY,
): string {
  const visiveis = itens.slice(0, teto)
  const resto = itens.length - visiveis.length
  if (visiveis.length === 0) return ""
  const corpo =
    visiveis.length === 1
      ? (visiveis[0] as string)
      : `${visiveis.slice(0, -1).join(", ")} e ${visiveis[visiveis.length - 1]}`
  if (resto <= 0) return corpo
  return `${visiveis.join(", ")} e mais ${resto}`
}

/** Somente o PRIMEIRO nome (C-35): a tela apoia, não expõe. */
export function primeiroNome(nomeCompleto: string): string {
  return nomeCompleto.trim().split(/\s+/)[0] ?? ""
}
