# FIX-B4 — Perfil ilegível vira negação: famílias `api/admin/**` e `api/analytics/**`

> Executado em 2026-08-30, worktree `/Users/hugocapitelli/Dev/eximia/eximia-academy-v2`,
> branch `integra/main-cory`, a partir de `d2b8083`.
> Extensão do desenho provado em `FIX-B-rotas.md` (item 1), que corrigiu 8 rotas do Course
> Designer e registrou 39 restantes com o mesmo E→NEGA. Esta frente pega duas famílias;
> outras frentes pegam as demais, em famílias disjuntas.
> **Nenhum commit, nenhum push, nenhuma escrita em banco.** Todos os duplos são em memória.

## Escopo desta frente

| Incluído | Excluído |
|---|---|
| `apps/web/src/app/api/admin/**` | `api/analytics/aprendizagem-time/**` — outra frente |
| `apps/web/src/app/api/analytics/**` | `lib/api-role-guard.ts` — compartilhado, **não tocado** |

**O helper NÃO foi modificado** (`git diff --name-only | grep -c api-role-guard` → `0`). Onde
uma rota não coube nele como está, ela foi **registrada como pendente** em vez de ganhar
exceção local.

---

## Placar

| Família | Cópias do guard corrigidas | Vermelho antes | Verde depois |
|---|---|---|---|
| `api/admin/**` | 14 | **14 falhas**, uma por cópia | 126/126 |
| `api/analytics/**` | 4 | **4 falhas**, uma por cópia | 33/33 |

> Os números de verde (126 e 33) são posteriores ao **reforço dos controles de papel**
> descrito na seção "Matriz de papéis" — o vermelho foi colhido quando a suíte tinha 70 e 17
> casos. A asserção do defeito não mudou entre as duas versões; o que cresceu foram os
> controles positivos.

**Minha área isolada:** os 2 arquivos desta frente → **159 testes, verde**. Os testes
pré-existentes das rotas que toquei (`admin/users/__tests__`, `analytics/manager-groups`) →
**63 testes, verde**, ou seja, sem regressão minha.

**Área inteira:** `pnpm --filter @eximia/web test src/app/api` → **38 arquivos, 669 testes,
verde** (inclui o trabalho das frentes irmãs, que rodam no mesmo diretório).
`tsc --noEmit` → **limpo**.

---

## O defeito, nas três formas que ele tem nesta área

As oito rotas do Course Designer escreviam a leitura de um jeito só. Aqui ele aparece em três,
e é por isso que a varredura por `const { data: profile } = await supabase` sozinha **não é
censo** (ver a seção final, que é o achado mais pesado desta rodada):

1. **`requireManager` local, copiado byte a byte em 8 arquivos** de `admin/books/**`. Devolvia
   `{ user, profile: null }`, e cada handler traduzia `!profile` em 403 "Forbidden".
2. **Leitura inline no corpo do handler** — `admin/users` (duas cópias no mesmo arquivo, GET e
   POST) e `admin/books/[bookId]/upload-pdf/status`.
3. **`getAdminProfile` / `getAdminContext`** — `admin/users/[userId]` e `admin/sso` (esta
   lendo pelo cliente de serviço, que o helper aceita sem cerimônia porque só exige `from`).

Nas três, um timeout de statement faz `data` voltar `null`, e **o `null` da falha é
indistinguível do `null` de "não é admin"**. O administrador legítimo lê "Forbidden" quando a
verdade é "não conseguimos confirmar".

---

## Vermelho ANTES da correção — `api/admin`

`pnpm --filter @eximia/web test src/app/api/admin/__tests__/perfil-ilegivel-nao-e-negacao-admin.test.ts`

```
⎯⎯⎯⎯⎯⎯ Failed Tests 14 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  …-admin.test.ts > … > GET /api/admin/books — falha ao LER o perfil não pode virar 403
 FAIL  …-admin.test.ts > … > POST /api/admin/books — falha ao LER o perfil não pode virar 403
 FAIL  …-admin.test.ts > … > GET /api/admin/books/[bookId] — falha ao LER o perfil não pode virar 403
 FAIL  …-admin.test.ts > … > GET /api/admin/books/[bookId]/chapters — falha ao LER o perfil não pode virar 403
 FAIL  …-admin.test.ts > … > PATCH /api/admin/books/[bookId]/chapters/[chapterId] — falha ao LER o perfil não pode virar 403
 FAIL  …-admin.test.ts > … > POST /api/admin/books/[bookId]/chapters/reorder — falha ao LER o perfil não pode virar 403
 FAIL  …-admin.test.ts > … > POST /api/admin/books/[bookId]/upload-pdf — falha ao LER o perfil não pode virar 403
 FAIL  …-admin.test.ts > … > GET /api/admin/books/[bookId]/upload-pdf/status — falha ao LER o perfil não pode virar 403
 FAIL  …-admin.test.ts > … > POST /api/admin/books/fetch-ratings — falha ao LER o perfil não pode virar 403
 FAIL  …-admin.test.ts > … > GET /api/admin/books/search — falha ao LER o perfil não pode virar 403
 FAIL  …-admin.test.ts > … > GET /api/admin/users — falha ao LER o perfil não pode virar 403
 FAIL  …-admin.test.ts > … > POST /api/admin/users — falha ao LER o perfil não pode virar 403
 FAIL  …-admin.test.ts > … > PATCH /api/admin/users/[userId] — falha ao LER o perfil não pode virar 403
 FAIL  …-admin.test.ts > … > GET /api/admin/sso — falha ao LER o perfil não pode virar 403
AssertionError: expected 403 not to be 403 // Object.is equality
 ❯ src/app/api/admin/__tests__/perfil-ilegivel-nao-e-negacao-admin.test.ts:301:35
    300|       // O coração do defeito: hoje todas devolvem 403 "Forbidden".
    301|       expect(resposta.status).not.toBe(403)
       |                                   ^

 Test Files  1 failed (1)
      Tests  14 failed | 56 passed (70)
```

**56 verdes já no vermelho** são os controles positivos, quatro por rota:

1. papel insuficiente (`student` diante de porta administrativa) continua **403**;
2. perfil inexistente (`PGRST116`) continua **403**, e **não** 503;
3. papel suficiente atravessa o guard;
4. sem sessão **jamais** vira indisponibilidade de perfil.

O CP nº 1 é o que carrega o cuidado específico desta família — ele tem dentes, e a mutação
abaixo prova.

O CP nº 4 foi formulado como "o que NÃO pode acontecer" em vez de "é 401", porque **os status
de sessão ausente desta família não são uniformes**: `admin/sso` responde 403 à sessão ausente
(seu `getAdminContext` colapsava "sem sessão" e "sem direito" no mesmo `null`), as demais
respondem 401. Divergência pré-existente, **preservada** — corrigi-la seria mudar um contrato
que não é o defeito desta rodada.

## Vermelho ANTES da correção — `api/analytics`

```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  …-analytics.test.ts > … > POST /api/analytics/insights — falha ao LER o perfil não pode virar 403
 FAIL  …-analytics.test.ts > … > POST /api/analytics/pedagogical-actions — falha ao LER o perfil não pode virar 403
 FAIL  …-analytics.test.ts > … > GET /api/analytics/sessions/[sessionId] — falha ao LER o perfil não pode virar 403
 FAIL  …-analytics.test.ts > … > GET /api/analytics/students/[studentId] — falha ao LER o perfil não pode virar 403
AssertionError: expected 403 not to be 403 // Object.is equality

 Test Files  1 failed (1)
      Tests  4 failed | 13 passed (17)
```

---

## A correção

### `admin/books/**` — oito cópias viram uma

Novo `apps/web/src/app/api/admin/books/_guard-do-acervo.ts`: um `requireManager` só, que
delega a decisão ao `requireRole` compartilhado e amarra localmente apenas o que é desta
família (a lista de papéis e o 401 de sessão ausente). Cada handler passou de seis linhas a
duas:

```ts
const { profile, recusa } = await requireManager(supabase)
if (recusa) return recusa
```

**A lista de papéis é transcrição 1:1** (`["admin", "super_admin"]`). Nada entrou, nada saiu.

### `admin/books/[bookId]/upload-pdf/status` — lista própria, preservada

Esta rota **não** usa `_guard-do-acervo`: a lista dela é
`["manager", "admin", "super_admin"]`, e `manager` sempre pôde acompanhar o processamento de um
PDF. Chamei o `requireRole` direto, com a lista dela. **Apertar aqui para "uniformizar" seria
mudança de autorização disfarçada de correção de defeito**, e a divergência ficou comentada no
arquivo.

Efeito colateral registrado: o 403 desta rota era `new Response("Forbidden")` (texto puro) e
passou a ser o JSON do helper. O consumidor é um `EventSource`
(`admin/biblioteca/[bookId]/conteudo/_components/book-content-editor-client.tsx:144`), que só
enxerga a conexão falhando — o corpo nunca foi lido. O **status continua 403**.

### `admin/users/[userId]` — `profile.id` virou `user.id`

O helper devolve `{ role, tenant_id }`, sem o `id` que a leitura antiga trazia. As duas regras
de negócio que dependiam dele (admin não se rebaixa, admin não se desativa) passaram a comparar
`user.id`. **É o mesmo valor por construção**: a linha de perfil é buscada por
`.eq("id", user.id)`. Está comentado no arquivo.

### Tenant nulo continua nulo

`requireRole` normaliza tenant ausente para `""`. Onde o handler fazia
`let tenantId = profile.tenant_id` e caía no cookie `x-sa-active-tenant`, escrevi
`let tenantId: string | null = profile.tenant_id || null` — `""` e `null` já eram ambos falsy
para o `if (!tenantId)` que decide o fallback, então **o caminho do cookie é o mesmo de antes**;
o `|| null` só devolve ao resto do handler a forma (`string | null`) que ele sempre esperou.
Onde a resolução era função (`resolveTenantId`), nada mudou: ela já fazia
`if (tenantId) return tenantId`, e `""` cai no mesmo lado que `null` caía.

---

## Verde

```
 ✓ src/app/api/analytics/__tests__/perfil-ilegivel-nao-e-negacao-analytics.test.ts (17 tests)
 ✓ src/app/api/admin/__tests__/perfil-ilegivel-nao-e-negacao-admin.test.ts (70 tests)

 Test Files  2 passed (2)      Tests  87 passed (87)
```

### Matriz de papéis — o reforço que faltava

**Achado de outra frente que se aplicava mais aqui que lá** (repassado pelo lead): o colega das
rotas de `chapters` mutou uma lista de papéis e **30 dos 31 testes continuaram verdes**.

A primeira versão desta suíte tinha o mesmo buraco. Os controles eram `student` fora e `admin`
dentro. Trocar `["admin","super_admin"]` pela lista de quatro do Course Designer
(`manager, admin, super_admin, instructor`) deixaria **as duas asserções verdes** — `student`
continua barrado, `admin` continua passando — enquanto `manager` e `instructor` ganhavam a
administração do acervo em silêncio. Numa família que cria livro, convida e remove usuário e
configura SSO, isso não é incômodo, é acesso indevido a função administrativa.

Cada rota passou a declarar a **própria** lista, e o teste percorre os **seis papéis do
produto**, um por vez, afirmando entrar ou ser barrado:

```ts
for (const papel of TODOS_OS_PAPEIS) {          // student, leader, manager, instructor, admin, super_admin
  const deveEntrar = rota.aceitos.includes(papel)
  it(`[CP] ${rota.nome} — \`${papel}\` ${deveEntrar ? "É ACEITO" : "é RECUSADO"}`, …)
}
```

70 → **126** casos em `admin`, 17 → **33** em `analytics`.

**As listas foram conferidas contra `HEAD`, arquivo a arquivo, mecanicamente** — não de
memória:

```bash
git show "HEAD:$f" | grep -oh '!\["[a-z_", ]*"\]\.includes(profile\.role)'
```

As 16 batem exatamente com o que apliquei. É essa conferência que sustenta a matriz como
**caracterização do que já existia**, e não como endosso meu: `admin/books/**` tinha
`["admin","super_admin"]` em `HEAD` e tem hoje; `upload-pdf/status` tinha
`["manager","admin","super_admin"]` e tem hoje; `sessions/[sessionId]` tinha quatro papéis sem
`super_admin` e tem hoje.

**Limite honesto do que medi:** o vermelho foi colhido com a suíte antiga, então as linhas
`student` e `admin` da matriz estão provadas contra o código NÃO corrigido, mas as linhas
`leader`, `manager`, `instructor` e `super_admin` não foram executadas contra ele. Tentei
revertê-lo para colher esse vermelho e **desisti**: reverter 16 arquivos de produção numa
árvore que três frentes compartilham arrisca deixá-la sem a correção se a conexão cair, e o
ganho probatório não paga esse risco. O que sustenta essas quatro linhas é a conferência
mecânica contra `HEAD` acima, mais as mutações abaixo.

### A prova de que o verde não afrouxou a porta

O vermelho de 14+4 já prova que a asserção do defeito não é vácua (ela falhava antes e passa
depois). Falta a outra metade: **o controle positivo que guarda a autorização tem dentes?**

Mutei as duas listas de papéis, acrescentando `student` a `PAPEIS_DO_ACERVO`
(`_guard-do-acervo.ts`) e a `PAPEIS_DA_ANALISE` de `analytics/sessions/[sessionId]`:

```
⎯⎯⎯⎯⎯⎯ Failed Tests 10 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  [CP] GET /api/admin/books — papel insuficiente continua 403
 FAIL  [CP] POST /api/admin/books — papel insuficiente continua 403
 FAIL  [CP] GET /api/admin/books/[bookId] — papel insuficiente continua 403
 FAIL  [CP] GET /api/admin/books/[bookId]/chapters — papel insuficiente continua 403
 FAIL  [CP] PATCH /api/admin/books/[bookId]/chapters/[chapterId] — papel insuficiente continua 403
 FAIL  [CP] POST /api/admin/books/[bookId]/chapters/reorder — papel insuficiente continua 403
 FAIL  [CP] POST /api/admin/books/[bookId]/upload-pdf — papel insuficiente continua 403
 FAIL  [CP] POST /api/admin/books/fetch-ratings — papel insuficiente continua 403
 FAIL  [CP] GET /api/admin/books/search — papel insuficiente continua 403
 FAIL  [CP] GET /api/analytics/sessions/[sessionId] — papel insuficiente continua 403
AssertionError: expected 200 to be 403   ← GET /api/admin/books/search
AssertionError: expected 500 to be 403
AssertionError: expected 404 to be 403
AssertionError: expected 400 to be 403
      Tests  10 failed | 77 passed (87)
```

O mutante morre em 10 lugares, e um deles é literal: **`expected 200 to be 403`** — com a lista
afrouxada, um `student` recebe `200` da busca de livros. Os 77 restantes sobrevivem, inclusive
a asserção do defeito. Arquivos restaurados no mesmo comando e re-verificados.

Repare que `upload-pdf/status` **não** aparece na lista de mortos: a mutação tocou a lista do
acervo, e essa rota tem a própria. É a confirmação de que a lista dela ficou de fato separada.

### As três mutações que a matriz mata, e a antiga não mataria

Rodadas depois do reforço, restaurando os arquivos no mesmo comando.

**M1 — alargamento, o cenário exato do colega.** `PAPEIS_DO_ACERVO` trocada pela lista de
quatro do Course Designer:

```
      Tests  18 failed | 108 passed (126)
 × [CP] GET  /api/admin/books                                — `manager` é RECUSADO
 × [CP] GET  /api/admin/books                                — `instructor` é RECUSADO
 × [CP] POST /api/admin/books                                — `manager` é RECUSADO
 × [CP] POST /api/admin/books                                — `instructor` é RECUSADO
 … (as 8 rotas do acervo, 2 papéis cada)
```

**As 18 mortes são exatamente `manager` e `instructor`.** Nenhum outro caso muda. Isso é a
demonstração direta de que a suíte antiga — `student` fora, `admin` dentro — teria ficado
**100% verde** com `manager` e `instructor` administrando o acervo.

**M2 — estreitamento.** `super_admin` removido de `PAPEIS_DO_ACERVO`: morrem 9 casos
`super_admin É ACEITO`. A matriz pega perda de acesso, não só ganho.

**M3 — a divergência registrada sendo "consertada" sem decisão do dono.** `super_admin`
acrescentado a `sessions/[sessionId]`: morre `[CP] … — super_admin é RECUSADO`. Enquanto a
decisão do dono do produto não vier, esse caso é o que impede alguém de alinhar a lista por
conta própria achando que corrige um esquecimento.

M2 e M3 juntas: `10 failed | 149 passed (159)`. Restaurado: **159 passed**.

---

## Régua desta frente — arquivo a arquivo

Por diretório não serve: `api/admin/**` e `api/analytics/**` contêm rotas de outros donos e
rotas que esta frente registrou como pendentes, então uma varredura por diretório acusaria
aquelas, não estas. A régua nomeia os 16 arquivos.

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2/apps/web/src/app/api
MINHAS=(
"admin/books/route.ts" "admin/books/[bookId]/route.ts"
"admin/books/[bookId]/chapters/route.ts" "admin/books/[bookId]/chapters/[chapterId]/route.ts"
"admin/books/[bookId]/chapters/reorder/route.ts" "admin/books/[bookId]/upload-pdf/route.ts"
"admin/books/[bookId]/upload-pdf/status/route.ts" "admin/books/fetch-ratings/route.ts"
"admin/books/search/route.ts" "admin/users/route.ts" "admin/users/[userId]/route.ts"
"admin/sso/route.ts" "analytics/insights/route.ts" "analytics/pedagogical-actions/route.ts"
"analytics/sessions/[sessionId]/route.ts" "analytics/students/[studentId]/route.ts"
)
grep -n "data: profile" "${MINHAS[@]}"          # VAZIA
for f in "${MINHAS[@]}"; do grep -c "requireRole\|requireManager" "$f"; done   # todos >= 2
```

Régua A: **vazia**. Régua B: 16 arquivos, todos ≥ 2 ocorrências.

`git diff --name-only` na minha área devolve exatamente os 12 arquivos de `admin` e 4 de
`analytics` acima. `analytics/aggregate/route.ts` e `analytics/aprendizagem-time/classify/route.ts`
aparecem no diff geral mas **já estavam modificados antes desta frente começar** (baseline de
`git status` no início da sessão) — não são meus.

**Novos:** `admin/books/_guard-do-acervo.ts`, `admin/__tests__/perfil-ilegivel-nao-e-negacao-admin.test.ts`,
`analytics/__tests__/perfil-ilegivel-nao-e-negacao-analytics.test.ts`, este relatório.

### Biome — e o PASS por vacuidade

**`biome check` responde PASS quando não checou nada.** `pnpm --filter @eximia/web` já executa
dentro de `apps/web`; passar caminho relativo à raiz do repo produz:

```
Checked 0 files in 380µs. No fixes applied.
  × No files were processed in the specified paths.
```

Para quem lê só a última linha, isso passa por aprovado. **A régua correta assere a contagem:**

```bash
SAIDA=$(pnpm --filter @eximia/web exec biome check src/app/api/admin …)
N=$(echo "$SAIDA" | grep -oE "Checked [0-9]+ files" | grep -oE "[0-9]+")
[ "${N:-0}" -gt 0 ] || echo ">>> VÁCUO: o PASS não vale nada"
```

Com a base certa: **`Checked 61 files`**. Caminhos com colchetes (`[sessionId]`) precisam de
aspas, senão o shell os come e o mesmo vácuo acontece.

`biome check` nos meus diretórios devolve **9 diagnósticos, todos pré-existentes em `HEAD`**
(verificado extraindo as versões de `HEAD` para um diretório temporário e rodando o mesmo
comando: mesmos 9). Os 6 arquivos com `format` vermelho **já estavam desformatados antes**, e
não os reformatei para não inflar o diff com linhas que não toquei. Três regressões que EU
introduzi (`admin/users/[userId]/route.ts format`, `organizeImports` no teste de `admin` e,
depois do reforço da matriz, `format` no teste de `analytics`) foram corrigidas com
`biome check --fix` nesses arquivos. Varredura final sobre os 10 arquivos que são meus e novos:
`Checked 10 files … Found 0 errors`.

Diagnósticos em `src/app/api/admin` que **não são meus** e não toquei (aparecem quando se varre
o diretório inteiro): `admin/engagement/history organizeImports`,
`admin/notifications:155 noNonNullAssertion`, `admin/switch-tenant format+organizeImports`,
`admin/tenants/**` (3 × `format`).

---

## NÃO corrigidas — registradas, com o motivo

### a) Não cabem no helper como ele está: o gate decide por CHAPÉUS, não pelo `role` singular

`requireRole` decide pela coluna `users.role`. Estas rotas decidem pela **união de chapéus**
(`user_roles!user_roles_user_id_fkey(role)`), com fallback para o singular quando o join vem
vazio. Trocar o guard nelas **mudaria a autorização**: um usuário cuja coluna singular diz
`manager` mas que tem chapéu de `instructor` hoje passa, e passaria a ser barrado. Isso é
aperto, não afrouxamento — mas continua sendo mudança de autorização, e não é minha decisão.

| Rota | Onde |
|---|---|
| `GET /api/admin/notifications` | `admin/notifications/route.ts:19` |
| `POST /api/admin/notifications` | `admin/notifications/route.ts:63` |
| `POST /api/analytics/semantic` | `analytics/semantic/route.ts:42` |
| `GET /api/analytics/aggregate` | `analytics/aggregate/route.ts:709` |

`aggregate` tem um agravante de coordenação: o arquivo está sendo trabalhado por outra frente
(item 4 do `FIX-B-rotas.md` pôs o invólucro de 503 no `GET`), e são 1.500 linhas.

### b) Outra forma de falha, não o E→NEGA

**`GET /api/analytics/manager-groups`** (`manager-groups/route.ts:112`) não tem gate de 403
nenhum: ela faz `toAnalyticsRole(profile?.role)` e o papel resultante decide **o que** a pessoa
vê. Com o perfil ilegível, `profile` é `null`, e a rota **degrada silenciosamente para o papel
default** em vez de negar. É um defeito real e possivelmente mais grave (é E→DEGRADA, não
E→NEGA), mas o remédio não é o `requireRole`: é decidir o que a tela deve mostrar quando não se
sabe quem está olhando. Registro, não corrijo.

### c) Já corretas — não precisavam de nada

Quatro rotas da mesma família **já destructuravam o `error` e respondiam 500**. Elas não foram
tocadas. O contraste é o dado interessante: a diferença entre a metade certa e a metade errada
desta família é literalmente uma palavra na desestruturação.

| Rota | Onde | Desfecho da falha de leitura |
|---|---|---|
| `GET /api/analytics/student` | `student/route.ts:20` | 500 "Internal server error" |
| `GET /api/analytics/manager-courses` | `manager-courses/route.ts:21` | 500 |
| `GET /api/analytics/leitura-do-periodo` | `leitura-do-periodo/route.ts:106` | 500 "Não foi possível verificar seu acesso" |
| `analytics/autogestao/**` (as 3 rotas) | `autogestao/_contexto.ts:122` | 500 |

Observação para uma rodada futura: elas distinguem, mas com **500 sem `Retry-After`**, e não
com o 503 retentável do padrão. É divergência de forma, não de julgamento. Unificá-las é
melhoria, não correção — e mexeria em rota que já está certa.

### d) Nenhuma lista de papéis foi alterada, e uma parece estranha

Registro sem tocar: **`analytics/sessions/[sessionId]` aceita
`["leader","manager","admin","instructor"]` — sem `super_admin`**, enquanto as rotas irmãs
(`insights`, `pedagogical-actions`, `students/[studentId]`, `aggregate`) incluem. Um
`super_admin` não abre a sessão individual. Parece engano, mas **não alterei**: é RBAC, e a
decisão é do dono do produto.

---

## ACHADO QUE EXTRAPOLA — a varredura das "39 rotas" NÃO é censo, é amostra

O `FIX-B-rotas.md` contou 39 rotas restantes com
`grep -rln "const { data: profile } = await supabase"`. **Esse grep é cego para pelo menos três
outras grafias do MESMO defeito**, e as três estão vivas na minha área. Fiz o censo por
mecanismo de gate (`for f in $(find admin -name route.ts); do grep -oh <mecanismos> "$f"; done`)
em vez de por string da leitura, e apareceu isto:

### 1. `lib/api-auth/require-admin.ts` — um helper compartilhado com o defeito dentro

```ts
// lib/api-auth/require-admin.ts:64, dentro de loadActor()
const { data } = await supabase.from("users").select(ACTOR_SELECT).eq("id", user.id).single()
if (!data) return { user, profile: null, hats: [] as string[] }
```

`error` descartado, `!data` virando "sem chapéu", e o chamador traduzindo em 403. **É o E→NEGA
idêntico, escrito com `data` em vez de `data: profile`** — por isso nenhuma varredura anterior o
viu.

Consumidores medidos, não estimados:

```bash
grep -rl "requireAdmin" --include='route.ts' app/api | wc -l    # 17
```

**17 arquivos `route.ts` importam `requireAdmin` diretamente**: `admin/api-keys/**` (4),
`admin/areas/**` (3), `admin/audit-log`, `admin/engagement/templates`,
`admin/users/[userId]/instructor-permissions`, `admin/users/[userId]/reset-password`,
`admin/users/bulk-invite`, `admin/webhooks/**` (4) e **`api/integrations/keys`** — esta última
de outra frente.

Mais **5 rotas que chegam nele por intermediário**: as 3 de `admin/departments/**` (via
`departments/_context.ts`) e `admin/users/[userId]/resend-invite` + `revoke-invite` (via
`lib/invites/target.ts`, o único gate que essas duas têm). Mais 3 server actions e
`lib/admin-route-access.ts`, fora de `app/api/`.

**Total: 22 rotas de API atingidas por uma única cópia do defeito.**

**Não toquei.** É um arquivo compartilhado por >20 consumidores, alguns fora das minhas
famílias; e corrigi-lo significa decidir o que `requireAdmin` devolve na indisponibilidade, que
é contrato de todos eles de uma vez. Exatamente o caso da regra de coordenação.

### 2. `lib/super-admin-auth.ts` — mesma coisa, menor

```ts
const { data: profile } = await supabase.from("users").select("id, role").eq("id", user.id).single()
if (!profile || profile.role !== "super_admin") return { user, profile: null }
```

Consumidor: `admin/switch-tenant/route.ts` (mais `lib/admin-route-access.ts`). Não está sob
`app/api/`, então o grep original também não o alcançava.

### 3. Chamadores de `getAuthProfile` que jogam fora o `error` que ele devolve

`lib/auth.ts` **faz a coisa certa**: destructura `error` e o devolve. Quem chama é que o
descarta:

| Rota | Linha do gate |
|---|---|
| `POST /api/admin/tenants` | `tenants/route.ts:17` |
| `PATCH/DELETE /api/admin/tenants/[tenantId]` | `tenants/[tenantId]/route.ts:21` e `:52` |
| `POST/DELETE /api/admin/areas/[areaId]/courses` | `areas/[areaId]/courses/route.ts:22` e `:52` |

`const { profile } = await getAuthProfile(); if (!profile || profile.role !== "super_admin") → 403`.
A informação está a uma palavra de distância e é descartada. `getAuthProfile` tem **129
consumidores** no repo — quantos deles repetem isto é uma varredura que vale a pena, e que
ninguém fez ainda.

### Consequência honesta

O número "39 rotas restantes" **subestima**. Só na minha área, a correção que entreguei cobre
18 cópias do guard, e sobram:

| Origem | Rotas de API atingidas |
|---|---|
| `lib/api-auth/require-admin.ts` (`loadActor`) | **22** (17 diretas + 5 por intermediário) |
| `lib/super-admin-auth.ts` (`requireSuperAdmin`) | 1 (`admin/switch-tenant`) |
| chamadores de `getAuthProfile` que descartam o `error` | 3 arquivos / 5 handlers, **na minha área** — quantos entre os 129 consumidores do repo, ninguém mediu |
| gate por chapéus (não cabe no helper) | 4 |
| degradação silenciosa em vez de negação | 1 |

Se a casa quiser fechar o defeito de verdade, a varredura precisa ser **por mecanismo de
decisão de papel**, não por string de leitura — a string muda de nome, o julgamento é o mesmo.
Foi só trocando o eixo da varredura que 22 rotas escondidas atrás de um helper apareceram.

---

## Comandos de evidência

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2

# as duas famílias
pnpm --filter @eximia/web test src/app/api/admin/__tests__/perfil-ilegivel-nao-e-negacao-admin.test.ts
pnpm --filter @eximia/web test src/app/api/analytics/__tests__/perfil-ilegivel-nao-e-negacao-analytics.test.ts

# área inteira e tipos
pnpm --filter @eximia/web test src/app/api        # 38 arquivos, 589 testes, verde
pnpm --filter @eximia/web exec tsc --noEmit       # limpo

# o helper compartilhado não foi tocado
git diff --name-only | grep -c "api-role-guard"   # 0

# o censo por mecanismo (o que a varredura por string não vê)
cd apps/web/src/app/api
for f in $(find admin -name 'route.ts' | sort); do
  printf "%-62s %s\n" "$f" "$(grep -oh "requireManager\|requireRole\|requireAdmin\|hasAnyRole\|requireSuperAdmin\|getAdminContext\|getAdminProfile" "$f" | sort -u | tr '\n' ',')"
done
grep -n "const { data } = await supabase" ../../../lib/api-auth/require-admin.ts   # o defeito escondido
```
