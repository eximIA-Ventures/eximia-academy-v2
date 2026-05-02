import { boolean, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core"

export const planFeatures = pgTable(
  "plan_features",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    plan: text("plan", { enum: ["essencial", "standard", "premium"] }).notNull(),
    featureKey: text("feature_key").notNull(),
    isEnabled: boolean("is_enabled").notNull().default(true),
    quota: integer("quota"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("plan_features_plan_key").on(t.plan, t.featureKey)],
)
