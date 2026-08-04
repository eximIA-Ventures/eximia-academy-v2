"use client"

import { type AnchorName, anchorSelector } from "@/lib/onboarding/types"
import { useLayoutEffect, useState } from "react"

/**
 * Resolve o `DOMRect` da âncora `name` no documento, reagindo a scroll, resize
 * e mudanças de layout que nem scroll nem resize disparam sozinhos (ex.: um
 * acordeão acima da âncora expandindo, ou a própria âncora nascendo/sumindo do
 * DOM entre passos do tour).
 *
 * Aceita UMA âncora ou uma LISTA delas. Com uma lista, devolve a UNIÃO dos
 * retângulos encontrados — o retângulo mínimo que contém todos. Isso existe
 * porque um passo pode falar de mais de um controle ao mesmo tempo: a
 * aterrissagem da novidade 1 diz "Percorrido e Conclusão, uma embaixo da
 * outra", e o protótipo aprovado destaca AS DUAS LINHAS
 * (`app/dev/preview-feature-review/page.tsx`, fase `n1-app`: "as duas linhas
 * ficam destacadas na tabela real"). Ancorar só na primeira tinha duas
 * consequências, ambas reportadas: o destaque cobria metade do que o texto
 * prometia, e o balão pousava logo abaixo dela — em cima da linha irmã que ele
 * acabara de citar.
 *
 * `null` é um estado legítimo, não um erro: a âncora pode ainda não existir
 * (o controle que ela marca não montou) ou ter sumido (regra dura de
 * `tour-host.tsx`, story §2.2 — quem decide o que fazer com isso é quem
 * consome este hook, não ele). Numa lista, as âncoras ausentes simplesmente
 * não entram na união; `null` só quando NENHUMA existe.
 *
 * A medição inicial é síncrona (useLayoutEffect, sem esperar rAF): o balão
 * depende deste retângulo para decidir se renderiza, e um primeiro frame sem
 * retângulo criaria um flash vazio visível toda vez que o passo troca.
 * Scroll/resize/ResizeObserver, que podem disparar em rajada, são
 * debounced via rAF depois desse primeiro cálculo.
 */
export function useAnchorRect(
  name: AnchorName | readonly AnchorName[] | undefined,
): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null)

  // CHAVE SERIALIZADA, e não o próprio argumento, nas deps do efeito: um array
  // literal no JSX (`useAnchorRect([A, B])`) muda de identidade a cada render e
  // faria o efeito religar os listeners para sempre. Os nomes são re-derivados
  // da chave DENTRO do efeito, então a assinatura só muda quando as âncoras
  // realmente mudam. Um nome de âncora nunca contém "|" (são as constantes de
  // `ANCHORS`), então o join é injetivo.
  const key = name === undefined ? "" : Array.isArray(name) ? name.join("|") : String(name)

  useLayoutEffect(() => {
    if (!key || typeof document === "undefined") {
      setRect(null)
      return
    }

    const selectors = key.split("|").map((n) => anchorSelector(n as AnchorName))

    function measureNow() {
      const rects: DOMRect[] = []
      for (const selector of selectors) {
        const el = document.querySelector<HTMLElement>(selector)
        if (el) rects.push(el.getBoundingClientRect())
      }
      const next = unionRect(rects)
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
  }, [key])

  return rect
}

/**
 * O menor retângulo que contém todos. Lista vazia → `null` (nenhuma âncora no
 * DOM). Lista de UM → o próprio retângulo, sem cópia: o caminho de âncora
 * única continua byte-a-byte o de antes, incluindo a identidade do objeto que
 * `rectsEqual` compara.
 */
function unionRect(rects: DOMRect[]): DOMRect | null {
  if (rects.length === 0) return null
  if (rects.length === 1) return rects[0]

  let top = Number.POSITIVE_INFINITY
  let left = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY
  for (const r of rects) {
    top = Math.min(top, r.top)
    left = Math.min(left, r.left)
    right = Math.max(right, r.right)
    bottom = Math.max(bottom, r.bottom)
  }
  const width = right - left
  const height = bottom - top

  // `DOMRect` existe no browser e no jsdom; o fallback cobre qualquer ambiente
  // (SSR, runtime de teste enxuto) sem obrigar o chamador a checar.
  if (typeof DOMRect !== "undefined") return new DOMRect(left, top, width, height)
  return {
    x: left,
    y: top,
    top,
    left,
    right,
    bottom,
    width,
    height,
    toJSON: () => ({ x: left, y: top, top, left, right, bottom, width, height }),
  } as DOMRect
}

function rectsEqual(a: DOMRect | null, b: DOMRect | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height
}
