import type { AnalyzerOutput } from "@eximia/course-designer"

export const courseAnalyzerFixture: AnalyzerOutput = {
  selected_framework: {
    primary: "elc_plus",
    complementary: ["kolb_4"],
    rationale:
      "ELC+ is ideal for corporate training with its structured experiential cycle and explicit reflection phases.",
    was_user_selected: false,
    recommendation_confidence: 0.85,
  },
  audience_profile: {
    zpd_level: "intermediario",
    motivation_type: "achievement",
    prior_knowledge_summary:
      "Participants have basic understanding of the domain but lack practical application skills.",
    learning_preferences: ["hands-on practice", "case studies", "group discussion"],
    attention_span_minutes: 25,
    adult_learning_profile: {
      self_directed: true,
      experience_based: true,
      problem_centered: true,
      relevance_oriented: true,
    },
    kolb_style: "converger",
  },
  gap_analysis: {
    current_state:
      "Participants can recall core concepts but struggle to apply them in real scenarios.",
    desired_state:
      "Participants can independently analyze situations and apply frameworks to solve business problems.",
    critical_gaps: [
      "Lack of practical application experience",
      "Weak analytical skills for complex scenarios",
      "No exposure to cross-functional integration",
    ],
    estimated_modules: 3,
  },
  recommendations: [
    "Use progressive case studies that increase in complexity across modules",
    "Include peer review activities to build collaborative analytical skills",
    "Add real-world project as final deliverable for transfer to workplace",
  ],
}
