// ---------------------------------------------------------------------------
// "Meu Mapa da Jornada" — Autogestão da minha Jornada, Tela 3.
// ---------------------------------------------------------------------------
// Referência visual: docs/gauntlet/autogestao-jornada/referencia/03-mapa-jornada.png
// Especificação: ESPECIFICACAO.md §21–§27 · Contrato: CONTRATO-DE-DADOS.md 3.1–3.9
//
// DIFERENÇA CONCEITUAL COM A VERSÃO DO GESTOR (`components/analytics/
// mapa-jornada/mapa-jornada-tab.tsx`): aquela é uma MATRIZ aluno × módulo (um
// roster inteiro). Esta é INDIVIDUAL — spec §21: "A visão individual não
// utiliza matriz aluno × módulo. Utiliza uma linha de percurso pessoal." Por
// isso a peça central aqui é uma TRILHA horizontal de um único aprendiz, não
// uma tabela de N linhas.
//
// REUSO: `Card`, `CardTitulo`, `CirculoIcone`, `CtaPilula`, `TEXTO`,
// `TOM_ICONE`, `FaltaProva`, `PilulaEstado` vêm de `design-autogestao.tsx`
// (que por sua vez reexporta a linguagem visual calibrada do Analytics do
// gestor). `situacaoDo`/`MioloNaoRenderizavel` NÃO reusam o par equivalente
// de `estado-bloco.tsx` do gestor: os 4 campos de `EstadoBloco` são iguais em
// forma, mas `motivoVazio` é um UNION LITERAL diferente em cada módulo
// (`MotivoAusencia` do gestor não contém "sem-plano", "jornada-concluida" etc
// que a Autogestão usa) — `tsc` reprova a reutilização cruzada. A versão
// local abaixo é deliberadamente mínima, tipada contra
// `lib/analytics/autogestao/tipos.ts`.
//
// SEM MATRIZ, SEM ILUSTRAÇÃO DECORATIVA: o doodle do gráfico ao lado de
// "Onde costumo perder ritmo?" na referência é puramente decorativo — o
// CONTRATO-DE-DADOS.md declara isso explicitamente ("Elemento decorativo não
// entra"). Nenhum campo do contrato o alimenta, então ele não é reproduzido.
//
// CTAs SEM DESTINO: nenhuma rota foi especificada para "Continuar módulo" /
// "Ver conteúdo" / "Ver meu plano" nesta rodada — os botões renderizam sem
// `href` (ramo inerte), mesmo padrão que `CtaPilula`/`CtaRodape` já usam no
// Analytics do gestor quando não há destino de navegação.
// ---------------------------------------------------------------------------

import {
  COR_ACAO,
  Card,
  CardTitulo,
  CirculoIcone,
  CtaPilula,
  FaltaProva,
  PilulaEstado,
  TEXTO,
  TOM_ICONE,
} from "@/components/analytics/autogestao/design-autogestao"
import type {
  BlocoHistorico,
  BlocoModuloAtual,
  BlocoPerdaDeRitmo,
  BlocoProximoMarco,
  BlocoTrilha,
  MapaJornadaAutogestaoDados,
  StatusModulo,
} from "@/lib/analytics/autogestao"
import {
  CTA_CONTINUAR_MODULO,
  CTA_VER_CONTEUDO,
  CTA_VER_MEU_PLANO,
  ROTULO_STATUS_MODULO,
  temLastro,
} from "@/lib/analytics/autogestao"
import { AlertTriangle, BookOpen, Check, Flag, Lock } from "lucide-react"
import type { ComEstadoParcial } from "../estado-bloco"
import { CorpoNaoRenderizavel, situacaoDo } from "../estado-bloco"

// ===========================================================================
// Primitivas locais (escopo desta tela, não exportadas)
// ===========================================================================

/** O único botão de preenchimento sólido desta tela — "Continuar módulo". */
function BotaoPrimario({ rotulo }: { rotulo: string }) {
  return (
    <span
      className="inline-flex w-fit cursor-pointer items-center rounded-[8px] px-[14px] py-[8px] text-[12px] font-semibold text-white"
      style={{ backgroundColor: COR_ACAO }}
    >
      {rotulo}
    </span>
  )
}

/** O estado vazio/erro do card, distribuído na folga em vez de empilhado embaixo. */
function MioloNaoRenderizavel({ bloco }: { bloco: ComEstadoParcial }) {
  if (situacaoDo(bloco) === "ok") return null
  return (
    <div className="flex flex-1 flex-col justify-center">
      <CorpoNaoRenderizavel bloco={bloco} />
    </div>
  )
}

/**
 * Barra de proporção (progresso), trilho cinza + preenchimento tingido.
 *
 * O DEFAULT é o laranja de AÇÃO (`COR_ACAO`), porque a única barra que a régua
 * amarra a essa cor é a do módulo que se pode continuar agora (M-14) — ela
 * pertence ao mesmo bloco do botão sólido. Nas linhas do histórico, porém, a
 * barra descreve um ESTADO já encerrado ou em curso, e pintá-la de laranja de
 * ação punha uma linha 100% concluída (nó verde, rótulo verde, pílula verde)
 * exibindo a cor de "faça agora" — o mesmo estado com duas cores no mesmo
 * quadro (G-10). Por isso quem chama passa `cor`, e o histórico passa a cor do
 * próprio estado da linha.
 */
function BarraProgresso({ percentual, cor = COR_ACAO }: { percentual: number; cor?: string }) {
  const largura = Math.max(0, Math.min(100, percentual))
  return (
    <span className="block h-[8px] flex-1 rounded-full" style={{ backgroundColor: "#EDE9E6" }}>
      <span
        className="block h-full rounded-full"
        style={{ width: `${largura}%`, backgroundColor: cor }}
      />
    </span>
  )
}

/** rótulo de estado ("Concluído"/"Em andamento"/"Não iniciado") → tom de pílula. */
function tomDoRotuloEstado(rotulo: string): "green" | "amber" | "neutral" {
  if (rotulo === ROTULO_STATUS_MODULO.concluido) return "green"
  if (rotulo === ROTULO_STATUS_MODULO["em-andamento"]) return "amber"
  return "neutral"
}

/** A tinta do estado — a MESMA que o nó da trilha e a pílula do histórico usam. */
function tintaDoRotuloEstado(rotulo: string): string {
  return TOM_ICONE[tomDoRotuloEstado(rotulo)].ink
}

// ===========================================================================
// §22 — Minha jornada nos módulos (a trilha)
// ===========================================================================

/**
 * Círculo do nó da trilha. §22 é explícito: verde = concluído, laranja = em
 * andamento, cinza = não iniciado — NUNCA vermelho para "não iniciado". Os
 * três estados se distinguem por GLIFO além de cor (concluído = check,
 * andamento = livro, não iniciado = cadeado), então a régua sobrevive a
 * escala de cinza também.
 */
function NoDaTrilha({ status }: { status: StatusModulo }) {
  if (status === "concluido") {
    return (
      <span
        data-status-no="concluido"
        className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: TOM_ICONE.green.ink }}
      >
        <Check size={18} strokeWidth={3} />
      </span>
    )
  }
  if (status === "em-andamento") {
    return (
      <span
        data-status-no="em-andamento"
        className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full text-white"
        style={{
          backgroundColor: TOM_ICONE.amber.ink,
          boxShadow: `0 0 0 4px ${TOM_ICONE.amber.fill}`,
        }}
      >
        <BookOpen size={18} strokeWidth={2.4} />
      </span>
    )
  }
  return (
    <span
      data-status-no="nao-iniciado"
      className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full border"
      style={{ borderColor: "#D8D2CE", color: TEXTO.mudo, backgroundColor: "#FFFFFF" }}
    >
      <Lock size={16} strokeWidth={2.2} />
    </span>
  )
}

/** A cor do segmento entre dois nós — nunca vermelha (§22). */
function corDoSegmento(statusEsquerda: StatusModulo): string {
  if (statusEsquerda === "concluido") return TOM_ICONE.green.ink
  if (statusEsquerda === "em-andamento") return TOM_ICONE.amber.ink
  return "#D8D2CE"
}

/**
 * A ALTURA da faixa do nó, e o EIXO em que os segmentos correm.
 *
 * O nó em andamento é maior (44px + anel de 4px) que os demais (40px). Com os
 * nós empilhados direto na coluna, essa diferença empurrava numeral, título,
 * estado e percentual da coluna do módulo atual alguns pixels para baixo — a
 * linha de base do texto ficava serrilhada ao longo da trilha. Reservando uma
 * faixa de altura fixa e centrando o nó dentro dela, TODOS os centros de
 * círculo caem no mesmo eixo e todas as legendas voltam a se alinhar.
 */
const FAIXA_DO_NO = 52
const EIXO_DO_NO = FAIXA_DO_NO / 2

/**
 * A folga entre a borda do círculo e a ponta do segmento, em pixels.
 *
 * ISTO É O DEFEITO F-M-01. O desenho anterior era uma sequência de colunas de
 * largura fixa com um segmento de 36px SOLTO entre elas: sobravam ~45px de
 * vazio de cada lado, e o conector cobria 28% do vão. Oito nós com 72% de ar
 * entre eles não leem como trilha, leem como ilhas.
 *
 * O conserto não é "aumentar o 36px" — largura fixa em coluna elástica volta a
 * descolar assim que o número de módulos muda. O segmento passa a ser
 * ABSOLUTO, ancorado nos dois centros de círculo: começa no centro da própria
 * coluna mais esta folga e termina no centro da coluna seguinte menos ela
 * (`right: calc(-50% + folga)`, porque as colunas são de largura igual). Assim
 * a cobertura do vão é a mesma para 3 ou para 12 módulos, e o traço nasce
 * encostado no círculo.
 *
 * 30px = raio do nó comum (20) + 10 de respiro; contra o nó em andamento com
 * anel (raio efetivo 26) o respiro cai para 4px, que é justamente o que faz a
 * linha parecer atravessar o nó em vez de parar antes dele.
 */
const FOLGA_DO_NO = 30

function percentualDoNo(
  status: StatusModulo,
  moduloId: string,
  moduloAtual: BlocoModuloAtual,
): string | null {
  if (status === "concluido") return "100%"
  if (status === "nao-iniciado") return "0%"
  if (moduloAtual.conteudo && moduloAtual.conteudo.id === moduloId) {
    return `${moduloAtual.conteudo.progressoPercent}%`
  }
  return null
}

function CardTrilha({ bloco, moduloAtual }: { bloco: BlocoTrilha; moduloAtual: BlocoModuloAtual }) {
  const ok = situacaoDo(bloco) === "ok"
  return (
    <Card className="flex flex-col px-[20px] pt-[16px] pb-[12px]">
      <CardTitulo>Minha jornada nos módulos</CardTitulo>
      <MioloNaoRenderizavel bloco={bloco} />
      {ok ? (
        <div className="mt-[14px] flex items-start" data-testid="trilha-nos">
          {bloco.modulos.map((modulo, indice) => {
            const rotuloEstado = ROTULO_STATUS_MODULO[modulo.status]
            const pct = percentualDoNo(modulo.status, modulo.id, moduloAtual)
            const proximo = bloco.modulos[indice + 1]
            const tracejado =
              proximo !== undefined &&
              (modulo.status === "nao-iniciado" || proximo.status === "nao-iniciado")
            const tinta = corDoSegmento(modulo.status)
            return (
              <div
                key={modulo.id}
                className="relative flex min-w-[104px] flex-1 flex-col items-center px-[6px] text-center"
              >
                {proximo ? (
                  // M-08: sólido só ENTRE percorridos. O segmento que CHEGA a
                  // um módulo não iniciado é tracejado — é a fronteira entre o
                  // que já aconteceu e o que ainda não.
                  //
                  // Dois defeitos já corrigidos aqui, que não devem voltar:
                  //   1. o `backgroundColor` sólido ficava pintado POR BAIXO do
                  //      tracejado, e as falhas do `repeating-linear-gradient`
                  //      são `transparent` — o tracejado existia no código e
                  //      não no pixel. Sem trilho por baixo, ele aparece.
                  //   2. a largura era fixa (36px) dentro de coluna larga, e o
                  //      traço flutuava no meio do vão (F-M-01). Agora ele é
                  //      ancorado nos dois centros de círculo — ver FOLGA_DO_NO.
                  <span
                    aria-hidden="true"
                    data-segmento={tracejado ? "tracejado" : "solido"}
                    className="pointer-events-none absolute h-[2px]"
                    style={{
                      top: EIXO_DO_NO - 1,
                      left: `calc(50% + ${FOLGA_DO_NO}px)`,
                      right: `calc(-50% + ${FOLGA_DO_NO}px)`,
                      backgroundColor: tracejado ? "transparent" : tinta,
                      backgroundImage: tracejado
                        ? `repeating-linear-gradient(to right, ${tinta} 0 4px, transparent 4px 8px)`
                        : undefined,
                    }}
                  />
                ) : null}
                {/* A faixa de altura fixa é o que mantém todos os centros de
                    círculo — e portanto toda a legenda abaixo — no mesmo eixo,
                    mesmo com o nó em andamento sendo maior. */}
                <span
                  className="flex w-full items-center justify-center"
                  style={{ height: FAIXA_DO_NO }}
                >
                  <NoDaTrilha status={modulo.status} />
                </span>
                <span className="mt-[6px] text-[16px] font-bold" style={{ color: TEXTO.primario }}>
                  {modulo.ordem}
                </span>
                {/* Duas linhas reservadas: os títulos de módulo têm comprimentos
                    diferentes, e sem piso de altura o estado e o percentual das
                    colunas de título curto subiam, quebrando a leitura em faixas
                    horizontais que a referência tem. */}
                <span
                  className="mt-[3px] min-h-[30px] text-[12px] leading-[15px]"
                  style={{ color: TEXTO.secundario }}
                >
                  {modulo.titulo}
                </span>
                <span
                  className="mt-[4px] text-[11.5px] font-semibold"
                  style={{
                    color:
                      tomDoRotuloEstado(rotuloEstado) === "green"
                        ? TOM_ICONE.green.ink
                        : tomDoRotuloEstado(rotuloEstado) === "amber"
                          ? TOM_ICONE.amber.ink
                          : TEXTO.mudo,
                  }}
                >
                  {rotuloEstado}
                </span>
                {pct ? (
                  <span className="mt-[1px] text-[11px]" style={{ color: TEXTO.terciario }}>
                    {pct}
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}
    </Card>
  )
}

// ===========================================================================
// §23 — Onde estou agora
// ===========================================================================

function CardModuloAtual({ bloco, ordem }: { bloco: BlocoModuloAtual; ordem: number | null }) {
  const ok = situacaoDo(bloco) === "ok"
  const c = bloco.conteudo

  return (
    <Card className="flex flex-1 flex-col px-[20px] pt-[16px] pb-[12px]">
      <CardTitulo>Onde estou agora</CardTitulo>
      <MioloNaoRenderizavel bloco={bloco} />
      {ok && c ? (
        <div className="mt-[10px] flex flex-1 flex-col">
          {/* Peso e cor conferidos contra a referência: ali "Onde estou agora"
              é o título do card e "Módulo N — Nome" é a LINHA DE APOIO logo
              abaixo, em cinza e peso normal. Aqui estava a 17px em negrito, ou
              seja, MAIOR e mais pesada que o próprio título do card — a
              hierarquia invertida em relação à referência. O bloco continua
              tendo os mesmos níveis; o que muda é qual deles manda. */}
          <h3 className="text-[14px] leading-[19px]" style={{ color: TEXTO.secundario }}>
            {ordem ? `Módulo ${ordem} — ${c.titulo}` : c.titulo}
          </h3>

          <div className="mt-[12px] flex items-center gap-[12px]">
            {/* M-14 pede "preenchimento laranja e trilho cinza" — e a tinta é a
                do ESTADO "em andamento" (#E07104), a mesma do nó 5 na trilha e
                da linha correspondente no histórico. Este bloco é o módulo em
                curso por definição, então usar aqui o laranja de AÇÃO
                (#D54407) fazia a MESMA barra, do MESMO módulo, no MESMO
                percentual, aparecer em dois laranjas diferentes a dois
                centímetros de distância. Laranja de ação fica com os botões. */}
            <BarraProgresso
              percentual={c.progressoPercent}
              cor={tintaDoRotuloEstado(ROTULO_STATUS_MODULO["em-andamento"])}
            />
            <span
              className="w-[42px] shrink-0 text-right text-[13px] font-bold"
              style={{ color: TEXTO.primario }}
            >
              {c.progressoPercent}%
            </span>
          </div>

          <div className="mt-[13px] grid grid-cols-4 gap-[12px]">
            <EstatModulo rotulo="Iniciado em" valor={c.iniciadoEmRotulo || "—"} />
            <EstatModulo
              rotulo="Sessões concluídas"
              valor={`${c.sessoesConcluidas} de ${c.sessoesTotal}`}
            />
            <EstatModulo rotulo="Última atividade" valor={c.ultimaAtividadeLabel} />
            <EstatModulo rotulo="Tempo estimado" valor={c.estimativaRotulo ?? "—"} />
          </div>

          <div className="mt-[13px] flex gap-[10px]">
            <BotaoPrimario rotulo={CTA_CONTINUAR_MODULO} />
            <CtaPilula rotulo={CTA_VER_CONTEUDO} className="px-[14px] py-[8px]" />
          </div>
        </div>
      ) : null}
    </Card>
  )
}

function EstatModulo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10.5px]" style={{ color: TEXTO.mudo }}>
        {rotulo}
      </span>
      <span className="mt-[2px] text-[12.5px] font-semibold" style={{ color: TEXTO.primario }}>
        {valor}
      </span>
    </div>
  )
}

// ===========================================================================
// §24 — Meu próximo marco
// ===========================================================================

/**
 * M-19 / 3.6 — o prazo do marco só é imprimível se for COERENTE com o percurso
 * real, não apenas se `montagem.ts` conseguiu somar dias.
 *
 * `montarMapaAutogestao` já recusa o caso óbvio (`days: 0` → `semLastro`). O
 * caso que escapava é o plano DEGENERADO de outra forma: `startDate` antigo
 * mais durações curtas produzem um prazo que cai ANTES do início real do
 * módulo. O quadro então afirmava, lado a lado, "Iniciado em 12/08/2026" e
 * "Concluir ... até 01/08/2026" — um marco de conclusão onze dias anterior ao
 * início. Isso não é um prazo vencido (que seria informação legítima e útil):
 * é uma data que a soma do plano não tem como sustentar, e o usuário pode
 * conferir e descobrir errado sem sair da tela.
 *
 * A régua manda declarar "Falta prova", nunca uma data inventada. Aqui a
 * verificação é de RENDERIZAÇÃO: os dois fatos que se contradizem já chegam
 * prontos a esta tela (o início do módulo e o prazo), então não é preciso
 * banco, rota nem cenário novo para saber que um dos dois não pode ser dito.
 */
// Mesma convenção dos motivos de `lib/analytics/autogestao/textos.ts`: minúscula
// inicial e sem ponto final, porque o componente já emenda em "Falta prova.".
const MOTIVO_PRAZO_ANTERIOR_AO_INICIO =
  "a data que sai do seu plano cai antes do início real deste módulo"

function prazoAnteriorAoInicio(
  prazo: { dataISO: string },
  inicioModuloISO: string | null,
): boolean {
  if (!inicioModuloISO) return false
  const marcoMs = Date.parse(prazo.dataISO)
  const inicioMs = Date.parse(inicioModuloISO)
  if (Number.isNaN(marcoMs) || Number.isNaN(inicioMs)) return false
  return marcoMs < inicioMs
}

function CardProximoMarco({
  bloco,
  inicioModuloISO,
}: {
  bloco: BlocoProximoMarco
  /** Início REAL do módulo atual — a régua contra a qual o prazo é conferido. */
  inicioModuloISO: string | null
}) {
  const ok = situacaoDo(bloco) === "ok"
  const c = bloco.conteudo

  const prazoImprimivel =
    c !== null && temLastro(c.prazo) && !prazoAnteriorAoInicio(c.prazo, inicioModuloISO)

  return (
    <Card className="flex w-[320px] shrink-0 flex-col px-[20px] pt-[16px] pb-[12px]">
      <span className="flex items-center gap-[8px]">
        <Flag size={15} strokeWidth={2.2} style={{ color: COR_ACAO }} />
        <CardTitulo>Meu próximo marco</CardTitulo>
      </span>
      <MioloNaoRenderizavel bloco={bloco} />
      {ok && c ? (
        <div className="mt-[10px] flex flex-1 flex-col">
          {prazoImprimivel && temLastro(c.prazo) ? (
            <>
              <h3 className="text-[15px] font-bold" style={{ color: TEXTO.primario }}>
                Concluir {c.moduloTitulo} até {c.prazo.rotulo}
              </h3>
              <p
                className="mt-[8px] text-[11.5px] leading-[16px]"
                style={{ color: TEXTO.secundario }}
              >
                {c.texto}
              </p>
            </>
          ) : (
            // F-M-09 pede a MESMA anatomia nos dois ramos: afirmação em peso
            // forte em cima, apoio em cinza embaixo. O ramo sem prazo tinha só
            // a linha cinza de "Falta prova", e o card perdia a cabeça.
            //
            // A afirmação forte aqui é o módulo a concluir — `c.moduloTitulo`,
            // que é dado real do percurso e não depende do plano. O que falta
            // é a DATA, e é exatamente ela que continua não sendo dita: nenhum
            // prazo, nenhum número, nenhum travessão mudo. O apoio em cinza
            // deixou de ser `c.texto` ("mantém você dentro do ritmo previsto",
            // que pressupõe o prazo) e passou a ser o motivo real da ausência.
            <>
              <h3 className="text-[15px] font-bold" style={{ color: TEXTO.primario }}>
                Concluir {c.moduloTitulo}
              </h3>
              <FaltaProva
                className="mt-[8px]"
                motivo={temLastro(c.prazo) ? MOTIVO_PRAZO_ANTERIOR_AO_INICIO : c.prazo.motivo}
              />
            </>
          )}
          <div className="mt-auto pt-[14px]">
            <CtaPilula rotulo={CTA_VER_MEU_PLANO} className="px-[14px] py-[8px]" />
          </div>
        </div>
      ) : null}
    </Card>
  )
}

// ===========================================================================
// §25 — Onde costumo perder ritmo?
// ===========================================================================

/**
 * A ilustração decorativa à direita do bloco de ritmo (F-M-11).
 *
 * POR QUE ELA ENTRA, se o CONTRATO-DE-DADOS diz "elemento decorativo não
 * entra": aquela cláusula existe para impedir que um enfeite seja alimentado
 * por dado inventado — e ela continua valendo aqui em toda a sua força. Este
 * desenho NÃO tem eixo, rótulo, escala, valor nem série. Nenhuma barra
 * corresponde a nada; nenhuma altura é lida de campo algum. É uma marca d'água
 * num único cinza do próprio tema, `aria-hidden`, que o leitor de tela ignora.
 *
 * O que ele resolve é FORMA: a referência tem, do meio do card para a direita,
 * massa visual que equilibra o texto à esquerda. Sem nada ali, o card lia como
 * uma faixa de texto solta com metade da largura vazia.
 *
 * Nenhum traço aqui pode ganhar cor de estado (verde/âmbar/laranja) nem número:
 * no instante em que ganhasse, deixaria de ser marca d'água e passaria a
 * afirmar alguma coisa.
 */
function IlustracaoRitmo() {
  const TRACO = "#E3DDD8"
  const MASSA = "#EFEBE7"
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="248"
      height="92"
      viewBox="0 0 248 92"
      fill="none"
      className="pointer-events-none absolute right-[22px] bottom-[10px] hidden lg:block"
    >
      {/* nuvens */}
      <g fill={MASSA}>
        <ellipse cx="38" cy="20" rx="20" ry="9" />
        <ellipse cx="54" cy="17" rx="13" ry="8" />
        <ellipse cx="206" cy="30" rx="22" ry="9" />
        <ellipse cx="188" cy="28" rx="12" ry="7" />
      </g>
      {/* massa de blocos ascendente, sem escala e sem rótulo */}
      <g fill={MASSA}>
        <rect x="96" y="60" width="20" height="26" rx="4" />
        <rect x="124" y="48" width="20" height="38" rx="4" />
        <rect x="152" y="34" width="20" height="52" rx="4" />
        <rect x="180" y="52" width="20" height="34" rx="4" />
      </g>
      {/* fio contínuo com marcas — sem eixo, sem valor */}
      <path
        d="M18 78 L58 66 L106 56 L134 44 L162 26 L190 40 L230 34"
        stroke={TRACO}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g fill="#FFFFFF" stroke={TRACO} strokeWidth="1.6">
        <circle cx="58" cy="66" r="3.4" />
        <circle cx="134" cy="44" r="3.4" />
        <circle cx="190" cy="40" r="3.4" />
      </g>
      {/* bandeirinha no ponto mais alto, ecoando o ícone do marco */}
      <path d="M162 26 L162 4" stroke={TRACO} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M162 5 L180 10 L162 15 Z" fill={MASSA} stroke={TRACO} strokeWidth="1.6" />
      {/* NÃO existe linha de chão aqui de propósito: uma horizontal contínua sob
          os blocos leria como EIXO, e eixo é a promessa de uma escala que este
          desenho não tem e não pode ter. */}
    </svg>
  )
}

function CardPerdaDeRitmo({ bloco }: { bloco: BlocoPerdaDeRitmo }) {
  const situacao = situacaoDo(bloco)
  const c = bloco.conteudo
  // M-20 não abre exceção para estado vazio: o ícone circular à esquerda é
  // anatomia do bloco, não enfeite do caso feliz. Só o ramo de ERRO fica de
  // fora — `FalhaDoBloco` já traz o próprio alerta, e dois ícones de alerta
  // lado a lado seriam ruído.
  const comIcone = situacao !== "erro"
  // Sem dado não há alerta: um estado vazio informativo é azul (a cor de
  // neutro/informativo da paleta), não âmbar de atenção.
  const tom = situacao === "ok" ? "amber" : "blue"

  return (
    <Card className="relative flex min-h-[114px] flex-col overflow-hidden px-[20px] pt-[16px] pb-[12px]">
      <CardTitulo>Onde costumo perder ritmo?</CardTitulo>
      <IlustracaoRitmo />
      {comIcone ? (
        // No ramo vazio, ícone e frase já trazem `mt-[14px]` próprio — o
        // container não soma mais um, senão o card cresce à toa.
        // `lg:pr-` reserva a faixa da marca d'água: sem ele o texto corre por
        // baixo do desenho na largura cheia.
        <div
          className={`flex items-start gap-[14px] lg:pr-[280px] ${situacao === "ok" ? "mt-[10px]" : ""}`}
        >
          {/* `CorpoNaoRenderizavel` traz `mt-[14px]` próprio na frase; o ícone
              acompanha para os dois topos ficarem na mesma linha. */}
          <span className={situacao === "ok" ? "" : "mt-[14px]"}>
            <CirculoIcone tom={tom} diametro={40}>
              <AlertTriangle size={18} strokeWidth={2.1} />
            </CirculoIcone>
          </span>
          {situacao === "ok" && c ? (
            <div className="flex flex-col">
              <p className="text-[12.5px] leading-[18px]" style={{ color: TEXTO.primario }}>
                {c.texto}
              </p>
              <p className="mt-[4px] text-[11.5px]" style={{ color: TEXTO.terciario }}>
                Média de pausa nesses momentos: {c.mediaDiasPausa}{" "}
                {c.mediaDiasPausa === 1 ? "dia" : "dias"}.
              </p>
            </div>
          ) : (
            <CorpoNaoRenderizavel bloco={bloco} />
          )}
        </div>
      ) : (
        <MioloNaoRenderizavel bloco={bloco} />
      )}
    </Card>
  )
}

// ===========================================================================
// §26 — Histórico recente dos módulos
// ===========================================================================

function CardHistorico({ bloco }: { bloco: BlocoHistorico }) {
  const ok = situacaoDo(bloco) === "ok"

  return (
    <Card className="flex flex-col px-[20px] pt-[16px] pb-[10px]">
      <CardTitulo>Histórico dos últimos 3 módulos</CardTitulo>
      <MioloNaoRenderizavel bloco={bloco} />
      {ok ? (
        <table className="mt-[8px] w-full border-collapse" data-testid="historico-tabela">
          <thead>
            <tr style={{ borderBottom: "1px solid #DCD5D0" }}>
              <th
                className="pb-[6px] text-left text-[10.5px] font-semibold"
                style={{ color: TEXTO.mudo }}
              >
                Módulo
              </th>
              <th
                className="pb-[6px] text-left text-[10.5px] font-semibold"
                style={{ color: TEXTO.mudo }}
              >
                Progresso
              </th>
              <th
                className="pb-[6px] text-left text-[10.5px] font-semibold"
                style={{ color: TEXTO.mudo }}
              >
                Última atividade
              </th>
              <th
                className="pb-[6px] text-right text-[10.5px] font-semibold"
                style={{ color: TEXTO.mudo }}
              >
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {bloco.itens.map((item, indice) => (
              <tr
                key={item.id}
                style={{ borderTop: indice === 0 ? undefined : "1px solid #F1EDEA", height: 34 }}
              >
                <td className="text-[12px] font-semibold" style={{ color: TEXTO.primario }}>
                  {item.titulo}
                </td>
                <td className="pr-[14px]">
                  <span className="flex items-center gap-[8px]">
                    <span
                      className="w-[26px] text-[11px] tabular-nums"
                      style={{ color: TEXTO.secundario }}
                    >
                      {item.progressoPercent}%
                    </span>
                    {/* 190px, não 100. F-M-13 pede a barra na linha, e ela
                        existia — mas com 100px num vão de ~420px até a coluna
                        seguinte, o miolo da tabela lia como uma coluna estreita
                        seguida de meia largura vazia. A referência dá à barra
                        ~210px, e é ela que sustenta a leitura horizontal da
                        linha. */}
                    <span className="w-[190px]">
                      {/* G-10: a barra do histórico é semáforo de ESTADO, e usa
                          a mesma tinta do nó da trilha e da pílula da linha —
                          verde no concluído, âmbar no em andamento. O laranja
                          de AÇÃO fica reservado ao que se pode fazer agora. */}
                      <BarraProgresso
                        percentual={item.progressoPercent}
                        cor={tintaDoRotuloEstado(item.estadoLabel)}
                      />
                    </span>
                  </span>
                </td>
                <td className="text-[11.5px]" style={{ color: TEXTO.secundario }}>
                  {item.ultimaAtividadeLabel}
                </td>
                <td className="text-right">
                  <PilulaEstado
                    rotulo={item.estadoLabel}
                    tom={tomDoRotuloEstado(item.estadoLabel)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </Card>
  )
}

// ===========================================================================
// §27 — Mensagem final discreta
// ===========================================================================
//
// NÃO existe campo no contrato (CONTRATO-DE-DADOS.md 3.1–3.9) para uma
// mensagem personalizada nesta tela — nenhum sinal do banco alimenta este
// bloco. Por isso o texto é o literal genérico da própria especificação
// (§27, primeiro exemplo), nunca um dado inventado.
const MENSAGEM_FINAL = "Pequenos passos consistentes constroem jornadas sustentáveis."

/**
 * F-M-14 pede a anatomia do rodapé da referência: ícone à esquerda, título em
 * negrito e a frase NA LINHA SEGUINTE — não os dois emendados na mesma linha.
 *
 * O que estava aqui punha "Lembre-se." e a frase no mesmo parágrafo corrido, o
 * que apaga a distinção entre rótulo e mensagem: em uma linha só, o negrito lê
 * como ênfase dentro da frase, não como o título do bloco. Duas linhas separam
 * os dois níveis, que é a forma que a referência tem.
 *
 * O ícone NÃO copia o mascote da referência (é arte de apresentação, fora do
 * alvo por decisão da régua) — é o mesmo `CirculoIcone` do resto do produto,
 * na escala do bloco (40px, o mesmo diâmetro do ícone de "Onde costumo perder
 * ritmo?", para os dois blocos com ícone à esquerda desta tela lerem iguais).
 */
function RodapeLembrete() {
  return (
    <div
      className="flex items-center gap-[14px] rounded-[12px] px-[18px] py-[11px]"
      style={{ backgroundColor: "#F1EEFB" }}
    >
      <CirculoIcone tom="blue" diametro={40}>
        <Flag size={18} strokeWidth={2.1} />
      </CirculoIcone>
      <span className="flex flex-col">
        <span className="text-[13px] font-bold" style={{ color: TEXTO.primario }}>
          Lembre-se
        </span>
        <span className="mt-[2px] text-[12px] leading-[16px]" style={{ color: TEXTO.secundario }}>
          {MENSAGEM_FINAL}
        </span>
      </span>
    </div>
  )
}

// ===========================================================================
// A tela
// ===========================================================================

export function MapaJornadaAutogestaoTab({ dados }: { dados: MapaJornadaAutogestaoDados }) {
  const ordemAtual =
    dados.moduloAtual.conteudo && dados.trilha.modulos.length > 0
      ? (dados.trilha.modulos.find((m) => m.id === dados.moduloAtual.conteudo?.id)?.ordem ?? null)
      : null

  return (
    // gap-[12px], não 16. A régua exige o rodapé "Lembre-se" DENTRO do quadro
    // de 1080px (F-M-14), e a moldura de preview soma ~76px de cabeçalho de
    // produto que a referência não tem. Os 4 vãos entre cards eram a folga mais
    // barata de devolver: 4px cada é imperceptível na leitura de bloco e
    // devolve 16px de altura útil ao rodapé, que antes caía fora do frame.
    <div className="flex flex-col gap-[12px]" data-testid="mapa-jornada-autogestao">
      <CardTrilha bloco={dados.trilha} moduloAtual={dados.moduloAtual} />

      <div className="flex flex-col gap-[12px] lg:flex-row">
        <CardModuloAtual bloco={dados.moduloAtual} ordem={ordemAtual} />
        <CardProximoMarco
          bloco={dados.proximoMarco}
          inicioModuloISO={dados.moduloAtual.conteudo?.iniciadoEmISO ?? null}
        />
      </div>

      <CardPerdaDeRitmo bloco={dados.perdaDeRitmo} />

      <CardHistorico bloco={dados.historico} />

      <RodapeLembrete />
    </div>
  )
}
