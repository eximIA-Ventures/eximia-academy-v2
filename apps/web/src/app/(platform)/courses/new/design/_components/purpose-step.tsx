"use client"

import { useFormContext } from "react-hook-form"
import { Input, Label, Textarea, Button, Badge, useToast } from "@eximia/ui"
import type { CourseDesignerInput } from "@eximia/course-designer"
import { Plus, X, Upload, FileText, Loader2 } from "lucide-react"
import { useState, useRef } from "react"

export function PurposeStep() {
  const {
    register,
    formState: { errors },
    watch,
    setValue,
    getValues,
  } = useFormContext<CourseDesignerInput>()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [metricInput, setMetricInput] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const metrics = watch("success_metrics") ?? []
  const contextFiles = watch("context_files") ?? []

  const addMetric = () => {
    const trimmed = metricInput.trim()
    if (!trimmed) return
    setValue("success_metrics", [...metrics, trimmed])
    setMetricInput("")
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      toast({ variant: "error", title: "Arquivo excede 10MB" })
      return
    }

    const currentFiles = getValues("context_files") ?? []
    const fileIndex = currentFiles.length
    const newFile = {
      name: file.name,
      type: file.name.split(".").pop() as "pdf" | "pptx" | "docx" | "txt",
    }
    setValue("context_files", [...currentFiles, newFile])

    setIsAnalyzing(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/course-designer/analyze-content", {
        method: "POST",
        body: formData,
      })

      if (res.ok) {
        const analysis = await res.json()
        // Save content_summary in the context_files entry
        const updatedFiles = getValues("context_files") ?? []
        if (updatedFiles[fileIndex]) {
          updatedFiles[fileIndex] = {
            ...updatedFiles[fileIndex],
            content_summary: analysis.content_summary,
          }
          setValue("context_files", [...updatedFiles])
        }
        // Auto-populate topics and competencies
        const currentTopics = getValues("topics_outline") ?? []
        if (analysis.topics_extracted?.length) {
          const newTopics = analysis.topics_extracted.map(
            (t: { title: string }) => t.title,
          )
          setValue("topics_outline", [...currentTopics, ...newTopics])
        }
        const currentCompetencies = getValues("core_competencies") ?? []
        if (analysis.competencies_suggested?.length) {
          setValue("core_competencies", [
            ...currentCompetencies,
            ...analysis.competencies_suggested,
          ])
        }
        toast({ variant: "success", title: "Conteúdo analisado com sucesso" })
      }
    } catch {
      toast({ variant: "error", title: "Erro ao analisar arquivo" })
    } finally {
      setIsAnalyzing(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const removeMetric = (index: number) => {
    setValue(
      "success_metrics",
      metrics.filter((_, i) => i !== index),
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">
          1. Propósito do Curso
        </h2>
        <p className="text-sm text-text-secondary">
          Defina o objetivo de negócio e a mudança comportamental esperada
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="course_title">
            Título do Curso <span className="text-semantic-error">*</span>
          </Label>
          <Input
            id="course_title"
            placeholder="Ex: Liderança Situacional para Gestores"
            {...register("course_title")}
          />
          {errors.course_title && (
            <p className="text-sm text-semantic-error">
              {errors.course_title.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="business_goal">
            Objetivo de Negócio <span className="text-semantic-error">*</span>
          </Label>
          <p className="text-xs text-text-muted">
            O que a organização ganha com este treinamento?
          </p>
          <Textarea
            id="business_goal"
            rows={3}
            placeholder="Ex: Reduzir turnover de equipes em 20% nos próximos 6 meses"
            {...register("business_goal")}
          />
          {errors.business_goal && (
            <p className="text-sm text-semantic-error">
              {errors.business_goal.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="behavior_change">
            Mudança Comportamental <span className="text-semantic-error">*</span>
          </Label>
          <p className="text-xs text-text-muted">
            O que muda no dia-a-dia do participante após o curso?
          </p>
          <Textarea
            id="behavior_change"
            rows={3}
            placeholder="Ex: Gestores adaptam estilo de liderança conforme maturidade do liderado"
            {...register("behavior_change")}
          />
          {errors.behavior_change && (
            <p className="text-sm text-semantic-error">
              {errors.behavior_change.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Métricas de Sucesso (opcional)</Label>
          <div className="flex gap-2">
            <Input
              value={metricInput}
              onChange={(e) => setMetricInput(e.target.value)}
              placeholder="Ex: NPS > 8.5 nos treinamentos"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  addMetric()
                }
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={addMetric}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {metrics.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {metrics.map((metric, i) => (
                <Badge key={i} variant="default" className="gap-1">
                  {metric}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={() => removeMetric(i)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") removeMetric(i) }}
                    className="cursor-pointer rounded-full p-0.5 text-text-muted transition-colors hover:bg-semantic-error/20 hover:text-semantic-error"
                  >
                    <X className="h-3 w-3" />
                  </span>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="problem_statement">Declaração do Problema (opcional)</Label>
          <Textarea
            id="problem_statement"
            rows={2}
            placeholder="Contexto adicional sobre o problema que motivou a criação deste curso"
            {...register("problem_statement")}
          />
        </div>

        {/* File Upload — Reference Documents */}
        <div className="space-y-2">
          <Label>Material de Referência (PDF, PPTX, DOCX, TXT)</Label>
          <p className="text-xs text-text-muted">
            Suba documentos para que a IA use o conteúdo ao preencher as próximas etapas
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.pptx,.docx,.txt"
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isAnalyzing}
            className="flex w-full items-center justify-center gap-2 border-2 border-dashed border-border-medium bg-bg-surface p-6 text-text-secondary transition-colors hover:border-cerrado-600 hover:text-text-primary"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Analisando conteúdo...
              </>
            ) : (
              <>
                <Upload className="h-5 w-5" />
                Fazer upload de arquivo (max 10MB)
              </>
            )}
          </Button>
          {contextFiles.length > 0 && (
            <div className="space-y-1">
              {contextFiles.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-md bg-bg-elevated px-3 py-2 text-sm"
                >
                  <FileText className="h-4 w-4 text-cerrado-600" />
                  <span className="text-text-primary">{f.name}</span>
                  <span className="text-text-muted">.{f.type}</span>
                  {f.content_summary && (
                    <Badge variant="default" className="ml-1 text-xs">
                      analisado
                    </Badge>
                  )}
                  <span
                    role="button"
                    tabIndex={0}
                    className="ml-auto cursor-pointer rounded p-1 text-text-muted transition-colors hover:bg-semantic-error/20 hover:text-semantic-error"
                    onClick={() =>
                      setValue(
                        "context_files",
                        contextFiles.filter((_, idx) => idx !== i),
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ")
                        setValue(
                          "context_files",
                          contextFiles.filter((_, idx) => idx !== i),
                        )
                    }}
                  >
                    <X className="h-4 w-4" />
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
