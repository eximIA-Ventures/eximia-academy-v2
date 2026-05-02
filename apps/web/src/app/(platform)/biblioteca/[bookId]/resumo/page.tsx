import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { getBookWithContent, toClientBook } from "@/lib/books-queries"
import { BookReaderClient } from "@/components/biblioteca/book-reader-client"

export default async function BookSummaryPage({
  params,
}: {
  params: Promise<{ bookId: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return redirect("/login")

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()
  if (!profile) return redirect("/login")

  const { bookId } = await params
  const { book: dbBook, chapters, summaryChapters } = await getBookWithContent(supabase, bookId)
  if (!dbBook || summaryChapters.length === 0) notFound()

  const book = toClientBook(dbBook, chapters, summaryChapters)

  return <BookReaderClient book={book} sections={book.summaryChapters} mode="summary" />
}
