# FIX-B3 — Perfil ilegível vira negação: famílias `chapters/**`, `courses/**` e `jobs`

> Executado em 2026-08-30, worktree `/Users/hugocapitelli/Dev/eximia/eximia-academy-v2`,
> branch `integra/main-cory`, a partir de `d2b8083`.
> Continuação de `FIX-B-rotas.md` (as 8 primeiras rotas, o helper e o desenho de teste).
> **Nenhum commit, nenhum push, nenhuma escrita em banco.** Todos os duplos são em memória.
> **`lib/api-role-guard.ts` NÃO foi tocado** — é compartilhado com as outras frentes desta rodada.

## Escopo, e o censo dele

A área designada foi `api/chapters/**`, `api/courses/**` (exceto `courses/import`, de outro
dono) e as rotas de `jobs` fora do `course-designer`. O censo arquivo a arquivo dessa área dá
**13 arquivos de rota**, e eles não são todos a mesma coisa:

| Rota | Situação | Desfecho nesta rodada |
|---|---|---|
| `chapters/[chapterId]/generate-audio` | E→NEGA | **corrigida** |
| `chapters/[chapterId]/generate-questions` | E→NEGA | **corrigida** |
| `chapters/[chapterId]/slides/generate-text` | E→NEGA | **corrigida** |
| `chapters/[chapterId]/slides/sync-audio` | E→NEGA | **corrigida** |
| `chapters/[chapterId]/slides/upload` | E→NEGA | **corrigida** |
| `chapters/generate-scenario` | E→NEGA | **corrigida** |
| `courses/[courseId]/generate-questions` | E→NEGA | **corrigida** |
| `courses/[courseId]/generation-jobs` | E→NEGA | **corrigida** |
| `courses/route.ts` (`GET /api/courses`) | já corrigida na 1ª rodada | intocada |
| `courses/[courseId]/enrich` | E→NEGA, **mas em outro helper** | **registrada, não tocada** (§Pendências 1) |
| `courses/[courseId]/export` | E→NEGA, **mas em outro helper** | **registrada, não tocada** (§Pendências 1) |
| `chapters/[chapterId]/slides/generation-status` | **sem guard de papel nenhum** | registrada (§Pendências 2) |
| `courses/[courseId]/quizzes` | **sem guard de papel nenhum** | registrada (§Pendências 2) |
| `courses/import` | outro dono | fora |

### As rotas de `jobs`: eu errei o censo na primeira passagem

**A primeira versão deste relatório afirmava que "jobs fora do course-designer não existem".
Era falso: existem quatro, e todas as quatro tinham o defeito.** Estão corrigidas (§Lote 2).

O erro foi de instrumento, e vale mais que o erro em si. A varredura tinha sido:

```bash
find apps/web/src/app/api -path '*/jobs/*' -name '*.ts'   # devolve 1 arquivo
```

`-path '*/jobs/*'` exige `jobs` como **segmento inteiro** do caminho. As quatro rotas se
escondem exatamente onde esse padrão não alcança:

| Rota | Por que o padrão não pegou |
|---|---|
| `blueprint/job/[jobId]` | `job`, no **singular** |
| `enrichment-jobs/[jobId]/export` | `jobs` colado num **nome composto** |
| `enrichment-jobs/[jobId]/status` | idem |
| `generation-jobs/[jobId]/status` | idem, e ainda é homônima da `courses/[courseId]/generation-jobs` |

A busca larga (`find . -name route.ts | grep -i job`) devolve **6**. A régua estava correta
sobre o que mediu e cega para o que importava — e, pior, o silêncio dela foi lido como
"não existe" em vez de "não encontrei". **Só a rota `course-designer/jobs/[jobId]` continua
fora**, porque é da família daquele dono; não a toquei.

| Rota de job | Desfecho |
|---|---|
| `blueprint/job/[jobId]` | **corrigida** (lote 2) |
| `enrichment-jobs/[jobId]/export` | **corrigida** (lote 2) |
| `enrichment-jobs/[jobId]/status` (SSE) | **corrigida** (lote 2) |
| `generation-jobs/[jobId]/status` (SSE) | **corrigida** (lote 2) |
| `courses/[courseId]/generation-jobs` | **corrigida** (lote 1) |
| `course-designer/jobs/[jobId]` | outro dono, intocada |
| `blueprint/generate` | corrigida pela frente `avulsas`, intocada por mim |
| `blueprint/[blueprintId]` | **não lê perfil** — sem o defeito |

## Placar

| Lote | Família | Vermelho antes | Verde depois |
|---|---|---|---|
| 1 | `chapters/**` (6 rotas) | **6 falhas** | 31/31 |
| 1 | `courses/**` (2 rotas) | **2 falhas** | 11/11 |
| 2 | `jobs` fora do course-designer (4 rotas) | **4 falhas** | 21/21 |

**12 rotas corrigidas, 63 testes.** Detalhe da suíte inteira e do `tsc` em §Verificação.

---

## O defeito

As oito liam o perfil sem nunca destructurar `error`:

```ts
const { data: profile } = await supabase
  .from("users").select("role, tenant_id").eq("id", user.id).single()
if (!profile || !["manager","admin","instructor"].includes(profile.role))
  return NextResponse.json({ error: "Permissão negada" }, { status: 403 })
```

Num timeout de statement, `data` volta `null`, `profile` fica `null`, e a condição `!profile`
despacha o **mesmo 403** que um estagiário receberia.

**Por que esta área pesa mais que as outras desta rodada.** As seis de `chapters` ficam no
caminho de quem PRODUZ o material que o aluno consome: gerar o áudio do capítulo, gerar as
perguntas, subir e narrar os slides. As duas de `courses` disparam e acompanham a geração em
lote de um curso inteiro. Um blip de leitura não devolve "tente de novo" — devolve "Permissão
negada" a um instrutor legítimo no meio da aula que ele está montando, e essa mensagem convida
a pedir acesso a alguém, não a repetir a ação. A pior das oito é
`courses/[courseId]/generation-jobs`: é o **painel** que acompanha os lotes, então um 403 ali
apaga o progresso de um trabalho que continua rodando no servidor — a tela diz "você não pode
ver isto" sobre algo que é do próprio usuário.

---

## Vermelho ANTES da correção — família `chapters` (6 rotas)

`pnpm --filter @eximia/web test src/app/api/chapters/__tests__/perfil-ilegivel-nao-e-negacao-chapters.test.ts`

```
 ❯ src/app/api/chapters/__tests__/perfil-ilegivel-nao-e-negacao-chapters.test.ts (31 tests | 6 failed) 12ms
   × …chapters > POST /api/chapters/[id]/generate-audio — falha ao LER o perfil não pode virar 403 4ms
     → expected 403 not to be 403 // Object.is equality
   ✓ …[CP] POST /api/chapters/[id]/generate-audio — papel insuficiente continua 403 0ms
   ✓ …[CP] POST /api/chapters/[id]/generate-audio — perfil inexistente continua 403, não 503 0ms
   ✓ …[CP] POST /api/chapters/[id]/generate-audio — papel suficiente atravessa o guard 1ms
   ✓ …[CP] POST /api/chapters/[id]/generate-audio — papel "manager" continua atravessando, como antes 0ms
   × …chapters > POST /api/chapters/[id]/generate-questions — falha ao LER o perfil não pode virar 403 1ms
     → expected 403 not to be 403 // Object.is equality
   ✓ …[CP] POST /api/chapters/[id]/generate-questions — papel insuficiente continua 403 0ms
   ✓ …[CP] POST /api/chapters/[id]/generate-questions — perfil inexistente continua 403, não 503 0ms
   ✓ …[CP] POST /api/chapters/[id]/generate-questions — papel suficiente atravessa o guard 0ms
   ✓ …[CP] POST /api/chapters/[id]/generate-questions — papel "manager" continua atravessando, como antes 0ms
   × …chapters > POST /api/chapters/[id]/slides/generate-text — falha ao LER o perfil não pode virar 403 0ms
     → expected 403 not to be 403 // Object.is equality
   ✓ …[CP] POST /api/chapters/[id]/slides/generate-text — papel insuficiente continua 403 0ms
   ✓ …[CP] POST /api/chapters/[id]/slides/generate-text — perfil inexistente continua 403, não 503 0ms
   ✓ …[CP] POST /api/chapters/[id]/slides/generate-text — papel suficiente atravessa o guard 0ms
   ✓ …[CP] POST /api/chapters/[id]/slides/generate-text — papel "manager" continua atravessando, como antes 0ms
   × …chapters > POST /api/chapters/[id]/slides/sync-audio — falha ao LER o perfil não pode virar 403 0ms
     → expected 403 not to be 403 // Object.is equality
   ✓ …[CP] POST /api/chapters/[id]/slides/sync-audio — papel insuficiente continua 403 0ms
   ✓ …[CP] POST /api/chapters/[id]/slides/sync-audio — perfil inexistente continua 403, não 503 0ms
   ✓ …[CP] POST /api/chapters/[id]/slides/sync-audio — papel suficiente atravessa o guard 0ms
   ✓ …[CP] POST /api/chapters/[id]/slides/sync-audio — papel "manager" continua atravessando, como antes 0ms
   × …chapters > POST /api/chapters/[id]/slides/upload — falha ao LER o perfil não pode virar 403 0ms
     → expected 403 not to be 403 // Object.is equality
   ✓ …[CP] POST /api/chapters/[id]/slides/upload — papel insuficiente continua 403 0ms
   ✓ …[CP] POST /api/chapters/[id]/slides/upload — perfil inexistente continua 403, não 503 0ms
   ✓ …[CP] POST /api/chapters/[id]/slides/upload — papel suficiente atravessa o guard 0ms
   ✓ …[CP] POST /api/chapters/[id]/slides/upload — papel "manager" continua atravessando, como antes 0ms
   × …chapters > POST /api/chapters/generate-scenario — falha ao LER o perfil não pode virar 403 0ms
     → expected 403 not to be 403 // Object.is equality
   ✓ …[CP] POST /api/chapters/generate-scenario — papel insuficiente continua 403 0ms
   ✓ …[CP] POST /api/chapters/generate-scenario — perfil inexistente continua 403, não 503 0ms
   ✓ …[CP] POST /api/chapters/generate-scenario — papel suficiente atravessa o guard 0ms
   ✓ …[CP] POST /api/chapters/generate-scenario — papel "manager" continua atravessando, como antes 0ms
   ✓ …[CP] sem sessão continua 401, antes de qualquer leitura de perfil 0ms

AssertionError: expected 403 not to be 403 // Object.is equality
 ❯ src/app/api/chapters/__tests__/perfil-ilegivel-nao-e-negacao-chapters.test.ts:215:35
    213|
    214|       // O coração do defeito: hoje todas devolvem 403.
    215|       expect(resposta.status).not.toBe(403)
       |                                   ^
    216|       // E o que devem devolver: indisponibilidade retentável, como o …

 Test Files  1 failed (1)
      Tests  6 failed | 25 passed (31)
```

**Os 25 verdes já no vermelho são os controles positivos**, cinco por rota: papel insuficiente
continua 403; perfil inexistente (`PGRST116`) continua 403 e **não** 503; papel suficiente
(`instructor`) atravessa o guard; **`manager` também atravessa**; e sem sessão continua 401
antes de qualquer leitura de perfil. São eles que impedem a "correção" degenerada *responde 503
sempre* de ficar verde.

O `[CP] manager` é acréscimo desta rodada, e existe por um motivo específico: as oito rotas
daqui aceitam `["manager", "admin", "instructor"]` — **sem `super_admin`**, ao contrário do
`PAPEIS_COURSE_DESIGNER` das oito da primeira rodada. Ao trocar a literal por uma chamada de
guard, o risco concreto é reusar a constante errada e alargar (entra `super_admin`) ou estreitar
(sai `manager`) a lista sem que nada reclame. O caso trava a ponta que o `[CP] instructor` não
cobria.

## Vermelho ANTES da correção — família `courses` + jobs (2 rotas)

`pnpm --filter @eximia/web test src/app/api/courses/__tests__/perfil-ilegivel-nao-e-negacao-courses.test.ts`

```
 ❯ src/app/api/courses/__tests__/perfil-ilegivel-nao-e-negacao-courses.test.ts (11 tests | 2 failed) 8ms
   × …courses > POST /api/courses/[id]/generate-questions — falha ao LER o perfil não pode virar 403 4ms
     → expected 403 not to be 403 // Object.is equality
   ✓ …[CP] POST /api/courses/[id]/generate-questions — papel insuficiente continua 403 0ms
   ✓ …[CP] POST /api/courses/[id]/generate-questions — perfil inexistente continua 403, não 503 0ms
   ✓ …[CP] POST /api/courses/[id]/generate-questions — papel suficiente atravessa o guard 1ms
   ✓ …[CP] POST /api/courses/[id]/generate-questions — papel "manager" continua atravessando, como antes 0ms
   × …courses > GET /api/courses/[id]/generation-jobs — falha ao LER o perfil não pode virar 403 0ms
     → expected 403 not to be 403 // Object.is equality
   ✓ …[CP] GET /api/courses/[id]/generation-jobs — papel insuficiente continua 403 0ms
   ✓ …[CP] GET /api/courses/[id]/generation-jobs — perfil inexistente continua 403, não 503 0ms
   ✓ …[CP] GET /api/courses/[id]/generation-jobs — papel suficiente atravessa o guard 0ms
   ✓ …[CP] GET /api/courses/[id]/generation-jobs — papel "manager" continua atravessando, como antes 0ms
   ✓ …[CP] sem sessão continua 401, antes de qualquer leitura de perfil 0ms

AssertionError: expected 403 not to be 403 // Object.is equality
 ❯ src/app/api/courses/__tests__/perfil-ilegivel-nao-e-negacao-courses.test.ts:140:35
    138|
    139|       // O coração do defeito: hoje as duas devolvem 403 "Permissão ne…
    140|       expect(resposta.status).not.toBe(403)
       |                                   ^

 Test Files  1 failed (1)
      Tests  2 failed | 9 passed (11)
```

---

## Vermelho ANTES da correção — lote 2, `jobs` fora do course-designer (4 rotas)

`pnpm --filter @eximia/web test src/app/api/__tests__/perfil-ilegivel-nao-e-negacao-jobs.test.ts`

```
   × …jobs > GET /api/blueprint/job/[jobId] — falha ao LER o perfil não pode virar 403 5ms
   ✓ …[CP] GET /api/blueprint/job/[jobId] — papel insuficiente continua 403 1ms
   ✓ …[CP] GET /api/blueprint/job/[jobId] — perfil inexistente continua 403, não 503 0ms
   ✓ …[CP] GET /api/blueprint/job/[jobId] — papel suficiente atravessa o guard 0ms
   ✓ …[CP] GET /api/blueprint/job/[jobId] — papel "manager" continua atravessando, como antes 0ms
   × …jobs > GET /api/enrichment-jobs/[jobId]/export — falha ao LER o perfil não pode virar 403 1ms
   ✓ …[CP] GET /api/enrichment-jobs/[jobId]/export — papel insuficiente continua 403 0ms
   ✓ …[CP] GET /api/enrichment-jobs/[jobId]/export — perfil inexistente continua 403, não 503 0ms
   ✓ …[CP] GET /api/enrichment-jobs/[jobId]/export — papel suficiente atravessa o guard 0ms
   ✓ …[CP] GET /api/enrichment-jobs/[jobId]/export — papel "manager" continua atravessando, como antes 0ms
   × …jobs > GET /api/enrichment-jobs/[jobId]/status (SSE) — falha ao LER o perfil não pode virar 403 0ms
   ✓ …[CP] GET /api/enrichment-jobs/[jobId]/status (SSE) — papel insuficiente continua 403 0ms
   ✓ …[CP] GET /api/enrichment-jobs/[jobId]/status (SSE) — perfil inexistente continua 403, não 503 0ms
   ✓ …[CP] GET /api/enrichment-jobs/[jobId]/status (SSE) — papel suficiente atravessa o guard 0ms
   ✓ …[CP] GET /api/enrichment-jobs/[jobId]/status (SSE) — papel "manager" continua atravessando, como antes 0ms
   × …jobs > GET /api/generation-jobs/[jobId]/status (SSE) — falha ao LER o perfil não pode virar 403 0ms
   ✓ …[CP] GET /api/generation-jobs/[jobId]/status (SSE) — papel insuficiente continua 403 0ms
   ✓ …[CP] GET /api/generation-jobs/[jobId]/status (SSE) — perfil inexistente continua 403, não 503 0ms
   ✓ …[CP] GET /api/generation-jobs/[jobId]/status (SSE) — papel suficiente atravessa o guard 0ms
   ✓ …[CP] GET /api/generation-jobs/[jobId]/status (SSE) — papel "manager" continua atravessando, como antes 0ms
   ✓ …[CP] sem sessão continua 401, antes de qualquer leitura de perfil 0ms

AssertionError: expected 403 not to be 403 // Object.is equality

 Test Files  1 failed (1)
      Tests  4 failed | 17 passed (21)
```

### O vermelho FALSO que veio antes deste, e por que ele importa

A primeira execução deste arquivo deu **21 de 21 vermelhos** — o que, num teste que persegue um
defeito real, é fácil de ler como "achei o defeito em toda parte". Não era:

```
TypeError: RequestInit: Expected signal ("AbortSignal {}") to be an instance of AbortSignal.
 ❯ requisicao src/app/api/__tests__/perfil-ilegivel-nao-e-negacao-jobs.test.ts:111:10
```

As duas rotas SSE abrem um `setInterval` de 2s quando o guard deixa passar, e nada no teste
consome o stream para fechá-lo. A limpeza natural seria passar um `AbortController` — a rota já
escuta `request.signal`. Mas o `AbortSignal` do **jsdom** não é o do **undici** que constrói o
`Request`, e o construtor recusa o objeto. Todo teste do arquivo morria na montagem da
requisição, **antes de tocar em qualquer rota**.

Um vermelho de 21/21 por falha de harness é indistinguível de um vermelho de 21/21 por defeito
se ninguém ler a mensagem. Trocado por `vi.useFakeTimers()` (o intervalo é registrado no relógio
falso e descartado com ele), o vermelho honesto apareceu: **4, exatamente as 4 rotas com o
defeito**, e 17 controles positivos verdes.

---

## A correção

O helper `lib/api-role-guard.ts` já existia e já estava provado. As doze rotas passam a ser
duas linhas:

```ts
const { profile, recusa } = await requireRole(supabase, user.id, ["manager", "admin", "instructor"])
if (recusa) return recusa
```

Nas seis que só liam `role` e nunca usavam o tenant (`chapters/[id]/generate-questions`,
`chapters/generate-scenario`, `courses/[id]/generation-jobs`, `enrichment-jobs/[id]/export`,
`enrichment-jobs/[id]/status`, `generation-jobs/[id]/status`), a desestruturação é só
`const { recusa }` — o guard lê `role, tenant_id` sempre, e descartar o que a rota não usa é
mais barato que manter uma segunda forma de leitura viva.

**Todas as 12 usam a mesma lista `["manager", "admin", "instructor"]`.** Nenhuma tinha
`super_admin` antes, e nenhuma tem depois.

**`lib/api-role-guard.ts` não foi tocado.** Ele estava sendo editado por outra frente na mesma
rodada (FIX-B2); três mãos no mesmo arquivo produzem um estado que ninguém consegue
interpretar. Todas as oito couberam no helper como ele está.

### A lista de papéis: preservada literal, e por quê

As oito rotas daqui aceitam `["manager", "admin", "instructor"]` — **sem `super_admin`**, ao
contrário do `PAPEIS_COURSE_DESIGNER` que serve as oito da primeira rodada. A literal foi
mantida inline em cada rota, exatamente como estava.

Não é descuido, é recusa deliberada de mudar política dentro de um fix de tratamento de erro.
Adicionar `super_admin` alargaria o direito de acesso; reusar `PAPEIS_COURSE_DESIGNER` por
comodidade faria isso sem que nada reclamasse. É por isso que o `[CP] manager` existe (§Mutação).

### Efeito colateral registrado: `"Forbidden"` → `"Permissão negada"`

Quatro das rotas de `chapters` (`slides/generate-text`, `slides/sync-audio`, `slides/upload`,
`generate-scenario`) devolviam `{ error: "Forbidden" }` no 403; o guard devolve
`{ error: "Permissão negada" }`. **O status não muda**; o corpo, sim.

Verifiquei os consumidores antes de aceitar isso: `slide-manager.tsx`, `slide-upload-zone.tsx` e
`interaction-engine.tsx` apenas exibem `result.error ?? "<fallback>"` num toast — nenhum ramifica
sobre a literal. O único `"Forbidden"` que sobrevive no código é um `throw new Error("Forbidden")`
de `slide-actions.ts`, que não passa por estas rotas. Na prática a mensagem que chega ao
instrutor passa de inglês para português, na mesma tela onde todo o resto já é português.

### As duas rotas SSE: de texto puro para JSON

`enrichment-jobs/[id]/status` e `generation-jobs/[id]/status` são **Server-Sent Events**, e
recusavam com `new Response("Forbidden", { status: 403 })` — corpo em texto puro, não JSON. O
guard responde JSON nos dois desfechos.

Verifiquei o consumidor antes: `hooks/use-sse.ts` implementa `es.onerror` **sem nunca ler o
corpo** — ele fecha, reconecta até 5 vezes com 3s de intervalo, e desiste. O `EventSource` do
navegador não expõe o corpo de uma resposta de erro, então a mudança de forma é literalmente
invisível para a tela (`enrichment-review-client.tsx` e `course-questions-overview.tsx`).

O ganho é para quem **não** é `EventSource`: curl, log, monitoração. E há um ganho de semântica
que vale registrar: o cliente **já reconectava 5 vezes** diante do 403, tratando na prática uma
negação permanente como falha transitória. Agora o servidor diz a verdade — 403 para quem não
pode (e as retentativas continuam inúteis, como devem ser), 503 com `Retry-After` para quando
não se conseguiu verificar, que é exatamente o caso em que reconectar resolve.

## Verde

```
 ✓ src/app/api/courses/__tests__/perfil-ilegivel-nao-e-negacao-courses.test.ts (11 tests) 8ms
 ✓ src/app/api/chapters/__tests__/perfil-ilegivel-nao-e-negacao-chapters.test.ts (31 tests) 13ms
 ✓ src/app/api/__tests__/perfil-ilegivel-nao-e-negacao-jobs.test.ts (21 tests) 16ms

      Tests  63 passed (63)
```

## Mutação — a prova de que o verde não é vácuo

Quatro mutantes, dois por lote, cada par mirando uma coisa diferente. Os quatro mortos, arquivos
restaurados no mesmo comando.

**Mutante 1 — o guard desligado.** `if (recusa) return recusa` → `if (false && recusa) return recusa`
em `chapters/[id]/slides/upload`:

```
   × …upload — falha ao LER o perfil não pode virar 403 2ms
   × [CP] …upload — papel insuficiente continua 403 0ms
   × [CP] …upload — perfil inexistente continua 403, não 503 0ms
   ✓ [CP] …upload — papel suficiente atravessa o guard 0ms
   ✓ [CP] …upload — papel "manager" continua atravessando, como antes 0ms
      Tests  3 failed | 28 passed (31)
```

Repare que só a rota mutada fica vermelha — as outras cinco seguem verdes. O teste discrimina
por rota, não por família; uma correção que "passasse em bloco" não teria como esconder um
arquivo esquecido aqui dentro.

**Mutante 2 — a lista de papéis alargada.** `["admin", "manager", "instructor"]` →
`["admin", "instructor", "super_admin"]` em `chapters/generate-scenario` (exatamente o erro
plausível: trocar a literal pela constante do course-designer):

```
   ✓ …generate-scenario — falha ao LER o perfil não pode virar 403 0ms
   ✓ [CP] …generate-scenario — papel insuficiente continua 403 0ms
   ✓ [CP] …generate-scenario — perfil inexistente continua 403, não 503 0ms
   ✓ [CP] …generate-scenario — papel suficiente atravessa o guard 0ms
   × [CP] …generate-scenario — papel "manager" continua atravessando, como antes 2ms
      Tests  1 failed | 30 passed (31)
```

**Um único teste pega essa mutação, e é o `[CP] manager`** — o caso que esta rodada acrescentou.
Sem ele, `manager` perderia acesso a uma rota que sempre teve, `super_admin` ganharia uma que
nunca teve, e os outros 30 testes continuariam verdes. É o argumento concreto para o controle
positivo não ser decorativo: ele mede a ponta que o resto do arquivo não alcança.

**Mutantes 3 e 4 — o lote 2, e a reprodução do achado.** Os mesmos dois experimentos no arquivo
de `jobs`. Guard desligado em `generation-jobs/[id]/status` (a SSE): `3 failed | 18 passed`, só
naquela rota. Lista trocada em `enrichment-jobs/[id]/export`: `1 failed | 20 passed`, e o único
morto é de novo o **`[CP] manager`**.

Que o mesmo padrão se repita em dois arquivos independentes, sobre rotas de forma diferente
(JSON e SSE), é o que transforma o achado de coincidência em regra: **a suíte do E→NEGA é
estruturalmente cega à lista de papéis**, porque todos os seus casos naturais — erro
transitório, `PGRST116`, papel insuficiente, papel suficiente, sem sessão — continuam corretos
com a lista alargada. Quem migrar rotas para um guard central sem um controle positivo **por
papel aceito antes** pode alargar o acesso e ver tudo verde.

---

## Pendências registradas (não tocadas, de propósito)

### 1. `courses/[courseId]/enrich` e `courses/[courseId]/export` — o mesmo defeito, em outro helper

As duas **têm** o E→NEGA, mas ele não está na rota: está em `requireCourseManager`
(`lib/course-management-guard.ts:47`), que é a leitura de perfil delas:

```ts
const { data: profile } = await supabase
  .from("users")
  .select("role, tenant_id, user_roles!user_roles_user_id_fkey(role)")
  .eq("id", userId)
  .single()

if (!profile) return { ok: false, error: "Perfil não encontrado" }   // ← e a rota traduz em 403
```

Mesma omissão do `error`, mesmo desfecho: leitura falha vira "Permissão negada".

**Por que não corrigi, apesar de estar na minha área.** Três razões, e nenhuma é a facilidade:

1. **Não cabe no helper como ele está.** `requireRole` lê `role, tenant_id` e decide sobre uma
   lista de papéis. `requireCourseManager` decide sobre a **união de chapéus** de `user_roles`
   (com fallback para a coluna singular) e devolve um contexto diferente (`{ ok, ctx: { tenantId,
   hats } }`). Forçar uma na outra apagaria a regra multi-chapéu do `fix-manager-privacy-gates`,
   que é decisão de política já tomada por esta casa.
2. **É outro arquivo compartilhado, com raio muito maior.** `requireCourseManager` tem **24 call
   sites** fora dele mesmo — páginas, server actions e as duas rotas. Corrigi-lo mudaria o
   comportamento de `courses/actions.ts`, `chapters/actions.ts`, `questions/actions.ts`, das
   páginas de edição e de perguntas, e mais. Isso não é a família `chapters`+`courses`; é uma
   frente própria.
3. **Ele já tem suíte própria** (`lib/__tests__/course-management-guard.test.ts`, com um caso
   `ghost-user`), então a correção tem onde nascer vermelha sem inventar andaime.

**O que a segunda rodada precisa saber:** o remédio é o mesmo desenho (403 quando a leitura
funcionou e a resposta é não; 5xx/indisponível quando falhou), aplicado **dentro**
de `requireCourseManager`. Cuidado específico: o `CourseManagerCheck` de hoje só tem dois lados
(`ok:true` / `ok:false` com string de erro), e os 24 chamadores traduzem `ok:false` em 403 ou em
`throw`. Um terceiro estado precisa ser propagado, ou os chamadores voltam a colapsar
indisponibilidade em negação — o mesmo defeito, um andar acima. `PGRST116` continua 403.

### 2. `chapters/[chapterId]/slides/generation-status` e `courses/[courseId]/quizzes` — sem guard de papel nenhum

Não têm o E→NEGA porque **não checam papel**: exigem sessão (401) e seguem direto para a
leitura. `generation-status` devolve o progresso de geração de texto dos slides de qualquer
`chapterId`; `quizzes` lista as `quiz_sessions` de qualquer `courseId` — nenhuma das duas filtra
por tenant na própria consulta, apoiando-se inteiramente no RLS.

Isso é um achado de **classe diferente** do que me coube (não é "negação indevida", é possível
"acesso indevido"), e transformá-lo em correção aqui seria eu decidindo política de acesso
dentro de um fix de tratamento de erro. **Registrado, não tocado.** Merece verificação própria:
o RLS destas duas tabelas realmente cobre o cruzamento entre tenants?

### 3. Convergência com `PAPEIS_CONTEUDO`, de outra frente — consolidação para depois

Durante esta rodada, a frente de `ingestion`+`courses/import` criou
`apps/web/src/lib/papeis-de-conteudo.ts` com `PAPEIS_CONTEUDO = ["manager", "admin",
"instructor"]` — **exatamente a minha lista**, pelo mesmo raciocínio sobre `super_admin`.

Mantive as literais inline mesmo assim, e o motivo é de coordenação, não de gosto: aquele
arquivo é untracked e está em voo na mesma rodada; amarrar doze rotas a um artefato de outra
frente que ainda pode ser renomeado ou revertido troca uma duplicação visível por um
acoplamento invisível. **Recomendação para a consolidação:** quando as frentes fecharem, um
único passe troca as 12 literais daqui por `PAPEIS_CONTEUDO`, com os `[CP] manager` já no lugar
para provar que a troca não alargou nem estreitou nada. Enquanto isso, a lista está repetida em
12 rotas — exatamente como estava antes desta correção, nem melhor nem pior.

### 4. `blueprint/[blueprintId]` e `course-designer/jobs/[jobId]`

`blueprint/[blueprintId]` **não lê perfil** — não tem o defeito, nada a fazer.
`course-designer/jobs/[jobId]` tem o defeito mas é da família daquele dono. **Não toquei.**
`blueprint/generate` foi corrigida pela frente `avulsas` antes de eu chegar nela; confirmei que
já tem o guard e não a toquei.

---

## Verificação

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2

# os três vermelhos, por família
pnpm --filter @eximia/web test src/app/api/chapters/__tests__/perfil-ilegivel-nao-e-negacao-chapters.test.ts
pnpm --filter @eximia/web test src/app/api/courses/__tests__/perfil-ilegivel-nao-e-negacao-courses.test.ts
pnpm --filter @eximia/web test src/app/api/__tests__/perfil-ilegivel-nao-e-negacao-jobs.test.ts

# typecheck
pnpm --filter @eximia/web exec tsc --noEmit    # limpo, exit 0
```

**Régua própria, arquivo a arquivo.** Precisa ser assim: um grep pelos DIRETÓRIOS `chapters/` e
`courses/` acusaria `courses/import` (outro dono) e as duas de `enrich`/`export` que estão
registradas como pendentes — nunca ficaria vazia, e o erro de varrer diretório em vez de arquivo
já foi cometido nesta auditoria.

```bash
cd apps/web/src/app/api
MINHAS="chapters/[chapterId]/generate-audio/route.ts
chapters/[chapterId]/generate-questions/route.ts
chapters/[chapterId]/slides/generate-text/route.ts
chapters/[chapterId]/slides/sync-audio/route.ts
chapters/[chapterId]/slides/upload/route.ts
chapters/generate-scenario/route.ts
courses/[courseId]/generate-questions/route.ts
courses/[courseId]/generation-jobs/route.ts
blueprint/job/[jobId]/route.ts
enrichment-jobs/[jobId]/export/route.ts
enrichment-jobs/[jobId]/status/route.ts
generation-jobs/[jobId]/status/route.ts"

# leitura de perfil sem checagem — VAZIO
echo "$MINHAS" | while IFS= read -r f; do grep -Hn "data: profile" "$f"; done

# e o guard está nas 12, uma vez cada
echo "$MINHAS" | while IFS= read -r f; do echo "$f $(grep -c 'requireRole(supabase' "$f")"; done
```

Resultado: régua **vazia**; `requireRole` presente **1× em cada uma das 12**.

### Estado da suíte `src/app/api` inteira

```
 Test Files  38 passed (38)
      Tests  589 passed (589)
```

**Verde inteiro**, com as demais frentes já aterrissadas. (Na primeira passagem desta frente a
suíte lia `3 failed | 34 passed`; os três vermelhos eram os testes em voo de `analytics`,
`avulsas` e `admin`, nenhum deles existente em `HEAD` e nenhum meu. Registro isso porque, no
meio da rodada, "a suíte está vermelha" e "eu quebrei a suíte" são fáceis de confundir — e a
diferença se estabelece com `git cat-file -e HEAD:<arquivo>`, não com impressão.)

### Formatação

`biome check` limpo nos **três arquivos de teste novos** (o único achado real, uma quebra de
linha em `perfil-ilegivel-nao-e-negacao-courses.test.ts`, foi corrigido).

As 6 rotas de `chapters` acusam `format` — mas **já acusavam em `HEAD`**: elas estão em CRLF
(`git show HEAD:… | grep -c $'\r'` devolve 122, 202, 85, 54 e 77 linhas). A prova independente é
`slides/generation-status/route.ts`, que **não foi tocada por esta frente** e aparece na mesma
lista. Reformatá-las inflaria o diff com centenas de linhas que não escrevi, então não o fiz —
mesmo critério que o `FIX-B-rotas.md` adotou.

As 4 rotas do lote 2 **não** são CRLF. Três saem limpas. `blueprint/job/[jobId]` acusa
`useImportType` e um `format` na linha 67 (`return NextResponse.json({ error: "Microservice
error" }, …)`), código que não toquei: rodando o biome sobre a versão de `HEAD` desse arquivo,
ele já acusava **três** achados. A minha versão acusa **dois** — o `organizeImports` sumiu
porque inseri o import na posição ordenada. Diminuiu, não aumentou.

> Nota de instrumento: a primeira tentativa de rodar o biome usou caminhos a partir da raiz do
> repo enquanto o `pnpm --filter` já executa em `apps/web`. O comando respondeu
> `Checked 0 files … No fixes applied` — um **PASS por vacuidade** que passaria por aprovação se
> eu só tivesse lido o exit da última linha. Os caminhos com `[chapterId]` também derrubam o
> biome silenciosamente; rodar por diretório é o que funciona aqui.

---

## Os três instrumentos que mentiram nesta frente

Vale juntar, porque o padrão é o mesmo nos três e nenhum deles emite erro:

| Instrumento | O que respondeu | O que era |
|---|---|---|
| `find -path '*/jobs/*'` | 1 arquivo | 6 — `job` singular e `*-jobs` compostos não casam com o padrão |
| `biome check <caminho da raiz>` | `Checked 0 files … No fixes applied` | não checou nada; PASS por vacuidade |
| primeiro run do teste de `jobs` | `21 failed (21)` | falha de harness (`AbortSignal` do jsdom ≠ undici), não o defeito |

Os dois primeiros aprovam por silêncio; o terceiro reprova por barulho. O antídoto é o mesmo:
**ler o que o instrumento diz ter medido, não só o veredito.** `Checked 0 files` está escrito
na saída; `1 arquivo` quando se esperava vários é um sinal, não uma resposta; e um vermelho de
21/21 num teste que persegue 4 rotas é grande demais para ser o defeito.

## Arquivos

**Novos:**
- `apps/web/src/app/api/chapters/__tests__/perfil-ilegivel-nao-e-negacao-chapters.test.ts`
- `apps/web/src/app/api/courses/__tests__/perfil-ilegivel-nao-e-negacao-courses.test.ts`
- `apps/web/src/app/api/__tests__/perfil-ilegivel-nao-e-negacao-jobs.test.ts`
- `docs/auditoria/consolidacao-2026-08-28/FIX-B3-chapters.md` (este)

**Modificados (12 rotas, nada mais):**
- `apps/web/src/app/api/chapters/[chapterId]/generate-audio/route.ts`
- `apps/web/src/app/api/chapters/[chapterId]/generate-questions/route.ts`
- `apps/web/src/app/api/chapters/[chapterId]/slides/generate-text/route.ts`
- `apps/web/src/app/api/chapters/[chapterId]/slides/sync-audio/route.ts`
- `apps/web/src/app/api/chapters/[chapterId]/slides/upload/route.ts`
- `apps/web/src/app/api/chapters/generate-scenario/route.ts`
- `apps/web/src/app/api/courses/[courseId]/generate-questions/route.ts`
- `apps/web/src/app/api/courses/[courseId]/generation-jobs/route.ts`
- `apps/web/src/app/api/blueprint/job/[jobId]/route.ts`
- `apps/web/src/app/api/enrichment-jobs/[jobId]/export/route.ts`
- `apps/web/src/app/api/enrichment-jobs/[jobId]/status/route.ts`
- `apps/web/src/app/api/generation-jobs/[jobId]/status/route.ts`

As 12 rotas tinham **zero testes** antes desta rodada — esta é a primeira cobertura delas.

**Intocados e confirmados:** `lib/api-role-guard.ts`, `lib/course-management-guard.ts`,
`lib/papeis-de-conteudo.ts`, `api/courses/import/route.ts`, `api/blueprint/generate/route.ts`,
`api/blueprint/[blueprintId]/route.ts`, `api/course-designer/**`, `scripts/`, `lib/analytics/`,
`components/`. Nenhum commit, nenhum push, nenhuma escrita em banco.
