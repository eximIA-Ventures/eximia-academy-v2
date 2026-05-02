import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

interface RouteContext {
  params: Promise<{ jobId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { jobId } = await context.params
  const url = new URL(request.url)
  const format = url.searchParams.get("format") ?? "csv"

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  // Role guard
  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()

  if (!profile || !["manager", "admin", "instructor"].includes(profile.role)) {
    return NextResponse.json({ error: "Permissão negada" }, { status: 403 })
  }

  // Fetch sources with chapter info
  const { data: sources, error } = await supabase
    .from("enrichment_sources")
    .select(
      "title, url, snippet, relevance_score, status, action, search_query, ai_rationale, chapter_id",
    )
    .eq("job_id", jobId)
    .order("chapter_id")

  if (error) {
    return NextResponse.json({ error: "Erro ao buscar fontes" }, { status: 500 })
  }

  if (!sources?.length) {
    return NextResponse.json({ error: "Nenhuma fonte encontrada" }, { status: 404 })
  }

  // Fetch chapter titles
  const chapterIds = [...new Set(sources.map((s) => s.chapter_id))]
  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, title")
    .in("id", chapterIds)

  const chapterMap = new Map((chapters ?? []).map((c) => [c.id, c.title]))

  if (format === "csv") {
    const header = "Capítulo,Titulo,URL,Trecho,Score,Status,Acao,Query,Rationale"
    const rows = sources.map((s) => {
      const chapterTitle = chapterMap.get(s.chapter_id) ?? ""
      return [
        escapeCsv(chapterTitle),
        escapeCsv(s.title),
        escapeCsv(s.url),
        escapeCsv(s.snippet ?? ""),
        String(s.relevance_score ?? 0),
        s.status,
        s.action ?? "",
        escapeCsv(s.search_query ?? ""),
        escapeCsv(s.ai_rationale ?? ""),
      ].join(",")
    })

    const csv = [header, ...rows].join("\n")

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="enrichment-${jobId}.csv"`,
      },
    })
  }

  if (format === "pdf") {
    // Generate a simple HTML-to-text PDF representation
    const lines = [
      "RELATORIO DE ENRIQUECIMENTO",
      `Job ID: ${jobId}`,
      `Exportado em: ${new Date().toISOString()}`,
      `Total de fontes: ${sources.length}`,
      "",
      "=".repeat(60),
      "",
    ]

    let currentChapter = ""
    for (const s of sources) {
      const chapterTitle = chapterMap.get(s.chapter_id) ?? "Sem titulo"
      if (chapterTitle !== currentChapter) {
        currentChapter = chapterTitle
        lines.push(`CAPITULO: ${chapterTitle}`, "-".repeat(40))
      }
      lines.push(
        `  Titulo: ${s.title}`,
        `  URL: ${s.url}`,
        `  Trecho: ${s.snippet ?? "N/A"}`,
        `  Score: ${s.relevance_score ?? 0}`,
        `  Status: ${s.status}`,
        `  Acao: ${s.action ?? "N/A"}`,
        `  Rationale: ${s.ai_rationale ?? "N/A"}`,
        "",
      )
    }

    const text = lines.join("\n")

    return new Response(text, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="enrichment-${jobId}.txt"`,
      },
    })
  }

  return NextResponse.json({ error: "Formato inválido. Use csv ou pdf." }, { status: 400 })
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
