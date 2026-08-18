// ---------------------------------------------------------------------------
// Aba "Mapa da jornada" do Analytics do gestor — rodada 1 do gauntlet.
// ---------------------------------------------------------------------------
// ESTADO HONESTO DESTE ARQUIVO (2026-08-18, rodada 2): os 7 blocos estão na
// posição, na proporção e no ritmo da referência, com os DADOS REAIS da camada
// `lib/analytics/mapa-jornada` — nenhum literal de número, nenhum texto
// inventado. A tela ESTOURA A DOBRA EM 9px com o tenant Argos (`overflowPx: 9`
// no `.meta.json` do `gauntlet-shot.mjs`, nunca pelo olho: a barra de rolagem é
// overlay e uma tela cortada parece inteira na foto). Os 9px NÃO vêm do §26:
// medido na página viva, a fileira 2 tem 312px de altura, ditados pelo funil
// (312px intrínsecos), contra 97px do §26 — 215px de folga naquela coluna, que
// é o motivo de o card ter voltado sem custar um pixel de dobra.
//
// O ORÇAMENTO VERTICAL É O RECURSO ESCASSO DESTA TELA, e explica quase toda
// decisão de espaçamento abaixo. A caixa de conteúdo tem 821px; os sete blocos
// pediam 899 na primeira medição. As três alavancas usadas, nesta ordem: altura
// FIXA de linha nas três tabelas (o passo vinha do conteúdo e variava),
// enxugamento de padding de rodapé, e a régua do período movida da faixa para o
// card `Distribuição` (que também tira a faixa de duas linhas, FAIL de V-08).
// O que NÃO foi usado como alavanca: encolher a matriz abaixo do passo mínimo
// legível de V-13, nem esconder a régua de nenhum dos três textos de I-2.
//
// O QUE JÁ É DECISÃO TOMADA, e não deve regredir no loop:
//   • os três estados da célula se distinguem POR GLIFO (V-14, `design-mapa`);
//   • as três RÉGUAS da tela são texto RENDERIZADO, nunca tooltip (I-2):
//     a do cinza (F-05), a de "Chegaram" (F-22) e a do período (F-33);
//   • a lista de travados NÃO é numerada (F-34a): é fila de triagem, não pódio;
//   • todo bloco ramifica em ok/vazio/erro por `CorpoNaoRenderizavel` (I-3/I-4),
//     e um bloco em erro não publica numeral nenhum;
//   • NENHUM bloco some da tela — nem o §26, que era a exceção. §26 governa o
//     CONTEÚDO ("não inventar concentração"), §32 governa a SUPERFÍCIE ("vazio
//     se diz com texto, nunca com ausência"). Card que evapora deixa o gestor
//     sem distinguir "não há concentração" de "a consulta quebrou".
//
// A MOLDURA NÃO MORA AQUI. Barra lateral e cabeçalho de plataforma são os REAIS
// da Academy, montados pelo shell. A raiz deste componente é o CONTEÚDO: ele
// assume que já está dentro do `<main>`.
//
// Referência visual: docs/sop/runs/_referencias/academy-analytics-gestor/03-mapa-jornada.png
// Réguas: CRITERIOS-mapa.md (visual) · CONTRATO-mapa.md (funcional) · INVARIANTES.md
// ---------------------------------------------------------------------------

import {
  COR_ACAO,
  COR_TILE,
  Card,
  CardTitulo,
  CirculoIcone,
  LinkRodape,
  RAIO_TILE,
  TEXTO,
} from "@/components/analytics/visao-geral/design"
import { CorpoNaoRenderizavel, situacaoDo } from "@/components/analytics/visao-geral/estado-bloco"
import type {
  BlocoDistribuicao,
  BlocoFunil,
  BlocoGargalos,
  BlocoInsights,
  BlocoMapa,
  BlocoTravados,
  MapaJornadaDados,
} from "@/lib/analytics/mapa-jornada/tipos"
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CircleDashed,
  Filter,
  Info,
  Lightbulb,
  Loader,
  type LucideIcon,
  Pause,
  TrendingUp,
  Users,
} from "lucide-react"
import {
  AvatarPessoa,
  BadgeModulo,
  BarraProporcao,
  MarcadorCelula,
  NumeroColuna,
} from "./design-mapa"

// ===========================================================================
// Ícones — mapa `dado.icone` → glifo Lucide
// ===========================================================================

const GLIFO: Record<string, LucideIcon> = {
  check: Check,
  loader: Loader,
  pause: Pause,
  circle: CircleDashed,
  "trending-up": TrendingUp,
  "alert-circle": AlertCircle,
  "alert-triangle": AlertTriangle,
  lightbulb: Lightbulb,
}

function Glifo({ nome, tamanho = 13 }: { nome: string; tamanho?: number }) {
  const Icone = GLIFO[nome] ?? Info
  return <Icone size={tamanho} strokeWidth={2.1} />
}

// ===========================================================================
// Primitivas locais
// ===========================================================================

function Subtitulo({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mt-[3px] text-[11.5px] leading-[16px]"
      style={{ color: TEXTO.terciario, letterSpacing: "-0.004em" }}
    >
      {children}
    </p>
  )
}

/**
 * Nota de RÉGUA. Texto renderizado e permanente (I-2). Existe porque três
 * números desta tela são legítimos e indistinguíveis de defeito enquanto o
 * critério não estiver escrito na própria tela.
 */
function NotaRegua({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mt-[6px] text-[10px] leading-[14px]"
      style={{ color: TEXTO.mudo, letterSpacing: "-0.002em" }}
    >
      {children}
    </p>
  )
}

function Celula({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <td
      className={`align-middle text-[11px] leading-[16px] ${className}`}
      style={{ color: TEXTO.secundario, letterSpacing: "-0.003em" }}
    >
      {children}
    </td>
  )
}

function CabecalhoTabela({
  children,
  className = "",
}: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`pb-[5px] text-[10.5px] leading-[15px] font-semibold ${className}`}
      style={{ color: TEXTO.mudo, letterSpacing: "-0.002em" }}
    >
      {children}
    </th>
  )
}

/**
 * Régua horizontal da tabela. A do CABEÇALHO é deliberadamente mais escura que
 * as de entre linhas (V-13 exige ao menos 3 níveis de diferença): sem isso, a
 * primeira linha de dados se lê como parte do cabeçalho.
 */
const REGUA_CABECALHO = "#DCD5D0"
const REGUA_LINHA = "#F1EDEA"

/**
 * Passo vertical das 8 linhas da matriz (V-13 exige 24 a 32; a referência mede
 * 27,7). É ALTURA FIXA de linha, não padding: com padding a altura vinha do
 * conteúdo (o avatar de 18px mais o descender da caixa inline do marcador),
 * dava 35px, e 8 linhas a 35 são 64px a mais do que a dobra comporta.
 */
const PASSO_LINHA_MATRIZ = 28

/** V-27 · passo das 7 linhas do funil (faixa 18 a 28; referência 21,7). */
const PASSO_LINHA_FUNIL = 20

/** V-25 · passo das 5 linhas de travados (faixa 18 a 28; referência 21,3). */
const PASSO_LINHA_TRAVADOS = 22

// ===========================================================================
// §23 — a matriz
// ===========================================================================

function CardMapa({ bloco }: { bloco: BlocoMapa }) {
  const ok = situacaoDo(bloco) === "ok"

  return (
    <Card className="flex flex-col px-[18px] pt-[15px] pb-[14px]">
      <div className="flex items-start justify-between">
        <div>
          <CardTitulo>{bloco.titulo}</CardTitulo>
          <Subtitulo>{bloco.subtitulo}</Subtitulo>
        </div>
        <div className="flex items-center gap-[10px]">
          <span
            className="flex items-center gap-[6px] rounded-full px-[10px] py-[5px] text-[11px] font-semibold"
            style={{ backgroundColor: COR_TILE, color: TEXTO.primario }}
          >
            <Users size={12} strokeWidth={2.1} />
            {bloco.totalAlunosLabel}
          </span>
          <span
            className="flex items-center gap-[6px] rounded-full px-[10px] py-[5px] text-[11px] font-semibold"
            style={{ backgroundColor: COR_TILE, color: TEXTO.primario }}
          >
            <Filter size={12} strokeWidth={2.1} />
            {bloco.filtroRotulo}
          </span>
        </div>
      </div>

      <CorpoNaoRenderizavel bloco={bloco} />

      {ok ? (
        <>
          <table className="mt-[12px] w-full table-fixed border-collapse">
            <thead>
              {/* V-13 · a régua do cabeçalho é a MAIS ESCURA da tabela. */}
              <tr style={{ borderBottom: `1px solid ${REGUA_CABECALHO}` }}>
                <th className="w-[19%] text-left align-bottom">
                  <span
                    className="block pb-[6px] text-[10.5px] font-semibold"
                    style={{ color: TEXTO.mudo, letterSpacing: "-0.002em" }}
                  >
                    Pessoa
                  </span>
                </th>
                {/* V-11 · align-TOP: os 7 círculos compartilham o mesmo y mesmo
                    com rótulos de 1, 2 ou 3 linhas. Com align-bottom (o que
                    estava aqui) o círculo subia junto com o rótulo mais alto e
                    a fileira de numerais saía em escada. */}
                {bloco.colunas.map((coluna) => (
                  <th key={coluna.id} className="align-top">
                    <span className="flex flex-col items-center gap-[4px] px-[3px] pb-[6px]">
                      <NumeroColuna numero={coluna.numero} />
                      <span
                        className="text-center text-[9.5px] leading-[12px]"
                        style={{ color: TEXTO.secundario, letterSpacing: "-0.002em" }}
                      >
                        {coluna.titulo}
                      </span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bloco.linhas.map((linha, indice) => (
                <tr
                  key={linha.alunoId}
                  // V-13 · passo FIXO de 27px, igual em todas as linhas. A altura
                  // saía do conteúdo (35px) e estourava a dobra em 8 linhas.
                  style={{
                    height: PASSO_LINHA_MATRIZ,
                    borderTop: indice === 0 ? undefined : `1px solid ${REGUA_LINHA}`,
                  }}
                >
                  <td className="align-middle">
                    <span className="flex items-center gap-[7px]">
                      <AvatarPessoa iniciais={linha.iniciais} tom={linha.avatarTone} />
                      <span
                        className="whitespace-nowrap text-[11px] leading-[16px]"
                        style={{ color: TEXTO.secundario, letterSpacing: "-0.003em" }}
                      >
                        {linha.nome}
                      </span>
                    </span>
                  </td>
                  {linha.celulas.map((estado, i) => (
                    <td
                      // As células são posicionais: a chave é a coluna, não o estado.
                      key={bloco.colunas[i]?.id ?? `col-${i}`}
                      className="align-middle"
                    >
                      <span className="flex justify-center">
                        <MarcadorCelula estado={estado} />
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {bloco.rotuloResto ? (
            <span
              className="mt-[8px] pl-[25px] text-[10.5px] leading-[15px]"
              style={{ color: TEXTO.mudo }}
            >
              {bloco.rotuloResto}
            </span>
          ) : null}

          <div className="mt-[10px] flex items-center gap-[16px]">
            {bloco.legenda.map((item) => (
              <span key={item.estado} className="flex items-center gap-[6px]">
                <MarcadorCelula estado={item.estado} />
                <span className="text-[10.5px] leading-[15px]" style={{ color: TEXTO.secundario }}>
                  {item.rotulo}
                </span>
              </span>
            ))}
          </div>

          {/* F-05 · a régua do cinza. Renderizada, nunca tooltip. */}
          <NotaRegua>{bloco.textoRodape}</NotaRegua>
        </>
      ) : null}
    </Card>
  )
}

// ===========================================================================
// §24 — gargalos por módulo
// ===========================================================================

function CardGargalos({ bloco }: { bloco: BlocoGargalos }) {
  const ok = situacaoDo(bloco) === "ok"

  return (
    <Card className="relative flex flex-col px-[18px] pt-[14px] pb-[26px]">
      <CardTitulo>{bloco.titulo}</CardTitulo>
      <Subtitulo>{bloco.subtitulo}</Subtitulo>

      <CorpoNaoRenderizavel bloco={bloco} />

      {ok
        ? bloco.linhas.map((linha) => (
            <div key={linha.moduloId} className="mt-[9px] flex items-center gap-[9px]">
              {/* F-10 · POSIÇÃO na lista (1..5), não o número do módulo — é o
                  que a referência mostra: `1 2 3 4 5` ao lado dos módulos
                  6, 7, 5, 4 e 3. `linha.numero` continua existindo e alimenta
                  o insight F-28 ("reforços nos módulos a a b"). */}
              <BadgeModulo numero={linha.ordem} tom={linha.tom} />
              <span
                className="w-[42%] truncate text-[11px] leading-[16px]"
                style={{ color: TEXTO.secundario, letterSpacing: "-0.003em" }}
              >
                {linha.titulo}
              </span>
              <span className="flex-1">
                <BarraProporcao proporcao={linha.proporcao} tom={linha.tom} />
              </span>
              {/* V-22 · as duas grandezas têm largura FIXA e alinham à direita
                  cada uma na sua coluna. Com um `justify-end` só no grupo, o
                  numeral escorregava conforme a largura do percentual — "(8%)"
                  é mais estreito que "(20%)" — e as bordas direitas dos cinco
                  valores deixavam de alinhar. */}
              <span className="flex w-[66px] shrink-0 items-baseline gap-[5px]">
                <span
                  className="w-[22px] text-right text-[13px] font-bold leading-[16px]"
                  style={{ color: TEXTO.primario }}
                >
                  {linha.pessoas}
                </span>
                <span
                  className="w-[39px] text-right text-[10px] leading-[14px]"
                  style={{ color: TEXTO.terciario }}
                >
                  ({linha.pct}%)
                </span>
              </span>
            </div>
          ))
        : null}

      {ok && bloco.linkRodape ? (
        <span className="mt-[10px] block h-[16px]">
          <LinkRodape rotulo={bloco.linkRodape} />
        </span>
      ) : null}
    </Card>
  )
}

// ===========================================================================
// §25 — distribuição por etapa
// ===========================================================================

function CardDistribuicao({
  bloco,
  notaPeriodo,
}: { bloco: BlocoDistribuicao; notaPeriodo: string }) {
  const ok = situacaoDo(bloco) === "ok"

  return (
    <Card className="flex flex-col px-[18px] pt-[14px] pb-[14px]">
      <CardTitulo>{bloco.titulo}</CardTitulo>
      <Subtitulo>{bloco.subtitulo}</Subtitulo>

      <CorpoNaoRenderizavel bloco={bloco} />

      {ok ? (
        <div className="mt-[11px] flex gap-[8px]">
          {bloco.tiles.map((tile) => (
            <div
              // V-23 · altura 50–70 (a referência mede 61). O tile de 40px que
              // estava aqui lia-se como pílula, não como bloco de métrica.
              key={tile.id}
              className="flex min-h-[56px] flex-1 items-center gap-[8px] px-[9px] py-[9px]"
              style={{ backgroundColor: COR_TILE, borderRadius: RAIO_TILE }}
            >
              <CirculoIcone tom={tile.tom} diametro={24}>
                <Glifo nome={tile.icone} tamanho={12} />
              </CirculoIcone>
              <span className="flex min-w-0 flex-col">
                <span
                  className="truncate text-[9.5px] leading-[13px]"
                  style={{ color: TEXTO.secundario }}
                >
                  {tile.rotulo}
                </span>
                <span className="flex items-baseline gap-[4px]">
                  <span
                    className="text-[16px] font-bold leading-[21px]"
                    style={{ color: TEXTO.primario }}
                  >
                    {tile.valor}
                  </span>
                  <span className="text-[10px] leading-[14px]" style={{ color: TEXTO.terciario }}>
                    ({tile.pct}%)
                  </span>
                </span>
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {/* F-33 · a régua do PERÍODO. Mora aqui, e não na faixa de rodapé, por
          dois motivos que se somam: V-08 exige a faixa em UMA linha, e este é o
          card que afirma "onde estão as pessoas AGORA" — é exatamente a
          afirmação que a régua qualifica. Renderizada, nunca tooltip (I-2). */}
      <NotaRegua>{notaPeriodo}</NotaRegua>
    </Card>
  )
}

// ===========================================================================
// §26 — pessoas que travaram no mesmo ponto
// ===========================================================================

function CardTravados({ bloco }: { bloco: BlocoTravados }) {
  // F-21 · §26 governa o CONTEÚDO deste bloco; §32 governa a SUPERFÍCIE dele.
  // "A existência do bloco depende de haver concentração real" manda NÃO
  // INVENTAR concentração onde não há — por isso `presente:false` não publica
  // módulo âncora, nem lista, nem CTA. Não manda o card evaporar: §32 exige que
  // estado vazio se comunique com TEXTO EXPLÍCITO, nunca com ausência.
  //
  // O card SOMIA aqui, e essa era a falha. Sem ele, a linha 2 se redistribuía
  // em silêncio e o gestor ficava sem saber se não há concentração ou se a
  // consulta quebrou — o achado A-1 entrando pela porta do layout em vez da
  // porta do dado.
  //
  // O discriminante de `presente` continua vivo, só que na FRASE: `vazio` diz
  // "não há concentração" (fato sobre a equipe), `erro` diz "não foi possível
  // carregar" com o código cru ao lado (fato sobre o sistema). Quem separa os
  // dois é `CorpoNaoRenderizavel`, igual aos outros cinco blocos desta tela.
  const ok = situacaoDo(bloco) === "ok"

  return (
    <Card className="flex flex-col px-[16px] pt-[14px] pb-[12px]">
      <CardTitulo>{bloco.titulo}</CardTitulo>
      <Subtitulo>{bloco.subtitulo}</Subtitulo>

      <CorpoNaoRenderizavel bloco={bloco} />

      {ok ? (
        <>
          <div
            className="mt-[10px] px-[9px] py-[5px] text-[11px] leading-[16px]"
            style={{ backgroundColor: COR_TILE, borderRadius: 8, color: TEXTO.secundario }}
          >
            {bloco.moduloRotulo}{" "}
            <span style={{ color: TEXTO.primario, fontWeight: 700 }}>{bloco.moduloTitulo}</span>
          </div>

          <table className="mt-[7px] w-full border-collapse">
            <thead>
              <tr style={{ borderBottom: `1px solid ${REGUA_CABECALHO}` }}>
                {bloco.cabecalhos.map((titulo, i) => (
                  <CabecalhoTabela key={titulo} className={i === 0 ? "text-left" : "text-right"}>
                    {titulo}
                  </CabecalhoTabela>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Fila de triagem, NÃO pódio (F-34a): sem numeral de posição. */}
              {bloco.linhas.map((linha, indice) => (
                <tr
                  key={linha.alunoId}
                  style={{
                    height: PASSO_LINHA_TRAVADOS,
                    borderTop: indice === 0 ? undefined : `1px solid ${REGUA_LINHA}`,
                  }}
                >
                  <Celula className="text-left">
                    <span className="flex items-center gap-[7px]">
                      <AvatarPessoa iniciais={linha.iniciais} tom={linha.avatarTone} />
                      <span className="whitespace-nowrap">{linha.nome}</span>
                    </span>
                  </Celula>
                  <Celula className="text-right">{linha.paradoHaLabel}</Celula>
                  <Celula className="text-right">{linha.ultimaAtividadeLabel}</Celula>
                </tr>
              ))}
            </tbody>
          </table>

          <span
            className="mt-auto inline-flex w-fit items-center rounded-[8px] px-[12px] py-[6px] text-[11px] font-semibold"
            style={{ border: `1px solid ${COR_ACAO}`, color: COR_ACAO, backgroundColor: "#FFFFFF" }}
          >
            {/* F-21 · o CTA carrega o total COMPLETO da população (8), nunca o
                corte exibido (5). Os dois números convivem nesta mesma tela, e
                é obrigatório que sejam distinguíveis. O `ctaTotal` chegava à
                camada e MORRIA aqui — a lição 3 na sua versão de renderização:
                o dado certo, obrigatório no tipo, e mudo na tela. */}
            {bloco.ctaRotulo} ({bloco.ctaTotal})
          </span>
        </>
      ) : null}
    </Card>
  )
}

// ===========================================================================
// §27 — funil de avanço por módulo
// ===========================================================================

function CardFunil({ bloco }: { bloco: BlocoFunil }) {
  const ok = situacaoDo(bloco) === "ok"

  return (
    <Card className="relative flex flex-col px-[16px] pt-[13px] pb-[14px]">
      <CardTitulo>{bloco.titulo}</CardTitulo>
      <Subtitulo>{bloco.subtitulo}</Subtitulo>

      <CorpoNaoRenderizavel bloco={bloco} />

      {ok ? (
        <>
          <table className="mt-[7px] w-full border-collapse">
            <thead>
              <tr style={{ borderBottom: `1px solid ${REGUA_CABECALHO}` }}>
                {bloco.cabecalhos.map((titulo, i) => (
                  <CabecalhoTabela key={titulo} className={i === 0 ? "text-left" : "text-center"}>
                    {titulo}
                  </CabecalhoTabela>
                ))}
              </tr>
            </thead>
            <tbody>
              {bloco.linhas.map((linha) => (
                // V-27 · passo fixo de 21px (faixa 18 a 28, referência 21,7).
                <tr key={linha.moduloId} style={{ height: PASSO_LINHA_FUNIL }}>
                  <Celula className="text-left">
                    <span className="flex items-center gap-[7px]">
                      <span style={{ color: TEXTO.mudo }}>{linha.numero}</span>
                      <span className="truncate">{linha.titulo}</span>
                    </span>
                  </Celula>
                  <Celula className="text-center">{linha.chegaram}</Celula>
                  <Celula className="text-center">{linha.iniciaram}</Celula>
                  <Celula className="text-center">{linha.concluiram}</Celula>
                  <Celula className="text-center">{linha.conversaoLabel}</Celula>
                </tr>
              ))}
            </tbody>
          </table>

          {/* F-22 · sem esta régua, uma coluna constante ao lado de duas que
              caem lê-se como consulta quebrada. */}
          <NotaRegua>{bloco.notaRegua}</NotaRegua>
        </>
      ) : null}

      {ok && bloco.linkRodape ? (
        <span className="mt-[6px] block h-[16px]">
          <LinkRodape rotulo={bloco.linkRodape} />
        </span>
      ) : null}
    </Card>
  )
}

// ===========================================================================
// §28 — insights do mapa
// ===========================================================================

function CardInsights({ bloco }: { bloco: BlocoInsights }) {
  const ok = situacaoDo(bloco) === "ok"

  return (
    <Card className="flex flex-col px-[16px] pt-[14px] pb-[12px]">
      <CardTitulo>{bloco.titulo}</CardTitulo>

      <CorpoNaoRenderizavel bloco={bloco} />

      {ok ? (
        <>
          <div className="mt-[8px] flex flex-col gap-[9px]">
            {bloco.itens.map((item) => (
              <span key={item.id} className="flex items-start gap-[9px]">
                <CirculoIcone tom={item.iconeTom} diametro={26}>
                  <Glifo nome={item.icone} tamanho={13} />
                </CirculoIcone>
                <span
                  className="text-[11px] leading-[16px]"
                  style={{ color: TEXTO.secundario, letterSpacing: "-0.003em" }}
                >
                  {item.texto}
                </span>
              </span>
            ))}
          </div>

          {bloco.acao ? (
            <>
              <span className="mt-auto block h-px w-full" style={{ backgroundColor: "#EDE8E4" }} />
              <div className="mt-[10px] flex items-center justify-between gap-[10px]">
                <span className="flex flex-1 flex-col">
                  <span className="flex items-center gap-[7px]">
                    <Lightbulb size={14} strokeWidth={2.1} style={{ color: "#E0A106" }} />
                    <span
                      className="text-[11.5px] font-bold leading-[16px]"
                      style={{ color: TEXTO.primario }}
                    >
                      {bloco.acao.titulo}
                    </span>
                  </span>
                  <span
                    className="mt-[3px] text-[11px] leading-[16px]"
                    style={{ color: TEXTO.secundario }}
                  >
                    {bloco.acao.texto}
                  </span>
                </span>
                {/* CTA de NAVEGAÇÃO (`ctaEscreve: false`). Um CTA que gravasse
                    nasceria inerte enquanto o gate de escrita estiver desligado. */}
                <span
                  className="inline-flex w-fit shrink-0 items-center rounded-[8px] px-[11px] py-[6px] text-[11px] font-semibold"
                  style={{
                    border: `1px solid ${COR_ACAO}`,
                    color: COR_ACAO,
                    backgroundColor: "#FFFFFF",
                  }}
                >
                  {bloco.acao.ctaRotulo}
                </span>
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </Card>
  )
}

// ===========================================================================
// A tela
// ===========================================================================

export function MapaJornadaTab({ dados }: { dados: MapaJornadaDados }) {
  return (
    <div className="flex flex-col gap-[12px]">
      {/* Linha 1 — o mapa domina (V-02, V-07); à direita, dois cards empilhados. */}
      <div className="grid gap-[21px]" style={{ gridTemplateColumns: "1fr 0.6246fr" }}>
        <CardMapa bloco={dados.mapa} />
        <div className="grid gap-[17px]" style={{ gridTemplateRows: "auto 1fr" }}>
          <CardGargalos bloco={dados.gargalos} />
          <CardDistribuicao bloco={dados.distribuicao} notaPeriodo={dados.notaPeriodo} />
        </div>
      </div>

      {/* Linha 2 — três larguras DESIGUAIS (V-04): o funil precisa da largura
          que a tabela de travados não precisa. */}
      <div className="grid gap-[14px]" style={{ gridTemplateColumns: "27.1fr 36.7fr 34.1fr" }}>
        <CardTravados bloco={dados.travados} />
        <CardFunil bloco={dados.funil} />
        <CardInsights bloco={dados.insights} />
      </div>

      {/* V-08 · faixa informativa de largura total, superfície tonal FRIA, sem
          borda, com o texto em UMA linha. A régua do período (F-33) foi para o
          card `Distribuição por etapa`: empilhá-la aqui fazia a faixa nascer em
          duas linhas, que é FAIL de V-08, e o texto continua renderizado. */}
      <div
        className="flex items-center gap-[11px] px-[16px] py-[9px]"
        style={{ backgroundColor: "#EFF2F6", borderRadius: 10 }}
      >
        <CirculoIcone tom="blue" diametro={22}>
          <Info size={12} strokeWidth={2.1} />
        </CirculoIcone>
        <span
          className="whitespace-nowrap text-[11px] leading-[16px]"
          style={{ color: TEXTO.secundario, letterSpacing: "-0.003em" }}
        >
          {dados.faixaRodape}
        </span>
      </div>
    </div>
  )
}
