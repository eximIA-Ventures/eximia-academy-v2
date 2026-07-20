# SH-3.1: "Monte o seu plano de estudo" — tela real, navegável, diagnóstico real, SEM persistência

**Epic:** [EPIC-STUDENT-HOME](./EPIC-STUDENT-HOME.md)
**Status:** InReview
**Depende de:** SH-2.7/2.7.1/2.7.2 (`expectedProgressPct`, o sinal de ritmo esperado que esta tela reusa), SH-1.5 (`reflectionsMax`/`interactionsMax`, os denominadores fracionários que esta tela também reusa).
**Bloqueia:** nenhuma story aberta. A persistência real do "compromisso semanal" fica para uma story futura (schema ainda não decidido com o Hugo — ver Dev Notes §Fronteira de escopo).
**Paralelizável:** rodou em terminal Maestri dedicado ("Oficial"), a partir de 3 mockups HTML já validados com o Hugo (fundador). Toca `study-plan-projection.ts` (novo), a rota `/meu-plano` inteira (nova) e 1 ponto de entrada em `student-home-card.tsx` — não paraleliza com trabalho concorrente nesse mesmo arquivo.

---

## Story

**As a** aluno logado, olhando o card "Meu ritmo" no meu dashboard,
**I want** uma tela dedicada onde eu monte o meu compromisso de estudo da semana (dias, sessões por dia, se priorizo reflexão) e veja, ao vivo, se essa escolha fecha o meu gap real até o fim do curso,
**so that** eu decida com agência (não uma meta imposta) mas com o meu diagnóstico REAL na frente, não um formulário em branco.

## Contexto (Dev Notes)

### Origem — 3 mockups já validados pelo Hugo, esta story os torna código real

O trabalho de hoje partiu de 3 artefatos HTML em `JARVIS/apps/hub-discovery/`, já validados como spec visual/de interação:

1. `meu-plano-semanal-discovery.html` — pesquisa real (Duolingo, Khan Academy, Fitbit, WHOOP, literatura de behavior design) + 3 direções de design (A: meta calculada específica, B: contexto+livre, C: loop fechado). Hugo escolheu a lógica da Direção A (meta computada, específica, sem loop fechado ainda).
2. `meu-plano-semanal-modelo-oficial.html` — síntese em CARD (2 estados: não configurado / em andamento), pensado para viver embaixo da tabela "Meu ritmo".
3. `meu-plano-tela-configuracao.html` — a TELA DEDICADA final, com moldura própria (breadcrumb "‹ Meu ritmo / Montar meu plano") e 5 seções numeradas (diagnóstico → dias → intensidade → projeção ao vivo → confirmação). **Este é o que a story implementa de verdade.**

O pedido do Hugo, verbatim: *"aplica na versão oficial pra gente testar e roda local quando acabar pra gente ver como fica"* — ou seja, sair do HTML estático e virar React/Next.js navegável de verdade no app.

### O que é REAL nesta implementação (vs. o mockup, que usava o Rinaldo fixo)

O mockup hardcodeava os números do Rinaldo (SH-2.7). Esta implementação é **genérica**: busca o diagnóstico do aluno REALMENTE LOGADO, para qualquer aluno, via `computeStudentComparison` (a MESMA função que já alimenta a tabela "Meu ritmo" hoje, `/api/analytics/manager-groups?view=student`). Nenhum cálculo foi reimplementado:

- `progressNow` = `indicators.subject.progressPct` (real).
- `progressTarget`/`reflTarget` = `indicators.subject.expectedProgressPct` (SH-2.7, o mesmo "ritmo esperado" por tempo decorrido/deadline que já existe — reusado uniformemente para as duas dimensões, exatamente como `ownPaceSignalFor` já faz para Progresso/Interações/Reflexões).
- `reflDoneCount`/`reflTotal` = `indicators.subject.reflections`/`reflectionsMax` (SH-1.5, real).
- `daysLeft`/`weeksLeft` = calculado numa função NOVA e ISOLADA (`fetchLeadingEnrollmentDeadline`, dentro de `page.tsx`), que lê `enrollments.created_at` + `courses.deadline_days` da matrícula líder (maior progresso — mesmo critério de "matrícula líder" que `computeBehindAndProgress`/SH-2.7 já usa), fazendo a MESMA conta elementar (`elapsedDays = (now - createdAt)/86400000`) já estabelecida em `engagement-triage.ts`, mas SEM tocar aquele arquivo — é uma leitura nova, isolada, read-only, só para esta tela.

### Fronteira de escopo — NÃO faz (deliberado, confirmado com o Hugo)

- **NÃO cria migration nova. NÃO persiste o "compromisso semanal" em nenhuma tabela.** O botão "Confirmar meu plano" (Seção 5) muda só um `useState` local (`confirmed`) e dispara um toast — não há `fetch`/`POST` para nenhuma API. Isso está comentado explicitamente no código (`meu-plano-client.tsx`, função `confirm()`) e explícito na própria UI ("Este é um plano de exemplo (protótipo): ainda não é salvo no seu perfil."). A decisão de schema (o que persistir, como um "compromisso" vira lembretes/streak) ainda não foi tomada com o Hugo.
- **NÃO inventa a fórmula real de conversão gap→sessões.** `PT_PER_SESSION = 1.5` é a MESMA constante ilustrativa que o mockup isolou, carregada verbatim (com o mesmo aviso) em `study-plan-projection.ts` — documentado como placeholder até o produto definir a fórmula real.

## Acceptance Criteria

- [x] **AC1:** Nova rota real `/meu-plano` (`apps/web/src/app/(platform)/meu-plano/page.tsx`), Server Component, seguindo o MESMO padrão de auth/data-fetching de `dashboard/page.tsx` (`getAuthProfile`, redirect `/login` sem sessão).
- [x] **AC2:** O diagnóstico exibido é REAL do aluno logado, via `computeStudentComparison` (reuso, zero cálculo duplicado) — `subject.progressPct`, `subject.expectedProgressPct`, `subject.reflections`/`reflectionsMax`.
- [x] **AC3:** `daysLeft`/`weeksLeft` calculados a partir de dado real (`enrollments.created_at` + `courses.deadline_days` da matrícula líder), em função nova e isolada — sem editar `engagement-triage.ts`/`area-gestor.ts`.
- [x] **AC4:** As 5 seções do mockup `meu-plano-tela-configuracao.html` estão presentes e fiéis à estrutura: (1) recap do diagnóstico, (2) escolha dos dias (grade de 7, clicável), (3) intensidade (stepper de sessões 1-5 + switch de foco em reflexão), (4) projeção ao vivo (recalcula a cada interação, com veredito colorido), (5) confirmação (linha de compromisso + botão).
- [x] **AC5:** Moldura de página com breadcrumb "‹ Meu ritmo / Montar meu plano", o "‹ Meu ritmo" navega de volta para `/dashboard`.
- [x] **AC6:** Toda a interatividade é React real (`useState`/client component): toggle de dia, stepper de sessões, switch de reflexão e a projeção recomputam ao vivo (`computeStudyPlanProjection`, puro, chamado a cada render via `useMemo`).
- [x] **AC7 (fronteira, crítico):** "Confirmar meu plano" NUNCA dispara `fetch`/`POST` — testado explicitamente (`meu-plano-client.test.tsx`, spy em `globalThis.fetch`). Comentário no código cita que a persistência é fase futura.
- [x] **AC8:** Constante `PT_PER_SESSION = 1.5` reusada verbatim do mockup, isolada em `study-plan-projection.ts`, com o mesmo aviso de que é ilustrativa/placeholder.
- [x] **AC9 (degradação graciosa):** sem `expectedProgressPct` (sem deadline computável) → seções 1/4 mostram "sem meta de ritmo calculável"/verdict `unknown`, nunca crash. Sem `reflectionsMax` → a barra de projeção de reflexão vira um aviso textual, nunca um NaN/crash. Sem diagnóstico algum (`indicators` null) → `MeuPlanoEmptyState` (sem números falsos).
- [x] **AC10:** Ponto de entrada real e navegável a partir do dashboard: link "Montar meu plano de estudo" dentro de `student-home-card.tsx` (o card "Meu ritmo"), alcançável por clique, não só por URL direta.
- [x] **AC11:** Reuso de tokens/componentes já estabelecidos: `@eximia/ui` (`Button`, `Switch`, `Breadcrumb*`) e `formatPctPtBR1` (importado de `comparison-insights-table.tsx`, não reimplementado); cores (`cerrado-600`, `semantic-success/warning/error`, `bg-card`/`bg-elevated`/`border-subtle`) idênticas ao design system real (`theme.css`).
- [x] **AC12:** Sem regressão: suíte de `student-home-card.tsx` (30 testes) 100% verde após adicionar o link de entrada; `tsc`/`biome` limpos.

## Tasks

- [x] 1. Ler os 3 mockups (`meu-plano-semanal-discovery.html`, `meu-plano-semanal-modelo-oficial.html`, `meu-plano-tela-configuracao.html`) na íntegra.
- [x] 2. Ler `docs/stories/epic-student-home/SH-1.5.story.md` até `SH-2.8.story.md` (Change Log) para entender de onde vem o dado de diagnóstico que esta tela consome.
- [x] 3. Achar o padrão real de roteamento/data-fetching do App Router (`dashboard/page.tsx`) e o dado real (`computeStudentComparison`, `/api/analytics/manager-groups?view=student`) — sem reimplementar cálculo.
- [x] 4. Escrever `study-plan-projection.ts` (motor de cálculo puro, ported do `compute()` do mockup, com degradação graciosa) + testes (10, todos verdes).
- [x] 5. Implementar `apps/web/src/app/(platform)/meu-plano/page.tsx` (Server Component, fetch real + fallback de `daysLeft` isolado) + `MeuPlanoEmptyState`.
- [x] 6. Implementar `MeuPlanoClient` (client component, as 5 seções, reuso de `@eximia/ui` + tokens do design system) + testes (10, todos verdes).
- [x] 7. Adicionar o ponto de entrada navegável em `student-home-card.tsx` (link "Montar meu plano de estudo") + confirmar 0 regressão na suíte existente (30/30 verde).
- [x] 8. `tsc --noEmit` (projeto inteiro, 0 erros) + `vitest run` (arquivos tocados/novos) + `biome check` (arquivos tocados/novos), tudo verde.
- [x] 9. Reiniciar o servidor dev (`:3002`) e confirmar visualmente no navegador que `/meu-plano` carrega de verdade.

## Complexidade & Riscos

- **Complexidade:** L (large). Rota nova completa (Server Component + Client Component + motor de cálculo puro + testes em 2 camadas), integrando 2 fontes de dado real (`computeStudentComparison` + uma leitura nova de deadline) sem duplicar nenhum cálculo já existente.
- **Riscos:**
  - R1 (médio, mitigado): confundir "esperado" de progresso com a média da Turma (o mockup, sendo um discovery artifact, usava um número ilustrativo de 68% para progresso que na verdade não bate com o `expectedProgressPct` real do SH-2.7, 33%). Mitigação: a implementação REAL usa `expectedProgressPct` uniformemente para as duas dimensões (a mesma tratativa que `ownPaceSignalFor`/SH-2.7 já dá a Progresso e Reflexões), nunca o número ilustrativo do mockup.
  - R2 (baixo, mitigado): o botão de confirmação "vazar" para uma chamada de API por engano numa refatoração futura. Mitigação: comentário explícito no código + teste dedicado (`vi.spyOn(globalThis, "fetch")`, `not.toHaveBeenCalled()`) que falha se alguém adicionar um `fetch`/`POST` ali sem querer.
  - R3 (baixo, mitigado): `daysLeft` ficar indisponível para alunos sem `deadline_days` computável em nenhuma matrícula. Mitigação: degradação graciosa testada (chip de prazo some, verdict vira `unknown`, mas o resto da tela continua 100% interativo e utilizável).
  - R4 (baixo): a "matrícula líder" para `daysLeft` é decidida por maior progresso, que pode divergir logicamente da matrícula que decide `expectedProgressPct` internamente em `buildStudentHomeIndicators` para alunos com múltiplas trilhas ativas. Aceito conscientemente — mesma heurística documentada no SH-2.7 ("matrícula líder = maior progresso"), sem acesso direto ao valor interno já calculado (que não é exposto por `computeStudentComparison`) sem duplicar a leitura de `deadlineByCourse`.

## Dev Notes

- **Arquivos novos:**
  - `apps/web/src/lib/analytics/study-plan-projection.ts` — motor de cálculo puro (sem I/O).
  - `apps/web/src/lib/analytics/__tests__/study-plan-projection.test.ts`
  - `apps/web/src/app/(platform)/meu-plano/page.tsx` — Server Component (fetch real, sem duplicar cálculo).
  - `apps/web/src/app/(platform)/meu-plano/_components/meu-plano-client.tsx` — client component, as 5 seções.
  - `apps/web/src/app/(platform)/meu-plano/_components/meu-plano-empty-state.tsx` — fallback sem diagnóstico.
  - `apps/web/src/app/(platform)/meu-plano/_components/__tests__/meu-plano-client.test.tsx`
- **Arquivo modificado:** `apps/web/src/components/analytics/student-home-card.tsx` (1 link novo, "Montar meu plano de estudo" → `/meu-plano`; nenhuma outra linha tocada).
- **NÃO tocado:** `engagement-triage.ts`, `area-gestor.ts`, `student-home-indicators.ts`, `types/analytics.ts`, `comparison-insights-table.tsx` (só IMPORTADO, `formatPctPtBR1`, nunca modificado), qualquer migration/schema.
- **Fronteira de escopo (repetido aqui de propósito, é o ponto mais crítico da story):** o "compromisso semanal" desta tela é 100% local/efêmero (React state). Não existe tabela nova, não existe `INSERT`/`UPDATE`, não existe chamada de rede ao confirmar. A próxima fase (fora do escopo desta story) decide o schema de persistência com o Hugo.

## Testing

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2/apps/web
npx tsc --noEmit
npx vitest run src/lib/analytics/__tests__/study-plan-projection.test.ts "src/app/(platform)/meu-plano" src/components/analytics/__tests__/student-home-card.test.tsx
npx biome check src/lib/analytics/study-plan-projection.ts src/lib/analytics/__tests__/study-plan-projection.test.ts "src/app/(platform)/meu-plano/page.tsx" "src/app/(platform)/meu-plano/_components/meu-plano-client.tsx" "src/app/(platform)/meu-plano/_components/meu-plano-empty-state.tsx" "src/app/(platform)/meu-plano/_components/__tests__/meu-plano-client.test.tsx" src/components/analytics/student-home-card.tsx
```

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-20 | Story criada e implementada a partir de 3 mockups já validados pelo Hugo (`JARVIS/apps/hub-discovery/meu-plano-*.html`). Nova rota real `/meu-plano` (Server Component + Client Component), com diagnóstico REAL do aluno logado via `computeStudentComparison` (reuso, sem duplicar cálculo — `expectedProgressPct` do SH-2.7, `reflectionsMax` do SH-1.5). Motor de projeção puro (`study-plan-projection.ts`) portando o `compute()` do mockup, com a MESMA constante ilustrativa (`PT_PER_SESSION=1.5`) e degradação graciosa (sem deadline/denominador → `null`, nunca crash). Ponto de entrada real adicionado em `student-home-card.tsx`. Fronteira de escopo respeitada: NENHUMA persistência nova, "Confirmar meu plano" é 100% estado local (testado explicitamente que não chama `fetch`). `tsc` exit 0 (projeto inteiro); 20 testes novos verdes (10 do motor de cálculo + 10 do client component); suíte de `student-home-card.tsx` (30 testes) sem regressão. | J.A.R.V.I.S. (@dev, terminal Maestri "Oficial") |

## Dev Agent Record

### Contexto de execução

Pedido do Hugo (fundador), via Capataz Maestri: transformar os 3 mockups HTML (já discutidos e validados numa rodada de discovery anterior) em rota real navegável no `eximia-academy-v2`, com diagnóstico real, e fronteira EXPLÍCITA de não-persistência (a decisão de schema para o "compromisso semanal" ainda não foi tomada com o Hugo). Os 3 mockups e o Change Log completo do SH-1.5 até SH-2.8 foram lidos por completo antes de qualquer código.

### Achados durante a implementação

- **O mockup usava dois números "esperado" diferentes (68% pra progresso, 33% pra reflexão) que não correspondem à mesma fonte real.** Investigando o Change Log do SH-2.7, ficou claro que o dado real do Rinaldo tem UM único `expectedProgressPct` (33%, elapsedDays/deadlineDays), reusado uniformemente para Progresso E Reflexões pelo `ownPaceSignalFor` já existente — o "68%" do mockup era um artefato ilustrativo do discovery (provavelmente confundido com a média da Turma, 67%), não o algoritmo real. Decisão: a implementação real usa `expectedProgressPct` para as DUAS dimensões, o mesmo tratamento que o código de produção já dá, em vez de inventar uma segunda régua "68%" que não existe em lugar nenhum do backend.
- **`computeStudentComparison` já é exatamente a função que alimenta a tabela "Meu ritmo" hoje** (mesma usada por `/api/analytics/manager-groups?view=student`) — importável diretamente num Server Component, sem precisar fazer um fetch HTTP para a própria API (evita round-trip desnecessário e mantém o padrão de outras páginas SSR do dashboard).
- **`daysLeft` não vem pronto em nenhum campo existente** — só o `expectedProgressPct` (já arredondado/percentual) é exposto. Calculá-lo exigiu uma leitura NOVA e isolada (mesma tabela/colunas que `engagement-triage.ts` já lê internamente, mas sem tocar aquele arquivo), replicando a mesma heurística de "matrícula líder" já documentada no SH-2.7 para escolher QUAL enrollment usar quando o aluno tem mais de uma trilha.
- **`formatPctPtBR1`/`fractionPctOf` já estavam exportados de `comparison-insights-table.tsx`** (desde SH-2.7.1) especificamente para reuso cross-arquivo — importados diretamente em vez de reimplementar formatação de percentual brasileiro.

### File List

- `apps/web/src/lib/analytics/study-plan-projection.ts` (novo)
- `apps/web/src/lib/analytics/__tests__/study-plan-projection.test.ts` (novo)
- `apps/web/src/app/(platform)/meu-plano/page.tsx` (novo)
- `apps/web/src/app/(platform)/meu-plano/_components/meu-plano-client.tsx` (novo)
- `apps/web/src/app/(platform)/meu-plano/_components/meu-plano-empty-state.tsx` (novo)
- `apps/web/src/app/(platform)/meu-plano/_components/__tests__/meu-plano-client.test.tsx` (novo)
- `apps/web/src/components/analytics/student-home-card.tsx` (modificado — 1 link novo)
- `docs/stories/epic-student-home/SH-3.1.story.md` (novo)
