import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// A FALHA QUE SE APRESENTA COMO SUCESSO — no caminho que os usuários percorrem.
// ---------------------------------------------------------------------------
// Achado lateral do FIX-B8, não pedido. A rota `GET /api/courses/[id]/quizzes`
// é órfã (nenhum consumidor no repositório) e já tem trava de teste. A tela real
// usa uma GÊMEA: a server action `listCourseQuizzes`, que faz a mesma consulta —
// e ela tem o defeito que a rota não tem:
//
//     if (error) return { error: "Erro ao carregar quizzes", data: [] }
//
//     // quiz-list.tsx
//     listCourseQuizzes(courseId).then((res) => { setQuizzes(res.data); setLoading(false) })
//
// O componente lê `res.data` e **ignora `res.error`**. Uma falha de banco devolve
// `data: []`, e a tela desenha "Nenhum quiz criado ainda" com o convite "Crie um
// quiz para avaliar o aprendizado dos alunos". O instrutor conclui que o curso
// está vazio e cria um quiz duplicado, ou desiste.
//
// É a mesma família E→ENGOLIDO do laudo LOOP-0c, e o único caso desta rodada em
// que o USUÁRIO FINAL vê a mentira desenhada na tela.
//
// Este arquivo exercita a costura REAL: o duplo é o cliente Supabase, e a action
// de verdade roda contra ele. Não mocko a action — mockar a action mediria o
// componente contra a minha suposição do que ela devolve, e é justamente essa
// suposição que está errada hoje.
//
// CONTROLE POSITIVO ([CP]): lista genuinamente vazia CONTINUA desenhando o vazio.
// Sem ele, a correção degenerada "mostre erro sempre" ficaria verde.
// ---------------------------------------------------------------------------

const ERRO_TRANSITORIO = {
  code: "57014",
  message: "canceling statement due to statement timeout",
  details: null,
  hint: null,
}

type Resultado = { data: unknown; error: unknown }

let quizzesRetornados: Resultado = { data: [], error: null }
let usuarioAutenticado: { id: string } | null = { id: "u1" }

function clienteFake() {
  // biome-ignore lint/suspicious/noExplicitAny: duplo de um builder sem tipo estável
  const elo: any = new Proxy(() => elo, {
    get(_a, prop) {
      if (prop === "then") {
        // biome-ignore lint/suspicious/noExplicitAny: assinatura de thenable
        return (ok: any, falha: any) => Promise.resolve(quizzesRetornados).then(ok, falha)
      }
      if (prop === "single" || prop === "maybeSingle")
        return () => Promise.resolve(quizzesRetornados)
      return () => elo
    },
    apply: () => elo,
  })

  return {
    auth: { getUser: async () => ({ data: { user: usuarioAutenticado }, error: null }) },
    from: () => elo,
  }
}

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => clienteFake() }))
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }))

import { QuizList } from "../_components/quiz-list"

const VAZIO = "Nenhum quiz criado ainda"

beforeEach(() => {
  usuarioAutenticado = { id: "u1" }
  quizzesRetornados = { data: [], error: null }
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("QuizList — falha de leitura não pode virar 'nenhum quiz'", () => {
  it("erro de banco NÃO pode desenhar o estado vazio", async () => {
    quizzesRetornados = { data: null, error: ERRO_TRANSITORIO }

    render(<QuizList courseId="c1" canCreate={true} />)

    // O coração do defeito: hoje a tela mostra "Nenhum quiz criado ainda".
    await waitFor(() => expect(screen.queryByText(/Carregando/)).not.toBeInTheDocument())
    expect(screen.queryByText(VAZIO)).not.toBeInTheDocument()
  })

  it("erro de banco precisa DIZER que falhou, e oferecer nova tentativa", async () => {
    quizzesRetornados = { data: null, error: ERRO_TRANSITORIO }

    render(<QuizList courseId="c1" canCreate={true} />)

    await waitFor(() => expect(screen.getByText(/não foi possível carregar/i)).toBeInTheDocument())
    expect(screen.getByRole("button", { name: /tentar novamente/i })).toBeInTheDocument()
  })

  it("[CP] lista genuinamente vazia CONTINUA desenhando o vazio", async () => {
    // Sem este caso, "mostre erro sempre" ficaria verde e a tela perderia o
    // convite legítimo de criar o primeiro quiz.
    quizzesRetornados = { data: [], error: null }

    render(<QuizList courseId="c1" canCreate={true} />)

    await waitFor(() => expect(screen.getByText(VAZIO)).toBeInTheDocument())
  })

  it("[CP] lista com quizzes continua desenhando os quizzes", async () => {
    quizzesRetornados = {
      data: [
        {
          id: "q1",
          title: "Avaliação Final",
          quiz_type: "exam",
          is_active: true,
          question_ids: ["a", "b"],
          time_limit_minutes: 30,
          passing_score: 70,
          max_attempts: 2,
          created_at: "2026-08-30T00:00:00Z",
        },
      ],
      error: null,
    }

    render(<QuizList courseId="c1" canCreate={true} />)

    await waitFor(() => expect(screen.getByText("Avaliação Final")).toBeInTheDocument())
    expect(screen.queryByText(VAZIO)).not.toBeInTheDocument()
  })

  it("[CP] sem sessão também não pode virar 'nenhum quiz'", async () => {
    // A action já devolvia `{ error: "Não autorizado", data: [] }` — mesma forma,
    // mesmo desfecho na tela.
    usuarioAutenticado = null

    render(<QuizList courseId="c1" canCreate={true} />)

    await waitFor(() => expect(screen.queryByText(/Carregando/)).not.toBeInTheDocument())
    expect(screen.queryByText(VAZIO)).not.toBeInTheDocument()
  })
})
