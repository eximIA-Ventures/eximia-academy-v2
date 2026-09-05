import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { tenants } from "./tenants"

/**
 * Domínios PRÓPRIOS de tenant (ex.: `argos.eximiaacademy.com.br`).
 *
 * O host canônico `{slug}.{NEXT_PUBLIC_APP_BASE_DOMAIN}` NÃO mora aqui — ele é
 * derivado por string no app, sem banco (faxina 2026-09, D1). Esta tabela só
 * existe para o caso em que o endereço não é derivável do slug.
 *
 * Host nunca autoriza nada: esta tabela decide qual MARCA renderizar. Quem lê o
 * quê continua sendo RLS por `users.tenant_id`.
 *
 * DDL: `supabase/migrations/20260906000000_tenant_domains.sql`.
 */
export const tenantDomains = pgTable("tenant_domains", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  /** Minúsculas, sem porta e sem esquema. Único por `lower(host)` na plataforma. */
  host: text("host").notNull(),
  /** Host usado para links absolutos sem contexto de request. No máximo um por tenant. */
  isPrimary: boolean("is_primary").notNull().default(false),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})
