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

interface NormalizedResult {
  sourceId: string
  source: "google" | "openlibrary" | "isbndb"
  title: string
  author: string
  description: string | null
  coverUrl: string | null
  year: number | null
  pages: number | null
  categories: string[]
  rating: number | null
}

type SearchMode = "title" | "author"

// --- Google Books ---

interface GoogleBooksVolume {
  id: string
  volumeInfo: {
    title?: string
    authors?: string[]
    description?: string
    publishedDate?: string
    pageCount?: number
    categories?: string[]
    averageRating?: number
    imageLinks?: {
      thumbnail?: string
      smallThumbnail?: string
    }
  }
}

interface GoogleBooksResponse {
  totalItems: number
  items?: GoogleBooksVolume[]
}

async function searchGoogleBooks(query: string, mode: SearchMode): Promise<NormalizedResult[]> {
  const googleUrl = new URL("https://www.googleapis.com/books/v1/volumes")
  const q = mode === "author" ? `inauthor:${query}` : query
  googleUrl.searchParams.set("q", q)
  googleUrl.searchParams.set("maxResults", "10")
  googleUrl.searchParams.set("printType", "books")

  const res = await fetch(googleUrl.toString(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  })

  if (!res.ok) return []

  const data: GoogleBooksResponse = await res.json()

  return (data.items ?? []).map((item) => {
    const info = item.volumeInfo
    const year = info.publishedDate ? Number.parseInt(info.publishedDate.substring(0, 4)) : null

    let coverUrl = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? null
    if (coverUrl) {
      coverUrl = coverUrl.replace("http://", "https://")
    }

    return {
      sourceId: item.id,
      source: "google" as const,
      title: info.title ?? "Sem titulo",
      author: info.authors?.join(", ") ?? "Autor desconhecido",
      description: info.description ?? null,
      coverUrl,
      year: year && !Number.isNaN(year) ? year : null,
      pages: info.pageCount ?? null,
      categories: info.categories ?? [],
      rating: info.averageRating ?? null,
    }
  })
}

// --- Open Library ---

interface OpenLibraryDoc {
  key: string
  title?: string
  author_name?: string[]
  first_publish_year?: number
  number_of_pages_median?: number
  subject?: string[]
  cover_i?: number
  first_sentence?: string[]
}

interface OpenLibraryResponse {
  numFound: number
  docs?: OpenLibraryDoc[]
}

async function searchOpenLibrary(query: string, mode: SearchMode): Promise<NormalizedResult[]> {
  const olUrl = new URL("https://openlibrary.org/search.json")
  if (mode === "author") {
    olUrl.searchParams.set("author", query)
  } else {
    olUrl.searchParams.set("q", query)
  }
  olUrl.searchParams.set("limit", "8")
  olUrl.searchParams.set("lang", "por")
  olUrl.searchParams.set("fields", "key,title,author_name,first_publish_year,number_of_pages_median,subject,cover_i,first_sentence")

  const res = await fetch(olUrl.toString(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  })

  if (!res.ok) return []

  const data: OpenLibraryResponse = await res.json()

  return (data.docs ?? []).map((doc) => {
    const coverUrl = doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
      : null

    return {
      sourceId: doc.key,
      source: "openlibrary" as const,
      title: doc.title ?? "Sem titulo",
      author: doc.author_name?.join(", ") ?? "Autor desconhecido",
      description: doc.first_sentence?.join(" ") ?? null,
      coverUrl,
      year: doc.first_publish_year ?? null,
      pages: doc.number_of_pages_median ?? null,
      categories: (doc.subject ?? []).slice(0, 5),
      rating: null,
    }
  })
}

// --- ISBNdb ---

interface ISBNdbBook {
  title?: string
  title_long?: string
  isbn13?: string
  isbn?: string
  authors?: string[]
  synopsis?: string
  overview?: string
  subjects?: string[]
  pages?: number
  image?: string
  date_published?: string
  publisher?: string
}

interface ISBNdbResponse {
  total: number
  books?: ISBNdbBook[]
}

async function searchISBNdb(query: string, mode: SearchMode): Promise<NormalizedResult[]> {
  const apiKey = process.env.ISBNDB_API_KEY
  if (!apiKey) return []

  const encoded = encodeURIComponent(query)
  const endpoint = mode === "author"
    ? `https://api2.isbndb.com/author/${encoded}?pageSize=8`
    : `https://api2.isbndb.com/books/${encoded}?pageSize=8`

  const res = await fetch(endpoint, {
    headers: {
      Authorization: apiKey,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(8000),
  })

  if (!res.ok) return []

  const data = await res.json()

  // Author endpoint returns { books: [...] } nested differently
  const books: ISBNdbBook[] = data.books ?? []

  return books.map((book) => {
    const year = book.date_published
      ? Number.parseInt(book.date_published.substring(0, 4))
      : null

    let coverUrl = book.image ?? null
    if (coverUrl) {
      coverUrl = coverUrl.replace("http://", "https://")
    }

    return {
      sourceId: book.isbn13 ?? book.isbn ?? book.title ?? "",
      source: "isbndb" as const,
      title: book.title_long ?? book.title ?? "Sem titulo",
      author: book.authors?.join(", ") ?? "Autor desconhecido",
      description: book.synopsis ?? book.overview ?? null,
      coverUrl,
      year: year && !Number.isNaN(year) ? year : null,
      pages: book.pages ?? null,
      categories: book.subjects ?? [],
      rating: null,
    }
  })
}

// --- Dedup ---

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
}

const SOURCE_PRIORITY: Record<string, number> = { isbndb: 3, google: 2, openlibrary: 1 }

function dedup(results: NormalizedResult[]): NormalizedResult[] {
  const seen = new Map<string, NormalizedResult>()

  for (const r of results) {
    const key = `${normalize(r.title)}_${normalize(r.author).substring(0, 15)}`

    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, r)
    } else {
      const newPriority = SOURCE_PRIORITY[r.source] ?? 0
      const existingPriority = SOURCE_PRIORITY[existing.source] ?? 0
      if (newPriority > existingPriority) {
        seen.set(key, r)
      }
    }
  }

  return Array.from(seen.values())
}

// --- Route ---

export async function GET(request: Request) {
  const supabase = await createClient()
  const { user, profile } = await requireManager(supabase)

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")
  const mode = (searchParams.get("mode") ?? "title") as SearchMode

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ error: "Query must be at least 2 characters" }, { status: 400 })
  }

  const trimmed = query.trim()

  const [googleResults, olResults, isbndbResults] = await Promise.allSettled([
    searchGoogleBooks(trimmed, mode),
    searchOpenLibrary(trimmed, mode),
    searchISBNdb(trimmed, mode),
  ])

  const google = googleResults.status === "fulfilled" ? googleResults.value : []
  const ol = olResults.status === "fulfilled" ? olResults.value : []
  const isbndb = isbndbResults.status === "fulfilled" ? isbndbResults.value : []

  // Merge all sources, dedup (ISBNdb > Google > OpenLibrary priority)
  const merged = dedup([...isbndb, ...google, ...ol])

  return NextResponse.json({ results: merged })
}
