"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
  Input,
} from "@eximia/ui"
import { useState } from "react"

interface ChapterData {
  title: string
  content: string
  learning_objective: string
  order: number
  key_concepts: string[]
  estimated_reading_time_min: number
}

interface ChapterPreviewCardProps {
  chapter: ChapterData
  index: number
  total: number
  onUpdate: (updates: Partial<ChapterData>) => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

export function ChapterPreviewCard({
  chapter,
  index,
  total,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: ChapterPreviewCardProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className="rounded-lg border border-bg-elevated bg-bg-card">
      <div className="flex items-center gap-2 p-3">
        {/* Reorder buttons */}
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="rounded p-0.5 text-text-muted hover:text-text-secondary disabled:opacity-30"
          >
            <svg
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m18 15-6-6-6 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="rounded p-0.5 text-text-muted hover:text-text-secondary disabled:opacity-30"
          >
            <svg
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>

        {/* Chapter number */}
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-bg-elevated text-xs font-medium text-text-muted">
          {index + 1}
        </span>

        {/* Title */}
        {isEditingTitle ? (
          <Input
            value={chapter.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            onBlur={() => setIsEditingTitle(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setIsEditingTitle(false)
            }}
            className="flex-1 text-sm"
            autoFocus
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsEditingTitle(true)}
            className="flex-1 text-left text-sm font-medium text-text-primary hover:text-accent-blue-mid"
          >
            {chapter.title}
          </button>
        )}

        {/* Reading time */}
        <span className="text-xs text-text-muted">{chapter.estimated_reading_time_min} min</span>

        {/* Delete */}
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <Button variant="destructive" size="sm" onClick={onDelete}>
              Sim
            </Button>
            <Button variant="default" size="sm" onClick={() => setConfirmDelete(false)}>
              Nao
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="rounded p-1 text-text-muted hover:text-semantic-error"
          >
            <svg
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </button>
        )}
      </div>

      {/* Learning objective */}
      <div className="border-t border-bg-elevated px-3 py-2">
        <p className="text-xs text-text-muted">{chapter.learning_objective}</p>
      </div>

      {/* Key concepts */}
      <div className="flex flex-wrap gap-1 border-t border-bg-elevated px-3 py-2">
        {chapter.key_concepts.map((concept) => (
          <Badge key={concept} variant="default" className="text-xs">
            {concept}
          </Badge>
        ))}
      </div>

      {/* Collapsible content */}
      <Accordion type="single">
        <AccordionItem value="content" className="border-t border-bg-elevated">
          <AccordionTrigger className="px-3 py-2 text-xs text-text-muted">
            Ver conteúdo
          </AccordionTrigger>
          <AccordionContent className="px-3 pb-3">
            <div className="prose prose-sm prose-invert max-h-64 overflow-y-auto text-xs text-text-secondary">
              {chapter.content.split("\n").map((line, i) => (
                <p key={`${chapter.order}-line-${i}`}>{line || "\u00A0"}</p>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
