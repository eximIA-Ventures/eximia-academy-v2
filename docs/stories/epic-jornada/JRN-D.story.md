# JRN-D — Seletor de curso na Jornada + Comparativo da home lendo a Jornada persistida

> **Status:** Em progresso (2026-07-24)
> **Épico:** EPIC-JORNADA ([README](README.md), [contrato](contrato.md))
> **Branch:** `deploy/cory` (working tree com trabalho de outros coders não commitado)
> **Origem:** Hugo testou o produto real e pediu 2 evoluções ("pensa como fazer isso aí pra gente").
> **Autor:** Coder "Seletor" (Opus) · revisor pareado: Orquestrador (Capataz)

---

## Contexto

O épico JORNADA já está entregue e funcional (`/jornada` com persistência real em
`study_plans`, migration aplicada). Hoje ambas as superfícies (a rota `/jornada` e o card
"Meu ritmo" da home) assumem a **matrícula líder** (maior progresso), sem escolha de curso.
E o 3º toggle do card "Meu ritmo" ("Comparativo com o Plano") deriva o "combinado" do ritmo
semanal client-state (`DEFAULT_STUDY_PLAN_CHOICE`), não da jornada que o aluno montou.

## Pedidos

- **PEDIDO 1a — Seletor de curso em `/jornada`.** Clicar num curso do hub abre o
  construtor/dashboard **daquele** curso; seletor no topo para trocar sem voltar ao hub.
- **PEDIDO 1b — Seletor de curso no card "Meu ritmo" (home).** Define qual matrícula alimenta
  as 3 visões (Visão detalhada / Gráficos / Comparativo). Default = líder.
- **PEDIDO 2 — Ligar o comparativo da home à Jornada persistida.** "não é mais plano, é minha
  jornada": o "combinado" passa a vir de `plan.moduleDurations`, terminologia 100% jornada,
  estado-convite honesto quando não há jornada.

---

## Decisões de design

### D1 — Rota por-curso: **query param `?curso=<courseId>`** (não segmento `/jornada/[courseId]`)

Idiomático no App Router via `searchParams` no server component, e **muito menos churn** que
reestruturar a rota num segmento dinâmico (que exigiria mover `page.tsx`, duplicar o estado
vazio e re-plumbar o hub como index). O hub "Minhas jornadas" continua sendo `/jornada` (sem
param); clicar num card navega para `/jornada?curso=<courseId>`. Sem param: **1 matrícula →
abre direto naquele curso** (Krug, sem escolha a fazer); **2+ → hub**.

### D2 — `fetchLeadingEnrollmentContext` / `fetchJourneyState` / `fetchJourneyCourseContext` ganham `courseId?` opcional

Aditivo e retrocompatível (param no fim; ausente → comportamento líder byte-idêntico). Quando
presente, ancora contexto + deadline + jornada **naquele** curso. Nova
`fetchActiveJourneyEnrollmentIds` traz o conjunto de matrículas com jornada ativa, para o hub
marcar **cada** card corretamente mesmo com jornadas em múltiplos cursos (a query single-plan
só traz uma). Todos com fallback gracioso (tabela ausente → degrada, nunca quebra).

### D3 — Hub abre **qualquer** curso (bug corrigido)

Antes, só o card "ativo" abria; os demais davam um toast de workaround ("comece pela sua
jornada ativa"). Esse era exatamente o atrito que o Hugo bateu. Agora todo card navega para o
seu `?curso=`, e o roteador SSR decide o destino (dashboard se há jornada, construtor se não).

### D4 — `CourseSwitcher` `<select>` nativo, discreto, no topo do construtor E do dashboard

`<select>` nativo por robustez/acessibilidade (teclado + leitor de tela de graça), estilizado
com tokens do tema. Aparece **só com 2+ cursos** (Krug). Troca de curso = `router.push` para
`?curso=` (SSR reancorra tudo). Renderizado no shell (não dentro do `JourneyDashboard`), para
não editar o layout interno daquele componente.

### D5 — Comparativo (PEDIDO 2): novo motor puro `computeJourneyCumulativeExpected`

Reancorra o "combinado" cumulativo na **jornada persistida** (`plan.moduleDurations` + metas
dos módulos + `startDate`), não no ritmo semanal default. Cada módulo contribui com crédito
**proporcional** à fração decorrida da sua janela na timeline (1 interação/módulo + N
reflexões reais). **Reusa** o tipo `CumulativeExpected` (o `buildPlanRows` do painel consome o
mesmo shape sem mudar) — é sibling de `computeCumulativeExpected` (semanal), nenhuma
reimplementa a outra. Pura, `nowMs` por parâmetro, com vitest (dia 0, fim de módulo, além do
fim, crédito parcial, degradação, monotonicidade).

### D6 — Terminologia 100% jornada na região da home

- 3º toggle: "Comparativo com o **Plano**" → "Comparativo com a **Jornada**".
- Coluna da tabela: "Meu plano" → "**Minha jornada**" (desktop + mini-header mobile).
- "Meu plano da semana" → "**Minha semana na jornada**".
- "Recalcular plano" (→ `/meu-plano`) → "**Revisar jornada**" (→ `/jornada?curso=`).
- Estado-convite honesto quando **não há jornada persistida**: "Você ainda não montou sua
  jornada" + CTA "Montar minha jornada" → `/jornada?curso=` (nunca um número fake).
- Banner de entrada (`study-plan-invite-strip`) já estava 100% jornada — inalterado.

> Escopo deliberado: "Meu plano da semana"/"Montar meu plano" do **dashboard** (`weekly-plan-card`)
> é outro componente, fora da "região da home" citada; não tocado (evita regressão + scope creep).

### D7 — API `/api/analytics/plan-dashboard` ganha `?courseId=` + expõe `hasJourney`/`journeyCourseId`

Self-view (student id sempre = auth.uid()). Lê a jornada persistida e, quando existe, substitui
`cumulativeExpected` pelo valor reancorado em `moduleDurations`. `hasJourney:false` → o painel
mostra o estado-convite. `courseId` opcional já preparado para o seletor da home (PEDIDO 1b).

---

## O que mudou por superfície

**`/jornada` (PEDIDO 1a):** `page.tsx` lê `searchParams.curso`, resolve o curso selecionado
(param válido → auto se 1 matrícula → hub se 2+), ancora todos os motores no courseId. Hub
navega por-curso. `CourseSwitcher` no topo do construtor e do dashboard. Data layer por-curso
com fallback gracioso.

**Card "Meu ritmo" (home) — PEDIDO 2:** 3º toggle relê a **jornada persistida** (combinado de
`moduleDurations`), terminologia 100% jornada, estado-convite honesto. O `PlanComparisonPanel`
já aceita `courseId` (default = líder) para plugar o seletor da home (PEDIDO 1b).

---

## PEDIDO 1b — status e trade-off (aberto ao Capataz)

O seletor de curso no card "Meu ritmo" precisa que `computeStudentComparison`/
`buildStudentHomeIndicators` escopem o **sujeito** por curso (Visão detalhada / Gráficos),
além do comparativo (já pronto via `courseId` da API). Porém `buildStudentHomeIndicators`
computa sujeito **e** referência da turma nos **mesmos loops por-aluno**, e as linhas de
reflexão do org-reference **não carregam chapter_id** — escopar só o sujeito exige reescrever
também as queries tenant-wide da referência. Isso é cirurgia no núcleo de analytics que
alimenta a **visão do gestor** (drill de aluno), que o próprio pedido manda **NÃO regredir**,
com blast radius em 92 testes (area-gestor 40 + student-home-indicators 52) + a rota do gestor.

**Recomendação:** decidir a profundidade de 1b com o Capataz antes da cirurgia (o comparativo
por-curso, que é o coração do pedido do Hugo, já está entregue via PEDIDO 2 + `courseId` da API).

---

## Gates

- `npx tsc --noEmit` — ✅ verde.
- `npx vitest run` (escopos journey/jornada/analytics) — ✅ **517** testes (baseline 510 + 7
  novos: 6 do motor de jornada + 1 de estado-convite do painel), sem regressão.
- `biome check` (arquivos tocados) — ✅ verde.
- Smoke `/jornada`, `/jornada?curso=`, `/dashboard` — 307 (redirect de auth), **sem 500**.
- **Pré-existente, fora do slice:** `manager-dashboard`/`manager-course-dashboard` (2 testes,
  greeting "Olá, Carlos!") falham por churn de outro coder (`student-dashboard`); não importam
  nenhum arquivo deste slice — confirmado por grep.

## Arquivos tocados (deste slice)

- `apps/web/src/app/(platform)/jornada/page.tsx` — roteamento por-curso via searchParams.
- `apps/web/src/app/(platform)/jornada/_components/course-switcher.tsx` — **novo** seletor.
- `apps/web/src/app/(platform)/jornada/_components/hub/journey-shell.tsx` — props + switcher + nav.
- `apps/web/src/app/(platform)/jornada/_components/hub/journey-hub.tsx` — abre qualquer curso.
- `apps/web/src/lib/journey/journey-plan-data.ts` — courseId + `fetchActiveJourneyEnrollmentIds`.
- `apps/web/src/lib/analytics/plan-dashboard-data.ts` — `fetchLeadingEnrollmentContext(courseId)` + `PlanComparisonResponse.hasJourney/journeyCourseId`.
- `apps/web/src/lib/analytics/study-plan-dashboard.ts` — `computeJourneyCumulativeExpected`.
- `apps/web/src/app/api/analytics/plan-dashboard/route.ts` — courseId + jornada persistida.
- `apps/web/src/components/analytics/plan-comparison-panel.tsx` — terminologia jornada + estado-convite.
- `apps/web/src/components/analytics/student-home-card.tsx` — label do 3º toggle.
- 3 arquivos de teste (study-plan-dashboard, plan-comparison-panel, student-home-card).
