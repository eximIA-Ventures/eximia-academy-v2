// ---------------------------------------------------------------------------
// D-5 — supressão de redundância entre cards da MESMA tela, por mecanismo.
// ---------------------------------------------------------------------------
// O defeito medido: a tabela "Quem precisa da minha atenção agora?" nomeia
// Venilton com o rótulo "Não iniciou" e o subtexto "Nunca acessou"; oito
// centímetros abaixo, o card "Sinais fora do padrão" diz "Venilton ainda não
// iniciou a jornada." Mesma pessoa, mesma tela, mesmo scroll, zero fato novo.
// Repetição não reforça, dilui: o gestor lê o segundo e conclui que a tela está
// enrolando — e passa a não ler o primeiro.
//
// ═══ POR QUE ISTO É UM MECANISMO, E NÃO UM `if` PARA O CASO DO VENILTON ══════
// Um `if (estado === "nao-iniciou") continue` resolveria a linha e deixaria a
// PRÓXIMA repetição nascer sem defesa. O que este módulo declara é a moeda:
// cada frase carrega os FATOS que afirma sobre um SUJEITO, e só é suprimida
// quando TODOS os seus fatos já foram ditos por outro card. É por isso que:
//
//   • "Venilton ainda não iniciou a jornada."           → fato {estado} → some.
//   • "Elisa está há 97 dias sem acessar. Seu padrão
//      habitual era a cada 7 dias."                     → fatos {estado,
//      ritmo-próprio} → FICA, porque o ritmo próprio dela não está em lugar
//      nenhum da tela. Ela aparece nas duas superfícies, e deve.
//
// Suprimir por PESSOA seria o remédio errado: mataria a melhor frase da obra.
//
// ═══ POR QUE PERGUNTAR AO BLOCO, EM VEZ DE REPRODUZIR O CRITÉRIO DELE ════════
// `fatosDaTabelaDeAtencao` recebe a SAÍDA REAL do outro bloco, não uma cópia da
// regra que o monta. Reimplementar aqui "quem entra na fila prioritária"
// (estados de urgência, ordenação, corte em `LINHAS_PRIORITARIAS_MAX`) criaria
// uma segunda implementação do mesmo critério — que é exatamente a família de
// defeito que esta camada combate em todo lugar (um denominador só, um limiar
// só). O preço é montar o bloco de atenção uma segunda vez: função pura sobre
// mapas já em memória, sem consulta nova ao banco.
//
// Consequência DESEJADA e testada: quando a tabela não pode falar (bloco em
// `erro` por falha de `matriculas`, que não é fonte dos sinais), ela não nomeia
// ninguém, nada é suprimido, e o sinal volta a ser a única voz sobre quem nunca
// começou. A supressão acompanha o que a tela REALMENTE mostrou.
// ---------------------------------------------------------------------------

/** Uma afirmação sobre um sujeito (pessoa, módulo ou "equipe"). */
export interface Fato {
  sujeito: string
  chave: string
}

export function chaveDoFato(f: Fato): string {
  return `${f.chave}@${f.sujeito}`
}

export function registrarFatos(fatos: Iterable<Fato>): ReadonlySet<string> {
  const out = new Set<string>()
  for (const f of fatos) out.add(chaveDoFato(f))
  return out
}

/**
 * A frase é redundante quando NENHUM dos fatos dela é novo.
 *
 * Candidato sem fato declarado NUNCA é suprimido: o default é falar. Silêncio
 * por omissão de metadado seria a pior falha possível deste mecanismo.
 */
export function todosJaDitos(
  fatosDoCandidato: readonly Fato[],
  jaDitos: ReadonlySet<string>,
): boolean {
  if (fatosDoCandidato.length === 0) return false
  return fatosDoCandidato.every((f) => jaDitos.has(chaveDoFato(f)))
}

/** Chave canônica do fato "o estado da jornada desta pessoa". */
export const FATO_ESTADO = "estado-da-jornada"
/** Chave canônica do fato "há quanto tempo esta pessoa não aparece". */
export const FATO_ULTIMA_ATIVIDADE = "ultima-atividade"
/** Chave canônica do fato "o ritmo habitual DELA MESMA". Ninguém mais publica. */
export const FATO_RITMO_PROPRIO = "ritmo-proprio"

/**
 * O que a tabela de atenção JÁ DIZ, lido da saída dela.
 *
 * Cada linha publicada afirma dois fatos sobre a pessoa: o estado (coluna
 * "Sinal", via `ROTULO_ESTADO`) e a última atividade (coluna homônima). Os
 * segmentos da fileira acima da tabela ficam de fora de propósito: eles contam
 * quantas pessoas há em cada estado e não NOMEIAM ninguém, então não tornam
 * redundante uma frase sobre alguém específico.
 *
 * Tipagem estrutural para este módulo não depender dos tipos de uma aba: quem
 * chama passa o bloco montado, e o compilador confere a forma.
 */
export function fatosDaTabelaDeAtencao(
  bloco: { estado: "ok" | "vazio" | "erro"; linhas: readonly { alunoId: string }[] },
  estadoPorAluno: ReadonlyMap<string, string>,
): Fato[] {
  if (bloco.estado === "erro") return []
  const out: Fato[] = []
  for (const linha of bloco.linhas) {
    const estado = estadoPorAluno.get(linha.alunoId)
    if (estado !== undefined)
      out.push({ sujeito: linha.alunoId, chave: `${FATO_ESTADO}:${estado}` })
    out.push({ sujeito: linha.alunoId, chave: FATO_ULTIMA_ATIVIDADE })
  }
  return out
}
