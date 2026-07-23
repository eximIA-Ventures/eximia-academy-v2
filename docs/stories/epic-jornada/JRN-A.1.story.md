# JRN-A.1 — Schema + Migration da Jornada persistida

> **Epic:** EPIC-JORNADA · **Trilha:** A (Persistência) · **Status:** InProgress
> **Depende de:** — · **Bloqueia:** JRN-A.2, JRN-A.3, integração de B/C

## Story

Como plataforma, preciso persistir a jornada que o aluno construiu (durações por módulo + preferências + preset) por enrollment, evoluindo o design `study_plans` nunca-aplicado para o modelo da demo (prazos por módulo + meta do gestor), para que "Começar minha jornada" deixe de ser um toast local e vire estado real, RLS-safe e multi-tenant.

## Escopo (territórios de A)

- `packages/database/src/schema/study-plans.ts` — NOVO schema Drizzle.
- `packages/database/src/schema/index.ts` — +export.
- `packages/database/src/schema/courses.ts` — +`deadlineDays` (fecha drift) +`managerDeadlineDays` (meta do gestor, nova).
- `supabase/migrations/20260723000000_jornada_study_plans.sql` — NOVO, **escrito, não aplicado**.

## Modelo (evolução do doc de arquitetura §3.1/§5)

`study_plans` guarda o modelo da demo, não só ritmo semanal:

| Coluna | Tipo | Nota |
|---|---|---|
| id | uuid PK | |
| enrollment_id | uuid FK enrollments CASCADE | |
| student_id | uuid FK users CASCADE | denormalizado p/ RLS |
| course_id | uuid FK courses CASCADE | denormalizado |
| tenant_id | uuid FK tenants CASCADE | denormalizado, predicado de RLS |
| status | text CHECK(draft/active/completed/paused) default 'active' | |
| module_durations | jsonb NOT NULL | int[] dias/módulo, min 4, ordenado por chapter.order |
| preset | real NULL | 1.3/1/0.75/null |
| preferences | jsonb NOT NULL default `{"cascade":true,"unit":"w"}` | {cascade, unit} |
| start_date | date NOT NULL | T0 |
| final_deadline_date | date NULL | snapshot "Disponível até" |
| manager_deadline_date | date NULL | snapshot "Meta do gestor" |
| recalculated_at | timestamptz NULL | |
| created_at / updated_at | timestamptz | trigger de updated_at |

`courses`: +`deadline_days integer` (drift, já no banco), +`manager_deadline_days integer` (nova, meta do gestor nível curso).

RLS reusa integralmente o desenho do `@data-engineer` (doc §5/§6.2): student SELECT/INSERT/UPDATE por `auth.uid()`+`auth_tenant_id()`, INSERT com `EXISTS` provando integridade de enrollment; staff read-only; super_admin bypass; sem DELETE humano; índice único parcial `WHERE status='active'`.

## Critérios de Aceite

1. `study-plans.ts` define a tabela com todas as colunas acima, estilo idêntico a `enrollments.ts` (imports drizzle-orm/pg-core, `pgTable`, FKs com `onDelete: "cascade"`).
2. Índice único parcial de 1 jornada ativa por enrollment (`WHERE status='active'`) presente na migration.
3. `courses.ts` ganha `deadlineDays` e `managerDeadlineDays` (ambos `integer(...)` nullable), sem alterar colunas existentes.
4. `index.ts` exporta `studyPlans` (+1 linha, sem tocar as demais).
5. Migration `20260723000000_jornada_study_plans.sql` em raw-SQL, padrão das migrations recentes (BEGIN/COMMIT, `CREATE TABLE`, `COMMENT ON`, trigger de updated_at, bloco RLS completo, `ALTER TABLE courses ADD COLUMN IF NOT EXISTS`), com cabeçalho declarando **"escrita, não aplicada"**.
6. A migration usa `auth_tenant_id()`, `auth_user_role()`, `is_super_admin()` (helpers existentes) — nenhuma função de auth reinventada.
7. `manager_deadline_date`/`final_deadline_date` nullable (degradam quando o curso não tem deadline).

## Gates (comandos de verificação)

- `pnpm --filter @eximia/database typecheck` (tsc do pacote database) — verde.
- `pnpm --filter @eximia/database lint` (biome) — verde.
- Migration NÃO aplicada (nenhum `supabase db push` / `psql`). Verificação: `grep -c "não aplicada" supabase/migrations/20260723000000_jornada_study_plans.sql` ≥ 1.

## Critério de Saída

Schema + migration escritos, tipagem do pacote database verde, migration marcada como não-aplicada, `courses.ts` com as 2 colunas. Nenhuma escrita no banco. Commit local só destes arquivos.
