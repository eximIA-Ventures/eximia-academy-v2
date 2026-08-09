"use client"

// ---------------------------------------------------------------------------
// O anel que circula a âncora, compartilhado pelas DUAS superfícies que apontam
// para um controle real: o tour do construtor (`tour-host.tsx`) e a
// aterrissagem do anúncio (`announcement-host.tsx`).
//
// POR QUE COMPARTILHADO, e não a mesma string de classes escrita duas vezes: o
// defeito que este arquivo corrige nasceu exatamente da cópia que nunca foi
// feita. O tour tinha o anel; a aterrissagem, não — o balão pousava sobre a
// tabela "Meu ritmo" dizendo "é aqui que elas ficam" sem que nada ficasse
// destacado. Duas cópias divergem no primeiro ajuste de Tailwind; uma fonte só
// não tem como divergir.
//
// Decorativo por construção (`aria-hidden`, `pointer-events-none`, portal para
// o body): ele NÃO toca o DOM da âncora. Quem é dono do elemento destacado é a
// tela que o renderiza, nunca o onboarding — a mesma posse por arquivo que a
// story §2.2 aplica ao resto do motor.
// ---------------------------------------------------------------------------

import { createPortal } from "react-dom"

/**
 * Atributo estável do anel, pelo MESMO motivo que as âncoras usam atributo e
 * nunca classe/posição/texto (ver `ANCHORS` em `lib/onboarding/types.ts`): a
 * classe muda no próximo ajuste de Tailwind e levaria o teste junto, em
 * silêncio. Existe só para o teste poder afirmar "o anel está no caminho do
 * anúncio", então removê-lo é um ato deliberado que quebra um teste.
 */
export const SPOTLIGHT_ATTR = "data-onboarding-spotlight"

export interface AnchorSpotlightProps {
  /**
   * Retângulo já resolvido da âncora (ou da UNIÃO delas, quando o passo fala de
   * mais de um controle). `null` é estado legítimo — a âncora pode ainda não
   * existir no DOM —, e nesse caso nada é renderizado.
   */
  rect: DOMRect | null
}

export function AnchorSpotlight({ rect }: AnchorSpotlightProps) {
  if (!rect || typeof document === "undefined") return null

  return createPortal(
    <div
      aria-hidden="true"
      {...{ [SPOTLIGHT_ATTR]: "" }}
      className="pointer-events-none fixed z-[55] rounded-lg ring-4 ring-cerrado-500 ring-offset-4 ring-offset-white dark:ring-offset-black"
      style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
    />,
    document.body,
  )
}
