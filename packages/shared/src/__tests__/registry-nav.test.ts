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

/** Mesmo contexto, com o EIXO DE WORKSPACE declarado (3º workspace). */
const wctx = (
  roles: Role[],
  context: NavContext["context"],
  workspace: NonNullable<NavContext["workspace"]>,
): NavContext => ({ roles, context, workspace })

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

  it("shows exactly the manager set: Principal, Perfis da Equipe, Ações de Engajamento, Analytics", () => {
    expect(labels(nav)).toEqual([
      "Principal",
      "Perfis da Equipe",
      "Ações de Engajamento",
      "Analytics",
    ])
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
    expect(labels(nav)).toEqual([
      "Principal",
      "Perfis da Equipe",
      "Ações de Engajamento",
      "Analytics",
    ])
    const orgHrefs = hrefs(nav)
    for (const learner of LEARNER_HREFS) {
      expect(orgHrefs).not.toContain(learner)
    }
  })
})

describe("buildNavigation — admin keys are untouched (regression guard)", () => {
  const nav = buildNavigation(ALL_MODULES, ctx(["admin", "student"], organization))

  it("admin in organization still gets the Administração section, never the manager one", () => {
    const s = sections(nav)
    expect(s).toContain("Administração")
    // admin still never shows the manager-only "Gestão do Time" section
    expect(s).not.toContain("Gestão do Time")
  })

  /**
   * Hub de Configurações. A porta do hub é `/admin/configuracoes` e ela vive na
   * barra — é ela que serve as seções migradas.
   *
   * RODADA 9 — A RÉGUA CORRETA. A rodada 8 usou `HEAD` como régua ("estava lá,
   * volta") e RESTAUROU "Cargos", "Usuários" e "Unidades" na barra. Errado: os
   * três são SEÇÕES DO HUB desde o início desta frente, e tê-los nos dois
   * lugares É a duplicação que a frente existe para eliminar. A régua do dono é
   * outra: **na barra só OPERAÇÃO; todo AJUSTE vive no hub**. As telas antigas
   * continuam vivas (elas liberam manager/instructor, que o hub não libera) —
   * o que sai é a porta, não a tela.
   */
  it("expõe a porta do hub e NÃO duplica nela o que já é seção do hub", () => {
    const l = labels(nav)
    const h = hrefs(nav)

    expect(l).toContain("Configurações")
    expect(h).toContain("/admin/configuracoes")

    // A duplicação que a rodada 8 reintroduziu — fora da barra em definitivo.
    expect(l).not.toContain("Usuários")
    expect(l).not.toContain("Cargos")
    expect(l).not.toContain("Unidades")
    expect(h).not.toContain("/admin/users")
    expect(h).not.toContain("/admin/job-roles")
    expect(h).not.toContain("/admin/areas")
  })

  /** T2 (rodada 9) — o bloco de integrações some da barra INTEIRO e fica cinza
   *  no hub. Tirar só "Integrações" deixaria "API Keys" e "Webhooks" como
   *  atalhos vivos para um bloco declarado indisponível. */
  it("o bloco de integrações não tem porta na barra (fica cinza no hub)", () => {
    const l = labels(nav)
    const h = hrefs(nav)
    expect(l).not.toContain("Integrações")
    expect(l).not.toContain("API Keys")
    expect(l).not.toContain("Webhooks")
    expect(h).not.toContain("/admin/integrations")
    expect(h).not.toContain("/admin/api-keys")
    expect(h).not.toContain("/admin/webhooks")
  })

  /**
   * FASE 2 (rodada 7) — "operação fica na barra, ajuste vai para o hub".
   * As 4 capacidades abaixo DEIXARAM a barra e viraram seções VIVAS do hub.
   * A prova de que nada ficou órfão é o inverso do teste anterior: elas somem
   * da nav E a porta do hub (que as serve) continua lá.
   */
  it("as 4 capacidades migradas somem da barra — quem as serve é o hub", () => {
    const h = hrefs(nav)
    const l = labels(nav)

    expect(h).not.toContain("/admin/manager-groups")
    expect(h).not.toContain("/admin/settings?tab=auth")
    expect(h).not.toContain("/admin/audit")
    expect(h).not.toContain("/admin/plans")
    expect(l).not.toContain("Grupos de Gestor")
    expect(l).not.toContain("Autenticação")
    expect(l).not.toContain("Auditoria")
    expect(l).not.toContain("Plano & Cobrança")

    // A PORTA do hub nunca pode sair: é ela que serve as 4 seções migradas.
    expect(h).toContain("/admin/configuracoes")
  })

  it("a barra mantém a OPERAÇÃO que o dono listou (nada de operação foi levado junto)", () => {
    const h = hrefs(nav)
    expect(h).toContain("/admin") // Painel
    expect(h).toContain("/courses") // Cursos e Trilhas
    expect(h).toContain("/materiais") // Materiais (rodada 8)
    expect(h).toContain("/admin/biblioteca") // Gerenciar Livros
    expect(h).toContain("/analytics") // Analytics
    expect(h).toContain("/admin/notifications") // Engajamento
    expect(h).toContain("/admin/configuracoes") // Configurações (porta do hub)
  })

  /**
   * "Nenhum cabeçalho de grupo pode ficar vazio depois da mudança." A sidebar
   * só empurra grupo com `items.length > 0`, mas o invariante é do CONTEÚDO:
   * toda seção declarada precisa ter ao menos um item depois dela.
   */
  it("nenhum cabeçalho de seção fica órfão (toda seção tem ao menos 1 item)", () => {
    for (const roles of [["admin"], ["super_admin"]] as const) {
      const entries = buildNavigation(ALL_MODULES, wctx([...roles], organization, "admin"))
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i]
        if (!("section" in e)) continue
        const next = entries[i + 1]
        expect(next, `seção "${e.section}" ficou sem itens`).toBeDefined()
        expect("href" in (next as object), `seção "${e.section}" ficou sem itens`).toBe(true)
      }
    }
  })

  /**
   * D7 (rodada 8) — a seção "Administração" tinha ficado com UM item só
   * ("Engajamento") depois do enxugamento não autorizado. A raiz do defeito é
   * de CONTEÚDO (itens que sumiram), então a régua é de conteúdo: no mundo
   * admin, com todos os módulos ligados, nenhuma seção pode ter um item só.
   * (A sidebar do mundo admin ainda absorve grupo de 1 item no grupo anterior,
   * como rede para tenants enxutos — mas o registry não pode DEPENDER disso.)
   */
  it("nenhuma seção do mundo admin fica com um item só", () => {
    for (const roles of [["admin"], ["super_admin"]] as const) {
      const entries = buildNavigation(ALL_MODULES, wctx([...roles], organization, "admin"))
      const counts: { section: string; n: number }[] = []
      for (const e of entries) {
        if ("section" in e) counts.push({ section: e.section, n: 0 })
        else if (counts.length) counts[counts.length - 1].n++
      }
      for (const c of counts) {
        expect(c.n, `seção "${c.section}" (${roles[0]}) tem ${c.n} item`).toBeGreaterThan(1)
      }
    }
  })

  /** D4 (rodada 8) era a grafia do item ("Integracoes", sem cedilha nem til).
   *  Rodada 9: o item não existe mais em barra nenhuma (T2), então a régua
   *  passa a ser a AUSÊNCIA — nas duas grafias, para o caso de alguém
   *  reintroduzir a antiga. */
  it("não há item de integrações na barra, em nenhuma grafia", () => {
    const l = labels(buildNavigation(ALL_MODULES, wctx(["super_admin"], organization, "admin")))
    expect(l).not.toContain("Integrações")
    expect(l).not.toContain("Integracoes")
  })
})

// ---------------------------------------------------------------------------
// 3º WORKSPACE (mundo do admin) — o eixo `workspace` do NavContext
// ---------------------------------------------------------------------------
//
// Contrato: a administração PERTENCE ao mundo admin (W1). Um mundo nunca contém
// o outro, então o mundo Padrão deixa de emitir chave admin-tier. O campo é
// OPCIONAL: ausente => comportamento LEGADO, idêntico ao de antes.
// ---------------------------------------------------------------------------

describe("navKeysForContext — eixo de workspace (4 mundos)", () => {
  it("mundo ADMIN + chapéu admin => ['admin'] (W3: a chave inteira, superset)", () => {
    expect(navKeysForContext(wctx(["admin", "student"], organization, "admin"))).toEqual(["admin"])
    // o contexto não decide nada aqui — a chave vem do chapéu real
    expect(navKeysForContext(wctx(["admin"], personal, "admin"))).toEqual(["admin"])
  })

  /**
   * RODADA 9. Este caso já afirmou `["super_admin"]` (rodada 4, o furo da porta
   * do hub) e depois `["admin","super_admin"]` (rodada 5, o conserto). Agora é
   * `["admin"]`, e não é um retrocesso ao furo: o hub de Configurações mora na
   * chave `admin`, então o dono continua recebendo a porta dele. O que saiu foi
   * a chave `super_admin` — porque os itens dela ("Empresas") MUDARAM DE MUNDO,
   * para o 4º. Mantê-la aqui traria administração ENTRE empresas para dentro da
   * administração DE uma empresa.
   */
  it("mundo ADMIN + chapéu super_admin => ['admin'] (a chave do admin comum, inteira)", () => {
    expect(navKeysForContext(wctx(["super_admin", "admin"], organization, "admin"))).toEqual([
      "admin",
    ])
    expect(navKeysForContext(wctx(["super_admin"], organization, "admin"))).toEqual(["admin"])
  })

  it("mundo SUPER + chapéu super_admin => ['super_admin'] (a chave dele, e só ela)", () => {
    expect(navKeysForContext(wctx(["super_admin"], organization, "super"))).toEqual(["super_admin"])
    // o contexto não decide nada aqui, igual ao mundo admin
    expect(navKeysForContext(wctx(["super_admin"], personal, "super"))).toEqual(["super_admin"])
  })

  it("mundo SUPER sem o chapéu super_admin => [] (fail-closed, nem para o admin)", () => {
    expect(navKeysForContext(wctx(["admin"], organization, "super"))).toEqual([])
    expect(navKeysForContext(wctx(["admin", "instructor"], organization, "super"))).toEqual([])
    expect(navKeysForContext(wctx(["manager", "student"], organization, "super"))).toEqual([])
    expect(navKeysForContext(wctx(["student"], personal, "super"))).toEqual([])
  })

  it("mundo ADMIN sem chapéu admin-tier => [] (fail-closed, nav vazia)", () => {
    expect(navKeysForContext(wctx(["manager", "student"], organization, "admin"))).toEqual([])
    expect(navKeysForContext(wctx(["instructor"], team, "admin"))).toEqual([])
    expect(navKeysForContext(wctx(["student"], personal, "admin"))).toEqual([])
  })

  it("mundo PADRÃO + chapéu admin => nav do CLIENTE (gestor se tiver, senão aluno)", () => {
    expect(navKeysForContext(wctx(["admin", "manager"], organization, "standard"))).toEqual([
      "manager",
    ])
    expect(navKeysForContext(wctx(["admin", "student"], organization, "standard"))).toEqual([
      "student",
    ])
    expect(navKeysForContext(wctx(["super_admin"], organization, "standard"))).toEqual(["student"])
  })

  it("mundo PADRÃO não muda nada para quem não é admin-tier", () => {
    expect(navKeysForContext(wctx(["manager", "student"], team, "standard"))).toEqual(["manager"])
    expect(navKeysForContext(wctx(["student"], personal, "standard"))).toEqual(["student"])
    expect(navKeysForContext(wctx(["instructor"], team, "standard"))).toEqual(["student"])
  })

  it("workspace AUSENTE => comportamento legado, idêntico ao de antes", () => {
    expect(navKeysForContext(ctx(["admin", "student"], organization))).toEqual(["admin"])
    expect(navKeysForContext(ctx(["manager", "student"], team))).toEqual(["manager"])
    expect(navKeysForContext(ctx(["instructor"], team))).toEqual(["student"])
  })
})

describe("buildNavigation — a administração pertence ao mundo admin (W1)", () => {
  it("mundo ADMIN entrega o hub de Configurações e o bloco administrativo", () => {
    const nav = buildNavigation(ALL_MODULES, wctx(["admin", "student"], organization, "admin"))
    const h = hrefs(nav)
    const s = sections(nav)

    expect(h).toContain("/admin/configuracoes") // o hub (W1)
    expect(h).toContain("/admin/notifications") // Engajamento: OPERAÇÃO, fica
    expect(s).toContain("Administração")
    expect(s).not.toContain("Sistema")
    // W3 = SUPERSET: o conteúdo que o admin já alcançava continua no mundo dele.
    expect(h).toContain("/courses")
    expect(h).toContain("/trails")
    expect(h).toContain("/analytics")
    // W2: a home do mundo admin é o painel em /admin, não /dashboard.
    expect(h).toContain("/admin")
    expect(h).not.toContain("/dashboard")
  })

  it("mundo PADRÃO com chapéu admin NÃO contém administração (um mundo não contém o outro)", () => {
    const nav = buildNavigation(ALL_MODULES, wctx(["admin", "student"], organization, "standard"))
    const h = hrefs(nav)
    const s = sections(nav)

    expect(s).not.toContain("Administração")
    expect(s).not.toContain("Sistema")
    expect(h).not.toContain("/admin/configuracoes")
    expect(h).not.toContain("/admin/audit")
    expect(h).not.toContain("/admin/plans")
  })

  it("mundo ADMIN sem chapéu admin-tier não renderiza nav nenhuma", () => {
    expect(buildNavigation(ALL_MODULES, wctx(["manager"], organization, "admin"))).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// A BARRA DO MUNDO ADMIN, INTEIRA — a régua da rodada 9
// ---------------------------------------------------------------------------
//
// A lista COMPLETA e na ORDEM é o que distingue "a barra ficou como o dono
// pediu" de "alguém acrescentou/tirou um item solto". A régua é a lista literal
// que ele ditou: Painel, Cursos e Trilhas, Trilhas de Aprendizagem, Materiais,
// Gerenciar Livros, Analytics, Engajamento e Configurações (a porta do hub).
// Os itens extras abaixo vêm de MÓDULOS OPCIONAIS ligados neste teste
// (`assessments`, `course-designer`) — num tenant que não os liga, a barra é
// exatamente a lista do dono.
// ---------------------------------------------------------------------------

/** Nav do mundo ADMIN. Ordem = MODULE_IDS. Idêntica para `admin` e `super_admin`. */
const ADMIN_WORLD_HREFS = [
  "/admin", // Principal (Conteúdo)
  "/courses",
  "/trails",
  "/materiais",
  "/admin/biblioteca", // Gerenciar Livros
  "/analytics",
  "/admin/notifications", // Engajamento (Administração)
  "/admin/configuracoes", // Configurações — O HUB (a porta, nunca sai)
  "/assessments", // módulo opcional
  "/courses/new", // módulo opcional (course-designer)
]

/** Nav do 4º mundo (SUPER ADMIN): painel global + Empresas. */
const SUPER_WORLD_HREFS = ["/super-admin", "/admin/tenants"]

describe("buildNavigation — a barra do mundo admin (rodada 9)", () => {
  const adminNav = buildNavigation(ALL_MODULES, wctx(["admin", "student"], organization, "admin"))
  const saNav = buildNavigation(ALL_MODULES, wctx(["super_admin"], organization, "admin"))

  it("o super_admin VÊ o hub de Configurações no menu (o furo da rodada 5, fechado)", () => {
    expect(hrefs(saNav)).toContain("/admin/configuracoes")
    expect(labels(saNav)).toContain("Configurações")
  })

  it("a lista inteira, na ordem, é exatamente a régua — para o admin comum", () => {
    expect(hrefs(adminNav)).toEqual(ADMIN_WORLD_HREFS)
  })

  it("o super_admin vê EXATAMENTE a mesma barra do admin comum neste mundo", () => {
    expect(hrefs(saNav)).toEqual(ADMIN_WORLD_HREFS)
    expect(sections(saNav)).toEqual(sections(adminNav))
    // "Ferramentas" entrou (aresta 5): antes, "Avaliações" e "Course Designer"
    // — os dois módulos OPCIONAIS ligados neste teste — caíam visualmente
    // dentro de "Administração", a seção de Engajamento e da porta do hub,
    // porque nenhum dos dois abria seção própria. Este caso assertava esse
    // agrupamento errado; a régua de HREFS (ordem e conteúdo da barra) não
    // mudou uma linha, só o cabeçalho sob o qual os dois aparecem.
    expect(sections(saNav)).toEqual(["Conteúdo", "Administração", "Ferramentas"])
  })

  it("os itens do 4º mundo NÃO aparecem na barra da administração de uma empresa", () => {
    for (const nav of [adminNav, saNav]) {
      expect(hrefs(nav)).not.toContain("/admin/tenants")
      expect(hrefs(nav)).not.toContain("/super-admin")
      expect(labels(nav)).not.toContain("Empresas")
    }
  })

  it("não repete nenhum href", () => {
    for (const nav of [adminNav, saNav]) {
      const h = hrefs(nav)
      expect(new Set(h).size).toBe(h.length)
    }
  })

  it("a barra tem a lista de OPERAÇÃO que o dono ditou, e só ela mais os módulos opcionais", () => {
    const l = labels(adminNav)
    for (const item of [
      "Principal",
      "Cursos e Trilhas",
      "Trilhas de Aprendizagem",
      "Materiais",
      "Gerenciar Livros",
      "Analytics",
      "Engajamento",
      "Configurações",
    ]) {
      expect(l).toContain(item)
    }
    // e nada de AJUSTE (tudo isso é seção do hub)
    for (const fora of [
      "Cargos",
      "Usuários",
      "Unidades",
      "Grupos de Gestor",
      "Autenticação",
      "Auditoria",
      "Plano & Cobrança",
      "Integrações",
      "Empresas",
    ]) {
      expect(l).not.toContain(fora)
    }
  })
})

describe("buildNavigation — o 4º mundo (SUPER ADMIN, rodada 9)", () => {
  const superNav = buildNavigation(ALL_MODULES, wctx(["super_admin"], organization, "super"))

  it("a barra é o painel global + Empresas, na ordem, e nada mais", () => {
    expect(hrefs(superNav)).toEqual(SUPER_WORLD_HREFS)
    expect(labels(superNav)).toEqual(["Painel", "Empresas"])
  })

  it("nenhum cabeçalho de seção — dois itens não pedem cabeçalho", () => {
    expect(sections(superNav)).toEqual([])
  })

  it("não contém administração DE uma empresa (um mundo não contém o outro)", () => {
    const h = hrefs(superNav)
    expect(h).not.toContain("/admin/configuracoes")
    expect(h).not.toContain("/admin/notifications")
    expect(h).not.toContain("/admin")
    for (const learner of LEARNER_HREFS) expect(h).not.toContain(learner)
  })

  it("fail-closed: o admin de tenant não renderiza nav nenhuma no 4º mundo", () => {
    expect(buildNavigation(ALL_MODULES, wctx(["admin"], organization, "super"))).toEqual([])
  })

  it("nada muda FORA dele para o super_admin (mundo Padrão = nav de cliente)", () => {
    const std = buildNavigation(ALL_MODULES, wctx(["super_admin"], organization, "standard"))
    const h = hrefs(std)
    expect(h).not.toContain("/admin/configuracoes")
    expect(h).not.toContain("/admin/tenants")
    expect(h).not.toContain("/super-admin")
    expect(sections(std)).not.toContain("Sistema")
  })

  it("o caminho LEGADO (sem eixo de workspace) do super_admin é a chave dele", () => {
    expect(hrefs(buildNavigation(ALL_MODULES, ctx(["super_admin"], organization)))).toEqual(
      SUPER_WORLD_HREFS,
    )
  })
})
