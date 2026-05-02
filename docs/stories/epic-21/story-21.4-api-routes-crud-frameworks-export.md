# Story 21.4: API Routes — CRUD + Frameworks + Export

**Epic:** [Epic 21 — WS2: Orchestrator, API & Database](../../epics/epic-21-ws2-orchestrator-api-database.md)
**Version:** 1.2
**Created:** 2026-02-16
**Updated:** 2026-02-17
**Author:** River (SM)
**Status:** Ready
**Story Points:** 5
**Priority:** P0 (core)
**Blocked By:** Story 21.1, Epic 20
**Blocks:** None (within Epic 21)
**Assigned To:** @dev

---

## User Story

**As a** developer,
**I want** API routes RESTful completas para blueprints, frameworks e export,
**so that** o frontend (Epic 22) tenha todos os endpoints necessarios.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws2-course-creator-architecture.md`, Secao 16 |
| **PRD Ref** | `Benchmarks/07_Course_Designer/PRD-Course-Designer-v1.0.md` — WS2: Course Creator |
| **Stack** | Next.js 15, TypeScript, Supabase, Drizzle ORM, AI SDK 6.0 |
| **Package** | `apps/web` (API routes), `@eximia/course-designer` (runValidator, listFrameworks) |
| **Existing Pattern** | API routes in `apps/web/src/app/api/` (seguir pattern existente) |
| **Risk** | LOW — CRUD padrao seguindo patterns existentes |

---

## Acceptance Criteria

- [ ] **AC1:** `GET /api/course-designer/blueprints` — lista blueprints do tenant
  - Filtros: status, primary_framework
  - Paginacao: cursor-based
  - Include: metadata, quality_score, status, created_at
- [ ] **AC2:** `GET /api/course-designer/blueprints/[id]` — blueprint completo
  - Include: modulos, objetivos, assessments, quality_scorecard
  - JOIN com blueprint_modules
- [ ] **AC3:** `PUT /api/course-designer/blueprints/[id]` — editar blueprint draft
  - Permite editar: modulos (textos, ordem, interaction_type, duracoes)
  - Recalcula Quality Scorecard apos edicao (chama runValidator)
  - Retorna novo score e delta vs. anterior
  - Apenas blueprints com status `draft`
- [ ] **AC4:** `DELETE /api/course-designer/blueprints/[id]` — deletar blueprint
  - Soft delete ou cascade delete de modulos associados
  - Apenas status `draft`
- [ ] **AC5:** `GET /api/course-designer/blueprints/[id]/export` — JSON export
  - Retorna blueprint completo como JSON download
- [ ] **AC6:** `GET /api/course-designer/frameworks` — lista frameworks disponiveis
  - Retorna: id, name, description, stages_count, type para cada framework v1
  - Usa `listFrameworks()` do Registry (Epic 20)
- [ ] **AC7:** Todos os endpoints requerem `manager` ou `admin` role
- [ ] **AC8:** RLS via `auth_tenant_id()` em todas as queries
- [ ] **AC9:** `POST /api/course-designer/ai-fill` — "Preencher com IA"
  - Input: `{ step: 1-5, filled_fields: Record<string, any> }`
  - Usa LLM para sugerir valores para campos vazios com base nos ja preenchidos
  - Output: `{ suggestions: Record<string, { value: any, confidence: number }> }`
  - Usado pelo Wizard (Epic 22) em cada step

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1) Implementar GET /api/course-designer/blueprints (lista)
  - [ ] Criar `apps/web/src/app/api/course-designer/blueprints/route.ts`
  - [ ] Implementar query com Drizzle: filtros (status, primary_framework), paginacao cursor-based
  - [ ] Incluir metadata, quality_score, status, created_at no response
  - [ ] Auth + RLS

- [ ] **Task 2** (AC: 2) Implementar GET /api/course-designer/blueprints/[id] (detalhe)
  - [ ] Criar `apps/web/src/app/api/course-designer/blueprints/[blueprintId]/route.ts`
  - [ ] Implementar query com JOIN blueprint_modules, objectives, assessments
  - [ ] Incluir quality_scorecard no response
  - [ ] Auth + RLS

- [ ] **Task 3** (AC: 3) Implementar PUT /api/course-designer/blueprints/[id] (editar)
  - [ ] No mesmo route file de Task 2
  - [ ] Validar que blueprint esta em status `draft`
  - [ ] Permitir edicao de modulos (textos, ordem, interaction_type, duracoes)
  - [ ] Chamar `runValidator` para recalcular Quality Scorecard
  - [ ] Retornar novo score e delta vs. anterior

- [ ] **Task 4** (AC: 4) Implementar DELETE /api/course-designer/blueprints/[id]
  - [ ] No mesmo route file de Task 2
  - [ ] Validar que blueprint esta em status `draft`
  - [ ] Soft delete ou cascade delete de modulos associados

- [ ] **Task 5** (AC: 5) Implementar GET /api/course-designer/blueprints/[id]/export
  - [ ] Criar `apps/web/src/app/api/course-designer/blueprints/[blueprintId]/export/route.ts`
  - [ ] Retornar blueprint completo como JSON download
  - [ ] Content-Disposition header para download

- [ ] **Task 6** (AC: 6) Implementar GET /api/course-designer/frameworks
  - [ ] Criar `apps/web/src/app/api/course-designer/frameworks/route.ts`
  - [ ] Usar `listFrameworks()` do Registry (Epic 20)
  - [ ] Retornar: id, name, description, stages_count, type

- [ ] **Task 7** (AC: 7, 8) Implementar Auth + RLS em todos os endpoints
  - [ ] Verificar autenticacao em todos os endpoints
  - [ ] Verificar role manager ou admin
  - [ ] RLS via `auth_tenant_id()` em todas as queries Drizzle

- [ ] **Task 8** (AC: 9) Implementar POST /api/course-designer/ai-fill
  - [ ] Criar `apps/web/src/app/api/course-designer/ai-fill/route.ts`
  - [ ] Validar input: `{ step: 1-5, filled_fields: Record<string, any> }`
  - [ ] Usar LLM (via Model Router) para sugerir valores para campos vazios
  - [ ] Retornar: `{ suggestions: Record<string, { value: any, confidence: number }> }`

- [ ] **Task 9** Criar stub para apply endpoint
  - [ ] Criar `apps/web/src/app/api/course-designer/blueprints/[blueprintId]/apply/route.ts`
  - [ ] Retornar 501 Not Implemented com mensagem "Epic 23"

- [ ] **Task 10** Validar typecheck
  - [ ] Rodar `pnpm typecheck` — deve passar sem erros

---

## Dev Notes

### Technical Notes

Seguir pattern existente das API routes em `apps/web/src/app/api/`. Usar Drizzle ORM para queries. O apply endpoint (`POST .../apply`) e stub neste epic — implementacao completa no Epic 23.

### File Locations

```
apps/web/src/app/api/course-designer/
├── frameworks/route.ts              # NOVO
├── ai-fill/route.ts                 # NOVO
├── blueprints/
│   ├── route.ts                     # NOVO — GET list
│   └── [blueprintId]/
│       ├── route.ts                 # NOVO — GET, PUT, DELETE
│       ├── apply/route.ts           # STUB (Epic 23)
│       └── export/route.ts          # NOVO — GET export
```

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-16 | 1.0 | Story creation | River (SM) |
| 2026-02-16 | 1.1 | PO validation: GO — Adicionado Epic 20 ao Blocked By; Status Draft → Ready | Pax (PO) |
| 2026-02-17 | 1.2 | Paths atualizados: @eximia/agents → @eximia/course-designer (D19 modularizacao) | Pax (PO) |

---

## Dev Agent Record

### Agent Model Used
_To be filled by @dev_

### Debug Log References
_To be filled by @dev_

### Completion Notes List
_To be filled by @dev_

### File List
_To be filled by @dev_

---

## QA Results
_To be filled by @qa_
