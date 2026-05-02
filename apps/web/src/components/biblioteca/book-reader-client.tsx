"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, Minus, Plus, Type, Settings } from "lucide-react"
import Link from "next/link"
import type { ClientBook, ClientBookChapter } from "@/lib/books-queries"

type ReaderMode = "chapters" | "summary"

const FONT_SIZES = [14, 16, 18, 20, 22] as const
const WORDS_PER_MINUTE = 200

function estimateReadingTime(text: string): number {
  const words = text.split(/\s+/).length
  return Math.ceil(words / WORDS_PER_MINUTE)
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

  function inlineFormat(text: string): string {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-text-primary">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code class="rounded bg-bg-elevated px-1.5 py-0.5 text-[0.85em] text-accent-blue-light">$1</code>')
  }

  while (i < lines.length) {
    const line = lines[i]

    // Table detection
    if (line.includes("|") && line.trim().startsWith("|")) {
      if (!inTable) {
        flushList()
        inTable = true
      }
      const cells = line.split("|").filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
      if (!/^[\s|:-]+$/.test(line)) {
        tableRows.push(cells)
      } else {
        tableRows.push(cells) // separator row
      }
      i++
      continue
    }
    if (inTable) flushTable()

    // Empty line
    if (line.trim() === "") {
      flushList()
      i++
      continue
    }

    // Headers
    if (line.startsWith("### ")) {
      flushList()
      elements.push(
        <h4 key={`h4-${i}`} className="mb-2 mt-8 text-base font-bold text-text-primary">
          {line.slice(4)}
        </h4>
      )
      i++
      continue
    }
    if (line.startsWith("## ")) {
      flushList()
      elements.push(
        <h3 key={`h3-${i}`} className="mb-3 mt-10 text-lg font-bold text-text-primary">
          {line.slice(3)}
        </h3>
      )
      i++
      continue
    }

    // Blockquote
    if (line.startsWith("> ")) {
      flushList()
      elements.push(
        <blockquote
          key={`bq-${i}`}
          className="my-6 border-l-2 border-accent-gold/40 py-1 pl-4 italic text-text-secondary/80"
          dangerouslySetInnerHTML={{ __html: inlineFormat(line.slice(2)) }}
        />
      )
      i++
      continue
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      if (listType !== "ol") flushList()
      listType = "ol"
      listItems.push(line.replace(/^\d+\.\s/, ""))
      i++
      continue
    }

    // Unordered list
    if (line.startsWith("- ")) {
      if (listType !== "ul") flushList()
      listType = "ul"
      listItems.push(line.slice(2))
      i++
      continue
    }

    // Paragraph
    flushList()
    elements.push(
      <p
        key={`p-${i}`}
        className="my-4 leading-[1.8]"
        dangerouslySetInnerHTML={{ __html: inlineFormat(line) }}
      />
    )
    i++
  }

  flushList()
  if (inTable) flushTable()

  return elements
}

export function BookReaderClient({
  book,
  sections,
  mode = "chapters",
}: {
  book: ClientBook
  sections?: ClientBookChapter[]
  mode?: ReaderMode
}) {
  const items = sections ?? book.chapters
  const sectionLabel = mode === "summary" ? "Secao" : "Capítulo"
  const sectionLabelShort = mode === "summary" ? "Sec." : "Cap."
  const [chapterIndex, setChapterIndex] = useState(0)
  const [fontSizeIndex, setFontSizeIndex] = useState(1)
  const [fontFamily, setFontFamily] = useState<"sans" | "serif">("sans")
  const [showSettings, setShowSettings] = useState(false)
  const [showChapterList, setShowChapterList] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)
  const contentRef = useRef<HTMLDivElement>(null)
  const settingsRef = useRef<HTMLDivElement>(null)
  const chapterListRef = useRef<HTMLDivElement>(null)

  const chapter = items[chapterIndex]
  const fontSize = FONT_SIZES[fontSizeIndex]
  const readingTime = estimateReadingTime(chapter.content)

  const goToChapter = useCallback(
    (index: number) => {
      if (index >= 0 && index < items.length) {
        setChapterIndex(index)
        setShowChapterList(false)
        contentRef.current?.scrollTo({ top: 0 })
      }
    },
    [items.length]
  )

  const changeFontSize = useCallback(
    (delta: number) => {
      setFontSizeIndex((prev) => Math.max(0, Math.min(FONT_SIZES.length - 1, prev + delta)))
    },
    []
  )

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      switch (e.key) {
        case "ArrowLeft":
          goToChapter(chapterIndex - 1)
          break
        case "ArrowRight":
          goToChapter(chapterIndex + 1)
          break
        case "+":
        case "=":
          changeFontSize(1)
          break
        case "-":
          changeFontSize(-1)
          break
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [chapterIndex, goToChapter, changeFontSize])

  // Scroll progress tracking
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    function handleScroll() {
      if (!el) return
      const { scrollTop, scrollHeight, clientHeight } = el
      const progress = scrollHeight <= clientHeight ? 100 : (scrollTop / (scrollHeight - clientHeight)) * 100
      setScrollProgress(progress)
    }
    el.addEventListener("scroll", handleScroll)
    return () => el.removeEventListener("scroll", handleScroll)
  }, [chapterIndex])

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false)
      }
      if (chapterListRef.current && !chapterListRef.current.contains(e.target as Node)) {
        setShowChapterList(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg-app">
      {/* Progress bar */}
      <div className="h-0.5 w-full bg-bg-elevated">
        <div
          className="h-full bg-accent-gold transition-all duration-150"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border-subtle px-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/biblioteca/${book.id}`}
            className="flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Voltar</span>
          </Link>

          <span className="text-xs text-border-medium">|</span>

          <h1 className="max-w-[200px] truncate text-sm font-medium text-text-primary sm:max-w-[300px]">
            {book.title}
          </h1>
        </div>

        <div className="flex items-center gap-1">
          {/* Chapter dropdown */}
          <div ref={chapterListRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setShowChapterList(!showChapterList)
                setShowSettings(false)
              }}
              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
            >
              <span className="hidden sm:inline">{sectionLabelShort} {chapterIndex + 1}</span>
              <span className="sm:hidden">{sectionLabelShort}{chapterIndex + 1}</span>
              <ChevronDown className="h-3 w-3" />
            </button>

            {showChapterList && (
              <div className="absolute right-0 top-full z-10 mt-1 w-72 rounded-lg border border-border-subtle bg-bg-card p-2 shadow-elevated">
                {items.map((ch, idx) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => goToChapter(idx)}
                    className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      idx === chapterIndex
                        ? "bg-accent-blue-mid/10 text-accent-blue-light"
                        : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                    }`}
                  >
                    <span className="shrink-0 text-xs text-text-muted">{idx + 1}</span>
                    <span className="truncate">{ch.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Settings */}
          <div ref={settingsRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setShowSettings(!showSettings)
                setShowChapterList(false)
              }}
              className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
              aria-label="Configurações de leitura"
            >
              <Settings className="h-4 w-4" />
            </button>

            {showSettings && (
              <div className="absolute right-0 top-full z-10 mt-1 w-56 rounded-lg border border-border-subtle bg-bg-card p-4 shadow-elevated">
                {/* Font size */}
                <div className="mb-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">Tamanho da fonte</p>
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => changeFontSize(-1)}
                      disabled={fontSizeIndex === 0}
                      className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-bg-hover disabled:opacity-30"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="text-sm text-text-primary">{fontSize}px</span>
                    <button
                      type="button"
                      onClick={() => changeFontSize(1)}
                      disabled={fontSizeIndex === FONT_SIZES.length - 1}
                      className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-bg-hover disabled:opacity-30"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Font family */}
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">Fonte</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFontFamily("sans")}
                      className={`flex-1 rounded-md px-3 py-1.5 text-sm transition-colors ${
                        fontFamily === "sans"
                          ? "bg-accent-blue-mid/15 text-accent-blue-light"
                          : "text-text-secondary hover:bg-bg-hover"
                      }`}
                    >
                      <Type className="mx-auto mb-0.5 h-4 w-4" />
                      Sans
                    </button>
                    <button
                      type="button"
                      onClick={() => setFontFamily("serif")}
                      className={`flex-1 rounded-md px-3 py-1.5 text-sm transition-colors ${
                        fontFamily === "serif"
                          ? "bg-accent-blue-mid/15 text-accent-blue-light"
                          : "text-text-secondary hover:bg-bg-hover"
                      }`}
                      style={{ fontFamily: "Georgia, serif" }}
                    >
                      <Type className="mx-auto mb-0.5 h-4 w-4" />
                      Serif
                    </button>
                  </div>
                </div>

                {/* Keyboard shortcuts hint */}
                <div className="mt-4 border-t border-border-subtle pt-3">
                  <p className="text-[10px] text-text-muted">
                    Atalhos: ← → navegar | +/- tamanho
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Reading area */}
      <div
        ref={contentRef}
        className="flex-1 overflow-y-auto"
      >
        <article
          className="mx-auto max-w-2xl px-6 py-10 sm:px-8"
          style={{
            fontSize: `${fontSize}px`,
            fontFamily: fontFamily === "serif" ? "Georgia, 'Times New Roman', serif" : "inherit",
          }}
        >
          {/* Chapter header */}
          <div className="mb-10">
            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-accent-gold">
              {sectionLabel} {chapterIndex + 1} de {items.length}
            </p>
            <h2 className="text-2xl font-bold leading-tight text-text-primary sm:text-3xl">
              {chapter.title}
            </h2>
            <p className="mt-2 text-sm text-text-muted">
              ~{readingTime} min de leitura
            </p>
          </div>

          {/* Content */}
          <div className="text-text-secondary">
            {renderMarkdown(chapter.content)}
          </div>

          {/* Chapter navigation */}
          <nav className="mt-16 flex items-center justify-between border-t border-border-subtle pt-6">
            {chapterIndex > 0 ? (
              <button
                type="button"
                onClick={() => goToChapter(chapterIndex - 1)}
                className="group flex items-center gap-2 text-sm text-text-muted transition-colors hover:text-text-primary"
              >
                <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                <div className="text-left">
                  <p className="text-[10px] uppercase tracking-wider text-text-muted">Anterior</p>
                  <p className="max-w-[150px] truncate text-text-secondary group-hover:text-text-primary">
                    {items[chapterIndex - 1].title}
                  </p>
                </div>
              </button>
            ) : (
              <div />
            )}

            {chapterIndex < items.length - 1 ? (
              <button
                type="button"
                onClick={() => goToChapter(chapterIndex + 1)}
                className="group flex items-center gap-2 text-sm text-text-muted transition-colors hover:text-text-primary"
              >
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-text-muted">Proximo</p>
                  <p className="max-w-[150px] truncate text-text-secondary group-hover:text-text-primary">
                    {items[chapterIndex + 1].title}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            ) : (
              <Link
                href={`/biblioteca/${book.id}`}
                className="flex items-center gap-2 text-sm text-accent-gold transition-colors hover:text-accent-gold-light"
              >
                Voltar ao livro
              </Link>
            )}
          </nav>

          {/* Bottom spacer */}
          <div className="h-16" />
        </article>
      </div>

      {/* Bottom bar */}
      <footer className="flex h-8 shrink-0 items-center justify-between border-t border-border-subtle px-4 text-[11px] text-text-muted">
        <span>
          {book.title} — {book.author}
        </span>
        <span>
          {sectionLabelShort} {chapterIndex + 1}/{items.length} · {Math.round(scrollProgress)}%
        </span>
      </footer>
    </div>
  )
}
