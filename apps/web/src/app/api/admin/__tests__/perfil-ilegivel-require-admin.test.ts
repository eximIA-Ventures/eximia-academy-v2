import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// "NÃO TEM DIREITO" ≠ "NÃO DEU PARA VERIFICAR" — a família do `requireAdmin`.
// ---------------------------------------------------------------------------
// Mesmo defeito das 47 rotas de FIX-B/B2/B3/B4, num helper DIFERENTE e por isso
// invisível a todos os censos anteriores: `lib/api-auth/require-admin.ts` escreve
//
//     const { data } = await supabase.from("users")...single()
//     if (!data) return { user, profile: null }
//
// enquanto o helper irmão escrevia `const { data: profile }`. As três varreduras
// anteriores procuraram a GRAFIA, não o gesto — e passaram ao largo. Vinte rotas
// dependem deste helper, e todas traduzem `profile: null` em 403.
//
// O que estes testes travam:
//
//   1. Leitura de perfil que FALHOU (timeout de statement) devolve 503 com
//      `Retry-After` — nunca 403. É o mesmo contrato de `lib/api-role-guard.ts`,
//      DELIBERADAMENTE o mesmo: um terceiro dialeto trocaria um defeito uniforme
//      por defeitos divergentes.
//   2. Zero linhas (`PGRST116`) CONTINUA sendo 403. Não é indisponibilidade: a
//      leitura aconteceu e a resposta é "não há perfil". Tratá-la como 503
//      esconderia um usuário órfão atrás de um "tente de novo" eterno.
//   3. [CP] A MATRIZ DE PAPÉIS, papel a papel, nos dois conjuntos que convivem
//      aqui. Ver o comentário de `MATRIZ` abaixo.
//
// NENHUMA ESCRITA, NENHUMA REDE: o cliente Supabase é duplo em memória, `fetch`
// está stubado e auditoria/admin-API estão mockadas.
// ---------------------------------------------------------------------------

const ATOR = "11111111-1111-1111-1111-111111111111"
const ALVO = "22222222-2222-2222-2222-222222222222"
const TENANT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

/** O erro que o PostgREST devolve num timeout de statement. Transitório por definição. */
const ERRO_TRANSITORIO = {
  code: "57014",
  message: "canceling statement due to statement timeout",
  details: null,
  hint: null,
}

/** O "erro" de zero linhas do `.single()`. NÃO é indisponibilidade: o perfil não existe. */
const ERRO_ZERO_LINHAS = {
  code: "PGRST116",
  message: "JSON object requested, multiple (or no) rows returned",
  details: null,
  hint: null,
}

type Resultado = { data: unknown; error: unknown }

let leituraDeUsers: Resultado = { data: null, error: null }
let usuarioAutenticado: { id: string } | null = { id: ATOR }

/**
 * Linha de `users` como o helper a lê: colunas + o embed de chapéus. O papel entra
 * nos DOIS eixos (coluna singular e `user_roles`) porque o helper decide pelo
 * chapéu e só cai na coluna quando não há chapéu nenhum.
 *
 * `tenant_id` NÃO é livre: o banco tem uma constraint que o amarra à coluna `role`
 * (`users_super_admin_tenant_check`, migration `20260209000000`, nunca derrubada):
 *
 *     CHECK ((role = 'super_admin' AND tenant_id IS NULL)
 *         OR (role != 'super_admin' AND tenant_id IS NOT NULL))
 *
 * É uma BICONDICIONAL: `role = 'super_admin'` ⟺ `tenant_id IS NULL`. A primeira
 * escrita desta fixture dava `tenant_id: TENANT` a TODOS os papéis, inclusive
 * `super_admin` — uma linha que o banco **recusa gravar**. O veredito não mudava,
 * mas um caso que não pode existir não prova nada sobre o que existe.
 *
 * A constraint é sobre a COLUNA, não sobre os chapéus: um `users.role = 'instructor'`
 * com chapéu `super_admin` em `user_roles` é legal e tem tenant. Como aqui os dois
 * eixos são o mesmo papel, a amarra vale.
 */
function perfilComPapel(papel: string): Resultado {
  return {
    data: {
      id: ATOR,
      role: papel,
      tenant_id: papel === "super_admin" ? null : TENANT,
      email: "ator@exemplo.test",
      status: "active",
      full_name: "Ator",
      report_name: null,
      user_roles: [{ role: papel }],
    },
    error: null,
  }
}

/** Resultado das leituras que NÃO são `users`: vazio e sem erro. */
const OUTRAS_TABELAS: Resultado = { data: [], error: null }

function clienteFake() {
  const construir = (tabela: string) => {
    const alvo: Resultado = tabela === "users" ? leituraDeUsers : OUTRAS_TABELAS
    // biome-ignore lint/suspicious/noExplicitAny: duplo de um builder sem tipo estável
    const elo: any = new Proxy(() => elo, {
      get(_alvoProxy, prop) {
        if (prop === "then") {
          // biome-ignore lint/suspicious/noExplicitAny: assinatura de thenable
          return (ok: any, falha: any) => Promise.resolve(alvo).then(ok, falha)
        }
        if (prop === "single" || prop === "maybeSingle") return () => Promise.resolve(alvo)
        return () => elo
      },
      apply: () => elo,
    })
    return elo
  }

  return {
    auth: {
      getUser: async () => ({ data: { user: usuarioAutenticado }, error: null }),
      admin: {
        generateLink: async () => ({ data: null, error: { message: "stub" } }),
        deleteUser: async () => ({ data: null, error: null }),
        listUsers: async () => ({ data: { users: [] }, error: null }),
      },
    },
    from: (tabela: string) => construir(tabela),
  }
}

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => clienteFake() }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => clienteFake() }))
vi.mock("@/lib/audit", () => ({ logAdminAction: async () => undefined }))
vi.mock("@/lib/feature-gate", () => ({ requireFeature: async () => null }))
vi.mock("@/lib/webhooks", () => ({ signPayload: () => "sig" }))
vi.mock("@/app/(platform)/admin/users/auth-accounts", () => ({
  fetchAuthAccounts: async () => ({}),
}))
/**
 * Cookie do seletor de empresa PREENCHIDO — pelo mesmo motivo do arquivo irmão
 * (`api/__tests__/perfil-ilegivel-getauthprofile.test.ts`): o `super_admin` tem
 * `tenant_id` nulo por constraint de banco, e sem o cookie ele não resolveria
 * empresa nenhuma em `departments/_context.ts` e `invites/target.ts`. A recusa
 * por falta de empresa se somaria à recusa por papel, e o CP deixaria de medir
 * só o papel. É também o estado REAL de produção: admin global opera a empresa
 * escolhida no seletor.
 */
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nome: string) => (nome === "x-sa-active-tenant" ? { value: TENANT } : undefined),
    set: () => undefined,
  }),
}))

import { POST as chaveRotacionar } from "../api-keys/[keyId]/rotate/route"
import {
  DELETE as chaveApagar,
  PATCH as chaveEditar,
  GET as chaveObter,
} from "../api-keys/[keyId]/route"
import { GET as chaveUso } from "../api-keys/[keyId]/usage/route"
import { POST as chavesCriar, GET as chavesListar } from "../api-keys/route"
import { DELETE as areaApagar, PATCH as areaEditar } from "../areas/[areaId]/route"
import {
  POST as areaUsuarioAdicionar,
  DELETE as areaUsuarioRemover,
  GET as areaUsuariosListar,
} from "../areas/[areaId]/users/route"
import { POST as areasCriar, GET as areasListar } from "../areas/route"
import { GET as auditoriaListar } from "../audit-log/route"
import { POST as departamentoPresenca } from "../departments/[departmentId]/presence/route"
import { PATCH as departamentoEditar } from "../departments/[departmentId]/route"
import { POST as departamentoCriar } from "../departments/route"
import { POST as trocarTenant } from "../switch-tenant/route"
import {
  PATCH as permissoesInstrutorGravar,
  GET as permissoesInstrutorLer,
} from "../users/[userId]/instructor-permissions/route"
import { POST as reenviarConvite } from "../users/[userId]/resend-invite/route"
import { POST as redefinirSenha } from "../users/[userId]/reset-password/route"
import { POST as revogarConvite } from "../users/[userId]/revoke-invite/route"
import { POST as convitesEmLote } from "../users/bulk-invite/route"
import { GET as webhookEntregas } from "../webhooks/[webhookId]/deliveries/route"
import {
  DELETE as webhookApagar,
  PATCH as webhookEditar,
  GET as webhookObter,
} from "../webhooks/[webhookId]/route"
import { POST as webhookTestar } from "../webhooks/[webhookId]/test/route"
import { POST as webhooksCriar, GET as webhooksListar } from "../webhooks/route"

const ctxChave = { params: Promise.resolve({ keyId: "33333333-3333-3333-3333-333333333333" }) }
const ctxArea = { params: Promise.resolve({ areaId: "44444444-4444-4444-4444-444444444444" }) }
const ctxWebhook = {
  params: Promise.resolve({ webhookId: "55555555-5555-5555-5555-555555555555" }),
}
const ctxUsuario = { params: Promise.resolve({ userId: ALVO }) }
const ctxDepartamento = {
  params: Promise.resolve({ departmentId: "66666666-6666-6666-6666-666666666666" }),
}

function req(url: string, metodo = "GET", corpo?: unknown) {
  return new Request(url, {
    method: metodo,
    ...(corpo === undefined
      ? {}
      : { body: JSON.stringify(corpo), headers: { "content-type": "application/json" } }),
  })
}

/**
 * [CP] A LISTA DE PAPÉIS É ELA PRÓPRIA UMA ASSERÇÃO.
 *
 * Duas listas convivem neste helper — `ADMIN_HATS` (`admin`, `super_admin`) e
 * `ADMIN_OR_MANAGER_HATS` (as duas + `manager`) — e as rotas escolhem uma delas
 * só pelo nome da função que importam. Trocar `requireAdmin` por
 * `requireAdminOrManager` numa rota é uma linha, ALARGA o acesso, e um teste com
 * "um papel aceito e um recusado" fica verde nos dois casos.
 *
 * `manager` é o eixo: é o único papel que DISTINGUE as duas listas, e por isso o
 * único que mata o mutante. Ele aparece nas duas colunas — recusado nas rotas de
 * admin, aceito nas de admin-ou-gestor — e cada papel restante é experimentado
 * explicitamente nos dois sentidos.
 *
 * Isto NÃO é opinião sobre quem deveria ter direito: é o registro de quem já tinha,
 * conferido contra `HEAD` antes da correção.
 */
const ADMIN = {
  aceitos: ["admin", "super_admin"],
  recusados: ["manager", "instructor", "student", "leader"],
}
const ADMIN_OU_GESTOR = {
  aceitos: ["admin", "super_admin", "manager"],
  recusados: ["instructor", "student", "leader"],
}

const ROTAS: Array<{
  nome: string
  chamar: () => Promise<Response>
  papeis: { aceitos: string[]; recusados: string[] }
}> = [
  {
    nome: "GET /api/admin/api-keys",
    chamar: () => chavesListar(req("http://t/api/admin/api-keys")),
    papeis: ADMIN,
  },
  {
    nome: "POST /api/admin/api-keys",
    chamar: () => chavesCriar(req("http://t/api/admin/api-keys", "POST", { name: "x" })),
    papeis: ADMIN,
  },
  {
    nome: "GET /api/admin/api-keys/[keyId]",
    chamar: () => chaveObter(req("http://t/k"), ctxChave),
    papeis: ADMIN,
  },
  {
    nome: "PATCH /api/admin/api-keys/[keyId]",
    chamar: () => chaveEditar(req("http://t/k", "PATCH", { name: "y" }), ctxChave),
    papeis: ADMIN,
  },
  {
    nome: "DELETE /api/admin/api-keys/[keyId]",
    chamar: () => chaveApagar(req("http://t/k", "DELETE"), ctxChave),
    papeis: ADMIN,
  },
  {
    nome: "POST /api/admin/api-keys/[keyId]/rotate",
    chamar: () => chaveRotacionar(req("http://t/k/rotate", "POST"), ctxChave),
    papeis: ADMIN,
  },
  {
    nome: "GET /api/admin/api-keys/[keyId]/usage",
    chamar: () => chaveUso(req("http://t/k/usage"), ctxChave),
    papeis: ADMIN,
  },
  {
    nome: "GET /api/admin/areas",
    chamar: () => areasListar(),
    papeis: ADMIN,
  },
  {
    nome: "POST /api/admin/areas",
    chamar: () => areasCriar(req("http://t/areas", "POST", { name: "A", slug: "a" })),
    papeis: ADMIN,
  },
  {
    nome: "PATCH /api/admin/areas/[areaId]",
    chamar: () => areaEditar(req("http://t/areas/x", "PATCH", { name: "B" }), ctxArea),
    papeis: ADMIN,
  },
  {
    nome: "DELETE /api/admin/areas/[areaId]",
    chamar: () => areaApagar(req("http://t/areas/x", "DELETE"), ctxArea),
    papeis: ADMIN,
  },
  {
    nome: "GET /api/admin/areas/[areaId]/users",
    chamar: () => areaUsuariosListar(req("http://t/areas/x/users"), ctxArea),
    papeis: ADMIN_OU_GESTOR,
  },
  {
    nome: "POST /api/admin/areas/[areaId]/users",
    chamar: () =>
      areaUsuarioAdicionar(req("http://t/areas/x/users", "POST", { user_id: ALVO }), ctxArea),
    papeis: ADMIN_OU_GESTOR,
  },
  {
    nome: "DELETE /api/admin/areas/[areaId]/users",
    chamar: () =>
      areaUsuarioRemover(req(`http://t/areas/x/users?user_id=${ALVO}`, "DELETE"), ctxArea),
    papeis: ADMIN_OU_GESTOR,
  },
  {
    nome: "GET /api/admin/audit-log",
    chamar: () => auditoriaListar(req("http://t/api/admin/audit-log")),
    papeis: ADMIN,
  },
  {
    nome: "POST /api/admin/departments",
    chamar: () =>
      departamentoCriar(req("http://t/departments", "POST", { name: "D", area_id: null })),
    papeis: ADMIN,
  },
  {
    nome: "PATCH /api/admin/departments/[departmentId]",
    chamar: () =>
      departamentoEditar(req("http://t/departments/x", "PATCH", { name: "E" }), ctxDepartamento),
    papeis: ADMIN,
  },
  {
    nome: "POST /api/admin/departments/[departmentId]/presence",
    chamar: () =>
      departamentoPresenca(req("http://t/departments/x/presence", "POST", {}), ctxDepartamento),
    papeis: ADMIN,
  },
  {
    nome: "GET /api/admin/users/[userId]/instructor-permissions",
    chamar: () => permissoesInstrutorLer(req("http://t/u/perm"), ctxUsuario),
    papeis: ADMIN_OU_GESTOR,
  },
  {
    nome: "PATCH /api/admin/users/[userId]/instructor-permissions",
    chamar: () => permissoesInstrutorGravar(req("http://t/u/perm", "PATCH", {}), ctxUsuario),
    papeis: ADMIN_OU_GESTOR,
  },
  {
    nome: "POST /api/admin/users/[userId]/reset-password",
    chamar: () => redefinirSenha(req("http://t/u/reset", "POST"), ctxUsuario),
    papeis: ADMIN,
  },
  {
    nome: "POST /api/admin/users/bulk-invite",
    chamar: () => convitesEmLote(req("http://t/bulk", "POST", { rows: [] })),
    papeis: ADMIN,
  },
  {
    nome: "POST /api/admin/users/[userId]/resend-invite",
    chamar: () => reenviarConvite(req("http://t/u/resend", "POST"), ctxUsuario),
    papeis: ADMIN,
  },
  {
    nome: "POST /api/admin/users/[userId]/revoke-invite",
    chamar: () => revogarConvite(req("http://t/u/revoke", "POST"), ctxUsuario),
    papeis: ADMIN,
  },
  {
    nome: "GET /api/admin/webhooks",
    chamar: () => webhooksListar(req("http://t/webhooks")),
    papeis: ADMIN,
  },
  {
    nome: "POST /api/admin/webhooks",
    chamar: () =>
      webhooksCriar(req("http://t/webhooks", "POST", { url: "https://x.test", events: ["a"] })),
    papeis: ADMIN,
  },
  {
    nome: "GET /api/admin/webhooks/[webhookId]",
    chamar: () => webhookObter(req("http://t/webhooks/x"), ctxWebhook),
    papeis: ADMIN,
  },
  {
    nome: "PATCH /api/admin/webhooks/[webhookId]",
    chamar: () => webhookEditar(req("http://t/webhooks/x", "PATCH", { active: false }), ctxWebhook),
    papeis: ADMIN,
  },
  {
    nome: "DELETE /api/admin/webhooks/[webhookId]",
    chamar: () => webhookApagar(req("http://t/webhooks/x", "DELETE"), ctxWebhook),
    papeis: ADMIN,
  },
  {
    nome: "GET /api/admin/webhooks/[webhookId]/deliveries",
    chamar: () => webhookEntregas(req("http://t/webhooks/x/deliveries"), ctxWebhook),
    papeis: ADMIN,
  },
  {
    nome: "POST /api/admin/webhooks/[webhookId]/test",
    chamar: () => webhookTestar(req("http://t/webhooks/x/test", "POST"), ctxWebhook),
    papeis: ADMIN,
  },
]

/**
 * `switch-tenant` está fora de `ROTAS` porque usa o OUTRO helper
 * (`lib/super-admin-auth.ts`) e porque o desfecho sem sessão dela é 403, não 401.
 * Tem bloco próprio no fim.
 */

beforeEach(() => {
  usuarioAutenticado = { id: ATOR }
  leituraDeUsers = perfilComPapel("admin")
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.spyOn(console, "warn").mockImplementation(() => {})
  vi.stubGlobal("fetch", async () => new Response("{}", { status: 502 }))
})

describe("requireAdmin — perfil ilegível não é negação de direito", () => {
  for (const rota of ROTAS) {
    it(`${rota.nome} — falha ao LER o perfil devolve 503, não 403`, async () => {
      leituraDeUsers = { data: null, error: ERRO_TRANSITORIO }

      const resposta = await rota.chamar()

      expect(resposta.status).toBe(503)
      expect(resposta.headers.get("Retry-After")).toBe("5")
      expect(await resposta.json()).toEqual({ error: "profile_check_unavailable" })
    })

    it(`${rota.nome} — zero linhas CONTINUA 403 (o perfil não existe)`, async () => {
      leituraDeUsers = { data: null, error: ERRO_ZERO_LINHAS }

      expect((await rota.chamar()).status).toBe(403)
    })

    it(`${rota.nome} — [CP] matriz de papéis, papel a papel`, async () => {
      for (const papel of rota.papeis.recusados) {
        leituraDeUsers = perfilComPapel(papel)
        expect(`${papel}:${(await rota.chamar()).status}`).toBe(`${papel}:403`)
      }
      for (const papel of rota.papeis.aceitos) {
        leituraDeUsers = perfilComPapel(papel)
        const status = (await rota.chamar()).status
        expect(`${papel}:${status === 403 ? "BARRADO" : "passou"}`).toBe(`${papel}:passou`)
      }
    })
  }
})

describe("requireSuperAdmin — o mesmo defeito no helper de super admin", () => {
  const chamar = () => trocarTenant(req("http://t/switch", "POST", { tenantId: TENANT }))

  it("POST /api/admin/switch-tenant — falha ao LER o perfil devolve 503, não 403", async () => {
    leituraDeUsers = { data: null, error: ERRO_TRANSITORIO }

    const resposta = await chamar()

    expect(resposta.status).toBe(503)
    expect(resposta.headers.get("Retry-After")).toBe("5")
    expect(await resposta.json()).toEqual({ error: "profile_check_unavailable" })
  })

  it("POST /api/admin/switch-tenant — zero linhas CONTINUA 403", async () => {
    leituraDeUsers = { data: null, error: ERRO_ZERO_LINHAS }

    expect((await chamar()).status).toBe(403)
  })

  it("POST /api/admin/switch-tenant — [CP] só super_admin passa", async () => {
    for (const papel of ["admin", "manager", "instructor", "student"]) {
      leituraDeUsers = perfilComPapel(papel)
      expect(`${papel}:${(await chamar()).status}`).toBe(`${papel}:403`)
    }
    leituraDeUsers = perfilComPapel("super_admin")
    expect((await chamar()).status).not.toBe(403)
  })

  it("POST /api/admin/switch-tenant — sem sessão CONTINUA 403 (contrato preservado)", async () => {
    // Colapso 401→403 preservado DE PROPÓSITO: é outro defeito, e arrumá-lo de
    // carona esconderia uma mudança de contrato dentro de um fix de erro de
    // leitura. Registrado no relatório, não corrigido aqui.
    usuarioAutenticado = null

    expect((await chamar()).status).toBe(403)
  })
})
