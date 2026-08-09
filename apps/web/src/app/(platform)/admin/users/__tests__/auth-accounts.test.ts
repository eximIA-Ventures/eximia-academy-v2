import { beforeEach, describe, expect, it, vi } from "vitest"

// =============================================================================
// ACCESSOR DE CONTAS DO AUTH (CFG-2.2, AC1) — a fronteira do schema `auth`.
//
// Este é o módulo que a CFG-2.3 criou para "último acesso" e que a CFG-2.2
// generalizou: as duas informações saem do MESMO objeto do GoTrue, então saem da
// MESMA chamada. O teste abaixo é o que impede alguém de "resolver" um requisito
// futuro abrindo uma segunda varredura paginada contra a API de Auth.
//
// E prova o least privilege: `listUsers` traz 13 campos por conta; daqui saem 3.
// =============================================================================

/* ---------------------------------- Mocks --------------------------------- */

type ListUsersResult = { data: { users: unknown[] } | null; error: { message: string } | null }

let listUsersImpl: (args: { page: number; perPage: number }) => Promise<ListUsersResult>
let listUsersCalls: { page: number; perPage: number }[] = []
let createServiceClientImpl: () => unknown

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => createServiceClientImpl(),
}))

const { fetchAuthAccounts } = await import("../auth-accounts")
const { fetchLastSignInAt } = await import("../last-sign-in")

/* -------------------------------- Fixtures -------------------------------- */

/** Objeto como o GoTrue devolve de verdade: muito além dos 3 campos que usamos. */
function authUser(
  id: string,
  facts: { lastSignIn?: string | null; invitedAt?: string | null; confirmedAt?: string | null },
) {
  return {
    id,
    aud: "authenticated",
    role: "authenticated",
    email: `${id}@empresa.com.br`,
    phone: "+5516999999999",
    app_metadata: { provider: "email", tenant: "segredo" },
    user_metadata: { full_name: "Nome Completo", role: "admin" },
    identities: [{ provider: "email" }],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    is_anonymous: false,
    ...(facts.lastSignIn ? { last_sign_in_at: facts.lastSignIn } : {}),
    ...(facts.invitedAt ? { invited_at: facts.invitedAt } : {}),
    ...(facts.confirmedAt ? { confirmed_at: facts.confirmedAt } : {}),
  }
}

/** Quem aceitou o convite. */
const ACEITOU = authUser("u-aceitou", {
  lastSignIn: "2026-07-27T11:13:05Z",
  invitedAt: "2026-07-01T10:00:00Z",
  confirmedAt: "2026-07-02T09:00:00Z",
})
/** Quem foi convidado e nunca abriu o e-mail. */
const PENDENTE = authUser("u-pendente", { invitedAt: "2026-07-26T10:00:00Z" })
/** Quem entrou por outro caminho (sem convite). */
const SEM_CONVITE = authUser("u-direto", {
  lastSignIn: "2026-07-20T08:00:00Z",
  confirmedAt: "2026-05-01T08:00:00Z",
})

beforeEach(() => {
  listUsersCalls = []
  listUsersImpl = async (args) => {
    listUsersCalls.push(args)
    return { data: { users: [ACEITOU, PENDENTE, SEM_CONVITE] }, error: null }
  }
  createServiceClientImpl = () => ({
    auth: {
      admin: { listUsers: (args: { page: number; perPage: number }) => listUsersImpl(args) },
    },
  })
})

/* ---------------------------------- Testes -------------------------------- */

describe("AC1 — os 3 fatos, numa chamada só", () => {
  it("projeta último acesso, convite e aceite para os ids pedidos", async () => {
    const map = await fetchAuthAccounts(["u-aceitou", "u-pendente", "u-direto"])

    expect(listUsersCalls).toHaveLength(1)
    expect(map).toEqual({
      "u-aceitou": {
        last_sign_in_at: "2026-07-27T11:13:05Z",
        invited_at: "2026-07-01T10:00:00Z",
        confirmed_at: "2026-07-02T09:00:00Z",
      },
      "u-pendente": {
        last_sign_in_at: null,
        invited_at: "2026-07-26T10:00:00Z",
        confirmed_at: null,
      },
      "u-direto": {
        last_sign_in_at: "2026-07-20T08:00:00Z",
        invited_at: null,
        confirmed_at: "2026-05-01T08:00:00Z",
      },
    })
  })

  it("aceita `email_confirmed_at` quando o projeto não devolve `confirmed_at`", async () => {
    listUsersImpl = async () => ({
      data: {
        users: [
          {
            id: "u-antigo",
            invited_at: "2026-01-01T00:00:00Z",
            email_confirmed_at: "2026-01-02T00:00:00Z",
          },
        ],
      },
      error: null,
    })

    const map = await fetchAuthAccounts(["u-antigo"])

    // Ler "nunca aceitou" sobre quem aceitou seria oferecer revogar a conta de
    // alguém que já usa o produto.
    expect(map["u-antigo"]?.confirmed_at).toBe("2026-01-02T00:00:00Z")
  })

  it("'último acesso' continua saindo do MESMO accessor, sem varredura extra", async () => {
    const map = await fetchLastSignInAt(["u-aceitou", "u-pendente"])

    expect(listUsersCalls).toHaveLength(1)
    expect(map).toEqual({ "u-aceitou": "2026-07-27T11:13:05Z", "u-pendente": null })
  })

  it("lista vazia não toca no service role", async () => {
    let created = false
    createServiceClientImpl = () => {
      created = true
      return {}
    }

    await expect(fetchAuthAccounts([])).resolves.toEqual({})
    expect(created).toBe(false)
  })
})

describe("AC1 — least privilege: nada mais do schema `auth` atravessa", () => {
  it("email, phone, identities e metadata ficam do lado de lá", async () => {
    const map = await fetchAuthAccounts(["u-aceitou"])

    expect(Object.keys(map["u-aceitou"] ?? {}).sort()).toEqual([
      "confirmed_at",
      "invited_at",
      "last_sign_in_at",
    ])
    expect(JSON.stringify(map)).not.toMatch(/empresa\.com\.br|phone|metadata|identities|segredo/)
  })

  it("não devolve contas que não estavam na lista pedida", async () => {
    const map = await fetchAuthAccounts(["u-pendente"])

    expect(Object.keys(map)).toEqual(["u-pendente"])
  })
})

describe("AC9 — o Auth cai e a página continua de pé", () => {
  it("service role ausente devolve mapa vazio, não lança", async () => {
    createServiceClientImpl = () => {
      throw new Error("Missing Supabase service credentials")
    }

    await expect(fetchAuthAccounts(["u-pendente"])).resolves.toEqual({})
  })

  it("erro devolvido pela API de Auth devolve mapa vazio, não lança", async () => {
    listUsersImpl = async () => ({ data: null, error: { message: "service unavailable" } })

    await expect(fetchAuthAccounts(["u-pendente"])).resolves.toEqual({})
  })

  it("erro de rede devolve mapa vazio, não lança", async () => {
    listUsersImpl = async () => {
      throw new TypeError("fetch failed")
    }

    await expect(fetchAuthAccounts(["u-pendente"])).resolves.toEqual({})
  })
})

describe("AC1 — paginação com teto (nunca varredura infinita)", () => {
  it("para assim que todos os pedidos foram resolvidos", async () => {
    listUsersImpl = async (args) => {
      listUsersCalls.push(args)
      const filler = Array.from({ length: 997 }, (_, i) => authUser(`filler-${args.page}-${i}`, {}))
      return { data: { users: [ACEITOU, PENDENTE, SEM_CONVITE, ...filler] }, error: null }
    }

    await fetchAuthAccounts(["u-aceitou", "u-pendente", "u-direto"])

    expect(listUsersCalls).toHaveLength(1)
  })

  it("vai à página seguinte quando alguém pedido ainda não apareceu", async () => {
    listUsersImpl = async (args) => {
      listUsersCalls.push(args)
      const page1 = Array.from({ length: 1000 }, (_, i) => authUser(`outro-${i}`, {}))
      return {
        data: {
          users: args.page === 1 ? page1 : [authUser("u-z", { invitedAt: "2026-07-28T09:00:00Z" })],
        },
        error: null,
      }
    }

    const map = await fetchAuthAccounts(["u-z"])

    expect(listUsersCalls.map((c) => c.page)).toEqual([1, 2])
    expect(map["u-z"]?.invited_at).toBe("2026-07-28T09:00:00Z")
  })

  it("teto duro de 10 páginas", async () => {
    listUsersImpl = async (args) => {
      listUsersCalls.push(args)
      return {
        data: {
          users: Array.from({ length: 1000 }, (_, i) => authUser(`x-${args.page}-${i}`, {})),
        },
        error: null,
      }
    }

    const map = await fetchAuthAccounts(["nunca-aparece"])

    expect(map).toEqual({})
    expect(listUsersCalls.length).toBeLessThanOrEqual(10)
  })
})
