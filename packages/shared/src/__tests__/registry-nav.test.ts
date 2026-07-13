import { describe, expect, it } from "vitest"
import {
  type ModuleId,
  type ModuleNavEntry,
  type NavContext,
  type Role,
  buildNavigation,
  navKeysForContext,
  navRoleForContext,
} from "../modules/registry"

/**
 * Nav is a PURE function of the active context (WP5, workspace separation).
 *
 * Contract:
 *  - `personal` ("Minha Trilha")  => ONLY the learner universe. Never "Gestão do Time".
 *  - `team` ("Meu Time")          => ONLY the manager universe: Principal (team dashboard),
 *                                    Perfis da Equipe, Engajamento, Analytics, under
 *                                    "Gestão do Time". Never learner items.
 *  - `organization`               => analogous to team (manager, org-scope), no learner items.
 *  - admin/super_admin keys are gated by the union of hats (unchanged).
 */

const personal: NavContext["context"] = { type: "personal" }
const team: NavContext["context"] = { type: "team" }
const organization: NavContext["context"] = { type: "organization" }

const ctx = (roles: Role[], context: NavContext["context"]): NavContext => ({ roles, context })

/** All modules a rich tenant might enable — proves the pure-context invariant even
 *  when the learner-surface modules (biblioteca/community/assessments) are ON. */
const ALL_MODULES: ModuleId[] = [
  "academy",
  "biblioteca",
  "analytics",
  "admin",
  "assessments",
  "community",
  "course-designer",
  "units",
  "integrations",
]

/** Learner-universe hrefs that must NEVER appear in a manager/team workspace. */
const LEARNER_HREFS = [
  "/courses",
  "/materiais",
  "/lives",
  "/sessions",
  "/biblioteca",
  "/comunidade",
  "/assessments",
  "/profile/learning",
]

/** Extract only the item labels (drop section headers). */
function labels(entries: ModuleNavEntry[]): string[] {
  return entries
    .filter((e): e is Extract<ModuleNavEntry, { label: string }> => "label" in e)
    .map((e) => e.label)
}

/** Extract only the item hrefs. */
function hrefs(entries: ModuleNavEntry[]): string[] {
  return entries
    .filter((e): e is Extract<ModuleNavEntry, { href: string }> => "href" in e)
    .map((e) => e.href)
}

/** Extract the section headers, in order. */
function sections(entries: ModuleNavEntry[]): string[] {
  return entries
    .filter((e): e is Extract<ModuleNavEntry, { section: string }> => "section" in e)
    .map((e) => e.section)
}

// ---------------------------------------------------------------------------
// navRoleForContext / navKeysForContext — the view-role resolution
// ---------------------------------------------------------------------------

describe("navRoleForContext — active context decides the view role", () => {
  it("personal => 'student' for ANY hat (manager viewing their own trail)", () => {
    expect(navRoleForContext(ctx(["manager", "student"], personal))).toBe("student")
    expect(navRoleForContext(ctx(["admin", "student"], personal))).toBe("student")
  })

  it("team/org + manager hat => 'manager'", () => {
    expect(navRoleForContext(ctx(["manager", "student"], team))).toBe("manager")
    expect(navRoleForContext(ctx(["manager", "student"], organization))).toBe("manager")
  })
})

describe("navKeysForContext — admin-tier keys gated by real hats", () => {
  it("pure manager in team => ['manager'], never an admin key", () => {
    expect(navKeysForContext(ctx(["manager", "student"], team))).toEqual(["manager"])
  })

  it("admin hat present => ['admin']", () => {
    expect(navKeysForContext(ctx(["admin", "student"], organization))).toEqual(["admin"])
  })

  it("instructor view-role is never emitted in the standard world (falls back to student)", () => {
    expect(navKeysForContext(ctx(["instructor"], team))).toEqual(["student"])
  })
})

// ---------------------------------------------------------------------------
// buildNavigation — the actual sidebar contract per context
// ---------------------------------------------------------------------------

describe("buildNavigation — personal context is PURE learner universe", () => {
  const nav = buildNavigation(ALL_MODULES, ctx(["manager", "student"], personal))

  it("shows the learner nav (Cursos e Trilhas, Materiais, Meu Perfil)", () => {
    const l = labels(nav)
    expect(l).toContain("Cursos e Trilhas")
    expect(l).toContain("Materiais")
    expect(l).toContain("Meu Perfil")
  })

  it("NEVER shows the 'Gestão do Time' section", () => {
    expect(sections(nav)).not.toContain("Gestão do Time")
  })

  it("NEVER shows manager-only items (Perfis da Equipe)", () => {
    expect(labels(nav)).not.toContain("Perfis da Equipe")
  })
})

describe("buildNavigation — team context is PURE manager universe", () => {
  const nav = buildNavigation(ALL_MODULES, ctx(["manager", "student"], team))

  it("shows exactly the manager set: Principal, Perfis da Equipe, Engajamento, Analytics", () => {
    expect(labels(nav)).toEqual(["Principal", "Perfis da Equipe", "Engajamento", "Analytics"])
  })

  it("groups everything under a single 'Gestão do Time' section", () => {
    expect(sections(nav)).toEqual(["Gestão do Time"])
  })

  it("'Principal' points to /dashboard (the team dashboard in team context)", () => {
    expect(hrefs(nav)).toContain("/dashboard")
  })

  it("does NOT leak any learner-universe route into the team workspace", () => {
    const teamHrefs = hrefs(nav)
    for (const learner of LEARNER_HREFS) {
      expect(teamHrefs).not.toContain(learner)
    }
  })
})

describe("buildNavigation — organization context (manager scope) mirrors team, no learner items", () => {
  const nav = buildNavigation(ALL_MODULES, ctx(["manager", "student"], organization))

  it("shows the manager set, never learner items", () => {
    expect(labels(nav)).toEqual(["Principal", "Perfis da Equipe", "Engajamento", "Analytics"])
    const orgHrefs = hrefs(nav)
    for (const learner of LEARNER_HREFS) {
      expect(orgHrefs).not.toContain(learner)
    }
  })
})

describe("buildNavigation — admin keys are untouched (regression guard)", () => {
  it("admin in organization still gets the Administração section + tenant admin items", () => {
    const nav = buildNavigation(ALL_MODULES, ctx(["admin", "student"], organization))
    const s = sections(nav)
    const l = labels(nav)
    expect(s).toContain("Administração")
    expect(l).toContain("Usuários")
    expect(l).toContain("Cargos")
    // admin still never shows the manager-only "Gestão do Time" section
    expect(s).not.toContain("Gestão do Time")
  })
})
