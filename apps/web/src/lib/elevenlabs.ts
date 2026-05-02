/**
 * ElevenLabs TTS integration for eximIA Academy
 * Supports: narration (single voice) and podcast (dual voice)
 */

const ELEVENLABS_API = "https://api.elevenlabs.io/v1"

function getApiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) throw new Error("ELEVENLABS_API_KEY not configured")
  return key
}

interface VoiceSettings {
  stability?: number
  similarity_boost?: number
  style?: number
  speed?: number
  use_speaker_boost?: boolean
}

interface TTSOptions {
  text: string
  voiceId?: string
  modelId?: string
  languageCode?: string
  voiceSettings?: VoiceSettings
  outputFormat?: string
}

/** Default voices for Portuguese */
export const VOICES = {
  // Popular ElevenLabs voices good for PT-BR
  narrator_male: process.env.ELEVENLABS_VOICE_NARRATOR_MALE || "pNInz6obpgDQGcFmaJgB", // Adam
  narrator_female: process.env.ELEVENLABS_VOICE_NARRATOR_FEMALE || "21m00Tcm4TlvDq8ikWAM", // Rachel
  podcast_host: process.env.ELEVENLABS_VOICE_PODCAST_HOST || "pNInz6obpgDQGcFmaJgB",
  podcast_cohost: process.env.ELEVENLABS_VOICE_PODCAST_COHOST || "21m00Tcm4TlvDq8ikWAM",
} as const

/** Default voice settings optimized for educational content */
const NARRATION_SETTINGS: VoiceSettings = {
  stability: 0.6,
  similarity_boost: 0.75,
  style: 0.3,
  speed: 0.95,
  use_speaker_boost: true,
}

const PODCAST_SETTINGS: VoiceSettings = {
  stability: 0.5,
  similarity_boost: 0.8,
  style: 0.5,
  speed: 1.0,
  use_speaker_boost: true,
}

/**
 * Generate speech audio from text
 * Returns: ArrayBuffer of audio data (MP3)
 */
export async function generateSpeech(options: TTSOptions): Promise<ArrayBuffer> {
  const {
    text,
    voiceId = VOICES.narrator_male,
    modelId = "eleven_multilingual_v2",
    languageCode = "pt",
    voiceSettings = NARRATION_SETTINGS,
    outputFormat = "mp3_44100_128",
  } = options

  const res = await fetch(`${ELEVENLABS_API}/text-to-speech/${voiceId}?output_format=${outputFormat}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": getApiKey(),
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      language_code: languageCode,
      voice_settings: voiceSettings,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`ElevenLabs TTS failed (${res.status}): ${err}`)
  }

  return res.arrayBuffer()
}

/**
 * Generate podcast-style audio with two speakers
 * Takes chapter content and creates a conversational script, then generates audio
 */
export async function generatePodcastScript(
  chapterTitle: string,
  chapterContent: string,
  aiModel: string = "gpt-4o",
): Promise<Array<{ speaker: "host" | "cohost"; text: string }>> {
  // Use OpenAI to generate the podcast script
  const { OpenAI } = await import("openai")
  const openai = new OpenAI()

  const response = await openai.chat.completions.create({
    model: aiModel,
    temperature: 0.8,
    messages: [
      {
        role: "system",
        content: `Você é um roteirista de podcast educativo. Crie um diálogo natural e envolvente entre dois apresentadores (HOST e COHOST) discutindo o conteúdo de um capítulo de curso.

Regras:
- HOST introduz os temas e faz perguntas provocativas
- COHOST aprofunda com exemplos práticos e analogias
- Tom: profissional mas acessível, como dois especialistas conversando
- Idioma: Português Brasileiro
- Duração: 8-12 turnos de fala (4-6 por pessoa)
- Cada turno: 2-4 frases (30-80 palavras)
- NÃO use marcadores como "Olá pessoal" ou "Bem-vindos ao podcast"
- Comece direto no conteúdo

Retorne APENAS um JSON array:
[{"speaker": "host", "text": "..."}, {"speaker": "cohost", "text": "..."}, ...]`,
      },
      {
        role: "user",
        content: `Capítulo: ${chapterTitle}\n\nConteúdo:\n${chapterContent.slice(0, 8000)}`,
      },
    ],
    response_format: { type: "json_object" },
  })

  const content = response.choices[0]?.message?.content
  if (!content) throw new Error("Failed to generate podcast script")

  const parsed = JSON.parse(content)
  const lines = Array.isArray(parsed) ? parsed : parsed.script ?? parsed.dialogue ?? parsed.lines ?? []

  return lines.map((line: { speaker: string; text: string }) => ({
    speaker: (line.speaker?.toLowerCase() === "cohost" ? "cohost" : "host") as "host" | "cohost",
    text: line.text,
  }))
}

/**
 * Generate full podcast audio from script lines
 * Concatenates audio segments from alternating speakers
 */
export async function generatePodcastAudio(
  script: Array<{ speaker: "host" | "cohost"; text: string }>,
): Promise<ArrayBuffer> {
  const segments: ArrayBuffer[] = []

  for (const line of script) {
    const voiceId = line.speaker === "host" ? VOICES.podcast_host : VOICES.podcast_cohost

    const audio = await generateSpeech({
      text: line.text,
      voiceId,
      voiceSettings: PODCAST_SETTINGS,
    })

    segments.push(audio)

    // Small pause between speakers to avoid overlap (100ms silence)
    // We skip this for simplicity — ElevenLabs handles natural pauses
  }

  // Concatenate all MP3 segments
  const totalLength = segments.reduce((acc, buf) => acc + buf.byteLength, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const segment of segments) {
    result.set(new Uint8Array(segment), offset)
    offset += segment.byteLength
  }

  return result.buffer
}

/**
 * List available voices from ElevenLabs
 */
export async function listVoices(): Promise<Array<{ voice_id: string; name: string; labels: Record<string, string> }>> {
  const res = await fetch(`${ELEVENLABS_API}/voices`, {
    headers: { "xi-api-key": getApiKey() },
  })

  if (!res.ok) throw new Error(`Failed to list voices: ${res.status}`)

  const data = await res.json()
  return data.voices ?? []
}

/**
 * Get usage/subscription info
 */
export async function getUsage(): Promise<{ character_count: number; character_limit: number; remaining: number }> {
  try {
    const res = await fetch(`${ELEVENLABS_API}/user/subscription`, {
      headers: { "xi-api-key": getApiKey() },
    })

    if (!res.ok) return { character_count: 0, character_limit: 0, remaining: -1 }

    const data = await res.json()
    return {
      character_count: data.character_count ?? 0,
      character_limit: data.character_limit ?? 0,
      remaining: (data.character_limit ?? 0) - (data.character_count ?? 0),
    }
  } catch {
    return { character_count: 0, character_limit: 0, remaining: -1 }
  }
}
