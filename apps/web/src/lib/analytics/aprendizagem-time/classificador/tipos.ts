// ---------------------------------------------------------------------------
// Tipos do classificador de Aprendizagem do Time.
//
// A distinção EVIDÊNCIA (por interação individual) × CAPACIDADE (agregada,
// triangulada) é a espinha dorsal do modelo — Regra 4 da spec: "Compreensão →
// Profundidade → Aplicação → Capacidade demonstrada". `EvidenciaBruta` e
// `ResultadoClassificacao` vivem no nível de EVIDÊNCIA; `AvaliacaoAgregada`
// (em `agregador.ts`) vive no nível de CAPACIDADE.
// ---------------------------------------------------------------------------

/** §30 da spec: A (cognitiva) / B (aplicação) / C (contexto real). */
export type CategoriaEvidencia = "cognitive" | "application" | "real_context"

export type TipoFonte =
  | "reflection"
  | "quiz"
  | "scenario"
  | "assignment"
  | "socratic_session"
  | "real_evidence"
  | "manager_validation"

/** §6.1 */
export type Compreensao = "evidenced" | "partial" | "not_evidenced"

/** §6.3 */
export type NivelAplicacao = "not_evidenced" | "simulated" | "contextualized" | "applied_real"

/** §29 — os 4 estados de maturidade de uma capacidade. */
export type EstadoMaturidade = "not_evidenced" | "emerging" | "developing" | "demonstrated"

/**
 * Uma evidência ainda não classificada, pronta para entrar no motor.
 * `textoBruto` NUNCA é persistido — só usado em memória para classificar
 * (§38 LGPD: nunca gravar texto cru de reflexão/diálogo).
 */
export interface EvidenciaBruta {
  studentId: string
  courseId: string
  tenantId: string
  conceptId: string | null
  capabilityId: string | null
  evidenceCategory: CategoriaEvidencia
  sourceType: TipoFonte
  sourceTable: string
  sourceId: string
  occurredAt: string
  textoBruto: string | null
  sinais: SinaisEstruturados
}

/** Sinais numéricos/estruturados já calculados por outras camadas do produto. */
export interface SinaisEstruturados {
  /** `sessions.analytics.depth_reached` (1-7), quando a origem é sessão socrática. */
  depthReached: number | null
  /** `chapters.bloom_target`, quando a origem tem capítulo associado. */
  bloomTarget: string | null
  /** `quiz_attempts.correct_answers / total_questions`, 0-1. */
  quizScorePct: number | null
  /** `scenario_attempts`/`assignment_submissions.overall_score`, 0-100. */
  overallScore: number | null
  wordCount: number | null
}

/** Saída da classificação de UMA evidência (heurística ou LLM). */
export interface ResultadoClassificacao {
  comprehension: Compreensao
  depthLevel: number
  applicationLevel: NivelAplicacao
  confidence: number
  /** Códigos de `capability_criteria.code` — nunca inventados, sempre um
   * subconjunto dos critérios fixos passados ao classificador. */
  criteriaMet: string[]
  reasoning: string
  model: string
}

/** Um critério fixo (§28: "a IA não pode inventar critério dinamicamente"). */
export interface CapabilityCriterio {
  id: string
  capabilityId: string
  code: string
  description: string
}

/**
 * Uma evidência já classificada e persistida (linha real de
 * `capability_evidence`) — o que o agregador consome para decidir a
 * maturidade de uma capacidade. `comprehension`/`applicationLevel` podem ser
 * `null` só na leitura de linhas legadas/incompletas; o agregador trata isso
 * como evidência não avaliável.
 */
export interface EvidenciaClassificada {
  id: string
  studentId: string
  capabilityId: string
  evidenceCategory: CategoriaEvidencia
  sourceType: TipoFonte
  comprehension: Compreensao | null
  depthLevel: number | null
  applicationLevel: NivelAplicacao | null
  criteriaMet: string[]
  occurredAt: string
}
