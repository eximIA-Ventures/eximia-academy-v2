"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { ArrowLeft, Clock, Minus, Plus, Type, Settings, ExternalLink, Tag } from "lucide-react"
import { Badge } from "@eximia/ui"
import Link from "next/link"
import type { ClientVersoPost } from "@/lib/verso-queries"

const FONT_SIZES = [14, 16, 18, 20, 22] as const
const WORDS_PER_MINUTE = 200

function estimateReadingTime(text: string): number {
  const words = text.split(/\s+/).length
  return Math.ceil(words / WORDS_PER_MINUTE)
}

function inlineFormat(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-accent-teal underline underline-offset-2 hover:text-accent-teal-light">$1</a>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="my-6 w-full rounded-xl" />')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-text-primary">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="rounded bg-bg-elevated px-1.5 py-0.5 text-[0.85em] text-accent-blue-light">$1</code>')
}

function renderMarkdown(content: string) {
  const lines = content.split("\n")
  const elements: React.ReactNode[] = []
  let i = 0
  let listItems: string[] = []
  let listType: "ul" | "ol" | null = null
  let tableRows: string[][] = []
  let inTable = false

  function flushList() {
    if (listItems.length === 0) return
    const items = listItems.map((item, idx) => (
      <li key={idx} dangerouslySetInnerHTML={{ __html: inlineFormat(item) }} />
    ))
    if (listType === "ol") {
      elements.push(<ol key={`ol-${elements.length}`} className="my-4 list-decimal space-y-1 pl-6">{items}</ol>)
    } else {
      elements.push(<ul key={`ul-${elements.length}`} className="my-4 list-disc space-y-1 pl-6">{items}</ul>)
    }
    listItems = []
    listType = null
  }

  function flushTable() {
    if (tableRows.length < 2) return
    const header = tableRows[0]
    const body = tableRows.slice(2)
    elements.push(
      <div key={`table-${elements.length}`} className="my-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle">
              {header.map((cell, ci) => (
                <th key={ci} className="px-3 py-2 text-left font-semibold text-text-primary" dangerouslySetInnerHTML={{ __html: inlineFormat(cell.trim()) }} />
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, ri) => (
              <tr key={ri} className="border-b border-border-subtle/50">
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-2 text-text-secondary" dangerouslySetInnerHTML={{ __html: inlineFormat(cell.trim()) }} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
    tableRows = []
    inTable = false
  }

  while (i < lines.length) {
    const line = lines[i]

    // Image
    if (line.trim().startsWith("![")) {
      flushList()
      const match = line.match(/!\[([^\]]*)\]\(([^)]+)\)/)
      if (match) {
        elements.push(
          <figure key={`img-${i}`} className="my-8">
            <img src={match[2]} alt={match[1]} className="w-full rounded-xl" />
            {match[1] && <figcaption className="mt-2 text-center text-xs text-text-muted">{match[1]}</figcaption>}
          </figure>
        )
      }
      i++
      continue
    }

    // Horizontal rule
    if (line.trim() === "---") {
      flushList()
      elements.push(<hr key={`hr-${i}`} className="my-10 border-border-subtle" />)
      i++
      continue
    }

    // Table
    if (line.includes("|") && line.trim().startsWith("|")) {
      if (!inTable) {
        flushList()
        inTable = true
      }
      const cells = line.split("|").filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
      if (!/^[\s|:-]+$/.test(line)) {
        tableRows.push(cells)
      } else {
        tableRows.push(cells)
      }
      i++
      continue
    }
    if (inTable) flushTable()

    if (line.trim() === "") { flushList(); i++; continue }

    // H1
    if (line.startsWith("# ") && !line.startsWith("## ")) {
      flushList()
      elements.push(<h2 key={`h1-${i}`} className="mb-4 mt-12 text-2xl font-bold text-text-primary">{line.slice(2)}</h2>)
      i++; continue
    }
    // H4
    if (line.startsWith("#### ")) {
      flushList()
      elements.push(<h5 key={`h5-${i}`} className="mb-2 mt-6 text-sm font-bold text-text-primary">{line.slice(5)}</h5>)
      i++; continue
    }
    // H3
    if (line.startsWith("### ")) {
      flushList()
      elements.push(<h4 key={`h4-${i}`} className="mb-2 mt-8 text-base font-bold text-text-primary">{line.slice(4)}</h4>)
      i++; continue
    }
    // H2
    if (line.startsWith("## ")) {
      flushList()
      elements.push(<h3 key={`h3-${i}`} className="mb-3 mt-10 text-lg font-bold text-text-primary">{line.slice(3)}</h3>)
      i++; continue
    }

    // Blockquote
    if (line.startsWith("> ")) {
      flushList()
      elements.push(
        <blockquote key={`bq-${i}`} className="my-6 border-l-2 border-accent-gold/40 py-1 pl-4 italic text-text-secondary/80" dangerouslySetInnerHTML={{ __html: inlineFormat(line.slice(2)) }} />
      )
      i++; continue
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      if (listType !== "ol") flushList()
      listType = "ol"
      listItems.push(line.replace(/^\d+\.\s/, ""))
      i++; continue
    }

    // Unordered list
    if (line.startsWith("- ")) {
      if (listType !== "ul") flushList()
      listType = "ul"
      listItems.push(line.slice(2))
      i++; continue
    }

    // Paragraph
    flushList()
    elements.push(
      <p key={`p-${i}`} className="my-4 leading-[1.8]" dangerouslySetInnerHTML={{ __html: inlineFormat(line) }} />
    )
    i++
  }

  flushList()
  if (inTable) flushTable()
  return elements
}

export function VersoReaderClient({ post }: { post: ClientVersoPost }) {
  const [fontSizeIndex, setFontSizeIndex] = useState(1)
  const [fontFamily, setFontFamily] = useState<"sans" | "serif">("sans")
  const [showSettings, setShowSettings] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)
  const contentRef = useRef<HTMLDivElement>(null)
  const settingsRef = useRef<HTMLDivElement>(null)

  const fontSize = FONT_SIZES[fontSizeIndex]
  const readingTime = post.readingTime || estimateReadingTime(post.content)
  const isDraft = post.status === "draft"

  const dateStr = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })
    : new Date(post.createdAt).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })

  const handleScroll = useCallback(() => {
    const el = contentRef.current
    if (!el) return
    const progress = el.scrollTop / (el.scrollHeight - el.clientHeight)
    setScrollProgress(Math.min(Math.max(progress, 0), 1))
  }, [])

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    el.addEventListener("scroll", handleScroll)
    return () => el.removeEventListener("scroll", handleScroll)
  }, [handleScroll])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "+" || e.key === "=") setFontSizeIndex((v) => Math.min(v + 1, FONT_SIZES.length - 1))
      if (e.key === "-") setFontSizeIndex((v) => Math.max(v - 1, 0))
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg-app">
      {/* Progress bar */}
      <div className="h-0.5 w-full bg-bg-elevated">
        <div className="h-full bg-accent-teal transition-all duration-150" style={{ width: `${scrollProgress * 100}%` }} />
      </div>

      {/* Header */}
      <header className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/verso" className="flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text-primary">
            <ArrowLeft className="h-4 w-4" />
            Verso
          </Link>
          {isDraft && (
            <Badge variant="draft" className="border-accent-gold/50 text-accent-gold">Rascunho</Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Settings */}
          <div className="relative" ref={settingsRef}>
            <button onClick={() => setShowSettings(!showSettings)} className="rounded-lg p-2 text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary">
              <Settings className="h-4 w-4" />
            </button>
            {showSettings && (
              <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl bg-bg-card p-4 shadow-elevated ring-1 ring-white/[0.06]">
                <p className="mb-3 text-xs font-medium text-text-muted">Tamanho da fonte</p>
                <div className="flex items-center justify-between">
                  <button onClick={() => setFontSizeIndex((v) => Math.max(v - 1, 0))} className="rounded-lg p-1.5 text-text-muted hover:bg-bg-hover"><Minus className="h-4 w-4" /></button>
                  <span className="text-sm text-text-secondary">{fontSize}px</span>
                  <button onClick={() => setFontSizeIndex((v) => Math.min(v + 1, FONT_SIZES.length - 1))} className="rounded-lg p-1.5 text-text-muted hover:bg-bg-hover"><Plus className="h-4 w-4" /></button>
                </div>
                <p className="mb-2 mt-4 text-xs font-medium text-text-muted">Fonte</p>
                <div className="flex gap-2">
                  <button onClick={() => setFontFamily("sans")} className={`flex-1 rounded-lg px-3 py-1.5 text-xs ${fontFamily === "sans" ? "bg-accent-teal/10 text-accent-teal ring-1 ring-accent-teal/30" : "text-text-muted hover:bg-bg-hover"}`}>Sans</button>
                  <button onClick={() => setFontFamily("serif")} className={`flex-1 rounded-lg px-3 py-1.5 text-xs ${fontFamily === "serif" ? "bg-accent-teal/10 text-accent-teal ring-1 ring-accent-teal/30" : "text-text-muted hover:bg-bg-hover"}`}>Serif</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div ref={contentRef} className="flex-1 overflow-y-auto" style={{ fontSize: `${fontSize}px`, fontFamily: fontFamily === "serif" ? "Georgia, serif" : "inherit" }}>
        <article className="mx-auto max-w-2xl px-6 py-10 md:px-0">
          {/* Meta */}
          <div className="mb-6 flex items-center gap-3 text-xs text-text-muted">
            <span className="font-medium uppercase tracking-wider text-accent-teal">{post.category}</span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{readingTime} min</span>
            <span>{dateStr}</span>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold leading-tight text-text-primary md:text-4xl">{post.title}</h1>

          {/* Author */}
          <p className="mt-4 text-sm text-text-muted">Por {post.author}</p>

          {/* Excerpt */}
          {post.excerpt && (
            <p className="mt-6 text-base leading-relaxed text-text-secondary italic border-l-2 border-accent-teal/30 pl-4">{post.excerpt}</p>
          )}

          <hr className="my-8 border-border-subtle" />

          {/* Body */}
          <div className="text-text-secondary">
            {renderMarkdown(post.content)}
          </div>

          {/* Sources */}
          {post.sources.length > 0 && (
            <div className="mt-12 rounded-xl bg-bg-surface p-6 ring-1 ring-white/[0.06]">
              <h3 className="mb-4 text-sm font-semibold text-text-primary">Fontes</h3>
              <ol className="space-y-2">
                {post.sources.map((source, idx) => (
                  <li key={idx} className="text-sm text-text-secondary">
                    <span className="mr-2 text-text-muted">{idx + 1}.</span>
                    {source.url ? (
                      <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent-teal hover:underline">
                        {source.title}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span>{source.title}</span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-bg-surface px-3 py-1 text-xs text-text-muted ring-1 ring-white/[0.04]">
                  <Tag className="h-3 w-3" />
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="h-20" />
        </article>
      </div>

      {/* Bottom bar */}
      <footer className="flex items-center justify-between border-t border-border-subtle px-4 py-2 text-xs text-text-muted">
        <span>{post.author}</span>
        <span>{Math.round(scrollProgress * 100)}% lido</span>
      </footer>
    </div>
  )
}
