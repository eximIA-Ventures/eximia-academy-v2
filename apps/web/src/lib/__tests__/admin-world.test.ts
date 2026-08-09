import {
  ADMIN_ROUTE_ROLES,
  canOpenAdminRoute,
  isAdminTierActor,
  isPlainManager,
} from "@/lib/admin-route-access"
import {
  ADMIN_WORLD_PATHS,
  INSTRUCTOR_BLOCKED_PATHS,
  adminWorldDeniedRedirect,
  isAdminTier,
  isAdminWorldPath,
  isBlockedForInstructor,
  isInstructorOnly,
  isSuperWorldPath,
  shouldEnterAdminWorld,
  shouldEnterSuperWorld,
} from "@/lib/admin-world"
import { describe, expect, it } from "vitest"

// =============================================================================
// Não existe harness de middleware neste repo. As decisões que o middleware
// toma sobre o mundo do admin foram extraídas para funções PURAS (admin-world.ts)
// e é elas que este arquivo certifica. O que fica SEM cobertura automatizada: o
// encanamento do middleware em si (ler o cookie `x-active-workspace`, escrever a
// resposta, emitir o redirect) — verificação manual.
// =============================================================================

describe("isAdminTier — chapéu admin pela união de chapéus reais", () => {
  it("admin e super_admin são admin-tier", () => {
    expect(isAdminTier(["admin"])).toBe(true)
    expect(isAdminTier(["super_admin"])).toBe(true)
    expect(isAdminTier(["instructor", "admin"])).toBe(true)
  })

  it("gestor, instrutor e aluno não são", () => {
    expect(isAdminTier(["manager"])).toBe(false)
    expect(isAdminTier(["instructor"])).toBe(false)
    expect(isAdminTier(["student", "leader"])).toBe(false)
    expect(isAdminTier([])).toBe(false)
  })
})

describe("isAdminWorldPath — allowlist, NUNCA startsWith('/admin')", () => {
  it("a home do mundo e as rotas da allowlist pertencem ao mundo admin", () => {
    expect(isAdminWorldPath("/admin")).toBe(true)
    for (const p of ADMIN_WORLD_PATHS) {
      expect(isAdminWorldPath(p)).toBe(true)
      expect(isAdminWorldPath(`${p}/qualquer-sub-rota`)).toBe(true)
    }
  })

  it("rotas COMPARTILHADAS com instrutor/gestor ficam de fora (é o ponto)", () => {
    // Conservadorismo deliberado: estas quatro não são EXCLUSIVAS do mundo admin
    // (`/admin/areas` abre p/ manager, `/admin/job-roles` p/ manager e
    // instructor), e `shouldEnterAdminWorld` flipa o cookie de mundo no mesmo
    // request. Ver a justificativa completa, e a correção da justificativa FALSA
    // que vivia aqui, em `admin-world.ts` (bloco de `ADMIN_WORLD_PATHS`).
    expect(isAdminWorldPath("/admin/notifications")).toBe(false)
    expect(isAdminWorldPath("/admin/areas")).toBe(false)
    expect(isAdminWorldPath("/admin/job-roles")).toBe(false)
    expect(isAdminWorldPath("/admin/users")).toBe(false)
  })

  it("não casa por prefixo solto de string", () => {
    // `/admin/settings` está na allowlist; `/admin/settings-legacy` não deve
    // entrar de carona por `startsWith` cru.
    expect(isAdminWorldPath("/admin/settings-legacy")).toBe(false)
    expect(isAdminWorldPath("/administracao")).toBe(false)
  })
})

describe("shouldEnterAdminWorld — as TRÊS travas do deep-link", () => {
  it("chapéu admin + rota do mundo => entra", () => {
    expect(shouldEnterAdminWorld("/admin", ["admin"])).toBe(true)
    expect(shouldEnterAdminWorld("/admin/configuracoes", ["super_admin"])).toBe(true)
  })

  it("rota do mundo SEM chapéu admin => não entra", () => {
    expect(shouldEnterAdminWorld("/admin/configuracoes", ["instructor"])).toBe(false)
    expect(shouldEnterAdminWorld("/admin", ["manager"])).toBe(false)
  })

  it("chapéu admin em rota COMPARTILHADA => não entra (fronteira de mundo)", () => {
    // Deep-link direto para uma rota fora da allowlist não flipa o mundo, mesmo
    // com o chapéu certo. (Não existe hoje link do Estúdio para `/admin/*` — ver
    // a correção da justificativa em `admin-world.ts`.)
    expect(shouldEnterAdminWorld("/admin/notifications", ["admin", "instructor"])).toBe(false)
    expect(shouldEnterAdminWorld("/admin/users", ["admin"])).toBe(false)
  })

  // ===========================================================================
  // TERCEIRA TRAVA (auditoria, rodada 4) — a allowlist não pode prometer um
  // mundo por uma rota que o guard de página rebate.
  // ===========================================================================

  it("/admin/tenants não joga NINGUÉM no mundo admin — ela mudou de mundo (rodada 9)", () => {
    // Era a contradição original: `/admin/tenants` estava na allowlist do mundo
    // admin, mas a página é `super_admin` SOZINHO. O admin comum era prometido
    // ao mundo por uma rota que ele não abre, e terminava no Padrão.
    // A rodada 9 corrigiu na raiz: "Empresas" é operação ENTRE empresas, então
    // ela pertence ao 4º mundo. Nenhum chapéu entra no mundo ADMIN por ela.
    expect(shouldEnterAdminWorld("/admin/tenants", ["admin"])).toBe(false)
    expect(shouldEnterAdminWorld("/admin/tenants", ["admin", "instructor"])).toBe(false)
    expect(shouldEnterAdminWorld("/admin/tenants/algum-id", ["admin"])).toBe(false)
    expect(shouldEnterAdminWorld("/admin/tenants", ["super_admin"])).toBe(false)
  })

  it("super_admin em /admin/tenants entra no 4º MUNDO (nada se perde, muda de porta)", () => {
    expect(shouldEnterSuperWorld("/admin/tenants", ["super_admin"])).toBe(true)
    expect(shouldEnterSuperWorld("/admin/tenants/algum-id", ["super_admin"])).toBe(true)
    expect(shouldEnterSuperWorld("/super-admin", ["super_admin"])).toBe(true)
  })

  it("o 4º mundo é fail-closed: sem o chapéu `super_admin`, ninguém entra", () => {
    expect(shouldEnterSuperWorld("/super-admin", ["admin"])).toBe(false)
    expect(shouldEnterSuperWorld("/admin/tenants", ["admin"])).toBe(false)
    expect(shouldEnterSuperWorld("/super-admin", ["manager", "instructor"])).toBe(false)
    expect(shouldEnterSuperWorld("/super-admin", [])).toBe(false)
  })

  it("o 4º mundo é allowlist, nunca `startsWith('/admin')` nem prefixo solto", () => {
    expect(isSuperWorldPath("/super-admin")).toBe(true)
    expect(isSuperWorldPath("/admin/tenants")).toBe(true)
    expect(isSuperWorldPath("/admin/tenants/abc")).toBe(true)
    expect(isSuperWorldPath("/admin")).toBe(false)
    expect(isSuperWorldPath("/admin/configuracoes")).toBe(false)
    expect(isSuperWorldPath("/super-admin-legacy")).toBe(false)
  })

  it("INVARIANTE: toda rota da allowlist que flipa o mundo é uma rota que a pessoa abre", () => {
    // Esta é a afirmação que o comentário de `ADMIN_WORLD_PATHS` fazia e o
    // código não sustentava. Agora ela é verificada em cima do inventário REAL,
    // então somar uma rota super_admin-only à allowlist no futuro não recria o
    // furo em silêncio.
    for (const hats of [["admin"], ["super_admin"], ["admin", "instructor"]]) {
      for (const p of ADMIN_WORLD_PATHS) {
        if (!shouldEnterAdminWorld(p, hats)) continue
        const route = (
          Object.keys(ADMIN_ROUTE_ROLES) as Array<keyof typeof ADMIN_ROUTE_ROLES>
        ).find((r) => p === r || p.startsWith(`${r}/`))
        // Ou a rota não tem guard próprio de página (o guard dela é admin-tier,
        // já satisfeito), ou o guard dela admite estes chapéus.
        if (route) expect(canOpenAdminRoute(route, hats)).toBe(true)
      }
    }
  })

  it("/admin/configuracoes não tem entrada em ADMIN_ROUTE_ROLES — o guard dele é admin-tier", () => {
    // A trava nova não pode fechar o hub por ausência de tabela (fail-closed no
    // lugar errado seria perder o 3º workspace inteiro).
    expect(Object.keys(ADMIN_ROUTE_ROLES)).not.toContain("/admin/configuracoes")
    expect(shouldEnterAdminWorld("/admin/configuracoes", ["admin"])).toBe(true)
    expect(shouldEnterAdminWorld("/admin/configuracoes/cargos", ["admin"])).toBe(true)
    expect(shouldEnterAdminWorld("/admin", ["admin"])).toBe(true)
  })
})

// =============================================================================
// CORREÇÃO DE AUDITORIA — os dois eixos de autorização
//
// Antes: o guard do hub usava CHAPÉUS (`effectiveHats`) e o bloqueio do
// instrutor usava a coluna SINGULAR `users.role`, cacheada 5 min. Um usuário com
// chapéu `admin` e `users.role = "instructor"` PASSAVA no hub e era EXPULSO do
// resto de /admin no MESMO request. Agora os dois eixos são um só: chapéus.
// =============================================================================

describe("isInstructorOnly — instrutor PURO por chapéu (regra dura 3)", () => {
  it("instrutor sem nenhum chapéu de gestão é instrutor puro", () => {
    expect(isInstructorOnly(["instructor"])).toBe(true)
    expect(isInstructorOnly(["instructor", "student"])).toBe(true)
  })

  it("admin/super_admin NUNCA é instrutor puro (mata a armadilha do eixo duplo)", () => {
    expect(isInstructorOnly(["instructor", "admin"])).toBe(false)
    expect(isInstructorOnly(["instructor", "super_admin"])).toBe(false)
  })

  it("manager entra na exclusão — sem isso, instructor+manager seria REGRESSÃO", () => {
    // Hoje um instructor+manager tem `users.role = "manager"` por precedência e
    // portanto NÃO é bloqueado. O eixo novo precisa preservar isso.
    expect(isInstructorOnly(["instructor", "manager"])).toBe(false)
  })

  it("quem não tem chapéu de instrutor nunca é instrutor puro", () => {
    expect(isInstructorOnly(["manager"])).toBe(false)
    expect(isInstructorOnly(["student"])).toBe(false)
    expect(isInstructorOnly([])).toBe(false)
  })
})

describe("isBlockedForInstructor — a tabela de eixo duplo do plano (§i)", () => {
  it("chapéu admin + users.role='instructor' abrindo /admin/settings => ENTRA (chapéu manda)", () => {
    // Era exatamente o bug: passava no hub e era expulso daqui, no mesmo request.
    expect(isBlockedForInstructor("/admin/settings", ["admin", "instructor"])).toBe(false)
  })

  it("chapéu instructor PURO abrindo /admin/settings => expulso (inalterado)", () => {
    expect(isBlockedForInstructor("/admin/settings", ["instructor"])).toBe(true)
  })

  it("chapéu instructor + manager abrindo /admin/settings => não bloqueado (inalterado)", () => {
    expect(isBlockedForInstructor("/admin/settings", ["instructor", "manager"])).toBe(false)
  })

  it("o inventário de rotas bloqueadas é o MESMO de HEAD: as 4, sem /admin/audit", () => {
    // FURO 3 da rodada 2: a lista tinha crescido para 5 (somou `/admin/audit`)
    // enquanto o comentário jurava "nada adicionado". Voltou às 4 de
    // `git show HEAD:apps/web/src/middleware.ts`.
    expect([...INSTRUCTOR_BLOCKED_PATHS]).toEqual([
      "/admin/users",
      "/admin/settings",
      "/admin/api-keys",
      "/admin/webhooks",
    ])
    for (const p of INSTRUCTOR_BLOCKED_PATHS) {
      expect(isBlockedForInstructor(p, ["instructor"])).toBe(true)
    }
  })

  it("/admin/audit NÃO está no bloqueio do middleware — quem barra é o guard de página", () => {
    // O inventário do middleware é o de HEAD (4 rotas, `/admin/audit` nunca
    // esteve lá — a rota nem existia). Quem recusa o instrutor na auditoria é o
    // guard da própria página, admin-tier.
    expect(isBlockedForInstructor("/admin/audit", ["instructor"])).toBe(false)
    expect(canOpenAdminRoute("/admin/audit", ["instructor"])).toBe(false)
    expect(canOpenAdminRoute("/admin/audit", ["admin"])).toBe(true)
  })

  it("rota fora do inventário nunca é bloqueada, nem para o instrutor puro", () => {
    expect(isBlockedForInstructor("/admin/notifications", ["instructor"])).toBe(false)
    expect(isBlockedForInstructor("/instructor", ["instructor"])).toBe(false)
  })
})

// =============================================================================
// FURO 1 — os guards de PÁGINA, agora no mesmo eixo do middleware.
//
// Cada conjunto abaixo é o conjunto que a página tinha ANTES, transcrito 1:1.
// Este bloco existe para que "não estreitei nem alarguei ninguém" (W4) seja
// verificável, e não uma promessa em prosa.
// =============================================================================

describe("canOpenAdminRoute — conjunto por rota PRESERVADO (W4)", () => {
  it("rotas admin-tier: admin e super_admin entram, mais ninguém", () => {
    for (const route of [
      "/admin/audit",
      "/admin/settings",
      "/admin/users",
      "/admin/api-keys",
      "/admin/webhooks",
      "/admin/plans",
      "/admin/integrations",
      "/admin/biblioteca",
    ] as const) {
      expect(canOpenAdminRoute(route, ["admin"])).toBe(true)
      expect(canOpenAdminRoute(route, ["super_admin"])).toBe(true)
      expect(canOpenAdminRoute(route, ["manager"])).toBe(false)
      expect(canOpenAdminRoute(route, ["instructor"])).toBe(false)
      expect(canOpenAdminRoute(route, ["student"])).toBe(false)
    }
  })

  it("/admin/areas e /admin/manager-groups NÃO perdem o gestor", () => {
    for (const route of ["/admin/areas", "/admin/manager-groups"] as const) {
      expect(canOpenAdminRoute(route, ["manager"])).toBe(true)
      expect(canOpenAdminRoute(route, ["admin"])).toBe(true)
      expect(canOpenAdminRoute(route, ["super_admin"])).toBe(true)
      expect(canOpenAdminRoute(route, ["instructor"])).toBe(false)
      expect(canOpenAdminRoute(route, ["student"])).toBe(false)
    }
  })

  it("/admin/job-roles NÃO perde gestor NEM instrutor", () => {
    expect(canOpenAdminRoute("/admin/job-roles", ["manager"])).toBe(true)
    expect(canOpenAdminRoute("/admin/job-roles", ["instructor"])).toBe(true)
    expect(canOpenAdminRoute("/admin/job-roles", ["admin"])).toBe(true)
    expect(canOpenAdminRoute("/admin/job-roles", ["super_admin"])).toBe(true)
    expect(canOpenAdminRoute("/admin/job-roles", ["student"])).toBe(false)
  })

  it("/admin/tenants continua exclusiva do super_admin", () => {
    expect(canOpenAdminRoute("/admin/tenants", ["super_admin"])).toBe(true)
    expect(canOpenAdminRoute("/admin/tenants", ["admin"])).toBe(false)
    expect(canOpenAdminRoute("/admin/tenants", ["manager"])).toBe(false)
  })

  it("toda rota do inventário nega o conjunto vazio de chapéus (fail-closed)", () => {
    for (const route of Object.keys(ADMIN_ROUTE_ROLES) as Array<keyof typeof ADMIN_ROUTE_ROLES>) {
      expect(canOpenAdminRoute(route, [])).toBe(false)
    }
  })
})

describe("isAdminTierActor / isPlainManager — capacidades DENTRO da página", () => {
  it("admin-tier substitui `profile.role === 'admin' || 'super_admin'`", () => {
    expect(isAdminTierActor(["admin"])).toBe(true)
    expect(isAdminTierActor(["super_admin"])).toBe(true)
    expect(isAdminTierActor(["admin", "manager"])).toBe(true)
    expect(isAdminTierActor(["manager"])).toBe(false)
  })

  it("gestor comum respeita a precedência que a coluna singular expressava", () => {
    // `users.role` de um admin+manager é "admin", então ele NUNCA caía na trava
    // de dono de grupo. O chapéu precisa preservar isso.
    expect(isPlainManager(["manager"])).toBe(true)
    expect(isPlainManager(["admin", "manager"])).toBe(false)
    expect(isPlainManager(["super_admin", "manager"])).toBe(false)
    expect(isPlainManager(["instructor"])).toBe(false)
  })
})

// =============================================================================
// EJEÇÃO RESIDUAL (rodada 5) — recusar a ROTA não pode custar o MUNDO
// =============================================================================
//
// `pageGuardAdmits` (rodada 4) cobre a ENTRADA no mundo. A PERMANÊNCIA ficou
// descoberta: um `admin` comum já dentro do mundo que pedisse `/admin/tenants`
// era rebatido pela página para `/dashboard`, e `/dashboard` reescreve o cookie
// `x-active-workspace` para `standard` — expulsão por rota recusada.
// =============================================================================

describe("adminWorldDeniedRedirect — a recusa devolve à home do mundo", () => {
  it("admin-tier recusado volta para /admin, não para /dashboard", () => {
    expect(adminWorldDeniedRedirect(["admin"])).toBe("/admin")
    expect(adminWorldDeniedRedirect(["admin", "instructor"])).toBe("/admin")
    expect(adminWorldDeniedRedirect(["super_admin"])).toBe("/admin")
  })

  it("quem NÃO é admin-tier continua indo para /dashboard (byte-idêntico, W4)", () => {
    expect(adminWorldDeniedRedirect(["manager"])).toBe("/dashboard")
    expect(adminWorldDeniedRedirect(["instructor"])).toBe("/dashboard")
    expect(adminWorldDeniedRedirect(["student"])).toBe("/dashboard")
    expect(adminWorldDeniedRedirect([])).toBe("/dashboard")
  })

  it("o caso concreto: admin comum pedindo /admin/tenants é recusado SEM perder o mundo", () => {
    const hats = ["admin"]
    // a rota realmente o recusa...
    expect(canOpenAdminRoute("/admin/tenants", hats)).toBe(false)
    // ...e a recusa o devolve à home do mundo admin, não ao mundo Padrão.
    expect(adminWorldDeniedRedirect(hats)).toBe("/admin")
    // o super_admin segue entrando normalmente
    expect(canOpenAdminRoute("/admin/tenants", ["super_admin"])).toBe(true)
  })
})

describe("canário — quais rotas do mundo admin conseguem recusar um admin-tier", () => {
  /** Rotas do mundo (allowlist) que TÊM entrada em `ADMIN_ROUTE_ROLES`. */
  const worldRoutesWithGuard = ADMIN_WORLD_PATHS.filter(
    (p): p is (typeof ADMIN_WORLD_PATHS)[number] & keyof typeof ADMIN_ROUTE_ROLES =>
      p in ADMIN_ROUTE_ROLES,
  )

  it("NENHUMA rota do mundo admin recusa admin-tier (rodada 9) — a única que recusava mudou de mundo", () => {
    // Era `["/admin/tenants"]`. Com "Empresas" no 4º mundo, o conjunto do mundo
    // admin e o conjunto dos guards das páginas dele voltaram a coincidir: o
    // desencaixe que exigiu a terceira trava (rodada 4) e o redirect de
    // permanência (rodada 5) deixou de existir. As duas redes ficam de pé como
    // canário — se alguém estreitar OUTRA rota do mundo, este teste fica
    // vermelho e cobra o mesmo tratamento lá.
    const refusesAdmin = worldRoutesWithGuard.filter(
      (route) => !canOpenAdminRoute(route, ["admin"]) || !canOpenAdminRoute(route, ["super_admin"]),
    )
    expect(refusesAdmin).toEqual([])
  })

  it("todas as rotas do mundo admitem os DOIS chapéus admin-tier", () => {
    for (const route of worldRoutesWithGuard) {
      expect(canOpenAdminRoute(route, ["admin"])).toBe(true)
      expect(canOpenAdminRoute(route, ["super_admin"])).toBe(true)
    }
  })
})
