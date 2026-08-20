// ---------------------------------------------------------------------------
// Mapa da jornada — a ÚNICA camada que fala com o Supabase. Somente leitura.
// ---------------------------------------------------------------------------
// INVARIANTE I-4 (F-32), e é o motivo de este arquivo existir separado: toda
// leitura desestrutura `error` e o transforma em valor. `supabase-js` devolve
// `{ data, error }` em vez de LANÇAR, então um `const { data } = await ...`
// engole a falha, o `error.tsx` do App Router nunca dispara, e a tela apresenta
// um número menor como se fosse fato.
//
// NENHUMA ESCRITA. Nem update, nem insert, nem RPC que mute. O `.env.local`
// deste repo aponta para o Supabase de PRODUÇÃO.
//
// SOBRE `lerPaginado`: o CONTRATO-mapa pede reuso por import do `ler<T>` de
// `visao-geral/fonte-supabase.ts:69`. Ele NÃO é exportado de lá, e editar o
// arquivo da outra tela está fora do escopo desta run (fronteira dura contra
// colisão com o agente que constrói a terceira tela). A função abaixo é a
// MESMA semântica, declarada item a item: lotes de ids, páginas de 1000, e a
// PRIMEIRA falha aborta e vira `FalhaLeitura` — nunca linhas parciais como se
// fossem o conjunto. Divergir daquela semântica é bug, não licença.
// ---------------------------------------------------------------------------

import type { FalhaLeitura } from "@/lib/analytics/visao-geral/tipos"
import type { createServiceClient } from "@/lib/supabase/service"
import type {
  ChaveFonteMapa,
  FalhasPorFonteMapa,
  FonteMapaJornada,
  LinhaAlunoMapa,
  LinhaCapituloMapa,
  LinhaCursoMapa,
  LinhaMatriculaMapa,
  LinhaPercorridoMapa,
  LinhaReflexaoMapa,
  LinhaSessaoMapa,
  LinhaSlideMapa,
} from "./fonte"
import { MAX_PAGINAS, TAMANHO_LOTE_IDS, TAMANHO_PAGINA } from "./parametros"

/** O client de serviço, sem escrever `any` neste arquivo. */
export type ClienteLeituraMapa = ReturnType<typeof createServiceClient>

/** O formato que `supabase-js` devolve, reduzido ao que aqui importa. */
interface RespostaBruta<T> {
  data: T[] | null
  error: { message: string } | null
}

type ConstrutorPagina<T> = (
  de: number,
  ate: number,
  lote: readonly string[] | null,
) => PromiseLike<RespostaBruta<T>>

interface Leitura<T> {
  linhas: T[]
  falha: FalhaLeitura | null
}

function dividirEmLotes(ids: readonly string[], tamanho: number): string[][] {
  const lotes: string[][] = []
  for (let i = 0; i < ids.length; i += tamanho) lotes.push([...ids.slice(i, i + tamanho)])
  return lotes
}

/**
 * Lê exaustivamente, em lotes de ids e em páginas de 1000 linhas.
 * A PRIMEIRA falha aborta e é devolvida. Quem consome só recebe `linhas`
 * quando `falha === null`.
 */
async function lerPaginado<T>(
  chave: ChaveFonteMapa,
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
      const bloco = data ?? []
      linhas.push(...bloco)
      if (bloco.length < TAMANHO_PAGINA) break
    }
  }
  return { linhas, falha: null }
}

export interface ParametrosLeituraMapa {
  db: ClienteLeituraMapa
  tenantId: string
  /**
   * Universo de alunos JÁ resolvido pelo escopo do gestor: `null` = tenant
   * inteiro, `[]` = escopo sem ninguém (fail-closed), `[ids]` = o recorte.
   * Esta camada NÃO resolve escopo — só o obedece.
   */
  escopoAlunoIds: readonly string[] | null
  agoraMs: number
  periodoDias: number
}

/** Lê tudo que o Mapa da jornada precisa. Uma passada, todo erro tratado. */
export async function lerFonteMapaJornada(p: ParametrosLeituraMapa): Promise<FonteMapaJornada> {
  const { db, tenantId, escopoAlunoIds, agoraMs, periodoDias } = p

  const base: Omit<FonteMapaJornada, "falhas"> = {
    tenantId,
    escopoAlunoIds,
    agoraMs,
    periodoDias,
    alunos: [],
    matriculas: [],
    cursos: [],
    capitulos: [],
    slides: [],
    percorrido: [],
    sessoes: [],
    reflexoes: [],
  }

  const falhas: Record<ChaveFonteMapa, FalhaLeitura | null> = {
    roster: null,
    matriculas: null,
    cursos: null,
    capitulos: null,
    slides: null,
    percorrido: null,
    sessoes: null,
    reflexoes: null,
  }

  // Escopo vazio (fail-closed): não há o que ler, e não há falha. Os blocos
  // saem em "vazio" com motivo "sem-escopo", nunca em 0%.
  if (escopoAlunoIds !== null && escopoAlunoIds.length === 0) {
    return { ...base, falhas }
  }

  // --- R1 roster ----------------------------------------------------------
  // MULTI-CHAPÉU: escopo concreto JÁ é o universo com chapéu de aluno.
  // Reaplicar `role='student'` derrubaria quem tem dois chapéus.
  const roster = await lerPaginado<LinhaAlunoMapa>("roster", escopoAlunoIds, (de, ate, lote) => {
    const q = db
      .from("users")
      .select("id, full_name, report_name")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
    return (lote === null ? q.eq("role", "student") : q.in("id", lote)).range(de, ate)
  })
  falhas.roster = roster.falha

  const alunoIds = roster.linhas.map((a) => a.id)
  const escopoEfetivo: readonly string[] | null = escopoAlunoIds ?? alunoIds

  // --- R2 matrículas ------------------------------------------------------
  const matriculas = await lerPaginado<LinhaMatriculaMapa>(
    "matriculas",
    escopoEfetivo,
    (de, ate, lote) =>
      db
        .from("enrollments")
        .select("student_id, course_id, status, created_at")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .in("student_id", lote ?? [])
        .range(de, ate),
  )
  falhas.matriculas = matriculas.falha

  const cursoIds = [...new Set(matriculas.linhas.map((e) => e.course_id))]

  // --- R3 cursos ----------------------------------------------------------
  const cursos = await lerPaginado<LinhaCursoMapa>("cursos", cursoIds, (de, ate, lote) =>
    db
      .from("courses")
      .select("id, title, deadline_days")
      .eq("tenant_id", tenantId)
      .in("id", lote ?? [])
      .range(de, ate),
  )
  falhas.cursos = cursos.falha

  // --- R4 capítulos -------------------------------------------------------
  // `order` é palavra reservada no PostgREST: precisa das aspas no select.
  const capitulos = await lerPaginado<LinhaCapituloMapa>("capitulos", cursoIds, (de, ate, lote) =>
    db
      .from("chapters")
      .select('id, course_id, title, "order", status')
      .eq("tenant_id", tenantId)
      .in("course_id", lote ?? [])
      .range(de, ate),
  )
  falhas.capitulos = capitulos.falha

  const capituloIds = capitulos.linhas.map((c) => c.id)

  // --- R5 slides ----------------------------------------------------------
  const slides = await lerPaginado<LinhaSlideMapa>("slides", capituloIds, (de, ate, lote) =>
    db
      .from("chapter_slides")
      .select('id, chapter_id, "order"')
      .eq("tenant_id", tenantId)
      .in("chapter_id", lote ?? [])
      .range(de, ate),
  )
  falhas.slides = slides.falha

  // --- R6 percorrido ------------------------------------------------------
  const percorrido = await lerPaginado<LinhaPercorridoMapa>(
    "percorrido",
    escopoEfetivo,
    (de, ate, lote) =>
      db
        .from("chapter_view_progress")
        .select(
          "student_id, chapter_id, max_slide_index, slides_total_at_last_view, reached_last_slide_at, last_viewed_at",
        )
        .eq("tenant_id", tenantId)
        .in("student_id", lote ?? [])
        .range(de, ate),
  )
  falhas.percorrido = percorrido.falha

  // --- R7 sessões (LIFETIME, sem filtro de data) --------------------------
  // "Parado há 93 dias" precisa do histórico inteiro: filtrar por janela aqui
  // inventaria "nunca esteve lá" para quem esteve há 90 dias.
  const sessoes = await lerPaginado<LinhaSessaoMapa>("sessoes", escopoEfetivo, (de, ate, lote) =>
    db
      .from("sessions")
      .select("student_id, chapter_id, status, created_at, updated_at")
      .eq("tenant_id", tenantId)
      .in("student_id", lote ?? [])
      .range(de, ate),
  )
  falhas.sessoes = sessoes.falha

  // --- R8 reflexões -------------------------------------------------------
  // I-7 / achado A-6: `response` EXISTE nesta tabela e NÃO entra na projeção.
  const reflexoes = await lerPaginado<LinhaReflexaoMapa>(
    "reflexoes",
    escopoEfetivo,
    (de, ate, lote) =>
      db
        .from("slide_reflections")
        .select("student_id, slide_id, created_at, updated_at")
        .eq("tenant_id", tenantId)
        .in("student_id", lote ?? [])
        .range(de, ate),
  )
  falhas.reflexoes = reflexoes.falha

  return {
    ...base,
    alunos: roster.linhas,
    matriculas: matriculas.linhas,
    cursos: cursos.linhas,
    capitulos: capitulos.linhas,
    slides: slides.linhas,
    percorrido: percorrido.linhas,
    sessoes: sessoes.linhas,
    reflexoes: reflexoes.linhas,
    falhas: falhas as FalhasPorFonteMapa,
  }
}
