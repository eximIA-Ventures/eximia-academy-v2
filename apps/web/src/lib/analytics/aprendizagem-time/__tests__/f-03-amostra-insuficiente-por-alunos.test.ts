import { describe, expect, it } from "vitest"
import { montarVisaoGeralAprendizagem } from "../montagem"
import { AGORA_MS, CONTEXTO_DE_TELA, DIA_MS, entradaBase, evidencia } from "./contrato"

/**
 * F-03 · §7 da spec — "só exibir percentual se houver pelo menos 3
 * aprendizes elegíveis". Com 2 alunos, mesmo com muitas evidências cada, o
 * placar sai vazio com o texto literal "Amostra ainda insuficiente".
 */
describe("F-03 · amostra insuficiente por número de aprendizes", () => {
  it("VAZIO — 2 alunos elegíveis, placar vazio com motivo amostra-insuficiente", () => {
    const fonte = entradaBase({
      evidencias: [
        evidencia({ studentId: "aluno-1", occurredAtMs: AGORA_MS - 3 * DIA_MS }),
        evidencia({ studentId: "aluno-1", occurredAtMs: AGORA_MS - 4 * DIA_MS }),
        evidencia({ studentId: "aluno-1", occurredAtMs: AGORA_MS - 5 * DIA_MS }),
        evidencia({ studentId: "aluno-2", occurredAtMs: AGORA_MS - 3 * DIA_MS }),
        evidencia({ studentId: "aluno-2", occurredAtMs: AGORA_MS - 4 * DIA_MS }),
      ],
      avaliacoes: [],
    })
    const r = montarVisaoGeralAprendizagem(fonte, CONTEXTO_DE_TELA)
    expect(r.placar.estado).toBe("vazio")
    expect(r.placar.motivoVazio).toBe("amostra-insuficiente")
    expect(r.placar.textoVazio).toBe("Amostra ainda insuficiente")
    expect(r.placar.compreensao.valorPercent).toBeNull()
  })

  it("INVARIÂNCIA — 3 alunos elegíveis com evidência suficiente, placar sai ok", () => {
    const r = montarVisaoGeralAprendizagem(entradaBase(), CONTEXTO_DE_TELA)
    expect(r.placar.estado).toBe("ok")
  })
})
