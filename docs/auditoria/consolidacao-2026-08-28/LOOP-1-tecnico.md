# LOOP-1 — Revisão técnica de código (integra/main-cory @ d2b8083)

> Revisor: Aria (@architect). Escopo: `git diff origin/main...HEAD` — 263 arquivos, +39.060/−722.
> Repositório permanece em `d2b8083`, sem alteração de código. Nenhuma escrita em banco.

## Sumário executivo

O código novo é, em disciplina de escrita, acima da média desta casa: isolamento por tenant está
presente em **toda** consulta nova, o gate de `/analytics` foi movido para a porta da rota, o
`feature-gate` separa corretamente "não tem direito" de "não deu para verificar", e a correção do
pseudo-elemento (d2b8083) foi feita na primitiva, não em disciplina de call site. **O problema não
está no que o código faz, está no que ele não consegue fazer:** a frente "Aprendizagem do Time"
entrega 3 telas, ~5.500 linhas de leitura e 39 arquivos de teste sobre um pipeline de escrita que
**não pode gravar uma única linha** — o `onConflict` do único `upsert` aponta para um índice parcial
que a migration efetivamente aplicável não cria e que o PostgreSQL não aceita como árbitro. Pior, a
falha é contada como sucesso (`processed: N`, `ok: true`). E `supabase db push` está travado: as duas
migrations obsoletas têm timestamp MENOR que a reconciliação e quebram antes dela; o único mecanismo
que impede isso é um aviso em README. **3 CRÍTICOS, 6 ALTOS, 11 MÉDIOS, 3 BAIXOS.** Nenhum é
vazamento de tenant ou de service role — esses dois eixos passaram.

---

## Achados por severidade

### CRÍTICO

---

#### C-1 · `supabase db push` está travado: a ordem das migrations é inversa à ordem de correção

**Arquivos:**
- `supabase/migrations/20260821000000_aprendizagem_time_schema.sql:159-172`
- `supabase/migrations/20260821010000_aprendizagem_time_seed_analise_problemas.sql`
- `supabase/migrations/20260825220000_aprendizagem_time_reconciliacao.sql`
- `supabase/migrations/README-aprendizagem-time.md:3-24`

**O que está errado.** A reconciliação estabelece, medido e verbatim, que `capabilities`,
`capability_criteria` e `capability_evidence` **já existiam** com outro formato. A migration
`20260821000000` foi escrita para terreno vazio e, além dos `CREATE TABLE IF NOT EXISTS` (que
apenas calam), cria índices **fora** do `CREATE TABLE`, referenciando colunas que a tabela
pré-existente não tem:

```sql
CREATE UNIQUE INDEX capability_evidence_source_capability_uidx
  ON public.capability_evidence (source_table, source_id, capability_id)  -- source_table NÃO EXISTE
  WHERE capability_id IS NOT NULL;
...
CREATE INDEX idx_capability_evidence_category
  ON public.capability_evidence (tenant_id, capability_id, evidence_category); -- NÃO EXISTE
```

Que `source_table`, `evidence_category`, `occurred_at` e `concept_id` não existiam é fato
estabelecido pelo próprio repositório: a reconciliação os adiciona com `ADD COLUMN IF NOT EXISTS`
(`20260825220000:...` bloco 3).

**Cenário de falha concreto.** Ambiente novo (staging, CI, segundo cliente, ou produção após
qualquer reset do `schema_migrations`) roda `supabase db push`. A ordem lexicográfica aplica
`20260821000000` primeiro. O `CREATE UNIQUE INDEX` falha com `42703 column "source_table" does not
exist`. A migration está dentro de `BEGIN...COMMIT`, então **tudo** faz rollback. O push aborta. A
reconciliação `20260825220000` — a única que funciona — **nunca é alcançada**. Se alguém
comentar/pular a primeira, a segunda (`20260821010000`, seed) roda antes da reconciliação e falha
em `ON CONFLICT (course_id, slug)`, porque `capabilities.slug` só nasce na reconciliação.

O único obstáculo entre esse estado e o operador é um aviso em prosa no topo de um README. Esse é
exatamente o padrão que esta casa já pagou: **item de contrato que não vira mecanismo não reprova
nada.**

**Correção recomendada.** Não editar migration já aplicada; adicionar uma quarta migration com
timestamp posterior que registre as duas obsoletas como aplicadas (`supabase migration repair
--status applied 20260821000000 20260821010000`) OU — preferível, porque é código e não comando de
operador — reescrever `20260821000000` e `20260821010000` para serem no-ops idempotentes
(`DO $$ BEGIN RAISE NOTICE 'obsoleta, ver 20260825220000'; END $$;`), preservando o histórico no
git e deixando o `db push` verde por construção. Enquanto isso não existir, **este branch não é
aplicável em nenhum ambiente que não seja a produção atual.**

---

#### C-2 · O `upsert` do pipeline de classificação não pode funcionar em nenhum dos dois schemas

**Arquivo:** `apps/web/src/lib/analytics/aprendizagem-time/classificador/index.ts:51-76`

```ts
const { error } = await db.from("capability_evidence").upsert(
  { /* ... */ },
  // Alvo do índice parcial `capability_evidence_source_capability_uidx`
  { onConflict: "source_table,source_id,capability_id" },
)
```

**O que está errado.** Dois defeitos independentes, cada um suficiente:

1. **O índice não existe no caminho que será aplicado.** A reconciliação
   (`20260825220000`) cria `idx_capability_evidence_student_capability` e
   `idx_capability_evidence_course_time`, mas **não** cria
   `capability_evidence_source_capability_uidx`. Verificável: `grep -n "source_capability_uidx"
   supabase/migrations/20260825220000_*.sql` não retorna nada.
2. **Mesmo se existisse, é um índice PARCIAL** (`WHERE capability_id IS NOT NULL`). O PostgreSQL
   só infere um índice único parcial como árbitro de `ON CONFLICT` quando o comando repete o
   predicado (`ON CONFLICT (cols) WHERE capability_id IS NOT NULL`). O PostgREST, a partir do
   parâmetro `on_conflict=`, emite a lista de colunas **sem** predicado. A inferência falha.

**Cenário de falha concreto.** Gestor abre `/analytics?dominio=aprendizagem`.
`GatilhoClassificacao` dispara `POST /api/analytics/aprendizagem-time/classify`. O pipeline lê 20
evidências pendentes, chama o LLM para cada uma (custo real), e cada `upsert` volta com
`42P10 — there is no unique or exclusion constraint matching the ON CONFLICT specification`. O
`catch` em `index.ts:78` faz `console.error` e `continue`. **Nenhuma linha é gravada, nunca.**
`capability_evidence` fica com as 853 linhas antigas e os níveis todos `NULL`; `avaliarMaturidade`
filtra `comprehension !== null` e devolve `not_evidenced` para todo mundo. As 3 telas exibem
"amostra ainda insuficiente" permanentemente, para sempre, e o log é a única testemunha.

**Por que os testes não pegam.** Os 39 arquivos de teste da frente cobrem os montadores puros e o
agregador. `processarPendencias` **não tem um único teste** — verificado:
`grep -rln "processarPendencias" apps/web/src apps/web/tests` devolve apenas a rota e o próprio
módulo. A única função que fala com o banco é a única não coberta.

**Correção recomendada.** Criar o índice **não-parcial** na reconciliação
(`CREATE UNIQUE INDEX IF NOT EXISTS capability_evidence_source_capability_uidx ON
public.capability_evidence (source_table, source_id, capability_id)`), aceitando `capability_id`
NULL como valor distinto no índice (o comportamento padrão do Postgres para NULLs em índice único
já evita a colisão que o `WHERE` tentava resolver). Antes disso, um teste de integração que exercite
`processarPendencias` contra o schema real — não contra mock.

---

#### C-3 · A rota de classificação devolve `ok: true` e uma contagem de sucesso quando 100% falhou

**Arquivo:** `apps/web/src/lib/analytics/aprendizagem-time/classificador/index.ts:78-105`

```ts
if (error) {
  console.error("[aprendizagem-time] upsert de capability_evidence falhou:", error.message)
  continue                                   // ← a falha some
}
// ...
return {
  processadas: pendentes.length,             // ← conta TODAS as tentativas, não as gravadas
  // ...
}
```

E a rota (`classify/route.ts:44-49`) devolve `{ ok: true, processed: resultado.processadas }`.

**Cenário de falha concreto.** Com C-2 ativo, 20 de 20 upserts falham. `paresTocados` fica vazio,
`capacidadesReavaliadas` é 0, e a resposta HTTP é `200 {"ok":true,"processed":20,"pending":1,
"reassessed":0}`. Qualquer monitor, dashboard ou pessoa que consulte esse endpoint lê "20
processadas" e conclui que o pipeline está vivo. É o mesmo padrão do "115/118 numa tela que não faz
nada": **a métrica mede a tentativa, não o efeito.**

**Correção recomendada.** Contar apenas os upserts sem erro; devolver `errors: N` no corpo e
`ok: false` quando `errors > 0`. Erro em 100% das gravações deve ser `500`, não `200`.

---

### ALTO

---

#### A-1 · `readAll` devolve leitura truncada marcada como completa

**Arquivo:** `apps/web/src/lib/analytics/admin-overview.ts:189-201`

```ts
for (let offset = 0; ; offset += PAGE_SIZE) {
  const { data, error } = await makeQuery().range(offset, offset + PAGE_SIZE - 1)
  if (error) return { rows, available: offset > 0 }   // ← available:true com dado PARCIAL
  // ...
}
```

**O que está errado.** O docblock imediatamente acima declara o propósito: *"para `certificates`,
'zero concluintes' e 'não consegui ler' são afirmações distintas, e a tela mostra '—' na segunda
em vez de um zero mentiroso."* A implementação faz o contrário do que promete a partir da segunda
página: `offset > 0` ⇒ `available: true`.

**Cenário de falha concreto.** Tenant com 2.500 certificados. Página 1 (0–999) volta OK. Página 2
falha por timeout do PostgREST. A função retorna 1.000 linhas com `available: true`. A tela
`/admin/visao-geral` exibe **"1.000 concluintes"** como fato verificado, quando o número real é
2.500 e o correto seria "—". O admin toma decisão de programa de treinamento sobre 40% do dado,
sem nenhum sinal de que falta algo.

**Correção recomendada.** `if (error) return { rows: [], available: false }` — a mesma doutrina
I-4 que `autogestao/fonte-supabase.ts:79-81` e `aprendizagem-time/fonte-supabase.ts:63-68` já
aplicam corretamente. Aqui, e só aqui, ela foi invertida.

---

#### A-2 · Erro de leitura de `users` vira "a empresa tem zero pessoas"

**Arquivo:** `apps/web/src/lib/analytics/admin-overview.ts:216-227`

```ts
const enriched = await readAll<TenantUserRow>(() =>
  db.from("users").select("id, status, role, last_seen_at").eq("tenant_id", tenantId))
if (enriched.available) return enriched.rows
const bare = await readAll<TenantUserRow>(() =>
  db.from("users").select("id, status, role").eq("tenant_id", tenantId))
return bare.rows                                       // ← [] em caso de falha, sem sinal
```

**O que está errado.** O fallback foi desenhado para um caso específico e nomeado (a coluna
`last_seen_at` pode não existir antes da migration). Mas o gatilho é **qualquer** `error` na
primeira página. E a função não tem canal de falha: devolve `TenantUserRow[]`, não
`TolerantRead<TenantUserRow>`. A informação de que a leitura falhou existe dentro de `readAll` e é
descartada na saída.

**Cenário de falha concreto.** Soluço transitório de rede no primeiro `range()` de `users`. O
fallback roda; se o soluço persistir por mais 200ms, ele também falha e devolve `[]`.
`loadAdminOverview` prossegue: `activity = buildActivityIndex(ref, [])`, todos os totais e o funil
de adoção são computados sobre população zero. `/admin/visao-geral` renderiza normalmente,
mostrando a empresa com **0 pessoas, 0 ativos, funil vazio** — sem erro, sem "—", sem retry. Um
admin que abra a tela nesse instante lê que a Academy não tem ninguém.

**Correção recomendada.** Propagar `TolerantRead`; distinguir "coluna ausente" (checar
`error.code === '42703'`) de falha genérica; falha genérica deve virar estado de erro na página,
não zero.

---

#### A-3 · O gate 2 da marca, que o próprio código diz ser indispensável, não existe

**Arquivos:** `apps/web/scripts/verificar-marca.mjs:2-6`, `Dockerfile:96`

O cabeçalho do verificador afirma:

> `GATE 1 DE 2 — A MARCA DECLARADA (roda ANTES do build). O gate 2 é
> verificar-marca-no-artefato.mjs, que roda DEPOIS e mede o que o Next realmente inlinou. Este aqui
> só olha a DECLARAÇÃO; sozinho ele não prova nada sobre o produto, e é por isso que existem dois.`

**O que está errado.** `verificar-marca-no-artefato.mjs` **não existe no repositório**
(`find . -name "verificar-marca-no-artefato*" -not -path "*/node_modules/*"` → vazio;
`ls apps/web/scripts/` → 4 entradas, nenhuma delas). O `Dockerfile` só invoca o gate 1, na linha 96,
antes de `pnpm turbo run build`. Ou seja: o único gate que roda é aquele que o autor declara,
textualmente, não provar nada sobre o produto.

**Cenário de falha concreto.** O build args chegam corretamente ao estágio `builder` (as `ENV` das
linhas 72–86 garantem isso), o gate 1 passa. Mas o `next build` roda dentro de `turbo`, e
`turbo.json` declara `"env": ["NEXT_PUBLIC_TENANT_*"]` — se o modo de env do Turbo estiver estrito e
o padrão não casar por algum motivo (ou se um `.env.production` for adicionado ao `apps/web` no
futuro, ou se o Next mudar a regra de inline), o bundle sai **neutro** enquanto o gate 1 diz "OK,
build de cliente cory-alimentos". O produto entregue mostra a marca eximIA para o cliente pagante,
o build está verde, e ninguém tem como saber sem abrir o artefato. É precisamente o modo de falha
que o gate 1 declara não cobrir.

**Correção recomendada.** Escrever `verificar-marca-no-artefato.mjs` (grep do slug/nome esperado
dentro de `apps/web/.next/static/chunks/**/*.js`) e adicionar `RUN node
apps/web/scripts/verificar-marca-no-artefato.mjs` **depois** da linha 98 do Dockerfile. Enquanto ele
não existir, remover a alegação do cabeçalho — um comentário que descreve um gate inexistente é pior
que nenhum comentário, porque o próximo leitor vai assumir cobertura que não há.

---

#### A-4 · O schema pré-existente de `capability_evidence` (853 linhas de dado individual) não tem RLS estabelecida por nenhuma migration deste repositório

**Arquivos:** `supabase/migrations/20260825220000_aprendizagem_time_reconciliacao.sql:~230-250`
(bloco 8), contra `20260821000000_aprendizagem_time_schema.sql:281-300`

**O que está errado.** A migration original ligava RLS em **8** tabelas. A reconciliação liga em
**5** (`concepts`, `capability_concepts`, `capability_assessments`,
`capability_assessment_evidence`, `capability_assessment_criteria`). As três pré-existentes —
`capabilities`, `capability_criteria` e **`capability_evidence`** — ficam de fora, com a premissa
tácita de que já estão protegidas. Essa premissa **não é verificável neste repositório**:
`grep -rln "capability_evidence" supabase/migrations/` devolve apenas os dois arquivos novos e o
README. A tabela foi criada fora de migration — é a **quarta** ocorrência do padrão já catalogado
nesta casa.

**Cenário de falha concreto.** Se a tabela foi criada por SQL editor sem `ENABLE ROW LEVEL
SECURITY` (ou com uma policy larga), qualquer usuário autenticado do produto, com a chave anon que
o browser já tem, faz `GET /rest/v1/capability_evidence?select=*` e lê as 853 linhas — 764 delas do
cliente que está no ar — incluindo `classification_reasoning` (síntese do que o aluno escreveu) de
todos os alunos, de todos os tenants. A reconciliação passa verde sem tocar nesse ponto.

**Correção recomendada.** Não é possível resolver por leitura de código; exige uma consulta de
diagnóstico (`SELECT relname, relrowsecurity FROM pg_class WHERE relname LIKE 'capability%'` e
`SELECT * FROM pg_policies WHERE tablename LIKE 'capability%'`) — **read-only, e fora do meu escopo
neste loop.** Se o resultado for `relrowsecurity = false` em qualquer uma das três, isto sobe
para CRÍTICO imediatamente. A reconciliação deveria ter incluído `ALTER TABLE ... ENABLE ROW LEVEL
SECURITY` + as policies para as três, idempotentemente (`DROP POLICY IF EXISTS` + `CREATE POLICY`,
como já faz para as cinco novas) — custo zero se já estivessem certas, e o fim da premissa tácita.

---

#### A-5 · Falha ao carregar critérios devolve lista vazia, e o pipeline reporta "nada pendente"

**Arquivo:** `apps/web/src/lib/analytics/aprendizagem-time/classificador/fontes-evidencia.ts:142-151`

```ts
if (error) {
  console.error("[aprendizagem-time] leitura de capabilities falhou:", error.message)
  return []                                    // ← indistinguível de "tenant sem capacidades"
}
```

**Cenário de falha concreto.** A leitura de `capabilities` falha (RLS, timeout, coluna ausente —
exatamente o erro que derrubou produção às 18:57 de 25/08 foi `capabilities.title`).
`carregarCapacidadesAtivas` devolve `[]`. `buscarEvidenciasPendentes` não encontra nenhum par
evidência×capacidade e devolve `[]`. `processarPendencias` cai no early-return da linha 38 e
responde `{ processadas: 0, pendentesRestantes: 0, capacidadesReavaliadas: 0 }` — que é **byte a
byte a mesma resposta de "está tudo classificado, nada a fazer"**. Um operador olhando o endpoint
conclui que o pipeline terminou o trabalho, quando ele nunca conseguiu começar.

**Correção recomendada.** Propagar a falha como valor (o mesmo `FalhaLeitura` que as camadas de
leitura irmãs já usam) e devolver `500` na rota. `[]` deve significar exclusivamente "não há
capacidade cadastrada".

---

#### A-6 · Falha na varredura de já-classificados faz o pipeline reclassificar tudo, ao custo de LLM

**Arquivo:** `apps/web/src/lib/analytics/aprendizagem-time/classificador/fontes-evidencia.ts:196-210`

```ts
if (error) {
  console.error("[aprendizagem-time] leitura de capability_evidence falhou:", error.message)
  break                                        // ← devolve o Set PARCIAL montado até aqui
}
```

**Cenário de falha concreto.** A primeira página de `capability_evidence` falha. O `Set` de chaves
já classificadas volta **vazio**. Toda evidência do tenant passa a ser "pendente". O pipeline
processa 20 por chamada, chamando o LLM para cada uma, e `GatilhoClassificacao` re-dispara a cada
render de cada uma das 3 abas, para cada gestor. Com 853 evidências e uma falha intermitente de
leitura, o sistema entra num moinho de reclassificação: custo de inferência recorrente sobre dado
que já estava classificado, sem nenhum sinal na tela. O teto de 20 por chamada limita a rajada, não
o total.

**Correção recomendada.** Mesma doutrina: erro de leitura aborta a rodada, não a degrada
silenciosamente para "nada foi classificado ainda".

---

### MÉDIO

| # | Arquivo:linha | Defeito | Cenário de falha |
|:--|:--|:--|:--|
| M-1 | `lib/analytics/aprendizagem-time/fonte-supabase.ts:60`, `lib/analytics/autogestao/fonte-supabase.ts:74` | `MAX_PAGINAS = 50` encerra o laço **sem falha** ao esgotar. Truncamento é indistinguível de fim de dados. | Tenant que ultrapasse 50.000 linhas em `capability_evidence` tem o excedente descartado em silêncio; o gestor vê métricas menores apresentadas como completas. É a mesma classe de A-1, com gatilho de volume em vez de erro. |
| M-2 | `classificador/index.ts:161-195` | O flip de `is_current = false` e o `INSERT` da nova linha não são atômicos e não estão em transação. | Flip commita, `INSERT` falha (violação de `rationale NOT NULL`, queda de conexão, ou o unique parcial `WHERE is_current` numa corrida). O aluno fica **sem nenhuma linha corrente**: a tela regride de "demonstrado" para "não evidenciada" até a próxima rodada do pipeline. Dado correto, exibido errado. |
| M-3 | `components/analytics/aprendizagem-time/gatilho-classificacao.tsx:14-20` | Dispara em `useEffect` sem dedup, debounce ou lock de servidor, em **cada** render de **cada** uma das 3 abas. | 3 gestores abrindo a tela ao mesmo tempo geram 3 pipelines concorrentes sobre o mesmo conjunto de pendências: LLM cobrado 3×, e as escritas concorrentes colidem no unique parcial de `is_current` (uma das três falha e é engolida pelo `console.error`). |
| M-4 | `app/api/courses/route.ts:20-28` | Usa `profile.role` (coluna singular) para autorizar, contra a regra explícita da casa em `_trinca/recorte.ts:47` — *"A UNIÃO de chapéus (`user_roles`), nunca a coluna singular `users.role`"*. | Usuário com chapéu `instructor` concedido via `user_roles` e `users.role = 'student'` recebe **403** ao abrir o Course Selector. Falha fechada (não é brecha), mas é uma segunda definição de "quem pode", que diverge da primeira no dia em que uma das duas mudar. |
| M-5 | `app/api/analytics/autogestao/_contexto.ts:141` vs `app/(platform)/jornada/_autogestao/recorte.ts:75-84` | Duas definições do dono da tela: a rota HTTP exige `profile.role === "student"` estrito; a página RSC não checa papel nenhum. | Um `instructor` matriculado num curso abre `/jornada?vista=autogestao` e vê a tela completa (correto — é a jornada dele), mas `GET /api/analytics/autogestao/visao-geral` devolve 403 para o mesmo usuário e o mesmo dado. O contrato documentado e a tela entregue discordam. |
| M-6 | `20260821000000:...:236` vs `20260825220000:...` (bloco 6) | `capability_assessments_current_uidx` é `(tenant_id, student_id, capability_id)` numa migration e `(student_id, capability_id)` na outra. | Nenhum efeito hoje (usuário pertence a um tenant só), mas qualquer código futuro que faça `upsert` com `onConflict` nessa tabela vai funcionar num ambiente e falhar no outro, conforme qual migration criou o índice. É C-2 esperando para acontecer de novo. |
| M-7 | `20260825220000_...reconciliacao.sql` (bloco 3) | A reconciliação adiciona as colunas mas **não** replica nenhum dos `CHECK` da migration original: `evidence_category IN (...)`, `source_type IN (...)`, `depth_level BETWEEN 1 AND 7`, `comprehension IN (...)`, `application_level IN (...)`, `confidence BETWEEN 0 AND 1`, nem `capability_evidence_target_chk`. | Um bug no motor de classificação que produza `depth_level = 12` ou `comprehension = "parcial"` (em português, em vez de `partial`) grava sem resistência. A validação de domínio passa a existir só em TypeScript, num caminho que roda com service role. A migration justifica a ausência para as colunas de nível (as 853 linhas antigas são NULL) — o que é correto —, mas um `CHECK ... NOT VALID` daria a garantia para as linhas novas sem tocar nas antigas. |
| M-8 | `app/gauntlet-preview/*/page.tsx` (9 rotas) + `autogestao-visao-geral/leitura-real.ts:113-135` | As rotas aceitam `?tenant=<slug>&estudante=<uuid\|email>` e resolvem com `createServiceClient()` (RLS contornada). A única proteção é `if (process.env.NODE_ENV === "production") notFound()`. | Qualquer deploy que não seja `NODE_ENV=production` — preview, staging, um `docker run` com a env sobrescrita, `next dev` exposto — entrega leitura **não autenticada** da jornada íntima de qualquer aluno de qualquer tenant, via URL. O `Dockerfile:103` fixa `NODE_ENV=production` no runner, o que fecha o caminho hoje; a defesa tem exatamente uma camada de profundidade. Recomendo somar `&& process.env.GAUNTLET_PREVIEW === "1"` (fail-closed por presença, não por ausência). |
| M-9 | 4 implementações de paginação com 3 semânticas de erro divergentes | `autogestao/fonte-supabase.ts:70` (aborta, honesto) · `aprendizagem-time/fonte-supabase.ts:49` (aborta, honesto, + lotes de ids) · `admin-overview.ts:189` (parcial marcado como completo — A-1) · `_trinca/recorte.ts:83-84` (constantes próprias). | Este é o eixo (g) na sua forma real (ver seção dedicada abaixo): não é cálculo duplicado, é **o mesmo contrato de leitura implementado quatro vezes, e uma delas está errada**. A divergência já produziu um defeito (A-1); a próxima correção aplicada a um dos quatro não alcança os outros três. |
| M-10 | `app/(platform)/admin/visao-geral/loader.ts:40` | `createServiceClient() as unknown as ServiceClient` — cast duplo, que desliga a checagem estrutural entre os dois tipos. | Se `ServiceClient` (de `lib/analytics/area-gestor`) divergir do retorno real de `createServiceClient`, o compilador não avisa; o erro aparece em runtime, com service role na mão. Um único `as` já seria discutível; `as unknown as` é a instrução explícita de "não verifique nada". |
| M-11 | `app/api/courses/route.ts:37-41` | Lista cursos sem excluir `status = 'archived'` nem `deleted_at`. | O Course Selector do Course Designer oferece cursos arquivados como se fossem ativos; o usuário seleciona um curso morto e o fluxo de blueprint segue sobre ele. Compare com `_contexto.ts:78` e `recorte.ts:97`, que na mesma branch filtram `.neq("courses.status", "archived")`. |

---

### BAIXO

| # | Arquivo:linha | Defeito | Cenário |
|:--|:--|:--|:--|
| B-1 | `lib/analytics/aprendizagem-time/fonte-supabase.ts:143,174` | `.in("capability_id", capacidadeIds)` não é loteado, enquanto `student_id` é (`TAMANHO_LOTE_IDS = 200`, com o comentário certo na linha 30: *"o `.in()` do PostgREST vai na query string — um escopo grande estoura a URL"*). | Com 15 capacidades hoje, sem efeito. Um tenant com ~400 capacidades cadastradas gera uma query string de ~15 KB e recebe `414 URI Too Long` — que a camada trata como falha de leitura (correto), mas a tela some sem que ninguém entenda por quê. Aplicar o mesmo lote que já existe ao lado. |
| B-2 | `app/not-found.tsx:29-34`, `app/onboarding/layout.tsx:46-52` | O logo passou a vir da config por env (correto), mas a palavra **"Academy"** e a classe `text-cerrado-600` continuam literais ao lado dele. | Build de cliente exibe o logo da Cory seguido da palavra "Academy" na cor da eximIA, no 404 e no onboarding. É exatamente a "marca pela metade" que `verificar-marca.mjs` foi escrito para impedir — só que num eixo que o gate não mede, porque não é variável de ambiente. |
| B-3 | `classificador/index.ts:103` | `pendentesRestantes: restantes.length > 0 ? 1 : 0` — um booleano num campo cujo nome promete contagem. | Consumidor futuro que faça `while (r.pending > 0)` para drenar a fila lê "1" para sempre e nunca sabe quantas faltam. O comentário ao lado assume o custo; o **nome** do campo é que mente. `temPendencias: boolean` custaria o mesmo e não mentiria. |

---

## Vereditos dos 7 eixos obrigatórios

### (a) Isolamento por tenant em toda consulta nova — **PASSA**

Verificação: leitura integral de `lib/analytics/aprendizagem-time/fonte-supabase.ts` (5 consultas),
`lib/analytics/autogestao/fonte-supabase.ts`, `lib/analytics/admin-overview.ts` (8 consultas),
`classificador/fontes-evidencia.ts` (9 consultas), `api/courses/route.ts`, `api/analytics/
autogestao/_contexto.ts`. Comando: `grep -n '\.from("' <arquivo>` cruzado com
`grep -c 'eq("tenant_id"' <arquivo>`.

**Toda** consulta nova aplica `.eq("tenant_id", ...)`, com **duas exceções, ambas justificadas e
documentadas no próprio código**:

- `admin-overview.ts:322` — `user_areas` não possui coluna `tenant_id`; o recorte vem do
  `.in("area_id", groupIds)` sobre `areas` já escopadas na linha 315. Comentário explícito na
  linha 320.
- `fontes-evidencia.ts:154` — `capability_criteria` filtrada por `.in("capability_id", ...)` sobre
  `capabilities` já escopadas na linha 145.

Além disso, o recorte de equipe é resolvido **uma vez** (`resolverRecorteDaTrinca`) e injetado; a
Autogestão resolve `studentId` exclusivamente como `auth.uid()`, e `?studentId=` é lido apenas
para ser explicitamente descartado (`_contexto.ts:139-142`) — um padrão que torna a garantia legível
em vez de tácita. Nada a corrigir neste eixo.

### (b) Autorização na porta da rota, não só na renderização — **PASSA**

`analytics/page.tsx:88` chama `garantirAcessoAnalytics()` **antes** de ler `?dominio=` (linha 101) e
antes de qualquer `<Suspense>`. O docblock em `_trinca/recorte.ts:51-68` documenta que este é
precisamente o defeito que já existiu ("um `page.tsx` que devolve `<Suspense><Painel/></Suspense>`
retorna sem ter checado papel nenhum") e a correção. `jornada/page.tsx` autentica (`getAuthProfile`
+ checagem de `tenant_id`) antes do branch de Autogestão. `admin/visao-geral/page.tsx:29-32` roda o
loader com guard por união de chapéus antes de renderizar. As 3 rotas de API da Autogestão e a de
classificação autenticam na primeira instrução. Ressalva registrada em M-5: a página e a rota HTTP
usam **critérios diferentes** de papel para a mesma tela — não é brecha, é divergência.

### (c) As 4 migrations — **REPROVA** (ver C-1, A-4, M-6, M-7)

São 3 arquivos SQL + 1 README. Veredito por item:

- **Idempotência real:** apenas `20260825220000` é idempotente de verdade (`IF NOT EXISTS` em toda
  coluna/tabela/índice, `UPDATE ... WHERE ... IS NULL`, `DROP POLICY IF EXISTS` antes de cada
  `CREATE POLICY`). `20260821000000` **não é**: os `CREATE INDEX` e `CREATE POLICY` não têm guarda
  e falham na segunda execução. `20260821010000` é idempotente nos `INSERT` (`ON CONFLICT DO
  UPDATE`) mas depende de colunas que só existem depois da terceira.
- **Ordem:** invertida. As duas obsoletas rodam antes da que as corrige, e a primeira quebra por
  coluna inexistente (C-1). Sem mecanismo — só um aviso em README.
- **Schema declarado × schema consultado:** diverge em dois pontos materiais. O índice único que o
  `upsert` do pipeline exige não é criado pela migration aplicável (C-2), e os `CHECK` de domínio
  do schema original não foram replicados (M-7). A camada de **leitura**, por outro lado, casa: as
  colunas que `fonte-supabase.ts` pede (`title`, `slug`, `is_active`, `display_order`,
  `evidence_category`, `comprehension`, `depth_level`, `application_level`, `occurred_at`) são
  exatamente as que a reconciliação adiciona e preenche. As **telas** vão funcionar; o **pipeline
  que as alimenta** não.

Registro em favor da reconciliação: ela é o melhor artefato desta branch. Diagnostica o defeito
pelo nome, mede o terreno (853/764 linhas), escolhe a via aditiva sem um `DROP`, e recusa
explicitamente inventar os níveis ausentes — "ausência é honesta, chute não é". O problema não é
ela; é que ela chega em terceiro lugar numa fila que ninguém reordenou.

### (d) Vazamento de credencial ou service role para o cliente — **PASSA**

Verificação: para cada um dos 164 arquivos `.ts/.tsx` alterados fora de `__tests__`, checagem
cruzada de `"use client"` nas 3 primeiras linhas contra `supabase/service` ou `SERVICE_ROLE` no
corpo. **Zero ocorrências.** `grep -rn "SERVICE_ROLE"` nos mesmos 164 arquivos: **zero**. O único
componente cliente novo da frente (`gatilho-classificacao.tsx`) faz um `fetch` para a própria rota,
sem carregar credencial. `.dockerignore` exclui `.env*` (com `!.env.example`), então o
`apps/web/.env.local` — que aponta para produção — **não** entra na imagem apesar do `COPY . .` do
`Dockerfile:21`. Nada a corrigir neste eixo.

### (e) Erro que vira negação silenciosa ou "OK" falso — **REPROVA** (C-3, A-1, A-2, A-5, A-6, M-1)

Este é o eixo com mais achados, e o padrão é consistente: **a casa acertou onde escreveu a regra
nova e errou onde reusou código antigo.** O `feature-gate` é exemplar — `FeatureCheckUnavailableError`
separa "não sei" de "não tem direito", `maybeSingle` em vez de `single` torna a distinção
estrutural, a gravação no cache é a última instrução de propósito, e o 503 leva `Retry-After`
enquanto o 403 não. `CheckUnavailable` recusa deliberadamente usar o `fallback` do call site, com a
razão certa. As camadas de leitura das duas frentes novas (`primeiraFalha`,
`respostaDeFalhaDaFonte`) transformam erro em valor e recusam renderizar número. Nada disso é
teatro.

E, ao lado, seis lugares onde erro vira zero, vira parcial-marcado-como-completo, ou vira
`ok: true`. Os seis estão no caminho de **escrita** e no `admin-overview` — exatamente as duas
áreas que não têm teste de integração.

### (f) `any` / casts que anulam o tipo — **PASSA com ressalva**

Verificação: `grep -rn "as any\|as unknown as\|@ts-ignore\|@ts-expect-error\|: any"` nos 164
arquivos alterados, descontando `biome-ignore`.

- Os **10** `as any` em `analytics/page.tsx` são **herdados** — confirmado por
  `git diff origin/main...HEAD -- <arquivo> | grep "^+" | grep "as any"` → vazio. Nenhum foi
  introduzido nesta branch.
- Introduzidos e **justificados** (com `biome-ignore` nominal e razão real, o query builder do
  Supabase não tipa o schema gerado): `classificador/index.ts:13-14`, `admin-overview.ts:188`,
  `api/analytics/aggregate/route.ts:97`.
- Introduzido e **não justificado**: `admin/visao-geral/loader.ts:40` (M-10, `as unknown as`).
- `jornada/page.tsx:174` e `provar-elo4-nucleo.ts:329,363` usam `as unknown as` para contornar a
  inferência de join do PostgREST — padrão já presente na base, aceitável.

Ressalva de contexto: 82 dos 589 erros de lint são `noExplicitAny`, quase todos herdados. O código
novo **não piorou** esse número de forma relevante.

### (g) Duplicação real entre `lib/analytics/autogestao` e `lib/analytics/aprendizagem-time` — **PASSA no que foi perguntado, REPROVA num eixo adjacente**

Verificação: comparação dos conjuntos de funções exportadas dos dois diretórios
(`grep -ho "^export function [a-zA-Z]*" <dir>/*.ts | sort -u`, depois `comm -12`).

**Interseção: exatamente uma função — `primeiraFalha`.** As duas frentes **não** reimplementaram o
mesmo cálculo. E é coerente que não tenham: são domínios genuinamente distintos (um aluno×curso
contra um roster×capacidade), com granularidades diferentes (dias/sessões contra
evidências/maturidade). A semana de `autogestao/montagem.ts:157` é ancorada no fuso do tenant
(`resolverFusoHorarioMinutos`), a de `aprendizagem-time/semanas.ts:19` é UTC pura — divergentes de
propósito, porque uma responde "em que dia o aluno estuda" e a outra "em que janela a evidência
caiu". Não há dívida de consolidação aqui.

**O que há, e importa mais:** a duplicação real não é de cálculo, é de **contrato de leitura**.
Existem quatro implementações de "leia exaustivamente, paginando, transformando erro em valor"
(M-9), e elas divergem na parte que decide se o número é confiável. Consolidar `montagem.ts` seria
errado; consolidar `ler`/`readAll` numa única primitiva com semântica única é a dívida que este
diff realmente deixa — e A-1 é a prova de que ela já cobrou juros.

---

## Lint — classificação por regra (`pnpm biome check ./src --reporter=summary`)

**Total medido: 589 erros + 224 avisos, em 1.484 arquivos.**

### Formatação pura (cosmético): **421 erros — 71,5% do total**

421 arquivos precisam de `biome format`. Zero risco de correção. Um `pnpm biome check --write`
resolveria os 421 num commit, mas geraria diff em 421 arquivos — decisão de sequenciamento, não
técnica.

### Analisador: **168 erros + 224 avisos**

| Categoria | Regra | Erros | Avisos | Veredito |
|:--|:--|--:|--:|:--|
| **Segurança** | `security/noDangerouslySetInnerHtml` | 11 | 0 | **Risco real por classe, zero input controlável hoje.** 6 dos 16 arquivos que a disparam são as `gauntlet-preview/*/page.tsx` novas, e nelas o conteúdo é um literal estático de CSS (`LIGHT_TOKENS`), em rota que dá 404 em produção. Os outros 5 são herdados (`layout.tsx` ×3, `book-reader-client`, `verso-reader-client`, `safe-markdown.ts`). O ponto genuinamente perigoso — `customCSS` chegando ao `dangerouslySetInnerHTML` de `(platform)/layout.tsx` — foi **fechado nesta branch de propósito**: `tenant.config.ts` recusa expor `customCSS` por env, com a razão escrita ("quem edita o serviço no EasyPanel passaria a injetar CSS arbitrário na página"). Isso é a decisão certa. |
| **Correção** | `correctness/useExhaustiveDependencies` | 13 | 32 | **Risco real.** Dependência faltando em `useEffect`/`useMemo` é closure obsoleta: o componente lê um valor velho e não re-renderiza. Nenhum é do código novo desta frente (os componentes novos são majoritariamente RSC). |
| **Correção** | `suspicious/noArrayIndexKey` | 8 | 136 | **Risco real, baixo impacto.** Chave por índice quebra a reconciliação do React em listas reordenáveis/filtráveis — estado de um item aparece em outro. Relevante porque as telas novas têm listas com filtro. |
| **Correção** | `suspicious/noAssignInExpressions` · `style/noParameterAssign` · `style/useConst` | 1 + 3 + 2 | 0 + 0 + 6 | **Risco real, baixo.** Efeito colateral escondido em expressão e mutação de parâmetro são fontes clássicas de bug de leitura. |
| **Correção** | `suspicious/suppressions/parse` | 2 | 0 | **Risco real.** Um `biome-ignore` malformado **não suprime nada** — a regra que alguém achou ter desligado continua ligada, ou pior, a supressão pretendida some sem aviso. |
| **Tipagem** | `suspicious/noExplicitAny` | 82 | 18 | **Risco real, herdado.** 82 pontos onde o compilador está desligado. Confirmado que a branch não introduziu nenhum sem `biome-ignore` justificado (ver eixo (f)). É o maior bolsão isolado do analisador e o candidato natural a um loop de redução dedicado. |
| **Acessibilidade** | `a11y/useMediaCaption` · `noAutofocus` · `useValidAriaRole` · `noSvgWithoutTitle` · `useButtonType` · `useFocusableInteractive` | 12+3+1 | 16+9+6 | **Nem risco de correção, nem cosmético** — é conformidade de acessibilidade. Não quebra o produto; afeta usuário com leitor de tela. Categoria própria: **16 erros + 31 avisos**. |
| **Cosmético** | `useImportType` (9) · `noUnusedTemplateLiteral` (9) · `useTemplate` (6) · `useLiteralKeys` (3) · `useOptionalChain` (1) · `useExponentiationOperator` (1) · `noUnnecessaryContinue` (1) · `noInvalidPositionAtImportRule` (0e/1a) | 30 | 1 | Zero risco. |

### Resumo do lint

| Classe | Erros | % dos 589 |
|:--|--:|--:|
| Formatação (cosmético) | 421 | 71,5% |
| Tipagem — `noExplicitAny` (herdado) | 82 | 13,9% |
| **Correção — risco real** | **27** | **4,6%** |
| **Segurança — risco real por classe** | **11** | **1,9%** |
| Acessibilidade | 16 | 2,7% |
| Estilo (cosmético) | 30 | 5,1% |
| Outros | 2 | 0,3% |

**Leitura em uma linha:** 85% dos 589 é formatação e `any` herdado. O que merece atenção humana são
**38 erros** (27 de correção + 11 de segurança), e nenhum deles nasceu nesta branch.

---

## O que esta revisão NÃO cobriu

- **Estado real do banco de produção.** A-4 depende de uma consulta a `pg_class`/`pg_policies` que
  não executei — `.env.local` aponta para produção e escrita/consulta ao banco está fora do escopo
  deste loop. Se a resposta for `relrowsecurity = false`, A-4 vira CRÍTICO.
- **Delta herdado × introduzido** dos 36 erros de TS e dos 69 testes falhando — apurado em paralelo
  por outro agente, conforme o briefing.
- **Fidelidade visual** das telas contra a referência do dono — escopo do LOOP funcional/visual.
- **Se os build args de marca estão de fato configurados no serviço do EasyPanel** — é configuração
  fora do repositório. O que revisei foi o mecanismo (que está correto no gate 1 e ausente no
  gate 2, A-3).

---

## Recomendação de sequenciamento

1. **C-2 antes de qualquer deploy.** Sem o índice, a frente "Aprendizagem do Time" é uma tela vazia
   com 5.500 linhas de código atrás. Correção de uma linha de SQL.
2. **C-3 junto com C-2.** Enquanto o `processed` mentir, ninguém vai descobrir C-2 pelo monitoramento.
3. **C-1 antes de qualquer ambiente novo.** Não bloqueia a produção atual; bloqueia staging, CI e o
   segundo cliente.
4. **A-4 é uma consulta de 30 segundos** e pode reclassificar a urgência de tudo.
5. **A-1 e A-2** antes de `/admin/visao-geral` ser mostrada a um admin que vá decidir algo com ela.
6. O lint (421 de formatação) é um commit isolado, depois de tudo acima — nunca junto, ou o diff de
   revisão some dentro dele.
