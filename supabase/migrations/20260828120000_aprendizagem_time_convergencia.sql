-- ===========================================================================
-- CONVERGÊNCIA — Aprendizagem do Time: UMA migration para os DOIS terrenos
-- ===========================================================================
-- POR QUE ESTA MIGRATION EXISTE (2026-08-28)
--
-- Auditoria por consulta direta ao banco de produção (`vaguswivhqnlbgqvnjch`,
-- somente leitura) provou que o schema desta frente NUNCA foi aplicado em
-- lugar nenhum, e que o par de migrations existente é MUTUAMENTE EXCLUSIVO
-- POR TERRENO — cada uma só funciona no terreno que a outra não produz:
--
--   ambiente                     20260821000000        20260825220000
--   ---------------------------  --------------------  --------------------
--   produção (terreno ocupado)   FALHA (`source_table`) passaria
--   virgem  (staging/CI/cliente) passa                  FALHA (`code`)
--
-- Logo, hoje NÃO EXISTE sequência capaz de levantar este schema do zero.
-- Esta migration é a terceira via: um ÚNICO alvo convergido, alcançável a
-- partir de qualquer um dos dois terrenos, sem perder um único dado.
--
-- O PRINCÍPIO QUE GOVERNA O ARQUIVO: idempotente DE VERDADE, não por silêncio.
-- `CREATE TABLE IF NOT EXISTS` contra terreno ocupado NÃO PROTEGE, apenas
-- CALA — a migration passa verde sem aplicar a estrutura que declara. Foi
-- exatamente esse defeito que produziu, nesta casa, 3 tabelas com 931 linhas
-- em produção que nenhuma migration criava. Por isso:
--   • o alvo é o mesmo nos dois terrenos (união de colunas legadas + novas),
--     de modo que todo backfill referencie colunas que existem sempre;
--   • o bloco 10 no fim VERIFICA a estrutura real coluna a coluna, índice a
--     índice, e RAISE EXCEPTION se o alvo não foi atingido. Silêncio deixa de
--     ser um desfecho possível: ou converge, ou grita.
--
-- O QUE ELA NÃO FAZ, E É PROPOSITAL
--   • Nenhum DROP TABLE, nenhum DROP COLUMN, nenhum DELETE. As 853 evidências
--     e as 15 capacidades de produção são preservadas na íntegra.
--   • Não inventa nível de aprendizagem. `comprehension`, `depth_level` e
--     `application_level` nascem NULL para as linhas antigas, porque esse dado
--     não existe em lugar nenhum e chutá-lo seria pior que a ausência. Quem os
--     preenche é o pipeline de classificação, num passo separado.
--
-- EXPAND, NÃO CONTRACT. Esta é a fase de expansão: colunas legadas
-- (`code`, `name`, `focus_text`, `criterion_id`, `category`, `observed_at`)
-- passam a NULLABLE e convivem com as novas. A fase de contração — dropar as
-- legadas e estreitar o CHECK de `source_type` de volta só para o vocabulário
-- em inglês — é uma migration futura, depois que o pipeline rodar e o código
-- estiver uniformemente no vocabulário novo.
--
-- SUPERSEDE: `20260821000000_aprendizagem_time_schema.sql`,
-- `20260821010000_aprendizagem_time_seed_analise_problemas.sql` e
-- `20260825220000_aprendizagem_time_reconciliacao.sql`, neutralizadas em
-- no-ops documentados no mesmo commit. O conteúdo delas está preservado no
-- histórico do git e resumido aqui onde foi reaproveitado.
-- ===========================================================================

BEGIN;

-- ===========================================================================
-- 0. PRÉ-CONDIÇÕES — falhar cedo e alto, nunca aplicar pela metade
-- ===========================================================================
DO $$
DECLARE
  faltando text;
BEGIN
  SELECT string_agg(t, ', ')
    INTO faltando
    FROM unnest(ARRAY['tenants', 'courses', 'chapters', 'users']) AS t
   WHERE to_regclass('public.' || t) IS NULL;

  IF faltando IS NOT NULL THEN
    RAISE EXCEPTION
      'Aprendizagem do Time: tabelas-pai ausentes (%). Este banco não tem o schema base do produto — aplique as migrations iniciais antes desta.',
      faltando;
  END IF;

  IF to_regprocedure('public.auth_tenant_id()') IS NULL THEN
    RAISE EXCEPTION 'Aprendizagem do Time: helper auth_tenant_id() ausente — as policies de RLS não teriam como comparar o tenant.';
  END IF;
  IF to_regprocedure('public.auth_user_role()') IS NULL THEN
    RAISE EXCEPTION 'Aprendizagem do Time: helper auth_user_role() ausente — as policies de staff não teriam como resolver o papel.';
  END IF;
  IF to_regprocedure('public.is_super_admin()') IS NULL THEN
    RAISE EXCEPTION 'Aprendizagem do Time: helper is_super_admin() ausente.';
  END IF;
END $$;

-- ===========================================================================
-- 1. capabilities — capacidade curricular, ancorada a um curso
-- ===========================================================================
-- Terreno virgem: a tabela nasce já com a UNIÃO (legadas nullable + novas).
-- Terreno ocupado: o CREATE cala, e os ALTER abaixo fazem o trabalho. Ter a
-- mesma união nos dois lados é o que permite os backfills serem SQL estático:
-- `code`/`name`/`order` existem sempre, então nenhuma referência é inválida.
CREATE TABLE IF NOT EXISTS public.capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  -- legadas (produção): mantidas para não quebrar leitor externo ao repo
  code text,
  name text,
  focus_text text,
  "order" integer NOT NULL DEFAULT 0,
  -- canônicas (o que a camada de leitura consulta)
  slug text,
  title text,
  description text,
  display_order integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, code)
);

ALTER TABLE public.capabilities
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS focus_text text,
  ADD COLUMN IF NOT EXISTS "order" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS display_order integer,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- EXPAND: as legadas deixam de ser obrigatórias. Nenhum dado se perde — as 15
-- linhas de produção mantêm seus valores. O que muda é que uma escrita futura
-- que só conheça o vocabulário novo (slug/title) deixa de ser rejeitada.
ALTER TABLE public.capabilities ALTER COLUMN code       DROP NOT NULL;
ALTER TABLE public.capabilities ALTER COLUMN name       DROP NOT NULL;
ALTER TABLE public.capabilities ALTER COLUMN focus_text DROP NOT NULL;
ALTER TABLE public.capabilities ALTER COLUMN description DROP NOT NULL;

-- Backfill do slug. Os 5 `code` de produção foram MEDIDOS (não supostos), e a
-- conversão mecânica `replace('_','-')` NÃO reproduz o slug que o seed original
-- pressupõe em 4 dos 5 casos (`clareza_fenomeno` → `clareza-fenomeno`, mas o
-- seed diz `clareza-do-fenomeno`). Um slug divergente faria o `ON CONFLICT
-- (course_id, slug)` do seed errar o alvo e tentar INSERIR capacidade
-- duplicada. O mapa explícito abaixo é o que impede isso; qualquer code futuro
-- fora da lista cai na conversão mecânica.
UPDATE public.capabilities
   SET slug = CASE code
     WHEN 'clareza_fenomeno'        THEN 'clareza-do-fenomeno'
     WHEN 'pensamento_causal'       THEN 'pensamento-causal'
     WHEN 'uso_evidencia'           THEN 'uso-de-evidencia'
     WHEN 'construcao_contramedida' THEN 'construcao-de-contramedida'
     WHEN 'verificacao_eficacia'    THEN 'verificacao-de-eficacia'
     ELSE replace(code, '_', '-')
   END
 WHERE slug IS NULL AND code IS NOT NULL;

UPDATE public.capabilities SET title = name          WHERE title IS NULL AND name IS NOT NULL;
UPDATE public.capabilities SET display_order = "order" WHERE display_order IS NULL;

-- Simétrico: uma linha criada pelo vocabulário novo alimenta as legadas, para
-- que um leitor antigo (fora deste repo) não veja NULL onde esperava texto.
UPDATE public.capabilities SET code = replace(slug, '-', '_') WHERE code IS NULL AND slug IS NOT NULL;
UPDATE public.capabilities SET name = title                   WHERE name IS NULL AND title IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS capabilities_course_slug_uidx
  ON public.capabilities (course_id, slug);
CREATE INDEX IF NOT EXISTS idx_capabilities_tenant_course
  ON public.capabilities (tenant_id, course_id);

-- ===========================================================================
-- 2. capability_criteria — critério OBSERVÁVEL fixo por capacidade
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.capability_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  capability_id uuid NOT NULL REFERENCES public.capabilities(id) ON DELETE CASCADE,
  code text NOT NULL,
  description text NOT NULL,
  weight numeric NOT NULL DEFAULT 1,
  "order" integer NOT NULL DEFAULT 0,
  display_order integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (capability_id, code)
);

ALTER TABLE public.capability_criteria
  ADD COLUMN IF NOT EXISTS weight numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "order" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS display_order integer,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

UPDATE public.capability_criteria SET display_order = "order" WHERE display_order IS NULL;

CREATE INDEX IF NOT EXISTS idx_capability_criteria_capability
  ON public.capability_criteria (capability_id);
CREATE INDEX IF NOT EXISTS idx_capability_criteria_tenant
  ON public.capability_criteria (tenant_id);

-- ===========================================================================
-- 3. concepts — conceito curricular, ancorado a um módulo (chapter)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.concepts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  chapter_id uuid REFERENCES public.chapters(id) ON DELETE SET NULL,
  slug text NOT NULL,
  title text NOT NULL,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_concepts_course  ON public.concepts (course_id);
CREATE INDEX IF NOT EXISTS idx_concepts_chapter ON public.concepts (chapter_id);

-- ===========================================================================
-- 4. capability_concepts — join N:N conceito × capacidade
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.capability_concepts (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  capability_id uuid NOT NULL REFERENCES public.capabilities(id) ON DELETE CASCADE,
  concept_id uuid NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,
  PRIMARY KEY (capability_id, concept_id)
);

-- ===========================================================================
-- 5. capability_evidence — o coração da entrega
-- ===========================================================================
-- Em produção esta tabela tem 853 linhas e 12 colunas, e o grão legado é
-- (source, capacidade, CRITÉRIO). O grão novo é (source_table, source_id,
-- capability_id), com os critérios atendidos dentro de `criteria_met text[]`.
-- Medido em produção: 0 grupos duplicados nesse grão novo (maior grupo = 1),
-- portanto o índice ÚNICO abaixo é criável sem tocar em nenhuma linha.
CREATE TABLE IF NOT EXISTS public.capability_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  capability_id uuid REFERENCES public.capabilities(id) ON DELETE CASCADE,
  -- legadas (produção): grão antigo, preservadas e agora opcionais
  criterion_id uuid REFERENCES public.capability_criteria(id) ON DELETE CASCADE,
  chapter_id uuid REFERENCES public.chapters(id) ON DELETE SET NULL,
  category text,
  observed_at timestamptz,
  -- canônicas
  concept_id uuid,
  evidence_category text,
  source_type text NOT NULL,
  source_table text,
  source_id uuid,
  comprehension text,
  depth_level smallint,
  application_level text,
  confidence numeric(3,2),
  classification_model text NOT NULL DEFAULT 'pre-existente',
  classification_signals jsonb NOT NULL DEFAULT '{}'::jsonb,
  classification_reasoning text,
  criteria_met text[] NOT NULL DEFAULT '{}',
  occurred_at timestamptz,
  classified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.capability_evidence
  ADD COLUMN IF NOT EXISTS concept_id uuid,
  ADD COLUMN IF NOT EXISTS evidence_category text,
  ADD COLUMN IF NOT EXISTS source_table text,
  ADD COLUMN IF NOT EXISTS comprehension text,
  ADD COLUMN IF NOT EXISTS depth_level smallint,
  ADD COLUMN IF NOT EXISTS application_level text,
  ADD COLUMN IF NOT EXISTS confidence numeric(3,2),
  ADD COLUMN IF NOT EXISTS classification_model text NOT NULL DEFAULT 'pre-existente',
  ADD COLUMN IF NOT EXISTS classification_signals jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS classification_reasoning text,
  ADD COLUMN IF NOT EXISTS criteria_met text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS occurred_at timestamptz,
  ADD COLUMN IF NOT EXISTS classified_at timestamptz;

-- EXPAND: as três colunas do grão legado deixam de ser obrigatórias. Sem isto,
-- o `upsert` do pipeline morre em NOT NULL mesmo com todas as 13 colunas
-- criadas — ele não fornece `criterion_id`, `category` nem `observed_at`.
-- Um CHECK cujo argumento é NULL avalia NULL, ou seja, NÃO reprova a linha:
-- `category` continua com o CHECK de domínio e ainda assim aceita ausência.
ALTER TABLE public.capability_evidence ALTER COLUMN criterion_id DROP NOT NULL;
ALTER TABLE public.capability_evidence ALTER COLUMN category     DROP NOT NULL;
ALTER TABLE public.capability_evidence ALTER COLUMN observed_at  DROP NOT NULL;
ALTER TABLE public.capability_evidence ALTER COLUMN capability_id DROP NOT NULL;

-- Backfill PT → EN. Os rótulos vivos foram lidos do CHECK real
-- (`cognitiva`/`aplicada`/`real`), NÃO do que a migration anterior supôs
-- (`aplicacao`/`contexto_real`) — aqueles dois rótulos não existem no domínio,
-- e o CASE que os usava deixaria a coluna NULL para sempre.
UPDATE public.capability_evidence
   SET evidence_category = CASE category
     WHEN 'cognitiva' THEN 'cognitive'
     WHEN 'aplicada'  THEN 'application'
     WHEN 'real'      THEN 'real_context'
     ELSE NULL
   END
 WHERE evidence_category IS NULL AND category IS NOT NULL;

-- Ponteiro polimórfico: os 5 valores do CHECK vivo de `source_type`, cada um
-- para a tabela de origem correspondente. `aplicacao_real` fica sem tabela de
-- propósito: não existe tabela de evidência real neste schema, e apontar para
-- uma inexistente seria pior que a ausência.
UPDATE public.capability_evidence
   SET source_table = CASE source_type
     WHEN 'reflexao'  THEN 'slide_reflections'
     WHEN 'socratica' THEN 'sessions'
     WHEN 'quiz'      THEN 'quiz_attempts'
     WHEN 'atividade' THEN 'assignment_submissions'
     ELSE NULL
   END
 WHERE source_table IS NULL AND source_type IS NOT NULL;

-- `observed_at` e `occurred_at` são a MESMA grandeza com dois nomes.
UPDATE public.capability_evidence SET occurred_at = observed_at WHERE occurred_at IS NULL;
UPDATE public.capability_evidence SET observed_at = occurred_at WHERE observed_at IS NULL;

-- O CHECK vivo de `source_type` só admite o vocabulário em PORTUGUÊS, e o
-- pipeline escreve em INGLÊS (`reflection`, `scenario`, `assignment`,
-- `socratic_session`…). Sem ampliar aqui, o upsert continuaria sendo rejeitado
-- por 23514 depois de resolvidos o 42703 e o NOT NULL. A união abaixo é
-- deliberadamente EXPAND: aceita os dois vocabulários enquanto a base tiver
-- linhas nos dois. Estreitar para só o inglês é a migration de contração.
ALTER TABLE public.capability_evidence DROP CONSTRAINT IF EXISTS capability_evidence_source_type_check;
ALTER TABLE public.capability_evidence
  ADD CONSTRAINT capability_evidence_source_type_check CHECK (source_type IN (
    'reflexao', 'socratica', 'quiz', 'atividade', 'aplicacao_real',
    'reflection', 'scenario', 'assignment', 'socratic_session',
    'real_evidence', 'manager_validation'
  ));

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'capability_evidence_category_check') THEN
    ALTER TABLE public.capability_evidence
      ADD CONSTRAINT capability_evidence_category_check
      CHECK (category IN ('cognitiva', 'aplicada', 'real'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'capability_evidence_evidence_category_check') THEN
    ALTER TABLE public.capability_evidence
      ADD CONSTRAINT capability_evidence_evidence_category_check
      CHECK (evidence_category IN ('cognitive', 'application', 'real_context'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'capability_evidence_comprehension_check') THEN
    ALTER TABLE public.capability_evidence
      ADD CONSTRAINT capability_evidence_comprehension_check
      CHECK (comprehension IN ('evidenced', 'partial', 'not_evidenced'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'capability_evidence_depth_level_check') THEN
    ALTER TABLE public.capability_evidence
      ADD CONSTRAINT capability_evidence_depth_level_check
      CHECK (depth_level BETWEEN 1 AND 7);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'capability_evidence_application_level_check') THEN
    ALTER TABLE public.capability_evidence
      ADD CONSTRAINT capability_evidence_application_level_check
      CHECK (application_level IN ('not_evidenced', 'simulated', 'contextualized', 'applied_real'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'capability_evidence_confidence_check') THEN
    ALTER TABLE public.capability_evidence
      ADD CONSTRAINT capability_evidence_confidence_check
      CHECK (confidence BETWEEN 0 AND 1);
  END IF;

  -- Pelo menos um alvo: conceito OU capacidade.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'capability_evidence_target_chk') THEN
    ALTER TABLE public.capability_evidence
      ADD CONSTRAINT capability_evidence_target_chk
      CHECK (concept_id IS NOT NULL OR capability_id IS NOT NULL);
  END IF;

  -- A FK de concept_id só existe depois de `concepts` (bloco 3, acima).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'capability_evidence_concept_fk') THEN
    ALTER TABLE public.capability_evidence
      ADD CONSTRAINT capability_evidence_concept_fk
      FOREIGN KEY (concept_id) REFERENCES public.concepts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- O índice único que o `upsert` do PostgREST precisa como árbitro.
-- ---------------------------------------------------------------------------
-- NÃO-PARCIAL, e isto é a correção central: o PostgREST emite
-- `on_conflict=source_table,source_id,capability_id` — a LISTA DE COLUNAS, sem
-- o predicado. Contra um índice PARCIAL (`WHERE capability_id IS NOT NULL`) a
-- inferência de árbitro falha com 42P10, porque o Postgres exige que o
-- predicado do índice seja implicado pelo WHERE do comando, e não há WHERE.
--
-- A semântica de NULL cobre INTEGRALMENTE o que o `WHERE` tentava fazer: sob
-- NULLS DISTINCT (default), duas linhas com `capability_id` NULL NUNCA são
-- consideradas iguais, portanto o índice jamais as rejeita — exatamente o
-- efeito de excluí-las do índice. A única diferença é o índice guardar essas
-- linhas (custo desprezível nesta escala). NENHUMA MUDANÇA DE CÓDIGO É
-- NECESSÁRIA por causa deste ponto.
CREATE UNIQUE INDEX IF NOT EXISTS capability_evidence_source_capability_uidx
  ON public.capability_evidence (source_table, source_id, capability_id);

-- Dedup das evidências ancoradas só em conceito. Este permanece PARCIAL: não é
-- alvo de nenhum `onConflict` do código, então não sofre o 42P10.
CREATE UNIQUE INDEX IF NOT EXISTS capability_evidence_source_concept_uidx
  ON public.capability_evidence (source_table, source_id, concept_id)
  WHERE concept_id IS NOT NULL AND capability_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_capability_evidence_tenant
  ON public.capability_evidence (tenant_id);
CREATE INDEX IF NOT EXISTS idx_capability_evidence_student_capability
  ON public.capability_evidence (tenant_id, student_id, capability_id);
CREATE INDEX IF NOT EXISTS idx_capability_evidence_student_concept
  ON public.capability_evidence (tenant_id, student_id, concept_id);
CREATE INDEX IF NOT EXISTS idx_capability_evidence_course_time
  ON public.capability_evidence (tenant_id, course_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_capability_evidence_category
  ON public.capability_evidence (tenant_id, capability_id, evidence_category);

-- ===========================================================================
-- 6. capability_assessments — maturidade AGREGADA aluno × capacidade
-- ===========================================================================
-- Nunca sofre UPDATE de estado: cada transição é uma linha nova, e
-- `is_current` marca a vigente. É o que preserva o histórico de evolução.
CREATE TABLE IF NOT EXISTS public.capability_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  capability_id uuid NOT NULL REFERENCES public.capabilities(id) ON DELETE CASCADE,
  previous_state text CHECK (previous_state IN ('not_evidenced', 'emerging', 'developing', 'demonstrated')),
  new_state text NOT NULL CHECK (new_state IN ('not_evidenced', 'emerging', 'developing', 'demonstrated')),
  categories_present text[] NOT NULL DEFAULT '{}',
  triangulation_met boolean NOT NULL DEFAULT false,
  rationale text NOT NULL,
  classification_model text NOT NULL DEFAULT 'heuristic-v1',
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- No máximo UMA linha corrente por aluno×capacidade — é o que torna
-- `is_current` confiável e a leitura do estado atual O(1), sem agregação.
CREATE UNIQUE INDEX IF NOT EXISTS capability_assessments_current_uidx
  ON public.capability_assessments (tenant_id, student_id, capability_id)
  WHERE is_current;
CREATE INDEX IF NOT EXISTS idx_capability_assessments_history
  ON public.capability_assessments (tenant_id, student_id, capability_id, created_at);
CREATE INDEX IF NOT EXISTS idx_capability_assessments_tenant_capability
  ON public.capability_assessments (tenant_id, capability_id);

-- ===========================================================================
-- 7. rastro da avaliação — quais evidências e quais critérios a embasaram
-- ===========================================================================
-- `tenant_id` NÃO é redundante aqui: as policies filtram por
-- `tenant_id = auth_tenant_id()` direto na tabela, sem join. Sem a coluna, a
-- policy não teria por onde comparar.
CREATE TABLE IF NOT EXISTS public.capability_assessment_evidence (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL REFERENCES public.capability_assessments(id) ON DELETE CASCADE,
  evidence_id uuid NOT NULL REFERENCES public.capability_evidence(id) ON DELETE CASCADE,
  PRIMARY KEY (assessment_id, evidence_id)
);
CREATE INDEX IF NOT EXISTS idx_cae_evidence
  ON public.capability_assessment_evidence (evidence_id);

CREATE TABLE IF NOT EXISTS public.capability_assessment_criteria (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL REFERENCES public.capability_assessments(id) ON DELETE CASCADE,
  criterion_id uuid NOT NULL REFERENCES public.capability_criteria(id) ON DELETE CASCADE,
  met boolean NOT NULL,
  PRIMARY KEY (assessment_id, criterion_id)
);

-- ===========================================================================
-- 8. RLS — espelha o padrão QUE ESTÁ VIVO, não o das migrations obsoletas
-- ===========================================================================
-- As policies reais de `capabilities`/`capability_criteria`/`capability_evidence`
-- foram lidas de `pg_policy` em produção e usam `auth_user_role()`, NÃO
-- `has_role()` — e incluem `manager` na lista de staff. As migrations obsoletas
-- supunham `has_role()` e excluíam `manager` de propósito. Espelhar o vivo é o
-- que evita duas definições concorrentes de "quem pode ler".
--
-- DIVERGÊNCIA REGISTRADA, NÃO RESOLVIDA AQUI: `capability_evidence` já concede
-- ao `manager` leitura de TODO o tenant, sem o recorte de equipe que a camada
-- de Analytics aplica. Isso é anterior a esta migration e não é alterado por
-- ela. As tabelas novas de dado individual (`capability_assessments` e as duas
-- de rastro) seguem o MESMO desenho do irmão vivo, para não criar um terceiro
-- padrão. Inverter isso é trocar `auth_user_role() = ANY (ARRAY[...])` por uma
-- lista sem 'manager' nas policies `*_staff_select` abaixo.
--
-- Sem policy de escrita nas tabelas de avaliação: quem escreve é o service
-- client do pipeline, que não passa por RLS.

ALTER TABLE public.concepts                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_concepts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capabilities                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_criteria            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_evidence            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_assessments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_assessment_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_assessment_criteria ENABLE ROW LEVEL SECURITY;

-- --- currículo: leitura ampla no tenant, escrita por staff ------------------
DROP POLICY IF EXISTS concepts_tenant_select ON public.concepts;
CREATE POLICY concepts_tenant_select ON public.concepts
  FOR SELECT USING (tenant_id = auth_tenant_id());

DROP POLICY IF EXISTS concepts_staff_write ON public.concepts;
CREATE POLICY concepts_staff_write ON public.concepts
  FOR ALL USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() = ANY (ARRAY['instructor', 'manager', 'admin'])
  )
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_user_role() = ANY (ARRAY['instructor', 'manager', 'admin'])
  );

DROP POLICY IF EXISTS concepts_super_admin ON public.concepts;
CREATE POLICY concepts_super_admin ON public.concepts
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS capcon_tenant_select ON public.capability_concepts;
CREATE POLICY capcon_tenant_select ON public.capability_concepts
  FOR SELECT USING (tenant_id = auth_tenant_id());

DROP POLICY IF EXISTS capcon_staff_write ON public.capability_concepts;
CREATE POLICY capcon_staff_write ON public.capability_concepts
  FOR ALL USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() = ANY (ARRAY['instructor', 'manager', 'admin'])
  )
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_user_role() = ANY (ARRAY['instructor', 'manager', 'admin'])
  );

DROP POLICY IF EXISTS capcon_super_admin ON public.capability_concepts;
CREATE POLICY capcon_super_admin ON public.capability_concepts
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

-- --- dado individual de aprendizagem ---------------------------------------
DROP POLICY IF EXISTS capasses_student_select ON public.capability_assessments;
CREATE POLICY capasses_student_select ON public.capability_assessments
  FOR SELECT USING (student_id = auth.uid() AND tenant_id = auth_tenant_id());

DROP POLICY IF EXISTS capasses_staff_select ON public.capability_assessments;
CREATE POLICY capasses_staff_select ON public.capability_assessments
  FOR SELECT USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() = ANY (ARRAY['instructor', 'manager', 'admin'])
  );

DROP POLICY IF EXISTS capasses_super_admin ON public.capability_assessments;
CREATE POLICY capasses_super_admin ON public.capability_assessments
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Rastro granular: sem coluna de aluno, logo sem policy de aluno.
DROP POLICY IF EXISTS cae_staff_select ON public.capability_assessment_evidence;
CREATE POLICY cae_staff_select ON public.capability_assessment_evidence
  FOR SELECT USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() = ANY (ARRAY['instructor', 'manager', 'admin'])
  );

DROP POLICY IF EXISTS cae_super_admin ON public.capability_assessment_evidence;
CREATE POLICY cae_super_admin ON public.capability_assessment_evidence
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS cac_staff_select ON public.capability_assessment_criteria;
CREATE POLICY cac_staff_select ON public.capability_assessment_criteria
  FOR SELECT USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() = ANY (ARRAY['instructor', 'manager', 'admin'])
  );

DROP POLICY IF EXISTS cac_super_admin ON public.capability_assessment_criteria;
CREATE POLICY cac_super_admin ON public.capability_assessment_criteria
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Terreno virgem: `capabilities`/`capability_criteria`/`capability_evidence`
-- nasceram nesta migration e ficariam SEM policy nenhuma — com RLS ligada, isso
-- é uma tabela invisível para todo mundo. Os blocos abaixo só criam a policy se
-- ela ainda não existir, para NÃO reescrever o que já está vivo em produção.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.capabilities'::regclass) THEN
    CREATE POLICY cap_tenant_select ON public.capabilities
      FOR SELECT USING (tenant_id = auth_tenant_id());
    CREATE POLICY cap_staff_write ON public.capabilities
      FOR ALL USING (
        tenant_id = auth_tenant_id()
        AND auth_user_role() = ANY (ARRAY['instructor', 'manager', 'admin'])
      )
      WITH CHECK (
        tenant_id = auth_tenant_id()
        AND auth_user_role() = ANY (ARRAY['instructor', 'manager', 'admin'])
      );
    CREATE POLICY cap_super_admin ON public.capabilities
      FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.capability_criteria'::regclass) THEN
    CREATE POLICY capcrit_tenant_select ON public.capability_criteria
      FOR SELECT USING (tenant_id = auth_tenant_id());
    CREATE POLICY capcrit_staff_write ON public.capability_criteria
      FOR ALL USING (
        tenant_id = auth_tenant_id()
        AND auth_user_role() = ANY (ARRAY['instructor', 'manager', 'admin'])
      )
      WITH CHECK (
        tenant_id = auth_tenant_id()
        AND auth_user_role() = ANY (ARRAY['instructor', 'manager', 'admin'])
      );
    CREATE POLICY capcrit_super_admin ON public.capability_criteria
      FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.capability_evidence'::regclass) THEN
    CREATE POLICY capev_student_select ON public.capability_evidence
      FOR SELECT USING (student_id = auth.uid() AND tenant_id = auth_tenant_id());
    CREATE POLICY capev_staff_select ON public.capability_evidence
      FOR SELECT USING (
        tenant_id = auth_tenant_id()
        AND auth_user_role() = ANY (ARRAY['instructor', 'manager', 'admin'])
      );
    CREATE POLICY capev_super_admin ON public.capability_evidence
      FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
  END IF;
END $$;

-- ===========================================================================
-- 9. SEED — 5 capacidades do curso "Análise e Solução de Problemas"
-- ===========================================================================
-- Reemitido aqui, e não deixado em `20260821010000`, por uma razão de ORDEM:
-- aquele arquivo tem timestamp MENOR que este, então num terreno virgem ele
-- rodaria ANTES do schema existir. Um seed que precede a tabela que semeia não
-- é recuperável por idempotência nenhuma.
--
-- A guarda é sobre o ESTADO REAL, não sobre colisão de nome: só semeia se o
-- curso existir E ainda não tiver capacidade alguma. Em produção, onde os 3
-- cursos homônimos já têm 5 capacidades cada, este bloco é integralmente
-- no-op — as 15 linhas vivas não são tocadas, nem no título nem na descrição.
DO $$
DECLARE
  r_curso record;
  v_clareza uuid; v_causal uuid; v_evidencia uuid; v_contramedida uuid; v_eficacia uuid;
  n_semeados integer := 0;
BEGIN
  FOR r_curso IN
    SELECT c.id, c.tenant_id
      FROM public.courses c
     WHERE c.title = 'Análise e Solução de Problemas'
       AND NOT EXISTS (SELECT 1 FROM public.capabilities cap WHERE cap.course_id = c.id)
  LOOP
    INSERT INTO public.capabilities (tenant_id, course_id, slug, code, title, name, description, display_order, "order")
    VALUES (r_curso.tenant_id, r_curso.id, 'clareza-do-fenomeno', 'clareza_fenomeno', 'Clareza do fenômeno', 'Clareza do fenômeno',
            'Descrever o problema com precisão observável, sem confundir sintoma com causa.', 1, 1)
    RETURNING id INTO v_clareza;

    INSERT INTO public.capabilities (tenant_id, course_id, slug, code, title, name, description, display_order, "order")
    VALUES (r_curso.tenant_id, r_curso.id, 'pensamento-causal', 'pensamento_causal', 'Pensamento causal', 'Pensamento causal',
            'Identificar causa raiz e articular a cadeia causal até o fenômeno observado.', 2, 2)
    RETURNING id INTO v_causal;

    INSERT INTO public.capabilities (tenant_id, course_id, slug, code, title, name, description, display_order, "order")
    VALUES (r_curso.tenant_id, r_curso.id, 'uso-de-evidencia', 'uso_evidencia', 'Uso de evidência', 'Uso de evidência',
            'Sustentar hipóteses e conclusões com dados e observação, não com opinião.', 3, 3)
    RETURNING id INTO v_evidencia;

    INSERT INTO public.capabilities (tenant_id, course_id, slug, code, title, name, description, display_order, "order")
    VALUES (r_curso.tenant_id, r_curso.id, 'construcao-de-contramedida', 'construcao_contramedida', 'Construção de contramedida', 'Construção de contramedida',
            'Propor ação que ataca a causa raiz identificada, não apenas conter o sintoma.', 4, 4)
    RETURNING id INTO v_contramedida;

    INSERT INTO public.capabilities (tenant_id, course_id, slug, code, title, name, description, display_order, "order")
    VALUES (r_curso.tenant_id, r_curso.id, 'verificacao-de-eficacia', 'verificacao_eficacia', 'Verificação de eficácia', 'Verificação de eficácia',
            'Definir indicador e meta antes de agir, e verificar se a ação funcionou de fato.', 5, 5)
    RETURNING id INTO v_eficacia;

    -- Os 5 critérios de "Uso de evidência" são TEXTO LITERAL da spec (§28). Os
    -- demais são INFERIDOS do vocabulário de §21/§22/§32/§36 e precisam de
    -- validação do dono de currículo antes de virarem critério de produção.
    INSERT INTO public.capability_criteria (tenant_id, capability_id, code, description, display_order, "order") VALUES
      (r_curso.tenant_id, v_clareza, 'CF-1', 'Delimita o escopo do problema (o quê, onde, quando, quanto)', 1, 1),
      (r_curso.tenant_id, v_clareza, 'CF-2', 'Diferencia sintoma de causa na própria descrição do fenômeno', 2, 2),
      (r_curso.tenant_id, v_clareza, 'CF-3', 'Descreve o fenômeno com dado observável, não com generalização vaga', 3, 3),
      (r_curso.tenant_id, v_clareza, 'CF-4', 'Evita atribuir causa antes de descrever o fenômeno com precisão', 4, 4),
      (r_curso.tenant_id, v_causal, 'PC-1', 'Distingue causa raiz de sintoma', 1, 1),
      (r_curso.tenant_id, v_causal, 'PC-2', 'Articula a cadeia causal (encadeia "por quê" até a raiz)', 2, 2),
      (r_curso.tenant_id, v_causal, 'PC-3', 'Conecta a causa identificada de volta ao fenômeno descrito', 3, 3),
      (r_curso.tenant_id, v_causal, 'PC-4', 'Considera causas concorrentes em vez de fixar em uma única', 4, 4),
      (r_curso.tenant_id, v_evidencia, 'UE-1', 'Diferencia fato de opinião', 1, 1),
      (r_curso.tenant_id, v_evidencia, 'UE-2', 'Sustenta hipótese com dados', 2, 2),
      (r_curso.tenant_id, v_evidencia, 'UE-3', 'Referencia observação', 3, 3),
      (r_curso.tenant_id, v_evidencia, 'UE-4', 'Valida conclusão', 4, 4),
      (r_curso.tenant_id, v_evidencia, 'UE-5', 'Evita inferência sem evidência', 5, 5),
      (r_curso.tenant_id, v_contramedida, 'CC-1', 'Diferencia contenção (paliativo) de contramedida (ataca a causa raiz)', 1, 1),
      (r_curso.tenant_id, v_contramedida, 'CC-2', 'Propõe ação diretamente ligada à causa identificada', 2, 2),
      (r_curso.tenant_id, v_contramedida, 'CC-3', 'Define responsável e prazo da ação proposta', 3, 3),
      (r_curso.tenant_id, v_contramedida, 'CC-4', 'Antecipa efeito colateral ou risco da ação proposta', 4, 4),
      (r_curso.tenant_id, v_eficacia, 'VE-1', 'Define indicador mensurável antes de agir', 1, 1),
      (r_curso.tenant_id, v_eficacia, 'VE-2', 'Estabelece meta ou critério de sucesso', 2, 2),
      (r_curso.tenant_id, v_eficacia, 'VE-3', 'Compara resultado real contra a meta definida', 3, 3),
      (r_curso.tenant_id, v_eficacia, 'VE-4', 'Revisa a ação quando o indicador não melhora', 4, 4);

    n_semeados := n_semeados + 1;
  END LOOP;

  IF n_semeados = 0 THEN
    RAISE NOTICE 'Aprendizagem do Time: nenhum curso semeado (ou o curso não existe neste ambiente, ou já tem capacidades). Nenhuma linha existente foi tocada.';
  ELSE
    RAISE NOTICE 'Aprendizagem do Time: % curso(s) semeado(s) com 5 capacidades e 21 critérios cada.', n_semeados;
  END IF;
END $$;

-- ===========================================================================
-- 10. VERIFICAÇÃO — o poka-yoke que impede "passou verde sem aplicar"
-- ===========================================================================
-- Tudo acima usa `IF NOT EXISTS`, que é silencioso por natureza. Este bloco é o
-- contrapeso: mede a estrutura REAL e derruba a transação inteira se o alvo não
-- foi atingido. Uma migration que não pode falhar não é uma migration, é uma
-- esperança.
DO $$
DECLARE
  esperado_colunas CONSTANT text[][] := ARRAY[
    ['capabilities','slug'], ['capabilities','title'], ['capabilities','display_order'], ['capabilities','is_active'],
    ['capability_criteria','display_order'], ['capability_criteria','is_active'],
    ['capability_evidence','concept_id'], ['capability_evidence','evidence_category'],
    ['capability_evidence','source_table'], ['capability_evidence','comprehension'],
    ['capability_evidence','depth_level'], ['capability_evidence','application_level'],
    ['capability_evidence','confidence'], ['capability_evidence','classification_model'],
    ['capability_evidence','classification_signals'], ['capability_evidence','classification_reasoning'],
    ['capability_evidence','criteria_met'], ['capability_evidence','occurred_at'],
    ['capability_evidence','classified_at'],
    ['concepts','id'], ['concepts','title'], ['concepts','is_active'], ['concepts','display_order'],
    ['capability_concepts','capability_id'], ['capability_concepts','concept_id'],
    ['capability_assessments','new_state'], ['capability_assessments','is_current'],
    ['capability_assessment_evidence','evidence_id'],
    ['capability_assessment_criteria','criterion_id']
  ];
  esperado_indices CONSTANT text[] := ARRAY[
    'capability_evidence_source_capability_uidx',
    'capability_evidence_source_concept_uidx',
    'capabilities_course_slug_uidx',
    'capability_assessments_current_uidx'
  ];
  i integer;
  faltando text := '';
  n_parcial integer;
  n_sem_rls integer;
  n_sem_policy integer;
BEGIN
  -- 10.1 colunas
  FOR i IN 1 .. array_length(esperado_colunas, 1) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name  = esperado_colunas[i][1]
         AND column_name = esperado_colunas[i][2]
    ) THEN
      faltando := faltando || ' coluna ' || esperado_colunas[i][1] || '.' || esperado_colunas[i][2] || ';';
    END IF;
  END LOOP;

  -- 10.2 índices
  FOR i IN 1 .. array_length(esperado_indices, 1) LOOP
    IF to_regclass('public.' || esperado_indices[i]) IS NULL THEN
      faltando := faltando || ' índice ' || esperado_indices[i] || ';';
    END IF;
  END LOOP;

  -- 10.3 as 3 colunas do grão legado precisam estar NULLABLE, senão o upsert
  --      do pipeline continua morrendo em NOT NULL depois de tudo isto.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='capability_evidence'
       AND column_name IN ('criterion_id','category','observed_at')
       AND is_nullable = 'NO'
  ) THEN
    faltando := faltando || ' NOT NULL remanescente em capability_evidence (criterion_id/category/observed_at);';
  END IF;

  -- 10.4 o árbitro do ON CONFLICT NÃO pode ser parcial (42P10)
  SELECT count(*) INTO n_parcial
    FROM pg_index i
   WHERE i.indexrelid = 'public.capability_evidence_source_capability_uidx'::regclass
     AND i.indpred IS NOT NULL;
  IF n_parcial > 0 THEN
    faltando := faltando || ' capability_evidence_source_capability_uidx está PARCIAL (o upsert falharia com 42P10);';
  END IF;

  -- 10.5 RLS ligada nas 8 tabelas
  SELECT count(*) INTO n_sem_rls
    FROM unnest(ARRAY['concepts','capabilities','capability_concepts','capability_criteria',
                      'capability_evidence','capability_assessments',
                      'capability_assessment_evidence','capability_assessment_criteria']) AS t
   WHERE NOT COALESCE((SELECT relrowsecurity FROM pg_class
                        WHERE relname = t AND relnamespace = 'public'::regnamespace), false);
  IF n_sem_rls > 0 THEN
    faltando := faltando || ' ' || n_sem_rls || ' tabela(s) sem RLS ligada;';
  END IF;

  -- 10.6 RLS ligada SEM policy nenhuma é pior que RLS desligada: a tabela fica
  --      invisível e o defeito só aparece na tela do cliente.
  SELECT count(*) INTO n_sem_policy
    FROM unnest(ARRAY['concepts','capabilities','capability_concepts','capability_criteria',
                      'capability_evidence','capability_assessments',
                      'capability_assessment_evidence','capability_assessment_criteria']) AS t
   WHERE NOT EXISTS (SELECT 1 FROM pg_policy
                      WHERE polrelid = ('public.' || t)::regclass);
  IF n_sem_policy > 0 THEN
    faltando := faltando || ' ' || n_sem_policy || ' tabela(s) com RLS ligada e ZERO policy;';
  END IF;

  IF faltando <> '' THEN
    RAISE EXCEPTION 'Aprendizagem do Time: convergência NÃO atingida —%', faltando;
  END IF;

  RAISE NOTICE 'Aprendizagem do Time: convergência verificada (colunas, índices, nullability, árbitro não-parcial, RLS e policies).';
END $$;

COMMENT ON TABLE public.capability_evidence IS 'Aprendizagem do Time — avaliação POR EVIDÊNCIA (compreensão/profundidade/aplicação), pré-agregação. Escrita exclusivamente pelo service client no pipeline de classificação. Colunas criterion_id/category/observed_at são do grão legado e estão em fase de expansão (nullable) até a migration de contração.';
COMMENT ON TABLE public.capability_assessments IS 'Aprendizagem do Time — maturidade agregada por aluno×capacidade, uma linha por TRANSIÇÃO (histórico completo, is_current marca a vigente).';
COMMENT ON INDEX public.capability_evidence_source_capability_uidx IS 'Árbitro do onConflict do PostgREST (source_table,source_id,capability_id). NÃO-PARCIAL de propósito: um índice parcial faz a inferência de árbitro falhar com 42P10, porque o PostgREST emite a lista de colunas sem o predicado.';

-- PostgREST mantém um cache do schema; sem isto, as colunas novas continuam
-- invisíveis para a aplicação mesmo depois do COMMIT.
NOTIFY pgrst, 'reload schema';

COMMIT;
