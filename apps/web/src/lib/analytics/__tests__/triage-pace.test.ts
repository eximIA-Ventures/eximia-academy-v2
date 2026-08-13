import { computeTriageSummary, triageStudents } from "@/lib/student-triage"
import { describe, expect, it } from "vitest"
import {
  type PaceDeadlineCourse,
  type PaceEnrollmentRow,
  computePaceFromEnrollments,
} from "../triage-pace"

// ===========================================================================
// TESTE DE CARACTERIZAÇÃO (2026-08-12).
//
// Escrito ANTES de mover o cálculo de pace/triagem para fora de
// `manager-dashboard-page.tsx`, capturando a saída da versão que estava em
// produção para um input fixo. Ele não afirma que a aritmética é "certa" —
// afirma que ela é a MESMA. É a única prova de que /dashboard não mudou um
// número ao passar a consumir o helper compartilhado que /analytics também usa.
//
// Os valores esperados abaixo foram derivados à mão das fórmulas originais
// (manager-dashboard-page.tsx:261-296), não copiados de uma execução:
//   expectedPct = min(100, round(elapsedDays / deadlineDays * 100))
//   status      = pct >= expectedPct ? (pct > expectedPct + 10 ? ahead : on_track) : behind
//   daysAhead   = round((pct - expectedPct) / 100 * deadlineDays)
//   daysLeft    = max(0, ceil((enrolled + deadlineDays - now) em dias))
//   por aluno   = pior status (behind > on_track > ahead)
// ===========================================================================

const NOW = new Date("2026-08-12T12:00:00.000Z").getTime()
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString()

const COURSES: PaceDeadlineCourse[] = [
  { id: "c-longo", title: "Curso Longo", deadline_days: 30 },
  { id: "c-curto", title: "Curso Curto", deadline_days: 10 },
]

const ENROLLMENTS: PaceEnrollmentRow[] = [
  // s1 no Curso Longo: 15d de 30 => esperado 50%, tem 90% => adiantado.
  {
    student_id: "s1",
    course_id: "c-longo",
    created_at: daysAgo(15),
    progress: { percentage: 90 },
    users: { full_name: "Ana Silva", report_name: "Ana S." },
  },
  // s1 no Curso Curto: 5d de 10 => esperado 50%, tem 10% => atrasado.
  // É o pior status do s1 e portanto o que sobe para paceByStudent.
  {
    student_id: "s1",
    course_id: "c-curto",
    created_at: daysAgo(5),
    progress: { percentage: 10 },
    users: { full_name: "Ana Silva", report_name: null },
  },
  // s2: 10d de 30 => esperado round(33.33)=33, tem 34 => no ritmo, +0 dias.
  {
    student_id: "s2",
    course_id: "c-longo",
    created_at: daysAgo(10),
    progress: { percentage: 34 },
    users: { full_name: "Bruno Costa" },
  },
  // Matrícula em curso SEM prazo (fora do deadlineMap) => ignorada.
  {
    student_id: "s3",
    course_id: "c-sem-prazo",
    created_at: daysAgo(1),
    progress: { percentage: 100 },
    users: { full_name: "Carla Dias" },
  },
  // s4 sem progress (null) => pct 0; 2d de 10 => esperado 20% => atrasado.
  // Sem join de users => nome cai para o travessão do original.
  {
    student_id: "s4",
    course_id: "c-curto",
    created_at: daysAgo(2),
    progress: null,
    users: null,
  },
]

describe("computePaceFromEnrollments (caracterização do loop original)", () => {
  it("reproduz status, progresso, dias e ordenação por matrícula", () => {
    const { paceHighlights } = computePaceFromEnrollments(ENROLLMENTS, COURSES, NOW)

    // Ordem: atrasados primeiro (entre si por daysAhead decrescente), depois o
    // resto por daysAhead decrescente. A matrícula de curso sem prazo sumiu.
    expect(paceHighlights).toEqual([
      {
        studentId: "s4",
        studentName: "—",
        courseTitle: "Curso Curto",
        status: "behind",
        progressPct: 0,
        daysLeft: 8,
        daysAhead: -2,
      },
      {
        studentId: "s1",
        studentName: "Ana Silva",
        courseTitle: "Curso Curto",
        status: "behind",
        progressPct: 10,
        daysLeft: 5,
        daysAhead: -4,
      },
      {
        studentId: "s1",
        studentName: "Ana S.",
        courseTitle: "Curso Longo",
        status: "ahead",
        progressPct: 90,
        daysLeft: 15,
        daysAhead: 12,
      },
      {
        studentId: "s2",
        studentName: "Bruno Costa",
        courseTitle: "Curso Longo",
        status: "on_track",
        progressPct: 34,
        daysLeft: 20,
        daysAhead: 0,
      },
    ])
  })

  it("reduz para o PIOR pace por aluno (behind > on_track > ahead)", () => {
    const { paceByStudent } = computePaceFromEnrollments(ENROLLMENTS, COURSES, NOW)

    // s1 aparece como "ahead" ANTES de aparecer como "behind" na lista de
    // entrada; a redução tem de ficar com o pior, não com o último visto.
    expect(paceByStudent.get("s1")).toBe("behind")
    expect(paceByStudent.get("s2")).toBe("on_track")
    expect(paceByStudent.get("s4")).toBe("behind")
    // Curso sem prazo não gera pace algum.
    expect(paceByStudent.has("s3")).toBe(false)
    expect(paceByStudent.size).toBe(3)
  })

  // O limiar de "ahead" é ESTRITAMENTE > expectedPct + 10. Sem um caso na
  // fronteira, uma troca do 10 por qualquer outro número passaria despercebida
  // (verificado por mutação: com +5 no lugar de +10, o caso de 60% abaixo vira
  // "ahead" e este teste fica vermelho).
  it.each([
    { pct: 59, status: "on_track" },
    { pct: 60, status: "on_track" }, // exatamente esperado+10 ainda NÃO é ahead
    { pct: 61, status: "ahead" },
  ])("pct $pct sobre esperado 50 => $status", ({ pct, status }) => {
    const { paceHighlights } = computePaceFromEnrollments(
      [
        {
          student_id: "sb",
          course_id: "c-longo", // 30 dias; 15 decorridos => esperado 50%
          created_at: daysAgo(15),
          progress: { percentage: pct },
          users: { full_name: "Fronteira" },
        },
      ],
      COURSES,
      NOW,
    )
    expect(paceHighlights[0].status).toBe(status)
  })

  it("mantém o pior pace quando o atraso aparece PRIMEIRO na lista", () => {
    // Espelho invertido do caso do s1: aqui "behind" vem antes de "ahead", e o
    // resultado tem de continuar "behind" (é max, não último-visto nem primeiro).
    const { paceByStudent } = computePaceFromEnrollments(
      [ENROLLMENTS[1], ENROLLMENTS[0]],
      COURSES,
      NOW,
    )
    expect(paceByStudent.get("s1")).toBe("behind")
  })

  it("sem curso com prazo, devolve vazio sem tocar nas matrículas", () => {
    const empty = computePaceFromEnrollments(ENROLLMENTS, [], NOW)
    expect(empty.paceHighlights).toEqual([])
    expect(empty.paceByStudent.size).toBe(0)
  })

  it("trava o teto de expectedPct em 100 (prazo vencido não vira >100%)", () => {
    const { paceHighlights } = computePaceFromEnrollments(
      [
        {
          student_id: "s9",
          course_id: "c-curto",
          created_at: daysAgo(40), // 4x o prazo de 10 dias
          progress: { percentage: 100 },
          users: { full_name: "Diana" },
        },
      ],
      COURSES,
      NOW,
    )
    // elapsed/deadline = 400% => teto em 100 => 100 >= 100 e não > 110 => on_track.
    expect(paceHighlights[0]).toMatchObject({
      status: "on_track",
      daysAhead: 0,
      daysLeft: 0, // prazo vencido nunca fica negativo
    })
  })
})

describe("pipeline de triagem completo (pace -> ritmo -> triagem -> cards)", () => {
  // Roster mínimo com os campos que a triagem exige, um por classe de saída.
  const ROSTER = [
    // s1: atrasado no pace => "atencao" (vermelho), mesmo tendo acessado ontem.
    { id: "s1", totalSessions: 12, lastSessionDate: daysAgo(1), courseProgressPct: 40 },
    // s2: no ritmo e ativo => "no_ritmo" (verde).
    { id: "s2", totalSessions: 8, lastSessionDate: daysAgo(2), courseProgressPct: 34 },
    // s5: em dia no cronograma mas 20 dias sumido => "sem_acesso" (amarelo).
    { id: "s5", totalSessions: 3, lastSessionDate: daysAgo(20), courseProgressPct: 60 },
    // s6: nunca acessou e 0% => ritmo "nao_iniciado" => "atencao".
    { id: "s6", totalSessions: 0, lastSessionDate: null, courseProgressPct: 0 },
    // s7: concluiu tudo => regra 0, "no_ritmo" mesmo 90 dias sem acessar.
    {
      id: "s7",
      totalSessions: 5,
      lastSessionDate: daysAgo(90),
      courseProgressPct: 100,
      coursesEnrolled: 2,
      coursesCompleted: 2,
    },
  ]

  it("produz o mesmo TriageSummary que o /dashboard produzia", () => {
    const { paceByStudent } = computePaceFromEnrollments(ENROLLMENTS, COURSES, NOW)
    const triaged = triageStudents(ROSTER, paceByStudent, NOW)

    expect(triaged.map((s) => [s.id, s.ritmo, s.triagem])).toEqual([
      ["s1", "atrasado", "atencao"],
      ["s2", "no_ritmo", "no_ritmo"],
      ["s5", "no_ritmo", "sem_acesso"],
      ["s6", "nao_iniciado", "atencao"],
      ["s7", "no_ritmo", "no_ritmo"],
    ])

    expect(computeTriageSummary(triaged.map((s) => s.triagem))).toEqual({
      analisados: 5,
      noRitmo: 2,
      atencao: 2,
      semAcesso: 1,
      noRitmoPct: 40,
      atencaoPct: 40,
      semAcessoPct: 20,
    })
  })

  it("preserva os campos originais da row ao enriquecer", () => {
    const [first] = triageStudents(
      [{ id: "s2", totalSessions: 8, lastSessionDate: daysAgo(2), courseProgressPct: 34 }],
      new Map(),
      NOW,
    )
    expect(first.courseProgressPct).toBe(34)
    expect(first.totalSessions).toBe(8)
  })
})
