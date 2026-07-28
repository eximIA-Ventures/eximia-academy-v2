// =============================================================================
// resolveDashboardKind — the heart of the dashboard router (E8, §4.2)
// =============================================================================
//
// CONTEXTO ESTREITA, RLS CONCEDE. This function decides *which* dashboard to
// render among the ones the person's capabilities allow. It NEVER unlocks a
// dashboard the hats don't grant: a forged `x-active-context` for `team`/
// `organization` on a user without the matching hat falls through to the
// precedence branch (capability-gated), and even if a management shell were
// rendered, the RLS in the database returns zero rows (AC9/AC10). The context
// only chooses the screen; the database is the only authorization gate.
//
// Pure, server-side, fully unit-testable. No I/O.
// =============================================================================

import type { AvailableContext } from "@/lib/context-resolver"
import { hasAnyRole, hasRole } from "@/lib/role-helpers"

/** Minimal profile shape this resolver needs: the UNION of hats (E1). */
export interface DashboardProfile {
  roles: string[]
}

export type DashboardKind = "student" | "manager-team" | "manager" | "admin" | "super-admin"

/**
 * Decide which dashboard to render from (hats, active-context), by capability +
 * the SAME precedence as the database (`recompute_primary_role`, E1):
 * super_admin > admin > manager > instructor > leader > student.
 *
 * Mapping (AC2/AC3/AC11):
 *   - context `personal`                       => "student" (any hat — absorbs view-as-student)
 *   - context `team`         + manager hat     => "manager-team"
 *   - context `organization` + super_admin hat => "super-admin"
 *   - context `organization` + admin hat       => "admin"
 *   - context `organization` + manager hat     => "manager"
 *   - no/insufficient context                  => default by precedence (also capability-gated)
 *
 * @param profile  carries `profile.roles[]` (the union of hats)
 * @param ctx      the active context (E7 §4.10: personal | team | organization)
 */
export function resolveDashboardKind(
  profile: DashboardProfile,
  ctx: AvailableContext,
  /**
   * Workspace ATIVO (eixo de 4 mundos). OPCIONAL de propósito: ausente => o
   * comportamento LEGADO, byte-idêntico ao de antes desta rodada. Mesmo padrão
   * do campo `workspace` do `NavContext` em `@eximia/shared`.
   */
  workspace?: "standard" | "studio" | "admin" | "super",
): DashboardKind {
  // 0) MUNDO PADRÃO x ADMINISTRAÇÃO — o mundo de APRENDIZAGEM não contém
  //    ADMINISTRAÇÃO (`docs/stories/workspace-separation.story.md`).
  //
  //    RODADA 9 travou só o `super_admin`. RODADA 10 (A2) mediu que a trava era
  //    estreita demais e deixava passar o caso COMUM: o ADMIN DE EMPRESA.
  //    Tipicamente sem matrícula, ele não tem contexto `personal` — o
  //    `buildAvailable` só lhe dá `organization` —, então `defaultContext` subia
  //    para `organization`, o passo 2 abaixo devolvia "admin" e o `/dashboard`
  //    montava o painel ADMINISTRATIVO dentro do mundo de aprender. Tabela do
  //    furo, por função pura:
  //      MUNDO PADRAO  admin de empresa  personal=student team=admin organization=admin
  //
  //    A trava agora vale para o ADMIN-TIER INTEIRO (admin e super_admin), e é
  //    escrita como REMOÇÃO DE CHAPÉU, não como retorno fixo "student": neste
  //    mundo os chapéus administrativos simplesmente não valem, e a decisão é
  //    reprocessada pela MESMA função com os chapéus restantes. Duas
  //    consequências, ambas desejadas:
  //      - admin de empresa / admin+instrutor / super_admin => a experiência de
  //        aprendizagem, com o estado vazio HONESTO de quem não tem matrícula;
  //      - GESTOR INTOCADO: quem também carrega o chapéu `manager` continua
  //        vendo o time (`manager-team`) e a organização (`manager`) no mundo
  //        Padrão, que é o desenho legítimo — tirar isso seria consertar a
  //        fronteira quebrando um caso que ninguém reclamou.
  //
  //    A recursão termina em UM nível: o perfil reprocessado já não tem chapéu
  //    admin-tier, então esta guarda não pode disparar de novo.
  if (workspace === "standard" && hasAnyRole(profile, ["admin", "super_admin"])) {
    const learnerProfile: DashboardProfile = {
      roles: profile.roles.filter((r) => r !== "admin" && r !== "super_admin"),
    }
    return resolveDashboardKind(learnerProfile, ctx, workspace)
  }

  // 1) Explicit "personal" => always the student trail (absorbs view-as-student).
  if (ctx.type === "personal") return "student"

  // 2) Management context requires the matching CAPABILITY. Without it, fall
  //    through to the precedence default (step 3) — context never grants access.
  if (ctx.type === "team" && hasRole(profile, "manager")) return "manager-team"
  if (ctx.type === "organization" && hasAnyRole(profile, ["admin", "super_admin", "manager"])) {
    return hasRole(profile, "super_admin")
      ? "super-admin"
      : hasRole(profile, "admin")
        ? "admin"
        : "manager"
  }

  // 3) No explicit (or insufficient) context => default view by the SAME
  //    precedence as the DB (E1). Still capability-gated.
  if (hasRole(profile, "super_admin")) return "super-admin"
  if (hasRole(profile, "admin")) return "admin"
  if (hasRole(profile, "manager")) return ctx.type === "team" ? "manager-team" : "manager"
  // instructor/leader have dedicated routes (handled in page.tsx by hasRole);
  // a pure student lands here.
  return "student"
}
