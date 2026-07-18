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
//   Engajamento é ASSIMÉTRICO (Round 2 + Round 6): a célula VOCÊ mostra o RANKING
//   (formatRank), e a célula TURMA mostra a média de pontos em texto. Round 6 (Hugo
//   2026-07-18, feedback por áudio olhando o app ao vivo) fez QUATRO ajustes nesta
//   linha e no ranking:
//     (a) [aplicado por agente anterior] a célula TURMA perdeu o DENOMINADOR: passou
//         do "13/57" para o número absoluto "13" (o "/57", teto engagementMaxAvg,
//         confundia ao vivo);
//     (b) [aplicado por agente anterior] o BOTÃO acionável virou UNIVERSAL (ver bloco
//         próprio abaixo);
//     (c) o RANKING da célula VOCÊ perdeu o "de N": mostra SÓ a posição "3º", não mais
//         "3º de 15" (o Hugo tirou o total de alunos — "tira o 46" no app real; a
//         posição importa, o tamanho da população não). formatRank ainda RECEBE e
//         VALIDA `total` (rank tem de ser ≤ total p/ ser válido), só não o exibe;
//     (d) a célula TURMA de Engajamento foi CONSOLIDADA numa ÚNICA frase "a turma fez,
//         em média, {N} pontos". Antes tinha o número solto "13" (ValueCell) MAIS a
//         legenda-espelho "Turma fez {N} pontos, em média" (Round 5) embaixo — dois
//         elementos redundantes. Agora é só a frase, sem número isolado acima, e sem a
//         legenda `-raw` separada. Interações/Reflexões seguem com fração X/Y nos dois
//         lados (não mudaram no Round 6). O vencedor/cor/leitura da linha continuam
//         sobre os SCORES brutos (s.engagement vs r.engagementAvg), só o texto muda.
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
// BOTÃO ACIONÁVEL UNIVERSAL (Round 4 → generalizado no Round 6, Hugo 2026-07-18,
// feedback por áudio ao vivo): ao lado do chip "Como estou" aparece um LINK
// COMPACTO que leva o aluno de volta à ação (retomar a trilha, registrar uma
// reflexão, etc.).
//   • Round 4 (histórico): o botão só aparecia quando o aluno estava ATRÁS naquele
//     indicador (winnerOf === "reference"), como convite condicional para quem
//     estava mal. Em win/tie/none não aparecia.
//   • Round 6 (MUDANÇA): o gate `winner === "reference"` foi REMOVIDO. O botão passa
//     a ser UNIVERSAL — renderizado em TODAS as 5 linhas, independentemente de o
//     aluno estar ganhando, empatado ou atrás. Deixou de ser "convite para quem está
//     mal" e virou um CTA de "continue melhorando" (o Hugo, olhando o app ao vivo:
//     "mesmo para o Rinaldo, tem que ter os botões para melhorar ainda mais a
//     performance dele"). A COR é sempre a mesma (cerrado/laranja) para todas as
//     linhas — NÃO varia por severidade (o Hugo pediu só presença universal). A
//     severidade amarelo/vermelho do CHIP e do PILL do valor (Round 3) segue
//     intocada, ainda condicionada a winner === "reference".
// A copy do botão é por indicador (ACTION_LABEL, paralela a LEITURA_COPY) — os
// labels já são neutros/genéricos o suficiente para servir tanto a quem está atrás
// quanto a quem está ganhando, sem reescrita. O destino é SEMPRE o mesmo
// `continueHref` recebido (o link de continuação da trilha que o card já tem): HOJE
// NÃO EXISTE deep-link para uma reflexão ou interação ESPECÍFICA no app, então
// continuar a trilha naturalmente leva o aluno a mais interações/reflexões. Decisão
// pragmática — se o Hugo pedir deep-link específico depois, é só trocar o href por
// linha. `continueHref` é threaded do StudentHomeCard (que já o tem como prop);
// default seguro DEFAULT_CONTINUE_HREF para não obrigar todos os call sites.
//
// COR DO BOTÃO RELATIVA AO "COMO ESTOU" (Round 7, Hugo 2026-07-18, feedback por
// áudio olhando o app ao vivo): "faça uma melhoria nos botões de ação e faça com que
// eles sejam relativos ao 'Como estou', de cores e relação." Até a Round 6 o
// ActionButton era SEMPRE cerrado/laranja (`bg-cerrado-600`), uma cor fixa
// desconectada do status da linha. Agora a cor de FUNDO do botão ESPELHA o tom da
// leitura da MESMA linha (`leitura.tone`), criando uma relação visual coerente entre
// o chip "Como estou" e o botão logo ao lado. A paleta vive em `ACTION_BUTTON_STYLE`
// (paralela a `LEITURA_CHIP`), indexada pelos 5 tons possíveis:
//   • win          → VERDE sólido (bg-semantic-success text-white): CTA positivo de
//     "continue assim", suave, não gritante.
//   • tie          → NEUTRO (mesma família cinza/muted do LEITURA_CHIP.tie).
//   • behind-mild  → ÂMBAR/AMARELO (bg-semantic-warning), espelhando o chip mild. O
//     token warning é claro (oklch 0.8 de lightness), então o par de texto é
//     text-black/80 — NÃO branco. Este par (fundo warning sólido + texto escuro) é o
//     MESMO padrão de contraste já validado no app (analytics-dashboard.tsx usa
//     `bg-semantic-warning/70 text-black/70`), reusado aqui em vez de inventar novo.
//   • behind-severe→ VERMELHO sólido (bg-semantic-error text-white), espelhando o
//     chip severe, forte para comunicar urgência real. O token error é oklch 0.6
//     (escuro), então texto branco tem contraste OK (mesmo par de
//     trails-list-client.tsx `bg-semantic-success text-white`).
//   • none         → o CERRADO/laranja ORIGINAL (bg-cerrado-600 text-white), mantido
//     como fallback neutro-padrão quando não há leitura possível (dado ausente).
// A relação chip↔botão é DIRETA: mesma fonte de verdade (`leitura.tone`), nenhuma
// conta paralela. O CHIP fica no tom suave (/10 de fundo + texto na cor semântica); o
// BOTÃO fica no tom SÓLIDO (fundo cheio + texto de contraste), porque é um CTA — mais
// peso visual que o chip descritivo. Texto/ícone/href/comportamento do botão
// PRESERVADOS da Round 6; só a classe de cor (fundo + hover) muda por tom. O botão
// segue UNIVERSAL (Round 6): aparece nas 5 linhas sempre, ganhando/empatando/atrás.
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
 * RANKING position instead of a raw score.
 *
 * Round 6 (Hugo 2026-07-18) — the notation DROPPED the "de {total}" suffix: the
 * cell now shows ONLY the position ("3º"), not "3º de 15". Looking at the live app,
 * the "de N" (the total headcount of the org) added noise without helping — the
 * student cares about their own position, not the population size. `total` is STILL
 * received and STILL validated defensively (rank must be ≥1, finite, and ≤ total for
 * the position to be meaningful — a rank above the population is malformed data), but
 * it no longer appears in the rendered TEXT. Both rank and total must be present,
 * finite and ≥1 with rank ≤ total; anything malformed/absent degrades to "—" (same
 * defensive style as formatFraction — never NaN, never a crash). Notation (Hugo can
 * retune): "{rank}º", pt-BR ordinal, position only. Pure.
 */
export function formatRank(
  rank: number | undefined | null,
  total: number | undefined | null,
): string {
  if (rank == null || total == null) return "—"
  if (!Number.isFinite(rank) || !Number.isFinite(total)) return "—"
  if (rank < 1 || total < 1 || rank > total) return "—"
  return `${rank}º`
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
 * ROUND 7 (Hugo 2026-07-18) — a paleta de COR do ActionButton por tom da leitura,
 * PARALELA a `LEITURA_CHIP`. Indexada pelos 5 tons possíveis de `Leitura["tone"]`.
 * O botão é um CTA, então usa tons SÓLIDOS (fundo cheio + texto de contraste),
 * enquanto o chip usa tons suaves (/10 de fundo). Contraste reusa pares JÁ validados
 * no app (ver bloco de topo do arquivo): warning claro → texto escuro; success/error
 * → texto branco. `none` = o cerrado/laranja original preservado como fallback.
 * Cada entrada inclui o `hover:` correspondente para preservar o feedback de hover.
 */
const ACTION_BUTTON_STYLE: Record<Leitura["tone"], string> = {
  win: "bg-semantic-success text-white hover:brightness-110",
  tie: "bg-black/10 text-text-secondary hover:bg-black/15 dark:bg-white/15 dark:hover:bg-white/20",
  "behind-mild": "bg-semantic-warning text-black/80 hover:brightness-105",
  "behind-severe": "bg-semantic-error text-white hover:brightness-110",
  none: "bg-cerrado-600 text-white hover:bg-cerrado-500",
}

/**
 * ROUND 4 (Hugo 2026-07-18) — o BOTÃO ACIONÁVEL ao lado do chip "Como estou".
 * Versão COMPACTA do CTA "Continuar agora" do painel (student-home-card.tsx),
 * menor porque vive numa célula de tabela ao lado do chip (h-7, px-2.5, texto 11px).
 * Round 6 (Hugo 2026-07-18): renderizado em TODAS as linhas incondicionalmente (o
 * call site perdeu o gate `winner === "reference"`). O href é o `continueHref` da
 * trilha — mesmo destino para todas as linhas hoje (sem deep-link específico, ver o
 * comentário de topo do arquivo).
 * Round 7 (Hugo 2026-07-18): a COR de fundo deixou de ser fixa (cerrado) e passou a
 * ESPELHAR o `tone` da leitura da linha, via `ACTION_BUTTON_STYLE`. Texto/ícone/href/
 * comportamento PRESERVADOS — só a classe de cor (fundo + hover) muda por tom.
 */
function ActionButton({
  href,
  label,
  testid,
  tone,
}: {
  href: string
  label: string
  testid: string
  tone: Leitura["tone"]
}) {
  return (
    <Link
      href={href}
      data-testid={testid}
      data-tone={tone}
      className={`inline-flex h-7 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full px-2.5 text-[11px] font-semibold transition-colors active:scale-95 ${ACTION_BUTTON_STYLE[tone]}`}
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
      // decisão do Hugo: a célula VOCÊ mostra o RANKING (formatRank, "3º"), não
      // mais o score. A leitura "Como estou" e o vencedor/cor CONTINUAM baseados nos
      // scores brutos (subjectValue/referenceValue = s.engagement/r.engagementAvg),
      // SEM mudança — só o TEXTO exibido muda.
      // Round 6 (Hugo 2026-07-18) — a célula TURMA de Engajamento primeiro perdeu o
      // DENOMINADOR (número absoluto "13", não mais "13/57"), depois FOI CONSOLIDADA
      // numa ÚNICA frase. Olhando o app ao vivo, o Hugo achou o número solto "13" em
      // cima da legenda "Turma fez 13 pontos, em média" redundante — dois elementos
      // para dizer a mesma coisa. Agora a célula Turma DESTA LINHA é a frase inteira
      // "a turma fez, em média, {N} pontos", SEM o número isolado acima. Por isso o
      // `referenceNode` aqui deixa de ser um número (String(r.engagementAvg)) e passa
      // a NÃO renderizar um valor bruto na célula Turma da linha Engajamento — o
      // JSX abaixo detecta `row.key === "engagement"` e desenha a frase única no lugar
      // do ValueCell. As OUTRAS 4 linhas seguem com o valor bruto normal no ValueCell.
      // `referenceNode` fica como o número (fallback/semântica), mas NÃO é montado no
      // DOM da linha Engajamento (o JSX pula o ValueCell dela).
      key: "engagement",
      label: "Engajamento",
      direction: "higher",
      subjectValue: s.engagement,
      referenceValue: r.engagementAvg,
      subjectNode: formatRank(s.engagementRank, s.engagementTotalStudents),
      referenceNode: String(r.engagementAvg),
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
                    {/* Round 6 (Hugo 2026-07-18) — a célula Turma da linha Engajamento
                        foi CONSOLIDADA numa ÚNICA frase. Antes tinha DOIS elementos
                        empilhados: o número solto ("13", via ValueCell) e, embaixo, a
                        legenda-espelho "Turma fez 13 pontos, em média" (Round 5). Olhando
                        o app ao vivo o Hugo achou o número isolado redundante com a frase
                        — dois jeitos de dizer o mesmo. Agora a célula Turma DESTA LINHA é
                        SÓ a frase "a turma fez, em média, {N} pontos" (mesmo estilo muted
                        de antes, `text-xs text-text-muted`), sem o ValueCell/número acima.
                        Mantém o testid `cell-reference-engagement` (o conteúdo da célula
                        Turma da linha continua identificável) e usa r.engagementAvg, a
                        MESMA fonte de antes. As OUTRAS 4 linhas seguem com o valor bruto
                        no ValueCell normalmente. */}
                    {row.key === "engagement" ? (
                      <span
                        data-testid={`cell-reference-${row.key}`}
                        className="text-xs text-text-muted"
                      >
                        {`a turma fez, em média, ${indicators.reference.engagementAvg} pontos`}
                      </span>
                    ) : (
                      <ValueCell
                        testid={`cell-reference-${row.key}`}
                        win={winner === "reference"}
                        // A coluna Turma NUNCA destaca — pill sempre null (preservado).
                        pill={null}
                        dim={true}
                      >
                        {row.referenceNode}
                      </ValueCell>
                    )}
                    {row.isPct && <PctBar pct={row.referenceValue} win={false} />}
                  </td>
                  <td className="px-4 py-4 text-left">
                    {/* ROUND 4 (Hugo 2026-07-18) — chip + botão acionável na MESMA
                        célula. flex-wrap: em telas estreitas o botão cai para a linha
                        de baixo em vez de estourar a célula.
                        ROUND 6 (Hugo 2026-07-18) — o botão passa a ser UNIVERSAL: o
                        gate `winner === "reference"` foi REMOVIDO, o ActionButton é
                        renderizado INCONDICIONALMENTE em TODAS as 5 linhas. Deixou de
                        ser um convite condicional só para quem está mal e virou um CTA
                        de "continue melhorando" que aparece ganhando, empatando ou
                        atrás (o Hugo, olhando o app ao vivo: "mesmo para o Rinaldo, tem
                        que ter os botões para melhorar ainda mais a performance dele").
                        Os labels por linha (ACTION_LABEL) já são neutros/genéricos o
                        suficiente para servir aos dois casos, sem reescrita.
                        ROUND 7 (Hugo 2026-07-18) — a COR do botão deixou de ser fixa
                        (cerrado) e passou a ESPELHAR o `leitura.tone` da MESMA linha
                        (via ACTION_BUTTON_STYLE): win=verde, tie=neutro, behind-mild=
                        âmbar, behind-severe=vermelho, none=cerrado fallback. Fonte única
                        de verdade = `leitura.tone` (o mesmo que colore o chip), então o
                        chip e o botão da linha ficam visualmente coerentes. O botão
                        segue UNIVERSAL (presente nas 5 linhas). A severidade amarelo/
                        vermelho do CHIP e do PILL do valor (Round 3) segue intocada. */}
                    <div className="flex flex-wrap items-center gap-2">
                      <LeituraChip leitura={leitura} testid={`leitura-${row.key}`} />
                      <ActionButton
                        href={continueHref}
                        label={ACTION_LABEL[row.key]}
                        testid={`action-${row.key}`}
                        tone={leitura.tone}
                      />
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
