-- Allow platform-level API keys (no tenant) for super admin
ALTER TABLE integration_keys ALTER COLUMN tenant_id DROP NOT NULL;
