import { beforeEach, describe, expect, it, vi } from "vitest"

// =============================================================================
// ÚLTIMO ACESSO — a leitura privilegiada de `auth.users` (CFG-2.3).
//
// O AC que protege produção é o 6: se o acesso privilegiado falhar, a coluna
// volta a "—" e a tela continua de pé. Um "último acesso" ausente é um
// inconveniente; a lista de usuários inteira caindo por causa dele é um
// incidente. Estes testes provam que a diferença entre os dois está no código,
// não na esperança.
//
// Também provam o least privilege (AC4): a API do GoTrue entrega 13 campos por
// usuário no fio (email, phone, identities, metadata...). Este accessor é a
// fronteira que os descarta — se algum dia ele deixar de projetar, o teste
// quebra aqui, não em produção.
// =============================================================================

/* ---------------------------------- Mocks --------------------------------- */

type ListUsersResult = { data: { users: unknown[] } | null; error: { message: string } | null }

let listUsersImpl: (args: { page: number; perPage: number }) => Promise<ListUsersResult>
let listUsersCalls: { page: number; perPage: number }[] = []
let createServiceClientImpl: () => unknown

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => createServiceClientImpl(),
}))

const { fetchLastSignInAt } = await import("../last-sign-in")

/* -------------------------------- Fixtures -------------------------------- */

/** Objeto como o GoTrue devolve de verdade: muito além de id + last_sign_in_at. */
function authUser(id: string, lastSignIn: string | null) {
  return {
    id,
    aud: "authenticated",
    role: "authenticated",
    email: `${id}@empresa.com.br`,
    email_confirmed_at: "2026-01-01T00:00:00Z",
    phone: "+5516999999999",
    confirmed_at: "2026-01-01T00:00:00Z",
    app_metadata: { provider: "email", tenant: "segredo" },
    user_metadata: { full_name: "Nome Completo" },
    identities: [{ provider: "email" }],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    is_anonymous: false,
    ...(lastSignIn === null ? {} : { last_sign_in_at: lastSignIn }),
  }
}

const DEFAULT_USERS = [
  authUser("u-a", "2026-07-27T11:13:05.889746Z"),
  authUser("u-b", null),
  authUser("u-c", "2026-07-24T19:22:16.594399Z"),
]

beforeEach(() => {
  listUsersCalls = []
  listUsersImpl = async (args) => {
    listUsersCalls.push(args)
    return { data: { users: DEFAULT_USERS }, error: null }
  }
  createServiceClientImpl = () => ({
    auth: {
      admin: { listUsers: (args: { page: number; perPage: number }) => listUsersImpl(args) },
    },
  })
})

/* ------------------------- AC6 — degradação graciosa ----------------------- */

describe("AC6 — o acesso privilegiado falha e a página continua de pé", () => {
  it("service role indisponível (createServiceClient lança) devolve mapa vazio, não lança", async () => {
    createServiceClientImpl = () => {
      throw new Error(
        "Missing Supabase service credentials (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)",
      )
    }

    await expect(fetchLastSignInAt(["u-a", "u-b"])).resolves.toEqual({})
  })

  it("erro devolvido pela API de Auth devolve mapa vazio, não lança", async () => {
    listUsersImpl = async () => ({ data: null, error: { message: "service unavailable" } })

    await expect(fetchLastSignInAt(["u-a", "u-b"])).resolves.toEqual({})
  })

  it("erro de rede (a chamada rejeita) devolve mapa vazio, não lança", async () => {
    listUsersImpl = async () => {
      throw new TypeError("fetch failed")
    }

    await expect(fetchLastSignInAt(["u-a", "u-b"])).resolves.toEqual({})
  })

  it("com o mapa vazio, a coluna cai em `null` — que é o '—' da tela", async () => {
    listUsersImpl = async () => ({ data: null, error: { message: "boom" } })

    const map = await fetchLastSignInAt(["u-a"])

    // Exatamente o que o loader faz: `signInMap[u.id] ?? null`.
    expect(map["u-a"] ?? null).toBeNull()
  })
})

/* --------------------------- AC2 — leitura em lote ------------------------- */

describe("AC2 — em lote, nunca uma consulta por usuário", () => {
  it("resolve 3 usuários com UMA chamada à API de Auth", async () => {
    const map = await fetchLastSignInAt(["u-a", "u-b", "u-c"])

    expect(listUsersCalls).toHaveLength(1)
    expect(map).toEqual({
      "u-a": "2026-07-27T11:13:05.889746Z",
      "u-b": null,
      "u-c": "2026-07-24T19:22:16.594399Z",
    })
  })

  it("lista vazia não toca no service role", async () => {
    let created = false
    createServiceClientImpl = () => {
      created = true
      return {}
    }

    await expect(fetchLastSignInAt([])).resolves.toEqual({})
    expect(created).toBe(false)
  })

  it("para de paginar assim que todos os ids pedidos foram resolvidos", async () => {
    listUsersImpl = async (args) => {
      listUsersCalls.push(args)
      // Página cheia: sozinha não sinalizaria fim da lista.
      const filler = Array.from({ length: 1000 - DEFAULT_USERS.length }, (_, i) =>
        authUser(`filler-${args.page}-${i}`, null),
      )
      return { data: { users: [...DEFAULT_USERS, ...filler] }, error: null }
    }

    await fetchLastSignInAt(["u-a", "u-b", "u-c"])

    expect(listUsersCalls).toHaveLength(1)
  })

  it("varre a página seguinte quando alguém pedido ainda não apareceu", async () => {
    listUsersImpl = async (args) => {
      listUsersCalls.push(args)
      const page1 = Array.from({ length: 1000 }, (_, i) => authUser(`outro-${i}`, null))
      return {
        data: { users: args.page === 1 ? page1 : [authUser("u-z", "2026-07-28T09:00:00Z")] },
        error: null,
      }
    }

    const map = await fetchLastSignInAt(["u-z"])

    expect(listUsersCalls.map((c) => c.page)).toEqual([1, 2])
    expect(map).toEqual({ "u-z": "2026-07-28T09:00:00Z" })
  })

  it("teto duro de páginas: nunca vira varredura infinita contra a Auth", async () => {
    listUsersImpl = async (args) => {
      listUsersCalls.push(args)
      // Nunca entrega quem foi pedido e nunca sinaliza fim: só o teto interrompe.
      return {
        data: {
          users: Array.from({ length: 1000 }, (_, i) => authUser(`x-${args.page}-${i}`, null)),
        },
        error: null,
      }
    }

    const map = await fetchLastSignInAt(["nunca-aparece"])

    expect(map).toEqual({})
    expect(listUsersCalls.length).toBeLessThanOrEqual(10)
  })
})

/* -------------------------- AC4 — least privilege -------------------------- */

describe("AC4 — só `id` e `last_sign_in_at` atravessam a fronteira", () => {
  it("nenhum outro campo do schema `auth` sai do accessor", async () => {
    const map = await fetchLastSignInAt(["u-a"])

    // O retorno é um mapa id -> data. Não há onde email, phone, identities ou
    // metadata se esconderem: os valores são string ou null, e nada mais.
    expect(Object.keys(map)).toEqual(["u-a"])
    for (const value of Object.values(map)) {
      expect(value === null || typeof value === "string").toBe(true)
    }
    expect(JSON.stringify(map)).not.toMatch(/empresa\.com\.br|phone|metadata|identities|segredo/)
  })

  it("não devolve usuários de `auth` que não estavam na lista pedida", async () => {
    const map = await fetchLastSignInAt(["u-a"])

    expect(map).toEqual({ "u-a": "2026-07-27T11:13:05.889746Z" })
    expect(map["u-b"]).toBeUndefined()
    expect(map["u-c"]).toBeUndefined()
  })
})
