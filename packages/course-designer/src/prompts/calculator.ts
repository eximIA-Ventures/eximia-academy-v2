import type { ArchitectOutput } from "../schemas/architect"
import type { FrameworkConfig } from "../schemas/shared"

/**
 * Builds the prompt for the Calculator agent (Fase 3).
 * Includes instructions for CLT (Sweller), AGES framework, and chunk optimization.
 */
export function buildCalculatorPrompt(
  architectOutput: ArchitectOutput,
  totalDurationHours: number,
  frameworkConfig: FrameworkConfig,
): string {
  const totalMinutes = totalDurationHours * 60

  const moduleSummary = architectOutput.modules
    .map((m) => {
      const objectiveCount = m.objectives.length
      const bloomLevels = m.objectives.map((o) => o.bloom_level).join(", ")
      const stages = m.framework_stages.map((s) => `${s.key}(${s.percentage}%)`).join(", ")
      return `- Module ${m.order}: "${m.title}" | Spiral: ${m.spiral_level} | Objectives: ${objectiveCount} | Bloom: ${bloomLevels} | Stages: ${stages}`
    })
    .join("\n")

  const frameworkStages = frameworkConfig.stages
    .map((s) => `- ${s.id}: ${s.time_percentage}%`)
    .join("\n")

  return `You are an instructional time and cognitive load calculator [Harven_CourseCalculator]. Distribute time, analyze cognitive load, and optimize learning chunks.

## Course Architecture

**Total Duration:** ${totalDurationHours} hours (${totalMinutes} minutes)
**Total Modules:** ${architectOutput.course_structure.total_modules}
**Framework:** ${frameworkConfig.name}

### Module Summary
${moduleSummary}

### Framework Stage Time Distribution
${frameworkStages}

## Instructions

### A8: Duration Allocator
Distribute ${totalMinutes} minutes across all ${architectOutput.course_structure.total_modules} modules:

1. The SUM of all module total_minutes MUST equal ${totalMinutes} (tolerance: ±5%)
2. Within each module, distribute time across framework stages following the time_percentage values
3. per_stage keys must match the framework stage IDs: ${frameworkConfig.stages.map((s) => s.id).join(", ")}
4. More complex modules (higher spiral_level) may get proportionally more time

### A9: Cognitive Load Analyzer (CLT — Sweller)
For each module, evaluate:

1. **intrinsic_load**: Based on content complexity (concept difficulty, abstraction level)
2. **extraneous_load**: Based on presentation/structure quality
3. **germane_load**: Based on schema-building activities

**CLT Rule N1:** new_concepts_count MUST be ≤ 5 per module
- If > 5, set recommendation to split the module or redistribute
**CLT Rule:** concurrent_concepts MUST be ≤ 4 per chunk
- If > 4, flag as overloaded

**overall_balance:**
- "optimal": No module is overloaded, all concepts within limits
- "adjustable": Some warnings but manageable
- "overloaded": CLT rules violated, restructuring needed

Include warnings for any CLT violations.

### A10: Chunk Optimizer
Divide each module into chunks of 5-30 minutes:

1. **Types:** content, activity, assessment, break, reflection
2. **AGES Rule N2:** No continuous chunk > 30 minutes without a break
3. Vary chunk types (avoid 3+ consecutive content chunks)
4. Include at least 1 activity and 1 reflection per module
5. Sum of chunk durations per module MUST equal the module's total_minutes
6. Consider the audience attention span when sizing chunks

### attention_span_respected
Set to true if ALL modules respect cognitive load rules and chunk sizing.

### Pacing Strategy
1. **recommended_schedule**: Suggest a weekly/daily schedule
2. **spaced_repetition_points**: When to revisit key concepts (if course > 4 hours)
3. **break_pattern**: Recommended break frequency (e.g., "5-min break every 25 minutes")

Respond ONLY with the structured JSON matching the schema.`
}
