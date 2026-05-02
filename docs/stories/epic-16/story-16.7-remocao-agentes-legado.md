# Story 16.7: Remocao dos Agentes Legado

**Epic:** [Epic 16 — Core Agents & Pipeline Socratico](../../epics/epic-16-ws1-core-agents-pipeline-socratico.md)
**Version:** 1.0
**Created:** 2026-02-15
**Updated:** 2026-02-15
**Author:** River (SM)
**Status:** Ready
**Story Points:** 3
**Priority:** P1 (apos migracao confirmada)
**Blocked By:** Story 16.6 (migracao API routes confirmada)
**Blocks:** None
**Assigned To:** @dev

---

## User Story

**As a** developer,
**I want** deletar completamente os agentes legado (Socrates, Editor, Tester, Analyst, Profiler antigo),
**so that** o codebase fique limpo e sem codigo morto.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws1-motor-socratico-architecture.md`, Secoes 1, 14-15 |
| **PRD Ref** | `docs/prd/evolucao-eximia-academy-workstreams.md` — WS1: Motor Socratico |
| **Stack** | TypeScript |
| **Package** | `@eximia/agents` |
| **Risk** | LOW — apenas delecao de codigo ja substituido |

---

## Acceptance Criteria

- [ ] **AC1:** Arquivos deletados (12 arquivos):
  - `packages/agents/src/socrates.ts`
  - `packages/agents/src/editor.ts`
  - `packages/agents/src/tester.ts`
  - `packages/agents/src/profiler.ts` (profiler antigo — novo Perfilador e Epic 17)
  - `packages/agents/src/schemas/socrates.ts`
  - `packages/agents/src/schemas/editor.ts`
  - `packages/agents/src/schemas/tester.ts`
  - `packages/agents/src/schemas/profiler.ts`
  - `packages/agents/src/prompts/socrates.ts`
  - `packages/agents/src/prompts/editor.ts`
  - `packages/agents/src/prompts/tester.ts`
  - `packages/agents/src/prompts/profiler.ts`
  - **NAO deletar** `analyst.ts` / `schemas/analyst.ts` / `prompts/analyst.ts` — API route 16.6 mantem analyst em paralelo ate Epic 17 (Detector substitui)
- [ ] **AC2:** Referencias removidas de barrel files (index.ts) — manter exports do analyst
- [ ] **AC3:** `pnpm typecheck` passa sem erros
- [ ] **AC4:** `pnpm build` passa sem erros
- [ ] **AC5:** Manter `creator.ts`, `analyst.ts` e seus schemas/prompts (creator pertence ao WS2, analyst ao Epic 17)
- [ ] **AC6:** Manter fixtures legado MSW (`Harven_*`) temporariamente se testes E2E ainda os referenciam — remover quando E2E migrados

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1) Verificar imports antes de deletar
  - [ ] Buscar todas as importacoes de `socrates`, `editor`, `tester`, `analyst`, `profiler` no monorepo
  - [ ] Verificar que nenhum arquivo importa esses modulos (exceto index.ts e testes)
  - [ ] Se houver imports, listar e resolver antes de deletar

- [ ] **Task 2** (AC: 1) Deletar arquivos de agentes legado (12 arquivos)
  - [ ] Deletar agents: socrates.ts, editor.ts, tester.ts, profiler.ts
  - [ ] Deletar schemas: socrates.ts, editor.ts, tester.ts, profiler.ts
  - [ ] Deletar prompts: socrates.ts, editor.ts, tester.ts, profiler.ts
  - [ ] **NAO deletar**: analyst.ts (API route usa ate Epic 17), creator.ts, organizer.ts, enricher.ts (pertencem a WS2)

- [ ] **Task 3** (AC: 2) Atualizar barrel file
  - [ ] Remover exports legado de `packages/agents/src/index.ts`
  - [ ] Remover export de `orchestrateSocraticDialogue` (v1) — manter apenas `orchestrateSocraticDialogueV2`
  - [ ] Renomear `orchestrateSocraticDialogueV2` para `orchestrateSocraticDialogue` (agora e o unico)

- [ ] **Task 4** (AC: 2) Atualizar API route
  - [ ] Se API route ainda importa o nome antigo `orchestrateSocraticDialogue`, atualizar import

- [ ] **Task 5** (AC: 6) Verificar fixtures MSW
  - [ ] Verificar se `apps/web/src/mocks/handlers.ts` tem fixtures `Harven_*`
  - [ ] Se testes E2E ainda usam `Harven_*`: manter temporariamente com comentario `// LEGADO — remover quando E2E migrados (Epic 19)`
  - [ ] Se nenhum teste referencia: deletar

- [ ] **Task 6** (AC: 3, 4, 5) Validar build completo
  - [ ] `pnpm typecheck` passa
  - [ ] `pnpm build` passa
  - [ ] Verificar que `analyst.ts`, `creator.ts`, `organizer.ts`, `enricher.ts` nao foram afetados

---

## Dev Notes

### Arquivos a DELETAR (12 arquivos)

```
packages/agents/src/
├── socrates.ts           # DELETAR
├── editor.ts             # DELETAR
├── tester.ts             # DELETAR
├── profiler.ts           # DELETAR (profiler antigo)
├── schemas/
│   ├── socrates.ts       # DELETAR
│   ├── editor.ts         # DELETAR
│   ├── tester.ts         # DELETAR
│   └── profiler.ts       # DELETAR
└── prompts/
    ├── socrates.ts       # DELETAR
    ├── editor.ts         # DELETAR
    ├── tester.ts         # DELETAR
    └── profiler.ts       # DELETAR
```

**NAO DELETAR analyst** — `analyst.ts`, `schemas/analyst.ts`, `prompts/analyst.ts` continuam ativos (Story 16.6 mantem analyst rodando em paralelo). Serao removidos no Epic 17 quando Detector substituir.

### Arquivos a MANTER

```
packages/agents/src/
├── analyst.ts            # MANTER (substituido por Detector no Epic 17 — NAO deletar agora)
├── creator.ts            # MANTER (WS2)
├── organizer.ts          # MANTER (WS2)
├── enricher.ts           # MANTER (WS2 — se existente)
├── orchestrator.ts       # MANTER (ja reescrito no 16.4)
├── model-router.ts       # MANTER (criado no 16.3)
├── types.ts              # MANTER (atualizado no 16.1)
├── schemas/analyst.ts    # MANTER (Epic 17 — NAO deletar agora)
├── schemas/creator.ts    # MANTER
├── schemas/organizer.ts  # MANTER
├── schemas/mestre.ts     # MANTER (novo)
├── schemas/polidor.ts    # MANTER (novo)
├── schemas/guardiao.ts   # MANTER (novo)
├── prompts/analyst.ts    # MANTER (Epic 17 — NAO deletar agora)
├── prompts/creator.ts    # MANTER
├── prompts/organizer.ts  # MANTER
├── prompts/mestre.ts     # MANTER (novo)
├── prompts/polidor.ts    # MANTER (novo)
└── prompts/guardiao.ts   # MANTER (novo)
```

[Source: docs/architecture/ws1-motor-socratico-architecture.md, Secao 14]

### Renaming do Orquestrador

Apos remocao do v1, renomear:
- `orchestrateSocraticDialogueV2` → `orchestrateSocraticDialogue`
- Atualizar import na API route
- Isso simplifica a API publica do package

### Testing

- `pnpm typecheck` e `pnpm build` sao os gates criticos
- Testes unitarios legado (se existentes) devem ser removidos junto
- Verificar que testes existentes que usam fixtures `Harven_*` ainda passam

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-15 | 1.0 | Story creation | River (SM) |
| 2026-02-15 | 1.1 | QA fix: analyst.ts removido da lista de delecao (mantem ate Epic 17), 15→12 arquivos | Quinn (QA) + River (SM) |

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
