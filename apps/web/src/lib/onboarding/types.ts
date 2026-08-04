/**
 * Contrato compartilhado do onboarding de novidades.
 *
 * Este arquivo é a fonte única de nomes entre as peças que foram construídas em
 * paralelo (migration, modal, tour, âncoras, gate server-side). Nada aqui é
 * decorativo: cada constante existe porque duas peças diferentes precisam
 * concordar sobre a mesma string, e uma divergência de string entre elas é
 * silenciosa — o modal simplesmente não aparece, o tour simplesmente não acha a
 * âncora, e nenhum teste natural falha.
 *
 * Contrato de origem: `docs/stories/feat-onboarding-novidades-lancamento.md`.
 */

import type { ReactNode } from "react"

/**
 * O tipo NÃO é rótulo escolhido por quem publica, é consequência do gatilho
 * (story §"Produto x feature"). Anúncio dispara por data e SEMPRE expira; tour
 * dispara por lugar e NUNCA expira. O banco recusa a combinação errada por CHECK.
 */
export type AnnouncementKind = "announcement" | "product_onboarding"

/** As chaves dos três artefatos de hoje. Chave nova = linha nova na migration. */
export const FEATURE_KEYS = {
  percorrido: "percorrido-vs-conclusao",
  jornada: "jornada-intro",
  tour: "jornada-builder-tour",
} as const

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS]

/**
 * Estado de uma linha em `product_announcement_views`.
 *
 * `armed` é o estado que faz o tour esperar: a linha nasce armada quando a
 * novidade da Jornada se resolve, e só vira terminal quando a pessoa chega ao
 * construtor — um minuto ou seis meses depois. É por isso que `armed` não expira
 * (story §2.1): durar É o ponto.
 */
export type ViewState = "armed" | "seen" | "skipped" | "completed"

/** Um artefato pendente, já filtrado por janela, público e coorte. */
export interface PendingArtifact {
  featureKey: FeatureKey
  kind: AnnouncementKind
  version: number
  priority: number
  helpUrl: string
  /** Passo em que a pessoa parou, para o tour retomar em vez de recomeçar. */
  lastStep: number | null
}

/**
 * As 9 âncoras, por atributo estável — NUNCA por classe, posição ou texto.
 *
 * Classe muda no próximo ajuste de Tailwind, posição muda quando alguém
 * reordena, texto muda na próxima revisão de copy. Qualquer um dos três quebraria
 * o tour sem quebrar nenhum teste. O atributo existe só para isto, então mexer
 * nele é um ato deliberado, e há um teste que falha se sumir.
 */
export const ANCHORS = {
  // Novidade 1 — as duas linhas da tabela "Meu ritmo" do aluno.
  ritmoPercorrido: "ritmo-percorrido",
  ritmoConclusao: "ritmo-conclusao",
  // Novidade 2 — a faixa que leva à jornada.
  faixaJornada: "faixa-jornada",
  // Tour — os 6 controles do construtor, na ordem em que o guia os ensina.
  jornadaLinha: "jornada-linha",
  jornadaAuto: "jornada-auto",
  jornadaUnidade: "jornada-unidade",
  jornadaModulos: "jornada-modulos",
  jornadaReset: "jornada-reset",
  jornadaCta: "jornada-cta",
} as const

export type AnchorName = (typeof ANCHORS)[keyof typeof ANCHORS]

/**
 * CORREÇÃO ao contrato de arquitetura, registrada aqui para não ser "corrigida
 * de volta" (mesmo motivo da correção do público de N1 na story).
 *
 * A story §0.3 lista, entre as 6 âncoras do tour, `jornada-prazo` (o chip de
 * prazo) e `jornada-sugestao` (o dropdown de presets). O protótipo que o Hugo
 * aprovou DEPOIS da revisão de textos não ensina nenhum dos dois: ele ensina
 * `reset` ("Voltar ao ponto de partida") e `cta` ("Começar minha jornada").
 *
 * Prevalece o protótipo, porque é o artefato que passou pela revisão e pelo
 * aceite. Uma âncora sem passo correspondente seria peso morto protegido por
 * teste, e um passo sem âncora seria um tour que não resolve.
 */
export const TOUR_STEP_ORDER = [
  ANCHORS.jornadaLinha,
  ANCHORS.jornadaAuto,
  ANCHORS.jornadaUnidade,
  ANCHORS.jornadaModulos,
  ANCHORS.jornadaReset,
  ANCHORS.jornadaCta,
] as const

/**
 * Uma tela do modal de novidade.
 *
 * `destaque` é o bloco "No seu caso": o único pedaço do modal que fala do número
 * da PRÓPRIA pessoa. É opcional porque nem todo artefato tem dado individual a
 * mostrar, e um "No seu caso" genérico seria pior que nenhum.
 */
export interface AnnouncementPage {
  titulo: ReactNode
  corpo: string
  botao: string
  /** Caminho do noodle em `public/noodles/`. Um por tela, nunca repetido. */
  noodle: string
  cartoes?: "percorrido" | "jornada"
  destaque?: string
}

/** Um passo do tour, amarrado à âncora que ele ilumina. */
export interface TourStep {
  anchor: AnchorName
  titulo: string
  corpo: string
}

/** Seletor CSS da âncora. Existe para ninguém escrever o atributo na mão. */
export function anchorSelector(name: AnchorName): string {
  return `[data-onboarding="${name}"]`
}

/** As props que marcam um elemento como âncora. Espalhe no JSX: {...anchor(X)} */
export function anchor(name: AnchorName): { "data-onboarding": AnchorName } {
  return { "data-onboarding": name }
}

/**
 * Rotas onde NENHUM modal aparece (story §Fase 3).
 *
 * Interromper um quiz é o jeito mais rápido de ensinar a pessoa a fechar tudo no
 * reflexo, e aí o próximo aviso — o que importava — já nasce morto.
 */
export const SILENT_ROUTE_PATTERNS = [/^\/assessments\//, /\/chapters\/[^/]+\/present/] as const

export function isSilentRoute(pathname: string): boolean {
  return SILENT_ROUTE_PATTERNS.some((re) => re.test(pathname))
}

/** Chave do kill switch em `tenants.settings` JSONB. Default OFF (story §Fase 4). */
export const KILL_SWITCH_KEY = "onboarding_jornada_v1"

/**
 * Query param que abre o modo demonstração.
 *
 * Ele NÃO grava linha e NÃO consulta o banco, então funciona mesmo antes de a
 * migration ser aplicada. É como o Senhor confere o resultado sem que uma única
 * pessoa real veja qualquer coisa.
 */
export const PREVIEW_PARAM = "onboarding"
