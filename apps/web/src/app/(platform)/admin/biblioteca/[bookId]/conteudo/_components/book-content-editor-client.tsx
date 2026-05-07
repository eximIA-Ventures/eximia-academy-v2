"use client"

import type { DbBookChapter } from "@/lib/books-queries"
import {
  Badge,
  Button,
  FormField,
  Input,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  useToast,
} from "@eximia/ui"
import {
  ArrowLeft,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Edit,
  FileUp,
  GripVertical,
  Loader2,
  Plus,
  Save,
  Trash2,
  XCircle,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

interface Props {
  bookId: string
  initialChapters: DbBookChapter[]
  initialSummaries: DbBookChapter[]
  initialProcessingStatus: string
}

type ContentType = "chapter" | "summary"
type ProcessingStatus = "idle" | "uploading" | "extracting" | "organizing" | "completed" | "failed"

const STATUS_LABELS: Record<ProcessingStatus, string> = {
  idle: "",
  uploading: "Enviando PDF...",
  extracting: "Extraindo texto...",
  organizing: "Identificando capítulos com IA...",
  completed: "Concluido!",
  failed: "Erro no processamento",
}

const STATUS_STEPS: ProcessingStatus[] = ["uploading", "extracting", "organizing", "completed"]

function ProcessingProgress({ status, error }: { status: ProcessingStatus; error?: string | null }) {
  if (status === "idle") return null

  const currentIndex = STATUS_STEPS.indexOf(status)
  const isFailed = status === "failed"
  const isCompleted = status === "completed"

  return (
    <div className="rounded-lg shadow-card bg-bg-surface p-4">
      <div className="flex items-center gap-3 mb-3">
        {isFailed ? (
          <XCircle size={18} className="text-status-error" />
        ) : isCompleted ? (
          <CheckCircle size={18} className="text-status-success" />
        ) : (
          <Loader2 size={18} className="animate-spin text-cerrado-600" />
        )}
        <span className="text-sm font-medium text-text-primary">
          {isFailed ? (error || STATUS_LABELS.failed) : STATUS_LABELS[status]}
        </span>
      </div>
      <div className="flex gap-1">
        {STATUS_STEPS.map((step, i) => (
          <div
            key={step}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              isFailed
                ? "bg-status-error/30"
                : i <= currentIndex
                  ? "bg-cerrado-600"
                  : "bg-border-subtle"
            }`}
          />
        ))}
      </div>
    </div>
  )
}

export function BookContentEditorClient({ bookId, initialChapters, initialSummaries, initialProcessingStatus }: Props) {
  const router = useRouter()
  const { toast } = useToast()

  const [chapters, setChapters] = useState(initialChapters)
  const [summaries, setSummaries] = useState(initialSummaries)
  const [activeTab, setActiveTab] = useState<string>("chapters")

  // Sync state when server data changes (e.g. after router.refresh())
  useEffect(() => { setChapters(initialChapters) }, [initialChapters])
  useEffect(() => { setSummaries(initialSummaries) }, [initialSummaries])

  const [showAdd, setShowAdd] = useState(false)
  const [addType, setAddType] = useState<ContentType>("chapter")
  const [addTitle, setAddTitle] = useState("")
  const [saving, setSaving] = useState(false)

  const [editItem, setEditItem] = useState<DbBookChapter | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editContent, setEditContent] = useState("")
  const [editSaving, setEditSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<DbBookChapter | null>(null)
  const [deleting, setDeleting] = useState(false)

  // PDF upload state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>(
    initialProcessingStatus as ProcessingStatus,
  )
  const [processingError, setProcessingError] = useState<string | null>(null)
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  const isProcessing = !["idle", "completed", "failed"].includes(processingStatus)

  // SSE connection for tracking processing status
  const connectSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const es = new EventSource(`/api/admin/books/${bookId}/upload-pdf/status`)
    eventSourceRef.current = es

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { status: string; error?: string | null }

        if (data.status === "timeout") {
          es.close()
          eventSourceRef.current = null
          setProcessingStatus("failed")
          setProcessingError("Timeout na conexão")
          return
        }

        const status = data.status as ProcessingStatus
        setProcessingStatus(status)
        setProcessingError(data.error ?? null)

        if (status === "completed") {
          es.close()
          eventSourceRef.current = null
          toast({ variant: "success", title: "PDF importado", description: "Capítulos criados com sucesso" })
          router.refresh()
        } else if (status === "failed") {
          es.close()
          eventSourceRef.current = null
          toast({ variant: "error", title: "Erro no processamento", description: data.error || "Erro desconhecido" })
        }
      } catch {
        // Ignore parse errors
      }
    }

    es.onerror = () => {
      es.close()
      eventSourceRef.current = null
    }

    return es
  }, [bookId, router, toast])

  // Reconnect SSE if page loads during processing
  useEffect(() => {
    if (isProcessing) {
      connectSSE()
    }
    return () => {
      eventSourceRef.current?.close()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const getItems = (type: ContentType) => (type === "chapter" ? chapters : summaries)
  const setItems = (type: ContentType) => (type === "chapter" ? setChapters : setSummaries)

  const handleAdd = useCallback(async () => {
    if (!addTitle.trim()) return
    setSaving(true)
    try {
      const items = getItems(addType)
      const res = await fetch(`/api/admin/books/${bookId}/chapters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: addTitle.trim(),
          content: "",
          content_type: addType,
          chapter_order: items.length,
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        toast({ variant: "error", title: "Erro", description: json.error })
        return
      }
      const { data } = await res.json()
      setItems(addType)((prev) => [...prev, data])
      setAddTitle("")
      setShowAdd(false)
      toast({ variant: "success", title: `${addType === "chapter" ? "Capítulo" : "Secao de resumo"} criado` })
    } finally {
      setSaving(false)
    }
  }, [addTitle, addType, bookId, toast])

  const openEdit = useCallback((item: DbBookChapter) => {
    setEditItem(item)
    setEditTitle(item.title)
    setEditContent(item.content)
  }, [])

  const handleEditSave = useCallback(async () => {
    if (!editItem) return
    setEditSaving(true)
    try {
      const res = await fetch(`/api/admin/books/${bookId}/chapters/${editItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle.trim(), content: editContent }),
      })
      if (!res.ok) {
        const json = await res.json()
        toast({ variant: "error", title: "Erro", description: json.error })
        return
      }
      const { data } = await res.json()
      const type = editItem.content_type as ContentType
      setItems(type)((prev) => prev.map((c) => (c.id === data.id ? data : c)))
      setEditItem(null)
      toast({ variant: "success", title: "Conteúdo salvo" })
    } finally {
      setEditSaving(false)
    }
  }, [editItem, editTitle, editContent, bookId, toast])

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/books/${bookId}/chapters/${deleteTarget.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const json = await res.json()
        toast({ variant: "error", title: "Erro", description: json.error })
        return
      }
      const type = deleteTarget.content_type as ContentType
      setItems(type)((prev) => prev.filter((c) => c.id !== deleteTarget.id))
      setDeleteTarget(null)
      toast({ variant: "success", title: "Item excluido" })
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, bookId, toast])

  const handleReorder = useCallback(
    async (type: ContentType, index: number, direction: "up" | "down") => {
      const items = getItems(type)
      const newIndex = direction === "up" ? index - 1 : index + 1
      if (newIndex < 0 || newIndex >= items.length) return

      const newItems = [...items]
      const [moved] = newItems.splice(index, 1)
      newItems.splice(newIndex, 0, moved)

      setItems(type)(newItems)

      const reorderPayload = newItems.map((item, i) => ({ id: item.id, chapter_order: i }))
      await fetch(`/api/admin/books/${bookId}/chapters/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapters: reorderPayload }),
      })
    },
    [chapters, summaries, bookId],
  )

  const uploadPdf = useCallback(
    async (file: File, replaceExisting: boolean) => {
      setProcessingStatus("uploading")
      setProcessingError(null)

      try {
        const formData = new FormData()
        formData.append("file", file)
        if (replaceExisting) formData.append("replaceExisting", "true")

        const res = await fetch(`/api/admin/books/${bookId}/upload-pdf`, {
          method: "POST",
          body: formData,
        })

        if (!res.ok) {
          const json = await res.json()
          setProcessingStatus("failed")
          setProcessingError(json.error)
          toast({ variant: "error", title: "Erro no upload", description: json.error })
          return
        }

        // API returned fast — now connect SSE to track background processing
        connectSSE()
      } catch {
        setProcessingStatus("failed")
        setProcessingError("Falha ao enviar o PDF")
        toast({ variant: "error", title: "Erro", description: "Falha ao enviar o PDF" })
      } finally {
        setPendingFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ""
      }
    },
    [bookId, connectSSE, toast],
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      if (chapters.length > 0) {
        setPendingFile(file)
        setShowReplaceConfirm(true)
      } else {
        uploadPdf(file, false)
      }
    },
    [chapters, uploadPdf],
  )

  const renderList = (items: DbBookChapter[], type: ContentType) => (
    <div className="space-y-2">
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-subtle py-12 text-center text-text-muted">
          Nenhum {type === "chapter" ? "capítulo" : "resumo"} cadastrado.
          <br />
          <Button
            size="sm"
            variant="ghost"
            className="mt-2"
            onClick={() => {
              setAddType(type)
              setShowAdd(true)
            }}
          >
            <Plus size={14} />
            Adicionar
          </Button>
        </div>
      ) : (
        items.map((item, index) => (
          <div
            key={item.id}
            className="flex items-center gap-2 rounded-lg shadow-card bg-bg-surface p-3"
          >
            <GripVertical size={14} className="shrink-0 text-text-muted" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">{item.title}</p>
              <p className="text-xs text-text-muted">
                {item.content ? `${item.content.length} caracteres` : "Sem conteúdo"}
              </p>
            </div>
            <Badge variant="default" className="shrink-0">
              #{index + 1}
            </Badge>
            <div className="flex items-center gap-0.5 shrink-0">
              <Button
                size="sm"
                variant="ghost"
                disabled={index === 0}
                onClick={() => handleReorder(type, index, "up")}
              >
                <ChevronUp size={14} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={index === items.length - 1}
                onClick={() => handleReorder(type, index, "down")}
              >
                <ChevronDown size={14} />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => openEdit(item)}>
                <Edit size={14} />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(item)}>
                <Trash2 size={14} className="text-status-error" />
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  )

  return (
    <>
      {/* Back + actions */}
      <div className="flex items-center justify-between">
        <Link href="/admin/biblioteca">
          <Button variant="ghost" size="sm">
            <ArrowLeft size={14} />
            Voltar
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            size="sm"
            variant="default"
            disabled={isProcessing}
            onClick={() => fileInputRef.current?.click()}
          >
            <FileUp size={14} />
            Importar PDF
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setAddType(activeTab === "summaries" ? "summary" : "chapter")
              setShowAdd(true)
            }}
          >
            <Plus size={16} />
            Adicionar {activeTab === "summaries" ? "secao" : "capítulo"}
          </Button>
        </div>
      </div>

      {/* Processing progress */}
      <ProcessingProgress status={processingStatus} error={processingError} />

      {/* Tabs: chapters / summaries */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="chapters">
            Capítulos
            <Badge variant="default" className="ml-2">
              {chapters.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="summaries">
            Resumos
            <Badge variant="default" className="ml-2">
              {summaries.length}
            </Badge>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="chapters">{renderList(chapters, "chapter")}</TabsContent>
        <TabsContent value="summaries">{renderList(summaries, "summary")}</TabsContent>
      </Tabs>

      {/* Add dialog */}
      <Modal open={showAdd} onOpenChange={setShowAdd}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <ModalTitle>
              Novo {addType === "chapter" ? "capítulo" : "secao de resumo"}
            </ModalTitle>
            <ModalDescription>
              Informe o titulo. Você podera editar o conteúdo depois.
            </ModalDescription>
          </ModalHeader>
          <div className="py-4">
            <FormField label="Titulo">
              <Input
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
                placeholder={addType === "chapter" ? "Cap. 1 - Introducao" : "Visão Geral"}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </FormField>
          </div>
          <ModalFooter>
            <Button variant="default" onClick={() => setShowAdd(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAdd} disabled={saving || !addTitle.trim()}>
              {saving ? "Criando..." : "Criar"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit dialog (full content editor) */}
      <Modal open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <ModalOverlay />
        <ModalContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <ModalHeader>
            <ModalTitle>Editar conteúdo</ModalTitle>
            <ModalDescription>
              Edite o titulo e conteúdo em Markdown.
            </ModalDescription>
          </ModalHeader>
          <div className="space-y-4 py-4">
            <FormField label="Titulo">
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </FormField>
            <FormField label="Conteúdo (Markdown)">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={18}
                className="font-mono text-sm"
                placeholder="Escreva o conteúdo do capítulo em Markdown..."
              />
            </FormField>
          </div>
          <ModalFooter>
            <Button variant="default" onClick={() => setEditItem(null)}>
              Cancelar
            </Button>
            <Button onClick={handleEditSave} disabled={editSaving}>
              <Save size={14} />
              {editSaving ? "Salvando..." : "Salvar conteúdo"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete confirmation */}
      <Modal open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Excluir</ModalTitle>
            <ModalDescription>
              Tem certeza que deseja excluir &quot;{deleteTarget?.title}&quot;?
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <Button variant="default" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Excluindo..." : "Excluir"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* PDF replace confirmation */}
      <Modal open={showReplaceConfirm} onOpenChange={setShowReplaceConfirm}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Capítulos existentes</ModalTitle>
            <ModalDescription>
              Este livro já possui {chapters.length} capítulo(s). O que deseja fazer?
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <Button
              variant="default"
              onClick={() => {
                setShowReplaceConfirm(false)
                setPendingFile(null)
                if (fileInputRef.current) fileInputRef.current.value = ""
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="default"
              onClick={() => {
                setShowReplaceConfirm(false)
                if (pendingFile) uploadPdf(pendingFile, false)
              }}
            >
              Adicionar aos existentes
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowReplaceConfirm(false)
                if (pendingFile) uploadPdf(pendingFile, true)
              }}
            >
              Substituir todos
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}
