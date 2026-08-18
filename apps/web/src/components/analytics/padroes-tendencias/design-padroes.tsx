// ---------------------------------------------------------------------------
// EXTENSÃO da linguagem visual da casa para a aba "Padrões e tendências".
// ---------------------------------------------------------------------------
// `../visao-geral/design.tsx` é a língua comum e NÃO se edita a partir daqui:
// superfícies, sombra, raio, tiers de texto, laranja de ação, círculo de ícone e
// link de rodapé vêm de lá por IMPORT. Este arquivo declara apenas o que só esta
// tela tem, e cada peça abaixo existe porque a régua desta aba pede algo que a
// aba anterior não pedia:
//
//   • uma QUARTA cor semântica na §20 (a partição tem quatro faixas, e duas
//     delas são `amber` no contrato — pintá-las igual apagaria uma faixa
//     inteira da barra empilhada);
//   • pílula de CONTORNO para os selos da §18 (V-19), que a Visão geral não tem;
//   • fundo tonal por tom para os tiles da §21;
//   • a resolução dos nomes de ícone que a camada de dados emite como string.
//
// Decisão IDS: ESTENDER. Nada aqui redefine um token que já existe — o laranja
// de ação, os quatro tiers de texto e a paleta de disco são importados e
// reexportados quando precisam ser vistos daqui, nunca recriados com outro
// valor. Um segundo `#D54407` escrito neste arquivo seria a origem de duas
// telas com dois laranjas.
// ---------------------------------------------------------------------------

import type { Tom } from "@/lib/analytics/padroes-tendencias"
import {
  ArrowDownRight,
  ArrowUp,
  ChartColumn,
  CircleHelp,
  CloudDrizzle,
  Lightbulb,
  Pause,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  UserMinus,
  UserPlus,
} from "lucide-react"
import type { ReactNode } from "react"
import { TEXTO, TOM_ICONE, VARIACAO } from "../visao-geral/design"

// ===========================================================================
// A quarta cor da §20
// ===========================================================================

/**
 * Tinta do NÚMERO de cada faixa da §20 (V-29: verde · laranja · âmbar-vermelho
 * · vermelho) e dos quatro segmentos da barra empilhada.
 *
 * POR QUE ESTE MAPA EXISTE, e não é preciosismo: o contrato marca `1x/semana` e
 * `Irregular` as DUAS como `amber` (`participacao.ts`). Renderizar as duas com a
 * mesma tinta faria os segmentos de 28% e 25% da barra empilhada virarem um
 * bloco só de 53% — a régua pede quatro segmentos distinguíveis (V-36), e a
 * faixa do meio deixaria de existir aos olhos de quem lê.
 *
 * A chave é o `id` da faixa, não o `tom`: é exatamente porque dois ids
 * compartilham um tom que o mapa precisa ser por id. Os extremos reusam o verde
 * e o vermelho de `VARIACAO`, que já são os valores medidos na referência.
 */
export const TINTA_FAIXA = {
  "2x-ou-mais": VARIACAO.positivo,
  "1x": "#E07104",
  /** Âmbar avermelhado: o degrau entre o laranja de `1x` e o vermelho do fim. */
  irregular: "#DC5C2E",
  "sem-atividade": VARIACAO.negativo,
} as const

// ===========================================================================
// Superfícies tonais desta tela
// ===========================================================================

/**
 * Fundo dos tiles da §21 e das células da §20.
 *
 * Deliberadamente CLARO: a régua exige que nenhuma superfície de card caia
 * abaixo de 240 de luminância e que nenhuma região grande fique abaixo de 200
 * (V-13). Estes tons ficam entre o fundo da página e o branco do card, que é a
 * hierarquia de três níveis que V-14 pede — um pastel saturado leria como um
 * quarto nível e escureceria um bloco de 100×100.
 */
export const FUNDO_TILE: Record<Tom, string> = {
  green: "#F0F8F3",
  amber: "#FDF6EC",
  red: "#FDF2F1",
  blue: "#F1F5FD",
  neutral: "#FAF8F7",
}

/** Faixa de foco e nota da §20: superfície quente, distinta do fundo da página. */
export const FUNDO_QUENTE = "#FBF1E9"

/** Borda de contorno de pílula e de botão, por tom semântico (V-19). */
export const BORDA_TOM: Record<Tom, string> = {
  green: "#9FD8BE",
  amber: "#F3C48A",
  red: "#F0AEAC",
  blue: "#AFC7F5",
  neutral: "#E4DFDC",
}

// ===========================================================================
// Ícones — a camada de dados emite NOME, a UI resolve o glifo
// ===========================================================================

const GLIFOS = {
  "trending-up": TrendingUp,
  "trending-down": TrendingDown,
  "user-minus": UserMinus,
  "user-plus": UserPlus,
  "cloud-drizzle": CloudDrizzle,
  pause: Pause,
  "arrow-up": ArrowUp,
  "arrow-down-right": ArrowDownRight,
  "chart-column": ChartColumn,
  "rotate-ccw": RotateCcw,
  lightbulb: Lightbulb,
  "circle-help": CircleHelp,
} as const

export type NomeIcone = keyof typeof GLIFOS

/**
 * Ícone de traço, sempre. `strokeWidth` 2 sobre um glifo de 20px dá a espessura
 * de 1,5–2,5px que V-18 exige, e o Lucide já entrega pontas arredondadas.
 *
 * O fallback NÃO é silencioso por acaso: um nome desconhecido vindo da camada
 * renderiza o glifo neutro em vez de sumir. Ícone que desaparece é um item de
 * lista que perde o alinhamento sem ninguém notar na revisão.
 */
export function Glifo({
  nome,
  tamanho,
  espessura = 2,
}: { nome: string; tamanho: number; espessura?: number }) {
  const Componente = GLIFOS[nome as NomeIcone] ?? ChartColumn
  return <Componente size={tamanho} strokeWidth={espessura} />
}

// ===========================================================================
// Pílula de contorno (V-19)
// ===========================================================================

/**
 * Selo dos sinais da §18: fundo quase branco, borda de 1px na cor semântica.
 *
 * NÃO é preenchida, e a diferença importa além do gosto: um selo de fundo
 * saturado ao lado de um número de variação colorido cria duas fontes de cor
 * competindo pela mesma leitura, e o leitor deixa de saber qual delas é o dado.
 * `whitespace-nowrap` porque V-39 exige o selo em uma linha.
 */
export function Pilula({ rotulo, tom }: { rotulo: string; tom: Tom }) {
  return (
    <span
      className="inline-flex h-[24px] shrink-0 items-center rounded-full border px-[9px] text-[9.5px] leading-[12px] font-semibold whitespace-nowrap"
      style={{
        borderColor: BORDA_TOM[tom],
        color: TOM_ICONE[tom].ink,
        backgroundColor: "#FEFDFD",
        letterSpacing: "-0.004em",
      }}
    >
      {rotulo}
    </span>
  )
}

// ===========================================================================
// Botão de contorno do cabeçalho (V-23)
// ===========================================================================

/** `Como ler esta visão`. Inerte: esta tela não escreve nada (F-44). */
export function BotaoContorno({ rotulo }: { rotulo: string }) {
  return (
    <span
      className="inline-flex h-[36px] shrink-0 items-center gap-[7px] rounded-full border px-[15px] text-[11.5px] leading-[16px] font-semibold whitespace-nowrap"
      style={{ borderColor: BORDA_TOM.neutral, color: TEXTO.secundario, letterSpacing: "-0.006em" }}
    >
      <Glifo nome="circle-help" tamanho={14} />
      {rotulo}
    </span>
  )
}

// ===========================================================================
// Célula tonal
// ===========================================================================

/** Bloco tonal interno. Raio 10, sempre ≤ o do card (V-14). */
export function Tile({
  tom,
  className = "",
  children,
}: { tom: Tom; className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-[10px] ${className}`} style={{ backgroundColor: FUNDO_TILE[tom] }}>
      {children}
    </div>
  )
}
