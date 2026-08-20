"use client"

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

import type { PessoaDaGaveta } from "@/lib/analytics/gaveta/tipos"
import { fichasDoGrupo } from "@/lib/analytics/visao-geral/gaveta"
import type {
  BlocoRecomendacoes,
  BlocoSinais,
  Recomendacao,
  SinalForaDoPadrao,
} from "@/lib/analytics/visao-geral/tipos"
import type { NudgeType } from "@/types/notifications"
import { Sparkles, TriangleAlert } from "lucide-react"
import { GatilhoPessoa, NOTA_PESSOA, useGaveta } from "../gaveta/gaveta"
import { useAcoes } from "./acoes"
import {
  COR_ACAO,
  COR_BORDA_BOTAO,
  COR_TILE,
  Card,
  CardTitulo,
  CirculoIcone,
  LinkRodape,
  MioloCard,
  RAIO_TILE,
  TEXTO,
  TOM_ICONE_SUAVE,
  TOM_ICONE_TENUE,
} from "./design"
import { FalhaDoBloco, situacaoDo } from "./estado-bloco"
import { ROTA_PESSOAS } from "./navegacao"

// ===========================================================================
// Estados vazios (invariante I-3)
// ===========================================================================

/**
 * Literais da SPEC-FUNCIONAL §32, replicados em FIXTURE.md §14. Ausência de
 * dado NUNCA vira `0`, `0 de 0` nem caixa em branco: vira frase.
 *
 * Continuam aqui como FALLBACK, e só isso: com dado real quem escolhe a frase é
 * a camada de dados (`textoVazio`), que sabe POR QUE o bloco esvaziou —
 * "ninguém no recorte" e "nenhum gargalo" são vazios diferentes e a §32 não
 * cobre o primeiro. A fixture não carrega esse campo, então o fallback é o que
 * mantém a rota de preview idêntica ao que ela já renderizava.
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
const CLASSE_CTA =
  "flex h-[26px] min-w-[96px] items-center justify-center bg-white px-[11px] text-[10.5px] leading-[14px] font-semibold whitespace-nowrap"
const ESTILO_CTA = {
  color: COR_ACAO,
  border: `1px solid ${COR_BORDA_BOTAO}`,
  borderRadius: 8,
  letterSpacing: "-0.004em",
} as const

/**
 * O `nudgeType` do envio de uma recomendação.
 *
 * Vem do RÓTULO porque o contrato não carrega outro discriminante: a camada de
 * dados marca `ctaEscreve` (escreve ou não) e nomeia o CTA, e só a regra D
 * (§29, "ritmo consistente") produz `ctaEscreve: true`, sempre com "Reconhecer".
 * O `else` cai em `inactive`, que é o tipo de um lembrete de retomada — o mesmo
 * default que a triagem canônica usa quando não é "nunca acessou".
 */
function tipoDaRecomendacao(ctaRotulo: string): NudgeType {
  return ctaRotulo === "Reconhecer" ? "top_performer" : "inactive"
}

function BotaoRecomendacao({
  item,
  nomePorAluno,
  fichaPorAluno,
}: {
  item: Recomendacao
  nomePorAluno?: Readonly<Record<string, string>>
  fichaPorAluno?: ReadonlyMap<string, PessoaDaGaveta>
}) {
  const { pedir } = useAcoes()
  const { abrir } = useGaveta()

  /**
   * Escreve ou navega?
   *
   * Com dado real o contrato responde: `ctaEscreve` é explícito. A fixture NÃO
   * carrega esse campo (ela é anterior a ele), e aí o desempate é o rótulo. A
   * direção do `??` importa: o desconhecido cai em ESCREVE, não em navega. Com
   * a polaridade invertida, um CTA novo que a camada de dados esquecesse de
   * marcar viraria um link inofensivo — e o dono do produto perderia de vista
   * que existe ali um botão que grava em banco. Errar para o lado da
   * confirmação (que não envia nada) é o erro barato.
   */
  const escreve = item.ctaEscreve ?? item.ctaRotulo !== "Ver pessoas"

  // CTA de INVESTIGAÇÃO ("Ver pessoas"): abre a GAVETA com quem a regra §29
  // escolheu, nominalmente.
  //
  // ERA um `<Link href={rotaDoGrupo(null)}>` — com o `null` CHUMBADO. A função
  // aceitava um bucket de triagem e sabia montar `/engagement?type=…`, mas nunca
  // era chamada com tipo, então os três CTAs caíam na mesma lista inteira do
  // recorte. O gestor lia "Reativar 6 pessoas sem acesso há mais de 14 dias",
  // clicava, e recebia as 45 do time sem nada dizendo quais eram as 6.
  //
  // `alunosAlvo` já é exatamente essa lista, calculada pela regra que escreveu a
  // frase. A gaveta a mostra com os oito campos da §30 — é a mesma informação
  // que o CTA promete, e ela não existia em nenhuma outra tela.
  if (!escreve) {
    return (
      <button
        type="button"
        className={`${CLASSE_CTA} cursor-pointer`}
        style={ESTILO_CTA}
        onClick={() =>
          abrir({
            tipo: "pessoas",
            titulo: item.titulo,
            subtitulo: item.contexto,
            nota: NOTA_PESSOA,
            pessoas: fichaPorAluno ? fichasDoGrupo(item.alunosAlvo, fichaPorAluno) : [],
            textoVazio: "Nenhuma pessoa deste grupo está no recorte atual.",
          })
        }
      >
        {item.ctaRotulo}
      </button>
    )
  }

  // CTA que ESCREVE ("Reconhecer"): abre a confirmação com o envelope à vista.
  // O envio em si depende do gate do <ProvedorAcoes/>, desligado por padrão.
  return (
    <button
      type="button"
      onClick={() =>
        pedir({
          rotulo: item.ctaRotulo,
          nudgeType: tipoDaRecomendacao(item.ctaRotulo),
          destinatarios: item.alunosAlvo.map((id) => ({
            id,
            // Sem nome conhecido o id vai cru para a confirmação. É feio de
            // propósito: inventar "Aluno" esconderia que a tela não sabe para
            // quem está prestes a mandar.
            nome: nomePorAluno?.[id] ?? id,
          })),
        })
      }
      className={CLASSE_CTA}
      style={ESTILO_CTA}
    >
      {item.ctaRotulo}
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
function BlocoRecomendacao({
  item,
  nomePorAluno,
  fichaPorAluno,
}: {
  item: Recomendacao
  nomePorAluno?: Readonly<Record<string, string>>
  fichaPorAluno?: ReadonlyMap<string, PessoaDaGaveta>
}) {
  return (
    <li
      className="flex items-start pt-[6px] pr-0 pb-[8px] pl-[7px]"
      style={{ backgroundColor: COR_TILE, borderRadius: RAIO_TILE }}
    >
      {/* O badge NÃO acompanha a primeira linha do título: ele começa 14px
          abaixo do topo do bloco, contra 12 do cap top do título (medido).
          Daí os 6px sobre o `pt-[8px]` do bloco.
          Ø30 → Ø28 na rodada 2 do painel (B-20 aceita 26 a 32 para badge
          numerado): é folga devolvida à coluna do CTA, não perda de escala —
          o numeral continua em 17,5px. */}
      <span className="mt-[4px] flex">
        <CirculoIcone tom={item.badgeTom} diametro={28} paleta={TOM_ICONE_SUAVE}>
          <span
            className="text-[17.5px] leading-[20px] font-semibold"
            style={{ letterSpacing: "-0.02em" }}
          >
            {item.prioridade}
          </span>
        </CirculoIcone>
      </span>

      <div className="ml-[13px] w-[236px] min-w-0">
        <p
          className="w-[196px] max-w-full text-[11.9px] leading-[16px] font-bold"
          style={{ color: TEXTO.primario, letterSpacing: "-0.004em" }}
        >
          {item.titulo}
        </p>
        <p
          className="mt-[1px] text-[10.6px] leading-[15px]"
          style={{ color: TEXTO.terciario, letterSpacing: "-0.002em" }}
        >
          {item.contexto}
        </p>
      </div>

      {/* Os 3 CTAs estão CENTRADOS no mesmo eixo (x ≈ 1529 na referência), e não
          encostados à direita: por isso a coluna do botão é `flex-1` centrada,
          e não `ml-auto`. `self-center` alinha ao centro do bloco (medido: 468
          contra 467 do centro do bloco 1).

          RODADA 2 DO PAINEL — aqui estava o custo escondido do estouro. Como o
          card era `flex-1` com `min-width: auto`, ele parou EXATAMENTE no
          mínimo do conteúdo: a coluna do CTA valia 106,7px e o botão "Enviar
          lembrete" media 106,7px, ou seja ZERO de folga, encostado na borda do
          bloco tonal. D-15 exige ≥10px. Os 11px devolvidos ao longo desta linha
          (pl 9→7, badge 30→28, ml 16→13, px do botão 13→11) mais os 436px de
          largura fixa do card dão 125px de coluna para um botão de 102,7 —
          11,1px de folga de cada lado. */}
      <div className="flex flex-1 shrink-0 justify-center self-center px-[10px]">
        <BotaoRecomendacao item={item} nomePorAluno={nomePorAluno} fichaPorAluno={fichaPorAluno} />
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
export function CardRecomendacoes({
  recomendacoes,
  nomePorAluno,
  fichaPorAluno,
}: {
  recomendacoes: BlocoRecomendacoes
  /** `alunoId` → nome, para a confirmação nomear quem receberia o envio. */
  nomePorAluno?: Readonly<Record<string, string>>
  /** `alunoId` → ficha da §30, para o CTA "Ver pessoas" abrir a gaveta. */
  fichaPorAluno?: ReadonlyMap<string, PessoaDaGaveta>
}) {
  const itens = recomendacoes.recomendacoes
  const situacao = situacaoDo(recomendacoes)

  return (
    // 436px de BASE (a largura medida), não de piso.
    //
    // Aqui havia `flex-1` sem `min-w-0`, para que um card que não coubesse
    // estourasse a linha em vez de clipar em silêncio. A intenção era boa e o
    // efeito foi o oposto do esperado: numa janela de 1512px (MacBook Pro 16")
    // a linha não cabia, o card não podia encolher, e ele saía 58px PARA FORA
    // da área visível — cortando exatamente os CTAs, com a barra de rolagem
    // overlay do Chromium escondendo o sintoma. O dono do produto viu os três
    // botões pela metade.
    //
    // Agora o card encolhe (`min-w-0`), mas com o MENOR peso da linha
    // (`shrink` 1 contra 3 do card ao lado): quem tem folga cede primeiro. E o
    // que encolhe DENTRO dele é a caixa de texto, nunca o CTA — ver
    // <BlocoRecomendacao/>. A régua completa está no comentário da grade em
    // `visao-geral-tab.tsx`.
    <Card className="h-full w-[436px] min-w-0 shrink grow px-[20px] pt-[12px]">
      <div className="flex items-center gap-[6px]">
        <Sparkles size={16} strokeWidth={2} style={{ color: COR_ACAO }} />
        <CardTitulo>{recomendacoes.titulo}</CardTitulo>
      </div>

      {/* Três ramos, não dois. `erro` NÃO pode cair no ramo do vazio: "nenhum
          gargalo" afirma que o time está bem, e uma consulta que quebrou não
          autoriza essa afirmação (I-4). */}
      {situacao === "erro" ? (
        <FalhaDoBloco bloco={recomendacoes} />
      ) : itens.length === 0 ? (
        <FraseVazia texto={recomendacoes.textoVazio ?? VAZIO_RECOMENDACOES} />
      ) : (
        <ul className="mt-[14px] -mr-[5px] -ml-[8px] flex flex-col gap-[10px]">
          {/* A chave é o `id` (a regra §29 que emitiu), não a `prioridade`.
              `prioridade` é ordinal de EXIBIÇÃO: se a lista mudar de composição
              entre dois renders, a posição 1 pode passar a ser outra
              recomendação e o React reaproveitaria o estado do bloco errado.
              O `id` diz QUAL recomendação é, que é o que a chave precisa dizer.
              (Antes daqui, a chave era `prioridade` e a camada de dados emitia
              gravidade nesse campo: duas regras críticas viravam duas chaves
              `1` e o React avisava "two children with the same key".) */}
          {itens.map((item) => (
            <BlocoRecomendacao
              key={item.id}
              item={item}
              nomePorAluno={nomePorAluno}
              fichaPorAluno={fichaPorAluno}
            />
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
function LinhaSinal({ item, ficha }: { item: SinalForaDoPadrao; ficha: PessoaDaGaveta | null }) {
  const severo = item.iconeTom === "red"
  return (
    <li className="flex items-center gap-[18px]">
      <CirculoIcone tom={item.iconeTom} diametro={26} paleta={TOM_ICONE_TENUE}>
        {severo ? <TriangleAlert size={15} strokeWidth={2} /> : <Exclamacao />}
      </CirculoIcone>
      {/* O sinal É sobre uma pessoa (`alunoId` sempre chega no contrato), então a
          frase é a porta para a ficha dela — o mesmo padrão do nome na fila da
          §10.1. Sem gatilho, este bloco era o único que nomeava alguém e não
          deixava olhar. A tipografia é a mesma: `GatilhoPessoa` não impõe cor. */}
      <GatilhoPessoa
        pessoa={ficha}
        className="min-w-0 text-[11.5px] leading-[16px]"
        // `style` fica no filho para o `<span>` do caminho degradado herdar o
        // mesmo tier de texto que o `<button>`.
      >
        <span style={{ color: TEXTO.secundario, letterSpacing: "-0.004em" }}>{item.texto}</span>
      </GatilhoPessoa>
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
export function CardSinais({
  sinais,
  fichaPorAluno,
}: {
  sinais: BlocoSinais
  fichaPorAluno?: ReadonlyMap<string, PessoaDaGaveta>
}) {
  const itens = sinais.itens
  const situacao = situacaoDo(sinais)

  return (
    // `h-full` → `alignSelf: stretch`: a linha 3 passou a ser `min-h-[155px]`
    // (ver `visao-geral-tab.tsx`) e `height: 100%` contra altura indefinida
    // desliga o esticamento em vez de garanti-lo.
    <Card
      className="relative flex w-[640px] min-w-0 shrink-[6] grow flex-col px-[20px] pt-[8px]"
      style={{ alignSelf: "stretch" }}
    >
      <CardTitulo>{sinais.titulo}</CardTitulo>

      {/* A reserva do rodapé vale em QUALQUER estado, inclusive nos dois em que
          o link nem é renderizado: um miolo que muda de altura conforme o estado
          faz o card pular ao trocar de dado. `centrado={false}` porque com 3
          sinais o card já está cheio; o estado vazio, que é onde sobra altura,
          usa o `justify-center` do próprio bloco vazio abaixo. */}
      <MioloCard centrado={itens.length === 0 || situacao === "erro"}>
        {situacao === "erro" ? (
          <FalhaDoBloco bloco={sinais} />
        ) : itens.length === 0 ? (
          <>
            <FraseVazia texto={sinais.textoVazio ?? VAZIO_SINAIS} />
            {/* Silêncio EXPLICADO. "Nenhum sinal" pode significar time saudável
              ou dois terços do roster sem histórico para comparar; a camada de
              dados sabe a diferença e a diz aqui. */}
            {sinais.textoComplementar ? (
              <p
                className="mt-[4px] text-[10.5px] leading-[15px]"
                style={{ color: TEXTO.mudo, letterSpacing: "-0.002em" }}
              >
                {sinais.textoComplementar}
              </p>
            ) : null}
          </>
        ) : (
          <>
            {/* gap 6,5 → 3 na rodada 7 (passo de 32,5 para 29) e 3 → 6 agora, com
              os 82px que a saída da bandeja de escopo devolveu: o passo volta a
              32, contra os 32,5 da referência e dentro dos 28 a 38 de A-29. O
              disco de 26 e a frase de 11,5px nunca mudaram. */}
            <ul className="mt-[6px] flex flex-col gap-[6px]">
              {itens.map((item) => (
                <LinhaSinal
                  key={item.id}
                  item={item}
                  ficha={fichaPorAluno?.get(item.alunoId) ?? null}
                />
              ))}
            </ul>
          </>
        )}
      </MioloCard>

      {/* O link SÓ existe quando há sinais para ver — mas a reserva dele existe
          sempre (ver <MioloCard/> acima). `folga` é a padrão: 4px da base do
          link até a base do card, que é onde o `bottom-[20px]` da caixa de
          altura zero de antes o punha. */}
      {situacao !== "erro" && itens.length > 0 ? (
        <LinkRodape rotulo={sinais.linkRodape} href={ROTA_PESSOAS} />
      ) : null}
    </Card>
  )
}
