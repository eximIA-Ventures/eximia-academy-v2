import { jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core"
import { messages } from "./messages"
import { sessions } from "./sessions"
import { tenants } from "./tenants"

export const analyses = pgTable("analyses", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  aiDetection: jsonb("ai_detection").default({}),
  metrics: jsonb("metrics").default({}),
  observations: jsonb("observations").default([]),
  flags: jsonb("flags").default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})
