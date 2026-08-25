// ---------------------------------------------------------------------------
// §11 — O que merece atenção agora? Até 3 gaps, ordenados por quantas pessoas
// eles afetam (§12: "não ordenar apenas pelo menor percentual").
// ---------------------------------------------------------------------------

import type { BaseCalculo } from "./base"
import { TEXTO_AMOSTRA_INSUFICIENTE, blocoErro, blocoOk, blocoVazio } from "./estado-bloco"
import type { FalhasPorFonte } from "./fonte"
import { primeiraFalha } from "./fonte"
import type { BlocoAtencao, ComEstado, ItemAtencao } from "./tipos"

const VAZIO: BlocoAtencao = { itens: [] }
const MAX_ITENS = 3
/** Abaixo disto, uma capacidade não entra no ranking (evita ruído de N pequeno). */
const MIN_ALUNOS_POR_CAPACIDADE = 3

export function montarAtencao(base: BaseCalculo, falhas: FalhasPorFonte): ComEstado<BlocoAtencao> {
  const falha = primeiraFalha(falhas, ["capacidades", "avaliacoes", "evidencias"])
  if (falha) return blocoErro(VAZIO, falha)

  const titulo = new Map(base.capacidades.map((c) => [c.id, c.title]))

  interface Agregado {
    capacidadeId: string
    total: number
    naoDesenvolvidos: number
    algumaAplicacao: boolean
    algumaCompreensao: boolean
  }
  const porCap = new Map<string, Agregado>()

  for (const cap of base.capacidades) {
    const alunosDaCapacidade = new Set<string>()
    for (const [chave] of base.estadoAtualPorPar) {
      const [studentId, capId] = chave.split(":")
      if (capId === cap.id) alunosDaCapacidade.add(studentId)
    }
    let naoDesenvolvidos = 0
    for (const alunoId of alunosDaCapacidade) {
      const estado = base.estadoAtualPorPar.get(`${alunoId}:${cap.id}`)
      if (estado === "not_evidenced" || estado === "emerging") naoDesenvolvidos++
    }
    const evidenciasCap = base.evidenciasPeriodoAtual.filter((e) => e.capabilityId === cap.id)
    const algumaAplicacao = evidenciasCap.some(
      (e) => e.applicationLevel === "contextualized" || e.applicationLevel === "applied_real",
    )
    const algumaCompreensao = evidenciasCap.some((e) => e.comprehension === "evidenced")

    if (alunosDaCapacidade.size >= MIN_ALUNOS_POR_CAPACIDADE) {
      porCap.set(cap.id, {
        capacidadeId: cap.id,
        total: alunosDaCapacidade.size,
        naoDesenvolvidos,
        algumaAplicacao,
        algumaCompreensao,
      })
    }
  }

  const ranking = [...porCap.values()]
    .filter((a) => a.naoDesenvolvidos > 0)
    .sort((a, b) => b.naoDesenvolvidos - a.naoDesenvolvidos)

  if (ranking.length === 0) {
    const totalAlunos = new Set(base.evidenciasPeriodoAtual.map((e) => e.studentId)).size
    if (totalAlunos < 3)
      return blocoVazio(VAZIO, "amostra-insuficiente", TEXTO_AMOSTRA_INSUFICIENTE)
    // Amostra suficiente e nada em atenção: bloco ok, lista vazia — não é o
    // mesmo caso de "não sabemos" (§32 é sobre AUSÊNCIA de dado, não sobre
    // "todo mundo está bem", que é uma leitura positiva legítima.
    return blocoOk({ itens: [] })
  }

  const itens: ItemAtencao[] = ranking.slice(0, MAX_ITENS).map((a) => {
    const nome = titulo.get(a.capacidadeId) ?? "Capacidade"
    // §42 Caso A/B, aplicado por capacidade: compreensão baixa → reforçar
    // conceito antes de exigir aplicação; compreensão presente + baixa
    // aplicação → propor desafio prático.
    const acaoSugerida = !a.algumaCompreensao
      ? "Reforçar conceito"
      : !a.algumaAplicacao
        ? "Propor desafio"
        : "Ver pessoas"
    return {
      id: `atencao-${a.capacidadeId}`,
      capacidadeId: a.capacidadeId,
      gap: nome,
      resumo: `${a.naoDesenvolvidos} de ${a.total} pessoas ainda em "emergindo" ou "não evidenciada".`,
      acaoSugerida,
    }
  })

  return blocoOk({ itens })
}
