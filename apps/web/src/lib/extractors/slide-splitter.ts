import JSZip from "jszip"

export interface ExtractedSlide {
  order: number
  imageBuffer: Buffer
  imageMime: string
  imageExt: string
  /** For PDFs: page number (1-based). For PPTX/images: undefined */
  pageNumber?: number
  /** Original source type */
  sourceType: "pdf" | "pptx" | "image"
}

/**
 * Extract slides from a PDF file.
 * Returns one slide per page with a placeholder buffer — actual rendering
 * happens client-side via react-pdf for vector quality.
 * The API route stores the original PDF and creates slides with metadata.
 */
export async function extractSlidesFromPdf(
  file: Buffer,
  _fileName: string,
): Promise<{ pageCount: number; pdfBuffer: Buffer }> {
  // Use pdf-parse v2 to get page count (already installed)
  const { PDFParse } = await import("pdf-parse")
  const pdf = new PDFParse({ data: new Uint8Array(file) })
  const info = await pdf.getInfo()
  return { pageCount: info.total, pdfBuffer: file }
}

/**
 * Extract slide images from a PPTX file using JSZip.
 * Maps slide relationships to find the correct image for each slide.
 */
export async function extractSlidesFromPptx(file: Buffer): Promise<ExtractedSlide[]> {
  const zip = await JSZip.loadAsync(file)
  const slides: ExtractedSlide[] = []

  // Get all slide XML files sorted by number
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = Number.parseInt(a.match(/slide(\d+)/)?.[1] ?? "0")
      const numB = Number.parseInt(b.match(/slide(\d+)/)?.[1] ?? "0")
      return numA - numB
    })

  for (let i = 0; i < slideFiles.length; i++) {
    const slideFile = slideFiles[i]
    const slideNum = slideFile.match(/slide(\d+)/)?.[1] ?? String(i + 1)

    // Try to find the relationship file for this slide
    const relsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`
    const relsFile = zip.file(relsPath)

    let imageFound = false

    if (relsFile) {
      const relsXml = await relsFile.async("text")
      // Find image references in relationships
      const imageRefs = relsXml.match(/Target="[^"]*\/media\/[^"]+"/g) ?? []

      for (const ref of imageRefs) {
        const target = ref.match(/Target="\.\.\/(.+?)"/)?.[1] ?? ref.match(/Target="(.+?)"/)?.[1]
        if (!target) continue

        const fullPath = target.startsWith("ppt/") ? target : `ppt/${target}`
        const imageFile = zip.file(fullPath)
        if (!imageFile) continue

        const buffer = Buffer.from(await imageFile.async("arraybuffer"))
        const ext = fullPath.split(".").pop()?.toLowerCase() ?? "png"
        const mimeMap: Record<string, string> = {
          png: "image/png",
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          gif: "image/gif",
          svg: "image/svg+xml",
          emf: "image/emf",
          wmf: "image/wmf",
        }

        slides.push({
          order: i,
          imageBuffer: buffer,
          imageMime: mimeMap[ext] ?? "image/png",
          imageExt: ext === "jpeg" ? "jpg" : ext,
          sourceType: "pptx",
        })
        imageFound = true
        break // Take first image per slide
      }
    }

    // If no image found via rels, try media folder directly
    if (!imageFound) {
      const mediaFiles = Object.keys(zip.files)
        .filter((name) => name.startsWith("ppt/media/"))
        .sort()

      if (mediaFiles[i]) {
        const imageFile = zip.file(mediaFiles[i])
        if (imageFile) {
          const buffer = Buffer.from(await imageFile.async("arraybuffer"))
          const ext = mediaFiles[i].split(".").pop()?.toLowerCase() ?? "png"
          slides.push({
            order: i,
            imageBuffer: buffer,
            imageMime: ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png",
            imageExt: ext === "jpeg" ? "jpg" : ext,
            sourceType: "pptx",
          })
        }
      }
    }
  }

  return slides
}

/**
 * Process uploaded images directly as slides.
 */
export function processImageAsSlide(
  buffer: Buffer,
  mime: string,
  order: number,
): ExtractedSlide {
  const extMap: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
  }
  return {
    order,
    imageBuffer: buffer,
    imageMime: mime,
    imageExt: extMap[mime] ?? "png",
    sourceType: "image",
  }
}
