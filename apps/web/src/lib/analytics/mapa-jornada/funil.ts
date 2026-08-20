// ---------------------------------------------------------------------------
// §27 — Funil de avanço por módulo. F-22 a F-26.
// ---------------------------------------------------------------------------
// "CHEGARAM" É CONSTANTE POR CURSO, E ISSO É FATO DO PRODUTO, NÃO BUG.
// Achado A-2: não existe travamento sequencial de capítulo (`is_sequential`
// vive em `learning_trails` e ordena CURSOS, nunca capítulos). Logo toda pessoa
// matriculada alcança todo módulo, e `chegaram(m) = |matriculados no curso de m|`
// — exatamente o `40` repetido nas sete linhas do PNG.
//
// ALTERNATIVA CONSIDERADA E RECUSADA: `chegaram(m) = concluíram(m−1)`.
// Produziria um funil bonito e afirmaria uma liberação que o produto não
// implementa. Número inventado para a tela ficar apresentável é o oposto do que
// esta camada existe para impedir. O preço da honestidade é a coluna constante,
// e o preço da coluna constante é a nota de régua — que por isso é campo
// OBRIGATÓRIO do tipo (F-22, lição 3).
//
// `Iniciaram` e `Concluíram` são contagens DA MATRIZ, célula a célula. O funil
// não pode discordar do mapa que está ao lado dele na mesma tela.
// ---------------------------------------------------------------------------

import type { BaseMapa } from "./base"
import type { ChaveFonteMapa, FalhasPorFonteMapa } from "./fonte"
import { primeiraFalhaMapa } from "./fonte"
import {
  CABECALHOS_FUNIL,
  ERRO_LEITURA,
  LINK_FUNIL_COMPLETO,
  REGUA_CHEGARAM,
  SUBTITULO_FUNIL,
  TITULO_FUNIL,
  VAZIO_SEM_ESCOPO,
  VAZIO_SEM_MODULOS,
  rotuloConversao,
} from "./textos"
import type { BlocoFunil, LinhaFunil } from "./tipos"

export const CHAVES_FUNIL: readonly ChaveFonteMapa[] = [
  "roster",
  "matriculas",
  "capitulos",
  "slides",
  "percorrido",
  "sessoes",
  "reflexoes",
]

export function montarFunil(base: BaseMapa, falhas: FalhasPorFonteMapa): BlocoFunil {
  const falha = primeiraFalhaMapa(falhas, CHAVES_FUNIL)
  const esqueleto = {
    titulo: TITULO_FUNIL,
    subtitulo: SUBTITULO_FUNIL,
    cabecalhos: CABECALHOS_FUNIL,
    notaRegua: REGUA_CHEGARAM,
  } as const

  const vazio = (
    estado: "erro" | "vazio",
    texto: string,
    motivo: BlocoFunil["motivoVazio"],
  ): BlocoFunil => ({
    ...esqueleto,
    estado,
    erro: estado === "erro" ? falha : null,
    textoVazio: texto,
    motivoVazio: motivo,
    linhas: [],
    linkRodape: null,
  })

  if (falha) return vazio("erro", ERRO_LEITURA, null)
  if (base.roster.length === 0) return vazio("vazio", VAZIO_SEM_ESCOPO, "sem-escopo")
  if (base.colunas.length === 0) return vazio("vazio", VAZIO_SEM_MODULOS, "sem-base")

  // F-22 · matriculados por curso (o denominador de "Chegaram").
  const matriculadosPorCurso = new Map<string, number>()
  for (const [alunoId, cursos] of base.cursosDoAluno) {
    if (!base.celulaPorAluno.has(alunoId)) continue
    for (const cursoId of cursos) {
      matriculadosPorCurso.set(cursoId, (matriculadosPorCurso.get(cursoId) ?? 0) + 1)
    }
  }

  const linhas: LinhaFunil[] = []
  for (const coluna of base.colunas) {
    const chegaram = matriculadosPorCurso.get(coluna.cursoId) ?? 0
    // F-22 · módulo de curso sem matrícula: a linha inteira não é renderizada,
    // nunca `0 · 0 · 0 · 0%`.
    if (chegaram === 0) continue

    let iniciaram = 0
    let concluiram = 0
    for (const alunoId of base.roster) {
      const estado = base.celulaPorAluno.get(alunoId)?.get(coluna.id)
      if (estado === undefined || estado === "nao-iniciado") continue
      iniciaram++
      if (estado === "concluido") concluiram++
    }

    const conversaoPct = chegaram > 0 ? Math.round((concluiram / chegaram) * 100) : null
    linhas.push({
      moduloId: coluna.id,
      numero: coluna.numero,
      titulo: coluna.titulo,
      chegaram,
      iniciaram,
      concluiram,
      conversaoPct,
      conversaoLabel: rotuloConversao(conversaoPct),
    })
  }

  if (linhas.length === 0) return vazio("vazio", VAZIO_SEM_MODULOS, "sem-base")

  return {
    ...esqueleto,
    estado: "ok",
    erro: null,
    textoVazio: null,
    motivoVazio: null,
    // F-26 · a ordem é a de F-02 (percurso), NUNCA por conversão. Ordenar por
    // conversão transformaria o funil num ranking de módulos e destruiria a
    // leitura de percurso, que é o ponto do bloco.
    linhas,
    linkRodape: LINK_FUNIL_COMPLETO,
  }
}
