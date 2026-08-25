// ---------------------------------------------------------------------------
// §18 — Evolução da profundidade. SVG de duas linhas (profundidade,
// aplicação) sobre eixo 0-100%. Construído do zero para esta tela — não é o
// mesmo rigor pixel-medido de `grafico-ritmo.tsx` (Ativação, ~10 arquivos de
// teste dedicados); aqui é geometria correta e proporção fiel aos dados, sem
// medição de referência própria (não existe PNG de Padrões e Evolução
// congelado para este domínio, só a spec e a imagem conceitual do deck).
// ---------------------------------------------------------------------------

import type { PontoSerieSemanal } from "@/lib/analytics/aprendizagem-time/tipos"
import { TEXTO, TOM_ICONE } from "./design"

const LARGURA = 1000
const ALTURA = 220
const MARGEM = { topo: 10, base: 24, esquerda: 34, direita: 10 }

function coordenadas(
  pontos: readonly PontoSerieSemanal[],
  chave: "profundidadePercent" | "aplicacaoPercent",
) {
  const areaLargura = LARGURA - MARGEM.esquerda - MARGEM.direita
  const areaAltura = ALTURA - MARGEM.topo - MARGEM.base
  const passo = pontos.length > 1 ? areaLargura / (pontos.length - 1) : 0
  return pontos.map((p, i) => {
    const valor = p[chave]
    if (valor === null) return null
    const x = MARGEM.esquerda + i * passo
    const y = MARGEM.topo + areaAltura * (1 - valor / 100)
    return { x, y }
  })
}

function caminho(coords: ReturnType<typeof coordenadas>): string {
  let d = ""
  let emAberto = false
  for (const c of coords) {
    if (!c) {
      emAberto = false
      continue
    }
    d += emAberto ? ` L ${c.x} ${c.y}` : `M ${c.x} ${c.y}`
    emAberto = true
  }
  return d
}

export function GraficoProfundidade({ pontos }: { pontos: readonly PontoSerieSemanal[] }) {
  const coordsProfundidade = coordenadas(pontos, "profundidadePercent")
  const coordsAplicacao = coordenadas(pontos, "aplicacaoPercent")
  const areaLargura = LARGURA - MARGEM.esquerda - MARGEM.direita
  const passo = pontos.length > 1 ? areaLargura / (pontos.length - 1) : 0
  const niveisY = [0, 25, 50, 75, 100]

  return (
    <div>
      <div className="flex items-center gap-[18px] text-[12px]" style={{ color: TEXTO.secundario }}>
        <span className="flex items-center gap-[6px]">
          <span
            className="inline-block h-[8px] w-[8px] rounded-full"
            style={{ backgroundColor: TOM_ICONE.green.ink }}
          />
          Profundidade média
        </span>
        <span className="flex items-center gap-[6px]">
          <span
            className="inline-block h-[8px] w-[8px] rounded-full"
            style={{ backgroundColor: TOM_ICONE.blue.ink }}
          />
          Aplicação
        </span>
      </div>
      <svg
        viewBox={`0 0 ${LARGURA} ${ALTURA}`}
        className="mt-[10px] w-full"
        role="img"
        aria-label="Evolução semanal de profundidade e aplicação"
      >
        {niveisY.map((nivel) => {
          const y = MARGEM.topo + (ALTURA - MARGEM.topo - MARGEM.base) * (1 - nivel / 100)
          return (
            <g key={nivel}>
              <line
                x1={MARGEM.esquerda}
                x2={LARGURA - MARGEM.direita}
                y1={y}
                y2={y}
                stroke="#EDE9E6"
                strokeWidth={1}
              />
              <text x={0} y={y + 4} fontSize={11} fill={TEXTO.mudo}>
                {nivel}%
              </text>
            </g>
          )
        })}
        <path
          d={caminho(coordsProfundidade)}
          fill="none"
          stroke={TOM_ICONE.green.ink}
          strokeWidth={2.2}
        />
        <path
          d={caminho(coordsAplicacao)}
          fill="none"
          stroke={TOM_ICONE.blue.ink}
          strokeWidth={2.2}
        />
        {coordsProfundidade.map(
          (c, i) =>
            c && (
              <circle
                key={`p-${pontos[i].rotulo}`}
                cx={c.x}
                cy={c.y}
                r={3}
                fill={TOM_ICONE.green.ink}
              />
            ),
        )}
        {coordsAplicacao.map(
          (c, i) =>
            c && (
              <circle
                key={`a-${pontos[i].rotulo}`}
                cx={c.x}
                cy={c.y}
                r={3}
                fill={TOM_ICONE.blue.ink}
              />
            ),
        )}
        {pontos.map((p, i) =>
          i % 2 === 0 ? (
            <text
              key={p.rotulo}
              x={MARGEM.esquerda + i * passo}
              y={ALTURA - 6}
              fontSize={11}
              fill={TEXTO.mudo}
              textAnchor="middle"
            >
              {p.rotulo}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  )
}
