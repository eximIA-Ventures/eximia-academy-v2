import { createClient } from "@/lib/supabase/server"
import { getVersoPosts, getVersoCategories, toClientPost } from "@/lib/verso-queries"
import { redirect } from "next/navigation"
import { VersoPageClient } from "@/components/verso/verso-page-client"

export default async function VersoPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return redirect("/login")

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()
  if (!profile) return redirect("/login")

  const [postsResult, categories] = await Promise.all([
    getVersoPosts(supabase),
    getVersoCategories(supabase),
  ])

  const posts = (postsResult.data ?? []).map((db) => toClientPost(db))

  return (
    <div className="space-y-6">
      <section className="relative flex min-h-[240px] items-end overflow-hidden rounded-2xl shadow-card" style={{ background: "#1a1a1a" }}>
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=1200&q=80')" }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(90deg, #1a1a1a 0%, rgba(26,26,26,0.85) 35%, rgba(26,26,26,0.2) 70%, transparent 100%)",
          }}
        />
        <div className="relative z-10 w-full px-8 pb-7">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-varzea">
            Perspectivas
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white md:text-4xl">
            Verso
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/60 md:text-base">
            Não o que fazer, mas como pensar sobre o que fazer. Artigos de fundo sobre negócios, tecnologia e inteligência artificial.
          </p>
        </div>
      </section>

      <div>
        <VersoPageClient posts={posts} categories={categories} />
      </div>
    </div>
  )
}
