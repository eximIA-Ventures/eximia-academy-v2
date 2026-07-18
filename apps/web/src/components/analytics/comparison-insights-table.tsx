// ---------------------------------------------------------------------------
// ComparisonInsightsTable — "Meu ritmo": formato TRANSPOSTO (Hugo 2026-07-14,
// redesenhado em SH-1.5 2026-07-18)
// ---------------------------------------------------------------------------
// Redesign aprovado: uma linha POR INDICADOR, colunas fixas
//   | Indicador | Você (Eu {nome}) | Turma | Como estou |
// 5 linhas, na ordem exata do mockup do Hugo (SH-1.5): Última atividade ·
// Progresso - conclusão · Interações realizadas · Reflexões realizadas ·
// Engajamento. (Engajamento voltou a ser LINHA PRÓPRIA em SH-1.5, como score
// absoluto comparável Você vs Turma; antes de SH-1.5 ele ficava fora da tabela.)
//
// FRAÇÃO GRACIOSA X/Y (SH-1.5, Round 2 Hugo 2026-07-18: nos DOIS lados agora):
//   • Interações realizadas → Você "{interactions}/{interactionsMax}" (Y = capítulos
//     da trilha do aluno); Turma "{interactionsAvg}/{interactionsMaxAvg}" (Y = média
//     dos tetos da org).
//   • Reflexões realizadas  → Você "{reflections}/{reflectionsMax}" (Y = slides com
//     reflexão possível da trilha); Turma "{reflectionsAvg}/{reflectionsMaxAvg}".
//   Cada lado degrada ao absoluto "X" quando o denominador vem ausente/0, sem
//   NaN/crash (formatFraction).
//   Engajamento é ASSIMÉTRICO (Round 2): a célula VOCÊ mostra o RANKING (formatRank,
//   "3º de N", NÃO mais a pontuação), a célula TURMA mostra a média como fração X/Y
//   (formatFraction com engagementMaxAvg). O vencedor/cor/leitura da linha continuam
//   sobre os SCORES brutos (s.engagement vs r.engagementAvg), só o texto muda.
//
// COMO ESTOU — a 4ª coluna (renomeada de "Leitura" em SH-1.5) traduz o vencedor
// de cada indicador (winnerOf) em um CHIP TONAL compacto, com frases mais longas.
// (Round 2, Hugo 2026-07-18: o prefixo "…" foi REMOVIDO de todas as frases; o
// texto começa direto pela palavra.)
//   • aluno acima  → reforço, verde suave + TrendingUp ("acima da média",
//     "ritmo acima da média", "ativo acima da média");
//   • empate       → neutro + Minus ("no ritmo da turma");
//   • aluno abaixo → NUNCA punitivo, sempre acionável, tom cerrado (convite) +
//     seta ("vamos retomar?", "1 sessão te recoloca no ritmo"). Jamais vermelho.
//     [HISTÓRICO SH-1.5/Round 2 — a COR desta regra foi REVERTIDA no Round 3, ver
//     o bloco datado 2026-07-18 logo abaixo. A copy do convite permanece; o que
//     mudou é a temperatura da cor (agora amarelo/vermelho por severidade).]
//   A linha Engajamento tem tratamento ESPECIAL: a frase "1º da turma –
//   Parabéns!" só aparece quando o backend confirma rank real = 1 (sem empate),
//   via `subject.isTopEngagement === true` (AC7). Nunca hardcoded, nunca
//   aproximado — qualquer outro caso cai no fallback padrão win/tie/behind.
//
// SEVERIDADE QUANDO ATRÁS — REVERSÃO EXPLÍCITA DO HUGO (Round 3, 2026-07-18):
//   O comentário histórico logo acima dizia "Jamais vermelho" — essa era a regra
//   de SH-1.5/Round 2: aluno atrás → SEMPRE o tom cerrado (laranja/terroso),
//   nunca vermelho, para não ser punitivo. **O Hugo REVERTEU essa decisão nesta
//   rodada, por escolha própria, olhando o app rodando ao vivo.** Passa a haver
//   DOIS graus de severidade quando o aluno está atrás (winner === "reference"):
//     • "behind-mild"   → AMARELO  (atrás moderado): bg-semantic-warning/10 text-semantic-warning
//     • "behind-severe" → VERMELHO (atrás forte):    bg-semantic-error/10   text-semantic-error
//   O grau vem de `behindSeverityOf` (função pura, direction-aware, ver abaixo),
//   comparado ao SEVERE_BEHIND_THRESHOLD. Vale para as 5 linhas (mudança central,
//   não by-linha). O comentário "Jamais vermelho" foi PRESERVADO de propósito
//   logo acima: documentar a mudança de rumo importa mais que apagar o rastro.
//
// DESTAQUE DO VALOR VENCEDOR (Hugo, iterado 2026-07-14; estendido Round 3
// 2026-07-18): quando o ALUNO vence o indicador, o VALOR da coluna Eu veste o
// PILL original (cápsula semantic-success + texto branco). Round 3: quando o
// aluno está ATRÁS, o valor Eu TAMBÉM vira pill — mas na cor da severidade
// (amarelo ou vermelho), no lugar do texto neutro de antes. Empate continua
// neutro/sem pill. O valor destaca, o chip interpreta. A coluna Turma nunca
// destaca, em nenhum caso.
//
// SEM setas de ordenação (não se ordena uma tabela transposta) e SEM a coluna
// "Onde você está" (removida no formato transposto).
//
// WINNER-PER-INDICATOR (direction-aware, alimenta a Como estou e o destaque acima):
//   • Progresso / Interações / Reflexões / Engajamento → MAIOR vence.
//   • Última atividade → MENOR vence (recência invertida).
// Empate ou valor ausente não gera leitura de vitória/convite.
//
// PARÁGRAFO-RESUMO (SH-1.5): a frase pessoal abaixo da tabela é composta pela
// função pura `buildRitmoSummary` (ritmo-summary.ts), fora deste arquivo — o
// container (StudentHomeCard) chama e renderiza. Ver aquele módulo.
//
// BOTÃO ACIONÁVEL "QUEM ESTÁ MAL" (Round 4, Hugo 2026-07-18, feedback por áudio
// ao vivo): ao lado do chip "Como estou", SÓ quando o aluno está ATRÁS naquele
// indicador (winnerOf === "reference", i.e. tom behind-mild ou behind-severe),
// aparece um LINK COMPACTO que leva o aluno de volta à ação (retomar a trilha,
// registrar uma reflexão, etc.). Em win/tie/none NÃO aparece botão — só o chip
// normal, como antes. A copy do botão é por indicador (ACTION_LABEL, paralela a
// LEITURA_COPY). O destino é SEMPRE o mesmo `continueHref` recebido (o link de
// continuação da trilha que o card já tem): HOJE NÃO EXISTE deep-link para uma
// reflexão ou interação ESPECÍFICA no app, então continuar a trilha naturalmente
// leva o aluno a mais interações/reflexões. Decisão pragmática — se o Hugo pedir
// deep-link específico depois, é só trocar o href por linha. `continueHref` é
// threaded do StudentHomeCard (que já o tem como prop); default seguro
// DEFAULT_CONTINUE_HREF para não obrigar todos os call sites (ver o prop).
//
// Pure presentation. Card-less: o container (StudentHomeCard) é dono do Card,
// do subtítulo e do toggle Visão detalhada/Gráficos. Labels parametrizáveis:
// `studentFirstName` vira o cabeçalho da coluna do sujeito ("Eu (Rinaldo)";
// num drill de gestor, o nome do aluno), degradando para "Você".
// ---------------------------------------------------------------------------

import type { StudentHomeIndicators } from "@/types/analytics"
import type { LucideIcon } from "lucide-react"
import { ArrowRight, Minus, TrendingUp } from "lucide-react"
import Link from "next/link"
import { DEFAULT_CONTINUE_HREF } from "./student-comparison-view"

const WIN_BG = "var(--color-semantic-success)"
const WIN_TEXT = "#ffffff"
const BAR_TRACK = "var(--color-bg-hover)"
const BAR_FILL = "rgba(0, 0, 0, 0.25)"
const BAR_WIN_FILL = "var(--color-semantic-success)"

/** Which side wins an indicator. null = tie, missing, or a no-winner column. */
type Winner = "subject" | "reference" | null

/**
 * The winning side of an indicator, DIRECTION-AWARE (Hugo): "higher" → larger
 * value wins (progresso, sessões, reflexões); "lower" → smaller wins (último
 * acesso, a recência invertida). null on tie or when either value is missing.
 */
export function winnerOf(
  subject: number | null,
  reference: number | null,
  direction: "higher" | "lower",
): Winner {
  if (subject === null || reference === null) return null
  if (subject === reference) return null
  if (direction === "higher") return subject > reference ? "subject" : "reference"
  return subject < reference ? "subject" : "reference"
}

/**
 * SEVERE_BEHIND_THRESHOLD (Round 3, Hugo 2026-07-18) — o corte entre "atrás
 * moderado" (amarelo) e "atrás forte" (vermelho), como FRAÇÃO relativa do valor
 * da turma. 0.3 = 30%: se o aluno está mais de 30% abaixo da referência, é
 * severe (vermelho); até 30%, mild (amarelo). Número escolhido para ser fácil de
 * reajustar (constante nomeada); o Hugo pode subir/descer sem tocar a lógica.
 */
const SEVERE_BEHIND_THRESHOLD = 0.3

/** Grau de "quão atrás" o aluno está, para escolher amarelo (mild) ou vermelho (severe). */
type BehindSeverity = "mild" | "severe"

/**
 * SEVERIDADE do atraso (Round 3, Hugo 2026-07-18) — pura, DIRECTION-AWARE, reusa
 * a mesma noção de direção de `winnerOf`. Só faz sentido chamar quando o aluno JÁ
 * está confirmadamente atrás (`winnerOf(...) === "reference"`), então NÃO trata o
 * caso "não atrás" — assume gap positivo.
 *
 *   relativeGap = direction === "higher"
 *     ? (reference - subject) / max(reference, 1)   // maior é melhor: falta subir
 *     : (subject - reference) / max(reference, 1)    // menor é melhor: excedeu p/ pior
 *
 * relativeGap > SEVERE_BEHIND_THRESHOLD (30%) → "severe" (vermelho); caso
 * contrário → "mild" (amarelo). O divisor Math.max(reference, 1) evita divisão
 * por zero quando a referência é 0.
 */
export function behindSeverityOf(
  subject: number,
  reference: number,
  direction: "higher" | "lower",
): BehindSeverity {
  const relativeGap =
    direction === "higher"
      ? (reference - subject) / Math.max(reference, 1)
      : (subject - reference) / Math.max(reference, 1)
  return relativeGap > SEVERE_BEHIND_THRESHOLD ? "severe" : "mild"
}

/**
 * PONTO 1 acréscimo (Hugo 2026-07-14) — a label da coluna do sujeito: 1ª pessoa
 * + o PRIMEIRO nome real do aluno logado, "Eu (Rinaldo)". Recebendo o nome
 * completo, usa só o primeiro token; sem nome utilizável degrada para "Você"
 * (o cabeçalho aprovado do formato transposto). Pure.
 */
export function subjectColumnLabel(firstName: string | null | undefined): string {
  const first = firstName?.trim().split(/\s+/)[0]
  return first ? `Eu (${first})` : "Você"
}

/** "há X dias" / "hoje" — for the Último acesso cells. null → placeholder. */
function formatDays(days: number | null, whenNull: string): string {
  if (days === null) return whenNull
  if (days <= 0) return "hoje"
  if (days === 1) return "há 1 dia"
  return `há ${days} dias`
}

// SH-1.5 — a 5ª linha "Engajamento" (score absoluto Você vs Turma). A ordem/labels
// mudam (mockup do Hugo), mas as CHAVES internas preservam os nomes já testados de
// SH-F.5 e agregam `engagement`. `winnerOf`/`leituraFor` seguem intocados.
type RowKey = "lastAccess" | "progress" | "sessions" | "reflections" | "engagement"

/**
 * A coluna "Como estou" (SH-1.5, renomeada de "Leitura") — copy por indicador ×
 * resultado, frases mais longas que o chip antigo (Round 2, Hugo 2026-07-18: sem
 * o prefixo "…", o texto começa direto pela palavra). Regra de tom
 * (Hugo, PRESERVADA): acima = reforço; empate = neutro; abaixo = acionável, nunca
 * punitivo. A linha `engagement` tem tratamento ESPECIAL (rank real, ver
 * `leituraFor`): o `win` genérico aqui só entra quando o aluno vence a média mas
 * NÃO é o #1 real da turma.
 */
const LEITURA_COPY: Record<RowKey, { win: string; tie: string; behind: string }> = {
  lastAccess: {
    win: "ativo acima da média",
    tie: "no ritmo da turma",
    behind: "vamos retomar?",
  },
  progress: {
    win: "ritmo acima da média",
    tie: "no ritmo da turma",
    behind: "1 sessão te recoloca no ritmo",
  },
  sessions: {
    win: "acima da média",
    tie: "no ritmo da turma",
    behind: "que tal mais uma hoje?",
  },
  reflections: {
    win: "acima da média",
    tie: "no ritmo da turma",
    behind: "suas reflexões contam, registre uma",
  },
  engagement: {
    win: "acima da média",
    tie: "no ritmo da turma",
    behind: "vamos engajar mais?",
  },
}

/**
 * SH-1.5 (AC7) — a leitura ESPECIAL da linha Engajamento quando o aluno é o #1 real
 * da turma (rank confirmado no backend, `subject.isTopEngagement === true`). Só esta
 * frase carrega a alegação de 1º lugar; qualquer outro caso cai no fallback padrão.
 */
const TOP_ENGAGEMENT_COPY = "1º da turma – Parabéns!"

/**
 * ROUND 4 (Hugo 2026-07-18) — a label do BOTÃO ACIONÁVEL que aparece ao lado do
 * chip "Como estou" SÓ quando o aluno está atrás naquele indicador. Paralela a
 * LEITURA_COPY: reaproveita o TOM do convite de `LEITURA_COPY[key].behind`, mas
 * como texto de BOTÃO curto e imperativo (o chip descreve o estado, o botão chama
 * à ação). Uma por RowKey.
 */
const ACTION_LABEL: Record<RowKey, string> = {
  lastAccess: "Retomar atividade",
  progress: "Continuar sessão",
  sessions: "Fazer uma interação",
  reflections: "Registrar uma reflexão",
  engagement: "Continuar agora",
}

/**
 * Formata a célula de VALOR de uma métrica que pode ter fração "X/Y" (SH-1.5).
 * Denominador presente e > 0 → "X/Y" (ex.: "7/10"); ausente/0 → o absoluto "X"
 * (degradação graciosa, AC3/AC4/AC10 — sem NaN, sem Infinity, sem crash). Pure.
 */
export function formatFraction(value: number, max: number | undefined | null): string {
  if (max != null && max > 0) return `${value}/${max}`
  return String(value)
}

/**
 * SH-1.5 Round 2 (Hugo 2026-07-18) — formats the "Você" Engajamento cell as a
 * RANKING position ("3º de 15") instead of a raw score. Both rank and total must
 * be present, finite and ≥1 with rank ≤ total; anything malformed/absent degrades
 * to "—" (same defensive style as formatFraction — never NaN, never a crash).
 * Notation chosen (Hugo can retune): "{rank}º de {total}", pt-BR ordinal + "de".
 * Pure.
 */
export function formatRank(
  rank: number | undefined | null,
  total: number | undefined | null,
): string {
  if (rank == null || total == null) return "—"
  if (!Number.isFinite(rank) || !Number.isFinite(total)) return "—"
  if (rank < 1 || total < 1 || rank > total) return "—"
  return `${rank}º de ${total}`
}

/**
 * Round 3 (Hugo 2026-07-18) — `"behind"` foi SEPARADO em dois tons de severidade:
 * `"behind-mild"` (amarelo) e `"behind-severe"` (vermelho). Ver `behindSeverityOf`
 * e o bloco datado no topo do arquivo (reversão explícita do "Jamais vermelho").
 */
export interface Leitura {
  text: string
  tone: "win" | "tie" | "behind-mild" | "behind-severe" | "none"
}

/**
 * Deriva a Leitura de um indicador dos vencedores que a tabela computa
 * (winnerOf) — nunca uma conta paralela. Valor ausente de qualquer lado → "—"
 * (sem leitura possível, não é empate). Pure, exported for tests.
 *
 * Round 3 (Hugo 2026-07-18): quando o aluno está atrás, o tom já não é o único
 * "behind"; `behindSeverityOf` decide entre `behind-mild` (amarelo) e
 * `behind-severe` (vermelho). A COPY do convite é a mesma (`copy.behind`); só o
 * tom (a cor) reflete a severidade.
 */
export function leituraFor(
  key: RowKey,
  subject: number | null,
  reference: number | null,
  direction: "higher" | "lower",
  /**
   * SH-1.5 (AC7) — REAL rank signal, consumed ONLY for the `engagement` row: when
   * TRUE and the student is winning that row, the reading becomes "1º da turma".
   * NEVER hardcoded, NEVER approximated — it reflects a backend rank of exactly 1
   * (no tie, AC12). Any other row, or `false`/absent, uses the standard copy.
   */
  isTopEngagement?: boolean,
): Leitura {
  if (subject === null || reference === null) return { text: "—", tone: "none" }
  const winner = winnerOf(subject, reference, direction)
  const copy = LEITURA_COPY[key]
  if (winner === "subject") {
    // AC7 — the "1º da turma" claim is unlocked SOLELY by the real rank signal.
    if (key === "engagement" && isTopEngagement === true) {
      return { text: TOP_ENGAGEMENT_COPY, tone: "win" }
    }
    return { text: copy.win, tone: "win" }
  }
  if (winner === "reference") {
    // Round 3 — o aluno está atrás: a severidade da COR (não da copy) vem de
    // behindSeverityOf. subject/reference são não-nulos aqui (guardado acima).
    const severity = behindSeverityOf(subject, reference, direction)
    return { text: copy.behind, tone: severity === "severe" ? "behind-severe" : "behind-mild" }
  }
  return { text: copy.tie, tone: "tie" }
}

/**
 * O chip tonal da Leitura — fundo suave + texto na cor semântica + ícone
 * pequeno. Verde (reforço) / neutro (no ritmo).
 * Round 3 (Hugo 2026-07-18): o antigo `behind` cerrado único deu lugar a DOIS
 * tons de severidade — `behind-mild` AMARELO (bg/text-semantic-warning) e
 * `behind-severe` VERMELHO (bg/text-semantic-error). Tokens semânticos do design
 * system (theme.css `@theme`), já usados app-wide para warning/danger.
 */
const LEITURA_CHIP: Record<
  Exclude<Leitura["tone"], "none">,
  { className: string; Icon: LucideIcon }
> = {
  win: { className: "bg-semantic-success/10 text-semantic-success", Icon: TrendingUp },
  tie: { className: "bg-black/5 text-text-secondary dark:bg-white/10", Icon: Minus },
  "behind-mild": {
    className: "bg-semantic-warning/10 text-semantic-warning",
    Icon: ArrowRight,
  },
  "behind-severe": {
    className: "bg-semantic-error/10 text-semantic-error",
    Icon: ArrowRight,
  },
}

function LeituraChip({ leitura, testid }: { leitura: Leitura; testid: string }) {
  if (leitura.tone === "none") {
    return (
      <span data-testid={testid} data-tone="none" className="text-xs text-text-muted">
        {leitura.text}
      </span>
    )
  }
  const { className, Icon } = LEITURA_CHIP[leitura.tone]
  return (
    <span
      data-testid={testid}
      data-tone={leitura.tone}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${className}`}
    >
      <Icon size={12} aria-hidden="true" className="shrink-0" />
      {leitura.text}
    </span>
  )
}

/**
 * ROUND 4 (Hugo 2026-07-18) — o BOTÃO ACIONÁVEL ao lado do chip "Como estou".
 * Versão COMPACTA do CTA "Continuar agora" do painel (student-home-card.tsx):
 * mesma linguagem visual laranja (bg-cerrado-600 + hover:bg-cerrado-500 + seta),
 * mas menor porque vive numa célula de tabela ao lado do chip (h-7, px-2.5,
 * texto 11px). Só é renderizado quando o aluno está atrás (o call site gate). O
 * href é o `continueHref` da trilha — mesmo destino para todas as linhas hoje
 * (sem deep-link específico, ver o comentário de topo do arquivo).
 */
function ActionButton({ href, label, testid }: { href: string; label: string; testid: string }) {
  return (
    <Link
      href={href}
      data-testid={testid}
      className="inline-flex h-7 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full bg-cerrado-600 px-2.5 text-[11px] font-semibold text-white transition-colors hover:bg-cerrado-500 active:scale-95"
    >
      {label}
      <ArrowRight size={12} aria-hidden="true" className="shrink-0" />
    </Link>
  )
}

interface HomeRow {
  key: RowKey
  label: string
  direction: "higher" | "lower"
  /** Comparable numeric values (null → not comparable / missing). */
  subjectValue: number | null
  referenceValue: number | null
  /** Rendered cell content. */
  subjectNode: React.ReactNode
  referenceNode: React.ReactNode
  /** true → the % progress bar is drawn under the value. */
  isPct?: boolean
}

// SH-1.5 — ORDEM EXATA do mockup do Hugo (2026-07-18): Última atividade →
// Progresso - conclusão → Interações realizadas → Reflexões realizadas →
// Engajamento. Labels renomeados; frações X/Y em Interações/Reflexões (denominador
// da PRÓPRIA trilha, degrada ao absoluto); Engajamento é score ABSOLUTO (sem
// fração — a fração de SH-F.5 vive só na leitura "Como estou", via rank real).
function buildRows(indicators: StudentHomeIndicators): HomeRow[] {
  const s = indicators.subject
  const r = indicators.reference
  return [
    {
      key: "lastAccess",
      label: "Última atividade",
      direction: "lower", // menos dias = melhor (recência invertida)
      subjectValue: s.lastAccessDays,
      referenceValue: r.lastAccessAvgDays,
      // AJUSTE 2 (Hugo 2026-07-14): a célula Você mostra a PENÚLTIMA visita.
      // null = não há acesso anterior — o aluno está acessando AGORA pela
      // primeira vez, então o rótulo honesto é "Primeiro acesso" (nunca "nunca").
      subjectNode: formatDays(s.lastAccessDays, "Primeiro acesso"),
      referenceNode: formatDays(r.lastAccessAvgDays, "—"),
    },
    {
      key: "progress",
      label: "Progresso - conclusão",
      direction: "higher",
      subjectValue: s.progressPct,
      referenceValue: r.progressAvgPct,
      subjectNode: `${s.progressPct}%`,
      referenceNode: `${r.progressAvgPct}%`,
      isPct: true,
    },
    {
      // `interactions` = sessões concluídas ("interações realizadas") no payload.
      // SH-1.5 — fração "X/Y" nos DOIS lados (Round 2, Hugo 2026-07-18): Você usa o
      // teto da PRÓPRIA trilha (interactionsMax); Turma usa a MÉDIA dos tetos da org
      // (interactionsMaxAvg). Cada lado degrada ao absoluto se o denominador vier
      // ausente/0 (formatFraction), sem crash.
      key: "sessions",
      label: "Interações realizadas",
      direction: "higher",
      subjectValue: s.interactions,
      referenceValue: r.interactionsAvg,
      subjectNode: formatFraction(s.interactions, s.interactionsMax),
      referenceNode: formatFraction(r.interactionsAvg, r.interactionsMaxAvg),
    },
    {
      // SH-1.5 — fração "X/Y" nos DOIS lados (Round 2): Você usa reflectionsMax da
      // própria trilha; Turma usa reflectionsMaxAvg (média dos tetos da org).
      key: "reflections",
      label: "Reflexões realizadas",
      direction: "higher",
      subjectValue: s.reflections,
      referenceValue: r.reflectionsAvg,
      subjectNode: formatFraction(s.reflections, s.reflectionsMax),
      referenceNode: formatFraction(r.reflectionsAvg, r.reflectionsMaxAvg),
    },
    {
      // SH-1.5 Round 2 (Hugo 2026-07-18) — a linha Engajamento assimétrica por
      // decisão do Hugo: a célula VOCÊ mostra o RANKING (formatRank, "3º de N"), não
      // mais o score; a célula TURMA mostra a média de pontos como fração X/Y
      // (formatFraction com engagementMaxAvg). A leitura "Como estou" e o
      // vencedor/cor CONTINUAM baseados nos scores brutos (subjectValue/referenceValue
      // = s.engagement/r.engagementAvg), SEM mudança — só o TEXTO exibido muda.
      key: "engagement",
      label: "Engajamento",
      direction: "higher",
      subjectValue: s.engagement,
      referenceValue: r.engagementAvg,
      subjectNode: formatRank(s.engagementRank, s.engagementTotalStudents),
      referenceNode: formatFraction(r.engagementAvg, r.engagementMaxAvg),
    },
  ]
}

/**
 * O pill do valor VENCEDOR (aluno acima) — cápsula verde original.
 * Round 3 (Hugo 2026-07-18): quando o aluno está ATRÁS, a célula Você também
 * ganha pill, mas na cor da severidade — amarelo (mild) ou vermelho (severe).
 * Tokens semânticos do design system (mesmos do chip da Leitura), aplicados como
 * fundo suave + texto na cor semântica (não texto branco: o fundo aqui é /10, não
 * sólido, para não competir em peso com o pill verde de vitória).
 */
const VALUE_PILL: Record<"behind-mild" | "behind-severe", string> = {
  "behind-mild": "bg-semantic-warning/10 text-semantic-warning",
  "behind-severe": "bg-semantic-error/10 text-semantic-error",
}

/**
 * One value cell. `pill` decide o destaque:
 *   • "win"          → pill verde sólido (o ALUNO venceu o indicador, estilo original);
 *   • "behind-mild"  → pill amarelo suave (Round 3: aluno atrás moderado);
 *   • "behind-severe"→ pill vermelho suave (Round 3: aluno atrás forte);
 *   • null           → texto neutro (empate, ou coluna Turma — que NUNCA destaca).
 * `data-win` permanece como semântica testável do vencedor direction-aware nos dois lados.
 */
function ValueCell({
  testid,
  win,
  pill,
  dim,
  children,
}: {
  testid: string
  win: boolean
  /** O tipo de destaque do valor, ou null para texto neutro. Turma sempre null. */
  pill: "win" | "behind-mild" | "behind-severe" | null
  dim: boolean
  children: React.ReactNode
}) {
  if (pill === "win") {
    return (
      <span
        data-testid={testid}
        data-win={win ? "true" : "false"}
        style={{ backgroundColor: WIN_BG, color: WIN_TEXT }}
        className="inline-flex items-center rounded-full px-3 py-1 text-sm font-bold tabular-nums shadow-sm"
      >
        {children}
      </span>
    )
  }
  if (pill === "behind-mild" || pill === "behind-severe") {
    return (
      <span
        data-testid={testid}
        data-win={win ? "true" : "false"}
        className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-bold tabular-nums ${VALUE_PILL[pill]}`}
      >
        {children}
      </span>
    )
  }
  return (
    <span
      data-testid={testid}
      data-win={win ? "true" : "false"}
      className={`text-sm tabular-nums ${dim ? "font-medium text-text-muted" : "font-semibold text-text-primary"}`}
    >
      {children}
    </span>
  )
}

/**
 * Round 3 (Hugo 2026-07-18) — o pill do valor da célula VOCÊ a partir do vencedor
 * da linha + o tom da Leitura (fonte única de severidade). Vitória → verde;
 * aluno atrás → cor da severidade (amarelo mild / vermelho severe); empate,
 * ausente ou aluno não-atrás sem vitória → sem pill (texto neutro). Pure,
 * exported for tests. NÃO se aplica à coluna Turma (que passa pill={null} fixo).
 */
export function subjectPillFor(
  winner: Winner,
  tone: Leitura["tone"],
): "win" | "behind-mild" | "behind-severe" | null {
  if (winner === "subject") return "win"
  if (winner === "reference") {
    if (tone === "behind-severe") return "behind-severe"
    if (tone === "behind-mild") return "behind-mild"
  }
  return null
}

/** The % progress bar — verde quando o ALUNO vence a linha; neutra no resto. */
function PctBar({ pct, win }: { pct: number | null; win: boolean }) {
  if (pct === null) return null
  return (
    <div
      style={{ backgroundColor: BAR_TRACK }}
      className="mx-auto mt-2 h-1.5 w-16 overflow-hidden rounded-full"
    >
      {pct > 0 && (
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(100, Math.max(0, pct))}%`,
            backgroundColor: win ? BAR_WIN_FILL : BAR_FILL,
          }}
        />
      )}
    </div>
  )
}

export function ComparisonInsightsTable({
  indicators,
  studentFirstName,
  continueHref = DEFAULT_CONTINUE_HREF,
}: {
  indicators: StudentHomeIndicators
  /**
   * A label da coluna do sujeito: no aluno logado, "Eu (Nome)"; num drill de
   * gestor, o primeiro nome do aluno visto. Ausente → "Você".
   */
  studentFirstName?: string | null
  /**
   * ROUND 4 (Hugo 2026-07-18) — o destino do BOTÃO ACIONÁVEL que aparece ao lado
   * do chip "Como estou" quando o aluno está atrás. É o mesmo link de continuação
   * da trilha que o StudentHomeCard já tem (threaded a partir dele). Opcional com
   * default seguro (DEFAULT_CONTINUE_HREF) para não quebrar call sites/testes que
   * renderizam a tabela sem passar o href — o único uso real (student-home-card)
   * sempre passa o valor concreto.
   */
  continueHref?: string
}) {
  const rows = buildRows(indicators)

  return (
    // Framed "micro-table" — the manager finish (bordered, rounded, light header
    // row, row dividers). Same grammar as the gestor "Tabela simplificada",
    // agora SEM setas de ordenação (tabela transposta não ordena).
    <div
      className="overflow-hidden rounded-xl"
      style={{ border: "1px solid var(--color-border-subtle)" }}
      data-testid="comparison-insights-table"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr
              style={{
                backgroundColor: "var(--color-bg-elevated)",
                borderBottom: "1px solid var(--color-border-subtle)",
              }}
            >
              <th className="px-4 py-3 text-left">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Indicador
                </span>
              </th>
              <th className="px-4 py-3 text-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-primary">
                  {subjectColumnLabel(studentFirstName)}
                </span>
              </th>
              <th className="px-4 py-3 text-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Turma
                </span>
              </th>
              <th className="px-4 py-3 text-left">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Como estou
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const winner = winnerOf(row.subjectValue, row.referenceValue, row.direction)
              const leitura = leituraFor(
                row.key,
                row.subjectValue,
                row.referenceValue,
                row.direction,
                // AC7 — the real rank signal only affects the Engajamento row; any
                // other row ignores it. Absent → treated as not-#1 (standard copy).
                indicators.subject.isTopEngagement,
              )
              return (
                <tr
                  key={row.key}
                  data-testid={`row-${row.key}`}
                  className="transition-colors hover:bg-bg-hover"
                  style={i > 0 ? { borderTop: "1px solid var(--color-border-subtle)" } : undefined}
                >
                  <td className="px-4 py-4 text-left">
                    <span className="text-sm font-semibold text-text-primary">{row.label}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <ValueCell
                      testid={`cell-subject-${row.key}`}
                      win={winner === "subject"}
                      // Round 3 (Hugo 2026-07-18) — o pill do valor Você segue o
                      // resultado: vitória → verde; atrás → cor da severidade
                      // (amarelo/vermelho, mesma fonte de verdade da Leitura);
                      // empate/ausente → sem pill (null).
                      pill={subjectPillFor(winner, leitura.tone)}
                      dim={false}
                    >
                      {row.subjectNode}
                    </ValueCell>
                    {/* Round 3 (Hugo 2026-07-18) — SÓ na linha Engajamento a célula
                        Você ganha uma 2ª linha muted com a pontuação bruta que
                        vivia aqui antes. As outras 4 linhas NÃO têm esta legenda. */}
                    {row.key === "engagement" && (
                      <div
                        data-testid="cell-subject-engagement-raw"
                        className="mt-1 text-xs text-text-muted"
                      >
                        {`Você fez ${indicators.subject.engagement} pontos`}
                      </div>
                    )}
                    {row.isPct && <PctBar pct={row.subjectValue} win={winner === "subject"} />}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <ValueCell
                      testid={`cell-reference-${row.key}`}
                      win={winner === "reference"}
                      // A coluna Turma NUNCA destaca — pill sempre null (preservado).
                      pill={null}
                      dim={true}
                    >
                      {row.referenceNode}
                    </ValueCell>
                    {row.isPct && <PctBar pct={row.referenceValue} win={false} />}
                  </td>
                  <td className="px-4 py-4 text-left">
                    {/* ROUND 4 (Hugo 2026-07-18) — chip + botão acionável na MESMA
                        célula. O botão SÓ aparece quando o aluno está atrás
                        (winner === "reference", mesma condição do chip amarelo/
                        vermelho da Round 3). flex-wrap: em telas estreitas o botão
                        cai para a linha de baixo em vez de estourar a célula. */}
                    <div className="flex flex-wrap items-center gap-2">
                      <LeituraChip leitura={leitura} testid={`leitura-${row.key}`} />
                      {winner === "reference" && (
                        <ActionButton
                          href={continueHref}
                          label={ACTION_LABEL[row.key]}
                          testid={`action-${row.key}`}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
