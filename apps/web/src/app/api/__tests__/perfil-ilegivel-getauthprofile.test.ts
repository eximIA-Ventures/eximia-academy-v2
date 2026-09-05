import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// "NÃO TEM DIREITO" ≠ "NÃO DEU PARA VERIFICAR" — o 4º mecanismo: `getAuthProfile`.
// ---------------------------------------------------------------------------
// Aqui o defeito muda de lugar, e é por isso que ele sobreviveu a todos os censos:
// `getAuthProfile` (`lib/auth.ts`) **devolve o `error` corretamente**. Quem o
// descarta são os CHAMADORES — 95 arquivos que escrevem
//
//     const { user, profile } = await getAuthProfile()
//     if (!user || !profile) return 401/403
//
// sem nunca destructurar `error`. Uma leitura de perfil que FALHOU deixa `profile`
// nulo exatamente como um perfil que não existe, e as duas situações saem pela
// mesma porta.
//
// Destes 95, **22 são rotas de API** — onde a consequência é literal e observável:
// um status HTTP de negação permanente para um problema transitório. São essas 22
// que este arquivo trava. As demais (páginas e server actions) estão classificadas
// no relatório, não corrigidas nesta rodada.
//
// O contrato é o MESMO das outras três variantes (`api-role-guard`,
// `require-admin`, `super-admin-auth`): 503 + `Retry-After` quando a leitura
// falhou, e o 401/403 que a rota já tinha para tudo o mais — inclusive `PGRST116`,
// que é "não há perfil", não "não deu para ler".
//
// NENHUMA ESCRITA, NENHUMA REDE.
// ---------------------------------------------------------------------------

const ATOR = "11111111-1111-1111-1111-111111111111"
const TENANT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

/** O erro que o PostgREST devolve num timeout de statement. Transitório por definição. */
const ERRO_TRANSITORIO = {
  code: "57014",
  message: "canceling statement due to statement timeout",
  details: null,
  hint: null,
}

/** O "erro" de zero linhas do `.single()`. NÃO é indisponibilidade. */
const ERRO_ZERO_LINHAS = {
  code: "PGRST116",
  message: "JSON object requested, multiple (or no) rows returned",
  details: null,
  hint: null,
}

type Resultado = { data: unknown; error: unknown }
const VAZIO: Resultado = { data: [], error: null }

function clienteFake() {
  const construir = () => {
    // biome-ignore lint/suspicious/noExplicitAny: duplo de um builder sem tipo estável
    const elo: any = new Proxy(() => elo, {
      get(_alvo, prop) {
        if (prop === "then") {
          // biome-ignore lint/suspicious/noExplicitAny: assinatura de thenable
          return (ok: any, falha: any) => Promise.resolve(VAZIO).then(ok, falha)
        }
        if (prop === "single" || prop === "maybeSingle") return () => Promise.resolve(VAZIO)
        return () => elo
      },
      apply: () => elo,
    })
    return elo
  }
  return {
    auth: { getUser: async () => ({ data: { user: { id: ATOR } }, error: null }) },
    from: () => construir(),
    rpc: async () => VAZIO,
  }
}

/** Estado do perfil que o `getAuthProfile` mockado devolve, controlado por teste. */
let papelDoAtor: string | null = "admin"
let erroDePerfil: unknown = null

vi.mock("@/lib/auth", async (importarOriginal) => {
  const original = await importarOriginal<typeof import("@/lib/auth")>()
  return {
    ...original,
    // Só `getAuthProfile` é substituído. `resolveTenantId` e companhia seguem reais
    // — o alvo do teste é o que a ROTA faz com o `error`, não o que `lib/auth` faz.
    getAuthProfile: async () => ({
      user: papelDoAtor === null && erroDePerfil === null ? null : { id: ATOR },
      // `tenant_id` amarrado à coluna `role` pela constraint de banco
      // `users_super_admin_tenant_check` (migration `20260209000000`, viva):
      // `role = 'super_admin'` ⟺ `tenant_id IS NULL`. Dar tenant a um super_admin
      // seria montar uma linha que o banco recusa gravar — ficção verificando ficção.
      profile:
        papelDoAtor === null
          ? null
          : { role: papelDoAtor, tenant_id: papelDoAtor === "super_admin" ? null : TENANT },
      roles: papelDoAtor === null ? [] : [papelDoAtor],
      hasSubordinates: false,
      hasEnrollment: false,
      error: erroDePerfil,
      supabase: clienteFake(),
    }),
  }
})
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => clienteFake() }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => clienteFake() }))
vi.mock("@/lib/audit", () => ({ logAdminAction: async () => undefined }))
/**
 * O cookie do seletor de empresa vem PREENCHIDO de propósito.
 *
 * Sem ele, `resolveTenantId` não resolve empresa nenhuma para quem tem
 * `tenant_id` nulo — e `tenant_id` nulo é exatamente o estado do `super_admin`,
 * amarrado pela constraint de banco (ver `perfilComPapel` no arquivo irmão). O
 * efeito colateral seria uma asserção SOBRE-DETERMINADA: em
 * `admin/engagement/templates`, o `super_admin` sairia com 401 tanto por não
 * estar na lista de papéis quanto por não haver empresa resolvida, e o teste
 * ficaria verde mesmo se a lista de papéis mudasse.
 *
 * Com o cookie, a empresa sempre resolve, e a única razão que resta para uma
 * recusa é o PAPEL — que é o que este CP mede.
 */
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nome: string) => (nome === "x-sa-active-tenant" ? { value: TENANT } : undefined),
    set: () => undefined,
  }),
}))

import { POST as areaCursoVincular } from "../admin/areas/[areaId]/courses/route"
import { POST as adminCampanhaCriar } from "../admin/engagement/campaign/route"
import { GET as adminHistoricoLer } from "../admin/engagement/history/route"
import { PATCH as adminSugestaoDecidir } from "../admin/engagement/suggestions/[id]/route"
import { POST as adminSugestoesGerar } from "../admin/engagement/suggestions/generate/route"
import { GET as adminSugestoesLer } from "../admin/engagement/suggestions/route"
import {
  PATCH as adminModelosGravar,
  GET as adminModelosLer,
} from "../admin/engagement/templates/route"
import {
  DELETE as tenantAreaApagar,
  PATCH as tenantAreaEditar,
} from "../admin/tenants/[tenantId]/areas/[areaId]/route"
import { POST as tenantAreaCriar } from "../admin/tenants/[tenantId]/areas/route"
import { DELETE as tenantApagar, PATCH as tenantEditar } from "../admin/tenants/[tenantId]/route"
import { POST as tenantCriar } from "../admin/tenants/route"
import { POST as gestorNudge } from "../analytics/manager/nudge/route"
import { GET as gestorAnalytics } from "../analytics/manager/route"
import { POST as acaoRegistrar } from "../engagement/action/route"
import { PATCH as campanhaEditar, GET as campanhaLer } from "../engagement/campaign/[id]/route"
import { POST as campanhaCriar } from "../engagement/campaign/route"
import { GET as historicoLer } from "../engagement/history/route"
import { GET as visaoGeralLer } from "../engagement/overview/route"
import { GET as alunosLer } from "../engagement/students/route"
import { PATCH as modeloEditar } from "../engagement/templates/[id]/route"
import { GET as modelosLer } from "../engagement/templates/route"
import { POST as comentarioLider } from "../leader/comments/route"

const ctxArea = { params: Promise.resolve({ areaId: "44444444-4444-4444-4444-444444444444" }) }
const ctxTenant = { params: Promise.resolve({ tenantId: TENANT }) }
const ctxTenantArea = {
  params: Promise.resolve({ tenantId: TENANT, areaId: "44444444-4444-4444-4444-444444444444" }),
}
const ctxId = { params: Promise.resolve({ id: "77777777-7777-7777-7777-777777777777" }) }

function req(url: string, metodo = "GET", corpo?: unknown) {
  return new Request(url, {
    method: metodo,
    ...(corpo === undefined
      ? {}
      : { body: JSON.stringify(corpo), headers: { "content-type": "application/json" } }),
  })
}

/**
 * [CP] AS LISTAS DE PAPEL SÃO ASSERÇÕES, e nesta família há SEIS diferentes
 * convivendo — sendo uma delas de um único papel (`["manager"]`, em
 * `analytics/manager`) e outra de um papel que aparece em nenhuma outra
 * (`"leader"`, em `leader/comments`).
 *
 * Cada par abaixo foi lido do código em `HEAD`, rota a rota, e é exaustivo nos dois
 * sentidos dentro dos papéis que existem no sistema. Isso importa porque as listas
 * daqui divergem entre si de formas fáceis de trocar em silêncio: `super_admin`
 * está em cinco delas e FORA de `admin/engagement/*`; `instructor` entra em umas e
 * não em outras. Um teste com "um aceito e um recusado" ficaria verde com qualquer
 * uma das seis no lugar de qualquer outra.
 *
 * Isto NÃO é opinião sobre quem deveria ter direito: é o registro de quem já tinha.
 */
const PAPEIS = ["admin", "super_admin", "manager", "instructor", "student", "leader"]
const lista = (aceitos: string[]) => ({
  aceitos,
  recusados: PAPEIS.filter((p) => !aceitos.includes(p)),
})

const SO_SUPER = lista(["super_admin"])
const SO_GESTOR = lista(["manager"])
const SO_LIDER = lista(["leader"])
const ADMIN_INSTRUTOR = lista(["admin", "super_admin", "instructor"])
const ADMIN_GESTOR_SUPER = lista(["admin", "manager", "super_admin"])
const ADMIN_GESTOR_INSTRUTOR_SUPER = lista(["admin", "manager", "instructor", "super_admin"])
/** `admin/engagement/*` NÃO inclui `super_admin` — divergência real, transcrita. */
const ADMIN_GESTOR_INSTRUTOR = lista(["admin", "manager", "instructor"])

const ROTAS: Array<{
  nome: string
  chamar: () => Promise<Response>
  papeis: { aceitos: string[]; recusados: string[] }
  /**
   * Os DOIS status de negação que a rota já usava, e que NÃO são o mesmo:
   * `semPerfil` (o `if (!user || !profile)`, quase sempre 401) e `papelErrado`
   * (o `if (!hasAnyRole)`, quase sempre 403). Conflá-los é o erro que este
   * próprio teste cometeu na primeira escrita — e que a rodada vermelha expôs.
   */
  semPerfil: number
  papelErrado: number
}> = [
  {
    nome: "POST /api/admin/areas/[areaId]/courses",
    chamar: () => areaCursoVincular(req("http://t/a/c", "POST", { course_id: "c" }), ctxArea),
    papeis: ADMIN_INSTRUTOR,
    semPerfil: 403,
    papelErrado: 403,
  },
  {
    nome: "POST /api/admin/tenants",
    chamar: () => tenantCriar(req("http://t/tenants", "POST", { name: "T", slug: "t" })),
    papeis: SO_SUPER,
    semPerfil: 403,
    papelErrado: 403,
  },
  {
    nome: "PATCH /api/admin/tenants/[tenantId]",
    chamar: () => tenantEditar(req("http://t/tenants/x", "PATCH", { name: "T" }), ctxTenant),
    papeis: SO_SUPER,
    semPerfil: 403,
    papelErrado: 403,
  },
  {
    nome: "DELETE /api/admin/tenants/[tenantId]",
    chamar: () => tenantApagar(req("http://t/tenants/x", "DELETE"), ctxTenant),
    papeis: SO_SUPER,
    semPerfil: 403,
    papelErrado: 403,
  },
  {
    nome: "POST /api/admin/tenants/[tenantId]/areas",
    chamar: () =>
      tenantAreaCriar(req("http://t/t/areas", "POST", { name: "A", slug: "a" }), ctxTenant),
    papeis: SO_SUPER,
    semPerfil: 403,
    papelErrado: 403,
  },
  {
    nome: "PATCH /api/admin/tenants/[tenantId]/areas/[areaId]",
    chamar: () => tenantAreaEditar(req("http://t/t/a", "PATCH", { name: "A" }), ctxTenantArea),
    papeis: SO_SUPER,
    semPerfil: 403,
    papelErrado: 403,
  },
  {
    nome: "DELETE /api/admin/tenants/[tenantId]/areas/[areaId]",
    chamar: () => tenantAreaApagar(req("http://t/t/a", "DELETE"), ctxTenantArea),
    papeis: SO_SUPER,
    semPerfil: 403,
    papelErrado: 403,
  },
  {
    nome: "POST /api/admin/engagement/campaign",
    chamar: () => adminCampanhaCriar(req("http://t/ac", "POST", {})),
    papeis: ADMIN_GESTOR_SUPER,
    semPerfil: 401,
    papelErrado: 403,
  },
  {
    nome: "GET /api/admin/engagement/history",
    chamar: () => adminHistoricoLer(req("http://t/ah")),
    papeis: ADMIN_GESTOR_INSTRUTOR,
    semPerfil: 401,
    papelErrado: 403,
  },
  {
    nome: "GET /api/admin/engagement/suggestions",
    chamar: () => adminSugestoesLer(),
    papeis: ADMIN_GESTOR_INSTRUTOR,
    semPerfil: 401,
    papelErrado: 403,
  },
  {
    nome: "POST /api/admin/engagement/suggestions/generate",
    chamar: () => adminSugestoesGerar(),
    papeis: ADMIN_GESTOR_INSTRUTOR_SUPER,
    semPerfil: 401,
    papelErrado: 403,
  },
  {
    nome: "PATCH /api/admin/engagement/suggestions/[id]",
    chamar: () => adminSugestaoDecidir(req("http://t/as", "PATCH", { status: "approved" }), ctxId),
    papeis: ADMIN_GESTOR_INSTRUTOR_SUPER,
    semPerfil: 401,
    papelErrado: 403,
  },
  {
    nome: "GET /api/admin/engagement/templates",
    chamar: () => adminModelosLer(),
    papeis: lista(["admin", "manager"]),
    semPerfil: 401,
    papelErrado: 401,
  },
  {
    nome: "PATCH /api/admin/engagement/templates",
    chamar: () => adminModelosGravar(req("http://t/at", "PATCH", { id: "x" })),
    papeis: lista(["admin", "manager"]),
    semPerfil: 401,
    papelErrado: 401,
  },
  {
    nome: "POST /api/leader/comments",
    chamar: () => comentarioLider(req("http://t/lc", "POST", { body: "x" })),
    papeis: SO_LIDER,
    semPerfil: 401,
    papelErrado: 403,
  },
  {
    nome: "GET /api/engagement/students",
    chamar: () => alunosLer(req("http://t/es")),
    papeis: ADMIN_GESTOR_INSTRUTOR_SUPER,
    semPerfil: 401,
    papelErrado: 403,
  },
  {
    nome: "POST /api/engagement/action",
    chamar: () => acaoRegistrar(req("http://t/ea", "POST", {})),
    papeis: ADMIN_GESTOR_INSTRUTOR_SUPER,
    semPerfil: 401,
    papelErrado: 403,
  },
  {
    nome: "POST /api/engagement/campaign",
    chamar: () => campanhaCriar(req("http://t/ec", "POST", {})),
    papeis: ADMIN_GESTOR_INSTRUTOR_SUPER,
    semPerfil: 401,
    papelErrado: 403,
  },
  {
    nome: "GET /api/engagement/campaign/[id]",
    chamar: () => campanhaLer(req("http://t/ec/x"), ctxId),
    papeis: ADMIN_GESTOR_SUPER,
    semPerfil: 401,
    papelErrado: 403,
  },
  {
    nome: "PATCH /api/engagement/campaign/[id]",
    chamar: () => campanhaEditar(req("http://t/ec/x", "PATCH", {}), ctxId),
    papeis: ADMIN_GESTOR_SUPER,
    semPerfil: 401,
    papelErrado: 403,
  },
  {
    nome: "GET /api/engagement/history",
    chamar: () => historicoLer(req("http://t/eh")),
    papeis: ADMIN_GESTOR_INSTRUTOR_SUPER,
    semPerfil: 401,
    papelErrado: 403,
  },
  {
    nome: "GET /api/engagement/templates",
    chamar: () => modelosLer(),
    papeis: ADMIN_GESTOR_SUPER,
    semPerfil: 401,
    papelErrado: 403,
  },
  {
    nome: "PATCH /api/engagement/templates/[id]",
    chamar: () => modeloEditar(req("http://t/et/x", "PATCH", {}), ctxId),
    papeis: ADMIN_GESTOR_SUPER,
    semPerfil: 401,
    papelErrado: 403,
  },
  {
    nome: "GET /api/engagement/overview",
    chamar: () => visaoGeralLer(req("http://t/eo")),
    papeis: ADMIN_GESTOR_INSTRUTOR_SUPER,
    semPerfil: 401,
    papelErrado: 403,
  },
  {
    nome: "GET /api/analytics/manager",
    chamar: () => gestorAnalytics(req("http://t/am")),
    papeis: SO_GESTOR,
    semPerfil: 401,
    papelErrado: 403,
  },
  {
    nome: "POST /api/analytics/manager/nudge",
    chamar: () => gestorNudge(req("http://t/an", "POST", {})),
    papeis: SO_GESTOR,
    semPerfil: 401,
    papelErrado: 403,
  },
]

beforeEach(() => {
  papelDoAtor = "admin"
  erroDePerfil = null
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.spyOn(console, "warn").mockImplementation(() => {})
  vi.stubGlobal("fetch", async () => new Response("{}", { status: 502 }))
})

describe("getAuthProfile — o chamador descarta o erro e nega direito", () => {
  for (const rota of ROTAS) {
    it(`${rota.nome} — falha ao LER o perfil devolve 503, não ${rota.semPerfil}`, async () => {
      papelDoAtor = null
      erroDePerfil = ERRO_TRANSITORIO

      const resposta = await rota.chamar()

      expect(resposta.status).toBe(503)
      expect(resposta.headers.get("Retry-After")).toBe("5")
      expect(await resposta.json()).toEqual({ error: "profile_check_unavailable" })
    })

    it(`${rota.nome} — zero linhas CONTINUA ${rota.semPerfil} (o perfil não existe)`, async () => {
      papelDoAtor = null
      erroDePerfil = ERRO_ZERO_LINHAS

      expect((await rota.chamar()).status).toBe(rota.semPerfil)
    })

    it(`${rota.nome} — [CP] matriz de papéis, papel a papel`, async () => {
      for (const papel of rota.papeis.recusados) {
        papelDoAtor = papel
        expect(`${papel}:${(await rota.chamar()).status}`).toBe(`${papel}:${rota.papelErrado}`)
      }
      for (const papel of rota.papeis.aceitos) {
        papelDoAtor = papel
        const status = (await rota.chamar()).status
        expect(`${papel}:${status === rota.papelErrado ? "BARRADO" : "passou"}`).toBe(
          `${papel}:passou`,
        )
      }
    })
  }
})
