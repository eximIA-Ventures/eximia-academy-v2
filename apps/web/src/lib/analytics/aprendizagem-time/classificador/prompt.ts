import type { CapabilityCriterio, EvidenciaBruta } from "./tipos"

// ---------------------------------------------------------------------------
// Prompt do classificador de evidência — instrui explicitamente a nunca
// inventar critério (§28 da spec) e a nunca preencher lacuna por inferência
// (§41: "Nunca preencher lacunas por inferência").
// ---------------------------------------------------------------------------

export const CLASSIFICACAO_SYSTEM_PROMPT = `Você avalia UMA evidência de aprendizagem de um aluno
contra critérios curriculares FIXOS, fornecidos no contexto de cada chamada.

Regras invioláveis:
- Nunca invente um critério que não esteja na lista fornecida (§28 da especificação
  funcional: "a IA não pode inventar critério dinamicamente").
- "criteriaMet" só pode conter códigos EXATOS da lista fornecida — nunca um código novo,
  nunca uma paráfrase do código.
- Classifique CONSERVADORAMENTE quando o texto for ambíguo ou curto. Prefira
  "not_evidenced"/nível baixo/confiança baixa a um valor otimista sem base clara no texto.
- Nunca preencha uma lacuna por inferência (§41): se o texto não sustenta uma dimensão,
  responda o valor mais conservador daquela dimensão, não um valor "provável".
- "reasoning" é uma síntese estruturada e objetiva do que o texto demonstra — nunca cite o
  texto literal do aluno palavra por palavra além do estritamente necessário para justificar
  a classificação (o "reasoning" pode ser lido por um gestor; o texto integral da reflexão
  não pode, por privacidade — §38).
- Profundidade (depthLevel) segue a escala: 1 Reprodução, 2 Compreensão, 3 Conexão,
  4 Aplicação, 5 Análise, 6 Síntese, 7 Insight (§6.2 da spec). A escala classifica a
  EVIDÊNCIA, nunca a pessoa.`

export function montarPromptClassificacao(
  e: EvidenciaBruta,
  criterios: readonly CapabilityCriterio[],
): string {
  const listaCriterios =
    criterios.length > 0
      ? criterios.map((c) => `- [${c.code}] ${c.description}`).join("\n")
      : "(nenhum critério fixo cadastrado para esta capacidade ainda — deixe criteriaMet vazio)"

  const sinais = [
    e.sinais.depthReached !== null ? `depth_reached=${e.sinais.depthReached}` : null,
    e.sinais.bloomTarget ? `bloom_target=${e.sinais.bloomTarget}` : null,
    e.sinais.quizScorePct !== null ? `quiz_score=${e.sinais.quizScorePct}` : null,
    e.sinais.overallScore !== null ? `overall_score=${e.sinais.overallScore}` : null,
    e.sinais.wordCount !== null ? `word_count=${e.sinais.wordCount}` : null,
  ]
    .filter(Boolean)
    .join(", ")

  return `## Critérios observáveis desta capacidade (FIXOS — não invente outros)
${listaCriterios}

## Tipo de evidência
${e.sourceType} (categoria: ${e.evidenceCategory})

## Texto do aluno
"""
${e.textoBruto ?? "(sem texto — avalie só pelos sinais estruturados abaixo)"}
"""

## Sinais estruturados já calculados
${sinais || "(nenhum sinal estruturado disponível)"}

Classifique compreensão / profundidade (1-7) / aplicação para esta evidência. Liste em
"criteriaMet" APENAS os códigos acima que este texto evidencia claramente — se a evidência
não sustenta nenhum critério com segurança, devolva lista vazia.`
}
