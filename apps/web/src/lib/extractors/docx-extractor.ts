import mammoth from "mammoth"

export async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer })
  if (!result.value || result.value.trim().length < 50) {
    throw new Error("Documento DOCX parece estar vazio.")
  }
  return result.value
}
