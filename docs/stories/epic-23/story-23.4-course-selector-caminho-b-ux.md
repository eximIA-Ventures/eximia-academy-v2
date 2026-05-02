# Story 23.4: Course Selector + Caminho B UX

**Epic:** [Epic 23 — WS2: Integration: Auditor, Apply & WS1](../../epics/epic-23-ws2-integration-auditor-apply-ws1.md)
**Version:** 1.0
**Created:** 2026-02-16
**Updated:** 2026-02-16
**Author:** River (SM)
**Status:** Ready
**Story Points:** 5
**Priority:** P1 (enhancement — wizard funciona sem Caminho B)
**Blocked By:** Story 23.1, Epic 22
**Blocks:** None
**Assigned To:** @dev

---

## User Story

**As a** manager,
**I want** selecionar um curso existente no Step 3 do wizard para que o Auditor pre-preencha os campos,
**so that** eu possa recriar/melhorar cursos existentes com design instrucional.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws2-course-creator-architecture.md`, Secao 7.3 |
| **PRD Ref** | `Benchmarks/07_Course_Designer/PRD-Course-Designer-v1.0.md` — WS2: Course Creator |
| **Stack** | Next.js 15, React, TypeScript, Tailwind CSS |
| **Package** | `apps/web` |
| **Existing Pattern** | `apps/web/src/app/(platform)/courses/new/design/_components/` (wizard steps pattern) |
| **Risk** | LOW — componente de selecao + integracao com Auditor |

---

## Acceptance Criteria

- [ ] **AC1:** Course Selector no `scope-step.tsx` (Step 3 do wizard)
  - Toggle: "Novo curso" / "Recriar curso existente"
  - Se "Recriar": mostra lista de cursos do tenant
  - Cada curso mostra: titulo, N chapters, N questions, status, created_at
  - Busca por titulo (filter)
  - Paginacao ou scroll infinito
- [ ] **AC2:** Ao selecionar curso:
  - Loading state: "Analisando curso..."
  - Chama Auditor API (23.1)
  - Preenche `source_course_id` no form
  - Resultado do Auditor pre-preenche Steps 1-4:
    - Topics -> `topics_outline`
    - Estimated duration -> `total_duration_hours`
    - Quality audit score exibido como referencia
  - Instrutor pode aceitar, editar ou descartar cada sugestao
- [ ] **AC3:** Preservation Map visual (opcional, se Auditor retorna)
  - Lista de elementos com badge: MANTER (verde), REORGANIZAR (azul), MELHORAR (amarelo), DESCARTAR (vermelho)
  - Informativo — instrutor pode consultar mas nao precisa agir
- [ ] **AC4:** API endpoint para listar cursos do tenant:
  - Reutilizar endpoint existente ou criar `GET /api/courses?forDesigner=true`
  - Retorna: id, title, chapters_count, questions_count, status, created_at
- [ ] **AC5:** Usa `@eximia/ui`: Select, Card, Badge, Skeleton (loading)
- [ ] **AC6:** Se Auditor falha, mostra erro mas permite continuar sem pre-preenchimento

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 4) Criar/reutilizar API endpoint para listar cursos
  - [ ] Verificar se endpoint existente pode ser reutilizado
  - [ ] Se nao: criar `GET /api/courses?forDesigner=true`
  - [ ] Retornar: id, title, chapters_count, questions_count, status, created_at
  - [ ] RLS tenant isolation

- [ ] **Task 2** (AC: 1) Implementar Course Selector no scope-step.tsx
  - [ ] Adicionar toggle: "Novo curso" / "Recriar curso existente"
  - [ ] Renderizar lista de cursos do tenant quando "Recriar" selecionado
  - [ ] Mostrar titulo, N chapters, N questions, status, created_at por curso
  - [ ] Implementar busca por titulo (filter client-side ou server-side)
  - [ ] Implementar paginacao ou scroll infinito

- [ ] **Task 3** (AC: 2) Integrar com Auditor API ao selecionar curso
  - [ ] Loading state: "Analisando curso..."
  - [ ] Chamar `POST /api/course-designer/audit-course` com courseId
  - [ ] Preencher `source_course_id` no form state
  - [ ] Pre-preencher Steps 1-4 com dados do Auditor:
    - Topics -> `topics_outline`
    - Estimated duration -> `total_duration_hours`
    - Quality audit score como referencia visual
  - [ ] Permitir aceitar, editar ou descartar cada sugestao

- [ ] **Task 4** (AC: 3) Implementar Preservation Map visual
  - [ ] Renderizar lista de elementos com badges coloridos
  - [ ] MANTER (verde), REORGANIZAR (azul), MELHORAR (amarelo), DESCARTAR (vermelho)
  - [ ] Componente informativo (read-only)

- [ ] **Task 5** (AC: 5) Usar componentes @eximia/ui
  - [ ] Select para toggle Novo/Recriar
  - [ ] Card para cada curso na lista
  - [ ] Badge para status e Preservation Map
  - [ ] Skeleton para loading states

- [ ] **Task 6** (AC: 6) Implementar error handling
  - [ ] Se Auditor API falha: mostrar mensagem de erro
  - [ ] Permitir continuar wizard sem pre-preenchimento
  - [ ] Nao bloquear fluxo

- [ ] **Task 7** (AC: implicitly all) Validar
  - [ ] Rodar `pnpm typecheck` — deve passar sem erros
  - [ ] Verificar lista de cursos carrega corretamente
  - [ ] Verificar Auditor pre-preenche wizard

---

## Dev Notes

### Technical Notes

O Course Selector e um componente dentro do ScopeStep. O Auditor roda assincronamente — mostrar loading adequado. Para cursos grandes, o Auditor pode levar 30-60s.

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar Course Selector + integracao |
| **@ux-design-expert** | Validar UX do Caminho B |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Lista de cursos carrega corretamente | Yes |
| Pre-PR | Auditor pre-preenche wizard | Yes |

### File Locations

```
apps/web/src/app/(platform)/courses/new/design/_components/
├── scope-step.tsx                 # ATUALIZAR — adicionar Course Selector
```

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-16 | 1.0 | Story creation | River (SM) |
| 2026-02-16 | 1.1 | PO validation: GO — Status Draft → Ready | Pax (PO) |

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
