import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { blueprintModules } from "./blueprint-modules"
import { courseBlueprints } from "./course-blueprints"

export const blueprintAssessments = pgTable("blueprint_assessments", {
  id: uuid("id").primaryKey().defaultRandom(),
  blueprintId: uuid("blueprint_id")
    .notNull()
    .references(() => courseBlueprints.id, { onDelete: "cascade" }),
  objectiveId: text("objective_id").notNull(),
  assessmentType: text("assessment_type").notNull(),
  timing: text("timing").notNull(),
  format: text("format"),
  rubricRequired: boolean("rubric_required").default(false),
  estimatedDurationMin: integer("estimated_duration_min"),

  // WS2 columns
  moduleId: uuid("module_id").references(() => blueprintModules.id, {
    onDelete: "cascade",
  }),
  kirkpatrickLevel: integer("kirkpatrick_level"),
  rubrics: jsonb("rubrics"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})
