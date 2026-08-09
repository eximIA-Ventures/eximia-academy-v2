"use client"

// ---------------------------------------------------------------------------
// Lado cliente do onboarding de novidades: gravar o "visto" e o repasse do
// pedido de rever o guia entre duas telas.
// ---------------------------------------------------------------------------

import { MODAL_SESSION_COOKIE, MODAL_SESSION_MAX_AGE_SECONDS } from "./session"
import type { FeatureKey } from "./types"

export interface RecordOnboardingInput {
  featureKey: FeatureKey
  /** Omitir quando o cliente não tem o artefato em mãos (armar o tour,
   *  rearmar pela afordância §2.3): o servidor usa a versão vigente no
   *  catálogo. Um `1` literal aqui apodreceria em silêncio no primeiro bump. */
  version?: number
  state?: "armed" | "seen" | "skipped" | "completed"
  lastStep?: number
  /** Afordância §2.3 — rearma deliberadamente uma linha já terminal. */
  rearm?: boolean
}

/**
 * Grava no servidor, sem nunca lançar.
 *
 * Uma falha de escrita aqui não pode travar a UI: o pior caso é o artefato
 * reaparecer na próxima sessão, e é justamente para esse caso que a afordância
 * "Ver o guia do construtor" (§2.3) existe do outro lado. Travar a tela do
 * aluno por causa de um POST de telemetria de onboarding seria trocar um
 * incômodo por um defeito.
 */
export async function recordOnboarding(input: RecordOnboardingInput): Promise<boolean> {
  try {
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    if (!res.ok) return false
    if (res.status === 204) return false
    const body = (await res.json()) as { recorded?: boolean }
    return body.recorded === true
  } catch {
    return false
  }
}

/**
 * Marca "já teve modal agora" (story §Fase 3, um modal de cada vez).
 *
 * O `Max-Age` é obrigatório e o motivo está em `MODAL_SESSION_MAX_AGE_SECONDS`:
 * sem ele o cookie só morre quando o navegador FECHA, e navegador que não
 * fecha travava a fila de anúncios por semanas.
 */
export function markModalShownThisSession(): void {
  if (typeof document === "undefined") return
  document.cookie = `${MODAL_SESSION_COOKIE}=1; path=/; Max-Age=${MODAL_SESSION_MAX_AGE_SECONDS}; SameSite=Lax`
}

// ---------------------------------------------------------------------------
// Repasse do "quero ver o guia" entre telas
// ---------------------------------------------------------------------------
//
// A afordância da story §2.3 vive em DUAS telas, e uma delas (o
// `JourneyDashboard`) leva ao construtor por uma transição LOCAL do
// `JourneyShell` — mesma URL, sem re-render do servidor. Ou seja: o artefato
// que o SSR resolveu para aquela navegação continua sendo `null` quando o
// construtor monta. Sem este repasse, o clique gravaria `armed` no banco e não
// mostraria guia nenhum até a pessoa recarregar a página — que é exatamente o
// tipo de omissão silenciosa que a afordância existe para curar.
//
// `sessionStorage` (não um estado React) porque o repasse precisa sobreviver
// tanto à transição local quanto a uma navegação de verdade, e morrer junto
// com a aba.

const TOUR_REQUEST_KEY = "onboarding:tour-on-builder-mount"

/** Pede que o tour abra no próximo mount do construtor. */
export function requestTourOnBuilderMount(): void {
  try {
    sessionStorage.setItem(TOUR_REQUEST_KEY, "1")
  } catch {
    // sessionStorage indisponível (modo privado antigo, iframe sem storage
    // access). O clique já gravou `armed` no servidor, então o guia aparece
    // no próximo carregamento do construtor — degradado, nunca quebrado.
  }
}

/** Consome o pedido (uma vez só) e diz se havia um. */
export function consumeTourRequest(): boolean {
  try {
    const had = sessionStorage.getItem(TOUR_REQUEST_KEY) === "1"
    if (had) sessionStorage.removeItem(TOUR_REQUEST_KEY)
    return had
  } catch {
    return false
  }
}
