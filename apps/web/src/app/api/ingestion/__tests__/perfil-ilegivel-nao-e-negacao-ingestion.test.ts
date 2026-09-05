import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// "NÃO TEM DIREITO" ≠ "NÃO DEU PARA VERIFICAR" — nas 8 rotas de `api/ingestion`.
// ---------------------------------------------------------------------------
// MESMO DEFEITO, MESMA FORMA, OUTRA FAMÍLIA. A rodada FIX-B trancou 8 rotas do
// course-designer e registrou que elas eram AMOSTRA, não censo: outras 39 rotas
// repetem o E→NEGA byte a byte. Estas oito são a maior família contígua.
//
//     const { data: profile } = await supabase.from("users")
//       .select("role, tenant_id").eq("id", user.id).single()
//     if (!profile || !["manager","admin","instructor"].includes(profile.role))
//       return 403 "Permissão negada"
//
// O `error` do `.single()` nunca é destructurado. Num timeout de statement `data`
// volta `null`, `profile` fica `null`, e a condição `!profile` despacha o MESMO
// 403 que um aluno receberia. Quem estava subindo um PDF de 80 páginas lê
// "Permissão negada" e conclui que perdeu o acesso.
//
// Agrava aqui: `ingestion` é fluxo de várias etapas (upload → process → approve).
// Um 403 no meio não parece transitório, parece revogação de papel — e o usuário
// abandona o material já enviado em vez de tentar de novo.
//
// CONTROLE POSITIVO ([CP]): passam ANTES e DEPOIS. Travam a correção degenerada
// "responde 503 sempre" e travam a decisão de projeto de que `PGRST116` (zero
// linhas) continua 403 — a leitura ACONTECEU e o veredito "não há perfil" é
// legítimo; virar 503 esconderia um usuário órfão atrás de um "tente de novo"
// que jamais resolveria.
//
// NENHUMA ESCRITA, NENHUMA REDE: o cliente Supabase inteiro é duplo em memória e
// todo extrator/agente/limiter está mockado. Nada aqui chega perto de banco,
// storage, LLM ou YouTube.
// ---------------------------------------------------------------------------

const USUARIO = "11111111-1111-1111-1111-111111111111"
const TENANT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const INGESTAO = "44444444-4444-4444-4444-444444444444"

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

/** Resultado das leituras que NÃO são `users` — sempre erro, para a rota parar cedo. */
const OUTRAS_TABELAS: Resultado = { data: null, error: ERRO_TRANSITORIO }

/**
 * Duplo do cliente Supabase. Qualquer encadeamento (`.select().eq().order()…`)
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
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: { message: "storage fora do teste" } }),
        remove: async () => ({ data: null, error: null }),
        createSignedUrl: async () => ({ data: null, error: { message: "storage fora do teste" } }),
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
// Limitadores desligados: 429 não é o assunto deste arquivo.
vi.mock("@/lib/rate-limit", () => ({
  ingestionLimiter: null,
  ingestionApprovalLimiter: null,
}))
// Extração e geração ficam fora: o veredito medido aqui é só o do guard de papel.
vi.mock("@/lib/extractors", () => ({
  extractTextEnhanced: async () => ({ text: "", method: "stub" }),
  isAudioMime: () => false,
  transcribeAudio: async () => ({ text: "" }),
  extractYouTubeTranscript: async () => ({ text: "", title: "stub" }),
  isYouTubeUrl: () => true,
}))
vi.mock("@eximia/agents", () => ({
  organizeContent: async () => ({ chapters: [] }),
}))
vi.mock("@/lib/question-generation", () => ({
  startBatchGeneration: async () => undefined,
}))
vi.mock("@/lib/generate-questions-for-chapter", () => ({
  generateQuestionsForChapter: async () => undefined,
}))
vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
}))

import { POST as aprovarCapitulo } from "../[id]/approve-chapter/route"
import { POST as aprovar } from "../[id]/approve/route"
import { POST as processar } from "../[id]/process/route"
import { DELETE as deletar } from "../[id]/route"
import { GET as status } from "../[id]/status/route"
import { POST as colar } from "../paste/route"
import { POST as enviarArquivo } from "../upload/route"
import { POST as videoUrl } from "../video-url/route"

const contexto = { params: Promise.resolve({ id: INGESTAO }) }

function json(url: string, corpo: unknown) {
  return new Request(url, {
    method: "POST",
    body: JSON.stringify(corpo),
    headers: { "content-type": "application/json" },
  })
}

/** Cada rota reduzida ao que interessa: um nome e uma chamada que devolve `Response`. */
const ROTAS: Array<{ nome: string; chamar: () => Promise<Response> }> = [
  {
    nome: "DELETE /api/ingestion/[id]",
    chamar: () => deletar(new Request("http://t/api/ingestion/x", { method: "DELETE" }), contexto),
  },
  {
    nome: "POST /api/ingestion/[id]/approve",
    chamar: () => aprovar(json("http://t/api/ingestion/x/approve", { chapters: [] }), contexto),
  },
  {
    nome: "POST /api/ingestion/[id]/approve-chapter",
    chamar: () =>
      aprovarCapitulo(json("http://t/api/ingestion/x/approve-chapter", { index: 0 }), contexto),
  },
  {
    nome: "POST /api/ingestion/[id]/process",
    chamar: () => processar(json("http://t/api/ingestion/x/process", {}), contexto),
  },
  {
    nome: "GET /api/ingestion/[id]/status",
    chamar: () => status(new Request("http://t/api/ingestion/x/status"), contexto),
  },
  {
    nome: "POST /api/ingestion/paste",
    chamar: () => colar(json("http://t/api/ingestion/paste", { text: "x".repeat(200) })),
  },
  {
    nome: "POST /api/ingestion/upload",
    chamar: () =>
      enviarArquivo(
        new Request("http://t/api/ingestion/upload", { method: "POST", body: new FormData() }),
      ),
  },
  {
    nome: "POST /api/ingestion/video-url",
    chamar: () =>
      videoUrl(json("http://t/api/ingestion/video-url", { url: "https://youtu.be/abc" })),
  },
]

/**
 * A LISTA DE PAPÉIS É ELA PRÓPRIA UMA ASSERÇÃO.
 *
 * As oito rotas aceitam `["manager","admin","instructor"]` — **sem `super_admin`**,
 * conferido contra `HEAD` antes da correção. As do course-designer aceitam quatro.
 * Um teste que só experimenta UM papel aceito e UM recusado não distingue a lista
 * certa da errada: trocar `PAPEIS_CONTEUDO` por `PAPEIS_COURSE_DESIGNER` aqui
 * **alargaria o acesso em silêncio** e a suíte continuaria verde.
 *
 * Por isso o par abaixo é exaustivo nos dois sentidos: cada papel de dentro entra,
 * cada papel de fora não entra. `super_admin` está em `RECUSADOS` de propósito — é
 * o papel exato pelo qual a lista erraria, e é ele quem mata o mutante.
 *
 * Isto NÃO é opinião sobre quem deveria ter direito: é o registro de quem já tinha.
 * A tarefa desta rodada é distinguir "não deu para verificar" de "não tem direito",
 * jamais mudar quem tem direito.
 */
const ACEITOS = ["manager", "admin", "instructor"] as const
const RECUSADOS = ["super_admin", "student"] as const

beforeEach(() => {
  usuarioAutenticado = { id: USUARIO }
  perfilRetornado = { data: { role: "manager", tenant_id: TENANT }, error: null }
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("ingestion — perfil ilegível não é negação de direito", () => {
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

    it(`[CP] ${rota.nome} — perfil inexistente continua 403, não 503`, async () => {
      perfilRetornado = { data: null, error: ERRO_ZERO_LINHAS }

      const resposta = await rota.chamar()

      expect(resposta.status).toBe(403)
    })

    for (const papel of ACEITOS) {
      it(`[CP] ${rota.nome} — ${papel} atravessa o guard`, async () => {
        perfilRetornado = { data: { role: papel, tenant_id: TENANT }, error: null }

        const resposta = await rota.chamar()

        // Não afirmamos 200: cada rota segue para leituras/extração que este
        // teste não encena. Afirmamos que o GUARD deixou passar — nem negou,
        // nem se declarou indisponível por causa do perfil.
        expect(resposta.status).not.toBe(403)
        expect(resposta.status).not.toBe(401)
        const corpo = (await resposta.json().catch(() => ({}))) as { error?: string }
        expect(corpo.error).not.toBe("profile_check_unavailable")
      })
    }

    for (const papel of RECUSADOS) {
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
