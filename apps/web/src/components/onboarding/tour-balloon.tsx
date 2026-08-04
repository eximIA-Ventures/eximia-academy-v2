"use client"

import { ArrowLeft, ArrowRight, X } from "lucide-react"
import { useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

const WIDTH = 380
const GAP = 12
// Estimativa usada só antes da primeira medição real do próprio balão — evita
// um "pulo" visível de reposicionamento no primeiro frame.
const ESTIMATED_HEIGHT = 220

export interface TourBalloonProps {
  titulo: string
  corpo: string
  /** 1-based, para exibição ("passo 2 de 6"). */
  passo: number
  total: number
  /** Retângulo da âncora do passo atual, ou `null` se ela não existe agora. */
  anchorRect: DOMRect | null
  onVoltar?: () => void
  onAvancar: () => void
  onSair: () => void
  /**
   * Sobrescreve o rótulo do último passo (default "Concluir"). Existe porque
   * um dataset real pode ter um controle cujo próprio texto já nomeia a ação
   * final (ex.: "Começar minha jornada") — repetir "Concluir" no balão vira
   * ambíguo ou simplesmente falso quando a conclusão real é outro clique,
   * achado do protótipo revisado pelo Hugo (ver `tour-host.tsx`).
   */
  rotuloFinal?: string
}

/**
 * Balão do tour guiado — porta `BalaoTour` de
 * `app/dev/preview-feature-review/page.tsx`, preservando texto e visual
 * aprovados. A diferença: aqui ele é posicionado por portal, próximo à
 * âncora real, com flip automático quando não cabe abaixo/à direita.
 */
export function TourBalloon({
  titulo,
  corpo,
  passo,
  total,
  anchorRect,
  onVoltar,
  onAvancar,
  onSair,
  rotuloFinal,
}: TourBalloonProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [ownHeight, setOwnHeight] = useState(0)

  // Deps vazias de propósito: o balão troca de texto sem desmontar entre
  // passos, mas o ResizeObserver observa o próprio elemento continuamente —
  // ele já dispara sozinho quando o texto novo muda a altura renderizada,
  // sem precisar recriar a assinatura a cada passo.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setOwnHeight(el.offsetHeight)

    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect
      if (box) setOwnHeight(box.height)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  if (!anchorRect || typeof document === "undefined") return null

  const position = computePosition(anchorRect, ownHeight || ESTIMATED_HEIGHT)

  return createPortal(
    // NOTA: <dialog> nativo exigiria showModal()/gerenciamento de estado
    // próprio, incompatível com a posição fixa calculada por JS a cada passo
    // (computePosition, abaixo) — role="dialog" é a escolha deliberada aqui,
    // mesmo padrão de `announcement-modal.tsx` neste mesmo diretório.
    <div
      ref={ref}
      role="dialog"
      aria-label={`Guia, passo ${passo} de ${total}`}
      style={{ position: "fixed", top: position.top, left: position.left, width: WIDTH }}
      className="z-[60] overflow-hidden rounded-2xl border border-white/10 shadow-2xl dark:border-white/[0.16]"
    >
      <div className="h-1 bg-[linear-gradient(90deg,oklch(0.78_0.16_60)_0%,oklch(0.72_0.18_45)_45%,oklch(0.64_0.17_30)_100%)]" />
      <div className="bg-[linear-gradient(135deg,oklch(0.24_0.03_45)_0%,oklch(0.19_0.025_40)_55%,oklch(0.16_0.02_35)_100%)] p-5 dark:bg-[linear-gradient(135deg,oklch(0.31_0.014_48)_0%,oklch(0.27_0.011_42)_55%,oklch(0.24_0.009_38)_100%)]">
        <div className="mb-2 flex items-start justify-between gap-3">
          <span className="text-[11px] text-white/55 uppercase tracking-wider">
            passo {passo} de {total}
          </span>
          <button
            type="button"
            onClick={onSair}
            aria-label="Sair do guia"
            className="rounded-lg p-1 text-white/45 hover:bg-white/10 hover:text-white/90"
          >
            <X size={15} />
          </button>
        </div>

        {/* aria-live: cada troca de passo reescreve título e corpo aqui dentro,
            e o leitor de tela anuncia a mudança sem precisar de foco manual. */}
        <div aria-live="polite">
          <h4 className="font-bold text-base text-white leading-snug">{titulo}</h4>
          <p className="mt-1.5 text-[13px] text-white/70 leading-relaxed">{corpo}</p>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {/* pontos decorativos de tamanho fixo (total), sem reordenação — o índice é a identidade. */}
            {Array.from({ length: total }, (_, k) => (
              <span
                key={`tour-dot-${k}`}
                className={
                  k === passo - 1
                    ? "h-1.5 w-5 rounded-full bg-cerrado-400"
                    : "h-1.5 w-1.5 rounded-full bg-white/25"
                }
              />
            ))}
          </div>
          <div className="flex items-center gap-3">
            {onVoltar && (
              <button
                type="button"
                onClick={onVoltar}
                className="inline-flex items-center gap-1 text-[13px] text-white/55 hover:text-white"
              >
                <ArrowLeft size={13} /> Voltar
              </button>
            )}
            <button
              type="button"
              onClick={onAvancar}
              className="inline-flex items-center gap-1.5 rounded-full bg-[linear-gradient(90deg,oklch(0.78_0.16_60)_0%,oklch(0.72_0.18_45)_45%,oklch(0.64_0.17_30)_100%)] px-4 py-2 font-semibold text-[13px] text-white shadow-lg"
            >
              {passo === total ? (rotuloFinal ?? "Concluir") : "Próximo"} <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/**
 * Flip automático: prefere abaixo/alinhado à esquerda da âncora (o padrão do
 * protótipo), mas troca de lado quando não há espaço — nunca deixa o balão
 * sair da viewport.
 */
function computePosition(anchor: DOMRect, height: number): { top: number; left: number } {
  const viewportWidth = typeof window === "undefined" ? anchor.right + WIDTH : window.innerWidth
  const viewportHeight = typeof window === "undefined" ? anchor.bottom + height : window.innerHeight

  const spaceBelow = viewportHeight - anchor.bottom
  const spaceAbove = anchor.top
  const placeBelow = spaceBelow >= height + GAP || spaceBelow >= spaceAbove
  const top = placeBelow ? anchor.bottom + GAP : anchor.top - height - GAP

  return {
    top: clamp(top, GAP, viewportHeight - height - GAP),
    left: clamp(anchor.left, GAP, viewportWidth - WIDTH - GAP),
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}
