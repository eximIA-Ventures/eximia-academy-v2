# Story 24.3: Benchmark Validation — Multi-Framework vs Reference Courses

**Epic:** [Epic 24 — WS2: Quality: Tests, Benchmarks & Polish](../../epics/epic-24-ws2-quality-tests-benchmarks-polish.md)
**Version:** 1.2
**Created:** 2026-02-16
**Updated:** 2026-02-17
**Author:** River (SM)
**Status:** Ready
**Story Points:** 5
**Priority:** P1 (qualidade — pode rodar após launch)
**Blocked By:** Story 24.2
**Blocks:** None
**Assigned To:** @dev

---

## User Story

**As a** product owner,
**I want** validar que blueprints gerados pelo Course Creator atingem qualidade comparável a cursos desenhados manualmente,
**so that** tenhamos confiança na qualidade do output antes de lançar.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws2-course-creator-architecture.md`, Seção 21 (Riscos) |
| **PRD Ref** | `Benchmarks/07_Course_Designer/PRD-Course-Designer-v1.0.md` — WS2: Course Creator |
| **Stack** | Vitest, TypeScript, LLM providers (real calls) |
| **Package** | `@eximia/course-designer` |
| **Existing Pattern** | `packages/course-designer/vitest.config.ts` |
| **Risk** | LOW — benchmark é informativo, não bloqueia release |

---

## Acceptance Criteria

- [ ] **AC1:** 3 fixtures de benchmark em `packages/course-designer/src/__tests__/fixtures/`
  - Fixture 1: Curso de liderança (8h, intermediário, ELC+)
  - Fixture 2: Curso de programação (20h, iniciante, Kolb)
  - Fixture 3: Curso de resolução de problemas (12h, avançado, PBL)
  - Cada fixture: input + expected output (blueprint de referência)
- [ ] **AC2:** Benchmark test script em `__tests__/benchmark.test.ts`
  - Para cada fixture: gera blueprint e compara com referência
  - Métricas:
    - Quality Score ≥ 70 (good ou excellent)
    - Bloom progression é ascending
    - Module count within ±2 do esperado
    - Neuroscience rules: ≥ 5 de 7 passam
    - Interaction types distribuídos (não todos iguais)
- [ ] **AC3:** Relatório de benchmark salvo em `docs/qa/benchmark-reports/`
  - Formato: data, fixture, scores, pass/fail por métrica
  - Comparação temporal: score atual vs. anterior
- [ ] **AC4:** Benchmark passa para os 3 frameworks v1
- [ ] **AC5:** Documentar áreas de melhoria identificadas pelo benchmark

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1) Criar fixtures de benchmark
  - [ ] Criar `packages/course-designer/src/__tests__/fixtures/leadership-course.fixture.ts`
    - Input: curso de liderança, 8h, intermediário, ELC+
    - Expected output: blueprint de referência com módulos, Bloom progression, scores
  - [ ] Criar `packages/course-designer/src/__tests__/fixtures/programming-course.fixture.ts`
    - Input: curso de programação, 20h, iniciante, Kolb
    - Expected output: blueprint de referência
  - [ ] Criar `packages/course-designer/src/__tests__/fixtures/problem-solving-course.fixture.ts`
    - Input: curso de resolução de problemas, 12h, avançado, PBL
    - Expected output: blueprint de referência

- [ ] **Task 2** (AC: 2) Criar benchmark test script
  - [ ] Criar `packages/course-designer/src/__tests__/benchmark.test.ts`
  - [ ] Para cada fixture: executar pipeline e gerar blueprint (chamadas LLM reais)
  - [ ] Validar Quality Score ≥ 70 (good ou excellent)
  - [ ] Validar Bloom progression é ascending
  - [ ] Validar Module count within ±2 do esperado
  - [ ] Validar Neuroscience rules: ≥ 5 de 7 passam
  - [ ] Validar Interaction types distribuídos (não todos iguais)
  - [ ] Configurar flag `BENCHMARK=true` para execução condicional

- [ ] **Task 3** (AC: 3) Criar geração de relatório de benchmark
  - [ ] Criar diretório `docs/qa/benchmark-reports/`
  - [ ] Gerar relatório com formato: data, fixture, scores, pass/fail por métrica
  - [ ] Implementar comparação temporal: score atual vs. anterior (se existir)

- [ ] **Task 4** (AC: 4) Validar benchmark para 3 frameworks
  - [ ] Executar benchmark para ELC+ (liderança)
  - [ ] Executar benchmark para Kolb (programação)
  - [ ] Executar benchmark para PBL (resolução de problemas)
  - [ ] Todos devem passar os thresholds definidos

- [ ] **Task 5** (AC: 5) Documentar áreas de melhoria
  - [ ] Analisar resultados do benchmark
  - [ ] Documentar áreas onde blueprints gerados ficam abaixo de referências manuais
  - [ ] Registrar sugestões de melhoria para iterações futuras

---

## Dev Notes

### Technical Notes

Benchmarks rodam com chamadas LLM reais (não mocks) para validar qualidade do output. Podem ser executados manualmente ou em CI com flag `BENCHMARK=true`.

```typescript
// Pattern: Benchmark test condicional
import { describe, it, expect } from 'vitest'

const BENCHMARK_ENABLED = process.env.BENCHMARK === 'true'

describe.skipIf(!BENCHMARK_ENABLED)('Course Designer Benchmark', () => {
  it('leadership course (ELC+) meets quality threshold', async () => {
    const blueprint = await designCourse(leadershipFixture.input)
    expect(blueprint.quality_score).toBeGreaterThanOrEqual(70)
    // ... more assertions
  }, { timeout: 120_000 }) // LLM calls take time
})
```

NOTA: Benchmarks NÃO rodam em CI padrão (evitar custos e flakiness). Apenas com `BENCHMARK=true`.

**Nota PO (Fixtures e Framework Selector):** Fixtures 1 (liderança, 8h, intermediário, ELC+) e 2 (programação, 20h, iniciante, Kolb) especificam frameworks que contradizem o Framework Selector decision tree (architecture Seção 4.6). Estes fixtures devem usar `framework: "elc_plus"` / `framework: "kolb_4"` como preferência explícita do instrutor (`instructor_preferred_framework`), não seleção automática.

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-PR | Benchmark score ≥ 70 para 3 fixtures | No (informativo) |

### File Locations

```
packages/course-designer/src/__tests__/
├── benchmark.test.ts                   # NOVO
├── fixtures/
│   ├── leadership-course.fixture.ts    # NOVO
│   ├── programming-course.fixture.ts   # NOVO
│   └── problem-solving-course.fixture.ts # NOVO

docs/qa/benchmark-reports/              # NOVO directory
```

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-16 | 1.0 | Story creation | River (SM) |
| 2026-02-16 | 1.1 | PO validation: GO — Título corrigido (Multi-Framework); nota fixtures adicionada; Status Draft → Ready | Pax (PO) |
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
