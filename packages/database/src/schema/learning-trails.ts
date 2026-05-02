import { boolean, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { jobRoles } from "./job-roles"
import { tenants } from "./tenants"
import { users } from "./users"

export const learningTrails = pgTable("learning_trails", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  targetJobRoleId: uuid("target_job_role_id").references(() => jobRoles.id, {
    onDelete: "set null",
  }),
  estimatedHours: integer("estimated_hours"),
  isMandatory: boolean("is_mandatory").notNull().default(false),
  status: text("status", { enum: ["draft", "active", "archived"] })
    .notNull()
    .default("draft"),
  createdBy: uuid("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})
