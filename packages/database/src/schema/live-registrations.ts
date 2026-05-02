import { boolean, pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core"
import { liveEvents } from "./live-events"
import { tenants } from "./tenants"
import { users } from "./users"

export const liveRegistrations = pgTable(
  "live_registrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    liveEventId: uuid("live_event_id")
      .notNull()
      .references(() => liveEvents.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    registeredAt: timestamp("registered_at", { withTimezone: true }).defaultNow(),
    attended: boolean("attended").notNull().default(false),
  },
  (t) => [unique("live_registrations_event_user").on(t.liveEventId, t.userId)],
)
