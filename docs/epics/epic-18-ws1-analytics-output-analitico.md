# Epic 18: WS1 — Analytics & Output Analítico Avançado

**Version:** 1.0
**Created:** 2026-02-15
**Updated:** 2026-02-15
**Author:** Morgan (PM) com arquitetura de Aria (Architect)
**Status:** Draft
**PRD Reference:** `docs/prd/evolucao-eximia-academy-workstreams.md` — WS1: Motor Socrático
**Architecture Reference:** `docs/architecture/ws1-motor-socratico-architecture.md` — Seção 16 (Output Analítico Avançado)
**Workstream:** WS1 (independente de WS2 e WS3)
**Dependency:** Epic 16 (Core Pipeline), Epic 17 (Shadow Pipeline — dados do Detector e Perfilador)

---

## Epic Goal

Implementar o Output Analítico Avançado com 3 novas áreas de analytics para gestores/instrutores: dashboard agregado (UC3), perfil individual do aluno (UC2) e detalhe de sessão — utilizando dados do Detector e Perfilador para visualização com recharts, alertas de atenção, e comparativo teste vs IA.

## Epic Context

| Item | Detalhe |
|------|---------|
| **Stack** | Next.js 15 (RSC + Client), recharts, Tailwind CSS 4, @eximia/ui |
| **DB Tables** | `sessions` (analytics JSONB), `learner_profiles`, `session_messages` |
| **Design Tokens** | `apps/web/src/styles/theme.css` — tokens existentes |
| **Roles Impactados** | manager (acesso principal), admin (acesso total) |
| **Componentes UI** | ~20 novos componentes (Molecules + Organisms) — consultar `docs/design-system-guide.md` antes de criar |
| **Rotas** | `/analytics`, `/analytics/students/[id]`, `/analytics/sessions/[id]` |
| **API Endpoints** | 3 novos endpoints |
| **Depende de** | Epic 17 (dados do Detector e Perfilador persistidos) |

---

## Existing System Context

### Infrastructure Already in Place

| Component | Status | Reference |
|-----------|--------|-----------|
| Dashboard `/dashboard` | Implementado | `apps/web/src/app/[tenant]/dashboard/` |
| StatCard component | Implementado | `@eximia/ui` |
| DataTable component | Implementado | `@eximia/ui` |
| EngagementChart (LineChart) | Implementado | `apps/web/src/components/dashboard/` |
| PeriodFilter | Implementado | Dashboard existente |
| CsvExportButton | Implementado | Dashboard existente |
| recharts dependency | Implementado | Já no package.json |
| Sidebar navigation | Implementado | `apps/web/src/components/layout/` |
| Session analytics JSONB | Epic 17.2 | `sessions.analytics` |
| Learner profiles table | Epic 17.2 | `learner_profiles` |
| Role-based access | Implementado | Middleware + RLS |

### Current Analytics State

```
/dashboard (manager)
├── Summary Cards (sessões, cursos, alunos ativos)
├── Engagement Chart (LineChart semanal)
├── Course Analytics Table
└── Analytics sidebar → redireciona para /dashboard (sem área dedicada)
```

### What This Epic Changes

```
/dashboard (existente, alterações mínimas)
├── + 2 StatCards socrático (Profundidade Média, Breakthroughs)
├── + Colunas socrático na Course Analytics Table
└── + Link "Ver análise completa →" para /analytics

/analytics (NOVA área dedicada — UC3)
├── Filtros: período, curso, área
├── Summary Cards: sessões ativas, prof. média, breakthroughs, AI detection rate
├── Profundidade da Turma (BarChart distribuição 1-7)
├── Mapa Kolb da Turma (ScatterChart 2D)
├── Padrões Cognitivos Top 5 (BarChart horizontal)
├── Jornada Emocional Média (AreaChart)
├── Engagement Chart (migrado do dashboard)
├── Alertas de Atenção (estagnação, IA, queda)
└── Divergência Teste vs IA (tabela agregada + CSV export)

/analytics/students/[id] (NOVA — UC2)
├── Header: avatar + nome + badge plano + stats
├── Tab 1: Perfil IA (Kolb scatter + estilo + divergência teste vs IA)
├── Tab 2: Padrões Cognitivos (bar chart + valores + alertas)
├── Tab 3: Evolução (profundidade longitudinal + Kolb trail + clareza)
├── Tab 4: Sessões (lista com link para detalhe)
└── Recomendações para o Gestor

/analytics/sessions/[id] (NOVA)
├── Header: sessão, aluno, curso, métricas resumo
├── Tab 1: Análise Cognitiva (Detector)
├── Tab 2: Jornada (depth progression + arco emocional + breakthroughs)
├── Tab 3: Métricas (clareza, densidade emocional, abstração, Kolb sessão)
└── Tab 4: Conversa (transcript com anotações inline do Detector)
```

---

## Enhancement Details

### Dashboard Agregado UC3 (`/analytics`)

```
┌────────────────────────────────────────────────────────────────┐
│  /analytics                                                    │
│                                                                │
│  ┌──── Filtros ────────────────────────────────────────────┐   │
│  │ [Período: 30d ▾] [Curso: Todos ▾] [Área: Todas ▾]      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                │
│  ┌─── Summary Cards ──────────────────────────────────────┐    │
│  │ Sessões Ativas │ Prof. Média │ Breakthroughs │ AI Det % │    │
│  │ 847            │ 4.3 / 7    │ 2.1/sessão    │ 3.2%     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                │
│  ┌────────────────────────┐ ┌──────────────────────────────┐   │
│  │ Profundidade da Turma  │ │ Mapa Kolb da Turma           │   │
│  │ (BarChart 7 camadas)   │ │ (ScatterChart 2D)            │   │
│  └────────────────────────┘ └──────────────────────────────┘   │
│                                                                │
│  ┌────────────────────────┐ ┌──────────────────────────────┐   │
│  │ Padrões Cognitivos Top │ │ Jornada Emocional Média      │   │
│  │ (BarChart horizontal)  │ │ (AreaChart)                  │   │
│  └────────────────────────┘ └──────────────────────────────┘   │
│                                                                │
│  ┌─── Alertas de Atenção ─────────────────────────────────┐    │
│  │ 🔴 João — 0 sessões em 14d │ 🟡 Pedro — prof. caindo   │    │
│  │ 🔴 Maria — 3x likely_ai    │ 🟢 Carlos — 3 breakthroughs│   │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                │
│  ┌─── Divergência Teste vs IA ────────────────────────────┐    │
│  │ Aluno │ Kolb Teste │ Kolb IA │ Divergência │ [CSV ↓]   │    │
│  └─────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────┘
```

### Perfil Individual UC2 (`/analytics/students/[id]`)

```
┌────────────────────────────────────────────────────────────────┐
│  Header: Avatar + Nome + Badge plano + Stats                   │
│  ┌──────── Tabs ───────────────────────────────────────────┐   │
│  │ [Perfil IA] [Padrões Cognitivos] [Evolução] [Sessões]  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                │
│  Tab 1: Kolb Scatter + Estilo + Divergência Teste vs IA        │
│  Tab 2: Top padrões + valores + alertas                        │
│  Tab 3: Profundidade longitudinal + Kolb trail + clareza       │
│  Tab 4: Lista de sessões com link para detalhe                 │
│  + Recomendações para o Gestor                                 │
└────────────────────────────────────────────────────────────────┘
```

### Success Criteria

- [ ] Dashboard agregado (`/analytics`) renderiza com dados reais
- [ ] Filtros (período, curso, área) funcionam
- [ ] Perfil individual de aluno com 4 tabs funcionais
- [ ] Detalhe de sessão com análise cognitiva e jornada
- [ ] Alertas de atenção gerados automaticamente
- [ ] Divergência teste vs IA exibida
- [ ] CSV export funcional
- [ ] Apenas manager/admin acessa as páginas
- [ ] Componentes usam design system `@eximia/ui` + tokens

---

## Stories

---

### Story 18.1: API Endpoints de Analytics

**As a** developer,
**I want** 3 API endpoints para servir dados de analytics agregados, perfil individual e sessão,
**so that** as páginas de analytics tenham dados estruturados do backend.

**Architecture Reference:** ws1-motor-socratico-architecture.md, Seção 16

**Story Points:** 8
**Priority:** P0 (fundação)
**Risk:** MEDIUM — queries agregadas complexas

#### Acceptance Criteria

- [ ] **AC1:** `GET /api/analytics/aggregate` — Dashboard UC3
  - Query params: `period` (7d, 30d, 90d), `courseId?`, `areaId?`
  - Retorna: summary (sessões ativas, profundidade média, breakthroughs, AI detection rate), depth_distribution (array 7 camadas), kolb_team (array de pontos 2D), cognitive_patterns_top5, emotional_journey_avg, alerts (array de alertas), divergence_table
  - Auth: manager/admin do tenant
- [ ] **AC2:** `GET /api/analytics/students/[studentId]` — Perfil UC2
  - Retorna: header (nome, avatar, plano, stats), learner_profile (Kolb, estilo, hints), cognitive_patterns_aggregated (top padrões últimas 10 sessões), evolution (depth progression, Kolb trail, clarity), sessions_list (com link), recommendations, divergence (teste vs IA)
  - Auth: manager/admin do tenant
- [ ] **AC3:** `GET /api/analytics/sessions/[sessionId]` — Detalhe sessão
  - Retorna: header (aluno, curso, cap, métricas), cognitive_analysis (Detector), journey (depth progression, emotional arc, breakthroughs), metrics (clareza, densidade, abstração, Kolb), transcript (mensagens com anotações)
  - Auth: manager/admin do tenant
- [ ] **AC4:** Rate limiting nos 3 endpoints
- [ ] **AC5:** Queries otimizadas com indexes adequados

#### Technical Notes

```typescript
// Aggregate query example
const { data: sessions } = await supabase
  .from('sessions')
  .select('id, analytics, created_at, student_id, chapter_id')
  .eq('tenant_id', tenantId)
  .gte('created_at', periodStart)
  .not('analytics', 'is', null)
```

Para o perfil individual, fazer JOIN de `learner_profiles` + `sessions.analytics` agregado. Para alertas, lógica server-side: inatividade > 14d, likely_ai > 2x, profundidade caindo, resistência persistente.

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | API routes, queries, auth |
| **@qa (QA)** | Validar dados e auth |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Auth guard: apenas manager/admin | Yes |

---

### Story 18.2a: Dashboard Agregado — Layout, Filtros e Summary Cards (`/analytics`)

**As a** manager,
**I want** uma página de analytics com filtros e cards de resumo,
**so that** eu tenha visão rápida dos KPIs socrático da turma.

**Architecture Reference:** ws1-motor-socratico-architecture.md, Seção 16 (UC3, D3)

**Story Points:** 5
**Priority:** P0 (core)
**Risk:** LOW — reutiliza StatCard existente, layout padrão

#### Acceptance Criteria

- [ ] **AC1:** Página `/analytics` com layout responsivo
  - RSC para dados iniciais + Client components para gráficos interativos
  - Filtros: período (7d, 30d, 90d), curso, área
  - Reutilizar `PeriodFilter` existente ou estender
- [ ] **AC2:** Summary Cards (4 cards):
  - Sessões ativas (count), Profundidade média (X/7 com delta), Breakthroughs/sessão (com delta), AI Detection rate (% com delta)
  - Usar `StatCard` do `@eximia/ui`
- [ ] **AC3:** Sidebar navigation atualizado: "Analytics" → `/analytics` (não redireciona mais)
- [ ] **AC4:** Todos os componentes usam tokens do design system (`docs/design-system-guide.md`)
- [ ] **AC5:** Consultar `docs/design-system-guide.md` antes de criar componentes — reutilizar existentes
- [ ] **AC6:** Auth guard: apenas manager/admin do tenant

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar página, filtros, cards |
| **@qa (QA)** | Validar auth e filtros |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Filtros mudam dados nos cards | Yes |

---

### Story 18.2b: Dashboard Agregado — Gráficos, Alertas e Divergência (`/analytics`)

**As a** manager,
**I want** gráficos de profundidade, Kolb, padrões cognitivos, jornada emocional, alertas e divergência,
**so that** eu possa analisar a turma com visualizações avançadas.

**Architecture Reference:** ws1-motor-socratico-architecture.md, Seção 16 (UC3, D3)

**Story Points:** 8
**Priority:** P0 (core)
**Risk:** MEDIUM — 6 componentes recharts novos

**Dependency:** Story 18.2a (layout e filtros devem existir)

#### Acceptance Criteria

- [ ] **AC1:** Profundidade da Turma — `DepthDistributionChart`
  - recharts `BarChart` vertical (7 barras, camadas 1-7)
  - Cores por faixa de profundidade
- [ ] **AC2:** Mapa Kolb da Turma — `KolbTeamScatter`
  - recharts `ScatterChart` (eixos -1 a +1, cada ponto = 1 aluno)
  - Tooltip com nome do aluno
  - Labels nos eixos: CE (Sentir) ↔ AC (Pensar), RO (Observar) ↔ AE (Fazer)
- [ ] **AC3:** Padrões Cognitivos Top 5 — `CognitivePatternsChart`
  - recharts `BarChart` horizontal (layout="vertical")
  - Ordenado por frequência, top 5
- [ ] **AC4:** Jornada Emocional Média — `EmotionalJourneyChart`
  - recharts `AreaChart` (X = etapa da sessão, Y = densidade emocional)
- [ ] **AC5:** Alertas de Atenção — `AlertAttentionList`
  - Severidade: critico, atencao, positivo (badges coloridos)
  - Tipos: inatividade > 14d, likely_ai consecutivo, profundidade caindo, resistência persistente, breakthrough streak
  - Link para perfil do aluno
- [ ] **AC6:** Divergência Teste vs IA — `DivergenceComparisonTable`
  - DataTable: aluno, Kolb teste, Kolb IA, divergência (badge)
  - CSV export button (reutilizar `CsvExportButton` existente)
- [ ] **AC7:** Todos os gráficos reagem aos filtros da Story 18.2a
- [ ] **AC8:** Todos os componentes usam tokens do design system

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar gráficos e componentes |
| **@qa (QA)** | Validar gráficos renderizam com dados (SVG no DOM) |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | 4 gráficos recharts renderizam com dados reais | Yes |
| Pre-PR | Alertas exibem severidade correta | Yes |

---

### Story 18.3a: Perfil Individual — Header, Perfil IA e Padrões Cognitivos (`/analytics/students/[id]`)

**As a** manager,
**I want** ver o perfil IA e os padrões cognitivos de um aluno,
**so that** eu entenda o estilo de aprendizado e os padrões comportamentais do aluno.

**Architecture Reference:** ws1-motor-socratico-architecture.md, Seção 16 (UC2, D2)

**Story Points:** 5
**Priority:** P0 (core)
**Risk:** MEDIUM — Kolb scatter + divergência teste vs IA

#### Acceptance Criteria

- [ ] **AC1:** Página `/analytics/students/[id]` com tabs
  - Usar `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` do `@eximia/ui`
- [ ] **AC2:** `StudentProfileHeader` — avatar, nome, badge plano, última sessão, total sessões
- [ ] **AC3:** Tab "Perfil IA"
  - `KolbScatterPlot` — ponto no plano 2D (individual)
  - Estilo de engajamento, raciocínio, orientação, profundidade média, trend, confiança, QA score
  - `DivergenceTable` — comparação teste vs IA por dimensão (Kolb, DISC)
  - Badge para divergências significativas
- [ ] **AC4:** Tab "Padrões Cognitivos"
  - `CognitivePatternBars` — top padrões recorrentes (últimas 10 sessões, BarChart horizontal)
  - Valores implícitos, mecanismos de defesa, readiness médio
  - Alertas: detecção IA, resistência persistente, breakthroughs
- [ ] **AC5:** URL compartilhável, espaço completo
- [ ] **AC6:** Auth: apenas manager/admin do tenant
- [ ] **AC7:** Consultar `docs/design-system-guide.md` antes de criar componentes

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar página e componentes |
| **@qa (QA)** | Validar tabs e dados |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Tabs "Perfil IA" e "Padrões Cognitivos" renderizam | Yes |

---

### Story 18.3b: Perfil Individual — Evolução, Sessões e Recomendações (`/analytics/students/[id]`)

**As a** manager,
**I want** ver a evolução do aluno ao longo das sessões, histórico de sessões e recomendações,
**so that** eu possa acompanhar o progresso e tomar ações direcionadas.

**Architecture Reference:** ws1-motor-socratico-architecture.md, Seção 16 (UC2, D2)

**Story Points:** 5
**Priority:** P1
**Risk:** LOW — gráficos similares aos da UC3 (reutiliza patterns)

**Dependency:** Story 18.3a (página e tabs devem existir)

#### Acceptance Criteria

- [ ] **AC1:** Tab "Evolução"
  - `DepthProgressionChart` — profundidade ao longo das sessões (LineChart)
  - Kolb vector trail (ScatterChart com linha conectando pontos)
  - Clareza: inicial → final (ganho)
  - Densidade emocional: trend
- [ ] **AC2:** Tab "Sessões"
  - `SessionHistoryTable` — data, curso, profundidade, AI detection, QA score
  - Link para `/analytics/sessions/[sessionId]`
  - Reutilizar `DataTable` do `@eximia/ui`
- [ ] **AC3:** `GestorRecommendations` — hints baseados nos dados (Card + lista)
  - Exibido abaixo das tabs
  - Recomendações geradas server-side baseadas em dados do Perfilador
- [ ] **AC4:** Todos os componentes usam tokens do design system

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar tabs restantes e recomendações |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | 4 tabs renderizam (todas) | Yes |

---

### Story 18.4: Detalhe de Sessão — Página `/analytics/sessions/[id]`

**As a** manager,
**I want** ver a análise detalhada de uma sessão socrática específica,
**so that** eu entenda os padrões cognitivos e a jornada do aluno naquela sessão.

**Architecture Reference:** ws1-motor-socratico-architecture.md, Seção 16 (D4)

**Story Points:** 5
**Priority:** P1
**Risk:** LOW — dados já disponíveis via Epic 17

#### Acceptance Criteria

- [ ] **AC1:** `SessionHeader` — sessão #, aluno, curso/capítulo, data, interações, profundidade, AI detection, QA score
- [ ] **AC2:** Tab "Análise Cognitiva"
  - Padrões detectados (tipo, frequência, evidência)
  - Valores implícitos, readiness
  - Suggested question type
  - AI detection indicators (vocabulary diversity, response time, emotional markers)
- [ ] **AC3:** Tab "Jornada"
  - `SessionJourneyChart` — depth progression (LineChart por turno)
  - Arco emocional (confused → defensive → curious → insightful → integrating)
  - Breakthrough moments com trigger e marker (badges inline)
- [ ] **AC4:** Tab "Métricas"
  - Clareza (inicial → final, ganho), densidade emocional (trend)
  - Abstração (trend), certeza vs exploração
  - Resistência (momentos + turnos + superação)
  - Kolb desta sessão (grasping + transforming → tendência)
- [ ] **AC5:** Tab "Conversa"
  - `AnnotatedTranscript` — transcript read-only com anotações inline do Detector
  - Badges entre mensagens: depth marker, padrão detectado, breakthrough
- [ ] **AC6:** Auth: manager/admin do tenant

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Implementar página e componentes |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |

---

### Story 18.5: Integração com Dashboard Existente + KPIs Socrático

**As a** manager,
**I want** ver KPIs socrático resumidos no dashboard existente com link para analytics completo,
**so that** eu tenha visão rápida sem sair da tela principal.

**Architecture Reference:** ws1-motor-socratico-architecture.md, Seção 16

**Story Points:** 3
**Priority:** P2
**Risk:** LOW — adições mínimas a componentes existentes

#### Acceptance Criteria

- [ ] **AC1:** 2 novos StatCards no dashboard:
  - "Profundidade Média" (X/7 com delta vs período anterior)
  - "Breakthroughs" (total ou média/sessão com delta)
- [ ] **AC2:** Colunas adicionais na Course Analytics Table:
  - Profundidade média (por curso)
  - Taxa de completude das sessões
- [ ] **AC3:** Link "Ver análise completa →" apontando para `/analytics`
- [ ] **AC4:** Cards e colunas visíveis apenas para manager/admin
- [ ] **AC5:** Sem breaking changes nos componentes existentes

**Predicted Agents:**

| Agent | Responsibility |
|-------|---------------|
| **@dev (Dex)** | Estender dashboard existente |

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Dashboard existente não quebra | Yes |

---

## Dependency Graph

```
                    Epic 17 (Shadow Pipeline — dados no DB)
                           ↓
                    Story 18.1 (API Endpoints)
                           ↓
    Story 18.2a (Layout + Cards)     Story 18.3a (Header + Perfil IA)     Story 18.4 (Sessão Detalhe)
         ↓                                  ↓
    Story 18.2b (Gráficos + Alertas) Story 18.3b (Evolução + Sessões)
         ↓
    Story 18.5 (KPIs Dashboard Existente)
```

**Ordem de execução sugerida:** 18.1 → (18.2a + 18.3a + 18.4 em paralelo) → (18.2b + 18.3b em paralelo) → 18.5

---

## Compatibility Requirements

- [ ] Dashboard existente (`/dashboard`) continua funcionando
- [ ] Sidebar navigation não quebra para outros roles
- [ ] Componentes existentes (StatCard, DataTable, EngagementChart) não são alterados
- [ ] EngagementChart reutilizado no `/analytics` (migrado, não duplicado)
- [ ] PeriodFilter e CsvExportButton reutilizados

---

## Risk Mitigation

| Risco | Impacto | Mitigação | Rollback |
|---|---|---|---|
| Queries agregadas lentas | Médio | Indexes + paginação + cache | Limitar período máximo |
| Muitos componentes recharts | Baixo | Lazy loading dos gráficos | Exibir tabelas como fallback |
| Volume de alertas sobrecarrega gestor | Médio | Paginação + filtro severidade | Limitar top 10 |
| Dados insuficientes no início | Baixo | Estados empty com mensagem educativa | Ocultar seções sem dados |

---

## New File Locations

```
apps/web/src/app/[tenant]/analytics/
├── page.tsx                              # UC3 Dashboard Agregado
├── layout.tsx                            # Layout analytics
├── students/
│   └── [studentId]/
│       └── page.tsx                      # UC2 Perfil Individual
└── sessions/
    └── [sessionId]/
        └── page.tsx                      # Detalhe Sessão

apps/web/src/app/api/analytics/
├── aggregate/route.ts                    # GET aggregate
├── students/[studentId]/route.ts         # GET student profile
└── sessions/[sessionId]/route.ts         # GET session detail

apps/web/src/components/analytics/        # TODOS NOVOS
├── AnalyticsDashboard.tsx                # Template UC3
├── SummaryCardsRow.tsx                   # Organism
├── DepthDistributionChart.tsx            # Molecule (recharts BarChart)
├── KolbTeamScatter.tsx                   # Molecule (recharts ScatterChart)
├── CognitivePatternsChart.tsx            # Molecule (recharts BarChart horizontal)
├── EmotionalJourneyChart.tsx             # Molecule (recharts AreaChart)
├── AlertAttentionList.tsx                # Organism
├── DivergenceComparisonTable.tsx         # Organism (DataTable + Badge)
├── StudentProfilePage.tsx                # Template UC2
├── StudentProfileHeader.tsx              # Organism
├── KolbScatterPlot.tsx                   # Molecule (individual)
├── DivergenceTable.tsx                   # Molecule
├── CognitivePatternBars.tsx              # Molecule
├── DepthProgressionChart.tsx             # Molecule (recharts LineChart)
├── SessionHistoryTable.tsx               # Molecule (DataTable + link)
├── GestorRecommendations.tsx             # Molecule
├── SessionAnalysisPage.tsx               # Template
├── SessionHeader.tsx                     # Organism
├── CognitiveAnalysisPanel.tsx            # Organism
├── SessionJourneyChart.tsx               # Molecule (recharts LineChart + annotations)
├── SessionMetricsPanel.tsx               # Organism
└── AnnotatedTranscript.tsx               # Organism (ChatMessageList + badges)
```

---

## Definition of Done

- [ ] Dashboard agregado (`/analytics`) funcional com filtros e gráficos
- [ ] Perfil individual com 4 tabs renderizando dados reais
- [ ] Detalhe de sessão com análise cognitiva e transcript anotado
- [ ] Dashboard existente com KPIs socrático e link
- [ ] Auth guard: apenas manager/admin
- [ ] Todos os componentes usam `@eximia/ui` + tokens
- [ ] Responsivo (desktop-first, mobile-adequate)
- [ ] `pnpm typecheck` e `pnpm build` passam

---

## Total Story Points

| Story | Título | SP | Dependência |
|-------|--------|---:|-------------|
| 18.1 | API Endpoints Analytics | 8 | Epic 17 |
| 18.2a | Dashboard UC3 — Layout, Filtros e Cards | 5 | 18.1 |
| 18.2b | Dashboard UC3 — Gráficos, Alertas e Divergência | 8 | 18.2a |
| 18.3a | Perfil UC2 — Header, Perfil IA e Padrões | 5 | 18.1 |
| 18.3b | Perfil UC2 — Evolução, Sessões e Recomendações | 5 | 18.3a |
| 18.4 | Detalhe de Sessão | 5 | 18.1 |
| 18.5 | KPIs Dashboard Existente | 3 | 18.2b |
| **Total** | | **39** | |

---

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-02-15 | 1.0 | Criação do épico | Morgan (PM) |
| 2026-02-15 | 1.1 | PO Review: Subdivisão das stories 18.2→18.2a+18.2b e 18.3→18.3a+18.3b para reduzir densidade. Total: 5→7 stories, 32→39 SP. Adicionada nota sobre consulta ao design system guide. | Pax (PO) |
