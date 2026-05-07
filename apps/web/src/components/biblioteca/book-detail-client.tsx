"use client"

import { useState } from "react"
import { Badge } from "@eximia/ui"
import { ArrowLeft, BookOpen, FileText, Star, Clock, Hash, BookMarked, Quote, Loader2 } from "lucide-react"
import Link from "next/link"
import type { ClientBook } from "@/lib/books-queries"

function DetailCover({ book }: { book: ClientBook }) {
  const [imgError, setImgError] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)

  if (imgError || !book.coverUrl) {
    return (
      <div
        className="relative flex aspect-[2/3] w-full flex-col items-center justify-center text-center"
        style={{ background: `linear-gradient(135deg, ${book.coverColor}, ${book.coverColor}dd)` }}
      >
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative px-6">
          <BookMarked className="mx-auto mb-3 h-8 w-8 text-white/40" />
          <p className="text-lg font-bold leading-tight text-white/90">{book.title}</p>
          <p className="mt-2 text-sm text-white/50">{book.author}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative aspect-[2/3] w-full overflow-hidden">
      {!imgLoaded && (
        <div
          className="absolute inset-0 animate-pulse opacity-40"
          style={{ backgroundColor: book.coverColor }}
        />
      )}
      <img
        src={book.coverUrl}
        alt={`Capa: ${book.title}`}
        onError={() => setImgError(true)}
        onLoad={() => setImgLoaded(true)}
        className={`h-full w-full object-cover transition-opacity ${
          imgLoaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  )
}

function RelatedBookCard({ book }: { book: ClientBook }) {
  const [imgError, setImgError] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)

  return (
    <Link href={`/biblioteca/${book.id}`} className="block">
      <div className="group flex gap-3">
        <div className="relative aspect-[2/3] w-14 shrink-0 overflow-hidden rounded-sm shadow-card">
          {imgError || !book.coverUrl ? (
            <div
              className="flex h-full w-full items-center justify-center"
              style={{ backgroundColor: book.coverColor }}
            >
              <BookMarked className="h-4 w-4 text-white/40" />
            </div>
          ) : (
            <>
              {!imgLoaded && (
                <div
                  className="absolute inset-0 animate-pulse opacity-40"
                  style={{ backgroundColor: book.coverColor }}
                />
              )}
              <img
                src={book.coverUrl}
                alt={book.title}
                loading="lazy"
                onError={() => setImgError(true)}
                onLoad={() => setImgLoaded(true)}
                className={`h-full w-full object-cover ${imgLoaded ? "opacity-100" : "opacity-0"}`}
              />
            </>
          )}
          <div className="absolute left-0 top-0 h-full w-[2px] bg-gradient-to-b from-white/20 via-white/5 to-white/10" />
        </div>
        <div className="flex flex-col justify-center">
          <p className="text-sm font-semibold leading-tight text-text-primary transition-colors group-hover:text-cerrado-400 line-clamp-1">
            {book.title}
          </p>
          <p className="mt-0.5 text-xs text-text-muted">{book.author}</p>
          <div className="mt-1 flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`h-2.5 w-2.5 ${
                  i < Math.floor(book.rating)
                    ? "fill-accent-gold text-accent-gold"
                    : i < book.rating
                      ? "fill-accent-gold/50 text-accent-gold"
                      : "text-text-muted/30"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </Link>
  )
}

interface BookDetailClientProps {
  book: ClientBook
  relatedBooks: ClientBook[]
}

export function BookDetailClient({ book, relatedBooks }: BookDetailClientProps) {
  const readingTime = book.pages > 0 ? Math.ceil(book.pages * 1.5 / 60) : 0
  const hasChapters = book.chapters.length > 0
  const hasSummary = book.summaryChapters.length > 0
  const hasPdf = book.hasPdf
  const isProcessing = book.processingStatus === "processing"

  return (
    <div className="space-y-10">
      {/* Back link */}
      <Link
        href="/biblioteca"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted transition-colors hover:text-text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Biblioteca
      </Link>

      {/* Hero section */}
      <div className="relative overflow-hidden rounded-lg bg-bg-card">
        <div
          className="absolute -right-20 -top-20 h-80 w-80 rounded-full opacity-[0.07] blur-3xl"
          style={{ backgroundColor: book.coverColor }}
        />
        <div
          className="absolute -bottom-10 -left-10 h-60 w-60 rounded-full opacity-[0.05] blur-3xl"
          style={{ backgroundColor: book.coverColor }}
        />

        <div className="relative flex flex-col gap-8 p-6 sm:flex-row sm:p-8">
          {/* Cover */}
          <div className="mx-auto w-44 shrink-0 sm:mx-0 sm:w-48 md:w-56">
            <div className="relative overflow-hidden rounded-sm shadow-elevated">
              <DetailCover book={book} />
              <div className="absolute left-0 top-0 h-full w-[3px] bg-gradient-to-b from-white/25 via-white/5 to-white/15" />
            </div>
          </div>

          {/* Info */}
          <div className="flex flex-1 flex-col justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Badge variant="info" className="text-[10px] uppercase tracking-wider">
                  {book.category}
                </Badge>
              </div>

              <h1 className="text-2xl font-bold leading-tight text-text-primary md:text-3xl">
                {book.title}
              </h1>
              <p className="mt-1.5 text-base text-text-secondary">{book.author}</p>

              {/* Rating */}
              <div className="mt-4 flex items-center gap-3">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${
                        i < Math.floor(book.rating)
                          ? "fill-accent-gold text-accent-gold"
                          : i < book.rating
                            ? "fill-accent-gold/50 text-accent-gold"
                            : "text-text-muted/30"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-sm font-medium text-accent-gold">
                  {book.rating % 1 === 0 ? `${book.rating}.0` : book.rating.toFixed(1)}
                </span>
              </div>

              {/* Meta pills */}
              <div className="mt-4 flex flex-wrap gap-2">
                {book.pages > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-bg-surface px-3 py-1 text-xs text-text-secondary">
                    <Hash className="h-3 w-3 text-text-muted" />
                    {book.pages} páginas
                  </span>
                )}
                {readingTime > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-bg-surface px-3 py-1 text-xs text-text-secondary">
                    <Clock className="h-3 w-3 text-text-muted" />
                    ~{readingTime}h de leitura
                  </span>
                )}
                {book.year > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-bg-surface px-3 py-1 text-xs text-text-secondary">
                    <BookOpen className="h-3 w-3 text-text-muted" />
                    {book.year}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {(hasPdf || hasChapters) && (
                <Link
                  href={`/biblioteca/${book.id}/ler`}
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-gradient-to-r from-cerrado-600 to-cerrado-400 px-5 py-2 text-sm font-medium tracking-wide text-white shadow-sm transition-all duration-200 hover:shadow-md hover:brightness-110 active:scale-[0.97]"
                >
                  <BookOpen className="h-4 w-4" />
                  Ler Livro
                </Link>
              )}
              {hasSummary && (
                <Link
                  href={`/biblioteca/${book.id}/resumo`}
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md shadow-card bg-transparent px-5 py-2 text-sm font-medium tracking-wide text-text-primary transition-all duration-200 hover:border-cerrado-600/50 hover:bg-cerrado-600/10 hover:text-cerrado-400 active:scale-[0.97]"
                >
                  <FileText className="h-4 w-4" />
                  Ler Resumo
                </Link>
              )}
              {isProcessing && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-gold/10 px-3 py-1 text-xs font-medium text-accent-gold">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Processando...
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tags */}
      {book.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {book.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full shadow-card px-3 py-1 text-xs text-text-secondary transition-colors hover:border-cerrado-600/30 hover:text-cerrado-400"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Content grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_280px]">
        {/* Main content */}
        <div className="space-y-8">
          {/* Synopsis */}
          {book.synopsis && (
            <section>
              <div className="mb-4 flex items-center gap-3">
                <div className="h-5 w-1 rounded-full bg-gradient-to-b from-cerrado-600 to-cerrado-400" />
                <h2 className="text-lg font-bold text-text-primary">Sinopse</h2>
              </div>
              <div className="rounded-lg shadow-card bg-bg-surface/50 p-6">
                <p className="text-sm leading-relaxed text-text-secondary">{book.synopsis}</p>
              </div>
            </section>
          )}

          {/* Author */}
          {book.authorBio && (
            <section>
              <div className="mb-4 flex items-center gap-3">
                <div className="h-5 w-1 rounded-full bg-gradient-to-b from-accent-gold-dark to-accent-gold" />
                <h2 className="text-lg font-bold text-text-primary">Sobre o Autor</h2>
              </div>
              <div className="rounded-lg shadow-card bg-bg-surface/50 p-6">
                <div className="flex gap-4">
                  <Quote className="mt-0.5 h-5 w-5 shrink-0 text-accent-gold/40" />
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{book.author}</p>
                    <p className="mt-2 text-sm leading-relaxed text-text-secondary">{book.authorBio}</p>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          {/* Book details */}
          <div className="rounded-lg shadow-card bg-bg-surface/50 p-5">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-text-muted">Detalhes</h3>
            <dl className="divide-y  text-sm">
              {[
                { label: "Autor", value: book.author, bold: true },
                { label: "Categoria", value: book.category },
                ...(book.year > 0 ? [{ label: "Ano", value: book.year }] : []),
                ...(book.pages > 0 ? [{ label: "Paginas", value: book.pages }] : []),
                ...(readingTime > 0 ? [{ label: "Leitura", value: `~${readingTime}h` }] : []),
              ].map((item) => (
                <div key={item.label} className="flex justify-between py-2.5 first:pt-0 last:pb-0">
                  <dt className="text-text-muted">{item.label}</dt>
                  <dd className={`text-right text-text-primary ${"bold" in item && item.bold ? "font-medium" : ""}`}>{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Related books */}
          {relatedBooks.length > 0 && (
            <div className="rounded-lg shadow-card bg-bg-surface/50 p-5">
              <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-text-muted">Livros relacionados</h3>
              <div className="space-y-4">
                {relatedBooks.map((b) => (
                  <RelatedBookCard key={b.id} book={b} />
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
