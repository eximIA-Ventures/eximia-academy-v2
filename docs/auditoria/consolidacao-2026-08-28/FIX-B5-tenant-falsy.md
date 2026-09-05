# FIX-B5 — Censo do `tenant_id ?? ""` do guard nas 15 rotas suspeitas

> Executado em 2026-08-30, worktree `/Users/hugocapitelli/Dev/eximia/eximia-academy-v2`,
> branch `integra/main-cory`.
> Origem: achado do item 3 de `FIX-B2-ingestion.md` (escalada de privilégio em
> `integrations/keys`, provada por mutação).
> **Nenhum commit, push ou escrita em banco. `lib/api-role-guard.ts` NÃO foi alterado.**

## Correção de premissa, antes do censo

O enunciado da tarefa diz que `""` é falsy "onde `null` também é... mas o problema é o inverso".
Vale precisar, porque **é o critério que decide quais rotas entram na lista**:

`""` e `null` são **ambos** falsy. Um `if (x)` puro se comporta **igual** nos dois — logo, teste
de veracidade sozinho **não** é sinal de rota afetada. A divergência aparece em exatamente três
construções:

| Construção | `null` | `""` | Diverge? |
|---|---|---|---|
| `if (x)` / `!x` | false | false | **não** |
| `x ?? fb` | `fb` | `""` | **sim** |
| `x === null` / `!= null` / `?.` | true | false | **sim** |
| `.eq(col, x)` numa coluna `uuid` | `eq.null` | `eq.` | não (ver abaixo) |

Em `integrations/keys` quem matou foi o **`=== null`**; o `??` só carregou o `""` até lá. Sozinho,
nenhum dos dois teria feito estrago — foi a composição.

## Duas provas que sustentam metade das classificações

### (i) `.eq(col, null)` vs `.eq(col, "")` — o que o postgrest-js gera

Sonda direta sobre `@supabase/postgrest-js@2.98.0` desta árvore:

```
  null  -> http://x/t?select=id&tenant_id=eq.null
  ""    -> http://x/t?select=id&tenant_id=eq.
  uuid  -> http://x/t?select=id&tenant_id=eq.aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
```

### (ii) Toda coluna `tenant_id` é `uuid`

```bash
grep -rhn "tenant_id[[:space:]]\+\(uuid\|text\|varchar\)" supabase/migrations/*.sql
# 77 ocorrências, TODAS uuid. Nenhuma text/varchar.
```

Contra `uuid`, Postgres recusa tanto `"null"` quanto `""` com `22P02 invalid input syntax`.
**Os dois erram; nenhum devolve linha; nenhum amplia acesso.** Onde o valor só vai para `.eq()`
sobre `tenant_id`, a troca é **indiferente para autorização** (muda a forma do erro, não o
veredito).

> Honestidade sobre o nível desta evidência: é "URL gerada + tipo da coluna nas migrations", não
> ida-e-volta contra banco vivo. Não escrevo em banco por instrução, e `.env.local` é PRODUÇÃO.

## O fato que define a população em risco

`users.tenant_id` **é anulável**, e por desenho:

```sql
-- supabase/migrations/20260209000000_epic11_super_admin_whitelabel.sql:12
ALTER TABLE users ALTER COLUMN tenant_id DROP NOT NULL;
```

É a migration do super_admin whitelabel. Ou seja: **o único perfil que normalmente tem
`tenant_id` nulo é o `super_admin`** — e o `?? ""` do guard só dispara para ele. Isso torna a
lista de papéis de cada rota parte do critério: **onde `super_admin` não é aceito, o `""` nunca
chega a ser produzido.**

---

## Censo das 15

| # | Rota | Papéis | `super_admin`? | Destino do `tenant_id` | Veredito |
|---|---|---|---|---|---|
| 1 | `ingestion/[id]/approve` | CONTEUDO | não | `.eq(uuid)` | **INDIFERENTE** (a+b) |
| 2 | `ingestion/[id]/process` | CONTEUDO | não | `.eq(uuid)` | **INDIFERENTE** (a+b) |
| 3 | `ingestion/[id]/approve-chapter` | CONTEUDO | não | `.eq(uuid)` | **INDIFERENTE** (a+b) |
| 4 | `chapters/generate-scenario` | admin/manager/instructor | não | **não usa** (`const { recusa }` descarta o perfil) | **INDIFERENTE** (a+d) |
| 5 | `chapters/[id]/generate-audio` | admin/manager/instructor | não | `chapter.tenant_id !== profile.tenant_id` | **INDIFERENTE** (a+e) |
| 6 | `chapters/[id]/slides/upload` | admin/manager/instructor | não | `!==`, template de path, insert | **INDIFERENTE** (a+e) |
| 7 | `chapters/[id]/generate-questions` | manager/admin/instructor | não | usa `chapter.tenant_id`, **não** o do perfil | **INDIFERENTE** (a+d) |
| 8 | `admin/sso` | admin/super_admin | **sim** | `.eq("id", …)` em `tenants` (uuid) | **INDIFERENTE** (b) |
| 9 | `admin/users` | admin/super_admin | **sim** | `profile.tenant_id \|\| null` | **INDIFERENTE** (c) |
| 10 | `admin/users/[userId]` | admin/super_admin | **sim** | `resolveTenantId`: `if (tenantId) return` | **INDIFERENTE** (c) |
| 11 | **`integrations/keys`** | admin/super_admin | **sim** | `?? auth.tenantId` **e depois `=== null`** | **AFETADA — abre acesso** |
| 12 | `course-designer/blueprints` | COURSE_DESIGNER | **sim** | `.eq(uuid)` + chave de rate-limit | **INDIFERENTE** (b) |
| 13 | `course-designer/blueprints/[id]` | COURSE_DESIGNER | **sim** | `.eq(uuid)` ×3 + rate-limit | **INDIFERENTE** (b) |
| 14 | `course-designer/blueprints/[id]/export` | COURSE_DESIGNER | **sim** | `.eq(uuid)` | **INDIFERENTE** (b) |
| 15 | `course-designer/ai-fill` | COURSE_DESIGNER | **sim** | **`requireFeature(tenant, …)`** — é um gate | **INDIFERENTE** (f) |

**Razões:**
- **(a)** `super_admin` fora da lista → o único perfil de tenant nulo nunca atravessa o guard, e o `""` não chega a existir naquele fluxo.
- **(b)** valor só vai para `.eq()` sobre coluna `uuid` → `eq.` e `eq.null` erram igual (prova i+ii).
- **(c)** o consumidor **já** usa a forma defensiva (`|| null`, `if (x)`), que colapsa `""` e `null` no mesmo caminho.
- **(d)** o valor não é usado.
- **(e)** comparado com `chapter.tenant_id`, que é `UUID NOT NULL` → nunca nulo dos dois lados, e a desigualdade dá o mesmo resultado para `""` e `null`.
- **(f)** ver abaixo.

### (f) `ai-fill` → `requireFeature("")`, o único gate real da lista fora do #11

Segui o caminho inteiro porque um gate de plano decidindo por engano seria tão grave quanto o #11:

`checkFeature("")` → cache miss → `loadTenantFeatures("")` →
`.from("tenants").select("plan").eq("id", "").maybeSingle()` → coluna `uuid` → `22P02` →
`tenantError` **é checado** → lança `FeatureCheckUnavailableError` → `requireFeature` devolve
**503 `feature_check_unavailable`**.

Com `null`: `.eq("id", null)` → `eq.null` → `22P02` → **mesmo 503**. Idêntico, e é o desfecho
correto: para quem não tem tenant, o plano é genuinamente indeterminável. `feature-gate.ts` já
distingue "não consegui ler" de "não tem direito" — o padrão-ouro desta casa segurou.

### Veredito do censo

**1 AFETADA em 15.** É `integrations/keys`, exatamente a que o FIX-B2 já achou e corrigiu.
**Nenhuma rota nova foi descoberta afetada.** Nenhuma NÃO-DETERMINADA: as 15 têm caminho
rastreado até o fim.

## A prova por mutação da única AFETADA

Já executada no FIX-B2 e recolada aqui por ser a evidência que sustenta a classe inteira.
Mutante: remover a restauração do `null` no helper local, deixando `tenantId: profile.tenant_id`.

```
   × [CP] admin SEM tenant continua barrado de criar chave de plataforma
     → expected 500 to be 403 // Object.is equality
      Tests  1 failed | 39 passed (40)
```

O `500` é o laudo: sem a restauração, `targetTenant` deixa de ser `null`, o
`targetTenant === null && role !== "super_admin"` não dispara, e o admin comum **atravessa a
trava** e chega ao INSERT — que só falha porque o duplo de banco recusa a escrita. Em produção
teria criado uma chave de integração de plataforma.

O caminho exato, para quem for reler:

```ts
const targetTenant = tenant_id === "platform" ? null : (tenant_id ?? auth.tenantId)
//                                                                 ^^ o "" passa pelo ?? …
if (targetTenant === null && auth.role !== "super_admin") return 403
//                 ^^^^^^^ … e depois falha aqui, que é onde a trava vivia
```

---

## Pergunta de projeto 1 — a normalização para `""` deveria existir?

**Recomendação: não. O guard deveria devolver `string | null`, espelhando a coluna. Mas NÃO
agora** — e por isso estou parando e reportando, sem tocar em `api-role-guard.ts`.

**Por que o `""` está errado no mérito:**

1. `users.tenant_id` é anulável **por desenho** (migration do whitelabel). O `""` apaga uma
   distinção que o domínio tem.
2. `""` **nunca** é um valor válido: não é uuid, não casa com nada, não é gravável. Ele não
   resolve nenhum caso de uso — só silencia um erro de tipo, trocando uma pergunta em tempo de
   compilação ("o que fazer quando não há tenant?") por uma armadilha em tempo de execução.
3. O próprio repositório já discorda do tipo: `admin/users` escreve `profile.tenant_id || null` e
   `admin/users/[userId]` escreve `if (tenantId) return tenantId`. **Duas rotas se defendem de um
   `""` que o tipo jura não existir.** Quando o código defende contra o tipo, o tipo está errado.
4. Custo empírico: 1 de 15 já explodiu, e a explosão foi escalada de privilégio.

**O trade-off honesto, contra:**

- Mudar `PerfilDeRota.tenant_id` para `string | null` é **quebra de tipo para todo consumidor**.
  `tsc` acusaria cada sítio que exige `string` — `requireFeature(tenantId: string, …)`,
  `limiter.limit(key: string)`. (`.eq()` e template literals aceitam `null`.)
- Isso é, na verdade, **o benefício**: o compilador enumeraria os sítios em vez de nós grepando,
  e converteria este censo em prosa numa lista verificada por máquina. A prosa envelhece; o
  `tsc` não.
- O custo real é de **sequenciamento**: é um diff largo, atravessando arquivos de três frentes, e
  deixa `tsc` vermelho até o último sítio ser tratado. Fazê-lo com frentes em voo é exatamente o
  "estado que ninguém interpreta" que o briefing proíbe.

**Sequência que recomendo:** esperar as frentes fecharem e `src/app/api` ficar verde; então uma
mudança atômica só disso, usando o `tsc` como checklist, com o `requireFeature` decidindo
explicitamente o que faz com tenant nulo (hoje ele já responde 503, que é a resposta certa).

## Pergunta de projeto 2 — quantas das 15 deixam de precisar de tratamento local?

**Uma.** E preciso ser franco: isso é bem menos do que "resolve as 15 de uma vez".

| Rota | Tratamento local hoje | Depois da correção na origem |
|---|---|---|
| `integrations/keys` | `tenant_id === "" ? null : …` (meu) | **desnecessário, some** |
| `admin/users` | `\|\| null` | continua funcionando; vira redundante |
| `admin/users/[userId]` | `if (tenantId)` | idem |
| as outras 12 | nenhum | nada muda |

As duas de `admin/` **não** têm o tratamento por causa do `""` — elas já eram defensivas antes,
porque o autor sabia que super_admin não tem tenant. Elas não "deixam de precisar", só param de
parecer paranoia.

**Então o valor da correção na origem não é remover contornos existentes — é impedir o
próximo.** Com `string | null`, o compilador teria recusado `requireFeature(profile.tenant_id, …)`
e obrigado uma decisão explícita em cada sítio, incluindo o de `keys` que virou escalada de
privilégio. É prevenção, não limpeza. Continua valendo a pena, por um motivo diferente do que a
pergunta supunha.

---

## `integrations/keys/[id]` (DELETE) — a órfã, agora corrigida

### Vermelho ANTES

```
 × DELETE /api/integrations/keys/[id] — falha ao LER o perfil não pode virar 403
   → expected 403 not to be 403 // Object.is equality
      Tests  1 failed | 74 passed (75)
```

Os 74 verdes são o resto da suíte mais os controles positivos desta rota, que passam antes e
depois.

### A correção, e o que ela preserva

Mesmo padrão das outras 14, com `PAPEIS_CHAVES_INTEGRACAO` (a lista que ela já tinha,
`["admin","super_admin"]`, conferida contra `HEAD`). Par exaustivo de papéis: `admin` e
`super_admin` atravessam; `manager`, `instructor` e `student` continuam com 403.

Um CP próprio registra uma diferença que **não** foi uniformizada: ao contrário das irmãs
`GET`/`POST` de `integrations/keys`, esta rota **sempre respondeu 401 sem sessão**. Alinhá-la ao
403 delas seria mudar contrato de resposta de carona. O CP trava o 401.

Sobre o `tenant_id`: ele vai para `.eq("tenant_id", profile.tenant_id)` (só quando o papel não é
`super_admin`) e para o campo `tenantId` de `logAdminAction`. O primeiro é o caso (b). O segundo
eu cheguei a suspeitar que quebrasse a auditoria — **e estava errado**: `platform_audit_log` não
tem coluna `tenant_id`; o valor entra em `details` (JSONB), onde `""` e `null` gravam igual, sem
erro. Verifiquei antes de escrever. **INDIFERENTE**.

### Verde

```
 ✓ src/app/api/ingestion/__tests__/…-ingestion.test.ts (57 tests)
 ✓ src/app/api/__tests__/…-avulsas.test.ts (75 tests)
      Tests  132 passed (132)
```

`pnpm --filter @eximia/web exec tsc --noEmit` → **limpo** (exit 0).

E a área inteira, agora que as três frentes fecharam:

```
pnpm --filter @eximia/web test src/app/api
 Test Files  38 passed (38)
      Tests  669 passed (669)
```

## Estado desta frente

**15 rotas corrigidas** (17 handlers), somando as 14 do FIX-B2 mais `integrations/keys/[id]`.
**132 testes.** `api-role-guard.ts` intocado.

**Registrado e não meu:** `notifications/nudge` (multi-chapéu), pendente de decisão do Senhor
sobre `requireAnyRole`.

**Aguardando decisão antes de qualquer implementação:** trocar `tenant_id: string` por
`string | null` em `api-role-guard.ts`.

---

# HANDOFF para o dono de `api-role-guard.ts`

> Acrescentado em 2026-08-30 após a mudança de propriedade. **Isto é diagnóstico, não
> correção.** Não toquei em `api-role-guard.ts` (prova abaixo) e não vou tocar.

## Correção de uma evidência que citei três vezes

Eu afirmei "helper intocado" mostrando `git diff --stat apps/web/src/lib/api-role-guard.ts` →
vazio. **Essa evidência não provava nada.** O arquivo é **untracked** (`?? ` no `git status`):
nunca foi commitado, então `git diff` sobre ele é vazio por construção, tenha eu editado ou não.
É exatamente a classe de gate que aprova medindo nada que eu mesmo sinalizei para o `biome`.

A prova real é o `mtime`:

```
19:51:19  lib/api-role-guard.ts        ← última escrita
19:51:28  lib/papeis-de-conteudo.ts    ← minha PRIMEIRA escrita nesta sessão
20:10:49  app/api/integrations/keys/[id]/route.ts   ← minha última
```

O guard não é escrito desde **9 segundos antes** da minha primeira ação, e todas as minhas
escritas posteriores são em outros arquivos. Conteúdo atual: 111 linhas, com
`tenant_id: profile.tenant_id ?? ""` na linha 101 — o estado original do FIX-B.

## Pergunta A — o que QUEBRA se `tenant_id` virar `string | null`?

Não deduzi: **perguntei ao compilador**, com uma sonda descartável em `src/lib/` (apagada no
mesmo comando) que passa `string | null` para cada construção que os consumidores usam.

| | Construção | Veredito do `tsc` |
|---|---|---|
| A | `.eq("tenant_id", x)` | **aceita `null`** — sem erro |
| B | `.insert({ tenant_id: x })` | **aceita `null`** — sem erro |
| C | `` `${x}/a/b` `` (template) | **aceita `null`** — sem erro |
| D | `requireFeature(x, …)` | **TS2345** — quebra |
| E | `limiter.limit(x)` | **TS2769** — quebra |
| F | `setSentryContext(u, x, r)` | **TS2345** — quebra |

Isto é a notícia boa e o eixo da recomendação: **`.eq()` é a esmagadora maioria dos usos e não
quebra.** Só três assinaturas exigem `string`.

## Pergunta B — quantos sítios exatamente, e quais

**17 sítios quebram, de 163 usos de `profile.tenant_id` em `app/api`** (excluindo testes).
Medido, não estimado.

**(D) `requireFeature(profile.tenant_id, …)` — 7:**
```
admin/api-keys/route.ts:72                                  admin/webhooks/route.ts:77
course-designer/ai-fill/route.ts:44                         course-designer/analyze-content/route.ts:39
course-designer/audit-course/route.ts:33                    course-designer/generate/route.ts:49
course-designer/blueprints/[blueprintId]/apply/route.ts:39
```

**(E) `limiter.limit(profile.tenant_id)` — 9:**
```
course-designer/blueprints/route.ts:26                      course-designer/blueprints/[blueprintId]/route.ts:88
course-designer/blueprints/[blueprintId]/apply/route.ts:44  course-designer/audit-course/route.ts:38
course-designer/analyze-content/route.ts:43                 course-designer/ai-fill/route.ts:48
course-designer/generate/route.ts:54                        courses/route.ts:25
analytics/sessions/[sessionId]/route.ts:46
```

**(F) `setSentryContext(user.id, profile.tenant_id, …)` — 1:**
```
course-designer/generate/route.ts:41
```

**Não quebram, e são a prova de que a migração é conhecida:** quatro sítios de `analytics/**`
chamam `limit(tenantId)` com uma variável **já** declarada `string | null` e estreitada por
`if (!tenantId) return` antes da chamada. **A receita já existe no repositório**, em cinco
lugares:

```ts
let tenantId: string | null = profile.tenant_id || null
if (!tenantId) { /* fallback de cookie, ou recusa explícita */ }
```
`admin/users:52`, `admin/users:231`, `analytics/insights:61`, `analytics/students/[studentId]:46`,
e `analytics/students/[studentId]:55` (`limit(tenantId ?? "global")`).

Ou seja: o novo dono não precisa inventar o padrão de migração dos 17 — precisa **copiar o que
cinco sítios já fazem**, decidindo em cada um se o tenant ausente vira fallback de cookie,
recusa explícita, ou balde compartilhado (`?? "global"`).

## Pergunta C — alguma das 15 DEPENDE do `""` para funcionar?

**Não. Nenhuma.** É preciso separar dois sentidos, porque a resposta difere:

| Sentido | Resposta |
|---|---|
| **Comportamental** — o `""` produz um desfecho CERTO que o `null` estragaria | **Nenhuma rota.** `""` não é uuid, não casa com nada, não é gravável: nunca é o valor certo. Em `integrations/keys` ele é ativamente errado, e `null` é o correto. Nas outras 14 os dois são equivalentes (razões a–f do censo). |
| **De compilação** — o sítio exige `string` e passaria a não compilar | **17 sítios**, listados acima. Isso é ruptura de tipo, não dependência comportamental: nenhum deles *quer* `""`, todos apenas nunca foram perguntados o que fazer sem tenant. |

**A distinção decide a recomendação.** Se houvesse um caso comportamental, corrigir na origem
seria trocar um defeito por outro e eu recomendaria contra. Não há. Os 17 são trabalho, não
risco — e são justamente onde o compilador vai **forçar uma decisão que hoje é tomada por
omissão**, que é o ganho inteiro da mudança.

## Pergunta D — quantas das 15 deixam de precisar de tratamento local?

**Uma: `integrations/keys`.** Reafirmo com a ressalva que já registrei, porque ela é
contraintuitiva: o valor da correção na origem **não** é remover contornos existentes (só há
um), é impedir o próximo. As duas de `admin/users*` já eram defensivas por outro motivo e não
mudam.

## O que eu faria no lugar dele, em ordem

1. Trocar para `tenant_id: profile.tenant_id ?? null`, tipo `string | null`.
2. Rodar `tsc --noEmit` e usar a lista de erros como checklist — deve bater com os 17 acima. **Se
   der um número diferente de 17, algo mudou na árvore desde 2026-08-30 20:15 e vale reconferir
   antes de seguir.**
3. Em cada um dos 17, aplicar a receita que já existe (`|| null` + estreitamento), decidindo
   explicitamente o desfecho do tenant ausente.
4. Em `integrations/keys/route.ts`, **apagar** o `profile.tenant_id === "" ? null : …` do helper
   local — vira redundante. O CP `[CP] admin SEM tenant continua barrado de criar chave de
   plataforma` deve continuar **verde** depois de apagá-lo; se ficar vermelho, a correção na
   origem não está completa.
5. `requireFeature` merece decisão própria: hoje um tenant nulo produz `22P02` → 503
   `feature_check_unavailable`, que é o desfecho certo por acidente. Com `string | null` ele pode
   dizer isso de propósito.

## Comandos de evidência

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2

pnpm --filter @eximia/web test src/app/api/ingestion                                   # 57/57
pnpm --filter @eximia/web test src/app/api/__tests__/perfil-ilegivel-nao-e-negacao-avulsas.test.ts  # 75/75
pnpm --filter @eximia/web exec tsc --noEmit                                            # limpo
git diff --stat apps/web/src/lib/api-role-guard.ts                                     # vazio

# a anulabilidade que define a população em risco
grep -n "tenant_id DROP NOT NULL" supabase/migrations/20260209000000_epic11_super_admin_whitelabel.sql

# toda coluna tenant_id é uuid (nenhuma text/varchar)
grep -rhn "tenant_id[[:space:]]\+\(uuid\|text\|varchar\)" supabase/migrations/*.sql | wc -l
```
