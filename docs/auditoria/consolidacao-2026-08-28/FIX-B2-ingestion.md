# FIX-B2 — `ingestion/**` e rotas avulsas: perfil ilegível deixa de virar 403

> Executado em 2026-08-30, worktree `/Users/hugocapitelli/Dev/eximia/eximia-academy-v2`,
> branch `integra/main-cory`, a partir de `d2b8083`.
> Continuação de `FIX-B-rotas.md` §"ACHADO QUE EXTRAPOLA O ESCOPO — 39 outras rotas".
> **Nenhum commit, nenhum push, nenhuma escrita em banco.** Todos os duplos são em memória.
> **`lib/api-role-guard.ts` NÃO foi tocado** — é compartilhado com dois outros agentes nesta rodada.

## Escopo desta frente

15 rotas, em duas famílias:

| Família | Rotas |
|---|---|
| `api/ingestion/**` | `[id]` (DELETE), `[id]/approve`, `[id]/approve-chapter`, `[id]/process`, `[id]/status`, `paste`, `upload`, `video-url` |
| avulsas + course-designer restantes | `integrations/keys`, `notifications/nudge`, `courses/import`, `blueprint/generate`, `course-designer/blueprints/[id]` (GET/PUT/DELETE), `.../[id]/export`, `course-designer/jobs/[jobId]` |

_(placar e resultado final no fim do documento)_

---

## Família 1 — `api/ingestion/**` (8 rotas)

### O defeito, idêntico byte a byte nas oito

```ts
const { data: profile } = await supabase
  .from("users").select("role, tenant_id").eq("id", user.id).single()
if (!profile || !["manager", "admin", "instructor"].includes(profile.role))
  return NextResponse.json({ error: "Permissão negada" }, { status: 403 })
```

O `error` do `.single()` nunca é destructurado. Num timeout de statement `data` volta `null`,
`profile` fica `null`, e `!profile` despacha o **mesmo 403** que um aluno receberia.

Agrava nesta família: `ingestion` é fluxo de várias etapas (upload → process → approve). Um 403
no meio não se lê como falha transitória, se lê como revogação de papel — e a pessoa abandona o
material já enviado em vez de tentar de novo.

### Vermelho ANTES da correção — família inteira, uma execução

`pnpm --filter @eximia/web test src/app/api/ingestion`

```
 FAIL  …perfil-ilegivel-nao-e-negacao-ingestion.test.ts > DELETE /api/ingestion/[id] — falha ao LER o perfil não pode virar 403
 FAIL  …perfil-ilegivel-nao-e-negacao-ingestion.test.ts > POST /api/ingestion/[id]/approve — falha ao LER o perfil não pode virar 403
 FAIL  …perfil-ilegivel-nao-e-negacao-ingestion.test.ts > POST /api/ingestion/[id]/approve-chapter — falha ao LER o perfil não pode virar 403
 FAIL  …perfil-ilegivel-nao-e-negacao-ingestion.test.ts > POST /api/ingestion/[id]/process — falha ao LER o perfil não pode virar 403
 FAIL  …perfil-ilegivel-nao-e-negacao-ingestion.test.ts > GET /api/ingestion/[id]/status — falha ao LER o perfil não pode virar 403
 FAIL  …perfil-ilegivel-nao-e-negacao-ingestion.test.ts > POST /api/ingestion/paste — falha ao LER o perfil não pode virar 403
 FAIL  …perfil-ilegivel-nao-e-negacao-ingestion.test.ts > POST /api/ingestion/upload — falha ao LER o perfil não pode virar 403
 FAIL  …perfil-ilegivel-nao-e-negacao-ingestion.test.ts > POST /api/ingestion/video-url — falha ao LER o perfil não pode virar 403
AssertionError: expected 403 not to be 403 // Object.is equality
 ❯ src/app/api/ingestion/__tests__/perfil-ilegivel-nao-e-negacao-ingestion.test.ts:207:35
    206|       // O coração do defeito: hoje todas devolvem 403 "Permissão nega…
    207|       expect(resposta.status).not.toBe(403)
       |                                   ^
    208|       // E o que devem devolver: indisponibilidade retentável, como o …

 Test Files  1 failed (1)
      Tests  8 failed | 25 passed (33)
```

Os **25 verdes já no vermelho** são os controles positivos — quatro por rota (papel insuficiente
continua 403; `PGRST116` continua 403 e **não** 503; papel suficiente atravessa; sem sessão
continua 401 antes de qualquer leitura de perfil). São eles que impedem a correção degenerada
*responde 503 sempre* de ficar verde.

### A correção

As oito passam a ser duas linhas, com o guard que já existia:

```ts
const { profile, recusa } = await requireRole(supabase, user.id, PAPEIS_CONTEUDO)
if (recusa) return recusa
```

**`lib/api-role-guard.ts` não foi tocado.** Nesta rodada ele é compartilhado com dois outros
agentes, e três mãos no mesmo arquivo produzem um estado que ninguém consegue interpretar.
Todas as 15 rotas couberam no guard como ele está — exceto uma, registrada como pendente
(`notifications/nudge`, §Rotas não corrigidas).

A lista de papéis `["manager","admin","instructor"]`, repetida em doze rotas, virou
`PAPEIS_CONTEUDO` num arquivo NOVO, `apps/web/src/lib/papeis-de-conteudo.ts` — deliberadamente
fora do `api-role-guard.ts` pelo mesmo motivo de coordenação. Uma constante nova ao lado não
cria conflito; uma edição no arquivo compartilhado, sim.

Uma decisão que vale registrar: **`super_admin` NÃO foi adicionado** a `PAPEIS_CONTEUDO`.
Nenhuma das dez rotas o aceitava antes. Incluí-lo aqui seria alargar direito de acesso a
pretexto de arrumar tratamento de erro — política mudada dentro de um fix. Se a casa quiser,
que seja decisão própria com teste próprio.

### Verde

```
 ✓ src/app/api/ingestion/__tests__/perfil-ilegivel-nao-e-negacao-ingestion.test.ts (33 tests) 10ms
 Test Files  1 passed (1)      Tests  33 passed (33)
```

Os 8 vermelhos viraram verdes; os 25 controles positivos continuam verdes.

---

## Família 2 — avulsas e as três do course-designer que o laudo não listou

Sete rotas com a forma padrão (`courses/import`, `blueprint/generate`,
`course-designer/blueprints/[id]` nos seus **três** handlers GET/PUT/DELETE, `.../export`,
`course-designer/jobs/[jobId]`) mais `integrations/keys`, que tem forma própria.

### Vermelho ANTES da correção — família inteira, uma execução

`pnpm --filter @eximia/web test src/app/api/__tests__/perfil-ilegivel-nao-e-negacao-avulsas.test.ts`

```
 FAIL  …-avulsas.test.ts > POST /api/courses/import — falha ao LER o perfil não pode virar 403
 FAIL  …-avulsas.test.ts > POST /api/blueprint/generate — falha ao LER o perfil não pode virar 403
 FAIL  …-avulsas.test.ts > GET /api/course-designer/blueprints/[id] — falha ao LER o perfil não pode virar 403
 FAIL  …-avulsas.test.ts > PUT /api/course-designer/blueprints/[id] — falha ao LER o perfil não pode virar 403
 FAIL  …-avulsas.test.ts > DELETE /api/course-designer/blueprints/[id] — falha ao LER o perfil não pode virar 403
 FAIL  …-avulsas.test.ts > GET /api/course-designer/blueprints/[id]/export — falha ao LER o perfil não pode virar 403
 FAIL  …-avulsas.test.ts > GET /api/course-designer/jobs/[jobId] — falha ao LER o perfil não pode virar 403
AssertionError: expected 403 not to be 403 // Object.is equality
 ❯ src/app/api/__tests__/perfil-ilegivel-nao-e-negacao-avulsas.test.ts:190:35

 FAIL  …-avulsas.test.ts > GET /api/integrations/keys — falha ao LER o perfil não pode virar 403
 FAIL  …-avulsas.test.ts > POST /api/integrations/keys — falha ao LER o perfil não pode virar 403
AssertionError: expected 403 not to be 403 // Object.is equality
 ❯ src/app/api/__tests__/perfil-ilegivel-nao-e-negacao-avulsas.test.ts:256:35

 Test Files  1 failed (1)
      Tests  9 failed | 31 passed (40)
```

### `integrations/keys` — a forma diferente que AINDA coube no guard

O perfil não era lido no handler: era lido num helper local que devolvia `null` para **três
situações distintas** — sem sessão, papel insuficiente, e leitura de perfil que falhou — e os
dois handlers respondiam 403 para as três.

```ts
async function requireAdminOrSuper(supabase) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null                                    // sem sessão
  const { data: profile } = await supabase.from("users")…    // erro NUNCA lido
  if (!profile || !["admin","super_admin"].includes(profile.role)) return null
  return { userId, role, tenantId }
}
// nos dois handlers:
if (!auth) return NextResponse.json({ error: "Permissão negada" }, { status: 403 })
```

O helper passou a devolver `{ auth, recusa }`, com a recusa dizendo **qual** das três ocorreu.
Não foi preciso exceção local nem mudar `api-role-guard.ts`: `requireRole` entrou dentro do
helper, e o helper preservou o resto do contrato.

**Duas coisas deliberadamente NÃO corrigidas aqui**, para não esconder mudança de contrato
dentro de um fix de tratamento de erro:

1. **O 401 colapsado em 403.** Esta rota nunca respondeu 401 para quem não tem sessão. É outro
   defeito, registrado abaixo. Um `[CP]` trava o comportamento atual, para que a correção do
   503 não o altere por acidente.
2. **A mensagem "Forbidden" de `blueprint/generate`** virou "Permissão negada" ao adotar o
   guard. Verificado que **nenhum cliente no repo consome esta rota** (`grep` por
   `api/blueprint/generate` fora de `app/api/` só encontra `lib/blueprint-client.ts`, que fala
   direto com o microserviço). O outro 403 da rota, o de tenant divergente, continua "Forbidden".

### A armadilha do `tenant_id` vazio — e a prova de que o CP a pega

`requireRole` normaliza `tenant_id` ausente para `""`. Nas outras treze rotas isso é cosmético.
Em `integrations/keys` **não é**: `targetTenant` cai num `??` e depois num teste de veracidade,
e `""` é falsy onde `null` não é. Sem cuidado, a trava "apenas super admin cria chave de
plataforma" seria **pulada**, e um admin comum criaria a chave mais poderosa do sistema.

O helper local restaura o `null` (`profile.tenant_id === "" ? null : profile.tenant_id`), e o
`[CP] admin SEM tenant continua barrado de criar chave de plataforma` mede a trava.

Esse CP nasceu **verde** (passava antes da correção também), então foi **mutado** para provar
que não está verde por vacuidade — trocando a restauração por `tenantId: profile.tenant_id`:

```
 × [CP] admin SEM tenant continua barrado de criar chave de plataforma
   → expected 500 to be 403 // Object.is equality
      Tests  1 failed | 39 passed (40)
```

O `500` é o próprio laudo: sem a restauração, o admin **atravessa a trava** e chega ao INSERT
(500 só porque o duplo de banco recusa a escrita). Em produção teria criado a chave. Mutante
morto, arquivo restaurado no mesmo comando.

### Verde

```
 ✓ src/app/api/__tests__/perfil-ilegivel-nao-e-negacao-avulsas.test.ts (40 tests) 11ms
 Test Files  1 passed (1)      Tests  40 passed (40)
```

---

## Segunda passada — a lista de papéis vira asserção (achado da frente `chapters`)

A frente de `chapters` mutou a lista de papéis de uma rota e **30 dos 31 testes continuaram
verdes**. O motivo é estrutural e valia igualmente aqui: um teste que experimenta **um** papel
aceito e **um** recusado não distingue a lista certa da errada. Ele mede que o guard existe,
não *qual* guard.

Isso é especialmente perigoso nesta frente porque ela criou `PAPEIS_CONTEUDO` e convive com
**três listas diferentes**:

| Lista | Rotas | `super_admin`? |
|---|---|---|
| `PAPEIS_CONTEUDO` = `["manager","admin","instructor"]` | as 8 de `ingestion/**`, `courses/import`, `blueprint/generate` | **não** |
| `PAPEIS_COURSE_DESIGNER` = `["manager","admin","super_admin","instructor"]` | `blueprints/[id]` (3 handlers), `.../export`, `jobs/[jobId]` | sim |
| `PAPEIS_CHAVES_INTEGRACAO` = `["admin","super_admin"]` | `integrations/keys` | sim, e **sem** manager/instructor |

### Conferência rota a rota contra `HEAD`

Antes de qualquer teste, extraí de `HEAD` o literal que **cada arquivo** tinha e comparei com a
constante aplicada. As 14 batem, uma a uma. (A substituição em si já era exigente — o script só
trocava o bloco se o literal casasse byte a byte —, mas isso é garantia do processo, não do
resultado, e processo não é evidência.)

### O par exaustivo

Os dois CPs frouxos (`papel insuficiente` com um único `student`, `papel suficiente` com um
único papel) foram **substituídos** por um par gerado da lista: para **cada** papel aceito,
prova que entra; para **cada** papel de fora, prova que não entra. `super_admin` entrou em
`RECUSADOS` das rotas de conteúdo de propósito — é exatamente o papel pelo qual a lista erraria.

**73 → 124 testes.**

### Três mutantes, três mortes

| Mutante | O que morre |
|---|---|
| `ingestion/paste` usa `PAPEIS_COURSE_DESIGNER` (**alarga**) | `[CP] super_admin continua recusado com 403` → `expected 500 to be 403` |
| `jobs/[jobId]` usa `PAPEIS_CONTEUDO` (**estreita**) | `[CP] super_admin atravessa o guard` → `expected 403 not to be 403` |
| `integrations/keys` usa `PAPEIS_CONTEUDO` (**troca completa**) | **6 casos**: `super_admin atravessa` e `manager`/`instructor` recusados, nos dois handlers |

O `500` do primeiro é o laudo: com a lista alargada o `super_admin` **atravessa o guard** e vai
adiante (500 só porque o duplo de banco recusa a leitura). Em produção teria acesso a uma rota
que nunca lhe pertenceu. Os três arquivos foram restaurados e conferidos com `diff` contra o
backup.

### `biome check` — confirmação de que não passou medindo nada

Alerta procedente: rodar `pnpm --filter @eximia/web exec biome check apps/web/src/...` combina
um caminho relativo à **raiz do repo** com um processo que já roda **dentro de `apps/web`**.
Nesta árvore isso não dá `Checked 0 files`, dá erro interno de IO — mas quem lê só a última
linha não distingue um do outro:

```
apps/web/src/app/api/ingestion internalError/io  INTERNAL
  × No such file or directory (os error 2)
```

Todas as execuções deste relatório usaram caminhos relativos a `apps/web` e **reportaram
contagem maior que zero**, conferida: `Checked 3 files` (os 3 novos, sem queixas),
`Checked 14 files` (as rotas modificadas) e `Checked 33 files` na varredura por diretório. Os
caminhos com colchetes (`[blueprintId]`, `[jobId]`, `[id]`) foram passados entre aspas e **estão
entre os arquivos contados** — a contagem 14 confere com as 14 rotas.

---

## Rotas NÃO corrigidas, registradas para segunda rodada

### 1. `api/notifications/nudge` — não cabe no guard como ele está

Estava na minha lista, e **não foi corrigida de propósito**. A leitura de perfil dela não tem a
forma das outras catorze:

```ts
const { data: profile } = await supabase
  .from("users")
  .select("role, full_name, tenant_id, user_roles!user_roles_user_id_fkey(role)")
  .eq("id", user.id)
  .single()
const rawRoles = (profile as { user_roles?: { role: string }[] } | null)?.user_roles ?? []
const fallbackRole = profile?.role
const roles: string[] =
  rawRoles.length > 0 ? rawRoles.map((r) => r.role) : fallbackRole ? [fallbackRole] : []
if (!profile || !hasAnyRole({ roles }, ["instructor", "manager", "admin", "super_admin"])) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}
```

Três diferenças, e a terceira é a que impede:

| | as catorze | `nudge` |
|---|---|---|
| colunas lidas | `role, tenant_id` | + `full_name` + join `user_roles` |
| veredito | `papeis.includes(profile.role)` | `hasAnyRole` sobre o **array** de `user_roles` |
| multi-chapéu | não existe | **é o ponto** — `users.role` é só fallback |

`requireRole` decide por `profile.role`, a coluna singular legada. Aplicá-lo aqui **negaria**
acesso a um membro multi-chapéu (gestor+aluno) cujo `users.role` é `student` mas cujo
`user_roles` contém `manager` — exatamente o cenário que o comentário MULTI-CHAPÉU dentro da
rota diz ter custado uma rodada de review em 2026-07-18. Trocaria um defeito por outro pior:
hoje a rota erra sob falha transitória; com o guard errado, erraria **sempre**, para uma classe
inteira de usuários.

Forçá-la no guard ou abrir uma exceção local produziria divergência de desenho entre três
agentes editando em paralelo. Fica registrada.

**O que a segunda rodada precisa decidir** (não decidi aqui, é escolha de desenho do dono do
helper): ou `requireRole` ganha um parâmetro de projeção/veredito, ou nasce um
`requireAnyRole` irmão que leia `user_roles` e aplique `hasAnyRole` — com a **mesma** separação
403 / 503 + `Retry-After`, e o mesmo controle positivo de que `PGRST116` continua 403.

### 2. `api/integrations/keys/[id]` (DELETE) — RESOLVIDA em `FIX-B5-tenant-falsy.md`

> **Atualização (2026-08-30, mesma sessão):** ganhou dono e **foi corrigida**. Vermelho, correção
> e controles positivos estão em `FIX-B5-tenant-falsy.md` §"a órfã, agora corrigida". O texto
> abaixo é o registro de como ela foi encontrada, preservado por ser o que motivou a atribuição.



Tem o defeito, na forma padrão (`["admin","super_admin"]`, 403). O laudo FIX-B a lista, mas o
briefing desta frente nomeou `integrations/keys` sem `[id]`, e ela não aparece nas famílias das
outras duas frentes (`chapters/**`, `courses/**`, `admin/**`, `analytics/**`). **Não a toquei**
para não colidir. É correção mecânica: `PAPEIS_CHAVES_INTEGRACAO` já existe e o teste é o mesmo
molde. Precisa de dono.

### 3. O 401 colapsado em 403 de `integrations/keys` (GET e POST)

Quem não tem sessão recebe 403 "Permissão negada" em vez de 401. Não é o defeito desta rodada
e mudá-lo altera contrato de resposta. Registrado, com CP travando o estado atual.

---

## Placar

| Item | Vermelho antes | Verde (1ª passada) | Verde (com o par exaustivo) |
|---|---|---|---|
| Família `ingestion/**` (8 rotas) | **8 falhas** | 33/33 | **57/57** |
| Família avulsas + course-designer (7 rotas, 9 handlers) | **9 falhas** | 40/40 | **67/67** |
| **Total desta frente** | **17 falhas** | 73/73 | **124/124** |

Mais **3 mutantes de lista de papéis mortos** (1 alargando, 1 estreitando, 1 trocando) e
**1 mutante de trava falsy morto** em `integrations/keys`.

**14 rotas corrigidas** (16 handlers, contando os três de `blueprints/[blueprintId]`).
**1 rota da minha lista registrada como pendente** (`notifications/nudge`), mais 2 achados.

> **Estado final da frente (2026-08-30):** com `integrations/keys/[id]` corrigida em
> `FIX-B5-tenant-falsy.md`, o total é **15 rotas / 17 handlers / 132 testes**. A única pendência
> que resta desta frente é `notifications/nudge`, que é decisão do Senhor.

### Suíte e tipos

- `pnpm --filter @eximia/web exec tsc --noEmit` → **limpo** (exit 0).
- `pnpm --filter @eximia/web test src/app/api` → **`38 arquivos, 669 testes, 0 falhas`** (20:12),
  depois que as outras duas frentes fecharam os próprios ciclos.
  Registro a leitura intermediária, porque ela é o retrato honesto de medir em árvore
  compartilhada: às 19:55 dava `18 failed | 499 passed` e às 19:59 `9 failed | 508 passed`, com
  **todas** as falhas concentradas num único arquivo de outra frente
  (`admin/__tests__/perfil-ilegivel-nao-e-negacao-admin.test.ts`), no meio do vermelho→verde
  dela. Naquele momento a evidência de que nada era meu foi rodar `src/app/api` **sem** os
  diretórios `admin/` e `analytics/`: `21 arquivos, 363 testes, 0 falhas`.
- `biome check` nos 3 arquivos novos → **limpo**, `Checked 3 files` (contagem conferida, não
  vácuo — ver §`biome check`).
- `biome check` nos 14 arquivos de rota modificados → **o mesmo conjunto de queixas que já
  existia em `HEAD`**, arquivo por arquivo, regra por regra (conferido extraindo as versões de
  `HEAD` para uma árvore temporária e rodando o mesmo `biome` sobre elas). Não reformatei o que
  já estava desformatado, para não inflar o diff com linhas que não toquei.

## Régua própria, ARQUIVO A ARQUIVO

Por diretório não serve: `course-designer/`, `courses/` e `integrations/` contêm rotas irmãs de
outros donos, e um grep por diretório acusaria aquelas, não estas — erro já cometido nesta
auditoria.

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2/apps/web

# A — nenhuma leitura de perfil sem checagem nas 14 corrigidas → SAÍDA VAZIA
grep -n "data: profile" \
  "src/app/api/ingestion/[id]/route.ts" \
  "src/app/api/ingestion/[id]/approve/route.ts" \
  "src/app/api/ingestion/[id]/approve-chapter/route.ts" \
  "src/app/api/ingestion/[id]/process/route.ts" \
  "src/app/api/ingestion/[id]/status/route.ts" \
  src/app/api/ingestion/paste/route.ts \
  src/app/api/ingestion/upload/route.ts \
  src/app/api/ingestion/video-url/route.ts \
  src/app/api/courses/import/route.ts \
  src/app/api/blueprint/generate/route.ts \
  src/app/api/integrations/keys/route.ts \
  "src/app/api/course-designer/blueprints/[blueprintId]/route.ts" \
  "src/app/api/course-designer/blueprints/[blueprintId]/export/route.ts" \
  "src/app/api/course-designer/jobs/[jobId]/route.ts"

# B — e o guard está presente em cada uma (mesma lista, `grep -c requireRole`):
#   13 arquivos com 2 (import + chamada); blueprints/[blueprintId] com 4 (import + 3 handlers);
#   integrations/keys com 3 (import + menção no comentário + chamada).

# C — a rota da minha lista que NÃO foi corrigida, declarada:
grep -n "data: profile" src/app/api/notifications/nudge/route.ts   # linha 19, por desenho
```

**Resultado:** A vazio, B com a contagem acima, C com a única linha esperada e declarada.

## Arquivos

**Novos:**
- `apps/web/src/lib/papeis-de-conteudo.ts`
- `apps/web/src/app/api/ingestion/__tests__/perfil-ilegivel-nao-e-negacao-ingestion.test.ts`
- `apps/web/src/app/api/__tests__/perfil-ilegivel-nao-e-negacao-avulsas.test.ts`

**Modificados (14 rotas):** as 8 de `ingestion/**`, `courses/import`, `blueprint/generate`,
`integrations/keys`, `course-designer/blueprints/[blueprintId]`, `.../export`,
`course-designer/jobs/[jobId]`.

**NÃO modificado, por regra de coordenação:** `apps/web/src/lib/api-role-guard.ts`
(`git diff --stat` sobre ele → vazio).

As 14 rotas tinham **zero testes** antes desta rodada — esta é a primeira cobertura delas.

## Comandos de evidência

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2

pnpm --filter @eximia/web test src/app/api/ingestion                                   # 33/33
pnpm --filter @eximia/web test src/app/api/__tests__/perfil-ilegivel-nao-e-negacao-avulsas.test.ts  # 40/40
pnpm --filter @eximia/web exec tsc --noEmit                                            # limpo
git diff --stat apps/web/src/lib/api-role-guard.ts                                     # vazio
```

