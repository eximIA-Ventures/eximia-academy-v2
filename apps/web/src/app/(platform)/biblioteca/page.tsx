import { createClient } from "@/lib/supabase/server"
import { getBooks, getCategories, toClientBook } from "@/lib/books-queries"
import { tenantRedirect } from "@/lib/tenant-nav"
import { redirect } from "next/navigation"
import { BibliotecaPageClient } from "@/components/biblioteca/biblioteca-page-client"

export default async function BibliotecaPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return tenantRedirect("/login")

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()

  if (!profile) return tenantRedirect("/login")

  const [booksResult, categories] = await Promise.all([
    getBooks(supabase),
    getCategories(supabase),
  ])

  const books = (booksResult.data ?? []).map((db) => toClientBook(db))

  return (
    <div className="-m-6 space-y-6">
      {/* Hero */}
      <section className="relative flex min-h-[280px] items-end overflow-hidden bg-bg-app px-6 pb-8 pt-16 sm:px-8 md:px-10">
        <div
          className="absolute inset-y-0 right-0 w-[70%] bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=1200&q=80')" }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(90deg, rgba(15,15,15,0.97) 0%, rgba(15,15,15,0.85) 35%, rgba(15,15,15,0.3) 65%, transparent 100%)",
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-bg-app to-transparent" />
        <div className="relative z-10 w-full">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-teal">
            Acervo Curado
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-text-primary md:text-4xl">
            Biblioteca
          </h1>
          <p className="mt-3 text-sm text-text-secondary leading-relaxed max-w-lg md:text-base">
            Acervo curado de livros essenciais sobre excelência operacional, Lean e o Modelo Shingo.
          </p>
        </div>
      </section>

      <div className="px-6">
        <BibliotecaPageClient books={books} categories={categories} />
      </div>
    </div>
  )
}
