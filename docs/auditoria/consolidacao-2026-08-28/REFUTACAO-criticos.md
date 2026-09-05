# Refutação dos 3 críticos — Aprendizagem do Time

> Papel: **refutador**. A premissa de partida foi que as três alegações estão erradas, e só a
> evidência forçaria o contrário. Nenhuma escrita foi feita no banco. HEAD intocado (`d2b8083`).
> Data: 2026-08-28. Banco consultado: produção `vaguswivhqnlbgqvnjch` (leitura apenas).

## Veredito em uma linha

| # | Alegação | Veredito | Observação |
|:--|:---|:---|:---|
| C-1 | `supabase db push` travado | **CONFIRMADO** (conclusão certa, raciocínio incompleto) | Gravidade real REBAIXADA no curto prazo, ELEVADA no longo |
| C-2 | O `upsert` não pode gravar | **CONFIRMADO** por razão mais fundamental que a alegada | Gravidade MÁXIMA, e pior que o descrito |
| C-3 | Rota devolve `ok: true` com 100% de falha | **CONFIRMADO** em substância | Atribuição imprecisa: não é o `catch` da rota |

---

## A prova empírica que decide tudo

Antes de qualquer leitura de migration: **a tabela `capability_evidence` em produção não tem
nenhuma das colunas que a entrega assume.** Isto derruba a discussão inteira para um patamar
mais raso do que o das três alegações.

### Colunas vivas de `capability_evidence`

```sql
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name='capability_evidence'
 ORDER BY ordinal_position;
```

```
id            uuid                      NO
tenant_id     uuid                      NO
student_id    uuid                      NO
capability_id uuid                      NO
criterion_id  uuid                      NO
course_id     uuid                      NO
chapter_id    uuid                      YES
category      text                      NO
source_type   text                      NO
source_id     uuid                      YES
observed_at   timestamptz               NO
created_at    timestamptz               NO
```

**12 colunas. Ausentes:** `concept_id`, `evidence_category`, `source_table`, `comprehension`,
`depth_level`, `application_level`, `confidence`, `classification_model`,
`classification_signals`, `classification_reasoning`, `criteria_met`, `occurred_at`,
`classified_at`. As treze.

A primeira consulta que tentei falhou por si só, e o erro é a prova:

```sql
SELECT count(*), count(comprehension), count(depth_level) FROM public.capability_evidence;
-- ERROR: 42703: column "comprehension" does not exist
```

### Contagem, RLS e recência

```sql
SELECT (SELECT count(*) FROM public.capability_evidence)   AS evidencias,
       (SELECT count(*) FROM public.capabilities)          AS capacidades,
       (SELECT count(*) FROM public.capability_criteria)   AS criterios,
       (SELECT max(created_at)::text FROM public.capability_evidence) AS ultima_evidencia,
       (SELECT relrowsecurity FROM pg_class
         WHERE relname='capability_evidence' AND relnamespace='public'::regnamespace) AS rls_ligada,
       (SELECT count(*) FROM pg_policy
         WHERE polrelid='public.capability_evidence'::regclass) AS n_policies;
```

```json
[{"evidencias":853,"capacidades":15,"criterios":63,
  "ultima_evidencia":"2026-08-25 19:35:51.444593+00",
  "rls_ligada":true,"n_policies":4}]
```

Distribuição temporal — **todas as 853 linhas nasceram no mesmo dia, em lote**:

```sql
SELECT date_trunc('day', created_at)::date::text AS dia, count(*)
  FROM public.capability_evidence GROUP BY 1 ORDER BY 1 DESC LIMIT 12;
-- [{"dia":"2026-08-25","count":853}]
```

Zero gravações depois de 25/08 19:35. O `observed_at` das linhas é de julho (`2026-07-28`),
confirmando backfill histórico, não pipeline vivo.

### Índices (a pergunta central de C-2)

```sql
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'capability_evidence';
```

```
capability_evidence_pkey                         UNIQUE btree (id)
idx_capability_evidence_student_course_observed  btree (student_id, course_id, observed_at)
idx_capability_evidence_capability_criterion     btree (capability_id, criterion_id)
idx_capability_evidence_tenant                   btree (tenant_id)
```

**`capability_evidence_source_capability_uidx` NÃO EXISTE.** Nenhum índice único além da PK.
Nenhum índice parcial. A questão "é parcial?" nem chega a se colocar.

### As 5 tabelas novas

```sql
SELECT to_regclass('public.concepts')::text, to_regclass('public.capability_concepts')::text,
       to_regclass('public.capability_assessments')::text,
       to_regclass('public.capability_assessment_evidence')::text,
       to_regclass('public.capability_assessment_criteria')::text;
-- [{"concepts":null,"capability_concepts":null,"capability_assessments":null,
--   "cae":null,"cac":null}]
```

**Nenhuma existe.** Ou seja: **nem `20260821000000` nem `20260825220000` foram aplicadas em
produção**, por nenhum caminho, nem dentro nem fora do fluxo rastreado.

Histórico registrado (que na casa sub-reporta, mas aqui coincide com o schema):

```sql
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 4;
-- 20260731000000 slide_interaction_point
-- 20260730000000 chapter_view_progress
-- 20260729000000 fix_jornada_insert_manager_view_as_student
-- 20260726000000 jornada_progresso
```

Nada de agosto. `WHERE version >= '20260801000000'` devolve `[]`.

### Prova pelo próprio PostgREST (o caminho exato do `upsert`)

```
GET /rest/v1/capability_evidence?select=source_table&limit=1
{"code":"42703","hint":"Perhaps you meant to reference the column
 \"capability_evidence.source_type\".",
 "message":"column capability_evidence.source_table does not exist"}

GET /rest/v1/capability_evidence?select=category,source_type,observed_at&limit=2
[{"category":"cognitiva","source_type":"reflexao","observed_at":"2026-07-28T19:59:07.96+00:00"},
 {"category":"cognitiva","source_type":"reflexao","observed_at":"2026-07-28T20:15:33.106+00:00"}]
```

---

## C-1 — `supabase db push` travado → **CONFIRMADO**, com o raciocínio corrigido

### O que a alegação acerta

O mecanismo está certo para produção. Contra o terreno ocupado:

- `CREATE TABLE IF NOT EXISTS public.capability_evidence` → **cala** (a tabela já existe, com as
  12 colunas antigas).
- `CREATE UNIQUE INDEX capability_evidence_source_capability_uidx ON …(source_table, source_id,
  capability_id)` → **42703**, `source_table` não existe. Primeira falha dura.
- `idx_capability_evidence_category` referencia `evidence_category` → mesma classe de falha.
- A migration tem `BEGIN;`/`COMMIT;` explícitos (linhas 43 e final) → **rollback total**.
- `20260825220000` tem timestamp maior → nunca é alcançada nesse cenário.

Tudo isto se sustenta e está provado pela lista de colunas acima.

### O que a alegação erra, e o erro importa

> "a reconciliação `20260825220000` — **a única que funciona**"

**Falso em ambiente novo.** A reconciliação lê colunas do schema ANTIGO que a
`20260821000000` nunca cria:

```sql
UPDATE public.capabilities SET slug  = replace(code, '_', '-') WHERE slug IS NULL;
UPDATE public.capabilities SET title = name                    WHERE title IS NULL;
UPDATE public.capabilities SET display_order = "order"         WHERE display_order IS NULL;
UPDATE public.capability_criteria SET display_order = "order"  WHERE display_order IS NULL;
UPDATE public.capability_evidence SET evidence_category = CASE category …
UPDATE public.capability_evidence SET source_table      = CASE source_type …
UPDATE public.capability_evidence SET occurred_at       = observed_at …
```

Colunas vivas confirmadas por consulta:

```sql
SELECT table_name, string_agg(column_name, ', ' ORDER BY ordinal_position)
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name IN ('capabilities','capability_criteria')
 GROUP BY table_name;
```

```
capabilities        id, tenant_id, course_id, code, name, description, focus_text, order,
                    created_at, updated_at
capability_criteria id, capability_id, tenant_id, code, description, weight, order
```

`code`, `name`, `"order"`, `category`, `observed_at` existem **só no schema legado**. A
`20260821000000` cria `slug`/`title`/`display_order` e **não** cria `code`/`name`/`order`.
Logo, em banco virgem: migration 1 passa, migration 2 quebra em `column "code" does not exist`
(erro de parse, independente de haver linhas).

### Veredito de C-1

**CONFIRMADO**, e o problema real é **pior e simétrico** ao alegado:

| Ambiente | `20260821000000` | `20260825220000` |
|:---|:---|:---|
| Produção (terreno ocupado) | **FALHA** (`source_table` inexistente) | passaria |
| Ambiente novo (terreno vazio) | passa | **FALHA** (`code` inexistente) |

**O par não é aplicável em ordem em ambiente nenhum.** Cada migration só funciona no terreno
que a outra não produz.

### Gravidade real, ajustada ao contexto operacional

**Curto prazo: BAIXA.** Ninguém roda `db push` neste projeto.
- Único workflow de CI é `.github/workflows/ci.yml`, sem nenhum passo de `supabase`/`migration`.
- `db push` já está não-funcional aqui desde julho por divergência de histórico (12 migrations
  remotas ausentes localmente, 11 locais não aplicadas remotamente). O caminho real de DDL nesta
  casa é a Management API, migration a migration.

**Longo prazo: ALTA.** A consequência que C-1 aponta ("staging, CI, segundo cliente") é real e
inevitável no dia em que qualquer um deles for provisionado — e agora sabemos que **nem a
reconciliação salva**, porque ela também quebra em terreno virgem. Não existe hoje sequência
capaz de levantar este schema do zero.

---

## C-2 — o `upsert` não pode gravar → **CONFIRMADO**, e por razão mais fundamental

`apps/web/src/lib/analytics/aprendizagem-time/classificador/index.ts:51-76`.

### Argumento (a) da alegação: CORRETO

`capability_evidence_source_capability_uidx` não existe no banco (saída de `pg_indexes` acima).

### Argumento (b) da alegação: CORRETO NO ESPÍRITO, mas INALCANÇÁVEL na prática

O `42P10` por índice parcial é uma hipótese sobre um estado do banco que **não existe**. O
`upsert` morre muito antes de o PostgREST tentar inferir árbitro de `ON CONFLICT`: das 19
chaves do payload, **13 apontam para colunas inexistentes**, e a primeira delas já derruba o
request (provado no `GET …?select=source_table` acima, `42703`).

Há um segundo bloqueio independente, que sobreviveria mesmo se as 13 colunas existissem: o
payload **não fornece** três colunas `NOT NULL` da tabela viva — `criterion_id`, `category`,
`observed_at`.

### Caminho alternativo de gravação: NÃO EXISTE

```bash
grep -rn "capability_evidence" apps/web/src --include='*.ts' --include='*.tsx' \
  | grep -E "insert|upsert|rpc|from\("
```

```
classificador/index.ts:51    .from("capability_evidence").upsert(      ← ÚNICA escrita
classificador/index.ts:79    console.error(… upsert … falhou …)
classificador/index.ts:116   .from("capability_evidence")              ← leitura
fonte-supabase.ts:169        .from("capability_evidence")              ← leitura
classificador/fontes-evidencia.ts:196 .from("capability_evidence")     ← leitura
```

`grep` em `scripts/` e `packages/` não retornou nenhum `insert`/`rpc` sobre a tabela. As 853
linhas de 25/08 vieram de fora do repositório e são anteriores a qualquer nível classificado.

### Versão do cliente (para fechar a linha 3 de investigação)

`@supabase/supabase-js` declarado `^2.49.1`, **instalado 2.98.0**. Irrelevante para o desfecho:
o erro é `42703` do próprio Postgres, não uma particularidade de emissão de `on_conflict`.

### O que a alegação erra

> "as 3 telas exibem 'amostra ainda insuficiente' permanentemente"

**Falso, e a realidade é pior.** A camada de leitura não chega a avaliar amostra. A **primeira**
consulta de `fonte-supabase.ts:88-100` é:

```ts
.from("capabilities").select("id, course_id, title, slug")
  .eq("is_active", true).order("display_order")
```

`title`, `slug`, `is_active`, `display_order` **não existem** em `capabilities` (lista de
colunas acima). O helper `ler<>` (linhas 47-72) converte qualquer `error` em `FalhaLeitura` e
devolve `linhas: []`. E `estado-bloco.ts` distingue explicitamente os dois desfechos:

```ts
export function blocoVazio(…)  // estado: "vazio", textoVazio: "Amostra ainda insuficiente"
export function blocoErro(…)   // estado: "erro",  erro: FalhaLeitura
```

O caminho percorrido é `blocoErro`, não `blocoVazio`. As telas renderizam **estado de erro**,
não vazio honesto. É consistente com o que o cabeçalho da própria migration de reconciliação
registra: *"a tela quebraria em runtime pedindo `capabilities.title` — que foi exatamente o erro
visto em produção às 18:57"*.

### Veredito de C-2

**CONFIRMADO.** Nenhuma linha é gravada, jamais. Os níveis não são `NULL` — **as colunas não
existem**. Gravidade **MÁXIMA**: a frente inteira está morta em produção, e o sintoma visível ao
gestor é erro, não vazio.

---

## C-3 — rota devolve `ok: true` com 100% de falha → **CONFIRMADO** (atribuição imprecisa)

### Onde a alegação erra

O `catch` **da rota** não engole nada. `classify/route.ts:49-52`:

```ts
} catch (error) {
  console.error("[aprendizagem-time] classify route error:", error)
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}
```

Isso é 500 honesto.

### Onde a alegação acerta

O engolimento está uma camada abaixo, em `classificador/index.ts:78-81`:

```ts
if (error) {
  console.error("[aprendizagem-time] upsert de capability_evidence falhou:", error.message)
  continue                     // ← falha por linha, silenciada, laço segue
}
paresTocados.add(`${evidencia.studentId}:${evidencia.capabilityId}`)
```

E a contagem, em `index.ts:101-105`:

```ts
return {
  processadas: pendentes.length,   // ← candidatos BUSCADOS, não gravados
  pendentesRestantes: …,
  capacidadesReavaliadas,
}
```

`paresTocados` — o único conjunto que só cresce em caso de sucesso — é usado para reavaliação e
depois **descartado**. Nunca vira número de retorno.

Com 100% de falha no `upsert`, a rota responde:

```json
{ "ok": true, "processed": 20, "pending": 1, "reassessed": 0 }
```

### Veredito de C-3

**CONFIRMADO** na consequência (`ok: true` + `processed` inflado com falha total), com a
correção de que o mecanismo é o `if (error) { continue }` do laço, não o `catch` da rota.

**Gravidade: ALTA como cegueira diagnóstica.** É precisamente este defeito que permitiu C-2
permanecer invisível: o único sinal de fumaça é `reassessed: 0`, fácil de ler como "nada mudou".
Um `processed` derivado de `paresTocados.size` teria exibido `0` e denunciado a falha no
primeiro disparo.

---

## Conclusão do refutador

Entrei para derrubar as três. **Não consegui derrubar nenhuma** — e a investigação empírica
encontrou um chão mais baixo do que o que a auditoria original descreveu:

1. Não é que a migration esteja "travada" só em ambiente novo — **ela nunca foi aplicada em
   lugar nenhum**, e o par de migrations é mutuamente exclusivo por terreno.
2. Não é que o `upsert` falhe na inferência de árbitro — **as colunas não existem**, e o erro é
   `42703` antes de qualquer `ON CONFLICT`.
3. As telas não mostram vazio honesto — **mostram erro**.

O único ajuste **para baixo** é o de C-1 no curto prazo: como ninguém executa `db push` neste
projeto e o CI não tem passo de migration, o `db push` travado não é o que quebra produção hoje.
O que quebra produção é a ausência pura e simples do schema.
