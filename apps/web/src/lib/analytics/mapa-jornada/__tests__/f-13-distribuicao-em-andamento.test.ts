import { describe, expect, it } from "vitest"
import { CAP_ANCORA, calcular, entradaBase } from "./contrato"

const valor = (r: Awaited<ReturnType<typeof calcular>>, id: string) =>
  r.distribuicao.tiles.find((t) => t.id === id)?.valor ?? -1

/**
 * F-13 · Distribuição — Em andamento.
 *
 * Iniciou, não concluiu, e TEM atividade nos últimos `SEM_ACESSO_DAYS` (14).
 *
 * INVARIÂNCIA: o balde é exatamente quem passa nos três predicados.
 * VARIÂNCIA: empurrar a última atividade de uma pessoa de 1 para 20 dias atrás
 *   move 1 de `Em andamento` para `Travados`, SEM mexer no total.
 */
describe("F-13 · em andamento", () => {
  it("INVARIÂNCIA — três pessoas na fixture canônica", async () => {
    const r = await calcular(entradaBase())
    expect(valor(r, "em-andamento")).toBe(3)
  })

  it("VARIÂNCIA — envelhecer a atividade move de `Em andamento` para `Travados`", async () => {
    const base = entradaBase()
    const antes = await calcular(base)

    // P03 tem sessões em 20, 13, 6 e 1 dias atrás. Remover as três recentes o
    // deixa com 20 dias sem atividade.
    const envelhecido = {
      ...base,
      sessoes: (base.sessoes ?? []).filter(
        (s) =>
          !(
            s.alunoId === "P03" &&
            s.capituloId === CAP_ANCORA &&
            Date.parse(base.agoraISO) - Date.parse(s.criadaEmISO) < 15 * 86_400_000
          ),
      ),
    }
    const depois = await calcular(envelhecido)

    expect(valor(depois, "em-andamento")).toBe(valor(antes, "em-andamento") - 1)
    expect(valor(depois, "travados")).toBe(valor(antes, "travados") + 1)
    expect(depois.mapa.totalAlunos).toBe(antes.mapa.totalAlunos)
  })
})
