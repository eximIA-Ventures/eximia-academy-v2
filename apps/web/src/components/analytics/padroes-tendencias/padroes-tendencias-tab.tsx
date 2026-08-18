// ---------------------------------------------------------------------------
// A aba "Padrões e tendências" (Analytics do gestor), acabada.
// ---------------------------------------------------------------------------
// TODO NÚMERO DESTA TELA VEM DO MOTOR. Não há literal numérico em nenhum lugar
// deste arquivo: nem contagem, nem percentual, nem comprimento de barra
// proporcional a um valor. O que existe aqui é geometria (quanto mede a coluna,
// quanto mede a fileira) e vocabulário visual — e mesmo o vocabulário vem por
// import de `../visao-geral/design.tsx`, que é a língua da casa e não se edita
// a partir daqui.
//
// ORÇAMENTO VERTICAL, e por que ele é explícito em vez de emergente:
// a moldura real da Academy deixa 821px de altura útil, dos quais o cabeçalho
// da página e a barra de abas — compartilhados com as outras duas abas e fora
// do escopo desta — consomem 124. Sobram 697px para os oito blocos. As alturas
// abaixo somam 692, com 5px de folga:
//
//   faixa explicativa   64      (régua: 56–80)
//   vão                 12      (régua: 8–16)
//   fileira 1          318      (régua: 288–350)
//   vão                 12
//   fileira 2          234      (régua: 216–268)
//   vão                 12
//   faixa de foco       40      (régua: 36–52)
//   ────────────────────────
//   total              692  ≤ 697
//
// As alturas de fileira são FIXAS de propósito. Com altura emergente, o card
// mais cheio de cada fileira decide a altura dos três, e uma frase a mais no
// estado vazio de um bloco empurraria a aba inteira para fora da dobra sem que
// nada visível avisasse — a barra de rolagem deste navegador é OVERLAY, e a
// foto de uma tela cortada é indistinguível da foto de uma tela inteira. Travar
// a altura transforma esse modo de falha silencioso num corte visível DENTRO de
// um card, que se enxerga.
//
// AS LARGURAS, ao contrário, são PROPORÇÃO da coluna e nunca px: o mockup foi
// composto sobre 1386px de área útil e a moldura real dá 1277px. Uma grade em px
// sobreviveria ao mockup e morreria na Academy.
// ---------------------------------------------------------------------------

import type {
  BlocoGargalos,
  BlocoMudancas,
  BlocoParticipacao,
  BlocoRisco,
  BlocoSerie,
  BlocoSinais,
  ComEstado,
  ItemMudanca,
  PadroesTendenciasDados,
  Tom,
} from "@/lib/analytics/padroes-tendencias"
import type { ReactNode } from "react"
import {
  COR_PAGINA,
  Card,
  CardTitulo,
  CirculoIcone,
  LinkRodape,
  TEXTO,
  TOM_ICONE,
  TOM_ICONE_SUAVE,
  VARIACAO,
} from "../visao-geral/design"
import { CorpoNaoRenderizavel, situacaoDo } from "../visao-geral/estado-bloco"
import {
  BORDA_TOM,
  BotaoContorno,
  FUNDO_QUENTE,
  FUNDO_TILE,
  Glifo,
  Pilula,
  TINTA_FAIXA,
  Tile,
} from "./design-padroes"
import { GraficoRitmo, LegendaRitmo } from "./grafico-ritmo"

// ===========================================================================
// Geometria
// ===========================================================================

/** 28,8 / 36,6 / 32,6% da coluna — medido no PNG. O do meio é o mais largo. */
const COLUNAS = "28.8fr 36.6fr 32.6fr"
const VAO = 12
const ALTURA_FAIXA = 64
const ALTURA_FILEIRA_1 = 316
const ALTURA_FILEIRA_2 = 232
const ALTURA_FOCO = 40

/**
 * Reserva da faixa do link de rodapé, que é posicionado absoluto.
 *
 * 42 → 36 (2026-08-18). O link mora em `bottom-[15px]` com `h-[16px]`, ou seja
 * ocupa de 15 a 31px a contar da base do card: 42 reservava 11px que ninguém
 * usava. Os 6px devolvidos são o que paga a segunda linha dos rótulos das
 * células de `Participação` e de `Risco`, que antes eram truncados.
 */
const RESERVA_RODAPE = 36

function Fileira({ altura, children }: { altura: number; children: ReactNode }) {
  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: COLUNAS, columnGap: VAO, marginTop: VAO, height: altura }}
    >
      {children}
    </div>
  )
}

/**
 * A moldura comum dos 6 cards.
 *
 * `h-full` numa fileira de altura travada é o que garante V-05: os três cards de
 * uma fileira têm topo e base coincidentes, e a folga sobra DENTRO do card menos
 * preenchido — nenhum encolhe por ter menos conteúdo.
 */
function CardDeBloco({
  titulo,
  subtitulo,
  acaoRotulo,
  bloco,
  aoLado,
  children,
}: {
  titulo: string
  subtitulo: string
  acaoRotulo: string
  bloco: { estado: "ok" | "vazio" | "erro"; erro: unknown; textoVazio: string | null }
  /** Controle do canto superior direito (o seletor de periodicidade da §17). */
  aoLado?: ReactNode
  children: ReactNode
}) {
  const ok = situacaoDo(bloco as never) === "ok"
  return (
    <Card className="relative flex h-full flex-col px-[18px] pt-[15px]">
      <div className="flex items-start justify-between gap-[10px]">
        <div className="min-w-0">
          <CardTitulo>{titulo}</CardTitulo>
          <p
            className="mt-[1px] text-[11px] leading-[15px]"
            style={{ color: TEXTO.terciario, letterSpacing: "-0.004em" }}
          >
            {subtitulo}
          </p>
        </div>
        {aoLado}
      </div>

      {/*
        `justify-center` (2026-08-18) — O VAZIO PASSA A SER ATIVO.
        As alturas de fileira foram calibradas contra a fixture DENSA. Com o dado
        real do tenant (1 mudança em vez de 4, 1 gargalo em vez de 4, nenhum
        sinal), o conteúdo ficava colado no subtítulo e sobrava um buraco mudo no
        rodapé: medido a 1512, 191px de 316 em "Sinais emergentes", 170 em
        "Principais mudanças" e 107 em "Onde o ritmo caiu mais".
        Encolher o card não é opção — os três de uma fileira têm que fechar topo
        e base juntos (V-05), e quem dita a altura é o card mais cheio, que já
        está no limite (9px de folga em "Evolução do ritmo"). O que resta, e é o
        certo, é distribuir a folga em vez de empilhá-la embaixo: o miolo centra
        o conteúdo, a sobra vira respiro simétrico e o estado vazio fica no meio
        do card, não pendurado no topo.
        Quando o card está cheio (a fixture inteira) a folga é ~2px e isto não
        move um pixel.
      */}
      <div
        className="flex min-h-0 flex-1 flex-col justify-center"
        style={{ paddingBottom: RESERVA_RODAPE }}
      >
        <CorpoNaoRenderizavel bloco={bloco as never} />
        {ok ? children : null}
      </div>

      {/*
        Bloco em `vazio` ou `erro` NÃO renderiza o link: mandar o gestor "ver
        detalhes" de um dado que não existe é promessa quebrada (F-44 item 6).
      */}
      {ok ? (
        <div className="absolute right-0 bottom-[15px] left-0 h-[16px]">
          <LinkRodape rotulo={acaoRotulo} />
        </div>
      ) : null}
    </Card>
  )
}

// ===========================================================================
// §16 — Principais mudanças no período
// ===========================================================================

/**
 * O disco de cada mudança.
 *
 * `modulos` é ÂMBAR e não vermelho de propósito: a régua reserva o vermelho a
 * risco relevante e pede para evitar excesso (§31). Um bloco com dois discos
 * vermelhos entre quatro deixa de ter hierarquia — tudo urgente é nada urgente.
 * O valor numérico ao lado continua vermelho, porque lá o vermelho carrega o
 * SENTIDO da variação, não a temperatura do alerta.
 */
function tomDaMudanca(item: ItemMudanca): Tom {
  if (item.tom === "positivo") return "green"
  return item.id === "modulos" ? "amber" : "red"
}

const ICONE_DA_MUDANCA: Record<string, string> = {
  ativos: "trending-up",
  regularidade: "trending-down",
  modulos: "chart-column",
  retomadas: "rotate-ccw",
}

function BlocoDeMudancas({ bloco }: { bloco: ComEstado<BlocoMudancas> }) {
  return (
    <CardDeBloco
      titulo={bloco.titulo}
      subtitulo={bloco.subtitulo}
      acaoRotulo={bloco.acao.rotulo}
      bloco={bloco}
    >
      <div className="mt-[10px] flex flex-col gap-[13px]">
        {bloco.itens.map((item) => (
          <div key={item.id} className="flex items-center gap-[9px]">
            <CirculoIcone tom={tomDaMudanca(item)} diametro={40} paleta={TOM_ICONE_SUAVE}>
              <Glifo nome={ICONE_DA_MUDANCA[item.id] ?? "chart-column"} tamanho={19} />
            </CirculoIcone>
            <span className="min-w-0 flex-1">
              <span
                className="block text-[11px] leading-[15px] font-semibold"
                style={{ color: TEXTO.primario, letterSpacing: "-0.006em" }}
              >
                {item.titulo}
              </span>
              <span
                className="block text-[9.8px] leading-[13px]"
                style={{ color: TEXTO.mudo, letterSpacing: "-0.002em" }}
              >
                {item.subtexto}
              </span>
            </span>
            {/*
              Largura fixa + `text-right`: é o que dá aos quatro valores a MESMA
              borda direita (V-38). Sem a coluna travada, cada valor termina onde
              o texto dele acaba e a coluna de números vira uma escada.
              Nenhum deles dentro de pílula, badge ou retângulo de fundo.

              44px, e não 58: o valor mais largo desta tela é `−6 p.p.` com 41,1px
              de tinta medidos no navegador, então 58 reservava 17px que a coluna
              de texto precisava. Com 44 (3px de folga sobre o pior caso) o
              subtexto ganha 14px e as duas frases que a referência mostra em UMA
              linha — `Menos alunos estudando 2x ou mais por semana` (226px) e
              `Crescimento consistente nas últimas 3 semanas` (222px) — deixam de
              quebrar com uma palavra órfã. `whitespace-nowrap` é o cinto de
              segurança: se um valor futuro passar de 44, ele transborda para a
              esquerda em vez de quebrar em duas linhas e desalinhar a coluna.
            */}
            <span
              className="w-[44px] shrink-0 text-right text-[12.5px] leading-[16px] font-bold whitespace-nowrap tabular-nums"
              style={{ color: VARIACAO[item.tom], letterSpacing: "-0.01em" }}
            >
              {item.valorTexto}
            </span>
          </div>
        ))}
      </div>
    </CardDeBloco>
  )
}

// ===========================================================================
// §17 — Evolução do ritmo
// ===========================================================================

/**
 * O seletor de periodicidade.
 *
 * Renderizado como ESTADO, não como menu: o MVP tem uma periodicidade só
 * (F-15), e um controle que abre e não oferece nada é defeito de contrato, não
 * de estilo. O chevron fica de fora pelo mesmo motivo — ele promete uma lista.
 */
function SeletorPeriodicidade({ opcoes, atual }: { opcoes: readonly string[]; atual: string }) {
  const rotulo = atual.charAt(0).toUpperCase() + atual.slice(1)
  return (
    <span
      className="inline-flex h-[26px] shrink-0 items-center rounded-full border px-[11px] text-[10.5px] leading-[14px] font-semibold whitespace-nowrap"
      style={{ borderColor: BORDA_TOM.neutral, color: TEXTO.secundario }}
    >
      {rotulo}
      {opcoes.length > 1 ? ` (${opcoes.length})` : null}
    </span>
  )
}

function BlocoDeSerie({ bloco }: { bloco: ComEstado<BlocoSerie> }) {
  return (
    <CardDeBloco
      titulo={bloco.titulo}
      subtitulo={bloco.subtitulo}
      acaoRotulo={bloco.acao.rotulo}
      bloco={bloco}
      aoLado={<SeletorPeriodicidade opcoes={bloco.opcoes} atual={bloco.periodicidade} />}
    >
      <div
        className="mt-[6px] flex items-center gap-[18px] text-[10.5px] leading-[14px]"
        style={{ color: TEXTO.secundario, letterSpacing: "-0.004em" }}
      >
        {bloco.legenda.map((e) => (
          <LegendaRitmo key={e.id} id={e.id} rotulo={e.rotulo} />
        ))}
      </div>

      {/*
        `eixoY` é `null` exatamente quando não há série: eixo sem curva é o
        gráfico vazio que a §32 proíbe — parece dado e é ausência.
      */}
      {bloco.eixoY ? (
        <div className="mt-[2px]">
          <GraficoRitmo pontos={bloco.pontos} eixo={bloco.eixoY} />
        </div>
      ) : null}
    </CardDeBloco>
  )
}

// ===========================================================================
// §18 — Sinais emergentes
// ===========================================================================

function BlocoDeSinais({ bloco }: { bloco: ComEstado<BlocoSinais> }) {
  return (
    <CardDeBloco
      titulo={bloco.titulo}
      subtitulo={bloco.subtitulo}
      acaoRotulo={bloco.acao.rotulo}
      bloco={bloco}
    >
      {/*
        Ø 42 e vão 8, e o par é deliberado: V-18 aceita 34 a 50, mas a referência
        desenha 40 a 49 e o disco de 38 lia pequeno ao lado do selo. Os 4px que o
        disco ganha saem dos dois vãos (10 → 8), não da coluna de texto: com 220px
        de folga e `Desaceleração recorrente em um módulo` pedindo 217px de tinta,
        um único pixel a menos quebraria o título em duas linhas — que é
        exatamente o que a referência NÃO faz.
      */}
      <div className="mt-[10px] flex flex-col gap-[14px]">
        {bloco.itens.map((item) => (
          <div key={item.id} className="flex items-center gap-[8px]">
            <CirculoIcone tom={item.badgeTom} diametro={42} paleta={TOM_ICONE_SUAVE}>
              <Glifo nome={item.icone} tamanho={20} />
            </CirculoIcone>
            <span className="min-w-0 flex-1">
              <span
                className="block text-[11px] leading-[15px] font-semibold"
                style={{ color: TEXTO.primario, letterSpacing: "-0.006em" }}
              >
                {item.titulo}
              </span>
              <span
                className="block text-[9.8px] leading-[13px]"
                style={{ color: TEXTO.mudo, letterSpacing: "-0.002em" }}
              >
                {item.descricao}
              </span>
            </span>
            <Pilula rotulo={item.badgeRotulo} tom={item.badgeTom} />
          </div>
        ))}
      </div>
      {/*
        Silêncio EXPLICADO: "nenhum sinal" pode ser time saudável OU dois terços
        do recorte sem histórico comparável, e são mensagens diferentes.
      */}
      {bloco.textoComplementar ? (
        <p className="mt-[8px] text-[9.8px] leading-[13px]" style={{ color: TEXTO.mudo }}>
          {bloco.textoComplementar}
        </p>
      ) : null}
    </CardDeBloco>
  )
}

// ===========================================================================
// §19 — Onde o ritmo caiu mais (MÓDULOS, nunca pessoas)
// ===========================================================================

/** Pista da barra, em px. O comprimento sai de `fracaoBarra`, nunca daqui. */
const PISTA_BARRA = 78

function BlocoDeGargalos({ bloco }: { bloco: ComEstado<BlocoGargalos> }) {
  return (
    <CardDeBloco
      titulo={bloco.titulo}
      subtitulo={bloco.subtitulo}
      acaoRotulo={bloco.acao.rotulo}
      bloco={bloco}
    >
      <div className="mt-[14px] flex flex-col gap-[19px]">
        {bloco.itens.map((item) => (
          <div key={item.id} className="flex items-center gap-[8px]">
            {/*
              A numeração ordena MÓDULOS. Nenhum item deste bloco carrega pessoa,
              e o tipo não tem onde guardar uma (I-8): é a diferença entre "onde
              o conteúdo trava" e "quem está devendo".
            */}
            <span
              className="w-[10px] shrink-0 text-[10px] leading-[14px] tabular-nums"
              style={{ color: TEXTO.mudo }}
            >
              {item.posicao}
            </span>
            {/* Sem `truncate` (2026-08-18): quando o nome do módulo não couber,
                ele QUEBRA em duas linhas. A caixa cede 8px para o valor ao lado
                (ver abaixo) e este card tem 107px de folga vertical com dado
                real — o custo de uma segunda linha aqui é zero. */}
            <span
              className="min-w-0 flex-1 text-[10.5px] leading-[14px]"
              style={{ color: TEXTO.primario, letterSpacing: "-0.006em" }}
            >
              {item.moduloTitulo}
            </span>
            {/*
              A pista tem largura FIXA e a barra é ancorada à direita dela, então
              as quatro começam no mesmo x (V-37) e o comprimento é a única coisa
              que varia entre elas.
            */}
            <span
              className="flex shrink-0 justify-start"
              style={{ width: PISTA_BARRA }}
              aria-hidden="true"
            >
              <span
                className="inline-block h-[3px] rounded-full"
                style={{
                  width: PISTA_BARRA * item.fracaoBarra,
                  backgroundColor: VARIACAO.negativo,
                }}
              />
            </span>
            {/*
              46px, e não 38. A caixa de 38 foi dimensionada para `−99%`; o pior
              caso REAL é `−100%`, com 41,1px de tinta medidos no navegador, e
              como o texto é `text-right` ele vazava 2,8px para a ESQUERDA, por
              cima da barra — em TODA largura de 1280 a 1800, e nos dois modos.
              Um valor que passa por cima do próprio gráfico não é acabamento
              ruim, é o número mentindo sobre onde a barra termina.
            */}
            <span
              className="w-[46px] shrink-0 text-right text-[11.5px] leading-[16px] font-bold tabular-nums"
              style={{ color: VARIACAO.negativo, letterSpacing: "-0.01em" }}
            >
              {item.valorTexto}
            </span>
          </div>
        ))}
      </div>
    </CardDeBloco>
  )
}

// ===========================================================================
// §20 — Participação ao longo do tempo
// ===========================================================================

function BlocoDeParticipacao({ bloco }: { bloco: ComEstado<BlocoParticipacao> }) {
  const subiu = bloco.deltaPp !== null && bloco.deltaPp > 0
  const caiu = bloco.deltaPp !== null && bloco.deltaPp < 0
  return (
    <CardDeBloco
      titulo={bloco.titulo}
      subtitulo={bloco.subtitulo}
      acaoRotulo={bloco.acao.rotulo}
      bloco={bloco}
    >
      {/* `grid-cols-4` com o mesmo vão: as quatro células saem com largura
          idêntica por construção, e nenhuma cai para a linha de baixo (V-09). */}
      <div className="mt-[7px] grid grid-cols-4 gap-[8px]">
        {bloco.faixas.map((f) => (
          <Tile key={f.id} tom="neutral" className="px-[9px] pt-[6px] pb-[7px]">
            {/*
              SEM `truncate`, COM duas linhas reservadas (2026-08-18).
              `2x ou mais/semana` mede 84px de tinta a 9px e a célula dá 75 a
              1512 — V-09 exige as quatro células com a MESMA largura (≤6px de
              diferença), então alargar esta não é caminho: as quatro seriam
              dimensionadas pelo rótulo mais longo e as outras três ficariam
              ocas. O caminho é vertical: o rótulo quebra em duas linhas.
              `min-h` de duas linhas em TODAS as quatro é o que mantém os quatro
              numerais na mesma baseline — sem ele, só a célula que quebrasse
              empurraria o próprio número 11px para baixo.
            */}
            <div
              className="min-h-[22px] text-[9px] leading-[11px]"
              style={{
                color: TEXTO.mudo,
                letterSpacing: "-0.004em",
                overflowWrap: "anywhere",
              }}
            >
              {f.rotulo}
            </div>
            <div
              className="mt-[1px] font-bold tabular-nums"
              style={{ color: TINTA_FAIXA[f.id], letterSpacing: "-0.02em" }}
            >
              <span className="text-[21px] leading-[26px]">{f.percentual}</span>
              <span className="text-[12px] leading-[26px]">%</span>
            </div>
          </Tile>
        ))}
      </div>

      {/*
        A barra empilhada é desenhada a partir DOS MESMOS percentuais impressos
        acima (V-36). Uma barra decorativa desacoplada do número mentiria sobre a
        regularidade da equipe, e é a mentira mais barata de cometer nesta tela:
        ninguém confere largura de segmento com régua.
      */}
      <div className="mt-[8px] flex h-[7px] overflow-hidden rounded-full" aria-hidden="true">
        {bloco.faixas.map((f) => (
          <span
            key={f.id}
            style={{ width: `${f.percentual}%`, backgroundColor: TINTA_FAIXA[f.id] }}
          />
        ))}
      </div>

      <div
        className="mt-[8px] flex items-center justify-center gap-[7px] rounded-[10px] py-[5px] text-[10.5px] leading-[14px]"
        style={{ backgroundColor: FUNDO_TILE.neutral, color: TEXTO.secundario }}
      >
        {caiu || subiu ? (
          <span style={{ color: caiu ? VARIACAO.negativo : VARIACAO.positivo }}>
            <Glifo nome={caiu ? "arrow-down-right" : "arrow-up"} tamanho={13} />
          </span>
        ) : null}
        {bloco.frase}
      </div>

      {/* O denominador é TEXTO renderizado, nunca `title` de hover (I-2):
          régua que só existe no hover é régua que ninguém encontra. */}
      <p className="mt-[4px] text-[9px] leading-[12px]" style={{ color: TEXTO.mudo }}>
        {bloco.textoDenominador}
      </p>
    </CardDeBloco>
  )
}

// ===========================================================================
// §21 — Risco de perda de ritmo
// ===========================================================================

function BlocoDeRisco({ bloco }: { bloco: ComEstado<BlocoRisco> }) {
  return (
    <CardDeBloco
      titulo={bloco.titulo}
      subtitulo={bloco.subtitulo}
      acaoRotulo={bloco.acao.rotulo}
      bloco={bloco}
    >
      <div className="mt-[7px] grid grid-cols-4 gap-[8px]">
        {bloco.categorias.map((c) => (
          <Tile key={c.id} tom={c.tom} className="flex flex-col items-center px-[4px] py-[6px]">
            <CirculoIcone tom={c.tom} diametro={28}>
              <Glifo nome={c.icone} tamanho={14} />
            </CirculoIcone>
            {/* Mesma correção da célula de `Participação`: V-10 exige as quatro
                com largura idêntica, então quem cede é a altura. `Desacelerando`
                pedia 8px a mais do que a célula dá a 1440, e `truncate` resolvia
                isso apagando letras. Duas linhas reservadas em todas as quatro
                mantêm os quatro numerais na mesma baseline. */}
            {/* `overflow-wrap: anywhere`: `Desacelerando` e `Sustentando` são
                palavras únicas, e palavra única mais larga que a célula não tem
                onde quebrar — a 1440 ela escorria 1,6px para fora do tile e a
                7,8 a 1366. Inerte de 1512 para cima. */}
            <div
              className="mt-[4px] min-h-[22px] w-full text-center text-[9.5px] leading-[11px]"
              style={{
                color: TEXTO.secundario,
                letterSpacing: "-0.006em",
                overflowWrap: "anywhere",
              }}
            >
              {c.rotulo}
            </div>
            <div
              className="mt-[1px] text-[20px] leading-[25px] font-bold tabular-nums"
              style={{ color: TEXTO.primario, letterSpacing: "-0.02em" }}
            >
              {c.pessoas}
            </div>
            <div
              className="text-[9.5px] leading-[12px] font-semibold tabular-nums"
              style={{ color: TOM_ICONE[c.tom].ink }}
            >
              ({c.percentual}%)
            </div>
          </Tile>
        ))}
      </div>

      {/*
        `EstadoJornada` tem SEIS valores e a §21 desenha QUATRO cards. Sem esta
        nota, os quatro afirmam implicitamente uma partição que não é partição —
        é literalmente o defeito medido na tela do dono e corrigido na Visão
        geral. `null` quando a soma fecha: uma nota dizendo "0 pessoas fora" é
        ruído.
      */}
      {bloco.notaCobertura ? (
        <p
          className="mt-[5px] text-[9px] leading-[11.5px]"
          style={{ color: TEXTO.mudo, letterSpacing: "-0.002em" }}
        >
          {bloco.notaCobertura}
        </p>
      ) : null}
    </CardDeBloco>
  )
}

// ===========================================================================
// A aba
// ===========================================================================

export function PadroesTendenciasTab({ dados }: { dados: PadroesTendenciasDados }) {
  return (
    /*
      OS RECUOS HORIZONTAIS SÃO O QUE PÕE A COLUNA NA RÉGUA, e não são estéticos.
      O `<main>` da Academy entrega 1364px úteis (1412 menos 24 de padding de
      cada lado); a régua exige a coluna de cards começando 31px depois da origem
      e terminando 80px antes da borda direita do canvas — o que dá exatamente
      1364 − 31 − 56 = 1277. Sem estes recuos os cards nascem 87px largos demais e
      a borda direita cai a 24px do canvas, fora da faixa de 71–89.

      `2xl:pr-[56px]` (não `pr-[56px]` puro) é o mesmo par usado pela aba já
      construída: abaixo de 1536px a folga de 56 vira desperdício, e a régua julga
      um único breakpoint ("NÃO É CRITÉRIO" item 14).
    */
    <div className="pr-[16px] pl-[31px] 2xl:pr-[56px]" style={{ backgroundColor: COR_PAGINA }}>
      {/* 1 — faixa explicativa, largura inteira da coluna (V-12) */}
      {/*
        A altura vai num `<div>` externo com `style`, e não numa classe do Card,
        por duas razões que se somam: `Card` (a primitiva da casa) não aceita
        `style`, e uma classe arbitrária interpolada — `h-[${X}px]` — NÃO seria
        extraída pelo Tailwind, que varre a fonte procurando o literal. O
        resultado seria uma faixa sem altura nenhuma, e o orçamento vertical
        deste arquivo passaria a mentir sem uma linha vermelha em lugar algum.
      */}
      <div style={{ height: ALTURA_FAIXA }}>
        <Card className="flex h-full items-center gap-[14px] px-[18px]">
          <CirculoIcone tom="amber" diametro={38} paleta={TOM_ICONE_SUAVE}>
            <Glifo nome="lightbulb" tamanho={18} />
          </CirculoIcone>
          <div className="min-w-0 flex-1">
            <CardTitulo>{dados.moldura.titulo}</CardTitulo>
            <p
              className="mt-[1px] text-[11px] leading-[15px]"
              style={{ color: TEXTO.terciario, letterSpacing: "-0.004em" }}
            >
              {dados.moldura.texto}
            </p>
          </div>
          <BotaoContorno rotulo={dados.moldura.acao.rotulo} />
        </Card>
      </div>

      {/* 2, 3, 4 */}
      <Fileira altura={ALTURA_FILEIRA_1}>
        <BlocoDeMudancas bloco={dados.mudancas} />
        <BlocoDeSerie bloco={dados.serie} />
        <BlocoDeSinais bloco={dados.sinais} />
      </Fileira>

      {/* 5, 6, 7 */}
      <Fileira altura={ALTURA_FILEIRA_2}>
        <BlocoDeGargalos bloco={dados.gargalos} />
        <BlocoDeParticipacao bloco={dados.participacao} />
        <BlocoDeRisco bloco={dados.risco} />
      </Fileira>

      {/* 8 — faixa de foco, largura inteira, superfície quente distinta (V-32) */}
      <div
        className="flex items-center justify-center gap-[9px] rounded-[12px] text-[11px] leading-[15px]"
        style={{
          marginTop: VAO,
          height: ALTURA_FOCO,
          backgroundColor: FUNDO_QUENTE,
          color: TEXTO.secundario,
          letterSpacing: "-0.004em",
        }}
      >
        <span style={{ color: TOM_ICONE.amber.ink }}>
          <Glifo nome="lightbulb" tamanho={14} />
        </span>
        {dados.faixaFoco}
      </div>
    </div>
  )
}
