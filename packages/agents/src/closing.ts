import type { ClosingFlags, InteractionConfig, InteractionType } from "./types"

/**
 * Evaluate closing conditions for a session.
 * Returns flags that should be passed to the Mestre prompt.
 */
export function evaluateClosing(params: {
  interactionsRemaining: number
  turnNumber: number
  interactionType: InteractionType
  config: InteractionConfig
  detectorData?: {
    depth_progression: number[]
    breakthrough_candidates: Array<{ trigger: string; marker: string }>
  }
}): ClosingFlags {
  const { interactionsRemaining, turnNumber, config, detectorData } = params

  // Hard limit reached
  if (interactionsRemaining <= 0) {
    return {
      is_closing: true,
      suggest_closing: false,
      closing_reason: "limit_reached",
    }
  }

  // Smart closing evaluation
  if (config.smart_closing.enabled && detectorData) {
    const { min_interactions_before, depth_threshold, insights_threshold, remaining_threshold } =
      config.smart_closing

    const totalInteractions = turnNumber
    const maxDepth =
      detectorData.depth_progression.length > 0
        ? Math.max(...detectorData.depth_progression)
        : 0
    const insightsCount = detectorData.breakthrough_candidates.length

    const meetsMinInteractions = totalInteractions >= min_interactions_before
    const meetsDepth = maxDepth >= depth_threshold
    const meetsInsights = insightsCount >= insights_threshold
    const nearEnd = interactionsRemaining <= remaining_threshold

    if (meetsMinInteractions && meetsDepth && meetsInsights && nearEnd) {
      return {
        is_closing: false,
        suggest_closing: true,
        closing_reason: "smart_closing",
      }
    }
  }

  // No closing
  return {
    is_closing: false,
    suggest_closing: false,
    closing_reason: null,
  }
}

/**
 * Get the default max interactions for a given interaction type.
 */
export function getDefaultMaxInteractions(
  type: InteractionType,
  config: InteractionConfig,
): number {
  return config.type_defaults[type] ?? config.max_interactions
}

/**
 * Build the closing section for the Mestre prompt.
 */
export function buildClosingPromptSection(flags: ClosingFlags): string {
  if (flags.is_closing) {
    return `

## MODO FECHAMENTO SOCRATICO

Esta e a ultima interacao. Você DEVE fazer perguntas de fechamento:

1. **Integracao**: "O que você leva desta conversa?"
2. **Acao**: "O que muda a partir de amanha?"
3. **Apreciacao**: "O que descobriu sobre si mesmo?"

### REGRAS DE FECHAMENTO (INQUEBRÁVEIS):
- **NUNCA** resuma a conversa — o aluno deve integrar
- **NUNCA** de homework ou tarefas — honre o momento
- **NUNCA** introduza conceitos novos — feche com o que foi construido
- **SEMPRE** honre a jornada do aluno — reconheca o caminho percorrido
- **SEMPRE** termine com pergunta aberta de integracao
`
  }

  if (flags.suggest_closing) {
    return `

## SUGESTAO DE ENCERRAMENTO

O aluno atingiu maturidade nesta sessão (profundidade e insights suficientes).
Você pode SUGERIR encerrar a conversa de forma socratica:

- Use um tom acolhedor e integrativo
- Pergunte algo como: "Sinto que você chegou a um lugar importante. Quer que a gente integre o que você descobriu hoje, ou prefere continuar explorando?"
- Se o aluno quiser continuar, respeite e siga normalmente
- NAO force o encerramento — e uma sugestao, nao uma ordem
`
  }

  return ""
}
