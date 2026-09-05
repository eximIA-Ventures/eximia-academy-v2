-- Traz para o git os tenants de producao que nunca foram versionados, e grava a
-- identidade da Vertice antes que a branch `deploy/vertice` seja apagada.
--
-- Faxina 2026-09, M4 do `docs/faxina-2026-09/02-plano-app-novo.md`.
--
-- =============================================================================
-- O PROBLEMA
-- =============================================================================
-- Producao (`vaguswivhqnlbgqvnjch`) tem 5 tenants. Apenas UM tem criacao
-- versionada (`20260311000000_cory_alimentos_tenant_update.sql`). Os outros
-- foram inseridos direto no banco. Um ambiente novo — o mesmo que M0/`db reset`
-- existe para viabilizar — nasce sem eles, e qualquer script, teste de
-- integracao ou demo que assuma "o tenant X existe" quebra la.
--
-- INVENTARIO MEDIDO (nao suposto), de `docs/auditoria/consolidacao-2026-08-28/APLICACAO-migration.md:171-177`:
--   cory-alimentos        cursos=1 capacidades=5 usuarios=51  evidencias=764
--   eximia-academy        cursos=2 capacidades=5 usuarios=2   evidencias=6
--   gauntlet-descartavel  cursos=1 capacidades=0 usuarios=2   evidencias=0
--   harven-finance        cursos=1 capacidades=0 usuarios=1   evidencias=0
--   vertice-industria     cursos=2 capacidades=5 usuarios=129 evidencias=83
-- Confirmado por `apps/web/scripts/gauntlet/trava-de-tenant.mjs:34-39` e por
-- `docs/stories/epic-student-home/SH-F.4.story.md:160`.
--
-- CONSEQUENCIA QUE VALE REGISTRAR: os slugs de producao sao `cory-alimentos`,
-- e NAO `cory-alimentos-rp`/`cory-alimentos-mg`. Ou seja,
-- `20260311000000_cory_alimentos_tenant_update.sql` NUNCA foi aplicada neste
-- projeto Supabase. Ela continua no repositorio (nao se reescreve historico de
-- migration), e num banco reconstruido ela cria `cory-alimentos-mg` — uma
-- divergencia herdada que este arquivo NAO tenta corrigir, so declara.
--
-- =============================================================================
-- O QUE ESTE ARQUIVO FAZ E O QUE NAO FAZ
-- =============================================================================
-- FAZ: `INSERT ... ON CONFLICT (slug) DO NOTHING` de 3 empresas. Em producao,
--      onde as tres ja existem, e ZERO escrita. Num banco vazio, cria as tres.
-- NAO FAZ: nao altera nenhum tenant existente, exceto o UPDATE guardado da
--      identidade da Vertice descrito abaixo. Nao cria usuarios, cursos nem
--      dado de cliente — nada disso pertence a uma migration.
-- NAO INCLUI: `cory-alimentos` (a empresa pagante; criar a linha dela num
--      ambiente novo daria a ilusao de que o ambiente tem a Cory) nem
--      `gauntlet-descartavel` (tenant de teste, por definicao descartavel).
--
-- UUIDs: fixos onde ha fonte no repositorio, para que um ambiente novo nasca com
-- os MESMOS ids de producao (e assim scripts com id embutido continuem valendo):
--   exímIA Academy    8d45bcf4-ed2f-408d-a1af-0ee1fc6a3bea
--     -> docs/qa/demo-course-jornada-2026-07-28.md:4 e
--        docs/qa/demo-tenant-vertice-2026-07-29.md:90
--   Vértice Indústria ec814e94-0a84-48ec-ae2a-4f46c8ef21c4
--     -> docs/qa/demo-tenant-vertice-2026-07-29.md:77,111,124,141
--   Harven Finance    SEM ID FIXO — nenhum documento, script ou migration do
--     repositorio registra o UUID dele. Inventar um seria pior que nao ter: o
--     ambiente novo teria um id que NAO e o de producao, e um script que
--     assumisse igualdade passaria a apontar para o vazio. Nasce com
--     `gen_random_uuid()`. Se o Hugo trouxer o id real, ele entra numa migration
--     seguinte (nao editar esta).
--
-- =============================================================================
-- A IDENTIDADE DA VERTICE — POR QUE ELA ESTA AQUI
-- =============================================================================
-- Ela so existe hoje em `apps/web/tenant.config.ts` da branch `deploy/vertice`,
-- que a faxina vai apagar. Valores lidos com `git show deploy/vertice:apps/web/tenant.config.ts`:
--   name "Vértice Indústria" · slug "vertice-industria" · logo "/brand/logo.png"
--   favicon "/brand/favicon.ico" · primaryColor "#1E3A5F" · accentColor "#C4A882"
--   partnerName "exímIA Ventures" · partnerLogo "/logos/eximia-horizontal-academy.svg"
--   modules ["biblioteca","units"] · footerText · supportEmail
--
-- O UPDATE abaixo e GUARDADO: so escreve se a marca da Vertice ainda for a que
-- `20260906001000` DERIVOU dos jsonb antigos (reconhecivel por
-- `primaryColor = '#2a6ab0'`, o valor do NEUTRO) e os modulos ainda estiverem
-- vazios. Se alguem ja tiver editado a marca pela tela, este arquivo nao encosta.
--
-- REVERSAO: `DELETE FROM tenants WHERE slug IN (...)` — mas so num banco onde
-- essas empresas nao deveriam existir. Em producao, nunca (CASCADE levaria
-- usuarios, cursos e sessoes junto).

-- NOTA sobre `ON CONFLICT DO NOTHING` SEM ALVO: o plano dizia
-- `ON CONFLICT (slug) DO NOTHING`. A forma sem alvo e estritamente mais segura
-- aqui porque estes INSERTs carregam `id` FIXO alem do slug: se um dia o id
-- existir com outro slug (ou vice-versa), a forma com alvo unico levantaria
-- `23505` e abortaria a migration inteira, enquanto a forma sem alvo cobre
-- QUALQUER violacao de unicidade e segue. O efeito pretendido — "nao duplicar,
-- nao sobrescrever" — e o mesmo.

BEGIN;

INSERT INTO public.tenants (id, name, slug, plan, status, brand, modules)
VALUES (
  '8d45bcf4-ed2f-408d-a1af-0ee1fc6a3bea',
  'exímIA Academy',
  'eximia-academy',
  'premium',
  'active',
  jsonb_build_object(
    'name',         'exímIA Academy',
    'slug',         'eximia-academy',
    'logo',         '/brand/logo.png',
    'logoLight',    '/brand/logo-color.png',
    'favicon',      '/brand/favicon.ico',
    'primaryColor', '#2a6ab0',
    'accentColor',  '#C4A882'
  ),
  '{}'::text[]
)
ON CONFLICT DO NOTHING;

-- Sem `id` fixo: o UUID de producao da Harven nao esta em lugar nenhum do repo.
INSERT INTO public.tenants (name, slug, plan, status, brand, modules)
VALUES (
  'Harven Finance',
  'harven-finance',
  'standard',
  'active',
  jsonb_build_object(
    'name',         'Harven Finance',
    'slug',         'harven-finance',
    'logo',         '/brand/logo.png',
    'favicon',      '/brand/favicon.ico',
    'primaryColor', '#2a6ab0',
    'accentColor',  '#C4A882'
  ),
  '{}'::text[]
)
ON CONFLICT DO NOTHING;

INSERT INTO public.tenants (id, name, slug, plan, status, brand, modules, whitelabel_config)
VALUES (
  'ec814e94-0a84-48ec-ae2a-4f46c8ef21c4',
  'Vértice Indústria',
  'vertice-industria',
  'premium',
  'active',
  jsonb_build_object(
    'name',         'Vértice Indústria',
    'slug',         'vertice-industria',
    'logo',         '/brand/logo.png',
    'favicon',      '/brand/favicon.ico',
    'primaryColor', '#1E3A5F',
    'accentColor',  '#C4A882',
    'partnerName',  'exímIA Ventures',
    'partnerLogo',  '/logos/eximia-horizontal-academy.svg'
  ),
  ARRAY['biblioteca', 'units']::text[],
  jsonb_build_object(
    'footer_text',   '© 2026 Vértice Indústria · Powered by exímIA Academy',
    'support_email', 'suporte@eximiaventures.com.br'
  )
)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Retrofit GUARDADO da identidade Vertice, para o banco onde a linha JA existe
-- (producao). Ver o cabecalho: so age se a marca ainda for a derivada por
-- 20260906001000 e os modulos ainda estiverem vazios.
-- ---------------------------------------------------------------------------
UPDATE public.tenants t
   SET brand = t.brand || jsonb_build_object(
                 'primaryColor', '#1E3A5F',
                 'accentColor',  '#C4A882',
                 'partnerName',  'exímIA Ventures',
                 'partnerLogo',  '/logos/eximia-horizontal-academy.svg'
               ),
       modules = ARRAY['biblioteca', 'units']::text[],
       whitelabel_config = COALESCE(t.whitelabel_config, '{}'::jsonb)
                           || jsonb_build_object(
                                'footer_text',   '© 2026 Vértice Indústria · Powered by exímIA Academy',
                                'support_email', 'suporte@eximiaventures.com.br'
                              ),
       updated_at = now()
 WHERE t.slug = 'vertice-industria'
   AND t.brand ->> 'primaryColor' = '#2a6ab0'
   AND COALESCE(array_length(t.modules, 1), 0) = 0;

COMMIT;
