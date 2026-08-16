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

import { ChevronRight } from "lucide-react"
import type { ReactNode } from "react"
import type { Tom } from "./fixture"

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
// Primitivas compartilhadas
// ===========================================================================

/**
 * Card da grade. SEM borda de 1px (B-07): a separação com o fundo é a sombra.
 */
export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <section
      className={`bg-white ${className}`}
      style={{ borderRadius: RAIO_CARD, boxShadow: SOMBRA_CARD }}
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
 */
export function CardTitulo({
  children,
  className = "",
}: { children: ReactNode; className?: string }) {
  return (
    <h2
      className={`text-[14.5px] leading-[22px] font-bold ${className}`}
      style={{ color: TEXTO.primario, letterSpacing: "-0.006em", wordSpacing: "1.5px" }}
    >
      {children}
    </h2>
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
export function LinkRodape({ rotulo }: { rotulo: string }) {
  return (
    <span
      className="absolute right-[18px] flex items-center text-[11.5px] leading-[16px] font-semibold whitespace-nowrap"
      style={{ color: COR_ACAO, letterSpacing: "-0.015em" }}
    >
      {rotulo}
      <ChevronRight size={13} strokeWidth={2.6} className="ml-[13px]" />
    </span>
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
}: {
  tom: Tom
  diametro: number
  children: ReactNode
}) {
  const { fill, ink } = TOM_ICONE[tom]
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{ width: diametro, height: diametro, backgroundColor: fill, color: ink }}
    >
      {children}
    </span>
  )
}
