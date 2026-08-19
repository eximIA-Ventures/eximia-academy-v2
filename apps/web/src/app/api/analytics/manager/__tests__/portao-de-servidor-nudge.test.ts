import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// A SEGUNDA PORTA PARA A MESMA ESCRITA — POST /api/analytics/manager/nudge.
// ---------------------------------------------------------------------------
// O commit d08b5b4 pôs o portão e o filtro de conclusão no SERVIDOR, mas só em
// `api/engagement/action`. O próprio autor mediu e declarou o que ficava aberto:
// `api/analytics/manager/nudge` chama o MESMO `dispatchTeamNudge`, com
// `grep -c "process.env"` = 0 e nenhum filtro de conclusão. Ou seja: a trava
// valia para uma rota e existiam outras duas portas para a mesma escrita.
//
// O gestor que abre um balde do painel de time (`team-engagement-header.tsx`)
// posta AQUI, não em `/action`. Quem concluiu o curso continuava podendo ser
// cobrado por este caminho.
//
// Estes testes atacam a ROTA, não a tela. Um POST direto é a forma honesta de
// perguntar "a trava é do servidor?" — se a resposta depender do botão, fica
// vermelho.
//
// NENHUM DISPARO REAL: `dispatchTeamNudge` (a única camada de escrita) é mock, e
// a leitura de `enrollments` é stub. A asserção central de todo caso negativo é
// `expect(mockDispatchTeamNudge).not.toHaveBeenCalled()` — nada sai daqui para
// aluno nenhum e nada é escrito em banco nenhum.
//
// CONTROLE POSITIVO — os casos marcados [CP] passam ANTES e DEPOIS da correção,
// e reprovariam se o remédio fosse a correção degenerada "barra todo mundo":
// portão ligado, portão ausente, reconhecimento, comunicado, aluno sem matrícula
// e o disparo normal do balde de time.
// ---------------------------------------------------------------------------

const mockGetAuthProfile = vi.fn()
const mockResolveTenantId = vi.fn()
const mockGetManagedTeamStudentIds = vi.fn()
const mockDispatchTeamNudge = vi.fn()
const mockServiceFrom = vi.fn()

vi.mock("@/lib/auth", () => ({
  getAuthProfile: () => mockGetAuthProfile(),
  resolveTenantId: (t: string | null) => mockResolveTenantId(t),
}))
vi.mock("@/lib/area-context", () => ({
  getManagedTeamStudentIds: (...a: unknown[]) => mockGetManagedTeamStudentIds(...a),
}))
vi.mock("@/lib/notifications/engine", async () => {
  const actual = await vi.importActual<typeof import("@/lib/notifications/engine")>(
    "@/lib/notifications/engine",
  )
  return { ...actual, dispatchTeamNudge: (...a: unknown[]) => mockDispatchTeamNudge(...a) }
})
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ from: (t: string) => mockServiceFrom(t) }),
}))

import { POST as nudgePOST } from "../nudge/route"

const TENANT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const MANAGER = "11111111-1111-1111-1111-111111111111"
/** Matriculado e EM CURSO — pode receber cobrança. */
const EM_CURSO = "22222222-2222-2222-2222-222222222222"
/** Terminou o curso. É a pessoa que a tela mandava cobrar em 2026-08-17. */
const CONCLUIU = "33333333-3333-3333-3333-333333333333"

interface LinhaMatricula {
  student_id: string
  status: "active" | "completed" | "cancelled"
  deleted_at: string | null
}

/** O que a rota efetivamente pediu ao banco, para o teste conferir o escopo. */
let colunasPedidas: string | null = null
let filtroEq: [string, unknown] | null = null
let filtroIn: [string, unknown] | null = null

/**
 * A leitura de `enrollments` do portão de servidor. A cadeia é
 * `select → eq → in`, a MESMA que os stubs irmãos desta casa implementam — um
 * `.is()` a mais aqui quebraria aqueles arquivos, então o corte de `deleted_at`
 * é feito em memória, dentro de `resumirMatriculas`.
 */
function instalarMatriculas(linhas: LinhaMatricula[], erro: { message: string } | null = null) {
  mockServiceFrom.mockImplementation((tabela: string) => {
    if (tabela !== "enrollments") throw new Error(`tabela inesperada: ${tabela}`)
    return {
      select: (colunas: string) => {
        colunasPedidas = colunas
        return {
          eq: (coluna: string, valor: unknown) => {
            filtroEq = [coluna, valor]
            return {
              in: (coluna2: string, valor2: unknown) => {
                filtroIn = [coluna2, valor2]
                return Promise.resolve({ data: erro ? null : linhas, error: erro })
              },
            }
          },
        }
      },
    }
  })
}

function comoGestor() {
  mockGetAuthProfile.mockResolvedValue({
    user: { id: MANAGER },
    profile: { tenant_id: TENANT, full_name: "Rinaldo" },
    roles: ["manager"],
    supabase: {},
  })
  mockResolveTenantId.mockResolvedValue(TENANT)
}

function post(body: unknown): Request {
  return new Request("http://localhost/api/analytics/manager/nudge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

/**
 * Primeiro argumento entregue ao motor de escrita.
 *
 * Helper que ASSERE em vez de `!`: indexar `mock.calls[0]` direto reprova no
 * `tsc` com TS2493 sob `noUncheckedIndexedAccess`, e o `!` esconderia um "nunca
 * foi chamado" atrás de um erro de propriedade indefinida.
 */
function argumentoDoDisparo(): { studentIds: string[]; nudgeType?: string } {
  const chamada = mockDispatchTeamNudge.mock.calls[0]
  if (!chamada) throw new Error("dispatchTeamNudge deveria ter sido chamado")
  return chamada[0] as { studentIds: string[]; nudgeType?: string }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  colunasPedidas = null
  filtroEq = null
  filtroIn = null
  mockGetManagedTeamStudentIds.mockResolvedValue([EM_CURSO, CONCLUIU])
  mockDispatchTeamNudge.mockResolvedValue({
    inAppCreated: 1,
    emailsSent: 0,
    emailsFailed: 0,
    emailRowsFailed: 0,
    recipientsSkipped: 0,
    total: 1,
  })
  // Default: ninguém concluiu. Cada teste que precisa instala a sua matrícula.
  instalarMatriculas([{ student_id: EM_CURSO, status: "active", deleted_at: null }])
})

// ---------------------------------------------------------------------------
// 1. O PORTÃO. Desligado no SERVIDOR, um POST direto não escreve.
// ---------------------------------------------------------------------------
describe("POST /api/analytics/manager/nudge — o portão é do servidor", () => {
  it("com o portão DESLIGADO, um POST direto não chega à camada de escrita", async () => {
    comoGestor()
    vi.stubEnv("ACIONAMENTO_ATIVO", "false")

    const res = await nudgePOST(post({ studentIds: [EM_CURSO], nudgeType: "inactive" }))

    expect(mockDispatchTeamNudge).not.toHaveBeenCalled()
    expect(res.status).toBe(503)
  })

  it("valor NÃO reconhecido fecha o portão — 'off' não vira 'ligado' por engano", async () => {
    // Allowlist de UM valor, a mesma da rota irmã: só "true" abre. O erro de
    // digitação que o desenho precisa sobreviver é o de quem QUIS desligar.
    comoGestor()
    vi.stubEnv("ACIONAMENTO_ATIVO", "off")

    const res = await nudgePOST(post({ studentIds: [EM_CURSO], nudgeType: "inactive" }))

    expect(mockDispatchTeamNudge).not.toHaveBeenCalled()
    expect(res.status).toBe(503)
  })

  it("[CP] com o portão LIGADO, o disparo do balde de time segue seu caminho", async () => {
    comoGestor()
    vi.stubEnv("ACIONAMENTO_ATIVO", "true")

    const res = await nudgePOST(post({ studentIds: [EM_CURSO], nudgeType: "inactive" }))

    expect(res.status).toBe(200)
    expect(mockDispatchTeamNudge).toHaveBeenCalledTimes(1)
  })

  it("[CP] SEM a variável, a rota continua enviando — o interruptor não derruba o painel", async () => {
    // Nenhum `.env` deste repo define a variável, e o painel de time ESTÁ em
    // produção postando aqui. Fecha-se por DECISÃO explícita, nunca por omissão.
    comoGestor()

    const res = await nudgePOST(post({ studentIds: [EM_CURSO], nudgeType: "inactive" }))

    expect(res.status).toBe(200)
    expect(mockDispatchTeamNudge).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// 2. QUEM CONCLUIU. O filtro é do servidor, e vale para qualquer chamador.
// ---------------------------------------------------------------------------
describe("POST /api/analytics/manager/nudge — quem concluiu não é cobrado", () => {
  beforeEach(() => {
    // Portão LIGADO em todo este bloco: o filtro de conclusão não pode depender
    // do portão. São duas travas independentes.
    vi.stubEnv("ACIONAMENTO_ATIVO", "true")
  })

  it("um POST direto cobrando quem CONCLUIU é recusado, sem escrever", async () => {
    comoGestor()
    instalarMatriculas([{ student_id: CONCLUIU, status: "completed", deleted_at: null }])

    const res = await nudgePOST(post({ studentIds: [CONCLUIU], nudgeType: "inactive" }))

    expect(mockDispatchTeamNudge).not.toHaveBeenCalled()
    expect(res.status).toBe(400)
    const corpo = (await res.json()) as { error?: string }
    expect(corpo.error).toMatch(/conclu/i)
  })

  it("numa lista mista, só quem NÃO concluiu chega ao motor", async () => {
    comoGestor()
    instalarMatriculas([
      { student_id: EM_CURSO, status: "active", deleted_at: null },
      { student_id: CONCLUIU, status: "completed", deleted_at: null },
    ])

    const res = await nudgePOST(
      post({ studentIds: [EM_CURSO, CONCLUIU], nudgeType: "never_accessed" }),
    )

    expect(res.status).toBe(200)
    expect(mockDispatchTeamNudge).toHaveBeenCalledTimes(1)
    expect(argumentoDoDisparo().studentIds).toEqual([EM_CURSO])
    expect(argumentoDoDisparo().studentIds).not.toContain(CONCLUIU)
  })

  it("a leitura de matrículas é escopada ao tenant e aos destinatários do pedido", async () => {
    // Sem `.eq("tenant_id")` a rota decidiria a conclusão de alguém com dado de
    // OUTRO cliente; sem o `.in(...)` leria a base inteira a cada disparo.
    comoGestor()

    await nudgePOST(post({ studentIds: [EM_CURSO], nudgeType: "inactive" }))

    expect(filtroEq).toEqual(["tenant_id", TENANT])
    expect(filtroIn).toEqual(["student_id", [EM_CURSO]])
    expect(colunasPedidas).toContain("deleted_at")
    expect(colunasPedidas).toContain("status")
  })

  it("[CP] sem matrícula nenhuma NÃO é conclusão — o critério exige ao menos uma viva", async () => {
    comoGestor()
    instalarMatriculas([])

    const res = await nudgePOST(post({ studentIds: [EM_CURSO], nudgeType: "inactive" }))

    expect(res.status).toBe(200)
    expect(mockDispatchTeamNudge).toHaveBeenCalledTimes(1)
  })

  it("[CP] RECONHECER quem concluiu continua permitido — não é cobrança", async () => {
    comoGestor()
    instalarMatriculas([{ student_id: CONCLUIU, status: "completed", deleted_at: null }])

    const res = await nudgePOST(post({ studentIds: [CONCLUIU], nudgeType: "top_performer" }))

    expect(res.status).toBe(200)
    expect(mockDispatchTeamNudge).toHaveBeenCalledTimes(1)
    expect(argumentoDoDisparo().studentIds).toEqual([CONCLUIU])
  })

  it("[CP] COMUNICADO alcança quem concluiu — não pede nada de ninguém", async () => {
    comoGestor()
    instalarMatriculas([{ student_id: CONCLUIU, status: "completed", deleted_at: null }])

    const res = await nudgePOST(post({ studentIds: [CONCLUIU], nudgeType: "announcement" }))

    expect(res.status).toBe(200)
    expect(mockDispatchTeamNudge).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// 3. I-4. Não saber o estado de alguém não autoriza cobrá-lo.
// ---------------------------------------------------------------------------
describe("POST /api/analytics/manager/nudge — erro de leitura barra o envio (I-4)", () => {
  it("falha ao ler matrículas não vira 'ninguém concluiu'", async () => {
    comoGestor()
    vi.stubEnv("ACIONAMENTO_ATIVO", "true")
    instalarMatriculas([], { message: "connection reset" })

    const res = await nudgePOST(post({ studentIds: [EM_CURSO], nudgeType: "inactive" }))

    expect(mockDispatchTeamNudge).not.toHaveBeenCalled()
    expect(res.status).toBe(503)
  })
})
