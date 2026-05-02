import { pgTable, text, timestamp, uuid, unique } from "drizzle-orm/pg-core"
import { tenants } from "./tenants"

export const userTenantMemberships = pgTable(
  "user_tenant_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("student"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [unique().on(t.userId, t.tenantId)],
)
