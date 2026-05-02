"use client"

import { Skeleton } from "@eximia/ui"
import { useEffect, useRef, useState } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface PdfSlideProps {
  pdfUrl: string
  pageNumber: number
}

export default function PdfSlide({ pdfUrl, pageNumber }: PdfSlideProps) {
  const [isLoading, setIsLoading] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(960)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setContainerWidth(el.offsetWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden rounded-md bg-bg-card">
      {isLoading && (
        <div className="aspect-[3/4] w-full">
          <Skeleton className="h-full w-full" />
        </div>
      )}
      <Document
        file={pdfUrl}
        loading={null}
        onLoadSuccess={() => setIsLoading(false)}
        className="flex items-center justify-center"
      >
        <Page
          pageNumber={pageNumber}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          width={containerWidth}
        />
      </Document>
    </div>
  )
}
