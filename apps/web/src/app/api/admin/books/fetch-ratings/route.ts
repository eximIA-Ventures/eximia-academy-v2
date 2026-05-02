import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

async function requireManager(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { user: null, profile: null }

  const { data: profile } = await supabase
    .from("users")
    .select("id, role, tenant_id")
    .eq("id", user.id)
    .single()

  if (!profile?.role || !["admin", "super_admin"].includes(profile.role))
    return { user, profile: null }

  return { user, profile }
}

interface GoogleBooksResponse {
  totalItems: number
  items?: Array<{
    volumeInfo: {
      averageRating?: number
    }
  }>
}

async function fetchGoogleRating(title: string, author: string): Promise<number | null> {
  const q = `${title} inauthor:${author}`
  const url = new URL("https://www.googleapis.com/books/v1/volumes")
  url.searchParams.set("q", q)
  url.searchParams.set("maxResults", "3")
  url.searchParams.set("printType", "books")

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(5000),
  })

  if (!res.ok) return null

  const data: GoogleBooksResponse = await res.json()

  for (const item of data.items ?? []) {
    if (item.volumeInfo.averageRating) {
      return item.volumeInfo.averageRating
    }
  }

  return null
}

export async function POST() {
  const supabase = await createClient()
  const { user, profile } = await requireManager(supabase)

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // Fetch all books with rating 0 for this tenant
  const { data: books, error } = await supabase
    .from("books")
    .select("id, title, author, rating")
    .eq("tenant_id", profile.tenant_id)
    .eq("rating", 0)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!books || books.length === 0) {
    return NextResponse.json({ updated: 0, total: 0, message: "Nenhum livro com nota 0 encontrado" })
  }

  let updated = 0

  // Process sequentially to avoid Google API rate limits
  for (const book of books) {
    try {
      const rating = await fetchGoogleRating(book.title, book.author)
      if (rating && rating > 0 && rating <= 5) {
        const { error: updateError } = await supabase
          .from("books")
          .update({ rating, updated_at: new Date().toISOString() })
          .eq("id", book.id)
          .eq("tenant_id", profile.tenant_id)

        if (!updateError) updated++
      }
    } catch {
      // Skip books that fail — don't block the batch
      continue
    }
  }

  return NextResponse.json({
    updated,
    total: books.length,
    message: `${updated} de ${books.length} livros atualizados`,
  })
}
