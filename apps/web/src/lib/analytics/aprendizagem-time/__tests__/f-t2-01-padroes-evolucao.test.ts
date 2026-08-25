import { describe, expect, it } from "vitest"
import { montarBase } from "../base"
import { montarConceitosFrageis } from "../conceitos-frageis"
import { montarModulosEvolucao } from "../modulos-evolucao"
import { montarOndeTrava } from "../onde-trava"
import { montarEvolucaoProfundidade } from "../serie-profundidade"
import { AGORA_MS, DIA_MS, conceito, entradaBase, evidencia } from "./contrato"

/**
 * Cobertura de contrato da Tela 2 — não replica o volume de testes fato-a-fato
 * de Ativação (dezenas de arquivos por bloco); cobre as garantias que mais
 * importam: piso de amostra, "nunca inventa módulo", e sinal correto de
 * evolução.
 */
describe("Tela 2 · Onde a aprendizagem trava", () => {
  it("§21 — sem curso selecionado, nunca inventa módulo (motivoVazio explícito)", () => {
    const fonte = entradaBase()
    const base = montarBase(fonte)
    const resultado = montarOndeTrava(base, fonte.falhas, [])
    expect(resultado.estado).toBe("vazio")
    expect(resultado.motivoVazio).toBe("sem-capacidades-no-curso")
    expect(resultado.linhas).toEqual([])
  })

  it("§7/§21 — módulo com menos de 5 evidências não aparece na tabela", () => {
    const c = conceito({ id: "m1", title: "Definir Problema" })
    const fonte = entradaBase({
      conceitos: [c],
      evidencias: [
        evidencia({ conceptId: "m1", occurredAtMs: AGORA_MS - 2 * DIA_MS }),
        evidencia({ conceptId: "m1", occurredAtMs: AGORA_MS - 3 * DIA_MS }),
      ],
    })
    const base = montarBase(fonte)
    const resultado = montarOndeTrava(base, fonte.falhas, [c])
    expect(resultado.linhas.find((l) => l.conceitoId === "m1")).toBeUndefined()
  })

  it("§21 — módulo com compreensão baixa recebe gap 'Compreensão'", () => {
    const c = conceito({ id: "m1", title: "Definir Problema" })
    const evidencias = Array.from({ length: 6 }, (_, i) =>
      evidencia({
        conceptId: "m1",
        studentId: `aluno-${i}`,
        comprehension: i < 5 ? "not_evidenced" : "evidenced", // 1/6 ≈ 17% < 60
        occurredAtMs: AGORA_MS - 2 * DIA_MS,
      }),
    )
    const fonte = entradaBase({ conceitos: [c], evidencias })
    const base = montarBase(fonte)
    const resultado = montarOndeTrava(base, fonte.falhas, [c])
    expect(resultado.linhas[0]?.gapPrincipal).toBe("Compreensão")
  })
})

describe("Tela 2 · Conceitos frágeis", () => {
  it("§22 — nunca classifica frágil por uma única resposta", () => {
    const c = conceito({ id: "m1" })
    const fonte = entradaBase({
      conceitos: [c],
      evidencias: [
        evidencia({
          conceptId: "m1",
          comprehension: "not_evidenced",
          occurredAtMs: AGORA_MS - DIA_MS,
        }),
      ],
    })
    const base = montarBase(fonte)
    const resultado = montarConceitosFrageis(base, fonte.falhas, [c])
    expect(resultado.linhas).toEqual([])
  })

  it("§22 — >=3 evidências com >=30% de não-compreensão entra na lista", () => {
    const c = conceito({ id: "m1", title: "Sintoma x causa" })
    const evidencias = Array.from({ length: 5 }, (_, i) =>
      evidencia({
        conceptId: "m1",
        studentId: `aluno-${i}`,
        comprehension: i < 2 ? "not_evidenced" : "evidenced",
        occurredAtMs: AGORA_MS - DIA_MS,
      }),
    )
    const fonte = entradaBase({ conceitos: [c], evidencias })
    const base = montarBase(fonte)
    const resultado = montarConceitosFrageis(base, fonte.falhas, [c])
    expect(resultado.linhas[0]?.percentAfetado).toBe(40)
  })
})

describe("Tela 2 · Módulos com maior evolução", () => {
  it("§23 — só declara evolução POSITIVA, nunca queda", () => {
    const c = conceito({ id: "m1", title: "Ações Corretivas" })
    const fonte = entradaBase({
      conceitos: [c],
      evidencias: [
        // período anterior: compreensão alta
        evidencia({
          conceptId: "m1",
          comprehension: "evidenced",
          occurredAtMs: AGORA_MS - 40 * DIA_MS,
        }),
        // período atual: compreensão baixa (regressão, não deve aparecer aqui)
        evidencia({
          conceptId: "m1",
          comprehension: "not_evidenced",
          occurredAtMs: AGORA_MS - 2 * DIA_MS,
        }),
      ],
    })
    const base = montarBase(fonte)
    const resultado = montarModulosEvolucao(base, fonte.falhas, [c])
    expect(resultado.linhas).toEqual([])
  })
})

describe("Tela 2 · Evolução da profundidade (série)", () => {
  it("§18/§7 — menos de 2 semanas com dado vira 'sem-tendencia', nunca gráfico com 1 ponto", () => {
    const fonte = entradaBase({
      evidencias: [evidencia({ depthLevel: 5, occurredAtMs: AGORA_MS - DIA_MS })],
    })
    const base = montarBase(fonte)
    const resultado = montarEvolucaoProfundidade(base, fonte.falhas, AGORA_MS)
    expect(resultado.estado).toBe("vazio")
    expect(resultado.motivoVazio).toBe("sem-tendencia")
  })
})
