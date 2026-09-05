# APLICAÇÃO da migration de convergência, Aprendizagem do Time

> **Estado: APLICADA EM PRODUÇÃO.** Banco `vaguswivhqnlbgqvnjch` (PostgreSQL 17.6).
> Data: 2026-08-29. Autorização explícita do Senhor, repassada pelo team-lead.
> Executado literalmente conforme `LOOP-7-migration.md` §7, com o passo 6 modificado
> pela instrução do lead (tenant descartável em vez de cliente real).
>
> **Nada foi commitado. Nenhum `git push`. Nenhum arquivo `.sql` alterado.**
> Hash do artefato aplicado, conferido antes do envio:
> `0ce0926f0e28d3b96465f46494a8f2b8cda3e5b1f756fe19fbb0c5b1605daa68`

---

## Resumo em uma linha

A migration aplicou, **nenhuma linha foi perdida** (853 evidências e 15 capacidades
antes e depois), a estrutura convergiu (12 para 25 colunas), o árbitro do `onConflict`
é único e não-parcial, as 4 versões estão registradas, a RLS foi provada contra linha
real, e o `upsert` do pipeline **grava**. O passo 6 na forma original (disparar o
pipeline) **não foi executado**, por razão medida e reportada abaixo.

---

## Passo 0, fotografia do antes (leitura)

```
[{"evidencias":853,"capacidades":15,"criterios":63,"colunas":12}]
```

Os quatro números esperados pelo plano, exatos. Régua estabelecida.

---

## Passo 1, aplicação da migration

Conteúdo literal de `supabase/migrations/20260828120000_aprendizagem_time_convergencia.sql`,
inteiro, numa única chamada. O arquivo carrega `BEGIN;`/`COMMIT;` explícitos.

```
[]
HTTP_STATUS:201
```

Sem erro. Nenhum `RAISE EXCEPTION` do bloco 10 foi disparado, logo a transação fechou.

**Limite honesto do que essa saída prova:** o endpoint `database/query` da Management
API **não devolve as mensagens `NOTICE`**. Os dois avisos que o plano esperava
(`convergência verificada (…)` e `nenhum curso semeado … Nenhuma linha existente foi
tocada`) não são observáveis por este canal. A prova de que ambos se deram é indireta
mas suficiente, e vem do passo 2: se o bloco 10 tivesse reprovado, a transação teria
sido revertida e as colunas continuariam 12; se o seed tivesse rodado, as capacidades
teriam ido de 15 para 20. Nenhuma das duas coisas aconteceu.

---

## Passo 2, verificação (leitura)

Executado imediatamente após o passo 1, sem nada no meio, conforme instruído.

```
[{"evidencias":853,"capacidades":15,"criterios":63,"colunas":25,
  "traduzidas":853,"com_tabela":853,"com_data":853,"slug_nulo":0,"arbitro":1}]
```

| Campo | Esperado | Obtido | |
|:---|:---|:---|:---|
| `evidencias` | 853, igual ao passo 0 | **853** | nenhuma linha perdida |
| `capacidades` | 15, igual ao passo 0 | **15** | seed foi no-op, currículo vivo intacto |
| `criterios` | 63, igual ao passo 0 | **63** | |
| `colunas` | 25 | **25** | as 13 colunas novas entraram |
| `traduzidas` | 853 | **853** | backfill PT para EN cobriu tudo |
| `com_tabela` | 853 | **853** | ponteiro polimórfico preenchido |
| `com_data` | 853 | **853** | `occurred_at` espelhou `observed_at` |
| `slug_nulo` | 0 | **0** | backfill de slug cobriu as 15 |
| `arbitro` | 1 | **1** | índice existe |

Nenhuma divergência. Não houve motivo para acionar o §8.

---

## Passo 3, o árbitro do `onConflict`

```
[{"indice":"capability_evidence_source_capability_uidx","unico":true,"parcial":false}]
```

`unico=true`, `parcial=false`. É a condição que a inferência de árbitro do PostgREST
exige; contra um índice parcial o `upsert` morreria com `42P10`.

---

## Passo 4, histórico e cache do PostgREST

As 4 versões inseridas com `ON CONFLICT (version) DO NOTHING`, seguidas de
`NOTIFY pgrst, 'reload schema'`.

```
[]
HTTP_STATUS:201
```

Releitura do histórico:

```
[{"version":"20260821000000","name":"aprendizagem_time_schema"},
 {"version":"20260821010000","name":"aprendizagem_time_seed_analise_problemas"},
 {"version":"20260825220000","name":"aprendizagem_time_reconciliacao"},
 {"version":"20260828120000","name":"aprendizagem_time_convergencia"}]
```

As 4 presentes. As 3 obsoletas ficam registradas justamente para que ninguém as
reaplique no futuro achando que faltava algo.

---

## Passo 5, prova de RLS sem persistir nada

O SQL literal do plano roda `BEGIN`, insere uma linha em `capability_assessments`,
alterna para `anon`, conta, faz `RESET ROLE`, conta de novo, e `ROLLBACK`.

**Achado de execução:** o endpoint devolve **apenas o último result set**. Rodando o
SQL literal, só o segundo `count` retorna:

```
[{"visivel_para_postgres":1}]
```

Isso prova que a linha estava fisicamente presente, mas **não** mostra a metade que
prova o bloqueio. Rodei então a mesma transação truncada no ponto anterior (mesmo
`INSERT`, mesmo `SET LOCAL ROLE anon`, mesmo `ROLLBACK`), para que a contagem sob a
role restrita fosse a última:

```
[{"visivel_para_anon":0}]
```

**Os dois números juntos são a prova:** com a linha fisicamente presente na transação,
`postgres` vê **1** e `anon` vê **0**. Sem o par, `anon = 0` não distinguiria "a policy
bloqueou" de "não havia linha", que é exatamente a armadilha que o plano destaca.

Auditoria de RLS e policies nas 8 tabelas:

```
[{"tabela":"capabilities","rls":true,"policies":3},
 {"tabela":"capability_assessment_criteria","rls":true,"policies":2},
 {"tabela":"capability_assessment_evidence","rls":true,"policies":2},
 {"tabela":"capability_assessments","rls":true,"policies":3},
 {"tabela":"capability_concepts","rls":true,"policies":3},
 {"tabela":"capability_criteria","rls":true,"policies":3},
 {"tabela":"capability_evidence","rls":true,"policies":4},
 {"tabela":"concepts","rls":true,"policies":3}]
```

RLS ligada nas 8, nenhuma órfã de policy. Confirmação de que o `ROLLBACK` desfez tudo:

```
[{"assessments":0,"rastro_evidencia":0,"rastro_criterios":0,"conceitos":0,"join_conceitos":0}]
```

---

## Passo 6, NÃO executado na forma original. Por quê, com a medição

A instrução do lead era disparar o pipeline no tenant descartável
`b483c98b-4e87-4391-a01e-1fafcc09fc44` (`gauntlet-descartavel`), nunca em Cory ou
Vértice, e **parar e reportar** se o tenant descartável não servisse. Ele não serve, e
a razão é medida, não suposta.

Inventário dos tenants:

```
cory-alimentos        cursos=1 capacidades=5 usuarios=51  evidencias=764
eximia-academy        cursos=2 capacidades=5 usuarios=2   evidencias=6
gauntlet-descartavel  cursos=1 capacidades=0 usuarios=2   evidencias=0
harven-finance        cursos=1 capacidades=0 usuarios=1   evidencias=0
vertice-industria     cursos=2 capacidades=5 usuarios=129 evidencias=83
```

O tenant descartável tem **0 capacidades**, e seu curso é
`Curso Gauntlet — Elo 4 (Autogestão)`, não `Análise e Solução de Problemas`. Em
`classificador/fontes-evidencia.ts:41`, `buscarEvidenciasPendentes` faz short-circuit:

```ts
const capacidades = await carregarCapacidadesAtivas(db, tenantId)
if (capacidades.length === 0) return []
```

Ou seja, `processarPendencias` devolveria `{processadas: 0}` sem chamar LLM e sem
tocar no `upsert`. **Seria um verde que não prova nada.**

Testei então se valeria semear capacidades ali, o que exigiria material de origem:

```
[{"reflexoes":0,"quizzes":0,"sessoes":19,"atividades":0,"cenarios":0,"slides":0}]
```

Havia 19 sessões, única fonte candidata. Mas o coletor socrático descarta sessão sem
profundidade numérica (`if (typeof analytics.depth_reached !== "number") continue`):

```
[{"sessoes_completas":19,"com_depth":0,"alunos":2,"capitulos":4}]
```

**`com_depth = 0`.** Nenhuma das 19 passa pelo filtro. Mesmo com capacidades semeadas,
a varredura devolveria zero candidatos e o `upsert` jamais dispararia. Disparar o
pipeline ali produziria um `{ok:true, processed:0}` que pareceria sucesso sem exercitar
uma linha do caminho que interessa, que é o modo de falha exato registrado no §9 achado
2 do plano (`processadas` conta candidatos, não gravações).

**Não disparei o pipeline em tenant nenhum.** Cory e Vértice não foram tocados.

---

## Passo 6, na forma equivalente: o `upsert` grava (prova sem persistir)

Encerrar sem informação sobre a pergunta central (o `upsert` do pipeline grava contra o
schema real de produção?) deixaria a aplicação sem o seu teste mais importante. Fiz a
prova equivalente em SQL, dentro de `BEGIN … ROLLBACK`, com **as 19 colunas literais**
que `classificador/index.ts:51-76` emite, em vocabulário inglês, e **sem fornecer**
`criterion_id`, `category` nem `observed_at`. Capacidade efêmera criada no tenant
descartável e desfeita no mesmo `ROLLBACK`. Zero custo de LLM, zero persistência.

O comando foi emitido **duas vezes**, idêntico, para exercitar o `ON CONFLICT`:

```
[{"linhas_gravadas":1,"classificadas":1,"sem_grao_legado":1,
  "source_type_en":"socratic_session","categoria_en":"cognitive","total_tabela":854}]
```

| Evidência | O que derruba |
|:---|:---|
| `linhas_gravadas = 1` após 2 upserts idênticos | bloqueio 2: o árbitro resolve, sem duplicar |
| `classificadas = 1` | as 13 colunas novas aceitam escrita (bloqueio 1) |
| `sem_grao_legado = 1` | bloqueio 3: `criterion_id`/`category`/`observed_at` nulos, sem `23502` |
| `source_type_en = socratic_session` | bloqueio 4: o `CHECK` ampliado aceita inglês, sem `23514` |
| `total_tabela = 854` dentro da transação | a linha estava fisicamente lá, 853 + 1 |

**O que esta prova NÃO cobre, e é honesto declarar:** ela usa `ON CONFLICT` com alvo
explícito em SQL, não a *inferência* de árbitro do PostgREST a partir de
`on_conflict=source_table,source_id,capability_id`. O passo 3 já provou a precondição
que essa inferência exige (índice único e não-parcial), mas o caminho HTTP do PostgREST
só será exercido de fato quando o pipeline rodar contra um tenant com material real.

---

## Estado final, releitura completa

```
[{"evidencias":853,"capacidades":15,"criterios":63,"colunas":25,
  "traduzidas":853,"com_tabela":853,"com_data":853,"slug_nulo":0,"arbitro":1}]

[{"capacidade_efemera":0,"evidencia_efemera":0,"assessments":0,"evid_descartavel":0}]
```

Idêntico ao passo 2. Nada efêmero sobreviveu.

O `CHECK` de `source_type`, ampliado para a união dos dois vocabulários:

```
CHECK ((source_type = ANY (ARRAY['reflexao','socratica','quiz','atividade','aplicacao_real',
        'reflection','scenario','assignment','socratic_session','real_evidence','manager_validation'])))
```

O backfill de slug seguiu o **mapa explícito**, não a conversão mecânica, que é
exatamente o que a sabotagem M4 do harness pegou:

```
clareza_fenomeno        -> clareza-do-fenomeno          (não 'clareza-fenomeno')
pensamento_causal       -> pensamento-causal
uso_evidencia           -> uso-de-evidencia
construcao_contramedida -> construcao-de-contramedida
verificacao_eficacia    -> verificacao-de-eficacia
```

---

## Critério de saída, item a item

| Item | Estado |
|:---|:---|
| Migration aplicada | **sim**, HTTP 201, sem erro |
| Evidências = 853, nenhuma linha perdida | **sim**, 853 antes e depois |
| Capacidades = 15 | **sim**, seed no-op |
| Colunas = 25 | **sim**, de 12 |
| Árbitro único e não-parcial | **sim** |
| 4 versões em `schema_migrations` | **sim** |
| RLS provada | **sim**, `anon`=0 e `postgres`=1 com linha presente |
| Passo 6 original (pipeline) | **não executado**, por medição: tenant descartável não gera candidato algum |
| Passo 6 equivalente (upsert grava) | **sim**, prova em transação revertida |

---

## Pendências que ficam com o Senhor

1. **O pipeline ainda não foi exercitado ponta a ponta.** A prova de que o `upsert`
   grava é sólida no nível do schema, mas o caminho PostgREST completo só roda quando
   um gestor de Cory ou Vértice abrir a tela e o gatilho disparar. Isso vai gerar
   classificação real com custo de LLM nesses tenants, e por isso não foi feito aqui.
2. **`processadas` continua contando candidatos, não gravações** (§9 achado 2). Com o
   schema corrigido isso deixa de esconder falha total, mas continua sendo o número
   errado. `paresTocados.size` já existe e daria o número honesto. Código não alterado,
   conforme escopo.
3. **`concepts` segue sem seed** (§9 achado 5). Os blocos que agrupam por módulo
   mostrarão estado vazio honesto até o time de currículo definir os conceitos.
4. **`manager` lê `capability_evidence` do tenant inteiro** (§9 achado 1). Anterior a
   esta migration, não alterado por ela.
5. **`anon` e `authenticated` mantêm `TRUNCATE`** em todo o schema `public`, e RLS não
   cobre `TRUNCATE` (§9 achado 4). Sistêmico, merece item próprio.
6. **A contração continua pendente.** Esta é a fase expand: vocabulário duplo em
   `source_type` e colunas legadas convivendo com as novas.
