import {
  type AnyPgColumn,
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"
import { jobRoles } from "./job-roles"
import { tenants } from "./tenants"

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  fullName: text("full_name").notNull(),
  reportName: text("report_name"),
  role: text("role", {
    enum: ["student", "leader", "manager", "admin", "super_admin", "instructor"],
  }).notNull(),
  status: text("status", { enum: ["active", "inactive"] })
    .notNull()
    .default("active"),
  jobRoleId: uuid("job_role_id").references((): AnyPgColumn => jobRoles.id, {
    onDelete: "set null",
  }),
  reportsTo: uuid("reports_to").references((): AnyPgColumn => users.id),
  avatarUrl: text("avatar_url"),
  profile: jsonb("profile").default({}),
  onboardingCompleted: boolean("onboarding_completed").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
})
