import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// "NÃO TEM DIREITO" ≠ "NÃO DEU PARA VERIFICAR" — família `api/admin/**`.
// ---------------------------------------------------------------------------
// Mesmo defeito que `src/app/api/__tests__/perfil-ilegivel-nao-e-negacao.test.ts`
// trancou para as 8 rotas do Course Designer, agora nas rotas administrativas.
// A leitura de perfil chega em três formas nesta família, e as três descartam o
// `error`:
//
//   1. `requireManager(supabase)` local — copiado byte a byte em 8 arquivos de
//      `admin/books/**`; devolve `{ user, profile: null }`, e quem chama traduz
//      `!profile` em 403 "Forbidden".
//   2. leitura inline no corpo do handler — `admin/users` (GET e POST, duas
//      cópias no mesmo arquivo) e `admin/books/[bookId]/upload-pdf/status`.
//   3. `getAdminProfile` / `getAdminContext` — `admin/users/[userId]` e
//      `admin/sso` (esta última lendo pelo cliente de serviço).
//
// Em qualquer uma delas, um timeout de statement faz `data` voltar `null`, e o
// `null` da falha é indistinguível do `null` de "não é admin". O administrador
// legítimo lê "Forbidden" quando a verdade é "não conseguimos confirmar".
//
// CUIDADO ESPECÍFICO DESTA FAMÍLIA: estas rotas guardam operação privilegiada
// (criar livro, convidar/remover usuário, configurar SSO). A correção precisa
// distinguir os dois desfechos SEM MUDAR quem tem direito — por isso cada rota
// carrega uma MATRIZ DE PAPÉIS: os seis papéis do produto, um por vez, cada um
// afirmando entrar ou ser barrado conforme a lista que a rota já tinha.
//
// Por que a matriz, e não um `student` de amostra: um teste que só experimenta
// `student` fora e `admin` dentro fica VERDE se alguém trocar
// `["admin","super_admin"]` pela lista de quatro papéis do Course Designer —
// `student` continuaria barrado, `admin` continuaria passando, e `manager` e
// `instructor` ganhariam a administração do acervo em silêncio. Medido: essa
// troca mata 18 casos desta matriz, e os 18 são exatamente `manager` e
// `instructor`. Sem eles, o alargamento passa despercebido.
//
// NENHUMA ESCRITA: o cliente Supabase inteiro é um duplo em memória, `fetch` é
// stub, e `next/headers` é dublê. Nenhuma rota aqui alcança banco, storage,
// e-mail, LLM ou a Admin API do Supabase.
// ---------------------------------------------------------------------------

const USUARIO = "11111111-1111-1111-1111-111111111111"
const TENANT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const LIVRO = "22222222-2222-2222-2222-222222222222"
const CAPITULO = "33333333-3333-3333-3333-333333333333"
const ALVO = "44444444-4444-4444-4444-444444444444"

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

/**
 * `admin/users` lê a tabela `users` DUAS vezes: o perfil de quem chama
 * (`.single()`) e a LISTAGEM do tenant (`await` direto). As duas precisam de
 * formas diferentes — devolver o objeto de perfil para a listagem faria a rota
 * estourar em `items.map`, e um estouro não é veredito de autorização.
 */
const LISTA_VAZIA = { data: [], error: null, count: 0 }

/**
 * Duplo do cliente Supabase. Qualquer encadeamento devolve o mesmo proxy; os
 * terminais (`await`, `.single()`, `.maybeSingle()`) resolvem no resultado da
 * tabela pedida.
 */
function clienteFake() {
  const construir = (tabela: string) => {
    const ehUsers = tabela === "users"
    const alvoSingular: Resultado = ehUsers ? perfilRetornado : OUTRAS_TABELAS
    const alvoPlural = ehUsers ? LISTA_VAZIA : OUTRAS_TABELAS
    // biome-ignore lint/suspicious/noExplicitAny: duplo de um builder sem tipo estável
    const elo: any = new Proxy(() => elo, {
      get(_alvoProxy, prop) {
        if (prop === "then") {
          // biome-ignore lint/suspicious/noExplicitAny: assinatura de thenable
          return (ok: any, falha: any) => Promise.resolve(alvoPlural).then(ok, falha)
        }
        if (prop === "single" || prop === "maybeSingle") return () => Promise.resolve(alvoSingular)
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
        // biome-ignore lint/suspicious/noExplicitAny: superfície mínima da Admin API
        inviteUserByEmail: async (): Promise<any> => ({ data: null, error: { message: "duplo" } }),
        // biome-ignore lint/suspicious/noExplicitAny: idem
        deleteUser: async (): Promise<any> => ({ data: null, error: { message: "duplo" } }),
        // biome-ignore lint/suspicious/noExplicitAny: idem
        listUsers: async (): Promise<any> => ({ data: { users: [] }, error: null }),
        // biome-ignore lint/suspicious/noExplicitAny: idem
        generateLink: async (): Promise<any> => ({ data: null, error: { message: "duplo" } }),
      },
    },
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: { message: "duplo" } }),
        remove: async () => ({ data: null, error: { message: "duplo" } }),
        getPublicUrl: () => ({ data: { publicUrl: "http://duplo/x" } }),
      }),
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
  analyticsAggregateLimiter: null,
  analyticsIndividualLimiter: null,
  semanticAnalysisLimiter: null,
}))
// Sem cookie de tenant ativo: irrelevante para o veredito do guard, e evita
// tocar o escopo de request do Next dentro do vitest.
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers(),
}))
vi.mock("@/lib/audit", () => ({
  logAdminAction: async () => undefined,
}))

import {
  DELETE as apagarCapitulo,
  PATCH as editarCapitulo,
} from "../books/[bookId]/chapters/[chapterId]/route"
import { POST as reordenarCapitulos } from "../books/[bookId]/chapters/reorder/route"
import { GET as listarCapitulos } from "../books/[bookId]/chapters/route"
import { GET as lerLivro } from "../books/[bookId]/route"
import { POST as enviarPdf } from "../books/[bookId]/upload-pdf/route"
import { GET as statusDoPdf } from "../books/[bookId]/upload-pdf/status/route"
import { POST as buscarNotas } from "../books/fetch-ratings/route"
import { GET as buscarLivros, POST as criarLivro } from "../books/route"
import { GET as pesquisarLivros } from "../books/search/route"
import { GET as lerSso } from "../sso/route"
import { PATCH as editarUsuario } from "../users/[userId]/route"
import { POST as convidarUsuario, GET as listarUsuarios } from "../users/route"

/**
 * O universo de papéis do produto (enum de `patchSchema` em
 * `admin/users/[userId]`, mais `super_admin`). Toda rota abaixo declara quais
 * ACEITA; o complemento é o conjunto que ela precisa RECUSAR, e o teste cobre
 * os dois lados. Sem isso, um teste que só experimenta `student` fora e `admin`
 * dentro fica verde mesmo se alguém trocar `["admin","super_admin"]` pela lista
 * de quatro papéis do Course Designer — `manager` e `instructor` ganhariam a
 * administração do acervo em silêncio.
 */
const TODOS_OS_PAPEIS = [
  "student",
  "leader",
  "manager",
  "instructor",
  "admin",
  "super_admin",
] as const

/** Transcrições 1:1 das listas que cada rota já tinha em `HEAD`. Verificadas arquivo a arquivo. */
const ACERVO = ["admin", "super_admin"] as const
const ACOMPANHAMENTO_DE_PDF = ["manager", "admin", "super_admin"] as const
const ADMINISTRACAO = ["admin", "super_admin"] as const

/**
 * Uma entrada por CÓPIA do guard — não por arquivo e não por handler. Onde o
 * `requireManager` é compartilhado entre GET/PATCH/DELETE do mesmo arquivo, um
 * handler basta; onde o mesmo arquivo tem duas leituras independentes
 * (`admin/users`), as duas entram.
 */
const ROTAS: Array<{
  nome: string
  chamar: () => Promise<Response>
  /** Papéis que ESTA rota aceita. Não é a lista "do admin", é a dela. */
  aceitos: readonly string[]
  /**
   * O caminho feliz devolve um SSE que só fecha em estado terminal. Ler o corpo
   * nesse caso pendura o teste; a asserção de "atravessou o guard" é o status.
   */
  fluxoContinuo?: true
}> = [
  {
    nome: "GET /api/admin/books",
    aceitos: ACERVO,
    chamar: () => buscarLivros(),
  },
  {
    nome: "POST /api/admin/books",
    aceitos: ACERVO,
    chamar: () =>
      criarLivro(
        new Request("http://t/api/admin/books", {
          method: "POST",
          body: JSON.stringify({ title: "t", author: "a", category: "c" }),
          headers: { "content-type": "application/json" },
        }),
      ),
  },
  {
    nome: "GET /api/admin/books/[bookId]",
    aceitos: ACERVO,
    chamar: () =>
      lerLivro(new Request("http://t/api/admin/books/x"), {
        params: Promise.resolve({ bookId: LIVRO }),
      }),
  },
  {
    nome: "GET /api/admin/books/[bookId]/chapters",
    aceitos: ACERVO,
    chamar: () =>
      listarCapitulos(new Request("http://t/api/admin/books/x/chapters"), {
        params: Promise.resolve({ bookId: LIVRO }),
      }),
  },
  {
    nome: "PATCH /api/admin/books/[bookId]/chapters/[chapterId]",
    aceitos: ACERVO,
    chamar: () =>
      editarCapitulo(
        new Request("http://t/api/admin/books/x/chapters/y", {
          method: "PATCH",
          body: JSON.stringify({ title: "t" }),
          headers: { "content-type": "application/json" },
        }),
        { params: Promise.resolve({ bookId: LIVRO, chapterId: CAPITULO }) },
      ),
  },
  {
    nome: "POST /api/admin/books/[bookId]/chapters/reorder",
    aceitos: ACERVO,
    chamar: () =>
      reordenarCapitulos(
        new Request("http://t/api/admin/books/x/chapters/reorder", {
          method: "POST",
          body: JSON.stringify({ chapterIds: [CAPITULO] }),
          headers: { "content-type": "application/json" },
        }),
        { params: Promise.resolve({ bookId: LIVRO }) },
      ),
  },
  {
    nome: "POST /api/admin/books/[bookId]/upload-pdf",
    aceitos: ACERVO,
    chamar: () =>
      enviarPdf(new Request("http://t/api/admin/books/x/upload-pdf", { method: "POST" }), {
        params: Promise.resolve({ bookId: LIVRO }),
      }),
  },
  {
    nome: "GET /api/admin/books/[bookId]/upload-pdf/status",
    aceitos: ACOMPANHAMENTO_DE_PDF,
    chamar: () =>
      statusDoPdf(new Request("http://t/api/admin/books/x/upload-pdf/status"), {
        params: Promise.resolve({ bookId: LIVRO }),
      }),
    fluxoContinuo: true,
  },
  {
    nome: "POST /api/admin/books/fetch-ratings",
    aceitos: ACERVO,
    chamar: () => buscarNotas(),
  },
  {
    nome: "GET /api/admin/books/search",
    aceitos: ACERVO,
    chamar: () => pesquisarLivros(new Request("http://t/api/admin/books/search?q=teste")),
  },
  {
    nome: "GET /api/admin/users",
    aceitos: ADMINISTRACAO,
    chamar: () => listarUsuarios(new Request("http://t/api/admin/users")),
  },
  {
    nome: "POST /api/admin/users",
    aceitos: ADMINISTRACAO,
    chamar: () =>
      convidarUsuario(
        new Request("http://t/api/admin/users", {
          method: "POST",
          body: JSON.stringify({ email: "a@b.co", role: "student", full_name: "Fulano" }),
          headers: { "content-type": "application/json" },
        }),
      ),
  },
  {
    nome: "PATCH /api/admin/users/[userId]",
    aceitos: ADMINISTRACAO,
    chamar: () =>
      editarUsuario(
        new Request("http://t/api/admin/users/x", {
          method: "PATCH",
          body: JSON.stringify({ status: "inactive" }),
          headers: { "content-type": "application/json" },
        }),
        { params: Promise.resolve({ userId: ALVO }) },
      ),
  },
  {
    nome: "GET /api/admin/sso",
    aceitos: ADMINISTRACAO,
    chamar: () => lerSso(),
  },
]

beforeEach(() => {
  usuarioAutenticado = { id: USUARIO }
  perfilRetornado = { data: { role: "admin", tenant_id: TENANT }, error: null }
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.spyOn(console, "warn").mockImplementation(() => {})
  // Nenhuma rota desta família pode sair para a rede dentro deste arquivo.
  vi.stubGlobal("fetch", async () => new Response("{}", { status: 500 }))
})

describe("perfil ilegível não é negação de direito — api/admin", () => {
  for (const rota of ROTAS) {
    it(`${rota.nome} — falha ao LER o perfil não pode virar 403`, async () => {
      perfilRetornado = { data: null, error: ERRO_TRANSITORIO }

      const resposta = await rota.chamar()

      // O coração do defeito: hoje todas devolvem 403 "Forbidden".
      expect(resposta.status).not.toBe(403)
      // E o que devem devolver: indisponibilidade retentável, como o feature-gate.
      expect(resposta.status).toBe(503)
      expect(resposta.headers.get("Retry-After")).toBeTruthy()
      const corpo = (await resposta.json()) as { error?: string }
      expect(corpo.error).toBe("profile_check_unavailable")
    })

    // ---- Matriz de papéis: os DOIS lados da lista, papel a papel. ----------
    // Um único caso de "papel de fora é barrado" não detecta lista alargada:
    // trocar `["admin","super_admin"]` pela lista de quatro do Course Designer
    // deixaria `student` barrado (verde) e `admin` passando (verde), com
    // `manager` e `instructor` ganhando acesso administrativo em silêncio. Só a
    // matriz completa fecha isso, e ela fecha nas duas direções — alargar E
    // estreitar.
    for (const papel of TODOS_OS_PAPEIS) {
      const deveEntrar = rota.aceitos.includes(papel)

      it(`[CP] ${rota.nome} — \`${papel}\` ${deveEntrar ? "É ACEITO" : "é RECUSADO"}`, async () => {
        perfilRetornado = { data: { role: papel, tenant_id: TENANT }, error: null }

        const resposta = await rota.chamar()

        if (!deveEntrar) {
          expect(resposta.status).toBe(403)
          return
        }

        // Aceito = o GUARD deixou passar. Não afirmamos 200: a rota segue para
        // leituras que este teste não encena.
        expect(resposta.status).not.toBe(403)
        expect(resposta.status).not.toBe(401)
        if (rota.fluxoContinuo) {
          await resposta.body?.cancel()
          return
        }
        const corpo = (await resposta.json().catch(() => ({}))) as { error?: string }
        expect(corpo.error).not.toBe("profile_check_unavailable")
      })
    }

    it(`[CP] ${rota.nome} — perfil inexistente continua 403, não 503`, async () => {
      // Zero linhas NÃO é indisponibilidade: a leitura funcionou e a resposta é
      // "esta pessoa não tem perfil".
      perfilRetornado = { data: null, error: ERRO_ZERO_LINHAS }

      const resposta = await rota.chamar()

      expect(resposta.status).toBe(403)
    })

    it(`[CP] ${rota.nome} — sem sessão jamais vira indisponibilidade de perfil`, async () => {
      // A recusa por ausência de sessão acontece ANTES de qualquer leitura de
      // perfil. Se a correção passasse a responder 503 aqui, estaria inventando
      // indisponibilidade onde nada foi lido. (Os status desta família não são
      // uniformes: `admin/sso` recusa a sessão ausente com 403, as demais com
      // 401 — por isso a asserção é sobre o que NÃO pode acontecer.)
      usuarioAutenticado = null

      const resposta = await rota.chamar()

      expect(resposta.status).not.toBe(503)
      if (rota.fluxoContinuo) {
        await resposta.body?.cancel()
        return
      }
      const corpo = (await resposta.json().catch(() => ({}))) as { error?: string }
      expect(corpo.error).not.toBe("profile_check_unavailable")
    })
  }
})
