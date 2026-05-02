import { integer, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core"
import { courses } from "./courses"
import { learningTrails } from "./learning-trails"
import { tenants } from "./tenants"
import { users } from "./users"

export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    trailId: uuid("trail_id").references(() => learningTrails.id, { onDelete: "set null" }),
    trailCourseOrder: integer("trail_course_order"),
    status: text("status", { enum: ["active", "completed", "dropped"] })
      .notNull()
      .default("active"),
    progress: jsonb("progress").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [unique().on(t.studentId, t.courseId)],
)
