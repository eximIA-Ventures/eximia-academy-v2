// Contexto de triagem do gestor — a fiação de I/O que alimenta os 3 cards
// "No ritmo / Sem acesso / Atenção" (TriageCards).
//
// POR QUE EXISTE (2026-08-12): até aqui esse pipeline vivia inteiro dentro de
// `ManagerDashboardPage`, então só /dashboard conseguia montar os cards.
// Quando o Hugo pediu o MESMO card em /analytics, a escolha era duplicar o
// pipeline (dois cálculos livres para divergir na mesma pergunta de negócio)
// ou extraí-lo. Extraído: aqui é a única fonte de `paceByStudent` e do
// `TriageSummary`, e as duas telas consomem ESTE módulo.
//
// A aritmética pura mora em `triage-pace.ts` (testada em triage-pace.test.ts);
// este arquivo só busca as linhas e compõe. `getStudentDetails` é um server
// action, então este módulo é server-only por construção.

import { getStudentDetails } from "@/app/(studio)/instructor/actions"
import type { PaceDeadlineCourse, PaceEnrollmentRow } from "@/lib/analytics/triage-pace"
import { computePaceFromEnrollments } from "@/lib/analytics/triage-pace"
import { getAreaStudentIds } from "@/lib/area-context"
import { type TriageSummary, computeTriageSummary, triageStudents } from "@/lib/student-triage"
import type { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

export type { PaceContext } from "@/lib/analytics/triage-pace"

type RlsClient = Awaited<ReturnType<typeof createClient>>

/**
 * Busca as matrículas ativas com prazo do recorte e devolve o pace por
 * matrícula + o pior pace por aluno.
 *
 * RLS NOTE (por que service client) — texto herdado do call site original: as
 * leituras de enrollment/course rodam no SERVICE client, NÃO no RLS do gestor.
 * `studentIds` JÁ é o conjunto autorizado (vem dos RPCs SECURITY DEFINER
 * getDirectTeamStudentIds / getManagedTeamStudentIds / getSubtreeStudentIdsAtNode,
 * cada um gated ao alcance do chamador). Ler enrollments exatamente desses ids
 * via service é o mesmo padrão de trava de getStudentDetails(restrictToStudentIds).
 * O RLS client NÃO enxergaria a matrícula PRÓPRIA de um direto multi-chapéu (o
 * RLS de enrollments escopa a alunos-FOLHA alcançáveis; um `reports_to` que
 * lidera time é invisível a ele) — foi por isso que "Diretos" colapsava em
 * painel vazio para o Rinaldo.
 *
 * O `supabase` RLS entra só para resolver o escopo de UNIDADE (`getAreaStudentIds`),
 * como no original.
 */
export async function loadPaceContext(
  supabase: RlsClient,
  tenantId: string,
  activeAreaId: string | null | undefined,
  studentIds: string[],
) {
  const serviceClient = createServiceClient()
  const areaStudentIds = await getAreaStudentIds(supabase, tenantId, activeAreaId)
  const { data: deadlineCourses } = await serviceClient
    .from("courses")
    .select("id, title, deadline_days")
    .eq("tenant_id", tenantId)
    .not("deadline_days", "is", null)

  const courses = (deadlineCourses ?? []) as PaceDeadlineCourse[]
  // Guarda do original: sem curso com prazo, nem se consulta enrollments.
  if (courses.length === 0) return computePaceFromEnrollments([], [])

  const courseIds = courses.map((c) => c.id)
  let activeEnrollmentsQuery = serviceClient
    .from("enrollments")
    .select("student_id, course_id, progress, created_at, users!inner(full_name, report_name)")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .in("course_id", courseIds)
    // TEAM scope: only this manager's team members.
    .in("student_id", studentIds.length > 0 ? studentIds : ["__none__"])
  if (areaStudentIds) {
    // UNIDADE scope: intersect with the active unit's student universe.
    activeEnrollmentsQuery = activeEnrollmentsQuery.in("student_id", areaStudentIds)
  }
  const { data: activeEnrollments } = await activeEnrollmentsQuery

  // O join `users!inner(...)` chega frouxamente tipado do PostgREST; a
  // normalização (mesmos casts do código original) acontece aqui, na fronteira
  // de I/O, para que a parte pura permaneça estritamente tipada.
  const rows: PaceEnrollmentRow[] = (activeEnrollments ?? []).map((e) => ({
    student_id: e.student_id as string,
    course_id: e.course_id as string,
    created_at: e.created_at as string,
    progress: e.progress as { percentage?: number } | null,
    users: e.users as { full_name?: string; report_name?: string | null } | null,
  }))

  return computePaceFromEnrollments(rows, courses)
}

/**
 * Ponta a ponta: roster do recorte + pace + triagem + sumário dos 3 cards.
 *
 * É o que /analytics chama. /dashboard NÃO usa esta função porque precisa dos
 * intermediários (paceHighlights para os Destaques, rows enriquecidas com
 * sub-time para a tabela), mas consome as MESMAS peças — `loadPaceContext` e
 * `triageStudents` — então os números das duas telas nascem do mesmo cálculo.
 *
 * O universo é o RECORTE ativo (`studentIds`), não o filtro fino `?teams=`,
 * espelhando a decisão de produto da spec S7 (E5/E10) já vigente em /dashboard.
 */
export async function resolveTriageSummary(
  supabase: RlsClient,
  tenantId: string,
  activeAreaId: string | null | undefined,
  studentIds: string[],
): Promise<TriageSummary> {
  const scopeSet = new Set(studentIds)
  const [rawStudentDetails, { paceByStudent }] = await Promise.all([
    getStudentDetails(tenantId, activeAreaId, { restrictToStudentIds: studentIds }),
    loadPaceContext(supabase, tenantId, activeAreaId, studentIds),
  ])
  // Mesmo pós-filtro defense-in-depth do /dashboard: o roster já vem escopado
  // por `restrictToStudentIds`, este passo só garante que um alargamento futuro
  // de getStudentDetails não vaze aluno fora do time para a contagem.
  const inScope = rawStudentDetails.filter((s) => scopeSet.has(s.id))
  return computeTriageSummary(triageStudents(inScope, paceByStudent).map((s) => s.triagem))
}
