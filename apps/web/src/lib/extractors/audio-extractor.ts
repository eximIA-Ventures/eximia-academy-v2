import OpenAI from "openai"

const MAX_WHISPER_SIZE = 25 * 1024 * 1024 // 25MB

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY nao configurada. Contate o administrador.")
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase()
  const mimes: Record<string, string> = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    ogg: "audio/ogg",
  }
  return mimes[ext ?? ""] ?? "audio/mpeg"
}

export async function transcribeAudio(buffer: Buffer, filename: string): Promise<string> {
  if (buffer.length > MAX_WHISPER_SIZE) {
    throw new Error("Audio muito grande para transcricao direta. Limite: 25MB.")
  }

  const openai = getOpenAIClient()
  const file = new File([new Uint8Array(buffer)], filename, { type: getMimeType(filename) })

  let transcription: string | undefined
  let lastError: Error | null = null

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await openai.audio.transcriptions.create({
        model: "whisper-1",
        file,
        language: "pt",
        response_format: "text",
      })
      transcription = result as unknown as string
      break
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt === 0) continue
    }
  }

  if (!transcription) {
    throw lastError ?? new Error("Falha na transcricao do audio. Tente novamente.")
  }

  if (transcription.trim().length < 50) {
    throw new Error("Nao foi possivel identificar fala suficiente no audio.")
  }

  return transcription
}
