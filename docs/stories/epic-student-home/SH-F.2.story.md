# SH-F.2: Estabilidade de teste, matar a flakiness de máquina (`vitest.config.ts`)

**Epic:** [EPIC-STUDENT-HOME-FINALIZACAO](./EPIC-STUDENT-HOME-FINALIZACAO.md)
**Status:** Draft
**Insumo obrigatório:** `03-finalizacao-plan.md` §1 (SH-F.2) e §2 (coordenação de baseline). Ler antes de começar.
**Depende de:** nada para começar. Opera sobre a base `feat/SH-1.4-student-home-card` (HEAD `d8b7f85`).
**Bloqueia:** nada, mas o seu critério (3 runs = os 8 pré-existentes) DEVE ser **re-verificado na integração final**, depois que SH-F.1 (remove testes) e SH-F.3 (adiciona teste novo) estiverem mescladas, para o baseline refletir a árvore final (epic §7, "ordem de merge").
**Paralelizável:** SIM. Par A junto de SH-F.1 (mesmo par para eliminar coordenação cross-par sobre o baseline). Independente de SH-F.3/F.4.

---

## Story

**As a** desenvolvedor finalizando a home do aluno para o merge,
**I want** ajustar `apps/web/vitest.config.ts` (subir `testTimeout` e limitar o paralelismo, a alavanca MENOS invasiva que estabilize) para que os testes de render lentos parem de estourar o timeout default sob CPU saturada,
**so that** a suíte pare de gerar "regressão" fantasma (falha intermitente por máquina, não por código), tornando o resultado determinístico, sem "consertar" os 8 testes que falham de verdade.

## Contexto (Dev Notes)

Verificado na worktree `/Users/hugocapitelli/Dev/eximia/sh-1.4-worktree`:

- `apps/web/vitest.config.ts` hoje define apenas `test: { environment: "jsdom", globals: true, passWithNoTests: false, setupFiles: ["./src/test-setup.ts"] }`. **Não define `testTimeout` nem tuning de pool/paralelismo.** O default de `testTimeout` do vitest é 5000ms.
- Sob carga (CPU saturada), testes de render lentos estouram os 5s e falham de forma intermitente. Suspeitos nomeados e localizados no plano:
  - `apps/web/src/components/admin/__tests__/role-selector.test.tsx`
  - `apps/web/src/components/dashboard/__tests__/analytics-redirect.test.ts`
  - `apps/web/src/app/(platform)/dashboard/_components/__tests__/team-view-switch.test.tsx`

**Duas alavancas (plano §1 SH-F.2), aplicar a que resolver, medindo:**
1. `testTimeout` (default 5000ms → propor **15000ms**), global.
2. Cap de paralelismo: `test.maxWorkers` (ex.: metade dos cores), e/ou `poolOptions.threads.maxThreads`, ou `fileParallelism: false`, ou `pool: "forks"` + `poolOptions.forks.singleFork`. Escolher o MENOS invasivo que estabilize. Recomendação do plano: `testTimeout: 15000` + cap de `maxWorkers`, medindo antes de adicionar mais.

**Invariante (epic §3.2, §4 out-of-scope):** NÃO "consertar" os 8 testes reais pré-existentes, são falha real fora do escopo desta story. O alvo é remover a VARIAÇÃO fantasma, não mudar a natureza dos 8. NÃO tocar nenhum arquivo de app.

## Acceptance Criteria

- [ ] **AC1 (baseline capturado ANTES):** 1 run completa de `pnpm --filter @eximia/web test` registrada como baseline, listando o conjunto exato de falhas (N e nomes). First-move rule: esse baseline é o ponto de referência antes de tocar a config.
- [ ] **AC2 (config, não teste):** `apps/web/vitest.config.ts` passa a definir `testTimeout: 15000` e um cap de paralelismo (a alavanca menos invasiva que estabilize, documentada no Dev Agent Record). Nenhum arquivo de app é modificado. Prova: `git diff --stat` mostra somente `vitest.config.ts` (e, se optar por bump por-arquivo, apenas os 3 arquivos de teste nomeados).
- [ ] **AC3 (determinismo, 3 runs iguais):** 3 runs consecutivas de `pnpm --filter @eximia/web test` produzem **exatamente o MESMO conjunto de falhas** (os 8 pré-existentes), **sem variação** entre runs. Registrar o output das 3 runs (mesmos N falhando, mesmos nomes).
- [ ] **AC4 (suspeitos determinísticos):** os 3 suspeitos (`role-selector`, `analytics-redirect`, `team-view-switch`) passam de forma determinística nas 3 runs, não aparecem mais como falha intermitente.
- [ ] **AC5 (natureza dos 8 intacta):** o conjunto de falhas após o ajuste é o MESMO conjunto de 8 do baseline (AC1). Nenhum dos 8 reais foi "consertado", removido ou mascarado; nenhum teste antes verde ficou vermelho.

## Tasks

- [ ] 1. Capturar baseline (AC1): `pnpm --filter @eximia/web test`, salvar o conjunto de falhas (N + nomes).
- [ ] 2. Editar `apps/web/vitest.config.ts`: adicionar `testTimeout: 15000` no bloco `test`.
- [ ] 3. Adicionar cap de paralelismo (ex.: `maxWorkers`) no bloco `test`; começar pelo menos invasivo e só escalar se as 3 runs ainda variarem.
- [ ] 4. Rodar a suíte 3x seguidas e comparar o conjunto de falhas entre as 3 (AC3). Se ainda houver variação, subir a alavanca de paralelismo (passo 3) e repetir.
- [ ] 5. Confirmar que os 3 suspeitos passam nas 3 runs (AC4).
- [ ] 6. Confirmar que o conjunto final de falhas é idêntico ao baseline de 8 (AC5), documentar no Dev Agent Record qual alavanca estabilizou.

## Complexidade & Riscos

- **Complexidade:** S (small). Ajuste de config + medição por repetição.
- **Riscos:**
  - R1 (médio): cap de paralelismo agressivo demais deixa a suíte lenta sem necessidade. Mitigação: começar pelo `testTimeout` + cap moderado, medir, só escalar se necessário (AC documentado).
  - R2 (baixo): mascarar um flake que na verdade é bug de código. Mitigação: AC5 exige que o conjunto final seja o MESMO 8 do baseline, um teste antes verde não pode ficar vermelho e vice-versa.
  - R3 (coordenação, não corrida): o baseline dos 8 muda de tamanho se medido depois que SH-F.1 remove testes ou SH-F.3 adiciona um. Mitigação: F.1 e F.2 no mesmo par + **re-verificação de integração** (epic §7), medir as 3-runs-estáveis com todas as fatias já dentro.

## Dev Notes

- **Natureza: CONFIG (aditivo em `vitest.config.ts`).** Não é breaking, não muda app nem a natureza de nenhum teste. Só muda COMO os testes rodam (timeout + paralelismo).
- **File-disjunto:** dono exclusivo de `apps/web/vitest.config.ts`. Não editar `student-progress-headline.tsx` (SH-F.1), `area-gestor.ts`/`org-reference-cache.ts` (SH-F.3) nem `seed-student-home-demo.ts` (SH-F.4). Se optar por bump por-arquivo, os 3 arquivos de teste suspeitos são tocados só aqui (nenhuma outra fatia os edita).
- **First-move rule (refactor/estabilidade):** baseline verde/registrado ANTES (AC1). Aqui o "verde" é na verdade "conjunto estável de 8 falhas conhecidas"; o alvo é o determinismo desse conjunto, não zerá-lo.
- **Regra dura de integração (epic §7):** SH-F.2 é a última a ser re-verificada, após todos os merges que adicionam/removem testes.

## Testing

```bash
cd /Users/hugocapitelli/Dev/eximia/sh-1.4-worktree
pnpm --filter @eximia/web test                # AC1: baseline (registrar N + nomes das falhas)
# ... aplicar o ajuste em vitest.config.ts ...
git diff --stat apps/web/vitest.config.ts     # AC2: só a config mudou
pnpm --filter @eximia/web test                # run 1
pnpm --filter @eximia/web test                # run 2
pnpm --filter @eximia/web test                # run 3  -> AC3: os 3 conjuntos de falhas idênticos
# AC4: confirmar os 3 suspeitos verdes nas 3 runs
pnpm --filter @eximia/web test -- role-selector analytics-redirect team-view-switch
```

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-12 | Story criada a partir de `EPIC-STUDENT-HOME-FINALIZACAO.md` §4/§10 + `03-finalizacao-plan.md` §1 (SH-F.2). Config atual (`vitest.config.ts` sem `testTimeout`/pool) e os 3 suspeitos verificados na worktree SH-1.4. | Roteiro (@sm) |
| 2026-07-12 | Validação PO: config sem `testTimeout` reconfirmada; limite honesto do "3 runs" declarado + alavanca de determinismo forte recomendada. Veredito GO. | Contrato (@po) |

---

## PO Validation & Critérios Fortalecidos (@po)

> **Veredito: GO (9,0/10).** Ajuste de config, não de app, alvo é determinismo. Reconfirmado: `vitest.config.ts` não tem `testTimeout` nem tuning de pool; `test` = `vitest run`. Um ponto de honestidade epistêmica a fixar na spec, mais uma alavanca que fecha o risco de "3 runs não bastam".

### Limite honesto do critério "3 runs iguais" (declarado, não escondido)

3 runs idênticas são EVIDÊNCIA de determinismo, não PROVA absoluta de ausência de flakiness (um flake raro pode não aparecer em 3 amostras). O @po aceita "3 runs iguais" como gate PRAGMÁTICO, com uma condição que o torna robusto: a alavanca escolhida deve REMOVER a causa-raiz (contenção de CPU sob paralelismo), não só dar mais folga de tempo. Por isso:
- `testTimeout: 15000` sozinho reduz o sintoma (timeout) mas NÃO elimina a contenção. Deve vir acompanhado do **cap de paralelismo** (a causa-raiz do estouro sob CPU saturada).
- Alavanca recomendada como a "menos invasiva que estabiliza de verdade": `testTimeout: 15000` + `poolOptions.threads.maxThreads` (ou `maxWorkers`) limitado (ex.: metade dos cores). Se 3 runs AINDA variarem, escalar para `fileParallelism: false` (serializa arquivos, mata a contenção por completo, custo = suíte mais lenta). Documentar no Dev Agent Record QUAL alavanca estabilizou e por quê.

### Given/When/Then

- **AC1 (baseline ANTES):** *Given* HEAD atual; *When* 1 run de `pnpm --filter @eximia/web test`; *Then* registrar N e nomes exatos das falhas (é o conjunto de 8 reais).
- **AC3/AC4 (determinismo):** *Given* a config ajustada; *When* 3 runs consecutivas; *Then* as 3 produzem o MESMO conjunto de falhas (os 8), e os 3 suspeitos (`role-selector`, `analytics-redirect`, `team-view-switch`) verdes nas 3.
- **AC5 (natureza dos 8 intacta):** *Then* conjunto final = mesmo conjunto de 8 do baseline. Nenhum verde virou vermelho, nenhum dos 8 foi mascarado/consertado. `git diff --stat` mostra SÓ `vitest.config.ts` (e, se optar por bump por-arquivo, só os 3 arquivos de teste nomeados, nenhum arquivo de app).

### Comandos de Verificação (exatos)

```bash
cd /Users/hugocapitelli/Dev/eximia/sh-1.4-worktree
pnpm --filter @eximia/web test                         # AC1: baseline (N + nomes)
git diff --stat apps/web/vitest.config.ts              # AC2/AC5: só a config mudou (nenhum app)
for i in 1 2 3; do echo "== run $i =="; pnpm --filter @eximia/web test 2>&1 | tail -20; done   # AC3
pnpm --filter @eximia/web test -- role-selector analytics-redirect team-view-switch   # AC4: suspeitos verdes
```

### Critério de PRONTO (o revisor do Par A usa)

Baseline de 8 registrado ANTES; `vitest.config.ts` com `testTimeout: 15000` + cap de paralelismo (a alavanca documentada); 3 runs = mesmos 8, sem variação; 3 suspeitos verdes nas 3; `git diff --stat` prova zero arquivo de app tocado; alavanca que estabilizou registrada no Dev Agent Record. **Re-verificação de integração obrigatória** (epic §7): as 3-runs-estáveis são re-medidas depois que SH-F.1 (remove componente) e SH-F.3 (adiciona teste) entrarem, para o baseline refletir a árvore final.

### Placar 10 pontos PO

1. Objetivo/contexto: 1 · 2. ACs testáveis: 1 · 3. Precisão técnica: 1 · 4. Rastreabilidade Art. IV: 1 · 5. Autossuficiência: 1 · 6. Dependências (re-verificação integração): 1 · 7. Escopo (só config): 1 · 8. Teste runnable: 1 · 9. Riscos+mitigação: 0,5 (limite do "3 runs" agora explícito + alavanca causa-raiz) · 10. First-move/anti-regressão: 0,5. **Total: 9,0 → GO.**

---

## Dev Agent Record (@dev — Bigorna, Par A) — Status: InReview

**Worktree:** `sh-1.4-worktree`, branch `feat/SH-1.4-student-home-card`, HEAD `d8b7f85`. Máquina: 10 cores. Sem commit até PASS do Crivo. Modelo Opus.

### AC1 — Baseline capturado ANTES (compartilhado com SH-F.1)

`pnpm --filter @eximia/web test` no HEAD pristino: **8 arquivos falhando** / 82 passando (90); **31 testes falhando** / 734 passando (765). Os 8 nomes: `sessions/[sessionId]/messages/route.test.ts`, `login-form-google-oauth.test.tsx`, `manager-course-dashboard.test.tsx`, `manager-dashboard-order.test.tsx`, `manager-dashboard.test.tsx`, `student-dashboard.test.tsx`, `step-employee-status.test.tsx`, `rate-limit.test.ts`. Nesta run baseline os 3 suspeitos já passaram (a flakiness é intermitente por carga, não constante).

### ALAVANCA ESCOLHIDA (AC2) — documentada

`apps/web/vitest.config.ts`, bloco `test`: **`testTimeout: 15000`** (era default 5000) **+ `maxWorkers: 5`** (metade dos 10 cores).

**Por que essa e não outra:** seguindo o @po, `testTimeout` sozinho trata o SINTOMA (estouro de 5s) mas não a CAUSA-RAIZ (contenção de CPU sob paralelismo com worktrees paralelas). O cap `maxWorkers: 5` remove a causa-raiz limitando a concorrência de workers à metade dos cores. É a alavanca **menos invasiva que estabiliza de verdade**: `fileParallelism: false` (serializar arquivos, custo = suíte mais lenta) era o fallback mais pesado e **não foi necessário** — 3 runs já ficaram determinísticas com o cap de meia-máquina.

### AC3/AC4/AC5 — evidência (3 runs consecutivas, config aplicada)

| Run | Test Files | Tests | Conjunto de falhas | 3 suspeitos |
|:--|:--|:--|:--|:--|
| 1 | 8 failed \| 82 passed (90) | 31 failed \| 734 passed (765) | os mesmos 8 | ✓ verdes |
| 2 | 8 failed \| 82 passed (90) | 31 failed \| 734 passed (765) | os mesmos 8 | ✓ verdes |
| 3 | 8 failed \| 82 passed (90) | 31 failed \| 734 passed (765) | os mesmos 8 | ✓ verdes |

- **AC3:** 3 runs = conjunto de falhas EXATAMENTE igual, **zero variação**.
- **AC4:** `role-selector`, `analytics-redirect`, `team-view-switch` verdes nas 3 runs; run isolada (`vitest run role-selector analytics-redirect team-view-switch`, sem `--`) = **3 arquivos / 8 testes PASS**.
- **AC5:** conjunto final = os mesmos 8 do baseline. Nenhum dos 8 consertado/mascarado; nenhum antes-verde virou vermelho (34/34 → idêntico).
- **AC2 (prova):** `git diff --stat apps/web/vitest.config.ts` → `1 file changed, 10 insertions(+)`. Nenhum arquivo de app modificado por esta story (os deltas de F.1 no worktree são arquivos de teste/componente, não config).

### File List

- `apps/web/vitest.config.ts` — `+testTimeout: 15000`, `+maxWorkers: 5`, com comentário justificando as alavancas (+10 linhas).

### ⚠️ NOTA DE INTEGRAÇÃO OBRIGATÓRIA (epic §7 — regra dura)

As "3-runs-estáveis" desta story foram medidas no HEAD do Par A (F.1 já aplicada no mesmo worktree, que NÃO muda a contagem de testes: o componente órfão não tinha teste próprio, e o rename preserva o teste do helper). **SH-F.2 DEVE ser RE-VERIFICADA na INTEGRAÇÃO FINAL**, depois que SH-F.3 (Par B) mesclar (adiciona 1 teste novo `org-reference-cache.test.ts`, que deve entrar como **PASS**) e SH-F.4 (Par C) mesclar. Na re-verificação, confirmar: (a) o novo teste de F.3 entra verde, (b) os 8 pré-existentes seguem sendo os mesmos 8, (c) 3 runs continuam determinísticas com a alavanca `maxWorkers: 5` (escalar para `fileParallelism: false` só se a árvore final reintroduzir variação).

### Medição final pós-`2b50411` (re-verificação de integração parcial — F.3 já dentro)

Após SH-F.3 (Par B) commitar na mesma branch (HEAD `2b50411`), re-medi as **3 runs na árvore atual** com a alavanca já aplicada (`testTimeout: 15000` + `maxWorkers: 5`):

| Run (pós-2b50411) | Test Files | Tests | Conjunto de falhas | F.3 `org-reference-cache` + 3 suspeitos |
|:--|:--|:--|:--|:--|
| 1 | 8 failed \| 83 passed (91) | 31 failed \| 737 passed (768) | os mesmos 8 | ✓ (4/4 verdes) |
| 2 | 8 failed \| 83 passed (91) | 31 failed \| 737 passed (768) | os mesmos 8 | ✓ (4/4 verdes) |
| 3 | 8 failed \| 83 passed (91) | 31 failed \| 737 passed (768) | os mesmos 8 | ✓ (4/4 verdes) |

3 runs IDÊNTICAS; o teste novo de F.3 entra como **PASS** (734→737 verdes, 90→91 arquivos), os **8 pré-existentes seguem os mesmos 8**, determinismo mantido com `maxWorkers: 5` (fileParallelism:false NÃO necessário). **Isso já cumpre a re-verificação de integração da AC/epic §7 para F.3** — resta apenas a entrada de **SH-F.4** (Par C, seed) para o re-check final completo.

### ✅ GATE DE INTEGRAÇÃO FINAL (epic §7) — árvore completa `c25f779`

Cadeia final na worktree `sh-1.4-worktree`: `d8b7f85 → 86136bd` (F.1/F.2) `→ 2b50411` (F.3) `→ c25f779` (F.4). F.4 é aditivo puro (seed tool + 2 docs, +563/‑0, **zero arquivo de teste** que o vitest colete, **zero arquivo de app**). Gate conduzido pelo Par A (Bigorna) a pedido do Capataz.

3 runs consecutivas de `pnpm --filter @eximia/web test` @ `c25f779`:

| Gate run | Test Files | Tests | Conjunto de falhas | `org-reference-cache` + 3 suspeitos |
|:--|:--|:--|:--|:--|
| 1 | 8 failed \| 83 passed (91) | 31 failed \| 737 passed (768) | os mesmos 8 | ✓ (4/4 verdes) |
| 2 | 8 failed \| 83 passed (91) | 31 failed \| 737 passed (768) | os mesmos 8 | ✓ (4/4 verdes) |
| 3 | 8 failed \| 83 passed (91) | 31 failed \| 737 passed (768) | os mesmos 8 | ✓ (4/4 verdes) |

**Veredito do gate:** (a) `org-reference-cache` (F.3) PASS nas 3; (b) os **mesmos 8** pré-existentes nas 3, **nenhum verde virou vermelho**; (c) determinismo **sem variação** com a alavanca já aplicada (`testTimeout: 15000` + `maxWorkers: 5`), suspeitos `role-selector`/`analytics-redirect`/`team-view-switch` verdes. F.4 (seed+docs) não alterou a contagem, como esperado. **Re-verificação de integração da §7 CUMPRIDA com todas as 4 fatias dentro.** Zero push (merge é do @devops).

### ✅ GATE DE INTEGRAÇÃO — ROUND 2 (epic §7, pós-SH-F.5) — árvore completa `9b53a36`

Par A (Bigorna/Crivo) foi desligado; o **round 2** do gate roda no Par B (**Malho** executa a medição mecânica, **Lupa** verifica adversarialmente), a pedido do Capataz. A necessidade do round 2 é a própria regra §7: **SH-F.5 adicionou testes à árvore** (fatia mesclada DEPOIS do gate round-1 de Bigorna em `c25f779`), então o baseline dos 8 pré-existentes precisa ser re-provado sobre a árvore final real.

Cadeia final na worktree `sh-1.4-worktree`: `c25f779` (F.1+F.2+F.3+F.4) `→ 9b53a36` (**F.5**: engajamento do Você vira fração X de N, Média absoluta). F.5 adiciona a suíte nova `reflection-potential.test.ts` (10 testes, arquivo novo) + novos casos em `student-home-indicators.test.ts` e `comparison-insights-table.test.tsx`, e estende o fake db de `org-reference-cache.test.ts` (suporte a `.in`, infra, zero mudança de asserção). Nenhum arquivo de app de teste pré-existente removido.

3 runs consecutivas de `pnpm --filter @eximia/web test` @ `9b53a36` (config estável `testTimeout: 15000` + `maxWorkers: 5` já na árvore):

| Gate run (round 2) | Test Files | Tests | Conjunto de falhas | Alvos F.5 + 3 suspeitos |
|:--|:--|:--|:--|:--|
| 1 | 8 failed \| 84 passed (92) | 31 failed \| 757 passed (788) | os mesmos 8 | ✓ (todos verdes) |
| 2 | 8 failed \| 84 passed (92) | 31 failed \| 757 passed (788) | os mesmos 8 | ✓ (todos verdes) |
| 3 | 8 failed \| 84 passed (92) | 31 failed \| 757 passed (788) | os mesmos 8 | ✓ (todos verdes) |

**Conjunto de falhas idêntico nas 3 runs E == baseline dos 8** (`diff` byte-a-byte das listas de arquivos falhos = vazio): `sessions/[sessionId]/messages/route.test.ts`, `login-form-google-oauth.test.tsx`, `manager-course-dashboard.test.tsx`, `manager-dashboard-order.test.tsx`, `manager-dashboard.test.tsx`, `student-dashboard.test.tsx`, `step-employee-status.test.tsx`, `rate-limit.test.ts`.

**Alvos do F.5 verdes nas 3:** `reflection-potential` (10), `comparison-insights-table` (14), `org-reference-cache` (3), `student-home-indicators` (13), `student-home-card` (7). **Suspeitos verdes nas 3:** `analytics-redirect` (1), `team-view-switch` (3), `role-selector` (4).

**Veredito do gate round 2:** (a) testes novos do F.5 PASS nas 3 runs; (b) `org-reference-cache` PASS nas 3; (c) os **mesmos 8** pré-existentes nas 3, **nenhum verde virou vermelho** (green→red = zero); (d) **determinismo sem variação** (8/84/92 e 31/757/788 idênticos nas 3). Delta esperado vs round-1 de Bigorna (`c25f779`: 91 arquivos / 768 testes → `9b53a36`: 92 arquivos / 788 testes) = **+1 arquivo de teste (reflection-potential) e +20 testes verdes**, todos da fatia F.5, com falhas travadas em 31. **Re-verificação de integração da §7 CUMPRIDA com a árvore final pós-F.5.** Zero push (merge é do @devops).

### Change Log add

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-12 | `testTimeout: 15000` + `maxWorkers: 5` aplicados. 3 runs determinísticas (mesmos 8), 3 suspeitos verdes, só config no diff. Status → InReview. Re-verificação de integração pendente (epic §7). | Bigorna (@dev, Par A) |
| 2026-07-12 | Medição final re-feita pós-`2b50411` (F.3 dentro): 3 runs idênticas, F.3 entra PASS (+3 verdes), 8 reais intactos. Re-verificação de integração de F.3 CUMPRIDA; falta só F.4. | Bigorna (@dev, Par A) |
| 2026-07-12 | **GATE DE INTEGRAÇÃO FINAL** @ `c25f779` (F.1+F.2+F.3+F.4): 3 runs idênticas (8/83/91; 31/737/768), determinismo mantido, zero falha nova. §7 CUMPRIDA. | Bigorna (@dev, Par A) |
| 2026-07-13 | **GATE DE INTEGRAÇÃO ROUND 2** @ `9b53a36` (pós-F.5), conduzido no Par B (Malho executa, Lupa verifica): 3 runs idênticas (8/84/92; 31/757/788), testes novos do F.5 + `org-reference-cache` PASS, mesmos 8 pré-existentes, zero green→red, determinismo mantido. §7 re-cumprida sobre a árvore final. | Malho (@dev, Par B) |
