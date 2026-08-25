// ---------------------------------------------------------------------------
// Aprendizagem do Time — a ÚNICA camada que fala com o Supabase para a Tela 1.
// Somente leitura. Mesma disciplina de `lib/analytics/visao-geral/fonte-
// supabase.ts`: toda leitura desestrutura `error` e o transforma em
// `FalhaLeitura` — nunca um array parcial silencioso.
//
// NENHUMA ESCRITA aqui. Quem escreve é o pipeline de classificação
// (`lib/analytics/aprendizagem-time/classificador`), sempre via service
// client, fora do caminho de render desta camada.
// ---------------------------------------------------------------------------

import type { createServiceClient } from "@/lib/supabase/service"
import type {
  ChaveFonte,
  FalhasPorFonte,
  FonteAprendizagem,
  LinhaAluno,
  LinhaAvaliacao,
  LinhaCapacidade,
  LinhaConceito,
  LinhaEvidencia,
} from "./fonte"
import { SEM_FALHAS } from "./fonte"
import type { FalhaLeitura } from "./tipos"

export type ClienteLeitura = ReturnType<typeof createServiceClient>

const TAMANHO_PAGINA = 1000
const MAX_PAGINAS = 50
/** `.in()` do PostgREST vai na query string — um escopo grande estoura a URL. */
const TAMANHO_LOTE_IDS = 200

interface RespostaBruta<T> {
  data: T[] | null
  error: { message: string; code?: string } | null
}

function loteDeIds(ids: readonly string[] | null): (readonly string[] | null)[] {
  if (ids === null) return [null]
  if (ids.length === 0) return []
  const lotes: string[][] = []
  for (let i = 0; i < ids.length; i += TAMANHO_LOTE_IDS) {
    lotes.push(ids.slice(i, i + TAMANHO_LOTE_IDS))
  }
  return lotes
}

/** Lê exaustivamente, em lotes de ids (quando aplicável) e páginas de 1000 linhas. */
async function ler<T>(
  chave: ChaveFonte,
  escopoAlunoIds: readonly string[] | null,
  construir: (
    de: number,
    ate: number,
    lote: readonly string[] | null,
  ) => PromiseLike<RespostaBruta<T>>,
): Promise<{ linhas: T[]; falha: FalhaLeitura | null }> {
  const linhas: T[] = []
  for (const lote of loteDeIds(escopoAlunoIds)) {
    for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
      const de = pagina * TAMANHO_PAGINA
      const { data, error } = await construir(de, de + TAMANHO_PAGINA - 1, lote)
      if (error) {
        return {
          linhas: [],
          falha: { codigo: error.code ?? `${chave}-erro`, mensagem: error.message },
        }
      }
      const pedaco = data ?? []
      linhas.push(...pedaco)
      if (pedaco.length < TAMANHO_PAGINA) break
    }
  }
  return { linhas, falha: null }
}

export interface ParametrosLeitura {
  db: ClienteLeitura
  tenantId: string
  escopoAlunoIds: readonly string[] | null
  cursoId: string | null
  agoraMs: number
  periodoDias: number
}

export async function lerFonteAprendizagem(p: ParametrosLeitura): Promise<FonteAprendizagem> {
  const falhas: Record<ChaveFonte, FalhaLeitura | null> = { ...SEM_FALHAS }

  // --- capacidades ativas do tenant, escopadas ao curso quando filtrado -----
  const capacidadesResultado = await ler<{
    id: string
    course_id: string
    title: string
    slug: string
  }>("capacidades", null, (de, ate, _lote) => {
    let q = p.db
      .from("capabilities")
      .select("id, course_id, title, slug")
      .eq("tenant_id", p.tenantId)
      .eq("is_active", true)
      .order("display_order")
      .range(de, ate)
    if (p.cursoId) q = q.eq("course_id", p.cursoId)
    return q
  })
  falhas.capacidades = capacidadesResultado.falha
  const capacidades: LinhaCapacidade[] = capacidadesResultado.linhas.map((r) => ({
    id: r.id,
    courseId: r.course_id,
    title: r.title,
    slug: r.slug,
  }))
  const capacidadeIds = capacidades.map((c) => c.id)

  if (falhas.capacidades || capacidadeIds.length === 0) {
    return {
      tenantId: p.tenantId,
      escopoAlunoIds: p.escopoAlunoIds,
      cursoId: p.cursoId,
      agoraMs: p.agoraMs,
      periodoDias: p.periodoDias,
      capacidades,
      avaliacoes: [],
      evidencias: [],
      conceitos: [],
      alunos: [],
      falhas,
    }
  }

  // --- histórico completo de avaliações das capacidades em escopo -----------
  const avaliacoesResultado = await ler<{
    student_id: string
    capability_id: string
    new_state: LinhaAvaliacao["newState"]
    is_current: boolean
    created_at: string
  }>("avaliacoes", p.escopoAlunoIds, (de, ate, lote) => {
    let q = p.db
      .from("capability_assessments")
      .select("student_id, capability_id, new_state, is_current, created_at")
      .eq("tenant_id", p.tenantId)
      .in("capability_id", capacidadeIds)
      .range(de, ate)
    if (lote) q = q.in("student_id", lote)
    return q
  })
  falhas.avaliacoes = avaliacoesResultado.falha
  const avaliacoes: LinhaAvaliacao[] = avaliacoesResultado.linhas.map((r) => ({
    studentId: r.student_id,
    capabilityId: r.capability_id,
    newState: r.new_state,
    isCurrent: r.is_current,
    createdAtMs: new Date(r.created_at).getTime(),
  }))

  // --- evidências das capacidades em escopo (§7 amostra, §9 métricas) -------
  const evidenciasResultado = await ler<{
    student_id: string
    capability_id: string | null
    concept_id: string | null
    evidence_category: LinhaEvidencia["evidenceCategory"]
    comprehension: LinhaEvidencia["comprehension"]
    depth_level: number | null
    application_level: LinhaEvidencia["applicationLevel"]
    occurred_at: string
  }>("evidencias", p.escopoAlunoIds, (de, ate, lote) => {
    let q = p.db
      .from("capability_evidence")
      .select(
        "student_id, capability_id, concept_id, evidence_category, comprehension, depth_level, application_level, occurred_at",
      )
      .eq("tenant_id", p.tenantId)
      .in("capability_id", capacidadeIds)
      .range(de, ate)
    if (lote) q = q.in("student_id", lote)
    return q
  })
  falhas.evidencias = evidenciasResultado.falha
  const evidencias: LinhaEvidencia[] = evidenciasResultado.linhas.map((r) => ({
    studentId: r.student_id,
    capabilityId: r.capability_id,
    conceptId: r.concept_id,
    evidenceCategory: r.evidence_category,
    comprehension: r.comprehension,
    depthLevel: r.depth_level,
    applicationLevel: r.application_level,
    occurredAtMs: new Date(r.occurred_at).getTime(),
  }))

  // --- conceitos do curso (§21-23 das Telas 2/3 — proxy de "módulo") --------
  // Só faz sentido com um curso escolhido: concepts são escopados a curso, e
  // "Todos os cursos" não pode somar módulos semanticamente diferentes (§4.2,
  // mesma regra já aplicada às capacidades nomeadas).
  let conceitos: LinhaConceito[] = []
  if (p.cursoId) {
    const conceitosResultado = await ler<{ id: string; course_id: string; title: string }>(
      "conceitos",
      null,
      (de, ate, _lote) =>
        p.db
          .from("concepts")
          .select("id, course_id, title")
          .eq("tenant_id", p.tenantId)
          .eq("course_id", p.cursoId as string)
          .eq("is_active", true)
          .order("display_order")
          .range(de, ate),
    )
    falhas.conceitos = conceitosResultado.falha
    conceitos = conceitosResultado.linhas.map((r) => ({
      id: r.id,
      courseId: r.course_id,
      title: r.title,
    }))
  }

  // --- roster do escopo (§33, Tela 3) — mesmo padrão de mapa-jornada -------
  const alunosResultado = await ler<{
    id: string
    full_name: string | null
    report_name: string | null
  }>("alunos", p.escopoAlunoIds, (de, ate, lote) => {
    const q = p.db
      .from("users")
      .select("id, full_name, report_name")
      .eq("tenant_id", p.tenantId)
      .is("deleted_at", null)
    return (lote === null ? q.eq("role", "student") : q.in("id", lote)).range(de, ate)
  })
  falhas.alunos = alunosResultado.falha
  const alunos: LinhaAluno[] = alunosResultado.linhas.map((r) => ({
    id: r.id,
    nome: r.report_name ?? r.full_name ?? r.id,
  }))

  return {
    tenantId: p.tenantId,
    escopoAlunoIds: p.escopoAlunoIds,
    cursoId: p.cursoId,
    agoraMs: p.agoraMs,
    periodoDias: p.periodoDias,
    capacidades,
    avaliacoes,
    evidencias,
    conceitos,
    alunos,
    falhas: falhas as FalhasPorFonte,
  }
}
