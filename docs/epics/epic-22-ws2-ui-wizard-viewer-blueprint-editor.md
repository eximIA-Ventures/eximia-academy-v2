# Epic 22: WS2 — UI: Wizard, Viewer & Blueprint Editor

**Version:** 1.1
**Created:** 2026-02-16
**Updated:** 2026-02-16
**Author:** Morgan (PM) com arquitetura de Aria (Architect)
**Status:** Draft
**PRD Reference:** `Benchmarks/07_Course_Designer/PRD-Course-Designer-v1.0.md`
**Architecture Reference:** `docs/architecture/ws2-course-creator-architecture.md` — Seções 12, 14, 19
**Workstream:** WS2 (Course Creator — depende dos Epics 20-21 para backend)

---

## Epic Goal

Construir toda a interface do Course Creator: Wizard de 6 steps com "Preencher com IA", Framework Selector visual, Design Progress (stepper das 5 fases), Blueprint Viewer editável (D11) com módulos drag-and-drop, Quality Scorecard visual, Bloom Progression chart e componentes especializados (ProblemaMotorCard, RubricViewer, FrameworkStageBar).

## Epic Context

| Item | Detalhe |
|------|---------|
| **Stack** | Next.js 15, React, `@eximia/ui`, Tailwind CSS v4 |
| **DB Tables** | Consome APIs do Epic 21 (zero acesso direto ao DB) |
| **AI Agents** | N/A (consome APIs que invocam agentes) |
| **Providers** | N/A (frontend) |
| **Design Tokens** | `apps/web/src/styles/theme.css` — todos os tokens existentes |
| **Roles Impactados** | manager (cria/edita blueprints) |
| **Package** | `apps/web` |

---

## Existing System Context

### Infrastructure Already in Place

| Component | Status | Reference |
|-----------|--------|-----------|
| Design System `@eximia/ui` | Implementado (29 componentes) | `packages/ui/` |
| Tailwind v4 theme tokens | Implementado | `apps/web/src/styles/theme.css` |
| Design System Guide | Implementado | `docs/design-system-guide.md` |
| Platform layout | Implementado | `apps/web/src/app/(platform)/` |
| Courses pages | Implementado | `apps/web/src/app/(platform)/courses/` |

### Current Flow

```
Manager acessa /courses
    → Cria curso manualmente (título, descrição)
    → Adiciona capítulos um a um
    → Sem design instrucional, sem blueprint visual
```

### What This Epic Changes

```
Manager acessa /courses/new/design
    → Wizard 6 steps (Propósito → Audiência → Escopo → Restrições → Preferências → Pre-validation)
    → "Preencher com IA" em cada step
    → Framework Selector visual (3 frameworks + auto)
    → Pre-validation Gate com Brief Score
    → Clica "Gerar Blueprint"
    → Design Progress: stepper visual das 5 fases + SSE progress
    → Blueprint Viewer: módulos, stages, scorecard, Bloom progression
    → Editar: textos, ordem, interaction types, durações
    → Quality Scorecard recalcula ao salvar
    → "Aplicar ao Curso" (Epic 23)
```

---

## Enhancement Details

### Wizard 6 Steps

```
┌──────────────────────────────────────────────────────┐
│  COURSE DESIGNER WIZARD                               │
│                                                       │
│  [1. Propósito] → [2. Audiência] → [3. Escopo]      │
│       → [4. Restrições] → [5. Preferências]          │
│            → [6. Pre-validation & Generate]           │
│                                                       │
│  Cada step tem botão "Preencher com IA"              │
│  Step 6 mostra Brief Score + checks + warnings       │
│  Botão "Gerar Blueprint" habilitado se valid          │
└──────────────────────────────────────────────────────┘
```

### Blueprint Viewer (Editável — D11)

```
┌──────────────────────────────────────────────────────┐
│  BLUEPRINT VIEWER                                     │
│                                                       │
│  ┌─ Metadata ──────────────────────────────────────┐ │
│  │ Título, Framework, Duration, Score               │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  ┌─ Quality Scorecard ─────────────────────────────┐ │
│  │ [Framework: 85] [Neuro: 78] = [Final: 83] GOOD  │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  ┌─ Bloom Progression ─────────────────────────────┐ │
│  │ Remember → Understand → Apply → ... → Create     │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  ┌─ Modules ───────────────────────────────────────┐ │
│  │ [Module 1] [Module 2] [Module 3] ...             │ │
│  │ Cada módulo: ModuleCard + FrameworkStageBar      │ │
│  │ + ProblemaMotorCard + RubricViewer               │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  [Editar] [Exportar JSON] [Aplicar ao Curso]         │
└──────────────────────────────────────────────────────┘
```

### Componentes Novos

| Componente | Tipo | Descrição |
|------------|------|-----------|
| `CourseDesignerWizard` | Organism | Stepper 6 steps completo |
| `FrameworkSelector` | Molecule | Grid visual: 3 frameworks + auto |
| `DesignProgress` | Molecule | Stepper visual das 5 fases (SSE) |
| `BlueprintViewer` | Organism | Layout completo, editável |
| `ModuleCard` | Molecule | Card com framework stage bar |
| `FrameworkStageBar` | Atom | Barra horizontal N segmentos % |
| `QualityScorecard` | Molecule | Framework Score + Neuro Score |
| `BloomProgression` | Molecule | Progressão visual 6 níveis |
| `ProblemaMotorCard` | Molecule | Case study card |
| `RubricViewer` | Molecule | Tabela 3 níveis por critério |
| `BriefScoreIndicator` | Atom | Score 0-100 visual |

### Success Criteria

- [ ] Wizard 6 steps navegável com validação por step
- [ ] "Preencher com IA" funciona em cada step
- [ ] Framework Selector visual com 3 frameworks + auto + badge "Recomendado"
- [ ] Brief Score calcula e exibe visualmente
- [ ] Design Progress mostra 5 fases com SSE progress real-time
- [ ] Blueprint Viewer exibe módulos com all dados
- [ ] Edição funciona: textos, ordem, interaction_type, durações
- [ ] Quality Scorecard recalcula ao salvar edições
- [ ] Todos os componentes usam `@eximia/ui` base + theme tokens
- [ ] Responsivo: funciona em desktop e tablet

---

## Stories

---

### Story 22.1: Course Designer Wizard — Stepper 6 Steps

**As a** manager,
**I want** um wizard multi-step guiado para preencher o Course Design Brief,
**so that** eu consiga criar blueprints sem conhecimento técnico de design instrucional.

**Architecture Reference:** ws2-course-creator-architecture.md, Seção 14

**Story Points:** 5
**Priority:** P0 (fundação da UI)
**Risk:** MEDIUM — UX complexa com 6 steps, state management

#### Acceptance Criteria

- [ ] **AC1:** Page em `apps/web/src/app/(platform)/courses/new/design/page.tsx`
  - Acessível via menu de cursos (botão "Criar Blueprint")
  - Requer role `manager` ou `admin`
- [ ] **AC2:** `CourseDesignerWizard` component em `_components/course-designer-wizard.tsx`
  - Stepper horizontal com 6 steps nomeados
  - Navegação: Próximo / Voltar / Ir para step
  - Validação por step: não avança se campos obrigatórios vazios
  - State persistido em URL params (refresh não perde dados)
- [ ] **AC3:** Usa componentes `@eximia/ui`: Card, Button, Tabs, ProgressBar
- [ ] **AC4:** Stepper visual indica: step atual, steps concluídos, steps futuros
- [ ] **AC5:** Responsivo: stack vertical em mobile/tablet, horizontal em desktop
- [ ] **AC6:** Botão "Preencher com IA" como ação global (disponível em todos os steps)

#### Technical Notes

State management via React Hook Form + Zod resolver (schema do Epic 20.3). URL params via `useSearchParams` para persistência.

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar wizard + stepper |
| **@ux-design-expert** | Validar fluxo UX |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Navegação entre 6 steps funciona | Yes |
| Pre-PR | Usa componentes `@eximia/ui` (zero HTML/CSS ad-hoc) | Yes |

---

### Story 22.2: Steps 1-2 — Propósito & Audiência

**As a** manager,
**I want** preencher o propósito do curso (business goal, behavior change) e definir a audiência (role, experience level),
**so that** o pipeline tenha contexto para design instrucional personalizado.

**Architecture Reference:** ws2-course-creator-architecture.md, Seções 6.1-6.2

**Story Points:** 5
**Priority:** P0 (core)
**Risk:** LOW — formulários com campos definidos

#### Acceptance Criteria

- [ ] **AC1:** `PurposeStep` component em `_components/purpose-step.tsx` (Step 1)
  - Campos: `course_title` (Input, obrigatório), `business_goal` (Textarea, obrigatório), `behavior_change` (Textarea, obrigatório)
  - Campos opcionais: `success_metrics` (lista dinâmica de strings), `problem_statement` (Textarea)
  - Helper text explicando cada campo (ex: "O que muda na organização?")
  - Validação: title ≥ 5 chars, business_goal ≥ 10 chars, behavior_change ≥ 10 chars
- [ ] **AC2:** `AudienceStep` component em `_components/audience-step.tsx` (Step 2)
  - Campos obrigatórios: `role` (Input), `experience_level` (Select: iniciante, intermediário, avançado, especialista)
  - Campos opcionais: `prior_knowledge` (tag input), `group_size` (NumberInput), `motivation_context` (Textarea), `learning_environment` (Select), `autonomy_level` (Select)
- [ ] **AC3:** "Preencher com IA" nos dois steps
  - Chama `POST /api/course-designer/ai-fill` (Epic 21.4 AC9) com step atual e campos preenchidos
  - Preview dos valores sugeridos antes de aceitar (confidence score por campo)
  - Instrutor pode aceitar todos, editar individualmente, ou descartar
- [ ] **AC4:** Validação inline: erros exibidos abaixo de cada campo
- [ ] **AC5:** Usa `@eximia/ui`: Input, Textarea, Select, Button, Card, Badge
- [ ] **AC6:** Tokens: `bg-bg-card`, `text-text-primary`, `rounded-md` — zero hex/rgba

#### Technical Notes

React Hook Form com Zod resolver. "Preencher com IA" faz POST para API que usa `generateObject` para sugerir valores.

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar formulários |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Validação inline funciona | Yes |

---

### Story 22.3: Steps 3-4 — Escopo & Restrições

**As a** manager,
**I want** definir o escopo do curso (competências, tópicos, uploads) e restrições (duração, delivery mode),
**so that** o pipeline saiba o que cobrir e dentro de quais limites.

**Architecture Reference:** ws2-course-creator-architecture.md, Seções 6.3-6.4

**Story Points:** 5
**Priority:** P0 (core)
**Risk:** MEDIUM — upload de arquivos + course selector para Path B

#### Acceptance Criteria

- [ ] **AC1:** `ScopeStep` component em `_components/scope-step.tsx` (Step 3)
  - `core_competencies` (tag input — lista de competências)
  - `topics_outline` (tag input ou lista dinâmica)
  - `content_density` (Select: lean, moderada, densa)
  - `assessment_preference` (Select: formativa, somativa, mista)
  - `context_files` (file upload — PDF, PPTX, DOCX, TXT — max 10MB)
  - `existing_materials_summary` (Textarea)
  - `source_course_id` (Course Selector — para Caminho B, Epic 23)
  - Nota: "Ao menos 1 fonte: competências, tópicos, arquivos ou curso existente"
- [ ] **AC2:** File upload com preview (nome, tipo, tamanho)
  - Se Content Analyzer disponível (Epic 21.5): upload chama API, mostra loading, resultado pré-preenche `topics_outline` e sugere `core_competencies`
  - Instrutor revisa antes de aceitar
  - **Graceful degradation**: se 21.5 não disponível, upload salva arquivo e exibe mensagem "Análise automática em breve" (campo fica editável manualmente)
- [ ] **AC3:** `ConstraintsStep` component em `_components/constraints-step.tsx` (Step 4)
  - `total_duration_hours` (NumberInput, obrigatório, min 1, max 200)
  - `weeks` (NumberInput, opcional)
  - `hours_per_week` (NumberInput, opcional)
  - Auto-cálculo: se weeks × hours_per_week preenchidos → calcula total_duration_hours
  - `delivery_mode` (Select: presencial, online_sync, online_async, híbrido)
  - `cohort_based` (Checkbox)
  - `session_length_preference` (NumberInput, min 15, max 240, em minutos)
- [ ] **AC4:** Warning visual se duração < 4h: "Cursos abaixo de 4h geram blueprints limitados"
- [ ] **AC5:** Usa `@eximia/ui` para todos os componentes de formulário
- [ ] **AC6:** Zero hex/rgba — apenas theme tokens

#### Technical Notes

File upload via `FormData`. Content Analyzer é assíncrono — mostrar skeleton loading durante processamento. Course Selector para Path B será implementado no Epic 23, mas o slot no form já deve existir (disabled com label "Em breve").

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar formulários + file upload |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Upload de PDF funciona e mostra resultados da análise | Yes |
| Pre-PR | Auto-cálculo weeks × hours funciona | Yes |

---

### Story 22.4: Steps 5-6 — Preferências & Pre-validation + Generate

**As a** manager,
**I want** selecionar o framework e estratégia de interação, ver o Brief Score, e iniciar a geração do blueprint com progress visual,
**so that** eu saiba se meu input é suficiente e acompanhe a geração em tempo real.

**Architecture Reference:** ws2-course-creator-architecture.md, Seções 6.5-6.6, 10.1

**Story Points:** 5
**Priority:** P0 (core — onde a geração acontece)
**Risk:** MEDIUM — SSE consumption no frontend, Brief Score UX

#### Acceptance Criteria

- [ ] **AC1:** `PreferencesStep` component em `_components/preferences-step.tsx` (Step 5)
  - `FrameworkSelector` visual: grid com 3 cards (ELC+, Kolb, PBL) + card "Auto"
    - Cada card mostra: nome, stages count, descrição curta, ícone
    - Card "Auto" com badge "Recomendado" quando framework=auto
    - Card selecionado com border accent
  - `interaction_strategy` (Select: bloom_mapped, dominant, custom)
  - `dominant_interaction_type` (Select, visível apenas se strategy=dominant)
  - `language` (Select: pt-br, en)
  - Data dos frameworks vem da API `GET /api/course-designer/frameworks`
- [ ] **AC2:** `PrevalidationStep` component em `_components/prevalidation-step.tsx` (Step 6)
  - `BriefScoreIndicator`: score 0-100 visual (gauge ou circular progress)
    - Faixas: 90-100 Excelente (verde), 70-89 Bom (azul), 50-69 Suficiente (amarelo), <50 Mínimo (vermelho)
  - Lista de checks obrigatórios: pass/fail com ícone
  - Lista de warnings: amarelo com sugestão de melhoria
  - Botão "Gerar Blueprint" habilitado somente se todos os checks obrigatórios passam
- [ ] **AC3:** `DesignProgress` component em `_components/design-progress.tsx`
  - Exibido após clicar "Gerar Blueprint"
  - Stepper vertical com 5 fases: Analyzer, Architect, Calculator, Validator, Generator
  - Cada fase mostra: status (pending, running, completed, failed), tempo decorrido
  - Conecta via SSE ao `POST /api/course-designer/generate`
  - Reconexão automática se SSE desconectar (usa job polling como fallback)
- [ ] **AC4:** Ao completar, redireciona para Blueprint Viewer (`/courses/[courseId]/blueprint`)
- [ ] **AC5:** Handling de erros: se pipeline falha, mostra mensagem com opção de retry
- [ ] **AC6:** `FrameworkSelector` como componente reutilizável em `_components/framework-selector.tsx`

#### Technical Notes

SSE consumption via `EventSource` API ou fetch + ReadableStream. Heartbeat handling para manter conexão. Brief Score usa `calculateBriefScore()` do schema (Epic 20.3) — pode rodar client-side.

```typescript
// SSE consumption
const eventSource = new EventSource(`/api/course-designer/generate?jobId=${jobId}`)
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data)
  setPhases(prev => prev.map(p =>
    p.phase === data.phase ? { ...p, status: data.status } : p
  ))
}
```

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar Steps 5-6 + SSE client |
| **@ux-design-expert** | Validar UX do Brief Score e Design Progress |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Framework Selector visual funciona | Yes |
| Pre-PR | Brief Score calcula corretamente | Yes |
| Pre-PR | Design Progress recebe SSE events | Yes |

---

### Story 22.5: Blueprint Viewer — Módulos + Editabilidade (D11)

**As a** manager,
**I want** visualizar o blueprint gerado com todos os módulos e poder editar textos, ordem e interaction types,
**so that** eu customize o design instrucional antes de aplicar ao curso.

**Architecture Reference:** ws2-course-creator-architecture.md, Seções 12, 17 (file structure)

**Story Points:** 8
**Priority:** P0 (core)
**Risk:** MEDIUM — edição com recálculo de score, drag-and-drop, integração com API

#### Acceptance Criteria

- [ ] **AC1:** Page em `apps/web/src/app/(platform)/courses/[courseId]/blueprint/page.tsx`
  - Carrega blueprint completo via `GET /api/course-designer/blueprints/[id]`
  - Exibe metadata: título, framework, duração, score, data de criação
- [ ] **AC2:** `BlueprintViewer` component em `_components/blueprint-viewer.tsx`
  - Layout: metadata bar + scorecard + bloom progression + modules list
  - Modo view (default) e modo edit (toggle)
  - Botões: "Editar", "Exportar JSON", "Aplicar ao Curso"
- [ ] **AC3:** `ModuleCard` component em `_components/module-card.tsx`
  - Exibe: order, title, description, duration_minutes, spiral_level, interaction_type
  - `FrameworkStageBar` integrado: barra horizontal com N segmentos coloridos (% do tempo)
  - Objetivos com Bloom level badge
  - Expandível: mostra assessments, rubrics, chunks
- [ ] **AC4:** `ProblemaMotorCard` component em `_components/problema-motor-card.tsx`
  - Exibe: title, context, role, tension, mission, constraints, deliverable
  - Tension score visual (1-125)
- [ ] **AC5:** Modo edição:
  - Editar textos (títulos, descrições, objetivos) inline
  - Mudar interaction_type por módulo (dropdown)
  - Ajustar durações por módulo
  - Reordenar módulos (drag-and-drop ou up/down arrows)
  - Adicionar/remover módulos
  - Save chama `PUT /api/course-designer/blueprints/[id]` → recalcula Scorecard
  - Exibe delta de score: "Score: 83 → 79 (-4)"
- [ ] **AC6:** `RubricViewer` component: tabela 3 colunas (criterion, level_0, level_1, level_2)
- [ ] **AC7:** Usa `@eximia/ui`: Card, Tabs, Button, Badge, Accordion, Alert
- [ ] **AC8:** Responsivo: módulos em lista vertical, scorecard collapsível em mobile

#### Technical Notes

Drag-and-drop via `@dnd-kit/core` (adicionar ao `apps/web` como dependência). Fallback com up/down arrows para acessibilidade. Edição inline via contentEditable ou input fields que aparecem no modo edit.

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar Blueprint Viewer + edição |
| **@ux-design-expert** | Validar layout e fluxo de edição |
| **@qa (QA)** | Testar edição e recálculo de score |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Módulos exibem todos os dados do blueprint | Yes |
| Pre-PR | Edição funciona e Scorecard recalcula | Yes |
| Pre-PR | Zero hex/rgba — apenas theme tokens | Yes |

---

### Story 22.6: Quality Scorecard + Bloom Progression + Componentes Visuais

**As a** manager,
**I want** visualizar o Quality Scorecard (Framework + Neuro scores), Bloom Progression e FrameworkStageBar,
**so that** eu entenda a qualidade pedagógica do meu blueprint de forma intuitiva.

**Architecture Reference:** ws2-course-creator-architecture.md, Seções 5.1, 19

**Story Points:** 5
**Priority:** P1 (enhancement — Blueprint Viewer funciona sem estes, mas com menos valor)
**Risk:** LOW — componentes visuais puros

#### Acceptance Criteria

- [ ] **AC1:** `QualityScorecard` component em `_components/quality-scorecard.tsx`
  - Dois gauges/radials: Framework Score (70%) e Neuroscience Score (30%)
  - Score Final composto com badge de verdict (excellent/good/needs_revision/poor)
  - Cores por verdict: excellent=verde, good=azul, needs_revision=amarelo, poor=vermelho
  - Expandível: mostra breakdown de cada dimensão (5 framework + 7 neuro rules)
  - Flag `requires_instructor_review` com Alert se ativo
- [ ] **AC2:** `BloomProgression` component em `_components/bloom-progression.tsx`
  - Visualização horizontal dos 6 níveis Bloom
  - Cada módulo plotado no nível correspondente
  - Cor gradient de Remember (claro) a Create (escuro)
  - Linha de progressão mostrando ascensão
  - Warning visual se drop > 1 nível entre módulos adjacentes
- [ ] **AC3:** `FrameworkStageBar` component em `_components/framework-stage-bar.tsx`
  - Barra horizontal genérica: N segmentos com % do tempo
  - Cada segmento: cor, label, percentual
  - Tooltip ao hover com detalhes do stage (name, duration_minutes, activities)
  - Genérico: funciona para qualquer framework (3-6 stages)
- [ ] **AC4:** `BriefScoreIndicator` component (atom) reutilizado do Step 6
  - Circular progress com score numérico central
  - Cor por faixa (verde/azul/amarelo/vermelho)
- [ ] **AC5:** `AssessmentTimeline` component em `_components/assessment-timeline.tsx`
  - Timeline visual de assessments ao longo do curso
  - Tipos: formativa (ícone check), somativa (ícone star), diagnóstica (ícone search)
  - Kirkpatrick level badge (L1-L4)
- [ ] **AC6:** `KirkpatrickSummary` component: 4 levels com método + timing
- [ ] **AC7:** Todos usam theme tokens — zero hardcoded colors

#### Technical Notes

Para gauges/radials, considerar SVG custom ou CSS conic-gradient. Bloom Progression pode ser um chart simples com CSS Grid. Tudo deve ser performante para blueprints com 20+ módulos.

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar componentes visuais |
| **@ux-design-expert** | Validar design visual |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Todos os componentes renderizam com dados reais | Yes |
| Pre-PR | Responsivo em desktop e tablet | Yes |

---

## Dependency Graph

```
Story 22.1 (Wizard Stepper)
    ↓
Story 22.2 (Steps 1-2)    Story 22.3 (Steps 3-4)
    ↓                           ↓
    └──────── Story 22.4 ───────┘  (Steps 5-6 + Generate)
                   ↓
              Story 22.6 (Scorecard + Visual Components)
                   ↓
              Story 22.5 (Blueprint Viewer — consome componentes de 22.6)
```

**Ordem de execução sugerida:** 22.1 → (22.2 + 22.3 em paralelo) → 22.4 → 22.6 → 22.5

**Dependência inter-epic:** Epic 21 (API routes, incluindo `ai-fill`) deve estar concluído para integração. Stories 22.2-22.4 podem ser desenvolvidas com mocks enquanto Epic 21 não está pronto.

---

## Compatibility Requirements

- [ ] Fluxo existente de criação de cursos continua funcionando
- [ ] Menu de cursos existente não é alterado (novo botão adicionado)
- [ ] Design System `@eximia/ui` não é modificado (apenas consumido)
- [ ] Theme tokens existentes reutilizados (zero novos tokens)
- [ ] Responsivo: funciona em desktop (1280px+) e tablet (768px+)

---

## Risk Mitigation

| Risco | Impacto | Mitigação | Rollback |
|---|---|---|---|
| Wizard UX confusa para instrutores | Alto | Testes de usabilidade, "Preencher com IA" | Simplificar steps |
| SSE instável no browser | Médio | Fallback para polling (job endpoint) | Polling-only mode |
| Blueprint Viewer lento com 20+ módulos | Médio | Virtualização de lista, lazy loading | Paginação de módulos |
| Edição quebra blueprint | Médio | Zod validation no save, rollback visual | Undo/redo |
| Drag-and-drop acessibilidade | Baixo | Fallback com up/down arrows | Arrows-only |

---

## New File Locations

```
apps/web/src/app/(platform)/courses/new/design/
├── page.tsx                             # NOVO
├── _components/
│   ├── course-designer-wizard.tsx       # NOVO — Stepper 6 steps
│   ├── purpose-step.tsx                 # NOVO — Step 1
│   ├── audience-step.tsx                # NOVO — Step 2
│   ├── scope-step.tsx                   # NOVO — Step 3
│   ├── constraints-step.tsx             # NOVO — Step 4
│   ├── preferences-step.tsx             # NOVO — Step 5
│   ├── prevalidation-step.tsx           # NOVO — Step 6
│   ├── framework-selector.tsx           # NOVO — Grid visual
│   └── design-progress.tsx              # NOVO — SSE progress

apps/web/src/app/(platform)/courses/[courseId]/blueprint/
├── page.tsx                             # NOVO
├── _components/
│   ├── blueprint-viewer.tsx             # NOVO — Layout editável
│   ├── module-card.tsx                  # NOVO
│   ├── framework-stage-bar.tsx          # NOVO
│   ├── quality-scorecard.tsx            # NOVO
│   ├── bloom-progression.tsx            # NOVO
│   ├── problema-motor-card.tsx          # NOVO
│   ├── rubric-viewer.tsx                # NOVO
│   ├── assessment-timeline.tsx          # NOVO
│   ├── kirkpatrick-summary.tsx          # NOVO
│   └── brief-score-indicator.tsx        # NOVO
```

---

## Definition of Done

- [ ] Wizard 6 steps funcional com navegação e validação
- [ ] "Preencher com IA" funciona em cada step
- [ ] Framework Selector visual com 3 + auto
- [ ] Brief Score calcula e exibe corretamente
- [ ] Design Progress mostra SSE real-time
- [ ] Blueprint Viewer exibe todos os dados
- [ ] Edição funciona com recálculo de Scorecard
- [ ] Todos os componentes usam `@eximia/ui` + theme tokens
- [ ] Responsivo em desktop e tablet
- [ ] `pnpm typecheck` e `pnpm build` passam

---

## Total Story Points

| Story | Título | SP | Dependência |
|-------|--------|---:|-------------|
| 22.1 | Wizard Stepper (6 Steps) | 5 | — |
| 22.2 | Steps 1-2 (Propósito & Audiência) | 5 | 22.1 |
| 22.3 | Steps 3-4 (Escopo & Restrições) | 5 | 22.1 |
| 22.4 | Steps 5-6 (Preferências & Pre-validation + Generate) | 5 | 22.2, 22.3 |
| 22.5 | Blueprint Viewer (Módulos + Editabilidade) | 8 | 22.6, Epic 21 |
| 22.6 | Quality Scorecard + Bloom + Componentes Visuais | 5 | 22.4 |
| **Total** | | **33** | |

---

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-02-16 | 1.0 | Criação do épico | Morgan (PM) |
| 2026-02-16 | 1.1 | Validação @po: fix dep graph (22.6→22.4, 22.5→22.6), SP 22.5 5→8 (total 30→33), AC 22.3 condicional, ref ai-fill endpoint, @dnd-kit note | Pax (PO) |
