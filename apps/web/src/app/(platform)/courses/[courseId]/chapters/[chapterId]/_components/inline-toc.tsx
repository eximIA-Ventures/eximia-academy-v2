"use client"

import { cn } from "@eximia/ui"
import { List } from "lucide-react"
import { useState } from "react"

interface InlineTocProps {
  sections: { text: string; slug: string }[]
}

export function InlineToc({ sections }: InlineTocProps) {
  const [open, setOpen] = useState(true)

  if (sections.length < 2) return null

  return (
    <nav className="mb-12 rounded-xl shadow-card bg-bg-card/50 p-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left"
      >
        <List size={16} className="text-cerrado-400" />
        <span className="text-sm font-semibold text-text-primary">
          Neste capítulo
        </span>
        <span className="ml-auto text-xs text-text-muted">
          {sections.length} seções
        </span>
      </button>

      {open && (
        <ol className="mt-4 space-y-0.5 border-l-2 border-border-subtle ml-2 pl-4">
          {sections.map((s, i) => (
            <li key={s.slug}>
              <a
                href={`#${s.slug}`}
                className={cn(
                  "flex items-baseline gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  "text-text-secondary hover:text-cerrado-400 hover:bg-bg-elevated",
                )}
              >
                <span className="text-2xs tabular-nums text-text-muted font-medium">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{s.text}</span>
              </a>
            </li>
          ))}
        </ol>
      )}
    </nav>
  )
}
