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

// T2, TriagemAluno (cards + coluna Acao + colunas dos destaques, particao
// exaustiva). Hierarquia de gravidade redefinida pelo Hugo (2026-07-07):
// verde -> amarelo -> vermelho, com ATRASO priorizado sobre inatividade.
//   regra 0    = aluno CONCLUIDO (todas as matriculas completas) -> no_ritmo
//                sempre, mesmo sem acesso recente
//   atencao    = ritmo "atrasado" OU "nao_iniciado" (VERMELHO, o pior estado:
//                quem nunca comecou ou esta atras do cronograma e quem o
//                gestor tem que ver primeiro)
//   sem_acesso = NAO atencao && daysSince(lastSessionDate) > 14 (AMARELO:
//                sumido, mas em dia no cronograma; alvo do "Lembrar")
//   no_ritmo   = resto (VERDE)
// Ex.: Venilton (nunca acessou + atrasado) -> atencao; Artur (54d sem acesso,
// 63% em dia) -> sem_acesso.
export function computeStudentTriagem(
  row: TriageInput,
  ritmo: StudentRitmo,
  now = Date.now(),
): StudentTriagem {
  if (isStudentConcluido(row)) return "no_ritmo"
  if (ritmo === "atrasado" || ritmo === "nao_iniciado") return "atencao"
  const days = daysSinceLastSession(row.lastSessionDate, now)
  if (days > SEM_ACESSO_DAYS) return "sem_acesso"
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

// T3, Ação (deriva da triagem; cores redefinidas pelo Hugo 2026-07-07):
//   no_ritmo   -> sem ação (badge estática verde "No ritmo")
//   sem_acesso -> botão AMARELO "Lembrar" (faz um tempo que não acessa,
//                 mas está em dia; nudgeType "inactive")
//   atencao    -> botão VERMELHO "Acionar" (atrasado ou nunca começou;
//                 nudgeType "never_accessed" se nunca teve sessão)
export type StudentAction =
  | { kind: "none" } // no_ritmo: badge estática
  | { kind: "lembrar"; nudgeType: NudgeType } // sem_acesso (amarelo)
  | { kind: "acionar"; nudgeType: NudgeType } // atencao (vermelho)

export function computeStudentAction(
  triagem: StudentTriagem | undefined,
  totalSessions: number,
): StudentAction | null {
  if (!triagem) return null // chamador não enriqueceu
  if (triagem === "no_ritmo") return { kind: "none" }
  if (triagem === "sem_acesso") return { kind: "lembrar", nudgeType: "inactive" }
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
  /** true quando o aluno nunca teve sessão (não iniciado): a coluna vermelha
   * renderiza "Nunca acessou · Xd atrasado" em vez de "0% concluído · ...". */
  neverAccessed?: boolean
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
  // Hierarquia Hugo 2026-07-07: ATRASO tem precedência sobre inatividade.
  // triagem "atencao" (atrasado/não iniciado) fica nas colunas de pace (a
  // vermelha); "sem_acesso" (sumido mas em dia) vai para a coluna amarela.
  const rowById = new Map(triageRows.map((r) => [r.id, r]))
  const semAcessoIds = new Set(
    triageRows.filter((r) => r.triagem === "sem_acesso").map((r) => r.id),
  )

  // Colunas verde/vermelha: pace, excluindo quem está sem_acesso (amarela),
  // com flag neverAccessed para a sublinha "Nunca acessou · Xd atrasado".
  const paceHighlights: PaceHighlightEntry[] = paceEntries
    .filter((p) => !semAcessoIds.has(p.studentId))
    .map((p) => ({
      ...p,
      neverAccessed: (rowById.get(p.studentId)?.totalSessions ?? 1) === 0,
    }))

  const idsComPace = new Set(paceEntries.map((p) => p.studentId))

  // Concluídos (regra 0) sem NENHUMA entry de pace: entry sintética na verde.
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

  // Não iniciados em "atencao" SEM entry de pace (sem matrícula ativa com
  // deadline): entry sintética na vermelha, sublinha "Nunca acessou".
  for (const row of triageRows) {
    if (row.triagem !== "atencao" || idsComPace.has(row.id) || row.totalSessions > 0) continue
    paceHighlights.push({
      studentId: row.id,
      studentName: row.full_name,
      courseTitle: "",
      status: "behind",
      progressPct: row.courseProgressPct ?? 0,
      daysLeft: 0,
      daysAhead: 0,
      neverAccessed: true,
    })
  }

  // Coluna amarela: triagem sem_acesso (em dia no cronograma, mas sumido).
  const noAccess: NoAccessEntry[] = triageRows
    .filter((r) => r.triagem === "sem_acesso")
    .map((row) => {
      const days = daysSinceLastSession(row.lastSessionDate, now)
      const base = `${Number.isFinite(days) ? days : "?"}d sem acesso`
      const paceEntry = paceEntries.find((p) => p.studentId === row.id)
      const extra = paceEntry ? ` · ${paceEntry.progressPct}% concluído` : ""
      return {
        studentName: row.full_name,
        detail: `${base}${extra}`,
        _days: Number.isFinite(days) ? days : 0,
      }
    })
    .sort((a, b) => b._days - a._days)
    .map(({ studentName, detail }) => ({ studentName, detail }))

  return { paceHighlights, noAccess }
}
