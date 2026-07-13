-- =============================================================================
-- Migration: ENGAGEMENT ENGINE — assisted nudges, in-app inbox + email mirror,
--            efficacy tracking
-- =============================================================================
-- New model that supersedes the old `email_notifications` flow. The engine is:
--   • IN-APP FIRST + email MIRROR  — every notification is an in-app inbox row;
--     a `channel=email` mirror row is created via Resend when the template asks.
--   • ASSISTED NUDGES             — the risk analysis (SAME logic as the roster /
--     next-best-action) SUGGESTS who to nudge (nudge_suggestions). An admin
--     APPROVES with one click, which materialises the actual notifications.
--   • EFFICACY MEASUREMENT        — per-recipient status (queued→sent→read→acted)
--     plus returned_at (the student had a learning session AFTER the nudge).
--
-- LEGACY NOTE: `email_notifications` (20260506000000_email_notifications.sql)
-- becomes LEGACY. It is INTENTIONALLY NOT DROPPED — historical sends stay
-- readable. New code must target the tables defined here.
--
-- Helper functions reused (defined in earlier migrations):
--   auth_tenant_id()         -> UUID    tenant of the authenticated user
--   auth_user_role()         -> TEXT    role of the authenticated user
--   is_super_admin()         -> BOOL    active super_admin (cross-tenant bypass)
--   auth_managed_group_ids() -> UUID[]  manager_group ids owned by the caller
--
-- This migration is fully ADDITIVE and IDEMPOTENT
-- (CREATE ... IF NOT EXISTS / DROP POLICY IF EXISTS / ON CONFLICT DO NOTHING).
-- SECURITY: every table is tenant-scoped with RLS. A STUDENT may only read and
-- update their OWN notifications (recipient_id = auth.uid()). Admin/manager
-- manage within their tenant; super_admin bypasses. Never trust a tenant_id or
-- recipient_id sent from the client — RLS WITH CHECK re-validates against the
-- caller's tenant and (for the suggestion→approve path) the referenced rows.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. notification_templates — reusable in-app + email content, per tenant
-- =============================================================================
-- `key` is a tenant-unique slug (e.g. 'never_accessed') used by the suggestion
-- engine to pick a template. `variables` is the declared list of {{...}} keys
-- the body/subject reference, so the UI can hint the admin what gets substituted.
-- =============================================================================
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key TEXT NOT NULL,                      -- tenant-unique slug
  name TEXT NOT NULL,                     -- human label for admins
  category TEXT NOT NULL DEFAULT 'nudge'
    CHECK (category IN ('nudge', 'announcement', 'system')),
  channel_inapp BOOLEAN NOT NULL DEFAULT true,
  channel_email BOOLEAN NOT NULL DEFAULT false,
  title TEXT NOT NULL,                     -- short in-app title (bell/inbox)
  body_inapp TEXT,                         -- in-app body
  email_subject TEXT,                      -- email mirror subject
  email_html TEXT,                         -- email mirror HTML body
  variables JSONB NOT NULL DEFAULT '[]',   -- declared {{...}} keys, e.g. ["primeiro_nome","curso"]
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, key)
);

COMMENT ON TABLE notification_templates IS
  'Reusable in-app + email content for the Engagement Engine. key is tenant-unique.';
COMMENT ON COLUMN notification_templates.variables IS
  'Declared list of {{...}} substitution keys (e.g. ["primeiro_nome","curso"]).';

-- =============================================================================
-- 2. notifications — the per-recipient delivery rows (in-app inbox + email mirror)
-- =============================================================================
-- One row per (recipient, channel). `channel=inapp` rows ARE the student inbox
-- (rendered by the header bell + inbox page). `channel=email` rows are the
-- Resend mirror. `status` is the lifecycle; the *_at columns timestamp each step.
-- `returned_at` is the efficacy signal: set by the cron job when the student had
-- a learning session AFTER `sent_at`.
-- =============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id UUID REFERENCES notification_templates(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'inapp'
    CHECK (channel IN ('inapp', 'email')),
  origin TEXT NOT NULL DEFAULT 'manual'
    CHECK (origin IN ('nudge', 'manual', 'system')),
  title TEXT NOT NULL,                     -- rendered title (variables substituted)
  body TEXT,                               -- rendered body (in-app text or email html)
  cta_url TEXT,                            -- optional call-to-action target
  context JSONB NOT NULL DEFAULT '{}',     -- e.g. { "course_id": "...", "suggestion_id": "..." }
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'read', 'acted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,                      -- when actually delivered (in-app insert / email send)
  read_at TIMESTAMPTZ,                      -- in-app: when the student opened it
  acted_at TIMESTAMPTZ,                     -- when the student clicked the CTA
  returned_at TIMESTAMPTZ                   -- efficacy: student had a session after sent_at (cron-set)
);

COMMENT ON TABLE notifications IS
  'Per-recipient delivery rows. channel=inapp rows ARE the student inbox. '
  'channel=email rows are the Resend mirror. returned_at = efficacy (session after nudge).';
COMMENT ON COLUMN notifications.context IS
  'Arbitrary context jsonb (course_id, suggestion_id, etc.). Drives cta_url and efficacy scoping.';
COMMENT ON COLUMN notifications.returned_at IS
  'EFFICACY signal: set by the cron job when the recipient had a learning session after sent_at.';

-- =============================================================================
-- 3. nudge_suggestions — the ASSISTED layer: analysis suggests, admin approves
-- =============================================================================
-- The risk engine (same as the roster / next-best-action) writes `pending` rows
-- grouping the target students by `type`. The admin approves (one click), which
-- the app turns into notifications rows. `rationale` is the human-readable "why".
-- =============================================================================
CREATE TABLE IF NOT EXISTS nudge_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL
    CHECK (type IN (
      'never_accessed',
      'inactive',
      'no_reflection',
      'top_performer',
      'announcement',
      'custom'
    )),
  target_student_ids JSONB NOT NULL DEFAULT '[]',  -- array of users.id
  template_key TEXT,                                -- notification_templates.key to use
  rationale TEXT,                                   -- human-readable "why this nudge"
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'dismissed')),
  suggested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ
);

COMMENT ON TABLE nudge_suggestions IS
  'ASSISTED nudges: the risk engine writes pending suggestions; an admin approves '
  '(one click) to materialise notifications. type mirrors the roster risk categories.';
COMMENT ON COLUMN nudge_suggestions.target_student_ids IS
  'JSONB array of users.id the nudge targets (snapshot at suggestion time).';

-- =============================================================================
-- 4. notification_audiences — saved targeting criteria (reuses area-gestor + risk)
-- =============================================================================
-- A reusable audience definition. `criteria` is a jsonb predicate the app
-- resolves into a student set — e.g. { "risk": "inactive" }, { "unit_id": "..." }
-- (an `areas` UNIDADE), { "manager_group_id": "..." }, { "course_id": "..." }.
-- =============================================================================
CREATE TABLE IF NOT EXISTS notification_audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  criteria JSONB NOT NULL DEFAULT '{}',    -- { risk | unit_id | manager_group_id | course_id }
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE notification_audiences IS
  'Saved targeting criteria. criteria jsonb resolves to a student set: '
  'risk | unit_id (areas/UNIDADE) | manager_group_id (area-gestor) | course_id.';

-- =============================================================================
-- 5. Indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_notif_templates_tenant    ON notification_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notif_templates_active     ON notification_templates(tenant_id) WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_notifications_tenant       ON notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient    ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_template     ON notifications(template_id);
-- Student inbox query: their own unread in-app rows, newest first.
CREATE INDEX IF NOT EXISTS idx_notifications_inbox        ON notifications(recipient_id, created_at DESC)
  WHERE channel = 'inapp';
CREATE INDEX IF NOT EXISTS idx_notifications_unread       ON notifications(recipient_id)
  WHERE channel = 'inapp' AND status IN ('queued', 'sent');
-- Efficacy cron: scan sent rows that have not yet been marked returned.
CREATE INDEX IF NOT EXISTS idx_notifications_efficacy     ON notifications(sent_at)
  WHERE returned_at IS NULL AND sent_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nudge_suggestions_tenant   ON nudge_suggestions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nudge_suggestions_pending  ON nudge_suggestions(tenant_id, suggested_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_notif_audiences_tenant     ON notification_audiences(tenant_id);

-- =============================================================================
-- 6. updated_at triggers (parity with other tables)
-- =============================================================================
CREATE OR REPLACE FUNCTION set_engagement_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notif_templates_updated_at ON notification_templates;
CREATE TRIGGER trg_notif_templates_updated_at
  BEFORE UPDATE ON notification_templates
  FOR EACH ROW EXECUTE FUNCTION set_engagement_updated_at();

DROP TRIGGER IF EXISTS trg_notif_audiences_updated_at ON notification_audiences;
CREATE TRIGGER trg_notif_audiences_updated_at
  BEFORE UPDATE ON notification_audiences
  FOR EACH ROW EXECUTE FUNCTION set_engagement_updated_at();

-- =============================================================================
-- 7. RLS — notification_templates  (admin/manager manage; super_admin bypass)
-- =============================================================================
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nt_super_admin ON notification_templates;
CREATE POLICY nt_super_admin ON notification_templates FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- SELECT: any tenant member with a managing/teaching role may read templates
-- (so a manager composing a nudge sees them). Students never read templates.
DROP POLICY IF EXISTS nt_select ON notification_templates;
CREATE POLICY nt_select ON notification_templates FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('admin', 'manager', 'instructor', 'teacher')
  );

-- WRITE (INSERT/UPDATE/DELETE): admin/manager of the tenant only.
DROP POLICY IF EXISTS nt_write ON notification_templates;
CREATE POLICY nt_write ON notification_templates FOR ALL
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('admin', 'manager')
  )
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('admin', 'manager')
  );

-- =============================================================================
-- 8. RLS — notifications  (student sees/updates ONLY their own; staff manage)
-- =============================================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_super_admin ON notifications;
CREATE POLICY notifications_super_admin ON notifications FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Service role (cron efficacy job, Resend email send) — full access, scoped to
-- service_role so it never leaks to authenticated/anon callers.
DROP POLICY IF EXISTS notifications_service ON notifications;
CREATE POLICY notifications_service ON notifications FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- SELECT: the recipient reads their OWN rows; tenant admin/manager read all
-- tenant rows; the owning gestor reads rows for students on their team(s).
DROP POLICY IF EXISTS notifications_select ON notifications;
CREATE POLICY notifications_select ON notifications FOR SELECT
  TO authenticated
  USING (
    tenant_id = auth_tenant_id()
    AND (
      recipient_id = auth.uid()
      OR auth_user_role() IN ('admin', 'manager')
      OR recipient_id IN (
        SELECT mgm.student_id
        FROM manager_group_members mgm
        WHERE mgm.group_id = ANY (auth_managed_group_ids())
      )
    )
  );

-- INSERT: admin/manager of the tenant create notifications (the approve-nudge /
-- manual-send path). recipient must belong to the same tenant. Cron/email use
-- the service_role policy above.
DROP POLICY IF EXISTS notifications_insert ON notifications;
CREATE POLICY notifications_insert ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('admin', 'manager')
    AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = notifications.recipient_id
        AND u.tenant_id = auth_tenant_id()
    )
  );

-- UPDATE — student branch: the recipient may update ONLY their own in-app row,
-- and only to advance read/acted state. WITH CHECK re-asserts ownership and that
-- they cannot move the row to another recipient/tenant or escalate channel.
DROP POLICY IF EXISTS notifications_update_recipient ON notifications;
CREATE POLICY notifications_update_recipient ON notifications FOR UPDATE
  TO authenticated
  USING (
    tenant_id = auth_tenant_id()
    AND recipient_id = auth.uid()
    AND channel = 'inapp'
  )
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND recipient_id = auth.uid()
    AND channel = 'inapp'
  );

-- UPDATE — staff branch: admin/manager may manage tenant rows (e.g. resend,
-- correct status). Kept separate from the recipient branch for clarity.
DROP POLICY IF EXISTS notifications_update_staff ON notifications;
CREATE POLICY notifications_update_staff ON notifications FOR UPDATE
  TO authenticated
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('admin', 'manager')
  )
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('admin', 'manager')
  );

-- DELETE: admin/manager of the tenant only (students cannot delete inbox rows).
DROP POLICY IF EXISTS notifications_delete ON notifications;
CREATE POLICY notifications_delete ON notifications FOR DELETE
  TO authenticated
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('admin', 'manager')
  );

-- =============================================================================
-- 9. RLS — nudge_suggestions  (admin/manager only; never student-facing)
-- =============================================================================
ALTER TABLE nudge_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ns_super_admin ON nudge_suggestions;
CREATE POLICY ns_super_admin ON nudge_suggestions FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Service role — the suggestion generator (risk analysis job) writes pending rows.
DROP POLICY IF EXISTS ns_service ON nudge_suggestions;
CREATE POLICY ns_service ON nudge_suggestions FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- SELECT + WRITE: admin/manager of the tenant. Students never see suggestions.
DROP POLICY IF EXISTS ns_select ON nudge_suggestions;
CREATE POLICY ns_select ON nudge_suggestions FOR SELECT
  TO authenticated
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('admin', 'manager')
  );

DROP POLICY IF EXISTS ns_write ON nudge_suggestions;
CREATE POLICY ns_write ON nudge_suggestions FOR ALL
  TO authenticated
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('admin', 'manager')
  )
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('admin', 'manager')
  );

-- =============================================================================
-- 10. RLS — notification_audiences  (admin/manager only)
-- =============================================================================
ALTER TABLE notification_audiences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS na_super_admin ON notification_audiences;
CREATE POLICY na_super_admin ON notification_audiences FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS na_select ON notification_audiences;
CREATE POLICY na_select ON notification_audiences FOR SELECT
  TO authenticated
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('admin', 'manager', 'instructor', 'teacher')
  );

DROP POLICY IF EXISTS na_write ON notification_audiences;
CREATE POLICY na_write ON notification_audiences FOR ALL
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('admin', 'manager')
  )
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('admin', 'manager')
  );

-- =============================================================================
-- 11. SEED — default nudge templates for every existing tenant (idempotent)
-- =============================================================================
-- One row per (tenant, key). ON CONFLICT (tenant_id, key) DO NOTHING keeps this
-- safe to re-run and non-destructive to admin edits. created_by left NULL
-- (system seed). Variables: {{primeiro_nome}}, {{curso}} where it makes sense.
-- =============================================================================
INSERT INTO notification_templates
  (tenant_id, key, name, category, channel_inapp, channel_email, title, body_inapp, email_subject, email_html, variables, is_active, created_by)
SELECT
  t.id, s.key, s.name, s.category, s.channel_inapp, s.channel_email,
  s.title, s.body_inapp, s.email_subject, s.email_html, s.variables, true, NULL
FROM tenants t
CROSS JOIN (
  VALUES
    (
      'never_accessed',
      'Nunca acessou a plataforma',
      'nudge', true, true,
      'Seu acesso já está disponível 🎓',
      'Olá, {{primeiro_nome}}! Notamos que você ainda não acessou a plataforma. Seu acesso está pronto e esperando por você. Entre agora e comece sua jornada.',
      'Seu acesso à plataforma está disponível!',
      '<p>Olá, {{primeiro_nome}}!</p><p>Notamos que você ainda não acessou a plataforma de aprendizagem. Seu acesso está pronto e esperando por você. Entre agora e comece sua jornada de desenvolvimento!</p>',
      '["primeiro_nome"]'::jsonb
    ),
    (
      'inactive_14d',
      'Inativo há mais de 14 dias',
      'nudge', true, true,
      'Sentimos sua falta 👋',
      'Olá, {{primeiro_nome}}! Faz mais de 14 dias desde seu último acesso. Tem novos conteúdos esperando por você. Que tal retomar de onde parou?',
      'Sentimos sua falta na plataforma!',
      '<p>Olá, {{primeiro_nome}}!</p><p>Faz mais de 14 dias desde seu último acesso à plataforma. Tem novos conteúdos esperando por você. Que tal retomar de onde parou?</p>',
      '["primeiro_nome"]'::jsonb
    ),
    (
      'session_no_reflection',
      'Sessões sem reflexão',
      'nudge', true, true,
      'Suas reflexões estão pendentes ✍️',
      'Olá, {{primeiro_nome}}! Você completou suas sessões, mas ainda não registrou suas reflexões. As reflexões são parte essencial do aprendizado — reserve alguns minutos para consolidar o que aprendeu em {{curso}}.',
      'Suas reflexões estão pendentes',
      '<p>Olá, {{primeiro_nome}}!</p><p>Você completou suas sessões de aprendizagem, mas ainda não registrou suas reflexões. As reflexões são parte essencial do processo — reserve alguns minutos para consolidar o que aprendeu em {{curso}}.</p>',
      '["primeiro_nome","curso"]'::jsonb
    ),
    (
      'top_performer_recognition',
      'Reconhecimento de destaque',
      'nudge', true, true,
      'Parabéns pelo seu desempenho! 🏆',
      'Olá, {{primeiro_nome}}! Queremos reconhecer seu excelente engajamento. Seu esforço e dedicação nas sessões e reflexões estão fazendo a diferença. Continue assim!',
      'Parabéns pelo seu desempenho!',
      '<p>Olá, {{primeiro_nome}}!</p><p>Queremos reconhecer seu excelente engajamento na plataforma. Seu esforço e dedicação nas sessões e reflexões estão fazendo a diferença. Continue assim!</p>',
      '["primeiro_nome"]'::jsonb
    ),
    (
      'announcement_generic',
      'Comunicado geral',
      'announcement', true, true,
      'Comunicado da equipe 📣',
      'Olá, {{primeiro_nome}}! Temos um comunicado importante para você.',
      'Comunicado da equipe',
      '<p>Olá, {{primeiro_nome}}!</p><p>Temos um comunicado importante para você.</p>',
      '["primeiro_nome"]'::jsonb
    )
) AS s(key, name, category, channel_inapp, channel_email, title, body_inapp, email_subject, email_html, variables)
ON CONFLICT (tenant_id, key) DO NOTHING;

COMMIT;
