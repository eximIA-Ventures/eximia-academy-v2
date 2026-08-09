// ---------------------------------------------------------------------------
// reflection-potential — server-side "slide has a reflection prompt?" heuristic
// ---------------------------------------------------------------------------
// Single source for the reflection-block heuristic, extracted VERBATIM from
// `app/api/analytics/aggregate/route.ts` (SH-F.5, flag I1) so it is REUSED, not
// re-invented. `isReflectionBlock` mirrors the client `presentation-viewer.tsx`
// heuristic server-side; `countReflectionBlocks` counts the reflection-prompt
// blockquotes in a slide's markdown text_content (consecutive `>`-lines collapse
// into ONE block, matching how Markdown renders a single blockquote).
//
// Behavior is byte-identical to the previous private route definitions — the
// route now imports these instead of defining them (parity proven by its suite +
// a dedicated parity test). Pure: no student scope, no DB.
// ---------------------------------------------------------------------------

/** Replicates presentation-viewer.tsx isReflectionBlock() heuristic SERVER-SIDE. */
export function isReflectionBlock(text: string): boolean {
  if (/reflex[ãa]o/i.test(text)) return true
  if (/agora\s+(refli[tj]a|pense|imagine|considere)/i.test(text)) return true
  if (/refli[tj]a\s+por\s+um\s+momento/i.test(text)) return true
  if (/[🔍🔎💡🤔🪞💬🧠✨🎯📝]/u.test(text) && /\?/.test(text)) return true
  if (/\?/.test(text) && /pense|imagine|considere|momento/i.test(text)) return true
  return false
}

/**
 * Counts reflection-prompt blockquotes in a slide's markdown text_content.
 * A "reflection slide" potential is one blockquote block that matches the
 * heuristic. Consecutive `>`-prefixed lines collapse into ONE block (matching
 * how Markdown renders a single blockquote), so a multi-line prompt counts once.
 */
export function countReflectionBlocks(textContent: string | null | undefined): number {
  if (!textContent) return 0
  const lines = textContent.split(/\r?\n/)
  let count = 0
  let buffer: string[] = []

  const flush = () => {
    if (buffer.length > 0) {
      const blockText = buffer.join(" ").trim()
      if (blockText && isReflectionBlock(blockText)) count++
      buffer = []
    }
  }

  for (const line of lines) {
    const m = /^\s*>\s?(.*)$/.exec(line)
    if (m) {
      buffer.push(m[1])
    } else {
      flush()
    }
  }
  flush()
  return count
}
