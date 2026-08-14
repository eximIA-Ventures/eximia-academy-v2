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
        // 2026-08-01 — /jornada entra na navegacao. Ate aqui a tela existia sem
        // NENHUMA entrada de menu, e o unico link do repositorio inteiro era a
        // faixa "Monte ou revise sua jornada" na home, que por sua vez sumia em
        // 4 dos 5 estados de render. Adocao medida em producao antes desta
        // mudanca: 3 jornadas em 302 matriculas, 1%. A hipotese mais provavel
        // nunca foi falta de interesse, foi nao encontrar a porta.
        { label: "Minha Jornada", href: "/jornada", icon: "CalendarDays" },
        { label: "Materiais", href: "/materiais", icon: "SquareStack" },
        { label: "Meu Perfil", href: "/profile/learning", icon: "UserCircle" },
      ],
      leader: [
        { section: "Lideranca" },
        { label: "Minha Equipe", href: "/leader", icon: "Users" },
        { section: "Aprendizado" },
        { label: "Cursos e Trilhas", href: "/courses", icon: "Compass" },
        // O lider tambem e aluno, e a secao "Aprendizado" e o universo dele
        // como aprendiz. Sem esta entrada, um lider multi-hat nao alcancaria a
        // propria jornada por menu nenhum.
        { label: "Minha Jornada", href: "/jornada", icon: "CalendarDays" },
        { label: "Materiais", href: "/materiais", icon: "SquareStack" },
      ],
      // Workspace-separation (WP5): the manager nav is a PURE reflection of the
      // active management context, never a mix with the learner universe. The
      // "Principal" entry here is the manager's HOME — in `team` context it opens
      // the team dashboard (resolveDashboardKind => "manager-team") — and it opens
      // the "Gestão do Time" section (see `admin.manager` below), so no learner
      // items (courses/materials/lives/sessions/biblioteca) render for a manager.
      // Learner items are reached only via the `personal` ("Minha Trilha") context,
      // which renders the `student` key.
      manager: [
        { section: "Gestão do Time" },
        { label: "Principal", href: "/dashboard", icon: "LayoutDashboard" },
      ],
      // W2: a home do mundo admin é `/admin` (o painel administrativo), não
      // `/dashboard` (que é a porta do mundo PADRÃO). Estas chaves só renderizam
      // dentro do mundo admin (ver `navKeysForContext`), então o retarget não
      // afeta o Padrão.
      //
      // "Materiais" (`/materiais`): item da lista de OPERAÇÃO que o dono pediu
      // para o mundo admin ("Painel, Cursos e Trilhas, Materiais, Gerenciar
      // Livros, Analytics, Engajamento"). A rota já existe e é aberta a
      // qualquer autenticado (`(platform)/materiais/page.tsx` só exige sessão),
      // e a chave `student` já a serve — faltava só a porta na barra do admin.
      // Acrescentado no FIM do bloco de propósito: nenhum item pré-existente
      // muda de posição.
      admin: [
        { section: "Conteúdo" },
        { label: "Principal", href: "/admin", icon: "LayoutDashboard" },
        { label: "Cursos e Trilhas", href: "/courses", icon: "GraduationCap" },
        { label: "Trilhas de Aprendizagem", href: "/trails", icon: "Route" },
        { label: "Materiais", href: "/materiais", icon: "SquareStack" },
      ],
      // 4º MUNDO — SUPER ADMIN (rodada 9). Esta chave deixou de ser "os extras
      // do dono DENTRO do mundo admin" e passou a ser a nav do MUNDO PRÓPRIO
      // dele: `navKeysForContext` só a emite quando `workspace === "super"`.
      // Por isso "Painel" aponta para `/super-admin` (a home do 4º mundo, o
      // painel GLOBAL de todas as empresas) e não mais para `/admin` (que é a
      // home do mundo de Administração DA empresa ativa). "Empresas" continua na
      // chave `super_admin` do módulo `admin`, logo abaixo desta na ordem de
      // MODULE_IDS, então a barra do 4º mundo sai "Painel, Empresas".
      super_admin: [{ label: "Painel", href: "/super-admin", icon: "LayoutDashboard" }],
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
      // No `{ section }` header here: `academy.manager` already opens the
      // "Gestão do Time" section (with "Principal"), and modules render in
      // MODULE_IDS order (academy before admin), so these items flow into that
      // same section. Adding a second header would duplicate the label.
      manager: [
        { label: "Perfis da Equipe", href: "/team/profiles", icon: "Users" },
        // E10: o gestor abre Ações de Engajamento v2 (/engagement). A tela
        // admin antiga (/admin/notifications) permanece intocada para o papel
        // admin (chave `admin` abaixo) e instructor (módulo academy).
        { label: "Ações de Engajamento", href: "/engagement", icon: "Sparkles" },
        { label: "Analytics", href: "/analytics", icon: "BarChart3" },
      ],
      // "OPERAÇÃO FICA NA BARRA, AJUSTE VAI PARA O HUB" (decisão do dono,
      // rodada 7). As ÚNICAS 4 saídas AUTORIZADAS desta barra viraram seções
      // vivas do hub:
      //   - "Grupos de Gestor"  -> /admin/configuracoes/grupos
      //   - "Autenticação"      -> /admin/configuracoes/seguranca ("Segurança & Sessão")
      //   - "Auditoria"         -> /admin/configuracoes/auditoria
      //   - "Plano & Cobrança"  -> /admin/configuracoes/plano
      // As 4 rotas ANTIGAS seguem VIVAS e sem redirect (elas liberam papéis que
      // o hub, admin-tier, não libera: `/admin/manager-groups` abre para
      // `manager`).
      //
      // RODADA 9 — A RÉGUA CORRETA, DECIDIDA PELO DONO DEPOIS DE VER A TELA:
      // "a barra do mundo admin contém APENAS OPERAÇÃO, e todo AJUSTE vive no
      // hub". A rodada 8 usou `HEAD` como régua ("estava no HEAD, volta") e por
      // isso RESTAUROU "Cargos", "Usuários" e "Unidades" — que são seções do hub
      // desde o início desta frente. O resultado foi a duplicação que a frente
      // existe para eliminar: os mesmos três destinos na barra E no hub.
      //
      // Os três saem daqui em definitivo. As rotas antigas (`/admin/job-roles`,
      // `/admin/users`, `/admin/areas`) continuam VIVAS e sem redirect — elas
      // liberam `manager`/`instructor`, papéis que o hub (admin-tier) não
      // libera. O que sai é a PORTA na barra, não a tela.
      //
      // Sobram os DOIS itens de operação/porta que o dono manteve. Eles ficam na
      // MESMA seção ("Administração"): a seção "Sistema", que existia só para
      // carregar "Configurações", virou um cabeçalho para um item só — exatamente
      // o defeito D7 que a rede da `admin-sidebar` tapa e que o registry não pode
      // produzir de propósito.
      // ADM-1/2/3 — "Visão Geral" (`/admin/visao-geral`) entra AQUI, na barra, e
      // não no hub: pela régua da rodada 9, uma tela de LEITURA executiva é
      // operação, e só AJUSTE vive no hub. Ela abre a seção porque é a primeira
      // parada natural de quem entra no mundo admin (ler antes de agir).
      //
      // O rótulo é "Visão Geral" e não "Analytics" de propósito: `/analytics`
      // já existe na chave `manager` acima com escopo de gestor/turma. Dois
      // itens homônimos com escopos diferentes na mesma casa é exatamente o
      // defeito que a separação de mundos existe para evitar.
      admin: [
        { section: "Administração" },
        { label: "Visão Geral", href: "/admin/visao-geral", icon: "BarChart3" },
        { label: "Engajamento", href: "/admin/notifications", icon: "Sparkles" },
        { label: "Configurações", href: "/admin/configuracoes", icon: "Settings" },
      ],
      // 4º MUNDO — SUPER ADMIN (rodada 9). Esta chave NÃO é mais emitida dentro
      // do mundo admin: `navKeysForContext` a devolve apenas para
      // `workspace === "super"`. "Empresas" é operação ENTRE empresas, então ela
      // pertence ao mundo do super admin, não à administração DE uma empresa.
      //
      // "Integrações" saiu daqui (T2, decisão do dono): o bloco inteiro
      // (Integrações, API Keys, Webhooks) vai ser retrabalhado, então ele fica
      // CINZA no hub e sem porta em barra nenhuma. A rota `/admin/integrations`
      // continua viva e acessível por URL — perda de atalho aceita.
      super_admin: [{ label: "Empresas", href: "/admin/tenants", icon: "Building2" }],
    },
    // org-tree (E10): admin org-tree / explicit-reach view. Default OFF; opt-in
    // per tenant via feature flag. Exposure only — RLS is the authorization gate.
    capabilities: { "org-tree": false },
    // `/super-admin` (rodada 9): o prefixo que a rodada anterior removeu por ser
    // MORTO agora é a home REAL do 4º mundo (o painel global de todas as
    // empresas). Ele entra aqui porque `isRouteAllowed` (module-provider) é o
    // único consumidor de `routes` e a rota tem de ser reconhecida pelo módulo
    // `admin`, que é `core: true` (sempre habilitado, em qualquer tenant).
    routes: ["/admin", "/team", "/super-admin"],
    apiRoutes: ["/api/admin", "/api/profile"],
  },

  assessments: {
    id: "assessments",
    name: "Avaliações",
    description: "Big Five, DISC, Enneagram, Kolb, Career Anchors, Múltiplas Inteligências",
    core: false,
    nav: {
      // Avaliações (Big Five, DISC, ...) is a LEARNER self-assessment surface,
      // reached via the `personal` context. Not on `manager` — the team workspace
      // stays pure management (WP5). `admin` keeps it as a tenant-admin surface.
      student: [{ label: "Avaliações", href: "/assessments", icon: "ClipboardCheck" }],
      leader: [{ label: "Avaliações", href: "/assessments", icon: "ClipboardCheck" }],
      // Abre a seção "Ferramentas" no mundo admin (aresta 5 de
      // `workspace-admin.md`). `buildNavigation` concatena os módulos na ordem
      // de MODULE_IDS e um item sem `{ section }` cai visualmente DENTRO da
      // seção aberta pelo módulo anterior: "Avaliações" e "Course Designer"
      // apareciam sob "Administração" (a seção de `admin.nav.admin`), que é
      // onde moram Engajamento e a porta do hub. Um cabeçalho aqui é o corte
      // mínimo — o módulo `course-designer` vem depois na ordem e flui para
      // dentro desta mesma seção, sem precisar declarar a sua.
      admin: [
        { section: "Ferramentas" },
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
      // Biblioteca is a LEARNER surface: it belongs to the student nav, reached
      // via the `personal` ("Minha Trilha") context. It is intentionally NOT on
      // the `manager` key — the team workspace stays pure management (WP5).
      student: [{ label: "Biblioteca", href: "/biblioteca", icon: "Library" }],
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
      // Comunidade is a LEARNER surface: student nav only, reached via `personal`.
      // Not on `manager` — the team workspace stays pure management (WP5).
      student: [{ label: "Comunidade", href: "/comunidade", icon: "Sparkles" }],
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
    // `/admin/areas` is the TENANT unit/area ADMIN screen ("Administração"),
    // not a team view — so it is admin-only. A manager works with units via the
    // area selector + their team dashboards, never the tenant admin screen.
    //
    // RODADA 9 — "Unidades" sai da barra pela régua correta ("ajuste vive no
    // hub"): ele é a seção "Unidades & Áreas" de `/admin/configuracoes/unidades`.
    // A rodada 8 o havia restaurado aqui E no módulo `admin`, e era essa
    // segunda porta que a dedup por href escondia. Com as duas fora, a
    // duplicação some de verdade. A rota `/admin/areas` continua VIVA (o
    // `routes` abaixo é intocado): ela libera `manager`, papel que o hub não
    // libera, e o `loader.ts` da tela segue exigindo o módulo `units` ligado.
    nav: {},
    routes: ["/admin/areas", "/area"],
    apiRoutes: ["/api/admin/areas"],
  },

  integrations: {
    id: "integrations",
    name: "Integrações",
    description: "API Keys, Webhooks, SSO e conexões com sistemas externos",
    core: false,
    // RODADA 9 (T2) — O BLOCO INTEIRO SAI DA BARRA E FICA CINZA NO HUB.
    // Decisão do dono: "Integrações, API Keys e Webhooks vão ser retrabalhados",
    // então o grupo AVANÇADO do hub mantém os três em cinza com "Em breve" e a
    // barra não oferece porta para nenhum deles. Tirar só "Integrações" deixaria
    // dois atalhos vivos para um bloco declarado indisponível — incoerência
    // visível na mesma tela.
    //
    // Nada foi desligado: `routes`/`apiRoutes` seguem intactos, as três telas
    // continuam existindo e acessíveis por URL direta, com os mesmos guards.
    // Perda de atalho registrada no relatório.
    nav: {},
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

/** The FOUR worlds of the workspace axis (`x-active-workspace`). Declared here
 *  so `packages/shared` stays independent of `apps/web` (which owns the cookie
 *  and the resolver); the two unions are kept structurally identical.
 *
 *  `super` (rodada 9) é o mundo do SUPER ADMIN: home no painel GLOBAL
 *  (`/super-admin`) e "Empresas" (`/admin/tenants`) dentro. Ele existe porque o
 *  desenho anterior punha a administração GLOBAL dentro do mundo de
 *  APRENDIZAGEM (o super_admin entrava por "Plataforma de Aprendizagem" e caía
 *  no painel de todas as empresas), o que é exatamente a fronteira que a
 *  doutrina de workspaces proíbe. */
export type NavWorkspace = "standard" | "studio" | "admin" | "super"

/** Navigation inputs: the union of hats the person holds + the active context. */
export interface NavContext {
  roles: Role[]
  context: NavContextShape
  /**
   * Workspace ATIVO (eixo de 3 mundos). OPCIONAL de propósito: quando ausente,
   * `navKeysForContext` cai no comportamento LEGADO (pré-3º workspace), então
   * nenhum consumidor antigo precisa mudar de uma vez.
   */
  workspace?: NavWorkspace
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
  // Workspace-separation axis (WP5): the role-lens is retired. The nav view-role
  // comes solely from the active context + hat precedence.
  const viewRole = navRoleForContext(navCtx)

  // MUNDO DO ADMIN (W1/W3): a administração pertence a ele, e ele é o SUPERSET
  // (conteúdo + administração + sistema + integrações). A chave vem do CHAPÉU
  // real, fail-closed: sem chapéu admin-tier a nav é vazia (o shell admin nem
  // deveria ter sido resolvido — `resolvePlatformShell` já barra antes).
  //
  // MUNDO DO SUPER ADMIN (4º mundo, rodada 9). Fail-closed pelo CHAPÉU real:
  // só o `super_admin` alcança, qualquer outro recebe nav vazia (o shell nem
  // deveria ter sido resolvido — `resolvePlatformShell` já barra antes).
  // A chave é a DELE e só a dele: este mundo é o painel global + Empresas, não
  // um superset da administração de uma empresa.
  if (navCtx.workspace === "super") {
    return navCtx.roles.includes("super_admin") ? ["super_admin"] : []
  }

  // MUNDO DO ADMIN (W1/W3): a administração DA EMPRESA ATIVA pertence a ele.
  // A chave vem do CHAPÉU real, fail-closed: sem chapéu admin-tier a nav é
  // vazia.
  //
  // RODADA 9 — ele devolve `["admin"]` também para o `super_admin`, e não mais
  // `["admin", "super_admin"]`. Motivo: os itens exclusivos do super_admin
  // (hoje "Empresas") MUDARAM DE MUNDO, foram para o 4º. Emitir a chave dele
  // aqui traria "Empresas" de volta para a barra da administração de uma
  // empresa — a mistura que o 4º mundo existe para desfazer. O hub de
  // Configurações continua na chave `admin`, então o furo da rodada 5 (o dono
  // sem a porta do hub) permanece fechado: ele recebe a nav do admin comum,
  // inteira.
  if (navCtx.workspace === "admin") {
    if (navCtx.roles.includes("super_admin") || navCtx.roles.includes("admin")) return ["admin"]
    return []
  }

  // MUNDO PADRÃO: nunca emite chave admin-tier — um mundo não contém o outro.
  // O admin no Padrão vê o produto como o cliente vê: gestor se tiver o chapéu
  // de gestor, senão aluno.
  if (navCtx.workspace === "standard" && ADMIN_NAV_KEYS.has(viewRole)) {
    return navCtx.roles.includes("manager") ? ["manager"] : ["student"]
  }

  // STANDARD-WORLD GATE (WP5): separation is now by WORKSPACE. The instructor
  // lives in the Estúdio, which renders its OWN hardcoded nav (studio-sidebar),
  // never this registry. So the standard-world registry must NEVER emit the
  // `instructor` nav key. `navRoleForContext` already tends to avoid it (a pure
  // instructor only reaches the `personal` context => student; an instructor
  // with reach also holds `manager`, which wins by precedence), but this makes
  // it a structural guarantee instead of an incidental one: an instructor with
  // no higher management hat falls back to the student nav here.
  if (viewRole === "instructor") return ["student"]
  // Non-admin view roles (student/leader/manager) render as-is.
  if (!ADMIN_NAV_KEYS.has(viewRole)) return [viewRole]
  // Admin-tier view role: only honour it if the hat is genuinely held.
  return navCtx.roles.includes(viewRole) ? [viewRole] : ["manager"]
}

/**
 * Build navigation entries from enabled modules for a given nav context.
 *
 * E8: signature changed from `(enabledIds, role: Role)` to `(enabledIds, navCtx:
 * NavContext)` — nav is now driven by hats + active context, never by a single
 * `profile.role`. The nav keys are chosen by `navKeysForContext`, which gates
 * admin-tier keys behind the union of hats so a manager never sees admin items.
 *
 * DEDUPLICAÇÃO POR HREF (rodada 5). `navKeysForContext` pode devolver MAIS DE
 * UMA chave (o mundo admin devolve `["admin", "super_admin"]` para o dono do
 * produto), e duas chaves podem servir o mesmo destino (`/admin` e
 * `/admin/audit` aparecem nas duas). Sem dedup, o item renderizaria duas vezes
 * — e a sidebar usa `key={item.href}`, o que ainda produziria chave duplicada
 * de React. A regra é: **a PRIMEIRA ocorrência de cada href vence**, então a
 * ORDEM e os cabeçalhos de seção da primeira chave (`admin`) ficam preservados
 * e a segunda chave só acrescenta o que é exclusivo dela.
 *
 * Cabeçalhos de seção (`{ section }`) NÃO são deduplicados: eles não têm href e
 * marcam posição, não destino. Uma seção que ficasse sem itens é descartada na
 * renderização (a sidebar só empurra grupo com `items.length > 0`).
 *
 * Para uma chave única (todo o resto do sistema) o resultado é BYTE-IDÊNTICO ao
 * de antes: nenhuma chave de nav tem href repetido dentro de si.
 */
export function buildNavigation(enabledIds: ModuleId[], navCtx: NavContext): ModuleNavEntry[] {
  const modules = getEnabledModules(enabledIds)
  const navKeys = navKeysForContext(navCtx)
  const entries: ModuleNavEntry[] = []
  const seenHrefs = new Set<string>()

  for (const mod of modules) {
    for (const key of navKeys) {
      const roleNav = mod.nav[key]
      if (!roleNav) continue
      for (const entry of roleNav) {
        if ("href" in entry) {
          if (seenHrefs.has(entry.href)) continue
          seenHrefs.add(entry.href)
        }
        entries.push(entry)
      }
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
