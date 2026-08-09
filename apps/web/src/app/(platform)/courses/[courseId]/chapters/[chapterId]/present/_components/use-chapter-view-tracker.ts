"use client"

import { shouldAdvanceWatermark } from "@/lib/analytics/view-progress"
import { useEffect, useRef } from "react"

/**
 * Percorrido x Elaborado — captura da marca d'água de exposição.
 * Contrato: docs/architecture/medicao-percorrido-vs-elaborado.md §3.
 *
 * O efeito observa o ESTADO `currentIndex`, e não a função de navegação, de
 * propósito: existem DOIS caminhos que trocam o slide no viewer — a navegação
 * deliberada (`goToSlide`) e o auto-advance por timestamp de áudio. Um gancho
 * na navegação perderia todo o segundo caminho, e observar o estado é imune a
 * caminhos futuros.
 *
 * Decisão de produto (Hugo, 2026-07-30): o avanço automático por áudio CONTA
 * como percorrido. Por isso NÃO há checagem de visibilidade da aba nem
 * ramificação por origem do avanço. "Percorrido" mede exposição oferecida, não
 * atenção comprovada.
 *
 * A escrita nunca degrada a aula: falha de rede é silenciosa.
 */

const DEBOUNCE_MS = 3000
const ENDPOINT = "/api/chapter-view-progress"

interface Payload {
  chapterId: string
  maxSlideIndex: number
  slidesTotal: number
  reachedLastSlide: boolean
}

interface TrackerArgs {
  chapterId?: string
  currentIndex: number
  slidesTotal: number
}

export function useChapterViewTracker({ chapterId, currentIndex, slidesTotal }: TrackerArgs) {
  /** Maior índice já ENVIADO nesta montagem. null = nada enviado ainda. */
  const sentRef = useRef<number | null>(null)
  const pendingRef = useRef<Payload | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Mantém o flush estável entre renders sem re-registrar os listeners.
  const flushRef = useRef<(useBeacon?: boolean) => void>(() => {})

  flushRef.current = (useBeacon = false) => {
    const payload = pendingRef.current
    if (!payload) return

    pendingRef.current = null
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    // A marca local avança no ENVIO, não na confirmação. Se a requisição
    // falhar, o próximo avanço reenvia um índice maior e o banco faz o clamp —
    // barato, e evita retentar no meio da aula.
    sentRef.current = payload.maxSlideIndex

    const body = JSON.stringify(payload)

    if (useBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
      try {
        navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }))
      } catch {
        // silencioso por contrato
      }
      return
    }

    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      // silencioso por contrato: telemetria nunca interrompe a aula
    })
  }

  useEffect(() => {
    if (!chapterId || slidesTotal <= 0) return
    if (!shouldAdvanceWatermark(currentIndex, sentRef.current)) return

    const reachedLastSlide = currentIndex >= slidesTotal - 1
    pendingRef.current = { chapterId, maxSlideIndex: currentIndex, slidesTotal, reachedLastSlide }

    // Alcançar o fim é o evento que DEFINE o percorrido: vai imediato, sem
    // depender de timer que a saída da página poderia cancelar.
    if (reachedLastSlide) {
      flushRef.current(false)
      return
    }

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => flushRef.current(false), DEBOUNCE_MS)
  }, [chapterId, currentIndex, slidesTotal])

  // Rede de segurança: aba escondida ou página saindo levam o pendente embora.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flushRef.current(true)
    }
    const onPageHide = () => flushRef.current(true)

    document.addEventListener("visibilitychange", onHide)
    window.addEventListener("pagehide", onPageHide)

    return () => {
      document.removeEventListener("visibilitychange", onHide)
      window.removeEventListener("pagehide", onPageHide)
      if (timerRef.current) clearTimeout(timerRef.current)
      flushRef.current(true)
    }
  }, [])
}
