# LOOP-2 — Auditoria funcional por mutação dirigida

**Objeto:** as duas frentes entregues nos 40 commits de `integra/main-cory` à frente de `origin/main` — **Aprendizagem do Time** (analytics do gestor) e **Autogestão da Jornada** (visão do aluno).
**Branch / HEAD:** `integra/main-cory` @ `d2b8083`.
**Auditor:** @qa (Quinn). **Data:** 2026-08-28.
**Método:** mutação dirigida. Injeta o defeito no código de produção, roda a suíte, **reverte**, e compara o conjunto de vermelhos com o do baseline. Verde não é evidência; só reprovar sob defeito é.

---

## 0. Veredito

**NEEDS_WORK.**

| | |
|:---|---:|
| Mutações aplicadas e medidas (válidas) | **49** |
| PEGOU (a suíte reprovou o defeito) | 23 |
| **NÃO PEGOU** | **26** |
| — dos quais **código morto** (ação: apagar) | 4 |
| — dos quais **não coberto** (ação: escrever teste) | 22 |
| Baseline | 284 testes, 100% verde, 0 falha |
| Árvore de produção ao final | `git diff --stat -- apps/web/src packages/` **vazio** |

A suíte destas duas frentes tem **235 testes verdes** na área e **284** com o gate de rota incluído. Ela é forte exatamente onde foi escrita com pares contraditórios (limiares de amostra, estado vazio, gate de papel) e **cega em blocos inteiros** que nenhum teste executa: o leitor de dados de Aprendizagem do Time, o gate de auth da rota do aluno, e todo o caminho de erro.

O achado mais caro não é uma asserção fraca. É que **os 7 filtros de tenant/aluno das consultas podem ser deletados um a um e a suíte permanece 235/235 verde** — num caminho onde o cliente Supabase é o de **serviço**, isto é, RLS está desligada por desenho e o `.eq("tenant_id", …)` da aplicação é a **única** fronteira entre dois clientes pagantes no mesmo banco.

---

## 1. Onde a mutação rodou, e por que não na árvore de verdade

`scripts/mutacao.mjs` (commit `ef2bd1d`) declara como regra 1: *"injeção nunca acontece em árvore compartilhada sem aviso — um defeito injetado e um defeito real são o mesmo byte no disco"*. Havia outro agente ativo lendo esta árvore durante a run. Portanto toda injeção ocorreu em **clone isolado APFS** (`/tmp/mut-loop2`, `cp -cR` de `apps/web/src` + `scripts`, `node_modules` por symlink), cujo baseline foi conferido idêntico ao da árvore real (28 arquivos / 235 testes) antes da primeira mutação. Restauração conferida por `sha256` ao fim de cada rodada.

**A varredura de mutação existe e nunca foi apontada para cá.** A lista `MUTANTES` de `scripts/mutacao.mjs` cobre 30 mutantes de `padroes-tendencias` (a área da onda anterior). **Zero** dos mutantes catalogados toca `aprendizagem-time` ou `autogestao`. O motor é reutilizável — foi o que reusei —, mas as duas frentes novas entraram em produção sem passar por ele.

---

## 2. Tabela de mutações

Legenda de severidade: **CRÍTICA** (vazamento entre clientes ou acesso indevido) · **ALTA** (número errado exibido como verdade ao usuário) · **MÉDIA** (regra de produto não pinada) · **BAIXA/MORTA** (limpeza).

### Eixo A — Isolamento por tenant e por aluno · 7 mutações · **0 PEGOU**

| # | Regra | Mutação aplicada | Teste que deveria pegar | Veredito | Sev. |
|:--|:---|:---|:---|:---|:---|
| A1 | Sessões do aluno são do tenant | `sessions`: remover `.eq("tenant_id", tenantId)` | — nenhum | **NÃO PEGOU** | CRÍTICA |
| A2 | Sessões são do aluno logado | `sessions`: remover `.eq("student_id", studentId)` | — nenhum | **NÃO PEGOU** | CRÍTICA |
| A3 | Reflexões são do tenant | `slide_reflections`: remover `.eq("tenant_id", …)` | — nenhum | **NÃO PEGOU** | CRÍTICA |
| A4 | Módulos são do tenant | `chapters`: remover `.eq("tenant_id", …)` | — nenhum | **NÃO PEGOU** | CRÍTICA |
| A5 | Capacidades são do tenant | `capabilities`: remover `.eq("tenant_id", p.tenantId)` | — nenhum | **NÃO PEGOU** | CRÍTICA |
| A6 | Avaliações são do tenant | `capability_assessments`: remover `.eq("tenant_id", …)` | — nenhum | **NÃO PEGOU** | CRÍTICA |
| A7 | Pessoas listadas são do tenant | `users`: remover `.eq("tenant_id", p.tenantId)` | — nenhum | **NÃO PEGOU** | CRÍTICA |

**Discriminação morto × não coberto** (canário: `throw` na entrada da função; silêncio = a função nunca executa na suíte):

| Canário | Resultado | Leitura |
|:---|:---|:---|
| `lerFonteAutogestao` | **PEGOU** (3 vermelhos) | A função **executa** na suíte (`fuso-horario.test.ts` a dirige) — e mesmo assim A1-A4 passam. Os testes atravessam a consulta e **não olham** os filtros. Não coberto. |
| `lerFonteAprendizagem` | **NÃO PEGOU** | A função **nunca executa** em teste algum. `fonte-supabase.ts` de Aprendizagem do Time tem **cobertura zero**: A5-A7 são um caso particular de um arquivo inteiro sem teste. |

**Evidência literal (A1).** Diff da mutação e saída da suíte com ela aplicada:

```diff
--- a/apps/web/src/lib/analytics/autogestao/fonte-supabase.ts
+++ b/apps/web/src/lib/analytics/autogestao/fonte-supabase.ts
@@ -168,7 +168,6 @@
       .select(
         "id, chapter_id, status, created_at, completed_at, turn_number, interactions_remaining",
       )
-      .eq("tenant_id", tenantId)
       .eq("student_id", studentId)
       .order("created_at", { ascending: true })
       .range(de, ate),
```

```
 Test Files  28 passed (28)
      Tests  235 passed (235)
   Duration  3.22s
```

**Por que isto é CRÍTICO e não teórico.** `_trinca/recorte.ts` declara, no próprio tipo: `db` é *"Client de SERVIÇO: é ele que lê os dados (RLS bloqueia o gestor por desenho)"*. Não há rede de segurança abaixo. Esta casa já teve vazamento cross-tenant real chegar a produção em 18/08/2026 — o comentário de cabeçalho de `trava-de-tenant.test.ts` registra o incidente. A trava que nasceu daquele incidente protege o **script de semeadura**, não as consultas de produção.

### Eixo B — Gate de acesso da rota · 4 mutações · **2 PEGOU**

| # | Regra | Mutação | Teste que pegou | Veredito | Sev. |
|:--|:---|:---|:---|:---|:---|
| B1 | Quem não é gestor não entra em `/analytics` | `if (!hasAnyRole(…)) redirect` → `if (false)` | `analytics-redirect` — 6 vermelhos, incl. as 3 abas da trinca | **PEGOU** | — |
| B2 | O gate está na **porta** da rota | comentar `await garantirAcessoAnalytics()` em `page.tsx` | os mesmos 6 | **PEGOU** | — |
| B3 | Sem sessão vai para `/login` | `if (!user \|\| !profile) redirect("/login")` removido | — nenhum | **NÃO PEGOU** | ALTA |
| B4 | `/jornada` exige login | `if (!user \|\| !profile) redirect("/login")` → `if (false)` | — nenhum | **NÃO PEGOU** | ALTA |

**Discriminação:**

| Canário | Resultado | Leitura |
|:---|:---|:---|
| `garantirAcessoAnalytics` | **PEGOU** (7) | A função executa e é bem testada — mas **só o ramo de papel**. O ramo "sem sessão" nunca é exercido: os testes sempre mockam um usuário presente. B3 = não coberto. |
| `recorte.ts` de `/jornada/_autogestao` | **NÃO PEGOU** | O recorte do aluno **nunca executa** em teste algum. B4 = cobertura zero do gate de auth da rota do aluno. |

**Nota justa ao trabalho feito.** B1 e B2 são os dois pontos que os commits `0da6d7b` ("o gate de acesso volta para a porta da rota") e `c6ed19c` ("a porta estava trancada por dentro") se propuseram a corrigir. **Ambos estão genuinamente pinados por mutação** — comentar a chamada do gate reprova 6 testes, incluindo um por aba da trinca. Esta é a parte mais bem construída das duas frentes, e o teste foi escrito na altura certa (renderiza a superfície e lê a árvore, em vez de testar o helper isoladamente).

### Eixo C — Limiares e classificador · 14 mutações · **6 PEGOU**

| # | Regra | Mutação | Veredito | Sev. |
|:--|:---|:---|:---|:---|
| C1 | §7 mín. 3 aprendizes (cópia em `limiares.ts`) | `3 → 1` | **NÃO PEGOU** | **MORTA** |
| C2 | §7 mín. 5 evidências (cópia em `limiares.ts`) | `5 → 1` | **NÃO PEGOU** | **MORTA** |
| C3 | §7 mín. 2 períodos (cópia em `limiares.ts`) | `2 → 1` | **NÃO PEGOU** | **MORTA** |
| C4 | `MIN_EVIDENCIAS_EMERGENTE` | `1 → 0` | **NÃO PEGOU** | **MORTA** |
| C5 | §7 mín. 3 aprendizes (cópia **viva**, `base.ts`) | `3 → 1` | **PEGOU** (F-03) | — |
| C6 | §7 mín. 5 evidências (cópia **viva**, `base.ts`) | `5 → 1` | **PEGOU** (F-04 + Onde trava) | — |
| C7 | §7 mín. 2 períodos (cópia **viva**, `base.ts`) | `2 → 1` | **PEGOU** (F-05) | — |
| C8 | `amostraSuficiente` não é sempre-true | `>= 0 && >= 0` | **PEGOU** (2) | — |
| C9 | `tendenciaDisponivel` não é sempre-true | `return true` | **PEGOU** (F-05) | — |
| C10 | Triangulação exige piso por categoria | `MIN_…_DEMONSTRADA 2 → 1` | **PEGOU** (F-02, 2) | — |
| C11 | Piso cognitivo existe (sítio 1) | `>= MIN_…_COGNITIVA` → `>= 0` | **PEGOU** (F-01) | — |
| C12 | Piso cognitivo **vale o número 2** | `MIN_…_COGNITIVA 2 → 1` | **NÃO PEGOU** | MÉDIA |
| C13 | `emerging` tem piso de volume (sítio 2) | `avaliaveis.length >= 0` | **NÃO PEGOU** | MÉDIA |
| C14 | Quiz alto **eleva** profundidade | `Math.max` → `Math.min` | **NÃO PEGOU** | ALTA |
| C15 | Quiz baixo rebaixa a partir de 50% | `< 0.5` → `< 0.05` | **NÃO PEGOU** | ALTA |
| C16 | Capacidade exige ≥3 alunos p/ entrar na evolução | `3 → 1` | **NÃO PEGOU** | MÉDIA |
| C17 | Evolução mostra no máximo 4 linhas | `4 → 99` | **NÃO PEGOU** | MÉDIA |

**O achado C1-C4 é do tipo que a própria varredura foi construída para separar.** Não é asserção fraca: é **constante morta**. `classificador/limiares.ts` abre com um bloco de comentário que se apresenta como a casa dos literais da spec §7, com proveniência documentada por grupo — e **ninguém importa esses três**. `limiares.ts` é importado por um único arquivo (`agregador.ts`) e só para as duas constantes do Grupo 2. As três do Grupo 1 vivem, de facto, **duplicadas em `base.ts:97-99`**, e é essa cópia que `amostraSuficiente()` lê:

```
lib/analytics/aprendizagem-time/classificador/limiares.ts:  AMOSTRA_MIN_APRENDIZES = 3   ← morta, ninguém importa
lib/analytics/aprendizagem-time/base.ts:97:                  AMOSTRA_MIN_APRENDIZES = 3   ← viva, é esta que decide
```

A armadilha é precisa: quem for calibrar o piso da §7 vai ao arquivo que se anuncia como o dono do número, muda `3` para `4`, roda a suíte, vê **235 verdes**, e conclui que o número não estava coberto — quando na verdade **não mudou nada em produção**. `MIN_EVIDENCIAS_EMERGENTE` tem exatamente **uma** ocorrência em todo o repositório: a própria declaração.

Registro o crédito devido: a cópia **viva** dos três limiares está **bem coberta** (C5-C9, todos PEGOU), com pares contraditórios (2 alunos → vazio / 3 alunos → ok). A regra de negócio está protegida; o que está podre é a duplicata que aparenta ser a fonte.

**C14/C15 são o buraco funcional real deste eixo.** O canário `classificarPorHeuristica` **PEGOU (8 vermelhos)** — a função executa e tem 8 testes. Mas nenhum deles varia o `quizScorePct`: inverter `Math.max` para `Math.min` (isto é, fazer um quiz de 80%+ **rebaixar** a profundidade em vez de elevar) não move um único teste.

### Eixo D — Séries temporais · 4 mutações · **1 PEGOU**

| # | Regra | Mutação | Veredito | Sev. |
|:--|:---|:---|:---|:---|
| D1 | A janela do gráfico é de 10 semanas | `NUM_SEMANAS_SERIE 10 → 4` | **NÃO PEGOU** | ALTA |
| D2 | A semana começa na **segunda** (UTC) | `diaSemana === 0 ? 6 : diaSemana - 1` → `diaSemana` | **NÃO PEGOU** | ALTA |
| D3 | A janela semanal é fechada à direita | `fimMs = inicio + SEMANA_MS` → `* 2` | **PEGOU** (1) | — |
| D4 | §31: "estado coletivo" = *developing* **ou** *demonstrated* | filtro passa a contar só `demonstrated` | **NÃO PEGOU** | ALTA |

**Discriminação:** os canários de `ultimasSemanas`, `montarEvolucaoProfundidade` e `montarCapacidadesEvolucao` **todos PEGARAM** (1, 1 e 14 vermelhos). Os três módulos executam e têm testes. Portanto D1, D2 e D4 são **não cobertos**, não mortos — o código roda em produção e nenhuma asserção olha para ele.

D2 é o mais insidioso: deslocar a fronteira da semana de segunda para domingo redistribui **toda** evidência de domingo para o balde anterior, mudando cada ponto da série sem quebrar nada. D4 muda a definição do indicador que o gestor lê como percentual.

### Eixo E — O vazio como caminho principal · 7 mutações · **6 PEGOU**

| # | Regra | Mutação | Veredito | Sev. |
|:--|:---|:---|:---|:---|
| E1 | `blocoVazio` não pode virar `ok` | `estado: "vazio"` → `estado: "ok"` | **PEGOU** (**9**) | — |
| E2 | O texto do vazio é literal da §7 | `TEXTO_AMOSTRA_INSUFICIENTE` → `""` | **PEGOU** (F-03) | — |
| E3 | Sem histórico → "sem-tendencia", não gráfico | ramo do vazio desativado | **PEGOU** (F-05) | — |
| E4 | **Erro ≠ vazio** | `blocoErro` devolve `estado: "vazio"` | **NÃO PEGOU** | ALTA |
| E5 | Mapa de calor tem piso de amostra | `if (carimbos.length < MIN)` → `if (false)` | **PEGOU** (1) | — |
| E6 | O piso do mapa é o número declarado | piso → `9999` | **PEGOU** (**6**) | — |
| E7 | `SemLastro` traz motivo na voz do aluno | `semLastro("")` | **PEGOU** (1) | — |

**O commit `fada8d5` cumpriu o que prometeu.** "As 3 telas do aluno com o vazio como caminho principal" está **provado**: transformar vazio em ok reprova 9 testes; apagar o texto do vazio reprova; mexer no piso do mapa de calor reprova nos dois sentidos (removê-lo e inflá-lo). Este é o eixo mais bem construído das duas frentes, e o padrão do par contraditório (19 atividades → SemLastro / 20 → grade) é o motivo.

**A exceção é E4, e ela importa.** O canário `blocoErro` **NÃO PEGOU**: a função **nunca é executada por teste algum**. Não existe um único teste que force uma falha de leitura e siga o caminho até o bloco. O par que o vazio tem, o erro não tem — e são exatamente os dois estados que nunca podem ser confundidos: dizer *"amostra ainda insuficiente"* quando a verdade é *"a consulta falhou"* informa ao gestor que **não há dado** quando o que houve foi **um defeito**.

---

## 3. Gabaritos: comparados, mas fora de qualquer gate automático

**São decoração no CI, e não são decoração no fluxo manual.** O veredito exige as duas metades.

| Fato | Consequência |
|:---|:---|
| `provar-elo4.mjs` **não é** um `*.test.*`. Não há nenhum arquivo de teste em `apps/web/scripts/gauntlet/`. | O `GABARITO.json` **nunca** é conferido por `pnpm test`, nem por qualquer gate automático. Só roda se alguém digitar o comando. |
| O prover exige um banco vivo e semeado (`semear.mjs` escreve, depois lê). | Não é executável em CI sem credenciais de produção — o `.env.local` deste repo aponta para o banco de **produção**. |
| `GABARITO.json` está **modificado e não commitado** na árvore. | Conferi o diff: **apenas UUIDs** mudaram (`courseId`, `capituloIds`, `studentId`, `enrollmentId`). O bloco `elementos` — os valores esperados — está **byte a byte idêntico**. É resíduo de uma re-semeadura, não divergência de cálculo. Sem impacto no veredito, mas convém não commitar ruído de seed. |
| O gabarito é **gerado pelos montadores de produção** (`montarVisaoGeralAutogestao` etc.). | O autor documenta isto de forma explícita e honesta no cabeçalho de `provar-elo4-nucleo.ts`, incluindo a correção de uma versão anterior que comparava contra um segundo cálculo próprio. **O que o prover prova é o caminho de LEITURA** (o dado volta do banco igual ao que entrou, isto é, os filtros e o round-trip). **Não prova a matemática** — se `montagem.ts` calcular errado, o gabarito grava o erro e a comparação fica verde. |
| `calculos-elo4.mjs` existe como segundo par de olhos sobre a matemática. | Divergência entre as duas fórmulas é **impressa e gravada**, nunca reprova. É um relatório, não um gate. |

**A ironia operacional:** o prover é o único artefato que exercitaria os filtros de tenant do Eixo A — e é justamente ele que nenhum gate automático roda. O buraco A1-A7 e a ausência do gabarito no CI são **o mesmo buraco visto de dois lados**.

---

## 4. Lacunas ordenadas por risco

### 1. CRÍTICA — Os 7 filtros de tenant/aluno podem ser deletados sem reprovar nada, num caminho onde RLS está desligada
**O que quebra em produção, e para quem:** um gestor do cliente A passa a ver capacidades, avaliações e nomes de pessoas do cliente B; um aluno passa a ver as sessões de outro aluno. O cliente Supabase é o de **serviço** — o `.eq("tenant_id", …)` da aplicação é a única fronteira, e ela não tem teste. Esta casa já teve este exato incidente em 18/08/2026.
**Onde:** `lib/analytics/autogestao/fonte-supabase.ts` (A1-A4) · `lib/analytics/aprendizagem-time/fonte-supabase.ts` (A5-A7, arquivo com cobertura zero).

### 2. CRÍTICA/ALTA — `/jornada` e o ramo "sem sessão" do gate não têm gate testado
**O que quebra, e para quem:** `recorte.ts` de `/jornada/_autogestao` nunca executa em teste. Se o `redirect("/login")` for removido num refactor, um visitante não autenticado chega ao recorte com `profile` nulo — e nenhum vermelho aparece. Vale para todo aluno da plataforma, não só para quem usa a Autogestão. A rota do **gestor** está protegida (B1/B2 provados); a do **aluno** não.
**Onde:** `app/(platform)/jornada/_autogestao/recorte.ts` · ramo `!user || !profile` de `analytics/_trinca/recorte.ts`.

### 3. ALTA — Erro de leitura pode ser servido como "sem dados", e nada reprova
**O que quebra, e para quem:** `blocoErro` nunca executa em teste. Um gestor olhando uma consulta que **falhou** lê *"Amostra ainda insuficiente"* e conclui que o time não produziu evidência — quando o que houve foi um defeito de infraestrutura. Decisão de gestão tomada sobre um erro silenciado é pior que tela de erro.
**Onde:** `lib/analytics/aprendizagem-time/estado-bloco.ts` (`blocoErro`), e todo `primeiraFalha(...) → blocoErro` que dele depende.

### 4. ALTA — A série temporal pode mudar de forma inteira sem reprovar: janela, fronteira da semana e definição do indicador
**O que quebra, e para quem:** deslocar o início da semana de segunda para domingo (D2) redistribui toda atividade dominical para o balde anterior e move **cada ponto** do gráfico de evolução; encolher a janela de 10 para 4 semanas (D1) apaga histórico sem aviso; contar só *demonstrated* em vez de *developing ou demonstrated* (D4) muda a definição §31 do percentual que o gestor lê como estado do time. Os três são silenciosos, e os três alteram um número que a tela apresenta como fato.
**Onde:** `lib/analytics/aprendizagem-time/semanas.ts` · `capacidades-evolucao.ts`.

### 5. ALTA — O ajuste de profundidade por nota de quiz pode ser invertido sem reprovar
**O que quebra, e para quem:** trocar `Math.max` por `Math.min` faz um quiz de 80%+ **rebaixar** a profundidade cognitiva do aluno em vez de elevá-la. O classificador tem 8 testes e nenhum varia `quizScorePct`. O efeito chega à classificação de maturidade de cada pessoa do time — é o insumo de "quem precisa de apoio".
**Onde:** `lib/analytics/aprendizagem-time/classificador/heuristica.ts:35-36`.

### 6. MÉDIA — Quatro constantes mortas que se anunciam como a fonte da régua
**O que quebra, e para quem:** o próximo engenheiro a calibrar a §7 edita `classificador/limiares.ts`, vê a suíte verde, e acredita ter mudado o piso. Não mudou nada: a cópia viva está em `base.ts`. O defeito não é hoje, é na próxima calibragem — e ele vem disfarçado de suíte saudável.
**Ação: apagar, não escrever teste.** `AMOSTRA_MIN_APRENDIZES`, `AMOSTRA_MIN_EVIDENCIAS`, `TENDENCIA_MIN_PERIODOS` (duplicatas de `base.ts`) e `MIN_EVIDENCIAS_EMERGENTE` (zero consumidores no repositório).

### 7. MÉDIA — Cortes de apresentação e pisos secundários não pinados
**O que quebra, e para quem:** `MIN_ALUNOS_POR_CAPACIDADE` (3→1) faz aparecer no painel capacidade com um único aluno, contradizendo a própria guarda de amostra da §7 exibida ao lado; `MAX_LINHAS` (4→99) estoura a tela; o valor `2` do piso cognitivo e o piso de volume de `emerging` não são pinados (só a existência da comparação é).
**Onde:** `capacidades-evolucao.ts` · `classificador/agregador.ts:74,99` · `classificador/limiares.ts` (Grupo 2).

### 8. MÉDIA — A varredura de mutação da casa nunca apontou para estas duas frentes
**O que quebra, e para quem:** `scripts/mutacao.mjs` existe, funciona, e sua lista `MUTANTES` cobre 30 mutantes de `padroes-tendencias` e **zero** destas frentes. A ferramenta que encontraria tudo acima estava no repositório, a um `--somente=` de distância. Enquanto a lista não for estendida, cada onda nova entra em produção com a mesma cegueira.

---

## 5. O que está genuinamente bem feito

Registro porque um laudo que só lista buracos é tão desonesto quanto uma suíte que só mostra verdes.

- **O gate de papel da rota do gestor está provado por mutação** (B1/B2, 6 vermelhos cada). O teste renderiza a superfície e lê a árvore, em vez de testar o helper isolado — precisamente a diferença entre pinar a regra e pinar uma função que ninguém chama.
- **O vazio é caminho principal, e isso é verificável** (E1-E3, E5-E7): 6 de 7 mutações reprovam, uma delas com 9 vermelhos.
- **Os limiares vivos da §7 têm par contraditório** (C5-C9): 2 alunos → vazio, 3 alunos → ok. É o padrão certo, e funciona.
- **O cabeçalho de `provar-elo4-nucleo.ts` documenta com honestidade** o que o gabarito prova e o que não prova, incluindo a autocorreção de uma versão anterior que comparava contra o próprio cálculo. Isso é mais raro que uma suíte verde.

---

## 6. Higiene da run

| Verificação | Resultado |
|:---|:---|
| `git diff --stat -- apps/web/src packages/` | **vazio** — nenhuma mutação sobreviveu no disco |
| `git status --porcelain \| wc -l` | **34** (33 do baseline + `docs/auditoria/`, criado por LOOP-0) |
| Backups órfãos (`*.bkp`, `*.mutacao-backup`) em `apps/`/`packages/` | **nenhum** |
| Restauração conferida por `sha256` | ok em todas as 4 rodadas |
| Branch / HEAD ao final | `integra/main-cory` @ `d2b8083`, inalterada |
| Commits feitos | **nenhum** |
| Escritas no banco | **nenhuma** — toda a medição é de suíte local, sem ida ao Supabase |
| Correções aplicadas | **nenhuma** — esta rodada mede e reprova; o conserto é de outro loop (maker ≠ checker) |

**Ressalva metodológica registrada.** Duas das minhas sondas-canário da rodada 2 (`montarEvolucaoProfundidade`, `montarMapaDeCalorAtividade`) foram construídas com erro: injetei um comentário onde pretendia injetar um `throw`, o que as tornou no-ops. O silêncio delas não provava nada. Foram refeitas corretamente na rodada 3 (ambas PEGARAM: 1 e 15 vermelhos) e as versões defeituosas estão excluídas da contagem de 49. Registro porque um canário mudo por defeito próprio é indistinguível de um canário mudo por cobertura ausente — e essa é exatamente a confusão que este laudo existe para não cometer.
