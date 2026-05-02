"use client"

import { useState } from "react"
import { Badge } from "@eximia/ui"
import { Clock, Search, FileEdit, Tag } from "lucide-react"
import Link from "next/link"
import type { ClientVersoPost } from "@/lib/verso-queries"

function PostCard({ post }: { post: ClientVersoPost }) {
  const isDraft = post.status === "draft"
  const dateStr = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })
    : new Date(post.createdAt).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })

  return (
    <Link href={`/verso/${post.slug}`} className="block">
      <article className="group relative overflow-hidden rounded-2xl bg-bg-card ring-1 ring-white/[0.06] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.2)]">
        {/* Cover */}
        <div className="relative aspect-[16/9] w-full overflow-hidden">
          {post.coverUrl ? (
            <img
              src={post.coverUrl}
              alt={post.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center"
              style={{ backgroundColor: post.coverColor }}
            >
              <FileEdit className="h-10 w-10 text-white/20" />
            </div>
          )}
          {isDraft && (
            <div className="absolute left-3 top-3">
              <Badge variant="draft" className="border-accent-gold/50 bg-bg-app/80 text-accent-gold backdrop-blur-sm">
                Rascunho
              </Badge>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-bg-card to-transparent" />
        </div>

        {/* Content */}
        <div className="p-5">
          <div className="mb-2 flex items-center gap-3 text-xs text-text-muted">
            <span className="font-medium uppercase tracking-wider text-accent-teal">{post.category}</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {post.readingTime} min
            </span>
            <span>{dateStr}</span>
          </div>
          <h3 className="text-lg font-semibold leading-snug text-text-primary line-clamp-2 group-hover:text-accent-teal transition-colors">
            {post.title}
          </h3>
          {post.excerpt && (
            <p className="mt-2 text-sm leading-relaxed text-text-secondary line-clamp-3">
              {post.excerpt}
            </p>
          )}
          {post.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {post.tags.slice(0, 4).map((tag) => (
                <span key={tag} className="inline-flex items-center gap-0.5 rounded-full bg-bg-surface px-2 py-0.5 text-[10px] text-text-muted">
                  <Tag className="h-2.5 w-2.5" />
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </article>
    </Link>
  )
}

function FeaturedPost({ post }: { post: ClientVersoPost }) {
  const isDraft = post.status === "draft"
  const dateStr = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })
    : new Date(post.createdAt).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })

  return (
    <Link href={`/verso/${post.slug}`} className="block">
      <article className="group relative overflow-hidden rounded-2xl bg-bg-card ring-1 ring-white/[0.06] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.2)]">
        <div className="flex flex-col md:flex-row">
          {/* Cover */}
          <div className="relative aspect-[16/9] w-full overflow-hidden md:aspect-auto md:w-1/2">
            {post.coverUrl ? (
              <img
                src={post.coverUrl}
                alt={post.title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div
                className="flex h-full min-h-[200px] w-full items-center justify-center"
                style={{ backgroundColor: post.coverColor }}
              >
                <FileEdit className="h-16 w-16 text-white/20" />
              </div>
            )}
            {isDraft && (
              <div className="absolute left-3 top-3">
                <Badge variant="draft" className="border-accent-gold/50 bg-bg-app/80 text-accent-gold backdrop-blur-sm">
                  Rascunho
                </Badge>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex flex-1 flex-col justify-center p-6 md:p-8">
            <div className="mb-3 flex items-center gap-3 text-xs text-text-muted">
              <span className="font-medium uppercase tracking-wider text-accent-teal">{post.category}</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {post.readingTime} min de leitura
              </span>
            </div>
            <h2 className="text-2xl font-bold leading-tight text-text-primary group-hover:text-accent-teal transition-colors md:text-3xl">
              {post.title}
            </h2>
            {post.excerpt && (
              <p className="mt-3 text-sm leading-relaxed text-text-secondary line-clamp-3 md:text-base">
                {post.excerpt}
              </p>
            )}
            <div className="mt-4 flex items-center gap-3 text-xs text-text-muted">
              <span>{post.author}</span>
              <span>·</span>
              <span>{dateStr}</span>
            </div>
          </div>
        </div>
      </article>
    </Link>
  )
}

export function VersoPageClient({
  posts,
  categories,
}: {
  posts: ClientVersoPost[]
  categories: string[]
}) {
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState("Todos")

  const filtered = posts.filter((p) => {
    const matchesSearch =
      !search ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.excerpt.toLowerCase().includes(search.toLowerCase()) ||
      p.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
    const matchesCategory = activeCategory === "Todos" || p.category === activeCategory
    return matchesSearch && matchesCategory
  })

  const featured = filtered[0]
  const rest = filtered.slice(1)

  if (posts.length === 0) {
    return (
      <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-border-subtle">
        <div className="text-center">
          <FileEdit className="mx-auto mb-3 h-10 w-10 text-text-muted" />
          <p className="text-sm text-text-muted">Nenhum artigo publicado ainda.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Search + Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar artigos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border-0 bg-bg-surface py-2.5 pl-9 pr-4 text-sm text-text-primary ring-1 ring-white/[0.06] placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-teal/50"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                activeCategory === cat
                  ? "bg-accent-teal/10 text-accent-teal ring-1 ring-accent-teal/30"
                  : "text-text-muted hover:bg-bg-hover hover:text-text-secondary"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Featured */}
      {featured && <FeaturedPost post={featured} />}

      {/* Grid */}
      {rest.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}
