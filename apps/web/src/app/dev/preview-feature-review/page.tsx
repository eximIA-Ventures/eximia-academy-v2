"use client"

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Compass,
  Footprints,
  LayoutDashboard,
  Moon,
  RotateCcw,
  Sparkles,
  SquareStack,
  Sun,
  Target,
  UserCircle,
  X,
} from "lucide-react"
import { useEffect, useState } from "react"

/**
 * PROTOTIPO DESCARTAVEL — Onboarding de novidades, fluxo SEQUENCIAL.
 *
 * Pedido do Hugo (2026-07-31), depois de reprovar o formato de indice:
 *   "acho melhor falar de uma novidade, depois a outra. Fala sobre o percorrido e
 *    concluir, depois mostra no app. conforme a pessoa clica em continuar ou
 *    pular, mostra um novo explicativo, falando sobre a jornada e mostra onde
 *    clicar. se a pessoa clicar, la dentro ensina a usar, se nao, para ai e so
 *    ensina a usar quando a pessoa clicar no [faixa da jornada]."
 *
 * A DIFERENCA EM RELACAO AO INDICE, e por que este desenho e melhor: o indice
 * pedia uma DECISAO antes de qualquer valor entregue ("escolha qual das duas ver"),
 * o que e trabalho cognitivo cobrado adiantado de alguem que ainda nao sabe o que
 * esta escolhendo. O fluxo sequencial entrega primeiro e pergunta depois, e cada
 * "continuar" e uma renovacao de consentimento barata.
 *
 * O PONTO MAIS FINO DO DESENHO, e o que o Hugo especificou: o tour do construtor
 * NAO acontece se a pessoa recusar. Ele fica ARMADO e dispara na primeira vez que
 * ela entrar pela faixa, por vontade propria. Ou seja, o ensino chega no momento
 * em que ela pediu, nao no momento em que nos queriamos dar. Isso troca
 * interrupcao por oportunidade.
 *
 * NOODLES: um por etapa, todos com o traco clareado na raiz do SVG (o personagem
 * herda o fill padrao preto e sumiria sobre a superficie escura).
 */

// ---------------------------------------------------------------------------
// Superficie
// ---------------------------------------------------------------------------

function surfaceStyle(dark: boolean) {
  return dark
    ? {
        backgroundImage:
          "linear-gradient(135deg, oklch(0.31 0.014 48) 0%, oklch(0.27 0.011 42) 55%, oklch(0.24 0.009 38) 100%)",
      }
    : {
        backgroundImage:
          "linear-gradient(135deg, oklch(0.24 0.03 45) 0%, oklch(0.19 0.025 40) 55%, oklch(0.16 0.02 35) 100%)",
      }
}
const borda = (dark: boolean) => (dark ? "border border-white/[0.16]" : "border border-white/10")
const ACCENT = {
  background:
    "linear-gradient(90deg, oklch(0.78 0.16 60) 0%, oklch(0.72 0.18 45) 45%, oklch(0.64 0.17 30) 100%)",
}
const TXT = "text-white/70"
const TXT_SOFT = "text-white/55"
const CARTAO = (dark: boolean) =>
  dark
    ? "rounded-lg border border-white/[0.14] bg-white/[0.08] px-3 py-2.5"
    : "rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2.5"

function anel(ativo: boolean) {
  return ativo ? "relative z-[55] ring-4 ring-cerrado-500 ring-offset-4 ring-offset-bg-card" : ""
}

// ---------------------------------------------------------------------------
// Conteudo: NOVIDADE 1 (Percorrido) e NOVIDADE 2 (Jornada)
// ---------------------------------------------------------------------------

interface Pagina {
  titulo: React.ReactNode
  corpo: string
  botao: string
  noodle: string
  cartoes?: "percorrido" | "jornada"
  destaque?: string
}

/**
 * NOVIDADE 1 em UMA TELA. O Hugo apontou esta versao e disse "ficou muito bem
 * explicado": titulo com as duas palavras em destaque, subtitulo que diz o que a
 * linha faz, os dois cartoes com os numeros, o bloco "No seu caso" e o par
 * acao-mais-saida. Tudo cabe numa tela porque a distincao e uma so, e paginar
 * uma ideia unica so adiciona cliques.
 *
 * O SUBTITULO e o texto que o Hugo pediu (2026-07-31), com uma ressalva que eu
 * registro em vez de esconder: ele fala em "interagiu e completou todas as
 * interacoes com IA", mas o cartao ao lado define Conclusao como o CLIQUE em
 * "Modulo Concluido", que nao e a mesma coisa que as interacoes socraticas
 * (essas sao a linha "Interacoes realizadas", separada, na mesma tabela). Deixei
 * o subtitulo falando do ESPIRITO (passar x fazer) e os cartoes dando a
 * definicao exata, para o texto nao prometer uma equivalencia que a tabela
 * desmente.
 */
const N1_PERCORRIDO: Pagina[] = [
  {
    titulo: (
      <>
        Agora dá para ver a diferença entre <span className="text-cerrado-300">percorrer</span> e{" "}
        <span className="text-cerrado-300">concluir</span>
      </>
    ),
    corpo:
      "Passar por todos os slides não fecha o módulo. Quem fecha é você, clicando em Módulo Concluído no fim de cada um. É esse clique que conta na Conclusão.",
    botao: "Ver onde fica",
    noodle: "/noodles/medir.svg",
    cartoes: "percorrido",
    destaque:
      "Percorrido em 100% e Conclusão em 50%. Você já viu o material inteiro, falta fechar 4 módulos. É o caminho mais curto que você tem hoje.",
  },
]

const N2_JORNADA: Pagina[] = [
  {
    titulo: "Você pode montar sua jornada de estudos",
    corpo:
      "O curso tem uma data final que não muda. Você escolhe quantos dias dar a cada módulo até lá, e confirma no fim para salvar.",
    botao: "Ver como funciona",
    noodle: "/noodles/calendario.svg",
    cartoes: "jornada",
  },
  {
    titulo: "Cada módulo ganha uma data",
    corpo:
      "Dê mais dias aos módulos que pedem mais de você e menos aos que já domina. Depois, você vê as datas da sua jornada e o que já concluiu.",
    botao: "Onde eu encontro isso",
    noodle: "/noodles/planejar.svg",
  },
  {
    titulo: "Onde você monta sua jornada",
    corpo: "Ela se chama “Monte ou revise sua jornada” e abre a tela onde você escolhe as datas.",
    botao: "Abrir agora",
    noodle: "/noodles/porta.svg",
  },
]

// O tour so roda quando a pessoa ENTRA na jornada, por vontade propria.
const TOUR = [
  {
    id: "timeline",
    titulo: "Cada bloco é um módulo",
    corpo:
      "Arraste a borda do bloco para dar mais ou menos dias a ele, e a data do módulo muda junto. Os que você já concluiu ficam travados, sem dias.",
  },
  {
    id: "auto",
    titulo: "Auto-ajuste",
    corpo:
      "Ligado, alongar um módulo empurra os seguintes para a frente, sem passar da data final do curso. Desligado, você mexe em um sem mover os outros.",
  },
  {
    id: "unidade",
    titulo: "Semanas ou dias",
    corpo: "Troca a unidade da linha do tempo, conforme for mais fácil de pensar.",
  },
  {
    id: "tabela",
    titulo: "Prefere sem arrastar?",
    corpo: "Use os botões de mais e menos ao lado de cada módulo. Faz a mesma coisa.",
  },
  {
    id: "reset",
    titulo: "Voltar ao ponto de partida",
    corpo:
      "Desfaz o que você mexeu e volta os módulos como estavam. Nada fica salvo até você clicar em Começar minha jornada.",
  },
  {
    id: "cta",
    titulo: "Começar minha jornada",
    corpo:
      "Salva a jornada que você montou, e os prazos passam a aparecer junto com o seu progresso. Dá para refazer quando quiser.",
  },
]

// ---------------------------------------------------------------------------
// Pecas visuais
// ---------------------------------------------------------------------------

function Cartoes({ tipo, dark }: { tipo: "percorrido" | "jornada"; dark: boolean }) {
  const itens =
    tipo === "percorrido"
      ? [
          {
            Icon: Footprints,
            t: "Percorrido",
            d: "Conta quando você chega ao último slide.",
            v: "100%",
          },
          {
            Icon: Target,
            t: "Conclusão",
            d: "Conta quando você clica em “Módulo Concluído”.",
            v: "50%",
          },
        ]
      : [
          { Icon: CalendarDays, t: "Você escolhe", d: "Quantos dias dar a cada módulo.", v: "" },
          {
            Icon: Target,
            t: "A tela calcula",
            d: "A data de cada módulo, dentro do prazo.",
            v: "",
          },
        ]
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {itens.map(({ Icon, t, d, v }) => (
        <div key={t} className={CARTAO(dark)}>
          <div className="mb-1 flex items-center justify-between">
            <span className="inline-flex items-center gap-2 font-semibold text-sm text-white">
              <Icon size={15} className="text-cerrado-300" />
              {t}
            </span>
            {v && <span className="font-bold text-cerrado-200 text-sm tabular-nums">{v}</span>}
          </div>
          <p className={`text-[13px] leading-relaxed ${TXT_SOFT}`}>{d}</p>
        </div>
      ))}
    </div>
  )
}

/** O modal grande das novidades: título, corpo, cartões, ação e "pular". */
function ModalNovidade({
  pg,
  passo,
  total,
  selo,
  dark,
  onVoltar,
  onAvancar,
  onPular,
  rotuloPular,
}: {
  pg: Pagina
  passo: number
  total: number
  selo: string
  dark: boolean
  onVoltar?: () => void
  onAvancar: () => void
  onPular: () => void
  rotuloPular: string
}) {
  return (
    <>
      <div className={`fixed inset-0 z-40 ${dark ? "bg-black/70" : "bg-black/50"}`} />
      <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto p-6">
        <div
          style={surfaceStyle(dark)}
          className={`relative w-full max-w-2xl overflow-hidden rounded-2xl shadow-2xl ${borda(dark)}`}
        >
          <div className="h-1" style={ACCENT} />
          <div className="relative p-7">
            {/* biome-ignore lint/performance/noImgElement: protótipo */}
            <img
              src={pg.noodle}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute top-14 right-5 hidden h-36 w-36 opacity-95 sm:block"
            />

            <div className="mb-4 flex items-start justify-between gap-4">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cerrado-400/30 bg-cerrado-400/12 px-3 py-1 font-semibold text-[11px] text-cerrado-200 uppercase tracking-wider">
                <Sparkles size={12} /> {selo}
              </span>
              <button
                type="button"
                onClick={onPular}
                aria-label="Fechar"
                className="rounded-lg p-1.5 text-white/45 hover:bg-white/10 hover:text-white/90"
              >
                <X size={17} />
              </button>
            </div>

            <div className="min-h-[104px] sm:pr-40">
              <h4 className="font-bold text-white text-xl leading-snug">{pg.titulo}</h4>
              <p className={`mt-2 text-sm leading-relaxed ${TXT}`}>{pg.corpo}</p>
            </div>

            {pg.cartoes && (
              <div className="mt-4">
                <Cartoes tipo={pg.cartoes} dark={dark} />
              </div>
            )}
            {pg.destaque && (
              <div className="mt-4 rounded-xl border border-cerrado-400/25 bg-cerrado-400/[0.09] px-4 py-3">
                <p className={`text-sm leading-relaxed ${TXT}`}>
                  <span className="font-semibold text-white">No seu caso:</span> {pg.destaque}
                </p>
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              {/* Pontos so quando ha mais de uma pagina. Um ponto solitario e
                  ruido: anuncia uma navegacao que nao existe. */}
              <div className="flex items-center gap-1.5">
                {total > 1 &&
                  Array.from({ length: total }, (_, k) => (
                    <span
                      key={`d${k}`}
                      className={
                        k === passo - 1
                          ? "h-1.5 w-5 rounded-full bg-cerrado-400"
                          : "h-1.5 w-1.5 rounded-full bg-white/25"
                      }
                    />
                  ))}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onPular}
                  className={`text-sm hover:text-white ${TXT_SOFT}`}
                >
                  {rotuloPular}
                </button>
                {onVoltar && (
                  <button
                    type="button"
                    onClick={onVoltar}
                    className={`inline-flex items-center gap-1 text-sm hover:text-white ${TXT_SOFT}`}
                  >
                    <ArrowLeft size={13} /> Voltar
                  </button>
                )}
                <button
                  type="button"
                  onClick={onAvancar}
                  className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-semibold text-sm text-white shadow-lg"
                  style={ACCENT}
                >
                  {pg.botao} <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

/** Balão pequeno do tour, ancorado no fluxo logo abaixo do controle. */
function BalaoTour({
  titulo,
  corpo,
  passo,
  total,
  dark,
  onVoltar,
  onAvancar,
  onSair,
  rotuloFinal,
}: {
  titulo: string
  corpo: string
  passo: number
  total: number
  dark: boolean
  onVoltar?: () => void
  onAvancar: () => void
  onSair: () => void
  /**
   * Sobrescreve o rotulo do ultimo passo. Existe por causa de um achado da
   * revisao: o balao de aterrissagem usava "Concluir" logo depois de a tela
   * ensinar que "Conclusão" e uma linha da tabela e que "Módulo Concluído" e um
   * botao do capitulo. Alem de ambiguo, era falso, o guia continua na novidade 2.
   */
  rotuloFinal?: string
}) {
  return (
    <div
      style={surfaceStyle(dark)}
      className={`relative z-[60] w-[380px] overflow-hidden rounded-2xl shadow-2xl ${borda(dark)}`}
    >
      <div className="h-1" style={ACCENT} />
      <div className="p-5">
        <div className="mb-2 flex items-start justify-between gap-3">
          <span className={`text-[11px] uppercase tracking-wider ${TXT_SOFT}`}>
            passo {passo} de {total}
          </span>
          <button
            type="button"
            onClick={onSair}
            aria-label="Sair do guia"
            className="rounded-lg p-1 text-white/45 hover:bg-white/10 hover:text-white/90"
          >
            <X size={15} />
          </button>
        </div>
        <h4 className="font-bold text-base text-white leading-snug">{titulo}</h4>
        <p className={`mt-1.5 text-[13px] leading-relaxed ${TXT}`}>{corpo}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: total }, (_, k) => (
              <span
                key={`t${k}`}
                className={
                  k === passo - 1
                    ? "h-1.5 w-5 rounded-full bg-cerrado-400"
                    : "h-1.5 w-1.5 rounded-full bg-white/25"
                }
              />
            ))}
          </div>
          <div className="flex items-center gap-3">
            {onVoltar && (
              <button
                type="button"
                onClick={onVoltar}
                className={`inline-flex items-center gap-1 text-[13px] hover:text-white ${TXT_SOFT}`}
              >
                <ArrowLeft size={13} /> Voltar
              </button>
            )}
            <button
              type="button"
              onClick={onAvancar}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 font-semibold text-[13px] text-white shadow-lg"
              style={ACCENT}
            >
              {passo === total ? "Concluir" : "Próximo"} <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// A plataforma, como o aluno a encontra
// ---------------------------------------------------------------------------

const MENU = [
  { Icon: LayoutDashboard, label: "Principal", ativo: true },
  { Icon: Compass, label: "Cursos e Trilhas", ativo: false },
  { Icon: SquareStack, label: "Materiais", ativo: false },
  { Icon: UserCircle, label: "Meu Perfil", ativo: false },
]

const LINHAS = [
  { l: "Última sessão de estudo", v: "há 17 dias" },
  { l: "Percorrido", v: "100%" },
  { l: "Conclusão", v: "50%" },
  { l: "Reflexões realizadas", v: "8/41" },
]

function Plataforma({
  destacarTabela,
  destacarFaixa,
  onAbrirJornada,
  children,
}: {
  destacarTabela?: boolean
  destacarFaixa?: boolean
  onAbrirJornada?: () => void
  children?: React.ReactNode
}) {
  return (
    <div className="flex min-h-[600px] rounded-2xl border border-border-subtle bg-bg-app">
      <aside className="hidden w-56 shrink-0 rounded-l-2xl border-border-subtle border-r bg-bg-sidebar p-4 md:block">
        <div className="mb-6 flex items-center gap-2 px-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cerrado-600 font-bold text-sm text-white">
            e
          </span>
          <span className="font-bold text-sm text-text-primary">Academy</span>
        </div>
        <nav className="space-y-1">
          {MENU.map(({ Icon, label, ativo }) => (
            <span
              key={label}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${
                ativo
                  ? "bg-cerrado-500/12 font-semibold text-cerrado-700 dark:text-cerrado-300"
                  : "text-text-muted"
              }`}
            >
              <Icon size={16} /> {label}
            </span>
          ))}
        </nav>
      </aside>

      <div className="flex-1">
        <header className="flex items-center justify-between border-border-subtle border-b px-6 py-3">
          <span className="text-sm text-text-muted">Cory Alimentos</span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cerrado-500/15 font-semibold text-cerrado-700 text-xs dark:text-cerrado-300">
            R
          </span>
        </header>

        <div className="space-y-4 p-6">
          <div>
            <p className="font-bold text-text-primary text-xl">Boa noite, Rinaldo</p>
            <p className="text-sm text-text-muted">Análise e Solução de Problemas</p>
          </div>

          <div
            className={`rounded-2xl border border-border-subtle bg-bg-card p-5 ${anel(Boolean(destacarTabela))}`}
          >
            <p className="font-bold text-text-primary">Meu ritmo</p>
            <p className="text-sm text-text-muted">Como estou na minha jornada</p>
            <div className="mt-3 space-y-2">
              {LINHAS.map(({ l, v }) => (
                <div
                  key={l}
                  className={`flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm ${
                    destacarTabela && (l === "Percorrido" || l === "Conclusão")
                      ? "border-cerrado-400/50 bg-cerrado-400/[0.07] font-semibold text-text-primary"
                      : "border-border-subtle text-text-primary"
                  }`}
                >
                  {l} <span className="text-text-muted tabular-nums">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onAbrirJornada}
            className={`flex w-full items-center gap-4 rounded-2xl bg-bg-card p-5 text-left transition-all ${
              destacarFaixa
                ? "relative z-[55] ring-4 ring-cerrado-500 ring-offset-4 ring-offset-bg-app"
                : "border border-border-subtle hover:border-cerrado-400/40"
            }`}
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cerrado-600 text-white">
              <CalendarDays size={22} />
            </span>
            <span className="flex-1">
              <span className="block font-bold text-base text-text-primary">
                Monte ou revise sua jornada
              </span>
              <span className="block text-sm text-text-muted">
                Veja seu ritmo e ajuste quando quiser
              </span>
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cerrado-500/12 text-cerrado-600 dark:text-cerrado-300">
              <ArrowRight size={17} />
            </span>
          </button>

          {children}

          <div className="rounded-2xl border border-border-subtle bg-bg-card p-5">
            <p className="text-sm text-text-muted">Continuar de onde parei</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// O construtor, com o tour opcional
// ---------------------------------------------------------------------------

function Construtor({
  tour,
  dark,
  onSairTour,
  onVoltarHome,
}: { tour: boolean; dark: boolean; onSairTour: () => void; onVoltarHome: () => void }) {
  const [i, setI] = useState(0)
  const p = TOUR[i]
  const ativo = (id: string) => tour && p.id === id

  const balao = (id: string) =>
    ativo(id) ? (
      <div className="my-3 flex justify-center">
        <BalaoTour
          titulo={p.titulo}
          corpo={p.corpo}
          passo={i + 1}
          total={TOUR.length}
          dark={dark}
          onVoltar={i > 0 ? () => setI(i - 1) : undefined}
          onAvancar={() => (i === TOUR.length - 1 ? onSairTour() : setI(i + 1))}
          onSair={onSairTour}
        />
      </div>
    ) : null

  return (
    <div className="relative rounded-2xl border border-border-subtle bg-bg-card p-6">
      <button
        type="button"
        onClick={onVoltarHome}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary"
      >
        <ArrowLeft size={14} /> Voltar para a home
      </button>
      <p className="font-bold text-text-primary text-xl">Monte sua jornada</p>
      <p className="mb-5 text-sm text-text-muted">Arraste cada módulo para definir seu tempo</p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex items-center gap-2 rounded-full border border-border-subtle bg-bg-elevated px-3 py-1.5 text-sm text-text-primary ${anel(ativo("auto"))}`}
        >
          <span className="h-4 w-7 rounded-full bg-cerrado-500" /> Auto-ajuste
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-bg-elevated px-3 py-1.5 text-sm text-text-primary ${anel(ativo("unidade"))}`}
        >
          Semanas <span className="text-text-muted">|</span> Dias
        </span>
      </div>
      {balao("auto")}
      {balao("unidade")}

      <div className={`mb-4 rounded-xl ${anel(ativo("timeline"))}`}>
        <div className="flex gap-1.5 rounded-xl border border-border-subtle bg-bg-elevated p-3">
          {[3, 2, 4, 2, 3, 1].map((w, k) => (
            <span
              key={`mm${k}`}
              className="flex h-12 items-center justify-center rounded-lg bg-cerrado-500/25 font-semibold text-cerrado-700 text-xs dark:text-cerrado-200"
              style={{ flex: w }}
            >
              M{k + 1}
            </span>
          ))}
        </div>
      </div>
      {balao("timeline")}

      <div className={`mb-4 rounded-xl ${anel(ativo("tabela"))}`}>
        <div className="divide-y divide-border-subtle rounded-xl border border-border-subtle">
          {["Módulo 1", "Módulo 2", "Módulo 3"].map((m, k) => (
            <div key={m} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-text-primary">{m}</span>
              <span className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md border border-border-subtle text-sm text-text-muted">
                  −
                </span>
                <span className="w-16 text-center text-sm text-text-primary tabular-nums">
                  {[2, 1, 3][k]} sem
                </span>
                <span className="flex h-6 w-6 items-center justify-center rounded-md border border-border-subtle text-sm text-text-muted">
                  +
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
      {balao("tabela")}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-text-muted ${anel(ativo("reset"))}`}
        >
          <RotateCcw size={14} /> Voltar ao ponto de partida
        </span>
        <span
          className={`inline-flex items-center gap-2 rounded-full bg-cerrado-600 px-5 py-2.5 font-semibold text-sm text-white ${anel(ativo("cta"))}`}
        >
          Começar minha jornada <ArrowRight size={15} />
        </span>
      </div>
      {balao("reset")}
      {balao("cta")}

      {tour && (
        <div
          className={`absolute inset-0 z-40 rounded-2xl ${dark ? "bg-black/65" : "bg-black/45"}`}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Preview: a maquina de estados do fluxo
// ---------------------------------------------------------------------------

/**
 * n1 → mostra Percorrido na tabela → n2 → aponta a faixa → (entra?) → construtor
 * com tour. Se PULAR em qualquer ponto, cai em "livre": a home sem nada por cima,
 * com o tour ARMADO. Clicar na faixa depois dispara o tour, uma unica vez.
 */
type Fase = "n1" | "n1-app" | "n2" | "n2-aponta" | "construtor" | "livre"

export default function PreviewOnboardingPage() {
  const [dark, setDark] = useState(false)
  const [fase, setFase] = useState<Fase>("n1")
  const [i, setI] = useState(0)
  const [tourArmado, setTourArmado] = useState(true)
  const [tourAtivo, setTourAtivo] = useState(false)
  const [chave, setChave] = useState(0)

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
  }, [dark])

  function reiniciar() {
    setFase("n1")
    setI(0)
    setTourArmado(true)
    setTourAtivo(false)
    setChave((k) => k + 1)
  }

  function abrirJornada() {
    setFase("construtor")
    if (tourArmado) {
      setTourAtivo(true)
      setTourArmado(false)
    }
  }

  const legenda: Record<Fase, string> = {
    n1: "Novidade 1 de 2, sobre a tabela. Três páginas.",
    "n1-app": "A novidade 1 aterrissa: as duas linhas ficam destacadas na tabela real.",
    n2: "Novidade 2 de 2, sobre a jornada. Aparece ao continuar.",
    "n2-aponta": "O último passo aponta a faixa. Daqui, ou entra, ou para.",
    construtor: tourAtivo
      ? "Entrou: o tour ensina os controles."
      : "Entrou sem tour, porque já tinha visto.",
    livre: tourArmado
      ? "Pulou. O tour fica ARMADO e dispara quando ela clicar na faixa por vontade própria."
      : "Fluxo concluído. A home sem nada por cima.",
  }

  return (
    <div className="min-h-screen space-y-6 bg-bg-app p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="font-bold text-2xl text-text-primary">Onboarding sequencial</h1>
          <p className="mt-1.5 text-sm text-text-muted">{legenda[fase]}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={reiniciar}
            className="rounded-full border border-border-medium bg-bg-card px-4 py-2 font-semibold text-sm text-text-primary"
          >
            Reiniciar
          </button>
          <button
            type="button"
            onClick={() => setDark(!dark)}
            className="inline-flex items-center gap-2 rounded-full border border-border-medium bg-bg-card px-4 py-2 font-semibold text-sm text-text-primary"
          >
            {dark ? <Sun size={15} /> : <Moon size={15} />}
            {dark ? "Claro" : "Escuro"}
          </button>
        </div>
      </header>

      <section key={chave} className="relative">
        {fase === "construtor" ? (
          <Construtor
            tour={tourAtivo}
            dark={dark}
            onSairTour={() => {
              setTourAtivo(false)
              setFase("livre")
            }}
            onVoltarHome={() => setFase("livre")}
          />
        ) : (
          <Plataforma
            destacarTabela={fase === "n1-app"}
            destacarFaixa={fase === "n2-aponta"}
            onAbrirJornada={abrirJornada}
          >
            {/* Na aterrissagem da novidade 1, o aviso entra no fluxo, logo abaixo
                da tabela destacada, para não cobrir o que acabou de explicar. */}
            {fase === "n1-app" && (
              <div className="flex justify-center">
                <BalaoTour
                  titulo="É aqui que elas ficam"
                  corpo="Percorrido e Conclusão, uma embaixo da outra, na tabela Meu ritmo."
                  passo={1}
                  total={1}
                  rotuloFinal="Entendi"
                  dark={dark}
                  onAvancar={() => {
                    setFase("n2")
                    setI(0)
                  }}
                  onSair={() => setFase("livre")}
                />
              </div>
            )}
            {fase === "n2-aponta" && (
              <div className="flex justify-center">
                <BalaoTour
                  titulo="É esta faixa aqui"
                  corpo="Ela abre a tela onde você define os prazos. Pode entrar agora, ou deixar para depois."
                  passo={3}
                  total={3}
                  dark={dark}
                  onVoltar={() => {
                    setFase("n2")
                    setI(1)
                  }}
                  onAvancar={abrirJornada}
                  onSair={() => setFase("livre")}
                />
              </div>
            )}
          </Plataforma>
        )}

        {fase === "n1" && (
          <ModalNovidade
            pg={N1_PERCORRIDO[i]}
            passo={i + 1}
            total={N1_PERCORRIDO.length}
            selo="Novidade 1 de 2"
            dark={dark}
            onVoltar={i > 0 ? () => setI(i - 1) : undefined}
            onAvancar={() => (i === N1_PERCORRIDO.length - 1 ? setFase("n1-app") : setI(i + 1))}
            onPular={() => {
              setFase("n2")
              setI(0)
            }}
            rotuloPular="Pular"
          />
        )}

        {fase === "n2" && (
          <ModalNovidade
            pg={N2_JORNADA[i]}
            passo={i + 1}
            total={N2_JORNADA.length}
            selo="Novidade 2 de 2"
            dark={dark}
            onVoltar={i > 0 ? () => setI(i - 1) : undefined}
            onAvancar={() => (i === N2_JORNADA.length - 1 ? setFase("n2-aponta") : setI(i + 1))}
            onPular={() => setFase("livre")}
            rotuloPular="Deixar para depois"
          />
        )}
      </section>
    </div>
  )
}
