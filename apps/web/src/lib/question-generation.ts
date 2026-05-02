import { createServiceClient } from "@/lib/supabase/service"
import { creatorInputSchema, generateQuestions } from "@eximia/agents"
import * as Sentry from "@sentry/nextjs"

interface ChapterInput {
  id: string
  title: string
  content: string | null
  learning_objective: string | null
  tenant_id: string
}

/**
 * Processes chapters sequentially, generating questions for each.
 * Uses the service client (bypasses RLS) since this runs in background.
 */
export async function processChaptersSequentially(
  chapters: ChapterInput[],
  jobId: string,
  tenantId: string,
) {
  const serviceClient = createServiceClient()
  let completed = 0
  let failed = 0
  let totalGenerated = 0

  for (const chapter of chapters) {
    try {
      // Update progress
      await serviceClient
        .from("question_generation_jobs")
        .update({
          progress: {
            total: chapters.length,
            completed,
            failed,
            current_chapter: chapter.title,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId)

      // Validate content length
      if (!chapter.content || chapter.content.length < 100) {
        failed++
        continue
      }

      // Validate and parse input
      const input = creatorInputSchema.parse({
        chapter_content: chapter.content,
        chapter_title: chapter.title,
        learning_objective: chapter.learning_objective ?? undefined,
        max_questions: 3,
      })

      // Generate with retry
      let output: Awaited<ReturnType<typeof generateQuestions>> | undefined
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          output = await generateQuestions(input)
          break
        } catch (err) {
          console.error(`[BatchGen] Chapter "${chapter.title}" attempt ${attempt + 1} failed:`, err)
          if (attempt === 1) throw err
        }
      }

      if (!output) throw new Error("Failed to generate questions")

      // Save questions with job_id
      const questionsToInsert = output.questions.map((q) => ({
        chapter_id: chapter.id,
        tenant_id: tenantId,
        text: q.text,
        skill: q.skill,
        intention: q.intention,
        expected_depth: q.expected_depth,
        common_shallow_answer: q.common_shallow_answer,
        followup_prompts: q.followup_prompts,
        citations: q.citations,
        status: "pending" as const,
        job_id: jobId,
        metadata: {
          has_practical_scenario: q.has_practical_scenario ?? false,
          generation_metadata: output.metadata,
          analysis: output.analysis,
        },
      }))

      await serviceClient.from("questions").insert(questionsToInsert)
      totalGenerated += questionsToInsert.length
      completed++
    } catch (err) {
      console.error(`Failed for chapter ${chapter.id}:`, err)
      failed++
    }
  }

  // Finalize job
  const finalStatus = failed === chapters.length ? "failed" : "review"
  await serviceClient
    .from("question_generation_jobs")
    .update({
      status: finalStatus,
      progress: { total: chapters.length, completed, failed },
      questions_generated: totalGenerated,
      error_message: failed > 0 ? `${failed} capítulo(s) falharam na geração` : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
}

/**
 * Creates a generation job and starts background processing.
 * Uses the service client to bypass RLS for background operations.
 * Can be called from API routes or server actions directly.
 */
export async function startBatchGeneration(params: {
  courseId: string
  tenantId: string
  triggeredBy: string
}) {
  const { courseId, tenantId, triggeredBy } = params
  const serviceClient = createServiceClient()

  // Fetch published chapters
  const { data: chapters } = await serviceClient
    .from("chapters")
    .select("id, title, content, learning_objective, tenant_id")
    .eq("course_id", courseId)
    .eq("status", "published")
    .order("order", { ascending: true })

  if (!chapters?.length) {
    return { skipped: true, reason: "no_published_chapters" }
  }

  // Filter chapters that already have active questions
  const { data: activeQuestions } = await serviceClient
    .from("questions")
    .select("chapter_id")
    .eq("status", "active")
    .in(
      "chapter_id",
      chapters.map((c) => c.id),
    )

  const withActive = new Set(activeQuestions?.map((q) => q.chapter_id))
  const toProcess = chapters.filter((c) => !withActive.has(c.id))

  if (toProcess.length === 0) {
    return { skipped: true, reason: "all_chapters_have_questions" }
  }

  // Check for existing in-progress job
  const { data: existingJob } = await serviceClient
    .from("question_generation_jobs")
    .select("id")
    .eq("course_id", courseId)
    .in("status", ["pending", "processing"])
    .limit(1)
    .maybeSingle()

  if (existingJob) {
    return { skipped: true, reason: "job_already_in_progress" }
  }

  // Create job
  const { data: job, error: jobError } = await serviceClient
    .from("question_generation_jobs")
    .insert({
      course_id: courseId,
      tenant_id: tenantId,
      triggered_by: triggeredBy,
      scope: "course",
      status: "processing",
      progress: { total: toProcess.length, completed: 0, failed: 0, current_chapter: "" },
    })
    .select()
    .single()

  if (jobError || !job) {
    console.error("Failed to create job:", jobError)
    return { error: "Erro ao criar job de geração" }
  }

  // Process in background (fire-and-forget)
  processChaptersSequentially(toProcess, job.id, tenantId).catch((err) => {
    Sentry.captureException(err, {
      tags: { job_id: job.id, course_id: courseId, agent: "BatchCreator" },
    })
    console.error("Batch generation error:", err)
  })

  return {
    jobId: job.id,
    chaptersToProcess: toProcess.length,
  }
}
