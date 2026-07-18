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
// conta paralela. [HISTÓRICO — na Round 7 o BOTÃO ficava no tom SÓLIDO (fundo cheio
// + texto de contraste); o Round 8 abaixo trocou o botão para o MESMO tom SUAVE /10
// do chip, ver o bloco datado logo a seguir.] O botão segue UNIVERSAL (Round 6):
// aparece nas 5 linhas sempre, ganhando/empatando/atrás.
//
// ROUND 8 — ALINHAMENTO EM COLUNAS + HIERARQUIA DE COR (Hugo 2026-07-18, feedback ao
// vivo olhando o app + 2 screenshots: "esse visual ta bem ruim, tudo muito igual,
// desalinhado e etc."). Três correções, cada uma de uma causa raiz concreta:
//   (1) DESALINHAMENTO (estrutural): o chip "Como estou" e o botão viviam numa ÚNICA
//       <td> com `<div className="flex flex-wrap">`. Como o chip varia de largura entre
//       linhas ("ativo acima da média" vs "no ritmo da turma"), o botão ao lado começava
//       em X diferente por linha — parecia desalinhado porque NÃO era uma coluna de
//       verdade, era flexbox dentro de uma célula. AGORA são DUAS <td>s reais (chip |
//       ação): o <thead> ganhou uma 5ª <th> (rótulo sr-only "Ação") e cada <tr> tem 2
//       <td> no lugar de 1. Colunas nativas de <table> alinham sozinhas em todas as
//       linhas — a ferramenta certa p/ "alinhar em coluna", não flex. testids
//       `leitura-*`/`action-*` INTACTOS, só mudou o contêiner.
//   (2) TEXTO PEQUENO (explícito, screenshot 2): a frase "a turma fez, em média, {N}
//       pontos" (célula Turma da linha Engajamento) usava `text-xs text-text-muted`
//       (12px, tamanho de legenda secundária) — mas desde o Round 6 essa frase é o
//       ÚNICO conteúdo primário daquela célula. Passou p/ `text-sm font-medium
//       text-text-muted`, o MESMO peso tipográfico que ValueCell usa nas outras células
//       Turma (dim=true), alinhando essa célula às demais da coluna em vez de inventar
//       um tamanho novo.
//   (3) MONOTONIA DE COR ("tudo muito igual"): num aluno vencendo, cada linha repetia
//       VERDE SÓLIDO 3x — o pill do valor Você (win), o chip (win /10) e o BOTÃO (win
//       sólido, decisão do Round 7). Três blocos fortes idênticos apagavam a hierarquia.
//       O `ACTION_BUTTON_STYLE` trocou de fundo SÓLIDO para TINTADO /10 (mesma família do
//       LEITURA_CHIP), texto na cor semântica sólida (não branco). Preserva a RELAÇÃO de
//       cor por tom do Round 7 (o botão ainda espelha `leitura.tone`), mas com peso leve:
//       agora só o PILL do valor (o dado numérico real) é SÓLIDO por linha; o chip e o
//       botão ficam ambos suaves /10 (mesma família entre si) — hierarquia clara de 1
//       elemento forte (o número) + 2 leves de apoio (explicação + ação), em vez de 3
//       fortes competindo. NÃO reverte a decisão do Round 7 de "cor relativa ao Como
//       estou" (o Hugo pediu isso na rodada anterior); só baixa o PESO visual do botão.
//
// ROUND 9 — CÉLULA TURMA/ENGAJAMENTO EM 2 LINHAS, ESPELHANDO O LADO VOCÊ (Hugo
// 2026-07-18, feedback ao vivo + screenshot da célula que o Round 8 acabou de tocar):
// a célula Você da linha Engajamento já tem 2 linhas (pill de ranking "11º" em cima +
// legenda muted "Você fez N pontos" embaixo). O Hugo quis a MESMA estrutura do lado
// Turma: a POSIÇÃO fica no Você, o TAMANHO DA POPULAÇÃO no Turma — juntas, as duas
// células reconstroem "11 de 46". O "de 46" tinha sido tirado do texto do rank no
// Round 6 (por um pedido ANTERIOR do Hugo); agora ele quer a informação de volta, só
// que do lado Turma em vez de colada no rank. A célula Turma passou de UMA frase
// ("a turma fez, em média, {N} pontos") para DUAS linhas:
//   • TOPO (valor principal, `text-sm font-medium`, peso das demais células Turma):
//     o total de pessoas via `formatPopulation(subject.engagementTotalStudents)` — o
//     MESMO campo que já alimenta `formatRank`, NENHUM cálculo novo.
//   • BAIXO (legenda muted `text-xs text-text-muted`, mesmo estilo da legenda "Você
//     fez N pontos"): "Média da turma: {N} pontos" (`reference.engagementAvg`, a MESMA
//     fonte de sempre; a unidade "pontos" foi acrescentada no Round 11, screenshot #2 do
//     Hugo — antes ficava só "Média da turma: {N}", sem a unidade).
// Degradação graciosa: total ausente/malformado → `formatPopulation` devolve null e a
// linha de topo é OMITIDA (sem "undefined pessoas"), a legenda da média segue sozinha —
// mesmo espírito defensivo de `formatRank`/`formatFraction`. `data-testid`
// `cell-reference-engagement` migrou para o valor principal (linha de topo); a legenda
// da média ganhou `cell-reference-engagement-avg`.
//
// ROUND 10 — ÍCONES SEMÂNTICOS POR AÇÃO + DIFERENCIAÇÃO BOTÃO↔CHIP (Hugo 2026-07-18,
// feedback ao vivo com screenshot dos Rounds 8/9 aplicados: "precisamos melhorar o
// visual dos botões agora, ta tudo muito igual. precisamos dos botões com alguns ícones
// e etc"). Dois problemas, duas correções:
//   (1) ÍCONE GENÉRICO REPETIDO: até a Round 9 os 5 botões terminavam todos no MESMO
//       `ArrowRight` — visualmente idênticos entre si. Agora cada linha ganha um ícone
//       SEMÂNTICO próprio (`ACTION_ICON`, paralelo a `ACTION_LABEL`), à ESQUERDA do
//       texto (posição de liderança): RotateCcw (retomar), Play (continuar sessão),
//       MessageSquare (interação), Pencil (registrar reflexão), Zap (continuar agora).
//       Os 5 glifos são visualmente distintos e TODOS já pertencem ao vocabulário do
//       app (reuso comprovado por grep em src, não invenção). O `ArrowRight` menor e
//       esmaecido fica ao final como affordance de clique.
//   (2) BOTÃO PARECIDO DEMAIS COM O CHIP: desde o Round 8 o botão e o chip "Como estou"
//       ao lado ficaram ambos em pill tintado /10, competindo por serem iguais um ao
//       outro (parte do "ta tudo muito igual"). Diferenciação incremental (NÃO reverte o
//       tom /10 do Round 8): o botão ganhou um ANEL sutil na cor do tom
//       (`ring-1 ring-{tone}/25`) — silhueta de elemento clicável que o chip não tem —
//       e o peso da fonte subiu de `font-semibold` para `font-bold`. O chip segue só
//       fundo /10 sem anel; o olho passa a distinguir "ação" (contorno + bold + ícone
//       de liderança) de "status" (chip liso).
//
// ROUND 11 — BOTÃO DE AÇÃO ADOTA O DESIGN SYSTEM REAL (Uma / @ux-design-expert, Hugo
// 2026-07-18, com screenshot da tabela renderizada: "coloca os botões em outro estilo,
// não tá legal ainda" — sem dizer QUAL estilo, só que o atual não funciona). Depois de 3
// rodadas de ajuste de cor DENTRO da pill inventada (Round 7 cor sólida por tom, Round 8
// tintado /10, Round 10 anel + ícone), o botão ainda não convencia. Diagnóstico de design:
// o sintoma se repetia porque a CAUSA era estrutural, não de paleta. O `ActionButton`
// nasceu no Round 4 como uma PILL desenhada à mão (rounded-full, cor tintada por tom,
// reinventada rodada a rodada) e NUNCA usou o design system do app. O app inteiro fala
// `buttonVariants` de `@eximia/ui` (cva-based, dezenas de call sites: trails, assessments,
// workspace, brandbook, not-found) — inclusive o padrão IGUAL ao nosso, `<Link href
// className={buttonVariants({ variant })}>` em `not-found.tsx`. O botão "não parecia certo"
// porque estava FORA da linguagem visual do resto do app.
//   CORREÇÃO: base = `buttonVariants({ variant: "outline", size: "sm" })` (a variante
//   outline do DS é a certa para um CTA compacto e discreto numa célula de tabela densa:
//   contorno + hover que revela a marca cerrado, sem competir com o pill de valor sólido).
//   Ganha os estados que a pill não tinha (foco visível, hover/active reais, rounded-xl,
//   tipografia e transições da casa). A RELAÇÃO cor↔tom do Round 7 é PRESERVADA (requisito
//   ativo do Hugo, não descartado): o tom da leitura tinge a base outline por cima via
//   `ACTION_TONE` (cor do texto + do anel de contorno na família semântica do tom). Chip e
//   botão seguem a MESMA fonte de verdade (`leitura.tone`), coerentes — mas o botão é agora
//   o Button do DS vestido pelo tom, não uma cápsula paralela. Universalidade (Round 6),
//   ícone semântico + iconTestid (Round 10), ArrowRight de affordance, href e testids
//   `action-*`/`action-icon-*` INTACTOS. Ação #2 desta rodada: a legenda da célula
//   Turma/Engajamento corrigida de "Média da turma: {N}" para "Média da turma: {N} pontos"
//   (faltava a unidade). `ACTION_BUTTON_STYLE` (a paleta da pill) foi SUBSTITUÍDO por
//   `ACTION_TONE`; o rastro histórico dos Rounds 7/8/10 fica preservado neste cabeçalho.
//
// Pure presentation. Card-less: o container (StudentHomeCard) é dono do Card,
// do subtítulo e do toggle Visão detalhada/Gráficos. Labels parametrizáveis:
// `studentFirstName` vira o cabeçalho da coluna do sujeito ("Eu (Rinaldo)";
// num drill de gestor, o nome do aluno), degradando para "Você".
// ---------------------------------------------------------------------------

import type { StudentHomeIndicators } from "@/types/analytics"
import { buttonVariants, cn } from "@eximia/ui"
import type { LucideIcon } from "lucide-react"
import {
  ArrowRight,
  MessageSquare,
  Minus,
  Pencil,
  Play,
  RotateCcw,
  TrendingUp,
  Zap,
} from "lucide-react"
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
 * ROUND 10 (Hugo 2026-07-18) — o ÍCONE do BOTÃO ACIONÁVEL por indicador, paralelo a
 * `ACTION_LABEL` (uma entrada por RowKey). Até a Round 9 os 5 botões repetiam o MESMO
 * `ArrowRight` genérico ao final — visualmente idênticos entre si ("ta tudo muito
 * igual"). Agora cada linha ganha um ícone Lucide SEMANTICAMENTE ligado à sua ação,
 * como ícone de LIDERANÇA (à esquerda do texto). Os 5 glifos são visualmente distintos
 * (seta circular ≠ triângulo ≠ balão ≠ lápis ≠ raio) e TODOS já fazem parte do
 * vocabulário visual do app (grep em src: RotateCcw 37×, Play 40×, MessageSquare 36×,
 * Pencil 16×, Zap 14×) — reuso, não invenção de glifo novo:
 *   • lastAccess ("Retomar atividade")     → RotateCcw  (retomar/recomeçar)
 *   • progress ("Continuar sessão")        → Play       (continuar/dar play)
 *   • sessions ("Fazer uma interação")     → MessageSquare (interação/mensagem)
 *   • reflections ("Registrar uma reflexão") → Pencil   (registrar/escrever)
 *   • engagement ("Continuar agora")       → Zap        (energia/impulso/agora)
 */
const ACTION_ICON: Record<RowKey, LucideIcon> = {
  lastAccess: RotateCcw,
  progress: Play,
  sessions: MessageSquare,
  reflections: Pencil,
  engagement: Zap,
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
 * ROUND 9 (Hugo 2026-07-18) — o TAMANHO da população da turma como "valor principal"
 * da célula Turma da linha Engajamento (espelhando o peso do pill de ranking "11º" do
 * lado Você). Junto, as duas células reconstroem "11 de 46": Você mostra a POSIÇÃO,
 * Turma mostra o TOTAL. `total` é o MESMO `engagementTotalStudents` que já alimenta
 * `formatRank` — nenhum cálculo novo. Degrada a `null` (a célula omite a linha de topo,
 * sem "undefined pessoas") em qualquer entrada ausente/malformada, mesmo espírito
 * defensivo de `formatRank`/`formatFraction`. Pure.
 */
export function formatPopulation(total: number | undefined | null): string | null {
  if (total == null || !Number.isFinite(total) || total < 1) return null
  return total === 1 ? "1 pessoa" : `${total} pessoas`
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
 * ROUND 11 (Uma / @ux-design-expert, Hugo 2026-07-18) — MUDANÇA DE ABORDAGEM, não mais
 * um ajuste de paleta dentro da pill inventada. Feedback literal do Hugo (com screenshot
 * da tabela): "coloca os botões em outro estilo, não tá legal ainda" — sem especificar o
 * estilo, só que o atual (Rounds 7→8→10 de ajuste de cor sobre a pill) não funciona.
 *
 * CAUSA RAIZ (diagnóstico de design): o ActionButton nasceu no Round 4 como uma PILL
 * customizada à mão (rounded-full, tintada /10 por tom, inventada rodada a rodada) e
 * NUNCA usou o design system real do app. O app inteiro usa `buttonVariants` de
 * `@eximia/ui` (cva-based, dezenas de call sites: trails, assessments, workspace,
 * brandbook, not-found) — inclusive o padrão IDÊNTICO ao nosso caso, `<Link href
 * className={buttonVariants({ variant })}>` em `not-found.tsx`. O botão "não parecia
 * certo" porque estava FORA da linguagem visual do resto do app, não porque faltava mais
 * um tweak de cor. Três rodadas de ajuste de paleta trataram o sintoma, não a causa.
 *
 * CORREÇÃO: o botão agora usa `buttonVariants({ variant: "outline", size: "sm" })` como
 * BASE — a variante outline do DS é a mais adequada a um CTA compacto e discreto dentro
 * de uma célula de tabela densa (contorno + hover que revela a marca `cerrado`, sem
 * competir em peso com o PILL de valor sólido da linha). Ganha DE GRAÇA os estados que a
 * pill inventada não tinha: foco visível (`focus-visible:ring-2`), hover/active reais,
 * `rounded-xl` do DS, tipografia e transições da casa. É a mesma silhueta de "elemento
 * clicável do app" que o aluno já viu em toda a plataforma.
 *
 * RELAÇÃO COR↔TOM (Round 7) PRESERVADA — requisito ativo do Hugo, não descartado: em vez
 * de uma pill de cor inventada, o tom da leitura (`leitura.tone`) agora tinge a BASE
 * outline por cima, via `ACTION_TONE` — cor do texto + cor do anel de contorno na família
 * semântica do tom (verde/neutro/âmbar/vermelho/cerrado). O chip e o botão da linha seguem
 * a MESMA fonte de verdade (`leitura.tone`), coerentes. Mas agora o botão é o Button do
 * DS vestido pelo tom, não uma pill paralela. `data-tone` preservado para os testes.
 *
 * PRESERVADO do que já funcionava (não questionado): universalidade (Round 6, 5 linhas
 * sempre), ícone semântico à esquerda + `iconTestid` (Round 10), `ArrowRight` de
 * affordance ao final, href/navegação, testids `action-${key}`/`action-icon-${key}`.
 */
const ACTION_TONE: Record<Leitura["tone"], string> = {
  win: "text-semantic-success ring-semantic-success/40 hover:border-semantic-success/50 hover:bg-semantic-success/10 hover:text-semantic-success",
  tie: "text-text-secondary ring-border-medium/60 hover:border-border-medium hover:bg-bg-hover hover:text-text-primary",
  "behind-mild":
    "text-semantic-warning ring-semantic-warning/40 hover:border-semantic-warning/50 hover:bg-semantic-warning/10 hover:text-semantic-warning",
  "behind-severe":
    "text-semantic-error ring-semantic-error/40 hover:border-semantic-error/50 hover:bg-semantic-error/10 hover:text-semantic-error",
  none: "text-cerrado-600 ring-cerrado-600/40 hover:border-cerrado-600/50 hover:bg-cerrado-600/10 hover:text-cerrado-600",
}

/**
 * ROUND 4 (Hugo 2026-07-18) — o BOTÃO ACIONÁVEL ao lado do chip "Como estou".
 * Round 6 (Hugo 2026-07-18): renderizado em TODAS as linhas incondicionalmente (o
 * call site perdeu o gate `winner === "reference"`). O href é o `continueHref` da
 * trilha — mesmo destino para todas as linhas hoje (sem deep-link específico, ver o
 * comentário de topo do arquivo).
 * Round 7 (Hugo 2026-07-18): a COR passou a ESPELHAR o `tone` da leitura da linha.
 * Round 10 (Hugo 2026-07-18): ícone SEMÂNTICO por linha (`Icon`, de `ACTION_ICON`) à
 * ESQUERDA do texto (liderança) + `ArrowRight` de affordance ao final. O ícone semântico
 * leva `data-testid={iconTestid}` para os testes afirmarem o glifo certo por linha.
 * ROUND 11 (Uma, Hugo 2026-07-18): a base deixou de ser uma pill inventada e passou a
 * ser `buttonVariants({ variant: "outline", size: "sm" })` do design system real
 * (`@eximia/ui`), tingida pelo tom da linha via `ACTION_TONE` (ver bloco acima). O tom
 * ainda espelha `leitura.tone` (relação chip↔botão do Round 7 preservada), mas agora
 * sobre a linguagem visual da casa em vez de uma cápsula paralela — resolvendo a causa
 * raiz do "não tá legal ainda". Universalidade, ícone semântico, affordance, href e
 * testids intactos.
 */
function ActionButton({
  href,
  label,
  testid,
  tone,
  Icon,
  iconTestid,
}: {
  href: string
  label: string
  testid: string
  tone: Leitura["tone"]
  /** Ícone semântico da ação (Round 10), à esquerda do texto. */
  Icon: LucideIcon
  /** testid do ícone semântico, para os testes afirmarem o glifo certo por linha. */
  iconTestid: string
}) {
  return (
    <Link
      href={href}
      data-testid={testid}
      data-tone={tone}
      className={cn(
        buttonVariants({ variant: "outline", size: "sm" }),
        // shrink-0 (não encolher na coluna densa) + gap do ícone; ring-1 dá largura ao
        // anel de tom (ACTION_TONE define só a COR do anel, ring-{tone}/40). O botão do DS
        // já é font-semibold (mais peso que o chip descritivo), diferenciando ação↔status.
        "shrink-0 gap-1.5 ring-1",
        ACTION_TONE[tone],
      )}
    >
      <Icon data-testid={iconTestid} size={13} aria-hidden="true" className="shrink-0" />
      {label}
      <ArrowRight size={11} aria-hidden="true" className="shrink-0 opacity-60" />
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
              {/* ROUND 8 (Hugo 2026-07-18) — "Como estou" e a ação viraram DUAS
                  colunas REAIS de tabela (antes: 1 <td> com flex interno, o que
                  desalinhava o botão entre linhas porque o chip varia de largura).
                  Colunas nativas de <table> alinham automaticamente. A 2ª coluna
                  é a AÇÃO (o botão); o rótulo fica sr-only (o chip já é a explicação
                  visível, o botão é só o CTA). */}
              <th className="px-4 py-3 text-left">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Como estou
                </span>
              </th>
              <th className="px-4 py-3 text-left">
                <span className="sr-only">Ação</span>
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
                    {/* ROUND 9 (Hugo 2026-07-18) — a célula Turma da linha Engajamento
                        virou DUAS linhas, espelhando a estrutura da célula Você do mesmo
                        indicador (pill "11º" em cima + legenda muted "Você fez N pontos"
                        embaixo). Enquanto Você mostra a POSIÇÃO (11º), a Turma mostra o
                        TAMANHO da população ("46 pessoas") — juntas, as duas células
                        reconstroem "11 de 46" (o "de 46" que o Round 6 tirou do texto do
                        rank, agora de volta do lado Turma por pedido do Hugo). A linha de
                        TOPO é o total de pessoas (`engagementTotalStudents`, o MESMO campo
                        que alimenta `formatRank`, via `formatPopulation` — sem cálculo
                        novo), com o peso das demais células Turma (`text-sm font-medium`).
                        A linha de BAIXO é a legenda muted "Média da turma: {N} pontos"
                        (`reference.engagementAvg`, a MESMA fonte da frase de antes; a
                        unidade "pontos" foi acrescentada no Round 11), mesmo estilo da
                        legenda "Você fez N pontos" do lado
                        Você (`text-xs text-text-muted`). Degradação graciosa: se o total
                        vier ausente/malformado, `formatPopulation` devolve null e a linha
                        de topo é OMITIDA (sem "undefined pessoas") — a legenda da média
                        segue sozinha. `data-testid` `cell-reference-engagement` fica no
                        valor principal (linha de topo); a legenda ganha
                        `cell-reference-engagement-avg`. */}
                    {row.key === "engagement" ? (
                      <>
                        {formatPopulation(indicators.subject.engagementTotalStudents) !== null && (
                          <div
                            data-testid={`cell-reference-${row.key}`}
                            className="text-sm font-medium text-text-muted"
                          >
                            {formatPopulation(indicators.subject.engagementTotalStudents)}
                          </div>
                        )}
                        <div
                          data-testid="cell-reference-engagement-avg"
                          className="mt-1 text-xs text-text-muted"
                        >
                          {`Média da turma: ${indicators.reference.engagementAvg} pontos`}
                        </div>
                      </>
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
                  {/* ROUND 4 (Hugo 2026-07-18) — chip + botão acionável.
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
                      vermelho do CHIP e do PILL do valor (Round 3) segue intocada.
                      ROUND 8 (Hugo 2026-07-18) — o chip e o botão saíram de uma ÚNICA
                      <td> com flex interno e viraram DUAS <td>s REAIS (chip | ação). O
                      flex desalinhava o botão entre linhas: o chip varia de largura
                      ("ativo acima da média" vs "no ritmo da turma"), então o botão ao
                      lado começava em X diferente em cada linha. Com 2 colunas nativas
                      de <table>, o navegador alinha a coluna de ações automaticamente
                      em todas as linhas. data-testid `leitura-*`/`action-*` PRESERVADOS,
                      só mudou o contêiner (de <div> numa <td> para 2 <td>s). */}
                  <td className="px-4 py-4 text-left">
                    <LeituraChip leitura={leitura} testid={`leitura-${row.key}`} />
                  </td>
                  <td className="px-4 py-4 text-left">
                    <ActionButton
                      href={continueHref}
                      label={ACTION_LABEL[row.key]}
                      testid={`action-${row.key}`}
                      tone={leitura.tone}
                      // Round 10 — ícone semântico por linha (à esquerda, liderança).
                      Icon={ACTION_ICON[row.key]}
                      iconTestid={`action-icon-${row.key}`}
                    />
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
