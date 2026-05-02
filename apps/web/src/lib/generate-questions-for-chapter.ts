import { createServiceClient } from "@/lib/supabase/service"
import { creatorInputSchema, generateQuestions } from "@eximia/agents"

/**
 * Generates questions for a single chapter (fire-and-forget, no job tracking).
 * Uses service client to bypass RLS since this runs in background.
 */
export async function generateQuestionsForChapter(params: {
  chapterId: string
  title: string
  content: string
  learningObjective?: string
  tenantId: string
}) {
  const { chapterId, title, content, learningObjective, tenantId } = params

  if (content.length < 100) return

  const input = creatorInputSchema.parse({
    chapter_content: content,
    chapter_title: title,
    learning_objective: learningObjective,
    max_questions: 3,
  })

  // Generate with retry (2 attempts)
  let output: Awaited<ReturnType<typeof generateQuestions>> | undefined
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      output = await generateQuestions(input)
      break
    } catch (err) {
      if (attempt === 1) throw err
    }
  }

  if (!output) return

  const serviceClient = createServiceClient()
  const questionsToInsert = output.questions.map((q) => ({
    chapter_id: chapterId,
    tenant_id: tenantId,
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

  await serviceClient.from("questions").insert(questionsToInsert)
}
