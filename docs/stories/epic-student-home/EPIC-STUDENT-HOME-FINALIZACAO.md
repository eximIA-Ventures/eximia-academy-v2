# EPIC: Finalização da Home do Aluno, Merge Redondo (EPIC-STUDENT-HOME-FINALIZACAO)

**Repo:** `eximia-academy-v2`
**Criado:** 2026-07-12
**Autor:** Saga (@pm, Autor de Epics)
**Insumos obrigatórios (LEITURA antes de qualquer story deste epic):**
- `docs/stories/epic-student-home/03-finalizacao-plan.md` (plano técnico de finalização, SH-F.1..F.4, Vitruvio/@architect)
- `docs/stories/epic-student-home/05-engajamento-fracao-plan.md` (plano da fatia SH-F.5, engajamento como fração "X de N", Vitruvio/@architect)
- `docs/stories/epic-student-home/06-merge-conflict-main-plan.md` (plano da fatia SH-F.6, resolução de conflito eng-center-v2 → main, pré-requisito de deploy prod Argos, Vitruvio/@architect)
**Insumos de contexto (fundação já entregue):**
- `docs/stories/epic-student-home/EPIC-STUDENT-HOME.md` (epic de feature, home "Meu ritmo" aprovada)
- `docs/stories/epic-student-home/01-architecture-plan.md`, `00-validation-stage0.md`
**Base de código a finalizar:** branch `feat/SH-1.4-student-home-card`, HEAD `d8b7f85`, worktree `/Users/hugocapitelli/Dev/eximia/sh-1.4-worktree`. Home "Meu ritmo" APROVADA e certificada, SEM push.
**Direção:** ordem direta do Hugo ("finaliza tudo"). Fase DOCS ONLY, nenhum código de app neste epic.
**Status:** Draft (todas as stories em Draft)

---

## 1. Tese

A home "Meu ritmo" do aluno está aprovada e certificada, porém a árvore ainda carrega itens de finalização que precisam fechar ANTES do merge: um componente órfão sobrevivente do refactor, uma suíte de testes que gera "regressão" fantasma sob CPU saturada, um caminho de leitura que repete quatro varreduras org-wide por request do mesmo tenant, e um tenant de demo com atividade velha que faz a home viva parecer parada.

Este epic não adiciona feature. Ele entrega a **limpeza e a estabilização** para o merge ficar redondo: poda o morto, torna a suíte determinística, corta o custo repetido de leitura por tenant sem mudar o número mostrado ao aluno, e devolve dado fresco ao demo. Cada item é escopado, file-disjunto e tem critério de saída verificável por comando, não por opinião.

O porquê é operacional e alinhado ao padrão da casa: "fine" não é aceitável (CP-09). Um merge com órfão, com falha-fantasma e com custo desnecessário por request é "quase pronto", não pronto. Este epic transforma "quase" em "redondo".

## 2. Contexto Verificado no Código (worktree SH-1.4)

A home oficial é `StudentHomeCard` (`apps/web/src/components/analytics/student-home-card.tsx`), montada por `student-dashboard.tsx → StudentComparison (fetch) → StudentHomeCard`. O dado vem de `GET /api/analytics/manager-groups?view=student` → `computeStudentComparison()` em `apps/web/src/lib/analytics/area-gestor.ts` (linhas 1091-1231). Quatro fatos apurados linha a linha ancoram as quatro stories:

| # | Achado | Evidência no código |
|---|--------|---------------------|
| 1 | **Órfão real:** o COMPONENTE `student-progress-headline.tsx` não é importado por código de app. O helper `buildProgressHeadline` (`student-comparison-scale.ts:353`) CONTINUA usado por `student-home-card.tsx:92`. O `__tests__/student-progress-headline.test.ts` testa SÓ o helper, não o componente. | Únicos "imports" do componente = comentários em `dev/preview-desempenho/page.tsx:62` e `student-home-card.tsx:23`. |
| 2 | **Flakiness de máquina:** `apps/web/vitest.config.ts` não define `testTimeout` nem tuning de paralelismo. Sob CPU saturada, testes de render lentos estouram o default (5s) e geram falha-fantasma. | Suspeitos localizados: `admin/__tests__/role-selector.test.tsx`, `dashboard/__tests__/analytics-redirect.test.ts`, `dashboard/_components/__tests__/team-view-switch.test.tsx`. |
| 3 | **Custo org-wide por request:** `computeStudentComparison` dispara, por request, 4 scans org-wide do tenant (`sessions`, `slide_reflections`, `enrollments`, `courses`). O bloco org é idêntico para todos os alunos do tenant numa janela; só o bloco `student` é escopado a `student_id`. | area-gestor.ts linhas 1163-1214 (org) vs 1104-1152 (student, auth). |
| 4 | **Padrão de cache já existe:** `apps/web/src/lib/feature-gate.ts` usa cache in-memory por processo (`Map<tenantId, {..., expiry}>` + `CACHE_TTL_MS`). App roda em processo longo (EasyPanel/Docker, não serverless), então cache por processo é válido, como já é em prod. | Padrão canônico a espelhar em SH-F.3. |

**Padrão de seed:** scripts em `supabase/` (`seed.sql` declarativo; `seed-remote.ts` = TS com `@supabase/supabase-js` via service role em `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`). **Tenant de demo:** `11111111-1111-1111-1111-111111111111`, name "Demo", slug "demo".

## 3. Premissas de Finalização (fixadas, não reabrir nas stories)

1. **Poda é subtração cirúrgica, não faxina.** Remove-se SÓ o componente órfão comprovado. O helper vivo e o teste do helper ficam. Apagar cobertura de função usada é regressão silenciosa, proibida.
2. **Estabilidade não conserta bug real.** O alvo de SH-F.2 é matar a VARIAÇÃO fantasma; os 8 testes reais pré-existentes são falha real fora de escopo, não se tocam.
3. **Cache preserva o número.** O valor mostrado ao aluno no cache-hit é numericamente idêntico ao do primeiro request. O aluno NUNCA é cacheado; só o agregado org é.
4. **Seed é demo-only, sempre.** Guarda dupla (tenant hardcoded + slug "demo" em runtime) e recusa de host de produção são bloqueantes, não desejáveis.
5. **File-disjunção é invariante.** Nenhum arquivo tem dois donos entre as quatro stories (matriz §7). O único ponto de coordenação é o baseline de estabilidade de SH-F.2, resolvido por re-verificação na integração.

## 4. Escopo

### In-scope (esta wave de finalização)
- **SH-F.1:** remoção do componente órfão `student-progress-headline.tsx`, preservando o helper `buildProgressHeadline` e o teste do helper.
- **SH-F.2:** estabilização de `apps/web/vitest.config.ts` (subir `testTimeout`, cap de paralelismo) para eliminar falha-fantasma sob carga.
- **SH-F.3:** cache in-memory por tenant do bloco org-wide de `computeStudentComparison`, com TTL curto, espelhando `feature-gate.ts`; extração de `loadOrgReference` + novo `org-reference-cache.ts`.
- **SH-F.4:** script de seed idempotente `supabase/seed-student-home-demo.ts`, demo-only, que devolve atividade recente ao tenant de demo.
- **SH-F.5:** o número do topo da coluna Engajamento na home "Meu ritmo" vira fração "X de N" (feedback direto do Hugo), N = máximo da trilha do aluno (`capítulos*2 + slides-com-reflexão-possível`), reusando a heurística `reflectionPotential`/`isReflectionBlock` já existente. Sublinha absoluta intocada; `winnerOf` inalterado; linha da Média default absoluto.
- **SH-F.6:** resolver o conflito de merge `feat/engagement-center-v2 → main` (3 arquivos), pré-requisito do deploy de prod do Argos. Numa branch de integração off-main, ZERO push. Conflitos 1 (module-gate, bugfix) e 2 (question-chooser, UI) resolvidos a favor do ENG; conflito 3 (`analytics/students/[studentId]/page.tsx`, **gate LGPD de verbatim**) é POLÍTICA **GATED, só aplicado após ratificação explícita do Hugo**.
- **SH-F.7:** estender o MESMO gate `canSeeRawContent` (papel primário `instructor`/`admin`/`super_admin`) já implementado e aprovado em SH-F.6 ao campo `assessments.results` da página do aluno (`analytics/students/[studentId]/page.tsx`, ~linhas 346-350), fail-closed (`results: null` quando negado), fechando o 2º canal de exposição sinalizado pela Lupa. Manager/leader primário NUNCA veem texto livre do aluno, mesmo com chapéu instructor.
- **SH-F.8:** copy polish Tier-3 (verbatim do Hugo) na home "Meu ritmo": nomenclatura user-facing "organização" → "turma" (no deploy per-client tenant = cliente, então os alunos = "a turma"). SÓ DISPLAY, zero lógica/dado: a média permanece org-wide, nenhum identificador/tipo/chave de cache renomeado. 4 trocas load-bearing (subtitle em `student-home-card.tsx:110`, label em `comparison-insights-table.tsx:261`, 2 assertions nos testes) + 3 de consistência (comentários/títulos de teste).

### Out-of-scope (Non-Goals desta wave)
- Qualquer feature nova ou mudança de UI da home (a home "Meu ritmo" está aprovada; não se redesenha nada).
- "Consertar" os 8 testes reais pré-existentes (falha real, fora do escopo de SH-F.2).
- Remover o helper `buildProgressHeadline` ou o arquivo de teste do helper (SH-F.1 é só o `.tsx`).
- Invalidação manual de cache no SH-F.3 (staleness ≤ TTL é aceito por design; sem invalidação manual nesta fatia).
- Qualquer escrita fora do tenant de demo; qualquer execução do seed contra host de produção (SH-F.4 é bloqueado disso por guarda).
- **Fração também na linha da Média** (SH-F.5): default é Média ABSOLUTA (sem denominador), para não inventar um denominador de máximos heterogêneos que confunde. A alternativa "média dos máximos das trilhas dos alunos da org" fica FLAGADA para o Hugo decidir; só entra como story nova SE houver GO, não se implementa sem ordem.
- Push, PR, deploy ou release (autoridade exclusiva do @devops; este epic para no merge local documentado).

## 5. Decisões de Arquitetura (já tomadas no plano, não reabrir)

Derivadas de `03-finalizacao-plan.md`. Cada uma com natureza cravada.

1. **SH-F.1, poda só do `.tsx`.** O briefing original dizia "componente órfão + seu teste"; o achado de código corrige: não existe teste do componente, o `.test.ts` cobre o helper vivo. Portanto delete SÓ do componente; teste PERMANECE (opcionalmente renomeado para `student-comparison-scale.progress-headline.test.ts`, aditivo). SUBTRAÇÃO.
2. **SH-F.2, tuning de config, não de teste.** Duas alavancas: `testTimeout` (default 5s → propor 15000ms) e cap de paralelismo (`maxWorkers` / `poolOptions` / `fileParallelism`). Escolher o MENOS invasivo que estabilize, medindo. Não altera a natureza dos 8 reais. CONFIG.
3. **SH-F.3, cache por tenant espelhando `feature-gate.ts`.** Extrair a parte org-wide (area-gestor.ts 1163-1214) para `loadOrgReference(db, tenantId, now)`; novo `lib/analytics/org-reference-cache.ts` com `Map<tenantId, {ref, expiry}>` + TTL curto (propor 60s, calibrável) + `getOrgReference`. `computeStudentComparison` computa o bloco `student` FRESCO por request e obtém o org via cache. ADITIVO em estrutura, muda semântica de LEITURA (staleness ≤ TTL, ver §8).
4. **SH-F.4, seed idempotente demo-only.** Novo `supabase/seed-student-home-demo.ts` espelhando `seed-remote.ts`. Guarda dupla (tenant hardcoded `1111...` + slug "demo" em runtime) e recusa de host de produção; datas ancoradas em `now - N dias` recomputadas a cada run (upsert/onConflict ou delete-then-insert do conjunto demo-recente). ESCRITA (banco, demo-only).
5. **SH-F.5, engajamento como fração "X de N".** Campo OPCIONAL `engagementMax?` em `StudentHomeSubject` (`types/analytics.ts`); `computeStudentComparison` deriva a trilha do aluno (capítulos já carregados) + 1 scan novo de `chapter_slides.text_content` da trilha, lado do ALUNO e FRESCO (nunca cacheado, coerente com o invariante de SH-F.3), calculando `engagementMax = capítulosTrilha*2 + reflectionPossibleSlides` via a heurística `reflectionPotential` existente (reusar, não reinventar). Só o `subjectNode` da coluna engagement ganha o denominador; sublinha, `referenceNode`, `subjectValue`/`referenceValue` e `winnerOf` INTOCADOS (denominador é só display, nunca altera o vencedor). Média absoluta por default. ADITIVO (campo opcional, degradação graciosa se `engagementMax` ausente).
6. **SH-F.6, resolução de conflito de merge eng-center-v2 → main.** Diverge das anteriores: NÃO é feature nem arquivo do card, é INTEGRAÇÃO. Numa branch `integration/eng-to-main` a partir da `main` (tip `52a54f5`), aplicar `git merge feat/engagement-center-v2` e resolver os 3 conflitos: (1) `module-gate.tsx` a favor do ENG (bugfix: template literal interpolado no `mailto` vs string quebrada da main); (2) `question-chooser-sheet.tsx` a favor do ENG (z-[9999] + fundo branco inline de imunidade-CSS-stale, que SUBSUME o "solid backdrop" da tip da main), com o porquê REGISTRADO no commit; (3) `analytics/students/[studentId]/page.tsx` = **reescrita com gate LGPD**, recomendação ENG **PENDENTE-DE-CONFIRMAÇÃO-DO-HUGO** (ver §8), aplicada só após GO. Guardrails duros: off-main, ZERO push, `git merge --abort`/`reset --hard` se sujar, main definitiva/deploy/cory intocados. Verificação de saída = build de prod verde (`pnpm --filter @eximia/web build`) + checklist da Lupa. INTEGRAÇÃO (gated no conflito 3).

## 6. Critérios de Sucesso (mensuráveis)

O epic é considerado correto se, e somente se, TODOS os critérios abaixo forem verdadeiros:

1. **SH-F.1:** `grep -rn "from .*student-progress-headline\|import.*StudentProgressHeadline" apps/web/src` retorna 0 imports de app antes da poda; após a poda o componente não existe, `buildProgressHeadline` continua existindo e usado (`grep -rn "buildProgressHeadline" apps/web/src` mostra `student-home-card.tsx` + o teste), `pnpm --filter web typecheck` limpo, e o conjunto pass/fail da suíte é o MESMO antes e depois (nenhum teste perdido).
2. **SH-F.2:** com baseline capturado antes, 3 runs consecutivas de `pnpm --filter web vitest run` produzem exatamente o MESMO conjunto de falhas (os 8 pré-existentes), sem variação; os 3 suspeitos (`role-selector`, `analytics-redirect`, `team-view-switch`) passam de forma determinística nas 3 runs.
3. **SH-F.3:** um teste com `db` fake que conta chamadas `.from()` prova que o 2º request do mesmo tenant dentro do TTL faz 0 scans org, que recarrega após expirar o TTL, que o `orgBlock`/indicators do cache-hit são numericamente idênticos ao 1º request, e que dois `studentId` distintos no mesmo tenant recebem `student` diferentes com o MESMO `orgBlock`; `pnpm --filter web typecheck` limpo e suíte do módulo verde.
4. **SH-F.4:** rodar o script no tenant de demo torna a home real "Meu ritmo" (login do aluno demo) mostrar último acesso recente e ritmo saudável; rodar 2x seguidas produz estado final idêntico (idempotência, sem linhas duplicadas); apontar para tenant não-demo (ou slug ≠ "demo") aborta com exit ≠ 0 e ZERO escrita.
5. **Integração:** re-verificação da estabilidade de SH-F.2 com todas as fatias já mescladas confirma que o novo teste de SH-F.3 entra como PASS e os 8 pré-existentes seguem sendo os mesmos 8.

## 7. Paralelização, Fatias e Matriz de Conflito

SH-F.1 a SH-F.4 são file-disjuntas, distribuídas em 3 pares. SH-F.5 entra depois (fatia da fração de engajamento) e tem UM ponto de contato soft com SH-F.3 em `area-gestor.ts` (regiões distintas de `computeStudentComparison`), resolvido por ordem de merge (ver nota abaixo).

| Par | Story(s) | Arquivos | Racional |
|:--|:--|:--|:--|
| **Par A** | SH-F.1 + SH-F.2 | `student-progress-headline.tsx` (del), `vitest.config.ts` | Ambas pequenas. Acoplamento fino: F.1 mexe no conjunto de arquivos de teste e F.2 em COMO os testes rodam. Mesmo par elimina coordenação cross-par sobre o baseline dos 8 pré-existentes. |
| **Par B** | SH-F.3 | `area-gestor.ts` (bloco ORG) + novo `org-reference-cache.ts` + teste | Fatia mais pesada (semântica de leitura + cache + prova). Isolada. |
| **Par C** | SH-F.4 | novo `supabase/seed-student-home-demo.ts` | Escrita no banco, demo-only. Independente de B. |
| **Par D** | SH-F.5 | `area-gestor.ts` (bloco ALUNO, fresco) + `types/analytics.ts` + `student-home-indicators.ts` + `comparison-insights-table.tsx` + preview + testes | Fração "X de N" do engajamento. Toca `computeStudentComparison` no bloco do ALUNO (não no ORG de F.3) + 1 scan novo de `chapter_slides` da trilha do aluno. Sequenciar merge com F.3 (mesmo arquivo, regiões distintas). |

**Matriz de conflito (escrita):**

| Arquivo | F.1 | F.2 | F.3 | F.4 |
|:--|:-:|:-:|:-:|:-:|
| `components/analytics/student-progress-headline.tsx` | del | · | · | · |
| `apps/web/vitest.config.ts` | · | ✎ | · | · |
| `lib/analytics/area-gestor.ts` | · | · | ✎ | · |
| `lib/analytics/org-reference-cache.ts` (novo) | · | · | ✎ | · |
| `supabase/seed-student-home-demo.ts` (novo) | · | · | · | ✎ |

SH-F.5 acrescenta escrita em `types/analytics.ts`, `lib/analytics/student-home-indicators.ts`, `components/analytics/comparison-insights-table.tsx`, `app/dev/preview-desempenho/page.tsx` (todos exclusivos dela) e em `lib/analytics/area-gestor.ts` no **bloco do ALUNO** (`computeStudentComparison`, região distinta do bloco ORG de SH-F.3). É a única sobreposição de arquivo do epic: mesmo arquivo, regiões diferentes, sem célula de dois donos na MESMA região.

Entre SH-F.1 a SH-F.4 nenhuma célula tem dois donos, os 3 pares rodam em paralelo. SH-F.5 é sequenciada com SH-F.3 (ver ordem de merge).

**SH-F.6 opera em outro plano:** não edita arquivos do card, resolve o merge `eng-center-v2 → main` numa branch de integração off-main. Seus 3 conflitos são com o feature-work DIVERGENTE da própria main (`module-gate.tsx`, `question-chooser-sheet.tsx`, `analytics/students/[studentId]/page.tsx`), não com SH-F.1..F.5. É a ÚLTIMA fatia da corrente (só faz sentido depois que o trabalho do card aterrissa em `eng-center-v2`), e está bloqueada no conflito 3 até o GO do Hugo.

**Coordenação de baseline (F.2 ↔ F.1/F.3):** o critério "3 runs = os 8 pré-existentes" de F.2 é medido no HEAD atual. F.1 remove um componente sem teste próprio (não muda a contagem) e F.3 ADICIONA um teste novo que deve passar. Na integração final, re-rodar a checagem de 3-runs-estáveis de F.2 com as fatias dentro. Como F.1 e F.2 estão no MESMO par, essa coordenação é interna ao Par A mais um re-check de integração; não há corrida entre pares.

**Ordem de merge sugerida:** F.1 e F.4 (independentes, baixo risco) → F.3 (cache, revisar semântica de leitura) → F.5 (fração de engajamento, rebasar sobre F.3 já que ambas tocam `computeStudentComparison`) → F.2 por último / re-verificada na integração (baseline reflete a árvore final). Duas regras duras: (a) F.2 re-verificada após todos os merges que adicionam ou removem testes; (b) F.5 e F.3 sequenciadas, não mescladas em paralelo cego, por tocarem `area-gestor.ts` (regiões distintas, mas o Capataz rebasa uma sobre a outra). O scan novo de `chapter_slides` de F.5 é do lado do aluno e NÃO entra no `OrgReference` cacheado de F.3 (preserva o invariante "aluno nunca cacheado").

## 8. Atenções Bloqueantes para o Contrato / @po (specs)

| Story | Natureza | Alerta de spec |
|:--|:--|:--|
| SH-F.1 | Poda (delete) | Órfão real. NÃO apagar o helper nem o teste do helper. Precondição = 0 imports do componente, provada por grep antes de podar. |
| SH-F.2 | Config de teste | Não mexe em app. Não "conserta" os 8 reais. Alvo é determinismo (3 runs iguais). |
| **SH-F.3** | **Muda semântica de LEITURA** | "Média da organização" pode estar defasada em até o TTL (60s proposto). Staleness intencional e limitado; bloco do aluno sempre fresco. Fixar o TTL como decisão de produto; provar que o aluno NÃO é cacheado. |
| **SH-F.4** | **ESCREVE no banco (seed)** | Demo-only, NUNCA prod. Guarda demo-only (tenant `1111...` / slug "demo") + idempotência são critérios de aceite BLOQUEANTES. Recusar rodar contra host de produção. |
| **SH-F.5** | **Assunção de modelagem + decisão pendente do Hugo** | (a) Assume-se **capítulo → 1 interação concluível** no teto N; se um capítulo puder gerar >1 sessão concluída contável, o teto muda; a decisão cravada é capítulo→1, documentar. (b) Linha da Média default = ABSOLUTA (sem denominador); a alternativa "média dos máximos das trilhas" NÃO se implementa sem GO explícito do Hugo (nova story). (c) Ordem de merge com SH-F.3: ambas tocam `computeStudentComparison`, regiões distintas (F.3 = bloco ORG cacheado, F.5 = bloco ALUNO fresco); sequenciar. O scan novo de `chapter_slides` de F.5 é do aluno e NÃO entra no cache org. |
| **SH-F.6** | **POLÍTICA LGPD, GATED pela ratificação do Hugo + guardrails de integração** | O conflito 3 (`analytics/students/[studentId]/page.tsx`) NÃO é aplicado sem GO explícito do Hugo, porque muda POLÍTICA de acesso a dado pessoal do aluno: **(1)** leader e manager passam a ABRIR a página de detalhe do aluno (vendo só agregados `moduleInsights`, NUNCA verbatim), antes só manager/admin/super_admin; **(2)** "quem vê o texto VERBATIM (chat + reflexão)" passa a ser instructor + admin + super_admin sobre a UNIÃO de chapéus, ou seja manager e leader NUNCA veem o texto literal. Se a política do Hugo for outra, o gate muda. Guardrails duros (não-negociáveis): branch de integração off-main, ZERO push (deploy é do @devops com o GO), `abort`/`reset --hard` + restore se sujar, main definitiva/deploy/cory intocados. Nota fail-closed a registrar: o gate de ACESSO usa `profile.role` singular e `canSeeRawContent` usa a união `roles`; um `role="student"` com chapéu instructor é BLOQUEADO no acesso (fail-closed, não vaza). Lupa verifica os 4 eixos (§4 do plano 06) + build de prod verde. |
| **SH-F.7** | **Extensão do gate LGPD a 1 campo (correção curta, padrão já estabelecido)** | Estende o gate `canSeeRawContent` (por PAPEL PRIMÁRIO, já implementado e aprovado pela Lupa em SH-F.6) ao campo `assessments.results` (~linhas 346-350), fail-closed: `results: canSeeRawContent ? a.results : null`. **Default é `null`** porque `assessment_history.results` é JSON opaco cujo schema varia por `assessment_type` e PODE conter texto livre do aluno; sem allowlist por-tipo, a única garantia objetiva de "nenhum texto livre alcança manager/leader" é não enviar `results` quando negado (idêntico a messages→`[]` e reflections→`[]`). **Follow-up FLAGADO, não escopo desta story:** se o produto exigir scores estruturados para manager, isso vira allowlist por `assessment_type` numa story nova, só com especificação dos campos a preservar pelo Contrato/Hugo. **Guard aditivo:** verificar que `StudentFullProfile` tolera `results: null` no ramo manager/leader sem crash. Base: worktree `integration/main-x-engagement` (HEAD `7416995`); ZERO push; main (`52a54f5`) intocada. |
| **SH-F.8** | **Copy de DISPLAY apenas (Tier-3) + sequenciamento e build batched** | SÓ copy user-facing: "organização" → "turma". **LIMITE DURO:** NÃO renomear `orgAverage`/`OrgReference`/`org-reference-cache`/tipos em `types/analytics.ts`; NÃO tocar cálculo (média permanece org-wide). Semântica preserva-se porque no deploy per-client tenant = cliente, logo os alunos = "a turma". Variante gráficos (`SignalRowsView`) não tem copy "organização" (grep confirma), nada a trocar; preview (`page.tsx:98`) é só comentário, o label exibido herda do componente. **Sequenciamento:** fazer DEPOIS de SH-F.7 fechar (não atropelar o review LGPD focado), na MESMA worktree `integration/main-x-engagement`; build de prod final é BATCHED cobrindo SH-F.6 + SH-F.7 + SH-F.8 num único verde (116/116). ZERO push; main (`52a54f5`) intocada. |

## 9. Regras de Execução Para Quem Implementar

- Cada story é autossuficiente: um dev sem acesso a esta conversa deve conseguir implementar só com a story + `03-finalizacao-plan.md`.
- **Todo requisito rastreia ao plano `03-finalizacao-plan.md`** (Constitution Art. IV, No Invention). Nenhum requisito inventado fora do plano.
- First-move rule (sdc-mandatory): SH-F.2 e SH-F.3 tocam testes, então capturar suíte VERDE/baseline antes; SH-F.3 é refactor de leitura, verde do início ao fim.
- Nenhuma story fecha sem `lint`, `typecheck` e `test` verdes (confirmar comandos exatos do `apps/web/package.json` na Dev Notes de cada story).
- Onde este overview e uma story divergirem em detalhe técnico, a Dev Notes da story (verificada por último) vence, mas a divergência é reportada de volta ao PO/SM.
- Nenhuma story deste epic faz push, PR ou deploy (autoridade exclusiva do @devops).

## 10. Lista de Stories Previstas

| # | Story | 1 linha |
|---|-------|---------|
| SH-F.1 | Poda do órfão `StudentProgressHeadline` | Remover SÓ o componente `apps/web/src/components/analytics/student-progress-headline.tsx`, preservando o helper `buildProgressHeadline` (vivo, usado pelo CTA) e o teste do helper (opcionalmente renomeado). Precondição bloqueante: grep prova 0 imports de app do componente. Saída: typecheck limpo + mesmo conjunto pass/fail da suíte. |
| SH-F.2 | Estabilidade de teste (matar flakiness de máquina) | Ajustar `apps/web/vitest.config.ts` (subir `testTimeout` para 15000ms + cap de paralelismo, o menos invasivo que estabilize) para os testes de render lentos pararem de gerar regressão fantasma sob carga. Sem "consertar" os 8 reais. Saída: 3 runs consecutivas = mesmo conjunto de 8 falhas, sem variação; os 3 suspeitos determinísticos. |
| SH-F.3 | Cache por tenant do bloco da média da organização | Extrair a parte org-wide de `computeStudentComparison` para `loadOrgReference(db, tenantId, now)`; novo `lib/analytics/org-reference-cache.ts` (`Map<tenantId, {ref, expiry}>` + TTL 60s + `getOrgReference`), espelhando `feature-gate.ts`. Bloco `student` sempre fresco. Saída: teste de cache-hit (0 scans no 2º request, recarga pós-TTL), número idêntico no hit, dois alunos com mesmo org e `student` distintos. Muda semântica de leitura (avisar Contrato). |
| SH-F.4 | Seed de demo fresco (home viva no tenant de demo) | Novo `supabase/seed-student-home-demo.ts` idempotente, demo-only (tenant `1111...`/slug "demo"), datas ancoradas em `now - N dias`, espelhando `seed-remote.ts`. Saída: home real do aluno demo mostra último acesso recente e ritmo saudável; 2 runs = estado idêntico; apontar para não-demo aborta com exit ≠ 0 e zero escrita. Escreve no banco (avisar Contrato). |
| SH-F.5 | Engajamento do topo vira fração "X de N" | Campo opcional `engagementMax?` em `StudentHomeSubject`; `computeStudentComparison` deriva a trilha do aluno + 1 scan novo de `chapter_slides.text_content` da trilha (lado do aluno, fresco, nunca cacheado) → `engagementMax = capítulosTrilha*2 + reflectionPossibleSlides` via heurística `reflectionPotential` existente. Só o `subjectNode` da coluna engagement ganha o denominador; sublinha, `referenceNode`, `winnerOf` intocados; Média absoluta default. Saída: teste prova "X de N" no Você e degradação para "X" sem o campo, sublinha absoluta intocada, `winnerOf` invariante ao denominador, N correto para fixture, typecheck limpo. Assunção capítulo→1 interação + decisão pendente da fração na Média (avisar Contrato). |
| SH-F.6 | Resolução de conflito de merge eng-center-v2 → main (deploy prod Argos) | Branch `integration/eng-to-main` off-main (`52a54f5`), `git merge feat/engagement-center-v2`, resolver 3 conflitos: (1) `module-gate.tsx` → ENG (bugfix mailto template literal); (2) `question-chooser-sheet.tsx` → ENG (z-[9999] + fundo branco inline imunidade-CSS-stale, subsume o solid backdrop da main), porquê registrado no commit; (3) `analytics/students/[studentId]/page.tsx` → ENG (gate LGPD de verbatim) **só após ratificação do Hugo**. Malho executa, PARA no conflito 3 e flaga; Lupa verifica os 4 eixos LGPD + os 2 triviais + build de prod verde. ZERO push, main intocada, deploy é do @devops. Saída: build `pnpm --filter @eximia/web build` verde na branch de integração + checklist da Lupa OK. |
| SH-F.7 | Gate LGPD do `assessments.results` (2º canal de exposição) | Estender o gate `canSeeRawContent` (papel primário, já aprovado em SH-F.6) ao `results` de assessments em `analytics/students/[studentId]/page.tsx` (~linhas 346-350): `results: canSeeRawContent ? a.results : null`, fail-closed, consistente com messages/reflections. Guard aditivo de `results: null` em `StudentFullProfile`. Escopo: 1 campo (+ guard de null se necessário). Follow-up flagado (allowlist de scores estruturados por `assessment_type`) fora de escopo. Saída: (a) manager primário COM chapéu instructor → `results` sem texto livre (`null`); (b) instructor/admin/super_admin primário → `results` completo; (c) leader/manager puro → sem texto livre; (d) `pnpm --filter web build` verde (116/116, exit 0); (e) suíte delta ZERO vs baseline + typecheck 0; teste do gate espelhando o de messages/reflections, com eixo assessments. Base: worktree `integration/main-x-engagement` (HEAD `7416995`); ZERO push; main (`52a54f5`) intocada. |
| SH-F.8 | Copy polish "organização" → "turma" no Meu ritmo (Tier-3, só display) | Trocar a copy user-facing "organização" → "turma" nos 2 componentes do Meu ritmo, sem tocar lógica/dado (média segue org-wide; tenant = cliente no deploy per-client). 4 trocas load-bearing: (1) subtitle `student-home-card.tsx:110` "…em relação à organização…" → "…em relação à turma…"; (2) label `comparison-insights-table.tsx:261` "Média da organização" → "Média da turma"; (3) assertion `student-home-card.test.tsx:169`; (4) assertion `comparison-insights-table.test.tsx:61`. +3 de consistência (comentários + títulos de teste, não bloqueiam). LIMITE DURO: NÃO renomear `orgAverage`/`OrgReference`/`org-reference-cache`/tipos. Variante gráficos sem copy "organização" (grep confirma); preview herda o label. Saída: (a) subtitle "turma"; (b) label "Média da turma"; (c) variante+preview sem copy "organização" user-facing; (d) testes dos 2 componentes verdes com "turma"; (e) zero mudança de lógica/dado, build de prod verde 116/116. Sequenciar APÓS SH-F.7, MESMA worktree, build batched F.6+F.7+F.8. ZERO push; main (`52a54f5`) intocada. |

---

## Change Log

| Data | Mudança | Autor |
|---|---|---|
| 2026-07-12 | Epic de finalização criado a partir do plano `03-finalizacao-plan.md` (Vitruvio/@architect), ordem "finaliza tudo" do Hugo. Quatro stories file-disjuntas (SH-F.1 a SH-F.4), critérios verificáveis, atenções de cache (leitura) e seed (escrita-demo) sinalizadas ao Contrato. | Saga (@pm) |
| 2026-07-13 | SH-F.5 adicionada a partir do plano `05-engajamento-fracao-plan.md` (Vitruvio/@architect), feedback do Hugo na home "Meu ritmo": engajamento do topo vira fração "X de N". Fatia entra na MESMA branch/PR #1. Registradas a sobreposição soft com SH-F.3 em `computeStudentComparison` (regiões distintas, merge sequenciado), a assunção capítulo→1 interação e a decisão pendente da fração na Média (default absoluto, alternativa "média dos máximos" só com GO do Hugo). | Saga (@pm) |
| 2026-07-13 | SH-F.6 adicionada a partir do plano `06-merge-conflict-main-plan.md` (Vitruvio/@architect), pré-requisito do deploy prod Argos: resolver `eng-center-v2 → main` (3 conflitos). Conflitos 1 (module-gate, bugfix) e 2 (question-chooser, UI) → ENG; conflito 3 (`analytics/students/[studentId]/page.tsx`, gate LGPD de verbatim) marcado GATED pela ratificação de POLÍTICA do Hugo (leader/manager abrem a página vendo só agregados; verbatim = instructor/admin/super_admin). Guardrails: branch off-main, ZERO push, main definitiva intocada. | Saga (@pm) |
| 2026-07-13 | SH-F.7 adicionada a partir do plano `07-assessments-gate-plan.md` (Vitruvio/@architect). Correção curta que ANEXA à finalização (não é epic novo): estende o gate `canSeeRawContent` por papel primário, JÁ implementado e aprovado pela Lupa em SH-F.6, ao campo `assessments.results` (2º canal de exposição sinalizado pela Lupa), fail-closed (`null`) e consistente com messages/reflections. Follow-up de allowlist de scores estruturados por `assessment_type` FLAGADO fora de escopo. Base: worktree `integration/main-x-engagement` (HEAD `7416995`), ZERO push, main (`52a54f5`) intocada. | Saga (@pm) |
| 2026-07-13 | SH-F.8 adicionada a partir do plano `08-copy-turma-plan.md` (Vitruvio/@architect). Copy polish Tier-3 (verbatim do Hugo) que ANEXA à finalização: nomenclatura user-facing "organização" → "turma" no Meu ritmo, SÓ display, zero lógica/dado (média segue org-wide; tenant = cliente no deploy per-client). 4 trocas load-bearing (2 copy + 2 assertions) + 3 de consistência. Limite duro registrado (não renomear `orgAverage`/`OrgReference`/`org-reference-cache`/tipos). Sequenciada APÓS SH-F.7, MESMA worktree, build de prod final BATCHED cobrindo F.6+F.7+F.8. ZERO push, main (`52a54f5`) intocada. | Saga (@pm) |
