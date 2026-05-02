import type { SupabaseClient } from "@supabase/supabase-js"

export interface DbBook {
  id: string
  tenant_id: string
  created_by: string
  title: string
  author: string
  category: string
  description: string | null
  cover_url: string | null
  cover_color: string | null
  rating: number
  year: number | null
  pages: number | null
  tags: string[]
  synopsis: string | null
  author_bio: string | null
  file_url: string | null
  processing_status: string
  processing_error: string | null
  created_at: string
  updated_at: string
}

export interface DbBookChapter {
  id: string
  book_id: string
  tenant_id: string
  title: string
  content: string
  content_type: "chapter" | "summary"
  chapter_order: number
  created_at: string
  updated_at: string
}

export async function getBooks(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("books")
    .select("*")
    .order("title")

  return { data: data as DbBook[] | null, error }
}

export async function getBookById(supabase: SupabaseClient, bookId: string) {
  const { data, error } = await supabase
    .from("books")
    .select("*")
    .eq("id", bookId)
    .single()

  return { data: data as DbBook | null, error }
}

export async function getBookChapters(
  supabase: SupabaseClient,
  bookId: string,
  contentType: "chapter" | "summary",
) {
  const { data, error } = await supabase
    .from("book_chapters")
    .select("*")
    .eq("book_id", bookId)
    .eq("content_type", contentType)
    .order("chapter_order")

  return { data: data as DbBookChapter[] | null, error }
}

/** Client-friendly book type used by UI components */
export interface ClientBook {
  id: string
  title: string
  author: string
  category: string
  description: string
  coverUrl: string
  coverColor: string
  rating: number
  year: number
  pages: number
  tags: string[]
  synopsis: string
  authorBio: string
  processingStatus: string
  hasPdf: boolean
  chapters: ClientBookChapter[]
  summaryChapters: ClientBookChapter[]
}

export interface ClientBookChapter {
  id: string
  title: string
  content: string
}

export function toClientBook(
  db: DbBook,
  chapters: DbBookChapter[] = [],
  summaryChapters: DbBookChapter[] = [],
): ClientBook {
  return {
    id: db.id,
    title: db.title,
    author: db.author,
    category: db.category,
    description: db.description ?? "",
    coverUrl: db.cover_url ?? "",
    coverColor: db.cover_color ?? "#374151",
    rating: db.rating,
    year: db.year ?? 0,
    pages: db.pages ?? 0,
    tags: db.tags ?? [],
    synopsis: db.synopsis ?? "",
    authorBio: db.author_bio ?? "",
    processingStatus: db.processing_status,
    hasPdf: db.processing_status !== "idle",
    chapters: chapters.map((c) => ({ id: c.id, title: c.title, content: c.content })),
    summaryChapters: summaryChapters.map((c) => ({ id: c.id, title: c.title, content: c.content })),
  }
}

export async function getCategories(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("books")
    .select("category")

  if (!data) return ["Todos"]
  const unique = [...new Set(data.map((d: { category: string }) => d.category))].sort()
  return ["Todos", ...unique]
}

export async function getBookWithContent(supabase: SupabaseClient, bookId: string) {
  const [bookResult, chaptersResult, summaryResult] = await Promise.all([
    getBookById(supabase, bookId),
    getBookChapters(supabase, bookId, "chapter"),
    getBookChapters(supabase, bookId, "summary"),
  ])

  return {
    book: bookResult.data,
    chapters: chaptersResult.data ?? [],
    summaryChapters: summaryResult.data ?? [],
    error: bookResult.error || chaptersResult.error || summaryResult.error,
  }
}
