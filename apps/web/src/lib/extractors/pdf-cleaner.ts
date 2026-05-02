import type { PdfExtraction, PdfPage, PdfOutlineEntry } from "./pdf-extractor"

// ─── Types ───────────────────────────────────────────────────────

export type PageClassification = "content" | "boilerplate" | "toc"

export interface ClassifiedPage extends PdfPage {
  classification: PageClassification
  reason?: string
}

export interface DetectedChapter {
  title: string
  content: string
}

export interface CleanedPdf {
  chapters: DetectedChapter[]
  /** All content pages concatenated (fallback if no chapters detected) */
  cleanText: string
  stats: {
    totalPages: number
    contentPages: number
    boilerplatePages: number
    tocPages: number
    chaptersDetected: number
    outlineUsed: boolean
  }
}

// ─── Boilerplate detection patterns (page-level) ────────────────

const BOILERPLATE_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  // Copyright / legal
  { pattern: /©|\bcopyright\b/i, reason: "copyright" },
  { pattern: /\btodos\s+os\s+direitos\s+reservados\b/i, reason: "legal" },
  { pattern: /\bisbn[\s:-]*[\dxX-]{10,}/i, reason: "isbn" },
  { pattern: /\bcip[\s-]brasil\b|\bcataloga[çc][aã]o/i, reason: "ficha-catalografica" },
  { pattern: /\bficha\s+catalogr[aá]fica\b/i, reason: "ficha-catalografica" },
  { pattern: /\bdados\s+internacionais\s+de\s+cataloga/i, reason: "ficha-catalografica" },

  // Publisher / editorial
  { pattern: /\bcadastre[\s-]se\b/i, reason: "editorial-promo" },
  { pattern: /\bvisite[\s-]nos\b/i, reason: "editorial-promo" },
  { pattern: /\bcurta[\s-]nos\b/i, reason: "editorial-promo" },
  { pattern: /\bsiga[\s-]nos\b/i, reason: "editorial-promo" },
  { pattern: /facebook\.com|twitter\.com|instagram\.com|linkedin\.com/i, reason: "social-media" },
  { pattern: /@\w+(?:gente|editora|publisher)/i, reason: "social-media" },

  // Printing / edition info
  { pattern: /\bimpress[aã]o\b.*\b(?:gr[aá]fica|editora)\b/i, reason: "printing-info" },
  { pattern: /\b\d+[ªa]\s*(?:edi[çc][aã]o|reimpress[aã]o)\b/i, reason: "edition-info" },
  { pattern: /\bprojeto\s+gr[aá]fico\b/i, reason: "credits" },
  { pattern: /\brevis[aã]o\s*:\s/i, reason: "credits" },
  { pattern: /\bcapa\s*:\s/i, reason: "credits" },
  { pattern: /\bdiagramação\b|\bdiagrama[çc][aã]o\b/i, reason: "credits" },
]

const TOC_PATTERNS: RegExp[] = [
  /^sum[aá]rio\s*$/im,
  /^[ií]ndice\s*$/im,
  /^contents?\s*$/im,
  /^table\s+of\s+contents\s*$/im,
]

const MIN_PAGE_CHARS = 80
const BOILERPLATE_THRESHOLD = 2

// ─── Page classification ────────────────────────────────────────

function classifyPage(page: PdfPage): ClassifiedPage {
  const text = page.text.trim()

  if (page.charCount < MIN_PAGE_CHARS) {
    return { ...page, classification: "boilerplate", reason: "too-short" }
  }

  // ToC detection: standard headers ("Sumário", "Índice", etc.)
  for (const pattern of TOC_PATTERNS) {
    if (pattern.test(text)) {
      const linesWithNumbers = text.split("\n").filter((l) => /\d+\s*$/.test(l.trim())).length
      if (linesWithNumbers >= 3) {
        return { ...page, classification: "toc", reason: "toc-pattern" }
      }
    }
  }

  // ToC detection: pages with many numbered entries ("12. CAPÍTULO 1 - ...")
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
  const numberedEntries = lines.filter((l) => /^\d+\.\s+/.test(l)).length
  if (numberedEntries >= 5) {
    return { ...page, classification: "toc", reason: "numbered-entries" }
  }

  // ToC detection: pages listing 4+ chapter references on one page
  const chapterRefs = (text.match(/cap[ií]tulo\s+\d+/gi) || []).length
  if (chapterRefs >= 4) {
    return { ...page, classification: "toc", reason: "chapter-listing" }
  }

  // Boilerplate detection
  let boilerplateHits = 0
  let lastReason = ""
  for (const { pattern, reason } of BOILERPLATE_PATTERNS) {
    if (pattern.test(text)) {
      boilerplateHits++
      lastReason = reason
    }
  }

  if (page.charCount < 300 && boilerplateHits >= 1) {
    return { ...page, classification: "boilerplate", reason: lastReason }
  }

  if (boilerplateHits >= BOILERPLATE_THRESHOLD) {
    return { ...page, classification: "boilerplate", reason: `multi:${lastReason}` }
  }

  return { ...page, classification: "content" }
}

// ─── Line-level cleanup ─────────────────────────────────────────

const LINE_BOILERPLATE_PATTERNS: RegExp[] = [
  /^[\s]*\d+[\s]*$/, // Standalone page numbers
  /^[-–—\s]+$/, // Separator lines
  /^\s*www\.\S+\s*$/i, // Standalone URLs
  /^\s*(?:facebook|twitter|instagram|linkedin)\.com\S*\s*$/i,
]

function cleanText(text: string): string {
  return text
    .split("\n")
    .filter((line) => !LINE_BOILERPLATE_PATTERNS.some((p) => p.test(line)))
    .join("\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
}

// ─── Text-based chapter splitting ───────────────────────────────
// We search the full concatenated text for "CAPÍTULO N" anchors and
// split at those points. Handles both single-line ("CAPÍTULO N - Title")
// and multi-line ("CAPÍTULO N\nTitle") headings. Deduplicates by
// chapter number to avoid false matches from ToC fragments.

/** Find all "CAPÍTULO N" anchors, extract titles, deduplicate */
function chaptersFromFullText(fullText: string): DetectedChapter[] | null {
  const ANCHOR_RE = /^(cap[ií]tulo\s+(\d+))/gim
  const allMatches: Array<{ title: string; num: number; index: number }> = []

  let m: RegExpExecArray | null
  // biome-ignore lint/suspicious/noAssignInExpressions: regex exec loop
  while ((m = ANCHOR_RE.exec(fullText)) !== null) {
    const num = Number.parseInt(m[2])
    const anchor = m[1].trim()
    const afterAnchor = fullText.slice(m.index + m[0].length, m.index + m[0].length + 200)

    // Check if title is on same line: "CAPÍTULO 1 - Title" or "CAPÍTULO 1: Title"
    const sameLineMatch = afterAnchor.match(/^[^\S\n]*[-–:.]\s*([^\n]+)/)
    // Check if title is on next line: "CAPÍTULO 1\nTitle"
    const nextLineMatch = afterAnchor.match(/^[^\S\n]*\n[^\S\n]*([^\n]{3,})/)

    let title: string
    if (sameLineMatch) {
      title = `${anchor} - ${sameLineMatch[1].trim()}`
    } else if (nextLineMatch) {
      title = `${anchor} - ${nextLineMatch[1].trim()}`
    } else {
      title = anchor
    }

    allMatches.push({ title, num, index: m.index })
  }

  if (allMatches.length < 2) return null

  // Deduplicate by chapter number: keep the occurrence with the most
  // content following it. ToC entries have tiny gaps between consecutive
  // chapters; body text entries have large gaps.
  const bestByNum = new Map<number, { title: string; index: number; contentSize: number }>()

  for (let i = 0; i < allMatches.length; i++) {
    const end = i < allMatches.length - 1 ? allMatches[i + 1].index : fullText.length
    const contentSize = end - allMatches[i].index

    const existing = bestByNum.get(allMatches[i].num)
    if (!existing || contentSize > existing.contentSize) {
      bestByNum.set(allMatches[i].num, {
        title: allMatches[i].title,
        index: allMatches[i].index,
        contentSize,
      })
    }
  }

  // Sort by position in text
  const deduped = [...bestByNum.values()].sort((a, b) => a.index - b.index)

  if (deduped.length < 2) return null

  // Build chapters from deduped anchors
  const chapters: DetectedChapter[] = []
  for (let i = 0; i < deduped.length; i++) {
    const start = deduped[i].index
    const end = i < deduped.length - 1 ? deduped[i + 1].index : fullText.length
    const rawContent = fullText.slice(start, end).trim()

    // Skip if content is just the heading (< 200 chars)
    if (rawContent.length < 200) continue

    chapters.push({
      title: deduped[i].title,
      content: rawContent,
    })
  }

  return chapters.length >= 2 ? chapters : null
}

/** Try splitting by outline titles found in the text */
function chaptersFromOutlineText(outline: PdfOutlineEntry[], fullText: string): DetectedChapter[] | null {
  if (outline.length < 2) return null

  const topLevel = outline.filter((e) => e.level === 0)
  if (topLevel.length < 2) return null

  // Find each outline title in the text
  const found: Array<{ title: string; index: number }> = []
  for (const entry of topLevel) {
    const idx = fullText.indexOf(entry.title)
    if (idx !== -1) {
      found.push({ title: entry.title, index: idx })
    } else {
      // Try case-insensitive search
      const lowerIdx = fullText.toLowerCase().indexOf(entry.title.toLowerCase())
      if (lowerIdx !== -1) {
        found.push({ title: entry.title, index: lowerIdx })
      }
    }
  }

  if (found.length < topLevel.length * 0.5 || found.length < 2) return null

  // Sort by position in text
  found.sort((a, b) => a.index - b.index)

  const chapters: DetectedChapter[] = []
  for (let i = 0; i < found.length; i++) {
    const start = found[i].index
    const end = i < found.length - 1 ? found[i + 1].index : fullText.length
    const rawContent = fullText.slice(start, end).trim()

    if (rawContent.length < 200) continue

    chapters.push({
      title: found[i].title,
      content: rawContent,
    })
  }

  return chapters.length >= 2 ? chapters : null
}

// ─── Main pipeline ──────────────────────────────────────────────

export function cleanPdfContent(extraction: PdfExtraction): CleanedPdf {
  // 1. Classify pages and filter boilerplate
  const classified = extraction.pages.map(classifyPage)
  const contentPages = classified.filter((p) => p.classification === "content")
  const boilerplatePages = classified.filter((p) => p.classification === "boilerplate")
  const tocPages = classified.filter((p) => p.classification === "toc")

  // 2. Build clean full text from content pages
  const fullCleanText = cleanText(
    contentPages.map((p) => p.text).join("\n\n"),
  )

  // 3. Detect chapters: try text-based regex first (most reliable),
  //    then outline-based as fallback. Pick whichever finds more chapters.
  let chapters: DetectedChapter[] | null = null
  let outlineUsed = false

  // Text-based detection (handles both single-line and multi-line headings)
  const textChapters = chaptersFromFullText(fullCleanText)

  // Outline-based detection (fallback)
  let outlineChapters: DetectedChapter[] | null = null
  if (extraction.outline.length >= 2) {
    outlineChapters = chaptersFromOutlineText(extraction.outline, fullCleanText)
  }

  // Pick the approach that found the most chapters
  if (textChapters && outlineChapters) {
    if (outlineChapters.length > textChapters.length) {
      chapters = outlineChapters
      outlineUsed = true
    } else {
      chapters = textChapters
    }
  } else if (textChapters) {
    chapters = textChapters
  } else if (outlineChapters) {
    chapters = outlineChapters
    outlineUsed = true
  }

  return {
    chapters: chapters ?? [],
    cleanText: fullCleanText,
    stats: {
      totalPages: extraction.totalPages,
      contentPages: contentPages.length,
      boilerplatePages: boilerplatePages.length,
      tocPages: tocPages.length,
      chaptersDetected: chapters?.length ?? 0,
      outlineUsed,
    },
  }
}
