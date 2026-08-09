# SH-2.5: Tom por tolerância de 5%, copy direta, "Última sessão de estudo" com nomenclatura própria

**Epic:** [EPIC-STUDENT-HOME](./EPIC-STUDENT-HOME.md)
**Status:** InReview
**Depende de:** SH-2.1 (Turma filtrada para ativos), SH-2.2 (última atividade mede estudo real), SH-2.3 (painel-resumo consome `summaryToneOf`) — esta story reforma o MODELO de tom que as três anteriores já usavam.
**Bloqueia:** nenhuma story aberta.
**Paralelizável:** rodou sozinha, terminal único, depois de um round completo de feedback ao vivo do Hugo sobre os fixes SH-2.1/2.2/2.3 já em produção. Não paraleliza com trabalho concorrente em `comparison-insights-table.tsx`/`ritmo-summary.ts`/`student-home-card.tsx`.

---

## Story

**As a** Hugo (fundador, dono do produto), testando os fixes SH-2.1/2.2/2.3 ao vivo,
**I want** (1) que o tom "atrás" da tabela "Meu ritmo" pare de tratar gaps moderados como "quase igual" (âmbar) e vire vermelho direto fora de uma faixa de tolerância estreita, (2) que o painel-resumo pare de suavizar a mensagem quando o aluno está atrás, e (3) que a linha "Última atividade"/"Última sessão de estudo" pare de usar a linguagem "acima/abaixo da média" que não faz sentido para uma métrica de recência,
**so that** a tabela reflita com mais precisão o estado real do aluno e a comunicação seja direta e honesta, sem soar como "quase lá" quando não está.

## Contexto (Dev Notes)

### Origem: feedback ao vivo do Hugo, olhando o app rodando (2026-07-19)

Depois de ver os fixes SH-2.1/2.2/2.3 funcionando em produção, o Hugo trouxe 3 correções novas + 1 pequena (item 4), todas a partir de observação direta do app:

1. Viu a linha Progresso do aluno Rinaldo (50% vs Turma 67%, gap relativo ~25%) sair âmbar ("atrás moderado") e achou que devia ser vermelho. Pergunta direta sobre a regra que ele queria, resposta literal: *"ambar é quando está igual em numeros, considerando um desvio padrao para mais ou para menos de 5%. Se for mais que 5% muda para verde ou para vermelho."*
2. Viu a abertura do painel para o Rinaldo: *"Rinaldo, um lembrete gentil para retomar o seu ritmo de estudos..."* — rejeitou a suavização: *"nao tem dessa de 'um lembrete gentil' tem que ser direto ao ponto 'Rinaldo, para retomar seu ritimo de estudos ...'"*.
3. Sobre a linha "Última atividade": *"no caso específico da última atividade, não temos que tratar como acima e abaixo da média, temos que utilizar outra nomenclatura."*
4. Notou que a célula Turma da linha Engajamento mostrava só "{N} pessoas" (ex.: "35 pessoas"), sem deixar explícito que essa contagem já reflete o filtro de alunos ativos da SH-2.1 — pediu "{N} pessoas ativas".

### ITEM 1 — reforma do modelo de tom: empate vira FAIXA DE TOLERÂNCIA, sem gradiente mild/severe

**Antes:** `winnerOf` tratava "tie" como igualdade EXATA (`subject === reference`); qualquer diferença, por menor que fosse, já classificava um vencedor, e `behindSeverityOf` (corte em 30% de gap relativo) decidia entre `behind-mild` (âmbar) e `behind-severe` (vermelho).

**Depois:** `winnerOf` calcula o gap relativo direction-aware (mesma fórmula que `behindSeverityOf` usava) e classifica: `|gap| <= TONE_THRESHOLDS.tolerancePct` (5%) → `tie`; gap > tolerância na direção boa → `win`; gap > tolerância na direção ruim → `reference` (behind). `Leitura["tone"]` foi reduzido de 5 para 4 valores (`"win" | "tie" | "behind" | "none"`), `behindSeverityOf`/`SEVERE_BEHIND_THRESHOLD`/`behind-mild` foram REMOVIDOS. Todo consumidor de tom foi rastreado e ajustado: `LEITURA_CHIP`, `VALUE_PILL`, `ACTION_TONE`, `subjectPillFor`, `ValueCell` (comparison-insights-table.tsx), `RITMO_TONE_STYLE` (student-home-card.tsx), `rowTonesOf`/`summaryToneOf` (ritmo-summary.ts). O visual consolidado para "behind" é o do antigo `behind-severe` (vermelho), a pedido explícito do Hugo.

**Configurável, não hardcoded:** `TONE_THRESHOLDS = { tolerancePct: 0.05 }`, constante nomeada única no topo de `comparison-insights-table.tsx`, candidata a virar ajustável num painel de administração futuro que o Hugo pretende construir.

**Escopo:** aplica-se às 4 linhas comparativas (Progresso, Interações, Reflexões, Engajamento). A linha "Última sessão de estudo" NÃO usa mais `winnerOf`/faixa de tolerância — ver item 3.

### ITEM 2 — copy do painel-resumo: direto ao ponto

A abertura de `buildRitmoSummary` para o tom "atrás" mudou de duas variantes suavizadas ("hora de retomar o seu ritmo de estudos" / "um lembrete gentil para retomar o seu ritmo de estudos", SH-2.3) para UMA única abertura direta: **"{Nome}, para retomar o seu ritmo de estudos"**. Como o item 1 eliminou a distinção mild/severe, só existe mais UM ramo "atrás" — a simplificação da copy e a simplificação do modelo de tom andam juntas.

### ITEM 3 — "Última sessão de estudo": nomenclatura própria, desacoplada da Turma

**Decisão de design (a mais aberta a julgamento das 3 — documentada aqui com o raciocínio completo):**

Recência (dias desde a última sessão de estudo) não é uma métrica cumulativa comparável da mesma forma que progresso/interações/reflexões/engajamento — "você está 5 dias mais recente que a média" não carrega o mesmo tipo de informação acionável que "você fez mais sessões que a média". Em vez de reformar a comparação, a linha ganhou uma leitura TOTALMENTE PRÓPRIA, por FAIXAS ABSOLUTAS de recência, nova função `recencyReadingFor(days)`:

| Faixa | Tom | Texto |
|---|---|---|
| `<= RECENCY_THRESHOLDS.recentDays` (7 dias) | `win` (verde) | "estudando com frequência" |
| entre `recentDays` e `RECENCY_THRESHOLDS.staleDays` (8-30 dias) | `tie` (âmbar) | "faz um tempo que não aparece" |
| `> staleDays` (30 dias) | `behind` (vermelho) | "sumiu da trilha" |
| `null` (nunca teve sessão) | `none` | "—" (mantém o estado da SH-2.2) |

**Por que reusar os tons `win`/`tie`/`behind` em vez de inventar um novo?** O pedido do Hugo deixou o grau intermediário (8-30 dias) em aberto ("use julgamento"). Inventar um 5º tom só para esta linha contradiria o próprio espírito de simplificação do item 1 (que acabou de reduzir 5 tons para 4). Reusar `tie` (âmbar) para o grau intermediário mantém a paleta de cores fechada em 4 valores, sem exigir NENHUMA mudança em `LEITURA_CHIP`/`ACTION_TONE`/`VALUE_PILL`/`RITMO_TONE_STYLE` — o `recencyReadingFor` já produz um `Leitura` no formato que todo o resto do pipeline já entende, plugando sem adaptação.

**Por que 7 e 30 dias?** 7 dias ≈ "estudou essa semana" (referência comum e legível de cadência semanal). 30 dias ≈ "um mês sem aparecer" (limiar razoável para "sumiu da trilha", não punitivo demais para quem só ficou 2-3 semanas sem tempo). Ambos ficam explicitamente marcados no código como valores de partida, sujeitos a calibração pelo Hugo no painel futuro.

**Winner sintético:** `recencyReadingFor` retorna `{ leitura, winner }` no MESMO shape que o resto do pipeline consome (`ValueCell`, `subjectPillFor`, `ActionButton`) — não é `winnerOf` de verdade (não compara com a Turma), mas produz um `Winner` sintético (`"subject"` no caso win, `"reference"` no caso behind, `null` nos casos tie/none) para que o destaque visual (pill verde/vermelho no valor Você) continue funcionando sem duplicar lógica de renderização.

**Turma continua informativa:** a célula Turma da linha continua mostrando "há N dias" (via `formatDays`, inalterado) — só a LEITURA/tom/copy pararam de comparar diretamente com essa média.

**Fallback null renomeado (herdado, sem mudança nesta story):** "Ainda sem sessão de estudo" (SH-2.2) continua sendo o texto da CÉLULA quando `lastAccessDays === null`; o CHIP "Como estou" para esse mesmo estado mostra "—" (mesma convenção de ausência de dado que as outras 4 linhas já usam) — decisão para não repetir a mesma frase duas vezes na mesma linha.

### ITEM 4 — "{N} pessoas" → "{N} pessoas ativas"

`formatPopulation` (comparison-insights-table.tsx), usado na célula Turma da linha Engajamento, ganhou o sufixo "ativas" ("35 pessoas" → "35 pessoas ativas", "1 pessoa" → "1 pessoa ativa"), deixando explícito que essa contagem já reflete o filtro de alunos ativos aplicado pela SH-2.1 (`activeOrgStudentIds`).

## Acceptance Criteria

- [x] **AC1:** `TONE_THRESHOLDS.tolerancePct` (0.05) é a única fonte da faixa de tolerância; `winnerOf` classifica tie/win/reference por gap relativo direction-aware.
- [x] **AC2:** `Leitura["tone"]` tem exatamente 4 valores (`win`/`tie`/`behind`/`none`); `behindSeverityOf`/`SEVERE_BEHIND_THRESHOLD` removidos do código de produção.
- [x] **AC3:** Todo consumidor de tom rastreado e ajustado sem exceção: `LEITURA_CHIP`, `VALUE_PILL`, `ACTION_TONE`, `subjectPillFor`, `ValueCell`, `RITMO_TONE_STYLE`, `rowTonesOf`/`summaryToneOf`.
- [x] **AC4:** O visual consolidado de "behind" é o do antigo `behind-severe` (vermelho), nas 4 linhas comparativas.
- [x] **AC5:** `buildRitmoSummary` tem UMA abertura para o tom "behind": "{Nome}, para retomar o seu ritmo de estudos", sem "lembrete gentil"/"hora de retomar" (copy antiga). Override de `isTopEngagement` (#1 real) e o ramo "acima da média isolado" (só quando o tom geral não é behind, SH-2.3) permanecem intocados.
- [x] **AC6:** "Última sessão de estudo" usa `recencyReadingFor` (faixas absolutas: <=7d win, 8-30d tie, >30d behind, null none), DESACOPLADA de `winnerOf`/comparação com a Turma, em toda a superfície que a consumia (tabela E `rowTonesOf`/`behindMetricsOf`/cláusula de recência do painel-resumo).
- [x] **AC7:** `RECENCY_THRESHOLDS.recentDays`/`staleDays` (7/30) são constantes nomeadas configuráveis, não hardcoded espalhado.
- [x] **AC8:** A célula Turma da linha "Última sessão de estudo" continua mostrando "há N dias" (contexto informativo), mesmo com a leitura desacoplada.
- [x] **AC9:** `formatPopulation` retorna "{N} pessoas ativas"/"1 pessoa ativa".
- [x] **AC10:** Suíte completa (`src/components/analytics` + `src/lib/analytics`) 100% verde, incluindo TODOS os testes que dependiam do tipo antigo de `Leitura["tone"]` (nenhum pulado).

## Tasks

- [x] 1. Ler o Change Log da SH-2.3 (story mais recente anterior) para confirmar o estado exato do modelo de tom antes de editar.
- [x] 2. Item 1: `TONE_THRESHOLDS`, `winnerOf` por tolerância, remoção de `behindSeverityOf`/`SEVERE_BEHIND_THRESHOLD`, `Leitura["tone"]` 5→4, ajuste de `LEITURA_CHIP`/`VALUE_PILL`/`ACTION_TONE`/`subjectPillFor`/`ValueCell`/`RITMO_TONE_STYLE`/`rowTonesOf`/`summaryToneOf`.
- [x] 3. Item 2: abertura única "para retomar o seu ritmo de estudos" em `buildRitmoSummary`.
- [x] 4. Item 3: `RECENCY_THRESHOLDS`, `recencyReadingFor`, desacoplamento da linha `lastAccess` de `winnerOf` na tabela E em `ritmo-summary.ts` (`rowTonesOf`, `behindMetricsOf`, cláusula de recência).
- [x] 5. Item 4: `formatPopulation` → "pessoas ativas".
- [x] 6. Ajustar TODOS os testes afetados pela mudança de tipo (comparison-insights-table.test.tsx, student-home-card.test.tsx, ritmo-summary.test.ts) — nenhum pulado, nenhum deletado sem justificativa.
- [x] 7. `tsc --noEmit` + `vitest run src/components/analytics src/lib/analytics` + `biome check` nos arquivos tocados, tudo verde.

## Complexidade & Riscos

- **Complexidade:** L (large). Mudança de tipo (`Leitura["tone"]` 5→4 valores) com blast radius em 3 arquivos de produção e 3 arquivos de teste (31 testes runtime-afetados, além dos erros de compilação); uma linha inteira (`lastAccess`) migrada para um modelo de leitura conceitualmente diferente (absoluto vs. comparativo), consumida em 2 lugares distintos (tabela + painel-resumo).
- **Riscos:**
  - R1 (alto, mitigado): mudança de tipo quebrando testes silenciosamente ou sendo "consertada" com skip/delete em vez de correção real. Mitigação: rodado `tsc` até exit 0 ANTES de tocar em runtime failures, depois `vitest` iterativamente até 342/342 verde, cada teste corrigido com justificativa no próprio código, nenhum deletado.
  - R2 (médio, mitigado): a linha `lastAccess` sendo esquecida em algum consumidor (ex.: `behindMetricsOf`'s "atividade recente", usado na cláusula de oportunidade do painel-resumo) e continuar comparando com a Turma por engano. Mitigação: rastreamento explícito de TODOS os usos de `winnerOf(s.lastAccessDays, ...)` antes de editar (grep dedicado), 2 usos migrados em `ritmo-summary.ts` (`recencyWinner`, `behindMetricsOf`) além do uso na tabela.
  - R3 (médio, mitigado): recalibração de largura do botão de ação (`ACTION_LABEL_SIZE`) quebrando ao trocar labels — não se aplicou aqui (labels não mudaram nesta story), mas o padrão de verificação (fórmula documentada no código) foi reusado da SH-2.2 quando necessário revisar comentários adjacentes.
  - R4 (baixo): `LEITURA_COPY.lastAccess` virar código morto (nunca mais lido pela tabela) sem documentação, confundindo um dev futuro. Mitigação: comentário explícito no código apontando para `recencyReadingFor` como a fonte real.

## Dev Notes

- **Arquivos de produção tocados:** `apps/web/src/components/analytics/comparison-insights-table.tsx`, `apps/web/src/components/analytics/student-home-card.tsx`, `apps/web/src/lib/analytics/ritmo-summary.ts`.
- **Arquivos de teste tocados:** `apps/web/src/components/analytics/__tests__/comparison-insights-table.test.tsx`, `apps/web/src/components/analytics/__tests__/student-home-card.test.tsx`, `apps/web/src/lib/analytics/__tests__/ritmo-summary.test.ts`.
- **NÃO tocados:** `area-gestor.ts`/`student-home-indicators.ts` (SH-2.1/SH-2.2, já fechadas — o modelo de tom desta story consome os dados que elas já corrigiram, sem reabrir a fonte).
- **Metodologia de correção de testes:** em vez de reescrever os ~1600 linhas do arquivo de teste às cegas por leitura estática, o `tsc`/`vitest` foram rodados a cada etapa para descobrir a lista REAL de falhas (31 no runtime, após corrigir os erros de compilação), e cada uma foi corrigida individualmente com justificativa — mais confiável que prever todo o blast radius de memória.

## Configurações criadas nesta story (candidatas ao painel de administração futuro)

| Constante | Arquivo | Valor default | Significado |
|---|---|---|---|
| `TONE_THRESHOLDS.tolerancePct` | `comparison-insights-table.tsx` | `0.05` (5%) | Faixa de tolerância ao redor da Turma que ainda lê como empate (tie), nas 4 linhas comparativas. |
| `RECENCY_THRESHOLDS.recentDays` | `comparison-insights-table.tsx` | `7` | Dias desde a última sessão de estudo até os quais a leitura é "recente" (win, verde). |
| `RECENCY_THRESHOLDS.staleDays` | `comparison-insights-table.tsx` | `30` | Acima disso, a leitura vira "sumiu da trilha" (behind, vermelho); entre `recentDays` e este valor, grau intermediário (tie, âmbar). |

## Testing

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2/apps/web
npx tsc --noEmit
npx vitest run src/components/analytics src/lib/analytics
npx biome check src/components/analytics/comparison-insights-table.tsx src/components/analytics/__tests__/comparison-insights-table.test.tsx src/components/analytics/student-home-card.tsx src/components/analytics/__tests__/student-home-card.test.tsx src/lib/analytics/ritmo-summary.ts src/lib/analytics/__tests__/ritmo-summary.test.ts
```

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-19 | Story criada e implementada a partir de feedback ao vivo do Hugo (4 itens): (1) `winnerOf` passa a usar faixa de tolerância de 5% (`TONE_THRESHOLDS`) em vez de igualdade exata para tie; `Leitura["tone"]` reduzido de 5 para 4 valores (`behind-mild`/`behind-severe` consolidados em `behind`, visual vermelho do antigo severe); `behindSeverityOf`/`SEVERE_BEHIND_THRESHOLD` removidos; todo consumidor de tom ajustado (`LEITURA_CHIP`, `VALUE_PILL`, `ACTION_TONE`, `subjectPillFor`, `ValueCell`, `RITMO_TONE_STYLE`, `rowTonesOf`/`summaryToneOf`). (2) `buildRitmoSummary` ganha abertura única e direta "para retomar o seu ritmo de estudos" para o tom atrás, substituindo as duas variantes suavizadas da SH-2.3. (3) "Última sessão de estudo" ganha leitura própria por faixa absoluta de recência (`recencyReadingFor`, `RECENCY_THRESHOLDS.recentDays`=7/`staleDays`=30), desacoplada de `winnerOf`/Turma, propagada para a tabela E para `ritmo-summary.ts` (`rowTonesOf`, `behindMetricsOf`, cláusula de recência). (4) `formatPopulation` → "{N} pessoas ativas". 31 testes runtime corrigidos (nenhum deletado) após `tsc` confirmar 0 erros de compilação. `tsc` exit 0; 342/342 testes verdes; `biome check` limpo nos 6 arquivos tocados. | J.A.R.V.I.S. (@dev, terminal único consolidado) |

## Dev Agent Record

### Contexto de execução

Instrução consolidada do Capataz cobrindo 3 itens grandes + 1 pequeno (item 4, "pessoas ativas", chegou como mensagem separada durante a execução e foi incorporado ao mesmo commit/story, conforme pedido explícito). Change Log da SH-2.3 lido antes de iniciar, conforme instrução.

### Achados durante a implementação

- **Blast radius do item 1 maior que o esperado à primeira leitura:** `winnerOf` era consumido em 9 lugares diferentes entre `comparison-insights-table.tsx` e `ritmo-summary.ts` (2 na tabela: `leituraFor`'s render loop; 7 no painel-resumo: `behindMetricsOf` ×4, `aboveAvgEngagement`, `progressWinner`, `recencyWinner`). Rastreamento via grep ANTES de editar (não confiar em memória) evitou deixar algum consumidor no modelo antigo.
- **`LEITURA_COPY.lastAccess` virou código morto:** ao desacoplar a linha `lastAccess` de `leituraFor` (item 3), a entrada correspondente em `LEITURA_COPY` (um `Record<RowKey, ...>`) não pôde ser removida sem estreitar o tipo `RowKey`/assinatura de `leituraFor` — decisão: manter a entrada, documentada como retirada/não lida, em vez de um refactor de tipo maior e fora do escopo pedido.
- **Recalibração de largura de botão não foi necessária nesta story** (item 1/2/3 não mudam nenhum `ACTION_LABEL`), diferente da SH-2.2 onde a troca de "Retomar atividade" → "Retomar os estudos" exigiu recalcular a fórmula de fonte-por-caractere.
- **A metodologia de "rodar tsc até 0 erros, depois vitest iterativamente" provou mais confiável que reescrever o arquivo de teste (1600+ linhas) por leitura estática** — vários fixtures que PARECIAM precisar de mudança de valor (ex.: `interactions: 7 vs interactionsAvg: 8`, gap 12,5%) na verdade só precisavam de mudança de EXPECTATIVA (o gap continuava fora da faixa de 5%, então o resultado qualitativo — "behind" — não mudou, só o NOME do tom mudou de "behind-mild" para "behind").
- **Um teste de `summaryToneOf` ("empate em tudo → tie") exigiu mudança de VALOR de fixture, não só de expectativa:** `lastAccessDays: 5` (igual ao lado Turma) produzia "win" sob o novo `recencyReadingFor` (5 dias ≤ 7 → recente), quebrando a intenção original do teste de "tudo empatado". Ajustado para `lastAccessDays: 15` (dentro da faixa intermediária 8-30 → tie), preservando a intenção original do teste em vez de aceitar a regressão de sentido.

### File List

- `apps/web/src/components/analytics/comparison-insights-table.tsx` (modificado)
- `apps/web/src/components/analytics/__tests__/comparison-insights-table.test.tsx` (modificado)
- `apps/web/src/components/analytics/student-home-card.tsx` (modificado)
- `apps/web/src/components/analytics/__tests__/student-home-card.test.tsx` (modificado)
- `apps/web/src/lib/analytics/ritmo-summary.ts` (modificado)
- `apps/web/src/lib/analytics/__tests__/ritmo-summary.test.ts` (modificado)
- `docs/stories/epic-student-home/SH-2.5.story.md` (novo)
