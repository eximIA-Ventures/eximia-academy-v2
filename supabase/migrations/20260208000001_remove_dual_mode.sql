-- =============================================================
-- Story 6.1: Remove dual-mode (university/corporate)
-- Focus 100% corporativo. Modo universidade removido.
-- IRREVERSIVEL — fazer backup antes de executar
-- =============================================================

-- Remove mode column and its CHECK constraint from tenants
ALTER TABLE tenants DROP COLUMN IF EXISTS mode;
-- Remove mode column and its CHECK constraint from courses
ALTER TABLE courses DROP COLUMN IF EXISTS mode;
