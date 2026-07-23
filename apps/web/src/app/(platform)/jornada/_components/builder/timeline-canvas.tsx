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
import { deriveDates, fmtDay, isoAtOffset, monthTicks, pctOf, segThickness } from "./journey-format"
import s from "./journey.module.css"

interface TimelineCanvasProps {
  context: JourneyCourseContext
  durations: number[]
  unit: JourneyUnit
  cascade: boolean
  /** dia de hoje relativo a T0 (0 no construtor draft; >0 na revisão). */
  nowDayOffset?: number
  /** hint pulsante ativo no 1º marco até o primeiro ajuste. */
  hintActive?: boolean
  onChange: (next: number[]) => void
  onFirstAdjust?: () => void
}

export function TimelineCanvas({
  context,
  durations,
  unit,
  cascade,
  nowDayOffset = 0,
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

  const { finalDeadlineDays, managerDeadlineDays, startDate, modules } = context
  const { spanDays, minDay } = trackView(finalDeadlineDays)
  const months = monthTicks(startDate, minDay, spanDays)
  const derived = deriveDates(startDate, durations)

  // refs "vivos" para o listener global de drag (anexado 1x, sem re-attach)
  const workingRef = useRef<number[]>(durations)
  const optsRef = useRef({ cascade, unit, finalDeadlineDays })
  const isVertRef = useRef(isVert)
  const onChangeRef = useRef(onChange)
  const onFirstAdjustRef = useRef(onFirstAdjust)
  const firedAdjustRef = useRef(false)
  const dragIndexRef = useRef<number | null>(null)
  workingRef.current = durations
  optsRef.current = { cascade, unit, finalDeadlineDays }
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
      let start = 0
      posPoint(todayRef.current, nowDayOffset, vert)
      posPoint(deadlineRef.current, finalDeadlineDays, vert)
      if (managerDeadlineDays != null) posPoint(metaRef.current, managerDeadlineDays, vert)
      months.forEach((m, i) => posPoint(monthRefs.current[i], m.dayOffset, vert))

      days.forEach((dd, i) => {
        const end = start + dd
        const th = segThickness(dd, maxD)
        const seg = segRefs.current[i]
        if (seg) {
          const p0 = pctOf(start, minDay, spanDays)
          const p1 = pctOf(end, minDay, spanDays)
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
        posPoint(dotRefs.current[i], end, vert)
        start = end
      })
    },
    [months, nowDayOffset, finalDeadlineDays, managerDeadlineDays, minDay, spanDays, posPoint],
  )

  // rótulo de duração ao vivo sobre o segmento em drag
  const updateDurLabel = useCallback(
    (i: number, days: number[]) => {
      const el = durRef.current
      if (!el) return
      let start = 0
      for (let k = 0; k < i; k++) start += days[k]
      const end = start + days[i]
      el.textContent = durationLabel(days[i], optsRef.current.unit)
      const mid = (pctOf(start, minDay, spanDays) + pctOf(end, minDay, spanDays)) / 2
      if (isVertRef.current) el.style.top = `${mid}%`
      else el.style.left = `${mid}%`
    },
    [minDay, spanDays],
  )

  // refs para o listener global usar sempre as versões mais recentes
  const layoutRef = useRef(layoutInto)
  const updateDurRef = useRef(updateDurLabel)
  layoutRef.current = layoutInto
  updateDurRef.current = updateDurLabel

  // relayout em toda mudança de durações/orientação/hoje (pré-paint)
  // biome-ignore lint/correctness/useExhaustiveDependencies: layoutInto cobre as deps
  useLayoutEffect(() => {
    layoutInto(durations)
  }, [durations, isVert, layoutInto])

  // orientação vertical no mobile (≤720px), como o matchMedia da demo
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)")
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
        optsRef.current.finalDeadlineDays,
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
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
    window.addEventListener("blur", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
      window.removeEventListener("blur", onUp)
    }
  }, [])

  function startDrag(e: React.PointerEvent, i: number) {
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
      {managerDeadlineDays != null && (
        <div ref={metaRef} className={s.metaFlag}>
          <span>Meta do gestor · {fmtDay(isoAtOffset(startDate, managerDeadlineDays))}</span>
        </div>
      )}
      <div ref={deadlineRef} className={s.deadline}>
        <span>Disponível até · {fmtDay(isoAtOffset(startDate, finalDeadlineDays))}</span>
      </div>
      <div ref={durRef} className={`${s.dur}${draggingActive ? ` ${s.show}` : ""}`} />

      {durations.map((_dd, i) => {
        const isOn = derived.endDays[i] <= nowDayOffset && nowDayOffset > 0
        const isHl = hoverIndex === i || dragIndex === i
        const mod = modules[i]
        return (
          <div
            key={mod?.chapterId ?? `seg-${i}`}
            ref={(el) => {
              segRefs.current[i] = el
            }}
            className={`${s.seg} ${i % 2 === 0 ? s.segA : s.segB}${isOn ? ` ${s.segOn}` : ""}${isHl ? ` ${s.segHl}` : ""}`}
          />
        )
      })}

      {durations.map((dd, i) => {
        const mod = modules[i]
        const refl = mod?.reflectionsExpected ?? 0
        const inter = mod?.interactionsExpected ?? 1
        const capLong = isVert || i === 0
        const showHint = hintActive && i === 0
        return (
          <div
            key={mod?.chapterId ?? `dot-${i}`}
            ref={(el) => {
              dotRefs.current[i] = el
            }}
            className={`${s.dot}${dragIndex === i ? ` ${s.dragging}` : ""}${showHint ? ` ${s.pulse}` : ""}`}
            data-idx={i}
            onPointerDown={(e) => startDrag(e, i)}
            onPointerEnter={() => setHoverIndex(i)}
            onPointerLeave={() => setHoverIndex((h) => (h === i ? null : h))}
          >
            <span className={s.dotNum}>{i + 1}</span>
            <span className={s.dotDate}>{fmtDay(derived.ends[i])}</span>
            <span className={`${s.cap} ${i % 2 === 0 ? s.capR1 : s.capR2}`}>
              <span className={s.capMeta}>
                <IconInter />
                {capLong ? `${inter} interação${inter === 1 ? "" : "es"} · ` : `${inter} · `}
                <IconRefl />
                <b>{refl}</b>
                {capLong ? " reflexões" : ""}
              </span>
            </span>
            <span className={s.tip}>
              <span className={s.tipName}>{mod?.title ?? `Módulo ${i + 1}`}</span>
              <span className={s.tipMeta}>
                <IconInter />
                {inter} interação{inter === 1 ? "" : "es"} · {refl} reflexões
              </span>
              <span className={s.tipMeta}>
                <IconClock />
                {fmtDay(derived.starts[i])} – {fmtDay(derived.ends[i])} · {durationLabel(dd, unit)}
              </span>
            </span>
            {showHint && <span className={s.dragGlyph}>⇔</span>}
          </div>
        )
      })}
    </div>
  )
}
