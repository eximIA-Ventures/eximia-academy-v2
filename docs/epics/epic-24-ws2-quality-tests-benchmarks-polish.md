# Epic 24: WS2 — Quality: Tests, Benchmarks & Polish

**Version:** 1.1
**Created:** 2026-02-16
**Updated:** 2026-02-16
**Author:** Morgan (PM) com arquitetura de Aria (Architect)
**Status:** Draft
**PRD Reference:** `Benchmarks/07_Course_Designer/PRD-Course-Designer-v1.0.md`
**Architecture Reference:** `docs/architecture/ws2-course-creator-architecture.md` — Seções 5, 21
**Workstream:** WS2 (Course Creator — depende de todos os Epics 20-23)

---

## Epic Goal

Garantir qualidade de produção do Course Creator: unit tests para os 5 agentes do pipeline e Framework Registry, integration tests E2E cobrindo fluxo completo (wizard → pipeline → blueprint → apply), benchmark validation comparando blueprints gerados contra cursos reais, e UX polish final (error handling, loading states, accessibility, edge cases).

## Epic Context

| Item | Detalhe |
|------|---------|
| **Stack** | Vitest (unit), Playwright (E2E), MSW (mocking), Next.js 15 |
| **DB Tables** | Todas as tabelas do WS2 (Epics 21-23) |
| **AI Agents** | Todos os agentes do pipeline (Epic 20) — testados |
| **Providers** | MSW mocks para todos os providers em testes |
| **Design Tokens** | Validação de conformidade com theme tokens |
| **Roles Impactados** | Todos (qualidade afeta todos os fluxos) |
| **Package** | `@eximia/agents`, `apps/web` |

---

## Existing System Context

### Infrastructure Already in Place

| Component | Status | Reference |
|-----------|--------|-----------|
| Vitest setup | Implementado | `packages/agents/vitest.config.ts` |
| Playwright setup | Implementado | `apps/web/playwright.config.ts` |
| MSW v2 server-side mocking | Implementado (Epic 16) | `apps/web/src/mocks/handlers.ts` |
| MSW + instrumentation.ts pattern | Implementado | `apps/web/src/instrumentation.ts` |
| Sentry observability | Implementado | Spans por agente |

### Testing Strategy

```
┌────────────────────────────────────────────────────────┐
│                   TEST PYRAMID                          │
│                                                         │
│                    ┌──────┐                             │
│                    │  E2E  │  ← Story 24.2              │
│                    │Playw. │  (fluxo completo)          │
│                   ┌┴──────┴┐                            │
│                   │ Integr. │  ← Story 24.2              │
│                   │ API+DB  │  (pipeline + apply)        │
│                  ┌┴────────┴┐                           │
│                  │   Unit    │  ← Story 24.1              │
│                  │  Agents   │  (cada agente isolado)     │
│                 ┌┴──────────┴┐                          │
│                 │  Benchmark  │  ← Story 24.3             │
│                 │  Validation │  (qualidade do output)    │
│                 └────────────┘                          │
└────────────────────────────────────────────────────────┘
```

---

## Enhancement Details

### Success Criteria

- [ ] Unit tests para cada agente do pipeline com coverage ≥ 80%
- [ ] Integration test: wizard → pipeline → blueprint → apply → course criado
- [ ] E2E test: fluxo completo no browser com MSW mocks
- [ ] Benchmark: blueprints gerados atingem score ≥ 70 para inputs de referência
- [ ] Error handling: todos os edge cases tratados com mensagens claras
- [ ] Loading states: skeleton/spinner em todas as operações async
- [ ] Accessibility: WCAG 2.1 AA para wizard e viewer
- [ ] Zero hardcoded colors — apenas theme tokens

---

## Stories

---

### Story 24.1: Unit Tests — Pipeline Agents + Framework Registry

**As a** developer,
**I want** unit tests completos para cada agente do pipeline e Framework Registry,
**so that** mudanças futuras sejam protegidas por testes automatizados.

**Architecture Reference:** ws2-course-creator-architecture.md, Seções 4, 8

**Story Points:** 5
**Priority:** P0 (qualidade — protege todo o pipeline)
**Risk:** LOW — testes puros, sem side effects

#### Acceptance Criteria

- [ ] **AC1:** Tests para Framework Registry em `packages/agents/src/course-designer/__tests__/framework-registry.test.ts`
  - `getFrameworkConfig("elc_plus")` retorna config com 6 stages
  - `getFrameworkConfig("kolb_4")` retorna config com 4 stages
  - `getFrameworkConfig("pbl_hmelo")` retorna config com 4 stages
  - `getFrameworkConfig("unknown")` throws
  - `listFrameworks()` retorna array com 3 entries
  - Soma de time_percentage = 100 para cada framework
  - Soma de quality_criteria weights = 100 para cada framework
- [ ] **AC2:** Tests para Framework Selector em `__tests__/framework-selector.test.ts`
  - Instructor preference overrides auto selection
  - "resolver problemas" → pbl_hmelo
  - Duration ≤ 10h + non-beginner → kolb_4
  - Default → elc_plus
- [ ] **AC3:** Tests para Input Schema + Brief Score em `__tests__/input-schema.test.ts`
  - Valid input passes schema validation
  - Missing required fields rejects
  - Brief Score calcula corretamente para inputs conhecidos
  - Pre-validation Gate: blocking checks + warnings
  - Cross-validation: weeks × hours_per_week → total_duration_hours
- [ ] **AC4:** Tests para cada agente com MSW mocks em `__tests__/`:
  - `analyzer.test.ts`: output Zod-validated, framework selection logic
  - `architect.test.ts`: output com modules, Bloom progression, ABCD objectives
  - `calculator.test.ts`: soma de minutos = total, chunks ≤ 30min
  - `validator.test.ts`: scorecard calculation, verdict thresholds, neuroscience rules
  - `generator.test.ts`: blueprint schema complete
- [ ] **AC5:** Tests para Neuroscience Rules em `__tests__/neuroscience-rules.test.ts`
  - Cada regra N1-N7 testada com inputs que passam e falham
  - Weights somam 100
- [ ] **AC6:** Tests para Interaction Mapper em `__tests__/interaction-mapper.test.ts`
  - bloom_mapped: correct type per Bloom level
  - Positional adjustments per spiral level
  - dominant: same type for all modules
- [ ] **AC7:** Coverage ≥ 80% para `packages/agents/src/course-designer/`
- [ ] **AC8:** `pnpm test` passa sem erros

#### Technical Notes

Usar MSW v2 `setupServer` para mockar chamadas LLM nos testes dos agentes. Seguir pattern existente em `apps/web/src/mocks/handlers.ts`.

```typescript
// Pattern: MSW mock para agente
server.use(
  http.post('https://api.openai.com/v1/chat/completions', ({ request }) => {
    const body = await request.json()
    if (body.messages[0].content.includes('CourseDesigner_Analyzer')) {
      return HttpResponse.json(mockAnalyzerResponse)
    }
  })
)
```

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Escrever testes |
| **@qa (QA)** | Validar coverage e edge cases |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm test` passa | Yes |
| Pre-PR | Coverage ≥ 80% | Yes |

---

### Story 24.2: Integration Tests — Pipeline E2E + SSE

**As a** developer,
**I want** integration tests que validem o fluxo completo do Course Creator end-to-end,
**so that** regressões sejam detectadas automaticamente.

**Architecture Reference:** ws2-course-creator-architecture.md, Seções 10, 16

**Story Points:** 8
**Priority:** P0 (qualidade)
**Risk:** MEDIUM — E2E com SSE requer setup específico

#### Acceptance Criteria

- [ ] **AC1:** Integration test: pipeline completo
  - Input: CourseDesignerInput fixture válido
  - Executa: designCourse() com MSW mocks
  - Valida: Blueprint output completo, Zod-validated
  - Valida: quality_score ≥ 50, todas as fases executadas
- [ ] **AC2:** Integration test: Apply Blueprint
  - Input: Blueprint fixture
  - Executa: applyBlueprint()
  - Valida: course criado, chapters count = modules count, questions por tipo corretas
  - Valida: tenant_id e created_by preenchidos
- [ ] **AC3:** Integration test: Quality Gate retry
  - Mock Validator para retornar `needs_revision` na 1a chamada
  - Verifica: auto-retry executa (Architect re-chamado com feedback)
  - Mock Validator retorna `good` na 2a chamada
  - Verifica: blueprint final tem score bom
- [ ] **AC4:** Integration test: API routes
  - POST /generate → retorna jobId
  - GET /jobs/[jobId] → retorna status
  - GET /blueprints → lista do tenant
  - GET /blueprints/[id] → blueprint completo
  - PUT /blueprints/[id] → edição com recálculo
  - DELETE /blueprints/[id] → remoção
- [ ] **AC5:** E2E test (Playwright): fluxo completo no browser
  - Login → Cursos → "Criar Blueprint" → Wizard 6 steps → Gerar → Blueprint Viewer
  - MSW server-side mocking (pattern do Epic 16: instrumentation.ts + E2E_TESTING=true)
  - Valida: wizard navegável, geração inicia, blueprint exibido
- [ ] **AC6:** E2E test: edição de blueprint
  - Abre Blueprint Viewer → modo edição → edita título → salva → score recalculado
- [ ] **AC7:** `pnpm test` e `pnpm test:e2e` passam

#### Technical Notes

MSW server-side mocking via `instrumentation.ts` com `E2E_TESTING=true` (pattern comprovado no Epic 16). Usar identifiers únicos nos prompts para handler routing: `CourseDesigner_Analyzer`, `CourseDesigner_Architect`, etc.

LEMBRETE: Agent detection em MSW handler deve usar identifiers ÚNICOS (não keywords genéricas que podem cross-match).

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Escrever testes de integração |
| **@qa (QA)** | Escrever E2E tests Playwright |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm test` passa | Yes |
| Pre-PR | E2E fluxo completo passa | Yes |

---

### Story 24.3: Benchmark Validation — ELC+ vs Real Courses

**As a** product owner,
**I want** validar que blueprints gerados pelo Course Creator atingem qualidade comparável a cursos desenhados manualmente,
**so that** tenhamos confiança na qualidade do output antes de lançar.

**Architecture Reference:** ws2-course-creator-architecture.md, Seção 21 (Riscos)

**Story Points:** 5
**Priority:** P1 (qualidade — pode rodar após launch)
**Risk:** LOW — benchmark é informativo, não bloqueia release

#### Acceptance Criteria

- [ ] **AC1:** 3 fixtures de benchmark em `packages/agents/src/course-designer/__tests__/fixtures/`
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

#### Technical Notes

Benchmarks rodam com chamadas LLM reais (não mocks) para validar qualidade do output. Podem ser executados manualmente ou em CI com flag `BENCHMARK=true`.

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@qa (QA)** | Criar fixtures e benchmark tests |
| **@architect (Aria)** | Validar blueprints de referência |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-PR | Benchmark score ≥ 70 para 3 fixtures | No (informativo) |

---

### Story 24.4: UX Polish — Error Handling, Loading States, Accessibility

**As a** manager,
**I want** que o Course Creator tenha error handling claro, loading states visuais e seja acessível,
**so that** eu tenha uma experiência de uso polida e inclusiva.

**Architecture Reference:** ws2-course-creator-architecture.md, Seções 14, 19

**Story Points:** 5
**Priority:** P1 (polish — funcionalidade core já existe)
**Risk:** LOW — melhorias incrementais

#### Acceptance Criteria

- [ ] **AC1:** Error handling em todos os formulários do wizard
  - Validação inline: erros exibidos abaixo de cada campo em vermelho
  - Toast para erros de API: mensagem clara + ação sugerida
  - Retry button para operações que falharam
  - Mensagens em português (Brasil)
- [ ] **AC2:** Loading states
  - Skeleton loading no Blueprint Viewer enquanto carrega
  - Spinner no "Preencher com IA" durante processamento
  - DesignProgress com animação durante geração
  - Disabled state em botões durante operações async
  - Optimistic updates para edição de blueprint
- [ ] **AC3:** Edge cases tratados
  - Wizard: refresh não perde dados (URL params)
  - Pipeline timeout: mensagem clara + opção de retry
  - Blueprint vazio (0 módulos): mensagem explicativa
  - Arquivo upload > 10MB: mensagem de limite
  - Curso sem chapters (Path B): warning
  - Concurrent editing: last-write-wins com warning
- [ ] **AC4:** Accessibility (WCAG 2.1 AA)
  - Keyboard navigation: wizard navegável via Tab/Enter
  - Focus management: focus move para próximo step ao avançar
  - Screen reader: aria-labels em todos os componentes visuais
  - Color contrast: verificar tokens contra WCAG AA ratios
  - FrameworkStageBar: aria-label com percentuais (não só cor)
  - QualityScorecard: valores numéricos acessíveis (não só visual)
- [ ] **AC5:** Empty states
  - Lista de blueprints vazia: "Nenhum blueprint criado. Comece criando o design do seu curso."
  - Nenhum framework encontrado: fallback message
- [ ] **AC6:** Confirmação antes de ações destrutivas
  - Deletar blueprint: modal de confirmação
  - Aplicar blueprint: confirmação com resumo (N chapters, N questions serão criados)
  - Descartar edições: "Tem certeza? Alterações não salvas serão perdidas."

#### Technical Notes

Usar componentes `@eximia/ui` existentes: Toast, Alert, Skeleton, Modal. Accessibility pode ser validada com `axe-core` no E2E.

```typescript
// Exemplo: Toast para erro de API
toast.error({
  title: "Erro ao gerar blueprint",
  description: "O pipeline não respondeu em tempo. Tente novamente.",
  action: { label: "Retry", onClick: () => handleGenerate() }
})
```

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar polish |
| **@ux-design-expert** | Validar UX e accessibility |
| **@qa (QA)** | Testar edge cases |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Zero console errors no browser | Yes |
| Pre-PR | Keyboard navigation funciona no wizard | Yes |

---

## Dependency Graph

```
Story 24.1 (Unit Tests)          Story 24.4 (UX Polish — depende de Epic 22, não de 24.x)
    ↓                                 │
Story 24.2 (Integration + E2E)       │ (paralelo)
    ↓                                 │
Story 24.3 (Benchmark)               │
    ↓                                 ↓
    └──── Todos prontos → WS2 Done ──┘
```

**Ordem de execução sugerida:** (24.1 + 24.4 em paralelo) → 24.2 → 24.3

**Dependência inter-epic:** Todos os Epics 20-23 devem estar substancialmente concluídos.

---

## Compatibility Requirements

- [ ] Testes existentes do WS1 continuam passando
- [ ] MSW handlers do WS1 não são afetados
- [ ] CI pipeline suporta novos testes sem timeout
- [ ] Benchmark não roda em CI padrão (flag BENCHMARK=true)

---

## Risk Mitigation

| Risco | Impacto | Mitigação | Rollback |
|---|---|---|---|
| E2E tests flaky com SSE | Médio | Polling fallback nos testes, retry logic | Desabilitar SSE tests temporariamente |
| Benchmark LLM-dependent (non-deterministic) | Baixo | Thresholds com margem, media de 3 runs | Relaxar thresholds |
| Accessibility issues em componentes custom | Médio | axe-core validation, screen reader testing | Corrigir iterativamente |
| Coverage 80% difícil para LLM-dependent code | Médio | Mockar LLM calls, testar lógica ao redor | Reduzir threshold para 70% |

---

## New File Locations

```
packages/agents/src/course-designer/__tests__/
├── framework-registry.test.ts          # NOVO
├── framework-selector.test.ts          # NOVO
├── input-schema.test.ts                # NOVO
├── analyzer.test.ts                    # NOVO
├── architect.test.ts                   # NOVO
├── calculator.test.ts                  # NOVO
├── validator.test.ts                   # NOVO
├── generator.test.ts                   # NOVO
├── neuroscience-rules.test.ts          # NOVO
├── interaction-mapper.test.ts          # NOVO
├── orchestrator.test.ts                # NOVO
├── apply-blueprint.test.ts             # NOVO
├── benchmark.test.ts                   # NOVO
├── fixtures/
│   ├── leadership-course.fixture.ts    # NOVO
│   ├── programming-course.fixture.ts   # NOVO
│   └── problem-solving-course.fixture.ts # NOVO

apps/web/e2e/
├── course-designer.spec.ts             # NOVO — Playwright E2E
├── blueprint-viewer.spec.ts            # NOVO — Playwright E2E

apps/web/src/mocks/
├── course-designer-handlers.ts         # NOVO — MSW handlers para pipeline

docs/qa/benchmark-reports/
└── (generated at runtime)              # NOVO directory
```

---

## Definition of Done

- [ ] Unit tests: coverage ≥ 80% para course-designer/
- [ ] Integration tests: pipeline E2E passa com mocks
- [ ] E2E tests: fluxo completo no browser passa
- [ ] Benchmark: score ≥ 70 para 3 fixtures
- [ ] Error handling: todos os edge cases tratados
- [ ] Loading states: skeleton/spinner em operações async
- [ ] Accessibility: WCAG 2.1 AA para wizard e viewer
- [ ] Zero console errors
- [ ] `pnpm test`, `pnpm build`, `pnpm typecheck` passam

---

## Total Story Points

| Story | Título | SP | Dependência |
|-------|--------|---:|-------------|
| 24.1 | Unit Tests (Agents + Registry) | 5 | Epics 20-23 |
| 24.2 | Integration + E2E Tests | 8 | 24.1, Epics 20-23 |
| 24.3 | Benchmark Validation | 5 | 24.2 |
| 24.4 | UX Polish (Errors, Loading, A11y) | 5 | Epic 22 |
| **Total** | | **23** | |

---

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-02-16 | 1.0 | Criação do épico | Morgan (PM) |
| 2026-02-16 | 1.1 | Validação @po: fix dep graph (24.4 paralelo, não após 24.2) | Pax (PO) |
