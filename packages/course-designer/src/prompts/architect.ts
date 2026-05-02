import type { AnalyzerOutput } from "../schemas/analyzer"
import type { CourseDesignerInput } from "../schemas/input"
import type { FrameworkConfig } from "../schemas/shared"

/**
 * Builds the prompt for the Architect agent (Fase 2).
 * Includes instructions for ABCD objectives, Backward Design, Bloom progression,
 * Problema-Motor, and bloom_mapped interaction types.
 */
export function buildArchitectPrompt(
  input: CourseDesignerInput,
  analyzerOutput: AnalyzerOutput,
  frameworkConfig: FrameworkConfig,
  revisionFeedback?: string,
): string {
  const durationToScope = getDurationScopeMapping(input.total_duration_hours)

  const frameworkStages = frameworkConfig.stages
    .map((s) => `- ${s.id}: ${s.name} (${s.time_percentage}%) — ${s.purpose}`)
    .join("\n")

  const spiralInfo = frameworkConfig.sequencing.levels
    ? frameworkConfig.sequencing.levels
        .map((l) => `- ${l.id}: ${l.name} (${l.position}, modules ${l.modules_range})`)
        .join("\n")
    : "Linear sequencing (no spiral levels defined)"

  const revisionSection = revisionFeedback
    ? `\n## REVISION REQUIRED\nThe previous output was rejected by the Quality Gate. Address the following feedback:\n${revisionFeedback}\n`
    : ""

  return `You are a senior instructional architect [Harven_CourseArchitect]. Design a complete course structure based on the analysis below.
${revisionSection}
## Course Brief

**Title:** ${input.course_title}
**Business Goal:** ${input.business_goal}
**Behavior Change:** ${input.behavior_change}
**Total Duration:** ${input.total_duration_hours} hours
**Language:** ${input.language}

## Analyzer Output

### Selected Framework
- Primary: ${analyzerOutput.selected_framework.primary}
- Complementary: ${analyzerOutput.selected_framework.complementary.join(", ") || "none"}
- Rationale: ${analyzerOutput.selected_framework.rationale}

### Audience Profile
- ZPD Level: ${analyzerOutput.audience_profile.zpd_level}
- Motivation: ${analyzerOutput.audience_profile.motivation_type}
- Prior Knowledge: ${analyzerOutput.audience_profile.prior_knowledge_summary}
- Attention Span: ${analyzerOutput.audience_profile.attention_span_minutes} minutes
- Kolb Style: ${analyzerOutput.audience_profile.kolb_style || "not determined"}
- Adult Learning: self_directed=${analyzerOutput.audience_profile.adult_learning_profile.self_directed}, experience_based=${analyzerOutput.audience_profile.adult_learning_profile.experience_based}, problem_centered=${analyzerOutput.audience_profile.adult_learning_profile.problem_centered}, relevance_oriented=${analyzerOutput.audience_profile.adult_learning_profile.relevance_oriented}

### Gap Analysis
- Current State: ${analyzerOutput.gap_analysis.current_state}
- Desired State: ${analyzerOutput.gap_analysis.desired_state}
- Critical Gaps: ${analyzerOutput.gap_analysis.critical_gaps.join("; ")}
- Estimated Modules: ${analyzerOutput.gap_analysis.estimated_modules}

## Framework Configuration

**Framework:** ${frameworkConfig.name}
**Stages:**
${frameworkStages}

**Sequencing:** ${frameworkConfig.sequencing.model} (${frameworkConfig.sequencing.progression_rule})
${spiralInfo}

## Instructions

### Duration → Scope Mapping
${durationToScope}
Generate the appropriate number of modules based on the duration.

### A4: Objective Generator — ABCD Format
For EACH module, generate 3-7 objectives in ABCD format:
- **A**udience: Who will perform (e.g., "O participante")
- **B**ehavior: Observable verb aligned with Bloom level (use Portuguese action verbs)
- **C**ondition: Under what conditions (e.g., "Dado um cenário de...")
- **D**egree: Measurable criterion (e.g., "com 80% de acurácia")

Bloom levels must ASCEND across modules: early modules = remembering/understanding, later = evaluating/creating.

### A5: Assessment Designer — Backward Design
Design assessments BEFORE content (Backward Design principle):
- Each objective must have exactly 1 matching assessment (1:1 alignment)
- Cover Kirkpatrick levels L1 (reaction) through L4 (results)
- Use varied methods: quiz, rubric, peer_review, self_assessment, portfolio, project, case_study, simulation, observation, reflection

### A6: Module Sequencer
- Bloom levels must be ASCENDING across modules (no drops > 1 level)
- Apply spiral curriculum with progression through spiral_levels
- Set prerequisites where modules depend on prior knowledge

### A7: Framework Mapper
For each module, map ALL framework stages with:
- Percentage allocation following the framework's time_percentage values
- Specific activities for each stage
- Optional deliverable per stage

### Problema-Motor (Experiential Frameworks)
For each module, generate a driving problem using the tension formula:
- Tension = Pressure (1-5) × Ambiguity (1-5) × Stakes (1-5) = 1-125
- Progression by spiral level:
  - fundamentos: 1-25 (low tension)
  - variacao: 26-50 (medium)
  - conflito_humano: 51-75 (high)
  - mundo_real: 76-100 (very high)
  - sintese: 100-125 (maximum)

### Interaction Type (bloom_mapped — D17)
Assign interaction_type per module based on highest Bloom level:
- Remember/Understand → quiz
- Apply/Analyze → socratic_dialogue
- Evaluate → scenario
- Create → assignment

Adjustments by spiral_level:
- fundamentos: If Bloom >= Analyze → keep socratic (too early for scenario)
- variacao: No adjustment
- conflito_humano: If Bloom == Apply → upgrade to scenario
- mundo_real: If Bloom <= Analyze → upgrade to scenario
- sintese: FORCE assignment (mandatory final deliverable)

### Course Structure
- Set total_modules, primary_framework, complementary_frameworks
- List bloom_progression (the highest Bloom per module, in order)
- List spiral_levels used

### Assessment Strategy
- Count formative, summative, and diagnostic assessments
- Describe overall_approach
- Set kirkpatrick_coverage booleans (L1-L4)

Respond ONLY with the structured JSON matching the schema.`
}

function getDurationScopeMapping(totalHours: number): string {
  if (totalHours <= 4) return "1-4h → 1-2 modules (micro-course)"
  if (totalHours <= 10) return "4-10h → 3-5 modules (short course)"
  if (totalHours <= 40) return "10-40h → 5-10 modules (standard course)"
  if (totalHours <= 100) return "40-100h → 10-20 modules (extended course)"
  return "100-200h → 20-30 modules (comprehensive program)"
}
