import { describe, expect, it } from "vitest"
import { montarVisaoGeralAprendizagem } from "../montagem"
import { AGORA_MS, CONTEXTO_DE_TELA, DIA_MS, entradaBase, evidencia } from "./contrato"

/**
 * F-04 · §7 — "pelo menos 5 evidências avaliáveis". Com 3 alunos elegíveis
 * mas só 3 evidências no total, o placar continua vazio — os dois pisos são
 * independentes, os dois precisam bater.
 */
describe("F-04 · amostra insuficiente por número de evidências", () => {
  it("VAZIO — 3 alunos, mas só 3 evidências no total", () => {
    const fonte = entradaBase({
      evidencias: [
        evidencia({ studentId: "aluno-1", occurredAtMs: AGORA_MS - 3 * DIA_MS }),
        evidencia({ studentId: "aluno-2", occurredAtMs: AGORA_MS - 3 * DIA_MS }),
        evidencia({ studentId: "aluno-3", occurredAtMs: AGORA_MS - 3 * DIA_MS }),
      ],
      avaliacoes: [],
    })
    const r = montarVisaoGeralAprendizagem(fonte, CONTEXTO_DE_TELA)
    expect(r.placar.estado).toBe("vazio")
    expect(r.placar.motivoVazio).toBe("amostra-insuficiente")
  })
})
