-- Bucket de Storage `tenant-assets` + policies.
--
-- Faxina 2026-09, M3 do `docs/faxina-2026-09/02-plano-app-novo.md`, sob a
-- decisao D12 de `00-decisoes.md`.
--
-- =============================================================================
-- O DEFEITO QUE ISTO CORRIGE
-- =============================================================================
-- Dois componentes de producao escrevem num bucket que NUNCA FOI CRIADO. A
-- unica `INSERT INTO storage.buckets` de todo o repositorio e a de
-- `20260210000003_epic12_multimodal_content.sql:13`, e ela cria
-- `chapter-assets`, nao este. Medido e documentado em
-- `apps/web/src/components/admin/__tests__/upload-que-falha-nao-pode-calar.test.tsx:9-13`:
--   GET  /storage/v1/bucket/tenant-assets      -> {"code":"NoSuchBucket"}
--   POST /storage/v1/object/tenant-assets/...  -> {"message":"Bucket not found"}
-- Ou seja: hoje TODO upload de logo de empresa e TODA foto de onboarding falha.
--
-- =============================================================================
-- OS CAMINHOS SAO OS QUE O CODIGO JA ESCREVE — NAO OS QUE SERIAM BONITOS
-- =============================================================================
--   `{tenant_id}/logo.png`                  <- components/admin/logo-upload.tsx:46
--                                              (upsert: true => INSERT e UPDATE)
--   `{tenant_id}/avatars/{auth.uid()}.png`  <- components/onboarding/step-welcome.tsx:50
--   `{tenant_id}/avatars/{auth.uid()}.jpg`     (upsert: true => INSERT e UPDATE)
--   `{tenant_id}/favicon.*`                 <- ainda sem componente; o favicon
--                                              hoje entra como URL digitada
--                                              (whitelabel_config.favicon_url).
--                                              Liberado para quando a tela existir.
-- As policies foram escritas CONTRA ESSES CAMINHOS. Qualquer mudanca neles em
-- `apps/web` sem mudar este arquivo volta a quebrar o upload.
--
-- =============================================================================
-- POR QUE NAO COPIAR AS POLICIES DE `chapter-assets`
-- =============================================================================
-- O plano dizia "mesmo padrao de 20260210000003". Aquele padrao (`:22-29`) so
-- permite INSERT a quem tem `role IN ('admin','manager')`. Copiado para ca, ele
-- consertaria `logo-upload.tsx` e QUEBRARIA `step-welcome.tsx`, que e o
-- onboarding do ALUNO gravando a propria foto — trocaria um dos dois defeitos
-- pelo outro. Sao dois prefixos com dois donos diferentes, e por isso sao
-- policies diferentes.
--
-- =============================================================================
-- DECISAO DE PRIVACIDADE, DECLARADA E NAO ESCONDIDA
-- =============================================================================
-- O bucket e criado com `public = true`. Consequencia REAL, que nenhuma policy
-- desta migration altera: num bucket publico do Supabase, a URL
-- `/storage/v1/object/public/tenant-assets/<caminho>` serve o arquivo SEM passar
-- pelas policies de `storage.objects`. Logo, uma foto de aluno em
-- `{tenant_id}/avatars/{uid}.png` e legivel por quem souber (ou adivinhar) o par
-- tenant_id + user_id. As policies de SELECT abaixo governam a API autenticada
-- (list/download), nao o caminho publico.
--
-- Por que assim mesmo assim: `logo-upload.tsx:60` e `step-welcome.tsx:59` usam
-- `getPublicUrl()`, que so funciona em bucket publico. Um bucket privado exige
-- `createSignedUrl` nos dois componentes — mudanca em `apps/web`, fora do escopo
-- desta migration.
-- CAMINHO CORRETO, para decisao do Hugo: mover avatar para um bucket PROPRIO e
-- PRIVADO (`tenant-avatars`, `public = false`) com URL assinada, deixando
-- `tenant-assets` publico so para logo/favicon — que sao, por natureza, publicos.
-- Registrado em `docs/faxina-2026-09/06-contrato-de-dados.md`.
--
-- REVERSAO:
--   DROP POLICY IF EXISTS <cada uma> ON storage.objects;
--   DELETE FROM storage.buckets WHERE id = 'tenant-assets';   -- so se vazio

BEGIN;

INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-assets', 'tenant-assets', true)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- LEITURA
-- ---------------------------------------------------------------------------
-- Marca (logo/favicon): aberta, inclusive a `anon` — a tela de login precisa do
-- logo ANTES de existir sessao. `^[^/]+/logo` e `^[^/]+/favicon` casam o
-- primeiro nivel de pasta (o tenant_id) e o prefixo do arquivo, e NAO casam
-- `{tenant}/avatars/...`.
DROP POLICY IF EXISTS tenant_assets_marca_read ON storage.objects;
CREATE POLICY tenant_assets_marca_read ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'tenant-assets'
    AND (name ~ '^[^/]+/logo' OR name ~ '^[^/]+/favicon')
  );

-- Avatar: o proprio dono le o proprio arquivo pela API autenticada.
DROP POLICY IF EXISTS tenant_assets_avatar_read ON storage.objects;
CREATE POLICY tenant_assets_avatar_read ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'tenant-assets'
    AND (storage.foldername(name))[2] = 'avatars'
    AND name LIKE (storage.foldername(name))[1] || '/avatars/' || auth.uid()::text || '.%'
  );

-- Staff do proprio tenant le qualquer objeto do proprio tenant pela API
-- autenticada (a tela de admin lista os assets da empresa).
DROP POLICY IF EXISTS tenant_assets_staff_read ON storage.objects;
CREATE POLICY tenant_assets_staff_read ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'tenant-assets'
    AND (storage.foldername(name))[1] = public.auth_tenant_id()::text
    AND (
      public.auth_user_role() IN ('admin', 'manager')
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
         WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'manager')
      )
    )
  );

DROP POLICY IF EXISTS tenant_assets_super_admin_read ON storage.objects;
CREATE POLICY tenant_assets_super_admin_read ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'tenant-assets' AND public.is_super_admin());

-- ---------------------------------------------------------------------------
-- ESCRITA DE MARCA — admin do PROPRIO tenant, so no prefixo de marca
-- ---------------------------------------------------------------------------
-- `auth_tenant_id()` (SECURITY DEFINER, 20260518100000:13) e a mesma funcao que
-- decide tenant em ~324 policies. Comparar a PASTA com ela e o que impede um
-- admin da empresa A de sobrescrever o logo da empresa B.
-- `manager` NAO escreve marca: trocar o logo da empresa e ato de admin.
DROP POLICY IF EXISTS tenant_assets_marca_insert ON storage.objects;
CREATE POLICY tenant_assets_marca_insert ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'tenant-assets'
    AND (name ~ '^[^/]+/logo' OR name ~ '^[^/]+/favicon')
    AND (storage.foldername(name))[1] = public.auth_tenant_id()::text
    AND (
      public.auth_user_role() = 'admin'
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
         WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
      )
    )
  );

DROP POLICY IF EXISTS tenant_assets_marca_update ON storage.objects;
CREATE POLICY tenant_assets_marca_update ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'tenant-assets'
    AND (name ~ '^[^/]+/logo' OR name ~ '^[^/]+/favicon')
    AND (storage.foldername(name))[1] = public.auth_tenant_id()::text
    AND (
      public.auth_user_role() = 'admin'
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
         WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
      )
    )
  )
  WITH CHECK (
    bucket_id = 'tenant-assets'
    AND (name ~ '^[^/]+/logo' OR name ~ '^[^/]+/favicon')
    AND (storage.foldername(name))[1] = public.auth_tenant_id()::text
  );

DROP POLICY IF EXISTS tenant_assets_marca_delete ON storage.objects;
CREATE POLICY tenant_assets_marca_delete ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'tenant-assets'
    AND (name ~ '^[^/]+/logo' OR name ~ '^[^/]+/favicon')
    AND (storage.foldername(name))[1] = public.auth_tenant_id()::text
    AND (
      public.auth_user_role() = 'admin'
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
         WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
      )
    )
  );

-- ---------------------------------------------------------------------------
-- ESCRITA DE AVATAR — o proprio usuario, no proprio arquivo
-- ---------------------------------------------------------------------------
-- `{tenant}/avatars/{auth.uid()}.{ext}`. O `LIKE ... || auth.uid() || '.%'`
-- amarra o NOME do arquivo ao chamador: um aluno nao sobrescreve a foto de
-- outro. A pasta tem que ser a do proprio tenant.
DROP POLICY IF EXISTS tenant_assets_avatar_insert ON storage.objects;
CREATE POLICY tenant_assets_avatar_insert ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'tenant-assets'
    AND (storage.foldername(name))[1] = public.auth_tenant_id()::text
    AND name LIKE (storage.foldername(name))[1] || '/avatars/' || auth.uid()::text || '.%'
  );

DROP POLICY IF EXISTS tenant_assets_avatar_update ON storage.objects;
CREATE POLICY tenant_assets_avatar_update ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'tenant-assets'
    AND (storage.foldername(name))[1] = public.auth_tenant_id()::text
    AND name LIKE (storage.foldername(name))[1] || '/avatars/' || auth.uid()::text || '.%'
  )
  WITH CHECK (
    bucket_id = 'tenant-assets'
    AND (storage.foldername(name))[1] = public.auth_tenant_id()::text
    AND name LIKE (storage.foldername(name))[1] || '/avatars/' || auth.uid()::text || '.%'
  );

DROP POLICY IF EXISTS tenant_assets_avatar_delete ON storage.objects;
CREATE POLICY tenant_assets_avatar_delete ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'tenant-assets'
    AND (storage.foldername(name))[1] = public.auth_tenant_id()::text
    AND name LIKE (storage.foldername(name))[1] || '/avatars/' || auth.uid()::text || '.%'
  );

-- ---------------------------------------------------------------------------
-- SUPER ADMIN — escreve em qualquer tenant (e quem provisiona empresa nova)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS tenant_assets_super_admin_write ON storage.objects;
CREATE POLICY tenant_assets_super_admin_write ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'tenant-assets' AND public.is_super_admin())
  WITH CHECK (bucket_id = 'tenant-assets' AND public.is_super_admin());

COMMIT;
