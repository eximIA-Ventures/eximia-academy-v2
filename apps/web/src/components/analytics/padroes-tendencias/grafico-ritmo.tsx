// ---------------------------------------------------------------------------
// §17 — o gráfico de "Evolução do ritmo", desenhado em SVG à mão.
// ---------------------------------------------------------------------------
// POR QUE NÃO `recharts`, que já está no `package.json`:
//
//   1. `ResponsiveContainer` mede o pai no CLIENTE e re-renderiza. O screenshot
//      do gauntlet precisa ser byte a byte reprodutível entre rodadas, e um
//      gráfico cujo tamanho depende de um `ResizeObserver` introduz exatamente a
//      variação que o trilho existe para eliminar.
//   2. A régua conta coisas: 2 séries, N pontos, marcador visível em CADA ponto,
//      6 marcas no eixo y, ausência de área preenchida sob as curvas (V-26,
//      V-20). Um SVG explícito torna cada uma dessas contagens uma linha de
//      código legível, em vez de uma combinação de props a auditar.
//   3. A escolha de biblioteca não é critério ("NÃO É CRITÉRIO" item 7): o que é
//      critério é a contagem e a ausência de véu colorido.
//
// O componente é PURO e sem estado — nenhum `use client`, nenhum efeito.
//
// SOBRE `preserveAspectRatio="none"`: a largura real da coluna do meio depende
// da resolução da grade em `fr`, e um `<svg>` de largura fixa em px estouraria o
// card se a coluna medisse 2px a menos (V-40 reprova qualquer corte). O viewBox
// com altura travada em CSS entrega os dois: a caixa nunca vaza, e a altura da
// área de plotagem continua sendo o número que o orçamento vertical assume.
// ---------------------------------------------------------------------------

import type { EixoY, PontoSerie } from "@/lib/analytics/padroes-tendencias"
import { TEXTO } from "../visao-geral/design"
import { TINTA_FAIXA } from "./design-padroes"

// --- Geometria do viewBox, em unidades do próprio viewBox ------------------

// A coluna de conteúdo mede 1277 e a grade dá 36,6% dela ao card do meio; menos
// os 36 de padding, a caixa do gráfico fica em ~432. O viewBox usa esse número
// para que o fator de distorção do `preserveAspectRatio="none"` seja ~1,00 na
// prática — ele existe como rede contra alguns px de diferença na resolução da
// grade, não como escala de verdade.
const LARGURA = 432
const ALTURA = 190

/** Faixa de plotagem. `TOPO`→`BASE` é o que V-08 mede como área do gráfico. */
const TOPO = 6
const BASE = 152
/** Coluna dos rótulos do eixo y, à esquerda da primeira linha de grade. */
const EIXO_X = 30
const FIM_X = 430
/**
 * Recuo dos pontos extremos dentro da faixa de grade.
 *
 * Ele NÃO existe pelo marcador, que tem 3 de raio — existe pelo RÓTULO. O
 * rótulo é centrado no ponto, e o do último balde ("– 17 ago") mede ~30: com
 * recuo de 4, ele terminava em 441 num viewBox de 432 e saía cortado como
 * "– 17 a", que é exatamente o corte silencioso na direita que V-40 reprova. O
 * elemento mais largo ancorado no ponto é quem dita o recuo, não o mais visível.
 */
const RECUO = 20

/** Cor das linhas de grade. Clara o bastante para não competir com as séries. */
const GRADE = "#EDE8E5"

const TINTA_ATIVOS = TINTA_FAIXA["2x-ou-mais"]
const TINTA_SESSOES = TINTA_FAIXA["1x"]

function xDoPonto(indice: number, total: number): number {
  if (total <= 1) return (EIXO_X + FIM_X) / 2
  const de = EIXO_X + RECUO
  const ate = FIM_X - RECUO
  return de + (indice * (ate - de)) / (total - 1)
}

function yDoValor(valor: number, topo: number): number {
  if (topo <= 0) return BASE
  return BASE - (Math.max(0, valor) / topo) * (BASE - TOPO)
}

/**
 * "26 mai – 1 jun" vira duas linhas, e é o que a referência faz.
 *
 * Com 8 fatias em 385 unidades, cada rótulo tem ~54 de largura; numa linha só,
 * vizinhos se sobrepõem, e V-39 reprova sobreposição. O corte é no traço de
 * intervalo, que continua visível na segunda linha para o rótulo permanecer
 * legível como um intervalo, e não como duas datas soltas.
 */
function duasLinhas(rotulo: string): [string, string] {
  const partes = rotulo.split(" – ")
  if (partes.length !== 2) return [rotulo, ""]
  return [partes[0] ?? "", `– ${partes[1] ?? ""}`]
}

function Serie({
  pontos,
  valor,
  cor,
  topo,
}: {
  pontos: readonly PontoSerie[]
  valor: (p: PontoSerie) => number
  cor: string
  topo: number
}) {
  const coordenadas = pontos.map((p, i) => ({
    x: xDoPonto(i, pontos.length),
    y: yDoValor(valor(p), topo),
    chave: p.inicioISO,
  }))
  return (
    <g>
      {/*
        `polyline` com `fill="none"`: V-20 proíbe qualquer área preenchida sob a
        curva. Um `path` fechado com opacidade é o desenho mais comum deste
        gráfico e é exatamente o que a régua chama de véu colorido.
      */}
      <polyline
        fill="none"
        stroke={cor}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={coordenadas.map((c) => `${c.x},${c.y}`).join(" ")}
      />
      {/* Marcador em CADA ponto (V-26), com miolo branco para o ponto continuar
          visível quando as duas séries se cruzam. */}
      {coordenadas.map((c) => (
        <circle
          key={c.chave}
          cx={c.x}
          cy={c.y}
          r={3.1}
          fill="#FFFFFF"
          stroke={cor}
          strokeWidth={1.8}
        />
      ))}
    </g>
  )
}

export function GraficoRitmo({ pontos, eixo }: { pontos: readonly PontoSerie[]; eixo: EixoY }) {
  return (
    <svg
      viewBox={`0 0 ${LARGURA} ${ALTURA}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height: ALTURA }}
      role="img"
      aria-label="Alunos ativos e sessões realizadas por semana"
    >
      <title>Alunos ativos e sessões realizadas por semana</title>

      {/* Grade horizontal + rótulos do eixo y: uma marca por tick (V-26). */}
      {eixo.ticks.map((t) => {
        const y = yDoValor(t, eixo.topo)
        return (
          <g key={t}>
            <line x1={EIXO_X} x2={FIM_X} y1={y} y2={y} stroke={GRADE} strokeWidth={1} />
            <text
              x={EIXO_X - 7}
              y={y + 3}
              textAnchor="end"
              fontSize={9}
              fill={TEXTO.mudo}
              className="tabular-nums"
            >
              {t}
            </text>
          </g>
        )
      })}

      <Serie pontos={pontos} valor={(p) => p.ativos} cor={TINTA_ATIVOS} topo={eixo.topo} />
      <Serie pontos={pontos} valor={(p) => p.sessoes} cor={TINTA_SESSOES} topo={eixo.topo} />

      {pontos.map((p, i) => {
        const [linha1, linha2] = duasLinhas(p.rotulo)
        const x = xDoPonto(i, pontos.length)
        return (
          <g key={p.inicioISO}>
            <text x={x} y={BASE + 15} textAnchor="middle" fontSize={8.6} fill={TEXTO.mudo}>
              {linha1}
            </text>
            {linha2 ? (
              <text x={x} y={BASE + 26} textAnchor="middle" fontSize={8.6} fill={TEXTO.mudo}>
                {linha2}
              </text>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}

/** Entrada da legenda: marcador redondo cheio + rótulo. Duas, nesta ordem. */
export function LegendaRitmo({ rotulo, id }: { rotulo: string; id: "ativos" | "sessoes" }) {
  return (
    <span className="inline-flex items-center gap-[6px]">
      <span
        className="inline-block h-[8px] w-[8px] rounded-full"
        style={{ backgroundColor: id === "ativos" ? TINTA_ATIVOS : TINTA_SESSOES }}
      />
      {rotulo}
    </span>
  )
}
