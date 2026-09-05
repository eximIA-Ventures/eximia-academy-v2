import { pgTable, text, timestamp } from "drizzle-orm/pg-core"

/**
 * E-mails que viram `super_admin` ao se cadastrar (faxina 2026-09, D13).
 *
 * Só `service_role` escreve — se `authenticated` pudesse, qualquer usuário se
 * auto-promoveria a dono da plataforma. O gatilho `trg_bootstrap_super_admin`
 * em `auth.users` consulta esta tabela e o parâmetro de banco
 * `app.bootstrap_super_admin_email`.
 *
 * DDL: `supabase/migrations/20260906005000_bootstrap_super_admin.sql`.
 */
export const bootstrapSuperAdmins = pgTable("bootstrap_super_admins", {
  /** Sempre em minúsculas e sem espaços (CHECK no banco). */
  email: text("email").primaryKey(),
  motivo: text("motivo"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})
