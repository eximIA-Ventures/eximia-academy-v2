import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// "NÃO TEM DIREITO" ≠ "NÃO DEU PARA VERIFICAR" — família `api/courses/**` + jobs.
// ---------------------------------------------------------------------------
// Mesmo defeito das oito primeiras rotas (laudo LOOP-0c, tabela E→NEGA) e da
// família `chapters` irmã: o `error` do `.single()` nunca é destructurado, então
// `data: null` num timeout de statement vira "Permissão negada".
//
// `GET /api/courses` já foi corrigida na primeira rodada e está trancada em
// `src/app/api/__tests__/perfil-ilegivel-nao-e-negacao.test.ts`. As duas daqui são
// as que sobraram na mesma árvore:
//
//   • `[courseId]/generate-questions` — dispara a geração em lote de um curso
//     inteiro. Negar por blip de leitura manda o instrutor procurar quem lhe dê
//     acesso que ele já tem.
//   • `[courseId]/generation-jobs` — é o PAINEL que acompanha esses lotes. Um 403
//     aqui apaga o progresso de um trabalho que continua rodando no servidor: a
//     tela diz "você não pode ver isto" sobre algo que é do próprio usuário.
//
// A rota de `jobs` propriamente dita (`api/course-designer/jobs/[jobId]`) mora
// dentro de `course-designer/` e é da família daquele dono — não é tocada aqui.
//
// CONTROLE POSITIVO: os casos [CP] passam ANTES e DEPOIS da correção, e é o que
// impede o remédio degenerado "responde 503 sempre".
//
// NENHUMA ESCRITA E NENHUMA REDE: cliente Supabase é duplo em memória, e o motor
// de geração em lote está mockado.
// ---------------------------------------------------------------------------

const USUARIO = "11111111-1111-1111-1111-111111111111"
const TENANT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const CURSO = "33333333-3333-3333-3333-333333333333"

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
// O motor de geração em lote fala com o banco e com o LLM. Neutralizado: o veredito
// medido aqui é o do guard de papel, e nada mais.
vi.mock("@/lib/question-generation", () => ({
  startBatchGeneration: async () => ({ jobId: "job-1", error: null }),
}))
// Limitadores desligados: 429 não é o assunto deste arquivo.
vi.mock("@/lib/rate-limit", () => ({
  batchQuestionGenLimiter: null,
  courseDesignerCrudLimiter: null,
}))

import { POST as gerarPerguntasDoCurso } from "../[courseId]/generate-questions/route"
import { GET as listarJobsDeGeracao } from "../[courseId]/generation-jobs/route"

const params = { params: Promise.resolve({ courseId: CURSO }) }

/**
 * O universo de papéis do produto — o mesmo das matrizes de `api/admin/**`,
 * `api/analytics/**` e `api/chapters/**`. Cada rota declara quais ACEITA; o
 * complemento é o que ela precisa RECUSAR, e a matriz afirma os dois lados.
 *
 * QUEM DISCRIMINA O QUÊ aqui (2026-08-30, achado 1 da verificação cruzada):
 *   • `student` — recusado por todas as listas do produto; não discrimina nada.
 *                 Era o único papel de fora que este arquivo experimentava, e é
 *                 por isso que a régua antiga media o vazio nessa direção.
 *   • `admin` — ACEITO e nunca afirmado. Medido: remover `admin` de
 *               `[courseId]/generation-jobs` deixava **21/21 VERDE**.
 *   • `super_admin` — RECUSADO por estas duas rotas, nunca afirmado, e um papel
 *               que EXISTE em `users.role` neste banco. É o alargamento
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
 * Transcrição 1:1 da lista que as duas rotas já tinham (conferida arquivo a
 * arquivo). REGISTRO, NÃO PROPOSTA: `super_admin` está fora dela enquanto o
 * `PAPEIS_COURSE_DESIGNER` do mesmo `lib/api-role-guard.ts` o inclui. RBAC é
 * decisão do dono do produto; o que a matriz faz é impedir que a divergência
 * mude de lado em silêncio, para qualquer um dos dois lados.
 */
const PRODUCAO_DE_CONTEUDO = ["manager", "admin", "instructor"] as const

const ROTAS: Array<{
  nome: string
  /** Papéis que ESTA rota aceita. Não é "a lista da família", é a dela. */
  aceitos: readonly string[]
  chamar: () => Promise<Response>
}> = [
  {
    nome: "POST /api/courses/[id]/generate-questions",
    aceitos: PRODUCAO_DE_CONTEUDO,
    chamar: () =>
      gerarPerguntasDoCurso(
        new Request("http://t/api/courses/x/generate-questions", {
          method: "POST",
          body: JSON.stringify({}),
          headers: { "content-type": "application/json" },
        }),
        params,
      ),
  },
  {
    nome: "GET /api/courses/[id]/generation-jobs",
    aceitos: PRODUCAO_DE_CONTEUDO,
    chamar: () =>
      listarJobsDeGeracao(new Request("http://t/api/courses/x/generation-jobs"), params),
  },
]

beforeEach(() => {
  usuarioAutenticado = { id: USUARIO }
  perfilRetornado = { data: { role: "instructor", tenant_id: TENANT }, error: null }
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("perfil ilegível não é negação de direito — courses", () => {
  for (const rota of ROTAS) {
    it(`${rota.nome} — falha ao LER o perfil não pode virar 403`, async () => {
      perfilRetornado = { data: null, error: ERRO_TRANSITORIO }

      const resposta = await rota.chamar()

      // O coração do defeito: hoje as duas devolvem 403 "Permissão negada".
      expect(resposta.status).not.toBe(403)
      // E o que devem devolver: indisponibilidade retentável, como o feature-gate.
      expect(resposta.status).toBe(503)
      expect(resposta.headers.get("Retry-After")).toBeTruthy()
      const corpo = (await resposta.json()) as { error?: string }
      expect(corpo.error).toBe("profile_check_unavailable")
    })

    // ---- Matriz de papéis: os DOIS lados da lista, papel a papel. ----------
    // Um `student` de amostra fora e um `instructor` de amostra dentro deixam
    // passar tanto o estreitamento (remover `admin`) quanto o alargamento
    // (acrescentar `super_admin`). Só a matriz fecha as duas direções.
    for (const papel of TODOS_OS_PAPEIS) {
      const deveEntrar = rota.aceitos.includes(papel)

      it(`[CP] ${rota.nome} — \`${papel}\` ${deveEntrar ? "É ACEITO" : "é RECUSADO"}`, async () => {
        perfilRetornado = { data: { role: papel, tenant_id: TENANT }, error: null }

        const resposta = await rota.chamar()

        if (!deveEntrar) {
          expect(resposta.status).toBe(403)
          return
        }

        expect(resposta.status).not.toBe(403)
        expect(resposta.status).not.toBe(401)
        const corpo = (await resposta.json().catch(() => ({}))) as { error?: string }
        expect(corpo.error).not.toBe("profile_check_unavailable")
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
