import { integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { courseBlueprints } from "./course-blueprints"
import { tenants } from "./tenants"
import { users } from "./users"

export const blueprintGenerationJobs = pgTable("blueprint_generation_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  courseId: uuid("course_id"),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  status: text("status", {
    enum: ["pending", "queued", "processing", "completed", "failed"],
  })
    .notNull()
    .default("queued"),
  progress: jsonb("progress").default({}),
  blueprintId: uuid("blueprint_id").references(() => courseBlueprints.id, {
    onDelete: "set null",
  }),
  errorMessage: text("error_message"),
  requestedBy: uuid("requested_by")
    .notNull()
    .references(() => users.id, { onDelete: "set null" }),

  // WS2 columns
  currentPhase: integer("current_phase"),
  phaseResults: jsonb("phase_results").default({}),

  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})
