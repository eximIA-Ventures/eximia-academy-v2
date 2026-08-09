import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import type { DepartmentsSnapshot, PersonRef } from "./departments-model"
import { EMPTY_SNAPSHOT } from "./departments-model"
import { type AdminAreasLoad, loadAdminAreas } from "./loader"

// =============================================================================
// LEITURA DA CAMADA DE DEPARTAMENTO (CFG-7.1)
// =============================================================================
// As UNIDADES (tabela `areas`, colunas do kanban) continuam sendo lidas pelo
// `loadAdminAreas` já existente e já testado — este loader não duplica aquela
// query, ele a COMPÕE e acrescenta só a camada nova.
//
// AC0.1 — POR QUE TODO SELECT AQUI FILTRA `tenant_id` NA MÃO:
// `departments`, `department_areas` e `user_departments` ganharam na migration
// uma policy `..._super_admin` com bypass `is_super_admin()` que a tabela
// `areas` NÃO tem. Para o dono do produto (único super_admin, `tenant_id` NULL),
// uma query ingênua traria departamentos de TODAS as empresas, enquanto as
// colunas do Mapa (via `areas`) viriam corretamente escopadas — um kanban com
// colunas de uma empresa e pilhas de várias. O defeito é silencioso: nenhuma
// query falha, nenhum tipo quebra, só aparece dado alheio na tela do dono.
// Por isso o recorte é EXPLÍCITO no client e nunca delegado ao RLS.
// =============================================================================

export type AdminAreasWorkspaceLoad =
  | { kind: "unauthenticated" }
  | { kind: "module-disabled" }
  | {
      kind: "ok"
      areas: Extract<AdminAreasLoad, { kind: "ok" }>["areas"]
      snapshot: DepartmentsSnapshot
    }

/** Client mínimo que este módulo precisa — server client OU service client. */
// biome-ignore lint/suspicious/noExplicitAny: ponte estrutural entre os dois clients supabase
type AnyDbClient = { from: (table: string) => any }

export async function loadAreasWorkspace(): Promise<AdminAreasWorkspaceLoad> {
  const areasLoad = await loadAdminAreas()
  if (areasLoad.kind !== "ok") return areasLoad

  const { profile, supabase } = await getAuthProfile()
  if (!profile) return { kind: "unauthenticated" }

  const tenantId = await resolveTenantId(profile.tenant_id)
  if (!tenantId) {
    return { kind: "ok", areas: areasLoad.areas, snapshot: EMPTY_SNAPSHOT }
  }

  // Mesmo critério de client do `loadAdminAreas`: perfil sem tenant próprio
  // (super_admin operando outra empresa) lê pelo service client. O recorte por
  // empresa não vem do client, vem do `.eq("tenant_id", ...)` abaixo.
  let client: AnyDbClient = supabase as AnyDbClient
  if (!profile.tenant_id) {
    const { createServiceClient } = await import("@/lib/supabase/service")
    client = createServiceClient() as AnyDbClient
  }

  const snapshot = await fetchDepartmentsSnapshot(
    client,
    tenantId,
    areasLoad.areas.map((a) => ({
      id: a.id,
      name: a.name,
      slug: a.slug,
      description: a.description,
    })),
  )

  return { kind: "ok", areas: areasLoad.areas, snapshot }
}

/**
 * Lê a camada de departamento de UMA empresa.
 *
 * Recebe as unidades prontas (quem chama já as tem, seja pelo `loadAdminAreas`
 * da tela, seja pela própria query da rota de escrita) para não ler `areas` duas
 * vezes no mesmo request.
 *
 * TODO o recorte por empresa é explícito aqui — ver AC0.1 no topo do arquivo.
 */
export async function fetchDepartmentsSnapshot(
  client: AnyDbClient,
  tenantId: string,
  unidades: DepartmentsSnapshot["unidades"],
): Promise<DepartmentsSnapshot> {
  const [departmentsRes, presencesRes, membershipsRes] = await Promise.all([
    client
      .from("departments")
      .select("id, name, slug, description")
      .eq("tenant_id", tenantId)
      .order("name"),
    client.from("department_areas").select("department_id, area_id").eq("tenant_id", tenantId),
    client.from("user_departments").select("user_id, department_id").eq("tenant_id", tenantId),
  ])

  const departmentRows = (departmentsRes.data ?? []) as DepartmentRow[]
  const presenceRows = (presencesRes.data ?? []) as PresenceRow[]
  const membershipRows = (membershipsRes.data ?? []) as MembershipRow[]

  const memberIds = [...new Set(membershipRows.map((m) => m.user_id))]

  let people: PersonRef[] = []
  if (memberIds.length > 0) {
    const [usersRes, userAreasRes] = await Promise.all([
      // `users.role` é a coluna primária derivada dos chapéus reais
      // (`recompute_primary_role`); aqui ela serve só de RÓTULO ("gestor"), não
      // de gate de permissão — o gate continua sendo `hasAnyRole` nas rotas.
      client
        .from("users")
        .select("id, full_name, email, role")
        .eq("tenant_id", tenantId)
        .in("id", memberIds),
      // `user_areas` não tem coluna `tenant_id`; o recorte vem do `in(memberIds)`,
      // e essa lista já nasceu escopada pela query de `user_departments` acima.
      client
        .from("user_areas")
        .select("user_id, area_id")
        .in("user_id", memberIds),
    ])

    const unitByUser = new Map<string, string>()
    for (const row of (userAreasRes.data ?? []) as UserAreaRow[]) {
      unitByUser.set(row.user_id, row.area_id)
    }

    people = ((usersRes.data ?? []) as UserRow[]).map((u) => ({
      id: u.id,
      name: u.full_name ?? u.email ?? "",
      email: u.email ?? null,
      isManager: u.role === "manager",
      areaId: unitByUser.get(u.id) ?? null,
    }))
  }

  return {
    unidades,
    departments: departmentRows.map((d) => ({
      id: d.id,
      name: d.name,
      slug: d.slug,
      description: d.description ?? null,
    })),
    presences: presenceRows.map((p) => ({ departmentId: p.department_id, areaId: p.area_id })),
    memberships: membershipRows.map((m) => ({ userId: m.user_id, departmentId: m.department_id })),
    people,
  }
}

/* ----------------------- Formas cruas vindas do banco --------------------- */

interface DepartmentRow {
  id: string
  name: string
  slug: string
  description: string | null
}
interface PresenceRow {
  department_id: string
  area_id: string
}
interface MembershipRow {
  user_id: string
  department_id: string
}
interface UserRow {
  id: string
  full_name: string | null
  email: string | null
  role: string
}
interface UserAreaRow {
  user_id: string
  area_id: string
}
