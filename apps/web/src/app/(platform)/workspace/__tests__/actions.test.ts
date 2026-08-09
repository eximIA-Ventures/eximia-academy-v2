import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Travessia de mundo -> tela em que a pessoa aterrissa.
 *
 * Este teste segue o caminho INTEIRO que o browser faz, porque o bug que ele
 * cobre nasceu exatamente na costura entre as duas metades: a ESCRITA (o server
 * action `switchWorkspace`, que limpa o contexto) e a LEITURA (`resolveContext`
 * -> `resolveDashboardKind`, que interpreta a ausência de cookie como "estado
 * fresco" e sobe para o chapéu mais alto). Testar só uma das metades deixaria o
 * bug passar: cada uma, isolada, estava correta.
 *
 * Por isso o jar de cookie abaixo é FALSO mas VIVO — o que o action escreve é o
 * que o resolver lê em seguida.
 */

// Jar de cookie em memória, compartilhado pela escrita e pela leitura.
let contextCookie: { type: string; id: string | null } | null = null

vi.mock("@/lib/auth", () => ({ getAuthProfile: vi.fn() }))
vi.mock("@/lib/context-context", () => ({
  getActiveContextCookie: vi.fn(async () => contextCookie),
  setActiveContext: vi.fn(async (ctx: { type: string; id: string | null }) => {
    contextCookie = ctx
  }),
  clearActiveContext: vi.fn(async () => {
    contextCookie = null
  }),
}))
vi.mock("@/lib/workspace-context", () => ({
  setActiveWorkspace: vi.fn(async () => undefined),
}))
// `switchWorkspace` mexe em cookies legados (x-view-as-student / x-role-lens).
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => undefined, delete: () => undefined })),
}))
// `redirect` INTERROMPE o fluxo no Next (lança). Emular isso importa: sem lançar,
// o ramo fail-closed continuaria executando e o teste mediria um mundo irreal.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
}))

import { resolveDashboardKind } from "@/app/(platform)/dashboard/_components/resolve-dashboard-kind"
import { getAuthProfile } from "@/lib/auth"
import { resolveContext } from "@/lib/context-resolver"
import { switchWorkspace } from "../actions"

const mockedAuth = vi.mocked(getAuthProfile)

type Profile = { roles: string[]; hasSubordinates: boolean; hasEnrollment: boolean }

function signedInAs(p: Profile) {
  // getAuthProfile é consumido pelo action E pelo resolveContext; o mesmo stub
  // serve os dois, como acontece de verdade numa request.
  mockedAuth.mockResolvedValue(p as unknown as Awaited<ReturnType<typeof getAuthProfile>>)
}

/** Entra no mundo Padrão e devolve a rota de destino. */
async function enterStandardWorld(): Promise<string> {
  try {
    await switchWorkspace("standard")
  } catch (e) {
    const msg = e instanceof Error ? e.message : ""
    if (!msg.startsWith("NEXT_REDIRECT:")) throw e
    return msg.slice("NEXT_REDIRECT:".length)
  }
  throw new Error("switchWorkspace deveria ter redirecionado")
}

/** A tela que /dashboard renderizaria AGORA, com o estado que a travessia deixou. */
async function landingScreen(roles: string[]) {
  const { active } = await resolveContext()
  return { kind: resolveDashboardKind({ roles }, active), context: active.type }
}

describe("switchWorkspace('standard') — em que tela a travessia aterrissa", () => {
  beforeEach(() => {
    contextCookie = null
    vi.clearAllMocks()
  })

  it("gestor E aluno: cai na própria trilha, não no painel do time", async () => {
    // O caso do relato: os dois chapéus, subordinados reais e matrícula real.
    signedInAs({ roles: ["manager", "student"], hasSubordinates: true, hasEnrollment: true })

    const route = await enterStandardWorld()
    const { kind, context } = await landingScreen(["manager", "student"])

    expect(route).toBe("/dashboard")
    // ESTE é o assert que falha contra o HEAD anterior: sem o sentinel, o estado
    // fresco subia para `team` e a tela era "Ritmo da Equipe" (manager-team).
    expect(context).toBe("personal")
    expect(kind).toBe("student")
  })

  it("gestor E aluno: a gestão continua a UM clique (o switcher segue oferecendo Meu Time)", async () => {
    // Aterrissar na trilha não pode AMPUTAR a gestão. O ContextSwitcher do header
    // é alimentado por `available`; se "Meu Time" sumisse dali, o gestor ficaria
    // preso na trilha — que seria trocar um bug por outro pior.
    signedInAs({ roles: ["manager", "student"], hasSubordinates: true, hasEnrollment: true })

    await enterStandardWorld()
    const { available } = await resolveContext()

    expect(available.map((c) => c.type)).toContain("team")
    expect(available.find((c) => c.type === "team")?.label).toBe("Meu Time")
  })

  it("gestor PURO (sem matrícula): segue no painel do time, sem trilha vazia", async () => {
    // Sem matrícula não há contexto `personal`, então nada é assentado e o
    // estado fresco resolve exatamente como resolvia antes da mudança.
    signedInAs({ roles: ["manager"], hasSubordinates: true, hasEnrollment: false })

    const route = await enterStandardWorld()
    const { kind, context } = await landingScreen(["manager"])

    expect(route).toBe("/dashboard")
    expect(contextCookie).toBeNull() // nenhum cookie de gestão persistido
    expect(context).toBe("team")
    expect(kind).toBe("manager-team")
  })

  it("aluno PURO: inalterado — a trilha, como sempre foi", async () => {
    signedInAs({ roles: ["student"], hasSubordinates: false, hasEnrollment: true })

    const route = await enterStandardWorld()
    const { kind, context } = await landingScreen(["student"])

    expect(route).toBe("/dashboard")
    expect(context).toBe("personal")
    expect(kind).toBe("student")
  })

  it("instrutor que também é gestor e aluno: entrar no Padrão é entrar para aprender", async () => {
    // Perfil que enxerga o picker (2 mundos). O Estúdio continua sendo o mundo
    // de criação dele; o Padrão passa a abrir na trilha.
    signedInAs({
      roles: ["instructor", "manager", "student"],
      hasSubordinates: true,
      hasEnrollment: true,
    })

    await enterStandardWorld()
    const { kind, context } = await landingScreen(["instructor", "manager", "student"])

    expect(context).toBe("personal")
    expect(kind).toBe("student")
  })
})

describe("switchWorkspace — mundos que não usam o eixo de contexto", () => {
  beforeEach(() => {
    contextCookie = null
    vi.clearAllMocks()
  })

  it("Estúdio: sai da porta com o contexto limpo (nada é assentado)", async () => {
    signedInAs({
      roles: ["instructor", "manager", "student"],
      hasSubordinates: true,
      hasEnrollment: true,
    })

    let route = ""
    try {
      await switchWorkspace("studio")
    } catch (e) {
      route = (e as Error).message.slice("NEXT_REDIRECT:".length)
    }

    expect(route).toBe("/instructor")
    expect(contextCookie).toBeNull()
  })

  it("fail-closed: sem o chapéu, a porta não abre e nada é assentado", async () => {
    signedInAs({ roles: ["student"], hasSubordinates: false, hasEnrollment: true })

    let route = ""
    try {
      await switchWorkspace("studio")
    } catch (e) {
      route = (e as Error).message.slice("NEXT_REDIRECT:".length)
    }

    expect(route).toBe("/workspace")
    expect(contextCookie).toBeNull()
  })
})
