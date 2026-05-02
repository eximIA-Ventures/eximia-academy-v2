import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { courses } from "./courses"
import { tenants } from "./tenants"

export const chapters = pgTable("chapters", {
  id: uuid("id").primaryKey().defaultRandom(),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content"),
  learningObjective: text("learning_objective"),
  order: integer("order").notNull().default(0),
  status: text("status", { enum: ["draft", "published"] })
    .notNull()
    .default("draft"),
  // WS2 fields (D13) — nullable for backward compatibility
  interactionType: text("interaction_type", {
    enum: ["socratic_dialogue", "quiz", "scenario", "assignment"],
  }),
  bloomTarget: text("bloom_target", {
    enum: ["remembering", "understanding", "applying", "analyzing", "evaluating", "creating"],
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})
