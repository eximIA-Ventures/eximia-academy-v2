// ===========================================================================
// Cálculos do elo 4 — as fórmulas do CONTRATO-DE-DADOS.md, aplicadas às linhas
// cruas devolvidas por `fonte-supabase.ts`.
// ===========================================================================
// ESTE ARQUIVO NÃO É PRODUÇÃO. `base.ts`/`montagem.ts` da Autogestão (se e
// quando existirem) são a fonte de verdade da UI; isto aqui é o que o elo 4
// do `/gauntlet-2` precisa para provar que semear → ler pelo caminho de
// produção (`fonte-supabase.ts`) → recomputar devolve o número conhecido.
//
// DOUTRINA DE DIA UTC (mesma de `visao-geral/dia-utc.ts` e de
// `autogestao/parametros.ts`): duas datas são comparadas pelo DIA DE
// CALENDÁRIO em UTC, nunca por `ms/86_400_000` cru. Sem isso, o mesmo par de
// eventos conta dias diferentes dependendo da HORA em que cada um aconteceu —
// e este script deliberadamente semeia eventos em horas variadas (09h, 14h,
// 20h) para o mesmo dia, exatamente para expor esse defeito se ele existir.
// ===========================================================================

export const MS_DIA = 86_400_000
export const LIMIAR_RETOMADA_DIAS = 14

/** Chave de dia UTC, "YYYY-MM-DD". */
export function diaUTC(iso) {
  return new Date(iso).toISOString().slice(0, 10)
}

/** Meia-noite UTC do dia de `iso`, em ms — a única base de subtração válida aqui. */
function meiaNoiteUTCms(iso) {
  return Date.parse(`${diaUTC(iso)}T00:00:00.000Z`)
}

/** Diferença em DIAS DE CALENDÁRIO (UTC) entre dois ISO — nunca `ms/MS_DIA`. */
export function diferencaEmDiasCalendario(isoRecente, isoAntigo) {
  return Math.round((meiaNoiteUTCms(isoRecente) - meiaNoiteUTCms(isoAntigo)) / MS_DIA)
}

// ---------------------------------------------------------------------------
// 1.6 · "Há N dias" — última atividade entre sessões, reflexões e progresso.
// ---------------------------------------------------------------------------
export function diasDesdeUltimaAtividade(agoraISO, { sessoes, reflexoes, progresso }) {
  const timestamps = [
    ...sessoes.map((s) => s.created_at),
    ...reflexoes.map((r) => r.created_at),
    ...progresso.map((p) => p.last_viewed_at),
  ].filter((v) => v !== null && v !== undefined)
  if (timestamps.length === 0) return null
  const maisRecente = timestamps.reduce((a, b) => (a > b ? a : b))
  return diferencaEmDiasCalendario(agoraISO, maisRecente)
}

// ---------------------------------------------------------------------------
// 1.2 · Regularidade — dias distintos (UTC) com atividade ÷ semanas do período.
// Contrato 1.2: "sessões no MESMO dia contam 1, nunca mais". Fonte da
// atividade: sessions.created_at, slide_reflections.created_at,
// chapter_view_progress.last_viewed_at.
// ---------------------------------------------------------------------------
export function diasComAtividadeNaJanela(inicioISO, fimISO, { sessoes, reflexoes, progresso }) {
  const inicioMs = Date.parse(inicioISO)
  const fimMs = Date.parse(fimISO)
  const dias = new Set()
  for (const iso of [
    ...sessoes.map((s) => s.created_at),
    ...reflexoes.map((r) => r.created_at),
    ...progresso.map((p) => p.last_viewed_at),
  ]) {
    if (!iso) continue
    const ms = Date.parse(iso)
    if (ms >= inicioMs && ms < fimMs) dias.add(diaUTC(iso))
  }
  return dias
}

export function regularidade(inicioISO, fimISO, periodoDias, dados) {
  const dias = diasComAtividadeNaJanela(inicioISO, fimISO, dados)
  const semanas = periodoDias / 7
  return { diasDistintos: dias.size, semanas, vezesPorSemana: dias.size / semanas }
}

// ---------------------------------------------------------------------------
// 1.9 · Delta de sessões entre a janela atual e a anterior equivalente.
// ---------------------------------------------------------------------------
export function contarSessoesNaJanela(inicioISO, fimISO, sessoes) {
  const inicioMs = Date.parse(inicioISO)
  const fimMs = Date.parse(fimISO)
  return sessoes.filter((s) => {
    if (!s.created_at) return false
    const ms = Date.parse(s.created_at)
    return ms >= inicioMs && ms < fimMs
  }).length
}

// ---------------------------------------------------------------------------
// 1.4 · Progresso real — capítulos com `reached_last_slide_at` ÷ total.
// ---------------------------------------------------------------------------
export function progressoReal(progresso, capitulos) {
  const concluidos = new Set(
    progresso.filter((p) => p.reached_last_slide_at !== null).map((p) => p.chapter_id),
  )
  const total = capitulos.length
  const numerador = capitulos.filter((c) => concluidos.has(c.id)).length
  return { numerador, total, percentual: total === 0 ? null : Math.round((numerador / total) * 100) }
}

// ---------------------------------------------------------------------------
// 1.14 · Sessão em aberto — `completed_at IS NULL`, mais antiga primeiro.
// ---------------------------------------------------------------------------
export function sessaoEmAberto(agoraISO, sessoes) {
  const abertas = sessoes
    .filter((s) => s.completed_at === null && s.created_at !== null)
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
  if (abertas.length === 0) return null
  const [maisAntiga] = abertas
  return { chapterId: maisAntiga.chapter_id, diasAberta: diferencaEmDiasCalendario(agoraISO, maisAntiga.created_at) }
}

// ---------------------------------------------------------------------------
// 2.4 · Maior intervalo — maior lacuna, em dias de calendário, entre DIAS
// DISTINTOS de sessão (dedup do mesmo dia, senão duas sessões no mesmo dia
// produziriam uma lacuna de 0 que não representa pausa nenhuma).
// ---------------------------------------------------------------------------
export function diasDistintosDeSessao(sessoes) {
  const dias = [...new Set(sessoes.filter((s) => s.created_at).map((s) => diaUTC(s.created_at)))]
  return dias.sort()
}

export function maiorIntervalo(sessoes) {
  const dias = diasDistintosDeSessao(sessoes)
  if (dias.length < 2) return null
  let maior = 0
  for (let i = 1; i < dias.length; i++) {
    const gap = Math.round((Date.parse(`${dias[i]}T00:00:00.000Z`) - Date.parse(`${dias[i - 1]}T00:00:00.000Z`)) / MS_DIA)
    if (gap > maior) maior = gap
  }
  return maior
}

// ---------------------------------------------------------------------------
// 2.6 · Retomadas — retornos após pausa ≥14 dias (spec §17, contrato 2.6).
// ---------------------------------------------------------------------------
export function retomadas(sessoes, limiarDias = LIMIAR_RETOMADA_DIAS) {
  const dias = diasDistintosDeSessao(sessoes)
  if (dias.length < 2) return 0
  let n = 0
  for (let i = 1; i < dias.length; i++) {
    const gap = Math.round((Date.parse(`${dias[i]}T00:00:00.000Z`) - Date.parse(`${dias[i - 1]}T00:00:00.000Z`)) / MS_DIA)
    if (gap >= limiarDias) n++
  }
  return n
}

// ---------------------------------------------------------------------------
// 3.2 · Progresso do módulo atual — max_slide_index ÷ slides_total_at_last_view.
// ---------------------------------------------------------------------------
export function progressoModuloAtual(linhaProgresso) {
  if (!linhaProgresso) return null
  const { max_slide_index, slides_total_at_last_view } = linhaProgresso
  if (!slides_total_at_last_view) return null
  return Math.round((max_slide_index / slides_total_at_last_view) * 100)
}

// ---------------------------------------------------------------------------
// 3.4 · Sessões concluídas no módulo — `completed_at NOT NULL` por chapter_id.
// ---------------------------------------------------------------------------
export function sessoesConcluidasModulo(sessoes, chapterId) {
  const doModulo = sessoes.filter((s) => s.chapter_id === chapterId)
  const concluidas = doModulo.filter((s) => s.completed_at !== null).length
  return { concluidas, total: doModulo.length }
}

// ---------------------------------------------------------------------------
// 1.16 · Último ajuste — dias desde `study_plans.recalculated_at`.
// ---------------------------------------------------------------------------
export function ultimoAjusteDias(agoraISO, plano) {
  if (!plano || !plano.recalculated_at) return null
  return diferencaEmDiasCalendario(agoraISO, plano.recalculated_at)
}

// ---------------------------------------------------------------------------
// 3.6 · Próximo marco — start_date + soma acumulada de `module_durations` até
// o módulo alvo (inclusive). "falta prova" quando o módulo alvo tem `days: 0`
// (a spec não sustenta uma data para um módulo sem duração definida).
// ---------------------------------------------------------------------------
export function marco(plano, capitulosOrdenados, chapterIdAlvo) {
  if (!plano) return { faltaProva: true, motivo: "sem-plano" }
  const duracoes = plano.module_durations
  const alvo = duracoes.find((d) => d.chapterId === chapterIdAlvo)
  if (!alvo) return { faltaProva: true, motivo: "modulo-fora-do-plano" }
  if (alvo.days === 0) return { faltaProva: true, motivo: "duracao-zero" }

  const indiceAlvo = capitulosOrdenados.findIndex((c) => c.id === chapterIdAlvo)
  if (indiceAlvo < 0) return { faltaProva: true, motivo: "modulo-nao-encontrado" }

  let acumulado = 0
  for (let i = 0; i <= indiceAlvo; i++) {
    const cap = capitulosOrdenados[i]
    const d = duracoes.find((x) => x.chapterId === cap.id)
    acumulado += d ? d.days : 0
  }
  const dataMs = meiaNoiteUTCms(plano.start_date) + acumulado * MS_DIA
  return { faltaProva: false, dataISO: new Date(dataMs).toISOString().slice(0, 10) }
}

// ---------------------------------------------------------------------------
// Janelas comparáveis (atual vs. anterior equivalente), mesmo desenho de
// `visao-geral/dia-utc.ts`, versão mínima para este script.
// ---------------------------------------------------------------------------
export function janelasComparaveis(agoraISO, periodoDias) {
  const agoraMs = Date.parse(agoraISO)
  const atualInicioMs = agoraMs - periodoDias * MS_DIA
  const anteriorInicioMs = atualInicioMs - periodoDias * MS_DIA
  return {
    atualInicio: new Date(atualInicioMs).toISOString(),
    atualFim: agoraISO,
    anteriorInicio: new Date(anteriorInicioMs).toISOString(),
    anteriorFim: new Date(atualInicioMs).toISOString(),
  }
}
