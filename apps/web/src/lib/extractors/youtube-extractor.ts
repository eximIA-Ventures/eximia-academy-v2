const YOUTUBE_REGEX = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/

export function extractVideoId(url: string): string | null {
  const match = url.match(YOUTUBE_REGEX)
  return match?.[1] ?? null
}

export function isYouTubeUrl(url: string): boolean {
  return YOUTUBE_REGEX.test(url)
}

export async function extractYouTubeTranscript(url: string): Promise<string> {
  const videoId = extractVideoId(url)
  if (!videoId) {
    throw new Error("URL do YouTube invalida.")
  }

  // Try fetching YouTube auto-generated captions via public innertube API
  try {
    const watchPageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.5" },
    })
    const html = await watchPageRes.text()

    // Extract captions track URL from the page data (bounded to prevent ReDoS)
    const captionMatch = html.match(/"captionTracks":\s*(\[[\s\S]{1,10000}?\])/)
    if (!captionMatch) {
      throw new Error("no_captions")
    }

    let tracks: Array<{ baseUrl: string; languageCode: string }>
    try {
      const parsed = JSON.parse(captionMatch[1]) as unknown
      if (!Array.isArray(parsed)) throw new Error("invalid")
      tracks = parsed.filter(
        (t): t is { baseUrl: string; languageCode: string } =>
          typeof t === "object" &&
          t !== null &&
          typeof (t as Record<string, unknown>).baseUrl === "string" &&
          typeof (t as Record<string, unknown>).languageCode === "string",
      )
    } catch {
      throw new Error("no_captions")
    }

    // Prefer PT, fallback to first available
    const ptTrack = tracks.find((t) => t.languageCode === "pt" || t.languageCode === "pt-BR")
    const track = ptTrack || tracks[0]

    if (!track) {
      throw new Error("no_captions")
    }

    // Validate caption URL protocol (SSRF protection)
    const captionUrl = new URL(track.baseUrl)
    if (captionUrl.protocol !== "https:") {
      throw new Error("no_captions")
    }

    // Fetch the caption XML
    const captionRes = await fetch(track.baseUrl)
    const xml = await captionRes.text()

    // Parse text from XML <text> elements
    const textMatches = xml.matchAll(/<text[^>]*>(.*?)<\/text>/gs)
    const lines: string[] = []
    for (const m of textMatches) {
      const decoded = m[1]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/<[^>]*>/g, "")
        .trim()
      if (decoded) lines.push(decoded)
    }

    const transcript = lines.join(" ")

    if (transcript.length < 50) {
      throw new Error("no_captions")
    }

    return transcript
  } catch (err) {
    if (err instanceof Error && err.message === "no_captions") {
      throw new Error(
        "Nao foi possivel extrair legendas do vídeo. " +
          "Baixe o audio do vídeo e faca upload diretamente.",
      )
    }
    throw new Error(
      "Erro ao acessar o vídeo do YouTube. " +
        "Verifique se o link esta correto e o vídeo e publico.",
    )
  }
}
