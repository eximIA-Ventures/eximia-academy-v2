# Story 23.1: Auditor — Analise de Curso Existente (Caminho B)

**Epic:** [Epic 23 — WS2: Integration: Auditor, Apply & WS1](../../epics/epic-23-ws2-integration-auditor-apply-ws1.md)
**Version:** 1.2
**Created:** 2026-02-16
**Updated:** 2026-02-17
**Author:** River (SM)
**Status:** Ready
**Story Points:** 5
**Priority:** P1 (enhancement — Caminho A funciona sem isto)
**Blocked By:** Epic 20, Epic 21
**Blocks:** Story 23.4
**Assigned To:** @dev

---

## User Story

**As a** manager,
**I want** que o sistema analise um curso existente e pre-preencha o wizard com dados extraidos,
**so that** eu possa recriar/melhorar meu curso usando design instrucional.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws2-course-creator-architecture.md`, Secao 7.4 |
| **PRD Ref** | `Benchmarks/07_Course_Designer/PRD-Course-Designer-v1.0.md` — WS2: Course Creator |
| **Stack** | Next.js 15, Supabase, AI SDK 6.0, TypeScript |
| **Package** | `@eximia/course-designer`, `apps/web` |
| **Existing Pattern** | `packages/course-designer/src/` (pipeline agents pattern) |
| **Risk** | MEDIUM — qualidade da analise depende do LLM + estrutura do curso existente |

---

## Acceptance Criteria

- [ ] **AC1:** `auditCourse(courseId)` em `packages/course-designer/src/auditor.ts`
  - Input: `courseId` (UUID) + tenant context
  - Carrega: course + chapters + questions do DB
  - Output: `AuditResult` (Zod-validated)
- [ ] **AC2:** 7 passos do Auditor:
  - Passo 1 (Extracao Estrutural): chapters, questions, content normalizado
  - Passo 2 (Analise de Conteudo): temas, conceitos, Bloom atual
  - Passo 3 (Auditoria de Qualidade): Score 0-100 nas 5 dimensoes
  - Passo 4 (Gap Identification): estado atual vs. best practices
  - Passo 5 (Preservation Map): classifica cada elemento: MANTER, REORGANIZAR, MELHORAR, DESCARTAR
  - Passo 6 (Plano de Melhoria): recomendacoes priorizadas
  - Passo 7 (Feed para Pipeline): `enriched_input` empacotado para as 6 camadas do Brief
- [ ] **AC3:** Schema `AuditResult`
  - `existing_course_structure`: chapters count, questions count, total content length
  - `content_analysis`: topics[], concepts[], bloom_levels_detected[]
  - `quality_audit`: score 0-100, dimensions (5)
  - `gap_report`: gaps[], recommendations[]
  - `preservation_map`: elements[] com status (MANTER/REORGANIZAR/MELHORAR/DESCARTAR)
  - `enriched_input`: partial CourseDesignerInput (pre-preenchimento)
- [ ] **AC4:** `enriched_input` mapeia para camadas do Brief:
  - Camada 1: course title -> course_title, description -> behavior_change hint
  - Camada 2: inferred from content complexity -> experience_level
  - Camada 3: chapters -> topics_outline, questions -> assessment_preference
  - Camada 4: total chapters x estimated time -> total_duration_hours
- [ ] **AC5:** `POST /api/course-designer/audit-course` em `apps/web/src/app/api/course-designer/audit-course/route.ts`
  - Input: `{ courseId: string }`
  - Requer role `manager` ou `admin`, RLS tenant isolation
  - Retorna: `AuditResult` (JSON)
  - Rate limiting: max 3 auditorias por hora por tenant
- [ ] **AC6:** Prompt em `packages/course-designer/src/prompts/auditor.ts`
- [ ] **AC7:** `pnpm typecheck` passa

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 3) Criar schema AuditResult
  - [ ] Definir `auditResultSchema` com Zod em `packages/course-designer/src/auditor.ts`
  - [ ] Campos: `existing_course_structure`, `content_analysis`, `quality_audit`, `gap_report`, `preservation_map`, `enriched_input`
  - [ ] Exportar schema + type inferido (`AuditResult`)

- [ ] **Task 2** (AC: 6) Criar prompt do Auditor
  - [ ] Criar `packages/course-designer/src/prompts/auditor.ts`
  - [ ] Prompt com instrucoes para os 7 passos
  - [ ] Input: course content (title, chapters, questions)
  - [ ] Output format alinhado com `auditResultSchema`

- [ ] **Task 3** (AC: 1, 2) Implementar `auditCourse(courseId)`
  - [ ] Criar funcao `auditCourse` em `packages/course-designer/src/auditor.ts`
  - [ ] Carregar course + chapters + questions do DB via tenant context
  - [ ] Chamar LLM com `generateObject` usando prompt + schema
  - [ ] Validar resultado com Zod
  - [ ] Retornar `AuditResult`

- [ ] **Task 4** (AC: 4) Implementar mapeamento enriched_input -> Brief layers
  - [ ] Camada 1: title -> course_title, description -> behavior_change
  - [ ] Camada 2: content complexity -> experience_level
  - [ ] Camada 3: chapters -> topics_outline, questions -> assessment_preference
  - [ ] Camada 4: chapters count x estimated time -> total_duration_hours

- [ ] **Task 5** (AC: 5) Criar API route
  - [ ] Criar `apps/web/src/app/api/course-designer/audit-course/route.ts`
  - [ ] POST handler com input validation (`courseId`)
  - [ ] Role check: `manager` ou `admin`
  - [ ] RLS tenant isolation
  - [ ] Rate limiting: max 3 por hora por tenant
  - [ ] Retornar `AuditResult` como JSON

- [ ] **Task 6** (AC: 7) Validar
  - [ ] Rodar `pnpm typecheck` — deve passar sem erros

---

## Dev Notes

### Technical Notes

O Auditor e uma chamada LLM unica com todo o conteudo do curso como contexto. Para cursos grandes (20+ chapters), considerar chunking.

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar Auditor |
| **@qa (QA)** | Testar com cursos existentes de diferentes tamanhos |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Auditor funciona para curso com 5+ chapters | Yes |

### File Locations

```
packages/course-designer/src/
├── auditor.ts                     # NOVO
└── prompts/auditor.ts             # NOVO

apps/web/src/app/api/course-designer/
├── audit-course/route.ts          # NOVO
```

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-16 | 1.0 | Story creation | River (SM) |
| 2026-02-16 | 1.1 | PO validation: GO — Status Draft → Ready | Pax (PO) |
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
