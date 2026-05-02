import { jsonb, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { messages } from "./messages"
import { sessions } from "./sessions"
import { tenants } from "./tenants"

export const qaReports = pgTable("qa_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  messageId: uuid("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  verdict: text("verdict"),
  score: numeric("score"),
  recommendation: text("recommendation"),
  criteriaResults: jsonb("criteria_results").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})
