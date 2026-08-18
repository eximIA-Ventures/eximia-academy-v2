// ---------------------------------------------------------------------------
// A GAVETA — o contrato do drill-down, compartilhado pelas três abas.
// ---------------------------------------------------------------------------
// A §30 da SPEC-FUNCIONAL define o padrão e ele é o mesmo nas três telas: "a
// pessoa é nível de INVESTIGAÇÃO, não aba principal. Qualquer indicador
// relevante pode ter *Ver pessoas*, abrindo drawer/modal lateral com: nome,
// status atual, curso, progresso, último acesso, frequência recente, sinal
// identificado, ação recomendada."
//
// Por que UM contrato e não três: as três abas falam da MESMA equipe. Três
// gavetas com três formas de descrever a mesma pessoa produzem três verdades
// sobre ela, e o gestor não tem como perceber qual está lendo. O mesmo
// raciocínio que fez `_trinca/recorte.ts` existir para o escopo vale aqui para
// a superfície de investigação.
//
// ═══ I-7 É ESTRUTURAL AQUI, NÃO DISCIPLINA ══════════════════════════════════
// A §30 lista o que NÃO pode aparecer nesta superfície: profundidade da
// reflexão, avaliação de competência, conteúdo privado da reflexão e
// interpretação psicológica. Isso é o invariante I-7, que é restrição LEGAL,
// não preferência de produto.
//
// A defesa é a FORMA do tipo: `PessoaDaGaveta` tem campos NOMEADOS e FECHADOS.
// Não existe `atributos: {rotulo, valor}[]`, não existe `extras`, não existe
// índice de string. Um campo novo que carregue conteúdo protegido precisa ser
// escrito aqui, com nome, e o teste `i-7-gaveta-nao-carrega-reflexao.test.ts`
// varre este arquivo procurando exatamente esses nomes. Um saco genérico de
// pares faria a varredura passar enquanto o conteúdo proibido viajava dentro
// dele — foi por isso que a forma frouxa foi descartada.
//
// `RecorteTabela` é genérico de propósito (é o "ver tudo" de listas de MÓDULO,
// SEMANA e MUDANÇA, não de pessoa) e por isso ele NUNCA é usado para pessoa: a
// gaveta de gente tem tipo próprio, e o discriminante `tipo` impede o
// deslizamento. Ver a nota em `ConteudoGaveta`.
// ---------------------------------------------------------------------------

import type { EstadoJornada, Tom } from "@/lib/analytics/visao-geral/tipos"

/**
 * Uma pessoa na gaveta — os OITO campos da §30, nem um a mais.
 *
 * Três deles admitem `null`, e isso é I-3 e não descuido: "progresso" e
 * "frequência recente" nem sempre são mensuráveis (curso sem prazo, pessoa sem
 * carimbo na janela), e a aba do Mapa mede posição acumulada, não frequência.
 * `null` vira frase explícita na tela ("Não medido nesta visão"), nunca `0%` —
 * que afirmaria sobre a pessoa algo que o dado não sustenta.
 */
export interface PessoaDaGaveta {
  id: string
  nome: string
  iniciais: string
  /** Derivado das INICIAIS, nunca do estado (D-13 / F-34c). */
  avatarTone: Tom
  estado: EstadoJornada
  /** §30 "status atual" — o vocabulário da §4, nunca nota nem mérito. */
  statusRotulo: string
  /** §30 "curso". Com o filtro em "Todos os cursos", o que a pessoa cursa. */
  cursoRotulo: string
  /** §30 "progresso". `null` = não mensurável neste recorte. */
  progressoLabel: string | null
  /** §30 "último acesso". Travessão de quem nunca acessou já vem pronto. */
  ultimoAcessoLabel: string
  /** §30 "frequência recente". `null` = a aba não mede frequência. */
  frequenciaLabel: string | null
  /** §30 "sinal identificado" — por que a pessoa entrou nesta lista. */
  sinalLabel: string
  /** §30 "ação recomendada". Apoio, nunca cobrança (I-8). */
  acaoLabel: string
}

/** Alinhamento de coluna da tabela. Só isso: não há formatação embutida. */
export type AlinhamentoColuna = "esquerda" | "direita"

export interface RecortePessoas {
  tipo: "pessoas"
  titulo: string
  subtitulo: string
  /**
   * A régua do recorte, renderizada dentro da gaveta (I-2). Diz de onde a lista
   * saiu e o que ela não é. Obrigatória: uma lista de gente sem a régua que a
   * gerou é a matéria-prima de um ranking involuntário.
   */
  nota: string
  /** Fila de triagem, NUNCA pódio: sem posição, sem numeral, sem nota (I-8). */
  pessoas: readonly PessoaDaGaveta[]
  /** Literal da §32 quando a lista está vazia. Nunca um numeral zero. */
  textoVazio: string
}

/**
 * ═══ O ÚNICO PONTO DE IA DESTAS TRÊS TELAS ═════════════════════════════════
 *
 * O que a IA faz aqui: REDIGE. O que ela não faz: calcular.
 *
 * `fatos` são os números JÁ CALCULADOS pela camada de dados, os mesmos que a
 * tela imprime. `leituraDeterministica` é a frase que as regras §29 produzem
 * sozinhas, e ela existe por dois motivos que se somam: é o que aparece quando
 * a IA falha ou não está configurada (degradação, não tela quebrada), e é a
 * referência contra a qual a leitura assistida pode ser comparada por quem lê.
 *
 * A §29 é explícita ("no MVP não é obrigatório usar IA generativa; pode começar
 * por regras"), e as regras determinísticas continuam sendo a fonte de TODA
 * recomendação da casa — auditáveis, baratas e incapazes de alucinar. A IA entra
 * onde a regra genuinamente não alcança: transformar quatro variações isoladas
 * numa leitura única em linguagem de gestor. Ela não substitui número nenhum.
 */
export interface LeituraAssistida {
  /** Os números da camada de dados. A IA só pode usar estes. */
  fatos: readonly { rotulo: string; valor: string }[]
  /** O que as regras §29 dizem sozinhas. É o fallback e a referência. */
  leituraDeterministica: string
  /** A ação que a regra sugere, sem IA nenhuma. */
  acaoDeterministica: string
  /** Contexto do recorte, para o modelo não inventar denominador. */
  periodoDias: number
  totalRecorte: number
}

export interface RecorteTabela {
  tipo: "tabela"
  titulo: string
  subtitulo: string
  nota: string
  colunas: readonly string[]
  /** Paralelo a `colunas`, mesmo comprimento. */
  alinhamentos: readonly AlinhamentoColuna[]
  /** Cada linha é paralela a `colunas`. Strings prontas: a gaveta não formata. */
  linhas: readonly (readonly string[])[]
  textoVazio: string
  /**
   * Presente em UM destino só (§16, "Ver todas as mudanças"). Opcional porque a
   * ausência é o estado normal: nenhuma outra gaveta desta casa chama modelo.
   */
  leituraAssistida?: LeituraAssistida
}

/**
 * O que a gaveta sabe mostrar.
 *
 * O discriminante `tipo` não é conveniência de renderização: ele é o que impede
 * uma lista de PESSOAS de ser servida pelo caminho genérico da tabela, onde
 * nenhuma varredura de I-7 alcançaria os campos. Pessoa entra por
 * `RecortePessoas` ou não entra.
 */
export type ConteudoGaveta = RecortePessoas | RecorteTabela

/** Rótulos da §4, num lugar só — as três abas dizem a mesma coisa. */
export const ROTULO_ESTADO: Record<EstadoJornada, string> = {
  sustentando: "Sustentando o ritmo",
  "perdendo-ritmo": "Perdendo ritmo",
  parado: "Parado",
  retomando: "Retomando",
  concluido: "Concluiu a jornada",
  "nao-iniciou": "Ainda não iniciou",
}

/**
 * A ação recomendada por estado (§29 e §10.2).
 *
 * QUEM CONCLUIU NÃO É COBRADO, e este mapa é um dos dois lugares onde isso é
 * enforçado. O outro é `visao-geral/acionamento-alvo.ts`, que barra o ENVIO.
 * Aqui é a FALA: o defeito medido na tela do dono em 2026-08-17 — "Apoiar 4
 * pessoas paradas" onde as 4 tinham CONCLUÍDO — passou primeiro pela frase e só
 * depois pelo destinatário. Fechar só o envio deixaria a tela continuar pedindo
 * a coisa errada.
 */
export const ACAO_POR_ESTADO: Record<EstadoJornada, string> = {
  sustentando: "Reconhecer o ritmo consistente",
  "perdendo-ritmo": "Apoiar antes que pare",
  parado: "Reativar a jornada",
  retomando: "Acompanhar a retomada",
  concluido: "Nada a acionar: a jornada foi concluída",
  "nao-iniciou": "Convidar para o primeiro acesso",
}
