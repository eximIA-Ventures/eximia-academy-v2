import type { SupabaseClient } from "@supabase/supabase-js"

const mimeToExt: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
}

const IMAGE_MAX_SIZE = 5 * 1024 * 1024 // 5MB
const AUDIO_MAX_SIZE = 50 * 1024 * 1024 // 50MB

export async function uploadChapterAsset(
  supabase: SupabaseClient,
  file: File,
  tenantId: string,
  chapterId: string,
  type: "images" | "audio",
): Promise<string> {
  // Client-side size validation
  const maxSize = type === "images" ? IMAGE_MAX_SIZE : AUDIO_MAX_SIZE
  if (file.size > maxSize) {
    const limitMB = maxSize / (1024 * 1024)
    throw new Error(`Arquivo excede o limite de ${limitMB}MB`)
  }

  const ext = mimeToExt[file.type] ?? file.name.split(".").pop() ?? "bin"
  const fileName = `${crypto.randomUUID()}.${ext}`
  const path = `${tenantId}/${chapterId}/${type}/${fileName}`

  const { error } = await supabase.storage
    .from("chapter-assets")
    .upload(path, file, { cacheControl: "3600", upsert: false })

  if (error) throw new Error(`Upload falhou: ${error.message}`)

  const {
    data: { publicUrl },
  } = supabase.storage.from("chapter-assets").getPublicUrl(path)

  return publicUrl
}
