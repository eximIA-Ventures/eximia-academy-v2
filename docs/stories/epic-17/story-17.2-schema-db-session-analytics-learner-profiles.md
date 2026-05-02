# Story 17.2: Schema DB — Session Analytics e Learner Profiles

**Epic:** [Epic 17 — Shadow Analysis Pipeline](../../epics/epic-17-ws1-shadow-analysis-pipeline.md)
**Version:** 1.0
**Created:** 2026-02-15
**Updated:** 2026-02-15
**Author:** River (SM)
**Status:** InProgress
**Story Points:** 5
**Priority:** P0 (fundacao DB)
**Blocked By:** None (pode executar em paralelo com 17.1)
**Blocks:** Story 17.3
**Assigned To:** @dev

---

## User Story

**As a** developer,
**I want** tabelas/campos para armazenar analytics de sessao e perfis de aprendizado,
**so that** os dados do Detector e Perfilador sejam persistidos para dashboards.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws1-motor-socratico-architecture.md`, Secao 11 |
| **PRD Ref** | `docs/prd/evolucao-eximia-academy-workstreams.md` — WS1: Motor Socratico |
| **Stack** | Drizzle ORM, PostgreSQL (Supabase), SQL migrations |
| **DB Tables** | `sessions` (ALTER — add analytics JSONB), `learner_profiles` (NOVA) |
| **Existing Schema** | `packages/database/src/schema/sessions.ts` |
| **Risk** | MEDIUM — novas tabelas com JSONB, RLS policies |

---

## Acceptance Criteria

- [x] **AC1:** Campo `analytics` (JSONB) adicionado na tabela `sessions`
  - Default: `'{}'` — novas sessoes recebem `{}` automaticamente
  - Coluna permite NULL mas DEFAULT garante que inserções novas nunca sao null
  - Sessoes existentes: backfill automatico via DEFAULT na migration
  - Contem: emotional_journey, depth_reached, breakthrough_moments, cognitive_patterns, defense_mechanisms, values_revealed, depth_progression, resistance_moments, insight_moments, question_relevance, depth_calibration, resistance_navigation, initial_confusion_level, final_clarity_level, clarity_gain, response_lengths, emotional_density_progression, kolb_session_vector
- [x] **AC2:** Tabela `learner_profiles` criada
  - id (UUID PK, default gen_random_uuid)
  - student_id (UUID FK auth.users, NOT NULL, ON DELETE CASCADE)
  - tenant_id (UUID FK tenants, NOT NULL, ON DELETE CASCADE)
  - engagement_style, detail_orientation, reasoning_style (TEXT)
  - avg_depth_achieved, avg_qa_score, confidence (NUMERIC)
  - kolb_grasping_axis, kolb_transforming_axis (NUMERIC -1 to +1)
  - kolb_dominant_style (TEXT), kolb_style_confidence (NUMERIC)
  - strengths, growth_areas, adaptation_hints, preferred_question_types (TEXT[])
  - comprehension_trend (TEXT), summary (TEXT)
  - session_count (INTEGER DEFAULT 0)
  - created_at, updated_at (TIMESTAMPTZ DEFAULT NOW())
  - UNIQUE(student_id, tenant_id)
- [x] **AC3:** RLS para `learner_profiles`
  - SELECT: managers/admins do mesmo tenant + proprio aluno (read-only)
  - INSERT/UPDATE: system-level (via service role, nao RLS direto)
- [x] **AC4:** Drizzle schemas em `packages/database/src/schema/`
  - `sessions.ts` — adicionar campo `analytics`
  - `learner-profiles.ts` — nova tabela completa
- [x] **AC5:** Migration SQL funcional (sem downtime)
- [x] **AC6:** Index em `learner_profiles(student_id, tenant_id)`
- [x] **AC7:** `pnpm typecheck` passa

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [x] **Task 1** (AC: 1, 5) Criar migration para sessions.analytics
  - [x] Criar migration SQL: `ALTER TABLE sessions ADD COLUMN analytics JSONB DEFAULT '{}';`
  - [x] Sessoes existentes recebem `'{}'` automaticamente via DEFAULT

- [x] **Task 2** (AC: 2, 5, 6) Criar migration para learner_profiles
  - [x] Criar migration SQL com CREATE TABLE completo
  - [x] Incluir UNIQUE(student_id, tenant_id)
  - [x] Incluir CREATE INDEX idx_learner_profiles_student_tenant
  - [x] Incluir ENABLE ROW LEVEL SECURITY

- [x] **Task 3** (AC: 3) Criar RLS policies
  - [x] Policy `lp_select_manager`: SELECT para manager/admin do tenant
    ```sql
    CREATE POLICY "lp_select_manager" ON learner_profiles FOR SELECT
      USING (tenant_id = auth_tenant_id() AND auth_user_role() IN ('manager', 'admin'));
    ```
  - [x] Policy `lp_select_own`: SELECT para o proprio aluno
    ```sql
    CREATE POLICY "lp_select_own" ON learner_profiles FOR SELECT
      USING (tenant_id = auth_tenant_id() AND student_id = auth.uid());
    ```
  - [x] INSERT/UPDATE via service role (sem policy explicita — acesso via supabase.auth.admin ou service key)

- [x] **Task 4** (AC: 4) Atualizar Drizzle schemas
  - [x] Adicionar campo `analytics` em `packages/database/src/schema/sessions.ts`:
    ```typescript
    analytics: jsonb("analytics").default({}),
    ```
  - [x] Criar `packages/database/src/schema/learner-profiles.ts` com schema Drizzle completo
  - [x] Exportar em barrel file do schema

- [x] **Task 5** (AC: 7) Validar
  - [x] `pnpm typecheck` passa
  - [x] Migration aplica sem erros
  - [x] Sessoes existentes nao sao afetadas

---

## Dev Notes

### Session Analytics JSONB Structure

```typescript
interface SocraticSessionAnalytics {
  emotional_journey: string[]          // ["confused", "defensive", "curious", "insightful"]
  depth_reached: number                // 1-7
  breakthrough_moments: number         // count
  cognitive_patterns: string[]
  defense_mechanisms: string[]
  values_revealed: string[]
  depth_progression: number[]          // [1, 2, 2, 3, 4, 5, 4, 6]
  resistance_moments: number
  insight_moments: number
  question_relevance: number           // 0-1
  depth_calibration: number            // 0-1
  resistance_navigation: number        // 0-1
  initial_confusion_level?: number     // 0-10
  final_clarity_level?: number         // 0-10
  clarity_gain?: number
  response_lengths: number[]
  emotional_density_progression: number[]
  kolb_session_vector: {
    grasping_axis: number
    transforming_axis: number
    indicators_count: number
  }
}
```

[Source: docs/architecture/ws1-motor-socratico-architecture.md, Secao 11]

### Learner Profiles — Migration SQL Completa

```sql
-- Session analytics (campo JSONB na tabela existente)
ALTER TABLE sessions ADD COLUMN analytics JSONB DEFAULT '{}';

-- Learner profiles (nova tabela)
CREATE TABLE learner_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  engagement_style TEXT,
  detail_orientation TEXT,
  reasoning_style TEXT,
  avg_depth_achieved NUMERIC(3,1),
  avg_qa_score NUMERIC(3,2),
  confidence NUMERIC(3,2),
  kolb_grasping_axis NUMERIC(4,2),
  kolb_transforming_axis NUMERIC(4,2),
  kolb_dominant_style TEXT,
  kolb_style_confidence NUMERIC(3,2),
  strengths TEXT[] DEFAULT '{}',
  growth_areas TEXT[] DEFAULT '{}',
  adaptation_hints TEXT[] DEFAULT '{}',
  preferred_question_types TEXT[] DEFAULT '{}',
  comprehension_trend TEXT,
  summary TEXT,
  session_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, tenant_id)
);

CREATE INDEX idx_learner_profiles_student_tenant
  ON learner_profiles(student_id, tenant_id);

ALTER TABLE learner_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lp_select_manager" ON learner_profiles FOR SELECT
  USING (tenant_id = auth_tenant_id() AND auth_user_role() IN ('manager', 'admin'));

CREATE POLICY "lp_select_own" ON learner_profiles FOR SELECT
  USING (tenant_id = auth_tenant_id() AND student_id = auth.uid());
```

[Source: docs/architecture/ws1-motor-socratico-architecture.md, Secao 11]

### Existing Sessions Schema

O arquivo `packages/database/src/schema/sessions.ts` ja tem: id, studentId, chapterId, questionId, tenantId, status (active/completed/abandoned), interactionsRemaining (default 20), turnNumber, completedAt, createdAt, updatedAt.

O campo `analytics` e adicionado como JSONB nullable.

[Source: packages/database/src/schema/sessions.ts]

### File Locations

```
packages/database/src/schema/
├── sessions.ts              # ATUALIZAR (add analytics JSONB)
└── learner-profiles.ts      # NOVO

supabase/migrations/
├── YYYYMMDD_add_session_analytics.sql    # NOVO
└── YYYYMMDD_create_learner_profiles.sql  # NOVO (ou combinar em 1 migration)
```

### Testing

- Validar que migration aplica sem erros
- Validar que sessoes existentes nao sao corrompidas
- Testes de RLS: manager ve perfis do tenant, student ve proprio perfil
- Testes automatizados no Epic 19

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-15 | 1.0 | Story creation | River (SM) |
| 2026-02-15 | 1.1 | QA fix L2: clarified nullable vs DEFAULT behavior for analytics JSONB column | River (SM) |
| 2026-02-15 | 1.2 | PO validation: GO (10/10). Status Draft → Ready | Pax (PO) |
| 2026-02-15 | 1.3 | Implementation complete. All 5 tasks done. Status Ready → InProgress | Dex (Dev) |

---

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References
- `@eximia/database` typecheck: PASS (clean)

### Completion Notes List
- Added `analytics` JSONB column to `sessions` table with DEFAULT '{}'
- Created `learner_profiles` table with all specified columns (Kolb axes, engagement style, strengths arrays, etc.)
- UNIQUE constraint on (student_id, tenant_id)
- Index on (student_id, tenant_id) for lookup performance
- RLS policies: managers/admins read tenant profiles, students read own profile
- INSERT/UPDATE via service role (no explicit RLS policy needed)
- Drizzle schema updated: sessions.ts + new learner-profiles.ts
- Barrel file updated with learnerProfiles export

### File List
- `packages/database/src/schema/sessions.ts` — MODIFIED (added analytics JSONB column)
- `packages/database/src/schema/learner-profiles.ts` — NEW (learnerProfiles Drizzle schema)
- `packages/database/src/schema/index.ts` — MODIFIED (added learnerProfiles export)
- `supabase/migrations/20260215100000_session_analytics_learner_profiles.sql` — NEW (migration)

---

## QA Results
_To be filled by @qa_
