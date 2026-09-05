import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// O "Step 4" DO APPLY: a escrita que FECHA a operação não podia sumir calada.
// ---------------------------------------------------------------------------
// DEFEITO QUE ESTE ARQUIVO TRANCA (laudo LOOP-0c, tabela E→SUCESSO #2).
// Depois de criar curso, capítulos e perguntas, a rota marcava o blueprint como
// aplicado:
//
//     await supabase.from("course_blueprints")
//       .update({ status: "applied", applied_to_course: true, applied_at: ... })
//       .eq("id", blueprintId)
//     return NextResponse.json({ success: true, courseId, ... })
//
// Sem `{ error }`, sem `if`. Se essa escrita falhasse, o gestor lia "blueprint
// aplicado com sucesso" enquanto o registro continuava `approved` — e o mesmo
// botão podia aplicá-lo de novo, gerando um segundo curso a partir do mesmo
// blueprint. As três escritas anteriores têm rollback e 500; a quarta, que é
// justamente a que fecha a operação, não tinha nem log.
//
// CONTROLE POSITIVO [CP]: o caminho feliz continua 200 com `success:true`, e a
// falha na inserção de perguntas continua 500 com rollback. Sem eles, a correção
// degenerada "responde 500 sempre" ficaria verde.
//
// NENHUMA ESCRITA REAL: cliente Supabase e `applyBlueprint` (o LLM) são duplos.
// ---------------------------------------------------------------------------

const USUARIO = "11111111-1111-1111-1111-111111111111"
const TENANT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const BLUEPRINT = "33333333-3333-3333-3333-333333333333"
const CURSO = "44444444-4444-4444-4444-444444444444"

const ERRO_ESCRITA = {
  code: "57014",
  message: "canceling statement due to statement timeout",
  details: null,
  hint: null,
}

type Resultado = { data: unknown; error: unknown }

/** Chave `tabela:operacao`. O que não estiver aqui resolve em sucesso vazio. */
let respostas: Record<string, Resultado> = {}
/** Toda operação de escrita que o duplo viu, na ordem — é como o [CP] confere o rollback. */
let escritas: string[] = []

const VERBOS_DE_ESCRITA = new Set(["insert", "update", "delete", "upsert"])

function clienteFake() {
  const construir = (tabela: string) => {
    let operacao = "select"
    const resolver = (): Resultado =>
      respostas[`${tabela}:${operacao}`] ?? { data: [], error: null }

    // biome-ignore lint/suspicious/noExplicitAny: duplo de um builder sem tipo estável
    const elo: any = new Proxy(() => elo, {
      get(_alvo, prop) {
        if (prop === "then") {
          // biome-ignore lint/suspicious/noExplicitAny: assinatura de thenable
          return (ok: any, falha: any) => Promise.resolve(resolver()).then(ok, falha)
        }
        if (prop === "single" || prop === "maybeSingle") return () => Promise.resolve(resolver())
        if (typeof prop === "string" && VERBOS_DE_ESCRITA.has(prop)) {
          return () => {
            operacao = prop
            escritas.push(`${tabela}:${prop}`)
            return elo
          }
        }
        return () => elo
      },
      apply: () => elo,
    })
    return elo
  }

  return {
    auth: { getUser: async () => ({ data: { user: { id: USUARIO } }, error: null }) },
    from: (tabela: string) => construir(tabela),
  }
}

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => clienteFake() }))
vi.mock("@/lib/feature-gate", () => ({ requireFeature: async () => null }))
vi.mock("@/lib/rate-limit", () => ({ courseDesignerApplyLimiter: null }))
vi.mock("@eximia/agents", () => ({
  getModelWithFallback: () => ({}),
  applyBlueprint: async () => ({
    chapters: [
      {
        title: "Capítulo 1",
        content: "conteúdo",
        learningObjective: "objetivo",
        order: 1,
        interactionType: null,
        bloomTarget: null,
      },
    ],
    questions: [
      {
        chapterOrder: 1,
        text: "pergunta",
        skill: "skill",
        intention: "intention",
        expectedDepth: 2,
      },
    ],
    interactionConfig: {},
  }),
}))

import { POST } from "../[blueprintId]/apply/route"

function chamar() {
  const pedido = new Request(`http://t/api/course-designer/blueprints/${BLUEPRINT}/apply`, {
    method: "POST",
  })
  // biome-ignore lint/suspicious/noExplicitAny: a rota só lê o `NextRequest` como `Request`
  return POST(pedido as any, { params: Promise.resolve({ blueprintId: BLUEPRINT }) })
}

beforeEach(() => {
  escritas = []
  respostas = {
    "users:select": { data: { role: "manager", tenant_id: TENANT }, error: null },
    "course_blueprints:select": {
      data: {
        id: BLUEPRINT,
        tenant_id: TENANT,
        status: "approved",
        blueprint_data: { course_title: "Curso de teste" },
        primary_framework: "abc",
        framework: null,
        interaction_strategy: null,
      },
      error: null,
    },
    "blueprint_modules:select": {
      data: [
        {
          order: 1,
          title: "Módulo 1",
          description: "descrição",
          duration_minutes: 30,
          interaction_type: null,
          framework_stages: [],
        },
      ],
      error: null,
    },
    "blueprint_objectives:select": { data: [], error: null },
    "courses:insert": { data: { id: CURSO }, error: null },
    "chapters:insert": {
      data: [{ id: "55555555-5555-5555-5555-555555555555", order: 1 }],
      error: null,
    },
    "questions:insert": { data: null, error: null },
    "course_blueprints:update": { data: null, error: null },
  }
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("apply blueprint — a escrita que fecha a operação não some calada", () => {
  it("Step 4 falhando NÃO pode responder success:true", async () => {
    respostas["course_blueprints:update"] = { data: null, error: ERRO_ESCRITA }

    const resposta = await chamar()
    const corpo = (await resposta.json()) as { success?: boolean; error?: string }

    // O coração do defeito: hoje isto responde 200 { success: true }.
    expect(corpo.success).not.toBe(true)
    expect(resposta.status).toBe(500)
    expect(corpo.error).toBeTruthy()
  })

  it("[CP] caminho feliz continua 200 com success:true", async () => {
    const resposta = await chamar()
    const corpo = (await resposta.json()) as {
      success?: boolean
      courseId?: string
      chaptersCreated?: number
      questionsCreated?: number
    }

    expect(resposta.status).toBe(200)
    expect(corpo.success).toBe(true)
    expect(corpo.courseId).toBe(CURSO)
    expect(corpo.chaptersCreated).toBe(1)
    expect(corpo.questionsCreated).toBe(1)
    expect(escritas).toContain("course_blueprints:update")
  })

  it("[CP] falha nas perguntas continua 500 e faz rollback de capítulos e curso", async () => {
    respostas["questions:insert"] = { data: null, error: ERRO_ESCRITA }

    const resposta = await chamar()

    expect(resposta.status).toBe(500)
    expect(escritas).toContain("chapters:delete")
    expect(escritas).toContain("courses:delete")
    // E o blueprint NÃO pode ter sido marcado como aplicado.
    expect(escritas).not.toContain("course_blueprints:update")
  })
})
