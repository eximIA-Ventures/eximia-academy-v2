# Inventário — o que existe no servidor e o que existe em git

> Objeto: projeto Supabase `vaguswivhqnlbgqvnjch` (PostgreSQL 17.6), que é **produção**, contra
> `supabase/migrations/*.sql` de `integra/main-cory`. Data: 2026-08-31.
> **Leitura apenas. Nenhuma escrita, nenhum DDL, nenhum `db push`, nenhum commit.**

## Como isto foi medido, e a trava que garante o "apenas leitura"

Todas as consultas foram feitas pela Management API (`POST /v1/projects/{ref}/database/query`),
e **cada uma roda dentro de `BEGIN READ ONLY; … ROLLBACK;`**. A trava não é declarada, é provada,
com controle nos dois sentidos:

```
$ echo "UPDATE public.tenants SET id = id WHERE false;" | q.sh
{"message":"Failed to run sql query: ERROR:  25006: cannot execute UPDATE in a read-only transaction"}

$ echo "SELECT count(*) AS tenants FROM public.tenants;" | q.sh
[{"tenants":5}]
```

Uma escrita **inerte** (`WHERE false`, zero linhas mesmo se executasse) é recusada; um `SELECT`
passa. É o servidor recusando, não a minha disciplina.

**O catálogo é o fato; a migration é a hipótese.** Todo número abaixo vem de `pg_class`,
`pg_attribute`, `pg_policy`, `pg_proc`, `pg_trigger`, `pg_index`, `pg_extension`,
`information_schema.role_table_grants`, `pg_default_acl`, `storage.buckets` e
`supabase_migrations.schema_migrations`. O lado das migrations vem de parse de SQL, e **cada
candidato foi conferido um a um** contra o texto da migration — o parser só gera suspeita.

---

## Placar por categoria

| Categoria | Tabelas | Colunas | Políticas | Funções | Triggers | Índices | Buckets | Migrations |
|:---|--:|--:|--:|--:|--:|--:|--:|--:|
| **SÓ NO SERVIDOR** | 2 | 3 | 14 | 16 | 4 | 17 | 0 | **12** |
| **SÓ NA MIGRATION** | 0 | 2 | 2 | 0 | 0 | 1 | 0 | **15 não registradas** (3 com efeito ausente) |
| **DIVERGENTE** | — | — | 3 | — | — | — | 0 | — |

Universo medido: 81 tabelas, 930 colunas, 324 políticas (315 em `public` + 9 em `storage`),
46 funções em `public`, 22 gatilhos, 323 índices, 5 extensões, 3 buckets, 100 migrations
registradas contra 103 arquivos no repo.

**Uma 13ª migration merece linha própria** e está no achado 10: `20260828120000` está **aplicada
e registrada** no servidor, e o arquivo dela **não está versionado** (`??` no `git status`). Não
entra na contagem de "12 só no servidor" porque o arquivo existe em disco — mas some junto com a
árvore de trabalho.

---

# ORDENADO POR RISCO

## 1. CRÍTICO — três RPC destrutivas alcançáveis por `anon`, sem sessão

**Categoria: existe nos DOIS. Não é drift — está em git desde fevereiro.** Entra em primeiro
lugar porque foi encontrado dentro do escopo pedido (funções e privilégios de `anon`) e porque é,
de longe, a maior consequência do inventário.

`anon` e `authenticated` têm `EXECUTE` sobre **40 das 46 funções** de `public`. Ninguém concedeu:
vem do `DEFAULT ACL` do Supabase (`pg_default_acl`, tipo `f`: `anon=X/postgres`). Três dessas
funções são `SECURITY DEFINER`, **escrevem**, e **recebem a identidade do alvo como parâmetro sem
conferir quem chama**:

| Função | O que faz, sem checar o chamador |
|:---|:---|
| `lgpd_soft_delete_user(p_user_id uuid)` | anula `sessions.student_id`, marca `enrollments.deleted_at` e `users.deleted_at` do usuário passado |
| `jsonb_profile_merge(p_user_id, p_set_key, p_set_value, p_remove_key)` | escreve/remove chave arbitrária em `users.profile` de qualquer usuário |
| `swap_onboarding_course(p_new_course_id, p_tenant_id)` | despromove o curso de onboarding de um tenant e publica outro |

Nenhuma delas contém `auth.uid()`, `auth_user_role()`, `auth_tenant_id()` ou `is_super_admin()`
no corpo. Conferido lendo `pg_proc.prosrc`.

**Prova de alcance, sem executar a escrita.** As três estão expostas pelo PostgREST (spec OpenAPI
lida via `service_role`, `GET`). Com a **chave `anon`** — que é pública por construção, vai no
bundle do navegador — um `GET` na assinatura correta devolve:

```
lgpd_soft_delete_user?p_user_id=00000000-…  -> HTTP 405  {"code":"25006", … "cannot execute UPDATE in a read-only transaction"}
jsonb_profile_merge?p_user_id=00000000-…    -> HTTP 405  {"code":"25006", … }
swap_onboarding_course?…                    -> HTTP 405  {"code":"25006", … }

CONTROLES:
funcao_que_nao_existe_xyz?p_user_id=…       -> HTTP 404  PGRST202 (nao encontrada)
lgpd_soft_delete_user?parametro_errado=…    -> HTTP 404  PGRST202 (assinatura nao casa)
```

O `25006` é emitido de **dentro do corpo da função**: o PostgREST resolveu a função, o papel
`anon` **foi autorizado a executá-la**, o corpo rodou até o primeiro `UPDATE`, e só então a
transação read-only do `GET` recusou. A barreira foi o verbo HTTP, **não a permissão**. Os dois
controles negativos distinguem: função inexistente e assinatura errada dão 404, não 405.
**O `POST` equivalente não foi feito, e não deve ser.**

> **O que um estranho consegue:** com a chave pública do site e um `POST` em
> `/rest/v1/rpc/lgpd_soft_delete_user`, apagar (soft-delete) qualquer usuário da plataforma cujo
> UUID ele conheça, sem login, sem ser de nenhum tenant.

**A casa já conhece o mecanismo.** Seis `REVOKE EXECUTE … FROM PUBLIC, anon` existem nas
migrations, todos sobre funções auxiliares `auth_*` — que apenas **leem**. As três que
**escrevem** ficaram de fora. O padrão foi entendido e aplicado ao conjunto errado.

**Uma primeira tentativa minha de medir isto deu falso.** O `GET /rest/v1/` com a chave `anon`
devolveu `paths: 0`, e ler isso como "nenhuma RPC exposta" teria sido um número plausível e
falso: o endpoint responde `401 Only the service_role API key can be used for this endpoint`.
Registrado porque é o modo de falha que esta auditoria mais paga.

---

## 2. ALTO — `semantic_analyses` é perfilamento psicológico de aluno que **só existe no servidor**

**Categoria: SÓ NO SERVIDOR.** 23 linhas. Nenhuma migration a cria; nenhuma cria as suas
políticas.

Colunas: `student_id, course_id, tenant_id, roda_stage, roda_confidence, roda_evidence,
cma_corpo, cma_mente, cma_alma, cma_dominant, metanoia_level, metanoia_signals, kolb_style,
kolb_grasping, kolb_transforming, jung_layer, jung_confidence, jung_evidence, engagement_level,
engagement_ai_probability, classification_model, …, summary`.

É exatamente o dado que `lib/api-role-guard.ts` chama de LGPD-sensível ao justificar por que
`CHAPEUS_DO_PERFIL_SEMANTICO` exclui `manager`. A tabela tem RLS ligada e política de tenant —
**e a política também é só do servidor**.

> **O que se perde:** qualquer ambiente reconstruído a partir do git (staging, disaster
> recovery, novo cliente) nasce **sem a tabela e sem a RLS dela**. Se alguém a recriar à mão sob
> pressão e esquecer a política, camada Jung e CMA por aluno ficam legíveis por todo o tenant.

Irmã: `capability_modules` (27 linhas, 3 políticas, também só no servidor) — mesmo mecanismo,
dado não sensível.

---

## 3. ALTO — o recorte por grupo do gestor **nunca chegou ao servidor**

**Categoria: DIVERGENTE.** `20260630000000_engagement_rls_group_scope.sql` **não está registrada**,
e — o que importa — o corpo das políticas no servidor é o antigo:

| Política | Servidor (hoje) | Migration (não aplicada) |
|:---|:---|:---|
| `notifications.notifications_insert` | `tenant_id = auth_tenant_id() AND role IN ('admin','manager') AND destinatário no mesmo tenant` | acrescenta `auth_managed_group_ids` / `manager_group_members` |
| `nudge_suggestions.ns_write` | `tenant_id = auth_tenant_id() AND role IN ('admin','manager')` | acrescenta o mesmo recorte por grupo |

> **O que um `manager` consegue hoje:** criar notificação e cutucada para **qualquer aluno do
> tenant**, inclusive de equipes que não são dele — que é precisamente o alargamento que a
> migration não aplicada existia para fechar.

**Como quase passei batido:** o casamento de políticas **por nome** dava 2/2 presentes. Os nomes
batem; os corpos não. Só a comparação do corpo (`pg_get_expr`, procurando identificadores
distintivos da migration) acusou.

---

## 4. ALTO — a RLS de `user_roles` tem duas definições rivais, e aplicar a do repo **alarga o acesso**

**Categoria: DIVERGENTE.** A tabela `user_roles` (188 linhas) existe. Mas:

| Lado | Políticas |
|:---|:---|
| Servidor | `ur_self_select`, `ur_admin_manage`, `ur_super_admin_all` — vindas da migration **só do servidor** `20260621100000 e1_user_roles` |
| Repo (`20260701030000_epic30_user_roles.sql`, não registrada) | `user_roles_select`, `user_roles_admin` — **ausentes do servidor** |

> **O que acontece se alguém "reconciliar" aplicando a migration do repo:** as duas políticas
> novas **somam-se** às três existentes. Políticas permissivas de RLS se combinam por **OU** —
> ninguém perde acesso, e quem passar a casar com `user_roles_select` ganha leitura que hoje não
> tem. Uma reconciliação de rotina alarga a autorização em silêncio.

---

## 5. MÉDIO — os três buckets são públicos, e isso **está em git**, não é drift

**Categoria: existe nos DOIS, idêntico. Corrige a premissa desta tarefa.**

| Bucket | `public` no servidor | Criado por | Registrada? | `public` declarado em git |
|:---|:--|:---|:--|:--|
| `chapter-assets` | `true` | `20260210000003_epic12_multimodal_content.sql:13` | sim | `VALUES ('chapter-assets','chapter-assets', true)` |
| `materials` | `true` | `20260211200000_materials.sql:39` | sim | `values ('materials','materials', true)` |
| `books` | `true` | `20260214000000_biblioteca_books.sql:88` | sim | `values ('books','books', true)` |

A tarefa partiu de que `materials` e `books` "não existem em migration alguma". **Existem**, nas
três migrations acima, todas registradas como aplicadas, e as três declaram `public = true`
explicitamente. O risco é o mesmo que o outro agente mediu; o **diagnóstico** muda, e com ele o
conserto: não é "alguém mexeu no servidor", é "nós escrevemos assim e a política ao lado esconde".

O que de fato engana é a vizinhança. Imediatamente abaixo de cada `insert`:

```sql
create policy "materials_storage_read" on storage.objects
  for select to authenticated using (bucket_id = 'materials');
```

Uma política de leitura restrita a `authenticated`, **ao lado de um bucket público**, onde ela não
governa coisa alguma: num bucket público o objeto é servido pelo endpoint `/object/public/…` sem
passar por RLS.

> **O que um estranho consegue:** baixar qualquer material didático, PDF de livro e mídia de
> capítulo sabendo (ou adivinhando) o caminho, sem sessão. A política ao lado não impede nada e
> faz parecer que impede.

---

## 6. MÉDIO — `anon` e `authenticated` têm `TRUNCATE` nas 81 tabelas, e nas futuras também

**Categoria: existe nos DOIS (é o default do Supabase, nenhuma migration mexe).** Já registrado no
`RELATORIO-CONSOLIDADO.md` §6 item 2; incluo com a medida que faltava.

```
anon          : 81 tabelas :: DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
authenticated : 81 tabelas :: DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
```

E o `pg_default_acl` de `public` (tipo `r`) concede `arwdDxtm` a `anon` e `authenticated` — ou
seja, **toda tabela criada daqui para frente nasce com o mesmo `TRUNCATE`**, inclusive as que uma
migration futura criar. Um `REVOKE` pontual não resolve sem mexer no default.

**Alcance, medido com honestidade:** o PostgREST não expõe `TRUNCATE`, e nenhuma das 46 funções
de `public` alcançáveis por `anon`/`authenticated` executa SQL dinâmico (`prosrc ~* '\mEXECUTE\M'`
→ **0**). Portanto **não há caminho conhecido** hoje. É pólvora seca, não rastilho aceso — e o
item 1 mostra o que acontece quando uma função escrita depois vira a ponte.

---

## 7. MÉDIO — 10 funções `SECURITY DEFINER` sem `search_path` fixo

**Categoria: existe nos DOIS.** Das 31 `SECURITY DEFINER` de `public`, **10 não fixam
`search_path`** (`pg_proc.proconfig` vazio), e todas as 10 são executáveis por `anon`:

`auth_tenant_id`, `auth_user_area_ids`, `auth_user_role`, `claim_session_turn`,
`get_random_active_question`, `jsonb_profile_merge`, `lgpd_soft_delete_user`,
`release_session_turn`, `swap_onboarding_course`, `update_enrollment_progress`.

As três primeiras são a base de decisão de **quase toda política de RLS do banco**.

> **O que isto vale:** `SECURITY DEFINER` sem `search_path` fixo é o vetor clássico de escalada —
> quem controlar o `search_path` da sessão faz a função resolver nomes para objetos dele, rodando
> como o dono. Pelo PostgREST o `search_path` é fixado pela configuração, não pelo chamador, então
> **não há vetor conhecido por essa porta**; o risco é para qualquer caminho futuro que consiga
> definir `search_path` (ferramenta interna, job, conexão direta).

---

## 8. MÉDIO — `plan_features` é legível por qualquer usuário autenticado, de qualquer tenant

**Categoria: existe nos DOIS.** Única política de `public` com `USING (true)` para um papel que
não é `service_role`:

```
plan_features.pf_authenticated_select | SELECT | authenticated | using=true
```

As outras 7 políticas com `true` são todas `service_role`, que contorna RLS por definição — essas
são inertes.

> **O que um usuário do tenant errado consegue:** ler o catálogo inteiro de planos e features,
> incluindo os de planos que o tenant dele não assina.

---

## 9. BAIXO — o que existe só no servidor e some numa reconstrução a partir do git

**Categoria: SÓ NO SERVIDOR.** Sem consequência de exposição hoje; a consequência é de
**reprodutibilidade**.

**3 colunas, com dado vivo:**

| Coluna | Linhas preenchidas | Nenhuma migration a cria |
|:---|--:|:---|
| `users.reports_to` (uuid) | 160 | sim — e **migrations do repo dependem dela**: `20260702222743` e `20260703010000` consultam `u.reports_to` em funções que criam |
| `users.is_test` (boolean) | 131 | sim |
| `manager_groups.parent_group_id` (uuid) | 12 | sim |

`users.reports_to` é o caso mais perigoso da lista: **duas migrations versionadas leem uma coluna
que nenhuma migration versionada cria.** Num banco reconstruído do git, elas falham.

**16 funções, 4 gatilhos, 17 índices, 14 políticas** só no servidor — o grosso vem das 12
migrations abaixo. Destaque para as funções de organograma (`team_subtree_group_ids`,
`auth_managed_team_subtree_ids`, `_students_of_groups`, `has_role`, `has_any_role`) e para os
guardas `users_reports_to_guard` e `manager_groups_parent_guard`, que são **travas de
integridade** existentes apenas lá.

**12 migrations registradas no servidor sem arquivo no repo** — a origem de quase tudo acima:

```
20260606121657 scope_manager_rls_to_teams        20260622151628 modelB_scope_by_groups
20260606130913 scope_analyses_qareports_to_teams 20260622190000 modelC_nested_teams_schema
20260606131312 enrollments_insert_no_manager     20260622190001 modelC_rls_nested_teams
20260621100000 e1_user_roles                     20260622190002 modelC_fix_unit_student_filter
20260621101000 e2_users_reports_to               20260623100000 scope_slide_reflections_manager
20260621102000 e3_subtree_resolvers
20260621103000 e4_rls_subtree
```

Os nomes dizem de onde vêm os achados 2, 4 e 9: `e2_users_reports_to` cria a coluna,
`e1_user_roles` cria a RLS rival, `modelC_nested_teams_schema` cria o `parent_group_id`.

---

## 10. ALTO (de outra natureza) — a migration da convergência **foi aplicada**, e o arquivo dela **não está versionado**

**Categoria: SÓ NO SERVIDOR, no sentido mais literal possível.**

O `RELATORIO-CONSOLIDADO.md` §2, escrito em 2026-08-28, registra a migration
`20260828120000_aprendizagem_time_convergencia` como *"**NÃO aplicada** — aguarda o Senhor"*.
**Em 2026-08-31 ela está aplicada e registrada**, junto com as três irmãs:

```
20260821000000 aprendizagem_time_schema
20260821010000 aprendizagem_time_seed_analise_problemas
20260825220000 aprendizagem_time_reconciliacao
20260828120000 aprendizagem_time_convergencia
```

Medido no schema, não no histórico: `capability_evidence` tem agora **25 colunas** (o consolidado
mediu 12), incluindo `comprehension` e `concept_id`; as 5 tabelas que faltavam (`concepts`,
`capability_concepts`, `capability_assessments`, `capability_assessment_evidence`,
`capability_assessment_criteria`) **existem**; e `capabilities` carrega os **dois** vocabulários
lado a lado (`code, name, order` **e** `slug, title, display_order, is_active`), que é a forma
aditiva que a convergência prometia.

O que faz disto um achado, e não uma boa notícia:

```
$ git status --short -uall | grep 20260828120000
?? supabase/migrations/20260828120000_aprendizagem_time_convergencia.sql
```

**O arquivo está `??` — nunca foi commitado.** Uma migration aplicada a produção existe apenas
como arquivo não versionado numa árvore de trabalho.

> **O que se perde:** se essa árvore for limpa, trocada de branch ou perdida, o banco de produção
> passa a ter um schema que **nenhum arquivo em lugar nenhum descreve** — e o inventário volta a
> encontrar 6 tabelas "só no servidor" em vez de 2, sem ninguém saber de onde vieram. É como as 12
> migrations do achado 9 nasceram.

Duas consequências operacionais imediatas: o §2 do `RELATORIO-CONSOLIDADO.md` está **desatualizado**
e não deve ser lido como estado corrente; e commitar esse arquivo é a ação mais barata deste
relatório inteiro.

---

## 11. BAIXO — `notification_templates`: a migration existe e o servidor não a tem

**Categoria: SÓ NA MIGRATION.** `20260710000000_engagement_personal_templates.sql` não está
registrada **e não foi aplicada**. Ausentes do servidor: colunas `scope` e `owner_user_id`,
índice `idx_notif_templates_owner`, e o corpo novo de `nt_select`/`nt_write` (os nomes existem, com
o corpo antigo de `20260604120000`).

> **Consequência:** templates pessoais não existem no banco; qualquer código que leia `scope` ou
> `owner_user_id` recebe `42703 column does not exist`. Não é exposição, é funcionalidade morta.

---

## Estado das 15 migrations do repo não registradas

"Não registrada" **não** significa "não aplicada". Medi o efeito de cada uma no catálogo:

| Veredito | Migrations |
|:---|:---|
| **Aplicada** (todo objeto presente) | `20260701020000`, `20260702222743`, `20260703003114` (13/13 políticas), `20260703010000`, `20260718120000`, `20260723000000`, `20260728120000` (14/14 políticas, 3/3 tabelas), `20260729120000`, `20260803000000` |
| **Não aplicada** | `20260630000000` (achado 3), `20260710000000` (achado 10) |
| **Divergente** | `20260701030000` (achado 4) |
| **Sem objeto mensurável** por este método | `20260701000000` (só grants em `auth`), `20260712000000` (só `UPDATE` de dado), `20260716000000` (só `UPDATE` de dado) — **NÃO-DETERMINADO** |

> **A conclusão que importa mais que a tabela:** `supabase_migrations.schema_migrations` **erra
> nas duas direções** neste banco — 12 registros sem arquivo, e 9 arquivos aplicados sem registro.
> Ele não serve como fonte de verdade para "o que está aplicado", em nenhum sentido.

---

## NÃO-DETERMINADO — o que não consegui medir, e por quê

| Item | Por que não determinei |
|:---|:---|
| Efeito de `20260701000000`, `20260712000000`, `20260716000000` | Só concedem privilégio em `auth` ou atualizam linhas. Não deixam objeto no catálogo, e comparar o **dado** exigiria conhecer o estado anterior. |
| `20260708120000_engagement_center_v2.sql` | Contém DDL dinâmico dentro de `DO $$ … EXECUTE format(…)`. O meu parser é cego a ele; a migration **está registrada**, mas o que ela criou não entra no lado "git" do diff. |
| Corpo de política para as 100 migrations registradas | Comparei corpo apenas nas 15 não registradas, onde a pergunta é viva. Uma divergência de corpo entre uma migration registrada e o servidor **não seria vista** por este inventário. |
| Objetos fora de `public` e `storage` | `auth`, `realtime`, `vault`, `extensions` não foram inventariados — são geridos pelo Supabase, e mexer neles não é decisão desta casa. |
| Se as 3 RPC do achado 1 são exploráveis por `POST` | Deliberadamente **não** testado: seria uma escrita em produção. A prova de alcance parou no `GET`, que é conclusiva quanto à **permissão** e silenciosa quanto ao resto. |
| Comparação de **tipo** de coluna (e não só de nome) | Fora do alcance do parser. Uma coluna com o mesmo nome e tipo diferente nos dois lados **passaria** por este inventário. |

---

## Um falso positivo meu, registrado

A comparação de corpo de política acusou `study_plans.sp_student_insert` como divergente. **Era
supersessão legítima:** `20260723000000` a cria, e `20260729000000` — que **está registrada** — a
redefine, e o corpo do servidor bate byte a byte com esta segunda. O método sinaliza supersessão
como divergência, e por isso cada item desta lista foi conferido contra o texto antes de entrar.

---

## Verificações

| Comando | Resultado |
|:---|:---|
| Controle de escrita no canal | `ERROR: 25006 cannot execute UPDATE in a read-only transaction` |
| Controle de leitura no canal | `[{"tenants":5}]` |
| `storage.buckets` pelo catálogo | 3 buckets, os 3 com `public: true` |
| RPCs expostas pelo PostgREST (spec via `service_role`) | 28, incluindo as 3 do achado 1 |
| Alcance de `anon` às 3 RPC (`GET`) | `405` + `25006` nas 3; controles negativos `404 PGRST202` |
| Tabelas / colunas / políticas / funções / gatilhos / índices | 81 / 930 / 324 / 46 / 22 / 323 |
| RLS por tabela | **81 de 81 com RLS ligada; nenhuma com zero políticas** |
| Migrations: servidor × repo | 100 registradas × 103 arquivos; 12 só no servidor, 15 só no repo |

Nada foi alterado. Nenhum commit, push, PR, deploy, MCP, DDL ou escrita em banco.
`storage` foi apenas **lido** pelo catálogo, conforme combinado com a frente que mede os buckets.
