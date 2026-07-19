import type { EnrollmentRow } from "@/lib/notifications/engagement-triage"
import { describe, expect, it } from "vitest"
import {
  type HomeReflectionRow,
  type HomeSessionRow,
  buildStudentHomeIndicators,
  computeEngagementMax,
  computeOrgTrailMaxAverages,
  countReflectionPossibleSlides,
  engagementRankOf,
  isTopEngagementRank,
  trailChapterIdsOf,
} from "../student-home-indicators"

const NOW = Date.parse("2026-06-01T00:00:00Z")
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString()

function session(studentId: string, createdAt: string, status = "completed"): HomeSessionRow {
  return { student_id: studentId, status, created_at: createdAt }
}
function enrollment(over: Partial<EnrollmentRow> & { student_id: string }): EnrollmentRow {
  return {
    student_id: over.student_id,
    status: over.status ?? "active",
    created_at: over.created_at ?? daysAgo(10),
    progress: over.progress ?? { percentage: 0 },
    course_id: over.course_id ?? "c1",
  }
}

// s1 (Você): accessed 1 day ago, 2 completed sessions, 3 reflections, progress 80.
// s2: accessed 5 days ago, 1 completed session, 1 reflection, progress 40.
// s3: NEVER accessed (no session), no enrollment.
const ORG = ["s1", "s2", "s3"]
const SESSIONS: HomeSessionRow[] = [
  session("s1", daysAgo(1)),
  session("s1", daysAgo(3)),
  session("s2", daysAgo(5)),
]
const REFLECTIONS: HomeReflectionRow[] = [
  { student_id: "s1" },
  { student_id: "s1" },
  { student_id: "s1" },
  { student_id: "s2" },
]
const ENROLLMENTS: EnrollmentRow[] = [
  enrollment({ student_id: "s1", progress: { percentage: 80 }, course_id: "c1" }),
  enrollment({ student_id: "s2", progress: { percentage: 40 }, course_id: "c1" }),
]
// No deadline (deadline_days null) → nobody is "behind" → ritmo "no_ritmo" for
// students with activity; s3 (no sessions, no progress) → "nao_iniciado".
const DEADLINES = new Map<string, number | null>([["c1", null]])

describe("buildStudentHomeIndicators — 4 indicadores operacionais org-wide", () => {
  const result = buildStudentHomeIndicators(
    "s1",
    ORG,
    SESSIONS,
    REFLECTIONS,
    ENROLLMENTS,
    DEADLINES,
    NOW,
  )

  it("Você (s1): último acesso 1 dia, engajamento = 2*2+3 = 7, progresso 80, ritmo no_ritmo", () => {
    expect(result?.subject.lastAccessDays).toBe(1)
    expect(result?.subject.engagement).toBe(7) // 2 completed *2 + 3 reflections
    expect(result?.subject.progressPct).toBe(80)
    expect(result?.subject.ritmoDisplay).toBe("no_ritmo")
    // FRENTE 2 — the engagement breakdown behind the score.
    expect(result?.subject.interactions).toBe(2)
    expect(result?.subject.reflections).toBe(3)
  })

  it("FRENTE 2 — breakdown médio da org: interações méd. (2+1+0)/3=1, reflexões méd. (3+1+0)/3=1", () => {
    expect(result?.reference.interactionsAvg).toBe(1)
    expect(result?.reference.reflectionsAvg).toBe(1)
  })

  it("D1 — recência média SÓ de quem acessou (s3 nunca acessou fica FORA): (1+5)/2 = 3", () => {
    // s1 last access 1d, s2 5d, s3 excluded → mean = 3.
    expect(result?.reference.lastAccessAvgDays).toBe(3)
  })

  it("D2 — '% em dia' = (no_ritmo + concluído) / TOTAL (3): s1+s2 no_ritmo, s3 nao_iniciado → 2/3 = 67%", () => {
    expect(result?.reference.ritmoEmDiaPct).toBe(67)
  })

  it("D3 — progresso médio baseado em curso sobre TODOS (3): (80+40+0)/3 = 40", () => {
    expect(result?.reference.progressAvgPct).toBe(40)
  })

  it("engajamento médio sobre TODOS (3): s1=7, s2=2*1+1=3, s3=0 → (7+3+0)/3 = 3", () => {
    expect(result?.reference.engagementAvg).toBe(3)
  })

  it("org vazia → null", () => {
    expect(buildStudentHomeIndicators("x", [], [], [], [], new Map(), NOW)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// FRENTE 2, achado da Lupa — a IDENTIDADE da manchete tem que fechar na linha da
// MÉDIA: engagementAvg exibido === 2*interactionsAvg + reflectionsAvg. Dataset
// DIVERGENTE (o repro da Lupa) em que arredondar as 3 médias independentemente
// daria número inconsistente com a sublinha. Trava a escolha (a) contra refactor.
// ---------------------------------------------------------------------------

describe("engagementAvg fecha com a sublinha (identidade da manchete)", () => {
  it("interações [1,1,2] · reflexões [1,1,2] → avgs 1/1 → engajamento médio 3 (=2*1+1), NÃO 4", () => {
    // 3 alunos, todos com acesso. interações = sessões concluídas.
    const org = ["a", "b", "c"]
    const sessions: HomeSessionRow[] = [
      session("a", daysAgo(1)),
      session("b", daysAgo(1)),
      session("c", daysAgo(1)),
      session("c", daysAgo(2)),
    ]
    const reflections: HomeReflectionRow[] = [
      { student_id: "a" },
      { student_id: "b" },
      { student_id: "c" },
      { student_id: "c" },
    ]
    const res = buildStudentHomeIndicators("a", org, sessions, reflections, [], new Map(), NOW)
    const ref = res?.reference
    // Arredondar independente daria round((2*4+4)/3)=round(4)=4; a identidade força 3.
    expect(ref?.interactionsAvg).toBe(1)
    expect(ref?.reflectionsAvg).toBe(1)
    expect(ref?.engagementAvg).toBe(3)
    // A INVARIANTE que a manchete precisa: número = 2*interações + reflexões.
    expect(ref?.engagementAvg).toBe(2 * (ref?.interactionsAvg ?? 0) + (ref?.reflectionsAvg ?? 0))
  })
})

// ---------------------------------------------------------------------------
// SH-F.5 — engagementMax N (teto da trilha do Você). AC8 (N correto) + AC3
// (buildStudentHomeIndicators expõe engagementMax, numerador intocado).
// ---------------------------------------------------------------------------

describe("SH-F.5 — trilha do aluno e teto N", () => {
  it("trailChapterIdsOf: capítulos dos cursos matriculados (active/completed) não-arquivados", () => {
    const enrollments = [
      { student_id: "s1", status: "active", course_id: "c1" },
      { student_id: "s1", status: "completed", course_id: "c2" },
      { student_id: "s1", status: "active", course_id: "cArq" }, // curso arquivado → fora
      { student_id: "s1", status: "cancelled", course_id: "c1" }, // status fora
      { student_id: "s2", status: "active", course_id: "c1" }, // outro aluno
    ]
    const chapters = [
      { id: "ch1", course_id: "c1" },
      { id: "ch2", course_id: "c1" },
      { id: "ch3", course_id: "c2" },
      { id: "chArq", course_id: "cArq" },
      { id: "chOutro", course_id: "c9" },
    ]
    const active = new Set(["c1", "c2"]) // cArq NÃO está entre os ativos
    expect(trailChapterIdsOf("s1", enrollments, chapters, active).sort()).toEqual([
      "ch1",
      "ch2",
      "ch3",
    ])
  })

  it("countReflectionPossibleSlides: conta slides com >=1 prompt (max 1 por slide)", () => {
    const slides = [
      { text_content: "> Reflexão: o que você aprendeu?" },
      { text_content: "> Agora reflita por um momento sobre o caso" },
      { text_content: "conteúdo normal sem prompt" },
      { text_content: null },
    ]
    expect(countReflectionPossibleSlides(slides)).toBe(2)
  })

  it("AC8: engagementMax = capítulosTrilha*2 + slides-reflexão (3 cap + 4 slides → 10)", () => {
    expect(computeEngagementMax(3, 4)).toBe(10)
    expect(computeEngagementMax(0, 0)).toBe(0)
  })

  it("AC3: buildStudentHomeIndicators expõe engagementMax; numerador (engagement) intocado", () => {
    const res = buildStudentHomeIndicators(
      "s1",
      ORG,
      SESSIONS,
      REFLECTIONS,
      ENROLLMENTS,
      DEADLINES,
      NOW,
      10,
    )
    expect(res?.subject.engagementMax).toBe(10)
    expect(res?.subject.engagement).toBe(7) // 2*2 + 3, inalterado
  })

  it("AC3: sem engagementMax → subject.engagementMax undefined (degradação)", () => {
    const res = buildStudentHomeIndicators(
      "s1",
      ORG,
      SESSIONS,
      REFLECTIONS,
      ENROLLMENTS,
      DEADLINES,
      NOW,
    )
    expect(res?.subject.engagementMax).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// SH-1.5 — per-row fraction denominators (interactionsMax/reflectionsMax) e o
// RANK real de engajamento (isTopEngagement, AC7/AC12). O param perRowMax é
// APPENDED no fim da assinatura (após lastSeenByStudent): as chamadas legadas
// posicionais seguem intactas.
// ---------------------------------------------------------------------------

describe("isTopEngagementRank — #1 estrito (AC12, sem empate)", () => {
  it("estritamente maior que todos os outros → true", () => {
    expect(isTopEngagementRank(30, [10, 20, 25])).toBe(true)
  })
  it("empate no topo (outro igual ao maior) → false (AC12)", () => {
    expect(isTopEngagementRank(30, [30, 10])).toBe(false)
  })
  it("existe outro maior → false", () => {
    expect(isTopEngagementRank(20, [30, 10])).toBe(false)
  })
  it("sem outros alunos (org de 1) → true (é o único, logo o #1)", () => {
    expect(isTopEngagementRank(5, [])).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// SH-1.5 Round 2 (Hugo 2026-07-18) — engagementRankOf: ranking de competição
// padrão (empate COMPARTILHA a posição), distinto do isTopEngagementRank (gate
// estrito da copy "1º da turma"). Só números do PRÓPRIO aluno cruzam a fronteira.
// ---------------------------------------------------------------------------

describe("engagementRankOf — ranking de competição padrão (empate compartilha posição)", () => {
  it("ranking simples: 2 outros com score maior → 3º de 4", () => {
    expect(engagementRankOf(10, [30, 20, 5])).toEqual({ rank: 3, total: 4 })
  })
  it("o maior de todos → 1º", () => {
    expect(engagementRankOf(30, [10, 20, 25])).toEqual({ rank: 1, total: 4 })
  })
  it("empate COMPARTILHA a posição: dois alunos no topo → ambos 1º (nunca 1 e 2)", () => {
    // O sujeito empata com um peer no topo. rank = 1 + (quantos são ESTRITAMENTE
    // maiores) = 1 + 0 = 1; o empate NÃO empurra o sujeito para 2º.
    expect(engagementRankOf(30, [30, 10])).toEqual({ rank: 1, total: 3 })
  })
  it("empate no meio: 1 estritamente maior, 1 igual → 2º (o igual não conta como acima)", () => {
    expect(engagementRankOf(20, [30, 20, 10])).toEqual({ rank: 2, total: 4 })
  })
  it("aluno sozinho na org (sem outros) → 1º de 1", () => {
    expect(engagementRankOf(5, [])).toEqual({ rank: 1, total: 1 })
    // Mesmo com score 0 e nenhum peer, é o único → 1º de 1.
    expect(engagementRankOf(0, [])).toEqual({ rank: 1, total: 1 })
  })
})

// ---------------------------------------------------------------------------
// SH-1.5 Round 2 — computeOrgTrailMaxAverages: os denominadores da fração da
// TURMA (média dos tetos por aluno da org). PURO, sem N+1 (o caller pré-carrega
// os slides-com-reflexão POR CAPÍTULO uma vez).
// ---------------------------------------------------------------------------

describe("computeOrgTrailMaxAverages — média dos tetos de trilha da org (Turma)", () => {
  // 2 alunos com trilhas de TAMANHOS DIFERENTES: a1 (c1: ch1,ch2) tem 2 capítulos;
  // a2 (c2: ch3) tem 1. Reflexão-possível: ch1→2 slides, ch2→0, ch3→1.
  const enrollments = [
    { student_id: "a1", status: "active", course_id: "c1" },
    { student_id: "a2", status: "completed", course_id: "c2" },
  ]
  const chapters = [
    { id: "ch1", course_id: "c1" },
    { id: "ch2", course_id: "c1" },
    { id: "ch3", course_id: "c2" },
  ]
  const active = new Set(["c1", "c2"])
  const reflectionByChapter = new Map<string, number>([
    ["ch1", 2],
    ["ch3", 1],
    // ch2 ausente = 0 slides com reflexão
  ])

  it("interações: a1=2 cap, a2=1 cap → média round((2+1)/2)=round(1.5)=2", () => {
    const res = computeOrgTrailMaxAverages(
      ["a1", "a2"],
      enrollments,
      chapters,
      active,
      reflectionByChapter,
    )
    expect(res.interactionsMaxAvg).toBe(2)
  })

  it("reflexões: a1=(2+0)=2, a2=1 → média round((2+1)/2)=round(1.5)=2", () => {
    const res = computeOrgTrailMaxAverages(
      ["a1", "a2"],
      enrollments,
      chapters,
      active,
      reflectionByChapter,
    )
    expect(res.reflectionsMaxAvg).toBe(2)
  })

  it("engajamento: computeEngagementMax das 2 médias = 2*2 + 2 = 6", () => {
    const res = computeOrgTrailMaxAverages(
      ["a1", "a2"],
      enrollments,
      chapters,
      active,
      reflectionByChapter,
    )
    expect(res.engagementMaxAvg).toBe(computeEngagementMax(2, 2))
    expect(res.engagementMaxAvg).toBe(6)
  })

  it("aluno com trilha VAZIA conta 0 (denominador = tamanho da org, média honesta)", () => {
    // a3 não tem matrícula → teto 0. Média sobre 3: interações round((2+1+0)/3)=1.
    const res = computeOrgTrailMaxAverages(
      ["a1", "a2", "a3"],
      enrollments,
      chapters,
      active,
      reflectionByChapter,
    )
    expect(res.interactionsMaxAvg).toBe(1) // round((2+1+0)/3)=round(1)=1
    expect(res.reflectionsMaxAvg).toBe(1) // round((2+1+0)/3)=round(1)=1
  })

  it("org vazia → todos 0 (sem divisão por zero)", () => {
    const res = computeOrgTrailMaxAverages([], enrollments, chapters, active, reflectionByChapter)
    expect(res).toEqual({ interactionsMaxAvg: 0, reflectionsMaxAvg: 0, engagementMaxAvg: 0 })
  })
})

describe("SH-1.5 — propagação de perRowMax e rank real no subject", () => {
  it("perRowMax → subject.interactionsMax/reflectionsMax expostos; ausente → undefined", () => {
    const withMax = buildStudentHomeIndicators(
      "s1",
      ORG,
      SESSIONS,
      REFLECTIONS,
      ENROLLMENTS,
      DEADLINES,
      NOW,
      undefined,
      undefined,
      undefined,
      { interactionsMax: 10, reflectionsMax: 50 },
    )
    expect(withMax?.subject.interactionsMax).toBe(10)
    expect(withMax?.subject.reflectionsMax).toBe(50)

    const noMax = buildStudentHomeIndicators(
      "s1",
      ORG,
      SESSIONS,
      REFLECTIONS,
      ENROLLMENTS,
      DEADLINES,
      NOW,
    )
    expect(noMax?.subject.interactionsMax).toBeUndefined()
    expect(noMax?.subject.reflectionsMax).toBeUndefined()
  })

  it("AC7 — rank real #1: s1 tem o MAIOR engajamento da org → isTopEngagement true", () => {
    // s1: 2 completed*2 + 3 refl = 7; s2: 1*2 + 1 = 3; s3: 0. s1 é o #1 estrito.
    const res = buildStudentHomeIndicators(
      "s1",
      ORG,
      SESSIONS,
      REFLECTIONS,
      ENROLLMENTS,
      DEADLINES,
      NOW,
    )
    expect(res?.subject.engagement).toBe(7)
    expect(res?.subject.isTopEngagement).toBe(true)
  })

  it("Round 2 — subject expõe engagementRank/engagementTotalStudents (posição de exibição)", () => {
    // s1 é o maior (7 > s2=3 > s3=0) numa org de 3 → 1º de 3.
    const res = buildStudentHomeIndicators(
      "s1",
      ORG,
      SESSIONS,
      REFLECTIONS,
      ENROLLMENTS,
      DEADLINES,
      NOW,
    )
    expect(res?.subject.engagementRank).toBe(1)
    expect(res?.subject.engagementTotalStudents).toBe(3)

    // s2 (engajamento 3) está atrás de s1 (7) e à frente de s3 (0) → 2º de 3.
    const resS2 = buildStudentHomeIndicators(
      "s2",
      ORG,
      SESSIONS,
      REFLECTIONS,
      ENROLLMENTS,
      DEADLINES,
      NOW,
    )
    expect(resS2?.subject.engagementRank).toBe(2)
    expect(resS2?.subject.engagementTotalStudents).toBe(3)
  })

  it("Round 2 — empate no topo: rank compartilha posição (2 alunos 1º), mas nenhum é isTopEngagement", () => {
    // a e b empatam no topo (ambos 3), c menor (0). Rank de a e b = 1º; isTop = false.
    const org = ["a", "b", "c"]
    const sessions: HomeSessionRow[] = [
      session("a", daysAgo(1)),
      session("b", daysAgo(1)),
      session("c", daysAgo(1)),
    ]
    const reflections: HomeReflectionRow[] = [{ student_id: "a" }, { student_id: "b" }]
    const resA = buildStudentHomeIndicators("a", org, sessions, reflections, [], DEADLINES, NOW)
    expect(resA?.subject.engagementRank).toBe(1) // empate compartilha o 1º
    expect(resA?.subject.engagementTotalStudents).toBe(3)
    expect(resA?.subject.isTopEngagement).toBe(false) // mas não é #1 EXCLUSIVO (gate da copy)
  })

  it("AC7 — NÃO #1: s2 tem engajamento abaixo de s1 → isTopEngagement false", () => {
    const res = buildStudentHomeIndicators(
      "s2",
      ORG,
      SESSIONS,
      REFLECTIONS,
      ENROLLMENTS,
      DEADLINES,
      NOW,
    )
    // s2 engajamento 3 < s1 7 → não é o #1 (mesmo que possa vencer a média).
    expect(res?.subject.isTopEngagement).toBe(false)
  })

  it("AC12 — empate no topo (2 alunos com o maior engajamento) → nenhum é #1", () => {
    // a e b empatam no topo (ambos 1 completed*2 + 1 refl = 3); c menor.
    const org = ["a", "b", "c"]
    const sessions: HomeSessionRow[] = [
      session("a", daysAgo(1)),
      session("b", daysAgo(1)),
      session("c", daysAgo(1)),
    ]
    const reflections: HomeReflectionRow[] = [{ student_id: "a" }, { student_id: "b" }]
    const resA = buildStudentHomeIndicators("a", org, sessions, reflections, [], DEADLINES, NOW)
    const resB = buildStudentHomeIndicators("b", org, sessions, reflections, [], DEADLINES, NOW)
    // a e b têm o MESMO topo → nenhum vira #1 exclusivo.
    expect(resA?.subject.engagement).toBe(resB?.subject.engagement)
    expect(resA?.subject.isTopEngagement).toBe(false)
    expect(resB?.subject.isTopEngagement).toBe(false)
  })

  it("AC7 — subject multi-hat (fora de orgStudentIds) com maior engajamento → #1", () => {
    // "rin" não está na org, mas seu engajamento (2*3+3=9) supera s1/s2.
    const res = buildStudentHomeIndicators(
      "rin",
      ["s1", "s2"],
      [
        session("rin", daysAgo(1)),
        session("rin", daysAgo(2)),
        session("rin", daysAgo(3)),
        session("s1", daysAgo(1)),
        session("s2", daysAgo(2)),
      ],
      [{ student_id: "rin" }, { student_id: "rin" }, { student_id: "rin" }],
      [],
      DEADLINES,
      NOW,
    )
    expect(res?.subject.engagement).toBe(9)
    expect(res?.subject.isTopEngagement).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// BUG-1 (produção, Rinaldo) — o SUBJECT (Você) NÃO pode depender de estar na
// população da org. `orgStudentIds` = users role='student' do tenant. Um caller
// multi-chapéu (leader/manager/instructor) que estuda tem sessões/reflexões com
// student_id = auth.uid() (RLS garante), mas NÃO está em orgStudentIds. A rota
// (canAccessView) autoriza view=student p/ QUALQUER role ("multi-hat user reads
// their OWN data"), e o contrato diz que o escopo é student_id === auth.uid().
// As linhas de sessão/reflexão passadas ao builder são o scan ORG-WIDE (tenant
// only, SEM filtro de role — loadOrgReference), então as linhas do subject ESTÃO
// presentes; só eram descartadas pelo guard `org.has(subjectId)`. Este teste
// falha ANTES do fix (subject zerado) e passa DEPOIS.
// ---------------------------------------------------------------------------

describe("BUG-1 — subject fora da população da org NÃO deve zerar (multi-hat / self-view)", () => {
  // "rin" é o subject (Você) com atividade real, mas NÃO está em ORG (role != student).
  const orgSemSubject = ["s1", "s2"]
  const sessionsComSubject: HomeSessionRow[] = [
    session("rin", daysAgo(1)),
    session("rin", daysAgo(2)),
    session("rin", daysAgo(4)),
    session("s1", daysAgo(3)),
    session("s2", daysAgo(6)),
  ]
  const reflectionsComSubject: HomeReflectionRow[] = [
    { student_id: "rin" },
    { student_id: "rin" },
    { student_id: "rin" },
    { student_id: "s1" },
  ]
  const enrollmentsComSubject: EnrollmentRow[] = [
    enrollment({ student_id: "rin", progress: { percentage: 55 }, course_id: "c1" }),
    enrollment({ student_id: "s1", progress: { percentage: 40 }, course_id: "c1" }),
  ]

  const res = buildStudentHomeIndicators(
    "rin",
    orgSemSubject,
    sessionsComSubject,
    reflectionsComSubject,
    enrollmentsComSubject,
    DEADLINES,
    NOW,
    57, // N da trilha (SH-F.5) — computado por enrollment, sem filtro de role.
  )

  it("Você (rin): interações e reflexões refletem os PRÓPRIOS dados, não zero", () => {
    // 3 sessões completed → 3 interações; 3 reflexões. NÃO 0/0.
    expect(res?.subject.interactions).toBe(3)
    expect(res?.subject.reflections).toBe(3)
    // engajamento = 2*3 + 3 = 9 de 57 (não "0 de 57").
    expect(res?.subject.engagement).toBe(9)
    expect(res?.subject.engagementMax).toBe(57)
  })

  it("Você (rin): último acesso e progresso reais, não 'nunca'/0%", () => {
    expect(res?.subject.lastAccessDays).toBe(1) // acessou 1 dia atrás, não null
    expect(res?.subject.progressPct).toBe(55) // progresso real, não 0
    // ritmo não pode ser "nao_iniciado" — ele tem sessões e progresso.
    expect(res?.subject.ritmoDisplay).not.toBe("nao_iniciado")
  })

  it("A MÉDIA continua escopada só à org (subject fora não contamina a referência)", () => {
    // Referência itera SÓ orgStudentIds = [s1, s2]. rin não entra na média.
    // interações: s1=1, s2=0 → média round(1/2)=1 (0.5 arredonda p/ 1 no JS Math.round).
    // reflexões: s1=1, s2=0 → média round(1/2)=1.
    expect(res?.reference.interactionsAvg).toBe(1)
    expect(res?.reference.reflectionsAvg).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// BUG (Hugo 2026-07-14, caso Rinaldo/argos): "Último acesso: há 21 dias" para um
// usuário que usa a plataforma quase todo dia. Causa: o indicador lia SÓ
// sessions.created_at, mas a sessão socrática é REUTILIZADA quando o aluno volta
// (createSession reusa a active — actions.ts) e cada turno bumpa updated_at via
// claim_session_turn. Reflexões também são atividade e eram invisíveis.
// "Último acesso" = max(created_at, updated_at das sessões, created_at/updated_at
// das reflexões). Campos novos são OPCIONAIS: sem eles, comporta como antes.
// ---------------------------------------------------------------------------
describe("último acesso — atividade em sessão reutilizada e reflexões contam (caso Rinaldo)", () => {
  it("sessão criada há 21d com turno AGORA: o turno é a visita ATUAL → Você mostra a anterior (21d)", () => {
    // AJUSTE 2 (Hugo 2026-07-14): a linha "Você" mostra a PENÚLTIMA visita — o
    // turno de agora é a visita corrente (tautológica na auto-visão). A visita
    // anterior deste fixture é a criação da sessão, 21 dias atrás. O turno de
    // agora continua contando integralmente para a MÉDIA e para ritmo/triagem.
    const res = buildStudentHomeIndicators(
      "rin",
      ["s1", "rin"],
      [
        // Rinaldo: 1 sessão antiga REUTILIZADA — created 21d atrás, último turno agora.
        { student_id: "rin", status: "completed", created_at: daysAgo(21), updated_at: daysAgo(0) },
        session("s1", daysAgo(2)),
      ],
      [],
      [enrollment({ student_id: "rin", progress: { percentage: 50 } })],
      DEADLINES,
      NOW,
    )
    expect(res?.subject.lastAccessDays).toBe(21)
  })

  it("sem sessão recente mas com REFLEXÃO editada há 2 dias → último acesso 2 dias", () => {
    const res = buildStudentHomeIndicators(
      "rin",
      ["s1", "rin"],
      [{ student_id: "rin", status: "completed", created_at: daysAgo(30) }],
      [{ student_id: "rin", created_at: daysAgo(10), updated_at: daysAgo(2) }],
      [],
      DEADLINES,
      NOW,
    )
    expect(res?.subject.lastAccessDays).toBe(2)
  })

  it("a MÉDIA da org usa a mesma régua: aluno com sessão updated ontem conta 1d, não 10d", () => {
    const res = buildStudentHomeIndicators(
      "s1",
      ["s1", "s2"],
      [
        session("s1", daysAgo(1)),
        { student_id: "s2", status: "active", created_at: daysAgo(10), updated_at: daysAgo(1) },
      ],
      [],
      [],
      DEADLINES,
      NOW,
    )
    // s1 = 1d, s2 = 1d (updated_at vence created_at 10d) → média 1, não round((1+10)/2)=6.
    expect(res?.reference.lastAccessAvgDays).toBe(1)
  })

  it("retrocompatível: linhas SEM updated_at (campo opcional ausente) comportam como antes", () => {
    const res = buildStudentHomeIndicators(
      "s1",
      ORG,
      SESSIONS,
      REFLECTIONS,
      ENROLLMENTS,
      DEADLINES,
      NOW,
    )
    // Idêntico ao caso base D1: s1=1d, s2=5d, s3 fora → média 3, subject 1d.
    expect(res?.subject.lastAccessDays).toBe(1)
    expect(res?.reference.lastAccessAvgDays).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// FOLLOW-UP B (Hugo 2026-07-14): users.last_seen_at — navegação pura (login/
// browse sem chat nem reflexão) passou a gerar sinal, e o "Último acesso" da
// home considerava esse sinal no max.
//
// SH-2.2 (Hugo 2026-07-19, caso Angelo) — REVERTIDO para "Última atividade"/
// "Última sessão de estudo": login puro NÃO conta mais aqui. Angelo tinha 0%
// progresso, 0/8 interações, 1/41 reflexões, mas a linha mostrava "hoje" e
// "ativo acima da média" só porque ele tinha ABERTO o app (bump de
// last_seen_at) — sem estudar. `lastAccessDays`/`lastAccessAvgDays` passam a
// ler exclusivamente de `studyLatestByStudent`/`subjectStudyStamps` (sessão ou
// reflexão); `last_seen_at` continua alimentando `latestByStudent` (usado por
// ritmo/triagem, fora do escopo desta linha) mas nunca mais esta métrica.
// ---------------------------------------------------------------------------
describe("Última atividade/sessão de estudo — login puro (last_seen_at) NÃO conta (SH-2.2)", () => {
  const lastSeen = (entries: Array<[string, number]>) => new Map<string, number>(entries)

  it("aluno SEM sessão e SEM reflexão, mas visto ontem (last_seen_at) → null (login puro não é estudo)", () => {
    const res = buildStudentHomeIndicators(
      "rin",
      ["s1", "rin"],
      [session("s1", daysAgo(2))],
      [],
      [],
      DEADLINES,
      NOW,
      undefined,
      undefined,
      lastSeen([["rin", NOW - 1 * 86_400_000]]),
    )
    expect(res?.subject.lastAccessDays).toBeNull()
  })

  it("last_seen_at AGORA não interfere: a célula Você mostra a sessão real (10d), login não conta em janela nenhuma", () => {
    // A janela de "visita atual" (AJUSTE 2) segue existindo, mas só se aplica a
    // sinais de ESTUDO. O last_seen_at nem entra em `subjectStudyStamps`, então
    // sua posição dentro/fora da janela é irrelevante — o único candidato é a
    // sessão real, 10 dias atrás.
    const res = buildStudentHomeIndicators(
      "s1",
      ["s1"],
      [session("s1", daysAgo(10))],
      [],
      [],
      DEADLINES,
      NOW,
      undefined,
      undefined,
      lastSeen([["s1", NOW]]),
    )
    expect(res?.subject.lastAccessDays).toBe(10)
  })

  it("a MÉDIA da org (D1) NÃO enxerga last_seen_at (SH-2.2): quem só navegou fica de fora, como quem nunca estudou", () => {
    const res = buildStudentHomeIndicators(
      "s1",
      ["s1", "s2"],
      [session("s1", daysAgo(1))],
      [],
      [],
      DEADLINES,
      NOW,
      undefined,
      undefined,
      // s2 nunca abriu sessão nem refletiu, só navegou há 3 dias — não é estudo.
      lastSeen([["s2", NOW - 3 * 86_400_000]]),
    )
    // D1: só s1 (1d) tem sinal de ESTUDO; s2 fica de fora do agregado (mesma
    // regra de "nunca acessou" — navegar sem estudar não é dado de recência de
    // estudo). Média = 1, não round((1+3)/2)=2.
    expect(res?.reference.lastAccessAvgDays).toBe(1)
  })

  it("retrocompatível: sem o param last_seen, comporta exatamente como antes (sempre foi só sessão/reflexão aqui)", () => {
    const res = buildStudentHomeIndicators(
      "s1",
      ORG,
      SESSIONS,
      REFLECTIONS,
      ENROLLMENTS,
      DEADLINES,
      NOW,
    )
    expect(res?.subject.lastAccessDays).toBe(1)
    expect(res?.reference.lastAccessAvgDays).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// AJUSTE 2 (Hugo 2026-07-14) — penúltima visita na linha "Você": na auto-visão,
// "último acesso: hoje" é tautológico (o aluno está olhando a página AGORA). A
// célula Você mostra o acesso DISTINTO imediatamente anterior à visita atual.
// Definição cravada: visita atual = qualquer stamp nos últimos 60 min (janela
// alinhada ao TTL do bump de last_seen); último acesso exibido = stamp de
// atividade mais recente FORA dessa janela; sem anterior → null → a UI mostra
// o fallback de "sem sessão de estudo ainda". A MÉDIA da turma segue com o
// mais recente (agregado). SH-2.2 (Hugo 2026-07-19): a partir desta story, os
// "stamps" considerados aqui são só de ESTUDO (sessão/reflexão) — os testes
// abaixo já usam só sessão, então o comportamento de janela em si é inalterado
// pela SH-2.2 (ver describe acima para a mudança que a afeta: last_seen_at).
// ---------------------------------------------------------------------------
describe("penúltima visita — a célula Você mostra o acesso ANTERIOR à visita atual", () => {
  const HOUR = 3_600_000
  const lastSeen = (entries: Array<[string, number]>) => new Map<string, number>(entries)

  it("exemplo do Hugo: acessou agora (turno há 30min) e antes disso há 3 dias → 'há 3 dias'", () => {
    const res = buildStudentHomeIndicators(
      "s1",
      ["s1"],
      [
        {
          student_id: "s1",
          status: "active",
          created_at: daysAgo(3),
          updated_at: new Date(NOW - 30 * 60_000).toISOString(),
        },
      ],
      [],
      [],
      DEADLINES,
      NOW,
    )
    expect(res?.subject.lastAccessDays).toBe(3)
  })

  it("atividade de HOJE fora da janela (5h atrás) é visita distinta → 'hoje' informativo (0)", () => {
    const res = buildStudentHomeIndicators(
      "s1",
      ["s1"],
      [
        {
          student_id: "s1",
          status: "active",
          created_at: daysAgo(10),
          updated_at: new Date(NOW - 5 * HOUR).toISOString(),
        },
        {
          student_id: "s1",
          status: "active",
          created_at: new Date(NOW - 10 * 60_000).toISOString(),
        },
      ],
      [],
      [],
      DEADLINES,
      NOW,
    )
    expect(res?.subject.lastAccessDays).toBe(0)
  })

  it("TODA atividade dentro da janela da visita atual (primeira visita) → null (SH-2.2: 'Ainda sem sessão de estudo')", () => {
    const res = buildStudentHomeIndicators(
      "s1",
      ["s1"],
      [
        {
          student_id: "s1",
          status: "active",
          created_at: new Date(NOW - 20 * 60_000).toISOString(),
        },
      ],
      [],
      [],
      DEADLINES,
      NOW,
      undefined,
      undefined,
      lastSeen([["s1", NOW - 10 * 60_000]]),
    )
    expect(res?.subject.lastAccessDays).toBeNull()
  })

  it("a MÉDIA NÃO adota a penúltima: atividade dentro da janela conta como 0d no agregado", () => {
    const res = buildStudentHomeIndicators(
      "s1",
      ["s1", "s2"],
      [
        {
          student_id: "s2",
          status: "active",
          created_at: daysAgo(4),
          updated_at: new Date(NOW - 30 * 60_000).toISOString(),
        },
        session("s1", daysAgo(2)),
      ],
      [],
      [],
      DEADLINES,
      NOW,
    )
    // Média: s1=2d, s2=0d (mais recente, regra do agregado) → round(2/2)=1.
    expect(res?.reference.lastAccessAvgDays).toBe(1)
    // Enquanto a célula Você (s1, sem atividade na janela) mostra a própria última: 2d.
    expect(res?.subject.lastAccessDays).toBe(2)
  })
})
