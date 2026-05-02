import type { LanguageModel } from "ai"
import { startSpan } from "../telemetry"
import {
  type AnalyzerOutput,
  type ArchitectOutput,
  type Blueprint,
  type CalculatorOutput,
  type CourseDesignerInput,
  type FrameworkId,
  type ValidatorOutput,
  runAnalyzer,
  runArchitect,
  runCalculator,
  runGenerator,
  runValidator,
} from "@eximia/course-designer"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PhaseStatus = "running" | "completed" | "failed"

export interface PhaseProgress {
  phase: number
  status: PhaseStatus
  progress_pct: number
}

export interface PhaseResults {
  analyzer?: AnalyzerOutput
  architect?: ArchitectOutput
  calculator?: CalculatorOutput
  validator?: ValidatorOutput
  generator?: Blueprint
}

export interface DesignCourseOptions {
  input: CourseDesignerInput
  model: LanguageModel
  tenantId: string
  onProgress?: (progress: PhaseProgress) => void
  /** Resume from partial phase_results (retry parcial) */
  resumeFrom?: PhaseResults
  /** Signal to abort pipeline between phases (e.g. on SSE client disconnect) */
  abortSignal?: AbortSignal
}

export interface DesignCourseResult {
  blueprint: Blueprint
  phaseResults: PhaseResults
  retryCount: number
  totalDurationMs: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOTAL_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

// ---------------------------------------------------------------------------
// Design Orchestrator — Pipeline 5 Fases + Quality Gate (D14)
// ---------------------------------------------------------------------------

/**
 * Orchestrates the 5-phase Course Designer pipeline:
 * Phase 1: Analyzer  → Parse input, select framework, profile audience
 * Phase 2: Architect → Generate objectives, assessments, module sequence
 * Phase 3: Calculator → Allocate time, analyze cognitive load, optimize chunks
 * Phase 4: Validator → Check alignment, Bloom progression, quality scorecard
 * Phase 5: Generator → Build final blueprint JSON
 *
 * Quality Gate (D14): If verdict is needs_revision or poor, auto-retry 1x
 * silently (re-executes Architect → Calculator → Validator). If still fails,
 * sets requires_instructor_review = true on the blueprint.
 */
export async function designCourse(options: DesignCourseOptions): Promise<DesignCourseResult> {
  const { input, model, onProgress, resumeFrom, abortSignal } = options
  const startTime = Date.now()
  let retryCount = 0

  const phaseResults: PhaseResults = { ...resumeFrom }

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new DesignOrchestratorTimeoutError(phaseResults)),
      TOTAL_TIMEOUT_MS,
    )
  })

  // Abort promise — rejects when client disconnects (SSE cancel)
  const abortPromise = abortSignal
    ? new Promise<never>((_, reject) => {
        if (abortSignal.aborted) {
          reject(new DesignOrchestratorAbortError(phaseResults))
          return
        }
        abortSignal.addEventListener("abort", () => {
          reject(new DesignOrchestratorAbortError(phaseResults))
        }, { once: true })
      })
    : null

  const racers: Promise<Blueprint>[] = [
    runPipeline(input, model, phaseResults, onProgress, () => retryCount++, abortSignal),
    timeoutPromise,
  ]
  if (abortPromise) racers.push(abortPromise)

  try {
    const result = await Promise.race(racers)
    return {
      blueprint: result,
      phaseResults,
      retryCount,
      totalDurationMs: Date.now() - startTime,
    }
  } catch (error) {
    if (error instanceof DesignOrchestratorTimeoutError) {
      throw error
    }
    throw error
  }
}

// ---------------------------------------------------------------------------
// Internal Pipeline Execution
// ---------------------------------------------------------------------------

async function runPipeline(
  input: CourseDesignerInput,
  model: LanguageModel,
  phaseResults: PhaseResults,
  onProgress?: (progress: PhaseProgress) => void,
  onRetry?: () => void,
  abortSignal?: AbortSignal,
): Promise<Blueprint> {
  const notify = onProgress ?? (() => {})

  const checkAbort = () => {
    if (abortSignal?.aborted) {
      throw new DesignOrchestratorAbortError(phaseResults)
    }
  }

  // --- Phase 1: Analyzer ---
  if (!phaseResults.analyzer) {
    notify({ phase: 1, status: "running", progress_pct: 0 })
    phaseResults.analyzer = await startSpan(
      { name: "course-designer.analyzer", op: "ai.pipeline" },
      async (span) => {
        span.setAttribute("agent.name", "Analyzer")
        return await runAnalyzer(input, model)
      },
    )
    notify({ phase: 1, status: "completed", progress_pct: 20 })
  }

  const analyzerOutput = phaseResults.analyzer
  const frameworkId = analyzerOutput.selected_framework.primary as FrameworkId

  checkAbort()

  // --- Phase 2: Architect ---
  notify({ phase: 2, status: "running", progress_pct: 20 })
  phaseResults.architect = await startSpan(
    { name: "course-designer.architect", op: "ai.pipeline" },
    async (span) => {
      span.setAttribute("agent.name", "Architect")
      return await runArchitect(input, analyzerOutput, model)
    },
  )
  notify({ phase: 2, status: "completed", progress_pct: 40 })

  checkAbort()

  // --- Phase 3: Calculator ---
  notify({ phase: 3, status: "running", progress_pct: 40 })
  phaseResults.calculator = await startSpan(
    { name: "course-designer.calculator", op: "ai.pipeline" },
    async (span) => {
      span.setAttribute("agent.name", "Calculator")
      return await runCalculator(
        phaseResults.architect!,
        input.total_duration_hours,
        frameworkId,
        model,
      )
    },
  )
  notify({ phase: 3, status: "completed", progress_pct: 60 })

  checkAbort()

  // --- Phase 4: Validator ---
  notify({ phase: 4, status: "running", progress_pct: 60 })
  phaseResults.validator = await startSpan(
    { name: "course-designer.validator", op: "ai.pipeline" },
    async (span) => {
      span.setAttribute("agent.name", "Validator")
      return await runValidator(
        analyzerOutput,
        phaseResults.architect!,
        phaseResults.calculator!,
        model,
      )
    },
  )
  notify({ phase: 4, status: "completed", progress_pct: 80 })

  // --- Quality Gate (D14): auto-retry 1x if needs_revision or poor ---
  const verdict = phaseResults.validator.verdict
  if (verdict === "needs_revision" || verdict === "poor") {
    onRetry?.()
    const recommendations = phaseResults.validator.recommendations?.join("; ") ?? ""

    // Re-execute Architect → Calculator → Validator with revision_feedback
    notify({ phase: 2, status: "running", progress_pct: 40 })
    phaseResults.architect = await startSpan(
      { name: "course-designer.architect.retry", op: "ai.pipeline" },
      async (span) => {
        span.setAttribute("agent.name", "Architect")
        span.setAttribute("retry", true)
        return await runArchitect(input, analyzerOutput, model, recommendations)
      },
    )
    notify({ phase: 2, status: "completed", progress_pct: 50 })

    checkAbort()

    notify({ phase: 3, status: "running", progress_pct: 50 })
    phaseResults.calculator = await startSpan(
      { name: "course-designer.calculator.retry", op: "ai.pipeline" },
      async (span) => {
        span.setAttribute("agent.name", "Calculator")
        span.setAttribute("retry", true)
        return await runCalculator(
          phaseResults.architect!,
          input.total_duration_hours,
          frameworkId,
          model,
        )
      },
    )
    notify({ phase: 3, status: "completed", progress_pct: 60 })

    checkAbort()

    notify({ phase: 4, status: "running", progress_pct: 60 })
    phaseResults.validator = await startSpan(
      { name: "course-designer.validator.retry", op: "ai.pipeline" },
      async (span) => {
        span.setAttribute("agent.name", "Validator")
        span.setAttribute("retry", true)
        return await runValidator(
          analyzerOutput,
          phaseResults.architect!,
          phaseResults.calculator!,
          model,
        )
      },
    )
    notify({ phase: 4, status: "completed", progress_pct: 80 })
  }

  checkAbort()

  // --- Phase 5: Generator ---
  notify({ phase: 5, status: "running", progress_pct: 80 })
  phaseResults.generator = await startSpan(
    { name: "course-designer.generator", op: "ai.pipeline" },
    async (span) => {
      span.setAttribute("agent.name", "Generator")
      return await runGenerator(
        analyzerOutput,
        phaseResults.architect!,
        phaseResults.calculator!,
        phaseResults.validator!,
        input.course_title,
        input.language ?? "pt-br",
        input.interaction_strategy ?? "bloom_mapped",
        input.total_duration_hours,
        input.target_audience.role,
        model,
      )
    },
  )
  notify({ phase: 5, status: "completed", progress_pct: 100 })

  // Flag for instructor review if still needs_revision/poor after retry
  const finalVerdict = phaseResults.validator!.verdict
  if (finalVerdict === "needs_revision" || finalVerdict === "poor") {
    phaseResults.generator.requires_instructor_review = true
  }

  return phaseResults.generator
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class DesignOrchestratorTimeoutError extends Error {
  public readonly phaseResults: PhaseResults

  constructor(phaseResults: PhaseResults) {
    super("Design Orchestrator timed out after 5 minutes")
    this.name = "DesignOrchestratorTimeoutError"
    this.phaseResults = phaseResults
  }
}

export class DesignOrchestratorAbortError extends Error {
  public readonly phaseResults: PhaseResults

  constructor(phaseResults: PhaseResults) {
    super("Design Orchestrator aborted by client disconnect")
    this.name = "DesignOrchestratorAbortError"
    this.phaseResults = phaseResults
  }
}
