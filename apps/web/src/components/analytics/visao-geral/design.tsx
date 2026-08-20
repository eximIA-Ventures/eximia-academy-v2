// ---------------------------------------------------------------------------
// LINGUAGEM VISUAL da aba "Visão geral" (Analytics do gestor).
//
// Este módulo é a peça A ("Moldura e placar") entregando o vocabulário comum
// para as demais peças da tela. TODO valor aqui foi MEDIDO no PNG de referência
// docs/sop/runs/_referencias/academy-analytics-gestor/01-visao-geral.png
// (1672×941, DPR 1), não estimado no olho.
//
// Por que tokens locais e não `packages/ui`:
//   • `packages/ui/card.tsx` é `rounded-2xl` (16px) + `shadow-card`, e a régua
//     exige raio 9–16 com referência 12 (CRITERIOS.md B-10) e uma sombra de
//     escurecimento ≤12 níveis e alcance ≤8px (B-08, B-09, D-22);
//   • os componentes do design system leem `--color-bg-card` e amigos, que o
//     harness de preview neutraliza; amarrar a tela a eles tornaria o pixel
//     dependente do tema resolvido, e o gauntlet exige determinismo.
// Decisão IDS: ADAPTAR (mesma anatomia de Card/CardTitle do design system,
// valores recalibrados contra a referência), não CRIAR do zero nem REUSAR cru.
//
// ESCALA TIPOGRÁFICA — RECALIBRADA na rodada 3 contra a bbox de tinta medida no
// PNG de referência, não estimada pela razão nominal da fonte (CRITERIOS.md B-29).
// A rodada 2 rodou ~10% grande no bloco do Placar; os alvos abaixo são o que a
// referência mede de verdade (largura de tinta e cap-height, em px):
//
//   token            tamanho   ref: tinta medida        candidato r2 (grande)
//   H1 ............. 33 / 700  "A" cap 24               cap 25   → mantido
//   valor de KPI ... 25 / 700  "28" cap 20 (era 22)     cap 22   → 28px → 25px
//   título de card . 14,5/700  "Placar…" 118px de largura  130px → 16px → 14,5px
//   aba ............ 14,1/ lh 22  "Visão geral" 75px de largura, cap 10
//                                 (rodada 6: era 15px → 80px e cap 12, fora da
//                                  banda 9–11 de B-29 e colado no título de card)
//   chip ........... 14,4/ lh 22
//   subtítulo ...... 14,8/ lh 22  459px de largura      466px
//   rótulo ......... 12  / lh 16  "No ritmo" cap 9 (era 10)  → 13px → 12px
//   variação ....... 12  / lh 16  "↓ 8 pp" 35px de largura   43px → 13px → 12px
//   corpo tabela ... 11  / lh 16 → cap 8 (peça C; um degrau abaixo do rótulo,
//                                 para B-29 continuar com 7 degraus distintos)
//
// WORD-SPACING do H1: o `letterSpacing: -0.021em` do título encolhe também o
// espaço entre palavras, e o vão de tinta caía para 6–7px contra 8–9px da
// referência ("Ativação da Jornada" colado). `wordSpacing: 2px` devolve o vão
// sem mexer no ajuste ótico entre letras.
// ---------------------------------------------------------------------------

import type { Tom } from "@/lib/analytics/visao-geral/tipos"
import { ChevronRight } from "lucide-react"
import Link from "next/link"
import type { CSSProperties, ReactNode } from "react"

// ===========================================================================
// Superfícies e texto
// ===========================================================================

/** Fundo da página. Off-white QUENTE (R−G=3, G−B=1), não cinza — B-03. */
export const COR_PAGINA = "#F8F5F4"

/** Superfície de card. Branco puro; diferença de luminância p/ o fundo ≈7 — B-04. */
export const COR_CARD = "#FFFFFF"

/** Bloco tonal interno (tiles do Placar, linhas de recomendação) — B-05. */
export const COR_TILE = "#FAF8F7"

/** Laranja de ação. Matiz 17,8° (faixa exigida: 12°–28°) — B-18. */
export const COR_ACAO = "#D54407"

/**
 * O laranja do HOVER, e a razão de ele ser MAIS ESCURO e não mais claro.
 *
 * Medido por WCAG 2.x (luminância relativa), `#D54407` sobre `COR_CARD` dá
 * 4,507:1. O piso de texto normal é 4,5:1 — e o rótulo do CTA tem 11,5px, que é
 * texto normal (a norma só concede 3:1 a partir de 18,66px). Ou seja, a tinta de
 * repouso passa AA por SETE MILÉSIMOS. Sobre o fundo da página (`COR_PAGINA`)
 * o mesmo tom cai para 4,15:1 e REPROVA — o que salva o CTA é ele viver sempre
 * dentro de um card branco.
 *
 * Com essa margem, um hover que CLAREIA reprova na hora. Este escurece:
 * 6,61:1 sobre branco, 6,10:1 sobre a página. `cta-rodape-fonte-unica.test.tsx`
 * tranca as duas coisas — o piso da tinta de repouso e a direção do hover — com
 * o par de variância ao lado (um laranja um degrau mais claro tem de REPROVAR a
 * mesma medida, senão a medida não mede nada).
 *
 * A tinta de repouso NÃO muda: repintá-la deslocaria toda a régua fotografada
 * do gauntlet para comprar 0,007 de margem que o teste já protege.
 */
export const COR_ACAO_HOVER = "#A83504"

/** Preenchimento do hover da pílula de contorno. `#A83504` sobre ele: 5,79:1. */
export const COR_ACAO_TENUE = "#FCEDE5"

/**
 * Os 4 — e somente 4 — tiers de texto (B-16). As faixas de luminância da régua
 * são: primário ≤26 · secundário 60–85 · terciário 85–110 · mudo 110–130.
 * O tier `mudo` fica na BORDA INFERIOR da faixa de propósito: é o único ponto
 * em que B-16 (≥110) e D-09 (contraste ≥4,5:1 sobre #F8F5F4) coexistem.
 */
export const TEXTO = {
  /** lum 0 — H1, títulos de card, valores de KPI, texto de chip. */
  primario: "#000000",
  /** lum 82 — rótulos de tile, texto de apoio com peso. */
  secundario: "#545153",
  /** lum 101 — subtítulo da página, complemento do valor ("de 40 · 70%"). */
  terciario: "#676564",
  /** lum 111, contraste 4,63:1 — carimbo de frescor, abas inativas. */
  mudo: "#6F6F6E",
} as const

/**
 * Variação semântica. A cor vem de `deltaTom`, NUNCA de `deltaDirecao`
 * (C-17: "Sem acesso ↑ 3 pp" sobe e é vermelho).
 * B-28: verde G−R ≥ 40 · vermelho R−G ≥ 90.
 */
export const VARIACAO = {
  positivo: "#2E9E6B", // G−R = 113
  negativo: "#DE3B36", // R−G = 163
} as const

/**
 * Paleta semântica dos círculos de ícone (B-20, B-28).
 * `fill` = disco pastel · `ink` = traço do glifo.
 */
export const TOM_ICONE: Record<Tom, { fill: string; ink: string }> = {
  green: { fill: "#D8EDE3", ink: "#1D9C6E" },
  amber: { fill: "#FCE6CC", ink: "#E07104" },
  blue: { fill: "#D4E1FA", ink: "#3A7CF0" },
  red: { fill: "#F9D6D6", ink: "#D82422" },
  neutral: { fill: "#ECE8E6", ink: "#676564" },
}

/**
 * MESMA paleta semântica, um degrau MAIS CLARA. Extensão (não paralelo) de
 * `TOM_ICONE`: só o `fill` muda, o `ink` é literalmente o mesmo objeto de tom.
 *
 * Por que existe: o PNG usa dois pastéis diferentes para a mesma família. Média
 * de patch 5×5 no centro de cada disco, longe do glifo:
 *
 *   tom     Placar (TOM_ICONE)   pílulas / avatares / Resposta   Δ por canal
 *   green ..... 216,237,227          221,239,231 · 228,243,235      +6
 *   amber ..... 252,230,204          249,229,204 · 252,232,205       −1
 *   red ....... 249,214,214          249,231,230 · 250,224,224      +14
 *   blue ...... 212,225,250          229,236,247                    +16
 *
 * `green` e `amber` batem com `TOM_ICONE` dentro dos ±8 níveis que a régua
 * ignora ("NÃO É CRITÉRIO" item 8); `red` e `blue` não batem, e é por eles que
 * este mapa existe. Os valores abaixo são a média das ocorrências medidas.
 */
export const TOM_ICONE_SUAVE: Record<Tom, { fill: string; ink: string }> = {
  green: { fill: "#DEF0E7", ink: TOM_ICONE.green.ink },
  amber: { fill: "#FBE7CE", ink: TOM_ICONE.amber.ink },
  blue: { fill: "#E5ECF7", ink: TOM_ICONE.blue.ink },
  red: { fill: "#F9E3E2", ink: TOM_ICONE.red.ink },
  neutral: { fill: "#F1EDEB", ink: TOM_ICONE.neutral.ink },
}

/**
 * TERCEIRO degrau da MESMA família, para os discos Ø26 de "Sinais fora do
 * padrão". Herda `TOM_ICONE_SUAVE` por spread: só `red` muda, porque só ele
 * medi fora dos ±8 níveis que a régua ignora ("NÃO É CRITÉRIO" item 8).
 *
 * Medida na referência, patch limpo dentro do disco, longe do glifo:
 *   disco       x       y     fill medido      degrau mais próximo   Δ máx
 *   sinal 1   926–952  792–818  253,245,244   SUAVE red 249,227,226   18
 *   sinal 2   926–952  822–848  251,236,214   SUAVE amber 251,231,206  8
 *   sinal 3   927–952  856–880  252,240,223   SUAVE amber 251,231,206  9
 *
 * O disco vermelho de "Sinais" é quase branco na referência — bem mais claro
 * que o vermelho das pílulas e do Placar. Repintá-lo com `TOM_ICONE_SUAVE`
 * colocaria um disco rosa visível onde o PNG tem um halo. O âmbar estava na
 * borda dos ±8 (o candidato media 251,231,206 contra 251,236,214 medidos aqui),
 * e o meio caminho abaixo fecha os dois sinais âmbar em Δ≤2. `green`, `blue` e
 * `neutral` não aparecem neste bloco e ficam herdados de `TOM_ICONE_SUAVE`.
 */
export const TOM_ICONE_TENUE: Record<Tom, { fill: string; ink: string }> = {
  ...TOM_ICONE_SUAVE,
  amber: { fill: "#FBECD7", ink: TOM_ICONE.amber.ink },
  red: { fill: "#FDF5F4", ink: TOM_ICONE.red.ink },
}

/**
 * Borda do botão de contorno (B-12: fundo ≥250 de luminância, borda de 1px em
 * laranja claro com R−B ≥ 60). Valor da própria régua, confirmado no perfil
 * medido nas bordas dos 3 CTAs de "O que fazer agora" (x 1480 / 1477 / 1481).
 * Compartilhado com os botões da tabela da peça D — é a MESMA borda.
 */
export const COR_BORDA_BOTAO = "#F0A585"

/**
 * Marcador de "O que mudou": disco pastel externo Ø18 + disco SÓLIDO interno
 * Ø11 com glifo branco vazado. É a única exceção permitida à regra de ícone de
 * traço (B-22), e a régua exige explicitamente o glifo branco (C-19).
 *
 * MEDIDO na referência, linha central de cada marcador (x 1176→1193, y 221 /
 * 268 / 314): 4px de anel pastel, 10–11px de núcleo saturado.
 *   vermelho  anel #FDC1C0  núcleo #E63A31
 *   âmbar     anel #FDDAB1  núcleo #F8941E
 *   verde     anel #A6E4C6  núcleo #0B9860
 *
 * Divergência assumida, com razão: no PNG o marcador âmbar desenha a pessoa
 * em laranja DIRETO sobre o anel pastel, sem núcleo sólido. Os três aqui
 * seguem o mesmo tratamento (núcleo sólido + glifo branco) porque C-19 pede
 * "3 discos sólidos … com glifo branco vazado" para os três, e a diferença
 * cabe em 18px.
 */
export const TOM_MARCADOR: Record<Tom, { anel: string; nucleo: string }> = {
  red: { anel: "#FDC1C0", nucleo: "#E63A31" },
  amber: { anel: "#FDDAB1", nucleo: "#F8941E" },
  green: { anel: "#A6E4C6", nucleo: "#0B9860" },
  blue: { anel: "#CFE0FB", nucleo: "#3A7CF0" },
  neutral: { anel: "#E4DFDC", nucleo: "#6F6F6E" },
}

/**
 * Sombra de card: sutil, mais pesada EMBAIXO, alcance curto (B-08, B-09, D-22).
 *
 * PERFIL MEDIDO NA REFERÊNCIA (coluna x=716 atravessando o card "Placar"),
 * escurecimento em níveis de luminância contra o fundo da página:
 *   topo ....... 6,0 (pico em d=1, halo de ~3 até d=12)
 *   base ....... 9,9 (pico em d=2)
 * Ou seja: as QUATRO bordas escurecem, e a base escurece mais que o topo.
 *
 * A versão da rodada 1 tinha só camadas com deslocamento POSITIVO em y
 * (`0 1px 2px` e `0 3px 7px -2px`): o borrão inteiro nascia abaixo da borda
 * superior, então o topo media 0 nível e as laterais 3 — o card encostava no
 * fundo como degrau duro em três dos quatro lados. A correção é a primeira
 * camada, ISOTRÓPICA (deslocamento zero), que dá o halo em volta; a segunda
 * camada continua sendo o peso de baixo. Alvos: 4–12 níveis em toda borda,
 * base > topo, alcance ≤ 8px.
 *
 * `shadow-lg` do Tailwind é FAIL explícito da régua.
 */
export const SOMBRA_CARD = "0 0 6px 0 rgb(23 16 12 / 0.055), 0 3px 6px -1px rgb(23 16 12 / 0.028)"

/** Raio: card 12px, bloco tonal interno 10px (sempre ≤ o do card) — B-10, B-11. */
export const RAIO_CARD = 12
export const RAIO_TILE = 10

// ===========================================================================
// A FAIXA DO RODAPÉ — três números e uma regra
// ===========================================================================
//
// ═══ O DEFEITO QUE ESTES NÚMEROS FECHAM (2026-08-19) ═══════════════════════
// `LinkRodape` era `position: absolute` dentro de uma caixa de ALTURA ZERO
// (`<div className="absolute bottom-[20px]">`). Altura zero não empurra nada:
// o conteúdo em fluxo desce livremente até por baixo do link. Enquanto o card
// está cheio o texto por acaso termina antes da faixa, e o defeito não aparece
// — é o pior tipo de ausência de defeito, a que depende do dado do dia.
//
// Medido com tinta real (Chromium, `scripts/medir-visao-geral.mjs`), card
// "O que mudou", `?fonte=motor`, 1366px: "Ver detalhes ›" sobrepondo a frase do
// card em 6,45px × 3,62px. No ESTADO VAZIO, que é o da captura do dono, o card
// encolhe até a altura do texto e a colisão fica frontal.
//
// A regra, uma só: TODO card que carrega `LinkRodape` reserva a faixa NO FLUXO
// (`<MioloCard/>`), em QUALQUER estado — ok, vazio ou erro. Reservar dentro do
// `absolute` não reserva nada.

/** Altura da tinta do link de rodapé (11,5px / lh 16). */
export const ALTURA_RODAPE = 16

/**
 * Distância da BASE do link até a base do card.
 *
 * Era expressa ao contrário — `bottom-[20px]` numa caixa de altura zero, o que
 * posiciona o TOPO do link e deixa 4px de folga real. O número agora é o que ele
 * sempre foi de fato (4), aplicado ao próprio link, e a geometria renderizada
 * fica idêntica: base do link em `H−4`, topo em `H−20`.
 */
export const FOLGA_RODAPE = 4

/**
 * Separação mínima entre a última linha de texto e o topo do link.
 *
 * 5, o mesmo valor que a aba "Padrões e tendências" já usa desde 2026-08-18
 * (`RESERVA_RODAPE = 36` sobre uma faixa de 31). É separação de CAIXA DE LINHA:
 * a tinta fica recuada dentro dela, então o vão de tinta real é maior. 8 custava
 * 3px de dobra na linha 3 sem comprar legibilidade nenhuma.
 */
export const RESPIRO_RODAPE = 5

/** O que o miolo reserva por baixo: a faixa inteira, mais o respiro. */
export const RESERVA_RODAPE = FOLGA_RODAPE + ALTURA_RODAPE + RESPIRO_RODAPE

/**
 * O MIOLO do card: tudo que flui, com a faixa do rodapé já descontada.
 *
 * `flex-1` + `justify-center` vêm do MESMO padrão que a aba "Padrões e
 * tendências" já provou em 2026-08-18 (`padroes-tendencias-tab.tsx`): quando
 * sobra altura — e sobra sempre no estado vazio, onde o card é esticado pelo
 * irmão da linha e o conteúdo é uma frase — a folga vira respiro simétrico em
 * vez de um buraco mudo embaixo. Decisão IDS: ADAPTAR o padrão existente,
 * promovendo-o para cá, não reinventar um segundo jeito de fazer a mesma coisa.
 *
 * `min-h-0` porque um filho de flex tem mínimo automático de `min-content`, e
 * sem ele o miolo se recusaria a ceder altura dentro das linhas de altura fixa.
 */
export function MioloCard({
  children,
  className = "",
  folga = FOLGA_RODAPE,
  centrado = true,
}: {
  children: ReactNode
  className?: string
  /** A folga do link deste card, quando ela não é a padrão. */
  folga?: number
  /**
   * `false` nos cards DENSOS (a fila da §10, os sinais da §13), onde o conteúdo
   * já ocupa a altura toda e centrar só produziria um deslocamento sem motivo.
   * `true` onde a sobra é a regra — e é o caso do estado vazio em qualquer card.
   */
  centrado?: boolean
}) {
  return (
    <div
      data-miolo-card
      className={`flex min-h-0 flex-1 flex-col ${centrado ? "justify-center" : ""} ${className}`}
      style={{ paddingBottom: folga + ALTURA_RODAPE + RESPIRO_RODAPE }}
    >
      {children}
    </div>
  )
}

// ===========================================================================
// Primitivas compartilhadas
// ===========================================================================

/**
 * Card da grade. SEM borda de 1px (B-07): a separação com o fundo é a sombra.
 */
export function Card({
  className = "",
  children,
  style,
}: {
  className?: string
  children: ReactNode
  /**
   * Só para o que a régua precisa declarar em NÚMERO e não em classe — hoje o
   * `alignSelf: "stretch"` dos dois cards da linha 1, que é contrato lido por
   * teste (`rodape-nao-invade-o-miolo.test.tsx`). Raio e sombra continuam
   * fixados aqui e vêm DEPOIS, para nenhum ponto de uso poder reescrevê-los.
   */
  style?: CSSProperties
}) {
  return (
    <section
      className={`bg-white ${className}`}
      style={{ ...style, borderRadius: RAIO_CARD, boxShadow: SOMBRA_CARD }}
    >
      {children}
    </section>
  )
}

/**
 * Título de card: 14,5px / 700 / preto, cap-height ~11 (B-29 exige 10–13).
 *
 * Rodada 3: era 16px, e "Placar da jornada" media 130px de largura de tinta
 * contra 118px da referência — 10% grande. 14,5px fecha exatamente em 118.
 * A caixa de linha permanece 22px para não deslocar a fileira de tiles abaixo.
 *
 * `text-balance` (2026-08-18) — QUANDO o título não cabe em uma linha, as duas
 * linhas saem equilibradas em vez de a segunda carregar uma palavra órfã.
 * O caso medido: "Pessoas que travaram no mesmo ponto" precisa de 276px de
 * tinta e recebe 272,4 na coluna de 27,1fr da linha 2 do Mapa (169,7 a 1280 ·
 * 207,8 a 1366 · 240,5 a 1440). Sem balanceamento, a quebra deixava 39px
 * sobrando na primeira linha e a palavra "ponto" sozinha na segunda.
 * `text-wrap: balance` não faz NADA quando o título cabe em uma linha, então
 * a largura de referência (1672) fica byte a byte igual.
 */
export function CardTitulo({
  children,
  className = "",
}: { children: ReactNode; className?: string }) {
  return (
    <h2
      className={`text-[14.5px] leading-[22px] font-bold text-balance ${className}`}
      style={{ color: TEXTO.primario, letterSpacing: "-0.006em", wordSpacing: "1.5px" }}
    >
      {children}
    </h2>
  )
}

// ===========================================================================
// OS DOIS CTAs — uma fonte de APARÊNCIA para as três abas
// ===========================================================================
//
// ═══ O DEFEITO QUE ESTAS DUAS PEÇAS FECHAM (2026-08-19) ════════════════════
// O mesmo CTA de rodapé existia em SEIS implementações, e cinco eram cópia
// manual de classes: `LinkRodape` (dois ramos, `<span>` e `<Link>`),
// `BotaoRodapeGaveta` em `gaveta.tsx` (que serve as abas Padrões e Mapa) e os
// dois ramos do CTA de recomendações do Mapa. A cópia envelheceu sozinha —
// nenhuma delas declarava hover, e nenhum teste travava a aparência, então não
// havia nada impedindo o sétimo desenho.
//
// ═══ A DIVISÃO DE ALÇADA, QUE É O PONTO ════════════════════════════════════
// A primitiva carrega APARÊNCIA — tipografia, tinta, hover, foco, chevron e
// área de clique. A GEOMETRIA (`absolute`, `right`, `bottom`, `height`, a
// ancoragem inteira) continua declarada em CADA call site, porque ela é
// legitimamente diferente em cada card e está trancada por outra régua
// (`rodape-nao-invade-o-miolo.test.tsx`). Unificar geometria aqui deslocaria a
// foto do gauntlet nas três abas de uma vez.
//
// ═══ POR QUE A TINTA VIRA CLASSE, E POR QUE ELA CHEGA POR VARIÁVEL CSS ═════
// `style` vence qualquer classe: um `color` inline apagaria silenciosamente o
// `hover:` da primitiva, e a tela não denunciaria — o CTA simplesmente não
// reagiria. Então a tinta precisa ser classe. Mas classe do Tailwind é texto
// literal, e um `text-[#D54407]` escrito à mão seria uma SEGUNDA cópia do
// mesmo hexadecimal, capaz de divergir de `COR_ACAO` em silêncio. A saída é a
// variável CSS: o valor sai da constante daqui (fonte única), e a classe só o
// consome. `--cta-tinta` num `style` não é `color` — o teste que proíbe tinta
// inline continua enxergando o que precisa enxergar.

/** As três tintas do CTA, entregues ao CSS a partir das constantes acima. */
const TINTA_CTA = {
  "--cta-tinta": COR_ACAO,
  "--cta-tinta-hover": COR_ACAO_HOVER,
  "--cta-tinta-tenue": COR_ACAO_TENUE,
} as CSSProperties

/**
 * A aparência do CTA de rodapé, e NADA de geometria.
 *
 * `group` existe para o chevron poder reagir ao hover do conjunto — sem ele o
 * glifo fica inerte enquanto o rótulo escurece, que é meio hover.
 * `text-left` é por causa do `<button>`: o agente de usuário centra o texto de
 * botão, e sem isto o ramo que abre gaveta sairia deslocado do ramo que navega.
 * O `before:` alarga a área de clique sem pintar um pixel — 4px em y, que é
 * menos que o `RESPIRO_RODAPE` de 5, então a área ampliada NUNCA alcança a
 * última linha de texto do miolo e não rouba clique de ninguém.
 */
const CLASSE_CTA_RODAPE =
  "group flex cursor-pointer items-center whitespace-nowrap text-left " +
  "text-[11.5px] leading-[16px] font-semibold tracking-[-0.015em] " +
  "text-[color:var(--cta-tinta)] hover:text-[color:var(--cta-tinta-hover)] " +
  "transition-colors duration-150 " +
  "before:absolute before:-inset-x-[6px] before:-inset-y-[4px] before:content-[''] " +
  "focus-visible:outline-2 focus-visible:outline-offset-2"

/** A aparência da pílula de contorno — a segunda espécie de CTA da trinca. */
const CLASSE_CTA_PILULA =
  "group inline-flex w-fit cursor-pointer items-center rounded-[8px] " +
  "text-[11px] font-semibold border border-[color:var(--cta-tinta)] " +
  "text-[color:var(--cta-tinta)] bg-[#FFFFFF] " +
  "hover:border-[color:var(--cta-tinta-hover)] hover:text-[color:var(--cta-tinta-hover)] " +
  "hover:bg-[color:var(--cta-tinta-tenue)] transition-colors duration-150 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2"

interface PropsCta {
  rotulo: string
  /** Presente ⇒ o CTA NAVEGA (`<Link>`). */
  href?: string
  /** Presente ⇒ o CTA ABRE algo no lugar (`<button>`), tipicamente a gaveta. */
  aoClicar?: () => void
  /** GEOMETRIA do call site — ancoragem, recuo, padding. Nunca aparência. */
  className?: string
  /** GEOMETRIA em número: `bottom`, `height`. Nunca `color`. */
  style?: CSSProperties
}

/**
 * O CTA de rodapé de card, para as três abas.
 *
 * `marcarFaixa` é opt-in e pertence à GEOMETRIA: ele publica `data-rodape-card`
 * para quem precisa reservar a faixa no fluxo do card. Só quem declara a
 * própria ancoragem (`bottom` + `height` no elemento) pode marcá-la — marcar
 * sem publicar os dois números daria uma faixa de geometria ilegível, que
 * compara 0 com 0 e aprova qualquer coisa. Hoje só `LinkRodape` está nesse
 * caso; nas abas Padrões e Mapa a ancoragem vive num invólucro em volta.
 */
export function CtaRodape({
  rotulo,
  href,
  aoClicar,
  marcarFaixa = false,
  className = "",
  style,
}: PropsCta & { marcarFaixa?: boolean }) {
  const classe = `${CLASSE_CTA_RODAPE} ${className}`.trimEnd()
  const estilo = { ...TINTA_CTA, ...style }
  const faixa = marcarFaixa ? "" : undefined
  const miolo = (
    <>
      {rotulo}
      <ChevronRight
        size={13}
        strokeWidth={2.6}
        className="ml-[13px] transition-transform duration-150 group-hover:translate-x-[2px]"
      />
    </>
  )

  if (href !== undefined) {
    return (
      <Link href={href} data-cta-rodape data-rodape-card={faixa} className={classe} style={estilo}>
        {miolo}
      </Link>
    )
  }
  if (aoClicar) {
    return (
      <button
        type="button"
        onClick={aoClicar}
        data-cta-rodape
        data-rodape-card={faixa}
        className={classe}
        style={estilo}
      >
        {miolo}
      </button>
    )
  }
  // Sem destino e sem ação: o ramo inerte do preview, que existe para o
  // screenshot não depender de roteador. Em produção ele não aparece — o teste
  // de alcance por teclado varre as três abas e reprova qualquer `<span>`.
  return (
    <span data-cta-rodape data-rodape-card={faixa} className={classe} style={estilo}>
      {miolo}
    </span>
  )
}

/**
 * A pílula de contorno — "Ver pessoas (N)" e "Ver recomendações" no Mapa.
 *
 * Mesma divisão de alçada do `CtaRodape`: o padding horizontal de cada call
 * site é geometria e continua lá (11px num, 12px no outro, medidos no PNG).
 */
export function CtaPilula({ rotulo, href, aoClicar, className = "", style }: PropsCta) {
  const classe = `${CLASSE_CTA_PILULA} ${className}`.trimEnd()
  const estilo = { ...TINTA_CTA, ...style }

  if (href !== undefined) {
    return (
      <Link href={href} data-cta-pilula className={classe} style={estilo}>
        {rotulo}
      </Link>
    )
  }
  if (aoClicar) {
    return (
      <button type="button" onClick={aoClicar} data-cta-pilula className={classe} style={estilo}>
        {rotulo}
      </button>
    )
  }
  return (
    <span data-cta-pilula className={classe} style={estilo}>
      {rotulo}
    </span>
  )
}

/**
 * Link de rodapé de card — UM por card, alinhado à direita (A-30, C-20).
 * Compartilhado com as peças C ("Ver todas as pessoas ›") e F ("Ver todos os
 * sinais ›"); os três são a mesma família de laranja (B-18).
 *
 * MEDIDO na referência ("Ver detalhes ›", card "O que mudou"): tinta do texto
 * x 1507→1571 (65px), cap-height 8, baseline 332; chevron de TRAÇO isolado em
 * x 1589→1594 (vão de 18px depois do texto), tinta encostando na régua interna
 * direita do card (21px da borda). O `right-[18px]` desconta os ~3px de folga
 * que a caixa 13px do glifo Lucide deixa em volta da tinta.
 */
/**
 * `href` é OPCIONAL de propósito. Sem ele o link continua sendo o `<span>`
 * inerte de antes — que é o que a rota de preview precisa para o screenshot ser
 * determinístico e para o gauntlet não depender de roteador nenhum. Com ele o
 * MESMO desenho vira `<Link>`, sem uma classe de diferença: a geometria medida
 * acima (`right-[18px]`, o vão de 13px antes do chevron) fica idêntica nos dois
 * caminhos, senão ligar a navegação deslocaria a régua.
 */
/**
 * `folga` (2026-08-19) — a distância da BASE do link até a base do card, agora
 * declarada NO LINK em vez de num `<div absolute bottom-[N]>` de altura zero
 * em volta dele. Três ganhos e nenhuma mudança de pixel:
 *   • a faixa que o link ocupa passa a ser LEGÍVEL por quem precisa reservá-la
 *     (`data-rodape-card` + `bottom`/`height` inline), em vez de estar
 *     implícita numa classe utilitária;
 *   • some a caixa de altura zero, que era a peça que enganava — ela parecia
 *     ocupar espaço e não ocupava nenhum;
 *   • `bottom: 4` renderiza exatamente onde `bottom-[20px]` numa caixa de altura
 *     zero renderizava (topo em H−20, base em H−4), então a régua não se move.
 */
export function LinkRodape({
  rotulo,
  href,
  folga = FOLGA_RODAPE,
}: { rotulo: string; href?: string; folga?: number }) {
  return (
    <CtaRodape
      rotulo={rotulo}
      href={href}
      marcarFaixa
      // GEOMETRIA — e só ela. A ancoragem (`absolute`, `right`, `bottom`,
      // `height`) continua declarada AQUI, no dono do layout do card. A
      // aparência (tipografia, tinta, hover, foco, chevron) mudou de casa para
      // `CtaRodape`, que é a mesma peça que as abas Padrões e Mapa consomem.
      className="absolute right-[18px]"
      style={{ bottom: folga, height: ALTURA_RODAPE }}
    />
  )
}

/**
 * Círculo de ícone preenchido. TODO ícone de métrica vive dentro de um
 * (B-20), o glifo ocupa 0,38–0,54 do diâmetro (B-21) e nenhum pixel de tinta
 * escapa do disco (D-05). Nunca quadrado arredondado (B-23).
 */
export function CirculoIcone({
  tom,
  diametro,
  children,
  paleta = TOM_ICONE,
}: {
  tom: Tom
  diametro: number
  children: ReactNode
  /** `TOM_ICONE_SUAVE` nos blocos onde o PNG usa o pastel mais claro. */
  paleta?: Record<Tom, { fill: string; ink: string }>
}) {
  const { fill, ink } = paleta[tom]
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{ width: diametro, height: diametro, backgroundColor: fill, color: ink }}
    >
      {children}
    </span>
  )
}
