"use client"

import { useCallback, useEffect, useState } from "react"

interface ImageWithLightboxProps {
  src: string
  alt: string
  className?: string
}

export function ImageWithLightbox({ src, alt, className = "" }: ImageWithLightboxProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  const openLightbox = useCallback(() => {
    if (!error) setIsOpen(true)
  }, [error])

  const closeLightbox = useCallback(() => setIsOpen(false), [])

  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeLightbox()
    }

    document.body.style.overflow = "hidden"
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.body.style.overflow = ""
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen, closeLightbox])

  if (error) {
    return (
      <div className="flex min-h-[100px] items-center justify-center rounded-md bg-bg-card text-text-muted">
        Imagem indisponivel
      </div>
    )
  }

  return (
    <>
      <div className="relative min-h-[100px]">
        {!loaded && (
          <div className="absolute inset-0 animate-pulse rounded-md bg-bg-card" />
        )}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className={`${className} cursor-pointer transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          onClick={openLightbox}
        />
      </div>

      {/* Lightbox overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label={alt || "Imagem ampliada"}
        >
          <button
            type="button"
            className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            onClick={closeLightbox}
            aria-label="Fechar"
            autoFocus
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <img
            src={src}
            alt={alt}
            className="max-h-[90vh] max-w-[90vw] rounded-md object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
