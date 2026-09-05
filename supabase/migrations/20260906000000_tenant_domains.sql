-- `tenant_domains` — a tabela de DOMINIOS PROPRIOS de empresa.
--
-- Faxina 2026-09, M1 do `docs/faxina-2026-09/02-plano-app-novo.md`, sob a
-- decisao D1 de `00-decisoes.md`.
--
-- =============================================================================
-- O QUE ESTA TABELA GUARDA — E O QUE ELA DELIBERADAMENTE NAO GUARDA
-- =============================================================================
-- GUARDA: dominio proprio de cliente, isto e, host que NAO e derivavel do slug.
--   Exemplo real hoje em producao: `argos.eximiaacademy.com.br`.
--
-- NAO GUARDA: o host canonico `{slug}.{NEXT_PUBLIC_APP_BASE_DOMAIN}`. Ele e
--   derivado POR STRING, no app, sem consultar o banco (D1). Isso e o que faz
--   "cadastrar empresa" ser instantaneo: empresa nova nasce com endereco no
--   mesmo segundo, sem linha nesta tabela e sem passo de DNS.
--
-- Consequencia direta para o codigo (contrato da onda B): a ordem de resolucao
-- de tenant por request e (D2):
--   1) `tenant_domains.host`  -> dominio proprio     (UNICA leitura de banco)
--   2) subdominio de `{base}` -> slug por string     (sem banco)
--   3) env `NEXT_PUBLIC_TENANT_SLUG`                 (modo legado, 1 servico por cliente)
--   4) NEUTRO -> `tenantId = null`                   (nunca uma linha de `tenants`)
--
-- HOST NUNCA AUTORIZA NADA. Esta tabela decide qual MARCA renderizar. Quem le o
-- que continua sendo RLS por `users.tenant_id`. Nao misturar os dois eixos.
--
-- =============================================================================
-- POR QUE `lower(host)` UNICO, E NAO `host` UNICO
-- =============================================================================
-- Host e case-insensitive por RFC. Um `UNIQUE (host)` cru aceitaria
-- `Argos.eximiaacademy.com.br` e `argos.eximiaacademy.com.br` como duas linhas —
-- e duas linhas para o mesmo endereco e' exatamente o risco R1 do plano ("marca
-- de A servida no host de B"), so que auto-infligido. O indice e sobre
-- `lower(host)`, e o CHECK abaixo recusa maiuscula na escrita, para que o dado
-- ja entre normalizado e a leitura do middleware possa ser um `eq` simples.
--
-- Porta tambem e recusada: `argos.exemplo.com.br:3000` nunca deve virar linha —
-- o middleware compara contra o host SEM porta.
--
-- =============================================================================
-- `is_primary`: PARCIAL, UM POR TENANT
-- =============================================================================
-- `CREATE UNIQUE INDEX ... WHERE is_primary` deixa N linhas com `false` e no
-- maximo UMA com `true` por tenant. E o host que o app usa quando precisa
-- montar um link ABSOLUTO sem contexto de request (e-mail de convite, nudge,
-- cron) — ver D11. Sem `is_primary`, o app cai no host canonico derivado do slug.
--
-- =============================================================================
-- RLS
-- =============================================================================
-- Leitura: `service_role` (o middleware resolve host ANTES de existir sessao) e
-- `is_super_admin()`. Escrita: so `is_super_admin()`.
-- Um admin de cliente NAO escreve aqui de proposito: apontar o host de outra
-- empresa para o proprio tenant seria sequestro de marca.
-- (`service_role` ja contorna RLS por ser BYPASSRLS; a policy explicita existe
-- para que a intencao esteja escrita, e para o caso de a chave ser usada por um
-- papel sem bypass.)
--
-- REVERSAO: `DROP TABLE IF EXISTS public.tenant_domains;` (nenhuma outra tabela
-- depende dela).

BEGIN;

CREATE TABLE IF NOT EXISTS public.tenant_domains (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  host        text NOT NULL,
  is_primary  boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_domains_host_normalizado CHECK (host = lower(host)),
  CONSTRAINT tenant_domains_host_sem_porta   CHECK (position(':' in host) = 0),
  CONSTRAINT tenant_domains_host_formato
    CHECK (host ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$')
);

COMMENT ON TABLE public.tenant_domains IS
  'Dominios PROPRIOS de tenant (ex.: argos.eximiaacademy.com.br). O host canonico {slug}.{base} NAO mora aqui — e derivado por string no app (faxina 2026-09, D1).';
COMMENT ON COLUMN public.tenant_domains.host IS
  'Host em minusculas, sem porta e sem esquema. Unico por lower(host) em toda a plataforma.';
COMMENT ON COLUMN public.tenant_domains.is_primary IS
  'Host usado para montar links absolutos sem contexto de request (convite, nudge, cron). No maximo um por tenant.';
COMMENT ON COLUMN public.tenant_domains.verified_at IS
  'Quando o apontamento de DNS foi conferido. NULL = cadastrado, ainda nao verificado. Nao e gate de resolucao hoje.';

CREATE UNIQUE INDEX IF NOT EXISTS tenant_domains_host_key
  ON public.tenant_domains (lower(host));

CREATE UNIQUE INDEX IF NOT EXISTS tenant_domains_one_primary
  ON public.tenant_domains (tenant_id) WHERE is_primary;

CREATE INDEX IF NOT EXISTS idx_tenant_domains_tenant
  ON public.tenant_domains (tenant_id);

ALTER TABLE public.tenant_domains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_domains_service_read ON public.tenant_domains;
CREATE POLICY tenant_domains_service_read ON public.tenant_domains
  FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS tenant_domains_super_admin_read ON public.tenant_domains;
CREATE POLICY tenant_domains_super_admin_read ON public.tenant_domains
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS tenant_domains_super_admin_write ON public.tenant_domains;
CREATE POLICY tenant_domains_super_admin_write ON public.tenant_domains
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ===========================================================================
-- BACKFILL — UMA linha, e so ela
-- ===========================================================================
-- NAO se inventa host aqui. O plano original mandava criar
-- `{slug}.academy.eximiaventures.com.br` para os 4 tenants; isso escreveria no
-- banco quatro enderecos que NINGUEM confirmou que existem no DNS, e o primeiro
-- deles a ser lido pelo middleware serviria a marca errada em silencio.
--
-- O unico host proprio COMPROVADO no repositorio e `argos.eximiaacademy.com.br`:
-- ele aparece como host de producao em 5 migrations (p.ex.
-- `20260731000000_slide_interaction_point.sql:6`) e na `PROD_HOST_DENYLIST` de
-- `supabase/seed-student-home-demo.ts:62`, justamente para o seed de demo se
-- RECUSAR a toca-lo.
--
-- A QUAL TENANT ELE PERTENCE (medido, nao suposto): o slug do tenant da Cory em
-- producao e `cory-alimentos` — NEM `cory-alimentos-rp` NEM `cory-alimentos-mg`.
-- Tres fontes independentes:
--   * `docs/auditoria/consolidacao-2026-08-28/APLICACAO-migration.md:171-177`
--     inventaria os 5 tenants por slug: cory-alimentos, eximia-academy,
--     gauntlet-descartavel, harven-finance, vertice-industria;
--   * `apps/web/scripts/gauntlet/trava-de-tenant.mjs:34-39` (`SLUGS_PROIBIDOS`)
--     lista os mesmos 4 slugs de cliente;
--   * `docs/stories/epic-student-home/SH-F.4.story.md:160` (precheck read-only
--     no Cloud v2): "so cory-alimentos, eximia-academy, harven-finance".
-- Ou seja: `20260311000000_cory_alimentos_tenant_update.sql` (que renomeia para
-- `-rp` e cria `-mg`) NAO foi aplicada neste projeto Supabase.
--
-- O INSERT abaixo e dirigido por SLUG, nunca por UUID literal: num banco onde
-- `cory-alimentos` nao existe (replay do zero) ele casa ZERO linhas e nao cria
-- nada. Em producao ele cria exatamente uma. Nao ha caminho em que ele aponte um
-- host para o tenant errado.
INSERT INTO public.tenant_domains (tenant_id, host, is_primary)
SELECT t.id, 'argos.eximiaacademy.com.br', true
  FROM public.tenants t
 WHERE t.slug = 'cory-alimentos'
ON CONFLICT DO NOTHING;

-- `tenants.deployment_url` (20260421000001) NAO e migrada para ca: a coluna
-- existe desde abril e NENHUM codigo a le (grep so bate nos tipos gerados).
-- Migrar valor orfao seria transformar placeholder em fato. A deprecacao dela e
-- o M6 do plano, num PR proprio.

COMMIT;
