import JSZip from "jszip"

const XML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
}

function decodeXmlEntities(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|apos|#(\d+)|#x([0-9a-fA-F]+));/g, (match, dec, hex) => {
    if (dec) return String.fromCharCode(Number.parseInt(dec, 10))
    if (hex) return String.fromCharCode(Number.parseInt(hex, 16))
    return XML_ENTITIES[match] ?? match
  })
}

export async function extractPptxText(buffer: Buffer): Promise<string> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(buffer)
  } catch {
    throw new Error("Nao foi possivel ler o arquivo PPTX. Verifique se nao esta corrompido.")
  }

  // Collect slide filenames and sort numerically (slide1, slide2, ...)
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = Number.parseInt(a.match(/slide(\d+)/)?.[1] ?? "0", 10)
      const numB = Number.parseInt(b.match(/slide(\d+)/)?.[1] ?? "0", 10)
      return numA - numB
    })

  if (slideFiles.length === 0) {
    throw new Error("Arquivo PPTX parece estar vazio ou corrompido.")
  }

  const slideTexts: string[] = []

  for (const slidePath of slideFiles) {
    const xml = await zip.file(slidePath)?.async("text")
    if (!xml) continue

    // Extract text from <a:t> tags (PowerPoint text runs)
    const textParts: string[] = []
    const tagRegex = /<a:t>([\s\S]*?)<\/a:t>/g
    let match = tagRegex.exec(xml)
    while (match) {
      const text = decodeXmlEntities(match[1]).trim()
      if (text) textParts.push(text)
      match = tagRegex.exec(xml)
    }

    if (textParts.length > 0) {
      slideTexts.push(textParts.join(" "))
    }
  }

  const fullText = slideTexts.join("\n\n")

  if (fullText.trim().length < 50) {
    throw new Error("Apresentacao PPTX parece estar vazia ou conter apenas imagens.")
  }

  return fullText
}
