import { beforeEach, describe, expect, it, vi } from "vitest"

// =============================================================================
// VISÃO GERAL — o escopo de empresa para quem NÃO tem empresa própria.
//
// O `super_admin` tem `tenant_id` NULO. Sem passar por `resolveTenantId`, esta
// tela abriria VAZIA justamente para o dono do produto — o modo de falha
// conhecido desta base (o mesmo que a auditoria de `admin/users/loader.ts`
// pegou). Aqui o `resolveTenantId` é o REAL, não um dublê: o teste tem de
// provar que a empresa escolhida no seletor é a empresa lida.
// =============================================================================

type Row = Record<string, unknown>

let tables: Record<string, Row[]> = {}
let cookieValue: string | undefined

function makeClient() {
  return {
    from: (table: string) => {
      const eqs: [string, unknown][] = []
      const neqs: [string, unknown][] = []
      const ins: [string, unknown[]][] = []
      const rows = () =>
        (tables[table] ?? []).filter((r) => {
          for (const [c, v] of eqs) if (r[c] !== undefined && r[c] !== v) return false
          for (const [c, v] of neqs) if (r[c] !== undefined && r[c] === v) return false
          for (const [c, vs] of ins) if (r[c] !== undefined && !vs.includes(r[c])) return false
          return true
        })

      // biome-ignore lint/suspicious/noExplicitAny: builder falso do supabase
      const builder: any = {}
      builder.select = () => builder
      builder.order = () => builder
      builder.limit = () => builder
      builder.eq = (c: string, v: unknown) => {
        eqs.push([c, v])
        return builder
      }
      builder.neq = (c: string, v: unknown) => {
        neqs.push([c, v])
        return builder
      }
      builder.in = (c: string, vs: unknown[]) => {
        ins.push([c, vs])
        return builder
      }
      builder.range = (offset: number) =>
        Promise.resolve({ data: offset === 0 ? rows() : [], error: null })
      // biome-ignore lint/suspicious/noThenProperty: thenable proposital do mock
      builder.then = (onFulfilled: (v: { data: Row[]; error: null }) => unknown) =>
        Promise.resolve({ data: rows(), error: null }).then(onFulfilled)
      return builder
    },
  }
}

const serviceClient = makeClient()

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn(() => serviceClient) }))
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => serviceClient) }))

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "x-sa-active-tenant" && cookieValue ? { value: cookieValue } : undefined,
  }),
}))

// Os fatos de convite vêm do Auth; aqui o Auth "não responde", que é o caminho
// de degradação já contratado em `invites/status.ts`.
vi.mock("@/app/(platform)/admin/users/auth-accounts", () => ({
  fetchAuthAccounts: vi.fn(async () => ({})),
}))

let authProfile: {
  user: { id: string } | null
  profile: { role: string; tenant_id: string | null } | null
  roles: string[]
}

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>()
  return {
    // `resolveTenantId` é o REAL — é ele que este teste existe para exercitar.
    resolveTenantId: actual.resolveTenantId,
    getAuthProfile: vi.fn(async () => authProfile),
  }
})

const { loadAdminOverviewPage, parseAdoptionAxis } = await import("../loader")
const { __resetOrgReferenceCache } = await import("@/lib/analytics/org-reference-cache")

const NOW_ISO = new Date().toISOString()

beforeEach(() => {
  __resetOrgReferenceCache()
  cookieValue = undefined
  tables = {
    tenants: [
      { id: "t-alpha", name: "Alpha" },
      { id: "t-bravo", name: "Bravo" },
    ],
    users: [
      { id: "a1", tenant_id: "t-alpha", role: "student", status: "active", last_seen_at: NOW_ISO },
      { id: "a2", tenant_id: "t-alpha", role: "student", status: "active", last_seen_at: NOW_ISO },
      { id: "b1", tenant_id: "t-bravo", role: "student", status: "active", last_seen_at: NOW_ISO },
    ],
    areas: [
      { id: "ar-a", tenant_id: "t-alpha", name: "Sede Alpha" },
      { id: "ar-b", tenant_id: "t-bravo", name: "Sede Bravo" },
    ],
    user_areas: [
      { user_id: "a1", area_id: "ar-a", created_at: NOW_ISO },
      { user_id: "a2", area_id: "ar-a", created_at: NOW_ISO },
      { user_id: "b1", area_id: "ar-b", created_at: NOW_ISO },
    ],
    courses: [{ id: "c-b", tenant_id: "t-bravo", title: "Curso Bravo", status: "published" }],
    chapters: [{ id: "ch-b", tenant_id: "t-bravo", course_id: "c-b", order: 1 }],
    sessions: [],
    slide_reflections: [],
    enrollments: [],
    certificates: [],
  }
  authProfile = {
    user: { id: "sa" },
    profile: { role: "super_admin", tenant_id: null },
    roles: ["super_admin"],
  }
})

describe("loadAdminOverviewPage — super_admin sem tenant próprio", () => {
  it("lê a empresa ATIVA do seletor, e não uma tela vazia", async () => {
    cookieValue = "t-bravo"

    const loaded = await loadAdminOverviewPage("area")

    expect(loaded.kind).toBe("ok")
    if (loaded.kind !== "ok") return
    expect(loaded.overview.tenantId).toBe("t-bravo")
    // Dado REAL da empresa ativa: 1 pessoa, 1 curso publicado, unidade dela.
    expect(loaded.overview.totals.people).toBe(1)
    expect(loaded.overview.totals.publishedCourses).toBe(1)
    expect(loaded.overview.adoption.rows.map((r) => r.name)).toContain("Sede Bravo")
    // E NUNCA a empresa vizinha.
    expect(loaded.overview.adoption.rows.map((r) => r.name)).not.toContain("Sede Alpha")
  })

  it("sem cookie, cai na primeira empresa pela ordem canônica (nome, id)", async () => {
    const loaded = await loadAdminOverviewPage("area")

    expect(loaded.kind).toBe("ok")
    if (loaded.kind !== "ok") return
    expect(loaded.overview.tenantId).toBe("t-alpha")
    expect(loaded.overview.totals.people).toBe(2)
  })

  it("as três seções chegam preenchidas na mesma leitura", async () => {
    cookieValue = "t-alpha"

    const loaded = await loadAdminOverviewPage("area")

    expect(loaded.kind).toBe("ok")
    if (loaded.kind !== "ok") return
    expect(loaded.overview.totals.windowDays).toBeGreaterThan(0)
    expect(loaded.overview.adoption.rows.length).toBeGreaterThan(0)
    expect(loaded.overview.engagement.activeMetrics.length).toBe(2)
    expect(loaded.overview.engagement.retention.length).toBeGreaterThan(0)
  })
})

describe("loadAdminOverviewPage — guardas", () => {
  it("admin de empresa lê a PRÓPRIA empresa, sem passar pelo cookie", async () => {
    cookieValue = "t-bravo"
    authProfile = {
      user: { id: "adm" },
      profile: { role: "admin", tenant_id: "t-alpha" },
      roles: ["admin"],
    }

    const loaded = await loadAdminOverviewPage("area")

    expect(loaded.kind).toBe("ok")
    if (loaded.kind !== "ok") return
    expect(loaded.overview.tenantId).toBe("t-alpha")
  })

  it("fail-closed: quem não tem chapéu admin-tier não abre a tela", async () => {
    authProfile = {
      user: { id: "mgr" },
      profile: { role: "manager", tenant_id: "t-alpha" },
      roles: ["manager"],
    }

    expect((await loadAdminOverviewPage("area")).kind).toBe("forbidden")
  })

  it("sem sessão, é 'unauthenticated' — nunca uma tela com número de ninguém", async () => {
    authProfile = { user: null, profile: null, roles: [] }

    expect((await loadAdminOverviewPage("area")).kind).toBe("unauthenticated")
  })
})

describe("parseAdoptionAxis", () => {
  it("só 'departamento'/'department' troca o eixo; o resto é unidade", () => {
    expect(parseAdoptionAxis("departamento")).toBe("department")
    expect(parseAdoptionAxis("department")).toBe("department")
    expect(parseAdoptionAxis("unidade")).toBe("area")
    expect(parseAdoptionAxis(undefined)).toBe("area")
    expect(parseAdoptionAxis("qualquer-coisa")).toBe("area")
    expect(parseAdoptionAxis(["departamento", "unidade"])).toBe("department")
  })
})
