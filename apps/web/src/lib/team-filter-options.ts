// =============================================================================
// resolveTeamFilterOptions — opções do filtro de time do recorte ("Quem estou
// analisando?"), COMPARTILHADAS entre os dois call sites que renderizam
// <TeamScopeControl>: o dashboard "Meu Time"
// (dashboard/_components/manager-team-dashboard-page.tsx) e a página
// /analytics na visão Gestor (analytics/page.tsx).
//
// Extraída de manager-team-dashboard-page.tsx (onde nasceu, S6/Onda 2) para
// que /analytics renderize o MESMO card completo, sem duplicar a regra.
// =============================================================================

import {
  DIRECT_TEAM_KEY,
  type TeamFilterOption,
} from "@/app/(platform)/dashboard/_components/team-filter-dropdown"
import { type StudentSubteamAssignment, getStudentSubteamMap } from "@/lib/area-context"
import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Parte PURA de `resolveTeamFilterOptions`: opções derivadas de um
 * `getStudentSubteamMap` JÁ resolvido. Extraída (2026-08-12) porque
 * /analytics precisa do MESMO mapa duas vezes — para as opções do dropdown E
 * para anexar `subteam` às rows do roster — e pagar a resolução (que faz uma
 * RPC por sub-time) duas vezes seria desperdício puro.
 */
export function buildTeamFilterOptions(
  subteamMap: Map<string, StudentSubteamAssignment>,
): TeamFilterOption[] | undefined {
  if (subteamMap.size === 0) return undefined

  const bySubteam = new Map<string, TeamFilterOption>()
  for (const assignment of subteamMap.values()) {
    const option = bySubteam.get(assignment.subteamId)
    if (option) {
      option.count = (option.count ?? 0) + 1
      continue
    }
    bySubteam.set(assignment.subteamId, {
      key: assignment.subteamId,
      label: assignment.subteamName || "Sem nome",
      count: 1,
      subteam: {
        id: assignment.subteamId,
        name: assignment.subteamName,
        colorIndex: assignment.colorIndex,
        path: assignment.path,
      },
    })
  }

  const options = [...bySubteam.values()].sort((a, b) => a.label.localeCompare(b.label))
  options.push({ key: DIRECT_TEAM_KEY, label: "Direto" })
  return options
}

/**
 * S6 (Onda 2): opções do filtro de time elevado ao recorte, derivadas do
 * MESMO universo de `getStudentSubteamMap` que preenche `subteam` nas rows
 * (mitigação (b) do Risco 3 da spec S6 — decisão registrada em spec-001,
 * NÃO usar `nav.subteams`). `undefined` quando não há sub-times (só Diretos
 * apareceria, e o dropdown já se auto-oculta com <= 1 opção).
 *
 * `db` DEVE ser o client AUTENTICADO do gestor: `getStudentSubteamMap` lê
 * `auth.uid()` via `auth_subtree_user_ids()`.
 */
export async function resolveTeamFilterOptions(
  // biome-ignore lint/suspicious/noExplicitAny: loosely-typed RLS client, matches lib/area-context.ts
  db: SupabaseClient<any, "public", any>,
  tenantId: string,
  managerId: string,
): Promise<TeamFilterOption[] | undefined> {
  return buildTeamFilterOptions(await getStudentSubteamMap(db, tenantId, managerId))
}
