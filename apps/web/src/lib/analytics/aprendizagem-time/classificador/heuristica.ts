import type { Compreensao, EvidenciaBruta, NivelAplicacao, ResultadoClassificacao } from "./tipos"

// ---------------------------------------------------------------------------
// Fallback determinístico, sem LLM — usado quando a chamada de IA falha
// (mesmo papel de `heuristicFallback` em api/analytics/semantic/classify.ts).
//
// Diferença deliberada em relação ao classificador semântico irmão: a
// heurística aqui NUNCA lê o conteúdo do texto (`textoBruto`) — só sinais
// estruturados já calculados por outras camadas do produto
// (`depth_reached`, `bloom_target`, score de quiz). Por isso ela nunca
// preenche `criteriaMet` (§28: critério vem de leitura de texto contra os
// critérios fixos da capacidade — sem ler o texto, não há como saber quais
// critérios o aluno atendeu, então a lista fica vazia em vez de adivinhada) e
// nunca classifica `applicationLevel` acima de "simulated" a partir de
// inferência de conteúdo (só sobe a "applied_real" quando a PRÓPRIA origem já
// diz isso — `real_evidence`/`manager_validation`, evidência declarada, não
// inferida).
// ---------------------------------------------------------------------------

const BLOOM_PARA_NIVEL: Record<string, number> = {
  remembering: 1,
  understanding: 2,
  applying: 4,
  analyzing: 5,
  evaluating: 6,
  creating: 7,
}

export function classificarPorHeuristica(e: EvidenciaBruta): ResultadoClassificacao {
  // Profundidade: prioridade — depth_reached real (sessão socrática) > ajuste
  // por score de quiz > bloom_target do capítulo como piso conservador > 1.
  let depthLevel = e.sinais.depthReached ?? BLOOM_PARA_NIVEL[e.sinais.bloomTarget ?? ""] ?? 1

  if (e.sinais.quizScorePct !== null) {
    if (e.sinais.quizScorePct >= 0.8) depthLevel = Math.max(depthLevel, 2)
    else if (e.sinais.quizScorePct < 0.5) depthLevel = Math.min(depthLevel, 1)
  }

  depthLevel = Math.min(7, Math.max(1, Math.round(depthLevel)))

  const comprehension: Compreensao =
    depthLevel >= 2 && (e.sinais.wordCount ?? 0) >= 40
      ? "evidenced"
      : depthLevel >= 2 || (e.sinais.wordCount ?? 0) >= 15
        ? "partial"
        : "not_evidenced"

  const applicationLevel: NivelAplicacao =
    e.sourceType === "real_evidence" || e.sourceType === "manager_validation"
      ? "applied_real"
      : e.sourceType === "assignment"
        ? "contextualized"
        : e.sourceType === "scenario"
          ? "simulated"
          : "not_evidenced"

  return {
    comprehension,
    depthLevel,
    applicationLevel,
    confidence: 0.5,
    criteriaMet: [],
    reasoning:
      "Classificação heurística: sem leitura de texto, baseada em depth_reached/bloom_target/score.",
    model: "heuristic-v1",
  }
}
