import { integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { courses } from "./courses"
import { tenants } from "./tenants"
import { users } from "./users"

export const questionGenerationJobs = pgTable("question_generation_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  triggeredBy: uuid("triggered_by")
    .notNull()
    .references(() => users.id, { onDelete: "set null" }),
  scope: text("scope", { enum: ["course", "chapter"] })
    .notNull()
    .default("course"),
  chapterIds: uuid("chapter_ids").array(),
  status: text("status", {
    enum: ["pending", "processing", "review", "completed", "failed"],
  })
    .notNull()
    .default("pending"),
  progress: jsonb("progress").default({}),
  questionsGenerated: integer("questions_generated").default(0),
  questionsApproved: integer("questions_approved").default(0),
  questionsRejected: integer("questions_rejected").default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})
