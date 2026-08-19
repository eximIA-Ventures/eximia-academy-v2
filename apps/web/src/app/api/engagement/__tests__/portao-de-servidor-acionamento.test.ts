import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// O PORTÃO DO ACIONAMENTO VIVE NO SERVIDOR — não no botão.
// ---------------------------------------------------------------------------
// DEFEITO QUE ESTE ARQUIVO TRANCA (auditoria independente, 2026-08-19, tenant
// Cory Alimentos em PRODUÇÃO). As duas travas do acionamento estavam do lado
// ERRADO da rede:
//
//   • `acoesEstaoAtivas()` lê `NEXT_PUBLIC_*` e o guard vive num callback React
//     (`components/analytics/visao-geral/acoes.tsx`). Uma variável
//     `NEXT_PUBLIC_*` é PÚBLICA por definição: ela informa a interface, nunca
//     autoriza uma escrita.
//   • `triarDestinatarios` — que barra quem CONCLUIU o curso — rodava no
//     NAVEGADOR, dentro de `pedir()`.
//
// `grep "process.env" app/api/engagement/action/route.ts` dava VAZIO, e
// `dispatchTeamNudge` não filtra conclusão. A própria tela manda o gestor para
// `/engagement`, cujo `send-center-tab.tsx` posta na MESMA rota sem nenhum dos
// dois guardas. Consequência medida: quem concluiu o curso podia ser cobrado,
// pela Central ou por um POST direto.
//
// Estes testes atacam a ROTA, não a tela. Um POST direto é a forma mais honesta
// de perguntar "o portão é do servidor?" — se a resposta depender do botão, o
// teste fica vermelho.
//
// NENHUM DISPARO REAL: `dispatchTeamNudge` (a única camada de escrita) é um
// mock, e a leitura de `enrollments` é um stub. A asserção central é
// `expect(mockDispatchTeamNudge).not.toHaveBeenCalled()` — nada sai daqui para
// aluno nenhum, e nada é escrito em banco nenhum.
//
// CONTROLE POSITIVO (o que impede este arquivo de ficar verde com a correção
// degenerada "barra tudo"): os testes marcados [CP] passam ANTES e DEPOIS da
// correção, e reprovariam se o remédio derrubasse o envio legítimo — portão
// ligado, portão ausente, reconhecimento, comunicado, aluno sem matrícula e o
// envio individual da Central.
// ---------------------------------------------------------------------------

const mockGetAuthProfile = vi.fn()
const mockResolveTenantId = vi.fn()
const mockResolveEngagementScope = vi.fn()
const mockDispatchTeamNudge = vi.fn()
const mockServiceFrom = vi.fn()

vi.mock("@/lib/auth", () => ({
  getAuthProfile: () => mockGetAuthProfile(),
  resolveTenantId: (t: string | null) => mockResolveTenantId(t),
}))
vi.mock("@/lib/notifications/engagement-scope", () => ({
  resolveEngagementScope: (...a: unknown[]) => mockResolveEngagementScope(...a),
  readFocusParam: () => null,
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

import { POST as actionPOST } from "../action/route"

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
 * A leitura de `enrollments` que o portão do servidor precisa fazer para saber
 * quem concluiu. A cadeia é `select → eq → in`, IDÊNTICA à que os outros testes
 * desta pasta já estabelecem para o service client (`routes-leak`,
 * `canonical-scope`) — um `.is()` a mais aqui quebraria aqueles stubs, então o
 * corte de `deleted_at` é feito em memória, e é justamente o que o caso
 * "matrícula APAGADA" exercita.
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
  return new Request("http://localhost/api/engagement/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

/**
 * Primeiro (e único) argumento entregue ao motor de escrita.
 *
 * Helper que ASSERE em vez de `!`: indexar `mock.calls[0]` direto reprova no
 * `tsc` com TS2493 sob `noUncheckedIndexedAccess`, e o `!` esconderia um
 * "nunca foi chamado" atrás de um erro de propriedade indefinida.
 */
function argumentoDoDisparo(): { studentIds: string[]; channel?: string; senderName?: string } {
  const chamada = mockDispatchTeamNudge.mock.calls[0]
  if (!chamada) throw new Error("dispatchTeamNudge deveria ter sido chamado")
  return chamada[0] as { studentIds: string[]; channel?: string; senderName?: string }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  colunasPedidas = null
  filtroEq = null
  filtroIn = null
  mockResolveEngagementScope.mockResolvedValue([EM_CURSO, CONCLUIU])
  mockDispatchTeamNudge.mockResolvedValue({
    inAppCreated: 1,
    emailsSent: 0,
    emailsFailed: 0,
    recipientsSkipped: 0,
    total: 1,
  })
  // Default: ninguém concluiu. Cada teste que precisa de conclusão instala a sua.
  instalarMatriculas([{ student_id: EM_CURSO, status: "active", deleted_at: null }])
})

// ---------------------------------------------------------------------------
// 1. O PORTÃO. Desligado no SERVIDOR, um POST direto não escreve.
// ---------------------------------------------------------------------------
describe("POST /api/engagement/action — o portão é do servidor", () => {
  it("com o portão DESLIGADO, um POST direto não chega à camada de escrita", async () => {
    comoGestor()
    // Variável de SERVIDOR. `NEXT_PUBLIC_*` é pública e só informa a UI — quem
    // faz um POST com curl nunca passou por UI nenhuma.
    vi.stubEnv("ACIONAMENTO_ATIVO", "false")

    const res = await actionPOST(post({ studentId: EM_CURSO, nudgeType: "inactive" }))

    expect(mockDispatchTeamNudge).not.toHaveBeenCalled()
    expect(res.status).toBe(503)
  })

  it("desligar apenas a variável PÚBLICA não é suficiente — ela não governa a rota", async () => {
    comoGestor()
    // A variável pública desligada (o estado de hoje em produção) NÃO segura
    // nada; quem segura é a de servidor.
    vi.stubEnv("NEXT_PUBLIC_ACIONAMENTO_ATIVO", "")
    vi.stubEnv("NEXT_PUBLIC_VISAO_GERAL_ACOES_ATIVAS", "")
    vi.stubEnv("ACIONAMENTO_ATIVO", "false")

    const res = await actionPOST(post({ studentIds: [EM_CURSO], nudgeType: "never_accessed" }))

    expect(mockDispatchTeamNudge).not.toHaveBeenCalled()
    expect(res.status).toBe(503)
  })

  it("valor NÃO reconhecido fecha o portão — 'off' não vira 'ligado' por engano", async () => {
    // Allowlist de UM valor: só a string "true" abre. Qualquer outra coisa
    // ("off", "no", "1", lixo) fecha. O erro de digitação que o desenho precisa
    // sobreviver é o de quem QUIS desligar e escreveu diferente — nesse caso o
    // portão fecha, não abre.
    comoGestor()
    vi.stubEnv("ACIONAMENTO_ATIVO", "off")

    const res = await actionPOST(post({ studentId: EM_CURSO, nudgeType: "inactive" }))

    expect(mockDispatchTeamNudge).not.toHaveBeenCalled()
    expect(res.status).toBe(503)
  })

  it("[CP] com o portão LIGADO, o envio legítimo segue seu caminho", async () => {
    comoGestor()
    vi.stubEnv("ACIONAMENTO_ATIVO", "true")

    const res = await actionPOST(post({ studentId: EM_CURSO, nudgeType: "inactive" }))

    expect(res.status).toBe(200)
    expect(mockDispatchTeamNudge).toHaveBeenCalledTimes(1)
  })

  it("[CP] SEM a variável, a rota continua enviando — o interruptor não derruba a Central", async () => {
    // Nenhum `.env` deste repo define a variável hoje, e a Central de
    // Engajamento ESTÁ em produção postando nesta rota. Um interruptor que
    // nascesse fechado tiraria a Central do ar no mesmo commit que fecha o
    // buraco. Fecha-se por DECISÃO explícita (`ACIONAMENTO_ATIVO=false`), nunca
    // por omissão. Este teste é o que impede o remédio de virar o próximo
    // incidente.
    comoGestor()

    const res = await actionPOST(post({ studentId: EM_CURSO, nudgeType: "inactive" }))

    expect(res.status).toBe(200)
    expect(mockDispatchTeamNudge).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// 2. QUEM CONCLUIU. O filtro é do servidor, e vale para qualquer chamador.
// ---------------------------------------------------------------------------
describe("POST /api/engagement/action — quem concluiu não é cobrado", () => {
  beforeEach(() => {
    // Portão LIGADO em todo este bloco: o filtro de conclusão não pode depender
    // do portão. São duas travas independentes.
    vi.stubEnv("ACIONAMENTO_ATIVO", "true")
  })

  it("um POST direto cobrando quem CONCLUIU é recusado, sem escrever", async () => {
    comoGestor()
    instalarMatriculas([{ student_id: CONCLUIU, status: "completed", deleted_at: null }])

    const res = await actionPOST(post({ studentId: CONCLUIU, nudgeType: "inactive" }))

    expect(mockDispatchTeamNudge).not.toHaveBeenCalled()
    expect(res.status).toBe(403)
  })

  it("numa lista mista, só quem NÃO concluiu chega ao motor", async () => {
    comoGestor()
    instalarMatriculas([
      { student_id: EM_CURSO, status: "active", deleted_at: null },
      { student_id: CONCLUIU, status: "completed", deleted_at: null },
    ])

    const res = await actionPOST(
      post({ studentIds: [EM_CURSO, CONCLUIU], nudgeType: "behind_teaching_plan" }),
    )

    expect(res.status).toBe(200)
    expect(mockDispatchTeamNudge).toHaveBeenCalledTimes(1)
    expect(argumentoDoDisparo().studentIds).toEqual([EM_CURSO])
    expect(argumentoDoDisparo().studentIds).not.toContain(CONCLUIU)
  })

  it("a leitura de matrículas é escopada ao tenant e aos destinatários do pedido", async () => {
    // Sem `.eq("tenant_id")` a rota decidiria a conclusão de alguém com dado de
    // OUTRO cliente; sem o `.in(...)` leria a base inteira a cada envio.
    comoGestor()

    await actionPOST(post({ studentIds: [EM_CURSO], nudgeType: "inactive" }))

    expect(filtroEq).toEqual(["tenant_id", TENANT])
    expect(filtroIn).toEqual(["student_id", [EM_CURSO]])
    // `deleted_at` precisa vir na projeção: é ele que distingue matrícula viva
    // de apagada, e o corte é feito em memória (ver `instalarMatriculas`).
    expect(colunasPedidas).toContain("deleted_at")
    expect(colunasPedidas).toContain("status")
  })

  it("conclusão é 'todas as matrículas vivas completed' — uma em curso ainda pode ser cobrada", async () => {
    comoGestor()
    instalarMatriculas([
      { student_id: CONCLUIU, status: "completed", deleted_at: null },
      { student_id: CONCLUIU, status: "active", deleted_at: null },
    ])

    const res = await actionPOST(post({ studentId: CONCLUIU, nudgeType: "inactive" }))

    expect(res.status).toBe(200)
    expect(mockDispatchTeamNudge).toHaveBeenCalledTimes(1)
  })

  it("matrícula APAGADA não conta — quem só tem matrícula viva completed concluiu", async () => {
    comoGestor()
    instalarMatriculas([
      { student_id: CONCLUIU, status: "completed", deleted_at: null },
      { student_id: CONCLUIU, status: "active", deleted_at: "2026-01-02T00:00:00Z" },
    ])

    const res = await actionPOST(post({ studentId: CONCLUIU, nudgeType: "inactive" }))

    expect(mockDispatchTeamNudge).not.toHaveBeenCalled()
    expect(res.status).toBe(403)
  })

  it("[CP] sem matrícula nenhuma NÃO é conclusão — o critério exige ao menos uma viva", async () => {
    // Espelha `base.ts`: `matriculadas > 0 && completadas === matriculadas`.
    // Zero matrículas ⇒ NÃO concluiu. Tratar ausência como conclusão barraria
    // gente que a Central alcança legitimamente hoje.
    comoGestor()
    instalarMatriculas([])

    const res = await actionPOST(post({ studentId: EM_CURSO, nudgeType: "inactive" }))

    expect(res.status).toBe(200)
    expect(mockDispatchTeamNudge).toHaveBeenCalledTimes(1)
  })

  it("[CP] RECONHECER quem concluiu continua permitido — não é cobrança", async () => {
    comoGestor()
    instalarMatriculas([{ student_id: CONCLUIU, status: "completed", deleted_at: null }])

    const res = await actionPOST(post({ studentId: CONCLUIU, nudgeType: "top_performer" }))

    expect(res.status).toBe(200)
    expect(mockDispatchTeamNudge).toHaveBeenCalledTimes(1)
  })

  it("[CP] COMUNICADO alcança quem concluiu — não pede nada de ninguém", async () => {
    comoGestor()
    instalarMatriculas([{ student_id: CONCLUIU, status: "completed", deleted_at: null }])

    const res = await actionPOST(post({ studentId: CONCLUIU, nudgeType: "announcement" }))

    expect(res.status).toBe(200)
    expect(mockDispatchTeamNudge).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// 3. I-4. Não saber o estado de alguém não autoriza cobrá-lo.
// ---------------------------------------------------------------------------
describe("POST /api/engagement/action — erro de leitura barra o envio (I-4)", () => {
  it("falha ao ler matrículas não vira 'ninguém concluiu'", async () => {
    comoGestor()
    vi.stubEnv("ACIONAMENTO_ATIVO", "true")
    instalarMatriculas([], { message: "connection reset" })

    const res = await actionPOST(post({ studentId: EM_CURSO, nudgeType: "inactive" }))

    expect(mockDispatchTeamNudge).not.toHaveBeenCalled()
    expect(res.status).toBe(503)
  })
})

// ---------------------------------------------------------------------------
// 4. A CENTRAL DE ENGAJAMENTO CONTINUA FUNCIONANDO.
// ---------------------------------------------------------------------------
// `send-center-tab.tsx` posta nesta MESMA rota. Em lote ela manda `nudgeType:
// "custom"` — e é EXATAMENTE esse o caminho que a auditoria mediu: o gestor
// escolhe na mão as "4 pessoas paradas" (que são as 4 que concluíram), escreve
// "vamos retomar?" e o texto sai como `custom`. Abrir exceção para `custom`
// deixaria o buraco medido aberto pela porta principal, então `custom` é
// cobrança aqui pelo MESMO `ehCobranca` que a tela já usa: uma implementação
// só, nenhuma divergência possível.
//
// O QUE A CENTRAL PERDE (registrado, não escondido): texto livre em lote deixa
// de alcançar quem concluiu. O que ela mantém: `announcement` (comunicado) e
// `top_performer` (reconhecimento) chegam a quem terminou, e o envio individual
// a quem está em curso é intocado — os três testados aqui.
describe("POST /api/engagement/action — a Central continua enviando", () => {
  beforeEach(() => {
    vi.stubEnv("ACIONAMENTO_ATIVO", "true")
  })

  it("texto livre em lote ('custom') NÃO alcança quem concluiu — é o vetor medido", async () => {
    comoGestor()
    instalarMatriculas([
      { student_id: EM_CURSO, status: "active", deleted_at: null },
      { student_id: CONCLUIU, status: "completed", deleted_at: null },
    ])

    const res = await actionPOST(
      post({
        studentIds: [EM_CURSO, CONCLUIU],
        nudgeType: "custom",
        message: "Vamos retomar?",
      }),
    )

    expect(res.status).toBe(200)
    expect(argumentoDoDisparo().studentIds).toEqual([EM_CURSO])
  })

  it("[CP] o envio individual da Central para quem está EM CURSO segue intacto", async () => {
    comoGestor()

    const res = await actionPOST(
      post({
        studentId: EM_CURSO,
        nudgeType: "behind_teaching_plan",
        templateKey: "behind_teaching_plan",
        message: "Vamos retomar?",
        senderIdentity: "manager",
        channel: "inapp",
      }),
    )

    expect(res.status).toBe(200)
    expect(argumentoDoDisparo().channel).toBe("inapp")
    expect(argumentoDoDisparo().senderName).toBe("Rinaldo")
  })

  it("o lote em que TODOS concluíram é recusado, e a Central mostra o motivo", async () => {
    comoGestor()
    instalarMatriculas([{ student_id: CONCLUIU, status: "completed", deleted_at: null }])

    const res = await actionPOST(post({ studentIds: [CONCLUIU], nudgeType: "inactive" }))

    expect(mockDispatchTeamNudge).not.toHaveBeenCalled()
    expect(res.status).toBe(403)
    const corpo = (await res.json()) as { error?: string }
    expect(corpo.error).toMatch(/conclu/i)
  })
})
