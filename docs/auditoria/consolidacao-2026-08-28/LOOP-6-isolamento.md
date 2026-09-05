# LOOP-6 — Blindagem do isolamento de tenant e dos gates de auth

**Objeto:** os 7 filtros de escopo do Eixo A e os 2 gates de auth do Eixo B do laudo `LOOP-2-funcional.md`.
**Branch / HEAD:** `integra/main-cory` @ `d2b8083` (inalterada).
**Autor:** @dev (Dex). **Data:** 2026-08-28.
**Método:** para cada guarda, escrever o teste, **remover a guarda do código de produção**, provar que a suíte reprova, e restaurar. Verde não conta; só o vermelho sob defeito conta.

---

## 0. Veredito

**Os 9 estão pinados.** Nenhuma exceção, nenhum item que eu não tenha conseguido matar.

| | |
|:---|---:|
| Guardas exigidas (A1-A7, B3, B4) | **9** |
| Provadas por mutação (removida ⇒ suíte VERMELHA) | **9** |
| Não conseguidas | **0** |
| Suíte ao final (`src/lib/analytics/`) | **143 arquivos, 1031 testes, 100% verde** |
| Baseline antes desta rodada | 140 arquivos, 1009 testes, 100% verde |
| Arquivos de produção modificados ao final | **nenhum** (`git diff --stat` vazio) |
| Commits feitos | **nenhum** |
| Escritas no banco | **nenhuma** |

Baseline e final diferem em **+3 arquivos e +22 testes** — exatamente os arquivos criados aqui.

### Nenhuma correção de produção foi feita, e isso é deliberado

Os 7 filtros já estavam **escritos e corretos**. O defeito nunca foi o código; foi a **ausência de guarda automática** sobre ele. Esta rodada não muda uma linha de produção: escreve a guarda que faz o CI apitar quando alguém apagar um `.eq()` num refactor.

---

## 1. O instrumento: por que um duplo novo, e não o que já existia

O duplo que existia (`bancoFalso()` de `fuso-horario.test.ts`) devolve `{ data: [], error: null }` para **qualquer** consulta. Ali, `.eq()` é um no-op que só devolve a própria cadeia. É por isso que `lerFonteAutogestao` **executava** nos testes e mesmo assim A1-A4 sobreviviam: os testes **atravessavam** a consulta sem **olhar** para ela. Apagar um filtro não mudava uma vírgula do que o duplo devolvia.

Criei `apps/web/src/lib/analytics/__tests__/banco-que-filtra.ts`. Ele guarda cada predicado (`eq`/`in`/`is`/`neq`), aplica todos sobre um conjunto que contém linhas de **dois tenants**, e só então devolve — projetando as colunas do `select()`, como o PostgREST faz.

**Escolhi a forma superior das duas que o briefing ofereceu, e ela vale para os 7.** Nenhum caso caiu na forma inferior (spy de `.eq()`): todas as asserções são sobre **o dado que volta**, nenhuma sobre a chamada ter sido emitida. A diferença importa porque um spy pinaria a *implementação* (chamar `.eq`) e morreria num refactor legítimo que trocasse `.eq()` por `.match()`; linhas de dois tenants pinam a *intenção* (não vazar), que é o que precisa sobreviver.

**Duas decisões do duplo que não são detalhe:**

1. **A cadeia é *thenable*, e resolve na hora do `await`, não na hora do `.range()`.** `aprendizagem-time/fonte-supabase.ts` chama `.range(de, ate)` e só **depois** `.eq("course_id", …)`. Um duplo que resolvesse dentro de `.range()` perderia esse filtro e estaria medindo uma consulta que não existe.
2. **Projeção do `select()`.** Sem ela, o duplo devolveria `tenant_id` em linhas cujo `select` não o pede, e uma asserção poderia se apoiar num campo que produção nunca lê. Em `slide_reflections`, por exemplo, o `select` é só `created_at` — por isso a fixture dá carimbos distintos por linha, para que a discriminação seja possível **com o que produção de fato seleciona**.

### A fixture é adversarial de propósito, e sem isso metade das provas seria falsa

Cada linha estrangeira é barrada por **exatamente um** filtro:

- a linha de `sessions` do outro tenant carrega o **mesmo `student_id`**;
- a do outro aluno carrega o **mesmo `tenant_id`**;
- o módulo do outro cliente está sob o **mesmo `course_id`**;
- a avaliação do outro cliente aponta para a **minha** `capability_id`.

Se cada linha divergisse nos dois eixos ao mesmo tempo, o filtro sobrevivente engoliria a mutação do outro: apagar `.eq("tenant_id")` continuaria verde porque `.eq("student_id")` barraria a linha assim mesmo. O teste provaria "existe **algum** filtro", não "existem **os dois**" — que é precisamente o defeito sendo corrigido, reencenado dentro do próprio teste.

**Controle positivo em todos os arquivos.** Sem ele, um duplo que devolvesse `[]` para tudo (o duplo antigo) passaria em **todas** as asserções de ausência. Detector cego aprova o vazio. Em `aprendizagem-time` o controle positivo ganha uma segunda função: `lerFonteAprendizagem` tem uma **saída antecipada** quando não há capacidade nenhuma, e sem esse caso os demais poderiam estar medindo o retorno curto sem jamais ter chegado às três consultas seguintes.

---

## 2. Eixo A — os 7 filtros

### A1 · `sessions` · `.eq("tenant_id", tenantId)`

**Teste:** `autogestao/__tests__/isolamento-de-tenant-e-aluno.test.ts` → *"A1 — `sessions` não traz sessão de OUTRO TENANT (mesmo com o mesmo student_id)"*
**Forma:** linhas de dois tenants (a superior).

```diff
--- a/apps/web/src/lib/analytics/autogestao/fonte-supabase.ts  (linha 171)
-      .eq("tenant_id", tenantId)
```

```
 × A1 — `sessions` não traz sessão de OUTRO TENANT (mesmo com o mesmo student_id)
 × fecho — o retorno é EXATAMENTE o que é meu, em todas as quatro consultas
 × espelho — lendo como o outro cliente, só as linhas DELE voltam

AssertionError: expected [ 's-minha', 's-do-outro-tenant' ] to not include 's-do-outro-tenant'
 ❯ isolamento-de-tenant-e-aluno.test.ts:216:48

 Test Files  1 failed (1)
      Tests  3 failed | 5 passed (8)
```

**Restaurado.** `sha256` confere: `8163072056195801d775af19c72a0efc5a2222f406aeda3759f3a57c749a23c3`.

---

### A2 · `sessions` · `.eq("student_id", studentId)`

**Teste:** *"A2 — `sessions` não traz sessão de OUTRO ALUNO (mesmo dentro do meu tenant)"*

```diff
--- a/apps/web/src/lib/analytics/autogestao/fonte-supabase.ts  (linha 172)
-      .eq("student_id", studentId)
```

```
 × A2 — `sessions` não traz sessão de OUTRO ALUNO (mesmo dentro do meu tenant)
 × fecho — o retorno é EXATAMENTE o que é meu, em todas as quatro consultas

AssertionError: expected [ 's-minha', 's-do-outro-aluno' ] to not include 's-do-outro-aluno'
 ❯ isolamento-de-tenant-e-aluno.test.ts:221:48

 Test Files  1 failed (1)
      Tests  2 failed | 6 passed (8)
```

**Restaurado.** `sha256` confere: `8163072056195801d775af19c72a0efc5a2222f406aeda3759f3a57c749a23c3`.

> **Note-se a discriminação.** A mutação de A1 mata o caso A1 e **não** o caso A2; a de A2 mata A2 e **não** A1. Isso não saiu de graça: na primeira versão os dois casos fechavam com `toEqual(["s-minha"])` e morriam juntos em qualquer das duas mutações — o vermelho dizia "vazou", mas não dizia **qual** filtro morreu. O fecho exaustivo foi movido para um caso próprio, e cada caso nomeado ficou com a única ausência que só o seu filtro produz.

---

### A3 · `slide_reflections` · `.eq("tenant_id", tenantId)`

**Teste:** *"A3 — `slide_reflections` não traz reflexão de OUTRO TENANT (mesmo aluno)"*
Discriminação por `created_at`, porque é a única coluna que o `select` desta consulta traz.

```diff
--- a/apps/web/src/lib/analytics/autogestao/fonte-supabase.ts  (linha 183)
-      .eq("tenant_id", tenantId)
```

```
 × A3 — `slide_reflections` não traz reflexão de OUTRO TENANT (mesmo aluno)
 × fecho — o retorno é EXATAMENTE o que é meu, em todas as quatro consultas

AssertionError: expected [ '2026-08-01T10:00:00.000Z', …(1) ] to not include '2026-08-02T10:00:00.000Z'
 ❯ isolamento-de-tenant-e-aluno.test.ts:226:58

 Test Files  1 failed (1)
      Tests  2 failed | 6 passed (8)
```

**Restaurado.** `sha256` confere: `8163072056195801d775af19c72a0efc5a2222f406aeda3759f3a57c749a23c3`.

---

### A4 · `chapters` · `.eq("tenant_id", tenantId)`

**Teste:** *"A4 — `chapters` não traz módulo de OUTRO TENANT (mesmo sob o MESMO course_id)"*

```diff
--- a/apps/web/src/lib/analytics/autogestao/fonte-supabase.ts  (linha 209)
-      .eq("tenant_id", tenantId)
```

```
 × A4 — `chapters` não traz módulo de OUTRO TENANT (mesmo sob o MESMO course_id)
 × fecho — o retorno é EXATAMENTE o que é meu, em todas as quatro consultas
 × espelho — lendo como o outro cliente, só as linhas DELE voltam

AssertionError: expected [ 'modulo-meu', …(1) ] to not include 'modulo-do-outro-tenant'
 ❯ isolamento-de-tenant-e-aluno.test.ts:231:50

 Test Files  1 failed (1)
      Tests  3 failed | 5 passed (8)
```

**Restaurado.** `sha256` confere: `8163072056195801d775af19c72a0efc5a2222f406aeda3759f3a57c749a23c3`.

---

### A5 · `capabilities` · `.eq("tenant_id", p.tenantId)`

**Teste:** `aprendizagem-time/__tests__/isolamento-de-tenant.test.ts` → *"A5 — `capabilities` não traz capacidade de OUTRO TENANT"*

Este arquivo é a **primeira vez** que `lerFonteAprendizagem` roda sob teste. O canário do LOOP-2 ficou mudo por cobertura zero; A5-A7 não eram asserção fraca, eram um arquivo inteiro que nenhum teste alcançava.

```diff
--- a/apps/web/src/lib/analytics/aprendizagem-time/fonte-supabase.ts  (linha 99)
-      .eq("tenant_id", p.tenantId)
```

```
 × A5 — `capabilities` não traz capacidade de OUTRO TENANT
 × fecho — o retorno é EXATAMENTE o do meu tenant, nas quatro consultas
 × espelho — lendo como o outro cliente, só as linhas DELE voltam

AssertionError: expected [ 'cap-minha', 'cap-do-outro-cliente' ] to not include 'cap-do-outro-cliente'
 ❯ isolamento-de-tenant.test.ts:211:52

 Test Files  1 failed (1)
      Tests  3 failed | 4 passed (7)
```

**Restaurado.** `sha256` confere: `b60474665dcfce727787b341c3f2337e6ec8eb739abd0329f15b91c4545b66ce`.

---

### A6 · `capability_assessments` · `.eq("tenant_id", p.tenantId)`

**Teste:** *"A6 — `capability_assessments` não traz avaliação de OUTRO TENANT (mesma capability_id)"*

**Ressalva honesta, e ela é o achado metodológico desta rodada.** Esta consulta tem uma segunda barreira: `.in("capability_id", capacidadeIds)`, e `capacidadeIds` já vem filtrado por tenant. Se a linha estrangeira apontasse para a capacidade do outro cliente, o `.in()` a barraria sozinho e apagar o filtro de tenant **continuaria verde** — a camada redundante engoliria a mutação. Por isso a fixture põe a avaliação do outro tenant sob a **minha** `capability_id`. É deliberadamente adversarial, e é o que faz o filtro de tenant carregar o próprio peso em vez de pegar carona no vizinho.

```diff
--- a/apps/web/src/lib/analytics/aprendizagem-time/fonte-supabase.ts  (linha 142)
-      .eq("tenant_id", p.tenantId)
```

```
 × A6 — `capability_assessments` não traz avaliação de OUTRO TENANT (mesma capability_id)
 × fecho — o retorno é EXATAMENTE o do meu tenant, nas quatro consultas

AssertionError: expected [ 'aluno-meu', …(1) ] to not include 'aluno-do-outro-cliente'
 ❯ isolamento-de-tenant.test.ts:216:58

 Test Files  1 failed (1)
      Tests  2 failed | 5 passed (7)
```

**Restaurado.** `sha256` confere: `b60474665dcfce727787b341c3f2337e6ec8eb739abd0329f15b91c4545b66ce`.

---

### A7 · `users` · `.eq("tenant_id", p.tenantId)`

**Teste:** *"A7 — `users` não traz PESSOA de OUTRO TENANT (mesmo papel, não deletada)"*
O que vaza aqui é **nome de pessoa** de outro cliente pagante, não um id opaco — por isso o teste assere id **e** nome.

```diff
--- a/apps/web/src/lib/analytics/aprendizagem-time/fonte-supabase.ts  (linha 227)
-      .eq("tenant_id", p.tenantId)
```

```
 × A7 — `users` não traz PESSOA de OUTRO TENANT (mesmo papel, não deletada)
 × fecho — o retorno é EXATAMENTE o do meu tenant, nas quatro consultas
 × espelho — lendo como o outro cliente, só as linhas DELE voltam

AssertionError: expected [ 'aluno-meu', …(1) ] to not include 'aluno-do-outro-cliente'
 ❯ isolamento-de-tenant.test.ts:222:47

 Test Files  1 failed (1)
      Tests  3 failed | 4 passed (7)
```

**Restaurado.** `sha256` confere: `b60474665dcfce727787b341c3f2337e6ec8eb739abd0329f15b91c4545b66ce`.

---

## 3. Eixo B — os 2 gates de auth

Arquivo: `apps/web/src/lib/analytics/__tests__/gate-de-auth-sem-sessao.test.ts`.

### B3 · `/analytics` · o ramo "sem sessão" de `garantirAcessoAnalytics`

`analytics-redirect.test.ts` sempre mocka um usuário **presente**, variando só os papéis. O ramo `!user || !profile` nunca era exercido.

```diff
--- a/apps/web/src/app/(platform)/analytics/_trinca/recorte.ts  (linha 72)
-  if (!user || !profile) return redirect("/login")
```

```
 × B3 > visitante sem sessão é mandado para /login
 × B3 > e NÃO para /dashboard — o destino é o que distingue 'sem sessão' de 'sem papel'
 × B3 > o ramo vale em todas as abas da trinca, não só na de entrada

AssertionError: expected "spy" to be called with arguments: [ '/login' ]
AssertionError: expected "spy" to not be called with arguments: [ '/dashboard' ]
  1st spy call: Compared values have no visual difference.
  Number of calls: 1

 Test Files  1 failed (1)
      Tests  3 failed | 4 passed (7)
```

**Restaurado.** `sha256` confere: `3131852af1f6454ca449ce4f8399ddd39c523212dc882615809cfdcc02747dd9`.

> **O destino é a asserção que mata, e vale registrar por quê.** Sem sessão, `roles` é `[]` — então apagar o gate **não abre a porta**: a execução escorrega para o teste de papel e o visitante acaba em `/dashboard`. Um teste que só perguntasse "houve redirect?" ficaria **verde** com o gate apagado. O sintoma real é um anônimo mandado para uma área logada em vez de para o login, e é exatamente isso que o segundo caso pega (a saída acima mostra o spy chamado 1 vez, com `/dashboard`).

### B4 · `/jornada` · o gate de `resolverRecorteAutogestao`

Cobertura zero antes desta rodada. Os três testes de painel que existem (`_visao-geral`, `_padroes`) **mockam** `resolverRecorteAutogestao` — ela nunca rodava.

```diff
--- a/apps/web/src/app/(platform)/jornada/_autogestao/recorte.ts  (linha 76)
-  if (!user || !profile) return redirect("/login")
+  if (false) return redirect("/login")
```

```
 × B4 > visitante sem sessão é mandado para /login

AssertionError: expected "spy" to be called with arguments: [ '/login' ]
Number of calls: 0

 Test Files  1 failed (1)
      Tests  1 failed | 6 passed (7)
```

**Restaurado.** `sha256` confere: `b0e2a864b78c31fc460e1efa700a0becae2968ef19f492b7a04cc5bc60a93ee9`.

> **Registro de honestidade sobre um caso que NÃO mata.** O segundo caso de B4 (*"e nenhuma resolução acontece antes dele"*, que assere `resolveTenantId` não chamado) **permanece verde sob esta mutação**: com `if (false)`, a expressão `profile.tenant_id` estoura antes de `resolveTenantId` ser invocada. Ele não é a prova de B4 — quem mata é o primeiro caso. Ele existe para pinar a **ordem** (o gate na entrada), e é o que impediria alguém de "consertar" a mutação movendo o gate para depois da resolução de tenant. Chamá-lo de prova de B4 seria vender cobertura como evidência.

**Controle positivo de B4, com um ganho de lambuja:** com sessão, o recorte atravessa até o fim, e o teste passa `?studentId=outro-aluno` para provar que ele é **ignorado** — `studentId` é sempre `user.id`, a N.4 do CONTRATO-DE-DADOS. Um gestor que abrisse esta rota veria os próprios dados, nunca os do aluno que gerencia.

---

## 4. Cobertura além das 9 exigidas

Mesma classe de defeito, mesmo custo, mesma consequência — pinei enquanto estava no arquivo. **Não** entram na contagem das 9 (não rodei mutação dirigida para cada uma):

| Guarda | Onde |
|:---|:---|
| `chapter_view_progress` — tenant e aluno | `autogestao/fonte-supabase.ts` |
| `study_plans` — tenant (a linha estrangeira vem **primeiro** na fixture, senão `.maybeSingle()` esconderia a remoção) | `autogestao/fonte-supabase.ts` |
| `capability_evidence` — tenant | `aprendizagem-time/fonte-supabase.ts` |
| `concepts` — tenant | `aprendizagem-time/fonte-supabase.ts` |
| **Espelho** — lendo como o outro cliente, só as linhas dele voltam (pega filtro escrito com valor errado: constante fixa, id trocado) | ambos |
| Pares contraditórios dos filtros vizinhos (`is_active`, `deleted_at`, `role`, `course_id`) | ambos |

---

## 5. Higiene da run

| Verificação | Resultado |
|:---|:---|
| `git diff --stat` dos 2 `fonte-supabase.ts` | **vazio** |
| `git diff --stat` dos 2 `recorte.ts` do Eixo B | **vazio** |
| `git diff --stat -- apps/web/src packages/` | só `lib/__tests__/rate-limit.test.ts`, **de outro agente** (não toquei) |
| Restauração conferida por `sha256` | ok nas 9 mutações, e novamente nas 9 re-rodadas pós-formatação |
| Backups órfãos em `/tmp` | **nenhum** |
| Branch / HEAD ao final | `integra/main-cory` @ `d2b8083`, inalterada |
| Commits | **nenhum** |
| Escritas no banco | **nenhuma** — tudo em memória; `.env.local` aponta para PRODUÇÃO e nenhum teste desta suíte o alcança |
| `tsc --noEmit` nos 4 arquivos novos | **limpo** |
| `biome check` nos 4 arquivos novos | **limpo** (o único vermelho de `lib/analytics/__tests__/` é `ritmo-summary.test.ts`, arquivo intocado, de baseline) |

**Procedimento de injeção.** Toda mutação passou por um script com `trap ... EXIT`: backup antes, restauração **mesmo se a suíte estourar**, e conferência por `sha256` contra o arquivo original. A verificação por número de linha aborta se o conteúdo da linha não bater com o esperado — uma mutação nunca foi aplicada "às cegas". A janela de exposição de cada defeito foi de uma execução de suíte (≈1s), num repositório com outros agentes ativos.

**Ressalva sobre o Eixo B.** As mutações B3/B4 tocaram dois arquivos de rota (`app/(platform)/…/recorte.ts`) fora da área declarada desta tarefa. Era inevitável: as guardas moram lá. Ambos foram restaurados e conferidos por `sha256`, e o `git diff` deles está vazio.

**As 9 provas foram feitas duas vezes.** A primeira rodada com os testes recém-escritos; a segunda **depois** de o formatador reescrever os arquivos e de `any` sair do duplo. Os 9 vermelhos são idênticos nas duas.

---

## 6. Arquivos criados

| Arquivo | Papel |
|:---|:---|
| `apps/web/src/lib/analytics/__tests__/banco-que-filtra.ts` | O duplo que aplica os filtros. Não é `*.test.*`; não é coletado como suíte (mesmo padrão de `fixture.ts` e `contrato.ts` já presentes). |
| `apps/web/src/lib/analytics/autogestao/__tests__/isolamento-de-tenant-e-aluno.test.ts` | A1-A4 + extras (8 testes) |
| `apps/web/src/lib/analytics/aprendizagem-time/__tests__/isolamento-de-tenant.test.ts` | A5-A7 + extras (7 testes) |
| `apps/web/src/lib/analytics/__tests__/gate-de-auth-sem-sessao.test.ts` | B3, B4 + controles positivos (7 testes) |

---

## 7. O que continua descoberto (fora do escopo desta rodada)

Registro para não parecer que o Eixo A ficou fechado por inteiro:

- **A varredura de mutação da casa continua sem apontar para cá.** A lista `MUTANTES` de `scripts/mutacao.mjs` cobre 30 mutantes de `padroes-tendencias` e **zero** destas duas frentes. Estas 9 guardas agora reprovam sob mutação manual; nada as roda automaticamente. Item 8 das lacunas do LOOP-2, ainda aberto.
- **Os demais 17 "NÃO PEGOU" do LOOP-2** (Eixos C, D, E) não foram tocados aqui: as constantes mortas C1-C4, a inversão `Math.max`/`Math.min` do quiz (C14/C15), a fronteira da semana (D2), a janela de 10 semanas (D1), a definição §31 (D4) e o `blocoErro` que nunca executa (E4).
