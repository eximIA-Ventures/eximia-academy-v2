import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// "NÃO TEM DIREITO" ≠ "NÃO DEU PARA VERIFICAR" — rotas avulsas e as três do
// course-designer que o laudo original não listou.
// ---------------------------------------------------------------------------
// Terceira frente do mesmo defeito (FIX-B tratou 8 do course-designer, FIX-B2
// trata `ingestion/**` no arquivo irmão e estas aqui). Em todas, o `error` do
// `.single()` na leitura de `users` nunca era destructurado, e uma leitura que
// FALHOU virava o veredito "você não tem permissão".
//
// Duas particularidades desta família, que os controles positivos travam:
//
// 1. `integrations/keys` lia o perfil dentro de um helper local que devolvia
//    `null` para TRÊS situações diferentes (sem sessão, papel insuficiente,
//    leitura falha) e os chamadores respondiam 403 para as três. A correção
//    separa a leitura falha; **NÃO** mexe no 401→403 colapsado, que é outro
//    defeito e está registrado no relatório em vez de corrigido de carona.
//
// 2. `requireRole` normaliza `tenant_id` ausente para `""`. Em `keys` isso NÃO
//    é cosmético: `targetTenant` cai num `??` e depois num teste de veracidade,
//    e `""` (falsy) atravessaria uma trava por onde `null` não passa. O
//    [CP] "admin com tenant nulo" mede exatamente isso.
//
// NENHUMA ESCRITA, NENHUMA REDE: cliente Supabase é duplo em memória, `fetch`
// global está stubado, e auditoria/geração de chave estão mockadas.
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

let perfilRetornado: Resultado = { data: { role: "admin", tenant_id: TENANT }, error: null }
let usuarioAutenticado: { id: string } | null = { id: USUARIO }

/** Resultado das leituras que NÃO são `users` — sempre erro, para a rota parar cedo. */
const OUTRAS_TABELAS: Resultado = { data: null, error: ERRO_TRANSITORIO }

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
vi.mock("@/lib/rate-limit", () => ({
  courseDesignerCrudLimiter: null,
}))
vi.mock("@/lib/audit", () => ({
  logAdminAction: async () => undefined,
}))
vi.mock("@/lib/integration/helpers", () => ({
  generateKey: () => ({ raw: "raw", prefix: "pfx", hash: "hash" }),
}))
vi.mock("@eximia/course-designer", () => ({
  evaluateNeuroscienceRules: () => ({ score: 0, verdict: "stub", rules: [] }),
}))

import { POST as gerarBlueprintMicro } from "../blueprint/generate/route"
import { GET as exportarBlueprint } from "../course-designer/blueprints/[blueprintId]/export/route"
import { GET as obterBlueprint } from "../course-designer/blueprints/[blueprintId]/route"
import { PUT as atualizarBlueprint } from "../course-designer/blueprints/[blueprintId]/route"
import { DELETE as deletarBlueprint } from "../course-designer/blueprints/[blueprintId]/route"
import { GET as consultarJob } from "../course-designer/jobs/[jobId]/route"
import { POST as importarCurso } from "../courses/import/route"
import { DELETE as revogarChave } from "../integrations/keys/[id]/route"
import { POST as criarChave, GET as listarChaves } from "../integrations/keys/route"

const ctxBlueprint = {
  params: Promise.resolve({ blueprintId: "33333333-3333-3333-3333-333333333333" }),
}
const ctxJob = { params: Promise.resolve({ jobId: "55555555-5555-5555-5555-555555555555" }) }

function json(url: string, corpo: unknown, metodo = "POST") {
  return new Request(url, {
    method: metodo,
    body: JSON.stringify(corpo),
    headers: { "content-type": "application/json" },
  })
}

/**
 * A LISTA DE PAPÉIS É ELA PRÓPRIA UMA ASSERÇÃO — e nesta família há TRÊS listas
 * diferentes convivendo, o que torna a troca silenciosa fácil demais.
 *
 * Cada trio abaixo foi conferido contra `HEAD` antes da correção, rota a rota.
 * Um teste que só experimenta UM papel aceito e UM recusado não distingue a lista
 * certa da errada: reusar `PAPEIS_CONTEUDO` numa rota do course-designer
 * ESTREITARIA o acesso, e reusar `PAPEIS_COURSE_DESIGNER` numa rota de conteúdo o
 * ALARGARIA — em silêncio, com a suíte verde nos dois casos.
 *
 * Por isso o par é exaustivo nos dois sentidos: cada papel de dentro entra, cada
 * papel de fora não entra. `super_admin` é o eixo — aceito nas do course-designer,
 * recusado nas de conteúdo — e é ele quem mata os dois mutantes.
 *
 * Isto NÃO é opinião sobre quem deveria ter direito: é o registro de quem já tinha.
 */
const CONTEUDO = {
  aceitos: ["manager", "admin", "instructor"],
  recusados: ["super_admin", "student"],
}
const COURSE_DESIGNER = {
  aceitos: ["manager", "admin", "super_admin", "instructor"],
  recusados: ["student"],
}
const CHAVES_PAPEIS = {
  aceitos: ["admin", "super_admin"],
  recusados: ["manager", "instructor", "student"],
}

/**
 * Rotas cujo desfecho sem sessão é 401. `integrations/keys` fica de fora desta
 * lista de propósito — ver o teste próprio dela mais abaixo.
 */
const ROTAS: Array<{
  nome: string
  chamar: () => Promise<Response>
  papeis: { aceitos: string[]; recusados: string[] }
}> = [
  {
    nome: "POST /api/courses/import",
    chamar: () => importarCurso(json("http://t/api/courses/import", { course: { title: "x" } })),
    papeis: CONTEUDO,
  },
  {
    nome: "POST /api/blueprint/generate",
    chamar: () =>
      gerarBlueprintMicro(
        // biome-ignore lint/suspicious/noExplicitAny: NextRequest só é lido como Request aqui
        json("http://t/api/blueprint/generate", { tenant_id: TENANT }) as any,
      ),
    papeis: CONTEUDO,
  },
  {
    nome: "GET /api/course-designer/blueprints/[id]",
    chamar: () => obterBlueprint(new Request("http://t/api/cd/blueprints/x"), ctxBlueprint),
    papeis: COURSE_DESIGNER,
  },
  {
    nome: "PUT /api/course-designer/blueprints/[id]",
    chamar: () => atualizarBlueprint(json("http://t/api/cd/blueprints/x", {}, "PUT"), ctxBlueprint),
    papeis: COURSE_DESIGNER,
  },
  {
    nome: "DELETE /api/course-designer/blueprints/[id]",
    chamar: () =>
      deletarBlueprint(
        new Request("http://t/api/cd/blueprints/x", { method: "DELETE" }),
        ctxBlueprint,
      ),
    papeis: COURSE_DESIGNER,
  },
  {
    nome: "GET /api/course-designer/blueprints/[id]/export",
    chamar: () =>
      exportarBlueprint(new Request("http://t/api/cd/blueprints/x/export"), ctxBlueprint),
    papeis: COURSE_DESIGNER,
  },
  {
    nome: "GET /api/course-designer/jobs/[jobId]",
    chamar: () => consultarJob(new Request("http://t/api/cd/jobs/x"), ctxJob),
    papeis: COURSE_DESIGNER,
  },
]

beforeEach(() => {
  usuarioAutenticado = { id: USUARIO }
  perfilRetornado = { data: { role: "admin", tenant_id: TENANT }, error: null }
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.spyOn(console, "warn").mockImplementation(() => {})
  // O microserviço de blueprint fica fora: sem rede neste teste.
  vi.stubGlobal("fetch", async () => new Response("{}", { status: 502 }))
})

describe("avulsas — perfil ilegível não é negação de direito", () => {
  for (const rota of ROTAS) {
    it(`${rota.nome} — falha ao LER o perfil não pode virar 403`, async () => {
      perfilRetornado = { data: null, error: ERRO_TRANSITORIO }

      const resposta = await rota.chamar()

      // O coração do defeito: hoje todas devolvem 403.
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

    for (const papel of rota.papeis.aceitos) {
      it(`[CP] ${rota.nome} — ${papel} atravessa o guard`, async () => {
        perfilRetornado = { data: { role: papel, tenant_id: TENANT }, error: null }

        const resposta = await rota.chamar()

        expect(resposta.status).not.toBe(403)
        expect(resposta.status).not.toBe(401)
        const corpo = (await resposta.json().catch(() => ({}))) as { error?: string }
        expect(corpo.error).not.toBe("profile_check_unavailable")
      })
    }

    for (const papel of rota.papeis.recusados) {
      it(`[CP] ${rota.nome} — ${papel} continua recusado com 403`, async () => {
        perfilRetornado = { data: { role: papel, tenant_id: TENANT }, error: null }

        const resposta = await rota.chamar()

        expect(resposta.status).toBe(403)
      })
    }
  }

  it("[CP] sem sessão continua 401, antes de qualquer leitura de perfil", async () => {
    usuarioAutenticado = null
    for (const rota of ROTAS) {
      const resposta = await rota.chamar()
      expect(resposta.status, rota.nome).toBe(401)
    }
  })
})

// ---------------------------------------------------------------------------
// `integrations/keys` tem forma própria: o perfil é lido num helper local
// (`requireAdminOrSuper`) que devolve `null` e os dois handlers respondem 403.
// ---------------------------------------------------------------------------
const CHAVES: Array<{ nome: string; chamar: () => Promise<Response> }> = [
  {
    nome: "GET /api/integrations/keys",
    chamar: () => listarChaves(new Request("http://t/api/integrations/keys")),
  },
  {
    nome: "POST /api/integrations/keys",
    chamar: () => criarChave(json("http://t/api/integrations/keys", { app_name: "app" })),
  },
]

describe("integrations/keys — perfil ilegível não é negação de direito", () => {
  for (const rota of CHAVES) {
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

    it(`[CP] ${rota.nome} — sem sessão continua 403 (o 401 colapsado é OUTRO defeito)`, async () => {
      // Esta rota nunca respondeu 401: o helper devolvia `null` para "sem sessão"
      // e o chamador respondia 403. Corrigir isso aqui seria mudar contrato de
      // resposta a pretexto de arrumar tratamento de erro. Fica registrado no
      // relatório, e este CP garante que a correção do 503 não o alterou.
      usuarioAutenticado = null

      const resposta = await rota.chamar()

      expect(resposta.status).toBe(403)
      const corpo = (await resposta.json()) as { error?: string }
      expect(corpo.error).not.toBe("profile_check_unavailable")
    })

    for (const papel of CHAVES_PAPEIS.aceitos) {
      it(`[CP] ${rota.nome} — ${papel} atravessa o guard`, async () => {
        perfilRetornado = { data: { role: papel, tenant_id: TENANT }, error: null }

        const resposta = await rota.chamar()

        expect(resposta.status).not.toBe(403)
        const corpo = (await resposta.json().catch(() => ({}))) as { error?: string }
        expect(corpo.error).not.toBe("profile_check_unavailable")
      })
    }

    for (const papel of CHAVES_PAPEIS.recusados) {
      // `manager` e `instructor` estão aqui de propósito: são os papéis pelos
      // quais esta lista erraria se alguém lhe aplicasse `PAPEIS_CONTEUDO` ou
      // `PAPEIS_COURSE_DESIGNER`. Chave de integração é a credencial mais
      // poderosa do sistema; alargar esta lista por descuido é o pior desfecho
      // possível desta rodada.
      it(`[CP] ${rota.nome} — ${papel} continua recusado com 403`, async () => {
        perfilRetornado = { data: { role: papel, tenant_id: TENANT }, error: null }

        const resposta = await rota.chamar()

        expect(resposta.status).toBe(403)
      })
    }
  }

  // -------------------------------------------------------------------------
  // `integrations/keys/[id]` (DELETE) — a órfã. Mesmo defeito, mas forma padrão
  // e, ao contrário das irmãs `GET`/`POST`, ela SEMPRE respondeu 401 sem sessão.
  // Por isso vive num bloco próprio, e não na lista `CHAVES`.
  // -------------------------------------------------------------------------
  const revogar = () =>
    revogarChave(new Request("http://t/api/integrations/keys/k", { method: "DELETE" }), {
      params: Promise.resolve({ id: "66666666-6666-6666-6666-666666666666" }),
    })

  it("DELETE /api/integrations/keys/[id] — falha ao LER o perfil não pode virar 403", async () => {
    perfilRetornado = { data: null, error: ERRO_TRANSITORIO }

    const resposta = await revogar()

    expect(resposta.status).not.toBe(403)
    expect(resposta.status).toBe(503)
    expect(resposta.headers.get("Retry-After")).toBeTruthy()
    const corpo = (await resposta.json()) as { error?: string }
    expect(corpo.error).toBe("profile_check_unavailable")
  })

  it("[CP] DELETE /api/integrations/keys/[id] — perfil inexistente continua 403, não 503", async () => {
    perfilRetornado = { data: null, error: ERRO_ZERO_LINHAS }

    const resposta = await revogar()

    expect(resposta.status).toBe(403)
  })

  it("[CP] DELETE /api/integrations/keys/[id] — sem sessão continua 401", async () => {
    // Diferente das irmãs GET/POST, esta rota SEMPRE respondeu 401 aqui. O CP
    // existe para que a adoção do guard não a alinhe ao 403 delas por descuido.
    usuarioAutenticado = null

    const resposta = await revogar()

    expect(resposta.status).toBe(401)
  })

  for (const papel of CHAVES_PAPEIS.aceitos) {
    it(`[CP] DELETE /api/integrations/keys/[id] — ${papel} atravessa o guard`, async () => {
      perfilRetornado = { data: { role: papel, tenant_id: TENANT }, error: null }

      const resposta = await revogar()

      expect(resposta.status).not.toBe(403)
      expect(resposta.status).not.toBe(401)
      const corpo = (await resposta.json().catch(() => ({}))) as { error?: string }
      expect(corpo.error).not.toBe("profile_check_unavailable")
    })
  }

  for (const papel of CHAVES_PAPEIS.recusados) {
    it(`[CP] DELETE /api/integrations/keys/[id] — ${papel} continua recusado com 403`, async () => {
      perfilRetornado = { data: { role: papel, tenant_id: TENANT }, error: null }

      const resposta = await revogar()

      expect(resposta.status).toBe(403)
    })
  }

  it("[CP] admin SEM tenant continua barrado de criar chave de plataforma", async () => {
    // `requireRole` devolve `tenant_id: ""` quando a coluna é nula, e `""` é
    // falsy. Sem cuidado, `targetTenant` deixaria de ser `null`, a trava
    // "apenas super admin cria chave de plataforma" seria pulada, e um admin
    // comum criaria a chave mais poderosa do sistema. Este CP mede a trava, não
    // a mensagem.
    perfilRetornado = { data: { role: "admin", tenant_id: null }, error: null }

    const resposta = await criarChave(json("http://t/api/integrations/keys", { app_name: "app" }))

    expect(resposta.status).toBe(403)
    const corpo = (await resposta.json()) as { error?: string }
    expect(corpo.error).toBe("Apenas super admin pode criar chaves de plataforma")
  })
})
