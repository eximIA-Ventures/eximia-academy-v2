import {
  accessibleWorkspaces,
  canAccessWorkspace,
  canAuthorCourses,
  resolveAdminNavMode,
  resolvePlatformShell,
  workspaceHomeRoute,
} from "@/lib/workspace-resolver"
import type { Role } from "@eximia/shared"
import { describe, expect, it } from "vitest"

// =============================================================================
// Certificação do gate de multi-acesso (S3). Estas são as decisões PURAS das
// quais dependem: (a) a prop `canSwitchWorkspace` dos dois headers, resolvida
// por accessibleWorkspaces(roles).length > 1; (b) o redirect single-access da
// page /workspace; (c) o fail-closed do switchWorkspace, que chama
// canAccessWorkspace antes de trocar. Se estas funções estiverem certas, os 3
// pontos estão certos — por isso o teste vive aqui, no coração da decisão.
// =============================================================================

describe("accessibleWorkspaces — quais mundos o usuário alcança", () => {
  it("instructor-only alcança apenas o Estúdio (single-access)", () => {
    expect(accessibleWorkspaces(["instructor"])).toEqual(["studio"])
  })

  it("student-only alcança apenas a Plataforma (single-access)", () => {
    expect(accessibleWorkspaces(["student"])).toEqual(["standard"])
  })

  it("manager/leader alcançam a Plataforma (não o Estúdio)", () => {
    expect(accessibleWorkspaces(["manager"])).toEqual(["standard"])
    expect(accessibleWorkspaces(["leader"])).toEqual(["standard"])
  })

  it("instructor + student é multi-access (ordem estável: studio primeiro)", () => {
    expect(accessibleWorkspaces(["instructor", "student"])).toEqual(["studio", "standard"])
    // ordem de entrada não muda a saída — determinismo
    expect(accessibleWorkspaces(["student", "instructor"])).toEqual(["studio", "standard"])
  })

  it("usuário sem hats de workspace cai no piso defensivo ['standard']", () => {
    expect(accessibleWorkspaces([])).toEqual(["standard"])
  })

  // ===========================================================================
  // 3º WORKSPACE (W1-W4). Antes desta fase, `["admin"]` caía no piso defensivo
  // `["standard"]` (admin não concedia mundo nenhum). Agora o chapéu admin-tier
  // concede DOIS mundos: Administração + Padrão (W4 — o admin precisa poder ver
  // o produto como o cliente vê), o que o torna SEMPRE multi-acesso.
  // ===========================================================================
  it("admin puro alcança Padrão + Administração (W4: nunca single-access)", () => {
    expect(accessibleWorkspaces(["admin"])).toEqual(["standard", "admin"])
  })

  // ===========================================================================
  // RODADA 7 — O DONO DO PRODUTO TEM AS TRÊS PORTAS.
  // Política do CHAPÉU `super_admin` (nunca exceção de e-mail chumbado): ele
  // alcança o Estúdio além dos dois mundos que o admin-tier já dava. O `admin`
  // de tenant NÃO ganhou nada — o caso acima é a régua disso.
  // ===========================================================================
  // ===========================================================================
  // RODADA 9 — O 4º MUNDO. O `super_admin` ganha "super" (painel global +
  // Empresas), concedido SÓ por este chapéu. Ele entra por ÚLTIMO na lista,
  // pela mesma disciplina de "admin": nenhum `out[0]` pré-existente se move.
  // O `admin` de tenant (caso acima) segue com DUAS portas, intocado.
  // ===========================================================================
  it("super_admin alcança os QUATRO mundos, na ordem estável (rodada 9)", () => {
    expect(accessibleWorkspaces(["super_admin"])).toEqual(["studio", "standard", "admin", "super"])
    // com chapéus somados o resultado é o mesmo — determinismo
    expect(accessibleWorkspaces(["super_admin", "admin", "student"])).toEqual([
      "studio",
      "standard",
      "admin",
      "super",
    ])
    // e o 4º mundo NÃO vaza para o admin de tenant
    expect(accessibleWorkspaces(["admin"])).not.toContain("super")
    expect(accessibleWorkspaces(["admin", "instructor"])).not.toContain("super")
  })

  it("workspaceHomeRoute do 4º mundo é /super-admin (segmento de topo, como os demais)", () => {
    expect(workspaceHomeRoute("super")).toBe("/super-admin")
    // e as homes existentes não se movem
    expect(workspaceHomeRoute("admin")).toBe("/admin")
    expect(workspaceHomeRoute("studio")).toBe("/instructor")
    expect(workspaceHomeRoute("standard")).toBe("/dashboard")
  })

  it("admin + instructor alcança os TRÊS mundos, na ordem estável", () => {
    expect(accessibleWorkspaces(["admin", "instructor"])).toEqual(["studio", "standard", "admin"])
    // ordem de entrada não muda a saída — determinismo
    expect(accessibleWorkspaces(["instructor", "admin"])).toEqual(["studio", "standard", "admin"])
  })

  it("'admin' entra por ÚLTIMO: nenhum out[0] pré-existente muda de valor", () => {
    // Este é o contrato que mantém a resolução de acesso ÚNICO (middleware e
    // /workspace consomem ws[0]) byte-idêntica para as combinações antigas.
    expect(accessibleWorkspaces(["instructor", "student"])[0]).toBe("studio")
    expect(accessibleWorkspaces(["student"])[0]).toBe("standard")
    expect(accessibleWorkspaces(["admin", "instructor"])[0]).toBe("studio")
    expect(accessibleWorkspaces(["admin", "student"])[0]).toBe("standard")
  })

  it("admin-tier é sempre multi-acesso => sempre passa pelo picker (D1)", () => {
    const combos: Role[][] = [
      ["admin"],
      ["super_admin"],
      ["admin", "student"],
      ["admin", "manager"],
      ["admin", "instructor"],
      ["super_admin", "instructor"],
    ]
    for (const roles of combos) {
      expect(accessibleWorkspaces(roles).length).toBeGreaterThan(1)
    }
  })

  it("nunca retorna vazio (invariante do gate)", () => {
    const combos: Role[][] = [
      [],
      ["student"],
      ["instructor"],
      ["manager"],
      ["admin"],
      ["instructor", "student", "manager"],
    ]
    for (const roles of combos) {
      expect(accessibleWorkspaces(roles).length).toBeGreaterThan(0)
    }
  })
})

describe("canSwitchWorkspace — o gate de renderização da pílula (.length > 1)", () => {
  const canSwitch = (roles: Role[]) => accessibleWorkspaces(roles).length > 1

  it("single-access NÃO vê a porta (instructor-only, student-only)", () => {
    expect(canSwitch(["instructor"])).toBe(false)
    expect(canSwitch(["student"])).toBe(false)
    expect(canSwitch(["manager"])).toBe(false)
  })

  it("multi-access VÊ a porta (instructor + student)", () => {
    expect(canSwitch(["instructor", "student"])).toBe(true)
    expect(canSwitch(["instructor", "manager"])).toBe(true)
  })
})

describe("canAccessWorkspace — fail-closed do switchWorkspace (request forjada)", () => {
  it("instructor-only NÃO pode trocar para standard (forja negada)", () => {
    expect(canAccessWorkspace(["instructor"], "standard")).toBe(false)
  })

  it("student-only NÃO pode trocar para studio (forja negada)", () => {
    expect(canAccessWorkspace(["student"], "studio")).toBe(false)
    expect(canAccessWorkspace(["manager"], "studio")).toBe(false)
  })

  it("multi-access pode trocar para qualquer mundo que alcança", () => {
    expect(canAccessWorkspace(["instructor", "student"], "studio")).toBe(true)
    expect(canAccessWorkspace(["instructor", "student"], "standard")).toBe(true)
  })

  it("admin de tenant sem hat de instrutor NÃO alcança o studio (fail-closed)", () => {
    expect(canAccessWorkspace(["admin"], "studio")).toBe(false)
    expect(canAccessWorkspace(["admin", "manager"], "studio")).toBe(false)
  })

  it("super_admin alcança o studio por POLÍTICA DO CHAPÉU (rodada 7)", () => {
    expect(canAccessWorkspace(["super_admin"], "studio")).toBe(true)
  })

  it("só o chapéu admin-tier alcança o mundo admin (forja negada)", () => {
    expect(canAccessWorkspace(["admin"], "admin")).toBe(true)
    expect(canAccessWorkspace(["super_admin"], "admin")).toBe(true)
    expect(canAccessWorkspace(["manager"], "admin")).toBe(false)
    expect(canAccessWorkspace(["instructor"], "admin")).toBe(false)
    expect(canAccessWorkspace(["student"], "admin")).toBe(false)
  })
})

describe("workspaceHomeRoute — destino após entrar num mundo", () => {
  it("studio => /instructor, standard => /dashboard", () => {
    expect(workspaceHomeRoute("studio")).toBe("/instructor")
    expect(workspaceHomeRoute("standard")).toBe("/dashboard")
  })

  it("admin => /admin (W2: a home do mundo admin é o PAINEL)", () => {
    expect(workspaceHomeRoute("admin")).toBe("/admin")
  })
})

// =============================================================================
// BUG-2 — a rota /courses vive no route group (platform), mas o menu "Meus
// Cursos" do Estúdio aponta para ela. Sem preservar o workspace, o instrutor
// vindo do Estúdio cai no shell padrão ("Plataforma de Aprendizagem" / "Gestão
// do Time"), trocando de workspace sozinho. resolvePlatformShell é a decisão
// PURA de qual shell o layout (platform) renderiza: se o workspace ativo é o
// Estúdio e o usuário TEM o chapéu de instrutor, o shell continua sendo o do
// Estúdio nas páginas compartilhadas, preservando o contexto de onde ele veio.
// =============================================================================
describe("resolvePlatformShell — qual shell o layout (platform) renderiza", () => {
  it("workspace studio + hat instructor => shell do Estúdio (preserva o contexto)", () => {
    expect(resolvePlatformShell("studio", ["instructor", "student"])).toBe("studio")
    expect(resolvePlatformShell("studio", ["instructor"])).toBe("studio")
  })

  it("workspace studio SEM hat de instrutor => shell padrão (fail-closed, nunca vaza)", () => {
    // Cookie forjado para "studio" sem alcance real: cai no padrão.
    expect(resolvePlatformShell("studio", ["student"])).toBe("standard")
    expect(resolvePlatformShell("studio", ["manager"])).toBe("standard")
  })

  it("workspace standard => sempre shell padrão, mesmo com hat de instrutor", () => {
    expect(resolvePlatformShell("standard", ["instructor", "student"])).toBe("standard")
    expect(resolvePlatformShell("standard", ["student"])).toBe("standard")
  })

  it("workspace ausente (null) => shell padrão (default seguro)", () => {
    expect(resolvePlatformShell(null, ["instructor", "student"])).toBe("standard")
    expect(resolvePlatformShell(null, ["student"])).toBe("standard")
  })

  it("workspace admin + chapéu admin-tier => shell do mundo admin", () => {
    expect(resolvePlatformShell("admin", ["admin"])).toBe("admin")
    expect(resolvePlatformShell("admin", ["super_admin"])).toBe("admin")
    expect(resolvePlatformShell("admin", ["admin", "instructor"])).toBe("admin")
  })

  it("cookie admin FORJADO sem chapéu admin-tier => shell padrão (fail-closed)", () => {
    expect(resolvePlatformShell("admin", ["manager"])).toBe("standard")
    expect(resolvePlatformShell("admin", ["student"])).toBe("standard")
    // um instrutor com cookie admin forjado também cai no padrão (o ramo studio
    // exige o cookie `studio`, não só o chapéu)
    expect(resolvePlatformShell("admin", ["instructor"])).toBe("standard")
  })
})

// =============================================================================
// BUG-2 (efeito colateral) — em /courses sob "Plataforma de Aprendizagem"
// (contexto de aluno "Minha Trilha") apareciam ações de instrutor ("Criar
// Curso", "Criar Blueprint", "Importar com IA"). O gating estava amarrado ao
// papel singular, não ao workspace. canAuthorCourses amarra a autoria ao
// workspace do Estúdio + chapéu de instrutor: no mundo padrão, ninguém cria.
// =============================================================================
describe("canAuthorCourses — quem vê as ações de autoria de curso em /courses", () => {
  it("só o instrutor DENTRO do Estúdio pode autorar", () => {
    expect(canAuthorCourses("studio", ["instructor"])).toBe(true)
    expect(canAuthorCourses("studio", ["instructor", "student"])).toBe(true)
  })

  it("instrutor no mundo PADRÃO (aluno/Minha Trilha) NÃO vê autoria", () => {
    // Este é o efeito colateral reportado: o instrutor em /courses no shell
    // padrão via "Criar Curso". Amarrado ao workspace, não vê mais.
    expect(canAuthorCourses("standard", ["instructor", "student"])).toBe(false)
    expect(canAuthorCourses("standard", ["instructor"])).toBe(false)
  })

  it("não-instrutor nunca autora, em qualquer workspace", () => {
    expect(canAuthorCourses("studio", ["student"])).toBe(false)
    expect(canAuthorCourses("standard", ["manager"])).toBe(false)
    expect(canAuthorCourses(null, ["student"])).toBe(false)
  })

  it("o mundo ADMIN não abre autoria (nem para admin, nem para admin+instrutor)", () => {
    // Deliberado: autoria continua sendo do Estúdio. W3 fala do que o admin JÁ
    // alcança; abrir autoria para o admin seria decisão nova, do dono.
    expect(canAuthorCourses("admin", ["admin"])).toBe(false)
    expect(canAuthorCourses("admin", ["admin", "instructor"])).toBe(false)
    // nem para o super_admin: a porta nova dele é o ESTÚDIO, não a autoria
    // dentro do mundo admin.
    expect(canAuthorCourses("admin", ["super_admin"])).toBe(false)
  })

  // ===========================================================================
  // RODADA 7 — PORTA COM AUTORIDADE. Dar ao super_admin a porta do Estúdio sem
  // a autoria dentro dele produziria "sala que abre e não funciona": ele veria
  // "Meus Cursos" sem poder criar nada. `canAuthorCourses` consome o MESMO
  // `canEnterStudio` da porta, então os dois não podem divergir.
  // ===========================================================================
  describe("autoridade dentro do Estúdio para o super_admin (rodada 7)", () => {
    it("super_admin DENTRO do Estúdio autora", () => {
      expect(canAuthorCourses("studio", ["super_admin"])).toBe(true)
    })

    it("super_admin FORA do Estúdio não autora (a regra continua sendo do mundo)", () => {
      expect(canAuthorCourses("standard", ["super_admin"])).toBe(false)
      expect(canAuthorCourses(null, ["super_admin"])).toBe(false)
    })

    it("o shell do Estúdio resolve para o super_admin, e só com o cookie certo", () => {
      expect(resolvePlatformShell("studio", ["super_admin"])).toBe("studio")
      expect(resolvePlatformShell("standard", ["super_admin"])).toBe("standard")
      // admin de tenant com cookie `studio` forjado continua caindo no padrão
      expect(resolvePlatformShell("studio", ["admin"])).toBe("standard")
    })
  })
})

// =============================================================================
// DRILL-IN do modo Configurações (2026-07-28). O dono do produto viu DUAS barras
// laterais lado a lado em `/admin/configuracoes/*` e decidiu o padrão
// Stripe/Vercel: dentro do hub, a barra do mundo DÁ LUGAR à do hub. Esta é a
// decisão pura da qual isso depende — a `AdminSidebar` só a consulta.
//
// Ela é deliberadamente SEPARADA de `resolvePlatformShell`: mundo é estado
// (cookie + chapéu + fail-closed), modo é rota. Se um dia alguém tentar fundir
// os dois, o teste de baixo ("não concede nem retira mundo") fica como registro
// de que os eixos são independentes de propósito.
// =============================================================================

describe("resolveAdminNavMode — qual barra o shell administrativo renderiza", () => {
  it("a raiz do hub e todas as sub-rotas entram no modo Configurações", () => {
    expect(resolveAdminNavMode("/admin/configuracoes")).toBe("settings")
    expect(resolveAdminNavMode("/admin/configuracoes/organizacao")).toBe("settings")
    expect(resolveAdminNavMode("/admin/configuracoes/usuarios")).toBe("settings")
    expect(resolveAdminNavMode("/admin/configuracoes/unidades/nova")).toBe("settings")
  })

  it("o resto do mundo admin continua no modo mundo", () => {
    expect(resolveAdminNavMode("/admin")).toBe("world")
    expect(resolveAdminNavMode("/admin/biblioteca")).toBe("world")
    expect(resolveAdminNavMode("/admin/settings")).toBe("world")
    expect(resolveAdminNavMode("/dashboard")).toBe("world")
  })

  it("casa por SEGMENTO, não por prefixo cru (`/admin/configuracoes-legado` não é o hub)", () => {
    expect(resolveAdminNavMode("/admin/configuracoes-legado")).toBe("world")
    expect(resolveAdminNavMode("/admin/configuracoesx")).toBe("world")
  })

  it("pathname ausente (SSR sem rota resolvida) cai no modo mundo, nunca no hub", () => {
    expect(resolveAdminNavMode(null)).toBe("world")
    expect(resolveAdminNavMode(undefined)).toBe("world")
    expect(resolveAdminNavMode("")).toBe("world")
  })

  it("não concede nem retira mundo: o eixo de PERMISSÃO segue só em resolvePlatformShell", () => {
    // Estar no hub não muda quem alcança o mundo admin...
    expect(resolvePlatformShell("admin", ["manager"])).toBe("standard")
    // ...e o modo é o mesmo para quem quer que esteja na rota.
    expect(resolveAdminNavMode("/admin/configuracoes")).toBe("settings")
  })
})
