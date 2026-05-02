import { integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { blueprintModules } from "./blueprint-modules"
import { courseBlueprints } from "./course-blueprints"

export const blueprintObjectives = pgTable("blueprint_objectives", {
  id: uuid("id").primaryKey().defaultRandom(),
  blueprintId: uuid("blueprint_id")
    .notNull()
    .references(() => courseBlueprints.id, { onDelete: "cascade" }),
  objectiveId: text("objective_id").notNull(),
  moduleNumber: integer("module_number").notNull(),
  bloomLevel: text("bloom_level").notNull(),
  behavior: text("behavior").notNull(),
  condition: text("condition").notNull(),
  degree: text("degree").notNull(),
  objectiveStatement: text("objective_statement").notNull(),

  // WS2 columns
  moduleId: uuid("module_id").references(() => blueprintModules.id, {
    onDelete: "cascade",
  }),
  abcd: jsonb("abcd"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})
