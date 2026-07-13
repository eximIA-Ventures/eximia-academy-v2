-- =============================================================================
-- Migration: ENGAGEMENT CAMPAIGNS — the campaign as a first-class, observable
--            object (E13 redesign, "campanha = lote de ações individuais
--            revisáveis com loop fechado")
-- =============================================================================
-- Extends the Engagement Engine (20260604120000_engagement_engine.sql,
-- 20260708120000_engagement_center_v2.sql, 20260710000000_engagement_personal_templates.sql)
-- so a manager's dispatch is no longer an anonymous burst of N notifications, but
-- a NAMED, STATEFUL campaign that stays OPEN as an observable object until the
-- return window closes (or the manager closes it), then shows a RESULT.
--
-- APPROVED DEFAULTS (Hugo, product owner, on the E13 proposal):
--   D1  → CREATE the `campaigns` table (Option B), not just a campaign_id in
--         context. A table is the only place the "encerramento" state (Ulwick)
--         can live.
--   D2  → return-measurement window default = 7 days (fast feedback; the manager
--         can still see "ainda em janela").
--   D3  → "No ritmo" (reconhecimento) is a VALID campaign segment, kept as an
--         optional origin alongside the two risk states.
--   D4  → per-recipient variation with TEMPLATE as default + free-text override
--         per line. See the "D4 — WHERE the variation lives" note below: this
--         needs NO new table and NO new per-recipient column — the existing
--         `notifications.body` (already rendered per row) + the free-form
--         `message` override in `dispatchTeamNudge` already carry it. This
--         migration only adds an OPTIONAL marker convention so the app can tell
--         "override" from "template" if it wants to — the load-bearing storage
--         already exists.
--   D5  → closure is BOTH automatic (cron, when window_end passes) AND manual
--         (manager button). The `closed_by` (nullable) + `closed_reason`
--         (auto|manual) columns record WHO/WHAT closed it.
--
-- =============================================================================
-- D4 — WHERE the per-recipient variation lives (investigated before proposing
--      any new structure, per the brief):
-- =============================================================================
--   The E13 §2 "coração da proposta" is variation per destinatário. The naive
--   move would be a `campaign_recipients` table or a per-row override column.
--   NEITHER is needed, and adding one would be redundant infra:
--     • `notifications.body` is ALREADY one row per recipient, holding the
--       ALREADY-RENDERED text for THAT student (engine.ts renderTemplate + the
--       per-recipient loop). Two students in the same campaign already get two
--       different `body` values.
--     • `dispatchTeamNudge` ALREADY accepts a free-form `message` that OVERRIDES
--       the template body ("A free-form `message` from the manager OVERRIDES the
--       template body", engine.ts). For a PER-LINE override the confirm endpoint
--       just calls the per-recipient path with that line's text — the storage
--       (`notifications.body`) is identical whether the text came from the
--       template or a manual edit.
--   So the variation is FULLY representable today with zero schema change to the
--   per-recipient row. The ONLY thing missing is an OPTIONAL provenance marker so
--   analytics/UI can distinguish "this line used the template" from "this line was
--   hand-edited". We express that as a documented CONVENTION on the existing
--   `notifications.context` jsonb (context->>'variation' ∈ 'template'|'override'),
--   NOT a new column — context is already the row's free-form metadata bag and the
--   history route already filters on context keys (context->>nudge_type). A column
--   would be premature; if a hard constraint is ever needed it can be promoted
--   later. This is the D4 decision the brief asked to document: BODY already
--   resolves it; the marker is a convention, not new infra.
--
-- =============================================================================
-- SECURITY / RLS (mirrors the ESTABLISHED engagement pattern, NOT a new model):
--   Same shape as notifications (20260604120000_engagement_engine.sql §8) +
--   the group-scope WRITE trava (20260630000000_engagement_rls_group_scope.sql):
--     • super_admin  → FOR ALL bypass.
--     • service_role → FOR ALL USING(true) (the product path writes via the
--       service client; the app-layer scope re-resolution is the real trava, per
--       the engagement-scope.ts pattern — this policy is for that path).
--     • authenticated SELECT → tenant member; manager sees ONLY campaigns they
--       created (created_by = auth.uid()); admin tenant-wide.
--     • authenticated WRITE  → manager may write ONLY their own campaigns
--       (created_by = auth.uid()); admin tenant-wide. This is the campaign-level
--       analogue of the recipient-level group predicate on notifications: a
--       campaign is "owned" by its creating manager, so ownership (created_by)
--       is the natural scope key here (there is no recipient on the header row).
--   Never trust a tenant_id/created_by from the client — WITH CHECK re-asserts
--   both against the caller.
--
-- FULLY ADDITIVE + IDEMPOTENT: CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT
-- EXISTS, CREATE INDEX IF NOT EXISTS, DROP POLICY IF EXISTS then CREATE, and a
-- CREATE OR REPLACE for the result-aggregation function. No table dropped/renamed.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. campaigns — the campaign HEADER (cabeçalho do lote + ciclo de vida)
-- =============================================================================
-- Holds ONLY the header + lifecycle. The individual messages stay in
-- `notifications` (source of truth, re-scoped as today); this table never holds
-- a recipient or a message body. `segment` is the semáforo state the campaign
-- was launched from (E13 §4); `focus_node` is the optional area/course focus of
-- the recorte (mirrors the ?focus= scoping the campaign route already uses).
-- `return_window_days` is the D2 measurement window (default 7); `window_end` is
-- the derived deadline (created_at + return_window_days), stored so the cron and
-- the UI agree without recomputing. `status` is open/closed (D5). `closed_by` +
-- `closed_reason` record who/what closed it (cron auto vs manager manual).
-- =============================================================================
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,  -- owning manager (RLS scope key)
  name TEXT,                                                 -- optional human label

  -- D3: entry segment from the unified semáforo. 'no_ritmo' (reconhecimento) is a
  -- valid origin alongside the two risk states. Kept broad + CHECK-constrained so
  -- an unknown segment can never be persisted.
  segment TEXT NOT NULL DEFAULT 'atencao'
    CHECK (segment IN ('atencao', 'sem_acesso', 'no_ritmo')),

  -- Optional recorte focus (area/course node id the campaign was scoped to). Free
  -- uuid/text — the app resolves it via ?focus=, same as the campaign route today.
  focus_node TEXT,

  -- D2: return-measurement window. Default 7 days (fast feedback). window_end is
  -- the derived deadline the cron/UI both read (created_at + window). Stored
  -- explicitly so closing logic never has to recompute the interval.
  return_window_days INTEGER NOT NULL DEFAULT 7
    CHECK (return_window_days > 0 AND return_window_days <= 90),
  window_end TIMESTAMPTZ,

  -- D5: lifecycle. open while inside the window; closed when the window expires
  -- (cron) OR the manager closes it. closed_by/closed_reason record which.
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed')),
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES users(id) ON DELETE SET NULL,  -- NULL for auto (cron); manager id for manual
  closed_reason TEXT
    CHECK (closed_reason IS NULL OR closed_reason IN ('auto', 'manual')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Integrity: a closed campaign MUST carry a reason + closed_at; an open one MUST
  -- NOT. Enforced at the DB so a malformed transition can never leave a campaign
  -- half-closed (status=closed with no reason, or open with a stale closed_at).
  CONSTRAINT campaigns_closure_chk CHECK (
    (status = 'open'   AND closed_at IS NULL AND closed_reason IS NULL AND closed_by IS NULL)
    OR
    (status = 'closed' AND closed_at IS NOT NULL AND closed_reason IS NOT NULL)
  )
);

COMMENT ON TABLE campaigns IS
  'Campaign HEADER + lifecycle (E13). One row per manager dispatch batch. The '
  'individual messages live in notifications (campaign_id FK); this table never '
  'holds a recipient or a body. status open→closed by cron (auto) or manager (manual).';
COMMENT ON COLUMN campaigns.segment IS
  'Unified semáforo state the campaign was launched from (D3): atencao (vermelho) | '
  'sem_acesso (amarelo) | no_ritmo (verde/reconhecimento). Mirrors student-triage.ts.';
COMMENT ON COLUMN campaigns.return_window_days IS
  'D2: return-measurement window in days (default 7). window_end = created_at + this.';
COMMENT ON COLUMN campaigns.closed_by IS
  'D5: manager id when closed_reason=manual; NULL when closed_reason=auto (cron).';
COMMENT ON COLUMN campaigns.closed_reason IS
  'D5: how the campaign closed — auto (window expired, cron) or manual (manager button).';

-- Default window_end to created_at + return_window_days when not supplied. Kept as
-- a BEFORE INSERT trigger (not a generated column) because it depends on the
-- return_window_days chosen at insert time and stays stable afterwards.
CREATE OR REPLACE FUNCTION set_campaign_window_end() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.window_end IS NULL THEN
    -- return_window_days is a bounded integer (CHECK 1..90); multiplying the
    -- 1-day interval is injection-safe and matches the day-based horizon the rest
    -- of the engagement code reasons in (SEM_ACESSO_DAYS, elapsedDays, etc.).
    NEW.window_end := NEW.created_at + (NEW.return_window_days * interval '1 day');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_campaigns_window_end ON campaigns;
CREATE TRIGGER trg_campaigns_window_end
  BEFORE INSERT ON campaigns
  FOR EACH ROW EXECUTE FUNCTION set_campaign_window_end();

-- updated_at parity (reuses the engagement helper from 20260604120000).
DROP TRIGGER IF EXISTS trg_campaigns_updated_at ON campaigns;
CREATE TRIGGER trg_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION set_engagement_updated_at();

-- =============================================================================
-- 2. notifications.campaign_id — link a dispatched notification to its campaign
-- =============================================================================
-- Nullable: NOT every notification comes from a campaign (assisted-nudge approvals,
-- system messages, and every pre-existing row have no campaign). ON DELETE SET
-- NULL so deleting a campaign header never destroys the delivery history — the
-- messages remain readable, they just lose the grouping. The E13 §2.3 convention
-- of ALSO mirroring campaign_id into context jsonb stays valid for query
-- convenience; this typed FK column is the authoritative link.
-- =============================================================================
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;

COMMENT ON COLUMN notifications.campaign_id IS
  'FK to the campaign that dispatched this notification (E13). NULL when the '
  'notification did not come from a campaign (assisted approval, system, legacy). '
  'ON DELETE SET NULL: deleting a campaign keeps the delivery history intact.';

-- =============================================================================
-- 3. Indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant        ON campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_creator        ON campaigns(tenant_id, created_by);
-- Cron auto-close scan: open campaigns whose window has passed.
CREATE INDEX IF NOT EXISTS idx_campaigns_open_window     ON campaigns(window_end)
  WHERE status = 'open';
-- The loop-closing aggregation joins notifications by campaign_id.
CREATE INDEX IF NOT EXISTS idx_notifications_campaign     ON notifications(campaign_id)
  WHERE campaign_id IS NOT NULL;

-- =============================================================================
-- 4. RLS — campaigns (super_admin bypass; service_role; creator-scoped manager)
-- =============================================================================
-- Same shape as notifications RLS (20260604120000 §8 + 20260630000000). The
-- scope key here is created_by (the owning manager) because a campaign header has
-- no recipient — it is the batch's owner. admin stays tenant-wide; super_admin
-- keeps cross-tenant bypass; the service_role policy is what the product path
-- (endpoint→engine, service client) actually uses, re-scoped in app code.
-- =============================================================================
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS campaigns_super_admin ON campaigns;
CREATE POLICY campaigns_super_admin ON campaigns FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Service role (cron auto-close, endpoint→engine dispatch) — full access, scoped
-- to service_role so it never leaks to authenticated/anon callers.
DROP POLICY IF EXISTS campaigns_service ON campaigns;
CREATE POLICY campaigns_service ON campaigns FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- SELECT: tenant admin/manager. A manager sees ONLY campaigns they created; an
-- admin sees all tenant campaigns. Students never see campaigns.
DROP POLICY IF EXISTS campaigns_select ON campaigns;
CREATE POLICY campaigns_select ON campaigns FOR SELECT
  TO authenticated
  USING (
    tenant_id = auth_tenant_id()
    AND (
      auth_user_role() = 'admin'
      OR (auth_user_role() = 'manager' AND created_by = auth.uid())
    )
  );

-- INSERT: admin tenant-wide; manager may only create a campaign owned by
-- THEMSELVES (created_by = auth.uid()). Constrains the DIRECT authenticated-client
-- vector (a gestor's JWT via PostgREST); the product path uses service_role +
-- the app-layer scope trava, exactly like notifications_insert.
DROP POLICY IF EXISTS campaigns_insert ON campaigns;
CREATE POLICY campaigns_insert ON campaigns FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND (
      auth_user_role() = 'admin'
      OR (auth_user_role() = 'manager' AND created_by = auth.uid())
    )
  );

-- UPDATE: admin tenant-wide; manager may only mutate their OWN campaigns (e.g.
-- the "encerrar campanha agora" manual-close button). WITH CHECK re-asserts
-- ownership so a manager cannot re-home a campaign to another creator/tenant.
DROP POLICY IF EXISTS campaigns_update ON campaigns;
CREATE POLICY campaigns_update ON campaigns FOR UPDATE
  TO authenticated
  USING (
    tenant_id = auth_tenant_id()
    AND (
      auth_user_role() = 'admin'
      OR (auth_user_role() = 'manager' AND created_by = auth.uid())
    )
  )
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND (
      auth_user_role() = 'admin'
      OR (auth_user_role() = 'manager' AND created_by = auth.uid())
    )
  );

-- DELETE: admin/manager of their own campaigns. Rarely used (closing, not
-- deleting, is the lifecycle) but kept symmetric. ON DELETE SET NULL on
-- notifications.campaign_id preserves the delivery history.
DROP POLICY IF EXISTS campaigns_delete ON campaigns;
CREATE POLICY campaigns_delete ON campaigns FOR DELETE
  TO authenticated
  USING (
    tenant_id = auth_tenant_id()
    AND (
      auth_user_role() = 'admin'
      OR (auth_user_role() = 'manager' AND created_by = auth.uid())
    )
  );

-- =============================================================================
-- 5. campaign_result(campaign_id) — the loop-closing aggregation
-- =============================================================================
-- "N de M destinatários retornaram dentro da janela" for a campaign, using the
-- EXACT "returned" criterion the efficacy cron writes and the Histórico (E8)
-- already reads — NOT a new definition:
--
--   A recipient "retornou" ⇔ their in-app nudge row has returned_at IS NOT NULL.
--   The candidate universe is the SAME filter efficacy.ts uses:
--       origin = 'nudge' AND channel = 'inapp' AND sent_at IS NOT NULL
--   (efficacy.ts: .eq("origin","nudge").eq("channel","inapp").not("sent_at","is",null),
--    and `if (r.returned_at) entry.returned += 1`). We reuse it verbatim, only
--   grouped by campaign_id instead of template_id.
--
-- SECURITY DEFINER so it can aggregate over notifications regardless of the
-- caller's row-level visibility, BUT it re-asserts the campaign's tenant + the
-- caller's authority INSIDE the function (a manager may only read the result of a
-- campaign they own; admin tenant-wide; super_admin bypass) — mirroring the RLS
-- above so the function is not a scope-bypass hole. Returns zeros for a campaign
-- the caller may not see (fail-closed, no row-count leak).
--
-- STABLE (read-only). Reads only notifications for the given campaign_id.
-- =============================================================================
CREATE OR REPLACE FUNCTION campaign_result(p_campaign_id UUID)
RETURNS TABLE (
  campaign_id        UUID,
  status             TEXT,
  window_end         TIMESTAMPTZ,
  recipients         BIGINT,   -- M: distinct in-app nudge recipients dispatched by the campaign
  read_count         BIGINT,   -- how many opened the in-app message (read_at set)
  returned_count     BIGINT,   -- N: how many returned to study within/after the nudge (returned_at set)
  return_rate        NUMERIC   -- returned / recipients, 0..1 (NULL when recipients = 0)
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _c campaigns%ROWTYPE;
  _authorized BOOLEAN := false;
BEGIN
  SELECT * INTO _c FROM campaigns WHERE id = p_campaign_id;
  IF NOT FOUND THEN
    RETURN;  -- unknown campaign → empty set (no leak)
  END IF;

  -- Re-assert the SAME authority the RLS SELECT policy grants: super_admin
  -- bypass; admin of the campaign's tenant; manager only for their OWN campaign.
  IF is_super_admin() THEN
    _authorized := true;
  ELSIF _c.tenant_id = auth_tenant_id() THEN
    IF auth_user_role() = 'admin' THEN
      _authorized := true;
    ELSIF auth_user_role() = 'manager' AND _c.created_by = auth.uid() THEN
      _authorized := true;
    END IF;
  END IF;

  IF NOT _authorized THEN
    RETURN;  -- fail-closed: caller may not see this campaign → empty set
  END IF;

  RETURN QUERY
  SELECT
    _c.id,
    _c.status,
    _c.window_end,
    COUNT(*) AS recipients,
    COUNT(n.read_at) AS read_count,
    COUNT(n.returned_at) AS returned_count,
    CASE WHEN COUNT(*) = 0 THEN NULL
         ELSE ROUND(COUNT(n.returned_at)::numeric / COUNT(*)::numeric, 4)
    END AS return_rate
  FROM notifications n
  WHERE n.campaign_id = _c.id
    -- SAME candidate filter as efficacy.ts / the Histórico return count.
    AND n.origin = 'nudge'
    AND n.channel = 'inapp'
    AND n.sent_at IS NOT NULL;
END;
$$;

COMMENT ON FUNCTION campaign_result(UUID) IS
  'Loop-closing aggregation for a campaign (E13): N of M recipients returned, '
  'reusing the EXACT efficacy criterion (returned_at over origin=nudge, '
  'channel=inapp, sent_at set). SECURITY DEFINER but re-asserts the caller''s '
  'authority (super_admin | tenant admin | owning manager); fail-closed otherwise.';

-- Grant execute to authenticated (the function itself gates authority per-campaign).
GRANT EXECUTE ON FUNCTION campaign_result(UUID) TO authenticated;
-- service_role (cron/endpoint) can also call it — it already bypasses the checks
-- via is_super_admin()/service context on its own reads, but the grant keeps the
-- product path uniform.
GRANT EXECUTE ON FUNCTION campaign_result(UUID) TO service_role;

COMMIT;

-- =============================================================================
-- APP-SIDE NOTES for @dev (not executed — guidance for the consuming stories):
-- =============================================================================
--  • CONFIRM (dispatch): insert one `campaigns` row FIRST (service client, stamped
--    tenant_id + created_by = the authenticated manager), then pass its id into
--    the per-recipient loop so every `notifications` row carries campaign_id (and,
--    per E13 §2.3, context.campaign_id too). The per-line D4 variation is just the
--    per-recipient `message` override already supported by dispatchTeamNudge —
--    optionally stamp context.variation = 'template' | 'override' per line.
--  • OPEN state (acompanhar): `SELECT * FROM campaign_result(:id)` gives
--    recipients / read / returned / rate; while status='open' show "aguardando
--    retorno até {window_end}".
--  • AUTO-CLOSE (cron): the efficacy cron (or a sibling step) does, per tenant,
--    UPDATE campaigns SET status='closed', closed_at=now(), closed_reason='auto'
--    WHERE status='open' AND window_end < now(). (Uses idx_campaigns_open_window.)
--  • MANUAL-CLOSE (manager button): UPDATE ... SET status='closed', closed_at=now(),
--    closed_reason='manual', closed_by=:managerId WHERE id=:id (RLS lets the owner do it).
--  • The efficacy cron itself is UNCHANGED — it keeps stamping returned_at per
--    notification; campaign_result only re-groups that existing signal.
-- =============================================================================
