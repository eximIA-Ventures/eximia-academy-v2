"use client"

import { type TourStep, anchorSelector } from "@/lib/onboarding/types"
import { useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { AnchorSpotlight } from "./anchor-spotlight"
import { TourBalloon } from "./tour-balloon"
import { useAnchorRect } from "./use-anchor-rect"

export interface TourHostProps {
  /**
   * O conteúdo dos passos, autorado por quem monta a tela. Este arquivo NÃO
   * importa o texto do tour — só sabe navegar entre os passos recebidos,
   * destacar a âncora de cada um e aplicar a regra dura de resolução.
   */
  steps: TourStep[]
  /** Passo (0-based) para retomar de onde a pessoa parou. Default: 0. */
  initialStep?: number
  /**
   * Chamado quando a pessoa conclui o ÚLTIMO passo E as âncoras de TODOS os
   * passos estavam presentes no DOM nesse instante — a regra dura da story
   * §2.2. `lastStep` é o índice (0-based) do passo concluído, útil para quem
   * persiste `last_step`.
   *
   * Sair do tour antes disso (Esc, X, "Sair") NUNCA chama `onResolve`: a linha
   * permanece `armed` e o tour pode reaparecer depois, seja num novo mount
   * desta tela, seja pela afordância "Ver o guia do construtor" (story §2.3,
   * fora do escopo deste arquivo).
   */
  onResolve: (lastStep: number) => void
  /** Notifica cada mudança de passo, para quem quiser persistir `last_step` em tempo real. */
  onStepChange?: (step: number) => void
  /** Chamado quando a pessoa sai do tour antes de concluir (Esc, X, "Sair"). */
  onExit?: () => void
  /**
   * Rótulo do botão no último passo. Default "Concluir" — sobrescreva quando
   * o dataset tiver um CTA cujo próprio texto já nomeia a ação final (ver
   * `tour-balloon.tsx`).
   */
  finalLabel?: string
}

/**
 * Motor do tour guiado do construtor de jornada (`jornada-builder-tour`,
 * story §Fase 2).
 *
 * Seis passos numa tela não justificam uma dependência nova (nenhuma
 * biblioteca de tour existe no repositório, story §0.3, e nenhuma entra
 * aqui) — este componente é o motor inteiro: navegação, destaque da âncora
 * atual e a regra dura de resolução (§2.2), em ~150 linhas.
 */
export function TourHost({
  steps,
  initialStep = 0,
  onResolve,
  onStepChange,
  onExit,
  finalLabel,
}: TourHostProps) {
  const lastIndex = Math.max(steps.length - 1, 0)
  const [step, setStep] = useState(() => clamp(initialStep, 0, lastIndex))
  const [visible, setVisible] = useState(steps.length > 0)

  const current = steps[step]
  const anchorRect = useAnchorRect(current?.anchor)

  const goToStep = useCallback(
    (next: number) => {
      setStep(next)
      onStepChange?.(next)
    },
    [onStepChange],
  )

  const finish = useCallback(() => {
    // Regra dura (story §2.2): a resolução só acontece se TODAS as âncoras dos
    // passos existirem no DOM agora, não só a do passo atual. A mitigação
    // óbvia seria resolver mesmo faltando âncora — isso consumiria o
    // artefato na tela errada, e a invariante anti-reaparecimento nunca
    // deixaria o tour voltar quando a pessoa chegasse ao construtor de
    // verdade. Por isso o host fecha a UI (a pessoa pediu) mas só avisa o
    // chamador quando pode.
    const missing = steps
      .map((s) => s.anchor)
      .filter((anchor) => !document.querySelector(anchorSelector(anchor)))

    setVisible(false)

    if (missing.length > 0) {
      console.warn(`[TourHost] não resolvido — âncora(s) ausente(s) no DOM: ${missing.join(", ")}`)
      return
    }

    onResolve(step)
  }, [steps, step, onResolve])

  const exit = useCallback(() => {
    setVisible(false)
    onExit?.()
  }, [onExit])

  const next = useCallback(() => {
    if (step >= lastIndex) {
      finish()
      return
    }
    goToStep(step + 1)
  }, [step, lastIndex, finish, goToStep])

  const prev = useCallback(() => {
    if (step === 0) return
    goToStep(step - 1)
  }, [step, goToStep])

  useEffect(() => {
    if (!visible) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault()
        exit()
      } else if (event.key === "ArrowRight") {
        event.preventDefault()
        next()
      } else if (event.key === "ArrowLeft") {
        event.preventDefault()
        prev()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [visible, exit, next, prev])

  if (!visible || !current || typeof document === "undefined") return null

  return (
    <>
      {createPortal(
        <div aria-hidden="true" className="fixed inset-0 z-40 bg-black/45 dark:bg-black/65" />,
        document.body,
      )}
      {/* Decorativo: destaca a âncora do passo atual sem tocar o elemento real
          (este arquivo não é dono do DOM da âncora, story §6.1 do roteamento
          aplica o mesmo princípio de posse por arquivo). O anel vive em
          `anchor-spotlight.tsx` porque a aterrissagem do anúncio usa o MESMO —
          era uma cópia que faltou, e cópia que falta é cópia que diverge. */}
      <AnchorSpotlight rect={anchorRect} />
      <TourBalloon
        titulo={current.titulo}
        corpo={current.corpo}
        passo={step + 1}
        total={steps.length}
        anchorRect={anchorRect}
        onVoltar={step > 0 ? prev : undefined}
        onAvancar={next}
        onSair={exit}
        rotuloFinal={finalLabel}
      />
    </>
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}
