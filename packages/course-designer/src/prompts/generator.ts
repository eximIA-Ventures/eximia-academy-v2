import type { AnalyzerOutput } from "../schemas/analyzer"
import type { ArchitectOutput } from "../schemas/architect"
import type { CalculatorOutput } from "../schemas/calculator"
import type { ValidatorOutput } from "../schemas/validator"

/**
 * Builds the prompt for the Generator agent (Fase 5).
 * Blueprint Builder + Activity Recommender.
 */
export function buildGeneratorPrompt(
  analyzerOutput: AnalyzerOutput,
  architectOutput: ArchitectOutput,
  calculatorOutput: CalculatorOutput,
  validatorOutput: ValidatorOutput,
  courseTitle: string,
  language: "pt-br" | "en",
  interactionStrategy: "bloom_mapped" | "dominant" | "custom",
  totalDurationHours: number,
  audienceRole: string,
): string {
  const moduleDetails = architectOutput.modules
    .map((m, i) => {
      const timeInfo = calculatorOutput.time_allocation.modules[i]
      const chunks = timeInfo
        ? timeInfo.chunks.map((c) => `${c.title}(${c.duration_min}min,${c.type})`).join(", ")
        : "N/A"
      return `### Module ${m.order}: ${m.title}
- Spiral: ${m.spiral_level} | Duration: ${timeInfo?.total_minutes ?? "?"}min
- Objectives: ${m.objectives.length} (Bloom: ${m.objectives.map((o) => o.bloom_level).join(", ")})
- Assessments: ${m.assessments.length}
- Framework Stages: ${m.framework_stages.map((s) => `${s.key}(${s.percentage}%)`).join(", ")}
- Problema-Motor: ${m.problema_motor ? `"${m.problema_motor.description}" (tension: ${m.problema_motor.tension_score})` : "none"}
- Interaction Type: ${m.interaction_type}
- Chunks: ${chunks}`
    })
    .join("\n\n")

  return `You are a blueprint generator for instructional design [Harven_CourseGenerator]. Consolidate all pipeline outputs into the final Blueprint JSON.

## Course Info
**Title:** ${courseTitle}
**Language:** ${language}
**Total Duration:** ${totalDurationHours} hours
**Interaction Strategy:** ${interactionStrategy}
**Framework:** ${analyzerOutput.selected_framework.primary} (complementary: ${analyzerOutput.selected_framework.complementary.join(", ") || "none"})

## Quality Scorecard
- Framework Score: ${validatorOutput.framework_score.total}/100
- Neuroscience Score: ${validatorOutput.neuroscience_score.total}/100
- Final Score: ${validatorOutput.final_score}/100
- Verdict: ${validatorOutput.verdict}

## Audience Profile
- Role: ${audienceRole}
- Motivation: ${analyzerOutput.audience_profile.motivation_type}
- Kolb Style: ${analyzerOutput.audience_profile.kolb_style || "N/A"}
- Adult Learning: self_directed=${analyzerOutput.audience_profile.adult_learning_profile.self_directed}, experience_based=${analyzerOutput.audience_profile.adult_learning_profile.experience_based}

## Course Architecture
- Bloom Progression: ${architectOutput.course_structure.bloom_progression.join(" → ")}
- Spiral Levels: ${architectOutput.course_structure.spiral_levels.join(" → ")}

## Modules Detail
${moduleDetails}

## Instructions

### A15: Blueprint Builder
Consolidate ALL the above data into the final Blueprint:
1. **metadata**: Set version to "1.0", generated_at to current ISO timestamp, copy scores and framework info
2. **audience**: From analyzer output
3. **course_architecture**: bloom_progression and spiral_curriculum arrays
4. **modules**: Merge architect modules (objectives, assessments, stages, problema_motor) with calculator modules (duration, chunks). Each module must have ALL fields.
5. **evaluation_plan**: Kirkpatrick L1-L4 with descriptions and methods for each level
6. **quality_scorecard**: Copy from validator output
7. **implementation_checklist**: Generate 5-10 actionable items with priority (must/should/could) for the instructor
8. **requires_instructor_review**: Set to true if verdict is "needs_revision" or "poor"

### A16: Activity Recommender
For each module's framework_stages, suggest specific activities from this activity bank:
- **Engagement**: case study, role play, debate, simulation, brainstorming, gallery walk
- **Learning**: vídeo lecture, reading, demonstration, worked example, concept map
- **Practice**: exercise, lab, project, pair programming, peer teaching
- **Assessment**: quiz, reflection journal, portfolio entry, peer review, presentation
- **Integration**: action plan, real-world application, mentoring session, community of practice

Choose activities that match the stage purpose, Bloom level, and interaction type.

Respond ONLY with the structured JSON matching the schema.`
}
