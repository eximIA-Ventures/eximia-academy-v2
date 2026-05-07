"use client"

import { useState } from "react"
import { BookOpen, Search, Star, ChevronRight, BookMarked, Library } from "lucide-react"
import Link from "next/link"
import type { ClientBook } from "@/lib/books-queries"

function BookCover({ book, className = "" }: { book: ClientBook; className?: string }) {
  const [imgError, setImgError] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)

  if (imgError || !book.coverUrl) {
    return (
      <div
        className={`relative flex h-full w-full flex-col items-center justify-center text-center ${className}`}
        style={{ background: `linear-gradient(135deg, ${book.coverColor}, ${book.coverColor}dd)` }}
      >
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative px-3">
          <BookMarked className="mx-auto mb-2 h-5 w-5 text-white/40" />
          <p className="text-xs font-bold leading-tight text-white/90">{book.title}</p>
          <p className="mt-1 text-[10px] text-white/50">{book.author}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`}>
      {!imgLoaded && (
        <div
          className="absolute inset-0 animate-pulse opacity-40"
          style={{ backgroundColor: book.coverColor }}
        />
      )}
      <img
        src={book.coverUrl}
        alt={`Capa: ${book.title}`}
        loading="lazy"
        onError={() => setImgError(true)}
        onLoad={() => setImgLoaded(true)}
        className={`h-full w-full object-cover transition-all duration-500 group-hover:scale-110 ${
          imgLoaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  )
}

function FeaturedBook({ book }: { book: ClientBook }) {
  return (
    <Link href={`/biblioteca/${book.id}`} className="block">
      <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-varzea/5 via-bg-card to-bg-card shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-elevated hover:ring-varzea/20">
        <div className="flex flex-col sm:flex-row">
          <div className="relative aspect-[2/3] w-full shrink-0 overflow-hidden sm:w-48 md:w-56">
            <BookCover book={book} />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-bg-card/80 hidden sm:block" />
          </div>

          <div className="flex flex-1 flex-col justify-between p-5 sm:p-6">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-lg bg-accent-gold/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-accent-gold ring-1 ring-accent-gold/20">
                  Destaque
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">
                  {book.category}
                </span>
              </div>

              <h3 className="text-xl font-bold leading-tight text-text-primary transition-colors group-hover:text-varzea-light md:text-2xl">
                {book.title}
              </h3>
              <p className="mt-1 text-sm text-text-secondary">{book.author}</p>

              <p className="mt-3 text-sm leading-relaxed text-text-muted line-clamp-3">
                {book.description}
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-3.5 w-3.5 ${
                        i < Math.floor(book.rating)
                          ? "fill-accent-gold text-accent-gold"
                          : i < book.rating
                            ? "fill-accent-gold/50 text-accent-gold"
                            : "text-text-muted/30"
                      }`}
                    />
                  ))}
                </div>
                {book.year > 0 && (
                  <span className="rounded-lg bg-bg-elevated/80 px-2 py-0.5 text-[10px] font-medium text-text-muted shadow-card">
                    {book.year}
                  </span>
                )}
                {book.pages > 0 && (
                  <span className="rounded-lg bg-bg-elevated/80 px-2 py-0.5 text-[10px] font-medium text-text-muted shadow-card">
                    {book.pages}p
                  </span>
                )}
              </div>

              <span className="flex items-center gap-1 text-xs font-medium text-varzea-light opacity-0 transition-opacity group-hover:opacity-100">
                Ver detalhes <ChevronRight className="h-3 w-3" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}

function CompactBookCard({ book }: { book: ClientBook }) {
  return (
    <Link href={`/biblioteca/${book.id}`} className="block">
      <div className="group relative">
        <div className="relative mx-auto aspect-[2/3] w-full overflow-hidden rounded-xl shadow-card shadow-card transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-elevated group-hover:ring-varzea/20">
          <BookCover book={book} />

          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <div className="p-3">
              <div className="flex items-center gap-0.5 mb-1.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-2.5 w-2.5 ${
                      i < Math.floor(book.rating)
                        ? "fill-accent-gold text-accent-gold"
                        : i < book.rating
                          ? "fill-accent-gold/50 text-accent-gold"
                          : "text-white/20"
                    }`}
                  />
                ))}
              </div>
              <p className="text-[11px] leading-snug text-white/70 line-clamp-2">
                {book.description}
              </p>
            </div>
          </div>

          <div className="absolute left-0 top-0 h-full w-[3px] bg-gradient-to-b from-white/20 via-white/5 to-white/10" />
        </div>

        <div className="mt-2.5 px-0.5">
          <h3 className="text-sm font-semibold leading-tight text-text-primary transition-colors group-hover:text-varzea-light line-clamp-1">
            {book.title}
          </h3>
          <p className="mt-0.5 text-xs text-text-muted line-clamp-1">{book.author}</p>
          <div className="mt-1.5 flex items-center gap-1.5">
            {book.pages > 0 && <span className="text-[10px] text-text-muted">{book.pages}p</span>}
            {book.pages > 0 && book.year > 0 && <span className="text-text-muted/30">·</span>}
            {book.year > 0 && <span className="text-[10px] text-text-muted">{book.year}</span>}
          </div>
        </div>
      </div>
    </Link>
  )
}

function CategorySection({ category, books }: { category: string; books: ClientBook[] }) {
  if (books.length === 0) return null

  const categoryGradients: Record<string, string> = {
    Shingo: "from-accent-gold-dark to-accent-gold",
    Lean: "from-varzea-dark to-varzea",
    Excelencia: "from-cerrado-500 to-cerrado-400",
  }

  return (
    <section>
      <div className="mb-5 flex items-center gap-3">
        <div className={`h-5 w-1 rounded-full bg-gradient-to-b ${categoryGradients[category] ?? "from-varzea to-varzea-light"}`} />
        <h2 className="text-lg font-bold text-text-primary">{category}</h2>
        <span className="rounded-lg bg-bg-elevated/80 px-2 py-0.5 text-[10px] font-semibold text-text-muted shadow-card">
          {books.length} {books.length === 1 ? "livro" : "livros"}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
        {books.map((book) => (
          <CompactBookCard key={book.id} book={book} />
        ))}
      </div>
    </section>
  )
}

interface BibliotecaPageClientProps {
  books: ClientBook[]
  categories: string[]
}

export function BibliotecaPageClient({ books, categories }: BibliotecaPageClientProps) {
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState("Todos")

  const filtered = books.filter((book) => {
    const matchesCategory = activeCategory === "Todos" || book.category === activeCategory
    const matchesSearch =
      search === "" ||
      book.title.toLowerCase().includes(search.toLowerCase()) ||
      book.author.toLowerCase().includes(search.toLowerCase()) ||
      book.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
    return matchesCategory && matchesSearch
  })

  const featuredBook = filtered.find((b) => b.rating === 5)
  const remainingBooks = filtered.filter((b) => b !== featuredBook)

  const categoryNames = categories.filter((c) => c !== "Todos")
  const groupedByCategory = categoryNames.reduce(
    (acc, cat) => {
      acc[cat] = remainingBooks.filter((b) => b.category === cat)
      return acc
    },
    {} as Record<string, ClientBook[]>,
  )

  const isFiltered = search !== "" || activeCategory !== "Todos"

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-varzea/15">
              <Library className="h-4 w-4 text-varzea-light" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-varzea-light">Biblioteca</span>
          </div>
          <p className="text-sm text-text-muted">
            {books.length} livros curados sobre excelencia operacional
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar por titulo, autor ou tema..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-xl shadow-card bg-bg-surface pl-10 pr-4 text-xs text-text-primary placeholder:text-text-muted focus:border-varzea focus:outline-none focus:ring-1 focus:ring-varzea"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
              activeCategory === cat
                ? "bg-varzea/15 text-varzea-light ring-1 ring-varzea/30"
                : "text-text-muted shadow-card hover:bg-bg-hover hover:text-text-secondary"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {featuredBook && !isFiltered && <FeaturedBook book={featuredBook} />}

      {isFiltered ? (
        <>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">
            {filtered.length} {filtered.length === 1 ? "resultado" : "resultados"}
          </p>
          <div className="grid grid-cols-3 gap-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
            {filtered.map((book) => (
              <CompactBookCard key={book.id} book={book} />
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-10">
          {categoryNames.map((cat) => (
            <CategorySection key={cat} category={cat} books={groupedByCategory[cat] ?? []} />
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-varzea/5 via-bg-card to-bg-card py-16 shadow-card">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-varzea/10">
            <BookOpen className="h-8 w-8 text-varzea-light/60" />
          </div>
          <p className="mt-4 text-base font-semibold text-text-primary">Nenhum livro encontrado</p>
          <p className="mt-1 text-sm text-text-muted">Tente ajustar sua busca ou filtro.</p>
        </div>
      )}
    </div>
  )
}
