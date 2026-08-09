# SH-2.8: "Engajamento superficial" — a abertura `behind` faz o ponto diagnóstico, caso real Angelo

**Epic:** [EPIC-STUDENT-HOME](./EPIC-STUDENT-HOME.md)
**Status:** InReview
**Depende de:** SH-2.6 (`summaryToneOf` proporção-aware, ramo `behind`), SH-2.7.1/2.7.2 (`metricSignalsOf`, o hub de sinais por métrica que esta story estende com um sinal novo).
**Bloqueia:** nenhuma story aberta.
**Paralelizável:** rodou sozinha, terminal único, a partir de feedback ao vivo do Hugo olhando o caso real do aluno Angelo. Não paraleliza com trabalho concorrente em `ritmo-summary.ts`.

---

## Story

**As a** Hugo (fundador, dono do produto), olhando o painel do aluno Angelo (Progresso 0%→50% no dia, 4 sessões numa rajada de 1h25, mas Interações 4/8 e Reflexões 1/41, praticamente zero),
**I want** que a abertura do painel-resumo, quando o tom geral é `behind`, reconheça e nomeie o padrão comportamental específico ("passou pelo conteúdo, mas quase não engajou de verdade") em vez de listar métricas fracas de forma neutra,
**so that** o aluno (e quem acompanha, gestor/mentor) entenda que progresso sem interação/reflexão real "conta menos do que parece" — o cutucão certo, não uma lista genérica de números vermelhos.

## Contexto (Dev Notes)

### O caso Angelo (motivação, feedback ao vivo do Hugo)

Angelo estudou de verdade no dia: Progresso saltou de 0% para 50%, 4 sessões completadas numa rajada de 1h25. Mas Interações ficou em 4/8 (atrás da Turma, 7/8) e Reflexões em 1/41 (quase zero, apesar de ter avançado meia trilha inteira). O diagnóstico já discutido com o Hugo: ele passou pelo conteúdo, mas pulou o engajamento REAL (interação/reflexão) — "fez a aula, não fez a parte que importa", típico de quem está recuperando prazo sob pressão, não aprendendo de verdade.

O painel, antes desta story, produzia: *"Angelo, para retomar o seu ritmo de estudos. Sua oportunidade de melhoria é evoluir em progresso, interações, reflexões e engajamento."* O Hugo pediu "mais um cutucão", verbatim (falado, informal): *"fez as aulas mas não interagiu, então não tá tão bom assim, é a interação que conta."* A frase precisava fazer o PONTO diagnóstico específico, não listar 4 métricas fracas de forma neutra e genérica.

### Diagnóstico

`buildRitmoSummary` já tinha DOIS ramos que fazem pontos específicos por métrica: `tieAttentionSummary` (SH-2.7.2, para o tom `tie`) e a `opportunity` genérica (SH-2.7.1, para os demais tons, incluindo `behind`). O ramo `behind` (2+ linhas atrás, `summaryToneOf`) nunca ganhou um ponto específico — sempre abria com a mesma frase fixa "para retomar o seu ritmo de estudos" (SH-2.5) seguida da lista neutra de métricas (`opportunity`). Essa lista neutra não distingue "está genuinamente devagar em tudo" de "avançou no conteúdo mas pulou o engajamento real" — dois padrões comportamentais bem diferentes que hoje produzem a mesma copy.

### Correção aplicada

Novo sinal por métrica, `superficialGap` (`MetricSignal`, `metricSignalsOf`, `ritmo-summary.ts`): compara a MESMA % fracionária que o resto do arquivo já usa (`fractionPctOf(interactions, interactionsMax)` / `fractionPctOf(reflections, reflectionsMax)`) com o PRÓPRIO `progressPct` do aluno — um eixo de comparação diferente dos dois que já existiam:

- `winnerOf`/`needsAttention` (SH-2.7.1) compara a métrica contra a TURMA.
- o freio `ownPaceSignalFor` (SH-2.7) compara a métrica contra o ritmo esperado por TEMPO decorrido na trilha (`expectedProgressPct`).
- `superficialGap` (esta story) compara a métrica contra o QUANTO O PRÓPRIO ALUNO avançou no conteúdo (`progressPct`) — "de tudo que ele já percorreu, quanto virou engajamento real?".

`superficialGap` só é calculado para Interações e Reflexões (nunca Progresso, que é o próprio eixo de comparação), e só dispara (`superficialGapOf`) quando:
1. `progressPct >= SUPERFICIAL_ENGAGEMENT_THRESHOLDS.minProgressPct` (20) — sem avanço real de conteúdo, "avançou no conteúdo" seria falso.
2. `progressPct - metricPct >= SUPERFICIAL_ENGAGEMENT_THRESHOLDS.gapPct` (30 pontos percentuais) — a métrica precisa estar DESPROPORCIONALMENTE atrás, não só "um pouco atrás".

Quando `summaryToneOf === "behind"` E ao menos 1 sinal `superficialGap` está presente, `superficialEngagementSummary` (novo, mesmo padrão de retorno antecipado que `tieAttentionSummary` já usa para o tom `tie`) substitui a abertura genérica + `opportunity` por uma frase única: **"{Nome}, você avançou no conteúdo, mas quase não {verbo(s)}: sem isso, o progresso conta menos do que parece."** — `interagiu`/`refletiu`/`interagiu nem refletiu`, conforme qual(is) métrica(s) dispararam.

### Genericidade — por que não é hardcoded para "reflexões" (requisito explícito do Hugo)

Angelo: Progresso 50%, Interações 4/8=50% (gap 0, NÃO dispara — moveu exatamente junto com o progresso), Reflexões 1/41≈2,4% (gap ≈47,6, dispara). O sinal é calculado de forma idêntica para as duas métricas; no caso real do Angelo só Reflexões cruza o threshold, mas a regra é a MESMA para as duas — validado com 2 fixtures adicionais (uma onde só Interações dispara, outra onde as duas disparam simultaneamente, produzindo "interagiu nem refletiu").

## Acceptance Criteria

- [x] **AC1:** Novo campo `superficialGap: boolean` em `MetricSignal`, calculado por `superficialGapOf(progressPct, metricPct)` — só para as entradas de Interações/Reflexões em `metricSignalsOf`, sempre `false` para Progresso/Engajamento/Atividade recente.
- [x] **AC2:** `superficialGapOf` só retorna `true` quando `progressPct >= minProgressPct` (20) E `progressPct - metricPct >= gapPct` (30) — ambos configuráveis via `SUPERFICIAL_ENGAGEMENT_THRESHOLDS` (constante nomeada, mesmo espírito de `TONE_THRESHOLDS`/`RECENCY_THRESHOLDS`/`SUMMARY_TONE_BEHIND_COUNT_FOR_RED`).
- [x] **AC3:** Quando `summaryToneOf === "behind"` E há 1+ sinal `superficialGap`, `buildRitmoSummary` retorna `superficialEngagementSummary` (abertura + ponto diagnóstico, substitui a genérica "para retomar..." + `opportunity`).
- [x] **AC4:** A regra é GENÉRICA — cobre Interações isolada, Reflexões isolada, ou as duas juntas ("interagiu nem refletiu"), nenhuma das 3 hardcoded.
- [x] **AC5 (validação obrigatória, caso real):** Angelo (Progresso 50%, Interações 4/8, Reflexões 1/41, Turma Interações 7/8) → frase final exata: "Angelo, você avançou no conteúdo, mas quase não refletiu: sem isso, o progresso conta menos do que parece." Interações NÃO entra no ponto (4/8=50% é a MESMA proporção do progresso, sem disparidade) — continua citada normalmente em `behindMetricsOf` (atrás da Turma), só não no ponto diagnóstico desta story.
- [x] **AC6 (regressão):** o caso Angelo ORIGINAL (SH-2.3, progresso 0%) NÃO dispara o sinal novo (`progressPct < minProgressPct`) — mantém a abertura genérica "para retomar o seu ritmo de estudos" intocada.
- [x] **AC7 (regressão):** tom `behind` sem nenhuma disparidade real (todas as métricas fracionárias na MESMA proporção do progresso) mantém a abertura genérica + `opportunity` de sempre.
- [x] **AC8 (regressão):** o ramo `tie` (SH-2.7.2, caso Rinaldo) e todos os testes pré-existentes permanecem intocados — a nova checagem só entra depois do retorno antecipado do `tie`, condicionada a `tone === "behind"`.
- [x] **AC9:** Sem regressão: suíte completa (`src/components/analytics` + `src/lib/analytics`) 100% verde; `tsc`/`biome` limpos.

## Tasks

- [x] 1. Ler o Change Log completo da SH-2.7.story.md (SH-2.7 + SH-2.7.1 + SH-2.7.2) antes de implementar — confirmado: nenhuma das 3 rodadas cobria o eixo "progresso vs. o quanto o próprio aluno engajou"; todas comparavam contra Turma ou contra ritmo esperado por tempo.
- [x] 2. Ler `ritmo-summary.ts` inteiro (`buildRitmoSummary`, `metricSignalsOf`, `tieAttentionSummary`, `behindMetricsOf`) para entender a estrutura de abertura-por-tom a estender.
- [x] 3. Desenhar `superficialGapOf`/`SUPERFICIAL_ENGAGEMENT_THRESHOLDS` — decisão de threshold (20% progresso mínimo, 30 pontos de gap) calibrada para disparar no caso Angelo (gap ≈47,6) e NÃO disparar em disparidades pequenas/moderadas nem quando o progresso ainda é irrisório.
- [x] 4. Estender `MetricSignal`/`metricSignalsOf` com o campo `superficialGap`, calculado só para Interações/Reflexões.
- [x] 5. Implementar `superficialEngagementSummary` + `superficialVerbFor`/`joinNem`, encaixados como retorno antecipado dentro de `buildRitmoSummary`, condicionado a `tone === "behind"` — mesmo padrão que `tieAttentionSummary` já usa para `tie`, sem reescrever a lógica existente.
- [x] 6. Testes: caso real Angelo (frase exata), genericidade (só interações, ambas), regressão (Angelo original 0% progresso, tom behind sem disparidade, ramo tie intocado).
- [x] 7. `tsc --noEmit` + `vitest run src/components/analytics src/lib/analytics` + `biome check` nos 2 arquivos tocados, tudo verde.

## Complexidade & Riscos

- **Complexidade:** M (medium). Um sinal novo por métrica + um retorno antecipado adicional, reusando toda a infraestrutura já existente (`fractionPctOf`, `metricSignalsOf`, o padrão de `tieAttentionSummary`) — nenhuma estrutura nova de dados, nenhum arquivo novo além dos já tocados nas rodadas anteriores desta área.
- **Riscos:**
  - R1 (médio, mitigado): o threshold (20%/30pp) ser calibrado só pelo caso Angelo e não generalizar. Mitigação: 2 fixtures adicionais provam a genericidade (interações isolada, ambas juntas) com números diferentes do caso Angelo; threshold é constante nomeada, ajustável sem re-arquitetar.
  - R2 (baixo, mitigado): o sinal novo conflitar/duplicar `needsAttention` (SH-2.7.1) ou `ownPaceSignalFor` (SH-2.7 freio). Mitigação: eixo de comparação explicitamente diferente (progresso próprio, não Turma nem tempo decorrido) — os 3 sinais coexistem em `MetricSignal` sem se sobrescrever, testado que `behindMetricsOf` continua citando Interações mesmo quando ela não dispara `superficialGap`.
  - R3 (baixo, mitigado): quebrar o ramo `tie` (SH-2.7.2) por engano. Mitigação: a nova checagem só roda DEPOIS do retorno antecipado do `tie`, condicionada estritamente a `tone === "behind"` — suíte completa dos testes SH-2.6/2.7.x re-executada, 100% verde sem alteração.
  - R4 (baixo): valores de Turma do fixture Angelo (progresso/reflexões/engajamento) são ilustrativos, não consultados no Supabase nesta rodada (só Interações Turma 7/8 veio citado explicitamente pelo Hugo). Decisão consciente — o ponto central desta story é a COMPARAÇÃO interna (progresso vs. engajamento do próprio aluno), que não depende de nenhum valor de Turma; os valores ilustrativos só reproduzem o pano de fundo qualitativo já visível na frase que o Hugo colou (tom geral "behind", 4 métricas citadas).

## Dev Notes

- **Arquivo de produção tocado:** `apps/web/src/lib/analytics/ritmo-summary.ts` (único arquivo — a checagem não precisa de nenhum campo/tipo novo em `StudentHomeIndicators`/`comparison-insights-table.tsx`, reusa `fractionPctOf`/`s.progressPct` já disponíveis).
- **Arquivo de teste tocado:** `apps/web/src/lib/analytics/__tests__/ritmo-summary.test.ts`.
- **NÃO tocado:** `comparison-insights-table.tsx` (a tabela "Meu ritmo" em si) — este sinal é, como o freio SH-2.7.2 antes dele, uma propriedade exclusiva da LEITURA do painel-resumo (`buildRitmoSummary`), não da tabela linha-a-linha. `student-home-indicators.ts`/`types/analytics.ts` também não tocados — nenhum campo novo de indicador foi necessário, só uma comparação nova entre campos já existentes.

## Testing

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2/apps/web
npx tsc --noEmit
npx vitest run src/components/analytics src/lib/analytics
npx biome check src/lib/analytics/ritmo-summary.ts src/lib/analytics/__tests__/ritmo-summary.test.ts
```

Resultado: `tsc` exit 0; 378/378 testes verdes (analytics, 43 em `ritmo-summary.test.ts`); `biome check` limpo nos 2 arquivos tocados.

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-20 | Novo sinal `superficialGap` em `MetricSignal`/`metricSignalsOf` (`ritmo-summary.ts`): compara a % fracionária de Interações/Reflexões (`fractionPctOf`) com o PRÓPRIO `progressPct` do aluno (eixo diferente de `needsAttention`/Turma e do freio SH-2.7/tempo decorrido), via `superficialGapOf` e `SUPERFICIAL_ENGAGEMENT_THRESHOLDS` (minProgressPct=20, gapPct=30). Quando `summaryToneOf === "behind"` e 1+ sinal dispara, `superficialEngagementSummary` (novo, mesmo padrão de retorno antecipado de `tieAttentionSummary`) substitui a abertura genérica "para retomar o seu ritmo de estudos" + a lista neutra `opportunity` por "{Nome}, você avançou no conteúdo, mas quase não {interagiu\|refletiu\|interagiu nem refletiu}: sem isso, o progresso conta menos do que parece." Validado com o caso real do Angelo (Progresso 50%, Interações 4/8, Reflexões 1/41): frase final cita SÓ reflexões (interações 4/8=50% é a mesma proporção do progresso, sem disparidade — o próprio Hugo notou isso ao revisar o exemplo). Genericidade provada com 2 fixtures adicionais (só interações, ambas juntas). Regressão coberta: caso Angelo original (progresso 0%) e tom behind sem disparidade mantêm a abertura genérica; ramo tie (SH-2.7.2) intocado. `tsc` exit 0; 378/378 testes verdes (analytics); `biome check` limpo. | J.A.R.V.I.S. (@dev, terminal único, Maestri) |

## Dev Agent Record

### Contexto de execução

Trabalho de copy/comportamento a partir de feedback ao vivo do Hugo olhando o caso real do aluno Angelo, com diagnóstico já fechado antes do pedido de implementação ("fez a aula, não fez a parte que importa"). Change Log completo da SH-2.7.story.md (SH-2.7/2.7.1/2.7.2) lido por completo antes de qualquer edição, conforme instrução explícita.

### Achados durante a implementação

- **O padrão "compõe a mensagem inteira e retorna cedo" já estava estabelecido pela SH-2.7.2** (`tieAttentionSummary`, para o tom `tie`) — encaixar o novo sinal no MESMO padrão, para o tom `behind`, evitou qualquer reescrita da árvore de decisão de aberturas existente (isTopEngagement → tie-com-atenção → behind-superficial → behind-genérico → aboveAvgEngagement → neutro). A checagem nova entra como MAIS UM retorno antecipado, não uma ramificação paralela.
- **A decisão de julgamento mais importante da rodada:** contra QUAL referência medir "desproporcional". Três eixos já existiam ou foram considerados (Turma via `winnerOf`, ritmo esperado por tempo via `expectedProgressPct`/freio SH-2.7); nenhum dos dois captura "quanto do que ele mesmo avançou virou engajamento real" — só o PRÓPRIO `progressPct` do aluno responde essa pergunta. Essa escolha foi o que fez a regra reproduzir exatamente o padrão que o Hugo apontou no áudio: Interações 4/8 não é "atrás" NESTE eixo (moveu junto com o progresso, embora esteja atrás da Turma nesse outro eixo, `needsAttention`), Reflexões 1/41 é claramente atrás NESTE eixo.
- **Threshold calibrado com folga, não ajustado ao caso Angelo exato.** `gapPct = 30` deixa uma margem grande abaixo do gap real do Angelo (≈47,6) e acima de disparidades pequenas (ex.: 10-15 pontos, que não deveriam disparar um "cutucão" tão direto) — testado explicitamente com um fixture "sem disparidade" (gap=0 em ambas as métricas) para confirmar que o tom `behind` genérico continua acessível quando não há de fato o padrão comportamental específico.

### File List

- `apps/web/src/lib/analytics/ritmo-summary.ts` (modificado)
- `apps/web/src/lib/analytics/__tests__/ritmo-summary.test.ts` (modificado)
- `docs/stories/epic-student-home/SH-2.8.story.md` (novo)
