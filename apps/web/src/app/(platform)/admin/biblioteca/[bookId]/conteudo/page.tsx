import { getAuthProfile } from "@/lib/auth"
import { getBookById, getBookChapters } from "@/lib/books-queries"
import { tenantRedirect } from "@/lib/tenant-nav"
import { redirect } from "next/navigation"
import { BookContentEditorClient } from "./_components/book-content-editor-client"

export default async function AdminBookContentPage({
  params,
}: {
  params: Promise<{ bookId: string }>
}) {
  const { user, profile, supabase } = await getAuthProfile()

  if (!user || !profile) return tenantRedirect("/login")
  if (!["admin", "super_admin"].includes(profile.role)) return tenantRedirect("/dashboard")

  const { bookId } = await params
  const { data: book } = await getBookById(supabase, bookId)

  if (!book) return tenantRedirect("/admin/biblioteca")

  const [chaptersResult, summaryResult] = await Promise.all([
    getBookChapters(supabase, bookId, "chapter"),
    getBookChapters(supabase, bookId, "summary"),
  ])

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-bg-card via-bg-surface to-accent-blue-deep p-6 md:p-8">
        <div className="relative z-10">
          <p className="text-xs font-medium uppercase tracking-widest text-accent-blue-light">
            Conteúdo do livro
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
            {book.title}
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            {book.author} — Gerencie capítulos e resumos
          </p>
        </div>
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent-blue-mid/15 blur-3xl" />
      </div>

      <BookContentEditorClient
        bookId={bookId}
        initialChapters={chaptersResult.data ?? []}
        initialSummaries={summaryResult.data ?? []}
        initialProcessingStatus={book.processing_status ?? "idle"}
      />
    </div>
  )
}
