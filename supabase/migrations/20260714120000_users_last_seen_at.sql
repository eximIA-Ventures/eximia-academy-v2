-- =============================================================================
-- users.last_seen_at — sinal de ACESSO por navegação pura (Hugo, 2026-07-14)
-- =============================================================================
-- Problema (caso Rinaldo/argos): login/browse sem chat socrático nem reflexão
-- não gerava sinal NENHUM no banco — o "Último acesso" só enxergava atividade
-- de sessions/slide_reflections, então um usuário que entra todo dia podia
-- aparecer como ausente há semanas.
--
-- Coluna ADITIVA e nullable: nenhum backfill, nenhuma mudança de comportamento
-- para linhas existentes. O bump é feito pelo app (layout autenticado, service
-- role, throttled a no máximo 1 escrita/hora por usuário — apps/web/src/lib/
-- last-seen.ts) e o app é TOLERANTE à ausência da coluna (pré-migration, o
-- update/select falham em silêncio e tudo degrada ao comportamento antigo).
-- Por isso o código pode ir ao ar ANTES desta migration; o sinal só passa a
-- existir depois que ela for aplicada.
--
-- Sem índice: a coluna é lida por linha (junto do roster já filtrado por
-- tenant/role) e nunca usada como filtro de busca.
-- =============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

COMMENT ON COLUMN users.last_seen_at IS
  'Última visita autenticada à plataforma (bump throttled ~1h pelo layout). Sinal de acesso por navegação pura; NULL = nunca registrado desde a criação da coluna.';
