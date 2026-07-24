"use client"

// ---------------------------------------------------------------------------
// EPIC-JORNADA (JRN-C.1, Trilha C) — Hub "Minhas jornadas" (SPEC round 15).
// ---------------------------------------------------------------------------
// Tela de seleção: cabeçalho presente + cards grandes das matrículas reais.
// Jornada ativa → dashboard; sem jornada → convite; concluída → estado
// celebrado. Terminologia SEMPRE "jornada".
//
// JRN-D+ (genjutsu-cast, dialeto Coreografia) — vida e hierarquia:
//   • coluna CONTIDA e centrada (max-w-2xl) — fim do card magro no vazio;
//   • cabeçalho com eyebrow + título maior + subtítulo com contagem real;
//   • cards mais altos e táteis, medalhão maior, textura de fundo por status;
//   • entrada orquestrada header → subtítulo → cards em stagger (≤450ms janela);
//   • barra preenche do zero na carga (motion.module.css @starting-style);
//   • hover Apple-like (lift 2px + sombra + nudge da seta); só transform/opacity;
//   • prefers-reduced-motion desliga tudo (motion.module.css).
// ---------------------------------------------------------------------------

import { ArrowRight, CheckCircle2, Compass, Sparkles } from "lucide-react"
import styles from "../dashboard/motion.module.css"
import type { HubCard } from "./hub-model"

// Janela de stagger contida: header (0) → subtítulo (70) → cards a partir de 130,
// +55ms cada, com o índice de stagger travado em 5 (o resto entra junto). O
// último card animado começa em ≤405ms — dentro do orçamento de ~450ms.
const HEADER_DELAY = 0
const SUBTITLE_DELAY = 70
const CARDS_BASE_DELAY = 130
const CARD_STAGGER = 55
const MAX_STAGGER_INDEX = 5

const cardDelay = (i: number) => CARDS_BASE_DELAY + Math.min(i, MAX_STAGGER_INDEX) * CARD_STAGGER

export function JourneyHub({
  cards,
  onOpen,
  onBack,
}: {
  cards: HubCard[]
  /** JRN-D — abre o curso do card (courseId). O destino (dashboard/construtor)
   *  é decidido pelo roteador SSR a partir do ?curso=. */
  onOpen: (courseId: string) => void
  /** JRN-D+ — saída do hub para a home ("Meu ritmo" / /dashboard). Sem isto o
   *  aluno fica preso no topo do /jornada (bug reportado pelo Hugo 2026-07-24). */
  onBack?: () => void
}) {
  const count = cards.length
  const subtitle =
    count === 1
      ? "Você tem 1 jornada. Escolha para acompanhar o combinado × o realizado."
      : `Você tem ${count} jornadas. Escolha qual acompanhar.`
  // rodapé honesto (só quando há cards) entra logo após o último card animado.
  const footnoteDelay = cardDelay(count - 1) + 60

  return (
    <div
      data-mo="enter"
      data-testid="journey-hub"
      className="mx-auto max-w-2xl px-4 pb-24 pt-8 sm:px-6"
    >
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className={`${styles.rise} mb-5 inline-flex items-center gap-1 text-sm font-medium text-text-secondary transition-colors hover:text-cerrado-500`}
        >
          ‹ Meu ritmo
        </button>
      )}
      <header>
        <div className={styles.rise} style={{ animationDelay: `${HEADER_DELAY}ms` }}>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-cerrado-500">
            <Compass size={13} aria-hidden="true" />
            Meu aprendizado
          </span>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
            Minhas jornadas
          </h1>
        </div>
        {count > 0 && (
          <p
            className={`${styles.rise} mt-2 max-w-md text-sm leading-relaxed text-text-muted`}
            style={{ animationDelay: `${SUBTITLE_DELAY}ms` }}
          >
            {subtitle}
          </p>
        )}
      </header>

      <div className="mt-7 grid grid-cols-1 gap-4">
        {cards.map((card, i) => (
          <HubCardView
            key={card.enrollmentId}
            card={card}
            delay={cardDelay(i)}
            // JRN-D — todo card agora abre o SEU curso (antes: só o ativo abria e
            // os demais davam um toast de workaround; a rota por-curso resolve).
            onClick={() => onOpen(card.courseId)}
          />
        ))}
        {count === 0 && (
          <div
            className={`${styles.rise} rounded-2xl border border-dashed border-border-medium bg-bg-elevated/40 px-6 py-12 text-center`}
            style={{ animationDelay: `${CARDS_BASE_DELAY}ms` }}
          >
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-card text-text-muted ring-1 ring-border-subtle">
              <Compass size={24} aria-hidden="true" />
            </span>
            <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-text-muted">
              Você ainda não tem uma jornada. Assim que for inscrito em um curso, ela aparece aqui.
            </p>
          </div>
        )}
      </div>

      {count > 0 && (
        <p
          className={`${styles.rise} mt-6 flex items-start gap-2 text-xs leading-relaxed text-text-muted`}
          style={{ animationDelay: `${footnoteDelay}ms` }}
        >
          <Sparkles size={14} aria-hidden="true" className="mt-0.5 flex-none text-cerrado-500/70" />
          <span>
            Cada jornada acompanha o que você combinou × o que realizou. Abra uma para ver o ritmo,
            os prazos e a leitura da IA.
          </span>
        </p>
      )}
    </div>
  )
}

function HubCardView({
  card,
  delay,
  onClick,
}: {
  card: HubCard
  delay: number
  onClick: () => void
}) {
  const done = card.status === "completed"
  const active = card.status === "active"
  // cor de acento por status, usada na textura de fundo (radial estático) e nos
  // realces. Tokens da casa (cerrado / semantic-success / text-muted).
  const accent = done
    ? "var(--color-semantic-success)"
    : active
      ? "var(--color-cerrado-500)"
      : "var(--color-text-muted)"

  return (
    <button
      type="button"
      data-testid="hub-card"
      data-status={card.status}
      onClick={onClick}
      style={{ animationDelay: `${delay}ms` }}
      className={`${styles.rise} ${styles.lift} ${styles.press} group relative flex items-center gap-4 overflow-hidden rounded-2xl border bg-bg-card p-6 text-left shadow-card ${
        done
          ? "border-semantic-success/30"
          : active
            ? "border-cerrado-600/30"
            : "border-border-subtle"
      }`}
    >
      {/* Textura de fundo por status: radial estático, sutilíssimo, decorativo.
          Preenche o espaço interno sem inventar dado. Não anima. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-6 -top-8 h-32 w-32 rounded-full opacity-[0.07] blur-2xl"
        style={{ background: accent }}
      />

      <span
        className={`flex h-14 w-14 flex-none items-center justify-center rounded-2xl ring-1 ${
          done
            ? "bg-semantic-success/12 text-semantic-success ring-semantic-success/20"
            : active
              ? "bg-cerrado-600/12 text-cerrado-500 ring-cerrado-600/20"
              : "bg-bg-elevated text-text-muted ring-border-subtle"
        }`}
      >
        {done ? (
          <CheckCircle2 size={26} aria-hidden="true" />
        ) : active ? (
          <Sparkles size={26} aria-hidden="true" />
        ) : (
          <Compass size={26} aria-hidden="true" />
        )}
      </span>

      <div className="relative min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-lg font-bold text-text-primary">
            {card.courseTitle}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              done
                ? "bg-semantic-success/14 text-semantic-success"
                : active
                  ? "bg-cerrado-600/13 text-cerrado-500"
                  : "bg-text-muted/12 text-text-secondary"
            }`}
          >
            {card.chipLabel}
          </span>
        </div>
        <div className="mt-3.5 h-2.5 overflow-hidden rounded-full border border-border-subtle bg-bg-elevated">
          <span
            className={`${styles.barFill} block h-full rounded-full ${done ? "bg-semantic-success" : "bg-cerrado-600"}`}
            style={{ transform: `scaleX(${card.progressPct / 100})` }}
          />
        </div>
        <div className="mt-2 text-xs font-medium text-text-secondary">
          {card.progressPct}% concluído
        </div>
      </div>

      <ArrowRight
        size={18}
        aria-hidden="true"
        className="relative flex-none text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-cerrado-500"
      />
    </button>
  )
}
