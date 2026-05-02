import { integer, jsonb, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { quizSessions } from "./quiz-sessions"
import { tenants } from "./tenants"
import { users } from "./users"

export const quizAttempts = pgTable("quiz_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  quizSessionId: uuid("quiz_session_id")
    .notNull()
    .references(() => quizSessions.id, { onDelete: "cascade" }),
  studentId: uuid("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  score: numeric("score", { precision: 5, scale: 2 }),
  totalQuestions: integer("total_questions").notNull().default(0),
  correctAnswers: integer("correct_answers").notNull().default(0),
  status: text("status", { enum: ["in_progress", "completed", "timed_out", "abandoned"] })
    .notNull()
    .default("in_progress"),
  answers: jsonb("answers").notNull().default([]),
  feedback: jsonb("feedback"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})
