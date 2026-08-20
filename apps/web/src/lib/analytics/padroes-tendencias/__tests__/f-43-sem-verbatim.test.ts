import { describe, expect, it } from "vitest"
import {
  DIR_CAMADA,
  DIR_COMPONENTES,
  DIR_PREVIEW,
  casam,
  formatar,
  linhasDe,
  quantidadeDeArquivos,
} from "./varredura"

/**
 * F-43 · I-7 — nenhum verbatim de reflexão chega a esta tela.
 *
 * Restrição LEGAL, não preferência: a única leitura de `slide_reflections` da
 * casa seleciona `student_id` e carimbos, e as colunas de conteúdo nunca entram
 * na memória do processo. Esta tela herda essa leitura escopada e não consulta
 * a tabela — a ausência de colunas É a garantia.
 *
 * INVARIÂNCIA: nenhuma linha desta tela consulta a tabela nem nomeia coluna de
 *   conteúdo.
 * VARIÂNCIA: o detector reprova uma linha plantada — a varredura não é cega.
 */

const TABELA = ["slide_", "reflections"].join("")
const COLUNAS = [
  ["ai_", "response"].join(""),
  ["reflection_", "text"].join(""),
  ["answ", "er"].join(""),
]

describe("F-43 · sem verbatim de reflexão", () => {
  it("INVARIÂNCIA — a varredura enxerga a árvore (anti-vacuidade)", () => {
    // Um caminho errado devolveria "nenhum arquivo" e aprovaria tudo por
    // vacuidade — que é exatamente o modo de falha que esta proibição existe
    // para pegar.
    expect(quantidadeDeArquivos([DIR_CAMADA])).toBeGreaterThan(10)
  })

  it("INVARIÂNCIA — nenhuma linha consulta a tabela de reflexões", () => {
    const dirs = [DIR_CAMADA, DIR_COMPONENTES, DIR_PREVIEW]
    const padrao = new RegExp(`\\.from\\(["']${TABELA}["']\\)`)
    const achados = casam(linhasDe(dirs, "F-43"), padrao)
    expect(achados.length, formatar(achados)).toBe(0)
  })

  it("INVARIÂNCIA — nenhuma coluna de conteúdo de reflexão é nomeada", () => {
    const dirs = [DIR_CAMADA, DIR_COMPONENTES, DIR_PREVIEW]
    const padrao = new RegExp(COLUNAS.join("|"))
    const achados = casam(linhasDe(dirs, "F-43"), padrao)
    expect(achados.length, formatar(achados)).toBe(0)
  })

  it("VARIÂNCIA — os dois detectores enxergam linhas plantadas", () => {
    expect(
      new RegExp(`\\.from\\(["']${TABELA}["']\\)`).test(`db.from("${TABELA}").select("*")`),
    ).toBe(true)
    expect(new RegExp(COLUNAS.join("|")).test(`const t = linha.${COLUNAS[0]}`)).toBe(true)
  })
})
