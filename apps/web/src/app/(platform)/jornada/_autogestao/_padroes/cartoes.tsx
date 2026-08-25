// ---------------------------------------------------------------------------
// Os cartões de "Meus Padrões e Tendências" — Autogestão da minha Jornada,
// Tela 2. ESPECIFICACAO.md §16-§19 (+ §27) · CONTRATO-DE-DADOS.md 2.1-2.8.
// ---------------------------------------------------------------------------
// APRESENTAÇÃO PURA: recebe os blocos já montados (`tipos.ts`) e desenha. NÃO
// resolve sessão, NÃO lê banco, NÃO calcula nada. É por isso que este arquivo
// existe separado de `painel.tsx`.
//
// POR QUE A SEPARAÇÃO (a razão é uma régua, não estética): `painel.tsx` é um
// Server Component que resolve a sessão via `../recorte.ts` e, sem sessão,
// redireciona para `/login`. O harness visual do Gauntlet
// (`/gauntlet-preview/autogestao-padroes`) não tem sessão — e, por não
// conseguir importar os cartões, tinha COPIADO a composição inteira dentro da
// própria página. O efeito prático: o crítico media a cópia, a cópia envelhecia
// sozinha, e uma correção no arquivo de produção não aparecia no PNG medido.
// Um verificador que olha para outro artefato não verifica nada.
//
// Com os cartões aqui, produção e harness renderizam O MESMO componente. Não é
// desduplicação por elegância: é a condição para a medição significar alguma
// coisa.
//
// Regra dura desta tela (spec §18, transversal): NUNCA afirmar causalidade —
// `fraseAssociacao()` em `textos.ts` é a única fonte de prosa associativa
// ("nas semanas em que", "observamos que"), então estes componentes só EXIBEM
// o texto que a montagem produziu, nunca concatenam uma frase nova.
//
// O que NÃO entra aqui (spec §20): ranking de turma, profundidade de
// aprendizagem, avaliação de competência, qualidade das reflexões,
// interpretação psicológica, comparação competitiva. Nenhum desses campos
// existe no contrato desta tela — não há como desenhá-los por engano.
// ---------------------------------------------------------------------------

import {
  Card as CardPrimitivo,
  CardTitulo,
  CirculoIcone,
  FUNDO_SINTESE,
  FaltaProva,
  PilulaEstado,
  TEXTO,
  TOM_ICONE,
  TOM_ICONE_SUAVE,
  VARIACAO,
} from "@/components/analytics/autogestao/design-autogestao"
import type { Tom } from "@/lib/analytics/autogestao"
import { temLastro } from "@/lib/analytics/autogestao/tipos"
import type {
  BlocoContinuidade,
  BlocoFavorece,
  BlocoSerieRegularidade,
  BlocoTendencia,
  EstadoTendencia,
} from "@/lib/analytics/autogestao/tipos"
import {
  CheckCircle2,
  Clock,
  MoveRight,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import type { ReactNode } from "react"
import { CorpoNaoRenderizavel, situacaoDo } from "../estado-bloco"
import { GraficoRegularidade, mediaDaSerie, rotuloMediaSerie } from "./grafico-regularidade"

/**
 * Cor da pílula de "Tendência atual" — mesma paleta semântica que a Visão
 * Geral já usa para o MESMO estado (`SINTESE_RETOMANDO` é `tom: "blue"`, não
 * verde). Duas cores para o mesmo rótulo em duas telas ensinaria o aluno a
 * desconfiar da própria pílula.
 */
const TOM_TENDENCIA: Record<EstadoTendencia, "green" | "amber" | "blue" | "neutral"> = {
  sustentando: "green",
  desacelerando: "amber",
  retomando: "blue",
  "sem-padrao-suficiente": "neutral",
}

// --- §16 Minha regularidade ao longo do tempo -----------------------------------

export function CardSerie({ serie }: { serie: BlocoSerieRegularidade }) {
  /**
   * A média que a legenda nomeia é A MESMA que o SVG desenha — literalmente a
   * mesma função (`mediaDaSerie`), sobre os mesmos pontos. Duas contas
   * separadas para o mesmo número é como uma legenda passa a mentir sobre a
   * própria linha sem ninguém perceber.
   */
  const media = mediaDaSerie(serie.pontos)
  return (
    <CardPrimitivo className="px-6 py-5">
      {/*
        A legenda vive na MESMA linha do título, encostada à direita — é a
        posição em que se lê a chave de cor antes de olhar a curva, e não
        depois. Só entram aqui as linhas efetivamente DESENHADAS; a ausência
        de meta (abaixo) não é legenda, é declaração.
      */}
      <div className="flex flex-wrap items-center justify-between gap-x-[18px] gap-y-[6px]">
        <div className="flex flex-wrap items-center gap-x-[16px] gap-y-[4px]">
          <CardTitulo>Minha regularidade ao longo do tempo</CardTitulo>
          {/*
            2.2 — SEM LASTRO: `study_plans` não guarda meta de frequência
            semanal. O gráfico NUNCA desenha uma linha tracejada inventada
            (ver `grafico-regularidade.tsx`) — a ausência é DECLARADA por
            extenso, com o motivo real, nunca por um traço mudo ou por uma
            linha em zero. Fica ao lado do TÍTULO, e não dentro da legenda:
            legenda é a chave do que está desenhado, e esta é justamente a
            linha que não existe.
          */}
          {situacaoDo(serie) === "ok" && !temLastro(serie.metaLinha) ? (
            <FaltaProva motivo={`meta do plano — ${serie.metaLinha.motivo}`} />
          ) : null}
        </div>
        {situacaoDo(serie) === "ok" ? (
          <div
            className="flex flex-wrap items-center gap-[18px] text-[11.5px]"
            style={{ color: TEXTO.secundario }}
          >
            <span className="flex items-center gap-[6px]">
              <span
                className="h-[3px] w-[16px] rounded-full"
                style={{ backgroundColor: "#2E9E6B" }}
              />
              Dias ativos por semana
            </span>
            {/*
              A SEGUNDA chave: traço tracejado cinza contra o traço cheio verde.
              O rótulo carrega o ESCOPO ("das semanas exibidas") de propósito —
              o cartão de continuidade mostra outra média, calculada sobre a
              janela do filtro de período e não sobre as semanas do gráfico. Um
              rótulo que dissesse só "média" apresentaria dois números
              diferentes como se fossem o mesmo, que é o modo mais barato de um
              painel perder a confiança de quem lê.
            */}
            {media !== null ? (
              <span className="flex items-center gap-[6px]">
                <span
                  className="h-0 w-[16px] border-t-[1.5px] border-dashed"
                  style={{ borderColor: TEXTO.mudo }}
                />
                {`Média das semanas exibidas: ${rotuloMediaSerie(media)}`}
              </span>
            ) : null}
            {temLastro(serie.metaLinha) ? (
              <span className="flex items-center gap-[6px]">
                <span
                  className="h-0 w-[16px] border-t-[1.5px] border-dotted"
                  style={{ borderColor: TEXTO.mudo }}
                />
                {`Meta do plano: ${serie.metaLinha.rotulo}`}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      {situacaoDo(serie) === "ok" ? (
        <div className="mt-[10px]">
          <GraficoRegularidade pontos={serie.pontos} metaLinha={serie.metaLinha} />
          {serie.insight ? (
            <p
              className="mt-[10px] text-[12.5px] leading-[18px]"
              style={{ color: TEXTO.secundario }}
            >
              {serie.insight}
            </p>
          ) : null}
        </div>
      ) : (
        <CorpoNaoRenderizavel bloco={serie} />
      )}
    </CardPrimitivo>
  )
}

// --- §17 Meu padrão de continuidade ----------------------------------------------

/**
 * §17 usa ÂMBAR nos quatro tiles — o âmbar já é, nas 3 telas, o tom do que se
 * observa sem julgar (a "Dica Exímia" da Visão Geral é a mesma faixa). Um tom
 * por tile pintaria quatro juízos onde não há nenhum: "12 dias sem estudar"
 * não é vermelho, e "2 retomadas" não é neutro — as quatro são a mesma família
 * de fato observado, e a única leitura honesta é a mesma cor nas quatro. Fundo
 * único é também o que deixa os quatro números comparáveis entre si.
 */
const FUNDO_TILE_CONTINUIDADE = FUNDO_SINTESE.amber

export function CardContinuidade({ continuidade }: { continuidade: BlocoContinuidade }) {
  return (
    <CardPrimitivo className="px-6 py-5">
      <CardTitulo>Meu padrão de continuidade</CardTitulo>
      {situacaoDo(continuidade) === "ok" && continuidade.conteudo ? (
        <div className="mt-[12px] grid grid-cols-2 gap-[12px] sm:grid-cols-4">
          <TileContinuidade
            titulo="Frequência média"
            {...partirValor(continuidade.conteudo.frequenciaRotulo)}
          />
          <TileContinuidade
            titulo="Maior intervalo sem estudar"
            numero={`${continuidade.conteudo.maiorIntervaloDias}`}
            unidade={continuidade.conteudo.maiorIntervaloDias === 1 ? "dia" : "dias"}
          />
          <TileContinuidade
            titulo="Sequência atual"
            numero={`${continuidade.conteudo.sequenciaAtualSemanas}`}
            unidade={
              continuidade.conteudo.sequenciaAtualSemanas === 1 ? "semana ativa" : "semanas ativo"
            }
          />
          <TileContinuidade
            titulo="Retomadas"
            numero={`${continuidade.conteudo.retomadas}`}
            unidade={continuidade.conteudo.retomadas === 1 ? "vez" : "vezes"}
          />
        </div>
      ) : (
        <CorpoNaoRenderizavel bloco={continuidade} />
      )}
    </CardPrimitivo>
  )
}

/**
 * Parte o rótulo JÁ FORMATADO pela montagem em número e unidade, sem
 * recalcular nada. `rotuloVezesPorSemana` produz sempre `"{n}x por semana"`
 * (montagem.ts) e `{n}` nunca contém espaço — o primeiro espaço é, por
 * construção, a fronteira entre valor e unidade. Se um dia deixar de ser, o
 * ramo de guarda devolve o rótulo inteiro como número e unidade vazia: degrada
 * para "valor sem unidade", nunca para valor errado. A camada visual PARTE o
 * texto da montagem, jamais o reescreve.
 */
function partirValor(rotulo: string): { numero: string; unidade: string } {
  const corte = rotulo.indexOf(" ")
  if (corte < 0) return { numero: rotulo, unidade: "" }
  return { numero: rotulo.slice(0, corte), unidade: rotulo.slice(corte + 1) }
}

/**
 * Os quatro indicadores do §17 na MESMA anatomia: rótulo acima, número no
 * centro, unidade abaixo. Quatro grandezas de naturezas diferentes
 * (vezes/semana, dias, semanas, ocorrências) se leem como uma linha só quando
 * o número ocupa sempre a mesma posição e o mesmo corpo tipográfico — o olho
 * compara altura de linha, não tamanho de fonte.
 *
 * Acessibilidade: o rótulo é lido normalmente, mas as duas caixas do VALOR são
 * decorativas para o leitor de tela (`aria-hidden`) e um `sr-only` devolve o
 * valor inteiro numa locução só ("12 dias") — quebrar o número da unidade é
 * decisão de layout e não deve virar duas falas soltas no ouvido de quem não
 * vê a caixa.
 */
function TileContinuidade({
  titulo,
  numero,
  unidade,
}: {
  titulo: string
  numero: string
  unidade: string
}) {
  return (
    <div
      className="flex flex-col items-center rounded-[10px] px-[12px] py-[12px] text-center"
      style={{ backgroundColor: FUNDO_TILE_CONTINUIDADE }}
    >
      <p className="text-[12px] leading-[16px]" style={{ color: TEXTO.terciario }}>
        {titulo}
      </p>
      <p
        aria-hidden="true"
        className="mt-[4px] text-[26px] leading-[30px] font-bold tracking-[-0.01em]"
        style={{ color: TEXTO.primario }}
      >
        {numero}
      </p>
      {unidade ? (
        <p
          aria-hidden="true"
          className="mt-[2px] text-[12px] leading-[16px]"
          style={{ color: TEXTO.terciario }}
        >
          {unidade}
        </p>
      ) : null}
      <span className="sr-only">{unidade ? `${numero} ${unidade}` : numero}</span>
    </div>
  )
}

// --- §18 O que favorece meu ritmo? -----------------------------------------------

/**
 * A NATUREZA de cada insight — o nome do padrão (os próprios títulos do §18),
 * o disco e o tom. O `id` vem da montagem e é estável
 * (`distribuicao-de-dias`, `pausas-prolongadas`); a natureza é a LEITURA
 * VISUAL desse id, não um dado novo: nenhum número, nenhuma afirmação e
 * nenhuma causalidade (§18) entram por aqui — só o nome que a própria
 * especificação já usa como título do padrão.
 *
 * Por que o disco muda de cor: dois insights de naturezas opostas (um hábito
 * que sustenta o ritmo, uma pausa que o interrompe) com o mesmo disco verde
 * ensinam que o disco não significa nada. Variando com a natureza, a lista se
 * lê antes de ser lida.
 */
const NATUREZA_FAVORECE: Record<string, { nome: string; tom: Tom; icone: ReactNode }> = {
  "distribuicao-de-dias": {
    nome: "Distribuição ao longo da semana",
    tom: "green",
    icone: <CheckCircle2 size={14} strokeWidth={2.2} />,
  },
  "pausas-prolongadas": {
    nome: "Pausas prolongadas",
    tom: "amber",
    icone: <Clock size={14} strokeWidth={2.2} />,
  },
  planejamento: {
    nome: "Planejamento",
    tom: "blue",
    icone: <Target size={14} strokeWidth={2.2} />,
  },
}

const NATUREZA_PADRAO: { nome: string; tom: Tom; icone: ReactNode } = {
  nome: "Padrão observado",
  tom: "blue",
  icone: <Target size={14} strokeWidth={2.2} />,
}

export function CardFavorece({ favorece }: { favorece: BlocoFavorece }) {
  return (
    <CardPrimitivo className="px-6 py-5">
      <CardTitulo>O que favorece meu ritmo?</CardTitulo>
      {situacaoDo(favorece) === "ok" ? (
        <ul className="mt-[12px] flex flex-col gap-[10px]">
          {favorece.itens.map((item) => {
            const natureza = NATUREZA_FAVORECE[item.id] ?? NATUREZA_PADRAO
            return (
              <li key={item.id} className="flex items-start gap-[10px]">
                {/*
                  Ø26 é o calibre que a casa já usa para disco de ITEM DE LISTA
                  (os discos de "Sinais fora do padrão" da Visão Geral, medidos
                  em `design.tsx`); Ø32 é de faixa de rodapé e Ø40 de nó de
                  trilha. A 22 o disco existia mas quase não se via a 100% —
                  e um ícone que só aparece no zoom não distingue natureza
                  nenhuma, que é a única razão de ele estar aqui.
                */}
                <CirculoIcone tom={natureza.tom} diametro={26} paleta={TOM_ICONE_SUAVE}>
                  {natureza.icone}
                </CirculoIcone>
                <div className="min-w-0">
                  <p className="text-[12.5px] leading-[18px]" style={{ color: TEXTO.primario }}>
                    {item.texto}
                  </p>
                  <p className="mt-[2px] text-[11px] leading-[15px]" style={{ color: TEXTO.mudo }}>
                    {natureza.nome}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <CorpoNaoRenderizavel bloco={favorece} />
      )}
    </CardPrimitivo>
  )
}

// --- §19 Tendência atual -----------------------------------------------------------

const ROTULO_TENDENCIA_PILL: Record<EstadoTendencia, string> = {
  sustentando: "Sustentando",
  desacelerando: "Desacelerando",
  retomando: "Retomando",
  "sem-padrao-suficiente": "Sem padrão suficiente",
}

/**
 * §31 "Pouco histórico", texto LITERAL da especificação — o mesmo que
 * `serie.textoVazio` usa para o mesmo motivo em §16 (montagem.ts,
 * `sem-historico-suficiente`). Citado aqui por extenso porque `BlocoTendencia`
 * não carrega um `textoVazio` próprio para este caso: o BLOCO continua `ok`
 * (a pílula "Sem padrão suficiente" já existe), só o CONTEÚDO da linha
 * temporal é insuficiente para desenhar sem inventar. Mesmo padrão de
 * `MENSAGEM_FINAL` abaixo — texto fixo citado da spec, nunca gerado aqui.
 */
const POUCO_HISTORICO_TENDENCIA =
  "Ainda precisamos de mais algumas semanas de atividade para identificar seus padrões."

/**
 * A frase ao lado da pílula só existe quando DIZ ALGO A MAIS que a pílula.
 *
 * `montagem.ts` produz, para alguns estados, exatamente `"{Rótulo}."` — e o
 * resultado na tela era "«Retomando» Retomando.", a mesma palavra duas vezes,
 * uma dentro da pílula e outra ao lado. Não é informação repetida por ênfase:
 * é um eco que se lê como defeito, e ensina o aluno que a linha ao lado da
 * pílula não carrega conteúdo.
 *
 * A regra é de APRESENTAÇÃO, não de dado: nada é reescrito, nada é inventado
 * para preencher o vazio (seria exatamente a prosa sem lastro que esta tela
 * proíbe). Quando a montagem tiver uma frase real — como
 * "Você retomou o ritmo nas últimas duas semanas." — ela aparece intacta.
 */
function ehEcoDaPilula(texto: string, rotulo: string): boolean {
  const normalizar = (s: string) => s.trim().replace(/\.$/, "").toLocaleLowerCase("pt-BR")
  return normalizar(texto) === normalizar(rotulo)
}

export function CardTendencia({ tendencia }: { tendencia: BlocoTendencia }) {
  const rotuloPilula = tendencia.conteudo ? ROTULO_TENDENCIA_PILL[tendencia.conteudo.estado] : null
  const textoDeApoio =
    tendencia.conteudo && rotuloPilula && !ehEcoDaPilula(tendencia.conteudo.texto, rotuloPilula)
      ? tendencia.conteudo.texto
      : null

  const conteudo = situacaoDo(tendencia) === "ok" ? tendencia.conteudo : null
  return (
    <CardPrimitivo className="px-6 py-5">
      {/*
        Título, pílula, frase e seta na MESMA linha (era: título em cima,
        pílula numa faixa própria abaixo). Duas razões, e as duas são medidas:
          • o estado é o assunto do bloco, não uma nota de rodapé dele — lido
            junto do título, "Tendência atual: Retomando" é uma frase só;
          • a faixa própria custava ~30px de altura para dizer uma palavra, e
            essas 30px foram exatamente o orçamento que o gráfico do §16 passou
            a usar para sair de faixa fina (ver `grafico-regularidade.tsx`).
      */}
      <div className="flex flex-wrap items-center gap-x-[12px] gap-y-[6px]">
        <CardTitulo>Tendência atual</CardTitulo>
        {conteudo && rotuloPilula ? (
          <PilulaEstado rotulo={rotuloPilula} tom={TOM_TENDENCIA[conteudo.estado]} />
        ) : null}
        {conteudo && textoDeApoio ? (
          <p className="text-[12.5px] leading-[18px]" style={{ color: TEXTO.secundario }}>
            {textoDeApoio}
          </p>
        ) : null}
        {conteudo ? (
          <SetaTendencia estado={conteudo.estado} tom={TOM_TENDENCIA[conteudo.estado]} />
        ) : null}
      </div>
      {conteudo && rotuloPilula ? (
        conteudo.linhaTemporal.length > 0 ? (
          <LinhaTemporal
            pontos={conteudo.linhaTemporal}
            tom={TOM_TENDENCIA[conteudo.estado]}
            estado={conteudo.estado}
          />
        ) : null
      ) : (
        <CorpoNaoRenderizavel bloco={tendencia} />
      )}
    </CardPrimitivo>
  )
}

/**
 * A seta de tendência à direita do bloco — o mesmo desenho que a referência do
 * dono traz naquele canto: uma polilinha com ponta.
 *
 * O DADO É O `estado`, e nada além dele. A seta não estima direção a partir de
 * número nenhum, não interpola, não olha a série: ela é a tradução gráfica de
 * um campo que a montagem já publica e que a pílula ao lado já nomeia por
 * extenso. Redundância deliberada (forma + palavra), nunca informação nova.
 *
 * `sem-padrao-suficiente` NÃO desenha seta: uma seta neutra ali afirmaria
 * "estável" onde o que existe é "ainda não sabemos" — e essas duas coisas não
 * podem ter o mesmo desenho.
 */
function SetaTendencia({ estado, tom }: { estado: EstadoTendencia; tom: Tom }) {
  const desenho: Partial<Record<EstadoTendencia, { icone: ReactNode; rotulo: string }>> = {
    retomando: {
      icone: <TrendingUp size={34} strokeWidth={2.1} />,
      rotulo: "Tendência em retomada",
    },
    sustentando: {
      icone: <MoveRight size={34} strokeWidth={2.1} />,
      rotulo: "Tendência sustentada",
    },
    desacelerando: {
      icone: <TrendingDown size={34} strokeWidth={2.1} />,
      rotulo: "Tendência em queda",
    },
  }
  const escolhido = desenho[estado]
  if (!escolhido) return null
  return (
    <span
      className="ml-auto flex shrink-0 items-center"
      style={{ color: TOM_ICONE[tom].ink }}
      role="img"
      aria-label={escolhido.rotulo}
      title={escolhido.rotulo}
    >
      {escolhido.icone}
    </span>
  )
}

/**
 * O rótulo vem pronto da montagem no formato `"{período}: {valor}"`. A quebra
 * em duas linhas é tipográfica: esta função só SEPARA, e se o formato mudar
 * devolve a string inteira como período — degrada para "sem segunda linha",
 * nunca para um valor inventado.
 */
function partirRotuloTemporal(rotulo: string): { periodo: string; valor: string | null } {
  const corte = rotulo.indexOf(": ")
  if (corte < 0) return { periodo: rotulo, valor: null }
  return { periodo: rotulo.slice(0, corte), valor: rotulo.slice(corte + 2) }
}

/**
 * O número de dias ativos embutido no VALOR já formatado ("0 dias ativos" /
 * "1 dia ativo" / "4 dias ativos") — um passo além de `partirRotuloTemporal`,
 * lendo o inteiro que a montagem já publicou, sem recalcular nada. `null`
 * quando o formato não bate: um ponto sem número vira um ponto AUSENTE do
 * desenho, nunca um valor inventado.
 */
function diasAtivosDoRotulo(rotulo: string): number | null {
  const { valor } = partirRotuloTemporal(rotulo)
  if (!valor) return null
  const casado = /^(\d+)/.exec(valor)
  return casado ? Number(casado[1]) : null
}

const LARGURA_TEMPORAL = 920
/**
 * 20 de topo e 20 de base — folga vertical para a anotação de um marco
 * (acima OU abaixo do ponto) não cortar no rodapé/topo do SVG. Mesma lógica
 * de folga de `PAD_ESQ` em `grafico-regularidade.tsx`, só que aqui é vertical
 * em vez de horizontal.
 */
const ALTURA_TEMPORAL = 46
const PAD_ESQ_TEMPORAL = 10
const PAD_DIR_TEMPORAL = 10
const PAD_TOPO_TEMPORAL = 15
const PAD_BASE_TEMPORAL = 15
/** Teto real da unidade: uma semana tem no máximo 7 dias ativos. */
const TETO_TEMPORAL = 7
const PISO_TOPO_TEMPORAL = 2
/** Deslocamento vertical do texto do marco em relação ao próprio ponto. */
const DESLOC_ANOTACAO = 10
/** Meia-largura reservada ao texto do marco, para o `x` não estourar a borda do SVG. */
const MEIA_LARGURA_ANOTACAO = 46

/**
 * §19 — "uma pequena linha temporal". A especificação exemplifica em
 * SEGMENTOS já classificados ("2 semanas em queda", "2 semanas retomando"),
 * mas isso pede um ESTADO POR SEMANA que a camada de dados não publica:
 * `classificarTendencia` (montagem.ts) calcula um único `estado` para a
 * janela inteira, não uma sequência de estados por ponto. Sem esse dado,
 * desenhar segmentos classificados seria inventar categoria na camada
 * visual — a mesma Regra de Lastro que proíbe um número proíbe um rótulo de
 * estado. Isto é uma LACUNA REAL da camada de dados, registrada para quem
 * evoluir `montagem.ts`, não contornada aqui.
 *
 * O que a montagem JÁ publica, ponto a ponto, é `diasAtivos` — a MESMA leitura
 * que as 12 caixinhas anteriores exibiam, uma por semana (e que deixava o
 * bloco ilegível: 9 das 12 diziam "0 dias ativos", disputando a largura do
 * cartão com quase nenhuma informação). Esta versão desenha essa MESMA série
 * como uma linha contínua e marca só as VIRADAS DE ATIVIDADE — fato lido
 * diretamente do dado já exposto (0 → >0 é "retomou aqui", >0 → 0 é "parou
 * aqui"), nunca uma tendência nova computada aqui. Semanas zeradas que não
 * são virada ficam no traçado, sem rótulo próprio — é exatamente o ruído que
 * motivou a troca.
 */
function LinhaTemporal({
  pontos,
  tom,
  estado,
}: {
  pontos: readonly { rotulo: string }[]
  tom: Tom
  estado: EstadoTendencia
}) {
  const serieValida = pontos
    .map((p) => ({ dias: diasAtivosDoRotulo(p.rotulo) }))
    .filter((d): d is { dias: number } => d.dias !== null)

  // §31 "Pouco histórico": sem pontos suficientes não há como traçar uma
  // linha sem sugerir estabilidade que não foi observada — a mesma regra que
  // o gráfico do §16 já aplica (`§31 pouco histórico` em `painel.test.tsx`).
  if (estado === "sem-padrao-suficiente" || serieValida.length < 2) {
    return (
      <p
        className="mt-[12px] max-w-[440px] text-[12px] leading-[17px]"
        style={{ color: TEXTO.mudo }}
      >
        {POUCO_HISTORICO_TENDENCIA}
      </p>
    )
  }

  const n = serieValida.length
  const faixa = (LARGURA_TEMPORAL - PAD_ESQ_TEMPORAL - PAD_DIR_TEMPORAL) / (n - 1)
  const xDe = (i: number) => PAD_ESQ_TEMPORAL + i * faixa
  const xRotuloDe = (i: number) =>
    Math.min(
      LARGURA_TEMPORAL - PAD_DIR_TEMPORAL - MEIA_LARGURA_ANOTACAO,
      Math.max(PAD_ESQ_TEMPORAL + MEIA_LARGURA_ANOTACAO, xDe(i)),
    )
  const topo = Math.min(
    TETO_TEMPORAL,
    Math.max(PISO_TOPO_TEMPORAL, Math.ceil(Math.max(...serieValida.map((d) => d.dias)))),
  )
  const yDe = (v: number) => {
    const clamped = Math.max(0, Math.min(topo, v))
    return (
      PAD_TOPO_TEMPORAL +
      (ALTURA_TEMPORAL - PAD_TOPO_TEMPORAL - PAD_BASE_TEMPORAL) * (1 - clamped / topo)
    )
  }

  const caminho = serieValida
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xDe(i).toFixed(1)} ${yDe(d.dias).toFixed(1)}`)
    .join(" ")

  /**
   * As viradas: só entra quem MUDOU de zero para positivo ou de positivo
   * para zero em relação ao ponto ANTERIOR desta mesma série. O primeiro
   * ponto nunca vira marco — não há um "antes" dentro do dado exposto para
   * comparar, e supor um seria inventar histórico anterior à janela visível.
   */
  const marcos: { indice: number; tipo: "parou" | "retomou" }[] = []
  for (let i = 1; i < n; i++) {
    const anterior = serieValida[i - 1]!.dias
    const atual = serieValida[i]!.dias
    if (anterior === 0 && atual > 0) marcos.push({ indice: i, tipo: "retomou" })
    else if (anterior > 0 && atual === 0) marcos.push({ indice: i, tipo: "parou" })
  }

  return (
    <div className="mt-[12px]">
      <svg
        viewBox={`0 0 ${LARGURA_TEMPORAL} ${ALTURA_TEMPORAL}`}
        className="block w-full"
        role="img"
        aria-label={`Linha do tempo de atividade da tendência atual, com ${marcos.length} ${
          marcos.length === 1 ? "marco de mudança" : "marcos de mudança"
        }`}
      >
        <path
          data-linha-temporal
          d={caminho}
          fill="none"
          stroke={TOM_ICONE[tom].ink}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {marcos.map((marco, i) => {
          const dias = serieValida[marco.indice]!.dias
          const cor = marco.tipo === "retomou" ? VARIACAO.positivo : TEXTO.mudo
          const acima = i % 2 === 0
          const y = yDe(dias)
          const yTexto = acima ? y - DESLOC_ANOTACAO : y + DESLOC_ANOTACAO + 3
          return (
            <g key={`${marco.indice}-${marco.tipo}`}>
              <circle data-marco={marco.tipo} cx={xDe(marco.indice)} cy={y} r={3.2} fill={cor} />
              <text
                x={xRotuloDe(marco.indice)}
                y={yTexto}
                textAnchor="middle"
                fontSize={8}
                fontWeight={600}
                fill={cor}
              >
                {marco.tipo === "retomou" ? "retomou aqui" : "parou aqui"}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// --- §27 Mensagem final ------------------------------------------------------------

/**
 * §27 permite uma mensagem final discreta no rodapé, e as outras duas telas da
 * Autogestão já a trazem (âmbar na Visão Geral, lilás no Mapa). Aqui a faixa é
 * AZUL — o mesmo azul que `FUNDO_SINTESE.blue` usa em toda a Autogestão para o
 * registro neutro/informativo, e o mesmo tom da pílula de "Retomando".
 *
 * O texto é o literal GENÉRICO da própria especificação (§27, primeiro
 * exemplo). Nenhum campo do contrato desta tela (CONTRATO-DE-DADOS.md 2.1–2.8)
 * alimenta uma mensagem personalizada — então ela não é personalizada. Uma
 * frase de rodapé que fingisse ler o esforço do aluno seria exatamente o dado
 * inventado que a Regra de Lastro proíbe.
 */
const MENSAGEM_FINAL = "Pequenos passos consistentes constroem jornadas sustentáveis."

export function RodapeMensagem() {
  return (
    <div
      className="flex items-center gap-[12px] rounded-[12px] px-[18px] py-[12px]"
      style={{ backgroundColor: FUNDO_SINTESE.blue }}
    >
      <CirculoIcone tom="blue" diametro={32}>
        <Sparkles size={16} strokeWidth={2} />
      </CirculoIcone>
      <p className="text-[12.5px] leading-[18px]" style={{ color: TEXTO.secundario }}>
        <span className="font-semibold" style={{ color: TEXTO.primario }}>
          Para você.{" "}
        </span>
        {MENSAGEM_FINAL}
      </p>
    </div>
  )
}
