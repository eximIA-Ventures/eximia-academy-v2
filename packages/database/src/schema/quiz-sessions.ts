import { boolean, integer, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { chapters } from "./chapters"
import { courses } from "./courses"
import { tenants } from "./tenants"
import { users } from "./users"

export const quizSessions = pgTable("quiz_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  chapterId: uuid("chapter_id").references(() => chapters.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  quizType: text("quiz_type", { enum: ["practice", "exam", "diagnostic"] }).notNull(),
  timeLimitMinutes: integer("time_limit_minutes"),
  passingScore: numeric("passing_score", { precision: 5, scale: 2 }).default("70.00"),
  maxAttempts: integer("max_attempts").default(3),
  shuffleQuestions: boolean("shuffle_questions").notNull().default(false),
  showAnswersAfter: text("show_answers_after", { enum: ["completion", "never", "always"] })
    .notNull()
    .default("completion"),
  questionIds: text("question_ids").array(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})
