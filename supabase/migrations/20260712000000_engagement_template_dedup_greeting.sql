-- ---------------------------------------------------------------------------
-- Engagement Center v2 — remove the embedded greeting from seed template BODIES
-- (E12 Rodada 7 item 3, double-greeting fix).
-- ---------------------------------------------------------------------------
-- WHY: the 5 seed nudge templates (migration 20260604120000) open their
-- `body_inapp` with "Olá, {{primeiro_nome}}!...". The engagement engine's
-- `renderWithOrigin` ALSO prepends a canonical greeting ("Olá, {nome}. Aqui é
-- {gestor}." / "Olá, {nome}. A exímIA Academy percebeu o seguinte:") to EVERY
-- in-app body. The two stacked, so a manager-origin send produced:
--     "Olá, Venilton. Aqui é Rinaldo.
--
--      Olá, {{primeiro_nome}}! Você completou suas sessões..."
-- — the double salutation Hugo screenshotted.
--
-- SINGLE SOURCE OF TRUTH: `renderWithOrigin` owns the salutation. The template
-- BODY must carry only the substantive copy. This UPDATE strips the leading
-- "Olá, {{primeiro_nome}}! " (and any following space) from `body_inapp` of the
-- 5 seed templates, in EVERY tenant, leaving the rest verbatim.
--
-- SCOPE — body_inapp ONLY. `email_html` is deliberately LEFT UNCHANGED: in the
-- platform-origin + pure-template email path the engine sends the template's own
-- `email_html` RAW (engine.ts: "pure template + platform → keep the template's
-- own email html"), so its greeting is the SOLE greeting there — stripping it
-- would leave that email with no salutation. The in-app body is the only field
-- that is always re-wrapped by renderWithOrigin, so it is the only one that
-- double-greeted.
--
-- BACKSTOP: engine.renderWithOrigin was also made idempotent in the same round
-- (it strips a pre-existing leading "Olá, ..." line before applying its own), so
-- a tenant that EDITED a template body back to include a greeting, or a legacy
-- row this migration hasn't reached, still cannot double-greet. This migration
-- makes the stored seed HONEST; the guard makes the engine SAFE.
--
-- IDEMPOTENT: the UPDATE only touches rows whose body still begins with the
-- embedded greeting, so a re-run (or a row already clean) is a no-op.
-- ADDITIVE: no schema change, no template removed, no key touched.
-- ---------------------------------------------------------------------------

UPDATE notification_templates
SET body_inapp = regexp_replace(
      body_inapp,
      '^Olá, \{\{primeiro_nome\}\}!\s*',
      '',
      'i'
    )
WHERE key IN (
        'never_accessed',
        'inactive_14d',
        'session_no_reflection',
        'top_performer_recognition',
        'announcement_generic'
      )
  AND body_inapp LIKE 'Olá, {{primeiro_nome}}!%';
