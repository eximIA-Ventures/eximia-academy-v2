// ---------------------------------------------------------------------------
// ritmo-summary — SH-1.5: the personal paragraph below the "Meu ritmo" table
// ---------------------------------------------------------------------------
// A PURE, DETERMINISTIC composer (no LLM, no I/O, no RNG): the same indicators
// always produce the same paragraph, so it is testable by exact equality (AC8).
//
// The paragraph has three moving parts, each derived ONLY from the already-computed
// indicators + the real rank signal (AC9):
//   1. Opening — conditioned on the REAL engagement rank FIRST, then on the OVERALL
//      tone (`summaryToneOf`, now proportion-aware — SH-2.6):
//        • rank #1 (isTopEngagement) → "você é o aluno mais engajado da turma"
//        • overall tone "behind" (2+ linhas atrás, caso Angelo) → ONE direct
//          opening: "{Nome}, para retomar o seu ritmo de estudos" — the Hugo
//          explicitly rejected the softened "um lembrete gentil..." wording
//          ("nao tem dessa de 'lembrete gentil', tem que ser direto ao ponto").
//          NEVER praises when the overall picture is bad.
//        • overall tone "tie" WITH exactly 1 linha atrás (caso Rinaldo, SH-2.6)
//          → "{Nome}, seu ritmo está bom, com um ponto de atenção" — honest but
//          lighter than "behind": 1 red row among 4 good ones is a point of
//          attention, not a red alert.
//        • above the class average in engagement AND no behind row dominates →
//          "seu engajamento está acima da média da turma" (never claims "mais
//          engajado" — AC7/AC9 cenário B)
//        • otherwise (win genérico, tie genuíno com 0 atrás, ou none) → a
//          neutral, encouraging opening (no false praise)
//   2. Pace/activity clauses — from progress vs org avg. Recency (SH-2.5 item 3)
//        no longer compares against the org avg at all — it uses the SAME
//        absolute-band reading the table now uses (`recencyReadingFor`).
//   3. Opportunity — DYNAMIC: it names the metric(s) that need attention in the
//        FINAL displayed result, never a hardcoded metric. SH-2.7.1 (Hugo
//        2026-07-20) — a metric qualifies when it is genuinely BEHIND the org
//        average (`winnerOf === "reference"`) OR when it WON relatively but was
//        capped by the SH-2.7 pace brake (`ownPaceSignalFor(...).ok === false`,
//        the same brake that turns a table row from win→tie) — checking only the
//        raw `winnerOf` (pre-brake) missed capped rows entirely (caso Rinaldo,
//        Reflexões). Capped metrics are named with the same quantified language
//        as the chip copy ("reflexões (você está em 19,5% do potencial)").
//        "atividade recente" still comes from `recencyReadingFor` (absolute
//        bands), not `winnerOf` (SH-2.5 item 3). If nothing needs attention, the
//        closing is positive.
//
// House rule: copy uses commas, never the em dash (—). Reuses `winnerOf`/
// `recencyReadingFor`/`ownPaceSignalFor` (the same functions the table computes
// with) so the summary never contradicts the per-row reading.
//
// SH-2.7.2 (Hugo 2026-07-20, "última rodada de copy") — the "tie com ponto de
// atenção" opening (SH-2.6) stopped amarrando UM número solto a uma lista de
// várias métricas ("Sua oportunidade de melhoria é evoluir em progresso e
// reflexões (você está em 19,5% do potencial)" citava o % da reflexão como se
// valesse para o progresso também — falso). A abertura tie agora separa cada
// métrica com o PRÓPRIO número: a mais crítica (menor `achievementPct` de
// `metricSignalsOf` — maior distância do potencial OU da Turma) entra na 1ª
// frase com o % concreto; a 2ª métrica (se houver) entra na 2ª frase citando o
// MESMO texto que o chip "Como estou" daquela linha já mostra (`chipText`,
// reuso, nunca invenção). Só 1 métrica com problema → só a 1ª frase. Este ramo
// agora COMPÕE a mensagem inteira sozinho (`tieAttentionSummary`), no lugar da
// abertura + frase de oportunidade genérica — os outros ramos (win/behind/
// neutro) seguem usando o `opportunity` genérico de sempre. A cláusula solta
// "você se mantém ativo com atividades recentes" foi REMOVIDA do painel
// inteiro (não só do tie): o Hugo chamou de "enchimento residual de uma
// versão anterior do painel" que "não agrega nada".
//
// SH-2.8 (Hugo 2026-07-20, caso real Angelo, feedback ao vivo) — o ramo
// `behind` (2+ linhas atrás, `summaryToneOf`) abria sempre com a mesma frase
// genérica "para retomar o seu ritmo de estudos" + a lista neutra de 4
// métricas ("evoluir em progresso, interações, reflexões e engajamento"),
// mesmo quando o padrão comportamental por trás dos números era mais
// específico: Angelo avançou de verdade no CONTEÚDO no dia (Progresso
// 0%→50%, 4 sessões numa rajada de 1h25) mas quase não interagiu/refletiu de
// verdade (Interações 4/8, Reflexões 1/41) — "fez a aula, não fez a parte que
// importa". O Hugo pediu "mais um cutucão": em vez da lista neutra, a
// abertura precisa fazer o PONTO diagnóstico. Novo sinal `superficialGap`
// (`metricSignalsOf`, calculado só para Interações/Reflexões, nunca Progresso)
// compara a MESMA % fracionária de sempre (`fractionPctOf`) com o PRÓPRIO
// `progressPct` do aluno (não com a Turma nem com o ritmo esperado por tempo
// do freio SH-2.7 — outro eixo de comparação: "quanto do que ele avançou no
// conteúdo virou engajamento real"). Gap grande (`SUPERFICIAL_ENGAGEMENT_THRESHOLDS`)
// só dispara quando o progresso em si já é significativo (`minProgressPct`) —
// sem isso, "avançou no conteúdo" seria falso. Caso Angelo: Progresso 50%,
// Interações 4/8=50% (gap 0, NÃO dispara — moveu junto com o progresso, o
// próprio Hugo notou isso ao revisar o exemplo), Reflexões 1/41≈2,4% (gap
// ≈47,6, dispara). Quando `tone === "behind"` E há ao menos 1 sinal
// `superficialGap`, `superficialEngagementSummary` substitui a abertura +
// oportunidade genéricas por uma frase única e direta ("você avançou no
// conteúdo, mas quase não {verbo(s)}: sem isso, o progresso conta menos do
// que parece") — mesmo padrão de retorno antecipado que `tieAttentionSummary`
// já usa para o ramo tie, um caso ESPECÍFICO dentro do ramo behind, não um
// ramo novo paralelo.
//
// feat-percorrido-na-tela-do-aluno (Hugo 2026-07-31) — `percorridoPct` entra
// como variável de decisão (C.1, opcional/aditivo). Ver o bloco
// `percorridoSemElaborarSignal`/`percorridoSemElaborarSummary` logo antes de
// `buildRitmoSummary`, que documenta a regra "proibido sequenciar" (C.3) e o
// tom calibrado de propósito (C.5).
// ---------------------------------------------------------------------------

import {
  type Leitura,
  formatPctPtBR1,
  fractionPctOf,
  leituraFor,
  ownPaceSignalFor,
  recencyReadingFor,
  winnerOf,
} from "@/components/analytics/comparison-insights-table"
import type { StudentHomeIndicators } from "@/types/analytics"

/**
 * The metrics the opportunity clause can point at, in a stable display order.
 *
 * [2026-07-31] "progresso" virou "conclusão": a linha que este rótulo nomeia
 * (`progressPct`) passou a se chamar Conclusão na tabela, e no vocabulário
 * cortado pelo Hugo "progresso" agora significa PREENCHER AS INTERAÇÕES — o
 * oposto do que esta métrica mede (módulos marcados como concluídos). Manter
 * "progresso" aqui faria o parágrafo contradizer a própria tabela acima dele.
 */
type BehindMetric = "conclusão" | "interações" | "reflexões" | "engajamento" | "atividade recente"

/**
 * Per-metric signal computed ONCE and reused by both `behindMetricsOf` (labels
 * only, contrato pré-existente preservado) and a mensagem quantificada de
 * `buildRitmoSummary` (SH-2.7.1) — evita computar `winnerOf`/`ownPaceSignalFor`
 * duas vezes para a mesma métrica.
 */
interface MetricSignal {
  metric: BehindMetric
  /** Entra na lista de "precisa de atenção" — genuinamente atrás OU rebaixado pelo freio. */
  needsAttention: boolean
  /**
   * SH-2.8 — true quando esta métrica (SÓ Interações/Reflexões, nunca Progresso)
   * está DESPROPORCIONALMENTE atrás do PRÓPRIO `progressPct` do aluno (ver
   * `superficialGapOf`) — eixo de comparação DIFERENTE do `needsAttention`
   * (que compara contra a Turma) e do freio SH-2.7 (que compara contra o ritmo
   * esperado por tempo decorrido). Independente de `needsAttention`: uma
   * métrica pode estar à frente da Turma e ainda assim desproporcional ao
   * próprio conteúdo já percorrido (embora, na prática, isso quase sempre
   * coincide com estar atrás da Turma também).
   */
  superficialGap: boolean
  /** SH-2.7.1 — só presente quando `needsAttention` veio do FREIO (venceu a Turma,
   * mas abaixo do próprio ritmo), para a frase citar o número real. */
  cappedPct?: number
  /**
   * SH-2.7.2 — % unificado usado para RANQUEAR qual métrica é a MAIS crítica
   * (menor = mais longe do alvo): `cappedPct` quando a métrica foi rebaixada
   * pelo freio (distância do PRÓPRIO potencial), ou `subject/reference*100`
   * quando genuinamente atrás da Turma (distância DA TURMA) — duas réguas
   * diferentes, mas ambas "quanto do que era esperado o aluno alcançou",
   * comparáveis o bastante para decidir qual entra na 1ª frase. `undefined`
   * quando `needsAttention` é false (não entra no ranking).
   */
  achievementPct?: number
  /**
   * SH-2.7.2 — o MESMO texto que o chip "Como estou" desta linha já mostra
   * (`leituraFor`/`recencyReadingFor`), para a 2ª frase da abertura tie REUSAR
   * em vez de inventar copy nova. `undefined` quando `needsAttention` é false.
   */
  chipText?: string
}

/**
 * SH-2.7.1 (Hugo 2026-07-20, achado ao vivo) — `behindMetricsOf` olhava só o
 * `winnerOf` CRU (pré-freio): uma linha que o freio de ritmo esperado (SH-2.7)
 * rebaixava de win para tie (ex.: Reflexões do Rinaldo, 8/41 vencendo a Turma mas
 * abaixo do ritmo esperado) NUNCA entrava na frase de oportunidade — o painel
 * citava só "progresso" (genuinamente atrás) e nunca a linha que a própria
 * tabela já mostrava âmbar. Uma métrica agora "precisa de atenção" quando está
 * genuinamente atrás da Turma (`winnerOf === "reference"`) OU quando venceu a
 * Turma mas foi rebaixada pelo freio (`ownPaceSignalFor(...).ok === false`) — as
 * MESMAS duas condições que produzem tom `behind`/`tie-por-freio` na tabela
 * (`leituraFor`), reusando `ownPaceSignalFor`/`fractionPctOf` em vez de duplicar
 * a conversão %.
 */
/**
 * SH-2.8 (Hugo 2026-07-20, caso real Angelo) — thresholds do sinal de
 * "engajamento superficial": o aluno passou pelo CONTEÚDO (progresso real,
 * não perto de zero) mas uma métrica de engajamento genuíno ficou bem atrás
 * de quanto ele mesmo avançou. CONFIGURÁVEL, mesmo espírito de
 * `TONE_THRESHOLDS`/`RECENCY_THRESHOLDS`/`SUMMARY_TONE_BEHIND_COUNT_FOR_RED`.
 */
export const SUPERFICIAL_ENGAGEMENT_THRESHOLDS = {
  /** Progresso mínimo (%) para considerar que houve avanço real de conteúdo a
   * contrastar — abaixo disso não há "conteúdo percorrido" o bastante para o
   * ponto fazer sentido (evita disparar num aluno que mal começou). */
  minProgressPct: 20,
  /** Diferença mínima (pontos percentuais) entre Progresso e a métrica
   * fracionária (Interações/Reflexões) para ela contar como
   * DESPROPORCIONALMENTE atrás do próprio progresso, não só "um pouco atrás". */
  gapPct: 30,
}

/**
 * `progressPct - metricPct >= gapPct`, só quando `progressPct` já é
 * significativo (`minProgressPct`). `metricPct` ausente (sem denominador de
 * trilha) → `false`, degradação graciosa igual ao resto do arquivo. Pure.
 */
function superficialGapOf(progressPct: number, metricPct: number | null): boolean {
  if (metricPct === null) return false
  if (progressPct < SUPERFICIAL_ENGAGEMENT_THRESHOLDS.minProgressPct) return false
  return progressPct - metricPct >= SUPERFICIAL_ENGAGEMENT_THRESHOLDS.gapPct
}

function metricSignalsOf(indicators: StudentHomeIndicators): MetricSignal[] {
  const s = indicators.subject
  const r = indicators.reference

  // SH-2.7.2 — `rowKey` deixa a `fractional` chamar o MESMO `leituraFor` da
  // tabela para `chipText` (reuso literal do texto do chip), sem duplicar copy.
  // SH-2.8 — `checkSuperficialGap` liga o sinal SÓ nas 2 chamadas de Interações/
  // Reflexões (nunca Progresso, que é o próprio eixo de comparação do sinal).
  const fractional = (
    metric: BehindMetric,
    rowKey: "progress" | "sessions" | "reflections",
    subjectValue: number,
    referenceValue: number,
    actualPct: number | null,
    checkSuperficialGap: boolean,
  ): MetricSignal => {
    const winner = winnerOf(subjectValue, referenceValue, "higher")
    const pace = ownPaceSignalFor(actualPct, s.expectedProgressPct)
    const capped = winner === "subject" && pace?.ok === false
    const needsAttention = winner === "reference" || capped
    return {
      metric,
      needsAttention,
      superficialGap: checkSuperficialGap ? superficialGapOf(s.progressPct, actualPct) : false,
      cappedPct: capped ? pace?.actualPct : undefined,
      achievementPct: capped
        ? pace?.actualPct
        : winner === "reference"
          ? (subjectValue / Math.max(referenceValue, 1)) * 100
          : undefined,
      chipText: needsAttention
        ? leituraFor(rowKey, subjectValue, referenceValue, "higher", undefined, pace).text
        : undefined,
    }
  }

  const engagementWinner = winnerOf(s.engagement, r.engagementAvg, "higher")
  const engagementNeedsAttention = engagementWinner === "reference"
  const recency = recencyReadingFor(s.lastAccessDays)
  const recencyNeedsAttention = recency.winner === "reference"

  return [
    fractional("conclusão", "progress", s.progressPct, r.progressAvgPct, s.progressPct, false),
    fractional(
      "interações",
      "sessions",
      s.interactions,
      r.interactionsAvg,
      fractionPctOf(s.interactions, s.interactionsMax),
      true,
    ),
    fractional(
      "reflexões",
      "reflections",
      s.reflections,
      r.reflectionsAvg,
      fractionPctOf(s.reflections, s.reflectionsMax),
      true,
    ),
    {
      metric: "engajamento",
      needsAttention: engagementNeedsAttention,
      superficialGap: false,
      achievementPct: engagementNeedsAttention
        ? (s.engagement / Math.max(r.engagementAvg, 1)) * 100
        : undefined,
      chipText: engagementNeedsAttention
        ? leituraFor("engagement", s.engagement, r.engagementAvg, "higher", s.isTopEngagement).text
        : undefined,
    },
    {
      metric: "atividade recente",
      needsAttention: recencyNeedsAttention,
      superficialGap: false,
      achievementPct:
        recencyNeedsAttention && r.lastAccessAvgDays !== null && s.lastAccessDays !== null
          ? (r.lastAccessAvgDays / Math.max(s.lastAccessDays, 1)) * 100
          : undefined,
      chipText: recencyNeedsAttention ? recency.leitura.text : undefined,
    },
  ]
}

/**
 * The metrics where the student needs attention, in a STABLE order
 * (deterministic output) — MESMO contrato de sempre (`BehindMetric[]`, só
 * labels), agora alimentado por `metricSignalsOf` (SH-2.7.1, ver acima).
 */
export function behindMetricsOf(indicators: StudentHomeIndicators): BehindMetric[] {
  return metricSignalsOf(indicators)
    .filter((m) => m.needsAttention)
    .map((m) => m.metric)
}

/**
 * SH-2.7.1 — quando uma métrica está na lista por ter sido REBAIXADA pelo freio
 * de ritmo esperado (não por estar genuinamente atrás da Turma), a frase de
 * oportunidade nomeia o número real, mesma linguagem quantificada do chip "Como
 * estou" (item 1 desta rodada) — ex.: "reflexões (você está em 19,5% do
 * potencial)". Direto, sem suavização: métrica + número, nada além disso.
 */
function opportunityLabelFor(signal: MetricSignal): string {
  if (signal.cappedPct === undefined) return signal.metric
  return `${signal.metric} (você está em ${formatPctPtBR1(signal.cappedPct)}% do potencial)`
}

/** "a e b", "a, b e c" — a comma-joined list with "e" before the last item (no em dash). */
function joinPt(items: string[]): string {
  if (items.length === 0) return ""
  if (items.length === 1) return items[0]
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`
}

/** The first token of a name, trimmed; empty/absent → null (opening omits the name). */
function firstNameOf(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0]
  return first ? first : null
}

/** "conclusão" → "Conclusão" — só para o rótulo de sentença-inicial da 2ª frase (SH-2.7.2). */
function capitalizeFirst(text: string): string {
  return text.length > 0 ? `${text[0].toUpperCase()}${text.slice(1)}` : text
}

/**
 * SH-2.7.2 (Hugo 2026-07-20) — compõe a abertura "tie com ponto de atenção"
 * (SH-2.6) inteira, separando cada métrica com o PRÓPRIO número em vez de
 * amarrar um % só a uma lista. A métrica MAIS crítica (menor `achievementPct`
 * — maior distância do potencial próprio OU da Turma, `metricSignalsOf`) entra
 * na 1ª frase com o número concreto; a(s) restante(s), se houver, entram na 2ª
 * frase citando o MESMO texto que o chip "Como estou" daquela linha já mostra
 * (`chipText` — reuso, nunca invenção). Com só 1 métrica sinalizada, a função
 * devolve só a 1ª frase (regra explícita do Hugo). `flagged` é sempre não-vazio
 * quando chamada (o call site já garantiu `behind.length > 0`).
 */
function tieAttentionSummary(nameLead: string, flagged: MetricSignal[]): string {
  const sorted = [...flagged].sort((a, b) => (a.achievementPct ?? 0) - (b.achievementPct ?? 0))
  const [primary, ...secondary] = sorted
  const primaryPct = primary.cappedPct ?? primary.achievementPct ?? 0
  // `cappedPct` presente → o aluno venceu a Turma mas está abaixo do PRÓPRIO
  // ritmo esperado ("do potencial"); ausente → a distância é da TURMA mesmo
  // (genuinamente atrás, sem freio) — a redação reflete qual das duas é.
  const distanceOf = primary.cappedPct !== undefined ? "do potencial" : "da média da turma"
  const opening = `${nameLead}seu ritmo geral está bom, mas hoje o ponto real de atenção é ${primary.metric}: você está em apenas ${formatPctPtBR1(primaryPct)}% ${distanceOf}.`

  if (secondary.length === 0) return opening

  const label = joinPt(secondary.map((m) => capitalizeFirst(m.metric)))
  const verb = secondary.length > 1 ? "também pedem atenção" : "também pede atenção"
  const texts = joinPt(secondary.map((m) => m.chipText ?? "").filter((text) => text.length > 0))
  return `${opening} ${label} ${verb}, ${texts}.`
}

/** "interações" → "interagiu", "reflexões" → "refletiu" — SÓ as 2 métricas que
 * o sinal `superficialGap` pode marcar (ver `metricSignalsOf`). Qualquer outra
 * chave (não deveria chegar aqui) devolve `null`, filtrada pelo call site. */
function superficialVerbFor(metric: BehindMetric): string | null {
  if (metric === "interações") return "interagiu"
  if (metric === "reflexões") return "refletiu"
  return null
}

/** "interagiu", "interagiu nem refletiu" — junção NEGATIVA (nunca "e"/vírgula,
 * a lista aqui é sempre de no máx. 2 itens: Interações e Reflexões). */
function joinNem(items: string[]): string {
  return items.join(" nem ")
}

/**
 * SH-2.8 (Hugo 2026-07-20, caso real Angelo) — quando o tom geral é `behind`
 * (2+ linhas atrás) E ao menos 1 métrica tem `superficialGap` (Interações e/ou
 * Reflexões bem atrás do PRÓPRIO progresso, ver `superficialGapOf`), esta
 * função COMPÕE a mensagem inteira (mesmo padrão de retorno antecipado que
 * `tieAttentionSummary` já usa para o ramo tie) — substitui a abertura
 * genérica "para retomar o seu ritmo de estudos" + a lista neutra de
 * `opportunity` por UMA frase que faz o ponto diagnóstico direto: o aluno
 * avançou no conteúdo, mas o engajamento real (a parte que conta) ficou pra
 * trás. `flagged` é sempre não-vazio quando chamada (o call site já garantiu
 * isso); a ordem de `flagged` já vem estável de `metricSignalsOf`
 * (interações antes de reflexões), então "interagiu nem refletiu" lê natural.
 */
function superficialEngagementSummary(nameLead: string, flagged: MetricSignal[]): string {
  const verbs = flagged
    .map((signal) => superficialVerbFor(signal.metric))
    .filter((verb): verb is string => verb !== null)
  return `${nameLead}você avançou no conteúdo, mas quase não ${joinNem(verbs)}: sem isso, o progresso conta menos do que parece.`
}

// ---------------------------------------------------------------------------
// C — feat-percorrido-na-tela-do-aluno (Hugo 2026-07-31): o Percorrido entra
// como variável de decisão do compositor. Sem ele, dois alunos OPOSTOS
// recebiam a MESMA frase de "atrás":
//   • Percorrido 20%, Reflexões 2/41  → não chegou ao conteúdo (retomar)
//   • Percorrido 100%, Reflexões 8/41 → passou por cima do exercício (voltar
//     e registrar) — o material já está na cabeça, só falta o registro
// PROIBIDO SEQUENCIAR (regra ESTRUTURAL, não estilística): a reflexão mora
// DENTRO do slide (um blockquote no meio do conteúdo). Quem percorreu sem
// refletir PASSOU POR CIMA do exercício — não deixou uma etapa POSTERIOR
// para depois. "Primeiro avance, depois volte para refletir" ensinaria
// exatamente o comportamento errado, e legitimaria a leitura que o
// Percorrido existe para desmontar. Por isso a redação abaixo nomeia o FATO
// (percorreu) e a LACUNA (parou nas reflexões) sem NUNCA prescrever ordem.
// ---------------------------------------------------------------------------

export const PERCORRIDO_ELABORATION_THRESHOLDS = {
  /** Percorrido (%) a partir do qual "percorreu o conteúdo inteiro" é verdade. */
  completePct: 95,
  /** Reflexões (% do PRÓPRIO teto) abaixo disso, com percorrido completo, é
   * "parou nas reflexões" (passou por cima), não só "um pouco atrás". */
  lowReflectionPct: 50,
}

/** A partir de quantos dias parados a ausência vira a informação principal.
 * Compartilhada entre o compositor e `summaryHighlight`: as duas camadas têm de
 * concordar sobre quando o assunto deixa de ser a lacuna e passa a ser o sumiço. */
const AUSENCIA_DIAS = 14

/**
 * Detecta o caso "percorreu tudo, elaborou pouco". `null` quando qualquer
 * pré-condição falta: sem `percorridoPct` (chamador antigo, sem regressão —
 * C.1), percorrido abaixo do limiar de "completo" (é o outro caso da tabela
 * do defeito, "não chegou ao conteúdo" — cai no fluxo genérico existente,
 * sem mudança), ou sem `reflectionsMax` (sem denominador, não dá para citar
 * "X de Y" com honestidade). Pure.
 */
function percorridoSemElaborarSignal(
  indicators: StudentHomeIndicators,
): { reflections: number; reflectionsMax: number } | null {
  const s = indicators.subject

  // AUSÊNCIA VENCE A LACUNA (2026-08-03). Este ramo retorna cedo e, sem a
  // guarda abaixo, atropelava até a recência: alguém que sumiu há 30 dias
  // recebia uma frase sobre reflexões. O defeito ficou visível quando o bloco
  // de destaque passou a mostrar "30 dias sem estudar" ao lado de um texto que
  // falava de outra coisa, e o painel contava duas histórias.
  //
  // Para quem sumiu há duas semanas, "faltam 26 reflexões" responde uma
  // pergunta que a pessoa não fez. O limiar é o MESMO de `summaryHighlight`
  // (AUSENCIA_DIAS), de propósito: as duas camadas precisam concordar sobre
  // qual é o assunto, senão a incoerência volta por outro caminho.
  if (
    s.lastAccessDays !== null &&
    s.lastAccessDays !== undefined &&
    s.lastAccessDays >= AUSENCIA_DIAS
  ) {
    return null
  }

  if (s.percorridoPct == null) return null
  if (s.percorridoPct < PERCORRIDO_ELABORATION_THRESHOLDS.completePct) return null
  if (!s.reflectionsMax || s.reflectionsMax <= 0) return null
  const reflectionsPct = fractionPctOf(s.reflections, s.reflectionsMax)
  if (reflectionsPct === null) return null
  if (reflectionsPct >= PERCORRIDO_ELABORATION_THRESHOLDS.lowReflectionPct) return null
  return { reflections: s.reflections, reflectionsMax: s.reflectionsMax }
}

/**
 * A redação EXATA aprovada pelo Hugo (2026-07-31, "acho que esse foi o melhor
 * até agora"), com os números vindos dos indicadores e o nome do aluno. A
 * fórmula por trás (C.2 da story), que qualquer variação futura deve seguir:
 *   (a) constata com FATO, não adjetivo — "você percorreu o conteúdo inteiro"
 *   (b) valida em TRÊS PALAVRAS — "isso é bom"
 *   (c) vira com o NÚMERO CRU — "Só que parou aí: 8 de 41 reflexões"
 *   (d) fecha ligando ao que a pessoa JÁ TEM — "o material você já tem na
 *       cabeça" — o passo (d) é o que torna a frase DESARMANTE em vez de
 *       acusatória; sem ele, sobra cobrança.
 *
 * O tom foi CALIBRADO DE PROPÓSITO (C.3/C.5): o Hugo pediu "um tom um pouco
 * mais de cobrança", avaliou TRÊS gradações mais duras e escolheu MANTER
 * esta. Não é falta de coragem nem esquecimento — foi testado contra
 * alternativas mais duras e escolhido. Endurecer depois exige decisão nova
 * do Hugo, não um "ajuste de copy". Casa usa vírgula, nunca travessão (—).
 */
function percorridoSemElaborarSummary(
  nameLead: string,
  reflections: number,
  reflectionsMax: number,
): string {
  return `${nameLead}você percorreu o conteúdo inteiro, isso é bom. Só que parou aí: ${reflections} de ${reflectionsMax} reflexões. O material você já tem na cabeça, falta transformar em registro.`
}

/**
 * Compose the personal "Meu ritmo" summary paragraph. PURE + deterministic.
 *
 * @param indicators  the already-computed Você vs org indicators.
 * @param studentFirstName  the student's name (only the first token is used); absent → the
 *   opening drops the name ("Parabéns, ...").
 */
export function buildRitmoSummary(
  indicators: StudentHomeIndicators,
  studentFirstName?: string | null,
): string {
  const s = indicators.subject
  const r = indicators.reference
  const name = firstNameOf(studentFirstName)
  const hi = name ? `Parabéns ${name}, ` : "Parabéns, "
  // SH-2.3 — o ramo "atrás" não abre com "Parabéns" (soaria dissonante logo
  // antes de um convite de retomada); usa só o nome como vocativo. SH-2.5 (Hugo
  // 2026-07-19): a REDAÇÃO do próprio convite também mudou — "nao tem dessa de
  // 'um lembrete gentil' tem que ser direto ao ponto" — ver o ramo `behind` abaixo.
  const nameLead = name ? `${name}, ` : ""

  // C (feat-percorrido-na-tela-do-aluno) — "percorreu tudo, elaborou pouco" é
  // o diagnóstico MAIS ESPECÍFICO disponível (distingue "não estudou" de
  // "passou por cima do exercício"), checado ANTES dos ramos tie/behind
  // genéricos abaixo e retornando cedo (mesmo padrão de `tieAttentionSummary`/
  // `superficialEngagementSummary`). C.1 — `percorridoPct` ausente/baixo →
  // este bloco não dispara, comportamento pré-existente intocado.
  const percorridoSignal = percorridoSemElaborarSignal(indicators)
  if (percorridoSignal) {
    return percorridoSemElaborarSummary(
      nameLead,
      percorridoSignal.reflections,
      percorridoSignal.reflectionsMax,
    )
  }

  // 3 (calculado cedo, SH-2.6) — opportunity, DYNAMIC (never hardcoded): the metric(s)
  // actually behind. Movido para ANTES da abertura porque a nova abertura "tie" (item 3
  // abaixo) precisa saber se há de fato uma métrica fraca (behind.length > 0) para se
  // diferenciar do "tie" genuíno (0 linhas atrás, ex.: tudo empatado com a média).
  // SH-2.7.1 (Hugo 2026-07-20) — `metricSignals` substitui a chamada direta a
  // `behindMetricsOf` aqui porque a frase precisa da linguagem quantificada por
  // métrica (`opportunityLabelFor`), não só dos labels; `behind` (a lista de
  // labels, usada pela abertura logo abaixo) continua idêntica a
  // `behindMetricsOf(indicators)` — mesma fonte (`metricSignalsOf`), sem
  // recomputar `winnerOf`/`ownPaceSignalFor` uma 3ª vez.
  const allSignals = metricSignalsOf(indicators)
  const metricSignals = allSignals.filter((m) => m.needsAttention)
  const behind = metricSignals.map((m) => m.metric)
  const opportunity =
    behind.length > 0
      ? `Sua oportunidade de melhoria é evoluir em ${joinPt(metricSignals.map(opportunityLabelFor))}.`
      : "Continue nesse ritmo, você está à frente da turma em tudo que acompanhamos."

  // SH-2.7.2 — o ramo "tie com ponto de atenção" (exatamente 1 linha atrás,
  // caso Rinaldo, ver `summaryToneOf`) COMPÕE a mensagem inteira sozinho
  // (`tieAttentionSummary`), separando cada métrica com o PRÓPRIO número em
  // vez do `opportunity` genérico acima (que amarraria um % só a uma lista de
  // várias métricas). Retorna cedo, antes da abertura padrão/clauses abaixo —
  // este ramo NUNCA cai no fluxo genérico.
  const tone = summaryToneOf(indicators)
  if (tone === "tie" && behind.length > 0) {
    return tieAttentionSummary(nameLead, metricSignals)
  }

  // SH-2.8 (Hugo 2026-07-20, caso real Angelo) — dentro do ramo `behind` (2+
  // linhas atrás), um caso ESPECÍFICO: o aluno avançou de verdade no conteúdo
  // (progresso real) mas Interações e/ou Reflexões ficaram desproporcionalmente
  // atrás desse MESMO progresso (`superficialGap`, eixo diferente do
  // `needsAttention` acima, que compara contra a Turma). Também retorna cedo,
  // mesmo padrão de `tieAttentionSummary` — substitui a abertura genérica +
  // `opportunity` por UMA frase que faz o ponto diagnóstico direto.
  const superficialSignals = allSignals.filter((m) => m.superficialGap)
  if (tone === "behind" && superficialSignals.length > 0) {
    return superficialEngagementSummary(nameLead, superficialSignals)
  }

  // 1 — opening, conditioned on the REAL rank (AC7/AC9) FIRST, then on the
  // OVERALL tone (`summaryToneOf`). SH-2.3 (achado do Espelho): a abertura antiga
  // decidia só a partir de `aboveAvgEngagement` — UM dos 5 indicadores —
  // enquanto `summaryToneOf` já olhava os 5 com a hierarquia certa e já
  // governava o ícone/glow do painel. A abertura consome `summaryToneOf` como
  // critério PRIMÁRIO (depois do override real de #1), então NUNCA elogia
  // engajamento isolado quando o tom geral é de atraso. SH-2.5 (item 1): o tom
  // "behind" deixou de ter duas variantes (mild/severe) — collapsa os 2 ramos
  // antigos (2 e 3) num só, com a copy DIRETA que o Hugo pediu.
  // SH-2.6 (Hugo 2026-07-19, feedback ao vivo, caso Rinaldo): "se a gente levar
  // em consideração o Rinaldo está com 4 indicadores acima da média enquanto um
  // vermelho, então ele não pode estar com a frase embaixo vermelho, ele tem que
  // estar com a frase embaixo em âmbar." `summaryToneOf` agora retorna "tie"
  // (não "behind") quando exatamente 1 linha está atrás — a abertura ganha um
  // ramo PRÓPRIO para esse caso, honesto mas mais leve que o "behind" direto,
  // reconhecendo que a maior parte do quadro está bem. SÓ dispara quando há
  // de fato uma métrica fraca (`behind.length > 0`) — um "tie" genuíno (0 linhas
  // atrás, ex.: tudo empatado com a média) continua caindo no ramo neutro de
  // sempre, sem alegar um "ponto de atenção" que não existe. O ramo tie COM
  // ponto de atenção (behind.length > 0) já retornou cedo acima, via
  // `tieAttentionSummary` (SH-2.7.2) — não existe mais aqui.
  const aboveAvgEngagement = winnerOf(s.engagement, r.engagementAvg, "higher") === "subject"
  let opening: string
  if (s.isTopEngagement === true) {
    // 1 — override real de #1 (AC7/AC9 da SH-1.5), intocado.
    opening = `${hi}você é o aluno mais engajado da turma`
  } else if (tone === "behind") {
    // 2 — 2+ linhas atrás dominam (caso Angelo): nunca elogiar quando o tom geral
    // é ruim. SH-2.5 (Hugo, feedback ao vivo): "nao tem dessa de 'um lembrete
    // gentil' tem que ser direto ao ponto 'Rinaldo, para retomar seu ritimo de
    // estudos'" — redação direta, sem suavização, embora o SENTIDO geral
    // continue não-punitivo (convite, nunca repreensão).
    opening = `${nameLead}para retomar o seu ritmo de estudos`
  } else if (aboveAvgEngagement) {
    // 3 — só dispara agora quando o tom geral NÃO é atrás nem "1 linha atrás"
    // (corrige o bug secundário que o Espelho achou: antes disparava mesmo com
    // o aluno atrás em tudo mais).
    opening = `${hi}seu engajamento está acima da média da turma`
  } else {
    // 4 — tom win genérico, tie genuíno (0 atrás) ou none: ramo neutro, sem
    // alegação falsa.
    opening = `${hi}bom te ver de volta ao seu ritmo de estudos`
  }

  // 2 — pace clause, from progress vs org avg. SH-2.7.2 (Hugo 2026-07-20) — a
  // cláusula solta "você se mantém ativo com atividades recentes"
  // (`recencyReadingFor`) foi REMOVIDA: "enchimento residual de uma versão
  // anterior do painel, não agrega nada".
  const clauses: string[] = []
  const progressWinner = winnerOf(s.progressPct, r.progressAvgPct, "higher")
  if (progressWinner === "subject") clauses.push("seu ritmo está acima da média")
  else if (progressWinner === null) clauses.push("seu ritmo acompanha a média")

  const firstSentence = clauses.length > 0 ? `${opening}, ${clauses.join(", ")}.` : `${opening}.`
  return `${firstSentence} ${opportunity}`
}

// ---------------------------------------------------------------------------
// ROUND 18 (Hugo 2026-07-18) — the general tone that governs the summary panel's
// reactive illustration. The table colours EACH ROW by its own tone (Leitura["tone"]);
// the summary panel is about the student's OVERALL standing, so it needs ONE tone
// distilled from the five rows.
//
// DECISION (documented — this is the main judgement of the round): SEVERITY-FIRST with
// a celebratory override, reusing the SAME per-row tone the table already computes (so
// the illustration NEVER contradicts what the rows show). Precedence (current, post
// SH-2.6, see `summaryToneOf`/`SUMMARY_TONE_BEHIND_COUNT_FOR_RED` below for the full
// rationale):
//   1. `isTopEngagement` (real, strict #1) → "win" — the celebratory peak; the student is
//      literally the most engaged of the class, the illustration should celebrate that.
//   2. 2+ rows "behind" → "behind" — a MAJORITY-ish bad picture dominates; showing a
//      trophy (or amber) while the student is badly behind in multiple areas would be
//      dishonest coaching.
//   3. exactly 1 row "behind" → "tie" (SH-2.6) — ONE isolated gap among an otherwise
//      good picture reads as a point of attention, not an overall red alert.
//   4. any row "win" (ahead somewhere, nothing behind) → "win".
//   5. all comparable rows "tie" → "tie" — squarely on the class pace.
//   6. otherwise (only "none": no data / first access) → "none" — still discovering.
// SH-2.5 (Hugo 2026-07-19) — step 2 used to split into "behind-severe"/"behind-mild"
// (two precedence rungs); that distinction was REMOVED (item 1 of SH-2.5, "atrás" é
// só vermelho agora, sem gradiente). The "Última sessão de estudo" row ALSO stopped
// feeding this from `leituraFor` (comparative) and now feeds from `recencyReadingFor`
// (absolute bands, item 3) — see `rowTonesOf` below.
// SH-2.6 (Hugo 2026-07-19) — "any row behind dominates" (old step 2) was too coarse:
// 1 red row among 4 good ones still painted the WHOLE panel red. Replaced by a
// PROPORTION-aware rule (steps 2-3 above) — see the constant's own comment for the
// two validation cases (Rinaldo 1/5→tie, Angelo 4/5→behind) this had to reproduce.
// Rationale: the panel's own paragraph already praises AND names the opportunity; an
// illustration that reflects the WORST area (when there is one) is coherent with that
// dual nature, and honest — it points the eye at what needs attention. The #1 override
// keeps the true high point celebratory. Pure + deterministic (exact-equality testable).
// ---------------------------------------------------------------------------
export type SummaryTone = Leitura["tone"]

/**
 * The five row tones of the "Meu ritmo" table, in the fixed display order.
 * SH-2.5 — "lastAccess" reads from `recencyReadingFor` (absolute recency bands),
 * NOT `leituraFor` (comparative vs the org average) — item 3 decouples this row
 * from the Turma entirely, same as the table itself does.
 */
function rowTonesOf(indicators: StudentHomeIndicators): Leitura["tone"][] {
  const s = indicators.subject
  const r = indicators.reference
  const top = s.isTopEngagement
  return [
    recencyReadingFor(s.lastAccessDays).leitura.tone,
    leituraFor("progress", s.progressPct, r.progressAvgPct, "higher", top).tone,
    leituraFor("sessions", s.interactions, r.interactionsAvg, "higher", top).tone,
    leituraFor("reflections", s.reflections, r.reflectionsAvg, "higher", top).tone,
    leituraFor("engagement", s.engagement, r.engagementAvg, "higher", top).tone,
  ]
}

/**
 * SH-2.6 (Hugo 2026-07-19, feedback ao vivo) — o Hugo viu o Rinaldo com 4 linhas
 * verdes (Última sessão, Interações, Reflexões, Engajamento) + 1 vermelha
 * (Progresso, 50 vs 67) e o painel abriu vermelho. Rejeitou: "se a gente levar em
 * consideração o Rinaldo está com 4 indicadores acima da média enquanto um
 * vermelho, então ele não pode estar com a frase embaixo vermelho, ele tem que
 * estar com a frase embaixo em âmbar." O modelo antigo (severity-first puro, SH-
 * 1.5 Round 18) pegava a PIOR linha isolada — certo para o caso Angelo (4/5
 * vermelhas, o painel DEVE ser vermelho), grosseiro demais para 1 vermelha
 * isolada entre 4 boas. `summaryToneOf` passou a ser sensível à PROPORÇÃO de
 * linhas `behind`, não só à existência de uma:
 *   0 linhas behind  → cai no fallback pré-existente (win se houver alguma
 *                       linha win, tie se só houver ties, none se não houver dado).
 *   1 linha behind   → tom geral "tie" (âmbar) — caso Rinaldo.
 *   2+ linhas behind → tom geral "behind" (vermelho) — caso Angelo.
 * O corte fica em `SUMMARY_TONE_BEHIND_COUNT_FOR_RED` (constante nomeada,
 * candidata ao painel de configuração futuro do Hugo, mesmo espírito de
 * `TONE_THRESHOLDS`/`RECENCY_THRESHOLDS` da SH-2.5) — hoje = 2 (>= 2 linhas
 * behind vira vermelho; exatamente 1 vira âmbar).
 */
export const SUMMARY_TONE_BEHIND_COUNT_FOR_RED = 2

/**
 * The single tone that governs the summary panel illustration. #1 celebratory
 * override, depois PROPORÇÃO de linhas `behind` (SH-2.6) — ver comentário de
 * `SUMMARY_TONE_BEHIND_COUNT_FOR_RED` acima. Pure + deterministic.
 */
export function summaryToneOf(indicators: StudentHomeIndicators): SummaryTone {
  // 1 — real #1 of the class: celebrate.
  if (indicators.subject.isTopEngagement === true) return "win"
  const tones = rowTonesOf(indicators)
  const behindCount = tones.filter((t) => t === "behind").length
  // 2 — SH-2.6: 2+ linhas behind dominam (caso Angelo, 4/5) → vermelho.
  if (behindCount >= SUMMARY_TONE_BEHIND_COUNT_FOR_RED) return "behind"
  // 3 — SH-2.6: exatamente 1 linha behind (caso Rinaldo, 1/5) → âmbar, não vermelho.
  if (behindCount === 1) return "tie"
  // 4 — 0 linhas behind: fallback pré-existente (SH-1.5 Round 18).
  if (tones.includes("win")) return "win"
  if (tones.includes("tie")) return "tie"
  // 5 — no comparable data (first access / missing).
  return "none"
}

// ---------------------------------------------------------------------------
// O NÚMERO EM DESTAQUE (Hugo, 2026-08-03)
// ---------------------------------------------------------------------------
// "a informação principal é justamente que ela parou em 15 das 41, então isso
// tem que ser a informação principal, tem que ter destaque".
//
// O painel renderizava headline + apoio, e a quebra caía na primeira frase. No
// caso do Percorrido isso invertia a hierarquia: a VALIDAÇÃO ("você percorreu o
// conteúdo inteiro, isso é bom") ficava grande e branca, e a LACUNA ("parou aí:
// 15 de 41 reflexões") ficava pequena e apagada. O olho batia primeiro no
// elogio e podia nunca chegar ao número.
//
// A correção é VISUAL, não de copy: a frase permanece exatamente como o Hugo
// aprovou, com a ordem retórica que desarma (valida, depois vira). O que muda é
// que o número ganha um bloco próprio, à esquerda, e passa a ser a primeira
// coisa que o olho encontra. Assim o destaque não custa o desarme.
//
// PURA, como o resto deste arquivo. `null` quando não há lacuna a destacar, e
// aí o painel renderiza como sempre renderizou.

export interface SummaryHighlight {
  /** O número cru: "15 de 41", "4º de 36", "30 dias", "6 módulos". */
  value: string
  /** O que ele conta, em poucas palavras. */
  label: string
  /**
   * A NATUREZA da informação, não o humor dela. É isto que decide a cor, e a
   * distinção importa: "30 dias sem estudar" e "15 de 41 reflexões" são ambos
   * ruins, mas um é ausência (urgente, some se a pessoa voltar) e o outro é
   * lacuna (acumulada, só some com trabalho). Pintar os dois igual apagaria a
   * diferença que muda o que a pessoa deve fazer agora.
   */
  kind: HighlightKind
}

export type HighlightKind =
  /** Sumiu. Urgente e reversível num clique. */
  | "ausencia"
  /** Fez menos do que dá. Acumulada, só fecha com trabalho. */
  | "lacuna"
  /** Está à frente. Vale nomear, não vale gritar. */
  | "conquista"
  /** Onde está em relação aos outros. Informativo, sem juízo. */
  | "posicao"

/**
 * Devolve a informação mais relevante para destacar, ou `null`.
 *
 * A PRECEDÊNCIA é a parte que importa, porque quase sempre mais de um caso se
 * aplica, e destacar dois números é não destacar nenhum:
 *
 *   1. AUSÊNCIA longa. Quem sumiu há duas semanas não tem problema de
 *      quantidade de reflexão, tem problema de não estar aqui. Mostrar a lacuna
 *      para essa pessoa é responder uma pergunta que ela não fez.
 *   2. CONQUISTA de 1º lugar. É o único caso em que o número é boa notícia, e
 *      ele vence a lacuna porque uma pessoa no topo já está fazendo o que se
 *      pediria a ela.
 *   3. LACUNA de reflexões, depois de interações. Reflexão vem primeiro porque
 *      é onde o aluno registra o próprio pensamento, e é a lacuna que o
 *      Percorrido existe para expor.
 *   4. POSIÇÃO. O fallback informativo de quem não tem lacuna nem destaque.
 *
 * PURA. `null` quando nada merece destaque, e aí o painel renderiza como antes.
 */
export function summaryHighlight(indicators: StudentHomeIndicators): SummaryHighlight | null {
  const s = indicators.subject

  // 1. Sumiu faz tempo.
  if (s.lastAccessDays !== null && s.lastAccessDays >= AUSENCIA_DIAS) {
    const dias = s.lastAccessDays
    return {
      value: dias >= 60 ? `${Math.round(dias / 30)} meses` : `${dias} dias`,
      label: "sem estudar",
      kind: "ausencia",
    }
  }

  // 2. Primeiro lugar de verdade (sinal estrito, nunca aproximado).
  if (s.isTopEngagement === true) {
    return { value: "1º", label: "da turma em engajamento", kind: "conquista" }
  }

  // 3. A lacuna: reflexões antes de interações.
  if (s.reflectionsMax && s.reflectionsMax > 0 && s.reflections < s.reflectionsMax) {
    return {
      value: `${s.reflections} de ${s.reflectionsMax}`,
      label: "reflexões registradas",
      kind: "lacuna",
    }
  }
  if (s.interactionsMax && s.interactionsMax > 0 && s.interactions < s.interactionsMax) {
    return {
      value: `${s.interactions} de ${s.interactionsMax}`,
      label: "interações feitas",
      kind: "lacuna",
    }
  }

  // 4. Sem lacuna: a posição, se ela for conhecida.
  if (s.engagementRank && s.engagementTotalStudents) {
    return {
      value: `${s.engagementRank}º`,
      label: `de ${s.engagementTotalStudents} na turma`,
      kind: "posicao",
    }
  }

  return null
}
