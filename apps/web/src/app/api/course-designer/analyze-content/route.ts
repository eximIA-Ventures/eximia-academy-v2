export const maxDuration = 120 // 2 min

import { contentAnalysisLimiter } from "@/lib/rate-limit"
import { createClient } from "@/lib/supabase/server"
import { getModelWithFallback } from "@eximia/agents"
import { analyzeContent } from "@eximia/agents/course-designer/content-analyzer"
import * as Sentry from "@sentry/nextjs"
import { NextResponse } from "next/server"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
])

/**
 * POST /api/course-designer/analyze-content
 * Accepts file upload (PDF, PPTX, DOCX, TXT), extracts text, analyzes via LLM.
 * Rate limit: 5/hour per tenant.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single()

  if (!profile || !["manager", "admin", "super_admin", "instructor"].includes(profile.role)) {
    return NextResponse.json({ error: "Permissão negada" }, { status: 403 })
  }

  if (contentAnalysisLimiter) {
    const { success } = await contentAnalysisLimiter.limit(profile.tenant_id)
    if (!success) {
      return NextResponse.json(
        { error: "Limite de analises atingido (max 5/hora)" },
        { status: 429 },
      )
    }
  }

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "Arquivo nao enviado" }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Arquivo excede limite de ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 },
      )
    }

    if (!ALLOWED_TYPES.has(file.type) && !file.name.endsWith(".txt")) {
      return NextResponse.json(
        { error: "Tipo de arquivo nao suportado. Use PDF, PPTX, DOCX ou TXT." },
        { status: 400 },
      )
    }

    // Extract text from file
    const textContent = await extractText(file)

    if (!textContent || textContent.trim().length < 50) {
      return NextResponse.json(
        { error: "Nao foi possivel extrair texto suficiente do arquivo" },
        { status: 422 },
      )
    }

    // Analyze via LLM
    const model = getModelWithFallback({
      agentRole: "analyst",
      tenantPlan: "standard",
    })

    const result = await analyzeContent(textContent, file.name, model)

    return NextResponse.json(result)
  } catch (err) {
    Sentry.captureException(err, {
      tags: { route: "analyze-content", tenant_id: profile.tenant_id },
    })
    console.error("Content analysis error:", err)
    return NextResponse.json({ error: "Erro ao analisar conteúdo" }, { status: 500 })
  }
}

/**
 * Extracts text from uploaded file.
 * For TXT: direct text. For PDF: pdf-parse. For DOCX: mammoth. For PPTX: jszip XML.
 * D15: LLM-only approach — we extract raw text, LLM does the analysis.
 */
async function extractText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer())

  // TXT: direct
  if (file.type === "text/plain" || file.name.endsWith(".txt")) {
    return buffer.toString("utf-8")
  }

  // PDF: pdf-parse v2 (class-based API)
  if (file.type === "application/pdf") {
    const { PDFParse } = await import("pdf-parse")
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    const result = await parser.getText()
    await parser.destroy()
    return result.text
  }

  // DOCX: mammoth
  if (
    file.type ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const mammoth = await import("mammoth")
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }

  // PPTX: jszip to extract slide XML text
  if (
    file.type ===
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    const JSZip = (await import("jszip")).default
    const zip = await JSZip.loadAsync(buffer)
    const slideTexts: string[] = []

    // Slides are in ppt/slides/slide1.xml, slide2.xml, etc.
    const slideFiles = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort()

    for (const slidePath of slideFiles) {
      const xml = await zip.files[slidePath].async("text")
      // Strip XML tags to get plain text
      const text = xml
        .replace(/<a:t[^>]*>/gi, "")
        .replace(/<\/a:t>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
      if (text) slideTexts.push(text)
    }

    return slideTexts.join("\n\n---\n\n")
  }

  return ""
}
