import { fetchAuthAccounts } from "@/app/(platform)/admin/users/auth-accounts"
import {
  type AdminOverview,
  type AdoptionAxis,
  loadAdminOverview,
} from "@/lib/analytics/admin-overview"
import type { ServiceClient } from "@/lib/analytics/area-gestor"
import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import { hasAnyRole } from "@/lib/role-helpers"

/**
 * Leitura da tela `/admin/visao-geral`.
 *
 * DOIS PONTOS QUE NÃO PODEM SER RELAXADOS:
 *
 * 1. `resolveTenantId`. O `super_admin` tem `tenant_id` NULO — sem esta
 *    resolução a tela abriria vazia justamente para o dono do produto. É o modo
 *    de falha conhecido desta base (ver `admin/users/loader.ts`), e aqui ele é
 *    critério de saída, não detalhe.
 * 2. Service client sempre. A leitura é org-wide (sessões e reflexões de TODA a
 *    população), o mesmo motivo pelo qual `/meu-plano` já usa o service client
 *    para o `OrgReference`. O recorte por empresa não vem do RLS, vem do
 *    `tenantId` resolvido no servidor e propagado em toda query.
 */
export type AdminOverviewLoad =
  | { kind: "unauthenticated" }
  | { kind: "forbidden" }
  | { kind: "no-tenant" }
  | { kind: "ok"; overview: AdminOverview }

export async function loadAdminOverviewPage(axis: AdoptionAxis): Promise<AdminOverviewLoad> {
  const { user, profile, roles } = await getAuthProfile()
  if (!user || !profile) return { kind: "unauthenticated" }
  if (!hasAnyRole({ roles }, ["admin", "super_admin"])) return { kind: "forbidden" }

  const tenantId = await resolveTenantId(profile.tenant_id)
  if (!tenantId) return { kind: "no-tenant" }

  const { createServiceClient } = await import("@/lib/supabase/service")
  const db = createServiceClient() as unknown as ServiceClient

  const overview = await loadAdminOverview(db, tenantId, {
    axis,
    // Os fatos de convite vêm do accessor privilegiado que a tela de Usuários já
    // usa — a mesma varredura paginada do GoTrue, nunca uma segunda cópia dela.
    // Falha do Auth devolve mapa vazio e o funil cai no par Ativo/Inativo.
    inviteFacts: (userIds) => fetchAuthAccounts(userIds),
  })

  return { kind: "ok", overview }
}

/** `?eixo=` da barra de seleção. Valor desconhecido cai na unidade (default). */
export function parseAdoptionAxis(value: string | string[] | undefined): AdoptionAxis {
  const raw = Array.isArray(value) ? value[0] : value
  return raw === "departamento" || raw === "department" ? "department" : "area"
}
