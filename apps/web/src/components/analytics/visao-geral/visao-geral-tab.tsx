// ---------------------------------------------------------------------------
// Aba "Visão geral" do Analytics do gestor.
//
// ESTADO DESTE ARQUIVO (peça A entregue, peças B–F ainda stub):
//   ✅ moldura — cabeçalho, 3 filtros globais, trinca de abas, carimbo de
//      frescor, e a grade 2 colunas × 3 linhas com a inversão de lado na linha 3;
//   ✅ card "Placar da jornada" — 5 tiles em fileira única, com ícone em disco,
//      rótulo, valor e variação em pontos percentuais;
//   ✅ card "O que mudou" — 3 marcadores em disco sólido, 3 frases e UM link de
//      rodapé (fechado na rodada 4; era a caixa vazia da linha 1);
//   ⛔ os outros 4 cards continuam CAIXAS ROTULADAS de propósito. Fingir
//      acabamento neles criaria falso verde. Cada um é a peça de outro agente.
//
// A SIDEBAR ESTÁ FORA DE ESCOPO por decisão do dono do produto (CRITERIOS.md,
// "NÃO É CRITÉRIO" item 0). Permanece o placeholder do stub: a navegação real da
// Academy entra depois, e nenhuma diferença ali gera FAIL.
//
// Referência visual: docs/sop/runs/_referencias/academy-analytics-gestor/01-visao-geral.png
// Régua: CRITERIOS.md · Dados: FIXTURE.md · Comportamento: INVARIANTES.md
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
import {
  COR_ACAO,
  COR_PAGINA,
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
// Cabeçalho — chips de filtro e carimbo de frescor
// ===========================================================================

/**
 * Chip de filtro: 40px de altura, raio 10 (nem pílula, nem quadrado), SEM
 * borda de contorno — B-14. A separação com o fundo é a mesma sombra do card.
 *
 * GEOMETRIA MEDIDA (rodada 5). A rodada 4 rodou 9–10px larga em cada chip. O
 * excesso NÃO estava no rótulo (a tinta de "Meu time" media 64 contra 63 da
 * referência) e sim nas quatro folgas horizontais. Medida de tinta na
 * referência, chip a chip (x das bordas brancas 842‥987 · 1006‥1200 · 1218‥1406):
 *
 *   folga             ref (tinta)   r4 (tinta)   CSS aqui
 *   borda → ícone .......  14–15        14        pl-[14px]      (mantido)
 *   ícone → rótulo ......  12–13        13–14     ml-[12px]      (era 13)
 *   rótulo → chevron ....  17–18        19–20     ml-[15px]      (era 16)
 *   chevron → borda .....  14–15        17        pr-[11px]      (era 14)
 *
 * O chevron de 16px desenha 10px de tinta (3px de inset por lado), então a
 * folga de TINTA é sempre 3px maior que o valor em CSS — daí `pr-[11px]` para
 * 14px medidos. Somando com o rótulo recalibrado abaixo, os três chips passam
 * de 155/205/198 para ~146/195/189, que é a medida da referência.
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
    <div
      className="flex min-w-0 flex-col py-[13px] pr-[12px] pl-[12px] whitespace-nowrap"
      style={{ backgroundColor: COR_TILE, borderRadius: RAIO_TILE }}
    >
      <div className="flex items-center gap-[13px]">
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

      {/* Variação: seta de traço + texto na MESMA cor, sem pílula atrás (B-27). */}
      <span
        className="mt-[16px] ml-[57px] flex items-center gap-[3px] text-[12px] leading-[16px] font-medium"
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
 */
const RITMO_TILES = "186fr 163fr 154fr 165fr 161fr"

function CardPlacar({ placar }: { placar: VisaoGeralFixture["placar"] }) {
  return (
    <Card className="flex h-full w-[909px] shrink-0 flex-col px-[14px] pt-[15px] pb-[38px]">
      {/* Sem subtítulo: o PNG não tem, e o PNG vence a spec (FIXTURE.md §13 D-a). */}
      <CardTitulo className="pl-[7px]">{placar.titulo}</CardTitulo>
      <div className="mt-[17px] grid gap-[13px]" style={{ gridTemplateColumns: RITMO_TILES }}>
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
    <Card className="relative h-full flex-1 px-[20px] pt-[15px]">
      <CardTitulo>{mudancas.titulo}</CardTitulo>

      <ul className="mt-[15px] flex flex-col gap-[12px]">
        {mudancas.itens.map((item) => (
          <li key={item.id} className="flex items-start gap-[17px]">
            <MarcadorMudanca item={item} />
            <p
              className="w-[196px] text-[12.2px] leading-[17px]"
              style={{ color: TEXTO.primario, letterSpacing: "-0.004em" }}
            >
              {item.texto}
            </p>
          </li>
        ))}
      </ul>

      {/* UM link para o card inteiro, nunca um por item (C-20 / §13 D-c). */}
      <div className="absolute right-0 bottom-[39px] left-0">
        <LinkRodape rotulo={mudancas.linkRodape} />
      </div>
    </Card>
  )
}

// ===========================================================================
// Stub das peças ainda não construídas
// ===========================================================================

function Caixa({ rotulo, nota, className }: { rotulo: string; nota: string; className?: string }) {
  return (
    <section
      className={`flex flex-col justify-between rounded-xl border border-dashed border-neutral-300 bg-white p-4 ${className ?? ""}`}
    >
      <h2 className="text-sm font-bold text-neutral-900">{rotulo}</h2>
      <p className="text-xs text-neutral-500">{nota}</p>
    </section>
  )
}

// ===========================================================================
// Tela
// ===========================================================================

export function VisaoGeralTab({ data }: { data: VisaoGeralFixture }) {
  const {
    sidebar,
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
    <div
      className="flex min-h-[941px] w-[1672px]"
      style={{ backgroundColor: COR_PAGINA, color: TEXTO.primario }}
    >
      {/* FORA DE ESCOPO — placeholder da navegação lateral (CRITERIOS.md item 0). */}
      <aside className="flex w-[201px] shrink-0 flex-col justify-between border-r border-neutral-200 bg-white p-4">
        <div>
          <p className="text-sm font-bold">{sidebar.marca.wordmark}</p>
          <p className="text-[10px] tracking-widest text-neutral-500">{sidebar.marca.subtitulo}</p>
          <ul className="mt-6 space-y-2">
            {sidebar.itens.map((item) => (
              <li
                key={item.id}
                className={
                  item.ativo ? "text-xs font-semibold text-orange-600" : "text-xs text-neutral-600"
                }
              >
                {item.rotulo}
              </li>
            ))}
          </ul>
        </div>
        <div className="text-xs">
          <p className="font-semibold">{sidebar.usuario.nome}</p>
          <p className="text-neutral-500">{sidebar.usuario.papel}</p>
        </div>
      </aside>

      <main className="flex-1 pt-[21px] pr-[56px] pl-[31px]">
        {/* Cabeçalho. A régua direita dos controles fica 11px antes da dos cards. */}
        <header className="flex items-start justify-between pr-[11px]">
          <div>
            {/* `wordSpacing` compensa o aperto que o `letterSpacing` negativo
                impõe também ao espaço: sem ele o vão de tinta entre as palavras
                cai para 6–7px, contra 8–9px da referência. */}
            <h1
              className="text-[33px] leading-[40px] font-bold"
              style={{
                color: TEXTO.primario,
                letterSpacing: "-0.021em",
                wordSpacing: "2px",
              }}
            >
              {cabecalho.titulo}
            </h1>
            <p
              className="mt-[9px] text-[14.8px] leading-[22px]"
              style={{ color: TEXTO.terciario, letterSpacing: "-0.004em" }}
            >
              {cabecalho.subtitulo}
            </p>
          </div>

          <div className="flex items-center gap-[17px]">
            {chipsFiltro.map((chip) => (
              <ChipFiltro key={chip.id} rotulo={chip.rotulo} icone={chip.icone} />
            ))}
            {/* Carimbo de frescor: sem caixa, sem borda (A-18).
                A fileira inteira é ancorada à DIREITA, então a largura deste
                carimbo é o que empurra os chips para a esquerda. Medido: a
                tinta de "Atualizado há 2h" ocupa 100px na referência (x
                1504‥1603) contra 116px a 15px, e o relógio 14px contra 15. A
                13px o carimbo volta a 123px de tinta começando em x≈1481, e o
                chip 3 reencontra a borda direita em x≈1406. */}
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
        <nav className="mt-[20px] flex gap-[17px]">
          {abas.map((aba) => (
            <span
              key={aba.id}
              className="px-[9px] pb-[6px] text-[14.1px] leading-[22px] whitespace-nowrap"
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

        {/* Grade: 2 colunas × 3 linhas. A linha 3 INVERTE o lado do bloco largo. */}
        <div className="mt-[17px] flex flex-col">
          {/* Linha 1: 160 → 361 na referência; a altura 201 e o `mt-[16px]`
              colocam o topo dos dois cards em y=160. */}
          <div className="flex h-[201px] gap-[14px]">
            <CardPlacar placar={placar} />
            <CardMudancas mudancas={mudancas} />
          </div>
          <div className="mt-[14px] flex h-[357px] gap-[14px]">
            <Caixa
              className="w-[909px] shrink-0"
              rotulo={atencao.titulo}
              nota="4 pílulas + 4 linhas · stub"
            />
            <Caixa className="flex-1" rotulo={recomendacoes.titulo} nota="3 recomendações · stub" />
          </div>
          <div className="mt-[12px] flex h-[168px] gap-[13px]">
            <Caixa
              className="w-[662px] shrink-0"
              rotulo={resposta.titulo}
              nota="3 estatísticas · stub"
            />
            <Caixa className="flex-1" rotulo={sinais.titulo} nota="3 sinais · stub" />
          </div>
        </div>
      </main>
    </div>
  )
}
