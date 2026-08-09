import { beforeEach, describe, expect, it, vi } from "vitest"

// =============================================================================
// IMPORT EM MASSA — a rota (CFG-6.1).
//
// O que estes testes existem para provar não é que o import funciona: é que ele
// se RECUSA a criar quando não deveria.
//   - `preview` não escreve NADA (nem convite, nem linha em `users`);
//   - `apply` recalcula e ABORTA se o número mudou desde a pré-visualização —
//     ninguém é criado sem ter aparecido num número que o admin confirmou;
//   - uma linha que falha no meio do lote volta como falha explícita, e as
//     outras não são desfeitas nem escondidas.
// =============================================================================

/* ---------------------------------- Mocks --------------------------------- */

let authUser: { id: string } | null = { id: "adm-1" }
let actorProfile: Record<string, unknown> | null = {
  id: "adm-1",
  role: "admin",
  tenant_id: "tenant-1",
  user_roles: [{ role: "admin" }],
}
/** E-mails já existentes no tenant, como `users` devolveria. */
let tenantEmails: { email: string }[] = []

function serverBuilder(table: string) {
  let selectArg = ""
  // biome-ignore lint/suspicious/noExplicitAny: test mock builder
  const builder: any = {}
  builder.select = (arg: string) => {
    selectArg = arg
    return builder
  }
  builder.eq = () => builder
  builder.single = async () => ({ data: actorProfile })
  // biome-ignore lint/suspicious/noThenProperty: thenable mock emulates the supabase builder
  builder.then = (
    onFulfilled: (value: { data: unknown; error: null }) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => {
    const data = table === "users" && selectArg.includes("email") ? tenantEmails : []
    return Promise.resolve({ data, error: null }).then(onFulfilled, onRejected)
  }
  return builder
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: authUser } }) },
    from: (table: string) => serverBuilder(table),
  })),
}))

/** Toda escrita do service client passa por aqui — é o que contamos. */
const inviteCalls: string[] = []
const insertedRows: Record<string, unknown>[] = []
let inviteFailsFor: string | null = null
let insertFailsFor: string | null = null

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    auth: {
      admin: {
        inviteUserByEmail: async (email: string) => {
          inviteCalls.push(email)
          if (inviteFailsFor === email) {
            return { data: { user: null }, error: { message: "E-mail já existe na plataforma" } }
          }
          return { data: { user: { id: `auth-${email}` } }, error: null }
        },
      },
    },
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        if (insertFailsFor === row.email) return { error: { message: "violação de RLS" } }
        insertedRows.push(row)
        return { error: null }
      },
    }),
  }),
}))

vi.mock("@/lib/audit", () => ({ logAdminAction: vi.fn(), logSuperAdminAction: vi.fn() }))
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }))

const { POST } = await import("../bulk-invite/route")

/* -------------------------------- Fixtures -------------------------------- */

function req(body: unknown) {
  return new Request("http://localhost/api/admin/users/bulk-invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const CSV = ["nome,email,papel", "Maria,maria@x.com,Estudante", "João,joao@x.com,Gestor"].join("\n")

beforeEach(() => {
  vi.clearAllMocks()
  authUser = { id: "adm-1" }
  actorProfile = {
    id: "adm-1",
    role: "admin",
    tenant_id: "tenant-1",
    user_roles: [{ role: "admin" }],
  }
  tenantEmails = []
  inviteCalls.length = 0
  insertedRows.length = 0
  inviteFailsFor = null
  insertFailsFor = null
})

/* ---------------------------------- Testes -------------------------------- */

describe("guard", () => {
  it("sem sessão, 401 e nenhum convite", async () => {
    authUser = null

    const res = await POST(req({ mode: "preview", csv: CSV }))

    expect(res.status).toBe(401)
    expect(inviteCalls).toHaveLength(0)
  })

  it("sem chapéu admin, 403 e nenhum convite", async () => {
    actorProfile = { id: "u-2", role: "student", tenant_id: "tenant-1", user_roles: [] }

    const res = await POST(req({ mode: "apply", csv: CSV, expected: 2 }))

    expect(res.status).toBe(403)
    expect(inviteCalls).toHaveLength(0)
  })
})

describe("preview — a pré-visualização NUNCA escreve", () => {
  it("devolve as contagens sem convidar ninguém", async () => {
    const res = await POST(req({ mode: "preview", csv: CSV }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.counts).toMatchObject({ total: 2, toCreate: 2 })
    expect(inviteCalls).toHaveLength(0)
    expect(insertedRows).toHaveLength(0)
  })

  it("marca quem já existe no tenant, e continua sem escrever", async () => {
    tenantEmails = [{ email: "maria@x.com" }]

    const json = await (await POST(req({ mode: "preview", csv: CSV }))).json()

    expect(json.counts).toMatchObject({ toCreate: 1, alreadyExists: 1 })
    expect(json.skipped[0]).toMatchObject({ email: "maria@x.com", reason: "already_exists" })
    expect(inviteCalls).toHaveLength(0)
  })

  it("arquivo ilegível vira 400 com motivo, não 500", async () => {
    const res = await POST(req({ mode: "preview", csv: "telefone\n999" }))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain("e-mail")
    expect(inviteCalls).toHaveLength(0)
  })
})

describe("apply — nada é criado sem ter sido confirmado em número", () => {
  it("cria exatamente o que a pré-visualização mostrou", async () => {
    const res = await POST(req({ mode: "apply", csv: CSV, expected: 2 }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(inviteCalls).toEqual(["maria@x.com", "joao@x.com"])
    expect(insertedRows.map((r) => r.email)).toEqual(["maria@x.com", "joao@x.com"])
    // O papel da planilha atravessa; e o estado do convite continua DERIVADO —
    // a linha nasce `active`, ninguém escreve "pendente" em `users.status`.
    expect(insertedRows[1]).toMatchObject({ role: "manager", status: "active" })
    expect(json.counts).toMatchObject({ created: 2, failed: 0 })
  })

  it("o número mudou desde a pré-visualização: 409 e ZERO criações", async () => {
    // Alguém convidou a Maria enquanto o admin olhava a tela.
    tenantEmails = [{ email: "maria@x.com" }]

    const res = await POST(req({ mode: "apply", csv: CSV, expected: 2 }))
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(inviteCalls).toHaveLength(0)
    expect(insertedRows).toHaveLength(0)
    // E devolve a foto NOVA, para o admin reconfirmar sobre o número certo.
    expect(json.counts).toMatchObject({ toCreate: 1, alreadyExists: 1 })
  })

  it("confirmar sobre a foto nova cria só quem sobrou", async () => {
    tenantEmails = [{ email: "maria@x.com" }]

    const res = await POST(req({ mode: "apply", csv: CSV, expected: 1 }))

    expect(res.status).toBe(200)
    expect(inviteCalls).toEqual(["joao@x.com"])
  })

  it("linha que falha no Auth volta como falha explícita, sem parar o lote", async () => {
    inviteFailsFor = "maria@x.com"

    const json = await (await POST(req({ mode: "apply", csv: CSV, expected: 2 }))).json()

    expect(json.failed).toHaveLength(1)
    expect(json.failed[0]).toMatchObject({ line: 2, email: "maria@x.com" })
    expect(json.failed[0].message).toContain("já existe na plataforma")
    // A outra pessoa foi criada: uma falha de dado de UMA linha não pode
    // silenciosamente cancelar as demais.
    expect(json.created.map((c: { email: string }) => c.email)).toEqual(["joao@x.com"])
  })

  it("convite enviado mas perfil não criado é reportado como tal, não como sucesso", async () => {
    insertFailsFor = "joao@x.com"

    const json = await (await POST(req({ mode: "apply", csv: CSV, expected: 2 }))).json()

    expect(json.created.map((c: { email: string }) => c.email)).toEqual(["maria@x.com"])
    expect(json.failed[0].message).toContain("falha ao criar perfil")
  })

  it("arquivo sem nada a criar não vira lote vazio silencioso", async () => {
    tenantEmails = [{ email: "maria@x.com" }, { email: "joao@x.com" }]

    const res = await POST(req({ mode: "apply", csv: CSV, expected: 0 }))

    expect(res.status).toBe(400)
    expect(inviteCalls).toHaveLength(0)
  })

  it("corpo sem `expected` é recusado — confirmar às cegas não é opção", async () => {
    const res = await POST(req({ mode: "apply", csv: CSV }))

    expect(res.status).toBe(400)
    expect(inviteCalls).toHaveLength(0)
  })
})
