# FIX-B — Falha silenciosa nas rotas de API

> Executado em 2026-08-29, worktree `/Users/hugocapitelli/Dev/eximia/eximia-academy-v2`,
> branch `integra/main-cory`, a partir de `d2b8083`.
> Laudo de origem: `LOOP-0c-falha-silenciosa.md` (tabelas E→NEGA #1, E→SUCESSO #2 e #3,
> E→PARCIAL / E→ENGOLIDO #3).
> **Nenhum commit, nenhum push, nenhuma escrita em banco.** Todos os duplos são em memória.

## Placar

| Item | Defeito | Vermelho antes | Verde depois |
|---|---|---|---|
| 1 | 8 rotas: perfil ilegível vira 403 | **8 falhas**, uma por rota | 33/33 |
| 2 | `apply` Step 4 responde `success:true` com a escrita falhando | **1 falha** | 3/3 |
| 3 | `generate` engole falha de webhook sem log | **1 falha** | 2/2 |
| 4 | Leitura paginada devolve parcial como total | **3 falhas** | 6/6 (+3 no consumidor) |

**Suíte inteira ao final:** `4 failed | 360 passed (364)` arquivos, `22 failed | 3481 passed | 5 skipped`.
As 4 falhas são exatamente a baseline conhecida (`login-form-google-oauth`, `manager-dashboard`,
`epic-23-docs-vs-code`, `epic-6-security-posture-doc`). **Zero regressão nova.**
`pnpm --filter @eximia/web typecheck` → **limpo**.
`biome check` nos 7 arquivos novos → **limpo** (o repo tem baseline vermelha de ~600; os 5
arquivos de rota que editei **já estavam desformatados em `HEAD`** — verificado rodando o
biome sobre a versão de `HEAD` deles —, então não os reformatei, para não inflar o diff com
linhas que não toquei).

---

## Item 1 — "não tem direito" ≠ "não deu para verificar" (8 rotas)

### O defeito

As oito liam o perfil sem nunca destructurar `error`:

```ts
const { data: profile } = await supabase
  .from("users").select("role, tenant_id").eq("id", user.id).single()
if (!profile || !["manager","admin","super_admin","instructor"].includes(profile.role))
  return NextResponse.json({ error: "Permissão negada" }, { status: 403 })
```

Num timeout de statement, `data` volta `null`, `profile` fica `null`, e a condição `!profile`
despacha o **mesmo 403** que um estagiário receberia. Um gestor legítimo lê "você não tem
permissão" quando a verdade é "não conseguimos confirmar".

### Vermelho ANTES da correção

`pnpm --filter @eximia/web test src/app/api/__tests__/perfil-ilegivel-nao-e-negacao.test.ts`

```
 FAIL  …perfil-ilegivel-nao-e-negacao.test.ts > POST /api/course-designer/ai-fill — falha ao LER o perfil não pode virar 403
 FAIL  …perfil-ilegivel-nao-e-negacao.test.ts > POST /api/course-designer/analyze-content — falha ao LER o perfil não pode virar 403
 FAIL  …perfil-ilegivel-nao-e-negacao.test.ts > POST /api/course-designer/audit-course — falha ao LER o perfil não pode virar 403
 FAIL  …perfil-ilegivel-nao-e-negacao.test.ts > GET /api/course-designer/blueprints — falha ao LER o perfil não pode virar 403
 FAIL  …perfil-ilegivel-nao-e-negacao.test.ts > POST /api/course-designer/blueprints/[id]/apply — falha ao LER o perfil não pode virar 403
 FAIL  …perfil-ilegivel-nao-e-negacao.test.ts > GET /api/course-designer/frameworks — falha ao LER o perfil não pode virar 403
 FAIL  …perfil-ilegivel-nao-e-negacao.test.ts > POST /api/course-designer/generate — falha ao LER o perfil não pode virar 403
 FAIL  …perfil-ilegivel-nao-e-negacao.test.ts > GET /api/courses — falha ao LER o perfil não pode virar 403
AssertionError: expected 403 not to be 403 // Object.is equality
 ❯ src/app/api/__tests__/perfil-ilegivel-nao-e-negacao.test.ts:204:35
    203|       // O coração do defeito: hoje todas devolvem 403 "Permissão nega…
    204|       expect(resposta.status).not.toBe(403)
       |                                   ^

 Test Files  1 failed (1)
      Tests  8 failed | 25 passed (33)
```

Repare nos **25 verdes já no vermelho**: são os controles positivos. Eles passavam antes e
continuam passando depois — é o que impede a "correção" degenerada *responde 503 sempre* de
ficar verde. São quatro por rota: papel insuficiente continua 403; perfil inexistente
(`PGRST116`) continua 403 e **não** 503; papel suficiente atravessa o guard; e sem sessão
continua 401 antes de qualquer leitura de perfil.

### A correção

Helper único, `apps/web/src/lib/api-role-guard.ts`, espelhando o desenho do padrão-ouro
`requireFeature` (`lib/feature-gate.ts`): **403** quando a leitura funcionou e a resposta é não,
**503 + `Retry-After`** quando a leitura falhou. A assimetria do header é o sinal estrutural de
que os casos são diferentes — o 403 irmão não tem header nenhum.

Uma decisão de projeto que vale registrar: `PGRST116` (zero linhas) **não** é indisponibilidade.
A leitura aconteceu e o veredito é "esta pessoa não tem perfil". Tratá-lo como 503 esconderia
um usuário órfão atrás de um "tente de novo" que nunca resolveria. Isso está travado por
controle positivo, uma asserção por rota.

As oito rotas passam a ser duas linhas:

```ts
const { profile, recusa } = await requireRole(supabase, user.id, PAPEIS_COURSE_DESIGNER)
if (recusa) return recusa
```

A lista de papéis também virou uma constante só (`PAPEIS_COURSE_DESIGNER`): era a mesma
literal repetida oito vezes. Oito cópias do mesmo julgamento foi como o defeito se espalhou;
agora um papel novo entra em um lugar, não em sete.

**Nota técnica (`TS2589`).** A primeira versão do helper descrevia o cliente Supabase
estruturalmente (`from → select → eq → single`). Isso obriga o TS a comparar contra o
`PostgrestQueryBuilder`, genérico em profundidade suficiente para estourar o orçamento de
instanciação em rota com inferência pesada — `ai-fill`, com seu `z.record`, foi a que estourou.
O parâmetro passou a `from: (tabela: string) => any` com o contrato do retorno preservado numa
interface própria (`RespostaDePerfil`) aplicada na leitura. Está comentado no arquivo.

### Verde

```
 ✓ src/app/api/__tests__/perfil-ilegivel-nao-e-negacao.test.ts (33 tests) 11ms
 Test Files  1 passed (1)      Tests  33 passed (33)
```

### ACHADO QUE EXTRAPOLA O ESCOPO — 39 outras rotas com o defeito idêntico

O laudo trata as 8 como um achado sistêmico. **Elas são uma amostra do sistêmico, não o
censo.** Varredura em `apps/web/src/app/api/**`:

```bash
grep -rln "const { data: profile } = await supabase" apps/web/src/app/api --include='*.ts'
# 51 arquivos de rota (fora o meu teste)
```

Classificando pelo desfecho da checagem seguinte, **39 dessas rotas transformam a leitura
falha em negação de direito** — o mesmo E→NEGA, byte a byte. Entre elas: os 8 arquivos de
`api/ingestion/**`, os 5 de `api/chapters/**`, os 8 de `api/admin/books/**`,
`api/integrations/keys` e `keys/[id]`, `api/notifications/nudge`, `api/courses/import`,
`api/blueprint/generate`, e mais 3 do próprio `course-designer` que o laudo não listou
(`blueprints/[id]`, `blueprints/[id]/export`, `jobs/[jobId]`).

**Não as toquei.** O Senhor autorizou 8 nominalmente; estender para 47 é outra ordem de
grandeza (listas de papéis diferentes, fluxos diferentes, blast radius muito maior) e seria eu
decidindo escopo no lugar dele. O helper e o desenho de teste já existem e são reutilizáveis —
a extensão é mecânica se ele quiser. **Consequência honesta:** o comando de verificação do
briefing (`grep -rn "data: profile" apps/web/src/app/api` → nenhuma leitura sem checagem)
**não fica vazio**, e não tinha como ficar dentro do escopo autorizado. Ele fica vazio para as
8 rotas nomeadas.

---

## Item 2 — `apply/route.ts` Step 4: `success:true` com a escrita falhando

### Vermelho ANTES

```
 FAIL  …aplicar-blueprint-nao-mente-sucesso.test.ts > Step 4 falhando NÃO pode responder success:true
AssertionError: expected true not to be true // Object.is equality
 ❯ …aplicar-blueprint-nao-mente-sucesso.test.ts:170:31
    169|     // O coração do defeito: hoje isto responde 200 { success: true }.
    170|     expect(corpo.success).not.toBe(true)
       |                               ^

 Test Files  1 failed (1)
      Tests  1 failed | 2 passed (3)
```

Os 2 verdes são os controles positivos: caminho feliz continua 200 com `success:true`, e falha
na inserção de perguntas continua 500 **com rollback de capítulos e curso** (o duplo registra
toda escrita, então o teste confere que `chapters:delete` e `courses:delete` aconteceram e que
`course_blueprints:update` **não** aconteceu).

### A correção

`const { error: statusError } = await supabase…update(...)`, e 500 explícito se falhar.

**Sem rollback, de propósito.** O curso, os capítulos e as perguntas foram criados e estão
íntegros; apagá-los por causa de um marcador de status seria uma cura pior que a doença. O
`courseId` (e as contagens) vão no corpo do erro justamente para que quem recebe o 500 saiba o
que existe do outro lado. O risco real que o laudo nomeia — reaplicar o blueprint e gerar um
segundo curso — some porque a resposta deixou de dizer "aplicado".

### Verde

```
 ✓ …aplicar-blueprint-nao-mente-sucesso.test.ts (3 tests) 10ms
```

---

## Item 3 — `generate/route.ts`: `.catch(() => {})` no webhook

### Vermelho ANTES

```
 FAIL  …webhook-que-falha-nao-cala.test.ts > webhook rejeitando precisa deixar rastro, e hoje não deixa nenhum
AssertionError: expected 0 to be greater than 0
 ❯ …webhook-que-falha-nao-cala.test.ts:158:26
    157|     // O coração do defeito: `.catch(() => {})` não registra absolutam…
    158|     expect(erros.length).toBeGreaterThan(0)
       |                          ^

 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)
```

O `0` literal é o defeito: nem um `console.error`. O teste roda a rota inteira e **drena o SSE
até o fim**, então também mede que o rastro não custa a geração.

### A correção

O webhook continua fora do caminho crítico — o blueprint já está salvo e o SSE anuncia
`completed` logo abaixo; derrubar a geração porque o endpoint do tenant respondeu 502 seria
trocar um defeito por um pior. O que faltava era o **rastro**: `console.error` nomeando evento,
blueprint e tenant, mais `Sentry.captureException` com `webhook_event` na tag.

Os controles positivos travam as duas degenerações: a falha de webhook **não** pode impedir o
`completed` (senão "throw" ficaria verde), e o caminho feliz **não** pode logar erro nenhum
(senão "loga sempre" ficaria verde).

### Verde

```
 ✓ …webhook-que-falha-nao-cala.test.ts (2 tests) 6ms
```

---

## Item 4 — leitura paginada truncada devolvida como completa

### O defeito

`fetchAllRows` vivia privada dentro de `api/analytics/aggregate/route.ts` (1.528 linhas), com
**9 chamadores**, e colapsava três desfechos radicalmente diferentes num único `break`,
devolvendo `T[]` puro — um tipo que não tem onde carregar a diferença:

| desfecho | o que o array significa |
|---|---|
| acabaram as linhas | está completo |
| a página falhou | está incompleto, e ninguém sabe |
| bateu o teto de 50 páginas | idem, a partir de 50.000 linhas |

### Passo 0 — extração verbatim (refactor, verde antes e depois)

Enquanto era função privada de um arquivo de 1.500 linhas, nenhum teste conseguia interrogá-la.
Movi o corpo **byte a byte** para `apps/web/src/lib/leitura-paginada.ts` e apontei a rota para
lá. Suíte da rota antes: `6 passed`. Depois da extração, ainda sem correção: `6 passed`. O
refactor preservou comportamento.

### Vermelho ANTES

```
 × lerTodasAsLinhas — completude não se presume > erro no meio da paginação não pode devolver o parcial como se fosse tudo
   → promise resolved "[ { id: +0 }, { id: 1 }, …(998) ]" instead of rejecting
 × lerTodasAsLinhas — completude não se presume > erro logo na primeira página também não pode virar lista vazia
   → promise resolved "[]" instead of rejecting
 × lerTodasAsLinhas — completude não se presume > bater o teto de páginas é truncamento, não fim dos dados
   → promise resolved "[ { id: +0 }, { id: 1 }, …(49998) ]" instead of rejecting
 ✓ [CP] uma única página incompleta é o conjunto inteiro
 ✓ [CP] várias páginas que terminam naturalmente devolvem tudo, em ordem
 ✓ [CP] página vazia sem erro é fim legítimo dos dados, não falha

 Test Files  1 failed (1)
      Tests  3 failed | 3 passed (6)
```

As mensagens *são* o laudo: `resolved "[]"` e `resolved 998 linhas` — o parcial saindo com cara
de total. O segundo caso é o mais traiçoeiro: `[]` é indistinguível de "não há dados", e "não
há dados" é uma resposta que a tela sabe desenhar com naturalidade.

### A correção

Fail-loud, e **em uma decisão só**: `lerTodasAsLinhas` ou devolve o conjunto inteiro, ou lança
`LeituraTruncadaError` (com `motivo: "erro-de-leitura" | "teto-de-paginas"` e `linhasLidas`).
Não existe terceiro estado para nove chamadores interpretarem cada um do seu jeito — nove
cópias do mesmo julgamento é literalmente como o E→NEGA se espalhou por oito rotas.

`data: null` sem `error` passou a contar como falha também: em prática a página não veio, e
tratá-la como "acabaram as linhas" era a porta pela qual o `[]` da primeira página passava por
"não há dados".

### Os consumidores

Os 9 chamadores vivem todos dentro de `aggregate/route.ts`. Em vez de threadar um flag por
nove caminhos até o payload, o `GET` ganhou um invólucro fino que traduz o grito em **503
`analytics_read_incomplete` com `Retry-After`** — mesma assimetria do `feature-gate`. O corpo
do handler não foi tocado (arquivo grande, colegas trabalhando nele agora): o `export async
function GET` virou `agregarAnalytics`, e o novo `GET` é o `try/catch`.

Isso responde ao "garanta que nenhum trate parcial como total" pela raiz: nenhum chamador
**recebe** parcial, então nenhum pode confundi-lo com total.

### Verde, e a prova de que o verde não é vácuo

```
 ✓ src/lib/__tests__/leitura-paginada-nao-mente-completude.test.ts (6 tests) 4ms
 ✓ src/app/api/analytics/aggregate/__tests__/leitura-truncada-nao-vira-200.test.ts (3 tests) 52ms
 ✓ src/app/api/analytics/aggregate/__tests__/route.test.ts (6 tests) 66ms
```

O teste do consumidor nasceu depois da correção (o invólucro é a correção), então **mutei o
código para conferir que ele não está verde por vacuidade**: troquei `if (err instanceof
LeituraTruncadaError)` por `if (false && …)` e rodei —

```
 × leitura interrompida por erro vira 503 nomeado, nunca 200
 × teto de páginas também vira 503, com o motivo próprio
 ✓ [CP] leitura completa continua 200
 LeituraTruncadaError: Leitura paginada interrompida por erro apos 1000 linhas
 LeituraTruncadaError: Leitura paginada atingiu o teto de 50 paginas (50000 linhas) — o conjunto real e maior
      Tests  2 failed | 1 passed (3)
```

O mutante morre, e o controle positivo sobrevive. Arquivo restaurado no mesmo comando.

---

## Arquivos

**Novos:**
- `apps/web/src/lib/api-role-guard.ts`
- `apps/web/src/lib/leitura-paginada.ts`
- `apps/web/src/app/api/__tests__/perfil-ilegivel-nao-e-negacao.test.ts`
- `apps/web/src/app/api/course-designer/blueprints/__tests__/aplicar-blueprint-nao-mente-sucesso.test.ts`
- `apps/web/src/app/api/course-designer/generate/__tests__/webhook-que-falha-nao-cala.test.ts`
- `apps/web/src/lib/__tests__/leitura-paginada-nao-mente-completude.test.ts`
- `apps/web/src/app/api/analytics/aggregate/__tests__/leitura-truncada-nao-vira-200.test.ts`

**Modificados:** as 8 rotas do item 1, mais `api/analytics/aggregate/route.ts`.

As 8 rotas tinham **zero testes** antes desta rodada — esta é a primeira cobertura delas.

## Achados fora do escopo, registrados e não tocados

1. **39 rotas com o E→NEGA idêntico** (seção do item 1). É o maior achado desta rodada.
2. **Outras três paginações com o mesmo desenho de `fetchAllRows`**, fora do arquivo que me
   coube: `lib/notifications/efficacy.ts`, `lib/notifications/audiences.ts` e
   `api/admin/engagement/history/route.ts`. Não verifiquei se truncam silenciosamente; o
   `lerTodasAsLinhas` já existe caso a casa queira unificá-las.
3. **`readAll` de `lib/analytics/admin-overview.ts`** (E→PARCIAL #1 do laudo, o "1.000
   concluintes onde o real é 2.500") está **fora da minha área** por instrução explícita — é de
   `lib/analytics/`. Continua aberto para quem for dono dele.
4. **`noNonNullAssertion` em `apply/route.ts:195`** (`chapterIdByOrder.get(q.chapterOrder)!`) é
   pré-existente e não foi tocado.

## Comandos de evidência

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2

# os 4 itens
pnpm --filter @eximia/web test src/app/api/__tests__/perfil-ilegivel-nao-e-negacao.test.ts
pnpm --filter @eximia/web test src/app/api/course-designer/blueprints/__tests__/aplicar-blueprint-nao-mente-sucesso.test.ts
pnpm --filter @eximia/web test src/app/api/course-designer/generate/__tests__/webhook-que-falha-nao-cala.test.ts
pnpm --filter @eximia/web test src/lib/__tests__/leitura-paginada-nao-mente-completude.test.ts
pnpm --filter @eximia/web test src/app/api/analytics/aggregate

# área inteira e regressão
pnpm --filter @eximia/web test src/app/api          # 32 arquivos, 321 testes, verde
pnpm --filter @eximia/web typecheck                 # limpo
pnpm --filter @eximia/web test                      # 4 failed (baseline conhecida), 3481 passed

# as 8 rotas nomeadas não têm mais leitura de perfil sem checagem.
# Precisa ser arquivo a arquivo: os DIRETÓRIOS `course-designer/` e `courses/` contêm
# rotas irmãs que estão entre as 39 não autorizadas, e um grep por diretório acusaria
# aquelas, não estas.
grep -n "data: profile" \
  apps/web/src/app/api/course-designer/{ai-fill,analyze-content,audit-course,generate,frameworks}/route.ts \
  apps/web/src/app/api/course-designer/blueprints/route.ts \
  "apps/web/src/app/api/course-designer/blueprints/[blueprintId]/apply/route.ts" \
  apps/web/src/app/api/courses/route.ts     # vazio

# e o guard está nas 8 (8 ocorrências)
grep -c "requireRole" \
  apps/web/src/app/api/course-designer/{ai-fill,analyze-content,audit-course,generate,frameworks}/route.ts \
  apps/web/src/app/api/course-designer/blueprints/route.ts \
  "apps/web/src/app/api/course-designer/blueprints/[blueprintId]/apply/route.ts" \
  apps/web/src/app/api/courses/route.ts

# o achado que extrapola
grep -rln "const { data: profile } = await supabase" apps/web/src/app/api --include='*.ts' | wc -l   # 51
```
