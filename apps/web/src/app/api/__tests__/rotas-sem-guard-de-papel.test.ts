import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// As duas rotas que só checavam AUTENTICAÇÃO, e nenhum papel.
// ---------------------------------------------------------------------------
// Elas recebem tratamentos OPOSTOS, e a razão é a mesma em ambos os casos: o que
// o RLS já garante, e quem é o público legítimo do dado.
//
// (1) `chapters/[chapterId]/slides/generation-status` — GANHA guard.
//     A política `chapter_slides_select` (migration 20260314000000) exige apenas
//     `authenticated` + tenant do usuário. NÃO é escopada por matrícula nem por
//     papel. Logo, hoje QUALQUER membro do tenant — inclusive um aluno não
//     matriculado — lê o progresso de autoria de um capítulo em rascunho. O único
//     consumidor da rota é o `slide-manager.tsx`, que vive dentro de uma página já
//     protegida por `requireCourseManager`. Aplicar o mesmo guard alinha a rota ao
//     seu único chamador e não fecha porta em ninguém legítimo.
//
// (2) `courses/[courseId]/quizzes` — NÃO ganha guard, de propósito.
//     A política `qs_student_select` contempla EXPLICITAMENTE o aluno: tenant +
//     papel student + `is_active` + matrícula ATIVA no curso. O aluno é público
//     legítimo deste dado, por desenho do banco. A rota não tem nenhum consumidor
//     no repositório, então não dá para inferir intenção pelo chamador. Pôr um
//     guard de instrutor aqui ESTREITARIA o acesso contra o desenho do RLS — o
//     mesmo erro de "mudar quem tem direito a pretexto de arrumar outra coisa",
//     só que na direção inversa. O teste abaixo FIXA o contrato atual para que a
//     próxima pessoa não tranque o aluno do lado de fora sem perceber.
// ---------------------------------------------------------------------------

const USUARIO = "11111111-1111-1111-1111-111111111111"
const TENANT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

const ERRO_TRANSITORIO = {
  code: "57014",
  message: "canceling statement due to statement timeout",
  details: null,
  hint: null,
}

type Resultado = { data: unknown; error: unknown }

const ALUNO = { role: "student", tenant_id: TENANT, user_roles: [{ role: "student" }] }
const INSTRUTOR = { role: "manager", tenant_id: TENANT, user_roles: [{ role: "instructor" }] }

let perfilRetornado: Resultado = { data: INSTRUTOR, error: null }
let usuarioAutenticado: { id: string } | null = { id: USUARIO }
/** O que as tabelas de dado (não `users`) devolvem. Ajustável por teste. */
let dadoRetornado: Resultado = { data: [], error: null }

function clienteFake() {
  const construir = (tabela: string) => {
    const alvo: Resultado = tabela === "users" ? perfilRetornado : dadoRetornado
    // biome-ignore lint/suspicious/noExplicitAny: duplo de um builder sem tipo estável
    const elo: any = new Proxy(() => elo, {
      get(_a, prop) {
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
    auth: { getUser: async () => ({ data: { user: usuarioAutenticado }, error: null }) },
    from: (tabela: string) => construir(tabela),
  }
}

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => clienteFake() }))

import { GET as statusDaGeracao } from "../chapters/[chapterId]/slides/generation-status/route"
import { GET as listarQuizzes } from "../courses/[courseId]/quizzes/route"

const ctxCapitulo = {
  params: Promise.resolve({ chapterId: "33333333-3333-3333-3333-333333333333" }),
}
const ctxCurso = { params: Promise.resolve({ courseId: "44444444-4444-4444-4444-444444444444" }) }

const chamarStatus = () =>
  statusDaGeracao(new Request("http://t/api/chapters/x/slides/generation-status"), ctxCapitulo)
const chamarQuizzes = () => listarQuizzes(new Request("http://t/api/courses/x/quizzes"), ctxCurso)

beforeEach(() => {
  usuarioAutenticado = { id: USUARIO }
  perfilRetornado = { data: INSTRUTOR, error: null }
  dadoRetornado = { data: [], error: null }
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("generation-status — progresso de autoria não é dado de aluno", () => {
  it("aluno do mesmo tenant NÃO pode ler o progresso de autoria", async () => {
    // O RLS de `chapter_slides` é escopado só por tenant: sem guard de papel, o
    // aluno atravessa e lê quantos slides o capítulo em rascunho tem.
    perfilRetornado = { data: ALUNO, error: null }
    dadoRetornado = { data: [{ id: "s1", text_status: "review" }], error: null }

    const resposta = await chamarStatus()

    expect(resposta.status).toBe(403)
  })

  it("falha ao LER o perfil não pode virar 403", async () => {
    perfilRetornado = { data: null, error: ERRO_TRANSITORIO }

    const resposta = await chamarStatus()

    expect(resposta.status).not.toBe(403)
    expect(resposta.status).toBe(503)
    expect(resposta.headers.get("Retry-After")).toBeTruthy()
  })

  it("[CP] chapéu de instrutor continua lendo o progresso", async () => {
    perfilRetornado = { data: INSTRUTOR, error: null }
    dadoRetornado = {
      data: [
        { id: "s1", text_status: "review" },
        { id: "s2", text_status: "pending" },
      ],
      error: null,
    }

    const resposta = await chamarStatus()

    expect(resposta.status).toBe(200)
    const corpo = (await resposta.json()) as { total: number; progress: number }
    expect(corpo.total).toBe(2)
    expect(corpo.progress).toBe(50)
  })

  it("[CP] chapéu de gestor puro continua recusado — mesma régua da página que a consome", async () => {
    perfilRetornado = {
      data: { role: "manager", tenant_id: TENANT, user_roles: [{ role: "manager" }] },
      error: null,
    }

    const resposta = await chamarStatus()

    expect(resposta.status).toBe(403)
  })

  it("[CP] sem sessão continua 401", async () => {
    usuarioAutenticado = null

    const resposta = await chamarStatus()

    expect(resposta.status).toBe(401)
  })
})

describe("quizzes — contrato FIXADO: o aluno é público legítimo, o RLS é a fronteira", () => {
  // Estes NÃO são correção de defeito: são trava. A rota continua exatamente como
  // está, e o teste existe para que a próxima pessoa que "padronizar guards" veja
  // vermelho antes de trancar o aluno do lado de fora.
  it("[TRAVA] aluno autenticado NÃO pode receber 403 — o RLS já o escopa por matrícula", async () => {
    perfilRetornado = { data: ALUNO, error: null }
    dadoRetornado = { data: [{ id: "q1", title: "Quiz", is_active: true }], error: null }

    const resposta = await chamarQuizzes()

    expect(resposta.status).not.toBe(403)
    expect(resposta.status).toBe(200)
  })

  it("[TRAVA] sem sessão continua 401", async () => {
    usuarioAutenticado = null

    const resposta = await chamarQuizzes()

    expect(resposta.status).toBe(401)
  })

  it("[TRAVA] erro de leitura continua 500 explícito, nunca lista vazia", async () => {
    // O oposto do E→NEGA: aqui o risco seria devolver `data: []` com 200 e a tela
    // desenhar "nenhum quiz" para uma falha de banco. A rota já checa `error`.
    dadoRetornado = { data: null, error: ERRO_TRANSITORIO }

    const resposta = await chamarQuizzes()

    expect(resposta.status).toBe(500)
  })
})
