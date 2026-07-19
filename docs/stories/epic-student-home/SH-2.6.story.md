# SH-2.6: Tom geral do painel-resumo sensível à PROPORÇÃO de linhas atrás

**Epic:** [EPIC-STUDENT-HOME](./EPIC-STUDENT-HOME.md)
**Status:** InReview
**Depende de:** SH-2.5 (modelo de 4 tons `win`/`tie`/`behind`/`none`, sem mais mild/severe — esta story reforma como `summaryToneOf` COMBINA esses 4 tons das 5 linhas num tom geral, não o vocabulário de tons em si).
**Bloqueia:** nenhuma story aberta.
**Paralelizável:** rodou sozinha, terminal único, imediatamente depois da SH-2.5, a partir de feedback ao vivo do Hugo olhando o app com os fixes SH-2.5 já em produção. Não paraleliza com trabalho concorrente em `ritmo-summary.ts`/`student-home-card.tsx`.

---

## Story

**As a** Hugo (fundador, dono do produto), olhando o painel-resumo do aluno Rinaldo (4 linhas boas + 1 vermelha, Progresso 50 vs Turma 67),
**I want** que o tom geral do painel-resumo (a frase embaixo da tabela + o ícone/glow reativo) reflita a PROPORÇÃO real de linhas problemáticas, não só a existência de UMA linha ruim isolada,
**so that** um aluno majoritariamente bem (4/5 linhas boas) não leia um painel 100% vermelho por causa de 1 métrica isolada atrás.

## Contexto (Dev Notes)

### O caso Rinaldo (motivação, evidência)

O Hugo viu o painel do Rinaldo: 4 linhas verdes (Última sessão de estudo, Interações, Reflexões, Engajamento) + 1 vermelha (Progresso, 50 vs 67 da Turma), e a frase do painel abriu vermelho: "Rinaldo, para retomar o seu ritmo de estudos...". Ele rejeitou, verbatim: *"se a gente levar em consideração o Rinaldo está com 4 indicadores acima da média enquanto um vermelho, então ele não pode estar com a frase embaixo vermelho, ele tem que estar com a frase embaixo em âmbar."*

### Diagnóstico (confirmado em código antes da edição, 2026-07-19)

`summaryToneOf` (`ritmo-summary.ts`, herdado do Round 18 da SH-1.5, revisado pela SH-2.5) era **severity-first puro**: bastava UMA linha em tom `behind` para o tom geral inteiro virar `behind`. Essa regra fazia sentido no modelo antigo de 5 tons (`win`/`tie`/`behind-mild`/`behind-severe`/`none`), onde `behind-mild` já sinalizava "atenção mas não crítico" separado de `behind-severe`. A SH-2.5 (a pedido do próprio Hugo) COLAPSOU `behind-mild`+`behind-severe` num único `behind` (vermelho direto, sem gradiente) — e a regra "qualquer linha behind domina" ficou grosseira demais: sem o gradiente de severidade absorvendo o caso "1 linha moderadamente atrás", QUALQUER linha atrás (mesmo 1 de 5) virava vermelho total, uma regressão de nuance introduzida como efeito colateral não-intencional da simplificação da SH-2.5.

### Correção aplicada

`summaryToneOf` passou a contar QUANTAS das 5 linhas estão em tom `behind` (`behindCount`), e decidir o tom geral pela PROPORÇÃO:

```
1. isTopEngagement === true            → "win" (override real de #1, intocado)
2. behindCount >= SUMMARY_TONE_BEHIND_COUNT_FOR_RED (2)  → "behind" (vermelho)
3. behindCount === 1                   → "tie" (âmbar)
4. behindCount === 0, alguma linha win → "win" (fallback pré-existente)
5. behindCount === 0, só ties          → "tie" (fallback pré-existente)
6. nenhum dado comparável              → "none"
```

**Constante nomeada configurável** (mesmo espírito de `TONE_THRESHOLDS`/`RECENCY_THRESHOLDS` da SH-2.5): `SUMMARY_TONE_BEHIND_COUNT_FOR_RED = 2`, em `ritmo-summary.ts`, candidata ao painel de configuração futuro do Hugo.

**Os 2 casos de validação exigidos:**

| Caso | Linhas behind | Tom geral ANTES (SH-2.5) | Tom geral DEPOIS (SH-2.6) |
|---|---|---|---|
| **Rinaldo** (real, screenshot do Hugo): Progresso 50 vs 67, resto bom | 1/5 | `behind` (vermelho) ❌ | **`tie` (âmbar)** ✓ |
| **Angelo** (SH-2.3, screenshot do Hugo): 0% progresso, 0/8 interações, 1/41 reflexões, engajamento baixo | 4/5 | `behind` (vermelho) ✓ | **`behind` (vermelho)** ✓ (mantido) |

Os dois casos são testados explicitamente (ver §Testing).

### Abertura do painel-resumo — nova variante "tie"

`buildRitmoSummary` ganhou um 3º ramo de abertura (entre o `behind` direto e o ramo neutro/de elogio pré-existente), disparado quando `summaryToneOf === "tie"` **e** existe de fato uma métrica fraca (`behindMetricsOf(indicators).length > 0`, distinguindo do "tie" genuíno de 0 linhas atrás, ex.: tudo empatado com a média):

> **"{Nome}, seu ritmo está bom, com um ponto de atenção"**

Honesta mas mais leve que o `behind` direto — reconhece que a maior parte do quadro está bem, sem alegar um problema generalizado. **Sem "Parabéns"** (mesmo precedente do ramo `behind` da SH-2.5) e **sem suavização** ("lembrete gentil"/"convite suave" — o Hugo já rejeitou esse tom explicitamente no fix anterior, SH-2.5 item 2). A cláusula de oportunidade (`behindMetricsOf`) continua nomeando dinamicamente a métrica fraca real (ex.: "progresso" para o Rinaldo).

**Precedência:** o ramo `tie` foi inserido ANTES do ramo `aboveAvgEngagement` (mesmo motivo do `behind` na SH-2.3/2.5 — um aluno pode estar acima da média SÓ em engajamento e ainda ter 1 linha atrás; a abertura não pode elogiar o engajamento isolado ignorando essa linha).

### Ícone/glow do painel (RITMO_TONE_STYLE)

`RITMO_TONE_STYLE.tie` (student-home-card.tsx) **já existia** desde antes da SH-2.5 (ícone `Minus`, âmbar `bg-semantic-warning/15`) — não precisou de nenhuma mudança de código, só passou a ser exercitado com MUITO mais frequência agora que `summaryToneOf` retorna `tie` para o caso "1 linha atrás". Confirmado com teste novo dedicado (nenhuma cobertura prévia existia para o tom `tie` no ícone do painel).

## Acceptance Criteria

- [x] **AC1:** `summaryToneOf` conta linhas em tom `behind` (`behindCount`) via `rowTonesOf`, e decide o tom geral pela proporção (ver tabela de precedência acima).
- [x] **AC2:** `SUMMARY_TONE_BEHIND_COUNT_FOR_RED` é constante nomeada única (valor `2`), não hardcoded espalhado.
- [x] **AC3 (validação Rinaldo):** fixture com Progresso atrás (gap fora da faixa de 5%) e as outras 4 linhas boas → `summaryToneOf` retorna `"tie"`.
- [x] **AC4 (validação Angelo):** fixture com 4/5 linhas atrás (dado já corrigido pela SH-2.2/SH-2.3) → `summaryToneOf` retorna `"behind"` (comportamento preservado).
- [x] **AC5:** `buildRitmoSummary` tem abertura própria para `tone === "tie" && behind.length > 0`: "{Nome}, seu ritmo está bom, com um ponto de atenção" — nunca "Parabéns", nunca "lembrete gentil"/"convite".
- [x] **AC6:** Um "tie" genuíno (`behind.length === 0`, ex.: tudo empatado) NÃO usa a copy de "ponto de atenção" — permanece no ramo neutro pré-existente.
- [x] **AC7:** O override de `isTopEngagement` (#1 real) continua vencendo qualquer proporção de linhas atrás, intocado.
- [x] **AC8:** `RITMO_TONE_STYLE.tie` (ícone Minus, âmbar) renderiza corretamente para o novo caso "1 linha behind" — coberto por teste dedicado (não havia nenhuma cobertura prévia do tom `tie` no ícone do painel).
- [x] **AC9:** Sem regressão: suíte completa (`src/components/analytics` + `src/lib/analytics`) 100% verde, incluindo os testes SH-2.5 que dependiam da regra "qualquer behind domina" (ajustados para fixtures de 2+ linhas, preservando a intenção original de cada teste).

## Tasks

- [x] 1. Confirmar em código o comportamento atual de `summaryToneOf` antes de editar (severity-first puro, achado do próprio feedback do Hugo).
- [x] 2. Implementar `SUMMARY_TONE_BEHIND_COUNT_FOR_RED` + a lógica de contagem/proporção em `summaryToneOf`.
- [x] 3. Adicionar o ramo `tie` (com guarda `behind.length > 0`) em `buildRitmoSummary`, reordenando `behindMetricsOf` para ser calculado ANTES da abertura (a guarda precisa do resultado).
- [x] 4. Confirmar que `RITMO_TONE_STYLE.tie` já cobre o caso visualmente (não precisou de mudança de código) e escrever o teste que faltava.
- [x] 5. Ajustar os testes da SH-2.5 que assumiam "1 linha behind → tom geral behind" (agora produzem `tie`) para fixtures de 2+ linhas, preservando a intenção original de cada teste.
- [x] 6. Escrever os 2 casos de validação explícitos (Rinaldo 1/5→tie, Angelo 4/5→behind, este último já coberto pela suíte da SH-2.3/2.5).
- [x] 7. `tsc --noEmit` + `vitest run src/components/analytics src/lib/analytics` + `biome check` nos arquivos tocados, tudo verde.

## Complexidade & Riscos

- **Complexidade:** M (medium). Mudança pontual e bem isolada em uma função pura (`summaryToneOf`) + um ramo novo em outra (`buildRitmoSummary`'s opening), mas com blast radius em vários testes da story anterior (SH-2.5) que assumiam a regra antiga "qualquer behind domina".
- **Riscos:**
  - R1 (alto, mitigado): reformar a proporção sem preservar o caso Angelo (4/5 → deve continuar vermelho) — regressão do comportamento já validado na SH-2.3. Mitigação: AC4 explícito, teste dedicado reusando o fixture real do Angelo.
  - R2 (médio, mitigado): o corte de proporção (`SUMMARY_TONE_BEHIND_COUNT_FOR_RED`) hardcoded em múltiplos lugares em vez de uma constante única. Mitigação: AC2, 1 constante, 1 ponto de leitura.
  - R3 (médio, mitigado): a nova copy "tie" disparando também para o "tie genuíno" (0 linhas atrás, ex.: tudo empatado), alegando um "ponto de atenção" que não existe. Mitigação: guarda `behind.length > 0` (AC6), testada explicitamente com o fixture de empate total.
  - R4 (baixo): `RITMO_TONE_STYLE.tie` nunca ter sido exercitado por teste antes desta story (falso-positivo de "já funciona"). Mitigação: teste novo dedicado, cobrindo ícone/classe/cor.

## Dev Notes

- **Arquivo de produção tocado:** `apps/web/src/lib/analytics/ritmo-summary.ts` (`summaryToneOf` + `buildRitmoSummary`). `student-home-card.tsx` (`RITMO_TONE_STYLE`) **NÃO precisou de mudança** — o tom `tie` já existia lá desde antes da SH-2.5.
- **Arquivos de teste tocados:** `apps/web/src/lib/analytics/__tests__/ritmo-summary.test.ts` (ajustes + testes novos, incluindo os 2 casos de validação), `apps/web/src/components/analytics/__tests__/student-home-card.test.tsx` (1 teste novo, cobertura do ícone `tie` que faltava).
- **NÃO tocar** `comparison-insights-table.tsx` — o modelo de 4 tons por LINHA (win/tie/behind/none, SH-2.5) não mudou; só a forma como o tom GERAL do painel combina essas 5 linhas.
- **Reusar, não reinventar:** `rowTonesOf` (já existente) continua sendo a única fonte das 5 leituras por linha; `behindMetricsOf` (já existente) foi apenas RELOCADO para antes da abertura em `buildRitmoSummary` (mesma lógica, sem duplicação).

## Testing

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2/apps/web
npx tsc --noEmit
npx vitest run src/components/analytics src/lib/analytics
npx biome check src/lib/analytics/ritmo-summary.ts src/lib/analytics/__tests__/ritmo-summary.test.ts src/components/analytics/__tests__/student-home-card.test.tsx
```

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-19 | Story criada e implementada a partir de feedback ao vivo do Hugo (caso Rinaldo: 4 linhas boas + 1 vermelha não pode pintar o painel inteiro de vermelho). `summaryToneOf` passou a ser sensível à PROPORÇÃO de linhas `behind` (`SUMMARY_TONE_BEHIND_COUNT_FOR_RED = 2`): 1 linha atrás → tom geral `tie` (âmbar); 2+ → `behind` (vermelho, comportamento preservado, caso Angelo). `buildRitmoSummary` ganhou abertura própria para o tom `tie` com métrica fraca real ("seu ritmo está bom, com um ponto de atenção"), guardada contra o "tie genuíno" (0 linhas atrás). `RITMO_TONE_STYLE.tie` (ícone Minus, âmbar) confirmado funcionando, sem precisar de mudança — só ganhou o teste que faltava. Testes da SH-2.5 que assumiam "qualquer behind domina" ajustados para fixtures de 2+ linhas (intenção original preservada). Validado explicitamente: Rinaldo (1/5 behind) → tie; Angelo (4/5 behind) → behind. `tsc` exit 0; 346/346 testes verdes; `biome check` limpo. | J.A.R.V.I.S. (@dev, terminal único consolidado) |

## Dev Agent Record

### Contexto de execução

Diagnóstico e correção pedidos diretamente pelo Hugo a partir de observação ao vivo do app com os fixes SH-2.5 já em produção. A regra final (proporção com corte em 2) e os 2 casos de validação (Rinaldo/Angelo) foram especificados explicitamente pelo Hugo antes da implementação.

### Achados durante a implementação

- `behindMetricsOf` precisou ser movido para ANTES do cálculo da abertura em `buildRitmoSummary` — o ramo novo (`tie` + "ponto de atenção") precisa saber se `behind.length > 0` para se diferenciar do "tie genuíno", e essa lista só era calculada depois, na cláusula 3 (oportunidade). Reordenação sem duplicar lógica (mesma chamada, só antecipada).
- 5 testes da SH-2.5 (2 em `summaryToneOf`, 3 em `buildRitmoSummary`) assumiam fixtures de exatamente 1 linha atrás esperando tom geral `behind` — todos precisaram de ajuste. Em vez de simplesmente mudar a expectativa para `tie` (o que teria testado o comportamento ERRADO para o propósito original de cada teste, que era provar o bug do Espelho no ramo `behind`), os fixtures dos testes de `buildRitmoSummary` foram ajustados para 2 linhas atrás (preservando a prova original), e um bloco NOVO e dedicado foi criado para provar a mesma classe de bug (elogio de engajamento isolado) no ramo `tie`.
- `RITMO_TONE_STYLE.tie` não tinha NENHUM teste dedicado antes desta story — um gap de cobertura pré-existente que só ficou visível porque o `tie` agora é exercitado com muito mais frequência (antes só disparava no "tudo empatado", um caso raro; agora dispara em qualquer "exatamente 1 linha atrás", um caso comum).

### File List

- `apps/web/src/lib/analytics/ritmo-summary.ts` (modificado)
- `apps/web/src/lib/analytics/__tests__/ritmo-summary.test.ts` (modificado)
- `apps/web/src/components/analytics/__tests__/student-home-card.test.tsx` (modificado)
- `docs/stories/epic-student-home/SH-2.6.story.md` (novo)
