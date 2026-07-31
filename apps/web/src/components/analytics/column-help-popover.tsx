"use client"

import { Info } from "lucide-react"
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react"

/**
 * Ajuda de coluna que abre por CLIQUE, não por hover (Hugo, 2026-07-31).
 *
 * Por que não usar o `Tooltip` de `@eximia/ui`: ele é `group-hover` puro, com
 * `whitespace-nowrap`. Serve para rótulo curto que aparece ao passar o mouse —
 * exatamente o que não queremos aqui. Hover tem três problemas neste caso:
 * não existe em toque (o gestor no celular nunca veria a explicação), depende do
 * atraso do sistema, e não deixa o texto ser lido com calma nem copiado.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ POSIÇÃO FIXA, e não absoluta — este é o ponto delicado do componente.    │
 * │                                                                          │
 * │ A primeira versão usava `absolute left-1/2 -translate-x-1/2`. Funcionava │
 * │ nas colunas do meio e QUEBRAVA na primeira: o balão estourava a borda    │
 * │ esquerda e era CORTADO pelo `overflow` do container da tabela (Hugo      │
 * │ reportou, 2026-07-31). Nenhum `z-index` resolve isso — overflow recorta  │
 * │ antes de empilhar.                                                       │
 * │                                                                          │
 * │ Com `position: fixed` o balão sai do fluxo de recorte por completo, e a  │
 * │ posição é calculada a partir do gatilho, com clamp nas bordas da janela  │
 * │ para nunca vazar. Custo: precisa reposicionar em scroll/resize.          │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Nenhuma dependência nova. "Só um aberto por vez" é resolvido por um evento no
 * `document`: ao abrir, o popover anuncia o próprio id e os outros se fecham,
 * o que mantém o componente autocontido, sem provider nem estado no pai.
 */

const OPEN_EVENT = "column-help:open"
const WIDTH = 260
const MARGIN = 8

interface ColumnHelpPopoverProps {
  /** Texto da ajuda. */
  text: string
  /** Nome da coluna, para o rótulo acessível ("Sobre a coluna X"). */
  label: string
}

export function ColumnHelpPopover({ text, label }: ColumnHelpPopoverProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const id = useId()
  const rootRef = useRef<HTMLSpanElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  /** Centraliza no gatilho, mas nunca deixa vazar da janela. */
  const place = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    const ideal = r.left + r.width / 2 - WIDTH / 2
    const max = window.innerWidth - WIDTH - MARGIN
    setPos({ top: r.bottom + MARGIN, left: Math.max(MARGIN, Math.min(ideal, max)) })
  }, [])

  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

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
    // Rolar ou redimensionar move o gatilho; sem isto o balão fica órfão.
    const reposition = () => place()

    document.addEventListener("mousedown", onDocClick)
    document.addEventListener("keydown", onKey)
    document.addEventListener(OPEN_EVENT, onOtherOpened)
    window.addEventListener("scroll", reposition, true)
    window.addEventListener("resize", reposition)
    return () => {
      document.removeEventListener("mousedown", onDocClick)
      document.removeEventListener("keydown", onKey)
      document.removeEventListener(OPEN_EVENT, onOtherOpened)
      window.removeEventListener("scroll", reposition, true)
      window.removeEventListener("resize", reposition)
    }
  }, [open, id, place])

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
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={`Sobre a coluna ${label}`}
        className="inline-flex items-center rounded-sm text-text-muted/60 hover:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-cerrado-600/50"
      >
        <Info size={12} />
      </button>

      {open && pos && (
        <span
          role="note"
          style={{ top: pos.top, left: pos.left, width: WIDTH }}
          className="fixed z-[100] rounded-lg bg-bg-elevated p-3 text-left text-xs font-normal normal-case leading-relaxed text-text-primary shadow-elevated"
        >
          {text}
        </span>
      )}
    </span>
  )
}
