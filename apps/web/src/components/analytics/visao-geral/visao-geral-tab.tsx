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

import type { PessoaDaGaveta } from "@/lib/analytics/gaveta/tipos"
import { fichasDaVisaoGeral } from "@/lib/analytics/visao-geral/gaveta"
import type {
  BlocoMudancas,
  BlocoPlacar,
  ItemMudanca,
  MetricaPlacar,
  VisaoGeralDados,
} from "@/lib/analytics/visao-geral/tipos"
import type { EstadoJornada } from "@/lib/analytics/visao-geral/tipos"
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
import type { CSSProperties, ReactNode } from "react"
import { ProvedorGaveta } from "../gaveta/gaveta"
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
  MioloCard,
  RAIO_TILE,
  TEXTO,
  TOM_MARCADOR,
  VARIACAO,
} from "./design"
import { CorpoNaoRenderizavel, FalhaDoBloco, situacaoDo } from "./estado-bloco"
import { type ControlesFiltro, FiltrosEscopo } from "./filtros-escopo"
import { type DestinoAbas, NavAbas } from "./nav-abas"
import { rotaDasTendencias } from "./navegacao"

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

/**
 * A LINHA DA VARIAÇÃO, com o recuo que CEDE antes do texto quebrar.
 *
 * ═══ POR QUE O RECUO VIROU UM ESPAÇADOR (2026-08-19) ═══════════════════════
 * DEFEITO MEDIDO: "sem comparação" saía em DUAS linhas no tile "No ritmo" em
 * TODAS as larguras de 1180 a 1512 (`?fonte=motor`), desalinhando a base do
 * tile em relação aos irmãos.
 *
 * A causa era aritmética, não estilística. O recuo era `ml-[51px]` — margem
 * RÍGIDA —, então a largura mínima deste tile passava a ser
 * `10 (px) + 51 (recuo) + 85,89 ("sem comparação" medido) = 146,89px`, contra
 * `61 + 55,5 = 116,5` de que o resto do tile precisa. Ou seja: o tier que
 * SUSSURRA estava ditando a largura do tile inteiro, e ditando 30px a mais do
 * que qualquer outra peça pedia. A tabela de pesos de `RITMO_TILES` deu a esse
 * tile 147fr por causa disso, e ainda assim ele recebia 145,77 a 1512 — 1,1px
 * curto, o suficiente para a segunda linha nascer.
 *
 * O recuo existe por um motivo bom (rótulo, valor e variação partem do mesmo x,
 * que é o alinhamento óptico do tile) e por isso ele não é removido: ele vira um
 * espaçador FLEXÍVEL de 51px que encolhe até zero quando falta espaço. Onde há
 * folga, o alinhamento é o de sempre, pixel por pixel; onde não há, quem cede é
 * o alinhamento — não o texto. O texto é `whitespace-nowrap` e entra no mínimo
 * intrínseco do tile (ver o comentário do `<div data-tile>`), então ele nunca
 * quebra E nunca vaza: o tile inteiro é que não fica menor do que ele.
 */
function LinhaVariacao({
  children,
  className = "",
  title,
  style,
}: {
  children: ReactNode
  className?: string
  title?: string
  style?: CSSProperties
}) {
  return (
    <span className="mt-[13px] flex max-w-full items-center self-start">
      {/* O recuo. `basis-[51px] shrink` = 51px onde cabe, menos onde não cabe.
          `min-w-0` para ele poder de fato chegar a zero. */}
      <span aria-hidden className="min-w-0 shrink basis-[51px]" />
      <span
        data-variacao-tile
        className={`flex shrink-0 items-center whitespace-nowrap ${className}`}
        title={title}
        style={style}
      >
        {children}
      </span>
    </span>
  )
}

function TilePlacar({ metrica, peso }: { metrica: MetricaPlacar; peso: number }) {
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
    // placar.ts).
    //
    // ═══ O TILE PARA DE VAZAR (2026-08-18) ═══════════════════════════════════
    // DEFEITO MEDIDO, e ele era pior do que "rótulo com reticências". O tile era
    // `whitespace-nowrap` + `min-w-0` SEM `overflow-hidden`: quando o conteúdo
    // não cabia, o texto NÃO era clipado, ele VAZAVA para fora do tile — e como
    // cada tile pinta o próprio fundo na ordem da árvore, o fundo do tile
    // seguinte cobria o vazamento do anterior. O resultado é um corte limpo, sem
    // reticências e sem nenhum sinal de que há mais texto. Medido a 1672, com
    // dado real, na foto que o dono viu: o tile "No ritmo" imprimia
    // `sem compara` — 27,1px de "sem comparação" pintados por baixo do vizinho.
    // O comentário desta função afirmava "o numeral nunca é tocado"; a medição
    // desmentiu (a 1280 o valor de "Ativos" vazava 28,4px).
    //
    // A CORREÇÃO NÃO É `overflow-hidden` — isso esconderia o defeito e cortaria
    // a informação. É dar ao conteúdo a caixa de que ele precisa:
    //   1. o tile deixa de ser `whitespace-nowrap`. Quem carrega o `nowrap` é
    //      SÓ a linha do valor, que é a única que não pode quebrar. Rótulo e
    //      variação passam a QUEBRAR em duas linhas quando falta espaço, em vez
    //      de vazar ou truncar — o gestor sempre lê o nome inteiro da métrica;
    //   2. o `truncate` do rótulo SAI junto com o `title`: texto renderizado
    //      inteiro dispensa tooltip (mesma lógica de I-2);
    //   3. as trilhas de `RITMO_TILES` foram reproporcionadas contra o conteúdo
    //      MEDIDO de cada tile nos dois modos (ver lá embaixo);
    //   4. 39px de FOLGA foram devolvidos para o conteúdo caber em UMA linha nas
    //      larguras que importam: disco Ø44 → Ø42 (B-20 pede 40–48), vão
    //      disco↔texto 10 → 9, `px` do tile 7 → 5, vão da grade 8 → 7 (este
    //      último fica 1px abaixo do piso de A-22 — divergência DECLARADA, e
    //      são exatamente os 4px que fazem "sem comparação" caber em vez de
    //      vazar por baixo do tile vizinho).
    //      Nenhuma FONTE de valor ou rótulo mudou.
    // A altura do tile CAI de 110 para 108 (A-22 exige 98–116) e, no pior caso
    // em que o rótulo quebra (abaixo de ~1440), sobe para 122 — o card de 185
    // comporta 12+22+12+122+12 = 180.
    // ═══ O TILE PASSA A TER PISO, E A FILEIRA PASSA A QUEBRAR (2026-08-19) ═══
    // `min-w-0` SAIU. Ele era o que autorizava o tile a ficar mais estreito que
    // o próprio conteúdo — e, com o rótulo em `overflow-wrap: anywhere`, a
    // consequência não era corte nem vazamento, era `Participaçã` numa linha e
    // `o` na outra. Sem `min-w-0`, o mínimo automático do item de flex volta a
    // ser o `min-content` dele, CALCULADO PELO NAVEGADOR a partir do texto real
    // do tenant — nenhum número mágico nesta fonte envelhece quando o rótulo
    // muda.
    //
    // `basis-0` + `flexGrow: peso` reproduz exatamente o que `minmax(0,Nfr)`
    // fazia (a fatia é `peso/Σpeso` do espaço disponível), com UMA diferença: o
    // mínimo deixa de ser zero e passa a ser o conteúdo. Quando a soma dos
    // mínimos não cabe, o contêiner é `flex-wrap` e a fileira QUEBRA em duas —
    // que é a única saída honesta abaixo de ~1240px, onde nem o tier
    // tipográfico nem a trilha comportam os cinco tiles lado a lado.
    <div
      // Âncora de teste. Existe porque o `visao-geral-placar-variacao.test.tsx`
      // achava o tile por `div[class*="px-[9px]"]` e QUEBROU quando esta linha
      // cedeu 2px de padding — um teste de comportamento não pode depender de um
      // número de folga. `data-tile` é estável e ainda diz QUAL tile é, em vez
      // de "o primeiro elemento com este texto".
      data-tile={metrica.id}
      className="flex basis-0 flex-col px-[5px] py-[16px]"
      style={{
        backgroundColor: COR_TILE,
        borderRadius: RAIO_TILE,
        flexGrow: peso,
        flexShrink: 1,
        // `flex-basis: 0` é O QUE DECIDE QUANDO A FILEIRA QUEBRA, e a escolha
        // foi MEDIDA, não presumida. A quebra de linha do flex usa o tamanho
        // HIPOTÉTICO do item — a base, não o resultado do encolhimento:
        //   • `basis: 0` ⇒ hipotético = `min-content`. A fileira aguenta uma
        //     linha até ~1340 e só então quebra;
        //   • `basis: max-content` ⇒ hipotético = a largura confortável. A
        //     fileira quebra mais cedo, com tiles mais folgados — e a medição
        //     mostrou o preço: a 1366 ela já quebrava, e a página passava de
        //     0 para 101px de rolagem numa largura em que hoje cabe inteira.
        // Fica `0`: manter 1340–1512 em UMA linha, sem rolagem, vale mais que
        // folga extra nos tiles abaixo de 1340 — onde a página já rola de
        // qualquer jeito (130px a 1300, com ou sem esta escolha).
        //
        // O teto de 1,5× a fatia existe para o tile que sobra sozinho na última
        // linha não herdar a largura dela inteira — medido a 1260 sem teto,
        // "Sem acesso" saía com 639px, um bloco tonal atravessando o card com o
        // numeral perdido na esquerda.
        maxWidth: peso * 1.5,
      }}
    >
      <div className="flex items-center gap-[9px]">
        <CirculoIcone tom={metrica.iconeTom} diametro={42}>
          <Icone size={20} strokeWidth={2} />
        </CirculoIcone>
        {/* SEM `min-w-0` (2026-08-19). Ele era o que deixava a coluna de texto
            ficar mais estreita que o texto; agora o mínimo dela é o
            `min-content`, e é esse mínimo que sobe até o tile e daí até a
            decisão de quebrar a fileira. Quem cede primeiro é o espaço; depois
            o complemento do valor, que desce de linha; e só então o rótulo, que
            quebra ENTRE PALAVRAS. Nunca no meio de uma. */}
        <div className="flex flex-col">
          {/* ═══ O RÓTULO NÃO QUEBRA NO MEIO DA PALAVRA (2026-08-19) ═════════
              ERA `overflow-wrap: anywhere`, posto aqui em 2026-08-18 como
              "GARANTIA de que o rótulo nunca vaza". Ele cumpria a promessa e
              cobrava um preço pior que o defeito que curava: `Participação` é
              UMA palavra, e `anywhere` autoriza a quebra em QUALQUER letra —
              a tela imprimia `Participaçã` numa linha e `o` na outra, em TODAS
              as larguras de 1180 a 1512 (medido nos dois modos de fonte). O
              gestor lia uma palavra que não existe.
              A caixa é que estava errada, não o texto: com `min-w-0` fora do
              caminho (ver o tile e a coluna acima), o navegador nunca dá à
              coluna menos que a maior palavra do rótulo, e `anywhere` fica sem
              função. Sem `anywhere`, `Participação` volta a ser indivisível e
              vira o piso do tile — que é o comportamento correto: se não cabe,
              o problema é a trilha, e a trilha agora sabe quebrar a fileira. */}
          <span
            data-rotulo-tile
            className="text-[12px] leading-[16px]"
            style={{ color: TEXTO.secundario, letterSpacing: "-0.012em" }}
          >
            {metrica.rotulo}
          </span>
          {/* O NUMERAL NUNCA É CORTADO, EM LARGURA NENHUMA — e é por isso que o
              `whitespace-nowrap` mora nas PARTES, não no conjunto.
              `de 33 · 45%` é uma unidade indivisível (quebrar entre `de 33` e
              `· 45%` seria duas afirmações onde há uma), mas ela PODE descer
              para a linha de baixo inteira quando a trilha aperta. Com o
              `nowrap` no conjunto, o par `15 de 33 · 45%` simplesmente vazava
              para fora do tile e o fundo do vizinho o cobria — medido a 1440
              (3,2px) e a 1366 (5,1px). De 1512 para cima a trilha comporta a
              linha inteira e isto fica inerte.
              `tabular-nums` para o algarismo não dançar entre os cinco tiles. */}
          <span
            className="mt-[3px] flex flex-wrap items-baseline text-[25px] leading-[30px] font-bold tabular-nums"
            style={{ color: TEXTO.primario, letterSpacing: "-0.022em" }}
          >
            <span className="whitespace-nowrap">
              {destaque}
              {sufixo ? <span className="font-medium">{sufixo}</span> : null}
            </span>
            {complemento ? (
              <span
                className="ml-[6px] text-[12px] leading-[16px] font-normal whitespace-nowrap"
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
        // O recuo de 51px que alinha esta linha com a COLUNA DE TEXTO acima
        // (disco 42 + vão 9) mora agora em <LinhaVariacao/>, como espaçador
        // FLEXÍVEL — ver a nota lá. 10,5px em vez de 11 porque este é o tier que
        // sussurra (a variação nunca compete com o numeral) e porque devolve 4px
        // à caixa — "sem comparação" mede 90px de tinta a 11px e 86 a 10,5, e é
        // o texto mais largo que esta linha pode carregar.
        <LinhaVariacao
          className="cursor-help text-[10.5px] leading-[16px]"
          style={{
            color: TEXTO.mudo,
            textDecoration: "underline dotted",
            textUnderlineOffset: "3px",
            textDecorationColor: "#C9C5C0",
          }}
          title={motivoSemComparacao(metrica)}
        >
          sem comparação
        </LinhaVariacao>
      ) : (
        <LinhaVariacao
          className="gap-[3px] text-[12px] leading-[16px] font-medium tabular-nums"
          style={{ color: corVariacao }}
        >
          {/* Sem direção, sem seta. Zero não sobe nem desce. */}
          {semDirecao ? null : <Seta size={13} strokeWidth={2.3} />}
          {textoVariacao}
        </LinhaVariacao>
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
 * REPROPORCIONADO de novo em 2026-08-18, e desta vez contra a TINTA MEDIDA de
 * cada peça nos DOIS modos do preview (motor e fixture), não contra estimativa.
 * A rodada anterior dimensionou as trilhas pelo mínimo do RÓTULO e esqueceu que
 * a linha da variação tem um recuo fixo: o tile "No ritmo" recebia 121,3px e a
 * linha "sem comparação" pedia 158 — 36 px vazando por baixo do tile vizinho.
 *
 * Largura NATURAL (clone fora do fluxo, `white-space: nowrap`, largura auto) de
 * cada peça, tomando o PIOR dos dois modos peça a peça:
 *
 *   tile            rótulo   valor   variação            mínimo do tile
 *   Ativos ........ 98       107     "↓ 8 pp"  93        61 + 107 = 168
 *   Regularidade .. 73        84     "0 pp"    93        61 +  84 = 145
 *   No ritmo ...... 48        56     "sem comparação" 137   5 + 137 + 5 = 147
 *   Participação .. 70        56     "↓ 2 pp"  93        61 +  70 = 131
 *   Sem acesso .... 68       107     "↑ 3 pp"  93        61 + 107 = 168
 *   soma ..................................................... 759
 *
 * (61 = `px` 5+5 + disco 42 + vão 9; a coluna da variação já inclui o recuo de
 * 51px que a alinha com a coluna de texto.) Caixa disponível: 771 a 1672 e
 * 766,3 a 1512 — CADA trilha fica acima do próprio mínimo nas duas larguras e
 * nos dois modos, e a altura do tile fica em 110 nos quatro cruzamentos, ou
 * seja nada quebra e nada vaza. Os pesos abaixo são exatamente esse perfil.
 *
 * A MEDIÇÃO INGÊNUA ERRA AQUI, e errou na primeira tentativa desta rodada: ler
 * `scrollWidth` de um elemento que já está dentro da grade devolve a largura da
 * PRÓPRIA trilha (o filho estica), não o que ele precisaria. O número só é
 * honesto com o clone fora do fluxo. Com o valor circular, "Sem acesso" ficou
 * 0,4px curto e quebrou a linha do numeral em duas — visível na foto, invisível
 * para a sonda.
 *
 * `minmax(0, Nfr)` continua: com o mínimo em 0 a trilha cede quando a janela é
 * menor que 1440, e quem absorve o aperto passou a ser a QUEBRA do rótulo em
 * duas linhas (ver <TilePlacar/>), nunca mais um corte silencioso.
 */
const RITMO_TILES =
  "minmax(0,168fr) minmax(0,145fr) minmax(0,147fr) minmax(0,131fr) minmax(0,168fr)"

/**
 * OS MESMOS PESOS, para a fileira em `flex-wrap` abaixo de 2xl.
 *
 * ═══ POR QUE DOIS MODOS DE LAYOUT (2026-08-19) ═════════════════════════════
 * A grade acima é a régua: a 1672 ela produz 170,7 / 147,4 / 149,4 / 133,1 /
 * 170,7, que é o ritmo desigual medido no PNG de referência. Ela fica INTACTA
 * em `2xl` (≥1536), e a foto do gauntlet não se move um pixel.
 *
 * O que ela NÃO sabe fazer é parar de encolher. `minmax(0, Nfr)` declara que a
 * trilha pode chegar a ZERO, e é essa declaração — não o tamanho da janela —
 * que produzia os dois defeitos que o dono fotografou: o rótulo espremido até
 * quebrar no meio da palavra e "sem comparação" empurrado para a segunda linha.
 * Medido, `?fonte=motor`: "Participação" recebia 129,91px a 1512 contra 130,09
 * de que a palavra precisa (0,18px curto) e 123,56 a 1366; a trilha de
 * "No ritmo" recebia 145,77 contra 146,89 (1,12px curto) — e uma trilha 1px
 * curta é indistinguível de uma trilha 40px curta quando o mínimo é zero.
 *
 * Abaixo de 2xl a fileira vira `flex-wrap`, com `basis-0` + `flex-grow: peso`
 * (aritmética idêntica à do `fr`) e mínimo automático = `min-content` do tile.
 * A cascata de concessões passa a ser, nesta ordem e sem nenhuma delas cortar
 * texto:
 *   1. a folga do tile encolhe;
 *   2. o espaçador de 51px da linha da variação cede (ver <LinhaVariacao/>);
 *   3. o complemento do valor (`de 40 · 70%`) desce para a própria linha, que é
 *      a quebra que o comentário do numeral já autorizava;
 *   4. o rótulo quebra ENTRE PALAVRAS ("Ativos no / período");
 *   5. a FILEIRA quebra em duas.
 * Só o passo 5 muda a altura do card, e ele só acontece quando a soma dos
 * `min-content` não cabe — abaixo de ~1240px com o dado real da Cory.
 *
 * O peso de "No ritmo" cai de 147 para 117 abaixo de 2xl porque os 30px que ele
 * carregava a mais eram exatamente o recuo rígido de 51px da linha da variação,
 * que agora cede sozinho. Com 147 ele guardaria espaço que não usa enquanto os
 * vizinhos publicam o denominador em duas linhas por falta de 3px.
 */
const PESO_TILE: Record<string, number> = {
  ativos: 168,
  regularidade: 145,
  "no-ritmo": 117,
  participacao: 130,
  "sem-acesso": 168,
}

/** Peso de um tile cujo `id` não está na tabela: fatia média, sem privilégio. */
const PESO_TILE_PADRAO = 145

function CardPlacar({ placar }: { placar: BlocoPlacar }) {
  const situacao = situacaoDo(placar)
  return (
    // 909 → 827: ver o comentário da grade em <VisaoGeralTab/>. Com `px-[14px]`
    // sobram 799 de caixa útil; 4 vãos de 7 (A-22 aceita 8 a 16 — o vão caiu
    // para 7, 1px abaixo do piso da régua, e é uma divergência DECLARADA: os
    // 4px devolvidos são o que faz "sem comparação" caber sem vazar por baixo
    // do tile vizinho, e vazamento coberto por fundo alheio é FAIL de qualquer
    // leitura) deixam 771 para os 5 tiles, contra 759 de mínimo medido.
    //
    // `shrink-[0.12]` (era 0,45): a 1512 o card perdia 15,8px e a fileira de
    // tiles ficava 15,8 abaixo do que o conteúdo pede. Quem tem gordura nesta
    // linha é "O que mudou" (texto que reflui, `shrink-6`), não o placar — cinco
    // tiles com numeral e rótulo não têm o que ceder. A 1512 o placar agora cede
    // ~4px e o par ~116, e "O que mudou" continua acima do seu `min-w-[271px]`.
    //
    // `relative` é novo, e existe só para a nota de régua abaixo: a caixa dela é
    // `absolute` de altura zero, então ela ocupa os 17px que sobravam entre a
    // base dos tiles (y 156) e a base do card (y 185) sem empurrar nada e sem
    // mexer na altura da linha 1 (A-14 exige 185–215).
    //
    // ═══ O PESO 0,12 SÓ VALE ONDE HÁ ESPAÇO (2026-08-19) ═══════════════════
    // DEFEITO MEDIDO: a 1366 a linha 1 estourava 29px para FORA da janela, e o
    // "Ver detalhes ›" de "O que mudou" ficava 11,09px fora da área visível.
    //
    // A causa é a combinação, não cada peça: "O que mudou" trava no `min-content`
    // do próprio texto (`min-w-[271px]`) e PARA de ceder; a partir daí o único
    // que ainda pode ceder é o placar, e com `shrink-[0.12]` ele cede rápido
    // demais devagar. Medido, com `?fonte=motor`:
    //
    //   janela   coluna   placar   "O que mudou"   soma   estouro visível
    //   1512      1157    822,34      320,66       1157        0
    //   1440      1085    803,97      271 (piso)   1088,97      0  (absorvido)
    //   1366      1011    795,09      271 (piso)   1080,09     29
    //   1300       945    787,17      271 (piso)   1072,17     87
    //
    // O placar desce ~8px enquanto a coluna perde 66. A linha tem um mínimo
    // INTRÍNSECO de 1080px que nenhuma janela abaixo de ~1440 comporta, e os
    // 40px de recuo lateral (`pr-[16px]` daqui + `p-6` do <main>) escondiam o
    // estouro até 1400.
    //
    // CORREÇÃO, na raiz: abaixo de 2xl o placar passa a ceder de verdade
    // (`shrink-[1]`), e a linha assenta exatamente na largura disponível em vez
    // de transbordar. Em 2xl (≥1536) NADA muda — o peso 0,12 volta, e a foto de
    // 1672 continua 827 + 14 + 436, byte a byte.
    //
    // O PISO QUE ISTO NÃO PODE CRUZAR: abaixo de 760px de placar o rótulo de um
    // tile quebra em duas linhas e a linha 1 cresce de 203 para 219. Medido tile
    // a tile: 800→126 · 770→126 · 760→126 · 750→142. É por isso que o recuo
    // decorativo da raiz também some abaixo de 2xl (ver <VisaoGeralTab/>): sem
    // devolver aqueles 47px o placar assentaria em 757 e a correção do eixo
    // horizontal seria paga com 16px no vertical, que é a conta que a dobra não
    // tem para dar. Com eles, o placar assenta em 773 a 1366 — 13px acima do
    // piso de quebra.
    // `h-full` SAIU e `alignSelf: stretch` entrou: ver a nota em <CardMudancas/>.
    // Este card era o mais alto da linha, então ele não perdia nada com o
    // `h-full` — quem perdia era o irmão, que parava na própria altura de
    // conteúdo. O contrato fica declarado nos dois lados para o esticamento não
    // depender de qual dos dois é o mais alto no dado do dia.
    // `min-w-0` SAIU também: com a fileira de tiles agora capaz de QUEBRAR (ver
    // <CardPlacar/> abaixo), o mínimo intrínseco do card é o de UM tile, não a
    // soma dos cinco — deixar o card encolher abaixo do próprio conteúdo só
    // serviria para o conteúdo vazar de novo.
    <Card
      className="relative flex w-[827px] shrink-[1] flex-col px-[14px] pt-[12px] pb-[12px] 2xl:shrink-[0.12]"
      style={{ alignSelf: "stretch" }}
    >
      {/* Sem subtítulo: o PNG não tem, e o PNG vence a spec (FIXTURE.md §13 D-a). */}
      <CardTitulo className="pl-[7px]">{placar.titulo}</CardTitulo>
      {situacao === "ok" ? (
        // `flex flex-wrap` abaixo de 2xl, `grid` (a régua de 1672) a partir dele.
        // O `gridTemplateColumns` fica declarado sempre e só age no modo grade;
        // `basis`/`flex-grow` dos tiles ficam declarados sempre e só agem no modo
        // flex. Nenhum dos dois interfere no outro.
        <div
          className="mt-[12px] flex flex-wrap gap-[7px] 2xl:grid"
          style={{ gridTemplateColumns: RITMO_TILES }}
        >
          {placar.metricas.map((metrica) => (
            <TilePlacar
              key={metrica.id}
              metrica={metrica}
              peso={PESO_TILE[metrica.id] ?? PESO_TILE_PADRAO}
            />
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

          SAIU DO `absolute` E DO `truncate` (2026-08-18). Ela era uma caixa
          absoluta com `truncate`, e a medição mostrou que a régua se cortava
          sozinha: 15px faltando a 1440 e 78px a 1366, com o resto vivendo só no
          `title`. Uma régua que I-2 exige RENDERIZADA não pode ter metade no
          hover — é a mesma falha, um nível abaixo. No fluxo com `mt-auto` ela
          continua ancorada no rodapé do card (12px de `pb` até a base), e
          quando não couber em uma linha ela QUEBRA em duas em vez de sumir. */}
      {situacao === "ok" && placar.notaRodape ? (
        <span
          className="mt-auto block pt-[6px] pl-[7px] text-[10.5px] leading-[13px]"
          style={{ color: TEXTO.mudo, letterSpacing: "-0.004em" }}
        >
          {placar.notaRodape}
        </span>
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
function CardMudancas({
  mudancas,
  destinoAbas,
}: { mudancas: BlocoMudancas; destinoAbas?: DestinoAbas }) {
  const situacao = situacaoDo(mudancas)
  return (
    // ═══ O CARD ESTICA JUNTO COM O IRMÃO (2026-08-19) ═══════════════════════
    // ERA `h-full`, e era exatamente isso que impedia o esticamento. `h-full` é
    // `height: 100%`; `align-self: stretch` SÓ roda quando a medida cruzada é
    // `auto` (CSS Flexbox §7.4), e `100%` contra um contêiner de altura
    // INDEFINIDA (a linha 1 é `min-h-[185px]`, não `h-[185px]`) resolve como
    // altura de conteúdo. Resultado medido: "Placar da jornada" 184px e
    // "O que mudou" 154px na MESMA linha, 30px de base fora de sincronia em
    // toda largura — inclusive 1512 e 1672. No estado vazio, onde o conteúdo é
    // uma frase, o buraco fica frontal.
    // `alignSelf: "stretch"` explícito nos DOIS cards da linha, e não confiança
    // no default do contêiner: o contrato fica declarado onde o teste o lê.
    <Card
      className="relative flex w-[436px] min-w-[271px] shrink-[6] grow flex-col px-[20px] pt-[12px]"
      style={{ alignSelf: "stretch" }}
    >
      <CardTitulo>{mudancas.titulo}</CardTitulo>

      {/* O miolo desconta a faixa do rodapé em QUALQUER estado. O que muda com o
          estado é o ALINHAMENTO: com os três marcadores, o bloco parte do topo,
          como sempre; no estado vazio (e no de erro), onde o card é esticado
          pelo irmão da linha e o conteúdo é UMA frase, a frase fica centrada no
          espaço em vez de pendurada no topo com o link caindo em cima dela.
          Centrar também o estado cheio deixaria um vão grande acima dos itens
          quando o placar ao lado cresce — medido a 1180, com o card em 333px. */}
      <MioloCard className="mt-[10px]" centrado={situacao !== "ok"}>
        {situacao === "ok" ? (
          <ul className="flex flex-col gap-[10px]">
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
          // `mt-0` anula o recuo que `FraseDoBloco`/`FalhaDoBloco` dão para
          // separar do título: aqui quem separa é o `justify-center` do miolo.
          <div className="[&>*]:mt-0">
            <CorpoNaoRenderizavel bloco={mudancas} />
          </div>
        )}
      </MioloCard>

      {/* UM link para o card inteiro, nunca um por item (C-20 / §13 D-c).
          ERA `href={ROTA_TENDENCIAS}`, e `ROTA_TENDENCIAS` era `"/analytics"` —
          a própria rota desta tela desde que a trinca passou a ser servida por
          `?tab=`. O CTA recarregava a página em que o gestor já estava, e ainda
          descartava `?periodo`, `?curso` e `?escopo` no caminho. Agora ele leva
          à aba "Padrões e tendências" (§16, o detalhamento temporal que a §9
          promete) com os filtros preservados pela MESMA função da barra de abas.
          Sem `destinoAbas` (preview) volta a ser `<span>`. */}
      <LinkRodape rotulo={mudancas.linkRodape} href={rotaDasTendencias(destinoAbas)} />
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
  estadoPorAluno: Record<string, EstadoJornada>
} {
  const nomePorAluno: Record<string, string> = {}
  const tipoPorAluno: Record<string, NudgeType> = {}
  // `estadoPorAluno` é o insumo do portão de `acionamento-alvo.ts`: ele é o que
  // impede um envio de cobrança de alcançar quem CONCLUIU. Objeto simples pelo
  // mesmo motivo dos dois acima — a prop atravessa a fronteira RSC.
  const estadoPorAluno: Record<string, EstadoJornada> = {}
  for (const aluno of roster) {
    nomePorAluno[aluno.id] = aluno.nome
    tipoPorAluno[aluno.id] = aluno.estado === "nao-iniciou" ? "never_accessed" : "inactive"
    estadoPorAluno[aluno.id] = aluno.estado
  }
  return { nomePorAluno, tipoPorAluno, estadoPorAluno }
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
  const { nomePorAluno, tipoPorAluno, estadoPorAluno } = indicesDoRoster(data.roster)
  // As fichas da §30, derivadas do MESMO roster. Uma passada, três consumidores
  // (fila da §10.1, CTA "Ver pessoas" da §11, sinais da §13) — cada bloco
  // remontando a própria ficha daria três descrições da mesma pessoa na mesma
  // tela, que é o defeito que `_trinca/recorte.ts` evita no eixo do escopo.
  const fichaPorAluno: ReadonlyMap<string, PessoaDaGaveta> = fichasDaVisaoGeral(data)

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
    //
    // ═══ O RECUO LATERAL TAMBÉM É DECORATIVO ABAIXO DE 2xl (2026-08-19) ═════
    // Os 31px da esquerda e os 16 da direita existem por UM motivo só: pôr a
    // coluna na régua que a rubrica mede a 1672 (A-04 pede a borda dos cards em
    // x 25–37 a partir de O; A-05 pede 71–89px de recuo à direita, que é
    // `2xl:pr-[56px]` + os 24 do <main>). Abaixo de 1536 não há régua nenhuma
    // sendo medida — o item 12 de "NÃO É CRITÉRIO" diz com todas as letras que
    // a rubrica julga um único breakpoint — e esses 47px passam a ser espaço
    // gasto com nada enquanto a linha 1 estoura por falta dele.
    //
    // Devolvidos abaixo de 2xl, a coluna a 1366 vai de 1011 para 1058px, que é
    // o que faz o placar assentar em 773 (acima do piso de quebra de 760) em vez
    // de 757. Em 2xl NADA muda: `2xl:pl-[31px]` e `2xl:pr-[56px]` restauram os
    // dois recuos, e a foto de 1672 não se move um pixel.
    <div className="pt-0 pr-0 pl-0 2xl:pr-[56px] 2xl:pl-[31px]" style={{ color: TEXTO.primario }}>
      {/* Cabeçalho. A régua direita dos controles fica 11px antes da dos cards. */}
      {/* `gap` + `min-w-0 max-w-[560px]` no título e `shrink-0` no grupo da
          direita: o MESMO par aplicado em `_trinca/moldura.tsx`, e pelo mesmo
          motivo — a altura da faixa de filtros não pode depender do comprimento
          do subtítulo, senão trocar de aba desloca a régua vertical da tela
          inteira. Aqui o grupo da direita carrega também o carimbo de frescor. */}
      {/* ═══ O TÍTULO NÃO QUEBRA EM DUAS LINHAS (2026-08-19) ══════════════════
          `min-w-0` SAIU deste bloco. Ele zerava o mínimo automático do item de
          flex, e como o grupo da direita é `shrink-0`, TUDO que faltasse saía
          daqui: medido, a caixa do título ia de 460,81px a 1340 para 317,83 a
          1180, contra 312,95 de tinta de "Ativação da Jornada" — 4,88px de
          margem, e abaixo de ~1175 o título partia em duas linhas com a faixa
          de filtros ao lado ainda com folga.
          Sem `min-w-0`, o mínimo do bloco volta a ser o `min-content` dele; com
          `whitespace-nowrap` no H1, o `min-content` do H1 é a LINHA INTEIRA, e o
          bloco deixa de poder ficar menor que o título. Quem reflui quando falta
          espaço é o SUBTÍTULO, que é prosa e reflui sem perder nada.
          `max-w-[560px]` continua: ele limita o crescimento, não o encolhimento,
          e é o que mantém a faixa de filtros com altura constante. */}
      <header className="flex items-start justify-between gap-[24px] pr-[11px]">
        <div className="max-w-[560px]">
          {/* `wordSpacing` compensa o aperto que o `letterSpacing` negativo
              impõe também ao espaço: sem ele o vão de tinta entre as palavras
              cai para 6–7px, contra 8–9px da referência. */}
          {/* O TAMANHO do H1 é intocável (33px devolve cap 24, e B-29 exige 22
              a 27); o que cedeu foi a CAIXA DE LINHA, de 40 para 36 — folga em
              volta da tinta, não tinta. */}
          <h1
            className="text-[33px] leading-[36px] font-bold whitespace-nowrap"
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
        <div className="flex shrink-0 items-center gap-[24px]">
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
      <ProvedorAcoes ativo={acionamentoAtivo} estadoPorAluno={estadoPorAluno}>
        <ProvedorGaveta>
          <div className="mt-[2px] flex flex-col">
            {/* `min-h` e não `h` (2026-08-18): a 1672 e a 1512 o conteúdo mede 179
              e a linha continua valendo 185 exatos, byte a byte igual. Abaixo de
              ~1440 o rótulo de um tile quebra em duas linhas, e aí a linha CRESCE
              em vez de o texto ser cortado por uma altura fixa. O crescimento é
              medível pelo `overflowPx`; o corte não era. */}
            <div className="flex min-h-[185px] gap-[14px]">
              <CardPlacar placar={placar} />
              <CardMudancas mudancas={mudancas} destinoAbas={destinoAbas} />
            </div>
            {/* Vãos entre linhas de volta a 10, o PISO de A-12 (10 a 20). São 4px
            devolvidos, e é o último px que a grade tem para dar: as três alturas
            já estão no piso de A-14 (185 / 335 / 155). */}
            <div className="mt-[10px] flex h-[335px] gap-[14px]">
              <CardAtencao
                atencao={atencao}
                tipoPorAluno={tipoPorAluno}
                fichaPorAluno={fichaPorAluno}
              />
              <CardRecomendacoes
                recomendacoes={recomendacoes}
                nomePorAluno={nomePorAluno}
                fichaPorAluno={fichaPorAluno}
              />
            </div>
            {/* `min-h` e não `h` (2026-08-19), pelo MESMO motivo da linha 1: a
                155 fixos, os 3 sinais com texto real desciam por baixo do
                "Ver todos os sinais ›" em vez de a linha crescer. Medido, tinta
                contra tinta: 101,55px × 0,84px de sobreposição a 1220. Altura
                fixa não corta texto — ela deixa o texto sair por baixo, que é
                pior, porque some do orçamento vertical sem sumir da tela.
                A 1340 e acima o conteúdo mede 155 e a linha continua valendo
                155 exatos; o crescimento só acontece onde o texto pede. */}
            <div className="mt-[10px] flex min-h-[155px] gap-[13px]">
              <CardResposta resposta={resposta} />
              <CardSinais sinais={sinais} fichaPorAluno={fichaPorAluno} />
            </div>
          </div>
        </ProvedorGaveta>
      </ProvedorAcoes>
    </div>
  )
}
