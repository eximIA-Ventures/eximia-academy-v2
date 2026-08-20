import { describe, expect, it } from "vitest"
import { CAP_ANCORA, calcular, diasAtras, entradaBase } from "./contrato"

/**
 * F-20 · Coluna "Última atividade", formatada por `rotuloUltimaAtividade`.
 *
 * INVARIÂNCIA: `0` renderiza `hoje`; `1` renderiza `1 dia atrás` (o singular é
 *   contrato); ausência renderiza `—`, nunca `0 dias atrás`.
 * VARIÂNCIA: ver a variância cruzada de F-19.
 */
function comAtividadeHa(dias: number) {
  const base = entradaBase()
  return calcular({
    ...base,
    sessoes: (base.sessoes ?? []).map((s) =>
      s.alunoId === "P05" ? { ...s, criadaEmISO: diasAtras(dias) } : s,
    ),
  })
}

const linhaP05 = (r: Awaited<ReturnType<typeof calcular>>) =>
  r.travados.linhas.find((l) => l.alunoId === "P05")

describe("F-20 · última atividade", () => {
  it("INVARIÂNCIA — 1 dia usa o SINGULAR", async () => {
    const base = entradaBase()
    const r = await calcular({
      ...base,
      sessoes: [
        ...(base.sessoes ?? []),
        { alunoId: "P05", capituloId: CAP_ANCORA, criadaEmISO: diasAtras(1) },
      ],
    })
    const linhas = r.travados.linhas.map((l) => l.ultimaAtividadeLabel)
    expect(linhas).toContain("1 dia atrás")
    expect(linhas, "'1 dias atrás' é o defeito").not.toContain("1 dias atrás")
  })

  it("VARIÂNCIA — 90 e 91 dias produzem rótulos diferentes", async () => {
    expect(linhaP05(await comAtividadeHa(90))?.ultimaAtividadeLabel).toBe("90 dias atrás")
    expect(linhaP05(await comAtividadeHa(91))?.ultimaAtividadeLabel).toBe("91 dias atrás")
  })

  it("INVARIÂNCIA — nenhuma linha renderiza `0 dias atrás`", async () => {
    const r = await calcular(entradaBase())
    expect(r.travados.linhas.map((l) => l.ultimaAtividadeLabel)).not.toContain("0 dias atrás")
  })
})
