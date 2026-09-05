// Harness de teste da migration de convergência — Aprendizagem do Time.
// Roda contra PGlite (PostgreSQL real compilado para WASM), NUNCA contra produção.
//
// Dois cenários:
//   A) TERRENO OCUPADO — réplica do schema vivo de produção (DDL derivado das
//      consultas de leitura: colunas, constraints, índices e policies medidos),
//      com dado dentro. Prova que a migration converge sem perder linha.
//   B) TERRENO VIRGEM  — só as tabelas-pai. Prova que a migration levanta o
//      schema do zero.
//
// Em ambos: aplica a migration, roda o upsert EXATO do pipeline
// (`classificador/index.ts:51-76`, as 19 chaves), e reaplica a migration para
// provar idempotência.

import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"

const MIGRATION = readFileSync(
  "/Users/hugocapitelli/Dev/eximia/eximia-academy-v2/supabase/migrations/20260828120000_aprendizagem_time_convergencia.sql",
  "utf8",
)

const falhas = []
const ok = (cond, msg) => {
  console.log(`  ${cond ? "PASS" : "FALHA"}  ${msg}`)
  if (!cond) falhas.push(msg)
}

// --- andaime comum: tabelas-pai e helpers de RLS que o produto já tem -------
const BASE = `
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE public.tenants  (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text);
CREATE TABLE public.courses  (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE, title text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.chapters (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE);
CREATE TABLE public.users    (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $fn$ SELECT NULL::uuid $fn$;
CREATE FUNCTION public.auth_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $fn$ SELECT NULL::uuid $fn$;
CREATE FUNCTION public.auth_user_role() RETURNS text LANGUAGE sql STABLE AS $fn$ SELECT NULL::text $fn$;
CREATE FUNCTION public.is_super_admin() RETURNS boolean LANGUAGE sql STABLE AS $fn$ SELECT false $fn$;
`

// --- réplica do terreno OCUPADO (schema vivo, medido em produção) ----------
const TERRENO_OCUPADO = `
CREATE TABLE public.capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  focus_text text NOT NULL,
  "order" integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, code)
);
CREATE INDEX idx_capabilities_tenant_course ON public.capabilities (tenant_id, course_id);

CREATE TABLE public.capability_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_id uuid NOT NULL REFERENCES public.capabilities(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  description text NOT NULL,
  weight numeric NOT NULL DEFAULT 1,
  "order" integer NOT NULL DEFAULT 0,
  UNIQUE (capability_id, code)
);
CREATE INDEX idx_capability_criteria_capability ON public.capability_criteria (capability_id);
CREATE INDEX idx_capability_criteria_tenant ON public.capability_criteria (tenant_id);

CREATE TABLE public.capability_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  capability_id uuid NOT NULL REFERENCES public.capabilities(id) ON DELETE CASCADE,
  criterion_id uuid NOT NULL REFERENCES public.capability_criteria(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  chapter_id uuid REFERENCES public.chapters(id) ON DELETE SET NULL,
  category text NOT NULL CHECK (category = ANY (ARRAY['cognitiva','aplicada','real'])),
  source_type text NOT NULL CHECK (source_type = ANY (ARRAY['reflexao','socratica','quiz','atividade','aplicacao_real'])),
  source_id uuid,
  observed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_capability_evidence_capability_criterion ON public.capability_evidence (capability_id, criterion_id);
CREATE INDEX idx_capability_evidence_student_course_observed ON public.capability_evidence (student_id, course_id, observed_at);
CREATE INDEX idx_capability_evidence_tenant ON public.capability_evidence (tenant_id);

ALTER TABLE public.capabilities        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY cap_tenant_select ON public.capabilities FOR SELECT USING (tenant_id = auth_tenant_id());
CREATE POLICY cap_staff_write ON public.capabilities FOR ALL
  USING (tenant_id = auth_tenant_id() AND auth_user_role() = ANY (ARRAY['instructor','manager','admin']))
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_user_role() = ANY (ARRAY['instructor','manager','admin']));
CREATE POLICY cap_super_admin ON public.capabilities FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY capcrit_tenant_select ON public.capability_criteria FOR SELECT USING (tenant_id = auth_tenant_id());
CREATE POLICY capcrit_staff_write ON public.capability_criteria FOR ALL
  USING (tenant_id = auth_tenant_id() AND auth_user_role() = ANY (ARRAY['instructor','manager','admin']))
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_user_role() = ANY (ARRAY['instructor','manager','admin']));
CREATE POLICY capcrit_super_admin ON public.capability_criteria FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY capev_student_select ON public.capability_evidence FOR SELECT USING (student_id = auth.uid() AND tenant_id = auth_tenant_id());
CREATE POLICY capev_staff_select ON public.capability_evidence FOR SELECT
  USING (tenant_id = auth_tenant_id() AND auth_user_role() = ANY (ARRAY['instructor','manager','admin']));
CREATE POLICY capev_staff_insert ON public.capability_evidence FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_user_role() = ANY (ARRAY['instructor','manager','admin']));
CREATE POLICY capev_super_admin ON public.capability_evidence FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
`

// Dado vivo, no formato e vocabulário reais medidos em produção.
const DADO_LEGADO = `
INSERT INTO public.tenants (id, slug) VALUES ('11111111-1111-1111-1111-111111111111','cory');
INSERT INTO public.courses (id, tenant_id, title) VALUES ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','Análise e Solução de Problemas');
INSERT INTO public.chapters (id, course_id) VALUES ('33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222');
INSERT INTO public.users (id, tenant_id) VALUES
  ('44444444-4444-4444-4444-444444444444','11111111-1111-1111-1111-111111111111'),
  ('55555555-5555-5555-5555-555555555555','11111111-1111-1111-1111-111111111111');

INSERT INTO public.capabilities (tenant_id, course_id, code, name, description, focus_text, "order") VALUES
  ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','clareza_fenomeno','Clareza do fenômeno','desc','foco',0),
  ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','pensamento_causal','Pensamento causal','desc','foco',1),
  ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','uso_evidencia','Uso de evidência','desc','foco',2),
  ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','construcao_contramedida','Construção de contramedida','desc','foco',3),
  ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','verificacao_eficacia','Verificação de eficácia','desc','foco',4);

INSERT INTO public.capability_criteria (tenant_id, capability_id, code, description, "order")
  SELECT tenant_id, id, 'X-1', 'critério legado', 0 FROM public.capabilities;

-- Grão legado: uma linha por (source, capacidade, critério). Vocabulário PT.
INSERT INTO public.capability_evidence (tenant_id, student_id, capability_id, criterion_id, course_id, chapter_id, category, source_type, source_id, observed_at)
  SELECT cap.tenant_id, u.id, cap.id, cr.id, cap.course_id, '33333333-3333-3333-3333-333333333333',
         'cognitiva',
         CASE WHEN cap."order" % 2 = 0 THEN 'reflexao' ELSE 'socratica' END,
         gen_random_uuid(), now() - interval '30 days'
    FROM public.capabilities cap
    JOIN public.capability_criteria cr ON cr.capability_id = cap.id
    CROSS JOIN public.users u;
`

// O upsert EXATO do pipeline: as 19 chaves de classificador/index.ts:51-76,
// com o árbitro (source_table, source_id, capability_id).
const UPSERT_PIPELINE = `
INSERT INTO public.capability_evidence (
  tenant_id, student_id, course_id, concept_id, capability_id,
  evidence_category, source_type, source_table, source_id,
  comprehension, depth_level, application_level, confidence,
  classification_model, classification_signals, classification_reasoning,
  criteria_met, occurred_at, classified_at
) VALUES (
  $1, $2, $3, NULL, $4,
  'cognitive', 'reflection', 'slide_reflections', $5,
  'evidenced', 5, 'contextualized', 0.80,
  'heuristic-v1', '{"wordCount":120}'::jsonb, 'síntese estruturada',
  ARRAY['UE-1','UE-2'], now(), now()
)
ON CONFLICT (source_table, source_id, capability_id) DO UPDATE SET
  comprehension = EXCLUDED.comprehension,
  depth_level = EXCLUDED.depth_level,
  application_level = EXCLUDED.application_level,
  confidence = EXCLUDED.confidence,
  classification_model = EXCLUDED.classification_model,
  classification_reasoning = EXCLUDED.classification_reasoning,
  criteria_met = EXCLUDED.criteria_met,
  classified_at = EXCLUDED.classified_at
`

async function rodarCenario(nome, preparo, comDado) {
  console.log(`\n${"=".repeat(72)}\nCENÁRIO: ${nome}\n${"=".repeat(72)}`)
  const db = await PGlite.create()
  await db.exec(BASE)
  if (preparo) await db.exec(preparo)
  if (comDado) await db.exec(DADO_LEGADO)

  const antes = comDado
    ? (await db.query("SELECT count(*)::int AS n FROM public.capability_evidence")).rows[0].n
    : 0
  const capsAntes = comDado
    ? (await db.query("SELECT count(*)::int AS n FROM public.capabilities")).rows[0].n
    : 0
  if (comDado) console.log(`  (terreno inicial: ${antes} evidências, ${capsAntes} capacidades)`)

  // ---- aplicação da migration ---------------------------------------------
  try {
    await db.exec(MIGRATION)
    ok(true, "migration aplicou sem erro")
  } catch (e) {
    ok(false, `migration FALHOU: ${e.message}`)
    await db.close()
    return
  }

  // ---- preservação de dado -------------------------------------------------
  if (comDado) {
    const depois = (await db.query("SELECT count(*)::int AS n FROM public.capability_evidence")).rows[0].n
    ok(depois === antes, `evidências preservadas (${antes} → ${depois})`)
    const capsDepois = (await db.query("SELECT count(*)::int AS n FROM public.capabilities")).rows[0].n
    ok(capsDepois === capsAntes, `capacidades preservadas, sem duplicar (${capsAntes} → ${capsDepois})`)

    const slugs = (await db.query(
      "SELECT code, slug, title, display_order FROM public.capabilities ORDER BY display_order",
    )).rows
    const esperado = {
      clareza_fenomeno: "clareza-do-fenomeno",
      pensamento_causal: "pensamento-causal",
      uso_evidencia: "uso-de-evidencia",
      construcao_contramedida: "construcao-de-contramedida",
      verificacao_eficacia: "verificacao-de-eficacia",
    }
    ok(
      slugs.every((r) => r.slug === esperado[r.code]),
      `slug backfilled com o mapa explícito (${slugs.map((r) => r.slug).join(", ")})`,
    )
    ok(slugs.every((r) => r.title !== null), "title backfilled a partir de name")

    const trad = (await db.query(
      "SELECT count(*) FILTER (WHERE evidence_category='cognitive')::int AS c, count(*) FILTER (WHERE source_table IS NOT NULL)::int AS st, count(*) FILTER (WHERE occurred_at IS NOT NULL)::int AS oc FROM public.capability_evidence",
    )).rows[0]
    ok(trad.c === antes, `category 'cognitiva' → evidence_category 'cognitive' em ${trad.c}/${antes}`)
    ok(trad.st === antes, `source_type → source_table em ${trad.st}/${antes}`)
    ok(trad.oc === antes, `observed_at → occurred_at em ${trad.oc}/${antes}`)
  }

  // ---- estrutura convergida ------------------------------------------------
  const tabelas = (await db.query(`
    SELECT count(*)::int AS n FROM information_schema.tables
     WHERE table_schema='public' AND table_name IN
       ('concepts','capabilities','capability_concepts','capability_criteria',
        'capability_evidence','capability_assessments',
        'capability_assessment_evidence','capability_assessment_criteria')`)).rows[0].n
  ok(tabelas === 8, `as 8 tabelas existem (${tabelas}/8)`)

  const idx = (await db.query(`
    SELECT i.indisunique AS uniq, (i.indpred IS NOT NULL) AS parcial
      FROM pg_index i WHERE i.indexrelid = 'public.capability_evidence_source_capability_uidx'::regclass`)).rows[0]
  ok(idx?.uniq === true && idx?.parcial === false, "árbitro do onConflict existe, é ÚNICO e NÃO-PARCIAL")

  const nul = (await db.query(`
    SELECT count(*)::int AS n FROM information_schema.columns
     WHERE table_schema='public' AND table_name='capability_evidence'
       AND column_name IN ('criterion_id','category','observed_at') AND is_nullable='NO'`)).rows[0].n
  ok(nul === 0, "criterion_id/category/observed_at estão NULLABLE (o upsert não os fornece)")

  const rls = (await db.query(`
    SELECT count(*)::int AS n FROM pg_class
     WHERE relnamespace='public'::regnamespace AND relrowsecurity
       AND relname IN ('concepts','capabilities','capability_concepts','capability_criteria',
        'capability_evidence','capability_assessments',
        'capability_assessment_evidence','capability_assessment_criteria')`)).rows[0].n
  ok(rls === 8, `RLS ligada nas 8 tabelas (${rls}/8)`)

  const semPolicy = (await db.query(`
    SELECT count(*)::int AS n FROM unnest(ARRAY['concepts','capabilities','capability_concepts','capability_criteria',
      'capability_evidence','capability_assessments','capability_assessment_evidence','capability_assessment_criteria']) t
     WHERE NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = ('public.'||t)::regclass)`)).rows[0].n
  ok(semPolicy === 0, `nenhuma tabela com RLS ligada e zero policy (${semPolicy} órfãs)`)

  // ---- o upsert do pipeline, de verdade ------------------------------------
  const t = "11111111-1111-1111-1111-111111111111"
  const alunoQ = await db.query("SELECT id FROM public.users LIMIT 1")
  const capQ = await db.query("SELECT id, course_id FROM public.capabilities LIMIT 1")
  if (alunoQ.rows.length === 0 || capQ.rows.length === 0) {
    ok(false, "sem aluno/capacidade para exercitar o upsert")
  } else {
    const aluno = alunoQ.rows[0].id
    const cap = capQ.rows[0].id
    const curso = capQ.rows[0].course_id
    const src = "66666666-6666-6666-6666-666666666666"
    try {
      await db.query(UPSERT_PIPELINE, [t, aluno, curso, cap, src])
      ok(true, "upsert do pipeline (19 colunas, vocabulário EN) GRAVOU")
    } catch (e) {
      ok(false, `upsert do pipeline falhou: ${e.message}`)
    }
    try {
      await db.query(UPSERT_PIPELINE, [t, aluno, curso, cap, src])
      const n = (await db.query(
        "SELECT count(*)::int AS n FROM public.capability_evidence WHERE source_id=$1", [src],
      )).rows[0].n
      ok(n === 1, `upsert repetido resolveu por ON CONFLICT, sem duplicar (${n} linha)`)
    } catch (e) {
      ok(false, `segundo upsert falhou: ${e.message}`)
    }
  }

  // ---- reaplicação da migration (idempotência real) ------------------------
  const antesRe = (await db.query("SELECT count(*)::int AS n FROM public.capability_evidence")).rows[0].n
  const capsRe = (await db.query("SELECT count(*)::int AS n FROM public.capabilities")).rows[0].n
  try {
    await db.exec(MIGRATION)
    const depoisRe = (await db.query("SELECT count(*)::int AS n FROM public.capability_evidence")).rows[0].n
    const capsRe2 = (await db.query("SELECT count(*)::int AS n FROM public.capabilities")).rows[0].n
    ok(depoisRe === antesRe && capsRe2 === capsRe,
      `reaplicação é no-op (evidências ${antesRe}→${depoisRe}, capacidades ${capsRe}→${capsRe2})`)
  } catch (e) {
    ok(false, `reaplicação FALHOU: ${e.message}`)
  }

  // ---- seed --------------------------------------------------------------
  const seed = (await db.query(`
    SELECT (SELECT count(*)::int FROM public.capabilities) AS caps,
           (SELECT count(*)::int FROM public.capability_criteria) AS crits`)).rows[0]
  console.log(`  (estado final do currículo: ${seed.caps} capacidades, ${seed.crits} critérios)`)
  if (!comDado) {
    ok(seed.caps === 5 && seed.crits === 21, "terreno virgem foi semeado (5 capacidades, 21 critérios)")
  } else {
    ok(seed.caps === 5 && seed.crits === 5, "terreno ocupado NÃO foi re-semeado (currículo vivo intacto)")
  }

  await db.close()
}

// O cenário virgem também precisa do curso-alvo para exercitar o seed.
const VIRGEM = `
INSERT INTO public.tenants (id, slug) VALUES ('11111111-1111-1111-1111-111111111111','novo-cliente');
INSERT INTO public.courses (id, tenant_id, title) VALUES ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','Análise e Solução de Problemas');
INSERT INTO public.chapters (id, course_id) VALUES ('33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222');
INSERT INTO public.users (id, tenant_id) VALUES ('44444444-4444-4444-4444-444444444444','11111111-1111-1111-1111-111111111111');
`

await rodarCenario("A — TERRENO OCUPADO (réplica de produção, com dado)", TERRENO_OCUPADO, true)
await rodarCenario("B — TERRENO VIRGEM (staging / CI / cliente novo)", VIRGEM, false)

console.log(`\n${"=".repeat(72)}`)
if (falhas.length === 0) {
  console.log("VEREDITO: todos os testes passaram nos dois terrenos.")
} else {
  console.log(`VEREDITO: ${falhas.length} FALHA(S):`)
  for (const f of falhas) console.log(`  - ${f}`)
  process.exitCode = 1
}
