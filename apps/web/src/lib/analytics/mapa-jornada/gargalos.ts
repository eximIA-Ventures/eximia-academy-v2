// ---------------------------------------------------------------------------
// §24 — Gargalos por módulo. F-08 a F-11.
// ---------------------------------------------------------------------------
// A população é: pessoa cujo `moduloCorrente` é `m` E cujo estado é `parado` ou
// `perdendo-ritmo`. O denominador do percentual é o ROSTER INTEIRO (F-01), não
// "quem chegou ao módulo" — é o mesmo denominador de F-16 e F-29, e é o que faz
// os três blocos falarem da mesma equipe.
//
// Os numerais 1..5 são POSIÇÃO DE MÓDULO, nunca de pessoa (F-34a).
// ---------------------------------------------------------------------------

import type { BaseMapa } from "./base"
import type { ChaveFonteMapa, FalhasPorFonteMapa } from "./fonte"
import { primeiraFalhaMapa } from "./fonte"
import { GARGALOS_MAX } from "./parametros"
import {
  ERRO_LEITURA,
  LINK_TODOS_MODULOS,
  SUBTITULO_GARGALOS,
  TITULO_GARGALOS,
  VAZIO_GARGALOS,
  VAZIO_SEM_ESCOPO,
} from "./textos"
import type { BlocoGargalos, LinhaGargalo, Tom } from "./tipos"

export const CHAVES_GARGALOS: readonly ChaveFonteMapa[] = [
  "roster",
  "matriculas",
  "cursos",
  "capitulos",
  "slides",
  "percorrido",
  "sessoes",
  "reflexoes",
]

/**
 * §31 · vermelho é RESERVADO ao gargalo mais grave e "evitar excesso". Só as
 * duas primeiras posições recebem tons quentes; da terceira em diante a escala
 * esfria. A cor é do MÓDULO, nunca da pessoa (F-34c).
 */
const TONS_POR_POSICAO: readonly Tom[] = ["red", "amber", "amber", "green", "blue"]

export interface ResultadoGargalos {
  bloco: BlocoGargalos
  /** Ordenação COMPLETA (antes do corte). F-17 e F-28 derivam daqui. */
  ordenados: readonly LinhaGargalo[]
  /** `moduloId → pessoas do numerador`, para F-18 não recalcular. */
  pessoasPorModulo: ReadonlyMap<string, readonly string[]>
}

export function montarGargalos(base: BaseMapa, falhas: FalhasPorFonteMapa): ResultadoGargalos {
  const falha = primeiraFalhaMapa(falhas, CHAVES_GARGALOS)
  const esqueleto = { titulo: TITULO_GARGALOS, subtitulo: SUBTITULO_GARGALOS } as const
  const vazioDe = (
    estado: "erro" | "vazio",
    texto: string,
    motivo: BlocoGargalos["motivoVazio"],
  ): BlocoGargalos => ({
    ...esqueleto,
    estado,
    erro: estado === "erro" ? falha : null,
    textoVazio: texto,
    motivoVazio: motivo,
    linhas: [],
    linkRodape: null,
  })

  if (falha) {
    return {
      bloco: vazioDe("erro", ERRO_LEITURA, null),
      ordenados: [],
      pessoasPorModulo: new Map(),
    }
  }

  const total = base.roster.length
  if (total === 0) {
    return {
      bloco: vazioDe("vazio", VAZIO_SEM_ESCOPO, "sem-escopo"),
      ordenados: [],
      pessoasPorModulo: new Map(),
    }
  }

  const pessoasPorModulo = new Map<string, string[]>()
  for (const alunoId of base.roster) {
    const estado = base.estadoPorAluno.get(alunoId)
    if (estado !== "parado" && estado !== "perdendo-ritmo") continue
    const moduloId = base.moduloCorrentePorAluno.get(alunoId)
    if (moduloId === undefined) continue
    const lista = pessoasPorModulo.get(moduloId) ?? []
    lista.push(alunoId)
    pessoasPorModulo.set(moduloId, lista)
  }

  if (pessoasPorModulo.size === 0) {
    return {
      bloco: vazioDe("vazio", VAZIO_GARGALOS, "sem-gargalos"),
      ordenados: [],
      pessoasPorModulo,
    }
  }

  const maior = Math.max(...[...pessoasPorModulo.values()].map((p) => p.length))

  // F-10 · decrescente por numerador; empate pela ordem do módulo (F-02) ASC.
  // Nunca pela ordem de chegada do banco — a saída tem de ser determinística.
  const posicaoNaGrade = new Map(base.colunas.map((c, i) => [c.id, i]))
  const ordenados: LinhaGargalo[] = [...pessoasPorModulo.entries()]
    .sort((a, b) => {
      if (b[1].length !== a[1].length) return b[1].length - a[1].length
      return (posicaoNaGrade.get(a[0]) ?? 0) - (posicaoNaGrade.get(b[0]) ?? 0)
    })
    .map(([moduloId, pessoas], i) => ({
      moduloId,
      // F-10 · o badge é a POSIÇÃO na lista (1..5), não o número do módulo. No
      // PNG as cinco linhas trazem `1 2 3 4 5` ao lado dos módulos 6, 7, 5, 4 e
      // 3; renderizar `numero` fazia a coluna de badges sair `6 4 2 5 3`.
      ordem: i + 1,
      numero: base.numeroPorCapitulo.get(moduloId) ?? 0,
      titulo: base.tituloPorCapitulo.get(moduloId) ?? "Sem título",
      pessoas: pessoas.length,
      pct: Math.round((pessoas.length / total) * 100),
      proporcao: maior > 0 ? pessoas.length / maior : 0,
      tom: TONS_POR_POSICAO[i] ?? "neutral",
    }))

  const linhas = ordenados.slice(0, GARGALOS_MAX)

  return {
    bloco: {
      ...esqueleto,
      estado: "ok",
      erro: null,
      textoVazio: null,
      motivoVazio: null,
      linhas,
      // Link para "todos" quando já se vê todos é ruído (F-10).
      linkRodape: ordenados.length > GARGALOS_MAX ? LINK_TODOS_MODULOS : null,
    },
    ordenados,
    pessoasPorModulo,
  }
}
