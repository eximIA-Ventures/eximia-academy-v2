"use client"

import { Input, Label } from "@eximia/ui"
import { useCallback, useState } from "react"

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

interface ColorPickerProps {
  label: string
  value: string
  onChange: (color: string) => void
}

export function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  const [inputValue, setInputValue] = useState(value)
  const [error, setError] = useState(false)

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value
      setInputValue(v)
      if (HEX_COLOR_RE.test(v)) {
        setError(false)
        onChange(v)
      } else {
        setError(v.length >= 7)
      }
    },
    [onChange],
  )

  const handleColorInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value
      setInputValue(v)
      setError(false)
      onChange(v)
    },
    [onChange],
  )

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={HEX_COLOR_RE.test(inputValue) ? inputValue : "#000000"}
          onChange={handleColorInput}
          className="h-11 w-11 shrink-0 cursor-pointer rounded-sm border border-border-medium bg-transparent p-1"
          aria-label={`Selecionar ${label}`}
        />
        <Input
          value={inputValue}
          onChange={handleTextChange}
          placeholder="#000000"
          maxLength={7}
          error={error}
          className="font-mono"
        />
        <div
          className="h-11 w-11 shrink-0 rounded-sm border border-border-medium"
          style={{ backgroundColor: HEX_COLOR_RE.test(inputValue) ? inputValue : "transparent" }}
          aria-hidden
        />
      </div>
      {error && <p className="text-xs text-semantic-error">Formato inválido. Use #RRGGBB</p>}
    </div>
  )
}
