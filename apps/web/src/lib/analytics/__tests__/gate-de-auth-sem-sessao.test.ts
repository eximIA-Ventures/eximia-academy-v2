// ---------------------------------------------------------------------------
// B3/B4 — os dois gates de auth que nenhum teste exercia.
// ---------------------------------------------------------------------------
// O DEFEITO QUE ISTO ARRANCA (laudo LOOP-2, Eixo B). O gate de `/analytics`
// tem DOIS ramos, e só um estava provado:
//
//   B1/B2 (já provados) — "quem não tem o chapéu vai para /dashboard".
//   B3    (ESTE)        — "quem não tem SESSÃO vai para /login".
//
// `analytics-redirect.test.ts` sempre mocka um usuário PRESENTE (`user: {id}`,
// `profile: {...}`), variando só os papéis. O ramo `!user || !profile` nunca era
// exercido: apagá-lo mantinha a suíte verde.
//
// B4 é pior de grau: `resolverRecorteAutogestao`, o gate da rota do ALUNO
// (`/jornada?vista=autogestao`), tinha cobertura ZERO. Os três testes de painel
// que existem (`_visao-geral`, `_padroes`) MOCKAM essa função — ela nunca roda.
// Trocar o gate por `if (false)` não movia um único teste.
//
// POR QUE OS DOIS PRECISAM DE CONTROLE POSITIVO: um teste que só assere "foi
// para /login" passaria numa rota que manda TODO MUNDO para /login, que é uma
// tela quebrada, não um gate. Cada caso aqui vem emparelhado com o seu oposto —
// mesma disciplina do bloco "controle positivo" de `analytics-redirect.test.ts`.
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from "vitest"
import { bancoQueFiltra } from "./banco-que-filtra"

/** O que `getAuthProfile` devolve nesta rodada — é o único eixo que muda. */
let sessaoAtual: { user: unknown; profile: unknown; roles: string[] } = {
  user: null,
  profile: null,
  roles: [],
}

/** Matrículas visíveis ao cliente AUTENTICADO — só o controle positivo de B4 usa. */
let matriculas: Record<string, unknown>[] = []

vi.mock("@/lib/auth", () => ({
  getAuthProfile: vi.fn(async () => ({
    user: sessaoAtual.user,
    profile: sessaoAtual.profile,
    roles: sessaoAtual.roles,
    supabase: bancoQueFiltra({ enrollments: matriculas }).db,
  })),
  resolveTenantId: vi.fn(async (id: string | null) => id ?? "tenant-1"),
}))

vi.mock("next/navigation", () => ({
  redirect: vi.fn((destino: string) => {
    throw new Error(`NEXT_REDIRECT:${destino}`)
  }),
}))

// O client de SERVIÇO só é pedido DEPOIS do gate. Ele existe aqui apenas para
// que o controle positivo consiga atravessar a função inteira — se o gate
// barrasse quem tem sessão, nunca chegaríamos até aqui.
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({}) }))

// A página lê o cookie de unidade antes do despacho de aba. Sem este duplo, o
// `next/headers` real lança fora de um request do Next — e o `catch` do
// helper engoliria a exceção, mascarando a asserção.
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(() => undefined),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}))

const COM_SESSAO = {
  user: { id: "user-1" },
  profile: { full_name: "Fulana", role: "manager", tenant_id: "tenant-1" },
  roles: ["manager"],
}
const SEM_SESSAO = { user: null, profile: null, roles: [] as string[] }

/** `redirect()` lança; a asserção é sempre sobre a CHAMADA, nunca sobre terminar. */
async function semExplodir(f: () => Promise<unknown>) {
  try {
    await f()
  } catch {
    // Pode ser o NEXT_REDIRECT esperado, ou o corpo real querendo banco mais
    // adiante no caminho já liberado. Nenhum dos dois é a asserção.
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  sessaoAtual = SEM_SESSAO
  matriculas = []
})

// ===========================================================================
// B3 — `/analytics`: sem sessão vai para /login, não para /dashboard
// ===========================================================================
describe("B3 — o gate de /analytics tem o ramo 'sem sessão', e ele vai para /login", () => {
  async function abrirAnalytics(params: Record<string, string | undefined> = {}) {
    const { default: AnalyticsPage } = await import("../../../app/(platform)/analytics/page")
    await semExplodir(() => AnalyticsPage({ searchParams: Promise.resolve(params) }))
  }

  it("visitante sem sessão é mandado para /login", async () => {
    const { redirect } = await import("next/navigation")
    sessaoAtual = SEM_SESSAO
    await abrirAnalytics()
    expect(redirect).toHaveBeenCalledWith("/login")
  })

  /**
   * O DESTINO IMPORTA, e é aqui que a mutação morre. Sem sessão, `roles` é `[]`,
   * então apagar o ramo `!user || !profile` NÃO abre a porta: a execução escorrega
   * para o teste de papel e o visitante acaba em `/dashboard`. O sintoma visível
   * é um anônimo mandado para uma área logada em vez de para o login — e um teste
   * que só perguntasse "houve redirect?" ficaria verde com o gate apagado.
   */
  it("e NÃO para /dashboard — o destino é o que distingue 'sem sessão' de 'sem papel'", async () => {
    const { redirect } = await import("next/navigation")
    sessaoAtual = SEM_SESSAO
    await abrirAnalytics()
    expect(redirect).not.toHaveBeenCalledWith("/dashboard")
  })

  it("o ramo vale em todas as abas da trinca, não só na de entrada", async () => {
    const { redirect } = await import("next/navigation")
    sessaoAtual = SEM_SESSAO
    for (const tab of ["padroes", "mapa", "legado", "nao-existe"]) {
      await abrirAnalytics({ tab })
    }
    expect(redirect).toHaveBeenCalledWith("/login")
    expect(redirect).not.toHaveBeenCalledWith("/dashboard")
  })

  /** CONTROLE POSITIVO: um gate que mandasse todo mundo para /login passaria acima. */
  it("controle positivo — quem TEM sessão e chapéu não é mandado para /login", async () => {
    const { redirect } = await import("next/navigation")
    sessaoAtual = COM_SESSAO
    await abrirAnalytics()
    expect(redirect).not.toHaveBeenCalledWith("/login")
  })
})

// ===========================================================================
// B4 — `/jornada` (autogestão do aluno): o gate que nunca rodou
// ===========================================================================
describe("B4 — o recorte da Autogestão exige login antes de resolver qualquer coisa", () => {
  async function resolverJornada(params: Record<string, string | undefined> = {}) {
    const { resolverRecorteAutogestao } = await import(
      "../../../app/(platform)/jornada/_autogestao/recorte"
    )
    let resultado: unknown = null
    await semExplodir(async () => {
      resultado = await resolverRecorteAutogestao(params)
    })
    return resultado
  }

  it("visitante sem sessão é mandado para /login", async () => {
    const { redirect } = await import("next/navigation")
    sessaoAtual = SEM_SESSAO
    await resolverJornada()
    expect(redirect).toHaveBeenCalledWith("/login")
  })

  /**
   * O gate é a PRIMEIRA coisa, antes de resolver tenant. Sem sessão, `profile`
   * é `null`; se o gate for apagado, a linha seguinte
   * (`resolveTenantId(profile.tenant_id)`) estoura antes de qualquer redirect —
   * e o visitante nunca chega ao login. A asserção abaixo é sobre a ORDEM, e é
   * o que impede alguém de "consertar" a mutação movendo o gate para depois.
   */
  it("e nenhuma resolução acontece antes dele (o gate está na entrada)", async () => {
    const { resolveTenantId } = await import("@/lib/auth")
    sessaoAtual = SEM_SESSAO
    await resolverJornada()
    expect(resolveTenantId).not.toHaveBeenCalled()
  })

  /**
   * CONTROLE POSITIVO. Com sessão, o recorte atravessa até o fim — e de quebra
   * pina a N.4 do CONTRATO-DE-DADOS: `studentId` é SEMPRE `user.id`, nunca um
   * `?studentId=` da URL. Um gestor que abrisse esta rota veria os PRÓPRIOS
   * dados, não os do aluno que ele gerencia.
   */
  it("controle positivo — com sessão o recorte resolve, e o sujeito é o próprio usuário", async () => {
    const { redirect } = await import("next/navigation")
    sessaoAtual = COM_SESSAO
    matriculas = [
      {
        student_id: "user-1",
        course_id: "curso-1",
        created_at: "2026-08-01T00:00:00.000Z",
        status: "active",
        deleted_at: null,
      },
    ]
    const resultado = (await resolverJornada({ studentId: "outro-aluno" })) as {
      ok: boolean
      recorte?: { studentId: string }
    }
    expect(redirect).not.toHaveBeenCalledWith("/login")
    expect(resultado?.ok).toBe(true)
    expect(resultado?.recorte?.studentId).toBe("user-1")
  })
})
