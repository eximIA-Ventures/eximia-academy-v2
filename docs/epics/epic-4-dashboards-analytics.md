# Epic 4: Dashboards & Analytics

**Version:** 1.1
**Created:** 2026-02-07
**Updated:** 2026-02-07
**Author:** Morgan (PM Agent)
**Status:** Pending QA Review
**PRD Reference:** `docs/prd.md` — Epic 4
**Architecture Reference:** `docs/architecture.md` v1.3
**Screens Reference:** `docs/screens.md` — Tela 4 (variantes 4A, 4B, 4C)

---

## Epic Goal

Cada role (aluno, professor, gestor) tem um dashboard com metricas relevantes preenchidas com dados reais. O aluno ve seu progresso e sessoes completadas, o professor monitora sua turma com flags discretas de AI detection, o gestor ve metricas executivas de ROI e engajamento com graficos e exportacao CSV. Os dashboards substituem os placeholders criados no Epic 1 (Story 1.4) com dados reais provenientes das tabelas populadas nos Epics 2 e 3.

## Epic Context

| Item | Detalhe |
|------|---------|
| **Stack** | Next.js 15 (App Router) + Supabase + Vercel + Drizzle ORM + Tailwind CSS 4 + shadcn/ui |
| **DB Tables** | `enrollments`, `sessions`, `messages`, `analyses`, `courses`, `chapters`, `users`, `qa_reports` — todas criadas nos Epics 1-2 e populadas no Epic 3. `qa_reports` nao usada diretamente nos dashboards mas listada para completude |
| **Auth** | Supabase Auth invite-only, middleware protege `/(platform)/*` (Story 1.3) |
| **Layout** | Sidebar 200px + header + content area com tenant branding (Story 1.4) |
| **Dashboard Route** | `/dashboard` com role-based rendering (4 variantes) — shell criado em Story 1.4 |
| **Analytics APIs** | `GET /api/analytics/student`, `/teacher`, `/manager` — contratos definidos em architecture.md Section 10.1.1 |
| **Charting** | Recharts (leve, RSC-friendly, shadcn/ui charts integration) |
| **Screens** | Tela 4: variantes 4A (Student), 4B (Teacher), 4C (Manager) — screens.md |
| **Design Tokens** | `Benchmarks/Design/design-tokens.json` v1.2.1 |
| **Dual-Mode** | Labels adaptam via `tenant.mode`: university ("Notas", "Frequencia") vs corporate ("Competencias", "ROI") |

## Dependency Graph

```
Story 4.1 (Dashboard Student) ──────────────┐
[independente]                                │
                                              │
Story 4.2 (Dashboard Teacher) ──────────────┤  [todas podem rodar em paralelo]
[independente]                                │
                                              │
Story 4.3 (Dashboard Manager) ──────────────┘
[independente]
```

**Pre-requisite:** Epic 3 completo (sessoes, messages, analyses, qa_reports populadas com dados reais)

> **Nota sobre shared components:** Story 4.1 e a dona dos shared components (`SummaryCards`, `PeriodFilter`, `EmptyState`, `StatusBadge`). Se rodar em paralelo com multiplos devs, Stories 4.2 e 4.3 reutilizam os shared components criados em 4.1. Se 1 dev, executar 4.1 primeiro. Alternativa: criar Story 4.0 (Setup Shared Dashboard Components, SP=2) antes das 3 stories.

---

## Stories

---

### Story 4.1: Dashboard do Aluno

**As a** student,
**I want** ver meu progresso e historico de sessoes no dashboard,
**so that** eu acompanhe minha jornada de aprendizagem.

**Story Points:** 5
**Priority:** P0 (Blocker)
**Blocked By:** Epic 3 (all stories)
**Blocks:** Nenhum

#### Acceptance Criteria

- [ ] **AC1:** Dashboard em `/dashboard` (role: student) substitui o placeholder do Epic 1 com dados reais
- [ ] **AC2:** 3 summary cards no topo: "Cursos Inscritos" (count de enrollments ativas), "Sessoes Completadas" (count de sessions com status completed), "Capitulos Concluidos" (count de chapters com sessao completed)
- [ ] **AC3:** Lista de cursos inscritos com cards exibindo: titulo, barra de progresso (% do enrollment), ultimo acesso (data relativa: "ha 2 dias")
- [ ] **AC4:** CTA "Continuar" no card do curso — link direto para o ultimo capitulo em andamento (capitulo com sessao ativa ou proximo capitulo sem sessao)
- [ ] **AC5:** Sessoes recentes na sidebar direita: lista com data, titulo do capitulo, status badge (completed verde / active azul), limitada a 5 mais recentes
- [ ] **AC6:** Dados carregados via React Server Components (RSC) — sem client-side fetch no carregamento inicial
- [ ] **AC7:** Empty state para alunos sem inscricao: ilustracao + "Voce ainda nao esta inscrito em nenhum curso." + botao "Explorar Cursos" (link para `/courses`)
- [ ] **AC8:** Welcome banner no topo: "Ola, {full_name}! Continue aprendendo."
- [ ] **AC9:** API route `GET /api/analytics/student` implementada retornando `StudentAnalytics` conforme contrato em architecture.md Section 10.1.1
- [ ] **AC10:** Performance: dashboard carrega em < 2s (LCP) conforme NFR2

#### Technical Notes

- **Tela:** Screen 4A (Student Dashboard) — screens.md
- **Rota:** `apps/web/src/app/(platform)/dashboard/page.tsx` — ja existe como placeholder (Epic 1 Story 1.4)
- **Role routing:** O `page.tsx` ja detecta role do user via RSC e renderiza componente variante. Substituir placeholder por `StudentDashboard` real
- **Componentes a criar:**
  - `StudentDashboard` — container principal
  - `SummaryCards` — 3 cards com icone, label, valor (reutilizavel entre dashboards)
  - `EnrolledCourseCard` — card de curso com progress bar e CTA
  - `RecentSessionsList` — lista lateral de sessoes recentes
  - `EmptyState` — estado vazio com CTA
- **Query strategy:** RSC data fetching direto com Drizzle ORM. Para refresh apos navegacao, usar `revalidatePath('/dashboard')` nas Server Actions que alteram dados
- **Ultimo capitulo em andamento:** Query: sessao ativa do student no curso → chapter_id. Se nao existe sessao ativa, proximo capitulo publicado sem sessao completed (ORDER BY `order` ASC)
- **Derivacao de `lastAccessedAt`:** `lastAccessedAt = MAX(sessions.started_at) WHERE student_id = X AND chapter_id IN (SELECT id FROM chapters WHERE course_id = Y)`. Fallback: se nao ha sessoes, usar `enrollments.enrolled_at`. Retornar como ISO string para formatacao no client
- **Data relativa:** Usar `date-fns/formatDistanceToNow` com locale `pt-BR`
- **RLS:** Todas as queries passam por RLS — student so ve seus proprios dados (enrollments, sessions com student_id = auth.uid())

#### Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Implementacao completa (dashboard, API, componentes) |
| **@qa (Quinn)** | Validacao: dados corretos, empty state, performance < 2s |

#### Quality Gates

| Gate | Validacao |
|------|----------|
| Pre-Commit | `pnpm lint && pnpm typecheck` passam, componentes renderizam sem erros |
| Pre-PR | Dashboard exibe dados reais, empty state funciona, CTA "Continuar" navega corretamente, LCP < 2s |

#### Tasks

- [ ] Implementar API route `GET /api/analytics/student` com contrato `StudentAnalytics` (architecture.md Section 10.1.1)
- [ ] Criar componente `SummaryCards` reutilizavel (icone, label, valor, cor)
- [ ] Criar componente `StudentDashboard` com layout conforme screens.md 4A
- [ ] Criar componente `EnrolledCourseCard` com titulo, progress bar, ultimo acesso, CTA "Continuar"
- [ ] Implementar logica de "ultimo capitulo em andamento" (sessao ativa ou proximo capitulo disponivel)
- [ ] Criar componente `RecentSessionsList` com 5 sessoes mais recentes (data, capitulo, status badge)
- [ ] Implementar empty state para student sem enrollments
- [ ] Implementar welcome banner com nome do usuario
- [ ] Substituir placeholder do dashboard (Epic 1) pelo `StudentDashboard` real
- [ ] Testes: dashboard com dados, empty state, CTA continuar, sessoes recentes, performance

#### Definition of Done

- [ ] Todos os ACs passam
- [ ] Student ve metricas reais (cursos, sessoes, capitulos)
- [ ] Progress bar reflete enrollment.progress corretamente
- [ ] CTA "Continuar" navega para capitulo correto
- [ ] Empty state exibido para student sem inscricoes
- [ ] Dashboard carrega em < 2s
- [ ] PR aprovada

---

### Story 4.2: Dashboard do Professor

**As a** teacher,
**I want** monitorar o engajamento dos alunos nos meus cursos,
**so that** eu possa identificar alunos que precisam de atencao.

**Story Points:** 8
**Priority:** P0 (Blocker)
**Blocked By:** Epic 3 (all stories)
**Blocks:** Nenhum

#### Acceptance Criteria

- [ ] **AC1:** Dashboard em `/dashboard` (role: teacher) exibe dados reais dos cursos criados pelo professor
- [ ] **AC2:** 3 summary cards no topo: "Total de Cursos" (courses criados pelo teacher), "Total de Alunos" (count distinct de students com enrollment ativa nos cursos do teacher), "Sessoes esta Semana" (sessions completadas nos cursos do teacher nos ultimos 7 dias)
- [ ] **AC3:** Lista de cursos com: titulo, no. de alunos inscritos, taxa de conclusao (% de enrollments com status completed), no. de sessoes totais, status badge (draft/published/archived)
- [ ] **AC4:** Ao clicar num curso: expande inline ou navega para view de metricas por aluno — tabela com: nome, progresso (%), sessoes completadas, ultima atividade (data relativa)
- [ ] **AC5:** Flags de AI detection exibidas discretamente: icone tooltip ao lado do nome do aluno. Tooltip mostra verdict ("likely_human", "uncertain", "likely_ai") e confidence. Nao bloqueante — apenas informativo. **Condicional:** dados de AI detection so visiveis se `tenant.settings.features.ai_detection === true`. Se desabilitado, coluna/badge ocultos
- [ ] **AC6:** Filtro por periodo: "7 dias", "30 dias", "Tudo" — filtra summary cards e lista de cursos. Default: "30 dias"
- [ ] **AC7:** Dados via React Server Components para carregamento inicial. TanStack Query (`useQuery`) para refresh quando filtro de periodo muda (client-side)
- [ ] **AC8:** API route `GET /api/analytics/teacher` implementada com query params `?period=7d|30d|all&courseId=optional` retornando `TeacherAnalytics` conforme contrato
- [ ] **AC9:** AI detection flags agregadas por aluno: usa o verdict mais recente de cada aluno (ultima sessao, ultima mensagem analisada)
- [ ] **AC10:** Performance: dashboard carrega em < 2s, expansao de curso em < 500ms
- [ ] **AC11:** Empty state para teacher sem cursos: "Voce ainda nao criou nenhum curso." + botao "Criar Curso" (link para `/courses/new`)

#### Technical Notes

- **Tela:** Screen 4B (Teacher Dashboard) — screens.md
- **Rota:** `apps/web/src/app/(platform)/dashboard/page.tsx` — variante teacher
- **Componentes a criar:**
  - `TeacherDashboard` — container principal
  - `CourseMetricsTable` — tabela de cursos com metricas agregadas
  - `StudentMetricsTable` — tabela de alunos por curso (expandivel)
  - `AiDetectionBadge` — icone + tooltip com verdict/confidence
  - `PeriodFilter` — select com opcoes de periodo
- **Queries (Drizzle ORM):**
  - Cursos: `courses WHERE created_by = user.id AND tenant_id = tenant`
  - Alunos por curso: `enrollments JOIN users WHERE course_id = X`
  - Sessoes por periodo: `sessions WHERE chapter_id IN (chapters of teacher's courses) AND completed_at >= period_start`
  - AI detection: `analyses JOIN messages JOIN sessions WHERE session.chapter_id IN teacher's chapters ORDER BY created_at DESC LIMIT 1 per student`
- **Filtro periodo:** Client component com `useQuery` para refetch. Server initial load com default "30d"
- **Taxa de conclusao:** `COUNT(enrollments WHERE status='completed') / COUNT(enrollments WHERE status IN ('active','completed'))` * 100
- **RLS:** Teacher so ve cursos com `created_by = auth.uid()`. Sessions/messages visíveis via RLS policy `sessions_select` que verifica teacher's courses via chapter join

#### Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Implementacao completa (dashboard, API, componentes, queries) |
| **@qa (Quinn)** | Validacao: metricas corretas, AI flags discretas, filtro periodo, performance |

#### Quality Gates

| Gate | Validacao |
|------|----------|
| Pre-Commit | `pnpm lint && pnpm typecheck` passam, componentes renderizam |
| Pre-PR | Dashboard exibe cursos do teacher, metricas por aluno funcionam, AI flags discretas, filtro muda dados, LCP < 2s |

#### Tasks

- [ ] Implementar API route `GET /api/analytics/teacher` com query params `period` e `courseId`
- [ ] Implementar query de summary cards (total cursos, total alunos, sessoes da semana)
- [ ] Criar componente `TeacherDashboard` com layout conforme screens.md 4B
- [ ] Criar componente `CourseMetricsTable` com lista de cursos e metricas agregadas
- [ ] Criar componente `StudentMetricsTable` expandivel por curso (nome, progresso, sessoes, ultima atividade)
- [ ] Criar componente `AiDetectionBadge` com icone + tooltip (verdict, confidence)
- [ ] Implementar query de AI detection flags agregadas por aluno (verdict mais recente)
- [ ] Criar componente `PeriodFilter` (7d, 30d, tudo) com `useQuery` para refetch
- [ ] Implementar logica de taxa de conclusao por curso
- [ ] Substituir placeholder teacher do dashboard (Epic 1) pelo `TeacherDashboard` real
- [ ] Testes: summary cards, curso expandido, AI flags, filtro periodo, teacher sem cursos (empty state)

#### Definition of Done

- [ ] Todos os ACs passam
- [ ] Teacher ve metricas reais dos seus cursos
- [ ] Metricas por aluno exibidas ao expandir curso
- [ ] AI detection flags exibidas discretamente (tooltip)
- [ ] Filtro de periodo filtra dados corretamente
- [ ] Dashboard carrega em < 2s
- [ ] PR aprovada

---

### Story 4.3: Dashboard do Gestor

**As a** manager,
**I want** ver metricas executivas de engajamento e aplicacao,
**so that** eu possa justificar o investimento em treinamento.

**Story Points:** 8
**Priority:** P1 (High)
**Blocked By:** Epic 3 (all stories)
**Blocks:** Nenhum

#### Acceptance Criteria

- [ ] **AC1:** Dashboard em `/dashboard` (role: manager) exibe metricas executivas agregadas do tenant
- [ ] **AC2:** 4 summary cards no topo: "Alunos Ativos" (students com sessao nos ultimos 30 dias), "Taxa de Engajamento" (% de alunos com sessao / total de alunos inscritos), "Taxa de Conclusao" (% de enrollments completed / total), "Sessoes este Mes" (sessions completadas nos ultimos 30 dias)
- [ ] **AC3:** Grafico de engajamento ao longo do tempo: line chart com sessoes por semana (eixo X: semanas ISO, eixo Y: count de sessoes). Periodo default: ultimas 12 semanas
- [ ] **AC4:** Tabela de cursos com: titulo, alunos inscritos, taxa de conclusao (%), profundidade media de reflexao (`depth_of_thought` do Analyst), media de AI detection (% `likely_human`). **Condicional:** colunas de AI detection so visiveis se `tenant.settings.features.ai_detection === true`. Se desabilitado, colunas ocultas
- [ ] **AC5:** Metricas agregadas no topo da tabela ou como cards adicionais: media geral de AI detection (% likely_human), media geral de depth_of_thought. **Condicional:** metricas de AI detection so visiveis se `tenant.settings.features.ai_detection === true`
- [ ] **AC6:** Filtro por curso (select com todos os cursos do tenant) e filtro por periodo (7d, 30d, 90d, tudo). Filtros afetam summary cards, grafico e tabela
- [ ] **AC7:** Botao "Exportar CSV" que gera download de CSV com dados da tabela de cursos (titulo, alunos, conclusao, reflexao, AI detection)
- [ ] **AC8:** API route `GET /api/analytics/manager` implementada com query params `?period=7d|30d|90d|all&courseId=optional` retornando `ManagerAnalytics` conforme contrato
- [ ] **AC9:** Dual-mode labels: university → "Notas", "Frequencia" nos cards; corporate → "Competencias", "ROI". Labels adaptam via `tenant.mode`
- [ ] **AC10:** Rota `/analytics` redireciona para `/dashboard` para **qualquer role** (alias conforme screens.md). Sidebar so exibe link "Analytics" para manager (screens.md). Nenhuma verificacao de role adicional necessaria — `/dashboard` ja renderiza variante por role automaticamente
- [ ] **AC11:** Performance: dashboard carrega em < 2s, grafico renderiza sem jank

#### Technical Notes

- **Tela:** Screen 4C (Manager Dashboard) — screens.md
- **Rota:** `apps/web/src/app/(platform)/dashboard/page.tsx` — variante manager
- **Rota alias:** `apps/web/src/app/(platform)/analytics/page.tsx` — redirect para dashboard
- **Componentes a criar:**
  - `ManagerDashboard` — container principal
  - `EngagementChart` — line chart com Recharts (sessoes/semana)
  - `CourseAnalyticsTable` — tabela de cursos com metricas executivas
  - `CsvExportButton` — botao que gera e faz download de CSV
  - `DualModeLabel` — componente que adapta label por tenant.mode
- **Charting library:** Recharts — ja integrado com shadcn/ui charts. Import: `import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'`
- **Queries (Drizzle ORM):**
  - Alunos ativos: `users JOIN sessions WHERE role='student' AND sessions.completed_at >= 30d ago` (DISTINCT)
  - Engajamento: `COUNT(students com sessao) / COUNT(students com enrollment ativa)` * 100
  - Sessoes/semana: `sessions GROUP BY date_trunc('week', completed_at) WHERE completed_at >= 12 weeks ago`
  - Profundidade media: `AVG(analyses.metrics->'quality'->'depth_of_thought') JOIN sessions JOIN chapters JOIN courses`
  - AI detection media: `AVG(CASE WHEN analyses.ai_detection->>'verdict' = 'likely_human' THEN 1 ELSE 0 END)` * 100
- **CSV export:** Client-side generation usando dados ja carregados. Formato: `titulo,alunos,conclusao_pct,profundidade_media,ai_detection_pct`. Download via `Blob` + `URL.createObjectURL` + click em `<a download>`
- **Dual-mode:** Ler `tenant.mode` do contexto (TenantProvider do layout). Mapear labels via config object com mapeamento explicito para cada summary card:
  ```typescript
  const modeLabels = {
    university: {
      completionRate: 'Taxa de Aprovacao',   // card 3: "Taxa de Conclusao" → "Taxa de Aprovacao"
      engagementRate: 'Frequencia',           // card 2: "Taxa de Engajamento" → "Frequencia"
    },
    corporate: {
      completionRate: 'ROI de Treinamento',   // card 3: "Taxa de Conclusao" → "ROI de Treinamento"
      engagementRate: 'Competencias Ativas',  // card 2: "Taxa de Engajamento" → "Competencias Ativas"
    },
  }
  // Cards 1 ("Alunos Ativos") e 4 ("Sessoes este Mes") nao mudam por modo
  ```
- **Acessibilidade (WCAG AA):** `EngagementChart` deve incluir `aria-label` descritivo (ex: "Grafico de sessoes por semana nas ultimas 12 semanas") e considerar tabela de dados acessivel como fallback para screen readers. Cores do grafico devem ter contraste minimo 3:1 conforme WCAG 1.4.11
- **RLS:** Manager ve todos os dados do tenant (RLS policy: `auth_user_role() IN ('admin', 'manager')`)

#### Agent Assignments

| Agent | Responsabilidade |
|-------|-----------------|
| **@dev (Dex)** | Implementacao completa (dashboard, API, grafico, CSV, dual-mode) |
| **@ux-design-expert** | Review do layout do grafico e tabela — clareza visual, responsividade |
| **@qa (Quinn)** | Validacao: metricas corretas, CSV exporta, dual-mode funciona, grafico renderiza |

#### Quality Gates

| Gate | Validacao |
|------|----------|
| Pre-Commit | `pnpm lint && pnpm typecheck` passam, componentes renderizam |
| Pre-PR | Dashboard exibe dados reais, grafico funciona, CSV exporta corretamente, dual-mode labels adaptam, filtros funcionam |
| UX | Review por @ux-design-expert: grafico legivel, tabela clara, export acessivel |

#### Tasks

- [ ] Implementar API route `GET /api/analytics/manager` com query params `period` e `courseId`
- [ ] Implementar queries agregadas: alunos ativos, engajamento, conclusao, sessoes/mes
- [ ] Implementar query de sessoes por semana para time series (engagementChart)
- [ ] Implementar queries de profundidade de reflexao e AI detection por curso
- [ ] Criar componente `ManagerDashboard` com layout conforme screens.md 4C
- [ ] Criar componente `EngagementChart` com Recharts (line chart, sessoes/semana)
- [ ] Criar componente `CourseAnalyticsTable` com metricas executivas por curso
- [ ] Criar componente `CsvExportButton` com geracao client-side e download
- [ ] Implementar dual-mode labels (university vs corporate) via tenant.mode
- [ ] Criar rota `/analytics` como redirect para `/dashboard` (role manager)
- [ ] Criar componente `PeriodFilter` reutilizado do Story 4.2 (ou extrair como shared)
- [ ] Implementar filtro por curso (select com cursos do tenant)
- [ ] Substituir placeholder manager do dashboard (Epic 1) pelo `ManagerDashboard` real
- [ ] Implementar PostHog event `analytics_csv_exported` com metadata (`user_id`, `role`, `course_filter`, `row_count`) ao exportar CSV — auditoria LGPD
- [ ] Testes: summary cards, grafico renderiza, CSV exporta, dual-mode, filtros, empty state

#### Definition of Done

- [ ] Todos os ACs passam
- [ ] Manager ve metricas executivas reais do tenant
- [ ] Grafico de engajamento renderiza corretamente (sessoes/semana)
- [ ] Tabela de cursos exibe profundidade e AI detection
- [ ] CSV exporta dados corretos
- [ ] Dual-mode labels adaptam por tenant.mode
- [ ] Filtros por periodo e curso funcionam
- [ ] Dashboard carrega em < 2s
- [ ] PR aprovada

---

## Risk Mitigation

| Risco | Impacto | Mitigacao | Rollback |
|-------|---------|-----------|----------|
| Queries agregadas lentas (JOINs em sessions + analyses + enrollments) | MEDIUM | Indexes ja criados no Epic 1 (idx_sessions_tenant, idx_analyses_session, idx_enrollments_student). Queries com `WHERE tenant_id = X` aproveitam RLS + index. Considerar materialized views se necessario | Paginar resultados, limitar periodo default |
| Grafico de engajamento com muitos data points | LOW | Limitar a 12 semanas por default. Agregar por semana (nao por dia) para reduzir pontos. Recharts virtualiza rendering | Remover grafico, usar apenas tabela |
| AI detection flags causam alarme indevido no professor | MEDIUM | Flags exibidas discretamente (tooltip, nao destaque). Label neutral: "Indicador de originalidade". Nao bloqueante — professor decide como interpretar | Feature flag `tenant.settings.features.ai_detection` — desabilitar se necessario |
| Dual-mode labels errados ou incompletos | LOW | Config object centralizado com fallback para labels neutros. Testar ambos os modos | Usar labels neutros (sem modo) como fallback |
| CSV com dados sensiveis (nomes de alunos) exportado sem controle | MEDIUM | Apenas role manager pode exportar. CSV nao inclui emails ou dados pessoais alem do nome. Auditoria via PostHog event | Remover botao de export, oferecer apenas visualizacao |
| Performance do dashboard com muitos alunos (> 500) | MEDIUM | Paginacao na tabela de alunos (StudentMetricsTable). Summary cards usam COUNT queries (rapidas). Grafico usa aggregate (GROUP BY week) | Limitar a top 50 alunos, link "Ver todos" para pagina dedicada |

## Quality Assurance Strategy

**CodeRabbit Validation:**

- **Story 4.1:** @dev valida RSC data fetching, empty state, CTA navigation
- **Story 4.2:** @dev valida queries de teacher's courses, AI detection aggregation, period filter
- **Story 4.3:** @ux-design-expert valida chart UX; @dev valida CSV export, dual-mode, aggregate queries

**Quality Gates Aligned with Risk:**

- Story 4.1: LOW RISK → Pre-Commit + Pre-PR validation
- Story 4.2: MEDIUM RISK (AI detection display) → Pre-Commit + Pre-PR validation
- Story 4.3: MEDIUM RISK (charts + CSV + dual-mode) → Pre-Commit + Pre-PR + UX validation

## Epic Compatibility Requirements

- [x] Epic 3 completo (sessions, messages, analyses, qa_reports populadas com dados reais)
- [x] Architecture v1.3 com Analytics API contracts (Section 10.1.1) — atualizada com 90d period e Recharts
- [x] PRD v1.0 com stories 4.1–4.3 definidas
- [x] Screens map v1.0 com tela 4 (Dashboard — 4 variantes)
- [x] Dashboard shell criado no Epic 1 (Story 1.4) com role detection
- [x] Enrollment progress atualizado no Epic 3 (Story 3.5 — `updateEnrollmentProgress()`)
- [x] RLS policies granulares per-role (architecture.md Section 10.3)
- [x] Indexes para queries de analytics ja definidos (architecture.md Section 10.3)

## Shared Components

Stories 4.1, 4.2 e 4.3 compartilham componentes. Extrair para `apps/web/src/components/dashboard/`:

| Componente | Usado em | Descricao |
|-----------|----------|-----------|
| `SummaryCards` | 4.1, 4.2, 4.3 | Grid de cards com icone, label, valor. Props: `items: Array<{ icon, label, value, trend? }>` |
| `PeriodFilter` | 4.2, 4.3 | Select com opcoes de periodo (7d, 30d, 90d, all). Props: `value, onChange, options` |
| `EmptyState` | 4.1, 4.2, 4.3 | Ilustracao + mensagem + CTA. Props: `title, description, action: { label, href }` |
| `StatusBadge` | 4.1, 4.2 | Badge colorido (active/completed/draft/published). Props: `status, size` |

## Definition of Done (Epic Level)

- [ ] Todas as 3 stories completadas com ACs atendidos
- [ ] Student dashboard exibe: cursos inscritos, progresso, sessoes recentes, CTA continuar
- [ ] Teacher dashboard exibe: cursos com metricas, alunos por curso, AI detection flags discretas, filtro periodo
- [ ] Manager dashboard exibe: metricas executivas, grafico de engajamento, tabela de cursos, export CSV
- [ ] 3 API routes de analytics implementadas conforme contratos (architecture.md Section 10.1.1)
- [ ] Dual-mode labels funcionam (university vs corporate)
- [ ] Componentes shared extraidos e reutilizados entre dashboards
- [ ] Performance: todos os dashboards carregam em < 2s (LCP)
- [ ] Nenhuma regressao nas funcionalidades dos Epics 1, 2 e 3
- [ ] Empty states implementados para todos os dashboards
- [ ] RLS garante que cada role ve apenas dados permitidos

---

## Story Manager Handoff

> **Para @sm (River):** As stories estao prontas para detalhamento. Consideracoes:
>
> - Epic 4 depende do Epic 3 completo — dashboards precisam de dados reais em sessions, messages, analyses
> - As 3 stories podem rodar em PARALELO com ressalva: Story 4.1 e dona dos shared components (SummaryCards, PeriodFilter, EmptyState). Se multiplos devs, 4.1 deve iniciar primeiro ou criar Story 4.0 (SP=2) para setup dos shared components
> - Story 4.3 (Manager) e a mais complexa: inclui charting (Recharts), CSV export, e dual-mode labels. Estimar com buffer de 20%
> - Componentes shared (SummaryCards, PeriodFilter, EmptyState) devem ser criados na primeira story que comecar — as outras reutilizam
> - Recomendacao: iniciar por Story 4.1 (Student) que e a mais simples e cria os componentes shared
> - AI detection flags no Teacher dashboard devem ser DISCRETAS (tooltip, nao destaque) — decisao de produto
> - Os contratos de API ja estao definidos em architecture.md Section 10.1.1 — implementar conforme especificado
> - Dashboard shell com role detection ja existe do Epic 1 — apenas substituir placeholders
> - Recharts ja esta integrado com shadcn/ui (usar `@/components/ui/chart` se disponivel)
> - Design tokens canonicos: `Benchmarks/Design/design-tokens.json` v1.2.1

---

*Epic criado por Morgan (PM Agent) — eximIA Academy v1.0*

— Morgan, planejando o futuro 📊

---

## QA Results

### Review Date: 2026-02-07

### Reviewed By: Quinn (Test Architect)

### Review Scope

Epic-level review of `epic-4-dashboards-analytics.md` against:
- `docs/prd.md` — Epic 4, Stories 4.1–4.3
- `docs/architecture.md` v1.3 — Section 10.1.1 (Analytics Endpoint Contracts), Section 10.3 (RLS)
- `docs/screens.md` v1.0 — Screen 4 (variantes 4A, 4B, 4C, 4D)
- Epics 1–3 format consistency

### PRD Traceability (Requirements Coverage)

| PRD AC | Epic AC | Status | Notes |
|--------|---------|--------|-------|
| **Story 4.1** | | | |
| PRD 4.1.1 Dashboard `/dashboard` student | AC1 | COVERED | |
| PRD 4.1.2 Summary cards (3) | AC2 | COVERED | |
| PRD 4.1.3 Cursos com progress bar | AC3 | COVERED | |
| PRD 4.1.4 Sessoes recentes | AC5 | COVERED | |
| PRD 4.1.5 RSC (sem client fetch) | AC6 | COVERED | |
| PRD 4.1.6 Empty state | AC7 | COVERED | |
| PRD 4.1.7 Link continuar ultimo curso | AC4 | COVERED | |
| **Story 4.2** | | | |
| PRD 4.2.1 Dashboard teacher | AC1 | COVERED | |
| PRD 4.2.2 Summary cards (3) | AC2 | COVERED | |
| PRD 4.2.3 Lista cursos com metricas | AC3 | COVERED | |
| PRD 4.2.4 Metricas por aluno | AC4 | COVERED | |
| PRD 4.2.5 AI detection flags discretas | AC5 | COVERED | |
| PRD 4.2.6 Filtro periodo (7d, 30d, tudo) | AC6 | COVERED | |
| PRD 4.2.7 RSC + React Query | AC7 | COVERED | |
| **Story 4.3** | | | |
| PRD 4.3.1 Dashboard manager | AC1 | COVERED | |
| PRD 4.3.2 Summary cards (4) | AC2 | COVERED | |
| PRD 4.3.3 Grafico engajamento | AC3 | COVERED | |
| PRD 4.3.4 Tabela cursos com metricas | AC4 | COVERED | |
| PRD 4.3.5 Metricas agregadas | AC5 | COVERED | |
| PRD 4.3.6 Filtro curso + periodo | AC6 | CONCERN | 90d option added — not in architecture contract |
| PRD 4.3.7 Export CSV | AC7 | COVERED | |

**PRD Coverage: 100%** — All 21 PRD acceptance criteria mapped to epic ACs.

### Architecture Contract Alignment

| Contract Field | Epic Coverage | Status |
|---------------|--------------|--------|
| `StudentAnalytics.summary` | AC2 (3 fields) | ALIGNED |
| `StudentAnalytics.courses` | AC3 | CONCERN — `lastAccessedAt` derivation unspecified |
| `StudentAnalytics.recentSessions` | AC5 | ALIGNED |
| `TeacherAnalytics.summary` | AC2 (3 fields) | ALIGNED |
| `TeacherAnalytics.courses` | AC3 (6 fields) | ALIGNED |
| `TeacherAnalytics.studentMetrics` | AC4 + AC5 | ALIGNED |
| `ManagerAnalytics.summary` | AC2 (4 fields) | ALIGNED |
| `ManagerAnalytics.engagementChart` | AC3 | ALIGNED |
| `ManagerAnalytics.courseTable` | AC4 (6 fields) | ALIGNED |
| Manager API `?period=` params | AC6 | DIVERGENT — epic adds `90d`, contract has `7d|30d|all` |

### Screens Alignment

| Screen | Epic Coverage | Status |
|--------|-------------|--------|
| 4A Student Dashboard | Story 4.1 | ALIGNED — all zones covered |
| 4B Teacher Dashboard | Story 4.2 | ALIGNED — all zones covered |
| 4C Manager Dashboard | Story 4.3 | ALIGNED — all zones covered |
| 4D Admin Dashboard | Not in Epic 4 | OK — covered by Epic 1 Story 1.4 (by design) |

### Findings

#### HIGH Severity

**H-1: Period filter `90d` not in architecture API contract**
- **Location:** Story 4.3 AC6
- **Issue:** Epic adds `90d` as a 4th period filter option. Architecture contract (Section 10.1.1) defines `?period=7d|30d|all` (3 options only). This divergence means either the API contract needs updating or the epic should remove `90d`.
- **Impact:** Dev may implement `90d` but architecture doesn't support it. API validation could reject it.
- **Recommendation:** Update architecture.md Section 10.1.1 to add `90d` to ManagerAnalytics query params: `?period=7d|30d|90d|all`. The 90-day view is valuable for executive reporting.
- **Suggested owner:** @architect

#### MEDIUM Severity

**M-1: `lastAccessedAt` derivation undefined**
- **Location:** Story 4.1 AC3, Technical Notes
- **Issue:** `StudentAnalytics.courses[].lastAccessedAt` is in the architecture contract but the `enrollments` table has no `last_accessed_at` column. The epic says "ultimo acesso (data relativa)" but doesn't specify how to compute it. Must be derived from `MAX(sessions.started_at)` for student+course, or `enrollments.updated_at` as fallback.
- **Recommendation:** Add explicit derivation in Technical Notes: `lastAccessedAt = MAX(sessions.started_at) WHERE student_id = X AND chapter_id IN (course chapters)`. Fallback to `enrollments.enrolled_at` if no sessions.
- **Suggested owner:** @pm

**M-2: Recharts not in architecture tech stack**
- **Location:** Story 4.3, Epic Context
- **Issue:** Epic introduces Recharts as charting library but it's not listed in architecture.md Section 3 (Tech Stack). shadcn/ui charts uses Recharts under the hood, but the dependency should be explicit.
- **Recommendation:** Add Recharts to architecture.md Section 3: `| Charting | Recharts | 2.x | Graficos de analytics | Integrado com shadcn/ui charts, leve, SSR-friendly |`
- **Suggested owner:** @architect

**M-3: Missing teacher empty state AC**
- **Location:** Story 4.2
- **Issue:** Story 4.2 tests mention "teacher sem cursos (empty state)" but no AC defines this behavior. Story 4.1 has explicit empty state AC (AC7). Teacher should also have an empty state when they have no courses.
- **Recommendation:** Add AC11 to Story 4.2: "Empty state para teacher sem cursos: 'Voce ainda nao criou nenhum curso.' + botao 'Criar Curso' (link para `/courses`)"
- **Suggested owner:** @pm

**M-4: Feature flag `ai_detection` not checked in ACs**
- **Location:** Stories 4.2 (AC5) and 4.3 (AC4, AC5)
- **Issue:** `tenant.settings.features.ai_detection` is a configurable feature flag (architecture.md Section 6.1, TenantSettings). If disabled, AI detection columns/badges should be hidden. Neither story checks this flag.
- **Recommendation:** Add conditional to Stories 4.2 and 4.3: "AI detection data only visible if `tenant.settings.features.ai_detection === true`. If disabled, column/badge hidden."
- **Suggested owner:** @pm

**M-5: CSV export missing audit task**
- **Location:** Story 4.3
- **Issue:** Risk Mitigation mentions "Auditoria via PostHog event" for CSV exports containing student names, but no AC or task implements this tracking. LGPD compliance requires audit trail for data exports.
- **Recommendation:** Add task to Story 4.3: "Implementar PostHog event `analytics_csv_exported` com metadata (user_id, role, course_filter, row_count) ao exportar CSV"
- **Suggested owner:** @pm

**M-6: `/analytics` route behavior for non-manager roles**
- **Location:** Story 4.3 AC10
- **Issue:** AC10 says "/analytics redireciona para /dashboard se role = manager" but doesn't define behavior for other roles (student, teacher, admin) accessing `/analytics` directly. Could leak manager-only data if route is accessible.
- **Recommendation:** Clarify AC10: "/analytics redireciona para /dashboard para qualquer role. Sidebar so exibe 'Analytics' para manager (ja definido em screens.md). Nenhuma verificacao de role adicional necessaria — /dashboard ja renderiza por role."
- **Suggested owner:** @pm

**M-7: Shared components creation order vs parallel execution**
- **Location:** Dependency Graph, Shared Components section, SM Handoff
- **Issue:** Epic claims all 3 stories can run in parallel, but Shared Components (`SummaryCards`, `PeriodFilter`, `EmptyState`) must be created once. SM Handoff recommends starting with Story 4.1 — this contradicts the "parallel" claim. If stories truly run in parallel, two devs might create competing `SummaryCards` implementations.
- **Recommendation:** Add a note: "Se rodar em paralelo, designar Story 4.1 como dona dos shared components. Stories 4.2 e 4.3 reutilizam. Se 1 dev, executar 4.1 primeiro." Alternatively, create a Story 4.0 (Setup Shared Dashboard Components) with SP=2.
- **Suggested owner:** @pm

#### LOW Severity

**L-1: WCAG AA not addressed for charts**
- **Location:** Story 4.3 (EngagementChart)
- **Issue:** PRD requires WCAG AA. Recharts line charts may not be accessible to screen readers without explicit ARIA labels and data table fallback. No AC addresses accessibility for charts.
- **Recommendation:** Add note in Technical Notes: "EngagementChart deve incluir `aria-label` descritivo e considerar tabela de dados acessivel como fallback para screen readers."

**L-2: Dual-mode label mapping vague**
- **Location:** Story 4.3 AC9
- **Issue:** AC9 says university → "Notas", "Frequencia" and corporate → "Competencias", "ROI" but doesn't specify which of the 4 summary cards these labels replace. The modeLabels config object in Technical Notes only has 2 keys (`metric1`, `metric2`).
- **Recommendation:** Specify exact card mapping in AC9 or Technical Notes.

**L-3: Missing `qa_reports` in Epic Context DB Tables**
- **Location:** Epic Context table
- **Issue:** Lists 7 tables but omits `qa_reports`. While dashboards don't directly display QA data, the Tester's approval rate could be a future metric.
- **Recommendation:** Minor — add for completeness or note "qa_reports (not used in dashboards)".

### Epic Format Consistency

| Criteria | Status | Notes |
|----------|--------|-------|
| Version/Created/Updated/Author/Status | PASS | All present |
| PRD/Architecture/Screens references | PASS | All referenced with versions |
| Epic Goal | PASS | Clear, measurable |
| Epic Context table | PASS | Comprehensive |
| Dependency Graph | PASS | Clear parallel notation |
| Story format (user story, SP, Priority, Blocked By, Blocks) | PASS | Consistent with Epics 1-3 |
| Acceptance Criteria (numbered, checkboxes) | PASS | 10-11 ACs per story |
| Technical Notes | PASS | Detailed, references architecture |
| Agent Assignments | PASS | Consistent with Epic 3 format |
| Quality Gates table | PASS | Pre-Commit + Pre-PR defined |
| Tasks (checkboxes) | PASS | 10-14 tasks per story |
| Definition of Done | PASS | Aligned with ACs |
| Risk Mitigation | PASS | 6 risks with impact/mitigation/rollback |
| Quality Assurance Strategy | PASS | CodeRabbit + risk alignment |
| Epic Compatibility Requirements | PASS | 8 prerequisites listed |
| SM Handoff | PASS | Detailed with recommendations |
| Shared Components section | BONUS | Good addition not in Epics 1-3 |

### Quality Assessment Summary

| Dimension | Score | Notes |
|-----------|-------|-------|
| PRD Traceability | 100% | All 21 ACs mapped |
| Architecture Alignment | 90% | 1 divergence (90d period) |
| Screens Alignment | 100% | All 4 variants accounted for |
| Format Consistency | 100% | Matches Epics 1-3 pattern |
| Technical Depth | 95% | Strong query specs, component design |
| Risk Coverage | 90% | Good risk table, missing audit trail task |
| Testability | 85% | Tests listed but no Given-When-Then scenarios |

### Gate Status

Gate: **CONCERNS** → `docs/qa/gates/epic-4-dashboards-analytics.yml`

**Rationale:** 1 HIGH finding (H-1: architecture contract divergence on period filter) and 7 MEDIUM findings. No CRITICAL issues. PRD coverage is 100%. All findings are addressable by @pm and @architect without structural changes to the epic.

### Recommended Status

**Changes Required** — Address H-1 (architecture alignment) and M-1 through M-7 before moving to story creation. All findings are documentation-level fixes, not structural rework.

— Quinn, guardiao da qualidade 🛡️
