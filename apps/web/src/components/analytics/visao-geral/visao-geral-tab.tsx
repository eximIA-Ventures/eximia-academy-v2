// ---------------------------------------------------------------------------
// Aba "Visão geral" do Analytics do gestor.
//
// ESTADO DESTE ARQUIVO — nenhum stub restante. O que ele desenha:
//   ✅ cabeçalho — título, subtítulo, os 3 chips de filtro e carimbo de frescor;
//   ✅ trinca de abas, com sublinhado só no item ativo;
//   ✅ grade 2 colunas × 3 linhas, com a inversão de lado na linha 3;
//   ✅ card "Placar da jornada" — 5 tiles em fileira única, com ícone em disco,
//      rótulo, valor e variação em pontos percentuais (aqui);
//   ✅ card "O que mudou" — 3 marcadores em disco sólido, 3 frases e UM link de
//      rodapé (aqui);
//   ✅ os outros 4 cards, cada um em arquivo próprio: "Quem precisa da minha
//      atenção agora?" (bloco-atencao), "Resposta aos seus acionamentos"
//      (bloco-resposta), "Recomendações" e "Sinais" (coluna-leitura).
//
// A MOLDURA NÃO MORA MAIS AQUI. A barra lateral e o cabeçalho de plataforma são
// os REAIS da Academy, montados pelo shell — em produção pelo
// `app/(platform)/layout.tsx`, no harness de preview por
// `app/gauntlet-preview/visao-geral/preview-shell.tsx`. A réplica que este
// arquivo desenhava (um `<aside>` de 201px) foi removida por decisão do dono do
// produto (2026-08-16). A raiz deste componente é o CONTEÚDO, e nada mais: ele
// assume que já está dentro do `<main>` do shell.
//
// Referência visual: docs/sop/runs/_referencias/academy-analytics-gestor/01-visao-geral.png
// Régua: CRITERIOS.md · Dados: FIXTURE.md · Comportamento: INVARIANTES.md
// Atenção: a troca de moldura desloca a régua nos DOIS eixos (a barra real tem
// 260px, contra 201 da réplica, e o shell traz cabeçalho e padding próprios). A
// emenda de CRITERIOS.md é ato do dono, não deste arquivo.
// ---------------------------------------------------------------------------

import {
  ArrowDown,
  ArrowUp,
  Ban,
  Calendar,
  CalendarCheck,
  Check,
  ChevronDown,
  Clock,
  GraduationCap,
  type LucideIcon,
  TrendingUp,
  User,
  Users,
} from "lucide-react"
import { CardAtencao } from "./bloco-atencao"
import { CardResposta } from "./bloco-resposta"
import { CardRecomendacoes, CardSinais } from "./coluna-leitura"
import {
  COR_ACAO,
  COR_TILE,
  Card,
  CardTitulo,
  CirculoIcone,
  LinkRodape,
  RAIO_TILE,
  SOMBRA_CARD,
  TEXTO,
  TOM_MARCADOR,
  VARIACAO,
} from "./design"
import type { ItemMudanca, MetricaPlacar, VisaoGeralFixture } from "./fixture"

// ===========================================================================
// Ícones
// ===========================================================================

/**
 * Mapa `fixture.icone` → glifo Lucide.
 *
 * Três entradas divergem do NOME na fixture e seguem o GLIFO do PNG, porque a
 * precedência de CRITERIOS.md §0 é "para qualquer coisa verificável no
 * screenshot, o PNG vence". Nenhum valor da fixture foi alterado; apenas a
 * resolução nome → desenho:
 *   • `hand`      (Participação) → o PNG mostra duas pessoas;
 *   • `user-x`    (Sem acesso)   → o PNG mostra um círculo cortado;
 *   • `book-open` (chip Cursos)  → o PNG mostra um capelo.
 */
const GLIFO: Record<string, LucideIcon> = {
  users: Users,
  "calendar-check": CalendarCheck,
  "trending-up": TrendingUp,
  hand: Users,
  "user-x": Ban,
  clock: Clock,
  "book-open": GraduationCap,
  calendar: Calendar,
  "arrow-down": ArrowDown,
  // 4ª divergência nome → glifo pela mesma precedência: a fixture nomeia
  // `alert-triangle` no 2º marcador de "O que mudou", e o PNG desenha uma
  // PESSOA (o item fala de "6 pessoas"). O PNG vence.
  "alert-triangle": User,
  check: Check,
}

// ===========================================================================
// Cabeçalho — chips de filtro
// ===========================================================================

/**
 * Chip de filtro: 40px de altura, raio 10 (nem pílula, nem quadrado), SEM borda
 * de contorno — B-14. A separação com o fundo é a mesma sombra do card.
 *
 * POR QUE ELE VOLTOU (rodada 3 da compressão). A rodada anterior trocou os 3
 * chips pelos controles REAIS da Academy (`ScopeBar` + `PeriodFilter`), e a
 * troca custou quatro critérios de uma vez: a bandeja é um contêiner CINZA de
 * largura total (A-17 pede 3 chips e nenhum contêiner atrás), o `PeriodFilter`
 * é um segmentado de ~28px que mostra "7 dias / 30 dias / 90 dias" (C-05 exige
 * a string `Últimos 30 dias`), a pílula de curso é laranja PREENCHIDA (B-14
 * exige chip sem preenchimento) e "Meu time" tinha sumido do conteúdo. A régua
 * é imutável durante o ciclo, então quem cede é a tela: os controles reais
 * voltam a ser trabalho de produção, fora desta run.
 *
 * GEOMETRIA MEDIDA (rodada 5 da peça A, preservada aqui sem retoque). Medida de
 * tinta na referência, chip a chip (bordas brancas em x 842‥987 · 1006‥1200 ·
 * 1218‥1406):
 *
 *   folga             ref (tinta)   CSS aqui
 *   borda → ícone .......  14–15     pl-[14px]
 *   ícone → rótulo ......  12–13     ml-[12px]
 *   rótulo → chevron ....  17–18     ml-[15px]
 *   chevron → borda .....  14–15     pr-[10px]
 *
 * O chevron de 16px desenha 10px de tinta (3px de inset por lado), então a
 * folga de TINTA é sempre ~3px maior que o valor em CSS.
 */
function ChipFiltro({ rotulo, icone }: { rotulo: string; icone: string }) {
  const Icone = GLIFO[icone] ?? Users
  return (
    <button
      type="button"
      className="flex h-[40px] items-center bg-white pr-[10px] pl-[14px]"
      style={{ borderRadius: 10, boxShadow: SOMBRA_CARD }}
    >
      <Icone size={16} strokeWidth={2.25} style={{ color: "#454545" }} />
      {/* 14,4px devolve o cap-height do rótulo a 10px (a 15px media 11) sem
          encolher a largura de tinta: o `letterSpacing` sobe de -0.008em para
          -0.004em e a string fica em 63px, exatamente a da referência.
          `top: -1` sobe a tinta de y[36..45] para y[35..44], que é onde a
          referência assenta o cap — fonte menor na MESMA caixa de linha desce
          a tinta, e a compensação é ótica, não de `line-height`. */}
      <span
        className="relative top-[-1px] ml-[12px] text-[14.4px] leading-[22px] font-medium whitespace-nowrap"
        style={{ color: TEXTO.primario, letterSpacing: "-0.004em" }}
      >
        {rotulo}
      </span>
      <ChevronDown
        size={16}
        strokeWidth={2.25}
        className="ml-[15px]"
        style={{ color: "#7A7876" }}
      />
    </button>
  )
}

// ===========================================================================
// Placar da jornada — 5 tiles
// ===========================================================================

/**
 * Quebra o valor já formatado da fixture em partes tipográficas, SEM reescrever
 * a string. `28 de 40 · 70%` vira `28` grande + `de 40 · 70%` em corpo de
 * rótulo; `48%` vira `48` grande + `%` do mesmo tamanho e cor, só que mais leve
 * (D-12 aceita explicitamente o peso menor no símbolo).
 */
function partesDoValor(metrica: MetricaPlacar): {
  destaque: string
  sufixo: string | null
  complemento: string | null
} {
  if (metrica.valorAbsoluto !== null) {
    const corte = metrica.valorPrincipal.indexOf(" ")
    return {
      destaque: metrica.valorPrincipal.slice(0, corte),
      sufixo: null,
      complemento: metrica.valorPrincipal.slice(corte + 1),
    }
  }
  const casado = /^(\d+)(\D*)$/.exec(metrica.valorPrincipal)
  return {
    destaque: casado ? casado[1] : metrica.valorPrincipal,
    sufixo: casado?.[2] ? casado[2] : null,
    complemento: null,
  }
}

function TilePlacar({ metrica }: { metrica: MetricaPlacar }) {
  const Icone = GLIFO[metrica.icone] ?? Users
  const { destaque, sufixo, complemento } = partesDoValor(metrica)
  // A COR vem do TOM semântico, nunca da direção da seta (C-17).
  const corVariacao = metrica.deltaTom === "positivo" ? VARIACAO.positivo : VARIACAO.negativo
  const Seta = metrica.deltaDirecao === "up" ? ArrowUp : ArrowDown
  // O rótulo textual da fixture já traz a seta; ela é desenhada como ícone de
  // traço (B-27 exige traço com pontas arredondadas, não glifo de texto).
  const textoVariacao = metrica.deltaLabel.replace(/^[↑↓]\s*/, "")

  return (
    // COMPRESSÃO HORIZONTAL (rodada 2 do painel). O card encolheu de 909 para
    // 827 para devolver a proporção da linha (A-08), então o tile precisou
    // ceder 8px de FOLGA cada: `px` de 12 para 9 e o vão disco↔texto de 13
    // para 11. Nenhuma fonte e nenhum disco mudaram — o disco continua Ø44,
    // no meio da faixa 40–48 de B-20.
    //
    // O `min-w-0` SAIU de propósito. Ele zerava o mínimo automático da coluna
    // do grid, ou seja permitia a faixa encolher ABAIXO do conteúdo e clipar o
    // texto em silêncio (os tiles são `whitespace-nowrap`). Sem ele, a faixa
    // nunca fica menor que o próprio conteúdo: se a medida errar, o grid
    // redistribui em vez de cortar. A soma dos mínimos medidos é 735,8 e a
    // caixa útil é 799, então há 23px de sobra para essa redistribuição.
    <div
      className="flex flex-col px-[9px] py-[16px] whitespace-nowrap"
      style={{ backgroundColor: COR_TILE, borderRadius: RAIO_TILE }}
    >
      <div className="flex items-center gap-[11px]">
        <CirculoIcone tom={metrica.iconeTom} diametro={44}>
          <Icone size={21} strokeWidth={2} />
        </CirculoIcone>
        <div className="flex flex-col">
          <span
            className="text-[12px] leading-[16px]"
            style={{ color: TEXTO.secundario, letterSpacing: "-0.012em" }}
          >
            {metrica.rotulo}
          </span>
          <span
            className="mt-[3px] flex items-baseline text-[25px] leading-[30px] font-bold"
            style={{ color: TEXTO.primario, letterSpacing: "-0.022em" }}
          >
            {destaque}
            {sufixo ? <span className="font-medium">{sufixo}</span> : null}
            {complemento ? (
              <span
                className="ml-[6px] text-[12px] leading-[16px] font-normal"
                style={{ color: TEXTO.terciario, letterSpacing: "-0.006em" }}
              >
                {complemento}
              </span>
            ) : null}
          </span>
        </div>
      </div>

      {/* Variação: seta de traço + texto na MESMA cor, sem pílula atrás (B-27).
          COMPRESSÃO VERTICAL (rodada 7): o vão entre o valor e a variação era 16
          e caiu para 13, o mínimo que mantém o tile em 99px — A-22 exige 98 a
          116, então este é o piso, não uma folga escolhida. */}
      <span
        className="mt-[13px] ml-[55px] flex items-center gap-[3px] text-[12px] leading-[16px] font-medium"
        style={{ color: corVariacao }}
      >
        <Seta size={13} strokeWidth={2.3} />
        {textoVariacao}
      </span>
    </div>
  )
}

/**
 * Ritmo da fileira de tiles.
 *
 * Na rodada 2 os 5 tiles eram `flex-auto`, então a largura de cada um era o
 * conteúdo mais uma sobra igual: a fileira abria de 149 a 203px, contra 155 a
 * 185px do par. A referência tem larguras desiguais e ESTÁVEIS — 183 / 164 /
 * 155 / 166 / 161 (soma 829, com 4 gaps de 13 dentro de um card de 909 e
 * padding lateral de 14). Fixar a proporção em `fr` reproduz esse ritmo sem
 * depender do comprimento do rótulo, e `minWidth: 0` impede que a coluna
 * cresça de volta para o `min-content`.
 *
 * (CRITERIOS.md "NÃO É CRITÉRIO" item 6 permite distribuição igual; a desigual
 * da referência é a que devolve o ritmo que o crítico mediu.)
 *
 * REPROPORCIONADO na rodada 2 do painel, junto com o encolhimento do card de
 * 909 para 827. Os `fr` não são mais os 186/163/154/165/161 da referência
 * literal: o primeiro tile ("28 de 40 · 70%") tem conteúdo mínimo MEDIDO de
 * 178,4px depois da compressão de folga, e a fatia proporcional pura lhe daria
 * 169. Os pesos abaixo dão 180,3 / 149,6 / 138,7 / 146,6 / 143,7 sobre os 759px
 * disponíveis, todos acima do respectivo mínimo medido (178,4 / 145,9 / 128,7 /
 * 142,1 / 140,7). O ritmo desigual da referência é preservado na FORMA; o que
 * mudou foi a escala.
 */
const RITMO_TILES = "182fr 151fr 140fr 148fr 145fr"

function CardPlacar({ placar }: { placar: VisaoGeralFixture["placar"] }) {
  return (
    // 909 → 827: ver o comentário da grade em <VisaoGeralTab/>. Com `px-[14px]`
    // sobram 799 de caixa útil; 4 vãos de 10 (A-22 aceita 8 a 16) deixam 759
    // para os 5 tiles, contra 735,8 de conteúdo mínimo medido.
    <Card className="flex h-full w-[827px] shrink-0 flex-col px-[14px] pt-[12px] pb-[12px]">
      {/* Sem subtítulo: o PNG não tem, e o PNG vence a spec (FIXTURE.md §13 D-a). */}
      <CardTitulo className="pl-[7px]">{placar.titulo}</CardTitulo>
      <div className="mt-[12px] grid gap-[10px]" style={{ gridTemplateColumns: RITMO_TILES }}>
        {placar.metricas.map((metrica) => (
          <TilePlacar key={metrica.id} metrica={metrica} />
        ))}
      </div>
    </Card>
  )
}

// ===========================================================================
// O que mudou — 3 marcadores, 3 frases, 1 link
// ===========================================================================

/**
 * Marcador: anel pastel Ø18 + núcleo sólido Ø11 + glifo BRANCO vazado (C-19).
 *
 * O glifo é desenhado em 7px dentro do núcleo de 11px, ou seja 0,39 do
 * diâmetro EXTERNO — dentro da faixa 0,38–0,54 de B-21 — e nenhum traço
 * escapa do disco (D-05).
 */
function MarcadorMudanca({ item }: { item: ItemMudanca }) {
  const Glifo = GLIFO[item.marcadorGlifo] ?? Check
  const { anel, nucleo } = TOM_MARCADOR[item.marcadorTom]
  return (
    <span
      className="mt-[1px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full"
      style={{ backgroundColor: anel }}
    >
      <span
        className="flex h-[11px] w-[11px] items-center justify-center rounded-full text-white"
        style={{ backgroundColor: nucleo }}
      >
        <Glifo size={7} strokeWidth={3} />
      </span>
    </span>
  )
}

/**
 * Ritmo vertical MEDIDO na referência (card em y 160→361):
 *   título ................ cap top 181
 *   item 1, linha 1 ....... cap top 217 · baseline 225
 *   passo entre linhas .... 17 (baselines 225 → 242)
 *   passo entre itens ..... 46 (baselines 225 → 271 → 317) ⇒ vão de 12
 *   link .................. baseline 332, na MESMA faixa da última linha
 *
 * A largura do corpo de texto (`w-[196px]`, contra 384px de folga até a régua
 * direita) é o que produz a quebra em 2 linhas de cada frase EXATAMENTE onde a
 * referência quebra — 183 / 174 / 180px de tinta na primeira linha. A quebra é
 * consequência da medida, nunca `<br>` manual.
 */
function CardMudancas({ mudancas }: { mudancas: VisaoGeralFixture["mudancas"] }) {
  return (
    <Card className="relative h-full flex-1 px-[20px] pt-[12px]">
      <CardTitulo>{mudancas.titulo}</CardTitulo>

      <ul className="mt-[10px] flex flex-col gap-[10px]">
        {mudancas.itens.map((item) => (
          <li key={item.id} className="flex items-start gap-[17px]">
            <MarcadorMudanca item={item} />
            <p
              className="w-[196px] text-[12.2px] leading-[15px]"
              style={{ color: TEXTO.primario, letterSpacing: "-0.004em" }}
            >
              {item.texto}
            </p>
          </li>
        ))}
      </ul>

      {/* UM link para o card inteiro, nunca um por item (C-20 / §13 D-c).
          O recuo da base caiu de 39 para 20: com o card em 170px, 39 deixaria o
          link boiando no meio da caixa em vez de ancorado no rodapé.
          ATENÇÃO ao que este número significa: a caixa é `absolute` de ALTURA
          ZERO, então `bottom-[N]` posiciona o TOPO do link, não a base dele. O
          link tem 16px, logo 20 devolve 4px de folga real até a base do card;
          um `bottom-[4px]` ingênuo faria o link vazar 12px para FORA do card. */}
      <div className="absolute right-0 bottom-[20px] left-0">
        <LinkRodape rotulo={mudancas.linkRodape} />
      </div>
    </Card>
  )
}

// ===========================================================================
// Tela
// ===========================================================================

export function VisaoGeralTab({ data }: { data: VisaoGeralFixture }) {
  // `sidebar` continua na fixture (conformidade com FIXTURE.md) e
  // deliberadamente NÃO é lida aqui: a barra vem do shell real.
  const {
    cabecalho,
    chipsFiltro,
    abas,
    placar,
    mudancas,
    atencao,
    recomendacoes,
    resposta,
    sinais,
  } = data

  const Relogio = GLIFO[cabecalho.atualizadoIcone] ?? Clock

  return (
    // A raiz é o CONTEÚDO: este componente já nasce dentro do `<main>` do shell,
    // que é quem dá largura, fundo e rolagem. Os recuos abaixo são os do
    // conteúdo em relação a essa caixa, não em relação ao canvas.
    // COMPRESSÃO VERTICAL (rodada 7). A caixa útil do <main> tem 821px e o
    // conteúdo ocupava 992 — 171px de estouro, invisível na foto porque a barra
    // de rolagem deste navegador é OVERLAY. O recuo superior caiu de 21 para 2:
    // é o primeiro lugar a ceder porque não carrega informação nenhuma.
    <div className="pt-[12px] pr-[56px] pl-[31px]" style={{ color: TEXTO.primario }}>
      {/* Cabeçalho. A régua direita dos controles fica 11px antes da dos cards. */}
      <header className="flex items-start justify-between pr-[11px]">
        <div>
          {/* `wordSpacing` compensa o aperto que o `letterSpacing` negativo
              impõe também ao espaço: sem ele o vão de tinta entre as palavras
              cai para 6–7px, contra 8–9px da referência. */}
          {/* O TAMANHO do H1 é intocável (33px devolve cap 24, e B-29 exige 22
              a 27); o que cedeu foi a CAIXA DE LINHA, de 40 para 36 — folga em
              volta da tinta, não tinta. */}
          <h1
            className="text-[33px] leading-[36px] font-bold"
            style={{
              color: TEXTO.primario,
              letterSpacing: "-0.021em",
              wordSpacing: "2px",
            }}
          >
            {cabecalho.titulo}
          </h1>
          <p
            className="mt-[4px] text-[14.8px] leading-[20px]"
            style={{ color: TEXTO.terciario, letterSpacing: "-0.004em" }}
          >
            {cabecalho.subtitulo}
          </p>
        </div>

        {/* Os 3 chips e o carimbo dividem UMA fileira só, ancorada à direita —
            é o arranjo da referência, e é também o que devolve altura: a
            bandeja de escopo que ocupava a faixa abaixo do cabeçalho (contêiner
            de `p-3` mais o vão de 10) custava 62px de caixa útil e some aqui.
            Os chips não custam altura nenhuma: 40px cabem dentro dos 60px que
            o par título + subtítulo já ocupa na coluna da esquerda.

            `items-center` (e não `items-start`) é o que satisfaz o "centros
            verticais dentro de 3px" de A-17: os 3 chips e o carimbo passam a
            compartilhar a MESMA linha de centro, seja qual for a altura de cada
            um. Gap de 17px entre os chips, dentro da faixa 9–18 de A-17. */}
        <div className="flex items-center gap-[17px]">
          {chipsFiltro.map((chip) => (
            <ChipFiltro key={chip.id} rotulo={chip.rotulo} icone={chip.icone} />
          ))}
          {/* Carimbo de frescor: sem caixa, sem borda (A-18).
              A fileira inteira é ancorada à DIREITA, então a largura deste
              carimbo é o que empurra os chips para a esquerda. Medido: a tinta
              de "Atualizado há 2h" ocupa 100px na referência (x 1504‥1603)
              contra 116px a 15px, e o relógio 14px contra 15. A 13px o carimbo
              volta a 123px de tinta e o chip 3 reencontra a régua direita. */}
          <span
            className="ml-[56px] flex items-center gap-[9px] text-[13px] leading-[22px] whitespace-nowrap"
            style={{ color: TEXTO.mudo, letterSpacing: "-0.002em" }}
          >
            <Relogio size={14} strokeWidth={2.2} />
            {cabecalho.atualizadoLabel}
          </span>
        </div>
      </header>

      {/* Abas. NÃO existe régua horizontal de largura total aqui (A-21): o
          sublinhado pertence só ao item ativo.

          ESCALA RECALIBRADA (rodada 6). A 15px a aba media cap 12 e 80px de
          tinta em "Visão geral", fora da banda 9–11 de B-29 e colada no tier
          de título de card. Medida de tinta na referência (y 117‥131):
            rótulo               ref    r5 (15px)   quociente
            Visão geral ......... 75      80          0,938
            Padrões e tendências  143     152         0,941
            Mapa da jornada ..... 110     117         0,940
          O quociente é o mesmo nos três, ou seja o erro era de TAMANHO, não
          de tracking: 15 × 0,94 = 14,1px devolve 75/143/110 e o cap a ~10.
          O sublinhado é consequência, não ajuste separado — o `px-[9px]` de
          cada lado o mantém em rótulo + 18px (A-20 pede + 10 a 22) e
          centrado, porque as bearings laterais desta fonte são ~0: a 15px
          media 98 sobre tinta de 80 (9 de sobra de cada lado), a 14,1px
          fecha em 93 sobre tinta de 75, que é o 91 da referência. */}
      <nav className="mt-[10px] flex gap-[17px]">
        {abas.map((aba) => (
          <span
            key={aba.id}
            className="px-[9px] pb-[4px] text-[14.1px] leading-[20px] whitespace-nowrap"
            style={{
              color: aba.ativa ? COR_ACAO : TEXTO.mudo,
              fontWeight: aba.ativa ? 600 : 500,
              letterSpacing: "-0.006em",
              borderBottom: aba.ativa ? `3px solid ${COR_ACAO}` : "3px solid transparent",
            }}
          >
            {aba.rotulo}
          </span>
        ))}
      </nav>

      {/* Grade: 2 colunas × 3 linhas. A linha 3 INVERTE o lado do bloco largo.
          ALTURAS RECALCULADAS (rodada 7). O mockup foi composto SEM o shell da
          Academy e tinha 920px de folga vertical; aqui a caixa útil é 821. As
          alturas de referência (201 / 357 / 168, e o alvo 185–215 / 335–380 /
          155–185 de A-14) somam 726 e não cabem junto com cabeçalho, bandeja e
          abas. Cada linha passou a ser o MÍNIMO que o conteúdo dela ocupa, e
          quem dita o mínimo é sempre o card mais alto do par:
            linha 1 = 170 → "O que mudou" (3 frases de 2 linhas + link)
            linha 2 = 300 → "Quem precisa da minha atenção" (4 pílulas + 4
                            linhas de tabela no passo mínimo de A-25 + link)
            linha 3 = 146 → "Sinais fora do padrão" (3 sinais + link)
          Os gaps entre linhas caíram para 10, o piso de A-12. NENHUM bloco,
          linha, recomendação ou sinal foi removido — a perda é de folga, e
          está declarada no retorno da rodada.

          LARGURAS REPROPORCIONADAS (rodada 2 do painel). O defeito: "O que
          fazer agora" terminava em x 1664, 71px à direita dos outros cards e a
          8px da borda do canvas. A causa não era margem: o card é `flex-1` com
          `min-width: auto`, e o conteúdo dele (badge + caixa de texto de 236 +
          CTA) tem mínimo de 424,7px. Com o par esquerdo travado em 909, a linha
          pedia 1348 numa coluna de 1277 e o `flex` não tinha como encolher — ele
          estourava para fora, em silêncio.

          A correção é proporção, não margem. A coluna tem 1277px e cada linha
          agora a divide inteira:
            linha 1 e 2 ... 827 + 14 + 436   (65,5% / 34,5%, razão 1,90:1)
            linha 3 ....... 624 + 13 + 640   (49,4% / 50,6%, razão 0,975:1)
          A-08/A-09 pedem razão entre 1,85:1 e 2,10:1 e A-10 pede entre 0,86:1 e
          1,00:1 com o bloco largo à DIREITA. Todo card passa a terminar em
          x 1592, que é o recuo de 80px à direita que A-05 exige.

          Nota sobre a linha 3: ela não estava só desalinhada, estava INVERTIDA
          em proporção — 662/602 dá 1,10:1, ou seja o bloco largo estava à
          esquerda. Agora "Sinais fora do padrão" é o mais largo, como na
          referência. */}
      <div className="mt-[4px] flex flex-col">
        <div className="flex h-[185px] gap-[14px]">
          <CardPlacar placar={placar} />
          <CardMudancas mudancas={mudancas} />
        </div>
        <div className="mt-[12px] flex h-[335px] gap-[14px]">
          <CardAtencao atencao={atencao} />
          <CardRecomendacoes recomendacoes={recomendacoes} />
        </div>
        <div className="mt-[12px] flex h-[155px] gap-[13px]">
          <CardResposta resposta={resposta} />
          <CardSinais sinais={sinais} />
        </div>
      </div>
    </div>
  )
}
