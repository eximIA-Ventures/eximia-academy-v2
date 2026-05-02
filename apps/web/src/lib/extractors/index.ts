import {
  type DoclingExtractionResult,
  extractWithDocling,
  isDoclingAvailable,
} from "./docling-extractor"
import { extractDocxText } from "./docx-extractor"
import { extractPdfText } from "./pdf-extractor"
import { extractPptxText } from "./pptx-extractor"

export type SourceType = "pdf" | "docx" | "pptx" | "txt" | "audio"

const MIME_TO_SOURCE: Record<string, SourceType> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/plain": "txt",
  "text/markdown": "txt",
  "audio/mpeg": "audio",
  "audio/wav": "audio",
  "audio/mp4": "audio",
  "audio/x-m4a": "audio",
  "audio/ogg": "audio",
}

/** MIME types that Docling can process (documents only, not audio/text). */
const DOCLING_SUPPORTED_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
])

export function mimeToSourceType(mimeType: string): SourceType | null {
  return MIME_TO_SOURCE[mimeType] ?? null
}

export function isAudioMime(mimeType: string): boolean {
  return mimeToSourceType(mimeType) === "audio"
}

/** Legacy extractor — basic text extraction without structure. */
export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  switch (mimeType) {
    case "application/pdf":
      return extractPdfText(buffer)
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return extractDocxText(buffer)
    case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      return extractPptxText(buffer)
    case "text/plain":
    case "text/markdown": {
      const text = buffer.toString("utf-8")
      if (text.trim().length < 50) {
        throw new Error("Arquivo de texto parece estar vazio.")
      }
      return text
    }
    default:
      throw new Error(`Formato nao suportado: ${mimeType}`)
  }
}

export interface EnhancedExtractionResult {
  text: string
  /** Which engine produced this result. */
  extractor: "docling" | "legacy"
  /** Number of pages (Docling only). */
  pageCount?: number
  /** Tables detected in the document (Docling only). */
  tableCount?: number
  /** Images/figures detected (Docling only). */
  imageCount?: number
}

/**
 * Enhanced extraction pipeline: tries Docling first for supported document
 * types, falls back to legacy extractors if Docling is unavailable or fails.
 *
 * Audio and plain-text files always use the legacy path.
 */
export async function extractTextEnhanced(
  buffer: Buffer,
  mimeType: string,
  filename?: string,
): Promise<EnhancedExtractionResult> {
  const isDoclingCandidate = DOCLING_SUPPORTED_MIMES.has(mimeType) && !!filename

  if (isDoclingCandidate) {
    try {
      const available = await isDoclingAvailable()
      if (available) {
        const result: DoclingExtractionResult = await extractWithDocling(buffer, filename)
        return {
          text: result.markdown,
          extractor: "docling",
          pageCount: result.pageCount,
          tableCount: result.tableCount,
          imageCount: result.imageCount,
        }
      }
    } catch (err) {
      console.warn(
        "[extractors] Docling failed, falling back to legacy:",
        err instanceof Error ? err.message : err,
      )
    }
  }

  // Fallback to legacy extractors
  const text = await extractText(buffer, mimeType)
  return { text, extractor: "legacy" }
}

export { extractPdfText, extractPdfStructured } from "./pdf-extractor"
export { cleanPdfContent } from "./pdf-cleaner"
export { extractDocxText } from "./docx-extractor"
export { extractPptxText } from "./pptx-extractor"
export { extractWithDocling, isDoclingAvailable } from "./docling-extractor"
export type { DoclingExtractionResult } from "./docling-extractor"
export { transcribeAudio } from "./audio-extractor"
export { extractYouTubeTranscript, extractVideoId, isYouTubeUrl } from "./youtube-extractor"
