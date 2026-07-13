-- =============================================================================
-- Migration: ENGAGEMENT CENTER v2 — schema extension for the Manager's
--            contextual action center (EPIC "Centro de Engajamento v2", E1)
-- =============================================================================
-- Extends the Engagement Engine (20260604120000_engagement_engine.sql) so the
-- next stories (E2 engine, E3 API) can:
--   • AUDIT suggestions per manager        → nudge_suggestions.manager_id
--   • classify a new "behind teaching plan" cohort → nudge_suggestions.type CHECK
--   • let a message be signed by the manager OR the platform
--                                          → notifications.sender_identity/name
--   • organise templates by human INTENT   → notification_templates.intent/tone
--
-- 100% ADDITIVE + IDEMPOTENT: only ADD COLUMN IF NOT EXISTS, a rebuilt CHECK on
-- nudge_suggestions.type (via pg_constraint lookup — the base CHECK is anonymous),
-- an UPDATE backfill guarded by `WHERE intent IS NULL`, and a seed guarded by
-- ON CONFLICT (tenant_id, key) DO NOTHING. No table is dropped or renamed. No RLS
-- policy is altered — every existing policy is a broad SELECT/INSERT/UPDATE over
-- the whole table, so the new columns automatically inherit the same visibility
-- (verified against 20260604120000_engagement_engine.sql +
-- 20260630000000_engagement_rls_group_scope.sql). AC10 satisfied by construction.
--
-- SEED KEY NOTE: the base seed keys differ from the NudgeType enum
-- (never_accessed, inactive_14d, session_no_reflection, top_performer_recognition,
-- announcement_generic) — this migration backfills THOSE exact keys.
-- =============================================================================

BEGIN;

-- =============================================================================
-- AC1 — nudge_suggestions.manager_id (auditoria por gestor)
-- =============================================================================
-- Nullable by design: rows generated before this wave (or tenant-wide by an
-- admin) have no owning manager. E2 populates this on every INSERT from now on.
ALTER TABLE nudge_suggestions
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES users(id) ON DELETE SET NULL;

COMMENT ON COLUMN nudge_suggestions.manager_id IS
  'Owning manager of the suggestion (auditoria). NULL for legacy/tenant-wide rows. '
  'Set by the contextual engine (E2) so the 7-day dismissal is per manager+type.';

CREATE INDEX IF NOT EXISTS idx_nudge_suggestions_manager
  ON nudge_suggestions(tenant_id, manager_id);

-- =============================================================================
-- AC2 — extend nudge_suggestions.type CHECK to include 'behind_teaching_plan'
-- =============================================================================
-- The base CHECK (20260604120000) is defined inline and therefore has a
-- system-generated (anonymous) name. We look it up in pg_constraint, drop it, and
-- recreate a NAMED equivalent that adds the new value. Idempotent: if the named
-- constraint already exists we skip; otherwise we drop whatever CHECK currently
-- constrains `type` and add the named one.
DO $$
DECLARE
  _named boolean;
  _old_name text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'nudge_suggestions'::regclass
      AND conname = 'nudge_suggestions_type_check_v2'
  ) INTO _named;

  IF NOT _named THEN
    -- Drop any existing CHECK constraint on nudge_suggestions that references
    -- the `type` column (the anonymous base CHECK, or a previous run's).
    FOR _old_name IN
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'nudge_suggestions'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%type%'
    LOOP
      EXECUTE format('ALTER TABLE nudge_suggestions DROP CONSTRAINT %I', _old_name);
    END LOOP;

    ALTER TABLE nudge_suggestions
      ADD CONSTRAINT nudge_suggestions_type_check_v2
      CHECK (type IN (
        'never_accessed',
        'inactive',
        'no_reflection',
        'top_performer',
        'announcement',
        'custom',
        'behind_teaching_plan'
      ));
  END IF;
END $$;

-- =============================================================================
-- AC3 — notifications.sender_identity + sender_name (origem da mensagem)
-- =============================================================================
-- DECISION (backfill): existing rows receive sender_identity='platform' via the
-- column DEFAULT — old messages never had a manager attribution, so 'platform'
-- is the correct historical value. sender_name stays NULL unless the identity is
-- 'manager'. ADD COLUMN ... DEFAULT of a constant is metadata-only on Postgres
-- 11+ (no table rewrite).
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS sender_identity TEXT NOT NULL DEFAULT 'platform'
    CHECK (sender_identity IN ('manager', 'platform'));

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS sender_name TEXT;

COMMENT ON COLUMN notifications.sender_identity IS
  'Origin of the message: manager (assinada pelo gestor) or platform (institucional). '
  'Legacy rows default to platform — they never carried a manager attribution.';
COMMENT ON COLUMN notifications.sender_name IS
  'Manager display name when sender_identity=manager; NULL when platform. '
  'Resolved server-side from the authenticated caller (never trusted from client).';

-- =============================================================================
-- AC4 — notification_templates.intent + tone (organização por intenção)
-- =============================================================================
ALTER TABLE notification_templates
  ADD COLUMN IF NOT EXISTS intent TEXT
    CHECK (intent IN (
      'primeiro_acesso',
      'retomada',
      'atraso_plano',
      'reflexao_pendente',
      'reconhecimento',
      'manual'
    ));

ALTER TABLE notification_templates
  ADD COLUMN IF NOT EXISTS tone TEXT;

COMMENT ON COLUMN notification_templates.intent IS
  'Human intent of the template (drives grouping in the manager UI, never the raw key).';
COMMENT ON COLUMN notification_templates.tone IS
  'Free-form tone descriptor shown to the manager (e.g. "Leve e institucional").';

-- =============================================================================
-- AC5 — backfill intent/tone for the 5 existing seed templates (idempotent)
-- =============================================================================
-- WHERE intent IS NULL keeps this safe to re-run and non-destructive to a future
-- manual admin edit of intent/tone. Keyed by the REAL seed keys.
UPDATE notification_templates
  SET intent = 'primeiro_acesso', tone = 'Leve e institucional'
  WHERE key = 'never_accessed' AND intent IS NULL;

UPDATE notification_templates
  SET intent = 'retomada', tone = 'Acolhedor, sem cobrança pesada'
  WHERE key = 'inactive_14d' AND intent IS NULL;

UPDATE notification_templates
  SET intent = 'reflexao_pendente', tone = 'Encorajador'
  WHERE key = 'session_no_reflection' AND intent IS NULL;

UPDATE notification_templates
  SET intent = 'reconhecimento', tone = 'Celebratório'
  WHERE key = 'top_performer_recognition' AND intent IS NULL;

UPDATE notification_templates
  SET intent = 'manual', tone = 'Neutro institucional'
  WHERE key = 'announcement_generic' AND intent IS NULL;

-- =============================================================================
-- AC6 — new seed template 'behind_teaching_plan' for every existing tenant
-- =============================================================================
-- Same CROSS JOIN + ON CONFLICT DO NOTHING pattern as the base seed. Tone is more
-- direct than inactive_14d, because "atraso no plano" is `atencao` (vermelho) —
-- worse than `sem_acesso` (âmbar) in the student-triage hierarchy. intent/tone
-- are set inline here (the AC5 backfill only touches the pre-existing 5 keys).
INSERT INTO notification_templates
  (tenant_id, key, name, category, channel_inapp, channel_email,
   title, body_inapp, email_subject, email_html, variables, intent, tone, is_active, created_by)
SELECT
  t.id, s.key, s.name, s.category, s.channel_inapp, s.channel_email,
  s.title, s.body_inapp, s.email_subject, s.email_html, s.variables, s.intent, s.tone, true, NULL
FROM tenants t
CROSS JOIN (
  VALUES
    (
      'behind_teaching_plan',
      'Atrás do Plano de Ensino',
      'nudge', true, true,
      'Você está atrás do seu Plano de Ensino',
      'Olá, {{primeiro_nome}}! Seu progresso em {{curso}} está abaixo do esperado para o prazo do Plano de Ensino. Retome quando puder para não acumular atraso.',
      'Seu Plano de Ensino precisa de atenção',
      '<p>Olá, {{primeiro_nome}}!</p><p>Seu progresso em {{curso}} está abaixo do esperado para o prazo do Plano de Ensino. Retome quando puder para não acumular atraso.</p>',
      '["primeiro_nome","curso"]'::jsonb,
      'atraso_plano',
      'Direto, com senso de urgência'
    )
) AS s(key, name, category, channel_inapp, channel_email,
       title, body_inapp, email_subject, email_html, variables, intent, tone)
ON CONFLICT (tenant_id, key) DO NOTHING;

-- =============================================================================
-- AC7 — reconhecimento (botão "No ritmo → Parabenizar")
-- =============================================================================
-- DECISION: reuse the existing `top_performer_recognition` template (its intent
-- is set to 'reconhecimento' by AC5 above). NO second redundant template is
-- created — a single reconhecimento template covers both the top_performer cohort
-- and the "Parabenizar" action. Documented in the story Dev Agent Record.

COMMIT;
