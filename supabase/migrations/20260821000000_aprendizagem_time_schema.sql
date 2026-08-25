-- ---------------------------------------------------------------------------
-- Aprendizagem do Time — schema genérico de capacidades curriculares.
-- ---------------------------------------------------------------------------
-- Fonte: eximia-analytics-specs/3-Especificacao-Aprendizagem-do-Time.txt
-- (fora deste repositório, ao lado dele — anexada pelo Senhor).
--
-- PRINCÍPIO CENTRAL (Regra 3 da spec): atividade não é aprendizagem. Nenhuma
-- destas tabelas lê ou infere de `sessions.status`/contagem de acesso — só de
-- evidência classificada (reflexão, quiz, cenário, atividade, sessão
-- socrática, evidência real, validação do gestor). Este é o domínio
-- "Aprendizagem do Time", complementar e SEPARADO do domínio "Ativação da
-- Jornada" já em produção — nenhuma tabela existente é alterada aqui.
--
-- DUAS CAMADAS, e a distinção é a espinha dorsal do modelo (Regra 4 da spec:
-- "Compreensão → Profundidade → Aplicação → Capacidade demonstrada"):
--   • capability_evidence      — avaliação POR EVIDÊNCIA INDIVIDUAL
--                                 (compreensão / profundidade 1-7 / aplicação)
--   • capability_assessments   — maturidade AGREGADA por aluno×capacidade,
--                                 com histórico completo de transição (§39)
--
-- LIÇÃO APLICADA (não repetir o erro de `semantic_analyses`, que não tem
-- CREATE TABLE commitado neste repo — ver comentário em
-- 20260703003114_fix_manager_privacy_gates.sql, linha 182: "foram perdidas na
-- primeira passada"): esta migration é a fonte ÚNICA e COMPLETA do schema,
-- sem depender de nenhuma migration futura para "completar" o CREATE TABLE.
--
-- ESCRITA: nenhuma destas tabelas tem policy de INSERT/UPDATE/DELETE para o
-- role autenticado. Toda escrita passa pelo client de SERVIÇO
-- (`createServiceClient()`), dentro do pipeline de classificação — mesmo
-- padrão já em produção para `semantic_analyses` (ver
-- api/analytics/semantic/route.ts). RLS aqui só governa LEITURA.
--
-- Helpers de RLS reusados tal-qual (já em produção, não recriados aqui):
-- `auth_tenant_id()` (20260207000000_initial_schema.sql), `has_role(uuid,
-- text)` e `is_super_admin()` (20260701030000_epic30_user_roles.sql /
-- 20260209000000_epic11_super_admin_whitelabel.sql).
-- ---------------------------------------------------------------------------

BEGIN;

-- ===========================================================================
-- 1. concepts — conceito curricular, ancorado a um módulo (chapter)
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
CREATE INDEX idx_concepts_course ON public.concepts (course_id);
CREATE INDEX idx_concepts_chapter ON public.concepts (chapter_id);

-- ===========================================================================
-- 2. capabilities — capacidade curricular, sempre ancorada a um curso
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, slug)
);
CREATE INDEX idx_capabilities_course ON public.capabilities (course_id);

-- ===========================================================================
-- 3. capability_concepts — join N:N — quais conceitos alimentam qual capacidade
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.capability_concepts (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  capability_id uuid NOT NULL REFERENCES public.capabilities(id) ON DELETE CASCADE,
  concept_id uuid NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,
  PRIMARY KEY (capability_id, concept_id)
);

-- ===========================================================================
-- 4. capability_criteria — critério OBSERVÁVEL fixo por capacidade (§28: "a
--    IA não pode inventar critério dinamicamente"). Fonte de verdade estática,
--    lida pelo prompt de classificação, nunca gerada em runtime.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.capability_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  capability_id uuid NOT NULL REFERENCES public.capabilities(id) ON DELETE CASCADE,
  code text NOT NULL,
  description text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (capability_id, code)
);
CREATE INDEX idx_capability_criteria_capability ON public.capability_criteria (capability_id);

-- ===========================================================================
-- 5. capability_evidence — avaliação POR EVIDÊNCIA (§6: compreensão,
--    profundidade 1-7, aplicação), ANTES de qualquer agregação em capacidade.
--
--    source_table/source_id são um ponteiro POLIMÓRFICO (sem FK entre
--    schemas): apontam para slide_reflections.id, quiz_attempts.id,
--    scenario_attempts.id, assignment_submissions.id, sessions.id, ou uma
--    tabela futura de evidência real/validação do gestor. Sem FK física
--    porque a origem varia de tabela; a integridade é responsabilidade do
--    pipeline que escreve (sempre via service client).
--
--    concept_id / capability_id: pelo menos um dos dois tem de estar
--    preenchido (CHECK abaixo). Cursos SEM `concepts` semeados ainda podem
--    ter evidência classificada diretamente contra `capability_id` — é o que
--    mantém o schema genérico (requisito do dono do produto: qualquer curso
--    pode ter capacidades, mesmo sem conceitos mapeados a módulo).
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.capability_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  concept_id uuid REFERENCES public.concepts(id) ON DELETE SET NULL,
  capability_id uuid REFERENCES public.capabilities(id) ON DELETE SET NULL,
  -- §30: A (cognitiva) / B (aplicação) / C (contexto real)
  evidence_category text NOT NULL CHECK (evidence_category IN ('cognitive', 'application', 'real_context')),
  source_type text NOT NULL CHECK (source_type IN (
    'reflection', 'quiz', 'scenario', 'assignment', 'socratic_session',
    'real_evidence', 'manager_validation'
  )),
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  -- §6.1
  comprehension text CHECK (comprehension IN ('evidenced', 'partial', 'not_evidenced')),
  -- §6.2 — nível 1-7, NUNCA convertido a percentual internamente (§19)
  depth_level smallint CHECK (depth_level BETWEEN 1 AND 7),
  -- §6.3
  application_level text CHECK (application_level IN ('not_evidenced', 'simulated', 'contextualized', 'applied_real')),
  confidence numeric(3,2) CHECK (confidence BETWEEN 0 AND 1),
  classification_model text NOT NULL DEFAULT 'heuristic-v1',
  -- sinais estruturados que embasaram a classificação (§40 explicabilidade)
  classification_signals jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- síntese estruturada, NUNCA o texto integral da reflexão/diálogo (§38 LGPD)
  classification_reasoning text,
  -- códigos de capability_criteria.code atendidos por ESTA evidência
  criteria_met text[] NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL,
  classified_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT capability_evidence_target_chk CHECK (concept_id IS NOT NULL OR capability_id IS NOT NULL)
);

-- Idempotência: a mesma interação de origem não gera duas classificações para
-- o mesmo alvo (concept OU capability). Dois índices PARCIAIS em vez de um
-- único com COALESCE: o upsert do PostgREST (`onConflict`) precisa de um
-- alvo de colunas reais, e um índice com expressão COALESCE não serve como
-- alvo de ON CONFLICT — a maioria das linhas desta entrega tem capability_id
-- sempre preenchido (concept_id fica para quando houver mapeamento fino de
-- módulo→conceito), então o índice de capability é o caminho quente.
CREATE UNIQUE INDEX capability_evidence_source_capability_uidx
  ON public.capability_evidence (source_table, source_id, capability_id)
  WHERE capability_id IS NOT NULL;
CREATE UNIQUE INDEX capability_evidence_source_concept_uidx
  ON public.capability_evidence (source_table, source_id, concept_id)
  WHERE concept_id IS NOT NULL AND capability_id IS NULL;
CREATE INDEX idx_capability_evidence_student_capability ON public.capability_evidence (tenant_id, student_id, capability_id);
CREATE INDEX idx_capability_evidence_student_concept ON public.capability_evidence (tenant_id, student_id, concept_id);
CREATE INDEX idx_capability_evidence_course_time ON public.capability_evidence (tenant_id, course_id, occurred_at);
CREATE INDEX idx_capability_evidence_category ON public.capability_evidence (tenant_id, capability_id, evidence_category);

-- ===========================================================================
-- 6. capability_assessments — maturidade AGREGADA (§29), uma linha POR
--    TRANSIÇÃO (nunca UPDATE in place — §39 exige estado anterior/novo/
--    timestamp/evidências consideradas, auditável).
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.capability_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  capability_id uuid NOT NULL REFERENCES public.capabilities(id) ON DELETE CASCADE,
  previous_state text CHECK (previous_state IN ('not_evidenced', 'emerging', 'developing', 'demonstrated')),
  new_state text NOT NULL CHECK (new_state IN ('not_evidenced', 'emerging', 'developing', 'demonstrated')),
  -- subconjunto de {'cognitive','application','real_context'} presente nesta avaliação
  categories_present text[] NOT NULL DEFAULT '{}',
  -- §30: A+B ou A+C (regra MVP)
  triangulation_met boolean NOT NULL DEFAULT false,
  -- explicabilidade §40 — texto gerado pelo pipeline, nunca cru do aluno
  rationale text NOT NULL,
  classification_model text NOT NULL DEFAULT 'heuristic-v1',
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- No máximo UMA linha "corrente" por aluno×capacidade — leitura O(1) do estado
-- atual sem agregação, e a unicidade é o que torna "is_current" confiável.
CREATE UNIQUE INDEX capability_assessments_current_uidx
  ON public.capability_assessments (tenant_id, student_id, capability_id)
  WHERE is_current;
CREATE INDEX idx_capability_assessments_history ON public.capability_assessments (tenant_id, student_id, capability_id, created_at);

-- ===========================================================================
-- 7. capability_assessment_evidence — quais capability_evidence.id embasaram
--    ESTA avaliação (§39 "evidências consideradas", §34 drill-down)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.capability_assessment_evidence (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL REFERENCES public.capability_assessments(id) ON DELETE CASCADE,
  evidence_id uuid NOT NULL REFERENCES public.capability_evidence(id) ON DELETE CASCADE,
  PRIMARY KEY (assessment_id, evidence_id)
);
CREATE INDEX idx_cae_evidence ON public.capability_assessment_evidence (evidence_id);

-- ===========================================================================
-- 8. capability_assessment_criteria — quais critérios foram/não foram
--    atendidos NESTA avaliação (§34 "evidenciado" / "ainda não evidenciado")
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.capability_assessment_criteria (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL REFERENCES public.capability_assessments(id) ON DELETE CASCADE,
  criterion_id uuid NOT NULL REFERENCES public.capability_criteria(id) ON DELETE CASCADE,
  met boolean NOT NULL,
  PRIMARY KEY (assessment_id, criterion_id)
);

-- ===========================================================================
-- RLS — leitura. Espelha o padrão de fix-manager-privacy-gates
-- (20260703003114_fix_manager_privacy_gates.sql): conteúdo INDIVIDUAL
-- classificado é instructor/admin/super_admin (has_role) OU o próprio aluno.
-- MANAGER NÃO tem policy nestas duas tabelas de propósito — o gestor só lê
-- via client de SERVIÇO dentro da camada de leitura RSC
-- (`lib/analytics/aprendizagem-time`), que já aplica o escopo de equipe
-- resolvido por `resolverRecorteDaTrinca`. Isso é a MESMA lição que motivou
-- o fix de 2026-07-03 em consciousness_responses/semantic_analyses.
--
-- Tabelas de CURRÍCULO (concepts, capabilities, capability_concepts,
-- capability_criteria) são de leitura ampla no tenant — mesma régua de
-- courses_select/chapters (metadado pedagógico, não dado pessoal).
-- ===========================================================================

ALTER TABLE public.concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_assessment_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_assessment_criteria ENABLE ROW LEVEL SECURITY;

-- concepts
CREATE POLICY concepts_tenant_select ON public.concepts
  FOR SELECT USING (tenant_id = auth_tenant_id());
CREATE POLICY concepts_content_role_write ON public.concepts
  FOR ALL USING (
    tenant_id = auth_tenant_id()
    AND (has_role(auth.uid(), 'instructor') OR has_role(auth.uid(), 'admin') OR is_super_admin())
  )
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND (has_role(auth.uid(), 'instructor') OR has_role(auth.uid(), 'admin') OR is_super_admin())
  );

-- capabilities
CREATE POLICY capabilities_tenant_select ON public.capabilities
  FOR SELECT USING (tenant_id = auth_tenant_id());
CREATE POLICY capabilities_content_role_write ON public.capabilities
  FOR ALL USING (
    tenant_id = auth_tenant_id()
    AND (has_role(auth.uid(), 'instructor') OR has_role(auth.uid(), 'admin') OR is_super_admin())
  )
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND (has_role(auth.uid(), 'instructor') OR has_role(auth.uid(), 'admin') OR is_super_admin())
  );

-- capability_concepts
CREATE POLICY capability_concepts_tenant_select ON public.capability_concepts
  FOR SELECT USING (tenant_id = auth_tenant_id());
CREATE POLICY capability_concepts_content_role_write ON public.capability_concepts
  FOR ALL USING (
    tenant_id = auth_tenant_id()
    AND (has_role(auth.uid(), 'instructor') OR has_role(auth.uid(), 'admin') OR is_super_admin())
  )
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND (has_role(auth.uid(), 'instructor') OR has_role(auth.uid(), 'admin') OR is_super_admin())
  );

-- capability_criteria
CREATE POLICY capability_criteria_tenant_select ON public.capability_criteria
  FOR SELECT USING (tenant_id = auth_tenant_id());
CREATE POLICY capability_criteria_content_role_write ON public.capability_criteria
  FOR ALL USING (
    tenant_id = auth_tenant_id()
    AND (has_role(auth.uid(), 'instructor') OR has_role(auth.uid(), 'admin') OR is_super_admin())
  )
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND (has_role(auth.uid(), 'instructor') OR has_role(auth.uid(), 'admin') OR is_super_admin())
  );

-- capability_evidence — só leitura: própria (aluno) OU content-role.
-- Sem policy de INSERT/UPDATE/DELETE: escreve exclusivamente o service client.
CREATE POLICY ce_own_select ON public.capability_evidence
  FOR SELECT USING (tenant_id = auth_tenant_id() AND student_id = auth.uid());
CREATE POLICY ce_content_role_select ON public.capability_evidence
  FOR SELECT USING (
    tenant_id = auth_tenant_id()
    AND (has_role(auth.uid(), 'instructor') OR has_role(auth.uid(), 'admin') OR is_super_admin())
  );

-- capability_assessments — mesma régua.
CREATE POLICY ca_own_select ON public.capability_assessments
  FOR SELECT USING (tenant_id = auth_tenant_id() AND student_id = auth.uid());
CREATE POLICY ca_content_role_select ON public.capability_assessments
  FOR SELECT USING (
    tenant_id = auth_tenant_id()
    AND (has_role(auth.uid(), 'instructor') OR has_role(auth.uid(), 'admin') OR is_super_admin())
  );

-- capability_assessment_evidence / capability_assessment_criteria — só staff
-- (drill-down granular não é consumido por aluno nesta fase do produto).
CREATE POLICY cae_content_role_select ON public.capability_assessment_evidence
  FOR SELECT USING (
    tenant_id = auth_tenant_id()
    AND (has_role(auth.uid(), 'instructor') OR has_role(auth.uid(), 'admin') OR is_super_admin())
  );
CREATE POLICY cac_content_role_select ON public.capability_assessment_criteria
  FOR SELECT USING (
    tenant_id = auth_tenant_id()
    AND (has_role(auth.uid(), 'instructor') OR has_role(auth.uid(), 'admin') OR is_super_admin())
  );

COMMENT ON TABLE public.capability_evidence IS 'Aprendizagem do Time — avaliação POR EVIDÊNCIA (compreensão/profundidade/aplicação), pré-agregação. Nunca escrita pelo client autenticado — sempre via service client no pipeline de classificação.';
COMMENT ON TABLE public.capability_assessments IS 'Aprendizagem do Time — maturidade agregada por aluno×capacidade, uma linha por TRANSIÇÃO (histórico completo, is_current marca a vigente). §39 da spec.';

COMMIT;
