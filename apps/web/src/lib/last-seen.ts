// ---------------------------------------------------------------------------
// last-seen — bump throttled de users.last_seen_at (FOLLOW-UP B, Hugo 2026-07-14)
// ---------------------------------------------------------------------------
// Navegação pura (login/browse sem chat socrático nem reflexão) não gerava
// sinal NENHUM no banco, então "acessa todo dia" nunca ficava fiel no
// "Último acesso" (caso Rinaldo). Este módulo registra a visita autenticada:
// os layouts (platform)/(studio) chamam `bumpLastSeen(user.id)` via `after()`
// (pós-response, nunca no caminho crítico da página).
//
// Contenção deliberada:
//   • THROTTLE em memória por instância (LAST_SEEN_TTL_MS = 1h): páginas
//     subsequentes do mesmo usuário não geram statement nenhum.
//   • Guarda SQL equivalente no UPDATE (last_seen_at IS NULL OR < cutoff) para
//     instâncias múltiplas não brigarem — o throttle vale cross-replica.
//   • TOLERANTE À PRÉ-MIGRATION: se a coluna users.last_seen_at ainda não
//     existe no banco (a migration 20260714120000 é passo SEPARADO, aplicado
//     pelo Hugo), o UPDATE erra em silêncio e NADA quebra — o app degrada ao
//     comportamento antigo. Nenhum erro deste módulo escapa para a página.
// ---------------------------------------------------------------------------

import { createServiceClient } from "@/lib/supabase/service"

/** Mínimo entre escritas de last_seen_at por usuário: 1 hora. */
export const LAST_SEEN_TTL_MS = 3_600_000

/**
 * Decisão PURA do throttle: bumpa quando nunca bumpou nesta instância ou quando
 * o último bump tem 1h ou mais. Exportada para teste.
 */
export function shouldBumpLastSeen(lastBumpMs: number | null, nowMs: number): boolean {
  return lastBumpMs === null || nowMs - lastBumpMs >= LAST_SEEN_TTL_MS
}

/** Último bump por usuário NESTA instância (memória de processo, não persiste). */
const lastBumpByUser = new Map<string, number>()

/**
 * Registra a visita autenticada de `userId`, no máximo 1x/hora. Fire-and-forget:
 * NUNCA lança — qualquer falha (coluna ausente pré-migration, rede, RLS) é
 * engolida e a página segue intacta.
 */
export async function bumpLastSeen(userId: string, nowMs: number = Date.now()): Promise<void> {
  if (!shouldBumpLastSeen(lastBumpByUser.get(userId) ?? null, nowMs)) return
  // Marca ANTES da escrita: mesmo se o UPDATE falhar (ex.: pré-migration), não
  // martelamos o banco a cada page view — tentamos de novo só no próximo TTL.
  lastBumpByUser.set(userId, nowMs)
  try {
    const svc = createServiceClient()
    const cutoffIso = new Date(nowMs - LAST_SEEN_TTL_MS).toISOString()
    await svc
      .from("users")
      .update({ last_seen_at: new Date(nowMs).toISOString() })
      .eq("id", userId)
      .or(`last_seen_at.is.null,last_seen_at.lt.${cutoffIso}`)
  } catch {
    // Silêncio deliberado: sinal de telemetria nunca derruba a navegação.
  }
}
