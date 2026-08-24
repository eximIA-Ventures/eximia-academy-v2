import { describe, expect, it } from "vitest"
import { montarVisaoGeralAprendizagem } from "../montagem"
import { AGORA_MS, CONTEXTO_DE_TELA, DIA_MS, avaliacao, entradaBase, evidencia } from "./contrato"

/**
 * F-19 · Regra 1 da spec — "nenhum gráfico ou indicador deve existir apenas
 * porque o dado está disponível". Toda recomendação e todo item de atenção
 * publicados carregam uma ação associada (cta/acaoSugerida) — nunca um
 * card puramente decorativo.
 */
describe("F-19 · todo item de atenção/recomendação tem uma ação associada", () => {
  it("INVARIÂNCIA — itens de atenção sempre têm acaoSugerida não vazia", () => {
    const fonte = entradaBase({
      avaliacoes: ["aluno-1", "aluno-2", "aluno-3"].map((id) =>
        avaliacao({ studentId: id, newState: "emerging" }),
      ),
    })
    const r = montarVisaoGeralAprendizagem(fonte, CONTEXTO_DE_TELA)
    expect(r.atencao.estado).toBe("ok")
    for (const item of r.atencao.itens) {
      expect(item.acaoSugerida.length).toBeGreaterThan(0)
    }
  })

  it("INVARIÂNCIA — recomendações sempre têm cta não vazio", () => {
    const fonte = entradaBase({
      avaliacoes: ["aluno-1", "aluno-2", "aluno-3"].map((id) =>
        avaliacao({ studentId: id, newState: "emerging" }),
      ),
    })
    const r = montarVisaoGeralAprendizagem(fonte, CONTEXTO_DE_TELA)
    for (const item of r.recomendacoes.itens) {
      expect(item.cta.length).toBeGreaterThan(0)
    }
  })

  it("VAZIO — sem histórico anterior, nenhuma recomendação (nada de rec-reconhecer inventado)", () => {
    // Sem período anterior (entradaBase padrão), ninguém tem "estado anterior"
    // registrado — o reconhecimento não pode ser inventado sem uma transição real.
    const r = montarVisaoGeralAprendizagem(entradaBase(), CONTEXTO_DE_TELA)
    expect(r.recomendacoes.itens).toEqual([])
  })

  it("VARIÂNCIA — transição real (emerging → developing) faz 'Reconhecer evolução' aparecer", () => {
    const fonte = entradaBase({
      avaliacoes: [
        avaliacao({
          studentId: "aluno-1",
          newState: "emerging",
          isCurrent: false,
          createdAtMs: AGORA_MS - 40 * DIA_MS,
        }),
        avaliacao({
          studentId: "aluno-1",
          newState: "developing",
          isCurrent: true,
          createdAtMs: AGORA_MS - 2 * DIA_MS,
        }),
      ],
    })
    const r = montarVisaoGeralAprendizagem(fonte, CONTEXTO_DE_TELA)
    const reconhecimento = r.recomendacoes.itens.find((i) => i.id === "rec-reconhecer")
    expect(reconhecimento).toBeDefined()
    expect(reconhecimento?.cta).toBe("Reconhecer")
  })
})
