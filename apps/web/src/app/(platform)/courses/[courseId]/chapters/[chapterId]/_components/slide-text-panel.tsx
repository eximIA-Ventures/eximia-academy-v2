"use client"

import type { ChapterSlide } from "@eximia/shared"
import Markdown from "react-markdown"
import type { Components } from "react-markdown"

interface SlideTextPanelProps {
  slide: ChapterSlide
  isAudioPlaying?: boolean
}

const slideMarkdownComponents: Components = {
  h2: ({ children }) => (
    <h2 className="text-lg sm:text-xl font-bold text-white mt-2 mb-4 sm:mb-5 break-words">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-[15px] sm:text-base font-semibold text-white mt-6 sm:mt-8 mb-2 sm:mb-3 break-words">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-sm sm:text-[15px] leading-[1.75] text-white/80 mb-4 sm:mb-5 break-words">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="text-white font-semibold">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="text-white/70">{children}</em>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-accent-blue-mid/40 bg-accent-blue-mid/5 rounded-r-lg pl-3 pr-3 sm:pl-4 sm:pr-4 py-2.5 sm:py-3 my-4 sm:my-6 text-sm sm:text-[15px] text-white/70 not-italic break-words">
      {children}
    </blockquote>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-outside pl-4 sm:pl-5 my-3 sm:my-4 space-y-1.5 sm:space-y-2 text-sm sm:text-[15px] text-white/80">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-outside pl-4 sm:pl-5 my-3 sm:my-4 space-y-1.5 sm:space-y-2 text-sm sm:text-[15px] text-white/80">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed break-words">{children}</li>
  ),
  hr: () => (
    <hr className="border-white/10 my-8" />
  ),
}

export function SlideTextPanel({ slide, isAudioPlaying }: SlideTextPanelProps) {
  if (!slide.text_content) {
    return (
      <div className="rounded-md bg-bg-card p-4 text-center text-sm text-text-muted italic">
        Texto ainda não gerado para este slide.
      </div>
    )
  }

  return (
    <div
      className={`rounded-xl bg-bg-card p-4 sm:p-6 md:p-8 overflow-hidden [overflow-wrap:anywhere] transition-all ${
        isAudioPlaying ? "ring-1 ring-accent-blue-mid/20" : ""
      }`}
    >
      <Markdown components={slideMarkdownComponents}>
        {slide.text_content}
      </Markdown>
    </div>
  )
}
