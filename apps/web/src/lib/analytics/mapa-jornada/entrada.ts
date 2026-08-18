// ---------------------------------------------------------------------------
// Entrada PURA do Mapa da jornada — a mesma tela, sem Supabase no caminho.
// ---------------------------------------------------------------------------
// Duas portas para o MESMO cálculo, e as duas desembocam em `montarMapaJornada`:
//
//   • `carregarMapaJornada(...)` — produção: lê o banco e monta.
//   • `computeMapaJornada(entrada)` — dado bruto já em mãos: só monta.
//
// A segunda existe para o cálculo ser exercitado com dado sintético sem mock de
// cliente Supabase. NÃO é um caminho paralelo de implementação: o adaptador só
// troca a FORMA da linha (camelCase → nomes de coluna) e a partir daí é
// byte-a-byte o mesmo código que a produção executa. Se divergisse, os testes
// estariam medindo uma segunda implementação — que é exatamente o defeito que
// um verificador desses existe para pegar.
// ---------------------------------------------------------------------------

import type {
  FonteMapaJornada,
  LinhaCapituloMapa,
  LinhaCursoMapa,
  LinhaMatriculaMapa,
  LinhaPercorridoMapa,
  LinhaReflexaoMapa,
  LinhaSessaoMapa,
  LinhaSlideMapa,
} from "./fonte"
import { SEM_FALHAS_MAPA } from "./fonte"
import { type ContextoDeTelaMapa, montarMapaJornada } from "./montagem"
import type { MapaJornadaDados } from "./tipos"

export interface AlunoBrutoMapa {
  id: string
  nome: string
}

export interface CursoBrutoMapa {
  id: string
  titulo: string
  deadlineDays: number | null
}

export interface CapituloBrutoMapa {
  id: string
  cursoId: string
  titulo: string
  /** 0-based, como `chapters."order"` no schema. O rótulo da coluna é +1. */
  ordem: number
  status?: string
}

export interface SlideBrutoMapa {
  id: string
  capituloId: string
  ordem: number
}

export interface MatriculaBrutaMapa {
  alunoId: string
  cursoId: string
  status: "active" | "completed" | "cancelled"
  criadaEmISO: string
}

export interface PercorridoBrutoMapa {
  alunoId: string
  capituloId: string
  maxSlideIndex: number
  slidesTotalNaPassagem: number
  chegouAoFimISO?: string | null
  ultimaVistaISO?: string | null
}

export interface SessaoBrutaMapa {
  alunoId: string
  capituloId: string | null
  status?: string
  criadaEmISO: string
  atualizadaEmISO?: string | null
}

export interface ReflexaoBrutaMapa {
  alunoId: string
  slideId: string | null
  criadaEmISO: string
  atualizadaEmISO?: string | null
}

export interface EntradaMapaJornada {
  agoraISO: string
  periodoDias: number
  /** Recorte já resolvido. Esta camada obedece o escopo, nunca o inventa. */
  escopo: readonly string[]
  alunos: readonly AlunoBrutoMapa[]
  cursos: readonly CursoBrutoMapa[]
  capitulos: readonly CapituloBrutoMapa[]
  slides: readonly SlideBrutoMapa[]
  matriculas: readonly MatriculaBrutaMapa[]
  percorrido?: readonly PercorridoBrutoMapa[]
  sessoes?: readonly SessaoBrutaMapa[]
  reflexoes?: readonly ReflexaoBrutaMapa[]
  tenantId?: string
  contexto?: Partial<ContextoDeTelaMapa>
}

const CONTEXTO_PADRAO: ContextoDeTelaMapa = { cursoFiltroNome: null }

/** Converte a entrada bruta na MESMA `FonteMapaJornada` que a leitura produz. */
export function fonteDaEntradaMapa(entrada: EntradaMapaJornada): FonteMapaJornada {
  const agoraMs = Date.parse(entrada.agoraISO)
  const escopo = new Set(entrada.escopo)

  const cursos: LinhaCursoMapa[] = entrada.cursos.map((c) => ({
    id: c.id,
    title: c.titulo,
    deadline_days: c.deadlineDays,
  }))

  const capitulos: LinhaCapituloMapa[] = entrada.capitulos.map((c) => ({
    id: c.id,
    course_id: c.cursoId,
    title: c.titulo,
    order: c.ordem,
    status: c.status ?? "published",
  }))

  const slides: LinhaSlideMapa[] = entrada.slides.map((s) => ({
    id: s.id,
    chapter_id: s.capituloId,
    order: s.ordem,
  }))

  const matriculas: LinhaMatriculaMapa[] = entrada.matriculas
    .filter((m) => escopo.has(m.alunoId))
    .map((m) => ({
      student_id: m.alunoId,
      course_id: m.cursoId,
      status: m.status,
      created_at: m.criadaEmISO,
    }))

  const percorrido: LinhaPercorridoMapa[] = (entrada.percorrido ?? [])
    .filter((p) => escopo.has(p.alunoId))
    .map((p) => ({
      student_id: p.alunoId,
      chapter_id: p.capituloId,
      max_slide_index: p.maxSlideIndex,
      slides_total_at_last_view: p.slidesTotalNaPassagem,
      reached_last_slide_at: p.chegouAoFimISO ?? null,
      last_viewed_at: p.ultimaVistaISO ?? null,
    }))

  const sessoes: LinhaSessaoMapa[] = (entrada.sessoes ?? [])
    .filter((s) => escopo.has(s.alunoId))
    .map((s) => ({
      student_id: s.alunoId,
      chapter_id: s.capituloId,
      status: s.status ?? "active",
      created_at: s.criadaEmISO,
      updated_at: s.atualizadaEmISO ?? null,
    }))

  const reflexoes: LinhaReflexaoMapa[] = (entrada.reflexoes ?? [])
    .filter((r) => escopo.has(r.alunoId))
    .map((r) => ({
      student_id: r.alunoId,
      slide_id: r.slideId,
      created_at: r.criadaEmISO,
      updated_at: r.atualizadaEmISO ?? null,
    }))

  return {
    tenantId: entrada.tenantId ?? "",
    escopoAlunoIds: [...entrada.escopo],
    agoraMs,
    periodoDias: entrada.periodoDias,
    alunos: entrada.alunos
      .filter((a) => escopo.has(a.id))
      .map((a) => ({ id: a.id, full_name: a.nome, report_name: null })),
    matriculas,
    cursos,
    capitulos,
    slides,
    percorrido,
    sessoes,
    reflexoes,
    falhas: SEM_FALHAS_MAPA,
  }
}

/** A tela inteira a partir de dado bruto em mãos. Puro e determinístico. */
export function computeMapaJornada(entrada: EntradaMapaJornada): MapaJornadaDados {
  return montarMapaJornada(fonteDaEntradaMapa(entrada), {
    ...CONTEXTO_PADRAO,
    ...entrada.contexto,
  })
}
