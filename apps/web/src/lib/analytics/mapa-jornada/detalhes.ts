// ---------------------------------------------------------------------------
// O DESTINO dos CTAs do Mapa — e as fichas da §30 desta aba.
// ---------------------------------------------------------------------------
// Seis elementos desta tela pareciam acionáveis e não eram: a pílula "Filtrar
// alunos", o "+ N alunos", "Ver todos os módulos", "Ver funil completo", "Ver
// pessoas (N)" e "Ver recomendações". Mais os nomes de aluno na matriz e na
// tabela de travados, que é a lacuna mais séria — a aba inteira fala de pessoas
// e nenhuma pessoa era clicável.
//
// Este arquivo produz o CONTEÚDO de cada um. Ele lê `BaseMapa` e os agregados
// que `montagem.ts` já calculou (gargalos ordenados, população por módulo,
// funil), e NÃO reconta nada: dois caminhos para o mesmo número divergem em
// silêncio, e nesta tela isso já aconteceu uma vez (72% no tile contra 71% na
// frase). Aqui o insight lê o agregado, como manda a cadeia de derivação
// documentada em `montagem.ts`.
//
// ═══ O QUE A FICHA DESTA ABA NÃO SABE, E DIZ QUE NÃO SABE ═══════════════════
// `frequenciaLabel` é `null` no Mapa, sempre. O Mapa mede POSIÇÃO ACUMULADA (é
// o que a régua F-33 publica na tela: matriz, distribuição e funil medem
// idêntico em 7, 30 e 90 dias), e frequência é fluxo de janela — quem a calcula
// é a base da Visão geral. Preencher esse campo com uma aproximação daria ao
// gestor um número que muda de aba para aba sobre a mesma pessoa. `null` vira
// "Não medido nesta visão" na gaveta, que é a verdade.
//
// I-7: `PessoaDaGaveta` não tem campo capaz de carregar reflexão, e este arquivo
// não lê nenhuma. O contrato do Mapa também não carrega (`tipos.ts` diz isso com
// todas as letras).
// ---------------------------------------------------------------------------

import {
  ACAO_POR_ESTADO,
  type ConteudoGaveta,
  type PessoaDaGaveta,
  ROTULO_ESTADO,
} from "@/lib/analytics/gaveta/tipos"
import type { BaseMapa } from "./base"
import { rotuloParadoHa, rotuloUltimaAtividade } from "./textos"
import type { EstadoCelula, LinhaFunil, LinhaGargalo, LinhaPessoa } from "./tipos"

/**
 * A régua que viaja com toda lista de gente desta aba.
 *
 * Repetida a partir da constante do componente de propósito? Não: o componente
 * exporta `NOTA_PESSOA` e ele é `"use client"`. Importá-lo aqui arrastaria a
 * fronteira de cliente para dentro da camada de dados. A frase é a mesma, e é
 * a única duplicação aceita — ela é literal de tela, não regra de cálculo.
 */
const NOTA_PESSOAS =
  "Fila de apoio, não classificação. Sem posição, sem nota e sem conteúdo de reflexão."

/**
 * §30 "curso". No Mapa a pessoa tem os cursos da trilha dela, e eles são
 * conhecidos (`cursosDoAluno` → `tituloPorCurso`) — diferente da Visão geral,
 * que agrega o período e por isso mostra o recorte.
 */
function cursosDe(base: BaseMapa, alunoId: string): string {
  const ids = base.cursosDoAluno.get(alunoId)
  if (!ids || ids.size === 0) return "Sem matrícula ativa neste recorte"
  const titulos = [...ids]
    .map((id) => base.tituloPorCurso.get(id))
    .filter((t): t is string => typeof t === "string")
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
  return titulos.length > 0 ? titulos.join(" · ") : "Curso sem título"
}

/**
 * §30 "progresso" — no Mapa, ele é MÓDULO CONCLUÍDO, não percentual de slide.
 *
 * É a unidade que esta aba inteira usa (a matriz, o funil, os gargalos). Trazer
 * o percentual da outra aba faria a ficha discordar da linha ao lado dela.
 */
function progressoDe(base: BaseMapa, alunoId: string): string | null {
  const celulas = base.celulaPorAluno.get(alunoId)
  const total = base.colunas.length
  if (!celulas || total === 0) return null
  let concluidos = 0
  for (const coluna of base.colunas) {
    if (celulas.get(coluna.id) === ("concluido" satisfies EstadoCelula)) concluidos++
  }
  return `${concluidos} de ${total} ${total === 1 ? "módulo concluído" : "módulos concluídos"}`
}

/** §30 "sinal identificado" — por que a pessoa aparece onde aparece. */
function sinalDe(base: BaseMapa, alunoId: string): string {
  const estado = base.estadoPorAluno.get(alunoId) ?? "sustentando"
  const dias = base.diasSemAtividadePorAluno.get(alunoId) ?? null
  const correnteId = base.moduloCorrentePorAluno.get(alunoId)
  const corrente = correnteId ? base.tituloPorCapitulo.get(correnteId) : undefined

  if (estado === "concluido") return "Concluiu todos os módulos da trilha"
  if (estado === "nao-iniciou") return "Matriculada e ainda sem nenhum módulo iniciado"
  const onde = corrente ? ` no módulo "${corrente}"` : ""
  if (estado === "parado") {
    return dias === null
      ? `Sem carimbo de atividade${onde}`
      : `Parada há ${rotuloParadoHa(dias)}${onde}`
  }
  if (estado === "retomando") return `Voltou a avançar${onde}`
  if (estado === "perdendo-ritmo") return `Avanço abaixo do esperado${onde}`
  return `Avançando${onde}`
}

export function fichaDoMapa(base: BaseMapa, alunoId: string): PessoaDaGaveta {
  const estado = base.estadoPorAluno.get(alunoId) ?? "sustentando"
  return {
    id: alunoId,
    nome: base.nomePorAluno.get(alunoId) ?? "Sem nome",
    iniciais: base.iniciaisPorAluno.get(alunoId) ?? "?",
    avatarTone: base.tomAvatarPorAluno.get(alunoId) ?? "neutral",
    estado,
    statusRotulo: ROTULO_ESTADO[estado],
    cursoRotulo: cursosDe(base, alunoId),
    progressoLabel: progressoDe(base, alunoId),
    ultimoAcessoLabel: rotuloUltimaAtividade(base.diasSemAtividadePorAluno.get(alunoId) ?? null),
    // Ver o cabeçalho: esta aba não mede frequência, e dizer isso é melhor que
    // inventar um número que discorda da aba vizinha.
    frequenciaLabel: null,
    sinalLabel: sinalDe(base, alunoId),
    acaoLabel: ACAO_POR_ESTADO[estado],
  }
}

export interface DetalhesMapa {
  /** `alunoId` → ficha da §30. Cobre TODO o roster, não só a amostra exibida. */
  fichaPorAluno: Readonly<Record<string, PessoaDaGaveta>>
  /**
   * A matriz COMPLETA, na mesma ordem alfabética da amostra.
   *
   * A tela mostra 8 linhas (F-06) e anuncia "+ N alunos". O rótulo era um
   * `<span>` cinza e o "N" não levava a lugar nenhum; com as linhas completas
   * aqui, ele passa a expandir, e a pílula "Filtrar alunos" passa a filtrar de
   * verdade. Nenhum corte foi removido: `BlocoMapa.linhas` continua sendo a
   * amostra, e é ela que o gauntlet fotografa.
   */
  matrizCompleta: readonly LinhaPessoa[]
  /** "Ver todos os módulos" — os gargalos além dos 5 do corte. */
  todosOsModulos: ConteudoGaveta
  /** "Ver funil completo" — o funil com a PERDA entre etapas, que a tabela não dá. */
  funilCompleto: ConteudoGaveta
  /** "Ver pessoas (N)" — a população COMPLETA do módulo âncora (F-21). */
  travados: ConteudoGaveta
}

export interface EntradaDetalhesMapa {
  base: BaseMapa
  /** Gargalos ORDENADOS, antes do corte de 5. */
  ordenados: readonly LinhaGargalo[]
  pessoasPorModulo: ReadonlyMap<string, readonly string[]>
  /** O módulo âncora dos travados, ou `null` quando não há concentração. */
  ancoraModuloId: string | null
  ancoraTitulo: string
  linhasFunil: readonly LinhaFunil[]
  matrizCompleta: readonly LinhaPessoa[]
}

export function montarDetalhesMapa(entrada: EntradaDetalhesMapa): DetalhesMapa {
  const { base, ordenados, pessoasPorModulo, ancoraModuloId, ancoraTitulo, linhasFunil } = entrada

  const fichaPorAluno: Record<string, PessoaDaGaveta> = {}
  for (const alunoId of base.roster) fichaPorAluno[alunoId] = fichaDoMapa(base, alunoId)

  const total = base.roster.length

  const todosOsModulos: ConteudoGaveta = {
    tipo: "tabela",
    titulo: "Gargalos por módulo — lista completa",
    subtitulo: `Todos os ${ordenados.length} módulos com pessoas paradas ou atrasadas.`,
    nota: `O card mostra os cinco maiores. O denominador é o recorte inteiro (${total} ${
      total === 1 ? "pessoa" : "pessoas"
    }), o mesmo do card.`,
    colunas: ["#", "Módulo", "Pessoas", "% do recorte"],
    alinhamentos: ["direita", "esquerda", "direita", "direita"],
    linhas: ordenados.map((g) => [
      String(g.ordem),
      `${g.numero}. ${g.titulo}`,
      String(g.pessoas),
      `${g.pct}%`,
    ]),
    textoVazio: "Nenhum gargalo relevante foi identificado neste período.",
  }

  /**
   * "Ver funil completo".
   *
   * A tabela do card JÁ lista todos os módulos — o CTA prometia mais e não
   * entregava. O que ela não mostra é a PERDA em cada degrau, que é exatamente a
   * pergunta da §35 ("onde ocorre maior perda entre chegada e conclusão"). Duas
   * colunas novas, derivadas das três que já existem, sem consulta nova.
   */
  const funilCompleto: ConteudoGaveta = {
    tipo: "tabela",
    titulo: "Funil completo, com a perda em cada degrau",
    subtitulo: "Onde a jornada perde gente entre chegar, iniciar e concluir.",
    nota: '"Chegaram" é constante por curso porque o produto não trava módulo. A perda relevante está nas duas últimas colunas.',
    colunas: [
      "Módulo",
      "Chegaram",
      "Iniciaram",
      "Perda ao iniciar",
      "Concluíram",
      "Perda ao concluir",
    ],
    alinhamentos: ["esquerda", "direita", "direita", "direita", "direita", "direita"],
    linhas: linhasFunil.map((l) => [
      `${l.numero}. ${l.titulo}`,
      String(l.chegaram),
      String(l.iniciaram),
      String(l.chegaram - l.iniciaram),
      String(l.concluiram),
      String(l.iniciaram - l.concluiram),
    ]),
    textoVazio: "Este curso ainda não tem módulos publicados.",
  }

  const populacao = ancoraModuloId ? (pessoasPorModulo.get(ancoraModuloId) ?? []) : []
  const travados: ConteudoGaveta = {
    tipo: "pessoas",
    titulo: ancoraTitulo ? `Travadas em "${ancoraTitulo}"` : "Pessoas travadas",
    subtitulo: `${populacao.length} ${populacao.length === 1 ? "pessoa" : "pessoas"} no mesmo ponto da jornada.`,
    nota: NOTA_PESSOAS,
    // A ORDEM é a da população do módulo, que já veio ordenada pelo agregado.
    // Reordenar aqui por "parado há mais tempo" criaria um pódio invertido.
    pessoas: populacao
      .map((id) => fichaPorAluno[id])
      .filter((p): p is PessoaDaGaveta => Boolean(p)),
    textoVazio: "Nenhum gargalo relevante foi identificado neste período.",
  }

  return {
    fichaPorAluno,
    matrizCompleta: entrada.matrizCompleta,
    todosOsModulos,
    funilCompleto,
    travados,
  }
}
