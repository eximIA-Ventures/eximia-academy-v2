import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// A TERCEIRA PORTA PARA A MESMA ESCRITA — POST /api/engagement/campaign.
// ---------------------------------------------------------------------------
// O commit d08b5b4 pôs o portão e o filtro de conclusão no SERVIDOR, mas só em
// `api/engagement/action`. O próprio autor mediu e declarou o que ficava aberto:
// `api/engagement/campaign` chama o MESMO `dispatchTeamNudge`, com
// `grep -c "process.env"` = 0 e nenhum filtro de conclusão. Uma trava que vale
// para uma das três portas não é uma trava, é uma preferência.
//
// DOIS DETALHES DESTA ROTA QUE NÃO EXISTEM NA IRMÃ, e que estes testes fixam:
//
//   • ORDEM. O `confirm` cria o CABEÇALHO da campanha (`createCampaign`) antes
//     de despachar. O filtro de conclusão tem de rodar ANTES do cabeçalho: uma
//     campanha registrada que não envia para ninguém é lixo observável num
//     cliente pagante. Por isso todo caso negativo aqui assere as DUAS coisas,
//     `dispatchTeamNudge` E `createCampaign`, nunca chamados.
//
//   • O TIPO. O wizard de Campanhas (`campaigns-tab.tsx`) NÃO manda `nudgeType`
//     no confirm — manda `{ mode, segment, recipients, senderIdentity, channel }`.
//     E o segmento "No ritmo" é declarado pela própria tela como RECONHECIMENTO
//     ("Alunos em dia — reconhecer o engajamento reforça a motivação") e INCLUI
//     quem concluiu (`isStudentConcluido → "no_ritmo"`, student-triage.ts). Um
//     filtro que assumisse "sem nudgeType ⇒ cobrança" derrubaria exatamente o
//     reconhecimento de quem terminou, que é o caso que a regra manda PRESERVAR.
//     O controle positivo [CP-NO-RITMO] abaixo é o que separa a correção da
//     correção degenerada.
//
// NENHUM DISPARO REAL: `dispatchTeamNudge` e `createCampaign` são mocks, e a
// leitura de `enrollments` é stub. Nada sai daqui para aluno nenhum.
// ---------------------------------------------------------------------------

const mockGetAuthProfile = vi.fn()
const mockResolveTenantId = vi.fn()
const mockResolveEngagementScope = vi.fn()
const mockResolveAudienceScoped = vi.fn()
const mockDispatchTeamNudge = vi.fn()
const mockCreateCampaign = vi.fn()
const mockServiceFrom = vi.fn()

vi.mock("@/lib/auth", () => ({
  getAuthProfile: () => mockGetAuthProfile(),
  resolveTenantId: (t: string | null) => mockResolveTenantId(t),
}))
vi.mock("@/lib/notifications/engagement-scope", () => ({
  resolveEngagementScope: (...a: unknown[]) => mockResolveEngagementScope(...a),
  readFocusParam: () => null,
}))
vi.mock("@/lib/notifications/audiences", () => ({
  resolveAudienceScoped: (...a: unknown[]) => mockResolveAudienceScoped(...a),
}))
vi.mock("@/lib/notifications/campaigns", () => ({
  createCampaign: (...a: unknown[]) => mockCreateCampaign(...a),
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

import { POST as campaignPOST } from "../campaign/route"

const TENANT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const MANAGER = "11111111-1111-1111-1111-111111111111"
/** Matriculado e EM CURSO — pode receber cobrança. */
const EM_CURSO = "22222222-2222-2222-2222-222222222222"
/** Terminou o curso. */
const CONCLUIU = "33333333-3333-3333-3333-333333333333"

interface LinhaMatricula {
  student_id: string
  status: "active" | "completed" | "cancelled"
  deleted_at: string | null
}

/** O que a rota efetivamente pediu a `enrollments`, para conferir o escopo. */
let colunasPedidas: string | null = null
let filtroEq: [string, unknown] | null = null
let filtroIn: [string, unknown] | null = null

/**
 * Stub do service client. `enrollments` (a leitura do portão) é o que este
 * arquivo mede; qualquer outra tabela que a rota toque no caminho de preview
 * (`users`, `notification_templates`, `courses`) devolve vazio pela cadeia
 * `select → eq → in`, a MESMA que os stubs irmãos desta pasta estabelecem.
 */
function instalarMatriculas(linhas: LinhaMatricula[], erro: { message: string } | null = null) {
  mockServiceFrom.mockImplementation((tabela: string) => {
    if (tabela === "enrollments") {
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
    }
    return {
      select: () => ({ eq: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) }),
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
  return new Request("http://localhost/api/engagement/campaign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

/**
 * Primeiro argumento entregue ao motor de escrita. Helper que ASSERE em vez de
 * `!`: indexar `mock.calls[0]` direto reprova no `tsc` com TS2493 sob
 * `noUncheckedIndexedAccess`.
 */
function argumentoDoDisparo(): {
  studentIds: string[]
  nudgeType?: string
  recipients?: { studentId: string; message?: string | null }[] | null
} {
  const chamada = mockDispatchTeamNudge.mock.calls[0]
  if (!chamada) throw new Error("dispatchTeamNudge deveria ter sido chamado")
  return chamada[0] as {
    studentIds: string[]
    nudgeType?: string
    recipients?: { studentId: string; message?: string | null }[] | null
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  colunasPedidas = null
  filtroEq = null
  filtroIn = null
  mockResolveEngagementScope.mockResolvedValue([EM_CURSO, CONCLUIU])
  mockResolveAudienceScoped.mockResolvedValue([EM_CURSO])
  mockCreateCampaign.mockResolvedValue({
    id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
    tenant_id: TENANT,
    created_by: MANAGER,
    segment: "atencao",
    window_end: "2026-07-15T12:00:00Z",
    status: "open",
  })
  mockDispatchTeamNudge.mockResolvedValue({
    inAppCreated: 1,
    emailsSent: 0,
    emailsFailed: 0,
    emailRowsFailed: 0,
    recipientsSkipped: 0,
    total: 1,
  })
  // Default: ninguém concluiu. Cada teste instala a matrícula que precisa.
  instalarMatriculas([{ student_id: EM_CURSO, status: "active", deleted_at: null }])
})

// ---------------------------------------------------------------------------
// 1. O PORTÃO. Desligado no SERVIDOR, um POST direto não escreve.
// ---------------------------------------------------------------------------
describe("POST /api/engagement/campaign — o portão é do servidor", () => {
  it("com o portão DESLIGADO, o confirm não cria cabeçalho nem despacha", async () => {
    comoGestor()
    vi.stubEnv("ACIONAMENTO_ATIVO", "false")

    const res = await campaignPOST(
      post({ mode: "confirm", segment: "atencao", studentIds: [EM_CURSO], nudgeType: "inactive" }),
    )

    expect(mockDispatchTeamNudge).not.toHaveBeenCalled()
    expect(mockCreateCampaign).not.toHaveBeenCalled()
    expect(res.status).toBe(503)
  })

  it("valor NÃO reconhecido fecha o portão — 'off' não vira 'ligado' por engano", async () => {
    comoGestor()
    vi.stubEnv("ACIONAMENTO_ATIVO", "off")

    const res = await campaignPOST(
      post({ mode: "confirm", segment: "atencao", recipients: [{ studentId: EM_CURSO }] }),
    )

    expect(mockDispatchTeamNudge).not.toHaveBeenCalled()
    expect(mockCreateCampaign).not.toHaveBeenCalled()
    expect(res.status).toBe(503)
  })

  it("o portão desligado também fecha o preview — ele é o passo 1 do mesmo envio", async () => {
    // O preview não escreve, mas existe só para levar ao confirm. Uma instalação
    // com o acionamento fechado que ainda monta a lista entrega ao gestor um
    // wizard que termina em 503 — o portão fecha a porta, não o último degrau.
    comoGestor()
    vi.stubEnv("ACIONAMENTO_ATIVO", "false")

    const res = await campaignPOST(
      post({ mode: "preview", nudgeType: "never_accessed", criteria: { risk: "never_accessed" } }),
    )

    expect(res.status).toBe(503)
    expect(mockResolveAudienceScoped).not.toHaveBeenCalled()
  })

  it("[CP] com o portão LIGADO, o confirm segue seu caminho", async () => {
    comoGestor()
    vi.stubEnv("ACIONAMENTO_ATIVO", "true")

    const res = await campaignPOST(
      post({ mode: "confirm", segment: "atencao", studentIds: [EM_CURSO], nudgeType: "inactive" }),
    )

    expect(res.status).toBe(200)
    expect(mockCreateCampaign).toHaveBeenCalledTimes(1)
    expect(mockDispatchTeamNudge).toHaveBeenCalledTimes(1)
  })

  it("[CP] SEM a variável, a rota continua enviando — o interruptor não derruba Campanhas", async () => {
    comoGestor()

    const res = await campaignPOST(
      post({ mode: "confirm", segment: "atencao", studentIds: [EM_CURSO], nudgeType: "inactive" }),
    )

    expect(res.status).toBe(200)
    expect(mockDispatchTeamNudge).toHaveBeenCalledTimes(1)
  })

  it("[CP] o preview continua respondendo com o portão ligado, e não escreve", async () => {
    comoGestor()
    vi.stubEnv("ACIONAMENTO_ATIVO", "true")

    const res = await campaignPOST(
      post({ mode: "preview", nudgeType: "never_accessed", criteria: { risk: "never_accessed" } }),
    )

    expect(res.status).toBe(200)
    expect(mockResolveAudienceScoped).toHaveBeenCalledTimes(1)
    expect(mockDispatchTeamNudge).not.toHaveBeenCalled()
    expect(mockCreateCampaign).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// 2. QUEM CONCLUIU. O filtro é do servidor, e roda ANTES do cabeçalho.
// ---------------------------------------------------------------------------
describe("POST /api/engagement/campaign — quem concluiu não é cobrado", () => {
  beforeEach(() => {
    vi.stubEnv("ACIONAMENTO_ATIVO", "true")
  })

  it("uma campanha de cobrança só para quem CONCLUIU é recusada, sem cabeçalho e sem escrita", async () => {
    comoGestor()
    instalarMatriculas([{ student_id: CONCLUIU, status: "completed", deleted_at: null }])

    const res = await campaignPOST(
      post({ mode: "confirm", segment: "atencao", studentIds: [CONCLUIU], nudgeType: "inactive" }),
    )

    expect(mockDispatchTeamNudge).not.toHaveBeenCalled()
    expect(mockCreateCampaign).not.toHaveBeenCalled()
    expect(res.status).toBe(400)
    const corpo = (await res.json()) as { error?: string }
    expect(corpo.error).toMatch(/conclu/i)
  })

  it("numa campanha mista, só quem NÃO concluiu chega ao motor — e a variação o acompanha", async () => {
    comoGestor()
    instalarMatriculas([
      { student_id: EM_CURSO, status: "active", deleted_at: null },
      { student_id: CONCLUIU, status: "completed", deleted_at: null },
    ])

    const res = await campaignPOST(
      post({
        mode: "confirm",
        segment: "atencao",
        recipients: [
          { studentId: EM_CURSO, message: "vamos retomar?" },
          { studentId: CONCLUIU, message: "vamos retomar?" },
        ],
      }),
    )

    expect(res.status).toBe(200)
    expect(argumentoDoDisparo().studentIds).toEqual([EM_CURSO])
    // A linha do concluído não pode reentrar pela porta da variação por aluno.
    expect((argumentoDoDisparo().recipients ?? []).map((r) => r.studentId)).toEqual([EM_CURSO])
  })

  it("a leitura de matrículas é escopada ao tenant e aos destinatários do pedido", async () => {
    comoGestor()

    await campaignPOST(
      post({ mode: "confirm", segment: "atencao", studentIds: [EM_CURSO], nudgeType: "inactive" }),
    )

    expect(filtroEq).toEqual(["tenant_id", TENANT])
    expect(filtroIn).toEqual(["student_id", [EM_CURSO]])
    expect(colunasPedidas).toContain("deleted_at")
    expect(colunasPedidas).toContain("status")
  })

  it("[CP] sem matrícula nenhuma NÃO é conclusão — o critério exige ao menos uma viva", async () => {
    comoGestor()
    instalarMatriculas([])

    const res = await campaignPOST(
      post({ mode: "confirm", segment: "atencao", studentIds: [EM_CURSO], nudgeType: "inactive" }),
    )

    expect(res.status).toBe(200)
    expect(mockDispatchTeamNudge).toHaveBeenCalledTimes(1)
  })

  it("[CP] COMUNICADO alcança quem concluiu — não pede nada de ninguém", async () => {
    comoGestor()
    instalarMatriculas([{ student_id: CONCLUIU, status: "completed", deleted_at: null }])

    const res = await campaignPOST(
      post({
        mode: "confirm",
        segment: "atencao",
        studentIds: [CONCLUIU],
        nudgeType: "announcement",
      }),
    )

    expect(res.status).toBe(200)
    expect(argumentoDoDisparo().studentIds).toEqual([CONCLUIU])
  })

  it("[CP-NO-RITMO] a campanha de RECONHECIMENTO alcança quem terminou, mesmo sem nudgeType no corpo", async () => {
    // O wizard NÃO manda `nudgeType` no confirm. "No ritmo" é o segmento que a
    // própria tela chama de reconhecimento e que INCLUI quem concluiu. Assumir
    // "sem nudgeType ⇒ cobrança" mataria justamente o envio que a regra manda
    // preservar — e mataria em silêncio, porque o preview mostrou a pessoa.
    comoGestor()
    instalarMatriculas([{ student_id: CONCLUIU, status: "completed", deleted_at: null }])

    const res = await campaignPOST(
      post({
        mode: "confirm",
        segment: "no_ritmo",
        recipients: [{ studentId: CONCLUIU, message: "parabéns por concluir!" }],
      }),
    )

    expect(res.status).toBe(200)
    expect(mockDispatchTeamNudge).toHaveBeenCalledTimes(1)
    expect(argumentoDoDisparo().studentIds).toEqual([CONCLUIU])
  })

  it("o segmento de COBRANÇA sem nudgeType no corpo continua barrando quem concluiu", async () => {
    // O par do caso acima: mesma ausência de `nudgeType`, segmento diferente. É
    // o segmento — campo validado do próprio pedido — que decide, não a omissão.
    comoGestor()
    instalarMatriculas([{ student_id: CONCLUIU, status: "completed", deleted_at: null }])

    const res = await campaignPOST(
      post({
        mode: "confirm",
        segment: "sem_acesso",
        recipients: [{ studentId: CONCLUIU, message: "sumiu?" }],
      }),
    )

    expect(mockDispatchTeamNudge).not.toHaveBeenCalled()
    expect(mockCreateCampaign).not.toHaveBeenCalled()
    expect(res.status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// 3. I-4. Não saber o estado de alguém não autoriza cobrá-lo.
// ---------------------------------------------------------------------------
describe("POST /api/engagement/campaign — erro de leitura barra o envio (I-4)", () => {
  it("falha ao ler matrículas não vira 'ninguém concluiu'", async () => {
    comoGestor()
    vi.stubEnv("ACIONAMENTO_ATIVO", "true")
    instalarMatriculas([], { message: "connection reset" })

    const res = await campaignPOST(
      post({ mode: "confirm", segment: "atencao", studentIds: [EM_CURSO], nudgeType: "inactive" }),
    )

    expect(mockDispatchTeamNudge).not.toHaveBeenCalled()
    expect(mockCreateCampaign).not.toHaveBeenCalled()
    expect(res.status).toBe(503)
  })
})
