import type { CourseDesignerInput } from "../schemas/input"
import type { FrameworkConfig } from "../schemas/shared"

/**
 * Builds the prompt for the Analyzer agent (Fase 1).
 * Includes instructions for ZPD mapping, Kolb style inference, and andragogy profile.
 */
export function buildAnalyzerPrompt(
  input: CourseDesignerInput,
  frameworkConfig: FrameworkConfig,
): string {
  const audienceSection = [
    `Role: ${input.target_audience.role}`,
    `Experience Level: ${input.target_audience.experience_level}`,
    input.target_audience.prior_knowledge?.length
      ? `Prior Knowledge: ${input.target_audience.prior_knowledge.join(", ")}`
      : null,
    input.target_audience.group_size ? `Group Size: ${input.target_audience.group_size}` : null,
    input.target_audience.motivation_context
      ? `Motivation Context: ${input.target_audience.motivation_context}`
      : null,
    input.target_audience.learning_environment
      ? `Learning Environment: ${input.target_audience.learning_environment}`
      : null,
    input.target_audience.autonomy_level
      ? `Autonomy Level: ${input.target_audience.autonomy_level}`
      : null,
  ]
    .filter(Boolean)
    .join("\n")

  const contentSources = [
    input.core_competencies?.length
      ? `Core Competencies: ${input.core_competencies.join(", ")}`
      : null,
    input.topics_outline?.length ? `Topics Outline: ${input.topics_outline.join(", ")}` : null,
    input.existing_materials_summary
      ? `Existing Materials: ${input.existing_materials_summary}`
      : null,
    input.context_files?.length
      ? input.context_files
          .map((f) => {
            const header = `Context File: ${f.name} (${f.type})`
            return f.content_summary
              ? `${header}\nContent Summary:\n${f.content_summary}`
              : header
          })
          .join("\n\n")
      : null,
  ]
    .filter(Boolean)
    .join("\n")

  return `You are an instructional design analyst [Harven_CourseAnalyzer]. Analyze the following course design brief and produce a structured analysis.

## Course Design Brief

**Title:** ${input.course_title}
**Business Goal:** ${input.business_goal}
**Behavior Change:** ${input.behavior_change}
${input.problem_statement ? `**Problem Statement:** ${input.problem_statement}` : ""}
${input.success_metrics?.length ? `**Success Metrics:** ${input.success_metrics.join("; ")}` : ""}

## Target Audience
${audienceSection}

## Content Sources
${contentSources || "No additional content sources provided."}

## Constraints
**Total Duration:** ${input.total_duration_hours} hours
${input.constraints?.delivery_mode ? `**Delivery Mode:** ${input.constraints.delivery_mode}` : ""}
${input.constraints?.session_length_preference ? `**Session Length Preference:** ${input.constraints.session_length_preference} minutes` : ""}

## Selected Framework
**ID:** ${frameworkConfig.id}
**Name:** ${frameworkConfig.name}
**Stages:** ${frameworkConfig.stages.map((s) => s.name).join(" → ")}

## Instructions

### 1. Selected Framework Analysis
- Confirm the framework "${frameworkConfig.id}" as primary
- Suggest complementary frameworks if beneficial (from: elc_plus, kolb_4, pbl_hmelo)
- Provide rationale for the selection
- Set was_user_selected to ${input.framework !== "auto"}
- Set recommendation_confidence (0-1) based on how well the framework fits

### 2. Audience Profile — ZPD Mapping
Map experience_level to Zone of Proximal Development (ZPD):
- **iniciante**: Can do alone: Remember/Understand. Needs help with: Apply. ZPD focus: guided practice
- **intermediario**: Can do alone: Remember-Apply. Needs help with: Analyze. ZPD focus: analytical tasks
- **avancado**: Can do alone: Remember-Analyze. Needs help with: Evaluate/Create. ZPD focus: evaluation
- **especialista**: Can do alone: all levels. Needs help with: Create in novel contexts. ZPD focus: innovation

### 3. Audience Profile — Kolb Style Inference
Based on the role, experience, and learning environment, infer the likely Kolb learning style:
- **diverger**: Feeling + Watching (creative, brainstorming, group discussion)
- **assimilator**: Thinking + Watching (lectures, papers, analytical models)
- **converger**: Thinking + Doing (simulations, lab work, practical applications)
- **accommodator**: Feeling + Doing (hands-on, role-play, field work)

### 4. Audience Profile — Andragogy (Adult Learning)
Evaluate the 4 principles of adult learning (Knowles):
- **self_directed**: Does the audience prefer autonomy in learning?
- **experience_based**: Does the audience have significant prior experience to leverage?
- **problem_centered**: Is the audience motivated by solving real problems?
- **relevance_oriented**: Does the audience need clear connection to job/role?

### 5. Motivation Type
Classify the primary motivation type based on context:
- intrinsic, extrinsic, mixed, achievement, social, mastery

### 6. Gap Analysis
- Describe current_state (what the audience knows/can do now)
- Describe desired_state (what they should know/do after the course)
- List critical_gaps (knowledge/skill gaps to bridge)
- Estimate number of modules needed (1-30) based on duration and gap size

### 7. Recommendations
Provide 3-5 actionable recommendations for the course design.

Respond ONLY with the structured JSON matching the schema.`
}
