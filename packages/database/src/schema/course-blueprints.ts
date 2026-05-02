import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"
import { courses } from "./courses"
import { tenants } from "./tenants"
import { users } from "./users"

export const courseBlueprints = pgTable("course_blueprints", {
  id: uuid("id").primaryKey().defaultRandom(),
  courseId: uuid("course_id").references(() => courses.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  blueprintData: jsonb("blueprint_data").notNull(),
  framework: text("framework").notNull(),
  totalObjectives: integer("total_objectives").notNull(),
  totalAssessments: integer("total_assessments").notNull(),
  bloomProgression: text("bloom_progression").array(),
  status: text("status", {
    enum: ["generating", "draft", "approved", "applied", "archived"],
  })
    .notNull()
    .default("draft"),
  generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow(),
  approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  appliedToCourse: boolean("applied_to_course").default(false),
  appliedAt: timestamp("applied_at", { withTimezone: true }),

  // WS2 columns
  primaryFramework: text("primary_framework"),
  complementaryFrameworks: text("complementary_frameworks").array(),
  qualityScore: numeric("quality_score", { precision: 5, scale: 2 }),
  neuroscienceScore: numeric("neuroscience_score", { precision: 5, scale: 2 }),
  qualityVerdict: text("quality_verdict", {
    enum: ["approved", "needs_review", "rejected"],
  }),
  audienceProfile: jsonb("audience_profile"),
  evaluationPlan: jsonb("evaluation_plan"),
  interactionStrategy: text("interaction_strategy").default("bloom_mapped"),
  sourceCourseId: uuid("source_course_id").references(() => courses.id, {
    onDelete: "set null",
  }),
  version: text("version").default("3.0"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})
