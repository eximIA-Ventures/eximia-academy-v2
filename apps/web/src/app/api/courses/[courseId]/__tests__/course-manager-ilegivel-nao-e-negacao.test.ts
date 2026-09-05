import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// `enrich` e `export` — as duas rotas que dependem de `requireCourseManager`.
// ---------------------------------------------------------------------------
// Ambas traduzem `ok:false` em 403, sem perguntar POR QUE. Quando o terceiro
// estado (não deu para verificar) nasce no guard, é aqui que ele morre se não
// for propagado: o guard passa a distinguir e o chamador volta a colapsar — o
// defeito reaparece um andar acima, com aparência de corrigido.
//
// Estas rotas são o par testável dos 16 chamadores; os outros 14 são páginas RSC
// e server actions, varridos por régua e pelo compilador (ver FIX-B8).
// ---------------------------------------------------------------------------

const USUARIO = "11111111-1111-1111-1111-111111111111"

const ERRO_TRANSITORIO = {
  code: "57014",
  message: "canceling statement due to statement timeout",
  details: null,
  hint: null,
}

const ERRO_ZERO_LINHAS = {
  code: "PGRST116",
  message: "JSON object requested, multiple (or no) rows returned",
  details: null,
  hint: null,
}

type Resultado = { data: unknown; error: unknown }

const INSTRUTOR = {
  role: "manager",
  tenant_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  user_roles: [{ role: "instructor" }],
}

let perfilRetornado: Resultado = { data: INSTRUTOR, error: null }
let usuarioAutenticado: { id: string } | null = { id: USUARIO }

/** Leituras que não são `users` erram, para a rota parar logo depois do guard. */
const OUTRAS_TABELAS: Resultado = { data: null, error: ERRO_TRANSITORIO }

function clienteFake() {
  const construir = (tabela: string) => {
    const alvo: Resultado = tabela === "users" ? perfilRetornado : OUTRAS_TABELAS
    // biome-ignore lint/suspicious/noExplicitAny: duplo de um builder sem tipo estável
    const elo: any = new Proxy(() => elo, {
      get(_a, prop) {
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
    auth: { getUser: async () => ({ data: { user: usuarioAutenticado }, error: null }) },
    from: (tabela: string) => construir(tabela),
  }
}

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => clienteFake() }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => clienteFake() }))
vi.mock("@/lib/rate-limit", () => ({ enrichmentLimiter: null }))
vi.mock("@/lib/course-enrichment", () => ({ startEnrichment: async () => undefined }))

import { POST as enriquecer } from "../enrich/route"
import { GET as exportar } from "../export/route"

const contexto = { params: Promise.resolve({ courseId: "22222222-2222-2222-2222-222222222222" }) }

const ROTAS: Array<{ nome: string; chamar: () => Promise<Response> }> = [
  {
    nome: "POST /api/courses/[courseId]/enrich",
    chamar: () =>
      enriquecer(new Request("http://t/api/courses/x/enrich", { method: "POST" }), contexto),
  },
  {
    nome: "GET /api/courses/[courseId]/export",
    chamar: () => exportar(new Request("http://t/api/courses/x/export"), contexto),
  },
]

beforeEach(() => {
  usuarioAutenticado = { id: USUARIO }
  perfilRetornado = { data: INSTRUTOR, error: null }
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("enrich/export — perfil ilegível não é negação de direito", () => {
  for (const rota of ROTAS) {
    it(`${rota.nome} — falha ao LER o perfil não pode virar 403`, async () => {
      perfilRetornado = { data: null, error: ERRO_TRANSITORIO }

      const resposta = await rota.chamar()

      expect(resposta.status).not.toBe(403)
      expect(resposta.status).toBe(503)
      expect(resposta.headers.get("Retry-After")).toBeTruthy()
      const corpo = (await resposta.json()) as { error?: string }
      expect(corpo.error).toBe("profile_check_unavailable")
    })

    it(`[CP] ${rota.nome} — perfil inexistente continua 403, não 503`, async () => {
      perfilRetornado = { data: null, error: ERRO_ZERO_LINHAS }

      const resposta = await rota.chamar()

      expect(resposta.status).toBe(403)
    })

    it(`[CP] ${rota.nome} — chapéu de gestor puro continua 403`, async () => {
      // O gate de privacidade que estas rotas existem para aplicar. Se a correção
      // afrouxasse a recusa, este caso ficaria vermelho.
      perfilRetornado = {
        data: { role: "manager", tenant_id: "t", user_roles: [{ role: "manager" }] },
        error: null,
      }

      const resposta = await rota.chamar()

      expect(resposta.status).toBe(403)
    })

    it(`[CP] ${rota.nome} — chapéu de instrutor atravessa o guard`, async () => {
      perfilRetornado = { data: INSTRUTOR, error: null }

      const resposta = await rota.chamar()

      // Não afirmamos 200: as rotas seguem para leituras que este teste não
      // encena. Afirmamos que o GUARD deixou passar.
      expect(resposta.status).not.toBe(403)
      expect(resposta.status).not.toBe(401)
      const corpo = (await resposta.json().catch(() => ({}))) as { error?: string }
      expect(corpo.error).not.toBe("profile_check_unavailable")
    })

    it(`[CP] ${rota.nome} — sem sessão continua 401`, async () => {
      usuarioAutenticado = null

      const resposta = await rota.chamar()

      expect(resposta.status).toBe(401)
    })
  }
})
