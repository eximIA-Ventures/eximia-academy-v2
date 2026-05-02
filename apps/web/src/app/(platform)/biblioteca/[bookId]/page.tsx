import { createClient } from "@/lib/supabase/server"
import { tenantRedirect } from "@/lib/tenant-nav"
import { redirect, notFound } from "next/navigation"
import { getBooks, getBookWithContent, toClientBook } from "@/lib/books-queries"
import { BookDetailClient } from "@/components/biblioteca/book-detail-client"

export default async function BookDetailPage({
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
  const { book: dbBook, chapters, summaryChapters, error } = await getBookWithContent(supabase, bookId)
  if (!dbBook || error) notFound()

  const book = toClientBook(dbBook, chapters, summaryChapters)

  // Get related books (same category or overlapping tags)
  const { data: allBooks } = await getBooks(supabase)
  const relatedBooks = (allBooks ?? [])
    .filter(
      (b) =>
        b.id !== book.id &&
        (b.category === book.category || (b.tags ?? []).some((t) => book.tags.includes(t))),
    )
    .slice(0, 4)
    .map((b) => toClientBook(b))

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <BookDetailClient book={book} relatedBooks={relatedBooks} />
    </div>
  )
}
