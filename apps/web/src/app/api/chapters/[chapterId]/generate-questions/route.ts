export const maxDuration = 180 // 3 min for AI question generation

import { analyticsServer } from "@/lib/analytics-server"
import { setSentryContext } from "@/lib/sentry"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { type CreatorOutput, creatorInputSchema, generateQuestions } from "@eximia/agents"
import * as Sentry from "@sentry/nextjs"
import { NextResponse } from "next/server"

interface RouteContext {
  params: Promise<{ chapterId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { chapterId } = await context.params

  try {
    // Auth guard
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    setSentryContext(user.id, "", `/api/chapters/${chapterId}/generate-questions`)

    // Role guard
    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()

    if (!profile || !["manager", "admin", "instructor"].includes(profile.role)) {
      return NextResponse.json({ error: "Permissão negada" }, { status: 403 })
    }

    // Fetch chapter
    const { data: chapter } = await supabase
      .from("chapters")
      .select("id, title, content, learning_objective, status, tenant_id")
      .eq("id", chapterId)
      .single()

    if (!chapter) {
      return NextResponse.json({ error: "Capítulo não encontrado" }, { status: 404 })
    }

    if (chapter.status !== "published" && chapter.status !== "draft") {
      return NextResponse.json(
        { error: "Capítulo deve estar publicado ou em rascunho para gerar perguntas" },
        { status: 400 },
      )
    }

    // Check for replace mode
    const url = new URL(request.url)
    const replaceMode = url.searchParams.get("replace") === "true"

    if (replaceMode) {
      // Delete existing pending/rejected questions using service role
      const serviceClient = createServiceClient()
      await serviceClient
        .from("questions")
        .delete()
        .eq("chapter_id", chapterId)
        .eq("tenant_id", chapter.tenant_id)
        .in("status", ["pending", "rejected"])
    }

    // Validate input
    const input = creatorInputSchema.parse({
      chapter_content: chapter.content,
      chapter_title: chapter.title,
      learning_objective: chapter.learning_objective ?? undefined,
      max_questions: 3,
    })

    // Generate questions with retry
    let output: CreatorOutput | undefined
    let lastError: Error | null = null

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        output = await generateQuestions(input)
        break
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        if (attempt === 0) continue
      }
    }

    if (!output) {
      console.error("Failed to generate questions after 2 attempts:", lastError)
      return NextResponse.json(
        { error: "Nao foi possivel gerar perguntas. Tente novamente mais tarde." },
        { status: 500 },
      )
    }

    // Save questions to DB
    const questionsToInsert = output.questions.map((q) => ({
      chapter_id: chapterId,
      tenant_id: chapter.tenant_id,
      text: q.text,
      skill: q.skill,
      intention: q.intention,
      expected_depth: q.expected_depth,
      common_shallow_answer: q.common_shallow_answer,
      followup_prompts: q.followup_prompts,
      citations: q.citations,
      status: "pending" as const,
      metadata: {
        has_practical_scenario: q.has_practical_scenario ?? false,
        generation_metadata: output.metadata,
        analysis: output.analysis,
      },
    }))

    const { data: savedQuestions, error: insertError } = await supabase
      .from("questions")
      .insert(questionsToInsert)
      .select()

    if (insertError) {
      console.error("Error saving questions:", insertError)
      return NextResponse.json({ error: "Erro ao salvar perguntas geradas" }, { status: 500 })
    }

    analyticsServer.questionGenerated(user.id, chapterId, savedQuestions?.length ?? 0)

    return NextResponse.json({
      questions: savedQuestions,
      metadata: output.metadata,
      warnings: output.warnings,
    })
  } catch (err) {
    Sentry.captureException(err, {
      tags: { chapter_id: chapterId, route: "generate-questions" },
    })
    console.error("Generate questions error:", err)
    return NextResponse.json({ error: "Erro interno ao gerar perguntas" }, { status: 500 })
  }
}
