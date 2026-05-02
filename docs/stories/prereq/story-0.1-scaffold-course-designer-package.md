# Story 0.1: Scaffold Package @eximia/course-designer

**Epic:** Prereq — Modularizacao WS2
**Version:** 1.0
**Created:** 2026-02-17
**Updated:** 2026-02-17
**Author:** River (SM)
**Status:** Ready for Review
**Story Points:** 1
**Priority:** P0 (blocker — todos os epics 20-24 dependem deste)
**Blocked By:** None
**Blocks:** Story 0.2, Story 20.1, Story 20.2, Story 20.3, Story 20.4, Story 20.5, Story 20.6, Story 20.7
**Assigned To:** @dev

---

## User Story

**As a** developer,
**I want** um package separado `@eximia/course-designer` no monorepo,
**so that** o Course Creator (WS2) seja um modulo independente, desacoplado do WS1, permitindo billing e ativacao por tenant no futuro.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | Decisao arquitetural da sessao 2026-02-17 (Aria) — modularizacao comercial |
| **Decision** | D19: Modularizacao — WS2 como package separado `@eximia/course-designer` |
| **Stack** | TypeScript, pnpm workspaces, Turborepo |
| **Package** | `@eximia/course-designer` (NOVO) |
| **Existing Pattern** | `packages/agents/package.json`, `packages/shared/package.json` (seguir pattern) |
| **Risk** | LOW — scaffold puro, sem logica de negocio |

---

## Acceptance Criteria

- [ ] **AC1:** Diretorio `packages/course-designer/` existe com `package.json` valido
  - `name`: `@eximia/course-designer`
  - `version`: `0.1.0`
  - `private`: `true`
  - `main` e `types`: `./src/index.ts`
  - `scripts`: `lint`, `typecheck`, `test` (mesmos de `@eximia/agents`)
  - `dependencies`: `@eximia/shared` (workspace:*), `@eximia/database` (workspace:*), `ai` (^6.0.77), `zod` (^3.25.76)
  - `devDependencies`: `typescript` (^5.7.0), `vitest` (^3.0.0)
- [ ] **AC2:** `tsconfig.json` existe e extends `../../tsconfig.json` (mesmo pattern de `@eximia/agents`)
- [ ] **AC3:** `src/index.ts` existe como barrel file vazio (placeholder com comentario)
- [ ] **AC4:** Estrutura de diretorios criada:
  ```
  packages/course-designer/src/
    schemas/
    registry/
    agents/
    pipeline/
    index.ts
  packages/course-designer/tests/
    schemas/
    registry/
    agents/
    pipeline/
  ```
- [ ] **AC5:** `apps/web/package.json` inclui `"@eximia/course-designer": "workspace:*"` em dependencies
- [ ] **AC6:** `pnpm install` executa sem erros
- [ ] **AC7:** `pnpm typecheck` passa sem erros (incluindo o novo package)

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [x] **Task 1** (AC: 1) Criar `packages/course-designer/package.json`
  - [x] Criar arquivo seguindo pattern de `packages/agents/package.json`
  - [x] Ajustar name, dependencies conforme AC1

- [x] **Task 2** (AC: 2) Criar `packages/course-designer/tsconfig.json`
  - [x] Copiar pattern de `packages/agents/tsconfig.json`

- [x] **Task 3** (AC: 3, 4) Criar estrutura de diretorios e barrel file
  - [x] Criar `src/index.ts` com comentario placeholder
  - [x] Criar diretorios vazios: `src/schemas/`, `src/registry/`, `src/agents/`, `src/pipeline/`
  - [x] Criar diretorios de testes: `tests/schemas/`, `tests/registry/`, `tests/agents/`, `tests/pipeline/`
  - [x] Adicionar `.gitkeep` nos diretorios vazios

- [x] **Task 4** (AC: 5) Atualizar `apps/web/package.json`
  - [x] Adicionar `"@eximia/course-designer": "workspace:*"` em dependencies

- [x] **Task 5** (AC: 6, 7) Validar
  - [x] Rodar `pnpm install` — deve passar sem erros
  - [x] Rodar `pnpm typecheck` — deve passar sem erros (package isolado OK; web tem erro pre-existente em blueprint-generator.tsx:79)

---

## Dev Notes

### Technical Notes

Seguir exatamente o pattern dos packages existentes (`@eximia/agents`, `@eximia/shared`). O `pnpm-workspace.yaml` ja inclui `packages/*` via glob, entao nenhuma alteracao e necessaria nele.

**Dependencias do novo package:**
- `@eximia/shared` — types compartilhados (InteractionType, BloomLevel se necessario)
- `@eximia/database` — acesso a dados (futuro, Epics 21+)
- `ai` — AI SDK para os agentes do pipeline
- `zod` — schemas de validacao

**NAO depende de:**
- `@eximia/agents` — zero acoplamento com WS1 (decisao arquitetural D19)

### File Locations

```
packages/course-designer/        # NOVO — package inteiro
packages/course-designer/package.json
packages/course-designer/tsconfig.json
packages/course-designer/src/
  index.ts                        # barrel placeholder
  schemas/                        # Epic 20: Stories 20.1, 20.3
  registry/                       # Epic 20: Story 20.2
  agents/                         # Epic 20: Stories 20.4-20.7
  pipeline/                       # Epic 21
packages/course-designer/tests/
  schemas/                        # testes para schemas
  registry/                       # testes para registry
  agents/                         # testes para agents
  pipeline/                       # testes para pipeline
apps/web/package.json             # MODIFICADO — nova dependency
```

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-17 | 1.0 | Story creation — modularizacao WS2 | River (SM) |
| 2026-02-17 | 1.1 | PO validation: GO — adicionado tests/ dir, Status Draft → Ready | Pax (PO) |
| 2026-02-17 | 1.2 | Implementation complete — all tasks done, typecheck OK | Dex (Dev) |

---

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (via Dex @dev)

### Debug Log References
Nenhum — execucao sem erros.

### Completion Notes List
- Package `@eximia/course-designer` criado com sucesso seguindo pattern de `@eximia/agents`
- `pnpm install` OK — workspace resolution sem erros
- `pnpm typecheck` do package isolado: PASS (zero errors)
- `pnpm typecheck` global: erro pre-existente em `apps/web/src/components/blueprint/blueprint-generator.tsx:79` (type "primary" not assignable) — nao relacionado a esta story
- Zero acoplamento com `@eximia/agents` confirmado (nao e dependencia)

### File List
| File | Action |
|------|--------|
| `packages/course-designer/package.json` | Created |
| `packages/course-designer/tsconfig.json` | Created |
| `packages/course-designer/src/index.ts` | Created |
| `packages/course-designer/src/schemas/.gitkeep` | Created |
| `packages/course-designer/src/registry/.gitkeep` | Created |
| `packages/course-designer/src/agents/.gitkeep` | Created |
| `packages/course-designer/src/pipeline/.gitkeep` | Created |
| `packages/course-designer/tests/schemas/.gitkeep` | Created |
| `packages/course-designer/tests/registry/.gitkeep` | Created |
| `packages/course-designer/tests/agents/.gitkeep` | Created |
| `packages/course-designer/tests/pipeline/.gitkeep` | Created |
| `apps/web/package.json` | Modified — added `@eximia/course-designer` dep |

---

## QA Results
_To be filled by @qa_
