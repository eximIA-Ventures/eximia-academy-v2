"use client"

import type { ChapterSlide } from "@eximia/shared"
import { Skeleton } from "@eximia/ui"
import Image from "next/image"
import dynamic from "next/dynamic"
import { useEffect, useRef, useState } from "react"

// Lazy-load react-pdf to avoid pdfjs-dist crashing on webpack module init
const PdfSlide = dynamic(() => import("./pdf-slide"), { ssr: false, loading: () => <Skeleton className="aspect-[3/4] w-full" /> })

interface SlideImageDisplayProps {
  slide: ChapterSlide
  priority?: boolean
}

export function SlideImageDisplay({ slide, priority = false }: SlideImageDisplayProps) {
  const [isLoading, setIsLoading] = useState(true)
  const isPdf = (slide.metadata as Record<string, unknown>)?.type === "pdf"

  if (isPdf) {
    const metadata = slide.metadata as { pdfUrl: string; pageNumber: number }
    return <PdfSlide pdfUrl={metadata.pdfUrl} pageNumber={metadata.pageNumber} />
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-md bg-bg-card">
      {isLoading && (
        <Skeleton className="absolute inset-0 h-full w-full" />
      )}
      {slide.image_url && (
        <Image
          src={slide.image_url}
          alt={`Slide ${slide.order + 1}`}
          fill
          className="object-contain"
          priority={priority}
          onLoad={() => setIsLoading(false)}
          sizes="(max-width: 768px) 100vw, 960px"
        />
      )}
    </div>
  )
}
