import { describe, expect, it } from "vitest"
import { montarVisaoGeralAprendizagem } from "../montagem"
import {
  AGORA_MS,
  CONTEXTO_DE_TELA,
  DIA_MS,
  avaliacao,
  capacidade,
  entradaBase,
  evidencia,
} from "./contrato"

/**
 * F-11 · §4.2 — "não somar capacidades semanticamente diferentes em um único
 * indicador". Com capacidades de 2 cursos diferentes e "Todos os cursos"
 * selecionado (cursoId null), os blocos por-capacidade-nomeada (atenção,
 * capacidades com maior evolução, recomendações, gaps) exigem seleção de
 * curso — nunca somam a capacidade do curso A com a do curso B.
 */
describe("F-11 · capacidades de cursos diferentes nunca somam num indicador", () => {
  function fonteDoisCursos() {
    const capA = capacidade({ id: "cap-a", courseId: "curso-a", title: "Uso de evidência" })
    const capB = capacidade({ id: "cap-b", courseId: "curso-b", title: "Pensamento causal" })
    const alunos = ["aluno-1", "aluno-2", "aluno-3"]
    const evidencias = alunos.flatMap((id) => [
      evidencia({ studentId: id, capabilityId: "cap-a", occurredAtMs: AGORA_MS - 3 * DIA_MS }),
      evidencia({ studentId: id, capabilityId: "cap-b", occurredAtMs: AGORA_MS - 4 * DIA_MS }),
    ])
    const avaliacoes = alunos.flatMap((id) => [
      avaliacao({ studentId: id, capabilityId: "cap-a" }),
      avaliacao({ studentId: id, capabilityId: "cap-b" }),
    ])
    return entradaBase({ capacidades: [capA, capB], evidencias, avaliacoes, cursoId: null })
  }

  it("VAZIO — capacidadesEvolucao pede seleção de curso quando há 2 cursos e nenhum filtro", () => {
    const r = montarVisaoGeralAprendizagem(fonteDoisCursos(), CONTEXTO_DE_TELA)
    expect(r.capacidadesEvolucao.motivoVazio).toBe("selecione-um-curso")
  })

  it("VAZIO — atencao e recomendacoes também pedem seleção de curso", () => {
    const r = montarVisaoGeralAprendizagem(fonteDoisCursos(), CONTEXTO_DE_TELA)
    expect(r.atencao.motivoVazio).toBe("selecione-um-curso")
    expect(r.recomendacoes.motivoVazio).toBe("selecione-um-curso")
    expect(r.gapsPrioritarios.motivoVazio).toBe("selecione-um-curso")
  })

  it("INVARIÂNCIA — com um curso escolhido, os blocos por-capacidade voltam a funcionar", () => {
    const comCurso = fonteDoisCursos()
    const r = montarVisaoGeralAprendizagem({ ...comCurso, cursoId: "curso-a" }, CONTEXTO_DE_TELA)
    expect(r.capacidadesEvolucao.motivoVazio).not.toBe("selecione-um-curso")
  })
})
