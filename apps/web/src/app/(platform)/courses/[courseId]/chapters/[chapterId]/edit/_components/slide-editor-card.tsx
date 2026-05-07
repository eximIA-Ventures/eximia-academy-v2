"use client"

import type { ChapterSlide } from "@eximia/shared"
import { Button, useToast } from "@eximia/ui"
import { Check, GripVertical, Trash2 } from "lucide-react"
import Image from "next/image"
import { useState } from "react"
import { deleteSlide, updateSlideText } from "../slide-actions"

interface SlideEditorCardProps {
  slide: ChapterSlide
  onDelete: () => void
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "bg-border-primary text-text-muted" },
  generating: { label: "Gerando...", color: "bg-cerrado-600/20 text-cerrado-600" },
  review: { label: "Revisão", color: "bg-semantic-warning/20 text-semantic-warning" },
  approved: { label: "Aprovado", color: "bg-semantic-success/20 text-semantic-success" },
}

export function SlideEditorCard({ slide, onDelete }: SlideEditorCardProps) {
  const [text, setText] = useState(slide.text_content ?? "")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { toast } = useToast()

  const isPdf = (slide.metadata as Record<string, unknown>)?.type === "pdf"
  const statusInfo = STATUS_LABELS[slide.text_status] ?? STATUS_LABELS.pending

  async function handleSaveText() {
    setSaving(true)
    const result = await updateSlideText(slide.id, text)
    setSaving(false)
    if (result.error) {
      toast({ variant: "error", title: result.error })
    } else {
      toast({ variant: "success", title: "Texto salvo" })
    }
  }

  async function handleDelete() {
    setDeleting(true)
    const result = await deleteSlide(slide.id, slide.chapter_id)
    setDeleting(false)
    if (result.error) {
      toast({ variant: "error", title: result.error })
    } else {
      onDelete()
    }
  }

  return (
    <div className="group flex gap-3 rounded-md border border-border-primary bg-bg-card p-3">
      {/* Drag handle */}
      <div className="flex items-start pt-1 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
        <GripVertical size={16} />
      </div>

      {/* Thumbnail */}
      <div className="relative h-16 w-28 flex-shrink-0 overflow-hidden rounded-sm bg-bg-surface">
        {isPdf ? (
          <div className="flex h-full w-full items-center justify-center text-xs text-text-muted">
            PDF p.{(slide.metadata as { pageNumber?: number })?.pageNumber ?? "?"}
          </div>
        ) : slide.image_url ? (
          <Image
            src={slide.image_url}
            alt={`Slide ${slide.order + 1}`}
            fill
            className="object-cover"
            sizes="112px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-text-muted">
            {slide.order + 1}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text-primary">
            Slide {slide.order + 1}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
          {slide.audio_start_ms != null && slide.audio_end_ms != null && (
            <span className="text-[10px] text-text-muted">
              {Math.round(slide.audio_start_ms / 1000)}s–{Math.round(slide.audio_end_ms / 1000)}s
            </span>
          )}
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          className="w-full rounded-sm border border-border-primary bg-bg-primary p-2 text-xs text-text-primary resize-y focus:border-cerrado-600 focus:outline-none"
          placeholder="Texto do slide (edite manualmente ou gere via AI)"
        />

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSaveText}
            disabled={saving || text === (slide.text_content ?? "")}
          >
            <Check size={12} className="mr-1" />
            {saving ? "Salvando..." : "Salvar Texto"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="text-semantic-error hover:bg-semantic-error/10"
          >
            <Trash2 size={12} className="mr-1" />
            {deleting ? "Excluindo..." : "Excluir"}
          </Button>
        </div>
      </div>
    </div>
  )
}
