import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// "NÃO TEM DIREITO" ≠ "NÃO DEU PARA VERIFICAR" — as rotas de JOB fora do course-designer.
// ---------------------------------------------------------------------------
// Terceiro lote da mesma frente (irmão de `chapters/__tests__/…-chapters.test.ts` e
// `courses/__tests__/…-courses.test.ts`). Mesmo defeito do laudo LOOP-0c (E→NEGA):
// o `error` do `.single()` nunca é destructurado, então `data: null` num timeout de
// statement vira "Permissão negada".
//
// CORREÇÃO DE UM ERRO MEU: na primeira passagem desta frente eu declarei que "jobs
// fora do course-designer não existem". A busca tinha sido `find -path '*/jobs/*'`,
// que exige `jobs` como SEGMENTO INTEIRO do caminho — e as quatro rotas abaixo se
// escondem exatamente onde esse padrão não alcança: `blueprint/job/` (singular) e
// `enrichment-jobs/` / `generation-jobs/` (o "jobs" colado num nome composto).
// A régua estava certa sobre o que mediu e cega para o que importava.
//
// AS DUAS DE `status` SÃO SSE, e é o que as torna diferentes das outras seis: elas
// recusavam com `new Response("Forbidden", { status: 403 })` — texto puro, não JSON.
// O guard passa a responder JSON. Isso é invisível para o consumidor (`hooks/use-sse.ts`
// nunca lê o corpo do erro; o `onerror` do EventSource só reconecta até 5 vezes), mas
// deixa de mentir para quem NÃO é EventSource: curl, log, monitoração. E o 503 é o
// veredito honesto para uma retentativa que o cliente já fazia às cegas.
//
// CONTROLE POSITIVO: os casos [CP] passam ANTES e DEPOIS da correção.
//
// NENHUMA ESCRITA E NENHUMA REDE: cliente Supabase é duplo em memória; o proxy do
// microserviço de blueprint nunca é alcançado (a rota para no 404 do job).
// ---------------------------------------------------------------------------

const USUARIO = "11111111-1111-1111-1111-111111111111"
const TENANT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
/** `blueprint/job` valida o id como UUID antes de tudo — um id inválido daria 400 e
 * o teste mediria a validação, não o guard. */
const JOB = "44444444-4444-4444-4444-444444444444"

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

let perfilRetornado: Resultado = { data: { role: "instructor", tenant_id: TENANT }, error: null }
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

import { GET as jobDeBlueprint } from "../blueprint/job/[jobId]/route"
import { GET as exportarEnriquecimento } from "../enrichment-jobs/[jobId]/export/route"
import { GET as statusDeEnriquecimento } from "../enrichment-jobs/[jobId]/status/route"
import { GET as statusDeGeracao } from "../generation-jobs/[jobId]/status/route"

const params = { params: Promise.resolve({ jobId: JOB }) }

/**
 * O universo de papéis do produto — o mesmo das matrizes de `api/admin/**`,
 * `api/analytics/**`, `api/chapters/**` e `api/courses/**`. Cada rota declara
 * quais ACEITA; o complemento é o que ela precisa RECUSAR, e a matriz afirma os
 * dois lados, papel a papel.
 *
 * QUEM DISCRIMINA O QUÊ aqui (2026-08-30, achado 1 da verificação cruzada):
 *   • `student` — recusado por todas as listas do produto; não discrimina nada.
 *   • `admin` — ACEITO e nunca afirmado. Medido: remover `admin` de
 *               `generation-jobs/[jobId]/status` deixava **21/21 VERDE**.
 *   • `super_admin` — RECUSADO por estas quatro rotas, nunca afirmado, e um
 *               papel que EXISTE em `users.role` neste banco. Alargamento
 *               alcançável que passava despercebido.
 *   • `leader` — EXISTE no vocabulário deste banco, e por isso é ameaça
 *               ALCANÇÁVEL, igual a `super_admin`. NÃO REMOVA ESTE CASO. A
 *               restrição vigente de `users.role` é a de
 *               `20260518000000_leader_role.sql` — a ÚLTIMA das quatro que
 *               definem `users_role_check` — e ela inclui `leader`; uma linha
 *               com esse papel é inserível hoje, e a RLS dele ainda estava
 *               sendo estreitada em junho de 2026
 *               (`20260604140000_fix_area_gestor_rls.sql`).
 *               O comentário anterior dizia o contrário citando
 *               `20260803000000_onboarding_novidades.sql`, que não cataloga
 *               papéis: semeia `audience_roles` de anúncios (um `TEXT[]` que a
 *               própria migration declara sem CHECK fechado, e cujas linhas
 *               listam `teacher` E `leader`). Aquilo mede a POPULAÇÃO de hoje;
 *               o que autoriza uma escrita é o DOMÍNIO aceito.
 *
 * O comentário antigo dizia que o caso de `manager` era "o ÚNICO caso do arquivo
 * que pega uma lista trocada". Era verdade para o alargamento que ele testou, e
 * falso para o resto do espaço: com `manager` afirmado e `admin` não, remover
 * `admin` continuava verde. É a diferença entre uma amostra e uma matriz.
 */
const TODOS_OS_PAPEIS = [
  "student",
  "leader",
  "manager",
  "instructor",
  "admin",
  "super_admin",
] as const

/**
 * Transcrição 1:1 da lista que as quatro rotas já tinham (conferida arquivo a
 * arquivo). REGISTRO, NÃO PROPOSTA: `super_admin` está fora dela enquanto o
 * `PAPEIS_COURSE_DESIGNER` do mesmo `lib/api-role-guard.ts` o inclui. RBAC é
 * decisão do dono do produto; a matriz só impede que a divergência mude de lado
 * em silêncio.
 */
const ACOMPANHAMENTO_DE_JOB = ["manager", "admin", "instructor"] as const

const ROTAS: Array<{
  nome: string
  /** Papéis que ESTA rota aceita. Não é "a lista da família", é a dela. */
  aceitos: readonly string[]
  chamar: () => Promise<Response>
}> = [
  {
    nome: "GET /api/blueprint/job/[jobId]",
    aceitos: ACOMPANHAMENTO_DE_JOB,
    chamar: () =>
      jobDeBlueprint(
        // biome-ignore lint/suspicious/noExplicitAny: NextRequest só é lido como Request aqui
        new Request(`http://t/api/blueprint/job/${JOB}`) as any,
        params,
      ),
  },
  {
    nome: "GET /api/enrichment-jobs/[jobId]/export",
    aceitos: ACOMPANHAMENTO_DE_JOB,
    chamar: () =>
      exportarEnriquecimento(
        new Request(`http://t/api/enrichment-jobs/${JOB}/export?format=csv`),
        params,
      ),
  },
  {
    nome: "GET /api/enrichment-jobs/[jobId]/status (SSE)",
    aceitos: ACOMPANHAMENTO_DE_JOB,
    chamar: () =>
      statusDeEnriquecimento(new Request(`http://t/api/enrichment-jobs/${JOB}/status`), params),
  },
  {
    nome: "GET /api/generation-jobs/[jobId]/status (SSE)",
    aceitos: ACOMPANHAMENTO_DE_JOB,
    chamar: () =>
      statusDeGeracao(new Request(`http://t/api/generation-jobs/${JOB}/status`), params),
  },
]

beforeEach(() => {
  usuarioAutenticado = { id: USUARIO }
  perfilRetornado = { data: { role: "instructor", tenant_id: TENANT }, error: null }
  // As duas rotas SSE abrem um `setInterval` de 2s quando o guard deixa passar, e
  // nada neste teste consome o stream para fechá-lo. Com relógio falso o intervalo
  // é registrado e descartado junto com o relógio, em vez de sobreviver ao arquivo.
  // (Passar um `AbortController` seria o caminho natural — a rota escuta
  // `request.signal` —, mas o `AbortSignal` do jsdom não é o do undici que constrói
  // o `Request`, e o construtor recusa: `Expected signal to be an instance of
  // AbortSignal`. Isso deixava os 21 testes vermelhos pelo HARNESS, não pelo defeito.)
  vi.useFakeTimers()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
})

describe("perfil ilegível não é negação de direito — jobs fora do course-designer", () => {
  for (const rota of ROTAS) {
    it(`${rota.nome} — falha ao LER o perfil não pode virar 403`, async () => {
      perfilRetornado = { data: null, error: ERRO_TRANSITORIO }

      const resposta = await rota.chamar()

      // O coração do defeito: hoje as quatro devolvem 403.
      expect(resposta.status).not.toBe(403)
      // E o que devem devolver: indisponibilidade retentável, como o feature-gate.
      expect(resposta.status).toBe(503)
      expect(resposta.headers.get("Retry-After")).toBeTruthy()
      const corpo = (await resposta.json()) as { error?: string }
      expect(corpo.error).toBe("profile_check_unavailable")
    })

    // ---- Matriz de papéis: os DOIS lados da lista, papel a papel. ----------
    for (const papel of TODOS_OS_PAPEIS) {
      const deveEntrar = rota.aceitos.includes(papel)

      it(`[CP] ${rota.nome} — \`${papel}\` ${deveEntrar ? "É ACEITO" : "é RECUSADO"}`, async () => {
        perfilRetornado = { data: { role: papel, tenant_id: TENANT }, error: null }

        const resposta = await rota.chamar()

        if (!deveEntrar) {
          expect(resposta.status).toBe(403)
          return
        }

        // Aceito = o GUARD deixou passar. O corpo NÃO é lido: duas destas rotas
        // são SSE e o stream só fecha em estado terminal — ler penduraria o
        // teste. Por isso o `not.toBe(503)` explícito, que nas outras famílias
        // vem da inspeção de `error: "profile_check_unavailable"`.
        expect(resposta.status).not.toBe(403)
        expect(resposta.status).not.toBe(401)
        expect(resposta.status).not.toBe(503)
      })
    }

    it(`[CP] ${rota.nome} — perfil inexistente continua 403, não 503`, async () => {
      // Zero linhas NÃO é indisponibilidade: a leitura funcionou e a resposta é
      // "esta pessoa não tem perfil". Tratar isto como 503 esconderia um usuário
      // órfão atrás de um "tente de novo" que nunca resolveria.
      perfilRetornado = { data: null, error: ERRO_ZERO_LINHAS }

      const resposta = await rota.chamar()

      expect(resposta.status).toBe(403)
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
