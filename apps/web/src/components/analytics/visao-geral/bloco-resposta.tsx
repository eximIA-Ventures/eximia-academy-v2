// ---------------------------------------------------------------------------
// Peça B (2 de 2) — card "Resposta aos seus acionamentos".
//
// 3 estatísticas em UMA linha horizontal + ícone de ajuda ao lado do título +
// a ressalva de não-causalidade no rodapé.
//
// HERDA a linguagem visual de ./design.tsx. Só geometria local aqui, medida no
// PNG docs/sop/runs/_referencias/academy-analytics-gestor/01-visao-geral.png.
//
// GEOMETRIA MEDIDA (card em x 232→894, y 742→910):
//   título ........... tinta em (253, 763), termina em x 483   ⇒ pt-13 + pl-8
//   ícone de ajuda ... círculo de traço Ø 14 em x 495‥508, centrado no cap
//   círculos ......... Ø 46, tops em y 798, x 252 · 446 · 669  (A-28)
//   valor ............ cap top 806, cap-height 17‥18 (B-29 pede 15–19)
//   rótulo ........... cap top 833, minúsculo, alinhado à esquerda do valor
//   ressalva ......... tinta em (253, 873), 396px de largura, 1 linha
//
// RITMO HORIZONTAL: o vão entre o fim do texto de um grupo e o círculo do
// seguinte é o MESMO nos dois casos (409→446 e 632→669), ou seja o passo
// aparentemente irregular da referência (194 e 223px entre círculos) é
// consequência de os rótulos terem larguras diferentes, não de espaçamento
// manual. Um único `gap` reproduz os dois de uma vez; `35px` (e não os 37
// medidos na tinta) porque a caixa do rótulo é ~2px mais larga que a tinta
// nesta fonte. ("NÃO É CRITÉRIO" item 7 já perdoaria distribuição uniforme;
// esta é a que devolve o ritmo medido.)
//
// INVARIANTES que este bloco carrega:
//   • I-2 / C-32 — a ressalva é <p> RENDERIZADO, sempre visível. Nunca title,
//     nunca tooltip, nunca atrás de hover. É o ponto do invariante;
//   • I-1 — os valores vêm de `pessoasAcionadas` (dedupe por destinatário) já
//     resolvidos na fixture. Este componente NÃO recalcula nada a partir de
//     contagem de notificação, que devolveria 6 e derrubaria a taxa para 33%;
//   • I-3 — nenhum zero é fabricado aqui: o componente exibe o que a fixture
//     traz. O estado vazio é texto da §32, não `0%`.
// ---------------------------------------------------------------------------

import { CircleHelp, type LucideIcon, Percent, TrendingUp, UserRoundPlus } from "lucide-react"
import { Card, CardTitulo, CirculoIcone, TEXTO, TOM_ICONE_SUAVE } from "./design"
import type { BlocoResposta, EstatisticaResposta, Tom } from "./fixture"

/**
 * `TOM_ICONE_SUAVE` com UMA correção local, medida: o disco de "pessoas
 * acionadas" é PÊSSEGO na referência (250,232,226), não o âmbar amarelado das
 * pílulas ao lado (249,229,204) — 22 níveis de diferença no azul, longe dos ±8
 * que a régua manda ignorar ("NÃO É CRITÉRIO" item 8). Lado a lado a diferença
 * é visível: um disco salmão contra um disco de mel.
 *
 * A fixture continua dizendo `iconeTom: "amber"` e NÃO foi tocada — a semântica
 * é âmbar, só a tinta do PNG é mais rosada neste bloco. Por isso a correção é
 * uma paleta passada ao MESMO `CirculoIcone`, e não um componente paralelo.
 */
const PALETA_RESPOSTA: Record<Tom, { fill: string; ink: string }> = {
  ...TOM_ICONE_SUAVE,
  amber: { fill: "#FAE8E2", ink: "#E1531F" },
}

/**
 * Mapa `fixture.icone` → glifo Lucide. Duas entradas divergem do NOME e seguem
 * o DESENHO do PNG (precedência de CRITERIOS.md §0), sem alterar a fixture:
 *   • `send`   (pessoas acionadas) → o PNG desenha uma PESSOA com seta, o mesmo
 *     vocabulário do botão "Reativar" da tabela ao lado;
 *   • `undo-2` (retomaram)         → o PNG desenha uma ASCENSÃO, não um retorno.
 * `percent` é literal.
 */
const GLIFO: Record<string, LucideIcon> = {
  send: UserRoundPlus,
  "undo-2": TrendingUp,
  percent: Percent,
}

/**
 * Grupo de estatística: disco Ø 46 (B-20 pede 42–50 aqui) e, à direita, o valor
 * sobre o rótulo. O `mt-[3px]` da coluna e o `mt-[2px]` do rótulo são o que
 * assenta o cap do valor em y 806 e o do rótulo em y 833 quando o disco começa
 * em y 798 — medida, não estimativa.
 */
function GrupoEstatistica({ estatistica }: { estatistica: EstatisticaResposta }) {
  const Glifo = GLIFO[estatistica.icone] ?? Percent
  return (
    <div className="flex shrink-0 items-start gap-[15px] whitespace-nowrap">
      <CirculoIcone tom={estatistica.iconeTom} diametro={46} paleta={PALETA_RESPOSTA}>
        <Glifo size={21} strokeWidth={2} />
      </CirculoIcone>
      <div className="mt-[3px] flex flex-col">
        <span
          className="text-[23px] leading-[26px] font-bold"
          style={{ color: TEXTO.primario, letterSpacing: "-0.022em" }}
        >
          {estatistica.valor}
        </span>
        <span
          className="mt-[2px] text-[11.1px] leading-[16px]"
          style={{ color: TEXTO.secundario, letterSpacing: "-0.008em" }}
        >
          {estatistica.rotulo}
        </span>
      </div>
    </div>
  )
}

export function CardResposta({ resposta }: { resposta: BlocoResposta }) {
  return (
    <Card className="relative h-full w-[662px] shrink-0 px-[13px] pt-[10px]">
      <div className="flex items-center pl-[8px]">
        <CardTitulo>{resposta.titulo}</CardTitulo>
        {resposta.tituloAjuda ? (
          <CircleHelp
            size={14}
            strokeWidth={1.9}
            className="ml-[7px] shrink-0"
            style={{ color: "#96938F" }}
          />
        ) : null}
      </div>

      {/* Os 3 grupos numa ÚNICA linha horizontal, centros de disco no mesmo
          eixo vertical (A-28). */}
      <div className="mt-[10px] flex gap-[35px] pl-[7px]">
        {resposta.estatisticas.map((estatistica) => (
          <GrupoEstatistica key={estatistica.id} estatistica={estatistica} />
        ))}
      </div>

      {/* Invariante I-2: texto renderizado, nunca tooltip. */}
      <p
        className="absolute bottom-[25px] left-[21px] text-[10.5px] leading-[16px] whitespace-nowrap"
        style={{ color: TEXTO.mudo, letterSpacing: "-0.004em" }}
      >
        {resposta.disclaimer}
      </p>
    </Card>
  )
}
