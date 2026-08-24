import type { SupabaseClient } from "@supabase/supabase-js"
import { avaliarMaturidade } from "./agregador"
import { buscarEvidenciasPendentes, carregarCriteriosPorCapacidade } from "./fontes-evidencia"
import { classificarEvidencia } from "./motor"
import type { CapabilityCriterio, EvidenciaClassificada } from "./tipos"

export * from "./agregador"
export * from "./fontes-evidencia"
export * from "./heuristica"
export * from "./motor"
export * from "./tipos"

// biome-ignore lint/suspicious/noExplicitAny: mesmo padrão de lib/supabase/service.ts — o service client não tipa o schema gerado aqui.
type Cliente = SupabaseClient<any, "public", any>

export interface ResultadoProcessamento {
  processadas: number
  pendentesRestantes: number
  capacidadesReavaliadas: number
}

/**
 * Ponto de entrada do pipeline, chamado pela rota
 * `api/analytics/aprendizagem-time/classify`. Fire-and-forget do ponto de
 * vista do chamador HTTP: busca até `limite` pares evidência×capacidade
 * ainda não classificados, classifica cada um (LLM com fallback
 * heurístico), persiste em `capability_evidence`, e reavalia a maturidade
 * de cada par aluno×capacidade tocado — gravando uma nova linha em
 * `capability_assessments` só quando o estado realmente muda (§39: histórico
 * por transição, nunca UPDATE in place).
 */
export async function processarPendencias(
  db: Cliente,
  tenantId: string,
  limite = 20,
): Promise<ResultadoProcessamento> {
  const pendentes = await buscarEvidenciasPendentes(db, tenantId, limite)
  if (pendentes.length === 0) {
    return { processadas: 0, pendentesRestantes: 0, capacidadesReavaliadas: 0 }
  }

  const criteriosPorCapacidade = await carregarCriteriosPorCapacidade(db, tenantId)

  const paresTocados = new Set<string>() // `${studentId}:${capabilityId}`

  for (const evidencia of pendentes) {
    if (!evidencia.capabilityId) continue
    const criterios = criteriosPorCapacidade.get(evidencia.capabilityId) ?? []
    const resultado = await classificarEvidencia(evidencia, criterios)

    const { error } = await db.from("capability_evidence").upsert(
      {
        tenant_id: evidencia.tenantId,
        student_id: evidencia.studentId,
        course_id: evidencia.courseId,
        concept_id: evidencia.conceptId,
        capability_id: evidencia.capabilityId,
        evidence_category: evidencia.evidenceCategory,
        source_type: evidencia.sourceType,
        source_table: evidencia.sourceTable,
        source_id: evidencia.sourceId,
        comprehension: resultado.comprehension,
        depth_level: resultado.depthLevel,
        application_level: resultado.applicationLevel,
        confidence: resultado.confidence,
        classification_model: resultado.model,
        classification_signals: evidencia.sinais,
        classification_reasoning: resultado.reasoning,
        criteria_met: resultado.criteriaMet,
        occurred_at: evidencia.occurredAt,
        classified_at: new Date().toISOString(),
      },
      // Alvo do índice parcial `capability_evidence_source_capability_uidx`
      // (capability_id sempre preenchido nesta entrega — ver fontes-evidencia.ts).
      { onConflict: "source_table,source_id,capability_id" },
    )

    if (error) {
      console.error("[aprendizagem-time] upsert de capability_evidence falhou:", error.message)
      continue
    }

    paresTocados.add(`${evidencia.studentId}:${evidencia.capabilityId}`)
  }

  let capacidadesReavaliadas = 0
  for (const par of paresTocados) {
    const [studentId, capabilityId] = par.split(":")
    const mudou = await reavaliarCapacidade(
      db,
      tenantId,
      studentId,
      capabilityId,
      criteriosPorCapacidade,
    )
    if (mudou) capacidadesReavaliadas++
  }

  const restantes = await buscarEvidenciasPendentes(db, tenantId, 1)

  return {
    processadas: pendentes.length,
    pendentesRestantes: restantes.length > 0 ? 1 : 0, // sinal booleano, não contagem exata (custo de nova varredura completa)
    capacidadesReavaliadas,
  }
}

async function reavaliarCapacidade(
  db: Cliente,
  tenantId: string,
  studentId: string,
  capabilityId: string,
  criteriosPorCapacidade: Map<string, CapabilityCriterio[]>,
): Promise<boolean> {
  const { data: evidenciasRaw, error } = await db
    .from("capability_evidence")
    .select(
      "id, evidence_category, source_type, comprehension, depth_level, application_level, criteria_met, occurred_at",
    )
    .eq("tenant_id", tenantId)
    .eq("student_id", studentId)
    .eq("capability_id", capabilityId)
  if (error) {
    console.error(
      "[aprendizagem-time] leitura de evidências para reavaliação falhou:",
      error.message,
    )
    return false
  }

  const evidencias: EvidenciaClassificada[] = (evidenciasRaw ?? []).map((r) => ({
    id: r.id,
    studentId,
    capabilityId,
    evidenceCategory: r.evidence_category,
    sourceType: r.source_type,
    comprehension: r.comprehension,
    depthLevel: r.depth_level,
    applicationLevel: r.application_level,
    criteriaMet: r.criteria_met ?? [],
    occurredAt: r.occurred_at,
  }))

  const criterios = criteriosPorCapacidade.get(capabilityId) ?? []
  const avaliacao = avaliarMaturidade(evidencias, criterios)

  const { data: atual } = await db
    .from("capability_assessments")
    .select("id, new_state")
    .eq("tenant_id", tenantId)
    .eq("student_id", studentId)
    .eq("capability_id", capabilityId)
    .eq("is_current", true)
    .maybeSingle()

  if (atual && atual.new_state === avaliacao.novoEstado) {
    // Nada mudou — não grava uma "transição" que não é transição.
    return false
  }

  if (atual) {
    const { error: erroFlip } = await db
      .from("capability_assessments")
      .update({ is_current: false })
      .eq("id", atual.id)
    if (erroFlip) {
      console.error("[aprendizagem-time] flip de is_current falhou:", erroFlip.message)
      return false
    }
  }

  const { data: nova, error: erroInsert } = await db
    .from("capability_assessments")
    .insert({
      tenant_id: tenantId,
      student_id: studentId,
      capability_id: capabilityId,
      previous_state: atual?.new_state ?? null,
      new_state: avaliacao.novoEstado,
      categories_present: avaliacao.categoriasPresentes,
      triangulation_met: avaliacao.triangulacaoOk,
      rationale: avaliacao.rationale,
      classification_model: "aggregate-v1",
      is_current: true,
    })
    .select("id")
    .single()

  if (erroInsert || !nova) {
    console.error(
      "[aprendizagem-time] insert de capability_assessments falhou:",
      erroInsert?.message,
    )
    return false
  }

  if (avaliacao.evidenciasConsideradas.length > 0) {
    const { error: erroJoinEv } = await db.from("capability_assessment_evidence").insert(
      avaliacao.evidenciasConsideradas.map((evidenceId) => ({
        tenant_id: tenantId,
        assessment_id: nova.id,
        evidence_id: evidenceId,
      })),
    )
    if (erroJoinEv) {
      console.error(
        "[aprendizagem-time] insert de capability_assessment_evidence falhou:",
        erroJoinEv.message,
      )
    }
  }

  if (criterios.length > 0) {
    const criteriosAtendidos = new Set(avaliacao.criteriosAtendidos)
    const { error: erroJoinCrit } = await db.from("capability_assessment_criteria").insert(
      criterios.map((c) => ({
        tenant_id: tenantId,
        assessment_id: nova.id,
        criterion_id: c.id,
        met: criteriosAtendidos.has(c.code),
      })),
    )
    if (erroJoinCrit) {
      console.error(
        "[aprendizagem-time] insert de capability_assessment_criteria falhou:",
        erroJoinCrit.message,
      )
    }
  }

  return true
}
