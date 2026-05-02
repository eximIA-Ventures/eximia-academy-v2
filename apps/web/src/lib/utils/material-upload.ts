import type { SupabaseClient } from "@supabase/supabase-js"

const MAX_SIZE = 100 * 1024 * 1024 // 100MB

export async function uploadMaterial(
  supabase: SupabaseClient,
  file: File,
  tenantId: string,
): Promise<{ publicUrl: string; fileName: string; fileSize: number; fileType: string }> {
  if (file.size > MAX_SIZE) {
    throw new Error("Arquivo excede o limite de 100MB")
  }

  const ext = file.name.split(".").pop() ?? "bin"
  const storagePath = `${tenantId}/${crypto.randomUUID()}-${file.name}`

  const { error } = await supabase.storage
    .from("materials")
    .upload(storagePath, file, { cacheControl: "3600", upsert: false })

  if (error) throw new Error(`Upload falhou: ${error.message}`)

  const {
    data: { publicUrl },
  } = supabase.storage.from("materials").getPublicUrl(storagePath)

  return {
    publicUrl,
    fileName: file.name,
    fileSize: file.size,
    fileType: ext,
  }
}
