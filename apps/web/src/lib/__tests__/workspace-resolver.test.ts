import {
  accessibleWorkspaces,
  canAccessWorkspace,
  canAuthorCourses,
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
    expect(accessibleWorkspaces(["admin"])).toEqual(["standard"])
    expect(accessibleWorkspaces(["super_admin"])).toEqual(["standard"])
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

  it("admin sem hat de workspace NÃO alcança o studio (fail-closed)", () => {
    expect(canAccessWorkspace(["admin"], "studio")).toBe(false)
    expect(canAccessWorkspace(["super_admin"], "studio")).toBe(false)
  })
})

describe("workspaceHomeRoute — destino após entrar num mundo", () => {
  it("studio => /instructor, standard => /dashboard", () => {
    expect(workspaceHomeRoute("studio")).toBe("/instructor")
    expect(workspaceHomeRoute("standard")).toBe("/dashboard")
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
})
