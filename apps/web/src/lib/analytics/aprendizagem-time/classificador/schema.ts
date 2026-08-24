import { z } from "zod"

// ---------------------------------------------------------------------------
// Schema Zod da saída estruturada do LLM — mesmo mecanismo de
// api/analytics/semantic/classify.ts (`generateObject` + schema), dimensões
// diferentes (compreensão/profundidade/aplicação em vez de Roda/CMA/
// Metanoia/Jung).
// ---------------------------------------------------------------------------

export const avaliacaoEvidenciaSchema = z.object({
  comprehension: z.enum(["evidenced", "partial", "not_evidenced"]),
  depthLevel: z.number().int().min(1).max(7),
  applicationLevel: z.enum(["not_evidenced", "simulated", "contextualized", "applied_real"]),
  confidence: z.number().min(0).max(1),
  /** Subconjunto dos códigos de critério fornecidos no prompt — nunca um código novo. */
  criteriaMet: z.array(z.string()).max(8),
  reasoning: z.string().max(400),
})

export type AvaliacaoEvidenciaOutput = z.infer<typeof avaliacaoEvidenciaSchema>
