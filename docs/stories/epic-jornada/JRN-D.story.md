# JRN-D — Seletor de curso na Jornada + Comparativo da home lendo a Jornada persistida

> **Status:** Concluído (2026-07-24) — PEDIDO 1a + 1b + 2 + back-button + **D10 (seletor sempre visível)** + **D11 (entrada sempre no hub)**, gates verdes.
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

### D8 — PEDIDO 1b: cirurgia completa (decisão do Capataz, "cirurgia completa agora")

O seletor de curso no card "Meu ritmo" escopa as 3 visões por curso. O desafio: o
comparativo (view 3) já era escopável via `courseId` da API, mas Visão detalhada/Gráficos
(views 1/2) exigem escopar o **sujeito** em `computeStudentComparison`, e
`buildStudentHomeIndicators` computa sujeito **e** referência da turma nos mesmos loops
por-aluno — e as `HomeSessionRow`/`HomeReflectionRow` do org-reference **não carregam
chapter_id/slide_id**. Solução SEGURA escolhida: **override em `computeStudentComparison`**.
`buildStudentHomeIndicators` roda como hoje (referência tenant-wide → **drill do gestor
byte-idêntico**, prova: os 40 testes area-gestor + 52 indicators + 13 da rota do gestor
seguem verdes); quando `courseId` presente, o sujeito é **recomputado** das PRÓPRIAS rows
do aluno (que `computeStudentComparison` já tem com `chapter_id`/`slide_id`):

- **Numeradores** reancorados: interações/reflexões/engajamento (rows do aluno filtradas
  pelos capítulos/slides do curso) e progresso/esperado (matrícula DAQUELE curso, via
  `computeBehindAndProgress`).
- **Denominadores** (interactionsMax/reflectionsMax), engagementMax e lastCompletedLabel já
  entram escopados (trilha filtrada ao curso).
- **Não escopados** (person-level, documentado): "Último acesso" e o ranking de engajamento
  — não têm recorte de curso computável a partir dos dados carregados; são sinais da pessoa.

Wiring: `computeStudentComparison(opts.courseId)` (default undefined = agregado); rotas
`manager-groups?view=student` e `plan-dashboard` aceitam `?courseId=` (self-view, filtro em
JS sobre rows do próprio aluno, nunca SQL); `page.tsx` (dashboard por-curso) passa o courseId
selecionado. UI: seletor `<select>` "Todos os cursos" + cursos no cabeçalho do card
(`StudentHomeCard`), só com 2+ cursos (Krug); `StudentComparison` guarda o `selectedCourseId`,
re-busca mantendo os dados atuais (o card/seletor não pisca para skeleton a cada troca), e
passa o courseId às 3 visões. Default (nenhuma interação) = "Todos os cursos" (null) =
comportamento original.

> **⚠ Integração — `student-dashboard.tsx` NÃO commitado por mim:** a fonte SSR do
> `courseOptions` (1 hunk de 1 linha, `data.courses.map(...)`) fica em
> `components/dashboard/student-dashboard.tsx`, arquivo que JÁ tem trabalho NÃO-commitado de
> OUTRO coder (refator SH-3.3 `heroContinueHref`/ordenação por recência) — e meu hunk até
> **depende** da variável `heroContinueHref` dele. Como não posso commitar o trabalho alheio
> (R3 do épico) nem separar meu hunk do dele (dependência), deixei minha 1 linha no
> **working tree** (funcional ao vivo via HMR) e FORA do meu commit. Quem commitar o estado
> do working tree na integração final (recomendação R3 do README) leva as duas juntas, e aí
> compila. Meus arquivos commitados têm defaults seguros (`courseOptions = []`), então o
> seletor só fica invisível até esse wiring ser commitado — nada quebra.

### D9 — Back button no construtor (Hugo, ao vivo 2026-07-24)

Achado do Hugo testando: o construtor ("Monte sua jornada") no create-flow (sem `dashboard`)
caía num `<span/>` vazio, sem volta — aluno preso. Fix (isolado em `journey-shell.tsx`): o
construtor SEMPRE tem back. Com **2+ cursos** → "‹ Minhas jornadas" (`setView('hub')`); com
**1 curso** (caso Rinaldo, sem hub e sem seletor — comportamento correto) → "‹ Meu ritmo"
(`router.push('/dashboard')`). Coberto por `journey-shell.test.tsx` (2 cenários).

### D10 — Seletor de curso SEMPRE visível (correção Hugo, ao vivo 2026-07-24)

Reversão da regra de ocultação Krug (`< 2 cursos`) que a D4/D8 aplicaram. O Hugo testou com
o Rinaldo (aluno de 1 matrícula), viu os **dois** painéis (dashboard `/jornada` E card "Meu
ritmo" da home) SEM seletor, e cravou: *"precisa ter o filtro/seletor de curso tanto no painel
de dashboard quanto no de fazer a trilha"*. É correção explícita: o controle deve ficar
**visível mesmo com 1 curso**.

**O que mudou (só VISIBILIDADE, zero mudança de lógica de dados):**

- **`/jornada` (construtor + dashboard):** `CourseSwitcher` some só com **0** cursos
  (`options.length < 1`, era `< 2`), e o guard do dashboard em `journey-shell.tsx` virou
  `courseOptions.length > 0` (era `> 1`). O construtor já montava o switcher sem condição
  (guard interno decide). **Leitura do caso 1-curso:** switcher de navegação (`?curso=`), sem
  opção "todos"; mostra o curso único já selecionado; como não há outro destino, o `onChange`
  nunca dispara (item já selecionado) → lê "você está no Curso X", sem navegação inútil,
  visualmente idêntico ao caso multi-curso.
- **Card "Meu ritmo" (home):** `student-home-card.tsx` virou `courseOptions.length > 0`
  (era `> 1`). **Leitura do caso 1-curso:** dropdown "Todos os cursos" + o curso único; o
  default continua "Todos os cursos" (`null`) = **agregado = dado byte-idêntico ao de hoje**
  (com 1 matrícula, agregado já é o próprio curso). Só o controle fica visível.
- **Sem regressão:** o back-button D9 (`courseOptions.length > 1` para escolher o label
  "Minhas jornadas" vs "Meu ritmo") é lógica separada e ficou **intocada**. O default de
  dados (curso líder/agregado quando nada selecionado) é o mesmo de sempre.
- **Testes ajustados:** `student-home-card.test.tsx` — o "NÃO aparece com 1 curso" virou
  "aparece com 1 curso" + novo "NÃO aparece sem curso nenhum (0 cursos)". Novo
  `course-switcher.test.tsx` (0/1/2 cursos + navegação). `journey-shell.test.tsx` ganhou
  "1 curso → o seletor TAMBÉM aparece".

---

### D11 — Entrada sempre no hub de seleção, mesmo com 1 curso (correção Hugo, ao vivo 2026-07-24)

Mesma linha de raciocínio do D10 (o Hugo, testando com o Rinaldo — aluno de 1
matrícula — quer o controle de curso sempre presente): *"quando clicar no botão 'montar
minha jornada'/'revisar', quero uma tela para selecionar o curso"*. Os pontos de entrada
(banner "Monte ou revise sua jornada" na home e CTA "Revisar jornada" do comparativo)
**pulavam DIRETO pro curso** quando o aluno tinha 1 matrícula só (atalho Krug do D1: "1
matrícula → abre direto; 2+ → hub"). O Hugo removeu esse atalho: entrar por esses CTAs
deve **sempre** mostrar o hub "Minhas jornadas" primeiro, mesmo com 1 curso. O aluno
clica no card do curso (mesmo sendo só 1) para então ir ao dashboard/construtor via
`?curso=`.

**O que mudou (2 atalhos removidos, navegação `?curso=` explícita intocada):**

- **`page.tsx` (roteador SSR):** `selectedCourseId` vem SOMENTE do param `?curso=`
  válido. Removido o `?? (enrollments.length === 1 ? enrollments[0].courseId : null)`.
  Sem param → `selectedCourseId = null` → sempre `JourneyShell initialView="hub"` (ou
  estado vazio com 0 matrículas), independente da contagem de matrículas.
- **`plan-comparison-panel.tsx` (card "Meu ritmo" da home):** os CTAs de entrada
  "Revisar jornada" e "Montar minha jornada" apontavam a `/jornada?curso=<journeyCourseId>`
  quando o curso era conhecido — o que pularia o hub. Agora `journeyHref = "/jornada"`
  (sem `?curso=`). O `journeyCourseId` deixou de ser usado no destructure (a API ainda o
  expõe, inócuo).
- **Banner `study-plan-invite-strip.tsx`:** já apontava para `/jornada` (sem curso) —
  **inalterado**, agora cai no hub por conta da mudança do `page.tsx`.
- **Navegação `?curso=` explícita preservada (sem regressão):** `CourseSwitcher`
  (`course-switcher.tsx`), a troca de curso no `journey-shell.tsx`, e o clique num card
  do hub (`journey-hub.tsx`) continuam navegando com `?curso=` → dashboard/construtor
  direto daquele curso, sem hub no meio. É a distinção do D1: hub = `/jornada`, curso
  específico = `/jornada?curso=`.

**Verificação com dado real (Rinaldo, 1 matrícula):** `rinaldo.capitelli@cory.com.br`
tem exatamente 1 matrícula (curso "Análise e Solução de Problemas", active/published, no
banco de produção `deploy/cory`). Clicar "Monte ou revise sua jornada" na home agora cai
no hub "Minhas jornadas" mostrando o card daquele curso, em vez de pular direto pro
construtor. Clicar o card leva a `/jornada?curso=4711c03e...` (dashboard/construtor
direto). Antes, com 1 matrícula, o `page.tsx` auto-rotava e o hub nunca aparecia.

**Testes ajustados:** `plan-comparison-panel.test.tsx` — os 2 casos que afirmavam
`/jornada?curso=course-x` nos CTAs de entrada ("Revisar jornada" e "Montar minha jornada"
com curso conhecido) passaram a afirmar `/jornada` (hub, sem `?curso=`). Sem novo teste de
`page.tsx` (não há suíte de página; a lógica de `selectedCourseId` é coberta pelo smoke
SSR + a asserção dos CTAs).

---

## Gates

- `npx tsc --noEmit` — ✅ verde.
- `npx vitest run` (escopos journey/jornada/analytics/api) — ✅ **551** testes (baseline 510 +
  41 novos: 6 motor de jornada + 1 estado-convite + 4 escopo-por-curso do sujeito + 3 seletor
  do card + 3 back-button), **sem regressão** (40 area-gestor + 52 indicators + 13 rota do
  gestor verdes → drill do gestor byte-idêntico).
- `biome check` (arquivos tocados) — ✅ verde (1 warning a11y pré-existente em
  `student-dashboard.tsx:354`, fora do meu hunk; biome exit 0).
- Smoke `/jornada`, `/jornada?curso=`, `/dashboard` — 307 (redirect de auth), **sem 500**.
- **Pré-existente, fora do slice:** `manager-dashboard`/`manager-course-dashboard` (2 testes,
  greeting "Olá, Carlos!") falham por churn de outro coder (`student-dashboard`); não importam
  nenhum arquivo deste slice — confirmado por grep.

## Arquivos tocados (deste slice)

- `apps/web/src/app/(platform)/jornada/page.tsx` — roteamento por-curso via searchParams. **D11:** removido o atalho "1 matrícula → abre direto"; sem `?curso=` sempre mostra o hub.
- **D11:** `apps/web/src/components/analytics/plan-comparison-panel.tsx` — CTAs de entrada ("Revisar jornada" / "Montar minha jornada") apontam para `/jornada` (hub, sem `?curso=`).
- `apps/web/src/app/(platform)/jornada/_components/course-switcher.tsx` — **novo** seletor.
- `apps/web/src/app/(platform)/jornada/_components/hub/journey-shell.tsx` — props + switcher + nav.
- `apps/web/src/app/(platform)/jornada/_components/hub/journey-hub.tsx` — abre qualquer curso.
- `apps/web/src/lib/journey/journey-plan-data.ts` — courseId + `fetchActiveJourneyEnrollmentIds`.
- `apps/web/src/lib/analytics/plan-dashboard-data.ts` — `fetchLeadingEnrollmentContext(courseId)` + `PlanComparisonResponse.hasJourney/journeyCourseId`.
- `apps/web/src/lib/analytics/study-plan-dashboard.ts` — `computeJourneyCumulativeExpected`.
- `apps/web/src/app/api/analytics/plan-dashboard/route.ts` — courseId + jornada persistida.
- `apps/web/src/components/analytics/plan-comparison-panel.tsx` — terminologia jornada + estado-convite.
- `apps/web/src/components/analytics/student-home-card.tsx` — label do 3º toggle + seletor de curso.
- **1b:** `apps/web/src/lib/analytics/area-gestor.ts` — `computeStudentComparison(opts.courseId)` + override do sujeito.
- **1b:** `apps/web/src/app/api/analytics/manager-groups/route.ts` — `?courseId=` no self-view.
- **1b:** `apps/web/src/components/analytics/student-comparison.tsx` — seletor + re-fetch por curso.
- **1b (working tree, NÃO commitado):** `apps/web/src/components/dashboard/student-dashboard.tsx` — SSR do `courseOptions` (ver ⚠ acima).
- Testes: study-plan-dashboard, plan-comparison-panel, student-home-card (+ seletor), area-gestor (+ escopo por curso), journey-shell (novo, back-button).

---

## JRN-D+ — Genjutsu Coreografia no hub "Minhas jornadas" (2026-07-24)

> **Pedido do Hugo (via Capataz):** "bota um dev para melhorar o visual disso, aproveite e manda ele usar o /genjutsu-cast para dar uma vida para a página." O hub estava visualmente pobre: um card magro boiando num vazio vasto (`max-w-4xl`), sem hierarquia, barra de progresso estática.

**Método:** skill `/genjutsu-cast` (SCAN → THESIS validada pelo Capataz → LOAD motion-principles + css-native + desktop-principles → IMPLEMENT → AUDIT). Stack: Next 15.3 / React 19 / Tailwind v4, **zero lib de animação** → motion nativo. Converge ao dialeto **Coreografia** já validado (tokens `--mo-*` de `theme.css`, primitivas de `dashboard/motion.module.css`), sem inventar dialeto novo.

**Tese (aprovada):** o hub passa a falar o mesmo dialeto Coreografia — coluna contida e centrada (fim do card magro no vazio), cabeçalho presente (eyebrow + título maior + subtítulo com contagem real), cards mais altos e táteis com medalhão maior e textura de fundo sutil por status, entrada orquestrada header→subtítulo→cards em stagger (janela ≤450ms), barra preenchendo do zero na carga via CSS puro, hover Apple-like (lift 2px + sombra + nudge da seta), só transform/opacity, `prefers-reduced-motion` desliga tudo. Calmo, comunicando hierarquia, nunca espetáculo.

**O que mudou:**
- **Layout/hierarquia** (`journey-hub.tsx`): container `max-w-4xl` → `max-w-2xl` (coluna contida, resolve o vazio com 1 e com N cards); cabeçalho ganha eyebrow "Meu aprendizado" + título `text-3xl/4xl` + subtítulo com contagem real de jornadas; card de `p-5`→`p-6`, medalhão `h-12`→`h-14` com `ring`, título `text-base`→`text-lg`, barra `h-2`→`h-2.5`; textura de fundo decorativa (radial estático por status, `opacity 0.07`, `aria-hidden`, não anima) preenche o card sem inventar dado; rodapé honesto (combinado × realizado) fecha a página.
- **Vida/motion** (`journey-hub.tsx` + `dashboard/motion.module.css`): entrada orquestrada com delays escalonados (header 0 → subtítulo 70 → cards 130 + 55ms cada, índice de stagger travado em 5, último ≤405ms); **barra preenche do zero na carga via `@starting-style` no `.barFill`** (scaleX 0→valor, transição `--mo-slow`, CSS puro — sem rAF nem JS; degrada honesto sem suporte; reduced-motion = instantâneo); hover mantém o `.lift` (translateY 2px + sombra) já validado.
- **Decisões sênior:** (1) coluna contida em vez de grid 2-col — cura direta do "boiando", cresce como lista; (2) **SKIP tilt/parallax** — doutrina desktop ("stared at for hours") + "nunca espetáculo" reprovam pointer-tilt em hub de uso diário; lift+sombra+seta bastam; (3) nada de dado falso — textura e rodapé são estáticos/honestos.
- **Fix de navegação (Hugo 2026-07-24, print):** o hub era o topo do `/jornada` **sem volta** — o aluno ficava preso. Adicionado back "‹ Meu ritmo" no topo do hub (mesmo padrão do construtor) → `router.push("/dashboard")`, via prop `onBack` no shell. +1 teste (`journey-shell.test.tsx`).

**Arquivos tocados (deste slice, território C):**
- `apps/web/src/app/(platform)/jornada/_components/hub/journey-hub.tsx` — layout contido, cabeçalho presente, cards táteis, orquestração de entrada, **back "Meu ritmo"**.
- `apps/web/src/app/(platform)/jornada/_components/dashboard/motion.module.css` — `@starting-style` no `.barFill` (preenchimento na carga).
- `apps/web/src/app/(platform)/jornada/_components/hub/journey-shell.tsx` — liga `onBack` do hub → `/dashboard`.
- `apps/web/src/app/(platform)/jornada/_components/hub/__tests__/journey-shell.test.tsx` — +1 teste do back do hub.

**Gates:** `tsc --noEmit` ✅ (exit 0) · `vitest run "src/app/(platform)/jornada"` ✅ **24/24** (23 baseline + 1 novo back do hub, sem regressão) · `biome check` (arquivos tocados) ✅ limpo · smoke dev `:3002` `/jornada` → **200**, zero 500.

**AUDIT genjutsu-cast (web):** reduced-motion respeitado ✅ · só transform/opacity ✅ · foco visível (native `<button>`, sem `outline:none`) ✅ · estados completos (hover/active/focus) ✅ · `aria-hidden` na textura e ícones decorativos ✅ · tokens da casa (cerrado/success/`--mo-*`) ✅.
