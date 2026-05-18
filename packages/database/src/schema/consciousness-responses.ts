import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { courses } from "./courses"
import { enrollments } from "./enrollments"
import { tenants } from "./tenants"
import { users } from "./users"

export const consciousnessResponses = pgTable("consciousness_responses", {
  id: uuid("id").primaryKey().defaultRandom(),
  enrollmentId: uuid("enrollment_id")
    .notNull()
    .references(() => enrollments.id, { onDelete: "cascade" }),
  studentId: uuid("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  phase: text("phase", { enum: ["pre", "post"] }).notNull(),
  challengeText: text("challenge_text"),
  selfRating: integer("self_rating"),
  learningGoal: text("learning_goal"),
  commitment: text("commitment"),
  ratingChange: integer("rating_change"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})
