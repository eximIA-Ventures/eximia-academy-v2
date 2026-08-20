// ---------------------------------------------------------------------------
// §17 — o gráfico de "Evolução do ritmo", desenhado em SVG à mão.
// ---------------------------------------------------------------------------
// POR QUE NÃO `recharts`, que já está no `package.json`:
//
//   1. `ResponsiveContainer` mede o pai no CLIENTE e re-renderiza. O screenshot
//      do gauntlet precisa ser byte a byte reprodutível entre rodadas, e um
//      gráfico cujo tamanho depende de um `ResizeObserver` introduz exatamente a
//      variação que o trilho existe para eliminar.
//   2. A régua conta coisas: 2 séries, N pontos, marca visível em CADA ponto,
//      marcas no eixo y, ausência de área preenchida sob as séries (V-26, V-20).
//      Um SVG explícito torna cada uma dessas contagens uma linha de código
//      legível, em vez de uma combinação de props a auditar.
//   3. A escolha de biblioteca não é critério ("NÃO É CRITÉRIO" item 7): o que é
//      critério é a contagem e a ausência de véu colorido.
//
// O componente é PURO e sem estado — nenhum efeito, nenhum `useState`.
//
// ═══════════════════════════════════════════════════════════════════════════
// O QUE MUDOU NESTA VERSÃO, E POR QUÊ (2026-08-20)
// ═══════════════════════════════════════════════════════════════════════════
// DECISÃO DO DONO, literal: "volta para linha, só melhora o visual". A versão
// anterior tinha trocado LINHA por BARRA AGRUPADA para resolver a oclusão — a
// legenda prometia duas séries e o desenho entregava uma, porque `ativos` e
// `sessoes` coincidem em valor no tenant real e a marca de cima apagava a de
// baixo. A barra resolvia por construção (cada série ganhava slot físico) e
// custava a instrução do dono. Isto aqui é a linha DE VOLTA, com a oclusão
// resolvida DENTRO da linguagem de linha.
//
// ─── A REGRA DURA ──────────────────────────────────────────────────────────
// A LEGENDA NUNCA PROMETE O QUE O GRÁFICO NÃO ENTREGA. Se as duas séries
// coincidem em valor, isso tem que ser visível. São QUATRO cues independentes,
// e nenhuma delas depende do valor do dado para funcionar:
//
//   1. DESLOCAMENTO ÓPTICO HORIZONTAL (`PASSO_DE_DESLOCAMENTO`, 8 unidades). É
//      o MESMO dodge da barra agrupada, aplicado à linha: dentro da fatia da
//      semana, `ativos` fica 4 unidades à esquerda do centro e `sessoes` 4 à
//      direita. É horizontal e não vertical DE PROPÓSITO: o eixo x é um balde
//      (a semana inteira), então qualquer x dentro da fatia é igualmente "aquela
//      semana", e o y — que é o VALOR — permanece EXATO, sem um único décimo de
//      distorção. Um deslocamento vertical mentiria sobre a grandeza medida e
//      colocaria o marcador de valor 0 abaixo da linha do zero, que se lê como
//      número negativo.
//   2. TRACEJADO CONTRA CONTÍNUO. `ativos` é tracejada e é pintada POR CIMA;
//      `sessoes` é contínua. Onde os dois trajetos coincidem em y, a série de
//      cima é feita de intervalos, e o laranja aparece nos vãos. Uma linha
//      contínua sobre outra sempre apaga; uma tracejada, nunca.
//   3. FORMAS DE MARCADOR DISTINTAS. `ativos` é LOSANGO, `sessoes` é CÍRCULO.
//      Distingue as séries mesmo em impressão monocromática e para quem não
//      separa verde de laranja.
//   4. ESPESSURAS DIFERENTES (2,2 contra 1,6).
//
//   Consequência que vale como invariante e está testada: os marcadores de duas
//   séries NUNCA podem se sobrepor, porque `PASSO_DE_DESLOCAMENTO` (8) é maior
//   que o diâmetro do marcador (6,4) — a separação é geométrica, não sorte do
//   dado. E como o y é exato, o desenho jamais inverte a ordem real das séries:
//   com `ativos ≤ sessoes` estrutural (F-46), o losango nunca aparece acima do
//   círculo.
//
// ─── O EIXO X: INTERVALO COMPLETO, EM RÓTULOS ALTERNADOS ───────────────────
// ESCOLHA DO DONO: "24 jun – 1 jul" em vez de "24 jun", mostrado a cada N
// semanas. O `N` é DERIVADO (`passoDosRotulos`), nunca um número mágico: é o
// menor inteiro em que o rótulo mais largo da série mais um vão mínimo cabem em
// `N` fatias. Com 8 semanas o intervalo mede ~67 unidades contra uma fatia de
// 50, e o passo sai 2; com 12 semanas a fatia cai para 33 e o passo sai 3. Se a
// largura mudar, o passo muda junto — e a régua do teste calcula o mesmo número
// a partir das mesmas medidas, não de um literal repetido.
//
// TODA semana continua marcada no eixo (`data-tick="x"`), inclusive as sem
// rótulo: pular o rótulo não pode virar pular a semana. E cada semana mantém
// UMA caixa de rótulo (`data-eixo="x"`), vazia quando o passo a pula — o eixo
// tem uma vaga por semana, e a vaga vazia é a prova de que ninguém sumiu.
// Nenhum rótulo é rotacionado e nenhum ocupa duas linhas (V-39).
//
// ─── O QUE FOI PRESERVADO DA VERSÃO ANTERIOR ───────────────────────────────
// Tooltip por semana com o intervalo completo e os dois valores; alternativa
// textual de verdade (`<table>` `sr-only`, com o SVG fora da árvore de
// acessibilidade); o valor impresso quando cabe; o eixo y lido do domínio
// derivado (`dominioDaSerie`); estado vazio que não desenha eixo. Continua
// valendo a proibição de gradiente e de área preenchida sob as curvas (V-20):
// não existe um único `<path>` fechado nem um `fill` sob as séries aqui.
//
// SOBRE `preserveAspectRatio="none"`: a largura real da coluna do meio depende
// da resolução da grade em `fr`, e um `<svg>` de largura fixa em px estouraria o
// card se a coluna medisse 2px a menos (V-40 reprova qualquer corte). O viewBox
// com altura travada em CSS entrega os dois: a caixa nunca vaza, e a altura da
// área de plotagem continua sendo o número que o orçamento vertical assume. Os
// elementos de TRAÇO levam `vector-effect="non-scaling-stroke"` para a espessura
// não ficar anisotrópica quando a coluna não mede exatamente 432.
//
// EFEITO COLATERAL CONHECIDO, e ele é ANTERIOR a esta rodada: com
// `preserveAspectRatio="none"`, tudo que é PREENCHIMENTO (glifo de texto,
// marcador) é comprimido horizontalmente na mesma proporção quando a coluna mede
// menos que 432. Isso não afeta a sobreposição de rótulos — rótulo e fatia
// encolhem pelo MESMO fator, então o veredito de "cabe" é invariante de escala,
// e é isso que o teste de larguras prova.
// ---------------------------------------------------------------------------

import type { EixoY, EntradaLegenda, PontoSerie } from "@/lib/analytics/padroes-tendencias"
import { TEXTO } from "../visao-geral/design"
import { TINTA_FAIXA } from "./design-padroes"

type IdSerie = EntradaLegenda["id"]

// --- Geometria do viewBox, em unidades do próprio viewBox ------------------

// A coluna de conteúdo mede 1277 e a grade dá 36,6% dela ao card do meio; menos
// os 36 de padding, a caixa do gráfico fica em ~432. O viewBox usa esse número
// para que o fator de distorção do `preserveAspectRatio="none"` seja ~1,00 na
// prática — ele existe como rede contra alguns px de diferença na resolução da
// grade, não como escala de verdade.
export const LARGURA = 432
const ALTURA = 190

/** Faixa de plotagem. `TOPO`→`BASE` é o que V-08 mede como área do gráfico. */
const TOPO = 12
export const BASE = 162
/** Coluna dos rótulos do eixo y, à esquerda da primeira linha de grade. */
export const EIXO_X = 30
export const FIM_X = 430

/** Cor das linhas de grade. Clara o bastante para não competir com as séries. */
const GRADE = "#EDE8E5"
/** A linha do zero é o piso da leitura: um degrau mais firme que a grade. */
const GRADE_ZERO = "#DCD5D1"

const TINTA_ATIVOS = TINTA_FAIXA["2x-ou-mais"]
const TINTA_SESSOES = TINTA_FAIXA["1x"]

/** Cor por série. A chave é a mesma da legenda: não há como uma virar a outra. */
const TINTA_DA_SERIE: Record<IdSerie, string> = {
  ativos: TINTA_ATIVOS,
  sessoes: TINTA_SESSOES,
}

/** Qual número de um ponto pertence a cada série. */
const VALOR_DA_SERIE: Record<IdSerie, (p: PontoSerie) => number> = {
  ativos: (p) => p.ativos,
  sessoes: (p) => p.sessoes,
}

// --- As quatro cues que impedem uma série de sumir sob a outra --------------

/**
 * Distância horizontal entre os pontos das duas séries dentro da mesma semana.
 *
 * Tem que ser MAIOR que `2 × RAIO_MARCA`, senão dois marcadores coincidentes se
 * tocam. 8 > 6,4 deixa 1,6 unidade de vão limpo, e a separação passa a ser
 * consequência da geometria em vez de consequência de os valores diferirem.
 */
export const PASSO_DE_DESLOCAMENTO = 8
export const RAIO_MARCA = 3.2

/** A tracejada é pintada por último, e é por isso que a de baixo continua visível. */
const ORDEM_DE_PINTURA: readonly IdSerie[] = ["sessoes", "ativos"]

const ESPESSURA_DA_SERIE: Record<IdSerie, number> = { ativos: 1.6, sessoes: 2.2 }
/** `null` = contínua. Exatamente UMA série é tracejada — a de cima. */
const TRACEJADO_DA_SERIE: Record<IdSerie, string | null> = { ativos: "5 3.4", sessoes: null }

// --- Tipografia ------------------------------------------------------------

const FONTE_EIXO_Y = 9
const FONTE_ROTULO_X = 8.6
const FONTE_VALOR = 8
/**
 * Fração do corpo que o caractere MAIS LARGO deste rótulo ocupa (~0,56, medido
 * num algarismo em `tabular-nums`). Usar o caractere mais largo para todos é
 * deliberado: superestima a caixa, e uma estimativa que superestima só pode
 * errar para o lado de NÃO sobrepor.
 */
const LARGURA_CARACTERE = 0.56
/** Vão mínimo entre dois rótulos vizinhos do eixo x. */
const VAO_ROTULO = 6
/** Respiro entre o número impresso e o marcador que ele descreve. */
const VAO_VALOR = 2.5

export function larguraDoTexto(texto: string, corpo: number): number {
  return texto.length * corpo * LARGURA_CARACTERE
}

/**
 * Separador do rótulo de semana: espaço + qualquer coisa que não seja letra nem
 * dígito + espaço.
 *
 * A alternativa era importar `TRACO_INTERVALO` do barril da camada de dados —
 * que reexporta a leitura do Supabase e não tem por que entrar no bundle de um
 * desenho. Casar pela FORMA do separador em vez do caractere evita a segunda
 * cópia da constante e sobrevive a uma troca de traço lá dentro.
 */
const SEPARADOR_DE_INTERVALO = /\s[^\p{L}\p{N}]+\s/u

/**
 * "26 mai – 1 jun" → "26 mai" · "2 – 8 jun" → "2 jun".
 *
 * A DEGRADAÇÃO do eixo, não mais o formato padrão. O dono escolheu o intervalo
 * completo, e ele cabe em toda largura que esta tela produz hoje. Esta função
 * existe para o caso em que NEM UM rótulo inteiro cabe na área de plotagem (um
 * rótulo mais longo vindo de outra régua de data, por exemplo): aí o eixo cai
 * para a data de início em vez de desenhar rótulos cortados ou sobrepostos.
 *
 * O segundo caso é o que exige a função ser mais que um `split`: quando o balde
 * não cruza o mês, o mês aparece só no FIM do rótulo, e um eixo com "2", "9",
 * "16" soltos não diz de que mês está falando.
 */
export function inicioDoRotulo(rotulo: string): string {
  const [antes, depois] = rotulo.split(SEPARADOR_DE_INTERVALO)
  const inicio = (antes ?? rotulo).trim()
  if (/\p{L}/u.test(inicio)) return inicio
  const mes = (depois ?? "").trim().split(" ").pop() ?? ""
  return mes ? `${inicio} ${mes}` : inicio
}

function yDoValor(valor: number, topo: number): number {
  if (topo <= 0) return BASE
  return BASE - (Math.max(0, valor) / topo) * (BASE - TOPO)
}

interface Geometria {
  fatia: number
  /** Deslocamento aplicado à série de índice `j`, simétrico em torno do centro. */
  deslocamento: (j: number, nSeries: number) => number
}

function geometria(nPontos: number): Geometria {
  const fatia = (FIM_X - EIXO_X) / Math.max(1, nPontos)
  return {
    fatia,
    deslocamento: (j, nSeries) => (j - (nSeries - 1) / 2) * PASSO_DE_DESLOCAMENTO,
  }
}

const inicioDaFatia = (i: number, g: Geometria) => EIXO_X + i * g.fatia
const centroDaFatia = (i: number, g: Geometria) => inicioDaFatia(i, g) + g.fatia / 2

// ===========================================================================
// O eixo x: quais semanas ganham rótulo, e onde ele fica
// ===========================================================================

export interface RotulosDoEixo {
  /** Texto por semana. String vazia = a vaga existe e o passo a pulou. */
  textos: readonly string[]
  /** Quantas semanas entre dois rótulos. Derivado da largura, nunca fixado. */
  passo: number
  /** `true` quando nem um intervalo inteiro cabe e o eixo caiu para a data de início. */
  degradado: boolean
}

/**
 * O menor passo em que o rótulo mais largo + o vão cabem em `passo` fatias.
 *
 * `Math.max(1, …)` porque passo 0 não existe; `Math.ceil` porque meio rótulo a
 * mais já encosta no vizinho.
 */
export function passoDosRotulos(rotulos: readonly string[], fatia: number): number {
  const maior = Math.max(0, ...rotulos.map((t) => larguraDoTexto(t, FONTE_ROTULO_X)))
  if (fatia <= 0) return Math.max(1, rotulos.length)
  return Math.max(1, Math.ceil((maior + VAO_ROTULO) / fatia))
}

/**
 * Quais semanas ganham rótulo, ancorando na MAIS RECENTE.
 *
 * A âncora é o fim da série e não o começo porque a semana corrente é a que o
 * gestor procura primeiro: ela tem rótulo em toda configuração de passo. O que
 * cai fora do passo continua com marca no eixo e com o intervalo completo no
 * tooltip e na tabela.
 */
export function rotulosDoEixo(rotulos: readonly string[], fatia: number): RotulosDoEixo {
  const n = rotulos.length
  const larguraUtil = FIM_X - EIXO_X
  const cabeInteiro = rotulos.every((t) => larguraDoTexto(t, FONTE_ROTULO_X) <= larguraUtil)
  const usados = cabeInteiro ? rotulos : rotulos.map(inicioDoRotulo)
  const passo = passoDosRotulos(usados, fatia)
  return {
    textos: usados.map((t, i) => ((n - 1 - i) % passo === 0 ? t : "")),
    passo,
    degradado: !cabeInteiro,
  }
}

/**
 * x do rótulo: o centro da fatia, contido na caixa do desenho.
 *
 * O rótulo alternado é, por construção, MAIS LARGO que uma fatia — então o das
 * pontas encostaria fora do viewBox e V-40 reprovaria o corte. A contenção
 * empurra só o necessário, e o rótulo continua cobrindo a marca da própria
 * semana (é o que o teste do eixo verifica: o tique fica dentro da caixa do
 * texto).
 */
export function xDoRotulo(centro: number, largura: number): number {
  const meia = largura / 2
  return Math.min(Math.max(centro, meia + 1), LARGURA - meia - 1)
}

/**
 * O valor só é impresso quando os DOIS números da semana cabem na fatia dela,
 * um de cada lado do par de marcadores. Com 12 semanas e valores de 4
 * algarismos eles não cabem, e aí o número vive no tooltip e na tabela — nunca
 * num rótulo sobreposto.
 */
export function valoresCabem(maiorValor: number, fatia: number): boolean {
  const algarismos = String(Math.max(0, Math.round(maiorValor))).length
  const numero = algarismos * FONTE_VALOR * LARGURA_CARACTERE
  return PASSO_DE_DESLOCAMENTO + 2 * RAIO_MARCA + 2 * VAO_VALOR + 2 * numero <= fatia
}

/** Losango: a marca de `ativos`. Forma distinta do círculo, não só cor distinta. */
function pontosDoLosango(x: number, y: number, r: number): string {
  return `${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`
}

export function GraficoRitmo({
  pontos,
  eixo,
  legenda,
}: {
  pontos: readonly PontoSerie[]
  eixo: EixoY
  legenda: readonly EntradaLegenda[]
}) {
  // Série vazia não desenha eixo NEM tabela: gráfico vazio parece dado e é
  // ausência. Quem fala nesse caso é o texto da §32, no card.
  if (pontos.length === 0 || legenda.length === 0) return null

  const g = geometria(pontos.length)
  const maiorValor = Math.max(
    0,
    ...pontos.flatMap((p) => legenda.map((e) => VALOR_DA_SERIE[e.id](p))),
  )
  const mostrarValores = valoresCabem(maiorValor, g.fatia)
  const eixoX = rotulosDoEixo(
    pontos.map((p) => p.rotulo),
    g.fatia,
  )

  // Uma trilha por entrada de legenda, calculada UMA vez. A linha e os
  // marcadores leem as MESMAS coordenadas, então não há como o traço passar por
  // um lugar e a marca por outro.
  const trilhas = legenda.map((entrada, j) => {
    const dx = g.deslocamento(j, legenda.length)
    return {
      id: entrada.id,
      cor: TINTA_DA_SERIE[entrada.id],
      dx,
      pontos: pontos.map((p, i) => ({
        valor: VALOR_DA_SERIE[entrada.id](p),
        x: centroDaFatia(i, g) + dx,
        y: yDoValor(VALOR_DA_SERIE[entrada.id](p), eixo.topo),
      })),
    }
  })
  const ordenadas = ORDEM_DE_PINTURA.map((id) => trilhas.find((t) => t.id === id)).filter(
    (t): t is (typeof trilhas)[number] => t !== undefined,
  )
  // Uma série fora de `ORDEM_DE_PINTURA` não pode desaparecer do desenho: o que
  // a ordem decide é a CAMADA, nunca a existência.
  const camadas = [...ordenadas, ...trilhas.filter((t) => !ordenadas.includes(t))]

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${LARGURA} ${ALTURA}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height: ALTURA }}
        /*
          `aria-hidden` + tabela `sr-only` abaixo, e não `role="img"` com
          `aria-label`: o rótulo anterior ("Alunos ativos e sessões realizadas
          por semana") não continha um único algarismo, então quem não enxerga
          ouvia o TÍTULO do gráfico e nada do conteúdo. Os `<title>` por semana
          continuam sendo o tooltip do mouse; o leitor de tela recebe a tabela.
        */
        aria-hidden="true"
        focusable="false"
      >
        {/* Grade horizontal + rótulos do eixo y: uma marca por tick (V-26). */}
        {eixo.ticks.map((t) => {
          const y = yDoValor(t, eixo.topo)
          return (
            <g key={t}>
              <line
                x1={EIXO_X}
                x2={FIM_X}
                y1={y}
                y2={y}
                stroke={t === 0 ? GRADE_ZERO : GRADE}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={EIXO_X - 7}
                y={y + 3}
                textAnchor="end"
                fontSize={FONTE_EIXO_Y}
                fill={TEXTO.mudo}
                className="tabular-nums"
              >
                {t}
              </text>
            </g>
          )
        })}

        {/*
          Alvo de ponteiro da fatia inteira, ATRÁS das linhas. `transparent` (e
          não `none`) recebe evento de mouse; o realce no hover é uma sombra de
          3,5% que não muda a cor de nenhuma série. O `<title>` é o primeiro
          filho do grupo, então o tooltip aparece com o ponteiro em qualquer
          lugar da fatia — não só em cima do marcador de 6 unidades.
        */}
        {pontos.map((p, i) => (
          <g key={p.inicioISO} className="group">
            <title>
              {`${p.rotulo} · ${legenda.map((e) => `${e.rotulo}: ${VALOR_DA_SERIE[e.id](p)}`).join(" · ")}`}
            </title>
            <rect
              x={inicioDaFatia(i, g)}
              y={TOPO}
              width={g.fatia}
              height={BASE - TOPO}
              fill="transparent"
              className="group-hover:[fill:rgba(0,0,0,0.035)]"
            />
          </g>
        ))}

        {/*
          AS LINHAS. `fill="none"` é o que mantém V-20 de pé: nenhuma área sob a
          curva, nenhum gradiente, nenhum `<defs>`. A tracejada vem depois da
          contínua e é por isso que a de baixo continua aparecendo nos vãos.
        */}
        {camadas.map((t) => (
          <path
            key={t.id}
            data-linha={t.id}
            d={t.pontos.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`).join(" ")}
            fill="none"
            stroke={t.cor}
            strokeWidth={ESPESSURA_DA_SERIE[t.id]}
            strokeDasharray={TRACEJADO_DA_SERIE[t.id] ?? undefined}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {/* OS MARCADORES: um por semana, por série. Formas distintas por série. */}
        {camadas.map((t) =>
          t.pontos.map((pt, i) =>
            t.id === "ativos" ? (
              <polygon
                key={`${t.id}-${pontos[i]?.inicioISO ?? i}`}
                data-serie={t.id}
                points={pontosDoLosango(pt.x, pt.y, RAIO_MARCA)}
                fill={t.cor}
              />
            ) : (
              <circle
                key={`${t.id}-${pontos[i]?.inicioISO ?? i}`}
                data-serie={t.id}
                cx={pt.x}
                cy={pt.y}
                r={RAIO_MARCA}
                fill={t.cor}
              />
            ),
          ),
        )}

        {/*
          O NÚMERO, quando cabe. Fica AO LADO do marcador (não acima nem abaixo)
          por dois motivos: acima, os dois números de uma semana coincidente se
          empilhariam no mesmo lugar; abaixo, o da série de valor 0 cairia em
          cima dos rótulos do eixo x.
        */}
        {mostrarValores
          ? camadas.map((t) =>
              t.pontos.map((pt, i) => (
                <text
                  key={`${t.id}-${pontos[i]?.inicioISO ?? i}`}
                  data-valor={t.id}
                  x={pt.x + (t.dx <= 0 ? -1 : 1) * (RAIO_MARCA + VAO_VALOR)}
                  y={pt.y + 2.9}
                  textAnchor={t.dx <= 0 ? "end" : "start"}
                  fontSize={FONTE_VALOR}
                  fill={t.cor}
                  className="tabular-nums"
                >
                  {pt.valor}
                </text>
              )),
            )
          : null}

        {/* Eixo x: marca em TODA semana, rótulo a cada `passo` semanas. */}
        {pontos.map((p, i) => (
          <line
            key={p.inicioISO}
            data-tick="x"
            x1={centroDaFatia(i, g)}
            x2={centroDaFatia(i, g)}
            y1={BASE}
            y2={BASE + (eixoX.textos[i] ? 4 : 2.5)}
            stroke={GRADE_ZERO}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {pontos.map((p, i) => {
          const texto = eixoX.textos[i] ?? ""
          return (
            <text
              key={p.inicioISO}
              data-eixo="x"
              x={xDoRotulo(centroDaFatia(i, g), larguraDoTexto(texto, FONTE_ROTULO_X))}
              y={BASE + 15}
              textAnchor="middle"
              fontSize={FONTE_ROTULO_X}
              fill={TEXTO.mudo}
            >
              {texto}
            </text>
          )
        })}
      </svg>

      {/*
        A alternativa textual. `sr-only` e não `hidden`: precisa continuar na
        árvore de acessibilidade. Os números aqui são os MESMOS que desenham as
        linhas — saem do mesmo `pontos` e da mesma `legenda`, então não há como a
        tabela e o desenho contarem histórias diferentes. E é aqui que o
        intervalo completo das semanas SEM rótulo no eixo continua alcançável.
      */}
      <table className="sr-only">
        <caption>Alunos ativos e sessões realizadas, semana a semana</caption>
        <thead>
          <tr>
            <th scope="col">Semana</th>
            {legenda.map((e) => (
              <th key={e.id} scope="col">
                {e.rotulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pontos.map((p) => (
            <tr key={p.inicioISO}>
              <th scope="row">{p.rotulo}</th>
              {legenda.map((e) => (
                <td key={e.id}>{VALOR_DA_SERIE[e.id](p)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Entrada da legenda: marca + rótulo. Duas, nesta ordem.
 *
 * A marca REPETE o vocabulário do desenho — um traço no estilo da série com o
 * marcador dela no meio. Um disco genérico ao lado de uma linha tracejada com
 * losangos é a mesma classe de defeito da legenda que promete uma série
 * invisível, em miniatura: a legenda tem que parecer com o que o gráfico faz.
 */
export function LegendaRitmo({ rotulo, id }: { rotulo: string; id: IdSerie }) {
  const cor = TINTA_DA_SERIE[id]
  const tracejado = TRACEJADO_DA_SERIE[id]
  return (
    <span className="inline-flex items-center gap-[6px]">
      <svg width="18" height="10" viewBox="0 0 18 10" aria-hidden="true" focusable="false">
        <line
          x1={0}
          x2={18}
          y1={5}
          y2={5}
          stroke={cor}
          strokeWidth={ESPESSURA_DA_SERIE[id]}
          strokeDasharray={tracejado ?? undefined}
          strokeLinecap="round"
        />
        {id === "ativos" ? (
          <polygon points={pontosDoLosango(9, 5, RAIO_MARCA)} fill={cor} />
        ) : (
          <circle cx={9} cy={5} r={RAIO_MARCA} fill={cor} />
        )}
      </svg>
      {rotulo}
    </span>
  )
}
