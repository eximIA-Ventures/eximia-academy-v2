// ---------------------------------------------------------------------------
// Aba "Mapa da jornada" do Analytics do gestor — ESQUELETO RENDERIZÁVEL.
// ---------------------------------------------------------------------------
// ESTADO HONESTO DESTE ARQUIVO (2026-08-18): é a FUNDAÇÃO, não a tela acabada.
// Ele desenha os 7 blocos da referência na posição e na proporção de V-01..V-08,
// com os DADOS REAIS da camada `lib/analytics/mapa-jornada` — nenhum literal de
// número, nenhum texto inventado. O acabamento fino (tipografia medida contra a
// bbox de tinta, calhas ao pixel, ritmo vertical dentro dos 700px) é trabalho do
// loop de gauntlet que vem depois; aqui as caixas são rotuladas e verdadeiras.
//
// O QUE JÁ É DECISÃO TOMADA, e não deve regredir no loop:
//   • os três estados da célula se distinguem POR GLIFO (V-14, `design-mapa`);
//   • as três RÉGUAS da tela são texto RENDERIZADO, nunca tooltip (I-2):
//     a do cinza (F-05), a de "Chegaram" (F-22) e a do período (F-33);
//   • a lista de travados NÃO é numerada (F-34a): é fila de triagem, não pódio;
//   • todo bloco ramifica em ok/vazio/erro por `CorpoNaoRenderizavel` (I-3/I-4),
//     e um bloco em erro não publica numeral nenhum.
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
      className="mt-[8px] text-[10px] leading-[14px]"
      style={{ color: TEXTO.mudo, letterSpacing: "-0.002em" }}
    >
      {children}
    </p>
  )
}

function Celula({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <td
      className={`text-[11px] leading-[16px] ${className}`}
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
      className={`pb-[6px] text-[10.5px] leading-[15px] font-semibold ${className}`}
      style={{ color: TEXTO.mudo, letterSpacing: "-0.002em" }}
    >
      {children}
    </th>
  )
}

// ===========================================================================
// §23 — a matriz
// ===========================================================================

function CardMapa({ bloco }: { bloco: BlocoMapa }) {
  const ok = situacaoDo(bloco) === "ok"

  return (
    <Card className="flex flex-col px-[18px] pt-[14px] pb-[12px]">
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
          <table className="mt-[10px] w-full table-fixed border-collapse">
            <thead>
              <tr>
                <th className="w-[19%] text-left align-bottom">
                  <span
                    className="text-[10.5px] font-semibold"
                    style={{ color: TEXTO.mudo, letterSpacing: "-0.002em" }}
                  >
                    Pessoa
                  </span>
                </th>
                {bloco.colunas.map((coluna) => (
                  <th key={coluna.id} className="align-bottom">
                    <span className="flex flex-col items-center gap-[5px] px-[2px] pb-[6px]">
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
              {bloco.linhas.map((linha) => (
                <tr key={linha.alunoId} style={{ borderTop: "1px solid #F1EDEA" }}>
                  <td className="py-[5px]">
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
                      className="py-[5px] text-center"
                    >
                      <span className="inline-flex justify-center">
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
              className="mt-[6px] pl-[25px] text-[10.5px] leading-[15px]"
              style={{ color: TEXTO.mudo }}
            >
              {bloco.rotuloResto}
            </span>
          ) : null}

          <div className="mt-[8px] flex items-center gap-[16px]">
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
              <BadgeModulo numero={linha.numero} tom={linha.tom} />
              <span
                className="w-[42%] truncate text-[11px] leading-[16px]"
                style={{ color: TEXTO.secundario, letterSpacing: "-0.003em" }}
              >
                {linha.titulo}
              </span>
              <span className="flex-1">
                <BarraProporcao proporcao={linha.proporcao} tom={linha.tom} />
              </span>
              <span className="flex w-[64px] items-baseline justify-end gap-[4px]">
                <span
                  className="text-[13px] font-bold leading-[16px]"
                  style={{ color: TEXTO.primario }}
                >
                  {linha.pessoas}
                </span>
                <span className="text-[10px] leading-[14px]" style={{ color: TEXTO.terciario }}>
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

function CardDistribuicao({ bloco }: { bloco: BlocoDistribuicao }) {
  const ok = situacaoDo(bloco) === "ok"

  return (
    <Card className="flex flex-col px-[18px] pt-[14px] pb-[14px]">
      <CardTitulo>{bloco.titulo}</CardTitulo>
      <Subtitulo>{bloco.subtitulo}</Subtitulo>

      <CorpoNaoRenderizavel bloco={bloco} />

      {ok ? (
        <div className="mt-[10px] flex gap-[8px]">
          {bloco.tiles.map((tile) => (
            <div
              key={tile.id}
              className="flex flex-1 items-center gap-[8px] px-[9px] py-[8px]"
              style={{ backgroundColor: COR_TILE, borderRadius: RAIO_TILE }}
            >
              <CirculoIcone tom={tile.tom} diametro={22}>
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
                    className="text-[15px] font-bold leading-[19px]"
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
    </Card>
  )
}

// ===========================================================================
// §26 — pessoas que travaram no mesmo ponto
// ===========================================================================

function CardTravados({ bloco }: { bloco: BlocoTravados }) {
  // F-21 · o ÚNICO bloco que SOME por desenho da spec. `presente: false` com
  // estado `vazio` é "não há concentração"; com estado `erro` é falha de
  // leitura — e os dois NÃO podem colapsar. Por isso o erro continua visível.
  if (!bloco.presente && situacaoDo(bloco) !== "erro") return null

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

          <table className="mt-[8px] w-full border-collapse">
            <thead>
              <tr>
                {bloco.cabecalhos.map((titulo, i) => (
                  <CabecalhoTabela key={titulo} className={i === 0 ? "text-left" : "text-right"}>
                    {titulo}
                  </CabecalhoTabela>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Fila de triagem, NÃO pódio (F-34a): sem numeral de posição. */}
              {bloco.linhas.map((linha) => (
                <tr key={linha.alunoId} style={{ borderTop: "1px solid #F1EDEA" }}>
                  <Celula className="py-[4px] text-left">
                    <span className="flex items-center gap-[7px]">
                      <AvatarPessoa iniciais={linha.iniciais} tom={linha.avatarTone} />
                      <span className="whitespace-nowrap">{linha.nome}</span>
                    </span>
                  </Celula>
                  <Celula className="py-[4px] text-right">{linha.paradoHaLabel}</Celula>
                  <Celula className="py-[4px] text-right">{linha.ultimaAtividadeLabel}</Celula>
                </tr>
              ))}
            </tbody>
          </table>

          <span
            className="mt-[10px] inline-flex w-fit items-center rounded-[8px] px-[12px] py-[6px] text-[11px] font-semibold"
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
    <Card className="relative flex flex-col px-[16px] pt-[14px] pb-[26px]">
      <CardTitulo>{bloco.titulo}</CardTitulo>
      <Subtitulo>{bloco.subtitulo}</Subtitulo>

      <CorpoNaoRenderizavel bloco={bloco} />

      {ok ? (
        <>
          <table className="mt-[8px] w-full border-collapse">
            <thead>
              <tr style={{ borderBottom: "1px solid #E7E2DE" }}>
                {bloco.cabecalhos.map((titulo, i) => (
                  <CabecalhoTabela key={titulo} className={i === 0 ? "text-left" : "text-center"}>
                    {titulo}
                  </CabecalhoTabela>
                ))}
              </tr>
            </thead>
            <tbody>
              {bloco.linhas.map((linha) => (
                <tr key={linha.moduloId}>
                  <Celula className="py-[3px] text-left">
                    <span className="flex items-center gap-[7px]">
                      <span style={{ color: TEXTO.mudo }}>{linha.numero}</span>
                      <span className="truncate">{linha.titulo}</span>
                    </span>
                  </Celula>
                  <Celula className="py-[3px] text-center">{linha.chegaram}</Celula>
                  <Celula className="py-[3px] text-center">{linha.iniciaram}</Celula>
                  <Celula className="py-[3px] text-center">{linha.concluiram}</Celula>
                  <Celula className="py-[3px] text-center">{linha.conversaoLabel}</Celula>
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
        <span className="mt-[8px] block h-[16px]">
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
              <span
                className="mt-[11px] block h-px w-full"
                style={{ backgroundColor: "#EDE8E4" }}
              />
              <div className="mt-[10px] flex items-start justify-between gap-[10px]">
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
    <div className="flex flex-col gap-[15px]">
      {/* Linha 1 — o mapa domina (V-02, V-07); à direita, dois cards empilhados. */}
      <div className="grid gap-[21px]" style={{ gridTemplateColumns: "1fr 0.6246fr" }}>
        <CardMapa bloco={dados.mapa} />
        <div className="grid gap-[17px]" style={{ gridTemplateRows: "auto 1fr" }}>
          <CardGargalos bloco={dados.gargalos} />
          <CardDistribuicao bloco={dados.distribuicao} />
        </div>
      </div>

      {/* Linha 2 — três larguras DESIGUAIS (V-04): o funil precisa da largura
          que a tabela de travados não precisa. */}
      <div className="grid gap-[14px]" style={{ gridTemplateColumns: "27.1fr 36.7fr 34.1fr" }}>
        <CardTravados bloco={dados.travados} />
        <CardFunil bloco={dados.funil} />
        <CardInsights bloco={dados.insights} />
      </div>

      {/* Faixa informativa de largura total (V-08) + a régua do período (F-33). */}
      <div
        className="flex items-start gap-[10px] px-[16px] py-[11px]"
        style={{ backgroundColor: "#EFF2F6", borderRadius: 10 }}
      >
        <CirculoIcone tom="blue" diametro={22}>
          <Info size={12} strokeWidth={2.1} />
        </CirculoIcone>
        <span className="flex flex-col">
          <span
            className="text-[11px] leading-[16px]"
            style={{ color: TEXTO.secundario, letterSpacing: "-0.003em" }}
          >
            {dados.faixaRodape}
          </span>
          <span className="text-[10px] leading-[14px]" style={{ color: TEXTO.mudo }}>
            {dados.notaPeriodo}
          </span>
        </span>
      </div>
    </div>
  )
}
