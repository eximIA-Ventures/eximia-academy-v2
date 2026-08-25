// ---------------------------------------------------------------------------
// O RECORTE DA AUTOGESTÃO — auth + resolução de curso/período/relógio, para as
// três abas (`visao-geral`, `padroes`, `mapa`) dentro de `/jornada?vista=autogestao`.
// ---------------------------------------------------------------------------
// Esta tela é INDIVIDUAL (CONTRATO-DE-DADOS.md, N.4): o sujeito é SEMPRE o
// próprio usuário autenticado. Não existe parâmetro de "outro aluno" para
// resolver — `studentId` é `user.id`, ponto final. É essa ausência estrutural
// (nenhum `?studentId=` é lido, muito menos honrado) que faz a §30 valer: um
// gestor que acessa esta rota só pode ver os PRÓPRIOS dados, nunca os de um
// aluno que ele gerencia.
//
// Mesma resolução de curso/período/relógio de `app/api/analytics/autogestao/
// _contexto.ts` (mesma regra, lugar diferente): a página NÃO chama a rota HTTP
// por cima de si mesma — ela usa a MESMA camada pura (`lerFonteAutogestao` +
// os 3 montadores) diretamente, no mesmo padrão que `_trinca/recorte.ts` +
// `_visao-geral/painel.tsx` já fazem para o gestor. Duplicar via `fetch()`
// exigiria repassar cookies e resolver URL absoluta para ganhar nada.
//
// SOMENTE LEITURA. Nenhuma escrita, nenhuma migration. O `.env.local` deste
// repositório aponta para o Supabase de PRODUÇÃO.
// ---------------------------------------------------------------------------

import { getAuthProfile, resolveTenantId } from "@/lib/auth"
import { createServiceClient } from "@/lib/supabase/service"
import { redirect } from "next/navigation"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PERIODOS_VALIDOS = new Set([7, 30, 90])
const PERIODO_PADRAO_DIAS = 30

export type ClienteServico = ReturnType<typeof createServiceClient>

export interface RecorteAutogestao {
  db: ClienteServico
  studentId: string
  studentNome: string
  tenantId: string
  courseId: string
  periodoDias: 7 | 30 | 90
  agora: Date
}

export type ResultadoRecorteAutogestao =
  | { ok: true; recorte: RecorteAutogestao }
  /** §31 "Sem plano individual" nasce daqui quando não há NENHUMA matrícula —
   *  o caso ainda mais amplo do que "sem plano": não há sequer curso a ler. */
  | { ok: false; motivo: "sem-matricula" }

function lerPeriodo(bruto: string | undefined): 7 | 30 | 90 {
  const numero = bruto ? Number.parseInt(bruto, 10) : PERIODO_PADRAO_DIAS
  return (PERIODOS_VALIDOS.has(numero) ? numero : PERIODO_PADRAO_DIAS) as 7 | 30 | 90
}

/**
 * `agora` injetado na borda, nunca dentro da montagem (mesmo padrão de
 * `_contexto.ts`). `?agora=` só é honrado FORA de produção — é o relógio fixo
 * que o `/gauntlet-2` usa para provar as linhas do CONTRATO-DE-DADOS.md.
 */
function resolverAgora(bruto: string | undefined): Date {
  if (process.env.NODE_ENV === "production") return new Date()
  if (!bruto) return new Date()
  const parsed = new Date(bruto)
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

/**
 * Resolve tudo que as três abas da Autogestão precisam antes de ler um número:
 * quem é o usuário, qual tenant, qual curso, qual período e qual relógio.
 *
 * `redirect()` lança — o retorno abaixo só existe quando o gate passou.
 */
export async function resolverRecorteAutogestao(
  params: Record<string, string | undefined>,
): Promise<ResultadoRecorteAutogestao> {
  const { user, profile, supabase } = await getAuthProfile()
  if (!user || !profile) return redirect("/login")

  const tenantId = await resolveTenantId(profile.tenant_id)
  if (!tenantId) return redirect("/dashboard")

  // N.4 — `studentId` é SEMPRE `user.id`. Nenhum parâmetro de query é lido
  // como identidade alternativa; é essa ausência estrutural que impede um
  // gestor de alcançar a leitura íntima da jornada de outro aluno por aqui.
  const studentId = user.id
  const studentNome = (profile as { full_name?: string | null }).full_name ?? "Você"

  // Resolução de curso — cliente AUTENTICADO (RLS: o aluno só enxerga as
  // próprias matrículas), mesma consulta de `resolverCursoDoAluno` em
  // `_contexto.ts`. `?curso=` só ancora se o aluno estiver de fato
  // matriculado nele; ausente ⇒ a matrícula mais recente (determinístico).
  const { data: rows } = await supabase
    .from("enrollments")
    .select("course_id, created_at, courses!inner(status)")
    .eq("student_id", studentId)
    .in("status", ["active", "completed"])
    .is("deleted_at", null)
    .neq("courses.status", "archived")
    .order("created_at", { ascending: false })

  const matriculas = (rows ?? []) as Array<{ course_id: string; created_at: string }>
  if (matriculas.length === 0) return { ok: false, motivo: "sem-matricula" }

  const cursoParam = params.curso && UUID_RE.test(params.curso) ? params.curso : undefined
  const courseId =
    cursoParam && matriculas.some((m) => m.course_id === cursoParam)
      ? cursoParam
      : (matriculas[0]?.course_id as string)

  const periodoDias = lerPeriodo(params.periodo)
  const agora = resolverAgora(params.agora)

  // O client de SERVIÇO lê os dados de fato (sessões, progresso, plano) — o
  // mesmo desenho de `_contexto.ts`/rotas, e o mesmo tipo que
  // `fonte-supabase.ts` exige (`ClienteLeitura = ReturnType<typeof
  // createServiceClient>`).
  const db = createServiceClient()

  return {
    ok: true,
    recorte: { db, studentId, studentNome, tenantId, courseId, periodoDias, agora },
  }
}
