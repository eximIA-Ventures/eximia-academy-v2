import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { áreas } from "./areas"
import { tenants } from "./tenants"
import { users } from "./users"

export const courses = pgTable("courses", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type", { enum: ["regular", "onboarding"] })
    .notNull()
    .default("regular"),

  status: text("status", { enum: ["draft", "published", "archived"] })
    .notNull()
    .default("draft"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  áreaId: uuid("area_id").references(() => áreas.id, { onDelete: "set null" }),
  settings: jsonb("settings").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})
