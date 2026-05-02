import { boolean, pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core"
import { tenants } from "./tenants"
import { users } from "./users"

export const instructorPermissions = pgTable(
  "instructor_permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    canCreateCourses: boolean("can_create_courses").notNull().default(true),
    canCreateQuizzes: boolean("can_create_quizzes").notNull().default(true),
    canManageTrails: boolean("can_manage_trails").notNull().default(false),
    canViewAnalytics: boolean("can_view_analytics").notNull().default(true),
    canManageEnrollments: boolean("can_manage_enrollments").notNull().default(true),
    assignedAreaIds: uuid("assigned_area_ids").array().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("instructor_permissions_user_tenant").on(table.userId, table.tenantId)],
)
