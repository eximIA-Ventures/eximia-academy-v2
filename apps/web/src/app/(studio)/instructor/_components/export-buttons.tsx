"use client"

import { Button } from "@eximia/ui"
import { Download } from "lucide-react"
import { analytics } from "@/lib/analytics"
import type { StudentDetail, TenantReflection } from "../actions"

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${(cell ?? "").replace(/"/g, '""')}"`).join(",")),
  ].join("\n")

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function ExportStudentsButton({ students }: { students: StudentDetail[] }) {
  function handleExport() {
    const headers = ["Nome", "Email", "Sessões", "Sessões Concluídas", "Reflexões", "Cursos", "Último Acesso"]
    const rows = students.map((s) => [
      s.full_name,
      s.email,
      String(s.totalSessions),
      String(s.completedSessions),
      String(s.reflectionsCount),
      String(s.coursesEnrolled),
      s.lastSessionDate ? new Date(s.lastSessionDate).toLocaleDateString("pt-BR") : "—",
    ])
    downloadCsv(`alunos-${new Date().toISOString().split("T")[0]}.csv`, headers, rows)
    analytics.csvExported(rows.length)
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
      <Download size={14} /> Exportar Alunos
    </Button>
  )
}

export function ExportReflectionsButton({ reflections }: { reflections: TenantReflection[] }) {
  function handleExport() {
    const headers = ["Aluno", "Capítulo", "Slide", "Reflexão", "Resposta IA", "Data"]
    const rows = reflections.map((r) => [
      r.studentName,
      r.chapterTitle,
      String(r.slideOrder),
      r.response,
      r.hasAiResponse ? "Sim" : "Não",
      new Date(r.createdAt).toLocaleDateString("pt-BR"),
    ])
    downloadCsv(`reflexoes-${new Date().toISOString().split("T")[0]}.csv`, headers, rows)
    analytics.csvExported(rows.length)
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
      <Download size={14} /> Exportar Reflexões
    </Button>
  )
}
