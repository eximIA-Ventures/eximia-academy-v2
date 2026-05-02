import { integer, numeric, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core"
import { tenants } from "./tenants"
import { users } from "./users"

export const learnerProfiles = pgTable(
  "learner_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    engagementStyle: text("engagement_style"),
    detailOrientation: text("detail_orientation"),
    reasoningStyle: text("reasoning_style"),
    avgDepthAchieved: numeric("avg_depth_achieved", { precision: 3, scale: 1 }),
    avgQaScore: numeric("avg_qa_score", { precision: 3, scale: 2 }),
    confidence: numeric("confidence", { precision: 3, scale: 2 }),
    kolbGraspingAxis: numeric("kolb_grasping_axis", { precision: 4, scale: 2 }),
    kolbTransformingAxis: numeric("kolb_transforming_axis", { precision: 4, scale: 2 }),
    kolbDominantStyle: text("kolb_dominant_style"),
    kolbStyleConfidence: numeric("kolb_style_confidence", { precision: 3, scale: 2 }),
    strengths: text("strengths").array().default([]),
    growthAreas: text("growth_areas").array().default([]),
    adaptationHints: text("adaptation_hints").array().default([]),
    preferredQuestionTypes: text("preferred_question_types").array().default([]),
    comprehensionTrend: text("comprehension_trend"),
    summary: text("summary"),
    sessionCount: integer("session_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [unique("uq_learner_profiles_student_tenant").on(table.studentId, table.tenantId)],
)
