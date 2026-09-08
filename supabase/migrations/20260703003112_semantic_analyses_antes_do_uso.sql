-- =============================================================================
-- semantic_analyses — criada ANTES do primeiro uso (replay do zero)
-- =============================================================================
--
-- POR QUE ESTA MIGRATION EXISTE
--   `20260703003114_fix_manager_privacy_gates.sql` faz DROP POLICY / CREATE POLICY
--   em `public.semantic_analyses`. A tabela nasceu na branch `feat/semantic-analysis`
--   (nunca mergeada) e foi criada a mao em producao; so entrou no git em
--   `20260905120000_equivalencia_git_producao_colunas_gatilhos_tabelas.sql`,
--   dois meses depois do uso. Num banco novo o replay parava aqui com
--   `42P01: relation "public.semantic_analyses" does not exist` (DROP POLICY IF
--   EXISTS cobre a policy, nao a tabela). Descoberto no primeiro `supabase db push`
--   real, projeto `eximia-academy-multi`, 2026-09-08.
--
-- O QUE FAZ
--   Cria a tabela com a DEFINICAO IDENTICA a de 20260905120000 (que continua
--   sendo a dona canonica: indices, RLS e policy ficam la). Guardada por
--   `to_regclass`, e no-op em producao e em qualquer banco onde ja exista.
-- =============================================================================

DO $$ BEGIN
  IF to_regclass('public.semantic_analyses') IS NULL THEN
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
  END IF;
END $$;
