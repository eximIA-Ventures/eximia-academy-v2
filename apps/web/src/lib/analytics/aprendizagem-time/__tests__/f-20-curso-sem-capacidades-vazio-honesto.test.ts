import { describe, expect, it } from "vitest"
import type { FonteAprendizagem } from "../fonte"
import { SEM_FALHAS } from "../fonte"
import { montarVisaoGeralAprendizagem } from "../montagem"
import { AGORA_MS, CONTEXTO_DE_TELA } from "./contrato"

/**
 * F-20 · decisão de produto (requisito 1 do dono): um curso sem capacidades
 * curadas mostra estado vazio honesto — NUNCA inventa uma capacidade pra
 * preencher a tela. §28 da spec: "a IA não pode inventar critério
 * dinamicamente"; o mesmo vale para a própria existência da capacidade.
 */
describe("F-20 · curso sem capacidades definidas nunca inventa dado", () => {
  it("VAZIO — nenhuma capacidade cadastrada para o curso, tela inteira sai vazia", () => {
    const fonte: FonteAprendizagem = {
      tenantId: "tenant-1",
      escopoAlunoIds: null,
      cursoId: "curso-sem-curriculo",
      agoraMs: AGORA_MS,
      periodoDias: 30,
      capacidades: [],
      avaliacoes: [],
      evidencias: [],
      conceitos: [],
      alunos: [],
      falhas: SEM_FALHAS,
    }
    const r = montarVisaoGeralAprendizagem(fonte, CONTEXTO_DE_TELA)
    expect(r.estado).toBe("vazio")
    expect(r.placar.motivoVazio).toBe("sem-capacidades-no-curso")
    expect(r.placar.textoVazio).toBe("Este curso ainda não tem capacidades definidas.")
    // Nenhum numeral inventado em bloco nenhum.
    expect(r.placar.compreensao.valorPercent).toBeNull()
    expect(r.atencao.itens).toEqual([])
    expect(r.capacidadesEvolucao.linhas).toEqual([])
  })
})
