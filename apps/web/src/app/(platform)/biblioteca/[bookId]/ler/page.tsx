import { createClient } from "@/lib/supabase/server"
import { tenantRedirect } from "@/lib/tenant-nav"
import { redirect, notFound } from "next/navigation"
import { getBookWithContent, toClientBook } from "@/lib/books-queries"
import { BookReaderUnified } from "@/components/biblioteca/book-reader-unified"

export default async function BookReaderPage({
  params,
}: {
  params: Promise<{ bookId: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return tenantRedirect("/login")

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()
  if (!profile) return tenantRedirect("/login")

  const { bookId } = await params
  const { book: dbBook, chapters, summaryChapters } = await getBookWithContent(supabase, bookId)
  if (!dbBook) notFound()

  // Generate signed URL if PDF exists
  let pdfUrl: string | null = null
  if (dbBook.file_url && dbBook.processing_status !== "idle") {
    const { data: signedUrlData } = await supabase.storage
      .from("books")
      .createSignedUrl(dbBook.file_url, 3600)
    pdfUrl = signedUrlData?.signedUrl ?? null
  }

  const hasContent = chapters.length > 0 || !!pdfUrl
  if (!hasContent) notFound()

  const book = toClientBook(dbBook, chapters, summaryChapters)

  return <BookReaderUnified book={book} pdfUrl={pdfUrl} />
}
