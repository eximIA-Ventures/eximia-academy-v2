// ---------------------------------------------------------------------------
// Contexto comum das 3 rotas da Autogestão da minha Jornada.
// ---------------------------------------------------------------------------
// As três rotas (`visao-geral`, `padroes`, `mapa`) são cascas finas: autenticam,
// resolvem (aluno, curso, período, relógio) e delegam para `fonte-supabase.ts`
// + o montador puro correspondente. Esta resolução é a ÚNICA coisa que as três
// repetiriam igual — por isso vive aqui, uma vez, e não em cada `route.ts`.
//
// N.4 do `CONTRATO-DE-DADOS.md`: o aluno só lê a PRÓPRIA jornada. `studentId`
// vem SEMPRE de `auth.uid()` — um `?studentId=` de query é lido só para nunca
// ser usado, nunca para substituir o dono da sessão (spec §30: o gestor nunca
// alcança a leitura íntima da jornada de outro aluno por esta via).
// ---------------------------------------------------------------------------

import type {
  ChaveFonteAutogestao,
  FalhasPorFonteAutogestao,
} from "@/lib/analytics/autogestao/fonte"
import { primeiraFalha } from "@/lib/analytics/autogestao/fonte"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

const TODAS_AS_CHAVES_DA_FONTE: readonly ChaveFonteAutogestao[] = [
  "sessoes",
  "reflexoes",
  "progresso",
  "capitulos",
  "plano",
]

type AuthedSupabase = Awaited<ReturnType<typeof createClient>>

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PERIODOS_VALIDOS = new Set([7, 30, 90])
const PERIODO_PADRAO_DIAS = 30

export type ContextoAutogestao =
  | { ok: false; response: NextResponse }
  | {
      ok: true
      studentId: string
      tenantId: string
      courseId: string
      periodoDias: 7 | 30 | 90
      agora: Date
    }

type ResolucaoCurso =
  | { ok: true; courseId: string }
  | { ok: false; motivo: "curso-invalido" | "nao-matriculado" | "sem-matricula" }

/**
 * Resolve o curso da Autogestão para o aluno (spec §4.1: mais de uma matrícula
 * ativa exige seleção específica). `cursoParam` (`?curso=`) ancora NAQUELE
 * curso quando o aluno está de fato matriculado nele — nunca confia cegamente
 * no parâmetro; ausente → a matrícula mais recente entre as ativas/concluídas
 * (critério determinístico, não corrida: `order("created_at", {ascending:false})`).
 */
async function resolverCursoDoAluno(
  supabase: AuthedSupabase,
  studentId: string,
  cursoParam: string | null,
): Promise<ResolucaoCurso> {
  if (cursoParam && !UUID_RE.test(cursoParam)) return { ok: false, motivo: "curso-invalido" }

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

  if (cursoParam) {
    const encontrada = matriculas.some((m) => m.course_id === cursoParam)
    return encontrada
      ? { ok: true, courseId: cursoParam }
      : { ok: false, motivo: "nao-matriculado" }
  }

  return { ok: true, courseId: matriculas[0]?.course_id as string }
}

function periodoDiasDaQuery(periodoParam: string | null): 7 | 30 | 90 {
  const numero = periodoParam ? Number.parseInt(periodoParam, 10) : PERIODO_PADRAO_DIAS
  return (PERIODOS_VALIDOS.has(numero) ? numero : PERIODO_PADRAO_DIAS) as 7 | 30 | 90
}

/**
 * `agora` é injetado na borda (aqui), nunca dentro da montagem. `?agora=<ISO>`
 * só existe FORA de produção — é o relógio fixo que o /gauntlet-2 usa para
 * provar as linhas do `CONTRATO-DE-DADOS.md` (ex.: 1.6, "com clock injetado").
 * Em produção o parâmetro nem é lido: `new Date()` é sempre o relógio real.
 */
function resolverAgora(agoraParam: string | null): Date {
  if (process.env.NODE_ENV === "production") return new Date()
  if (!agoraParam) return new Date()
  const parsed = new Date(agoraParam)
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

export async function resolverContextoAutogestao(request: Request): Promise<ContextoAutogestao> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single()

  if (profileError) {
    console.error("Failed to fetch profile:", profileError.message)
    return {
      ok: false,
      response: NextResponse.json({ error: "Internal server error" }, { status: 500 }),
    }
  }
  if (!profile || profile.role !== "student" || !profile.tenant_id) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  const { searchParams } = new URL(request.url)

  // N.4 — `?studentId=` é lido aqui só para nunca ser usado. O dono da leitura
  // é SEMPRE `user.id` (auth.uid()), nunca um parâmetro de query.
  const _studentIdDeQueryJamaisHonrado = searchParams.get("studentId")
  void _studentIdDeQueryJamaisHonrado
  const studentId = user.id

  const periodoDias = periodoDiasDaQuery(searchParams.get("periodo"))

  const resolucaoCurso = await resolverCursoDoAluno(supabase, studentId, searchParams.get("curso"))
  if (!resolucaoCurso.ok) {
    const status = resolucaoCurso.motivo === "curso-invalido" ? 400 : 404
    const mensagem =
      resolucaoCurso.motivo === "curso-invalido"
        ? "ID de curso inválido"
        : resolucaoCurso.motivo === "sem-matricula"
          ? "Nenhuma matrícula encontrada"
          : "Curso não encontrado"
    return { ok: false, response: NextResponse.json({ error: mensagem }, { status }) }
  }

  const agora = resolverAgora(searchParams.get("agora"))

  return {
    ok: true,
    studentId,
    tenantId: profile.tenant_id,
    courseId: resolucaoCurso.courseId,
    periodoDias,
    agora,
  }
}

/**
 * Requisito inegociável nº4: erro de consulta é LIDO, nunca engolido. Falha em
 * qualquer uma das 5 fontes (`sessoes`/`reflexoes`/`progresso`/`capitulos`/
 * `plano`) devolve 500 com o motivo — nunca um objeto vazio que a tela
 * renderizaria como zero. `null` quando não há falha (rota segue para a
 * montagem).
 */
export function respostaDeFalhaDaFonte(falhas: FalhasPorFonteAutogestao): NextResponse | null {
  const falha = primeiraFalha(falhas, TODAS_AS_CHAVES_DA_FONTE)
  if (!falha) return null
  return NextResponse.json({ error: falha.mensagem, codigo: falha.codigo }, { status: 500 })
}
