// ---------------------------------------------------------------------------
// Module IDs — the canonical list of toggleable platform modules
// ---------------------------------------------------------------------------

export const MODULE_IDS = [
  "academy",
  "analytics",
  "admin",
  "assessments",
  "biblioteca",
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

export type Role = "student" | "manager" | "admin" | "instructor" | "super_admin"

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
        { label: "Notificações", href: "/admin/notifications", icon: "Mail" },
      ],
    },
    routes: ["/dashboard", "/sessions", "/courses", "/lives", "/materiais", "/profile", "/instructor", "/trails", "/verso"],
    apiRoutes: ["/api/courses", "/api/chapters", "/api/sessions", "/api/reflections", "/api/ingestion", "/api/generation-jobs", "/api/enrichment-jobs", "/api/blueprint"],
  },

  analytics: {
    id: "analytics",
    name: "Analytics",
    description: "Dashboards de progresso, métricas por aluno, sessão e curso",
    core: true,
    nav: {
      manager: [
        { label: "Analytics", href: "/analytics", icon: "BarChart3" },
      ],
      admin: [
        { label: "Analytics", href: "/analytics", icon: "BarChart3" },
      ],

      instructor: [
        { label: "Analytics", href: "/analytics", icon: "BarChart3" },
      ],
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
      manager: [
        { section: "Gestão" },
        { label: "Notificações", href: "/admin/notifications", icon: "Mail" },
        { label: "Cargos", href: "/admin/job-roles", icon: "Briefcase" },
        { label: "Perfis da Equipe", href: "/team/profiles", icon: "Users" },
        { label: "Usuários", href: "/admin/users", icon: "Users" },
      ],
      admin: [
        { section: "Administração" },
        { label: "Notificações", href: "/admin/notifications", icon: "Mail" },
        { label: "Cargos", href: "/admin/job-roles", icon: "Briefcase" },
        { label: "Usuários", href: "/admin/users", icon: "Users" },
        { label: "Unidades", href: "/admin/areas", icon: "Building2" },
        { section: "Sistema" },
        { label: "Configurações", href: "/admin/settings", icon: "Settings" },
      ],
      super_admin: [
        { label: "Integracoes", href: "/admin/integrations", icon: "Plug" },
        { label: "Auditoria", href: "/admin/audit", icon: "Shield" },
      ],
    },
    routes: ["/admin", "/team", "/super-admin"],
    apiRoutes: ["/api/admin", "/api/profile"],
  },

  assessments: {
    id: "assessments",
    name: "Avaliações",
    description: "Big Five, DISC, Enneagram, Kolb, Career Anchors, Múltiplas Inteligências",
    core: false,
    nav: {
      student: [
        { label: "Avaliações", href: "/assessments", icon: "ClipboardCheck" },
      ],
      manager: [
        { label: "Avaliações", href: "/assessments", icon: "ClipboardCheck" },
      ],
      admin: [
        { label: "Avaliações", href: "/assessments", icon: "ClipboardCheck" },
      ],
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
      student: [
        { label: "Biblioteca", href: "/biblioteca", icon: "Library" },
      ],
      manager: [
        { label: "Biblioteca", href: "/biblioteca", icon: "Library" },
      ],
      admin: [
        { label: "Gerenciar Livros", href: "/admin/biblioteca", icon: "BookOpen" },
      ],
      instructor: [
        { label: "Biblioteca", href: "/biblioteca", icon: "Library" },
      ],
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
      student: [
        { label: "Comunidade", href: "/comunidade", icon: "Sparkles" },
      ],
      manager: [
        { label: "Comunidade", href: "/comunidade", icon: "Sparkles" },
      ],
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
      admin: [
        { label: "Course Designer", href: "/courses/new", icon: "Sparkles" },
      ],
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
      manager: [
        { label: "Unidades", href: "/admin/areas", icon: "Building2" },
      ],
      admin: [
        { label: "Unidades", href: "/admin/areas", icon: "Building2" },
      ],

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

/** Get module definitions for a list of enabled module IDs */
export function getEnabledModules(enabledIds: ModuleId[]): ModuleDefinition[] {
  const coreModules = MODULE_IDS.filter((id) => MODULE_DEFINITIONS[id].core)
  const allEnabled = new Set([...coreModules, ...enabledIds])
  return [...allEnabled].map((id) => MODULE_DEFINITIONS[id])
}

/** Build navigation entries for a given role from enabled modules */
export function buildNavigation(enabledIds: ModuleId[], role: Role): ModuleNavEntry[] {
  const modules = getEnabledModules(enabledIds)
  const entries: ModuleNavEntry[] = []

  for (const mod of modules) {
    const roleNav = mod.nav[role]
    if (roleNav) {
      entries.push(...roleNav)
    }
  }

  return entries
}

/** Check if a route path is allowed by the enabled modules */
export function isRouteAllowed(enabledIds: ModuleId[], pathname: string): boolean {
  const modules = getEnabledModules(enabledIds)
  return modules.some((mod) =>
    mod.routes.some((route) => pathname === route || pathname.startsWith(`${route}/`))
  )
}

/** Check if an API route is allowed by the enabled modules */
export function isApiRouteAllowed(enabledIds: ModuleId[], pathname: string): boolean {
  const modules = getEnabledModules(enabledIds)
  return modules.some((mod) =>
    mod.apiRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))
  )
}
