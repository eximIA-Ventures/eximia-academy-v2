import type { SupabaseClient } from "@supabase/supabase-js"

const MAX_COVER_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_PDF_SIZE = 100 * 1024 * 1024 // 100MB

export async function uploadBookCover(
  supabase: SupabaseClient,
  file: File,
  tenantId: string,
  bookId: string,
): Promise<string> {
  if (file.size > MAX_COVER_SIZE) {
    throw new Error("Imagem excede o limite de 5MB")
  }

  const ext = file.name.split(".").pop() ?? "jpg"
  const storagePath = `${tenantId}/books/${bookId}/cover.${ext}`

  const { error } = await supabase.storage
    .from("books")
    .upload(storagePath, file, { cacheControl: "3600", upsert: true })

  if (error) throw new Error(`Upload falhou: ${error.message}`)

  const {
    data: { publicUrl },
  } = supabase.storage.from("books").getPublicUrl(storagePath)

  return publicUrl
}

export async function uploadBookPdf(
  supabase: SupabaseClient,
  file: File,
  tenantId: string,
  bookId: string,
): Promise<string> {
  if (file.size > MAX_PDF_SIZE) {
    throw new Error("PDF excede o limite de 100MB")
  }

  const storagePath = `${tenantId}/books/${bookId}/book.pdf`

  const { error } = await supabase.storage
    .from("books")
    .upload(storagePath, file, { cacheControl: "3600", upsert: true })

  if (error) throw new Error(`Upload falhou: ${error.message}`)

  const {
    data: { publicUrl },
  } = supabase.storage.from("books").getPublicUrl(storagePath)

  return publicUrl
}
