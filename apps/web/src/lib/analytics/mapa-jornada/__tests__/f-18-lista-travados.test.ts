import { describe, expect, it } from "vitest"
import { CAP_ANCORA, calcular, darAtividadeHoje, entradaBase } from "./contrato"

/**
 * F-18 · A lista de pessoas do módulo âncora.
 *
 * É a MESMA população de F-08 para aquele módulo, sem filtro adicional.
 *
 * INVARIÂNCIA (subconjunto provado): toda pessoa da lista está no numerador do
 *   gargalo do âncora, e nenhuma de fora entra.
 * VARIÂNCIA: dar atividade a quem está no topo o REMOVE da lista (deixa de ser
 *   parado) e promove o seguinte.
 * FILA, NÃO PÓDIO: a lista é ordenada por tempo parado, mas nenhum item carrega
 *   campo de posição — ver `f-34-apoia-nao-vigia`.
 */
describe("F-18 · lista de pessoas do módulo âncora", () => {
  it("INVARIÂNCIA — a lista é subconjunto do numerador de F-08", async () => {
    const r = await calcular(entradaBase())
    const numerador = r.gargalos.linhas.find((g) => g.moduloId === CAP_ANCORA)?.pessoas ?? 0

    expect(r.travados.ctaTotal).toBe(numerador)
    expect(r.travados.linhas.length).toBeLessThanOrEqual(numerador)
    expect(new Set(r.travados.linhas.map((l) => l.alunoId)).size).toBe(r.travados.linhas.length)
  })

  it("INVARIÂNCIA — ordenada por tempo parado decrescente", async () => {
    const r = await calcular(entradaBase())
    const dias = r.travados.linhas.map((l) => l.paradoHaDias ?? -1)
    for (let i = 1; i < dias.length; i++) {
      expect(dias[i - 1], `posição ${i}`).toBeGreaterThanOrEqual(dias[i] as number)
    }
  })

  it("VARIÂNCIA — dar atividade ao topo o remove da lista", async () => {
    const antes = await calcular(entradaBase())
    const topo = antes.travados.linhas[0]?.alunoId
    expect(topo).toBeDefined()
    if (!topo) return

    const depois = await calcular(darAtividadeHoje(entradaBase(), topo, CAP_ANCORA))
    expect(depois.travados.linhas.map((l) => l.alunoId)).not.toContain(topo)
    expect(depois.travados.ctaTotal).toBe(antes.travados.ctaTotal - 1)
  })
})
