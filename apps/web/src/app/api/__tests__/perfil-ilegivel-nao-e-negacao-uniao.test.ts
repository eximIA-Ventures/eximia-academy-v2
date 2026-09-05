import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// "NÃO TEM DIREITO" ≠ "NÃO DEU PARA VERIFICAR" — as cinco rotas que decidem
// pela UNIÃO DE CHAPÉUS, e que por isso ficaram de fora do `requireRole`.
// ---------------------------------------------------------------------------
// Quarta frente do mesmo defeito. As 47 rotas anteriores decidiam pelo papel
// SINGULAR (`users.role`) e migraram para `requireRole`. Estas cinco não podiam:
// elas leem `user_roles` (a união de chapéus, E1/E7), e aplicar o guard singular
// nelas NEGARIA acesso a todo membro multi-chapéu — um gestor que também é aluno,
// cujo `users.role` lê "student". Trocaria um defeito que aparece sob falha
// transitória por um que apareceria SEMPRE.
//
// O guard irmão (`requireAnyRole`) traz a mesma separação para cá:
//   • 403 — a leitura funcionou e a resposta é "não" (papel insuficiente, ou
//     zero linhas / `PGRST116`).
//   • 503 + `Retry-After` — a leitura FALHOU. Ninguém sabe se tem direito.
//
// TRÊS COISAS QUE ESTE ARQUIVO TRAVA, ALÉM DO 503:
//
// 1. A MATRIZ DE PAPÉIS, não uma amostra. São TRÊS listas diferentes convivendo
//    nas cinco rotas, e `student` é recusado pelas três — logo `student` não
//    discrimina NADA. Quem discrimina é `manager` (recusado só em `semantic`) e
//    `leader` (aceito só em `aggregate`). Cada papel do universo é afirmado, um a
//    um, em cada rota. Uma lista trocada mata pelo menos um caso.
//
// 2. A FONTE DA DECISÃO de `aggregate`, que NÃO é a união. O gate dela em `HEAD`
//    é `["leader","manager","admin","instructor","super_admin"].includes(profile.role)`
//    — papel SINGULAR. A união aparece logo abaixo, só para decidir ESCOPO. Migrar
//    o gate dela para a união ALARGARIA o acesso em silêncio (um `student` com
//    chapéu de `manager` passaria a entrar). O teste "aggregate recusa o
//    multi-chapéu" é o que impede esse alargamento.
//
// 3. O contrário, nas outras quatro: o multi-chapéu ENTRA. Se alguém as migrar
//    para o guard singular por engano, este caso vira vermelho.
//
// NENHUMA ESCRITA, NENHUMA REDE: cliente Supabase é duplo em memória, `fetch`
// global está stubado, e o envio de e-mail está mockado.
// ---------------------------------------------------------------------------

const USUARIO = "11111111-1111-1111-1111-111111111111"
const TENANT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const ALUNO = "22222222-2222-2222-2222-222222222222"

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

/**
 * A linha de `users` como o guard a lê: coluna singular + o join de chapéus.
 * `chapeus: null` encena a ausência do join (linha legada, sem `user_roles`),
 * que é exatamente quando o fallback para o papel singular vale.
 */
function perfil(papelSingular: string | null, chapeus: string[] | null = null) {
  return {
    data: {
      role: papelSingular,
      tenant_id: TENANT,
      full_name: "Quem Chama",
      user_roles: chapeus === null ? [] : chapeus.map((role) => ({ role })),
    },
    error: null,
  }
}

let perfilRetornado: Resultado = perfil("admin")
let usuarioAutenticado: { id: string } | null = { id: USUARIO }

function clienteFake() {
  const construir = (tabela: string) => {
    const ehUsers = tabela === "users"
    // biome-ignore lint/suspicious/noExplicitAny: duplo de um builder sem tipo estável
    const elo: any = new Proxy(() => elo, {
      get(_alvoProxy, prop) {
        if (prop === "then") {
          // Lista: sempre vazia e SEM erro. Rota nenhuma pode confundir "banco
          // vazio" com "leitura falhou" — e é justamente essa a distinção sob teste.
          const lista: Resultado = { data: [], error: null }
          // biome-ignore lint/suspicious/noExplicitAny: assinatura de thenable
          return (ok: any, falha: any) => Promise.resolve(lista).then(ok, falha)
        }
        if (prop === "single" || prop === "maybeSingle") {
          const alvo: Resultado = ehUsers ? perfilRetornado : { data: null, error: null }
          return () => Promise.resolve(alvo)
        }
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
    rpc: async () => ({ data: [], error: null }),
  }
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => clienteFake(),
}))
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => clienteFake(),
}))
vi.mock("@/lib/rate-limit", () => ({
  semanticAnalysisLimiter: null,
  analyticsAggregateLimiter: null,
}))
vi.mock("@/lib/area-context", () => ({
  resolveCallerStudentScope: async () => null,
  getDirectTeamStudentIds: async () => [],
  getManagedTeamStudentIds: async () => null,
  getSubtreeStudentIdsAtNode: async () => null,
}))
vi.mock("@/lib/resend", () => ({
  resend: { emails: { send: async () => ({ id: "stub" }) } },
}))
vi.mock("@/lib/email-template", () => ({
  buildNotificationEmail: () => "<p>stub</p>",
}))
vi.mock("@/lib/tenant", () => ({
  getTenantConfig: () => ({ brand: { name: "eximIA" }, settings: {} }),
}))
vi.mock("@/lib/leitura-paginada", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/leitura-paginada")>("@/lib/leitura-paginada")
  return { ...real, lerTodasAsLinhas: async () => [] }
})

import { POST as enviarNotificacao, GET as listarNotificacoes } from "../admin/notifications/route"
import { GET as agregarAnalytics } from "../analytics/aggregate/route"
import { GET as painelSemantico } from "../analytics/semantic/route"
import { POST as cutucar } from "../notifications/nudge/route"

function json(url: string, corpo: unknown, metodo = "POST") {
  return new Request(url, {
    method: metodo,
    body: JSON.stringify(corpo),
    headers: { "content-type": "application/json" },
  })
}

/**
 * O UNIVERSO INTEIRO de papéis (`packages/shared` → `type Role`). A matriz de
 * cada rota afirma TODOS os seis, nenhum fica de fora por conveniência: um papel
 * não afirmado é uma linha da lista que nenhum teste vigia.
 */
const UNIVERSO = ["student", "leader", "manager", "admin", "instructor", "super_admin"] as const

/** Conferidos contra `HEAD`, rota a rota, antes de qualquer edição. */
const NUDGE = { aceitos: ["instructor", "manager", "admin", "super_admin"] }
const NOTIFICACOES = { aceitos: ["admin", "manager", "instructor", "super_admin"] }
const SEMANTICO = { aceitos: ["instructor", "admin", "super_admin"] }
const AGREGADO = { aceitos: ["leader", "manager", "admin", "instructor", "super_admin"] }

type Rota = {
  nome: string
  chamar: () => Promise<Response>
  aceitos: readonly string[]
  /**
   * `"uniao"` — o gate lê `user_roles` (multi-chapéu entra).
   * `"singular"` — o gate lê `users.role` (multi-chapéu NÃO entra). Só `aggregate`.
   */
  fonte: "uniao" | "singular"
}

const ROTAS: Rota[] = [
  {
    nome: "POST /api/notifications/nudge",
    chamar: () => cutucar(json("http://t/api/notifications/nudge", { studentId: ALUNO })),
    aceitos: NUDGE.aceitos,
    fonte: "uniao",
  },
  {
    nome: "GET /api/admin/notifications",
    chamar: () => listarNotificacoes(),
    aceitos: NOTIFICACOES.aceitos,
    fonte: "uniao",
  },
  {
    nome: "POST /api/admin/notifications",
    chamar: () =>
      enviarNotificacao(
        json("http://t/api/admin/notifications", {
          subject: "s",
          message: "m",
          recipientIds: [ALUNO],
        }),
      ),
    aceitos: NOTIFICACOES.aceitos,
    fonte: "uniao",
  },
  {
    nome: "GET /api/analytics/semantic",
    chamar: () => painelSemantico(new Request("http://t/api/analytics/semantic")),
    aceitos: SEMANTICO.aceitos,
    fonte: "uniao",
  },
  {
    nome: "GET /api/analytics/aggregate",
    chamar: () => agregarAnalytics(new Request("http://t/api/analytics/aggregate")),
    aceitos: AGREGADO.aceitos,
    fonte: "singular",
  },
]

beforeEach(() => {
  perfilRetornado = perfil("admin")
  usuarioAutenticado = { id: USUARIO }
  vi.stubGlobal("fetch", async () => new Response("{}", { status: 200 }))
  vi.spyOn(console, "error").mockImplementation(() => undefined)
})

describe("perfil ilegível não é negação — as cinco rotas de união de chapéus", () => {
  for (const rota of ROTAS) {
    describe(rota.nome, () => {
      it("leitura de perfil que FALHA devolve 503 retentável, não 403", async () => {
        perfilRetornado = { data: null, error: ERRO_TRANSITORIO }

        const resposta = await rota.chamar()

        expect(resposta.status).toBe(503)
        expect(resposta.headers.get("Retry-After")).toBe("5")
        const corpo = (await resposta.json()) as { error?: string }
        expect(corpo.error).toBe("profile_check_unavailable")
      })

      it("[CP] zero linhas (PGRST116) continua 403 — a leitura aconteceu", async () => {
        perfilRetornado = { data: null, error: ERRO_ZERO_LINHAS }

        const resposta = await rota.chamar()

        expect(resposta.status).toBe(403)
        const corpo = (await resposta.json()) as { error?: string }
        expect(corpo.error).not.toBe("profile_check_unavailable")
      })

      // A MATRIZ. Cada papel do universo é afirmado; nenhuma amostra.
      for (const papel of UNIVERSO) {
        const aceito = rota.aceitos.includes(papel)
        it(`[CP] papel "${papel}" ${aceito ? "atravessa o guard" : "continua recusado com 403"}`, async () => {
          perfilRetornado = perfil(papel)

          const resposta = await rota.chamar()

          if (aceito) {
            expect(resposta.status).not.toBe(403)
            expect(resposta.status).not.toBe(401)
            const corpo = (await resposta.json().catch(() => ({}))) as { error?: string }
            expect(corpo.error).not.toBe("profile_check_unavailable")
          } else {
            expect(resposta.status).toBe(403)
          }
        })
      }

      // A FONTE DA DECISÃO. Papel singular "student" (recusado por todas as
      // listas) + um chapéu aceito. Quem decide pela união deixa entrar; quem
      // decide pelo singular não. Este par é o que impede a migração errada nos
      // DOIS sentidos.
      const chapeuAceito = rota.aceitos[0]
      it(`[CP] multi-chapéu (singular "student" + chapéu "${chapeuAceito}") ${
        rota.fonte === "uniao" ? "ENTRA (união decide)" : "NÃO entra (singular decide)"
      }`, async () => {
        perfilRetornado = perfil("student", [chapeuAceito])

        const resposta = await rota.chamar()

        if (rota.fonte === "uniao") {
          expect(resposta.status).not.toBe(403)
        } else {
          expect(resposta.status).toBe(403)
        }
      })

      // O ESPELHO do anterior: papel singular aceito + chapéu recusado. Quem
      // decide pela união recusa (o join, quando existe, SUBSTITUI o singular —
      // não se soma a ele). Quem decide pelo singular aceita.
      it(`[CP] chapéu "student" com singular "${rota.aceitos[0]}" ${
        rota.fonte === "uniao"
          ? "é recusado (o join substitui o singular)"
          : "entra (singular decide)"
      }`, async () => {
        perfilRetornado = perfil(rota.aceitos[0], ["student"])

        const resposta = await rota.chamar()

        if (rota.fonte === "uniao") {
          expect(resposta.status).toBe(403)
        } else {
          expect(resposta.status).not.toBe(403)
        }
      })
    })
  }
})
