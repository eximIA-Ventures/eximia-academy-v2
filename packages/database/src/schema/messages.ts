import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { sessions } from "./sessions"
import { tenants } from "./tenants"

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
  content: text("content").notNull(),
  turnNumber: integer("turn_number").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})
