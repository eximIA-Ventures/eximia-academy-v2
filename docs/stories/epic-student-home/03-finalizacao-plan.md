# EPIC-STUDENT-HOME — Plano Técnico de FINALIZAÇÃO (merge com tudo redondo)

> **Autor:** Vitruvio (Planejador / arquiteto técnico) · **Data:** 2026-07-12
> **Ordem do Hugo:** "finaliza tudo". Frente NOVA → linha completa: este plano → Saga (epic) → Roteiro (stories) → Contrato (specs) → Capataz (/goal + /loop).
> **Fase:** DOCS ONLY. Nenhum código de app nesta fase.
> **Repo:** `/Users/hugocapitelli/Dev/eximia/eximia-academy-v2` · app em `apps/web`.
> **Base de código a finalizar:** branch `feat/SH-1.4-student-home-card`, HEAD `d8b7f85`, worktree `/Users/hugocapitelli/Dev/eximia/sh-1.4-worktree`. A home "Meu ritmo" do aluno está APROVADA e certificada, SEM push. Este epic entrega os itens de finalização/limpeza para o merge ficar redondo.

---

## 0. Contexto verificado no código (worktree SH-1.4)

A home oficial é `StudentHomeCard` (`apps/web/src/components/analytics/student-home-card.tsx`), montada por `student-dashboard.tsx → StudentComparison (fetch) → StudentHomeCard`. Ela mostra "Meu ritmo" (Você vs Média da organização), toggle único `[Visão detalhada] [Gráficos]`, e um CTA `NextStepBar`. O dado vem de `GET /api/analytics/manager-groups?view=student` → `computeStudentComparison()` em `apps/web/src/lib/analytics/area-gestor.ts` (linhas 1091-1231).

Quatro fatos apurados linha a linha, que ancoram as 4 stories:

1. **Órfão real:** `student-progress-headline.tsx` (o COMPONENTE) não é importado por nenhum código de app. O único "import" fora de si mesmo é um COMENTÁRIO em `dev/preview-desempenho/page.tsx:62` (o preview importa `StudentHomeCard`, não o headline) e um COMENTÁRIO em `student-home-card.tsx:23`. O helper `buildProgressHeadline` (em `student-comparison-scale.ts:353`) **CONTINUA usado** por `student-home-card.tsx:92` (deriva a linha de coaching do CTA). O arquivo de teste `__tests__/student-progress-headline.test.ts` testa **só o helper** (`import { buildProgressHeadline } from "../student-comparison-scale"`), NÃO o componente.
2. **Flakiness de máquina:** `apps/web/vitest.config.ts` não define `testTimeout` nem tuning de pool/paralelismo. Sob CPU saturada, os testes de render lentos estouram o `testTimeout` default (5s) e geram falha-fantasma. Suspeitos nomeados e localizados: `src/components/admin/__tests__/role-selector.test.tsx`, `src/components/dashboard/__tests__/analytics-redirect.test.ts`, `src/app/(platform)/dashboard/_components/__tests__/team-view-switch.test.tsx`.
3. **Custo org-wide por request:** `computeStudentComparison` (area-gestor.ts) dispara, POR REQUEST, 4 scans org-wide do tenant inteiro (linhas 1176-1196): `sessions`, `slide_reflections`, `enrollments`, `courses` (deadlines). O bloco `student` (linhas 1104-1152) é escopado a `student_id` (auth). O bloco `orgBlock` + `referenceStats` + as linhas org que alimentam `buildStudentHomeIndicators` são **idênticos para todos os alunos do tenant numa janela**.
4. **Padrão de cache já existe no repo:** `apps/web/src/lib/feature-gate.ts` já usa cache in-memory por processo, `Map<tenantId, {..., expiry}>` + `CACHE_TTL_MS` + `getCacheEntry` + `invalidateFeatureCache`. É o padrão canônico a espelhar (e o app roda em processo longo no EasyPanel/Docker, não serverless, então cache por processo é válido, como já é para o feature-gate em prod).

**Padrão de seed:** scripts em `supabase/` (`seed.sql` declarativo; `seed-remote.ts` = script TS com `@supabase/supabase-js` via service role em `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`). **Tenant de demo:** `11111111-1111-1111-1111-111111111111`, name "Demo", slug "demo".

---

## 1. As 4 stories (cada uma com critério de saída VERIFICÁVEL)

### SH-F.1 — PODA DO ÓRFÃO (`StudentProgressHeadline`)

**O que:** remover o COMPONENTE órfão `apps/web/src/components/analytics/student-progress-headline.tsx`. **NÃO** remover o helper `buildProgressHeadline` (segue em `student-comparison-scale.ts`, usado pelo CTA). **NÃO** apagar `__tests__/student-progress-headline.test.ts` (ele testa o HELPER, não o componente, e cobre função viva).

**Correção ao briefing (achado de código):** o briefing disse "pode só o componente órfão + seu teste". Na prática **não existe teste do componente**, o arquivo `student-progress-headline.test.ts` testa `buildProgressHeadline`. Portanto a poda é **só o `.tsx`**; o `.test.ts` PERMANECE (opcionalmente RENOMEADO para `student-comparison-scale.progress-headline.test.ts` para honestidade de nome, aditivo). Apagar esse teste perderia cobertura de função usada, seria regressão silenciosa.

**Escopo de arquivos:** `student-progress-headline.tsx` (delete) · opcional: renomear o `.test.ts` · opcional cosmético: atualizar o comentário em `dev/preview-desempenho/page.tsx:62` que ainda menciona o componente. **File-disjunto** de SH-F.2/F.3/F.4.

**Critério de saída (verificável):**
- **Precondição provada ANTES de podar:** `grep -rn "student-progress-headline" apps/web/src | grep -i import` retorna **0 imports reais** do componente (só self-file/comentários). Comando literal:
  `grep -rn "from .*student-progress-headline\|import.*StudentProgressHeadline" apps/web/src` → nenhum import de app.
- `buildProgressHeadline` **continua existindo e usado:** `grep -rn "buildProgressHeadline" apps/web/src` mostra `student-home-card.tsx` + o teste.
- Delta zero de suíte: `pnpm --filter web vitest run` antes e depois → **mesmo conjunto pass/fail** (o teste do helper segue verde; nenhum teste perdido).
- `pnpm --filter web typecheck` limpo (nenhum import pendente do componente removido).

---

### SH-F.2 — ESTABILIDADE DE TESTE (matar a flakiness de máquina)

**O que:** ajustar `apps/web/vitest.config.ts` para os testes de render lentos pararem de gerar "regressão" fantasma sob carga paralela. Duas alavancas (aplicar a que resolver; medir):
- Subir `testTimeout` (default 5s → propor **15000ms**), global ou por-arquivo nos 3 suspeitos.
- Reduzir paralelismo do vitest: `test.maxWorkers` (ex.: metade dos cores) e/ou `poolOptions.threads.maxThreads`, ou `fileParallelism: false`, ou `pool: "forks"` + `poolOptions.forks.singleFork`. Escolher o MENOS invasivo que estabilize (recomendo `testTimeout: 15000` + cap de `maxWorkers`, medindo).

**Invariante:** NÃO "consertar" os 8 testes reais pré-existentes (são falhas reais, fora de escopo desta story). O alvo é remover a VARIAÇÃO fantasma, não mudar a natureza dos 8.

**Escopo de arquivos:** `apps/web/vitest.config.ts` (e, se optar por bump por-arquivo, os 3 arquivos de teste nomeados). **File-disjunto** de SH-F.1/F.3/F.4, com uma coordenação de baseline (ver §2).

**Critério de saída (verificável):**
- Baseline capturado ANTES (1 run cheia registrando o conjunto de falhas).
- **3 runs consecutivas** da suíte completa (`pnpm --filter web vitest run`) produzem **exatamente o MESMO conjunto de falhas** (os 8 pré-existentes), **sem variação** entre runs. Registrar o output das 3 runs como evidência (mesmos N falhando, mesmos nomes).
- Os 3 suspeitos (`role-selector`, `analytics-redirect`, `team-view-switch`) passam de forma determinística nas 3 runs (não aparecem mais como falha intermitente).

---

### SH-F.3 — CACHE POR TENANT do bloco da MÉDIA DA ORGANIZAÇÃO (perf, pré-requisito de tenant grande)

**O que:** memoizar o bloco org-wide por tenant com TTL curto, para não repetir 4 scans org-wide a cada request do mesmo tenant. **Espelhar o padrão já existente** em `feature-gate.ts` (`Map<tenantId, {payload, expiry}>` + TTL + `getCacheEntry`).

**Desenho recomendado (mínimo refactor, correto por construção):**
1. Extrair de `computeStudentComparison` a parte org-wide (área **linhas 1163-1214**: resolver `orgStudentIds`, os 4 scans org, `orgBlock`, `referenceStats`, e o `deadlineByCourse`/`tenantChapterCount` que o lado-org de `buildStudentHomeIndicators` consome) para uma função pura de carga: `loadOrgReference(db, tenantId, now)` → `{ orgStudentIds, orgSessionRows, orgReflectionRows, orgEnrollmentRows, deadlineByCourse, tenantChapterCount, orgBlock, referenceStats }`.
2. **NOVO arquivo** `apps/web/src/lib/analytics/org-reference-cache.ts`: `Map<tenantId, {ref, expiry}>` + TTL curto (**propor 60s**, calibrável, justificado: a home deve parecer viva mas a referência org só muda em janela). Invalidação **por TTL** (sem invalidação manual nesta fatia; staleness ≤ TTL é aceitável, documentar). Exportar `getOrgReference(db, tenantId, now)` que serve do cache ou chama `loadOrgReference` e popula.
3. `computeStudentComparison` passa a: (a) computar o bloco `student` FRESCO (linhas 1104-1152, **NUNCA cacheado**, é `student_id=auth`), (b) obter o org via `getOrgReference` (cacheado), (c) recompor `unit` + `buildStudentHomeIndicators(studentId, ...orgRef)` por request (barato, em memória, sem DB).

**Prova de que o bloco do ALUNO não é cacheado:** o cache é keyed SÓ por `tenantId` e guarda SÓ o `OrgReference` (dados agregados/da população org). O bloco `student` e o lado "Você" dos indicators são derivados por request a partir de `studentId`. Dois alunos do mesmo tenant → mesmo `orgBlock` (cache hit), blocos `student` DIFERENTES.

**Escopo de arquivos:** `lib/analytics/area-gestor.ts` (extrair + chamar o loader) + NOVO `lib/analytics/org-reference-cache.ts` + NOVO teste. **File-disjunto** de SH-F.1/F.2; independente de SH-F.4.

**Critério de saída (verificável):**
- **Teste de cache-hit:** um teste (novo, `lib/analytics/__tests__/org-reference-cache.test.ts`) com um `db` fake que CONTA chamadas `.from()`; prova que o **2º request do MESMO tenant dentro do TTL faz 0 scans org** (as 4 leituras org só ocorrem no 1º), e que após expirar o TTL recarrega.
- **Correção do número preservada:** o mesmo teste (ou irmão) prova que o `orgBlock`/indicators retornados no 2º request (cache hit) são **numericamente idênticos** ao 1º, e que **dois `studentId` distintos** no mesmo tenant recebem `student` diferentes com o MESMO `orgBlock` (aluno não-cacheado, org cacheado).
- `pnpm --filter web typecheck` limpo; suíte existente do módulo verde (nenhuma regressão em `computeStudentComparison`).

**ATENÇÃO PARA A SPEC (avisar Contrato/@po):** esta story **muda semântica de LEITURA**: a "Média da organização" passa a poder estar defasada em até o TTL (≤60s proposto). É staleness intencional e limitado; o bloco do aluno é sempre fresco. A spec deve declarar isso como comportamento aceito e fixar o TTL como decisão de produto.

---

### SH-F.4 — DADO DE DEMO FRESCO (home viva no tenant de demo)

**O que:** criar um SCRIPT de seed IDEMPOTENTE que atualiza/insere atividade RECENTE **apenas no tenant de demo** (`11111111-1111-1111-1111-111111111111`), para a home "Meu ritmo" mostrar números vivos (hoje o demo tem atividade ~52 dias atrás → "último acesso" velho e "% em dia" ruim). Espelhar o padrão `supabase/seed-remote.ts` (TS + service role via env).

**Guardas obrigatórias (spec, ver ATENÇÃO):**
- **DEMO-ONLY, NUNCA PROD:** o script DEVE abortar se o tenant alvo não for o demo. Guarda dupla: (a) `TENANT_ID` hardcoded = `11111111-1111-1111-1111-111111111111`, e (b) verificação em runtime de que `tenants.slug === "demo"` (ou name "Demo") ANTES de qualquer escrita; se não bater, `process.exit(1)` sem escrever. Recusar rodar se a URL do Supabase apontar para o host de produção (checagem de allowlist/negação por env, documentada).
- **IDEMPOTENTE:** re-rodar não duplica. Usar upsert/onConflict por chave estável, ou `delete-then-insert` do conjunto demo-recente marcado; datas ancoradas em `now - N dias` recomputadas a cada run (nunca acumula histórico duplicado). Rodar 2x seguidas → mesmo estado final.

**Escopo de arquivos:** NOVO `supabase/seed-student-home-demo.ts` (+ nota de execução, ex.: `pnpm tsx supabase/seed-student-home-demo.ts` com env). **File-disjunto** de todas as outras; independente de SH-F.3.

**Critério de saída (verificável):**
- Rodar o script no tenant de demo → a home real "Meu ritmo" (login do aluno demo) mostra **último acesso recente** (dias baixos) e **"% em dia" / ritmo saudável** (não "parado").
- **Idempotência provada:** rodar 2x → estado final idêntico (sem linhas duplicadas de atividade recente; contagem estável).
- **Guarda provada:** apontar o script para um tenant não-demo (ou slug ≠ "demo") → aborta com exit ≠ 0 e **zero escrita** (nenhuma linha criada/alterada).

**ATENÇÃO PARA A SPEC (avisar Contrato/@po):** esta story **ESCREVE no banco** (seed). Só pode rodar no tenant de demo, **nunca em produção**. A spec deve tornar a guarda demo-only e a idempotência critérios de aceite bloqueantes, não desejáveis.

---

## 2. Paralelização e matriz de conflito (3 pares)

As 4 stories são file-disjuntas. Distribuição recomendada nos 3 pares:

| Par | Story(s) | Arquivos | Racional |
|:--|:--|:--|:--|
| **Par A** | SH-F.1 + SH-F.2 | `student-progress-headline.tsx` (del), `vitest.config.ts` | Ambas pequenas. **Acoplamento fino:** F.1 mexe no conjunto de arquivos de teste (poda) e F.2 mexe em COMO os testes rodam. Mantê-las no MESMO par elimina coordenação cross-par sobre o baseline dos "8 pré-existentes". |
| **Par B** | SH-F.3 | `area-gestor.ts` (+ novo `org-reference-cache.ts` + teste) | Fatia mais pesada (semântica de leitura + cache + prova). Isolada. |
| **Par C** | SH-F.4 | novo `supabase/seed-student-home-demo.ts` | Escrita no banco, demo-only. Independente de B. |

**Matriz de conflito (escrita):**

| Arquivo | F.1 | F.2 | F.3 | F.4 |
|:--|:-:|:-:|:-:|:-:|
| `components/analytics/student-progress-headline.tsx` | del | · | · | · |
| `apps/web/vitest.config.ts` | · | ✎ | · | · |
| `lib/analytics/area-gestor.ts` | · | · | ✎ | · |
| `lib/analytics/org-reference-cache.ts` (novo) | · | · | ✎ | · |
| `supabase/seed-student-home-demo.ts` (novo) | · | · | · | ✎ |

Nenhuma célula com dois donos → 3 pares em paralelo.

**Coordenação de baseline (F.2 ↔ F.1/F.3):** o critério "3 runs = os 8 pré-existentes" de F.2 é medido no HEAD atual. F.1 remove um componente (sem teste próprio → não muda a contagem) e F.3 ADICIONA um teste novo (org-reference-cache) que deve passar. Portanto, na **integração final** (pós-merge das fatias), re-rodar a checagem de 3-runs-estáveis de F.2 com as fatias já dentro, confirmando que o novo teste de F.3 entra como PASS e os 8 pré-existentes seguem sendo os mesmos 8. Como F.1 e F.2 estão no MESMO par, essa coordenação é interna ao Par A + um re-check de integração; não há corrida entre pares.

**Ordem de merge sugerida:** F.1 e F.4 (independentes, baixo risco) → F.3 (cache, revisar semântica de leitura) → F.2 por último / re-verificado na integração (para o baseline de estabilidade refletir a árvore final). O Capataz load-balanceia; a única regra dura é F.2 ser **re-verificada após** todos os merges que adicionam/removem testes.

---

## 3. Atenção consolidada para o Contrato / @po (specs)

| Story | Natureza | Alerta de spec |
|:--|:--|:--|
| SH-F.1 | Poda (delete) | Órfão real; **não** apagar o helper nem o teste do helper. Precondição = 0 imports do componente. |
| SH-F.2 | Config de teste | Não mexe em app; não "conserta" os 8 reais; alvo é determinismo (3 runs iguais). |
| **SH-F.3** | **Muda semântica de LEITURA** | "Média da organização" pode estar defasada ≤ TTL (60s proposto). Staleness intencional e limitado; bloco do aluno sempre fresco. Fixar TTL como decisão de produto; provar que o aluno NÃO é cacheado. |
| **SH-F.4** | **ESCREVE no banco (seed)** | **Demo-only, NUNCA prod.** Guarda demo-only (tenant `1111...`/slug "demo") + idempotência são critérios de aceite BLOQUEANTES. Recusar rodar contra host de produção. |

---

## 4. Critério de saída deste plano (auto-checagem)

- [x] Cobre as **4 stories** com critério de saída **verificável** e paths/linhas reais (§1).
- [x] SH-F.1 corrige o briefing com o achado de código (o "teste do componente" é na verdade o teste do helper, que fica).
- [x] SH-F.2 tem critério objetivo (3 runs = mesmo conjunto de 8 falhas, sem variação).
- [x] SH-F.3 tem teste de cache-hit no 2º request + prova de número correto + prova de que o aluno não é cacheado; **atenção de leitura** sinalizada ao Contrato.
- [x] SH-F.4 idempotente + demo-only + nunca prod, com verificação por home viva; **atenção de escrita** sinalizada ao Contrato.
- [x] Fatias **file-disjuntas** e paralelizáveis em 3 pares, com matriz de conflito e a única coordenação real (baseline de F.2) explicitada (§2).

**Path deste plano:** `/Users/hugocapitelli/Dev/eximia/eximia-academy-v2/docs/stories/epic-student-home/03-finalizacao-plan.md`
