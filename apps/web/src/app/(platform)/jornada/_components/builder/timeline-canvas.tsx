"use client"

// ---------------------------------------------------------------------------
// EPIC-JORNADA — Timeline arrastável (Trilha B). Porte fiel do motor v2 da demo
// (app.js: buildTimeline/layout/startDrag/pointermove/endDrag). Regra dura da
// casa (SPEC round 18): a posição do marco em drag é atribuída SÍNCRONA por
// `style` em CADA pointermove (nunca dependente de rAF) — `layoutInto()` roda
// direto no handler; o easing de snap é só polimento CSS por cima. Toda a regra
// de negócio (cascata, snap, teto duro) vem de `timeline-engine.ts` (puro).
//
// Divisão React × imperativo: o TEXTO (número, data, caps, tips) é renderizado
// por React a partir de `durations`; a POSIÇÃO (left/top/width/height %) é
// escrita imperativamente por `layoutInto()` — o JSX NUNCA seta `style` nesses
// nós, então re-render não pisa nas posições. Classes modificadoras (.dragging/
// .hl/.snap/.on) vêm de estado React (persistem no re-render do drag).
//
// JRN-E (Trilha E2) — com progresso, o eixo do trilho passa a ser "dias de
// trilho" (`trackLayout`, journey-format): o módulo concluído ocupa largura
// visual in loco, para existir como marco e preservar a ORDEM mesmo com buraco
// no meio (o aluno real tem 0,1,2,4 concluídos e o 3 intocado), sem consumir um
// único dia do orçamento. O teto duro fica em `deadlineTrack` e continua
// inviolável. A régua de meses some quando há concluídos: o eixo deixa de ser
// linear em dias, e um rótulo de mês ali seria mentira.
// ---------------------------------------------------------------------------

import {
  applyDrag,
  clamp,
  desiredDaysFromRatio,
  durationLabel,
  trackView,
} from "@/lib/journey/timeline-engine"
import type { JourneyCourseContext, JourneyUnit } from "@/lib/journey/types"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { IconClock, IconInter, IconRefl } from "./icons"
import {
  type JourneyWindow,
  anchoredDates,
  declutterPx,
  fmtDay,
  monthTicks,
  pctOf,
  progressOf,
  segThickness,
  trackLayout,
} from "./journey-format"
import s from "./journey.module.css"

// JRN-E — espaçamento mínimo, em pixels reais, entre marcos concluídos (e
// entre o último concluído e o 1º marco vivo) — ver declutterPx/layoutInto
// abaixo. Calibrado pelo rótulo mais largo do marco travado ("concluído",
// letter-spacing incluso), não só pelo círculo: um círculo pode caber e o
// texto embaixo colidir mesmo assim.
const MIN_FROZEN_GAP_PX = 52

interface TimelineCanvasProps {
  context: JourneyCourseContext
  durations: number[]
  unit: JourneyUnit
  cascade: boolean
  /** JRN-E — janela restante (âncora, teto de coorte, quem trava). */
  window: JourneyWindow
  /** hint pulsante ativo no 1º marco vivo até o primeiro ajuste. */
  hintActive?: boolean
  onChange: (next: number[]) => void
  onFirstAdjust?: () => void
}

export function TimelineCanvas({
  context,
  durations,
  unit,
  cascade,
  window: win,
  hintActive = false,
  onChange,
  onFirstAdjust,
}: TimelineCanvasProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const segRefs = useRef<(HTMLDivElement | null)[]>([])
  const dotRefs = useRef<(HTMLDivElement | null)[]>([])
  const durRef = useRef<HTMLDivElement>(null)
  const todayRef = useRef<HTMLDivElement>(null)
  const metaRef = useRef<HTMLDivElement>(null)
  const deadlineRef = useRef<HTMLDivElement>(null)
  const monthRefs = useRef<(HTMLDivElement | null)[]>([])

  const [isVert, setIsVert] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const { finalDeadlineDays, modules } = context

  const { frozen, anchorDate, remainingDays, managerRemainingDays } = win
  // JRN-E — índice do 1º marco vivo. Usado no hint de arraste (fim do
  // arquivo) e como âncora do declutter em pixel (layoutInto abaixo): o marco
  // vivo representa uma DATA real e o declutter nunca o move.
  const firstLive = frozen.findIndex((f) => !f)
  const layout = trackLayout(durations, frozen, remainingDays, managerRemainingDays)
  const { spanDays, minDay } = trackView(layout.deadlineTrack)
  // Eixo warpado pelos concluídos: sem meses (rótulo em eixo não-linear mente).
  const months = layout.frozenTrack > 0 ? [] : monthTicks(anchorDate, minDay, spanDays)
  const derived = anchoredDates(durations, win)

  const deadlineIso = win.cohortDeadlineDate
  const metaIso = win.cohortManagerDeadlineDate
  const showMeta = metaIso != null && layout.metaTrack != null

  // refs "vivos" para o listener global de drag (anexado 1x, sem re-attach)
  const workingRef = useRef<number[]>(durations)
  const optsRef = useRef({ cascade, unit, finalDeadlineDays, window: win })
  const isVertRef = useRef(isVert)
  const onChangeRef = useRef(onChange)
  const onFirstAdjustRef = useRef(onFirstAdjust)
  const firedAdjustRef = useRef(false)
  const dragIndexRef = useRef<number | null>(null)
  workingRef.current = durations
  optsRef.current = { cascade, unit, finalDeadlineDays, window: win }
  isVertRef.current = isVert
  onChangeRef.current = onChange
  onFirstAdjustRef.current = onFirstAdjust

  // posiciona um ponto (marco/hoje/meta/prazo/mês) por dayOffset
  const posPoint = useCallback(
    (el: HTMLElement | null, dayOffset: number, vert: boolean) => {
      if (!el) return
      const p = pctOf(dayOffset, minDay, spanDays)
      if (vert) {
        el.style.top = `${p}%`
        el.style.left = ""
      } else {
        el.style.left = `${p}%`
        el.style.top = ""
      }
    },
    [minDay, spanDays],
  )

  // escreve TODAS as posições a partir de um array de durações (imperativo)
  const layoutInto = useCallback(
    (days: number[]) => {
      const track = trackRef.current
      if (!track) return
      const vert = isVertRef.current
      const maxD = Math.max(...days)
      const lay = trackLayout(days, frozen, remainingDays, managerRemainingDays)
      posPoint(todayRef.current, lay.todayTrack, vert)
      posPoint(deadlineRef.current, lay.deadlineTrack, vert)
      if (lay.metaTrack != null) posPoint(metaRef.current, lay.metaTrack, vert)
      months.forEach((m, i) => posPoint(monthRefs.current[i], m.dayOffset, vert))

      days.forEach((dd, i) => {
        const th = segThickness(dd, maxD)
        const seg = segRefs.current[i]
        if (seg) {
          const p0 = pctOf(lay.starts[i], minDay, spanDays)
          const p1 = pctOf(lay.ends[i], minDay, spanDays)
          if (vert) {
            seg.style.top = `${p0}%`
            seg.style.height = `${p1 - p0}%`
            seg.style.left = ""
            seg.style.width = `${th}px`
          } else {
            seg.style.left = `${p0}%`
            seg.style.width = `${p1 - p0}%`
            seg.style.top = ""
            seg.style.height = `${th}px`
          }
        }
        posPoint(dotRefs.current[i], lay.ends[i], vert)
      })

      // JRN-E — 2º passe, em PIXELS reais (não %): o dia-de-trilho é
      // resolução-agnóstico, mas o círculo/rótulo do marco tem largura FIXA,
      // então só o pixel real sabe se dois concluídos colidem. Nunca move o
      // 1º marco vivo (`firstLive`) — a posição dele É uma data real.
      const size = vert ? track.clientHeight : track.clientWidth
      const frozenOrder: number[] = []
      frozen.forEach((f, i) => {
        if (f) frozenOrder.push(i)
      })
      if (size > 0 && frozenOrder.length > 0) {
        const naturalPx = frozenOrder.map((i) => {
          const el = dotRefs.current[i]
          const raw = el ? (vert ? el.style.top : el.style.left) : ""
          return (Number.parseFloat(raw || "0") / 100) * size
        })
        const firstLiveEl = firstLive >= 0 ? dotRefs.current[firstLive] : null
        const firstLiveRaw = firstLiveEl ? (vert ? firstLiveEl.style.top : firstLiveEl.style.left) : ""
        const ceilingPx = firstLiveEl
          ? (Number.parseFloat(firstLiveRaw || "0") / 100) * size - MIN_FROZEN_GAP_PX
          : null
        const declut = declutterPx(naturalPx, MIN_FROZEN_GAP_PX, ceilingPx)
        frozenOrder.forEach((i, k) => {
          const el = dotRefs.current[i]
          if (!el) return
          const p = (declut[k] / size) * 100
          if (vert) el.style.top = `${p}%`
          else el.style.left = `${p}%`
        })
      }
    },
    [months, frozen, remainingDays, managerRemainingDays, minDay, spanDays, posPoint, firstLive],
  )

  // rótulo de duração ao vivo sobre o segmento em drag
  const updateDurLabel = useCallback(
    (i: number, days: number[]) => {
      const el = durRef.current
      if (!el) return
      const lay = trackLayout(days, frozen, remainingDays, managerRemainingDays)
      el.textContent = durationLabel(days[i], optsRef.current.unit)
      const mid =
        (pctOf(lay.starts[i], minDay, spanDays) + pctOf(lay.ends[i], minDay, spanDays)) / 2
      if (isVertRef.current) el.style.top = `${mid}%`
      else el.style.left = `${mid}%`
    },
    [minDay, spanDays, frozen, remainingDays, managerRemainingDays],
  )

  // refs para o listener global usar sempre as versões mais recentes
  const layoutRef = useRef(layoutInto)
  const updateDurRef = useRef(updateDurLabel)
  const trackStartsRef = useRef<number[]>(layout.starts)
  const deadlineTrackRef = useRef<number>(layout.deadlineTrack)
  layoutRef.current = layoutInto
  updateDurRef.current = updateDurLabel
  trackStartsRef.current = layout.starts
  deadlineTrackRef.current = layout.deadlineTrack

  // relayout em toda mudança de durações/orientação/hoje (pré-paint)
  // biome-ignore lint/correctness/useExhaustiveDependencies: layoutInto cobre as deps
  useLayoutEffect(() => {
    layoutInto(durations)
  }, [durations, isVert, layoutInto])

  // orientação vertical no mobile (≤720px), como o matchMedia da demo
  useEffect(() => {
    const mq = globalThis.matchMedia("(max-width: 720px)")
    const apply = () => {
      setIsVert(mq.matches)
      const t = trackRef.current
      if (t) t.style.height = mq.matches ? `${modules.length * 90 + 60}px` : ""
    }
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [modules.length])

  // listeners globais de drag — anexados UMA vez (leem refs vivos)
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const i = dragIndexRef.current
      if (i == null) return
      const track = trackRef.current
      if (!track) return
      const rect = track.getBoundingClientRect()
      const vert = isVertRef.current
      const ratio = vert
        ? clamp((e.clientY - rect.top) / rect.height, 0, 1)
        : clamp((e.clientX - rect.left) / rect.width, 0, 1)
      const desired = desiredDaysFromRatio(
        workingRef.current,
        i,
        ratio,
        deadlineTrackRef.current,
        trackStartsRef.current,
      )
      const next = applyDrag(workingRef.current, i, desired, optsRef.current)
      workingRef.current = next
      // REGRA DURA: posição escrita SÍNCRONA aqui, nunca em rAF
      layoutRef.current(next)
      updateDurRef.current(i, next)
      if (!firedAdjustRef.current) {
        firedAdjustRef.current = true
        onFirstAdjustRef.current?.()
      }
      onChangeRef.current(next)
    }
    const onUp = () => {
      if (dragIndexRef.current == null) return
      dragIndexRef.current = null
      setDragIndex(null)
    }
    globalThis.addEventListener("pointermove", onMove)
    globalThis.addEventListener("pointerup", onUp)
    globalThis.addEventListener("pointercancel", onUp)
    globalThis.addEventListener("blur", onUp)
    return () => {
      globalThis.removeEventListener("pointermove", onMove)
      globalThis.removeEventListener("pointerup", onUp)
      globalThis.removeEventListener("pointercancel", onUp)
      globalThis.removeEventListener("blur", onUp)
    }
  }, [])

  function startDrag(e: React.PointerEvent, i: number) {
    // AC-E2.1 — módulo concluído não tem alça: nem inicia arraste.
    if (frozen[i]) return
    e.preventDefault()
    firedAdjustRef.current = false
    dragIndexRef.current = i
    workingRef.current = durations
    setDragIndex(i)
    updateDurLabel(i, durations)
  }

  const draggingActive = dragIndex != null

  return (
    <div
      ref={trackRef}
      className={`${s.track}${isVert ? ` ${s.vert}` : ""}${draggingActive && unit === "w" ? ` ${s.snap}` : ""}`}
      data-testid="jornada-timeline"
    >
      <div className={s.line} />

      {months.map((m, i) => (
        <div
          key={`m-${m.dayOffset}`}
          ref={(el) => {
            monthRefs.current[i] = el
          }}
          className={s.month}
        >
          <span>{m.label}</span>
        </div>
      ))}

      <div ref={todayRef} className={s.today}>
        <span>hoje</span>
      </div>
      {showMeta && (
        <div ref={metaRef} className={s.metaFlag}>
          <span>Meta do gestor · {fmtDay(metaIso as string)}</span>
        </div>
      )}
      <div ref={deadlineRef} className={`${s.deadline}${win.expired ? ` ${s.deadlineOver}` : ""}`}>
        <span>
          {win.expired ? "Prazo vencido · " : "Disponível até · "}
          {fmtDay(deadlineIso)}
        </span>
      </div>
      <div ref={durRef} className={`${s.dur}${draggingActive ? ` ${s.show}` : ""}`} />

      {durations.map((_dd, i) => {
        const isDone = frozen[i]
        const isHl = hoverIndex === i || dragIndex === i
        const mod = modules[i]
        return (
          <div
            key={mod?.chapterId ?? `seg-${i}`}
            ref={(el) => {
              segRefs.current[i] = el
            }}
            className={`${s.seg} ${i % 2 === 0 ? s.segA : s.segB}${isDone ? ` ${s.segFrozen}` : ""}${isHl ? ` ${s.segHl}` : ""}`}
          />
        )
      })}

      {durations.map((dd, i) => {
        const mod = modules[i]
        const prog = progressOf(mod)
        const refl = mod?.reflectionsExpected ?? 0
        const inter = mod?.interactionsExpected ?? 1
        const capLong = isVert || i === 0
        const isFrozen = frozen[i]
        const showHint = hintActive && i === firstLive && !isFrozen
        return (
          <div
            key={mod?.chapterId ?? `dot-${i}`}
            ref={(el) => {
              dotRefs.current[i] = el
            }}
            className={`${s.dot}${isFrozen ? ` ${s.dotFrozen}` : ""}${dragIndex === i ? ` ${s.dragging}` : ""}${showHint ? ` ${s.pulse}` : ""}`}
            data-idx={i}
            data-frozen={isFrozen ? "true" : undefined}
            onPointerDown={(e) => startDrag(e, i)}
            onPointerEnter={() => setHoverIndex(i)}
            onPointerLeave={() => setHoverIndex((h) => (h === i ? null : h))}
          >
            <span className={s.dotNum}>{i + 1}</span>
            <span className={s.dotDate}>
              {isFrozen ? "concluído" : fmtDay(derived.ends[i] as string)}
            </span>
            {/* JRN-E — legenda de interação/reflexão só no marco VIVO: no
                concluído ela colidia com a do vizinho (marco travado é bem
                mais compacto). O detalhe segue disponível no hover (.tip
                abaixo) e na tabela "Seus módulos, em detalhe". */}
            {!isFrozen && (
              <span className={`${s.cap} ${i % 2 === 0 ? s.capR1 : s.capR2}`}>
                <span className={s.capMeta}>
                  <IconInter />
                  {capLong ? `${inter} interação${inter === 1 ? "" : "es"} · ` : `${inter} · `}
                  <IconRefl />
                  <b>{refl}</b>
                  {capLong ? " reflexões" : ""}
                </span>
              </span>
            )}
            <span className={s.tip}>
              <span className={s.tipName}>{mod?.title ?? `Módulo ${i + 1}`}</span>
              <span className={s.tipMeta}>
                <IconInter />
                {prog ? `${prog.sessionsDone}/${inter}` : inter} interação
                {inter === 1 ? "" : "es"} · {prog ? `${prog.reflectionsDone}/${refl}` : refl}{" "}
                reflexões
              </span>
              <span className={s.tipMeta}>
                <IconClock />
                {isFrozen ? (
                  "concluído · não consome prazo"
                ) : (
                  <>
                    {fmtDay(derived.starts[i] as string)} – {fmtDay(derived.ends[i] as string)} ·{" "}
                    {durationLabel(dd, unit)}
                  </>
                )}
              </span>
            </span>
            {showHint && <span className={s.dragGlyph}>⇔</span>}
          </div>
        )
      })}
    </div>
  )
}
