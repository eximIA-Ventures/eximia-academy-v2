import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// =============================================================================
// A-2 — a falha de leitura da POPULAÇÃO tem de chegar à TELA como falha.
//
// O caminho inteiro, do banco ao pixel: `users` ilegível → `readAll` →
// `readTenantUsers` → `loadAdminOverview` → `loadAdminOverviewPage` → página.
// Nenhum dublê no meio; o único mock é o cliente do Supabase (a borda de I/O) e
// o `redirect` do Next.
//
// O par que dá sentido ao sinal está aqui junto: a MESMA tela, com o MESMO
// caminho, para uma empresa genuinamente sem gente, tem de continuar mostrando
// os totais (zeros honestos) e NÃO o aviso de falha. Sem esse controle
// positivo, um banner permanente passaria neste teste.
// =============================================================================

type Row = Record<string, unknown>

let tables: Record<string, Row[]> = {}
let ilegivel: string[] = []

function makeClient() {
  return {
    from: (table: string) => {
      const eqs: [string, unknown][] = []
      const ins: [string, unknown[]][] = []
      const rows = () =>
        (tables[table] ?? []).filter((r) => {
          for (const [c, v] of eqs) if (r[c] !== undefined && r[c] !== v) return false
          for (const [c, vs] of ins) if (r[c] !== undefined && !vs.includes(r[c])) return false
          return true
        })
      const falha = () => ilegivel.includes(table)
      const erro = { code: "57014", message: "canceling statement due to statement timeout" }

      // biome-ignore lint/suspicious/noExplicitAny: builder falso do supabase
      const builder: any = {}
      builder.select = () => builder
      builder.order = () => builder
      builder.limit = () => builder
      builder.eq = (c: string, v: unknown) => {
        eqs.push([c, v])
        return builder
      }
      builder.neq = () => builder
      builder.in = (c: string, vs: unknown[]) => {
        ins.push([c, vs])
        return builder
      }
      builder.range = (offset: number) =>
        falha()
          ? Promise.resolve({ data: null, error: erro })
          : Promise.resolve({ data: offset === 0 ? rows() : [], error: null })
      // biome-ignore lint/suspicious/noThenProperty: thenable proposital do mock
      builder.then = (onFulfilled: (v: { data: Row[] | null; error: unknown }) => unknown) =>
        Promise.resolve(falha() ? { data: null, error: erro } : { data: rows(), error: null }).then(
          onFulfilled,
        )
      return builder
    },
  }
}

const serviceClient = makeClient()

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn(() => serviceClient) }))
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => serviceClient) }))
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }))
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Error(`redirect inesperado para ${destino}`)
  },
}))
vi.mock("@/app/(platform)/admin/users/auth-accounts", () => ({
  fetchAuthAccounts: vi.fn(async () => ({})),
}))
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>()
  return {
    resolveTenantId: actual.resolveTenantId,
    getAuthProfile: vi.fn(async () => ({
      user: { id: "adm" },
      profile: { role: "admin", tenant_id: "t-alpha" },
      roles: ["admin"],
    })),
  }
})

const { loadAdminOverviewPage } = await import("../loader")
const AdminVisaoGeralPage = (await import("../page")).default
const { __resetOrgReferenceCache } = await import("@/lib/analytics/org-reference-cache")

const AGORA = new Date().toISOString()

beforeEach(() => {
  __resetOrgReferenceCache()
  ilegivel = []
  tables = {
    tenants: [{ id: "t-alpha", name: "Alpha" }],
    users: [
      { id: "a1", tenant_id: "t-alpha", role: "student", status: "active", last_seen_at: AGORA },
      { id: "a2", tenant_id: "t-alpha", role: "student", status: "active", last_seen_at: AGORA },
    ],
    areas: [{ id: "ar-a", tenant_id: "t-alpha", name: "Sede Alpha" }],
    user_areas: [{ user_id: "a1", area_id: "ar-a", created_at: AGORA }],
    courses: [],
    chapters: [],
    sessions: [],
    slide_reflections: [],
    enrollments: [],
    certificates: [],
  }
})

describe("A-2 na superfície — `/admin/visao-geral` com a população ilegível", () => {
  it("o loader devolve um estado de FALHA, não um 'ok' com zero pessoas", async () => {
    ilegivel = ["users"]

    const loaded = await loadAdminOverviewPage("area")

    expect(loaded.kind).toBe("read-failed")
  })

  it("a tela mostra que não conseguiu ler, e NÃO 'Pessoas na empresa: 0'", async () => {
    ilegivel = ["users"]

    render(await AdminVisaoGeralPage({ searchParams: Promise.resolve({}) }))

    expect(screen.getByRole("alert")).toHaveTextContent(/não foi possível ler/i)
    expect(screen.queryByText("Pessoas na empresa")).toBeNull()
  })

  it("controle positivo — empresa sem gente continua mostrando os totais, sem aviso de falha", async () => {
    tables.users = []
    tables.user_areas = []

    render(await AdminVisaoGeralPage({ searchParams: Promise.resolve({}) }))

    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.getByText("Pessoas na empresa")).toBeTruthy()
  })
})
