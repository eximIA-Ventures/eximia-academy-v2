# Migrations — Aprendizagem do Time

> ## LEIA ANTES DE APLICAR QUALQUER COISA (atualizado 2026-08-28)
>
> **Aplique UMA migration, e só uma: `20260828120000_aprendizagem_time_convergencia.sql`.**
> As outras três desta frente são **no-ops declarados** e não fazem nada.
>
> A versão anterior deste README mandava aplicar `20260825220000`. **Aquela
> instrução estava errada** e está corrigida abaixo, com a prova.

## O que se descobriu em 2026-08-28

Uma auditoria por consulta direta ao banco de produção (leitura apenas) provou
duas coisas:

1. **O schema desta frente nunca foi aplicado em lugar nenhum.** As 5 tabelas
   novas não existem, as 13 colunas que o código assume não existem, e
   `supabase_migrations.schema_migrations` não registra nada de agosto.
2. **O par de migrations anterior era mutuamente exclusivo por terreno** — cada
   uma só funcionava no terreno que a outra não produzia:

| Terreno | `20260821000000` | `20260825220000` |
|:---|:---|:---|
| Ocupado (produção) | **FALHA** | passaria |
| Virgem (staging/CI/cliente novo) | passa | **FALHA** (`column "code" does not exist`) |

Não existia sequência capaz de levantar este schema do zero. E `CREATE TABLE IF
NOT EXISTS` contra terreno já ocupado **não protege, apenas cala**: a migration
passa verde sem aplicar a estrutura que declara.

## Os quatro arquivos, hoje

| Arquivo | Estado | O que faz |
|---|---|---|
| `20260828120000_aprendizagem_time_convergencia.sql` | **ATIVO — o único a aplicar** | Alvo único convergido: as 8 tabelas, as 13 colunas, os backfills, o índice árbitro, a RLS e o seed. Funciona nos dois terrenos. |
| `20260821000000_aprendizagem_time_schema.sql` | no-op | Supersedida. Cabeçalho explica o porquê. |
| `20260821010000_aprendizagem_time_seed_analise_problemas.sql` | no-op | Seed migrado para o bloco 9 da migration ativa, por um problema de **ordem** (o timestamp do seed era menor que o do schema). |
| `20260825220000_aprendizagem_time_reconciliacao.sql` | no-op | Supersedida. Não destravava o `upsert`, que era o objetivo dela. |

O corpo executável das três está preservado no git: `git show d2b8083:supabase/migrations/<arquivo>`.

## As 8 tabelas

1. **`concepts`** — conceito curricular, ancorado a um módulo (`chapter_id`, opcional) e a um curso.
2. **`capabilities`** — capacidade curricular, sempre ancorada a um curso.
3. **`capability_concepts`** — join N:N entre as duas acima.
4. **`capability_criteria`** — critério observável fixo por capacidade (nunca gerado em runtime).
5. **`capability_evidence`** — avaliação **por evidência individual** (compreensão / profundidade 1-7 / aplicação), pré-agregação.
6. **`capability_assessments`** — maturidade **agregada** aluno×capacidade, uma linha por transição (nunca `UPDATE` — histórico completo).
7. **`capability_assessment_evidence`** — quais evidências embasaram qual avaliação.
8. **`capability_assessment_criteria`** — quais critérios foram/não foram atendidos em cada avaliação.

Em produção, as tabelas 2, 4 e 5 **já existiam** com outro formato e com dado
dentro (15 / 63 / 853 linhas). A migration ativa é aditiva sobre elas: nenhum
`DROP`, nenhum `DELETE`.

## Fase expand, não estado final

A migration ativa é a fase **expand** de um expand/contract:

- As colunas legadas (`capabilities.code`/`name`/`focus_text`,
  `capability_evidence.criterion_id`/`category`/`observed_at`) passam a
  **nullable** e convivem com as novas. Nenhum dado se perde.
- O `CHECK` de `source_type` aceita **os dois vocabulários** (`reflexao` e
  `reflection`), porque as 853 linhas vivas estão em português e o pipeline
  escreve em inglês.

A fase **contract** — dropar as legadas e estreitar o `CHECK` — é uma migration
futura, depois que o pipeline rodar e o código estiver uniforme.

## RLS

Tabelas de currículo (`concepts`, `capabilities`, `capability_concepts`,
`capability_criteria`): leitura ampla no tenant, escrita por staff.
Tabelas de dado individual (`capability_evidence`, `capability_assessments` e as
duas de rastro): o próprio aluno, ou staff, ou super admin. Nenhuma policy de
escrita nas tabelas de avaliação — quem escreve é o service client do pipeline,
que não passa por RLS.

As policies espelham o padrão **vivo em produção**, que usa `auth_user_role()`
(não `has_role()`) e **inclui `manager`** na lista de staff. Os comentários das
migrations obsoletas afirmavam o contrário; eles estavam desatualizados. A
divergência está registrada em `docs/auditoria/consolidacao-2026-08-28/LOOP-7-migration.md` §9.

## Como aplicar, e como verificar

**Não use `supabase db push`**: o histórico local e o remoto divergiram e o CLI
recusa rodar até uma reconciliação que é um trabalho à parte. O caminho é a
Management API, migration a migration.

O procedimento completo — passos numerados, consulta de verificação após cada
bloco, e rollback de cada passo — está em
`docs/auditoria/consolidacao-2026-08-28/LOOP-7-migration.md` §7 e §8.

Diagnóstico rápido do estado do schema:

```bash
cd apps/web && node scripts/_diag-schema.mjs
```

## O que ainda falta, depois de aplicar

1. **`concepts` não é semeado por nenhuma migration.** Sem conceitos curados, os
   blocos que agrupam por módulo nas Telas 2/3 mostram estado vazio honesto. Não
   é bug, é ausência de dado curado.
2. **`capability_evidence`/`capability_assessments` só ganham níveis via
   pipeline de classificação.** Sem rodá-lo ao menos uma vez, as 853 linhas
   antigas ficam com `comprehension`/`depth_level`/`application_level` NULL — de
   propósito: esse dado não existe em lugar nenhum e inventá-lo seria pior que a
   ausência.
