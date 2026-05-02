# Story 23.2: Blueprint Apply — Criar Curso + Capitulos + Questions (D12)

**Epic:** [Epic 23 — WS2: Integration: Auditor, Apply & WS1](../../epics/epic-23-ws2-integration-auditor-apply-ws1.md)
**Version:** 1.2
**Created:** 2026-02-16
**Updated:** 2026-02-17
**Author:** River (SM)
**Status:** Ready
**Story Points:** 8
**Priority:** P0 (core — e o output final do pipeline inteiro)
**Blocked By:** Epic 21
**Blocks:** Story 23.3
**Assigned To:** @dev

---

## User Story

**As a** manager,
**I want** aplicar um blueprint aprovado para criar automaticamente o curso com capitulos e perguntas,
**so that** eu nao precise criar manualmente cada capitulo e pergunta.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws2-course-creator-architecture.md`, Secoes 11.2-11.3 |
| **PRD Ref** | `Benchmarks/07_Course_Designer/PRD-Course-Designer-v1.0.md` — WS2: Course Creator |
| **Stack** | Next.js 15, Supabase, AI SDK 6.0, TypeScript |
| **Package** | `@eximia/course-designer`, `apps/web` |
| **Existing Pattern** | `packages/course-designer/src/` (pipeline agents pattern) |
| **Risk** | HIGH — cria entidades reais no DB, geracao IA de conteudo, integracao critica |

---

## Acceptance Criteria

- [ ] **AC1:** `POST /api/course-designer/blueprints/[id]/apply` em `apps/web/src/app/api/course-designer/blueprints/[blueprintId]/apply/route.ts`
  - Requer blueprint com status `draft` ou `approved`
  - Requer role `manager` ou `admin`
  - Retorna: `courseId` do curso criado
- [ ] **AC2:** `applyBlueprint(blueprintId)` em `packages/course-designer/src/apply-blueprint.ts`
  - Cria `course` com:
    - title: blueprint metadata.title
    - settings: `{ blueprint_id, primary_framework, interactionConfig }`
    - tenant_id e created_by preenchidos explicitamente (NOT NULL, sem auto-trigger)
  - Para cada modulo do blueprint:
    - Cria `chapter` com: title, content (**gerado por IA**), learningObjective (objectives[0].text), order
    - Content gerado via `generateObject`: IA produz markdown estruturado usando como input o modulo (description, objectives, framework_stages, bloom_level). Inclui secoes por framework stage, conceitos-chave e placeholders para atividades praticas
- [ ] **AC3:** Questions variaveis por interaction_type (D12):
  - `socratic_dialogue`: 3-5 perguntas abertas, profundas, socraticas
  - `quiz`: 5-8 perguntas (multipla escolha, V/F, resposta curta)
  - `scenario`: 2-3 cenarios com dilema + trade-offs
  - `assignment`: 1-2 assignments com entregavel definido
  - Todas com `status = 'pending'` — manager revisa antes de ativar
- [ ] **AC4:** Questions geradas por IA (usando generateObject) baseadas em:
  - Conteudo do modulo (objectives, description)
  - Bloom level target
  - Framework context (stage, purpose)
- [ ] **AC5:** Blueprint status atualizado para `applied` apos sucesso
- [ ] **AC6:** Transacao atomica: se falhar no meio, rollback tudo
- [ ] **AC7:** Courses.settings inclui `interactionConfig` conforme S11.1:
  - `configured_by: "blueprint"`
  - `type_defaults` com turns por interaction_type
  - `smart_closing` config

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 2) Implementar `applyBlueprint(blueprintId)`
  - [ ] Criar `packages/course-designer/src/apply-blueprint.ts`
  - [ ] Carregar blueprint do DB com validacao de status (draft/approved)
  - [ ] Criar course com title, settings (blueprint_id, primary_framework, interactionConfig), tenant_id e created_by explicitos
  - [ ] Para cada modulo: criar chapter com title, AI-generated content via `generateObject`, learningObjective, order

- [ ] **Task 2** (AC: 3, 4) Implementar geracao de questions por interaction_type
  - [ ] Definir `QUESTIONS_PER_TYPE` config: socratic_dialogue (3-5), quiz (5-8), scenario (2-3), assignment (1-2)
  - [ ] Gerar questions via `generateObject` baseadas em module content, Bloom level, framework context
  - [ ] Todas as questions criadas com `status = 'pending'`

- [ ] **Task 3** (AC: 7) Configurar interactionConfig no course.settings
  - [ ] `configured_by: "blueprint"`
  - [ ] `type_defaults` com turns por interaction_type
  - [ ] `smart_closing` config

- [ ] **Task 4** (AC: 6) Implementar transacao atomica
  - [ ] Wrap all DB operations em transacao
  - [ ] Rollback completo se falhar em qualquer ponto
  - [ ] Testar cenario de falha parcial

- [ ] **Task 5** (AC: 5) Atualizar status do blueprint
  - [ ] Atualizar blueprint status para `applied` apos sucesso
  - [ ] Apenas dentro da transacao (rollback se falhar depois)

- [ ] **Task 6** (AC: 1) Criar/atualizar API route
  - [ ] Criar/atualizar `apps/web/src/app/api/course-designer/blueprints/[blueprintId]/apply/route.ts`
  - [ ] POST handler com validacao de blueprint status
  - [ ] Role check: `manager` ou `admin`
  - [ ] Retornar `courseId` do curso criado

- [ ] **Task 7** (AC: implicitly all) Validar
  - [ ] Rodar `pnpm typecheck` — deve passar sem erros
  - [ ] Verificar curso criado com chapters e questions corretos
  - [ ] Verificar questions variam por interaction_type
  - [ ] Verificar rollback funciona se falhar no meio
  - [ ] Verificar tenant_id e created_by preenchidos corretamente

---

## Dev Notes

### Technical Notes

IMPORTANTE: `courses.tenant_id` e `courses.created_by` sao NOT NULL sem auto-trigger. Preencher explicitamente no insert.

```typescript
// Questions por interaction_type
const QUESTIONS_PER_TYPE = {
  socratic_dialogue: { min: 3, max: 5 },
  quiz: { min: 5, max: 8 },
  scenario: { min: 2, max: 3 },
  assignment: { min: 1, max: 2 },
}
```

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar Apply Blueprint |
| **@data-engineer (Dara)** | Validar transacao e integridade |
| **@qa (QA)** | Testar criacao de curso completo |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Curso criado com chapters e questions corretos | Yes |
| Pre-PR | Questions variam por interaction_type | Yes |
| Pre-PR | Rollback funciona se falhar no meio | Yes |
| Pre-PR | tenant_id e created_by preenchidos corretamente | Yes |

**Nota PO (AI Content vs Architecture):** AC2 especifica chapter `content` "gerado por IA" via `generateObject`, mas a architecture doc (Seção 11.2) descreve content como `Module description + framework_stages (markdown com placeholders)`. O epic e a story são internamente consistentes (AI-generated), mas divergem da architecture doc. Decisão: seguir o epic (AI-generated content) e atualizar a architecture doc posteriormente.

### File Locations

```
packages/course-designer/src/
├── apply-blueprint.ts             # NOVO

apps/web/src/app/api/course-designer/blueprints/
└── [blueprintId]/apply/route.ts   # NOVO (stub from Epic 21)
```

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-16 | 1.0 | Story creation | River (SM) |
| 2026-02-16 | 1.1 | PO validation: GO — Nota adicionada sobre AI content vs architecture doc; Status Draft → Ready | Pax (PO) |
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
