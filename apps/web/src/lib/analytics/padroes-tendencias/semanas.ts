// ---------------------------------------------------------------------------
// Bucketização semanal, rótulo de semana e eixo — F-10, F-13, F-14.
// ---------------------------------------------------------------------------
// Tudo aqui é PURO e UTC (I-6). Nenhuma função desta tela usa os acessores de
// data locais nem formatação por locale — a lista literal deles está no
// verificador F-41, e é de propósito que ela não seja repetida aqui: eles leem
// o fuso do processo, e a mesma série passaria a ter fronteiras diferentes no
// servidor e no cliente sem ninguém tocar no banco. Data entra como número de
// milissegundos e sai fatiada da string ISO. O nome dos meses vem de tabela
// literal, exatamente por isso.
// ---------------------------------------------------------------------------

import { chaveDiaUtc, semanasCheias } from "../visao-geral/dia-utc"
import {
  EIXO_Y_DIVISOES,
  EIXO_Y_REDONDOS,
  MS_SEMANA,
  SERIE_SEMANAS_MAX,
  SERIE_SEMANAS_MIN,
} from "./parametros"
import { TRACO_INTERVALO } from "./textos"

const MESES: readonly string[] = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
]

export interface BucketSemana {
  /** 0 = semana MAIS ANTIGA da série (ordem de leitura do gráfico). */
  indice: number
  inicioMs: number
  /** Semiaberto à direita: carimbo nenhum cai em dois baldes. */
  fimMs: number
  rotulo: string
}

/**
 * Quantas semanas a série cobre: período atual + período anterior, com teto.
 *
 * 7d → 2 · 30d → 8 · 90d → 12 (teto ativo).
 *
 * DIVERGÊNCIA CONSCIENTE COM O MOCKUP, registrada: o PNG desenha 10 pontos sob
 * o filtro de 30 dias, e nenhuma regra da spec produz 10. "Atual + anterior" é
 * o que a tela inteira compara (§16), e 2 pontos é o mínimo que a §32 exige
 * para se falar em tendência.
 */
export function semanasDaSerie(duracaoMs: number): number {
  const cheias = semanasCheias(duracaoMs)
  const dobro = Math.max(SERIE_SEMANAS_MIN, 2 * cheias)
  return Math.min(dobro, SERIE_SEMANAS_MAX)
}

/** Nome do mês, lido dos caracteres 5..7 da chave ISO. Sem acessor, sem locale. */
function mesDe(diaUtc: string): string {
  const indice = Number.parseInt(diaUtc.slice(5, 7), 10) - 1
  return MESES[indice] ?? "?"
}

/** Dia do mês, sem zero à esquerda. "2026-06-01" → "1". */
function diaDe(diaUtc: string): string {
  return String(Number.parseInt(diaUtc.slice(8, 10), 10))
}

/**
 * "26 mai – 1 jun" quando o balde cruza o mês; "2 – 8 jun" quando não cruza.
 *
 * O separador é o traço de intervalo U+2013, DISTINTO do travessão U+2014 que
 * significa "dado ausente" na Visão geral. Um não pode virar o outro.
 */
export function rotuloSemana(inicioMs: number, fimMs: number): string {
  const ini = chaveDiaUtc(inicioMs)
  // O balde é semiaberto: o último dia dele é o instante 1ms antes do fim.
  const fim = chaveDiaUtc(fimMs - 1)
  const mesIni = mesDe(ini)
  const mesFim = mesDe(fim)
  if (mesIni === mesFim) {
    return `${diaDe(ini)} ${TRACO_INTERVALO} ${diaDe(fim)} ${mesFim}`
  }
  return `${diaDe(ini)} ${mesIni} ${TRACO_INTERVALO} ${diaDe(fim)} ${mesFim}`
}

/**
 * Os `n` baldes de 7 dias que terminam em `fimMs`, do mais ANTIGO ao mais
 * recente. O balde `k` contado do fim é `[fim − (k+1)·semana, fim − k·semana)`.
 */
export function bucketizarSemanas(fimMs: number, n: number): BucketSemana[] {
  const baldes: BucketSemana[] = []
  for (let k = n - 1; k >= 0; k--) {
    const fim = fimMs - k * MS_SEMANA
    const inicio = fim - MS_SEMANA
    baldes.push({
      indice: n - 1 - k,
      inicioMs: inicio,
      fimMs: fim,
      rotulo: rotuloSemana(inicio, fim),
    })
  }
  return baldes
}

/** Em qual balde o carimbo cai, ou -1. Semiaberto à direita nos dois lados. */
export function indiceDoBalde(baldes: readonly BucketSemana[], ms: number): number {
  for (const b of baldes) {
    if (ms >= b.inicioMs && ms < b.fimMs) return b.indice
  }
  return -1
}

/**
 * Domínio e as 6 marcas do eixo y.
 *
 * `passo` = menor valor redondo ≥ ceil(pico / 5); `topo` = passo × 5.
 * Medido no PNG: pico 190 → ceil(38) → redondo 40 → topo 200, marcas
 * 0/40/80/120/160/200.
 *
 * `pico === 0` NÃO produz eixo degenerado: o bloco já estaria em estado vazio,
 * e se ainda assim renderizar, o topo é o menor passo redondo × 5.
 */
export function eixoY(pico: number): { passo: number; topo: number; ticks: number[] } {
  const alvo = Math.ceil(Math.max(0, pico) / EIXO_Y_DIVISOES)
  const passo =
    EIXO_Y_REDONDOS.find((r) => r >= alvo) ?? EIXO_Y_REDONDOS[EIXO_Y_REDONDOS.length - 1]
  const escolhido = passo ?? 1
  const topo = escolhido * EIXO_Y_DIVISOES
  const ticks: number[] = []
  for (let i = 0; i <= EIXO_Y_DIVISOES; i++) ticks.push(escolhido * i)
  return { passo: escolhido, topo, ticks }
}
