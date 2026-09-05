# Contenção — `anon` nas RPC destrutivas, e três correções de RLS

> Objeto: projeto Supabase `vaguswivhqnlbgqvnjch` (**produção**). Data: 2026-08-31.
> Base: `INVENTARIO-SERVIDOR-VS-GIT.md`, achados 1, 3, 4 e 7.
> Toda mudança foi feita por **migration versionada**, aplicada pela Management API
> (`db push` está bloqueado neste projeto por divergência de histórico) e **registrada** em
> `supabase_migrations.schema_migrations`, para não repetir o defeito que o inventário revelou.

---

# TAREFA 1 — `EXECUTE` de `anon` nas três RPC destrutivas

**Estado: FECHADO E PROVADO.**
Migration: `supabase/migrations/20260831100000_contencao_anon_rpc_destrutivas.sql`

## 1.1 Antes de revogar: quem chama estas funções, e com que cliente

O briefing pedia parada e reporte caso alguma fosse chamada legitimamente pelo cliente anônimo.
**Nenhuma é.** Censo por `grep` de `rpc(` no repositório, com inspeção do cliente em cada sítio
(`createClient()` = sessão do usuário → papel `authenticated`; `createServiceClient()` → papel
`service_role`):

| Função | Chamadores `anon` | Chamadores `authenticated` | Chamadores `service_role` |
|:---|:--|:--|:--|
| `lgpd_soft_delete_user` | **0** | **0** | 1 — `api/privacy/delete/route.ts:100` |
| `jsonb_profile_merge` | **0** | 10 — assessments (6), `perfil/actions.ts` (3), `dashboard/actions.ts` (1) | 2 — `lib/profiling.ts:128`, `api/assessments/upload/route.ts:167` |
| `swap_onboarding_course` | **0** | 1 — `(platform)/courses/actions.ts:468`, atrás de `requireContentRole` | 0 |

Todos os 11 sítios `authenticated` passam por `createClient()` seguido de `auth.getUser()` com
retorno antecipado se não houver usuário. Nenhum caminho legítimo depende de `anon`.
**Logo, revogar de `anon` não quebra funcionalidade real** — e a tarefa seguiu sem parada.

## 1.2 O que foi revogado, e o que foi deliberadamente preservado

O briefing pediu recomendação **com argumento** sobre `authenticated`. A resposta não é uniforme,
porque a exposição não é a mesma nas três:

| Função | `anon` | `authenticated` | Argumento |
|:---|:--|:--|:---|
| `lgpd_soft_delete_user` | **REVOGADO** | **REVOGADO** | Chamador único é `service_role`. Um aluno logado não tem por que apagar outro por UUID, e revogar não quebra nada. Custo zero, risco eliminado. |
| `jsonb_profile_merge` | **REVOGADO** | **PRESERVADO** | 10 chamadores legítimos com sessão. Revogar derrubaria assessments, perfil e dashboard. |
| `swap_onboarding_course` | **REVOGADO** | **PRESERVADO** | Chamador legítimo com sessão. Revogar derrubaria a publicação de curso com swap. |

`service_role` manteve `EXECUTE` nas três — é o caminho pelo qual as rotas de servidor
legitimamente as chamam.

### O detalhe que decidia entre fechar e parecer fechar

A ACL medida antes era, nas três, idêntica:

```
=X/postgres   postgres=X/postgres   anon=X/postgres   authenticated=X/postgres   service_role=X/postgres
```

O primeiro item, `=X/postgres`, é **`PUBLIC` com EXECUTE** — do qual `anon` herdaria mesmo depois
de um `REVOKE ... FROM anon`. O terceiro é uma concessão **nominal** a `anon`, que sobrevive a um
`REVOKE ... FROM PUBLIC`. **Revogar só um dos dois deixa a porta aberta e produz a aparência de
conserto.** A migration nomeia os dois, que é o padrão já estabelecido nesta casa
(`20260702222743`, `20260703010000`, `20260718120000`) — cujo próprio comentário documenta essa
armadilha. O padrão não foi inventado; foi estendido ao conjunto que sempre foi o mais perigoso.

## 1.3 Prova — números crus, mesmo instrumento antes e depois

### (a) Privilégio, por `has_function_privilege`

**ANTES**

```json
{"funcao":"jsonb_profile_merge(uuid,text,text,text)","anon_executa":true,"auth_executa":true,"service_executa":true,
 "acl_bruto":"=X/postgres\npostgres=X/postgres\nanon=X/postgres\nauthenticated=X/postgres\nservice_role=X/postgres"}
{"funcao":"lgpd_soft_delete_user(uuid)","anon_executa":true,"auth_executa":true,"service_executa":true,
 "acl_bruto":"=X/postgres\npostgres=X/postgres\nanon=X/postgres\nauthenticated=X/postgres\nservice_role=X/postgres"}
{"funcao":"swap_onboarding_course(uuid,uuid)","anon_executa":true,"auth_executa":true,"service_executa":true,
 "acl_bruto":"=X/postgres\npostgres=X/postgres\nanon=X/postgres\nauthenticated=X/postgres\nservice_role=X/postgres"}
```

**DEPOIS**

```json
{"funcao":"jsonb_profile_merge(uuid,text,text,text)","anon_executa":false,"auth_executa":true,"service_executa":true,
 "acl_bruto":"postgres=X/postgres\nauthenticated=X/postgres\nservice_role=X/postgres"}
{"funcao":"lgpd_soft_delete_user(uuid)","anon_executa":false,"auth_executa":false,"service_executa":true,
 "acl_bruto":"postgres=X/postgres\nservice_role=X/postgres"}
{"funcao":"swap_onboarding_course(uuid,uuid)","anon_executa":false,"auth_executa":true,"service_executa":true,
 "acl_bruto":"postgres=X/postgres\nauthenticated=X/postgres\nservice_role=X/postgres"}
```

`=X/postgres` (o `PUBLIC`) **desapareceu das três**. `service_role` intacto nas três;
`authenticated` intacto nas duas em que é legítimo, e removido na única em que não era.

### (b) Alcance real, pela chave `anon`, por HTTP — o teste que provou a exposição

Mesma sonda, mesmo `GET`, mesma chave pública do site. **Nenhum `POST` foi feito, em momento
algum, conforme a proibição.**

**ANTES**

```
lgpd_soft_delete_user       HTTP 405  {"code":"25006", … "cannot execute UPDATE in a read-only transaction"}
jsonb_profile_merge         HTTP 405  {"code":"25006", … "cannot execute UPDATE in a read-only transaction"}
swap_onboarding_course      HTTP 405  {"code":"25006", … "cannot execute UPDATE in a read-only transaction"}
```

**DEPOIS**

```
lgpd_soft_delete_user       HTTP 401  {"code":"42501", … "permission denied for function lgpd_soft_delete_user"}
jsonb_profile_merge         HTTP 401  {"code":"42501", … "permission denied for function jsonb_profile_merge"}
swap_onboarding_course      HTTP 401  {"code":"42501", … "permission denied for function swap_onboarding_course"}
```

**A leitura que importa:** `25006` era emitido de **dentro do corpo** — o corpo rodava, e só a
transação somente-leitura do `GET` o interrompia na primeira escrita. `42501` é emitido **antes
de entrar no corpo**. A diferença entre os dois códigos é exatamente a diferença entre "a
barreira era o verbo HTTP" e "a barreira é a permissão". Por `POST`, o `25006` não teria
acontecido; o `42501` acontece igual.

### (c) Controles, para o depois não ser verde por vacuidade

Um `42501` universal também apareceria se eu tivesse derrubado o canal inteiro. Não derrubei:

```
                                    ANTES                    DEPOIS
funcao_inexistente_xyz              404 PGRST202             404 PGRST202     (inalterado)
lgpd c/ parametro errado            404 PGRST202             404 PGRST202     (inalterado)
auth_tenant_id (SECDEF, só lê)      200 null                 200 null         (inalterado)
```

O controle positivo é o que dá sentido ao vermelho: uma função `SECURITY DEFINER` que apenas lê
continua respondendo `200` para `anon`. O canal está vivo, a chave é válida, o PostgREST resolve
funções. Só as três deixaram de ser alcançáveis.

## 1.4 Registro no histórico

```
[{"version":"20260831100000","name":"contencao_anon_rpc_destrutivas"}]
```

Aplicada **e** registrada. O inventário mostrou 12 migrations registradas sem arquivo e 9
arquivos aplicados sem registro; esta não engrossa nenhuma das duas listas.

## 1.5 O que NÃO foi fechado, e por que — o risco residual, declarado

**`authenticated` ainda alcança `jsonb_profile_merge` e `swap_onboarding_course`, e essas funções
continuam sem conferir o chamador.** Um usuário logado qualquer, de qualquer tenant, ainda pode
escrever chave arbitrária no `profile` de outro usuário cujo UUID conheça.

Isto **não se fecha por privilégio** — revogar derrubaria 11 sítios de código real. Fecha-se
conferindo o chamador **dentro do corpo**, o que muda o corpo da função. Fica como recomendação
explícita, não executada:

```sql
-- em jsonb_profile_merge, no topo do corpo:
IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
  RAISE EXCEPTION 'jsonb_profile_merge: chamador % nao pode escrever no perfil de %', auth.uid(), p_user_id
    USING ERRCODE = '42501';
END IF;
```

A guarda precisa da condição `auth.uid() IS NOT NULL` porque os 2 chamadores `service_role`
(`lib/profiling.ts` e `api/assessments/upload/route.ts`) escrevem no perfil de **outro** usuário
legitimamente, e sob `service_role` o `auth.uid()` é nulo. Sem essa condição, a guarda quebraria
o pipeline de perfil de IA.

Não executei porque **muda comportamento de função chamada por 12 sítios de aplicação**, e o
briefing manda parar e reportar quando a correção sai do banco e toca o app. É a decisão do
Senhor, não minha. Custo de errar aqui é alto e o `anon` — o vetor sem login, que era a urgência
— já está fechado.

Da mesma natureza, e igualmente não executado: `swap_onboarding_course` deveria conferir que o
chamador pertence ao `p_tenant_id`, hoje aceito como parâmetro sem verificação.

---

# TAREFA 2 — os três itens da mesma rodada

## 2(a) O recorte por equipe do gestor — APLICADO

**Estado: FECHADO E PROVADO.**
Migration: `supabase/migrations/20260630000000_engagement_rls_group_scope.sql` — arquivo que **já
existia no repo**, nunca registrado e nunca aplicado. Não reescrevi: apliquei verbatim.

Antes de aplicar, conferi que as quatro dependências existem no servidor, porque uma migration que
falha na metade é pior que uma não aplicada:

```
fn_auth_managed_group_ids: 1   fn_is_super_admin: 1   tab_manager_group_members: 1
col_target_student_ids: 1 (jsonb)
linhas: manager_group_members=199   nudge_suggestions=70   notifications=120
```

### O aviso do briefing, confirmado no dado

O casamento **por nome** dava 2/2 presentes antes e 2/2 depois — o nome nunca mudou. Comparei
**corpos**, procurando o identificador distintivo `auth_managed_group_ids`:

**ANTES** — `notifications_insert` (`WITH CHECK`):

```
((tenant_id = auth_tenant_id())
 AND (auth_user_role() = ANY (ARRAY['admin'::text, 'manager'::text]))
 AND (EXISTS ( SELECT 1 FROM users u
        WHERE ((u.id = notifications.recipient_id) AND (u.tenant_id = auth_tenant_id())))))
```

**ANTES** — `ns_write` (`USING` e `WITH CHECK`, idênticos):

```
((tenant_id = auth_tenant_id()) AND (auth_user_role() = ANY (ARRAY['admin'::text, 'manager'::text])))
```

Nenhum dos dois menciona grupo. Um `manager` satisfazia o predicado para **qualquer** aluno do
tenant.

**DEPOIS** — `notifications_insert` (`WITH CHECK`):

```
((tenant_id = auth_tenant_id())
 AND (EXISTS ( SELECT 1 FROM users u
        WHERE ((u.id = notifications.recipient_id) AND (u.tenant_id = auth_tenant_id()))))
 AND ((auth_user_role() = 'admin'::text)
      OR ((auth_user_role() = 'manager'::text)
          AND (recipient_id IN ( SELECT mgm.student_id FROM manager_group_members mgm
                                  WHERE (mgm.group_id = ANY (auth_managed_group_ids()))))))) 
```

**DEPOIS** — `ns_write` (`USING` e `WITH CHECK`, idênticos):

```
((tenant_id = auth_tenant_id())
 AND ((auth_user_role() = 'admin'::text)
      OR ((auth_user_role() = 'manager'::text)
          AND (NOT (EXISTS ( SELECT 1
                 FROM jsonb_array_elements_text(nudge_suggestions.target_student_ids) t(student_id)
                WHERE (NOT ((t.student_id)::uuid IN ( SELECT mgm.student_id FROM manager_group_members mgm
                                WHERE (mgm.group_id = ANY (auth_managed_group_ids()))))))))))
```

`admin` continua abrangendo o tenant; `manager` passa a alcançar só as equipes que possui;
`super_admin` mantém a travessia por `notifications_super_admin`/`ns_super_admin`, intocadas. A
assimetria some: o caminho de **leitura** já era recortado por grupo (`notifications_select` já
citava `auth_managed_group_ids`), e agora o de **escrita** também é.

**Limite honesto, que o cabeçalho da própria migration declara:** estas políticas são
`TO authenticated`, então governam o vetor do JWT do gestor batendo direto no PostgREST. O caminho
de produto (rota → engine) escreve por `service_role`, que contorna RLS — ali a trava é a camada de
aplicação (`safeIds`). Esta migration fecha a outra porta, a que o filtro do app não alcança.

## 2(b) As duas RLS rivais de `user_roles` — RESOLVIDO NOS DOIS LADOS

**Estado: FECHADO.**
Migration nova: `supabase/migrations/20260831110000_user_roles_rls_canonica.sql`
Arquivo editado: `supabase/migrations/20260701030000_epic30_user_roles.sql`

### Quanto a reconciliação alargaria, medido antes

| Lado | Política | Predicado |
|:---|:---|:---|
| Servidor | `ur_self_select` | `user_id = auth.uid()` |
| Servidor | `ur_admin_manage` | `has_role(auth.uid(),'admin') AND tenant_id = auth_tenant_id()`, com `CHECK` limitando `role` a `student\|leader\|manager\|instructor` |
| Servidor | `ur_super_admin_all` | `is_super_admin()` |
| Repo | `user_roles_select` | `tenant_id = auth_tenant_id() OR user_id = auth.uid()` |
| Repo | `user_roles_admin` | `auth_user_role() IN ('admin','super_admin')` |

As duas do repo são estritamente mais largas, e `user_roles_admin` é a pior por **duas** omissões
que se somam: **não tem predicado de tenant** (um `admin` do tenant A escreveria `user_roles` do
tenant B) e **não tem `WITH CHECK`** — sendo `FOR ALL`, o `USING` passa a valer na escrita, e
`USING` só pergunta *quem é o chamador*, nunca *o que ele grava*. É exatamente a lista
`student|leader|manager|instructor` do `CHECK` canônico que hoje impede um `admin` de gravar a
própria linha com `role='super_admin'`. A versão do repo remove essa trava.

E o alargamento **não apareceria num `git diff`**: políticas permissivas combinam-se por **OU**, de
modo que o ganho está na SOMA dos dois conjuntos, não em qualquer um deles isolado.

### A resolução: duas travas, porque uma só não cobre o cenário do achado

1. **Migration nova** derruba os dois nomes largos (`DROP POLICY IF EXISTS` — hoje não existem; o
   `IF EXISTS` é a trava para o dia em que existirem) e reafirma os três canônicos byte a byte.
   Como `20260831110000` > `20260701030000`, num replay ordenado do git ela roda depois e limpa.
2. **O arquivo `20260701030000` foi editado** para não criar mais as duas políticas largas. Sem
   isto, a trava 1 protegeria só o replay ordenado — e o cenário do achado 4 é precisamente alguém
   aplicar aquele arquivo **sozinho, fora de ordem**, para "reconciliar". Agora ele é inofensivo
   isolado: cria a tabela com RLS ligada e **sem política** (negação total, falha fechada) e aponta
   para a migration canônica.

A tabela e o `INSERT` de seed do arquivo original foram preservados — só as duas políticas saíram.

### Um obstáculo que a correção teve de resolver de passagem

As políticas canônicas dependem de `public.has_role(uuid,text)`, que é uma das 16 funções que **só
existem no servidor** (achado 9) — nenhuma migration do repo a cria. Sem recuperá-la, a RLS
canônica seria inexprimível em git, que é a raiz do problema. A migration nova a traz de volta por
`CREATE OR REPLACE`, com o corpo lido de `pg_get_functiondef` em produção: no-op lá, criação num
banco novo, e **`CREATE OR REPLACE` preserva a ACL**, então nenhum privilégio mudou.

### Prova

```
                          ANTES                                    DEPOIS
politicas em user_roles   3 (ur_self_select, ur_admin_manage,      3 — as MESMAS TRÊS
                             ur_super_admin_all)
nomes largos presentes    0                                        0
corpo ur_admin_manage     has_role(...) AND tenant_id = ...        IDÊNTICO
                          CHECK ... role = ANY(student,leader,     IDÊNTICO
                          manager,instructor)
```

Produção não mudou de comportamento — e é esse o resultado desejado: o conjunto correto foi
**fixado** como canônico e reproduzível em git, e o caminho pelo qual ele poderia ser alargado foi
removido.

## 2(c) Os 10 `SECURITY DEFINER` sem `search_path` — FECHADO

**Estado: FECHADO E PROVADO.**
Migration: `supabase/migrations/20260831120000_secdef_search_path_fixo.sql`

As 10 são exatamente as do inventário: `auth_tenant_id`, `auth_user_area_ids`, `auth_user_role`,
`claim_session_turn`, `get_random_active_question`, `jsonb_profile_merge`, `lgpd_soft_delete_user`,
`release_session_turn`, `swap_onboarding_course`, `update_enrollment_progress`.

**Escolha de método:** `ALTER FUNCTION ... SET search_path`, não `CREATE OR REPLACE`. O `ALTER`
anexa configuração e **não toca corpo, assinatura nem ACL** — nenhuma linha de lógica muda, nada a
revisar em diff de corpo. É a correção de menor risco que produz o efeito completo.

**Escolha do valor (`= public`, sem `extensions`, sem `pg_temp`), medida nos corpos antes:**

```
referencias a outro schema nos 10 corpos : 3 x `auth.uid`  — e QUALIFICADAS (independem de search_path)
chamadas nao qualificadas a extensao     : 0  (gen_random_uuid|crypt|digest|gen_salt|pgp_*|unaccent|similarity)
mencoes a TEMP/TEMPORARY                 : 0
```

Sem chamada de extensão, `extensions` no caminho seria ruído. Sem uso de temporária, `pg_temp` é
dispensável — e omiti-lo é o mais seguro, porque `pg_temp` no caminho reabre parcialmente a mesma
porta que se está fechando. `pg_catalog` é implicitamente o primeiro, sempre.

### Prova

```
                                ANTES     DEPOIS
secdef total em public            31        31
secdef SEM search_path            10         0
secdef COM search_path            21        31
controle: invoker COM path         2         2   (inalterado — a consulta discrimina)
```

O controle existe para o zero não ser zero por vacuidade: se a consulta tivesse deixado de
distinguir, o `2` das funções `SECURITY INVOKER` com `search_path` teria se mexido junto. Não se
mexeu.

---

# Verificação consolidada — uma consulta, os quatro itens

```json
{"t1_anon_ainda_executa": 0,        // era 3
 "t2a_politicas_com_recorte": 2,    // era 0 (notifications_insert, ns_write)
 "t2b_politicas_largas": 0,         // continua 0, agora por construção
 "t2b_total_user_roles": 3,         // as três canônicas
 "t2c_secdef_sem_path": 0,          // era 10
 "migrations_registradas": 4}
```

## Migrations desta rodada — todas versionadas E registradas

| Versão | Nome | Origem |
|:---|:---|:---|
| `20260630000000` | `engagement_rls_group_scope` | arquivo **já existia** no repo, aplicado verbatim |
| `20260831100000` | `contencao_anon_rpc_destrutivas` | nova |
| `20260831110000` | `user_roles_rls_canonica` | nova |
| `20260831120000` | `secdef_search_path_fixo` | nova |

Aplicadas pela Management API — `supabase db push` está bloqueado neste projeto pela divergência de
histórico do achado 9 — e **registradas** em `supabase_migrations.schema_migrations`. Nenhuma
engrossa a lista de "12 registradas sem arquivo" nem a de "9 arquivos aplicados sem registro".

---

# PARADA E REPORTE — a premissa do levantamento mudou

O inventário disse **três** funções `SECURITY DEFINER` que escrevem sem conferir o chamador. A
verificação das 22 alcançáveis por `anon` encontrou **mais quatro**, e uma delas não parou no verbo
HTTP:

| Função | Sonda `GET` com chave anon | Chamador legítimo | `search_path` |
|:---|:---|:---|:--|
| `claim_session_turn(uuid,uuid)` | `405` + `25006` (corpo rodou) | `api/sessions/[id]/messages/route.ts:56`, cliente de sessão → `authenticated` | fixado por `20260831120000` |
| `release_session_turn(uuid,uuid)` | `405` + `25006` | `…/messages/route.ts:360`, mesmo cliente | fixado |
| `update_enrollment_progress(uuid,uuid)` | `405` + `25006` | 2 sítios `authenticated` + 1 `service_role` | fixado |
| `recompute_primary_role(uuid)` | **`204` — EXECUTOU com a chave pública** | **nenhum na aplicação**; só o gatilho `trg_recompute_primary_role()` | já tinha |

As três primeiras têm a forma idêntica às de T1: `anon` sem chamador legítimo, `authenticated`
legítimo. Revogar de `PUBLIC, anon` seria a mesma cirurgia, com o mesmo risco (nenhum).

`recompute_primary_role` é diferente e **não é** simples: ela **executou de fato** — `204`, não
`405` — logo não há dúvida de alcance. Reescreve `users.role` a partir de `user_roles`, e não
inventa papel novo (não é escalada), mas é escrita numa coluna de papel disparável sem login. Não
tem chamador na aplicação: só o gatilho. **A armadilha está aí:** se `trg_recompute_primary_role()`
for `SECURITY INVOKER`, a chamada interna é feita com o papel de quem escreveu em `user_roles`, e
revogar `EXECUTE` de `authenticated` **quebraria o gatilho** no caminho legítimo. Isso precisa ser
medido antes, não suposto. Ela também não existe em migration alguma — é mais uma função só do
servidor (achado 9).

**Parei aqui e não revoguei nada disso**, conforme a regra 3 do briefing: divergência do
levantamento, reporte em vez de improviso. As sete funções são a mesma família e o mesmo mecanismo
(`DEFAULT ACL` do Supabase), mas a autorização que recebi nomeava três. **Recomendo autorizar a
segunda rodada** — as três de sessão/progresso são cirurgia idêntica à já provada; a quarta exige
antes medir o `prosecdef` do gatilho. Rastreado na tarefa #47.

## O que continua aberto, declarado

1. **As 4 acima** — recomendação acima.
2. **`authenticated` em `jsonb_profile_merge` e `swap_onboarding_course`** (§1.5): não se fecha por
   privilégio sem derrubar 11 sítios de código; fecha-se conferindo o chamador dentro do corpo.
   Muda função chamada por 12 sítios de aplicação — decisão do Senhor, não minha.
3. **`recompute_primary_role` e `has_role` não existem em migration** — `has_role` foi recuperada
   nesta rodada; `recompute_primary_role` não.

Nada foi apagado. Nenhum `POST` foi disparado contra função vulnerável, em momento algum. Nenhum
bucket foi tocado. Nenhum commit, push, PR ou deploy.

---

# SEGUNDA RODADA — as demais `SECURITY DEFINER` que escrevem

**Estado: FECHADO E PROVADO.** Autorizada pelo lead após a parada acima.
Migration: `supabase/migrations/20260831130000_contencao_anon_rpc_escrita_2a_rodada.sql`

## R2.1 A reconciliação das contagens: 4, 5, e por que a resposta é 6 em duas classes

Duas medições independentes deram números diferentes — 4 (a minha) e 5 (a do lead). **Nenhuma das
duas estava completa.** São **6** funções `SECURITY DEFINER` alcançáveis por `anon` cujo corpo
escreve, e o critério que as separa não é o nome, é o **tipo de retorno**
(`pg_proc.prorettype = 'trigger'`):

| Classe | Função | Retorno | Sonda `GET` com chave anon |
|:---|:---|:---|:---|
| **A** — chamável por RPC | `claim_session_turn(uuid,uuid)` | `record` | `405` + `25006` — o corpo rodou |
| **A** | `release_session_turn(uuid,uuid)` | `void` | `405` + `25006` |
| **A** | `update_enrollment_progress(uuid,uuid)` | `record` | `405` + `25006` |
| **A** | `recompute_primary_role(uuid)` | `void` | **`204` — executou de fato** |
| **B** — função de gatilho | `trg_recompute_primary_role()` | `trigger` | `404 PGRST202` |
| **B** | `users_reports_to_guard()` | `trigger` | `404 PGRST202` |
| **B** (só valida, não escreve) | `manager_groups_parent_guard()` | `trigger` | `404 PGRST202` |

Minha contagem viu só a classe A (4). A do lead viu a classe A mais `users_reports_to_guard`, sem
`trg_recompute_primary_role` (5). **A suspeita do lead estava certa: a diferença era de critério** —
e o critério correto separa as classes em vez de somá-las, porque elas exigem tratamento diferente.

**A classe B nunca foi vetor de RPC:** o PostgREST **não expõe função que retorna `trigger`**, e as
três devolvem `404` antes e depois. O `EXECUTE` de `anon` sobre elas é resíduo do DEFAULT ACL, não
porta aberta. Revoguei mesmo assim, por higiene — privilégio que não serve a ninguém não deve
existir, e assim a próxima varredura não precisa reclassificá-las do zero.

## R2.2 Uma armadilha da própria sonda, registrada

A primeira medição de `recompute_primary_role` deu **`404 PGRST202`** — que eu quase li como
"fechada". Era falso: o parâmetro dela chama-se **`_uid`**, não `p_user_id`. Com o nome errado, o
PostgREST não casa a assinatura e responde exatamente como responderia para uma função inexistente.
Corrigido o nome, veio o `204`. **Uma sonda de alcance com parâmetro errado produz um "fechado"
indistinguível do fechado verdadeiro** — por isso a assinatura tem de vir de
`pg_get_function_arguments`, nunca de suposição sobre a convenção de nomes.

## R2.3 O que foi revogado, e a verificação que precedeu cada decisão

| Função | `anon` | `authenticated` | O que foi conferido ANTES |
|:---|:--|:--|:---|
| `claim_session_turn` | **REVOGADO** | preservado | `api/sessions/[sessionId]/messages/route.ts:56`, por `createClient()` → turno da sessão socrática, caminho legítimo do aluno |
| `release_session_turn` | **REVOGADO** | preservado | mesma rota, linha 360, mesmo cliente |
| `update_enrollment_progress` | **REVOGADO** | preservado | 2 sítios `authenticated` (`chapters/[chapterId]/actions.ts:126`, `…/session/actions.ts:13`) + 1 `service_role` |
| `recompute_primary_role` | **REVOGADO** | **REVOGADO** | zero chamadores na aplicação; só o gatilho — ver abaixo |
| `trg_recompute_primary_role` | **REVOGADO** | **REVOGADO** | não exposta por RPC |
| `users_reports_to_guard` | **REVOGADO** | **REVOGADO** | não exposta por RPC |
| `manager_groups_parent_guard` | **REVOGADO** | **REVOGADO** | não exposta por RPC |

### A medição que decidiu o caso de `recompute_primary_role`

O risco apontado era real: se `trg_recompute_primary_role()` fosse `SECURITY INVOKER`, a chamada
interna correria com o papel de quem escreveu em `user_roles`, e revogar de `authenticated`
**quebraria o gatilho** no caminho legítimo. Medido, não suposto:

```
trg_recompute_primary_role()   dono=postgres   prosecdef=TRUE   @ user_roles
```

Sendo `SECURITY DEFINER` de `postgres`, a chamada interna é autorizada como `postgres`, que mantém
`EXECUTE`. O gatilho segue funcionando com `authenticated` revogado.

Para a classe B vale um segundo motivo, independente: **o PostgreSQL checa `EXECUTE` sobre a função
de gatilho no `CREATE TRIGGER`, não a cada disparo.** O gatilho dispara independentemente do
privilégio de quem fez a escrita que o acionou. Por isso revogar da classe B é inerte para o
funcionamento e útil só como higiene.

## R2.4 Prova

**Privilégio**

```
                                        ANTES                      DEPOIS
                                    anon   auth   svc          anon   auth   svc
claim_session_turn                  true   true   true         false  true   true
release_session_turn                true   true   true         false  true   true
update_enrollment_progress          true   true   true         false  true   true
recompute_primary_role              true   true   true         false  false  true
trg_recompute_primary_role          true   true   true         false  false  true
users_reports_to_guard              true   true   true         false  false  true
manager_groups_parent_guard         true   true   true         false  false  true
```

**Alcance por HTTP, chave anon, só `GET`**

```
                              ANTES                          DEPOIS
claim_session_turn            405  25006 (corpo rodou)        401  42501 permission denied
release_session_turn          405  25006                      401  42501
update_enrollment_progress    405  25006                      401  42501
recompute_primary_role        204  EXECUTOU                   401  42501
trg_recompute_primary_role    404  PGRST202                   404  PGRST202   (nunca exposta)
users_reports_to_guard        404  PGRST202                   404  PGRST202
manager_groups_parent_guard   404  PGRST202                   404  PGRST202
CONTROLE inexistente          404  PGRST202                   404  PGRST202
CONTROLE auth_tenant_id       200  null                       200  null       (canal vivo)
```

**Varredura final do conjunto inteiro**

```
SECDEF alcancaveis por anon : 22  ->  15
dessas, quantas ESCREVEM    :  6  ->   0
```

## R2.5 O segundo achado do lead: os 6 `REVOKE` versionados ESTÃO em vigor

A pergunta era qual das três: nunca aplicados, desfeitos depois, ou cobrem outras funções.
**Resposta: cobrem outras funções.** Teste discriminante — medir `anon` sobre as funções que os
`REVOKE` de fato nomeiam, contra as que o lead observou abertas:

```
FUNCOES NOMEADAS PELOS REVOKE VERSIONADOS        anon    -> revogacao EM VIGOR
  auth_direct_student_ids(uuid)                  false
  subtree_student_ids(uuid)                      false
  auth_subtree_user_ids()                        false
  auth_reachable_student_ids()                   false
  auth_team_engagement_signals(uuid[])           false
  custom_access_token_hook(jsonb)                false   (auth tambem false)

FUNCOES QUE O LEAD OBSERVOU ABERTAS              anon    -> NUNCA foram nomeadas
  auth_tenant_id()                               true
  auth_user_role()                               true
  has_role(uuid,text)                            true
  has_any_role(uuid,text[])                      true
  is_super_admin()                               true
```

Os `REVOKE` versionados funcionam e estão em vigor — todos os que eles nomeiam estão fechados.
`auth_tenant_id`, `auth_user_role`, `has_role`, `has_any_role` e `is_super_admin` **nunca
constaram de nenhum deles**. Não é um `REVOKE` versionado fora de vigor (o que seria da família
"o repositório diz uma coisa e o banco faz outra"); é **cobertura incompleta**, que é o mesmo
padrão do achado 1: o mecanismo foi entendido e aplicado a um subconjunto.

A lista dos `REVOKE` existentes explica o recorte: eles vieram junto com as migrations dos
resolvedores de organograma (`20260702222743`, `20260703010000`, `20260718120000`), endurecendo o
que aquelas migrations criavam. Os helpers mais antigos e mais centrais ficaram de fora por serem
anteriores, não por decisão.

**Não revoguei estas cinco**, e recomendo cautela específica: `auth_tenant_id`, `auth_user_role`,
`has_role` e `is_super_admin` são **invocadas de dentro das políticas de RLS**, que são avaliadas
com o papel de quem consulta. Revogar de `authenticated` arriscaria travar leitura legítima em
larga escala. Revogar só de `anon` é provavelmente seguro (`anon` não deveria avaliar política
nenhuma que dependa de identidade), mas **as cinco só leem** — a gravidade é baixa e o custo de
errar é alto. Merece uma rodada própria, com prova de que nenhuma política é avaliada sob `anon`
antes de mexer. As quatro já ganharam `search_path` fixo na tarefa 2(c), que era o flanco
realmente perigoso delas.

## R2.6 O que permanece aberto

1. **`update_enrollment_progress` continua sem conferir o CHAMADOR** — um aluno logado ainda pode
   mexer no progresso de matrícula de outro passando o UUID dele. Mesma natureza do §1.5: não se
   fecha por privilégio sem derrubar o produto, fecha-se com guarda no corpo.
2. **Os 5 helpers de leitura** (`auth_tenant_id`, `auth_user_role`, `has_role`, `has_any_role`,
   `is_super_admin`) alcançáveis por `anon` — recomendação acima.
3. **`recompute_primary_role`, `trg_recompute_primary_role`, `users_reports_to_guard`,
   `manager_groups_parent_guard` não existem em migration alguma** — mais funções só do servidor
   (achado 9). Esta migration as nomeia, mas não as define; se o banco for reconstruído do git,
   ela falha.

Migrations desta rodada: `20260831130000`, versionada **e** registrada. Nenhum `POST`, nenhuma
escrita, nenhum bucket, nenhum commit ou push.

---

# TERCEIRA RODADA — a guarda de chamador nas duas residuais

**Estado: FECHADO E PROVADO NOS DOIS SENTIDOS.** Autorizada pelo lead.
Migration: `supabase/migrations/20260831140000_guarda_de_chamador_nas_duas_residuais.sql`

Esta é a única mudança desta consolidação que altera **comportamento**, não privilégio. Por isso o
censo veio antes e a prova é bidirecional.

## R3.1 Censo de `jsonb_profile_merge` — são 13 sítios, não 12

**Corrijo a minha própria contagem:** eu vinha dizendo 12. São **13** —
`api/profile/generate/route.ts:82` tinha escapado do meu censo inicial. Enumerados um a um, com o
argumento `p_user_id` lido no próprio sítio:

| # | Sítio | Papel | `p_user_id` | Guarda afeta? |
|--:|:---|:---|:---|:---|
| 1 | `(platform)/assessments/disc/actions.ts:68` | authenticated | `user.id` | Não, é self |
| 2 | `(platform)/assessments/big-five/actions.ts:83` | authenticated | `user.id` | Não |
| 3 | `(platform)/assessments/career-anchors/actions.ts:68` | authenticated | `user.id` | Não |
| 4 | `(platform)/assessments/kolb/actions.ts:45` | authenticated | `user.id` | Não |
| 5 | `(platform)/assessments/multiple-intelligences/actions.ts:67` | authenticated | `user.id` | Não |
| 6 | `(platform)/assessments/enneagram/actions.ts:51` | authenticated | `user.id` | Não |
| 7 | `(platform)/perfil/actions.ts:80` | authenticated | `user.id` | Não |
| 8 | `(platform)/perfil/actions.ts:115` | authenticated | `user.id` | Não |
| 9 | `(platform)/perfil/actions.ts:202` | authenticated | `user.id` | Não |
| 10 | `(platform)/dashboard/actions.ts:54` | authenticated | `user.id` | Não |
| 11 | `api/profile/generate/route.ts:82` | authenticated | `user.id` | Não |
| 12 | `api/assessments/upload/route.ts:167` | service_role | `user.id` | Não |
| 13 | `lib/profiling.ts:128` | service_role | **`studentId`** | Não — ver abaixo |

**O sítio 13 é o único que passa o UUID de outro usuário** — exatamente o caso que o briefing
mandou procurar antes de aplicar. Ele sobrevive porque roda sob `service_role`:
`createServiceClient()` (`lib/supabase/service.ts`) monta o cliente com `SUPABASE_SERVICE_ROLE_KEY`
e `persistSession: false`, **sem sessão de usuário**, então `auth.uid()` é NULL e a primeira
condição da guarda já a desarma. É esse o motivo de a condição existir; sem ela o pipeline de perfil
de IA quebraria.

**Nenhum sítio `authenticated` age sobre outro usuário.** Os 11 passam `user.id` obtido de
`auth.getUser()` na mesma função. Não houve condição de parada.

## R3.2 Censo de `swap_onboarding_course` — 1 sítio, e a isenção que ele obrigou

Sítio único: `(platform)/courses/actions.ts:468`, que passa `courseData.tenant_id` — o tenant do
**curso**, não o do usuário.

A guarda ingênua (`auth_tenant_id() = p_tenant_id`) **quebraria o super_admin**, e isto foi medido:

- `requireCourseManager` (`lib/course-management-guard.ts:104`) aceita `instructor`, `admin` **e
  `super_admin`**, e **não** compara o tenant do usuário com o do curso;
- `auth_tenant_id()` devolve `users.tenant_id` do chamador;
- e o super_admin ativo em produção tem **`tenant_id` NULO**:

```
super_admin_id 1f264a5c-12da-45a4-843c-3646e1caf4ba   tenant_dele: null
```

Isso é mais forte do que eu supunha: com `tenant_id` nulo, `NULL IS DISTINCT FROM p_tenant_id` é
sempre verdadeiro, então a guarda sem isenção bloquearia o super_admin **em 100% dos casos**, não
ocasionalmente. Daí o `NOT is_super_admin()` explícito — a mesma travessia que as políticas
`*_super_admin` já concedem em toda a base.

## R3.3 Prova bidirecional

Harness em `BEGIN … ROLLBACK`, simulando a sessão por `set_config('request.jwt.claims', …)` — que é
de onde `auth.uid()` lê, inclusive dentro de uma função `SECURITY DEFINER`. **Desenhado para casar
zero linhas mesmo se a guarda falhasse:** os UUIDs de usuário e curso não existem, e os dois
tenants usados têm **zero curso de onboarding publicado** (medido antes). Nenhum dado real foi
tocado nem dependeu do `ROLLBACK` para não ser tocado.

```
 n  caso                                                  esperado  obtido
 1  jpm: logado A escreve no perfil de B                  BARRADO   BARRADO 42501 >> ok
 2  jpm: logado A escreve no PROPRIO perfil               PASSA     PASSOU >> ok
 3  jpm: service_role escreve em terceiro (profiling.ts)  PASSA     PASSOU >> ok
 4  swap: gestor do tenant1 opera no tenant2              BARRADO   BARRADO 42501 >> ok
 5  swap: gestor opera no PROPRIO tenant                  PASSA     PASSOU >> ok
 6  swap: super_admin opera em outro tenant               PASSA     PASSOU >> ok
 7  swap: service_role opera em qualquer tenant           PASSA     PASSOU >> ok
```

Os dois sentidos que o lead exigiu: **o ilegítimo passou a ser barrado** (1 e 4) e **o legítimo
continua passando** (2, 3, 5, 6, 7 — cobrindo self, `service_role`, mesmo tenant e super_admin).

### Controle negativo — o `42501` vem da guarda, não do harness

Um harness que sempre devolvesse `42501` produziria os casos 1 e 4 sem que guarda alguma existisse.
Mesma máquina, mesmas condições do caso 1, contra `update_enrollment_progress`, que
deliberadamente **não** recebeu guarda:

```
SQLSTATE obtido: P0001   ("Enrollment not found")
leitura: NAO barrou o chamador (chegou na regra de negocio)
```

`P0001`, não `42501`: a função sem guarda deixa o chamador entrar e só tropeça na regra de negócio.
O `42501` dos casos 1 e 4 é, portanto, atribuível à guarda.

### ACL preservada pelo `CREATE OR REPLACE` — verificado, não assumido

```
jsonb_profile_merge     anon=false  auth=true   svc=true
lgpd_soft_delete_user   anon=false  auth=false  svc=true
swap_onboarding_course  anon=false  auth=true   svc=true
```

A contenção de `20260831100000` continua em vigor depois de reescrever os corpos.

## R3.4 O que permanece aberto

1. **`update_enrollment_progress` segue sem guarda de chamador** — um aluno logado ainda mexe no
   progresso de matrícula de outro por UUID. É a mesma cirurgia, e agora há um harness pronto que a
   provaria. Não estava na autorização desta rodada.
2. **Os 5 helpers de leitura** (`auth_tenant_id`, `auth_user_role`, `has_role`, `has_any_role`,
   `is_super_admin`) alcançáveis por `anon` — recomendação em R2.5.
3. **Reprodutibilidade:** `recompute_primary_role`, `trg_recompute_primary_role`,
   `users_reports_to_guard`, `manager_groups_parent_guard` continuam sem migration que as defina.

---

# QUARTA RODADA — `update_enrollment_progress`, a última

**Estado: FECHADO E PROVADO NOS DOIS SENTIDOS.** Autorizada pelo lead.
Migration: `supabase/migrations/20260831150000_guarda_de_chamador_update_enrollment_progress.sql`

## R4.1 Censo — 3 sítios, varredura ampla

| # | Sítio | Papel | `p_student_id` | Guarda afeta? |
|--:|:---|:---|:---|:---|
| 1 | `(platform)/courses/[courseId]/chapters/[chapterId]/actions.ts:126` | authenticated | `user.id` | Não, é self |
| 2 | `(platform)/courses/[courseId]/chapters/[chapterId]/session/actions.ts:13` | authenticated | `user.id` | Não, é self |
| 3 | `api/sessions/[sessionId]/messages/route.ts:275` | service_role | `user.id` | Não, `auth.uid()` é NULL |

Varri `*.ts`, `*.tsx`, `*.js` e `*.mjs`, não só os caminhos esperados — foi omitindo isso que um 13º
sítio escapou do censo de `jsonb_profile_merge`. **Nenhum sítio atualiza progresso de terceiro**, que
era a condição de parada. Não houve parada.

**Sem isenção de `super_admin`, e o motivo é diferente do caso anterior.** Em
`swap_onboarding_course` a isenção foi obrigatória porque a comparação é por TENANT e o super_admin
tem `tenant_id` nulo. Aqui a comparação é usuário-com-usuário, e o censo não achou caminho em que um
super_admin altere progresso de aluno sob sessão própria. Acrescentar a isenção sem esse caminho
existir afrouxaria a guarda em troca de nada. **A válvula de escape já existe:** qualquer ferramenta
administrativa futura que precise mexer em progresso alheio usa `service_role`, como o sítio 3 —
ali `auth.uid()` é NULL e a guarda não dispara.

## R4.2 Prova, com controle negativo em alvo novo

O lead apontou corretamente que `update_enrollment_progress` **era** o meu controle e não pode mais
sê-lo. Novo alvo: `release_session_turn`, que também escreve e também não confere o chamador (ela
confere se a sessão pertence a `p_user_id`, mas não se o CHAMADOR é `p_user_id`).

```
 n  caso                                                      SQLSTATE            veredito
 1  uep: aluno A altera progresso de B                        42501               BARRADO >> ok
 2  uep: aluno A altera o PROPRIO progresso                   P0001               passou a guarda >> ok
 3  uep: aluno real no PROPRIO progresso (matricula real)     sem erro, linhas=1  SUCESSO COMPLETO >> ok
 4  uep: service_role altera progresso de terceiro            P0001               passou a guarda >> ok
 5  CONTROLE release_session_turn (SEM guarda), A age sobre B P0001               nao barrou o chamador
```

O caso 3 é o mais forte: matrícula **real**, aluno **real**, dentro de `BEGIN … ROLLBACK` — a função
executou o caminho completo e devolveu 1 linha. Não é só "passou a guarda", é "funciona".

O controle (caso 5) devolve `P0001`, não `42501`: uma função sem guarda deixa o chamador entrar e
tropeça na regra de negócio. O `42501` do caso 1 é atribuível à guarda, não ao harness.

## R4.3 Um achado incidental que o harness pegou de raspão

A primeira execução do caso 3 deu `P0001` e eu quase o registrei como "quebrou o produto". Não era a
guarda — o caso 2 já provava que `P0001` é *depois* dela. Diagnosticado:

```
student fca10115…  tenant_do_usuario 8d45bcf4…   tenant_da_matricula aaaaaaaa-bf10-0001…   casam: false
```

A função filtra a matrícula por `e.tenant_id = (tenant do usuário)`. Quando os dois divergem, ela
levanta `Enrollment not found` e **o progresso daquele aluno nunca é atualizado, em silêncio**.
Alcance medido:

```
matriculas_total 304   tenant_nao_casa 2   alunos_afetados 2
```

**Duas matrículas de 304, em 2 alunos.** É pré-existente, não tem relação com esta migration, e não é
exposição — é funcionalidade morta para esses dois. Registro porque só apareceu por eu ter insistido
numa prova com dado real em vez de aceitar o `P0001` do UUID falso como suficiente.

---

# Placar final da consolidação

| # | Migration | O que fechou |
|:--|:---|:---|
| 1 | `20260630000000` | recorte por equipe do gestor (arquivo do repo, aplicado verbatim) |
| 2 | `20260831100000` | `anon` nas 3 RPC destrutivas |
| 3 | `20260831110000` | RLS canônica de `user_roles` + `has_role` recuperada para o git |
| 4 | `20260831120000` | `search_path` nas 10 `SECURITY DEFINER` |
| 5 | `20260831130000` | `anon` nas 4 RPC de escrita restantes + 3 funções de gatilho |
| 6 | `20260831140000` | guarda de chamador em `jsonb_profile_merge` e `swap_onboarding_course` |
| 7 | `20260831150000` | guarda de chamador em `update_enrollment_progress` |
| 8 | `20260831125000` | as 4 funções só do servidor recuperadas para o git — **NÃO aplicada** (no-op em produção; aguarda GO) |

Medido agora, numa consulta só:

```
secdef_total                31
alcancaveis_por_anon        15      (era 22)
  dessas, que ESCREVEM       0      (era 6)
sem_search_path              0      (era 10)
com_guarda_de_chamador       3      (era 0)
politicas_user_roles         3      (as canonicas; as 2 rivais removidas da origem)
migrations_registradas       7      (de 7)
```

| Eixo | Antes | Depois |
|:---|--:|--:|
| `SECURITY DEFINER` alcançáveis por `anon` | 22 | 15 |
| dessas, que **escrevem** | 6 | **0** |
| `SECURITY DEFINER` sem `search_path` fixo | 10 | **0** |
| funções que escrevem sem conferir o chamador | 3 | **0** |
| políticas de escrita do gestor sem recorte por equipe | 2 | **0** |
| definições rivais de RLS em `user_roles` | 2 | **1** (canônica; a rival removida da origem) |

As 7 versionadas **e** registradas em `supabase_migrations.schema_migrations`.

## O que permanece aberto, e é decisão do Senhor

1. **Os 5 helpers de leitura** (`auth_tenant_id`, `auth_user_role`, `has_role`, `has_any_role`,
   `is_super_admin`) alcançáveis por `anon`. **Só leem**, e são avaliados **dentro das políticas de
   RLS** — revogar de `authenticated` travaria leitura legítima em larga escala. Merece rodada
   própria, com prova prévia de que nenhuma política é avaliada sob `anon`. O flanco perigoso delas
   (`search_path`) já fechou.
2. **`TRUNCATE` de `anon`/`authenticated` nas 81 tabelas**, e o `pg_default_acl` faz toda tabela
   futura nascer igual. Sem caminho conhecido hoje (o PostgREST não expõe `TRUNCATE`), mas um
   `REVOKE` pontual não resolve sem mexer no default.
3. **Reprodutibilidade — parcialmente resolvido.** As 4 funções ganharam definição versionada em
   `20260831125000` (quinta rodada), e a sequência foi **provada aplicável em terreno virgem**. Falta
   aplicar essa migration em produção (é no-op lá, aguarda GO) e permanece aberto o achado 9 pleno:
   os 3 gatilhos, as colunas `users.reports_to` e `manager_groups.parent_group_id`, e as outras 12
   funções só do servidor. Um banco reconstruído do git **aplica** as migrations, mas ainda não é
   funcionalmente equivalente à produção.
4. **2 matrículas com tenant divergente** (R4.3) — funcionalidade morta para 2 alunos.
5. **As migrations desta rodada não foram commitadas** — existem só na árvore de trabalho, que é
   exatamente como nasceram as 12 migrations só do servidor do achado 9. Commitá-las é a ação mais
   barata que resta.

---

# QUINTA RODADA — o defeito que ESTA rodada introduziu

**Estado: CORRIGIDO NO REPOSITÓRIO E PROVADO EM TERRENO VIRGEM. NÃO aplicado em produção**
(é no-op lá, e aguarda GO do Senhor como as sete anteriores).
Migration: `supabase/migrations/20260831125000_funcoes_do_servidor_recuperadas.sql`

## R5.1 O defeito, e a honestidade sobre a autoria

As migrations de 31/08 nomeiam 14 funções. **Dez são definidas por alguma migration do
repositório; quatro não são definidas por nenhuma:**

```
manager_groups_parent_guard    recompute_primary_role
trg_recompute_primary_role     users_reports_to_guard
```

`20260831130000` revoga `EXECUTE` das quatro. Num banco reconstruído a partir do git — staging, CI,
cliente novo — elas não existem, e `REVOKE` sobre função inexistente **aborta a migration**.

**É a mesma forma do defeito que esta auditoria corrigiu no dia anterior** (o par de migrations da
Aprendizagem do Time, em que cada uma só funcionava no terreno que a outra não produzia). A
diferença é que aquele foi herdado e **este foi introduzido hoje, por esta rodada, no ato de
endurecer o banco**. Não é achado 9 herdado: as quatro funções já eram só do servidor antes, mas
nenhuma migration versionada as NOMEAVA — foram as minhas que criaram a dependência.

## R5.2 Por que definir, e não apenas condicionar o `REVOKE`

O caminho barato era embrulhar cada `REVOKE` num `IF EXISTS`. **Recusado.** Um condicional que
CALA quando não encontra é exatamente o `IF NOT EXISTS` que custou a esta casa três tabelas com 931
linhas invisíveis. A migration passaria verde em terreno virgem **sem ter endurecido coisa alguma**,
e o verde diria "endureci" quando o correto seria "não havia o que endurecer, e a função vai nascer
depois com o ACL padrão aberto" — isto é, o próprio achado 1 se reconstituindo em silêncio no
ambiente novo.

Definir resolve os dois problemas de uma vez: a sequência passa a ser aplicável **e** o `REVOKE`
seguinte tem sobre o que agir, de modo que o banco reconstruído nasce com o mesmo endurecimento da
produção. A versão `20260831125000` é anterior à `20260831130000`, então no replay ordenado define e
só então revoga; e como `CREATE OR REPLACE` preserva a ACL, aplicá-la sozinha em produção não
reabre nada.

## R5.3 Prova em terreno virgem

Sem `psql` nem Docker nesta máquina, montei o terreno com **PGlite** (`@electric-sql/pglite`,
instalado em `/tmp/virgem`, **fora dos repositórios**, sem tocar em dependência de projeto). É
Postgres real em WASM. **Declaro a diferença de versão: PGlite roda 18.3, a produção roda 17.6** —
irrelevante para a semântica de `REVOKE` sobre função inexistente, que é o que está sob teste, mas
registrada porque um terreno de teste que não é idêntico ao alvo precisa ser dito.

Andaime mínimo: os três papéis (`anon`, `authenticated`, `service_role`), o schema `auth` com
`auth.uid()`, e as **três** funções que outras migrations do repo já definem (`claim_session_turn`,
`release_session_turn`, `update_enrollment_progress`) — assim a única variável em teste são as
quatro recuperadas.

```
FALHOU   A) SEM a correcao (so a revogacao)
         function public.recompute_primary_role(uuid) does not exist

APLICOU  B) COM a correcao (definicoes + revogacao)
         definicoes: OK | revogacao: OK | anon ainda executa 0 das 4 recuperadas
```

O cenário A **reproduz o defeito exato** apontado, em terreno virgem, com a mensagem literal do
Postgres. O cenário B aplica.

### O controle que impede o "0" de ser vazio

"`anon` executa 0 das 4" também seria o resultado se as funções nunca tivessem tido o privilégio —
o verde diria "endureci" sem endurecimento algum, que é justamente a armadilha que motivou recusar
o caminho condicional. Medindo os dois lados do mesmo cenário:

```
CONTROLE  logo apos as definicoes, ANTES da revogacao : anon executa 4 das 4
          depois da revogacao                        : anon executa 0 das 4
```

**4 → 0.** O endurecimento aconteceu, e é atribuível à revogação.

E há um subproduto que vale registrar: **em terreno virgem as funções nascem com `EXECUTE` para
`anon`** (o `4` acima). É o mecanismo do achado 1 — o `DEFAULT ACL` do Supabase — reproduzido ao
vivo, num banco limpo, confirmando que a exposição original nunca foi uma concessão de alguém, e
que qualquer ambiente novo nasceria com ela se estas migrations não existissem.

## R5.4 Recorte declarado — o que esta migration NÃO faz

Ela versiona as **funções**, que é o que as migrations de 31/08 nomeiam. **Não** versiona os 3
gatilhos que as usam, nem as colunas só do servidor de que os corpos dependem em execução
(`users.reports_to`, `manager_groups.parent_group_id`), nem as outras 12 funções só do servidor.
Criar os gatilhos exigiria aquelas colunas, que nenhuma migration cria — o que puxaria o achado 9
inteiro para dentro desta correção.

**Portanto:** esta migration torna a sequência **aplicável** em terreno virgem; ela **não** torna o
banco reconstruído funcionalmente equivalente à produção. Isso é o achado 9, e é trabalho próprio.
Recorte declarado, não escopo esticado.

(Nota técnica que torna isto possível: em `plpgsql` o corpo não é resolvido na criação, apenas
analisado sintaticamente — por isso as quatro criam sem erro num banco onde `users.reports_to` e as
funções auxiliares ainda não existem. O cenário B acima é a prova.)

## R5.5 Erro de método nº 9 — e é dos dois lados

| # | Erro | De quem |
|--:|:---|:---|
| 9 | **Revisar uma migration pelo que ela faz em produção, sem perguntar o que faria num banco vazio.** Sete migrations foram medidas contra o terreno ocupado, uma a uma, com controle positivo e negativo — e nenhuma das medições era capaz de detectar que a sequência não roda em terreno virgem, porque nenhuma foi feita em terreno virgem. | Minha, ao escrevê-las sem testar aplicabilidade; e do lead, ao revisá-las pelo efeito em produção. |

A lição operacional: **"provei que fecha" e "provei que aplica" são duas perguntas diferentes, e a
primeira não implica a segunda.** Toda migration precisa das duas provas — e a segunda só existe
num banco que não tem nada.

---

## Método que se firmou, e vale além deste caso

- **Prova de fechamento é um par com controle:** `25006` (erro de dentro do corpo) → `42501` (negado
  antes de entrar), com um controle positivo em `200` ao lado mostrando que o canal segue vivo.
- **Controle negativo com erro de OUTRA natureza:** rodar o mesmo cenário contra uma função sem
  guarda e obter `P0001` em vez de `42501` é o que torna o `42501` atribuível à guarda, e não à
  maquinaria do teste.
- **Assinatura sai do catálogo, nunca de suposição:** nome de parâmetro errado devolve `404 PGRST202`,
  **idêntico** a função inexistente. Um passo a menos e `recompute_primary_role` teria sido reportada
  como protegida enquanto executava sem login.
- **Classificar pelo mecanismo, não pelo nome:** duas contagens deram 4 e 5; eram 6 em duas classes,
  e o discriminante (`prorettype = 'trigger'`) estava no catálogo o tempo todo.
- **"Fecha" e "aplica" são duas provas, e a primeira não implica a segunda.** Sete migrations foram
  provadas contra o terreno ocupado, com controle dos dois lados, e nenhuma dessas provas era capaz
  de ver que a sequência não rodava em terreno virgem — porque nenhuma foi feita em terreno virgem.
  Toda migration precisa das duas, e a segunda só existe num banco que não tem nada.
- **Condicional que cala é pior que erro que fala.** Recusar o `IF EXISTS` no `REVOKE` e definir a
  função foi a diferença entre uma migration que passa verde sem endurecer e uma que endurece de
  verdade — medido em `4 → 0`.

Nenhum dado real alterado. Nenhum `POST` contra função vulnerável. Nenhum bucket tocado. Nenhum
commit, push, PR ou deploy.
