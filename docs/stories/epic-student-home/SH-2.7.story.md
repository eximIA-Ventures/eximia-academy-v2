# SH-2.7: Freio absoluto de ritmo esperado no tom `win`

**Epic:** [EPIC-STUDENT-HOME](./EPIC-STUDENT-HOME.md)
**Status:** InReview
**Depende de:** SH-2.5 (modelo de 4 tons win/tie/behind/none), SH-2.6 (tom geral do painel), e principalmente **SH-2.4 (Prisma)** — auditoria que já mapeou e recomendou este exato achado (ver Dev Notes §Origem).
**Bloqueia:** nenhuma story aberta.
**Paralelizável:** rodou sozinha, terminal único, a partir de feedback ao vivo do Hugo olhando o app com os fixes SH-2.1 até SH-2.6 já em produção. Não paraleliza com trabalho concorrente em `engagement-triage.ts`/`student-home-indicators.ts`/`comparison-insights-table.tsx`.

---

## Story

**As a** Hugo (fundador, dono do produto), olhando a linha Reflexões do Rinaldo (8/41 ≈19,5%, vs Turma 4/41 ≈9,75%, lendo "win" verde "acima da média"),
**I want** que o tom `win` das linhas Progresso/Interações/Reflexões exija estar TANTO acima da Turma QUANTO dentro do PRÓPRIO ritmo esperado da trilha — nunca só um dos dois,
**so that** "vencer uma Turma fraca" pare de ser confundido com "estar bem de verdade": 8 reflexões não merecem elogio se o aluno já deveria ter feito muito mais a esta altura da trilha, mesmo que a Turma inteira esteja pior ainda.

## Contexto (Dev Notes)

### Origem — achado já mapeado pela SH-2.4 (Prisma), agora implementado

A [SH-2.4](./SH-2.4.story.md) (auditoria pura, sem código, terminal "Prisma") já tinha encontrado e documentado EXATAMENTE este gap: `engagement-triage.ts`, função `computeBehindAndProgress` (linhas ~46-70), já calculava um sinal de "ritmo esperado" (`expectedPct = elapsedDays/deadlineDays × 100`, comparado a `pct` atual) para decidir o booleano `behind` que alimenta `paceByStudent`/`ritmoDisplay` — mas esse número era **descartado** antes de chegar nas linhas Progresso/Interações/Reflexões da tabela "Meu ritmo", que seguiam 100% relativas (só Você vs Turma). A Prisma recomendou propagar esse sinal como proposta para uma story futura (SH-2.4 Dev Notes §Propostas, item 1), sem implementar (aprovação do Hugo na época: "sem correções agora"). Esta story implementa exatamente essa proposta, generalizada das 3 linhas (Progresso, Interações, Reflexões — a proposta original da Prisma cobria só Progresso; o pedido do Hugo desta rodada, validado com o caso real das Reflexões do Rinaldo, estende às 3).

### O caso Rinaldo — motivação, evidência REAL (não fixture sintética)

O Hugo: *"a questão é que o Rinaldo não pode ser elogiado pois ele só fez 8 reflexões"* — 8/41 (~19,5%) contra uma Turma de 4/41 (~9,75%). Isso hoje lê `win` verde "acima da média". Rejeitado: vencer uma Turma ruim não é o mesmo que estar bem de verdade.

**Dado real, lido diretamente do Supabase (tenant CORY, produção, leitura read-only, 2026-07-19)** — não simulado:
- Rinaldo, matrícula ativa no curso "Análise e Solução de Problemas" (`4711c03e-6f91-4b28-80cf-047cd607d04b`).
- `enrollments.created_at`: `2026-05-21T23:05:25.612666+00:00`.
- `courses.deadline_days`: `180`.
- `enrollments.progress.percentage`: `50`.
- Reflexões reais (`slide_reflections` do aluno): `8`.
- No momento da leitura (`now` = `2026-07-19T16:33:23.095Z`): `elapsedDays ≈ 58,7`, `expectedPct = round(58,7/180 × 100) = 33`.

**19,5% (Reflexões) < 33% (ritmo esperado) → CONFIRMADO: abaixo do próprio ritmo, mesmo vencendo a Turma.** Este número real foi usado diretamente num teste de reprodução (`comparison-insights-table.test.tsx`, describe "reprodução real do caso Rinaldo") — não uma fixture inventada.

Progresso, para contraste: 50% (Você) ≥ 33% (esperado) → dentro do próprio ritmo. Mas 50% < 67% (Turma, valor do caso Rinaldo já usado nas stories SH-2.5/2.6) → já é `behind` no relativo, então o freio nem entra em jogo ali (só atua quando o aluno VENCE a Turma).

### Correção aplicada

**1) `engagement-triage.ts` (`computeBehindAndProgress`)** — o `expectedPct` que já era calculado por matrícula passou a ser propagado como `expectedPctByStudent: Map<string, number>` (campo aditivo no retorno), atrelado à MESMA matrícula "líder" que decide `progressByStudent` (o maior % entre os cursos do aluno). Proteção contra staleness: se a trilha líder mudar para uma sem `deadline_days` computável, a entrada anterior é REMOVIDA (nunca fica com o valor de uma trilha que deixou de ser a líder).

**2) `student-home-indicators.ts`** — `expectedPctByStudent.get(studentId)` propagado para `subject.expectedProgressPct` (novo campo opcional em `StudentHomeSubject`).

**3) `comparison-insights-table.tsx` (o freio em si)**:
- `buildRows` calcula `ownPaceOk` para as 3 linhas relevantes: Progresso compara `s.progressPct` diretamente com `s.expectedProgressPct`; Interações e Reflexões convertem a própria fração (`interactions/interactionsMax`, `reflections/reflectionsMax`) em % e comparam com o MESMO `expectedProgressPct` (a mesma pergunta — "quanto da trilha já deveria estar feito" — aplicada uniformemente às 3 métricas fracionárias). `undefined` quando falta trilha/deadline/denominador (degrada para o comportamento puramente relativo de sempre).
- Nova função pura `effectiveWinnerFor(winner, ownPaceOk)`: rebaixa `"subject"` (venceu a Turma) para `null` quando `ownPaceOk === false`. NUNCA cria um `"reference"` — a regra só CONTÉM elogio indevido, nunca piora quem já está atrás da Turma.
- `leituraFor` ganha o parâmetro `ownPaceOk`, usado internamente via `effectiveWinnerFor`; quando o freio rebaixa o resultado, a leitura usa uma copy PRÓPRIA e honesta (`LEITURA_COPY[key].capped`, "acima da turma, mas abaixo do seu ritmo esperado") em vez do "no ritmo da turma" genérico — que seria factualmente falso (ele não está "no ritmo da turma", está ACIMA dela).
- `Engajamento` e `Última sessão de estudo` NUNCA recebem `ownPaceOk` de `buildRows` — o freio é, por desenho, impossível de disparar nessas 2 linhas (parâmetro sempre `undefined` na chamada).

### Degradação graciosa (requisito 5)

Sem matrícula ativa, sem `deadline_days` no curso, ou sem denominador (`interactionsMax`/`reflectionsMax` ausente/zero) → `expectedProgressPct`/`ownPaceOk` ficam `undefined` em toda a cadeia → `effectiveWinnerFor` devolve o `winner` original intocado → comportamento IDÊNTICO ao pré-SH-2.7 (100% relativo). Coberto por testes dedicados nos 3 arquivos tocados.

## Acceptance Criteria

- [x] **AC1:** `computeBehindAndProgress` retorna `expectedPctByStudent: Map<string, number>`, atrelado à matrícula líder (mesma que decide `progressByStudent`), sem staleness quando a líder muda para uma sem deadline computável.
- [x] **AC2:** `subject.expectedProgressPct` (StudentHomeSubject, novo campo opcional) recebe esse valor via `buildStudentHomeIndicators`.
- [x] **AC3:** O freio se aplica às linhas Progresso, Interações e Reflexões — nunca a Última sessão de estudo (leitura própria, SH-2.5 item 3) nem a Engajamento (derivado, nunca recebe `ownPaceOk`).
- [x] **AC4:** `win` só ocorre quando o aluno vence a Turma (`winnerOf`) E está dentro/acima do próprio ritmo esperado (`ownPaceOk !== false`). Vencendo a Turma mas abaixo do próprio ritmo → tom cai para `tie`, nunca fica `win`.
- [x] **AC5:** O freio NUNCA piora um resultado já `behind` (atrás da Turma) — `effectiveWinnerFor` só rebaixa `"subject"`, nunca cria `"reference"`.
- [x] **AC6 (validação obrigatória, dado real):** Reflexões do Rinaldo, 8/41 (~19,5%) vs Turma 4/41 (~9,75%), com `expectedProgressPct = 33` (elapsedDays≈58,7/deadlineDays=180 REAIS, lidos do Supabase) → tom da linha deixa de ser `win`, vira `tie`. Reproduzido em teste com os números reais, não fixture sintética.
- [x] **AC7 (degradação graciosa):** sem `deadline_days` computável, sem matrícula ativa, ou sem denominador de fração → `expectedProgressPct`/`ownPaceOk` ficam `undefined`, comportamento idêntico ao pré-SH-2.7 (sem crash, sem trava).
- [x] **AC8:** Sem regressão: suíte completa (`src/components/analytics` + `src/lib/analytics`, mais `src/lib/notifications` por cautela extra já que `engagement-triage.ts` foi tocado) 100% verde.

## Tasks

- [x] 1. Ler `docs/stories/epic-student-home/SH-2.4.story.md` (achado da Prisma) por completo antes de implementar — confirmado: a proposta 1 (Progresso) já estava lá, generalizada aqui para as 3 linhas fracionárias a pedido do Hugo.
- [x] 2. Ler `engagement-triage.ts` completo, entender o formato exato de `behind`/`paceByStudent`/`expectedPct` (já calculado, antes descartado).
- [x] 3. Consultar o Supabase real (tenant CORY, leitura read-only) para obter os dados EXATOS do Rinaldo (enrollment, deadline, reflexões) — sem isso o caso de validação seria uma simulação, não uma reprodução.
- [x] 4. Propagar `expectedPctByStudent` em `computeBehindAndProgress` (aditivo, com proteção de staleness pela trilha líder).
- [x] 5. Propagar `subject.expectedProgressPct` em `buildStudentHomeIndicators`/`StudentHomeSubject`.
- [x] 6. Implementar `effectiveWinnerFor`/o freio em `leituraFor`, `ownPaceOk` em `buildRows` (Progresso/Interações/Reflexões), copy `capped` honesta em `LEITURA_COPY`.
- [x] 7. Testes: `computeBehindAndProgress` (dado real do Rinaldo + degradação graciosa + staleness), `buildStudentHomeIndicators` (propagação + degradação), `effectiveWinnerFor`/`leituraFor` (freio puro) e reprodução end-to-end via `ComparisonInsightsTable` com os números reais do Rinaldo.
- [x] 8. `tsc --noEmit` + `vitest run src/components/analytics src/lib/analytics` (+ `src/lib/notifications` por cautela) + `biome check` nos arquivos tocados, tudo verde.

## Complexidade & Riscos

- **Complexidade:** L (large). Propagação de um sinal através de 3 arquivos em 2 camadas (engine → indicators → tabela), mais uma decisão de design não-trivial (como generalizar "ritmo esperado", uma % baseada em tempo/progresso, para métricas de CONTAGEM como interações/reflexões — resolvida tratando-as como fração/% da própria trilha, mesma régua do progresso).
- **Riscos:**
  - R1 (alto, mitigado): o freio piorar um resultado que já era `behind` (puniria duas vezes). Mitigação: `effectiveWinnerFor` só atua sobre `winner === "subject"`, nunca cria `"reference"` — testado explicitamente (AC5).
  - R2 (alto, mitigado): confundir "líder de progresso" com "líder de ritmo esperado" quando o aluno tem múltiplas matrículas, deixando `expectedPctByStudent` com um valor obsoleto de uma trilha que não é mais a líder. Mitigação: `expectedPctByStudent` é explicitamente DELETADO quando a trilha líder muda para uma sem deadline computável — testado (`SH-2.7 ... sem valor obsoleto`).
  - R3 (médio, mitigado): validar com dado sintético em vez de real, mascarando um erro de cálculo que só apareceria com números reais (ex.: fuso horário, arredondamento). Mitigação: consulta real ao Supabase ANTES de escrever qualquer teste, números exatos copiados para o teste, não recalculados "de cabeça".
  - R4 (baixo): a copy `capped` genérica demais (mesma frase para as 3 linhas). Decisão consciente — o CONCEITO ("acima da turma, mas abaixo do seu ritmo esperado") é idêntico nas 3, reusar evita 3 variações artificiais do mesmo fato.

## Dev Notes

- **Arquivos de produção tocados:** `apps/web/src/lib/notifications/engagement-triage.ts`, `apps/web/src/lib/analytics/student-home-indicators.ts`, `apps/web/src/types/analytics.ts` (campo novo), `apps/web/src/components/analytics/comparison-insights-table.tsx`.
- **Arquivos de teste tocados:** `apps/web/src/lib/notifications/__tests__/engagement-triage.test.ts`, `apps/web/src/lib/analytics/__tests__/student-home-indicators.test.ts`, `apps/web/src/components/analytics/__tests__/comparison-insights-table.test.tsx`.
- **NÃO tocado:** `ritmo-summary.ts` — o freio é uma propriedade da LEITURA por linha (`leituraFor`), que `rowTonesOf`/`summaryToneOf` já consomem via `leituraFor`/`recencyReadingFor`; como as chamadas de `rowTonesOf` para progress/sessions/reflections não passam `ownPaceOk`, o painel-resumo **não herda o freio automaticamente** nesta story — decisão consciente de escopo (o pedido do Hugo foi especificamente sobre a TABELA "Meu ritmo"; propagar o freio ao painel-resumo também fica como candidato a story futura, não implementado aqui para não expandir escopo além do pedido).
- **Como o Supabase real foi consultado:** scripts Node ad-hoc (fetch direto à REST API do Supabase com `SUPABASE_SERVICE_ROLE_KEY`, mesmo padrão de `scripts/fix-progress.mjs` já existente no repo), executados fora do repositório (`/tmp`), somente leitura (`GET`, nunca `PATCH`/`POST`) — nenhuma alteração de dado de produção.

## Testing

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2/apps/web
npx tsc --noEmit
npx vitest run src/components/analytics src/lib/analytics src/lib/notifications
npx biome check src/lib/notifications/engagement-triage.ts src/lib/notifications/__tests__/engagement-triage.test.ts src/lib/analytics/student-home-indicators.ts src/lib/analytics/__tests__/student-home-indicators.test.ts src/components/analytics/comparison-insights-table.tsx src/components/analytics/__tests__/comparison-insights-table.test.tsx src/types/analytics.ts
```

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-19 | Story criada e implementada a partir de achado ao vivo do Hugo (caso Rinaldo, Reflexões 8/41 lendo "win" indevido) e da recomendação já mapeada pela SH-2.4/Prisma. `computeBehindAndProgress` (`engagement-triage.ts`) passa a propagar `expectedPctByStudent` (antes descartado), atrelado à trilha líder com proteção contra staleness. `subject.expectedProgressPct` propagado via `student-home-indicators.ts`. Novo freio absoluto em `comparison-insights-table.tsx`: `effectiveWinnerFor` rebaixa "subject" (venceu a Turma) para tie quando `ownPaceOk === false`, aplicado só a Progresso/Interações/Reflexões (nunca Última sessão de estudo/Engajamento), com copy honesta `capped` ("acima da turma, mas abaixo do seu ritmo esperado"). Validado com dado REAL do Supabase (tenant CORY, leitura read-only, 2026-07-19): Rinaldo, Reflexões 8/41 (19,5%) vs ritmo esperado real 33% (elapsedDays≈58,7/deadlineDays=180) → deixou de ler "win", passou a ler "tie". Degradação graciosa testada (sem deadline/matrícula/denominador). `tsc` exit 0; 406/406 testes verdes (analytics + notifications); `biome check` limpo. | J.A.R.V.I.S. (@dev, terminal único consolidado) |

## Dev Agent Record

### Contexto de execução

Achado trazido diretamente pelo Hugo a partir de observação ao vivo, com uma pista explícita para não reinvestigar do zero: a SH-2.4 (Prisma) já tinha mapeado a causa raiz e proposto exatamente esta correção, sem implementá-la (aprovação anterior do Hugo foi "sem correções agora" — agora era a hora). Story lida por completo antes de qualquer edição.

### Achados durante a implementação

- **`expectedPct` já existia, mas por MATRÍCULA, não por aluno.** `computeBehindAndProgress` processa um array de `enrollments` (potencialmente várias por aluno) e só usava o sinal para decidir um SET booleano (`behind`), nunca precisou consolidar um único número por aluno. Propagar como `Map<string, number>` exigiu decidir QUAL matrícula "vence" quando há mais de uma — resolvido atrelando à mesma matrícula que já decide `progressByStudent` (o maior %), com remoção explícita da entrada quando essa matrícula líder muda para uma sem deadline computável (bug de staleness identificado e corrigido ANTES de escrever qualquer teste, não descoberto por um teste falhando).
- **Generalizar "ritmo esperado" para Interações/Reflexões exigiu uma decisão de design não pedida explicitamente em número:** o Hugo pediu o freio "no ritmo esperado" sem especificar a fórmula para métricas de contagem (não-percentuais). Decisão: tratar `interactions/interactionsMax` e `reflections/reflectionsMax` como % da trilha, na MESMA régua de `expectedProgressPct` (que já é % de tempo decorrido) — validada numericamente pelo próprio caso do Rinaldo (19,5% vs 33%, ambos em %, comparáveis diretamente).
- **A consulta real ao Supabase revelou que Rinaldo tem múltiplos "chapéus"** (`role: "manager"` no `users`, mas com matrícula de aluno) — o MESMO padrão "multi-chapéu" (Caio Pinheiro) já documentado em `engagement-triage.ts`/`area-gestor.ts` (BUG-1). Não exigiu nenhum tratamento especial aqui (a query usada foi direta por `student_id`, sem depender de `role`), mas confirma que o padrão de dados reais do CORY é consistentemente multi-chapéu — relevante para quem for validar esta story manualmente no app.
- **A degradação graciosa (AC7) não precisou de nenhum código defensivo NOVO** além do que `ownPaceOkFor`/`fractionPctOf` já fazem por construção (`undefined`/`null` em cascata) — o design de "undefined propaga undefined" tornou a degradação graciosa uma CONSEQUÊNCIA do desenho, não um caso especial tratado à parte.

### File List

- `apps/web/src/lib/notifications/engagement-triage.ts` (modificado)
- `apps/web/src/lib/notifications/__tests__/engagement-triage.test.ts` (modificado)
- `apps/web/src/lib/analytics/student-home-indicators.ts` (modificado)
- `apps/web/src/lib/analytics/__tests__/student-home-indicators.test.ts` (modificado)
- `apps/web/src/types/analytics.ts` (modificado)
- `apps/web/src/components/analytics/comparison-insights-table.tsx` (modificado)
- `apps/web/src/components/analytics/__tests__/comparison-insights-table.test.tsx` (modificado)
- `docs/stories/epic-student-home/SH-2.7.story.md` (novo)

---

## SH-2.7.1 — Copy quantificada do freio + correção de `behindMetricsOf` (2026-07-20)

Round seguinte ao SH-2.7 original, mesmo dia de feedback ao vivo do Hugo olhando o app já com o freio em produção. 2 ajustes, mesmo escopo (Rinaldo/Reflexões), por isso registrados como seção nova nesta story em vez de uma SH-2.8 separada — são refinamentos DIRETOS do freio recém-implementado, não um achado novo e independente.

### Item 1 — copy do chip com o número real, não a frase abstrata

**Antes:** quando o freio rebaixava win→tie, o chip mostrava um texto genérico fixo, igual para as 3 linhas: "acima da turma, mas abaixo do seu ritmo esperado".

**Depois:** o chip cita o percentual REAL do próprio aluno naquela linha: **"Acima da turma, mas apenas {N}% do seu potencial"**, `N = subject/subjectMax × 100`, arredondado a 1 casa decimal, formato brasileiro (vírgula). Exemplo real (Rinaldo, Reflexões 8/41): **"Acima da turma, mas apenas 19,5% do seu potencial"**.

**Implementação:** `OwnPaceSignal` (antes um `boolean` solto, `ownPaceOk`) passou a carregar também `actualPct` — o mesmo % que decide `ok`, agora também disponível para a copy. `LEITURA_COPY[key].capped` (texto fixo por `RowKey`) foi REMOVIDO — a copy do freio deixou de ser por-chave e virou uma função pura `ownPaceCappedText(actualPct)`, chamada genericamente em `leituraFor` sempre que `rawWinner === "subject" && ownPace?.ok === false`, independente da linha. `formatPctPtBR1` (1 casa decimal, vírgula) e `ownPaceSignalFor`/`fractionPctOf` foram exportados de `comparison-insights-table.tsx` para reuso no item 2.

### Item 2 — `behindMetricsOf` citava a métrica errada na frase de oportunidade

**Bug confirmado:** no screenshot do Hugo, o painel dizia "Sua oportunidade de melhoria é evoluir em progresso" — mas a linha de fato sinalizada pelo freio (âmbar) era Reflexões. Causa raiz: `behindMetricsOf` (`ritmo-summary.ts`) só checava `winnerOf` CRU (pré-freio) — para Reflexões, `winnerOf` retornava `"subject"` (venceu a Turma no relativo), então a linha NUNCA entrava na lista de "precisa de atenção", mesmo depois do freio (SH-2.7) já rebaixar essa mesma linha para `tie` na tabela. Progresso entrava na lista porque estava genuinamente atrás da Turma (winner `"reference"`, sem relação com o freio) — coincidência que mascarava o bug: a frase "parecia" certa por citar UMA métrica real, só que não a que o Hugo estava olhando âmbar na tela.

**Correção:** uma métrica agora "precisa de atenção" (entra na lista de `behindMetricsOf`, mesmo contrato de sempre, `BehindMetric[]`) quando está genuinamente atrás da Turma (`winnerOf === "reference"`) **OU** quando venceu a Turma mas foi rebaixada pelo freio (`ownPaceSignalFor(...).ok === false`) — as MESMAS duas condições que produzem tom `behind`/`tie-por-freio` na tabela, reusando `ownPaceSignalFor`/`fractionPctOf` (nunca recalculando a % à parte). Um helper interno (`metricSignalsOf`) computa os 2 sinais UMA vez por indicador e alimenta tanto `behindMetricsOf` (labels) quanto a frase de oportunidade (que precisa também do `actualPct` quando a métrica é capped).

**Linguagem quantificada na frase (decisão de julgamento, conforme pedido):** métricas capped pelo freio ganham a MESMA linguagem quantificada do chip (item 1), em parênteses — ex.: "reflexões (você está em 19,5% do potencial)". Métricas genuinamente atrás da Turma (sem relação com o freio) continuam citadas SEM número, como sempre (não têm um "% do potencial" a mostrar — o problema delas é comparativo, não de ritmo absoluto). Caso Rinaldo, frase final: **"Sua oportunidade de melhoria é evoluir em progresso e reflexões (você está em 19,5% do potencial)."**

### Caso de validação (dado real do Rinaldo, reusado do SH-2.7)

Mesma matrícula real (Supabase, tenant CORY): Progresso 50% vs Turma 67% (genuinamente atrás); Reflexões 8/41 (~19,5%) vs Turma 4/41 (capped pelo freio, ritmo esperado real 33%). Confirmado:
- `behindMetricsOf(rinaldo)` → `["progresso", "reflexões"]` (antes: só `["progresso"]`).
- Frase de oportunidade cita as 2, com reflexões quantificada.
- `summaryToneOf(rinaldo)` → `"tie"` (só progresso conta como "behind" de verdade para a proporção da SH-2.6; reflexões capped é "tie", não soma ao vermelho).
- Abertura do painel usa o ramo "tie com ponto de atenção" (SH-2.6), nunca o "behind" direto nem o elogio isolado de engajamento.

### Testing

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2/apps/web
npx tsc --noEmit
npx vitest run src/components/analytics src/lib/analytics
npx biome check src/components/analytics/comparison-insights-table.tsx src/components/analytics/__tests__/comparison-insights-table.test.tsx src/lib/analytics/ritmo-summary.ts src/lib/analytics/__tests__/ritmo-summary.test.ts
```

### Change Log (SH-2.7.1)

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-20 | Item 1: `OwnPaceSignal` passa a carregar `actualPct` junto com `ok`; `LEITURA_COPY[key].capped` (texto fixo) removido, substituído por `ownPaceCappedText(actualPct)` — copy do freio agora cita o % real ("Acima da turma, mas apenas {N}% do seu potencial"), 1 casa decimal, formato brasileiro. Item 2: `behindMetricsOf` corrigido para considerar o resultado FINAL pós-freio (genuinamente atrás OU capped), não mais só `winnerOf` cru — caso Rinaldo passa a citar "reflexões" (capped) junto com "progresso" (genuinamente atrás), com a frase de oportunidade usando a mesma linguagem quantificada do item 1 para métricas capped. `formatPctPtBR1`/`ownPaceSignalFor`/`fractionPctOf` exportados de `comparison-insights-table.tsx` para reuso em `ritmo-summary.ts`, sem duplicar a lógica. Validado com o MESMO dado real do Rinaldo (Supabase, tenant CORY). `tsc` exit 0; 366/366 testes verdes (analytics) + 45/45 (notifications, confirmado sem regressão apesar de não tocado nesta rodada); `biome check` limpo nos 4 arquivos tocados. | J.A.R.V.I.S. (@dev, terminal único consolidado) |

### File List (SH-2.7.1)

- `apps/web/src/components/analytics/comparison-insights-table.tsx` (modificado)
- `apps/web/src/components/analytics/__tests__/comparison-insights-table.test.tsx` (modificado)
- `apps/web/src/lib/analytics/ritmo-summary.ts` (modificado)
- `apps/web/src/lib/analytics/__tests__/ritmo-summary.test.ts` (modificado)
- `docs/stories/epic-student-home/SH-2.7.story.md` (modificado — esta seção)

---

## SH-2.7.2 — Abertura tie separa cada métrica com o próprio número (2026-07-20)

Última rodada de copy desta story, aprovada pelo Hugo, mesmo dia de feedback ao vivo. Reescreve a abertura do painel-resumo para o caso `tie` com ponto de atenção (SH-2.6/2.7 combinados) — registrada como seção nova nesta story pelo mesmo critério da SH-2.7.1 (refinamento direto do mesmo ramo, mesmo caso Rinaldo, não um achado independente).

### O problema

A abertura `tie` (SH-2.6) mais a frase de oportunidade quantificada (SH-2.7.1) produziam: **"Rinaldo, seu ritmo está bom, com um ponto de atenção. Sua oportunidade de melhoria é evoluir em progresso e reflexões (você está em 19,5% do potencial)."** — o problema: o "19,5%" é o percentual REAL só da reflexão (capped pelo freio), mas a frase o amarra a uma LISTA de duas métricas ("progresso e reflexões"), lendo como se 19,5% valesse para as duas. Progresso está genuinamente atrás da Turma (50 vs 67) por um motivo totalmente diferente (comparativo, não de ritmo absoluto) — não tem relação nenhuma com aquele número.

### A correção

A abertura `tie` com ponto de atenção passou a compor a mensagem inteira (`tieAttentionSummary`, `ritmo-summary.ts`), separando CADA métrica sinalizada com o PRÓPRIO número, em vez do `opportunity` genérico (que segue intocado para os outros ramos — win/behind/neutro):

> "{Nome}, seu ritmo geral está bom, mas hoje o ponto real de atenção é {métrica mais crítica}: você está em apenas {N}% do potencial [ou "da média da turma", se a métrica não foi capped pelo freio, e sim genuinamente atrás]. {Métrica secundária, se houver} também pede atenção, {o MESMO texto que o chip "Como estou" daquela linha já mostra}."

- **Ranking da "mais crítica":** `metricSignalsOf` ganhou `achievementPct` por métrica — `cappedPct` (freio) quando a métrica venceu a Turma mas ficou abaixo do próprio ritmo esperado, ou `subject/reference×100` quando genuinamente atrás da Turma (sem freio). A métrica com MENOR `achievementPct` (maior distância) entra na 1ª frase. As duas réguas medem coisas ligeiramente diferentes (distância do próprio potencial vs. distância da Turma), mas ambas respondem "quanto do esperado o aluno alcançou" — comparáveis o bastante para decidir qual pesa mais, sem inventar uma 3ª régua.
- **Reuso, não invenção, na 2ª frase:** `metricSignalsOf` também ganhou `chipText`, computado chamando o MESMO `leituraFor`/`recencyReadingFor` que a tabela usa para aquela linha — a 2ª frase cita literalmente o texto do chip (ex.: `LEITURA_COPY.progress.behind` = "1 sessão te recoloca no ritmo"), nunca uma paráfrase nova.
- **1 métrica só → 1 frase só:** com só 1 métrica sinalizada, `tieAttentionSummary` devolve só a 1ª frase (regra explícita do Hugo).
- **Cláusula "atividades recentes" removida do painel inteiro:** a cláusula solta `você se mantém ativo com atividades recentes` (`recencyReadingFor` em `buildRitmoSummary`) foi removida — não só do ramo tie, do painel inteiro — por pedido explícito do Hugo ("enchimento residual de uma versão anterior do painel, não agrega nada").

### Caso de validação (dado real do Rinaldo, mesmo fixture da SH-2.7 e SH-2.7.1)

Progresso 50% vs Turma 67% (genuinamente atrás, achievementPct≈74,6%); Reflexões 8/41≈19,5% vs ritmo esperado real 33% (capped pelo freio, achievementPct≈19,5%). Reflexões é a mais crítica (19,5% < 74,6%) → entra na 1ª frase; Progresso entra na 2ª, reusando a copy do chip. Frase final exata, confirmada por teste (`toBe`, não só `toContain`):

> **"Rinaldo, seu ritmo geral está bom, mas hoje o ponto real de atenção é reflexões: você está em apenas 19,5% do potencial. Progresso também pede atenção, 1 sessão te recoloca no ritmo."**

### Testing

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2/apps/web
npx tsc --noEmit
npx vitest run src/components/analytics src/lib/analytics
npx biome check src/lib/analytics/ritmo-summary.ts src/lib/analytics/__tests__/ritmo-summary.test.ts
```

Resultado: `tsc` exit 0; 369/369 testes verdes (analytics); `biome check` limpo nos 2 arquivos tocados.

### Change Log (SH-2.7.2)

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-20 | Abertura `tie` com ponto de atenção (SH-2.6) reescrita: `tieAttentionSummary` compõe a mensagem inteira separando cada métrica sinalizada com o PRÓPRIO número (`achievementPct` em `metricSignalsOf`, decide a mais crítica), no lugar da frase de oportunidade genérica (que amarrava um % só a uma lista de várias métricas). 2ª frase reusa literalmente o texto do chip da linha (`chipText`, via `leituraFor`/`recencyReadingFor`), nunca inventa copy nova. Com 1 métrica só, só a 1ª frase. Cláusula solta "você se mantém ativo com atividades recentes" removida do painel inteiro (não só do tie). Validado com o MESMO dado real do Rinaldo (Supabase, tenant CORY): frase final exata "Rinaldo, seu ritmo geral está bom, mas hoje o ponto real de atenção é reflexões: você está em apenas 19,5% do potencial. Progresso também pede atenção, 1 sessão te recoloca no ritmo." 3 asserções antigas (SH-2.6/2.7.1) que citavam a redação anterior foram atualizadas para a nova estrutura, sem perder cobertura. `tsc` exit 0; 369/369 testes verdes; `biome check` limpo. | J.A.R.V.I.S. (@dev, terminal único consolidado) |

### File List (SH-2.7.2)

- `apps/web/src/lib/analytics/ritmo-summary.ts` (modificado)
- `apps/web/src/lib/analytics/__tests__/ritmo-summary.test.ts` (modificado)
- `docs/stories/epic-student-home/SH-2.7.story.md` (modificado — esta seção)
