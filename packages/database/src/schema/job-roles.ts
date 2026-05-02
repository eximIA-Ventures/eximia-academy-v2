import { pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core"
import { áreas } from "./areas"
import { tenants } from "./tenants"
import { users } from "./users"

export const jobRoles = pgTable(
  "job_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    áreaId: uuid("area_id").references(() => áreas.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    seniorityLevel: text("seniority_level", {
      enum: ["junior", "mid", "senior", "lead", "manager"],
    })
      .notNull()
      .default("mid"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("job_roles_tenant_slug").on(t.tenantId, t.slug)],
)
