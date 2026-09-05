import { boolean, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),

  branding: jsonb("branding").default({}),
  settings: jsonb("settings").default({}),
  // D6 (faxina 2026-09): `standard` é o DEFAULT do banco desde
  // `20260217000000_*.sql:16` (`ALTER COLUMN plan SET DEFAULT 'standard'`).
  // O Drizzle dizia `essencial` e o `feature-gate.ts` caía em `essencial` —
  // três respostas para a mesma pergunta. O banco é a que vale em produção.
  plan: text("plan", { enum: ["essencial", "standard", "premium"] }).default("standard"),
  status: text("status", { enum: ["active", "inactive"] }).default("active"),

  // M2 (faxina 2026-09, D4): a marca e os módulos saem do build e passam a vir
  // do banco. `brand` tem o shape de `TenantConfig.brand` — SEM `customCSS`,
  // que desemboca em `dangerouslySetInnerHTML` e nunca deve vir de dado escrito
  // por admin de cliente. Ver `supabase/migrations/20260906001000_*.sql`.
  brand: jsonb("brand").notNull().default({}),
  // Módulos CONTRATADOS pela empresa. Exposição de UI, nunca permissão — a
  // trava é RLS. Validado contra `MODULE_IDS` no app, não por CHECK.
  modules: text("modules").array().notNull().default([]),

  whitelabelEnabled: boolean("whitelabel_enabled").default(false),
  whitelabelConfig: jsonb("whitelabel_config").default({}),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})
