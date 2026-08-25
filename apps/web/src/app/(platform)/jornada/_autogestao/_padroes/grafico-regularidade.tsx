// ---------------------------------------------------------------------------
// O gráfico de linha de "Minha regularidade ao longo do tempo" — spec §16.
// ---------------------------------------------------------------------------
// SVG puro, sem biblioteca de gráfico: a série é curta (≤12 pontos, teto de
// `SERIE_SEMANAS_MAX`) e a unidade tem teto natural (dias distintos por semana
// nunca passam de 7, `diasDistintosUtc` de `bucketizarSemanas`) — não há
// motivo para o peso de uma lib inteira nesta escala.
//
// O TOPO DO EIXO ACOMPANHA A SÉRIE (mudou em 2026-08-23, medido)
// ---------------------------------------------------------------------------
// Este arquivo defendia um domínio FIXO 0–7 em nome da comparabilidade. Medido
// no artefato: com a série real (máximo 4 dias ativos), a grade parava em 6 e
// TERÇO da altura já curta ficava vazio; 8 dos 12 pontos caíam a menos de 16px
// da base, e a curva lia como uma faixa fina rente ao rodapé do cartão. Um
// gráfico ilegível não é mais honesto que um legível — é só ilegível.
//
// A correção mantém o que sustentava o argumento antigo e descarta o resto:
//   • o topo passa a ser `ceil(máximo da série)`, com piso 2 e teto 7 (o teto
//     real da unidade) — a curva usa a altura inteira do cartão;
//   • TODA linha de grade continua ROTULADA (ver `PAD_ESQ`), e agora a escala
//     é de passo 1 até 5. É o número, não a posição, que dá magnitude: com o
//     eixo rotulado, dois períodos continuam comparáveis pela leitura do
//     rótulo, que era exatamente o que o domínio fixo tentava garantir.
//
// SEM linha de meta: `serie.metaLinha` é `ComLastro`, e HOJE ela é SEMPRE
// `SemLastro` (CONTRATO-DE-DADOS.md 2.2 — não existe meta de frequência
// semanal em `study_plans`). Desenhar uma linha tracejada "Meta do plano"
// aqui seria inventar o denominador que a Regra de Lastro proíbe — por isso
// o componente aceita `metaLinha` só para decidir SE desenha, nunca para
// inventar um valor quando ele falta.
//
// A LINHA TRACEJADA QUE EXISTE É OUTRA COISA, e a distinção é o ponto
// ---------------------------------------------------------------------------
// `data-linha-media` é a média ARITMÉTICA DOS PONTOS QUE ESTE MESMO SVG
// DESENHA — nada é lido de outra tabela, nada é estimado, nada é assumido. Ela
// não é, e nunca deve ser lida como, a meta ausente: a meta continua declarada
// por extenso como "Falta prova" ao lado do título (`cartoes.tsx`), e
// `data-linha-meta` continua nascendo se e somente se `temLastro(metaLinha)`.
// Por isso a legenda nomeia o escopo da média ("das semanas exibidas") em vez
// de dizer só "média": é uma referência do próprio desenho, não um alvo.
// ---------------------------------------------------------------------------

import { TEXTO, VARIACAO } from "@/components/analytics/visao-geral/design"
import type {
  ComLastro,
  MetaRegularidade,
  PontoRegularidade,
} from "@/lib/analytics/autogestao/tipos"
import { temLastro } from "@/lib/analytics/autogestao/tipos"

const LARGURA = 920
/**
 * Altura do desenho EM UNIDADES DE VIEWBOX, não em pixels.
 *
 * Havia um defeito silencioso aqui: com `height` fixo em pixels e `viewBox`
 * de 920 de largura, o `preserveAspectRatio` padrão ("xMidYMid meet") escolhe
 * a MENOR das duas escalas. Num cartão de ~1310px, a escala vertical valia 1 e
 * travava a horizontal também em 1 — o desenho renderizava com 920px, CENTRADO,
 * com ~195px de vazio de cada lado, enquanto os rótulos do eixo X (HTML) usavam
 * a largura inteira. Resultado: o gráfico não ocupava a largura que aparentava
 * ocupar, e nenhum ponto pousava sobre o próprio rótulo.
 *
 * A correção é deixar o SVG governar a própria altura pela razão de aspecto
 * (largura 100%, sem `height` fixo). A altura RENDERIZADA passa a ser
 * `largura × ALTURA/LARGURA`. Em troca, tudo que é medida de traço (fonte,
 * espessura, raio) é declarado em unidade de viewBox e sobe ~1,42× ao
 * renderizar.
 *
 * 117, não 92 (2026-08-23). Medido no DOM a 1440×1080: o SVG renderiza com
 * 1304px de largura, escala 1,417 — a área de plotagem sai de 108px para 143px,
 * e o gráfico passa a ocupar ~56% do cartão (a referência do dono usa 58%). O
 * orçamento vertical veio de dentro da própria tela, não de fora: a pílula de
 * "Tendência atual" subiu para a linha do título (`cartoes.tsx`) e devolveu as
 * ~30px que esta altura consome, mantendo as 5 faixas dentro do quadro de 1080.
 */
const ALTURA = 117
/**
 * Calha da ESQUERDA reservada para a escala do eixo Y. Sem ela o gráfico tem
 * quatro linhas de grade MUDAS: a série comunica formato (subiu, caiu) e
 * NENHUMA magnitude — é impossível saber se um ponto vale 1 ou 4 dias ativos.
 * A grade sem número é decoração; com número é escala.
 */
const PAD_ESQ = 26
const PAD_DIR = 6
const PAD_TOPO = 8
const PAD_BASE = 8
/** Teto REAL da unidade: uma semana tem 7 dias, então 7 dias distintos é o máximo possível. */
const TETO_Y = 7
/**
 * Piso do topo do eixo. Sem ele, uma série toda em 0 (aluno parado) colapsaria
 * a escala num único valor e a linha de base viraria também o teto — o desenho
 * diria "cheio" onde não houve nada. Com piso 2, zero continua lendo como zero.
 */
const PISO_TOPO_Y = 2
/** Fração da largura ocupada pela calha — alinha os rótulos do eixo X (HTML) ao desenho (SVG). */
const CALHA_ESQ_PCT = `${((PAD_ESQ / LARGURA) * 100).toFixed(3)}%`
const CALHA_DIR_PCT = `${((PAD_DIR / LARGURA) * 100).toFixed(3)}%`

/**
 * O topo do eixo Y: o maior valor da própria série, arredondado para cima,
 * entre `PISO_TOPO_Y` e `TETO_Y`. Exportado porque é a decisão que muda a
 * leitura do gráfico inteiro — e o que se pode provar em teste separado.
 */
export function topoDaEscala(pontos: readonly { diasAtivos: number }[]): number {
  let maximo = 0
  for (const p of pontos) if (p.diasAtivos > maximo) maximo = p.diasAtivos
  return Math.min(TETO_Y, Math.max(PISO_TOPO_Y, Math.ceil(maximo)))
}

/**
 * As linhas de grade, do chão ao topo, TODAS rotuladas. Passo 1 até 5 (a faixa
 * em que o aluno real vive); acima disso, passo 2 quando o topo é par, para não
 * empilhar oito números numa altura de 143px. Em ambos os casos a última linha
 * cai EXATAMENTE no topo — uma grade que para antes do teto reabre o vazio que
 * esta mudança fechou.
 */
export function gradeDaEscala(topo: number): readonly number[] {
  const passo = topo <= 5 || topo % 2 === 1 ? 1 : 2
  const valores: number[] = []
  for (let v = 0; v <= topo; v += passo) valores.push(v)
  return valores
}

/**
 * A média aritmética dos pontos DESENHADOS — nada além deles. `null` quando não
 * há ponto algum, e nesse caso nenhuma linha nasce: a ausência não vira zero.
 */
export function mediaDaSerie(pontos: readonly { diasAtivos: number }[]): number | null {
  if (pontos.length === 0) return null
  return pontos.reduce((soma, p) => soma + p.diasAtivos, 0) / pontos.length
}

/** "1,1" · "2" — uma casa, sem `,0` supérfluo (mesma regra de `rotuloVezesPorSemana`). */
export function rotuloMediaSerie(media: number): string {
  const arred = Math.round(media * 10) / 10
  return Number.isInteger(arred) ? String(arred) : arred.toFixed(1).replace(".", ",")
}

export function GraficoRegularidade({
  pontos,
  metaLinha,
}: {
  pontos: readonly PontoRegularidade[]
  metaLinha: ComLastro<MetaRegularidade>
}) {
  const n = pontos.length
  /**
   * Cada ponto no CENTRO da sua faixa semanal, não nas pontas do desenho.
   * Duas razões, e a segunda é a que importa:
   *   • uma semana é um INTERVALO, não um instante — o valor pertence à faixa
   *     inteira, e o centro é o único ponto que não sugere um dia específico;
   *   • os rótulos do eixo X abaixo são N caixas de largura igual, cada uma
   *     centrada na sua faixa. Distribuir os pontos de ponta a ponta os
   *     deslocava meia faixa dos próprios rótulos: o último ponto pousava
   *     sobre o rótulo da penúltima semana, e o eixo mentia sobre QUANDO.
   */
  const faixa = n > 0 ? (LARGURA - PAD_ESQ - PAD_DIR) / n : 0
  const xDe = (i: number) => PAD_ESQ + (i + 0.5) * faixa
  const topo = topoDaEscala(pontos)
  const grade = gradeDaEscala(topo)
  const media = mediaDaSerie(pontos)
  const yDe = (v: number) => {
    const clamped = Math.max(0, Math.min(topo, v))
    return PAD_TOPO + (ALTURA - PAD_TOPO - PAD_BASE) * (1 - clamped / topo)
  }

  const caminho = pontos
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xDe(i).toFixed(1)} ${yDe(p.diasAtivos).toFixed(1)}`)
    .join(" ")

  return (
    <div>
      <svg
        viewBox={`0 0 ${LARGURA} ${ALTURA}`}
        className="block w-full"
        role="img"
        aria-label="Dias ativos por semana ao longo do tempo"
      >
        {/* Grade + ESCALA. O número é o que transforma a linha de grade em
            régua: sem ele o eixo Y não existe, só há traços mudos.
            Cuidado deliberado: toda <line> daqui para baixo é NOMEADA por um
            `data-*` próprio — a régua de `painel.test.tsx` não conta linhas, ela
            checa nome por nome, porque uma contagem não distingue a média
            (lastreada nos pontos) da meta (que não existe no banco). */}
        {grade.map((v) => (
          <line
            key={v}
            data-linha-grade
            x1={PAD_ESQ}
            x2={LARGURA - PAD_DIR}
            y1={yDe(v)}
            y2={yDe(v)}
            stroke="#EDE7E4"
            strokeWidth={0.7}
          />
        ))}
        {grade.map((v) => (
          <text
            key={`rotulo-${v}`}
            x={PAD_ESQ - 7}
            y={yDe(v)}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize={8.5}
            fill={TEXTO.mudo}
          >
            {v}
          </text>
        ))}

        {/* A linha de meta só existe quando há lastro — hoje nunca existe.
            `data-linha-meta` é o alvo do teste/mutação: a régua não é "existe
            uma <line> tracejada", é "esta linha nasce SE E SOMENTE SE
            `temLastro(metaLinha)` — nunca em zero, nunca sempre". */}
        {temLastro(metaLinha) ? (
          <line
            data-linha-meta
            x1={PAD_ESQ}
            x2={LARGURA - PAD_DIR}
            y1={yDe(metaLinha.vezesPorSemana)}
            y2={yDe(metaLinha.vezesPorSemana)}
            stroke={TEXTO.mudo}
            strokeWidth={1}
            /* PONTILHADA, não tracejada: desde 2026-08-23 existe uma segunda
               linha cinza no desenho (a média das semanas exibidas, tracejada).
               Duas linhas cinza com o MESMO padrão de traço seriam duas coisas
               diferentes com a mesma aparência — e a legenda repete estes dois
               padrões, ponto a ponto, para que a chave case com o traço. */
            strokeDasharray="1.5 3"
          />
        ) : null}

        {/* A média DOS PONTOS DESENHADOS. Não é a meta e não a substitui: a
            meta continua ausente e declarada como "Falta prova" ao lado do
            título. Esta linha é a referência que faltava para ler a curva —
            sem ela, "3 dias ativos" não diz se está acima ou abaixo do próprio
            normal do aluno. Nasce só com ponto de verdade (`media !== null`):
            série vazia não vira uma linha em zero. */}
        {media !== null ? (
          <line
            data-linha-media
            x1={PAD_ESQ}
            x2={LARGURA - PAD_DIR}
            y1={yDe(media)}
            y2={yDe(media)}
            stroke={TEXTO.mudo}
            strokeWidth={1}
            strokeDasharray="5 4"
          />
        ) : null}

        {n > 0 ? (
          <path
            data-linha-serie
            d={caminho}
            fill="none"
            stroke={VARIACAO.positivo}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {pontos.map((p, i) => (
          <circle
            key={p.indice}
            cx={xDe(i)}
            cy={yDe(p.diasAtivos)}
            r={2.6}
            fill={VARIACAO.positivo}
          />
        ))}
      </svg>

      <div
        className="mt-[6px] flex"
        style={{ color: TEXTO.mudo, paddingLeft: CALHA_ESQ_PCT, paddingRight: CALHA_DIR_PCT }}
      >
        {pontos.map((p) => (
          <span
            key={p.indice}
            /* 11px com a MESMA entrelinha de 14px: o eixo ganha legibilidade
               sem ganhar um pixel de altura — e altura aqui é orçamento
               fechado, o rodapé da tela termina a 8px da borda do quadro de
               1080. `truncate` continua sendo a rede: se um rótulo futuro não
               couber na faixa, ele corta em vez de colidir com o vizinho
               (P-04 reprova sobreposição, não reticências). */
            className="flex-1 truncate px-[2px] text-center text-[11px] leading-[14px]"
            title={`${p.rotulo}: ${p.diasAtivos} ${p.diasAtivos === 1 ? "dia ativo" : "dias ativos"}`}
          >
            {p.rotulo}
          </span>
        ))}
      </div>
    </div>
  )
}
