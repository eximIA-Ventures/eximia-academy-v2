// ---------------------------------------------------------------------------
// Module IDs — the canonical list of toggleable platform modules
// ---------------------------------------------------------------------------

export const MODULE_IDS = [
  "academy",
  "biblioteca",
  "analytics",
  "admin",
  "assessments",
  "community",
  "course-designer",
  "units",
  "integrations",
] as const

export type ModuleId = (typeof MODULE_IDS)[number]

// ---------------------------------------------------------------------------
// Module definition
// ---------------------------------------------------------------------------

export interface ModuleNavItem {
  label: string
  href: string
  /** Lucide icon name (resolved at runtime by the app) */
  icon: string
  badge?: string
}

export interface ModuleNavSection {
  section: string
}

export type ModuleNavEntry = ModuleNavItem | ModuleNavSection

export type Role = "student" | "leader" | "manager" | "admin" | "instructor" | "super_admin"

export interface ModuleDefinition {
  id: ModuleId
  name: string
  description: string
  /** Core modules cannot be disabled */
  core: boolean
  /** Navigation items contributed by this module, keyed by role */
  nav: Partial<Record<Role, ModuleNavEntry[]>>
  /** Route prefixes owned by this module (for ModuleGate) */
  routes: string[]
  /** API route prefixes owned by this module */
  apiRoutes: string[]
  /**
   * Optional, named capabilities this module can expose. These are pure UX
   * exposure flags (e.g. show/hide an admin sub-feature) — NEVER permission.
   * The RLS in the database remains the only authorization gate (EPIC-30 §2,§4#5).
   * Used by E10 to expose the org-tree admin sub-feature behind a per-tenant flag.
   */
  capabilities?: Partial<Record<ModuleCapability, boolean>>
}

// ---------------------------------------------------------------------------
// Module capabilities (UX exposure flags — feature-flag, NEVER permission)
// ---------------------------------------------------------------------------

/**
 * Named, opt-in UX capabilities a module can expose. A capability is a feature
 * flag for *visibility* only — it decides whether a piece of UI is rendered, it
 * does NOT widen what the user can read. RLS is the trava. (EPIC-30 §2,§4#5.)
 *
 * - `org-tree`: E10 admin org-tree view (manager-groups / explicit-reach UI).
 *   Exposed per-tenant; rendering it for a user without the role yields, at
 *   worst, an empty screen because RLS denies the rows.
 */
export type ModuleCapability = "org-tree"

/**
 * Resolve whether a module capability is exposed for a given tenant.
 * Precedence: per-tenant override (feature flag) > module default. Default false.
 *
 * IMPORTANT: this answers "should the UI show this?", never "can the user do this?".
 * The DB RLS is the authorization boundary; this is exposure only.
 */
export function isCapabilityEnabled(
  moduleId: ModuleId,
  capability: ModuleCapability,
  tenantFlags?: Partial<Record<ModuleCapability, boolean>> | null,
): boolean {
  if (tenantFlags && capability in tenantFlags) {
    return tenantFlags[capability] === true
  }
  return MODULE_DEFINITIONS[moduleId]?.capabilities?.[capability] === true
}

// ---------------------------------------------------------------------------
// Module definitions
// ---------------------------------------------------------------------------

export const MODULE_DEFINITIONS: Record<ModuleId, ModuleDefinition> = {
  academy: {
    id: "academy",
    name: "Academy",
    description: "Cursos, trilhas de aprendizagem, sessões, materiais e lives",
    core: true,
    nav: {
      student: [
        { label: "Principal", href: "/dashboard", icon: "LayoutDashboard" },
        { label: "Cursos e Trilhas", href: "/courses", icon: "Compass" },
        { label: "Materiais", href: "/materiais", icon: "SquareStack" },
        { label: "Meu Perfil", href: "/profile/learning", icon: "UserCircle" },
      ],
      leader: [
        { section: "Lideranca" },
        { label: "Minha Equipe", href: "/leader", icon: "Users" },
        { section: "Aprendizado" },
        { label: "Cursos e Trilhas", href: "/courses", icon: "Compass" },
        { label: "Materiais", href: "/materiais", icon: "SquareStack" },
      ],
      manager: [
        { section: "Aprendizado" },
        { label: "Principal", href: "/dashboard", icon: "LayoutDashboard" },
        { label: "Minhas Sessões", href: "/sessions", icon: "MessageSquare" },
        { label: "Cursos e Trilhas", href: "/courses", icon: "Compass" },
        { label: "Lives", href: "/lives", icon: "Play" },
        { label: "Materiais", href: "/materiais", icon: "SquareStack" },
      ],
      admin: [
        { section: "Conteúdo" },
        { label: "Principal", href: "/dashboard", icon: "LayoutDashboard" },
        { label: "Cursos e Trilhas", href: "/courses", icon: "GraduationCap" },
        { label: "Trilhas de Aprendizagem", href: "/trails", icon: "Route" },
      ],
      super_admin: [
        { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
        { label: "Empresas", href: "/admin/tenants", icon: "Building2" },
      ],
      instructor: [
        { section: "Ensino" },
        { label: "Meu Painel", href: "/instructor", icon: "LayoutDashboard" },
        { label: "Cursos e Trilhas", href: "/courses", icon: "GraduationCap" },
        { label: "Trilhas de Aprendizagem", href: "/trails", icon: "Route" },
        { label: "Engajamento", href: "/admin/notifications", icon: "Sparkles" },
      ],
    },
    routes: [
      "/dashboard",
      "/sessions",
      "/courses",
      "/lives",
      "/materiais",
      "/profile",
      "/instructor",
      "/leader",
      "/trails",
      "/verso",
    ],
    apiRoutes: [
      "/api/courses",
      "/api/chapters",
      "/api/sessions",
      "/api/reflections",
      "/api/ingestion",
      "/api/generation-jobs",
      "/api/enrichment-jobs",
      "/api/blueprint",
    ],
  },

  analytics: {
    id: "analytics",
    name: "Analytics",
    description: "Dashboards de progresso, métricas por aluno, sessão e curso",
    core: true,
    nav: {
      leader: [{ label: "Analytics", href: "/analytics", icon: "BarChart3" }],
      admin: [{ label: "Analytics", href: "/analytics", icon: "BarChart3" }],

      instructor: [{ label: "Analytics", href: "/analytics", icon: "BarChart3" }],
    },
    routes: ["/analytics"],
    apiRoutes: ["/api/analytics"],
  },

  admin: {
    id: "admin",
    name: "Administração",
    description: "Gestão de usuários, cargos, configurações da plataforma",
    core: true,
    nav: {
      // Manager (gestor) nav is TEAM-scoped only: managing my own team, never the
      // tenant. Tenant administration (usuários, cargos, times/manager-groups,
      // configurações, unidades) lives under the `admin`/`super_admin` keys below
      // and is only emitted for someone holding the admin/super_admin hat
      // (see `buildNavigation` — gated by the union of hats, not a single role).
      manager: [
        { section: "Gestão do Time" },
        { label: "Perfis da Equipe", href: "/team/profiles", icon: "Users" },
        // E10: o gestor abre o Centro de Engajamento v2 (/engagement). A tela
        // admin antiga (/admin/notifications) permanece intocada para o papel
        // admin (chave `admin` abaixo) e instructor (módulo academy).
        { label: "Engajamento", href: "/engagement", icon: "Sparkles" },
        { label: "Analytics", href: "/analytics", icon: "BarChart3" },
      ],
      admin: [
        { section: "Administração" },
        { label: "Engajamento", href: "/admin/notifications", icon: "Sparkles" },
        { label: "Cargos", href: "/admin/job-roles", icon: "Briefcase" },
        { label: "Usuários", href: "/admin/users", icon: "Users" },
        { label: "Unidades", href: "/admin/areas", icon: "Building2" },
        { label: "Grupos de Gestor", href: "/admin/manager-groups", icon: "UsersRound" },
        { section: "Sistema" },
        { label: "Configurações", href: "/admin/settings", icon: "Settings" },
      ],
      super_admin: [
        { label: "Integracoes", href: "/admin/integrations", icon: "Plug" },
        { label: "Auditoria", href: "/admin/audit", icon: "Shield" },
      ],
    },
    // org-tree (E10): admin org-tree / explicit-reach view. Default OFF; opt-in
    // per tenant via feature flag. Exposure only — RLS is the authorization gate.
    capabilities: { "org-tree": false },
    routes: ["/admin", "/team", "/super-admin"],
    apiRoutes: ["/api/admin", "/api/profile"],
  },

  assessments: {
    id: "assessments",
    name: "Avaliações",
    description: "Big Five, DISC, Enneagram, Kolb, Career Anchors, Múltiplas Inteligências",
    core: false,
    nav: {
      student: [{ label: "Avaliações", href: "/assessments", icon: "ClipboardCheck" }],
      leader: [{ label: "Avaliações", href: "/assessments", icon: "ClipboardCheck" }],
      manager: [{ label: "Avaliações", href: "/assessments", icon: "ClipboardCheck" }],
      admin: [{ label: "Avaliações", href: "/assessments", icon: "ClipboardCheck" }],
    },
    routes: ["/assessments"],
    apiRoutes: ["/api/assessments"],
  },

  biblioteca: {
    id: "biblioteca",
    name: "Biblioteca",
    description: "Livros e materiais de referência para consulta",
    core: false,
    nav: {
      student: [{ label: "Biblioteca", href: "/biblioteca", icon: "Library" }],
      manager: [{ label: "Biblioteca", href: "/biblioteca", icon: "Library" }],
      admin: [{ label: "Gerenciar Livros", href: "/admin/biblioteca", icon: "BookOpen" }],
      instructor: [{ label: "Biblioteca", href: "/biblioteca", icon: "Library" }],
    },
    routes: ["/biblioteca", "/admin/biblioteca"],
    apiRoutes: ["/api/admin/books"],
  },

  community: {
    id: "community",
    name: "Comunidade",
    description: "Feed de interação entre alunos, discussões e colaboração",
    core: false,
    nav: {
      student: [{ label: "Comunidade", href: "/comunidade", icon: "Sparkles" }],
      manager: [{ label: "Comunidade", href: "/comunidade", icon: "Sparkles" }],
    },
    routes: ["/comunidade"],
    apiRoutes: [],
  },

  "course-designer": {
    id: "course-designer",
    name: "Course Designer",
    description: "Geração de cursos com IA — blueprints, análise de conteúdo, auto-fill",
    core: false,
    nav: {
      admin: [{ label: "Course Designer", href: "/courses/new", icon: "Sparkles" }],
    },
    routes: ["/courses/new"],
    apiRoutes: ["/api/course-designer"],
  },

  units: {
    id: "units",
    name: "Unidades Gerenciais",
    description: "Divisões internas (plantas, filiais) com filtros e dashboards por unidade",
    core: false,
    nav: {
      // `/admin/areas` is the TENANT unit/area ADMIN screen ("Administração"),
      // not a team view — so it is admin-only. A manager works with units via the
      // area selector + their team dashboards, never the tenant admin screen.
      admin: [{ label: "Unidades", href: "/admin/areas", icon: "Building2" }],
    },
    routes: ["/admin/areas", "/area"],
    apiRoutes: ["/api/admin/areas"],
  },

  integrations: {
    id: "integrations",
    name: "Integrações",
    description: "API Keys, Webhooks, SSO e conexões com sistemas externos",
    core: false,
    nav: {
      admin: [
        { label: "API Keys", href: "/admin/api-keys", icon: "Key" },
        { label: "Integrações", href: "/admin/integrations", icon: "Plug" },
        { label: "Webhooks", href: "/admin/webhooks", icon: "Webhook" },
      ],
    },
    routes: ["/admin/api-keys", "/admin/integrations", "/admin/webhooks"],
    apiRoutes: ["/api/admin/api-keys", "/api/admin/webhooks", "/api/integrations", "/api/v1"],
  },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get module definitions for a list of enabled module IDs.
 *
 * Result is ORDERED by the canonical MODULE_IDS index (not by
 * core-modules-first insertion order), so downstream consumers that render
 * modules in list order (e.g. buildNavigation's sidebar) reflect the
 * declared module order rather than an artifact of the Set construction.
 */
export function getEnabledModules(enabledIds: ModuleId[]): ModuleDefinition[] {
  const coreModules = MODULE_IDS.filter((id) => MODULE_DEFINITIONS[id].core)
  const allEnabled = new Set([...coreModules, ...enabledIds])
  return MODULE_IDS.filter((id) => allEnabled.has(id)).map((id) => MODULE_DEFINITIONS[id])
}

// ---------------------------------------------------------------------------
// Navigation context (E8) — nav is driven by (chapéus, contexto-ativo), not by
// a single primary role. The structural shape below is intentionally compatible
// with E7's `AvailableContext` ({ type: "personal"|"team"|"organization"; ... })
// so the web app can pass its real resolved context without `packages/shared`
// depending on `apps/web`. buildNavigation only needs `context.type`.
// ---------------------------------------------------------------------------

/** Minimal shape of an active context needed to choose a nav set (structurally
 *  satisfied by E7's `AvailableContext`). */
export interface NavContextShape {
  type: "personal" | "team" | "organization"
}

/** Navigation inputs: the union of hats the person holds + the active context. */
export interface NavContext {
  roles: Role[]
  context: NavContextShape
  /** S1: active role lens. When present, it is the AUTHORITATIVE source of the
   *  view-role via navRoleForRoleLens. When absent, legacy context+precedence
   *  navRoleForContext is used. Kept optional so S2/S3 migrate incrementally. */
  lens?: RoleLens
}

/**
 * Map (hats, active-context) → the single nav key to render.
 *
 * The active context decides WHICH nav set is shown among the ones the person's
 * capabilities allow; it never unlocks a nav the hats don't grant.
 *   - context `personal` ("Minha Trilha") => always the student nav.
 *   - context `team`/`organization` => the highest management hat, by the SAME
 *     precedence as the DB (super_admin > admin > manager > instructor > leader > student),
 *     mirroring `recompute_primary_role` (E1). Falls back to student.
 *
 * NOTE: separating the student nav from the manager nav is done HERE (by
 * choosing the key from the context), reusing the existing per-role arrays.
 * `personal` never yields management items and vice-versa.
 */
export function navRoleForContext({ roles, context }: NavContext): Role {
  if (context.type === "personal") return "student"
  if (roles.includes("super_admin")) return "super_admin"
  if (roles.includes("admin")) return "admin"
  if (roles.includes("manager")) return "manager"
  if (roles.includes("instructor")) return "instructor"
  if (roles.includes("leader")) return "leader"
  return "student"
}

/**
 * Admin-tier nav keys: these expose TENANT administration (gestão de usuários,
 * configurações, áreas-admin, integrações, manager-groups admin, super-admin).
 * They must ONLY render for someone who actually holds the matching hat.
 */
const ADMIN_NAV_KEYS: ReadonlySet<Role> = new Set<Role>(["admin", "super_admin"])

/**
 * Which nav keys should render for this context, gated by the UNION OF HATS.
 *
 * The active context picks the management *view role* (`navRoleForContext`), but
 * an admin-tier nav key (`admin`/`super_admin`) is only emitted when the person
 * literally holds that hat in `roles[]` — never as a side-effect of context.
 * A pure `manager` therefore can never reach an admin nav key, so tenant-admin
 * items stay invisible to gestores. (E7 §4.10: gate by roles[]/capabilities,
 * NOT by `profile.role` equality; context never widens permission — RLS is the trava.)
 */
export function navKeysForContext(navCtx: NavContext): Role[] {
  // S1: if a lens is set, it authoritatively picks the view role. Otherwise,
  // fall back to the legacy context/precedence resolution. The ADMIN_NAV_KEYS
  // posse gate below is unchanged, a lens can never mint an admin key.
  const viewRole = navCtx.lens ? navRoleForRoleLens(navCtx.lens) : navRoleForContext(navCtx)
  // Non-admin view roles (student/leader/instructor/manager) render as-is.
  if (!ADMIN_NAV_KEYS.has(viewRole)) return [viewRole]
  // Admin-tier view role: only honour it if the hat is genuinely held.
  return navCtx.roles.includes(viewRole) ? [viewRole] : ["manager"]
}

// ---------------------------------------------------------------------------
// Role lens (S1), the PAPEL axis. Orthogonal to the POPULATION axis
// (x-active-context / ContextSwitcher). A lens decides WHICH surface renders;
// it NEVER widens permission. Admin-tier surfaces stay gated by posse via
// ADMIN_NAV_KEYS. RLS remains the only authorization trava.
// ---------------------------------------------------------------------------

/**
 * Presentable role lenses. CLOSED union, intentionally excludes admin/
 * super_admin, they operate via the posse-gated admin nav, not a lens in M1,
 * and `leader`, educador is mapped to `student`, never a distinct lens.
 */
export type RoleLens = "student" | "instructor" | "manager"

/** Precedence when auto-picking the default lens, highest management first. */
const ROLE_LENS_PRECEDENCE: RoleLens[] = ["manager", "instructor", "student"]

/**
 * Which lenses this person may assume, from the UNION of hats.
 *   - `manager` lens requires the `manager` hat.
 *   - `instructor` lens requires the `instructor` hat.
 *   - `student` lens: available to anyone who is a student OR a `leader`.
 *   - admin/super_admin do NOT add a lens. Admin surface is posse-gated by
 *     ADMIN_NAV_KEYS, not a lens. A pure admin therefore sees `student` only,
 *     unless they also hold manager/instructor.
 * Guarantee: never empty, falls back to ["student"].
 */
export function eligibleRoleLenses(roles: Role[]): RoleLens[] {
  const out: RoleLens[] = []
  if (roles.includes("manager")) out.push("manager")
  if (roles.includes("instructor")) out.push("instructor")
  if (roles.includes("student") || roles.includes("leader")) out.push("student")
  if (out.length === 0) out.push("student")
  return ROLE_LENS_PRECEDENCE.filter((lens) => out.includes(lens))
}

/**
 * Resolve the ACTIVE lens. `requested` is the already form-validated cookie
 * choice, honoured only if it is genuinely eligible, else the highest
 * precedence eligible lens. NEVER returns "leader".
 */
export function resolveRoleLens(roles: Role[], requested?: RoleLens | null): RoleLens {
  const eligible = eligibleRoleLenses(roles)
  if (requested && eligible.includes(requested)) return requested
  return eligible[0]
}

/**
 * Lenses the "Vendo como" switcher may OFFER, the PROFESSIONAL hats only
 * (manager, instructor). Student is intentionally excluded: the aluno view is
 * reached via the Context switcher (Minha Trilha), so offering it in the lens
 * switcher too is redundant. The switcher renders only when this returns >= 2
 * lenses, i.e. the person genuinely holds more than one professional hat (e.g.
 * instructor + manager, like Rinaldo). A single professional hat plus student
 * (like a pure manager) needs no lens switch, the Context switcher covers it.
 */
export function switchableRoleLenses(roles: Role[]): RoleLens[] {
  const out: RoleLens[] = []
  if (roles.includes("manager")) out.push("manager")
  if (roles.includes("instructor")) out.push("instructor")
  return ROLE_LENS_PRECEDENCE.filter((lens) => out.includes(lens))
}

/** Contract consumed by S3 and S4. */
export function isManagerLens(lens: RoleLens): boolean {
  return lens === "manager"
}

/** Map a resolved lens to the nav view-role. Leader never reaches here. */
export function navRoleForRoleLens(lens: RoleLens): Role {
  return lens
}

/**
 * Build navigation entries from enabled modules for a given nav context.
 *
 * E8: signature changed from `(enabledIds, role: Role)` to `(enabledIds, navCtx:
 * NavContext)` — nav is now driven by hats + active context, never by a single
 * `profile.role`. The nav keys are chosen by `navKeysForContext`, which gates
 * admin-tier keys behind the union of hats so a manager never sees admin items.
 */
export function buildNavigation(enabledIds: ModuleId[], navCtx: NavContext): ModuleNavEntry[] {
  const modules = getEnabledModules(enabledIds)
  const navKeys = navKeysForContext(navCtx)
  const entries: ModuleNavEntry[] = []

  for (const mod of modules) {
    for (const key of navKeys) {
      const roleNav = mod.nav[key]
      if (roleNav) entries.push(...roleNav)
    }
  }

  return entries
}

/** Check if a route path is allowed by the enabled modules */
export function isRouteAllowed(enabledIds: ModuleId[], pathname: string): boolean {
  const modules = getEnabledModules(enabledIds)
  return modules.some((mod) =>
    mod.routes.some((route) => pathname === route || pathname.startsWith(`${route}/`)),
  )
}

/** Check if an API route is allowed by the enabled modules */
export function isApiRouteAllowed(enabledIds: ModuleId[], pathname: string): boolean {
  const modules = getEnabledModules(enabledIds)
  return modules.some((mod) =>
    mod.apiRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`)),
  )
}
