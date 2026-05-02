import { pgTable, timestamp, uuid } from "drizzle-orm/pg-core"
import { áreas } from "./areas"
import { users } from "./users"

export const userAreas = pgTable("user_areas", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  áreaId: uuid("area_id")
    .notNull()
    .references(() => áreas.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})
