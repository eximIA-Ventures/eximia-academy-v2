// Taxonomia canônica da Onda 2 (EPIC-MANAGER-UX). Fonte única de Ritmo/Triagem
// por aluno. S7 cria; S8/S9/S10/S11 consomem. Limiares ESPELHAM
// engagement-helpers.ts:67-68; mudança futura de limiar DEVE tocar os dois.

import type { NudgeType } from "@/types/notifications"

export type StudentRitmo = "no_ritmo" | "atrasado" | "nao_iniciado"
export type StudentTriagem = "no_ritmo" | "atencao" | "sem_acesso"
export type StudentPace = "ahead" | "on_track" | "behind"

export const SEM_ACESSO_DAYS = 14 // espelho de INACTIVE_DAYS (engagement-helpers.ts:67)
export const ATENCAO_DAYS = 5 // espelho de AT_RISK_DAYS (engagement-helpers.ts:68)

// Subconjunto de StudentInsightRow que a triagem precisa (mantém a função pura).
export interface TriageInput {
  id: string
  totalSessions: number
  lastSessionDate: string | null
  courseProgressPct?: number
  coursesEnrolled?: number
  coursesCompleted?: number
}

// Aluno que já concluiu todas as matrículas (coursesEnrolled > 0 e
// coursesCompleted === coursesEnrolled). Usado pela regra 0 de triagem e pela
// partição dos destaques, para nunca cair em "atencao"/"sem_acesso".
export function isStudentConcluido(row: TriageInput): boolean {
  return (row.coursesEnrolled ?? 0) > 0 && row.coursesCompleted === row.coursesEnrolled
}

// Dias inteiros desde a última sessão. null => Infinity (nunca acessou).
export function daysSinceLastSession(lastSessionDate: string | null, now = Date.now()): number {
  if (!lastSessionDate) return Number.POSITIVE_INFINITY
  return Math.floor((now - new Date(lastSessionDate).getTime()) / 86_400_000)
}

// T1, RitmoAluno (coluna Ritmo, POR ALUNO):
//   nao_iniciado = totalSessions === 0 && (courseProgressPct ?? 0) === 0
//   atrasado     = NAO nao_iniciado && existe enrollment ATIVO em curso com
//                  deadline com pct < expectedPct (mesma formula do
//                  paceHighlights; chega aqui como paceByStudent === "behind")
//   no_ritmo     = caso contrario (inclui ahead, on_track e concluidos)
export function computeStudentRitmo(
  row: TriageInput,
  paceByStudent: Map<string, StudentPace>,
): StudentRitmo {
  if (row.totalSessions === 0 && (row.courseProgressPct ?? 0) === 0) return "nao_iniciado"
  if (paceByStudent.get(row.id) === "behind") return "atrasado"
  return "no_ritmo"
}

// T2, TriagemAluno (cards + coluna Acao + 3a lista dos destaques, particao
// exaustiva; espelha os buckets accessed/devendo/inativos com os limiares 5/14):
//   regra 0    = aluno CONCLUIDO (todas as matriculas completas) -> no_ritmo
//                sempre, mesmo sem acesso recente (quem terminou nao e
//                "sem acesso" nem "atencao")
//   sem_acesso = totalSessions === 0 OU daysSince(lastSessionDate) > 14
//   atencao    = NAO sem_acesso && (ritmo === "atrasado" OU daysSince > 5)
//   no_ritmo   = resto
// Mapeamento conceitual: accessed -> no_ritmo, devendo -> atencao,
// inativos -> sem_acesso.
export function computeStudentTriagem(
  row: TriageInput,
  ritmo: StudentRitmo,
  now = Date.now(),
): StudentTriagem {
  if (isStudentConcluido(row)) return "no_ritmo"
  const days = daysSinceLastSession(row.lastSessionDate, now)
  if (row.totalSessions === 0 || days > SEM_ACESSO_DAYS) return "sem_acesso"
  if (ritmo === "atrasado" || days > ATENCAO_DAYS) return "atencao"
  return "no_ritmo"
}

export interface TriageSummary {
  analisados: number
  noRitmo: number
  atencao: number
  semAcesso: number
  noRitmoPct: number
  atencaoPct: number
  semAcessoPct: number
}

export function computeTriageSummary(triagens: StudentTriagem[]): TriageSummary {
  const analisados = triagens.length
  const count = (t: StudentTriagem) => triagens.filter((x) => x === t).length
  const pct = (n: number) => (analisados > 0 ? Math.round((n / analisados) * 100) : 0)
  const [noRitmo, atencao, semAcesso] = [count("no_ritmo"), count("atencao"), count("sem_acesso")]
  return {
    analisados,
    noRitmo,
    atencao,
    semAcesso,
    noRitmoPct: pct(noRitmo),
    atencaoPct: pct(atencao),
    semAcessoPct: pct(semAcesso),
  }
}

// T3, Ação (S10, deriva da triagem):
//   no_ritmo   -> sem ação (badge estática "No ritmo")
//   atencao    -> botão "Lembrar" (nudgeType "inactive")
//   sem_acesso -> botão "Acionar" (nudgeType "never_accessed" se totalSessions
//                 === 0, senão "inactive")
export type StudentAction =
  | { kind: "none" } // no_ritmo: badge estática
  | { kind: "lembrar"; nudgeType: NudgeType } // atencao
  | { kind: "acionar"; nudgeType: NudgeType } // sem_acesso

export function computeStudentAction(
  triagem: StudentTriagem | undefined,
  totalSessions: number,
): StudentAction | null {
  if (!triagem) return null // chamador não enriqueceu
  if (triagem === "no_ritmo") return { kind: "none" }
  if (triagem === "atencao") return { kind: "lembrar", nudgeType: "inactive" }
  return { kind: "acionar", nudgeType: totalSessions === 0 ? "never_accessed" : "inactive" }
}

// S12-fix (Onda 2, bug de duplicação): partição EXCLUSIVA dos destaques do
// Plano de Ensino. Antes, coluna 1-2 (pace por enrollment) e coluna 3
// (triagem por aluno) vinham de fontes independentes, o mesmo aluno podia
// aparecer em duas colunas (atrasado + sem acesso) e um aluno concluído sem
// enrollment ativo não aparecia em nenhuma. Esta função redistribui as MESMAS
// entries já calculadas pelo chamador, sem nova query, respeitando:
//   - triagem === "sem_acesso" tem PRECEDENCIA sobre o pace: o aluno vai para
//     a coluna 3 (nunca para 1/2), com sublinha enriquecida quando também
//     está atrasado no pace.
//   - aluno CONCLUIDO (regra 0 de computeStudentTriagem) sem entry de pace
//     ganha uma entry sintética na coluna 1, sublinha "concluído".
export interface PaceHighlightEntry {
  studentId: string
  studentName: string
  courseTitle: string
  status: "ahead" | "on_track" | "behind"
  progressPct: number
  daysLeft: number
  daysAhead: number
  /** true apenas nas entries sintéticas de concluído sem enrollment ativo
   * (regra 0), para o consumidor renderizar a sublinha fixa "concluído" em
   * vez do texto padrão de progresso/dias. */
  concluido?: boolean
}

export interface TriageRow extends TriageInput {
  full_name: string
  triagem: StudentTriagem
}

export interface NoAccessEntry {
  studentName: string
  detail: string
}

export interface PartitionedHighlights {
  paceHighlights: PaceHighlightEntry[]
  noAccess: NoAccessEntry[]
}

export function partitionHighlights(
  paceEntries: PaceHighlightEntry[],
  triageRows: TriageRow[],
  now = Date.now(),
): PartitionedHighlights {
  const semAcessoIds = new Set(
    triageRows.filter((r) => r.triagem === "sem_acesso").map((r) => r.id),
  )
  const behindIds = new Set(
    paceEntries.filter((p) => p.status === "behind").map((p) => p.studentId),
  )

  // Colunas 1-2: pace, excluindo quem está sem_acesso (precedência da coluna 3).
  const paceHighlights = paceEntries.filter((p) => !semAcessoIds.has(p.studentId))

  // Concluídos (regra 0) sem NENHUMA entry de pace ganham entry sintética na
  // coluna 1, com sublinha "concluído" (status "ahead", não é atrasado nem
  // precisa de dias restantes).
  const idsComPace = new Set(paceEntries.map((p) => p.studentId))
  for (const row of triageRows) {
    if (row.triagem !== "no_ritmo" || !isStudentConcluido(row) || idsComPace.has(row.id)) continue
    paceHighlights.push({
      studentId: row.id,
      studentName: row.full_name,
      courseTitle: "",
      status: "ahead",
      progressPct: 100,
      daysLeft: 0,
      daysAhead: 0,
      concluido: true,
    })
  }

  // Coluna 3: triagem sem_acesso, com sublinha enriquecida por atraso de pace.
  const noAccess: NoAccessEntry[] = triageRows
    .filter((r) => r.triagem === "sem_acesso")
    .map((row) => {
      const never = row.totalSessions === 0 || row.lastSessionDate === null
      const days = never ? null : daysSinceLastSession(row.lastSessionDate, now)
      const base = never ? "Nunca acessou" : `${days}d sem acesso`
      const paceEntry = paceEntries.find((p) => p.studentId === row.id)
      const extra = behindIds.has(row.id)
        ? ` · ${Math.abs(paceEntry?.daysAhead ?? 0)}d atrasado`
        : paceEntry
          ? ` · ${paceEntry.progressPct}% concluído`
          : ""
      return {
        studentName: row.full_name,
        detail: `${base}${extra}`,
        _never: never,
        _days: days ?? 0,
      }
    })
    .sort((a, b) => (a._never !== b._never ? (a._never ? -1 : 1) : b._days - a._days))
    .map(({ studentName, detail }) => ({ studentName, detail }))

  return { paceHighlights, noAccess }
}
