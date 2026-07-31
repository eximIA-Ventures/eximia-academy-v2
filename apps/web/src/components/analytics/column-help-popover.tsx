"use client"

import { Info } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"

/**
 * Ajuda de coluna que abre por CLIQUE, não por hover (Hugo, 2026-07-31).
 *
 * Por que não usar o `Tooltip` de `@eximia/ui`: ele é `group-hover` puro, com
 * `whitespace-nowrap`. Serve para rótulo curto que aparece ao passar o mouse —
 * exatamente o que não queremos aqui. Hover tem três problemas neste caso:
 * não existe em toque (o gestor no celular nunca veria a explicação), depende do
 * atraso do sistema, e não deixa o texto ser lido com calma nem copiado.
 *
 * Nenhuma dependência nova: estado local, click-outside e Escape.
 *
 * "Só um aberto por vez" é resolvido por um evento no `document` em vez de
 * contexto ou prop drilling: ao abrir, o popover anuncia o próprio id, e todos
 * os outros que ouvirem um id diferente do seu se fecham. Isso mantém o
 * componente autocontido, sem provider nem estado no pai.
 */

const OPEN_EVENT = "column-help:open"

interface ColumnHelpPopoverProps {
  /** Texto da ajuda. */
  text: string
  /** Nome da coluna, para o rótulo acessível ("Sobre a coluna X"). */
  label: string
}

export function ColumnHelpPopover({ text, label }: ColumnHelpPopoverProps) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const rootRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return

    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    function onOtherOpened(e: Event) {
      if ((e as CustomEvent<string>).detail !== id) setOpen(false)
    }

    document.addEventListener("mousedown", onDocClick)
    document.addEventListener("keydown", onKey)
    document.addEventListener(OPEN_EVENT, onOtherOpened)
    return () => {
      document.removeEventListener("mousedown", onDocClick)
      document.removeEventListener("keydown", onKey)
      document.removeEventListener(OPEN_EVENT, onOtherOpened)
    }
  }, [open, id])

  function toggle() {
    setOpen((was) => {
      const next = !was
      if (next) document.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }))
      return next
    })
  }

  return (
    <span ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={`Sobre a coluna ${label}`}
        className="inline-flex items-center rounded-sm text-text-muted/60 hover:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-cerrado-600/50"
      >
        <Info size={12} />
      </button>

      {open && (
        // z alto + largura fixa: o texto é longo e não pode empurrar a coluna
        // nem virar uma linha só.
        <span
          role="note"
          className="absolute left-1/2 top-full z-[70] mt-2 w-64 -translate-x-1/2 rounded-lg bg-bg-elevated p-3 text-left text-xs font-normal normal-case leading-relaxed text-text-primary shadow-elevated"
        >
          {text}
        </span>
      )}
    </span>
  )
}
