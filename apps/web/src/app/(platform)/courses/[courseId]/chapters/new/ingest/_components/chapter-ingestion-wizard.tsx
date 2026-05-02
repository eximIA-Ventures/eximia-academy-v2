"use client"

import { FileDropzone } from "@/app/(platform)/courses/new/ingest/_components/file-dropzone"
import { ProcessingStatus } from "@/app/(platform)/courses/new/ingest/_components/processing-status"
import { TextPasteInput } from "@/app/(platform)/courses/new/ingest/_components/text-paste-input"
import { VideoUrlInput } from "@/app/(platform)/courses/new/ingest/_components/video-url-input"
import type { OrganizerOutput } from "@eximia/agents"
import { useToast } from "@eximia/ui"
import { useState } from "react"
import { ChapterPreview } from "./chapter-preview"

type WizardStep = "source" | "processing" | "preview"

interface ChapterIngestionWizardProps {
  courseId: string
}

export function ChapterIngestionWizard({ courseId }: ChapterIngestionWizardProps) {
  const [step, setStep] = useState<WizardStep>("source")
  const [ingestionId, setIngestionId] = useState<string | null>(null)
  const [aiOutput, setAiOutput] = useState<OrganizerOutput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  async function handleSourceSubmit(id: string) {
    if (isSubmitting) return
    setIsSubmitting(true)
    setIngestionId(id)
    setStep("processing")
    setError(null)

    try {
      const res = await fetch(`/api/ingestion/${id}/process`, { method: "POST" })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Erro ao processar conteúdo.")
        setStep("source")
        toast({ variant: "error", title: data.error || "Erro ao processar." })
        return
      }

      if (data.output) {
        setAiOutput(data.output)
        setStep("preview")
      }
    } catch {
      setError("Erro de conexão. Tente novamente.")
      setStep("source")
      toast({ variant: "error", title: "Erro de conexão." })
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleProcessingComplete(output: OrganizerOutput) {
    setAiOutput(output)
    setStep("preview")
  }

  function handleProcessingError(message: string) {
    setError(message)
    setStep("source")
    toast({ variant: "error", title: message })
  }

  function handleReset() {
    setStep("source")
    setIngestionId(null)
    setAiOutput(null)
    setError(null)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary">Importar Capítulo com IA</h1>
      <p className="mt-1 text-sm text-text-secondary">
        {step === "source" && "Envie seu conteúdo e a IA gerara o capítulo automaticamente."}
        {step === "processing" && "Processando seu conteúdo..."}
        {step === "preview" && "Revise o capítulo gerado pela IA antes de criar."}
      </p>

      {/* Step indicators */}
      <div className="mt-6 mb-8 flex items-center gap-2">
        {(["source", "processing", "preview"] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                step === s
                  ? "bg-accent-blue-mid text-white"
                  : i < ["source", "processing", "preview"].indexOf(step)
                    ? "bg-accent-blue-mid/20 text-accent-blue-mid"
                    : "bg-bg-elevated text-text-muted"
              }`}
            >
              {i + 1}
            </div>
            <span
              className={`text-sm ${step === s ? "font-medium text-text-primary" : "text-text-muted"}`}
            >
              {s === "source" && "Fonte"}
              {s === "processing" && "Processamento"}
              {s === "preview" && "Revisao"}
            </span>
            {i < 2 && <div className="mx-2 h-px w-8 bg-bg-elevated" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-semantic-error/30 bg-semantic-error/10 p-3 text-sm text-semantic-error">
          {error}
        </div>
      )}

      {step === "source" && <SourceStep onSubmit={handleSourceSubmit} courseId={courseId} />}

      {step === "processing" && ingestionId && (
        <ProcessingStatus
          ingestionId={ingestionId}
          onComplete={handleProcessingComplete}
          onError={handleProcessingError}
          onCancel={handleReset}
        />
      )}

      {step === "preview" && aiOutput && ingestionId && (
        <ChapterPreview
          courseId={courseId}
          ingestionId={ingestionId}
          output={aiOutput}
          onOutputChange={setAiOutput}
          onBack={handleReset}
        />
      )}
    </div>
  )
}

function SourceStep({ onSubmit, courseId }: { onSubmit: (id: string) => void; courseId: string }) {
  const [activeTab, setActiveTab] = useState<"upload" | "paste" | "video">("upload")

  return (
    <div>
      {/* Tab selector */}
      <div className="flex gap-1 rounded-lg bg-bg-elevated p-1">
        {(
          [
            { key: "upload", label: "Upload Arquivo" },
            { key: "paste", label: "Colar Texto" },
            { key: "video", label: "URL de Video" },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === key
                ? "bg-bg-card text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {activeTab === "upload" && <FileDropzone onSubmit={onSubmit} courseId={courseId} />}
        {activeTab === "paste" && <TextPasteInput onSubmit={onSubmit} courseId={courseId} />}
        {activeTab === "video" && <VideoUrlInput onSubmit={onSubmit} courseId={courseId} />}
      </div>
    </div>
  )
}
