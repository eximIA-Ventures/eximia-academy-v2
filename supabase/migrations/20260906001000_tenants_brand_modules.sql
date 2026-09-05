-- `tenants.brand jsonb` + `tenants.modules text[]` — a MARCA e os MODULOS saem
-- do build e passam a morar no banco.
--
-- Faxina 2026-09, M2 do `docs/faxina-2026-09/02-plano-app-novo.md`, sob a
-- decisao D4 de `00-decisoes.md`.
--
-- =============================================================================
-- POR QUE COLUNA NOVA, E NAO REUSO DE `branding` / `whitelabel_config`
-- =============================================================================
-- As duas colunas jsonb que ja existem tem DOIS shapes divergentes, escritos por
-- DUAS telas diferentes:
--   * `admin/settings/actions.ts:36-41`         grava `branding` como
--       {logo_url, primary_color, secondary_color}
--   * `admin/settings/whitelabel-actions.ts` (via `whitelabelConfigSchema`,
--     `packages/shared/src/validators/whitelabel.ts:3-16`) grava
--     `whitelabel_config` como
--       {custom_texts:{app_name,tagline,login_title,login_subtitle},
--        favicon_url, footer_text, support_email, custom_css}
-- Nenhum dos dois e o shape de `TenantConfig.brand`
-- (`packages/shared/src/modules/tenant-config.ts:7-38`), que e o que os shells
-- de layout consomem. Casar os tres shapes no meio da leitura por request e
-- onde nascem os bugs silenciosos de marca. Uma coluna, um shape, uma fonte.
--
-- =============================================================================
-- O SHAPE EXATO DE `brand` (contrato para o codigo TypeScript)
-- =============================================================================
--   {
--     "name":         text,   -- obrigatorio
--     "slug":         text,   -- obrigatorio (== tenants.slug)
--     "logo":         text,   -- obrigatorio (caminho /public ou URL do bucket)
--     "logoLight":    text?,  -- ausente => cai em "logo"
--     "favicon":      text?,
--     "primaryColor": text,   -- hex #rrggbb
--     "accentColor":  text,   -- hex #rrggbb
--     "partnerName":  text?,
--     "partnerLogo":  text?
--   }
-- E `TenantConfig.brand` INTEIRO e NADA ALEM DELE.
--
-- `TenantConfig.modules` -> coluna `modules text[]` (validada contra MODULE_IDS
--   no app, `packages/shared/src/modules/registry.ts:5-15`, nao por CHECK).
-- `TenantConfig.settings` -> CONTINUA vindo de `tenants.settings`
--   (max_interactions_per_session, ai_model) e de `tenants.whitelabel_config`
--   (footer_text -> footerText, support_email -> supportEmail). Nao ha coluna
--   nova para settings, e nao ha copia de dado: seria criar uma terceira verdade
--   para o mesmo campo.
--
-- =============================================================================
-- `customCSS` FICA DE FORA. ISTO NAO E OMISSAO, E A DECISAO D4.
-- =============================================================================
-- `TenantConfig.settings.customCSS` desemboca em `dangerouslySetInnerHTML` em
-- quatro pontos ((platform)/layout.tsx:75,211,330 e (studio)/layout.tsx:63).
-- `apps/web/tenant.config.ts:158-161` documenta que ele NAO e exposto por env
-- justamente por isso. Do lado do banco, `whitelabelConfigSchema` aceita
-- `custom_css` ate 5000 chars e `saveWhitelabelConfig` libera qualquer chapeu
-- `admin` — nao so super_admin — a grava-lo. Ler a marca do banco INCLUINDO esse
-- campo transformaria um admin de cliente em injetor de CSS na plataforma
-- inteira, contra um sanitizador por blocklist (`lib/utils/sanitize-css.ts:29`),
-- abordagem sabidamente fragil.
-- Por isso: `brand` NAO tem chave `customCSS`, e o resolvedor de TenantConfig
-- NAO deve ler `whitelabel_config->>'custom_css'`. A coluna antiga continua
-- existindo com o dado que ja tem; ela apenas deixa de ter leitor.
--
-- =============================================================================
-- O MAPEAMENTO DA MIGRATION DE DADOS, CAMPO A CAMPO
-- =============================================================================
--   brand.name         <- whitelabel_config->'custom_texts'->>'app_name'
--                         senao tenants.name
--   brand.slug         <- tenants.slug                     (sempre)
--   brand.logo         <- branding->>'logo_url'            senao '/brand/logo.png'
--   brand.logoLight    <- branding->>'logo_light_url'      senao OMITIDO
--                         (a coluna nao tem esse campo hoje; fica para quando a
--                          tela passar a grava-lo. Ausente => o app cai em logo.)
--   brand.favicon      <- whitelabel_config->>'favicon_url' senao '/brand/favicon.ico'
--   brand.primaryColor <- branding->>'primary_color'       senao '#2a6ab0'
--   brand.accentColor  <- branding->>'secondary_color'     senao '#C4A882'
--   brand.partnerName  <- OMITIDO  (nao existe no banco hoje)
--   brand.partnerLogo  <- OMITIDO  (idem)
--
-- Os defaults sao os valores do NEUTRO (`apps/web/tenant.config.ts:70-89`), byte
-- a byte — nao "uma cor bonita". Cor so e aceita se casar `^#[0-9a-fA-F]{6}$`;
-- lixo cai no default em vez de virar CSS invalido na pagina.
--
-- IDEMPOTENCIA: o UPDATE so toca linhas com `brand = '{}'`. Rodar de novo, ou
-- rodar depois de alguem ter editado a marca pela tela nova, nao sobrescreve
-- nada.
--
-- `modules` NAO e backfillada. Nao existe no banco nenhum registro do que cada
-- empresa CONTRATOU — hoje isso so existe como env de build no EasyPanel
-- (`NEXT_PUBLIC_TENANT_MODULES`). Inventar aqui seria dar ou tirar modulo de
-- cliente por chute. Array vazio significa "nao declarado", e o resolvedor cai
-- na ordem banco -> env -> NEUTRO (D4). A rota
-- `POST /api/admin/tenants/[id]/importar-marca-do-ambiente` (D20) e o caminho
-- para trazer os valores reais do servico da Cory antes da virada.
--
-- REVERSAO:
--   ALTER TABLE public.tenants DROP COLUMN IF EXISTS brand;
--   ALTER TABLE public.tenants DROP COLUMN IF EXISTS modules;

BEGIN;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS brand jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS modules text[] NOT NULL DEFAULT '{}'::text[];

DO $$ BEGIN
  ALTER TABLE public.tenants
    ADD CONSTRAINT tenants_brand_is_object CHECK (jsonb_typeof(brand) = 'object');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.tenants.brand IS
  'TenantConfig.brand (name, slug, logo, logoLight?, favicon?, primaryColor, accentColor, partnerName?, partnerLogo?). SEM customCSS — ver D4. Fonte de verdade da marca por request.';
COMMENT ON COLUMN public.tenants.modules IS
  'TenantConfig.modules — modulos CONTRATADOS pela empresa. Exposicao de UI, nunca permissao (a trava e RLS). Validado contra MODULE_IDS no app. Vazio = nao declarado.';

-- ---------------------------------------------------------------------------
-- Migration de dados. So toca `brand = '{}'`.
-- ---------------------------------------------------------------------------
UPDATE public.tenants t
   SET brand = jsonb_strip_nulls(
         jsonb_build_object(
           'name', COALESCE(
                     NULLIF(TRIM(t.whitelabel_config -> 'custom_texts' ->> 'app_name'), ''),
                     t.name),
           'slug', t.slug,
           'logo', COALESCE(
                     NULLIF(TRIM(t.branding ->> 'logo_url'), ''),
                     '/brand/logo.png'),
           'logoLight', NULLIF(TRIM(t.branding ->> 'logo_light_url'), ''),
           'favicon', COALESCE(
                        NULLIF(TRIM(t.whitelabel_config ->> 'favicon_url'), ''),
                        '/brand/favicon.ico'),
           'primaryColor', CASE
                             WHEN TRIM(COALESCE(t.branding ->> 'primary_color', '')) ~ '^#[0-9a-fA-F]{6}$'
                               THEN TRIM(t.branding ->> 'primary_color')
                             ELSE '#2a6ab0'
                           END,
           'accentColor', CASE
                            WHEN TRIM(COALESCE(t.branding ->> 'secondary_color', '')) ~ '^#[0-9a-fA-F]{6}$'
                              THEN TRIM(t.branding ->> 'secondary_color')
                            ELSE '#C4A882'
                          END
         ))
 WHERE t.brand = '{}'::jsonb;

COMMIT;
