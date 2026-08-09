// ---------------------------------------------------------------------------
// Modo demonstração — `?onboarding=percorrido|jornada|tour`.
//
// A razão de este módulo existir separado do gate: ele NÃO consulta o banco e
// NÃO grava linha nenhuma. É o que permite conferir as três peças HOJE, com a
// migration `20260803000000_onboarding_novidades.sql` ainda NÃO APLICADA — e é
// também o que garante que nenhuma pessoa real veja qualquer coisa enquanto a
// conferência acontece (o kill switch continua OFF por tenant, e o gate real
// sai antes de qualquer query quando `isPreview` é true).
//
// Os valores dos artefatos abaixo espelham as três linhas de catálogo da
// migration (§5): mesma `version`, mesma `priority`, mesmo `help_url`. Não é
// enfeite — é o que faz a demonstração exercitar o MESMO caminho de render que
// a resolução real vai exercitar depois, em vez de um caminho paralelo que
// só funciona na demonstração.
// ---------------------------------------------------------------------------

import { FEATURE_KEYS, type PendingArtifact } from "./types"

/**
 * NÃO existe snapshot de progresso canned aqui, e a ausência é deliberada.
 *
 * Houve um, entre 2026-08-05 e o mesmo dia: ao tirar o "100%/50%" de dentro do
 * modal, os números foram parar aqui, como dado de exemplo da demonstração. O
 * Hugo decidiu contra: quem confere via `?onboarding=percorrido` deve ver o
 * PRÓPRIO progresso, senão a conferência valida uma tela que ninguém vai ver.
 *
 * Os números do modal vêm de `resolveAnnouncementStats()`
 * (`./progress-snapshot.ts`), que a demonstração percorre igual ao gate real.
 * O que ESTE módulo garante continua valendo: nenhuma linha é gravada, e nada
 * aqui consulta `product_announcements`/`product_announcement_views` — é por
 * isso que a demonstração funciona com a migration de onboarding não aplicada.
 */

/** Os três valores aceitos pelo query param, e o artefato de cada um. */
const PREVIEW_ARTIFACTS: Record<string, PendingArtifact> = {
  percorrido: {
    featureKey: FEATURE_KEYS.percorrido,
    kind: "announcement",
    version: 1,
    priority: 10,
    helpUrl: "/ajuda/percorrido-vs-conclusao",
    lastStep: null,
  },
  jornada: {
    featureKey: FEATURE_KEYS.jornada,
    kind: "announcement",
    version: 1,
    priority: 20,
    helpUrl: "/ajuda/jornada",
    lastStep: null,
  },
  tour: {
    featureKey: FEATURE_KEYS.tour,
    kind: "product_onboarding",
    version: 1,
    priority: 50,
    helpUrl: "/ajuda/jornada",
    lastStep: null,
  },
}

/**
 * Traduz o valor cru do query param no artefato a exibir, ou `null` quando o
 * param está ausente/desconhecido. Valor inválido é silenciosamente ignorado:
 * um typo na URL não deve virar erro de página, só "nada acontece".
 */
export function previewArtifactFor(raw: string | undefined | null): PendingArtifact | null {
  if (!raw) return null
  return PREVIEW_ARTIFACTS[raw] ?? null
}

/** Há um modo demonstração ativo nesta requisição, qualquer que seja o alvo? */
export function isPreviewRequest(raw: string | undefined | null): boolean {
  return Boolean(raw)
}
