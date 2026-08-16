// ---------------------------------------------------------------------------
// Base de cálculo — TUDO que os seis blocos compartilham, computado UMA vez.
// ---------------------------------------------------------------------------
// Este arquivo é onde I-5 deixa de ser disciplina e vira estrutura. Existe um
// só `roster`, um só `iniciados`, um só mapa de carimbos e UMA duração de
// janela. Como os denominadores entram uma vez e as duas janelas derivam do
// mesmo `duracaoMs`, não há caminho de código capaz de comparar escopos
// diferentes ou durações diferentes — o defeito FORM-07 fica impossível de
// reintroduzir sem editar esta função.
//
// Função PURA: recebe `agoraMs` de fora, nunca chama `Date.now()`. É o que
// permite testar a virada de meia-noite e a invariância a deslocamento no tempo
// sem mock de relógio.
// ---------------------------------------------------------------------------

import { computeBehindAndProgress } from "@/lib/notifications/engagement-triage"
import {
  SEM_ACESSO_DAYS,
  type StudentPace,
  type StudentTriagem,
  type TriageInput,
  computeStudentRitmo,
  computeStudentTriagem,
} from "@/lib/student-triage"
import { chaveDiaUtc, diasUtcEntre, janelasComparaveis, semanasCheias } from "./dia-utc"
import type { FonteVisaoGeral } from "./fonte"
import { MS_SEMANA, REGULARIDADE_MIN_DIAS_NA_SEMANA } from "./parametros"
import type { EstadoJornada, Tom } from "./tipos"

const TONS_AVATAR: readonly Tom[] = ["amber", "blue", "green", "red"]

/** Iniciais de exibição: primeira letra do primeiro e do último nome. */
export function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return "?"
  const primeira = partes[0]?.[0] ?? "?"
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? "") : ""
  return `${primeira}${ultima}`.toUpperCase()
}

/**
 * Tom do avatar derivado das INICIAIS — nunca do estado da pessoa (D-13).
 * Colorir o avatar pelo estado transformaria a lista num semáforo de mérito por
 * pessoa, que é exatamente o que I-8 proíbe.
 */
export function tomDoAvatar(iniciais: string): Tom {
  let soma = 0
  for (const ch of iniciais) soma = (soma + ch.charCodeAt(0)) % 4096
  return TONS_AVATAR[soma % TONS_AVATAR.length] ?? "neutral"
}

export interface BaseCalculo {
  agoraMs: number
  janelas: ReturnType<typeof janelasComparaveis>
  /** O universo, congelado. Denominador de §8.1 e §8.4. */
  roster: ReadonlySet<string>
  nomePorAluno: ReadonlyMap<string, string>
  iniciaisPorAluno: ReadonlyMap<string, string>
  tomAvatarPorAluno: ReadonlyMap<string, Tom>
  /** Todos os carimbos de atividade (sessões + reflexões), vitalícios. */
  carimbosPorAluno: ReadonlyMap<string, readonly number[]>
  /** Carimbos de interação ativa (§8.4: socrática, reflexão, quiz, cenário, atividade). */
  participacaoPorAluno: ReadonlyMap<string, readonly number[]>
  sessoesPorAluno: ReadonlyMap<string, number>
  ultimaAtividadeMsPorAluno: ReadonlyMap<string, number>
  progressoPorAluno: ReadonlyMap<string, number>
  esperadoPorAluno: ReadonlyMap<string, number>
  /** Progresso < esperado, com matrícula ativa e prazo (fórmula canônica). */
  atrasados: ReadonlySet<string>
  /** Quem tem matrícula ativa em curso COM prazo: só deles dá para dizer "no ritmo". */
  avaliaveis: ReadonlySet<string>
  concluidos: ReadonlySet<string>
  /** Denominador de §8.2 e §8.5: quem já iniciou a jornada. */
  iniciados: readonly string[]
  estadoPorAluno: ReadonlyMap<string, EstadoJornada>
  /**
   * Triagem CANÔNICA (`student-triage.ts`), lado a lado com a projeção §4.
   * As duas convivem de propósito: o SINAL da tela usa a projeção, mas tudo que
   * decide um nudge (rótulo do botão, regra C das recomendações) usa a canônica,
   * que é a mesma que o motor de campanhas obedece.
   */
  triagemPorAluno: ReadonlyMap<string, StudentTriagem>
  diasSemAtividadePorAluno: ReadonlyMap<string, number | null>
  ativosNoPeriodo: ReadonlySet<string>
  ativosNoPeriodoAnterior: ReadonlySet<string>
  regularesNoPeriodo: ReadonlySet<string>
  participaramNoPeriodo: ReadonlySet<string>
  participaramNoAnterior: ReadonlySet<string>
  /** Capítulo de maior `order` em que a pessoa tem sessão. */
  moduloCorrentePorAluno: ReadonlyMap<string, string>
  tituloPorCapitulo: ReadonlyMap<string, string>
  sessoesNoPeriodo: number
  sessoesNoPeriodoAnterior: number
}

function empurrarCarimbos(
  destino: Map<string, number[]>,
  roster: ReadonlySet<string>,
  id: string,
  isos: readonly (string | null | undefined)[],
): void {
  if (!roster.has(id)) return
  const lista = destino.get(id) ?? []
  for (const iso of isos) {
    if (!iso) continue
    const t = new Date(iso).getTime()
    if (!Number.isNaN(t)) lista.push(t)
  }
  destino.set(id, lista)
}

/**
 * "Regular" na janela que termina em `fimMs`: atividade em ≥2 dias distintos em
 * pelo menos metade das semanas cheias.
 *
 * A §8.2 diz "≥2 dias distintos por semana" e não diz o que fazer com 4 semanas.
 * A regra da maioria das semanas instancia a spec no nível literal dela (a
 * semana), colapsa para a regra crua quando a janela é de 7 dias, e não deixa
 * uma semana hiperativa mascarar três semanas mortas — que é justamente o sinal
 * "perdendo ritmo" que a tela existe para pegar. "Média de dias/semana ≥ 2" tem
 * esse buraco.
 */
export function ehRegular(carimbos: readonly number[], fimMs: number, duracaoMs: number): boolean {
  const semanas = semanasCheias(duracaoMs)
  if (semanas === 0) return false
  const minimoDeSemanas = Math.ceil(semanas / 2)
  let semanasOk = 0
  for (let w = 0; w < semanas; w++) {
    const ate = fimMs - w * MS_SEMANA
    const de = ate - MS_SEMANA
    const dias = new Set<string>()
    for (const t of carimbos) {
      if (t >= de && t < ate) dias.add(chaveDiaUtc(t))
    }
    if (dias.size >= REGULARIDADE_MIN_DIAS_NA_SEMANA) semanasOk++
  }
  return semanasOk >= minimoDeSemanas
}

/**
 * Projeção §4 sobre a taxonomia canônica.
 *
 * NÃO é uma segunda taxonomia: `student-triage.ts` continua sendo a fonte de
 * `atrasado`/`sem_acesso` e não é tocado (S8/S9/S10/S11, engagement e dashboard
 * consomem). O que muda aqui, e só aqui, é a PRECEDÊNCIA: a §4 define "Parado"
 * apenas por 14 dias de inatividade, enquanto a triagem canônica faz o atraso
 * absorver a inatividade (decisão do Hugo, 2026-07-07). Um aluno 20 dias sumido
 * E atrasado é `atencao` no semáforo do Engagement e "Parado" nesta tela. As
 * duas leituras são deliberadas; inverter a precedência lá quebraria o semáforo.
 */
export function projetarEstado(args: {
  naoIniciou: boolean
  concluiu: boolean
  retomouNoPeriodo: boolean
  diasSemAtividade: number | null
  atrasado: boolean
}): EstadoJornada {
  if (args.naoIniciou) return "nao-iniciou"
  if (args.concluiu) return "concluido"
  if (args.retomouNoPeriodo) return "retomando"
  if (args.diasSemAtividade === null || args.diasSemAtividade > SEM_ACESSO_DAYS) return "parado"
  if (args.atrasado) return "perdendo-ritmo"
  return "sustentando"
}

/** Houve pausa de ≥14 dias cujo retorno caiu dentro da janela atual? */
export function retomouNaJanela(
  carimbos: readonly number[],
  inicioJanelaMs: number,
  fimJanelaMs: number,
): boolean {
  const dias = [...new Set(carimbos.map(chaveDiaUtc))].sort()
  for (let i = 1; i < dias.length; i++) {
    const anterior = Date.parse(`${dias[i - 1]}T00:00:00.000Z`)
    const atual = Date.parse(`${dias[i]}T00:00:00.000Z`)
    const gap = diasUtcEntre(anterior, atual)
    if (gap >= SEM_ACESSO_DAYS && atual >= inicioJanelaMs && atual < fimJanelaMs) return true
  }
  return false
}

export function montarBase(fonte: FonteVisaoGeral): BaseCalculo {
  const janelas = janelasComparaveis(fonte.agoraMs, fonte.periodoDias)
  const roster = new Set(fonte.alunos.map((a) => a.id))

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

  // --- carimbos de atividade (vitalícios) ---------------------------------
  // Empurra CADA carimbo, não o máximo da linha: uma sessão criada no dia 1 e
  // retomada no dia 9 são DOIS dias distintos de atividade, e a §8.2 conta
  // dias. `updated_at` é obrigatório aqui porque a sessão socrática é REUSADA e
  // cada turno de chat mexe só nele (caso Rinaldo, ver `last-activity.ts`).
  const carimbos = new Map<string, number[]>()
  const participacao = new Map<string, number[]>()
  const sessoesPorAluno = new Map<string, number>()

  for (const s of fonte.sessoes) {
    empurrarCarimbos(carimbos, roster, s.student_id, [s.created_at, s.updated_at])
    if (roster.has(s.student_id)) {
      sessoesPorAluno.set(s.student_id, (sessoesPorAluno.get(s.student_id) ?? 0) + 1)
    }
    // §8.4: sessão socrática = sessão ligada a uma pergunta. MESMO marcador que
    // a rota aggregate já usa (`question_id IS NOT NULL`).
    if (s.question_id !== null) {
      empurrarCarimbos(participacao, roster, s.student_id, [s.created_at, s.updated_at])
    }
  }
  for (const r of fonte.reflexoes) {
    empurrarCarimbos(carimbos, roster, r.student_id, [r.created_at, r.updated_at])
    empurrarCarimbos(participacao, roster, r.student_id, [r.created_at, r.updated_at])
  }
  for (const lista of [fonte.quizzes, fonte.cenarios, fonte.atividades]) {
    for (const p of lista) empurrarCarimbos(participacao, roster, p.student_id, [p.created_at])
  }

  const ultimaAtividadeMsPorAluno = new Map<string, number>()
  for (const [id, ts] of carimbos) {
    if (ts.length > 0) ultimaAtividadeMsPorAluno.set(id, Math.max(...ts))
  }

  // --- matrículas: atraso, progresso, prazo -------------------------------
  const matriculasNoRoster = fonte.matriculas.filter((e) => roster.has(e.student_id))
  const { behind, progressByStudent, expectedPctByStudent } = computeBehindAndProgress(
    matriculasNoRoster,
    new Map(fonte.prazoPorCurso),
    fonte.agoraMs,
  )

  // "Avaliáveis" é o conjunto que a fórmula canônica calcula e joga fora: quem
  // tem matrícula ativa em curso COM prazo. Sem ele, §8.3 conta "indecidível"
  // como "atrasado" (ou como "no ritmo", se o complemento for ingênuo). Mesmo
  // predicado do `computeBehindAndProgress`, na mesma ordem.
  const avaliaveis = new Set<string>()
  for (const e of matriculasNoRoster) {
    if (e.status !== "active") continue
    const prazo = fonte.prazoPorCurso.get(e.course_id) ?? null
    if (prazo === null || prazo <= 0) continue
    if (Number.isNaN(new Date(e.created_at).getTime())) continue
    avaliaveis.add(e.student_id)
  }

  const matriculadas = new Map<string, number>()
  const completadas = new Map<string, number>()
  for (const e of matriculasNoRoster) {
    matriculadas.set(e.student_id, (matriculadas.get(e.student_id) ?? 0) + 1)
    if (e.status === "completed") {
      completadas.set(e.student_id, (completadas.get(e.student_id) ?? 0) + 1)
    }
  }
  const concluidos = new Set(
    [...roster].filter(
      (id) => (matriculadas.get(id) ?? 0) > 0 && completadas.get(id) === matriculadas.get(id),
    ),
  )

  // --- "já iniciou a jornada": negação exata de `nao_iniciado` ------------
  // student-triage.ts:47 — nao_iniciado ⇔ totalSessions === 0 && progressPct === 0.
  const iniciados = [...roster].filter(
    (id) => (sessoesPorAluno.get(id) ?? 0) > 0 || (progressByStudent.get(id) ?? 0) > 0,
  )
  const conjuntoIniciados = new Set(iniciados)

  // --- janelas ------------------------------------------------------------
  const ativosNoPeriodo = new Set<string>()
  const ativosNoPeriodoAnterior = new Set<string>()
  const regularesNoPeriodo = new Set<string>()
  const diasSemAtividadePorAluno = new Map<string, number | null>()
  const estadoPorAluno = new Map<string, EstadoJornada>()
  const triagemPorAluno = new Map<string, StudentTriagem>()
  const paceCanonico = new Map<string, StudentPace>()
  for (const id of behind) paceCanonico.set(id, "behind")

  for (const id of roster) {
    const ts = carimbos.get(id) ?? []
    if (ts.some((t) => t >= janelas.atualInicio && t < janelas.atualFim)) ativosNoPeriodo.add(id)
    if (ts.some((t) => t >= janelas.anteriorInicio && t < janelas.anteriorFim)) {
      ativosNoPeriodoAnterior.add(id)
    }
    if (conjuntoIniciados.has(id) && ehRegular(ts, janelas.atualFim, janelas.duracaoMs)) {
      regularesNoPeriodo.add(id)
    }
    const ultima = ultimaAtividadeMsPorAluno.get(id)
    const dias = ultima === undefined ? null : diasUtcEntre(ultima, fonte.agoraMs)
    diasSemAtividadePorAluno.set(id, dias)
    estadoPorAluno.set(
      id,
      projetarEstado({
        naoIniciou: !conjuntoIniciados.has(id),
        concluiu: concluidos.has(id),
        retomouNoPeriodo: retomouNaJanela(ts, janelas.atualInicio, janelas.atualFim),
        diasSemAtividade: dias,
        atrasado: behind.has(id),
      }),
    )

    // Triagem canônica, consumida VERBATIM (nunca reimplementada).
    const entrada: TriageInput = {
      id,
      totalSessions: sessoesPorAluno.get(id) ?? 0,
      lastSessionDate: ultima === undefined ? null : new Date(ultima).toISOString(),
      courseProgressPct: Math.round(progressByStudent.get(id) ?? 0),
      coursesEnrolled: matriculadas.get(id) ?? 0,
      coursesCompleted: completadas.get(id) ?? 0,
    }
    triagemPorAluno.set(
      id,
      computeStudentTriagem(entrada, computeStudentRitmo(entrada, paceCanonico), fonte.agoraMs),
    )
  }

  const participaramNoPeriodo = new Set<string>()
  const participaramNoAnterior = new Set<string>()
  for (const [id, ts] of participacao) {
    if (ts.some((t) => t >= janelas.atualInicio && t < janelas.atualFim)) {
      participaramNoPeriodo.add(id)
    }
    if (ts.some((t) => t >= janelas.anteriorInicio && t < janelas.anteriorFim)) {
      participaramNoAnterior.add(id)
    }
  }

  // --- módulo corrente (§29 regra A) --------------------------------------
  const tituloPorCapitulo = new Map<string, string>()
  const ordemPorCapitulo = new Map<string, number>()
  for (const c of fonte.capitulos) {
    tituloPorCapitulo.set(c.id, c.title ?? "Sem título")
    ordemPorCapitulo.set(c.id, c.order ?? 0)
  }
  const moduloCorrentePorAluno = new Map<string, string>()
  const ordemCorrente = new Map<string, number>()
  for (const s of fonte.sessoes) {
    if (s.chapter_id === null || !roster.has(s.student_id)) continue
    const ordem = ordemPorCapitulo.get(s.chapter_id)
    if (ordem === undefined) continue
    const melhor = ordemCorrente.get(s.student_id)
    if (melhor === undefined || ordem > melhor) {
      ordemCorrente.set(s.student_id, ordem)
      moduloCorrentePorAluno.set(s.student_id, s.chapter_id)
    }
  }

  // --- contagem de sessões por janela (§9 tipo 1) -------------------------
  let sessoesNoPeriodo = 0
  let sessoesNoPeriodoAnterior = 0
  for (const s of fonte.sessoes) {
    if (!roster.has(s.student_id) || !s.created_at) continue
    const t = new Date(s.created_at).getTime()
    if (Number.isNaN(t)) continue
    if (t >= janelas.atualInicio && t < janelas.atualFim) sessoesNoPeriodo++
    else if (t >= janelas.anteriorInicio && t < janelas.anteriorFim) sessoesNoPeriodoAnterior++
  }

  const esperadoPorAluno = new Map<string, number>()
  for (const [id, pct] of expectedPctByStudent) esperadoPorAluno.set(id, pct)

  return {
    agoraMs: fonte.agoraMs,
    janelas,
    roster,
    nomePorAluno,
    iniciaisPorAluno,
    tomAvatarPorAluno,
    carimbosPorAluno: carimbos,
    participacaoPorAluno: participacao,
    sessoesPorAluno,
    ultimaAtividadeMsPorAluno,
    progressoPorAluno: progressByStudent,
    esperadoPorAluno,
    atrasados: behind,
    avaliaveis,
    concluidos,
    iniciados,
    estadoPorAluno,
    triagemPorAluno,
    diasSemAtividadePorAluno,
    ativosNoPeriodo,
    ativosNoPeriodoAnterior,
    regularesNoPeriodo,
    participaramNoPeriodo,
    participaramNoAnterior,
    moduloCorrentePorAluno,
    tituloPorCapitulo,
    sessoesNoPeriodo,
    sessoesNoPeriodoAnterior,
  }
}
