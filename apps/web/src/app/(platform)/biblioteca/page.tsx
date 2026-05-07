import { createClient } from "@/lib/supabase/server"
import { getBooks, getCategories, toClientBook } from "@/lib/books-queries"
import { redirect } from "next/navigation"
import { BibliotecaPageClient } from "@/components/biblioteca/biblioteca-page-client"

export default async function BibliotecaPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return redirect("/login")

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()

  if (!profile) return redirect("/login")

  const [booksResult, categories] = await Promise.all([
    getBooks(supabase),
    getCategories(supabase),
  ])

  const books = (booksResult.data ?? []).map((db) => toClientBook(db))

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative flex min-h-[240px] items-end overflow-hidden rounded-2xl shadow-card" style={{ background: "#1a1a1a" }}>
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=1200&q=80')" }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(90deg, #1a1a1a 0%, rgba(26,26,26,0.85) 35%, rgba(26,26,26,0.2) 70%, transparent 100%)",
          }}
        />
        <div className="relative z-10 w-full px-8 pb-7">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-varzea">
            Acervo Curado
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white md:text-4xl">
            Biblioteca
          </h1>
          <p className="mt-3 text-sm text-white/60 leading-relaxed max-w-lg md:text-base">
            Acervo curado de livros essenciais sobre excelência operacional, Lean e o Modelo Shingo.
          </p>
        </div>
      </section>

      <div>
        <BibliotecaPageClient books={books} categories={categories} />
      </div>
    </div>
  )
}
