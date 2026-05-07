"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import {
  Plate,
  PlateContent,
  PlateElement,
  ParagraphPlugin,
  useEditorRef,
  usePlateEditor,
  useSelected,
  type PlateElementProps,
} from "platejs/react"
import type { Value } from "platejs"
import {
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
  CodePlugin,
  HeadingPlugin,
} from "@platejs/basic-nodes/react"
import { ImagePlugin } from "@platejs/media/react"
import { ColumnPlugin, ColumnItemPlugin } from "@platejs/layout/react"
import { insertColumnGroup } from "@platejs/layout"
import { MarkdownPlugin } from "@platejs/markdown"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@eximia/ui"
import {
  Bold,
  Italic,
  Underline,
  Code,
  Heading2,
  Heading3,
  ImagePlus,
  Columns2,
  Columns3,
  Plus,
  type LucideIcon,
} from "lucide-react"
import { uploadChapterAsset } from "@/lib/utils/chapter-asset-upload"
import { getGridImageEditorStyles } from "@/lib/utils/parse-image-alt"
import { createClient } from "@/lib/supabase/client"

// ─── Custom element components ────────────────────────────────────
function ParagraphElement(props: PlateElementProps) {
  return (
    <PlateElement {...props} className="text-text-secondary mb-2" />
  )
}

function HeadingElement(props: PlateElementProps) {
  const type = props.element.type as string
  const classes: Record<string, string> = {
    h1: "text-2xl font-bold text-text-primary mt-6 mb-3 clear-both",
    h2: "text-xl font-bold text-text-primary mt-5 mb-2 clear-both",
    h3: "text-lg font-semibold text-text-primary mt-4 mb-2 clear-both",
  }
  return (
    <PlateElement {...props} as={type as "h1" | "h2" | "h3"} className={classes[type] ?? classes.h2} />
  )
}

const GRID_SIZE = 5

// ─── 5×5 Grid Picker ─────────────────────────────────────────────
function GridPicker({
  col,
  colSpan,
  row,
  rowSpan,
  onChange,
}: {
  col: number
  colSpan: number
  row: number
  rowSpan: number
  onChange: (col: number, colSpan: number, row: number, rowSpan: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragStart, setDragStart] = useState<{ c: number; r: number } | null>(null)
  const [dragEnd, setDragEnd] = useState<{ c: number; r: number } | null>(null)

  const pStart = dragStart && dragEnd
    ? { c: Math.min(dragStart.c, dragEnd.c), r: Math.min(dragStart.r, dragEnd.r) }
    : null
  const pEnd = dragStart && dragEnd
    ? { c: Math.max(dragStart.c, dragEnd.c), r: Math.max(dragStart.r, dragEnd.r) }
    : null

  function getCellFromPointer(clientX: number, clientY: number): { c: number; r: number } {
    const el = containerRef.current
    if (!el) return { c: 0, r: 0 }
    const rect = el.getBoundingClientRect()
    const c = Math.floor(((clientX - rect.left) / rect.width) * GRID_SIZE)
    const r = Math.floor(((clientY - rect.top) / rect.height) * GRID_SIZE)
    return {
      c: Math.max(0, Math.min(c, GRID_SIZE - 1)),
      r: Math.max(0, Math.min(r, GRID_SIZE - 1)),
    }
  }

  function handlePointerDown(e: React.PointerEvent) {
    e.preventDefault()
    containerRef.current?.setPointerCapture(e.pointerId)
    const cell = getCellFromPointer(e.clientX, e.clientY)
    setDragStart(cell)
    setDragEnd(cell)
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragStart) return
    setDragEnd(getCellFromPointer(e.clientX, e.clientY))
  }

  function handlePointerUp() {
    if (pStart && pEnd) {
      onChange(pStart.c, pEnd.c - pStart.c + 1, pStart.r, pEnd.r - pStart.r + 1)
    }
    setDragStart(null)
    setDragEnd(null)
  }

  return (
    <div
      ref={containerRef}
      className="grid gap-0.5 touch-none select-none"
      style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, idx) => {
        const c = idx % GRID_SIZE
        const r = Math.floor(idx / GRID_SIZE)
        const isActive = c >= col && c < col + colSpan && r >= row && r < row + rowSpan
        const isPreview = pStart && pEnd && c >= pStart.c && c <= pEnd.c && r >= pStart.r && r <= pEnd.r
        return (
          <div
            key={idx}
            className={`h-4 w-5 rounded-sm border transition-colors ${
              isPreview
                ? "bg-cerrado-600/40 border-cerrado-600"
                : isActive
                  ? "bg-cerrado-600/25 border-cerrado-400"
                  : "bg-bg-surface border-border-subtle"
            }`}
          />
        )
      })}
    </div>
  )
}

function ImageElement(props: PlateElementProps) {
  const editor = useEditorRef()
  const selected = useSelected()
  const element = props.element as {
    url?: string
    imgCol?: number
    imgSpan?: number
    imgRow?: number
    imgRowSpan?: number
  }
  const url = element.url
  const imgCol = element.imgCol ?? 0
  const imgSpan = element.imgSpan ?? GRID_SIZE
  const imgRow = element.imgRow ?? 0
  const imgRowSpan = element.imgRowSpan ?? GRID_SIZE
  const gridStyles = getGridImageEditorStyles(imgCol, imgSpan)

  const dragRef = useRef<{
    startX: number
    startY: number
    startCol: number
    moved: boolean
  } | null>(null)
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null)

  function updateGrid(newCol: number, newColSpan: number, newRow: number, newRowSpan: number) {
    editor.tf.setNodes(
      { imgCol: newCol, imgSpan: newColSpan, imgRow: newRow, imgRowSpan: newRowSpan } as Record<string, unknown>,
      { at: props.path },
    )
  }

  const handleDragPointerDown = useCallback((e: React.PointerEvent) => {
    // Only left mouse button
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startCol: imgCol,
      moved: false,
    }
    setDragOffset({ x: 0, y: 0 })
  }, [imgCol])

  const handleDragPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      dragRef.current.moved = true
    }
    setDragOffset({ x: dx, y: dy })
  }, [])

  const handleDragPointerUp = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    dragRef.current = null
    setDragOffset(null)

    if (!drag.moved) return

    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY

    // Horizontal: compute column snap from pixel offset
    // Use the editor container width to calculate column size
    const editorEl = (e.target as HTMLElement).closest("[data-plate-content]")
    if (editorEl) {
      const containerWidth = editorEl.clientWidth
      const colWidth = containerWidth / GRID_SIZE
      const colDelta = Math.round(dx / colWidth)
      if (colDelta !== 0) {
        const maxCol = GRID_SIZE - imgSpan
        const newCol = Math.max(0, Math.min(drag.startCol + colDelta, maxCol))
        if (newCol !== imgCol) {
          editor.tf.setNodes(
            { imgCol: newCol } as Record<string, unknown>,
            { at: props.path },
          )
        }
      }
    }

    // Vertical: move node up/down if dragged past threshold
    const ROW_THRESHOLD = 50
    if (Math.abs(dy) > ROW_THRESHOLD) {
      const direction = dy < 0 ? -1 : 1
      const currentIdx = props.path[props.path.length - 1] as number
      const parentPath = props.path.slice(0, -1)
      const newIdx = currentIdx + direction
      // Check bounds
      const parent = editor.api.node(parentPath)
      if (parent) {
        const childCount = (parent[0] as { children: unknown[] }).children.length
        if (newIdx >= 0 && newIdx < childCount) {
          editor.tf.moveNodes({
            at: props.path,
            to: [...parentPath, newIdx],
          })
        }
      }
    }
  }, [editor, imgCol, imgSpan, props.path])

  return (
    <PlateElement {...props} className="my-2 relative group" style={gridStyles}>
      <div contentEditable={false}>
        {url && (
          <img
            src={url}
            alt=""
            className="rounded-md w-full h-auto cursor-grab active:cursor-grabbing"
            style={
              dragOffset
                ? {
                    transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`,
                    opacity: 0.8,
                    zIndex: 50,
                    position: "relative",
                    pointerEvents: "auto",
                  }
                : undefined
            }
            onPointerDown={handleDragPointerDown}
            onPointerMove={handleDragPointerMove}
            onPointerUp={handleDragPointerUp}
            draggable={false}
          />
        )}

        {/* 5×5 grid picker — visible when selected */}
        {selected && !dragOffset && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 rounded-md shadow-card bg-bg-elevated px-2.5 py-2 shadow-lg">
            <span className="text-[10px] text-text-muted mb-1.5 block">
              {imgSpan}×{imgRowSpan}
            </span>
            <GridPicker
              col={imgCol}
              colSpan={imgSpan}
              row={imgRow}
              rowSpan={imgRowSpan}
              onChange={updateGrid}
            />
          </div>
        )}
      </div>
      {props.children}
    </PlateElement>
  )
}

function ColumnGroupElement(props: PlateElementProps) {
  return (
    <PlateElement
      {...props}
      className="grid grid-flow-col auto-cols-fr gap-4 my-4 p-2 border border-dashed border-border-medium rounded-md"
    />
  )
}

function ColumnElement(props: PlateElementProps) {
  return (
    <PlateElement
      {...props}
      className="min-h-[60px] p-2 border border-dashed border-border-subtle rounded-sm"
    />
  )
}

// ─── Toolbar button ───────────────────────────────────────────────
function ToolbarButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="p-1.5 rounded-sm transition-colors text-text-secondary hover:text-text-primary hover:bg-bg-hover"
    >
      <Icon size={16} />
    </button>
  )
}

// ─── Main BlockEditor component ──────────────────────────────────
interface BlockEditorProps {
  initialBlocks: Value | null
  initialMarkdown: string
  chapterId: string
  tenantId: string
  onChange: (blocks: Value, markdown: string) => void
}

export function BlockEditor({
  initialBlocks,
  initialMarkdown,
  chapterId,
  tenantId,
  onChange,
}: BlockEditorProps) {
  const initializedRef = useRef(false)

  const editor = usePlateEditor({
    plugins: [
      ParagraphPlugin.withComponent(ParagraphElement),
      HeadingPlugin.configure({ options: { levels: 3 } }).withComponent(HeadingElement),
      BoldPlugin,
      ItalicPlugin,
      UnderlinePlugin,
      CodePlugin,
      ImagePlugin.withComponent(ImageElement),
      ColumnPlugin.withComponent(ColumnGroupElement),
      ColumnItemPlugin.withComponent(ColumnElement),
      MarkdownPlugin,
    ],
    value: initialBlocks ?? undefined,
  })

  // Deserialize markdown to Plate value if no blocks exist
  useMemo(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    if (!initialBlocks && initialMarkdown) {
      try {
        const deserialized = editor.api.markdown.deserialize(initialMarkdown)
        if (deserialized && deserialized.length > 0) {
          editor.tf.setValue(deserialized)
        }
      } catch {
        // Fall back to default empty state
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = useCallback(
    ({ value }: { value: Value }) => {
      try {
        const md = editor.api.markdown.serialize()
        onChange(value, md)
      } catch {
        onChange(value, "")
      }
    },
    [editor, onChange],
  )

  const toggleMark = useCallback(
    (type: string) => {
      editor.tf.toggleMark(type)
      editor.tf.focus()
    },
    [editor],
  )

  const insertHeading = useCallback(
    (level: 2 | 3) => {
      editor.tf.toggleBlock(`h${level}`)
      editor.tf.focus()
    },
    [editor],
  )

  const handleImageUpload = useCallback(() => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/png,image/jpeg,image/webp"
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const supabase = createClient()
        const url = await uploadChapterAsset(supabase, file, tenantId, chapterId, "images")
        editor.tf.insertNodes({
          type: "img",
          url,
          imgCol: 0,
          imgSpan: 5,
          imgRow: 0,
          imgRowSpan: 5,
          children: [{ text: "" }],
        })
        editor.tf.focus()
      } catch {
        // Upload error is handled externally
      }
    }
    input.click()
  }, [editor, chapterId, tenantId])

  const handleInsertColumns = useCallback(
    (columns: number) => {
      insertColumnGroup(editor, { columns })
      editor.tf.focus()
    },
    [editor],
  )

  return (
    <div className="rounded-md shadow-card bg-bg-card overflow-hidden">
      <Plate editor={editor} onChange={handleChange}>
        {/* Toolbar */}
        <div className="flex items-center gap-0.5  px-2 py-1.5 bg-bg-surface rounded-t-md flex-wrap">
          <ToolbarButton icon={Bold} label="Negrito" onClick={() => toggleMark("bold")} />
          <ToolbarButton icon={Italic} label="Italico" onClick={() => toggleMark("italic")} />
          <ToolbarButton icon={Underline} label="Sublinhado" onClick={() => toggleMark("underline")} />
          <ToolbarButton icon={Code} label="Codigo" onClick={() => toggleMark("code")} />

          <div className="w-px h-5 bg-border-medium mx-1" />

          <ToolbarButton icon={Heading2} label="Titulo H2" onClick={() => insertHeading(2)} />
          <ToolbarButton icon={Heading3} label="Titulo H3" onClick={() => insertHeading(3)} />

          <div className="w-px h-5 bg-border-medium mx-1" />

          <ToolbarButton icon={ImagePlus} label="Inserir Imagem" onClick={handleImageUpload} />
          <ToolbarButton icon={Columns2} label="2 Colunas" onClick={() => handleInsertColumns(2)} />
          <ToolbarButton icon={Columns3} label="3 Colunas" onClick={() => handleInsertColumns(3)} />

          <div className="w-px h-5 bg-border-medium mx-1" />

          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex items-center gap-1 px-2 py-1 rounded-sm text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
            >
              <Plus size={14} />
              Bloco
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => insertHeading(2)}>
                <Heading2 size={14} className="mr-2" /> Titulo H2
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertHeading(3)}>
                <Heading3 size={14} className="mr-2" /> Titulo H3
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleImageUpload}>
                <ImagePlus size={14} className="mr-2" /> Imagem
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleInsertColumns(2)}>
                <Columns2 size={14} className="mr-2" /> Layout 2 Colunas
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleInsertColumns(3)}>
                <Columns3 size={14} className="mr-2" /> Layout 3 Colunas
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <PlateContent
          placeholder="Comece a escrever o conteúdo do capítulo..."
          className="min-h-[400px] px-4 py-3 text-text-secondary focus:outline-none prose prose-invert max-w-none [&_*]:outline-none"
        />
      </Plate>
    </div>
  )
}
