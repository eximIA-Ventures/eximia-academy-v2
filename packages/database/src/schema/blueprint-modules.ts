import { integer, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core"
import { courseBlueprints } from "./course-blueprints"
import { tenants } from "./tenants"

export const blueprintModules = pgTable(
  "blueprint_modules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blueprintId: uuid("blueprint_id")
      .notNull()
      .references(() => courseBlueprints.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    order: integer("order").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    durationMinutes: integer("duration_minutes"),
    spiralLevel: integer("spiral_level"),
    interactionType: text("interaction_type", {
      enum: [
        "socratic_dialogue",
        "guided_practice",
        "case_study",
        "problem_based",
        "collaborative",
        "self_directed",
      ],
    }),
    frameworkStages: jsonb("framework_stages").notNull().default([]),
    problemaMotor: jsonb("problema_motor"),
    cognitiveLoad: jsonb("cognitive_load"),
    chunks: jsonb("chunks"),
    rubrics: jsonb("rubrics"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [unique("uq_blueprint_modules_blueprint_order").on(table.blueprintId, table.order)],
)
