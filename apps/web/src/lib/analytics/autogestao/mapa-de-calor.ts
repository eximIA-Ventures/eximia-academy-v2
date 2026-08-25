// ---------------------------------------------------------------------------
// Mapa de calor de atividade — grade dia×faixa e calendário semana×dia.
// ---------------------------------------------------------------------------
// Reusado por DOIS consumidores: a Autogestão do aluno (`carimbosDeAtividade`
// de UM `FonteAutogestao`) e o Analytics de time do gestor (a MESMA função,
// alimentada pela mescla dos carimbos de vários alunos via
// `carimbosDeAtividadeMultiplos`). O cálculo em si não sabe — nem precisa
// saber — se está vendo um aluno ou o tenant inteiro; ele só soma carimbos em
// células. Isso é o "parametrize por escopo" do pedido: o escopo é decisão de
// QUEM CHAMA (que carimbos entram na lista plana), nunca um branch dentro
// deste arquivo.
//
// UNIÃO DE ATIVIDADE: os carimbos que alimentam a grade são os MESMOS do
// contrato 1.2 (`CONTRATO-DE-DADOS.md`) — `sessions.created_at` ∪
// `slide_reflections.created_at` ∪ `chapter_view_progress.last_viewed_at`,
// já implementados em `carimbosDeAtividade` (`montagem.ts`). "Atividade" no
// mapa de calor é a MESMA coisa que "atividade" na regularidade (§8.2) — não
// só sessões — para as duas leituras do módulo não divergirem sobre o que
// conta como "eu estudei".
//
// FUSO: todo bucket (dia da semana, faixa horária, dia do calendário) desloca
// o carimbo pelo offset FIXO do tenant ANTES de ler hora/dia —
// `new Date(t + offsetMsLocal).getUTCDay()` / `.getUTCHours()` e
// `chaveDiaUtc(t + offsetMsLocal)`. É a MESMA técnica que `melhorHorario`,
// `diasDaSemanaPreferidos` e `formatarDataBr` já usam em `montagem.ts`: o
// deslocamento é um número FIXO vindo do banco (`fusoHorarioMinutosOffset`),
// nunca o fuso do processo que renderiza — por isso não reabre o defeito que
// a I-6 (`../visao-geral/dia-utc.ts`) proíbe (`toLocaleDateString`,
// `getDate()`, `Intl` etc., que leem o fuso de QUEM EXECUTA, não do tenant).
// Sem fuso resolvido (`fusoHorarioMinutosOffset` nulo/ausente), o offset vira
// 0 e o mapa lê em UTC — o mesmo caminho honesto que `fonte.ts` já documenta
// para os demais blocos de horário, preferível a fingir precisão com `Intl`.
// Sem este cuidado, "estuda à noite" (23h local) apareceria como "madrugada"
// sempre que o offset do tenant for negativo (BRT e todo o Brasil).
// ---------------------------------------------------------------------------

import { rotuloSemana } from "../padroes-tendencias/semanas"
import { chaveDiaUtc } from "../visao-geral/dia-utc"
import type { FonteAutogestao } from "./fonte"
import { carimbosDeAtividade, fimDaSemanaCorrenteMs } from "./montagem"
import {
  MAPA_DE_CALOR_FAIXAS,
  MAPA_DE_CALOR_HORAS_POR_FAIXA,
  MAPA_DE_CALOR_MIN_ATIVIDADES,
  MAPA_DE_CALOR_SEMANAS_MAX,
  MS_DIA,
  MS_SEMANA,
} from "./parametros"
import { MOTIVO_MAPA_DE_CALOR_POUCA_ATIVIDADE } from "./textos"
import {
  type CalendarioMapaDeCalor,
  type CelulaMapaDeCalor,
  type DiaCalendario,
  type GradeMapaDeCalor,
  type ResultadoMapaDeCalor,
  type SemanaCalendario,
  semLastro,
} from "./tipos"

const DIAS_SEMANA = 7

// ===========================================================================
// Escopo — quem chama decide QUE carimbos entram, o cálculo não sabe de quem
// ===========================================================================

/**
 * Mescla os carimbos de atividade (contrato 1.2) de vários alunos — o
 * caminho do escopo TIME, sem repetir a lógica de união por aluno.
 * `carimbosDeAtividade` (escopo aluno) e esta função (escopo time) devolvem
 * a MESMA forma (lista plana de ms), para `montarMapaDeCalorAtividade` nunca
 * precisar saber qual dos dois a alimentou.
 */
export function carimbosDeAtividadeMultiplos(
  fontes: readonly Pick<FonteAutogestao, "sessoes" | "reflexoes" | "progresso">[],
): number[] {
  const out: number[] = []
  for (const fonte of fontes) out.push(...carimbosDeAtividade(fonte))
  return out
}

// ===========================================================================
// Grade — dia da semana (0–6) × faixa de 2h (0–11)
// ===========================================================================

/** Faixa de `MAPA_DE_CALOR_HORAS_POR_FAIXA` horas a que a hora local pertence. */
function faixaDaHora(horaLocal: number): number {
  return Math.floor(horaLocal / MAPA_DE_CALOR_HORAS_POR_FAIXA)
}

/** As 84 células, sempre densas (nunca esparsas) — quem desenha nunca trata "célula ausente". */
function gradeVazia(): CelulaMapaDeCalor[][] {
  const celulas: CelulaMapaDeCalor[][] = []
  for (let dia = 0; dia < DIAS_SEMANA; dia++) {
    const linha: CelulaMapaDeCalor[] = []
    for (let faixa = 0; faixa < MAPA_DE_CALOR_FAIXAS; faixa++) {
      linha.push({ diaSemana: dia, faixa, contagem: 0 })
    }
    celulas.push(linha)
  }
  return celulas
}

function montarGrade(carimbos: readonly number[], offsetMsLocal: number): GradeMapaDeCalor {
  const celulas = gradeVazia()
  let maximo = 0
  for (const t of carimbos) {
    const local = new Date(t + offsetMsLocal)
    const diaSemana = local.getUTCDay()
    const faixa = faixaDaHora(local.getUTCHours())
    const celula = celulas[diaSemana]?.[faixa]
    if (!celula) continue // defensivo — diaSemana∈[0,6] e faixa∈[0,11] sempre, nunca deveria faltar
    celula.contagem += 1
    if (celula.contagem > maximo) maximo = celula.contagem
  }
  return { celulas, maximo }
}

// ===========================================================================
// Calendário — semana × dia, cobrindo o período do filtro
// ===========================================================================

function montarCalendario(
  carimbos: readonly number[],
  agoraMs: number,
  offsetMsLocal: number,
  semanas: number,
): CalendarioMapaDeCalor {
  const n = Math.max(1, Math.min(semanas, MAPA_DE_CALOR_SEMANAS_MAX))
  const fimSemanaCorrenteMs = fimDaSemanaCorrenteMs(agoraMs, offsetMsLocal)

  // Contagem por CHAVE de dia local (não por índice/posição) — imune a
  // carimbo caindo exatamente na borda do dia (o par vermelho de 23h/01h).
  const porDia = new Map<string, number>()
  for (const t of carimbos) {
    const chave = chaveDiaUtc(t + offsetMsLocal)
    porDia.set(chave, (porDia.get(chave) ?? 0) + 1)
  }

  const semanasOut: SemanaCalendario[] = []
  let maximo = 0
  for (let k = n - 1; k >= 0; k--) {
    const fimMs = fimSemanaCorrenteMs - k * MS_SEMANA
    const inicioMs = fimMs - MS_SEMANA
    const dias: DiaCalendario[] = []
    for (let j = 0; j < DIAS_SEMANA; j++) {
      const diaUtc = chaveDiaUtc(inicioMs + j * MS_DIA + offsetMsLocal)
      const contagem = porDia.get(diaUtc) ?? 0
      if (contagem > maximo) maximo = contagem
      dias.push({ diaUtc, contagem })
    }
    semanasOut.push({
      indice: n - 1 - k,
      inicioMs,
      fimMs,
      rotulo: rotuloSemana(inicioMs, fimMs),
      dias,
    })
  }
  return { semanas: semanasOut, maximo }
}

// ===========================================================================
// Entrada — o único ponto que aluno E time chamam
// ===========================================================================

/**
 * Monta o mapa de calor de atividade — grade dia×faixa + calendário
 * semana×dia — a partir de carimbos JÁ escopados pelo chamador (um aluno via
 * `carimbosDeAtividade`, ou o time inteiro via `carimbosDeAtividadeMultiplos`).
 *
 * Abaixo de `MAPA_DE_CALOR_MIN_ATIVIDADES`, devolve `SemLastro`: a amostra
 * bruta não sustenta 84 células sem virar poeira (decisão do dono, ver
 * `parametros.ts`). O relógio (`agora`) entra sempre injetado — nunca
 * `Date.now()` aqui, mesmo invariante do resto da Autogestão.
 */
export function montarMapaDeCalorAtividade(
  carimbos: readonly number[],
  agora: Date,
  fusoHorarioMinutosOffset: number | null | undefined,
  semanasCalendario: number,
): ResultadoMapaDeCalor {
  if (carimbos.length < MAPA_DE_CALOR_MIN_ATIVIDADES) {
    return semLastro(MOTIVO_MAPA_DE_CALOR_POUCA_ATIVIDADE)
  }
  const offsetMsLocal = (fusoHorarioMinutosOffset ?? 0) * 60_000
  return {
    grade: montarGrade(carimbos, offsetMsLocal),
    calendario: montarCalendario(carimbos, agora.getTime(), offsetMsLocal, semanasCalendario),
  }
}
