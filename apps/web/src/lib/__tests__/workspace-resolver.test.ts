import {
  accessibleWorkspaces,
  canAccessWorkspace,
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
