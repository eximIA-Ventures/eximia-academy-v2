"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { BookReaderClient } from "./book-reader-client"
import { FileText, BookOpen, Loader2 } from "lucide-react"
import type { ClientBook, ClientBookChapter } from "@/lib/books-queries"

const PdfViewerClient = dynamic(
  () => import("./pdf-viewer-client").then((m) => m.PdfViewerClient),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-app text-sm text-text-muted">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Carregando visualizador...
      </div>
    ),
  },
)

type ReaderMode = "pdf" | "chapters"

interface BookReaderUnifiedProps {
  book: ClientBook
  sections?: ClientBookChapter[]
  pdfUrl?: string | null
  readerMode?: "chapters" | "summary"
}

export function BookReaderUnified({ book, sections, pdfUrl, readerMode = "chapters" }: BookReaderUnifiedProps) {
  const hasChapters = (sections ?? book.chapters).length > 0
  const hasPdf = !!pdfUrl
  const showToggle = hasPdf && hasChapters

  const [mode, setMode] = useState<ReaderMode>(hasPdf ? "pdf" : "chapters")

  return (
    <div>
      {/* Floating mode toggle */}
      {showToggle && (
        <div className="fixed left-1/2 top-[7px] z-[60] flex -translate-x-1/2 items-center gap-0.5 rounded-full shadow-card bg-bg-card/95 p-0.5 shadow-sm backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setMode("pdf")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
              mode === "pdf"
                ? "bg-cerrado-600/15 text-cerrado-400"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <FileText className="h-3 w-3" />
            PDF
          </button>
          <button
            type="button"
            onClick={() => setMode("chapters")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
              mode === "chapters"
                ? "bg-cerrado-600/15 text-cerrado-400"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <BookOpen className="h-3 w-3" />
            Capítulos
          </button>
        </div>
      )}

      {/* Viewer */}
      {mode === "pdf" && hasPdf ? (
        <PdfViewerClient bookId={book.id} bookTitle={book.title} pdfUrl={pdfUrl} />
      ) : (
        <BookReaderClient book={book} sections={sections} mode={readerMode} />
      )}
    </div>
  )
}
