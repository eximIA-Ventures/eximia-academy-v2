// ---------------------------------------------------------------------------
// Visão geral — a ÚNICA camada que fala com o Supabase. Somente leitura.
// ---------------------------------------------------------------------------
// INVARIANTE I-4, e é o motivo de este arquivo existir separado: toda leitura
// desestrutura `error` e o transforma em valor. `supabase-js` devolve
// `{ data, error }` em vez de LANÇAR, então um `const { data } = await ...`
// engole a falha, o `error.tsx` do App Router nunca dispara, e a tela apresenta
// um número menor como se fosse fato. É o achado A-1 (79 de 87 páginas de
// `(platform)` fazem exatamente isso).
//
// Consequência prática do mesmo princípio na PAGINAÇÃO: o `fetchAllRows` de
// `api/analytics/aggregate/route.ts:91-107` desestrutura `error` e o DESCARTA
// (`if (error || !data) break`), devolvendo um array parcial indistinguível de
// um completo. Numa métrica de placar isso não é degradação graciosa, é um
// número errado para menos. Aqui o erro interrompe e vira `FalhaLeitura`.
//
// NENHUMA ESCRITA. Nem update, nem insert, nem RPC que mute. O `.env.local`
// deste repo aponta para o Supabase de PRODUÇÃO.
// ---------------------------------------------------------------------------

import type { createServiceClient } from "@/lib/supabase/service"
import { janelasComparaveis } from "./dia-utc"
import type {
  ChaveFonte,
  FalhasPorFonte,
  FonteVisaoGeral,
  LinhaAcionamento,
  LinhaAluno,
  LinhaAtividade,
  LinhaCapitulo,
  LinhaMatricula,
  LinhaParticipacao,
  LinhaSessao,
} from "./fonte"
import { MAX_PAGINAS, TAMANHO_LOTE_IDS, TAMANHO_PAGINA } from "./parametros"
import type { FalhaLeitura } from "./tipos"

/** O client de serviço, sem escrever `any` neste arquivo. */
export type ClienteLeitura = ReturnType<typeof createServiceClient>

/** O formato que `supabase-js` devolve, reduzido ao que aqui importa. */
interface RespostaBruta<T> {
  data: T[] | null
  error: { message: string } | null
}

/**
 * Constrói UMA página da consulta. `lote` é `null` quando a leitura é do tenant
 * inteiro, ou o pedaço de ids do escopo (o `.in()` vai na query string do
 * PostgREST e um escopo grande estoura a URL).
 */
type ConstrutorPagina<T> = (
  de: number,
  ate: number,
  lote: readonly string[] | null,
) => PromiseLike<RespostaBruta<T>>

interface Leitura<T> {
  linhas: T[]
  falha: FalhaLeitura | null
}

/**
 * Lê exaustivamente, em lotes de ids e em páginas de 1000 linhas.
 *
 * A PRIMEIRA falha aborta e é devolvida. Nunca devolve linhas parciais como se
 * fossem o conjunto: quem consome só recebe `linhas` quando `falha === null`.
 */
async function ler<T>(
  chave: ChaveFonte,
  escopo: readonly string[] | null,
  construir: ConstrutorPagina<T>,
): Promise<Leitura<T>> {
  const lotes: (readonly string[] | null)[] =
    escopo === null ? [null] : dividirEmLotes(escopo, TAMANHO_LOTE_IDS)

  const linhas: T[] = []
  for (const lote of lotes) {
    if (lote !== null && lote.length === 0) continue
    for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
      const de = pagina * TAMANHO_PAGINA
      const { data, error } = await construir(de, de + TAMANHO_PAGINA - 1, lote)
      if (error) {
        return { linhas: [], falha: { codigo: chave.toUpperCase(), mensagem: error.message } }
      }
      const pagina_ = data ?? []
      linhas.push(...pagina_)
      if (pagina_.length < TAMANHO_PAGINA) break
    }
  }
  return { linhas, falha: null }
}

function dividirEmLotes(ids: readonly string[], tamanho: number): string[][] {
  const lotes: string[][] = []
  for (let i = 0; i < ids.length; i += tamanho) lotes.push([...ids.slice(i, i + tamanho)])
  return lotes
}

export interface ParametrosLeitura {
  db: ClienteLeitura
  tenantId: string
  /** Gestor dono da tela: filtro dos acionamentos da §12. */
  gestorId: string
  /**
   * Universo de alunos JÁ resolvido pelo escopo do gestor
   * (`resolveEngagementScope`): `null` = tenant inteiro (admin fora do contexto
   * de time), `[]` = escopo sem ninguém (fail-closed), `[ids]` = o recorte.
   * Esta camada NÃO resolve escopo — só o obedece.
   */
  escopoAlunoIds: readonly string[] | null
  agoraMs: number
  periodoDias: number
}

/**
 * Lê tudo que a Visão geral precisa. Uma passada, sem segunda ida ao banco para
 * a janela anterior (ela é fatiada em memória — é assim que I-5 fica estrutural
 * em vez de disciplinar).
 */
export async function lerFonteVisaoGeral(p: ParametrosLeitura): Promise<FonteVisaoGeral> {
  const { db, tenantId, gestorId, escopoAlunoIds, agoraMs, periodoDias } = p
  const janelas = janelasComparaveis(agoraMs, periodoDias)

  const base: Omit<FonteVisaoGeral, "falhas"> = {
    tenantId,
    gestorId,
    escopoAlunoIds,
    agoraMs,
    periodoDias,
    alunos: [],
    sessoes: [],
    reflexoes: [],
    matriculas: [],
    prazoPorCurso: new Map(),
    quizzes: [],
    cenarios: [],
    atividades: [],
    acionamentos: [],
    capitulos: [],
  }

  const falhas: Record<ChaveFonte, FalhaLeitura | null> = {
    roster: null,
    sessoes: null,
    reflexoes: null,
    matriculas: null,
    cursos: null,
    participacao: null,
    acionamentos: null,
    capitulos: null,
  }

  // Escopo vazio (fail-closed): não há o que ler, e não há falha. Os blocos
  // saem em "vazio" com motivo "sem-escopo", nunca em 0%.
  if (escopoAlunoIds !== null && escopoAlunoIds.length === 0) {
    return { ...base, falhas }
  }

  // --- roster -------------------------------------------------------------
  // MULTI-CHAPÉU: quando o escopo é concreto, ele JÁ é o universo com chapéu de
  // aluno (resolveEngagementScope + filterToStudentHat). Reaplicar
  // `role='student'` aqui derrubaria quem tem dois chapéus (gestor+aluno) —
  // mesma correção de engagement-triage.ts:142-153.
  const roster = await ler<LinhaAluno>("roster", escopoAlunoIds, (de, ate, lote) => {
    const q = db
      .from("users")
      .select("id, full_name, report_name")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
    return (lote === null ? q.eq("role", "student") : q.in("id", lote)).range(de, ate)
  })
  falhas.roster = roster.falha

  // --- sessões e reflexões (LIFETIME, sem filtro de data) -----------------
  // "Já iniciou a jornada" (§8.2/§8.5) e "última atividade" precisam do
  // histórico inteiro: filtrar por janela aqui inventaria "nunca acessou" para
  // quem acessou há 40 dias. As janelas são recortadas depois, em memória.
  const sessoes = await ler<LinhaSessao>("sessoes", escopoAlunoIds, (de, ate, lote) => {
    const q = db
      .from("sessions")
      .select("student_id, created_at, updated_at, question_id, chapter_id")
      .eq("tenant_id", tenantId)
    return (lote === null ? q : q.in("student_id", lote)).range(de, ate)
  })
  falhas.sessoes = sessoes.falha

  const reflexoes = await ler<LinhaAtividade>("reflexoes", escopoAlunoIds, (de, ate, lote) => {
    const q = db
      .from("slide_reflections")
      .select("student_id, created_at, updated_at")
      .eq("tenant_id", tenantId)
    return (lote === null ? q : q.in("student_id", lote)).range(de, ate)
  })
  falhas.reflexoes = reflexoes.falha

  // --- matrículas e prazos ------------------------------------------------
  const matriculas = await ler<LinhaMatricula>("matriculas", escopoAlunoIds, (de, ate, lote) => {
    const q = db
      .from("enrollments")
      .select("student_id, status, created_at, progress, course_id")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
    return (lote === null ? q : q.in("student_id", lote)).range(de, ate)
  })
  falhas.matriculas = matriculas.falha

  const cursoIds = [...new Set(matriculas.linhas.map((e) => e.course_id))]
  const prazoPorCurso = new Map<string, number | null>()
  if (cursoIds.length > 0) {
    const cursos = await ler<{ id: string; deadline_days: number | null }>(
      "cursos",
      cursoIds,
      (de, ate, lote) =>
        db
          .from("courses")
          .select("id, deadline_days")
          .eq("tenant_id", tenantId)
          .in("id", lote ?? [])
          .range(de, ate),
    )
    falhas.cursos = cursos.falha
    for (const c of cursos.linhas) prazoPorCurso.set(c.id, c.deadline_days)
  }

  // --- participação (§8.4): as 3 tabelas entram mesmo vazias --------------
  // Medido em produção (2026-08-15) `quiz_attempts`, `scenario_attempts` e
  // `assignment_submissions` têm ZERO linhas. Entram na consulta assim mesmo:
  // a métrica não pode começar a mentir no dia em que encherem.
  const desdeParticipacao = new Date(janelas.anteriorInicio).toISOString()
  const participacoes: LinhaParticipacao[][] = []
  for (const tabela of ["quiz_attempts", "scenario_attempts", "assignment_submissions"] as const) {
    const r = await ler<LinhaParticipacao>("participacao", escopoAlunoIds, (de, ate, lote) => {
      const q = db
        .from(tabela)
        .select("student_id, created_at")
        .eq("tenant_id", tenantId)
        .gte("created_at", desdeParticipacao)
      return (lote === null ? q : q.in("student_id", lote)).range(de, ate)
    })
    if (r.falha) falhas.participacao = r.falha
    participacoes.push(r.linhas)
  }

  // --- acionamentos do GESTOR (§12) ---------------------------------------
  // O filtro por gestor é `context->>'sent_by_manager'`, e não
  // `sender_identity='manager'`: `/api/analytics/manager/nudge` não passa
  // `senderIdentity`, então o engine grava o default `'platform'` — filtrar por
  // ele derrubaria justamente os envios feitos pelo painel do gestor.
  // `campaigns.created_by` também não serve: `campaign_id` é NULL em todo envio
  // individual. Ordem dos predicados: `tenant_id` + `recipient_id` (indexados)
  // antes do filtro em `context`, que não tem índice.
  const acionamentos = await ler<LinhaAcionamento>(
    "acionamentos",
    escopoAlunoIds,
    (de, ate, lote) => {
      const q = db
        .from("notifications")
        .select("recipient_id, sent_at")
        .eq("tenant_id", tenantId)
        .eq("origin", "nudge")
        .eq("channel", "inapp")
        .not("sent_at", "is", null)
        .gte("sent_at", new Date(janelas.atualInicio).toISOString())
        .eq("context->>sent_by_manager", gestorId)
      return (lote === null ? q : q.in("recipient_id", lote)).range(de, ate)
    },
  )
  falhas.acionamentos = acionamentos.falha

  // --- capítulos das sessões (§29 regra A) --------------------------------
  const capituloIds = [
    ...new Set(sessoes.linhas.map((s) => s.chapter_id).filter((id): id is string => id !== null)),
  ]
  const capitulos: LinhaCapitulo[] = []
  if (capituloIds.length > 0) {
    // `order` é palavra reservada no PostgREST: precisa das aspas no select.
    const r = await ler<LinhaCapitulo>("capitulos", capituloIds, (de, ate, lote) =>
      db
        .from("chapters")
        .select('id, course_id, title, "order"')
        .eq("tenant_id", tenantId)
        .in("id", lote ?? [])
        .range(de, ate),
    )
    falhas.capitulos = r.falha
    capitulos.push(...r.linhas)
  }

  return {
    ...base,
    alunos: roster.linhas,
    sessoes: sessoes.linhas,
    reflexoes: reflexoes.linhas,
    matriculas: matriculas.linhas,
    prazoPorCurso,
    quizzes: participacoes[0] ?? [],
    cenarios: participacoes[1] ?? [],
    atividades: participacoes[2] ?? [],
    acionamentos: acionamentos.linhas,
    capitulos,
    falhas: falhas as FalhasPorFonte,
  }
}
