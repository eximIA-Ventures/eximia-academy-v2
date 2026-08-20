import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// A QUARTA PORTA PARA A MESMA ESCRITA — PATCH /api/admin/engagement/suggestions/[id].
// ---------------------------------------------------------------------------
// Os commits d08b5b4 e 2626ce1 puseram o portão e o filtro de conclusão no
// SERVIDOR em três rotas (`engagement/action`, `engagement/campaign`,
// `analytics/manager/nudge`), todas chamadoras de `dispatchTeamNudge`. O autor
// do segundo mediu e DECLAROU o que ficava aberto:
//
//   «`approveSuggestion` (PATCH admin/engagement/suggestions/[id]) escreve com
//    `nudge_type: sug.type`, esse sim cabe na distinção e fecharia com os mesmos
//    dois guardas.»
//
// É a MESMA escrita — `insert` em `notifications` — por outro motor. Aprovar uma
// sugestão dispara notificação in-app (e espelho de e-mail) para os alunos-alvo,
// com `process.env` = 0 na rota e nada olhando conclusão. Quem CONCLUIU o curso
// podia ser cobrado por este caminho, que é justamente o que o gestor usa na
// fila de sugestões.
//
// Estes testes atacam a ROTA, não a tela. Um PATCH direto é a forma honesta de
// perguntar "a trava é do servidor?" — se a resposta depender do botão, fica
// vermelho.
//
// NENHUM DISPARO REAL: `createServiceClient` é stub e as DUAS camadas de escrita
// (o `update` que reivindica a sugestão e o `insert` em `notifications`) apenas
// REGISTRAM o que teriam gravado. A asserção central de todo caso negativo é
// `expect(notificacoesInseridas).toHaveLength(0)` — nada sai daqui para aluno
// nenhum e nada é escrito em banco nenhum. O e-mail nunca é alcançado
// (`channel_email: false` no template do stub).
//
// CONTROLE POSITIVO — os casos marcados [CP] passam ANTES e DEPOIS da correção,
// e reprovariam se o remédio fosse a correção degenerada "barra todo mundo" ou
// "fecha a rota inteira": portão ligado, portão ausente, DISPENSAR com o portão
// desligado, reconhecimento a quem concluiu, comunicado, cobrança a quem está em
// curso e aluno sem matrícula.
// ---------------------------------------------------------------------------

const mockGetAuthProfile = vi.fn()
const mockResolveTenantId = vi.fn()
const mockResolveCallerStudentScope = vi.fn()
const mockServiceFrom = vi.fn()

vi.mock("@/lib/auth", () => ({
  getAuthProfile: () => mockGetAuthProfile(),
  resolveTenantId: (t: string | null) => mockResolveTenantId(t),
}))
vi.mock("@/lib/area-context", () => ({
  resolveCallerStudentScope: (...a: unknown[]) => mockResolveCallerStudentScope(...a),
}))
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ from: (t: string) => mockServiceFrom(t) }),
}))

import { PATCH as suggestionPATCH } from "../[id]/route"

const TENANT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const ADMIN = "11111111-1111-1111-1111-111111111111"
const SUGESTAO = "99999999-9999-9999-9999-999999999999"
/** Matriculado e EM CURSO — pode receber cobrança. */
const EM_CURSO = "22222222-2222-2222-2222-222222222222"
/** Terminou o curso. É a pessoa que a tela mandava cobrar em 2026-08-17. */
const CONCLUIU = "33333333-3333-3333-3333-333333333333"

interface LinhaMatricula {
  student_id: string
  status: "active" | "completed" | "cancelled"
  deleted_at: string | null
}

interface Resultado {
  data: unknown
  error: { message: string } | null
}

// --- estado do banco falso -------------------------------------------------
let sugestao: Record<string, unknown> | null = null
let matriculas: LinhaMatricula[] = []
let erroDeMatriculas: { message: string } | null = null

// --- registradores de ESCRITA (nada real acontece) -------------------------
/** Cada `insert` em `notifications` que a rota TERIA feito. */
let notificacoesInseridas: Record<string, unknown>[] = []
/** Cada `update` em `nudge_suggestions` (a reivindicação pending → approved). */
let sugestoesAtualizadas: Record<string, unknown>[] = []
/** Toda chamada encadeada, para conferir o ESCOPO da leitura de matrículas. */
let chamadas: { tabela: string; metodo: string; args: unknown[] }[] = []

/**
 * Um elo de consulta encadeável e aguardável.
 *
 * A cadeia é `select → eq → in` (mais `single`), a MESMA que os stubs irmãos
 * desta casa implementam — um `.is()` a mais no código de produção quebraria
 * aqueles arquivos, então o corte de `deleted_at` continua sendo feito em
 * memória, dentro de `resumirMatriculas`.
 */
// biome-ignore lint/suspicious/noExplicitAny: stub de banco, imita o builder do supabase
function encadear(tabela: string, resolver: () => Resultado): any {
  const registrar = (metodo: string, args: unknown[]) => {
    chamadas.push({ tabela, metodo, args })
  }
  // biome-ignore lint/suspicious/noExplicitAny: stub de banco
  const elo: any = {
    select: (...a: unknown[]) => {
      registrar("select", a)
      return elo
    },
    eq: (...a: unknown[]) => {
      registrar("eq", a)
      return elo
    },
    in: (...a: unknown[]) => {
      registrar("in", a)
      return elo
    },
    neq: (...a: unknown[]) => {
      registrar("neq", a)
      return elo
    },
    order: (...a: unknown[]) => {
      registrar("order", a)
      return elo
    },
    limit: () => Promise.resolve(resolver()),
    single: () => Promise.resolve(resolver()),
    // biome-ignore lint/suspicious/noThenProperty: thenable imita o builder aguardável do supabase
    then: (ok: (v: Resultado) => unknown, falha?: (e: unknown) => unknown) =>
      Promise.resolve(resolver()).then(ok, falha),
  }
  return elo
}

function instalarBanco() {
  mockServiceFrom.mockImplementation((tabela: string) => {
    switch (tabela) {
      case "nudge_suggestions":
        return {
          select: (...a: unknown[]) => {
            chamadas.push({ tabela, metodo: "select", args: a })
            return encadear(tabela, () => ({
              data: sugestao,
              error: sugestao ? null : { message: "not found" },
            }))
          },
          // A ESCRITA de reivindicação. Registrada, nunca executada.
          update: (patch: Record<string, unknown>) =>
            encadear(tabela, () => {
              sugestoesAtualizadas.push(patch)
              return { data: { id: SUGESTAO }, error: null }
            }),
        }
      case "notification_templates":
        return {
          select: () =>
            encadear(tabela, () => ({
              data: {
                id: "template-1",
                tenant_id: TENANT,
                key: "inactive_14d",
                name: "Retomada",
                category: "engagement",
                channel_inapp: true,
                // false de propósito: o caminho de e-mail (Resend) nunca é
                // alcançado neste arquivo. Nenhum disparo real.
                channel_email: false,
                title: "Olá, {{primeiro_nome}}",
                body_inapp: "Volte para a trilha.",
                email_subject: null,
                email_html: null,
                // Sem "curso": `resolveTenantCourseName` não é chamado.
                variables: ["primeiro_nome"],
                intent: null,
                tone: null,
                is_active: true,
                created_by: null,
                created_at: "2026-01-01T00:00:00.000Z",
                updated_at: "2026-01-01T00:00:00.000Z",
              },
              error: null,
            })),
        }
      case "user_roles":
        return {
          select: () =>
            encadear(tabela, () => ({
              // Todo alvo da sugestão tem chapéu de aluno neste stub.
              data: alvosDaSugestao().map((id) => ({ user_id: id })),
              error: null,
            })),
        }
      case "users":
        return {
          select: () =>
            encadear(tabela, () => ({
              data: alvosDaSugestao().map((id) => ({
                id,
                full_name: id === CONCLUIU ? "Ana Concluiu" : "Bruno Em Curso",
                email: null,
              })),
              error: null,
            })),
        }
      case "enrollments":
        return {
          select: (...a: unknown[]) => {
            chamadas.push({ tabela, metodo: "select", args: a })
            return encadear(tabela, () => ({
              data: erroDeMatriculas ? null : matriculas,
              error: erroDeMatriculas,
            }))
          },
        }
      case "notifications":
        return {
          // A ESCRITA que alcança o aluno. Registrada, nunca executada.
          insert: (linha: Record<string, unknown>) => {
            notificacoesInseridas.push(linha)
            return Promise.resolve({ data: null, error: null })
          },
        }
      default:
        throw new Error(`tabela inesperada: ${tabela}`)
    }
  })
}

function alvosDaSugestao(): string[] {
  const alvos = sugestao?.target_student_ids
  return Array.isArray(alvos) ? (alvos as string[]) : []
}

function instalarSugestao(tipo: string, alvos: string[]) {
  sugestao = {
    id: SUGESTAO,
    tenant_id: TENANT,
    type: tipo,
    target_student_ids: alvos,
    template_key: "inactive_14d",
    rationale: null,
    status: "pending",
    manager_id: null,
    suggested_at: "2026-08-01T00:00:00.000Z",
    approved_by: null,
    approved_at: null,
  }
}

function comoAdmin() {
  mockGetAuthProfile.mockResolvedValue({
    user: { id: ADMIN },
    profile: { tenant_id: TENANT, full_name: "Hugo" },
    roles: ["admin"],
    supabase: {},
  })
  mockResolveTenantId.mockResolvedValue(TENANT)
}

function patch(body: unknown): Request {
  return new Request(`http://localhost/api/admin/engagement/suggestions/${SUGESTAO}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function chamar(body: unknown) {
  return suggestionPATCH(patch(body), { params: Promise.resolve({ id: SUGESTAO }) })
}

/** Os destinatários que de fato receberiam a notificação. */
function destinatarios(): string[] {
  return notificacoesInseridas.map((l) => l.recipient_id as string)
}

/** A leitura de matrículas, se a rota chegou a fazê-la. */
function leituraDeMatriculas(metodo: string): unknown[] | null {
  return chamadas.find((c) => c.tabela === "enrollments" && c.metodo === metodo)?.args ?? null
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  notificacoesInseridas = []
  sugestoesAtualizadas = []
  chamadas = []
  erroDeMatriculas = null
  // Default: cobrança para quem está em curso, ninguém concluiu.
  instalarSugestao("inactive", [EM_CURSO])
  matriculas = [{ student_id: EM_CURSO, status: "active", deleted_at: null }]
  // Admin ⇒ escopo nulo (tenant inteiro), como a rota já faz hoje.
  mockResolveCallerStudentScope.mockResolvedValue(null)
  instalarBanco()
})

// ---------------------------------------------------------------------------
// 1. O PORTÃO. Desligado no SERVIDOR, um PATCH direto não escreve.
// ---------------------------------------------------------------------------
describe("PATCH suggestions/[id] — o portão é do servidor", () => {
  it("com o portão DESLIGADO, aprovar não chega à camada de escrita", async () => {
    comoAdmin()
    vi.stubEnv("ACIONAMENTO_ATIVO", "false")

    const res = await chamar({ action: "approve" })

    expect(notificacoesInseridas).toHaveLength(0)
    expect(sugestoesAtualizadas).toHaveLength(0)
    expect(res.status).toBe(503)
  })

  it("valor NÃO reconhecido fecha o portão — 'off' não vira 'ligado' por engano", async () => {
    // Allowlist de UM valor, a mesma das rotas irmãs: só "true" abre. O erro de
    // digitação que o desenho precisa sobreviver é o de quem QUIS desligar.
    comoAdmin()
    vi.stubEnv("ACIONAMENTO_ATIVO", "off")

    const res = await chamar({ action: "approve" })

    expect(notificacoesInseridas).toHaveLength(0)
    expect(sugestoesAtualizadas).toHaveLength(0)
    expect(res.status).toBe(503)
  })

  it("[CP] com o portão LIGADO, a aprovação segue seu caminho", async () => {
    comoAdmin()
    vi.stubEnv("ACIONAMENTO_ATIVO", "true")

    const res = await chamar({ action: "approve" })

    expect(res.status).toBe(200)
    expect(destinatarios()).toEqual([EM_CURSO])
  })

  it("[CP] SEM a variável, a aprovação continua saindo — o interruptor não derruba a fila", async () => {
    // Nenhum `.env` deste repo define a variável, e a fila de sugestões ESTÁ em
    // produção. Fecha-se por DECISÃO explícita, nunca por omissão.
    comoAdmin()

    const res = await chamar({ action: "approve" })

    expect(res.status).toBe(200)
    expect(destinatarios()).toEqual([EM_CURSO])
  })

  it("[CP] DISPENSAR não é acionamento: segue funcionando com o portão desligado", async () => {
    // Controle contra a correção degenerada "fecha a rota inteira". Dispensar não
    // alcança aluno nenhum — só tira a sugestão da fila. Travá-la deixaria o
    // gestor sem como limpar a fila enquanto os envios estão desligados.
    comoAdmin()
    vi.stubEnv("ACIONAMENTO_ATIVO", "false")

    const res = await chamar({ action: "dismiss" })

    expect(res.status).toBe(200)
    expect(notificacoesInseridas).toHaveLength(0)
    expect(sugestoesAtualizadas).toHaveLength(1)
    expect(sugestoesAtualizadas[0]).toMatchObject({ status: "dismissed" })
  })
})

// ---------------------------------------------------------------------------
// 2. QUEM CONCLUIU. O filtro é do servidor, e vale para qualquer chamador.
// ---------------------------------------------------------------------------
describe("PATCH suggestions/[id] — quem concluiu não é cobrado", () => {
  beforeEach(() => {
    // Portão LIGADO em todo este bloco: o filtro de conclusão não pode depender
    // do portão. São duas travas independentes.
    vi.stubEnv("ACIONAMENTO_ATIVO", "true")
  })

  it("aprovar cobrança para quem CONCLUIU é recusado, sem escrever", async () => {
    comoAdmin()
    instalarSugestao("inactive", [CONCLUIU])
    matriculas = [{ student_id: CONCLUIU, status: "completed", deleted_at: null }]

    const res = await chamar({ action: "approve" })

    expect(notificacoesInseridas).toHaveLength(0)
    // A sugestão continua PENDENTE: marcar "aprovada" sem enviar a ninguém é
    // registro que mente sobre o que aconteceu.
    expect(sugestoesAtualizadas).toHaveLength(0)
    expect(res.status).toBe(400)
    const corpo = (await res.json()) as { error?: string }
    expect(corpo.error).toMatch(/conclu/i)
  })

  it("numa lista mista, só quem NÃO concluiu recebe a notificação", async () => {
    comoAdmin()
    instalarSugestao("never_accessed", [EM_CURSO, CONCLUIU])
    matriculas = [
      { student_id: EM_CURSO, status: "active", deleted_at: null },
      { student_id: CONCLUIU, status: "completed", deleted_at: null },
    ]

    const res = await chamar({ action: "approve" })

    expect(res.status).toBe(200)
    expect(destinatarios()).toEqual([EM_CURSO])
    expect(destinatarios()).not.toContain(CONCLUIU)
  })

  it("a leitura de matrículas é escopada ao tenant e aos destinatários da sugestão", async () => {
    // Sem `.eq("tenant_id")` a rota decidiria a conclusão de alguém com dado de
    // OUTRO cliente; sem o `.in(...)` leria a base inteira a cada aprovação.
    comoAdmin()

    await chamar({ action: "approve" })

    expect(leituraDeMatriculas("eq")).toEqual(["tenant_id", TENANT])
    expect(leituraDeMatriculas("in")).toEqual(["student_id", [EM_CURSO]])
    const colunas = leituraDeMatriculas("select")?.[0] as string | undefined
    expect(colunas).toContain("deleted_at")
    expect(colunas).toContain("status")
  })

  it("[CP] RECONHECER quem concluiu continua permitido — não é cobrança", async () => {
    comoAdmin()
    instalarSugestao("top_performer", [CONCLUIU])
    matriculas = [{ student_id: CONCLUIU, status: "completed", deleted_at: null }]

    const res = await chamar({ action: "approve" })

    expect(res.status).toBe(200)
    expect(destinatarios()).toEqual([CONCLUIU])
  })

  it("[CP] COMUNICADO alcança quem concluiu — não pede nada de ninguém", async () => {
    comoAdmin()
    instalarSugestao("announcement", [CONCLUIU])
    matriculas = [{ student_id: CONCLUIU, status: "completed", deleted_at: null }]

    const res = await chamar({ action: "approve" })

    expect(res.status).toBe(200)
    expect(destinatarios()).toEqual([CONCLUIU])
  })

  it("[CP] cobrança para quem está EM CURSO continua saindo", async () => {
    comoAdmin()
    instalarSugestao("inactive", [EM_CURSO])
    matriculas = [{ student_id: EM_CURSO, status: "active", deleted_at: null }]

    const res = await chamar({ action: "approve" })

    expect(res.status).toBe(200)
    expect(destinatarios()).toEqual([EM_CURSO])
  })

  it("[CP] sem matrícula nenhuma NÃO é conclusão — o critério exige ao menos uma viva", async () => {
    comoAdmin()
    matriculas = []

    const res = await chamar({ action: "approve" })

    expect(res.status).toBe(200)
    expect(destinatarios()).toEqual([EM_CURSO])
  })
})

// ---------------------------------------------------------------------------
// 3. I-4. Não saber o estado de alguém não autoriza cobrá-lo.
// ---------------------------------------------------------------------------
describe("PATCH suggestions/[id] — erro de leitura barra o envio (I-4)", () => {
  it("falha ao ler matrículas não vira 'ninguém concluiu'", async () => {
    comoAdmin()
    vi.stubEnv("ACIONAMENTO_ATIVO", "true")
    erroDeMatriculas = { message: "connection reset" }

    const res = await chamar({ action: "approve" })

    expect(notificacoesInseridas).toHaveLength(0)
    expect(sugestoesAtualizadas).toHaveLength(0)
    expect(res.status).toBe(503)
  })
})
