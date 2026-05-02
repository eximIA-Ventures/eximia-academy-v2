export interface SlideTimestamp {
  slideId: string
  order: number
  audioStartMs: number
  audioEndMs: number
}

/**
 * Compute proportional audio timestamps for slides based on text length.
 * For TTS (uniform rate), this produces near-perfect sync.
 * For human narration, instructors can adjust manually.
 */
export function computeProportionalTimestamps(
  slides: Array<{ id: string; order: number; text_content: string | null }>,
  totalDurationMs: number,
): SlideTimestamp[] {
  if (!slides.length || totalDurationMs <= 0) return []

  // Calculate total characters across all slides
  const charCounts = slides.map((s) => (s.text_content ?? "").length)
  const totalChars = charCounts.reduce((sum, c) => sum + c, 0)

  // If no text at all, distribute evenly
  if (totalChars === 0) {
    const sliceDuration = totalDurationMs / slides.length
    return slides.map((slide, i) => ({
      slideId: slide.id,
      order: slide.order,
      audioStartMs: Math.round(i * sliceDuration),
      audioEndMs: Math.round((i + 1) * sliceDuration),
    }))
  }

  // Proportional distribution based on text length
  const timestamps: SlideTimestamp[] = []
  let currentMs = 0

  for (let i = 0; i < slides.length; i++) {
    const proportion = charCounts[i] / totalChars
    const durationMs = Math.round(proportion * totalDurationMs)
    const endMs = i === slides.length - 1 ? totalDurationMs : currentMs + durationMs

    timestamps.push({
      slideId: slides[i].id,
      order: slides[i].order,
      audioStartMs: Math.round(currentMs),
      audioEndMs: Math.round(endMs),
    })

    currentMs = endMs
  }

  return timestamps
}
