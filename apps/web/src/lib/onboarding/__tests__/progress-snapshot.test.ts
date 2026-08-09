// ---------------------------------------------------------------------------
// `readStudentProgressSnapshot()` — os dois números do PRÓPRIO aluno para o
// bloco "No seu caso" da novidade 1.
//
// O que estes testes protegem, e por quê:
//
//   • A RÉGUA. O modal e a tabela "Meu ritmo" mostram os mesmos dois números na
//     MESMA tela. Se um arredondar e o outro não, o aluno lê "62.5%" ao lado de
//     "63%" e conclui, corretamente, que o sistema não sabe o próprio número.
//   • O SEM DADO. Convenção B9 (`student-home-indicators.ts`): ausência é `null`
//     explícito, nunca `0`. Um zero fabricado acusa de não ter estudado quem
//     estudou antes de a medição existir.
//   • O FAIL-OPEN. Isto serve um modal opcional na home do aluno. Falha de
//     leitura devolve os três `null` e a home fica de pé — nunca uma exceção.
//
// O duplo abaixo REJEITA qualquer consulta que ele não modela, em vez de
// devolver `{ data: [], error: null }`. É a mesma decisão de `resolve.test.ts`,
// e pelo mesmo motivo registrado lá: um duplo que responde plausivelmente a uma
// pergunta que não entende produz teste verde pelo motivo errado.
// ---------------------------------------------------------------------------

import { describe, expect, it, vi } from "vitest"
import { previewArtifactFor } from "../preview"
import { readStudentProgressSnapshot, resolveAnnouncementStats } from "../progress-snapshot"
import { FEATURE_KEYS, type PendingArtifact } from "../types"

const ALUNO = "aluno-1"
const CURSO = "curso-1"

type Row = Record<string, unknown>

interface StubData {
  enrollments?: Row[]
  enrollmentsError?: Row
  sessions?: Row[]
  reflections?: Row[]
  chapters?: Row[]
  slides?: Row[]
  viewProgress?: Row[]
  viewProgressError?: Row
}

/**
 * Um curso com `n` capítulos, cada um de 1 slide. Um slide por capítulo torna
 * "percorreu o capítulo" equivalente a "tem linha de telemetria com
 * `reached_last_slide_at`", que é o que estes testes querem controlar — a regra
 * fina de `moduleProgressPct` já tem cobertura própria em `view-progress`.
 */
function cursoDe(n: number): { chapters: Row[]; slides: Row[] } {
  const chapters = Array.from({ length: n }, (_, i) => ({
    id: `cap-${i}`,
    course_id: CURSO,
    order: i,
  }))
  const slides = chapters.map((c) => ({ id: `slide-${c.id}`, chapter_id: c.id, order: 0 }))
  return { chapters, slides }
}

/** Telemetria de quem chegou ao fim dos `n` primeiros capítulos. */
function percorreu(n: number): Row[] {
  return Array.from({ length: n }, (_, i) => ({
    student_id: ALUNO,
    chapter_id: `cap-${i}`,
    max_slide_index: 0,
    slides_total_at_last_view: 1,
    reached_last_slide_at: "2026-08-01T00:00:00.000Z",
  }))
}

function stubSupabase(data: StubData) {
  const thenable = (rows: Row[] | undefined, error: Row | null = null) => ({
    // biome-ignore lint/suspicious/noThenProperty: thenable de teste intencional (mesmo padrão de resolve.test.ts)
    then: (resolve: (r: { data: Row[] | null; error: Row | null }) => unknown) =>
      resolve({ data: error ? null : (rows ?? []), error }),
  })

  return {
    from(table: string) {
      switch (table) {
        case "enrollments":
          return {
            select: () => ({
              eq: () => ({
                in: () => ({
                  is: () => ({
                    neq: () => thenable(data.enrollments, data.enrollmentsError ?? null),
                  }),
                }),
              }),
            }),
          }
        case "sessions":
          return { select: () => ({ eq: () => thenable(data.sessions) }) }
        case "slide_reflections":
          return { select: () => ({ eq: () => thenable(data.reflections) }) }
        // As três abaixo são consumidas por `readViewProgressByStudent`.
        case "chapters":
          return { select: () => ({ in: () => thenable(data.chapters) }) }
        case "chapter_slides":
          return { select: () => ({ in: () => thenable(data.slides) }) }
        case "chapter_view_progress":
          return {
            select: () => ({
              in: () => thenable(data.viewProgress, data.viewProgressError ?? null),
            }),
          }
        default:
          throw new Error(`Consulta não modelada no duplo: ${table}`)
      }
    },
    // biome-ignore lint/suspicious/noExplicitAny: duplo estrutural, mesmo padrão de resolve.test.ts
  } as any
}

/** Matrícula com `pct` de conclusão declarada. */
function matricula(pct: number | { percentage: number | string } | null): Row {
  return {
    course_id: CURSO,
    status: "active",
    created_at: "2026-07-01T00:00:00.000Z",
    progress: pct,
  }
}

describe("readStudentProgressSnapshot — os dois números, na régua da tabela", () => {
  it("percorreu 3 de 8 e declarou 25%: devolve 38% e 25%, com o total de módulos", async () => {
    const { chapters, slides } = cursoDe(8)
    const snapshot = await readStudentProgressSnapshot(
      stubSupabase({
        enrollments: [matricula({ percentage: 25 })],
        chapters,
        slides,
        viewProgress: percorreu(3),
      }),
      ALUNO,
    )

    // 3/8 = 37.5 cru. ARREDONDADO aqui pelo mesmo motivo de `area-gestor.ts`:
    // a célula renderiza `${pct}%` literalmente, e "37.5%" ao lado de um inteiro
    // seriam duas réguas na mesma tela.
    expect(snapshot.percorridoPct).toBe(38)
    expect(snapshot.conclusaoPct).toBe(25)
    expect(snapshot.totalModules).toBe(8)
  })

  it("aceita `progress` como número cru, a outra forma que a coluna tem no banco", async () => {
    const { chapters, slides } = cursoDe(4)
    const snapshot = await readStudentProgressSnapshot(
      stubSupabase({
        enrollments: [matricula(50)],
        chapters,
        slides,
        viewProgress: percorreu(4),
      }),
      ALUNO,
    )

    expect(snapshot.conclusaoPct).toBe(50)
    expect(snapshot.percorridoPct).toBe(100)
  })

  it("com vários cursos, a conclusão é a do curso LÍDER (o maior percentual)", async () => {
    const { chapters, slides } = cursoDe(4)
    const snapshot = await readStudentProgressSnapshot(
      stubSupabase({
        enrollments: [
          matricula({ percentage: 10 }),
          { ...matricula({ percentage: 80 }), course_id: "curso-2" },
          matricula({ percentage: 40 }),
        ],
        chapters,
        slides,
        viewProgress: percorreu(1),
      }),
      ALUNO,
    )

    // Mesma definição de `computeBehindAndProgress`, que a tabela já usa.
    expect(snapshot.conclusaoPct).toBe(80)
  })
})

describe("readStudentProgressSnapshot — sem dado é null, nunca 0 (B9)", () => {
  it("sem nenhuma matrícula, não afirma nada sobre esta pessoa", async () => {
    const snapshot = await readStudentProgressSnapshot(stubSupabase({ enrollments: [] }), ALUNO)

    expect(snapshot).toEqual({ percorridoPct: null, conclusaoPct: null, totalModules: null })
  })

  it("matriculado mas sem telemetria: conclusão existe, percorrido é SEM DADO", async () => {
    const { chapters, slides } = cursoDe(6)
    const snapshot = await readStudentProgressSnapshot(
      stubSupabase({
        enrollments: [matricula({ percentage: 33 })],
        chapters,
        slides,
        viewProgress: [],
      }),
      ALUNO,
    )

    // O aluno percorreu ZERO módulos, mas ninguém MEDIU isso — a instrumentação
    // pode ser mais nova que o estudo dele. `null`, jamais `0`.
    expect(snapshot.percorridoPct).toBeNull()
    expect(snapshot.conclusaoPct).toBe(33)
    // Sem leitura afirmável não há denominador: a frase deixa de citar módulos
    // em vez de citar um total que não veio da mesma fonte.
    expect(snapshot.totalModules).toBeNull()
  })
})

describe("readStudentProgressSnapshot — fail-open, a home nunca cai por isto", () => {
  it("erro ao ler as matrículas devolve o snapshot vazio", async () => {
    const snapshot = await readStudentProgressSnapshot(
      stubSupabase({ enrollmentsError: { code: "42P01", message: "relation does not exist" } }),
      ALUNO,
    )

    expect(snapshot).toEqual({ percorridoPct: null, conclusaoPct: null, totalModules: null })
  })

  it("erro ao ler a telemetria mantém a conclusão e zera só o percorrido", async () => {
    const { chapters, slides } = cursoDe(5)
    const snapshot = await readStudentProgressSnapshot(
      stubSupabase({
        enrollments: [matricula({ percentage: 60 })],
        chapters,
        slides,
        viewProgressError: { code: "42P01", message: "relation does not exist" },
      }),
      ALUNO,
    )

    expect(snapshot.percorridoPct).toBeNull()
    expect(snapshot.conclusaoPct).toBe(60)
  })

  it("client que lança não propaga a exceção", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const explosivo = {
      from() {
        throw new Error("boom")
      },
      // biome-ignore lint/suspicious/noExplicitAny: duplo estrutural
    } as any

    await expect(readStudentProgressSnapshot(explosivo, ALUNO)).resolves.toEqual({
      percorridoPct: null,
      conclusaoPct: null,
      totalModules: null,
    })
    consoleError.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// `resolveAnnouncementStats()` — quem decide SE vale ler, e para qual artefato.
//
// MUDANÇA DE COMPORTAMENTO (Hugo, 2026-08-05): o modo demonstração
// (`?onboarding=percorrido`) mostrava um snapshot canned fixo (100%/50%).
// Passa a mostrar o progresso REAL de quem está logado. O que o modo demo
// preserva é o que sempre importou nele: não grava linha nenhuma e funciona com
// a migration de onboarding NÃO aplicada — o snapshot lê `enrollments`,
// `sessions`, `slide_reflections` e `chapter_view_progress`, que a home já lê,
// e NUNCA `product_announcements`/`product_announcement_views`.
//
// Por isso não existe mais um parâmetro `isPreview` aqui: o artefato vindo da
// demonstração e o artefato vindo do gate real percorrem o MESMO caminho. Um
// ramo de preview reintroduzido faria o primeiro teste abaixo falhar.
// ---------------------------------------------------------------------------

/** Um curso de 8 módulos com 3 percorridos e 25% declarado — dado REAL. */
function stubComDadoReal() {
  const { chapters, slides } = cursoDe(8)
  return stubSupabase({
    enrollments: [matricula({ percentage: 25 })],
    chapters,
    slides,
    viewProgress: percorreu(3),
  })
}

describe("resolveAnnouncementStats — o modo demonstração reflete dado REAL", () => {
  it("o artefato que a demonstração produz recebe os números do aluno logado", async () => {
    // `previewArtifactFor("percorrido")` é literalmente o que `?onboarding=`
    // devolve — não uma imitação dele.
    const artefatoDaDemo = previewArtifactFor("percorrido")
    expect(artefatoDaDemo?.featureKey).toBe(FEATURE_KEYS.percorrido)

    const stats = await resolveAnnouncementStats(stubComDadoReal(), ALUNO, artefatoDaDemo)

    expect(stats).toEqual({ percorridoPct: 38, conclusaoPct: 25, totalModules: 8 })
    // Os números do canned que morreu. Se voltarem, é ramo de preview de volta.
    expect(stats?.percorridoPct).not.toBe(100)
    expect(stats?.conclusaoPct).not.toBe(50)
  })

  it("sem dado, a demonstração degrada null-safe em vez de cair no canned", async () => {
    const stats = await resolveAnnouncementStats(
      stubSupabase({ enrollments: [] }),
      ALUNO,
      previewArtifactFor("percorrido"),
    )

    expect(stats).toEqual({ percorridoPct: null, conclusaoPct: null, totalModules: null })
  })

  it("o artefato do gate real segue o MESMO caminho da demonstração", async () => {
    const doGate: PendingArtifact = {
      featureKey: FEATURE_KEYS.percorrido,
      kind: "announcement",
      version: 1,
      priority: 10,
      helpUrl: "/ajuda/percorrido-vs-conclusao",
      lastStep: null,
    }

    const stats = await resolveAnnouncementStats(stubComDadoReal(), ALUNO, doGate)

    expect(stats).toEqual({ percorridoPct: 38, conclusaoPct: 25, totalModules: 8 })
  })
})

describe("resolveAnnouncementStats — não lê o banco quando não há o que dizer", () => {
  it("sem artefato pendente, devolve null sem consultar nada", async () => {
    const explosivo = {
      from() {
        throw new Error("não deveria consultar o banco")
      },
      // biome-ignore lint/suspicious/noExplicitAny: duplo estrutural
    } as any

    await expect(resolveAnnouncementStats(explosivo, ALUNO, null)).resolves.toBeNull()
  })

  it("a novidade 2 (jornada) não tem número de pessoa nenhuma — não consulta nada", async () => {
    const explosivo = {
      from() {
        throw new Error("não deveria consultar o banco")
      },
      // biome-ignore lint/suspicious/noExplicitAny: duplo estrutural
    } as any

    const jornada = previewArtifactFor("jornada")
    await expect(resolveAnnouncementStats(explosivo, ALUNO, jornada)).resolves.toBeNull()
  })
})
