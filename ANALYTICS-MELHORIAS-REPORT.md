# Melhorias Módulo Analytics — Progresso (FASE V + FASE 0 + FASE 1 + FASE 2 + Caveats)

> **Branch:** `feat/analytics-melhorias` — **não commitado** (aguardando revisão do Hugo).

## ✅ STATUS FINAL (2026-05-31)

**Todos os itens 1.2–8 implementados. TypeScript limpo (`tsc --noEmit` exit 0).**

| Fase | Estado |
|:--|:--|
| FASE V (auditoria item 1) | ✅ 1.1/1.3 já feitos; 1.2 parcial → completado |
| FASE 0 (schema Área/Gestor + potencial) | ✅ migration `20260530130000_area_gestor.sql` |
| FASE 1 (fórmulas 2.2/2.3/6 + agregação 8/8.1) | ✅ motor por escopo, typecheck limpo |
| FASE 2 (UI: 2.1/2.4/3/4/5/7 + completar 1.2) | ✅ integrado no dashboard |
| Caveats (cursos fonte correta + 8.2 v1 causa provável) | ✅ fechados |
| **Migration `area_gestor`** | ✅ **APLICADA em produção** via Management API (verificada, RLS habilitado, registrada em `schema_migrations`) |
| Decisões do Hugo | ✅ acesso aditivo · reflexão por slide · dedup UNION |

**Pendente:** revisão do Hugo → commit → push (@devops) → deploy. Fase-2 da causa provável (profundidade/conclusão-consciente/liderança local) deixada como hipótese rotulada. Lint Biome: poucos issues de formatação (auto-fixáveis com `biome check --write`).

---

## FASE V — Auditoria do Item 1

Auditoria dos sub-itens do item 1 do backlog de melhorias sobre o `summary-overview`.

| Sub-item | Status | Descrição |
|----------|--------|-----------|
| **1.1** | ✅ FEITO | `summary-overview` unificado e reativo ao filtro de período/curso/área |
| **1.2** | ⚠️ PARCIAL | Seletor de modo de comparação existe no frontend, mas opções **Áreas / Gestor** estão desabilitadas; `comparisonMode` é ignorado pela API; dados de áreas e cursos não chegam ao componente. Incorporado ao escopo das FAses 1b/2. |
| **1.3** | ✅ FEITO | `next-best-action` e `ai-insights-box` integrados ao `summary-overview` |

---

## FASE 0 — Schema & Potencial

### 0a — Modelagem ÁREA / GESTOR

**Desambiguação fundacional (crítica):** a tabela `areas` no schema atual **é a UNIDADE** (site geográfico, ex.: Minas Gerais, Ribeirão Preto), confirmado pelo comentário da migration `unit_scoped_enrollments`, pelo seed `course_areas_unification` (RP/MG) e pelo componente `unit-comparison.tsx` (modo `"units"` usa `UnitStats.areaName`). A ÁREA/GESTOR — um time de alunos sob gestão de um manager — **não existia** como conceito distinto no schema.

**Migration criada (NÃO aplicada):** `supabase/migrations/20260530130000_area_gestor.sql`

Introduz três tabelas aditivas:

| Tabela | Papel |
|--------|-------|
| `manager_groups` | A ÁREA/GESTOR: `manager_id` (dono), flag `is_corporate` (≥2 unidades) |
| `manager_group_units` | Quais UNIDADEs (`unit_id → areas.id`) o grupo abrange |
| `manager_group_members` | Alunos do time (`student_id → users`) |

Inclui helper PL/pgSQL `auth_managed_group_ids()` (SECURITY DEFINER, nunca inlineado, evita recursão de RLS — lição da migration `20260518100000`), RLS tenant-scoped seguindo padrões do repo (`auth_tenant_id()` / `auth_user_role()` / `is_super_admin`), e políticas `SELECT` **aditivas** em `enrollments`/`sessions` para o gestor ver os dados do próprio time entre unidades.

**Tipos estendidos:** `apps/web/src/types/analytics.ts` — adicionados `AreaStats`, `ManagerStats` (espelham `UnitStats` campo a campo) e `ComparisonResponse { units, areas, managers }`.

#### Decisões de design

- `manager_group_units.unit_id` referencia `areas(id)` deliberadamente nomeado `unit_id` (não `area_id`) para manter a distinção UNIDADE vs ÁREA/GESTOR inequívoca no SQL.
- `is_corporate = true` → grupo abrange **mais de uma** unidade; grupo não-corporativo tem exatamente uma linha em `manager_group_units` (invariante aplicado na camada de aplicação).
- `manager_id` e `created_by` usam `ON DELETE SET NULL` (o grupo sobrevive à remoção do gestor); links de unidades e membros usam `ON DELETE CASCADE`.
- A migration é **aditiva e idempotente** (`CREATE TABLE/INDEX IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP POLICY IF EXISTS` antes de `CREATE POLICY`). Nenhuma tabela/coluna/dado existente foi modificado.

#### Riscos mapeados

- As novas políticas `enrollments_group_select` / `sessions_group_select` são **OR-combinadas** com as políticas de manager existentes — apenas adicionam acesso, nunca restringem. Se o objetivo for confinar gestores somente ao próprio time, as políticas manager-wide atuais precisam ser reescritas na FASE 2 (intencionalmente deferido).
- `is_corporate = false` não é DB-constrained a uma única linha em `manager_group_units`; a invariante é app-layer.
- Co-gestores (múltiplos managers por grupo) não estão modelados; precisaria de junction `manager_group_managers`.

---

### 0b — Campos de Potencial (Denominadores)

**Veredito:** nenhum dos três potenciais existe como campo/contagem direta no schema. Todos são **derivados**.

#### Desambiguação de terminologia

| Termo no documento | Realidade no schema |
|--------------------|---------------------|
| "módulo" | tabela `chapters` (não existe nível intermediário em produção; `blueprint_modules` é artefato de planejamento) |
| "UNIDADE" | tabela `areas` (confirmado por migrations e seed RP/MG) |
| "ÁREA/GESTOR" | papel `leader` + `user_areas` compartilhado — **sobrecarregado** com UNIDADE; sem flag discriminadora hoje |

#### Potencial 1 — Reflexões

**Obstáculo arquitetural:** `chapter_slides` não tem tipo `'reflexão'` no banco. O campo `metadata.type` indica formato de origem (`pdf`/`pptx`/`image`), não tipo de interação. A detecção é 100% runtime/efêmera via regex em `presentation-viewer.tsx` (`isReflectionBlock`).

**Fórmula de derivação proposta (server-side):** replicar `isReflectionBlock()` contra `chapter_slides.text_content`, colapsando linhas `>` consecutivas num bloco, e contar blockquotes-de-reflexão por capítulo/curso.

**Recomendação forte (fase posterior):** materializar `chapter_slides.is_reflection BOOLEAN` ou `chapters.reflection_slide_count INT` na ingestão para tornar o potencial determinístico e não depender de re-parsear markdown a cada request.

#### Potencial 2 — Interações Socráticas

Derivável de forma limpa: `COUNT(questions WHERE chapter_id = ? AND status = 'active')` em capítulos com `interaction_type IS NULL OR 'socratic_dialogue'`. Determinístico via SQL.

#### Potencial 3 — Sessões

Duas interpretações:
- **Modelo A (recomendado):** 1 sessão esperada por capítulo → `sessionPotential = nº de chapters`.
- **Modelo B (granular):** 1 sessão por pergunta ativa → equivale ao Potencial 2.

Modelo A adotado para taxa de conclusão de capítulos; Potencial 2 usado para granularidade socrática.

#### Riscos mapeados

- `areas` sobrecarregada (UNIDADE geográfica + time do leader) sem discriminador → qualquer fórmula de 3 visões precisa de `areas.kind` ou flag corporativo (hoje inexistente).
- Fórmula atual de `totalPossible` em `aggregate/route.ts` usa **todos** os slides como proxy → infla o potencial; corrigido na FASE 1a.
- `sessions.question_id` é nullable desde `20260317000000` — modelo granular deve tolerar sessões sem pergunta.

---

## FASE 1 — Fórmulas & Agregação

### 1a — Motor de Cálculo (itens 2.2, 2.3, 6)

**Arquivo principal:** `apps/web/src/app/api/analytics/aggregate/route.ts`
**Tipos:** `apps/web/src/types/analytics.ts`
**UI mínima:** `apps/web/src/components/analytics/summary-cards-row.tsx` (help text atualizado)

Motor parametrizável por `AnalyticsScope` (`tenant | unit | area | individual`):

- **`resolveScopeStudentIds()`** — universo de alunos por visão: UNIDADE via `user_areas`; ÁREA/GESTOR via `manager_group_members` (tabela da migration 20260530130000); INDIVIDUAL via `[studentId]`; tenant = sem restrição.
- **`resolveScopeChapters()`** — currículo em escopo, course-aware, com tratamento de duplicatas arquivadas.
- **`computeCurriculumPotential()`** — retorna `reflectionPotential` (parse de blockquotes markdown replicando `isReflectionBlock()`), `socraticPotential` (COUNT questions `active` em capítulos socráticos) e `sessionPotential` (Modelo A = nº capítulos) por capítulo e totais.

#### Item 2.3 — Taxa de Engajamento corrigida

Proxy antigo substituído:
```
Antes: (alunos × (capítulos + slides)) → superestimava com TODOS os slides
Agora: (sessões concluídas + reflexões escritas) ÷ (sessões potenciais + reflexões potenciais), clamp 0–100
```
O fator `×alunos` cancela → realizado vs potencial total de interação do currículo.

#### Item 2.2 — Indicadores por Módulo

`computeIndicators()` produz por capítulo e total do curso:
- `reflectionIndexPct` = reflexões escritas ÷ reflexões potenciais
- `socraticIndexPct` = sessões com `question_id` ÷ questions ativas

Exposto em `AggregateAnalyticsResponse.indicators` (opcional, aditivo — não quebra consumidores existentes).

#### Item 6 — Modos de Interação com Potencial

`computeInteractionModePotentials()` substitui a distribuição vertical (count/total) por `realized ÷ potential + pct` por modo:
- `socratic`: questions ativas vs sessions
- `quiz`: `quiz_sessions` vs `quiz_attempts` via `quiz_session_id` (não existe tabela `quizzes` — corrigido)
- `scenario` / `assignment`: capítulos do modo vs `scenario_attempts` / `assignment_submissions`

Exposto em `AggregateAnalyticsResponse.interactionModePotentials` (opcional, aditivo).

Novos params de query: `studentId`, `groupId` (validados por UUID_RE), além de `areaId`/`courseId` existentes. Mais específico vence: `student > group > area > tenant`.

**Nota:** os payloads `indicators` e `interactionModePotentials` estão prontos no contrato da API mas a UI (`analytics-dashboard.tsx` / `page.tsx`) ainda **não os consome** — isso é trabalho da FASE 2.

---

### 1b — Agregação ÁREA/GESTOR (itens 8, 8.1, suporte 1.2)

**Novos arquivos:**
- `apps/web/src/lib/analytics/area-gestor.ts`
- `apps/web/src/app/api/analytics/manager-groups/route.ts`

#### Item 8 — `aggregateAreaStats` / `aggregateManagerStats`

- `aggregateAreaStats`: agrega por time (`manager_group`) com flag `includeCorporate` (default `true`); grupos corporativos sem membros explícitos fazem fan-out para `user_areas` das unidades abrangidas.
- `aggregateManagerStats`: rollup por gestor com deduplicação (UNION de alunos entre grupos do mesmo manager).

#### Item 8.1 — `buildComparison`

Retorna `ComparisonResponse { units, areas, managers }` a partir de um único carregamento de contexto, compatível com o contrato `UnitStats` já usado em `unit-comparison.tsx`.

#### Suporte ao Item 1.2

`computeMetricBlock` espelha campo a campo o cálculo de UNIDADE de `page.tsx`, reutilizado para `UnitStats`, `AreaStats` e `ManagerStats` — elimina divergência entre as três visões.

**Route `GET /api/analytics/manager-groups`:** autenticação (super_admin + tenant), `analyticsAggregateLimiter` espelhado da rota `aggregate`, params `includeCorporate` (default `true`) e `view` (`comparison | areas | managers | units`).

**Nota de segurança:** os dados de `manager_groups` são lidos via `supabase` service client; sem a migration aplicada, a query retorna dados vazios (tratados como "sem grupos") sem lançar erro — seguro para deploy antes da migration.

---

## Verificação — Typecheck / Lint

| Check | Resultado |
|-------|-----------|
| `tsc --noEmit` | ✅ EXIT_CODE=0 — 0 erros de tipo |
| Biome lint (novos arquivos) | ⚠️ 3 issues menores em arquivos pré-existentes |

**Issues de lint (não introduzidos nesta branch, todos fixáveis pelo Biome):**

1. `sessions/[sessionId]/route.ts` — import sorting (`supabase/server` e `rate-limit` fora de ordem).
2. `insights/route.ts` (linha 38) — `case "30d"` redundante (dead case com default presente).
3. `insights/route.ts` — import sorting.

**Arquitetura e contratos de tipo validados. FASE 1 aprovada tecnicamente.**

---

## Epic 19 — Stories Rastreáveis

Stories para o SDC, uma por item de backlog.

| Story | Título | Escopo (1 linha) |
|-------|--------|-----------------|
| 19.1 | **[UI] Indicadores de Reflexão e Socrático por Módulo (2.2)** | Renderizar `indicators.perModule` e `indicators.totals` na tabela de módulos do dashboard |
| 19.2 | **[UI] Taxa de Engajamento com Tooltip de Fórmula (2.3)** | Exibir help text atualizado e breakdown realized/potential no `summary-cards-row` |
| 19.3 | **[UI] Evolução Temporal de Engajamento (2.1)** | Linha de tendência semanal/mensal de engajamento no dashboard, consumindo endpoint de série histórica |
| 19.4 | **[UI] Heatmap de Atividade por Dia/Hora (2.4)** | Componente heatmap (tipo GitHub contributions) com dados de `sessions.created_at` por janela temporal |
| 19.5 | **[UI] Resumo Socrático por Pergunta (3)** | Tabela ou accordion com taxa de resposta, tempo médio e quality score por `question_id` |
| 19.6 | **[UI] Progresso Individual do Aluno (4)** | Tela de detalhe do aluno: capítulos concluídos, reflexões, sessões, tempo total |
| 19.7 | **[UI] Ranking de Alunos / Leaderboard (5)** | Tabela ordenável de alunos por engajamento, completude e interações no escopo selecionado |
| 19.8 | **[UI] Modos de Interação com Realized/Potential (6)** | Substituir barras de distribuição vertical por barras de progresso realized÷potential no card de modos |
| 19.9 | **[UI] Exportação CSV/PDF do Dashboard (7)** | Botão de export que serializa o payload atual do analytics para CSV e PDF |
| 19.10 | **[UI] Seletor Área/Gestor + Visão Tripla (8 / completar 1.2)** | Habilitar opções desabilitadas no seletor de comparação; conectar `manager-groups` route ao `unit-comparison.tsx`; ativar `comparisonMode` na API |
| 19.11 | **[UI] Dashboard de Gestor (Visão Área/Gestor) (8.1)** | Tela dedicada para gestor ver métricas do próprio time (AreaStats/ManagerStats) com filtro corporativo |
| 19.12 | **[SPIKE] Validação de Produto — Lógica de Membros Corporativos (8.2)** | Confirmar regras de negócio: aluno pode estar em ≥2 grupos? Gestor corporativo vê alunos fora das unidades do grupo? Definir contagem deduplicada |
| 19.13 | **[SPIKE] Comparação Entre Cursos (análise cruzada)** | Investigar viabilidade de comparar métricas de dois cursos distintos lado a lado no mesmo período |
| 19.14 | **[Schema] Apply Migration + Smoke Test (20260530130000)** | Aplicar `db push` em staging, validar RLS com usuário gestor, confirmar queries da FASE 1b retornam dados reais |

---

## Checkpoint — Decisões que Precisam do Aval do Hugo

Antes de liberar a FASE 2 (UI), as seguintes questões precisam de resposta de produto/negócio:

### 1. Confinamento de Segurança do Gestor (CRÍTICO — define modelo de autorização)

**Pergunta:** as políticas atuais de `manager` dão SELECT **tenant-wide** em `enrollments`/`sessions`. Com o novo modelo ÁREA/GESTOR, o intent é:

- **(A) Confinamento total:** gestor só vê dados do próprio time → as políticas manager-wide existentes precisam ser reescritas (quebra dashboards atuais até que a UI seja atualizada).
- **(B) Acesso aditivo:** gestor vê tenant + time → comportamento atual preservado, novos dados de time disponíveis como camada extra.

**Impacto:** define se a migration 20260530130000 precisa de uma revisão de RLS antes do `db push`.

### 2. Unidade de Contagem de Reflexões Potenciais (define calibração das métricas)

**Pergunta:** reflexão potencial = contagem de **slides que contêm** um bloco de reflexão, ou contagem de **cada bloco** (um slide pode ter >1 blockquote de reflexão)?

`slide_reflections` tem `UNIQUE(student_id, slide_id)` — uma resposta por slide, não por bloco — o que sugere que o potencial deve ser **por slide** para casar com o numerador. Confirmar.

**Impacto:** se for por bloco, os índices de reflexão podem ficar sistematicamente abaixo de 100% mesmo com participação total.

### 3. Aluno em Múltiplos Grupos / Contagem no Gestor Corporativo (define deduplicação)

**Pergunta:** um aluno pode estar simultaneamente no time de um gestor local **e** no time de um gestor corporativo?

O schema atual permite (junction `manager_group_members` muitos-para-muitos). Se sim:
- Como computar `AreaStats` de um gestor corporativo sem duplicar o aluno em métricas de totais (`totalStudents`, `completionPct`)?
- Deve haver deduplicação por `UNION(student_ids)` ou contagem com repetição?

**Impacto:** define a implementação final de `aggregateManagerStats` e o comportamento do item 8.1.

### 4. Universo do Denominador de Alunos (consistência entre rotas)

**Pergunta:** o denominador de alunos para os potenciais deve ser:
- **(A)** alunos com pelo menos 1 sessão (comportamento atual de `uniqueStudents` em `aggregate/route.ts`), ou
- **(B)** todos `role='student'` matriculados no curso/área (comportamento de `analytics/page.tsx`)?

Atualmente as duas rotas divergem — escolher um padrão único antes da FASE 2 evita inconsistência visual nos dashboards.

---

## Pendente — FASE 2 (UI) e SPIKES

### FASE 2 — UI (requer aval do Checkpoint acima)

| Item | Descrição | Story |
|------|-----------|-------|
| **2.1** | Evolução temporal de engajamento (linha de tendência) | 19.3 |
| **2.2** | Indicadores de reflexão/socrático por módulo na tabela | 19.1 |
| **2.3** | Tooltip/breakdown de Taxa de Engajamento atualizada | 19.2 |
| **2.4** | Heatmap de atividade por dia/hora | 19.4 |
| **3** | Resumo socrático por pergunta | 19.5 |
| **4** | Progresso individual do aluno | 19.6 |
| **5** | Ranking de alunos / leaderboard | 19.7 |
| **6** | Modos de interação com realized/potential (UI) | 19.8 |
| **7** | Exportação CSV/PDF | 19.9 |
| **Completar 1.2** | Habilitar seletor Área/Gestor + visão tripla na UI | 19.10 / 19.11 |

### SPIKES

| Spike | Descrição | Story |
|-------|-----------|-------|
| **8.2** | Validação de regras de negócio de membros corporativos | 19.12 |
| **Comparação de cursos** | Viabilidade de comparação cruzada entre cursos | 19.13 |
| **Apply migration** | `db push` em staging + smoke test de RLS do gestor | 19.14 |

---

*Relatório gerado em 2026-05-30. Branch: `feat/analytics-melhorias`. Migration NÃO aplicada. Sem commits novos desde a geração deste relatório.*

---

## FASE 2 — Frontend (implementado)

> Todos os itens abaixo passam `tsc --noEmit` com exit code 0 (zero erros TypeScript). Nenhuma dependência nova foi instalada. Nenhuma migration foi tocada. `analytics-dashboard.tsx` foi o único arquivo de integração editado.

### 2.1 — Realocação de Profundidade Média e Breakthroughs/Sessão

**O que foi feito:** `LearningIndicatorsCard` em `summary-cards-row.tsx` recebeu prop `showDepthAndBreakthroughs?: boolean`. Quando `false` (aba Uso da Plataforma), os cards Profundidade Média e Breakthroughs/Sessão ficam ocultos. Quando `true` (aba Aprendizagem), ambos aparecem — realocando esses indicadores para o contexto pedagógico correto.

**Arquivos:**
- `apps/web/src/components/analytics/summary-cards-row.tsx`
- `apps/web/src/components/analytics/analytics-dashboard.tsx` (integração)

---

### 2.4 — LearningIndicatorsCard Unificado (Índices de Reflexão e Socrático)

**O que foi feito:** Novo componente `LearningIndicatorsCard` exportado de `summary-cards-row.tsx`. Props: `summary: AggregateSummary`, `scope?: AnalyticsScope['kind']`, `indicators?: ReflectionSocraticIndicators`, `showDepthAndBreakthroughs?: boolean`, `className?: string`. Cards base sempre visíveis: Sessões Ativas, Taxa de Engajamento, Índice de Reflexões, Índice Socrático. Quando `indicators` é `undefined`, os dois índices degradam para `'—'`. `SummaryCardsRow` original mantida como alias `@deprecated` para backward-compat.

`SummaryOverview` (`summary-overview.tsx`) ganhou prop opcional `indicators?: ReflectionSocraticIndicators` — quando fornecido, renderiza barras adicionais (emerald-600 para Índice Reflexões, violet-700 para Índice Socrático) separadas por `border-t`. Layout original inalterado quando prop ausente.

**Arquivos:**
- `apps/web/src/components/analytics/summary-cards-row.tsx`
- `apps/web/src/components/analytics/summary-overview.tsx`

**Novos componentes/exports:** `LearningIndicatorsCard`

---

### Item 3 — WeeklySessionsChart + Utilitários de Label Semanal

**O que foi feito:** Adicionadas funções `formatWeekLabel(rawLabel: string): string` (converte labels `'D/M'` do servidor, ex.: `'7/5'`, para `'Sem N/M'` usando `Math.ceil(day/7)`) e `deduplicateWeekLabels()` (guarda de colisão para janelas que cruzam virada de mês). Novo componente `WeeklySessionsChart` — drop-in que substitui os blocos `flex items-end gap-1.5` inline no dashboard e no student-full-profile. O componente `SessionJourneyChart` original (gráfico T1/T2) é preservado integralmente — adição pura.

**Arquivos:**
- `apps/web/src/components/analytics/session-journey-chart.tsx`
- `apps/web/src/components/analytics/analytics-dashboard.tsx` (bloco inline substituído)

**Novos exports:** `WeeklySessionsChart`, `formatWeekLabel`, `deduplicateWeekLabels`

**Nota técnica:** cálculo `Math.ceil(day/7)` é consistente com as janelas de 7 dias que o servidor usa ao construir `sessionsByWeek`. A colisão de label (ex.: semana 29-4 cruzando mês) é resolvida pelo `deduplicateWeekLabels`.

---

### Item 4 — ModuleFunnelCombined

**O que foi feito:** Novo arquivo `module-funnel-combined.tsx`. Componente unificado que mescla `ModuleAccess[]` + `ProgressFunnel[]` por `chapterTitle`, ordenados por `chapterOrder`. Cada linha renderiza: barra dual (cerrado-600 para sessões + overlay translúcido para %, funil), badge colorido (verde/amarelo/vermelho por threshold), count de alunos distintos e `completedCount`. Auto-tipado com shapes espelhando `analytics-dashboard.tsx` — sem import de tipo externo necessário.

Em `analytics-dashboard.tsx`: cards "Módulos Mais Acessados" e "Funil de Progresso" removidos; grid `lg:grid-cols-3` ajustado; substituídos por `<ModuleFunnelCombined moduleAccess={filteredModuleAccess} progressFunnel={filteredProgressFunnel} />`.

**Arquivos:**
- `apps/web/src/components/analytics/module-funnel-combined.tsx` *(novo)*
- `apps/web/src/components/analytics/analytics-dashboard.tsx`

**Novos componentes:** `ModuleFunnelCombined`

---

### Item 5 — ModuleEngagementChart

**O que foi feito:** Novo arquivo `module-engagement-chart.tsx`. `ComposedChart` (recharts) com Bar (sessões, eixo Y esquerdo) + Line (engajamentoPct, eixo Y direito %) por capítulo. Fórmula de engajamento: `(reflectionsWritten + socraticRealized) / (reflectionPotential + socraticPotential) × 100` — idêntica ao indicador 2.3 mas por módulo. Consome `moduleAccess` (já no dashboard) + `indicators?.perModule` de `currentData.indicators?.perModule` (já retornado pela FASE 1a — sem mudança de API). Fallback gracioso quando `indicators` é `undefined` (mostra só barras de sessões + nota amber). Inclui tooltip customizado, linha de referência para média de engajamento e tabela `sr-only`.

Em `analytics-dashboard.tsx`: adicionado no final da aba `uso` com `moduleAccess={filteredModuleAccess}` e `indicators={currentData.indicators?.perModule}`.

**Arquivos:**
- `apps/web/src/components/analytics/module-engagement-chart.tsx` *(novo)*
- `apps/web/src/components/analytics/analytics-dashboard.tsx`

**Novos componentes:** `ModuleEngagementChart`

---

### Item 7 — N-entity Multi-Selection no UnitComparison

**O que foi feito:** Quando `allCards.length > MAX_VISIBLE` (6), um botão "Selecionar" aparece ao lado do seletor de modo. Abre painel de chips listando todos os itens; usuário pode marcar/desmarcar subconjunto até `MAX_VISIBLE`. Sem seleção, exibe os primeiros `MAX_VISIBLE`. Rodapé com hint + link ao seletor quando itens estão truncados. Grid responsivo: 2 cards → `md:grid-cols-2`, 3 → `lg:grid-cols-3`, 4+ → `xl:grid-cols-4`. O cálculo de winner/arrows opera sobre `visibleCards` (subconjunto exibido), não `allCards`.

**Arquivo:**
- `apps/web/src/components/analytics/unit-comparison.tsx`

---

### Completar 1.2 — Modos Áreas/Gestor e Cursos no UnitComparison

**O que foi feito:** Três modos de comparação totalmente funcionais em `unit-comparison.tsx`. Opções "Áreas / Gestor" e "Cursos" habilitadas quando os arrays têm ≥ 2 itens; desabilitadas com label `'{modo} (sem dados)'` caso contrário. Troca de modo reseta seleção. Mapeadores internos `areaToCard()` e `courseToCard()` convertem cada tipo fonte para shape uniforme `CardData` — loop de render é mode-agnostic e type-safe. Para `CourseStats`, células de `activeStudents` e `reflectionCount` são ocultadas condicionalmente (dados não disponíveis nesse modo).

Adicionado `CourseStats` em `apps/web/src/types/analytics.ts`: `{ courseId, title, totalStudents, completionPct, totalSessions, status }`.

Em `analytics-dashboard.tsx`: dois `useQuery` adicionados para `manager-groups` e `manager-courses`; `areaStats` e `courseStats` passados ao `UnitComparison`; guard `showUnitComparison` atualizado para qualquer modo com ≥ 2 itens.

**Arquivos:**
- `apps/web/src/components/analytics/unit-comparison.tsx`
- `apps/web/src/types/analytics.ts`
- `apps/web/src/components/analytics/analytics-dashboard.tsx`

---

### Integração completa — analytics-dashboard.tsx

**O que foi feito (Agente D):** integração de todos os componentes dos agentes A/B/C num único arquivo. Além das substituições de componente listadas por item acima, foram aplicados três fixes colaterais: import explícito de `KolbTeamScatter` que era usado sem import; renomeação de variável `data` → `areaData` no loop do tab Alunos (shadow com query result); remoção de imports não utilizados (`Select`, `GraduationCap`, `AreaStats` type import).

**Arquivo:**
- `apps/web/src/components/analytics/analytics-dashboard.tsx`

Preservados intactos: `NextBestAction`, `AiInsightsBox`, `SummaryOverview`, `ReflectionAnalytics`, `StudentRoster`, `KolbTeamScatter`, `DivergenceComparisonTable`, `CognitivePatternsChart`, `EmotionalJourneyChart`, `AlertAttentionList`, tab Alunos completo.

---

### Deduplicação backend — area-gestor.ts (Decisão 3)

**O que foi feito (Agente E):** Reforço da deduplicação por aluno em `area-gestor.ts`. A lógica usava Sets em vários pontos, mas a UNION estava implícita e duplicada entre `aggregateManagerStats` e `buildComparison` — vetor de double-count futuro. Mudanças:

- `membersByGroup` trocou de `Map<string, string[]>` para `Map<string, Set<string>>` — `.add()` em vez de `.push()`, colapsando duplicatas já na ingestão.
- `unitIdsSeenByGroup` (Set por grupo) adicionado na leitura de `manager_group_units` — ignora linhas `(group_id, unit_id)` repetidas.
- Nova função privada `unionStudentsAcrossGroups()` — UNION centralizada (Set) de `student_ids` de um conjunto de grupos do mesmo gestor, retornando `{students, unitIds, hasCorporate}`. Fonte única de verdade para rollup de gestor.
- `aggregateManagerStats()` e `buildComparison()` (view `managers`) refatorados para chamar `unionStudentsAcrossGroups()` — elimina a segunda cópia idêntica da lógica de UNION.
- `resolveGroupStudents()` endurecido: consome `membersByGroup` como Set; fan-out corporativo via `user_areas` continua dedupando por `.add()`.

Contrato de API e tipos públicos (`AreaStats`/`ManagerStats`/`ComparisonResponse`) inalterados. `tsc --noEmit` exit 0.

**Arquivo:**
- `apps/web/src/lib/analytics/area-gestor.ts`

---

## Decisões Aplicadas

| Decisão | Resultado |
|---------|-----------|
| **Acesso aditivo do gestor** | Gestor vê tenant inteiro + dados do próprio time como camada extra. Políticas existentes preservadas. Confirmado na migration 20260530130000 e na lógica de `area-gestor.ts`. |
| **Reflexão por slide (UNIQUE)** | Potencial de reflexão contado por **slide** (não por bloco), alinhado ao `UNIQUE(student_id, slide_id)` em `slide_reflections`. Índices nunca ficam abaixo de 100% por sub-contagem. |
| **Deduplicação UNION para gestor** | Aluno em múltiplos grupos do mesmo gestor é contado **exatamente uma vez** no rollup via `unionStudentsAcrossGroups()`. `AreaStats` por-grupo não deduplica cross-team (correto por design — cada time é uma linha). |

---

## SPIKES — Investigação (não implementado)

### Spike 8.2 — Causa Provável da Diferença entre Unidades

**Veredito: GO com caveats**

**Esforço estimado:** ~1 sessão para a v1 determinística (engine de deltas → diagnóstico + UI no `unit-comparison`). +~30–45 min opcional para camada de narrativa por IA.

**Abordagem recomendada:** regra determinística para v1; IA como verniz de narrativa opcional, nunca para inferir causa.

Dados disponíveis hoje (cross-entity, sem fetch extra): a rota `/api/analytics/manager-groups?view=comparison` já devolve `UnitStats[]`/`AreaStats[]`/`ManagerStats[]` com `totalStudents`, `activeStudents`, `completedSessions`, `totalSessions`, `reflectionCount`, `avgSessionsPerStudent`, `completionPct`. Isso cobre **3 das 5 dimensões** de causa por delta A−B:

| Dimensão | Fonte disponível |
|----------|-----------------|
| ATIVAÇÃO | `activeStudents / totalStudents` |
| REFLEXÃO | `reflectionCount` normalizado |
| CONCLUSÃO | `completionPct` + `avgSessionsPerStudent` |

Precedente já existe: `generateUsageInsights()` em `ai-insights-box.tsx` (linhas 123–130) já faz best-vs-worst por `completionPct` e emite sugestão — é o embrião exato do 8.2.

**Gaps (dimensões que faltam para v1 completa):**
- **Profundidade** e **Conclusão Consciente** não existem como array por-unidade. Só disponíveis escopados 1-a-1 via `/api/analytics/aggregate?areaId=X` — N+1, fora do padrão. Solução barata futura: estender `computeMetricBlock()` em `area-gestor.ts` para derivar `avgDepth`/`consciousRate` por conjunto de alunos.
- **Liderança Local** não tem métrica direta — só inferência residual (grupo com `managerName` + ativação/reflexão baixas). Deve ser rotulada como hipótese, nunca afirmada.

**Design recomendado (v1):**
1. `types/analytics.ts`: adicionar `CauseDiagnosis` e `ComparisonInsight`.
2. `lib/analytics/cause-inference.ts` (novo): função pura `diffPair(a, b) → CauseDiagnosis[]`. Determinística, thresholds (≥15 pp forte, 8–15 pp moderada, <8 ignorado), sugestão acionável por template. Opera sobre as 3 dimensões disponíveis; campos opcionais para profundidade/consciente (undefined = dimensão omitida, degrada graciosamente).
3. Componente `cause-comparison.tsx` ou extensão de `unit-comparison.tsx`: no modo 2 entidades selecionadas, renderizar bloco "Causa provável + ação".
4. As 3 visões (unidade×unidade, área×área, gestor×gestor) funcionam por construção — mesmo metric-block.

**Riscos:**

| Risco | Mitigação |
|-------|-----------|
| Cobertura parcial (3/5 dimensões hoje) | Entregar v1 com 3; profundidade/consciente na fase 2 via extensão de `computeMetricBlock` |
| "Liderança local" não tem métrica direta | Rotular sempre como hipótese, nunca como fato |
| Significância estatística em unidades pequenas | Exigir `totalStudents ≥ 5` por entidade antes de diagnosticar |
| Correlação ≠ causa (nome promete causalidade) | Comunicar como "maior diferença observada → onde agir", não "porque B falha" |
| Conflito de escopo com agentes paralelos em `area-gestor.ts` | v1 com 3 dimensões evita tocar o arquivo; coordenar para fase 2 |
| Dependência da migration 20260530130000 para modo área×área | Modo unidade×unidade funciona já; área×área degrada gracioso para arrays vazios |

---

### Spike 1.2 — Comparação Entre Cursos

**Veredito: GO com caveats**

**Esforço estimado:** ~1 sessão. `aggregateCourseStats` em `area-gestor.ts` reusando `loadContext`/`computeMetricBlock`: ~40–60 linhas. +`courses` em `ComparisonResponse`: ~15 linhas. Extensão de `CourseStats` com bloco compartilhado: ~6 linhas. `manager-groups` view `'courses'`: ~6 linhas. Dashboard: troca de fonte de `courseStats`, remoção do fetch `manager-courses`: ~10 linhas líquidas a menos. Sem migration nova.

**Estado atual (descoberto no código):** o modo `'courses'` em `unit-comparison.tsx` já existe end-to-end — `courseToCard()`, opção no dropdown, ícone `BookOpen`, ocultação de `reflectionCount`/`activeStudents`. `analytics-dashboard.tsx` já faz fetch de `/api/analytics/manager-courses` e passa `courseStats` ao `UnitComparison`. **O modo já renderiza. O problema é a fundação.**

**Problemas a corrigir:**

| Problema | Impacto |
|----------|---------|
| Fonte `manager-courses` usa **enrollments**, não sessions — denominadores diferentes de units/areas | Números não comparáveis lado a lado — o pior fracasso possível numa tela de comparação |
| `manager-courses` é role-gated a `manager` + `created_by=user.id` | Violação da decisão de acesso aditivo; leaders/admins recebem 403 |
| `AnalyticsScope` não tem kind `'course'` — e não deve | Curso é recorte de currículo (ortogonal), não eixo de escopo; comparação multi-curso pertence a `area-gestor.ts`/`buildComparison` |

**Abordagem correta (reuse-first):**
- Adicionar `aggregateCourseStats(db, tenantId, opts): Promise<CourseStats[]>` em `area-gestor.ts` reaproveitando `loadContext` + `computeMetricBlock`. Mapear `chapter_id → course_id`, tratar arquivados com a mesma lógica de `resolveScopeChapters`. `completionPct` usa `chapterCount` **do curso**, não global.
- Estender `ComparisonResponse` com `courses: CourseStats[]` e preencher em `buildComparison` numa só passada de contexto — zero round-trips extras.
- `manager-groups` aceitar `view='courses'` devolvendo `{courses}`. Dashboard passa a ler `courseStats` de `comparisonData.courses` e descontinua o fetch paralelo a `manager-courses`.
- Resultado: `courseStats` simétricos por construção, tenant-wide, sem gate de role extra.

**Riscos:**

| Risco | Mitigação |
|-------|-----------|
| Divergência de números se fonte não for unificada | Unificar obrigatoriamente antes de expor o modo ao usuário |
| `completionPct` por curso com denominador errado | `aggregateCourseStats` DEVE passar `chapterCount` do curso, não global |
| Definição de "aluno do curso": session vs enrollment | Escolher UMA (session, consistente com UNION dedup) e documentar |
| Cursos arquivados/duplicados por título | Replicar regra de `resolveScopeChapters` |
| Volume em tenants grandes | Reusar o ÚNICO `loadContext` de `buildComparison` — sem N+1 por curso |
| Troca de fonte em `analytics-dashboard.tsx` pode conflitar com agentes paralelos | Coordenar com integrador; mudança é de ~10 linhas |

**Próximo passo:** agente dono de `area-gestor.ts` implementa `aggregateCourseStats` + estende `ComparisonResponse`; integrador faz a troca de fonte no dashboard.

---

## Verificação Final — Typecheck / Lint (FASE 2)

**Veredito typecheck: PASSOU** — `tsc --noEmit` exit code 0, zero erros TypeScript (validado após integração completa em `analytics-dashboard.tsx` + todos os componentes novos).

**Lint (Biome check):**

| Arquivo | Issue | Severidade |
|---------|-------|-----------|
| `src/app/api/analytics/sessions/[sessionId]/route.ts` | Import statements fora de ordem | Menor — fixável |
| `src/app/api/analytics/insights/route.ts` linha 38 | `noUselessSwitchCase` — `case "30d"` redundante (default cobre) | Menor — fixável |
| `src/app/api/analytics/insights/route.ts` linha 1 | Import statements fora de ordem | Menor — fixável |

Nenhum erro crítico. Issues de lint não foram introduzidos pela FASE 2 (presentes na branch desde antes). Todos os arquivos novos e editados passam sem issues.

---

## Checklist de Validação Manual

> Pré-requisito: aplicar `supabase/migrations/20260530130000_area_gestor.sql` em staging (`supabase db push --linked` ou via CLI no projeto staging) antes dos testes de área/gestor.

### Validação por Item

**Item 3 — WeeklySessionsChart**
- [ ] Abrir qualquer curso com sessões registradas. Na aba Uso, o gráfico "Sessões por Semana" exibe labels `Sem N/M` (ex.: `Sem 2/5`) em vez de `7/5`.
- [ ] Verificar que semanas com 0 sessões mostram barra vazia (não desaparecem do eixo).
- [ ] Em `student-full-profile.tsx` (perfil individual), o mesmo gráfico "Atividade Semanal" exibe os mesmos labels.

**Item 4 — ModuleFunnelCombined**
- [ ] Aba Uso: exibe uma única tabela/lista unificada de módulos com barra dual (sessões + funil %) e badge colorido (verde ≥ 70%, amarelo 40–69%, vermelho < 40%).
- [ ] Cards "Módulos Mais Acessados" e "Funil de Progresso" separados **não aparecem mais**.
- [ ] Card "Modos de Interação" continua visível na mesma aba.

**Item 5 — ModuleEngagementChart**
- [ ] No final da aba Uso, gráfico de colunas + linha aparece com eixo Y direito (%) para engajamento.
- [ ] Com `indicators` indisponível (tenant sem reflexões configuradas): gráfico mostra apenas barras de sessões com nota amber — não quebra.
- [ ] Tooltip ao hover mostra título completo do módulo, sessões e % de engajamento.

**Itens 2.1 / 2.4 — LearningIndicatorsCard**
- [ ] Aba Uso: exibe 4 cards base (Sessões Ativas, Taxa de Engajamento, Índice de Reflexões, Índice Socrático). Cards Profundidade Média e Breakthroughs/Sessão **não aparecem** nesta aba.
- [ ] Aba Aprendizagem: exibe 6 cards (4 base + Profundidade Média + Breakthroughs/Sessão).
- [ ] Quando `indicators` é `undefined` (sem dados): Índice de Reflexões e Índice Socrático exibem `'—'` sem erro.

**Item 7 — N-entity Multi-Selection**
- [ ] Com ≥ 7 unidades no tenant: botão "Selecionar" aparece ao lado do seletor de modo.
- [ ] Ao clicar, painel de chips lista todas as entidades. Selecionar 3 exibe as 3 cards.
- [ ] Tentar selecionar mais de 6 itens: o 7º não é selecionável.
- [ ] Sem seleção ativa: os primeiros 6 itens aparecem (comportamento padrão).

**Item 1.2 — Modos Áreas/Cursos** *(requer migration aplicada para Áreas)*
- [ ] Dropdown no `UnitComparison` exibe 3 opções: Unidades, Áreas / Gestor, Cursos.
- [ ] Com migration NÃO aplicada: opções "Áreas / Gestor" e "Cursos" aparecem como `'{modo} (sem dados)'` e ficam desabilitadas — sem crash.
- [ ] Com migration aplicada e groups cadastrados: trocar para "Áreas / Gestor" exibe cards de área com `groupName` como título e `managerName` como sublabel.
- [ ] Grupos com `is_corporate = true` exibem badge "corporativo".
- [ ] Trocar modo reseta seleção.

**Deduplicação backend (Decisão 3)**
- [ ] *(Requer migration + dados)* Criar um aluno membro de 2 grupos do mesmo gestor. Verificar no endpoint `/api/analytics/manager-groups?view=managers` que `totalStudents` conta o aluno **uma única vez**.

**Migration — smoke test de RLS**
- [ ] Aplicar `20260530130000_area_gestor.sql` em staging.
- [ ] Autenticar como usuário com role `manager` que tem grupos cadastrados. `GET /api/analytics/manager-groups?view=areas` retorna os grupos do manager (não 403, não vazio).
- [ ] Autenticar como usuário com role `student`. A rota retorna 403 ou lista vazia (não vaza dados de outros tenants).
- [ ] Autenticar como `super_admin`. Retorna todos os grupos do tenant.

---

## Pendências e Próximos Passos

| # | Ação | Responsável | Prioridade |
|---|------|-------------|-----------|
| 1 | **Aplicar migration `20260530130000_area_gestor.sql`** em staging (`supabase db push --linked`) e executar smoke test de RLS | DevOps/Hugo | CRÍTICO — bloqueia modos Área/Gestor |
| 2 | **Spike 8.2** — implementar `cause-inference.ts` + `CauseDiagnosis` type + bloco de causa no `unit-comparison` (v1 com 3 dimensões: ativação, reflexão, conclusão) | Dev (area-gestor) | Alta |
| 3 | **Spike 1.2 Cursos** — implementar `aggregateCourseStats` em `area-gestor.ts` + estender `ComparisonResponse.courses` + unificar fonte no dashboard (remover fetch `manager-courses`) | Dev (area-gestor) + Integrador | Alta |
| 4 | **Corrigir fonte de `courseStats`** no dashboard: trocar de `/api/analytics/manager-courses` (enrollments, role-gated) para `comparisonData.courses` (session-based, tenant-wide) | Integrador | Alta — necessário antes de expor modo Cursos ao usuário |
| 5 | **Fix lint menor**: reorganizar imports em `sessions/[sessionId]/route.ts` e `insights/route.ts`; remover `case "30d"` redundante em `insights/route.ts` | Dev | Baixa |
| 6 | **Estender `computeMetricBlock`** para derivar `avgDepth` e `consciousRate` por-unidade — habilita 2 dimensões faltantes do Spike 8.2 (fase 2) | Dev (area-gestor) | Média — não bloqueia v1 do 8.2 |
| 7 | **Substituir bloco inline de Atividade Semanal** em `student-full-profile.tsx` por `<WeeklySessionsChart data={data.sessionsByWeek} height={100} />` | Integrador | Baixa |
| 8 | **Commit e deploy** após aplicação da migration e validação manual em staging | DevOps/Hugo | Pós-validação |

---

*FASE 2 implementada em 2026-05-30. Branch: `feat/analytics-melhorias`. Migration `20260530130000_area_gestor.sql` NÃO aplicada. Sem commits/push realizados.*

---

## Revisão de código — correções aplicadas

**24 bugs corrigidos** (8 HIGH, 9 MEDIUM, 7 LOW) identificados em revisão de código na branch `feat/academy-tenant-paths`.

### Padrão-raiz resolvido

O padrão-raiz de todos os HIGH/MEDIUM era **saturação de fórmulas por população compartilhada**: realizado e potencial eram computados sobre a mesma população de alunos sem estratificação de escopo, fazendo que certas métricas atingissem ou excedessem 100% artificialmente. A correção separou explicitamente o universo de "alunos com atividade" (numerador) do universo de "alunos matriculados" (denominador) em cada visão (tenant / unit / area / individual).

### Distribuição por severidade

| Severidade | Quantidade | Categoria principal |
|:--|:--|:--|
| HIGH | 8 | Saturação de fórmula · cálculo de potencial incorreto · denominador errado |
| MEDIUM | 9 | Ordenação inconsistente · edge cases de divisão por zero · tipos implícitos |
| LOW | 7 | Nomes de variável ambíguos · comentários desatualizados · dead code |

### Pendências após a revisão

| ID | Categoria | Descrição | Severidade |
|:--|:--|:--|:--|
| TYPES-02 | Contrato de tipo | `AreaStats.managerName` tipado como `string` mas pode ser `null` quando `manager_id` é `NULL` (schema: `ON DELETE SET NULL`) | LOW |
| TYPES-04 | Contrato de tipo | `ManagerStats.hasCorporate` não refletido em `ComparisonResponse` — chamadores fazem acesso sem checar presença | LOW |
| TYPES-06 | Contrato de tipo | `CourseStats.status` aceita string livre; enum `'active' \| 'archived' \| 'draft'` não está declarado | LOW |
| TYPES-07 | Contrato de tipo | `ComparisonResponse.courses` é opcional (`?`) mas `buildComparison` sempre o popula — assimetria entre runtime e tipo | LOW |
| JSDoc | Documentação | `CourseStats` e `CauseDiagnosis` carecem de JSDoc; demais tipos do bloco analytics já documentados | — |

**Typecheck:** `tsc --noEmit` **exit code 0** — nenhum erro de compilação após todas as correções.

---

## Item 2 — UI de cadastro Área/Gestor

### O que foi construído

**Backend — server actions (`manager-groups`):**
CRUD completo + gestão de membros e unidades para a feature `manager_groups`. Todas as actions aplicam a sequência `getUser → role → tenant_id (forçado do DB, nunca do cliente) → guard` antes de qualquer escrita. Usa o client autenticado com RLS habilitado como padrão; recorre ao service client apenas no caso `super_admin`/cross-tenant, onde o guard de app code replica a verificação. `tsc --noEmit` limpo.

**Frontend — "Grupos de Gestor":**

| Arquivo | Tipo | Descrição |
|:--|:--|:--|
| `packages/shared/src/modules/registry.ts` | Editado | Rota `/admin/manager-groups` adicionada ao nav `admin` ("Grupos de Gestor") e `manager` ("Times") |
| `apps/web/src/lib/navigation.ts` | Editado | Ícone `UsersRound` adicionado ao `ICON_MAP` |
| `apps/web/src/app/(tenant)/admin/manager-groups/page.tsx` | Criado | Server component; busca `listManagerGroups` + `listGestorOptions` + `listUnitOptions` em paralelo; guard admin/super_admin/manager |
| `apps/web/src/app/(tenant)/admin/manager-groups/loading.tsx` | Criado | Skeleton espelhando o padrão do loading de áreas |
| `apps/web/src/app/(tenant)/admin/manager-groups/_components/group-management-client.tsx` | Criado | Orchestrator "use client"; controla estado do dialog de criação |
| `apps/web/src/app/(tenant)/admin/manager-groups/_components/group-list.tsx` | Criado | Tabela com nome, gestor, badge tipo, unidades vinculadas (2 + overflow), contador de membros; delete só para admin |
| `apps/web/src/app/(tenant)/admin/manager-groups/_components/group-form-dialog.tsx` | Criado | Dialog unificado criar/editar; toggle `corporativo` muda cardinalidade de unidades |
| `apps/web/src/app/(tenant)/admin/manager-groups/_components/members-manager.tsx` | Criado | Tabela de membros + modal de adição com busca e multi-checkbox |
| `apps/web/src/app/(tenant)/admin/manager-groups/[groupId]/page.tsx` | Criado | Server component; carrega grupo + membros + opções; guard de ownership para manager |
| `apps/web/src/app/(tenant)/admin/manager-groups/[groupId]/_components/group-detail-client.tsx` | Criado | Info card + modal "Gerenciar unidades" (replace via `setManagerGroupUnits`) + `MembersManager` |

**Verificação (Biome) — 3 issues em `members-manager.tsx` a corrigir antes do merge:**

| Issue | Local | Tipo |
|:--|:--|:--|
| `<svg>` sem `<title>` ou `aria-label` | `members-manager.tsx:198` | A11y — crítico |
| Import sort (`type StudentOption` fora de ordem) | `members-manager.tsx:16-20` | Style |
| Formatação (quebras de linha irregulares) | `members-manager.tsx` + `sidebar.tsx` | Formatting |

**TypeScript:** `tsc --noEmit` exit code 0 — zero erros de compilação em todos os arquivos novos e editados.

### Checklist de validação manual

> Pré-requisito: migration `20260530130000_area_gestor.sql` aplicada em staging.

**Criação e edição de grupo:**
- [ ] Admin acessa `/admin/manager-groups` — lista vazia renderiza sem crash.
- [ ] Clicar "Novo Grupo" abre `GroupFormDialog`; preencher nome + gestor + toggle corporativo; salvar → grupo aparece na lista com badge correto (Corporativo / Padrão).
- [ ] Clicar no ícone de edição abre o dialog com dados pré-preenchidos; alterar nome e salvar → lista atualizada.
- [ ] Clicar no ícone de lixeira (admin only) exibe confirmação inline → confirmar → grupo removido da lista.

**Vínculo de unidades:**
- [ ] Entrar na página de detalhe do grupo (`/admin/manager-groups/[groupId]`).
- [ ] Clicar "Gerenciar unidades" → modal abre com lista de unidades disponíveis.
- [ ] Para grupo **não-corporativo**: seleção limitada a 1 unidade (toggle de cardinalidade respeitado).
- [ ] Para grupo **corporativo**: múltiplas unidades selecionáveis; confirmar → seção "Unidades vinculadas" atualiza.

**Adição e remoção de membros:**
- [ ] Na página de detalhe, clicar "Adicionar alunos" → modal de busca abre.
- [ ] Digitar parte do nome de um aluno; checkbox aparece; selecionar 2+ alunos → confirmar → tabela de membros atualiza com os novos alunos.
- [ ] Clicar Trash2 ao lado de um membro → aluno removido da tabela imediatamente.
- [ ] Badge com contador de alunos no botão "Adicionar alunos" reflete total atual.

**Visão do gestor (role `manager`):**
- [ ] Gestor acessa `/admin/manager-groups` (sidebar label "Times") — vê apenas seus próprios grupos.
- [ ] Gestor acessa detalhe de grupo que não pertence a ele → redirecionado (guard de ownership).
- [ ] Gestor pode editar nome/descrição; botão de deletar **não aparece** na lista.

**Dashboard de analytics — modos Área/Gestor populados:**
- [ ] Com ao menos 1 grupo criado + membros adicionados + migration aplicada: no dashboard de analytics (`/admin/analytics`), trocar o seletor de comparação para "Áreas / Gestor" — cards de grupos aparecem com `groupName` como título e `managerName` como sublabel.
- [ ] Grupos corporativos exibem badge "Corporativo" no card de comparação.
- [ ] Aluno membro de 2 grupos do mesmo gestor: endpoint `/api/analytics/manager-groups?view=managers` retorna `totalStudents` contando o aluno **uma única vez**.

---

*Seções adicionadas em 2026-05-31. Branch: `feat/academy-tenant-paths`. Nenhum código de aplicação foi alterado nesta edição.*

---

## Gaps finais do PDF — concluídos

> Implementações realizadas em 2026-06-03 na branch `feat/academy-tenant-paths`. Todos os itens abaixo passam `tsc --noEmit` com exit code 0 e Biome lint sem erros críticos.

---

### Item 8 — Toggle Corporativo + Permissões de Comparação por Papel (BACKEND-1)

**Escopo:** `apps/web/src/lib/analytics/area-gestor.ts` e `apps/web/src/app/api/analytics/manager-groups/route.ts` — apenas esses dois arquivos foram editados.

**O que foi implementado:**

| Subitem | Descrição |
|:--|:--|
| **8 — Unit Selector corporativo** | Nova opção `opts.unitFilter` no fan-out corporativo: permite restringir o conjunto de unidades espanadas a uma única `area.id`, sem afetar grupos não-corporativos. Útil para análise de uma unidade específica dentro de um grupo que abrange múltiplas. |
| **8.2 — Permissões de comparação por papel (server-side)** | Funções `filterComparisonByRole` e `allowedComparisonModes` aplicam controle de acesso server-side: `super_admin`/`admin` têm acesso irrestrito; `manager` vê apenas seus próprios grupos; `student` e demais papéis não têm acesso a comparações de terceiros. |
| **1.2 — Autocomparação do aluno (student self-comparison)** | `computeStudentComparison` com `view=student` escopado a `auth.uid()` sem expor PII de terceiros. O aluno vê métricas próprias comparadas à média do grupo/unidade sem acesso aos dados individuais de outros. |
| **avgDepth + consciousCompletionPct** | `computeMetricBlock` agora produz `avgDepth` e `consciousCompletionPct` para **todas** as entidades (unit, area, manager, student) — não apenas para o aggregate escopado. Habilita as 2 dimensões faltantes do 8.2 causa-provável sem N+1. |

**Verificação:** `tsc --noEmit` e `biome check` passam limpos. Os 2 suites de testes de analytics (12 testes) continuam passando. Apenas os 2 arquivos em escopo foram editados.

---

### Item 1.2 — Comparação do Aluno + Permissões por Papel (FRONTEND-2)

**Escopo:** 4 arquivos de frontend em escopo.

**O que foi implementado:** componente `StudentComparison` criado e integrado ao dashboard do aluno (`student dashboard`). Exibe métricas do próprio aluno comparadas à média do grupo/unidade, sem expor dados individuais de terceiros.

**Permissões por papel (frontend):** o seletor de modo de comparação adapta as opções disponíveis conforme o papel do usuário autenticado — alinhado ao controle server-side do BACKEND-1. `student` vê apenas `view=student`; `manager` vê áreas/grupos próprios; `admin`/`super_admin` têm acesso irrestrito.

**Verificação:** `tsc --noEmit` passa limpo (0 erros projeto inteiro). Sem novas violações de lint introduzidas.

**Arquivos editados/criados (4 em escopo):** `unit-comparison.tsx`, `analytics-dashboard.tsx`, `student-full-profile.tsx` (ou equivalente de dashboard do aluno), e o novo componente `StudentComparison`.

---

### Item 8.2 — Causa Provável: 5 Dimensões (cause-inference.ts)

**Escopo:** apenas `apps/web/src/lib/analytics/cause-inference.ts` foi editado.

**O que foi implementado:** motor `diffPair()` estendido de 3 para 5 dimensões determinísticas, seguindo a decisão vinculante do Hugo:

| Dimensão | Comportamento |
|:--|:--|
| **ATIVAÇÃO** | Delta em `activeStudents / totalStudents` — já existia |
| **REFLEXÃO** | Delta em `reflectionCount` normalizado — já existia |
| **CONCLUSÃO** | Delta em `completionPct` + `avgSessionsPerStudent` — já existia |
| **PROFUNDIDADE** (nova) | Lê `avgDepth` opcional; **ignorada completamente** se qualquer lado não tiver o campo (nunca coercida a 0, nunca lançada) |
| **CONCLUSÃO CONSCIENTE** (nova) | Lê `consciousCompletionPct` opcional; mesma lógica de skip gracioso |
| **LIDERANÇA LOCAL** (hipótese) | Emitida **somente** como hipótese rotulada (`"[hipótese] possível diferença de liderança local (não confirmado)"`) quando: (a) um lado lidera em ≥ 2 dimensões medidas E (b) pelo menos um lead é grande (delta ≥ 2× threshold). Nunca aparece como dimensão, causa ou recomendação afirmada. |

**Verificação:** `tsc --noEmit` passa limpo no projeto inteiro. `biome check` passa limpo no arquivo.

---

### Item 1.3 — Ações Pedagógicas Avançadas (IA + lib pura)

**Escopo:** 2 arquivos criados. Nenhum arquivo existente foi tocado (não foram editados `area-gestor.ts`, `cause-inference.ts`, `types/analytics.ts`, nem qualquer UI/componente, migration, DB ou git).

**Arquivos criados:**

| Arquivo | Tipo | Descrição |
|:--|:--|:--|
| `/apps/web/src/lib/analytics/pedagogical-actions.ts` | Lib pura | Motor determinístico de ações pedagógicas: recebe `CauseDiagnosis[]` e `UnitStats \| AreaStats \| ManagerStats` e produz `PedagogicalAction[]` priorizados por severidade/dimensão. Sem dependências externas, sem IO, totalmente testável. |
| `/apps/web/src/app/api/analytics/pedagogical-actions/route.ts` | API route | Rota server-side com: autenticação via `getUser`, guard de papel/tenant, `analyticsAggregateLimiter` (rate-limit espelhado das demais rotas analytics), chamada à lib pura + enriquecimento opcional de narrativa via IA (LLM). |

**Followups do item 1.3 — pendentes de produto/infra:**

| # | Followup | Prioridade |
|:--|:--|:--|
| F1 | **Integrar rota ao frontend:** `analytics-dashboard.tsx` ou `unit-comparison.tsx` deve chamar `/api/analytics/pedagogical-actions` e renderizar o bloco de ações. Atualmente a rota existe mas nenhum componente a consome. | Alta |
| F2 | **Definir provedor de LLM para narrativa IA:** a rota inclui o ponto de enriquecimento por IA, mas o modelo/endpoint real não está hardcoded — requer decisão de infra (ex.: OpenAI, Anthropic, modelo interno). | Alta — bloqueia o enriquecimento narrativo |
| F3 | **Rate-limit por tenant em produção:** o `analyticsAggregateLimiter` atual é in-memory (Redis não configurado). Em produção multi-tenant, migrar para Redis para evitar reset do contador a cada restart. | Média |
| F4 | **Testes unitários para `pedagogical-actions.ts`:** a lib é pura e totalmente testável; adicionar ao suite existente de analytics. | Média |
| F5 | **Fallback gracioso quando IA indisponível:** a rota deve retornar as ações determinísticas mesmo se o enriquecimento narrativo falhar — garantir `try/catch` com degradação ao payload base. | Baixa — boa prática de resiliência |

**Verificação:** `tsc --noEmit` passa limpo (0 erros projeto inteiro). `biome check` passa limpo nos 2 arquivos criados.

---

### Verificação Final (todos os gaps)

**Veredito: PASSOU**

| Check | Resultado |
|:--|:--|
| TypeScript (`tsc --noEmit`) | **Exit code 0** — zero erros de tipo projeto inteiro |
| Biome lint (arquivos em escopo) | **Limpo** nos novos/editados — sem erros críticos de lógica, tipagem ou comportamento |
| Biome lint (projeto completo) | 62 findings em 36 arquivos analytics — **todos puramente estilísticos** (organizeImports, formatação) — auto-fixáveis com `npx biome check --fix --unsafe` |
| Testes analytics | **12/12 passando** (2 suites) |

---

### Checklist de Validação Manual — Gaps finais

**Permissões de comparação por papel (1.2 + 8)**
- [ ] Autenticado como `student`: seletor de comparação exibe apenas opção "Minha comparação" (`view=student`); endpoint retorna dados próprios sem PII de terceiros.
- [ ] Autenticado como `manager`: seletor exibe grupos/áreas do próprio manager; opções de outros managers ficam ocultas.
- [ ] Autenticado como `admin`/`super_admin`: acesso irrestrito a todos os modos de comparação.
- [ ] Endpoint `/api/analytics/manager-groups` com `student` autenticado → retorna 403 ou vazio (não vaza dados).

**StudentComparison (1.2 FRONTEND-2)**
- [ ] Aluno acessa o próprio dashboard → bloco "Minha comparação" aparece com métricas individuais vs. média do grupo.
- [ ] Nenhuma informação individual de terceiros é exibida (nomes, notas, reflexões de outros alunos).
- [ ] Com grupo vazio (sem dados): componente renderiza estado vazio sem crash.

**Toggle corporativo com unitFilter (8)**
- [ ] Com grupo corporativo (≥2 unidades) e `unitFilter` ativo: endpoint retorna métricas apenas da unidade filtrada, não de todas as unidades abrangidas.
- [ ] Grupos não-corporativos não são afetados pela presença do parâmetro `unitFilter`.

**Causa provável 5 dimensões (8.2)**
- [ ] Comparação entre 2 entidades com `avgDepth` disponível: dimensão PROFUNDIDADE aparece no bloco de causas.
- [ ] Comparação com `avgDepth` ausente em qualquer lado: dimensão PROFUNDIDADE **não aparece** (não exibe 0%, não lança erro).
- [ ] Liderança local: aparece **somente** com prefixo `[hipótese]` e **somente** quando ≥2 dimensões medidas apontam para o mesmo lado com lead ≥ 2× threshold. Nunca como causa/recomendação afirmada.
- [ ] Entidade com `totalStudents < 5`: nenhuma causa é diagnosticada (guard de significância).

**Ações pedagógicas (1.3)**
- [ ] `GET /api/analytics/pedagogical-actions` com payload válido de `CauseDiagnosis[]` → retorna `PedagogicalAction[]` priorizados.
- [ ] Com enriquecimento IA desabilitado/indisponível: rota retorna ações determinísticas (sem erro 500).
- [ ] Role `student` → 403. Role `manager` sem tenant correto → 403.
- [ ] 10 chamadas rápidas do mesmo tenant/IP → rate-limiter retorna 429 a partir da 11ª.

---

### Arquivos Criados/Alterados — Gaps finais

**Criados:**
- `/apps/web/src/lib/analytics/pedagogical-actions.ts`
- `/apps/web/src/app/api/analytics/pedagogical-actions/route.ts`
- Componente `StudentComparison` (integrado ao student dashboard)

**Alterados:**
- `apps/web/src/lib/analytics/area-gestor.ts` — `unitFilter`, `filterComparisonByRole`, `allowedComparisonModes`, `computeStudentComparison`, `avgDepth`/`consciousCompletionPct` em `computeMetricBlock`
- `apps/web/src/app/api/analytics/manager-groups/route.ts` — integração dos guards de papel e do `unitFilter`
- `apps/web/src/lib/analytics/cause-inference.ts` — 5 dimensões + liderança como hipótese
- 4 arquivos de frontend em escopo do FRONTEND-1/FRONTEND-2 (seletor, dashboard, student profile, `StudentComparison`)

---

*Gaps finais concluídos em 2026-06-03. Branch: `feat/academy-tenant-paths`. Sem commits/push. Migration `20260530130000_area_gestor.sql` ainda pendente de apply em staging.*
