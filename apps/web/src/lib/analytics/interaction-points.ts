/**
 * Percorrido x Progressão — o que é um PONTO DE INTERAÇÃO num slide.
 *
 * Contrato: `docs/architecture/percorrido-progressao-conclusao.md` §3.2.
 *
 * Esta é a **fonte única** da heurística. Ela vivia dentro de
 * `presentation-viewer.tsx`, presa a um componente client, avaliada em tempo de
 * render. Serve para decidir se renderiza um componente, mas não servia como
 * denominador de métrica: ninguém conseguia responder "quantos pontos tem este
 * capítulo?" sem renderizar a página.
 *
 * Extraída SEM mudança de comportamento: os cinco padrões abaixo são os mesmos,
 * na mesma ordem. O viewer agora importa daqui, e o recálculo que materializa
 * `chapter_slides.interaction_type` usa exatamente esta função — por isso não
 * existe divergência possível entre o que a tela mostra e o que a métrica conta.
 */

/** Os tipos previstos. Hoje só `reflection` tem uso real (quiz/assignment/scenario: 0 registros). */
export type InteractionType = "reflection" | "quiz" | "assignment" | "scenario"

/**
 * Um blockquote parece um convite à reflexão?
 *
 * Movida de `presentation-viewer.tsx` sem alteração. Aplica-se ao texto do
 * BLOCKQUOTE, nunca ao slide inteiro — foi por isso que replicar isto em SQL
 * foi descartado na etapa 2: exigiria parsear markdown dentro do banco.
 */
export function isReflectionBlock(text: string): boolean {
  // "Reflexão" heading
  if (/reflex[ãa]o/i.test(text)) return true
  // "Agora reflita", "Agora pense", "reflita por um momento"
  if (/agora\s+(refli[tj]a|pense|imagine|considere)/i.test(text)) return true
  if (/refli[tj]a\s+por\s+um\s+momento/i.test(text)) return true
  // Reflection emojis (both magnifying glasses + others)
  if (/[🔍🔎💡🤔🪞💬🧠✨🎯📝]/u.test(text) && /\?/.test(text)) return true
  // Question with reflection keywords
  if (/\?/.test(text) && /pense|imagine|considere|momento/i.test(text)) return true
  return false
}

/**
 * Extrai os blockquotes de um markdown, agrupando linhas `>` consecutivas num
 * único bloco — que é como o `react-markdown` os entrega ao componente. Sem
 * isso, um bloco de três linhas seria testado como três textos separados e a
 * heurística poderia decidir diferente do que a tela decide.
 */
export function extractBlockquotes(markdown: string): string[] {
  const blocks: string[] = []
  let current: string[] = []

  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trimStart()
    if (line.startsWith(">")) {
      current.push(line.replace(/^>\s?/, ""))
      continue
    }
    if (current.length > 0) {
      blocks.push(current.join("\n"))
      current = []
    }
  }
  if (current.length > 0) blocks.push(current.join("\n"))

  return blocks
}

/**
 * Este slide é ponto de interação? Devolve o tipo, ou `null` se não for.
 *
 * É a função que o recálculo usa para preencher
 * `chapter_slides.interaction_type`. Hoje só reconhece `reflection`, porque é o
 * único tipo derivável do conteúdo do slide — quiz, atividade e cenário vivem em
 * tabelas próprias e entrarão por outro caminho quando existirem de fato.
 */
export function classifySlideInteraction(textContent: string | null): InteractionType | null {
  if (!textContent) return null
  for (const block of extractBlockquotes(textContent)) {
    if (isReflectionBlock(block)) return "reflection"
  }
  return null
}
