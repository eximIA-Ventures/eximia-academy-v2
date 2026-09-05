-- Fecha o recorte que `20260831125000_funcoes_do_servidor_recuperadas.sql`
-- declarou aberto no proprio cabecalho: aquele arquivo versionou as 4 FUNCOES
-- que as migrations de 31/08 nomeiam, e nao os GATILHOS que as usam, nem as
-- COLUNAS de que os corpos dependem em tempo de execucao, nem as TABELAS que a
-- frente "Aprendizagem do Time" le e nenhuma migration cria.
--
-- =============================================================================
-- O QUE ISTO E, E O QUE ISTO NAO E
-- =============================================================================
-- E: o delta de INVENTARIO entre o schema de producao (`vaguswivhqnlbgqvnjch`,
--    lido em 2026-09-05 via `pg_trigger`, `information_schema.columns`,
--    `pg_indexes`, `pg_constraint`, `pg_policies`) e o estado final que as 110
--    migrations do repositorio produzem num banco vazio.
--
-- NAO E: prova de equivalencia FUNCIONAL. Nao foi possivel reconstruir um banco
--    vazio nesta maquina (sem Docker, sem psql, sem `supabase db reset`). O que
--    se mediu foi presenca de objeto contra presenca de objeto. Comportamento
--    identico sob carga real permanece por provar.
--
-- =============================================================================
-- BLOQUEIO A MONTANTE, QUE ESTE ARQUIVO **NAO** RESOLVE
-- =============================================================================
-- `20260702222743_auth_direct_student_ids.sql`, linhas 96 a 98, executa
--
--     REVOKE EXECUTE ON FUNCTION public.subtree_student_ids(uuid) FROM PUBLIC, anon;
--     REVOKE EXECUTE ON FUNCTION public.auth_subtree_user_ids()   FROM PUBLIC, anon;
--     REVOKE EXECUTE ON FUNCTION public.auth_reachable_student_ids() FROM PUBLIC, anon;
--
-- sobre tres funcoes que NENHUMA migration do repositorio define (elas existem
-- so no servidor, achado 9 do inventario). Em terreno virgem isso aborta com
-- `42883 function does not exist`, exatamente a forma de defeito que
-- `20260831125000` foi escrito para corrigir, so que numa migration de julho e
-- por isso nao alcancada por aquela correcao.
--
-- Consequencia direta: um replay a partir do zero **para em julho** e nunca
-- chega ate aqui. Este arquivo fecha o delta de inventario; ele nao torna a
-- sequencia aplicavel, porque o obstaculo esta a montante dele. Fecha-lo exige
-- versionar as tres funcoes numa migration com versao ANTERIOR a `20260702222743`
-- (o mesmo movimento que `20260831125000` fez ao se colocar em `125000`, antes
-- do `130000` que revoga). Fica declarado, nao escondido.
--
-- =============================================================================
-- POR QUE SEM `IF NOT EXISTS` / `IF EXISTS`
-- =============================================================================
-- Mesma razao do cabecalho de `20260831125000`: um condicional que CALA quando
-- nao encontra passa verde sem ter feito nada, e o verde mente. Aqui o risco
-- concreto seria uma reconstrucao parcial, em que `users.reports_to` ja existisse
-- com outro tipo, e `ADD COLUMN IF NOT EXISTS` aceitaria o tipo errado em
-- silencio. O DDL abaixo e cru: em terreno virgem aplica, e em qualquer terreno
-- ja ocupado aborta alto (`42701`, `42P07`, `42710`), que e a resposta correta.
--
-- =============================================================================
-- ESTE ARQUIVO NAO DEVE SER APLICADO EM PRODUCAO
-- =============================================================================
-- Os 20 objetos abaixo JA EXISTEM em `vaguswivhqnlbgqvnjch`. Rodar isto la aborta
-- no primeiro `ADD COLUMN` com `42701 column "reports_to" of relation "users"
-- already exists`, sem gravar nada (a transacao e unica). Reconciliar producao,
-- se um dia se quiser, e registrar a versao em `supabase_migrations.schema_migrations`
-- SEM executar o corpo, nunca executando-o.
--
-- Nota sobre GRANTs: as tabelas criadas aqui nao levam `GRANT` explicito. Foi
-- verificado em producao que `capabilities`, `capability_evidence`,
-- `capability_modules` e `semantic_analyses` carregam ACL identica
-- (`anon`, `authenticated`, `service_role` com `arwdDxtm`), que e o efeito do
-- `ALTER DEFAULT PRIVILEGES` do proprio Supabase sobre o schema `public`. Um
-- `GRANT` aqui seria redundante e daria a impressao falsa de ser ele a origem
-- da permissao. Quem contem o acesso e a RLS declarada mais abaixo.
--
-- =============================================================================
-- O QUE FICA DE FORA, POR DECISAO, E NAO POR ESQUECIMENTO
-- =============================================================================
-- 1. `idx_user_roles_user_role` e `user_roles_user_role_uniq`, ambos UNIQUE sobre
--    `(user_id, role)`. Producao carrega os dois (duplicata entre si). O git ja
--    cria a mesma unicidade em `20260701030000_epic30_user_roles.sql` sob o nome
--    `user_roles_unique`. Reproduzi-los daria TRES indices unicos identicos num
--    banco reconstruido. Divergencia que resta: o NOME da restricao difere entre
--    git (`user_roles_unique`) e producao (`user_roles_user_role_uniq`). Quem
--    escrever `ON CONFLICT ON CONSTRAINT <nome>` quebra de um lado ou do outro.
--    Hoje o repositorio so usa `ON CONFLICT (user_id, role)`, que infere por
--    coluna e funciona nos dois.
-- 2. As outras 12 funcoes so do servidor e as 14 politicas so do servidor do
--    achado 9. Sao trabalho proprio, e o item 1 do bloqueio acima e a parte
--    delas que morde primeiro.
--
-- REVERSAO: `docs/auditoria/consolidacao-2026-08-28/QUADRO-FINAL.md` §4. O
-- rollback e o inverso literal do corpo abaixo (DROP dos 4 gatilhos, da funcao,
-- dos 6 indices, das 2 tabelas, das 2 restricoes de `user_roles` e das 3
-- colunas) e so faz sentido num banco onde eles nao deveriam existir.

BEGIN;

-- ===========================================================================
-- 1. COLUNAS SO DO SERVIDOR (achado 9)
-- ===========================================================================
-- Precisam vir antes dos gatilhos: `BEFORE UPDATE OF <coluna>` resolve a coluna
-- no momento do `CREATE TRIGGER` e falha com `42703` se ela nao existir.
--
-- `users.reports_to` e o caso que ja mordia: `20260702222743`, `20260703010000` e
-- `20260718120000` criam funcoes plpgsql que consultam `u.reports_to`. Corpo
-- plpgsql nao e resolvido na criacao, entao elas nascem sem erro num banco onde
-- a coluna nao existe, e so quebram quando alguem as chama. 160 de 186 usuarios
-- tem o campo preenchido em producao.

ALTER TABLE public.users
  ADD COLUMN reports_to uuid;

ALTER TABLE public.users
  ADD CONSTRAINT users_reports_to_fkey
  FOREIGN KEY (reports_to) REFERENCES public.users(id) ON DELETE SET NULL;

-- 131 de 186 linhas com `true` em producao.
ALTER TABLE public.users
  ADD COLUMN is_test boolean NOT NULL DEFAULT false;

-- 12 de 19 grupos com pai em producao.
ALTER TABLE public.manager_groups
  ADD COLUMN parent_group_id uuid;

ALTER TABLE public.manager_groups
  ADD CONSTRAINT manager_groups_parent_group_id_fkey
  FOREIGN KEY (parent_group_id) REFERENCES public.manager_groups(id) ON DELETE SET NULL;

-- ===========================================================================
-- 2. RESTRICOES DE `user_roles` QUE O GIT NAO CRIA
-- ===========================================================================
-- `20260701030000_epic30_user_roles.sql` usa `CREATE TABLE IF NOT EXISTS`. Em
-- producao a tabela ja existia (veio da migration so-do-servidor
-- `20260621100000 e1_user_roles`), entao aquele `IF NOT EXISTS` calou e o corpo
-- dele nunca definiu nada la. O resultado e que as duas definicoes divergiram:
-- producao tem `user_roles_role_check` e `user_roles_tenant_id_fkey`, e o
-- `CREATE TABLE` do git nao declara nenhum dos dois. Sem eles, um banco
-- reconstruido aceita papel invalido em `user_roles.role`, que e justamente o
-- valor que `recompute_primary_role()` copia para `users.role`, onde existe
-- `users_role_check`. A escrita falharia la dentro do gatilho, longe da origem.

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_role_check
  CHECK (role = ANY (ARRAY['student'::text, 'leader'::text, 'manager'::text, 'admin'::text, 'super_admin'::text, 'instructor'::text]));

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- ===========================================================================
-- 3. INDICES SO DO SERVIDOR
-- ===========================================================================

CREATE INDEX idx_users_reports_to ON public.users USING btree (reports_to);
CREATE INDEX idx_manager_groups_parent ON public.manager_groups USING btree (parent_group_id);
CREATE INDEX idx_user_roles_role ON public.user_roles USING btree (role);
CREATE INDEX idx_user_roles_tenant ON public.user_roles USING btree (tenant_id);

-- Os dois de `capability_evidence` sao da frente Aprendizagem do Time: a
-- migration de convergencia (`20260828120000`) cria 7 indices nessa tabela e
-- producao tem 9. Estes sao os 2 que faltam.
CREATE INDEX idx_capability_evidence_capability_criterion
  ON public.capability_evidence USING btree (capability_id, criterion_id);
CREATE INDEX idx_capability_evidence_student_course_observed
  ON public.capability_evidence USING btree (student_id, course_id, observed_at);

-- ===========================================================================
-- 4. FUNCAO DE GATILHO SO DO SERVIDOR
-- ===========================================================================
-- `set_capabilities_updated_at_fn` nao aparece em nenhum arquivo do repositorio
-- (zero ocorrencias, nem em comentario). O cabecalho de `20260831125000` lista
-- TRES gatilhos so do servidor; sao QUATRO. Este e o quarto, e o unico dentro
-- da frente Aprendizagem do Time. Sem ele, `capabilities.updated_at` congela no
-- valor do INSERT num banco reconstruido, e nenhuma tela acusa.
--
-- Corpo lido de `pg_get_functiondef` em producao. Note que ele NAO e
-- `SECURITY DEFINER` nem tem `search_path` fixo, ao contrario das 4 recuperadas
-- em `20260831125000`. Reproduzido como esta la, e nao "melhorado" aqui, para
-- que esta migration continue sendo um espelho e nao uma mudanca disfarcada.

CREATE OR REPLACE FUNCTION public.set_capabilities_updated_at_fn()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- ===========================================================================
-- 5. OS 4 GATILHOS SO DO SERVIDOR
-- ===========================================================================
-- Definicoes lidas de `pg_get_triggerdef` em producao, verbatim. Producao tem 22
-- gatilhos nao-internos em `public`; 18 sao criados por alguma migration do
-- repositorio (esse e o controle positivo do levantamento) e estes 4 nao sao.
--
-- As funcoes que os tres primeiros executam vieram de `20260831125000`. A do
-- quarto foi definida logo acima.

CREATE TRIGGER trg_users_reports_to_guard
  BEFORE INSERT OR UPDATE OF reports_to ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.users_reports_to_guard();

CREATE TRIGGER trg_manager_groups_parent_guard
  BEFORE INSERT OR UPDATE OF parent_group_id ON public.manager_groups
  FOR EACH ROW EXECUTE FUNCTION public.manager_groups_parent_guard();

-- Atencao ao que producao NAO tem: este gatilho e `AFTER INSERT OR DELETE`, sem
-- `UPDATE`, embora `trg_recompute_primary_role()` trate os tres casos. Copiado
-- como esta la. Trocar um `UPDATE` de `user_roles.role` deixa `users.role`
-- desatualizado tanto em producao quanto num banco reconstruido. O que se
-- garante aqui e que os dois erram igual, nao que o desenho esteja certo.
CREATE TRIGGER user_roles_recompute_primary
  AFTER INSERT OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_primary_role();

CREATE TRIGGER set_capabilities_updated_at
  BEFORE UPDATE ON public.capabilities
  FOR EACH ROW EXECUTE FUNCTION public.set_capabilities_updated_at_fn();

-- ===========================================================================
-- 6. TABELAS SO DO SERVIDOR
-- ===========================================================================
-- Producao tem 81 tabelas em `public`; 79 sao criadas por alguma migration do
-- repositorio. Estas sao as 2 que nao sao, e as duas tem dado vivo.

-- ---------------------------------------------------------------------------
-- semantic_analyses (23 linhas), LEITURA VIVA DA APLICACAO
-- ---------------------------------------------------------------------------
-- Referenciada por 5 arquivos, entre eles duas rotas de producao:
--   apps/web/src/app/api/analytics/aprendizagem-time/classify/route.ts
--   apps/web/src/app/api/analytics/semantic/route.ts
-- Num banco reconstruido essas rotas quebram com "relation does not exist",
-- a mesma classe de falha que manteve a frente Aprendizagem do Time morta em
-- producao (o codigo pedia `capabilities.title` num banco onde a coluna se
-- chamava `name`). E este e o item de maior consequencia deste arquivo.
CREATE TABLE public.semantic_analyses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  course_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  roda_stage integer NOT NULL DEFAULT 1,
  roda_confidence numeric DEFAULT 0.00,
  roda_evidence jsonb DEFAULT '[]'::jsonb,
  cma_corpo integer NOT NULL DEFAULT 33,
  cma_mente integer NOT NULL DEFAULT 34,
  cma_alma integer NOT NULL DEFAULT 33,
  cma_dominant text NOT NULL DEFAULT 'mente'::text,
  metanoia_level integer NOT NULL DEFAULT 0,
  metanoia_signals jsonb DEFAULT '[]'::jsonb,
  kolb_style text,
  kolb_grasping numeric,
  kolb_transforming numeric,
  jung_layer text NOT NULL DEFAULT 'persona'::text,
  jung_confidence numeric DEFAULT 0.00,
  jung_evidence jsonb DEFAULT '[]'::jsonb,
  engagement_level integer NOT NULL DEFAULT 1,
  engagement_ai_probability numeric DEFAULT 0.00,
  classification_model text DEFAULT 'claude-sonnet-4-5'::text,
  classification_tokens_used integer DEFAULT 0,
  sessions_analyzed integer NOT NULL DEFAULT 0,
  responses_analyzed integer NOT NULL DEFAULT 0,
  summary text,
  analyzed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT semantic_analyses_pkey PRIMARY KEY (id),
  CONSTRAINT uq_semantic_student_course_tenant UNIQUE (student_id, course_id, tenant_id),
  CONSTRAINT semantic_analyses_cma_dominant_check
    CHECK (cma_dominant = ANY (ARRAY['corpo'::text, 'mente'::text, 'alma'::text])),
  CONSTRAINT semantic_analyses_jung_layer_check
    CHECK (jung_layer = ANY (ARRAY['persona'::text, 'ego'::text, 'shadow'::text, 'self'::text])),
  CONSTRAINT semantic_analyses_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT semantic_analyses_course_id_fkey
    FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE,
  CONSTRAINT semantic_analyses_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_semantic_tenant ON public.semantic_analyses USING btree (tenant_id);
CREATE INDEX idx_semantic_tenant_course ON public.semantic_analyses USING btree (tenant_id, course_id);
CREATE INDEX idx_semantic_student ON public.semantic_analyses USING btree (student_id, tenant_id);
CREATE INDEX idx_semantic_analyzed_at ON public.semantic_analyses USING btree (tenant_id, analyzed_at);

ALTER TABLE public.semantic_analyses ENABLE ROW LEVEL SECURITY;

-- Politica unica em producao: so leitura, so no proprio tenant, so para
-- instructor/admin/super_admin. Escrita nao tem politica alguma: chega pelo
-- cliente de servico, que contorna RLS. Reproduzido como esta la: criar a tabela
-- sem esta politica a deixaria com RLS ligada e negacao total (falha fechada,
-- mas divergente), e criar a tabela sem RLS a deixaria aberta a qualquer
-- autenticado. Nenhum dos dois e producao.
CREATE POLICY sa_analysis_role_select ON public.semantic_analyses
  FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND (has_role(auth.uid(), 'instructor'::text)
         OR has_role(auth.uid(), 'admin'::text)
         OR is_super_admin())
  );

-- ---------------------------------------------------------------------------
-- capability_modules (27 linhas), sem leitor no codigo hoje
-- ---------------------------------------------------------------------------
-- Zero referencias em `apps/` e `packages/` (varredura com glob citado, nao com
-- glob solto do zsh, que devolve zero por vacuidade). Entra assim mesmo: tem 27
-- linhas vivas ligando capacidade a capitulo, e um banco reconstruido sem ela
-- perde esse vinculo sem que nada acuse.
CREATE TABLE public.capability_modules (
  capability_id uuid NOT NULL,
  chapter_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  CONSTRAINT capability_modules_pkey PRIMARY KEY (capability_id, chapter_id),
  CONSTRAINT capability_modules_capability_id_fkey
    FOREIGN KEY (capability_id) REFERENCES public.capabilities(id) ON DELETE CASCADE,
  CONSTRAINT capability_modules_chapter_id_fkey
    FOREIGN KEY (chapter_id) REFERENCES public.chapters(id) ON DELETE CASCADE,
  CONSTRAINT capability_modules_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_capability_modules_tenant ON public.capability_modules USING btree (tenant_id);
CREATE INDEX idx_capability_modules_chapter ON public.capability_modules USING btree (chapter_id);

ALTER TABLE public.capability_modules ENABLE ROW LEVEL SECURITY;

-- Nomes abreviados (`capmod_*`) porque sao os nomes que estao em producao. Um
-- nome "mais claro" aqui criaria divergencia nova entre os dois lados, que e
-- exatamente o que este arquivo existe para eliminar.
CREATE POLICY capmod_tenant_select ON public.capability_modules
  FOR SELECT
  USING (tenant_id = auth_tenant_id());

CREATE POLICY capmod_staff_write ON public.capability_modules
  FOR ALL
  USING (tenant_id = auth_tenant_id()
         AND auth_user_role() = ANY (ARRAY['instructor'::text, 'manager'::text, 'admin'::text]))
  WITH CHECK (tenant_id = auth_tenant_id()
         AND auth_user_role() = ANY (ARRAY['instructor'::text, 'manager'::text, 'admin'::text]));

CREATE POLICY capmod_super_admin ON public.capability_modules
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

COMMIT;
