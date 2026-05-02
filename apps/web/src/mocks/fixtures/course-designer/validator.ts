import type { ValidatorOutput } from "@eximia/course-designer"

export const courseValidatorFixture: ValidatorOutput = {
  framework_score: {
    total: 88,
    alignment: {
      score: 92,
      weight: 0.3,
      details: "Strong 1:1 objective-assessment alignment across all modules.",
      issues: [],
    },
    bloom_progression: {
      score: 95,
      weight: 0.2,
      details: "Bloom levels ascend smoothly: understanding -> applying -> analyzing.",
      issues: [],
    },
    framework_completeness: {
      score: 85,
      weight: 0.25,
      details: "All 5 ELC+ stages present in every module with appropriate time allocation.",
      issues: [],
      framework_used: "elc_plus",
      stages_covered: ["engage", "explore", "explain", "elaborate", "evaluate"],
      stages_missing: [],
    },
    duration: {
      score: 82,
      weight: 0.15,
      details: "Time allocation is proportional to module complexity.",
      issues: ["Module 1 could use slightly more elaborate time"],
    },
    cognitive_load: {
      score: 90,
      weight: 0.1,
      details: "Cognitive load is within CLT limits for all modules.",
      issues: [],
    },
  },
  neuroscience_score: {
    total: 0,
    rules: [],
  },
  final_score: 88,
  verdict: "good",
  critical_issues: [],
  recommendations: [
    "Consider adding a brief warm-up activity to Module 1 to activate prior knowledge",
    "Module 3 integration project could benefit from clearer deliverable criteria",
  ],
}
