# LOOP-7 — Migration de convergência: preparo, prova e plano de aplicação

> **Estado: PREPARADA, NÃO APLICADA.** Nenhuma escrita foi feita no banco de
> produção. HEAD intocado (`d2b8083`), nenhum commit, nenhum push.
> Data: 2026-08-28. Banco consultado: produção `vaguswivhqnlbgqvnjch`, **leitura apenas**.

---

## 1. O problema, em uma tabela

A auditoria (`REFUTACAO-criticos.md`) provou que o schema desta frente nunca foi
aplicado em lugar nenhum e que o par de migrations é **mutuamente exclusivo por
terreno**. Reproduzi isso com instrumento próprio, em PostgreSQL real:

| Terreno | `20260821000000` | `20260825220000` |
|:---|:---|:---|
| Ocupado (produção) | **FALHA** — `relation "idx_capability_criteria_capability" already exists` | passaria |
| Virgem (staging/CI/cliente novo) | passa | **FALHA** — `column "code" does not exist` |

> **Correção de detalhe à auditoria:** ela previa que a `20260821000000` morreria
> no índice único sobre `source_table` (42703). Contra a réplica do terreno vivo
> ela morre **antes**, num `CREATE INDEX` sem guarda cujo nome já existe. O
> veredito é idêntico — não roda em produção —, mas a primeira pedra é outra.

---

## 2. Os quatro bloqueios do `upsert` — provados um a um

A auditoria identificou o `42703`. Medindo contra a réplica do terreno vivo,
encontrei **quatro bloqueios independentes**, e resolver só o primeiro deixaria
o pipeline morto do mesmo jeito, com outro código de erro:

| # | Bloqueio | Erro | Como a migration resolve |
|:--|:---|:---|:---|
| 1 | 13 colunas ausentes | `42703 column "source_table" does not exist` | `ADD COLUMN IF NOT EXISTS` das 13 |
| 2 | Índice árbitro do `ON CONFLICT` inexistente | `42P10` na inferência | `CREATE UNIQUE INDEX` **não-parcial** |
| 3 | `criterion_id`, `category`, `observed_at` são `NOT NULL` e o payload não os fornece | `23502 null value in column "criterion_id"` | `DROP NOT NULL` nas três |
| 4 | O `CHECK` de `source_type` só admite **português**; o pipeline escreve **inglês** | `23514 violates check constraint "capability_evidence_source_type_check"` | `CHECK` ampliado para a união dos dois vocabulários |

O bloqueio 4 **não estava na auditoria** e é o mais traiçoeiro: sobreviveria
intacto a qualquer correção que só adicionasse colunas. Prova literal:

```
capability_evidence_source_type_check
  CHECK (source_type = ANY (ARRAY['reflexao','socratica','quiz','atividade','aplicacao_real']))
```
contra `classificador/fontes-evidencia.ts`, que grava
`'reflection' | 'quiz' | 'scenario' | 'assignment' | 'socratic_session'`.

---

## 3. Levantamento do terreno real (leitura, saídas coladas)

Todas as consultas passaram por `loop7-harness/loop7-q.sh`, que **recusa** enviar
qualquer SQL contendo verbo de escrita. O guarda disparou uma vez, corretamente,
numa consulta que continha as palavras `INSERT`/`UPDATE`/`DELETE` como literais
de um `CASE` — a consulta foi reescrita, o guarda não foi afrouxado.

### 3.1 Colunas vivas

```
=== capabilities ===                    === capability_criteria ===
id            uuid NOT NULL             id            uuid NOT NULL
tenant_id     uuid NOT NULL             capability_id uuid NOT NULL
course_id     uuid NOT NULL             tenant_id     uuid NOT NULL
code          text NOT NULL             code          text NOT NULL
name          text NOT NULL             description   text NOT NULL
description   text NOT NULL             weight        numeric NOT NULL DEFAULT 1
focus_text    text NOT NULL             order         integer NOT NULL DEFAULT 0
order         integer NOT NULL DEFAULT 0
created_at    timestamptz NOT NULL      === capability_evidence ===
updated_at    timestamptz NOT NULL      id, tenant_id, student_id, capability_id NOT NULL,
                                        criterion_id NOT NULL, course_id NOT NULL,
                                        chapter_id, category NOT NULL, source_type NOT NULL,
                                        source_id (nullable), observed_at NOT NULL, created_at
```

`capability_criteria` **não tem `created_at`** em produção — detalhe ausente da
auditoria, que a migration passa a criar.

### 3.2 Constraints de `capability_evidence`

```
c | capability_evidence_category_check    | CHECK (category = ANY (ARRAY['cognitiva','aplicada','real']))
c | capability_evidence_source_type_check | CHECK (source_type = ANY (ARRAY['reflexao','socratica','quiz','atividade','aplicacao_real']))
f | capability_evidence_capability_id_fkey → capabilities(id) ON DELETE CASCADE
f | capability_evidence_criterion_id_fkey  → capability_criteria(id) ON DELETE CASCADE
f | capability_evidence_course_id_fkey / chapter_id_fkey / student_id_fkey / tenant_id_fkey
p | capability_evidence_pkey (id)
```

Os rótulos reais são `cognitiva`/`aplicada`/`real`. A migration de reconciliação
traduzia de `'aplicacao'` e `'contexto_real'` — **rótulos que não existem no
domínio**. Aqueles dois ramos do `CASE` nunca casariam.

### 3.3 O índice único é criável? (a pergunta que decide tudo)

```json
[{"total":853,"source_id_nulo":0,"tipos_distintos":2,
  "tipos":"reflexao,socratica","categorias":"cognitiva",
  "grupos_duplicados":0,"maior_grupo":1}]
```

**Zero grupos duplicados no grão novo `(source_table, source_id, capability_id)`,
maior grupo = 1, nenhum `source_id` nulo.** O índice único é criável sobre as 853
linhas sem tocar em nenhuma. Se houvesse duplicata, este plano seria outro.

### 3.4 Policies RLS vivas (o padrão a espelhar)

```
capabilities        :: cap_tenant_select     [SELECT] tenant_id = auth_tenant_id()
capabilities        :: cap_staff_write       [ALL]    tenant + auth_user_role() = ANY(instructor,manager,admin)
capabilities        :: cap_super_admin       [ALL]    is_super_admin()
capability_criteria :: (mesmo trio, prefixo capcrit_)
capability_evidence :: capev_student_select  [SELECT] student_id = auth.uid() AND tenant
capability_evidence :: capev_staff_select    [SELECT] tenant + auth_user_role() = ANY(instructor,manager,admin)
capability_evidence :: capev_staff_insert    [INSERT] WITH CHECK tenant + staff
capability_evidence :: capev_super_admin     [ALL]    is_super_admin()
```

**As policies vivas usam `auth_user_role()`, não `has_role()`** — e **incluem
`manager`**. As migrations obsoletas supunham `has_role()` e excluíam `manager`
de propósito. A migration nova espelha o vivo (ver §6, decisão D5).

Helpers confirmados: `auth_tenant_id()`, `has_role(uuid,text)`, `is_super_admin()`,
`auth_user_role()` — todos `SECURITY DEFINER`.

### 3.5 Grants

Privilégios default do schema `public` concedem `arwdDxtm` a
`anon`/`authenticated`/`service_role` para toda tabela nova. Nenhum `GRANT`
explícito é necessário; RLS é o portão. (Ver §8, achado sistêmico.)

### 3.6 Currículo vivo

```
clareza_fenomeno        | Clareza do fenômeno        | order=0
pensamento_causal       | Pensamento causal          | order=1
uso_evidencia           | Uso de evidência           | order=2
construcao_contramedida | Construção de contramedida | order=3
verificacao_eficacia    | Verificação de eficácia    | order=4
```
15 linhas = 5 capacidades × 3 cursos homônimos "Análise e Solução de Problemas"
(3 tenants). Nenhum leitor das colunas legadas (`code`/`name`/`focus_text`) foi
encontrado neste repositório fora da própria camada de Aprendizagem do Time.

---

## 4. O caminho de correção escolhido, e por quê

**Um alvo único, alcançável dos dois terrenos** — em vez de duas migrations, cada
uma correta em um terreno.

A chave é: **o alvo convergido contém a UNIÃO das colunas legadas e novas, nos
dois terrenos.** Num banco virgem a tabela nasce já com `code`/`name`/`order`
(nullable); num banco ocupado essas colunas já estão lá. Consequência: todo
backfill pode ser SQL estático, porque as colunas que ele referencia existem
sempre. Foi exatamente a ausência dessa propriedade que tornou o par anterior
mutuamente exclusivo.

É deliberadamente a fase **expand** de um expand/contract. A fase **contract**
— dropar `criterion_id`/`category`/`observed_at`/`code`/`name`/`focus_text` e
estreitar o `CHECK` de `source_type` de volta só para o inglês — é uma migration
futura, depois que o pipeline rodar e o código estiver uniforme.

### O poka-yoke contra "passou verde sem aplicar"

Todo `IF NOT EXISTS` é silencioso por natureza, e esta casa já pagou caro por
isso (3 tabelas com 931 linhas em produção que nenhuma migration criava). Por
isso o **bloco 10** da migration mede a estrutura real e `RAISE EXCEPTION` se o
alvo não foi atingido: colunas, índices, nullability, **o árbitro não ser
parcial**, RLS ligada, e nenhuma tabela com RLS ligada e zero policy. Silêncio
deixou de ser um desfecho possível: ou converge, ou grita e derruba a transação.

---

## 5. A migration foi testada? **Sim** — e onde

**Ambiente:** PGlite 0.5.8 (**PostgreSQL 18.3 real**, WASM), local, fora do
repositório. Não há `psql`, `pg_dump` nem Docker nesta máquina, e o acesso à
produção não expõe string de conexão — por isso PGlite, e não uma réplica pgdump.

**Limite honesto:** produção é PostgreSQL **17.6**; o teste rodou em **18.3**.
Nenhuma construção usada mudou entre as duas, mas a diferença existe. E as
tabelas-pai e os helpers de RLS são stubs: isto testa **DDL e aplicabilidade**,
não o comportamento das policies contra dado real (ver passo 5 do §7).

### 5.1 Cenário A — terreno ocupado (réplica do schema vivo, com dado)

```
  PASS  migration aplicou sem erro
  PASS  evidências preservadas (10 → 10)
  PASS  capacidades preservadas, sem duplicar (5 → 5)
  PASS  slug backfilled com o mapa explícito (clareza-do-fenomeno, pensamento-causal,
        uso-de-evidencia, construcao-de-contramedida, verificacao-de-eficacia)
  PASS  title backfilled a partir de name
  PASS  category 'cognitiva' → evidence_category 'cognitive' em 10/10
  PASS  source_type → source_table em 10/10
  PASS  observed_at → occurred_at em 10/10
  PASS  as 8 tabelas existem (8/8)
  PASS  árbitro do onConflict existe, é ÚNICO e NÃO-PARCIAL
  PASS  criterion_id/category/observed_at estão NULLABLE
  PASS  RLS ligada nas 8 tabelas (8/8)
  PASS  nenhuma tabela com RLS ligada e zero policy (0 órfãs)
  PASS  upsert do pipeline (19 colunas, vocabulário EN) GRAVOU
  PASS  upsert repetido resolveu por ON CONFLICT, sem duplicar (1 linha)
  PASS  reaplicação é no-op (evidências 11→11, capacidades 5→5)
  PASS  terreno ocupado NÃO foi re-semeado (currículo vivo intacto)
```

### 5.2 Cenário B — terreno virgem

```
  PASS  migration aplicou sem erro
  PASS  as 8 tabelas existem (8/8)
  PASS  árbitro do onConflict existe, é ÚNICO e NÃO-PARCIAL
  PASS  criterion_id/category/observed_at estão NULLABLE
  PASS  RLS ligada nas 8 tabelas (8/8)
  PASS  nenhuma tabela com RLS ligada e zero policy (0 órfãs)
  PASS  upsert do pipeline (19 colunas, vocabulário EN) GRAVOU
  PASS  upsert repetido resolveu por ON CONFLICT, sem duplicar (1 linha)
  PASS  reaplicação é no-op
  PASS  terreno virgem foi semeado (5 capacidades, 21 critérios)
```

### 5.3 Mutação — porque verde sozinho não prova nada

Sabotei a migration em 4 pontos. Se o harness não reprovasse, ele estaria cego:

```
  PASS  M1 — árbitro volta a ser PARCIAL → convergência NÃO atingida: está PARCIAL (42P10)
  PASS  M2 — sem relaxar NOT NULL      → convergência NÃO atingida: NOT NULL remanescente
  PASS  M3 — sem ampliar o CHECK       → constraint "…source_type_check" already exists
  PASS  M4 — slug por conversão mecânica → slug divergente: 'clareza-fenomeno'
```

### 5.4 A sequência completa, em ordem de timestamp (o que `db push` faria)

```
  PASS  terreno VIRGEM:  as 4 migrations rodam em ordem — sem erro
  PASS  terreno VIRGEM:  estado final tem as 8 tabelas (8/8)
  PASS  terreno VIRGEM:  upsert do pipeline grava ao fim da sequência
  PASS  terreno OCUPADO: as 4 migrations rodam em ordem — sem erro
  PASS  terreno OCUPADO: estado final tem as 8 tabelas (8/8)
  PASS  terreno OCUPADO: upsert do pipeline grava ao fim da sequência
```

Instrumentos e saídas literais: `loop7-harness/`.

---

## 6. Decisões, com o trade-off de cada uma

| # | Decisão | Por quê | Trade-off aceito |
|:--|:---|:---|:---|
| D1 | Migration **nova** (`20260828120000`), não edição das antigas | Preserva o registro do que houve; timestamp posterior mantém a ordem | Mais um arquivo no diretório |
| D2 | **Neutralizar** as 3 obsoletas em no-ops **declarados** | Nenhuma roda em sequência em terreno algum; deixá-las vivas mantém `db push` quebrado para sempre. Cada arquivo conserva o cabeçalho explicando o que fazia, por que morreu, e o commit onde o corpo está | Quem ler só o diretório vê 3 arquivos sem efeito; mitigado pelo cabeçalho e pelo ponteiro de git |
| D3 | O **seed** migra para dentro da migration nova (bloco 9) | Problema de **ordem**: o timestamp do seed é MENOR que o do schema convergido. Num terreno virgem ele rodaria antes da tabela existir — irrecuperável por idempotência | O seed deixa de ter arquivo próprio |
| D4 | Seed guardado pelo **estado real** (`NOT EXISTS capabilities do curso`), não por `ON CONFLICT` | O `ON CONFLICT (course_id, slug)` do seed original **erraria o alvo em 4 dos 5 casos**, porque os slugs dele não batem com a conversão dos `code` vivos, e tentaria inserir capacidade duplicada | Um curso com currículo parcial não é completado; é o comportamento seguro |
| D5 | RLS espelha o **padrão vivo** (`auth_user_role()`, com `manager`) | Duas definições de "quem pode ler" divergem no dia em que uma muda. As tabelas novas de dado individual seguem o irmão vivo | Propaga `manager` com leitura tenant-wide (ver §8, achado 1) |
| D6 | Índice árbitro **não-parcial** | O PostgREST emite a lista de colunas sem o predicado; contra índice parcial a inferência falha com `42P10` | Índice guarda também linhas de `capability_id` NULL; custo desprezível |
| D7 | Colunas legadas viram **nullable** em vez de serem dropadas | Preserva todo o dado e todo leitor externo ao repo; é a fase expand | Duas colunas para a mesma grandeza até a contração |

### A pergunta que a tarefa pediu para responder explicitamente

> *A semântica de NULL em índice único resolve o caso que o `WHERE` tentava cobrir,
> ou o código precisa mudar junto?*

**Resolve integralmente. Nenhuma mudança de código é necessária por causa deste
ponto.** Sob `NULLS DISTINCT` (o default do Postgres), duas linhas com
`capability_id` NULL nunca são consideradas iguais, logo o índice único **jamais
as rejeita** — exatamente o efeito que o `WHERE capability_id IS NOT NULL`
buscava. A única diferença é o índice armazenar essas linhas, custo irrelevante
nesta escala. Verificado no cenário B, onde `capability_id` é nullable e o
`upsert` grava e reaplica sem colidir.

O índice **parcial** de dedup por conceito (`…_source_concept_uidx`) foi mantido
parcial: nenhum `onConflict` do código o usa como árbitro, então ele não sofre o
`42P10`.

---

## 7. Plano de aplicação — executável por quem não viu esta análise

**Pré-requisito:** decisão explícita do Senhor. Este banco é produção compartilhada,
com alunos reais dentro.

**Mecanismo:** `POST https://api.supabase.com/v1/projects/vaguswivhqnlbgqvnjch/database/query`
com `{"query":"<sql>"}`, autenticado pelo PAT do keychain:
```bash
RAW=$(security find-generic-password -s "Supabase CLI" -a supabase -w)
PAT=$(printf '%s' "${RAW#go-keyring-base64:}" | base64 --decode)
```
**Não usar `supabase db push`** — o histórico local e o remoto divergiram
(≈12 migrations remotas ausentes localmente, ≈11 locais não aplicadas) e o CLI
recusa rodar até uma reconciliação que está fora do escopo deste passo.

### Passo 0 — fotografia do antes (LEITURA)

```sql
SELECT (SELECT count(*) FROM public.capability_evidence)  AS evidencias,   -- esperado 853
       (SELECT count(*) FROM public.capabilities)         AS capacidades,  -- esperado 15
       (SELECT count(*) FROM public.capability_criteria)  AS criterios,    -- esperado 63
       (SELECT count(*) FROM information_schema.columns
         WHERE table_schema='public' AND table_name='capability_evidence') AS colunas; -- esperado 12
```
**Anote os quatro números.** São a régua de tudo que vem depois.

### Passo 1 — aplicar a migration, inteira, de uma vez

Enviar o conteúdo literal de
`supabase/migrations/20260828120000_aprendizagem_time_convergencia.sql`.

O arquivo tem `BEGIN;`/`COMMIT;` explícitos: **ou aplica tudo, ou nada**. Se o
bloco 10 de verificação reprovar, a transação inteira é revertida e o banco fica
exatamente como estava — este é o rollback do passo 1, e ele é automático.

**Sucesso esperado:** sem erro, e nos avisos deve constar
`Aprendizagem do Time: convergência verificada (…)` e
`nenhum curso semeado … Nenhuma linha existente foi tocada`.

### Passo 2 — verificar o estado (LEITURA)

```sql
SELECT (SELECT count(*) FROM public.capability_evidence) AS evidencias,        -- 853, IGUAL ao passo 0
       (SELECT count(*) FROM public.capabilities)        AS capacidades,       -- 15,  IGUAL ao passo 0
       (SELECT count(*) FROM public.capability_criteria) AS criterios,         -- 63,  IGUAL ao passo 0
       (SELECT count(*) FROM information_schema.columns
         WHERE table_schema='public' AND table_name='capability_evidence') AS colunas, -- 25
       (SELECT count(*) FROM public.capability_evidence WHERE evidence_category IS NOT NULL) AS traduzidas, -- 853
       (SELECT count(*) FROM public.capability_evidence WHERE source_table  IS NOT NULL) AS com_tabela,     -- 853
       (SELECT count(*) FROM public.capability_evidence WHERE occurred_at   IS NOT NULL) AS com_data,       -- 853
       (SELECT count(*) FROM public.capabilities WHERE slug IS NULL) AS slug_nulo,                          -- 0
       (SELECT count(*) FROM pg_class WHERE relname='capability_evidence_source_capability_uidx') AS arbitro; -- 1
```

**Se `evidencias` ≠ 853 ou `capacidades` ≠ 15, PARE** e vá ao passo R2.

### Passo 3 — confirmar que o árbitro não é parcial (LEITURA)

```sql
SELECT indexrelid::regclass::text AS indice, indisunique AS unico,
       (indpred IS NOT NULL) AS parcial
  FROM pg_index
 WHERE indexrelid = 'public.capability_evidence_source_capability_uidx'::regclass;
-- esperado: unico=true, parcial=FALSE. Se parcial=true, o upsert falha com 42P10.
```

### Passo 4 — registrar no histórico e recarregar o cache do PostgREST

```sql
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('20260828120000', 'aprendizagem_time_convergencia', ARRAY[]::text[])
ON CONFLICT (version) DO NOTHING;

INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES
  ('20260821000000', 'aprendizagem_time_schema', ARRAY[]::text[]),
  ('20260821010000', 'aprendizagem_time_seed_analise_problemas', ARRAY[]::text[]),
  ('20260825220000', 'aprendizagem_time_reconciliacao', ARRAY[]::text[])
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
```
As três obsoletas são registradas porque agora são no-ops declarados: registrá-las
impede que alguém as reaplique no futuro achando que faltava algo.

### Passo 5 — provar a RLS sem persistir nada (recomendado)

O endpoint honra `BEGIN … ROLLBACK`. Uma lista vazia numa tabela vazia não prova
policy nenhuma; é preciso exercitá-la contra uma linha fisicamente presente:

```sql
BEGIN;
INSERT INTO public.capability_assessments (tenant_id, student_id, capability_id, new_state, rationale)
SELECT c.tenant_id, u.id, c.id, 'emerging', 'prova de RLS'
  FROM public.capabilities c JOIN public.users u ON u.tenant_id = c.tenant_id LIMIT 1;

SET LOCAL ROLE anon;
SELECT count(*) AS visivel_para_anon FROM public.capability_assessments;  -- esperado 0
RESET ROLE;
SELECT count(*) AS visivel_para_postgres FROM public.capability_assessments; -- esperado 1
ROLLBACK;
```
**Contar ainda dentro da role restrita dá 0 sempre** — o `RESET ROLE` é o que
separa "a policy bloqueou" de "não havia linha".

### Passo 6 — exercitar o pipeline

Disparar `POST /api/analytics/aprendizagem-time/classify` para um tenant, e
conferir que `capability_evidence` **cresceu**:

```sql
SELECT count(*) AS total, count(*) FILTER (WHERE comprehension IS NOT NULL) AS classificadas,
       count(*) FILTER (WHERE classification_model <> 'pre-existente') AS pelo_pipeline
  FROM public.capability_evidence;
```
`classificadas` > 0 é a prova de que o `upsert` gravou. Se continuar 0, **o
problema não é mais o schema** — verifique o log da rota (ver §8, achado 2).

---

## 8. Rollback — passo a passo, e o que cada um custa

| Ponto | Situação | Como reverter | Custo |
|:--|:---|:---|:---|
| **R1** | O passo 1 falhou | **Nada a fazer.** O `BEGIN`/`COMMIT` já reverteu tudo. Leia a mensagem do `RAISE EXCEPTION` do bloco 10 | zero |
| **R2** | O passo 1 passou mas o passo 2 acusou perda de linha | **Não deveria ser possível** — não há `DROP`, `DELETE` nem `TRUNCATE` no arquivo. Se acontecer, houve escrita concorrente: **pare tudo** e restaure pelo PITR do Supabase (Database → Backups) para o instante do passo 0 | minutos de downtime |
| **R3** | Precisa desfazer só as tabelas novas | `DROP TABLE public.capability_assessment_criteria, public.capability_assessment_evidence, public.capability_assessments, public.capability_concepts, public.concepts CASCADE;` — todas nascem vazias, nada se perde | zero, se ainda vazias |
| **R4** | Precisa desfazer as colunas novas de `capability_evidence` | `ALTER TABLE public.capability_evidence DROP COLUMN concept_id, DROP COLUMN evidence_category, DROP COLUMN source_table, DROP COLUMN comprehension, DROP COLUMN depth_level, DROP COLUMN application_level, DROP COLUMN confidence, DROP COLUMN classification_model, DROP COLUMN classification_signals, DROP COLUMN classification_reasoning, DROP COLUMN criteria_met, DROP COLUMN occurred_at, DROP COLUMN classified_at;` | **Destrutivo** se o pipeline já rodou: perde toda classificação |
| **R5** | Precisa restaurar os `NOT NULL` | `UPDATE` para preencher `criterion_id`/`category`/`observed_at` das linhas novas e então `ALTER COLUMN … SET NOT NULL`. Só é possível se nenhuma linha nova existir, ou com valores inventados | Só faça com as tabelas no estado do passo 0 |
| **R6** | Precisa restaurar o `CHECK` estreito | `ALTER TABLE public.capability_evidence DROP CONSTRAINT capability_evidence_source_type_check; ALTER TABLE … ADD CONSTRAINT capability_evidence_source_type_check CHECK (source_type IN ('reflexao','socratica','quiz','atividade','aplicacao_real'));` | Falha se já houver linha em inglês |
| **R7** | Reverter os arquivos | `git checkout d2b8083 -- supabase/migrations/` | zero (nada foi commitado) |

**A janela barata de rollback é entre o passo 2 e o passo 6.** Depois que o
pipeline gravar, R4/R5/R6 passam a destruir dado real, e o caminho honesto é
avançar corrigindo, não recuar.

---

## 9. Achados que NÃO são desta migration, e que precisam de decisão

1. **`manager` lê `capability_evidence` do tenant inteiro, hoje, sem recorte de
   equipe.** A policy viva `capev_staff_select` inclui `manager`, enquanto o
   comentário das migrations obsoletas diz que isso foi excluído "de propósito"
   para que o gestor lesse só via service client com escopo de time. Uma das duas
   afirmações está errada, e é a do comentário. Isto é **anterior** a esta
   migration e não foi alterado por ela. Para inverter, basta remover `'manager'`
   das listas `auth_user_role() = ANY (ARRAY[…])` nas policies `*_staff_select`.

2. **`processadas` conta candidatos, não gravações** (`classificador/index.ts:101-105`
   devolve `pendentes.length`). Com 100% de falha no `upsert` a rota responde
   `{ok:true, processed:20}`. Foi esta cegueira que manteve o defeito invisível.
   `paresTocados.size` — que já existe e só cresce em caso de sucesso — daria o
   número honesto. **Não alterei o código**, conforme o escopo.

3. **Vocabulário duplo em `source_type`.** A migration aceita PT e EN
   simultaneamente. Isso é expand deliberado, não estado final. A contração exige
   decidir: migrar as 853 linhas para o inglês, ou o pipeline passar a escrever
   em português. **Recomendo o primeiro** — o resto do modelo (`evidence_category`,
   `comprehension`, `application_level`, `new_state`) já é inglês.

4. **`anon` e `authenticated` têm `TRUNCATE` em toda tabela do schema `public`**,
   por privilégio default do projeto — e **RLS não cobre `TRUNCATE`**. É sistêmico,
   não específico desta frente, e por isso não foi mexido aqui. Merece um
   `REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;`
   como item próprio, com o Senhor decidindo.

5. **`concepts` continua sem seed.** Nenhuma migration semeia conceitos. Os blocos
   das Telas 2/3 que agrupam por módulo mostrarão estado vazio honesto até que o
   time de currículo defina os conceitos. Não é defeito, é ausência de dado curado.

---

## 10. Arquivos desta entrega

| Arquivo | Estado |
|---|---|
| `supabase/migrations/20260828120000_aprendizagem_time_convergencia.sql` | **NOVO** — a migration convergente |
| `supabase/migrations/20260821000000_aprendizagem_time_schema.sql` | neutralizada em no-op declarado |
| `supabase/migrations/20260821010000_aprendizagem_time_seed_analise_problemas.sql` | neutralizada; conteúdo migrou para o bloco 9 |
| `supabase/migrations/20260825220000_aprendizagem_time_reconciliacao.sql` | neutralizada em no-op declarado |
| `supabase/migrations/README-aprendizagem-time.md` | reescrito para refletir o estado real |
| `docs/auditoria/consolidacao-2026-08-28/LOOP-7-migration.md` | este documento |
| `docs/auditoria/consolidacao-2026-08-28/loop7-harness/` | instrumentos e saídas literais |

Nada foi commitado. Nada foi aplicado no banco. HEAD segue em `d2b8083`.
