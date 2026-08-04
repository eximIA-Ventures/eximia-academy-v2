"use client"

import { type AnchorName, anchorSelector } from "@/lib/onboarding/types"
import { useLayoutEffect, useState } from "react"

/**
 * Resolve o `DOMRect` da âncora `name` no documento, reagindo a scroll, resize
 * e mudanças de layout que nem scroll nem resize disparam sozinhos (ex.: um
 * acordeão acima da âncora expandindo, ou a própria âncora nascendo/sumindo do
 * DOM entre passos do tour).
 *
 * `null` é um estado legítimo, não um erro: a âncora pode ainda não existir
 * (o controle que ela marca não montou) ou ter sumido (regra dura de
 * `tour-host.tsx`, story §2.2 — quem decide o que fazer com isso é quem
 * consome este hook, não ele).
 *
 * A medição inicial é síncrona (useLayoutEffect, sem esperar rAF): o balão
 * depende deste retângulo para decidir se renderiza, e um primeiro frame sem
 * retângulo criaria um flash vazio visível toda vez que o passo troca.
 * Scroll/resize/ResizeObserver, que podem disparar em rajada, são
 * debounced via rAF depois desse primeiro cálculo.
 */
export function useAnchorRect(name: AnchorName | undefined): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null)

  useLayoutEffect(() => {
    if (!name || typeof document === "undefined") {
      setRect(null)
      return
    }

    const selector = anchorSelector(name)

    function measureNow() {
      const el = document.querySelector<HTMLElement>(selector)
      const next = el ? el.getBoundingClientRect() : null
      setRect((prev) => (rectsEqual(prev, next) ? prev : next))
    }

    measureNow()

    let raf = 0
    function measureThrottled() {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measureNow)
    }

    window.addEventListener("scroll", measureThrottled, { passive: true, capture: true })
    window.addEventListener("resize", measureThrottled, { passive: true })

    // jsdom (ambiente de teste) não implementa ResizeObserver — degrada
    // graciosamente para scroll/resize/medição inicial, sem quebrar o render.
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measureThrottled)
    observer?.observe(document.body)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("scroll", measureThrottled, { capture: true })
      window.removeEventListener("resize", measureThrottled)
      observer?.disconnect()
    }
  }, [name])

  return rect
}

function rectsEqual(a: DOMRect | null, b: DOMRect | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height
}
