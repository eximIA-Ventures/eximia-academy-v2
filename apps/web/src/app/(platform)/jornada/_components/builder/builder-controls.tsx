"use client"

// EPIC-JORNADA — Controles do construtor (Trilha B): dropdown "✨ Sugerir
// jornada" (presets clampados ao teto), switch "Auto-ajuste" (cascata on/off),
// segmentado "Semanas | Dias". Portados de openSuggest/autoSwitch/us-btn da demo.

import type { RemainingWindow } from "@/lib/journey/plan-math"
import { JOURNEY_PRESETS, presetConsequence, presetDurations } from "@/lib/journey/timeline-engine"
import type { JourneyUnit } from "@/lib/journey/types"
import { ANCHORS, anchor } from "@/lib/onboarding/types"
import { useEffect, useRef, useState } from "react"
import s from "./journey.module.css"

// --- Sugerir jornada -------------------------------------------------------

interface SuggestDropdownProps {
  base: number[]
  finalDeadlineDays: number
  activePreset: number | null
  /** JRN-E — os presets distribuem SÓ sobre os módulos que faltam, dentro da
   *  janela restante. Ausente = aluno em dia 0 (comportamento antigo). */
  window?: RemainingWindow
  onApply: (durations: number[], factor: number) => void
}

export function SuggestDropdown({
  base,
  finalDeadlineDays,
  activePreset,
  window: win,
  onApply,
}: SuggestDropdownProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("click", onDocClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("click", onDocClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div className={s.suggestWrap} ref={wrapRef}>
      <button
        type="button"
        className={s.btnSuggest}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
      >
        ✨ Sugerir jornada
      </button>
      {open && (
        <div className={s.sgMenu} role="menu">
          {JOURNEY_PRESETS.map(({ factor, label }) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              className={`${s.sgItem}${activePreset === factor ? ` ${s.sgItemOn}` : ""}`}
              onClick={() => {
                setOpen(false)
                onApply(presetDurations(base, factor, finalDeadlineDays, win), factor)
              }}
            >
              <b>{label}</b>
              <span>{presetConsequence(base, factor, finalDeadlineDays, win)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// --- Auto-ajuste -----------------------------------------------------------

export function AutoSwitch({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label className={s.autoswitch} {...anchor(ANCHORS.jornadaAuto)}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label="Auto-ajuste: os marcos seguintes se reorganizam ao arrastar"
      />
      <span className={s.swTrack}>
        <span className={s.swThumb} />
      </span>
      <span className={s.swLabel}>Auto-ajuste</span>
    </label>
  )
}

// --- Segmentado Semanas | Dias ---------------------------------------------

export function UnitSegmented({
  unit,
  onChange,
}: {
  unit: JourneyUnit
  onChange: (next: JourneyUnit) => void
}) {
  return (
    <div className={s.unitseg} {...anchor(ANCHORS.jornadaUnidade)}>
      <span className={s.usLabel} id="jornada-unit-label">
        Ajustar em:
      </span>
      <div className={s.usGroup} aria-labelledby="jornada-unit-label">
        <button
          type="button"
          className={`${s.usBtn}${unit === "w" ? ` ${s.usBtnOn}` : ""}`}
          aria-pressed={unit === "w"}
          onClick={() => onChange("w")}
        >
          Semanas
        </button>
        <button
          type="button"
          className={`${s.usBtn}${unit === "d" ? ` ${s.usBtnOn}` : ""}`}
          aria-pressed={unit === "d"}
          onClick={() => onChange("d")}
        >
          Dias
        </button>
      </div>
    </div>
  )
}
