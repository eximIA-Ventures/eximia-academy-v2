# FIX-B7 — O guard irmão, para quem decide pela união de chapéus

> Escopo: `apps/web/src/lib/api-role-guard.ts` (`requireAnyRole`) e as 5 rotas que
> ficaram de fora das 47 corrigidas por `requireRole`.
> Método: vermelho antes, correção depois, verde no fim. Matriz de papéis, nunca amostra.

---

## 1. Por que estas cinco ficaram de fora, e por que a recusa foi certa

As 47 rotas anteriores decidem pelo **papel singular** (`users.role`). Estas cinco
decidem (ou leem) pela **união de chapéus** — a tabela `user_roles`, múltiplos papéis
por pessoa. Aplicar `requireRole` nelas negaria acesso a todo membro multi-chapéu: um
gestor que também é aluno tem `users.role = "student"`, e levaria 403 **sempre**, não
só sob falha transitória. Dois agentes recusaram tocá-las. A recusa estava correta.

O que faltava nelas não era o critério de papel — era a separação que `requireRole` já
tinha estabelecido:

| Situação | Resposta | Sinal |
|:---|:---|:---|
| A leitura funcionou e o veredito é "não" | **403** `Forbidden` | sem header |
| Zero linhas (`PGRST116`) | **403** — a leitura aconteceu | sem header |
| A leitura **falhou** (ex.: `57014`, timeout de statement) | **503** `profile_check_unavailable` | `Retry-After: 5` |

As cinco despachavam **403 para os três casos**. Um gestor legítimo, num timeout,
lia "Forbidden".

---

## 2. O achado que muda o desenho: `analytics/aggregate` NÃO decide pela união

A briefing listava as cinco como "decidem pela união de chapéus". Conferido contra
`HEAD`, linha a linha, **quatro decidem; a quinta não**.

`apps/web/src/app/api/analytics/aggregate/route.ts`, em `HEAD`, linha 701:

```ts
if (
  !profile?.role ||
  !["leader", "manager", "admin", "instructor", "super_admin"].includes(profile.role)
) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}
```

`profile.role` — **papel singular**. A união (`user_roles`) aparece só **depois** do
portão, e serve para decidir **escopo** (tenant-wide vs. subárvore do gestor), não
acesso.

**Consequência prática:** migrar o portão dela para a união teria **alargado o acesso
em silêncio**. Um usuário com `users.role = "student"` e chapéu de `manager` leva 403
hoje e passaria a entrar. É exatamente o modo de falha registrado em rodada anterior
(uma lista de papéis trocada sobreviveu a 30 de 31 testes).

Por isso `requireAnyRole` recebe a **fonte da decisão explícita**, e não a infere:

```ts
requireAnyRole(supabase, user.id, PAPEIS_DO_AGREGADO, { decidirPor: "papel_singular" })
```

O default é `"uniao_de_chapeus"`. `aggregate` é a única chamada com o outro valor, e o
motivo está escrito no ponto da chamada.

---

## 3. As três listas de papéis, conferidas contra `HEAD`

| Rota | `HEAD` | Fonte do portão | Aceitos | Recusados |
|:---|:---|:---|:---|:---|
| `POST /api/notifications/nudge` | linha 28 | união | `instructor, manager, admin, super_admin` | `student, leader` |
| `GET /api/admin/notifications` | linha 29 | união | `admin, manager, instructor, super_admin` | `student, leader` |
| `POST /api/admin/notifications` | linha 73 | união | `admin, manager, instructor, super_admin` | `student, leader` |
| `GET /api/analytics/semantic` | linha 57 | união | `instructor, admin, super_admin` | `student, leader, manager` |
| `GET /api/analytics/aggregate` | linha 701 | **singular** | `leader, manager, admin, instructor, super_admin` | `student` |

**`student` é recusado pelas cinco — logo `student` não discrimina nada.** Um controle
positivo com um aceito e um recusado (`admin` + `student`) fica verde com qualquer uma
das três listas no lugar de qualquer outra. Quem discrimina é:

- **`manager`** — recusado só em `semantic` (portão LGPD do perfilamento por aluno).
- **`leader`** — aceito só em `aggregate`.

A régua afirma **todos os seis papéis do universo** (`packages/shared` → `type Role`),
um a um, em cada uma das cinco rotas. Nenhuma amostra.

---

## 4. Vermelho colado, antes de qualquer edição

`apps/web/src/app/api/__tests__/perfil-ilegivel-nao-e-negacao-uniao.test.ts`, contra o
código intocado:

```
Test Files  1 failed (1)
     Tests  5 failed | 45 passed (50)

× POST /api/notifications/nudge  > leitura de perfil que FALHA devolve 503 → expected 403 to be 503
× GET  /api/admin/notifications  > ...                                     → expected 403 to be 503
× POST /api/admin/notifications  > ...                                     → expected 403 to be 503
× GET  /api/analytics/semantic   > ...                                     → expected 403 to be 503
× GET  /api/analytics/aggregate  > ...                                     → expected 403 to be 503
```

**Exatamente 5 falhas, uma por rota, todas do mesmo defeito.** Os outros 45 casos
(matriz completa de papéis + fonte da decisão) já passavam contra `HEAD` — é a prova de
que a régua descreve o comportamento existente com fidelidade antes de eu mexer nele.
Se um caso da matriz tivesse falhado no vermelho, seria sinal de que eu tinha escrito a
lista errada.

Além do 503, a régua trava dois pares que se anulam:

| Caso | União (4 rotas) | Singular (`aggregate`) |
|:---|:---|:---|
| singular `student` + chapéu aceito | **entra** | **403** |
| singular aceito + chapéu `student` | **403** | **entra** |

O primeiro par impede que alguém migre `aggregate` para a união (alargamento). O
segundo impede que alguém migre as outras quatro para o guard singular (o defeito que
motivou a recusa original).

---

## 5. Verde no fim

```
Test Files  1 passed (1)
     Tests  50 passed (50)
```

Suíte inteira de `src/app/api`, ao final da rodada:

```
Test Files  42 passed (42)
     Tests  831 passed (831)
```

O baseline da briefing (38 arquivos / 589 testes) cresceu para 42 / 831 porque outras
frentes adicionaram testes na mesma árvore durante a rodada. **Zero regressão.**

Numa medição intermediária a suíte marcava `2 failed | 824 passed`, ambas em
`src/app/api/courses/[courseId]/__tests__/course-manager-ilegivel-nao-e-negacao.test.ts`
— diretório então **untracked**, vermelho de outra frente ainda sem a correção. As rotas
que ele exercita passam por `lib/course-management-guard.ts`, guard que não é meu. A
frente fechou o vermelho durante a rodada e a suíte voltou a 100%. Registro aqui porque a
medição intermediária consta do histórico.

`tsc --noEmit`: **zero erros** em toda a `apps/web`.

`biome check` nos 7 arquivos tocados: **`Checked 7 files`** (contagem > 0, não é a forma
vácua que devolve `internalError/io`), 1 erro — `lint/style/noNonNullAssertion` em
`resend!.emails.send`, presente em `HEAD` linha 155, anterior a mim e fora do escopo.

---

## 6. Tarefa 2 — `tenant_id: profile.tenant_id ?? ""` na origem

> **Esta seção foi reescrita.** A primeira versão dava um veredito baseado numa avaliação
> de risco que **eu superestimei**. O censo da frente irmã corrigiu a premissa, eu
> verifiquei a correção por conta própria contra as migrations, e ela procede. O que
> segue é o registro corrigido, com o erro preservado — apagá-lo esconderia como a
> conclusão errada parecia sólida.

### Veredito: a troca fica **DIFERIDA**, e o motivo é **sequenciamento**, não perigo

O mérito da troca está de pé: `""` nunca é tenant válido, ele só silencia um erro de
tipo, e o sinal mais forte é o código se defendendo do próprio tipo — **duas rotas
escrevem `|| null` contra um campo declarado `string`**. O ganho é o `tsc` passar a
**enumerar** os sítios em vez de alguém grepar: prevenção do próximo caso, não limpeza
dos atuais.

O que a adia: o diff é largo e o `tsc` fica **vermelho até o último sítio**. Com mais de
uma frente escrevendo em helpers de autorização ao mesmo tempo (`require-admin.ts`,
`super-admin-auth.ts`, `getAuthProfile`), um `tsc` vermelho compartilhado destrói a rede
de segurança de todas de uma vez. É uma **mudança atômica única, depois que as frentes
fecharem**.

### 6.1 O que o `tsc` enumera

Trocando `PerfilDeRota.tenant_id` para `string | null`:

```
   5 src/app/api/course-designer/generate/route.ts
   4 src/lib/__tests__/course-management-guard.test.ts
   2 src/app/api/course-designer/blueprints/[blueprintId]/apply/route.ts
   2 src/app/api/course-designer/audit-course/route.ts
   2 src/app/api/course-designer/analyze-content/route.ts
   2 src/app/api/course-designer/ai-fill/route.ts
   1 src/lib/super-admin-auth.ts          ← de outra frente nesta rodada
   1 src/app/api/courses/route.ts
   1 src/app/api/courses/[courseId]/generate-questions/route.ts
   1 src/app/api/course-designer/blueprints/route.ts
   1 src/app/api/course-designer/blueprints/[blueprintId]/route.ts
   1 src/app/api/analytics/sessions/[sessionId]/route.ts
   1 src/app/api/admin/books/_guard-do-acervo.ts
   ── 24 erros em 13 arquivos
```

Sítios mecânicos (`limiter.limit(string)`, `requireFeature(string)`). Volume alto, risco
baixo, corrigíveis um a um. **É este o tamanho do trabalho**, e é ele que exige janela
exclusiva.

### 6.2 O erro que eu cometi, e o que o desfez

Encontrei um mecanismo que a lista de operadores divergentes do enunciado original não
citava. `""` e `null` são **ambos falsy** — `if (!x)` não separa os dois. Divergem `x ??
fb`, `x === null` / `!= null`, `?.` **e — o que faltava — `y !== x` contra um `y`
anulável**. E é essa forma que carrega as travas de isolamento entre tenants:

```
null !== ""    → true   → NEGA
null !== null  → false  → PASSA
```

O `tsc` é **cego** a essas linhas: os dois lados seguem comparáveis, o tipo não muda,
nenhum erro é emitido. Localizei 5 sítios nessa forma e concluí que a troca abriria 5
buracos de autorização. **Errado**, e o que desfaz é a alcançabilidade.

`supabase/migrations/20260209000000_epic11_super_admin_whitelabel.sql`, nunca derrubada:

```sql
ALTER TABLE users ADD CONSTRAINT users_super_admin_tenant_check
  CHECK ((role = 'super_admin' AND tenant_id IS NULL)
      OR (role != 'super_admin' AND tenant_id IS NOT NULL));
```

É uma **invariante de banco**, não uma convenção observada. Logo `role != 'super_admin'`
implica `tenant_id IS NOT NULL`, e **o `""` só chega a ser produzido onde `super_admin`
está na lista de papéis**. Conferindo os 5 sítios:

| Sítio | Lado esquerdo vem de | Lista de papéis | `super_admin`? |
|:---|:---|:---|:---:|
| `api/blueprint/generate:38` | corpo da requisição | `PAPEIS_CONTEUDO` = manager, admin, instructor | **não** |
| `api/blueprint/job/[jobId]:56` | banco | manager, admin, instructor | **não** |
| `api/chapters/[chapterId]/generate-audio:41` | banco | manager, admin, instructor | **não** |
| `api/chapters/[chapterId]/slides/sync-audio:34` | banco | admin, manager, instructor | **não** |
| `api/chapters/[chapterId]/slides/generate-text:33` | banco | admin, manager, instructor | **não** |

**Nenhum dos cinco admite `super_admin`.** Nenhum deles pode receber um perfil com tenant
nulo. Os cinco estão absolvidos, e o censo bate: a única afetada é `integrations/keys`,
cujos papéis são `["admin", "super_admin"]` — exatamente a exceção que a constraint
permite.

O teste que eu havia escrito (`tenant-nulo-normalizado-nao-atravessa-trava.test.ts`)
montava um `manager` com `tenant_id: null` — um estado que **o banco recusa gravar**.
Ele passava por prova e era ficção. **Removido.** Mantê-lo seria pior que inútil: ficaria
vermelho quando alguém fizesse a troca atômica, e a pessoa acharia que quebrou uma trava
de segurança quando teria apenas contrariado um cenário impossível.

**O que sobrevive, e é a única coisa que valia:** o operador `!==` pertence ao critério de
varredura. Hoje nenhuma rota combina essa forma com `super_admin` na lista, mas se alguma
combinar, **o `tsc` não avisa**. Isto não contradiz o argumento de que a troca vale pela
enumeração — refina: a enumeração do compilador é necessária e **não é suficiente**.

### 6.3 O que ficou no lugar nesta rodada

1. **`requireRole` intocado no ponto do `tenant_id`** — segue `string` com `?? ""`, agora
   com o motivo real escrito no tipo: diferido por sequenciamento, com o censo (1 de 15) e
   o critério de varredura para quem for fazer a troca.
2. **`requireAnyRole` nasceu com `string | null`**, por ser novo e sem consumidor legado —
   a honestidade de tipo lá custa zero, e as 5 rotas já liam `profile.tenant_id` cru antes
   desta correção.
3. **A mitigação local em `integrations/keys`** (`profile.tenant_id === "" ? null : ...`)
   permanece. Quando a troca atômica acontecer, ela vira redundante e pode sair junto.

### 6.4 Roteiro para a troca atômica, quando as frentes fecharem

1. Janela exclusiva: nenhuma outra frente escrevendo em helper de autorização
   (`super-admin-auth.ts` está na lista dos 24).
2. Trocar `?? ""` por `?? null` e o tipo para `string | null`; resolver os 24 erros.
3. Antes de fechar, varrer por `!==` contra `tenant_id` anulável **em rotas cujo lista de
   papéis inclua `super_admin`** — a forma que o `tsc` não enumera. Hoje o conjunto é
   vazio; confirmar que continua.
4. Remover a mitigação local de `integrations/keys`, que passa a ser redundante.

### 6.5 Uma nota sobre o método, porque o erro foi instrutivo

A mutação que eu usei para "provar" os 5 buracos **funcionou mecanicamente e mesmo assim
não provava nada**, porque o fixture era inexequível. E antes disso houve um erro mais
grosseiro: a primeira tentativa trocou só o **tipo** (`string | null`) deixando o runtime
em `?? ""`, e devolveu **5 de 5 verdes** — mutante mal mirado é silêncio, não aprovação.

Dois modos de falha diferentes, no mesmo experimento: um mutante que não toca o valor, e
um mutante bem mirado sobre um estado que o sistema proíbe. O segundo é o mais perigoso,
porque produz vermelho convincente.
falsa garantia: ele estaria calado exatamente onde o defeito mora.

---

## 7. Duas correções de carona que o tipo honesto revelou

Ao trocar a query crua (tipada como `any` pelo join) pelo retorno tipado do guard, o `tsc`
apontou dois valores anuláveis que estavam sendo consumidos como se não fossem, em
`api/admin/notifications` POST:

| Site | O que acontecia | O que passa a acontecer |
|:---|:---|:---|
| `resolveCallerStudentScope(supabase, profile.tenant_id, ...)` — assina `string` | Um remetente sem tenant recebia `null` numa função que promete `string`; a busca de destinatários filtrava por `tenant_id` nulo, devolvia zero linhas, e a recusa saía como **400 "No valid recipients found"** | Recusa explícita: **400 "Nenhum tenant ativo"**, a mesma trava que a rota irmã `notifications/nudge` já tinha. **Ninguém que entrava passa a não entrar** — os dois desfechos negam |
| `senderName: profile.full_name` — assina `string` | Remetente sem `full_name` imprimia a palavra literal **"null"** no rodapé do e-mail (`Enviado por <strong>null</strong>`) | `?? ""` — para de imprimir "null" |

O segundo é um defeito de copy, e **qual texto deve aparecer no lugar não é decisão desta
correção**. Fica registrado para quem edita a copy do Engagement Center.

---

## 8. Arquivos

**Modificados**
- `apps/web/src/lib/api-role-guard.ts` — `requireAnyRole`, `FonteDaDecisao`, `PerfilComChapeus`, as três constantes de papéis, e o motivo do `?? ""` escrito no tipo
- `apps/web/src/app/api/notifications/nudge/route.ts`
- `apps/web/src/app/api/admin/notifications/route.ts` (GET e POST)
- `apps/web/src/app/api/analytics/semantic/route.ts`
- `apps/web/src/app/api/analytics/aggregate/route.ts`

**Criados**
- `apps/web/src/app/api/__tests__/perfil-ilegivel-nao-e-negacao-uniao.test.ts` (50 casos)
**Criado e depois removido**
- `apps/web/src/app/api/__tests__/tenant-nulo-normalizado-nao-atravessa-trava.test.ts` —
  montava um `manager` com `tenant_id` nulo, estado que `users_super_admin_tenant_check`
  proíbe. Ficção verificando ficção. Motivo em §6.2.

Nenhum commit, nenhum push, nenhuma escrita no banco.
