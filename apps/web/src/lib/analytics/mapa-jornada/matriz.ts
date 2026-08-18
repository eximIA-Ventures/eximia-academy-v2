// ---------------------------------------------------------------------------
// §23 — Mapa da jornada (a matriz). F-01 a F-07.
// ---------------------------------------------------------------------------
// A ordem das linhas é ALFABÉTICA pelo nome, nunca por gravidade: ordenar por
// "quem está pior" transformaria a coluna de pessoas num ranking (F-34/I-8), e
// o corte de amostra (F-06) passaria a significar "as 8 piores" em vez de "as 8
// primeiras". O corte é de ALTURA, e precisa continuar sendo.
// ---------------------------------------------------------------------------

import { ROTULO_ESTADO } from "@/lib/analytics/visao-geral/textos"
import type { EstadoJornada } from "@/lib/analytics/visao-geral/tipos"
import type { BaseMapa } from "./base"
import type { ChaveFonteMapa, FalhasPorFonteMapa } from "./fonte"
import { primeiraFalhaMapa } from "./fonte"
import { AMOSTRA_LINHAS } from "./parametros"
import {
  ERRO_LEITURA,
  REGUA_CINZA,
  ROTULO_CELULA,
  ROTULO_FILTRAR_ALUNOS,
  SUBTITULO_MAPA,
  TITULO_MAPA,
  VAZIO_NINGUEM_INICIOU,
  VAZIO_SEM_ESCOPO,
  VAZIO_SEM_MODULOS,
  rotuloAlunos,
  rotuloResto,
} from "./textos"
import type { BlocoMapa, EstadoCelula, FiltroInterno, ItemLegenda, LinhaPessoa } from "./tipos"

/** F-32 · de quais das oito leituras este bloco depende. */
export const CHAVES_MATRIZ: readonly ChaveFonteMapa[] = [
  "roster",
  "matriculas",
  "capitulos",
  "slides",
  "percorrido",
  "sessoes",
  "reflexoes",
]

/**
 * F-07 · ordem FIXA dos filtros, nunca ordenada por tamanho. O estado que cada
 * chip recorta vem da taxonomia canônica da §4, idêntica nas três telas.
 */
const FILTROS: readonly {
  id: FiltroInterno["id"]
  rotulo: string
  estado: EstadoJornada | null
}[] = [
  { id: "todos", rotulo: "Todos", estado: null },
  {
    id: "perdendo-ritmo",
    rotulo: ROTULO_ESTADO["perdendo-ritmo"] ?? "Perdendo ritmo",
    estado: "perdendo-ritmo",
  },
  { id: "parados", rotulo: "Parados", estado: "parado" },
  { id: "nao-iniciaram", rotulo: "Não iniciaram", estado: "nao-iniciou" },
  { id: "sustentando", rotulo: ROTULO_ESTADO.sustentando ?? "Sustentando", estado: "sustentando" },
]

const LEGENDA: readonly ItemLegenda[] = (
  ["concluido", "em-andamento", "nao-iniciado"] as const
).map((estado): ItemLegenda => ({ estado, rotulo: ROTULO_CELULA[estado] }))

/**
 * O ROSTER INTEIRO em linhas de matriz, ordem alfabética (pt-BR).
 *
 * Exportada porque a gaveta precisa das mesmas linhas SEM o corte de amostra
 * (`detalhes.ts`: o "+ N alunos" passou a expandir e a pílula "Filtrar alunos"
 * passou a filtrar). Duas construções da mesma linha divergiriam no dia em que
 * alguém mudasse a ordem ou o fallback de nome — e a matriz da tela deixaria de
 * bater com a matriz expandida, sem ninguém ter mudado filtro nenhum.
 *
 * `montarMatriz` continua cortando em `AMOSTRA_LINHAS` (F-06): o que mudou foi
 * de onde as linhas vêm, não quantas a tela mostra.
 */
export function linhasDaMatriz(base: BaseMapa): LinhaPessoa[] {
  return [...base.roster]
    .map((alunoId): LinhaPessoa => {
      const celulas = base.celulaPorAluno.get(alunoId)
      return {
        alunoId,
        nome: base.nomePorAluno.get(alunoId) ?? "Sem nome",
        iniciais: base.iniciaisPorAluno.get(alunoId) ?? "?",
        avatarTone: base.tomAvatarPorAluno.get(alunoId) ?? "neutral",
        estado: base.estadoPorAluno.get(alunoId) ?? "sustentando",
        celulas: base.colunas.map((c): EstadoCelula => celulas?.get(c.id) ?? "nao-iniciado"),
      }
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
}

export function montarMatriz(base: BaseMapa, falhas: FalhasPorFonteMapa): BlocoMapa {
  const falha = primeiraFalhaMapa(falhas, CHAVES_MATRIZ)

  const esqueleto = {
    titulo: TITULO_MAPA,
    subtitulo: SUBTITULO_MAPA,
    filtroRotulo: ROTULO_FILTRAR_ALUNOS,
    legenda: LEGENDA,
    textoRodape: REGUA_CINZA,
  } as const

  if (falha) {
    return {
      ...esqueleto,
      estado: "erro",
      erro: falha,
      textoVazio: ERRO_LEITURA,
      motivoVazio: null,
      totalAlunos: 0,
      totalAlunosLabel: "",
      filtros: [],
      colunas: [],
      linhas: [],
      exibidas: 0,
      resto: 0,
      rotuloResto: null,
    }
  }

  const totalAlunos = base.roster.length

  // F-01 · escopo sem ninguém: o bloco inteiro em vazio, nunca "0 alunos".
  if (totalAlunos === 0) {
    return {
      ...esqueleto,
      estado: "vazio",
      erro: null,
      textoVazio: VAZIO_SEM_ESCOPO,
      motivoVazio: "sem-escopo",
      totalAlunos: 0,
      totalAlunosLabel: "",
      filtros: [],
      colunas: [],
      linhas: [],
      exibidas: 0,
      resto: 0,
      rotuloResto: null,
    }
  }

  // F-02 · curso sem capítulo publicado.
  if (base.colunas.length === 0) {
    return {
      ...esqueleto,
      estado: "vazio",
      erro: null,
      textoVazio: VAZIO_SEM_MODULOS,
      motivoVazio: "sem-base",
      totalAlunos,
      totalAlunosLabel: rotuloAlunos(totalAlunos),
      filtros: [],
      colunas: [],
      linhas: [],
      exibidas: 0,
      resto: 0,
      rotuloResto: null,
    }
  }

  const todas = linhasDaMatriz(base)

  // F-05 · nenhuma célula não-cinza em lugar nenhum ⇒ ninguém iniciou.
  const alguemIniciou = todas.some((l) => l.celulas.some((c) => c !== "nao-iniciado"))

  const filtros: FiltroInterno[] = FILTROS.map((f) => ({
    id: f.id,
    rotulo: f.rotulo,
    total:
      f.estado === null
        ? totalAlunos
        : base.roster.filter((id) => base.estadoPorAluno.get(id) === f.estado).length,
  }))

  // F-06 · `exibidas + resto` é SEMPRE o total, para 0, 1, 8, 9 e 40.
  const exibidas = Math.min(AMOSTRA_LINHAS, todas.length)
  const resto = todas.length - exibidas

  if (!alguemIniciou) {
    return {
      ...esqueleto,
      estado: "vazio",
      erro: null,
      textoVazio: VAZIO_NINGUEM_INICIOU,
      motivoVazio: "sem-base",
      totalAlunos,
      totalAlunosLabel: rotuloAlunos(totalAlunos),
      filtros,
      colunas: base.colunas,
      linhas: [],
      exibidas: 0,
      resto: 0,
      rotuloResto: null,
    }
  }

  return {
    ...esqueleto,
    estado: "ok",
    erro: null,
    textoVazio: null,
    motivoVazio: null,
    totalAlunos,
    totalAlunosLabel: rotuloAlunos(totalAlunos),
    filtros,
    colunas: base.colunas,
    linhas: todas.slice(0, exibidas),
    exibidas,
    resto,
    rotuloResto: rotuloResto(resto),
  }
}
