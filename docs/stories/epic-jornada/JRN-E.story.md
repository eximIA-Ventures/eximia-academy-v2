# JRN-E — Montar e revisar a jornada no MEIO do curso (jornada consciente do progresso)

> **Status:** Draft (2026-07-25) — pronta para validação do @po e execução em 3 trilhas paralelas.
> **Épico:** EPIC-JORNADA ([README](README.md), [contrato](contrato.md))
> **Contrato desta story:** [contrato-progresso.md](contrato-progresso.md)
> **Branch:** `deploy/cory` (working tree com trabalho de outras frentes não commitado — ver R6)
> **Origem:** Hugo, dono do produto, 2026-07-25: *"o que falta agora é uma lógica/sistema de montar
> o plano já no meio do curso. Vamos lançar a feature agora, mas o pessoal já está fazendo o curso
> há algum tempo, então quando forem fazer o planejamento da jornada tem que levar em consideração
> o progresso que já foi feito. A mesma lógica se aplica ao revisar jornada."*
> **Depende de:** tarefa em voo da **âncora de COORTE** em `apps/web/src/app/(platform)/jornada/actions.ts`
> (fora do escopo desta story — ver §Pré-requisitos).

---

## 1. Contexto e problema

A Jornada foi desenhada para o aluno **recém-inscrito**: ele abre o construtor, distribui dias
pelos módulos e começa. O lançamento, porém, cai sobre uma base que **já está no meio do curso**.
Hoje, esse aluno monta uma jornada que ignora tudo o que ele já fez.

### 1.1 As três provas no código

| # | Prova | `arquivo:linha` |
|:--|:---|:---|
| P1 | A partida do construtor distribui a janela **cheia** sobre **todos** os módulos, inclusive os concluídos: `neutralDurations(modules.length, finalDeadlineDays)` | `apps/web/src/app/(platform)/jornada/_components/builder/journey-builder.tsx:48-50` |
| P2 | O progresso **já está no mesmo request** e é descartado: `fetchPlanDashboardData` alimenta só o dashboard; o construtor recebe `builderContext={context}` sem nada de progresso | `apps/web/src/app/(platform)/jornada/page.tsx:141-146` vs `:190` |
| P3 | `JourneyCourseContext` carrega módulos e prazos, e **zero** estado de conclusão | `apps/web/src/lib/journey/types.ts:62-72` |

E o "Voltar ao ponto de partida" (`journey-builder.tsx:89`) chama a mesma `neutralDurations`, ou
seja, **desfaz** qualquer consciência de progresso que o aluno tivesse ajustado à mão.

### 1.2 A evidência do aluno real (por que "prefixo" não resolve)

Matrícula `77f43ca0-0180-421b-ab08-b2c5febd0b14`, ~50% de progresso, apurado em 2026-07-25:

| Módulo | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|:---|:--|:--|:--|:--|:--|:--|:--|:--|
| Estado real | concluído | concluído | concluído | **intocado** | concluído | em andamento | não iniciado | não iniciado |

**O progresso NÃO é um prefixo.** Há um buraco no meio. Qualquer desenho que assuma "o aluno fez
os N primeiros" produz uma jornada errada para este aluno, que é o aluno típico do lançamento.

Pior: o módulo 3 tem **4 de 4 reflexões feitas e 0 interações**, e hoje aparece como "não
iniciado", porque o estado vem de `computeModuleJourney`
(`apps/web/src/lib/analytics/study-plan-dashboard.ts:60`), cujo `status` sai de sessões concluídas
(predicado em `apps/web/src/lib/analytics/plan-dashboard-data.ts:228-234`). O aluno vai olhar a
timeline e não vai reconhecer o próprio esforço.

### 1.3 O dashboard credita à jornada o que veio de antes

`diagnostic.progressNow` (`apps/web/src/lib/analytics/study-plan-projection.ts:47`) e
`diagnostic.sessionsDoneCount` (`:56-59`, documentado no próprio código como *lifetime count*)
contam desde a **matrícula**. O dashboard os usa direto:

- `progressPct = diagnostic.progressNow` — `dashboard-model.ts:151`
- `isDayZero = !isCompleted && sessionsDone <= 0 && progressPct <= 0` — `dashboard-model.ts:157`
- `donePerWeek = doneItems / semanas desde plan.startDate` — `dashboard-model.ts:389-391`

Para o aluno de 50% que montar a jornada hoje, isso significa: nunca existe dia 0, o anel abre
cheio de mérito que a jornada não produziu, e o ritmo aparece inflado (todo o trabalho lifetime
dividido por ~0 semanas de jornada).

### 1.4 O array posicional é uma bomba-relógio de custo zero HOJE

`study_plans.module_durations` é um array posicional puro, índice ↔ i-ésimo capítulo publicado por
`order` (`packages/database/src/schema/study-plans.ts:37`; comentário explícito na migration
`supabase/migrations/20260723000000_jornada_study_plans.sql:54`). Publicar, despublicar ou
reordenar um capítulo **desliza silenciosamente** todas as durações salvas.

**`study_plans` tem 0 linhas em produção** (apurado por consulta direta, 2026-07-25). Mudar a forma
é gratuito agora e caro depois do lançamento.

---

## 2. Story

**Como aluno que já está há semanas no curso**, quero montar minha jornada a partir de onde
realmente estou — com o que já concluí reconhecido e travado, e o tempo que resta distribuído só
sobre o que falta —, **e quero que revisar minha jornada** respeite o que concluí desde que a
montei, sem nunca empurrar o prazo final.

---

## 3. Decisões DADAS (não reabrir)

| # | Decisão | Quem decidiu |
|:--|:---|:---|
| D1 | **Âncora de COORTE**: o teto duro é `matrícula + deadline_days`, imune ao momento do clique. **A correção vive em outra tarefa, em voo, em `actions.ts`. Esta story depende dela e NÃO a inclui.** | Hugo, 2026-07-25 |
| D2 | A linha do tempo do que resta **começa hoje**. Módulo já concluído **não consome dia futuro**. | Hugo + apuração de arquitetura, 2026-07-25 |
| D3 | Baseline do "combinado × realizado" é o **delta desde a montagem da jornada**. O progresso anterior é exibido **à parte**, como "ponto de partida", nunca somado ao mérito do plano. | Hugo + apuração, 2026-07-25 |
| D4 | Módulo **parcialmente** feito recebe duração sugerida **proporcional ao que resta**, e continua **editável**. | Hugo + apuração, 2026-07-25 |
| D5 | Em "Revisar jornada": o que foi concluído entre a montagem e a revisão **trava**; só o restante é redistribuído; **o teto duro nunca se move**. | Hugo + apuração, 2026-07-25 |
| D6 | Durações passam a ser **ancoradas por `chapter_id`**, aproveitando a janela de 0 linhas. | Hugo + apuração, 2026-07-25 |

---

## 4. Pré-requisitos e fronteiras

**Pré-requisito bloqueante (temporal, não de escopo):** a tarefa em voo da âncora de coorte edita
`apps/web/src/app/(platform)/jornada/actions.ts` (hoje, `saveJourneyPlan` fixa
`startDate = new Date()` na confirmação, `actions.ts:199-200`, e deriva os snapshots de prazo a
partir dele em `buildWritePayload`, `:171-174`). A Trilha E1 **também** precisa editar esse arquivo
(Ato 2). Ordem obrigatória: **âncora de coorte pousa → E1 Ato 2 começa.** O Ato 1 de E1
(`types.ts`, `plan-math.ts`, `module-progress.ts`) não toca `actions.ts` e pode começar
imediatamente.

**Fora de escopo, deliberadamente:**
- A correção da âncora de coorte em si (D1).
- Mudar `interactionsExpected` de 1 para 5 (ver Q1).
- Reancorar o comparativo da home (`computeJourneyCumulativeExpected`,
  `apps/web/src/lib/analytics/study-plan-dashboard.ts:204`) no progresso (ver Q2).
- Aplicar qualquer migration (escrita, nunca aplicada — herda R1 do épico).

---

## 5. As 3 trilhas paralelas — territórios DISJUNTOS

Mesma regra de ouro do épico (README §2): **cada arquivo tem UM dono.** A ownership histórica é
respeitada — `timeline-engine.ts` continua da trilha do construtor (era B), `plan-math.ts` /
`types.ts` / `journey-plan-data.ts` continuam da trilha de dados (era A). Um recorte ingênuo
"`lib/journey/**` inteiro = uma trilha" **colidiria** com essa ownership; por isso o corte abaixo
é por arquivo, não por pasta.

### TRILHA E1 — Motor de progresso, contrato e persistência

| Arquivo | Ação |
|:---|:---|
| `apps/web/src/lib/journey/types.ts` | EDITA (aditivo — o contrato) |
| `apps/web/src/lib/journey/plan-math.ts` | EDITA (aditivo — janela restante) |
| `apps/web/src/lib/journey/journey-plan-data.ts` | EDITA (progresso no contexto) |
| `apps/web/src/lib/journey/module-progress.ts` | **NOVO** |
| `apps/web/src/lib/journey/__tests__/plan-math.test.ts` | EDITA |
| `apps/web/src/lib/journey/__tests__/module-progress.test.ts` | **NOVO** |
| `apps/web/src/app/(platform)/jornada/actions.ts` | EDITA (**Ato 2**, após a âncora de coorte) |
| `apps/web/src/lib/analytics/study-plan-dashboard.ts` | EDITA (só extrair helper puro do predicado — ver AC-E1.6) |
| `apps/web/src/lib/analytics/plan-dashboard-data.ts` | EDITA (só passar a chamar o helper extraído) |
| `packages/database/src/schema/study-plans.ts` | EDITA (comentário + tipo de `module_durations`) |
| `supabase/migrations/20260726000000_jornada_progresso.sql` | **NOVO** (escrita, **NÃO aplicada**) |

### TRILHA E2 — Construtor consciente do progresso

| Arquivo | Ação |
|:---|:---|
| `apps/web/src/lib/journey/timeline-engine.ts` | EDITA (cascata/drag pulam frozen) |
| `apps/web/src/lib/journey/__tests__/timeline-engine.test.ts` | EDITA |
| `apps/web/src/app/(platform)/jornada/_components/builder/journey-builder.tsx` | EDITA |
| `apps/web/src/app/(platform)/jornada/_components/builder/timeline-canvas.tsx` | EDITA |
| `apps/web/src/app/(platform)/jornada/_components/builder/module-table.tsx` | EDITA |
| `apps/web/src/app/(platform)/jornada/_components/builder/builder-controls.tsx` | EDITA |
| `apps/web/src/app/(platform)/jornada/_components/builder/consequence-banner.tsx` | EDITA |
| `apps/web/src/app/(platform)/jornada/_components/builder/journey-format.ts` | EDITA |
| `apps/web/src/app/(platform)/jornada/_components/builder/journey.module.css` | EDITA |
| `apps/web/src/app/(platform)/jornada/_components/builder/icons.tsx` | EDITA |
| `apps/web/src/app/(platform)/jornada/_components/builder/__tests__/render.test.tsx` | EDITA |
| `apps/web/src/app/(platform)/jornada/_components/review/journey-review.tsx` | EDITA |

### TRILHA E3 — Baseline do dashboard

| Arquivo | Ação |
|:---|:---|
| `apps/web/src/app/(platform)/jornada/_components/dashboard/dashboard-model.ts` | EDITA |
| `apps/web/src/app/(platform)/jornada/_components/dashboard/journey-dashboard.tsx` | EDITA |
| `apps/web/src/app/(platform)/jornada/_components/dashboard/motion.module.css` | EDITA (se preciso) |
| `apps/web/src/app/(platform)/jornada/_components/dashboard/__tests__/dashboard-model.test.ts` | EDITA |

### Prova de disjunção

- **E1 ∩ E2 = ∅** — E1 pega 4 arquivos de `lib/journey/` (`types.ts`, `plan-math.ts`,
  `journey-plan-data.ts`, `module-progress.ts` + seus 2 testes); E2 pega exatamente os 2 restantes
  (`timeline-engine.ts` + seu teste). Nenhum arquivo em comum. Nenhum arquivo de `_components/` em E1.
- **E1 ∩ E3 = ∅** — E3 só toca `_components/dashboard/`; E1 não toca `_components/` algum.
- **E2 ∩ E3 = ∅** — `_components/builder/` + `_components/review/` (E2) vs `_components/dashboard/` (E3).
- **Não-território (NINGUÉM edita):** `page.tsx`, `_components/hub/**` (inclui `journey-shell.tsx`),
  `_components/course-switcher.tsx`, `apps/web/src/app/api/analytics/plan-dashboard/route.ts`,
  `study-plan-projection.ts`. A prova de que sobrevivem intactos está no
  [contrato-progresso.md §10](contrato-progresso.md).

> **Nota honesta sobre E1 e `lib/analytics/`.** E1 entra em dois arquivos de `analytics` **apenas**
> para extrair o predicado de conclusão (`plan-dashboard-data.ts:228-234`) num helper puro
> exportado, evitando reimplementá-lo. Esses arquivos servem também `/meu-plano` e a API — daí o
> AC-E1.6 exigir a suíte `lib/analytics/__tests__/` verde e byte-idêntica em comportamento. Se o
> executor de E1 concluir que a extração não vale o risco, a alternativa aceita é **consumir
> `PlanDashboardData.moduleJourney` já pronto** e não tocar em `analytics/` — decisão dele,
> registrada no Change Log.

---

## 6. Acceptance Criteria

Cada AC é verificável por teste automatizado ou por observação determinística na UI. Nenhum diz
"deve ficar bom".

### Trilha E1 — motor, contrato e persistência

- **AC-E1.1 — Progresso chega ao contexto.** `fetchJourneyCourseContext`
  (`apps/web/src/lib/journey/journey-plan-data.ts:68`) devolve todo
  `JourneyCourseContext.modules[i].progress` populado, com `status` vindo de `computeModuleJourney`
  (`study-plan-dashboard.ts:60`), **nunca** de uma regra nova. *Verificação:* teste que, dado o
  padrão do aluno real (0,1,2,4 done · 5 doing · 3,6,7 planned), o contexto reproduz exatamente
  esse vetor de `status`.
- **AC-E1.2 — Janela restante correta.** `computeRemainingWindow` devolve
  `remainingDays = max(0, cohortDeadlineDate − hoje)`, `frozenIndices` = índices com
  `progress.frozen`, `remainingIndices` = complemento. *Verificação:* teste com `frozenIndices =
  [0,1,2,4]` (não-prefixo) e `remainingIndices = [3,5,6,7]`.
- **AC-E1.3 — Partida consciente do progresso.** `progressAwareNeutralDurations` devolve `0` exato
  para todo índice frozen, `≥ MIN_DAYS_PER_MODULE` (`plan-math.ts:8`) para todo índice vivo, e
  `soma(vivos) ≤ remainingDays`. *Verificação:* teste com o vetor do aluno real; assertar
  `durations[0]===0 && durations[4]===0 && durations[3]>=4 && sum===remainingDays`.
- **AC-E1.4 — Proporcional no parcial (D4).** Módulo com `0 < completedRatio < 1` recebe
  `round(fatia × (1 − completedRatio))`, piso `MIN_DAYS_PER_MODULE`. *Verificação:* teste com
  `completedRatio = 0.5` → duração ≈ metade da fatia de um módulo intocado equivalente.
- **AC-E1.5 — Durações ancoradas por capítulo (D6).** `module_durations` passa a ser gravada como
  `JourneyModuleDuration[]`. `alignDurationsToChapters` mantém as durações corretas quando um
  capítulo é despublicado (entradas restantes **não deslizam**) e atribui `MIN_DAYS_PER_MODULE` a
  um capítulo publicado depois. *Verificação:* 3 testes puros — remover o do meio, adicionar no
  fim, reordenar.
- **AC-E1.6 — Zero reimplementação (Artigo IV).** Não existe no diff de E1 nenhuma derivação
  própria de `done|doing|planned`, nem cópia de `fitToDeadline`/`MIN_DAYS_PER_MODULE`.
  *Verificação:* `grep -n "completed" apps/web/src/lib/journey/module-progress.ts` não retorna
  nenhum predicado de status; e `pnpm --filter web test -- lib/analytics` continua verde.
- **AC-E1.7 — Escrita valida com a régua nova.** `buildWritePayload` (`actions.ts:142`) passa a
  usar `normalizeRemainingDurations`, grava `recalculated_at = planningAnchorDate` e, na **primeira**
  confirmação, grava o `baseline`. Revisões posteriores **não** sobrescrevem o baseline.
  *Verificação:* teste da fronteira de escrita — 1ª chamada grava baseline; 2ª preserva o
  `capturedAt` original.
- **AC-E1.8 — Migration escrita, não aplicada.** Existe
  `supabase/migrations/20260726000000_jornada_progresso.sql` e **nenhum** comando `supabase db push`
  foi executado. *Verificação:* o arquivo existe; `git status supabase/` mostra só o arquivo novo.

### Trilha E2 — construtor

- **AC-E2.1 — Concluído não é arrastável.** Módulo com `progress.frozen` aparece na timeline como
  marco **concluído**, sem alça de arraste, sem stepper na tabela, e nenhum `pointermove` altera sua
  duração. *Verificação:* RTL — disparar drag sobre o módulo 0 (frozen) e assertar `durations`
  inalterado.
- **AC-E2.2 — Buraco no meio funciona.** Com `frozenIndices = [0,1,2,4]`, o módulo 3 aparece
  **editável** entre concluídos, e o 4 aparece concluído depois dele. *Verificação:* RTL com o
  vetor do aluno real; assertar a ordem visual e quais linhas têm stepper.
- **AC-E2.3 — Cascata e presets pulam frozen.** `applyBump` (`timeline-engine.ts:130`), `applyDrag`
  (`:95`), `maxDaysAt` (`:50`) e `presetDurations` (`:201`) operam **só** sobre `remainingIndices`;
  nenhum caminho devolve `durations[i] !== 0` para `i` frozen. *Verificação:* testes do
  `timeline-engine` com `RemainingWindow` de frozen não-prefixo, em todos os 4 caminhos.
- **AC-E2.4 — "Voltar ao ponto de partida" respeita o progresso.** `onReset`
  (`journey-builder.tsx:89`) chama `progressAwareNeutralDurations`, **não** `neutralDurations`.
  *Verificação:* `grep -n "neutralDurations" journey-builder.tsx` não retorna a chamada antiga;
  RTL confirma frozen em 0 após o reset.
- **AC-E2.5 — Timeline começa HOJE (D2).** As datas exibidas derivam de `moduleEndDatesAnchored`
  sobre `context.planningAnchorDate`, não de `moduleEndDates(context.startDate, ...)`. Nenhuma data
  de módulo pendente é anterior a hoje. *Verificação:* RTL com `startDate` 60 dias no passado e
  assertar que a primeira data renderizada ≥ hoje.
- **AC-E2.6 — Revisar trava o que concluiu (D5).** No modo revisar (`initialDurations` presente), os
  módulos concluídos **desde a montagem** entram frozen, só o restante é redistribuído, e a soma
  nunca ultrapassa `remainingDays`. O teto duro exibido não se move. *Verificação:* RTL — revisar
  com 1 módulo a mais concluído e assertar que ele virou não-editável e que o chip "Disponível até"
  tem a mesma data.
- **AC-E2.7 — Teto vencido é honesto.** Com `window.expired`, o construtor mostra estado explícito
  de prazo vencido (zona `red` de `zoneOf`, `plan-math.ts:116`), mantém o CTA habilitado com os
  vivos em `MIN_DAYS_PER_MODULE` e **não** finge um prazo que não existe. *Verificação:* RTL com
  `cohortDeadlineDate` no passado.
- **AC-E2.8 — Sem meta do gestor não quebra.** Com `cohortManagerDeadlineDate: null` (o caso REAL
  nos dois tenants hoje), nenhum chip/frase de meta é renderizado e o banner de consequência usa só
  o teto final. *Verificação:* RTL com `managerDeadlineDays: null`.
- **AC-E2.9 — Modo derivado sem tocar o shell.** O construtor distingue criar × revisar por
  `initialDurations !== undefined`. `journey-shell.tsx` **não** é editado. *Verificação:*
  `git status --short -- "apps/web/src/app/(platform)/jornada/_components/hub"` vazio ao fim de E2.

### Trilha E3 — dashboard

- **AC-E3.1 — "Ponto de partida" existe e é separado.** `DashboardModel.startingPoint` é populado a
  partir de `plan.baseline` e renderizado num bloco próprio, rotulado como ponto de partida — nunca
  somado ao realizado da jornada. *Verificação:* teste do `dashboard-model` + RTL do bloco.
- **AC-E3.2 — Realizado é delta (D3).** `sinceJourney.*` = lifetime − baseline, com piso 0.
  *Verificação:* teste — `progressNow: 62`, `baseline.progressPct: 50` → `sinceJourney.progressPct === 12`.
- **AC-E3.3 — Dia 0 volta a existir.** `isDayZero` (`dashboard-model.ts:157`) passa a olhar o delta.
  *Verificação:* teste — aluno de 50% que acabou de montar a jornada resulta em `isDayZero === true`.
- **AC-E3.4 — Ritmo não infla.** `donePerWeek`/`combinedPerWeek` (`dashboard-model.ts:389-391`)
  usam o delta sobre semanas desde `plan.planningAnchorDate`. *Verificação:* teste — mesmo aluno,
  1 dia de jornada, `donePerWeek` reflete só o que fez em 1 dia, não os 50%.
- **AC-E3.5 — Prazos reancorados.** `reanchored` (`dashboard-model.ts:135-136`) usa
  `moduleEndDatesAnchored`; módulos frozen têm `deadlineIso: null` e são rotulados "concluído", nunca
  com uma data futura fabricada. *Verificação:* teste do zip com frozen não-prefixo.
- **AC-E3.6 — Leitura da IA não mente.** Nenhum estado de `buildAiReading`
  (`dashboard-model.ts:220-326`) atribui à jornada trabalho anterior ao baseline.
  *Verificação:* teste dos 4 estados com baseline não-nulo.

### Gates (todas as trilhas)

- **AC-G1** — `pnpm --filter web typecheck` verde.
- **AC-G2** — `pnpm --filter web test` verde, incluindo as suítes pré-existentes de
  `lib/analytics/__tests__/` e `_components/hub/__tests__/journey-shell.test.tsx` **sem alteração**.
- **AC-G3** — `pnpm --filter web lint` (biome) exit 0.
- **AC-G4** — Smoke manual em `http://localhost:3002/jornada?curso=<curso do aluno de 50%>`:
  o construtor abre com os concluídos travados e o buraco do módulo 3 editável.
- **AC-G5** — `git status --short -- apps packages` não contém nenhum arquivo fora dos três
  territórios acima.

---

## 7. Riscos e bordas

| # | Risco / borda | Mitigação |
|:--|:---|:---|
| **R1** | **Progresso esparso com buracos.** O aluno real tem 0,1,2,4 concluídos e 3 intocado. Todo desenho de prefixo quebra. | `frozenIndices` é um conjunto arbitrário em todo o contrato; AC-E1.2, AC-E2.2 e AC-E3.5 testam explicitamente o não-prefixo. |
| **R2** | **Módulo "done" com 1 de 5 perguntas.** `status: "done"` sai de **uma** sessão concluída, embora existam 5 perguntas socráticas ativas. Travamos um módulo que talvez tenha 20% do trabalho feito. | Registrado, **não corrigido nesta story** (ver Q1). `frozen` segue a regra do motor existente para não divergir de `/meu-plano` e do comparativo da home. Q1 leva a Hugo. |
| **R3** | **Reflexões feitas com 0 interações aparecem como "não iniciado".** É o módulo 3 do aluno real: 4 de 4 reflexões, 0 interações, `status: "planned"`. | `completedRatio` **captura** esse trabalho (numerador soma reflexões), então a duração sugerida já é proporcional (D4/AC-E1.4) mesmo com `status: "planned"`. O módulo não trava, mas também não pede tempo cheio. |
| **R4** | **Aluno cujo teto de coorte já venceu.** `remainingDays = 0` e `n × MIN > 0` — não existe jornada válida. | `window.expired`; AC-E2.7 exige estado honesto e CTA funcional com os vivos no mínimo. Nunca um prazo inventado, nunca um botão morto sem explicação. |
| **R5** | **`manager_deadline_days` é NULL nos dois tenants.** A meta do gestor degrada para null em dados reais **hoje**; `deadline_days = 180`. | AC-E2.8. `zoneOf` (`plan-math.ts:116`) já degrada corretamente (verde até o final quando a meta é null) — reusado, não reescrito. |
| **R6** | **Working tree com ~80 arquivos modificados de outras frentes.** | Cada trilha faz `git add` só do próprio território. @devops (exclusivo) faz o commit/push. Ninguém commita o que não é seu. |
| **R7** | **`actions.ts` disputado com a tarefa da âncora de coorte.** | Sequenciamento explícito (§4): âncora pousa → E1 Ato 2. Não é colisão de paralelismo, é ordem temporal. |
| **R8** | **E1 entra em `lib/analytics/`,** que serve `/meu-plano` e a API `/api/analytics/plan-dashboard`. | AC-E1.6 exige a suíte de `lib/analytics/__tests__/` verde; a alternativa "não tocar analytics" está pré-aprovada (§5, nota). |
| **R9** | **`JourneyModuleMeta.progress` obrigatório quebra os mocks de E2/E3 até serem atualizados.** | Deliberado: opcional deixaria ignorar progresso em silêncio. E1 entrega o contrato no **Ato 1**; E2/E3 partem dele — mesma sequência do contrato original do épico. |
| **R10** | **Migration não aplicada.** Como no resto do épico, a migration é escrita e nunca aplicada por agente. | AC-E1.8. Aplicar exige GO explícito do Hugo. Como `study_plans` tem 0 linhas, a janela é gratuita — mas só até o lançamento. |

---

## 8. Perguntas abertas para o Hugo (não bloqueiam o início, bloqueiam o fechamento)

- **Q1 — `interactionsExpected` está fixo em 1** (`apps/web/src/lib/journey/journey-plan-data.ts:112`
  e `study-plan-dashboard.ts:92`), mas existem **5 perguntas socráticas ativas** por módulo. Mudar
  para 5 reescreveria todo o "esperado" do produto (dashboard, comparativo da home, ritmo) e
  derrubaria o percentual de todo aluno da noite para o dia. **Proposta: não mexer nesta story**, e
  tratar como decisão separada de produto. Confirma?
- **Q2 — Comparativo da home.** `computeJourneyCumulativeExpected`
  (`study-plan-dashboard.ts:204`) reancorou o "combinado" nas durações da jornada (JRN-D), mas
  ignora progresso e baseline. Com JRN-E, o card "Meu ritmo" e o dashboard da Jornada vão contar
  histórias ligeiramente diferentes até que ele também use o delta. **Proposta: follow-up JRN-F**,
  fora desta story para não inflar o escopo. Confirma?
- **Q3 — Módulo "done" com trabalho parcial (R2).** Travar um módulo com 1 de 5 perguntas é o
  comportamento desejado, ou o aluno deveria poder destravá-lo manualmente no construtor?

---

## 9. Plano de execução

1. **E1 Ato 1** (não bloqueado): `types.ts` + `plan-math.ts` + `module-progress.ts` + testes puros.
   Publica o contrato. **E2 e E3 só começam depois deste ato.**
2. **E1 Ato 2** (bloqueado pela âncora de coorte): `journey-plan-data.ts`, `actions.ts`, schema,
   migration.
3. **E2 e E3 em paralelo**, contra o contrato do Ato 1.
4. **Integração:** smoke em `http://localhost:3002/jornada?curso=` com a matrícula do aluno de 50%.
5. **Gates** AC-G1..G5 por trilha.
6. **Fechamento:** @devops (exclusivo) faz commit/push. Migration aplicada só com GO do Hugo.

---

## Change Log

| Data | Mudança | Autor |
|:---|:---|:---|
| 2026-07-25 | Story criada a partir do pedido do Hugo (montar/revisar jornada no meio do curso). Apuração de arquitetura verificada arquivo a arquivo; 6 decisões registradas como dadas; 3 trilhas de território disjunto; contrato de progresso separado. | @sm (River) |
| 2026-07-25 | **TRILHA E2 implementada** (AC-E2.1→E2.9). O construtor deixa de distribuir a janela cheia sobre todos os módulos: concluídos travam em 0, sem alça e sem stepper, e só a janela restante (hoje → teto de coorte) é repartida sobre o que falta. `timeline-engine` ganhou o parâmetro opcional `window: RemainingWindow` e passou a operar por **projeção nos vivos → mecânica existente → espalhamento com frozen em 0 exato**, o que faz `applyDrag`/`applyBump`/`maxDaysAt`/`presetDurations`/`suggestionBase` pularem concluídos ESPARSOS sem reimplementar cascata, snap nem teto. Testes usam o padrão do aluno real (0,1,2,4 travados, **buraco no 3**), nunca prefixo. | @dev (Dex) |
| 2026-07-25 | **Decisões de E2 que valem registro.** (1) *Eixo do trilho ≠ eixo de dias quando há concluídos*: `trackLayout` (journey-format) dá a cada concluído `FROZEN_TRACK_DAYS = 6` de largura VISUAL in loco — sem isso os 4 concluídos do aluno real empilhariam no dia 0 e o módulo 4 (concluído) apareceria antes do 3 (vivo), quebrando a ordem que a AC-E2.2 exige. O span visual não entra em conta alguma de prazo, e `deadlineTrack = frozenTrack + remainingDays` mantém o teto duro sendo teto também em pixels. (2) *A régua de meses some quando há concluídos*: o eixo deixa de ser linear em dias e um rótulo de mês ali seria mentira (subtração, não maquiagem). (3) *Honestidade na tabela*: as colunas Interações/Reflexões passam a mostrar **feito/esperado**, então o módulo "concluído" com 1 sessão e 0 de 2 reflexões e o módulo com 4/4 reflexões que o motor chama de "não iniciado" aparecem como são, sem rótulo inventado. (4) *Revisar preserva, não infla*: o que foi concluído desde a montagem vai a 0 e os dias liberados viram folga (o aluno termina antes), em vez de serem redistribuídos como prazo extra. | @dev (Dex) |
| 2026-07-25 | **Correção no motor achada por teste de borda:** com a janela impossível (teto vencido, `remainingDays = 0`), `maxDaysAt` devolvia teto negativo e o drag produzia **duração negativa**. O caminho com janela agora fecha em `fitToDeadline(..., remainingDays)`, que já degrada para "todos os vivos no mínimo" — contrato §7, a invariante quebra por impossibilidade, nunca por bug. | @dev (Dex) |
| 2026-07-25 | **Efeito colateral registrado (vem de E1, não de E2):** a partida neutra do aluno em dia 0 mudou de "≈15 dias por módulo, sobrando folga" para "soma EXATAMENTE a janela", porque `progressAwareNeutralDurations` distribui o total (AC-E1.3 exige `sum === remainingDays`). A asserção literal de "2,1 semanas" do `render.test.tsx` foi trocada por uma asserção de invariante (snap semanal + teto), que é o que a story realmente garante. | @dev (Dex) |
| 2026-07-25 | **Gate AC-G1 fecha com 1 erro fora do território de E2.** `_components/hub/__tests__/journey-shell.test.tsx:51` não compila porque `JourneyModuleMeta.progress` virou obrigatório em `types.ts` (E1, commit `2badea8`) — é exatamente o R9 da story. O arquivo é **não-território** (§5) e a AC-G2 exige que ele permaneça **sem alteração**, então E2 não o tocou; a suíte segue verde em runtime (181/181). Provado por `git stash` do território de E2: em HEAD havia 3 erros de tsc, E2 corrigiu os 2 do próprio território e este permanece. Cabe a E1 atualizar o mock. | @dev (Dex) |
| 2026-07-25 | **TRILHA E3 implementada** (commit `b3b73c5`, só `_components/dashboard/**`). AC-E3.1..E3.6 satisfeitos. `DashboardModel` ganhou `startingPoint`/`sinceJourney`/`anchorDateIso`/`daysSinceAnchor` e `DashModuleRow` ganhou `frozen`. **Desvio registrado do contrato-progresso §8:** os campos novos são **opcionais no TIPO** (sempre populados por `buildDashboardModel`). Torná-los obrigatórios, como o contrato pede, quebraria o literal `DashboardModel` de `_components/hub/__tests__/journey-shell.test.tsx:175`, que o **AC-G2 exige inalterado** e que está fora do território de E3 (é "não-território"). Alternativa seria E3 editar arquivo alheio; preferi o tipo opcional + população garantida + JSDoc explicando. Reuso provado por teste (mesma entrada → mesmo resultado de `moduleEndDatesAnchored(computeRemainingWindow(...))` e de `computeJourneyCumulativeExpected`), mais um **teste de contraste** mostrando que os mesmos números sem baseline mentiriam "em dia" com anel 100%. `motion.module.css` **não** precisou ser tocado (o bloco novo reusa `.rise`). Gates: 33 testes do território verdes, suíte `jornada`+`lib/journey` 156/156 verde, biome limpo, `tsc` **sem nenhum erro em `_components/dashboard/**`** (erros remanescentes são de `builder/`, `review/` e do fixture do hub, trilhas em voo). | @dev (Dex), Trilha E3 |
| 2026-07-25 | **TRILHA E1 implementada** (Atos 1 e 2). Decisões de execução registradas abaixo (D-E1.1 a D-E1.6). Gates: `tsc` limpo no território de E1; 354 testes verdes em `lib/journey` + `jornada` + `lib/analytics` (baseline de E1 era 79 e 198); biome exit 0. Migration escrita e **NÃO aplicada**. | @dev (Dex) |
| 2026-07-25 | **AUTORIZAÇÃO DO DONO DO ÉPICO — o bloqueio do `journey-shell.test.tsx` foi liberado.** Hugo, dono do épico, autorizou explicitamente a edição de `_components/hub/__tests__/journey-shell.test.tsx`, resolvendo a contradição entre a §5 ("não-território, NINGUÉM edita") e a AC-G2 ("passa sem alteração") diante de um `JourneyModuleMeta.progress` obrigatório. E1 e E2 escalaram em vez de contornar, corretamente — a contradição era da story, não deles. **Escolha de correção, pelo caminho de MENOR INVENÇÃO:** (a) cada módulo do fixture recebe `{ ...UNTOUCHED_MODULE_PROGRESS }`, a constante canônica de E1 (`module-progress.ts:76`), em vez de um literal escrito à mão — nenhum progresso é inventado; (b) os 4 campos aditivos do contexto recebem os valores que a MESMA aritmética de `cohortDeadlineDate` (`plan-math.ts:108`) produz a partir do `startDate` do fixture (`2026-01-01 + 126d = 2026-05-07`, `+105d = 2026-04-16` — datas que o `DASH_MODEL` do próprio arquivo já usava), com `planningAnchorDate = startDate` e `remainingWindowDays = 126`. Isso reproduz EXATAMENTE o caminho de degradação que `journeyWindow` (`journey-format.ts:201-222`) já executava em runtime, então nenhuma asserção sobre o comportamento do shell muda. Suíte do hub segue 10/10 verde. `tsc --noEmit` do repo passa a sair **exit 0**. | @qa (Quinn) |
| 2026-07-25 | **Desvio de E3 do contrato §8 HONRADO** (item 3d da passagem de integração). Com a fixture do hub autorizada, o motivo declarado por E3 para deixar `startingPoint`/`sinceJourney` opcionais no tipo deixou de existir. Ambos voltaram a ser **obrigatórios** em `DashboardModel` (`dashboard-model.ts`), como o contrato-progresso §8 pede — um consumidor que ignore o baseline não compila, mesma disciplina do `JourneyModuleMeta.progress`. Custo real medido: **um único literal** quebrou (`journey-shell.test.tsx:196`), preenchido com `startingPoint: null` + o delta que, sem baseline, É o próprio lifetime já declarado nesse literal. `anchorDateIso`/`daysSinceAnchor` e `DashModuleRow.frozen` seguem opcionais **de propósito**: não constam do contrato §8 e torná-los obrigatórios seria inventar além do contrato e além da autorização. | @qa (Quinn) |

### Decisões de execução da Trilha E1 (2026-07-25)

**D-E1.1 — Entrar em `lib/analytics/` foi a escolha, e a alternativa não era viável.**
A §5 pré-aprovava duas saídas. A alternativa ("consumir `PlanDashboardData.moduleJourney` já
pronto") exigiria que o `page.tsx` passasse esse dado ao `fetchJourneyCourseContext` — e
`page.tsx` é **não-território, ninguém edita**. Sem isso, o construtor teria que reimplementar o
predicado de conclusão, que é exatamente a violação do Artigo IV que a story proíbe. Portanto:
`computeChapterCompletion` foi **extraído verbatim** de `plan-dashboard-data.ts:228-234` para
`study-plan-dashboard.ts` (puro), e o chamador original passou a usá-lo. Uma fórmula, dois
chamadores. A borda esquisita do código antigo (sessão ativa com `chapter_id` nulo devolve
`null`, **não** cai no primeiro pendente) foi preservada de propósito e tem teste de paridade.
Prova de não-regressão: `lib/analytics` continua com **198 testes verdes**, o mesmo número de
antes da extração.

**D-E1.2 — `progressAwareNeutralDurations` distribui por PESO, não por fatia uniforme.**
O contrato §5 descreve "fatia × (1 − completedRatio)"; a leitura literal faz a soma ficar
**abaixo** da janela quando existe módulo parcial, e o AC-E1.3 exige `sum === remainingDays`.
Os dois só fecham juntos com distribuição proporcional: peso 0 para concluído, `1 − ratio` para
parcial, 1 para intocado, com piso `MIN_DAYS_PER_MODULE`. Quando todos os vivos estão
intocados os pesos são uniformes e o resultado é idêntico à leitura literal. Com parciais, os
dias que o parcial não precisa vão para quem precisa, em vez de sobrarem sem dono no fim da
janela — o aluno de 115 dias restantes recebe um plano de 115 dias, não de 90.
**Nenhuma assinatura do contrato mudou**, então E2 e E3 não são afetados; as 5 invariantes da
§5 continuam valendo. Registrado aqui porque é interpretação de fórmula, não de interface.

**D-E1.3 — Baseline: fonte dos números escolhida para casar com o `diagnostic`, e degradação
se a migration não pousar.** `baseline.progressPct` sai de `computeBehindAndProgress`
(o mesmo motor que produz `subject.progressPct` escopado por curso em `area-gestor.ts:1746-1758`,
que vira `diagnostic.progressNow`), e não de uma leitura própria de `enrollments.progress` — sem
essa igualdade de fonte, o delta `lifetime − baseline` do E3 seria a subtração de duas réguas
diferentes. `sessionsDone`/`reflectionsDone` saem das contagens por capítulo que o contexto já
carrega. Como a coluna `baseline` **só existe depois da migration**, a escrita degrada: se o
`select` com `baseline` falhar, o save acontece sem baseline em vez de quebrar o aluno em
produção (mesmo padrão defensivo que `fetchCourseDeadlines` já usava para
`manager_deadline_days`). Coberto por teste.

**D-E1.4 — Defeito encontrado e corrigido durante a execução.** A primeira versão do Ato 2
chamava `fetchJourneyCourseContext` dentro do `try` principal do `saveJourneyPlan`: uma falha na
leitura do progresso passava a **impedir o aluno de salvar a jornada**. O `deadline-anchor.test.ts`
(pré-existente) pegou isso, 8 testes vermelhos. A leitura de progresso é enriquecimento da
escrita, não pré-requisito dela, então ganhou try/catch próprio com queda para a régua antiga.
O teste pré-existente voltou ao verde **sem ser alterado**, que é o que o AC-G2 pede.

**D-E1.5 — Um mapper, não dois.** `actions.ts` tinha um `mapRow` próprio, duplicando o
`mapRowToJourneyPlan` de `journey-plan-data.ts`. Com três campos novos (durações ancoradas,
âncora de replanejamento, baseline), manter dois era garantir divergência entre leitura e
escrita. O mapper de leitura virou a fonte única e foi exportado.

**D-E1.6 — Arquivo de teste novo fora da tabela da §5.** O AC-E1.7 exige teste da fronteira de
escrita, mas a §5 só lista dois arquivos de teste para E1. Foi criado
`apps/web/src/app/(platform)/jornada/__tests__/journey-baseline.test.ts` — pasta que não pertence
a E2 (`builder/__tests__`) nem a E3 (`dashboard/__tests__`), portanto sem colisão de território.

### Achado BLOQUEANTE para o fechamento do épico (não é de E1)

`apps/web/src/app/(platform)/jornada/_components/hub/__tests__/journey-shell.test.tsx:45-58`
monta um `JourneyCourseContext` inline e **não compila** com `progress` obrigatório
(contrato §2, R9). O arquivo está em `_components/hub/**`, declarado **não-território
("NINGUÉM edita")** na §5, e o AC-G2 exige que ele passe *"sem alteração"* — o que é
impossível com um campo obrigatório. **Ninguém tem autoridade para corrigi-lo.** É uma
contradição da própria story, não uma pendência de E1: o teste **passa em runtime** (vitest não
typecheca), mas o `tsc --noEmit` do AC-G1 fica vermelho até alguém receber a autorização de
adicionar `progress` aos 8 mocks e os 4 campos novos ao contexto. Precisa de decisão do dono do
épico sobre quem edita.

## File List

- `docs/stories/epic-jornada/JRN-E.story.md` (novo)
- `docs/stories/epic-jornada/contrato-progresso.md` (novo)

### Trilha E2 — construtor consciente do progresso (commit `45b3041`)

| Arquivo | O que mudou |
|:---|:---|
| `apps/web/src/lib/journey/timeline-engine.ts` | `window?: RemainingWindow` em `InteractionOpts`; `applyDrag`/`applyBump`/`maxDaysAt`/`presetDurations`/`presetConsequence`/`suggestionBase` operam por projeção nos vivos; `desiredDaysFromRatio` aceita `trackStarts`; guarda de janela impossível |
| `apps/web/src/lib/journey/__tests__/timeline-engine.test.ts` | +12 testes sobre o padrão ESPARSO real (0,1,2,4 travados, buraco no 3) |
| `.../builder/journey-format.ts` | adaptador sobre E1: `progressOf`, `progressModules`, `journeyWindow`, `anchoredDates`, `trackLayout`, `FROZEN_TRACK_DAYS` |
| `.../builder/journey-builder.tsx` | semeadura consciente do progresso (criar × revisar), reset que respeita travas, copy honesta, chip do teto de coorte |
| `.../builder/timeline-canvas.tsx` | eixo de trilho, marco travado sem alça, "concluído" no lugar da data, meses só em eixo linear, prazo vencido explícito |
| `.../builder/module-table.tsx` | linha travada sem stepper e sem período; colunas Interações/Reflexões em feito/esperado |
| `.../builder/consequence-banner.tsx` | zona medida contra a janela restante; estado honesto de prazo vencido |
| `.../builder/builder-controls.tsx` | `SuggestDropdown` repassa a janela aos presets |
| `.../builder/journey.module.css` | estilos do concluído (véu + halo, nunca contorno duro), prazo vencido, linha travada |
| `.../builder/__tests__/render.test.tsx` | fixture do aluno real + 12 testes de AC-E2.* |
| `.../review/journey-review.tsx` | revisar herda travas, snapshot reancorado, teto imóvel |

---

## QA Results

**Passagem de integração das 3 trilhas — @qa (Quinn), 2026-07-25**
**Gate: CONCERNS.** Os 4 gates mecânicos fecham. A auditoria de costura entre as trilhas
encontrou **3 defeitos reais**, dois deles provados empiricamente e nenhum coberto por teste.

### 1. Gates (saída literal)

| Gate | Comando | Resultado |
|:--|:---|:---|
| AC-G1 | `pnpm --filter @eximia/web exec tsc --noEmit` | **exit 0**, zero linhas de saída |
| AC-G2a | `vitest run "src/lib/journey" "src/app/(platform)/jornada"` | **10 arquivos, 181/181** |
| AC-G2b | `vitest run "src/lib/analytics"` | **9 arquivos, 198/198** (baseline preservada) |
| AC-G3 | `biome check` nos 3 territórios + schema | **exit 0** (36 + 1 arquivos) |

`lib/analytics` em 198 confirma que a extração de `computeChapterCompletion` feita por E1
(D-E1.1) não regrediu `/meu-plano` nem o painel do gestor.

### 2. Auditoria de costura — o que foi verificado

**3a — Reuso das funções canônicas de E1: PASSA.** E2 e E3 consomem, nunca espelham:
`journey-builder.tsx:21,232-233` (`fitRemainingToDeadline`, `progressAwareNeutralDurations`),
`journey-format.ts:18-21,212,312` (`computeRemainingWindow`, `moduleEndDatesAnchored`,
`cohortDeadlineDate`), `journey-review.tsx:18,60` (`fitRemainingToDeadline`),
`dashboard-model.ts:22,232,238` (`computeRemainingWindow`, `moduleEndDatesAnchored`).
Nenhuma reimplementação de cascata, teto ou acumulação de datas.
Duas ressalvas menores, ambas justificadas e documentadas no próprio código:
`journey-format.ts:149` (`daysBetween`) é irmã de `remainingWindowDaysBetween`, não cópia — a
canônica clampa em 0 e a meta do gestor precisa de delta negativo; e `dashboard-model.ts:250`
reaplica `frozen ⟺ status === "done"` como *fallback* por `chapterId`, aplicando a equivalência
do contrato §2 sobre o status do motor canônico, sem criar regra de conclusão nova.

**3b — Teto duro ponta a ponta: FALHA (JRN-E-QA-1).** Ver defeitos abaixo.

**3c — Construtor × dashboard: divergem (JRN-E-QA-2).** Ambos leem o mesmo conjunto frozen
(`context.modules[i].progress`, do mesmo request), então concordam em *quem* está travado. Mas
ancoram a janela em pontos diferentes — o construtor em `context.planningAnchorDate` = HOJE
(`journey-format.ts:205`) e o dashboard em `plan.planningAnchorDate` = a montagem
(`dashboard-model.ts:234`). Isso é o desenho (D2/D3) e está correto. O problema é a interação
disso com `moduleEndDatesAnchored`, abaixo.

**3d — Contrato §8 honrado.** `startingPoint`/`sinceJourney` voltaram a ser obrigatórios; custo
real medido foi 1 literal. Registrado no Change Log.

### 3. Defeitos encontrados

| # | Sev | Defeito |
|:--|:--|:---|
| **JRN-E-QA-1** | **ALTA** | **Capítulo publicado depois da montagem fura o teto de coorte no dashboard.** `alignDurationsToChapters` atribui `MIN_DAYS_PER_MODULE` ao capítulo novo, e o JSDoc de `plan-math.ts:356` e o contrato §4 dizem que **o chamador re-clampa com `fitRemainingToDeadline`**. Nenhum chamador do read-path faz isso: `parsePersistedDurations` (`journey-plan-data.ts:227-258`) e `mapRowToJourneyPlan` (`:281-320`) devolvem `moduleDurations` sem clamp, e `dashboard-model.ts:238` os entrega direto a `moduleEndDatesAnchored`. **Provado:** âncora `2026-01-01`, teto `2026-04-11`, jornada `[50,50]` somando exatamente a janela; publicado `ch-c` → `projected = [50,50,4]` → último prazo **`2026-04-15`, 4 dias ALÉM do teto**. O construtor e a escrita clampam (`journey-builder.tsx:232`, `actions.ts:260`); só a leitura não. Um aluno que nunca revisar a jornada convive com o furo indefinidamente. |
| **JRN-E-QA-2** | **MÉDIA** | **Concluir um módulo encolhe os prazos combinados dos módulos seguintes.** `moduleEndDatesAnchored` (`plan-math.ts:336-348`) pula o índice frozen **sem acumular seus dias**. No construtor é inofensivo (frozen na montagem já vale 0 dia). No dashboard não: um módulo concluído *depois* da montagem tem `durations[i] > 0` e some do acúmulo. **Provado:** âncora `2026-01-01`, `[30,30,40]` → prazos `["2026-01-31","2026-03-02","2026-04-11"]`; concluído o módulo 1, viram `[null,"2026-01-31","2026-03-12"]` — o prazo do módulo 2 andou **30 dias para trás**. O aluno que se adianta vê o combinado apertar sozinho e pode aparecer atrasado contra um prazo que ele nunca aceitou. Nunca fura o teto (só antecipa), por isso MÉDIA e não ALTA. O teste da AC-E3.5 (`dashboard-model.test.ts:480-545`) não pega: o fixture usa `moduleDurations: [0,30,0,30]`, ou seja, frozen **na montagem** — o caso pós-montagem não é exercitado por nenhum teste. |
| **JRN-E-QA-3** | **MÉDIA** | **Copy mente para o aluno recém-matriculado, o caso mais comum do lançamento.** `hasProgress` (`journey-format.ts:220`) significa "o contexto trouxe progresso", e depois de E1 ele é **sempre true** (`journey-plan-data.ts:188` sempre popula). Com 0 módulos concluídos, `journey-builder.tsx:130-136` renderiza "Você já concluiu **0** de 8 módulos: eles ficam travados, não consomem prazo e não entram no arraste", e `journey-review.tsx:105-106` renderiza "Os **0** módulos concluídos ficam travados". O ramo "Ponto de partida neutro" (`:139-143`) virou código morto em produção. Nenhum teste cobre essas frases (`grep` por "já concluiu"/"Ponto de partida neutro" em `_components/**/__tests__` não retorna nada). Correção provável: trocar a guarda de `win.hasProgress` para `win.frozenIndices.length > 0`. |

### 4. AC não cumpridos de verdade

- **AC-G2 (literal):** impossível de cumprir como escrito, e agora oficialmente superado pela
  autorização do dono do épico. `journey-shell.test.tsx` **foi** alterado. A seção *"Achado
  BLOQUEANTE para o fechamento do épico"* acima é **histórica** — o "ninguém tem autoridade"
  deixou de valer em 2026-07-25.
- **AC-E2.9 (segunda metade):** "`git status --short -- ".../hub"` vazio" já não vale, pela mesma
  autorização. A primeira metade (o construtor deriva criar × revisar de `initialDurations`)
  continua verdadeira e verificada em `journey-builder.tsx:232`.
- **AC-G4 (smoke em `localhost:3002`): NÃO EXECUTADO.** Ver §5.
- **AC-G5:** verificado. `git status --short -- apps packages` = 82 (baseline 80 + os 2 arquivos
  desta passagem). `study-plan-projection.ts` aparece modificado mas é **frente paralela do
  Hugo** (SH-3.3 R7, 2026-07-21), não vazamento de trilha — confirmado pelo diff.
- **AC-E1.8:** verificado. `20260726000000_jornada_progresso.sql` existe e **nenhum**
  `supabase db push` foi executado por esta passagem.

### 5. O que NÃO foi verificado (declarado, não escondido)

- **O fluxo logado no browser.** Ninguém exercitou `http://localhost:3002/jornada?curso=…` com a
  matrícula do aluno de 50% — nem as trilhas, nem esta passagem. Todos os defeitos acima vêm de
  leitura de código e de execução das funções puras. **JRN-E-QA-3 é exatamente o tipo de defeito
  que um único smoke logado teria pego em 10 segundos**, e é o argumento mais forte para não
  fechar o épico sem AC-G4.
- **Comportamento real contra o banco.** `actions.ts` é coberto por fakes; o log de infra
  `[jornada:saveJourneyPlan:progressContext] infra error: ...in is not a function` aparece nos 8
  testes de `deadline-anchor.test.ts`, o que significa que **o caminho feliz de leitura do
  progresso na escrita não é exercitado ali** — só a degradação da D-E1.4. O caminho feliz está
  coberto em `journey-baseline.test.ts`, mas com outro fake.
- **A migration aplicada.** Enquanto a coluna `baseline` não existir, `plan.baseline` é sempre
  `null`, `startingPoint` é sempre `null` e todo o valor da Trilha E3 fica invisível em produção.

### 6. Veredito

**CONCERNS.** Nada aqui bloqueia commit local — o trabalho das 3 trilhas é sólido, o reuso é
real e os gates fecham. Mas **não recomendo fechar o épico** antes de: (1) JRN-E-QA-1, que é uma
quebra do invariante que a story inteira existe para proteger; (2) JRN-E-QA-3, que toda base
recém-matriculada vai ler; (3) o smoke logado da AC-G4. JRN-E-QA-2 aceita virar follow-up com
decisão de produto (o prazo combinado deve encolher quando o aluno se adianta?).

— Quinn, guardião da qualidade 🛡️
