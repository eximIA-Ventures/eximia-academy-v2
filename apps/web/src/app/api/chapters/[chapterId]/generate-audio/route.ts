export const maxDuration = 300 // 5 min — podcast generation can be slow

import { generatePodcastAudio, generatePodcastScript, generateSpeech } from "@/lib/elevenlabs"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { NextResponse } from "next/server"

interface RouteContext {
  params: Promise<{ chapterId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { chapterId } = await context.params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { data: profile } = await supabase.from("users").select("role, tenant_id").eq("id", user.id).single()
  if (!profile || !["manager", "admin", "instructor"].includes(profile.role)) {
    return NextResponse.json({ error: "Permissão negada" }, { status: 403 })
  }

  // Parse body
  let body: { mode?: string; voiceId?: string }
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const mode = body.mode ?? "narration" // "narration" | "podcast"

  // Fetch chapter content
  const service = createServiceClient()
  const { data: chapter } = await service
    .from("chapters")
    .select("id, title, content, course_id, tenant_id")
    .eq("id", chapterId)
    .single()

  if (!chapter) return NextResponse.json({ error: "Capítulo não encontrado" }, { status: 404 })
  if (!chapter.content || chapter.content.trim().length < 50) {
    return NextResponse.json({ error: "Capítulo sem conteúdo suficiente para gerar áudio" }, { status: 400 })
  }

  try {
    let audioBuffer: ArrayBuffer
    let filename: string

    if (mode === "podcast") {
      // Generate podcast script with AI
      const script = await generatePodcastScript(chapter.title, chapter.content)

      if (script.length === 0) {
        return NextResponse.json({ error: "Falha ao gerar roteiro do podcast" }, { status: 500 })
      }

      // Generate audio from script
      audioBuffer = await generatePodcastAudio(script)
      filename = `podcast-${chapterId}.mp3`
    } else {
      // Narration (audiobook) — read slide notes in order, fallback to chapter content
      const { data: slides } = await service
        .from("chapter_slides")
        .select("text_content, order")
        .eq("chapter_id", chapterId)
        .order("order", { ascending: true })

      const slideTexts = (slides ?? [])
        .map(s => s.text_content?.trim())
        .filter(Boolean) as string[]

      const narrationText = slideTexts.length > 0
        ? slideTexts.join("\n\n").slice(0, 10000)
        : chapter.content.slice(0, 10000) // ElevenLabs limit safety

      audioBuffer = await generateSpeech({
        text: narrationText,
        voiceId: body.voiceId,
      })
      filename = `narration-${chapterId}.mp3`
    }

    // Upload to Supabase Storage
    const storagePath = `${chapter.tenant_id}/${chapter.course_id}/${filename}`
    const { error: uploadError } = await service.storage
      .from("chapter-assets")
      .upload(storagePath, audioBuffer, {
        contentType: "audio/mpeg",
        upsert: true,
      })

    if (uploadError) {
      return NextResponse.json({ error: `Erro no upload: ${uploadError.message}` }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = service.storage.from("chapter-assets").getPublicUrl(storagePath)
    const audioUrl = urlData.publicUrl

    // Update chapter with audio URL
    const updateField = mode === "podcast" ? "slide_audio_url" : "audio_url"
    await service
      .from("chapters")
      .update({ [updateField]: audioUrl, updated_at: new Date().toISOString() })
      .eq("id", chapterId)

    return NextResponse.json({
      success: true,
      mode,
      audioUrl,
      duration: mode === "podcast" ? "Podcast gerado com sucesso" : "Narração gerada com sucesso",
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    console.error("Audio generation error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
