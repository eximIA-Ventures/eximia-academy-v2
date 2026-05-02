import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { chapters } from "./chapters"
import { questionGenerationJobs } from "./question-generation-jobs"
import { tenants } from "./tenants"

export const questions = pgTable("questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  chapterId: uuid("chapter_id")
    .notNull()
    .references(() => chapters.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  skill: text("skill"),
  intention: text("intention"),
  expectedDepth: text("expected_depth"),
  questionType: text("question_type", {
    enum: ["multiple_choice", "true_false", "open_ended"],
  })
    .notNull()
    .default("open_ended"),
  correctAnswer: text("correct_answer"),
  explanation: text("explanation"),
  options: jsonb("options").$type<string[]>(),
  status: text("status", { enum: ["draft", "pending", "active", "archived"] })
    .notNull()
    .default("draft"),
  jobId: uuid("job_id").references(() => questionGenerationJobs.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})
