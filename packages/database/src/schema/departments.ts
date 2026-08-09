import { pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core"
import { tenants } from "./tenants"

// DEPARTMENT: functional org unit inside a tenant ("Área" in the product
// vocabulary, README D4). DISTINCT from `areas` (schema/areas.ts), which is the
// UNIDADE (physical site) and is left untouched.
// Migration: 20260728120000_departments_additive_p1.sql
export const departments = pgTable(
  "departments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("departments_tenant_slug").on(t.tenantId, t.slug)],
)
