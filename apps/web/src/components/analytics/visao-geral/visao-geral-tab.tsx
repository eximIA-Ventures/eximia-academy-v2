// ---------------------------------------------------------------------------
// Aba "Visão geral" do Analytics do gestor.
//
// ESTADO DESTE ARQUIVO — nenhum stub restante. O que ele desenha:
//   ✅ cabeçalho — título, subtítulo, os SELETORES DE CONTEXTO reais da Academy
//      (<FiltrosEscopo/>: `ScopeBar` + `PeriodFilter`, nunca os 3 chips do
//      mockup) e o carimbo de frescor, tudo numa fileira só;
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

import type {
  BlocoMudancas,
  BlocoPlacar,
  ItemMudanca,
  MetricaPlacar,
  VisaoGeralDados,
} from "@/lib/analytics/visao-geral/tipos"
import type { NudgeType } from "@/types/notifications"
import {
  ArrowDown,
  ArrowUp,
  Ban,
  CalendarCheck,
  Check,
  Clock,
  type LucideIcon,
  TrendingUp,
  User,
  Users,
} from "lucide-react"
import { ProvedorAcoes } from "./acoes"
import { CardAtencao } from "./bloco-atencao"
import { CardResposta } from "./bloco-resposta"
import { CardRecomendacoes, CardSinais } from "./coluna-leitura"
import {
  COR_TILE,
  Card,
  CardTitulo,
  CirculoIcone,
  LinkRodape,
  RAIO_TILE,
  TEXTO,
  TOM_MARCADOR,
  VARIACAO,
} from "./design"
import { CorpoNaoRenderizavel, FalhaDoBloco, situacaoDo } from "./estado-bloco"
import { type ControlesFiltro, FiltrosEscopo } from "./filtros-escopo"
import { type DestinoAbas, NavAbas } from "./nav-abas"
import { ROTA_TENDENCIAS } from "./navegacao"

// ===========================================================================
// Ícones
// ===========================================================================

/**
 * Mapa `fixture.icone` → glifo Lucide.
 *
 * Duas entradas divergem do NOME na fixture e seguem o GLIFO do PNG, porque a
 * precedência de CRITERIOS.md §0 é "para qualquer coisa verificável no
 * screenshot, o PNG vence". Nenhum valor da fixture foi alterado; apenas a
 * resolução nome → desenho:
 *   • `hand`      (Participação) → o PNG mostra duas pessoas;
 *   • `user-x`    (Sem acesso)   → o PNG mostra um círculo cortado.
 *
 * `book-open` e `calendar` SAÍRAM deste mapa junto com o `ChipFiltro`: eram as
 * chaves dos chips 2 e 3 (`Todos os cursos` e `Últimos 30 dias`) e não têm
 * nenhum outro consumidor. Os filtros voltaram a ser os controles REAIS da
 * Academy (<FiltrosEscopo/>), que trazem os próprios ícones.
 */
const GLIFO: Record<string, LucideIcon> = {
  users: Users,
  "calendar-check": CalendarCheck,
  "trending-up": TrendingUp,
  hand: Users,
  "user-x": Ban,
  clock: Clock,
  "arrow-down": ArrowDown,
  // 3ª divergência nome → glifo pela mesma precedência: a fixture nomeia
  // `alert-triangle` no 2º marcador de "O que mudou", e o PNG desenha uma
  // PESSOA (o item fala de "6 pessoas"). O PNG vence.
  "alert-triangle": User,
  check: Check,
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

/**
 * Por que NÃO houve comparação, em uma frase.
 *
 * "sem comparação" sozinho é um beco: o gestor lê que falta um número e não tem
 * como saber se é falha da tela, se o time é novo, ou se aquele indicador
 * simplesmente não tem passado gravado. O motivo já vinha calculado pela camada
 * de dados (`deltaAusenteMotivo`) e morria no caminho — aqui ele vira `title`,
 * acessível no hover, sem custar um pixel no cartão.
 *
 * `textoVazio` tem precedência quando existe: nos casos de `sem-base` ele é o
 * literal da §32 que a própria camada escolheu para aquela métrica ("ninguém
 * iniciou", "nenhum curso com prazo"), mais específico que qualquer genérico.
 */
function motivoSemComparacao(metrica: MetricaPlacar): string {
  if (metrica.textoVazio) return metrica.textoVazio
  switch (metrica.deltaAusenteMotivo) {
    case "sem-historico-comparavel":
      // O caso concreto de "No ritmo": `enrollments.progress` é um campo mutável
      // sem histórico, e "recomeçar curso" ainda zera o passado. Não existe
      // valor anterior para subtrair — ver `placar.ts`, decisão 3.
      return "O progresso é um campo mutável, sem histórico gravado: não existe valor anterior deste indicador para comparar."
    case "sem-periodo-anterior":
      return "Não há atividade registrada no período anterior para servir de comparação."
    case "sem-base":
      return "Não há base de cálculo para este indicador neste recorte."
    default:
      return "Não há período anterior comparável para este indicador."
  }
}

function TilePlacar({ metrica }: { metrica: MetricaPlacar }) {
  const Icone = GLIFO[metrica.icone] ?? Users
  const { destaque, sufixo, complemento } = partesDoValor(metrica)

  /**
   * VARIAÇÃO ZERO É NEUTRA, e isso é uma correção de significado, não de estilo
   * (dono do produto, 2026-08-16: a tela mostrou "Regularidade 0% ↓ 0 pp" e
   * "Sem acesso 20% ↓ 0 pp", em vermelho).
   *
   * A camada de dados já estava certa: com `delta === 0` ela devolve
   * `deltaDirecao: null` e `deltaTom: null` (`placar.ts`), porque zero não tem
   * direção nem leitura semântica. Quem inventava a piora era ESTA função, com
   * dois ternários binários — `deltaTom === "positivo" ? verde : VERMELHO` e
   * `deltaDirecao === "up" ? ↑ : ↓` — que colapsavam `null` no ramo ruim. Um
   * indicador que não se moveu era desenhado como indicador que piorou.
   *
   * O texto continua sendo "0 pp", e não "sem mudança": a comparação EXISTE e
   * deu zero, o que é diferente de não haver comparação (que é o outro ramo,
   * "sem comparação"). O que muda é a cor (`TEXTO.mudo`, o cinza que a §31
   * reserva para estado neutro) e a ausência de seta.
   *
   * A polaridade dos 5 indicadores não é decidida aqui e continua vindo de
   * `deltaTom` (C-17): "Sem acesso" é a única métrica invertida (`tomInvertido`
   * em `placar.ts`), então subir é NEGATIVO (vermelho) e descer é POSITIVO
   * (verde), com a seta seguindo o número. Ler a cor da direção da seta
   * quebraria exatamente essa métrica.
   */
  const semDirecao = metrica.deltaDirecao === null || metrica.deltaTom === null
  const corVariacao = semDirecao
    ? TEXTO.mudo
    : metrica.deltaTom === "positivo"
      ? VARIACAO.positivo
      : VARIACAO.negativo
  const Seta = metrica.deltaDirecao === "up" ? ArrowUp : ArrowDown
  // O rótulo textual da fixture já traz a seta; ela é desenhada como ícone de
  // traço (B-27 exige traço com pontas arredondadas, não glifo de texto).
  //
  // `deltaLabel` PODE SER NULO com dado real, e "No ritmo" é o caso concreto:
  // `enrollments.progress` é JSONB mutável sem histórico, então não existe o
  // valor de 30 dias atrás para subtrair. A alternativa a sumir com a linha
  // seria escrever "0 pp", que afirma "a equipe não mudou" — uma afirmação
  // sobre pessoas reais que o banco não sustenta (I-3).
  const textoVariacao = metrica.deltaLabel?.replace(/^[↑↓]\s*/, "") ?? null

  return (
    // COMPRESSÃO HORIZONTAL (rodada 2 do painel). O card encolheu de 909 para
    // 827 para devolver a proporção da linha (A-08), então o tile precisou
    // ceder 8px de FOLGA cada: `px` de 12 para 9 e o vão disco↔texto de 13
    // para 11. Nenhuma fonte e nenhum disco mudaram — o disco continua Ø44,
    // no meio da faixa 40–48 de B-20.
    //
    // O `min-w-0` VOLTOU (2026-08-16), junto com `minmax(0, Nfr)` nas trilhas.
    // Sem ele a faixa nunca ficava menor que o conteúdo, e como os tiles são
    // `whitespace-nowrap` isso travava o placar em 804px — um dos pisos que
    // faziam a tela inteira não caber numa janela menor que a referência de
    // 1672 e cortarem-se os CTAs da linha 2. O medo de então (clipar texto em
    // silêncio) é endereçado de outro jeito: quem cede é o RÓTULO, com
    // `truncate` e o texto inteiro no `title`, e o numeral nunca é tocado. A
    // soma dos mínimos medidos continua 735,8 dentro de 799 de caixa útil, ou
    // seja na largura de referência nada disso chega a agir.
    // FOLGA CEDIDA (2026-08-17), para dois tiles passarem a publicar o
    // denominador (`mostrarAbsoluto` em "Regularidade" e "Sem acesso", ver
    // placar.ts). Medido no navegador, com a fonte real: um tile de valor curto
    // ("48%") tem conteúdo mínimo de 145,9px; com "12 de 51 · 24%" ele sobe para
    // 170,3. Três tiles com absoluto pediam 789,5px de mínimo dentro de 759 de
    // caixa — estouro garantido no tenant de 51 pessoas.
    // O que cedeu foi FOLGA, nunca tinha e nunca fonte: `px` de 9 para 7 e o vão
    // disco↔texto de 11 para 10, o que devolve 4px de mínimo por tile. O disco
    // continua Ø44 (B-20 pede 40–48) e a altura do tile não se move (110px,
    // dentro dos 98–116 de A-22).
    <div
      // Âncora de teste. Existe porque o `visao-geral-placar-variacao.test.tsx`
      // achava o tile por `div[class*="px-[9px]"]` e QUEBROU quando esta linha
      // cedeu 2px de padding — um teste de comportamento não pode depender de um
      // número de folga. `data-tile` é estável e ainda diz QUAL tile é, em vez
      // de "o primeiro elemento com este texto".
      data-tile={metrica.id}
      className="flex min-w-0 flex-col px-[7px] py-[16px] whitespace-nowrap"
      style={{ backgroundColor: COR_TILE, borderRadius: RAIO_TILE }}
    >
      <div className="flex items-center gap-[10px]">
        <CirculoIcone tom={metrica.iconeTom} diametro={44}>
          <Icone size={21} strokeWidth={2} />
        </CirculoIcone>
        {/* `min-w-0` é o que permite a coluna de texto ceder quando a janela é
            menor que a referência. Quem cede é o RÓTULO (`truncate`, com o
            texto inteiro no `title`); o numeral abaixo nunca é cortado. */}
        <div className="flex min-w-0 flex-col">
          <span
            className="truncate text-[12px] leading-[16px]"
            style={{ color: TEXTO.secundario, letterSpacing: "-0.012em" }}
            title={metrica.rotulo}
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
      {textoVariacao === null ? (
        // A faixa de variação NÃO some: ela mantém a altura do tile (A-22 mede
        // 98–116) e diz por que não há comparação, em vez de deixar um buraco
        // que o olho lê como "ainda não carregou".
        //
        // O POR QUÊ fica no `title` (e o `cursor-help` mais o sublinhado
        // pontilhado avisam que há algo a ler ali). Sem essa dica visual, um
        // tooltip é informação que existe e ninguém encontra — a tela não pode
        // exigir que o gestor passe o mouse por sorte.
        <span
          className="mt-[13px] ml-[54px] flex cursor-help items-center self-start text-[11px] leading-[16px]"
          style={{
            color: TEXTO.mudo,
            textDecoration: "underline dotted",
            textUnderlineOffset: "3px",
            textDecorationColor: "#C9C5C0",
          }}
          title={motivoSemComparacao(metrica)}
        >
          sem comparação
        </span>
      ) : (
        <span
          className="mt-[13px] ml-[54px] flex items-center gap-[3px] text-[12px] leading-[16px] font-medium"
          style={{ color: corVariacao }}
        >
          {/* Sem direção, sem seta. Zero não sobe nem desce. */}
          {semDirecao ? null : <Seta size={13} strokeWidth={2.3} />}
          {textoVariacao}
        </span>
      )}
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
 *
 * `minmax(0, Nfr)` em vez de `Nfr` seco: uma trilha `fr` tem mínimo AUTOMÁTICO
 * de `min-content`, e como os tiles são `whitespace-nowrap` esse mínimo trava a
 * grade em 804px. Era um dos pisos que impediam a tela inteira de caber numa
 * janela menor que a referência de 1672 (ver o comentário da grade em
 * <VisaoGeralTab/>). Com o mínimo em 0, a trilha cede quando precisa, e quem
 * absorve o aperto é o rótulo do tile (`truncate`), nunca o numeral.
 *
 * REPROPORCIONADO de novo em 2026-08-17: "Regularidade" e "Sem acesso" passaram
 * a publicar o denominador (`mostrarAbsoluto`, ver placar.ts), e o conteúdo
 * mínimo dos dois muda de faixa. MEDIDO no navegador, com a fonte real, o pior
 * caso plausível ("12 de 51 · 24%", o tenant de 51 pessoas):
 *
 *   tile             mínimo antes   mínimo agora   trilha desta linha
 *   Ativos ......... 178,4          173,3          173,8
 *   Regularidade ... 145,9          165,3          165,8
 *   No ritmo ....... 128,7          123,6          123,8
 *   Participação ... 142,1          137,1          137,8
 *   Sem acesso ..... 140,7          165,3          165,8
 *   soma ........... 735,8          764,6          767 disponíveis
 *
 * (os mínimos caem 5px em todo tile por causa da folga cedida no <TilePlacar/>;
 * sobem ~25 nos dois que ganharam o absoluto.) Os pesos abaixo são proporcionais
 * a esse perfil, então CADA trilha fica acima do próprio mínimo no pior caso —
 * a fileira não estoura nem com dois dígitos dos dois lados da fração. O que se
 * perdeu foi o eco da largura relativa da referência; o que se ganhou foi o
 * denominador visível, e nenhum critério de CRITERIOS.md fixa largura de tile
 * individual (A-22 mede quantidade, altura, gap e alinhamento).
 */
const RITMO_TILES =
  "minmax(0,174fr) minmax(0,166fr) minmax(0,124fr) minmax(0,138fr) minmax(0,166fr)"

function CardPlacar({ placar }: { placar: BlocoPlacar }) {
  const situacao = situacaoDo(placar)
  return (
    // 909 → 827: ver o comentário da grade em <VisaoGeralTab/>. Com `px-[14px]`
    // sobram 799 de caixa útil; 4 vãos de 8 (A-22 aceita 8 a 16 — era 10, e os
    // 8px devolvidos entram nos dois tiles que passaram a publicar o
    // denominador) deixam 767 para os 5 tiles, contra 764,6 de conteúdo mínimo
    // medido no pior caso.
    //
    // `relative` é novo, e existe só para a nota de régua abaixo: a caixa dela é
    // `absolute` de altura zero, então ela ocupa os 17px que sobravam entre a
    // base dos tiles (y 156) e a base do card (y 185) sem empurrar nada e sem
    // mexer na altura da linha 1 (A-14 exige 185–215).
    <Card className="relative flex h-full w-[827px] min-w-0 shrink-[0.45] flex-col px-[14px] pt-[12px] pb-[12px]">
      {/* Sem subtítulo: o PNG não tem, e o PNG vence a spec (FIXTURE.md §13 D-a). */}
      <CardTitulo className="pl-[7px]">{placar.titulo}</CardTitulo>
      {situacao === "ok" ? (
        <div className="mt-[12px] grid gap-[8px]" style={{ gridTemplateColumns: RITMO_TILES }}>
          {placar.metricas.map((metrica) => (
            <TilePlacar key={metrica.id} metrica={metrica} />
          ))}
        </div>
      ) : (
        // Os 5 tiles somem INTEIROS. Um placar de cinco zeros é a afirmação mais
        // cara que esta tela poderia fazer sobre uma equipe — e é exatamente o
        // que sairia se a consulta do roster falhasse e ninguém tivesse lido o
        // `error` (I-4). Aqui a falha aparece como falha.
        <div className="pl-[7px]">
          <CorpoNaoRenderizavel bloco={placar} />
        </div>
      )}

      {/* A RÉGUA DOS INDICADORES, renderizada e nunca em `title` (I-2).
          Diz duas coisas que o rótulo sozinho esconde: o critério de
          "Regularidade" (sem ele, "0%" é indistinguível de defeito) e o fato de
          "No ritmo" e "Sem acesso" descreverem HOJE, não a janela — os dois
          ficam embaixo de um seletor de período que não os governa.
          `bottom` ancora o TOPO (caixa de altura zero): 17 = 13 da linha + 4 de
          folga real até a base do card. */}
      {situacao === "ok" && placar.notaRodape ? (
        <div className="absolute right-[14px] bottom-[17px] left-[21px]">
          <span
            className="block truncate text-[10.5px] leading-[13px]"
            style={{ color: TEXTO.mudo, letterSpacing: "-0.004em" }}
            title={placar.notaRodape}
          >
            {placar.notaRodape}
          </span>
        </div>
      ) : null}
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
function CardMudancas({ mudancas }: { mudancas: BlocoMudancas }) {
  const situacao = situacaoDo(mudancas)
  return (
    <Card className="relative h-full w-[436px] min-w-[271px] shrink-[6] grow px-[20px] pt-[12px]">
      <CardTitulo>{mudancas.titulo}</CardTitulo>

      {situacao === "ok" ? (
        <ul className="mt-[10px] flex flex-col gap-[10px]">
          {mudancas.itens.map((item) => (
            <li key={item.id} className="flex items-start gap-[17px]">
              <MarcadorMudanca item={item} />
              <p
                className="w-[196px] max-w-full text-[12.2px] leading-[15px]"
                style={{ color: TEXTO.primario, letterSpacing: "-0.004em" }}
              >
                {item.texto}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        // Este é o bloco da §32 "Tendência": sem um período anterior com que
        // comparar, a frase é "Precisamos de pelo menos dois períodos de
        // atividade para identificar uma tendência" — não três marcadores
        // apontando para zero.
        <CorpoNaoRenderizavel bloco={mudancas} />
      )}

      {/* UM link para o card inteiro, nunca um por item (C-20 / §13 D-c).
          O recuo da base caiu de 39 para 20: com o card em 170px, 39 deixaria o
          link boiando no meio da caixa em vez de ancorado no rodapé.
          ATENÇÃO ao que este número significa: a caixa é `absolute` de ALTURA
          ZERO, então `bottom-[N]` posiciona o TOPO do link, não a base dele. O
          link tem 16px, logo 20 devolve 4px de folga real até a base do card;
          um `bottom-[4px]` ingênuo faria o link vazar 12px para FORA do card. */}
      <div className="absolute right-0 bottom-[20px] left-0">
        <LinkRodape rotulo={mudancas.linkRodape} href={ROTA_TENDENCIAS} />
      </div>
    </Card>
  )
}

// ===========================================================================
// Tela
// ===========================================================================

export interface VisaoGeralTabProps {
  /**
   * A tela inteira. Com a fixture, o mesmo objeto de sempre (o contrato é
   * superconjunto dela — a prova mecânica está em
   * `lib/analytics/visao-geral/compat-fixture.ts`). Com dado real, a saída de
   * `carregarVisaoGeral`. Trocar a fonte é trocar QUEM chama, não a UI.
   */
  data: VisaoGeralDados
  /**
   * Ausente ⇒ os filtros ficam inertes. É o que a rota de preview usa: sem
   * roteador, sem sessão, screenshot determinístico.
   */
  controles?: ControlesFiltro
  /**
   * O gate de escrita, resolvido NO SERVIDOR e passado para cá. Desligado por
   * padrão porque este repositório aponta para o Supabase de produção. Ver
   * `acoes.tsx`.
   */
  acionamentoAtivo?: boolean
  /**
   * Ausente ⇒ a barra de abas fica inerte (`<span>`), que é o comportamento
   * anterior e o que o harness de preview precisa. Presente ⇒ cada rótulo vira
   * link que troca `?tab=` preservando os demais filtros da URL.
   */
  destinoAbas?: DestinoAbas
}

/**
 * `alunoId` → nome e `alunoId` → `nudgeType`, derivados do ROSTER do próprio
 * contrato.
 *
 * Os dois existem para a confirmação de envio poder dizer *para quem* e *o quê*
 * sem que a UI reinvente triagem: `Aluno.estado` já é a projeção §4 calculada
 * pela camada de dados. "Nunca iniciou" pede o texto de primeiro acesso
 * (`never_accessed`); todo o resto é retomada (`inactive`).
 */
function indicesDoRoster(roster: VisaoGeralDados["roster"]): {
  nomePorAluno: Record<string, string>
  tipoPorAluno: Record<string, NudgeType>
} {
  const nomePorAluno: Record<string, string> = {}
  const tipoPorAluno: Record<string, NudgeType> = {}
  for (const aluno of roster) {
    nomePorAluno[aluno.id] = aluno.nome
    tipoPorAluno[aluno.id] = aluno.estado === "nao-iniciou" ? "never_accessed" : "inactive"
  }
  return { nomePorAluno, tipoPorAluno }
}

export function VisaoGeralTab({
  data,
  controles,
  acionamentoAtivo = false,
  destinoAbas,
}: VisaoGeralTabProps) {
  // `sidebar` e `chipsFiltro` continuam na fixture (conformidade com
  // FIXTURE.md) e deliberadamente NÃO são lidos aqui: a barra vem do shell real
  // e os filtros vêm de <FiltrosEscopo/>, que usa os controles da Academy.
  const { cabecalho, abas, placar, mudancas, atencao, recomendacoes, resposta, sinais } = data

  const Relogio = GLIFO[cabecalho.atualizadoIcone] ?? Clock
  const { nomePorAluno, tipoPorAluno } = indicesDoRoster(data.roster)

  // FALHA DE TOPO. A camada de dados marca a tela inteira como `erro` quando é o
  // ROSTER que não pôde ser lido — e sem universo todo denominador desta tela é
  // chute. Falha PARCIAL não passa por aqui: ela deixa a tela em `ok` e só o
  // bloco afetado em `erro`, que é o ponto de haver estado por bloco.
  if (data.estado === "erro") {
    return (
      <div className="pt-0 pr-[16px] pl-[31px] 2xl:pr-[56px]" style={{ color: TEXTO.primario }}>
        <h1
          className="text-[33px] leading-[36px] font-bold"
          style={{ color: TEXTO.primario, letterSpacing: "-0.021em", wordSpacing: "2px" }}
        >
          {cabecalho.titulo}
        </h1>
        <Card className="mt-[16px] w-[827px] px-[20px] pt-[14px] pb-[18px]">
          <CardTitulo>Não foi possível carregar esta tela</CardTitulo>
          <FalhaDoBloco bloco={{ estado: "erro", erro: data.erro }} />
        </Card>
      </div>
    )
  }

  return (
    // A raiz é o CONTEÚDO: este componente já nasce dentro do `<main>` do shell,
    // que é quem dá largura, fundo e rolagem. Os recuos abaixo são os do
    // conteúdo em relação a essa caixa, não em relação ao canvas.
    // COMPRESSÃO VERTICAL. A caixa útil do <main> tem 821px e o conteúdo já
    // ocupou 992 — 171px de estouro, invisível na foto porque a barra de
    // rolagem deste navegador é OVERLAY.
    // O recuo superior vai a ZERO: é o primeiro lugar a ceder porque não
    // carrega informação nenhuma, e o `<main>` já dá 24px de padding acima. São
    // 12px devolvidos, a maior parcela da compressão desta rodada.
    <div className="pt-0 pr-[16px] pl-[31px] 2xl:pr-[56px]" style={{ color: TEXTO.primario }}>
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

        {/* Os SELETORES DE CONTEXTO e o carimbo dividem UMA fileira só,
            ancorada à direita.

            OS CONTROLES SÃO OS NATIVOS DA ACADEMY, não os 3 chips do mockup.
            A rodada anterior tinha trocado <FiltrosEscopo/> por três chips
            desenhados à mão, para agradar A-17 / C-05 / B-14 — e ao fazer isso
            desfez uma decisão explícita do dono do produto. CRITERIOS.md "NÃO É
            CRITÉRIO" item 0 foi estendido em 2026-08-16 exatamente por isso: os
            seletores de contexto permanecem como já são na Academy (`ScopeBar`
            com segmentado de período e pílula de curso), e a diferença de forma
            para o mockup NÃO gera FAIL. O chip "Meu time" vive no
            `ContextSwitcher` real, no cabeçalho do shell.

            POR QUE ELES ENTRAM NESTA FILEIRA, e não numa bandeja abaixo (que é
            onde `analytics-dashboard.tsx` os põe): é altura. A `ScopeBar` mede
            64px; numa faixa própria ela custaria 64 + o vão acima, e a dobra de
            821px não comporta isso com A-14 (185/335/155) intacto. Compartilhando
            a fileira com o par título + subtítulo (60px), ela custa apenas os
            4px em que é mais alta que ele. Essa é a maior economia da rodada.

            `items-center` mantém os controles e o carimbo na MESMA linha de
            centro, seja qual for a altura de cada um. */}
        <div className="flex items-center gap-[24px]">
          <FiltrosEscopo controles={controles} />
          {/* Carimbo de frescor: sem caixa, sem borda (A-18).
              A fileira inteira é ancorada à DIREITA, então a largura deste
              carimbo é o que fixa o recuo. Medido: a tinta de "Atualizado há 2h"
              ocupa 100px na referência (x 1504‥1603) contra 116px a 15px, e o
              relógio 14px contra 15. A 13px o carimbo volta a 123px de tinta e o
              recuo à direita fecha em 91, dentro dos 83–101 de A-18. */}
          <span
            className="flex items-center gap-[9px] text-[13px] leading-[22px] whitespace-nowrap"
            style={{ color: TEXTO.mudo, letterSpacing: "-0.002em" }}
          >
            <Relogio size={14} strokeWidth={2.2} />
            {cabecalho.atualizadoLabel}
          </span>
        </div>
      </header>

      {/* Abas. A barra mudou de casa (`nav-abas.tsx`) porque as outras duas
          abas da trinca ganharam tela própria e precisam da MESMA barra; as
          medidas calibradas foram junto, inteiras, e estão documentadas lá.

          SEM `destinoAbas` a barra continua inerte, `<span>` por `<span>`, que
          é o que o harness de preview precisa. COM ele, cada rótulo vira link
          que preserva `?periodo=`, `?curso=` e `?escopo=` (spec §3.4). */}
      <NavAbas abas={abas} destino={destinoAbas} />

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
          referência.

          ═══ A GRADE PASSA A CEDER (2026-08-16) ════════════════════════════
          DEFEITO MEDIDO, relatado pelo dono do produto com a tela aberta em
          /analytics: barra de rolagem horizontal e os CTAs de "O que fazer
          agora" cortados pela metade na borda direita.

          A causa NÃO era o texto real ser maior que o da fixture (essa era a
          hipótese; a medição a derrubou). Era esta grade valer 1277px FIXOS —
          `w-[827px] shrink-0` de um lado, `flex-1` com `min-width: auto` do
          outro, ou seja NENHUM dos dois capaz de encolher. Somados os 87px de
          recuo lateral e os 48 do `<main>`, a tela só cabia inteira a partir de
          ~1672px de janela, que é a largura do PNG de referência. Medido com a
          própria fixture, neutralizando o pin de 1672 do harness:

            janela 1672 → estouro   0px · CTAs 96/96 · 103/103 · 96/96
            janela 1600 → estouro   0px · CTAs inteiros
            janela 1512 → estouro  58px · CTAs 57/96 · 60/103 · 57/96  ← a foto
            janela 1440 → estouro 130px · CTAs 0/96 (fora da área visível)
            janela 1280 → estouro 290px

          1512×982 é a resolução default do MacBook Pro 16", e "57 de 96px
          visíveis" é literalmente o botão pela metade da captura. A rolagem era
          invisível porque a barra do Chromium é OVERLAY — o mesmo cegamento que
          o `gauntlet-shot` já instrumenta na vertical.

          A CORREÇÃO é deixar a grade ceder, na ordem certa, sem cortar nada:
            1. cada card mantém a largura medida como BASE (`w-[Npx]`), mas
               ganha `min-w-0` e um peso de encolhimento proporcional à FOLGA
               que ele tem, não ao tamanho dele. Quem tem gordura cede primeiro:
                 "O que mudou" e "Sinais" (texto que reflui) .... shrink 6
                 "Quem precisa da minha atenção" (tabela folgada) shrink 3
                 "O que fazer agora" (badge+texto+CTA) .......... shrink 1
                 "Placar" (5 tiles quase sem folga) ............. shrink 0,45
                 "Resposta" (3 estatísticas rígidas) ............ shrink 0,3
            2. as caixas internas de largura fixa deixam de ser piso: as trilhas
               do placar e da tabela viram `minmax(0, Nfr)`, e as caixas de 760
               e 787px ganham `max-w-full`;
            3. o CTA de recomendação é o ÚNICO elemento com `shrink-0` — ele
               nunca cede, com 10px de folga garantida de cada lado (D-15). O
               que encolhe ao lado dele é a caixa de texto;
            4. o recuo direito da coluna é 56px só a partir de `2xl` (≥1536),
               a mesma condição em que a referência de 1672 vive.

          Nas larguras ≥1672 NADA muda: os pesos só entram em ação quando falta
          espaço, e a foto do gauntlet continua 827+14+436 / 624+13+640.
          Medido depois: estouro 0 e CTAs inteiros de 1280 a 1672; nenhum texto
          truncado até 1512. Abaixo de ~1200 a grade chega ao piso real do
          conteúdo (o card "O que mudou" trava em `min-w-[271px]`) e volta a
          estourar — de propósito: aí o estouro é VISÍVEL e mensurável, que é
          melhor que clipar em silêncio. */}
      {/* O <ProvedorAcoes/> envolve SÓ a grade, e não o cabeçalho: nada acima
          escreve em banco. Ele é quem guarda o gate e a caixa de confirmação
          que os botões de "Reativar"/"Apoiar"/"Reconhecer" abrem. */}
      <ProvedorAcoes ativo={acionamentoAtivo}>
        <div className="mt-[2px] flex flex-col">
          <div className="flex h-[185px] gap-[14px]">
            <CardPlacar placar={placar} />
            <CardMudancas mudancas={mudancas} />
          </div>
          {/* Vãos entre linhas de volta a 10, o PISO de A-12 (10 a 20). São 4px
            devolvidos, e é o último px que a grade tem para dar: as três alturas
            já estão no piso de A-14 (185 / 335 / 155). */}
          <div className="mt-[10px] flex h-[335px] gap-[14px]">
            <CardAtencao atencao={atencao} tipoPorAluno={tipoPorAluno} />
            <CardRecomendacoes recomendacoes={recomendacoes} nomePorAluno={nomePorAluno} />
          </div>
          <div className="mt-[10px] flex h-[155px] gap-[13px]">
            <CardResposta resposta={resposta} />
            <CardSinais sinais={sinais} />
          </div>
        </div>
      </ProvedorAcoes>
    </div>
  )
}
