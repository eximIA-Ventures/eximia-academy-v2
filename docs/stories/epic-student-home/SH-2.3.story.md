# SH-2.3: Painel-resumo honesto quando o aluno está atrás

**Epic:** [EPIC-STUDENT-HOME](./EPIC-STUDENT-HOME.md)
**Status:** InReview
**Depende de:** SH-2.1 (Turma filtrada para ativos) e SH-2.2 (`s.lastAccessDays`/`r.lastAccessAvgDays` já medindo estudo real, não login) — o painel-resumo consome os indicadores já corrigidos pelas duas.
**Bloqueia:** nenhuma story aberta.
**Paralelizável:** rodou em sequência, por último, depois de SH-2.1 e SH-2.2 (mesmo dev, terminal único). Não paraleliza com trabalho concorrente em `ritmo-summary.ts`.

---

## Story

**As a** Hugo (fundador, dono do produto), olhando o painel-resumo "Meu ritmo" de um aluno atrasado,
**I want** que a abertura do parágrafo-resumo reflita o estado geral REAL do aluno (a mesma severidade que já governa o ícone/glow do painel), nunca um elogio isolado calculado de apenas 1 dos 5 indicadores,
**so that** o painel nunca soe "Parabéns" para um aluno que está, na prática, precisando retomar o ritmo com urgência.

## Contexto (Dev Notes)

### Diagnóstico (achado do Espelho, confirmado em código antes da edição, 2026-07-19)

`buildRitmoSummary` (`apps/web/src/lib/analytics/ritmo-summary.ts`) decidia a abertura do parágrafo usando **`aboveAvgEngagement`** — um booleano derivado de UM ÚNICO indicador (`winnerOf(s.engagement, r.engagementAvg, "higher") === "subject"`). Enquanto isso, o MESMO arquivo já tinha `summaryToneOf` (Round 18, Hugo 2026-07-18) — uma função que olha os **5 indicadores** com hierarquia de severidade correta (`isTopEngagement` > `behind-severe` > `behind-mild` > `win` > `tie` > `none`) e já governa o ícone/glow reativo do painel (`RITMO_TONE_STYLE` em `student-home-card.tsx`). Duas fontes de verdade concorrentes sobre o MESMO estado do aluno, e o texto do parágrafo usava a mais pobre das duas. Consequência prática: um aluno podia estar acima da média SÓ em engajamento e severamente atrás em progresso/interações/reflexões/atividade recente, e o parágrafo ainda abriria com "Parabéns, seu engajamento está acima da média da turma" — enquanto o ícone ao lado já mostrava vermelho (`behind-severe`). O Espelho reconstruiu a frase do caso Angelo caractere-por-caractere e confirmou que o mecanismo batia.

### Correção aplicada

A abertura de `buildRitmoSummary` passou a consumir `summaryToneOf(indicators)` como critério PRIMÁRIO, logo depois do override real de #1:

1. `isTopEngagement === true` → mantém "Parabéns {Nome}, você é o aluno mais engajado da turma" (override real de #1, intocado, decisão já validada AC7/AC9 da SH-1.5).
2. Senão, `tone === "behind-severe"` → abertura honesta, tom de convite (nunca punitivo): **"{Nome}, hora de retomar o seu ritmo de estudos"** (ecoa o `alt` do ícone `behind-severe`, "Hora de retomar o ritmo").
3. Senão, `tone === "behind-mild"` → abertura honesta mais leve: **"{Nome}, um lembrete gentil para retomar o seu ritmo de estudos"** (ecoa o `alt` do ícone `behind-mild`, "Um lembrete gentil para retomar").
4. Senão, se `aboveAvgEngagement` → mantém "Parabéns {Nome}, seu engajamento está acima da média da turma" — agora só dispara quando o tom geral NÃO é atrás (corrige o bug secundário).
5. Senão (tom win genérico, tie ou none) → mantém o ramo neutro atual "Parabéns {Nome}, bom te ver de volta ao seu ritmo de estudos".

As cláusulas de ritmo/recência (item 2 da composição) e a de oportunidade dinâmica (`behindMetricsOf`, item 3) **NÃO mudaram** — já eram factuais, calculadas linha a linha, sem essa mesma inconsistência. Só a abertura mudou.

**Detalhe de copy:** os ramos 2 e 3 (honestos, "atrás") **não abrem com "Parabéns"** — soaria dissonante logo antes de um convite de retomada. Usam só o primeiro nome como vocativo ("{Nome}, hora de retomar..."), espelhando o exemplo literal aprovado pelo Hugo. Sem nome, a abertura cai direto em "hora de retomar..." / "um lembrete gentil...", sem vírgula solta.

### Validação exigida — `summaryToneOf` com o dado já corrigido pela SH-2.2

Como a SH-2.2 já estava implementada antes desta story, `summaryToneOf` calcula a severidade da linha "Última atividade" a partir de `s.lastAccessDays`/`r.lastAccessAvgDays` JÁ CORRIGIDOS (podem ser `null` em vez do `0`/"hoje" que o bug antigo produzia a partir de um login puro). Teste dedicado (`summaryToneOf → behind-severe ... mesmo com lastAccessDays=null`) confirma que o caso Angelo, com `lastAccessDays: null`, ainda produz `tone: "behind-severe"` corretamente — ele continua atrás em progresso/interações/reflexões/engajamento de qualquer forma, então a linha "Última atividade" nem precisa contribuir para a severidade geral aqui (a hierarquia já é dominada pelas outras 4).

### Caso Angelo — frase reconstruída, ANTES e DEPOIS

**ANTES** (dado com login puro contando como atividade, SH-2.2 ainda não aplicada, MAIS o bug secundário desta story se `aboveAvgEngagement` calhasse de ser `true`): risco de abertura "Parabéns Angelo, seu engajamento está acima da média da turma" mesmo com o aluno severamente atrás em todo o resto — dissonante com o ícone vermelho do painel.

**DEPOIS** (SH-2.2 + SH-2.3 aplicadas, indicadores do Angelo: 0% progresso, 0/8 interações, 1/41 reflexões, engajamento muito abaixo da média, `lastAccessDays: null`):

> "Angelo, hora de retomar o seu ritmo de estudos. Sua oportunidade de melhoria é evoluir em progresso, interações, reflexões e engajamento."

Nenhum "Parabéns", nenhuma alegação de "acima da média" isolada, tom honesto e nunca punitivo (convite, não repreensão) — coerente com o ícone/glow vermelho (`behind-severe`) que já era exibido ao lado.

## Acceptance Criteria

- [x] **AC1:** A abertura de `buildRitmoSummary` consulta `summaryToneOf(indicators)` e aplica a precedência: `isTopEngagement` > `behind-severe` > `behind-mild` > `aboveAvgEngagement` (só se o tom não for atrás) > neutro.
- [x] **AC2:** Um aluno com `aboveAvgEngagement === true` E `summaryToneOf === "behind-severe"` NUNCA recebe a abertura "seu engajamento está acima da média da turma" — recebe a abertura honesta de `behind-severe`.
- [x] **AC3:** O mesmo vale para `behind-mild`.
- [x] **AC4:** O override de `isTopEngagement === true` continua vencendo qualquer tom geral (mesmo com algo severamente atrás) — decisão AC7/AC9 da SH-1.5, intocada.
- [x] **AC5:** As aberturas honestas (`behind-severe`/`behind-mild`) nunca contêm "Parabéns"; usam só o nome como vocativo, ou nenhum vocativo se o nome estiver ausente.
- [x] **AC6:** `summaryToneOf` (função já existente, não modificada) segue computando corretamente com o dado já corrigido pela SH-2.2 (`lastAccessDays`/`lastAccessAvgDays` podendo ser `null`) — teste dedicado com o caso Angelo.
- [x] **AC7:** As cláusulas de ritmo/recência e a de oportunidade dinâmica (`behindMetricsOf`) permanecem intocadas — nenhuma mudança de comportamento fora da abertura.
- [x] **AC8:** Sem regressão: os testes pré-existentes de AC8/AC9 (cenários A/B/C da SH-1.5) e de `summaryToneOf` (Round 18) seguem verdes sem modificação de expectativa (só reforço de comentário no cenário B).

## Tasks

- [x] 1. Confirmar em código o estado atual de `buildRitmoSummary`/`summaryToneOf` antes de editar (diagnóstico do Espelho já aprovado, confirmação de código feita nesta implementação).
- [x] 2. Reordenar a decisão da abertura para consumir `summaryToneOf` como critério primário, preservando o override de `isTopEngagement`.
- [x] 3. Escrever as 2 novas frases honestas (`behind-severe`/`behind-mild`), ecoando os `alt` dos ícones já existentes em `RITMO_TONE_STYLE` (`student-home-card.tsx`).
- [x] 4. Escrever testes cobrindo: o bug corrigido (aboveAvgEngagement true + tone behind-severe/mild → NÃO elogia), o override de #1 intocado, a ausência de "Parabéns" nos ramos honestos, e o caso Angelo (summaryToneOf + buildRitmoSummary com dado da SH-2.2).
- [x] 5. `tsc --noEmit` + `vitest run src/components/analytics src/lib/analytics` + `biome check` nos arquivos tocados, tudo verde.

## Complexidade & Riscos

- **Complexidade:** S/M (small/medium). Reordenação de uma cadeia de `if/else` dentro de uma função pura já existente, mais 2 frases novas de copy, mais testes. Nenhuma mudança de assinatura, nenhuma mudança de schema.
- **Riscos:**
  - R1 (médio, mitigado): esquecer de excluir "Parabéns" dos ramos honestos deixaria a abertura soar dissonante ("Parabéns, hora de retomar..."). Mitigação: `nameLead` dedicado (sem "Parabéns"), testado explicitamente (AC5).
  - R2 (baixo): a reordenação acidentalmente mudar o resultado de cenários que já passavam (ex.: AC9 cenário B da SH-1.5). Mitigação: suíte completa rodada após a mudança, 336/336 verde, incluindo os testes pré-existentes sem modificação de expectativa.
  - R3 (baixo, verificado): a severidade calculada por `summaryToneOf` para "Última atividade" mudar de comportamento por causa da SH-2.2 (lastAccessDays agora podendo ser `null` com mais frequência). Mitigação: AC6, teste dedicado com o caso Angelo confirmando `behind-severe` correto mesmo com `null`.

## Dev Notes

- **Arquivo de produção tocado:** `apps/web/src/lib/analytics/ritmo-summary.ts` (só `buildRitmoSummary`; `summaryToneOf`/`rowTonesOf`/`behindMetricsOf` NÃO foram modificadas, só consumidas).
- **Arquivo de teste tocado:** `apps/web/src/lib/analytics/__tests__/ritmo-summary.test.ts` (6 testes novos + 1 comentário reforçado; nenhum teste pré-existente teve sua asserção alterada).
- **NÃO tocar** `student-home-card.tsx` (`RITMO_TONE_STYLE`, ícone/glow) — a copy nova dos ramos honestos foi escrita para ECOAR os `alt` já existentes lá, não para sincronizar programaticamente com eles (decisão de implementação: strings duplicadas propositalmente, o `alt` é para acessibilidade do ícone, a abertura é para o texto do parágrafo — mesmo espírito, textos formatados de forma diferente para o contexto de cada um).
- **Reusar, não reinventar:** `summaryToneOf` já existia (Round 18, SH-1.5) e já era usado para o ícone — esta story apenas conecta a MESMA fonte de verdade à abertura do texto, sem criar nenhuma lógica de severidade nova.

## Testing

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2/apps/web
npx tsc --noEmit
npx vitest run src/components/analytics src/lib/analytics
npx biome check src/lib/analytics/ritmo-summary.ts src/lib/analytics/__tests__/ritmo-summary.test.ts
```

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-19 | Story criada e implementada a partir do achado do Espelho (reconstrução caractere-por-caractere da frase do caso Angelo). `buildRitmoSummary` reordenado para consumir `summaryToneOf` como critério primário da abertura (depois do override de #1): `behind-severe`/`behind-mild` ganham aberturas honestas e não-punitivas próprias ("hora de retomar o seu ritmo de estudos" / "um lembrete gentil para retomar o seu ritmo de estudos"), sem "Parabéns"; o elogio de engajamento isolado ("seu engajamento está acima da média da turma") só dispara quando o tom geral NÃO é atrás. 6 testes novos cobrindo o bug corrigido, o override de #1 intocado, e o caso Angelo com o dado já corrigido pela SH-2.2 (`lastAccessDays: null`). `tsc` exit 0; 336/336 testes verdes (330 + 6 novos); `biome check` limpo. | J.A.R.V.I.S. (@dev, terminal único consolidado) |

## Dev Agent Record

### Contexto de execução

Diagnóstico do Espelho (reconstrução da frase do Angelo, identificação da fonte concorrente `aboveAvgEngagement` vs. `summaryToneOf`) já tinha sido apresentado e aprovado antes desta implementação. A implementação seguiu exatamente a precedência de 5 passos definida no mapeamento aprovado pelo Hugo, sem reabrir o diagnóstico.

### Achados durante a implementação

- `summaryToneOf` já existia no MESMO arquivo (`ritmo-summary.ts`), como uma declaração de função top-level depois de `buildRitmoSummary` no código-fonte — chamável sem import (hoisting de function declarations), sem criar dependência circular nem precisar mover a ordem das funções no arquivo.
- A primeira versão da correção usou `hi.replace("Parabéns ", "")` para suprimir o prefixo nos ramos honestos — refatorado para um `nameLead` dedicado (`${name}, ` sem "Parabéns"), mais direto e sem manipulação de string frágil.
- Confirmado que os testes pré-existentes de `summaryToneOf` (Round 18) e AC9 cenário B (SH-1.5) continuam verdes SEM nenhuma alteração de expectativa — o fixture `BASE` usado por eles vence em tudo (tom "win"), então nunca cruzava com os novos ramos `behind-*`. A prova de que a reordenação não regrediu nada veio da suíte completa (336/336), não de inspeção isolada.
- O caso Angelo foi modelado com `lastAccessDays: null` (não `0`), refletindo o dado JÁ CORRIGIDO pela SH-2.2 — o teste confirma que `summaryToneOf` chega em `behind-severe` corretamente mesmo assim, porque as outras 4 linhas (progresso/interações/reflexões/engajamento) já dominam a severidade independente do que a linha "Última atividade" diz.

### File List

- `apps/web/src/lib/analytics/ritmo-summary.ts` (modificado)
- `apps/web/src/lib/analytics/__tests__/ritmo-summary.test.ts` (modificado)
- `docs/stories/epic-student-home/SH-2.3.story.md` (novo)
