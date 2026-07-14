import type { EnrollmentRow } from "@/lib/notifications/engagement-triage"
import { describe, expect, it } from "vitest"
import {
  type HomeReflectionRow,
  type HomeSessionRow,
  buildStudentHomeIndicators,
  computeEngagementMax,
  countReflectionPossibleSlides,
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
  it("sessão criada há 21 dias mas com turno HOJE (updated_at) → último acesso 0 dias, não 21", () => {
    const res = buildStudentHomeIndicators(
      "rin",
      ["s1", "rin"],
      [
        // Rinaldo: 1 sessão antiga REUTILIZADA — created 21d atrás, último turno hoje.
        { student_id: "rin", status: "completed", created_at: daysAgo(21), updated_at: daysAgo(0) },
        session("s1", daysAgo(2)),
      ],
      [],
      [enrollment({ student_id: "rin", progress: { percentage: 50 } })],
      DEADLINES,
      NOW,
    )
    expect(res?.subject.lastAccessDays).toBe(0)
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
// browse sem chat nem reflexão) agora gera sinal, e o "Último acesso" da home
// considera esse sinal no max. Param OPCIONAL: ausente → comporta como antes.
// ---------------------------------------------------------------------------
describe("último acesso — users.last_seen_at (navegação pura) conta como acesso", () => {
  const lastSeen = (entries: Array<[string, number]>) => new Map<string, number>(entries)

  it("aluno SEM sessão e SEM reflexão, mas visto ontem (last_seen_at) → 1 dia, não null", () => {
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
    expect(res?.subject.lastAccessDays).toBe(1)
  })

  it("last_seen_at mais RECENTE que a sessão vence no max (sessão 10d, visto hoje → 0d)", () => {
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
    expect(res?.subject.lastAccessDays).toBe(0)
  })

  it("a MÉDIA da org (D1) também enxerga last_seen_at: quem só navegou conta como acessado", () => {
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
      // s2 nunca abriu sessão nem refletiu, mas navegou há 3 dias.
      lastSeen([["s2", NOW - 3 * 86_400_000]]),
    )
    // D1: s1=1d, s2=3d (via last_seen) → média round((1+3)/2)=2, s2 NÃO fica fora.
    expect(res?.reference.lastAccessAvgDays).toBe(2)
  })

  it("retrocompatível: sem o param, comporta exatamente como antes", () => {
    const res = buildStudentHomeIndicators("s1", ORG, SESSIONS, REFLECTIONS, ENROLLMENTS, DEADLINES, NOW)
    expect(res?.subject.lastAccessDays).toBe(1)
    expect(res?.reference.lastAccessAvgDays).toBe(3)
  })
})
