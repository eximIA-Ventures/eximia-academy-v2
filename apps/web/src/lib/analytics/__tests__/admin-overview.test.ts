import { beforeEach, describe, expect, it } from "vitest"
import {
  ADMIN_OVERVIEW_RECENT_DAYS,
  ADMIN_OVERVIEW_WINDOW_DAYS,
  UNASSIGNED_GROUP_ID,
  loadAdminOverview,
} from "../admin-overview"
import { __resetOrgReferenceCache } from "../org-reference-cache"

// ---------------------------------------------------------------------------
// Fake Supabase client — mesmo desenho do harness de `org-reference-cache.test`
// (encadeável, thenable, com `.range()` para a paginação), acrescido de UMA
// capacidade que aqui é o ponto: declarar uma tabela como ILEGÍVEL. Sem isso
// não haveria como provar que "não consegui ler certificados" é diferente de
// "zero certificados emitidos".
// ---------------------------------------------------------------------------

// biome-ignore lint/suspicious/noExplicitAny: linhas frouxas do harness
type Row = Record<string, any>

function makeDb(data: Record<string, Row[]>, unreadable: string[] = []) {
  const db = {
    from(table: string) {
      const eqs: [string, unknown][] = []
      const neqs: [string, unknown][] = []
      const ins: [string, unknown[]][] = []
      const rowsFor = (): Row[] => {
        let rows = data[table] ?? []
        for (const [c, v] of eqs) rows = rows.filter((r) => r[c] === undefined || r[c] === v)
        for (const [c, v] of neqs) rows = rows.filter((r) => r[c] === undefined || r[c] !== v)
        for (const [c, vs] of ins)
          rows = rows.filter((r) => r[c] === undefined || vs.includes(r[c]))
        return rows
      }
      const fail = unreadable.includes(table)
      const builder: Record<string, unknown> = {
        select: () => builder,
        order: () => builder,
        limit: () => builder,
        eq: (c: string, v: unknown) => {
          eqs.push([c, v])
          return builder
        },
        neq: (c: string, v: unknown) => {
          neqs.push([c, v])
          return builder
        },
        in: (c: string, vs: unknown[]) => {
          ins.push([c, vs])
          return builder
        },
        range: (offset: number) =>
          fail
            ? Promise.resolve({ data: null, error: { message: `relation ${table} unavailable` } })
            : Promise.resolve({ data: offset === 0 ? rowsFor() : [], error: null }),
        // biome-ignore lint/suspicious/noThenProperty: thenable proposital do mock
        then: (resolve: (v: { data: Row[] | null; error: unknown }) => unknown) =>
          Promise.resolve(
            fail
              ? { data: null, error: { message: `relation ${table} unavailable` } }
              : { data: rowsFor(), error: null },
          ).then(resolve),
      }
      return builder
    },
  }
  // biome-ignore lint/suspicious/noExplicitAny: cliente falso do teste
  return db as any
}

const NOW = Date.parse("2026-06-01T00:00:00Z")
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString()

/**
 * Empresa `t1`:
 *  - Alfa: 3 pessoas, 1 concluinte  → conversão 33,3%
 *  - Beta: 3 pessoas, 0 concluinte  → conversão 0%
 *  - 1 pessoa sem unidade           → a linha sintética que fecha a soma
 * Alfabeticamente Alfa viria primeiro; pela PIOR CONVERSÃO, Beta vem primeiro.
 */
function fixture(): Record<string, Row[]> {
  const students = ["u1", "u2", "u3", "u4", "u5", "u6", "u7"]
  return {
    users: students.map((id) => ({
      id,
      tenant_id: "t1",
      role: "student",
      status: "active",
      last_seen_at: daysAgo(2),
    })),
    areas: [
      { id: "a-alfa", tenant_id: "t1", name: "Alfa" },
      { id: "a-beta", tenant_id: "t1", name: "Beta" },
    ],
    user_areas: [
      { user_id: "u1", area_id: "a-alfa", created_at: daysAgo(100) },
      { user_id: "u2", area_id: "a-alfa", created_at: daysAgo(100) },
      { user_id: "u3", area_id: "a-alfa", created_at: daysAgo(100) },
      { user_id: "u4", area_id: "a-beta", created_at: daysAgo(100) },
      { user_id: "u5", area_id: "a-beta", created_at: daysAgo(100) },
      { user_id: "u6", area_id: "a-beta", created_at: daysAgo(100) },
    ],
    departments: [{ id: "d-eng", tenant_id: "t1", name: "Engenharia" }],
    user_departments: [
      { user_id: "u1", department_id: "d-eng", tenant_id: "t1", created_at: daysAgo(50) },
    ],
    certificates: [{ tenant_id: "t1", user_id: "u1", course_id: "c1", issued_at: daysAgo(5) }],
    courses: [
      { id: "c1", tenant_id: "t1", title: "Curso Vivo", status: "published", deadline_days: null },
      {
        id: "c2",
        tenant_id: "t1",
        title: "Curso Parado",
        status: "published",
        deadline_days: null,
      },
      { id: "c3", tenant_id: "t1", title: "Rascunho", status: "draft", deadline_days: null },
    ],
    chapters: [
      { id: "ch1", tenant_id: "t1", course_id: "c1", order: 1 },
      { id: "ch2", tenant_id: "t1", course_id: "c2", order: 1 },
    ],
    sessions: [
      {
        student_id: "u1",
        tenant_id: "t1",
        status: "completed",
        chapter_id: "ch1",
        created_at: daysAgo(3),
        updated_at: daysAgo(3),
      },
      {
        student_id: "u2",
        tenant_id: "t1",
        status: "completed",
        chapter_id: "ch1",
        created_at: daysAgo(20),
        updated_at: daysAgo(20),
      },
      {
        student_id: "u4",
        tenant_id: "t1",
        status: "completed",
        chapter_id: "ch1",
        created_at: daysAgo(45),
        updated_at: daysAgo(45),
      },
    ],
    slide_reflections: [
      { student_id: "u1", tenant_id: "t1", slide_id: "s1", created_at: daysAgo(3) },
    ],
    enrollments: [
      {
        student_id: "u1",
        tenant_id: "t1",
        status: "active",
        created_at: daysAgo(40),
        progress: { percentage: 50 },
        course_id: "c1",
      },
      {
        student_id: "u2",
        tenant_id: "t1",
        status: "completed",
        created_at: daysAgo(40),
        progress: { percentage: 100 },
        course_id: "c1",
      },
      {
        student_id: "u4",
        tenant_id: "t1",
        status: "active",
        created_at: daysAgo(40),
        progress: { percentage: 10 },
        course_id: "c1",
      },
    ],
  }
}

beforeEach(() => {
  __resetOrgReferenceCache()
})

describe("loadAdminOverview — seção 2 (adoção)", () => {
  it("ordena por PIOR conversão primeiro, nunca alfabeticamente", async () => {
    const overview = await loadAdminOverview(makeDb(fixture()), "t1", { now: NOW })

    const names = overview.adoption.rows.map((r) => r.name)
    expect(names[0]).toBe("Beta")
    expect(names.indexOf("Beta")).toBeLessThan(names.indexOf("Alfa"))

    const beta = overview.adoption.rows.find((r) => r.name === "Beta")
    const alfa = overview.adoption.rows.find((r) => r.name === "Alfa")
    expect(beta?.conversionRate).toBe(0)
    expect(alfa?.conversionRate).toBeCloseTo(1 / 3, 5)
  })

  it("a soma das linhas fecha com o total de pessoas da empresa", async () => {
    const overview = await loadAdminOverview(makeDb(fixture()), "t1", { now: NOW })

    const somaLinhas = overview.adoption.rows.reduce((acc, r) => acc + r.invited, 0)
    expect(somaLinhas).toBe(overview.totals.people)
    expect(overview.adoption.totals.invited).toBe(overview.totals.people)
    // Quem não está em nenhuma unidade existe como linha própria — é o que
    // torna a soma fechável em vez de silenciosamente menor que o total.
    expect(overview.adoption.rows.map((r) => r.id)).toContain(UNASSIGNED_GROUP_ID)
  })

  it("cada pessoa entra em UMA linha só, mesmo pertencendo a duas unidades", async () => {
    const data = fixture()
    // u1 passa a pertencer também a Beta, com filiação mais NOVA.
    data.user_areas.push({ user_id: "u1", area_id: "a-beta", created_at: daysAgo(10) })

    const overview = await loadAdminOverview(makeDb(data), "t1", { now: NOW })

    expect(overview.adoption.rows.reduce((acc, r) => acc + r.invited, 0)).toBe(
      overview.totals.people,
    )
    // A filiação MAIS ANTIGA (Alfa) é a que conta.
    expect(overview.adoption.rows.find((r) => r.name === "Alfa")?.invited).toBe(3)
    expect(overview.adoption.rows.find((r) => r.name === "Beta")?.invited).toBe(3)
  })

  it("convite pendente não conta como ativado (o funil separa os dois estágios)", async () => {
    const overview = await loadAdminOverview(makeDb(fixture()), "t1", {
      now: NOW,
      inviteFacts: async () => ({
        u3: { invited_at: daysAgo(1), confirmed_at: null },
        u6: { invited_at: daysAgo(1), confirmed_at: null },
      }),
    })

    expect(overview.adoption.totals.invited).toBe(7)
    expect(overview.adoption.totals.activated).toBe(5)
    expect(overview.adoption.rows.find((r) => r.name === "Alfa")?.activated).toBe(2)
  })

  it("o eixo Departamento é um recorte diferente do mesmo universo", async () => {
    const overview = await loadAdminOverview(makeDb(fixture()), "t1", {
      now: NOW,
      axis: "department",
    })

    expect(overview.adoption.axis).toBe("department")
    expect(overview.adoption.rows.map((r) => r.name)).toContain("Engenharia")
    // A soma continua fechando: quem não tem área funcional cai na linha "Sem área".
    expect(overview.adoption.rows.reduce((acc, r) => acc + r.invited, 0)).toBe(
      overview.totals.people,
    )
  })

  it("certificados ilegíveis viram '—' (null), nunca zero — e a ordem continua total", async () => {
    const data = fixture()
    // Beta inteira sem sinal recente: sem conversão apurável, é a taxa de
    // ativos que passa a mandar na ordem.
    for (const u of data.users) {
      if (["u4", "u5", "u6"].includes(u.id)) u.last_seen_at = daysAgo(120)
    }
    const overview = await loadAdminOverview(makeDb(data, ["certificates"]), "t1", {
      now: NOW,
    })

    expect(overview.totals.certificatesTotal).toBeNull()
    expect(overview.totals.certificatesInWindow).toBeNull()
    for (const row of overview.adoption.rows) {
      expect(row.completers).toBeNull()
      expect(row.conversionRate).toBeNull()
    }
    // Sem conversão apurável, o desempate cai na taxa de ativos: Beta (1 ativo
    // fora da janela, 0 na janela) fica antes de Alfa (2 ativos).
    expect(overview.adoption.rows[0]?.name).toBe("Beta")
  })
})

describe("loadAdminOverview — seção 3 (saúde de engajamento)", () => {
  it("toda métrica expõe período, comparação e fórmula", async () => {
    const overview = await loadAdminOverview(makeDb(fixture()), "t1", { now: NOW })

    expect(overview.engagement.activeMetrics).toHaveLength(2)
    for (const metric of overview.engagement.activeMetrics) {
      expect(metric.periodLabel).toMatch(/dias/)
      expect(metric.comparisonLabel).toMatch(/anteriores/)
      expect(metric.formula.length).toBeGreaterThan(10)
      expect(metric.delta).toBe(metric.current - metric.previous)
    }
    expect(overview.engagement.recentDays).toBe(ADMIN_OVERVIEW_RECENT_DAYS)
    expect(overview.engagement.windowDays).toBe(ADMIN_OVERVIEW_WINDOW_DAYS)
  })

  it("não existe índice composto: só contagens com denominador visível", async () => {
    const overview = await loadAdminOverview(makeDb(fixture()), "t1", { now: NOW })

    const chaves = Object.keys(overview.engagement)
    for (const proibida of ["score", "index", "health", "indice"]) {
      expect(chaves.some((k) => k.toLowerCase().includes(proibida))).toBe(false)
    }
    // A retenção nunca é uma taxa solta: cada ponto carrega o próprio par
    // retidos/coorte, de onde a porcentagem sai.
    for (const point of overview.engagement.retention) {
      expect(point).toHaveProperty("cohort")
      expect(point).toHaveProperty("retained")
      if (point.cohort === 0) expect(point.rate).toBeNull()
      else expect(point.rate).toBeCloseTo(point.retained / point.cohort, 6)
    }
  })

  it("compara a janela corrente contra a imediatamente anterior", async () => {
    const overview = await loadAdminOverview(makeDb(fixture()), "t1", { now: NOW })

    const trintaDias = overview.engagement.activeMetrics.find((m) => m.key === "active-30d")
    // u1, u2 e todos com last_seen_at recente entram na janela; u4 só tem sinal
    // de 45 dias atrás, então ele é do período ANTERIOR, não do corrente.
    expect(trintaDias?.current).toBeGreaterThan(0)
    expect(trintaDias?.previous).toBeGreaterThanOrEqual(1)
  })

  it("lista curso publicado sem tração e ignora rascunho", async () => {
    const overview = await loadAdminOverview(makeDb(fixture()), "t1", { now: NOW })

    const titulos = overview.engagement.coursesWithoutTraction.map((c) => c.title)
    expect(titulos).toContain("Curso Parado")
    expect(titulos).not.toContain("Rascunho")
    expect(titulos).not.toContain("Curso Vivo")
  })
})

describe("loadAdminOverview — empresa sem dado nenhum", () => {
  it("degrada para zero e nulo, sem lançar erro", async () => {
    const overview = await loadAdminOverview(makeDb({}), "vazio", { now: NOW })

    expect(overview.totals.people).toBe(0)
    expect(overview.totals.activeStudents).toBe(0)
    expect(overview.totals.sessionsInWindow).toBe(0)
    expect(overview.totals.publishedCourses).toBe(0)
    expect(overview.adoption.available).toBe(false)
    expect(overview.adoption.rows).toEqual([])
    expect(overview.adoption.totals.invited).toBe(0)
    expect(overview.engagement.coursesWithoutTraction).toEqual([])
    for (const point of overview.engagement.retention) {
      expect(point.cohort).toBe(0)
      expect(point.rate).toBeNull()
    }
    for (const metric of overview.engagement.activeMetrics) {
      expect(metric.current).toBe(0)
      expect(metric.previous).toBe(0)
      // Sem base anterior, a variação relativa é "não aplicável", nunca 0%.
      expect(metric.deltaPct).toBeNull()
    }
  })
})
