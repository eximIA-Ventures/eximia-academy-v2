# FIX-B6 — corrigir o "perfil ilegível vira 403" NA ORIGEM

> Frente irmã de FIX-B/B2/B3/B4 (que corrigiram 47 rotas via `lib/api-role-guard.ts`).
> Esta frente NÃO toca `api-role-guard.ts`. Ela trata os **outros dois helpers** que
> carregam o mesmo defeito e que as varreduras anteriores não viram, e faz o censo
> por MECANISMO que faltava.
>
> Escrito incrementalmente (houve 5 quedas de conexão nesta sessão).

---

## 0. O achado que motivou a frente

Três censos seguidos erraram porque foram feitos **pela forma do texto**. Todos
procuravam `const { data: profile }`. O segundo helper escreve `const { data }` —
e por isso ficou invisível três vezes.

A lição operacional, registrada antes de qualquer correção:

> **Censo de defeito de autorização se faz pelo MECANISMO ("quem lê a tabela de
> usuários e decide direito"), nunca pela grafia da linha.** Um censo por string é
> uma amostra com cara de censo.

---

## 1. Censo por MECANISMO — o método

Em vez de procurar a grafia, procurei o **gesto**: um arquivo que lê `users`
filtrando pelo **próprio id do chamador** (`.eq("id", user.id)`) e usa o resultado
para conceder ou negar. Essa é a assinatura da decisão de autorização, escreva-se
ela como se escrever.

Detector: `/tmp/b6-censo.mjs` (varredura + janela de 20 linhas em torno de cada
`from("users")`, classificando por autoleitura / seleção de `role` / captura do
`error`).

**Resultado bruto: 94 autoleituras de perfil em 74 arquivos.** Destas, as que
selecionam `role` (portanto decidem papel) são o universo de risco.

> Nota de honestidade sobre o instrumento: o detector marca "SEM-ERRO" por
> heurística de regex e tem falso-positivo conhecido — `lib/api-role-guard.ts`
> aparece como "SEM-ERRO" porque a anotação de tipo (`const { data: profile, error }:
> RespostaDePerfil = await ...`) quebra o padrão, e aquele arquivo **captura** o erro.
> Por isso todo item classificado abaixo foi conferido **à mão**, arquivo a arquivo.
> A varredura serve para não perder nada; ela não emite veredito.

---

## 2. A resposta à pergunta "existe um quarto caminho?"

**Sim. Existem pelo menos SEIS caminhos distintos de decisão de papel nesta base**,
e a auditoria até aqui tinha visto dois.

| # | Mecanismo | Onde | Estado |
|:--|:---|:---|:---|
| 1 | `requireRole` | `lib/api-role-guard.ts` | **corrigido** (FIX-B/B2/B3/B4, 47 rotas) — não é minha |
| 2 | `requireAdmin` / `requireAdminOrManager` | `lib/api-auth/require-admin.ts` | **defeituoso** → corrigido nesta frente |
| 3 | `requireSuperAdmin` | `lib/super-admin-auth.ts` | **defeituoso** → corrigido nesta frente |
| 4 | `getAuthProfile` + `hasAnyRole` (o erro existe, o chamador descarta) | `lib/auth.ts` + consumidores | **defeituoso nos chamadores** → §5 |
| 5 | **guard local, escrito à mão dentro do próprio arquivo** | `lib/course-management-guard.ts`, `admin/plans/actions.ts`, `admin/manager-groups/actions.ts` e outros | **defeituoso** → §6 |
| 6 | **`middleware.ts`** — decide papel antes de qualquer rota | `src/middleware.ts:284` | ver §6 |

O caminho 5 é o mais perigoso dos seis, porque não tem nome: são leituras de perfil
escritas inteiras dentro do arquivo que as usa. Nenhuma busca por nome de helper as
encontra — só a busca pelo gesto.

---

## 3. Correção na origem — os 2 helpers

### 3.1 O que mudou

Ambos ganharam o **terceiro estado**, com o contrato **importado**, não recopiado:
`ProfileCheckUnavailableBody` vem de `lib/api-role-guard.ts` por `import type`. Se
alguém mudar o corpo do 503 lá, o `tsc` acusa aqui — que é exatamente o efeito
desejado. `ZERO_LINHAS` (`"PGRST116"`) ficou duplicado como constante local com
ponteiro no comentário, porque **não é exportado** por `api-role-guard.ts`
(ver §8, item para o dono daquele arquivo).

| Desfecho | Status | Corpo | Header |
|:---|:---|:---|:---|
| Sem sessão | 401 | `{"error":"Unauthorized"}` | — |
| Sem perfil **ou** chapéu fora do conjunto | 403 | `{"error":"Forbidden"}` | — |
| **Leitura falhou** | **503** | `{"error":"profile_check_unavailable"}` | `Retry-After: 5` |

Os corpos de 401/403 são **transcrição literal** do que as rotas já devolviam.
Nenhuma resposta que existe hoje mudou de forma.

`lib/super-admin-auth.ts` tem **uma assimetria deliberada**: em `switch-tenant` o
desfecho sem sessão é 403 `"Permissão negada"`, não 401. Isso é um **segundo
defeito**, e ficou **preservado de propósito** — corrigir contrato de resposta de
carona num fix de tratamento de erro esconderia a mudança dentro da correção.
Está travado por teste (`sem sessão CONTINUA 403`) e registrado em §8 como achado
para o dono do produto. Mesma decisão que `api/integrations/keys` tomou na frente irmã.

### 3.2 A propagação — o risco que foi nomeado antes de acontecer

O perigo era: o helper distingue os três estados e os **22 chamadores continuam
colapsando tudo em 403** um andar acima. A defesa foi **estrutural, não disciplinar**:
em vez de acrescentar um `if` que dá para esquecer, o helper passou a devolver a
recusa **pronta**, e o chamador ficou com **menos** linhas do que antes:

```
- const { user, profile } = await requireAdmin(supabase)
-
- if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
- if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
+ const { user, profile, recusa } = await requireAdmin(supabase)
+ if (recusa) return recusa
```

Não há terceiro estado para esquecer: ele não é um caso a mais no chamador, é o
mesmo `recusa`. E a união discriminada (`ResultadoDoGuardDeAdmin`) faz o `tsc`
estreitar `user`/`profile` para não-nulo depois do `return`, então quem esquecer
a linha **não compila**.

**25 handlers em 14 arquivos** foram convertidos por script (`/tmp/b6-propaga.mjs`,
com relatório de "SEM CASAMENTO" para o que não casasse — nada ficou de fora em
silêncio). Os **4 de forma própria** foram feitos à mão:

| Arquivo | Forma própria | Rotas que dependem |
|:---|:---|:---|
| `api/admin/users/bulk-invite/route.ts` | `{ ok:false, response }` | 1 |
| `api/admin/departments/_context.ts` | `{ ok:false, response }` | **3** (`departments`, `[id]`, `[id]/presence`) |
| `lib/invites/target.ts` | `{ ok:false, response }` | **2** (`resend-invite`, `revoke-invite`) |
| `api/admin/switch-tenant/route.ts` | `requireSuperAdmin` | 1 |

**Censo honesto do "22":** o briefing falava em 22 chamadores (17 diretos + 5
indiretos). O número real de arquivos que **importam** o helper é **17** (15 rotas
+ 2 helpers intermediários), somando **20 arquivos de rota** e **29 handlers HTTP**.
A diferença veio de dois falsos-positivos por **colisão de nome**, e os dois são
achados por si só:

- `api/admin/engagement/templates/route.ts` define uma função **local** chamada
  `requireAdminOrManager` que **não é** o helper — ela usa `getAuthProfile`. É o
  4º mecanismo, tratado em §5.
- `api/integrations/keys/route.ts` define `requireAdminOrSuper` local; **já foi
  corrigido** pela frente irmã (usa `requireRole`). Fora do meu escopo.

> Um censo por nome de função não distingue o helper compartilhado de um homônimo
> local. Foi assim que a conta deu 22 em vez de 20.

### 3.3 Vermelho, colado por família

Régua: `src/app/api/admin/__tests__/perfil-ilegivel-require-admin.test.ts`
(31 rotas × 3 asserções + 4 de `switch-tenant` = **97 testes**).

**Antes da correção — 32 falharam, 65 passaram.** As 32 são exatamente uma família,
e nenhuma outra:

```
Tests  32 failed | 65 passed (97)

AssertionError: expected 403 to be 503
 ❯ perfil-ilegivel-require-admin.test.ts:392  expect(resposta.status).toBe(503)

FAIL  ... > GET /api/admin/api-keys — falha ao LER o perfil devolve 503, não 403
FAIL  ... > POST /api/admin/api-keys — falha ao LER o perfil devolve 503, não 403
FAIL  ... > GET|PATCH|DELETE /api/admin/api-keys/[keyId] — ...
FAIL  ... > POST /api/admin/api-keys/[keyId]/rotate — ...
FAIL  ... > GET /api/admin/api-keys/[keyId]/usage — ...
FAIL  ... > GET|POST /api/admin/areas — ...
FAIL  ... > PATCH|DELETE /api/admin/areas/[areaId] — ...
FAIL  ... > GET|POST|DELETE /api/admin/areas/[areaId]/users — ...
FAIL  ... > GET /api/admin/audit-log — ...
FAIL  ... > POST /api/admin/departments — ...
FAIL  ... > PATCH /api/admin/departments/[departmentId] — ...
FAIL  ... > POST /api/admin/departments/[departmentId]/presence — ...
FAIL  ... > GET|PATCH /api/admin/users/[userId]/instructor-permissions — ...
FAIL  ... > POST /api/admin/users/[userId]/reset-password — ...
FAIL  ... > POST /api/admin/users/bulk-invite — ...
FAIL  ... > POST /api/admin/users/[userId]/resend-invite — ...
FAIL  ... > POST /api/admin/users/[userId]/revoke-invite — ...
FAIL  ... > GET|POST /api/admin/webhooks — ...
FAIL  ... > GET|PATCH|DELETE /api/admin/webhooks/[webhookId] — ...
FAIL  ... > GET /api/admin/webhooks/[webhookId]/deliveries — ...
FAIL  ... > POST /api/admin/webhooks/[webhookId]/test — ...
FAIL  ... > POST /api/admin/switch-tenant — ...   ← o outro helper
```

**Os 65 que já passavam importam tanto quanto os 32 que falhavam:** são o
`PGRST116 → 403` (que já estava certo e não podia regredir) e a **matriz de papéis
inteira**, que confirma que as listas transcritas no teste são as de `HEAD` — a
correção não alargou nem estreitou acesso nenhum.

**Depois da correção: 97 de 97 verdes.**

### 3.4 Prova por mutação — o CP mata o mutante?

Um teste que fica verde sob mutação é decoração. Três mutantes, três mortes:

| # | Mutação | Resultado |
|:--|:---|:---|
| 1 | `ADMIN_HATS` ganha `"manager"` (alargamento silencioso de acesso) | **26 falharam** — o `manager` é o eixo que distingue as duas listas |
| 2 | A checagem `if (error && error.code !== ZERO_LINHAS)` removida de `require-admin.ts` (o defeito original, restaurado) | **31 falharam** |
| 3 | A mesma checagem neutralizada em `super-admin-auth.ts` | **1 falhou** — a única rota que depende dele |

O mutante 1 é o que responde ao alerta da frente irmã ("mutar a lista de papéis
deixa 30 de 31 verdes"). Aqui ele mata 26 testes porque a matriz é **exaustiva nos
dois sentidos**: cada papel aceito entra, cada papel recusado não entra. Um CP com
"um aceito e um recusado" teria ficado verde.

---

## 4. `getAuthProfile` — o censo dos 129, classificado

O briefing falava em "129 consumidores que ninguém mediu". O número está certo, e a
classificação mostra que ele é **enganoso**: 30 dos 129 nem são consumidores.

| Classe | Nº | O que é |
|:---|---:|:---|
| A definição | 1 | `lib/auth.ts` |
| Testes | 29 | não é caminho de produção |
| **Capturam o `error`** | **4** | já corretos: `dashboard/page.tsx`, `meu-plano/page.tsx`, `jornada/page.tsx`, `api/analytics/plan-dashboard` |
| **Descartam o `error`** | **95** | o universo de risco |

Os 95 que descartam, por onde o defeito se manifesta:

| Onde | Nº | Como o defeito aparece | Nesta rodada |
|:---|---:|:---|:---|
| **Rotas de API** | **23** | status HTTP de negação permanente (401/403) para falha transitória | **22 corrigidas** |
| Server actions / loaders | 8 | string `"Acesso negado"` na tela, sem distinguir a causa | mapeadas, §7 |
| Páginas (server components) | 50 | **`redirect()` para fora da área** — o admin é expulso em silêncio | mapeadas, §7 |
| Não decidem papel (só exibem) | 14 | nenhum | fora de risco |

### 4.1 A rota que ficou de fora, declarada

`api/analytics/aprendizagem-time/classify/route.ts` é a 23ª e **não foi tocada**:
está sendo editada por outra frente nesta mesma sessão (aparece como `M` no
`git status`). Editá-la seria colisão. **Fica para o dono daquele arquivo.**

### 4.2 Correção: uma função, não um wrapper

`lib/api-auth/perfil-de-sessao.ts` (novo) expõe `recusaSePerfilIlegivel(erro, contexto)`,
que devolve o 503 ou `null`. **`lib/auth.ts` não foi tocado** — 129 arquivos
dependem da forma de retorno de `getAuthProfile`, e mudá-la para consertar 22
seria alterar o pior blast radius disponível. O uso são duas linhas:

```ts
const { user, profile, error: erroDePerfil } = await getAuthProfile()
const indisponivel = recusaSePerfilIlegivel(erroDePerfil, "/api/…")
if (indisponivel) return indisponivel
```

O alias `error: erroDePerfil` **não é estilo**: quase toda rota destas já tem um
`error` local vindo da própria query de dados, algumas linhas abaixo. Destructurar
como `error` sombrearia o outro, e o sombreamento aconteceria em silêncio.

**25 handlers em 21 arquivos** por script (`/tmp/b6-gap-fix.mjs`), que só injeta
onde a linha seguinte **já é o portão de perfil** — e **imprime o que pulou**.
Pulou exatamente um caso, corretamente: a **segunda** chamada a `getAuthProfile()`
em `engagement/overview/route.ts:55`, que está dentro de um trecho já autorizado.
Um `+22` cego teria inserido uma checagem morta ali.

O 22º arquivo (`admin/engagement/templates/route.ts`) foi feito à mão porque o
`getAuthProfile` dele vive num **helper local homônimo** que devolve
`{user, profile, tenantId}`, não uma `Response`. Ali o terceiro estado saiu por
**campo próprio** (`indisponivel`), e não colapsado nos `null` das outras recusas
— colapsá-lo seria reintroduzir o defeito um andar acima, no mesmo arquivo.

### 4.3 Vermelho da família `getAuthProfile`

Régua: `src/app/api/__tests__/perfil-ilegivel-getauthprofile.test.ts` (26 handlers ×
3 = **78 testes**).

**Antes: 26 falharam, 52 passaram** — uma família só:

```
Tests  26 failed | 52 passed (78)
AssertionError: expected 403 to be 503

FAIL ... POST /api/admin/areas/[areaId]/courses — falha ao LER o perfil devolve 503, não 403
FAIL ... POST|PATCH|DELETE /api/admin/tenants[/…] (5 handlers) — ...
FAIL ... POST /api/admin/engagement/campaign — ...
FAIL ... GET /api/admin/engagement/history — ...
FAIL ... GET /api/admin/engagement/suggestions — ...
FAIL ... POST /api/admin/engagement/suggestions/generate — ...
FAIL ... PATCH /api/admin/engagement/suggestions/[id] — ...
FAIL ... GET|PATCH /api/admin/engagement/templates — falha ao LER … devolve 503, não 401
FAIL ... POST /api/leader/comments — ...
FAIL ... GET /api/engagement/students — ...
FAIL ... POST /api/engagement/action — ...
FAIL ... POST /api/engagement/campaign — ...
FAIL ... GET|PATCH /api/engagement/campaign/[id] — ...
FAIL ... GET /api/engagement/history — ...
FAIL ... GET /api/engagement/templates — ...
FAIL ... PATCH /api/engagement/templates/[id] — ...
FAIL ... GET /api/engagement/overview — ...
FAIL ... GET /api/analytics/manager — ...
FAIL ... POST /api/analytics/manager/nudge — ...
```

**Depois: 78 de 78 verdes.**

> **A primeira escrita desta régua estava errada, e o vermelho é que mostrou.**
> Ela usava UM campo `negacao` por rota, presumindo que "sem perfil" e "papel
> errado" saem pelo mesmo status. Não saem: nas rotas de engagement o `!profile`
> é **401** e o papel errado é **403**. A rodada vermelha acusou 43 falhas em vez
> de 26 — as 17 extras eram defeito **do meu teste**, não do produto. A régua foi
> partida em `semPerfil` e `papelErrado`, e só então o vermelho ficou limpo.
> Registro isto porque é o mesmo tipo de erro que a auditoria persegue: um
> instrumento que responde com precisão a uma pergunta que não é a pergunta.

### 4.4 Mutação nesta família

| # | Mutação | Resultado |
|:--|:---|:---|
| 4 | `recusaSePerfilIlegivel` sempre devolve `null` (o defeito restaurado) | **26 falharam** |
| 5 | `PGRST116` deixa de ser exceção e vira 503 também (sobre-correção) | **26 falharam** |

O mutante 5 importa tanto quanto o 4: ele prova que a régua não aceita "503 para
tudo". Um teste que só exigisse "não é 403" ficaria verde com a sobre-correção, e
o usuário órfão passaria a receber "tente de novo" para sempre.

---

## 5. Os 3 mecanismos que ninguém tinha visto

Além dos dois helpers do briefing, o censo por gesto achou:

**(a) `getAuthProfile` com o erro descartado no chamador** — §4. 95 arquivos.

**(b) Guards locais escritos à mão dentro do próprio arquivo.** Não têm nome, então
nenhuma busca por helper os encontra. Os que decidem papel e descartam o erro:

| Arquivo | Papéis | Desfecho hoje |
|:---|:---|:---|
| `(platform)/admin/plans/actions.ts:82` | `admin`, `super_admin` | `{ error: "Acesso negado" }` |
| `(platform)/admin/manager-groups/actions.ts:102` | `admin`, `super_admin`, `manager` | `{ error: "Acesso negado" }` |
| `(platform)/admin/users/enrollment-actions.ts:51,101` | — | server action |
| `lib/course-management-guard.ts:48` | — | **corrigido pela frente FIX-B8** nesta mesma rodada |

**(c) `middleware.ts:283` e `:306`** — o mais alto da pilha e o de consequência
mais estranha. Ver §6.

## 6. `middleware.ts` — registrado, NÃO corrigido (decisão sua)

```ts
const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle()
userRole = profile?.role ?? null           // ← o error nunca é lido
…
const { data: hatRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id)
const hats = (hatRows ?? []).map((r) => r.role)
effectiveHats = hats.length > 0 ? hats : userRole ? [userRole] : []
```

Duas leituras, dois `error` descartados. Se qualquer uma falhar, `effectiveHats`
fica **`[]`** — e `[]` não é "sem permissão", é "não deu para saber". O que
acontece a seguir, no mesmo arquivo:

| Linha | Efeito com `effectiveHats = []` |
|:---|:---|
| 357 | `/instructor` → redirect para `/dashboard` |
| 367 | `/super-admin` → redirect |
| 383 | área admin → redirect |

**O modo de falha aqui não é 403, é expulsão silenciosa.** Um admin com um soluço
de banco não recebe erro nenhum: ele simplesmente se vê no `/dashboard`, e vai
achar que perdeu o acesso.

**Por que não corrigi:** o remédio das rotas (503 + `Retry-After`) não se traduz
para middleware — devolver 503 ali derruba a navegação inteira, e a alternativa
(deixar passar e confiar no guard da página) **alarga acesso**. É decisão de
produto sobre o que o usuário deve ver quando o banco não responde, não conserto
mecânico. Além disso, `middleware.ts` é o arquivo de maior blast radius do app e
não está no meu escopo. **Registrado para o Senhor decidir.**

## 7. O recorte declarado — o que NÃO foi corrigido

Volume honesto: das 95 ocorrências do 4º mecanismo, **22 foram corrigidas** (todas
as rotas de API livres). As **73 restantes** ficam mapeadas, e o motivo não é
cansaço:

**58 são páginas e loaders de server component.** Nelas o defeito não produz um
status HTTP, produz um `redirect()` — o mesmo modo de falha do middleware (§6), e
com a mesma pergunta de produto sem resposta: *o que a tela deve mostrar quando não
se conseguiu ler o perfil?* Uma tela de erro retentável? Um estado vazio? Aplicar
`recusaSePerfilIlegivel` ali é impossível (não há `Response` para devolver), e
inventar um terceiro comportamento de UI sem decisão sua seria exatamente o
"terceiro dialeto" que este relatório evita.

Lista completa (arquivo a arquivo) reproduzível por `node /tmp/b6-gap2.mjs`, e
resumida em §4. Os 8 loaders/actions administrativos de maior risco:

```
(platform)/admin/settings/actions.ts        (platform)/admin/settings/loader.ts
(platform)/admin/settings/whitelabel-actions.ts   (platform)/admin/plans/loader.ts
(platform)/admin/users/loader.ts            (platform)/admin/job-roles/actions.ts
(platform)/admin/manager-groups/loader.ts   (platform)/admin/visao-geral/loader.ts
```

**Recomendação:** tratar páginas + middleware como **uma decisão de produto só**
("o que a tela faz quando o perfil não pôde ser lido"), numa frente própria. São o
mesmo problema, e resolvê-los em pedaços produziria comportamentos divergentes de
tela para tela.

## 8. Achados para o dono do produto (registrados, não corrigidos)

1. **`switch-tenant` devolve 403 para "sem sessão"**, onde as 20 rotas irmãs
   devolvem 401. Preservado 1:1 e travado por teste. Corrigir muda contrato de
   resposta e merece decisão explícita.
2. **`admin/engagement/templates` colapsa 401 e 403** — papel insuficiente recebe
   `Unauthorized`, não `Forbidden`. Preservado e travado.
3. **`admin/engagement/*` NÃO aceita `super_admin`**, enquanto as rotas irmãs de
   `engagement/*` aceitam. Pode ser deliberado, pode ser esquecimento. **Não
   mexi**, mas está travado pelo CP: se alguém "consertar" sem decidir, o teste
   avisa.
4. **`ZERO_LINHAS` (`"PGRST116"`) está definido em 3 lugares** — `api-role-guard.ts`
   (não exportado), `require-admin.ts` e `perfil-de-sessao.ts`. Sugiro **exportá-lo
   de `api-role-guard.ts`** e importar nos outros dois. Não fiz porque
   `api-role-guard.ts` **não é meu nesta rodada** — pedido ao dono dele.
5. **`api/analytics/aprendizagem-time/classify`** continua com o defeito (§4.1).

## 9. Verificação

| Comando | Resultado |
|:---|:---|
| `pnpm --filter @eximia/web test src/app/api` | **44 arquivos, 917 testes, 0 falhas** |
| `pnpm --filter @eximia/web exec tsc --noEmit` | **0 erros** |
| `git diff --name-only \| grep -c api-role-guard` | **0** |
| `biome check`, arquivo a arquivo, nos 41 tocados | limpo (cada um "Checked 1 file" — nunca a forma vácua) |

**Sobre o baseline:** o briefing citava "38 arquivos, 589 testes". Ao começar, a
árvore já estava em 41/826 e havia **2 vermelhos que não eram meus** (frente
FIX-B8, arquivo não rastreado `course-manager-ilegivel-nao-e-negacao.test.ts`, red
test aguardando o próprio fix) e **4 erros de `tsc`** na mesma frente. Ambos se
resolveram quando aquela frente fechou. Registro porque um `git status` colhido em
árvore compartilhada mede o trabalho dos vizinhos junto com o meu.

**Sobre o `biome`:** a forma `biome check <caminho fora do projeto>` roda **vazia**
e não acusa nada. Um probe em `/tmp` foi tentado, devolveu zero arquivo, e foi
descartado — toda checagem aqui confere "Checked N file" com N > 0.

**Duas correções cosméticas declaradas:** `switch-tenant/route.ts` tinha
`format` + `organizeImports` pendentes em linhas que **não** toquei (o
encadeamento `service.from("tenants")…`, e a ordem dos imports). Como eu já
estava no arquivo, rodei o formatador — são 2 linhas fora do defeito.

## 9.1 Adendo — a constraint de banco achou um mutante VIVO na minha régua

Depois de fechar §3–§8, a coordenação trouxe uma invariante de banco apurada em
frente irmã (`20260209000000_epic11_super_admin_whitelabel.sql`, conferida em
disco, nunca derrubada):

```sql
CHECK ((role = 'super_admin' AND tenant_id IS NULL)
    OR (role != 'super_admin' AND tenant_id IS NOT NULL))
```

É uma **bicondicional**: `role = 'super_admin'` ⟺ `tenant_id IS NULL`. As minhas
duas fixtures a violavam — na direção **oposta** à que o aviso descrevia: elas
davam `tenant_id: TENANT` a **todos** os papéis, inclusive `super_admin`, montando
uma linha que o banco recusa gravar.

**Nota de precisão:** a constraint é sobre a **coluna** `users.role`, não sobre os
chapéus de `user_roles`. Um `users.role = 'instructor'` com chapéu `super_admin`
é perfeitamente legal e **tem** tenant. Como nas fixtures os dois eixos carregam o
mesmo papel, a amarra vale ali.

Corrigidas as fixtures, **os 175 testes continuaram verdes** — o que sozinho não
é conclusão nenhuma. Então medi se `tenant_id` era sequer load-bearing: pondo
`null` para todos os papéis, **2 testes quebram** (`admin/engagement/templates`),
e quebram por `admin` com tenant nulo — que a constraint também proíbe. Isto é, o
próprio probe era ficcional. Mas ele expôs uma coisa real:

> **`super_admin` estava sendo recusado em `admin/engagement/templates` por DUAS
> razões ao mesmo tempo** — não estar na lista de papéis, *e* não ter empresa
> resolvível (tenant nulo, sem cookie de seletor no mock). Uma asserção
> sobre-determinada não discrimina.

**Mutante 6, lançado para provar:** acrescentar `"super_admin"` a
`TEMPLATE_MANAGEMENT_ROLES`.

| Estado da régua | Resultado do mutante 6 |
|:---|:---|
| Fixture original (sem cookie de seletor) | **SOBREVIVEU** — 78/78 verdes |
| Fixture corrigida (cookie preenchido) | **MORREU** — 2 falharam |

Ou seja: um **alargamento de acesso** (o `super_admin` ganhando escrita nos
templates de uma empresa) teria atravessado a minha régua em silêncio. A correção
foi preencher o cookie `x-sa-active-tenant` nos dois mocks de `next/headers` — que
é também o estado **real** de produção, porque é assim que o admin global escolhe
a empresa em que opera. Com a empresa sempre resolvida, a única razão que resta
para uma recusa é o papel, que é o que o CP se propõe a medir.

Aplicado às duas réguas. Mutante 1 (`manager` em `ADMIN_HATS`) continua matando 26.

**A lição, que é a mesma do aviso, com um giro:** mutação bem mirada sobre estado
inexequível não prova nada — mas *consertar* o estado para o exequível pode
revelar que a asserção nunca discriminou. Não bastou trocar a fixture e ver verde;
foi preciso lançar o mutante nos **dois** estados para saber qual deles media algo.

## 10. Placar

| | |
|:---|---:|
| Helpers corrigidos na origem | **2** |
| Handlers HTTP com o terceiro estado propagado (família `requireAdmin`) | **29** |
| Handlers HTTP corrigidos (família `getAuthProfile`) | **27** |
| Arquivos de rota tocados | **36** |
| Testes novos | **175** (97 + 78) |
| Mutantes lançados / mortos | **6 / 6** (o 6º estava VIVO até §9.1) |
| Mecanismos de decisão de papel achados | **6** (2 no briefing, 4 no censo) |
| Corrigidos nesta rodada | **3** (+1 pela frente FIX-B8) |
| Registrados, não corrigidos | **2** (middleware, guards locais de server action) |
