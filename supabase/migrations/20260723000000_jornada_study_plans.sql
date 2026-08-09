-- =============================================================================
-- EPIC-JORNADA — study_plans: a Jornada persistida ("Meu plano de estudos")
-- =============================================================================
-- STATUS: ESCRITA, NÃO APLICADA. Nenhum agente rodou esta migration. O banco do
-- .env.local (deploy/cory) é PRODUÇÃO COMPARTILHADA — aplicar exige GO explícito
-- do Hugo, idealmente contra staging primeiro (EPIC-JORNADA, Decisão 2 / R1).
--
-- Evolui o design de docs/architecture/meu-plano-arquitetura-implementacao.md §5:
-- guarda o modelo da DEMO aprovada — duração POR MÓDULO (module_durations),
-- preferências (auto-ajuste + unidade semanas/dias) e preset — não só o ritmo
-- semanal do design original. RLS reusa integralmente o desenho do @data-engineer
-- (doc §5/§6.2): student read/write por auth.uid()+auth_tenant_id(), INSERT com
-- EXISTS provando integridade da enrollment, staff read-only, super_admin bypass,
-- sem DELETE humano, 1 jornada ativa por enrollment.
--
-- Após aplicar (fora do escopo desta fase): regenerar
-- packages/database/src/types/supabase.ts (mesmo processo de chapter_slides).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- courses: coluna "Meta do gestor" (nível curso). deadline_days já existe no
-- banco (20260405000000_teaching_plan.sql); manter idempotente por segurança.
-- -----------------------------------------------------------------------------
ALTER TABLE courses ADD COLUMN IF NOT EXISTS deadline_days INTEGER;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS manager_deadline_days INTEGER;

COMMENT ON COLUMN courses.manager_deadline_days IS
  'Meta do gestor (EPIC-JORNADA): dias recomendados para conclusão, < deadline_days. NULL = sem meta. Quem escreve é decisão futura do produto (Decisão 3).';

-- -----------------------------------------------------------------------------
-- study_plans
-- -----------------------------------------------------------------------------
CREATE TABLE study_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'paused')),
  module_durations JSONB NOT NULL,
  preset REAL,
  preferences JSONB NOT NULL DEFAULT '{"cascade": true, "unit": "w"}'::jsonb,
  start_date DATE NOT NULL,
  final_deadline_date DATE,
  manager_deadline_date DATE,
  recalculated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE study_plans IS 'A Jornada persistida do aluno (EPIC-JORNADA). Uma ativa por enrollment. Histórico NÃO versionado em v1 — recálculo/revisão MUTA a linha ativa.';
COMMENT ON COLUMN study_plans.module_durations IS 'int[] dias por módulo, ordenado por chapter.order, min 4, soma clampada ao teto duro (fitToDeadline).';
COMMENT ON COLUMN study_plans.preferences IS '{days:boolean...} -> aqui: {cascade:boolean (Auto-ajuste), unit:"w"|"d"} (SPEC rounds 6/12).';

-- 1 jornada ativa por enrollment
CREATE UNIQUE INDEX idx_study_plans_one_active ON study_plans(enrollment_id) WHERE status = 'active';
CREATE INDEX idx_study_plans_student_tenant ON study_plans(student_id, tenant_id);
CREATE INDEX idx_study_plans_tenant ON study_plans(tenant_id);

-- updated_at trigger (mesmo padrão das tabelas do repo)
CREATE OR REPLACE FUNCTION set_study_plans_updated_at_fn()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_study_plans_updated_at
  BEFORE UPDATE ON study_plans
  FOR EACH ROW
  EXECUTE FUNCTION set_study_plans_updated_at_fn();

-- -----------------------------------------------------------------------------
-- Row Level Security (desenhada pelo @data-engineer real — doc §5/§6.2)
-- -----------------------------------------------------------------------------
ALTER TABLE study_plans ENABLE ROW LEVEL SECURITY;

-- super_admin cross-tenant bypass
CREATE POLICY "sp_super_admin" ON study_plans FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- student: lê a própria jornada
CREATE POLICY "sp_student_select" ON study_plans FOR SELECT
  USING (
    student_id = auth.uid()
    AND tenant_id = auth_tenant_id()
  );

-- student: cria a própria jornada, com EXISTS provando que enrollment_id/
-- course_id pertencem de fato a este student_id+tenant_id (fecha o gap de
-- integridade referencial das 4 chaves denormalizadas — variante B do doc §6.2).
CREATE POLICY "sp_student_insert" ON study_plans FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
    AND tenant_id = auth_tenant_id()
    AND auth_user_role() = 'student'
    AND EXISTS (
      SELECT 1 FROM enrollments e
      WHERE e.id = study_plans.enrollment_id
        AND e.student_id = study_plans.student_id
        AND e.course_id = study_plans.course_id
        AND e.tenant_id = study_plans.tenant_id
    )
  );

-- student: atualiza a própria jornada
CREATE POLICY "sp_student_update" ON study_plans FOR UPDATE
  USING (
    student_id = auth.uid()
    AND tenant_id = auth_tenant_id()
  )
  WITH CHECK (
    student_id = auth.uid()
    AND tenant_id = auth_tenant_id()
  );

-- instrutor/manager/admin: SÓ LEITURA (coaching/observação). Recalcular em nome
-- do aluno, se for necessário, é uma RPC SECURITY DEFINER dedicada — nunca uma
-- policy de escrita ampla (decisão do @data-engineer, doc §6.2 pergunta 1).
CREATE POLICY "sp_content_role_select" ON study_plans FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('instructor', 'manager', 'admin')
  );

-- Sem policy de DELETE para humanos por design: "parar" é status → 'paused'/
-- 'completed' (soft). Hard delete só via CASCADE ou super_admin.

COMMIT;
