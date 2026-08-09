import { canOpenAdminRoute } from "@/lib/admin-route-access"
import { getAuthProfile, getDbClient } from "@/lib/auth"
import { getBookById, getBookChapters } from "@/lib/books-queries"
import { redirect } from "next/navigation"
import { BookContentEditorClient } from "./_components/book-content-editor-client"

export default async function AdminBookContentPage({
  params,
}: {
  params: Promise<{ bookId: string }>
}) {
  const { user, profile, roles } = await getAuthProfile()

  if (!user || !profile) return redirect("/login")
  // Guard por CHAPÉU real (regra dura 3): mesmo eixo do middleware. Conjunto
  // permitido INALTERADO.
  if (!canOpenAdminRoute("/admin/biblioteca", roles)) return redirect("/dashboard")

  // Mesmo motivo da listagem (`../../page.tsx`): sob RLS o admin global não
  // enxerga livro nenhum, e a página o mandava de volta à lista como se o livro
  // não existisse. Para quem tem tenant próprio o client é o mesmo de antes.
  const supabase = await getDbClient()

  const { bookId } = await params
  const { data: book } = await getBookById(supabase, bookId)

  if (!book) return redirect("/admin/biblioteca")

  const [chaptersResult, summaryResult] = await Promise.all([
    getBookChapters(supabase, bookId, "chapter"),
    getBookChapters(supabase, bookId, "summary"),
  ])

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-bg-card via-bg-surface to-cerrado-800 p-6 md:p-8">
        <div className="relative z-10">
          <p className="text-xs font-medium uppercase tracking-widest text-cerrado-400">
            Conteúdo do livro
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
            {book.title}
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            {book.author} — Gerencie capítulos e resumos
          </p>
        </div>
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-cerrado-600/15 blur-3xl" />
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
