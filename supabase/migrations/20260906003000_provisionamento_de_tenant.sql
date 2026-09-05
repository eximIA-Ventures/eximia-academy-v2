-- `seed_tenant_defaults(uuid)` + gatilho em `tenants` + RPC `provisionar_tenant(...)`.
--
-- Faxina 2026-09, M5 do `docs/faxina-2026-09/02-plano-app-novo.md`, sob a
-- decisao D10 de `00-decisoes.md`.
--
-- =============================================================================
-- O DEFEITO: "MEIA EMPRESA CRIADA"
-- =============================================================================
-- Hoje `POST /api/admin/tenants` (`route.ts:30-35`) faz UM `insert` de
-- `{name, slug}` e mais nada. Tudo o que uma empresa precisa para funcionar
-- entrou no banco historicamente como BACKFILL UNICO — um `INSERT ... FROM
-- tenants` dentro de uma migration, que semeia os tenants que existiam NAQUELE
-- DIA e nunca mais roda. Levantamento (`grep -ln "FROM tenants" supabase/migrations/*.sql`,
-- os 5 arquivos lidos um a um):
--
--   | arquivo                                   | o que semeia por tenant        |
--   |-------------------------------------------|--------------------------------|
--   | 20260210000000_areas_role_unification:200 | area "Geral"                   |
--   | 20260604120000_engagement_engine:396      | 5 notification_templates       |
--   | 20260708120000_engagement_center_v2:165   | + 1 notification_template      |
--   | 20260315100001_seed_verso_regra_de_3:364  | NAO e por tenant (id fixo)     |
--   | 20260803000000_onboarding_novidades:660   | NAO e insert (e comentario)    |
--
-- Consequencia medida: uma empresa criada pela tela HOJE nasce sem area padrao e
-- com a Central de Engajamento VAZIA. E exatamente a "meia empresa" que o
-- processo manual em 3 passos produzia, agora automatizada.
--
-- =============================================================================
-- POR QUE FUNCAO + GATILHO, E NAO SO A RPC
-- =============================================================================
-- A RPC cobre o cadastro pela plataforma. O GATILHO cobre o resto do mundo real:
-- `INSERT INTO tenants` a mao no SQL Editor, script de seed, `supabase/seed.sql`,
-- uma migration futura. Duas portas para a mesma casa, uma so fechadura.
-- Ambos chamam a MESMA funcao, que e idempotente (`ON CONFLICT DO NOTHING`), de
-- modo que chamar duas vezes (gatilho + chamada explicita da RPC) e no-op.
--
-- =============================================================================
-- OS TEXTOS DOS TEMPLATES SAO O ESTADO **FINAL**, NAO O ORIGINAL DE JUNHO
-- =============================================================================
-- `20260712000000_engagement_template_dedup_greeting.sql` REMOVEU o
-- "Ola, {{primeiro_nome}}! " do inicio de `body_inapp` dos 5 templates originais,
-- porque `renderWithOrigin` ja prefixa a saudacao e as duas empilhavam. Os corpos
-- abaixo ja estao SEM a saudacao — semear o texto de junho faria toda empresa
-- nova nascer com o bug que aquela migration corrigiu.
-- `behind_teaching_plan` MANTEM a saudacao no corpo porque `20260712000000` nao
-- o incluiu na lista (`WHERE key IN (...)`, 5 chaves). Esta funcao reproduz a
-- producao como ela e, inclusive nessa assimetria — nao "como deveria ser".
-- Idem `intent`/`tone`: ja vem preenchidos, como o backfill de
-- `20260708120000:139-156` deixou.
--
-- REVERSAO:
--   DROP TRIGGER IF EXISTS trg_tenants_seed_defaults ON public.tenants;
--   DROP FUNCTION IF EXISTS public.trg_seed_tenant_defaults();
--   DROP FUNCTION IF EXISTS public.provisionar_tenant(text,text,text,jsonb,text[],text,uuid,uuid);
--   DROP FUNCTION IF EXISTS public.seed_tenant_defaults(uuid);
-- Nenhuma delas apaga dado ja semeado.

BEGIN;

-- ===========================================================================
-- 1. seed_tenant_defaults(p_tenant_id uuid)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.seed_tenant_defaults(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF p_tenant_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant_id) THEN
    RAISE EXCEPTION 'seed_tenant_defaults: tenant % nao existe', p_tenant_id
      USING ERRCODE = '23503';
  END IF;

  -- -------------------------------------------------------------------------
  -- 1.1 Area padrao "Geral" — reproduz 20260210000000:200-208
  -- -------------------------------------------------------------------------
  INSERT INTO areas (tenant_id, name, slug, description)
  VALUES (p_tenant_id, 'Geral', 'geral', 'Area padrao criada durante migracao')
  ON CONFLICT (tenant_id, slug) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- 1.2 Catalogo de templates de notificacao — reproduz 20260604120000:396-455
  --     (corpos ja sem saudacao, por 20260712000000) + 20260708120000:165-188
  -- -------------------------------------------------------------------------
  INSERT INTO notification_templates
    (tenant_id, key, name, category, channel_inapp, channel_email,
     title, body_inapp, email_subject, email_html, variables, intent, tone,
     is_active, created_by)
  SELECT
    p_tenant_id, s.key, s.name, s.category, s.channel_inapp, s.channel_email,
    s.title, s.body_inapp, s.email_subject, s.email_html, s.variables,
    s.intent, s.tone, true, NULL
  FROM (
    VALUES
      (
        'never_accessed',
        'Nunca acessou a plataforma',
        'nudge', true, true,
        'Seu acesso já está disponível 🎓',
        'Notamos que você ainda não acessou a plataforma. Seu acesso está pronto e esperando por você. Entre agora e comece sua jornada.',
        'Seu acesso à plataforma está disponível!',
        '<p>Olá, {{primeiro_nome}}!</p><p>Notamos que você ainda não acessou a plataforma de aprendizagem. Seu acesso está pronto e esperando por você. Entre agora e comece sua jornada de desenvolvimento!</p>',
        '["primeiro_nome"]'::jsonb,
        'primeiro_acesso',
        'Leve e institucional'
      ),
      (
        'inactive_14d',
        'Inativo há mais de 14 dias',
        'nudge', true, true,
        'Sentimos sua falta 👋',
        'Faz mais de 14 dias desde seu último acesso. Tem novos conteúdos esperando por você. Que tal retomar de onde parou?',
        'Sentimos sua falta na plataforma!',
        '<p>Olá, {{primeiro_nome}}!</p><p>Faz mais de 14 dias desde seu último acesso à plataforma. Tem novos conteúdos esperando por você. Que tal retomar de onde parou?</p>',
        '["primeiro_nome"]'::jsonb,
        'retomada',
        'Acolhedor, sem cobrança pesada'
      ),
      (
        'session_no_reflection',
        'Sessões sem reflexão',
        'nudge', true, true,
        'Suas reflexões estão pendentes ✍️',
        'Você completou suas sessões, mas ainda não registrou suas reflexões. As reflexões são parte essencial do aprendizado — reserve alguns minutos para consolidar o que aprendeu em {{curso}}.',
        'Suas reflexões estão pendentes',
        '<p>Olá, {{primeiro_nome}}!</p><p>Você completou suas sessões de aprendizagem, mas ainda não registrou suas reflexões. As reflexões são parte essencial do processo — reserve alguns minutos para consolidar o que aprendeu em {{curso}}.</p>',
        '["primeiro_nome","curso"]'::jsonb,
        'reflexao_pendente',
        'Encorajador'
      ),
      (
        'top_performer_recognition',
        'Reconhecimento de destaque',
        'nudge', true, true,
        'Parabéns pelo seu desempenho! 🏆',
        'Queremos reconhecer seu excelente engajamento. Seu esforço e dedicação nas sessões e reflexões estão fazendo a diferença. Continue assim!',
        'Parabéns pelo seu desempenho!',
        '<p>Olá, {{primeiro_nome}}!</p><p>Queremos reconhecer seu excelente engajamento na plataforma. Seu esforço e dedicação nas sessões e reflexões estão fazendo a diferença. Continue assim!</p>',
        '["primeiro_nome"]'::jsonb,
        'reconhecimento',
        'Celebratório'
      ),
      (
        'announcement_generic',
        'Comunicado geral',
        'announcement', true, true,
        'Comunicado da equipe 📣',
        'Temos um comunicado importante para você.',
        'Comunicado da equipe',
        '<p>Olá, {{primeiro_nome}}!</p><p>Temos um comunicado importante para você.</p>',
        '["primeiro_nome"]'::jsonb,
        'manual',
        'Neutro institucional'
      ),
      (
        'behind_teaching_plan',
        'Atrás do Plano de Ensino',
        'nudge', true, true,
        'Você está atrás do seu Plano de Ensino',
        'Olá, {{primeiro_nome}}! Seu progresso em {{curso}} está abaixo do esperado para o prazo do Plano de Ensino. Retome quando puder para não acumular atraso.',
        'Seu Plano de Ensino precisa de atenção',
        '<p>Olá, {{primeiro_nome}}!</p><p>Seu progresso em {{curso}} está abaixo do esperado para o prazo do Plano de Ensino. Retome quando puder para não acumular atraso.</p>',
        '["primeiro_nome","curso"]'::jsonb,
        'atraso_plano',
        'Direto, com senso de urgência'
      )
  ) AS s(key, name, category, channel_inapp, channel_email,
         title, body_inapp, email_subject, email_html, variables, intent, tone)
  ON CONFLICT (tenant_id, key) DO NOTHING;
END;
$function$;

COMMENT ON FUNCTION public.seed_tenant_defaults(uuid) IS
  'Semeia o que uma empresa precisa para funcionar: area "Geral" + os 6 notification_templates. Idempotente (ON CONFLICT DO NOTHING). Chamada pelo gatilho AFTER INSERT ON tenants e pela RPC provisionar_tenant.';

REVOKE EXECUTE ON FUNCTION public.seed_tenant_defaults(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.seed_tenant_defaults(uuid) TO service_role;

-- ===========================================================================
-- 2. Gatilho AFTER INSERT ON tenants
-- ===========================================================================
-- AFTER, e nao BEFORE: `areas.tenant_id` e `notification_templates.tenant_id`
-- tem FK para `tenants(id)`; num BEFORE a linha ainda nao existe e as duas
-- insercoes falhariam com 23503.
CREATE OR REPLACE FUNCTION public.trg_seed_tenant_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  PERFORM seed_tenant_defaults(NEW.id);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_tenants_seed_defaults ON public.tenants;
CREATE TRIGGER trg_tenants_seed_defaults
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.trg_seed_tenant_defaults();

-- Empresas que JA existem nao passam pelo gatilho. Reaplica a semeadura em
-- todas, para que o estado nao dependa de quando cada uma nasceu. Idempotente.
DO $$
DECLARE _t uuid;
BEGIN
  FOR _t IN SELECT id FROM public.tenants LOOP
    PERFORM public.seed_tenant_defaults(_t);
  END LOOP;
END $$;

-- ===========================================================================
-- 3. RPC provisionar_tenant(...)
-- ===========================================================================
-- TRANSACIONAL POR CONSTRUCAO: uma funcao roda dentro de uma transacao; se
-- qualquer passo levantar, NADA e gravado. E a resposta direta ao historico de
-- `scripts/demo-tenant-vertice-phase5.mjs`, que existe porque o processo
-- equivalente travou no meio e precisou de retomada manual.
--
-- O QUE ESTA **FORA** DESTA RPC, DE PROPOSITO
-- O convite do primeiro admin (`inviteUserByEmail`) e I/O EXTERNO (GoTrue). Um
-- HTTP dentro da transacao seguraria lock de banco esperando rede, e um timeout
-- la abortaria a criacao da empresa inteira. O codigo TypeScript convida DEPOIS
-- do commit; se o convite falhar, a empresa existe e a UI oferece "reenviar
-- convite" — nunca recria o tenant. Ver `02-plano-app-novo.md` §3.
--
-- ASSINATURA (contrato para o codigo TypeScript):
--   provisionar_tenant(
--     p_name        text,
--     p_slug        text,
--     p_plan        text,               -- essencial | standard | premium
--     p_brand       jsonb,              -- TenantConfig.brand, sem customCSS
--     p_modules     text[],
--     p_custom_host text DEFAULT NULL,  -- dominio PROPRIO; o canonico e derivado
--     p_id          uuid DEFAULT NULL,  -- para o upload de logo antes do INSERT
--     p_actor_id    uuid DEFAULT NULL   -- super_admin que pediu (auditoria)
--   ) RETURNS jsonb
--
-- Por que `p_actor_id` existe, se o plano nao pedia: `platform_audit_log.actor_id`
-- e NOT NULL com FK para `auth.users(id)`, e esta RPC so pode ser executada por
-- `service_role` — cujo JWT nao tem `sub`, logo `auth.uid()` e SEMPRE NULL aqui.
-- Sem o parametro, ou a auditoria mentiria (actor inventado) ou a RPC quebraria.
-- E o ultimo parametro e tem default, entao toda chamada escrita contra a
-- assinatura do plano continua valida.
--
-- Por que `p_id` existe: o upload do logo precisa do `tenant_id` no caminho
-- (`{tenant_id}/logo.png`) ANTES do INSERT. O cliente gera o UUID, sobe o
-- arquivo e passa o mesmo UUID aqui. Alternativa descartada: criar o tenant como
-- rascunho e ativar no fim (deixa empresa meio-criada visivel na lista).
CREATE OR REPLACE FUNCTION public.provisionar_tenant(
  p_name        text,
  p_slug        text,
  p_plan        text,
  p_brand       jsonb,
  p_modules     text[],
  p_custom_host text DEFAULT NULL,
  p_id          uuid DEFAULT NULL,
  p_actor_id    uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  -- D5: `demo` esta na lista porque `supabase/seed.sql:8` cria um tenant REAL
  -- com esse slug e `NEUTRO.slug` era `demo` — resolver "host desconhecido" por
  -- slug cairia num tenant EXISTENTE em vez de "nenhum". `__neutro__` e o novo
  -- valor do NEUTRO e nao pode ser cadastravel.
  _reservados constant text[] := ARRAY[
    'www', 'app', 'api', 'admin', 'central', 'academy', 'demo', 'neutro', '__neutro__'
  ];
  _slug   text;
  _name   text;
  _plan   text;
  _host   text;
  _brand  jsonb;
  _mods   text[];
  _id     uuid;
  _actor  uuid;
  _audit  boolean := false;
BEGIN
  -- ---------------------------------------------------------------- nome ---
  _name := NULLIF(TRIM(COALESCE(p_name, '')), '');
  IF _name IS NULL THEN
    RAISE EXCEPTION 'provisionar_tenant: nome obrigatorio' USING ERRCODE = '22023';
  END IF;
  IF length(_name) > 200 THEN
    RAISE EXCEPTION 'provisionar_tenant: nome excede 200 caracteres' USING ERRCODE = '22023';
  END IF;

  -- ---------------------------------------------------------------- slug ---
  _slug := lower(TRIM(COALESCE(p_slug, '')));
  IF _slug !~ '^[a-z0-9-]{1,50}$' THEN
    RAISE EXCEPTION 'provisionar_tenant: slug invalido (%). Use a-z, 0-9 e hifen, 1 a 50 caracteres', p_slug
      USING ERRCODE = '22023';
  END IF;
  IF _slug = ANY (_reservados) THEN
    RAISE EXCEPTION 'provisionar_tenant: slug reservado (%)', _slug USING ERRCODE = '22023';
  END IF;

  -- ---------------------------------------------------------------- plano ---
  _plan := COALESCE(NULLIF(TRIM(COALESCE(p_plan, '')), ''), 'standard');
  IF _plan NOT IN ('essencial', 'standard', 'premium') THEN
    RAISE EXCEPTION 'provisionar_tenant: plano invalido (%)', _plan USING ERRCODE = '22023';
  END IF;

  -- ---------------------------------------------------------------- marca ---
  _brand := COALESCE(p_brand, '{}'::jsonb);
  IF jsonb_typeof(_brand) <> 'object' THEN
    RAISE EXCEPTION 'provisionar_tenant: p_brand precisa ser um objeto jsonb' USING ERRCODE = '22023';
  END IF;
  -- `customCSS` nunca entra na coluna de marca (D4). Removido aqui, e nao apenas
  -- "nao documentado", para que um cliente que o envie por engano nao o grave.
  _brand := _brand - 'customCSS' - 'custom_css';
  -- `slug` e `name` da marca sao DERIVADOS, nao aceitos: duas verdades para o
  -- mesmo campo e o defeito que a coluna `brand` existe para eliminar.
  _brand := _brand || jsonb_build_object('slug', _slug)
                   || jsonb_build_object('name', COALESCE(NULLIF(TRIM(_brand ->> 'name'), ''), _name));

  _mods := COALESCE(p_modules, '{}'::text[]);

  -- ---------------------------------------------------------------- host ---
  _host := NULLIF(lower(TRIM(COALESCE(p_custom_host, ''))), '');
  IF _host IS NOT NULL AND position(':' in _host) > 0 THEN
    RAISE EXCEPTION 'provisionar_tenant: host nao pode conter porta (%)', _host USING ERRCODE = '22023';
  END IF;

  -- --------------------------------------------------------------- tenant ---
  -- Slug duplicado levanta 23505 pela UNIQUE de `tenants.slug`, e a API mapeia
  -- para 409. Nao ha `ON CONFLICT DO NOTHING` aqui de proposito: devolver
  -- silenciosamente o tenant que ja existia faria a tela dizer "criei" para
  -- uma empresa que nao e a que o operador descreveu.
  INSERT INTO tenants (id, name, slug, plan, brand, modules, status)
  VALUES (COALESCE(p_id, gen_random_uuid()), _name, _slug, _plan, _brand, _mods, 'active')
  RETURNING id INTO _id;

  -- -------------------------------------------------------- dominio proprio ---
  IF _host IS NOT NULL THEN
    INSERT INTO tenant_domains (tenant_id, host, is_primary)
    VALUES (_id, _host, true);
  END IF;

  -- ------------------------------------------------------------- semeadura ---
  -- Redundante com o gatilho AFTER INSERT acima, e chamada assim mesmo: se o
  -- gatilho for removido um dia, a RPC continua entregando empresa inteira.
  -- Idempotente, entao a segunda passagem nao grava nada.
  PERFORM seed_tenant_defaults(_id);

  -- ------------------------------------------------------------- auditoria ---
  _actor := COALESCE(p_actor_id, auth.uid());
  IF _actor IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = _actor) THEN
    _actor := NULL;   -- FK invalida abortaria a criacao inteira por causa do log
  END IF;

  IF _actor IS NOT NULL THEN
    INSERT INTO platform_audit_log (actor_id, action, target_type, target_id, details)
    VALUES (
      _actor,
      'tenant.provisioned',
      'tenant',
      _id,
      jsonb_build_object(
        'tenant_id', _id,
        'slug', _slug,
        'plan', _plan,
        'modules', to_jsonb(_mods),
        'custom_host', _host
      )
    );
    _audit := true;
  ELSE
    -- Nao aborta: a empresa vale mais que a linha de log. Mas tambem nao mente —
    -- o retorno diz que nao houve auditoria, e a API deve registrar por fora.
    RAISE WARNING 'provisionar_tenant: sem actor resolvivel; platform_audit_log NAO foi escrito para o tenant %', _id;
  END IF;

  RETURN jsonb_build_object(
    'tenant_id', _id,
    'slug',      _slug,
    'auditado',  _audit
  );
END;
$function$;

COMMENT ON FUNCTION public.provisionar_tenant(text,text,text,jsonb,text[],text,uuid,uuid) IS
  'Cadastro transacional de empresa: valida slug (regex + reservados D5), insere tenants, tenant_domains (se houver dominio proprio), semeia defaults e audita. O convite do primeiro admin fica FORA (I/O externo). So service_role executa.';

REVOKE EXECUTE ON FUNCTION public.provisionar_tenant(text,text,text,jsonb,text[],text,uuid,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provisionar_tenant(text,text,text,jsonb,text[],text,uuid,uuid)
  TO service_role;

COMMIT;
