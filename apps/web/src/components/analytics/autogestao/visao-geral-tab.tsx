// ---------------------------------------------------------------------------
// Autogestão da minha Jornada — Tela 1 "Visão Geral" (ESPECIFICACAO.md §7–14).
// ---------------------------------------------------------------------------
// Responde: "Como estou conduzindo minha jornada agora e qual é meu próximo
// movimento?" — a mais simples e acionável das três telas.
//
// TODO bloco declara `estado: "ok" | "vazio" | "erro"` (`ComEstado<T>`,
// `lib/analytics/autogestao/tipos.ts`) e os três são desenhados aqui: "erro"
// nunca vira zero renderizado (I-4 do gestor), "vazio" usa o literal da §31
// (nunca um número inventado), "ok" mostra o conteúdo real.
//
// SEM LASTRO (CONTRATO-DE-DADOS.md): onde a spec pede um número sem fonte no
// banco (meta de frequência semanal, meta de reflexões), o campo chega como
// `SemLastro` e é desenhado com `<FaltaProva/>` — nunca um número inventado,
// nunca "0", nunca travessão mudo.
// ---------------------------------------------------------------------------

import {
  CONVITE_SINAIS_PARA_PLANO,
  CTA_AJUSTAR_MEU_PLANO,
  CTA_CRIAR_PLANO,
  CTA_DEFINIR_AGORA,
  CTA_MONTAR_MEU_PLANO,
  MOTIVO_PLANO_AUSENTE,
  ROTULO_RITMO_SEM_PLANO,
  SINTESE_SEM_PLANO,
  TEXTO_PROXIMO_MOVIMENTO_SEM_PLANO,
  TITULO_PROXIMO_MOVIMENTO_SEM_PLANO,
  temLastro,
} from "@/lib/analytics/autogestao"
import type {
  BlocoAtencaoAutogestao,
  BlocoMudancasAutogestao,
  BlocoRespostaAosAjustes,
  BlocoSinaisDoMomento,
  EstadoRitmo,
  ItemAtencao,
  Tom,
  ToneVariacao,
  VisaoGeralAutogestaoDados,
} from "@/lib/analytics/autogestao"
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Bell,
  BookOpen,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  Clock3,
  Flag,
  Info,
  Lightbulb,
  Rocket,
  TrendingUp,
} from "lucide-react"
import type { ComponentType, ReactNode } from "react"
// `CtaRodape` não é reexportado por `./design-autogestao` (só `LinkRodape`,
// que embute geometria de rodapé de card). O link inline de "Definir agora"
// junto do "Falta prova" precisa da aparência SEM a ancoragem absoluta — por
// isso vem direto da fonte, mesma peça que `LinkRodape` já consome por baixo.
import { CtaRodape } from "../visao-geral/design"
import {
  COR_TILE,
  Card,
  CardTitulo,
  CirculoIcone,
  CtaPilula,
  FUNDO_SINTESE,
  FaltaProva,
  TEXTO,
  TOM_ICONE,
  TOM_ICONE_SUAVE,
  VARIACAO,
} from "./design-autogestao"

/**
 * O PADRÃO DE RESPIRO desta tela, num lugar só.
 * ---------------------------------------------------------------------------
 * Não é preciosismo: a tela é fotografada em 1440×1080 e o rodapé "Dica
 * Exímia" caía FORA do quadro por 60px. A referência do dono acomoda as mesmas
 * cinco fileiras MAIS o rodapé inteiro nos mesmos 1080px — o que sobrava aqui
 * era espaço morto (padding vertical folgado em cinco cards empilhados, mais
 * quatro respiros de 18px entre eles), não volume de conteúdo.
 *
 * O padding HORIZONTAL não muda: os cards têm 1352px de largura e apertá-los
 * lateralmente pioraria a leitura sem devolver um pixel de altura.
 */
const PADDING_CARD = "px-[20px] py-[16px]"
/**
 * Respiro entre os blocos empilhados. Um número só — G-09 pede constância.
 *
 * 12, não 14 (2026-08-23): as caixas de "Sinais do meu momento" ganharam o
 * glifo grande que a referência mostra, e a fileira cresceu 26px. Como o
 * rodapé "Dica Exímia" já vivia a 20px da borda inferior do quadro de
 * 1440×1080, a diferença o empurrava PARA FORA — um rodapé cortado custa mais
 * critério do que os 2px de respiro que este número devolve.
 */
const RESPIRO_ENTRE_BLOCOS = "gap-[12px]"

const TOM_DO_RITMO: Record<EstadoRitmo, Tom> = {
  adiantado: "green",
  "no-ritmo": "green",
  "abaixo-do-ritmo": "amber",
  retomando: "blue",
}

/** O glifo de um ícone Lucide, como os call sites o passam adiante. */
type Glifo = ComponentType<{ size?: number; strokeWidth?: number }>

/**
 * TÍTULO DE BLOCO — `CardTitulo` mais o ⓘ que a referência do dono coloca ao
 * lado de TODO título desta tela.
 *
 * O ⓘ é affordance de explicação, não decoração: ele carrega, em `title`, a
 * mesma frase que responde "de onde sai este bloco?". Onde não há frase, o
 * componente não inventa uma — ele simplesmente não desenha o glifo, porque um
 * ⓘ que não explica nada é pior que nenhum.
 */
function TituloBloco({
  children,
  explicacao,
  icone: Icone,
  tomIcone = "blue",
}: {
  children: ReactNode
  explicacao?: string
  /** Ícone do próprio bloco, à ESQUERDA do título (hoje só "Meu próximo movimento"). */
  icone?: Glifo
  tomIcone?: Tom
}) {
  return (
    <div className="flex items-center gap-[7px]">
      {Icone ? (
        <span style={{ color: TOM_ICONE[tomIcone].ink }} className="flex shrink-0">
          <Icone size={16} strokeWidth={2.2} />
        </span>
      ) : null}
      <CardTitulo>{children}</CardTitulo>
      {explicacao ? (
        <span className="flex shrink-0" style={{ color: TEXTO.mudo }} title={explicacao}>
          <Info size={13} strokeWidth={2} aria-hidden="true" />
        </span>
      ) : null}
    </div>
  )
}

/**
 * A PALETA DOS DISCOS DE ÍCONE DENTRO DE UM TILE TINTADO.
 *
 * `CirculoIcone` assume um disco pastel sobre superfície branca. Nos tiles da
 * §8 a superfície JÁ é o pastel — repetir o mesmo pastel dentro dele produziria
 * um disco invisível. O disco vira branco e o glifo mantém a tinta do tom, que
 * é o que a referência mostra: o círculo se destaca do fundo tintado e a cor
 * continua vindo do tema do tile (F-V-02).
 */
const PALETA_DISCO_EM_TILE: Record<Tom, { fill: string; ink: string }> = {
  green: { fill: "#FFFFFF", ink: TOM_ICONE.green.ink },
  amber: { fill: "#FFFFFF", ink: TOM_ICONE.amber.ink },
  blue: { fill: "#FFFFFF", ink: TOM_ICONE.blue.ink },
  red: { fill: "#FFFFFF", ink: TOM_ICONE.red.ink },
  neutral: { fill: "#FFFFFF", ink: TOM_ICONE.neutral.ink },
}

/**
 * A QUARTA COR da fileira de tiles — e por que ela existe (F-V-02).
 * ---------------------------------------------------------------------------
 * "Última atividade" é o único tile sem tom semântico: ele não está bom nem
 * ruim, é um carimbo de tempo. Herdando `neutral`, seu glifo saía CINZA, e a
 * fileira terminava monocromática — exatamente o que F-V-02 reprova ("todos
 * iguais ou monocromáticos"). Pior: quando o ritmo é "retomando" o primeiro
 * tile também é azul, e a fileira inteira reduzia a três cores, sendo uma
 * delas repetida.
 *
 * A referência do dono resolve isso com um sino ROXO — uma quinta família que
 * não colide com nenhum dos quatro estados de ritmo, justamente porque não
 * significa estado nenhum. É a mesma escolha aqui, e ela vive SÓ no disco: o
 * fundo do tile e o rótulo continuam neutros, porque o roxo é identidade do
 * indicador, não julgamento sobre ele.
 */
const PALETA_DISCO_TEMPO: Record<Tom, { fill: string; ink: string }> = {
  ...PALETA_DISCO_EM_TILE,
  neutral: { fill: "#FFFFFF", ink: "#7A5AD1" },
}

/**
 * O QUE CADA ⓘ EXPLICA. Frases sobre a PROCEDÊNCIA do bloco (de onde sai o
 * número), nunca sobre o resultado — descrever o resultado no tooltip seria
 * repetir o que já está renderizado, e esconder no `title` o que importa é
 * exatamente o defeito I-2 do analytics do gestor.
 */
const EXPLICACAO_COMO_ESTOU =
  "Sua posição atual, calculada a partir das suas sessões no período e do seu plano."
const EXPLICACAO_MUDANCAS = "Comparação entre este período e o período anterior de mesma duração."
const EXPLICACAO_ATENCAO = "Pontos abertos identificados nas suas sessões e no seu plano."
const EXPLICACAO_RESPOSTA = "O que mudou desde a fotografia tirada quando você confirmou seu plano."
const EXPLICACAO_SINAIS = "Padrões observados no seu próprio comportamento de estudo."
const EXPLICACAO_PROXIMO_MOVIMENTO =
  "Um movimento por vez, escolhido pela prioridade do que está aberto hoje."

/** Frase discreta de rodapé — literal do §27, estática (não depende de dado). */
const DICA_EXIMIA = "Pequenos passos consistentes constroem jornadas sustentáveis."

function DicaRodape() {
  return (
    <Card
      className="flex items-center gap-[12px] px-[20px] py-[11px]"
      style={{ backgroundColor: FUNDO_SINTESE.amber }}
    >
      <CirculoIcone tom="amber" diametro={32}>
        <Lightbulb size={16} strokeWidth={2} />
      </CirculoIcone>
      {/*
        DUAS LINHAS, não uma. O título é rótulo do bloco e o conselho é o
        conteúdo — na mesma linha eles competem pelo mesmo peso e o rodapé lê
        como uma frase corrida qualquer (F-V-17 da régua de fidelidade).
      */}
      <div className="min-w-0">
        <p className="text-[13px] leading-[18px] font-semibold" style={{ color: TEXTO.primario }}>
          Dica Exímia
        </p>
        <p className="text-[12.5px] leading-[17px]" style={{ color: TEXTO.secundario }}>
          {DICA_EXIMIA}
        </p>
      </div>
    </Card>
  )
}

/**
 * §31 "Sem plano individual" — OS DOIS ESTADOS NASCEM JUNTOS
 * (CONTRATO-DE-DADOS.md, decisão do dono 2026-08-21): com plano e SEM plano,
 * e sem plano é o caminho MAJORITÁRIO (5 planos ativos para 302 matrículas
 * medidos em produção), não uma borda. Por isso este callout SOMA ao card já
 * preenchido com dados reais (ritmo, regularidade, progresso continuam
 * computáveis sem plano) — o "mesmo capricho da tela cheia" que o briefing
 * pede, não uma tela vazia separada.
 *
 * O sinal de "sem plano" é o motivo EXATO da ausência de lastro em
 * `progresso.metaHoje` (`MOTIVO_PLANO_AUSENTE`), nunca uma heurística frouxa:
 * um plano com duração zerada (`MOTIVO_PLANO_SEM_DURACAO`, achado do dono, 4
 * de 5 planos reais) TEM plano — não deve acionar este CTA.
 */
/**
 * O ÚNICO CTA ENDEREÇÁVEL ("Criar meu plano" com `href`) desta tela sem
 * plano — a instância que a suíte verifica por `role="link"`. "Meu próximo
 * movimento" (mais abaixo) também mostra "Criar meu plano" como pílula
 * PRIMÁRIA, sem `href` (mesmo padrão inerte que os demais CTAs de próximo
 * movimento já usam, `visao-geral-tab.test.tsx`/`painel.test.tsx`,
 * 2026-08-22): as DUAS instâncias são intencionais — uma reforça o motivo
 * (aqui, junto do texto explicativo), a outra é o convite âncora do bloco de
 * ação. Nenhuma delas duplica destino: o `href` mora só aqui.
 */
function CalloutSemPlano() {
  return (
    <div
      className="mt-[12px] flex flex-wrap items-center justify-between gap-[10px] rounded-[10px] border px-[14px] py-[11px]"
      style={{ borderColor: "#F0A585", backgroundColor: "#FCEDE5" }}
    >
      <span className="max-w-[420px] text-[12px] leading-[16px]" style={{ color: TEXTO.primario }}>
        Você ainda não definiu seu plano. Crie uma referência para acompanhar seu próprio ritmo.
      </span>
      <CtaPilula rotulo={CTA_CRIAR_PLANO} href="/meu-plano" />
    </div>
  )
}

// ===========================================================================
// §8 — Como está minha jornada agora?
// ===========================================================================

/**
 * O TILE DA §8 — DUAS COLUNAS: disco de ícone à esquerda, texto à direita.
 * ---------------------------------------------------------------------------
 * Era uma coluna só, encostada no padding esquerdo. A referência do dono põe,
 * em cada um dos quatro, um disco tintado de ~46px à esquerda e a pilha
 * rótulo/valor/apoio à direita — e essa ausência sozinha derrubava quatro
 * critérios da régua de fidelidade de uma vez (F-V-01, F-V-02 e, por arrasto,
 * F-V-03/F-V-04, porque dois dos quatro tiles ficavam sem linha de apoio e com
 * apenas dois níveis tipográficos em vez de três).
 *
 * O ícone NÃO é decoração: ele é o que distingue os quatro à distância de
 * leitura, antes de qualquer texto ser lido. Cada um carrega a tinta do
 * PRÓPRIO tom (F-V-02), nunca uma família só em quatro cópias.
 *
 * `apoio` é a TERCEIRA linha, e é obrigatória por desenho — um valor solto
 * sem apoio é o que faz o tile ler como duas linhas de tabela. Onde o apoio
 * depende de um número que o banco não tem, quem chama passa `<FaltaProva/>`
 * com o motivo real; nunca um número inventado para preencher a forma.
 */
function TileComoEstou({
  rotulo,
  tom,
  fundo,
  icone: Icone,
  paletaIcone = PALETA_DISCO_EM_TILE,
  children,
}: {
  rotulo: string
  tom: Tom
  fundo?: string
  icone: Glifo
  /** Só onde o tom semântico não dá cor própria ao glifo — ver `PALETA_DISCO_TEMPO`. */
  paletaIcone?: Record<Tom, { fill: string; ink: string }>
  children: ReactNode
}) {
  return (
    <div
      className="flex flex-1 basis-[220px] items-start gap-[11px] rounded-[10px] p-[13px]"
      style={{ backgroundColor: fundo ?? TOM_ICONE[tom].fill }}
    >
      {/*
        Disco de 46px com glifo de 22px — a proporção MEDIDA na referência
        (~51px de disco, ~24px de glifo). A 42/19 o ícone ainda lia como
        marcador de lista; aqui ele é o que distingue os quatro tiles à
        distância de leitura, antes de qualquer texto.
      */}
      <CirculoIcone tom={tom} diametro={46} paleta={paletaIcone}>
        <Icone size={22} strokeWidth={2} />
      </CirculoIcone>
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span
          className="text-[11px] font-semibold tracking-[0.02em] uppercase"
          style={{ color: TOM_ICONE[tom].ink }}
        >
          {rotulo}
        </span>
        {children}
      </div>
    </div>
  )
}

/** A LINHA DE APOIO do tile — o terceiro nível tipográfico (F-V-04). */
function ApoioTile({ children }: { children: ReactNode }) {
  return (
    <span className="text-[11.5px] leading-[16px]" style={{ color: TEXTO.terciario }}>
      {children}
    </span>
  )
}

/**
 * A LINHA DE APOIO DO TILE "RITMO" — paráfrase do estado, nunca dado novo.
 *
 * Cada frase abaixo é a leitura por extenso de `ritmo.estado`, que a camada de
 * dados já calculou; não há aqui nenhum número, prazo ou meta que o banco não
 * tenha dito. Vocabulário sem julgamento (spec §2 Regra 2): descreve a posição
 * em relação ao plano, nunca a pessoa.
 */
const APOIO_RITMO: Record<EstadoRitmo, string> = {
  adiantado: "Você está à frente do seu plano.",
  "no-ritmo": "Você está no ritmo do plano.",
  "abaixo-do-ritmo": "Você está abaixo do ritmo do plano.",
  retomando: "Você voltou a estudar depois de uma pausa.",
}

/** Um glifo por tile — o que os separa antes de o texto ser lido (F-V-01/02). */
const ICONE_TILE = {
  ritmo: TrendingUp,
  regularidade: CalendarClock,
  progresso: Flag,
  ultimaAtividade: Bell,
} as const

/**
 * O VALOR de um tile — o elemento de maior peso visual dentro dele.
 * ---------------------------------------------------------------------------
 * Os quatro tiles usam ESTE componente, sem exceção. Antes, "Ritmo" era o
 * único que fugia: desenhava o estado numa `PilulaEstado` de 12px, e a pílula
 * ainda empurrava o texto 10px para dentro por causa do próprio padding
 * horizontal. O resultado media 9px de tinta contra 21px dos vizinhos, com o
 * valor recuado em relação ao próprio rótulo — o tile que responde "como está
 * minha jornada agora" era o único que lia como vazio.
 *
 * A cor: "Ritmo" carrega a tinta do próprio estado (é um estado, e a cor é
 * parte do que ele informa); os demais usam a tinta primária, porque o dado
 * é um número e a cor já está no fundo do tile.
 */
function ValorTile({ children, cor = TEXTO.primario }: { children: ReactNode; cor?: string }) {
  return (
    <span className="text-[22px] leading-[26px] font-bold" style={{ color: cor }}>
      {children}
    </span>
  )
}

function BlocoComoEstou({
  dados,
  semPlano,
}: { dados: VisaoGeralAutogestaoDados; semPlano: boolean }) {
  if (dados.comoEstou.estado !== "ok" || !dados.comoEstou.conteudo) {
    return (
      <Card className={PADDING_CARD}>
        <TituloBloco explicacao={EXPLICACAO_COMO_ESTOU}>Como está minha jornada agora</TituloBloco>
        <p className="mt-[12px] text-[13px]" style={{ color: TEXTO.secundario }}>
          {dados.comoEstou.textoVazio ?? "Não foi possível carregar este bloco agora."}
        </p>
      </Card>
    )
  }
  const { ritmo, regularidade, progresso, ultimaAtividade } = dados.comoEstou.conteudo

  /**
   * O TILE RITMO, no estado "sem plano", NUNCA herda `ritmo.estado`/`rotulo`
   * calculados pela camada de dados ("No ritmo", "Retomando" — `montagem.ts`
   * força um desses dois mesmo sem plano, porque não pode inventar um estado
   * novo sem alterar o contrato). É este herdar silencioso que produzia a
   * afirmação de conformidade a um plano inexistente (achado do painel,
   * 2026-08-22). Aqui, na camada de apresentação, "sem plano" SEMPRE
   * sobrescreve para um rótulo neutro — nem verde, nem alarme.
   */
  const tomRitmo: Tom = semPlano ? "neutral" : TOM_DO_RITMO[ritmo.estado]
  const rotuloRitmo = semPlano ? ROTULO_RITMO_SEM_PLANO : ritmo.rotulo

  /** Mesma régua para a faixa de síntese (§9): sem plano, nunca "acompanhando
   * seu plano" — sempre o convite a definir a referência. */
  const sinteseTom: Tom = semPlano ? "neutral" : dados.sintese.tom
  const sinteseTexto = semPlano ? SINTESE_SEM_PLANO : dados.sintese.texto

  return (
    <Card className={PADDING_CARD}>
      <TituloBloco explicacao={EXPLICACAO_COMO_ESTOU}>Como está minha jornada agora</TituloBloco>
      <div className="mt-[12px] flex flex-wrap gap-[12px]">
        <TileComoEstou rotulo="Ritmo" tom={tomRitmo} icone={ICONE_TILE.ritmo}>
          <ValorTile cor={TOM_ICONE[tomRitmo].ink}>{rotuloRitmo}</ValorTile>
          {/*
            Sem plano NÃO existe apoio a inventar: o motivo real da ausência é
            a própria linha de apoio, no desenho de "Falta prova" — nunca uma
            frase de conformidade a um plano que não existe.
          */}
          {semPlano ? (
            <FaltaProva motivo={MOTIVO_PLANO_AUSENTE} />
          ) : (
            <ApoioTile>{APOIO_RITMO[ritmo.estado]}</ApoioTile>
          )}
        </TileComoEstou>

        <TileComoEstou rotulo="Regularidade" tom="amber" icone={ICONE_TILE.regularidade}>
          <ValorTile>{regularidade.rotulo}</ValorTile>
          {temLastro(regularidade.meta) ? (
            <ApoioTile>Meta do plano: {regularidade.meta.rotulo}</ApoioTile>
          ) : (
            <div className="flex flex-col items-start gap-[2px]">
              <FaltaProva motivo={regularidade.meta.motivo} />
              {/*
                Sem `className` de posicionamento aqui de propósito: a própria
                primitiva (`CtaRodape` em `visao-geral/design.tsx`,
                `semPosicionamento`) aplica `relative` por padrão quando o call
                site não declara nenhum valor de `position`, contendo o
                `::before` que alarga a área de clique. Passar `relative` aqui
                seria redundante — a blindagem vive na primitiva desde
                2026-08-25, não mais em disciplina de call site.
              */}
              <CtaRodape rotulo={CTA_DEFINIR_AGORA} href="/meu-plano" />
            </div>
          )}
        </TileComoEstou>

        {/*
          O fundo de "Progresso" é o degrau MAIS CLARO do mesmo azul
          (`TOM_ICONE_SUAVE`), não o azul cheio. Motivo medido: o tom de
          "Ritmo" é semântico e, no estado "retomando", ele TAMBÉM é azul — os
          dois tiles ficavam com o mesmo #D4E1FA e só não colidiam por acaso,
          porque "Regularidade" está entre eles. Fixar o degrau aqui garante
          quatro fundos distintos em QUALQUER estado de ritmo, sem inventar uma
          quinta família de cor.
        */}
        <TileComoEstou
          rotulo="Progresso"
          tom="blue"
          fundo={TOM_ICONE_SUAVE.blue.fill}
          icone={ICONE_TILE.progresso}
        >
          <ValorTile>{progresso.rotulo}</ValorTile>
          {temLastro(progresso.metaHoje) ? (
            <ApoioTile>
              {progresso.deltaRotulo ?? `Meta do plano para hoje: ${progresso.metaHoje.rotulo}`}
            </ApoioTile>
          ) : (
            <FaltaProva motivo={progresso.metaHoje.motivo} />
          )}
        </TileComoEstou>

        <TileComoEstou
          rotulo="Última atividade"
          tom="neutral"
          icone={ICONE_TILE.ultimaAtividade}
          paletaIcone={PALETA_DISCO_TEMPO}
        >
          <ValorTile>{ultimaAtividade.rotulo}</ValorTile>
          {/*
            A ausência de recomendação é INFORMAÇÃO, não um vão: `montagem.ts`
            só recomenda um alvo quando o ritmo está abaixo do plano (1.7).
            Dizer isso por extenso é o apoio honesto deste tile — e não é
            "Falta prova", porque não falta prova nenhuma: o dado existe e diz
            que não há sessão a recomendar agora.
          */}
          <ApoioTile>
            {ultimaAtividade.proximaSessaoRotulo
              ? `Próxima sessão recomendada: ${ultimaAtividade.proximaSessaoRotulo}`
              : "Nenhuma sessão recomendada agora."}
          </ApoioTile>
        </TileComoEstou>
      </div>

      <div
        className="mt-[14px] flex items-center gap-[10px] rounded-[10px] px-[14px] py-[10px]"
        style={{ backgroundColor: FUNDO_SINTESE[sinteseTom] }}
      >
        <TrendingUp size={16} strokeWidth={2.2} style={{ color: TOM_ICONE[sinteseTom].ink }} />
        <p className="text-[13px] font-medium" style={{ color: TEXTO.primario }}>
          {sinteseTexto}
        </p>
      </div>

      {semPlano ? <CalloutSemPlano /> : null}
    </Card>
  )
}

// ===========================================================================
// §10 — O que mudou comigo?
// ===========================================================================

const TOM_VARIACAO: Record<ToneVariacao, string> = {
  positivo: VARIACAO.positivo,
  negativo: VARIACAO.negativo,
}

/**
 * A FRASE DE MUDANÇA, PARTIDA EM DOIS NÍVEIS — sem reescrever uma palavra.
 * ---------------------------------------------------------------------------
 * `montagem.ts` entrega uma frase inteira ("+8 sessões em relação ao período
 * anterior."). A referência mostra o valor em destaque e a comparação abaixo,
 * em cinza. O corte acontece no ÚNICO ponto onde a frase muda de assunto — o
 * "em relação a…" — e as duas metades são literalmente as mesmas palavras que
 * chegaram: nada é reescrito, nada é resumido, nada é inferido.
 *
 * Se a frase não tiver esse ponto de corte (formato que a montagem não produz
 * hoje, mas pode produzir amanhã), ela é desenhada inteira, num nível só. Um
 * `split` que não casa devolve a frase — nunca uma metade perdida.
 */
function partirMudanca(texto: string): [string, string | null] {
  const corte = texto.indexOf(" em relação ")
  if (corte < 0) return [texto, null]
  return [texto.slice(0, corte), texto.slice(corte + 1)]
}

/**
 * O NÚMERO da frase, destacado do resto dela (F-V-08) — sem reescrever nada.
 *
 * A referência põe o valor em peso e cor ("15%") e o objeto ao lado, em preto
 * ("frequência"). A frase que chega aqui já tem as duas coisas, na ordem que a
 * montagem escolheu; o que falta é só o RELEVO. Esta função acha a primeira
 * grandeza numérica do texto e devolve as três partes na ordem original —
 * antes, número, depois. Nenhuma palavra muda de lugar.
 *
 * Sem número na frase, devolve a frase inteira em `depois`: o relevo some, o
 * conteúdo não.
 */
const GRANDEZA = /[+-]?\d+(?:[.,]\d+)?\s*(?:p\.p\.|%|x)?/

function realcarNumero(texto: string): { antes: string; numero: string; depois: string } {
  const achado = GRANDEZA.exec(texto)
  if (!achado) return { antes: "", numero: "", depois: texto }
  return {
    antes: texto.slice(0, achado.index),
    numero: achado[0],
    depois: texto.slice(achado.index + achado[0].length),
  }
}

/** Uma CAIXA por sinal (F-V-06), com a seta grande à esquerda (F-V-07). */
function CaixaMudanca({ item }: { item: BlocoMudancasAutogestao["itens"][number] }) {
  const Seta = item.tom === "positivo" ? ArrowUp : ArrowDown
  const [valor, comparacao] = partirMudanca(item.texto)
  const { antes, numero, depois } = realcarNumero(valor)
  return (
    <li
      className="flex flex-1 basis-[170px] items-start gap-[9px] rounded-[10px] p-[10px]"
      style={{ backgroundColor: COR_TILE }}
    >
      {/*
        SETA SOLTA E GRANDE (F-V-07) — não uma seta dentro de uma medalhinha.
        -----------------------------------------------------------------------
        O disco de 28px comprimia a seta a 16px de traço; a referência do dono
        desenha ~34px de seta nua, e a direção (a única coisa que esta caixa
        precisa comunicar antes de qualquer leitura) é 2,4x mais visível assim.
        A tinta é a MESMA de `TOM_VARIACAO` que já pinta o número ao lado —
        seta e número dizem a mesma coisa e não podem discordar de cor.
      */}
      <span className="mt-[1px] flex shrink-0" style={{ color: TOM_VARIACAO[item.tom] }}>
        <Seta size={30} strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <p className="text-[12.5px] leading-[18px]" style={{ color: TEXTO.primario }}>
          {antes}
          <span className="text-[14.5px] font-bold" style={{ color: TOM_VARIACAO[item.tom] }}>
            {numero}
          </span>
          {depois}
        </p>
        {comparacao ? (
          <p className="text-[11px] leading-[15px]" style={{ color: TEXTO.terciario }}>
            {comparacao}
          </p>
        ) : null}
      </div>
    </li>
  )
}

function CardMudancas({ mudancas }: { mudancas: BlocoMudancasAutogestao }) {
  return (
    <Card className={`flex-1 ${PADDING_CARD}`}>
      <TituloBloco explicacao={EXPLICACAO_MUDANCAS}>O que mudou comigo?</TituloBloco>
      {mudancas.estado === "ok" && mudancas.itens.length > 0 ? (
        <ul className="mt-[12px] flex flex-wrap gap-[10px]">
          {mudancas.itens.map((item) => (
            <CaixaMudanca key={item.id} item={item} />
          ))}
        </ul>
      ) : (
        <p className="mt-[12px] text-[13px]" style={{ color: TEXTO.secundario }}>
          {mudancas.textoVazio ?? "Nada mudou de relevante desde o período anterior."}
        </p>
      )}
    </Card>
  )
}

// ===========================================================================
// §12 — Meu próximo movimento
// ===========================================================================

function CardProximoMovimento({
  dados,
  semPlano,
}: { dados: VisaoGeralAutogestaoDados; semPlano: boolean }) {
  const { proximoMovimento } = dados

  /**
   * Sem plano, o movimento NUNCA promete "voltar ao ritmo do seu plano" — não
   * há plano para voltar a ele. O convite converge para UM ato: criar a
   * referência. O CTA original (se houver — ex.: "Retomar sessão", quando
   * existe mesmo uma sessão aberta e concreta) desce a SECUNDÁRIO, nunca
   * some: a sessão em aberto continua sendo uma ação real, só deixa de ser a
   * ação PRIMEIRA. Movimentos que pressupõem um plano em si (ex.: "Retomar
   * meu plano"/"Ajustar meu plano", do tipo "quebra-de-regularidade") não são
   * reaproveitados como secundário — eles nomeiam algo que não existe.
   */
  const titulo = semPlano ? TITULO_PROXIMO_MOVIMENTO_SEM_PLANO : proximoMovimento.titulo
  const texto = semPlano ? TEXTO_PROXIMO_MOVIMENTO_SEM_PLANO : proximoMovimento.texto
  const ctaPrincipal = semPlano ? CTA_CRIAR_PLANO : proximoMovimento.ctaPrincipal
  const ctaSecundario = semPlano
    ? proximoMovimento.tipo === "sessao-parada"
      ? proximoMovimento.ctaPrincipal
      : null
    : proximoMovimento.ctaSecundario

  /**
   * O SEGUNDO BOTÃO — de contorno, e nunca uma ação inventada.
   * -------------------------------------------------------------------------
   * A referência mostra dois botões neste bloco: o ato primário e uma saída
   * lateral ("Ajustar meu plano"). Quando a camada de dados já entrega um
   * secundário, é ELE que aparece. Quando não entrega, o fallback é o único
   * destino que existe de verdade para quem TEM plano — a própria tela do
   * plano (`/meu-plano`). Sem plano, não há fallback: ajustar o que não existe
   * seria oferecer uma porta pintada na parede.
   */
  const ctaSecundarioFinal = ctaSecundario ?? (semPlano ? null : CTA_AJUSTAR_MEU_PLANO)

  return (
    <Card className={`flex-1 ${PADDING_CARD}`} style={{ backgroundColor: FUNDO_SINTESE.blue }}>
      <TituloBloco explicacao={EXPLICACAO_PROXIMO_MOVIMENTO} icone={Rocket} tomIcone="blue">
        Meu próximo movimento
      </TituloBloco>
      <h3
        className="mt-[10px] text-[17px] leading-[22px] font-bold"
        style={{ color: TEXTO.primario }}
      >
        {titulo}
      </h3>
      <p className="mt-[6px] text-[13px] leading-[19px]" style={{ color: TEXTO.secundario }}>
        {texto}
      </p>
      <div className="mt-[14px] flex flex-wrap gap-[10px]">
        <CtaPilula
          rotulo={ctaPrincipal}
          className="!bg-[var(--cta-tinta)] !text-white px-[16px] py-[8px]"
        />
        {ctaSecundarioFinal ? (
          <CtaPilula
            rotulo={ctaSecundarioFinal}
            href={ctaSecundarioFinal === CTA_AJUSTAR_MEU_PLANO ? "/meu-plano" : undefined}
            className="px-[16px] py-[8px]"
          />
        ) : null}
      </div>
    </Card>
  )
}

// ===========================================================================
// §11 — O que merece minha atenção?
// ===========================================================================

const ICONE_ATENCAO: Record<ItemAtencao["id"], typeof BookOpen> = {
  reflexoes: BookOpen,
  regularidade: CalendarClock,
  "sessao-aberta": Clock3,
}

function CardAtencao({ atencao }: { atencao: BlocoAtencaoAutogestao }) {
  return (
    <Card className={`flex-1 ${PADDING_CARD}`}>
      <TituloBloco explicacao={EXPLICACAO_ATENCAO}>O que merece minha atenção?</TituloBloco>
      {atencao.estado === "ok" && atencao.itens.length > 0 ? (
        <ul className="mt-[12px] flex flex-col gap-[12px]">
          {atencao.itens.map((item) => {
            const Icone = ICONE_ATENCAO[item.id] ?? AlertCircle
            return (
              <li key={item.id} className="flex items-start gap-[10px]">
                {/*
                  QUADRADO arredondado, não disco (F-V-09). A diferença não é
                  gosto: nesta tela o disco já significa "indicador" (os quatro
                  tiles da §8, os sinais da §14) e o quadrado significa "item
                  acionável de uma lista". Dois significados, duas formas.
                */}
                <span
                  className="flex shrink-0 items-center justify-center rounded-[8px]"
                  style={{
                    width: 30,
                    height: 30,
                    backgroundColor: TOM_ICONE.amber.fill,
                    color: TOM_ICONE.amber.ink,
                  }}
                >
                  <Icone size={15} strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold" style={{ color: TEXTO.primario }}>
                    {item.titulo}
                  </p>
                  <p className="text-[12.5px]" style={{ color: TEXTO.secundario }}>
                    {item.texto}
                  </p>
                  <span
                    className="mt-[2px] inline-block text-[12px] font-semibold"
                    style={{ color: TOM_ICONE.amber.ink }}
                  >
                    {item.acaoRotulo}
                  </span>
                </div>
                {/*
                  O chevron é a affordance de que a linha LEVA a algum lugar
                  (F-V-10) — e o destino já está nomeado ao lado, no
                  `acaoRotulo`. `aria-hidden` porque ele não acrescenta nada ao
                  leitor de tela que o rótulo da ação já não diga.
                */}
                <ChevronRight
                  size={16}
                  strokeWidth={2.2}
                  aria-hidden="true"
                  className="mt-[7px] shrink-0"
                  style={{ color: TEXTO.mudo }}
                />
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-[12px] text-[13px]" style={{ color: TEXTO.secundario }}>
          {atencao.textoVazio ?? "Nada precisa da sua atenção agora."}
        </p>
      )}
      {/*
        O LINK DE RODAPÉ DO BLOCO (F-V-11) — o rótulo é o DA RÉGUA.
        -----------------------------------------------------------------------
        HISTÓRICO, porque a troca desfaz uma decisão deliberada e ninguém
        deveria ter que reconstruí-la por arqueologia: até 28/08 este link
        dizia "Ver meu mapa da jornada", de propósito. O argumento era bom —
        `montagem.ts` §11 produz no máximo três itens (reflexões,
        regularidade, sessão em aberto) e a lista acima renderiza TODOS eles,
        sem corte, então um "ver todos" não revela nada além do que já está na
        tela, e prometer revelação sem revelar é porta pintada na parede.

        O que decidiu a favor da régua não foi o mérito, foi a AUTORIDADE: a
        `CRITERIOS-FIDELIDADE.md` fica fora do alcance de quem é medido por
        ela, e afrouxar um critério porque a tela discorda dele é exatamente o
        movimento que a régua existe para impedir. Quem pode relaxar F-V-11 é
        o dono da régua. A tensão está registrada em
        `docs/auditoria/consolidacao-2026-08-28/FIX-D-telas.md` (D7), com o
        argumento acima inteiro, para que a decisão seja dele e informada.

        O DESTINO NÃO MUDOU: continua a aba "Meu Mapa da Jornada", onde os
        módulos abertos que originam estes pontos aparecem por extenso. Muda o
        rótulo, não a existência da porta.

        Só aparece quando há item: um rodapé de "ver mais" pendurado embaixo de
        "nada precisa da sua atenção agora" convidaria a navegar para conferir
        um vazio.
      */}
      {atencao.estado === "ok" && atencao.itens.length > 0 ? (
        <div className="mt-[12px]">
          {/* Sem `className` de posicionamento — mesma razão do call site
              acima: a blindagem por padrão vive em `CtaRodape`
              (`semPosicionamento`, `visao-geral/design.tsx`) desde 2026-08-25,
              não mais em disciplina de call site. A seta "→" que a régua cita
              no rótulo é a affordance que `CtaRodape` já desenha (chevron),
              não um glifo digitado dentro do texto. */}
          <CtaRodape
            rotulo="Ver todos os pontos de atenção"
            href="/jornada?vista=autogestao&aba=mapa"
          />
        </div>
      ) : null}
    </Card>
  )
}

// ===========================================================================
// §13 — Resposta aos meus últimos ajustes
// ===========================================================================

/**
 * Coluna de métrica da §13, com a DIVISÓRIA vertical à esquerda (F-V-15).
 * A primeira não tem divisória — uma régua na borda do card não separa nada,
 * só desenha uma parede.
 */
function TileResposta({
  rotulo,
  primeira = false,
  children,
}: { rotulo: string; primeira?: boolean; children: ReactNode }) {
  return (
    <div
      className={`flex flex-col gap-[2px] ${primeira ? "pr-[10px]" : "pl-[12px] pr-[10px]"}`}
      style={primeira ? undefined : { borderLeft: "1px solid #EDE8E5" }}
    >
      <span className="text-[11px] leading-[15px]" style={{ color: TEXTO.terciario }}>
        {rotulo}
      </span>
      <span className="text-[15px] font-bold" style={{ color: TEXTO.primario }}>
        {children}
      </span>
    </div>
  )
}

/**
 * O MINI GRÁFICO do canto superior direito (F-V-14) — DOIS pontos, que é
 * exatamente quantos a camada de dados mede.
 * ---------------------------------------------------------------------------
 * A referência desenha uma série de sete pontos. Nós temos dois números reais
 * — a frequência média ANTES da confirmação do plano e a de DEPOIS — e é essa
 * a série que este gráfico mostra: um segmento entre duas medições, com os
 * dois pontos marcados. Interpolar cinco pontos intermediários para "parecer"
 * a referência seria desenhar cinco medições que nunca aconteceram.
 *
 * A tinta vem da direção do próprio par, nunca de um otimismo default: subiu é
 * verde, caiu é vermelho. `aria-hidden` porque os dois números já estão
 * renderizados por extenso na coluna "Frequência média", ao lado.
 */
function MiniLinhaFrequencia({ de, para }: { de: number; para: number }) {
  const teto = Math.max(de, para, 0.1)
  const y = (v: number) => 23 - (v / teto) * 15
  const cor = para >= de ? VARIACAO.positivo : VARIACAO.negativo
  return (
    <svg width={78} height={30} viewBox="0 0 78 30" aria-hidden="true" className="shrink-0">
      <title>Frequência média antes e depois</title>
      <line
        x1={5}
        y1={y(de)}
        x2={73}
        y2={y(para)}
        stroke={cor}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <circle cx={5} cy={y(de)} r={3} fill={cor} />
      <circle cx={73} cy={y(para)} r={3} fill={cor} />
    </svg>
  )
}

function CardResposta({ resposta }: { resposta: BlocoRespostaAosAjustes }) {
  return (
    <Card className={`flex-1 ${PADDING_CARD}`}>
      <div className="flex items-start justify-between gap-[12px]">
        <TituloBloco explicacao={EXPLICACAO_RESPOSTA}>Resposta ao meu plano</TituloBloco>
        {resposta.estado === "ok" && resposta.conteudo ? (
          <MiniLinhaFrequencia
            de={resposta.conteudo.frequenciaAntes}
            para={resposta.conteudo.frequenciaDepois}
          />
        ) : null}
      </div>
      {resposta.estado === "ok" && resposta.conteudo ? (
        <>
          {/*
            "Desde que confirmei meu plano", NÃO "Último ajuste".
            ------------------------------------------------------------------
            O rótulo anterior prometia o efeito da ÚLTIMA revisão do plano, e
            todos os números deste card medem desde `baseline.capturedAt` — a
            fotografia da PRIMEIRA confirmação, que é imutável. No cenário de
            prova a diferença foi de 21 dias contra 80: o card diria "há 21
            dias" ao lado de um "+12%" acumulado em 80.

            Trocar a DATA para `study_plans.recalculated_at` e manter os
            números do baseline seria pior — misturaria dois universos no
            mesmo card, que é exatamente o defeito de comparação que já custou
            caro no analytics do gestor. O cálculo está coerente; era o rótulo
            que mentia.

            A spec §13 pede o efeito do último ajuste, e esse dado não existe:
            `baseline` guarda uma foto só. Enquanto ele não for versionado por
            ajuste, este card responde a pergunta que ele CONSEGUE responder, e
            diz qual é. Decisão do dono, 2026-08-21.

            A frase virou COLUNA (2026-08-23). Ela dizia a mesma coisa que uma
            coluna diz, ocupando uma linha inteira acima delas — e a referência
            do dono tem QUATRO colunas com divisória, sendo a primeira
            exatamente esta ("Último ajuste / Há 21 dias"). O rótulo continua
            sendo o honesto ("Desde que confirmei meu plano"), não o da
            referência: o dado é a confirmação, não o último ajuste.
          */}
          {/*
            QUATRO colunas, separadas por divisória vertical (F-V-15). Os
            trilhos são desiguais de propósito: "Semanas dentro do plano" é a
            única que pode carregar um "Falta prova." inteiro, e apertá-la ao
            mesmo tamanho das outras a quebrava em quatro linhas, esticando o
            card em ~20px que ninguém pediu.
          */}
          <div className="mt-[12px] grid grid-cols-2 gap-y-[12px] sm:grid-cols-[0.85fr_1fr_0.6fr_1.25fr]">
            <TileResposta rotulo="Desde que confirmei meu plano" primeira>
              {resposta.conteudo.ultimoAjusteRotulo}
            </TileResposta>
            <TileResposta rotulo="Frequência média">
              {resposta.conteudo.frequenciaAntes} → {resposta.conteudo.frequenciaDepois}x/semana
            </TileResposta>
            <TileResposta rotulo="Progresso">
              {resposta.conteudo.progressoDeltaPp >= 0 ? "+" : ""}
              {resposta.conteudo.progressoDeltaPp}%
            </TileResposta>
            <TileResposta rotulo="Semanas dentro do plano">
              {temLastro(resposta.conteudo.semanasDentroDoPlano) ? (
                `${resposta.conteudo.semanasDentroDoPlano.cumpridas} de ${resposta.conteudo.semanasDentroDoPlano.total}`
              ) : (
                <FaltaProva
                  motivo={resposta.conteudo.semanasDentroDoPlano.motivo}
                  className="text-[11px] font-normal"
                />
              )}
            </TileResposta>
          </div>
          <p className="mt-[14px] text-[11.5px] italic" style={{ color: TEXTO.mudo }}>
            {resposta.conteudo.disclaimer}
          </p>
        </>
      ) : (
        <p className="mt-[12px] text-[13px]" style={{ color: TEXTO.secundario }}>
          {resposta.textoVazio ?? "Você ainda não fez nenhum ajuste no seu plano."}
        </p>
      )}
    </Card>
  )
}

// ===========================================================================
// §14 — Sinais do meu momento
// ===========================================================================

/**
 * O NOME DA CATEGORIA de cada sinal, por `id` — não um resumo do texto.
 *
 * `montagem.ts` já classifica cada sinal num dos três tipos abaixo; o título
 * aqui é a tradução legível desse `id`, e nada mais. Vocabulário sem
 * julgamento (spec §2 Regra 2): "mais frequente" é uma contagem observada,
 * "melhor"/"mais produtivo" seria uma avaliação que o dado não sustenta.
 *
 * As duas chaves de horário existem porque a fixture de componente usa
 * `melhor-horario` e a montagem real usa `horario-frequente` — a mesma
 * categoria com dois nomes de `id` vivos hoje.
 */
const TITULO_SINAL: Record<string, string> = {
  "horario-frequente": "Meu horário mais frequente",
  "melhor-horario": "Meu horário mais frequente",
  "dias-da-semana": "Meus dias mais frequentes",
  "latencia-retomada": "Tempo de retomada",
}

/** Um glifo por categoria de sinal — o mesmo critério do `TITULO_SINAL`. */
const ICONE_SINAL: Record<string, Glifo> = {
  "horario-frequente": Clock3,
  "melhor-horario": Clock3,
  "dias-da-semana": CalendarDays,
  "latencia-retomada": TrendingUp,
}

/**
 * Sem plano, "Sinais do meu momento" é o ÚNICO bloco desta tela que computa
 * sem depender de plano (comportamento puro: horário, dias da semana,
 * latência de retomada) — por isso o painel (Bush + Norman, 2026-08-22)
 * convergiu em subir este card para logo abaixo de "Como está minha jornada
 * agora" (ver `VisaoGeralAutogestaoTab`) e virá-lo matéria-prima do plano, com
 * um convite explícito a montar o ritmo a partir dele, em vez de deixá-lo como
 * consolo no rodapé da página.
 */
function CardSinais({
  sinais,
  semPlano = false,
}: { sinais: BlocoSinaisDoMomento; semPlano?: boolean }) {
  const temSinais = sinais.estado === "ok" && sinais.itens.length > 0
  return (
    <Card className={PADDING_CARD}>
      <TituloBloco explicacao={EXPLICACAO_SINAIS}>Sinais do meu momento</TituloBloco>
      {temSinais && sinais.estado === "ok" ? (
        <>
          {/*
            TRÊS TRILHOS, não uma fileira elástica (F-V-16).
            -------------------------------------------------------------------
            Com `flex-1` os dois sinais que a montagem produz hoje se esticavam
            até ~640px cada, e a 640px TODA frase desta seção cabe numa linha
            só — a caixa fechava em ~70px contra os ~110px da referência do
            dono. O trilho fixo de 1/3 é o que devolve a FORMA: a mesma caixa
            de ~430px da referência, com a descrição quebrando em duas linhas
            porque a largura a obriga, não porque alguém alongou o texto.

            O terceiro trilho fica vago quando a montagem só classifica dois
            sinais (é o caso do cenário fotografado: `dias-da-semana` exige
            histórico que este aluno não tem). Vago é a leitura honesta —
            preencher o trilho com um terceiro sinal inventado seria fabricar
            um padrão de comportamento que ninguém observou.
          */}
          <div className="mt-[12px] grid gap-[12px] sm:grid-cols-3">
            {sinais.itens.map((sinal) => {
              const Icone = ICONE_SINAL[sinal.id] ?? Lightbulb
              const titulo = TITULO_SINAL[sinal.id]
              return (
                <div
                  key={sinal.id}
                  className="flex min-h-[76px] items-start gap-[13px] rounded-[10px] p-[13px]"
                  style={{ backgroundColor: TOM_ICONE.green.fill }}
                >
                  {/*
                    GLIFO SOLTO E GRANDE, não medalhinha (F-V-16). O disco de
                    28–34px reduzia o ícone a ~16px de traço dentro de uma
                    moldura — 2,5x menos tinta que o glifo de ~40px da
                    referência, e o bloco inteiro passava a ler como legenda.
                    Aqui o traço é fino de propósito: um glifo grande com peso
                    de ícone pequeno vira mancha.
                  */}
                  <span className="mt-[1px] flex shrink-0" style={{ color: TOM_ICONE.green.ink }}>
                    <Icone size={38} strokeWidth={1.6} />
                  </span>
                  <div className="min-w-0">
                    {/*
                      O título é o NOME DA CATEGORIA do sinal (o `id` que a
                      montagem já classificou), nunca um resumo inventado do
                      conteúdo. Sem categoria conhecida não há título: o texto
                      aparece sozinho, em vez de ganhar um rótulo chutado.
                    */}
                    {titulo ? (
                      <p
                        className="text-[13px] leading-[18px] font-semibold"
                        style={{ color: TOM_ICONE.green.ink }}
                      >
                        {titulo}
                      </p>
                    ) : null}
                    <p className="text-[13px] leading-[18px]" style={{ color: TEXTO.primario }}>
                      {sinal.texto}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
          {semPlano ? (
            <div
              className="mt-[12px] flex flex-wrap items-center justify-between gap-[10px] rounded-[10px] border px-[14px] py-[11px]"
              style={{ borderColor: "#F0A585", backgroundColor: "#FCEDE5" }}
            >
              <span
                className="max-w-[420px] text-[12px] leading-[16px]"
                style={{ color: TEXTO.primario }}
              >
                {CONVITE_SINAIS_PARA_PLANO}
              </span>
              <CtaPilula rotulo={CTA_MONTAR_MEU_PLANO} href="/meu-plano" />
            </div>
          ) : null}
        </>
      ) : (
        <p className="mt-[12px] text-[13px]" style={{ color: TEXTO.secundario }}>
          {sinais.textoVazio ?? "Ainda não há sinais suficientes sobre o seu momento."}
        </p>
      )}
    </Card>
  )
}

// ===========================================================================
// Tela
// ===========================================================================

export function VisaoGeralAutogestaoTab({ dados }: { dados: VisaoGeralAutogestaoDados }) {
  if (dados.estado === "erro") {
    return (
      <Card className={PADDING_CARD}>
        <p className="text-[14px] font-semibold" style={{ color: TEXTO.primario }}>
          Não foi possível carregar esta tela agora
        </p>
        <p className="mt-[6px] text-[13px]" style={{ color: TEXTO.secundario }}>
          Nenhum número é exibido enquanto a leitura não for confiável.
        </p>
      </Card>
    )
  }

  if (dados.estado === "vazio") {
    return (
      <Card className="flex flex-col items-start gap-[10px] p-[24px]">
        <CardTitulo>Você ainda não começou sua jornada</CardTitulo>
        <p className="text-[13px]" style={{ color: TEXTO.secundario }}>
          {dados.sintese.texto}
        </p>
      </Card>
    )
  }

  /**
   * O sinal ÚNICO de "sem plano" (CONTRATO-DE-DADOS.md, decisão do dono
   * 2026-08-21): o motivo EXATO de ausência de lastro em `progresso.metaHoje`,
   * nunca uma heurística frouxa. Plano com duração zerada (`MOTIVO_PLANO_SEM_
   * DURACAO`) TEM plano — não entra aqui. Calculado UMA vez e propagado a
   * todo bloco que precisa deixar de afirmar conformidade a um plano
   * inexistente (achado convergente do painel, 2026-08-22).
   */
  const semPlano =
    dados.comoEstou.estado === "ok" &&
    dados.comoEstou.conteudo !== null &&
    !temLastro(dados.comoEstou.conteudo.progresso.metaHoje) &&
    dados.comoEstou.conteudo.progresso.metaHoje.motivo === MOTIVO_PLANO_AUSENTE

  const cardSinais = <CardSinais sinais={dados.sinaisDoMomento} semPlano={semPlano} />

  return (
    <div data-tela="visao-geral" className={`flex flex-col ${RESPIRO_ENTRE_BLOCOS}`}>
      <BlocoComoEstou dados={dados} semPlano={semPlano} />

      {/*
        Sem plano, "Sinais do meu momento" sobe para logo abaixo de "Como está
        minha jornada agora" — é matéria-prima do plano que falta, não um
        complemento de rodapé (Bush + Norman, 2026-08-22). Com plano, a ordem
        de hoje é preservada (regra de saída: "com plano, nada disso muda").
      */}
      {semPlano ? cardSinais : null}

      <div className={`flex flex-col lg:flex-row ${RESPIRO_ENTRE_BLOCOS}`}>
        <CardMudancas mudancas={dados.mudancas} />
        <CardProximoMovimento dados={dados} semPlano={semPlano} />
      </div>

      <div className={`flex flex-col lg:flex-row ${RESPIRO_ENTRE_BLOCOS}`}>
        <CardAtencao atencao={dados.atencao} />
        <CardResposta resposta={dados.respostaAosAjustes} />
      </div>

      {semPlano ? null : cardSinais}

      <DicaRodape />
    </div>
  )
}
