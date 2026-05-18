import { numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { courses } from "./courses"
import { enrollments } from "./enrollments"
import { tenants } from "./tenants"
import { users } from "./users"

export const certificates = pgTable("certificates", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  enrollmentId: uuid("enrollment_id").references(() => enrollments.id, { onDelete: "set null" }),

  // Certificate data
  studentName: text("student_name").notNull(),
  courseTitle: text("course_title").notNull(),
  instructorName: text("instructor_name"),
  workloadHours: numeric("workload_hours", { precision: 6, scale: 1 }),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),

  // Verification
  verificationCode: text("verification_code").notNull().unique(),

  // Storage
  pdfPath: text("pdf_path"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})
