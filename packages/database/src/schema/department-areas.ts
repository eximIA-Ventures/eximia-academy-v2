import { pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core"
import { áreas } from "./areas"
import { departments } from "./departments"
import { tenants } from "./tenants"

// N:N junction department ↔ UNIDADE. `areaId` points at the existing `areas`
// table (the UNIDADE), same convention as userAreas.áreaId / jobRoles.áreaId.
// A department present in 2+ rows here is a CORPORATE department (D4).
// Migration: 20260728120000_departments_additive_p1.sql
export const departmentAreas = pgTable(
  "department_areas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "cascade" }),
    áreaId: uuid("area_id")
      .notNull()
      .references(() => áreas.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("department_areas_department_area").on(t.departmentId, t.áreaId)],
)
