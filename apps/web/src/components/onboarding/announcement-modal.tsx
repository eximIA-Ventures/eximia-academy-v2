"use client"

/**
 * Modal de novidade — porta `ModalNovidade` do protótipo
 * (`app/dev/preview-feature-review/page.tsx`) para produção, preservando o
 * visual e os textos que já passaram pela revisão de copy e pelo aceite do
 * Hugo. Ver o contrato em `lib/onboarding/types.ts` e a story
 * `docs/stories/feat-onboarding-novidades-lancamento.md`.
 *
 * Duas diferenças deliberadas em relação ao protótipo, e por quê:
 *
 * 1. Sem alternador claro/escuro por prop: o tema vem de `useTheme()`
 *    (mesma fonte que o resto do app, `document.documentElement` por baixo),
 *    nunca de um booleano passado de fora.
 * 2. Acessibilidade real: `role="dialog"`, `aria-modal`, `aria-labelledby`,
 *    foco preso dentro do modal e `Esc` fecha. O protótipo não tinha nada
 *    disso porque não precisava — era um mock de revisão visual, não a peça
 *    que um leitor de tela vai encontrar em produção.
 */

import { useTheme } from "@/components/providers/theme-provider"
import type { AnnouncementPage } from "@/lib/onboarding/types"
import { ArrowLeft, ArrowRight, CalendarDays, Footprints, Sparkles, Target, X } from "lucide-react"
import { useEffect, useId, useRef } from "react"

// ---------------------------------------------------------------------------
// Superfície — gradiente com croma baixo. No protótipo, croma alto no tema
// escuro "borrão marrom"; os dois blocos abaixo são o resultado já corrigido.
// ---------------------------------------------------------------------------

function surfaceStyle(dark: boolean) {
  return dark
    ? {
        backgroundImage:
          "linear-gradient(135deg, oklch(0.31 0.014 48) 0%, oklch(0.27 0.011 42) 55%, oklch(0.24 0.009 38) 100%)",
      }
    : {
        backgroundImage:
          "linear-gradient(135deg, oklch(0.24 0.03 45) 0%, oklch(0.19 0.025 40) 55%, oklch(0.16 0.02 35) 100%)",
      }
}

const borda = (dark: boolean) => (dark ? "border border-white/[0.16]" : "border border-white/10")

const ACCENT = {
  background:
    "linear-gradient(90deg, oklch(0.78 0.16 60) 0%, oklch(0.72 0.18 45) 45%, oklch(0.64 0.17 30) 100%)",
}

const TXT = "text-white/70"
const TXT_SOFT = "text-white/55"

const CARTAO = (dark: boolean) =>
  dark
    ? "rounded-lg border border-white/[0.14] bg-white/[0.08] px-3 py-2.5"
    : "rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2.5"

// ---------------------------------------------------------------------------
// Cartões — o par de números que ilustra a novidade, quando ela tem um.
// ---------------------------------------------------------------------------

function Cartoes({
  tipo,
  dark,
}: {
  tipo: NonNullable<AnnouncementPage["cartoes"]>
  dark: boolean
}) {
  const itens =
    tipo === "percorrido"
      ? [
          {
            Icon: Footprints,
            t: "Percorrido",
            d: "Conta quando você chega ao último slide.",
            v: "100%",
          },
          {
            Icon: Target,
            t: "Conclusão",
            d: 'Conta quando você clica em "Módulo Concluído".',
            v: "50%",
          },
        ]
      : [
          { Icon: CalendarDays, t: "Você escolhe", d: "Quantos dias dar a cada módulo.", v: "" },
          {
            Icon: Target,
            t: "A tela calcula",
            d: "A data de cada módulo, dentro do prazo.",
            v: "",
          },
        ]

  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {itens.map(({ Icon, t, d, v }) => (
        <div key={t} className={CARTAO(dark)}>
          <div className="mb-1 flex items-center justify-between">
            <span className="inline-flex items-center gap-2 font-semibold text-sm text-white">
              <Icon size={15} className="text-cerrado-300" />
              {t}
            </span>
            {v && <span className="font-bold text-cerrado-200 text-sm tabular-nums">{v}</span>}
          </div>
          <p className={`text-[13px] leading-relaxed ${TXT_SOFT}`}>{d}</p>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// AnnouncementModal
// ---------------------------------------------------------------------------

export interface AnnouncementModalProps {
  /** A tela atual do artefato. N1 tem 1 tela, N2 tem 3. */
  pagina: AnnouncementPage
  /** Passo atual, base 1. */
  passo: number
  /** Total de telas do artefato — controla se os pontos de paginação aparecem. */
  total: number
  /** Selo do topo, ex. "Novidade 1 de 2". */
  selo: string
  /** Avança para a próxima tela, ou resolve o artefato na última. */
  onAvancar: () => void
  /** Volta uma tela. Omitir na primeira tela — o protótipo não mostra "Voltar" ali. */
  onVoltar?: () => void
  /** Fecha o modal — X, Esc, e o link de pular, os três caminhos. */
  onPular: () => void
  /**
   * Rótulo do link de pular. Parametrizado porque muda entre artefatos:
   * "Pular" na primeira novidade, "Deixar para depois" na segunda.
   */
  rotuloPular: string
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function AnnouncementModal({
  pagina,
  passo,
  total,
  selo,
  onAvancar,
  onVoltar,
  onPular,
  rotuloPular,
}: AnnouncementModalProps) {
  const { resolved } = useTheme()
  const dark = resolved === "dark"
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)

  // onPular muda de identidade a cada render do pai (é um closure sobre o
  // índice da tela). O efeito de foco/teclado abaixo roda uma vez por
  // montagem — este ref é o jeito de o handler sempre chamar a versão mais
  // recente sem precisar recriar os listeners a cada tela.
  const onPularRef = useRef(onPular)
  useEffect(() => {
    onPularRef.current = onPular
  }, [onPular])

  // Foco preso dentro do modal, Esc fecha, e o foco volta a quem estava
  // focado antes de abrir. Roda uma vez por montagem: o mesmo componente é
  // reaproveitado entre telas do mesmo artefato (o pai só troca `pagina`),
  // então isto não rouba o foco a cada "avançar".
  useEffect(() => {
    const container = dialogRef.current
    const previouslyFocused = document.activeElement as HTMLElement | null
    container?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault()
        onPularRef.current()
        return
      }
      if (event.key !== "Tab" || !container) return
      const focusables = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault()
          last.focus()
        }
      } else if (document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [])

  return (
    <>
      {/* O véu cobre a JANELA inteira (fixed inset-0), nunca só o cartão —
          ancorado no cartão, só ele escurece, e no tema claro isso lê como
          erro de render, não como um modal. */}
      <div className={`fixed inset-0 z-40 ${dark ? "bg-black/70" : "bg-black/50"}`} />
      <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto p-6">
        <div
          ref={dialogRef}
          style={surfaceStyle(dark)}
          className={`relative w-full max-w-2xl overflow-hidden rounded-2xl shadow-2xl outline-none ${borda(dark)}`}
          // biome-ignore lint/a11y/useSemanticElements: <dialog> exigiria controle imperativo (showModal/close) incompatível com a montagem condicional deste componente pelo pai; role="dialog" + foco preso manual (abaixo) cobrem a mesma semântica.
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
        >
          <div className="h-1" style={ACCENT} />
          <div className="relative p-7">
            {/* <img>, não next/image: noodle é SVG decorativo de tamanho fixo em
                public/noodles/, e next/image não otimiza SVG sem
                `dangerouslyAllowSVG` em next.config.ts — fora do escopo deste
                componente (pertence a quem possui o next.config.ts). A regra
                nursery/noImgElement não está habilitada em biome.json, então
                isto é comentário informativo, não uma supressão de lint. */}
            <img
              src={pagina.noodle}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute top-14 right-5 hidden h-36 w-36 opacity-95 sm:block"
            />

            <div className="mb-4 flex items-start justify-between gap-4">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cerrado-400/30 bg-cerrado-400/12 px-3 py-1 font-semibold text-[11px] text-cerrado-200 uppercase tracking-wider">
                <Sparkles size={12} /> {selo}
              </span>
              <button
                type="button"
                onClick={onPular}
                aria-label="Fechar"
                className="rounded-lg p-1.5 text-white/45 hover:bg-white/10 hover:text-white/90"
              >
                <X size={17} />
              </button>
            </div>

            <div className="min-h-[104px] sm:pr-40">
              <h4 id={titleId} className="font-bold text-white text-xl leading-snug">
                {pagina.titulo}
              </h4>
              <p className={`mt-2 text-sm leading-relaxed ${TXT}`}>{pagina.corpo}</p>
            </div>

            {pagina.cartoes && (
              <div className="mt-4">
                <Cartoes tipo={pagina.cartoes} dark={dark} />
              </div>
            )}
            {pagina.destaque && (
              <div className="mt-4 rounded-xl border border-cerrado-400/25 bg-cerrado-400/[0.09] px-4 py-3">
                <p className={`text-sm leading-relaxed ${TXT}`}>
                  <span className="font-semibold text-white">No seu caso:</span> {pagina.destaque}
                </p>
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              {/* Pontos só quando há mais de uma página. Um ponto solitário é
                  ruído: anuncia uma navegação que não existe. */}
              <div className="flex items-center gap-1.5">
                {/* biome-ignore lint/suspicious/noArrayIndexKey: os pontos são posições fixas (1..total), sem reordenação — o índice É a identidade. */}
                {total > 1 &&
                  Array.from({ length: total }, (_, k) => (
                    <span
                      key={`d${k}`}
                      className={
                        k === passo - 1
                          ? "h-1.5 w-5 rounded-full bg-cerrado-400"
                          : "h-1.5 w-1.5 rounded-full bg-white/25"
                      }
                    />
                  ))}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onPular}
                  className={`text-sm hover:text-white ${TXT_SOFT}`}
                >
                  {rotuloPular}
                </button>
                {onVoltar && (
                  <button
                    type="button"
                    onClick={onVoltar}
                    className={`inline-flex items-center gap-1 text-sm hover:text-white ${TXT_SOFT}`}
                  >
                    <ArrowLeft size={13} /> Voltar
                  </button>
                )}
                <button
                  type="button"
                  onClick={onAvancar}
                  className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-semibold text-sm text-white shadow-lg"
                  style={ACCENT}
                >
                  {pagina.botao} <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
