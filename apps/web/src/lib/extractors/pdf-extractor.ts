import { PDFParse } from "pdf-parse"
import type { OutlineNode } from "pdf-parse"

export interface PdfPage {
  num: number
  text: string
  charCount: number
}

export interface PdfOutlineEntry {
  title: string
  level: number
  children: PdfOutlineEntry[]
}

export interface PdfExtraction {
  pages: PdfPage[]
  outline: PdfOutlineEntry[]
  totalPages: number
  metadata: {
    title?: string
    author?: string
  }
}

function flattenOutline(nodes: OutlineNode[], level = 0): PdfOutlineEntry[] {
  return nodes.flatMap((node) => {
    const entry: PdfOutlineEntry = {
      title: node.title?.trim() ?? "",
      level,
      children: node.items?.length ? flattenOutline(node.items, level + 1) : [],
    }
    return entry.title ? [entry] : []
  })
}

/** Safely extract outline — pdfjs internals can throw on transfer */
async function safeGetInfo(pdf: PDFParse): Promise<{
  outline: PdfOutlineEntry[]
  totalPages: number
  metadata: { title?: string; author?: string }
}> {
  try {
    const info = await pdf.getInfo()
    return {
      outline: info.outline ? flattenOutline(info.outline) : [],
      totalPages: info.total,
      metadata: {
        title: typeof info.info?.Title === "string" ? info.info.Title : undefined,
        author: typeof info.info?.Author === "string" ? info.info.Author : undefined,
      },
    }
  } catch {
    // getInfo() can fail with "Cannot transfer object of unsupported type"
    // in some pdfjs/worker configurations — fall back gracefully
    return { outline: [], totalPages: 0, metadata: {} }
  }
}

/** Extract PDF text page-by-page with outline and metadata */
export async function extractPdfStructured(buffer: Buffer): Promise<PdfExtraction> {
  const pdf = new PDFParse({ data: new Uint8Array(buffer) })
  try {
    // getText first (critical), then getInfo (optional)
    const textResult = await pdf.getText({ pageJoiner: "" })

    if (!textResult.text || textResult.text.trim().length < 50) {
      throw new Error("PDF parece estar vazio ou conter apenas imagens escaneadas.")
    }

    const pages: PdfPage[] = textResult.pages.map((p) => ({
      num: p.num,
      text: p.text,
      charCount: p.text.trim().length,
    }))

    const info = await safeGetInfo(pdf)

    return {
      pages,
      outline: info.outline,
      totalPages: info.totalPages || pages.length,
      metadata: info.metadata,
    }
  } finally {
    await pdf.destroy()
  }
}

/** Legacy: extract full text as single string */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdf = new PDFParse({ data: new Uint8Array(buffer) })
  try {
    const result = await pdf.getText()
    if (!result.text || result.text.trim().length < 50) {
      throw new Error("PDF parece estar vazio ou conter apenas imagens escaneadas.")
    }
    return result.text
  } finally {
    await pdf.destroy()
  }
}
