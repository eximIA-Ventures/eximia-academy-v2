"use client"

import { createClient } from "@/lib/supabase/client"
import { MessageSquareText } from "lucide-react"
import { useEffect, useState } from "react"

interface Reflection {
  id: string
  student_id: string
  slide_id: string
  response: string
  updated_at: string
  student_name?: string
  slide_order?: number
}

interface ReflectionsViewerProps {
  chapterId: string
}

export function ReflectionsViewer({ chapterId }: ReflectionsViewerProps) {
  const [reflections, setReflections] = useState<Reflection[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      // Get slides for this chapter
      const { data: slides } = await supabase
        .from("chapter_slides")
        .select("id, order")
        .eq("chapter_id", chapterId)
        .order("order")

      if (!slides?.length) { setLoading(false); return }

      const slideIds = slides.map((s) => s.id)
      const slideMap = new Map(slides.map((s) => [s.id, s.order]))

      // Get reflections for these slides
      const { data: refs } = await supabase
        .from("slide_reflections")
        .select("id, student_id, slide_id, response, updated_at")
        .in("slide_id", slideIds)
        .order("updated_at", { ascending: false })

      if (!refs?.length) { setLoading(false); return }

      // Get student names
      const studentIds = [...new Set(refs.map((r) => r.student_id))]
      const { data: students } = await supabase
        .from("users")
        .select("id, full_name")
        .in("id", studentIds)

      const nameMap = new Map(students?.map((s) => [s.id, s.full_name]) ?? [])

      setReflections(
        refs.map((r) => ({
          ...r,
          student_name: nameMap.get(r.student_id) ?? "Aluno",
          slide_order: (slideMap.get(r.slide_id) ?? 0) + 1,
        }))
      )
      setLoading(false)
    }
    load()
  }, [chapterId])

  if (loading) {
    return (
      <div className="rounded-xl border border-border-subtle p-6 text-center text-sm text-text-muted">
        Carregando reflexões...
      </div>
    )
  }

  if (!reflections.length) {
    return (
      <div className="rounded-xl border border-border-subtle p-6 text-center">
        <MessageSquareText size={24} className="mx-auto mb-2 text-text-muted/40" />
        <p className="text-sm text-text-muted">Nenhuma reflexão registrada ainda.</p>
        <p className="text-xs text-text-muted/60 mt-1">As reflexões dos alunos aparecerão aqui conforme interagem com os slides.</p>
      </div>
    )
  }

  // Group by slide
  const bySlide = new Map<number, Reflection[]>()
  for (const r of reflections) {
    const order = r.slide_order ?? 0
    if (!bySlide.has(order)) bySlide.set(order, [])
    bySlide.get(order)!.push(r)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <MessageSquareText size={16} className="text-accent-teal" />
          Reflexões dos Alunos
        </h3>
        <span className="text-xs text-text-muted">
          {reflections.length} {reflections.length === 1 ? "resposta" : "respostas"}
        </span>
      </div>

      {[...bySlide.entries()].sort(([a], [b]) => a - b).map(([slideOrder, refs]) => (
        <div key={slideOrder} className="rounded-xl border border-border-subtle overflow-hidden">
          <div className="bg-bg-surface px-4 py-2 border-b border-border-subtle">
            <span className="text-xs font-medium text-text-muted">Slide {slideOrder}</span>
            <span className="text-xs text-text-muted/50 ml-2">· {refs.length} {refs.length === 1 ? "resposta" : "respostas"}</span>
          </div>
          <div className="divide-y divide-border-subtle">
            {refs.map((r) => (
              <div key={r.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-text-secondary">{r.student_name}</span>
                  <span className="text-[10px] text-text-muted/50">
                    {new Date(r.updated_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-sm text-text-primary/80 leading-relaxed">{r.response}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
