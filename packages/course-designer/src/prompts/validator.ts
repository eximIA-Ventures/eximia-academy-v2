import type { AnalyzerOutput } from "../schemas/analyzer"
import type { ArchitectOutput } from "../schemas/architect"
import type { CalculatorOutput } from "../schemas/calculator"

/**
 * Builds the prompt for the Validator agent (Fase 4).
 * Framework Score evaluation — the LLM evaluates alignment, bloom progression,
 * completeness, duration, and cognitive load dimensions.
 */
export function buildValidatorPrompt(
  analyzerOutput: AnalyzerOutput,
  architectOutput: ArchitectOutput,
  calculatorOutput: CalculatorOutput,
): string {
  const modulesSummary = architectOutput.modules
    .map((m) => {
      const bloomLevels = m.objectives.map((o) => o.bloom_level)
      const assessmentTypes = m.assessments.map((a) => `${a.type}:${a.method}`)
      const stages = m.framework_stages.map((s) => s.key)
      return `- M${m.order} "${m.title}" | Spiral: ${m.spiral_level} | Bloom: ${bloomLevels.join(",")} | Assessments: ${assessmentTypes.join(",")} | Stages: ${stages.join(",")}`
    })
    .join("\n")

  const cognitiveWarnings = calculatorOutput.cognitive_load.warnings.join("; ") || "None"

  return `You are a quality assurance specialist for instructional design [Harven_CourseValidator]. Evaluate the course architecture against quality criteria.

## Selected Framework
- Primary: ${analyzerOutput.selected_framework.primary}
- Complementary: ${analyzerOutput.selected_framework.complementary.join(", ") || "none"}

## Course Architecture
**Total Modules:** ${architectOutput.course_structure.total_modules}
**Bloom Progression:** ${architectOutput.course_structure.bloom_progression.join(" → ")}
**Spiral Levels:** ${architectOutput.course_structure.spiral_levels.join(" → ")}

### Modules
${modulesSummary}

### Assessment Strategy
- Formative: ${architectOutput.assessment_strategy.formative_count}
- Summative: ${architectOutput.assessment_strategy.summative_count}
- Diagnostic: ${architectOutput.assessment_strategy.diagnostic_count}
- Kirkpatrick: L1=${architectOutput.assessment_strategy.kirkpatrick_coverage.L1}, L2=${architectOutput.assessment_strategy.kirkpatrick_coverage.L2}, L3=${architectOutput.assessment_strategy.kirkpatrick_coverage.L3}, L4=${architectOutput.assessment_strategy.kirkpatrick_coverage.L4}

### Cognitive Load Summary
- Overall Balance: ${calculatorOutput.cognitive_load.overall_balance}
- Warnings: ${cognitiveWarnings}
- Total Duration: ${calculatorOutput.time_allocation.total_minutes} minutes

## Evaluation Instructions

Score each dimension 0-100 based on the criteria below.

### Framework Score (70% of final)

**1. Alignment (weight: 0.30)**
Check 1:1 mapping between objectives and assessments.
- Each objective should have exactly 1 assessment aligned to it
- Score 100 if perfect 1:1, deduct per misalignment

**2. Bloom Progression (weight: 0.20)**
Check that Bloom levels ascend across modules.
- No drops > 1 level between consecutive modules
- Score 100 if strictly ascending, deduct per violation

**3. Framework Completeness (weight: 0.25)**
Check that all framework stages are present in every module.
- Identify stages covered and missing per module
- Score based on coverage percentage

**4. Duration (weight: 0.15)**
Check time allocation reasonableness.
- Module times should be proportional to complexity
- Stage time percentages should match framework targets (±5%)

**5. Cognitive Load (weight: 0.10)**
Check CLT compliance from calculator output.
- Score based on overall_balance and warnings count

### Framework Score Total
Calculate: (alignment.score × 0.30) + (bloom.score × 0.20) + (completeness.score × 0.25) + (duration.score × 0.15) + (cognitive.score × 0.10)

### Neuroscience Score
The neuroscience_score will be provided separately (programmatic evaluation).
Set the neuroscience_score total to 0 and rules to empty array — they will be filled programmatically.

### Final Score
Will be calculated after: (framework_score × 0.70) + (neuroscience_score × 0.30)

### Verdict
- excellent: 90-100
- good: 70-89
- needs_revision: 50-69
- poor: < 50

### Critical Issues and Recommendations
- List any critical structural issues that must be fixed
- Provide actionable recommendations for improvement

Respond ONLY with the structured JSON matching the schema.`
}
