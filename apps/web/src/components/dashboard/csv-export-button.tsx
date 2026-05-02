"use client"

import { analytics } from "@/lib/analytics"
import { Button } from "@eximia/ui"
import { Download } from "lucide-react"
import type { CourseTableRow } from "./types"

interface CsvExportButtonProps {
  data: CourseTableRow[]
  aiDetectionEnabled: boolean
  courseFilter?: string
}

export function CsvExportButton({ data, aiDetectionEnabled, courseFilter }: CsvExportButtonProps) {
  const handleExport = () => {
    const headers = aiDetectionEnabled
      ? "titulo,alunos,conclusao_pct,profundidade_media,ai_detection_pct"
      : "titulo,alunos,conclusao_pct,profundidade_media"

    const rows = data
      .map((c) => {
        const base = `"${c.title}",${c.studentCount},${c.completionRate.toFixed(1)},${c.avgReflectionDepth.toFixed(2)}`
        return aiDetectionEnabled ? `${base},${c.avgAiDetection.toFixed(1)}` : base
      })
      .join("\n")

    const csv = `${headers}\n${rows}`
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `analytics-export-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)

    analytics.csvExported(data.length)
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport}>
      <Download size={16} className="mr-2" />
      Exportar CSV
    </Button>
  )
}
