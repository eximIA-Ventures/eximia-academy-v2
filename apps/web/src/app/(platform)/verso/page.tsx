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
    <div className="-m-6 space-y-6">
      <section className="relative flex min-h-[280px] items-end overflow-hidden bg-bg-app px-6 pb-8 pt-16 sm:px-8 md:px-10">
        <div
          className="absolute inset-y-0 right-0 w-[70%] bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=1200&q=80')" }}
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
            Perspectivas
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-text-primary md:text-4xl">
            Verso
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-text-secondary md:text-base">
            Não o que fazer, mas como pensar sobre o que fazer. Artigos de fundo sobre negócios, tecnologia e inteligência artificial.
          </p>
        </div>
      </section>

      <div className="px-6">
        <VersoPageClient posts={posts} categories={categories} />
      </div>
    </div>
  )
}
