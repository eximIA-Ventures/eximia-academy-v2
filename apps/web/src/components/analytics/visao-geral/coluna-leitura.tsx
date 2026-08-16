// ---------------------------------------------------------------------------
// PEÇA C — "Coluna de leitura" da aba "Visão geral" (Analytics do gestor).
//
// Escopo deste arquivo, e só ele:
//   • card "O que fazer agora" — 3 recomendações numeradas, com contexto e CTA
//     (Ver pessoas · Enviar lembrete · Reconhecer);
//   • card "Sinais fora do padrão" — 3 sinais com ícone de severidade e o link
//     de rodapé "Ver todos os sinais ›".
// O card "O que mudou" é peça A e NÃO é tocado aqui.
//
// A linguagem visual vem inteira de `./design` (superfícies, 4 tiers de texto,
// paleta semântica, sombra, raios, Card/CardTitulo/LinkRodape/CirculoIcone).
// A única extensão introduzida por esta peça é `TOM_ICONE_TENUE` mais
// `COR_BORDA_BOTAO`, ambos em `design.tsx`, ambos medidos e documentados lá.
//
// TODA geometria abaixo foi MEDIDA no PNG de referência
// docs/sop/runs/_referencias/academy-analytics-gestor/01-visao-geral.png
// (1672×941, DPR 1), com as bordas lidas na transição de 50% e o texto lido
// pela bbox de tinta (luminância < 215), conforme CRITERIOS.md §0.
//
// Régua: CRITERIOS.md · Dados: FIXTURE.md · Comportamento: INVARIANTES.md
// ---------------------------------------------------------------------------

import { Sparkles, TriangleAlert } from "lucide-react"
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
  TOM_ICONE_TENUE,
} from "./design"
import type { BlocoRecomendacoes, BlocoSinais, Recomendacao, SinalForaDoPadrao } from "./fixture"

// ===========================================================================
// Estados vazios (invariante I-3)
// ===========================================================================

/**
 * Literais da SPEC-FUNCIONAL §32, replicados em FIXTURE.md §14. Ausência de
 * dado NUNCA vira `0`, `0 de 0` nem caixa em branco: vira frase. Não vêm da
 * fixture porque o contrato de dados não carrega um campo de texto vazio por
 * bloco — carrega as VARIANTES, que descrevem a mutação, não o componente.
 */
const VAZIO_RECOMENDACOES = "Nenhum gargalo relevante foi identificado neste período."
const VAZIO_SINAIS = "Nenhum sinal relevante fora do padrão foi identificado."

function FraseVazia({ texto }: { texto: string }) {
  return (
    <p
      className="mt-[14px] text-[11.5px] leading-[16px]"
      style={{ color: TEXTO.secundario, letterSpacing: "-0.004em" }}
    >
      {texto}
    </p>
  )
}

// ===========================================================================
// "O que fazer agora"
// ===========================================================================

/**
 * CTA de contorno (B-12, B-13): interior BRANCO (a régua exige luminância ≥250,
 * e o miolo medido é 253–255 contra 249 do bloco tonal atrás), borda de 1px em
 * `COR_BORDA_BOTAO`, rótulo no laranja de ação. Raio 8 — dentro de 5–12 e menor
 * que metade da altura, ou seja NÃO é pílula (B-13).
 *
 * LARGURA MEDIDA dos 3 botões: 101 / 106 / 96 px, contra tinta de rótulo de
 * 60 / 78 / 59. Ou seja: NÃO são de largura fixa (isso é a tabela da peça D,
 * D-11), e também não são pura folga simétrica — o par (`min-w-[96px]`,
 * `px-[13px]`) reproduz 96 / 107 / 96, que erra só no primeiro e por 5px.
 * Altura medida borda a borda: 456→480, 535→559 (25–26px). Rótulo em 10,5px,
 * calibrado pela tinta de "Enviar lembrete" (78px na referência).
 */
function BotaoRecomendacao({ rotulo }: { rotulo: string }) {
  return (
    <button
      type="button"
      className="flex h-[26px] min-w-[96px] items-center justify-center bg-white px-[13px] text-[10.5px] leading-[14px] font-semibold whitespace-nowrap"
      style={{
        color: COR_ACAO,
        border: `1px solid ${COR_BORDA_BOTAO}`,
        borderRadius: 8,
        letterSpacing: "-0.004em",
      }}
    >
      {rotulo}
    </button>
  )
}

/**
 * Um sub-bloco tonal de recomendação.
 *
 * RITMO VERTICAL MEDIDO (bloco 1, y 432→502; bloco 2, 511→581; bloco 3, 590→677):
 *   topo do bloco → cap top do título ...... 12   ⇒ pt-[8px] + meia-entrelinha
 *   topo do bloco → topo do badge .......... 14   ⇒ mt-[6px] sobre o pt-[8px]
 *   baselines do título .................... passo 18  ⇒ leading-[18px]
 *   título → contexto ...................... passo 18  ⇒ mt-[1px]
 *   baselines do contexto (bloco 3) ........ passo 16  ⇒ leading-[16px]
 *   última baseline → base do bloco ........ 12,5 ⇒ pb-[10px]
 * Blocos 1 e 2 medem 71px e o bloco 3 mede 88 porque o contexto dele quebra em
 * 2 linhas — a diferença de 16px é EXIGIDA por D-14 (forçar os três à mesma
 * altura é FAIL explícito). Por isso nada aqui tem altura fixa.
 *
 * LARGURAS DO CORPO DE TEXTO. Título e contexto têm caixas DIFERENTES, e isso
 * não é descuido: a referência quebra "…sem acesso" antes de "há" (que caberia
 * em qualquer caixa ≥198), enquanto o contexto do bloco 2 corre até 229px de
 * tinta em uma linha só. Uma caixa única não produz os dois. Medido:
 *   título ..... maior linha 196 (bloco 2)   ⇒ w-[196px]
 *   contexto ... maior linha 229 (bloco 2) · precisa quebrar antes de 253
 *                                            ⇒ w-[236px]
 * A quebra é consequência da largura, nunca de `<br>` (FIXTURE.md §10).
 *
 * RESÍDUO CONHECIDO, e é do tipo que NENHUMA largura resolve. Para reproduzir a
 * quebra do bloco 3 ("…com" / "ritmo consistente") a caixa teria que ser menor
 * que "Reconhecer 4 pessoas com ritmo" (192px de avanço aqui); para manter a do
 * bloco 2 ("…que começaram" / "a desacelerar") ela precisa caber "Apoiar 5
 * pessoas que começaram" (196). Como 196 > 192, não existe limiar que satisfaça
 * os dois — a própria referência tem essa inversão (196 contra ~195) e só a
 * resolve por menos de 1px, o que é assinatura de caixa desenhada à mão. A
 * escolha aqui é 196: os blocos 1 e 2 quebram exatamente onde a referência
 * quebra, o 3 quebra uma palavra depois, e os três continuam em 2 linhas com o
 * bloco 3 mais alto, que é o que FIXTURE.md §10 e D-14 exigem de fato.
 *
 * O badge `1/2/3` é prioridade de AÇÃO, não posição de pessoa: não é ranking
 * (C-39 / invariante I-8).
 */
function BlocoRecomendacao({ item }: { item: Recomendacao }) {
  return (
    <li
      className="flex items-start pt-[8px] pr-0 pb-[10px] pl-[9px]"
      style={{ backgroundColor: COR_TILE, borderRadius: RAIO_TILE }}
    >
      {/* O badge NÃO acompanha a primeira linha do título: ele começa 14px
          abaixo do topo do bloco, contra 12 do cap top do título (medido).
          Daí os 6px sobre o `pt-[8px]` do bloco. */}
      <span className="mt-[6px] flex">
        <CirculoIcone tom={item.badgeTom} diametro={30} paleta={TOM_ICONE_SUAVE}>
          <span
            className="text-[17.5px] leading-[20px] font-semibold"
            style={{ letterSpacing: "-0.02em" }}
          >
            {item.prioridade}
          </span>
        </CirculoIcone>
      </span>

      <div className="ml-[16px] w-[236px] shrink-0">
        <p
          className="w-[196px] text-[11.9px] leading-[18px] font-bold"
          style={{ color: TEXTO.primario, letterSpacing: "-0.004em" }}
        >
          {item.titulo}
        </p>
        <p
          className="mt-[1px] text-[10.6px] leading-[16px]"
          style={{ color: TEXTO.terciario, letterSpacing: "-0.002em" }}
        >
          {item.contexto}
        </p>
      </div>

      {/* Os 3 CTAs estão CENTRADOS no mesmo eixo (x ≈ 1529 na referência), e não
          encostados à direita: por isso a coluna do botão é `flex-1` centrada,
          e não `ml-auto`. `self-center` alinha ao centro do bloco (medido: 468
          contra 467 do centro do bloco 1). Sobra ≥ 20px até a borda do bloco,
          contra os 10 que D-15 exige. */}
      <div className="flex flex-1 justify-center self-center">
        <BotaoRecomendacao rotulo={item.ctaRotulo} />
      </div>
    </li>
  )
}

/**
 * Card "O que fazer agora".
 *
 * MEDIDO: card x 1154→1615, y 373→730. Título com sparkle laranja à esquerda
 * (C-27), tinta do ícone em x 1176→1190 e do texto a partir de 1198 — ou seja
 * `px-[20px]` (a mesma régua interna do "O que mudou" da peça A) e 6px entre a
 * caixa do ícone e a do texto. Primeiro bloco tonal em y 432, contra a base da
 * caixa do título em 410 ⇒ `mt-[22px]`. Os 53px que sobram abaixo do último
 * bloco são folga dentro do card, não encurtamento dele (D-04).
 *
 * Os blocos tonais SANGRAM para fora da régua do título: eles vão de x 1166 a
 * 1600, ou seja 12px da borda esquerda do card e 15 da direita, contra os 20 do
 * título. Daí `-ml-[8px] -mr-[5px]` na lista — sem isso os blocos nasceriam 9px
 * estreitos de cada lado e todo o conteúdo deles entraria deslocado.
 */
export function CardRecomendacoes({ recomendacoes }: { recomendacoes: BlocoRecomendacoes }) {
  const itens = recomendacoes.recomendacoes

  return (
    <Card className="h-full flex-1 px-[20px] pt-[15px]">
      <div className="flex items-center gap-[6px]">
        <Sparkles size={16} strokeWidth={2} style={{ color: COR_ACAO }} />
        <CardTitulo>{recomendacoes.titulo}</CardTitulo>
      </div>

      {itens.length === 0 ? (
        <FraseVazia texto={VAZIO_RECOMENDACOES} />
      ) : (
        <ul className="mt-[22px] -mr-[5px] -ml-[8px] flex flex-col gap-[8px]">
          {itens.map((item) => (
            <BlocoRecomendacao key={item.prioridade} item={item} />
          ))}
        </ul>
      )}
    </Card>
  )
}

// ===========================================================================
// "Sinais fora do padrão"
// ===========================================================================

/**
 * Exclamação de severidade âmbar.
 *
 * A referência desenha uma haste com um ponto abaixo, SEM anel em volta — não é
 * o `alert-circle` do Lucide (que traz o círculo desenhado), e o Lucide não tem
 * um "!" solto. Medido pixel a pixel nos sinais 2 e 3: haste de 4px de largura
 * por 10 de altura, ponto de 4×3, 13px de tinta no total, dentro de um disco de
 * 26 ⇒ 0,50 do diâmetro, na faixa 0,38–0,54 de B-21.
 *
 * O nome do ícone continua vindo da fixture (`alert-circle`); o que muda aqui é
 * a resolução nome → desenho, pela precedência de CRITERIOS.md §0 ("para
 * qualquer coisa verificável no screenshot, o PNG vence"). Nenhum valor da
 * fixture foi alterado.
 */
function Exclamacao() {
  return (
    <span className="flex flex-col items-center" aria-hidden>
      <span
        className="block"
        style={{ width: 4, height: 9.5, borderRadius: 2, backgroundColor: "currentColor" }}
      />
      <span
        className="mt-[0.5px] block"
        style={{ width: 4, height: 3, borderRadius: 1.5, backgroundColor: "currentColor" }}
      />
    </span>
  )
}

/**
 * Um sinal. Ícone de severidade em disco Ø26 + UMA frase, sempre em uma linha
 * só (D-07). O texto usa o tier `secundario` — medido mais escuro que o
 * contexto das recomendações (mínimo de tinta 75 contra 85) e mais claro que o
 * preto dos títulos.
 *
 * Só o PRIMEIRO NOME aparece, nunca o nome completo (C-35); isso já vem
 * resolvido na string da fixture e não é remontado aqui.
 */
function LinhaSinal({ item }: { item: SinalForaDoPadrao }) {
  const severo = item.iconeTom === "red"
  return (
    <li className="flex items-center gap-[18px]">
      <CirculoIcone tom={item.iconeTom} diametro={26} paleta={TOM_ICONE_TENUE}>
        {severo ? <TriangleAlert size={15} strokeWidth={2} /> : <Exclamacao />}
      </CirculoIcone>
      <p
        className="text-[11.5px] leading-[16px] whitespace-nowrap"
        style={{ color: TEXTO.secundario, letterSpacing: "-0.004em" }}
      >
        {item.texto}
      </p>
    </li>
  )
}

/**
 * Card "Sinais fora do padrão".
 *
 * MEDIDO: card x 907→1615, y 742→910. Título com cap top em 763 (⇒ `pt-[15px]`,
 * a mesma régua da peça A). Discos em x 926→952 (⇒ `px-[20px]`) e tinta do texto
 * a partir de 972 (⇒ 18px entre disco e texto). Centros dos discos em y 803 /
 * 835 / 868 e baselines do texto em 807,5 / 839,5 / 872,5: passo de 32,5, que é
 * exatamente o alvo de A-29 ⇒ linhas de 26px com `gap-[6.5px]` e `mt-[10px]`.
 *
 * O link de rodapé é UM só, do card inteiro, ancorado à direita (A-30). Baseline
 * medida em 882,5, ou seja 40px acima da base do card.
 */
export function CardSinais({ sinais }: { sinais: BlocoSinais }) {
  const itens = sinais.itens

  return (
    <Card className="relative h-full flex-1 px-[20px] pt-[15px]">
      <CardTitulo>{sinais.titulo}</CardTitulo>

      {itens.length === 0 ? (
        <FraseVazia texto={VAZIO_SINAIS} />
      ) : (
        <>
          <ul className="mt-[10px] flex flex-col gap-[6.5px]">
            {itens.map((item) => (
              <LinhaSinal key={item.id} item={item} />
            ))}
          </ul>
          <div className="absolute right-0 bottom-[40px] left-0">
            <LinkRodape rotulo={sinais.linkRodape} />
          </div>
        </>
      )}
    </Card>
  )
}
