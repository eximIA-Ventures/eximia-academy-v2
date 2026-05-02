const DOCLING_URL = process.env.DOCLING_API_URL || "http://docling:5001"
const DOCLING_TIMEOUT_MS = 300_000 // 5 min for large files

export interface DoclingExtractionResult {
  markdown: string
  pageCount: number
  tableCount: number
  imageCount: number
}

/**
 * Check if docling-serve is reachable (fast health probe).
 * Returns false on timeout or error — never throws.
 */
export async function isDoclingAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${DOCLING_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Send a document buffer to docling-serve for structured extraction.
 * Returns high-quality Markdown with tables, formulas and layout preserved.
 *
 * Supported formats: PDF, DOCX, PPTX, XLSX, HTML, images.
 */
export async function extractWithDocling(
  buffer: Buffer,
  filename: string,
): Promise<DoclingExtractionResult> {
  const formData = new FormData()
  // Copy into a fresh ArrayBuffer to satisfy TypeScript's strict Blob typing
  const ab = new ArrayBuffer(buffer.byteLength)
  new Uint8Array(ab).set(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength))
  const blob = new Blob([ab])
  formData.append("files", blob, filename)
  formData.append(
    "options",
    JSON.stringify({
      to_formats: ["md"],
      ocr: true,
      table_mode: "accurate",
    }),
  )

  const res = await fetch(`${DOCLING_URL}/v1/convert/file`, {
    method: "POST",
    body: formData,
    signal: AbortSignal.timeout(DOCLING_TIMEOUT_MS),
  })

  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unknown error")
    throw new Error(`Docling falhou (${res.status}): ${errorText}`)
  }

  const payload = await res.json()

  // Handle response formats across docling-serve versions:
  // v1 array: [{filename, status, rendered, document}]
  // v1 wrapped: {results: [{...}]}
  // v1 single: {document, rendered, status}
  const result = Array.isArray(payload)
    ? payload[0]
    : payload.results
      ? payload.results[0]
      : payload

  if (!result || result.status === "failure") {
    const errors = result?.errors?.join(", ") || "erro desconhecido"
    throw new Error(`Docling não conseguiu processar o arquivo: ${errors}`)
  }

  const markdown: string = result.rendered?.md || result.md_content || ""
  const document = result.document || {}

  if (!markdown || markdown.trim().length < 50) {
    throw new Error(
      "Docling retornou conteúdo vazio ou insuficiente. O arquivo pode conter apenas imagens sem texto.",
    )
  }

  return {
    markdown,
    pageCount: document.pages?.length || 0,
    tableCount: Array.isArray(document.tables) ? document.tables.length : 0,
    imageCount: Array.isArray(document.pictures)
      ? document.pictures.length
      : Array.isArray(document.figures)
        ? document.figures.length
        : 0,
  }
}
