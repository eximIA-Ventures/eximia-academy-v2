# Story: Cursos duplicados em "Seus Cursos" (curso arquivado + matrículas-fantasma)

**Version:** 1.0
**Created:** 2026-07-01
**Author:** Dex (@dev)
**Status:** Ready for Review
**Priority:** P0 (incident)
**Branch:** `fix/dup-archived-course-listing`
**Type:** Incident fix (brownfield)

---

## User Story

**As a** aluno da eximIA Academy,
**I want** ver cada curso apenas uma vez na lista "Seus Cursos",
**so that** eu não me confunda com cópias arquivadas do mesmo curso.

---

## Incident Context

Alunos do tenant Cory (`a9d56b85-ee0e-4295-8db2-5fbcb3fd7a32`) viam cursos
**duplicados** em "Seus Cursos".

### Causa-raiz

Existiam dois cursos com o mesmo título:

| Curso | ID | Status |
|-------|----|--------|
| Publicado (correto) | `4711c03e...` | `published` |
| Duplicado (arquivado) | `d948fea5-840e-40b5-91f0-6005e81cda55` | `archived` |

A listagem de cursos do aluno **não filtrava**:
1. Cursos com `courses.status = 'archived'`; nem
2. Matrículas soft-deletadas (`enrollments.deleted_at IS NOT NULL`).

Havia **45 matrículas** apontando para o curso arquivado `d948fea5` (todas
`status='active'`, `deleted_at=null` no momento do incidente), que continuavam
aparecendo para os alunos.

Além disso, ao arquivar um curso o código **não cascateava** nada nas
matrículas, então nada as escondia automaticamente — o incidente podia se
repetir a cada arquivamento futuro.

---

## Hotfix de Dados (já aplicado antes desta story)

As 45 matrículas-fantasma do curso `d948fea5` foram marcadas como
`status='dropped'` **e** `deleted_at = now()` (soft-remove, **nunca**
hard-delete).

- **Backup do estado pré-hotfix:** `supabase/_backups/enrollments-archived-d948fea5-backup-20260701.json` (45 linhas, snapshot completo das matrículas).

O hotfix mitigou o sintoma imediato. Esta story trata do **código**, para que o
problema não volte.

---

## Acceptance Criteria

1. **AC-1** — A listagem de cursos do aluno NÃO exibe matrícula cujo
   `courses.status = 'archived'`.
2. **AC-2** — A listagem de cursos do aluno NÃO exibe matrícula com
   `deleted_at IS NOT NULL`.
3. **AC-3** — O filtro pré-existente `status IN ('active','completed')` é
   preservado.
4. **AC-4** — Arquivar um curso soft-remove (`deleted_at`) todas as suas
   matrículas automaticamente (nunca hard-delete), escondendo o curso de todos
   os alunos sem intervenção manual.
5. **AC-5** — Nenhum agregado histórico (taxas de conclusão/engajamento, counts
   de gestor) é alterado por esta mudança.

---

## Code Changes

### Fix — listagem de cursos do aluno (AC-1, AC-2, AC-3)

Aplicado o padrão idiomático PostgREST/supabase-js: `courses!inner(...)` +
`.neq("courses.status", "archived")` (filtro no recurso embutido, que só
descarta a linha-pai porque o join é `!inner`) e `.is("deleted_at", null)`.

- **`apps/web/src/app/(platform)/dashboard/_components/student-dashboard-page.tsx`**
  - Query principal de `enrollments` (RSC "Seus Cursos"): embed trocado para
    `courses!inner(id, title, status)` + `.is("deleted_at", null)` +
    `.neq("courses.status", "archived")`.
  - Card de resumo "cursos matriculados" (count): alinhado com os mesmos
    filtros para que o número bata com a lista visível.
- **`apps/web/src/app/api/analytics/student/route.ts`**
  - Query análoga de `enrollments` (lista de cursos) e o count
    `enrolledCourses`: mesmos filtros `deleted_at`/`archived`.

### Fix — cascata no arquivamento (AC-4)

- **`apps/web/src/app/(platform)/courses/actions.ts` → `archiveCourse()`**
  - Após marcar o curso como `archived`, cascateia nas matrículas do curso
    setando `deleted_at = new Date().toISOString()` via `createServiceClient()`
    (consistente com `deleteCourse`/`restartCourse` no mesmo arquivo).
  - Filtro `.is("deleted_at", null)` garante idempotência (não re-toca linhas
    já removidas). **Nunca** hard-delete.

### Fix — pontos de exibição adicionais (AC-2)

- **`apps/web/src/app/(platform)/analytics/students/[studentId]/page.tsx`**
  - Lista de cursos do aluno exibida ao gestor (detalhe do aluno): mesmos
    filtros `deleted_at`/`archived`. É exibição direta por-curso, sem agregado.
- **`apps/web/src/lib/certificates/generate.ts`**
  - Geração de certificado por `enrollmentId`: adicionado `.is("deleted_at", null)`
    para nunca emitir certificado de uma matrícula soft-removida (ex.: escondida
    por curso arquivado).

---

## Varredura — todos os pontos que leem `enrollments` (AC-5)

Foram inspecionados **todos** os pontos de `apps/web` que leem `enrollments`.
Postura conservadora: pontos que alteram **agregados** de forma arriscada foram
apenas **reportados**, não modificados (o hotfix de dados já removeu as 45
fantasmas dos agregados `status IN ('active','completed')`).

### Corrigidos (exibição direta por-curso, seguro)

| Arquivo | Motivo |
|---------|--------|
| `dashboard/_components/student-dashboard-page.tsx` | Alvo primário — "Seus Cursos" |
| `api/analytics/student/route.ts` | Alvo análogo — cursos do aluno |
| `analytics/students/[studentId]/page.tsx` | Lista de cursos do aluno (detalhe p/ gestor) |
| `lib/certificates/generate.ts` | Não emitir certificado de matrícula soft-removida |

### Apenas reportados (agregados/counts — NÃO alterados, conservador)

| Arquivo | Natureza | Por que não alterei |
|---------|----------|---------------------|
| `dashboard/_components/manager-dashboard-page.tsx` | Taxa de engajamento/conclusão, counts, pace | Agregados históricos; hotfix de dados já corrigiu; mudar arriscaria alterar métricas. |
| `api/analytics/manager/route.ts` | Agregados de gestor | Idem. |
| `api/analytics/manager-courses/route.ts` | Agregados por curso | Idem. |
| `instructor/page.tsx` | Pace highlights (`status='active'`) | Agregado de ritmo; hotfix já removeu fantasmas. |
| `lib/engagement-helpers.ts` | Pace do time | Idem. |
| `lib/leader/team.ts` | Analytics do time | Agregado; sem exibir o curso arquivado por-item. |
| `lib/trails/recommendations.ts` | Ranking de popularidade por `trail_id` | Incidente é por `course_id`, não trilha; mudar alteraria contagem de popularidade. |
| `lib/notifications/audiences.ts` | Targeting de notificação (não é exibição de lista) | Fora do escopo de exibição; comportamento de audiência não deve mudar sem decisão de produto. |
| `api/v1/*` (enrollments, courses/[id]/enrollments, analytics/courses/[id], integration) | API pública/integração | Contrato externo; mudança precisa de decisão de versionamento. |
| `admin/users/enrollment-actions.ts`, `onboarding/actions.ts`, `consciousness/*`, `courses/[id]/*`, `trails/*` (actions) | Escrita/lógica de sessão | Não são exibição de lista de cursos. |

---

## Testing / Validation

- **Typecheck:** `npx tsc --noEmit` em `apps/web` → **PASS** (0 erros).
- **Lint:** `biome check` nos arquivos tocados → apenas diffs de formatação
  **pré-existentes** (ex.: união de tipo em `requireContentRole`, linha não
  alterada por esta story); nenhum problema introduzido pelas mudanças.
- **Escopo:** mudanças mínimas e cirúrgicas; nenhuma migration de dados tocada;
  sem deploy/push (responsabilidade do @devops).

---

## Notes

- Não houve criação de arquivos de código novos — todas as correções são
  adaptações de queries existentes (IDS: ADAPT).
- `enrollments.deleted_at` já existe no schema desde a migration LGPD
  (`20260208000002_add_user_soft_delete.sql`), com índice parcial
  `idx_enrollments_not_deleted ... WHERE deleted_at IS NULL` — o padrão
  `deleted_at IS NULL` já é canônico no projeto.

---

## Dev Agent Record

**Agent:** Dex (@dev)
**Date:** 2026-07-01

### File List
- `apps/web/src/app/(platform)/dashboard/_components/student-dashboard-page.tsx` (modified)
- `apps/web/src/app/api/analytics/student/route.ts` (modified)
- `apps/web/src/app/(platform)/courses/actions.ts` (modified)
- `apps/web/src/app/(platform)/analytics/students/[studentId]/page.tsx` (modified)
- `apps/web/src/lib/certificates/generate.ts` (modified)
- `docs/stories/fix-dup-archived-course-listing.md` (new — this story)
