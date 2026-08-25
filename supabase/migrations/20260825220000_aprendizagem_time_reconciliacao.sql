-- ===========================================================================
-- RECONCILIAÇÃO — Aprendizagem do Time contra o schema que JÁ EXISTE
-- ===========================================================================
-- POR QUE ESTA MIGRATION EXISTE (2026-08-25).
--
-- `20260821000000_aprendizagem_time_schema.sql` foi escrita supondo terreno
-- vazio: `CREATE TABLE IF NOT EXISTS` para 8 tabelas novas. O terreno NÃO
-- estava vazio. Três dessas tabelas já existiam em produção, com outro formato
-- e com dado vivo dentro:
--
--   capabilities         15 linhas   code / name  / "order"        (sem title/slug)
--   capability_criteria  63 linhas
--   capability_evidence  853 linhas  category / observed_at        (sem os níveis)
--
-- Só em cory-alimentos, o tenant que está no ar, são 764 evidências.
--
-- `IF NOT EXISTS` contra terreno ocupado NÃO PROTEGE, apenas CALA: pularia as
-- três em silêncio, e a tela quebraria em runtime pedindo `capabilities.title`
-- — que foi exatamente o erro visto em produção às 18:57. Recriar com DROP
-- levaria as 853 evidências junto. Esta migration é a terceira via: ADITIVA,
-- sem um único DROP, sem um único DELETE.
--
-- O QUE ELA FAZ
--   1. Adiciona às 3 tabelas existentes as colunas que a camada de leitura pede,
--      e as PREENCHE a partir das colunas equivalentes que já existem.
--   2. Cria as 5 tabelas que de fato faltam.
--   3. Liga a RLS das tabelas novas, no mesmo desenho da migration original.
--
-- O QUE ELA NÃO FAZ, E É PROPOSITAL
--   Os níveis (`comprehension`, `depth_level`, `application_level`) NÃO têm
--   equivalente no schema antigo — o dado não existe em lugar nenhum, e
--   inventá-lo seria pior que a ausência. Eles nascem NULL, e as telas passam
--   do ERRO ("column does not exist") para o VAZIO HONESTO ("amostra ainda
--   insuficiente"). Quem os preenche é o pipeline de classificação, rodando
--   sobre as evidências que já estão lá. Isso é um passo separado e deliberado.
--
-- IDEMPOTENTE: `IF NOT EXISTS` em toda coluna e tabela, e todo UPDATE é
-- guardado por `WHERE ... IS NULL`. Rodar duas vezes não muda nada na segunda.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. capabilities — o código lê title/slug/is_active/display_order
-- ---------------------------------------------------------------------------
ALTER TABLE public.capabilities
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS display_order integer,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- `code` usa underscore (`clareza_fenomeno`), `slug` da migration original usa
-- hífen (`clareza-do-fenomeno`). A conversão mecânica não reproduz o slug
-- literal do seed, e não precisa: o slug só existe para ser chave estável por
-- curso. O que o gestor LÊ é o title, e esse vem de `name`, intacto.
UPDATE public.capabilities
   SET slug = replace(code, '_', '-')
 WHERE slug IS NULL;

UPDATE public.capabilities
   SET title = name
 WHERE title IS NULL;

UPDATE public.capabilities
   SET display_order = "order"
 WHERE display_order IS NULL;

-- A unicidade que o seed original pressupõe (`ON CONFLICT (course_id, slug)`).
CREATE UNIQUE INDEX IF NOT EXISTS capabilities_course_slug_uidx
  ON public.capabilities (course_id, slug);

-- ---------------------------------------------------------------------------
-- 2. capability_criteria — o pipeline lê display_order/is_active
-- ---------------------------------------------------------------------------
ALTER TABLE public.capability_criteria
  ADD COLUMN IF NOT EXISTS display_order integer,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

UPDATE public.capability_criteria
   SET display_order = "order"
 WHERE display_order IS NULL;

-- ---------------------------------------------------------------------------
-- 3. capability_evidence — o coração da leitura das 3 telas
-- ---------------------------------------------------------------------------
-- Sem CHECK nas colunas de nível: elas nascem NULL para as 853 linhas antigas,
-- e um CHECK NOT NULL derrubaria a migration na primeira linha. A validação de
-- domínio dos valores fica no pipeline que escreve, que é service-client-only.
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

-- As duas traduções PT→EN. Os valores em produção hoje são exatamente
-- `category='cognitiva'` e `source_type IN ('reflexao','socratica')` — medidos,
-- não supostos. Qualquer valor futuro que não esteja nesta lista fica NULL de
-- propósito: ausência é honesta, chute não é (invariante I-4).
UPDATE public.capability_evidence
   SET evidence_category = CASE category
     WHEN 'cognitiva'   THEN 'cognitive'
     WHEN 'aplicacao'   THEN 'application'
     WHEN 'contexto_real' THEN 'real_context'
     ELSE NULL
   END
 WHERE evidence_category IS NULL;

UPDATE public.capability_evidence
   SET source_table = CASE source_type
     WHEN 'reflexao'  THEN 'slide_reflections'
     WHEN 'socratica' THEN 'sessions'
     ELSE NULL
   END
 WHERE source_table IS NULL;

-- `observed_at` e `occurred_at` são a MESMA grandeza com dois nomes: quando a
-- evidência aconteceu. Nada se perde na cópia.
UPDATE public.capability_evidence
   SET occurred_at = observed_at
 WHERE occurred_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_capability_evidence_student_capability
  ON public.capability_evidence (tenant_id, student_id, capability_id);
CREATE INDEX IF NOT EXISTS idx_capability_evidence_course_time
  ON public.capability_evidence (tenant_id, course_id, occurred_at);

-- ---------------------------------------------------------------------------
-- 4. concepts — ausente de verdade
-- ---------------------------------------------------------------------------
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
CREATE INDEX IF NOT EXISTS idx_concepts_course ON public.concepts (course_id);

-- A FK de `capability_evidence.concept_id` só pode existir depois de `concepts`.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'capability_evidence_concept_fk'
  ) THEN
    ALTER TABLE public.capability_evidence
      ADD CONSTRAINT capability_evidence_concept_fk
      FOREIGN KEY (concept_id) REFERENCES public.concepts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. capability_concepts — join N:N
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.capability_concepts (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  capability_id uuid NOT NULL REFERENCES public.capabilities(id) ON DELETE CASCADE,
  concept_id uuid NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,
  PRIMARY KEY (capability_id, concept_id)
);

-- ---------------------------------------------------------------------------
-- 6. capability_assessments — maturidade AGREGADA aluno×capacidade
-- ---------------------------------------------------------------------------
-- Nunca sofre UPDATE: cada transição é uma linha nova, e `is_current` marca a
-- corrente. É o que preserva histórico para a coluna "evolução" das telas.
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

CREATE UNIQUE INDEX IF NOT EXISTS capability_assessments_current_uidx
  ON public.capability_assessments (student_id, capability_id)
  WHERE is_current;
CREATE INDEX IF NOT EXISTS idx_capability_assessments_tenant_capability
  ON public.capability_assessments (tenant_id, capability_id);

-- ---------------------------------------------------------------------------
-- 7. as duas tabelas de rastro da avaliação
-- ---------------------------------------------------------------------------
-- `tenant_id` NÃO é redundante aqui: as policies de leitura filtram por
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

-- ---------------------------------------------------------------------------
-- 8. RLS — mesmo desenho da migration original
-- ---------------------------------------------------------------------------
-- Currículo: leitura ampla no tenant. Avaliação: o próprio aluno, ou quem tem
-- chapéu de instructor/admin/super_admin. DE PROPÓSITO não há policy para
-- `manager`: o gestor lê pelo service client, dentro da camada de Analytics,
-- nunca direto do client autenticado (mesma lição de
-- 20260703003114_fix_manager_privacy_gates.sql). Nenhuma policy de escrita:
-- só o service client escreve.
--
-- Os predicados usam os helpers DA CASA (`auth_tenant_id()`, `has_role()`,
-- `is_super_admin()`), copiados verbatim da migration original. Escrever um
-- predicado equivalente à mão aqui criaria uma segunda definição de "quem pode
-- ler", e duas definições divergem no dia em que uma delas mudar.
ALTER TABLE public.concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_assessment_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_assessment_criteria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS concepts_tenant_select ON public.concepts;
CREATE POLICY concepts_tenant_select ON public.concepts
  FOR SELECT USING (tenant_id = auth_tenant_id());

DROP POLICY IF EXISTS capability_concepts_tenant_select ON public.capability_concepts;
CREATE POLICY capability_concepts_tenant_select ON public.capability_concepts
  FOR SELECT USING (tenant_id = auth_tenant_id());

DROP POLICY IF EXISTS ca_own_select ON public.capability_assessments;
CREATE POLICY ca_own_select ON public.capability_assessments
  FOR SELECT USING (tenant_id = auth_tenant_id() AND student_id = auth.uid());

DROP POLICY IF EXISTS ca_content_role_select ON public.capability_assessments;
CREATE POLICY ca_content_role_select ON public.capability_assessments
  FOR SELECT USING (
    tenant_id = auth_tenant_id()
    AND (has_role(auth.uid(), 'instructor') OR has_role(auth.uid(), 'admin') OR is_super_admin())
  );

DROP POLICY IF EXISTS cae_content_role_select ON public.capability_assessment_evidence;
CREATE POLICY cae_content_role_select ON public.capability_assessment_evidence
  FOR SELECT USING (
    tenant_id = auth_tenant_id()
    AND (has_role(auth.uid(), 'instructor') OR has_role(auth.uid(), 'admin') OR is_super_admin())
  );

DROP POLICY IF EXISTS cac_content_role_select ON public.capability_assessment_criteria;
CREATE POLICY cac_content_role_select ON public.capability_assessment_criteria
  FOR SELECT USING (
    tenant_id = auth_tenant_id()
    AND (has_role(auth.uid(), 'instructor') OR has_role(auth.uid(), 'admin') OR is_super_admin())
  );
