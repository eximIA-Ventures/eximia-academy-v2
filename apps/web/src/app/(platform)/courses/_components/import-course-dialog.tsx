"use client"

import {
  Button,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  useToast,
} from "@eximia/ui"
import { FileUp, Upload } from "lucide-react"
import { useRouter } from "next/navigation"
import { useRef, useState, useTransition } from "react"

interface ImportCourseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ImportCourseDialog({ open, onOpenChange }: ImportCourseDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<{ title: string; chapters: number } | null>(null)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string)
        setPreview({
          title: data.course?.title ?? "Sem título",
          chapters: data.chapters?.length ?? 0,
        })
      } catch {
        setPreview(null)
        toast({ variant: "error", title: "Arquivo JSON inválido" })
        setFile(null)
      }
    }
    reader.readAsText(f)
  }

  function handleImport() {
    if (!file) return

    startTransition(async () => {
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          const body = reader.result as string
          const res = await fetch("/api/courses/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
          })
          const data = await res.json()

          if (!res.ok) {
            toast({ variant: "error", title: data.error ?? "Erro ao importar" })
            return
          }

          toast({
            variant: "success",
            title: `Curso importado: ${data.stats.chapters} capítulos, ${data.stats.questions} perguntas`,
          })
          onOpenChange(false)
          setFile(null)
          setPreview(null)
          router.push(`/courses/${data.courseId}`)
          router.refresh()
        } catch {
          toast({ variant: "error", title: "Erro ao processar importação" })
        }
      }
      reader.readAsText(file)
    })
  }

  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setFile(null)
          setPreview(null)
        }
        onOpenChange(v)
      }}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Importar Curso</ModalTitle>
          <ModalDescription>
            Selecione um arquivo .json exportado pela eximIA Academy. O curso será criado como
            rascunho.
          </ModalDescription>
        </ModalHeader>

        <div className="px-6 pb-4 space-y-4">
          <input
            ref={inputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />

          {!file ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border-medium py-6 sm:py-10 text-text-muted transition-colors hover:border-accent-blue-mid/50 hover:bg-accent-blue-mid/5"
            >
              <Upload size={32} className="text-text-muted/50" />
              <div className="text-center">
                <p className="text-sm font-medium text-text-secondary">
                  Clique para selecionar arquivo
                </p>
                <p className="mt-1 text-xs text-text-muted">Formato: .json</p>
              </div>
            </button>
          ) : (
            <div className="flex items-center gap-3 rounded-xl bg-bg-elevated p-4 ring-1 ring-border-subtle">
              <FileUp size={20} className="shrink-0 text-accent-blue-light" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary truncate">{file.name}</p>
                {preview && (
                  <p className="text-xs text-text-muted mt-0.5">
                    {preview.title} · {preview.chapters} capítulo
                    {preview.chapters !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setFile(null)
                  setPreview(null)
                  if (inputRef.current) inputRef.current.value = ""
                }}
                className="text-xs text-text-muted hover:text-text-secondary"
              >
                Trocar
              </button>
            </div>
          )}
        </div>

        <ModalFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleImport} disabled={!file || isPending}>
            {isPending ? "Importando..." : "Importar Curso"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
