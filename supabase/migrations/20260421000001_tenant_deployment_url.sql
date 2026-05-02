ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deployment_url text;
COMMENT ON COLUMN tenants.deployment_url IS 'URL base do deployment desse tenant (ex: https://cory.eximiaacademy.com.br)';
