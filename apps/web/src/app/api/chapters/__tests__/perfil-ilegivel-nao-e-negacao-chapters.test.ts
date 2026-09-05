import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// "NÃO TEM DIREITO" ≠ "NÃO DEU PARA VERIFICAR" — família `api/chapters/**`.
// ---------------------------------------------------------------------------
// Mesmo defeito que `src/app/api/__tests__/perfil-ilegivel-nao-e-negacao.test.ts`
// trancou nas oito primeiras rotas (laudo LOOP-0c, tabela E→NEGA), repetido byte a
// byte aqui:
//
//     const { data: profile } = await supabase.from("users")
//       .select("role, tenant_id").eq("id", user.id).single()
//     if (!profile || !PAPEIS.includes(profile.role)) return 403
//
// O `error` do `.single()` nunca é destructurado. Num timeout de statement, `data`
// volta `null` e a rota despacha o MESMO 403 que um estagiário receberia.
//
// POR QUE ESTA FAMÍLIA PESA MAIS QUE AS OUTRAS: `chapters` fica no caminho de quem
// PRODUZ o material que o aluno consome — gerar áudio, gerar perguntas, subir e
// narrar slides. Um blip de leitura aqui não devolve "tente de novo": devolve
// "Permissão negada" a um instrutor legítimo no meio da aula que ele está montando,
// e a mensagem convida a pedir acesso a alguém, não a repetir a ação.
//
// CONTROLE POSITIVO (o que impede a correção degenerada "responde 503 sempre"):
// os casos [CP] passam ANTES e DEPOIS da correção. Se o remédio deixasse entrar
// quem não tem papel, ou chamasse de indisponível um perfil lido sem erro, eles
// ficariam vermelhos.
//
// POR QUE MATRIZ, E NÃO AMOSTRA (2026-08-30, achado 1 da verificação cruzada):
// este arquivo experimentava `student` fora e `instructor`/`manager` dentro — e
// isso NÃO é uma régua da lista, é uma régua de dois pontos dela. `admin` está
// na lista aceita e nunca era afirmado; `super_admin` está fora e nunca era
// afirmado. Medido: remover `admin` de `generate-audio` deixava **31/31 VERDE**,
// e acrescentar `leader` deixava a suíte inteira de `api` em **912/912 VERDE**.
//
// O estreitamento é o que dói mais, e é contraintuitivo: alargar acesso é o que
// todo mundo teme, mas NEGAR ACESSO A QUEM TEM DIREITO é o defeito que esta
// auditoria inteira existe para corrigir. Alguém que "limpe" a lista removendo
// `admin` derruba o administrador em seis rotas de produção de conteúdo, e a
// suíte aplaude.
//
// NENHUMA ESCRITA E NENHUMA REDE: o cliente Supabase inteiro é um duplo em memória,
// e todo módulo que falaria com ElevenLabs / OpenAI / extrator está mockado.
// ---------------------------------------------------------------------------

const USUARIO = "11111111-1111-1111-1111-111111111111"
const TENANT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const CAPITULO = "22222222-2222-2222-2222-222222222222"

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

/**
 * Duplo do cliente Supabase. Qualquer encadeamento devolve o mesmo proxy; os
 * terminais (`await`, `.single()`, `.maybeSingle()`) resolvem no resultado da
 * tabela pedida.
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
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: ERRO_TRANSITORIO }),
        getPublicUrl: () => ({ data: { publicUrl: "http://t/x" } }),
      }),
    },
  }
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => clienteFake(),
}))
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => clienteFake(),
}))
// Nada de rede: se o guard deixar passar, a rota para na leitura do capítulo, mas
// os módulos abaixo não podem sequer existir como caminho para fora da máquina.
vi.mock("@/lib/elevenlabs", () => ({
  generatePodcastAudio: async () => new ArrayBuffer(0),
  generatePodcastScript: async () => [],
  generateSpeech: async () => new ArrayBuffer(0),
}))
vi.mock("@/lib/slide-text-generator", () => ({
  generateTextsForChapterSlides: async () => ({ processed: 0, errors: [] }),
}))
vi.mock("@/lib/extractors/slide-splitter", () => ({
  extractSlidesFromPdf: async () => [],
  extractSlidesFromPptx: async () => [],
  processImageAsSlide: async () => [],
}))
vi.mock("@eximia/agents", () => ({
  creatorInputSchema: { parse: (v: unknown) => v },
  generateQuestions: async () => ({ questions: [] }),
}))
vi.mock("@/lib/analytics-server", () => ({
  analyticsServer: { questionGenerated: () => undefined },
}))

import { POST as gerarAudio } from "../[chapterId]/generate-audio/route"
import { POST as gerarPerguntas } from "../[chapterId]/generate-questions/route"
import { POST as gerarTextoDeSlides } from "../[chapterId]/slides/generate-text/route"
import { POST as sincronizarAudio } from "../[chapterId]/slides/sync-audio/route"
import { POST as subirSlides } from "../[chapterId]/slides/upload/route"
import { POST as gerarCenario } from "../generate-scenario/route"

const params = { params: Promise.resolve({ chapterId: CAPITULO }) }

/**
 * O universo de papéis do produto — o mesmo das matrizes de `api/admin/**` e
 * `api/analytics/**`. Toda rota declara quais ACEITA; o complemento é o conjunto
 * que ela precisa RECUSAR, e a matriz afirma os dois lados, papel a papel.
 *
 * QUEM DISCRIMINA O QUÊ, nesta família (importa mais que a lista em si):
 *   • `student`   — recusado por TODAS as listas do produto. Não discrimina nada:
 *                   é o papel que já estava aqui, e é por isso que a régua antiga
 *                   media o vazio no lado de fora.
 *   • `admin`     — ACEITO e nunca afirmado até 2026-08-30. É ele que pega o
 *                   ESTREITAMENTO, o defeito que esta auditoria existe para
 *                   corrigir.
 *   • `super_admin` — RECUSADO por estas seis rotas e nunca afirmado. É ele que
 *                   pega o ALARGAMENTO por dentro do próprio vocabulário de
 *                   autorização, e é um papel que EXISTE em `users.role` neste
 *                   banco — logo, ameaça alcançável.
 *   • `leader`    — EXISTE no vocabulário deste banco, e por isso é ameaça
 *                   ALCANÇÁVEL, igual a `super_admin`. NÃO REMOVA ESTE CASO.
 *                   A restrição vigente de `users.role` é a de
 *                   `20260518000000_leader_role.sql` — a ÚLTIMA das quatro
 *                   migrations que definem `users_role_check` (20260209 →
 *                   20260210 → 20260228100000 → 20260518000000) — e ela inclui
 *                   `leader`. Uma linha com esse papel é inserível hoje, e
 *                   `20260604140000_fix_area_gestor_rls.sql` ainda estava
 *                   estreitando a RLS dele em junho de 2026: papel vivo, não
 *                   peso morto.
 *
 *                   O comentário anterior dizia o contrário, citando
 *                   `20260803000000_onboarding_novidades.sql`. Aquela migration
 *                   não cataloga papéis: ela semeia `audience_roles` de
 *                   anúncios, um `TEXT[]` que ela própria declara sem CHECK
 *                   fechado, e duas das três linhas semeadas listam `teacher` E
 *                   `leader`. O que ela mede é a POPULAÇÃO de hoje; o que
 *                   autoriza uma escrita é o DOMÍNIO aceito. Confundir os dois
 *                   é o que transforma este caso em "peso morto" aos olhos de
 *                   quem for fazer a limpeza óbvia — e a limpeza reabre o furo
 *                   que esta matriz fechou.
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
 * Transcrição 1:1 da lista que as seis rotas já tinham. Conferida arquivo a
 * arquivo: as três literais em linha (`generate-audio`, `generate-questions`,
 * `generation-scenario`) e as três multilinha (`slides/*`) são o MESMO conjunto,
 * em ordens diferentes.
 *
 * REGISTRO, NÃO PROPOSTA: `super_admin` está FORA desta lista enquanto o
 * `PAPEIS_COURSE_DESIGNER` do mesmo `lib/api-role-guard.ts` o inclui. A
 * divergência é anterior a esta régua e não é dela para resolver — RBAC é
 * decisão do dono do produto. O que a matriz faz é impedir que a divergência
 * mude de lado sem ninguém ver, para qualquer um dos dois lados.
 */
const PRODUCAO_DE_CONTEUDO = ["manager", "admin", "instructor"] as const

/** Cada rota reduzida ao que interessa: um nome, uma lista de aceitos, uma chamada. */
const ROTAS: Array<{
  nome: string
  /** Papéis que ESTA rota aceita. Não é "a lista da família", é a dela. */
  aceitos: readonly string[]
  chamar: () => Promise<Response>
}> = [
  {
    nome: "POST /api/chapters/[id]/generate-audio",
    aceitos: PRODUCAO_DE_CONTEUDO,
    chamar: () =>
      gerarAudio(
        new Request("http://t/api/chapters/x/generate-audio", {
          method: "POST",
          body: JSON.stringify({ mode: "narration" }),
          headers: { "content-type": "application/json" },
        }),
        params,
      ),
  },
  {
    nome: "POST /api/chapters/[id]/generate-questions",
    aceitos: PRODUCAO_DE_CONTEUDO,
    chamar: () =>
      gerarPerguntas(
        new Request("http://t/api/chapters/x/generate-questions", { method: "POST" }),
        params,
      ),
  },
  {
    nome: "POST /api/chapters/[id]/slides/generate-text",
    aceitos: PRODUCAO_DE_CONTEUDO,
    chamar: () =>
      gerarTextoDeSlides(
        new Request("http://t/api/chapters/x/slides/generate-text", { method: "POST" }),
        params,
      ),
  },
  {
    nome: "POST /api/chapters/[id]/slides/sync-audio",
    aceitos: PRODUCAO_DE_CONTEUDO,
    chamar: () =>
      sincronizarAudio(
        new Request("http://t/api/chapters/x/slides/sync-audio", {
          method: "POST",
          body: JSON.stringify({ totalDurationMs: 60000 }),
          headers: { "content-type": "application/json" },
        }),
        params,
      ),
  },
  {
    nome: "POST /api/chapters/[id]/slides/upload",
    aceitos: PRODUCAO_DE_CONTEUDO,
    chamar: () =>
      subirSlides(
        new Request("http://t/api/chapters/x/slides/upload", {
          method: "POST",
          body: new FormData(),
        }),
        params,
      ),
  },
  {
    nome: "POST /api/chapters/generate-scenario",
    aceitos: PRODUCAO_DE_CONTEUDO,
    chamar: () =>
      gerarCenario(
        new Request("http://t/api/chapters/generate-scenario", {
          method: "POST",
          body: JSON.stringify({}),
          headers: { "content-type": "application/json" },
        }),
      ),
  },
]

beforeEach(() => {
  usuarioAutenticado = { id: USUARIO }
  perfilRetornado = { data: { role: "instructor", tenant_id: TENANT }, error: null }
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("perfil ilegível não é negação de direito — chapters", () => {
  for (const rota of ROTAS) {
    it(`${rota.nome} — falha ao LER o perfil não pode virar 403`, async () => {
      perfilRetornado = { data: null, error: ERRO_TRANSITORIO }

      const resposta = await rota.chamar()

      // O coração do defeito: hoje todas devolvem 403.
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

        // Aceito = o GUARD deixou passar. Não afirmamos 200: cada rota segue
        // para leituras que este teste não encena.
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
