import { PageHeader } from "@/components/layout/page-header"
import { getAuthProfile } from "@/lib/auth"
import { BookOpen, Library, Star } from "lucide-react"
import { redirect } from "next/navigation"
import { BibliotecaManagementClient } from "./_components/biblioteca-management-client"

export default async function AdminBibliotecaPage() {
  const { user, profile, supabase } = await getAuthProfile()

  if (!user || !profile) return redirect("/login")
  if (!["admin", "super_admin"].includes(profile.role)) return redirect("/dashboard")

  const { data: books } = await supabase
    .from("books")
    .select("*")
    .eq("tenant_id", profile.tenant_id)
    .order("title")

  const allBooks = books ?? []

  const { count: totalCount } = await supabase
    .from("books")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", profile.tenant_id)

  const { count: chapterCount } = await supabase
    .from("book_chapters")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", profile.tenant_id)
    .eq("content_type", "chapter")

  const avgRating =
    allBooks.length > 0
      ? (allBooks.reduce((sum, b) => sum + (b.rating ?? 0), 0) / allBooks.length).toFixed(1)
      : "0"

  const stats = [
    {
      icon: Library,
      title: "Livros",
      value: String(totalCount ?? 0),
      description: "Total na biblioteca",
      color: "cerrado-600",
    },
    {
      icon: BookOpen,
      title: "Capítulos",
      value: String(chapterCount ?? 0),
      description: "Conteúdos cadastrados",
      color: "accent-gold",
    },
    {
      icon: Star,
      title: "Avaliação média",
      value: avgRating,
      description: "Nota dos livros",
      color: "varzea",
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        section="Administração"
        title="Biblioteca"
        description="Gerencie livros, capítulos e resumos da biblioteca."
        accent="teal"
        backgroundImage="https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=1200&q=80"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.title}
              className="flex items-center gap-4 rounded-2xl bg-bg-card p-4 shadow-card"
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-${stat.color}/15`}
              >
                <Icon size={20} className={`text-${stat.color}`} />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">{stat.description}</p>
                <p className="text-xl font-bold text-text-primary">{stat.value}</p>
              </div>
            </div>
          )
        })}
      </div>

      <BibliotecaManagementClient initialBooks={allBooks} />
    </div>
  )
}
