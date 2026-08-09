import { integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { áreas } from "./areas"
import { tenants } from "./tenants"
import { users } from "./users"

export const courses = pgTable("courses", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type", { enum: ["regular", "onboarding"] })
    .notNull()
    .default("regular"),

  status: text("status", { enum: ["draft", "published", "archived"] })
    .notNull()
    .default("draft"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  áreaId: uuid("area_id").references(() => áreas.id, { onDelete: "set null" }),
  // "Disponível até" (teto duro da jornada). Coluna já existente no banco via
  // migration 20260405000000_teaching_plan.sql — trazida ao schema Drizzle aqui
  // para fechar o drift pré-existente (EPIC-JORNADA, R4).
  deadlineDays: integer("deadline_days"),
  // "Meta do gestor" (recomendação de conclusão, nível curso — EPIC-JORNADA).
  // Nullable: null ⇒ curso sem meta definida (UI não mostra a bandeira âmbar,
  // ou deriva deadline_days − 21 conforme Decisão 3 do Hugo).
  managerDeadlineDays: integer("manager_deadline_days"),
  settings: jsonb("settings").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})
