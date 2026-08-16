// ---------------------------------------------------------------------------
// Peça B (1 de 2) — card "Quem precisa da minha atenção agora?".
//
// 4 pílulas de segmento em fileira única + tabela de 4 pessoas (Pessoa · Sinal ·
// Última atividade · Próxima ação) + link de rodapé "Ver todas as pessoas ›".
//
// HERDA a linguagem visual de ./design.tsx (Card, CardTitulo, LinkRodape,
// CirculoIcone, COR_TILE, RAIO_TILE, TEXTO, TOM_ICONE_SUAVE). Nada de cor,
// raio, sombra ou escala é redefinido aqui — só GEOMETRIA local, medida no PNG
// docs/sop/runs/_referencias/academy-analytics-gestor/01-visao-geral.png.
//
// GEOMETRIA MEDIDA (card em x 232→1141, y 373→730):
//   título ............... tinta em (253, 393)            ⇒ pt-14 + pl-8
//   pílulas .............. x 245‥1074, y 421‥479 (h 59)   ⇒ 4 × 200 com gap 9,5
//                          sobra de 67px à direita (A-24 pede 40–90)
//   círculo da pílula .... Ø 40, 19px depois da borda, 17px antes do rótulo
//   régua da tabela ...... y 516,5, x 246‥1111            ⇒ largura útil 866
//   colunas .............. x 246 · 481 · 747 · 977 (fim 1111)
//   cabeçalhos ........... tinta em 259 · 484 · 748 · 990, cap top 501
//   passo entre linhas ... 42,7 (cap tops 537 · 579 · 622 · 665) — A-25
//   avatar ............... Ø 28 em x 255; nome em x 297
//   dot .................. Ø 8 em x 481, centrado no CAP do rótulo, não na linha
//   botões ............... 103 × 28 em x 977, raio 8, TODOS da mesma largura
//                          apesar de "Reativar" ≠ "Apoiar" (D-11)
//   link ................. tinta termina em x 1090, cap top 701
//
// INVARIANTES que este bloco carrega:
//   • I-8 / D-19 — a ordem dos 4 segmentos é a da fixture, NUNCA por valor
//     decrescente (18, 6, 5, 4 seria um ranking implícito);
//   • I-8 / D-20 — as 4 linhas saem na ordem pinada da fixture, NUNCA
//     reordenadas por dias sem acesso;
//   • I-3 / C-24 — quem nunca acessou mostra o travessão que já vem na fixture,
//     nunca "0 dias" nem célula vazia. Este componente não inventa fallback;
//   • D-13 — o avatar usa `avatarTone` (derivado das iniciais) e o dot usa
//     `sinalTom` (derivado do estado). São campos diferentes de propósito:
//     Neusa Jorge tem avatar VERDE com dot ÂMBAR.
// ---------------------------------------------------------------------------

import {
  Clock,
  type LucideIcon,
  MessageCircleMore,
  Pause,
  TrendingDown,
  TrendingUp,
  UserRoundPlus,
} from "lucide-react"
import {
  COR_ACAO,
  COR_BORDA_BOTAO,
  COR_TILE,
  Card,
  CardTitulo,
  CirculoIcone,
  LinkRodape,
  RAIO_TILE,
  TEXTO,
  TOM_ICONE_SUAVE,
} from "./design"
import type { BlocoAtencao, LinhaPrioritaria, SegmentoAtencao } from "./fixture"

// ===========================================================================
// Ícones
// ===========================================================================

/**
 * Mapa `fixture.icone` → glifo Lucide. Duas entradas divergem do NOME e seguem
 * o DESENHO do PNG, pela precedência de CRITERIOS.md §0 ("para qualquer coisa
 * verificável no screenshot, o PNG vence"). Nenhum valor da fixture mudou:
 *   • `pause-circle`  (Parados)       → o PNG desenha só as duas barras, sem anel;
 *   • `circle-dashed` (Não iniciaram) → o PNG desenha um RELÓGIO.
 * As demais são literais (`trending-down`, `check-circle`→ ascensão verde,
 * `user-plus`, `message-circle` com reticências).
 */
const GLIFO: Record<string, LucideIcon> = {
  "trending-down": TrendingDown,
  "pause-circle": Pause,
  "circle-dashed": Clock,
  "check-circle": TrendingUp,
  "user-plus": UserRoundPlus,
  "message-circle": MessageCircleMore,
}

// ===========================================================================
// Pílulas de segmento
// ===========================================================================

/**
 * Pílula: bloco tonal SEM borda (B-06), raio 10 ≤ raio do card (B-11), ícone
 * dentro de disco preenchido Ø 40 (B-20 pede 36–44 aqui) e o glifo em 0,45 do
 * diâmetro (B-21 pede 0,38–0,54).
 *
 * O rótulo fica ACIMA do valor, ambos numa coluna centrada verticalmente na
 * pílula: caixas de 16 + 22 = 38 dentro de 59 devolvem o cap do rótulo em
 * y 435 e o do valor em y 452, que é o que a referência mede.
 */
function PilulaSegmento({ segmento }: { segmento: SegmentoAtencao }) {
  const Glifo = GLIFO[segmento.icone] ?? TrendingDown
  return (
    <div
      // 59 → 52 na compressão da rodada 7. 52 é o PISO de A-23 (52 a 64), não
      // uma folga escolhida: abaixo disso a pílula reprova a régua.
      className="flex h-[52px] min-w-0 items-center pl-[19px] whitespace-nowrap"
      style={{ backgroundColor: COR_TILE, borderRadius: RAIO_TILE }}
    >
      <CirculoIcone tom={segmento.iconeTom} diametro={40} paleta={TOM_ICONE_SUAVE}>
        <Glifo size={18} strokeWidth={2} />
      </CirculoIcone>
      <div className="ml-[16px] flex flex-col">
        <span
          className="text-[11px] leading-[16px]"
          style={{ color: TEXTO.primario, letterSpacing: "-0.007em" }}
        >
          {segmento.rotulo}
        </span>
        <span
          className="text-[18.5px] leading-[22px] font-bold"
          style={{ color: TEXTO.primario, letterSpacing: "-0.02em" }}
        >
          {segmento.valor}
        </span>
      </div>
    </div>
  )
}

// ===========================================================================
// Tabela
// ===========================================================================

/**
 * Colunas MEDIDAS, não distribuídas: x 246 · 481 · 747 · 977, fim em 1111.
 * Larguras 235 / 266 / 230 / 134 (soma 865, mais 1px de arredondamento).
 */
const COLUNAS = "235px 266px 230px 134px"

/** Recuo do cabeçalho por coluna: a tinta cai em 259 · 484 · 748 · 990. */
const RECUO_CABECALHO = ["13px", "3px", "1px", "13px"]

/**
 * Passo entre linhas. A referência mede 42,7 e A-25 aceita 38 a 48.
 * A compressão da rodada 7 desce ao PISO de 38: são 4 linhas, então cada px
 * aqui vale 4 na altura da tela, e este é o maior rendimento por px do bloco
 * mais alto da grade. Abaixo de 38 a régua reprova — 38 é chão, não escolha.
 */
const PASSO_LINHA = 38

/**
 * Avatar: círculo Ø 28 com 2 iniciais no tom SATURADO da mesma família pastel
 * (B-25). O tom vem de `avatarTone`, derivado das iniciais — nunca do estado
 * (D-13).
 */
function Avatar({ iniciais, tom }: { iniciais: string; tom: LinhaPrioritaria["avatarTone"] }) {
  const { fill, ink } = TOM_ICONE_SUAVE[tom]
  return (
    <span
      className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full text-[10.6px] font-semibold"
      style={{ backgroundColor: fill, color: ink, letterSpacing: "-0.01em" }}
    >
      {iniciais}
    </span>
  )
}

/**
 * Botão de ação: OUTLINE, nunca preenchido (B-12) — interior branco, borda de
 * 1px em `COR_BORDA_BOTAO`, a MESMA dos CTAs de "O que fazer agora" (medida
 * aqui em (251,164,129), R−B = 122, contra os ≥60 que a régua pede).
 * Raio 8 (B-13 pede 5–12 e menor que metade da altura de 28).
 *
 * LARGURA FIXA de 103px nos quatro, apesar de "Reativar" (59px de tinta) e
 * "Apoiar" (35px) terem comprimentos diferentes. É o D-11 explícito: botão que
 * encolhe com o rótulo é FAIL.
 */
function BotaoAcao({ linha }: { linha: LinhaPrioritaria }) {
  const Glifo = GLIFO[linha.acaoIcone] ?? UserRoundPlus
  return (
    <button
      type="button"
      className="flex h-[28px] w-[103px] items-center justify-center gap-[9px] bg-white text-[12.4px] leading-[16px] font-semibold whitespace-nowrap"
      style={{
        borderRadius: 8,
        border: `1px solid ${COR_BORDA_BOTAO}`,
        color: COR_ACAO,
        letterSpacing: "-0.012em",
      }}
    >
      <Glifo size={14} strokeWidth={2.1} />
      {linha.acaoRotulo}
    </button>
  )
}

/**
 * Cor do dot de estado. MEDIDA no PNG (centro do disco, Ø 8):
 *   âmbar   (249, 140,  25)
 *   vermelho(227,  45,  50)
 * Mais saturada que o `ink` do disco pastel porque aqui o dot é a própria
 * tinta, não um glifo dentro de um fundo claro.
 */
const TOM_DOT: Record<LinhaPrioritaria["sinalTom"], string> = {
  amber: "#F98C19",
  red: "#E32D32",
  green: "#17A06C",
  blue: "#3A7CF0",
  neutral: "#8D8A88",
}

/**
 * Linha da tabela. As 4 células compartilham o mesmo grid do cabeçalho, e o
 * conteúdo é centrado na altura da linha — daí avatar, botão, nome e "última
 * atividade" caírem todos no mesmo eixo.
 *
 * O dot NÃO é centrado na linha: ele acompanha o CAP do rótulo do sinal, que
 * fica na primeira das duas caixas de texto da célula (B-26 pede dot sólido
 * Ø 6–10, sem cápsula e sem fundo atrás do rótulo).
 */
function LinhaTabela({ linha }: { linha: LinhaPrioritaria }) {
  return (
    <div
      className="grid items-center"
      style={{ gridTemplateColumns: COLUNAS, height: PASSO_LINHA }}
    >
      <div className="flex items-center pl-[9px]">
        <Avatar iniciais={linha.iniciais} tom={linha.avatarTone} />
        <span
          className="ml-[14px] text-[11.4px] leading-[16px] whitespace-nowrap"
          style={{ color: TEXTO.primario, letterSpacing: "-0.008em" }}
        >
          {linha.nome}
        </span>
      </div>

      <div className="flex items-start">
        <span
          className="mt-[6px] h-[8px] w-[8px] shrink-0 rounded-full"
          style={{ backgroundColor: TOM_DOT[linha.sinalTom] }}
        />
        <div className="ml-[9px] flex flex-col whitespace-nowrap">
          <span
            className="text-[12px] leading-[16px] font-semibold"
            style={{ color: TEXTO.primario, letterSpacing: "-0.03em" }}
          >
            {linha.sinalRotulo}
          </span>
          <span
            className="text-[11px] leading-[16px]"
            style={{ color: TEXTO.mudo, letterSpacing: "-0.006em" }}
          >
            {linha.sinalSubtexto}
          </span>
        </div>
      </div>

      {/* O travessão de quem nunca acessou já vem pronto da fixture (I-3). */}
      <span
        className="text-[11.4px] leading-[16px] whitespace-nowrap"
        style={{ color: TEXTO.primario, letterSpacing: "-0.008em" }}
      >
        {linha.ultimaAtividadeLabel}
      </span>

      <BotaoAcao linha={linha} />
    </div>
  )
}

// ===========================================================================
// Card
// ===========================================================================

export function CardAtencao({ atencao }: { atencao: BlocoAtencao }) {
  return (
    <Card className="relative flex h-full w-[909px] shrink-0 flex-col px-[13px] pt-[10px]">
      <CardTitulo className="pl-[8px]">{atencao.titulo}</CardTitulo>

      {/* A fileira NÃO ocupa a largura do card: 829 de 883 úteis, sobrando 67px
          à direita. `space-between` ou 4 colunas `1fr` até a borda é FAIL
          explícito (D-21 / A-24). */}
      <div className="mt-[8px] grid w-[829px] grid-cols-4 gap-[9.5px]">
        {atencao.segmentos.map((segmento) => (
          <PilulaSegmento key={segmento.id} segmento={segmento} />
        ))}
      </div>

      <div className="mt-[8px] w-[866px]">
        <div
          className="grid pb-[2px]"
          style={{ gridTemplateColumns: COLUNAS, borderBottom: "1px solid #E9E7E6" }}
        >
          {atencao.cabecalhosTabela.map((rotulo, indice) => (
            <span
              key={rotulo}
              className="text-[11.1px] leading-[16px] font-medium whitespace-nowrap"
              style={{
                color: TEXTO.primario,
                letterSpacing: "-0.008em",
                paddingLeft: RECUO_CABECALHO[indice],
              }}
            >
              {rotulo}
            </span>
          ))}
        </div>

        {/* Ordem PINADA da fixture: nada de `sort` aqui (D-20 / invariante I-8). */}
        <div className="pt-[2px]">
          {atencao.linhas.map((linha) => (
            <LinhaTabela key={linha.id} linha={linha} />
          ))}
        </div>
      </div>

      {/* UM link para o card inteiro, alinhado à régua interna direita (A-30). */}
      {/* `bottom` aqui ancora o TOPO do link (a caixa é absolute de altura
          zero): 19 = 16 do link + 3 de folga real até a base do card. */}
      <div className="absolute right-[30px] bottom-[19px] left-0">
        <LinkRodape rotulo={atencao.linkRodape} />
      </div>
    </Card>
  )
}
