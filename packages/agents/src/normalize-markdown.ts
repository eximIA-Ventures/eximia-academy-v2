/**
 * normalizeChapterMarkdown — Post-processing layer for AI-generated chapter content.
 *
 * Ensures that all chapter content follows proper Markdown heading hierarchy:
 *   ## Section Title
 *   ### Sub-section Title
 *   #### Detail Heading
 *
 * This handles cases where the LLM outputs:
 * - Bold text as headings (**Heading**)
 * - ALL CAPS lines as headings
 * - Short standalone lines that are clearly titles but lack ## markers
 * - Inconsistent heading levels (# inside chapter content)
 */

/**
 * Detects if a line looks like a heading but isn't marked with ##.
 * Heuristics:
 * - Line is wrapped in ** ** (bold-as-heading pattern)
 * - Line is short (<100 chars), standalone (blank lines above/below), and doesn't end with punctuation
 * - Line is ALLCAPS and short
 */
function isBoldHeading(line: string): { text: string } | null {
  // Pattern: **Some Title** or **Some Title**:
  const boldMatch = line.match(/^\*\*(.+?)\*\*:?\s*$/)
  if (boldMatch && boldMatch[1].length < 120) {
    return { text: boldMatch[1] }
  }
  return null
}

function isLikelyHeading(line: string, prevBlank: boolean, nextBlank: boolean): boolean {
  const trimmed = line.trim()
  if (trimmed.length === 0) return false
  if (trimmed.length > 120) return false

  // Already a markdown heading
  if (/^#{1,6}\s/.test(trimmed)) return false

  // Is a list item
  if (/^[-*+]\s|^\d+\.\s/.test(trimmed)) return false

  // Is a blockquote
  if (trimmed.startsWith(">")) return false

  // Ends with sentence-ending punctuation (likely a paragraph, not a heading)
  if (/[.!?;,]$/.test(trimmed)) return false

  // Has blank lines around it (standalone) and is reasonably short
  if (prevBlank && nextBlank && trimmed.length < 80) return true

  // ALL CAPS and short
  if (
    trimmed === trimmed.toUpperCase() &&
    trimmed.length > 3 &&
    trimmed.length < 80 &&
    /[A-ZÀ-Ú]/.test(trimmed)
  ) {
    return true
  }

  return false
}

/**
 * Determines heading level based on content patterns:
 * - Lines that introduce major sections (contain keywords like "Introdução", "Conclusão", etc.) → ##
 * - Lines after ## that are sub-topics → ###
 * - Everything else → ### (default sub-heading)
 */
function determineLevel(
  text: string,
  lastHeadingLevel: number,
): number {
  const lower = text.toLowerCase()

  // Major section indicators → ##
  const majorKeywords = [
    "introdução", "introducao", "conclusão", "conclusao",
    "resumo", "fundamentos", "metodologia", "ferramentas",
    "aplicação", "aplicacao", "princípios", "principios",
    "visão geral", "visao geral", "objetivos", "contexto",
    "referências", "referencias", "bibliografia",
  ]
  if (majorKeywords.some((kw) => lower.includes(kw))) return 2

  // If text is title-cased and we haven't had a ## yet, it's probably a ##
  if (lastHeadingLevel === 0) return 2

  // Sub-section under existing ## → ###
  if (lastHeadingLevel === 2) return 3

  // Sub-sub-section → ####
  if (lastHeadingLevel === 3) return 4

  return 3
}

export function normalizeChapterMarkdown(content: string): string {
  if (!content || content.trim().length === 0) return content

  const lines = content.split("\n")
  const result: string[] = []
  let lastHeadingLevel = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    const prevBlank = i === 0 || lines[i - 1].trim() === ""
    const nextBlank = i === lines.length - 1 || lines[i + 1]?.trim() === ""

    // --- Fix existing headings ---

    // Downgrade # to ## (# should not appear inside chapter content — it's the chapter title)
    if (/^#\s+/.test(trimmed) && !/^##/.test(trimmed)) {
      const headingText = trimmed.replace(/^#\s+/, "")
      result.push(`## ${headingText}`)
      lastHeadingLevel = 2
      continue
    }

    // Track existing heading levels
    const existingHeading = trimmed.match(/^(#{2,6})\s+(.*)/)
    if (existingHeading) {
      lastHeadingLevel = existingHeading[1].length
      // Ensure blank line before heading (if not at start)
      if (result.length > 0 && result[result.length - 1].trim() !== "") {
        result.push("")
      }
      result.push(line)
      // Ensure blank line after heading
      if (i < lines.length - 1 && lines[i + 1]?.trim() !== "") {
        result.push("")
      }
      continue
    }

    // --- Detect bold-as-heading pattern: **Title** ---
    const boldHeading = isBoldHeading(trimmed)
    if (boldHeading && prevBlank) {
      const level = determineLevel(boldHeading.text, lastHeadingLevel)
      const prefix = "#".repeat(level)
      // Ensure blank line before
      if (result.length > 0 && result[result.length - 1].trim() !== "") {
        result.push("")
      }
      result.push(`${prefix} ${boldHeading.text}`)
      lastHeadingLevel = level
      // Ensure blank line after
      if (i < lines.length - 1 && lines[i + 1]?.trim() !== "") {
        result.push("")
      }
      continue
    }

    // --- Detect standalone short lines that should be headings ---
    if (isLikelyHeading(trimmed, prevBlank, nextBlank)) {
      const level = determineLevel(trimmed, lastHeadingLevel)
      const prefix = "#".repeat(level)
      // Clean up: remove trailing colon if present
      const cleanText = trimmed.replace(/:$/, "").trim()
      // Ensure blank line before
      if (result.length > 0 && result[result.length - 1].trim() !== "") {
        result.push("")
      }
      result.push(`${prefix} ${cleanText}`)
      lastHeadingLevel = level
      // Ensure blank line after
      if (i < lines.length - 1 && lines[i + 1]?.trim() !== "") {
        result.push("")
      }
      continue
    }

    // --- Pass through unchanged ---
    result.push(line)
  }

  return result.join("\n")
}
