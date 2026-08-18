// ---------------------------------------------------------------------------
// Base de cálculo do Mapa da jornada — o que os seis blocos compartilham.
// ---------------------------------------------------------------------------
// Existe UM roster, UMA lista de colunas e UMA matriz de células. Os seis
// blocos derivam daí, e é isso que impede o funil (§27) de discordar do mapa
// (§23) que está ao lado dele na mesma tela — dois caminhos para "quem iniciou
// o módulo 5" divergem em silêncio no dia em que um empate mudar.
//
// FUNÇÃO PURA: recebe `agoraMs` de fora, nunca chama `Date.now()`. É o que
// permite testar o par 14/15 dias e a invariância a fuso sem mock de relógio.
//
// TRÊS DECISÕES DECLARADAS (a régua exige que estejam escritas, não inferidas):
//
//  1. `moduloCorrente` = PRIMEIRO módulo não-concluído, na ordem de F-02, e NÃO
//     `whereStoppedChapterIdOf` (que devolve o capítulo da atividade mais
//     recente). Quem abandonou o módulo 3 e depois abriu o 7 por curiosidade
//     apareceria como gargalo do 7. O gargalo é sobre avanço BLOQUEADO.
//  2. O `progress` que alimenta "atrasado" vem da MATRIZ (percorrido), não de
//     `enrollments.progress` — achado A-4: aquele campo é `{}` nas linhas reais
//     e mediria o clique no botão "Módulo Concluído", não leitura.
//  3. "Matriculado" para efeito de universo é toda matrícula com
//     `status !== 'cancelled'`. Cancelada não dá acesso, e contá-la inflaria o
//     denominador de "Chegaram" (F-22) com quem não pode abrir o módulo.
// ---------------------------------------------------------------------------

import {
  iniciaisDe,
  projetarEstado,
  retomouNaJanela,
  tomDoAvatar,
} from "@/lib/analytics/visao-geral/base"
import { diasUtcEntre, janelasComparaveis } from "@/lib/analytics/visao-geral/dia-utc"
import type { EstadoJornada, Tom } from "@/lib/analytics/visao-geral/tipos"
import { computeBehindAndProgress } from "@/lib/notifications/engagement-triage"
import { SEM_ACESSO_DAYS } from "@/lib/student-triage"
import {
  capitulosComEvidenciaPorAluno,
  capitulosComSessaoPorAluno,
  indexarSlides,
  pisosDeSlidePorAluno,
  totalDeSlidesPorCapitulo,
} from "./evidencia"
import type { FonteMapaJornada } from "./fonte"
import { percorridoPorCapitulo } from "./percorrido"
import type { ColunaModulo, EstadoCelula } from "./tipos"

export interface BaseMapa {
  agoraMs: number
  periodoDias: number
  janelas: ReturnType<typeof janelasComparaveis>
  /** O universo, congelado. Denominador de F-09, F-16, F-27, F-28, F-29. */
  roster: readonly string[]
  nomePorAluno: ReadonlyMap<string, string>
  iniciaisPorAluno: ReadonlyMap<string, string>
  tomAvatarPorAluno: ReadonlyMap<string, Tom>
  /** F-02 · colunas na ordem determinística, com rótulo 1-based. */
  colunas: readonly ColunaModulo[]
  tituloPorCapitulo: ReadonlyMap<string, string>
  numeroPorCapitulo: ReadonlyMap<string, number>
  cursoPorCapitulo: ReadonlyMap<string, string>
  tituloPorCurso: ReadonlyMap<string, string>
  /** Capítulos (publicados) da trilha de cada aluno. */
  capitulosDoAluno: ReadonlyMap<string, ReadonlySet<string>>
  cursosDoAluno: ReadonlyMap<string, ReadonlySet<string>>
  /** F-03/F-04/F-05 · o estado de cada célula. Toda coluna tem entrada. */
  celulaPorAluno: ReadonlyMap<string, ReadonlyMap<string, EstadoCelula>>
  /** Carimbos de atividade em qualquer lugar (F-20). */
  carimbosPorAluno: ReadonlyMap<string, readonly number[]>
  /** Carimbos POR MÓDULO (F-19: "Parado há" é por ponto, não por plataforma). */
  carimbosPorAlunoModulo: ReadonlyMap<string, ReadonlyMap<string, readonly number[]>>
  ultimaAtividadeMsPorAluno: ReadonlyMap<string, number>
  diasSemAtividadePorAluno: ReadonlyMap<string, number | null>
  estadoPorAluno: ReadonlyMap<string, EstadoJornada>
  atrasados: ReadonlySet<string>
  /** F-08 · primeiro módulo NÃO concluído. Ausente quando concluiu tudo. */
  moduloCorrentePorAluno: ReadonlyMap<string, string>
  /** F-12 · todas as células da linha são verdes. */
  concluiramTudo: ReadonlySet<string>
  /** F-15 · todas as células da linha são cinzas. */
  naoIniciaram: ReadonlySet<string>
}

const PUBLICADO = "published"

function carimbosDe(...isos: readonly (string | null | undefined)[]): number[] {
  const out: number[] = []
  for (const iso of isos) {
    if (!iso) continue
    const t = new Date(iso).getTime()
    if (!Number.isNaN(t)) out.push(t)
  }
  return out
}

export function montarBaseMapa(fonte: FonteMapaJornada): BaseMapa {
  const janelas = janelasComparaveis(fonte.agoraMs, fonte.periodoDias)
  const roster = fonte.alunos.map((a) => a.id)
  const noRoster = new Set(roster)

  const nomePorAluno = new Map<string, string>()
  const iniciaisPorAluno = new Map<string, string>()
  const tomAvatarPorAluno = new Map<string, Tom>()
  for (const a of fonte.alunos) {
    const nome = a.report_name?.trim() || a.full_name?.trim() || "Sem nome"
    const iniciais = iniciaisDe(nome)
    nomePorAluno.set(a.id, nome)
    iniciaisPorAluno.set(a.id, iniciais)
    tomAvatarPorAluno.set(a.id, tomDoAvatar(iniciais))
  }

  // --- matrículas: universo de cursos por pessoa --------------------------
  const matriculasValidas = fonte.matriculas.filter(
    (m) => noRoster.has(m.student_id) && m.status !== "cancelled",
  )
  const cursosDoAluno = new Map<string, Set<string>>()
  for (const m of matriculasValidas) {
    const cursos = cursosDoAluno.get(m.student_id) ?? new Set<string>()
    cursos.add(m.course_id)
    cursosDoAluno.set(m.student_id, cursos)
  }
  const cursosDoRecorte = new Set(matriculasValidas.map((m) => m.course_id))

  // --- F-02 colunas -------------------------------------------------------
  // Filtro `published` aplicado em memória, declarado mesmo sendo hoje inerte
  // (achado A-5: 95 de 95 capítulos são `published`). A coluna não pode começar
  // a mentir no dia em que alguém despublicar um capítulo.
  const capitulosPublicados = fonte.capitulos
    .filter((c) => cursosDoRecorte.has(c.course_id))
    .filter((c) => c.status === null || c.status === PUBLICADO)

  const ordenados = [...capitulosPublicados].sort((a, b) => {
    if (a.course_id !== b.course_id) return a.course_id < b.course_id ? -1 : 1
    return (a.order ?? 0) - (b.order ?? 0)
  })

  const colunas: ColunaModulo[] = ordenados.map((c) => ({
    id: c.id,
    numero: (c.order ?? 0) + 1,
    titulo: c.title?.trim() || "Sem título",
    cursoId: c.course_id,
  }))

  const tituloPorCapitulo = new Map(colunas.map((c) => [c.id, c.titulo]))
  const numeroPorCapitulo = new Map(colunas.map((c) => [c.id, c.numero]))
  const cursoPorCapitulo = new Map(colunas.map((c) => [c.id, c.cursoId]))
  const chapterOrderById = new Map(ordenados.map((c) => [c.id, c.order ?? 0]))
  const tituloPorCurso = new Map(fonte.cursos.map((c) => [c.id, c.title?.trim() || "Sem título"]))

  const chapterIdsByCourse = new Map<string, string[]>()
  for (const c of colunas) {
    const lista = chapterIdsByCourse.get(c.cursoId) ?? []
    lista.push(c.id)
    chapterIdsByCourse.set(c.cursoId, lista)
  }

  const capitulosDoAluno = new Map<string, Set<string>>()
  for (const alunoId of roster) {
    const conjunto = new Set<string>()
    for (const cursoId of cursosDoAluno.get(alunoId) ?? []) {
      for (const capituloId of chapterIdsByCourse.get(cursoId) ?? []) conjunto.add(capituloId)
    }
    capitulosDoAluno.set(alunoId, conjunto)
  }

  // --- evidência e percorrido --------------------------------------------
  const slideById = indexarSlides(fonte.slides)
  const slidesTotalByChapter = totalDeSlidesPorCapitulo(fonte.slides)
  const sessoesNoRoster = fonte.sessoes.filter((s) => noRoster.has(s.student_id))
  const reflexoesNoRoster = fonte.reflexoes.filter((r) => noRoster.has(r.student_id))
  const percorridoNoRoster = fonte.percorrido.filter((p) => noRoster.has(p.student_id))

  const sessoesPorAluno = capitulosComSessaoPorAluno(sessoesNoRoster)
  const pisosPorAluno = pisosDeSlidePorAluno(reflexoesNoRoster, slideById)

  const capitulosComLinhaPorAluno = new Map<string, Set<string>>()
  for (const p of percorridoNoRoster) {
    const conjunto = capitulosComLinhaPorAluno.get(p.student_id) ?? new Set<string>()
    conjunto.add(p.chapter_id)
    capitulosComLinhaPorAluno.set(p.student_id, conjunto)
  }

  const evidenciaPorAluno = capitulosComEvidenciaPorAluno({
    percorridoPorAluno: capitulosComLinhaPorAluno,
    sessoesPorAluno,
    pisosPorAluno,
  })

  const percorrido = percorridoPorCapitulo({
    alunoIds: roster,
    linhas: percorridoNoRoster,
    sessoesPorAluno,
    pisosPorAluno,
    capitulosDoAluno,
    cursosDoAluno,
    chapterOrderById,
    chapterIdsByCourse,
    slidesTotalByChapter,
  })

  // --- F-03/F-04/F-05 a matriz -------------------------------------------
  const celulaPorAluno = new Map<string, Map<string, EstadoCelula>>()
  for (const alunoId of roster) {
    const daPessoa = new Map<string, EstadoCelula>()
    const pcts = percorrido.get(alunoId)
    const evidencias = evidenciaPorAluno.get(alunoId)
    const trilha = capitulosDoAluno.get(alunoId)
    for (const coluna of colunas) {
      if (!trilha?.has(coluna.id)) {
        daPessoa.set(coluna.id, "nao-iniciado")
        continue
      }
      const pct = pcts?.get(coluna.id)
      if (pct !== undefined && pct >= 100) {
        daPessoa.set(coluna.id, "concluido")
        continue
      }
      const temEvidencia = evidencias?.has(coluna.id) === true || pct !== undefined
      daPessoa.set(coluna.id, temEvidencia ? "em-andamento" : "nao-iniciado")
    }
    celulaPorAluno.set(alunoId, daPessoa)
  }

  // --- carimbos: globais (F-20) e por módulo (F-19) ----------------------
  const carimbosPorAluno = new Map<string, number[]>()
  const carimbosPorAlunoModulo = new Map<string, Map<string, number[]>>()

  const empurrar = (alunoId: string, capituloId: string | null, ts: readonly number[]) => {
    if (!noRoster.has(alunoId) || ts.length === 0) return
    const global = carimbosPorAluno.get(alunoId) ?? []
    global.push(...ts)
    carimbosPorAluno.set(alunoId, global)
    if (capituloId === null) return
    const porModulo = carimbosPorAlunoModulo.get(alunoId) ?? new Map<string, number[]>()
    const lista = porModulo.get(capituloId) ?? []
    lista.push(...ts)
    porModulo.set(capituloId, lista)
    carimbosPorAlunoModulo.set(alunoId, porModulo)
  }

  for (const s of sessoesNoRoster) {
    empurrar(s.student_id, s.chapter_id, carimbosDe(s.created_at, s.updated_at))
  }
  for (const r of reflexoesNoRoster) {
    const slide = r.slide_id ? slideById.get(r.slide_id) : undefined
    empurrar(r.student_id, slide?.chapterId ?? null, carimbosDe(r.created_at, r.updated_at))
  }
  for (const p of percorridoNoRoster) {
    empurrar(p.student_id, p.chapter_id, carimbosDe(p.last_viewed_at))
  }

  const ultimaAtividadeMsPorAluno = new Map<string, number>()
  for (const [alunoId, ts] of carimbosPorAluno) {
    if (ts.length > 0) ultimaAtividadeMsPorAluno.set(alunoId, Math.max(...ts))
  }

  // --- progresso derivado da MATRIZ, e o atraso canônico -----------------
  const progressoPorAluno = new Map<string, number>()
  for (const alunoId of roster) {
    const trilha = capitulosDoAluno.get(alunoId)
    const celulas = celulaPorAluno.get(alunoId)
    const total = trilha?.size ?? 0
    if (!trilha || total === 0 || !celulas) {
      progressoPorAluno.set(alunoId, 0)
      continue
    }
    let verdes = 0
    for (const capituloId of trilha) {
      if (celulas.get(capituloId) === "concluido") verdes++
    }
    progressoPorAluno.set(alunoId, Math.round((verdes / total) * 100))
  }

  const { behind } = computeBehindAndProgress(
    matriculasValidas.map((m) => ({
      student_id: m.student_id,
      status: m.status,
      created_at: m.created_at,
      progress: { percentage: progressoPorAluno.get(m.student_id) ?? 0 },
      course_id: m.course_id,
    })),
    new Map(fonte.cursos.map((c) => [c.id, c.deadline_days])),
    fonte.agoraMs,
  )

  // --- linha inteira verde / inteira cinza -------------------------------
  const concluiramTudo = new Set<string>()
  const naoIniciaram = new Set<string>()
  for (const alunoId of roster) {
    const trilha = capitulosDoAluno.get(alunoId)
    const celulas = celulaPorAluno.get(alunoId)
    if (!trilha || trilha.size === 0 || !celulas) {
      // Sem trilha não há como afirmar conclusão; também não há como afirmar
      // que "não iniciou o curso". Fica fora dos dois conjuntos, e o
      // fechamento da partição (F-16) o recolhe em "Em andamento"/"Travados"
      // pelo carimbo de atividade.
      continue
    }
    let verdes = 0
    let cinzas = 0
    for (const capituloId of trilha) {
      const estado = celulas.get(capituloId)
      if (estado === "concluido") verdes++
      else if (estado === "nao-iniciado") cinzas++
    }
    if (verdes === trilha.size) concluiramTudo.add(alunoId)
    if (cinzas === trilha.size) naoIniciaram.add(alunoId)
  }

  // --- estado da pessoa (§4, projeção canônica) --------------------------
  const diasSemAtividadePorAluno = new Map<string, number | null>()
  const estadoPorAluno = new Map<string, EstadoJornada>()
  for (const alunoId of roster) {
    const ts = carimbosPorAluno.get(alunoId) ?? []
    const ultima = ultimaAtividadeMsPorAluno.get(alunoId)
    const dias = ultima === undefined ? null : diasUtcEntre(ultima, fonte.agoraMs)
    diasSemAtividadePorAluno.set(alunoId, dias)
    estadoPorAluno.set(
      alunoId,
      projetarEstado({
        naoIniciou: naoIniciaram.has(alunoId) && ts.length === 0,
        concluiu: concluiramTudo.has(alunoId),
        retomouNoPeriodo: retomouNaJanela(ts, janelas.atualInicio, janelas.atualFim),
        diasSemAtividade: dias,
        atrasado: behind.has(alunoId),
      }),
    )
  }

  // --- F-08 módulo corrente: PRIMEIRO não-concluído ----------------------
  const moduloCorrentePorAluno = new Map<string, string>()
  for (const alunoId of roster) {
    const trilha = capitulosDoAluno.get(alunoId)
    const celulas = celulaPorAluno.get(alunoId)
    if (!trilha || !celulas) continue
    for (const coluna of colunas) {
      if (!trilha.has(coluna.id)) continue
      if (celulas.get(coluna.id) !== "concluido") {
        moduloCorrentePorAluno.set(alunoId, coluna.id)
        break
      }
    }
  }

  return {
    agoraMs: fonte.agoraMs,
    periodoDias: fonte.periodoDias,
    janelas,
    roster,
    nomePorAluno,
    iniciaisPorAluno,
    tomAvatarPorAluno,
    colunas,
    tituloPorCapitulo,
    numeroPorCapitulo,
    cursoPorCapitulo,
    tituloPorCurso,
    capitulosDoAluno,
    cursosDoAluno,
    celulaPorAluno,
    carimbosPorAluno,
    carimbosPorAlunoModulo,
    ultimaAtividadeMsPorAluno,
    diasSemAtividadePorAluno,
    estadoPorAluno,
    atrasados: behind,
    moduloCorrentePorAluno,
    concluiramTudo,
    naoIniciaram,
  }
}

/** §4/F-14: "Parado" é `> SEM_ACESSO_DAYS`, nunca `>=` (15 conta, 14 não). */
export function estaSemAtividade(dias: number | null): boolean {
  return dias === null || dias > SEM_ACESSO_DAYS
}
