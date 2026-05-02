import type { SupabaseClient } from "@supabase/supabase-js"

export interface DbVersoPost {
  id: string
  tenant_id: string
  created_by: string | null
  title: string
  slug: string
  excerpt: string | null
  content: string
  author: string
  category: string
  cover_url: string | null
  cover_color: string | null
  tags: string[]
  reading_time: number
  status: "draft" | "published" | "archived"
  published_at: string | null
  sources: { title: string; url: string }[]
  created_at: string
  updated_at: string
}

export interface ClientVersoPost {
  id: string
  title: string
  slug: string
  excerpt: string
  content: string
  author: string
  category: string
  coverUrl: string
  coverColor: string
  tags: string[]
  readingTime: number
  status: "draft" | "published" | "archived"
  publishedAt: string | null
  sources: { title: string; url: string }[]
  createdAt: string
}

export function toClientPost(db: DbVersoPost): ClientVersoPost {
  return {
    id: db.id,
    title: db.title,
    slug: db.slug,
    excerpt: db.excerpt ?? "",
    content: db.content,
    author: db.author,
    category: db.category,
    coverUrl: db.cover_url ?? "",
    coverColor: db.cover_color ?? "#0d9488",
    tags: db.tags ?? [],
    readingTime: db.reading_time,
    status: db.status,
    publishedAt: db.published_at,
    sources: (db.sources as { title: string; url: string }[]) ?? [],
    createdAt: db.created_at,
  }
}

export async function getVersoPosts(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("verso_posts")
    .select("*")
    .order("created_at", { ascending: false })

  return { data: data as DbVersoPost[] | null, error }
}

export async function getPublishedVersoPosts(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("verso_posts")
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false })

  return { data: data as DbVersoPost[] | null, error }
}

export async function getVersoPostBySlug(supabase: SupabaseClient, slug: string) {
  const { data, error } = await supabase
    .from("verso_posts")
    .select("*")
    .eq("slug", slug)
    .single()

  return { data: data as DbVersoPost | null, error }
}

export async function getVersoPostById(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("verso_posts")
    .select("*")
    .eq("id", id)
    .single()

  return { data: data as DbVersoPost | null, error }
}

export async function getVersoCategories(supabase: SupabaseClient) {
  const { data } = await supabase.from("verso_posts").select("category")
  if (!data) return ["Todos"]
  const unique = [...new Set(data.map((d: { category: string }) => d.category))].sort()
  return ["Todos", ...unique]
}
