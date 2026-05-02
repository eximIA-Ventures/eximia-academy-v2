-- =============================================================
-- Cory Alimentos: rename RP + add MG tenant
-- =============================================================

-- 1. Rename existing "Cory Alimentos" → "Cory Alimentos-RP"
UPDATE tenants
SET name       = 'Cory Alimentos-RP',
    slug       = 'cory-alimentos-rp',
    updated_at = now()
WHERE slug = 'cory-alimentos';

-- 2. Insert new tenant "Cory Alimentos - MG" (idempotent)
INSERT INTO tenants (name, slug, plan, status)
VALUES ('Cory Alimentos - MG', 'cory-alimentos-mg', 'premium', 'active')
ON CONFLICT (slug) DO NOTHING;
