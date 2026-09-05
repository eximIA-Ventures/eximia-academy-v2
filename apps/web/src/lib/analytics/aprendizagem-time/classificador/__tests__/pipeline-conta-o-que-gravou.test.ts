// ---------------------------------------------------------------------------
// O PIPELINE CONTA O QUE GRAVOU, NÃO O QUE TENTOU — C-3, A-5, A-6 do laudo.
// ---------------------------------------------------------------------------
// DEFEITOS QUE ESTE ARQUIVO TRANCA (LOOP-1 técnico + LOOP-0c, 2026-08-28):
//
//   C-3 · `processarPendencias` devolvia `processadas: pendentes.length` — o
//         número de CANDIDATOS, não o de gravações. Com 100% dos `upsert`
//         falhando, a rota respondia `200 {"ok":true,"processed":20}`. Foi essa
//         cegueira que manteve um defeito crítico invisível por dias: qualquer
//         monitor lia "20 processadas" e concluía que o pipeline estava vivo.
//
//   A-5 · Falha ao ler `capabilities` devolvia `[]`, e `[]` é byte a byte a
//         resposta de "tenant sem capacidade cadastrada". O operador lia
//         "nada pendente" quando o pipeline nunca conseguiu começar.
//
//   A-6 · Falha na varredura de já-classificados devolvia o `Set` VAZIO, e todo
//         o acervo do tenant voltava a ser "pendente" — moinho de
//         reclassificação, pagando LLM de novo sobre dado já classificado.
//
//   Item 5 · `reavaliarCapacidade` nem destructurava o `error` da leitura de
//         `capability_assessments`. Erro → `atual` indefinido → o código conclui
//         "aluno nunca avaliado", pula o flip de `is_current=false` e INSERE uma
//         segunda linha `is_current=true` para o mesmo par aluno×capacidade.
//
// COMO ISTO MEDE: o duplo (`banco-que-falha.ts`) aplica os filtros de verdade e
// registra toda escrita BEM-SUCEDIDA. A asserção é sobre `gravacoes` — o que
// entrou no banco — e sobre o resultado devolvido. É exatamente a distância
// entre tentativa e efeito que `processadas` apagava.
//
// CONTROLES POSITIVOS (marcados [CP]): sem eles, a correção degenerada "aborta
// sempre / devolve 0 sempre" passaria em todos os casos de falha acima. Eles
// passam ANTES e DEPOIS da correção.
//
// NENHUMA REDE, NENHUM BANCO: as evidências usadas têm `response` vazio, e
// `motor.ts` cai na heurística determinística sem texto — nenhuma chamada de LLM.
// ---------------------------------------------------------------------------

import { describe, expect, it, vi } from "vitest"
import { processarPendencias } from "../index"
import { ERRO_TRANSITORIO, type Linha, bancoQueFalha } from "./banco-que-falha"

const TENANT = "tenant-a"
const CURSO = "curso-1"
const CAP = "cap-1"
const CAPITULO = "cap-capitulo-1"
const SLIDE = "slide-1"
const ALUNO = "aluno-1"
const QUANDO = "2026-08-20T10:00:00.000Z"

/** 3 reflexões × 1 capacidade = 3 pares pendentes. */
const REFLEXOES = ["ref-1", "ref-2", "ref-3"]

function tabelas(): Record<string, Linha[]> {
  return {
    capabilities: [{ id: CAP, tenant_id: TENANT, course_id: CURSO, is_active: true }],
    capability_criteria: [
      {
        id: "crit-1",
        capability_id: CAP,
        code: "C1",
        description: "Cita evidência",
        is_active: true,
      },
    ],
    chapters: [{ id: CAPITULO, tenant_id: TENANT, course_id: CURSO, bloom_target: "analyzing" }],
    chapter_slides: [{ id: SLIDE, chapter_id: CAPITULO }],
    slide_reflections: REFLEXOES.map((id) => ({
      id,
      tenant_id: TENANT,
      student_id: ALUNO,
      slide_id: SLIDE,
      // Vazio de propósito: `motor.ts` cai na heurística sem texto — zero rede.
      response: "",
      created_at: QUANDO,
    })),
    capability_evidence: [],
    capability_assessments: [],
    capability_assessment_evidence: [],
    capability_assessment_criteria: [],
    scenario_attempts: [],
    assignment_submissions: [],
    quiz_sessions: [],
    quiz_attempts: [],
    sessions: [],
  }
}

// biome-ignore lint/suspicious/noExplicitAny: a fronteira do duplo — o tipo real do service client não é construível em teste.
type Cliente = any

function upsertsDeEvidencia(gravacoes: { tabela: string; operacao: string }[]) {
  return gravacoes.filter((g) => g.tabela === "capability_evidence" && g.operacao === "upsert")
}

describe("classificador — o número reportado é o de gravações, não o de tentativas", () => {
  /**
   * [CP] CONTROLE POSITIVO. Sem ele, um duplo que não encontrasse evidência
   * nenhuma faria TODOS os casos de falha abaixo passarem por vacuidade: "0
   * gravações" seria verdade tanto no defeito quanto na ausência de dado.
   */
  it("[CP] caminho feliz — 3 pendentes viram 3 gravações e 3 processadas", async () => {
    const banco = bancoQueFalha({ tabelas: tabelas() })

    const r = await processarPendencias(banco.db as Cliente, TENANT, 20)

    expect(upsertsDeEvidencia(banco.gravacoes)).toHaveLength(3)
    expect(r.processadas).toBe(3)
    expect(r.tentativas).toBe(3)
    expect(r.falhasDeGravacao).toBe(0)
    expect(r.falhaLeitura).toBeNull()
  })

  /**
   * C-3 — o coração do laudo. Antes da correção este teste lê `processadas: 3`
   * com ZERO linhas no banco.
   */
  it("C-3 — com 100% dos upserts falhando, `processadas` é 0, não o número de candidatos", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {})
    const banco = bancoQueFalha({
      tabelas: tabelas(),
      errosDeEscrita: { capability_evidence: ERRO_TRANSITORIO },
    })

    const r = await processarPendencias(banco.db as Cliente, TENANT, 20)

    expect(upsertsDeEvidencia(banco.gravacoes)).toHaveLength(0)
    expect(r.processadas).toBe(0)
    expect(r.tentativas).toBe(3)
    expect(r.falhasDeGravacao).toBe(3)
    erro.mockRestore()
  })

  /**
   * C-3, o lado parcial. Sucesso parcial não pode ser indistinguível de sucesso
   * total — é o que permite a um monitor ver a degradação antes do apagão.
   */
  it("C-3 — sucesso parcial se declara: 3 tentativas, 3 gravadas, 0 falhas é diferente de 3/0/3", async () => {
    const banco = bancoQueFalha({ tabelas: tabelas() })
    const r = await processarPendencias(banco.db as Cliente, TENANT, 20)
    expect([r.tentativas, r.processadas, r.falhasDeGravacao]).toEqual([3, 3, 0])
  })

  /**
   * A-5 — falha ao ler `capabilities`. Antes da correção o retorno é
   * `{ processadas: 0, pendentesRestantes: 0 }` SEM nenhum sinal de falha, ou
   * seja: idêntico a "tenant sem capacidade cadastrada, nada a fazer".
   */
  it("A-5 — falha ao ler `capabilities` não vira 'nada pendente'", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {})
    const banco = bancoQueFalha({
      tabelas: tabelas(),
      errosDeLeitura: { capabilities: ERRO_TRANSITORIO },
    })

    const r = await processarPendencias(banco.db as Cliente, TENANT, 20)

    expect(r.falhaLeitura).not.toBeNull()
    expect(r.falhaLeitura?.mensagem).toContain("timeout")
    erro.mockRestore()
  })

  /**
   * [CP] O outro lado de A-5: tenant SEM capacidade cadastrada continua sendo
   * "nada a fazer", sem falha. Sem este caso, "sempre reporta falha" passaria.
   */
  it("[CP] tenant sem capacidade cadastrada é vazio honesto, não falha", async () => {
    const semCapacidade = { ...tabelas(), capabilities: [] }
    const banco = bancoQueFalha({ tabelas: semCapacidade })

    const r = await processarPendencias(banco.db as Cliente, TENANT, 20)

    expect(r.falhaLeitura).toBeNull()
    expect(r.processadas).toBe(0)
    expect(r.tentativas).toBe(0)
  })

  /**
   * A-6 — falha na varredura de já-classificados. Antes da correção o `Set` de
   * chaves volta VAZIO e as 3 reflexões (já classificadas na fixture) são
   * reclassificadas: 3 upserts e 3 chamadas de classificação pagas de novo.
   */
  it("A-6 — falha ao varrer já-classificados aborta a rodada, não reclassifica o acervo", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {})
    const jaClassificadas = {
      ...tabelas(),
      capability_evidence: REFLEXOES.map((id) => ({
        tenant_id: TENANT,
        course_id: CURSO,
        source_table: "slide_reflections",
        source_id: id,
        capability_id: CAP,
      })),
    }
    const banco = bancoQueFalha({
      tabelas: jaClassificadas,
      errosDeLeitura: { capability_evidence: ERRO_TRANSITORIO },
    })

    const r = await processarPendencias(banco.db as Cliente, TENANT, 20)

    expect(upsertsDeEvidencia(banco.gravacoes)).toHaveLength(0)
    expect(r.falhaLeitura).not.toBeNull()
    erro.mockRestore()
  })

  /**
   * [CP] O outro lado de A-6: com a varredura SAUDÁVEL, o que já está
   * classificado não volta à fila. Sem este caso, "aborta sempre" passaria.
   */
  it("[CP] varredura saudável não reclassifica o que já foi classificado", async () => {
    const jaClassificadas = {
      ...tabelas(),
      capability_evidence: REFLEXOES.map((id) => ({
        tenant_id: TENANT,
        course_id: CURSO,
        source_table: "slide_reflections",
        source_id: id,
        capability_id: CAP,
      })),
    }
    const banco = bancoQueFalha({ tabelas: jaClassificadas })

    const r = await processarPendencias(banco.db as Cliente, TENANT, 20)

    expect(upsertsDeEvidencia(banco.gravacoes)).toHaveLength(0)
    expect(r.tentativas).toBe(0)
    expect(r.falhaLeitura).toBeNull()
  })

  /**
   * Item 5 — a leitura de `capability_assessments` cujo erro nem era
   * destructurado. Antes da correção o pipeline INSERE uma linha
   * `is_current: true` sem ter conseguido desativar a anterior.
   */
  it("item 5 — falha ao ler `capability_assessments` não grava uma segunda linha corrente", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {})
    const comAvaliacaoVigente = {
      ...tabelas(),
      capability_assessments: [
        {
          id: "assess-vigente",
          tenant_id: TENANT,
          student_id: ALUNO,
          capability_id: CAP,
          new_state: "not_evidenced",
          is_current: true,
        },
      ],
    }
    const banco = bancoQueFalha({
      tabelas: comAvaliacaoVigente,
      errosDeLeitura: { capability_assessments: ERRO_TRANSITORIO },
    })

    await processarPendencias(banco.db as Cliente, TENANT, 20)

    const escritasNoAssessment = banco.gravacoes.filter(
      (g) => g.tabela === "capability_assessments",
    )
    expect(escritasNoAssessment).toHaveLength(0)
    // O invariante que o índice único deveria proteger e que este caminho furava.
    const correntes = banco
      .linhasDe("capability_assessments")
      .filter((l) => l.is_current === true && l.student_id === ALUNO && l.capability_id === CAP)
    expect(correntes).toHaveLength(1)
    erro.mockRestore()
  })
})
