import { openai } from "@ai-sdk/openai"
import { generateObject } from "ai"
import { classificarPorHeuristica } from "./heuristica"
import { CLASSIFICACAO_SYSTEM_PROMPT, montarPromptClassificacao } from "./prompt"
import { avaliacaoEvidenciaSchema } from "./schema"
import type { CapabilityCriterio, EvidenciaBruta, ResultadoClassificacao } from "./tipos"

// Mesmo modelo do classificador semântico irmão (api/analytics/semantic/classify.ts) —
// barato o bastante para rodar por evidência individual, não só por aluno×curso.
const MODELO_CLASSIFICACAO = "gpt-4o-mini"

/**
 * Classifica UMA evidência: tenta o LLM (com os critérios fixos da
 * capacidade injetados no prompt), cai para a heurística determinística se a
 * chamada falhar. Nunca lança — mesmo contrato de `classifyWithClaude` em
 * `classify.ts`.
 */
export async function classificarEvidencia(
  e: EvidenciaBruta,
  criterios: readonly CapabilityCriterio[],
): Promise<ResultadoClassificacao> {
  // Sem texto, não há o que o LLM leia além dos sinais estruturados — a
  // heurística já faz exatamente isso, sem custo de chamada.
  if (!e.textoBruto || e.textoBruto.trim().length === 0) {
    return classificarPorHeuristica(e)
  }

  const codigosValidos = new Set(criterios.map((c) => c.code))

  try {
    const { object } = await generateObject({
      model: openai(MODELO_CLASSIFICACAO),
      system: CLASSIFICACAO_SYSTEM_PROMPT,
      prompt: montarPromptClassificacao(e, criterios),
      schema: avaliacaoEvidenciaSchema,
      maxRetries: 1,
    })

    // Guarda de segundo nível: mesmo com o prompt instruindo a nunca inventar
    // código, o schema Zod só garante que é string — filtra qualquer código
    // que não esteja na lista fixa antes de persistir (§28 não é negociável).
    const criteriaMet = object.criteriaMet.filter((code) => codigosValidos.has(code))

    return {
      comprehension: object.comprehension,
      depthLevel: object.depthLevel,
      applicationLevel: object.applicationLevel,
      confidence: Math.round(object.confidence * 100) / 100,
      criteriaMet,
      reasoning: object.reasoning,
      model: MODELO_CLASSIFICACAO,
    }
  } catch (error) {
    console.warn(
      "[aprendizagem-time] classificação por IA falhou, usando heurística:",
      (error as Error).message?.slice(0, 200),
    )
    return classificarPorHeuristica(e)
  }
}
