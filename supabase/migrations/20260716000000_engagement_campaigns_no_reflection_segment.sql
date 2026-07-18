-- =============================================================================
-- Engagement Campaigns — add 'no_reflection' as a valid campaigns.segment (E17
-- gap / fatia 15). Extends the CHECK constraint added in
-- 20260711000000_engagement_campaigns.sql without touching any existing row.
-- =============================================================================
-- `no_reflection` (completou >=2 sessões mas 0 reflexões, engine.ts
-- classifyNudgeCohorts) is ORTHOGONAL to the unified semáforo (atencao/
-- sem_acesso/no_ritmo, computeEngagementTriage) — it is resolved from a
-- different roster signal (loadStudentSignals), not from StudentTriagem. It
-- still needs to be a legal value for the campaign HEADER's `segment` column
-- so a batch launched from this cohort persists its REAL origin (Eng-Capataz
-- decision 2026-07-16: mapping it to 'atencao' at insert time would misreport
-- campaign history, same honesty principle as fatia 9b's real Ativo/Última
-- edição fix).
--
-- NOTE (ops): this migration file is NOT applied against any live/remote
-- Supabase project in this session — it is committed to the repo, ready for
-- @devops (or whoever owns deploy) to apply when the rest of fatia 15 ships.
-- =============================================================================

ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_segment_check;

ALTER TABLE campaigns ADD CONSTRAINT campaigns_segment_check
  CHECK (segment IN ('atencao', 'sem_acesso', 'no_ritmo', 'no_reflection'));

COMMENT ON COLUMN campaigns.segment IS
  'Unified semáforo state OR the no_reflection cohort the campaign was launched '
  'from (D3 + fatia 15): atencao (vermelho) | sem_acesso (amarelo) | no_ritmo '
  '(verde/reconhecimento) | no_reflection (completou sessões sem refletir, '
  'resolvido via engine.ts classifyNudgeCohorts, ortogonal ao semáforo). Mirrors '
  'student-triage.ts StudentTriagem plus the NudgeType no_reflection member.';
