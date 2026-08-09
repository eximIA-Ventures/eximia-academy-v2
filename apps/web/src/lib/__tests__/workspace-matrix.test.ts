import { canOpenAdminRoute } from "@/lib/admin-route-access"
import { isAdminTier, isBlockedForInstructor, shouldEnterAdminWorld } from "@/lib/admin-world"
import { needsTenantSelector } from "@/lib/multi-tenant-access"
import {
  accessibleWorkspaces,
  canEnterStudio,
  resolvePlatformShell,
  workspaceHomeRoute,
} from "@/lib/workspace-resolver"
import { type NavContext, type Role, navKeysForContext } from "@eximia/shared"
import { describe, expect, it } from "vitest"

// =============================================================================
// A MATRIZ DE PAPÉIS do 3º workspace, como TABELA EXECUTÁVEL.
//
// É o contrato que o QA audita: para cada perfil de chapéus, quantas portas
// existem no picker, onde a pessoa cai no login, qual shell cada mundo resolve e
// qual nav cada mundo emite. Roda sobre as FUNÇÕES PURAS (não simula o
// middleware, que não tem harness neste repo) — o encanamento de cookie/redirect
// fica para verificação manual.
// =============================================================================

/** O que o middleware faz depois do login (`:401-407`), como função pura. */
function postLoginDestination(hats: Role[]): string {
  const ws = accessibleWorkspaces(hats)
  return ws.length > 1 ? "/workspace" : workspaceHomeRoute(ws[0])
}

const org: NavContext["context"] = { type: "organization" }

interface Row {
  nome: string
  hats: Role[]
  portas: string[]
  login: string
  /** Shell resolvido quando o cookie do mundo admin está setado. */
  shellNoMundoAdmin: "standard" | "studio" | "admin" | "super"
  /** Shell resolvido quando o cookie do Estúdio está setado. */
  shellNoEstudio: "standard" | "studio" | "admin" | "super"
  /** Shell resolvido quando o cookie do 4º mundo está setado (rodada 9). */
  shellNoSuper: "standard" | "studio" | "admin" | "super"
}

const MATRIZ: Row[] = [
  {
    nome: "1 — student",
    hats: ["student"],
    portas: ["standard"],
    login: "/dashboard",
    shellNoMundoAdmin: "standard",
    shellNoEstudio: "standard",
    shellNoSuper: "standard",
  },
  {
    nome: "2 — manager",
    hats: ["manager"],
    portas: ["standard"],
    login: "/dashboard",
    shellNoMundoAdmin: "standard",
    shellNoEstudio: "standard",
    shellNoSuper: "standard",
  },
  {
    nome: "3 — instructor",
    hats: ["instructor"],
    portas: ["studio"],
    login: "/instructor",
    shellNoMundoAdmin: "standard",
    shellNoEstudio: "studio",
    shellNoSuper: "standard",
  },
  {
    nome: "4 — admin puro (2 portas por W4)",
    hats: ["admin"],
    portas: ["standard", "admin"],
    login: "/workspace",
    shellNoMundoAdmin: "admin",
    shellNoEstudio: "standard",
    // O admin de tenant NÃO alcança o 4º mundo: cookie `super` forjado por ele
    // cai no shell padrão (fail-closed).
    shellNoSuper: "standard",
  },
  {
    nome: "5 — admin + instructor (3 portas)",
    hats: ["admin", "instructor"],
    portas: ["studio", "standard", "admin"],
    login: "/workspace",
    shellNoMundoAdmin: "admin",
    shellNoEstudio: "studio",
    shellNoSuper: "standard",
  },
  {
    // Rodada 7: o dono do produto passou a ter as TRÊS portas por POLÍTICA do
    // chapéu `super_admin` (`canEnterStudio`), com autoridade real dentro do
    // Estúdio (`canAuthorCourses`). O `admin` de tenant (linha 4) NÃO mudou.
    // Rodada 9: o 4º mundo (Super Admin) é concedido SÓ por este chapéu, e o
    // dono do produto passa a ver QUATRO cartões no picker.
    nome: "6 — super_admin (4 portas)",
    hats: ["super_admin"],
    portas: ["studio", "standard", "admin", "super"],
    login: "/workspace",
    shellNoMundoAdmin: "admin",
    shellNoEstudio: "studio",
    shellNoSuper: "super",
  },
  {
    nome: "7 — Rinaldo: instructor + manager + student",
    hats: ["instructor", "manager", "student"],
    portas: ["studio", "standard"],
    login: "/workspace",
    shellNoMundoAdmin: "standard",
    shellNoEstudio: "studio",
    shellNoSuper: "standard",
  },
]

describe("matriz de papéis — portas, login e shell por perfil", () => {
  for (const row of MATRIZ) {
    it(`${row.nome}: portas ${row.portas.join("+")}, login em ${row.login}`, () => {
      expect(accessibleWorkspaces(row.hats)).toEqual(row.portas)
      expect(postLoginDestination(row.hats)).toBe(row.login)
      expect(resolvePlatformShell("admin", row.hats)).toBe(row.shellNoMundoAdmin)
      expect(resolvePlatformShell("studio", row.hats)).toBe(row.shellNoEstudio)
      // O mundo Padrão nunca é negado a ninguém que o alcança, e o cookie
      // `standard` sempre resolve o shell padrão.
      expect(resolvePlatformShell("standard", row.hats)).toBe("standard")
      // 4º mundo (rodada 9): fail-closed pelo chapéu `super_admin` — um cookie
      // `super` forjado por qualquer outro perfil resolve o shell padrão.
      expect(resolvePlatformShell("super", row.hats)).toBe(row.shellNoSuper)
    })
  }

  it("só o admin-tier ganhou portas novas — os demais perfis ficam idênticos", () => {
    for (const row of MATRIZ) {
      expect(row.portas.includes("admin")).toBe(isAdminTier(row.hats))
    }
  })

  it("a porta do 4º mundo é EXCLUSIVA do chapéu super_admin (nenhum outro papel muda)", () => {
    for (const row of MATRIZ) {
      expect(row.portas.includes("super")).toBe(row.hats.includes("super_admin"))
    }
  })

  it("a porta do Estúdio é exatamente `canEnterStudio` — instructor OU super_admin", () => {
    for (const row of MATRIZ) {
      expect(row.portas.includes("studio")).toBe(canEnterStudio(row.hats))
    }
    // e o admin de TENANT continua fora do Estúdio (a política é do super_admin)
    expect(canEnterStudio(["admin"])).toBe(false)
    expect(canEnterStudio(["admin", "manager"])).toBe(false)
    expect(canEnterStudio(["super_admin"])).toBe(true)
  })
})

describe("matriz de papéis — a nav de cada mundo", () => {
  it("linhas 4/5/6 (admin-tier): mundo admin emite a chave administrativa", () => {
    expect(navKeysForContext({ roles: ["admin"], context: org, workspace: "admin" })).toEqual([
      "admin",
    ])
    expect(
      navKeysForContext({ roles: ["admin", "instructor"], context: org, workspace: "admin" }),
    ).toEqual(["admin"])
    // Rodada 9: o super_admin recebe a chave do admin comum, INTEIRA (o hub de
    // Configurações existe SÓ nela, e essa era a porta que faltava na rodada 5),
    // mas NÃO a chave dele — os exclusivos dele mudaram para o 4º mundo. Emitir
    // `super_admin` aqui traria "Empresas" de volta para a barra da
    // administração de UMA empresa.
    expect(navKeysForContext({ roles: ["super_admin"], context: org, workspace: "admin" })).toEqual(
      ["admin"],
    )
  })

  it("linha 6 (super_admin): o 4º mundo emite a chave dele, e só ela", () => {
    expect(navKeysForContext({ roles: ["super_admin"], context: org, workspace: "super" })).toEqual(
      ["super_admin"],
    )
  })

  it("o 4º mundo é fail-closed: sem o chapéu super_admin, nav vazia", () => {
    for (const row of MATRIZ.filter((r) => !r.hats.includes("super_admin"))) {
      expect(navKeysForContext({ roles: row.hats, context: org, workspace: "super" })).toEqual([])
    }
  })

  it("linhas 4/5/6 no mundo PADRÃO: nav do cliente, nunca administração", () => {
    expect(navKeysForContext({ roles: ["admin"], context: org, workspace: "standard" })).toEqual([
      "student",
    ])
    expect(
      navKeysForContext({ roles: ["admin", "manager"], context: org, workspace: "standard" }),
    ).toEqual(["manager"])
  })

  it("linhas 1/2/3/7 (sem chapéu admin): mundo admin não emite nav nenhuma", () => {
    for (const row of MATRIZ.filter((r) => !isAdminTier(r.hats))) {
      expect(navKeysForContext({ roles: row.hats, context: org, workspace: "admin" })).toEqual([])
    }
  })
})

describe("checagens de eixo duplo (§i) — chapéu manda, coluna singular não", () => {
  // FURO 5 da rodada 2: este bloco se chamava "entra em /admin/audit" mas só
  // afirmava `isBlockedForInstructor`, que é a camada do MIDDLEWARE. A página
  // continuava expulsando pelo `profile.role`, então o teste passava verde
  // documentando um comportamento que não existia. Agora as DUAS camadas são
  // afirmadas: middleware deixa passar E o guard de página abre.
  it("chapéu admin + users.role='instructor' entra em /admin/audit (middleware E página)", () => {
    expect(isBlockedForInstructor("/admin/audit", ["admin", "instructor"])).toBe(false)
    expect(canOpenAdminRoute("/admin/audit", ["admin", "instructor"])).toBe(true)
  })

  it("instrutor puro continua barrado em /admin/audit — pelo guard de página", () => {
    // `/admin/audit` não está no bloqueio do middleware (inventário de HEAD,
    // FURO 3); quem barra o instrutor puro ali é o guard admin-tier da página.
    expect(isBlockedForInstructor("/admin/audit", ["instructor"])).toBe(false)
    expect(canOpenAdminRoute("/admin/audit", ["instructor"])).toBe(false)
  })

  it("instructor + manager continua não bloqueado em /admin/settings", () => {
    expect(isBlockedForInstructor("/admin/settings", ["instructor", "manager"])).toBe(false)
  })

  it("nenhuma rota administrativa perde gestor ou instrutor que já entrava (W4)", () => {
    // O conjunto permitido de cada rota é o mesmo de antes; só o eixo mudou.
    expect(canOpenAdminRoute("/admin/areas", ["manager"])).toBe(true)
    expect(canOpenAdminRoute("/admin/manager-groups", ["manager"])).toBe(true)
    expect(canOpenAdminRoute("/admin/job-roles", ["instructor"])).toBe(true)
    expect(canOpenAdminRoute("/admin/job-roles", ["manager"])).toBe(true)
  })
})

describe("seletor de empresa (FURO 2) — MESMA condição nos dois shells", () => {
  /** A expressão LITERAL que vivia em `(platform)/layout.tsx` antes da extração. */
  function condicaoOriginal(p: { role: string; tenant_id: string | null }): boolean {
    return p.role === "super_admin" || (p.role === "admin" && !p.tenant_id)
  }

  const sujeitos = [
    { role: "super_admin", tenant_id: null },
    { role: "super_admin", tenant_id: "t1" },
    { role: "admin", tenant_id: null },
    { role: "admin", tenant_id: "t1" },
    { role: "manager", tenant_id: null },
    { role: "manager", tenant_id: "t1" },
    { role: "instructor", tenant_id: "t1" },
    { role: "student", tenant_id: "t1" },
  ]

  it("a função extraída é IDÊNTICA à expressão original, caso a caso", () => {
    for (const s of sujeitos) {
      expect(needsTenantSelector(s)).toBe(condicaoOriginal(s))
    }
  })

  it("quem entra no mundo admin sem tenant próprio PRECISA do seletor", () => {
    // Os dois perfis do furo: super_admin e admin global (tenant_id nulo).
    expect(needsTenantSelector({ role: "super_admin", tenant_id: null })).toBe(true)
    expect(needsTenantSelector({ role: "admin", tenant_id: null })).toBe(true)
    // E o admin de um tenant só não ganha dropdown nenhum (comportamento atual).
    expect(needsTenantSelector({ role: "admin", tenant_id: "t1" })).toBe(false)
  })
})

describe("fronteiras de mundo (§i) — o que atravessa e o que não", () => {
  it("deep-link para /admin/notifications NÃO flipa o mundo (fora da allowlist)", () => {
    // O nome antigo deste caso ("admin+instructor no Estúdio clicando
    // 'Engajamento'") descrevia um cenário que NÃO existe: o Estúdio renderiza
    // `studio-sidebar.tsx`, sem nenhum link `/admin/*`, e a chave `instructor`
    // do registry é inalcançável no mundo Padrão (`navKeysForContext`). O que o
    // teste realmente prova é a allowlist, e é isso que ele diz agora.
    expect(shouldEnterAdminWorld("/admin/notifications", ["admin", "instructor"])).toBe(false)
  })

  it("admin+instructor abrindo /admin/configuracoes atravessa para o mundo admin", () => {
    expect(shouldEnterAdminWorld("/admin/configuracoes", ["admin", "instructor"])).toBe(true)
  })

  it("cookie x-active-workspace=admin FORJADO por um manager cai no shell padrão", () => {
    expect(resolvePlatformShell("admin", ["manager"])).toBe("standard")
    // e o guard de rota do mundo admin não o deixa entrar
    expect(isAdminTier(["manager"])).toBe(false)
  })
})
