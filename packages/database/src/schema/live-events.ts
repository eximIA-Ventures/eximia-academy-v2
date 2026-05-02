import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { tenants } from "./tenants"
import { users } from "./users"

export const liveEvents = pgTable("live_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  hostName: text("host_name").notNull(),
  status: text("status", {
    enum: ["scheduled", "live", "ended", "cancelled"],
  })
    .notNull()
    .default("scheduled"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  meetingUrl: text("meeting_url"),
  thumbnailUrl: text("thumbnail_url"),
  recordingUrl: text("recording_url"),
  maxParticipants: integer("max_participants"),
  tags: text("tags").array(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})
