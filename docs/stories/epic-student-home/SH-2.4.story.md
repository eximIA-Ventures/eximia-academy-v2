# SH-2.4: Auditoria de contextualização dos 4 indicadores operacionais (Progresso, Interações, Reflexões, Engajamento)

**Epic:** [EPIC-STUDENT-HOME](./EPIC-STUDENT-HOME.md)
**Status:** Done
**Depende de:** SH-1.5 (tabela "Meu ritmo"/`ComparisonInsightsTable`, já em produção, 26 rounds de refinamento visual concluídos).
**Bloqueia:** nenhuma story aberta. Gera 3 recomendações para stories FUTURAS (não abertas ainda, ver Dev Notes).
**Paralelizável:** esta story é 100% AUDITORIA (nenhum código alterado) — não conflita com nenhum trabalho paralelo. Executada em terminal Maestri exclusivo ("Prisma"), enquanto 3 outros terminais ("Alicerce", "Bússola", "Espelho") trabalhavam em paralelo em escopos DIFERENTES e explicitamente fora de alcance desta story: filtro de população nas médias da Turma (`área-gestor.ts`), a métrica "Última atividade" (login vs. estudo real), e a honestidade da mensagem do painel-resumo (`ritmo-summary.ts`).

---

## Story

**As a** Hugo (fundador, dono do produto), que declarou o princípio geral de que o dashboard inteiro precisa ser "INTEIRAMENTE contextual, em todos os seus cálculos, levando em consideração contexto, histórico, desempenho etc.",
**I want** uma auditoria de código real (não hipotética) dos 4 indicadores operacionais da tabela "Meu ritmo" que não são "Última atividade" — Progresso - conclusão, Interações realizadas, Reflexões realizadas, Engajamento — dizendo exatamente, com evidência de código, se cada um é CONTEXTUAL (considera histórico/tendência/desempenho ao longo do tempo) ou apenas um SNAPSHOT pontual,
**so that** eu saiba exatamente onde o dashboard hoje conta a história real do aluno e onde não conta, antes de decidir o que corrigir e em qual ordem.

## Contexto (Dev Notes)

**Esta story NÃO implementa nenhuma correção de código.** Por decisão explícita do Hugo durante a execução ("PARE antes de implementar qualquer correção... Aguarde minha confirmação antes de aplicar qualquer mudança de código"), o trabalho foi limitado a mapear a lógica atual e reportar veredito + propostas em prosa. Após a apresentação do mapeamento, o Hugo aprovou EXPLICITAMENTE **"sem correções agora"** — as 3 propostas abaixo ficam registradas como recomendação para stories futuras, não implementadas nesta story.

### Escopo desta auditoria (4 indicadores, dos 5 da tabela)

A tabela "Meu ritmo" (`comparison-insights-table.tsx`, `buildRows`, linhas 1008-1086) tem 5 linhas. Esta story cobre 4 delas — a 5ª ("Última atividade") é escopo exclusivo de outro terminal paralelo ("Bússola") e não foi tocada nem investigada em profundidade aqui.

### Pontos de entrada lidos (nenhum modificado)

- `apps/web/src/lib/analytics/student-home-indicators.ts` (`buildStudentHomeIndicators`, `isTopEngagementRank`, `engagementRankOf`).
- `apps/web/src/lib/analytics/area-gestor.ts` (`computeStudentComparison`, `loadOrgReference`).
- `apps/web/src/lib/notifications/engagement-triage.ts` (`computeBehindAndProgress`).
- `apps/web/src/components/analytics/comparison-insights-table.tsx` (`winnerOf`, `behindSeverityOf`, `leituraFor`, `buildRows`).

## Acceptance Criteria

- [x] **AC1 (lógica exata mapeada, com arquivo:linha):** cada um dos 4 indicadores tem sua fórmula/critério ATUAL documentado com anchors de código verificados (não memória/suposição). Ver Dev Notes §Achados.
- [x] **AC2 (veredito contextual-ou-pontual por indicador, com evidência):** cada um dos 4 recebe um veredito explícito (CONTEXTUAL ou PONTUAL) sustentado por citação de código, não por opinião. Ver Dev Notes §Achados.
- [x] **AC3 (hipóteses do pedido verificadas, não assumidas):** as hipóteses levantadas no briefing (aluno que caiu de repente vs. aluno sempre mediano com mesmo valor hoje; `behindSeverityOf` cego a trajetória; rank de Engajamento cego a recência) foram cada uma CONFIRMADAS ou REFUTADAS com leitura de código real, nunca aceitas por suposição.
- [x] **AC4 (nenhuma correção implementada sem aprovação):** durante a auditoria, um candidato de correção segura/local foi identificado (Progresso - conclusão, ver Dev Notes), mas NÃO foi implementado — o Hugo interrompeu explicitamente a execução antes de qualquer edição de código e, após ver o mapeamento completo, aprovou "sem correções agora". Nenhum arquivo de código foi tocado nesta story (confirmado por `git status --short`, ver File List).
- [x] **AC5 (recomendações registradas em prosa, prontas para virar story futura):** as 3 propostas (Progresso, Interações/Reflexões, Engajamento) estão documentadas com escopo, risco e razão de não terem sido implementadas agora, suficientes para um @sm/@po abrir stories dedicadas sem precisar re-investigar do zero.
- [x] **AC6 (achado colateral registrado, sem invenção de escopo novo):** a ausência de qualquer filtro de janela temporal (`.gte`/`.lte` por data) nas queries de `sessions`/`slide_reflections`/`enrollments` que alimentam os 4 indicadores foi confirmada por grep no código (`area-gestor.ts`), não presumida — registrada como achado transversal, não como 4ª proposta separada (é a CAUSA RAIZ comum das propostas de Interações/Reflexões/Engajamento).
- [x] **AC7 (sem regressão, porque não há mudança):** `git status --short` ao final mostra SOMENTE este arquivo de story como novo/modificado — nenhum arquivo de `apps/web/src` tocado, nenhum teste rodado por não haver código alterado, trabalho paralelo dos outros 3 terminais ("Alicerce", "Bússola", "Espelho") intocado.

## Tasks

- [x] 1. Ler o Change Log completo de `SH-1.5.story.md` (26 rounds) antes de tocar em qualquer raciocínio sobre a tabela — confirmado: todos os 26 rounds foram refinamento VISUAL (cor, ícone, alinhamento, tamanho de botão), nenhum alterou a FÓRMULA dos indicadores.
- [x] 2. Ler `student-home-indicators.ts`, `area-gestor.ts` (`computeStudentComparison`/`loadOrgReference`), `engagement-triage.ts` (`computeBehindAndProgress`) e `comparison-insights-table.tsx` (`winnerOf`/`behindSeverityOf`/`leituraFor`/`buildRows`) — extrair a fórmula EXATA de cada um dos 4 indicadores.
- [x] 3. Para cada indicador, avaliar criticamente (não checklist mecânico) se o valor/comparação conta a história real do aluno ou é um número isolado de agora.
- [x] 4. Verificar por grep se existe QUALQUER filtro de data (`.gte`/`.lte`) nas queries que alimentam os 4 indicadores — confirmado: NENHUM filtro de data existe em nenhuma das queries de `sessions`/`slide_reflections`/`enrollments` em `area-gestor.ts`.
- [x] 5. Avaliar, para cada gap confirmado, se a correção seria segura/local/baixo risco (implementar) ou exigiria dado novo/risco amplo (recomendar) — identificado 1 candidato tecnicamente seguro (Progresso, reusa sinal já computado e descartado), mas com risco de PRODUTO (reabre comportamento visual calibrado pelo Hugo em 26 rounds), reportado ao Hugo antes de decidir.
- [x] 6. Reportar ao Hugo o mapeamento completo (lógica + veredito + propostas em prosa) e aguardar aprovação explícita antes de qualquer ação. Hugo aprovou "sem correções agora".
- [x] 7. Produzir esta story documentando o processo e o resultado, sem implementar nenhuma correção.
- [x] 8. Confirmar via `git status --short` que nenhum arquivo de código foi tocado e o trabalho paralelo dos outros 3 terminais permanece intocado.

## Complexidade & Riscos

- **Complexidade:** S (small). Auditoria de leitura, sem escrita de código de produto.
- **Riscos:**
  - R1 (baixíssimo, mitigado): confundir "pontual" com "errado" — não é o caso. Os 4 indicadores funcionam exatamente como as stories anteriores (SH-F.5, SH-1.5) especificaram; o gap é uma LACUNA de escopo (contextualização nunca foi pedida antes), não um bug de implementação das stories anteriores.
  - R2 (baixo): propor uma correção sem validação de produto e quebrar comportamento visual calibrado pelo Hugo em 26 rounds (Round 3, `SEVERE_BEHIND_THRESHOLD`). Mitigação: nenhuma correção foi implementada; a proposta de Progresso está explicitamente marcada como "requer validação de produto antes de tocar" mesmo sendo tecnicamente de baixo risco técnico.
  - R3 (baixo): sobrepor escopo com os outros 3 terminais paralelos. Mitigação: nenhum arquivo de `área-gestor.ts` (população/filtro), da métrica "Última atividade", ou de `ritmo-summary.ts` foi editado — apenas lido para entender dependências (ex.: `computeBehindAndProgress` é a mesma função usada pela lógica de população, mas não foi alterada).

## Dev Notes

### Achados — lógica atual e veredito, por indicador

**1) Progresso - conclusão — PONTUAL**
- Valor: `apps/web/src/lib/notifications/engagement-triage.ts:46-58` (`computeBehindAndProgress`). Para cada matrícula, lê `e.progress.percentage` (campo já persistido) e guarda o MAX entre todos os cursos do aluno (`if (pct > prev) progressByStudent.set(...)`) — o "melhor curso", sem relação com tempo.
- A mesma função TAMBÉM calcula (linhas 60-67) um sinal `behind`: compara `pct` atual vs. `expectedPct` (dado `elapsedDays / deadlineDays` do próprio aluno) — este sinal É contextual (leva em conta quanto tempo o próprio aluno já teve). Mas ele só alimenta `paceByStudent` → `ritmoDisplay` (`student-home-indicators.ts:375-397`), um campo que a linha "Progresso" da tabela **não lê**. O sinal contextual existe e é DESCARTADO no ponto exato onde faria diferença.
- Consumo na tabela: `comparison-insights-table.tsx:1024-1033` (linha "progress" de `buildRows`) usa só `s.progressPct` vs `r.progressAvgPct`.
- Severidade: `comparison-insights-table.tsx:456-466` (`behindSeverityOf`) — assinatura `(subject: number, reference: number, direction)`, sem nenhum parâmetro de trajetória.
- **Veredito:** PONTUAL. O sinal de contexto (ritmo esperado × tempo decorrido) já existe no código e é descartado antes de chegar nesta linha.

**2) Interações realizadas — PONTUAL**
- Valor: `student-home-indicators.ts:400` `interactionsOf(id) = completedByStudent.get(id) ?? 0`, construído em `:325-333` a partir de `sessionRows` — soma TODAS as sessões completadas desde sempre.
- Confirmado por grep: nenhuma query de `sessions` em `area-gestor.ts` (`loadOrgReference:1293-1296`, `computeStudentComparison:1404-1408`) tem filtro `.gte`/`.lte` por data — é o histórico vitalício completo.
- Row: `comparison-insights-table.tsx:1040-1047`.
- **Veredito:** PONTUAL. Dois alunos com o mesmo total acumulado aparecem idênticos, independentemente de um ter feito tudo há 3 meses (parado desde então) e o outro estar ativo agora.

**3) Reflexões realizadas — PONTUAL**
- Valor: `student-home-indicators.ts:401` `reflectionsOf(id) = reflectionsByStudent.get(id) ?? 0`, construído em `:335-341` — mesmo padrão de `slide_reflections` sem filtro de data (`area-gestor.ts:1299-1300`/`:1411`).
- Row: `comparison-insights-table.tsx:1048-1058`.
- **Veredito:** PONTUAL. Mesma razão de Interações.

**4) Engajamento — PONTUAL (fórmula e rank)**
- Valor: `student-home-indicators.ts:402` `engagementOf(id) = interactionsOf(id)*2 + reflectionsOf(id)` — derivado puro dos dois contadores vitalícios acima, herda a mesma limitação.
- Rank/"1º da turma": `isTopEngagementRank` (`:167-175`) e `engagementRankOf` (`:193-202`), aplicados em `:440-454` — comparam `engagementOf` (cumulativo) de todos os alunos comparáveis; nenhum timestamp é lido em nenhum ponto do cálculo do rank.
- **Veredito:** PONTUAL. Confirma a hipótese do briefing: um aluno que foi excelente e parou há semanas pode continuar "1º da turma" hoje, porque nenhum total decresce e nada pondera recência.

### Achado transversal (causa raiz comum de Interações/Reflexões/Engajamento)

Confirmado por grep em `area-gestor.ts` (`loadOrgReference:1289-1310`, `computeStudentComparison:1401-1411`): **nenhuma** query de `sessions`, `slide_reflections` ou `enrollments` que alimenta os 4 indicadores tem qualquer filtro `.gte`/`.lte` por data. São contagens vitalícias por construção, não uma janela de "últimos N dias" — independentemente de qualquer texto de UI que sugira o contrário em outras partes do app (achado colateral, fora deste escopo: um card irmão, `student-comparison-view.tsx`/"Meu desempenho", usa a expressão "últimos 30 dias" alimentado por `computeMetricBlock`, mas mesmo lá só a contagem de "alunos ativos" é de fato filtrada por `THIRTY_DAYS_MS`, o resto — `completed`/`completionPct` — também é vitalício; observação registrada apenas para contexto, não investigada a fundo por estar fora do blast radius desta story).

### Propostas para stories futuras (NÃO implementadas — aprovação do Hugo: "sem correções agora")

1. **Progresso - conclusão:** propagar o sinal `behind` (já computado em `computeBehindAndProgress`, hoje descartado para esta linha) para influenciar a severidade/leitura da linha "Progresso", distinguindo um aluno atrás da média da turma mas ADIANTADO do próprio prazo de um aluno atrás da média E do próprio prazo. Não exige dado novo (reusa cálculo existente), mas MUDA comportamento visual já calibrado pelo Hugo (`SEVERE_BEHIND_THRESHOLD`, Round 3 de SH-1.5) — recomenda-se validação explícita de produto antes de implementar, não é uma correção puramente mecânica.
2. **Interações/Reflexões realizadas:** introduzir uma janela temporal real (ex.: últimos 30/60 dias) como sinal adicional de "ritmo recente", ao lado da fração acumulada já aprovada em produção. Exige decisão de produto (qual janela, como reconciliar com a UX já shippada de 26 rounds) e toca as mesmas queries usadas pelos denominadores `interactionsMax`/`reflectionsMax`/`engagementMax` — risco médio, recomenda-se story dedicada com validação de @po.
3. **Engajamento:** mesmo tratamento de janela do item 2, mais considerar um score com decaimento temporal (peso maior para atividade recente) para que o rank/"1º da turma" reflita momentum atual, não acúmulo histórico. Maior raio de impacto dos 4 indicadores — afeta o rank de toda a organização e o parágrafo-resumo (`ritmo-summary.ts`, escopo do terminal "Espelho") — recomenda-se story dedicada com fórmula de decaimento explicitamente revisada pelo Hugo/@po antes de qualquer implementação.

### Fora de escopo (não tocado, propositalmente)

- `área-gestor.ts` §filtro de população/"Alicerce" — não investigado em profundidade, não alterado.
- "Última atividade" (login vs. estudo real) — escopo do terminal "Bússola", não investigado em profundidade, não alterado.
- `ritmo-summary.ts` (honestidade do painel-resumo) — escopo do terminal "Espelho", lido apenas perifericamente para entender dependências de `winnerOf`/leituras, não alterado.

## Testing

Não aplicável — nenhum código de produto foi alterado nesta story (auditoria pura). Nenhuma suíte precisou ser rodada ou ajustada.

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-19 | Story criada retroativamente, documentando uma auditoria já concluída e aprovada pelo Hugo (fundador) durante a sessão: mapeamento da lógica atual dos 4 indicadores (Progresso, Interações, Reflexões, Engajamento) da tabela "Meu ritmo", veredito PONTUAL confirmado por código para os 4, e 3 propostas em prosa registradas para stories futuras. Hugo interrompeu explicitamente a execução antes de qualquer implementação ("PARE antes de implementar") e, após ver o mapeamento completo, aprovou "sem correções agora" — nenhum arquivo de `apps/web/src` foi tocado. | Prisma (Coder Opus, terminal Maestri exclusivo) |

## Dev Agent Record

### Agent Model Used

Claude Opus (terminal Maestri "Prisma", role Coder Opus, execução isolada, sem uso de achados de outros terminais).

### Debug Log / Decisões de Implementação

- Investigação seguiu estritamente os 4 arquivos apontados no briefing (`student-home-indicators.ts`, `area-gestor.ts`, `comparison-insights-table.tsx`, `engagement-triage.ts`), sem tocar `área-gestor.ts` §população, "Última atividade" ou `ritmo-summary.ts` (escopos dos outros 3 terminais).
- Confirmado por leitura direta de código (não suposição) que os 26 rounds do Change Log de `SH-1.5.story.md` foram 100% refinamento visual — nenhum alterou a fórmula de nenhum dos 4 indicadores.
- Confirmado por grep (`grep -n "orgSessionRows\|from(\"sessions\")\|..." area-gestor.ts`) que nenhuma query que alimenta os 4 indicadores tem filtro de data — achado usado como evidência central do veredito PONTUAL.
- Identificado 1 candidato de correção tecnicamente segura (Progresso, reusa o sinal `behind` já computado) — decidido NÃO implementar sem aprovação explícita de produto, por reabrir comportamento visual calibrado pelo Hugo em 26 rounds (Round 3, `SEVERE_BEHIND_THRESHOLD`). Reportado como recomendação, não como fix silencioso.
- Hugo interrompeu a execução em tempo real ("PARE antes de implementar qualquer correção") antes de qualquer edição ser feita — nenhum código chegou a ser tocado em nenhum momento desta story. Após reportar o mapeamento completo (lógica exata + veredito + 3 propostas em prosa), Hugo aprovou explicitamente "sem correções agora", confirmando que esta story se encerra como auditoria pura, sem tarefa de implementação pendente.

### Comandos de Verificação Executados

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2
git status --short   # confirma: nenhum arquivo de apps/web/src tocado por esta story
```

Nenhum comando de build/test/typecheck foi necessário — não houve alteração de código de produto.

### File List

- `docs/stories/epic-student-home/SH-2.4.story.md` (novo — esta story)

## Nota para @po (validação pendente)

Esta story documenta uma auditoria já aprovada verbalmente pelo Hugo (fundador) durante a execução, incluindo a decisão explícita de não implementar nenhuma correção agora. Recomenda-se que o @po, na validação formal, apenas confirme que as 3 propostas (Dev Notes §Propostas) estão suficientemente especificadas para virarem stories independentes (SH-2.5/2.6/2.7 ou equivalente) quando o Hugo priorizar, sem necessidade de nova investigação de código.
