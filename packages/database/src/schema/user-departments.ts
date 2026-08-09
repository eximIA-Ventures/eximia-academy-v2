import { pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core"
import { departments } from "./departments"
import { tenants } from "./tenants"
import { users } from "./users"

// Person ↔ department link. Independent from `userAreas` (person ↔ UNIDADE),
// which is unchanged. No unidade column here on purpose: the person's UNIDADE
// is already known through userAreas.áreaId.
// Migration: 20260728120000_departments_additive_p1.sql
export const userDepartments = pgTable(
  "user_departments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("user_departments_user_department").on(t.userId, t.departmentId)],
)
