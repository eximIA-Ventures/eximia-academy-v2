// ---------------------------------------------------------------------------
// Catálogo do onboarding — o mapa `featureKey -> conteúdo`.
//
// Conteúdo é interface, não parágrafo (contrato
// `docs/architecture/onboarding-novidades-contrato-janela.md` §3): HTML numa
// coluna de banco vira XSS e vira conteúdo que ninguém revisa em PR. O que
// `resolveOnboarding()` devolve é só o `featureKey` (ver `PendingArtifact`
// em `./types.ts`, que de propósito NÃO expõe um `content_key` separado) —
// este arquivo é quem decide QUAL conteúdo React aquele artefato renderiza.
//
// As páginas do modal e os passos do tour em si vivem em
// `components/onboarding/announcement-content.tsx` (textos já revisados e
// aceitos pelo Hugo, ver o cabeçalho daquele arquivo) — este módulo só
// amarra `FeatureKey -> aquele conteúdo`, para o componente que efetivamente
// renderiza (`AnnouncementModal` / `TourHost`) não precisar saber nada sobre
// chaves de catálogo.
// ---------------------------------------------------------------------------

import {
  JORNADA_PAGES,
  PERCORRIDO_PAGES,
  TOUR_STEPS,
} from "@/components/onboarding/announcement-content"
import { type AnnouncementPage, FEATURE_KEYS, type FeatureKey, type TourStep } from "./types"

export interface AnnouncementCatalogEntry {
  kind: "announcement"
  pages: AnnouncementPage[]
  /** Selo do topo do modal, ex. "Novidade 1 de 2" — o protótipo aprovado
   *  numera as DUAS novidades desta leva, não o total do catálogo. */
  selo: string
  /** Rótulo do link de pular. Varia por artefato no protótipo aprovado:
   *  "Pular" na primeira novidade, "Deixar para depois" na segunda. */
  rotuloPular: string
}

export interface TourCatalogEntry {
  kind: "product_onboarding"
  steps: TourStep[]
}

export type CatalogEntry = AnnouncementCatalogEntry | TourCatalogEntry

/**
 * Trava contra o ponteiro pendurado (contrato §3, "como se cadastra uma
 * novidade"): `Record<FeatureKey, CatalogEntry>` é totalmente tipado sobre
 * as 3 chaves de `FEATURE_KEYS`, então um refactor que remova uma chave sem
 * remover a entrada correspondente aqui quebra o `tsc`, não a tela do aluno.
 * O inverso — content_key publicado no banco sem entrada aqui — é o que o
 * teste em `__tests__/` cobre (o banco pode ter uma chave nova antes do
 * deploy do código que a entende; `resolve.ts` já ignora esse caso, nunca
 * quebra).
 */
export const ONBOARDING_CATALOG: Record<FeatureKey, CatalogEntry> = {
  [FEATURE_KEYS.percorrido]: {
    kind: "announcement",
    pages: PERCORRIDO_PAGES,
    selo: "Novidade 1 de 2",
    rotuloPular: "Pular",
  },
  [FEATURE_KEYS.jornada]: {
    kind: "announcement",
    pages: JORNADA_PAGES,
    selo: "Novidade 2 de 2",
    rotuloPular: "Deixar para depois",
  },
  [FEATURE_KEYS.tour]: {
    kind: "product_onboarding",
    steps: TOUR_STEPS,
  },
}

export function catalogEntryFor(featureKey: FeatureKey): CatalogEntry {
  return ONBOARDING_CATALOG[featureKey]
}
