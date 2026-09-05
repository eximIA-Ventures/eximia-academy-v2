import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// O TERCEIRO ESTADO NOS SEIS SÍTIOS QUE O COMPILADOR NÃO ALCANÇA.
// ---------------------------------------------------------------------------
// `requireCourseManager` devolve TRÊS estados, e o terceiro ("não deu para
// verificar") só vale alguma coisa se o CHAMADOR o distinguir. Nos chamadores
// que LEEM a mensagem, o `tsc` enumera quem esqueceu — é por isso que
// `CourseManagerCheck` foi escrito com o campo AUSENTE em vez de `?: never`.
//
// Seis chamadores ficam fora desse alcance porque nunca leem a mensagem: cinco
// páginas RSC que só fazem `redirect`, e o `slide-actions` que só faz `throw
// "Forbidden"`. Neles o terceiro estado é apagável sem que nada reclame.
//
// MEDIDO (verificação cruzada de 2026-08-28, mutação M11): remover a linha
// `if (roleCheck.motivo === "indisponivel") throw new Error(...)` de
// `courses/[courseId]/questions/page.tsx` produziu **zero falhas novas** — suíte
// inteira de `@eximia/web` idêntica com e sem a mutação (`22 failed | 4083
// passed | 5 skipped` nos dois estados), e `tsc --noEmit` limpo nos dois.
// Veredito: **presente, não guardado**. Este arquivo é a rede que faltava.
//
// O QUE ESTA RÉGUA MEDE, E O QUE NÃO MEDE. Ela mede o DESFECHO de cada sítio nos
// três estados do guard, não a presença de um token no arquivo. Contar
// ocorrências de `"indisponivel"` seria a régua fraca que a própria frente
// admitiu ter: um `if` invertido, um `motivo` trocado ou um `throw` que virou
// `redirect` continuariam com o token no lugar. Aqui o guard é o REAL — quem é
// duplado é o cliente Supabase abaixo dele —, então o que reprova é o
// comportamento composto.
//
// POR QUE O REDIRECIONAMENTO É A COISA ERRADA A FAZER NA INDISPONIBILIDADE:
// mandar de volta para a lista de cursos diz "você não pertence aqui", que é a
// mesma mentira do 403 que esta auditoria inteira existe para desfazer. O throw
// cai na fronteira de erro do Next, que é retentável e verdadeira.
//
// NENHUMA ESCRITA E NENHUMA REDE: o cliente Supabase inteiro é um duplo em
// memória, `next/navigation` e `next/cache` são dublês, e os componentes de tela
// são stubs (não renderizamos nada — o veredito é sempre anterior ao JSX).
// ---------------------------------------------------------------------------

const USUARIO = "11111111-1111-1111-1111-111111111111"
const TENANT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const CURSO = "22222222-2222-2222-2222-222222222222"
const CAPITULO = "33333333-3333-3333-3333-333333333333"

/** O erro que o PostgREST devolve num timeout de statement. Transitório por definição. */
const ERRO_TRANSITORIO = {
  code: "57014",
  message: "canceling statement due to statement timeout",
  details: null,
  hint: null,
}

type Resultado = { data: unknown; error: unknown }

/** Chapéu de instrutor pela UNIÃO (`user_roles`), como o guard decide. */
const COM_CHAPEU_DE_INSTRUTOR = {
  role: "manager",
  tenant_id: TENANT,
  user_roles: [{ role: "instructor" }],
}

/** Só gestor: o guard NEGA de propósito (fix-manager-privacy-gates, Correção 2). */
const SO_GESTOR = {
  role: "manager",
  tenant_id: TENANT,
  user_roles: [{ role: "manager" }],
}

let perfilRetornado: Resultado = { data: COM_CHAPEU_DE_INSTRUTOR, error: null }
let usuarioAutenticado: { id: string } | null = { id: USUARIO }

/**
 * As leituras que vêm DEPOIS do guard. Devolvem linha plausível de propósito: no
 * caso [CP] em que o guard deixa passar, a página precisa conseguir seguir até o
 * fim — senão o "não lançou a indisponibilidade" ficaria verde por a página ter
 * parado em outro lugar qualquer, e o controle positivo perderia a força.
 */
function depoisDoGuard(tabela: string): { singular: Resultado; plural: Resultado } {
  switch (tabela) {
    case "courses":
      return {
        singular: { data: { id: CURSO, title: "Curso de teste" }, error: null },
        plural: { data: [], error: null },
      }
    case "chapters":
      return {
        singular: {
          data: { id: CAPITULO, title: "Capítulo", status: "draft", order: 1, course_id: CURSO },
          error: null,
        },
        plural: { data: [], error: null },
      }
    default:
      return { singular: { data: null, error: null }, plural: { data: [], error: null } }
  }
}

/**
 * Duplo do cliente Supabase. Qualquer encadeamento devolve o mesmo proxy; os
 * terminais (`await`, `.single()`, `.maybeSingle()`) resolvem no resultado da
 * tabela pedida. `users` é a tabela que este arquivo controla — é por ela que os
 * três estados do guard entram.
 */
function clienteFake() {
  const construir = (tabela: string) => {
    const outras = depoisDoGuard(tabela)
    const singular: Resultado = tabela === "users" ? perfilRetornado : outras.singular
    const plural = tabela === "users" ? perfilRetornado : outras.plural
    // biome-ignore lint/suspicious/noExplicitAny: duplo de um builder sem tipo estável
    const elo: any = new Proxy(() => elo, {
      get(_alvo, prop) {
        if (prop === "then") {
          // biome-ignore lint/suspicious/noExplicitAny: assinatura de thenable
          return (ok: any, falha: any) => Promise.resolve(plural).then(ok, falha)
        }
        if (prop === "single" || prop === "maybeSingle") return () => Promise.resolve(singular)
        return () => elo
      },
      apply: () => elo,
    })
    return elo
  }

  return {
    auth: { getUser: async () => ({ data: { user: usuarioAutenticado }, error: null }) },
    from: (tabela: string) => construir(tabela),
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: { message: "duplo" } }),
        getPublicUrl: () => ({ data: { publicUrl: "http://duplo/x" } }),
      }),
    },
  }
}

/**
 * `redirect()` do Next LANÇA — e é essa a diferença que medimos. Um sentinela
 * distinto deixa "foi embora para a lista" e "subiu a indisponibilidade"
 * distinguíveis um do outro; sem isso, os dois desfechos seriam "lançou algo" e
 * a mutação passaria.
 */
const MARCA_DE_REDIRECIONAMENTO = "__REDIRECIONOU__:"
const MARCA_DE_NOT_FOUND = "__NOT_FOUND__"

/** Declaração de função (não `const`): a fábrica de `vi.mock` é içada acima dos `import`. */
function lancarRedirecionamento(destino: string): never {
  throw new Error(`${MARCA_DE_REDIRECIONAMENTO}${destino}`)
}

function lancarNotFound(): never {
  throw new Error(MARCA_DE_NOT_FOUND)
}

vi.mock("@/lib/auth", () => ({ getDbClient: async () => clienteFake() }))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => clienteFake() }))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => clienteFake() }))
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => lancarRedirecionamento(destino),
  notFound: () => lancarNotFound(),
}))
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }))

// Os componentes de tela são irrelevantes para este veredito (que acontece antes
// do JSX) e caros para importar. Stubs.
vi.mock("../questions/_components/course-questions-overview", () => ({
  CourseQuestionsOverview: () => null,
}))
vi.mock("../chapters/new/_components/chapter-mode-selector", () => ({
  ChapterModeSelector: () => null,
}))
vi.mock("../chapters/new/ingest/_components/chapter-ingestion-wizard", () => ({
  ChapterIngestionWizard: () => null,
}))
vi.mock("../chapters/[chapterId]/edit/_components/chapter-editor-client", () => ({
  ChapterEditorClient: () => null,
}))
vi.mock("../chapters/[chapterId]/questions/_components/questions-review-client", () => ({
  QuestionsReviewClient: () => null,
}))

import { MENSAGEM_INDISPONIVEL } from "@/lib/course-management-guard"
import PaginaDeEdicaoDeCapitulo from "../chapters/[chapterId]/edit/page"
import { updateSlideText } from "../chapters/[chapterId]/edit/slide-actions"
import PaginaDePerguntasDoCapitulo from "../chapters/[chapterId]/questions/page"
import PaginaDeIngestao from "../chapters/new/ingest/page"
import PaginaDeNovoCapitulo from "../chapters/new/page"
import PaginaDeInteracoesDoCurso from "../questions/page"

const soCurso = { params: Promise.resolve({ courseId: CURSO }) }
const cursoECapitulo = { params: Promise.resolve({ courseId: CURSO, chapterId: CAPITULO }) }

/**
 * Os seis sítios. `destinoDaRecusa` é para onde CADA UM manda quem realmente não
 * tem direito — e é o que a indisponibilidade NÃO pode produzir. Nas páginas é um
 * caminho; no `slide-actions`, que não redireciona, é a mensagem `"Forbidden"`.
 */
const SITIOS: Array<{
  nome: string
  chamar: () => Promise<unknown>
  /** O desfecho legítimo de "não tem direito", que a indisponibilidade não pode imitar. */
  recusaLegitima: string
}> = [
  {
    nome: "página /courses/[courseId]/questions (Interações do curso)",
    chamar: () => PaginaDeInteracoesDoCurso(soCurso),
    recusaLegitima: `${MARCA_DE_REDIRECIONAMENTO}/courses`,
  },
  {
    nome: "página /courses/[courseId]/chapters/new (Novo Capítulo)",
    chamar: () => PaginaDeNovoCapitulo(soCurso),
    recusaLegitima: `${MARCA_DE_REDIRECIONAMENTO}/courses/${CURSO}`,
  },
  {
    nome: "página /courses/[courseId]/chapters/new/ingest (Ingestão)",
    chamar: () => PaginaDeIngestao(soCurso),
    recusaLegitima: `${MARCA_DE_REDIRECIONAMENTO}/courses/${CURSO}`,
  },
  {
    nome: "página /courses/[courseId]/chapters/[chapterId]/edit (Editor)",
    chamar: () => PaginaDeEdicaoDeCapitulo(cursoECapitulo),
    recusaLegitima: `${MARCA_DE_REDIRECIONAMENTO}/courses/${CURSO}`,
  },
  {
    nome: "página /courses/[courseId]/chapters/[chapterId]/questions (Revisão)",
    chamar: () => PaginaDePerguntasDoCapitulo(cursoECapitulo),
    recusaLegitima: `${MARCA_DE_REDIRECIONAMENTO}/courses`,
  },
  {
    nome: "server action updateSlideText (slide-actions)",
    chamar: () => updateSlideText("44444444-4444-4444-4444-444444444444", "texto"),
    recusaLegitima: "Forbidden",
  },
]

beforeEach(() => {
  usuarioAutenticado = { id: USUARIO }
  perfilRetornado = { data: COM_CHAPEU_DE_INSTRUTOR, error: null }
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("terceiro estado do requireCourseManager — os 6 sítios invisíveis ao compilador", () => {
  for (const sitio of SITIOS) {
    it(`${sitio.nome} — leitura de perfil INDISPONÍVEL sobe como indisponibilidade`, async () => {
      perfilRetornado = { data: null, error: ERRO_TRANSITORIO }

      // O coração do defeito que a mutação M11 revelou: sem a linha do terceiro
      // estado, isto vira o desfecho de "não tem direito" — a mesma mentira do
      // 403, agora vestida de redirecionamento (ou de "Forbidden").
      await expect(sitio.chamar()).rejects.toThrow(MENSAGEM_INDISPONIVEL)
    })

    it(`[CP] ${sitio.nome} — quem NÃO tem o chapéu continua recusado, como antes`, async () => {
      // Sem este caso, a régua acima ficaria verde com a correção degenerada
      // "lança indisponibilidade sempre", que destruiria o gate de privacidade.
      perfilRetornado = { data: SO_GESTOR, error: null }

      await expect(sitio.chamar()).rejects.toThrow(sitio.recusaLegitima)
    })

    it(`[CP] ${sitio.nome} — a recusa legítima NÃO diz "tente de novo"`, async () => {
      // A ponta que o caso acima não cobre: se a recusa legítima passasse a
      // carregar a mensagem de indisponibilidade, o usuário sem direito ficaria
      // retentando para sempre. Os dois desfechos precisam continuar DISTINTOS.
      perfilRetornado = { data: SO_GESTOR, error: null }

      await expect(sitio.chamar()).rejects.not.toThrow(MENSAGEM_INDISPONIVEL)
    })

    it(`[CP] ${sitio.nome} — quem TEM o chapéu atravessa`, async () => {
      perfilRetornado = { data: COM_CHAPEU_DE_INSTRUTOR, error: null }

      // Nem indisponibilidade, nem recusa: o sítio segue seu caminho normal.
      await expect(sitio.chamar()).resolves.toBeDefined()
    })
  }
})
