"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"
import { ArrowLeft, ChevronLeft, ChevronRight, Minus, Plus, Loader2 } from "lucide-react"
import Link from "next/link"

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const

interface PdfViewerClientProps {
  bookId: string
  bookTitle: string
  pdfUrl: string
}

export function PdfViewerClient({ bookId, bookTitle, pdfUrl }: PdfViewerClientProps) {
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [zoomIndex, setZoomIndex] = useState(2) // 100%
  const [pageInputValue, setPageInputValue] = useState("1")
  const [scrollProgress, setScrollProgress] = useState(0)
  const [loading, setLoading] = useState(true)
  const contentRef = useRef<HTMLDivElement>(null)

  const zoom = ZOOM_LEVELS[zoomIndex]
  const zoomPercent = Math.round(zoom * 100)

  function onDocumentLoadSuccess({ numPages: total }: { numPages: number }) {
    setNumPages(total)
    setLoading(false)
  }

  const goToPage = useCallback(
    (page: number) => {
      const target = Math.max(1, Math.min(numPages, page))
      setCurrentPage(target)
      setPageInputValue(String(target))
      contentRef.current?.scrollTo({ top: 0 })
    },
    [numPages],
  )

  const changeZoom = useCallback((delta: number) => {
    setZoomIndex((prev) => Math.max(0, Math.min(ZOOM_LEVELS.length - 1, prev + delta)))
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return
      switch (e.key) {
        case "ArrowLeft":
          goToPage(currentPage - 1)
          break
        case "ArrowRight":
          goToPage(currentPage + 1)
          break
        case "+":
        case "=":
          changeZoom(1)
          break
        case "-":
          changeZoom(-1)
          break
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [currentPage, goToPage, changeZoom])

  // Scroll progress
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
  }, [currentPage])

  function handlePageInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const parsed = Number.parseInt(pageInputValue, 10)
      if (!Number.isNaN(parsed)) goToPage(parsed)
    }
  }

  function handlePageInputBlur() {
    const parsed = Number.parseInt(pageInputValue, 10)
    if (!Number.isNaN(parsed)) goToPage(parsed)
    else setPageInputValue(String(currentPage))
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg-app">
      {/* Progress bar */}
      <div className="h-0.5 w-full bg-bg-elevated">
        <div
          className="h-full bg-accent-gold transition-all duration-150"
          style={{ width: `${numPages > 0 ? (currentPage / numPages) * 100 : scrollProgress}%` }}
        />
      </div>

      {/* Header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border-subtle px-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/biblioteca/${bookId}`}
            className="flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Voltar</span>
          </Link>

          <span className="text-xs text-border-medium">|</span>

          <h1 className="max-w-[200px] truncate text-sm font-medium text-text-primary sm:max-w-[300px]">
            {bookTitle}
          </h1>
        </div>

        <div className="flex items-center gap-1">
          {/* Zoom controls */}
          <button
            type="button"
            onClick={() => changeZoom(-1)}
            disabled={zoomIndex === 0}
            className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-bg-hover disabled:opacity-30"
            aria-label="Diminuir zoom"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="min-w-[3rem] text-center text-xs text-text-secondary">{zoomPercent}%</span>
          <button
            type="button"
            onClick={() => changeZoom(1)}
            disabled={zoomIndex === ZOOM_LEVELS.length - 1}
            className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-bg-hover disabled:opacity-30"
            aria-label="Aumentar zoom"
          >
            <Plus className="h-4 w-4" />
          </button>

          <span className="mx-1 text-xs text-border-medium">|</span>

          {/* Page input */}
          <input
            type="text"
            value={pageInputValue}
            onChange={(e) => setPageInputValue(e.target.value)}
            onKeyDown={handlePageInputKeyDown}
            onBlur={handlePageInputBlur}
            className="w-10 rounded-md border border-border-subtle bg-bg-surface px-1.5 py-1 text-center text-xs text-text-primary outline-none focus:border-accent-blue-mid"
            aria-label="Número da página"
          />
          <span className="text-xs text-text-muted">/ {numPages || "..."}</span>
        </div>
      </header>

      {/* PDF content */}
      <div ref={contentRef} className="flex-1 overflow-auto">
        <div className="flex min-h-full justify-center p-4">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando PDF...
            </div>
          )}
          <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={() => setLoading(false)}
            loading=""
            className={loading ? "hidden" : ""}
          >
            <Page
              pageNumber={currentPage}
              scale={zoom}
              className="shadow-elevated [&_.react-pdf__Page__canvas]:rounded-sm"
              loading={
                <div className="flex items-center gap-2 text-sm text-text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              }
            />
          </Document>
        </div>
      </div>

      {/* Footer */}
      <footer className="flex h-10 shrink-0 items-center justify-between border-t border-border-subtle px-4">
        <button
          type="button"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary disabled:opacity-30"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Anterior
        </button>

        <span className="text-[11px] text-text-muted">
          Pagina {currentPage} de {numPages || "..."}
        </span>

        <button
          type="button"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= numPages}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary disabled:opacity-30"
        >
          Proximo
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </footer>
    </div>
  )
}
