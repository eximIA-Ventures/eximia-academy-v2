import { boolean, integer, pgTable, unique, uuid } from "drizzle-orm/pg-core"
import { courses } from "./courses"
import { learningTrails } from "./learning-trails"

export const trailCourses = pgTable(
  "trail_courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trailId: uuid("trail_id")
      .notNull()
      .references(() => learningTrails.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    order: integer("order").notNull().default(0),
    isRequired: boolean("is_required").notNull().default(true),
    estimatedHours: integer("estimated_hours"),
  },
  (t) => [unique("trail_courses_trail_course").on(t.trailId, t.courseId)],
)
