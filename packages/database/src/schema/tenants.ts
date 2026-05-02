import { boolean, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),

  branding: jsonb("branding").default({}),
  settings: jsonb("settings").default({}),
  plan: text("plan", { enum: ["essencial", "standard", "premium"] }).default("essencial"),
  status: text("status", { enum: ["active", "inactive"] }).default("active"),

  whitelabelEnabled: boolean("whitelabel_enabled").default(false),
  whitelabelConfig: jsonb("whitelabel_config").default({}),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})
