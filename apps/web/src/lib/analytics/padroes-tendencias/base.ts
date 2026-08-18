// ---------------------------------------------------------------------------
// Base de cálculo de "Padrões e tendências" — computada UMA vez, sobre a base
// da Visão geral.
// ---------------------------------------------------------------------------
// `montarBase` (Visão geral) já entrega roster, carimbos vitalícios, estados da
// jornada e as duas janelas comparáveis. Este arquivo NÃO a reimplementa: ele a
// chama e acrescenta o que só esta tela precisa — a fatia SEMANAL da série, a
// série por módulo, a regularidade nas DUAS janelas e a partição de
// participação.
//
// I-5 continua estrutural: existe um `roster` só, e as duas janelas saem do
// mesmo `duracaoMs` (`janelasComparaveis`). Não há caminho de código em que o
// período anterior leia outro universo ou outra duração.
//
// UMA DIVERGÊNCIA DECLARADA, e ela é deliberada: as duas séries do gráfico
// (§17) contam APENAS `sessions`, enquanto `base.ativosNoPeriodo` conta
// `sessions` + `slide_reflections`. Motivo: as duas séries do MESMO gráfico têm
// que dividir um universo só, senão a razão "sessões por pessoa" que o gestor
// lê ali é falsa. O bloco §16, que não é do gráfico, continua na régua ampla da
// base.
//
// Função PURA: `agoraMs` entra pela fonte, nunca por `Date.now()`.
// ---------------------------------------------------------------------------

import { SEM_ACESSO_DAYS } from "@/lib/student-triage"
import { type BaseCalculo, ehRegular, montarBase } from "../visao-geral/base"
import { chaveDiaUtc, semanasCheias } from "../visao-geral/dia-utc"
import type { FonteVisaoGeral } from "../visao-geral/fonte"
import { MODULO_BASE_MIN, MS_SEMANA, REGULARIDADE_MIN_DIAS_NA_SEMANA } from "./parametros"
import { type BucketSemana, bucketizarSemanas, indiceDoBalde, semanasDaSerie } from "./semanas"

// ===========================================================================
// Regularidade — UMA função para os três lugares que a exibem
// ===========================================================================

/**
 * §16 (F-04), §18 (F-18) e §20 (F-31) mostram a MESMA variação de
 * regularidade. Três lugares da tela com três valores para a mesma coisa é o
 * defeito clássico; por isso os três leem esta estrutura, produzida uma vez.
 *
 * Denominador: o `roster` inteiro, congelado. A Visão geral divide o indicador
 * dela por `iniciados`; aqui a §20 é uma PARTIÇÃO EXAUSTIVA, e excluir quem
 * nunca iniciou esconderia gente que foi medida (lição 4). A consequência —
 * a mesma palavra produzindo números diferentes em duas abas — está registrada
 * no CONTRATO e precisa de decisão do dono.
 */
export interface Regularidade {
  regularesAtual: number
  /** `null` = a janela anterior não tem carimbo algum: não há o que comparar. */
  regularesAnterior: number | null
  denominador: number
  taxaAtualPct: number
  taxaAnteriorPct: number | null
  /** `null` quando não há período anterior comparável. NUNCA 0 por ausência. */
  deltaPp: number | null
  deltaPessoas: number | null
}

// ===========================================================================
// Módulos
// ===========================================================================

export interface VariacaoModulo {
  capituloId: string
  titulo: string
  ativosAtual: number
  ativosAnterior: number
  /** Fração, não percentual: −0.18 é "−18%". */
  variacao: number
}

export interface SerieModulo {
  capituloId: string
  titulo: string
  /** Pessoas distintas com sessão naquele capítulo, por semana da série. */
  ativosPorSemana: readonly number[]
}

// ===========================================================================
// Participação (§20)
// ===========================================================================

export interface ParticipacaoBruta {
  regulares: readonly string[]
  umaVez: readonly string[]
  irregulares: readonly string[]
  semAtividade: readonly string[]
}

// ===========================================================================
// A base
// ===========================================================================

export interface BasePadroes {
  visao: BaseCalculo
  semanas: readonly BucketSemana[]
  /** §17 série 1: pessoas distintas com ≥1 sessão na semana. */
  ativosPorSemana: readonly number[]
  /** §17 série 2: total de sessões criadas na semana. */
  sessoesPorSemana: readonly number[]
  /** Quantas semanas da série têm QUALQUER atividade (gate do estado vazio). */
  semanasComAtividade: number
  regularidade: Regularidade
  /** Só capítulos com base mínima no período anterior. */
  variacaoPorModulo: readonly VariacaoModulo[]
  seriesPorModulo: readonly SerieModulo[]
  participacao: ParticipacaoBruta
  /** §21: quem não cabe em nenhum dos 4 cards. */
  concluidos: number
  naoIniciaram: number
  /** F-21: quantas pessoas do recorte não têm carimbo na janela anterior. */
  semHistoricoComparavel: number
}

/** As semanas CHEIAS de uma janela que termina em `fimMs`, da mais recente. */
function janelasSemanais(fimMs: number, duracaoMs: number): { de: number; ate: number }[] {
  const total = semanasCheias(duracaoMs)
  const faixas: { de: number; ate: number }[] = []
  for (let w = 0; w < total; w++) {
    const ate = fimMs - w * MS_SEMANA
    faixas.push({ de: ate - MS_SEMANA, ate })
  }
  return faixas
}

/** Em quantas das semanas cheias a pessoa teve ao menos `minDias` dias UTC. */
function semanasComDias(
  carimbos: readonly number[],
  fimMs: number,
  duracaoMs: number,
  minDias: number,
): number {
  let total = 0
  for (const faixa of janelasSemanais(fimMs, duracaoMs)) {
    const dias = new Set<string>()
    for (const t of carimbos) {
      if (t >= faixa.de && t < faixa.ate) dias.add(chaveDiaUtc(t))
    }
    if (dias.size >= minDias) total++
  }
  return total
}

function contarNaJanela(carimbos: readonly number[], de: number, ate: number): number {
  let total = 0
  for (const t of carimbos) if (t >= de && t < ate) total++
  return total
}

export function montarBasePadroes(fonte: FonteVisaoGeral): BasePadroes {
  const visao = montarBase(fonte)
  const { janelas, roster } = visao

  // --- carimbos de SESSÃO (sem reflexões): o universo do gráfico ----------
  // `updated_at` é obrigatório aqui: a sessão socrática é REUSADA e cada turno
  // de chat mexe só nele. Contar apenas `created_at` apagaria da série quem
  // estudou esta semana numa sessão criada há 40 dias.
  const carimbosSessao = new Map<string, number[]>()
  const criacoes: number[] = []
  const carimbosPorCapitulo = new Map<string, { aluno: string; ms: number }[]>()

  for (const s of fonte.sessoes) {
    if (!roster.has(s.student_id)) continue
    const lista = carimbosSessao.get(s.student_id) ?? []
    for (const iso of [s.created_at, s.updated_at]) {
      if (!iso) continue
      const t = new Date(iso).getTime()
      if (Number.isNaN(t)) continue
      lista.push(t)
      if (s.chapter_id !== null) {
        const porCap = carimbosPorCapitulo.get(s.chapter_id) ?? []
        porCap.push({ aluno: s.student_id, ms: t })
        carimbosPorCapitulo.set(s.chapter_id, porCap)
      }
    }
    carimbosSessao.set(s.student_id, lista)
    if (s.created_at) {
      const t = new Date(s.created_at).getTime()
      if (!Number.isNaN(t)) criacoes.push(t)
    }
  }

  // --- §17 as duas séries -------------------------------------------------
  const semanas = bucketizarSemanas(janelas.atualFim, semanasDaSerie(janelas.duracaoMs))
  const ativosPorSemana = semanas.map(() => 0)
  const sessoesPorSemana = semanas.map(() => 0)

  const pessoasPorSemana = semanas.map(() => new Set<string>())
  for (const [id, ts] of carimbosSessao) {
    for (const t of ts) {
      const i = indiceDoBalde(semanas, t)
      if (i >= 0) pessoasPorSemana[i]?.add(id)
    }
  }
  for (const [i, pessoas] of pessoasPorSemana.entries()) ativosPorSemana[i] = pessoas.size
  for (const t of criacoes) {
    const i = indiceDoBalde(semanas, t)
    if (i >= 0) sessoesPorSemana[i] = (sessoesPorSemana[i] ?? 0) + 1
  }
  const semanasComAtividade = semanas.filter(
    (_, i) => (ativosPorSemana[i] ?? 0) > 0 || (sessoesPorSemana[i] ?? 0) > 0,
  ).length

  // --- regularidade nas DUAS janelas --------------------------------------
  let regularesAtual = 0
  let regularesAnterior = 0
  let carimbosNaAnterior = 0
  for (const id of roster) {
    const ts = visao.carimbosPorAluno.get(id) ?? []
    if (ehRegular(ts, janelas.atualFim, janelas.duracaoMs)) regularesAtual++
    if (ehRegular(ts, janelas.anteriorFim, janelas.duracaoMs)) regularesAnterior++
    carimbosNaAnterior += contarNaJanela(ts, janelas.anteriorInicio, janelas.anteriorFim)
  }
  const denominador = roster.size
  const temAnterior = carimbosNaAnterior > 0
  const taxaAtualPct = denominador > 0 ? Math.round((regularesAtual / denominador) * 100) : 0
  const taxaAnteriorPct =
    temAnterior && denominador > 0 ? Math.round((regularesAnterior / denominador) * 100) : null
  const regularidade: Regularidade = {
    regularesAtual,
    regularesAnterior: temAnterior ? regularesAnterior : null,
    denominador,
    taxaAtualPct,
    taxaAnteriorPct,
    deltaPp: taxaAnteriorPct === null ? null : taxaAtualPct - taxaAnteriorPct,
    deltaPessoas: temAnterior ? regularesAtual - regularesAnterior : null,
  }

  // --- §19 variação por módulo, e a série por módulo da §18 ---------------
  const variacaoPorModulo: VariacaoModulo[] = []
  const seriesPorModulo: SerieModulo[] = []
  for (const [capituloId, carimbos] of carimbosPorCapitulo) {
    const titulo = visao.tituloPorCapitulo.get(capituloId)
    if (titulo === undefined) continue

    const atual = new Set<string>()
    const anterior = new Set<string>()
    const porSemana = semanas.map(() => new Set<string>())
    for (const c of carimbos) {
      if (c.ms >= janelas.atualInicio && c.ms < janelas.atualFim) atual.add(c.aluno)
      if (c.ms >= janelas.anteriorInicio && c.ms < janelas.anteriorFim) anterior.add(c.aluno)
      const i = indiceDoBalde(semanas, c.ms)
      if (i >= 0) porSemana[i]?.add(c.aluno)
    }

    seriesPorModulo.push({
      capituloId,
      titulo,
      ativosPorSemana: porSemana.map((s) => s.size),
    })

    if (anterior.size >= MODULO_BASE_MIN) {
      variacaoPorModulo.push({
        capituloId,
        titulo,
        ativosAtual: atual.size,
        ativosAnterior: anterior.size,
        variacao: (atual.size - anterior.size) / anterior.size,
      })
    }
  }
  variacaoPorModulo.sort((a, b) => a.variacao - b.variacao || a.titulo.localeCompare(b.titulo))
  seriesPorModulo.sort((a, b) => a.titulo.localeCompare(b.titulo))

  // --- §20 cascata mutuamente exclusiva, nesta ordem -----------------------
  // sem atividade → 2x+ → 1x → irregular. A ordem é o que garante que a soma
  // feche com `roster` por CONSTRUÇÃO, e não por conferência.
  const minimoDeSemanas = Math.max(1, Math.ceil(semanasCheias(janelas.duracaoMs) / 2))
  const regulares: string[] = []
  const umaVez: string[] = []
  const irregulares: string[] = []
  const semAtividade: string[] = []
  for (const id of roster) {
    const ts = visao.carimbosPorAluno.get(id) ?? []
    if (contarNaJanela(ts, janelas.atualInicio, janelas.atualFim) === 0) {
      semAtividade.push(id)
      continue
    }
    if (ehRegular(ts, janelas.atualFim, janelas.duracaoMs)) {
      regulares.push(id)
      continue
    }
    const semanasPresente = semanasComDias(ts, janelas.atualFim, janelas.duracaoMs, 1)
    if (semanasPresente >= minimoDeSemanas) umaVez.push(id)
    else irregulares.push(id)
  }

  // --- §21 quem fica FORA dos quatro cards --------------------------------
  let concluidos = 0
  let naoIniciaram = 0
  for (const estado of visao.estadoPorAluno.values()) {
    if (estado === "concluido") concluidos++
    else if (estado === "nao-iniciou") naoIniciaram++
  }

  let semHistoricoComparavel = 0
  for (const id of roster) {
    const ts = visao.carimbosPorAluno.get(id) ?? []
    if (contarNaJanela(ts, janelas.anteriorInicio, janelas.anteriorFim) === 0) {
      semHistoricoComparavel++
    }
  }

  return {
    visao,
    semanas,
    ativosPorSemana,
    sessoesPorSemana,
    semanasComAtividade,
    regularidade,
    variacaoPorModulo,
    seriesPorModulo,
    participacao: { regulares, umaVez, irregulares, semAtividade },
    concluidos,
    naoIniciaram,
    semHistoricoComparavel,
  }
}

/** Reexportado para os testes de fronteira exercitarem a MESMA função. */
export { ehRegular, SEM_ACESSO_DAYS, REGULARIDADE_MIN_DIAS_NA_SEMANA }
