import { describe, expect, it } from "vitest"
import {
  CAPS_A,
  CAP_ANCORA,
  calcular,
  darAtividadeHoje,
  embaralharCapitulos,
  entradaBase,
} from "./contrato"

/**
 * F-10 · Ordenação e corte da lista de gargalos (§24: "do maior para o menor").
 *
 * INVARIÂNCIA: embaralhar a ordem de entrada dos módulos não muda a saída;
 *   com mais módulos elegíveis que o corte, o link aparece.
 * VARIÂNCIA: subir o numerador de um módulo de baixo reordena a lista.
 * REGRA DE RUÍDO: com módulos elegíveis dentro do corte, o link `Ver todos os
 *   módulos ›` SOME — link para "todos" quando já se vê todos é ruído.
 */
describe("F-10 · ordem e corte dos gargalos", () => {
  it("INVARIÂNCIA — decrescente por numerador", async () => {
    const r = await calcular(entradaBase())
    const contagens = r.gargalos.linhas.map((g) => g.pessoas)
    for (let i = 1; i < contagens.length; i++) {
      expect(contagens[i - 1], `posição ${i}`).toBeGreaterThanOrEqual(contagens[i] as number)
    }
    expect(r.gargalos.linhas[0]?.moduloId).toBe(CAP_ANCORA)
  })

  it("INVARIÂNCIA — a ordem de chegada do banco não muda a saída", async () => {
    const normal = await calcular(entradaBase())
    const embaralhado = await calcular(embaralharCapitulos(entradaBase()))
    expect(embaralhado.gargalos.linhas.map((g) => `${g.moduloId}=${g.pessoas}`)).toEqual(
      normal.gargalos.linhas.map((g) => `${g.moduloId}=${g.pessoas}`),
    )
  })

  it("INVARIÂNCIA — dentro do corte, o link `Ver todos os módulos` some", async () => {
    const r = await calcular(entradaBase())
    expect(r.gargalos.linhas.length).toBeLessThanOrEqual(5)
    expect(r.gargalos.linkRodape).toBeNull()
  })

  it("VARIÂNCIA — esvaziar o topo reordena a lista inteira", async () => {
    let e = entradaBase()
    for (const alunoId of ["P03", "P04", "P05", "P06"]) {
      e = darAtividadeHoje(e, alunoId, CAP_ANCORA)
    }
    const r = await calcular(e)
    expect(r.gargalos.linhas[0]?.moduloId, "o antigo topo saiu do gargalo").not.toBe(CAP_ANCORA)
  })

  it("VARIÂNCIA — com mais módulos elegíveis que o corte, o link aparece", async () => {
    // Seis módulos com pelo menos uma pessoa parada cada: o corte é 5.
    const base = entradaBase()
    const extras = CAPS_A.slice(0, 6).map((capituloId, i) => ({
      alunoId: `Y${i}`,
      capituloId,
      criadaEmISO: new Date(Date.parse(base.agoraISO) - 200 * 86_400_000).toISOString(),
    }))
    const e = {
      ...base,
      escopo: [...base.escopo, ...extras.map((x) => x.alunoId)],
      alunos: [
        ...base.alunos,
        ...extras.map((x) => ({ id: x.alunoId, nome: `Parado ${x.alunoId}` })),
      ],
      matriculas: [
        ...base.matriculas,
        ...extras.map((x) => ({
          alunoId: x.alunoId,
          cursoId: "C1-solucao-de-problemas",
          status: "active" as const,
          criadaEmISO: new Date(Date.parse(base.agoraISO) - 300 * 86_400_000).toISOString(),
        })),
      ],
      sessoes: [...(base.sessoes ?? []), ...extras],
    }
    const r = await calcular(e)
    expect(r.gargalos.linhas).toHaveLength(5)
    expect(r.gargalos.linkRodape).toBe("Ver todos os módulos")
  })
})
