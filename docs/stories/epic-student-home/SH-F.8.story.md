# SH-F.8: Copy polish "organização" → "turma" no Meu ritmo (Tier-3, só display)

**Epic:** [EPIC-STUDENT-HOME-FINALIZACAO](./EPIC-STUDENT-HOME-FINALIZACAO.md)
**Status:** Draft
**Insumo obrigatório:** **`08-copy-turma-plan.md` (plano-fonte, ler inteiro)**. Constitution Art. IV, nada fora do plano.
**Executores:** **Malho** (aplica a copy) + **Lupa** (verifica). Malho não é @devops, NÃO pusha.
**Depende de:** fazer DEPOIS de SH-F.7 fechar (não atropelar o review LGPD focado), na MESMA worktree. HEAD já avançou para `75a7b8e` (F.7 dentro).
**Bloqueia:** nada. Entra no build de produção BATCHED com SH-F.6 + SH-F.7 (um único verde).
**Paralelizável:** NÃO com o resto do surface Meu ritmo (toca copy dos mesmos componentes), mas é trivial e sequenciada após F.7.
**Base:** worktree `integration/main-x-engagement` (HEAD `75a7b8e`), NÃO a main. main intocada em `52a54f5`. ZERO push.
**Tier:** 3 (copy polish, verbatim do Hugo). Zero lógica, zero dado, zero renomeação de identificador.

---

## Story

**As a** aluno olhando o card "Meu ritmo" num deploy per-client,
**I want** que a nomenclatura user-facing diga "turma" em vez de "organização" (subtítulo e label da linha de comparação),
**so that** a copy fique precisa para o contexto per-client (tenant = cliente → seus alunos = "a turma"), sem mudar o cálculo (a média continua org-wide) nem nenhum identificador interno.

## Contexto (Dev Notes)

Verbatim do Hugo. É SÓ COPY DE DISPLAY: a média continua **ORG-WIDE** (todos os alunos do tenant); no deploy per-client tenant = cliente, então alunos = "a turma", logo "Média da turma" é preciso. **Nenhuma mudança de cálculo, tipo, variável ou chave de cache.**

Anchors reconferidos read-only na worktree `/Users/hugocapitelli/Dev/eximia/integration-worktree` (branch `integration/main-x-engagement`, HEAD `75a7b8e`):

- `student-home-card.tsx:110` → `Como você está em relação à organização nos últimos 30 dias.`
- `comparison-insights-table.tsx:261` → `<span ...>Média da organização</span>`; comentários que citam "Média da organização" em `:4` e `:254`.
- `__tests__/student-home-card.test.tsx:169` → `expect(screen.getByText(/em relação à organização/i))...`; títulos `describe`/`it` em `:157` e `:166`.
- `__tests__/comparison-insights-table.test.tsx:61` → `expect(screen.getByText("Média da organização"))...`.
- `app/dev/preview-desempenho/page.tsx:98` → **comentário** descritivo (o preview renderiza via `ComparisonInsightsTable`, então o LABEL exibido herda a troca #2 automaticamente; zero mudança funcional no preview).
- **Variante de gráficos** `SignalRowsView` (`student-comparison-view.tsx`): `grep "organiza"` retornou **vazio**, não há copy "organização" ali (só barras "você"/"média"). Nada a trocar. A Lupa reconfirma.

## As trocas

### OBRIGATÓRIAS (load-bearing, quebram teste se faltar)

| # | Arquivo:linha | De | Para |
|:-|:--|:--|:--|
| 1 | `components/analytics/student-home-card.tsx:110` (subtitle) | `Como você está em relação à organização nos últimos 30 dias.` | `Como você está em relação à turma nos últimos 30 dias.` |
| 2 | `components/analytics/comparison-insights-table.tsx:261` (label) | `Média da organização` | `Média da turma` |
| 3 | `components/analytics/__tests__/student-home-card.test.tsx:169` (assertion) | `/em relação à organização/i` | `/em relação à turma/i` |
| 4 | `components/analytics/__tests__/comparison-insights-table.test.tsx:61` (assertion) | `getByText("Média da organização")` | `getByText("Média da turma")` |

### CONSISTÊNCIA (recomendadas, NÃO bloqueiam build)

| # | Arquivo:linha | Natureza |
|:-|:--|:--|
| 5 | `comparison-insights-table.tsx:4` e `:254` | comentários que citam "Média da organização" → atualizar p/ "turma" (doc honesta) |
| 6 | `app/dev/preview-desempenho/page.tsx:98` | **só comentário** descritivo; o label exibido herda a troca #2, ZERO mudança funcional |
| 7 | `student-home-card.test.tsx:157,166` | títulos `describe`/`it` que dizem "organização" → renomear p/ "turma" (cosmético) |

## LIMITE DURO (NÃO fazer)

- **NÃO** renomear identificadores internos/tipos/variáveis/chaves de cache: `orgAverage`, `OrgReference`, `org-reference-cache`, campos em `types/analytics.ts`. Só copy de display.
- **NÃO** tocar na lógica de cálculo. A média permanece org-wide. Zero mudança de dado/lógica.

## Acceptance Criteria

- [ ] **AC1 (subtitle):** `student-home-card.tsx` exibe "…em relação à turma…" (troca #1). Prova: `grep -n "em relação à turma" apps/web/src/components/analytics/student-home-card.tsx`.
- [ ] **AC2 (label):** `comparison-insights-table.tsx` exibe "Média da turma" (troca #2). Prova: `grep -n "Média da turma" apps/web/src/components/analytics/comparison-insights-table.tsx`.
- [ ] **AC3 (nenhuma copy user-facing "organização" remanescente):** nos 2 componentes Meu ritmo + variante de gráficos + preview, não sobra copy user-facing "organização" (o preview herda o label; identificadores internos, se houver, são permitidos). Prova: `grep -rn "organiza"` nesses arquivos não retorna copy exibida.
- [ ] **AC4 (testes dos 2 componentes verdes com "turma"):** `student-home-card.test.tsx` e `comparison-insights-table.test.tsx` passam com as assertions em "turma" (trocas #3 e #4).
- [ ] **AC5 (zero mudança de lógica/dado + build batched verde):** nenhum identificador/tipo/variável/cache renomeado, nenhum cálculo tocado; build de produção verde 116/116 (batched, um único build cobrindo SH-F.6 + SH-F.7 + SH-F.8).

## Tasks

- [ ] 1. Confirmar SH-F.7 fechada e trabalhar na mesma worktree `integration/main-x-engagement`.
- [ ] 2. **Malho:** aplicar as 4 trocas OBRIGATÓRIAS (#1-#4).
- [ ] 3. **Malho:** aplicar as 3 trocas de CONSISTÊNCIA (#5-#7), comentários e títulos de teste.
- [ ] 4. **Malho:** confirmar que nenhum identificador interno (`orgAverage`/`OrgReference`/`org-reference-cache`/tipos) foi tocado (limite duro).
- [ ] 5. **Lupa:** rodar os testes dos 2 componentes (verdes com "turma"), `grep "organiza"` (sem copy user-facing restante) + `grep` confirmando "turma".
- [ ] 6. **Lupa:** build de produção verde 116/116, batched com SH-F.6 + SH-F.7. Reportar PRONTO.
- [ ] 7. **ZERO push.** Reportar ao Maestro; o @devops retoma o deploy com o GO, após a aprovação batched.

## Complexidade & Riscos

- **Complexidade:** XS (extra small, Tier-3). Duas trocas de copy exibida + duas de assertion + três cosméticas.
- **Riscos:**
  - R1 (baixo): esquecer uma das 4 load-bearing → teste vermelho. Mitigação: AC1-AC4 pareiam copy e assertion.
  - R2 (baixo, precisa vigilância): renomear identificador interno por engano (viola o limite duro, mexeria em lógica/cache). Mitigação: Task 4 + limite duro explícito.
  - R3 (baixo): copy user-facing "organização" sobreviver em algum ramo não visto. Mitigação: AC3 + grep da Lupa nos 2 componentes + variante de gráficos.

## Dev Notes

- **Natureza: COPY DE DISPLAY (Tier-3).** Zero lógica, zero dado, zero renomeação de identificador. Não é breaking; a média continua org-wide, só o texto exibido muda.
- **File-disjunto do resto do epic** em termos de mudança funcional; toca copy nos componentes Meu ritmo já estabilizados. Não reabrir nenhuma decisão de F.1-F.7.
- **Preview herda o label:** `preview-desempenho` renderiza via `ComparisonInsightsTable`, então o label exibido vira "turma" automaticamente pela troca #2; a mudança em `page.tsx:98` é só comentário, sem efeito funcional.
- **Sequenciamento:** DEPOIS de SH-F.7 fechar, na MESMA worktree, para o deploy sair batched. O build de produção final é um único verde 116/116 cobrindo SH-F.6 + SH-F.7 + SH-F.8. A Lupa aprova o lote; só então o @devops é acionado.
- **Filtro pnpm real = `@eximia/web`** (reconfirmado pelo @sm nas stories irmãs).

## Testing

```bash
cd /Users/hugocapitelli/Dev/eximia/integration-worktree
git rev-parse --short HEAD                        # worktree integration/main-x-engagement
# após as trocas:
grep -n "em relação à turma" apps/web/src/components/analytics/student-home-card.tsx        # AC1
grep -n "Média da turma" apps/web/src/components/analytics/comparison-insights-table.tsx    # AC2
# AC3: nenhuma copy user-facing "organização" nos componentes Meu ritmo + variante gráficos
grep -rn "organiza" apps/web/src/components/analytics/student-home-card.tsx apps/web/src/components/analytics/comparison-insights-table.tsx apps/web/src/components/analytics/student-comparison-view.tsx
pnpm --filter @eximia/web test -- student-home-card comparison-insights-table   # AC4: verdes com "turma"
pnpm --filter @eximia/web typecheck               # sem regressão
pnpm --filter @eximia/web build                   # AC5: verde 116/116 (batched F.6+F.7+F.8)
# ZERO push; main permanece 52a54f5.
```

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-13 | Story criada a partir de `08-copy-turma-plan.md` (anexa à finalização SH-F como SH-F.8, não é epic novo). Anchors reconferidos read-only na worktree `integration/main-x-engagement` (HEAD `75a7b8e`): subtitle@student-home-card:110, label@comparison-insights-table:261 (+comentários :4/:254), assertions @student-home-card.test:169 e @comparison-insights-table.test:61, comentário do preview @98; `SignalRowsView` sem copy "organização" (grep vazio). 4 trocas load-bearing + 3 de consistência + limite duro (só display, zero identificador/lógica/dado). Build batched F.6+F.7+F.8. Filtro pnpm real `@eximia/web`. | Roteiro (@sm) |
| 2026-07-13 | Validação PO: 4 load-bearing reconfirmados verbatim (são strings/assertions, não identificadores); completude confirmada (só 2 strings user-facing); 2 comentários stray achados (não bloqueiam); assunção tenant==turma declarada. Veredito GO. | Contrato (@po) |

---

## PO Validation & Critérios Fortalecidos (@po)

> **Veredito: GO (9,5/10).** Tier-3 copy, risco mínimo, verbatim do Hugo. Reconfirmei tudo READ-ONLY. A copy é aditiva/display; o único valor de @po aqui é (1) confirmar a completude (não há 3ª string user-facing esquecida), (2) apontar 2 comentários stray que a lista de consistência não pegou, (3) registrar a assunção semântica que torna "turma" correto.

### Fatos reconfirmados pelo @po, READ-ONLY (worktree `/integration-worktree` @ `75a7b8e`, main `52a54f5` intocada)

Os 4 pontos load-bearing batem VERBATIM e são **strings de display / assertions de teste, não identificadores**:
- `student-home-card.tsx:110` = `Como você está em relação à organização nos últimos 30 dias.` (subtitle)
- `comparison-insights-table.tsx:261` = `<span ...>Média da organização</span>` (label)
- `student-home-card.test.tsx:169` = `getByText(/em relação à organização/i)` (assertion)
- `comparison-insights-table.test.tsx:61` = `getByText("Média da organização")` (assertion)

**Limite duro confirmado:** os identificadores `OrgReference`, `org-reference-cache`, `loadOrgReference` existem em `lib/analytics/org-reference-cache.ts` e **NÃO podem ser renomeados**. As 4 trocas são todas em texto exibido, nenhuma toca identificador. ✓

**Variante gráficos:** `grep "organiza"` em `student-comparison-view.tsx` = **vazio**, confirmado. Nada a trocar ali.

### Completude confirmada pelo @po (não há 3ª string user-facing)

Varri o surface inteiro (`components/analytics/` + `dashboard`), não só os 3 arquivos escopados. As ÚNICAS strings user-facing "organização" são as duas trocas #1 (subtitle:110) e #2 (label:261). Nenhuma terceira ocorrência exibida escapou. AC3 sobe de "grep os 3 arquivos" para "verificado que não sobra copy user-facing 'organização' em nenhum lugar do surface Meu ritmo".

### Achado do @po, 2 comentários stray fora da lista de consistência (NÃO bloqueiam)

A lista de consistência (#5 cita `comparison-insights-table.tsx:4`/`:254`; #7 cita `student-home-card.test.tsx:157`/`:166`) deixou de fora 2 comentários que também dizem "ORGANIZAÇÃO/ORGANIZATION":
- `comparison-insights-table.tsx:2` (comentário de cabeçalho: "a média da ORGANIZAÇÃO").
- `student-home-card.test.tsx:154` (comentário: "ORGANIZATION (subtitle)").

São COMENTÁRIOS (não user-facing, não quebram build/teste). Não bloqueiam. Mas se o Malho fizer o passo cosmético de consistência, deve incluir esses 2 para a doc ficar honesta e não sobrar "organização" espalhada. Registro para a Lupa não considerar o passo cosmético "completo" com esses 2 de fora.

### Assunção semântica declarada (o @po registra, é do Hugo)

"Média da turma" é preciso **sob a assunção `tenant == uma única turma`** (modelo per-client: tenant = cliente = uma turma). A média continua ORG-WIDE (todos os alunos do tenant). Se um tenant vier a ter MÚLTIPLAS turmas, "Média da turma" fica impreciso (seria média do tenant, cruzando turmas). Isso é decisão de copy do Hugo (verbatim) e fica correto no modelo per-client atual; registro a assunção para revisitar SE o modelo multi-turma por tenant surgir. Não bloqueia.

### Comandos de Verificação (exatos)

```bash
cd /Users/hugocapitelli/Dev/eximia/integration-worktree
grep -n "em relação à turma" apps/web/src/components/analytics/student-home-card.tsx        # AC1
grep -n "Média da turma" apps/web/src/components/analytics/comparison-insights-table.tsx    # AC2
# AC3 completude: nenhuma copy user-facing "organização" no surface Meu ritmo (só comentários permitidos):
grep -rniE "organiza" apps/web/src/components/analytics/ | grep -viE "//|/\*|\* "
# ^ o que sobrar deve ser SÓ comentário/identificador, nunca string exibida nem assertion
grep -niE "organiza" apps/web/src/components/analytics/student-comparison-view.tsx || echo "graficos: vazio OK"
pnpm --filter @eximia/web test -- student-home-card comparison-insights-table   # AC4: verdes com "turma"
pnpm --filter @eximia/web typecheck               # sem regressão
pnpm --filter @eximia/web build                   # AC5: verde 116/116 BATCHED (F.6+F.7+F.8)
# ZERO push; main permanece 52a54f5.
```

### Critério de PRONTO (a Lupa usa)

4 trocas load-bearing aplicadas (subtitle+label exibem "turma", 2 assertions em "turma"); nenhum identificador do limite duro renomeado (`OrgReference`/`org-reference-cache`/`loadOrgReference` intactos); grep de completude sem string user-facing "organização" remanescente no surface (comentários/identificadores permitidos, e se o passo cosmético foi feito, os 2 stray :2/:154 também caíram); variante gráficos confirmada vazia; testes dos 2 componentes verdes; typecheck 0; **build BATCHED verde 116/116 cobrindo F.6+F.7+F.8** (a Lupa aprova o lote, só então o @devops é acionado). ZERO push, main `52a54f5` intocada.

### Placar 10 pontos PO

1. Objetivo/contexto: 1 · 2. ACs testáveis: 1 · 3. Precisão técnica (4 anchors verbatim read-only): 1 · 4. Rastreabilidade (verbatim Hugo + plano): 1 · 5. Autossuficiência: 1 · 6. Dependências (após F.7, mesma worktree, batched): 1 · 7. Escopo (só display, limite duro): 1 · 8. Teste runnable: 1 · 9. Completude (verificada, sem 3ª string) + assunção declarada: 0,5 · 10. Achado dos 2 comentários stray: 0,5. **Total: 9,5 → GO.**
