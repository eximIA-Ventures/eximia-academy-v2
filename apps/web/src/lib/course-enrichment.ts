import { createServiceClient } from "@/lib/supabase/service"
import { searchTavily } from "@/lib/tavily"
import { evaluateSources, generateSearchQueries, incorporateSources } from "@eximia/agents"
import * as Sentry from "@sentry/nextjs"

interface ChapterInput {
  id: string
  title: string
  content: string | null
  tenant_id: string
}

/**
 * Processes chapters sequentially, searching for and evaluating enrichment sources.
 * Uses the service client (bypasses RLS) since this runs in background.
 */
export async function processEnrichmentSearch(
  chapters: ChapterInput[],
  jobId: string,
  tenantId: string,
) {
  const serviceClient = createServiceClient()
  let completed = 0
  let failed = 0
  let totalSourcesFound = 0

  for (const chapter of chapters) {
    try {
      // Update progress
      await serviceClient
        .from("enrichment_jobs")
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

      if (!chapter.content || chapter.content.length < 100) {
        failed++
        continue
      }

      // Step 1: Generate search queries
      const queriesResult = await generateSearchQueries({
        chapterTitle: chapter.title,
        chapterContent: chapter.content.slice(0, 8000),
      })

      // Step 2: Execute searches via Tavily
      const allSearchResults: Array<{
        title: string
        url: string
        content: string
        query: string
      }> = []

      for (const q of queriesResult.queries) {
        try {
          const tavilyResult = await searchTavily(q.query, { maxResults: 3 })
          for (const r of tavilyResult.results) {
            allSearchResults.push({
              title: r.title,
              url: r.url,
              content: r.content,
              query: q.query,
            })
          }
        } catch (err) {
          console.error(`Tavily search failed for query "${q.query}":`, err)
        }
      }

      if (allSearchResults.length === 0) {
        completed++
        continue
      }

      // Step 3: AI evaluates sources
      const evaluation = await evaluateSources({
        chapterTitle: chapter.title,
        chapterContent: chapter.content.slice(0, 8000),
        searchResults: allSearchResults.map((r) => ({
          title: r.title,
          url: r.url,
          content: r.content,
        })),
      })

      // Step 4: Save sources with status "pending" (discard those marked as "discard")
      const sourcesToSave = evaluation.sources
        .filter((s) => s.recommended_action !== "discard")
        .map((s) => {
          const searchResult = allSearchResults.find((r) => r.url === s.url)
          return {
            job_id: jobId,
            chapter_id: chapter.id,
            tenant_id: tenantId,
            title: s.title,
            url: s.url,
            snippet: s.snippet,
            relevance_score: s.relevance_score,
            search_query: searchResult?.query ?? "",
            ai_rationale: s.rationale,
            status: "pending" as const,
          }
        })

      if (sourcesToSave.length > 0) {
        await serviceClient.from("enrichment_sources").insert(sourcesToSave)
        totalSourcesFound += sourcesToSave.length
      }

      completed++
    } catch (err) {
      console.error(`Enrichment failed for chapter ${chapter.id}:`, err)
      failed++
    }
  }

  // Finalize job
  const finalStatus = failed === chapters.length ? "failed" : "review"
  await serviceClient
    .from("enrichment_jobs")
    .update({
      status: finalStatus,
      progress: { total: chapters.length, completed, failed },
      total_sources_found: totalSourcesFound,
      error_message: failed > 0 ? `${failed} capítulo(s) falharam no enriquecimento` : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
}

/**
 * Applies approved sources to chapters.
 * - "incorporate": AI rewrites chapter content with sources
 * - "reference": Appends "Leitura Complementar" section at the end
 */
export async function applyApprovedSources(jobId: string) {
  const serviceClient = createServiceClient()

  // Mark job as applying
  await serviceClient
    .from("enrichment_jobs")
    .update({ status: "applying", updated_at: new Date().toISOString() })
    .eq("id", jobId)

  // Fetch all approved sources grouped by chapter
  const { data: approvedSources, error } = await serviceClient
    .from("enrichment_sources")
    .select("*")
    .eq("job_id", jobId)
    .eq("status", "approved")
    .order("chapter_id")

  if (error || !approvedSources?.length) {
    await serviceClient
      .from("enrichment_jobs")
      .update({
        status: "completed",
        sources_approved: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId)
    return
  }

  // Group by chapter
  const byChapter = new Map<string, typeof approvedSources>()
  for (const source of approvedSources) {
    const existing = byChapter.get(source.chapter_id) ?? []
    existing.push(source)
    byChapter.set(source.chapter_id, existing)
  }

  let applied = 0

  for (const [chapterId, sources] of byChapter) {
    try {
      // Fetch current chapter content
      const { data: chapter } = await serviceClient
        .from("chapters")
        .select("id, title, content")
        .eq("id", chapterId)
        .single()

      if (!chapter?.content) continue

      const toIncorporate = sources.filter((s) => s.action === "incorporate")
      const toReference = sources.filter((s) => s.action === "reference")

      let updatedContent = chapter.content

      // Handle incorporations via AI
      if (toIncorporate.length > 0) {
        const result = await incorporateSources({
          chapterTitle: chapter.title,
          chapterContent: updatedContent,
          sources: toIncorporate.map((s) => ({
            title: s.title,
            url: s.url,
            snippet: s.snippet ?? "",
          })),
        })
        updatedContent = result.rewritten_content
      }

      // Handle references — append "Leitura Complementar" section
      if (toReference.length > 0) {
        const refSection = [
          "",
          "---",
          "",
          "## Leitura Complementar",
          "",
          ...toReference.map((s) => `- [${s.title}](${s.url}) — ${s.snippet ?? ""}`),
        ].join("\n")

        updatedContent += refSection
      }

      // Update chapter content
      await serviceClient
        .from("chapters")
        .update({ content: updatedContent, updated_at: new Date().toISOString() })
        .eq("id", chapterId)

      // Mark sources as applied
      const sourceIds = sources.map((s) => s.id)
      await serviceClient
        .from("enrichment_sources")
        .update({ applied_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .in("id", sourceIds)

      applied += sources.length
    } catch (err) {
      console.error(`Failed to apply sources for chapter ${chapterId}:`, err)
    }
  }

  // Finalize
  await serviceClient
    .from("enrichment_jobs")
    .update({
      status: "completed",
      sources_approved: applied,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
}

/**
 * Creates an enrichment job and starts background processing.
 */
export async function startEnrichment(params: {
  courseId: string
  tenantId: string
  triggeredBy: string
}) {
  const { courseId, tenantId, triggeredBy } = params
  const serviceClient = createServiceClient()

  // Fetch published chapters
  const { data: chapters } = await serviceClient
    .from("chapters")
    .select("id, title, content, tenant_id")
    .eq("course_id", courseId)
    .eq("status", "published")
    .order("order", { ascending: true })

  if (!chapters?.length) {
    return { skipped: true, reason: "no_published_chapters" }
  }

  // Check for existing in-progress job
  const { data: existingJob } = await serviceClient
    .from("enrichment_jobs")
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
    .from("enrichment_jobs")
    .insert({
      course_id: courseId,
      tenant_id: tenantId,
      triggered_by: triggeredBy,
      status: "processing",
      progress: { total: chapters.length, completed: 0, failed: 0, current_chapter: "" },
    })
    .select()
    .single()

  if (jobError || !job) {
    console.error("Failed to create enrichment job:", jobError)
    return { error: "Erro ao criar job de enriquecimento" }
  }

  // Process in background (fire-and-forget)
  processEnrichmentSearch(chapters, job.id, tenantId).catch((err) => {
    Sentry.captureException(err, {
      tags: { job_id: job.id, course_id: courseId, agent: "Enricher" },
    })
    console.error("Enrichment processing error:", err)
  })

  return {
    jobId: job.id,
    chaptersToProcess: chapters.length,
  }
}
