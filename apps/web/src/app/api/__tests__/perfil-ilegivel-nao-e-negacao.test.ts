import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// "NÃO TEM DIREITO" ≠ "NÃO DEU PARA VERIFICAR" — nas 8 rotas que confundiam os dois.
// ---------------------------------------------------------------------------
// DEFEITO QUE ESTE ARQUIVO TRANCA (laudo LOOP-0c, tabela E→NEGA, 2026-08-28).
// Oito rotas de API liam o perfil assim:
//
//     const { data: profile } = await supabase.from("users")
//       .select("role, tenant_id").eq("id", user.id).single()
//     if (!profile || !PAPEIS.includes(profile.role)) return 403 "Permissão negada"
//
// O `error` do `.single()` NUNCA era destructurado. Num timeout de statement, num
// blip de RLS ou numa queda de rede, `data` volta `null`, `profile` fica `null`, e
// a condição `!profile` despacha o MESMO 403 que um estagiário receberia. Um gestor
// legítimo lê "você não tem permissão" quando a verdade é "não conseguimos
// confirmar" — a falha se apresenta como veredito.
//
// É o INVERSO exato do que o `feature-gate` desta casa já faz certo: ele separa
// 403 (plano conhecido, não cobre) de 503 + `Retry-After` (plano ilegível). O
// padrão-ouro existia a um import de distância e não foi copiado.
//
// CONTROLE POSITIVO (o que impede a correção degenerada "responde 503 sempre"):
// os casos marcados [CP] passam ANTES e DEPOIS da correção. Se o remédio passasse
// a deixar entrar quem não tem papel, ou a chamar de indisponível o perfil que foi
// lido sem erro, eles ficariam vermelhos.
//
// NENHUMA ESCRITA: o cliente Supabase inteiro é um duplo em memória; nenhuma rota
// aqui chega perto de LLM, webhook ou banco.
// ---------------------------------------------------------------------------

const USUARIO = "11111111-1111-1111-1111-111111111111"
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

let perfilRetornado: Resultado = { data: { role: "manager", tenant_id: TENANT }, error: null }
let usuarioAutenticado: { id: string } | null = { id: USUARIO }

/** Resultado das leituras que NÃO são `users` — sempre um erro, para a rota parar cedo. */
const OUTRAS_TABELAS: Resultado = { data: null, error: ERRO_TRANSITORIO }

/**
 * Duplo do cliente Supabase. Qualquer encadeamento (`.select().eq().order()...`)
 * devolve o mesmo proxy; os terminais (`await`, `.single()`, `.maybeSingle()`)
 * resolvem no resultado da tabela pedida.
 */
function clienteFake() {
  const construir = (tabela: string) => {
    const alvo: Resultado = tabela === "users" ? perfilRetornado : OUTRAS_TABELAS
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
    },
    from: (tabela: string) => construir(tabela),
  }
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => clienteFake(),
}))
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => clienteFake(),
}))
// O gate de plano é uma decisão SEPARADA (e já correta). Neutralizado para que o
// veredito medido aqui seja só o do guard de papel.
vi.mock("@/lib/feature-gate", () => ({
  requireFeature: async () => null,
}))
// Limitadores desligados: 429 não é o assunto deste arquivo.
vi.mock("@/lib/rate-limit", () => ({
  contentAnalysisLimiter: null,
  courseDesignerCrudLimiter: null,
  courseDesignerAuditLimiter: null,
  courseDesignerGenerateLimiter: null,
  courseDesignerApplyLimiter: null,
}))
vi.mock("@/lib/webhooks", () => ({
  dispatchEvent: async () => undefined,
}))

import { POST as aiFill } from "../course-designer/ai-fill/route"
import { POST as analyzeContent } from "../course-designer/analyze-content/route"
import { POST as auditCourse } from "../course-designer/audit-course/route"
import { POST as applyBlueprint } from "../course-designer/blueprints/[blueprintId]/apply/route"
import { GET as listarBlueprints } from "../course-designer/blueprints/route"
import { GET as listarFrameworks } from "../course-designer/frameworks/route"
import { POST as gerarBlueprint } from "../course-designer/generate/route"
import { GET as listarCursos } from "../courses/route"

/** Cada rota reduzida ao que interessa: um nome e uma chamada que devolve `Response`. */
const ROTAS: Array<{ nome: string; chamar: () => Promise<Response> }> = [
  {
    nome: "POST /api/course-designer/ai-fill",
    chamar: () =>
      aiFill(
        new Request("http://t/api/course-designer/ai-fill", {
          method: "POST",
          body: JSON.stringify({ step: 1, filled_fields: {} }),
          headers: { "content-type": "application/json" },
        }),
      ),
  },
  {
    nome: "POST /api/course-designer/analyze-content",
    chamar: () =>
      analyzeContent(
        new Request("http://t/api/course-designer/analyze-content", {
          method: "POST",
          body: new FormData(),
        }),
      ),
  },
  {
    nome: "POST /api/course-designer/audit-course",
    chamar: () =>
      auditCourse(
        new Request("http://t/api/course-designer/audit-course", {
          method: "POST",
          body: JSON.stringify({ courseId: "22222222-2222-2222-2222-222222222222" }),
          headers: { "content-type": "application/json" },
        }),
      ),
  },
  {
    nome: "GET /api/course-designer/blueprints",
    chamar: () => listarBlueprints(new Request("http://t/api/course-designer/blueprints")),
  },
  {
    nome: "POST /api/course-designer/blueprints/[id]/apply",
    chamar: () =>
      applyBlueprint(
        // biome-ignore lint/suspicious/noExplicitAny: NextRequest só é lido como Request aqui
        new Request("http://t/api/course-designer/blueprints/x/apply", { method: "POST" }) as any,
        { params: Promise.resolve({ blueprintId: "33333333-3333-3333-3333-333333333333" }) },
      ),
  },
  {
    nome: "GET /api/course-designer/frameworks",
    chamar: () => listarFrameworks(),
  },
  {
    nome: "POST /api/course-designer/generate",
    chamar: () =>
      gerarBlueprint(
        new Request("http://t/api/course-designer/generate", {
          method: "POST",
          body: JSON.stringify({}),
          headers: { "content-type": "application/json" },
        }),
      ),
  },
  {
    nome: "GET /api/courses",
    chamar: () => listarCursos(new Request("http://t/api/courses?forDesigner=true")),
  },
]

beforeEach(() => {
  usuarioAutenticado = { id: USUARIO }
  perfilRetornado = { data: { role: "manager", tenant_id: TENANT }, error: null }
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("perfil ilegível não é negação de direito", () => {
  for (const rota of ROTAS) {
    it(`${rota.nome} — falha ao LER o perfil não pode virar 403`, async () => {
      perfilRetornado = { data: null, error: ERRO_TRANSITORIO }

      const resposta = await rota.chamar()

      // O coração do defeito: hoje todas devolvem 403 "Permissão negada".
      expect(resposta.status).not.toBe(403)
      // E o que devem devolver: indisponibilidade retentável, como o feature-gate.
      expect(resposta.status).toBe(503)
      expect(resposta.headers.get("Retry-After")).toBeTruthy()
      const corpo = (await resposta.json()) as { error?: string }
      expect(corpo.error).toBe("profile_check_unavailable")
    })

    it(`[CP] ${rota.nome} — papel insuficiente continua 403`, async () => {
      perfilRetornado = { data: { role: "student", tenant_id: TENANT }, error: null }

      const resposta = await rota.chamar()

      expect(resposta.status).toBe(403)
    })

    it(`[CP] ${rota.nome} — perfil inexistente continua 403, não 503`, async () => {
      // Zero linhas NÃO é indisponibilidade: a leitura funcionou e a resposta é
      // "esta pessoa não tem perfil". Tratar isto como 503 esconderia um usuário
      // órfão atrás de um "tente de novo" que nunca resolveria.
      perfilRetornado = { data: null, error: ERRO_ZERO_LINHAS }

      const resposta = await rota.chamar()

      expect(resposta.status).toBe(403)
    })

    it(`[CP] ${rota.nome} — papel suficiente atravessa o guard`, async () => {
      perfilRetornado = { data: { role: "manager", tenant_id: TENANT }, error: null }

      const resposta = await rota.chamar()

      // Não afirmamos 200: cada rota segue para leituras/LLM que este teste não
      // encena. Afirmamos que o GUARD deixou passar — nem negou, nem se declarou
      // indisponível por causa do perfil.
      expect(resposta.status).not.toBe(403)
      expect(resposta.status).not.toBe(401)
      const corpo = (await resposta.json().catch(() => ({}))) as { error?: string }
      expect(corpo.error).not.toBe("profile_check_unavailable")
    })
  }

  it("[CP] sem sessão continua 401, antes de qualquer leitura de perfil", async () => {
    usuarioAutenticado = null
    for (const rota of ROTAS) {
      const resposta = await rota.chamar()
      expect(resposta.status, rota.nome).toBe(401)
    }
  })
})
