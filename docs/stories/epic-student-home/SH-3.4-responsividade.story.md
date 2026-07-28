# SH-3.4: Responsividade da região "Meu ritmo" (home do aluno) + banner "Meu plano"

**Epic:** [EPIC-STUDENT-HOME](./EPIC-STUDENT-HOME.md)
**Status:** InReview
**Depende de:** [SH-3.3](./SH-3.3.story.md) (o 3º toggle "Comparativo com o Plano", o `PlanComparisonPanel` e o `StudyPlanInviteStrip` R5 — tudo reusado sem alteração de comportamento).
**Bloqueia:** nenhuma.
**Paralelizável:** toca APENAS `apps/web/src/components/analytics/` (student-home-card.tsx, comparison-insights-table.tsx, plan-comparison-panel.tsx, study-plan-invite-strip.tsx, student-comparison-view.tsx). NÃO toca `meu-plano/`, `plan-dashboard-data.ts`, `page.tsx`, nenhum teste existente, nenhum schema. (Fatia coordenada pelo Capataz para não colidir com o terminal Forja, que trabalha em `meu-plano/` em paralelo; por isso esta story é um arquivo NOVO e o Change Log da SH-3.3 não foi tocado.)

---

## Story

**As a** aluno abrindo a home num celular,
**I want** que o card "Meu ritmo" (os 3 toggles), as tabelas comparativas e o banner "Meu plano" caibam na tela sem estourar horizontalmente, com botões tocáveis,
**so that** a experiência mobile seja tão funcional quanto a desktop que o Hugo já aprovou — sem mudar UM pixel do desktop.

## Contexto (Dev Notes)

Ordem do Hugo para a rodada: *"chegou a hora de fazer tudo ultra responsivo e funcional"*. O pior caso era a `ComparisonInsightsTable`: 5 colunas com botões de ação de largura FIXA `w-[205px]` (simetria dos Rounds 25/26) — num viewport de 320-390px a tabela estoura brutalmente. A `PlanComparisonTable` (4 colunas + ação) tinha o mesmo problema em menor grau.

## A decisão central — opção (b), mas SEM duplicar DOM (colapso CSS-only)

O briefing oferecia: **(a)** wrapper `overflow-x-auto` + scroll horizontal no mobile (mínimo aceitável — na prática já existia nos dois arquivos), ou **(b)** layout responsivo real, tabela colapsando em cards empilhados por indicador no mobile.

**Escolhi a (b), implementada como colapso CSS-ONLY dos MESMOS nós de tabela** — não a implementação ingênua de (b) com dois blocos de markup (`<table>` escondida no mobile + cards `lg:hidden`). Motivo, verificado ANTES de decidir: os 133 testes de `comparison-insights-table.test.tsx` usam `screen.getByTestId`/`getByText` ESTRITOS (lançam erro com match duplicado), e o jsdom não aplica CSS — dois layouts coexistindo no DOM duplicariam testids ("row-*", "cell-*", "action-*") e textos ("Interações realizadas", "Eu (Rinaldo)"), regredindo a suíte em massa. Duplicar markup também criaria dois pontos de manutenção para a mesma linha.

A técnica: abaixo de `lg`, os próprios elementos `<table>/<thead>/<tbody>/<tr>/<td>` mudam de display via variantes `max-lg:*` do Tailwind:

| Elemento | Desktop (lg+) | Mobile (abaixo de lg) |
|:---|:---|:---|
| `<table>` / `<tbody>` | display nativo de tabela (nenhuma variante se aplica) | `max-lg:block` |
| `<thead>` | header aprovado, intacto | `max-lg:hidden` (colunas ganham mini-cabeçalhos por célula) |
| `<tr>` | `table-row` nativo, hover/divisores intactos | `max-lg:grid max-lg:grid-cols-2 max-lg:gap-3 max-lg:p-4` — cada linha vira um CARD |
| `<td>` nome / chip / ação | padding/alinhamento aprovados | `max-lg:col-span-2 max-lg:p-0` (linha inteira do card) |
| `<td>` Você·Turma (ou Meu plano·Realizado) | idem | `max-lg:p-0`, lado a lado nas 2 colunas do grid, com mini-cabeçalho `lg:hidden` acima do valor |
| ActionButton / Link de ação | `w-[205px]` simétrico (Rounds 25/26) intacto | `max-lg:w-full max-lg:min-h-11` (full-width, toque ≥44px) |

Como TODA mudança é `max-lg:*`/`max-sm:*` (nenhuma classe base foi alterada, apenas acrescida), **em lg+ nenhuma regra nova se aplica — o desktop aprovado fica intacto classe por classe**, que era a restrição inegociável da rodada.

### Mini-cabeçalhos em minúsculas (detalhe deliberado, não descuido)

Com o `<thead>` oculto no mobile, as células de valor ganham labels próprios ("você"/"turma" na tabela principal; "meu plano"/"realizado" na do plano). Eles estão em **minúsculas no texto com `uppercase` via CSS**: os testes exigem que "Você", "Eu (Rinaldo)", "Turma" e "Meu plano" (strings do thead) sigam ÚNICOS nas queries `getByText` case-sensitive. O usuário vê "VOCÊ"/"TURMA" renderizado; o DOM preserva a unicidade que a suíte assume. No mobile o label do sujeito é o genérico "você" (não "eu (nome)") — compacto e sem colisão de texto.

## O que mudou por arquivo

1. **`comparison-insights-table.tsx`** — colapso CSS-only descrito acima (o pior caso). Extra: `LeituraChip` ganhou `max-lg:whitespace-normal` para a copy longa do freio SH-2.7.1 ("Acima da turma, mas apenas N% do seu potencial") quebrar com graça no card em vez de estourar; `nowrap` intacto em lg+.
2. **`plan-comparison-panel.tsx`** — MESMO tratamento na tabela MEU PLANO | REALIZADO | COMO ESTOU | AÇÃO (decisão idêntica, documentada em comentário cruzado). Os 2 cards abaixo já empilhavam (`space-y-4`, sem mudança). Botões "Recalcular plano"/"Manter como está": `max-sm:w-full max-sm:min-h-11` — full-width empilhados em telas pequenas (o `w-full` dentro do `flex-wrap` ocupa a linha inteira), lado a lado em sm+ como aprovado.
3. **`student-home-card.tsx`** — o CardHeader já tinha `flex-col lg:flex-row` + `flex-wrap` nos 3 SegButtons (wrap decente confirmado; "Comparativo com o Plano" ~210px cabe em 320px). Única mudança: `max-lg:h-11` no SegButton (toque ≥44px; `h-9` intacto em lg+). `RitmoSummaryPanel` conferido: `flex-col sm:flex-row`, padding e tipografia mobile já adequados — sem mudança.
4. **`study-plan-invite-strip.tsx`** — CUIDADO MÁXIMO (R5 recém-aprovado): mudança mínima possível, SÓ abaixo de `sm`: `max-sm:gap-3 max-sm:px-4 max-sm:py-4` no Link para o título/subtítulo quebrarem com folga. Quadrado do ícone (h-11 w-11, blindagem de 4 camadas) e seta (h-8 w-8) NÃO mudam de tamanho em nenhum breakpoint; gradiente/cores/estrutura intocados. Os 9 testes (inclusive a regressão das 4 camadas do SVG) verdes.
5. **`student-comparison-view.tsx`** (vista "Gráficos") — a metade esquerda de cada `SignalRow` era um flex de larguras fixas (~440px: label w-44 + valor w-16 + média w-20 + chip) que estourava phones estreitos. Abaixo de `sm`: `max-sm:flex-wrap` no container + `max-sm:w-full` no label (label na própria linha; valor/média/chip cabem em 320px na linha de baixo). Só utilitários PADRÃO — a regra CSS-PIPELINE IMMUNITY do arquivo (sem valores arbitrários) foi respeitada. Barras renderizam full-width abaixo do texto (comportamento pré-existente do `flex-col`).
6. **Touch targets ≥44px** — ActionButton, links de ação da tabela do plano, botões do ajuste sugerido e SegButtons: todos com `min-h-11`/`h-11` no mobile.

## Acceptance Criteria

- [x] **AC1:** Nenhum overflow horizontal da página em viewport mobile nos 3 toggles do "Meu ritmo" — as duas tabelas colapsam em cards empilhados por indicador abaixo de `lg`.
- [x] **AC2 (desktop intocado):** Em lg+ nenhuma variante `max-lg:`/`max-sm:` se aplica; nenhuma classe base foi removida ou alterada em nenhum dos 5 componentes — o visual aprovado pelo Hugo permanece classe por classe.
- [x] **AC3 (zero regressão):** Suíte completa de `src/components/analytics` verde — **265/265 testes** (133 da tabela principal, 19 do plano, 33 do home card, 9 do strip, 31 da tabela do gestor, demais puros). Nenhum teste foi editado.
- [x] **AC4 (testids/semântica preservados):** Todos os `data-testid` existentes seguem presentes e ÚNICOS no DOM (um único layout, re-displayado por CSS); 5 `<th>`/5 `<td>` por linha preservados (asserções estruturais da suíte).
- [x] **AC5 (banner):** `StudyPlanInviteStrip` abaixo de `sm` compacta padding/gap sem alterar ícone, seta, gradiente ou estrutura; 9 testes verdes.
- [x] **AC6 (touch):** Elementos clicáveis da região com alvo ≥44px no mobile.
- [x] **AC7 (gates):** `npx tsc --noEmit` limpo · `npx vitest run src/components/analytics` 265 passed · `npx biome check` limpo nos 5 arquivos tocados.

## Comandos de Verificação (executados, todos verdes)

```bash
cd apps/web
npx tsc --noEmit                                  # limpo
npx vitest run src/components/analytics           # 8 files, 265 tests passed
npx biome check src/components/analytics/student-home-card.tsx \
  src/components/analytics/comparison-insights-table.tsx \
  src/components/analytics/plan-comparison-panel.tsx \
  src/components/analytics/study-plan-invite-strip.tsx \
  src/components/analytics/student-comparison-view.tsx   # limpo
```

## Change Log

| Data | Mudança | Autor |
|:---|:---|:---|
| 2026-07-22 | Story criada e implementada: responsividade mobile-first da região "Meu ritmo" + banner, via colapso CSS-only (`max-lg:`/`max-sm:` variants, DOM único). Opção (b) do briefing escolhida na variante sem duplicação de markup (justificativa na seção "A decisão central"). 5 arquivos tocados, 0 testes editados, 265/265 verdes. Sem commit/push (aguardando revisão do Capataz). | @dev (Coder Opus, linha Maestri) |
