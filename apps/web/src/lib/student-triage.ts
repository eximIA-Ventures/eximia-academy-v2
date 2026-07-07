// Taxonomia canônica da Onda 2 (EPIC-MANAGER-UX). Fonte única de Ritmo/Triagem
// por aluno. S7 cria; S8/S9/S10/S11 consomem. Limiares ESPELHAM
// engagement-helpers.ts:67-68; mudança futura de limiar DEVE tocar os dois.

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
